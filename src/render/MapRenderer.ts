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
import { moneyShort, timeLeft } from '../ui/format';
import { buildProgress, cityTier, isOpen } from '../engine/cities';
import { fade } from '../theme/dayNight';
import { basePaths, CITY_XY, routeGeometry, WORLD_H, WORLD_W } from './projection';
import { NO_INSETS, PLAY_INSETS, THEME } from './theme';

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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const MIN_ZOOM = 1;
const MAX_ZOOM = 12;
const HIT_RADIUS = 12;
const FONT = '"Inter Variable", Inter, system-ui, sans-serif';

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

  private get insets() {
    return this.ctrl.state ? PLAY_INSETS : NO_INSETS;
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    if (this.autoFit) this.focusCities(this.autoFit, false, 5);
  }

  private get baseScale(): number {
    return Math.min(this.w / WORLD_W, this.h / WORLD_H);
  }

  /** Skala px/jednostkę świata. */
  private get scale(): number {
    return this.baseScale * this.cam.k;
  }

  toScreen(x: number, y: number): [number, number] {
    const s = this.scale;
    return [(x - this.cam.x) * s + this.w / 2, (y - this.cam.y) * s + this.h / 2];
  }

  toWorld(sx: number, sy: number): [number, number] {
    const s = this.scale;
    return [(sx - this.w / 2) / s + this.cam.x, (sy - this.h / 2) / s + this.cam.y];
  }

  /** Ustawia kamerę tak, by objąć podane miasta w widocznej (niezasłoniętej panelami) części mapy. */
  focusCities(ids: string[], animate = true, maxZoom = 6): void {
    if (!ids.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const id of ids) {
      const [x, y] = CITY_XY[id];
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    const ins = this.insets;
    const vw = Math.max(200, this.w - ins.left - ins.right - 60);
    const vh = Math.max(200, this.h - ins.top - ins.bottom - 60);
    const pad = 30;
    const base = this.baseScale;
    const k = Math.max(MIN_ZOOM, Math.min(maxZoom, vw / ((x1 - x0 + pad) * base), vh / ((y1 - y0 + pad) * base)));
    const s = base * k;
    // Środek widocznego obszaru względem środka canvasu.
    const offX = (ins.left - ins.right) / 2;
    const offY = (ins.top - ins.bottom) / 2;
    const target = { x: (x0 + x1) / 2 - offX / s, y: (y0 + y1) / 2 - offY / s, k };
    if (animate) this.camTarget = target;
    else this.cam = this.clampCam(target);
  }

  private clampCam(c: Camera): Camera {
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, c.k));
    const s = this.baseScale * k;
    const ins = this.insets;
    // Pozwalamy przesunąć mapę tak, by brzegi świata dało się zobaczyć obok paneli.
    const extraL = ins.left / s;
    const extraR = ins.right / s;
    const extraT = ins.top / s;
    const extraB = ins.bottom / s;
    const halfW = this.w / 2 / s;
    const halfH = this.h / 2 / s;
    const clampAxis = (v: number, half: number, size: number, lo: number, hi: number) => {
      const min = half - lo;
      const max = size - half + hi;
      return min > max ? (min + max) / 2 : Math.max(min, Math.min(max, v));
    };
    return {
      k,
      x: clampAxis(c.x, halfW, WORLD_W, extraL, extraR),
      y: clampAxis(c.y, halfH, WORLD_H, extraT, extraB),
    };
  }

  zoomBy(factor: number, sx?: number, sy?: number): void {
    this.camTarget = null;
    this.autoFit = null;
    const ins = this.insets;
    const cx = sx ?? (ins.left + this.w - ins.right) / 2;
    const cy = sy ?? (ins.top + this.h - ins.bottom) / 2;
    const [wx, wy] = this.toWorld(cx, cy);
    const k = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.cam.k * factor));
    const s = this.baseScale * k;
    this.cam = this.clampCam({ k, x: wx - (cx - this.w / 2) / s, y: wy - (cy - this.h / 2) / s });
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
    if (city && isOpen(s.airports[city]) && !this.ctrl.routeFrom) {
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
      // Menu: dyskretne punkty miast w tle.
      for (const c of CITIES) {
        const [x, y] = this.toScreen(...CITY_XY[c.id]);
        dot(ctx, x, y, 1.8, THEME.cityLocked);
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
    this.drawPreviewPill(s);
  }

  private drawBase(): void {
    const ctx = this.ctx;
    const { land, borders, sphere, graticule } = basePaths();
    const sc = this.scale;
    ctx.save();
    ctx.setTransform(this.dpr * sc, 0, 0, this.dpr * sc, this.dpr * (this.w / 2 - this.cam.x * sc), this.dpr * (this.h / 2 - this.cam.y * sc));
    ctx.fillStyle = THEME.ocean;
    ctx.fill(sphere);
    ctx.lineWidth = 0.7 / sc;
    ctx.strokeStyle = THEME.graticule;
    ctx.stroke(graticule);
    ctx.fillStyle = THEME.land;
    ctx.fill(land);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 0.7 / sc;
    ctx.strokeStyle = THEME.borders;
    ctx.stroke(borders);
    ctx.lineWidth = 0.9 / sc;
    ctx.strokeStyle = THEME.coast;
    ctx.stroke(land);
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
    ctx.lineJoin = 'round';
    for (const r of Object.values(s.routes)) {
      const n = planeCount[r.id] ?? 0;
      const isSel = r.id === selected;
      const touches = selectedCity && (r.a === selectedCity || r.b === selectedCity);
      const hover = r.id === this.hoverRoute;
      if (isSel || hover) {
        ctx.setLineDash([]);
        ctx.strokeStyle = THEME.routeGlow;
        ctx.lineWidth = 7;
        this.strokeRoute(r.a, r.b);
      }
      ctx.lineWidth = isSel ? 2 : 1 + Math.min(n, 6) * 0.18;
      if (n === 0) {
        ctx.setLineDash([3, 4]);
        ctx.lineDashOffset = -now / 80;
        ctx.strokeStyle = isSel ? THEME.routeActive : THEME.routeIdle;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = isSel || hover ? THEME.routeActive : touches ? THEME.routeTouch : THEME.route;
      }
      this.strokeRoute(r.a, r.b);
    }
    ctx.setLineDash([]);
  }

  private previewInfo(s: GameState): { from: string; target: string | null; valid: boolean; label: string } | null {
    const from = this.drag?.mode === 'route' && this.drag.moved ? this.drag.from : this.ctrl.routeFrom;
    if (!from || !this.pointer) return null;
    const target = this.hoverCity && this.hoverCity !== from ? this.hoverCity : null;
    if (!target) return { from, target, valid: false, label: 'Wskaż lotnisko docelowe' };
    const dist = cityDistance(from, target);
    const err = s.airports[target] ? checkOpenRoute(s, from, target) : 'Brak lotniska w tym mieście';
    return {
      from,
      target,
      valid: !err,
      label: err ?? `${CITY_BY_ID[target].name}  ·  ${dist.toLocaleString('pl-PL')} km  ·  ${routeOpenCost(dist).toLocaleString('pl-PL')} $`,
    };
  }

  private drawRoutePreview(s: GameState): void {
    const info = this.previewInfo(s);
    if (!info || !this.pointer) return;
    const ctx = this.ctx;
    const [x0, y0] = this.toScreen(...CITY_XY[info.from]);
    ctx.strokeStyle = info.target ? (info.valid ? THEME.previewOk : THEME.previewBad) : THEME.preview;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([5, 5]);
    if (info.target) this.strokeRoute(info.from, info.target);
    else {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(this.pointer.x, this.pointer.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  private drawPreviewPill(s: GameState): void {
    const info = this.previewInfo(s);
    if (!info || !this.pointer) return;
    const color = info.target ? (info.valid ? THEME.text : THEME.previewBad) : THEME.textDim;
    this.pill(this.pointer.x + 16, this.pointer.y + 18, info.label, color);
  }

  private pill(x: number, y: number, text: string, color: string): void {
    const ctx = this.ctx;
    ctx.font = `500 12px ${FONT}`;
    const w = ctx.measureText(text).width + 22;
    const h = 28;
    const px = Math.min(x, this.w - w - 12);
    const py = Math.min(y, this.h - h - 12);
    ctx.save();
    ctx.shadowColor = THEME.pillShadow;
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = THEME.pillBg;
    roundRect(ctx, px, py, w, h, 8);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = THEME.pillBorder;
    ctx.lineWidth = 1;
    roundRect(ctx, px + 0.5, py + 0.5, w - 1, h - 1, 8);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, px + 11, py + h / 2 + 0.5);
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
      if (x < -20 || y < -20 || x > this.w + 20 || y > this.h + 20) continue;
      const [x2, y2] = this.toScreen(ax, ay);
      let ang = Math.atan2(y2 - y, x2 - x);
      if (Math.abs(x2 - x) > this.w / 3) ang = Math.atan2(y2 - y, -(x2 - x));
      const type = AIRCRAFT_BY_ID[p.typeId];
      const size = 5.5 + Math.min(2.5, type.seats / 160);
      planeGlyph(ctx, x, y, ang, size, p.routeId === selected ? THEME.planeSelected : THEME.plane);
    }
  }

  private drawCities(s: GameState, selected: string | null, closed: Set<string>, now: number): void {
    const ctx = this.ctx;
    const k = this.cam.k;
    const labels: { x: number; y: number; text: string; strong: boolean; priority: number }[] = [];
    const eventCities = new Set(s.events.map((e) => e.targetId));
    const night = this.ctrl.night > 0.02;

    for (const c of CITIES) {
      const [x, y] = this.toScreen(...CITY_XY[c.id]);
      if (x < -60 || y < -40 || x > this.w + 60 || y > this.h + 40) continue;
      const ap = s.airports[c.id];
      const unlocked = s.unlockedRegions.includes(c.region);
      const isHover = this.hoverCity === c.id;
      const isSel = selected === c.id;

      const tier = cityTier(c);
      if (!ap) {
        if (!unlocked) {
          dot(ctx, x, y, 0.9 + tier * 0.35, THEME.cityLocked);
          continue;
        }
        const r = [0, 2.1, 2.6, 3.2, 3.9][tier];
        if (isSel || isHover) ring(ctx, x, y, r + 5, THEME.selection, 1.25);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = THEME.cityAvailableFill;
        ctx.fill();
        ctx.lineWidth = tier >= 3 ? 1.5 : 1.15;
        ctx.strokeStyle = isHover || isSel ? THEME.cityAvailableHover : THEME.cityAvailable;
        ctx.stroke();
        const minZoom = [0, 3.6, 2.6, 1.8, 1][tier];
        if (k >= minZoom || isHover || isSel) {
          labels.push({ x: x + r + 5, y, text: c.name, strong: false, priority: isHover || isSel ? 1000 : tier * 100 + c.pop });
        }
        continue;
      }

      if (ap.buildEnd !== undefined) {
        // Lotnisko w budowie: pusty punkt i łuk postępu.
        const { ratio, left } = buildProgress(s, ap);
        const r = 4;
        const ringR = r + 4;
        ring(ctx, x, y, ringR, THEME.ringTrack, 2);
        ctx.beginPath();
        ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
        ctx.strokeStyle = THEME.accent;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        if (isSel || isHover) ring(ctx, x, y, ringR + 4, THEME.selection, 1.25);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = THEME.halo;
        ctx.fill();
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = THEME.construction;
        ctx.stroke();
        ctx.setLineDash([]);
        labels.push({ x: x + ringR + 5, y, text: `${c.name} · ${timeLeft(left)}`, strong: false, priority: 1500 + c.pop });
        continue;
      }

      const lvl = airportLevel(ap.level);
      const r = 3.6 + ap.level * 0.6;
      const fill = waitingTotal(s, c.id) / lvl.capacity;
      const isHub = c.id === s.startCity;
      const ringR = r + 4;

      // Zapełnienie terminalu — cienki łuk wokół punktu.
      ring(ctx, x, y, ringR, THEME.ringTrack, 2);
      if (fill > 0.01) {
        const color = fill < 0.5 ? THEME.ok : fill < 0.8 ? THEME.warn : THEME.danger;
        ctx.beginPath();
        ctx.arc(x, y, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, fill));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        if (fill > 0.9) {
          const pulse = (now % 1400) / 1400;
          ring(ctx, x, y, ringR + 2 + pulse * 9, fade(THEME.danger, 0.45 * (1 - pulse)), 1.5);
        }
      }
      if (isSel || isHover || this.ctrl.routeFrom === c.id) ring(ctx, x, y, ringR + 4, THEME.selection, 1.25);

      if (night) {
        // Nocą lotniska delikatnie świecą, jak światła miasta.
        const g = ctx.createRadialGradient(x, y, 0, x, y, ringR + 12);
        g.addColorStop(0, THEME.glow);
        g.addColorStop(1, fade(THEME.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, ringR + 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = THEME.halo;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = isHub ? THEME.hub : THEME.airport;
      ctx.fill();

      if (closed.has(c.id)) {
        ctx.strokeStyle = THEME.halo;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        const d = r * 0.5;
        ctx.beginPath();
        ctx.moveTo(x - d, y - d);
        ctx.lineTo(x + d, y + d);
        ctx.moveTo(x + d, y - d);
        ctx.lineTo(x - d, y + d);
        ctx.stroke();
        ring(ctx, x, y, ringR, THEME.danger, 2);
      } else if (eventCities.has(c.id)) {
        dot(ctx, x + ringR * 0.72, y - ringR * 0.72, 2.6, THEME.event);
      }
      labels.push({
        x: x + ringR + 5,
        y,
        text: c.name,
        strong: true,
        priority: (isSel || isHover ? 3000 : 800) + ap.level * 10 + c.pop,
      });
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    labels.sort((p, q) => q.priority - p.priority);
    const placed: Rect[] = [];
    for (const l of labels) {
      ctx.font = l.strong ? `600 11.5px ${FONT}` : `500 11px ${FONT}`;
      const w = ctx.measureText(l.text).width;
      const rect: Rect = { x: l.x - 2, y: l.y - 8, w: w + 4, h: 16 };
      if (placed.some((r) => overlaps(r, rect))) continue;
      placed.push(rect);
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = THEME.labelHalo;
      ctx.strokeText(l.text, l.x, l.y);
      ctx.fillStyle = l.strong ? THEME.text : THEME.textDim;
      ctx.fillText(l.text, l.x, l.y);
    }
  }

  private drawFloating(now: number): void {
    // Przy oddalonym widoku napisy z przychodami zaśmiecałyby mapę.
    if (this.cam.k < 2.5) return;
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = `600 10.5px ${FONT}`;
    const placed: Rect[] = [];
    // Najnowsze napisy mają pierwszeństwo; nachodzące na siebie starsze są pomijane.
    for (let i = this.ctrl.floating.length - 1; i >= 0; i--) {
      const f = this.ctrl.floating[i];
      const age = (now - f.born) / 1600;
      if (age < 0 || age > 1) continue;
      const [x, y] = this.toScreen(...CITY_XY[f.cityId]);
      const text = `+${moneyShort(f.amount)}`;
      const yy = y - 14 - age * 18;
      const w = ctx.measureText(text).width;
      const rect: Rect = { x: x - w / 2 - 2, y: yy - 12, w: w + 4, h: 13 };
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

/** Minimalistyczna sylwetka samolotu (widok z góry) skierowana wzdłuż kąta `ang`. */
function planeGlyph(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const s = size;
  ctx.beginPath();
  ctx.moveTo(s * 1.05, 0);
  ctx.quadraticCurveTo(s * 0.85, s * 0.13, s * 0.45, s * 0.14);
  ctx.lineTo(-s * 0.05, s * 0.95);
  ctx.lineTo(-s * 0.3, s * 0.95);
  ctx.lineTo(-s * 0.1, s * 0.14);
  ctx.lineTo(-s * 0.62, s * 0.12);
  ctx.lineTo(-s * 0.82, s * 0.42);
  ctx.lineTo(-s * 0.98, s * 0.42);
  ctx.lineTo(-s * 0.86, 0);
  ctx.lineTo(-s * 0.98, -s * 0.42);
  ctx.lineTo(-s * 0.82, -s * 0.42);
  ctx.lineTo(-s * 0.62, -s * 0.12);
  ctx.lineTo(-s * 0.1, -s * 0.14);
  ctx.lineTo(-s * 0.3, -s * 0.95);
  ctx.lineTo(-s * 0.05, -s * 0.95);
  ctx.lineTo(s * 0.45, -s * 0.14);
  ctx.quadraticCurveTo(s * 0.85, -s * 0.13, s * 1.05, 0);
  ctx.closePath();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = THEME.planeOutline;
  ctx.stroke();
  ctx.fillStyle = color;
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
