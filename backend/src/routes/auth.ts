import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { users } from "../schema";
import { eq, and } from "drizzle-orm";
import { verifyPassword, signJWT, type UserSession } from "../utils/auth";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * POST /api/auth/login
 * Validates credentials and sets a secure HttpOnly JWT session cookie.
 * Looks up users scoped to the current Host Organization (tenant) to isolate credentials.
 */
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  // Ensure resolved organization context is active
  if (!req.org) {
    return res.status(400).json({ error: "Workspace context is missing" });
  }

  try {
    // 1. Fetch user by email within the active Org
    const userList = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.orgId, req.org.id)
        )
      )
      .limit(1);

    if (userList.length === 0) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    const user = userList[0];

    // 2. Verify hashed password
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(400).json({ error: "Invalid email or password" });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: "Account is deactivated" });
    }

    // 3. Assemble JWT payload
    const sessionPayload: UserSession = {
      userId: user.id,
      email: user.email,
      role: user.role,
      clientId: user.clientId,
      orgId: user.orgId,
    };

    const token = await signJWT(sessionPayload);

    // 4. Set HttpOnly cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("aura_session", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: "/",
    });

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        initials: user.initials,
      },
      org: req.org,
    });
  } catch (error) {
    console.error("Login endpoint failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/auth/logout
 * Clears the session cookie.
 */
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("aura_session", {
    path: "/",
    httpOnly: true,
  });
  return res.json({ success: true, message: "Logged out successfully" });
});

/**
 * GET /api/auth/session
 * Verifies active session and returns authenticated user metadata.
 */
router.get("/session", authenticateToken, async (req: Request, res: Response) => {
  try {
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        role: users.role,
        initials: users.initials,
        clientId: users.clientId,
      })
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({ authenticated: true, user, org: req.org });
  } catch (error) {
    console.error("Session fetch failed:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/auth/workspace
 * Public endpoint to fetch active organization branding metadata (logo, colors)
 * based on subdomain context for pre-auth frontend rendering.
 */
router.get("/workspace", (req: Request, res: Response) => {
  if (!req.org) {
    return res.status(404).json({ error: "Workspace not found" });
  }
  return res.json({ org: req.org });
});

export default router;
