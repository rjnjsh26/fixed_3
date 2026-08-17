import { NextResponse } from "next/server";
import { uploadToDrive } from "../../../lib/gdrive";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Vercel's serverless functions cap the request body around 4.5MB
// regardless of plan — this limit exists to stay safely under that, not
// because of anything in this app's own logic.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export async function POST(req: Request) {
  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File too large — 4MB max on this hosting plan." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToDrive(buffer, file.type || "application/octet-stream", file.name || `upload-${Date.now()}.jpg`);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    // TEMPORARY: surfaces the real Google API error for debugging. Once
    // uploads are working reliably, switch this back to a generic message
    // so internal error details aren't exposed to the browser.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Upload to Google Drive failed.", detail },
      { status: 500 }
    );
  }
}
