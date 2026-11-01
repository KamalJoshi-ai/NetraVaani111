# PROJECT_CONTEXT.md
# NetraVaani – Project Architecture & Technical Context

Last updated: 2026-10-31

## 1. Project Overview

NetraVaani is a patient communication platform designed for conscious patients who cannot speak.

It enables patients to communicate basic needs, discomfort, pain, and emergency situations using gesture-based inputs.

The system connects a patient-side hardware device to a software platform used by nurses.

### Core objectives

- Enable non-verbal patient communication.
- Detect and classify patient gestures.
- Convert gestures into meaningful communication commands.
- Send patient requests to the backend.
- Synchronize requests with the assigned nurse dashboard.
- Support emergency alerts.
- Prevent incorrect or duplicate requests.
- Maintain reliable patient-device assignments.

## 2. System Components

### A. Hardware / Device Layer

Known hardware:

- NPG Lite device.
- ESP32.
- Bluetooth communication.
- Wi-Fi communication.
- NetraVaani Device Kit v1.1.1 Arduino firmware.

Device responsibilities:

- Capture patient signals.
- Filter noisy signals.
- Classify gestures.
- Map recognized gestures to commands.
- Send recognized events to the backend.
- Handle device connectivity and reconnection.

Known gesture categories:

- Forehead EOG blinks.
- Left wrist squeezes.
- Right wrist squeezes.
- Both-wrist squeezes.

Important:
Verify the actual firmware architecture, sensor pipeline, signal-processing logic, and communication protocol before modifying device code.

### B. Backend

Known technologies:

- Node.js.
- Express.js.
- MongoDB.
- Mongoose.

Backend responsibilities:

- Device registration.
- Patient management.
- Patient-device assignment.
- Device assignment retrieval.
- Device unassignment.
- Versioned device configuration.
- Gesture event processing.
- Request creation.
- Real-time dashboard synchronization.
- Emergency notification management.

Important:
Preserve the existing backend architecture, API conventions, middleware, and database patterns.

### C. Frontend

Known technology:

- Next.js.

Frontend responsibilities:

- Nurse dashboard.
- Patient management.
- Device discovery and assignment.
- Device configuration.
- Patient communication monitoring.
- Live Calls Ledger.
- Emergency notifications.
- Voice phrase playback.

Important:
Verify the actual routing, component structure, state management, and real-time communication implementation before modifying frontend modules.

## 3. Main Application Workflow

### Device registration

1. Device connects to Wi-Fi.
2. Device registers with the backend.
3. Backend stores device identity and registration information.
4. Dashboard discovers available devices.
5. Device provides its hardware ID and NPG Lite device ID.

### Patient assignment

1. Nurse selects a registered device.
2. Nurse assigns it to a patient.
3. Backend validates assignment constraints.
4. One device must not be assigned to multiple patients simultaneously.
5. Dashboard retrieves the assignment information.

### Gesture communication

1. Patient performs a gesture.
2. Hardware filters and classifies the signal.
3. Device maps the gesture to a command.
4. Backend receives and validates the event.
5. Backend creates an eligible patient request.
6. Assigned nurse receives the request.
7. Dashboard updates in real time.

## 4. Mandatory Communication Handshake

Current intended requirement:

Every newly assigned patient must complete an initial YES/NO communication handshake.

Mandatory commands:

| Command | ID | Gesture |
|---|---|---|
| YES | yes | 3–4 forehead blinks |
| NO | no | 1–2 both-hand squeezes |
| EMERGENCY | emergency | 3+ both-wrist squeezes |

Rules:

- YES and NO are mandatory.
- Both must be successfully transmitted and acknowledged.
- They can be completed in either order.
- Normal assistance requests remain blocked until both are complete.
- YES and NO must not appear in the Live Calls Ledger.
- YES and NO must remain visible in the appropriate handshake status UI.
- Emergency must remain operational during initialization.
- Handshake state must persist per patient-device assignment.
- Dashboard refresh must not reset the state.
- Device reconnection must restore the previous state.

Other commands:

- WATER.
- CALL NURSE.
- ADJUSTMENT.

These are normal assistance commands, not handshake commands.

Important:
Verify the actual implementation status before changing anything. Do not assume this functionality has already been implemented.

## 5. Patient Request Lifecycle

Expected logical workflow:

DEVICE SIGNAL
    ↓
GESTURE CLASSIFICATION
    ↓
BACKEND VALIDATION
    ↓
PATIENT / DEVICE ASSIGNMENT VALIDATION
    ↓
COMMUNICATION MODE VALIDATION
    ↓
DUPLICATE EVENT VALIDATION
    ↓
REQUEST CREATION
    ↓
REAL-TIME NOTIFICATION
    ↓
NURSE DASHBOARD

Emergency events must use the existing emergency handling pathway and must not be suppressed by ordinary handshake gating.

## 6. Important Business Rules

1. One device can have only one active patient assignment.
2. One patient should not accidentally receive another patient's events.
3. Every incoming gesture must be validated.
4. Duplicate events must not generate duplicate requests.
5. Unassigned devices must not generate patient requests.
6. YES and NO must be excluded from the Live Calls Ledger.
7. Additional assistance requests must remain blocked before handshake completion.
8. Emergency alerts must remain operational.
9. Device configuration must support versioning.
10. Dashboard information must remain synchronized with backend state.

## 7. Real-Time Communication

The project requires real-time synchronization between the device, backend, and nurse dashboard.

Actual transport must be verified in the repository.

Potential existing mechanisms include WebSockets or Socket.IO, but do not assume which one is currently implemented.

Preserve existing event names and payload contracts unless the requested feature requires a change.

Document important real-time events here as they are verified.

## 8. Database Entities

Known logical entities:

- Patient.
- Device.
- Device assignment.
- Device configuration.
- Patient request.
- Communication state.

Actual MongoDB collections, Mongoose models, schema fields, indexes, and references must be verified from the repository.

Do not create duplicate models for existing entities.

## 9. Development Principles

NetraVaani should be developed with production-level engineering practices.

Priorities:

- Reliability.
- Patient safety.
- Data consistency.
- Security.
- Maintainability.
- Real-time performance.
- Device reconnection.
- Failure recovery.
- Clear separation of responsibilities.

Prefer backend-controlled business logic over frontend-only restrictions.

## 10. Verified Repository Structure

This section must be populated from the actual repository.

Do not invent file paths.

### Backend (`/backend`)
- Entry point: `backend/src/server.ts`, `backend/src/app.ts`
- Routes: `backend/src/routes/` (`careRequest.routes.ts`, `device.routes.ts`, `patient.routes.ts`, `bed.routes.ts`, `commandRules.routes.ts`, `chords.routes.ts`, `auth.routes.ts`)
- Controllers: `backend/src/controllers/` (`careRequest.controller.ts`, `device.controller.ts`, `patient.controller.ts`, `bed.controller.ts`, `commandRules.controller.ts`, `chords.controller.ts`, `auth.controller.ts`)
- Services: `backend/src/services/` (`careRequest.service.ts`, `device.service.ts`, `patient.service.ts`, `commandRules.service.ts`, `chords.service.ts`, `audit.service.ts`)
- Models: `backend/src/models/` (`careRequest.model.ts`, `device.model.ts`, `patient.model.ts`, `bed.model.ts`, `commandRule.model.ts`, `user.model.ts`)
- Middleware: `backend/src/middleware/` (`auth.middleware.ts`, `validation.middleware.ts`)
- Real-time layer: Socket.IO initialized in `backend/src/server.ts`, event dispatching in `careRequest.service.ts`
- Configuration: `backend/src/config/env.ts`, `backend/src/config/database.ts`

### Frontend (`/frontend`)
- Application entry: `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`
- Routes:
  - `/` (Patient landing and initial portal)
  - `/nurse` (Nurse Station clinical desk)
  - `/bedside-audio` (Clean bedside speaker voice assistant node)
  - `/verify-email/[token]` (Account verification)
- Dashboard: `frontend/src/app/nurse/page.tsx`
- Modular Dashboard Sub-views (`frontend/src/components/dashboard/`):
  - `DashboardSidebar.tsx` (collapsible navigation with status badges and voice toggle)
  - `DashboardHeader.tsx` (telemetry bar, date, Chords studio launcher, Bedside Speaker shortcut)
  - `EmergencyAlertDeck.tsx` (priority emergency call banner with instant 1-click Acknowledge)
  - `OverviewView.tsx` (ward bed occupancy, gateway health cards, activity feed)
  - `LiveCallsView.tsx` (patient-grouped live calls with step transitions)
  - `PatientRegistryView.tsx` (patient cards, handshake pills, bed assignment, device allocation)
  - `HardwareGatewaysView.tsx` (hardware table, battery levels, BLE commissioning trigger, command editor)
  - `StepConfirmModal.tsx` (Acknowledge / Start Care / Bedside Audio resolution modal)
- Modals & Feature Tools:
  - `BleCommissioningModal.tsx` (Web Bluetooth provisioning for ESP32 gateways)
  - `ChordsSignalVisualizerModal.tsx` (Upside Down Labs live biopotential waveform studio)
  - `CommandRuleEditor.tsx` (online device threshold and gesture rule calibration)
- API layer: `frontend/src/lib/api.ts`
- State & Voice: `frontend/src/lib/auth.tsx`, `frontend/src/lib/speech.ts`, `frontend/src/lib/audioCommandRecognition.ts` (speech command parsing, sequential command locking, gesture confirmation classifier), `frontend/src/lib/theme.tsx`
- Iconography: `frontend/src/lib/noIcons.tsx` (lightweight inline SVG icons)

### Device (`/device-kit`)
- Firmware entry: `device-kit/NetraVaani-Device.ino`, `device-kit/nv_main.cpp`
- Signal processing: `device-kit/nv_signal.cpp`, `device-kit/nv_signal.h`
- Gesture classification: `device-kit/nv_detect.cpp`, `device-kit/nv_detect.h`
- Command mapping: `device-kit/nv_storage.cpp`, `device-kit/nv_config.h`
- BLE Commissioning: `device-kit/nv_ble.cpp`, `device-kit/nv_ble.h`
- Network communication: `device-kit/nv_net.cpp`, `device-kit/nv_events.cpp`
- Alarm & State recovery: `device-kit/nv_alarm.cpp`, `device-kit/nv_state.cpp`

## 11. API and Event Registry

Verified contracts from existing backend routers:

| Name | Method & Endpoint | Purpose |
|---|---|---|
| Device Registration | `POST /api/devices/register` | Register new NPG hardware gateway |
| Device Heartbeat & Discovery | `POST /api/devices/heartbeat` / `GET /api/devices` | Keep-alive telemetry, battery, and device list |
| Device Allocation | `POST /api/patients/:code/assign-device` | Strictly allocate 1 online device to a patient |
| Device Deallocation | `POST /api/devices/:deviceId/unassign` | Release device back to available pool |
| Device Config & Rules | `GET /api/command-rules/:deviceId` / `POST /api/command-rules` | Fetch and update calibrated gesture command rules |
| Care Request Ingestion | `POST /api/devices/events` / `POST /api/care-requests` | Ingest recognized gesture signals with gating invariants |
| Care Request Advancement | `PATCH /api/care-requests/:id/acknowledge` | Acknowledge call (Step 1) |
| Care Request Advancement | `PATCH /api/care-requests/:id/start` | Start assisting patient (Step 2: In-Progress) |
| Bedside Patient Audio Prompt | `POST /api/care-requests/:id/request-patient-confirmation` | Request bedside audio voice confirmation |
| Bedside Confirmation Response | `POST /api/care-requests/:id/patient-confirm` | Patient confirms or disputes resolution at bedside |
| Direct Nurse Override | `PATCH /api/care-requests/:id/resolve` | Staff override resolution without audio confirmation |
| Patient Bed Registration | `POST /api/patients/with-bed` | Nurse registers patient and assigns bed |
| Bed Change Proposal | `POST /api/patients/:code/propose-bed` | Propose new hospital bed transfer |
| Bed List | `GET /api/beds` | Available, occupied, and pending bed states |
| Chords Live Stream | `GET /api/chords/live-stream` / WebSocket | Biopotential EOG/EMG waveform telemetry |

Do not guess endpoint URLs or event names.

## 12. Current Development State

This file represents the intended architecture and business rules, not proof that every feature is implemented.

Before each task, inspect only the relevant implementation and reconcile it with this document.

When architecture changes, update this file.

Keep implementation progress in CHANGELOG_AI.md.