import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emitEvent } from "@/lib/socket";

const STAGES = new Set(["spec", "build", "test", "review", "merge"]);
const STATUSES = new Set(["draft", "building", "review", "changes_requested", "merged"]);

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const { title, stage, status, description, repo, branch } = body || {};

  const update: Record<string, unknown> = {};
  if (title) update.title = title;
  if (description !== undefined) update.description = description;
  if (repo !== undefined) update.repo = repo;
  if (branch !== undefined) update.branch = branch;
  if (stage && STAGES.has(stage)) update.stage = stage;
  if (status && STATUSES.has(status)) update.status = status;

  const pr = await prisma.pR.update({
    where: { id: params.id },
    data: update,
  });

  emitEvent("pr.updated", pr);

  return NextResponse.json({ ok: true, pr });
}
