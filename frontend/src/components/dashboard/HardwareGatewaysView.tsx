"use client";

import React, { useState, useMemo } from "react";
import {
  Radio,
  Bluetooth,
  Activity,
  Sliders,
  Lock,
  User,
  Search,
  Battery,
  Wifi,
  RefreshCw,
} from "@/lib/noIcons";
import { DeviceItem, apiClient } from "@/lib/api";

interface HardwareGatewaysViewProps {
  devices: DeviceItem[];
  deviceDeallocatingMap: Record<string, boolean>;
  onOpenBleCommissioning: () => void;
  onOpenChordsVisualizer: (deviceId?: string) => void;
  onEditCommands: (dev: DeviceItem) => void;
  onDeallocateDevice: (deviceId: string) => void;
  onAllocatePatient: (dev: DeviceItem) => void;
}

export const HardwareGatewaysView: React.FC<HardwareGatewaysViewProps> = ({
  devices,
  deviceDeallocatingMap,
  onOpenBleCommissioning,
  onOpenChordsVisualizer,
  onEditCommands,
  onDeallocateDevice,
  onAllocatePatient,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "ONLINE" | "AVAILABLE" | "ASSIGNED">("ALL");
  const [resettingMap, setResettingMap] = useState<Record<string, boolean>>({});

  const handleResetDefaults = async (deviceId: string) => {
    if (!window.confirm(`Reset command rules on device ${deviceId} to factory defaults?`)) return;
    setResettingMap((prev) => ({ ...prev, [deviceId]: true }));
    try {
      await apiClient.resetCommandRules(deviceId);
      window.alert(`Command rules for ${deviceId} restored to factory defaults!`);
    } catch (err: unknown) {
      window.alert(err instanceof Error ? err.message : "Failed to reset command rules");
    } finally {
      setResettingMap((prev) => ({ ...prev, [deviceId]: false }));
    }
  };

  const filteredDevices = useMemo(() => {
    return devices.filter((dev) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        dev.deviceId.toLowerCase().includes(q) ||
        (dev.name && dev.name.toLowerCase().includes(q)) ||
        (dev.hardwareId && dev.hardwareId.toLowerCase().includes(q)) ||
        (dev.currentAssignment?.patient?.displayName &&
          dev.currentAssignment.patient.displayName.toLowerCase().includes(q));

      const isOnline = dev.connectivityStatus === "ONLINE";
      const isAssigned = Boolean(dev.status === "ASSIGNED" || dev.currentAssignment);
      const isAvailable = dev.status === "AVAILABLE" && !dev.currentAssignment;

      let matchesFilter = true;
      if (filterMode === "ONLINE") matchesFilter = isOnline;
      if (filterMode === "AVAILABLE") matchesFilter = isAvailable;
      if (filterMode === "ASSIGNED") matchesFilter = isAssigned;

      return matchesSearch && matchesFilter;
    });
  }, [devices, searchQuery, filterMode]);

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.connectivityStatus === "ONLINE").length;
    const assigned = devices.filter((d) => d.status === "ASSIGNED" || d.currentAssignment).length;
    const available = devices.filter((d) => d.status === "AVAILABLE" && !d.currentAssignment).length;
    return { total, online, assigned, available };
  }, [devices]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* Header and Commission Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/70 backdrop-blur-md border border-white/80 rounded-3xl p-4 sm:p-5 shadow-xl">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-2xl bg-[#151719] text-white flex items-center justify-center">
              <Radio className="w-4 h-4" />
            </span>
            <h2 className="font-heading font-extrabold text-lg sm:text-xl text-[#17191C] tracking-tight">
              Hardware Gateways &amp; Telemetry
            </h2>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-black/5 text-[#17191C]">
              {stats.online}/{stats.total} Online
            </span>
          </div>
          <p className="text-xs text-[#686D73] mt-1">
            Strict 1-to-1 patient allocation &bull; BLE Web Bluetooth provisioning &bull; Real-time battery &bull; Command rules
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-[#92979D] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search device, HW ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-full bg-white/80 border border-white/80 text-[#17191C] placeholder-[#92979D] focus:outline-none focus:bg-white focus:ring-1 focus:ring-black shadow-xs transition"
            />
          </div>

          {(["ALL", "ONLINE", "AVAILABLE", "ASSIGNED"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`px-4 py-2 rounded-full text-xs font-semibold transition shadow-xs active:scale-95 ${
                filterMode === mode
                  ? "bg-[#151719] text-white shadow-md"
                  : "bg-white/80 text-[#686D73] border border-white/80 hover:text-[#17191C] hover:bg-white"
              }`}
            >
              {mode === "ALL"
                ? "All"
                : mode === "ONLINE"
                ? "Online"
                : mode === "AVAILABLE"
                ? "Available"
                : "Allocated"}
            </button>
          ))}

          <button
            type="button"
            onClick={onOpenBleCommissioning}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[#151719] hover:bg-black text-white transition shadow-xs active:scale-95"
          >
            <Bluetooth className="w-3.5 h-3.5" />
            <span>Pair BLE</span>
          </button>
        </div>
      </div>

      {/* Quick Status Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-md">
          <div className="text-[10px] font-mono font-bold text-[#8E9298] uppercase tracking-wider">Total Registered</div>
          <div className="text-2xl font-heading font-extrabold text-[#17191C] mt-1">{stats.total}</div>
        </div>
        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-md">
          <div className="text-[10px] font-mono font-bold text-emerald-600 uppercase tracking-wider">Online Gateways</div>
          <div className="text-2xl font-heading font-extrabold text-emerald-700 mt-1">{stats.online}</div>
        </div>
        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-md">
          <div className="text-[10px] font-mono font-bold text-teal-700 uppercase tracking-wider">Allocated Patients</div>
          <div className="text-2xl font-heading font-extrabold text-[#17191C] mt-1">{stats.assigned}</div>
        </div>
        <div className="bg-white border border-black/5 rounded-2xl p-4 shadow-md">
          <div className="text-[10px] font-mono font-bold text-[#686D73] uppercase tracking-wider">Standby Pool</div>
          <div className="text-2xl font-heading font-extrabold text-[#17191C] mt-1">{stats.available}</div>
        </div>
      </div>

      {/* Device Registry Table / Cards */}
      <div className="bg-white border border-black/5 rounded-3xl overflow-hidden shadow-xl">
        {filteredDevices.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-black/5 text-[#8E9298] flex items-center justify-center mx-auto">
              <Radio className="w-6 h-6" />
            </div>
            <div className="text-sm font-heading font-bold text-[#17191C]">No devices found</div>
            <p className="text-xs text-[#686D73] max-w-sm mx-auto">
              {searchQuery
                ? `No devices matched "${searchQuery}".`
                : "No NPG devices registered yet. Commission a device via Web Bluetooth to begin."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-black/5">
            {filteredDevices.map((dev) => {
              const isOnline = dev.connectivityStatus === "ONLINE";
              const isAssigned = Boolean(dev.status === "ASSIGNED" || dev.currentAssignment);
              const isAvailable = dev.status === "AVAILABLE" && !dev.currentAssignment;

              return (
                <div
                  key={dev._id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/70 transition"
                >
                  {/* Left: Device Info */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-2xl border flex items-center justify-center shrink-0 ${
                        isOnline
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : "bg-black/5 text-[#8E9298] border-black/5"
                      }`}
                    >
                      <Radio className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-extrabold text-sm text-[#17191C]">
                          {dev.name || dev.deviceId}
                        </span>
                        <span className="font-mono text-xs text-[#8E9298]">
                          ({dev.deviceId})
                        </span>
                        {dev.hardwareId && (
                          <span className="font-mono text-[10px] text-[#686D73] bg-black/5 px-2 py-0.5 rounded-full">
                            HW: {dev.hardwareId}
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-[#686D73] mt-1 flex items-center gap-2">
                        {isAssigned && dev.currentAssignment?.patient ? (
                          <span>
                            Allocated to:{" "}
                            <strong className="text-[#17191C] font-semibold">
                              {dev.currentAssignment.patient.displayName}
                            </strong>{" "}
                            <span className="font-mono text-[#8E9298]">
                              ({dev.currentAssignment.patient.patientCode})
                            </span>
                          </span>
                        ) : (
                          <span className="text-[#8E9298] italic">Unassigned &bull; Standby Pool</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Badges & Actions */}
                  <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                    {/* Online / Offline status */}
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider inline-flex items-center gap-1.5 ${
                        isOnline
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-black/5 text-[#8E9298] border border-black/5"
                      }`}
                    >
                      <Wifi className="w-3 h-3" />
                      <span>{isOnline ? "ONLINE" : "OFFLINE"}</span>
                    </span>

                    {/* Battery indicator */}
                    {isOnline && dev.batteryLevel !== undefined && dev.batteryLevel !== null && (
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider inline-flex items-center gap-1.5 ${
                          dev.batteryLevel > 50
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : dev.batteryLevel > 20
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-rose-50 text-rose-800 border border-rose-200"
                        }`}
                        title={`Device Battery: ${dev.batteryLevel}%`}
                      >
                        <Battery className="w-3 h-3" />
                        <span>{dev.batteryLevel}%</span>
                      </span>
                    )}

                    {/* Allocation Status Badge */}
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider ${
                        isAvailable
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : isAssigned
                          ? "bg-black/5 text-[#17191C] border border-black/5"
                          : "bg-rose-50 text-rose-800 border border-rose-200"
                      }`}
                    >
                      {dev.status}
                    </span>

                    {/* Signals button */}
                    <button
                      type="button"
                      onClick={() => onOpenChordsVisualizer(dev.deviceId)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-[#17191C] bg-black/5 hover:bg-black/10 transition active:scale-95"
                      title="Inspect live biopotential signals in Chords studio"
                    >
                      <Activity className="w-3.5 h-3.5 text-teal-700" />
                      <span>Signals</span>
                    </button>

                    {/* Edit Commands Button */}
                    {isOnline ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onEditCommands(dev)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black transition shadow-xs active:scale-95"
                          title="Calibrate gesture thresholds and command rules"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Edit Commands</span>
                        </button>

                        <button
                          type="button"
                          disabled={resettingMap[dev.deviceId]}
                          onClick={() => handleResetDefaults(dev.deviceId)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-xs active:scale-95 disabled:opacity-50"
                          title="Restore factory default command rules"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${resettingMap[dev.deviceId] ? "animate-spin text-teal-600" : ""}`} />
                          <span>{resettingMap[dev.deviceId] ? "Resetting..." : "Reset Defaults"}</span>
                        </button>
                      </>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium text-[#92979D] bg-black/[0.03] border border-black/5 cursor-not-allowed select-none"
                        title="Device is offline — Commands locked until device connects"
                      >
                        <Lock className="w-3 h-3 text-[#92979D]" />
                        <span>Locked</span>
                      </span>
                    )}

                    {/* Allocate / Unassign button */}
                    {isAssigned ? (
                      <button
                        type="button"
                        disabled={deviceDeallocatingMap[dev.deviceId]}
                        onClick={() => onDeallocateDevice(dev.deviceId)}
                        className="px-3.5 py-1.5 rounded-full text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-md shadow-red-600/20 disabled:opacity-60 active:scale-95"
                      >
                        {deviceDeallocatingMap[dev.deviceId] ? "Releasing..." : "Unassign"}
                      </button>
                    ) : isOnline ? (
                      <button
                        type="button"
                        onClick={() => onAllocatePatient(dev)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black transition shadow-xs active:scale-95"
                        title="Allocate this gateway to a patient"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>Allocate Patient</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
