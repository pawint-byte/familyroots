import assert from "node:assert/strict";
import { test } from "node:test";
import { registerSchema } from "../client/src/lib/register-validation";

const validRegistration = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  password: "Password1",
  confirmPassword: "Password1",
};

function issuesFor(input: unknown) {
  const result = registerSchema.safeParse(input);
  assert.equal(result.success, false);
  return result.error.issues;
}

test("registration requires an email address", () => {
  assert.equal(
    issuesFor({ ...validRegistration, email: "" }).find(({ path }) => path[0] === "email")?.message,
    "Email is required",
  );
});

test("registration requires a confirmation password", () => {
  assert.equal(
    issuesFor({ ...validRegistration, confirmPassword: "" }).find(({ path }) => path[0] === "confirmPassword")?.message,
    "Please confirm your password",
  );
});

test("registration confirmation must match the password", () => {
  assert.equal(
    issuesFor({ ...validRegistration, confirmPassword: "Password2" }).find(({ path }) => path[0] === "confirmPassword")?.message,
    "Passwords don't match",
  );
});

test("registration password validation matches server requirements", () => {
  for (const [password, message] of [
    ["short", "Password must be at least 8 characters"],
    ["password1", "Password must contain at least one uppercase letter"],
    ["PASSWORD1", "Password must contain at least one lowercase letter"],
    ["Password", "Password must contain at least one number"],
  ] as const) {
    assert.equal(
      issuesFor({ ...validRegistration, password, confirmPassword: password }).find(({ path }) => path[0] === "password")?.message,
      message,
    );
  }

  const longPassword = `Password1${"x".repeat(120)}`;
  assert.equal(
    issuesFor({ ...validRegistration, password: longPassword, confirmPassword: longPassword }).find(({ path }) => path[0] === "password")?.message,
    "Password must be 128 characters or fewer",
  );
});