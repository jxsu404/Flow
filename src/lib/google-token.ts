import { and, eq } from "drizzle-orm";
import { accounts } from "@/db/schema";
import { getDb } from "@/db";
import { googleClientId, googleClientSecret } from "./env";

export async function getGoogleAccessToken(userId: string): Promise<string | null> {
  const db = getDb();
  const [account] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .limit(1);

  if (!account) return null;

  const stillValid =
    account.access_token &&
    account.expires_at &&
    account.expires_at * 1000 > Date.now() + 60_000;

  if (stillValid && account.access_token) {
    return account.access_token;
  }

  if (!account.refresh_token) return account.access_token ?? null;

  const clientId = googleClientId();
  const clientSecret = googleClientSecret();
  if (!clientId || !clientSecret) return account.access_token ?? null;

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: account.refresh_token,
    }),
  });

  if (!response.ok) {
    return null;
  }

  const tokens = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  await db
    .update(accounts)
    .set({
      access_token: tokens.access_token,
      expires_at: Math.floor(Date.now() / 1000 + tokens.expires_in),
      refresh_token: tokens.refresh_token ?? account.refresh_token,
    })
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));

  return tokens.access_token;
}

export async function isCalendarConnected(userId: string): Promise<boolean> {
  const db = getDb();
  const [account] = await db
    .select({
      refresh: accounts.refresh_token,
      access: accounts.access_token,
      scope: accounts.scope,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")))
    .limit(1);

  if (!account) return false;
  const scope = account.scope ?? "";
  const hasCalendar = scope.includes("calendar");
  return Boolean((account.refresh || account.access) && hasCalendar);
}
