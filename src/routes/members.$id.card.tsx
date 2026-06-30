import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { IDCardFront } from "@/components/IDCardFront";
import { IDCardBack } from "@/components/IDCardBack";
import { LayoutEditor } from "@/components/LayoutEditor";
import {
  loadFrontLayout, loadBackLayout, saveFrontLayout, saveBackLayout,
  DEFAULT_FRONT_LAYOUT, DEFAULT_BACK_LAYOUT,
  type FrontLayout, type BackLayout,
} from "@/lib/id-card-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer, RotateCcw, Lock } from "lucide-react";
import { toast } from "sonner";

const GLOBAL_LAYOUT_ID = "global";

export const Route = createFileRoute("/members/$id/card")({
  head: () => ({ meta: [{ title: "Member ID Card" }] }),
  component: CardView,
});

function CardView() {
  const { id } = Route.useParams();
  const { data: member, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const [front, setFront] = useState<FrontLayout>(DEFAULT_FRONT_LAYOUT);
  const [back, setBack] = useState<BackLayout>(DEFAULT_BACK_LAYOUT);
  const [side, setSide] = useState<"front" | "back">("front");
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Load layout: prefer the global (server-saved) layout; fall back to local draft.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await (supabase as any)
        .from("id_card_settings")
        .select("front_layout, back_layout")
        .eq("id", GLOBAL_LAYOUT_ID)
        .maybeSingle();
      if (cancelled) return;
      if (data?.front_layout) {
        setFront({ ...DEFAULT_FRONT_LAYOUT, ...data.front_layout });
      } else {
        setFront(loadFrontLayout());
      }
      if (data?.back_layout) {
        setBack({ ...DEFAULT_BACK_LAYOUT, ...data.back_layout });
      } else {
        setBack(loadBackLayout());
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { saveFrontLayout(front); }, [front]);
  useEffect(() => { saveBackLayout(back); }, [back]);

  const lockAsDefault = async () => {
    const { error } = await (supabase as any)
      .from("id_card_settings")
      .upsert({
        id: GLOBAL_LAYOUT_ID,
        front_layout: front,
        back_layout: back,
        updated_at: new Date().toISOString(),
      });
    if (error) toast.error("Failed to lock layout: " + error.message);
    else toast.success("Alignment locked — applied to all members");
  };

  const download = async (target: "front" | "back") => {
    const node = target === "front" ? frontRef.current : backRef.current;
    if (!node || !member) return;
    try {
      const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
      const link = document.createElement("a");
      link.download = `${member.name}-${target}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      toast.error("Download failed: " + (e as Error).message);
    }
  };

  const downloadBoth = async () => {
    await download("front");
    await download("back");
  };

  if (isLoading || !member) {
    return <div className="p-8 text-muted-foreground">Loading…</div>;
  }

  const scale = 0.7;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card print:hidden">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
            </Button>
            <h1 className="text-xl font-bold">{member.name}</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => download("front")}>
              <Download className="h-4 w-4 mr-1" /> Front PNG
            </Button>
            <Button variant="outline" size="sm" onClick={() => download("back")}>
              <Download className="h-4 w-4 mr-1" /> Back PNG
            </Button>
            <Button size="sm" onClick={downloadBoth}>
              <Download className="h-4 w-4 mr-1" /> Both sides
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-1" /> Print
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 grid lg:grid-cols-[1fr_360px] gap-8">
        <div className="space-y-6">
          <div className="flex gap-2 print:hidden">
            <Button size="sm" variant={side === "front" ? "default" : "outline"}
              onClick={() => setSide("front")}>Front</Button>
            <Button size="sm" variant={side === "back" ? "default" : "outline"}
              onClick={() => setSide("back")}>Back</Button>
          </div>

          <div className="flex flex-wrap gap-8 justify-center">
            <div className={side === "front" ? "" : "hidden print:block"}>
              <IDCardFront member={member} layout={front} scale={scale} innerRef={frontRef} />
            </div>
            <div className={side === "back" ? "" : "hidden print:block"}>
              <IDCardBack member={member} layout={back} scale={scale} innerRef={backRef} />
            </div>
          </div>
        </div>

        <aside className="space-y-4 print:hidden">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Alignment — {side}</h2>
            <Button size="sm" variant="ghost"
              onClick={() => {
                if (side === "front") setFront(DEFAULT_FRONT_LAYOUT);
                else setBack(DEFAULT_BACK_LAYOUT);
                toast.success("Reset to defaults");
              }}>
              <RotateCcw className="h-3 w-3 mr-1" /> Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Tweak X / Y / size to align fields over the template. Saved per-browser.
          </p>
          <LayoutEditor side={side} front={front} back={back}
            onFrontChange={setFront} onBackChange={setBack} />
        </aside>
      </main>
    </div>
  );
}
