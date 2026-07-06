import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Settings2, RotateCcw } from "lucide-react";
import type { CardAdjustments } from "@/lib/card-adjustments";

type Props = {
  adjustments: CardAdjustments;
  setAdjustments: React.Dispatch<React.SetStateAction<CardAdjustments>>;
  reset: () => void;
};

function Row({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <Label className="text-muted-foreground">{label}</Label>
        <span className="font-mono text-xs tabular-nums">
          {value.toFixed(step < 1 ? 2 : 0)}
          {suffix ?? ""}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

export function CardAdjustmentsPanel({ adjustments, setAdjustments, reset }: Props) {
  const upd = <K extends keyof CardAdjustments>(k: K, v: CardAdjustments[K]) =>
    setAdjustments((p) => ({ ...p, [k]: v }));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-1" /> Adjust
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[360px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Card adjustments</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6 pb-8">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Photo</h3>
            <Row label="Horizontal position" value={adjustments.photoObjX} min={0} max={100} step={1} suffix="%" onChange={(v) => upd("photoObjX", v)} />
            <Row label="Vertical position" value={adjustments.photoObjY} min={0} max={100} step={1} suffix="%" onChange={(v) => upd("photoObjY", v)} />
            <Row label="Zoom" value={adjustments.photoZoom} min={0.8} max={2} step={0.05} onChange={(v) => upd("photoZoom", v)} />
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Front text</h3>
            <Row label="Shift X" value={adjustments.frontTextDx} min={-40} max={40} step={1} suffix="px" onChange={(v) => upd("frontTextDx", v)} />
            <Row label="Shift Y" value={adjustments.frontTextDy} min={-40} max={40} step={1} suffix="px" onChange={(v) => upd("frontTextDy", v)} />
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Back text</h3>
            <Row label="Shift X" value={adjustments.backTextDx} min={-40} max={40} step={1} suffix="px" onChange={(v) => upd("backTextDx", v)} />
            <Row label="Shift Y" value={adjustments.backTextDy} min={-40} max={40} step={1} suffix="px" onChange={(v) => upd("backTextDy", v)} />
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Typography</h3>
            <Row label="Font scale" value={adjustments.fontScale} min={0.7} max={1.3} step={0.02} onChange={(v) => upd("fontScale", v)} />
          </section>

          <Button variant="outline" size="sm" className="w-full" onClick={reset}>
            <RotateCcw className="h-4 w-4 mr-1" /> Reset to defaults
          </Button>

          <p className="text-xs text-muted-foreground">
            Adjustments apply to all members and are saved on this device.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
