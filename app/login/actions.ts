"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSession, sessionMaxAge, validateCredentials } from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Masukkan email dan password untuk melanjutkan." };
  if (!validateCredentials(email, password)) return { error: "Email atau password tidak valid." };

  (await cookies()).set("market_briefing_session", await createSession(email), {
    httpOnly: true,
    maxAge: sessionMaxAge,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/dashboard");
}
