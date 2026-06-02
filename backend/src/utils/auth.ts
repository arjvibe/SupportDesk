import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "aura-supportdesk-super-secret-key-change-in-prod"
);

export type UserSession = {
  userId: string;
  email: string;
  role: "admin" | "agent" | "client_user";
  clientId: string | null; // Represents client customer account mapping
  orgId: string; // Represents host Org (tenant) mapping
};

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Compare password with bcrypt hash
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Sign JWT session token
export async function signJWT(payload: UserSession): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(JWT_SECRET);
}

// Verify JWT session token
export async function verifyJWT(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch (error) {
    return null;
  }
}
