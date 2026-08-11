import { NextResponse } from "next/server";
import { getRedis } from "../../../lib/redis";

export async function GET() {
  const redis = getRedis();
  const names = await redis.smembers("euo:directory");
  return NextResponse.json({ names });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name required." }, { status: 400 });
  }
  const redis = getRedis();
  await redis.sadd("euo:directory", name);
  const names = await redis.smembers("euo:directory");
  return NextResponse.json({ names });
}
