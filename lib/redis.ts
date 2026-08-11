import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error(
        "Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN. Add them in Vercel > Environment Variables, using the REST URL/token from your Upstash database's REST API tab."
      );
    }
    client = new Redis({ url, token });
  }
  return client;
}

// The current "session generation." Every login token is stamped with this
// value; bumping it (done by the weekly reset job) instantly invalidates
// every session that was signed before the bump.
export async function getSessionEpoch(): Promise<string> {
  const redis = getRedis();
  let epoch = await redis.get<string>("euo:session_epoch");
  if (!epoch) {
    epoch = `${Date.now()}`;
    await redis.set("euo:session_epoch", epoch);
  }
  return epoch;
}
