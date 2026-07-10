import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

export const startBulkPdfJob = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: job, error } = await supabaseAdmin
    .from("bulk_pdf_jobs")
    .insert({ status: "queued", total: 0, processed: 0 })
    .select("id")
    .single();
  if (error || !job) throw new Error(error?.message ?? "failed to create job");

  const origin = getRequestUrl().origin;
  const hookUrl = `${origin}/api/public/hooks/build-bulk-pdf`;
  const apikey = process.env.SUPABASE_PUBLISHABLE_KEY!;

  // Fire and forget — Cloudflare workers keep the request running even after
  // we return, so PDF generation continues if the user closes the tab.
  fetch(hookUrl, {
    method: "POST",
    headers: { "content-type": "application/json", apikey },
    body: JSON.stringify({ jobId: job.id }),
  }).catch((e) => console.error("kickoff fetch failed", e));

  return { jobId: job.id as string };
});

export const getBulkPdfSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { path: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("id-cards")
      .createSignedUrl(data.path, 60 * 60);
    if (error || !signed) throw new Error(error?.message ?? "failed to sign url");
    return { url: signed.signedUrl };
  });
