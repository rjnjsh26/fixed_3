import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "./lib/auth";
import { getSessionEpoch } from "./lib/redis";

// api/cron is excluded here because the weekly reset job authenticates with
// its own bearer-token secret, not a login cookie.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/login|api/cron).*)"],
};

export async function middleware(req: NextRequest) {
  const token = req.cookies.get("euo_session")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  try {
    const epoch = await getSessionEpoch();
    const valid = await verifyToken(token, epoch);
    if (!valid) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  return NextResponse.next();
}
