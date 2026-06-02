import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { ticketAssignmentRules, users, teams } from "../schema";
import { eq, and, or, sql, gte, lte, gt } from "drizzle-orm";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

/**
 * GET /api/rules
 * 
 * Lists all automated ticket assignment rules registered under the active organization.
 * Returns the rules sorted by their sequential `priorityOrder` ascending.
 * 
 * @param req Express Request object containing authenticated user context in `req.user`
 * @param res Express Response object returning the JSON list of routing rules
 */
router.get(
  "/",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    try {
      const rules = await db
        .select()
        .from(ticketAssignmentRules)
        .where(eq(ticketAssignmentRules.orgId, req.user!.orgId))
        .orderBy(ticketAssignmentRules.priorityOrder);

      return res.json(rules);
    } catch (error) {
      console.error("List assignment rules failed:", error);
      return res.status(500).json({ error: "Failed to retrieve assignment rules" });
    }
  }
);

/**
 * POST /api/rules
 * 
 * Registers a new automated routing rule under the active organization.
 * Automatically computes and assigns the next sequential `priorityOrder` rank.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing rule properties in the body
 * @param res Express Response object returning the newly created rule
 */
router.post(
  "/",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { name, criteriaField, criteriaValue, targetTeamId, targetAgentId, assignmentMode } = req.body;

    if (!name || !criteriaField || !criteriaValue || !assignmentMode) {
      return res.status(400).json({ error: "Missing required fields (name, criteriaField, criteriaValue, assignmentMode)" });
    }

    try {
      // Validate targetTeamId belongs to this organization
      if (targetTeamId && targetTeamId !== "none" && targetTeamId !== "null") {
        const [teamRecord] = await db
          .select()
          .from(teams)
          .where(
            and(
              eq(teams.id, targetTeamId),
              eq(teams.orgId, req.user!.orgId)
            )
          )
          .limit(1);
        if (!teamRecord) {
          return res.status(400).json({ error: "Invalid target team selected. Team does not belong to this organization." });
        }
      }

      // Validate targetAgentId belongs to this organization and is staff
      if (targetAgentId && targetAgentId !== "none" && targetAgentId !== "null") {
        const [agentUser] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, targetAgentId),
              eq(users.orgId, req.user!.orgId),
              or(eq(users.role, "admin"), eq(users.role, "agent"))
            )
          )
          .limit(1);
        if (!agentUser) {
          return res.status(400).json({ error: "Invalid target agent selected. Must be an active staff member of this organization." });
        }
      }

      // 1. Fetch current maximum priorityOrder in the organization to calculate the next sequence rank
      const [maxOrderResult] = await db
        .select({
          maxOrder: sql<number>`max(${ticketAssignmentRules.priorityOrder})`.mapWith(Number),
        })
        .from(ticketAssignmentRules)
        .where(eq(ticketAssignmentRules.orgId, req.user!.orgId));

      const nextOrder = (maxOrderResult?.maxOrder || 0) + 1;

      // 2. Insert the rule record
      const [newRule] = await db
        .insert(ticketAssignmentRules)
        .values({
          orgId: req.user!.orgId,
          name,
          priorityOrder: nextOrder,
          criteriaField,
          criteriaValue,
          targetTeamId: targetTeamId || null,
          targetAgentId: targetAgentId || null,
          assignmentMode: assignmentMode || "direct",
          isActive: true,
        })
        .returning();

      return res.status(201).json(newRule);
    } catch (error) {
      console.error("Create assignment rule failed:", error);
      return res.status(500).json({ error: "Failed to create assignment rule" });
    }
  }
);

/**
 * PUT /api/rules/:id
 * 
 * Updates configuration settings, targets, or status for a specific assignment rule.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing rule ID in params, and update fields in body
 * @param res Express Response object returning the updated rule
 */
router.put(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, criteriaField, criteriaValue, targetTeamId, targetAgentId, assignmentMode, isActive } = req.body;

    if (!name || !criteriaField || !criteriaValue || !assignmentMode) {
      return res.status(400).json({ error: "Missing required fields (name, criteriaField, criteriaValue, assignmentMode)" });
    }

    try {
      // 1. Verify the rule exists and belongs to this organization
      const existing = await db
        .select()
        .from(ticketAssignmentRules)
        .where(
          and(
            eq(ticketAssignmentRules.id, id),
            eq(ticketAssignmentRules.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Assignment rule not found" });
      }

      // Validate targetTeamId belongs to this organization
      if (targetTeamId && targetTeamId !== "none" && targetTeamId !== "null") {
        const [teamRecord] = await db
          .select()
          .from(teams)
          .where(
            and(
              eq(teams.id, targetTeamId),
              eq(teams.orgId, req.user!.orgId)
            )
          )
          .limit(1);
        if (!teamRecord) {
          return res.status(400).json({ error: "Invalid target team selected. Team does not belong to this organization." });
        }
      }

      // Validate targetAgentId belongs to this organization and is staff
      if (targetAgentId && targetAgentId !== "none" && targetAgentId !== "null") {
        const [agentUser] = await db
          .select()
          .from(users)
          .where(
            and(
              eq(users.id, targetAgentId),
              eq(users.orgId, req.user!.orgId),
              or(eq(users.role, "admin"), eq(users.role, "agent"))
            )
          )
          .limit(1);
        if (!agentUser) {
          return res.status(400).json({ error: "Invalid target agent selected. Must be an active staff member of this organization." });
        }
      }

      // 2. Perform the update
      const [updatedRule] = await db
        .update(ticketAssignmentRules)
        .set({
          name,
          criteriaField,
          criteriaValue,
          targetTeamId: targetTeamId || null,
          targetAgentId: targetAgentId || null,
          assignmentMode,
          isActive: isActive !== undefined ? !!isActive : existing[0].isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(ticketAssignmentRules.id, id),
            eq(ticketAssignmentRules.orgId, req.user!.orgId)
          )
        )
        .returning();

      return res.json(updatedRule);
    } catch (error) {
      console.error("Update assignment rule failed:", error);
      return res.status(500).json({ error: "Failed to update assignment rule" });
    }
  }
);

/**
 * DELETE /api/rules/:id
 * 
 * Deletes a routing rule and shifts the priorityOrder rankings of all subsequent rules down.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing rule ID in params
 * @param res Express Response object indicating success
 */
router.delete(
  "/:id",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // 1. Verify the rule exists and belongs to this organization
      const existing = await db
        .select()
        .from(ticketAssignmentRules)
        .where(
          and(
            eq(ticketAssignmentRules.id, id),
            eq(ticketAssignmentRules.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        return res.status(404).json({ error: "Assignment rule not found" });
      }

      const deletedPriority = existing[0].priorityOrder;

      // 2. Delete the rule record
      await db
        .delete(ticketAssignmentRules)
        .where(eq(ticketAssignmentRules.id, id));

      // 3. Shift the priorityOrder of subsequent rules down by 1 to fill the sequence gap
      await db
        .update(ticketAssignmentRules)
        .set({
          priorityOrder: sql`${ticketAssignmentRules.priorityOrder} - 1`,
        })
        .where(
          and(
            eq(ticketAssignmentRules.orgId, req.user!.orgId),
            gt(ticketAssignmentRules.priorityOrder, deletedPriority)
          )
        );

      return res.json({ message: "Assignment rule deleted successfully" });
    } catch (error) {
      console.error("Delete assignment rule failed:", error);
      return res.status(500).json({ error: "Failed to delete assignment rule" });
    }
  }
);

/**
 * PUT /api/rules/reorder
 * 
 * Reorders the priorityOrder rankings of multiple routing rules based on an array of ordered rule IDs.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing `orderedIds` array of UUID strings in the body
 * @param res Express Response object indicating success
 */
router.put(
  "/reorder",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { orderedIds } = req.body;

    if (!orderedIds || !Array.isArray(orderedIds)) {
      return res.status(400).json({ error: "orderedIds array of rule IDs is required" });
    }

    try {
      // Bulk update priorityOrder rankings sequentially in the database
      for (let i = 0; i < orderedIds.length; i++) {
        const ruleId = orderedIds[i];
        
        await db
          .update(ticketAssignmentRules)
          .set({
            priorityOrder: i + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(ticketAssignmentRules.id, ruleId),
              eq(ticketAssignmentRules.orgId, req.user!.orgId)
            )
          );
      }

      return res.json({ message: "Assignment rules priority order updated successfully" });
    } catch (error) {
      console.error("Reorder assignment rules failed:", error);
      return res.status(500).json({ error: "Failed to update priority order" });
    }
  }
);

export default router;
