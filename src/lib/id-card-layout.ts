// ID card canvas dimensions. The templates are 1023×1537, so the 700px
// canvas keeps the original aspect ratio instead of vertically squeezing it.
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

// Positions measured directly from the uploaded 1023×1537 reference card,
// then scaled uniformly to the 700px render canvas (scale ≈ 0.6843).
export const DEFAULT_FRONT_LAYOUT: FrontLayout = {
  // Inner photo hole only; the printed orange ring remains visible above it.
  photo: { x: 233, y: 382, size: 232 },
  fields: {
    name:      { ...baseField, x: 296, y: 651 },
    position:  { ...baseField, x: 296, y: 699 },
    dob:       { ...baseField, x: 296, y: 753 },
    member_no: { ...baseField, x: 296, y: 803 },
    mobile:    { ...baseField, x: 296, y: 843 },
  },
};

export const DEFAULT_BACK_LAYOUT: BackLayout = {
  fields: {
    blood_group:      { ...baseField, x: 372, y: 264 },
    license_no:       { ...baseField, x: 372, y: 304 },
    renewal_date:     { ...baseField, x: 372, y: 352 },
    auto_stand:       { ...baseField, x: 372, y: 393 },
    emergency_mobile: { ...baseField, x: 372, y: 438 },
    father_name:      { ...baseField, x: 372, y: 482 },
    address:          { ...baseField, x: 372, y: 526, width: 285, fontSize: 18 },
  },
};
