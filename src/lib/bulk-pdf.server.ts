import {
  PDFDocument,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  moveTo,
  appendBezierCurve,
  clip,
  endPath,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import {
  CARD_WIDTH,
  CARD_HEIGHT,
  DEFAULT_FRONT_LAYOUT,
  DEFAULT_BACK_LAYOUT,
  type FieldConfig,
} from "@/lib/id-card-layout";
import {
  EMPTY_OVERRIDES,
  type BackFieldKey,
  type FrontFieldKey,
  type MemberOverrides,
} from "@/lib/per-member-adjustments";
import { DEFAULT_ADJUSTMENTS } from "@/lib/card-adjustments";
import notoTamilUrl from "@/assets/fonts/NotoSansTamil-SemiBold.ttf?url";
import frontTemplate from "@/assets/id-front-template.asset.json";
import backTemplate from "@/assets/id-back-template.asset.json";

type MemberRow = {
  id: string;
  name: string;
  position: string;
  dob: string;
  member_no: string;
  mobile: string;
  photo_url: string;
  blood_group: string;
  license_no: string;
  renewal_date: string;
  auto_stand: string;
  emergency_mobile: string;
  father_name: string;
  address: string;
};

const CIRCLE_K = 0.5522847498;

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

async function absoluteUrl(url: string, baseUrl: string): Promise<string> {
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return new URL(url, baseUrl).href;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    const [meta, b64] = url.split(",");
    if (meta.includes("base64")) {
      const bin = atob(b64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return arr;
    }
    return new TextEncoder().encode(decodeURIComponent(b64));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} → ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function embedImage(pdf: PDFDocument, bytes: Uint8Array): Promise<PDFImage | null> {
  // Sniff header
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return pdf.embedPng(bytes);
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return pdf.embedJpg(bytes);
  // Try both
  try {
    return await pdf.embedJpg(bytes);
  } catch {
    try {
      return await pdf.embedPng(bytes);
    } catch {
      return null;
    }
  }
}

function clipCircle(page: PDFPage, cx: number, cy: number, r: number) {
  page.pushOperators(
    pushGraphicsState(),
    moveTo(cx - r, cy),
    appendBezierCurve(cx - r, cy + r * CIRCLE_K, cx - r * CIRCLE_K, cy + r, cx, cy + r),
    appendBezierCurve(cx + r * CIRCLE_K, cy + r, cx + r, cy + r * CIRCLE_K, cx + r, cy),
    appendBezierCurve(cx + r, cy - r * CIRCLE_K, cx + r * CIRCLE_K, cy - r, cx, cy - r),
    appendBezierCurve(cx - r * CIRCLE_K, cy - r, cx - r, cy - r * CIRCLE_K, cx - r, cy),
    clip(),
    endPath(),
  );
}

function drawTextField(
  page: PDFPage,
  text: string,
  f: FieldConfig,
  dx: number,
  dy: number,
  scale: number,
  font: PDFFont,
  wrap = false,
  maxLines = 3,
  minFontSize = 12,
) {
  if (!text) return;
  const color = hexToRgb(f.color);
  let size = f.fontSize * scale;
  const x = f.x + dx;
  const yTop = f.y + dy;

  const lines = wrap ? wrapText(text, font, f.width, size, maxLines, minFontSize) : [text];
  if (wrap) {
    // Recompute size after possible shrink
    let s = size;
    while (s > minFontSize) {
      const test = wrapText(text, font, f.width, s, maxLines, minFontSize);
      if (test.length <= maxLines && test.every((ln) => font.widthOfTextAtSize(ln, s) <= f.width)) {
        size = s;
        break;
      }
      s -= 1;
    }
  }
  const lineHeight = size * 1.25;
  lines.forEach((line, i) => {
    const w = font.widthOfTextAtSize(line, size);
    let drawX = x;
    if (f.align === "center") drawX = x + (f.width - w) / 2;
    else if (f.align === "right") drawX = x + f.width - w;
    // browser baseline sits ~0.8*fontSize down from top of line box
    const baselineTop = yTop + i * lineHeight + size * 0.8;
    const pdfY = CARD_HEIGHT - baselineTop;
    try {
      page.drawText(line, { x: drawX, y: pdfY, size, font, color });
    } catch {
      /* unsupported glyph */
    }
  });
}

function wrapText(
  text: string,
  font: PDFFont,
  maxWidth: number,
  size: number,
  maxLines: number,
  _minSize: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (font.widthOfTextAtSize(trial, size) <= maxWidth) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-GB");
  } catch {
    return iso;
  }
}

async function drawFront(
  pdf: PDFDocument,
  page: PDFPage,
  member: MemberRow,
  overrides: MemberOverrides["front"],
  templateImg: PDFImage,
  font: PDFFont,
) {
  page.drawImage(templateImg, { x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT });

  // Photo
  if (member.photo_url) {
    try {
      const photoBytes = await fetchBytes(member.photo_url);
      const img = await embedImage(pdf, photoBytes);
      if (img) {
        const frame = overrides.photoFrame ?? { dx: 0, dy: 0, dSize: 0 };
        const photoImg = overrides.photoImage ?? {
          objX: DEFAULT_ADJUSTMENTS.photoObjX,
          objY: DEFAULT_ADJUSTMENTS.photoObjY,
          zoom: DEFAULT_ADJUSTMENTS.photoZoom,
        };
        const px = DEFAULT_FRONT_LAYOUT.photo.x + frame.dx;
        const py = DEFAULT_FRONT_LAYOUT.photo.y + frame.dy;
        const size = DEFAULT_FRONT_LAYOUT.photo.size + frame.dSize;

        const iw = img.width;
        const ih = img.height;
        const s0 = Math.max(size / iw, size / ih);
        const dw = iw * s0;
        const dh = ih * s0;
        const ox = (size - dw) * (photoImg.objX / 100);
        const oy = (size - dh) * (photoImg.objY / 100);
        const pointX = (photoImg.objX / 100) * size;
        const pointY = (photoImg.objY / 100) * size;
        const zoom = photoImg.zoom;
        const finalOx = pointX + (ox - pointX) * zoom;
        const finalOy = pointY + (oy - pointY) * zoom;
        const drawW = dw * zoom;
        const drawH = dh * zoom;

        // Circle center in PDF coords
        const cxTL = px + size / 2;
        const cyTL = py + size / 2;
        const cx = cxTL;
        const cy = CARD_HEIGHT - cyTL;
        const r = size / 2;

        // Image top-left in top-left coord system:
        const imgX = px + finalOx;
        const imgYTop = py + finalOy;
        // PDF y (bottom of image) = CARD_HEIGHT - (imgYTop + drawH)
        const pdfImgY = CARD_HEIGHT - (imgYTop + drawH);

        clipCircle(page, cx, cy, r);
        page.drawImage(img, { x: imgX, y: pdfImgY, width: drawW, height: drawH });
        page.pushOperators(popGraphicsState());
      }
    } catch (e) {
      console.error("photo draw failed", e);
    }
  }

  const values: Record<FrontFieldKey, string> = {
    name: member.name ?? "",
    position: member.position ?? "",
    dob: fmtDate(member.dob),
    member_no: member.member_no ?? "",
    mobile: member.mobile ?? "",
  };
  (Object.keys(values) as FrontFieldKey[]).forEach((key) => {
    const f = DEFAULT_FRONT_LAYOUT.fields[key];
    const ov = overrides.fields[key];
    const dx = ov?.dx ?? 0;
    const dy = ov?.dy ?? 0;
    const scl = ov?.scale ?? 1;
    drawTextField(page, values[key], f, dx, dy, scl, font);
  });
}

function drawBack(
  page: PDFPage,
  member: MemberRow,
  overrides: MemberOverrides["back"],
  templateImg: PDFImage,
  font: PDFFont,
) {
  page.drawImage(templateImg, { x: 0, y: 0, width: CARD_WIDTH, height: CARD_HEIGHT });
  const values: Record<BackFieldKey, string> = {
    blood_group: member.blood_group ?? "",
    license_no: member.license_no ?? "",
    renewal_date: fmtDate(member.renewal_date),
    auto_stand: member.auto_stand ?? "",
    emergency_mobile: member.emergency_mobile ?? "",
    father_name: member.father_name ?? "",
    address: member.address ?? "",
  };
  (Object.keys(values) as BackFieldKey[]).forEach((key) => {
    const f = DEFAULT_BACK_LAYOUT.fields[key];
    const ov = overrides.fields[key];
    const dx = ov?.dx ?? 0;
    const dy = ov?.dy ?? 0;
    const scl = ov?.scale ?? 1;
    const isAddress = key === "address";
    drawTextField(page, values[key], f, dx, dy, scl, font, isAddress, 3, isAddress ? 11 : 12);
  });
}

export async function buildBulkPdf(opts: {
  members: MemberRow[];
  overridesMap: Record<string, MemberOverrides>;
  baseUrl: string;
  onProgress?: (processed: number) => Promise<void> | void;
}): Promise<Uint8Array> {
  const { members, overridesMap, baseUrl, onProgress } = opts;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  // Load font + templates in parallel
  const [fontBytes, frontBytes, backBytes] = await Promise.all([
    fetchBytes(await absoluteUrl(notoTamilUrl, baseUrl)),
    fetchBytes(await absoluteUrl(frontTemplate.url, baseUrl)),
    fetchBytes(await absoluteUrl(backTemplate.url, baseUrl)),
  ]);

  const font = await pdf.embedFont(fontBytes, { subset: true });
  const frontTpl = await pdf.embedJpg(frontBytes);
  const backTpl = await pdf.embedJpg(backBytes);

  let processed = 0;
  for (const m of members) {
    const ov = overridesMap[m.id] ?? EMPTY_OVERRIDES;
    const frontPage = pdf.addPage([CARD_WIDTH, CARD_HEIGHT]);
    await drawFront(pdf, frontPage, m, ov.front, frontTpl, font);
    const backPage = pdf.addPage([CARD_WIDTH, CARD_HEIGHT]);
    drawBack(backPage, m, ov.back, backTpl, font);
    processed += 1;
    if (onProgress) await onProgress(processed);
  }

  return pdf.save();
}
