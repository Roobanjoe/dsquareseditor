// ID card canvas dimensions (match template aspect ratio 1023x1537 → 700x1050)
export const CARD_WIDTH = 700;
export const CARD_HEIGHT = 1050;

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

// Base style for value text on both sides.
const baseField: Omit<FieldConfig, "x" | "y"> = {
  width: 380,
  fontSize: 24,
  color: "#111111",
  fontWeight: 600,
  align: "left",
};

// Positions measured directly from the uploaded 1023x1537 templates,
// then scaled to the 700x1050 render canvas (scale ≈ 0.6843).
// Values start ~30px right of the colon column and vertically align
// with the printed ":" mark on the template.
export const DEFAULT_FRONT_LAYOUT: FrontLayout = {
  // Circle: center (509, 742), diameter 368 in template → scaled.
  photo: { x: 222, y: 382, size: 252 },
  fields: {
    name:      { ...baseField, x: 305, y: 651 },
    position:  { ...baseField, x: 305, y: 700 },
    dob:       { ...baseField, x: 305, y: 751 },
    member_no: { ...baseField, x: 305, y: 800 },
    mobile:    { ...baseField, x: 305, y: 852 },
  },
};

export const DEFAULT_BACK_LAYOUT: BackLayout = {
  fields: {
    blood_group:      { ...baseField, x: 355, y: 264 },
    license_no:       { ...baseField, x: 355, y: 306 },
    renewal_date:     { ...baseField, x: 355, y: 350 },
    auto_stand:       { ...baseField, x: 355, y: 389 },
    emergency_mobile: { ...baseField, x: 355, y: 431 },
    father_name:      { ...baseField, x: 355, y: 475 },
    address:          { ...baseField, x: 355, y: 516, fontSize: 18 },
  },
};
