# Background server-rendered bulk PDF

Move bulk ID card generation off the browser so it keeps running after the tab closes and finishes even for large member counts.

## What changes for the user

- "Download all as PDF" starts a job on the server and returns immediately.
- A live progress bar (0–100%) driven by Supabase Realtime shows `processed / total` even if the user leaves and comes back later (or opens the app on another device).
- When the job finishes, the button turns into "Download ready" with the final PDF link. The PDF is also listed in a small "Recent bulk exports" panel with timestamp + status so past runs stay downloadable.
- Closing the tab, going offline, or navigating away does not cancel the job — the worker keeps running server-side and stores the result in Supabase Storage.

## Architecture

```text
Browser                Supabase                Cloudflare Worker (server)
──────────             ─────────               ──────────────────────────
click Download  ──►    bulk_pdf_jobs           /api/public/hooks/build-bulk-pdf
                       row (queued)            ├─ fetch members + overrides
                                               ├─ fetch template images (front/back)
                                               ├─ for each member:
Realtime  ◄──────────  UPDATE processed        │    fetch photo, draw page front + back
                                               │    UPDATE bulk_pdf_jobs.processed
                                               └─ upload PDF to id-cards bucket
                       row (done, pdf_path) ──►│    UPDATE row status=done, pdf_path
click link      ──►    signed URL from bucket ─┴─► PDF download
```

## Technical details

**New table `bulk_pdf_jobs`** (public, RLS + GRANTs):
`id`, `status` (`queued|running|done|error`), `total`, `processed`, `pdf_path`, `error`, `created_at`, `updated_at`, plus realtime enabled.

**Server route `src/routes/api/public/hooks/build-bulk-pdf.ts`** (public prefix, verified by shared `apikey` header matching `SUPABASE_PUBLISHABLE_KEY`). Uses `supabaseAdmin` (loaded inside handler) to read members + overrides, fetch template JPEGs from R2 asset URLs and photos from the `member-photos` bucket via signed URLs, and render the PDF with `pdf-lib` + `@pdf-lib/fontkit`. Embeds Noto Sans Tamil + Inter TTFs bundled under `src/assets/fonts/` so Tamil names render correctly. Uses the exact same coordinates from `src/lib/id-card-layout.ts` and applies each member's overrides (`dx`, `dy`, `scale`, `photoFrame`, `photoImage`). Draws the photo as a circular clip via a PDF clip path so `objectFit: cover` + `objectPosition` + zoom match the on-screen preview. Updates `bulk_pdf_jobs.processed` after every member so the progress bar is live. Uploads the final PDF to `id-cards/bulk/<jobId>.pdf` and stores the path on the row.

**Kickoff server function `startBulkPdfJob`** (`src/lib/bulk-pdf.functions.ts`): inserts a `queued` row, then fires `fetch(webhookUrl, { keepalive: true })` without awaiting it (returns the job id immediately). The Worker keeps executing the hook after the client response is sent, so the render survives tab close.

**Client `BulkPdfButton`** rewritten:
- Removes the html-to-image prerender + jsPDF path entirely.
- Calls `startBulkPdfJob`, stores `jobId` in `localStorage` so a resumed session reattaches to the running job.
- Subscribes to `postgres_changes` on `bulk_pdf_jobs` filtered to the job id, drives the progress bar off `processed / total`.
- When `status='done'`, requests a signed URL for `pdf_path` and swaps the button label to "Download ready" (auto-downloads once, then remains available).
- A small collapsible "Recent exports" list shows the last 10 jobs from the same table with status + download link.

**Font handling**: bundle two TTFs under `src/assets/fonts/` (`NotoSansTamil-SemiBold.ttf`, `Inter-SemiBold.ttf`) and import them as `?url` so Vite ships them as static assets fetched at request time in the Worker. `pdf-lib` + `fontkit` handles the subsetting.

**Photo circular clip**: for each member, embed the JPEG/PNG, compute the destination rect from `layout.photo` + overrides, push a graphics state, add a circle clip path, draw the image, pop the state. Zoom is applied by scaling the image rect around the object-position anchor.

**Cancellation / retries**: not in scope for this pass — jobs run to completion or record `status='error'` with the failure message; user can just start a new job.

## Files

- migration: create `bulk_pdf_jobs`, enable realtime, grants + RLS
- new `src/routes/api/public/hooks/build-bulk-pdf.ts`
- new `src/lib/bulk-pdf.functions.ts` (`startBulkPdfJob`, `getBulkPdfSignedUrl`, `listRecentBulkPdfJobs`)
- new `src/lib/bulk-pdf.server.ts` (pdf-lib render logic, image + font loading, circular clip helper)
- new `src/assets/fonts/*.ttf` (fetched during install)
- rewrite `src/components/BulkPdfButton.tsx` (job kickoff + realtime progress + resume)
- add `pdf-lib` and `@pdf-lib/fontkit` to dependencies

## Out of scope

- Cross-device notifications (email/push) when a job finishes — the UI reattaches on next visit.
- Per-member cancellation.
- Progressive streaming of the PDF (final file is delivered as a single download).
