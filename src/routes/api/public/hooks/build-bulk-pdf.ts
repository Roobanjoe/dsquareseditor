import { createFileRoute } from "@tanstack/react-router";
import { getRequestUrl } from "@tanstack/react-start/server";

export const Route = createFileRoute("/api/public/hooks/build-bulk-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let jobId: string | null = null;
        try {
          const body = (await request.json().catch(() => ({}))) as { jobId?: string };
          jobId = body.jobId ?? null;
          const apiKey = request.headers.get("apikey");
          if (!apiKey || apiKey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
            return new Response("unauthorized", { status: 401 });
          }
          if (!jobId) return new Response("missing jobId", { status: 400 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { buildBulkPdf } = await import("@/lib/bulk-pdf.server");

          // Mark running
          await supabaseAdmin
            .from("bulk_pdf_jobs")
            .update({ status: "running" })
            .eq("id", jobId);

          const [{ data: members, error: mErr }, { data: ovRows, error: oErr }] = await Promise.all([
            supabaseAdmin.from("members").select("*").order("name"),
            supabaseAdmin.from("member_overrides").select("member_id, overrides"),
          ]);
          if (mErr) throw mErr;
          if (oErr) throw oErr;
          if (!members || members.length === 0) {
            await supabaseAdmin
              .from("bulk_pdf_jobs")
              .update({ status: "error", error: "No members to export" })
              .eq("id", jobId);
            return Response.json({ ok: false, error: "no members" });
          }

          const overridesMap: Record<string, any> = {};
          for (const row of ovRows ?? []) {
            overridesMap[row.member_id as string] = row.overrides;
          }

          await supabaseAdmin
            .from("bulk_pdf_jobs")
            .update({ total: members.length, processed: 0 })
            .eq("id", jobId);

          const baseUrl = getRequestUrl().origin;

          // Throttle progress updates so we don't spam
          let lastWrite = 0;
          const pdfBytes = await buildBulkPdf({
            members: members as any,
            overridesMap,
            baseUrl,
            onProgress: async (processed) => {
              const now = Date.now();
              if (processed === members.length || now - lastWrite > 400) {
                lastWrite = now;
                await supabaseAdmin
                  .from("bulk_pdf_jobs")
                  .update({ processed })
                  .eq("id", jobId!);
              }
            },
          });

          const path = `bulk/${jobId}.pdf`;
          const { error: upErr } = await supabaseAdmin.storage
            .from("id-cards")
            .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
          if (upErr) throw upErr;

          await supabaseAdmin
            .from("bulk_pdf_jobs")
            .update({ status: "done", pdf_path: path, processed: members.length })
            .eq("id", jobId);

          return Response.json({ ok: true, path });
        } catch (e) {
          const msg = (e as Error).message || "unknown error";
          console.error("build-bulk-pdf failed", e);
          if (jobId) {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await supabaseAdmin
              .from("bulk_pdf_jobs")
              .update({ status: "error", error: msg })
              .eq("id", jobId);
          }
          return new Response(msg, { status: 500 });
        }
      },
    },
  },
});
