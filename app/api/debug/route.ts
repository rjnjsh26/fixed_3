import { NextResponse } from "next/server";
import { getRedis, getSessionEpoch } from "../../../lib/redis";

// This route sits behind the normal login middleware (it's not in the
// excluded paths list), so only someone who already has a valid session
// cookie can load it — no separate secret needed.
export async function GET() {
  const redis = getRedis();
  const [directory, groupsRaw, keys, epoch] = await Promise.all([
    redis.smembers("euo:directory"),
    redis.hgetall("euo:groups"),
    redis.keys("euo:*"),
    getSessionEpoch(),
  ]);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    sessionEpoch: epoch,
    directoryMembers: directory,
    directoryCount: directory.length,
    groupsCount: groupsRaw ? Object.keys(groupsRaw).length : 0,
    totalKeysStored: keys.length,
    allKeys: keys,
  });
}
