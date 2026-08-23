"use client";

import { Mic, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognition(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function CommandBar({ featured = false }: { featured?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [pending, setPending] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);
  const sourceRef = useRef<"voice" | "text">("text");
  const textRef = useRef("");

  async function submit(value: string, source: "voice" | "text") {
    const trimmed = value.trim();
    if (!trimmed || pending) return;
    setPending(true);
    try {
      const response = await fetch("/api/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, source }),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "No pude procesar el comando");
        return;
      }
      setLastMessage(data.message ?? "Listo.");
      setText("");
      textRef.current = "";
      toast.success("Flow organizó tu comando");
      router.refresh();
    } catch {
      toast.error("Error de red al hablar con Flow");
    } finally {
      setPending(false);
    }
  }

  function toggleVoice() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      toast.error("Tu navegador no soporta dictado. Usa Chrome o escribe el comando.");
      return;
    }
    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }
    const recognition = new Ctor();
    recognition.lang = "es-CR";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      textRef.current = transcript;
      setText(transcript);
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      const value = textRef.current;
      if (value.trim()) {
        sourceRef.current = "voice";
        void submit(value, "voice");
      }
    };
    recognitionRef.current = recognition;
    sourceRef.current = "voice";
    setListening(true);
    recognition.start();
  }

  const status = listening
    ? "Escuchando… habla con naturalidad."
    : lastMessage;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border/80 bg-card/80 shadow-sm",
        featured ? "p-5 md:p-6" : "p-4",
      )}
    >
      {featured ? (
        <div className="mb-4">
          <h1 className="text-2xl font-semibold tracking-tight">¿Qué tienes pendiente?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escribe lo que necesitas hacer. Flow organiza y sincroniza todo por ti.
          </p>
        </div>
      ) : null}
      <form
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(text, sourceRef.current);
          sourceRef.current = "text";
        }}
      >
        <Button
          type="button"
          size="icon-lg"
          variant={listening ? "destructive" : "secondary"}
          onClick={toggleVoice}
          aria-label={listening ? "Detener dictado" : "Hablar"}
        >
          {listening ? <Square className="size-4" /> : <Mic className="size-4" />}
        </Button>
        <Input
          value={text}
          onChange={(event) => {
            sourceRef.current = "text";
            textRef.current = event.target.value;
            setText(event.target.value);
          }}
          placeholder="Tengo que entregar el proyecto de programación el jueves a las 5..."
          className={cn("flex-1", featured ? "h-12 text-base md:text-base" : "h-11")}
          disabled={pending}
        />
        <Button type="submit" className={cn("px-5", featured ? "h-12" : "h-11")} disabled={pending || !text.trim()}>
          {pending ? "Organizando…" : "Enviar"}
        </Button>
      </form>
      {status || !featured ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {status ?? "Habla o escribe. Flow entiende, organiza y sincroniza."}
        </p>
      ) : null}
    </section>
  );
}
