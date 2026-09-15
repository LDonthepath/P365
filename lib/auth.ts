import "server-only";

const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function getRequiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be configured before using the dashboard.`);
  }
  return value;
}

function toBase64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getRequiredEnvironment("DASHBOARD_AUTH_SECRET")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(signature).toString("base64url");
}

export async function createSession(email: string): Promise<string> {
  const payload = toBase64Url(JSON.stringify({ email, expiresAt: Date.now() + SESSION_DURATION_SECONDS * 1000 }));
  return `${payload}.${await sign(payload)}`;
}

export async function verifySession(token?: string): Promise<{ email: string } | null> {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || signature !== (await sign(payload))) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(payload)) as { email?: string; expiresAt?: number };
    if (!parsed.email || !parsed.expiresAt || parsed.expiresAt < Date.now()) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

export function validateCredentials(email: string, password: string): boolean {
  return email === getRequiredEnvironment("DASHBOARD_ACCESS_EMAIL")
    && password === getRequiredEnvironment("DASHBOARD_ACCESS_PASSWORD");
}

export const sessionMaxAge = SESSION_DURATION_SECONDS;
