"use client";

import { Mic, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

export function CommandBar() {
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

  return (
    <section className="rounded-2xl border border-border/80 bg-card/80 p-4 shadow-sm">
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
          placeholder='Prueba: “Tengo que entregar el proyecto de programación el jueves a las 5.”'
          className="h-11 flex-1"
          disabled={pending}
        />
        <Button type="submit" className="h-11 px-5" disabled={pending || !text.trim()}>
          {pending ? "Organizando…" : "Enviar"}
        </Button>
      </form>
      <p className="mt-3 text-sm text-muted-foreground">
        {listening
          ? "Escuchando… habla con naturalidad."
          : lastMessage ?? "Habla o escribe. Flow entiende, organiza y sincroniza."}
      </p>
    </section>
  );
}
