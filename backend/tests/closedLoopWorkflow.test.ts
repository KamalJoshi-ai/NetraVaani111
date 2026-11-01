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

describe("Unified Closed-Loop Request & Resolution Workflow", () => {
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

  async function setupPatientAndDevice() {
    const devRes = await request(app)
      .post("/api/devices")
      .send({ name: "Bedside-Unit-01", isDevRegistration: true });
    const deviceId = devRes.body.data.deviceId;

    await request(app)
      .post(`/api/devices/${deviceId}/heartbeat`)
      .send({ batteryLevel: 98, firmwareVersion: "nv-5.0.0" });

    const ptRes = await request(app)
      .post("/api/patients")
      .send({
        displayName: "Aarav Gupta",
        bedLabel: "ICU-Bed-04",
        status: "ACTIVE",
        confirmationSettings: { requireDispatchConfirmation: false },
      });
    const patientCode = ptRes.body.data.patientCode;

    await request(app)
      .post(`/api/patients/${patientCode}/assign-device`)
      .send({ deviceId, assignedBy: "Charge Nurse" });

    // Disable bedside dispatch confirmation so requests immediately enter NEW status
    await Patient.updateOne(
      { patientCode },
      { $set: { "confirmationSettings.requireDispatchConfirmation": false } }
    );

    // Complete initial handshake
    await request(app).post("/api/device-events").send({ deviceId, ruleId: "yes" });
    await request(app).post("/api/device-events").send({ deviceId, ruleId: "no" });

    return { deviceId, patientCode };
  }

  it("Full Lifecycle: Single active request -> In Progress -> Awaiting Confirmation -> YES -> CONFIRMED -> Nurse Completes -> Unlocked", async () => {
    const { deviceId } = await setupPatientAndDevice();

    // 1. Patient requests WATER
    const req1 = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "water",
      counts: { eog: 5, emgLeft: 0, emgRight: 0, together: 0 },
    });
    expect(req1.body.accepted).toBe(true);
    expect(req1.body.data.status).toBe("NEW");
    expect(req1.body.data.action).toBe("WATER");
    expect(req1.body.data.confirmation).toBe("NOT_REQUESTED");
    const requestId = req1.body.data._id;

    // 2. Patient tries second request while first is active -> Blocked!
    const req2 = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "call_nurse",
    });
    expect(req2.body.accepted).toBe(false);
    expect(req2.body.reason).toBe("ACTIVE_REQUEST_EXISTS");

    // 3. Nurse acknowledges and starts handling request -> IN_PROGRESS
    await request(app).patch(`/api/care-requests/${requestId}/acknowledge`);
    const handleRes = await request(app)
      .patch(`/api/care-requests/${requestId}/in-progress`)
      .send({ handledBy: "Nurse Sarah" });
    expect(handleRes.status).toBe(200);
    expect(handleRes.body.data.status).toBe("IN_PROGRESS");

    // 4. Nurse requests patient confirmation -> AWAITING_CONFIRMATION
    const confirmReqRes = await request(app)
      .post(`/api/care-requests/${requestId}/request-confirmation`);
    expect(confirmReqRes.status).toBe(200);
    expect(confirmReqRes.body.data.status).toBe("AWAITING_CONFIRMATION");
    expect(confirmReqRes.body.data.confirmation).toBe("PENDING");

    // Check active confirmation status endpoint
    const activeConf = await request(app).get(`/api/care-requests/active-confirmation?deviceId=${deviceId}`);
    expect(activeConf.body.data).toBeDefined();
    expect(activeConf.body.data.mode).toBe("RESOLUTION_CONFIRMATION");

    // 5. Patient performs YES gesture (3 blinks) -> CONFIRMED (not yet RESOLVED)
    const yesGesture = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "yes",
      counts: { eog: 3, emgLeft: 0, emgRight: 0, together: 0 },
    });
    expect(yesGesture.body.accepted).toBe(true);
    expect(yesGesture.body.data.status).toBe("CONFIRMED");
    expect(yesGesture.body.data.confirmation).toBe("YES");
    expect(yesGesture.body.data.confirmedAt).toBeDefined();

    // Still locked for next request until nurse clicks complete
    const tryReq3 = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "call_nurse",
    });
    expect(tryReq3.body.accepted).toBe(false);
    expect(tryReq3.body.reason).toBe("ACTIVE_REQUEST_EXISTS");

    // 6. Nurse completes resolution -> RESOLVED
    const resolveRes = await request(app)
      .patch(`/api/care-requests/${requestId}/resolve`)
      .send({ resolvedBy: "Nurse Sarah" });
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe("RESOLVED");

    // 7. Unlocked! Next request succeeds
    const nextReq = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "call_nurse",
    });
    expect(nextReq.body.accepted).toBe(true);
    expect(nextReq.body.data.status).toBe("NEW");
    expect(nextReq.body.data.action).toBe("CALL_NURSE");
  });

  it("Rejection branch: Awaiting Confirmation -> NO -> FOLLOW_UP_REQUIRED -> Nurse resolves", async () => {
    const { deviceId } = await setupPatientAndDevice();

    // 1. Patient requests ADJUSTMENT
    const req1 = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "adjustment",
      counts: { eog: 0, emgLeft: 0, emgRight: 3, together: 0 },
    });
    expect(req1.body.accepted).toBe(true);
    const requestId = req1.body.data._id;

    // 2. Nurse acknowledges, starts handling and requests confirmation
    await request(app).patch(`/api/care-requests/${requestId}/acknowledge`);
    await request(app).patch(`/api/care-requests/${requestId}/in-progress`);
    await request(app).post(`/api/care-requests/${requestId}/request-confirmation`);

    // 3. Patient sends NO (squeeze both hands) -> FOLLOW_UP_REQUIRED
    const noGesture = await request(app).post("/api/device-events").send({
      deviceId,
      ruleId: "no",
      counts: { eog: 0, emgLeft: 1, emgRight: 1, together: 1 },
    });
    expect(noGesture.body.accepted).toBe(true);
    expect(noGesture.body.data.status).toBe("FOLLOW_UP_REQUIRED");
    expect(noGesture.body.data.confirmation).toBe("NO");
    expect(noGesture.body.data.urgent).toBe(true);

    // 4. Nurse follows up and completes
    const resolveRes = await request(app).patch(`/api/care-requests/${requestId}/resolve`);
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.data.status).toBe("RESOLVED");
  });
});
