import { useState } from "react";
import type {
  FrontLayout,
  BackLayout,
  FieldConfig,
} from "@/lib/id-card-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Side = "front" | "back";

function FieldEditor({
  label,
  field,
  onChange,
}: {
  label: string;
  field: FieldConfig;
  onChange: (f: FieldConfig) => void;
}) {
  const upd = <K extends keyof FieldConfig>(k: K, v: FieldConfig[K]) =>
    onChange({ ...field, [k]: v });
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="text-sm font-semibold">{label}</div>
      <div className="grid grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">X</Label>
          <Input type="number" value={field.x} onChange={(e) => upd("x", +e.target.value)} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Y</Label>
          <Input type="number" value={field.y} onChange={(e) => upd("y", +e.target.value)} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">W</Label>
          <Input type="number" value={field.width} onChange={(e) => upd("width", +e.target.value)} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Size</Label>
          <Input type="number" value={field.fontSize} onChange={(e) => upd("fontSize", +e.target.value)} className="h-8" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-xs">Weight</Label>
          <Input type="number" step={100} value={field.fontWeight} onChange={(e) => upd("fontWeight", +e.target.value)} className="h-8" />
        </div>
        <div>
          <Label className="text-xs">Color</Label>
          <Input type="color" value={field.color} onChange={(e) => upd("color", e.target.value)} className="h-8 p-1" />
        </div>
        <div>
          <Label className="text-xs">Align</Label>
          <select
            value={field.align}
            onChange={(e) => upd("align", e.target.value as FieldConfig["align"])}
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </div>
      </div>
    </div>
  );
}

export function LayoutEditor({
  side,
  front,
  back,
  onFrontChange,
  onBackChange,
}: {
  side: Side;
  front: FrontLayout;
  back: BackLayout;
  onFrontChange: (l: FrontLayout) => void;
  onBackChange: (l: BackLayout) => void;
}) {
  const [open, setOpen] = useState(true);
  if (side === "front") {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-sm font-medium underline"
        >
          {open ? "Hide" : "Show"} alignment controls
        </button>
        {open && (
          <>
            <div className="rounded-md border bg-card p-3 space-y-2">
              <div className="text-sm font-semibold">Photo</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">X</Label>
                  <Input type="number" value={front.photo.x}
                    onChange={(e) => onFrontChange({ ...front, photo: { ...front.photo, x: +e.target.value } })}
                    className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Y</Label>
                  <Input type="number" value={front.photo.y}
                    onChange={(e) => onFrontChange({ ...front, photo: { ...front.photo, y: +e.target.value } })}
                    className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Size</Label>
                  <Input type="number" value={front.photo.size}
                    onChange={(e) => onFrontChange({ ...front, photo: { ...front.photo, size: +e.target.value } })}
                    className="h-8" />
                </div>
              </div>
            </div>
            {(Object.keys(front.fields) as (keyof FrontLayout["fields"])[]).map((k) => (
              <FieldEditor
                key={k}
                label={k}
                field={front.fields[k]}
                onChange={(f) => onFrontChange({ ...front, fields: { ...front.fields, [k]: f } })}
              />
            ))}
          </>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <button onClick={() => setOpen((o) => !o)} className="text-sm font-medium underline">
        {open ? "Hide" : "Show"} alignment controls
      </button>
      {open &&
        (Object.keys(back.fields) as (keyof BackLayout["fields"])[]).map((k) => (
          <FieldEditor
            key={k}
            label={k}
            field={back.fields[k]}
            onChange={(f) => onBackChange({ ...back, fields: { ...back.fields, [k]: f } })}
          />
        ))}
    </div>
  );
}
