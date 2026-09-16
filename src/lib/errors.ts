import { ZodError } from "zod";

export class CrmError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const forbidden = (message = "You don't have permission to do that.") => new CrmError(403, message);

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  details?: string[];
  /** A one-time secret (API key, webhook secret) to show the user once. */
  secret?: string;
  /** A one-time list of secrets (2FA recovery codes) to show the user once. */
  secrets?: string[];
  /** Set by loginAction when the account has 2FA on and a code is still needed. */
  need2fa?: boolean;
};

function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

export function errorToActionState(err: unknown): ActionState {
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of err.issues) {
      const key = String(issue.path[0] ?? "form");
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { error: "Please fix the highlighted fields.", fieldErrors };
  }
  if (err instanceof CrmError) return { error: err.message };
  if (isUniqueViolation(err)) return { error: "A record with that value already exists." };
  console.error(err);
  return { error: "Something went wrong. Please try again." };
}

export function errorToResponse(err: unknown) {
  if (err instanceof ZodError) {
    return Response.json({ error: "Validation failed", details: err.issues }, { status: 422 });
  }
  if (err instanceof CrmError) return Response.json({ error: err.message }, { status: err.status });
  if (isUniqueViolation(err)) return Response.json({ error: "Duplicate value" }, { status: 409 });
  console.error(err);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}
