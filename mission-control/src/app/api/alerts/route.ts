import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket";

export async function GET() {
  const alerts = await prisma.alert.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ ok: true, alerts });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { message, level, source } = body || {};

  if (!message) {
    return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 });
  }

  const alert = await prisma.alert.create({
    data: {
      message,
      level: level || "info",
      source: source || null,
    },
  });

  emitEvent("alert.created", alert);

  return NextResponse.json({ ok: true, alert });
}
