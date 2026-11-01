"use client";

import React from "react";
import {
  Radio,
  Plus,
  Bluetooth,
  Bell,
  User,
  Volume2,
  VolumeX,
  RefreshCw,
  LogOut,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "@/lib/noIcons";

export type DashboardTab = "overview" | "calls" | "patients" | "devices";

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  openCallsCount: number;
  patientsCount: number;
  devicesCount: number;
  hasUrgentCalls: boolean;
  onOpenAddPatient: () => void;
  onOpenBleModal: () => void;
  voiceSupported: boolean;
  voiceEnabled: boolean;
  onToggleVoice: () => void;
  onTestVoice?: () => void;
  onSync: () => void;
  isSyncing: boolean;
  user: {
    name: string;
    username?: string;
  };
  onLogout: () => void;
}

export function DashboardSidebar({
  activeTab,
  onSelectTab,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  openCallsCount,
  patientsCount,
  devicesCount,
  hasUrgentCalls,
  onOpenAddPatient,
  onOpenBleModal,
  voiceEnabled,
  onToggleVoice,
  onTestVoice,
  onSync,
  isSyncing,
  user,
  onLogout,
}: DashboardSidebarProps) {
  const primaryNavItems = [
    {
      id: "overview" as const,
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      id: "calls" as const,
      label: "Live Calls",
      icon: Bell,
      count: openCallsCount,
      isUrgent: hasUrgentCalls,
    },
    {
      id: "patients" as const,
      label: "Patients",
      icon: User,
      count: patientsCount,
    },
    {
      id: "devices" as const,
      label: "Gateways",
      icon: Radio,
      count: devicesCount,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 lg:hidden animate-in fade-in duration-150"
        />
      )}

      <aside
        className={`bg-white/85 backdrop-blur-md border border-white/80 flex flex-col justify-between shrink-0 transition-all duration-200 z-40 select-none shadow-xl lg:m-3.5 lg:rounded-3xl ${
          isCollapsed ? "w-[76px]" : "w-64"
        } ${
          isMobileOpen
            ? "fixed inset-y-0 left-0 z-50 shadow-2xl flex m-0 rounded-none w-72"
            : "hidden lg:flex"
        }`}
      >
        {/* Top Branding & Main Nav */}
        <div className="p-3.5 flex flex-col gap-3">
          {/* Brand Header */}
          <div className="px-2 py-1.5 flex items-center justify-between gap-2 border-b border-black/5 pb-3">
            {!isCollapsed ? (
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-9 h-9 rounded-2xl bg-[#151719] flex items-center justify-center text-white shrink-0 shadow-sm font-bold text-sm tracking-tight">
                  NV
                </div>
                <div className="overflow-hidden">
                  <span className="font-heading font-extrabold text-base tracking-tight text-[#17191C] block leading-tight">
                    Netra<span className="text-teal-700">Vaani</span>
                  </span>
                  <span className="text-[10px] font-mono text-[#686D73] font-semibold tracking-wider uppercase block">
                    Clinical Station
                  </span>
                </div>
              </div>
            ) : (
              <div className="mx-auto w-9 h-9 rounded-2xl bg-[#151719] flex items-center justify-center text-white font-bold text-sm shadow-sm">
                NV
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleCollapse}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="hidden lg:flex p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-black/5 transition"
              >
                {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>

              {onCloseMobile && (
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="lg:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-black/5 transition"
                  aria-label="Close mobile menu"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Action Pill Buttons */}
          <div className="px-1 pt-1">
            {!isCollapsed ? (
              <div className="grid grid-cols-2 gap-2">
                
                <button
                  type="button"
                  onClick={onOpenBleModal}
                  className="py-2 px-2.5 rounded-2xl text-xs font-semibold bg-white/70 hover:bg-white text-[#17191C] border border-white/80 shadow-xs flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Bluetooth className="w-3.5 h-3.5 text-teal-700" />
                  <span>Pair BLE</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenAddPatient}
                  title="Register Patient"
                  className="w-10 h-10 rounded-2xl bg-[#151719] hover:bg-black text-white flex items-center justify-center transition shadow-xs active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onOpenBleModal}
                  title="Pair BLE Device"
                  className="w-10 h-10 rounded-2xl bg-white/70 text-[#17191C] border border-white/80 hover:bg-white flex items-center justify-center transition shadow-xs active:scale-95"
                >
                  <Bluetooth className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Navigation Section */}
          <div className="mt-2 space-y-1">
            {!isCollapsed && (
              <div className="px-3 pt-1 pb-1 text-[10px] font-mono font-bold tracking-wider uppercase text-[#92979D]">
                Workspace
              </div>
            )}
            <nav className="space-y-1">
              {primaryNavItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-medium transition duration-150 group relative ${
                      isActive
                        ? "bg-[#151719] text-white font-semibold shadow-md"
                        : "text-[#686D73] hover:text-[#17191C] hover:bg-black/5"
                    } ${isCollapsed ? "justify-center px-2" : ""}`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive ? "text-white" : "text-[#8E9298] group-hover:text-[#17191C]"
                      }`}
                    />
                    {!isCollapsed && (
                      <div className="flex-1 flex items-center justify-between text-left">
                        <span>{item.label}</span>
                        {item.count !== undefined && item.count > 0 && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                              item.isUrgent
                                ? "bg-rose-500 text-white animate-pulse"
                                : isActive
                                ? "bg-white/20 text-white"
                                : "bg-black/5 text-[#17191C]"
                            }`}
                          >
                            {item.count}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Quick Links Section (Bedside Terminal) */}
          <div className="mt-3 space-y-1 border-t border-black/5 pt-3">
            {!isCollapsed ? (
              <>
                <div className="px-3 pb-1 text-[10px] font-mono font-bold tracking-wider uppercase text-[#92979D]">
                  Bedside Tools
                </div>
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-cyan-950 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition group"
                >
                  <Volume2 className="w-4 h-4 text-cyan-700 group-hover:scale-105 transition-transform" />
                  <span>Bedside Terminal</span>
                </a>
              </>
            ) : (
              <div className="flex justify-center">
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Bedside Terminal"
                  className="w-10 h-10 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 flex items-center justify-center text-cyan-800 transition active:scale-95"
                >
                  <Volume2 className="w-4 h-4" />
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Station Status & Profile Card */}
        <div className="p-3.5 border-t border-black/5 space-y-3">
          {/* Audio & Sync Pills */}
          {!isCollapsed ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs px-2 py-1.5 rounded-2xl bg-black/[0.03] border border-black/5">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-[#686D73]">
                  {voiceEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>Audio Alert</span>
                </span>
                <div className="flex items-center gap-1">
                  {onTestVoice && voiceEnabled && (
                    <button
                      type="button"
                      onClick={onTestVoice}
                      className="text-[10px] px-1.5 py-0.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-black/5"
                    >
                      Test
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onToggleVoice}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition ${
                      voiceEnabled
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-slate-200 text-slate-600"
                    }`}
                  >
                    {voiceEnabled ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-2xl text-[11px] font-medium text-[#686D73] hover:text-[#17191C] hover:bg-black/5 transition"
              >
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Station Sync</span>
                </span>
                <RefreshCw className={`w-3.5 h-3.5 text-[#92979D] ${isSyncing ? "animate-spin text-teal-700" : ""}`} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={onToggleVoice}
                title={voiceEnabled ? "Mute audio alerts" : "Unmute audio alerts"}
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-black/5 transition"
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={onSync}
                title="Sync clinical ledger"
                className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-black/5 transition"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? "animate-spin text-teal-700" : ""}`} />
              </button>
            </div>
          )}

          {/* Profile Card */}
          <div className="pt-2 border-t border-black/5">
            {!isCollapsed ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-[#151719] text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-xs">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-[#17191C] truncate">
                      {user.name}
                    </div>
                    <div className="text-[10px] text-[#92979D] font-mono truncate">
                      {user.username ? `@${user.username}` : "Staff Nurse"}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign out"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div
                  className="w-8 h-8 rounded-full bg-[#151719] text-white flex items-center justify-center text-xs font-bold"
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Sign out"
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
