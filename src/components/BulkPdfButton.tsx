import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { AlertTriangle, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { IDCardFront } from "@/components/IDCardFront";
import { IDCardBack } from "@/components/IDCardBack";
import { CARD_HEIGHT, CARD_WIDTH, DEFAULT_BACK_LAYOUT, DEFAULT_FRONT_LAYOUT } from "@/lib/id-card-layout";
import { loadAdjustments } from "@/lib/card-adjustments";
import { EMPTY_OVERRIDES, loadAllMemberOverrides, type MemberOverrides } from "@/lib/per-member-adjustments";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Phase = "idle" | "loading" | "verifying" | "building" | "done";
type Failure = { id: string; name: string; side: "front" | "back" | "both"; reason: string };

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

const CAPTURE_OPTS = {
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

// A valid PNG data URL from a fully rendered card should always be well past this.
const MIN_PNG_BYTES = 5000;

async function safeCapture(node: HTMLDivElement): Promise<{ ok: true; png: string } | { ok: false; reason: string }> {
  try {
    const png = await toPng(node, CAPTURE_OPTS);
    if (!png || !png.startsWith("data:image/png")) {
      return { ok: false, reason: "Renderer returned no image" };
    }
    // Rough sanity check — an all-blank capture is only a few hundred bytes.
    const base64 = png.slice(png.indexOf(",") + 1);
    if (base64.length < MIN_PNG_BYTES) {
      return { ok: false, reason: "Render looks blank / too small" };
    }
    return { ok: true, png };
  } catch (e) {
    return { ok: false, reason: (e as Error).message || "Unknown render error" };
  }
}

export function BulkPdfButton() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [overridesMap, setOverridesMap] = useState<Record<string, MemberOverrides>>({});
  const [failures, setFailures] = useState<Failure[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [exportedCount, setExportedCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, { front: HTMLDivElement | null; back: HTMLDivElement | null }>>({});
  const resolveRef = useRef<(() => void) | null>(null);

  const busy = phase !== "idle" && phase !== "done";
  const mounted = phase !== "idle";

  const { data: members } = useQuery({
    queryKey: ["members-all-for-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (mounted && resolveRef.current) {
      const r = resolveRef.current;
      resolveRef.current = null;
      requestAnimationFrame(() => r());
    }
  }, [mounted]);

  const handleDownload = async () => {
    if (busy) return;
    if (!members?.length) {
      toast.error("No members to export");
      return;
    }
    refs.current = {};
    setFailures([]);
    setExportedCount(0);
    setProgress({ done: 0, total: members.length });
    setStatusLabel("Loading overrides…");
    setPhase("loading");

    try {
      const map = await loadAllMemberOverrides();
      setOverridesMap(map);
    } catch (e) {
      toast.error("Failed to load overrides: " + (e as Error).message);
      setPhase("idle");
      setProgress(null);
      return;
    }

    // Mount the off-screen render container and wait for images.
    await new Promise<void>((resolve) => {
      resolveRef.current = resolve;
      setStatusLabel("Preparing cards…");
    });

    if (!containerRef.current) {
      setPhase("idle");
      setProgress(null);
      return;
    }
    await waitForImages(containerRef.current);

    // ---------- Verification pass ----------
    setPhase("verifying");
    setStatusLabel("Verifying renders…");
    setProgress({ done: 0, total: members.length });

    const captures: { id: string; name: string; front: string; back: string }[] = [];
    const fails: Failure[] = [];
    let verified = 0;
    for (const m of members) {
      const nodes = refs.current[m.id];
      if (!nodes?.front || !nodes?.back) {
        fails.push({ id: m.id, name: m.name, side: "both", reason: "Card did not mount" });
      } else {
        const [f, b] = await Promise.all([safeCapture(nodes.front), safeCapture(nodes.back)]);
        if (!f.ok && !b.ok) {
          fails.push({ id: m.id, name: m.name, side: "both", reason: `${f.reason}; ${b.reason}` });
        } else if (!f.ok) {
          fails.push({ id: m.id, name: m.name, side: "front", reason: f.reason });
        } else if (!b.ok) {
          fails.push({ id: m.id, name: m.name, side: "back", reason: b.reason });
        } else {
          captures.push({ id: m.id, name: m.name, front: f.png, back: b.png });
        }
      }
      verified += 1;
      setProgress({ done: verified, total: members.length });
    }

    setFailures(fails);

    if (!captures.length) {
      toast.error("No members rendered successfully — nothing to export");
      setReportOpen(true);
      setPhase("done");
      setProgress(null);
      setStatusLabel("");
      return;
    }

    if (fails.length) {
      toast.warning(
        `${fails.length} member${fails.length === 1 ? "" : "s"} failed verification and will be skipped`,
      );
      setReportOpen(true);
    }

    // ---------- Build PDF ----------
    setPhase("building");
    setStatusLabel("Building PDF…");
    setProgress({ done: 0, total: captures.length });

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [CARD_WIDTH, CARD_HEIGHT],
        hotfixes: ["px_scaling"],
      });
      let first = true;
      let done = 0;
      for (const c of captures) {
        if (!first) pdf.addPage([CARD_WIDTH, CARD_HEIGHT], "portrait");
        pdf.addImage(c.front, "PNG", 0, 0, CARD_WIDTH, CARD_HEIGHT);
        pdf.addPage([CARD_WIDTH, CARD_HEIGHT], "portrait");
        pdf.addImage(c.back, "PNG", 0, 0, CARD_WIDTH, CARD_HEIGHT);
        first = false;
        done += 1;
        setProgress({ done, total: captures.length });
      }
      pdf.save(`cm-autos-id-cards-${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportedCount(done);
      toast.success(
        `Exported ${done} member${done === 1 ? "" : "s"}${fails.length ? ` · ${fails.length} skipped` : ""}`,
      );
    } catch (e) {
      toast.error("Bulk export failed: " + (e as Error).message);
    } finally {
      setPhase("done");
      setProgress(null);
      setStatusLabel("");
      // Auto-return to idle so the button re-enables.
      setTimeout(() => setPhase((p) => (p === "done" ? "idle" : p)), 300);
    }
  };

  const adjustments = typeof window !== "undefined" ? loadAdjustments() : undefined;

  const buttonLabel = (() => {
    if (!busy) return null;
    const base =
      phase === "loading"
        ? statusLabel || "Loading…"
        : phase === "verifying"
        ? `Verifying ${progress?.done ?? 0}/${progress?.total ?? 0}`
        : phase === "building"
        ? `Building PDF ${progress?.done ?? 0}/${progress?.total ?? 0}`
        : statusLabel || "Working…";
    return base;
  })();

  return (
    <>
      <Button onClick={handleDownload} disabled={busy} size="sm" aria-busy={busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            {buttonLabel}
          </>
        ) : (
          <>
            <FileDown className="h-4 w-4 mr-1" /> Download all as PDF
          </>
        )}
      </Button>

      {failures.length > 0 && !busy && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReportOpen(true)}
          className="text-destructive"
        >
          <AlertTriangle className="h-4 w-4 mr-1" />
          {failures.length} failed
        </Button>
      )}

      {mounted && members && (
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
                    refs.current[m.id] = { ...(refs.current[m.id] ?? { front: null, back: null }), front: el };
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

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Export verification</DialogTitle>
            <DialogDescription>
              {exportedCount > 0
                ? `Exported ${exportedCount} member${exportedCount === 1 ? "" : "s"}.`
                : "No members were exported."}
              {failures.length > 0 &&
                ` The following ${failures.length} card${failures.length === 1 ? "" : "s"} failed verification and were skipped:`}
            </DialogDescription>
          </DialogHeader>
          {failures.length > 0 ? (
            <div className="max-h-72 overflow-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Side</th>
                    <th className="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((f) => (
                    <tr key={f.id + f.side} className="border-t">
                      <td className="px-3 py-2 font-medium">{f.name}</td>
                      <td className="px-3 py-2 text-muted-foreground capitalize">{f.side}</td>
                      <td className="px-3 py-2 text-muted-foreground">{f.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">All members verified successfully.</p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
