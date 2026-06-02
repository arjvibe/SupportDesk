import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { teams, agentTeamMapping, users } from "../schema";
import { eq, and, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { authenticateToken, requireRole } from "../middleware/auth";

const router = Router();

// Aliasing for joining lead user mapping
const leadMapping = alias(agentTeamMapping, "lead_mapping");
const leadUsers = alias(users, "lead_users");

/**
 * GET /api/teams
 * 
 * Retrieves all teams belonging to the authenticated user's organization.
 * For each team, it performs left joins to calculate:
 * 1. The total count of agents assigned to the team.
 * 2. The details of the team lead (if designated via `isLead = true`).
 * 
 * @param req Express Request object containing authenticated user context in `req.user`
 * @param res Express Response object returning the JSON list of teams
 */
router.get(
  "/",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    try {
      const teamList = await db
        .select({
          id: teams.id,
          name: teams.name,
          description: teams.description,
          createdAt: teams.createdAt,
          lead: {
            id: leadUsers.id,
            firstName: leadUsers.firstName,
            lastName: leadUsers.lastName,
            initials: leadUsers.initials,
          },
          agentCount: sql<number>`count(distinct ${agentTeamMapping.agentId})`.mapWith(Number),
        })
        .from(teams)
        .leftJoin(agentTeamMapping, eq(teams.id, agentTeamMapping.teamId))
        .leftJoin(
          leadMapping,
          and(eq(teams.id, leadMapping.teamId), eq(leadMapping.isLead, true))
        )
        .leftJoin(leadUsers, eq(leadMapping.agentId, leadUsers.id))
        .where(eq(teams.orgId, req.user!.orgId))
        .groupBy(teams.id, leadUsers.id);

      return res.json(teamList);
    } catch (error) {
      console.error("List teams failed:", error);
      return res.status(500).json({ error: "Failed to retrieve support teams" });
    }
  }
);

/**
 * GET /api/teams/agents/available
 * 
 * Lists all staff members (agents and admins) in the organization.
 * Joins agentTeamMapping to return the count of teams each staff member belongs to.
 * Used by the frontend to compute assigned staff statistics and populate assignment dropdowns.
 * 
 * @param req Express Request object containing authenticated user context
 * @param res Express Response object returning the JSON list of available staff users with teamCount
 */
router.get(
  "/agents/available",
  authenticateToken,
  requireRole(["admin", "agent"]),
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
          teamCount: sql<number>`count(distinct ${agentTeamMapping.teamId})`.mapWith(Number),
        })
        .from(users)
        .leftJoin(agentTeamMapping, eq(users.id, agentTeamMapping.agentId))
        .where(
          and(
            eq(users.orgId, req.user!.orgId),
            or(eq(users.role, "admin"), eq(users.role, "agent"))
          )
        )
        .groupBy(users.id);
      return res.json(staffList);
    } catch (error) {
      console.error("List available staff failed:", error);
      return res.status(500).json({ error: "Failed to retrieve available staff" });
    }
  }
);

/**
 * POST /api/teams
 * 
 * Registers a new specialty support team under the active organization.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing `name` and `description` in the body
 * @param res Express Response object returning the newly created team
 */
router.post(
  "/",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Team name is required" });
    }

    try {
      // Prevent duplicate team names within the same Org
      const existingTeam = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.name, name),
            eq(teams.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (existingTeam.length > 0) {
        return res.status(400).json({ error: "A support team with this name already exists" });
      }

      const [newTeam] = await db
        .insert(teams)
        .values({
          orgId: req.user!.orgId,
          name,
          description: description || null,
        })
        .returning();

      return res.status(201).json(newTeam);
    } catch (error) {
      console.error("Create team failed:", error);
      return res.status(500).json({ error: "Failed to create support team" });
    }
  }
);

/**
 * GET /api/teams/:id/agents
 * 
 * Lists all agents currently mapped to the specified support team.
 * Includes user metadata alongside mapping attributes like `isLead`.
 * 
 * @param req Express Request object containing team ID in `req.params.id`
 * @param res Express Response object returning the list of assigned agents
 */
router.get(
  "/:id/agents",
  authenticateToken,
  requireRole(["admin", "agent"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      // 1. Verify the team exists and belongs to the active organization
      const teamRecord = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.id, id),
            eq(teams.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (teamRecord.length === 0) {
        return res.status(404).json({ error: "Support team not found" });
      }

      // 2. Fetch all mapped agents and their user info
      const teamAgents = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
          role: users.role,
          jobTitle: users.jobTitle,
          initials: users.initials,
          isLead: agentTeamMapping.isLead,
        })
        .from(agentTeamMapping)
        .innerJoin(users, eq(agentTeamMapping.agentId, users.id))
        .where(eq(agentTeamMapping.teamId, id));

      return res.json(teamAgents);
    } catch (error) {
      console.error("List team agents failed:", error);
      return res.status(500).json({ error: "Failed to retrieve team members" });
    }
  }
);

/**
 * POST /api/teams/:id/agents
 * 
 * Assigns an agent to a support team, with an optional flag designating them as team lead.
 * Ensures the agent and the team belong to the same host organization.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing team ID in params, and `agentId`, `isLead` in the body
 * @param res Express Response object indicating success
 */
router.post(
  "/:id/agents",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const { agentId, isLead } = req.body;

    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    try {
      // 1. Verify the team exists and belongs to the active organization
      const teamRecord = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.id, id),
            eq(teams.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (teamRecord.length === 0) {
        return res.status(404).json({ error: "Support team not found" });
      }

      // 2. Verify the agent exists, belongs to the active organization, and is staff (admin or agent)
      const agentUser = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.id, agentId),
            eq(users.orgId, req.user!.orgId),
            or(eq(users.role, "admin"), eq(users.role, "agent"))
          )
        )
        .limit(1);

      if (agentUser.length === 0) {
        return res.status(400).json({ error: "Invalid agent selected. Must be an internal staff member of this workspace." });
      }

      // 3. Verify the agent is not already assigned to the team
      const existingMapping = await db
        .select()
        .from(agentTeamMapping)
        .where(
          and(
            eq(agentTeamMapping.teamId, id),
            eq(agentTeamMapping.agentId, agentId)
          )
        )
        .limit(1);

      if (existingMapping.length > 0) {
        return res.status(400).json({ error: "Agent is already assigned to this support team" });
      }

      // 4. Create mapping record
      await db.insert(agentTeamMapping).values({
        teamId: id,
        agentId,
        isLead: !!isLead,
      });

      return res.status(201).json({ message: "Agent assigned to support team successfully" });
    } catch (error) {
      console.error("Assign agent failed:", error);
      return res.status(500).json({ error: "Failed to assign agent to support team" });
    }
  }
);

/**
 * DELETE /api/teams/:id/agents/:agentId
 * 
 * Removes an agent mapping from the support team.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing team ID and agent ID in params
 * @param res Express Response object indicating success
 */
router.delete(
  "/:id/agents/:agentId",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id, agentId } = req.params;

    try {
      // 1. Verify the team exists and belongs to the active organization
      const teamRecord = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.id, id),
            eq(teams.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (teamRecord.length === 0) {
        return res.status(404).json({ error: "Support team not found" });
      }

      // 2. Perform the deletion of the agent-team mapping
      const result = await db
        .delete(agentTeamMapping)
        .where(
          and(
            eq(agentTeamMapping.teamId, id),
            eq(agentTeamMapping.agentId, agentId)
          )
        );

      return res.json({ message: "Agent unassigned from support team successfully" });
    } catch (error) {
      console.error("Remove agent failed:", error);
      return res.status(500).json({ error: "Failed to remove agent from support team" });
    }
  }
);

/**
 * PUT /api/teams/:id/agents/:agentId/lead
 * 
 * Updates or toggles an agent's `isLead` status for the specified support team.
 * Access is restricted to Admins only.
 * 
 * @param req Express Request object containing team ID, agent ID, and `isLead` boolean in the body
 * @param res Express Response object indicating success
 */
router.put(
  "/:id/agents/:agentId/lead",
  authenticateToken,
  requireRole(["admin"]),
  async (req: Request, res: Response) => {
    const { id, agentId } = req.params;
    const { isLead } = req.body;

    if (isLead === undefined) {
      return res.status(400).json({ error: "isLead parameter is required in the request body" });
    }

    try {
      // 1. Verify the team exists and belongs to the active organization
      const teamRecord = await db
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.id, id),
            eq(teams.orgId, req.user!.orgId)
          )
        )
        .limit(1);

      if (teamRecord.length === 0) {
        return res.status(404).json({ error: "Support team not found" });
      }

      // 2. Update the team lead flag on the mapping
      const result = await db
        .update(agentTeamMapping)
        .set({ isLead: !!isLead })
        .where(
          and(
            eq(agentTeamMapping.teamId, id),
            eq(agentTeamMapping.agentId, agentId)
          )
        );

      return res.json({ message: "Agent team lead status updated successfully" });
    } catch (error) {
      console.error("Update team lead status failed:", error);
      return res.status(500).json({ error: "Failed to update team lead status" });
    }
  }
);

export default router;
