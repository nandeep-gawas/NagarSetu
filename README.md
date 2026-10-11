# NagarSetu — Pune Municipal Grievance Resolution Engine (G-02 GovFix)

> **"Your Complaint. Our Accountability. Pune's Progress."**  
> *आपली तक्रार. आमची जबाबदारी. पुण्याची प्रगती.*

NagarSetu is a server-enforced municipal grievance workflow engine built specifically for **Pune, Maharashtra, India** under the **G-02 GovFix: Configurable Public-Institution Workflow Engine** hackathon challenge.

It features a full citizen reporting and tracking portal, multi-lingual support (English, Hindi, Marathi), an interactive Leaflet live map centered on Pune, an AI Help Assistant with browser-based Web Speech API, an Officer/Staff management portal, configurable SLA deadlines & dynamic priority escalation, 50m/180m spatial duplicate detection, department isolation, and an immutable audit trail.

---

## 🏛️ Demonstration & Governance Disclosure
> **IMPORTANT NOTICE:**  
> All SLA response times, resolution deadlines, escalation policies, and municipal statistics within NagarSetu are demonstration configuration rules and seed data for the GovFix competition. They are **not official commitments or figures of the Pune Municipal Corporation (PMC)**.

---

## 1. Quick Start & Setup Guide

### Prerequisites
- Node.js 18+ or 20+
- SQLite (bundled, no external database server needed)

### Installation Steps
```bash
# 1. Clone repository
git clone git@github.com:nandeep-gawas/NagarSetu.git
cd NagarSetu

# 2. Install dependencies
npm install

# 3. Seed SQLite database with Pune categories, SLA rules & demo users
npm run seed

# 4. Start Next.js web application
npm run dev
```

Visit **[http://localhost:3000](http://localhost:3000)** in your browser.

### Running the Standalone Deadline Monitor Worker
In a separate terminal, start the independent SLA background worker:
```bash
npm run worker
```
The worker runs on `node-cron` every minute, evaluating resolution deadlines, marking overdue issues, raising priorities, and generating supervisor escalation notifications even when no browser session is active.

### Running Automated Test Suite
```bash
npm test
```
Executes all **42 unit and E2E scenario tests** covering workflow transitions, RBAC isolation, duplicate detection, EXIF extraction, privacy filtering, and Scenarios A through J.

---

## 2. Seeded Demo Accounts

All seeded demo accounts share the standard password:

> **Password (all accounts):** `PuneDemo@2026`

| Role | Name | Email | Department |
| :--- | :--- | :--- | :--- |
| **ADMIN** | Rajesh Deshmukh | `admin@pune.gov.in` | All (PMC Systems Administration) |
| **SUPERVISOR** | Vandana Kulkarni | `supervisor.west@pune.gov.in` | Zonal Supervisor (West Pune) |
| **SUPERVISOR** | Suresh Patil | `supervisor.east@pune.gov.in` | Zonal Supervisor (East Pune) |
| **OFFICER** | Priya Joshi | `officer.roads@pune.gov.in` | Road & Street Infrastructure Department |
| **OFFICER** | Vikram Pawar | `officer.water@pune.gov.in` | Water Supply & Sewerage Department |
| **OFFICER** | Amol Jadhav | `officer.waste@pune.gov.in` | Solid Waste Management Department |
| **OFFICER** | Neha Bhosale | `officer.safety@pune.gov.in` | Encroachment & Civic Safety Department |
| **OFFICER** | Kiran Gaikwad | `officer.other@pune.gov.in` | General Municipal Grievance Cell |
| **CITIZEN** | Aarav Sharma | `aarav.sharma@citizen.in` | Kothrud Resident |
| **CITIZEN** | Sneha Apte | `sneha.apte@citizen.in` | Baner / Aundh Resident |
| **CITIZEN** | Rohan Gokhale | `rohan.gokhale@citizen.in` | Hadapsar Resident |
| **CITIZEN** | Pooja Chitale | `pooja.chitale@citizen.in` | Shivajinagar Resident |
| **CITIZEN** | Nikhil Kale | `nikhil.kale@citizen.in` | Viman Nagar Resident |

---

## 3. The 5 Core Pune Municipal Categories

1. **🕳️ Roads & Infrastructure** (`Road & Street Infrastructure Department`)
   - Potholes or damaged roads (Response: 12h, Resolution: 72h)
   - Broken or flickering streetlights (Response: 12h, Resolution: 48h)
   - Open or damaged manhole covers (Response: 4h, Resolution: 24h)
   - Damaged footpaths or sidewalks (Response: 24h, Resolution: 96h)
2. **💧 Water & Sewage** (`Water Supply & Sewerage Department`)
   - Contaminated or muddy water supply (Response: 6h, Resolution: 24h)
   - Major pipe leaks or bursts (Response: 4h, Resolution: 24h)
   - Overflowing sewage or blocked sewage lines (Response: 6h, Resolution: 36h)
   - Unscheduled water supply cuts (Response: 6h, Resolution: 24h)
3. **🗑️ Waste Management & Sanitation** (`Solid Waste Management Department`)
   - Missed garbage collection (Response: 6h, Resolution: 24h)
   - Overflowing public dustbins (Response: 6h, Resolution: 24h)
   - Dead animal removal (Response: 4h, Resolution: 12h)
   - Public toilet maintenance (Response: 8h, Resolution: 36h)
4. **⚠️ Civic Nuisance & Public Safety** (`Encroachment & Civic Safety Department`)
   - Stray animal menace (Response: 8h, Resolution: 48h)
   - Illegal tree cutting (Response: 6h, Resolution: 24h)
   - Unauthorized construction (Response: 24h, Resolution: 120h)
   - Illegal parking or abandoned vehicles (Response: 12h, Resolution: 72h)
5. **📍 Other Municipal Issues** (`General Municipal Grievance Cell`)
   - Free-text municipal issue (Response: 12h, Resolution: 72h)

---

## 4. 5-Minute Evaluation Walkthrough (Scenarios A through J)

| Scenario | Objective | Step-by-Step Test Procedure |
| :--- | :--- | :--- |
| **A: Pothole Filing** | Citizen logs complaint | Navigate to `/report`, select Roads → Potholes, pick location on map, click submit. Check initial status `SUBMITTED`, priority `NORMAL`, and SLA deadlines generated. |
| **B: EXIF GPS Extraction** | Auto-locate via photo | In `/report`, upload a camera JPEG with EXIF. Coordinates autofill accurately from photo metadata with an "Unverified Metadata" indicator. |
| **C: Voice Speech-to-Text** | Hands-free input | Open floating Help Assistant (bottom right), click microphone 🎤, speak in English, Hindi, or Marathi (`mr-IN`). Audio transcribes into edit box locally via browser Web Speech API. |
| **D: Multi-Citizen Duplicate** | Spatial consolidation | Log in as Citizen B (`sneha.apte@citizen.in`). Submit a similar complaint within 50m of Citizen A's pothole. NagarSetu merges it into the existing Issue, increments report count, and raises priority to `HIGH`. |
| **E: Same-Citizen Duplicate** | Prevention & options | Citizen A attempts to file the same pothole again. The engine flags `DUPLICATE_WARNING`, offering options: track original, add evidence, or explicitly submit as a separate issue. |
| **F: Missed SLA Escalation** | Automated overdue worker | When an issue's deadline passes, `npm run worker` marks `isOverdue = true`, elevates priority to `HIGH`/`CRITICAL`, logs a `MISSED_DEADLINE` audit event, and notifies the department supervisor. |
| **G: Invalid State Prevention** | Engine refuses skipped steps | Log in as Officer (`officer.roads@pune.gov.in`) and call transition `SUBMITTED → RESOLVED`. Workflow engine rejects the move: *"Cannot move from Submitted to Resolved: must be Verified, Assigned, and In Progress first."* Refusal logged to audit trail. |
| **H: Department Isolation** | Cross-department defense | Water Officer (`officer.water@pune.gov.in`) attempts to transition a Road complaint. Engine rejects: *"Officers can only act inside their own department."* |
| **I: Resolution & Reopen Window** | Full resolution lifecycle | Roads Officer resolves issue with mandatory resolution notes and "after-repair" photo evidence. Status becomes `RESOLVED_AWAITING_VERIFICATION`. Citizen can verify and close or reopen within the 7-day window. |
| **J: Real-Time Stats & Map** | Accurate civic dashboard | Visit `/` and `/map`. Stats calculate eligible resolved ÷ eligible total (excluding rejected). Coordinates are rounded to ~100m on public map to preserve citizen privacy. |

---

## 5. AI Separation Invariant & Help Assistant

NagarSetu incorporates artificial intelligence while strictly upholding municipal public accountability:

1. **Floating Help Assistant (`FloatingHelpAssistant.tsx`):**
   - Guides citizens through multi-step grievance filing in natural conversation.
   - Connected to Gemini API (`POST /api/assistant`) with an offline rule-based fallback ensuring 100% demo uptime even without API keys.
   - Browser Web Speech API integration (`en-IN`, `hi-IN`, `mr-IN`) with privacy transparency disclosure (voice audio is not recorded on server).
2. **Staff AI Suggestion Panel (`AiSuggestionPanel.tsx`):**
   - Synthesizes duplicate reports, detects safety cues, and drafts citizen responses.
   - Clearly labeled: `AI suggestion, not an official action`.
   - **Strict Governance Invariant:** AI modules have **zero access** to state transition functions, assignment tables, or SLA deadlines. Any copy action is logged to `AuditEvent` (`STAFF_COPIED_AI_SUGGESTION`).

---

## 6. Architecture & Security Highlights

- **Server-Side Rules Engine:** Transitions, SLA deadlines, priority recalculations, and duplicate detection execute in transactional SQLite logic, never relying on UI client checks.
- **Sliding-Window Rate Limiting (`rateLimit.ts`):** Protects login (15 req/min), complaint intake (20 req/min), and assistant requests (40 req/min).
- **MIME & Magic Bytes File Inspection (`/api/evidence/upload`):** Blocks non-image/video formats and limits sizes (10 MB photos, 30 MB videos).
- **Public Privacy Safeguards:** Contact details and raw street addresses are scrubbed for public viewers; coordinates are fuzzed by ~100m on public maps.
- **Immutable Audit Trail (`AuditEvent`):** Both accepted actions and refused attempts are permanently recorded with actor identity, timestamps, old/new values, and rules applied.

---

## 7. License & Credits

Built for the **G-02 GovFix** hackathon problem statement.  
Team NagarSetu © 2026.
