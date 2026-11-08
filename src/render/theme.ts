/**
 * Palety mapy (canvas) dla dnia i nocy. Renderer czyta kolory z obiektu THEME, który jest
 * aktualizowany w każdej klatce mieszanką obu palet (patrz theme/dayNight.ts).
 * Kolory interfejsu HTML są w theme/cssPalette.ts — trzymaj je w zgodzie.
 */
export const MAP_DAY = {
  background: '#e8edf2',
  ocean: '#e8edf2',
  land: '#fbfbfc',
  coast: 'rgba(100, 116, 139, 0.30)',
  borders: 'rgba(100, 116, 139, 0.20)',
  graticule: 'rgba(100, 116, 139, 0.06)',
  fog: 'rgba(232, 237, 242, 0.74)',

  accent: '#2f6fed',
  cityLocked: 'rgba(100, 116, 139, 0.28)',
  cityAvailableFill: '#ffffff',
  cityAvailable: 'rgba(71, 85, 105, 0.55)',
  cityAvailableHover: '#16202f',
  airport: '#16202f',
  hub: '#2f6fed',
  halo: '#ffffff',
  selection: 'rgba(47, 111, 237, 0.55)',
  ringTrack: 'rgba(22, 32, 47, 0.08)',
  construction: '#16202f',
  glow: 'rgba(255, 220, 160, 0)',

  route: 'rgba(22, 32, 47, 0.30)',
  routeTouch: 'rgba(47, 111, 237, 0.60)',
  routeActive: '#2f6fed',
  routeGlow: 'rgba(47, 111, 237, 0.12)',
  routeIdle: 'rgba(100, 116, 139, 0.55)',
  preview: 'rgba(22, 32, 47, 0.45)',
  previewOk: '#2f6fed',
  previewBad: '#d4483b',

  plane: '#16202f',
  planeSelected: '#2f6fed',
  planeOutline: '#ffffff',

  ok: '#2f9e6b',
  warn: '#d08a1c',
  danger: '#d4483b',
  event: '#d08a1c',
  money: '#2f855a',

  text: '#16202f',
  textDim: '#5b6778',
  labelHalo: 'rgba(251, 251, 252, 0.95)',
  pillBg: '#ffffff',
  pillBorder: 'rgba(22, 32, 47, 0.10)',
  pillShadow: 'rgba(22, 32, 47, 0.12)',
};

export type MapPalette = typeof MAP_DAY;

export const MAP_NIGHT: MapPalette = {
  background: '#0c121b',
  ocean: '#0c121b',
  land: '#161f2c',
  coast: 'rgba(148, 163, 184, 0.20)',
  borders: 'rgba(148, 163, 184, 0.11)',
  graticule: 'rgba(148, 163, 184, 0.04)',
  fog: 'rgba(12, 18, 27, 0.72)',

  accent: '#6f9dff',
  cityLocked: 'rgba(148, 163, 184, 0.22)',
  cityAvailableFill: '#161f2c',
  cityAvailable: 'rgba(170, 184, 204, 0.55)',
  cityAvailableHover: '#e8edf4',
  airport: '#e8edf4',
  hub: '#6f9dff',
  halo: '#161f2c',
  selection: 'rgba(111, 157, 255, 0.6)',
  ringTrack: 'rgba(232, 237, 244, 0.10)',
  construction: '#e8edf4',
  glow: 'rgba(255, 214, 150, 0.16)',

  route: 'rgba(232, 237, 244, 0.28)',
  routeTouch: 'rgba(111, 157, 255, 0.65)',
  routeActive: '#6f9dff',
  routeGlow: 'rgba(111, 157, 255, 0.15)',
  routeIdle: 'rgba(148, 163, 184, 0.45)',
  preview: 'rgba(232, 237, 244, 0.5)',
  previewOk: '#6f9dff',
  previewBad: '#ef6b5e',

  plane: '#f1f5fa',
  planeSelected: '#6f9dff',
  planeOutline: '#0c121b',

  ok: '#45c08a',
  warn: '#e0a43a',
  danger: '#ef6b5e',
  event: '#e0a43a',
  money: '#5fd39b',

  text: '#e8edf4',
  textDim: '#9aa6b6',
  labelHalo: 'rgba(12, 18, 27, 0.92)',
  pillBg: '#151c27',
  pillBorder: 'rgba(148, 163, 184, 0.18)',
  pillShadow: 'rgba(0, 0, 0, 0.4)',
};

/**
 * Zmierzch: wciąż jasny motyw (ciemny tekst), ale z przygaszonym, chłodniejszym tłem.
 * Dzięki temu długi wieczór pozostaje w pełni czytelny.
 */
export const MAP_DUSK: MapPalette = {
  ...MAP_DAY,
  background: '#aeb9c8',
  ocean: '#aeb9c8',
  land: '#d0d8e2',
  coast: 'rgba(71, 85, 105, 0.32)',
  borders: 'rgba(71, 85, 105, 0.22)',
  graticule: 'rgba(71, 85, 105, 0.07)',
  fog: 'rgba(174, 185, 200, 0.72)',
  cityAvailableFill: '#e4e9ef',
  halo: '#dde3ea',
  labelHalo: 'rgba(208, 216, 226, 0.95)',
  pillBg: '#f4f6f9',
  glow: 'rgba(255, 214, 150, 0.06)',
};

/** Wczesna noc: ciemny motyw (jasny tekst) z lżejszym tłem, które dalej stopniowo ciemnieje. */
export const MAP_EVENING: MapPalette = {
  ...MAP_NIGHT,
  background: '#243046',
  ocean: '#243046',
  land: '#323e55',
  coast: 'rgba(148, 163, 184, 0.24)',
  borders: 'rgba(148, 163, 184, 0.14)',
  fog: 'rgba(36, 48, 70, 0.72)',
  cityAvailableFill: '#323e55',
  halo: '#323e55',
  labelHalo: 'rgba(36, 48, 70, 0.92)',
  pillBg: '#1e2735',
  glow: 'rgba(255, 214, 150, 0.10)',
};

/** Bieżące kolory mapy (mieszanka dnia i nocy), aktualizowane przez theme/dayNight.ts. */
export const THEME: MapPalette = { ...MAP_DAY };

/**
 * Obszary ekranu zasłonięte przez pływające panele (px). Muszą odpowiadać układowi w app.css
 * (--gap, --topbar-h, --side-w). Kamera centruje się na widocznej części mapy.
 */
export const PLAY_INSETS = { top: 16 + 64 + 12, right: 16 + 380 + 12, bottom: 16, left: 16 };
export const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
