/**
 * NetraVaani – Bedside Audio Command Recognition & Gesture Confirmation Engine
 *
 * Enforces the strict sequential communication workflow:
 * 1. Recognizes incoming audio command from patient/bedside microphone.
 * 2. Dictates recognized command via Text-to-Speech (TTS):
 *    "The recognized command is {Command}. Do you want to confirm this command?"
 * 3. Enforces commandLock = true; waits for patient confirmation via eye/jaw gestures.
 * 4. YES confirms -> delivers to Nurse Dashboard -> announces success -> releases lock.
 * 5. NO rejects -> discards command -> announces rejection -> releases lock.
 * 6. High priority EMERGENCY gesture always escalates immediately and independently.
 *
 * Invariant: Bedside Audio must handle only ONE command at a time.
 */

export type BedsideCommandLifecycle =
  | "IDLE"
  | "LISTENING"
  | "RECOGNIZING"
  | "ANNOUNCING"
  | "WAITING_FOR_CONFIRMATION"
  | "CONFIRMED"
  | "REJECTED"
  | "DELIVERING"
  | "DELIVERY_FAILED"
  | "DELIVERED"
  | "EXPIRED"
  | "ERROR";

export interface SupportedAudioCommandConfig {
  commandId: string;
  ruleId: string;
  action: string;
  displayName: string;
  ttsPrompt: string;
  keywords: string[];
  isEmergency?: boolean;
}

export const SUPPORTED_AUDIO_COMMANDS: Record<string, SupportedAudioCommandConfig> = {
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
    isEmergency: true,
  },
};

export interface ActivePendingCommand {
  commandId: string;
  ruleId: string;
  action: string;
  displayName: string;
  ttsPrompt: string;
  idempotencyKey: string;
  recognizedAt: number;
  confirmedAt?: number;
  rejectedAt?: number;
  deliveryAttempts: number;
  lastError?: string;
  requestId?: string;
  mode?: string;
}

/**
 * Parses raw speech text into a strictly validated NetraVaani supported command.
 * Returns null if the text is ambiguous, unsupported, or does not match any command.
 */
export function parseSpokenCommand(transcript: string): SupportedAudioCommandConfig | null {
  if (!transcript || typeof transcript !== "string") return null;

  const normalized = transcript
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return null;

  // Check for emergency first (priority)
  for (const kw of SUPPORTED_AUDIO_COMMANDS.EMERGENCY.keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(normalized)) {
      return SUPPORTED_AUDIO_COMMANDS.EMERGENCY;
    }
  }

  // Check Water
  for (const kw of SUPPORTED_AUDIO_COMMANDS.WATER.keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(normalized)) {
      return SUPPORTED_AUDIO_COMMANDS.WATER;
    }
  }

  // Check Call Nurse
  for (const kw of SUPPORTED_AUDIO_COMMANDS.CALL_NURSE.keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(normalized)) {
      return SUPPORTED_AUDIO_COMMANDS.CALL_NURSE;
    }
  }

  // Check Adjustment
  for (const kw of SUPPORTED_AUDIO_COMMANDS.ADJUSTMENT.keywords) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(normalized)) {
      return SUPPORTED_AUDIO_COMMANDS.ADJUSTMENT;
    }
  }

  return null;
}

export type ClassifiedGestureType = "YES" | "NO" | "EMERGENCY" | "SERVICE_COMMAND" | "UNKNOWN";

/**
 * Classifies an incoming hardware gesture or simulated input against NetraVaani rules.
 *
 * Exact Mappings from NetraVaani Hardware Specification:
 * - YES: 3–4 Blinks (Forehead EOG: 3..4, Left: 0, Right: 0, Together: No). Right wrist alone is NOT YES.
 * - NO: 1–2 Squeezes Both Hands Together (Left: 1..2, Right: 1..2, Together: Yes). Left wrist alone is NOT NO.
 * - WATER: 5+ Blinks (Forehead EOG: >=5, Left: 0, Right: 0, Together: No)
 * - CALL NURSE: 3+ Left Wrist Squeezes (Left: >=3, Right: 0, Together: No)
 * - ADJUSTMENT: 3+ Right Wrist Squeezes (Right: >=3, Left: 0, Together: No)
 * - EMERGENCY: 3+ Both Wrists Together (Left: >=3, Right: >=3, Together: Yes)
 */
export function classifyGesture(
  counts?: { eog: number; emgLeft: number; emgRight: number; together?: number },
  ruleId?: string,
  action?: string
): ClassifiedGestureType {
  const rId = (ruleId || "").toLowerCase();
  const act = (action || "").toUpperCase();

  // Explicit rule/action matches
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
  // WATER: 5+ blinks, 0 left, 0 right
  if (eog >= 5 && emgLeft === 0 && emgRight === 0 && together === 0) return "SERVICE_COMMAND";
  // CALL NURSE: 0 blinks, 3+ left, 0 right
  if (emgLeft >= 3 && emgRight === 0 && together === 0) return "SERVICE_COMMAND";
  // ADJUSTMENT: 0 blinks, 0 left, 3+ right
  if (emgRight >= 3 && emgLeft === 0 && together === 0) return "SERVICE_COMMAND";

  // 3. YES: strictly 3–4 blinks, 0 left, 0 right, no together
  // (Important: Right wrist 1–2 squeezes alone must NOT be classified as YES)
  if (eog >= 3 && eog <= 4 && emgLeft === 0 && emgRight === 0 && together === 0) {
    return "YES";
  }

  // 4. NO: 1–2 squeezes both sides together
  // (Important: Left wrist 1–2 squeezes alone must NOT be classified as NO)
  if (
    (together >= 1 && together <= 2) ||
    (emgLeft >= 1 && emgLeft <= 2 && emgRight >= 1 && emgRight <= 2)
  ) {
    return "NO";
  }

  return "UNKNOWN";
}
