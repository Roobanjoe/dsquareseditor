import { useEffect, useState } from "react";

export type CardAdjustments = {
  frontTextDx: number;
  frontTextDy: number;
  backTextDx: number;
  backTextDy: number;
  fontScale: number;
  photoObjX: number; // object-position X % (0 = left, 100 = right)
  photoObjY: number; // object-position Y % (0 = top, 100 = bottom)
  photoZoom: number; // 1 = fit, >1 zooms in
};

export const DEFAULT_ADJUSTMENTS: CardAdjustments = {
  frontTextDx: 0,
  frontTextDy: 0,
  backTextDx: 0,
  backTextDy: 0,
  fontScale: 1,
  photoObjX: 50,
  photoObjY: 30,
  photoZoom: 1,
};

const STORAGE_KEY = "cm-autos-card-adjustments-v1";

export function loadAdjustments(): CardAdjustments {
  if (typeof window === "undefined") return DEFAULT_ADJUSTMENTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ADJUSTMENTS;
    return { ...DEFAULT_ADJUSTMENTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_ADJUSTMENTS;
  }
}

export function saveAdjustments(a: CardAdjustments) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    /* ignore */
  }
}

export function useCardAdjustments() {
  const [adjustments, setAdjustments] = useState<CardAdjustments>(DEFAULT_ADJUSTMENTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAdjustments(loadAdjustments());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveAdjustments(adjustments);
  }, [adjustments, loaded]);

  const reset = () => setAdjustments(DEFAULT_ADJUSTMENTS);
  return { adjustments, setAdjustments, reset };
}
