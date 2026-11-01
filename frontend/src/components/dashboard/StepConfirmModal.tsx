"use client";

import React from "react";
import { X, Volume2, Check } from "@/lib/noIcons";
import { CareRequestItem } from "@/lib/api";

export interface StepConfirmData {
  request: CareRequestItem;
  nextStep: "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED" | "REQUEST_CONFIRMATION";
  stepTitle: string;
  stepDescription: string;
  actionButtonLabel: string;
  actionButtonColor: string;
  isResolutionStep?: boolean;
}

interface StepConfirmModalProps {
  data: StepConfirmData | null;
  onClose: () => void;
  onExecute: (overrideDirectResolve?: boolean) => void;
}

export const StepConfirmModal: React.FC<StepConfirmModalProps> = ({
  data,
  onClose,
  onExecute,
}) => {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white/95 backdrop-blur-xl border border-white/80 rounded-3xl p-6 sm:p-7 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100/80 pb-3">
          <h3 className="font-bold text-sm sm:text-base text-[#17191C] tracking-tight">
            {data.stepTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description Body */}
        <p className="text-xs text-slate-600 leading-relaxed font-normal">
          {data.stepDescription}
        </p>

        {/* Resolution vs Standard Step Actions */}
        {data.isResolutionStep ? (
          <div className="space-y-2.5 pt-2 border-t border-slate-100/80">
            <button
              type="button"
              onClick={() => onExecute(false)}
              className="w-full py-2.5 px-4 rounded-full text-xs font-semibold text-white bg-[#151719] hover:bg-black transition flex items-center justify-center gap-2 shadow-sm"
            >
              <Volume2 className="w-4 h-4" />
              <span>Ask Patient to Confirm (Bedside Audio)</span>
            </button>
            <button
              type="button"
              onClick={() => onExecute(true)}
              className="w-full py-2.5 px-4 rounded-full text-xs font-semibold text-emerald-900 border border-emerald-300 bg-emerald-100/80 hover:bg-emerald-200 transition flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Direct Nurse Override (Mark Resolved)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 px-4 rounded-full text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-xs active:scale-95"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow-xs active:scale-95"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onExecute(false)}
              className={`px-5 py-2 rounded-full text-xs font-bold text-white shadow-sm transition active:scale-95 ${
                data.actionButtonColor ||
                (data.nextStep === "ACKNOWLEDGED"
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-[#151719] hover:bg-black")
              }`}
            >
              {data.actionButtonLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
