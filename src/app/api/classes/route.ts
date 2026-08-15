import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createClassBlock, deleteClassBlock, listClassBlocks } from "@/lib/classes";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";

async function requireUser() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const classes = await listClassBlocks(userId);
  return NextResponse.json({ classes });
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  const body = await request.json();
  const result = await createClassBlock(userId, user?.timezone || DEFAULT_TIMEZONE, body);
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const deleted = await deleteClassBlock(userId, id);
  if (!deleted) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
