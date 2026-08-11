import { NextResponse } from "next/server";
import { redis } from "../../../../lib/redis";

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const raw = await redis.lrange(`euo:thread:${params.key}`, 0, -1);
  const messages = raw.map((m) => (typeof m === "string" ? JSON.parse(m) : m));
  return NextResponse.json({ messages });
}

export async function POST(req: Request, { params }: { params: { key: string } }) {
  const body = await req.json().catch(() => ({}));
  if (!body.message) {
    return NextResponse.json({ error: "Message required." }, { status: 400 });
  }
  await redis.rpush(`euo:thread:${params.key}`, JSON.stringify(body.message));
  return NextResponse.json({ ok: true });
}
