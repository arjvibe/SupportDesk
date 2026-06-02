import { Request, Response, NextFunction } from "express";
import { verifyJWT, type UserSession } from "../utils/auth";

declare global {
  namespace Express {
    interface Request {
      /**
       * The authenticated user's session payload, injected by authenticateToken.
       */
      user?: UserSession;
    }
  }
}

/**
 * Extracts a cookie value from the request cookie header string.
 * 
 * @param cookieHeader The raw Cookie header string from the request
 * @param name The name of the cookie to retrieve
 * @returns The decoded cookie value string, or null if not found
 */
function getCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";");
  for (const cookie of cookies) {
    const [key, value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value);
  }
  return null;
}

/**
 * Express middleware to authenticate the request via JWT.
 * Checks for the 'aura_session' HTTPOnly cookie, falling back to a Bearer token in the Authorization header.
 * 
 * Secures multi-tenant boundaries by asserting that the session's `orgId` matches the active request's `req.org.id`.
 * Injects `req.user` upon successful validation.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  let token: string | null = null;

  // 1. Check HttpOnly cookie
  token = getCookie(req.headers.cookie, "aura_session");

  // 2. Check Authorization Header
  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ error: "Access denied. Please log in." });
  }

  const session = await verifyJWT(token);
  if (!session) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }

  req.user = session;

  // Enforce Tenant (Org) border check to block token hijack attempts
  if (req.org && session.orgId !== req.org.id) {
    return res.status(403).json({
      error: "Access denied. Session belongs to a different workspace.",
    });
  }

  next();
}

/**
 * Express middleware helper to restrict route access based on user role.
 * Assumes authenticateToken has already run and populated `req.user`.
 * 
 * @param allowedRoles Array of roles permitted to access the route
 */
export function requireRole(allowedRoles: ("admin" | "agent" | "client_user")[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Access denied. Not authenticated." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden. Insufficient permissions." });
    }

    next();
  };
}
