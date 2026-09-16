import { Express, RequestHandler } from "express";
import { db } from "../db";
import { users } from "@shared/models/auth";
import { eq, sql, ilike, or } from "drizzle-orm";
import {
  hashPassword,
  verifyPassword,
  generateToken,
  validateEmail,
  validatePassword,
} from "../services/email-auth";
import {
  normalizeSignupAttribution,
  optionalSignupAttributionSchema,
} from "@shared/signup-attribution";
import { attributionInsertFields, parseAttribution } from "../lib/attribution";

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const MIGRATION_TOKEN_EXPIRY_MS = 72 * 60 * 60 * 1000;

function getEmailDomain(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",") || [];
  const productionDomain = domains.find(d => !d.includes(".spock.replit.dev") && !d.includes(".replit.dev"));
  return productionDomain || domains[0] || "familyroots.family";
}

export const isAdmin: RequestHandler = async (req: any, res, next) => {
  const userId = req.user?.claims?.sub;
  if (!userId) return res.status(403).json({ message: "Forbidden" });
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.isAdmin) return res.status(403).json({ message: "Forbidden" });
  next();
};

export function setupLocalAuth(app: Express) {
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password || !firstName) {
        return res.status(400).json({ message: "Email, password, and first name are required" });
      }

      if (!validateEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ message: passwordCheck.message });
      }

      const attributionResult = optionalSignupAttributionSchema.safeParse({
        heardVia: req.body.heardVia,
        heardViaOther: req.body.heardViaOther,
      });
      if (!attributionResult.success) {
        return res.status(400).json({
          message: attributionResult.error.errors[0]?.message || "Invalid signup attribution",
        });
      }
      const attribution = normalizeSignupAttribution(attributionResult.data);
      const cobAttribution = parseAttribution(req.body.attribution);
      const cobAttributionFields = attributionInsertFields(cobAttribution);
      const normalizedEmail = email.toLowerCase().trim();

      const [existingUser] = await db.select().from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`);

      if (existingUser) {
        if (existingUser.passwordHash) {
          return res.status(409).json({ message: "An account with this email already exists" });
        }
        const hashedPassword = await hashPassword(password);
        const verifyToken = generateToken();
        await db.update(users)
          .set({
            passwordHash: hashedPassword,
            authProvider: "email",
            emailVerified: false,
            emailVerifyToken: verifyToken,
            firstName: existingUser.firstName || firstName,
            lastName: existingUser.lastName || lastName || null,
            heardVia: existingUser.heardVia || attribution.heardVia,
            heardViaOther: existingUser.heardViaOther || attribution.heardViaOther,
            attribution: existingUser.attribution || cobAttributionFields.attribution,
            utmSource: existingUser.utmSource || cobAttributionFields.utmSource,
            utmMedium: existingUser.utmMedium || cobAttributionFields.utmMedium,
            utmCampaign: existingUser.utmCampaign || cobAttributionFields.utmCampaign,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingUser.id));

        await sendVerificationEmail(req, normalizedEmail, firstName || existingUser.firstName || "there", verifyToken);
        return res.status(201).json({
          message: "Account created! Please check your email to verify your address before logging in.",
          requiresVerification: true,
        });
      }

      const hashedPassword = await hashPassword(password);
      const verifyToken = generateToken();
      await db.insert(users)
        .values({
          email: normalizedEmail,
          firstName: firstName || null,
          lastName: lastName || null,
          passwordHash: hashedPassword,
          authProvider: "email",
          emailVerified: false,
          emailVerifyToken: verifyToken,
          ...attribution,
          ...cobAttributionFields,
        });

      await sendVerificationEmail(req, normalizedEmail, firstName || "there", verifyToken);

      res.status(201).json({
        message: "Account created! Please check your email to verify your address before logging in.",
        requiresVerification: true,
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/register", async (req, res) => {
    return (app as any)._router.handle(
      Object.assign(req, { url: "/api/auth/signup", method: "POST" }),
      res,
      () => {}
    );
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
        return res.status(200).json({
          message: "No account found with that email. Would you like to sign up?",
          code: "NO_ACCOUNT",
        });
      }

      if (!user.passwordHash) {
        const resetToken = generateToken();
        const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);
        const domain = getEmailDomain();
        const resetUrl = `https://${domain}/reset-password/${resetToken}`;

        await db.update(users)
          .set({
            passwordResetToken: resetToken,
            passwordResetExpires: expires,
          })
          .where(eq(users.id, user.id));

        let emailSent = false;
        try {
          const { sendEmail } = await import("../lib/email");
          const emailResult = await sendEmail(
            normalizedEmail,
            "Set Up Your FamilyRoots Password",
            `
            <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Set Up Your Password</h1>
              <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
                Hey ${user.firstName || "there"},
              </p>
              <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
                FamilyRoots now supports direct email/password login. Click the button below to set your password:
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                  Set Password
                </a>
              </div>
              <p style="font-size: 14px; color: #6a6a6a; line-height: 1.6;">
                This link expires in 1 hour.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
              <p style="font-size: 12px; color: #999;">FamilyRoots &mdash; Your Private Network for Real Connections</p>
            </div>
            `
          );
          console.log("[auth] Migration email result:", JSON.stringify(emailResult));
          emailSent = !emailResult?.error;
        } catch (e: any) {
          console.error("[auth] Failed to send migration email:", e?.message || e);
        }

        if (!emailSent) {
          return res.status(500).json({
            message: "We found your account but couldn't send the password setup email. Please try again or use the Forgot Password page.",
            code: "EMAIL_SEND_FAILED",
          });
        }

        return res.status(200).json({
          message: "We've sent you an email to set up a password for direct login. Check your inbox!",
          code: "MIGRATION_EMAIL_SENT",
          email: normalizedEmail,
        });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.emailVerified) {
        return res.status(403).json({
          message: "Please verify your email before logging in.",
          code: "EMAIL_NOT_VERIFIED",
          email: normalizedEmail,
        });
      }

      await setLocalSession(req, user.id);

      await db.update(users)
        .set({ lastActivityAt: new Date() })
        .where(eq(users.id, user.id));

      res.json({ message: "Logged in successfully" });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) return res.status(500).json({ message: "Logout failed" });
      req.session.destroy(() => {
        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/auth/verify-email/:token", async (req, res) => {
    try {
      const { token } = req.params;
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }

      const [user] = await db.select().from(users)
        .where(eq(users.emailVerifyToken, token));

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification link" });
      }

      await db.update(users)
        .set({
          emailVerified: true,
          emailVerifyToken: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      res.json({ message: "Email verified successfully" });
    } catch (error: any) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.get("/api/auth/verify-email", async (req, res) => {
    const { token } = req.query;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "Verification token is required" });
    }
    req.params = { token };
    return (app as any)._router.handle(
      Object.assign(req, { url: `/api/auth/verify-email/${token}`, method: "GET" }),
      res,
      () => {}
    );
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

      const verifyToken = generateToken();
      await db.update(users)
        .set({ emailVerifyToken: verifyToken })
        .where(eq(users.id, user.id));

      await sendVerificationEmail(req, normalizedEmail, user.firstName || "there", verifyToken);
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

      const resetToken = generateToken();
      const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

      await db.update(users)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: expires,
        })
        .where(eq(users.id, user.id));

      const domain = getEmailDomain();
      const resetUrl = `https://${domain}/reset-password/${resetToken}`;

      try {
        const { sendEmail } = await import("../lib/email");
        await sendEmail(
          normalizedEmail,
          "Reset Your FamilyRoots Password",
          `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Reset Your Password</h1>
            <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
              Hey ${user.firstName || "there"},
            </p>
            <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
              We received a request to reset your password. Click the button below to create a new one:
            </p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 14px; color: #6a6a6a; line-height: 1.6;">
              This link expires in 1 hour.
            </p>
            <p style="font-size: 14px; color: #6a6a6a; line-height: 1.6;">
              If you didn't request this, you can safely ignore this email.
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

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ message: passwordCheck.message });
      }

      const [user] = await db.select().from(users)
        .where(eq(users.passwordResetToken, token));

      if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
        return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      const hashedPassword = await hashPassword(password);

      await db.update(users)
        .set({
          passwordHash: hashedPassword,
          authProvider: user.authProvider === "replit" ? "email" : user.authProvider,
          emailVerified: true,
          passwordResetToken: null,
          passwordResetExpires: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      res.json({ message: "Password reset successfully. You can now log in." });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/admin/status", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.json({ isAdmin: false });
    }
    const [user] = await db.select().from(users).where(eq(users.id, req.user.claims.sub));
    res.json({ isAdmin: user?.isAdmin || false });
  });

  app.get("/api/admin/auth-users", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const [admin] = await db.select().from(users).where(eq(users.id, req.user.claims.sub));
    if (!admin?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const search = ((req.query.search as string) || "").trim().toLowerCase();

    let allUsers;
    if (search) {
      const pattern = `%${search}%`;
      allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
        isAdmin: users.isAdmin,
        authProvider: users.authProvider,
        emailVerified: users.emailVerified,
        subscriptionTier: users.subscriptionTier,
        lastActivityAt: users.lastActivityAt,
      }).from(users)
        .where(or(
          ilike(users.firstName, pattern),
          ilike(users.lastName, pattern),
          ilike(users.email, pattern),
        ))
        .orderBy(sql`${users.createdAt} DESC`);
    } else {
      allUsers = await db.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
        isAdmin: users.isAdmin,
        authProvider: users.authProvider,
        emailVerified: users.emailVerified,
        subscriptionTier: users.subscriptionTier,
        lastActivityAt: users.lastActivityAt,
      }).from(users)
        .orderBy(sql`${users.createdAt} DESC`);
    }

    res.json(allUsers);
  });

  app.post("/api/admin/users/:id/reset-password", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const [admin] = await db.select().from(users).where(eq(users.id, req.user.claims.sub));
    if (!admin?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const { id } = req.params;
    const [targetUser] = await db.select().from(users).where(eq(users.id, id));
    if (!targetUser || !targetUser.email) {
      return res.status(404).json({ message: "User not found or has no email" });
    }

    const resetToken = generateToken();
    const expires = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

    const domain = getEmailDomain();
    const resetUrl = `https://${domain}/reset-password/${resetToken}`;

    try {
      const { sendEmail } = await import("../lib/email");
      await sendEmail(
        targetUser.email,
        "Password Reset - FamilyRoots",
        `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Password Reset</h1>
          <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
            Hey ${targetUser.firstName || "there"},
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
            This link expires in 1 hour.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
          <p style="font-size: 12px; color: #999;">FamilyRoots &mdash; Your Private Network for Real Connections</p>
        </div>
        `
      );
    } catch (e) {
      console.error("Failed to send admin-initiated reset email:", e);
      return res.status(500).json({ message: "Failed to send email. Reset aborted." });
    }

    await db.update(users)
      .set({
        passwordResetToken: resetToken,
        passwordResetExpires: expires,
      })
      .where(eq(users.id, id));

    res.json({ message: `Password reset email sent to ${targetUser.email}` });
  });

  app.post("/api/admin/migrate-auth", async (req: any, res) => {
    if (!req.isAuthenticated() || !req.user?.claims?.sub) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const [admin] = await db.select().from(users).where(eq(users.id, req.user.claims.sub));
    if (!admin?.isAdmin) return res.status(403).json({ message: "Forbidden" });

    const { userId } = req.body;
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!targetUser) return res.status(404).json({ message: "User not found" });
    if (targetUser.authProvider === "email") return res.status(400).json({ message: "Already using email auth" });
    if (!targetUser.email) return res.status(400).json({ message: "No email on file" });

    const resetToken = generateToken();
    const expires = new Date(Date.now() + MIGRATION_TOKEN_EXPIRY_MS);
    const domain = getEmailDomain();
    const resetUrl = `https://${domain}/reset-password/${resetToken}`;

    try {
      const { sendEmail } = await import("../lib/email");
      await sendEmail(
        targetUser.email,
        "Set Up Your FamilyRoots Password",
        `
        <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Set Up Your Password</h1>
          <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
            Hey ${targetUser.firstName || "there"},
          </p>
          <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
            FamilyRoots now supports direct email/password login. Click the button below to set your password:
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
              Set Password
            </a>
          </div>
          <p style="font-size: 14px; color: #6a6a6a; line-height: 1.6;">
            This link expires in 72 hours.
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 32px 0;" />
          <p style="font-size: 12px; color: #999;">FamilyRoots &mdash; Your Private Network for Real Connections</p>
        </div>
        `
      );
    } catch (e) {
      console.error("Failed to send migration email:", e);
      return res.status(500).json({ message: "Failed to send email. Migration aborted." });
    }

    await db.update(users)
      .set({
        authProvider: "email",
        emailVerified: true,
        passwordResetToken: resetToken,
        passwordResetExpires: expires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    res.json({ message: `Migrated ${targetUser.email} to email auth. Reset link sent.` });
  });
}

function setLocalSession(req: any, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const user: any = {
      claims: { sub: userId },
      authProvider: "email",
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

async function sendVerificationEmail(req: any, email: string, name: string, token: string) {
  try {
    const domain = getEmailDomain();
    const verifyUrl = `https://${domain}/verify-email/${token}`;

    const { sendEmail } = await import("../lib/email");
    await sendEmail(
      email,
      "Verify your email - FamilyRoots",
      `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; color: #1a1a1a; margin-bottom: 16px;">Verify Your Email</h1>
        <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
          Hey ${name},
        </p>
        <p style="font-size: 16px; color: #4a4a4a; line-height: 1.6;">
          Thanks for signing up! Please verify your email address by clicking the button below:
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${verifyUrl}" style="background-color: #16a34a; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Verify Email
          </a>
        </div>
        <p style="font-size: 14px; color: #6a6a6a; line-height: 1.6;">
          If the button doesn't work, copy and paste this link:
        </p>
        <p style="font-size: 12px; color: #6a6a6a; word-break: break-all;">${verifyUrl}</p>
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
