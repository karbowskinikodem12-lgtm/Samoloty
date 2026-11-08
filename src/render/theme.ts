/**
 * Paleta mapy (canvas). Jasna, stonowana: atrament (ink) dla elementów gracza, jeden akcent
 * dla zaznaczeń i kolory statusu tylko tam, gdzie niosą informację (zapełnienie terminali).
 * Kolory interfejsu HTML są w styles/tokens.css — trzymaj je w zgodzie.
 */
export const THEME = {
  background: '#e8edf2',
  ocean: '#e8edf2',
  land: '#fbfbfc',
  coast: 'rgba(100, 116, 139, 0.30)',
  borders: 'rgba(100, 116, 139, 0.20)',
  graticule: 'rgba(100, 116, 139, 0.06)',

  ink: '#16202f',
  accent: '#2f6fed',
  accentSoft: 'rgba(47, 111, 237, 0.14)',

  cityLocked: 'rgba(100, 116, 139, 0.28)',
  cityAvailableFill: '#ffffff',
  cityAvailable: 'rgba(71, 85, 105, 0.55)',
  cityAvailableHover: '#16202f',
  airport: '#16202f',
  hub: '#2f6fed',
  halo: '#ffffff',
  selection: 'rgba(47, 111, 237, 0.55)',
  ringTrack: 'rgba(22, 32, 47, 0.08)',

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

/**
 * Obszary ekranu zasłonięte przez pływające panele (px). Muszą odpowiadać układowi w app.css
 * (--gap, --topbar-h, --side-w). Kamera centruje się na widocznej części mapy.
 */
export const PLAY_INSETS = { top: 16 + 64 + 12, right: 16 + 380 + 12, bottom: 16, left: 16 };
export const NO_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
