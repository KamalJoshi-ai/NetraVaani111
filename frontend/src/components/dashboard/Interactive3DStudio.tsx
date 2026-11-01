"use client";

import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { BedItem, PatientItem, DeviceItem } from "@/lib/api";
import {
  Activity,
  Bed,
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  RotateCw,
  Eye,
  Hand,
  AlertTriangle,
  CheckCircle2,
} from "@/lib/noIcons";

// Web Audio API Sound Synthesizer for Fun Clinical Feedback
class FunAudioSynthesizer {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  playChime(type: "yes" | "water" | "no" | "emergency" | "zen" | "click") {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      if (type === "yes") {
        // High pleasant ascending two-tone
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "water") {
        // Bubbling harmonic droplet sound
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.08);
        osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.2);
        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === "no") {
        // Soft descending tone
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.15);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      } else if (type === "emergency") {
        // Urgent dual pulse
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "zen") {
        // Warm harmonic chord swell
        osc.type = "sine";
        osc.frequency.setValueAtTime(528, now); // Solfeggio 528Hz Love/DNA frequency
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
        osc.start(now);
        osc.stop(now + 0.8);
      } else {
        // Gentle click
        osc.type = "sine";
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
      }
    } catch {
      // Audio context might be restricted before interaction
    }
  }
}

const soundSynth = new FunAudioSynthesizer();

interface Interactive3DStudioProps {
  beds: BedItem[];
  patients: PatientItem[];
  devices: DeviceItem[];
  openCallsCount?: number;
  emergencyCount?: number;
  onSelectBed?: (bedLabel: string) => void;
}

export function Interactive3DStudio({
  beds,
  patients = [],
  devices,
  emergencyCount = 0,
  onSelectBed,
}: Interactive3DStudioProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeMode, setActiveMode] = useState<"ward3d" | "sphere3d" | "simulator">("ward3d");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [simFeedback, setSimFeedback] = useState<{
    text: string;
    gesture: string;
    latency: number;
    confidence: number;
    color: string;
  } | null>(null);
  const [zenCount, setZenCount] = useState<number>(0);

  // Toggle sound
  const handleToggleSound = () => {
    void patients;
    void onSelectBed;
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundSynth.enabled = next;
    if (next) soundSynth.playChime("click");
  };

  // Fun gesture simulator trigger
  const handleSimulateGesture = (gesture: "yes" | "water" | "no" | "emergency") => {
    let text = "";
    const latency = Math.floor(28 + Math.random() * 20);
    const confidence = +(98.5 + Math.random() * 1.4).toFixed(1);
    let color = "text-cyan-700 bg-cyan-50 border-cyan-300";

    if (gesture === "yes") {
      text = "3x EOG Ocular Blinks detected -> Handshake YES validated (Ledger Clean)";
      color = "text-cyan-800 bg-cyan-500/15 border-cyan-500/30";
      soundSynth.playChime("yes");
    } else if (gesture === "water") {
      text = "5x Rapid Blinks detected -> WATER assistance dispatch signal dispatched";
      color = "text-blue-800 bg-blue-500/15 border-blue-500/30";
      soundSynth.playChime("water");
    } else if (gesture === "no") {
      text = "Left Forearm EMG micro-squeeze detected -> Handshake NO calibrated";
      color = "text-amber-800 bg-amber-500/15 border-amber-500/30";
      soundSynth.playChime("no");
    } else if (gesture === "emergency") {
      text = "Bilateral EMG Squeeze detected -> EMERGENCY ALARM BYPASS TRIGGERED!";
      color = "text-rose-800 bg-rose-500/15 border-rose-500/30";
      soundSynth.playChime("emergency");
    }

    setSimFeedback({ text, gesture: gesture.toUpperCase(), latency, confidence, color });

    // Auto-clear feedback after 4 seconds
    setTimeout(() => {
      setSimFeedback((prev) => (prev?.gesture === gesture.toUpperCase() ? null : prev));
    }, 4500);
  };

  // Fun Zen Mood Trigger
  const handleZenPulse = () => {
    soundSynth.playChime("zen");
    setZenCount((c) => c + 1);
  };

  // THREE.JS SCENE SETUP & ANIMATION LOOP
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animationFrameId: number;
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf4f5f7, 0.035);

    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 320;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 8, 14);
    camera.lookAt(0, 0.5, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0x06b6d4, 1.2); // Cyan accent
    dirLight.position.set(5, 12, 8);
    scene.add(dirLight);

    const fillLight = new THREE.PointLight(0x10b981, 0.8, 20); // Emerald fill
    fillLight.position.set(-6, 4, -4);
    scene.add(fillLight);

    // 3. Root Group for Rotation
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Mode-specific meshes
    const bedMeshes: THREE.Group[] = [];
    let particleSphere: THREE.Points | null = null;
    let gridHelper: THREE.GridHelper | null = null;

    if (activeMode === "ward3d") {
      // Sleek Glassmorphic 3D Ward Grid
      gridHelper = new THREE.GridHelper(16, 16, 0x06b6d4, 0xd1d5db);
      gridHelper.position.y = -0.01;
      worldGroup.add(gridHelper);

      // Create 3D Bed Pods
      const bedItems: BedItem[] = beds.length > 0 ? beds : [
        { _id: "b1", bedNumber: "ICU-01", status: "OCCUPIED" },
        { _id: "b2", bedNumber: "ICU-02", status: "AVAILABLE" },
        { _id: "b3", bedNumber: "ICU-03", status: "AVAILABLE" },
        { _id: "b4", bedNumber: "ICU-04", status: "AVAILABLE" },
      ];

      const cols = 3;
      const spacingX = 3.6;
      const spacingZ = 3.2;

      bedItems.forEach((bed, idx) => {
        const bedGroup = new THREE.Group();
        const row = Math.floor(idx / cols);
        const col = idx % cols;
        const totalRows = Math.ceil(bedItems.length / cols);

        const posX = (col - (cols - 1) / 2) * spacingX;
        const posZ = (row - (totalRows - 1) / 2) * spacingZ;
        bedGroup.position.set(posX, 0, posZ);
        bedGroup.userData = { bedLabel: bed.bedNumber, status: bed.status };

        // Bed Base (Matte dark/glass pedestal)
        const baseGeo = new THREE.BoxGeometry(2.2, 0.4, 1.4);
        const baseMat = new THREE.MeshStandardMaterial({
          color: 0x1f2937,
          roughness: 0.3,
          metalness: 0.2,
        });
        const baseMesh = new THREE.Mesh(baseGeo, baseMat);
        baseMesh.position.y = 0.2;
        bedGroup.add(baseMesh);

        // Mattress / Patient Surface (Cyan / White glow)
        const matGeo = new THREE.BoxGeometry(2.0, 0.2, 1.25);
        const isOccupied = bed.status === "OCCUPIED";
        const isEmergency = emergencyCount > 0 && idx === 0;

        const matMat = new THREE.MeshStandardMaterial({
          color: isEmergency ? 0xf43f5e : isOccupied ? 0x10b981 : 0x06b6d4,
          emissive: isEmergency ? 0xe11d48 : isOccupied ? 0x059669 : 0x0891b2,
          emissiveIntensity: 0.35,
          roughness: 0.2,
        });
        const matMesh = new THREE.Mesh(matGeo, matMat);
        matMesh.position.y = 0.5;
        bedGroup.add(matMesh);

        // Pillow / Headboard
        const pillowGeo = new THREE.BoxGeometry(0.4, 0.15, 0.8);
        const pillowMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
        const pillowMesh = new THREE.Mesh(pillowGeo, pillowMat);
        pillowMesh.position.set(-0.7, 0.65, 0);
        bedGroup.add(pillowMesh);

        // Floating 3D Holographic Status Beacon Ring
        const ringGeo = new THREE.TorusGeometry(0.5, 0.04, 16, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: isEmergency ? 0xf43f5e : isOccupied ? 0x10b981 : 0x06b6d4,
          wireframe: true,
        });
        const ringMesh = new THREE.Mesh(ringGeo, ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 1.3;
        ringMesh.name = "statusRing";
        bedGroup.add(ringMesh);

        worldGroup.add(bedGroup);
        bedMeshes.push(bedGroup);
      });
    } else if (activeMode === "sphere3d") {
      // 3D Bio-Potential Holographic Neural Sphere
      const sphereGeo = new THREE.SphereGeometry(3.5, 36, 36);
      const posArray = sphereGeo.attributes.position.array as Float32Array;
      const count = posArray.length / 3;

      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // Cyan to emerald gradient
        colors[i * 3] = 0.02 + Math.random() * 0.1; // R
        colors[i * 3 + 1] = 0.7 + Math.random() * 0.3; // G
        colors[i * 3 + 2] = 0.8 + Math.random() * 0.2; // B
      }
      sphereGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const pointMat = new THREE.PointsMaterial({
        size: 0.12,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      });

      particleSphere = new THREE.Points(sphereGeo, pointMat);
      worldGroup.add(particleSphere);

      // Inner wireframe shell
      const innerGeo = new THREE.IcosahedronGeometry(2.4, 2);
      const innerMat = new THREE.MeshBasicMaterial({
        color: 0x0891b2,
        wireframe: true,
        transparent: true,
        opacity: 0.25,
      });
      const innerMesh = new THREE.Mesh(innerGeo, innerMat);
      worldGroup.add(innerMesh);
    }

    // 4. Mouse / Touch Orbit Controls
    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      worldGroup.rotation.y += deltaX * 0.007;
      camera.position.y = Math.max(3, Math.min(14, camera.position.y - deltaY * 0.03));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    // 5. Animation Render Loop
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Gentle auto-rotation
      if (autoRotate && !isDragging) {
        worldGroup.rotation.y += 0.0035;
      }

      // Animate 3D status beacon rings
      bedMeshes.forEach((bg, i) => {
        const ring = bg.getObjectByName("statusRing");
        if (ring) {
          ring.rotation.z += 0.02;
          ring.position.y = 1.3 + Math.sin(elapsedTime * 2.5 + i) * 0.12;
        }
      });

      // Animate Bio-Sphere Particles
      if (particleSphere) {
        particleSphere.rotation.y = elapsedTime * 0.12;
        particleSphere.rotation.x = Math.sin(elapsedTime * 0.2) * 0.15;
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!canvas) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
    };
  }, [activeMode, autoRotate, beds, emergencyCount]);

  return (
    <div className="bg-white/85 backdrop-blur-md border border-white/80 rounded-3xl p-5 sm:p-7 shadow-xl space-y-5 transition-all">
      {/* HEADER BAR: Title, Mode Tabs, Audio & Rotate Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-black/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#081B26] text-cyan-400 flex items-center justify-center shadow-xs">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading font-bold text-base text-[#17191C]">
                3D Clinical Spatial Studio &amp; Biosensor Deck
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-900 border border-cyan-500/30">
                WEBGL 3D
              </span>
            </div>
            <p className="text-xs text-[#686D73]">
              Interactive 3D isometric ward spatial map, neural bio-potential orb &amp; gesture simulator
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="bg-black/5 p-1 rounded-full flex items-center gap-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveMode("ward3d");
                soundSynth.playChime("click");
              }}
              className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 ${
                activeMode === "ward3d"
                  ? "bg-white text-[#17191C] shadow-xs"
                  : "text-[#686D73] hover:text-[#17191C]"
              }`}
            >
              <Bed className="w-3.5 h-3.5 text-cyan-600" />
              <span>3D Ward Map</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode("sphere3d");
                soundSynth.playChime("click");
              }}
              className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 ${
                activeMode === "sphere3d"
                  ? "bg-white text-[#17191C] shadow-xs"
                  : "text-[#686D73] hover:text-[#17191C]"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bio-Sphere</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMode("simulator");
                soundSynth.playChime("click");
              }}
              className={`px-3 py-1.5 rounded-full transition flex items-center gap-1.5 ${
                activeMode === "simulator"
                  ? "bg-white text-[#17191C] shadow-xs"
                  : "text-[#686D73] hover:text-[#17191C]"
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-600" />
              <span>Gesture Dock</span>
            </button>
          </div>

          {/* Sound FX Toggle */}
          <button
            type="button"
            onClick={handleToggleSound}
            className={`p-2 rounded-full border text-xs font-medium transition ${
              soundEnabled
                ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-900"
                : "bg-black/5 border-transparent text-[#686D73]"
            }`}
            title={soundEnabled ? "Mute Clinical Sound Effects" : "Enable Sound Effects"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Auto-Rotate 3D Toggle */}
          <button
            type="button"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-full border text-xs font-medium transition ${
              autoRotate
                ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-900"
                : "bg-black/5 border-transparent text-[#686D73]"
            }`}
            title={autoRotate ? "Pause 3D Rotation" : "Resume 3D Rotation"}
          >
            <RotateCw className={`w-4 h-4 ${autoRotate ? "animate-spin" : ""}`} style={{ animationDuration: "12s" }} />
          </button>
        </div>
      </div>

      {/* 3D STAGE & INTERACTIVE PLAYGROUND */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* 3D WebGL Canvas Container (Col 8) */}
        <div className="lg:col-span-8 relative min-h-[300px] sm:min-h-[340px] rounded-2xl bg-gradient-to-b from-[#E8EAED]/50 to-[#F1F3F5]/80 border border-black/5 overflow-hidden flex items-center justify-center shadow-inner">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-grab active:cursor-grabbing block"
          />

          {/* Canvas Floating Overlay Controls */}
          <div className="absolute top-3 left-3 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/90 text-[11px] font-mono text-[#686D73] shadow-xs flex items-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Click &amp; Drag to Orbit in 3D</span>
          </div>

          {/* Mode Badge indicator */}
          <div className="absolute bottom-3 left-3 bg-[#081B26]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-cyan-500/30 text-[11px] font-mono text-cyan-300 shadow-lg flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {activeMode === "ward3d"
                ? `Ward Spatial Map • ${beds.length} Monitored Pods`
                : activeMode === "sphere3d"
                ? "Neural Biopotential Mesh • 60fps WebGL"
                : "Virtual Gesture Edge Classifier"}
            </span>
          </div>

          {/* Quick Reset View Button */}
          <button
            type="button"
            onClick={() => {
              setAutoRotate(true);
              soundSynth.playChime("click");
            }}
            className="absolute top-3 right-3 bg-white/80 hover:bg-white backdrop-blur-md p-2 rounded-full border border-black/5 text-[#17191C] shadow-xs transition"
            title="Reset 3D Perspective"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right Dock: Interactive Fun Gesture Simulator & Ward Vibe Deck (Col 4) */}
        <div className="lg:col-span-4 flex flex-col justify-between space-y-4">
          
          {/* GESTURE TESTER DOCK */}
          <div className="p-4 rounded-2xl bg-black/[0.02] border border-black/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-heading font-bold text-[#17191C] flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-cyan-600" />
                <span>Simulate Bio-Gesture</span>
              </span>
              <span className="text-[10px] font-mono text-[#8E9298]">Instant Edge Test</span>
            </div>
            <p className="text-[11px] text-[#686D73]">
              Test how NetraVaani classifies biopotential signals with micro-sound cues:
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSimulateGesture("yes")}
                className="p-2.5 rounded-xl bg-white border border-black/5 hover:border-cyan-500/40 hover:bg-cyan-50/30 transition text-left shadow-xs group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#17191C] group-hover:text-cyan-700">3x Blink</span>
                  <Eye className="w-3.5 h-3.5 text-cyan-600" />
                </div>
                <span className="text-[10px] font-mono font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">
                  YES Handshake
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSimulateGesture("water")}
                className="p-2.5 rounded-xl bg-white border border-black/5 hover:border-blue-500/40 hover:bg-blue-50/30 transition text-left shadow-xs group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#17191C] group-hover:text-blue-700">5x Blink</span>
                  <span className="text-xs">💧</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                  WATER Call
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSimulateGesture("no")}
                className="p-2.5 rounded-xl bg-white border border-black/5 hover:border-amber-500/40 hover:bg-amber-50/30 transition text-left shadow-xs group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#17191C] group-hover:text-amber-700">Wrist Twitch</span>
                  <Hand className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <span className="text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  NO Handshake
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSimulateGesture("emergency")}
                className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white border border-red-700/50 transition text-left shadow-md shadow-red-600/30 group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-extrabold text-white">Dual Squeeze</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-white animate-pulse" />
                </div>
                <span className="text-[10px] font-mono font-bold text-rose-900 bg-white/90 px-1.5 py-0.5 rounded shadow-xs">
                  EMERGENCY
                </span>
              </button>
            </div>

            {/* Simulated Classification Feedback HUD */}
            {simFeedback && (
              <div className={`p-3 rounded-xl border text-xs space-y-1 animate-in fade-in zoom-in-95 duration-150 ${simFeedback.color}`}>
                <div className="flex items-center justify-between">
                  <span className="font-bold font-heading">{simFeedback.gesture}</span>
                  <span className="font-mono text-[10px] font-semibold">{simFeedback.latency}ms latency &bull; {simFeedback.confidence}%</span>
                </div>
                <p className="text-[11px] leading-tight opacity-90">{simFeedback.text}</p>
              </div>
            )}
          </div>

          {/* WARD SHIFT VIBE & ZEN PULSE (Fun Element) */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/10 via-emerald-500/5 to-transparent border border-cyan-500/20 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-900 font-bold block">
                Shift Harmony &bull; Zen Pulse
              </span>
              <span className="text-xs font-semibold text-[#17191C] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>All {devices.length} Bio-Gateways Synchronized</span>
              </span>
              <span className="text-[11px] text-[#686D73] block">
                {zenCount > 0 ? `Team Zen cheered ${zenCount}x!` : "Keep ward calm and focused"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleZenPulse}
              className="btn-pill-dark px-3.5 py-2 rounded-full text-xs font-semibold bg-[#081B26] hover:bg-[#0E2A3A] text-cyan-300 transition shadow-xs flex items-center gap-1.5 shrink-0"
              title="Send a calming harmonic pulse across the station"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Zen Cheer</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
