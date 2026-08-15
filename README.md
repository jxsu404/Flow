# Flow

Aplicación web de organización personal: **hablar → entiende → organiza → sincroniza → recuerda**.

El MVP corre entero en planes **gratis** (Vercel Hobby, Neon Free, Google OAuth Testing, Gemini Flash de AI Studio). No hace falta tarjeta.

## Qué hace

- Dictar o escribir en español: tareas, entregas, exámenes y eventos
- Horario de clases semanal como tiempo ocupado
- Crear/editar/borrar eventos y recordatorios en **Google Calendar**
- Mostrar huecos libres (clases + Calendar + tareas con horario)
- Dashboard: qué hay hoy y qué hacer primero

Todavía **no** agenda solo las tareas dentro de los huecos. Eso queda para después.

## Stack

- Next.js (App Router) + Auth.js + Google
- Neon Postgres + Drizzle
- Gemini 3.7 Flash (`GEMINI_API_KEY` de [Google AI Studio](https://aistudio.google.com))
- Web Speech API (`es-CR`) + texto como fallback

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

## Deploy en Vercel Hobby

1. Importa el repo. Dominio `*.vercel.app` (sin comprar dominio).
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

Si se acaba la cuota de Gemini, puedes cambiar el modelo en `src/lib/ai/flow-agent.ts` por otro Flash gratuito (`gemini-flash-latest` o `gemini-3.5-flash-lite`) o, como fallback, Groq.
