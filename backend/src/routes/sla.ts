import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { slaPolicies, slaTargets } from "../schema";
import { eq, and, not } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/sla
 * 
 * Lists all SLA policies registered under the authenticated user's organization.
 * 
 * @param req Express Request object containing authenticated user context in `req.user`
 * @param res Express Response object returning the JSON list of SLA policies
 */
router.get(
  "/",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    try {
      const policies = await db
        .select()
        .from(slaPolicies)
        .where(eq(slaPolicies.orgId, req.user!.orgId))
        .orderBy(slaPolicies.isDefault, slaPolicies.name);

      return res.json(policies);
    } catch (error) {
      console.error("List SLA policies failed:", error);
      return res.status(500).json({ error: "Failed to retrieve SLA policies" });
    }
  }
);

/**
 * GET /api/sla/:id
 * 
 * Fetches a specific SLA policy detail by ID, joined with all its priority targets.
 * Verifies that the policy belongs to the authenticated user's organization.
 * 
 * @param req Express Request object containing policy ID in params
 * @param res Express Response object returning the policy details with targets
 */
router.get(
  "/:id",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // 1. Fetch policy metadata
      const [policy] = await db
        .select()
        .from(slaPolicies)
        .where(
          and(
            eq(slaPolicies.id, id),
            eq(slaPolicies.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (!policy) {
        return res.status(404).json({ error: "SLA policy not found" });
      }

      // 2. Fetch targets associated with this policy
      const targets = await db
        .select()
        .from(slaTargets)
        .where(eq(slaTargets.slaPolicyId, id))
        .orderBy(
          sql`case priority 
            when 'urgent' then 1 
            when 'high' then 2 
            when 'normal' then 3 
            when 'low' then 4 
          end`
        );

      return res.json({
        ...policy,
        targets,
      });
    } catch (error) {
      console.error("Get SLA policy details failed:", error);
      return res.status(500).json({ error: "Failed to retrieve SLA policy details" });
    }
  }
);

import { sql } from "drizzle-orm";

/**
 * POST /api/sla
 * 
 * Registers a new SLA policy under the active organization.
 * Automatically initializes default SLA target values for all priority levels:
 * - low (24h resp, 168h res, 120h escalate)
 * - normal (12h resp, 72h res, 48h escalate)
 * - high (4h resp, 24h res, 12h escalate)
 * - urgent (1h resp, 4h res, 2h escalate)
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing `name` and `description` in the body
 * @param res Express Response object returning the newly created policy and its targets
 */
router.post(
  "/",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "SLA Policy name is required" });
    }

    try {
      // Prevent duplicate policy names within the active Org
      const existingPolicy = await db
        .select()
        .from(slaPolicies)
        .where(
          and(
            eq(slaPolicies.name, name),
            eq(slaPolicies.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (existingPolicy.length > 0) {
        return res.status(400).json({ error: "An SLA Policy with this name already exists" });
      }

      // Check if this is the first policy in the Org (make it default automatically if so)
      const existingPolicies = await db
        .select()
        .from(slaPolicies)
        .where(eq(slaPolicies.orgId, req.user!.orgId))
        .limit(1);

      const isDefault = existingPolicies.length === 0;

      // 1. Insert SLA Policy
      const [newPolicy] = await db
        .insert(slaPolicies)
        .values({
          orgId: req.user!.orgId,
          name,
          description: description || null,
          isDefault,
          businessHoursStart: "09:00:00",
          businessHoursEnd: "18:00:00",
          businessDays: ["1", "2", "3", "4", "5"], // Mon-Fri default
        })
        .returning();

      // 2. Initialize SLA Targets
      const defaultTargets = [
        { slaPolicyId: newPolicy.id, priority: "urgent" as const, responseTimeHours: 1, resolutionTimeHours: 4, escalateAfterHours: 2 },
        { slaPolicyId: newPolicy.id, priority: "high" as const, responseTimeHours: 4, resolutionTimeHours: 24, escalateAfterHours: 12 },
        { slaPolicyId: newPolicy.id, priority: "normal" as const, responseTimeHours: 12, resolutionTimeHours: 72, escalateAfterHours: 48 },
        { slaPolicyId: newPolicy.id, priority: "low" as const, responseTimeHours: 24, resolutionTimeHours: 168, escalateAfterHours: 120 },
      ];

      const targets = await db
        .insert(slaTargets)
        .values(defaultTargets)
        .returning();

      return res.status(201).json({
        ...newPolicy,
        targets,
      });
    } catch (error) {
      console.error("Create SLA policy failed:", error);
      return res.status(500).json({ error: "Failed to create SLA policy" });
    }
  }
);

/**
 * PUT /api/sla/:id
 * 
 * Updates the general metadata, business days, and working hours for a specific SLA policy.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing policy update parameters in the body
 * @param res Express Response object returning the updated policy
 */
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, businessHoursStart, businessHoursEnd, businessDays } = req.body;

    if (!name) {
      return res.status(400).json({ error: "SLA Policy name is required" });
    }

    try {
      // 1. Verify the policy exists and belongs to this organization
      const existing = await db
        .select()
        .from(slaPolicies)
        .where(
          and(
            eq(slaPolicies.id, id),
            eq(slaPolicies.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "SLA policy not found" });
      }

      // 2. Prevent duplicate names if name is changed
      if (name !== existing[0].name) {
        const nameCheck = await db
          .select()
          .from(slaPolicies)
          .where(
            and(
              eq(slaPolicies.name, name),
              eq(slaPolicies.orgId, req.user!.orgId)
            )
          )
          .limit(1);

        if (nameCheck.length > 0) {
          return res.status(400).json({ error: "Another SLA policy with this name already exists" });
        }
      }

      // 3. Perform the update
      const [updatedPolicy] = await db
        .update(slaPolicies)
        .set({
          name,
          description: description || null,
          businessHoursStart: businessHoursStart || existing[0].businessHoursStart,
          businessHoursEnd: businessHoursEnd || existing[0].businessHoursEnd,
          businessDays: businessDays || existing[0].businessDays,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(slaPolicies.id, id),
            eq(slaPolicies.orgId, req.user!.orgId)
          )
        )
        .returning();

      return res.json(updatedPolicy);
    } catch (error) {
      console.error("Update SLA policy failed:", error);
      return res.status(500).json({ error: "Failed to update SLA policy" });
    }
  }
);

/**
 * PUT /api/sla/:id/targets
 * 
 * Bulk updates the SLA target thresholds (response hours, resolution hours, and escalation offset)
 * for a specific policy's priority levels.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing targets array in body: `[{ id, responseTimeHours, resolutionTimeHours, escalateAfterHours }]`
 * @param res Express Response object returning success message
 */
router.put(
  "/:id/targets",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { targets } = req.body;

    if (!targets || !Array.isArray(targets)) {
      return res.status(400).json({ error: "Targets array is required" });
    }

    try {
      // 1. Verify policy belongs to active Org
      const policyRecord = await db
        .select()
        .from(slaPolicies)
        .where(
          and(
            eq(slaPolicies.id, id),
            eq(slaPolicies.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (policyRecord.length === 0) {
        return res.status(404).json({ error: "SLA policy not found" });
      }

      // 2. Perform bulk updates for each target row
      for (const target of targets) {
        if (!target.id || target.responseTimeHours === undefined || target.resolutionTimeHours === undefined) {
          continue;
        }

        // Validate values
        if (target.responseTimeHours > target.resolutionTimeHours) {
          return res.status(400).json({ error: "Response target hours cannot exceed resolution target hours" });
        }

        await db
          .update(slaTargets)
          .set({
            responseTimeHours: target.responseTimeHours,
            resolutionTimeHours: target.resolutionTimeHours,
            escalateAfterHours: target.escalateAfterHours || 0,
          })
          .where(
            and(
              eq(slaTargets.id, target.id),
              eq(slaTargets.slaPolicyId, id)
            )
          );
      }

      return res.json({ message: "SLA targets updated successfully" });
    } catch (error) {
      console.error("Update SLA targets failed:", error);
      return res.status(500).json({ error: "Failed to update SLA targets" });
    }
  }
);

/**
 * POST /api/sla/:id/default
 * 
 * Designates a specific SLA policy as the default policy for the organization.
 * Resets the `isDefault` flag on all other policies in the Org.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing policy ID in params
 * @param res Express Response object indicating success
 */
router.post(
  "/:id/default",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // 1. Verify policy exists and belongs to active Org
      const policyRecord = await db
        .select()
        .from(slaPolicies)
        .where(
          and(
            eq(slaPolicies.id, id),
            eq(slaPolicies.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (policyRecord.length === 0) {
        return res.status(404).json({ error: "SLA policy not found" });
      }

      // 2. Clear default flag for other policies in the Org
      await db
        .update(slaPolicies)
        .set({ isDefault: false })
        .where(
          and(
            eq(slaPolicies.orgId, req.user!.orgId),
            not(eq(slaPolicies.id, id))
          )
        );

      // 3. Set default flag for the selected policy
      await db
        .update(slaPolicies)
        .set({ isDefault: true })
        .where(
          and(
            eq(slaPolicies.id, id),
            eq(slaPolicies.orgId, req.user!.orgId)
          )
        );

      return res.json({ message: "Default SLA policy updated successfully" });
    } catch (error) {
      console.error("Set default SLA policy failed:", error);
      return res.status(500).json({ error: "Failed to set default SLA policy" });
    }
  }
);

export default router;
