import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, CheckCircle2, FileDown, Loader2 } from "lucide-react";
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

type Phase = "idle" | "prerendering" | "verifying" | "building" | "done";
type Failure = { id: string; name: string; side: "front" | "back" | "both"; reason: string };
type Capture = { front: string; back: string };

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
  await new Promise((r) => setTimeout(r, 200));
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

const MIN_PNG_BYTES = 5000;

async function safeCapture(node: HTMLDivElement): Promise<{ ok: true; png: string } | { ok: false; reason: string }> {
  try {
    const png = await toPng(node, CAPTURE_OPTS);
    if (!png || !png.startsWith("data:image/png")) return { ok: false, reason: "Renderer returned no image" };
    const base64 = png.slice(png.indexOf(",") + 1);
    if (base64.length < MIN_PNG_BYTES) return { ok: false, reason: "Render looks blank / too small" };
    return { ok: true, png };
  } catch (e) {
    return { ok: false, reason: (e as Error).message || "Unknown render error" };
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

export function BulkPdfButton() {
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [statusLabel, setStatusLabel] = useState<string>("");
  const [failures, setFailures] = useState<Failure[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [exportedCount, setExportedCount] = useState(0);
  const [cacheReadyCount, setCacheReadyCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, { front: HTMLDivElement | null; back: HTMLDivElement | null }>>({});
  const cache = useRef<Map<string, Capture>>(new Map());
  const prerenderToken = useRef(0);

  const busy = phase !== "idle" && phase !== "done";

  const { data: members } = useQuery({
    queryKey: ["members-all-for-pdf"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: overridesMap } = useQuery({
    queryKey: ["all-member-overrides"],
    queryFn: loadAllMemberOverrides,
  });

  // Live invalidation: any member or override change re-triggers prerender.
  useEffect(() => {
    const ch = supabase
      .channel("bulk-pdf-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "members" }, () => {
        qc.invalidateQueries({ queryKey: ["members-all-for-pdf"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "member_overrides" }, () => {
        qc.invalidateQueries({ queryKey: ["all-member-overrides"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const adjustments = typeof window !== "undefined" ? loadAdjustments() : undefined;

  // Signature of current data — used to invalidate the cache on any change.
  const dataSignature = useMemo(() => {
    if (!members) return "";
    return JSON.stringify({
      m: members.map((x) => [x.id, x.updated_at ?? x.created_at ?? "", x.photo_url ?? ""]),
      o: overridesMap ?? {},
    });
  }, [members, overridesMap]);

  // Background prerender pass — captures every card into `cache`.
  const runPrerender = useCallback(async () => {
    if (!members?.length || !containerRef.current) return;
    const token = ++prerenderToken.current;
    setPhase((p) => (p === "idle" ? "prerendering" : p));
    setStatusLabel("Prerendering cards…");
    setProgress({ done: 0, total: members.length });
    cache.current.clear();
    setCacheReadyCount(0);

    await waitForImages(containerRef.current);
    if (token !== prerenderToken.current) return;

    let done = 0;
    for (const m of members) {
      if (token !== prerenderToken.current) return;
      const nodes = refs.current[m.id];
      if (nodes?.front && nodes?.back) {
        const [f, b] = await Promise.all([safeCapture(nodes.front), safeCapture(nodes.back)]);
        if (f.ok && b.ok) {
          cache.current.set(m.id, { front: f.png, back: b.png });
          setCacheReadyCount(cache.current.size);
        }
      }
      done += 1;
      setProgress({ done, total: members.length });
    }
    setPhase((p) => (p === "prerendering" ? "idle" : p));
    setStatusLabel("");
  }, [members]);

  // Re-run prerender whenever members / overrides change.
  useEffect(() => {
    if (!dataSignature) return;
    // Slight delay to let the DOM mount refs.
    const t = setTimeout(() => {
      void runPrerender();
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSignature]);

  const buildAndDownloadPdf = useCallback(
    async (captures: { id: string; name: string; front: string; back: string }[]) => {
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
        // Yield to the event loop so the UI can paint the progress bar.
        await new Promise((r) => setTimeout(r, 0));
      }
      const blob = pdf.output("blob");
      const filename = `cm-autos-id-cards-${new Date().toISOString().slice(0, 10)}.pdf`;
      downloadBlob(blob, filename);
      return done;
    },
    [],
  );

  const handleDownload = async () => {
    if (busy) return;
    if (!members?.length) {
      toast.error("No members to export");
      return;
    }
    setFailures([]);
    setExportedCount(0);

    // Fast path: everything already prerendered.
    if (cache.current.size === members.length) {
      setPhase("building");
      setStatusLabel("Building PDF…");
      setProgress({ done: 0, total: members.length });
      try {
        const captures = members
          .map((m) => {
            const c = cache.current.get(m.id);
            return c ? { id: m.id, name: m.name, front: c.front, back: c.back } : null;
          })
          .filter((x): x is { id: string; name: string; front: string; back: string } => !!x);
        const done = await buildAndDownloadPdf(captures);
        setExportedCount(done);
        toast.success(`Exported ${done} member${done === 1 ? "" : "s"}`);
      } catch (e) {
        toast.error("Bulk export failed: " + (e as Error).message);
      } finally {
        setPhase("done");
        setTimeout(() => setPhase((p) => (p === "done" ? "idle" : p)), 400);
      }
      return;
    }

    // Slow path: verify then build.
    setPhase("verifying");
    setStatusLabel("Verifying renders…");
    setProgress({ done: 0, total: members.length });

    if (!containerRef.current) {
      setPhase("idle");
      return;
    }
    await waitForImages(containerRef.current);

    const captures: { id: string; name: string; front: string; back: string }[] = [];
    const fails: Failure[] = [];
    let verified = 0;
    for (const m of members) {
      const cached = cache.current.get(m.id);
      if (cached) {
        captures.push({ id: m.id, name: m.name, front: cached.front, back: cached.back });
      } else {
        const nodes = refs.current[m.id];
        if (!nodes?.front || !nodes?.back) {
          fails.push({ id: m.id, name: m.name, side: "both", reason: "Card did not mount" });
        } else {
          const [f, b] = await Promise.all([safeCapture(nodes.front), safeCapture(nodes.back)]);
          if (!f.ok && !b.ok) fails.push({ id: m.id, name: m.name, side: "both", reason: `${f.reason}; ${b.reason}` });
          else if (!f.ok) fails.push({ id: m.id, name: m.name, side: "front", reason: f.reason });
          else if (!b.ok) fails.push({ id: m.id, name: m.name, side: "back", reason: b.reason });
          else {
            captures.push({ id: m.id, name: m.name, front: f.png, back: b.png });
            cache.current.set(m.id, { front: f.png, back: b.png });
          }
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
      setTimeout(() => setPhase((p) => (p === "done" ? "idle" : p)), 400);
      return;
    }
    if (fails.length) {
      toast.warning(`${fails.length} member${fails.length === 1 ? "" : "s"} failed verification and will be skipped`);
      setReportOpen(true);
    }

    setPhase("building");
    setStatusLabel("Building PDF…");
    setProgress({ done: 0, total: captures.length });
    try {
      const done = await buildAndDownloadPdf(captures);
      setExportedCount(done);
      toast.success(
        `Exported ${done} member${done === 1 ? "" : "s"}${fails.length ? ` · ${fails.length} skipped` : ""}`,
      );
    } catch (e) {
      toast.error("Bulk export failed: " + (e as Error).message);
    } finally {
      setPhase("done");
      setTimeout(() => setPhase((p) => (p === "done" ? "idle" : p)), 400);
    }
  };

  const total = progress.total || members?.length || 0;
  const pct = total > 0 ? Math.round((progress.done / total) * 100) : 0;
  const stageLabel =
    phase === "prerendering"
      ? `Prerendering ${progress.done}/${total}`
      : phase === "verifying"
      ? `Verifying ${progress.done}/${total}`
      : phase === "building"
      ? `Building PDF ${progress.done}/${total}`
      : phase === "done"
      ? "Done"
      : statusLabel;

  const cacheReady = !!members && cache.current.size === members.length && members.length > 0;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex flex-col items-stretch gap-1 min-w-[220px]">
        <Button onClick={handleDownload} disabled={busy || !members?.length} size="sm" aria-busy={busy}>
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              {stageLabel || "Working…"}
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-1" /> Download all as PDF
            </>
          )}
        </Button>
        {busy && (
          <div className="space-y-0.5">
            <Progress value={pct} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground text-center">
              {stageLabel} · {pct}%
            </p>
          </div>
        )}
        {!busy && cacheReady && (
          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {cacheReadyCount}/{members?.length} cards prerendered · instant download
          </p>
        )}
      </div>

      {failures.length > 0 && !busy && (
        <Button variant="outline" size="sm" onClick={() => setReportOpen(true)} className="text-destructive">
          <AlertTriangle className="h-4 w-4 mr-1" />
          {failures.length} failed
        </Button>
      )}

      {members && (
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
            const memberOv = overridesMap?.[m.id] ?? EMPTY_OVERRIDES;
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
    </div>
  );
}
