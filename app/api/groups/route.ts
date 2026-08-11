import { NextResponse } from "next/server";
import { getRedis } from "../../../lib/redis";

export async function GET() {
  const redis = getRedis();
  const raw = await redis.hgetall("euo:groups");
  const groups = raw
    ? Object.entries(raw).map(([id, v]) => ({ id, ...(typeof v === "string" ? JSON.parse(v) : (v as any)) }))
    : [];
  groups.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));
  return NextResponse.json({ groups });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const members = Array.isArray(body.members) ? body.members.filter((m: any) => typeof m === "string" && m.trim()) : [];

  if (!name) {
    return NextResponse.json({ error: "Group name required." }, { status: 400 });
  }
  if (members.length < 2) {
    return NextResponse.json({ error: "Pick at least one other person." }, { status: 400 });
  }

  const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const group = { name, members, createdAt: Date.now() };

  const redis = getRedis();
  await redis.hset("euo:groups", { [id]: JSON.stringify(group) });

  return NextResponse.json({ group: { id, ...group } });
}
