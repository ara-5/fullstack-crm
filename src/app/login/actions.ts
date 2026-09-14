"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { signIn } from "@/lib/auth";
import type { ActionState } from "@/lib/errors";
import { safePath } from "@/lib/utils";

export async function loginAction(formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: safePath(formData.get("callbackUrl")),
    });
  } catch (err) {
    if (err instanceof CredentialsSignin && err.code === "rate_limited") {
      return { error: "Too many failed attempts. Please try again in 15 minutes." };
    }
    if (err instanceof AuthError) return { error: "Invalid email or password." };
    throw err; // lets Next.js perform the success redirect
  }
  return { ok: true };
}
