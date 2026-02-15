import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "mission-control", ts: new Date().toISOString() });
}
