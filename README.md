# Aura SupportDesk - Multi-Tenant Enterprise Helpdesk

A premium, multi-tenant customer support platform inspired by Freshdesk and Zendesk. Built with a typography-first minimalist aesthetic (the **Aura** theme), decoupling the backend and frontend into independent, maintainable workspaces.

---

## 1. System Terminology & Hierarchy

To maintain consistency across our database models, backend endpoints, and frontend components, team members must adhere to the following terminology:

```
                  ┌──────────────────────────────────┐
                  │   Organizations (Tenants / Orgs) │  e.g., Aura Support, Acme Support
                  └────────────────┬─────────────────┘
                                   │
            ┌──────────────────────┴──────────────────────┐
            ▼                                             ▼
   Org Agents & Admins                             Clients (Customer Accounts)
   (clientId: null)                                (e.g., Maison Atelier, Wayne Enterprises)
   (Manage tickets for this Org)                   (Belong to specific Org; have service tiers)
                                                          │
                                                          ▼
                                                   Client Users (Contacts)
                                                   (Submit tickets to the Org)
```

1. **Organizations (Orgs / Tenants)**: The host support teams that subscribe to our platform (e.g., `Aura Support`, `Acme Support`). Each Org operates on a dedicated subdomain (e.g., `aura.localhost` vs `acme.localhost`).
2. **Clients**: B2B customer accounts *within* an Org (e.g. `Maison Atelier` is a Client of `Aura Support`).
3. **Client Users (Contacts)**: External customer contacts belonging to a Client (e.g. Helena Saint). They log in via the Client Portal to submit tickets and view historical logs.
4. **Org Agents / Admins**: Host Org staff members. Admins manage the workspace settings (SLAs, rules, clients), and Agents triage and resolve tickets inside the Inbox.

---

## 2. Directory Structure

```
F:\LearningAIApps\SupportDesk\
├── ticket-support-system/   <-- Original visual reference (Untouched reference code)
├── backend/                  <-- Node.js + Express + Drizzle ORM + PostgreSQL
│   ├── src/
│   │   ├── db/              <-- Database client connection, schema wipe, and seeder
│   │   ├── middleware/      <-- Tenant/Org resolution, JWT auth, and role-based guards
│   │   ├── routes/          <-- Express API controllers (/auth, /clients)
│   │   ├── schema.ts        <-- Drizzle database schema (Fully commented)
│   │   └── server.ts        <-- API server entry point
│   ├── drizzle.config.ts
│   └── package.json
└── frontend/                 <-- React + Vite + Tailwind CSS v4 + TanStack Query
    ├── src/
    │   ├── components/      <-- Reusable UI elements (SiteNav, forms)
    │   ├── pages/           <-- Route-level pages (Gateway, Login, Clients, Inbox)
    │   ├── utils/           <-- API helpers and active subdomain parsers
    │   ├── styles.css       <-- Central CSS Theme configuration
    │   └── main.tsx
    └── package.json
```

---

## 3. Database Schema Layout

Our database is managed using **Drizzle ORM** pointing to PostgreSQL. The schema is defined with detailed JSDoc comments inside [backend/src/schema.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/schema.ts).

### Primary Tables
* **`organizations`**: Stores host Org workspaces, subdomains, and their SaaS subscription tiers.
* **`clients`**: Stores client accounts inside an Org. Contains `clientTier` (e.g. Enterprise, Business) and `ownerId` (account manager).
* **`users`**: Contains both staff (admins/agents) and client contacts. 
  * Staff: `clientId` is `NULL`, `orgId` = host Org.
  * Client Contacts: `clientId` = client account ID, `orgId` = host Org.
* **`tickets`**: Scoped by `orgId` for isolation and mapped to `clientId` for customer accountability.

---

## 4. Multi-Tenant Request Lifecycle

To guarantee complete isolation where Org A can never access Org B's records, every web request undergoes strict validation:

```
[Frontend Client]
       │ (Request to http://aura.localhost:5000/api/clients)
       ▼
[resolveTenant Middleware] ──(Fails)──► [404 Workspace Not Found]
       │ (Parses host to subdomain: "aura", loads Org UUID)
       ▼
[authenticateToken Middleware] ──(Orgs Mismatch)──► [403 Forbidden]
       │ (Checks JWT session.orgId === req.org.id)
       ▼
[requireRole Guard] ──(Unauthorized)──► [403 Forbidden]
       │ (Asserts req.user.role in ["admin", "agent"])
       ▼
[Route Controller] (Executes query filtered by req.user.orgId)
```

---

## 5. Setup & Development Startup

### A. Backend Workspace Configuration
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create your environment config file `.env` and insert your database connection string:
   ```env
   DATABASE_URL=postgres://postgres:Welcome@123@localhost:5432/aura_supportdesk
   JWT_SECRET=your_custom_development_secret_key
   ```
3. Wipe and initialize your database tables:
   ```bash
   npm run clean-db     # Drops public schema
   npm run push-db      # Applies clean Drizzle schemas
   npm run seed-db      # Seeds Org Aura & Org Acme with isolated clients and users
   ```
4. Start the backend dev server (port 5000):
   ```bash
   npm run dev
   ```

### B. Frontend Workspace Configuration
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Start the Vite client dev server:
   ```bash
   npm run dev
   ```

### C. Local Development Testing
Because this application relies on subdomains for Org partitioning, access the site in your browser using the following ports:
* **Tenant Gateway Page**: `http://localhost:5173`
* **Org Aura Workspace**: `http://aura.localhost:5173`
  * Admin Login: `admin@aura.com` / `admin123`
  * Agent Login: `agent@aura.com` / `agent123`
  * Client Contact Login: `client@maison.com` / `client123`
* **Org Acme Workspace**: `http://acme.localhost:5173`
  * Admin Login: `admin@acme.com` / `admin123`
  * Agent Login: `agent@acme.com` / `agent123`
  * Client Contact Login: `client@wayne.com` / `client123`

---

## 6. Email-To-Ticket Configuration

Aura SupportDesk now includes an email-to-ticket foundation. The application can accept inbound email payloads, create tickets, append email replies to existing tickets, and keep an inbound processing log per tenant.

### Platform-Level Settings

These settings are managed by the SaaS/platform operator in `backend/.env`:

```env
INBOUND_EMAIL_PROVIDER=dev
INBOUND_EMAIL_WEBHOOK_SECRET=replace_with_provider_webhook_secret
INBOUND_EMAIL_PUBLIC_BASE_URL=https://api.your-supportdesk-domain.com
INBOUND_EMAIL_MAX_ATTACHMENT_MB=10
```

For local development, `INBOUND_EMAIL_PROVIDER=dev` is enough. A real production provider such as Mailgun, Postmark, SendGrid, or AWS SES requires DNS/MX setup and a webhook pointed at:

```txt
https://api.your-supportdesk-domain.com/api/inbound-email/{provider}
```

If `INBOUND_EMAIL_WEBHOOK_SECRET` is set, provider webhook requests must include the same value in the `x-inbound-email-secret` header or `?secret=` query parameter.

### Tenant Admin Settings

Org admins configure workspace behavior in:

```txt
Settings -> Email Channel
```

Available settings:

* Support email address, for example `acme@support.yourapp.com`
* Email-to-ticket active/inactive toggle
* Default client, optional
* Default team, optional
* Default priority
* Unknown sender policy: quarantine, reject, or create contact when a client domain matches
* Reply behavior: reopen resolved tickets, ignore closed tickets, or allow replies
* Auto-acknowledgement email for new tickets

The support email address is globally unique across workspaces and maps inbound provider webhooks to the correct organization.

### Development Test Flow

You do not need to buy a domain or email provider to test the business flow locally.

1. Start backend and frontend.
2. Log in as an org admin, for example `admin@aura.com`.
3. Open `Settings -> Email Channel`.
4. Set the support email address, for example `aura@support.localhost`.
5. Save the settings.
6. Use the "Test Inbound Email" panel to queue a sample inbound email.
7. The background worker processes the `inbound_email` job and creates a ticket or quarantines the email.
8. Review the "Recent Inbound Emails" table for processing status.

Production email delivery still requires a real domain/subdomain, MX records, and an inbound email provider.
