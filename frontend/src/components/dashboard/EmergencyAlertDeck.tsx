"use client";

import React from "react";
import { CareRequestItem } from "@/lib/api";
import { AlertTriangle, Clock, Check } from "@/lib/noIcons";

interface EmergencyAlertDeckProps {
  emergencies?: CareRequestItem[];
  emergencyCalls?: CareRequestItem[];
  onAcknowledge: (req: CareRequestItem) => void;
  onSelectPatient?: (patientKey: string) => void;
  onSelectPatientGroup?: (patientKey: string) => void;
}

export function EmergencyAlertDeck({
  emergencies,
  emergencyCalls,
  onAcknowledge,
  onSelectPatient,
  onSelectPatientGroup,
}: EmergencyAlertDeckProps) {
  const list = emergencies || emergencyCalls || [];
  if (!list || list.length === 0) return null;
  const selectHandler = onSelectPatientGroup || onSelectPatient;

  return (
    <div className="mb-6 space-y-3 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto animate-in fade-in duration-200">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping shrink-0" />
          <h2 className="text-xs font-bold font-mono tracking-wider text-red-600 uppercase">
            Critical Emergency Alarms ({list.length})
          </h2>
        </div>
        <span className="text-[11px] text-red-600 font-semibold">Immediate bedside response required</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {list.map((emg) => {
          const ptName = emg.patient?.displayName || "Unknown Patient";
          const bed = emg.patient?.bedLabel || emg.device?.deviceId || "Bed Area";
          const isPending = emg.status === "NEW";

          return (
            <div
              key={emg._id}
              className="bg-[#151719] border border-red-500/40 rounded-3xl p-5 shadow-xl flex flex-col justify-between gap-4 text-white relative overflow-hidden"
            >
              {/* Subtle ambient red background blur behind card */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-red-600 text-white flex items-center justify-center font-bold shrink-0 shadow-md shadow-red-600/30">
                    <AlertTriangle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-heading font-extrabold text-base tracking-tight text-white">
                        {emg.displayLabel || emg.label || emg.action}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-red-500/20 text-red-300 border border-red-500/30">
                        BED {bed}
                      </span>
                    </div>
                    <div className="text-xs font-medium text-slate-300 mt-0.5">
                      {ptName} <span className="font-mono text-slate-400">({emg.patient?.patientCode || "Pt Code"})</span>
                    </div>
                  </div>
                </div>

                <div className="text-right font-mono text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                  <Clock className="w-3.5 h-3.5 text-red-400" />
                  <span>
                    {new Date(emg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs relative z-10">
                <span className="font-mono text-[11px] font-semibold text-red-400">
                  Status: {emg.status}
                </span>

                <div className="flex items-center gap-2">
                  {selectHandler && emg.patient && (
                    <button
                      type="button"
                      onClick={() => selectHandler(emg.patient?.patientCode || "")}
                      className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition"
                    >
                      View Patient &rarr;
                    </button>
                  )}
                  {isPending && (
                    <button
                      type="button"
                      onClick={() => onAcknowledge(emg)}
                      className="px-4 py-2 rounded-full text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition shadow-lg shadow-red-600/30 flex items-center gap-1.5 active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge Alarm</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
