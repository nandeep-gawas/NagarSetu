# NagarSetu — Pune Municipal Grievance Resolution Engine (G-02 GovFix)

> **"Your Complaint. Our Accountability. Pune's Progress."**

NagarSetu is a server-enforced municipal grievance workflow engine built exclusively for **Pune, Maharashtra, India** under the **G-02 GovFix: Configurable Public-Institution Workflow Engine** hackathon problem statement.

Citizens of Pune can report municipal problems with photos, GPS coordinates, and locality labels, track their status, and view grievances across Pune on an interactive coordinate map. Behind the interface is a strict server-enforced workflow engine featuring configurable SLA deadlines, automatic overdue & multi-report priority escalation, 250m spatial duplicate detection, role-based access control (`requireRole`), and an immutable server-timestamped audit trail (`AuditEvent`).

---

## 1. Architecture & Folder Structure

```text
/
├── prisma/
│   ├── schema.prisma           # 14 Prisma models + SQLite datasource & indexes
│   └── seed.ts                 # Demo seed script (npm run seed)
├── src/
│   ├── lib/
│   │   ├── db.ts               # Singleton PrismaClient instance
│   │   ├── audit/
│   │   │   └── index.ts        # Server-timestamped AuditEvent logger (ACCEPTED & REFUSED)
│   │   ├── auth/
│   │   │   ├── session.ts      # HMAC-SHA256 HTTP-only session cookie utilities
│   │   │   ├── guard.ts        # requireRole(roles[]) guard returning 401/403 + AuditEvent logging
│   │   │   └── index.ts        # Auth barrel exports
│   │   ├── rules/
│   │   │   └── index.ts        # Editable DB-driven DeadlineRule, PriorityRule & 250m Duplicate Detection
│   │   └── workflow/
│   │       └── index.ts        # Server-enforced WorkflowTransition state machine
│   └── app/
│       ├── api/
│       │   ├── auth/
│       │   │   ├── register/   # POST citizen self-registration (blocks privileged role spoofing)
│       │   │   ├── login/      # POST email + bcrypt password verification + session cookie
│       │   │   ├── logout/     # POST session termination
│       │   │   └── me/         # GET current authenticated user & notifications
│       │   ├── admin/
│       │   │   └── users/      # GET/POST staff creation protected by requireRole(['ADMIN'])
│       │   ├── issues/
│       │   │   ├── route.ts    # GET filtered issues & map data; POST citizen report intake
│       │   │   └── [id]/
│       │   │       ├── transition/ # POST server-enforced workflow state transitions
│       │   │       └── deadline/   # PATCH supervisor deadline adjustment + DeadlineChange audit
│       │   ├── rules/
│       │   │   └── route.ts    # GET/PATCH live-editable DeadlineRules & PriorityRules
│       │   └── audit/
│       │       └── route.ts    # GET immutable AuditEvent & EscalationEvent logs
│       ├── layout.tsx          # App Router root layout
│       └── page.tsx            # Interactive Pune Grievance Map, Workflow Console, Intake & Audit UI
└── worker/
    └── index.ts                # Standalone Node worker for SLA deadline & priority monitoring
```

---

## 2. Demo Accounts (`isDemo = true`)

All seeded demo accounts use the following password:

- **Demo Password (for all accounts):** `PuneDemo@2026`

| Role | Name | Email | Department |
| :--- | :--- | :--- | :--- |
| **ADMIN** | Rajesh Deshmukh | `admin@pune.gov.in` | All (PMC Systems Admin) |
| **SUPERVISOR** | Vandana Kulkarni | `supervisor.west@pune.gov.in` | All (Zonal Supervisor West Pune) |
| **SUPERVISOR** | Suresh Patil | `supervisor.east@pune.gov.in` | All (Zonal Supervisor East Pune) |
| **OFFICER** | Amol Jadhav | `officer.waste@pune.gov.in` | Solid Waste Management Department (PMC) |
| **OFFICER** | Priya Joshi | `officer.roads@pune.gov.in` | Road & Street Infrastructure Department (PMC) |
| **OFFICER** | Vikram Pawar | `officer.water@pune.gov.in` | Water Supply & Sewerage Department (PMC) |
| **OFFICER** | Neha Bhosale | `officer.safety@pune.gov.in` | Encroachment & Civic Safety Department (PMC) |
| **OFFICER** | Kiran Gaikwad | `officer.other@pune.gov.in` | General Municipal Grievance Cell (PMC) |
| **CITIZEN** | Aarav Sharma | `aarav.sharma@citizen.in` | — (Kothrud Resident) |
| **CITIZEN** | Sneha Apte | `sneha.apte@citizen.in` | — (Baner Resident) |
| **CITIZEN** | Rohan Gokhale | `rohan.gokhale@citizen.in` | — (Hadapsar Resident) |
| **CITIZEN** | Pooja Chitale | `pooja.chitale@citizen.in` | — (Shivajinagar Resident) |
| **CITIZEN** | Nikhil Kale | `nikhil.kale@citizen.in` | — (Viman Nagar Resident) |

---

## 3. Exact 5 Pune Municipal Categories & Subcategories

1. **🗑️ Waste Management & Sanitation** (`Solid Waste Management Department (PMC)`)
   - Missed garbage collection (Response: 6h, Resolution: 24h)
   - Overflowing public dustbins (Response: 6h, Resolution: 24h)
   - Dead animal removal (Response: 4h, Resolution: 12h)
   - Public toilet maintenance (Response: 8h, Resolution: 36h)
2. **🕳️ Roads & Infrastructure** (`Road & Street Infrastructure Department (PMC)`)
   - Potholes or damaged roads (Response: 12h, Resolution: 72h)
   - Broken or flickering streetlights (Response: 12h, Resolution: 48h)
   - Open or damaged manhole covers (Response: 4h, Resolution: 24h)
   - Damaged footpaths or sidewalks (Response: 24h, Resolution: 96h)
3. **💧 Water & Sewage** (`Water Supply & Sewerage Department (PMC)`)
   - Contaminated or muddy water supply (Response: 6h, Resolution: 24h)
   - Major pipe leaks or bursts (Response: 4h, Resolution: 24h)
   - Overflowing sewage or blocked sewage lines (Response: 6h, Resolution: 36h)
   - Unscheduled water supply cuts (Response: 6h, Resolution: 24h)
4. **⚠️ Civic Nuisance & Public Safety** (`Encroachment & Civic Safety Department (PMC)`)
   - Stray animal menace (Response: 8h, Resolution: 48h)
   - Illegal tree cutting (Response: 6h, Resolution: 24h)
   - Unauthorized construction (Response: 24h, Resolution: 120h)
   - Illegal parking or abandoned vehicles (Response: 12h, Resolution: 72h)
5. **📍 Other** (`General Municipal Grievance Cell (PMC)`)
   - Free-text municipal issue (Response: 12h, Resolution: 72h)

> **Note:** All `DeadlineRule` and `PriorityRule` records are stored in the SQLite database as editable configuration data and labelled `"Demonstration rules, not official PMC standards"`.

---

## 4. Server-Enforced Workflow Transitions

| From State | To State | Allowed Roles | Requires Reason | Same Dept Only |
| :--- | :--- | :--- | :--- | :--- |
| `SUBMITTED` | `VERIFIED` | `OFFICER`, `SUPERVISOR` | No | Yes |
| `VERIFIED` | `ASSIGNED` | `SUPERVISOR` | No | No |
| `ASSIGNED` | `IN_PROGRESS` | `OFFICER` | No | Yes |
| `IN_PROGRESS` | `RESOLVED_AWAITING_VERIFICATION` | `OFFICER` | No | Yes |
| `RESOLVED_AWAITING_VERIFICATION` | `CLOSED` | `SUPERVISOR`, `CITIZEN` | No | No |
| `RESOLVED_AWAITING_VERIFICATION` | `REOPENED` | `CITIZEN`, `SUPERVISOR` | Yes | No |
| `REOPENED` | `ASSIGNED` | `SUPERVISOR` | No | No |
| `SUBMITTED` | `REJECTED` | `SUPERVISOR` | Yes | No |
| `VERIFIED` | `REJECTED` | `SUPERVISOR` | Yes | No |

- **Citizen Transition Constraint:** Citizens may **NOT** perform any transition other than requesting reopening (`RESOLVED_AWAITING_VERIFICATION → REOPENED` via `POST /api/issues/[id]/reopen` within the 7-day window). Any other attempt returns `403` and logs an `AuditEvent` with `outcome = REFUSED`.
- **No Anonymous Reports (Verified Account Requirement):** Anonymous reports are intentionally **not supported** (`POST /api/reports` requires an authenticated session). Same-citizen vs. different-citizen spatial and textual duplicate detection (`submitReport`), idempotency protection, and post-resolution verification/reopening depend on verified citizen accounts.

---

## 5. How to Install, Migrate, Seed, and Run

### Step 1: Install dependencies
```bash
npm install
```

### Step 2: Run Prisma SQLite migration
```bash
npx prisma migrate dev --name init
```

### Step 3: Seed the database with Pune demo data
```bash
npm run seed
```

### Step 4: Start the Next.js development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 5 (Optional): Run the standalone SLA & Escalation worker
```bash
npm run worker
```
