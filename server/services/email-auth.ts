import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const keyBuffer = Buffer.from(key, "hex");
  return timingSafeEqual(derivedKey, keyBuffer);
}

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 254;
}

export function validatePassword(password: string): { valid: boolean; message: string } {
  if (password.length < 8)
    return { valid: false, message: "Password must be at least 8 characters long" };
  if (password.length > 128)
    return { valid: false, message: "Password must be less than 128 characters" };
  if (!/[A-Z]/.test(password))
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  if (!/[a-z]/.test(password))
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  if (!/[0-9]/.test(password))
    return { valid: false, message: "Password must contain at least one number" };
  return { valid: true, message: "" };
}
