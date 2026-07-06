// The uploaded print templates are 1023×1537. We render on a 700×1052 canvas
// keeping the exact aspect ratio (scale factor ≈ 0.6843). Every coordinate
// below was measured directly against the master template artwork and then
// scaled — do NOT auto-align, redraw, or estimate. The template image is the
// immutable background; only the values below overlay it.
export const CARD_WIDTH = 700;
export const CARD_HEIGHT = 1052;

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
  size: number; // diameter of the circular mask
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

// Base style for value text on both sides.
const baseField: Omit<FieldConfig, "x" | "y"> = {
  width: 320,
  fontSize: 22,
  color: "#111111",
  fontWeight: 600,
  align: "left",
};

// ---- FRONT ----
// Photo circle in master template (1023×1537): center (509.5, 727.5), r=168.
// Scaled to canvas: center (348.6, 497.9), diameter ≈ 230.
// Value text starts just right of the printed " : " (colon x ≈ 407 → 279).
// Label row centers (master y) → scaled y: 1046→716, 1120→766, 1193→816,
// 1268→867, 1341→918. `top` = center - fontSize/2 - 2.
export const DEFAULT_FRONT_LAYOUT: FrontLayout = {
  photo: { x: 234, y: 383, size: 230 },
  fields: {
    name:      { ...baseField, x: 300, y: 703 },
    position:  { ...baseField, x: 300, y: 753 },
    dob:       { ...baseField, x: 300, y: 803 },
    member_no: { ...baseField, x: 300, y: 854 },
    mobile:    { ...baseField, x: 300, y: 905 },
  },
};

// ---- BACK ----
// Value text starts right of the printed " : " (colon x ≈ 520 → 356).
// Label row centers (master y) → scaled y: 411→281, 471→322, 534→365,
// 596→408, 655→448, 716→490, 777→532.
export const DEFAULT_BACK_LAYOUT: BackLayout = {
  fields: {
    blood_group:      { ...baseField, x: 370, y: 269 },
    license_no:       { ...baseField, x: 370, y: 310 },
    renewal_date:     { ...baseField, x: 370, y: 353 },
    auto_stand:       { ...baseField, x: 370, y: 396 },
    emergency_mobile: { ...baseField, x: 370, y: 436 },
    father_name:      { ...baseField, x: 370, y: 478 },
    address:          { ...baseField, x: 370, y: 520, width: 300, fontSize: 17 },
  },
};
