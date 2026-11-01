# NetraVaani (नेत्रवाणी)

> **Next-Generation Assistive Bio-Signal Communication & Clinical Response Platform**  
> Empowering non-verbal, paralyzed, and ICU patients to communicate critical needs to nurses through forehead EOG eye-blinks, wrist EMG squeezes, and voice-assisted bedside verification.

---

## 1. Executive Summary

**NetraVaani** is an assistive healthcare platform engineered for conscious patients who cannot speak due to stroke, ALS, locked-in syndrome, mechanical ventilation, or severe motor impairment.

By connecting patient-worn biosensing hardware (**NPG Lite / BioAmp EXG** paired with an **ESP32** microcontroller) to a hospital-grade software platform, NetraVaani converts physiological potentials into verified clinical care requests. Requests are routed through a real-time bedside verification audio gate, delivered instantaneously to nurse station dashboards via Server-Sent Events (SSE), and audited through a closed-loop resolution protocol.

```
       [ Patient Biosignals ]
   Forehead EOG  •  Wrist/Jaw EMG
                 │
                 ▼
     [ ESP32 + NPG Lite Gateway ]
      On-device signal filtration &
       calibrated gesture detection
                 │
                 ▼
       [ NetraVaani Backend ]
     Node.js • Express • MongoDB
  Handshake & Bedside Audio Gate Engine
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
[ Bedside Terminal ]  [ Nurse Station ]
 Voice verification     Real-time triage,
& patient audit log    SSE alerts & actions
```

---

## 2. Core Clinical Philosophy & Architectural Invariants

1. **Mandatory Patient Handshake**:
   - Every newly assigned patient must successfully transmit both a `YES` (3–4 blinks) and `NO` (both hands squeeze) gesture before routine assistance requests (Water, Nurse, Adjustment) are accepted.
   - Confirms biosensing electrode contact, patient cognitive baseline, and hardware channel calibration.

2. **Strict Handshake Isolation (Clean Dashboard Queues)**:
   - `YES` and `NO` operate purely as control and verification signals.
   - They **never** appear as rogue care requests, cards, or ledger rows on either the Nurse Dashboard or Patient Bedside view.

3. **Bedside Audio Verification Gate**:
   - When a patient triggers a routine gesture (e.g., WATER), the bedside speaker terminal issues an audio prompt (*"You asked for Water. Blink 3 to 4 times for YES to send to nurse, or squeeze both hands for NO to cancel"*).
   - If confirmed with `YES`, the request is dispatched to the nurse dashboard.
   - If cancelled with `NO` (or unconfirmed after 15 seconds), the request is immediately purged from the database and never reaches the nurse station.

4. **Guaranteed Emergency Alarm Bypass**:
   - `EMERGENCY` requests (or high-priority alarms) **bypass all gates**: they bypass incomplete handshakes, bypass dispatch confirmation, and ignore single-request queues.
   - Red visual LED flashes, urgent audible chimes, and instant dashboard alarms trigger immediately.

5. **Closed-Loop Assistance Resolution**:
   - When a nurse completes care at the bedside, the nurse requests patient verification.
   - The bedside speaker asks: *"Did you receive assistance?"*
   - Patient answers with `YES` (resolves call and unlocks queue) or `NO` (marks `FOLLOW_UP_REQUIRED` and re-alerts the nurse).

6. **Strict 1-to-1 Device-to-Patient Allocation & Atomic Bed Transfers**:
   - A hardware gateway can only be linked to one patient at a time.
   - Bed reassignments require explicit patient bedside confirmation before atomic bed handover takes effect.

---

## 3. The 6 Calibrated Clinical Commands

NetraVaani uses a strict, calibrated command matrix mapped across 3 physiological channels:
- **CH3**: Forehead EOG (Electrooculography) for eye-blinks.
- **CH1**: Left wrist/jaw EMG (Electromyography) for left squeezes.
- **CH2**: Right wrist/jaw EMG for right squeezes.

| Command | ID | Blinks (CH3) | Left (CH1) | Right (CH2) | Together | Clinical Action / Behavior |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **YES** | `yes` | **3–4** | 0 | 0 | — | **Confirmation / Handshake Signal**<br>Confirms dispatch allowance or validates care resolution. Never enters queue as a care call. |
| **NO** | `no` | 0 | **1–2** | **1–2** | **Yes** | **Cancellation / Rejection Signal**<br>Cancels bedside dispatch prompt or requests nurse follow-up. Never enters queue as a care call. |
| **WATER** | `water` | **5+** | 0 | 0 | — | **Routine Assistance**<br>Pauses at Bedside Audio Gate for patient YES confirmation before routing to nurse. |
| **CALL NURSE** | `call_nurse` | 0 | **3+** | 0 | — | **Urgent Staff Call**<br>Alerts attending nurse for immediate bedside assistance. |
| **ADJUSTMENT** | `adjustment` | 0 | 0 | **3+** | — | **Repositioning / Comfort Request**<br>Requests nurse or aide to reposition bed angle, pillow, or posture. |
| **EMERGENCY** | `emergency` | 0 | **3+** | **3+** | **Yes** | **Critical Alarm**<br>Immediate alarm bypass. Triggers flashing red UI, continuous siren chime, and gateway RGB alert. |

*Note: All gesture counts must occur within a calibrated 5-second sampling window.*

---

## 4. Website & Application Route Map

The NetraVaani web application is built with the **Next.js 15 App Router** and styled with medical glassmorphism.

### `GET /` — 3D Interactive Medical Landing Page
- **Three.js Interactive Hospital Bed Model**: Real-time 3D canvas with smooth camera choreography synced with **Lenis** smooth scroll.
- **Mascot Audio Synthesizer**: Speech engine demonstrating how NetraVaani voices commands for the patient.
- **Hardware Showcase**: Deep dive into the NPG Lite BioAmp signal acquisition board and ESP32 gateway.
- **Feature Exploration**: Explains handshake protocols, closed-loop resolution, and bedside gating.

### `GET /nurse` — Nurse Clinical Command Center
- **Overview Dashboard**:
  - 3D glass perspective cards for bed occupancy, connected telemetry gateways, open calls, and active emergency alarms.
  - Recent clinical calls stream with status progression buttons.
- **Live Calls Triage**:
  - Live patient-centric call groups updated instantly via Server-Sent Events (SSE).
  - Audio and voice announcements reading patient name, bed number, and request type.
  - Step Advancement Modal: Guarantees explicit confirmation before transitioning states (`NEW` → `ACKNOWLEDGED` → `IN_PROGRESS` → `REQUEST_CONFIRMATION` → `RESOLVED`).
- **Patient Registry**:
  - Real-time patient list, bed allocations, and attending nurse assignments.
  - Device allocation dialog enforcing strict 1-to-1 available online gateway constraints.
  - Bed transfer proposal workflow.
- **Device Fleet & Gateways**:
  - Gateway telemetry: Wi-Fi status, battery percentage, firmware version, and last-seen timestamps.
  - Command rule editor: Allows customizing display labels and speech templates per ward.
  - **Chords Live Signal Visualizer**: Integrated real-time biosignal oscilloscope for hardware inspection.

### `GET /bedside-audio` — Bedside Audio Verification & Patient Terminal
- **Bedside Audio Verification Gate**:
  - Displays high-contrast detected patient commands.
  - 15-second countdown timer with audible speech prompts.
  - Direct hardware gesture simulation buttons (`Trigger YES`, `Trigger NO`, `Trigger WATER`, etc.).
- **Voice Recognition Engine**:
  - Optional continuous microphone listening via Web Speech API so patients can speak commands if partially verbal.
- **Bedside Dispatch Audit Ledger**:
  - Complete real-time audit log of allowed and cancelled commands.
- **Patient Autonomy Controls**:
  - Explicit Bed Assignment Approval / Decline buttons.
  - Attending Nurse Care Link Approval / Decline buttons.

### `GET /verify-email/[token]` — Identity Verification Portal
- Secure email verification flow for newly registered clinical nurses, doctors, and staff members.

---

## 5. End-to-End Request Lifecycle & State Machine

```
   [ Patient Triggers Gesture ]
                 │
                 ▼
        Is Command Emergency?
            ├── YES ──► Status: "NEW" (Alarm Activated)
            └── NO  ──► Status: "PENDING_DISPATCH_CONFIRMATION"
                              │
                    Bedside Speaker Prompts:
               "Blink 3 to 4 times for YES to send..."
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              [ Patient YES ]     [ Patient NO / Timeout ]
                    │                   │
              Status: "NEW"      Status: "CANCELLED"
            Dispatched to Nurse   Purged from Database
                    │                   │
                    ▼                   ▼
          [ Nurse Acknowledges ]    (Never appears
             Status: "ACK"           on Nurse Board)
                    │
                    ▼
          [ Nurse Handling Call ]
            Status: "IN_PROGRESS"
                    │
                    ▼
         [ Nurse Requests Verification ]
       Status: "AWAITING_CONFIRMATION"
                    │
         Bedside Speaker Prompts:
       "Did you receive assistance?"
                    │
            ┌───────┴───────┐
            ▼               ▼
      [ Patient YES ]  [ Patient NO ]
      Status: "CONF"   Status: "FOLLOW_UP_REQUIRED"
            │               │
     Nurse completes        Nurse re-attends
      Status: "RESOLVED"    until resolution
```

---

## 6. Technology Stack

### Backend
- **Runtime**: Node.js (v20+ / v24 LTS)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Real-Time Delivery**: Server-Sent Events (SSE) `/api/care-requests/bedside-audio-events`
- **Validation**: Zod schema validation
- **Authentication**: JWT stored in secure `HttpOnly` cookies, role-based access control (Nurse, Doctor, Admin, Patient)
- **Testing**: Vitest + Supertest (205+ automated tests passing)

### Frontend
- **Framework**: Next.js 15 (React 19, TypeScript)
- **Styling**: Tailwind CSS with custom medical glassmorphism design system
- **3D Graphics**: Three.js with WebGL render pipeline
- **Smooth Scroll**: Lenis
- **Audio & Speech**: HTML5 Web Audio API & Web Speech Recognition/Synthesis
- **Icons**: Lucide React

### Embedded & Hardware
- **Processor**: ESP32-C6 / ESP32-S3 (Wi-Fi 6 + Bluetooth 5 LE)
- **Bio-Potential Sensor**: NPG Lite / Upside Down Labs BioAmp EXG
- **Firmware**: NetraVaani Device Kit (`nv-4.0.0` / `nv-5.0.0`)
- **Telemetry**: Dynamic configuration sync (`GET /api/devices/:deviceId/config`), battery voltage calculation, heartbeat pings

---

## 7. Directory Structure

```text
NETRAVAANI/
├── backend/
│   ├── src/
│   │   ├── config/          # Environment variable validation (Zod)
│   │   ├── controllers/     # Route handlers (auth, careRequest, device, patient, bed)
│   │   ├── middleware/      # Auth validation, error handlers, rate limiters
│   │   ├── models/          # Mongoose models (CareRequest, Device, Patient, Bed, etc.)
│   │   ├── routes/          # Express REST routers
│   │   ├── schemas/         # Zod API validation contracts
│   │   ├── services/        # Business logic (careRequestService, communication, device)
│   │   ├── shared/          # Shared command rules and gesture constants
│   │   ├── utils/           # Cookie handlers, password hashing, JWT utils
│   │   ├── app.ts           # Express application setup
│   │   └── server.ts        # Server listener and database bootstrapper
│   ├── tests/               # 15 Vitest test suites (205 tests)
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx               # 3D Interactive Landing Page
│   │   │   ├── nurse/page.tsx         # Nurse Clinical Command Center
│   │   │   ├── bedside-audio/page.tsx # Bedside Audio Terminal
│   │   │   ├── verify-email/          # Staff Verification Route
│   │   │   └── globals.css            # Medical glassmorphic styles
│   │   ├── components/
│   │   │   ├── dashboard/             # LiveCallsView, OverviewView, PatientRegistry, etc.
│   │   │   ├── landing/               # Three.js 3D bed scene, Lenis scroll controller
│   │   │   ├── PatientBedsideView.tsx # Patient Bedside Terminal component
│   │   │   └── ChordsSignalVisualizer # Biosignal oscilloscope modal
│   │   └── lib/                       # Typed apiClient, auth provider, speech synthesis
│   ├── package.json
│   └── tsconfig.json
│
├── docs/                     # Architectural documents & firmware specifications
├── AGENTS.md                 # AI agent development rules & patient safety invariants
├── PROJECT_CONTEXT.md        # Technical architecture context
├── CHANGELOG_AI.md           # Implementation history & test records
└── README.md                 # System documentation (this file)
```

---

## 8. Installation & Local Development

### Prerequisites
- **Node.js**: v20.x or v24.x
- **npm**: v9+
- **MongoDB**: Local MongoDB instance (`mongodb://127.0.0.1:27017`) or MongoDB Atlas URI

---

### Step 1: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

*Ensure your `backend/.env` has valid database credentials:*
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/netravaani
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
JWT_EXPIRES_IN=7d
COOKIE_SECRET=your_cookie_secret_key
CORS_ORIGIN=http://localhost:3000
```

```bash
# Run Vitest test suite to verify database connection and invariants
npm test

# Start backend server
npm run dev
```
*Backend runs on `http://localhost:5000`.*

---

### Step 2: Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

*Ensure your `frontend/.env.local` points to the running backend:*
```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api
```

```bash
# Run type check and lint
npm run typecheck

# Start development server
npm run dev
```
*Frontend runs on `http://localhost:3000`.*

---

## 9. Key API Reference

### Real-Time Event Stream (SSE)
- `GET /api/care-requests/bedside-audio-events?deviceId=:id&patientCode=:code`  
  *Server-Sent Events connection broadcasting dispatch confirmation prompts, request dispatches, cancellations, resolution verifications, and alarms in real-time.*

### Care Requests
- `POST /api/device-events` — Ingest recognized biosignal/hardware gesture event.
- `GET /api/care-requests` — Paginated and status-filtered care request list (excludes `YES`, `NO`, and cancelled calls).
- `POST /api/care-requests/:id/confirm-dispatch` — Patient confirms routine call dispatch from bedside audio gate.
- `POST /api/care-requests/:id/cancel-dispatch` — Patient cancels call at bedside (purges request immediately).
- `PATCH /api/care-requests/:id/acknowledge` — Attending nurse acknowledges incoming call.
- `PATCH /api/care-requests/:id/in-progress` — Nurse begins attending to patient bedside.
- `POST /api/care-requests/:id/request-patient-confirmation` — Nurse requests closed-loop care verification.
- `PATCH /api/care-requests/:id/resolve` — Mark call completed and release patient request queue.

### Patients & Devices
- `POST /api/patients` — Register a patient into the clinical directory.
- `POST /api/patients/:code/assign-device` — Allocate an available online gateway to a patient.
- `POST /api/patients/:code/propose-bed` — Propose bed relocation (requires patient bedside approval).
- `POST /api/devices/register` — ESP32 hardware registration.
- `POST /api/devices/:deviceId/heartbeat` — Periodic gateway telemetry (battery %, RSSI, firmware version).
- `GET /api/devices/:deviceId/config` — Fetch versioned gesture command configuration for firmware.

---

## 10. Verification & Quality Assurance

NetraVaani incorporates a test suite guarding patient safety invariants:

```bash
# Run all backend unit and integration tests
npm --prefix backend test
```
**Test Coverage: 15 Suites • 205 Passing Tests**
- `patientHandshake.test.ts` (19 tests): Validates mandatory `YES` + `NO` verification, ledger emptiness, emergency bypass, and reconnection persistence.
- `closedLoopWorkflow.test.ts` (2 tests): Verifies end-to-end multi-step nurse handling and closed-loop patient confirmation.
- `commandRules.api.test.ts` (10 tests): Verifies versioned rule delivery, speech templates, and emergency priority ordering.
- `connectivity.test.ts` (16 tests): Validates 1-to-1 patient assignment integrity and offline safety.
- `esp32Wifi.test.ts` (21 tests): Verifies Wi-Fi reconnection handling and telemetry preservation.
- `dashboardBedAssignment.test.ts` (21 tests): Enforces patient-approved bed transfers and registration security.
- `phase5.test.ts` (15 tests): Tests nurse state machine advancement and invalid state transition rejections.

```bash
# Verify Next.js frontend production compilation
npm --prefix frontend run build
```
- Compiles with 0 errors across all routes (`/`, `/nurse`, `/bedside-audio`, `/verify-email/[token]`).

---

## 11. Clinical Safety & Patient Privacy Invariants

- **Idempotent Ingestion**: Every device event includes an `eventId`. Duplicate transmissions from network retries are deduplicated without re-triggering alarms or changing states.
- **Fail-Safe Offline Retention**: If a hardware gateway disconnects or runs out of battery, active requests and patient allocations in the database remain untouched.
- **Audio & Visual Redundancy**: All clinical alerts combine audible voice synthesis (Web Speech API), distinctive frequency chimes, and high-contrast visual status pills so hearing-impaired or visually-impaired nurses and patients are equally supported.
- **Privacy By Design**: No patient biometric raw data is stored or transferred over unencrypted channels. Only classified event states and telemetry counters are transmitted.

---

## 12. License

NetraVaani is developed under the **MIT License**.
#   N e t r a V a a n i 1 1 1  
 