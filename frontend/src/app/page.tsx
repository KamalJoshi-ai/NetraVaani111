"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { useAuth } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import NurseDashboardPage from "./nurse/page";
import PatientBedsideView from "@/components/PatientBedsideView";

const LandingView = dynamic(() => import("@/components/landing/LandingView"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen glass-canvas flex items-center justify-center p-6 text-[#17191C]">
      <div className="flex items-center gap-3 bg-white border border-slate-300 rounded-lg px-4 py-3 shadow-xs">
        <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
        <span className="text-xs font-semibold text-slate-900">
          Loading NetraVaani...
        </span>
      </div>
    </div>
  ),
});

export default function Home() {
  const { user, loading } = useAuth();
  const [authView, setAuthView] = useState<{
    mode: "login" | "signup";
    role?: "patient" | "nurse";
  } | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen glass-canvas flex items-center justify-center p-6 text-[#17191C]">
        <div className="flex items-center gap-3 bg-white border border-slate-300 rounded-lg px-4 py-3 shadow-xs">
          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
          <span className="text-xs font-semibold text-slate-900">
            Connecting to NetraVaani...
          </span>
        </div>
      </div>
    );
  }

  // 1. Authenticated Users route directly to their dedicated role workspace
  if (user) {
    if (user.role === "patient") {
      return <PatientBedsideView />;
    }
    return <NurseDashboardPage />;
  }

  // 2. Auth Flow: If visitor clicked "Become a Member" or "Sign In"
  if (authView) {
    return (
      <LoginForm
        initialMode={authView.mode}
        initialRole={authView.role}
        onBackToLanding={() => setAuthView(null)}
      />
    );
  }

  // 3. Public Marketing: Integrated 3D Landing Page
  const handleOpenAuth = (mode: "login" | "signup", role?: "patient" | "nurse") => {
    setAuthView({ mode, role });
  };

  return <LandingView onOpenAuth={handleOpenAuth} />;
}
