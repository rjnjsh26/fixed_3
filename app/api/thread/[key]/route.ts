import { NextResponse } from "next/server";
import { getRedis } from "../../../../lib/redis";

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const redis = getRedis();
  const [raw, deletedIds] = await Promise.all([
    redis.lrange(`euo:thread:${params.key}`, 0, -1),
    redis.smembers(`euo:thread:${params.key}:deleted`),
  ]);
  const deleted = new Set(deletedIds);
  const messages = raw.map((m) => {
    const parsed = typeof m === "string" ? JSON.parse(m) : m;
    if (deleted.has(parsed.id)) {
      return { id: parsed.id, from: parsed.from, t: parsed.t, type: "deleted" };
    }
    return parsed;
  });
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const body = await req.json().catch(() => ({}));
  if (!body.message) {
    return NextResponse.json({ error: "Message required." }, { status: 400 });
  }
  const redis = getRedis();
  await redis.rpush(`euo:thread:${params.key}`, JSON.stringify(body.message));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { key: string } }) {
  const body = await req.json().catch(() => ({}));
  const messageId = body.messageId;
  const requesterName = typeof body.requesterName === "string" ? body.requesterName : "";
  if (!messageId || !requesterName) {
    return NextResponse.json({ error: "messageId and requesterName required." }, { status: 400 });
  }

  const redis = getRedis();
  const raw = await redis.lrange(`euo:thread:${params.key}`, 0, -1);
  const found = raw
    .map((m) => (typeof m === "string" ? JSON.parse(m) : m))
    .find((m) => m.id === messageId);

  if (!found) {
    return NextResponse.json({ error: "Message not found." }, { status: 404 });
  }
  if (found.from !== requesterName) {
    return NextResponse.json({ error: "You can only delete your own messages." }, { status: 403 });
  }

  await redis.sadd(`euo:thread:${params.key}:deleted`, messageId);

  // Deliberately NOT deleting anything from Drive here — "delete for
  // everyone" only hides the message from the chat. The actual file stays
  // in the Drive folder permanently, even after this delete and even after
  // the weekly reset (which only clears chat data, never touches Drive).

  return NextResponse.json({ ok: true });
}
