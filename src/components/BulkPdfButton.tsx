import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Download, FileDown, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { startBulkPdfJob, getBulkPdfSignedUrl } from "@/lib/bulk-pdf.functions";

type Job = {
  id: string;
  status: "queued" | "running" | "done" | "error";
  total: number;
  processed: number;
  pdf_path: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};

const LS_KEY = "cm-autos-current-bulk-pdf-job";

async function triggerDownload(path: string, sign: (p: { data: { path: string } }) => Promise<{ url: string }>) {
  const { url } = await sign({ data: { path } });
  const a = document.createElement("a");
  a.href = url;
  a.download = `cm-autos-id-cards-${new Date().toISOString().slice(0, 10)}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => a.remove(), 1000);
}

export function BulkPdfButton() {
  const startJob = useServerFn(startBulkPdfJob);
  const signUrl = useServerFn(getBulkPdfSignedUrl);
  const [jobId, setJobId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(LS_KEY),
  );
  const [job, setJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const autoDownloaded = useRef<Set<string>>(new Set());

  // Fetch job initial state + subscribe
  useEffect(() => {
    if (!jobId) {
      setJob(null);
      return;
    }
    let alive = true;
    supabase
      .from("bulk_pdf_jobs")
      .select("*")
      .eq("id", jobId)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setJob(data as Job);
      });
    const ch = supabase
      .channel(`bulk-pdf-job-${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bulk_pdf_jobs", filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as Job),
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [jobId]);

  // Members count (for the button's total)
  useEffect(() => {
    supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => setMemberCount(count ?? 0));
  }, []);

  // Auto-download once when done
  useEffect(() => {
    if (job?.status === "done" && job.pdf_path && !autoDownloaded.current.has(job.id)) {
      autoDownloaded.current.add(job.id);
      void triggerDownload(job.pdf_path, signUrl).catch((e) =>
        toast.error("Download failed: " + (e as Error).message),
      );
    }
  }, [job, signUrl]);

  // Recent jobs list
  const { data: recentJobs } = useQuery({
    queryKey: ["bulk-pdf-jobs-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bulk_pdf_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      return (data ?? []) as Job[];
    },
    refetchInterval: 5000,
  });

  const handleStart = useCallback(async () => {
    setStarting(true);
    try {
      const { jobId: newId } = await startJob();
      window.localStorage.setItem(LS_KEY, newId);
      setJobId(newId);
      setJob(null);
      toast.success("Bulk export started — it will keep running in the background");
    } catch (e) {
      toast.error("Failed to start: " + (e as Error).message);
    } finally {
      setStarting(false);
    }
  }, [startJob]);

  const handleReset = () => {
    window.localStorage.removeItem(LS_KEY);
    setJobId(null);
    setJob(null);
  };

  const busy = starting || (job && (job.status === "queued" || job.status === "running"));
  const pct = job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="flex flex-col items-stretch gap-2 min-w-[260px]">
      {job?.status === "done" && job.pdf_path ? (
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => triggerDownload(job.pdf_path!, signUrl).catch((e) => toast.error(e.message))}
          >
            <Download className="h-4 w-4 mr-1" />
            Download ready ({job.processed} cards)
          </Button>
          <Button size="sm" variant="outline" onClick={handleStart} disabled={starting}>
            <FileDown className="h-4 w-4 mr-1" />
            New export
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          onClick={handleStart}
          disabled={!!busy || !memberCount}
          aria-busy={!!busy}
        >
          {starting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Starting…
            </>
          ) : job?.status === "queued" ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Queued…
            </>
          ) : job?.status === "running" ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Building {job.processed}/{job.total}
            </>
          ) : job?.status === "error" ? (
            <>
              <AlertTriangle className="h-4 w-4 mr-1" /> Retry export
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4 mr-1" />
              Download all as PDF{memberCount ? ` (${memberCount})` : ""}
            </>
          )}
        </Button>
      )}

      {job && (job.status === "queued" || job.status === "running") && (
        <div className="space-y-0.5">
          <Progress value={pct} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground text-center">
            {job.status === "queued" ? "Queued" : `Rendering ${job.processed}/${job.total || "…"}`} · {pct}%
            {" · "}safe to close this tab
          </p>
        </div>
      )}

      {job?.status === "error" && (
        <p className="text-[10px] text-destructive flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> {job.error ?? "Unknown error"}
        </p>
      )}

      {job?.status === "done" && (
        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" /> Exported {job.processed} cards · saved to server
        </p>
      )}

      {recentJobs && recentJobs.length > 0 && (
        <details className="text-[11px] text-muted-foreground">
          <summary className="cursor-pointer select-none">Recent exports</summary>
          <ul className="mt-1 space-y-1">
            {recentJobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-2">
                <span>
                  {new Date(j.created_at).toLocaleString()} · {j.status}
                  {j.total ? ` · ${j.processed}/${j.total}` : ""}
                </span>
                {j.status === "done" && j.pdf_path ? (
                  <button
                    className="underline"
                    onClick={() => triggerDownload(j.pdf_path!, signUrl).catch((e) => toast.error(e.message))}
                  >
                    download
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {jobId && (
            <button className="mt-1 underline" onClick={handleReset}>
              clear current
            </button>
          )}
        </details>
      )}
    </div>
  );
}
