import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { clients, users, tickets, slaPolicies } from "../schema";
import { eq, and, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { hashPassword } from "../utils/auth";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

// Aliasing the users table to perform self-joins in aggregates
const ownerUsers = alias(users, "owner_users");
const contactUsers = alias(users, "contact_users");

/**
 * GET /api/clients
 * Lists all clients under the host Organization.
 * Performs left-joins to return:
 * - Client metadata (name, domain, tier, date)
 * - Account manager / owner details
 * - Contacts count (total users mapped to client)
 * - Tickets count (total tickets mapped to client)
 */
router.get(
  "/",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    try {
      const clientList = await db
        .select({
          id: clients.id,
          name: clients.name,
          domain: clients.domain,
          clientTier: clients.clientTier,
          createdAt: clients.createdAt,
          owner: {
            id: ownerUsers.id,
            firstName: ownerUsers.firstName,
            lastName: ownerUsers.lastName,
            initials: ownerUsers.initials,
          },
          userCount: sql<number>`count(distinct ${contactUsers.id})`.mapWith(Number),
          ticketCount: sql<number>`count(distinct ${tickets.id})`.mapWith(Number),
        })
        .from(clients)
        .leftJoin(ownerUsers, eq(clients.ownerId, ownerUsers.id))
        .leftJoin(contactUsers, eq(clients.id, contactUsers.clientId))
        .leftJoin(tickets, eq(clients.id, tickets.clientId))
        .where(eq(clients.orgId, req.user!.orgId))
        .groupBy(clients.id, ownerUsers.id);

      return res.json(clientList);
    } catch (error) {
      console.error("List clients failed:", error);
      return res.status(500).json({ error: "Failed to retrieve clients" });
    }
  }
);

/**
 * POST /api/clients
 * Creates a new client account under the active Org (Admin role only).
 */
router.post(
  "/",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { name, domain, clientTier, ownerId, slaPolicyId } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Client name is required" });
    }

    try {
      // Validate ownerId belongs to the organization and is staff
      if (ownerId && ownerId !== "none" && ownerId !== "null") {
        const [ownerUser] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, ownerId),
              eq(users.orgId, req.user!.orgId),
              or(eq(users.role, "admin"), eq(users.role, "agent"))
            )
          )
          .limit(1);
        if (!ownerUser) {
          return res.status(400).json({ error: "Invalid client owner selected. Must be an active staff member of this organization." });
        }
      }

      // Validate slaPolicyId belongs to the organization
      if (slaPolicyId && slaPolicyId !== "none" && slaPolicyId !== "null") {
        const [policy] = await db
          .select()
          .from(slaPolicies)
          .where(
            and(
              eq(slaPolicies.id, slaPolicyId),
              eq(slaPolicies.orgId, req.user!.orgId)
            )
          )
          .limit(1);
        if (!policy) {
          return res.status(400).json({ error: "Invalid SLA Policy selected. Policy does not belong to this organization." });
        }
      }

      const [newClient] = await db
        .insert(clients)
        .values({
          orgId: req.user!.orgId,
          name,
          domain: domain || null,
          slaPolicyId: slaPolicyId || null,
          clientTier: clientTier || "trial",
          ownerId: ownerId || null,
        })
        .returning();

      return res.status(201).json(newClient);
    } catch (error) {
      console.error("Create client failed:", error);
      return res.status(500).json({ error: "Failed to create client" });
    }
  }
);

/**
 * GET /api/clients/staff/list
 * Retrieves all staff members (agents and admins) under the host Organization.
 * Used for populating Account Manager / Owner dropdown options in the frontend.
 */
router.get(
  "/staff/list",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    try {
      const staffList = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          initials: users.initials,
        })
        .from(users)
        .where(
          and(
            eq(users.orgId, req.user!.orgId),
            or(eq(users.role, "admin"), eq(users.role, "agent"))
          )
        );
      return res.json(staffList);
    } catch (error) {
      console.error("List staff failed:", error);
      return res.status(500).json({ error: "Failed to retrieve staff" });
    }
  }
);

/**
 * GET /api/clients/:id/users
 * Retrieves the contacts directory under a client company.
 */
router.get(
  "/:id/users",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // 1. Verify client belongs to active Org
      const clientRecord = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, id),
            eq(clients.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (clientRecord.length === 0) {
        return res.status(404).json({ error: "Client account not found" });
      }

      // 2. Fetch contacts
      const userList = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          role: users.role,
          jobTitle: users.jobTitle,
          initials: users.initials,
          isActive: users.isActive,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(
          and(
            eq(users.clientId, id),
            eq(users.orgId, req.user!.orgId)
          )
        );

      return res.json(userList);
    } catch (error) {
      console.error("List client contacts failed:", error);
      return res.status(500).json({ error: "Failed to retrieve contacts" });
    }
  }
);

/**
 * POST /api/clients/:id/users
 * Registers a new contact user under a client company (Admin role only).
 */
router.post(
  "/:id/users",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, password, firstName, lastName, role, jobTitle } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // 1. Verify client belongs to active Org
      const clientRecord = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.id, id),
            eq(clients.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (clientRecord.length === 0) {
        return res.status(404).json({ error: "Client account not found" });
      }

      // 2. Prevent duplicate email in active Org
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
        return res.status(400).json({ error: "A contact with this email already exists in this organization" });
      }

      // 3. Hash password and calculate initials
      const passwordHash = await hashPassword(password);
      const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();

      const [newContact] = await db
        .insert(users)
        .values({
          orgId: req.user!.orgId,
          clientId: id,
          email,
          passwordHash,
          firstName,
          lastName,
          role: role || "client_user",
          jobTitle: jobTitle || null,
          initials,
        })
        .returning();

      return res.status(201).json({
        id: newContact.id,
        email: newContact.email,
        firstName: newContact.firstName,
        lastName: newContact.lastName,
        role: newContact.role,
        jobTitle: newContact.jobTitle,
        initials: newContact.initials,
      });
    } catch (error) {
      console.error("Create client contact failed:", error);
      return res.status(500).json({ error: "Failed to create user" });
    }
  }
);

export default router;
