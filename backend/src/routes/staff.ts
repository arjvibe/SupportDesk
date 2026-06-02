import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { users, agentTeamMapping } from "../schema";
import { eq, and, or, sql, isNull } from "drizzle-orm";
import { hashPassword } from "../utils/auth";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/staff
 * 
 * Retrieves all internal staff members (Admins and Agents) belonging to the active organization.
 * Filters out external client users (where `clientId` is NOT null).
 * Joins agentTeamMapping to return the count of teams each staff member belongs to.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing authenticated user context in `req.user`
 * @param res Express Response object returning the JSON list of staff users
 */
router.get(
  "/",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    try {
      const staffList = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          jobTitle: users.jobTitle,
          initials: users.initials,
          isActive: users.isActive,
          createdAt: users.createdAt,
          teamCount: sql<number>`count(distinct ${agentTeamMapping.teamId})`.mapWith(Number),
        })
        .from(users)
        .leftJoin(agentTeamMapping, eq(users.id, agentTeamMapping.agentId))
        .where(
          and(
            eq(users.orgId, req.user!.orgId),
            isNull(users.clientId),
            or(eq(users.role, "admin"), eq(users.role, "agent"))
          )
        )
        .groupBy(users.id)
        .orderBy(users.firstName, users.lastName);

      return res.json(staffList);
    } catch (error) {
      console.error("List staff members failed:", error);
      return res.status(500).json({ error: "Failed to retrieve organization staff" });
    }
  }
);

/**
 * POST /api/staff
 * 
 * Registers a new internal staff member (Admin or Agent) under the active organization.
 * Computes their avatar initials, hashes their password, and saves them to the database.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing `email`, `password`, `firstName`, `lastName`, `role`, and `jobTitle`
 * @param res Express Response object returning details of the created staff user
 */
router.post(
  "/",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { email, password, firstName, lastName, role, jobTitle } = req.body;

    if (!email || !password || !firstName || !lastName || !role) {
      return res.status(400).json({ error: "Missing required fields (email, password, firstName, lastName, role)" });
    }

    if (role !== "admin" && role !== "agent") {
      return res.status(400).json({ error: "Invalid role. Staff members must be 'admin' or 'agent'" });
    }

    try {
      // Prevent duplicate email registration within the active organization
      const existingUser = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.email, email),
            eq(users.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ error: "A user with this email address already exists in this organization" });
      }

      // Hash password and calculate initials
      const passwordHash = await hashPassword(password);
      const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

      const [newStaff] = await db
        .insert(users)
        .values({
          orgId: req.user!.orgId,
          clientId: null, // internal staff
          email,
          passwordHash,
          firstName,
          lastName,
          role,
          jobTitle: jobTitle || null,
          initials,
          isActive: true,
        })
        .returning();

      return res.status(201).json({
        id: newStaff.id,
        email: newStaff.email,
        firstName: newStaff.firstName,
        lastName: newStaff.lastName,
        role: newStaff.role,
        jobTitle: newStaff.jobTitle,
        initials: newStaff.initials,
        isActive: newStaff.isActive,
        createdAt: newStaff.createdAt,
      });
    } catch (error) {
      console.error("Create staff member failed:", error);
      return res.status(500).json({ error: "Failed to register new staff member" });
    }
  }
);

/**
 * PUT /api/staff/:id
 * 
 * Updates profile details, role, and active status for an existing staff member.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing staff ID in params, and update fields in body
 * @param res Express Response object returning the updated user
 */
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, firstName, lastName, role, jobTitle, isActive } = req.body;

    if (!email || !firstName || !lastName || !role) {
      return res.status(400).json({ error: "Missing required fields (email, firstName, lastName, role)" });
    }

    if (role !== "admin" && role !== "agent") {
      return res.status(400).json({ error: "Invalid role. Staff members must be 'admin' or 'agent'" });
    }

    try {
      // 1. Verify the user exists, belongs to this organization, and is indeed a staff member (clientId is null)
      const existingUser = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, id),
            eq(users.orgId, req.user!.orgId),
            isNull(users.clientId)
          )
        )
        .limit(1);

      if (existingUser.length === 0) {
        return res.status(404).json({ error: "Staff member not found" });
      }

      // 2. If the email is being changed, verify it does not conflict with another user in the Org
      if (email !== existingUser[0].email) {
        const emailCheck = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.email, email),
              eq(users.orgId, req.user!.orgId)
            )
          )
          .limit(1);

        if (emailCheck.length > 0) {
          return res.status(400).json({ error: "A user with this email address already exists in this organization" });
        }
      }

      // 3. Compute initials based on names (may have changed)
      const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

      // 4. Update the staff member
      const [updatedUser] = await db
        .update(users)
        .set({
          email,
          firstName,
          lastName,
          role,
          jobTitle: jobTitle || null,
          initials,
          isActive: isActive !== undefined ? !!isActive : existingUser[0].isActive,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning();

      return res.json({
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        role: updatedUser.role,
        jobTitle: updatedUser.jobTitle,
        initials: updatedUser.initials,
        isActive: updatedUser.isActive,
        createdAt: updatedUser.createdAt,
      });
    } catch (error) {
      console.error("Update staff member failed:", error);
      return res.status(500).json({ error: "Failed to update staff member details" });
    }
  }
);

export default router;
