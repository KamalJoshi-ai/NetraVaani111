"use client";

import React, { useEffect, useRef } from "react";
import { initLandingPage } from "./initLandingPage";
import { LANDING_HTML } from "./landingHtml";
import "./landing.css";

interface LandingViewProps {
  onOpenAuth?: (mode: "login" | "signup", role?: "patient" | "nurse") => void;
}

export default function LandingView({ onOpenAuth }: LandingViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = LANDING_HTML;
    const cleanup = initLandingPage(onOpenAuth);
    return () => {
      cleanup();
    };
  }, [onOpenAuth]);

  return <div ref={containerRef} className="landing-root" />;
}
