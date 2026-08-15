import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { commandLogs, users } from "@/db/schema";
import { createFlowAgent, hasGemini } from "@/lib/ai/flow-agent";
import { DEFAULT_TIMEZONE } from "@/lib/datetime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!hasGemini()) {
    return NextResponse.json(
      {
        error:
          "Falta GEMINI_API_KEY. Créala gratis en Google AI Studio y agrégala a .env.local.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json()) as { text?: string; source?: "voice" | "text" };
  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Escribe o dicta un comando." }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const timeZone = user?.timezone || DEFAULT_TIMEZONE;
  const source = body.source === "voice" ? "voice" : "text";

  const agent = createFlowAgent({ userId, timeZone, source });
  const result = await agent.generate({ prompt: text });

  await db.insert(commandLogs).values({
    userId,
    transcript: text,
    source,
    result: result.text,
  });

  return NextResponse.json({
    message: result.text,
    source,
  });
}
