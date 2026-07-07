import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

/** Async: fetch a single member's overrides from Supabase. */
export async function loadMemberOverrides(memberId: string): Promise<MemberOverrides> {
  const { data, error } = await supabase
    .from("member_overrides")
    .select("overrides")
    .eq("member_id", memberId)
    .maybeSingle();
  if (error || !data) return EMPTY_OVERRIDES;
  return (data.overrides as MemberOverrides) ?? EMPTY_OVERRIDES;
}

/** Bulk fetch overrides for many members at once. Returns a map keyed by member_id. */
export async function loadAllMemberOverrides(): Promise<Record<string, MemberOverrides>> {
  const { data, error } = await supabase.from("member_overrides").select("member_id, overrides");
  if (error || !data) return {};
  const out: Record<string, MemberOverrides> = {};
  for (const row of data) {
    out[row.member_id as string] = (row.overrides as MemberOverrides) ?? EMPTY_OVERRIDES;
  }
  return out;
}

async function saveMemberOverrides(memberId: string, overrides: MemberOverrides) {
  const { error } = await supabase
    .from("member_overrides")
    .upsert({ member_id: memberId, overrides }, { onConflict: "member_id" });
  if (error) console.error("Failed to save member overrides", error);
}

export function useMemberOverrides(memberId: string | undefined) {
  const [overrides, setOverrides] = useState<MemberOverrides>(EMPTY_OVERRIDES);
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(false);
    if (!memberId) return;
    loadMemberOverrides(memberId).then((ov) => {
      if (!alive) return;
      setOverrides(ov);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [memberId]);

  useEffect(() => {
    if (!loaded || !memberId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveMemberOverrides(memberId, overrides);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
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

  return { overrides, setOverrides, reset, updateField, updatePhotoFrame, updatePhotoImage, loaded };
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
