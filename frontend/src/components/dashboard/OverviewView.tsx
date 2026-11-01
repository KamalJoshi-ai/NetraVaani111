"use client";

import React from "react";
import { BedItem, CareRequestItem, DeviceItem, PatientItem } from "@/lib/api";
import {
  Bed,
  Radio,
  Bell,
  CheckCircle2,
  ArrowRight,
  Activity,
  Battery,
  Plus,
  Volume2,
} from "@/lib/noIcons";
import { DashboardTab } from "./DashboardSidebar";
import { GlassTiltCard } from "./GlassTiltCard";

interface OverviewViewProps {
  patients: PatientItem[];
  devices: DeviceItem[];
  beds: BedItem[];
  requests: CareRequestItem[];
  onNavigateTab?: (tab: DashboardTab) => void;
  onTabChange?: (tab: DashboardTab) => void;
  openCallsCount?: number;
  emergencyCount?: number;
  onlineGatewaysCount?: number;
  onOpenAddPatientModal?: () => void;
  onOpenBleCommissioning?: () => void;
  onOpenChordsVisualizer: () => void;
}

export function OverviewView({
  patients,
  devices,
  beds,
  requests,
  onNavigateTab,
  onTabChange,
  onOpenAddPatientModal,
  onOpenChordsVisualizer,
}: OverviewViewProps) {
  const navigate = onTabChange || onNavigateTab || (() => {});

  // Bed computations
  const availableBeds = beds.filter((b) => b.status === "AVAILABLE").length;
  const pendingBeds = patients.filter((p) => p.pendingBedLabel).length;
  const occupiedBeds = patients.filter((p) => p.bedLabel && p.status === "ACTIVE").length;

  // Device computations
  const onlineDevices = devices.filter((d) => d.connectivityStatus === "ONLINE").length;
  const allocatedDevices = devices.filter((d) => d.status === "ASSIGNED" || Boolean(d.currentAssignment)).length;
  const availableDevices = devices.filter((d) => d.status === "AVAILABLE" && !d.currentAssignment).length;

  // Recent clinical requests (resolved and in-flight, excluding handshake YES/NO)
  const clinicalCalls = requests.filter((r) => {
    const act = (r.action || r.ruleId || "").toUpperCase();
    return (
      r.status !== "CANCELLED" &&
      r.status !== "PENDING_DISPATCH_CONFIRMATION" &&
      act !== "YES" &&
      act !== "NO" &&
      act !== "C07" &&
      act !== "C05"
    );
  });

  const recentCalls = clinicalCalls.slice(0, 10);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* TOP ROW: Hospital Beds Occupancy + Clinical Devices & Gateways (Wrapped in 3D Glass Tilt Perspective) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* CARD 1: Hospital Beds Occupancy */}
        <GlassTiltCard className="rounded-3xl h-full" maxTilt={5}>
          <div className="bg-white/85 backdrop-blur-md border border-white/80 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-black/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-[#151719] text-white flex items-center justify-center shadow-xs">
                    <Bed className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-base text-[#17191C]">
                      Hospital Beds Occupancy
                    </h2>
                    <p className="text-xs text-[#686D73]">
                      Nurse-controlled bed allocation ledger
                    </p>
                  </div>
                </div>

                {/* {onOpenAddPatientModal && (
                  <button
                    type="button"
                    onClick={onOpenAddPatientModal}
                    className="btn-pill-dark px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black shadow-xs transition flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Admit</span>
                  </button>
                )} */}
              </div>

              {/* 3 Metrics: Available, Pending, Occupied */}
              <div className="grid grid-cols-3 gap-3.5 mt-5">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                    Available
                  </span>
                  <span className="text-3xl font-heading font-extrabold text-emerald-900 mt-1 block">
                    {availableBeds}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider block">
                    Pending
                  </span>
                  <span className="text-3xl font-heading font-extrabold text-amber-900 mt-1 block">
                    {pendingBeds}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/5 text-center">
                  <span className="text-[11px] font-semibold text-[#686D73] uppercase tracking-wider block">
                    Occupied
                  </span>
                  <span className="text-3xl font-heading font-extrabold text-[#17191C] mt-1 block">
                    {occupiedBeds}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-black/5 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => navigate("patients")}
                className="flex-1 py-2.5 px-4 rounded-full text-xs font-semibold text-[#17191C] bg-black/5 hover:bg-black/10 transition text-center"
              >
                Manage Patients &amp; Bed Assignments
              </button>
            </div>
          </div>
        </GlassTiltCard>

        {/* CARD 2: Clinical Devices & Gateways */}
        <GlassTiltCard className="rounded-3xl h-full" maxTilt={5}>
          <div className="bg-white/85 backdrop-blur-md border border-white/80 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-black/5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-2xl bg-[#151719] text-white flex items-center justify-center shadow-xs">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-heading font-bold text-base text-[#17191C]">
                      Clinical Devices &amp; Gateways
                    </h2>
                    <p className="text-xs text-[#686D73]">
                      Strict 1-to-1 patient allocation
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-500/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{onlineDevices} Online</span>
                </span>
              </div>

              {/* 3 Metrics: Total, Allocated, Available */}
              <div className="grid grid-cols-3 gap-3.5 mt-5">
                <div className="p-4 rounded-2xl bg-black/[0.03] border border-black/5 text-center">
                  <span className="text-[11px] font-semibold text-[#686D73] uppercase tracking-wider block">
                    Total
                  </span>
                  <span className="text-3xl font-heading font-extrabold text-[#17191C] mt-1 block">
                    {devices.length}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-center">
                  <span className="text-[11px] font-semibold text-teal-800 uppercase tracking-wider block">
                    Allocated
                  </span>
                  <span className="text-3xl font-heading font-extrabold text-teal-900 mt-1 block">
                    {allocatedDevices}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">
                    Available
                  </span>
                  <span className="text-3xl font-heading font-extrabold text-emerald-900 mt-1 block">
                    {availableDevices}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-5 mt-5 border-t border-black/5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate("devices")}
                className="flex-1 py-2.5 px-3 rounded-full text-xs font-semibold text-[#17191C] bg-black/5 hover:bg-black/10 transition text-center"
              >
                Manage Gateways
              </button>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className="py-2.5 px-3.5 rounded-full text-xs font-semibold text-cyan-950 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 transition flex items-center justify-center gap-1.5 shadow-xs"
                title="Launch Bedside Terminal"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-700" />
                <span>Bedside</span>
              </a>
              <button
                type="button"
                onClick={onOpenChordsVisualizer}
                className="py-2.5 px-3.5 rounded-full text-xs font-semibold text-white bg-[#081B26] hover:bg-[#0E2A3A] border border-cyan-500/25 shadow-xs transition flex items-center justify-center gap-1.5"
                title="Open live bio-potential waveforms in Chords Studio"
              >
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Chords</span>
              </button>
            </div>
          </div>
        </GlassTiltCard>

      </div>

    
      {/* MIDDLE SECTION: Recent Clinical Activity (Crisp Glass Card) */}
      <div className="bg-white/85 backdrop-blur-md border border-white/80 rounded-3xl p-6 sm:p-7 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-black/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-[#151719] text-white flex items-center justify-center shadow-xs">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-heading font-bold text-base text-[#17191C]">
                Recent Clinical Activity
              </h2>
              <p className="text-xs text-[#686D73]">
                Latest patient assistance requests and status transitions
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("calls")}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#17191C] hover:underline"
          >
            <span>View All Calls</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Call Items Feed */}
        <div className="mt-4 divide-y divide-black/5">
          {recentCalls.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#8E9298]">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
              No clinical calls recorded during this shift. Ward operational desk is in standby.
            </div>
          ) : (
            recentCalls.map((req) => {
              const isResolved = req.status === "RESOLVED";
              const isEmergency = Boolean(req.alarm);
              const label = req.displayLabel || req.label || req.action.replace(/_/g, " ");

              return (
                <div key={req._id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isEmergency
                          ? "bg-rose-500 text-white animate-pulse"
                          : isResolved
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-[#151719] text-white"
                      }`}
                    >
                      {isResolved ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-bold text-sm text-[#17191C] truncate">
                          {label}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-black/5 text-[#17191C] shrink-0">
                          Bed {req.patient?.bedLabel || "Active"}
                        </span>
                      </div>
                      <div className="text-xs text-[#686D73] truncate mt-0.5">
                        <span>{req.patient?.displayName || "Patient"}</span>
                        <span className="mx-1.5 text-slate-300">&bull;</span>
                        <span className="font-mono text-[11px] text-[#8E9298]">
                          {new Date(req.updatedAt || req.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase shrink-0 ${
                      isEmergency
                        ? "bg-rose-600 text-white"
                        : req.status === "NEW"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : req.status === "ACKNOWLEDGED"
                        ? "bg-teal-100 text-teal-900 border border-teal-300"
                        : req.status === "IN_PROGRESS"
                        ? "bg-purple-100 text-purple-900 border border-purple-300"
                        : "bg-emerald-100 text-emerald-900"
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* BOTTOM SECTION: Connected Hardware Gateways (High-contrast Glassmorphic Cards) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-xs font-mono font-bold tracking-wider uppercase text-[#686D73]">
            Connected Hardware Gateways ({onlineDevices}/{devices.length} Online)
          </h3>
          <button
            type="button"
            onClick={() => navigate("devices")}
            className="text-xs font-semibold text-[#17191C] hover:underline"
          >
            All Gateways &rarr;
          </button>
        </div>

        {devices.length === 0 ? (
          <div className="bg-white/80 backdrop-blur-md border border-white/80 rounded-2xl p-6 text-center text-xs text-[#686D73] shadow-md">
            <Radio className="w-6 h-6 text-[#92979D] mx-auto mb-2 opacity-60" />
            No hardware gateways registered yet. Click &quot;Pair BLE&quot; to provision an ESP32 sensor.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {devices.slice(0, 6).map((dev) => {
              const isOnline = dev.connectivityStatus === "ONLINE";
              const isAssigned = Boolean(dev.status === "ASSIGNED" || dev.currentAssignment);

              return (
                <div
                  key={dev._id}
                  onClick={() => navigate("devices")}
                  className="bg-white/85 backdrop-blur-md border border-white/80 rounded-2xl p-4 text-[#17191C] shadow-md flex items-center justify-between cursor-pointer hover:border-black/20 hover:shadow-lg transition active:scale-98"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isOnline
                          ? "bg-emerald-500/15 text-emerald-800 border border-emerald-500/30"
                          : "bg-black/5 text-[#8E9298] border border-black/5"
                      }`}
                    >
                      <Radio className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-heading font-bold text-sm text-[#17191C] truncate">
                        {dev.name || dev.deviceId}
                      </div>
                      <div className="text-[11px] text-[#686D73] mt-0.5 truncate">
                        {isAssigned && dev.currentAssignment?.patient ? (
                          <span>
                            Assigned:{" "}
                            <strong className="text-[#17191C] font-semibold">
                              {dev.currentAssignment.patient.displayName}
                            </strong>
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-medium">
                            Standby &bull; Available Pool
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOnline && dev.batteryLevel !== undefined && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 border border-emerald-500/20 flex items-center gap-1">
                        <Battery className="w-2.5 h-2.5" />
                        <span>{dev.batteryLevel}%</span>
                      </span>
                    )}
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                      }`}
                      title={isOnline ? "Gateway Online" : "Gateway Offline"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
