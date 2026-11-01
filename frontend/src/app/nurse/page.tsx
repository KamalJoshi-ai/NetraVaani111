"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  apiClient,
  BedItem,
  CareRequestItem,
  CareRequestStatus,
  DeviceItem,
  PatientItem,
} from "@/lib/api";
import {
  Radio,
  Bed,
  CheckCircle2,
  AlertTriangle,
  User,
  X,
  Link2,
  Lock,
} from "@/lib/noIcons";
import { useAuth } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import BleCommissioningModal from "@/components/BleCommissioningModal";
import CommandRuleEditor from "@/components/commands/CommandRuleEditor";
import ChordsSignalVisualizerModal from "@/components/ChordsSignalVisualizerModal";
import { useVoiceAlerts } from "@/lib/speech";

// Modular Dashboard Components
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { EmergencyAlertDeck } from "@/components/dashboard/EmergencyAlertDeck";
import { OverviewView } from "@/components/dashboard/OverviewView";
import { LiveCallsView } from "@/components/dashboard/LiveCallsView";
import { PatientRegistryView } from "@/components/dashboard/PatientRegistryView";
import { HardwareGatewaysView } from "@/components/dashboard/HardwareGatewaysView";
import { StepConfirmModal, StepConfirmData } from "@/components/dashboard/StepConfirmModal";

export default function NurseDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [requests, setRequests] = useState<CareRequestItem[]>([]);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [patients, setPatients] = useState<PatientItem[]>([]);
  const [beds, setBeds] = useState<BedItem[]>([]);
  const [, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "calls" | "patients" | "devices">("overview");
  const [filter, setFilter] = useState<"ALL" | CareRequestStatus>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCallsPatientKey, setSelectedCallsPatientKey] = useState<string | null>(null);
  const [isBleModalOpen, setIsBleModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const voice = useVoiceAlerts(requests);

  // Device Allocation state (Strict 1-to-1 without manual entry or silent switch)
  const [allocateModalPatient, setAllocateModalPatient] = useState<PatientItem | null>(null);
  const [selectedAllocateDeviceId, setSelectedAllocateDeviceId] = useState<string>("");
  const [allocatingDevice, setAllocatingDevice] = useState(false);
  const [deviceDeallocatingMap, setDeviceDeallocatingMap] = useState<Record<string, boolean>>({});
  const [editingDeviceCommands, setEditingDeviceCommands] = useState<DeviceItem | null>(null);
  const [allocatingDeviceFromList, setAllocatingDeviceFromList] = useState<DeviceItem | null>(null);
  const [selectedPatientForDevice, setSelectedPatientForDevice] = useState<string>("");
  const [allocatingPatientToDeviceLoading, setAllocatingPatientToDeviceLoading] = useState(false);

  // Add Patient Modal State (Nurse-controlled registration requiring available bed)
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientBedNumber, setNewPatientBedNumber] = useState("");
  const [creatingPatient, setCreatingPatient] = useState(false);

  // Propose Bed Change Modal State
  const [isBedChangeModalOpen, setIsBedChangeModalOpen] = useState(false);
  const [bedChangePatient, setBedChangePatient] = useState<PatientItem | null>(null);
  const [selectedNewBedNumber, setSelectedNewBedNumber] = useState("");
  const [proposingBed, setProposingBed] = useState(false);

  // Care Link Request Modal State (Enter Bed Number + Patient-only Approval)
  const [careLinkModalPatient, setCareLinkModalPatient] = useState<PatientItem | null>(null);
  const [careLinkBedNumber, setCareLinkBedNumber] = useState("");

  // Chords Live Signal Visualizer State (Upside Down Labs integration)
  const [isChordsModalOpen, setIsChordsModalOpen] = useState(false);
  const [chordsInitialDeviceId, setChordsInitialDeviceId] = useState<string>("");
  const [chordsInitialPatientCode, setChordsInitialPatientCode] = useState<string>("");

  const handleOpenChordsVisualizer = (deviceId?: string, patientCode?: string) => {
    setChordsInitialDeviceId(deviceId || "");
    setChordsInitialPatientCode(patientCode || "");
    setIsChordsModalOpen(true);
  };

  // In-place confirmation dialog state
  const [stepConfirm, setStepConfirm] = useState<StepConfirmData | null>(null);
  const [nurseAssignLoading, setNurseAssignLoading] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);

  // Show toast notification
  const showToast = useCallback((msg: string, isError = false) => {
    setToastMessage(msg);
    setToastIsError(isError);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Fetch Care Requests
  const fetchRequests = useCallback(async (showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    try {
      const res = await apiClient.getCareRequests({ limit: 100 });
      if (res?.data) {
        // STRICT INVARIANT: Ensure YES and NO control gestures never appear in requests
        const filtered = res.data.filter(
          (r: CareRequestItem) =>
            r.action !== "YES" &&
            r.action !== "NO" &&
            r.ruleId?.toLowerCase() !== "yes" &&
            r.ruleId?.toLowerCase() !== "no" &&
            r.ruleId?.toLowerCase() !== "c07" &&
            r.ruleId?.toLowerCase() !== "c05"
        );
        setRequests(filtered);
        console.log(`[NURSE_DASHBOARD] State updated. Loaded ${filtered.length} requests from backend.`);
      }
    } catch (err: unknown) {
      console.error("Failed to load care requests:", err);
    } finally {
      if (showIndicator) setRefreshing(false);
    }
  }, []);

  // Fetch Patients, Devices, Beds
  const fetchAuxData = useCallback(async () => {
    try {
      const [ptsRes, devsRes, bedsRes] = await Promise.allSettled([
        apiClient.getPatients({ limit: 100 }),
        apiClient.getDevices({ limit: 100 }),
        apiClient.listBeds(),
      ]);

      if (ptsRes.status === "fulfilled" && ptsRes.value?.data) {
        setPatients(ptsRes.value.data);
      }
      if (devsRes.status === "fulfilled" && devsRes.value?.data) {
        setDevices(devsRes.value.data);
      }
      if (bedsRes.status === "fulfilled" && bedsRes.value?.data) {
        setBeds(bedsRes.value.data);
      }
    } catch (err) {
      console.error("Failed to fetch clinical state:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Real-time Event Subscription (SSE Stream) + Resilient Polling
  useEffect(() => {
    fetchRequests(false);
    fetchAuxData();

    // 1. Polling interval fallback (3.5s)
    const interval = setInterval(() => {
      fetchRequests(false);
      fetchAuxData();
    }, 3500);

    // 2. Real-time Server-Sent Events stream for zero-latency dashboard delivery
    let eventSource: EventSource | null = null;
    if (typeof window !== "undefined") {
      try {
        const envApi = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
        const url = new URL(envApi, window.location.origin);
        if (
          (url.hostname === "localhost" || url.hostname === "127.0.0.1") &&
          window.location.hostname !== "localhost" &&
          window.location.hostname !== "127.0.0.1" &&
          window.location.hostname !== ""
        ) {
          url.hostname = window.location.hostname;
        }
        const sseUrl = `${url.toString().replace(/\/+$/, "")}/care-requests/bedside-audio-events`;
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          console.log("[NURSE_DASHBOARD] Real-time event stream connected (SSE established).");
        };

        eventSource.onmessage = (e) => {
          try {
            if (!e.data || e.data.startsWith(":")) return;
            const event = JSON.parse(e.data);
            if (
              event.type === "REQUEST_DISPATCHED" ||
              event.type === "PATIENT_CONFIRMATION_RESULT" ||
              event.type === "DISPATCH_CONFIRMATION_REQUESTED" ||
              event.type === "REQUEST_CANCELLED"
            ) {
              console.log(`[NURSE_DASHBOARD] Event received: ${event.type} (Request: ${event.requestId || "n/a"}). Refreshing care requests...`);
              fetchRequests(false);
            }
          } catch {
            // ignore
          }
        };

        eventSource.onerror = (err) => {
          console.warn("[NURSE_DASHBOARD] SSE stream notice (polling active as fallback):", err);
        };
      } catch (err) {
        console.warn("[NURSE_DASHBOARD] Could not initialize SSE stream:", err);
      }
    }

    return () => {
      clearInterval(interval);
      if (eventSource) eventSource.close();
    };
  }, [fetchRequests, fetchAuxData]);

  // Available beds for registration and bed change
  const availableBeds = useMemo(() => {
    return beds.filter((b) => b.status === "AVAILABLE");
  }, [beds]);

  // Open modal targeting patient to allocate an available device
  const handleOpenAllocateToPatient = (patient: PatientItem) => {
    if (patient.currentAssignment?.device) {
      showToast(
        `Patient ${patient.displayName} already has device ${patient.currentAssignment.device.deviceId} allocated. Unassign current device first.`,
        true
      );
      return;
    }
    setAllocateModalPatient(patient);
    const availableOnlineDevice = devices.find(
      (d) =>
        d.status === "AVAILABLE" &&
        !d.currentAssignment &&
        d.connectivityStatus === "ONLINE"
    );
    setSelectedAllocateDeviceId(availableOnlineDevice?.deviceId || "");
  };

  const handleCloseAllocateModal = () => {
    setAllocateModalPatient(null);
    setSelectedAllocateDeviceId("");
  };

  // Submit device allocation
  const handleConfirmAllocateDevice = async () => {
    if (!allocateModalPatient || !selectedAllocateDeviceId) {
      showToast("Please select an available online device.", true);
      return;
    }
    const targetDev = devices.find(
      (d) => d.deviceId.toLowerCase() === selectedAllocateDeviceId.toLowerCase()
    );
    if (!targetDev) {
      showToast("Selected device not found in registry.", true);
      return;
    }
    if (targetDev.status === "ASSIGNED" || targetDev.currentAssignment) {
      showToast("Device is already assigned to another patient.", true);
      return;
    }
    if (targetDev.connectivityStatus !== "ONLINE") {
      showToast("Device is offline. Gateway must be online before allocation.", true);
      return;
    }

    setAllocatingDevice(true);
    try {
      await apiClient.allocateDeviceToPatient(
        allocateModalPatient.patientCode,
        targetDev.deviceId,
        user?.name || user?.email || "Staff Nurse"
      );
      showToast(`Device ${targetDev.deviceId} allocated to ${allocateModalPatient.displayName} successfully!`);
      handleCloseAllocateModal();
      await fetchAuxData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to assign device", true);
    } finally {
      setAllocatingDevice(false);
    }
  };

  // Submit device-first allocation from Devices tab
  const handleConfirmAllocatePatientToDevice = async () => {
    if (!allocatingDeviceFromList || !selectedPatientForDevice) {
      showToast("Please select a patient to allocate this device to.", true);
      return;
    }
    const targetPatient = patients.find(
      (p) => p.patientCode.toLowerCase() === selectedPatientForDevice.toLowerCase()
    );
    if (!targetPatient) {
      showToast("Selected patient not found.", true);
      return;
    }

    setAllocatingPatientToDeviceLoading(true);
    try {
      await apiClient.allocateDeviceToPatient(
        targetPatient.patientCode,
        allocatingDeviceFromList.deviceId,
        user?.name || user?.email || "Staff Nurse"
      );
      showToast(`Device ${allocatingDeviceFromList.name || allocatingDeviceFromList.deviceId} allocated to ${targetPatient.displayName} successfully!`);
      setAllocatingDeviceFromList(null);
      setSelectedPatientForDevice("");
      await fetchAuxData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to assign device", true);
    } finally {
      setAllocatingPatientToDeviceLoading(false);
    }
  };

  // Deallocate device
  const handleDeallocateDevice = async (deviceId: string, patientNameOrCode?: string) => {
    setDeviceDeallocatingMap((prev) => ({ ...prev, [deviceId]: true }));
    try {
      await apiClient.unassignDevice(deviceId);
      showToast(`Device ${deviceId} unassigned from ${patientNameOrCode || "patient"} successfully.`);
      setPatients((prev) =>
        prev.map((p) =>
          p.currentAssignment?.device?.deviceId === deviceId
            ? { ...p, currentAssignment: null }
            : p
        )
      );
      setDevices((prev) =>
        prev.map((d) =>
          d.deviceId === deviceId
            ? { ...d, status: "AVAILABLE", currentAssignment: null }
            : d
        )
      );
      await fetchAuxData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to unassign device", true);
    } finally {
      setDeviceDeallocatingMap((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  // Initiate Patient Registration with Selected Bed
  const handleInitiatePatientRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim()) {
      showToast("Please enter patient full name.", true);
      return;
    }
    if (!newPatientBedNumber.trim()) {
      showToast("Please select an available hospital bed.", true);
      return;
    }

    setCreatingPatient(true);
    try {
      const res = await apiClient.initiatePatientWithBed({
        displayName: newPatientName.trim(),
        bedNumber: newPatientBedNumber.trim(),
      });
      if (res?.data) {
        showToast(
          `Registration initiated for ${res.data.patient.displayName}! Bed ${newPatientBedNumber} marked pending patient approval.`
        );
      }
      setIsAddPatientModalOpen(false);
      setNewPatientName("");
      setNewPatientBedNumber("");
      await fetchAuxData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to initiate patient registration", true);
    } finally {
      setCreatingPatient(false);
    }
  };

  // Open Bed Change Modal
  const handleOpenBedChangeModal = (pt: PatientItem) => {
    setBedChangePatient(pt);
    setSelectedNewBedNumber("");
    setIsBedChangeModalOpen(true);
  };

  // Submit Bed Change Proposal
  const handleConfirmProposeBedChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedChangePatient || !selectedNewBedNumber) {
      showToast("Please select a new available bed to propose.", true);
      return;
    }
    setProposingBed(true);
    try {
      await apiClient.proposeBedChange(bedChangePatient.patientCode, selectedNewBedNumber);
      showToast(
        `Proposed Bed ${selectedNewBedNumber} for ${bedChangePatient.displayName}. Existing bed retained until patient approves.`
      );
      setIsBedChangeModalOpen(false);
      setBedChangePatient(null);
      setSelectedNewBedNumber("");
      await fetchAuxData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to propose bed change", true);
    } finally {
      setProposingBed(false);
    }
  };

  // Open Care Link Request Modal so nurse can enter/verify bed number
  const handleOpenCareLinkModal = (pt: PatientItem) => {
    setCareLinkModalPatient(pt);
    setCareLinkBedNumber(pt.pendingBedLabel || pt.bedLabel || "");
  };

  // Submit Care Link Request with entered bed number (Only patient can approve)
  const handleConfirmSendCareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!careLinkModalPatient || !careLinkBedNumber.trim()) {
      showToast("Please enter a valid bed number", true);
      return;
    }
    const ptCode = careLinkModalPatient.patientCode;
    const bed = careLinkBedNumber.trim().toUpperCase();
    setNurseAssignLoading((prev) => ({ ...prev, [ptCode]: true }));
    try {
      await apiClient.requestNurseAssignment(ptCode, {
        nurseName: user?.name || "Staff Nurse",
        nurseId: user?.id,
        nurseRole: user?.role || "NURSE",
        bedNumber: bed,
      });
      showToast(`Care link request for Bed ${bed} dispatched to ${careLinkModalPatient.displayName}.`);
      setCareLinkModalPatient(null);
      fetchAuxData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to send care link request", true);
    } finally {
      setNurseAssignLoading((prev) => ({ ...prev, [ptCode]: false }));
    }
  };

  const handleDeallocatePatient = async (patientCode: string) => {
    setNurseAssignLoading((prev) => ({ ...prev, [patientCode]: true }));
    try {
      await apiClient.deallocateNurse(patientCode);
      showToast(`Patient ${patientCode} unlinked successfully.`);
      setPatients((prev) =>
        prev.map((p) =>
          p.patientCode === patientCode
            ? {
                ...p,
                nurseAssignment: {
                  status: "NONE",
                  nurseId: undefined,
                  nurseName: undefined,
                  nurseRole: undefined,
                  requestedAt: undefined,
                  approvedAt: undefined,
                  rejectedAt: undefined,
                },
              }
            : p
        )
      );
      await fetchAuxData();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Failed to unlink patient", true);
    } finally {
      setNurseAssignLoading((prev) => ({ ...prev, [patientCode]: false }));
    }
  };

  // Step advancement confirmation
  const promptStepConfirmation = (
    req: CareRequestItem,
    nextStep: "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "REQUEST_CONFIRMATION"
  ) => {
    const pName = req.patient?.displayName || req.patient?.patientCode || "Patient";
    const pBed = req.patient?.bedLabel || "Bed";
    const act = req.displayLabel || req.label || req.action.replace(/_/g, " ");

    if (req.status === "CONFIRMED") {
      setStepConfirm({
        request: req,
        nextStep: "RESOLVED",
        isResolutionStep: false,
        stepTitle: "Complete Request",
        stepDescription: `Patient ${pName} confirmed care received (YES). Complete this request to close the call and release the bedside lock.`,
        actionButtonLabel: "Complete & Close Call",
        actionButtonColor: "bg-emerald-600 hover:bg-emerald-700",
      });
      return;
    }

    if (req.status === "FOLLOW_UP_REQUIRED") {
      setStepConfirm({
        request: req,
        nextStep: "IN_PROGRESS",
        stepTitle: "Follow-Up on Care Call",
        stepDescription: `Patient ${pName} reported care was NOT received. Follow up with the patient and provide assistance.`,
        actionButtonLabel: "Resume Handling",
        actionButtonColor: "bg-rose-600 hover:bg-rose-700",
      });
      return;
    }

    if (nextStep === "ACKNOWLEDGED") {
      setStepConfirm({
        request: req,
        nextStep: "ACKNOWLEDGED",
        stepTitle: "Acknowledge Care Request",
        stepDescription: `Acknowledge ${act} call from ${pName} on ${pBed}?`,
        actionButtonLabel: "Confirm Acknowledge",
        actionButtonColor: "bg-amber-600 hover:bg-amber-700",
      });
    } else if (nextStep === "IN_PROGRESS") {
      setStepConfirm({
        request: req,
        nextStep: "IN_PROGRESS",
        stepTitle: "Start Handling Request",
        stepDescription: `Are you en route or currently assisting ${pName} on ${pBed}?`,
        actionButtonLabel: "Start Handling",
        actionButtonColor: "bg-teal-700 hover:bg-teal-800",
      });
    } else if (nextStep === "RESOLVED") {
      setStepConfirm({
        request: req,
        nextStep: "RESOLVED",
        isResolutionStep: true,
        stepTitle: "Resolve & Request Patient Confirmation",
        stepDescription: `Assistance for ${act} has been provided to ${pName} on ${pBed}. Ask patient to confirm resolution via bedside audio, or resolve immediately via nurse override.`,
        actionButtonLabel: "Ask Patient to Confirm (Bedside Audio)",
        actionButtonColor: "bg-teal-700 hover:bg-teal-800",
      });
    }
  };

  const executeStepConfirmation = async (overrideDirectResolve?: boolean) => {
    if (!stepConfirm) return;
    const { request, nextStep, isResolutionStep } = stepConfirm;
    setStepConfirm(null);
    try {
      if (isResolutionStep) {
        if (overrideDirectResolve) {
          await apiClient.resolveCareRequest(request._id, "NURSE_OVERRIDE");
          showToast("Request resolved via nurse override.");
        } else {
          await apiClient.requestPatientConfirmation(request._id);
          showToast("Patient confirmation requested on bedside speaker.");
        }
      } else if (nextStep === "ACKNOWLEDGED") {
        await apiClient.acknowledgeCareRequest(request._id);
        showToast("Request acknowledged.");
      } else if (nextStep === "IN_PROGRESS") {
        await apiClient.startHandlingCareRequest(request._id);
        showToast("Request marked In Progress.");
      } else if (nextStep === "RESOLVED") {
        await apiClient.resolveCareRequest(request._id, "NURSE_OVERRIDE");
        showToast("Request resolved and closed.");
      }
      await fetchRequests(false);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Action failed", true);
    }
  };

  // Open calls count excluding cancelled, pending dispatch, and confirmation gestures
  const openCallsCount = useMemo(() => {
    return requests.filter((r) => {
      return (
        r.status !== "RESOLVED" &&
        r.status !== "CANCELLED" &&
        r.status !== "PENDING_DISPATCH_CONFIRMATION" &&
        r.action !== "YES" &&
        r.action !== "NO" &&
        r.ruleId?.toLowerCase() !== "yes" &&
        r.ruleId?.toLowerCase() !== "no"
      );
    }).length;
  }, [requests]);

  const emergencyCalls = useMemo(() => {
    return requests.filter(
      (r) =>
        Boolean(r.alarm) &&
        r.status !== "RESOLVED" &&
        r.action !== "YES" &&
        r.action !== "NO"
    );
  }, [requests]);

  const onlineDevicesCount = devices.filter((d) => d.connectivityStatus === "ONLINE").length;

  // Redirect patient away from nurse station
  useEffect(() => {
    if (!authLoading && user && user.role === "patient") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen glass-canvas flex items-center justify-center p-6 text-[#17191C] font-sans">
        <div className="flex items-center gap-3 bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl px-5 py-3 shadow-lg">
          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-slate-800">Connecting to Clinical Station...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (user.role === "patient") {
    return null;
  }

  return (
    <div className="min-h-screen glass-canvas text-[#17191C] font-sans antialiased p-2 sm:p-4 lg:p-6 flex items-stretch justify-center">
      {/* Toast Alert Banner */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in duration-150">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border text-xs font-semibold shadow-xl backdrop-blur-md ${
              toastIsError
                ? "bg-rose-500/90 border-rose-400 text-white"
                : "bg-[#151719]/90 border-white/20 text-white"
            }`}
          >
            {toastIsError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* FLOATING GLASS CONTAINER SHELL */}
      <div className="glass-shell rounded-[28px] lg:rounded-[36px] w-full flex overflow-hidden border border-white/80 shadow-2xl relative">
        {/* MODULAR SIDEBAR */}
        <DashboardSidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          isMobileOpen={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
          openCallsCount={openCallsCount}
          patientsCount={patients.length}
          devicesCount={devices.length}
          hasUrgentCalls={emergencyCalls.length > 0}
          onOpenAddPatient={() => setIsAddPatientModalOpen(true)}
          onOpenBleModal={() => setIsBleModalOpen(true)}
          voiceSupported={voice.supported}
          voiceEnabled={voice.enabled}
          onToggleVoice={() => voice.setEnabled(!voice.enabled)}
          onTestVoice={voice.testVoice}
          onSync={() => fetchRequests(true)}
          isSyncing={refreshing}
          user={{
            name: user?.name || user?.username || "Staff Nurse",
            username: user?.username,
          }}
          onLogout={logout}
        />

        {/* MAIN VIEW CONTENT CONTAINER */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen overflow-y-auto">
          {/* TOP STATUS BAR */}
          <DashboardHeader
            activeTab={activeTab}
            onlineDevicesCount={onlineDevicesCount}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenChordsVisualizer={() => handleOpenChordsVisualizer()}
          />

          {/* EMERGENCY PRIORITY BANNER */}
          <EmergencyAlertDeck
            emergencyCalls={emergencyCalls}
            onAcknowledge={(req) => promptStepConfirmation(req, "ACKNOWLEDGED")}
            onSelectPatientGroup={(patientCode) => {
              setActiveTab("calls");
              setSelectedCallsPatientKey(patientCode);
            }}
          />

          {/* ACTIVE TAB VIEW CONTENT */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
            {activeTab === "overview" && (
              <OverviewView
                beds={beds}
                patients={patients}
                devices={devices}
                requests={requests}
                openCallsCount={openCallsCount}
                emergencyCount={emergencyCalls.length}
                onlineGatewaysCount={onlineDevicesCount}
                onTabChange={setActiveTab}
                onOpenAddPatientModal={() => setIsAddPatientModalOpen(true)}
                onOpenBleCommissioning={() => setIsBleModalOpen(true)}
                onOpenChordsVisualizer={() => handleOpenChordsVisualizer()}
              />
            )}

            {activeTab === "calls" && (
              <LiveCallsView
                requests={requests}
                filter={filter}
                onFilterChange={setFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedPatientKey={selectedCallsPatientKey}
                onSelectPatientKey={setSelectedCallsPatientKey}
                onPromptStepConfirmation={promptStepConfirmation}
              />
            )}

            {activeTab === "patients" && (
              <PatientRegistryView
                patients={patients}
                devices={devices}
                requests={requests}
                nurseAssignLoading={nurseAssignLoading}
                deviceDeallocatingMap={deviceDeallocatingMap}
                onOpenBedChangeModal={handleOpenBedChangeModal}
                onOpenAllocateToPatient={handleOpenAllocateToPatient}
                onDeallocateDevice={handleDeallocateDevice}
                onOpenChordsVisualizer={handleOpenChordsVisualizer}
                onDeallocatePatient={handleDeallocatePatient}
                onOpenCareLinkModal={handleOpenCareLinkModal}
                onOpenAddPatientModal={() => setIsAddPatientModalOpen(true)}
                onPromptStepConfirmation={promptStepConfirmation}
              />
            )}

            {activeTab === "devices" && (
              <HardwareGatewaysView
                devices={devices}
                deviceDeallocatingMap={deviceDeallocatingMap}
                onOpenBleCommissioning={() => setIsBleModalOpen(true)}
                onOpenChordsVisualizer={handleOpenChordsVisualizer}
                onEditCommands={(dev) => setEditingDeviceCommands(dev)}
                onDeallocateDevice={(devId) => handleDeallocateDevice(devId)}
                onAllocatePatient={(dev) => {
                  setAllocatingDeviceFromList(dev);
                  setSelectedPatientForDevice("");
                }}
              />
            )}
          </main>
        </div>
      </div>

      {/* STEP ADVANCEMENT CONFIRMATION MODAL */}
      <StepConfirmModal
        data={stepConfirm}
        onClose={() => setStepConfirm(null)}
        onExecute={executeStepConfirmation}
      />

      {/* MODAL 1: REGISTER NEW PATIENT & SELECT AVAILABLE BED */}
      {isAddPatientModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#151719] text-white flex items-center justify-center shadow-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#17191C] tracking-tight">Register New Patient</h3>
                  <p className="text-[11px] text-slate-400">Add to clinical registry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddPatientModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleInitiatePatientRegistration} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Patient Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ronald Verma"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-[#F8F9FA] border border-slate-200/80 text-slate-900 focus:outline-none focus:border-black focus:bg-white transition"
                />
              </div>

              <div>
                <label htmlFor="patient-bed-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Enter Hospital Bed Number *
                </label>
                <input
                  id="patient-bed-input"
                  type="text"
                  required
                  list="available-beds-registration-list"
                  placeholder="e.g. ICU-01, BED-04, B-101"
                  value={newPatientBedNumber}
                  onChange={(e) => setNewPatientBedNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-[#F8F9FA] border border-slate-200/80 text-slate-900 focus:outline-none focus:border-black focus:bg-white font-mono uppercase transition"
                />
                <datalist id="available-beds-registration-list">
                  {availableBeds.map((b) => (
                    <option key={b._id} value={b.bedNumber}>
                      {b.bedNumber} {b.ward ? `(${b.ward})` : ""}
                    </option>
                  ))}
                </datalist>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Nurse enters assigned bed. Patient verifies bedside confirmation.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddPatientModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingPatient}
                  className="btn-pill-dark px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black shadow-sm transition disabled:opacity-50"
                >
                  {creatingPatient ? "Registering..." : "Register & Propose Bed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PROPOSE BED CHANGE */}
      {isBedChangeModalOpen && bedChangePatient && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#151719] text-white flex items-center justify-center shadow-xs">
                  <Bed className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#17191C] tracking-tight">Propose Bed Change</h3>
                  <p className="text-[11px] text-slate-400">Relocate patient to new bed</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBedChangeModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmProposeBedChange} className="space-y-4">
              <div className="text-xs text-slate-600 bg-[#F8F9FA] p-3.5 rounded-2xl border border-slate-200/80">
                Patient: <strong className="text-slate-900">{bedChangePatient.displayName}</strong> ({bedChangePatient.patientCode})
                <br />
                Current Bed: <span className="font-mono font-bold text-[#151719]">{bedChangePatient.bedLabel || "None"}</span>
              </div>

              <div>
                <label htmlFor="bed-change-input" className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Enter New Bed Number *
                </label>
                <input
                  id="bed-change-input"
                  type="text"
                  required
                  list="available-beds-change-list"
                  placeholder="e.g. ICU-02"
                  value={selectedNewBedNumber}
                  onChange={(e) => setSelectedNewBedNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-[#F8F9FA] border border-slate-200/80 text-slate-900 font-mono uppercase focus:outline-none focus:border-black focus:bg-white transition"
                />
                <datalist id="available-beds-change-list">
                  {availableBeds.map((b) => (
                    <option key={b._id} value={b.bedNumber}>
                      {b.bedNumber} {b.ward ? `(${b.ward})` : ""}
                    </option>
                  ))}
                </datalist>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Existing bed is retained until the patient confirms new bed transfer.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBedChangeModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={proposingBed}
                  className="btn-pill-dark px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black shadow-sm transition disabled:opacity-50"
                >
                  {proposingBed ? "Proposing..." : "Propose Bed"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: ALLOCATE DEVICE TO PATIENT */}
      {allocateModalPatient && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#151719] text-white flex items-center justify-center shadow-xs">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#17191C] tracking-tight">Allocate Hardware Gateway</h3>
                  <p className="text-[11px] text-slate-400">Direct 1-to-1 patient assignment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseAllocateModal}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs text-slate-600 bg-[#F8F9FA] p-3.5 rounded-2xl border border-slate-200/80">
                Patient: <strong className="text-slate-900">{allocateModalPatient.displayName}</strong> ({allocateModalPatient.patientCode})
                <br />
                Bed: <span className="font-mono font-bold text-[#151719]">{allocateModalPatient.bedLabel || "Unassigned"}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Select Available Online Gateway *
                </label>
                <select
                  value={selectedAllocateDeviceId}
                  onChange={(e) => setSelectedAllocateDeviceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-[#F8F9FA] border border-slate-200/80 text-slate-900 focus:outline-none focus:border-black focus:bg-white transition"
                >
                  <option value="">-- Choose an available online device --</option>
                  {devices
                    .filter(
                      (d) =>
                        d.status === "AVAILABLE" &&
                        !d.currentAssignment &&
                        d.connectivityStatus === "ONLINE"
                    )
                    .map((d) => (
                      <option key={d._id} value={d.deviceId}>
                        {d.name || d.deviceId} ({d.deviceId}) {d.hardwareId ? `[HW: ${d.hardwareId}]` : ""} &bull; Online
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Enforces strict 1-to-1 patient allocation. Gateway must be actively online.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={handleCloseAllocateModal}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={allocatingDevice || !selectedAllocateDeviceId}
                  onClick={handleConfirmAllocateDevice}
                  className="btn-pill-dark px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black shadow-sm transition disabled:opacity-50"
                >
                  {allocatingDevice ? "Allocating..." : "Allocate Gateway"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SEND CARE LINK REQUEST */}
      {careLinkModalPatient && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#151719] text-white flex items-center justify-center shadow-xs">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#17191C] tracking-tight">Send Care Link Request</h3>
                  <p className="text-[11px] text-slate-400">Link nurse assignment to bed</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCareLinkModalPatient(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSendCareLink} className="space-y-4">
              <div className="text-xs text-slate-600 bg-[#F8F9FA] p-3.5 rounded-2xl border border-slate-200/80">
                Patient: <strong className="text-slate-900">{careLinkModalPatient.displayName}</strong> ({careLinkModalPatient.patientCode})
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Confirm Bed Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICU-01"
                  value={careLinkBedNumber}
                  onChange={(e) => setCareLinkBedNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-[#F8F9FA] border border-slate-200/80 text-slate-900 font-mono uppercase focus:outline-none focus:border-black focus:bg-white transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCareLinkModalPatient(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={nurseAssignLoading[careLinkModalPatient.patientCode]}
                  className="btn-pill-dark px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black shadow-sm transition disabled:opacity-50"
                >
                  {nurseAssignLoading[careLinkModalPatient.patientCode] ? "Dispatching..." : "Send Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: EDIT DEVICE COMMANDS / GESTURE RULES */}
      {editingDeviceCommands && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-5 sm:p-6 border-b border-slate-100/80 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-[#17191C] tracking-tight">
                  {editingDeviceCommands.connectivityStatus === "ONLINE"
                    ? "Configure NPG Commands & Gestures"
                    : "Commands Locked — Device Offline"}
                </h3>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                  <span>Gateway: <strong className="font-mono text-slate-800">{editingDeviceCommands.name || editingDeviceCommands.deviceId}</strong></span>
                  {editingDeviceCommands.hardwareId && (
                    <span className="font-mono text-[11px] text-slate-400">HW: {editingDeviceCommands.hardwareId}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingDeviceCommands(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {editingDeviceCommands.connectivityStatus === "ONLINE" ? (
                <CommandRuleEditor
                  deviceId={editingDeviceCommands.deviceId}
                  variant="panel"
                  onDone={() => setEditingDeviceCommands(null)}
                />
              ) : (
                <div className="py-12 px-4 text-center max-w-md mx-auto space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#151719] text-white flex items-center justify-center mx-auto shadow-md">
                    <Lock className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-[#17191C]">Device Is Offline</h4>
                    <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                      Commands cannot be viewed, configured, or edited while the NPG hardware gateway is offline. The device must be powered on and online with active telemetry.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingDeviceCommands(null)}
                    className="btn-pill-dark px-6 py-2.5 rounded-full bg-[#151719] hover:bg-black text-white text-xs font-semibold shadow-sm transition"
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: ALLOCATE DEVICE TO PATIENT (FROM DEVICES TAB) */}
      {allocatingDeviceFromList && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#151719] text-white flex items-center justify-center shadow-xs">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#17191C] tracking-tight">Allocate Device to Patient</h3>
                  <p className="text-[11px] text-slate-400">Direct hardware binding</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAllocatingDeviceFromList(null);
                  setSelectedPatientForDevice("");
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="text-xs text-slate-600 bg-[#F8F9FA] p-3.5 rounded-2xl border border-slate-200/80">
                Gateway: <strong className="text-slate-900">{allocatingDeviceFromList.name || allocatingDeviceFromList.deviceId}</strong> ({allocatingDeviceFromList.deviceId})
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Select Registered Patient *
                </label>
                <select
                  value={selectedPatientForDevice}
                  onChange={(e) => setSelectedPatientForDevice(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-2xl bg-[#F8F9FA] border border-slate-200/80 text-slate-900 focus:outline-none focus:border-black focus:bg-white transition"
                >
                  <option value="">-- Choose patient --</option>
                  {patients
                    .filter((p) => !p.currentAssignment?.device)
                    .map((p) => (
                      <option key={p._id} value={p.patientCode}>
                        {p.displayName} ({p.patientCode}) &bull; Bed: {p.bedLabel || "Unassigned"}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setAllocatingDeviceFromList(null);
                    setSelectedPatientForDevice("");
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-900 rounded-full transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={allocatingPatientToDeviceLoading || !selectedPatientForDevice}
                  onClick={handleConfirmAllocatePatientToDevice}
                  className="btn-pill-dark px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black shadow-sm transition disabled:opacity-50"
                >
                  {allocatingPatientToDeviceLoading ? "Allocating..." : "Allocate Gateway"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLE COMMISSIONING MODAL */}
      <BleCommissioningModal
        isOpen={isBleModalOpen}
        onClose={() => setIsBleModalOpen(false)}
        registeredBy={user?.email || user?.username || user?.name || "Nurse"}
        onDeviceCommissioned={() => {
          fetchAuxData();
          fetchRequests(false);
        }}
      />

      {/* CHORDS LIVE BIO-POTENTIAL SIGNALS MODAL */}
      <ChordsSignalVisualizerModal
        isOpen={isChordsModalOpen}
        onClose={() => setIsChordsModalOpen(false)}
        initialDeviceId={chordsInitialDeviceId}
        initialPatientCode={chordsInitialPatientCode}
        devices={devices}
        patients={patients}
      />
    </div>
  );
}
