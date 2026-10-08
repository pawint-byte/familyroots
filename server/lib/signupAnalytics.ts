import { randomUUID } from "node:crypto";
import type { Response } from "express";
import { SIGNUP_ANALYTICS_COOKIE, type SignUpMethod } from "../../shared/signup-analytics";

export function recordSignUpAnalytics(res: Response, method: SignUpMethod): void {
  // Analytics must never change the outcome of account creation or authentication.
  try {
    res.cookie(SIGNUP_ANALYTICS_COOKIE, `${randomUUID()}.${method}`, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60 * 1000,
    });
  } catch {
    console.warn("GA4 signup signal could not be issued");
  }
}
