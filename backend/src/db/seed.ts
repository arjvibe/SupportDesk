import { db } from "./connection";
import { organizations, clients, users, slaPolicies, slaTargets } from "../schema";
import { hashPassword } from "../utils/auth";

async function seed() {
  console.log("Cleaning database tables...");
  // Clear tables in reverse dependency order
  await db.delete(users);
  await db.delete(clients);
  await db.delete(slaTargets);
  await db.delete(slaPolicies);
  await db.delete(organizations);

  console.log("Seeding multi-tenant organizations and clients database...");

  // 1. Create Organizations (Tenants / Host support desks)
  console.log("Creating host organizations...");
  const [auraOrg] = await db
    .insert(organizations)
    .values({
      name: "Aura Support",
      subdomain: "aura",
      subscriptionTier: "enterprise", // SaaS subscription tier
    })
    .returning();

  const [acmeOrg] = await db
    .insert(organizations)
    .values({
      name: "Acme Support",
      subdomain: "acme",
      subscriptionTier: "trial", // SaaS subscription tier
    })
    .returning();

  const [superadminOrg] = await db
    .insert(organizations)
    .values({
      name: "Super Admin Console",
      subdomain: "superadmin",
      subscriptionTier: "enterprise",
    })
    .returning();

  // 2. Create Default SLA Policies per Org
  console.log("Creating default SLA policies...");
  const [auraSla] = await db
    .insert(slaPolicies)
    .values({
      orgId: auraOrg.id,
      name: "Standard SLA",
      description: "Default SLA policy for Aura clients",
      isDefault: true,
      businessDays: ["1", "2", "3", "4", "5"], // Mon-Fri
    })
    .returning();

  const [acmeSla] = await db
    .insert(slaPolicies)
    .values({
      orgId: acmeOrg.id,
      name: "Acme Bronze SLA",
      description: "Default SLA policy for Acme clients",
      isDefault: true,
      businessDays: ["1", "2", "3", "4", "5"],
    })
    .returning();

  console.log("Inserting SLA targets...");
  await db.insert(slaTargets).values([
    { slaPolicyId: auraSla.id, priority: "urgent", responseTimeHours: 1, resolutionTimeHours: 4, escalateAfterHours: 2 },
    { slaPolicyId: auraSla.id, priority: "high", responseTimeHours: 4, resolutionTimeHours: 24, escalateAfterHours: 12 },
    { slaPolicyId: auraSla.id, priority: "normal", responseTimeHours: 12, resolutionTimeHours: 72, escalateAfterHours: 48 },
    { slaPolicyId: auraSla.id, priority: "low", responseTimeHours: 24, resolutionTimeHours: 168, escalateAfterHours: 120 },
  ]);

  await db.insert(slaTargets).values([
    { slaPolicyId: acmeSla.id, priority: "urgent", responseTimeHours: 1, resolutionTimeHours: 4, escalateAfterHours: 2 },
    { slaPolicyId: acmeSla.id, priority: "high", responseTimeHours: 4, resolutionTimeHours: 24, escalateAfterHours: 12 },
    { slaPolicyId: acmeSla.id, priority: "normal", responseTimeHours: 12, resolutionTimeHours: 72, escalateAfterHours: 48 },
    { slaPolicyId: acmeSla.id, priority: "low", responseTimeHours: 24, resolutionTimeHours: 168, escalateAfterHours: 120 },
  ]);

  // 3. Create Seed Users - Staff & Admins (clientId is null)
  console.log("Creating staff users...");
  const adminHash = await hashPassword("admin123");
  const agentHash = await hashPassword("agent123");
  const clientHash = await hashPassword("client123");
  const superadminHash = await hashPassword("superadmin123");

  // Seed Super Admin
  const [superAdmin] = await db
    .insert(users)
    .values({
      orgId: superadminOrg.id,
      clientId: null,
      email: "superadmin@platform.com",
      passwordHash: superadminHash,
      firstName: "Super",
      lastName: "Admin",
      role: "admin",
      jobTitle: "Platform Administrator",
      initials: "SA",
    })
    .returning();

  // Seed Aura host staff
  const [auraAdmin] = await db
    .insert(users)
    .values({
      orgId: auraOrg.id,
      clientId: null,
      email: "admin@aura.com",
      passwordHash: adminHash,
      firstName: "Aura",
      lastName: "Admin",
      role: "admin",
      jobTitle: "System Administrator",
      initials: "AD",
    })
    .returning();

  const [auraAgent] = await db
    .insert(users)
    .values({
      orgId: auraOrg.id,
      clientId: null,
      email: "agent@aura.com",
      passwordHash: agentHash,
      firstName: "Marcus",
      lastName: "Thompson",
      role: "agent",
      jobTitle: "Senior Specialist",
      initials: "MT",
    })
    .returning();

  // Seed Acme host staff
  const [acmeAdmin] = await db
    .insert(users)
    .values({
      orgId: acmeOrg.id,
      clientId: null,
      email: "admin@acme.com",
      passwordHash: adminHash,
      firstName: "Acme",
      lastName: "Admin",
      role: "admin",
      jobTitle: "Acme Administrator",
      initials: "AA",
    })
    .returning();

  const [acmeAgent] = await db
    .insert(users)
    .values({
      orgId: acmeOrg.id,
      clientId: null,
      email: "agent@acme.com",
      passwordHash: agentHash,
      firstName: "John",
      lastName: "Connor",
      role: "agent",
      jobTitle: "Support Specialist",
      initials: "JC",
    })
    .returning();

  // 4. Create Clients within Organizations (Customer Accounts)
  console.log("Creating customer clients...");
  
  // Aura Clients
  const [maison] = await db
    .insert(clients)
    .values({
      orgId: auraOrg.id,
      name: "Maison Atelier",
      domain: "maisonatelier.com",
      slaPolicyId: auraSla.id,
      clientTier: "enterprise", // Client tier
      ownerId: auraAgent.id,     // Marcus Thompson owns this account
    })
    .returning();

  const [northwind] = await db
    .insert(clients)
    .values({
      orgId: auraOrg.id,
      name: "Northwind Co.",
      domain: "northwind.com",
      slaPolicyId: auraSla.id,
      clientTier: "business",
      ownerId: auraAgent.id,
    })
    .returning();

  const [auraInternalClient] = await db
    .insert(clients)
    .values({
      orgId: auraOrg.id,
      name: "Aura Support Internal Client",
      domain: "aura.com",
      slaPolicyId: auraSla.id,
      clientTier: "enterprise",
      ownerId: auraAdmin.id,
    })
    .returning();

  // Acme Clients
  const [wayne] = await db
    .insert(clients)
    .values({
      orgId: acmeOrg.id,
      name: "Wayne Enterprises",
      domain: "wayne.com",
      slaPolicyId: acmeSla.id,
      clientTier: "enterprise",
      ownerId: acmeAgent.id,     // John Connor owns this account
    })
    .returning();

  const [cyberdyne] = await db
    .insert(clients)
    .values({
      orgId: acmeOrg.id,
      name: "Cyberdyne Systems",
      domain: "cyberdyne.com",
      slaPolicyId: acmeSla.id,
      clientTier: "business",
      ownerId: acmeAgent.id,
    })
    .returning();

  const [acmeInternalClient] = await db
    .insert(clients)
    .values({
      orgId: acmeOrg.id,
      name: "Acme Support Internal Client",
      domain: "acme.com",
      slaPolicyId: acmeSla.id,
      clientTier: "enterprise",
      ownerId: acmeAdmin.id,
    })
    .returning();

  // 5. Create Client Contact Users (clientId references clients.id)
  console.log("Creating client contacts...");
  
  // Aura client contacts
  await db.insert(users).values([
    {
      orgId: auraOrg.id,
      clientId: maison.id,
      email: "client@maison.com",
      passwordHash: clientHash,
      firstName: "Helena",
      lastName: "Saint",
      role: "client_user",
      jobTitle: "Senior Brand Designer",
      initials: "HS",
    },
  ]);

  // Acme client contacts
  await db.insert(users).values([
    {
      orgId: acmeOrg.id,
      clientId: wayne.id,
      email: "client@wayne.com",
      passwordHash: clientHash,
      firstName: "Bruce",
      lastName: "Wayne",
      role: "client_user",
      jobTitle: "Chairman",
      initials: "BW",
    },
  ]);

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
