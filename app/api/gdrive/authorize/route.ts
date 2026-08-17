import { NextResponse } from "next/server";
import { getAuthUrl } from "../../../../lib/gdrive";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const key = searchParams.get("key");
  const secret = process.env.GDRIVE_SETUP_SECRET;

  if (!secret || key !== secret) {
    return NextResponse.json(
      { error: "Unauthorized. Visit this URL with ?key=<your GDRIVE_SETUP_SECRET>." },
      { status: 401 }
    );
  }

  return NextResponse.redirect(getAuthUrl());
}
