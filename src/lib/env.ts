export function googleClientId() {
  return process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID;
}

export function googleClientSecret() {
  return process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
}

export function geminiApiKey() {
  return process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

export function authSecret() {
  return process.env.AUTH_SECRET;
}
