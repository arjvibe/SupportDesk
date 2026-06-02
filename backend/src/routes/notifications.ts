import { Router, Request, Response } from "express";
import { db } from "../db/connection";
import { inAppNotifications } from "../schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth";

const router = Router();

/**
 * GET /api/notifications
 * 
 * Lists in-app notifications for the active user, ordered by creation date descending.
 */
router.get(
  "/",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const list = await db
        .select()
        .from(inAppNotifications)
        .where(
          and(
            eq(inAppNotifications.orgId, req.user!.orgId),
            eq(inAppNotifications.userId, req.user!.userId)
          )
        )
        .orderBy(desc(inAppNotifications.createdAt))
        .limit(50);

      return res.json(list);
    } catch (error) {
      console.error("Retrieve user notifications failed:", error);
      return res.status(500).json({ error: "Failed to retrieve notifications" });
    }
  }
);

/**
 * PUT /api/notifications/:id/read
 * 
 * Marks a specific notification as read.
 */
router.put(
  "/:id/read",
  authenticateToken,
  async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
      const [updated] = await db
        .update(inAppNotifications)
        .set({ isRead: true })
        .where(
          and(
            eq(inAppNotifications.id, id),
            eq(inAppNotifications.userId, req.user!.userId),
            eq(inAppNotifications.orgId, req.user!.orgId)
          )
        )
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "Notification not found or access denied" });
      }

      return res.json(updated);
    } catch (error) {
      console.error("Mark notification as read failed:", error);
      return res.status(500).json({ error: "Failed to update notification" });
    }
  }
);

/**
 * PUT /api/notifications/read-all
 * 
 * Marks all notifications as read for the active user.
 */
router.put(
  "/read-all",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const updated = await db
        .update(inAppNotifications)
        .set({ isRead: true })
        .where(
          and(
            eq(inAppNotifications.userId, req.user!.userId),
            eq(inAppNotifications.orgId, req.user!.orgId),
            eq(inAppNotifications.isRead, false)
          )
        )
        .returning();

      return res.json({ count: updated.length });
    } catch (error) {
      console.error("Mark all notifications as read failed:", error);
      return res.status(500).json({ error: "Failed to update notifications" });
    }
  }
);

export default router;
