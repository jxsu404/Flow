import { GoogleSignIn } from "@/components/google-sign-in";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Organización personal</p>
      <h1 className="mt-4 text-5xl font-semibold tracking-tight md:text-6xl">Flow</h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Di lo que tienes que hacer. Flow lo entiende, lo organiza, lo pone en Google Calendar
        y te muestra cuándo tienes tiempo de verdad.
      </p>
      <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
        <li>Hablar o escribir → tareas, entregas y exámenes</li>
        <li>Horario de clases como compromisos fijos</li>
        <li>Huecos libres a partir de clases + Calendar</li>
      </ul>
      <div className="mt-10">
        <GoogleSignIn />
        <p className="mt-3 text-xs text-muted-foreground">
          Entras con Google (gratis). Flow pide permiso para crear eventos y recordatorios.
        </p>
      </div>
    </main>
  );
}
