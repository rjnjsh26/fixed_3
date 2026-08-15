import { NextResponse } from "next/server";
import { getRedis } from "../../../../lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const redis = getRedis();

  // Wipe every key this app owns: directory, all threads (and their
  // deleted-message sets), and all custom groups.
  const keys = await redis.keys("euo:*");
  if (keys.length > 0) {
    await redis.del(...keys);
  }

  // Stamp a brand new session generation. Every token signed before this
  // moment stops verifying immediately, so everyone gets sent back to the
  // passcode screen on their next request, regardless of their cookie's
  // remaining lifetime.
  const newEpoch = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await redis.set("euo:session_epoch", newEpoch);

  return NextResponse.json({ ok: true, wipedKeys: keys.length, resetAt: new Date().toISOString() });
}
