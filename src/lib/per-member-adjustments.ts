import { useCallback, useEffect, useState } from "react";

export type FieldOv = { dx: number; dy: number; scale: number };
export type PhotoFrameOv = { dx: number; dy: number; dSize: number };
export type PhotoImageOv = { objX: number; objY: number; zoom: number };

export type FrontFieldKey = "name" | "position" | "dob" | "member_no" | "mobile";
export type BackFieldKey =
  | "blood_group"
  | "license_no"
  | "renewal_date"
  | "auto_stand"
  | "emergency_mobile"
  | "father_name"
  | "address";

export type MemberOverrides = {
  front: {
    photoFrame?: PhotoFrameOv;
    photoImage?: PhotoImageOv;
    fields: Partial<Record<FrontFieldKey, FieldOv>>;
  };
  back: {
    fields: Partial<Record<BackFieldKey, FieldOv>>;
  };
};

export const EMPTY_OVERRIDES: MemberOverrides = {
  front: { fields: {} },
  back: { fields: {} },
};

export const ZERO_FIELD: FieldOv = { dx: 0, dy: 0, scale: 1 };
export const ZERO_FRAME: PhotoFrameOv = { dx: 0, dy: 0, dSize: 0 };

const STORAGE_KEY = "cm-autos-member-overrides-v1";

type Store = Record<string, MemberOverrides>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(s: Store) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadMemberOverrides(memberId: string): MemberOverrides {
  const s = readStore();
  return s[memberId] ?? EMPTY_OVERRIDES;
}

export function useMemberOverrides(memberId: string | undefined) {
  const [overrides, setOverrides] = useState<MemberOverrides>(EMPTY_OVERRIDES);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    setOverrides(loadMemberOverrides(memberId));
    setLoaded(true);
  }, [memberId]);

  useEffect(() => {
    if (!loaded || !memberId) return;
    const s = readStore();
    s[memberId] = overrides;
    writeStore(s);
  }, [overrides, loaded, memberId]);

  const reset = useCallback(() => setOverrides(EMPTY_OVERRIDES), []);

  const updateField = useCallback(
    (side: "front" | "back", key: string, patch: Partial<FieldOv>) => {
      setOverrides((prev) => {
        const cur = (prev[side].fields as Record<string, FieldOv>)[key] ?? { ...ZERO_FIELD };
        return {
          ...prev,
          [side]: {
            ...prev[side],
            fields: { ...prev[side].fields, [key]: { ...cur, ...patch } },
          },
        } as MemberOverrides;
      });
    },
    [],
  );

  const updatePhotoFrame = useCallback((patch: Partial<PhotoFrameOv>) => {
    setOverrides((prev) => ({
      ...prev,
      front: {
        ...prev.front,
        photoFrame: { ...ZERO_FRAME, ...(prev.front.photoFrame ?? {}), ...patch },
      },
    }));
  }, []);

  const updatePhotoImage = useCallback((patch: Partial<PhotoImageOv>, fallback: PhotoImageOv) => {
    setOverrides((prev) => ({
      ...prev,
      front: {
        ...prev.front,
        photoImage: { ...fallback, ...(prev.front.photoImage ?? {}), ...patch },
      },
    }));
  }, []);

  return { overrides, setOverrides, reset, updateField, updatePhotoFrame, updatePhotoImage };
}

/* -------- Selection type used by the editor -------- */

export type Selection =
  | { side: "front"; kind: "field"; key: FrontFieldKey }
  | { side: "front"; kind: "photoFrame" }
  | { side: "front"; kind: "photoImage" }
  | { side: "back"; kind: "field"; key: BackFieldKey }
  | null;

export function selectionEquals(a: Selection, b: Selection) {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.side !== b.side || a.kind !== b.kind) return false;
  if (a.kind === "field" && b.kind === "field") return a.key === b.key;
  return true;
}
