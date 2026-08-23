import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getScheduleData } from "@/lib/dashboard";
import { isIsoDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const date = new URL(request.url).searchParams.get("date") ?? undefined;
  if (date && !isIsoDate(date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }

  const data = await getScheduleData(session.user.id, date);
  return NextResponse.json(data);
}
