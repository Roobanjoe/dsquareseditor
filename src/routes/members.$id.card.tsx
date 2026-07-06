import { useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";
import { IDCardFront } from "@/components/IDCardFront";
import { IDCardBack } from "@/components/IDCardBack";
import { DEFAULT_FRONT_LAYOUT, DEFAULT_BACK_LAYOUT } from "@/lib/id-card-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { useCardAdjustments } from "@/lib/card-adjustments";
import { CardAdjustmentsPanel } from "@/components/CardAdjustmentsPanel";

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

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const { adjustments, setAdjustments, reset } = useCardAdjustments();

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
            <CardAdjustmentsPanel adjustments={adjustments} setAdjustments={setAdjustments} reset={reset} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="flex flex-wrap gap-8 justify-center">
          <IDCardFront member={member} layout={DEFAULT_FRONT_LAYOUT} scale={scale} innerRef={frontRef} adjustments={adjustments} />
          <IDCardBack member={member} layout={DEFAULT_BACK_LAYOUT} scale={scale} innerRef={backRef} adjustments={adjustments} />
        </div>
      </main>
    </div>
  );
}
