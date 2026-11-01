"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Volume2, ArrowRight, CheckCircle2 } from "@/lib/noIcons";

export default function BedsideAudioRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/");
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen glass-canvas flex items-center justify-center p-6 text-[#17191C] font-sans antialiased">
      <div className="max-w-md w-full bg-white/90 backdrop-blur-md border border-white/80 rounded-3xl p-8 shadow-2xl text-center space-y-5 animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-3xl bg-[#081B26] text-cyan-400 flex items-center justify-center mx-auto shadow-lg border border-cyan-500/30">
          <Volume2 className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-cyan-500/15 text-cyan-950 border border-cyan-500/30 uppercase">
            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-700" />
            <span>Audio & Voice Unified</span>
          </div>
          <h1 className="text-xl font-heading font-extrabold text-[#0B1E28] tracking-tight">
            Bedside Audio Moved to Patient Dashboard
          </h1>
          <p className="text-xs text-[#686D73] leading-relaxed">
            All bedside voice announcements, chimes, microphone speech recognition, and gesture confirmations are now integrated directly inside the main <strong>Patient Bedside Terminal</strong>.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-3 px-5 rounded-2xl bg-[#081B26] hover:bg-[#0E2A3A] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md transition active:scale-98"
          >
            <span>Proceed to Bedside Terminal</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-[11px] font-mono text-slate-400">
          Redirecting automatically to Patient Terminal...
        </p>
      </div>
    </div>
  );
}
