/* eslint-disable @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import type { SupabaseJob } from "../types/supabase_job";
import { useNavigate, useParams } from "react-router-dom";
import API_BASE_URL from "@/config";

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface ApplicationStatusProps {
  status: string;
  onStatusChange: (newStatus: string) => void;
}
interface JobHeaderProps { title: string; company: string; location: string; tags: string[] }
interface JobMetadataProps { scrapedAt: string; scoredAt: string | null; scoreBreakdown: Record<string, unknown> | null }
interface QuickActionsProps {
  jobUrl: string; applyType: string; coverLetterText: string | null;
  title: string; jobId: number;
  onCoverLetterRegenerated: (text: string) => void;
}
interface JobTrackingProps {
  feedbackStatus: string | null; deadline: string | null; notes: string | null;
  onFeedbackChange: (val: string) => void; onDeadlineChange: (val: string | null) => void; onNotesChange: (val: string) => void;
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const OUTCOMES = [
  "No update", "OA to do", "OA done (waiting)",
  "Interview to do (scheduled)", "Interview done (waiting response)",
  "Rejected", "Ghosted", "Offer",
];

// ─── UTILITY ─────────────────────────────────────────────────────────────────
function cn(...classes: (string | boolean | undefined | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(dateString: string | null) {
  if (!dateString) return "N/A";
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return dateString; }
}

// ─── SCORE HELPERS ────────────────────────────────────────────────────────────
function getScoreConfig(score: number | null) {
  if (!score) return { color: "text-zinc-500", ring: "stroke-zinc-700", bg: "from-zinc-800/30 to-zinc-900/30", label: "Unscored", accent: "#52525b", glow: "transparent" };
  if (score >= 80) return { color: "text-emerald-400", ring: "stroke-emerald-500", bg: "from-emerald-900/20 to-zinc-900/30", label: "Excellent Match", accent: "#10b981", glow: "rgba(16,185,129,0.12)" };
  if (score >= 60) return { color: "text-amber-400", ring: "stroke-amber-500", bg: "from-amber-900/20 to-zinc-900/30", label: "Good Match", accent: "#f59e0b", glow: "rgba(245,158,11,0.10)" };
  if (score >= 40) return { color: "text-orange-400", ring: "stroke-orange-500", bg: "from-orange-900/20 to-zinc-900/30", label: "Weak Match", accent: "#f97316", glow: "rgba(249,115,22,0.10)" };
  return { color: "text-red-400", ring: "stroke-red-500", bg: "from-red-900/20 to-zinc-900/30", label: "Poor Match", accent: "#ef4444", glow: "rgba(239,68,68,0.10)" };
}

// ─── OUTCOME STYLES ───────────────────────────────────────────────────────────
function getOutcomeConfig(outcome: string | null) {
  const o = outcome || "No update";
  const map: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    "No update":                        { dot: "bg-zinc-500",    text: "text-zinc-400",    bg: "bg-zinc-800/60",    border: "border-zinc-700" },
    "OA to do":                         { dot: "bg-amber-400",   text: "text-amber-300",   bg: "bg-amber-900/20",   border: "border-amber-700" },
    "OA done (waiting)":                { dot: "bg-amber-500",   text: "text-amber-300",   bg: "bg-amber-900/20",   border: "border-amber-700" },
    "Interview to do (scheduled)":      { dot: "bg-blue-400",    text: "text-blue-300",    bg: "bg-blue-900/20",    border: "border-blue-700" },
    "Interview done (waiting response)":{ dot: "bg-blue-500",    text: "text-blue-300",    bg: "bg-blue-900/20",    border: "border-blue-700" },
    "Rejected":                         { dot: "bg-red-500",     text: "text-red-400",     bg: "bg-red-900/20",     border: "border-red-800" },
    "Ghosted":                          { dot: "bg-zinc-400",    text: "text-zinc-400",    bg: "bg-zinc-800/60",    border: "border-zinc-600" },
    "Offer":                            { dot: "bg-emerald-400", text: "text-emerald-300", bg: "bg-emerald-900/20", border: "border-emerald-700" },
  };
  return map[o] || map["No update"];
}

function getDeadlineConfig(dateStr: string | null) {
  if (!dateStr) return { cls: "bg-zinc-800/60 text-zinc-500 border-zinc-700", label: null, urgent: false };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const deadline = new Date(dateStr); deadline.setHours(0, 0, 0, 0);
  const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  if (days < 0)   return { cls: "bg-red-950/60 text-red-400 border-red-800",         label: `${Math.abs(days)}d overdue`, urgent: true };
  if (days <= 3)  return { cls: "bg-red-900/30 text-red-300 border-red-700",         label: `${days}d left`, urgent: true };
  if (days <= 7)  return { cls: "bg-orange-900/30 text-orange-300 border-orange-700", label: `${days}d left`, urgent: false };
  if (days <= 14) return { cls: "bg-amber-900/30 text-amber-300 border-amber-700",   label: `${days}d left`, urgent: false };
  return { cls: "bg-emerald-900/20 text-emerald-300 border-emerald-800", label: `${days}d left`, urgent: false };
}


// ─── CONFETTI BURST ───────────────────────────────────────────────────────────
function ConfettiBurst({ trigger }: { trigger: boolean }) {
  const [particles] = useState(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const angle = (i / 18) * 360;
      return {
        angle,
        distance: 80 + Math.random() * 120,
        size: 4 + Math.random() * 5,
        duration: 0.8 + Math.random() * 0.4,
        colorIndex: i,
      };
    });
  });
  const colors = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#059669", "#fbbf24", "#f59e0b"];

  if (!trigger) return null;
  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
{particles.map((p, i) => {
  const color = colors[p.colorIndex % colors.length];

  return (
    <motion.div
      key={i}
      className="absolute rounded-sm"
      style={{
        left: "50%",
        top: "40%",
        width: p.size,
        height: p.size,
        backgroundColor: color,
        transformOrigin: "center",
      }}
      initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
      animate={{
        x: Math.cos((p.angle * Math.PI) / 180) * p.distance,
        y: Math.sin((p.angle * Math.PI) / 180) * p.distance - 80,
        opacity: 0,
        rotate: p.angle * 3,
        scale: 0,
      }}
      transition={{ duration: p.duration, ease: "easeOut" }}
    />
  );
  })}
    </div>
  );
}

// ─── NORMALIZE DESCRIPTION ────────────────────────────────────────────────────
function normalizeDescription(text: string): string[] {
  if (/\n\n/.test(text)) {
    return text.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
  }
  const processed = text
    .replace(/\.([A-Z])/g, ".\n\n$1")
    .replace(/:([^\n])/g, ":\n\n$1")
    .replace(/\n([A-Z])/g, "\n\n$1")
    .replace(/\n([-•])/g, "\n\n$1");
  return processed.split(/\n\n+/).map(p => p.trim()).filter(p => p.length > 0);
}

// ─── RADIAL SCORE RING ────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number | null }) {
  const cfg = getScoreConfig(score);
  const pct = score ?? 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className={cn("relative rounded-2xl p-6 bg-gradient-to-br border border-zinc-800/50", cfg.bg)}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Match Score</span>
        <span className={cn("text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border", cfg.color,
          score && score >= 80 ? "border-emerald-700/50 bg-emerald-900/20" :
          score && score >= 60 ? "border-amber-700/50 bg-amber-900/20" :
          score && score >= 40 ? "border-orange-700/50 bg-orange-900/20" :
          score ? "border-red-700/50 bg-red-900/20" : "border-zinc-700 bg-zinc-800/60"
        )}>
          {cfg.label}
        </span>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative flex-shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
            <circle cx="64" cy="64" r={r} fill="none" stroke="#27272a" strokeWidth="10" />
            <circle cx="64" cy="64" r={r} fill="none" className={cfg.ring} strokeWidth="10"
              strokeLinecap="round" strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }} />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {score !== null ? (
              <>
                <span className={cn("text-3xl font-black tabular-nums", cfg.color)}>{score}</span>
                <span className="text-xs text-zinc-600 -mt-1">/ 100</span>
              </>
            ) : (
              <span className="text-zinc-600 text-sm font-medium">—</span>
            )}
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {[80, 60, 40, 0].map((threshold, i) => {
            const labels = ["Excellent", "Good", "Weak", "Poor"];
            const colors = ["bg-emerald-500", "bg-amber-500", "bg-orange-500", "bg-red-500"];
            const active = score !== null && (
              i === 0 ? score >= 80 : i === 1 ? score >= 60 && score < 80 :
              i === 2 ? score >= 40 && score < 60 : score < 40
            );
            return (
              <div key={threshold} className={cn("flex items-center gap-2 transition-opacity", active ? "opacity-100" : "opacity-30")}>
                <div className={cn("w-2 h-2 rounded-full", colors[i])} />
                <span className="text-xs text-zinc-400">{labels[i]}</span>
                <span className="text-xs text-zinc-600 ml-auto">{threshold === 0 ? "<40" : `≥${threshold}`}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

// ─── APPLICATION STATUS ───────────────────────────────────────────────────────
function ApplicationStatus({ status, onStatusChange }: ApplicationStatusProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const isApplied = status === "Applied";

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-4">Application Status</span>
      <div className={cn(
        "flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300",
        isApplied ? "bg-emerald-900/20 border-emerald-700/50" : "bg-zinc-800/40 border-zinc-700/50"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn("w-2.5 h-2.5 rounded-full transition-colors", isApplied ? "bg-emerald-400" : "bg-zinc-600")} />
          <span className={cn("font-semibold text-sm tracking-wide", isApplied ? "text-emerald-300" : "text-zinc-400")}>{status}</span>
        </div>
        <button
          onClick={() => isApplied ? onStatusChange("Not Applied") : setShowConfirm(true)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none",
            isApplied ? "bg-emerald-600" : "bg-zinc-700"
          )}
        >
          <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300",
            isApplied ? "translate-x-6" : "translate-x-1")} />
        </button>
      </div>
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mt-3 p-4 rounded-xl bg-amber-900/10 border border-amber-700/40"
          >
            <p className="text-amber-300 text-sm mb-3 font-medium">Mark this job as applied?</p>
            <div className="flex gap-2">
              <button onClick={() => { onStatusChange("Applied"); setShowConfirm(false); }}
                className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-semibold transition-colors">
                Confirm
              </button>
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── EXPANDABLE TEXT ──────────────────────────────────────────────────────────
function ExpandableText({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const paragraphs = normalizeDescription(description);
  const preview = paragraphs.slice(0, 2);
  const rest = paragraphs.slice(2);

  const renderParagraph = (p: string, key: string) => (
    <p key={key} className="leading-relaxed text-zinc-300 text-sm">
      {p.split("\n").map((line, i, arr) => (
        <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
      ))}
    </p>
  );

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">{icon}</div>
        <h2 className="text-base font-bold text-zinc-100 tracking-tight">{title}</h2>
      </div>
      <div className="space-y-3">
        {preview.map((p, i) => renderParagraph(p, `p-${i}`))}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              {rest.map((p, i) => renderParagraph(p, `r-${i}`))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {rest.length > 0 && (
        <button onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider">
          <motion.svg animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}
            className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </motion.svg>
          {isExpanded ? "Collapse" : `Read more (${rest.length} more section${rest.length > 1 ? "s" : ""})`}
        </button>
      )}
    </div>
  );
}

// ─── JOB HEADER ───────────────────────────────────────────────────────────────
function JobHeader({ title, company, location, tags }: JobHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-6 sm:p-8 backdrop-blur-sm"
    >
      <div className="w-12 h-1 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 mb-5" />
      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-50 leading-tight tracking-tight mb-3">{title}</h1>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 text-sm">
        <span className="font-semibold text-zinc-200">{company}</span>
        <span className="text-zinc-700">·</span>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {location || "Location unknown"}
        </div>
      </div>
      {tags?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span key={i} className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 tracking-wide">{tag}</span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────
function QuickActions({ jobUrl, applyType, coverLetterText, title, jobId, onCoverLetterRegenerated }: QuickActionsProps) {
  const [clLoading, setClLoading] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCoverLetterDownload = async (text: string | null) => {
    if (!text) return;
    setClLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/coverletter-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
    finally { setClLoading(false); }
  };

  const handleRegenerate = async () => {
    setRegenLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/generate-coverletter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, force: true }),
      });
      if (!res.ok) throw new Error("Regen failed");
      const data = await res.json();
      if (data.coverletter_text) onCoverLetterRegenerated(data.coverletter_text);
    } catch (err) { console.error(err); }
    finally { setRegenLoading(false); }
  };

  const handleCVDownload = async () => {
    setCvLoading(true);
    const a = document.createElement("a");
    a.href = `${API_BASE_URL}/download-cv`;
    a.download = "CV_Pranjwal_Singh.pdf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => setCvLoading(false), 1000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(jobUrl).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm space-y-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-4">Quick Actions</span>
      <a href={jobUrl} target="_blank" rel="noopener noreferrer"
        className="group flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-900/30">
        <svg className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        View Job Posting
      </a>
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-zinc-800/60 rounded-lg border border-zinc-700/40">
          <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs text-zinc-400 font-medium">{applyType}</span>
        </div>
        <button onClick={handleCopyUrl}
          className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-200",
            copied ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300" : "bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600")}>
          {copied ? (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy URL</>
          )}
        </button>
      </div>
      <div className="border-t border-zinc-800/60 pt-3 space-y-2">
        {/* Cover Letter + Regen */}
        {coverLetterText ? (
          <div className="flex gap-2">
            <button onClick={() => handleCoverLetterDownload(coverLetterText)} disabled={clLoading}
              className="group flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 rounded-xl text-sm font-semibold border border-zinc-700/40 hover:border-zinc-600 transition-all duration-200 disabled:opacity-60">
              {clLoading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              )}
              {clLoading ? "Generating…" : "Download CL"}
            </button>
            {/* Regenerate button */}
            <button onClick={handleRegenerate} disabled={regenLoading}
              title="Regenerate cover letter"
              className={cn(
                "flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all duration-200 disabled:opacity-60",
                regenLoading
                  ? "bg-violet-900/30 border-violet-700/50 text-violet-300"
                  : "bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:text-violet-300 hover:border-violet-700/50 hover:bg-violet-900/20"
              )}>
              {regenLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {/* {regenLoading ? "" : ""} */}
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-800/20 text-zinc-600 rounded-xl text-sm border border-zinc-800/50 border-dashed">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Cover Letter Generating…
            </div>
            <button onClick={handleRegenerate} disabled={regenLoading}
              title="Force generate cover letter"
              className="flex items-center justify-center px-3 py-2.5 rounded-xl text-xs font-semibold border bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:text-violet-300 hover:border-violet-700/50 hover:bg-violet-900/20 transition-all duration-200 disabled:opacity-60">
              {regenLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
            </button>
          </div>
        )}
        <button onClick={handleCVDownload} disabled={cvLoading}
          className="group flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 rounded-xl text-sm font-semibold border border-zinc-700/40 hover:border-zinc-600 transition-all duration-200 disabled:opacity-60">
          {cvLoading ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          ) : (
            <svg className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )}
          {cvLoading ? "Downloading…" : "Download CV"}
        </button>
      </div>
    </div>
  );
}

// ─── JOB TRACKING ─────────────────────────────────────────────────────────────
function JobTracking({ feedbackStatus, deadline, notes, onFeedbackChange, onDeadlineChange, onNotesChange }: JobTrackingProps) {
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesDraft, setNotesDraft] = useState(notes ?? "");
  const [pendingDeadline, setPendingDeadline] = useState(deadline ?? "");
  const outcomeRef = useRef<HTMLDivElement>(null);
  const deadlineRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDivElement>(null);

  const outcome = feedbackStatus || "No update";
  const { cls: deadlineCls, label: deadlineLabel, urgent: deadlineUrgent } = getDeadlineConfig(deadline);
  const outcomeCfg = getOutcomeConfig(outcome);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (outcomeRef.current && !outcomeRef.current.contains(e.target as Node)) setOutcomeOpen(false);
      if (deadlineRef.current && !deadlineRef.current.contains(e.target as Node)) setDeadlineOpen(false);
      if (notesRef.current && !notesRef.current.contains(e.target as Node)) {
        if (notesDraft !== (notes ?? "")) onNotesChange(notesDraft);
        setNotesOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [notesDraft, notes, onNotesChange]);

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm space-y-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block">Tracking</span>

      {/* Outcome */}
      <div ref={outcomeRef} className="relative">
        <label className="block text-xs font-medium text-zinc-600 mb-1.5">Outcome</label>
        <button onClick={() => setOutcomeOpen(o => !o)}
          className={cn("flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all",
            outcomeCfg.bg, outcomeCfg.border, outcomeCfg.text)}>
          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", outcomeCfg.dot)} />
          <span className="flex-1 text-left">{outcome}</span>
          <svg className={cn("w-3.5 h-3.5 flex-shrink-0 transition-transform", outcomeOpen && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <AnimatePresence>
          {outcomeOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
              {OUTCOMES.map(o => {
                const cfg = getOutcomeConfig(o);
                return (
                  <button key={o} onClick={() => { onFeedbackChange(o); setOutcomeOpen(false); }}
                    className={cn("flex items-center gap-2.5 w-full px-3 py-2.5 text-xs text-left transition-colors hover:bg-zinc-800",
                      o === outcome ? "bg-zinc-800/80 font-semibold" : "font-medium text-zinc-400")}>
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", cfg.dot)} />
                    <span className={o === outcome ? cfg.text : ""}>{o}</span>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Deadline — with urgent pulse ring */}
      <div ref={deadlineRef} className="relative">
        <label className="block text-xs font-medium text-zinc-600 mb-1.5">Deadline</label>
        <div className="relative">
          {deadlineUrgent && (
            <motion.div
              className="absolute inset-0 rounded-lg border-2 border-red-500/60 pointer-events-none"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
          <button onClick={() => setDeadlineOpen(o => !o)}
            className={cn("flex items-center justify-between w-full px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all", deadlineCls)}>
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {deadline ? new Date(deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Set deadline"}
            </span>
            {deadlineLabel && <span className="opacity-80 font-bold">{deadlineLabel}</span>}
          </button>
        </div>
        <AnimatePresence>
          {deadlineOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3">
              <input type="date" value={pendingDeadline} onChange={e => setPendingDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-2 mt-2">
                <button onClick={() => { onDeadlineChange(pendingDeadline || null); setDeadlineOpen(false); }}
                  className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors font-semibold">Confirm</button>
                {deadline && (
                  <button onClick={() => { onDeadlineChange(null); setPendingDeadline(""); setDeadlineOpen(false); }}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-red-400 text-xs rounded-lg transition-colors border border-zinc-700">Clear</button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notes */}
      <div ref={notesRef} className="relative">
        <label className="block text-xs font-medium text-zinc-600 mb-1.5">Notes</label>
        <button onClick={() => setNotesOpen(o => !o)}
          className={cn("w-full text-left px-3 py-2.5 rounded-lg border text-xs font-medium transition-all truncate",
            notes ? "bg-zinc-800/80 text-zinc-200 border-zinc-600" : "bg-zinc-800/30 text-zinc-600 border-zinc-700/50 border-dashed"
          )} title={notes ?? ""}>
          {notes ? notes.slice(0, 48) + (notes.length > 48 ? "…" : "") : "+ Add a note…"}
        </button>
        <AnimatePresence>
          {notesOpen && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3">
              <textarea autoFocus value={notesDraft} onChange={e => setNotesDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && e.metaKey) { onNotesChange(notesDraft); setNotesOpen(false); }
                  if (e.key === "Escape") setNotesOpen(false);
                }}
                placeholder="Add notes about this job…" rows={4}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-zinc-600">⌘↵ to save</span>
                <button onClick={() => { onNotesChange(notesDraft); setNotesOpen(false); }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors font-semibold">Save</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── JOB METADATA ─────────────────────────────────────────────────────────────
function JobMetadata({ scrapedAt, scoredAt, scoreBreakdown }: JobMetadataProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-4">Metadata</span>
      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-zinc-600 font-medium">Scraped</span>
          <span className="text-zinc-400 font-mono">{formatDate(scrapedAt)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-zinc-600 font-medium">Scored</span>
          <span className={cn("font-mono", scoredAt ? "text-zinc-400" : "text-zinc-700")}>
            {scoredAt ? formatDate(scoredAt) : "Not scored yet"}
          </span>
        </div>
      </div>
      {scoreBreakdown && Object.keys(scoreBreakdown).length > 0 && (
        <div className="mt-4">
          <button onClick={() => setOpen(o => !o)}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-wider">
            <svg className={cn("w-3 h-3 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            Score breakdown
          </button>
          {open && (
            <div className="mt-2 bg-zinc-800/40 rounded-xl p-3 space-y-1.5 border border-zinc-800">
              {Object.entries(scoreBreakdown).map(([key, value]) => (
                <div key={key} className="flex justify-between items-center text-xs">
                  <span className="text-zinc-600 capitalize">{key.replace(/_/g, " ")}</span>
                  <span className="text-zinc-400 font-mono">{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── COVER LETTER PREVIEW (with word count + live update) ────────────────────
function CoverLetterPreview({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;

  const wordCount = text.trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.round(wordCount / 200));

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Cover Letter</span>
          <span className="text-xs text-zinc-700 font-mono">{wordCount}w · {readTime}min</span>
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-semibold">
          {open ? "Collapse ↑" : "Preview ↓"}
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/40 max-h-64 overflow-y-auto">
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">{text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!open && (
        <p className="text-xs text-zinc-600 italic line-clamp-2">{text.slice(0, 120)}…</p>
      )}
    </div>
  );
}


// ─── APPLICATION TIMELINE ─────────────────────────────────────────────────────
function ApplicationTimeline({ job, applicationStatus, feedbackStatus }: { job: SupabaseJob; applicationStatus: string; feedbackStatus: string | null }) {
  const events = [
    { label: "Job scraped", date: job.scraped_at, done: true },
    { label: "Score generated", date: job.scored_at, done: !!job.scored_at },
    { label: "Application submitted", date: applicationStatus === "Applied" ? "Done" : null, done: applicationStatus === "Applied" },
    { label: feedbackStatus && feedbackStatus !== "No update" ? feedbackStatus : "Awaiting update", date: null, done: !!(feedbackStatus && feedbackStatus !== "No update") },
  ];
  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-4">Timeline</span>
      <div className="space-y-0">
        {events.map((e, i) => (
          <div key={i} className="flex gap-3 relative">
            {i < events.length - 1 && <div className="absolute left-[7px] top-5 w-px bg-zinc-800 h-full" />}
            <div className={cn("w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 mt-0.5 z-10",
              e.done ? "bg-emerald-500 border-emerald-600" : "bg-zinc-800 border-zinc-600")} />
            <div className="pb-4 flex-1 min-w-0">
              <div className={cn("text-xs font-semibold", e.done ? "text-zinc-200" : "text-zinc-600")}>{e.label}</div>
              {e.date && e.date !== "Done" && (
                <div className="text-xs text-zinc-600 mt-0.5 font-mono">{formatDate(e.date)}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KEYBOARD HINT ────────────────────────────────────────────────────────────
function KeyboardHint() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 2000);
    const t2 = setTimeout(() => setVisible(false), 6000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-zinc-900/95 border border-zinc-700 shadow-2xl backdrop-blur-sm"
        >
          <span className="text-xs text-zinc-400 font-medium">
            Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-xs border border-zinc-700 mx-1">Alt+←</kbd> to go back
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── COVER LETTER COPY BUTTON ─────────────────────────────────────────────────
function CoverLetterCopyButton({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
        copied ? "bg-emerald-900/30 text-emerald-300 border-emerald-700/50" : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border-zinc-700/40")}>
      {copied ? "✓ Copied!" : "Copy CL"}
    </button>
  );
}

// ─── SCORE BREAKDOWN BARS ─────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ScoreBreakdownBars({ breakdown }: { breakdown: Record<string, any> | null }) {
  if (!breakdown) return null;
  const numericEntries = Object.entries(breakdown).filter(([, v]) => typeof v === "number" && v <= 100);
  if (numericEntries.length === 0) return null;
  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-4">Score Breakdown</span>
      <div className="space-y-3">
        {numericEntries.map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-zinc-400 font-medium capitalize">{key.replace(/_/g, " ")}</span>
              <span className={cn("text-xs font-mono", value < 0 ? "text-red-400" : "text-zinc-500")}>{value}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full", value < 0
                  ? "bg-gradient-to-r from-red-600 to-rose-500"
                  : "bg-gradient-to-r from-blue-600 to-violet-600"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(Math.abs(value) * 3, 100)}%` }}
                transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SHARE BUTTON ─────────────────────────────────────────────────────────────
function ShareButton({ job }: { job: SupabaseJob }) {
  const [shared, setShared] = useState(false);
  const handleShare = () => {
    const text = `${job.title} at ${job.company} — ${job.location}\n${job.url}`;
    if (navigator.share) {
      navigator.share({ title: job.title, text, url: job.url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };
  return (
    <button onClick={handleShare}
      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
        shared ? "bg-emerald-900/30 text-emerald-300 border-emerald-700/50" : "bg-zinc-800/40 text-zinc-500 hover:text-zinc-300 border-zinc-700/40")}>
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
      </svg>
      {shared ? "Copied!" : "Share"}
    </button>
  );
}

// ─── DELETE BUTTON ────────────────────────────────────────────────────────────
function DeleteButton({ jobId, onDeleted }: { jobId: number; onDeleted: () => void }) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.from("jobs").delete().eq("id", jobId);
      if (error) throw error;
      onDeleted();
    } catch (err) {
      console.error(err);
      setDeleting(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border bg-zinc-800/40 text-zinc-600 hover:text-red-400 hover:border-red-800/50 hover:bg-red-900/10 border-zinc-700/40"
        title="Delete job"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        Delete
      </button>

      <AnimatePresence>
        {showConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
              onClick={() => setShowConfirm(false)}
            />
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 8 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-80 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl p-6"
            >
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-900/20 border border-red-800/50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <p className="text-zinc-100 font-semibold text-sm">Delete this job?</p>
                  <p className="text-zinc-500 text-xs mt-1">This action cannot be undone.</p>
                </div>
                <div className="flex gap-2 w-full mt-1">
                  <button onClick={() => setShowConfirm(false)}
                    className="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm font-semibold transition-colors border border-zinc-700">
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={deleting}
                    className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5">
                    {deleting ? (
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    ) : "Delete"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── LIVE INDICATOR ───────────────────────────────────────────────────────────
function LiveIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        className="w-1.5 h-1.5 rounded-full bg-emerald-400"
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <span className="text-xs text-zinc-600 font-medium">live</span>
    </div>
  );
}

// ─── LOADING SKELETON ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-14 bg-zinc-900/80 border-b border-zinc-800/50" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="rounded-2xl bg-zinc-900 border border-zinc-800/50 h-40" />)}
          </div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="rounded-2xl bg-zinc-900 border border-zinc-800/50 h-32" />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN JOB PAGE ────────────────────────────────────────────────────────────
function JobPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [job, setJob] = useState<SupabaseJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applicationStatus, setApplicationStatus] = useState("Not Applied");
  const [coverLetterText, setCoverLetterText] = useState<string | null>(null);
  const [feedbackStatus, setFeedbackStatus] = useState<string | null>(null);
  const [deadline, setDeadline] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowLeft") navigate(-1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate]);

  useEffect(() => {
    const fetchJob = async () => {
      setLoading(true); setError(null);
      const jobId = Number(slug);
      try {
        const { data, error } = await supabase.from("jobs").select("*").eq("id", jobId).single();
        if (error) throw error;
        let finalJob = data as SupabaseJob;

        if (!finalJob.coverletter_text || !finalJob.score || finalJob.score === 0) {
          const clRes = await fetch(`${API_BASE_URL}/generate-coverletter`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: jobId }),
          });
          if (clRes.ok) {
            const clData = await clRes.json();
            if (clData.coverletter_text) setCoverLetterText(clData.coverletter_text);
            const { data: updatedData } = await supabase.from("jobs").select("*").eq("id", jobId).single();
            if (updatedData) finalJob = updatedData as SupabaseJob;
          }
        } else {
          setCoverLetterText(finalJob.coverletter_text);
        }

        setJob(finalJob);
        setApplicationStatus(finalJob.application_status || "Not Applied");
        setFeedbackStatus(finalJob.feedback_status ?? null);
        setDeadline(finalJob.deadline ?? null);
        setNotes(finalJob.notes ?? null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };
    if (slug) fetchJob();
  }, [slug]);

  const handleFeedbackChange = async (val: string) => {
    if (!job) return;
    const { error } = await supabase.from("jobs").update({ feedback_status: val }).eq("id", job.id);
    if (!error) setFeedbackStatus(val);
  };

  const handleDeadlineChange = async (val: string | null) => {
    if (!job) return;
    const { error } = await supabase.from("jobs").update({ deadline: val }).eq("id", job.id);
    if (!error) setDeadline(val);
  };

  const handleNotesChange = async (val: string) => {
    if (!job) return;
    const { error } = await supabase.from("jobs").update({ notes: val }).eq("id", job.id);
    if (!error) setNotes(val);
  };

  const handleApplicationToggle = async (newStatus: string) => {
    if (!job) return;
    try {
      const { error } = await supabase.from("jobs").update({ application_status: newStatus }).eq("id", job.id);
      if (error) throw error;
      setApplicationStatus(newStatus);
      if (newStatus === "Applied") {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1200);
      }
    } catch (err) { console.error(err); }
  };

  const scoreGlow = job ? getScoreConfig(job.score).glow : "transparent";

  if (loading) return <LoadingSkeleton />;

  if (error) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 rounded-full bg-red-900/20 border border-red-800/50 flex items-center justify-center mx-auto">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-red-400 text-sm font-medium">{error}</p>
        <button onClick={() => navigate(-1)} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">← Go back</button>
      </div>
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-zinc-500 text-sm">Job not found.</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Animated background */}

      {/* Confetti */}
      <ConfettiBurst trigger={showConfetti} />

      {/* Top nav */}
      <div className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          {/* Left: back */}
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors text-sm font-medium group flex-shrink-0">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Center: title + live dot */}
          <div className="flex-1 min-w-0 flex items-center justify-center gap-3">
            <p className="text-xs text-zinc-600 truncate font-medium">{job.title} · {job.company}</p>
            <LiveIndicator />
          </div>

          {/* Right: share | copy CL | delete */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ShareButton job={job} />
            <CoverLetterCopyButton text={coverLetterText} />
            <DeleteButton jobId={job.id} onDeleted={() => navigate(-1)} />
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left */}
          <div className="lg:col-span-2 space-y-5">
            <JobHeader title={job.title} company={job.company} location={job.location} tags={job.tags} />

            <ExpandableText title="Job Description" description={job.job_desc} icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            } />

            <ExpandableText title="About the Company" description={job.company_desc} icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            } />

            <ScoreBreakdownBars breakdown={job.score_breakdown} />
            <ApplicationTimeline job={job} applicationStatus={applicationStatus} feedbackStatus={feedbackStatus} />
          </div>

          {/* Right sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <ScoreRing score={job.score} />

            <QuickActions
              jobUrl={job.url}
              applyType={job.apply_type}
              coverLetterText={coverLetterText}
              title={job.title}
              jobId={job.id}
              onCoverLetterRegenerated={(text) => setCoverLetterText(text)}
            />
            <CoverLetterPreview text={coverLetterText} />

            <ApplicationStatus status={applicationStatus} onStatusChange={handleApplicationToggle} />

            <JobTracking
              feedbackStatus={feedbackStatus}
              deadline={deadline}
              notes={notes}
              onFeedbackChange={handleFeedbackChange}
              onDeadlineChange={handleDeadlineChange}
              onNotesChange={handleNotesChange}
            />

            <JobMetadata scrapedAt={job.scraped_at} scoredAt={job.scored_at} scoreBreakdown={job.score_breakdown} />
          </div>
        </div>
      </main>

      <KeyboardHint />
    </div>
  );
}

export default JobPage;
