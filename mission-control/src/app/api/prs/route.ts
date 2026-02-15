import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket";

export async function GET() {
  const prs = await prisma.pR.findMany({
    include: { tasks: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ ok: true, prs });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { title, repo, branch, description } = body || {};

  if (!title) {
    return NextResponse.json({ ok: false, error: "missing_title" }, { status: 400 });
  }

  const pr = await prisma.pR.create({
    data: {
      title,
      repo: repo || null,
      branch: branch || null,
      description: description || null,
      stage: "spec",
      status: "draft",
      logs: [],
      checklist: [],
      approvals: [],
    },
  });

  emitEvent("pr.created", pr);

  return NextResponse.json({ ok: true, pr });
}
