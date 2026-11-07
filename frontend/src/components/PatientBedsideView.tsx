"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { apiClient, PatientItem, CareRequestItem, CommandRuleItem } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { speak as speechSpeak } from "@/lib/speech";
import { parseSpokenCommand } from "@/lib/audioCommandRecognition";
import {
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Bed,
  Shield,
  LogOut,
  RefreshCw,
  Radio,
  Lock,
  User,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Clock,
} from "@/lib/noIcons";

// Browser SpeechRecognition interface
interface IWindowSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart?: () => void;
  onresult?: (event: any) => void;
  onerror?: (event: any) => void;
  onend?: () => void;
}

export interface DisplayGesture {
  id: string;
  gesture: string;
  blinks: string;
  left: string;
  right: string;
  together: boolean;
  name: string;
  action: string;
  urgency: "Standard" | "Urgent" | "Urgent, Alarm (RGB LEDs flash red)";
  counts: { eog: number; emgLeft: number; emgRight: number; together?: number };
}

export const ALL_STANDARD_GESTURES: DisplayGesture[] = [
  {
    id: "yes",
    gesture: "3–4 blinks naturally",
    blinks: "3–4",
    left: "0",
    right: "0",
    together: false,
    name: "YES",
    action: "YES",
    urgency: "Standard",
    counts: { eog: 3, emgLeft: 0, emgRight: 0, together: 0 },
  },
  {
    id: "no",
    gesture: "1–2 squeezes with both hands together",
    blinks: "0",
    left: "1–2",
    right: "1–2",
    together: true,
    name: "NO",
    action: "NO",
    urgency: "Standard",
    counts: { eog: 0, emgLeft: 1, emgRight: 1, together: 1 },
  },
  {
    id: "water",
    gesture: "5+ blinks rapidly",
    blinks: "5+",
    left: "0",
    right: "0",
    together: false,
    name: "WATER",
    action: "WATER",
    urgency: "Standard",
    counts: { eog: 5, emgLeft: 0, emgRight: 0, together: 0 },
  },
  {
    id: "call_nurse",
    gesture: "3+ left wrist squeezes",
    blinks: "0",
    left: "3+",
    right: "0",
    together: false,
    name: "CALL NURSE",
    action: "CALL_NURSE",
    urgency: "Urgent",
    counts: { eog: 0, emgLeft: 3, emgRight: 0, together: 0 },
  },
  {
    id: "adjustment",
    gesture: "3+ right wrist squeezes",
    blinks: "0",
    left: "0",
    right: "3+",
    together: false,
    name: "ADJUSTMENT",
    action: "REPOSITION",
    urgency: "Standard",
    counts: { eog: 0, emgLeft: 0, emgRight: 3, together: 0 },
  },
  {
    id: "emergency",
    gesture: "3+ squeezes with both hands together",
    blinks: "0",
    left: "3+",
    right: "3+",
    together: true,
    name: "EMERGENCY / SEVERE PAIN",
    action: "EMERGENCY",
    urgency: "Urgent, Alarm (RGB LEDs flash red)",
    counts: { eog: 0, emgLeft: 3, emgRight: 3, together: 3 },
  },
];

interface PatientBedsideViewProps {
  patientCode?: string;
  onClose?: () => void;
}

export const formatCount = (range?: [number, number]): string => {
  if (!range) return "0";
  const [lo, hi] = range;
  if (lo === 0 && hi === 0) return "0";
  if (hi >= 20 && lo < 20) return `${lo}+`;
  if (lo === hi) return `${lo}`;
  return `${lo}–${hi}`;
};

export const describeGestureRule = (r: CommandRuleItem): string => {
  const b = formatCount(r.eog);
  const l = formatCount(r.emgLeft);
  const right = formatCount(r.emgRight);

  if (r.simultaneous && r.emgLeft[0] > 0 && r.emgRight[0] > 0) {
    return `${l} squeeze${l === "1" ? "" : "s"} with both hands together`;
  }
  const parts: string[] = [];
  if (r.eog[0] > 0 || r.eog[1] > 0) parts.push(`${b} blink${b === "1" ? "" : "s"}`);
  if (r.emgLeft[0] > 0 || r.emgLeft[1] > 0) parts.push(`${l} left squeeze${l === "1" ? "" : "s"}`);
  if (r.emgRight[0] > 0 || r.emgRight[1] > 0) parts.push(`${right} right squeeze${right === "1" ? "" : "s"}`);
  return parts.join(", then ") || "Rest / Still";
};

// STRICT INVARIANT: Ensure YES and NO confirmation signals never populate the dashboard or active request list
const filterOutHandshakeGestures = (items: CareRequestItem[]): CareRequestItem[] => {
  return (items || []).filter(
    (r) =>
      r.action !== "YES" &&
      r.action !== "NO" &&
      r.ruleId?.toLowerCase() !== "yes" &&
      r.ruleId?.toLowerCase() !== "no" &&
      r.ruleId?.toLowerCase() !== "c07" &&
      r.ruleId?.toLowerCase() !== "c05"
  );
};

export default function PatientBedsideView({ patientCode: propCode, onClose }: PatientBedsideViewProps) {
  const { user, logout } = useAuth();
  const [patient, setPatient] = useState<PatientItem | null>(null);
  const [requestsRaw, setRequestsRaw] = useState<CareRequestItem[]>([]);
  const requests = useMemo(() => filterOutHandshakeGestures(requestsRaw), [requestsRaw]);
  const setRequests = setRequestsRaw;
  const [deviceRules, setDeviceRules] = useState<CommandRuleItem[]>([]);
  const [, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; isError?: boolean } | null>(null);

  

  // Audio & Microphone States (Bedside Audio integrated into Patient Terminal)
  const [isAudioUnlocked, setIsAudioUnlocked] = useState(false);
  const [isVoiceMuted, setIsVoiceMuted] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [micSupported, setMicSupported] = useState(true);

  // Web Audio Context & Speech Recognition Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const recognitionRef = useRef<IWindowSpeechRecognition | null>(null);

  // Zero-latency AudioContext initializer
  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
        // Zero-latency pre-warm: play a micro silent buffer to wake hardware audio pipeline
        try {
          const buffer = audioCtxRef.current.createBuffer(1, 1, 22050);
          const source = audioCtxRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtxRef.current.destination);
          source.start(0);
        } catch {}
      }
    }
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const playChime = useCallback((type: "prompt" | "success" | "alert") => {
    if (isVoiceMuted) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "prompt") {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.45);
      } else if (type === "success") {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.12);
        osc.frequency.setValueAtTime(783.99, now + 0.24);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
      } else {
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(349.23, now + 0.2);
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // AudioContext unavailable
    }
  }, [getAudioContext, isVoiceMuted]);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (isVoiceMuted) return;
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        speechSpeak(text, { volume: 1, rate: 0.95, pitch: 1.05, interrupt: true, onEnd });
      }
    } catch {
      // Speech unavailable
    }
  }, [isVoiceMuted]);

  // Unlock Audio on First User Interaction (bypasses browser autoplay lock with 0 latency)
  useEffect(() => {
    const handleFirstInteraction = () => {
      getAudioContext();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.resume();
        const silent = new SpeechSynthesisUtterance("");
        silent.volume = 0;
        window.speechSynthesis.speak(silent);
      }
      setIsAudioUnlocked(true);
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };

    window.addEventListener("pointerdown", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);
    return () => {
      window.removeEventListener("pointerdown", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, [getAudioContext]);



  const showNotice = (text: string, isError = false) => {
    setNotice({ text, isError });
    setTimeout(() => setNotice(null), 4500);
  };

  const loadPatientData = useCallback(async (codeOrIdentifier: string) => {
    try {
      setLoading(true);
      const res = await apiClient.getPatient(codeOrIdentifier);
      if (res?.data) {
        setPatient(res.data);
        if (res.data.patientCode) {
          try {
            const reqRes = await apiClient.getCareRequests({ patientCode: res.data.patientCode, limit: 100 });
            if (reqRes?.data) {
              setRequests(reqRes.data);
            }
          } catch {
            // silent ignore
          }
        }
        if (res.data.currentAssignment?.device?.deviceId) {
          try {
            const rulesRes = await apiClient.getCommandRules(res.data.currentAssignment.device.deviceId);
            if (rulesRes?.data?.rules && rulesRes.data.rules.length > 0) {
              setDeviceRules(rulesRes.data.rules);
            }
          } catch {
            // fallback to standard gestures
          }
        }
      }
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : "Unable to load patient bedside details", true);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  const handleManualRefresh = async () => {
    const code = patient?.patientCode || propCode || user?.patientCode;
    if (!code) return;
    setIsRefreshing(true);
    try {
      const [pRes, rRes] = await Promise.all([
        apiClient.getPatient(code),
        apiClient.getCareRequests({ patientCode: code, limit: 100 }),
      ]);
      if (pRes?.data) {
        setPatient(pRes.data);
        if (pRes.data.currentAssignment?.device?.deviceId) {
          apiClient.getCommandRules(pRes.data.currentAssignment.device.deviceId)
            .then((rulesRes) => {
              if (rulesRes?.data?.rules && rulesRes.data.rules.length > 0) {
                setDeviceRules(rulesRes.data.rules);
              }
            })
            .catch(() => {});
        }
      }
      if (rRes?.data) setRequests(rRes.data);
      showNotice("Bedside status synchronized successfully");
    } catch {
      showNotice("Failed to refresh status", true);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (propCode) {
      loadPatientData(propCode);
      return;
    }

    if (user?.patientCode) {
      loadPatientData(user.patientCode);
      return;
    }

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("nv_patient_code");
      if (stored) {
        loadPatientData(stored);
        return;
      }
    }

    apiClient
      .getPatientMe()
      .then(async (res) => {
        if (res?.data) {
          setPatient(res.data);
          if (res.data.patientCode && typeof window !== "undefined") {
            localStorage.setItem("nv_patient_code", res.data.patientCode);
          }
          if (res.data.patientCode) {
            try {
              const reqRes = await apiClient.getCareRequests({ patientCode: res.data.patientCode, limit: 100 });
              if (reqRes?.data) {
                setRequests(reqRes.data);
              }
            } catch {
              // silent ignore
            }
          }
          if (res.data.currentAssignment?.device?.deviceId) {
            apiClient
              .getCommandRules(res.data.currentAssignment.device.deviceId)
              .then((rulesRes) => {
                if (rulesRes?.data?.rules && rulesRes.data.rules.length > 0) {
                  setDeviceRules(rulesRes.data.rules);
                }
              })
              .catch(() => {});
          }
          setInitialLoading(false);
        } else if (user) {
          const identifier = user.email || user.username || user.name;
          if (identifier) {
            loadPatientData(identifier);
          } else {
            setInitialLoading(false);
          }
        } else {
          setInitialLoading(false);
        }
      })
      .catch(() => {
        if (user) {
          const identifier = user.email || user.username || user.name;
          if (identifier) {
            loadPatientData(identifier);
          } else {
            setInitialLoading(false);
          }
        } else {
          setInitialLoading(false);
        }
      });
  }, [propCode, user, loadPatientData]);

  // Periodic poll for bed, device assignment, and care link updates
  const activePatientCode =
    patient?.patientCode ||
    propCode ||
    user?.patientCode ||
    (typeof window !== "undefined" ? localStorage.getItem("nv_patient_code") : null);

  useEffect(() => {
    if (!activePatientCode) return;

    const fetchPatientData = async () => {
      try {
        const [pRes, rRes] = await Promise.all([
          apiClient.getPatient(activePatientCode),
          apiClient.getCareRequests({ patientCode: activePatientCode, limit: 50 }),
        ]);
        if (pRes?.data) {
          setPatient(pRes.data);
          if (!pRes.data.currentAssignment) {
            setDeviceRules([]);
          } else if (pRes.data.currentAssignment.device?.deviceId) {
            try {
              const rulesRes = await apiClient.getCommandRules(pRes.data.currentAssignment.device.deviceId);
              if (rulesRes?.data?.rules && rulesRes.data.rules.length > 0) {
                setDeviceRules(rulesRes.data.rules);
              }
            } catch {
              // silent ignore
            }
          }
        }
        if (rRes?.data) {
          setRequests(rRes.data);
        }
      } catch {
        // silent background poll
      }
    };

    const interval = setInterval(fetchPatientData, 2500);
    return () => clearInterval(interval);
  }, [activePatientCode]);

  // Handle Approve Proposed Bed
  const handleApproveBed = async () => {
    if (!patient?.patientCode) return;
    setActionInProgress("approve_bed");
    try {
      const res = await apiClient.approveBedAssignment(patient.patientCode);
      if (res?.data?.patient) {
        setPatient(res.data.patient);
      } else {
        const refetched = await apiClient.getPatient(patient.patientCode);
        if (refetched?.data) setPatient(refetched.data);
      }
      showNotice("Bed assignment approved! Your bed is now confirmed.");
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : "Failed to approve bed assignment", true);
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Reject Proposed Bed
  const handleRejectBed = async () => {
    if (!patient?.patientCode) return;
    setActionInProgress("reject_bed");
    try {
      const res = await apiClient.rejectBedAssignment(patient.patientCode);
      if (res?.data?.patient) {
        setPatient(res.data.patient);
      } else {
        const refetched = await apiClient.getPatient(patient.patientCode);
        if (refetched?.data) setPatient(refetched.data);
      }
      showNotice("Proposed bed declined. Retaining previous bed state.");
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : "Failed to decline bed assignment", true);
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Approve Nurse Link
  const handleApproveNurse = async () => {
    if (!patient) return;
    setActionInProgress("approve_nurse");
    try {
      const res = await apiClient.approveNurseAssignment(
        patient.patientCode,
        patient.pendingBedLabel || patient.bedLabel
      );
      if (res?.data) {
        setPatient(res.data);
      }
      showNotice("Nurse care request link authorized and confirmed!");
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : "Approval failed", true);
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Reject Nurse Link
  const handleRejectNurse = async () => {
    if (!patient) return;
    setActionInProgress("reject_nurse");
    try {
      const res = await apiClient.rejectNurseAssignment(patient.patientCode);
      setPatient(res.data);
      showNotice("Nurse link request declined.");
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : "Action failed", true);
    } finally {
      setActionInProgress(null);
    }
  };

  

  const activeRequest = useMemo(() => {
    return requests.find((r) => r.status !== "RESOLVED" && r.status !== "CANCELLED");
  }, [requests]);

  // Handle Bedside Resolution Confirmation (YES / NO)
  const handlePatientConfirm = useCallback(async (isYes: boolean) => {
    const devId = patient?.currentAssignment?.device?.deviceId;
    if (!devId) {
      showNotice("No active hardware gateway linked to transmit confirmation gesture.", true);
      return;
    }
    setActionInProgress(isYes ? "confirm_yes" : "confirm_no");
    try {
      await apiClient.ingestDeviceEvent(
        isYes
          ? { deviceId: devId, ruleId: "yes", counts: { eog: 3, emgLeft: 0, emgRight: 0, together: 0 } }
          : { deviceId: devId, ruleId: "no", counts: { eog: 0, emgLeft: 1, emgRight: 1, together: 1 } }
      );
      playChime(isYes ? "success" : "prompt");
      speak(isYes ? "Assistance confirmed. Thank you." : "Follow-up requested. The nurse has been alerted.");
      showNotice(isYes ? "Assistance confirmed (YES) transmitted to nurse station." : "Follow-up requested (NO) transmitted to nurse station.");
      if (patient?.patientCode) {
        const reqRes = await apiClient.getCareRequests({ patientCode: patient.patientCode, limit: 50 });
        if (reqRes?.data) setRequests(reqRes.data);
      }
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : "Failed to transmit gesture", true);
    } finally {
      setActionInProgress(null);
    }
  }, [patient?.currentAssignment?.device?.deviceId, patient?.patientCode, playChime, speak, setRequests]);

  // Handle Direct Hardware or Simulated Gesture Trigger
  const handleTriggerGesture = useCallback(async (
    ruleId: string,
    action: string,
    counts: { eog: number; emgLeft: number; emgRight: number; together?: number },
    isAlarm = false,
    isUrgent = false
  ) => {
    const devId = patient?.currentAssignment?.device?.deviceId || "npg-bedside-sim";
    setActionInProgress(`trigger_${ruleId}`);
    try {
      // 1. If active request is awaiting patient confirmation, evaluate YES / NO gestures directly
      if (
        activeRequest?.status === "AWAITING_CONFIRMATION" ||
        activeRequest?.status === "PENDING_PATIENT_CONFIRMATION" ||
        (activeRequest?.status as string) === "AWAITING_PATIENT_CONFIRMATION"
      ) {
        if (ruleId === "yes" || (counts.eog >= 3 && counts.eog <= 4 && counts.emgLeft === 0 && counts.emgRight === 0)) {
          await handlePatientConfirm(true);
          return;
        }
        if (ruleId === "no" || ((counts.together || 0) >= 1 || (counts.emgLeft >= 1 && counts.emgRight >= 1))) {
          await handlePatientConfirm(false);
          return;
        }
      }

      // 3. STRICT INVARIANT: YES and NO are handshake/confirmation gestures only.
      // Outside an active confirmation prompt, they must acknowledge without generating a dashboard request.
      const isYesSignal =
        ruleId === "yes" ||
        action === "YES" ||
        (counts.eog >= 3 && counts.eog <= 4 && counts.emgLeft === 0 && counts.emgRight === 0);
      const isNoSignal =
        ruleId === "no" ||
        action === "NO" ||
        ((counts.together || 0) >= 1 || (counts.emgLeft >= 1 && counts.emgRight >= 1 && counts.eog === 0));

      if (isYesSignal) {
        playChime("prompt");
        speak("YES acknowledged. There are no active prompts to confirm.");
        showNotice("YES acknowledged. Use this gesture when the attending nurse requests care confirmation.");
        return;
      }

      if (isNoSignal) {
        playChime("alert");
        speak("NO acknowledged. There are no active prompts to cancel.");
        showNotice("NO acknowledged. Use this gesture when indicating more assistance is required.");
        return;
      }

      const res = await apiClient.sendDeviceEvent({
        eventId: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        deviceId: devId,
        ruleId,
        gestureId: ruleId,
        action,
        label: action.replace(/_/g, " "),
        counts: {
          eog: counts.eog,
          emgLeft: counts.emgLeft,
          emgRight: counts.emgRight,
          together: counts.together ?? 0,
        },
        alarm: isAlarm,
        urgent: isUrgent,
      });

      playChime("success");
      speak("Your request has been sent to the nurse.");
      showNotice(`✓ ${action} dispatched to Nurse Dashboard.`);
      if (patient?.patientCode) {
        const reqRes = await apiClient.getCareRequests({ patientCode: patient.patientCode, limit: 50 });
        if (reqRes?.data) setRequests(reqRes.data);
      }
    } catch (err: unknown) {
      showNotice(err instanceof Error ? err.message : "Failed to trigger gesture", true);
    } finally {
      setActionInProgress(null);
    }
  }, [
    patient?.currentAssignment?.device?.deviceId,
    patient?.patientCode,
    activeRequest?.status, handlePatientConfirm,
    playChime,
    speak,
    setRequests,
  ]);

  // Real-time SSE subscription for bedside audio events and request transitions
  useEffect(() => {
    const code = patient?.patientCode;
    const devId = patient?.currentAssignment?.device?.deviceId;
    if (!code && !devId) return;

    const query = new URLSearchParams();
    if (devId) query.set("deviceId", devId);
    if (code) query.set("patientCode", code);

    const envApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
    let apiBase = envApi;
    if (typeof window !== "undefined") {
      try {
        const u = new URL(envApi, window.location.origin);
        if (
          (u.hostname === "localhost" || u.hostname === "127.0.0.1") &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1" &&
          window.location.hostname !== ""
        ) {
          u.hostname = window.location.hostname;
        }
        apiBase = u.toString().replace(/\/+$/, "");
      } catch {
        apiBase = envApi.replace(/\/+$/, "");
      }
    }

    const es = new EventSource(`${apiBase}/care-requests/bedside-audio-events?${query.toString()}`);

    es.onmessage = async (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === "REQUEST_DISPATCHED") {
          playChime("success");
          speak(payload.speechPrompt || "Your request has been sent to the nurse.");
          if (code) {
            const reqRes = await apiClient.getCareRequests({ patientCode: code, limit: 50 });
            if (reqRes?.data) setRequests(reqRes.data);
          }
        } else if (payload.type === "REQUEST_CANCELLED") {
          playChime("alert");
          speak(payload.speechPrompt || "Request cancelled.");
          if (code) {
            const reqRes = await apiClient.getCareRequests({ patientCode: code, limit: 50 });
            if (reqRes?.data) setRequests(reqRes.data);
          }
        } else if (payload.type === "PATIENT_CONFIRMATION_REQUESTED") {
          playChime("prompt");
          const prompt =
            payload.speechPrompt ||
            "Did you receive assistance? Blink 3 to 4 times for Yes, or squeeze both hands together for No.";
          speak(prompt);
          setRequests((prev) =>
            prev.map((r) =>
              !payload.requestId || r._id === payload.requestId
                ? { ...r, status: "AWAITING_CONFIRMATION", confirmation: "PENDING" }
                : r
            )
          );
          if (code) {
            apiClient.getCareRequests({ patientCode: code, limit: 50 }).then((reqRes) => {
              if (reqRes?.data) setRequests(reqRes.data);
            }).catch(() => {});
          }
        } else if (payload.type === "PATIENT_CONFIRMATION_RESULT") {
          playChime(payload.resolved ? "success" : "prompt");
          const prompt =
            payload.speechPrompt ||
            (payload.resolved
              ? "Thank you. Your assistance has been confirmed."
              : "Nurse alerted to follow up.");
          speak(prompt);
          if (code) {
            apiClient.getCareRequests({ patientCode: code, limit: 50 }).then((reqRes) => {
              if (reqRes?.data) setRequests(reqRes.data);
            }).catch(() => {});
          }
        } else if (payload.type === "EMERGENCY_ALARM") {
          playChime("alert");
          speak(payload.speechPrompt || "Emergency alert! Immediate assistance requested.");
          if (code) {
            apiClient.getCareRequests({ patientCode: code, limit: 50 }).then((reqRes) => {
              if (reqRes?.data) setRequests(reqRes.data);
            }).catch(() => {});
          }
        } else if (payload.type === "GESTURE_DETECTED") {
          const ruleIdLower = (payload.ruleId || "").toLowerCase();
          const isYes =
            ruleIdLower === "yes" ||
            (payload.counts && payload.counts.eog >= 3 && payload.counts.eog <= 4 && payload.counts.emgLeft === 0 && payload.counts.emgRight === 0);
          const isNo =
            ruleIdLower === "no" ||
            (payload.counts && ((payload.counts.together || 0) >= 1 || (payload.counts.emgLeft >= 1 && payload.counts.emgRight >= 1)));

          if (activeRequest?.status === "AWAITING_CONFIRMATION" || activeRequest?.status === "PENDING_PATIENT_CONFIRMATION") {
            if (isYes) handlePatientConfirm(true);
            else if (isNo) handlePatientConfirm(false);
          }
        }
      } catch {
        // silent
      }
    };

    return () => {
      es.close();
    };
  }, [patient?.patientCode, patient?.currentAssignment?.device?.deviceId, playChime, speak, activeRequest?.status, handlePatientConfirm, setRequests]);

  // Continuous Speech Recognition Engine for Bedside Voice Commands
  useEffect(() => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMicSupported(false);
      return;
    }

    if (!isMicActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-IN";

      recognition.onresult = (evt: any) => {
        const results = evt.results;
        if (!results || results.length === 0) return;
        const lastResult = results[results.length - 1];
        if (!lastResult || !lastResult[0]) return;
        const transcript = String(lastResult[0].transcript || "").trim();
        if (!transcript) return;

        const lower = transcript.toLowerCase();

        // 1. If nurse requested patient confirmation:
        if (activeRequest?.status === "AWAITING_CONFIRMATION" || activeRequest?.status === "PENDING_PATIENT_CONFIRMATION") {
          if (lower.includes("yes") || lower.includes("confirm") || lower.includes("received") || lower.includes("done") || lower.includes("assisted")) {
            handlePatientConfirm(true);
            return;
          }
          if (lower.includes("no") || lower.includes("not") || lower.includes("follow") || lower.includes("waiting")) {
            handlePatientConfirm(false);
            return;
          }
          return;
        }

        // 2. Otherwise: parse voice command (Water, Call Nurse, Adjustment, Emergency)
        const recognized = parseSpokenCommand(transcript);
        if (recognized) {
          const ruleId = recognized.ruleId;
          const isAlarm = Boolean(recognized.isEmergency);
          const counts = isAlarm
            ? { eog: 0, emgLeft: 3, emgRight: 3, together: 3 }
            : ruleId === "water"
            ? { eog: 5, emgLeft: 0, emgRight: 0, together: 0 }
            : ruleId === "call_nurse"
            ? { eog: 0, emgLeft: 3, emgRight: 0, together: 0 }
            : { eog: 0, emgLeft: 0, emgRight: 3, together: 0 };

          handleTriggerGesture(ruleId, recognized.action, counts, isAlarm, isAlarm || ruleId === "call_nurse");
        }
      };

      recognition.onerror = () => {
        // restart silently if still enabled
      };

      recognition.onend = () => {
        if (isMicActive) {
          try {
            recognition.start();
          } catch {}
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    } catch {
      setMicSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, [isMicActive, activeRequest?.status, handlePatientConfirm, handleTriggerGesture]);

  // Strict Assignment Gating Conditions
  const hasConfirmedBed = Boolean(
    patient?.bedLabel &&
    patient?.bedStatus !== "PENDING_APPROVAL" &&
    patient?.status !== "PENDING_BED_APPROVAL"
  );
  const assignedDevice = patient?.currentAssignment?.device;
  const hasActiveDevice = Boolean(assignedDevice && assignedDevice.status !== "DISABLED");
  const isCommandsEnabled = hasConfirmedBed && hasActiveDevice;
  const hasPendingBedProposal = Boolean(patient?.pendingBedLabel);
  const nurseReq = patient?.nurseAssignment;

  const displayedGestures: DisplayGesture[] = useMemo(() => {
    if (deviceRules && deviceRules.length > 0) {
      return deviceRules.map((rule) => {
        let urgency: "Standard" | "Urgent" | "Urgent, Alarm (RGB LEDs flash red)" = "Standard";
        if (rule.alarm) {
          urgency = "Urgent, Alarm (RGB LEDs flash red)";
        } else if (rule.urgent) {
          urgency = "Urgent";
        }
        const act =
          rule.id.toUpperCase() === "YES"
            ? "YES"
            : rule.id.toUpperCase() === "NO"
            ? "NO"
            : rule.alarm || rule.id === "emergency"
            ? "EMERGENCY"
            : rule.id === "water"
            ? "WATER"
            : rule.id === "call_nurse"
            ? "CALL_NURSE"
            : "REPOSITION";

        return {
          id: rule.id,
          gesture: describeGestureRule(rule),
          blinks: formatCount(rule.eog),
          left: formatCount(rule.emgLeft),
          right: formatCount(rule.emgRight),
          together: Boolean(rule.simultaneous),
          name: (rule.displayLabel?.trim() || rule.label || rule.id).toUpperCase(),
          action: act,
          urgency,
          counts: {
            eog: rule.eog[0],
            emgLeft: rule.emgLeft[0],
            emgRight: rule.emgRight[0],
            together: rule.simultaneous ? Math.max(rule.emgLeft[0], rule.emgRight[0]) : 0,
          },
        };
      });
    }

    return ALL_STANDARD_GESTURES;
  }, [deviceRules]);

  if (initialLoading) {
    return (
      <div className="min-h-screen glass-canvas flex items-center justify-center p-6 text-[#0B1E28] font-sans">
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl px-5 py-3 shadow-lg">
          <div className="w-4 h-4 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-800">Connecting to Patient Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen glass-canvas text-[#17191C] font-sans antialiased p-2 sm:p-4 lg:p-6 flex items-stretch justify-center">
      
      {/* FLOATING GLASS CONTAINER SHELL */}
      <div className="glass-shell rounded-[28px] lg:rounded-[36px] w-full flex flex-col overflow-hidden border border-white/80 shadow-2xl relative max-w-[1400px] mx-auto min-h-[92vh]">
        
        {/* TOP STATUS HEADER */}
        <header className="border-b border-black/5 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-5 sm:px-8 py-4 transition-colors">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            
            {/* Identity & Role Badge */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#081B26] text-cyan-400 font-heading font-extrabold text-sm flex items-center justify-center shadow-md border border-cyan-500/30 shrink-0">
                {patient?.bedLabel ? patient.bedLabel.slice(0, 3).toUpperCase() : "BED"}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-heading font-extrabold text-[#0B1E28] tracking-tight">
                    Bedside Terminal
                  </h1>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-950 border border-cyan-500/30 uppercase">
                    PATIENT
                  </span>
                  <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-black/5 text-[#0B1E28]">
                    {patient?.patientCode || "PT-ACTIVE"}
                  </span>
                </div>

                <div className="text-xs text-[#686D73] flex items-center gap-2 mt-1 flex-wrap">
                  <span>Patient: <strong className="text-[#0B1E28] font-semibold">{patient?.displayName || user?.name}</strong></span>
                  {user?.username && <span className="font-mono text-[#7E9EAE]">(@{user.username})</span>}
                  <span>&bull;</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${isCommandsEnabled ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
                    <span className={isCommandsEnabled ? "text-emerald-700 font-semibold" : "text-amber-700 font-semibold"}>
                      {isCommandsEnabled ? "Commands Operational" : "Commands Locked"}
                    </span>
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${nurseReq?.status === "APPROVED" ? "bg-cyan-500" : "bg-slate-400"}`} />
                    <span className={nurseReq?.status === "APPROVED" ? "text-cyan-800 font-semibold" : "text-slate-500"}>
                      {nurseReq?.status === "APPROVED" ? `Nurse: ${nurseReq.nurseName || "Linked"}` : "Nurse: Unlinked"}
                    </span>
                  </span>
                  <span>&bull;</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${hasActiveDevice ? "bg-cyan-500" : "bg-slate-400"}`} />
                    <span className={hasActiveDevice ? "text-cyan-800 font-semibold" : "text-slate-500"}>
                      {hasActiveDevice ? `Gateway: ${assignedDevice?.deviceId}` : "Gateway: Unassigned"}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Header Controls: Bedside Speaker Pill, Sync, Sign Out */}
            <div className="flex items-center gap-2.5 self-end sm:self-auto flex-wrap">
              {/* Audio & Voice Status / Unmute & Test Button */}
              <button
                type="button"
                onClick={() => {
                  getAudioContext();
                  setIsAudioUnlocked(true);
                  if (isVoiceMuted) {
                    setIsVoiceMuted(false);
                    showNotice("Voice announcements unmuted.");
                  } else {
                    playChime("prompt");
                    speak("NetraVaani audio operational.");
                    showNotice("Testing audio: chime & voice active.");
                  }
                }}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold shadow-xs transition active:scale-95 border ${
                  isVoiceMuted
                    ? "bg-rose-50 border-rose-300 text-rose-700 hover:bg-rose-100"
                    : isAudioUnlocked
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-950 hover:bg-emerald-500/25"
                    : "bg-cyan-500/15 border-cyan-500/30 text-cyan-950 hover:bg-cyan-500/25 animate-pulse"
                }`}
                title={isVoiceMuted ? "Audio muted. Click to unmute." : "Click to test bedside voice & audio"}
              >
                {isVoiceMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-600" />
                ) : (
                  <Volume2 className={`w-4 h-4 ${isAudioUnlocked ? "text-emerald-700" : "text-cyan-700"}`} />
                )}
                <span>
                  {isVoiceMuted
                    ? "Voice Muted"
                    : isAudioUnlocked
                    ? "Voice Active"
                    : "Enable Voice"}
                </span>
              </button>

              {/* Microphone Voice Command Toggle */}
              {micSupported && (
                <button
                  type="button"
                  onClick={() => {
                    getAudioContext();
                    setIsAudioUnlocked(true);
                    setIsMicActive((prev) => {
                      const next = !prev;
                      if (next) {
                        playChime("prompt");
                        speak("Listening for voice commands.");
                        showNotice("Microphone listening: speak Water, Call Nurse, or Emergency.");
                      } else {
                        showNotice("Microphone voice commands paused.");
                      }
                      return next;
                    });
                  }}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold shadow-xs transition active:scale-95 border ${
                    isMicActive
                      ? "bg-cyan-600 border-cyan-500 text-white shadow-cyan-600/20"
                      : "bg-white/80 border-black/5 text-[#0B1E28] hover:bg-white"
                  }`}
                  title={isMicActive ? "Voice commands active. Click to mute mic." : "Click to enable voice commands via microphone"}
                >
                  {isMicActive ? (
                    <Mic className="w-4 h-4 text-white animate-pulse" />
                  ) : (
                    <MicOff className="w-4 h-4 text-slate-500" />
                  )}
                  <span>{isMicActive ? "Mic: Listening" : "Voice Commands"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/80 hover:bg-white text-[#0B1E28] border border-black/5 shadow-xs transition active:scale-95"
                title="Refresh ledger"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-700" : ""}`} />
                <span className="hidden sm:inline">{isRefreshing ? "Syncing..." : "Sync"}</span>
              </button>

              {onClose ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="btn-pill-dark px-4 py-2 rounded-full text-xs font-semibold text-white bg-[#081B26] hover:bg-[#0E2A3A] transition flex items-center gap-1.5 shadow-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    if (typeof window !== "undefined") {
                      window.location.href = "/";
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-white/80 hover:bg-rose-50 text-rose-700 border border-black/5 shadow-xs transition active:scale-95"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign out</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Notice Alert Banner */}
        {notice && (
          <div className="px-5 sm:px-8 pt-4 w-full animate-in fade-in duration-150">
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold leading-relaxed border flex items-center justify-between shadow-md backdrop-blur-md ${
                notice.isError
                  ? "bg-rose-500/90 border-rose-400 text-white"
                  : "bg-[#081B26]/90 border-cyan-400/30 text-white"
              }`}
            >
              <span>{notice.text}</span>
              <button onClick={() => setNotice(null)} className="p-1 hover:opacity-75 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* MAIN BODY WORKSPACE */}
        <main className="flex-1 px-5 sm:px-8 py-6 w-full space-y-6 overflow-y-auto">

          {/* TOP ROW: 2 Operational Cards (Bed Allocation + NPG Gateway) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* SECTION 1: BED ALLOCATION & ASSIGNMENT */}
            <section className="card-white rounded-3xl p-6 sm:p-7 shadow-xl border border-cyan-500/10 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-[#081B26] text-white flex items-center justify-center shadow-xs">
                      <Bed className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-heading font-bold text-[#0B1E28]">
                        Bed Allocation &amp; Assignment
                      </h2>
                      <p className="text-xs text-[#686D73]">
                        Requires explicit patient confirmation before bed transfer
                      </p>
                    </div>
                  </div>

                  <div>
                    {hasConfirmedBed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-900 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Bed {patient?.bedLabel}</span>
                      </span>
                    ) : hasPendingBedProposal ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-900 border border-amber-500/30 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        <span>Awaiting Approval</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/5 text-[#686D73]">
                        <span>No Bed Assigned</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* CASE 1: UNIFIED Care Link & Bed Assignment Request */}
                {nurseReq?.status === "PENDING" && hasPendingBedProposal && (
                  <div className="mt-4 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 space-y-3">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-cyan-800 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h3 className="font-heading font-bold text-sm text-[#0B1E28] flex items-center gap-2">
                          <span>Care Link &amp; Bed Assignment Request</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-900 border border-amber-500/25">
                            APPROVAL REQUIRED
                          </span>
                        </h3>
                        <p className="text-xs text-[#686D73] leading-relaxed">
                          Nurse <strong className="text-[#0B1E28]">{nurseReq.nurseName || "Staff Nurse"}</strong> has requested to link with your bedside terminal at Bed <strong className="font-mono text-[#0B1E28] font-bold">{patient?.pendingBedLabel}</strong>.
                          {hasConfirmedBed
                            ? ` Approving will link this nurse and transfer you from ${patient?.bedLabel} to ${patient?.pendingBedLabel}.`
                            : " Explicit patient approval confirms both the nurse link and this bed allocation."}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={actionInProgress !== null}
                        onClick={handleApproveNurse}
                        className="btn-pill-dark px-4 py-2 rounded-full text-xs font-semibold bg-[#081B26] hover:bg-[#0E2A3A] text-white transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{actionInProgress === "approve_nurse" ? "Approving..." : `Approve Care Link & Bed ${patient?.pendingBedLabel}`}</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionInProgress !== null}
                        onClick={handleRejectNurse}
                        className="px-4 py-2 rounded-full text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition disabled:opacity-50"
                      >
                        {actionInProgress === "reject_nurse" ? "Declining..." : "Decline"}
                      </button>
                    </div>
                  </div>
                )}

                {/* CASE 2: STANDALONE Bed Proposal (Nurse already linked or no nurse attached) */}
                {hasPendingBedProposal && nurseReq?.status !== "PENDING" && (
                  <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h3 className="font-heading font-bold text-sm text-[#0B1E28]">
                          Proposed Bed: <span className="text-amber-800 font-mono text-base font-extrabold">{patient?.pendingBedLabel}</span>
                        </h3>
                        <p className="text-xs text-[#686D73] leading-relaxed">
                          Your nurse has proposed Bed <strong className="text-[#0B1E28]">{patient?.pendingBedLabel}</strong>.
                          {hasConfirmedBed
                            ? ` Approving will atomically transfer you from ${patient?.bedLabel} to ${patient?.pendingBedLabel}. Declining preserves your existing bed.`
                            : " Explicit patient approval confirms this bed and activates your bedside telemetry."}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={actionInProgress !== null}
                        onClick={handleApproveBed}
                        className="btn-pill-dark px-4 py-2 rounded-full text-xs font-semibold bg-[#081B26] hover:bg-[#0E2A3A] text-white transition flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>{actionInProgress === "approve_bed" ? "Approving..." : `Approve Bed ${patient?.pendingBedLabel}`}</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionInProgress !== null}
                        onClick={handleRejectBed}
                        className="px-4 py-2 rounded-full text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition disabled:opacity-50"
                      >
                        {actionInProgress === "reject_bed" ? "Declining..." : "Decline"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Confirmed Bed Details Summary */}
                {!hasPendingBedProposal && hasConfirmedBed && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-[#081B26]/[0.02] border border-black/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[#0B1E28]">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Current Confirmed Bed: <strong className="font-mono font-bold text-[#081B26]">{patient?.bedLabel}</strong></span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
                      OCCUPIED &bull; ACTIVE
                    </span>
                  </div>
                )}

                {/* CASE 3: STANDALONE Nurse Link Request (Bed already confirmed) */}
                {nurseReq?.status === "PENDING" && !hasPendingBedProposal && (
                  <div className="mt-4 p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 space-y-3">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-cyan-800 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h3 className="font-heading font-bold text-sm text-[#0B1E28] flex items-center gap-2">
                          <span>Care Link Request from Nurse: {nurseReq.nurseName || "Staff Nurse"}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-900 border border-amber-500/25">
                            APPROVAL REQUIRED
                          </span>
                        </h3>
                        <p className="text-xs text-[#686D73] leading-relaxed">
                          Nurse <strong>{nurseReq.nurseName}</strong> has dispatched a care link request for Bed <strong className="font-mono text-[#0B1E28]">{patient?.bedLabel || "Terminal"}</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="button"
                        disabled={actionInProgress !== null}
                        onClick={handleApproveNurse}
                        className="btn-pill-dark px-4 py-2 rounded-full text-xs font-semibold bg-[#081B26] hover:bg-[#0E2A3A] text-white transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{actionInProgress === "approve_nurse" ? "Approving..." : "Approve Care Link"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={actionInProgress !== null}
                        onClick={handleRejectNurse}
                        className="px-4 py-2 rounded-full text-xs font-semibold bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 transition disabled:opacity-50"
                      >
                        {actionInProgress === "reject_nurse" ? "Declining..." : "Decline"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Nurse Link Confirmed Banner */}
                {nurseReq?.status === "APPROVED" && (
                  <div className="mt-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <User className="w-4 h-4 text-emerald-700" />
                      <span className="text-[#0B1E28]">Attending Nurse: <strong className="font-bold text-emerald-900">{nurseReq.nurseName || "Assigned Nurse"}</strong> (Connected)</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-500/20 px-2.5 py-0.5 rounded-full">
                      LINKED
                    </span>
                  </div>
                )}
              </div>
            </section>

            {/* SECTION 2: ALLOCATED NPG DEVICE STATUS */}
            <section className="card-white rounded-3xl p-6 sm:p-7 shadow-xl border border-cyan-500/10 flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-center justify-between border-b border-black/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl bg-[#081B26] text-white flex items-center justify-center shadow-xs">
                      <Radio className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-heading font-bold text-[#0B1E28]">
                        NPG Device Allocation
                      </h2>
                      <p className="text-xs text-[#686D73]">
                        Strict 1-to-1 bedside hardware gateway assignment
                      </p>
                    </div>
                  </div>

                  <div>
                    {hasActiveDevice ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-900 border border-emerald-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>DEVICE ALLOCATED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-black/5 text-[#686D73]">
                        <span>NO DEVICE</span>
                      </span>
                    )}
                  </div>
                </div>

                {hasActiveDevice && assignedDevice ? (
                  <div className="mt-4 p-4 rounded-2xl bg-[#081B26] text-white border border-cyan-500/20 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                     <div className="text-sm font-heading font-bold flex items-center gap-2">
  <span className="text-white">
    {assignedDevice.name || assignedDevice.deviceId}
  </span> 
  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
</div>
                      <div className="text-xs text-[#7E9EAE] mt-1 font-mono">
                        ID: {assignedDevice.deviceId} &bull; Status: <span className="text-emerald-400 font-semibold">{assignedDevice.status}</span> &bull; Telemetry: <span className="text-white font-semibold">{assignedDevice.connectivityStatus || "ONLINE"}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {assignedDevice.batteryLevel !== undefined && assignedDevice.batteryLevel !== null && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-white/10 text-cyan-300 border border-white/10">
                          Battery: {assignedDevice.batteryLevel}%
                        </span>
                      )}
                      <span className="px-3 py-1 rounded-full bg-cyan-500 text-[#081B26] font-bold text-[10px]">
                        OPERATIONAL
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-900 space-y-1">
                    <div className="font-heading font-bold flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700" />
                      <span>No NPG Gateway Assigned Yet</span>
                    </div>
                    <p className="text-xs leading-relaxed text-[#686D73]">
                      Bedside gaze &amp; gesture triggers require an active NPG hardware device. Please request your attending nurse to allocate an online gateway to your bedside.
                    </p>
                  </div>
                )}
              </div>
            </section>

          </div>

          {/* SECTION 3: BEDSIDE GAZE & GESTURE COMMANDS */}
          <div className="space-y-6">

            

            {/* BEDSIDE GAZE & GESTURE COMMANDS (Strictly In Image) */}
            <section className="card-white rounded-3xl p-6 sm:p-7 shadow-xl border border-cyan-500/10 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base sm:text-lg font-heading font-bold text-[#0B1E28] tracking-tight">
                      Bedside Gaze &amp; Gesture Commands
                    </h2>
                    <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-cyan-500/15 text-cyan-950 border border-cyan-500/30">
                      {displayedGestures.length} Total Gestures
                    </span>
                  </div>
                  <p className="text-xs text-[#686D73] mt-0.5">
                    Exact calibrated triggers: YES, NO, WATER, CALL NURSE, ADJUSTMENT, EMERGENCY
                  </p>
                </div>

                <div>
                  {isCommandsEnabled ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-900 border border-emerald-500/30 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Commands Active &bull; Live Telemetry</span>
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-black/5 text-[#686D73] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Commands Locked (Preview Mode)</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Prerequisite status notice if commands are locked */}
              {!isCommandsEnabled && (
                <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1E28]">
                    <Lock className="w-4 h-4 text-slate-500" />
                    <span>Commands Activation Prerequisites (Reference Mode)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className={`p-3 rounded-2xl border ${hasConfirmedBed ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-900" : "bg-white border-black/5 text-[#686D73]"}`}>
                      <div className="font-semibold flex items-center gap-1.5">
                        {hasConfirmedBed ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-rose-600" />}
                        <span>1. Hospital Bed Confirmation</span>
                      </div>
                      <div className="text-[11px] mt-0.5 text-[#686D73]">
                        {hasConfirmedBed ? `Confirmed on Bed ${patient?.bedLabel}` : "Requires approved bed assignment by nurse"}
                      </div>
                    </div>

                    <div className={`p-3 rounded-2xl border ${hasActiveDevice ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-900" : "bg-white border-black/5 text-[#686D73]"}`}>
                      <div className="font-semibold flex items-center gap-1.5">
                        {hasActiveDevice ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <X className="w-3.5 h-3.5 text-rose-600" />}
                        <span>2. NPG Hardware Gateway Link</span>
                      </div>
                      <div className="text-[11px] mt-0.5 text-[#686D73]">
                        {hasActiveDevice ? `Linked to ${assignedDevice?.name || assignedDevice?.deviceId}` : "Nurse must allocate an online NPG device"}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 6 COMMANDS STRICT TABLE FROM IMAGE */}
              <div className="overflow-x-auto rounded-2xl border border-black/5 bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-black/5 bg-[#081B26]/[0.02] text-[#686D73] font-semibold">
                      <th className="py-3 px-3.5 font-bold text-[#0B1E28]">Command</th>
                      <th className="py-3 px-3.5 text-center">Blinks</th>
                      <th className="py-3 px-3.5 text-center">Left</th>
                      <th className="py-3 px-3.5 text-center">Right</th>
                      <th className="py-3 px-3.5 text-center">Together</th>
                      <th className="py-3 px-3.5 font-medium">Gesture Description</th>
                     
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5 text-[#0B1E28]">
                    {displayedGestures.map((item) => {
                      const isAlarm = item.urgency.includes("Alarm");
                      return (
                        <tr
                          key={item.id}
                          className={`transition hover:bg-black/[0.02] ${
                            isAlarm ? "bg-rose-500/5" : ""
                          }`}
                        >
                          <td className="py-3 px-3.5 font-heading font-extrabold text-sm tracking-wide text-[#0B1E28]">
                            <div className="flex items-center gap-2">
                              <span>{item.name}</span>
                              {isAlarm && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-rose-600 text-white animate-pulse">
                                  ALARM
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3.5 font-mono font-bold text-center text-cyan-800">
                            {item.blinks}
                          </td>
                          <td className="py-3 px-3.5 font-mono font-bold text-center">
                            {item.left}
                          </td>
                          <td className="py-3 px-3.5 font-mono font-bold text-center">
                            {item.right}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            {item.together ? (
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">yes</span>
                            ) : (
                              <span className="text-[#92979D] font-mono">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-[#52575C] font-medium">
                            {item.gesture}
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[#686D73] pt-1">
                <span>Every gesture must be completed within 5 seconds.</span>
                <span className="font-mono">Channel map: Blinks (CH3) &bull; Left Squeezes (CH1) &bull; Right Squeezes (CH2)</span>
              </div>
            </section>
          </div>

          {/* SECTION 4: MY CARE REQUEST LEDGER */}
          <section className="card-white rounded-3xl p-6 sm:p-7 shadow-xl border border-cyan-500/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/5 pb-4">
              <div>
                <h2 className="text-base sm:text-lg font-heading font-bold text-[#0B1E28] tracking-tight">
                  Single Active Communication &amp; Care Request Ledger
                </h2>
                <p className="text-xs text-[#686D73]">
                  One patient can have only one active request at a time until completed by your nurse
                </p>
              </div>
            </div>

            <>{/* UNIFIED SINGLE ACTIVE REQUEST CARD */}
                {activeRequest ? (
                  <div
                    className={`p-5 rounded-3xl border shadow-lg space-y-3.5 transition-all ${
                      activeRequest.status === "AWAITING_CONFIRMATION" || activeRequest.status === "PENDING_PATIENT_CONFIRMATION"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-950"
                        : activeRequest.status === "CONFIRMED"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-950"
                        : activeRequest.status === "FOLLOW_UP_REQUIRED"
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-950"
                        : activeRequest.status === "IN_PROGRESS"
                        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-950"
                        : "bg-[#081B26]/5 border-cyan-500/20 text-[#0B1E28]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-3 h-3 rounded-full shrink-0 ${
                            activeRequest.alarm
                              ? "bg-rose-600 animate-ping"
                              : activeRequest.status === "AWAITING_CONFIRMATION" || activeRequest.status === "PENDING_PATIENT_CONFIRMATION"
                              ? "bg-amber-500 animate-pulse"
                              : activeRequest.status === "CONFIRMED"
                              ? "bg-emerald-500"
                              : activeRequest.status === "IN_PROGRESS"
                              ? "bg-cyan-500 animate-pulse"
                              : "bg-teal-500"
                          }`}
                        />
                        <h3 className="font-heading font-extrabold text-base tracking-tight">
                          ACTIVE CALL: {activeRequest.displayLabel || activeRequest.label || activeRequest.action.replace(/_/g, " ")}
                        </h3>
                      </div>
                      <span className="font-mono text-xs font-bold px-3 py-1 rounded-full uppercase bg-white/80 border border-black/5">
                        {activeRequest.status === "AWAITING_CONFIRMATION" || activeRequest.status === "PENDING_PATIENT_CONFIRMATION"
                          ? "AWAITING PATIENT VERIFICATION"
                          : activeRequest.status === "CONFIRMED"
                          ? "CONFIRMED • AWAITING NURSE CLOSE"
                          : activeRequest.status === "FOLLOW_UP_REQUIRED"
                          ? "FOLLOW-UP REQUESTED"
                          : activeRequest.status === "IN_PROGRESS"
                          ? "NURSE ATTENDING"
                          : "SENT • WAITING FOR NURSE"}
                      </span>
                    </div>

                    {/* Status description */}
                    <div className="text-xs text-[#52575C] leading-relaxed">
                      {activeRequest.status === "AWAITING_CONFIRMATION" || activeRequest.status === "PENDING_PATIENT_CONFIRMATION" ? (
                        <div className="space-y-3">
                          <p className="font-semibold text-sm text-[#0B1E28]">
                            Did you receive assistance? Confirm with gestures or tap below:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                            <button
                              type="button"
                              disabled={actionInProgress !== null}
                              onClick={() => handlePatientConfirm(true)}
                              className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-98 disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                              <span>YES • 3–4 Blinks (Care Received)</span>
                            </button>
                            <button
                              type="button"
                              disabled={actionInProgress !== null}
                              onClick={() => handlePatientConfirm(false)}
                              className="py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-98 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                              <span>NO • Both Hands Squeeze (Need Follow-Up)</span>
                            </button>
                          </div>
                        </div>
                      ) : activeRequest.status === "CONFIRMED" ? (
                        <p className="text-emerald-800 font-semibold">
                          You confirmed assistance was received. Waiting for nurse to complete and resolve the call. Next request will unlock automatically once completed.
                        </p>
                      ) : activeRequest.status === "FOLLOW_UP_REQUIRED" ? (
                        <p className="text-rose-800 font-semibold">
                          You reported assistance was not received. Nurse station has been alerted to follow up immediately.
                        </p>
                      ) : activeRequest.status === "IN_PROGRESS" ? (
                        <p className="text-cyan-900 font-semibold">
                          Your nurse has acknowledged your request and is currently attending to you.
                        </p>
                      ) : (
                        <p className="text-[#686D73]">
                          Your request was transmitted to the nurse dashboard. Attending nurse will respond shortly.
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between text-emerald-900 font-semibold">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>All care requests are resolved. Terminal is ready for your next gaze or gesture.</span>
                    </div>
                    <span className="font-mono text-[10px] uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-950">
                      READY
                    </span>
                  </div>
                )}

                <div className="divide-y divide-black/5 max-h-[400px] overflow-y-auto pr-1">
                  {requests.length === 0 ? (
                    <div className="py-10 text-center text-xs text-[#8E9298]">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                      No care calls recorded yet. Commands triggered via your bedside gateway will appear here in real-time.
                    </div>
                  ) : (
                    requests.map((req) => (
                      <div key={req._id} className="py-3.5 flex items-center justify-between gap-3 text-xs hover:bg-black/[0.01] px-2 rounded-2xl transition">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              req.alarm
                                ? "bg-rose-500 animate-ping"
                                : req.status === "RESOLVED"
                                ? "bg-emerald-500"
                                : req.status === "IN_PROGRESS"
                                ? "bg-cyan-500"
                                : req.status === "ACKNOWLEDGED"
                                ? "bg-amber-500"
                                : "bg-rose-500 animate-pulse"
                            }`}
                          />
                          <div>
                            <div className="font-heading font-bold text-sm text-[#0B1E28]">
                              {req.displayLabel || req.label || req.action.replace(/_/g, " ")}
                            </div>
                            <div className="text-[11px] text-[#686D73] font-mono mt-0.5">
                              {new Date(req.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "medium" })} &bull; Gateway: {req.device?.name || req.device?.deviceId || "Gateway"}
                            </div>
                            {req.patientDisputedAt && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-rose-700 font-semibold">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                <span>You reported care was NOT received — Nurse re-alerted</span>
                              </div>
                            )}
                            {req.confirmationNote && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold font-mono">
                                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>{req.confirmationNote}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                            req.alarm
                              ? "bg-rose-600 text-white"
                              : req.status === "RESOLVED"
                              ? "bg-emerald-500/15 text-emerald-900 border border-emerald-500/30"
                              : req.status === "IN_PROGRESS"
                              ? req.patientDisputedAt
                                ? "bg-rose-500/15 text-rose-900 border border-rose-500/30 animate-pulse"
                                : "bg-cyan-500/15 text-cyan-900 border border-cyan-500/30"
                              : req.status === "ACKNOWLEDGED"
                              ? "bg-amber-500/15 text-amber-900 border border-amber-500/30"
                              : "bg-rose-500/15 text-rose-900 border border-rose-500/30"
                          }`}
                        >
                          {req.status === "IN_PROGRESS" && req.patientDisputedAt ? "DISPUTED / REJECTED" : req.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
          </section>

        </main>
      </div>
    </div>
  );
}
