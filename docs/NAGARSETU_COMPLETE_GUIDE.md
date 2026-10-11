# NAGARSETU (नगरसेतू) — COMPLETE COMPREHENSIVE OPERATING MANUAL & FEATURE GUIDE

**Pune Municipal Grievance Redressal & Server-Enforced Workflow Engine**  
*Government of Maharashtra • Pune Municipal Corporation (PMC)*  
*Document Version: 3.0 | Status: Official Operations Manual*

---

## 1. EXECUTIVE SUMMARY & ARCHITECTURE

**NagarSetu (नगरसेतू)** is a modern, transparent municipal grievance resolution platform designed specifically for the Pune Municipal Corporation (PMC). It replaces legacy, opaque complaint boxes with an immutable, server-enforced civic engine.

### Core Architectural Pillars
1. **Server-Enforced State Machine**: Status transitions cannot be skipped by officers or staff. Every state transition follows rigid business rules guarded by Role-Based Access Control (RBAC).
2. **250m Spatial Deduplication**: If multiple citizens report the same civic issue (e.g., a pothole or water main leak) within a 250-metre radius, the engine automatically clusters them into a single physical **Issue**, preventing administrative queue congestion while automatically escalating priority.
3. **Dual Client & Server EXIF Forensic Extraction**: Camera GPS coordinates (latitude, longitude) and timestamps are parsed directly in the citizen's browser and re-extracted from raw image binary on the server to prevent GPS spoofing.
4. **Statutory SLA Deadlines & Background Escalation**: Every complaint has statutory response and resolution deadlines. An automated cron background monitor escalates overdue tickets to senior supervisors and raises priority to `CRITICAL`.
5. **Citizen Verification & 7-Day Reopening Window**: When an officer marks a complaint resolved, it enters `RESOLVED_AWAITING_VERIFICATION`. The original citizen has a statutory 7-day window to inspect the resolution (with photo evidence) and either confirm closure or reopen the ticket.
6. **Immutable Audit Trail (`AuditEvent`)**: Every accepted state transition, supervisor deadline modification, and unauthorized attempt is permanently logged into an append-only audit database table.

---

## 2. SYSTEM ROLES & ACCESS CONTROL MATRIX

The platform provides 4 distinct user roles:

| Role | Access Scope | Allowed Actions |
|---|---|---|
| **CITIZEN** | Public Portal (`/`, `/report`, `/track`, `/my-complaints`, `/map`, `/scorecard`) | Lodge grievances, upload photos, track tickets by reference token, confirm resolution, reopen issues within 7 days. |
| **OFFICER** | Staff Portal (`/staff`), Assigned Department Issues | View assigned issues, change status to `IN_PROGRESS`, add progress notes, submit resolution notes and "after" photo proof. Cannot reassign or extend deadlines. |
| **SUPERVISOR** | Staff Portal (`/staff`), Department Queue & Overdue Queue | Reassign issues to officers, modify statutory SLA deadlines with mandatory audit reasons, monitor escalated cases. |
| **ADMIN** | Full Platform (`/staff`, Internal Engine Console) | Department-wide oversight, manage SLA and priority thresholds, inspect immutable audit logs, view cross-department matrices. |

### Pre-Configured 1-Click Demo Accounts

For rapid testing and evaluation, the login page (`/login`) and top navigation bar include instant 1-click accounts:

* **Citizen**: `aarav.sharma@citizen.in` (Password: `PuneDemo@2026`)
* **Citizen**: `sneha.apte@citizen.in` (Password: `PuneDemo@2026`)
* **Officer (Roads)**: `officer.roads@pune.gov.in` (Password: `PuneDemo@2026`)
* **Officer (Water)**: `officer.water@pune.gov.in` (Password: `PuneDemo@2026`)
* **Supervisor (West Ward)**: `supervisor.west@pune.gov.in` (Password: `PuneDemo@2026`)
* **PMC Admin**: `admin@pune.gov.in` (Password: `PuneDemo@2026`)

---

## 3. CITIZEN GRIEVANCE REGISTRATION STEP-BY-STEP (`/report`)

The citizen intake flow is a resilient 7-step wizard that functions with or without AI assistance:

### Step 1: Category Selection
* Choose from 5 statutory municipal categories:
  1. `[RD] Roads & Infrastructure` (Potholes, broken footpaths, traffic signals, streetlights)
  2. `[WT] Water & Sewage` (Pipeline bursts, contaminated water, open drains, low pressure)
  3. `[SW] Waste Management & Sanitation` (Garbage dumps, missed collection, dead animals)
  4. `[SF] Civic Nuisance & Public Safety` (Illegal hawking, encroachments, noise, construction debris)
  5. `[GN] Other Municipal Services` (Tree trimming, stray animals, park maintenance)
* Select the applicable subcategory. If accessing via `?category=roads-infrastructure`, the category is automatically preselected.

### Step 2: Problem Description
* Enter the detailed description in the citizen's own words.
* **Multilingual Guarantee**: Citizen text is preserved verbatim in Hindi, Marathi, or English. The backend never rewrites or auto-translates citizen complaint text.
* Voice-to-Text: Supports speech recognition via the microphone button.

### Step 3: Photographic Evidence & Media Upload
* Take a photo directly using the device camera (`capture="environment"`) or select a gallery file.
* Supported formats: JPEG, PNG, WebP (up to 10 MB); MP4 (up to 30 MB).
* Client and server enforce strict MIME type and file signature validation. Uploads are stored securely outside the `/public` root.

### Step 4: Automatic GPS Location & Forensic EXIF Extraction
* The browser parses the photograph's binary metadata using `exifr`.
* If GPS coordinates exist (`latitude`, `longitude`, `DateTimeOriginal`):
  - Automatically pins the exact incident spot on the Pune OpenStreetMap.
  - If the device GPS differs by >100m from the photo EXIF, the system displays an alert with a single-click button to choose either the photo location or current device position.
* If no EXIF data exists:
  - Interactive map picker opens with Pune landmarks (Shivajinagar, Kothrud, Swargate, Hadapsar, Viman Nagar, Hinjawadi).
  - Click anywhere in Pune to pin the location.

### Step 5: Duplicate Detection Alert & Smart Merging
* If a complaint exists within **250 metres** under the same category:
  - The system highlights the existing ticket reference.
  - Citizens are offered 4 options:
    1. Track existing complaint.
    2. Attach their photo/evidence to the existing issue (elevating its priority).
    3. Modify description/location.
    4. Submit as a separate distinct grievance.

### Step 6: Review & Final Submission
* Review all collected metadata, category, location, and photos.
* Submit ticket. The backend generates a permanent reference token (e.g., `PUNE-RD-884210`).

---

## 4. CITIZEN TRACKING, VERIFICATION & REOPENING (`/track` & `/my-complaints`)

### Public Tracking vs. Authenticated Citizen Tracking
* **Public View**: Anyone entering a tracking ID sees public status, anonymised location (~100m grid snap), department name, SLA countdown, and resolution timeline. Citizen personal info is strictly withheld.
* **Citizen Owner View**: When logged in as the reporting citizen, displays full raw evidence, detailed officer notes, and direct action buttons.

### Resolution Verification Flow
1. When status reaches `RESOLVED_AWAITING_VERIFICATION`:
   - The citizen inspects the officer's resolution notes and mandatory "After" photograph.
2. **Confirm Closure**: Citizen clicks "Verify & Confirm Closure" &rarr; Ticket enters `CLOSED`.
3. **Reopen Ticket (7-Day Statutory Window)**:
   - If work is incomplete, citizen enters a reason and clicks "Reopen Complaint".
   - The ticket transitions back to `IN_PROGRESS` or `ASSIGNED` with escalated supervisor notification.

---

## 5. INTERACTIVE LIVE GIS MAP (`/map` & Homepage)

* **OpenStreetMap + Leaflet Engine**: Real-time visualization centred on Pune (`18.5204°N, 73.8567°E`).
* **Privacy Grid Snapping**: Public map endpoints snap coordinates to a ~100m grid to protect citizen home privacy.
* **Urgency & Priority Rings**:
  - Green: `NORMAL` priority.
  - Orange: `HIGH` priority.
  - Red: `CRITICAL` priority.
  - Pulsing Halo: Overdue SLA breach.
* **Department Badges**: `[RD] Roads`, `[WT] Water`, `[SW] Waste`, `[SF] Safety`, `[GN] General`.
* **Live Server-Sent Events (SSE)**: Map updates automatically when complaints are logged or updated without requiring page refresh.

---

## 6. STAFF WORKFLOW PORTAL (`/staff`)

### Officer Workspace
* Filtered table displaying issues assigned to the logged-in officer.
* Sorted by nearest SLA deadline.
* Allowed Transitions Engine (`GET /api/issues/[id]/allowed-transitions`): Officers only see buttons permitted for their role:
  - `SUBMITTED` &rarr; `TRIAGED`
  - `TRIAGED` &rarr; `ASSIGNED`
  - `ASSIGNED` &rarr; `IN_PROGRESS`
  - `IN_PROGRESS` &rarr; `RESOLVED_AWAITING_VERIFICATION` (Requires resolution note and photo proof)

### Supervisor Workspace
* **Overdue & Escalation Queue**: Instant view of tickets where SLA has breached.
* **Reassignment**: Move tickets across ward officers with a required justification note.
* **Deadline Extension**: Adjust resolution deadlines with mandatory audit reasons; the original SLA deadline is permanently preserved for accountability reporting.

### Scenario H (Tamper & Refusal Testing)
* Evaluators can simulate illegal state skips (e.g., trying to jump directly from `SUBMITTED` &rarr; `CLOSED` without triage).
* The server immediately rejects the request with `403/422 REFUSED` and records an unauthorized attempt in the `AuditEvent` table.

---

## 7. MUNICIPAL SCORECARD & PERFORMANCE METRICS (`/scorecard`)

Statutory performance metrics computed from the database:
* **Resolution Rate (%)**: `(Resolved Issues ÷ Eligible Complaints) × 100`
* **On-Time Resolution Rate (%)**: `(Resolved Before Deadline ÷ Eligible Resolved) × 100`
* *Note: Invalid / Rejected tickets are excluded from calculations so numbers cannot be inflated.*

---

## 8. AI ASSISTANT & BILINGUAL ENGINE

* **Floating Assistant**: Accessible on all pages for conversational complaint intake.
* **Languages**: English, Hindi (हिंदी), and Marathi (मराठी).
* Language selection persists across cookies and dynamically updates labels, navigation, and validation notices.

---

## 9. STEP-BY-STEP CHEAT SHEET FOR EVALUATORS

1. **Open the Website**: Visit `http://10.60.244.171:3000` (or `http://localhost:3000`).
2. **Lodge a Complaint**:
   - Click "Register New Grievance".
   - Select `Roads & Infrastructure` &rarr; `Potholes`.
   - Use the demo test button: "Test Photo WITH Real GPS EXIF (Kothrud)".
   - Notice automatic coordinate detection (18.5074°N, 73.8077°E).
   - Click Submit and copy the generated reference ID (e.g. `PUNE-RD-...`).
3. **Log in as Officer**:
   - Click "Sign In" in the top bar.
   - Click "Officer Roads" 1-click login.
   - Go to Staff Portal &rarr; locate the newly lodged ticket.
   - Move to `IN_PROGRESS` &rarr; `RESOLVED_AWAITING_VERIFICATION`.
4. **Log in as Citizen to Verify**:
   - Log back in as `Aarav Sharma`.
   - Go to "My Complaints" or `/track/[referenceId]`.
   - Click "Verify & Confirm Closure" or test the 7-day reopening mechanism.
5. **Inspect Audit Trail**:
   - In Staff Portal or Evaluator Console, open the "Audit Trail" tab to review every accepted transition and refusal event.

---
*Pune Municipal Corporation • NagarSetu Civic Redressal Engine*
