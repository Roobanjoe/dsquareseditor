import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight,
  Type,
  Move,
  Image as ImageIcon,
  Frame,
  RotateCcw,
  ZoomIn,
} from "lucide-react";
import type {
  MemberOverrides,
  Selection,
  FieldOv,
} from "@/lib/per-member-adjustments";
import { ZERO_FIELD, ZERO_FRAME } from "@/lib/per-member-adjustments";
import type { CardAdjustments } from "@/lib/card-adjustments";

type Props = {
  selection: Selection;
  overrides: MemberOverrides;
  adjustments: CardAdjustments;
  updateField: (side: "front" | "back", key: string, patch: Partial<FieldOv>) => void;
  updatePhotoFrame: (patch: Partial<{ dx: number; dy: number; dSize: number }>) => void;
  updatePhotoImage: (
    patch: Partial<{ objX: number; objY: number; zoom: number }>,
    fallback: { objX: number; objY: number; zoom: number },
  ) => void;
  onReset: () => void;
};

function NudgePad({
  onNudge,
  step = 1,
}: {
  onNudge: (dx: number, dy: number) => void;
  step?: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 w-fit">
      <div />
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNudge(0, -step)}>
        <ArrowUp className="h-4 w-4" />
      </Button>
      <div />
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNudge(-step, 0)}>
        <ArrowLeftIcon className="h-4 w-4" />
      </Button>
      <div className="h-8 w-8 rounded border border-dashed flex items-center justify-center text-[10px] text-muted-foreground">
        {step}px
      </div>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNudge(step, 0)}>
        <ArrowRight className="h-4 w-4" />
      </Button>
      <div />
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onNudge(0, step)}>
        <ArrowDown className="h-4 w-4" />
      </Button>
      <div />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  suffix,
  digits,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  suffix?: string;
  digits?: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs tabular-nums">
          {value.toFixed(digits ?? (step < 1 ? 2 : 0))}
          {suffix ?? ""}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}

const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  position: "Position",
  dob: "Date of birth",
  member_no: "Member No.",
  mobile: "Mobile",
  blood_group: "Blood group",
  license_no: "License No.",
  renewal_date: "Renewal date",
  auto_stand: "Auto stand",
  emergency_mobile: "Emergency mobile",
  father_name: "Father's name",
  address: "Address",
};

export function CardEditor({
  selection,
  overrides,
  adjustments,
  updateField,
  updatePhotoFrame,
  updatePhotoImage,
  onReset,
}: Props) {
  // Arrow-key nudging for the currently selected element
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const step = e.shiftKey ? 5 : 1;
      let dx = 0;
      let dy = 0;
      if (e.key === "ArrowUp") dy = -step;
      else if (e.key === "ArrowDown") dy = step;
      else if (e.key === "ArrowLeft") dx = -step;
      else if (e.key === "ArrowRight") dx = step;
      else return;
      e.preventDefault();
      if (selection.kind === "field") {
        const cur =
          (overrides[selection.side].fields as Record<string, FieldOv>)[selection.key] ?? ZERO_FIELD;
        updateField(selection.side, selection.key, { dx: cur.dx + dx, dy: cur.dy + dy });
      } else if (selection.kind === "photoFrame") {
        const cur = overrides.front.photoFrame ?? ZERO_FRAME;
        updatePhotoFrame({ dx: cur.dx + dx, dy: cur.dy + dy });
      } else if (selection.kind === "photoImage") {
        const fallback = {
          objX: adjustments.photoObjX,
          objY: adjustments.photoObjY,
          zoom: adjustments.photoZoom,
        };
        const cur = overrides.front.photoImage ?? fallback;
        // For the photo image, arrows shift the object-position by 2% per step
        updatePhotoImage(
          {
            objX: Math.max(0, Math.min(100, cur.objX + dx * 2)),
            objY: Math.max(0, Math.min(100, cur.objY + dy * 2)),
          },
          fallback,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection, overrides, adjustments, updateField, updatePhotoFrame, updatePhotoImage]);

  if (!selection) {
    return (
      <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2 mb-1 text-foreground font-medium">
          <Move className="h-4 w-4" /> Editor
        </div>
        Click any field, the photo frame, or the photo itself to edit it. Use arrow keys
        (Shift + arrow = 5px) to nudge the selection.
      </div>
    );
  }

  /* ------- Field selected ------- */
  if (selection.kind === "field") {
    const cur =
      (overrides[selection.side].fields as Record<string, FieldOv>)[selection.key] ?? ZERO_FIELD;
    const baseDx =
      selection.side === "front" ? adjustments.frontTextDx : adjustments.backTextDx;
    const baseDy =
      selection.side === "front" ? adjustments.frontTextDy : adjustments.backTextDy;
    const effectiveScale = cur.scale === 1 && adjustments.fontScale !== 1 ? adjustments.fontScale : cur.scale;
    const set = (p: Partial<FieldOv>) => updateField(selection.side, selection.key, p);
    return (
      <div className="rounded-md border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <Type className="h-4 w-4" />
            <span>{FIELD_LABELS[selection.key] ?? selection.key}</span>
            <span className="text-xs text-muted-foreground uppercase">({selection.side})</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => set({ dx: 0, dy: 0, scale: 1 })}
            title="Reset this field"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-start gap-4">
          <NudgePad
            onNudge={(dx, dy) => set({ dx: cur.dx + dx, dy: cur.dy + dy })}
          />
          <div className="text-xs space-y-1 text-muted-foreground">
            <div>Offset X: <span className="font-mono text-foreground">{cur.dx}px</span></div>
            <div>Offset Y: <span className="font-mono text-foreground">{cur.dy}px</span></div>
            {(baseDx || baseDy) ? (
              <div className="pt-1">Global base: {baseDx},{baseDy}</div>
            ) : null}
          </div>
        </div>

        <Separator />

        <SliderRow
          label="Text scale"
          value={effectiveScale}
          min={0.5}
          max={1.6}
          step={0.02}
          digits={2}
          onChange={(v) => set({ scale: v })}
        />
      </div>
    );
  }

  /* ------- Photo frame selected ------- */
  if (selection.kind === "photoFrame") {
    const cur = overrides.front.photoFrame ?? ZERO_FRAME;
    return (
      <div className="rounded-md border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <Frame className="h-4 w-4" /> Photo frame
          </div>
          <Button variant="ghost" size="sm" onClick={() => updatePhotoFrame({ dx: 0, dy: 0, dSize: 0 })}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-start gap-4">
          <NudgePad onNudge={(dx, dy) => updatePhotoFrame({ dx: cur.dx + dx, dy: cur.dy + dy })} />
          <div className="text-xs space-y-1 text-muted-foreground">
            <div>Offset X: <span className="font-mono text-foreground">{cur.dx}px</span></div>
            <div>Offset Y: <span className="font-mono text-foreground">{cur.dy}px</span></div>
            <div>Size Δ: <span className="font-mono text-foreground">{cur.dSize}px</span></div>
          </div>
        </div>

        <Separator />

        <SliderRow
          label="Frame size (Δ)"
          value={cur.dSize}
          min={-80}
          max={80}
          step={1}
          suffix="px"
          onChange={(v) => updatePhotoFrame({ dSize: v })}
        />
        <p className="text-xs text-muted-foreground">
          Adjusts the circular photo cutout. Click the photo inside to reposition the face.
        </p>
      </div>
    );
  }

  /* ------- Photo image (inside frame) ------- */
  if (selection.kind === "photoImage") {
    const fallback = {
      objX: adjustments.photoObjX,
      objY: adjustments.photoObjY,
      zoom: adjustments.photoZoom,
    };
    const cur = overrides.front.photoImage ?? fallback;
    const set = (p: Partial<typeof fallback>) => updatePhotoImage(p, fallback);
    return (
      <div className="rounded-md border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-medium">
            <ImageIcon className="h-4 w-4" /> Photo (inside frame)
          </div>
          <Button variant="ghost" size="sm" onClick={() => set(fallback)}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-start gap-4">
          <NudgePad
            onNudge={(dx, dy) =>
              set({
                objX: Math.max(0, Math.min(100, cur.objX + dx * 2)),
                objY: Math.max(0, Math.min(100, cur.objY + dy * 2)),
              })
            }
          />
          <div className="text-xs space-y-1 text-muted-foreground">
            <div>Position X: <span className="font-mono text-foreground">{cur.objX.toFixed(0)}%</span></div>
            <div>Position Y: <span className="font-mono text-foreground">{cur.objY.toFixed(0)}%</span></div>
            <div>Zoom: <span className="font-mono text-foreground">{cur.zoom.toFixed(2)}×</span></div>
          </div>
        </div>

        <Separator />

        <SliderRow
          label="Horizontal position"
          value={cur.objX}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => set({ objX: v })}
        />
        <SliderRow
          label="Vertical position"
          value={cur.objY}
          min={0}
          max={100}
          step={1}
          suffix="%"
          onChange={(v) => set({ objY: v })}
        />
        <SliderRow
          label={<><ZoomIn className="inline h-3 w-3 mr-1" />Zoom</> as unknown as string}
          value={cur.zoom}
          min={0.8}
          max={2.5}
          step={0.05}
          digits={2}
          onChange={(v) => set({ zoom: v })}
        />

        <div className="pt-1 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReset} title="Reset all overrides for this member">
            <RotateCcw className="h-4 w-4 mr-1" /> Reset all
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
