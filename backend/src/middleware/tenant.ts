import { Request, Response, NextFunction } from "express";
import { db } from "../db/connection";
import { organizations } from "../schema";
import { eq, or } from "drizzle-orm";

/**
 * Scoped context metadata representing the active host organization (tenant)
 */
export type OrgContext = {
  id: string;
  name: string;
  subdomain: string;
  subscriptionTier: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

declare global {
  namespace Express {
    interface Request {
      /**
       * The currently resolved host organization context for the request.
       */
      org?: OrgContext;
    }
  }
}

/**
 * Utility helper to parse the subdomain from a Host header.
 * Works for local dev subdomains (e.g. acme.localhost:5000 -> acme) 
 * and production subdomains (e.g. acme.aura.com -> acme).
 * 
 * @param host The request host header
 * @returns The parsed subdomain string, or null if none
 */
export function parseSubdomain(host: string | undefined): string | null {
  if (!host) return null;
  
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");
  
  if (parts.length > 1) {
    if (parts[parts.length - 1] === "localhost") {
      if (parts.length === 2) {
        return parts[0];
      }
      return null;
    }
    if (parts.length >= 3) {
      return parts[0];
    }
  }
  
  return null;
}

/**
 * Express middleware to resolve the active Org (tenant) context for a request.
 * Resolves by looking up the subdomain of the Host header.
 * 
 * Fallbacks are provided for direct local API calls (x-tenant-id header or tenant query parameter).
 * Injects `req.org` on success.
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction) {
  let subdomain = parseSubdomain(req.headers.host);
  
  const tenantHeader = req.headers["x-tenant-id"] as string;
  const tenantParam = req.query.tenant as string;
  
  try {
    let orgRecord;
    
    if (subdomain) {
      const list = await db
        .select()
        .from(organizations)
        .where(eq(organizations.subdomain, subdomain))
        .limit(1);
      if (list.length > 0) {
        orgRecord = list[0];
      }
    }
    
    // Fallback lookups
    if (!orgRecord && (tenantHeader || tenantParam)) {
      const identifier = tenantHeader || tenantParam;
      const list = await db
        .select()
        .from(organizations)
        .where(
          or(
            eq(organizations.id, identifier),
            eq(organizations.subdomain, identifier)
          )
        )
        .limit(1);
      if (list.length > 0) {
        orgRecord = list[0];
      }
    }
    
    if (!orgRecord) {
      return res.status(404).json({
        error: "Organization not found",
        message: "The requested workspace does not exist or has been deactivated."
      });
    }
    
    if (!orgRecord.isActive) {
      return res.status(403).json({
        error: "Workspace suspended",
        message: "This workspace has been temporarily suspended."
      });
    }
    
    // Inject Org context
    req.org = {
      id: orgRecord.id,
      name: orgRecord.name,
      subdomain: orgRecord.subdomain,
      subscriptionTier: orgRecord.subscriptionTier,
      logoUrl: orgRecord.logoUrl,
      primaryColor: orgRecord.primaryColor,
      secondaryColor: orgRecord.secondaryColor,
    };
    
    next();
  } catch (err) {
    console.error("Error resolving organization tenant:", err);
    return res.status(500).json({ error: "Internal server error resolving workspace" });
  }
}
