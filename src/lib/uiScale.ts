const STORAGE_KEY = 'ui-scale';
export const DEFAULT_UI_SCALE = 80;
export const UI_SCALE_OPTIONS = [70, 80, 90, 100] as const;

export function getUiScale(): number {
  if (typeof window === 'undefined') return DEFAULT_UI_SCALE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 50 || parsed > 130) return DEFAULT_UI_SCALE;
  return parsed;
}

export function applyUiScale(scale: number = getUiScale()) {
  if (typeof document === 'undefined') return;
  // Tailwind sizing is rem-based, so scaling the root font-size scales
  // typography, spacing and component sizes together.
  document.documentElement.style.fontSize = `${scale}%`;
  document.documentElement.dataset.uiScale = String(scale);
}

export function setUiScale(scale: number) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, String(scale));
  }
  applyUiScale(scale);
}
