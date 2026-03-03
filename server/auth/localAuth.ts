import { Express } from "express";
import crypto from "crypto";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq, sql } from "drizzle-orm";

const SCRYPT_KEYLEN = 64;
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

const PASSWORD_RULES = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
};

function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_RULES.minLength) {
    return `Password must be at least ${PASSWORD_RULES.minLength} characters`;
  }
  if (PASSWORD_RULES.requireUppercase && !/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (PASSWORD_RULES.requireLowercase && !/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (PASSWORD_RULES.requireNumber && !/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString("hex");
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      resolve(`${salt}:${derivedKey.toString("hex")}`);
    });
  });
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEYLEN, (err, derivedKey) => {
      if (err) reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(hash, "hex"), derivedKey));
    });
  });
}

export function setupLocalAuth(app: Express) {
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }

      const normalizedEmail = email.toLowerCase().trim();

      const [existingUser] = await db.select().from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`);

      if (existingUser) {
        if (existingUser.passwordHash) {
          return res.status(409).json({ message: "An account with this email already exists. Please sign in." });
        }
        const passwordHash = await hashPassword(password);
        const emailVerifyToken = crypto.randomBytes(32).toString("hex");
        const [updated] = await db.update(users)
          .set({
            passwordHash,
            authProvider: "email",
            emailVerified: false,
            emailVerifyToken,
            firstName: existingUser.firstName || firstName,
            lastName: existingUser.lastName || lastName,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id))
          .returning();

        await setLocalSession(req, updated.id);
        await sendVerificationEmail(normalizedEmail, firstName || existingUser.firstName || "there", emailVerifyToken);
        return res.json({ user: sanitizeUser(updated), emailVerificationSent: true });
      }

      const passwordHash = await hashPassword(password);
      const emailVerifyToken = crypto.randomBytes(32).toString("hex");
      const [newUser] = await db.insert(users)
        .values({
          email: normalizedEmail,
          firstName: firstName || null,
          lastName: lastName || null,
          passwordHash,
          authProvider: "email",
          emailVerified: false,
          emailVerifyToken,
        })
        .returning();

      await setLocalSession(req, newUser.id);
      await sendVerificationEmail(normalizedEmail, firstName || "there", emailVerifyToken);

      res.status(201).json({ user: sanitizeUser(newUser), emailVerificationSent: true });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const normalizedEmail = email.toLowerCase().trim();

      const [user] = await db.select().from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`);

      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.passwordHash) {
        return res.status(401).json({
          message: "This account uses Replit authentication. Please sign in with Replit, or use 'Forgot Password' to set a password."
        });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      await setLocalSession(req, user.id);

      await db.update(users)
        .set({ lastActivityAt: new Date() })
        .where(eq(users.id, user.id));

      res.json({ user: sanitizeUser(user) });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => {
      req.session.destroy(() => {
        res.clearCookie("connect.sid");
        res.json({ success: true });
      });
    });
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "Verification token is required" });
      }

      const [user] = await db.select().from(users)
        .where(eq(users.emailVerifyToken, token));

      if (!user) {
        return res.status(400).json({ message: "Invalid verification link" });
      }

      await db.update(users)
        .set({
          emailVerified: true,
          emailVerifyToken: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "familyroots.family";
      res.redirect(`https://${domain}/login?verified=true`);
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post("/api/auth/resend-verification", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const [user] = await db.select().from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`);

      if (!user || user.emailVerified) {
        return res.json({ message: "If the email exists and is unverified, a verification link has been sent." });
      }

      const emailVerifyToken = crypto.randomBytes(32).toString("hex");
      await db.update(users)
        .set({ emailVerifyToken })
        .where(eq(users.id, user.id));

      await sendVerificationEmail(normalizedEmail, user.firstName || "there", emailVerifyToken);
      res.json({ message: "If the email exists and is unverified, a verification link has been sent." });
    } catch (error: any) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification" });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const normalizedEmail = email.toLowerCase().trim();
      const [user] = await db.select().from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`);

      if (!user) {
        return res.json({ message: "If an account exists with that email, a reset link has been sent." });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

      await db.update(users)
        .set({
          passwordResetToken: tokenHash,
          passwordResetExpires: expires,
        })
        .where(eq(users.id, user.id));

      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "familyroots.family";
      const resetUrl = `https://${domain}/reset-password?token=${token}`;

      try {
        const { sendEmail } = await import("../lib/email");
        await sendEmail(
          normalizedEmail,
          "Reset Your FamilyRoots Password",
          `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Reset Your Password</h1>
            <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
              Hi ${user.firstName || "there"},
            </p>
            <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
              We received a request to reset your FamilyRoots password. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 14px; color: #6a6a6a; line-height: 1.6;">
              This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
            <p style="font-size: 12px; color: #999;">FamilyRoots &mdash; Your Private Network for Real Connections</p>
          </div>
          `
        );
      } catch (e) {
        console.error("Failed to send password reset email:", e);
      }

      res.json({ message: "If an account exists with that email, a reset link has been sent." });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      const passwordError = validatePassword(password);
      if (passwordError) {
        return res.status(400).json({ message: passwordError });
      }

      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

      const [user] = await db.select().from(users)
        .where(eq(users.passwordResetToken, tokenHash));

      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      const passwordHash = await hashPassword(password);

      await db.update(users)
        .set({
          passwordHash,
          authProvider: user.authProvider === "replit" ? "both" : "email",
          passwordResetToken: null,
          passwordResetExpires: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      res.json({ message: "Password has been reset. You can now sign in." });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post("/api/admin/users/:id/reset-password", async (req: any, res) => {
    try {
      const adminId = req.user?.claims?.sub;
      if (!adminId) return res.status(401).json({ message: "Unauthorized" });

      const adminEmails = (process.env.ADMIN_EMAILS_LIST || "pawint@me.com").split(",").map((e: string) => e.trim().toLowerCase());
      const adminIds = (process.env.ADMIN_USER_IDS_LIST || "52852375").split(",").map((i: string) => i.trim());

      const [admin] = await db.select().from(users).where(eq(users.id, adminId));
      const isAdmin = adminIds.includes(adminId) || (admin?.email && adminEmails.includes(admin.email.toLowerCase()));
      if (!isAdmin) return res.status(403).json({ message: "Forbidden" });

      const { id } = req.params;
      const [targetUser] = await db.select().from(users).where(eq(users.id, id));
      if (!targetUser || !targetUser.email) {
        return res.status(404).json({ message: "User not found or has no email" });
      }

      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

      await db.update(users)
        .set({
          passwordResetToken: tokenHash,
          passwordResetExpires: expires,
        })
        .where(eq(users.id, id));

      const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "familyroots.family";
      const resetUrl = `https://${domain}/reset-password?token=${token}`;

      try {
        const { sendEmail } = await import("../lib/email");
        await sendEmail(
          targetUser.email,
          "Password Reset - FamilyRoots",
          `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Password Reset</h1>
            <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
              Hi ${targetUser.firstName || "there"},
            </p>
            <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
              An administrator has initiated a password reset for your FamilyRoots account. Click the button below to set a new password:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Set New Password
              </a>
            </div>
            <p style="font-size: 14px; color: #6a6a6a; line-height: 1.6;">
              This link expires in 1 hour. If you didn't expect this, contact support.
            </p>
            <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
            <p style="font-size: 12px; color: #999;">FamilyRoots &mdash; Your Private Network for Real Connections</p>
          </div>
          `
        );
      } catch (e) {
        console.error("Failed to send admin-initiated reset email:", e);
      }

      res.json({ message: "Password reset email sent to user" });
    } catch (error: any) {
      console.error("Admin reset password error:", error);
      res.status(500).json({ message: "Failed to send reset" });
    }
  });
}

function setLocalSession(req: any, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user: any = {
      claims: { sub: userId },
      authMethod: "email",
      expires_at: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60),
    };
    req.login(user, (err: any) => {
      if (err) {
        console.error("Session login error:", err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

function sanitizeUser(user: any) {
  const { passwordHash, passwordResetToken, passwordResetExpires, emailVerifyToken, ...safe } = user;
  return safe;
}

async function sendVerificationEmail(email: string, name: string, token: string) {
  try {
    const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || "familyroots.family";
    const verifyUrl = `https://${domain}/api/auth/verify-email?token=${token}`;

    const { sendEmail } = await import("../lib/email");
    await sendEmail(
      email,
      "Verify Your FamilyRoots Email",
      `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Welcome to FamilyRoots!</h1>
        <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
          Thanks for signing up. Please verify your email address by clicking the button below:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Verify Email
          </a>
        </div>
        <p style="font-size: 14px; color: #6a6a6a; line-height: 1.6;">
          If you didn't create an account, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999;">FamilyRoots &mdash; Your Private Network for Real Connections</p>
      </div>
      `
    );
  } catch (e) {
    console.error("Failed to send verification email:", e);
  }
}
