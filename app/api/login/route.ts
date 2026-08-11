import { NextResponse } from "next/server";
import { signToken, timingSafeEqual } from "../../../lib/auth";
import { getSessionEpoch } from "../../../lib/redis";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const expected = process.env.APP_PASSWORD || "";

  const ok = password.length > 0 && expected.length > 0 && timingSafeEqual(password, expected);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  const epoch = await getSessionEpoch();
  const token = await signToken(epoch);
  const res = NextResponse.json({ ok: true });
  res.cookies.set("euo_session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
