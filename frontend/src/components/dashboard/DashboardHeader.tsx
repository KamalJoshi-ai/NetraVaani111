"use client";

import React from "react";
import { Menu, Activity, Volume2 } from "@/lib/noIcons";

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  activeTab?: "overview" | "calls" | "patients" | "devices";
  onOpenMobileMenu: () => void;
  onOpenChordsVisualizer: () => void;
  onlineDevicesCount: number;
}

export function DashboardHeader({
  title,
  subtitle,
  activeTab = "overview",
  onOpenMobileMenu,
  onOpenChordsVisualizer,
  onlineDevicesCount,
}: DashboardHeaderProps) {
  const displayTitle =
    title ||
    (activeTab === "overview"
      ? "Ward Overview"
      : activeTab === "calls"
      ? "Live Clinical Calls"
      : activeTab === "patients"
      ? "Patient Registry"
      : "Hardware Gateways");

  const displaySubtitle = subtitle || "Clinical Station Desk \u2022 Real-time Telemetry";

  const currentDate = new Date().toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <header className="sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-4 transition-colors">
      <div className="flex items-center justify-between gap-4 max-w-[1400px] mx-auto">
        {/* Left: Mobile hamburger & Greeting Header (Matches "Hi, User!" in reference image) */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden w-10 h-10 rounded-full bg-white/70 backdrop-blur-md border border-white/80 flex items-center justify-center text-[#17191C] shadow-xs active:scale-95 transition"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div>
            <h1 className="font-heading font-extrabold text-xl sm:text-2xl text-[#17191C] tracking-tight">
              {displayTitle}
            </h1>
            <p className="text-xs text-[#686D73] flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>{displaySubtitle} &bull; {currentDate}</span>
            </p>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2.5">
          {/* Bedside Terminal Pill Button (Integrated Voice & Gestures) */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-950 border border-cyan-500/30 shadow-xs transition active:scale-95"
            title="Open Bedside Terminal (Integrated Voice & Gestures)"
          >
            <Volume2 className="w-4 h-4 text-cyan-700" />
            <span className="hidden sm:inline">Bedside Terminal</span>
          </a>

          {/* Cyan/Dark Pill Button: "+ Chords Studio" */}
          <button
            type="button"
            onClick={onOpenChordsVisualizer}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-[#081B26] hover:bg-[#0E2A3A] text-white border border-cyan-500/20 shadow-xs transition active:scale-95"
            title="Launch Chords Bio-Potential Waveform Visualizer"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Chords Studio</span>
            <span className="sm:hidden">Signals</span>
            {onlineDevicesCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shrink-0" />
            )}
          </button>

          {/* Circular Glass Pill: Telemetry Health */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/80 text-[11px] font-mono font-semibold text-[#17191C] shadow-xs"
            title={`${onlineDevicesCount} hardware gateways connected`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{onlineDevicesCount} Online</span>
          </div>
        </div>
      </div>
    </header>
  );
}
