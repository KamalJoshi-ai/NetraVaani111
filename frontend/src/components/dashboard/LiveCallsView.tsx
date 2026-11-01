"use client";

import React, { useMemo } from "react";
import { CareRequestItem, CareRequestStatus } from "@/lib/api";
import {
  Bell,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
} from "@/lib/noIcons";

export interface PatientCallGroup {
  key: string;
  patientId?: string;
  patientCode: string;
  displayName: string;
  bedLabel: string;
  calls: CareRequestItem[];
  activeCount: number;
  disputedCount?: number;
  awaitingCount: number;
  acknowledgedCount: number;
  inProgressCount: number;
  resolvedCount: number;
  latestCall?: CareRequestItem;
  hasUrgent: boolean;
}

interface LiveCallsViewProps {
  requests: CareRequestItem[];
  filter: "ALL" | CareRequestStatus;
  onFilterChange: (status: "ALL" | CareRequestStatus) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedPatientKey: string | null;
  onSelectPatientKey: (key: string | null) => void;
  onPromptStepConfirmation: (
    req: CareRequestItem,
    nextStep: "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "REQUEST_CONFIRMATION"
  ) => void;
}

function formatCallTime(dateStr?: string) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function LiveCallsView({
  requests,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  selectedPatientKey,
  onSelectPatientKey,
  onPromptStepConfirmation,
}: LiveCallsViewProps) {
  // Filtered requests according to search, filter tab, and strict exclusions
  const filteredRequests = useMemo(() => {
    return requests
      .filter((req) => {
        // Strictly exclude unconfirmed or cancelled dispatch requests, and YES/NO handshake commands
        if (
          req.status === "PENDING_DISPATCH_CONFIRMATION" ||
          req.status === "CANCELLED" ||
          req.action === "YES" ||
          req.action === "NO" ||
          req.ruleId?.toLowerCase() === "yes" ||
          req.ruleId?.toLowerCase() === "no"
        ) {
          return false;
        }

        if (filter !== "ALL" && req.status !== filter) return false;
        if (!searchQuery.trim()) return true;

        const q = searchQuery.toLowerCase();
        const pName = req.patient?.displayName?.toLowerCase() || "";
        const pBed = req.patient?.bedLabel?.toLowerCase() || "";
        const pCode = req.patient?.patientCode?.toLowerCase() || "";
        const pAction = req.action?.toLowerCase() || "";
        return pName.includes(q) || pBed.includes(q) || pCode.includes(q) || pAction.includes(q);
      })
      .sort((a, b) => {
        const openAlarm = (r: CareRequestItem) => Boolean(r.alarm) && r.status !== "RESOLVED";
        return openAlarm(a) === openAlarm(b) ? 0 : openAlarm(a) ? -1 : 1;
      });
  }, [requests, filter, searchQuery]);

  // Group live calls by patient for patient-centric categorization
  const patientCallGroups = useMemo<PatientCallGroup[]>(() => {
    const map = new Map<string, PatientCallGroup>();

    filteredRequests.forEach((req) => {
      const key =
        req.patient?._id ||
        req.patient?.patientCode ||
        (req.device?.deviceId ? `dev_${req.device.deviceId}` : "unassigned");

      const existing = map.get(key);
      const isUrgent = Boolean(req.alarm || req.urgent || req.status === "NEW");

      if (!existing) {
        map.set(key, {
          key,
          patientId: req.patient?._id,
          patientCode:
            req.patient?.patientCode ||
            (req.patient?.displayName
              ? req.patient.displayName.slice(0, 4).toUpperCase()
              : "BEDSIDE"),
          displayName: req.patient?.displayName || "Bedside Gateway Call",
          bedLabel: req.patient?.bedLabel || "Unassigned Bed",
          calls: [req],
          activeCount: req.status !== "RESOLVED" ? 1 : 0,
          disputedCount: req.patientDisputedAt ? 1 : 0,
          awaitingCount: req.status === "NEW" ? 1 : 0,
          acknowledgedCount: req.status === "ACKNOWLEDGED" ? 1 : 0,
          inProgressCount: req.status === "IN_PROGRESS" ? 1 : 0,
          resolvedCount: req.status === "RESOLVED" ? 1 : 0,
          latestCall: req,
          hasUrgent: isUrgent,
        });
      } else {
        existing.calls.push(req);
        if (req.status !== "RESOLVED") existing.activeCount += 1;
        if (req.patientDisputedAt) existing.disputedCount = (existing.disputedCount || 0) + 1;
        if (req.status === "NEW") existing.awaitingCount += 1;
        if (req.status === "ACKNOWLEDGED") existing.acknowledgedCount += 1;
        if (req.status === "IN_PROGRESS") existing.inProgressCount += 1;
        if (req.status === "RESOLVED") existing.resolvedCount += 1;
        if (isUrgent) existing.hasUrgent = true;

        if (
          !existing.latestCall ||
          new Date(req.createdAt).getTime() > new Date(existing.latestCall.createdAt).getTime()
        ) {
          existing.latestCall = req;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if ((a.disputedCount || 0) !== (b.disputedCount || 0))
        return (b.disputedCount || 0) - (a.disputedCount || 0);
      if (a.awaitingCount !== b.awaitingCount) return b.awaitingCount - a.awaitingCount;
      if (a.activeCount !== b.activeCount) return b.activeCount - a.activeCount;
      const timeA = a.latestCall ? new Date(a.latestCall.createdAt).getTime() : 0;
      const timeB = b.latestCall ? new Date(b.latestCall.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [filteredRequests]);

  const selectedPatientGroup = useMemo(() => {
    if (!selectedPatientKey) return null;
    return patientCallGroups.find((g) => g.key === selectedPatientKey) || null;
  }, [patientCallGroups, selectedPatientKey]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Top Filter and Search Bar (Matches Glass & Pill bar from Reference Image) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 backdrop-blur-md border border-white/80 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div>
          <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#17191C] tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-2xl bg-[#151719] text-white flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </span>
            <span>Clinical Calls Ledger</span>
          </h2>
          <p className="text-xs text-[#686D73] mt-1">
            Real-time patient assistance triage &bull; Sequential nurse step advancement
          </p>
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#92979D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search patient, bed..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-full bg-white/80 border border-white/80 text-[#17191C] placeholder-[#92979D] focus:outline-none focus:bg-white focus:ring-1 focus:ring-black shadow-xs transition"
            />
          </div>

          {(["ALL", "NEW", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onFilterChange(st)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition shadow-xs active:scale-95 ${
                filter === st
                  ? "bg-[#151719] text-white shadow-md"
                  : "bg-white/80 text-[#686D73] border border-white/80 hover:text-[#17191C] hover:bg-white"
              }`}
            >
              {st === "NEW" ? "Awaiting" : st.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {selectedPatientGroup ? (
        /* VIEW B: DETAILED CALLS LEDGER FOR SELECTED PATIENT */
        <div className="space-y-4">
          {/* Breadcrumb Header Card */}
          <div className="bg-white border border-black/5 rounded-3xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectPatientKey(null)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#151719] text-white hover:bg-black transition shadow-xs active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Patients</span>
              </button>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="font-heading font-extrabold text-base text-[#17191C]">
                    {selectedPatientGroup.displayName}
                  </span>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/5 text-[#17191C]">
                    {selectedPatientGroup.patientCode}
                  </span>
                  <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                    Bed {selectedPatientGroup.bedLabel}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-xs font-mono text-[#686D73]">
                {selectedPatientGroup.calls.length} total call{selectedPatientGroup.calls.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Individual Request Cards in Patient Ledger */}
          <div className="bg-white border border-black/5 rounded-3xl overflow-hidden shadow-xl divide-y divide-black/5">
            {selectedPatientGroup.calls.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#8E9298]">
                No matching calls found for this filter.
              </div>
            ) : (
              selectedPatientGroup.calls.map((req) => {
                return (
                  <div
                    key={req._id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                  >
                    <div className="flex items-start gap-3.5">
                      <span
                        className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                          req.status === "RESOLVED"
                            ? "bg-emerald-600"
                            : req.status === "IN_PROGRESS"
                            ? "bg-teal-600 animate-pulse"
                            : req.status === "ACKNOWLEDGED"
                            ? "bg-amber-500"
                            : "bg-rose-600 animate-ping"
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-bold text-sm text-[#17191C]">
                            {req.displayLabel || req.label || req.action}
                          </span>
                          <span className="text-[11px] font-mono font-semibold text-[#8E9298]">
                            &bull; {formatCallTime(req.createdAt)}
                          </span>
                        </div>

                        {req.patientDisputedAt && (
                          <div className="mt-1 text-[11px] text-rose-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Patient disputed resolution at bedside audio</span>
                          </div>
                        )}

                        {req.confirmationNote && (
                          <div className="mt-1 text-[11px] text-emerald-700 font-semibold flex items-center gap-1 font-mono">
                            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{req.confirmationNote}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Step Action Buttons (Matches Black Pill buttons from Reference Image) */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {req.status === "NEW" && (
                        <button
                          type="button"
                          onClick={() => onPromptStepConfirmation(req, "ACKNOWLEDGED")}
                          className="px-4 py-2 rounded-full text-xs font-semibold bg-[#151719] hover:bg-black text-white transition shadow-xs active:scale-95"
                        >
                          Acknowledge
                        </button>
                      )}

                      {req.status === "ACKNOWLEDGED" && (
                        <button
                          type="button"
                          onClick={() => onPromptStepConfirmation(req, "IN_PROGRESS")}
                          className="px-4 py-2 rounded-full text-xs font-semibold bg-[#151719] hover:bg-black text-white transition shadow-xs active:scale-95"
                        >
                          Start Handling
                        </button>
                      )}

                      {req.status === "IN_PROGRESS" && (
                        <button
                          type="button"
                          onClick={() => onPromptStepConfirmation(req, "RESOLVED")}
                          className="px-4 py-2 rounded-full text-xs font-semibold bg-[#151719] hover:bg-black text-white transition shadow-xs active:scale-95 flex items-center gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Resolve Call</span>
                        </button>
                      )}

                      {req.status === "RESOLVED" && (
                        <span className="px-3 py-1 rounded-full text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200">
                          Resolved
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* VIEW A: MASTER PATIENT GROUPED CARDS (Matches Task Cards in Reference Image) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patientCallGroups.length === 0 ? (
            <div className="col-span-full bg-white border border-black/5 rounded-3xl p-12 text-center text-xs text-[#8E9298] shadow-xl">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              No active or historical patient calls match the filter.
            </div>
          ) : (
            patientCallGroups.map((group) => {
              const hasActive = group.activeCount > 0;
              const hasDispute = (group.disputedCount || 0) > 0;

              return (
                <div
                  key={group.key}
                  onClick={() => onSelectPatientKey(group.key)}
                  className="bg-white border border-black/5 rounded-3xl p-5 shadow-xl hover:shadow-2xl transition cursor-pointer flex flex-col justify-between group active:scale-98"
                >
                  <div>
                    {/* Top Header: MRN & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/5 text-[#17191C]">
                          {group.patientCode}
                        </span>
                        {hasDispute ? (
                          <span className="w-2 h-2 rounded-full bg-rose-500" title="Disputed resolution" />
                        ) : hasActive ? (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Active call in flight" />
                        ) : null}
                      </div>
                      <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded-full">
                        Bed {group.bedLabel}
                      </span>
                    </div>

                    {/* Patient Name */}
                    <h3 className="font-heading font-extrabold text-base text-[#17191C] mt-2.5">
                      {group.displayName}
                    </h3>

                    {/* All Commands for this Patient (User requirement: show all commands even though previous is not resolved) */}
                    <div className="mt-3.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-mono font-bold text-[#686D73] uppercase tracking-wider">
                        <span>Commands ({group.calls.length})</span>
                        {group.activeCount > 0 && (
                          <span className="text-amber-800 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                            {group.activeCount} Pending
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                        {group.calls.map((call) => {
                          const isResolved = call.status === "RESOLVED";
                          const isEmergency = Boolean(call.alarm || call.action === "EMERGENCY");
                          const label = call.displayLabel || call.label || call.action.replace(/_/g, " ");

                          return (
                            <div
                              key={call._id}
                              className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
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
                                    {formatCallTime(call.createdAt)}
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

                                {!isResolved && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextStep =
                                        call.status === "NEW"
                                          ? "ACKNOWLEDGED"
                                          : call.status === "ACKNOWLEDGED"
                                          ? "IN_PROGRESS"
                                          : "RESOLVED";
                                      onPromptStepConfirmation(call, nextStep);
                                    }}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#151719] hover:bg-black text-white transition active:scale-95 shadow-xs"
                                    title={`Advance status from ${call.status}`}
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
                    </div>
                  </div>

                  {/* Footer Pill Counters */}
                  <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between text-xs">
                    <span className="text-[#686D73]">
                      {group.calls.length} Total Call{group.calls.length !== 1 ? "s" : ""}
                    </span>

                    <span className="text-xs font-semibold text-[#17191C] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>View Ledger</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
