import { db } from "../db/connection";
import { organizations } from "../schema";
import { eq } from "drizzle-orm";

/**
 * Dynamically resolves the front-end URL for a given organization ID by looking up
 * its subdomain and combining it with the configured CORS_ORIGIN base domain.
 * 
 * E.g., for local development:
 *   CORS_ORIGIN = "http://localhost:5173"
 *   Subdomain = "aura"
 *   Result = "http://aura.localhost:5173"
 * 
 * E.g., for production:
 *   CORS_ORIGIN = "https://ergodemy.com"
 *   Subdomain = "aura"
 *   Result = "https://aura.ergodemy.com"
 * 
 * @param orgId The organization UUID
 * @returns The fully qualified front-end tenant base URL
 */
export async function getTenantUrlByOrgId(orgId: string): Promise<string> {
  const [org] = await db
    .select({ subdomain: organizations.subdomain })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  const subdomain = org?.subdomain || "localhost";
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

  try {
    const url = new URL(corsOrigin);
    // Construct the subdomain-based origin
    return `${url.protocol}//${subdomain}.${url.host}`;
  } catch (error) {
    console.error("❌ [URL Utility] Failed to parse CORS_ORIGIN as URL, falling back to localhost:", error);
    return `http://${subdomain}.localhost:5173`;
  }
}
