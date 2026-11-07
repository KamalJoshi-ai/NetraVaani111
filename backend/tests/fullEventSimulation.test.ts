import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/lib/db.js";
import {
  Device,
  Patient,
  DeviceAssignment,
  CareRequest,
  CommandRule,
  PatientCommunicationState,
} from "../src/models/index.js";

describe("Complete End-to-End Patient & Nurse Event Simulation", () => {
  const app = createApp();
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await connectDatabase(mongoServer.getUri());
  });

  afterAll(async () => {
    await disconnectDatabase();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Promise.all([
      Device.deleteMany({}),
      Patient.deleteMany({}),
      DeviceAssignment.deleteMany({}),
      CareRequest.deleteMany({}),
      CommandRule.deleteMany({}),
      PatientCommunicationState.deleteMany({}),
    ]);
  });

  async function setupActivePatientAndDevice() {
    // 1. Device registration and heartbeat
    const devRes = await request(app)
      .post("/api/devices")
      .send({ name: "Bedside-Unit-Simulation", isDevRegistration: true });
    const deviceId = devRes.body.data.deviceId;

    await request(app)
      .post(`/api/devices/${deviceId}/heartbeat`)
      .send({ batteryLevel: 100, firmwareVersion: "nv-5.1.0" });

    // 2. Patient registration (default confirmationSettings - requireDispatchConfirmation defaults to false)
    const ptRes = await request(app)
      .post("/api/patients")
      .send({
        displayName: "Siddharth Verma",
        bedLabel: "ICU-Bed-09",
        status: "ACTIVE",
      });
    const patientCode = ptRes.body.data.patientCode;

    // 3. Nurse assigns device to patient
    await request(app)
      .post(`/api/patients/${patientCode}/assign-device`)
      .send({ deviceId, assignedBy: "Nurse Supervisor" });

    // 4. Initial hardware safety handshake (YES + NO calibration signals)
    await request(app).post("/api/device-events").send({ deviceId, ruleId: "yes" });
    await request(app).post("/api/device-events").send({ deviceId, ruleId: "no" });

    return { deviceId, patientCode };
  }

  it("Full Event Simulation: Signal/Gesture happens -> Directly sent to Nurse without asking patient again -> Nurse handles -> Nurse requests confirmation -> Patient confirms YES -> Nurse resolves", async () => {
    const { deviceId, patientCode } = await setupActivePatientAndDevice();

    // ==========================================
    // STEP 1: Patient triggers a Gesture Signal (e.g. WATER)
    // ==========================================
    const gestureEvent = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "water",
      counts: { eog: 5, emgLeft: 0, emgRight: 0, together: 0 },
    });

    // CRITICAL REQUIREMENT VERIFICATION:
    // It must NOT ask patient again to confirm whether to send or not!
    // It must directly create as NEW (not PENDING_DISPATCH_CONFIRMATION).
    expect([200, 201]).toContain(gestureEvent.status);
    expect(gestureEvent.body.accepted).toBe(true);
    expect(gestureEvent.body.data.status).toBe("NEW");
    expect(gestureEvent.body.data.action).toBe("WATER");
    expect(gestureEvent.body.data.status).not.toBe("PENDING_DISPATCH_CONFIRMATION");
    const requestId = gestureEvent.body.data._id;

    // ==========================================
    // STEP 2: Nurse Dashboard sees the incoming request in the live ledger
    // ==========================================
    const nurseDashboardRes = await request(app)
      .get("/api/care-requests")
      .query({ patientCode });

    expect(nurseDashboardRes.status).toBe(200);
    expect(nurseDashboardRes.body.data.length).toBeGreaterThanOrEqual(1);
    const liveCall = nurseDashboardRes.body.data.find((r: any) => r._id === requestId);
    expect(liveCall).toBeDefined();
    expect(liveCall.status).toBe("NEW");
    expect(liveCall.patient.bedLabel.toUpperCase()).toBe("ICU-BED-09");

    // ==========================================
    // STEP 3: Nurse acknowledges and begins care
    // ==========================================
    const ackRes = await request(app).patch(`/api/care-requests/${requestId}/acknowledge`);
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.data.status).toBe("ACKNOWLEDGED");

    const inProgressRes = await request(app)
      .patch(`/api/care-requests/${requestId}/in-progress`)
      .send({ handledBy: "Nurse Maya" });
    expect(inProgressRes.status).toBe(200);
    expect(inProgressRes.body.data.status).toBe("IN_PROGRESS");

    // ==========================================
    // STEP 4: Nurse completes bedside care and requests patient confirmation
    // ==========================================
    const reqConfirmRes = await request(app)
      .post(`/api/care-requests/${requestId}/request-confirmation`);
    expect(reqConfirmRes.status).toBe(200);
    expect(reqConfirmRes.body.data.status).toBe("AWAITING_CONFIRMATION");
    expect(reqConfirmRes.body.data.confirmation).toBe("PENDING");

    // Active bedside status reflects that confirmation is awaiting
    const bedsideStatus = await request(app)
      .get(`/api/care-requests/active-confirmation?deviceId=${deviceId}`);
    expect(bedsideStatus.status).toBe(200);
    expect(bedsideStatus.body.data.mode).toBe("RESOLUTION_CONFIRMATION");

    // ==========================================
    // STEP 5: Patient performs YES gesture (3-4 blinks) to verify care was delivered
    // ==========================================
    const confirmGestureRes = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "yes",
      counts: { eog: 3, emgLeft: 0, emgRight: 0, together: 0 },
    });
    expect([200, 201]).toContain(confirmGestureRes.status);
    expect(confirmGestureRes.body.accepted).toBe(true);
    expect(confirmGestureRes.body.data.status).toBe("CONFIRMED");
    expect(confirmGestureRes.body.data.confirmation).toBe("YES");

    // ==========================================
    // STEP 6: Nurse completes the resolution
    // ==========================================
    const resolveRes = await request(app)
      .patch(`/api/care-requests/${requestId}/resolve`)
      .send({ resolvedBy: "Nurse Maya" });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe("RESOLVED");
    expect(resolveRes.body.data.resolvedAt).toBeDefined();

    // ==========================================
    // STEP 7: Unlocked for next patient request
    // ==========================================
    const nextGestureEvent = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "adjustment",
      counts: { eog: 0, emgLeft: 0, emgRight: 3, together: 0 },
    });
    expect([200, 201]).toContain(nextGestureEvent.status);
    expect(nextGestureEvent.body.accepted).toBe(true);
    expect(nextGestureEvent.body.data.status).toBe("NEW");
    expect(nextGestureEvent.body.data.action).toBe("REPOSITION");
  });

  it("Rejection Simulation: Nurse requests confirmation -> Patient gestures NO -> Flags FOLLOW_UP_REQUIRED -> Nurse resolves after follow-up", async () => {
    const { deviceId, patientCode } = await setupActivePatientAndDevice();

    // Patient signals CALL_NURSE -> Directly creates NEW request without asking patient again
    const callRes = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "call_nurse",
      counts: { eog: 0, emgLeft: 3, emgRight: 0, together: 0 },
    });
    expect(callRes.body.accepted).toBe(true);
    expect(callRes.body.data.status).toBe("NEW");
    const requestId = callRes.body.data._id;

    // Nurse transitions to IN_PROGRESS and requests confirmation
    await request(app).patch(`/api/care-requests/${requestId}/acknowledge`);
    await request(app).patch(`/api/care-requests/${requestId}/in-progress`);
    await request(app).post(`/api/care-requests/${requestId}/request-confirmation`);

    // Patient signals NO (both wrists squeezed) -> Not satisfied with care
    const noGestureRes = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "no",
      counts: { eog: 0, emgLeft: 1, emgRight: 1, together: 1 },
    });
    expect(noGestureRes.body.accepted).toBe(true);
    expect(noGestureRes.body.data.status).toBe("FOLLOW_UP_REQUIRED");
    expect(noGestureRes.body.data.confirmation).toBe("NO");
    expect(noGestureRes.body.data.urgent).toBe(true);

    // Nurse attends and resolves
    const resolveRes = await request(app)
      .patch(`/api/care-requests/${requestId}/resolve`)
      .send({ resolvedBy: "Nurse Maya" });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe("RESOLVED");
  });

  it("Emergency Signal Simulation: Emergency gesture directly reaches Nurse Dashboard immediately as urgent alarm", async () => {
    const { deviceId } = await setupActivePatientAndDevice();

    const emergencyEvent = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "emergency",
      label: "EMERGENCY / SEVERE PAIN",
      alarm: true,
      urgent: true,
      counts: { eog: 0, emgLeft: 3, emgRight: 3, together: 3 },
    });

    expect([200, 201]).toContain(emergencyEvent.status);
    expect(emergencyEvent.body.accepted).toBe(true);
    expect(emergencyEvent.body.data.status).toBe("NEW");
    expect(emergencyEvent.body.data.action).toBe("EMERGENCY");
    expect(emergencyEvent.body.data.urgent).toBe(true);
    expect(emergencyEvent.body.data.alarm).toBe(true);
  });
});
