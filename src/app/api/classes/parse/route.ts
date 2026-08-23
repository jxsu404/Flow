import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseScheduleDocument } from "@/lib/ai/parse-schedule";
import { hasGemini } from "@/lib/ai/flow-agent";
import { isAllowedImportFile, mimeFromFile } from "@/lib/schedule-import";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  if (!hasGemini()) {
    return NextResponse.json(
      { error: "Falta GEMINI_API_KEY. Créala en Google AI Studio y agrégala al proyecto." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Sube una imagen o un PDF de tu horario." }, { status: 400 });
  }

  const allowed = isAllowedImportFile(file);
  if (!allowed.ok) {
    return NextResponse.json({ error: allowed.error }, { status: 400 });
  }

  try {
    const buffer = new Uint8Array(await file.arrayBuffer());
    const parsed = await parseScheduleDocument({
      data: buffer,
      mediaType: mimeFromFile(file),
    });

    if (parsed.classes.length === 0) {
      return NextResponse.json({
        documentWarning:
          parsed.documentWarning ??
          "No pude identificar clases en ese documento. Prueba con una foto más nítida o un PDF más claro.",
        classes: [],
      });
    }

    return NextResponse.json(parsed);
  } catch {
    return NextResponse.json(
      {
        error:
          "No pude analizar ese horario. Si la imagen está borrosa o el PDF es extraño, prueba con otra captura.",
      },
      { status: 422 },
    );
  }
}
