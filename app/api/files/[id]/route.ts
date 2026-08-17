import { NextResponse } from "next/server";
import { Readable } from "stream";
import { getFileMeta, getFileStream } from "../../../../lib/gdrive";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// This route sits behind the normal login middleware (it isn't in the
// excluded paths list), so only someone already past the group passcode
// can load it. There is no separate public/Drive-hosted link anywhere.
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const meta = await getFileMeta(params.id);
    const nodeStream = await getFileStream(params.id);
    const webStream = Readable.toWeb(nodeStream as any) as unknown as ReadableStream;

    const { searchParams } = new URL(req.url);
    const forceDownload = searchParams.get("download");
    const filename = (meta.name || "file").replace(/"/g, "");

    const headers = new Headers();
    headers.set("Content-Type", meta.mimeType || "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(filename)}"`
    );
    if (meta.size) headers.set("Content-Length", String(meta.size));
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(webStream, { headers });
  } catch {
    return NextResponse.json({ error: "Couldn't load that file." }, { status: 404 });
  }
}
