# Walkthrough - Hierarchical Multi-Tenant Migration Complete

We have completed the transition of Aura SupportDesk from a single-tenant workspace to a **hierarchical multi-tenant SaaS architecture**! 

---

## 1. Accomplishments & Architecture Design

### Core Schema Updates
* **Tenants Isolation**: Created the [tenants](file:///f:/LearningAIApps/SupportDesk/backend/src/schema.ts#L48) table to serve as the parent partition for all data.
* **Foreign Keys & Indices**: Scoped the `users`, `organizations`, `sla_policies`, `teams`, `tickets`, `ticket_assignment_rules`, and `kb_articles` tables with mandatory `tenantId` columns. Added composite indices and tenant-specific uniqueness constraints (e.g., email address uniqueness is now scoped per tenant).

### Backend Middleware & Auth
* **Subdomain Resolution**: Added a [tenant.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/middleware/tenant.ts) middleware that automatically extracts the active workspace subdomain from the `Host` header (supporting both development subdomains like `aura.localhost` and production subdomains).
* **Cross-Tenant Access Prevention**: Scoped login searches to the active tenant. Encoded `tenantId` inside the JWT session token, and verified in the auth guard that the session's tenant matches the request's subdomain tenant context.

### Frontend Routing
* **API Dynamic Scoping**: Replaced static URLs with the [getApiBase()](file:///f:/LearningAIApps/SupportDesk/frontend/src/utils/api.ts#L5) utility to automatically route requests to the correct subdomain backend port (e.g. `acme.localhost:5000/api`).
* **Gateway Selector Page**: Implemented a workspace selector screen at the root hostname (`http://localhost:5173`) that lets users input their subdomain and redirects them (e.g. to `http://aura.localhost:5173`).

### Database Migrations & Deployability
* **AWS Deployable Migrations**: Cleaned and regenerated the Drizzle migrations to produce a clean, unified [0000_public_senator_kelly.sql](file:///f:/LearningAIApps/SupportDesk/backend/src/db/migrations/0000_public_senator_kelly.sql) script representing the entire starting database schema.
* **Effective Sequential Updates**: Configured Drizzle-Kit so any future module database modifications automatically generate sequential, versioned SQL migration scripts, ensuring staging/production databases on AWS can be upgraded cleanly using `npm run db:migrate`.

---

## 2. Dev Environment Reset & Seeding

We cleaned the database and re-seeded it with two distinct tenants:
1. **Tenant: Aura Support** (subdomain: `aura`)
   * Admin: `admin@aura.com` / `admin123`
   * Agent: `agent@aura.com` / `agent123`
   * Client: `client@maison.com` / `client123`
2. **Tenant: Acme Support** (subdomain: `acme`)
   * Admin: `admin@acme.com` / `admin123`
   * Agent: `agent@acme.com` / `agent123`
   * Client: `client@wayne.com` / `client123`

---

## 3. Manual Verification Steps

Ensure both local dev servers are active. Since we updated settings, restart them if needed:
* **Backend Dev Server**: `npm run dev` in `backend/`
* **Frontend Dev Server**: `npm run dev` in `frontend/`

Open your browser and perform the following isolation test:

### Step A: Subdomain Redirect
1. Go to **`http://localhost:5173`**. You will be greeted by the Aura Workspace Gateway.
2. Enter `aura` and click **Access Workspace**.
3. You should be redirected to **`http://aura.localhost:5173/`**.

### Step B: Tenant Authentication & Isolation
1. Try logging in on the `aura` subdomain using Acme credentials:
   * **Email**: `admin@acme.com`
   * **Password**: `admin123`
   * **Result**: Login fails with `Invalid email or password` (confirming users cannot log into incorrect tenant workspaces).
2. Log in using Aura credentials:
   * **Email**: `admin@aura.com`
   * **Password**: `admin123`
   * **Result**: Login succeeds. Click on the **Clients** tab: you should see **Maison Atelier** and **Northwind Co.**
3. Create a new organization: name it `Aura VIP Customer` with domain `auravip.com`. Click **Create Account**.

### Step C: Cross-Tenant Check
1. Log out, and navigate to **`http://acme.localhost:5173/`**.
2. Log in using Acme credentials:
   * **Email**: `admin@acme.com`
   * **Password**: `admin123`
3. Click the **Clients** tab:
   * **Result**: You should see **Wayne Enterprises** and **Cyberdyne Systems**. There is **no trace** of "Maison Atelier" or "Aura VIP Customer", verifying complete tenant-level security and data isolation!

---

## 4. Module 3: Agent & Team Management Complete

We have fully implemented support for internal support departments and member management.

### Backend Endpoints
Mounted under `/api/teams` in [server.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/server.ts):
* **GET `/api/teams`**: Lists teams for the authenticated user's organization context, joining mapping tables to aggregate members and the designated team lead.
* **POST `/api/teams`**: Registers a new support group. Scoped to Admin role.
* **GET `/api/teams/:id/agents`**: Lists all members of a specific team.
* **POST `/api/teams/:id/agents`**: Assigns an agent/admin to a team. Scoped to Admin role.
* **DELETE `/api/teams/:id/agents/:agentId`**: Removes an agent from a team. Scoped to Admin role.
* **PUT `/api/teams/:id/agents/:agentId/lead`**: Updates or toggles an agent's leadership status. Scoped to Admin role.
* **GET `/api/teams/agents/available`**: Retrieves all available staff in the organization, including their current `teamCount` to populate stats dashboard.

### Frontend Dashboard
Implemented in [Teams.tsx](file:///f:/LearningAIApps/SupportDesk/frontend/src/pages/Teams.tsx):
* **Editorial Header & Action Buttons**: Features an aesthetic page title and `+ New Team` action button.
* **Analytics Stats Dashboard**: Renders real-time counters for teams, total staff members, and assigned agents.
* **Grid Layout Cards**: Displays support teams as responsive cards showing member counts and designated team leads. Clicking a card drills down to the detail dashboard.
* **Drilldown Directory View**: Lists team members in a high-density, structured list. Permits Admins to toggle lead designations or remove members.
* **Overlay Modals**: Includes "+ New Team" and "+ Add Agent" overlays to assign team members.

### Manual Verification Steps for Module 3
1. Log in to `http://aura.localhost:5173` as **`admin@aura.com`** / **`admin123`**.
2. Click the **Teams** tab in the top navigation.
3. Click **+ New Team**, fill in name `Technical Tier 1` and a description, then click **Create Team**.
4. Click on the `Technical Tier 1` grid card to enter the drilldown view.
5. Click **Add Agent**, select `Marcus Thompson (agent)`, check **Designate as Team Lead**, and click **Add Team Member**.
6. Verify Marcus is listed in the members directory with a lead indicator and star badge.
7. Click **Make Lead** / **Lead** button next to Marcus to toggle his lead status, confirming it updates live in the database.
8. Log out, then log in as **`agent@aura.com`** / **`agent123`** (Marcus).
9. Navigate to the **Teams** tab: verify Marcus can see the directory but cannot see administrative controls (e.g. `+ New Team`, `Add Agent`, `Remove Agent`, or `Make Lead` buttons are hidden).

---

## 5. Org Staff Management UI Complete

Admins can now manage the organization's staff accounts (agents and admins) directly in the UI instead of relying on database seed scripts.

### Backend Endpoints
Mounted under `/api/staff` in [server.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/server.ts):
* **GET `/api/staff`**: Lists all internal staff members (users where `clientId` is null) belonging to the active organization, including their active team membership count.
* **POST `/api/staff`**: Registers a new internal staff member. Computes initials, hashes the password, and inserts the user. Scoped to Admin role.
* **PUT `/api/staff/:id`**: Updates profile details (firstName, lastName, email, jobTitle, role, and active status toggle). Scoped to Admin role.

### Frontend Staff Dashboard
Implemented in [Staff.tsx](file:///f:/LearningAIApps/SupportDesk/frontend/src/pages/Staff.tsx):
* **Aesthetic Dashboard Summary**: Counters representing total staff, total administrators, and total support agents.
* **Staff Directory Grid**: High-density table listing all staff members with avatars, role badges, and active status flags.
* **Drilldown Profile Editor**: Clicking a row opens a details panel where Admins can modify details, adjust roles, and soft-deactivate/reactivate members.
* **Overlay Modal Forms**: "+ New Staff" overlay to quickly register new agents/admins with credentials.

### Manual Verification Steps for Staff UI
1. Log in to `http://aura.localhost:5173` as **`admin@aura.com`** / **`admin123`**.
2. Click the new **Staff** tab in the top navigation bar.
3. Click **+ New Staff**, fill in details for a new user (e.g., `Sarah Connor`, `sarah.connor@aura.com`, temporary password, role Agent, job title Specialist), and click **Register Staff User**.
4. Verify that Sarah appears in the list and the "Support Agents" counter increments.
5. Click on `Sarah Connor` to open the editor panel. Change her role to `Administrator`, set her status to `Inactive` using the toggle switch, and click **Save Changes**.
6. Verify that Sarah's status displays as a red dot (Inactive) in the table and the administrators count changes.
7. Try logging out and logging in as `sarah.connor@aura.com`: verify that access is blocked because the account is deactivated.
8. Re-login as `admin@aura.com`, click **Staff**, click `Sarah Connor`, toggle her back to **Active**, and verify she can now log in successfully.

---

## 6. Module 4: SLA Management Complete

We have fully implemented the Service Level Agreement configuration tools and the backend working calendar timers.

### Backend SLA Engine & Endpoints
Mounted under `/api/sla` in [server.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/server.ts):
* **SLA Target Due Calculator**: Built a business time calculator in [utils/sla.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/utils/sla.ts) that computes response/resolution deadlines. It ignores non-business days and only decrements working minutes during custom business calendar hours (e.g. 09:00 - 18:00), automatically rolling over weekends and after-hours. Passed all scratch test checks.
* **GET `/api/sla`**: Lists SLA policies for the Org.
* **GET `/api/sla/:id`**: Fetches a policy detail with its array of priority targets (Low, Normal, High, Urgent).
* **POST `/api/sla`**: Creates a new policy and initializes standard priority targets automatically. Scoped to Admin.
* **PUT `/api/sla/:id`**: Updates policy name, description, start/end hours, and active days list. Scoped to Admin.
* **PUT `/api/sla/:id/targets`**: Updates target response, resolution, and warning thresholds in a bulk transaction. Scoped to Admin.
* **POST `/api/sla/:id/default`**: Re-assigns the default SLA policy flag across the Org. Scoped to Admin.

### Frontend Settings Dashboard
Rewritten in [SlaSettings.tsx](file:///f:/LearningAIApps/SupportDesk/frontend/src/pages/SlaSettings.tsx):
* **Split Layout View**: Directory of active policies on the left and full editor forms on the right.
* **Business Hours Controls**: Day buttons to toggle working days, and time input selectors for working hours.
* **Matrix Threshold Editor**: Card list for Urgent, High, Normal, and Low priorities with number inputs for Response target, Resolution target, and Escalation offset.
* **Form Validation**: Asserts that response target hours do not exceed resolution targets before submitting.

### Manual Verification Steps for SLA UI
1. Log in to `http://aura.localhost:5173` as **`admin@aura.com`** / **`admin123`**.
2. Click the **SLA Policy** tab in the top navigation bar.
3. Verify that the "Standard SLA" policy is listed on the left and selected by default.
4. On the right, click the **Wed** button to toggle Wednesday to inactive, and change the working hours start time to `08:00`.
5. Under SLA Target Thresholds, set **Urgent** Response target to `2` hours and Resolution target to `6` hours.
6. Click **Save Policy Settings** at the top right: verify the green success alert banner pops up.
7. Click **+ New Policy** at the top right. Enter `Premium Gold Policy` and a description, then click **Create Policy**.
8. Verify that the list updates, selects `Premium Gold Policy`, and populates default matrix thresholds.
9. Click **Make Org Default**: verify that `Premium Gold Policy` receives the default badge and becomes the Org standard.

---

## 7. Module 5: Rule Setup (Automated Routing Engine) Complete

We have fully implemented the sequential ticket routing engine and its matching conditions configuration interface.

### Backend Routing Engine & Endpoints
Mounted under `/api/rules` in [server.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/server.ts):
* **Automated Routing Engine**: Implemented routing logic in [utils/routing.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/utils/routing.ts). Evaluates tickets against rules in sequential `priorityOrder` rank. Supports two routing modes:
  * **Direct Assignment**: Statically routes tickets to a designated team/agent.
  * **Round-Robin Assignment**: Workload-balanced distribution that resolves the target team's active staff member with the lowest count of open tickets.
* **GET `/api/rules`**: Retrieves all routing rules registered under the active organization, sorted by priority.
* **POST `/api/rules`**: Creates a new rule, auto-computing the next sequential `priorityOrder`. Scoped to Admin.
* **PUT `/api/rules/:id`**: Updates rule names, conditions, targets, and deactivation toggles. Scoped to Admin.
* **DELETE `/api/rules/:id`**: Deletes a rule and shifts down the `priorityOrder` values of subsequent rules by 1 to maintain a gapless sequential index. Scoped to Admin.
* **PUT `/api/rules/reorder`**: Reorders rules ranks in the database using a sequence array. Scoped to Admin.

### Frontend Routing Rules Dashboard
Implemented in [Rules.tsx](file:///f:/LearningAIApps/SupportDesk/frontend/src/pages/Rules.tsx):
* **Priority Evaluation List**: Renders rules as cards indicating their sequential `#1`, `#2` priority badges, matching criteria, and assignment targets.
* **Priority Reordering Arrows**: Admin-only controls to shift rules up/down, instantly persisting new ranks via `PUT /api/rules/reorder`.
* **Overlay Modals & Inline Editors**: Permissive modals for registering new rules, choosing match fields (`priority`, `category`, `client`), and configuring target destinations.

### Manual Verification Steps for Rules UI
1. Log in to `http://aura.localhost:5173` as **`admin@aura.com`** / **`admin123`**.
2. Click the new **Rules** navigation link.
3. Verify that the rules priority list is empty or shows initial defaults.
4. Click **+ New Rule**, fill in name `Billing Queue Rule`, select match field `Category / Workstream`, input criteria value `billing`, select target team `Billing Team`, set assignment mode to `Round-Robin`, and click `Create Rule`.
5. Verify `Billing Queue Rule` appears as `#1` in the priority list.
6. Click **+ New Rule** again, name it `Urgent VIP Triaging`, match field `Priority`, value `urgent`, target team `Technical Tier 1`, assignment mode `Direct`, and select `Marcus Thompson` as the target agent. Click `Create Rule`.
7. Verify `Urgent VIP Triaging` is listed at priority `#2`.
8. Click the down arrow icon on `Billing Queue Rule` or the up arrow icon on `Urgent VIP Triaging` to swap their positions. Verify that their ranks change visually and sequentially persist as `#1` and `#2` in the database.
9. Click **Edit** next to `Billing Queue Rule`. Change its name to `Billing and Invoicing Team`, set status to `Inactive`, and save. Verify the card matches the new details and displays opacity indicating its deactivation.
10. Click **Edit** again, then click **Delete Rule** at the top right, confirming the deletion. Verify that `Urgent VIP Triaging` shifts up to position `#1` automatically.

---

## 8. Module 6: Ticket Management & Client Portal Complete

We have fully implemented the end-to-end ticketing loop, including client submissions, SLA calculations, automatic rule routing, public replies, agent-only internal notes, audit trails, ticket merging, and CSAT experience ratings.

### Backend Endpoints
Mounted under `/api/tickets` in [server.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/server.ts):
- **GET `/api/tickets`**: Lists tickets filtered by status, priority, assignee, team, client, and search. Restricts client users to their own company's tickets.
- **POST `/api/tickets`**: Registers a new support ticket. Resolves active SLA policy, computes `slaResponseDueAt` and `slaResolutionDueAt` based on SLA priority hours, executes automated routing via `routeTicket`, and writes audit log entries.
- **GET `/api/tickets/:id`**: Retrieves full ticket details, including scrollable message history, audit logs, and CSAT feedback.
- **POST `/api/tickets/:id/messages`**: Adds replies or notes. Automatically resolves SLA response compliance on first agent response, and updates ticket status where appropriate (e.g. from `new` to `open` when an agent replies).
- **PUT `/api/tickets/:id`**: Updates ticket fields (status, priority, assignee, team, workstream). Audits updates and records `resolvedAt` timestamps on resolution.
- **POST `/api/tickets/merge`**: Clones message threads from child duplicate ticket to parent, closes the child, and maps `ticketMerges`.
- **POST `/api/tickets/:id/feedback`**: Records CSAT experience ratings (1-5 stars) and comments on resolved tickets.

### Frontend Client Portal & Agent Inbox
- **Client Portal** ([ClientPortal.tsx](file:///f:/LearningAIApps/SupportDesk/frontend/src/pages/ClientPortal.tsx)): Displays client company context, support request submit forms, search directories of submitted cases, detailed conversation timeline drawers, and star CSAT satisfaction feedback widgets.
- **Agent Inbox** ([Inbox.tsx](file:///f:/LearningAIApps/SupportDesk/frontend/src/pages/Inbox.tsx)): Features a high-density queue list categorized by tab groups (All, Mine, Unassigned, Priority), a comprehensive timeline merging public conversation items with amber-alert internal agent notes and system audit events, a metadata properties sidebar, team/agent assign selectors, and duplicates merging dialogs.

### Manual Verification Steps for Module 6
1. Log in to `http://aura.localhost:5173` as client user **`client@maison.com`** / **`client123`**.
2. Click **Create Support Request**. Fill in Subject `Dashboard API Timeout`, Description `API times out when fetching Maison orders catalog`, Priority `High (Service Impaired)`, Category `api`, and click **Submit Support Request**.
3. Verify that the view switches to the ticket conversation details indicating it's unresolved and on-track.
4. Log out, and log in as administrator **`admin@aura.com`** / **`admin123`**.
5. Click **Inboxes** in the top navigation.
6. Verify `Dashboard API Timeout` appears in the left ticket list with high priority and an "on-track" SLA indicator.
7. Click the ticket. Verify the description details load in the middle pane, showing an audit log item: `System Auto-Routing engine matching rule '...' assigned this ticket`.
8. Change the assignee in the right properties sidebar to yourself (`admin@aura.com`), category to `dashboard`, and verify the audit logs update.
9. In the composer, click **Internal Note** and type: `Need to investigate query performance on DB.`, then click **Post Internal Note**. Verify it appears highlighted in yellow/amber.
10. Switch the composer back to **Public Reply** and write: `Hi team, we are looking into the orders dash performance. Will update shortly.`, and click **Send Response**. Verify it updates the status to `open` and marks SLA response compliance.
11. Log out and log back in as `client@maison.com`: open the ticket details in your Client Portal, verify the public response appears (internal note is hidden), and submit a reply.
12. Log out and log back in as `admin@aura.com`. Change the ticket status to **Resolved** in the sidebar.
13. Log back in as `client@maison.com`. Verify the ticket shows as resolved, displaying the CSAT experience form. Select **5 Stars**, write comment `Great response speed!`, and submit feedback. Verify feedback records cleanly.

---

## 9. Module 8: Email-To-Ticket Foundation

We added the first version of inbound email support. This module is designed to work locally through a test endpoint first, then switch to a real inbound provider when domain/DNS setup is ready.

### Backend Additions

New schema objects in [schema.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/schema.ts):

* **`support_mailboxes`**: Tenant admin email-channel settings. Maps a support address to an org and stores behavior such as default team, priority, unknown sender policy, and reply handling.
* **`inbound_emails`**: Durable inbound processing log with idempotency through provider message IDs.
* **`ticket_email_threads`**: Email threading map using message headers and subject fingerprints so replies attach to the right ticket.

New backend pieces:

* [ticketCreationService.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/services/ticketCreationService.ts): Shared ticket creation path used by portal/API tickets and email-created tickets.
* [inboundEmailService.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/services/inboundEmailService.ts): Normalizes inbound payloads, matches senders, creates tickets/replies, records thread headers, and updates inbound status.
* [inboundEmail.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/routes/inboundEmail.ts): Public provider webhook route mounted at `/api/inbound-email/:provider`.
* [worker.ts](file:///f:/LearningAIApps/SupportDesk/backend/src/utils/worker.ts): Processes `queueName = inbound_email` jobs.

### Configuration Split

Platform operator settings live in `backend/.env`:

```env
INBOUND_EMAIL_PROVIDER=dev
INBOUND_EMAIL_WEBHOOK_SECRET=replace_with_provider_webhook_secret
INBOUND_EMAIL_PUBLIC_BASE_URL=https://api.your-supportdesk-domain.com
INBOUND_EMAIL_MAX_ATTACHMENT_MB=10
```

Tenant admin settings live in the app:

```txt
Settings -> Email Channel
```

Admins configure the support email address, active status, default client/team/priority, unknown sender policy, reply behavior, and auto-acknowledgement toggle.

### Local Manual Verification

1. Run database migrations so `support_mailboxes`, `inbound_emails`, and `ticket_email_threads` exist.
2. Start the backend and frontend.
3. Log in to `http://aura.localhost:5173` as `admin@aura.com` / `admin123`.
4. Go to **Settings -> Email Channel**.
5. Set support email to `aura@support.localhost`.
6. Keep unknown sender policy as **Quarantine** or use a sender domain that matches an existing client domain.
7. Save settings.
8. In the test panel, send from `client@maison.com` to `aura@support.localhost`.
9. Wait for the worker to process the queued job.
10. Open **Inboxes** and verify a new ticket was created.
11. Return to **Settings -> Email Channel** and confirm the inbound email row is marked `processed`.

### Production Rollout Notes

Production inbound email requires:

* A domain or subdomain, for example `support.yourapp.com`
* An inbound provider such as Mailgun, Postmark, SendGrid, or AWS SES
* MX records pointed to that provider
* Provider webhook URL:

```txt
https://api.your-supportdesk-domain.com/api/inbound-email/{provider}
```

If `INBOUND_EMAIL_WEBHOOK_SECRET` is configured, include it with provider webhook calls using `x-inbound-email-secret` or the `secret` query parameter. The provider payload is stored first and then processed asynchronously by the worker, which prevents slow provider callbacks and supports retry/idempotency.
