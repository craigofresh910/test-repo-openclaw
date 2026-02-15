import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket";

export async function GET() {
  const tasks = await prisma.task.findMany({
    include: { agent: true, pr: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, tasks });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, agentId, prId, status, summary } = body || {};

  if (!title) {
    return NextResponse.json({ ok: false, error: "missing_title" }, { status: 400 });
  }

  const task = await prisma.task.create({
    data: {
      title,
      agentId: agentId || null,
      prId: prId || null,
      status: status || "queued",
      summary: summary || null,
      logs: [],
    },
    include: { agent: true, pr: true },
  });

  emitEvent("task.created", task);

  return NextResponse.json({ ok: true, task });
}
