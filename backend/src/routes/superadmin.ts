import { Router, Request, Response, NextFunction } from "express";
import { db } from "../db/connection";
import { organizations, slaPolicies, slaTargets, organizationNotificationSettings, users, tickets } from "../schema";
import { eq, and, sql } from "drizzle-orm";
import { hashPassword } from "../utils/auth";
import { authenticateToken } from "../middleware/auth";

const router = Router();

// Middleware to verify the active subdomain is "superadmin" and the user is an admin
function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.org?.subdomain !== "superadmin") {
    return res.status(403).json({
      error: "Access denied. Request must be made under the superadmin workspace.",
    });
  }
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({
      error: "Forbidden. Super Admin privileges required.",
    });
  }
  next();
}

// 1. GET /organizations - List all organizations with stats (userCount, ticketCount)
router.get(
  "/organizations",
  authenticateToken,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const list = await db
        .select({
          id: organizations.id,
          name: organizations.name,
          subdomain: organizations.subdomain,
          subscriptionTier: organizations.subscriptionTier,
          isActive: organizations.isActive,
          createdAt: organizations.createdAt,
          updatedAt: organizations.updatedAt,
          userCount: sql<number>`count(distinct ${users.id})`.mapWith(Number),
          ticketCount: sql<number>`count(distinct ${tickets.id})`.mapWith(Number),
        })
        .from(organizations)
        .leftJoin(users, eq(users.orgId, organizations.id))
        .leftJoin(tickets, eq(tickets.orgId, organizations.id))
        .groupBy(organizations.id)
        .orderBy(organizations.createdAt);

      return res.json(list);
    } catch (error) {
      console.error("List organizations failed:", error);
      return res.status(500).json({ error: "Failed to retrieve organizations" });
    }
  }
);

// 2. POST /organizations - Create organization, default SLA policy, default notification settings, and admin user
router.post(
  "/organizations",
  authenticateToken,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { name, subdomain, subscriptionTier, adminEmail, adminPassword, adminFirstName, adminLastName } = req.body;

    if (!name || !subdomain) {
      return res.status(400).json({ error: "Organization Name and Subdomain are required" });
    }

    const cleanSubdomain = subdomain.trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(cleanSubdomain)) {
      return res.status(400).json({ error: "Subdomain can only contain lowercase letters, numbers, and hyphens" });
    }

    try {
      // Check for existing subdomain
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.subdomain, cleanSubdomain))
        .limit(1);

      if (existing.length > 0) {
        return res.status(400).json({ error: "Subdomain is already in use by another workspace" });
      }

      // We perform all initialization inside a transaction
      const result = await db.transaction(async (tx) => {
        // A. Insert Organization
        const [org] = await tx
          .insert(organizations)
          .values({
            name,
            subdomain: cleanSubdomain,
            subscriptionTier: subscriptionTier || "trial",
            isActive: true,
          })
          .returning();

        // B. Create default SLA Policy
        const [sla] = await tx
          .insert(slaPolicies)
          .values({
            orgId: org.id,
            name: "Standard SLA",
            description: "Default SLA policy for clients",
            isDefault: true,
            businessDays: ["1", "2", "3", "4", "5"], // Mon-Fri
          })
          .returning();

        // C. Create standard SLA targets
        await tx.insert(slaTargets).values([
          { slaPolicyId: sla.id, priority: "urgent", responseTimeHours: 1, resolutionTimeHours: 4, escalateAfterHours: 2 },
          { slaPolicyId: sla.id, priority: "high", responseTimeHours: 4, resolutionTimeHours: 24, escalateAfterHours: 12 },
          { slaPolicyId: sla.id, priority: "normal", responseTimeHours: 12, resolutionTimeHours: 72, escalateAfterHours: 48 },
          { slaPolicyId: sla.id, priority: "low", responseTimeHours: 24, resolutionTimeHours: 168, escalateAfterHours: 120 },
        ]);

        // D. Create default notification settings
        await tx.insert(organizationNotificationSettings).values([
          { orgId: org.id, channel: "email", enabled: true, config: {} },
          { orgId: org.id, channel: "slack", enabled: false, config: {} },
          { orgId: org.id, channel: "whatsapp", enabled: false, config: {} },
          { orgId: org.id, channel: "in_app", enabled: true, config: {} },
        ]);

        // E. Create initial administrator (if details provided)
        if (adminEmail && adminPassword) {
          const passwordHash = await hashPassword(adminPassword);
          const firstName = adminFirstName || "Admin";
          const lastName = adminLastName || "User";
          const initials = ((firstName?.[0] || "") + (lastName?.[0] || "")).toUpperCase() || "AD";

          await tx.insert(users).values({
            orgId: org.id,
            clientId: null,
            email: adminEmail,
            passwordHash,
            firstName,
            lastName,
            role: "admin",
            jobTitle: "Workspace Owner",
            initials,
            isActive: true,
          });
        }

        return org;
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error("Create organization transaction failed:", error);
      return res.status(500).json({ error: "Failed to initialize organization workspace" });
    }
  }
);

// 3. PUT /organizations/:id - Edit organization settings
router.put(
  "/organizations/:id",
  authenticateToken,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { name, subdomain, subscriptionTier, isActive } = req.body;
    const orgId = req.params.id;

    try {
      // Check if org exists
      const existing = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, orgId))
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Organization not found" });
      }

      // Check if subdomain is changing and if the new one is taken
      if (subdomain && subdomain.trim().toLowerCase() !== existing[0].subdomain) {
        const cleanSub = subdomain.trim().toLowerCase();
        if (!/^[a-z0-9-]+$/.test(cleanSub)) {
          return res.status(400).json({ error: "Subdomain can only contain lowercase letters, numbers, and hyphens" });
        }
        const duplicate = await db
          .select()
          .from(organizations)
          .where(eq(organizations.subdomain, cleanSub))
          .limit(1);

        if (duplicate.length > 0) {
          return res.status(400).json({ error: "Subdomain is already in use" });
        }
      }

      const [updated] = await db
        .update(organizations)
        .set({
          name: name !== undefined ? name : existing[0].name,
          subdomain: subdomain !== undefined ? subdomain.trim().toLowerCase() : existing[0].subdomain,
          subscriptionTier: subscriptionTier !== undefined ? subscriptionTier : existing[0].subscriptionTier,
          isActive: isActive !== undefined ? isActive : existing[0].isActive,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, orgId))
        .returning();

      return res.json(updated);
    } catch (error) {
      console.error("Update organization failed:", error);
      return res.status(500).json({ error: "Failed to update organization" });
    }
  }
);

// 4. GET /organizations/:id/notifications - Retrieve notification settings for any organization
router.get(
  "/organizations/:id/notifications",
  authenticateToken,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const settings = await db
        .select()
        .from(organizationNotificationSettings)
        .where(eq(organizationNotificationSettings.orgId, req.params.id));

      return res.json(settings);
    } catch (error) {
      console.error("Get organization notifications failed:", error);
      return res.status(500).json({ error: "Failed to retrieve organization notification settings" });
    }
  }
);

// 5. PUT /organizations/:id/notifications - Save/update settings for any organization
router.put(
  "/organizations/:id/notifications",
  authenticateToken,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    const { channel, enabled, config } = req.body;
    const orgId = req.params.id;

    if (!channel) {
      return res.status(400).json({ error: "Channel is required" });
    }

    try {
      // Find if settings already exist for this org and channel
      const existing = await db
        .select()
        .from(organizationNotificationSettings)
        .where(
          and(
            eq(organizationNotificationSettings.orgId, orgId),
            eq(organizationNotificationSettings.channel, channel)
          )
        )
        .limit(1);

      let record;
      if (existing.length > 0) {
        // Update existing record
        const [updated] = await db
          .update(organizationNotificationSettings)
          .set({
            enabled: enabled !== undefined ? enabled : existing[0].enabled,
            config: config !== undefined ? { ...existing[0].config, ...config } : existing[0].config,
            updatedAt: new Date(),
          })
          .where(eq(organizationNotificationSettings.id, existing[0].id))
          .returning();
        record = updated;
      } else {
        // Insert new record
        const [inserted] = await db
          .insert(organizationNotificationSettings)
          .values({
            orgId,
            channel,
            enabled: enabled !== undefined ? enabled : true,
            config: config || {},
          })
          .returning();
        record = inserted;
      }

      return res.json(record);
    } catch (error) {
      console.error("Update organization notification settings failed:", error);
      return res.status(500).json({ error: "Failed to update notification settings" });
    }
  }
);

export default router;
