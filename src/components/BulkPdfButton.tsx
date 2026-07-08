import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IDCardFront } from "@/components/IDCardFront";
import { IDCardBack } from "@/components/IDCardBack";
import { CARD_HEIGHT, CARD_WIDTH, DEFAULT_BACK_LAYOUT, DEFAULT_FRONT_LAYOUT } from "@/lib/id-card-layout";
import { loadAdjustments } from "@/lib/card-adjustments";
import { EMPTY_OVERRIDES, loadAllMemberOverrides, type MemberOverrides } from "@/lib/per-member-adjustments";

async function waitForImages(root: HTMLElement) {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          }),
    ),
  );
  await new Promise((r) => setTimeout(r, 250));
}

export function BulkPdfButton() {
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [overridesMap, setOverridesMap] = useState<Record<string, MemberOverrides>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, { front: HTMLDivElement | null; back: HTMLDivElement | null }>>({});
  const resolveRef = useRef<(() => void) | null>(null);

  const { data: members } = useQuery({
    queryKey: ["members-all-for-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (rendering && resolveRef.current) {
      const r = resolveRef.current;
      resolveRef.current = null;
      requestAnimationFrame(() => r());
    }
  }, [rendering]);

  const handleDownload = async () => {
    if (!members?.length) {
      toast.error("No members to export");
      return;
    }
    refs.current = {};
    setProgress({ done: 0, total: members.length });

    // Load all per-member overrides from Supabase up front.
    try {
      const map = await loadAllMemberOverrides();
      setOverridesMap(map);
    } catch (e) {
      toast.error("Failed to load overrides: " + (e as Error).message);
      setProgress(null);
      return;
    }

    await new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      setRendering(true);
    });

    if (!containerRef.current) {
      setRendering(false);
      return;
    }
    await waitForImages(containerRef.current);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [CARD_WIDTH, CARD_HEIGHT],
        hotfixes: ["px_scaling"],
      });

      let first = true;
      let done = 0;
      const captureOpts = {
        pixelRatio: 2,
        cacheBust: true,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        style: {
          transform: "none",
          width: `${CARD_WIDTH}px`,
          height: `${CARD_HEIGHT}px`,
        },
      } as const;
      for (const m of members) {
        const nodes = refs.current[m.id];
        if (!nodes?.front || !nodes?.back) continue;

        const frontPng = await toPng(nodes.front, captureOpts);
        const backPng = await toPng(nodes.back, captureOpts);

        if (!first) pdf.addPage([CARD_WIDTH, CARD_HEIGHT], "portrait");
        pdf.addImage(frontPng, "PNG", 0, 0, CARD_WIDTH, CARD_HEIGHT);
        pdf.addPage([CARD_WIDTH, CARD_HEIGHT], "portrait");
        pdf.addImage(backPng, "PNG", 0, 0, CARD_WIDTH, CARD_HEIGHT);
        first = false;
        done += 1;
        setProgress({ done, total: members.length });
      }

      pdf.save(`cm-autos-id-cards-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success(`Exported ${done} member${done === 1 ? "" : "s"}`);
    } catch (e) {
      toast.error("Bulk export failed: " + (e as Error).message);
    } finally {
      setRendering(false);
      setProgress(null);
    }
  };

  const adjustments = typeof window !== "undefined" ? loadAdjustments() : undefined;

  return (
    <>
      <Button onClick={handleDownload} disabled={rendering} size="sm">
        {rendering ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            {progress ? `Rendering ${progress.done}/${progress.total}` : "Rendering…"}
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4 mr-1" /> Download all as PDF
          </>
        )}
      </Button>

      {rendering && members && (
        <div
          ref={containerRef}
          aria-hidden
          style={{
            position: "fixed",
            left: -99999,
            top: 0,
            width: CARD_WIDTH,
            pointerEvents: "none",
          }}
        >
          {members.map((m) => {
            const memberOv = overridesMap[m.id] ?? EMPTY_OVERRIDES;
            return (
              <div key={m.id} style={{ marginBottom: 20 }}>
                <IDCardFront
                  member={m}
                  layout={DEFAULT_FRONT_LAYOUT}
                  adjustments={adjustments}
                  overrides={memberOv.front}
                  innerRef={(el) => {
                    refs.current[m.id] = { ...(refs.current[m.id] ?? { front: null, back: null }), back: el };
                  }}
                />
                <IDCardBack
                  member={m}
                  layout={DEFAULT_BACK_LAYOUT}
                  adjustments={adjustments}
                  overrides={memberOv.back}
                  innerRef={(el) => {
                    refs.current[m.id] = { ...(refs.current[m.id] ?? { front: null, back: null }), back: el };
                  }}
                />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
