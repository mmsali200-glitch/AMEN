import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db, schema } from "./db.js";
import { eq } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "cfo-intelligence-secret-2024-change-in-production";
const JWT_EXPIRES = "7d";

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
  name: string;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getUserFromToken(token: string) {
  const payload = verifyToken(token);
  if (!payload) return null;
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, payload.userId)).limit(1);
  if (!user || !user.isActive) return null;
  return user;
}
