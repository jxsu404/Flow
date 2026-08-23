# Flow

Organizador personal y académico en español: **hablar → entiende → organiza → sincroniza → recuerda**.

Flow no es otra lista de tareas. Interpreta el momento del día y responde a una sola pregunta: *¿qué sería bueno hacer ahora?*

Corre entero en planes **gratis** (Vercel Hobby, Neon Free, Google OAuth Testing, Gemini Flash de AI Studio, Open-Meteo). No hace falta tarjeta.

## Qué hace

- **Dictar o escribir en español**: tareas, entregas, exámenes, eventos y clases. Gemini extrae fecha, hora, materia y tipo.
- **HOY interpretado**: en lugar de mostrar datos crudos, Flow lee el contexto (periodo del día, plazos, clases restantes, tareas hechas, clima) y escribe una frase breve con la conclusión del momento.
- **Horario semanal y mensual**: clases, tareas con hora y eventos de Calendar en una cuadrícula con la línea de "ahora".
- **Google Calendar**: crear, editar y borrar eventos y recordatorios; el tiempo ocupado de Calendar entra en el cálculo.
- **Tiempo libre real**: huecos entre clases, eventos y trabajo con horario, dentro de la ventana despierta (07:00–22:00).
- **Entregas y exámenes** ordenados por urgencia, con etiquetas de días restantes.
- **Importar horario** desde una imagen o PDF, y **exportarlo** como imagen o PDF.

Todavía **no** agenda las tareas dentro de los huecos automáticamente. Eso queda para después.

## Cómo se ve HOY

Flow detecta el periodo vigente y muestra solo ese: Mañana (07:00–12:00), Tarde (12:00–18:00) o Noche (18:00–22:00). Sobre eso arma una conclusión y una frase:

| Contexto real | Lo que dice Flow |
| --- | --- |
| Tarde tranquila, entrega hoy 23:59 | "Aún tienes tiempo para entregar Tarea de Conta hoy." |
| Tarde lluviosa, entrega hoy | "Una tarde lluviosa perfecta para avanzar en Contabilidad antes de que llegue la noche." |
| 21:30, entrega a medianoche | "Quedan 2 horas para Tarea de Conta. No lo dejes para después." |
| Entrega vencida | "Quiz de física ya venció y sigue pendiente." |
| Sin pendientes | "No tienes pendientes importantes ahora. Disfruta el resto de tu tarde." |

Las reglas del generador (`src/lib/today-phrase.ts`):

- Prioridad: vencido → plazo inminente → plazo cercano → entregas de hoy → exámenes → clases próximas → otras tareas → tiempo libre. El clima y el momento del día **enriquecen**, nunca tapan una obligación.
- No inventa nada: si no hay tarea, no menciona tareas; si no hay dato de clima, no menciona clima.
- Variedad léxica: varias redacciones por contexto, elegidas con una semilla estable dentro de la misma hora (no cambia en cada render, sí a lo largo del día).
- Tono calmado. Nada de coach agresivo ni emojis gritando.

## Clima

Open-Meteo, **sin API key ni variable de entorno**.

- La ubicación sale de la geolocalización que Vercel adjunta a cada request (`x-vercel-ip-latitude` / `longitude` / `city`).
- En local, o si esos headers no llegan, se usa el huso horario del usuario como respaldo.
- Si el huso no está en la tabla, o la API falla o tarda, Flow se queda **sin clima** en lugar de inventarlo.
- Respuesta cacheada 15 minutos y deduplicada por request.

## Stack

- Next.js 16 (App Router) + Tailwind CSS 4 + shadcn/ui
- Auth.js (Auth.js v5) + Google OAuth
- Neon Postgres + Drizzle ORM
- Gemini 3.7 Flash vía AI SDK (`GEMINI_API_KEY` de [Google AI Studio](https://aistudio.google.com))
- Web Speech API (`es-CR`) con texto como alternativa
- Open-Meteo para el clima
- `node:test` + `tsx` para las pruebas

## Estructura

```
src/
  app/            rutas (App Router): /app, /app/tareas, /app/horario, /api/*
  components/     UI: dashboard, hero de HOY, timeline del periodo, horario semanal
  lib/
    today-insight.ts    prioriza el contexto del día y elige la situación
    today-phrase.ts     redacta la frase (variantes, clima, tono)
    weather.ts          Open-Meteo + ubicación de la request
    availability.ts     ventana despierta, periodos y huecos libres
    day-plan.ts         plan del día: bloques ocupados, libres y sugerencias
    day-status.ts       clasifica el día (libre / parcial / ocupado)
    deadlines.ts        urgencia y tipo de cada obligación
    calendar/google.ts  sincronización con Google Calendar
    ai/                 agente Gemini y parseo de comandos
  db/             esquema Drizzle
```

## Arranque local ($0)

1. Copia `.env.example` a `.env.local`.
2. Genera un secreto: `openssl rand -base64 32` → `AUTH_SECRET`.
3. Crea un proyecto en [Neon](https://neon.tech) (plan Free) y pega `DATABASE_URL` (pooler).
4. En Google Cloud, **sin facturación**:
   - OAuth consent screen en modo **Testing**
   - Credenciales OAuth (aplicación web)
   - Redirect: `http://localhost:3000/api/auth/callback/google`
   - Habilita **Google Calendar API**
   - Scopes: `openid`, `email`, `profile`, `https://www.googleapis.com/auth/calendar.events`
5. Crea una API key en [AI Studio](https://aistudio.google.com/app/apikey) → `GEMINI_API_KEY`.
6. Instala y sube el esquema:

```bash
npm install
npm run db:push
npm run dev
```

Abre `http://localhost:3000`, entra con Google y prueba:

> Tengo que entregar el proyecto de programación el jueves a las 5.

> El viernes tengo examen de matemáticas y necesito estudiar tres horas.

> Lunes matemáticas de 8 a 10.

> ¿Cuándo tengo tiempo libre mañana?

## Scripts

```bash
npm run dev        # desarrollo
npm run build      # build de producción
npm run test       # pruebas de la lógica (node:test)
npm run lint       # eslint
npm run db:push    # sube el esquema a Neon
```

## Deploy en Vercel Hobby

1. Importa el repo en Vercel (rama de producción: `main`).
2. Configura las mismas env vars. `AUTH_URL` = `https://tu-proyecto.vercel.app`.
3. Añade el redirect de producción en Google Cloud: `https://tu-proyecto.vercel.app/api/auth/callback/google`.
4. En Neon, permite IPs de Vercel o usa el pooler público.

La primera petición tras ~5 minutos idle puede tardar un poco: Neon Free se duerme y despierta solo.

## Error 403 `access_denied` al entrar con Google

Eso **no** es el redirect. Google rechaza el consentimiento (casi siempre por Testing + Calendar).

1. [Google Auth Platform → Audience](https://console.cloud.google.com/auth/audience): el estado debe ser **Testing**. **No** publiques la app (sin verificación, Calendar se bloquea).
2. En **Test users**, añade el Gmail con el que vas a entrar (aunque sea el dueño del proyecto). Guarda.
3. [APIs y servicios → Biblioteca](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com): activa **Google Calendar API**.
4. [Data Access / Scopes](https://console.cloud.google.com/auth/scopes): añade
   `https://www.googleapis.com/auth/calendar.events`
5. Espera 1–2 minutos. Prueba en una ventana de incógnito. En la pantalla de Google pulsa **Permitir** (incluye Calendar; no canceles).
6. Si ya habías denegado el acceso: [apps con acceso a tu cuenta](https://myaccount.google.com/permissions) → quita Flow / el cliente OAuth → vuelve a entrar.

## Cuotas a tener en cuenta

- **Gemini Flash:** límite diario/minuto del plan gratuito de AI Studio.
- **Neon Free:** 0.5 GB y 100 CU-h/mes; scale to zero a los 5 min.
- **Vercel Hobby:** suficiente para un MVP personal.
- **Google OAuth Testing:** hasta 100 testers.
- **Open-Meteo:** uso no comercial sin key.

Si se acaba la cuota de Gemini, puedes cambiar el modelo en `src/lib/ai/flow-agent.ts` por otro Flash gratuito (`gemini-flash-latest` o `gemini-3.5-flash-lite`) o, como fallback, Groq.
