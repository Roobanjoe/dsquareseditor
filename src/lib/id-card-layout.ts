// ID card canvas dimensions (matches template aspect ratio ~2:3)
export const CARD_WIDTH = 700;
export const CARD_HEIGHT = 1050;

export type FieldKey =
  // front
  | "photo"
  | "name"
  | "position"
  | "dob"
  | "member_no"
  | "mobile"
  // back
  | "blood_group"
  | "license_no"
  | "renewal_date"
  | "auto_stand"
  | "emergency_mobile"
  | "father_name"
  | "address";

export type FieldConfig = {
  x: number;
  y: number;
  width: number;
  fontSize: number;
  color: string;
  fontWeight: number;
  align: "left" | "center" | "right";
};

export type PhotoConfig = {
  x: number;
  y: number;
  size: number; // diameter
};

export type FrontLayout = {
  photo: PhotoConfig;
  fields: Record<
    "name" | "position" | "dob" | "member_no" | "mobile",
    FieldConfig
  >;
};

export type BackLayout = {
  fields: Record<
    | "blood_group"
    | "license_no"
    | "renewal_date"
    | "auto_stand"
    | "emergency_mobile"
    | "father_name"
    | "address",
    FieldConfig
  >;
};

const baseField: Omit<FieldConfig, "x" | "y"> = {
  width: 280,
  fontSize: 20,
  color: "#111111",
  fontWeight: 600,
  align: "left",
};

// Defaults tuned to the uploaded templates (700x1050 render).
export const DEFAULT_FRONT_LAYOUT: FrontLayout = {
  photo: { x: 210, y: 380, size: 280 },
  fields: {
    name:      { ...baseField, x: 270, y: 712 },
    position:  { ...baseField, x: 270, y: 758 },
    dob:       { ...baseField, x: 270, y: 804 },
    member_no: { ...baseField, x: 270, y: 850 },
    mobile:    { ...baseField, x: 270, y: 896 },
  },
};

export const DEFAULT_BACK_LAYOUT: BackLayout = {
  fields: {
    blood_group:      { ...baseField, x: 330, y: 252, width: 320 },
    license_no:       { ...baseField, x: 330, y: 302, width: 320 },
    renewal_date:     { ...baseField, x: 330, y: 352, width: 320 },
    auto_stand:       { ...baseField, x: 330, y: 402, width: 320 },
    emergency_mobile: { ...baseField, x: 330, y: 452, width: 320 },
    father_name:      { ...baseField, x: 330, y: 502, width: 320 },
    address:          { ...baseField, x: 330, y: 552, width: 320, fontSize: 16 },
  },
};

const FRONT_KEY = "id-card-front-layout-v1";
const BACK_KEY = "id-card-back-layout-v1";

export function loadFrontLayout(): FrontLayout {
  if (typeof window === "undefined") return DEFAULT_FRONT_LAYOUT;
  try {
    const raw = localStorage.getItem(FRONT_KEY);
    if (!raw) return DEFAULT_FRONT_LAYOUT;
    return { ...DEFAULT_FRONT_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FRONT_LAYOUT;
  }
}
export function loadBackLayout(): BackLayout {
  if (typeof window === "undefined") return DEFAULT_BACK_LAYOUT;
  try {
    const raw = localStorage.getItem(BACK_KEY);
    if (!raw) return DEFAULT_BACK_LAYOUT;
    return { ...DEFAULT_BACK_LAYOUT, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BACK_LAYOUT;
  }
}
export function saveFrontLayout(l: FrontLayout) {
  localStorage.setItem(FRONT_KEY, JSON.stringify(l));
}
export function saveBackLayout(l: BackLayout) {
  localStorage.setItem(BACK_KEY, JSON.stringify(l));
}
