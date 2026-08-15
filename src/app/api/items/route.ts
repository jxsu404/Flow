import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";
import { createItem, deleteItem, listItems, updateItem } from "@/lib/items";

async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user.id;
}

async function userZone(userId: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  return user?.timezone || DEFAULT_TIMEZONE;
}

export async function GET() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const items = await listItems(userId);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const timeZone = await userZone(userId);
  const body = await request.json();
  const result = await createItem(userId, timeZone, body);
  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const timeZone = await userZone(userId);
  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const result = await updateItem(userId, timeZone, body.id, body);
  if (!result) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  const deleted = await deleteItem(userId, id);
  if (!deleted) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
