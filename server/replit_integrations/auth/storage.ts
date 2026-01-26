import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Normalize email to lowercase for consistent matching
    const normalizedEmail = userData.email?.toLowerCase().trim();
    
    // First check if a user with this email already exists (different ID)
    // Use case-insensitive comparison to prevent duplicates
    if (normalizedEmail) {
      const [existingByEmail] = await db.select().from(users)
        .where(sql`LOWER(${users.email}) = ${normalizedEmail}`);
      
      if (existingByEmail && existingByEmail.id !== userData.id) {
        console.log(`[auth] Email conflict detected: existing user ${existingByEmail.id} has email ${existingByEmail.email}, new login attempted with ID ${userData.id}`);
        // Update existing user with new info but keep their ID
        const [updated] = await db.update(users)
          .set({
            firstName: userData.firstName || existingByEmail.firstName,
            lastName: userData.lastName || existingByEmail.lastName,
            profileImageUrl: userData.profileImageUrl || existingByEmail.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, existingByEmail.id))
          .returning();
        console.log(`[auth] Returning existing user ${updated.id} for email ${normalizedEmail}`);
        return updated;
      }
    }
    
    // Standard upsert by ID - also normalize email to lowercase
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        email: normalizedEmail || userData.email,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          email: normalizedEmail || userData.email,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
