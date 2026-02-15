import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket";

export async function GET() {
  const agents = await prisma.agent.findMany({ orderBy: { role: "asc" } });
  return NextResponse.json({ ok: true, agents });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { id, name, role, status } = body || {};

  if (!id || !name || !role) {
    return NextResponse.json({ ok: false, error: "missing_id_name_or_role" }, { status: 400 });
  }

  const agent = await prisma.agent.upsert({
    where: { id },
    update: { name, role, status: status ?? "idle", lastUpdate: new Date() },
    create: { id, name, role, status: status ?? "idle" },
  });

  emitEvent("agent.updated", agent);

  return NextResponse.json({ ok: true, agent });
}
