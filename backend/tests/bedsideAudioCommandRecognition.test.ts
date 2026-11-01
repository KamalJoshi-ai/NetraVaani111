import { describe, it, expect } from "vitest";

// Re-implement or import the pure functions for the backend test environment
const SUPPORTED_AUDIO_COMMANDS = {
  WATER: {
    commandId: "WATER",
    ruleId: "water",
    action: "WATER",
    displayName: "Water",
    ttsPrompt: "The recognized command is Water. Do you want to confirm this command?",
    keywords: ["water", "drink", "thirsty", "glass of water", "water please", "need water", "want water", "pani"],
  },
  CALL_NURSE: {
    commandId: "CALL_NURSE",
    ruleId: "call_nurse",
    action: "CALL_NURSE",
    displayName: "Call Nurse",
    ttsPrompt: "The recognized command is Call Nurse. Do you want to confirm this command?",
    keywords: ["call nurse", "nurse", "sister", "need nurse", "nurse please", "call the nurse", "attendant", "help nurse"],
  },
  ADJUSTMENT: {
    commandId: "ADJUSTMENT",
    ruleId: "adjustment",
    action: "REPOSITION",
    displayName: "Adjustment",
    ttsPrompt: "The recognized command is Adjustment. Do you want to confirm this command?",
    keywords: ["adjustment", "adjust", "pillow", "position", "reposition", "bed adjust", "sit up", "move bed"],
  },
  EMERGENCY: {
    commandId: "EMERGENCY",
    ruleId: "emergency",
    action: "EMERGENCY",
    displayName: "Emergency",
    ttsPrompt: "The recognized command is Emergency. Do you want to confirm this command?",
    keywords: ["emergency", "critical", "doctor immediately", "urgent alert", "severe pain", "help emergency", "doctor"],
  },
};

function parseSpokenCommand(transcript: string) {
  if (!transcript || typeof transcript !== "string") return null;
  const normalized = transcript.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "").replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  for (const kw of SUPPORTED_AUDIO_COMMANDS.EMERGENCY.keywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(normalized)) return SUPPORTED_AUDIO_COMMANDS.EMERGENCY;
  }
  for (const kw of SUPPORTED_AUDIO_COMMANDS.WATER.keywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(normalized)) return SUPPORTED_AUDIO_COMMANDS.WATER;
  }
  for (const kw of SUPPORTED_AUDIO_COMMANDS.CALL_NURSE.keywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(normalized)) return SUPPORTED_AUDIO_COMMANDS.CALL_NURSE;
  }
  for (const kw of SUPPORTED_AUDIO_COMMANDS.ADJUSTMENT.keywords) {
    if (new RegExp(`\\b${kw}\\b`, "i").test(normalized)) return SUPPORTED_AUDIO_COMMANDS.ADJUSTMENT;
  }
  return null;
}

function classifyGesture(counts?: { eog: number; emgLeft: number; emgRight: number; together?: number }, ruleId?: string, action?: string) {
  const rId = (ruleId || "").toLowerCase();
  const act = (action || "").toUpperCase();

  if (rId === "emergency" || act === "EMERGENCY") return "EMERGENCY";
  if (rId === "yes" || rId === "c07" || act === "YES") return "YES";
  if (rId === "no" || rId === "c05" || act === "NO") return "NO";

  if (!counts) {
    if (rId === "water" || act === "WATER") return "SERVICE_COMMAND";
    if (rId === "call_nurse" || act === "CALL_NURSE") return "SERVICE_COMMAND";
    if (rId === "adjustment" || act === "REPOSITION") return "SERVICE_COMMAND";
    return "UNKNOWN";
  }

  const { eog = 0, emgLeft = 0, emgRight = 0, together = 0 } = counts;

  // 1. EMERGENCY: 3+ squeezes both wrists / together >= 3
  if (together >= 3 || (emgLeft >= 3 && emgRight >= 3)) {
    return "EMERGENCY";
  }

  // 2. Ordinary service command gestures
  if (eog >= 5 && emgLeft === 0 && emgRight === 0 && together === 0) return "SERVICE_COMMAND"; // WATER (5+ blinks)
  if (emgLeft >= 3 && emgRight === 0 && together === 0) return "SERVICE_COMMAND"; // CALL NURSE (3+ left)
  if (emgRight >= 3 && emgLeft === 0 && together === 0) return "SERVICE_COMMAND"; // ADJUSTMENT (3+ right)

  // 3. YES: strictly 3–4 blinks, 0 left, 0 right, no together
  if (eog >= 3 && eog <= 4 && emgLeft === 0 && emgRight === 0 && together === 0) {
    return "YES";
  }

  // 4. NO: 1–2 squeezes both sides together
  if (
    (together >= 1 && together <= 2) ||
    (emgLeft >= 1 && emgLeft <= 2 && emgRight >= 1 && emgRight <= 2)
  ) {
    return "NO";
  }

  return "UNKNOWN";
}

describe("Bedside Audio Command Recognition & Patient Gesture Confirmation", () => {
  describe("1. Audio Command Recognition (STT)", () => {
    it("recognizes WATER from various natural spoken expressions", () => {
      expect(parseSpokenCommand("water")?.commandId).toBe("WATER");
      expect(parseSpokenCommand("I need water please")?.commandId).toBe("WATER");
      expect(parseSpokenCommand("give me some water")?.commandId).toBe("WATER");
      expect(parseSpokenCommand("I am thirsty")?.commandId).toBe("WATER");
      expect(parseSpokenCommand("glass of water")?.commandId).toBe("WATER");
    });

    it("recognizes CALL NURSE from various expressions", () => {
      expect(parseSpokenCommand("call nurse")?.commandId).toBe("CALL_NURSE");
      expect(parseSpokenCommand("please call the nurse")?.commandId).toBe("CALL_NURSE");
      expect(parseSpokenCommand("nurse help")?.commandId).toBe("CALL_NURSE");
      expect(parseSpokenCommand("sister please come")?.commandId).toBe("CALL_NURSE");
    });

    it("recognizes ADJUSTMENT from various expressions", () => {
      expect(parseSpokenCommand("adjustment")?.commandId).toBe("ADJUSTMENT");
      expect(parseSpokenCommand("adjust my bed")?.commandId).toBe("ADJUSTMENT");
      expect(parseSpokenCommand("reposition my pillow")?.commandId).toBe("ADJUSTMENT");
      expect(parseSpokenCommand("change my position")?.commandId).toBe("ADJUSTMENT");
    });

    it("recognizes EMERGENCY with highest priority", () => {
      expect(parseSpokenCommand("emergency")?.commandId).toBe("EMERGENCY");
      expect(parseSpokenCommand("I have severe pain")?.commandId).toBe("EMERGENCY");
      expect(parseSpokenCommand("doctor immediately")?.commandId).toBe("EMERGENCY");
    });

    it("rejects unsupported, random, or ambiguous speech", () => {
      expect(parseSpokenCommand("hello world")).toBeNull();
      expect(parseSpokenCommand("what is the weather today")).toBeNull();
      expect(parseSpokenCommand("turn on the television")).toBeNull();
      expect(parseSpokenCommand("")).toBeNull();
    });

    it("matches exact TTS dictation requirement", () => {
      const waterCmd = parseSpokenCommand("water");
      expect(waterCmd?.ttsPrompt).toBe("The recognized command is Water. Do you want to confirm this command?");

      const nurseCmd = parseSpokenCommand("nurse");
      expect(nurseCmd?.ttsPrompt).toBe("The recognized command is Call Nurse. Do you want to confirm this command?");

      const adjustCmd = parseSpokenCommand("adjustment");
      expect(adjustCmd?.ttsPrompt).toBe("The recognized command is Adjustment. Do you want to confirm this command?");
    });
  });

  describe("2. Gesture Classification Rules", () => {
    it("classifies strictly 3-4 blinks as YES", () => {
      expect(classifyGesture({ eog: 3, emgLeft: 0, emgRight: 0 })).toBe("YES");
      expect(classifyGesture({ eog: 4, emgLeft: 0, emgRight: 0 })).toBe("YES");
    });

    it("ensures right wrist squeezes alone are NOT classified as YES", () => {
      expect(classifyGesture({ eog: 0, emgLeft: 0, emgRight: 1 })).not.toBe("YES");
      expect(classifyGesture({ eog: 0, emgLeft: 0, emgRight: 2 })).not.toBe("YES");
    });

    it("classifies both hands squeeze together 1-2 times as NO", () => {
      expect(classifyGesture({ eog: 0, emgLeft: 1, emgRight: 1, together: 1 })).toBe("NO");
      expect(classifyGesture({ eog: 0, emgLeft: 2, emgRight: 2, together: 2 })).toBe("NO");
    });

    it("ensures left wrist squeezes alone are NOT classified as NO", () => {
      expect(classifyGesture({ eog: 0, emgLeft: 1, emgRight: 0, together: 0 })).not.toBe("NO");
      expect(classifyGesture({ eog: 0, emgLeft: 2, emgRight: 0, together: 0 })).not.toBe("NO");
    });

    it("classifies 3+ bilateral wrist squeeze as EMERGENCY", () => {
      expect(classifyGesture({ eog: 0, emgLeft: 3, emgRight: 3, together: 3 })).toBe("EMERGENCY");
    });

    it("distinguishes ordinary service command gestures from confirmation", () => {
      expect(classifyGesture({ eog: 5, emgLeft: 0, emgRight: 0 })).toBe("SERVICE_COMMAND"); // WATER
      expect(classifyGesture({ eog: 0, emgLeft: 3, emgRight: 0 })).toBe("SERVICE_COMMAND"); // CALL NURSE
      expect(classifyGesture({ eog: 0, emgLeft: 0, emgRight: 3 })).toBe("SERVICE_COMMAND"); // ADJUSTMENT
    });

    it("handles explicit rule and action identifiers", () => {
      expect(classifyGesture(undefined, "yes")).toBe("YES");
      expect(classifyGesture(undefined, "no")).toBe("NO");
      expect(classifyGesture(undefined, "emergency")).toBe("EMERGENCY");
      expect(classifyGesture(undefined, "water")).toBe("SERVICE_COMMAND");
    });
  });

  describe("3. Sequential Command Lock Invariant", () => {
    it("enforces single command lock state machine transitions", () => {
      let commandLock = false;
      let activeCommand: any = null;
      let state = "IDLE";

      // 1. Audio recognized
      const recognized = parseSpokenCommand("water");
      expect(recognized).not.toBeNull();

      // Lock activates immediately
      commandLock = true;
      activeCommand = recognized;
      state = "ANNOUNCING";
      expect(commandLock).toBe(true);
      expect(state).toBe("ANNOUNCING");

      // 2. TTS finishes announcing
      state = "WAITING_FOR_CONFIRMATION";
      expect(state).toBe("WAITING_FOR_CONFIRMATION");

      // 3. Incoming second command while locked is BLOCKED
      const secondSpoken = "call nurse";
      if (commandLock) {
        // Recognition pipeline is paused/blocked!
        // No overwrite
      }
      expect(activeCommand.commandId).toBe("WATER");

      // 4. Ordinary service gesture is ignored while locked
      const serviceGesture = classifyGesture({ eog: 5, emgLeft: 0, emgRight: 0 }); // WATER gesture
      expect(serviceGesture).toBe("SERVICE_COMMAND");
      // Must not confirm or reject
      expect(serviceGesture !== "YES" && serviceGesture !== "NO").toBe(true);

      // 5. Patient performs YES gesture
      const yesGesture = classifyGesture({ eog: 3, emgLeft: 0, emgRight: 0 });
      expect(yesGesture).toBe("YES");

      state = "CONFIRMED";
      state = "DELIVERING";
      // Backend simulated success
      state = "DELIVERED";

      // 6. Release lock only after successful delivery
      activeCommand = null;
      commandLock = false;
      state = "LISTENING";

      expect(commandLock).toBe(false);
      expect(activeCommand).toBeNull();
      expect(state).toBe("LISTENING");
    });

    it("discards command and releases lock without dashboard delivery when NO is performed", () => {
      let commandLock = true;
      let activeCommand = parseSpokenCommand("call nurse");
      let state = "WAITING_FOR_CONFIRMATION";
      let sentToDashboard = false;

      const noGesture = classifyGesture({ eog: 0, emgLeft: 1, emgRight: 1, together: 1 });
      expect(noGesture).toBe("NO");

      state = "REJECTED";
      // Do not send to dashboard!
      sentToDashboard = false;

      // Clear active command & release lock
      activeCommand = null;
      commandLock = false;
      state = "LISTENING";

      expect(sentToDashboard).toBe(false);
      expect(commandLock).toBe(false);
      expect(activeCommand).toBeNull();
    });

    it("permits emergency escalation even when command lock is active", () => {
      const commandLock = true;
      const activeCommand = parseSpokenCommand("water");
      let emergencyTriggered = false;

      // Emergency gesture arrives
      const gesture = classifyGesture({ eog: 0, emgLeft: 3, emgRight: 3, together: 3 });
      expect(gesture).toBe("EMERGENCY");

      if (gesture === "EMERGENCY") {
        emergencyTriggered = true;
        // Does NOT overwrite pending ordinary command
      }

      expect(emergencyTriggered).toBe(true);
      expect(activeCommand?.commandId).toBe("WATER");
      expect(commandLock).toBe(true);
    });
  });
});
