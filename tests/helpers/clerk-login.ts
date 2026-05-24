import type { Page } from "@playwright/test";
import fs from "fs";
import path from "path";

function loadEnvLocal(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, "utf8")
      .split("\n")
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i), l.slice(i + 1)] as [string, string];
      })
  );
}

/** Resuelve userId de Clerk por email (API Backend). */
export async function getClerkUserIdByEmail(email: string): Promise<string> {
  const env = { ...loadEnvLocal(), ...process.env };
  const key = env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY no configurada");

  const res = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}&limit=1`,
    { headers: { Authorization: `Bearer ${key}` } }
  );
  const users = (await res.json()) as Array<{ id: string }>;
  if (!users[0]?.id) throw new Error(`Usuario Clerk no encontrado: ${email}`);
  return users[0].id;
}

/** Crea sign-in token (bypass Client Trust en E2E). */
export async function createClerkSignInToken(userId: string): Promise<string> {
  const env = { ...loadEnvLocal(), ...process.env };
  const key = env.CLERK_SECRET_KEY;
  if (!key) throw new Error("CLERK_SECRET_KEY no configurada");

  const res = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, expires_in_seconds: 300 }),
  });
  const data = (await res.json()) as { token?: string };
  if (!data.token) throw new Error("No se pudo crear sign-in token de Clerk");
  return data.token;
}

/**
 * Login E2E vía ticket de Clerk (evita Client Trust / CAPTCHA en dispositivos nuevos).
 * Passes email via URL so upsertCurrentUser can merge old records when JWT lacks email claim.
 */
export async function loginWithClerkTicket(page: Page, email: string): Promise<void> {
  const userId = await getClerkUserIdByEmail(email);
  const ticket = await createClerkSignInToken(userId);
  await page.goto(
    `/login?__clerk_ticket=${encodeURIComponent(ticket)}&__email=${encodeURIComponent(email)}`
  );
  await page.waitForURL((url) => !url.toString().includes("/login"), { timeout: 25000 });
}
