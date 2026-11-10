import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import type { Role } from "@/lib/constants";

export const SESSION_COOKIE = "dh_session";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Fail loudly rather than silently signing tokens with a weak default —
    // this is the key that protects every login session.
    throw new Error(
      "SESSION_SECRET is not set. Add it to your .env file (see .env.example)."
    );
  }
  return secret;
}

export type SessionPayload = {
  userId: string;
  role: Role;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, getSecret()) as SessionPayload;
  } catch {
    return null;
  }
}

/** Generates a readable random temporary password, e.g. "orbit-42-k3f9". */
export function generateTempPassword(): string {
  const words = [
    "pixel",
    "orbit",
    "signal",
    "rocket",
    "matrix",
    "beacon",
    "vector",
    "cloud",
    "prism",
    "nova",
  ];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(10 + Math.random() * 89);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${word}-${num}-${suffix}`;
}
