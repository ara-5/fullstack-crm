import "server-only";
import { errorToActionState, type ActionState } from "@/lib/errors";

/** Runs a mutation and converts thrown errors into form-friendly state. */
export async function attempt(fn: () => Promise<unknown>): Promise<ActionState> {
  try {
    await fn();
    return { ok: true };
  } catch (err) {
    return errorToActionState(err);
  }
}
