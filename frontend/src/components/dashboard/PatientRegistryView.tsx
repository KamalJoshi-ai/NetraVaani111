"use client";

import React, { useState, useMemo } from "react";
import {
  User,
  Shield,
  Check,
  Clock,
  AlertTriangle,
  Bed,
  Link2,
  Unlink,
  Activity,
  Search,
  Plus,
  Battery,
} from "@/lib/noIcons";

import { PatientItem, DeviceItem, CareRequestItem } from "@/lib/api";

interface PatientRegistryViewProps {
  patients: PatientItem[];
  devices: DeviceItem[];
  requests?: CareRequestItem[];
  nurseAssignLoading: Record<string, boolean>;
  deviceDeallocatingMap: Record<string, boolean>;
  onOpenBedChangeModal: (pt: PatientItem) => void;
  onOpenAllocateToPatient: (pt: PatientItem) => void;
  onDeallocateDevice: (deviceId: string, patientName?: string) => void;
  onOpenChordsVisualizer: (deviceId?: string, patientCode?: string) => void;
  onDeallocatePatient: (patientCode: string) => void;
  onOpenCareLinkModal: (pt: PatientItem) => void;
  onOpenAddPatientModal?: () => void;
  onPromptStepConfirmation?: (
    req: CareRequestItem,
    nextStep: "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "REQUEST_CONFIRMATION"
  ) => void;
}

export const PatientRegistryView: React.FC<PatientRegistryViewProps> = ({
  patients,
  devices,
  requests = [],
  nurseAssignLoading,
  deviceDeallocatingMap,
  onOpenBedChangeModal,
  onOpenAllocateToPatient,
  onDeallocateDevice,
  onOpenChordsVisualizer,
  onDeallocatePatient,
  onOpenCareLinkModal,
  onOpenAddPatientModal,
  onPromptStepConfirmation,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "ACTIVE" | "PENDING">("ALL");

  const filteredPatients = useMemo(() => {
    return patients.filter((pt) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        pt.displayName.toLowerCase().includes(q) ||
        pt.patientCode.toLowerCase().includes(q) ||
        (pt.bedLabel && pt.bedLabel.toLowerCase().includes(q));

      const matchesStatus =
        filterStatus === "ALL" ||
        (filterStatus === "ACTIVE" && pt.status === "ACTIVE") ||
        (filterStatus === "PENDING" && pt.status !== "ACTIVE");

      return matchesSearch && matchesStatus;
    });
  }, [patients, searchQuery, filterStatus]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 backdrop-blur-md border border-white/80 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-2xl bg-[#151719] text-white flex items-center justify-center">
              <User className="w-4 h-4" />
            </span>
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#17191C] tracking-tight">
              Patient Bedside Registry
            </h2>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/5 text-[#17191C]">
              {patients.length} Registered
            </span>
          </div>
          <p className="text-xs text-[#686D73] mt-1">
            Nurse-controlled bed assignment &bull; Mandatory communication handshake tracking &bull; 1-to-1 Gateway
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#92979D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search patient, bed, MRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-full bg-white/80 border border-white/80 text-[#17191C] placeholder-[#92979D] focus:outline-none focus:bg-white focus:ring-1 focus:ring-black shadow-xs transition"
            />
          </div>

          {(["ALL", "ACTIVE", "PENDING"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterStatus(mode)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition shadow-xs active:scale-95 ${
                filterStatus === mode
                  ? "bg-[#151719] text-white shadow-md"
                  : "bg-white/80 text-[#686D73] border border-white/80 hover:text-[#17191C] hover:bg-white"
              }`}
            >
              {mode === "ALL" ? "All" : mode === "ACTIVE" ? "Active" : "Pending"}
            </button>
          ))}

          {/* {onOpenAddPatientModal && (
            <button
              type="button"
              onClick={onOpenAddPatientModal}
              className="btn-pill-dark px-4 py-2 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black shadow-xs transition flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Admit Patient</span>
            </button>
          )} */}

        </div>
      </div>

      {/* Patients Grid */}
      {filteredPatients.length === 0 ? (
        <div className="bg-white border border-black/5 rounded-3xl p-12 text-center space-y-3 shadow-xl">
          <div className="w-12 h-12 rounded-2xl bg-black/5 text-[#8E9298] flex items-center justify-center mx-auto">
            <User className="w-6 h-6" />
          </div>
          <div className="text-sm font-heading font-bold text-[#17191C]">No patients found</div>
          <p className="text-xs text-[#686D73] max-w-sm mx-auto">
            {searchQuery
              ? `No patient records matched "${searchQuery}". Try clearing search.`
              : "No patients are currently registered in this clinical ward."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map((pt) => {
            const assignedDevice = pt.currentAssignment?.device;
            const hasConfirmed = Boolean(pt.bedLabel && pt.status === "ACTIVE");
            const hasPendingBed = Boolean(pt.pendingBedLabel);

            // Handshake telemetry resolution
            const liveDev = assignedDevice
              ? devices.find((d) => d.deviceId === assignedDevice.deviceId)
              : undefined;
            const commState = pt.communicationState || liveDev?.communicationState;
            const handshakeStatus = commState?.handshakeStatus || "PENDING";
            const commMode = commState?.communicationMode || "MANDATORY_HANDSHAKE";

            const isDevActive =
              liveDev?.connectivityStatus === "ONLINE" || assignedDevice?.connectivityStatus === "ONLINE";
            const batt = liveDev?.batteryLevel ?? assignedDevice?.batteryLevel;

            // Live commands for this specific patient
            const ptCalls = (requests || []).filter((r) => {
              const act = (r.action || r.ruleId || "").toUpperCase();
              if (act === "YES" || act === "NO" || act === "C07" || act === "C05") return false;
              if (r.status === "PENDING_DISPATCH_CONFIRMATION" || r.status === "CANCELLED") return false;
              const matchesPatient =
                r.patient?._id === pt._id ||
                r.patient?.patientCode === pt.patientCode ||
                (assignedDevice && r.device?.deviceId === assignedDevice.deviceId);
              return matchesPatient;
            });
            const pendingCount = ptCalls.filter((c) => c.status !== "RESOLVED").length;

            return (
              <div
                key={pt._id}
                className="bg-white border border-black/5 rounded-3xl p-5 sm:p-6 flex flex-col justify-between shadow-xl hover:shadow-2xl transition duration-150"
              >
                <div>
                  {/* Top Bar: MRN & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold text-[#17191C] bg-black/5 px-2.5 py-0.5 rounded-full">
                      {pt.patientCode}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase ${
                        pt.status === "ACTIVE"
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {pt.status === "ACTIVE" ? "Active" : "Pending Bed"}
                    </span>
                  </div>

                  {/* Patient Name */}
                  <h3 className="font-heading font-extrabold text-base text-[#17191C] mt-2.5">
                    {pt.displayName}
                  </h3>

                  {/* Bed Assignment Capsule */}
                  <div className="mt-3 p-3.5 rounded-2xl bg-black/[0.02] border border-black/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#686D73] font-medium">Assigned Bed:</span>
                      {hasConfirmed ? (
                        <span className="font-bold text-teal-800 font-mono bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                          {pt.bedLabel}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </div>

                    {/* Pending Bed Proposal Notice */}
                    {hasPendingBed && (
                      <div className="flex items-center justify-between pt-1 border-t border-black/5">
                        <span className="text-amber-800 font-medium">Proposal:</span>
                        <span className="font-bold text-amber-800 font-mono bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
                          Bed {pt.pendingBedLabel}
                        </span>
                      </div>
                    )}

                    {/* Propose / Assign Bed Action */}
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => onOpenBedChangeModal(pt)}
                        className="text-[11px] font-semibold text-teal-700 hover:text-teal-900 hover:underline transition inline-flex items-center gap-1"
                      >
                        <Bed className="w-3 h-3" />
                        <span>{hasConfirmed ? "Propose Bed Change" : "Assign Available Bed"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Mandatory Handshake Status Card */}
                  {assignedDevice && (
                    <div className="mt-3 p-3.5 rounded-2xl border border-black/5 bg-white space-y-2 shadow-xs">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-[#17191C] flex items-center gap-1.5 text-xs">
                          <Shield className="w-3.5 h-3.5 text-teal-700" />
                          <span>Handshake:</span>
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-tight inline-flex items-center gap-1 ${
                            handshakeStatus === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                              : handshakeStatus === "WAITING_FOR_NO" || handshakeStatus === "WAITING_FOR_YES"
                              ? "bg-teal-50 text-teal-800 border border-teal-300"
                              : "bg-amber-50 text-amber-900 border border-amber-300"
                          }`}
                        >
                          {handshakeStatus === "COMPLETED" && <Check className="w-3 h-3 text-emerald-700" />}
                          {(handshakeStatus === "WAITING_FOR_NO" || handshakeStatus === "WAITING_FOR_YES") && (
                            <Clock className="w-3 h-3 text-teal-700" />
                          )}
                          {handshakeStatus === "PENDING" && <AlertTriangle className="w-3 h-3 text-amber-700" />}
                          <span>
                            {handshakeStatus === "COMPLETED"
                              ? "COMPLETED"
                              : handshakeStatus === "WAITING_FOR_NO"
                              ? "WAITING FOR NO (YES ✓)"
                              : handshakeStatus === "WAITING_FOR_YES"
                              ? "WAITING FOR YES (NO ✓)"
                              : "PENDING"}
                          </span>
                        </span>
                      </div>
                      <div className="text-[11px] text-[#686D73] flex items-center justify-between pt-0.5">
                        <span className="text-[10px] text-[#686D73] font-medium">
                          {commMode === "NORMAL_COMMUNICATION"
                            ? "Normal Communication Active"
                            : "Mandatory Communication Mode"}
                        </span>
                        <span className="font-mono text-[10px] font-semibold text-[#17191C]">
                          YES: {commState?.yesSentAt ? "✓" : "—"} &bull; NO: {commState?.noSentAt ? "✓" : "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Device Allocation Section */}
                  <div className="mt-3.5 pt-3 border-t border-black/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[#686D73] font-medium">Gateway:</span>
                      {assignedDevice ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#17191C] bg-black/5 px-2.5 py-0.5 rounded-full text-[11px]">
                            {assignedDevice.deviceId}
                          </span>
                          {isDevActive && batt !== undefined && batt !== null && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-tight inline-flex items-center gap-1 ${
                                batt > 50
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : batt > 20
                                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                                  : "bg-rose-50 text-rose-800 border border-rose-200"
                              }`}
                              title={`Battery: ${batt}%`}
                            >
                              <Battery className="w-2.5 h-2.5" />
                              <span>{batt}%</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">No Device Assigned</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 gap-2">
                      <span className="text-[#686D73] font-medium">Action:</span>
                      {assignedDevice ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenChordsVisualizer(assignedDevice.deviceId, pt.patientCode)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-[#17191C] bg-black/5 hover:bg-black/10 px-3 py-1.5 rounded-full transition active:scale-95"
                            title="Inspect live biopotentials in Chords"
                          >
                            <Activity className="w-3 h-3 text-teal-700" />
                            <span>Signals</span>
                          </button>
                          <button
                            type="button"
                            disabled={deviceDeallocatingMap[assignedDevice.deviceId]}
                            onClick={() => onDeallocateDevice(assignedDevice.deviceId, pt.displayName)}
                            className="inline-flex items-center gap-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 rounded-full transition shadow-md shadow-red-600/20 disabled:opacity-60 active:scale-95"
                            title="Unassign device from patient"
                          >
                            <Unlink className="w-3 h-3" />
                            <span>
                              {deviceDeallocatingMap[assignedDevice.deviceId] ? "Releasing..." : "Unassign"}
                            </span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onOpenAllocateToPatient(pt)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-[#151719] hover:bg-black px-3.5 py-1.5 rounded-full transition shadow-xs active:scale-95"
                        >
                          <Link2 className="w-3 h-3" />
                          <span>Allocate Gateway</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Live Commands for this Patient */}
                  <div className="mt-3.5 pt-3 border-t border-black/5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#686D73] uppercase tracking-wider">
                      <span>Live Commands ({ptCalls.length})</span>
                      {pendingCount > 0 && (
                        <span className="text-amber-800 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          {pendingCount} In Flight
                        </span>
                      )}
                    </div>

                    {ptCalls.length === 0 ? (
                      <div className="p-2.5 rounded-2xl bg-black/[0.02] border border-black/5 text-center text-[11px] text-[#8E9298]">
                        No active commands pending.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {ptCalls.slice(0, 5).map((call) => {
                          const isResolved = call.status === "RESOLVED";
                          const isEmergency = Boolean(call.alarm || call.action === "EMERGENCY");
                          const label = call.displayLabel || call.label || call.action.replace(/_/g, " ");

                          return (
                            <div
                              key={call._id}
                              className={`p-2 rounded-xl border flex items-center justify-between gap-2 transition ${
                                isEmergency
                                  ? "bg-rose-500/10 border-rose-500/30"
                                  : !isResolved
                                  ? "bg-amber-500/[0.06] border-amber-500/20"
                                  : "bg-black/[0.02] border-black/5"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 ${
                                    isEmergency
                                      ? "bg-rose-500 animate-ping"
                                      : call.status === "NEW"
                                      ? "bg-amber-500 animate-pulse"
                                      : call.status === "ACKNOWLEDGED"
                                      ? "bg-teal-500"
                                      : call.status === "IN_PROGRESS"
                                      ? "bg-purple-500 animate-pulse"
                                      : "bg-emerald-500"
                                  }`}
                                />
                                <div className="min-w-0">
                                  <span className="font-heading font-bold text-xs text-[#17191C] truncate block">
                                    {label}
                                  </span>
                                  <span className="text-[10px] font-mono text-[#8E9298]">
                                    {new Date(call.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                                    isEmergency
                                      ? "bg-rose-600 text-white"
                                      : call.status === "NEW"
                                      ? "bg-amber-100 text-amber-900 border border-amber-300"
                                      : call.status === "ACKNOWLEDGED"
                                      ? "bg-teal-100 text-teal-900 border border-teal-300"
                                      : call.status === "IN_PROGRESS"
                                      ? "bg-purple-100 text-purple-900 border border-purple-300"
                                      : "bg-emerald-100 text-emerald-900"
                                  }`}
                                >
                                  {call.status}
                                </span>

                                {!isResolved && onPromptStepConfirmation && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextStep =
                                        call.status === "NEW"
                                          ? "ACKNOWLEDGED"
                                          : call.status === "ACKNOWLEDGED"
                                          ? "IN_PROGRESS"
                                          : "RESOLVED";
                                      onPromptStepConfirmation(call, nextStep);
                                    }}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#151719] hover:bg-black text-white transition active:scale-95 shadow-xs"
                                  >
                                    {call.status === "NEW"
                                      ? "Ack"
                                      : call.status === "ACKNOWLEDGED"
                                      ? "Handle"
                                      : "Resolve"}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Nurse Care Link Footer */}
                <div className="mt-4 pt-3 border-t border-black/5 text-xs">
                  {pt.nurseAssignment?.status === "PENDING" ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-amber-800 font-semibold flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Awaiting Bedside Approval</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeallocatePatient(pt.patientCode)}
                        className="text-[11px] text-rose-600 hover:underline font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : pt.nurseAssignment?.status === "APPROVED" ? (
                    <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold">
                      <span className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Care Linked (Nurse Assigned)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeallocatePatient(pt.patientCode)}
                        className="text-[11px] text-slate-500 hover:text-rose-600 transition"
                      >
                        Unlink
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={nurseAssignLoading[pt.patientCode]}
                      onClick={() => onOpenCareLinkModal(pt)}
                      className="w-full py-2.5 rounded-2xl text-xs font-semibold bg-black/[0.03] hover:bg-black/[0.06] border border-black/5 text-[#17191C] transition active:scale-98"
                    >
                      {nurseAssignLoading[pt.patientCode] ? "Requesting..." : "Send Care Link Request"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
