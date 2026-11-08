import { AIRCRAFT_BY_ID } from '../data/aircraft';
import { airportLevel } from '../data/airportLevels';
import { CITIES, CITY_BY_ID } from '../data/cities';
import { checkOpenRoute, openRoute } from '../engine/actions';
import { routeOpenCost } from '../engine/economy';
import { getModifiers } from '../engine/events';
import { cityDistance } from '../engine/geo';
import { waitingTotal } from '../engine/passengers';
import type { GameState } from '../engine/types';
import type { GameController } from '../game/controller';
import { basePaths, CITY_XY, routeGeometry, WORLD_H, WORLD_W } from './projection';
import { THEME } from './theme';
import { moneyShort } from '../ui/format';

interface Camera {
  x: number;
  y: number;
  /** Zoom względem widoku całego świata. */
  k: number;
}

type DragState =
  | { mode: 'pan'; sx: number; sy: number; cx: number; cy: number; moved: boolean }
  | { mode: 'route'; from: string; sx: number; sy: number; moved: boolean }
  | null;

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
const HIT_RADIUS = 13;

/**
 * Rysuje mapę na canvasie i obsługuje wejście (przesuwanie, zoom, zaznaczanie, rysowanie tras).
 * Nie trzyma stanu gry — czyta go z kontrolera w każdej klatce.
 */
export class MapRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  cam: Camera = { x: WORLD_W / 2, y: WORLD_H / 2, k: 1 };
  private camTarget: Camera | null = null;
  private hoverCity: string | null = null;
  private hoverRoute: string | null = null;
  private pointer: { x: number; y: number } | null = null;
  private drag: DragState = null;
  private disposers: (() => void)[] = [];
  private lastState: GameState | null = null;
  /** Miasta do objęcia kamerą po starcie gry (ponawiane przy zmianie rozmiaru, dopóki gracz nie ruszy mapy). */
  private autoFit: string[] | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private ctrl: GameController,
  ) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(canvas);
    this.disposers.push(() => ro.disconnect());
    this.listen('pointerdown', this.onDown);
    this.listen('pointermove', this.onMove);
    this.listen('pointerup', this.onUp);
    this.listen('pointerleave', () => {
      this.pointer = null;
      this.hoverCity = null;
      this.hoverRoute = null;
    });
    this.listen('wheel', this.onWheel, { passive: false });
    this.listen('contextmenu', (e) => {
      e.preventDefault();
      if (this.ctrl.routeFrom) this.ctrl.cancelRoute();
    });
    this.disposers.push(ctrl.onFrame((now) => this.draw(now)));
    if (import.meta.env.DEV) (window as unknown as { contrailMap: MapRenderer }).contrailMap = this;
  }

  dispose(): void {
    for (const d of this.disposers) d();
  }

  private listen<K extends keyof HTMLElementEventMap>(
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
    opts?: AddEventListenerOptions,
  ): void {
    this.canvas.addEventListener(type, fn as EventListener, opts);
    this.disposers.push(() => this.canvas.removeEventListener(type, fn as EventListener));
  }

  // ---------- Kamera ----------

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    if (this.autoFit) this.focusCities(this.autoFit, false, 5);
  }

  /** Skala px/jednostkę świata. */
  private get scale(): number {
    return Math.min(this.w / WORLD_W, this.h / WORLD_H) * this.cam.k;
  }

  toScreen(x: number, y: number): [number, number] {
    const s = this.scale;
    return [(x - this.cam.x) * s + this.w / 2, (y - this.cam.y) * s + this.h / 2];
  }

  toWorld(sx: number, sy: number): [number, number] {
    const s = this.scale;
    return [(sx - this.w / 2) / s + this.cam.x, (sy - this.h / 2) / s + this.cam.y];
  }

  /** Płynnie ustawia kamerę tak, by objąć podane miasta. */
  focusCities(ids: string[], animate = true, maxZoom = 6): void {
    if (!ids.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const [x, y] = CITY_XY[id];
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const pad = 40;
    const base = Math.min(this.w / WORLD_W, this.h / WORLD_H);
    const k = Math.max(MIN_ZOOM, Math.min(maxZoom, Math.min((this.w - 80) / ((x1 - x0 + pad) * base), (this.h - 140) / ((y1 - y0 + pad) * base))));
    const target = { x: (x0 + x1) / 2, y: (y0 + y1) / 2, k };
    if (animate) this.camTarget = target;
    else this.cam = this.clampCam(target);
  }

  private clampCam(c: Camera): Camera {
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.k));
    const s = Math.min(this.w / WORLD_W, this.h / WORLD_H) * k;
    const halfW = this.w / 2 / s;
    const halfH = this.h / 2 / s;
    const clampAxis = (v: number, half: number, size: number) =>
      half * 2 >= size ? size / 2 : Math.max(half, Math.min(size - half, v));
    return { k, x: clampAxis(c.x, halfW, WORLD_W), y: clampAxis(c.y, halfH, WORLD_H) };
  }

  zoomBy(factor: number, sx = this.w / 2, sy = this.h / 2): void {
    this.camTarget = null;
    this.autoFit = null;
    const [wx, wy] = this.toWorld(sx, sy);
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.cam.k * factor));
    const s = Math.min(this.w / WORLD_W, this.h / WORLD_H) * k;
    this.cam = this.clampCam({ k, x: wx - (sx - this.w / 2) / s, y: wy - (sy - this.h / 2) / s });
  }

  // ---------- Trafienia ----------

  private cityAt(sx: number, sy: number, s: GameState): string | null {
    let best: string | null = null;
    let bestD = HIT_RADIUS;
    for (const c of CITIES) {
      if (!s.unlockedRegions.includes(c.region) && !s.airports[c.id]) continue;
      const [x, y] = this.toScreen(...CITY_XY[c.id]);
      const d = Math.hypot(x - sx, y - sy);
      if (d < bestD) {
        bestD = d;
        best = c.id;
      }
    }
    return best;
  }

  private routeAt(sx: number, sy: number, s: GameState): string | null {
    let best: string | null = null;
    let bestD = 7;
    for (const r of Object.values(s.routes)) {
      for (const seg of routeGeometry(r.a, r.b).segments) {
        for (let i = 1; i < seg.length; i++) {
          const [x1, y1] = this.toScreen(...seg[i - 1]);
          const [x2, y2] = this.toScreen(...seg[i]);
          const d = distToSegment(sx, sy, x1, y1, x2, y2);
          if (d < bestD) {
            bestD = d;
            best = r.id;
          }
        }
      }
    }
    return best;
  }

  // ---------- Wejście ----------

  private local(e: PointerEvent | WheelEvent): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  private onDown = (e: PointerEvent) => {
    const s = this.ctrl.state;
    if (!s || e.button === 2) return;
    const [sx, sy] = this.local(e);
    this.canvas.setPointerCapture(e.pointerId);
    this.camTarget = null;
    this.autoFit = null;
    const city = this.cityAt(sx, sy, s);
    if (city && s.airports[city] && !this.ctrl.routeFrom) {
      this.drag = { mode: 'route', from: city, sx, sy, moved: false };
    } else {
      this.drag = { mode: 'pan', sx, sy, cx: this.cam.x, cy: this.cam.y, moved: false };
    }
  };

  private onMove = (e: PointerEvent) => {
    const s = this.ctrl.state;
    const [sx, sy] = this.local(e);
    this.pointer = { x: sx, y: sy };
    if (!s) return;
    const d = this.drag;
    if (d) {
      if (!d.moved && Math.hypot(sx - d.sx, sy - d.sy) > 5) d.moved = true;
      if (d.mode === 'pan' && d.moved) {
        const sc = this.scale;
        this.cam = this.clampCam({ k: this.cam.k, x: d.cx - (sx - d.sx) / sc, y: d.cy - (sy - d.sy) / sc });
      }
    }
    this.hoverCity = this.cityAt(sx, sy, s);
    this.hoverRoute = this.hoverCity ? null : this.routeAt(sx, sy, s);
    this.canvas.style.cursor =
      d?.mode === 'pan' && d.moved ? 'grabbing' : this.hoverCity || this.hoverRoute ? 'pointer' : this.ctrl.routeFrom ? 'crosshair' : 'grab';
  };

  private onUp = (e: PointerEvent) => {
    const s = this.ctrl.state;
    const d = this.drag;
    this.drag = null;
    if (!s || !d) return;
    const [sx, sy] = this.local(e);
    const city = this.cityAt(sx, sy, s);

    if (d.mode === 'route' && d.moved) {
      if (city && city !== d.from) this.tryOpenRoute(d.from, city);
      return;
    }
    if (d.moved) return;

    // Kliknięcie
    if (this.ctrl.routeFrom) {
      if (city && city !== this.ctrl.routeFrom) this.tryOpenRoute(this.ctrl.routeFrom, city);
      else if (!city) this.ctrl.cancelRoute();
      return;
    }
    if (city) this.ctrl.select({ kind: 'city', id: city });
    else {
      const route = this.routeAt(sx, sy, s);
      this.ctrl.select(route ? { kind: 'route', id: route } : null);
    }
  };

  private tryOpenRoute(a: string, b: string): void {
    const s = this.ctrl.state!;
    if (!s.airports[b]) {
      this.ctrl.message('bad', 'Brak lotniska', `Najpierw otwórz lotnisko w mieście ${CITY_BY_ID[b].name}.`);
      this.ctrl.select({ kind: 'city', id: b });
      return;
    }
    const res = this.ctrl.act((st) => openRoute(st, a, b));
    if (res.ok && res.id) this.ctrl.select({ kind: 'route', id: res.id });
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const [sx, sy] = this.local(e);
    this.zoomBy(Math.exp(-e.deltaY * 0.0015), sx, sy);
  };

  // ---------- Rysowanie ----------

  draw(now: number): void {
    const s = this.ctrl.state;
    if (s !== this.lastState) {
      this.lastState = s;
      if (s) {
        const own = Object.keys(s.airports);
        const region = CITY_BY_ID[s.startCity].region;
        const ids = own.length > 1 ? own : CITIES.filter((c) => c.region === region).map((c) => c.id);
        this.autoFit = ids;
        this.focusCities(ids, false, 5);
      } else {
        this.autoFit = null;
        this.cam = { x: WORLD_W / 2, y: WORLD_H / 2, k: 1 };
      }
    }
    if (this.ctrl.focusRequest) {
      this.autoFit = null;
      this.focusCities(this.ctrl.focusRequest, true, 5);
      this.ctrl.focusRequest = null;
    }
    if (this.camTarget) {
      const t = this.camTarget;
      const a = 0.14;
      this.cam = this.clampCam({ x: this.cam.x + (t.x - this.cam.x) * a, y: this.cam.y + (t.y - this.cam.y) * a, k: this.cam.k + (t.k - this.cam.k) * a });
      if (Math.abs(t.k - this.cam.k) < 0.005 && Math.hypot(t.x - this.cam.x, t.y - this.cam.y) < 0.2) this.camTarget = null;
    }

    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = THEME.background;
    ctx.fillRect(0, 0, this.w, this.h);
    this.drawBase();
    if (!s) {
      // Menu: dekoracyjne miasta w tle.
      for (const c of CITIES) {
        const [x, y] = this.toScreen(...CITY_XY[c.id]);
        dot(ctx, x, y, 1.6, THEME.cityLocked);
      }
      return;
    }
    const mods = getModifiers(s);
    const sel = this.ctrl.selection;
    const selectedRoute = sel?.kind === 'route' ? sel.id : null;
    const selectedCity = sel?.kind === 'city' ? sel.id : null;

    this.drawRoutes(s, selectedRoute, selectedCity, now);
    this.drawRoutePreview(s);
    this.drawPlanes(s, selectedRoute);
    this.drawCities(s, selectedCity, mods.closed, now);
    this.drawFloating(now);
  }

  private drawBase(): void {
    const ctx = this.ctx;
    const { land, sphere, graticule } = basePaths();
    const sc = this.scale;
    ctx.save();
    ctx.setTransform(this.dpr * sc, 0, 0, this.dpr * sc, this.dpr * (this.w / 2 - this.cam.x * sc), this.dpr * (this.h / 2 - this.cam.y * sc));
    ctx.fillStyle = THEME.ocean;
    ctx.fill(sphere);
    ctx.lineWidth = 0.6 / sc;
    ctx.strokeStyle = THEME.graticule;
    ctx.stroke(graticule);
    ctx.fillStyle = THEME.land;
    ctx.fill(land);
    ctx.lineWidth = 0.8 / sc;
    ctx.strokeStyle = THEME.coast;
    ctx.stroke(land);
    ctx.lineWidth = 1 / sc;
    ctx.strokeStyle = THEME.sphereEdge;
    ctx.stroke(sphere);
    ctx.restore();
  }

  private strokeRoute(a: string, b: string): void {
    const ctx = this.ctx;
    ctx.beginPath();
    for (const seg of routeGeometry(a, b).segments) {
      seg.forEach((p, i) => {
        const [x, y] = this.toScreen(p[0], p[1]);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    }
    ctx.stroke();
  }

  private drawRoutes(s: GameState, selected: string | null, selectedCity: string | null, now: number): void {
    const ctx = this.ctx;
    const planeCount: Record<string, number> = {};
    for (const p of Object.values(s.planes)) if (p.routeId) planeCount[p.routeId] = (planeCount[p.routeId] ?? 0) + 1;
    ctx.lineCap = 'round';
    for (const r of Object.values(s.routes)) {
      const n = planeCount[r.id] ?? 0;
      const isSel = r.id === selected;
      const touches = selectedCity && (r.a === selectedCity || r.b === selectedCity);
      const hover = r.id === this.hoverRoute;
      if (isSel) {
        ctx.strokeStyle = THEME.routeGlow;
        ctx.lineWidth = 8;
        ctx.setLineDash([]);
        this.strokeRoute(r.a, r.b);
      }
      ctx.lineWidth = (isSel ? 2.6 : 1.4) + Math.min(n, 6) * 0.35 + (hover ? 0.8 : 0);
      if (n === 0) {
        ctx.setLineDash([5, 5]);
        ctx.lineDashOffset = -now / 60;
        ctx.strokeStyle = THEME.routeIdle;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = isSel || hover ? THEME.routeActive : touches ? THEME.routeTouch : THEME.route;
      }
      this.strokeRoute(r.a, r.b);
    }
    ctx.setLineDash([]);
  }

  private drawRoutePreview(s: GameState): void {
    const from = this.drag?.mode === 'route' && this.drag.moved ? this.drag.from : this.ctrl.routeFrom;
    if (!from || !this.pointer) return;
    const ctx = this.ctx;
    const [x0, y0] = this.toScreen(...CITY_XY[from]);
    const target = this.hoverCity && this.hoverCity !== from ? this.hoverCity : null;
    let label = 'Wskaż lotnisko docelowe';
    let valid = false;
    if (target) {
      const dist = cityDistance(from, target);
      const err = s.airports[target] ? checkOpenRoute(s, from, target) : 'Brak lotniska w tym mieście';
      valid = !err;
      label = err ?? `${CITY_BY_ID[target].name} · ${dist.toLocaleString('pl-PL')} km · ${routeOpenCost(dist).toLocaleString('pl-PL')} $`;
    }
    ctx.strokeStyle = target ? (valid ? THEME.previewOk : THEME.previewBad) : THEME.preview;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    if (target) this.strokeRoute(from, target);
    else {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(this.pointer.x, this.pointer.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    this.pill(this.pointer.x + 14, this.pointer.y + 18, label, target ? (valid ? THEME.previewOk : THEME.previewBad) : THEME.textDim);
  }

  private pill(x: number, y: number, text: string, color: string): void {
    const ctx = this.ctx;
    ctx.font = '500 12px "Inter Variable", system-ui, sans-serif';
    const w = ctx.measureText(text).width + 18;
    const px = Math.min(x, this.w - w - 8);
    ctx.fillStyle = THEME.pillBg;
    roundRect(ctx, px, y, w, 24, 6);
    ctx.fill();
    ctx.strokeStyle = THEME.pillBorder;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, px + 9, y + 12.5);
  }

  private drawPlanes(s: GameState, selected: string | null): void {
    const ctx = this.ctx;
    for (const p of Object.values(s.planes)) {
      if (p.status !== 'flying' || !p.routeId) continue;
      const r = s.routes[p.routeId];
      if (!r) continue;
      const g = routeGeometry(r.a, r.b);
      const forward = p.from === r.a;
      const t = forward ? p.progress : 1 - p.progress;
      const [wx, wy] = g.at(t);
      const [ax, ay] = g.at(Math.max(0, Math.min(1, t + (forward ? 0.01 : -0.01))));
      const [x, y] = this.toScreen(wx, wy);
      const [x2, y2] = this.toScreen(ax, ay);
      let ang = Math.atan2(y2 - y, x2 - x);
      if (Math.abs(x2 - x) > this.w / 3) ang = Math.atan2(y2 - y, -(x2 - x));
      const type = AIRCRAFT_BY_ID[p.typeId];
      const size = 6 + Math.min(4, type.seats / 110);
      planeGlyph(ctx, x, y, ang, size, p.routeId === selected ? THEME.planeSelected : THEME.plane);
    }
  }

  private drawCities(s: GameState, selected: string | null, closed: Set<string>, now: number): void {
    const ctx = this.ctx;
    const zoomed = this.cam.k >= 2.6;
    const labels: { x: number; y: number; text: string; strong: boolean; priority: number }[] = [];
    const eventCities = new Set(s.events.map((e) => e.targetId));

    for (const c of CITIES) {
      const [x, y] = this.toScreen(...CITY_XY[c.id]);
      if (x < -40 || y < -40 || x > this.w + 40 || y > this.h + 40) continue;
      const ap = s.airports[c.id];
      const unlocked = s.unlockedRegions.includes(c.region);
      const isHover = this.hoverCity === c.id;
      const isSel = selected === c.id;

      if (!ap) {
        if (!unlocked) {
          dot(ctx, x, y, 1.8, THEME.cityLocked);
          continue;
        }
        const r = 3 + Math.min(2.5, Math.sqrt(c.pop) * 0.45);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = THEME.background;
        ctx.fill();
        ctx.lineWidth = isHover || isSel ? 2 : 1.3;
        ctx.strokeStyle = isHover || isSel ? THEME.cityAvailableHover : THEME.cityAvailable;
        ctx.stroke();
        if (isSel) ring(ctx, x, y, r + 5, THEME.selection, 1.5);
        if (zoomed || isHover || isSel) labels.push({ x, y: y + r + 4, text: c.name, strong: false, priority: isHover || isSel ? 1000 : c.pop });
        continue;
      }

      const lvl = airportLevel(ap.level);
      const r = 4.5 + ap.level * 1.1;
      const fill = waitingTotal(s, c.id) / lvl.capacity;
      const isHub = c.id === s.startCity;

      // Pierścień zapełnienia terminalu
      ring(ctx, x, y, r + 4, THEME.ringTrack, 3);
      if (fill > 0.01) {
        const color = fill < 0.5 ? THEME.ok : fill < 0.8 ? THEME.warn : THEME.danger;
        ctx.beginPath();
        ctx.arc(x, y, r + 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fill));
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.stroke();
        if (fill > 0.9) {
          const pulse = (now % 1200) / 1200;
          ring(ctx, x, y, r + 6 + pulse * 10, withAlpha(THEME.danger, 0.6 * (1 - pulse)), 2);
        }
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isHub ? THEME.hub : THEME.airport;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = THEME.background;
      ctx.stroke();
      if (closed.has(c.id)) {
        ctx.strokeStyle = THEME.danger;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - r * 0.6, y - r * 0.6);
        ctx.lineTo(x + r * 0.6, y + r * 0.6);
        ctx.moveTo(x + r * 0.6, y - r * 0.6);
        ctx.lineTo(x - r * 0.6, y + r * 0.6);
        ctx.stroke();
      } else if (eventCities.has(c.id)) {
        dot(ctx, x + r + 3, y - r - 3, 3, THEME.event);
      }
      if (isSel || isHover || this.ctrl.routeFrom === c.id) ring(ctx, x, y, r + 8, THEME.selection, 1.5);
      labels.push({
        x,
        y: y + r + 8,
        text: zoomed ? c.name : c.code,
        strong: true,
        priority: (isSel || isHover ? 2000 : 100) + ap.level * 10 + c.pop,
      });
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    labels.sort((p, q) => q.priority - p.priority);
    const placed: Rect[] = [];
    for (const l of labels) {
      ctx.font = l.strong ? '600 11px "Inter Variable", system-ui, sans-serif' : '500 11px "Inter Variable", system-ui, sans-serif';
      const w = ctx.measureText(l.text).width;
      const rect: Rect = { x: l.x - w / 2 - 2, y: l.y - 1, w: w + 4, h: 14 };
      if (placed.some((r) => overlaps(r, rect))) continue;
      placed.push(rect);
      ctx.lineWidth = 3;
      ctx.strokeStyle = THEME.labelHalo;
      ctx.strokeText(l.text, l.x, l.y);
      ctx.fillStyle = l.strong ? THEME.text : THEME.textDim;
      ctx.fillText(l.text, l.x, l.y);
    }
  }

  private drawFloating(now: number): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = '600 11px "Inter Variable", system-ui, sans-serif';
    const placed: Rect[] = [];
    // Najnowsze napisy mają pierwszeństwo; nachodzące na siebie starsze są pomijane.
    for (let i = this.ctrl.floating.length - 1; i >= 0; i--) {
      const f = this.ctrl.floating[i];
      const age = (now - f.born) / 1600;
      if (age < 0 || age > 1) continue;
      const [x, y] = this.toScreen(...CITY_XY[f.cityId]);
      const text = `+${moneyShort(f.amount)}`;
      const yy = y - 16 - age * 22;
      const w = ctx.measureText(text).width;
      const rect: Rect = { x: x - w / 2 - 2, y: yy - 13, w: w + 4, h: 14 };
      if (placed.some((r) => overlaps(r, rect))) continue;
      placed.push(rect);
      ctx.globalAlpha = 1 - age * age;
      ctx.lineWidth = 3;
      ctx.strokeStyle = THEME.labelHalo;
      ctx.strokeText(text, x, yy);
      ctx.fillStyle = THEME.money;
      ctx.fillText(text, x, yy);
    }
    ctx.globalAlpha = 1;
  }
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// ---------- Pomocnicze funkcje rysujące ----------

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Minimalistyczna sylwetka samolotu skierowana wzdłuż kąta `ang`. */
function planeGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const s = size;
  ctx.beginPath();
  ctx.moveTo(s, 0);
  ctx.lineTo(s * 0.2, s * 0.16);
  ctx.lineTo(-s * 0.15, s * 0.85);
  ctx.lineTo(-s * 0.38, s * 0.85);
  ctx.lineTo(-s * 0.2, s * 0.16);
  ctx.lineTo(-s * 0.7, s * 0.14);
  ctx.lineTo(-s * 0.9, s * 0.42);
  ctx.lineTo(-s * 1.02, s * 0.42);
  ctx.lineTo(-s * 0.9, 0);
  ctx.lineTo(-s * 1.02, -s * 0.42);
  ctx.lineTo(-s * 0.9, -s * 0.42);
  ctx.lineTo(-s * 0.7, -s * 0.14);
  ctx.lineTo(-s * 0.2, -s * 0.16);
  ctx.lineTo(-s * 0.38, -s * 0.85);
  ctx.lineTo(-s * 0.15, -s * 0.85);
  ctx.lineTo(s * 0.2, -s * 0.16);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 4;
  ctx.fill();
  ctx.restore();
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}
