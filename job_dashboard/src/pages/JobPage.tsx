/* eslint-disable @typescript-eslint/no-unused-vars */
// import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import type { SupabaseJob } from "../types/supabase_job";
import { useNavigate, useParams } from "react-router-dom";
import API_BASE_URL from "@/config";

// ─── MOTION-LESS FRAMER REPLACEMENTS (pure CSS) ─────────────────────────────
// All animations handled via Tailwind + CSS custom classes

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface ApplicationStatusProps {
  status: string;
  onStatusChange: (newStatus: string) => void;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface CompanyDescriptionProps { description: string }
interface JobDescriptionProps { description: string }
interface JobHeaderProps { title: string; company: string; location: string; tags: string[] }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface JobMetadataProps { scrapedAt: string; scoredAt: string | null; scoreBreakdown: Record<string, any> | null }
interface JobScoreProps { score: number | null }
interface QuickActionsProps { jobUrl: string; applyType: string; coverLetterText: string | null; title: string }
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
  if (!score) return { color: "text-zinc-500", ring: "stroke-zinc-700", bg: "from-zinc-800/30 to-zinc-900/30", label: "Unscored", accent: "#52525b" };
  if (score >= 80) return { color: "text-emerald-400", ring: "stroke-emerald-500", bg: "from-emerald-900/20 to-zinc-900/30", label: "Excellent Match", accent: "#10b981" };
  if (score >= 60) return { color: "text-amber-400", ring: "stroke-amber-500", bg: "from-amber-900/20 to-zinc-900/30", label: "Good Match", accent: "#f59e0b" };
  if (score >= 40) return { color: "text-orange-400", ring: "stroke-orange-500", bg: "from-orange-900/20 to-zinc-900/30", label: "Weak Match", accent: "#f97316" };
  return { color: "text-red-400", ring: "stroke-red-500", bg: "from-red-900/20 to-zinc-900/30", label: "Poor Match", accent: "#ef4444" };
}

// ─── OUTCOME STYLES ───────────────────────────────────────────────────────────
function getOutcomeConfig(outcome: string | null) {
  const o = outcome || "No update";
  const map: Record<string, { dot: string; text: string; bg: string; border: string }> = {
    "No update":                      { dot: "bg-zinc-500",   text: "text-zinc-400",   bg: "bg-zinc-800/60",   border: "border-zinc-700" },
    "OA to do":                       { dot: "bg-amber-400",  text: "text-amber-300",  bg: "bg-amber-900/20",  border: "border-amber-700" },
    "OA done (waiting)":              { dot: "bg-amber-500",  text: "text-amber-300",  bg: "bg-amber-900/20",  border: "border-amber-700" },
    "Interview to do (scheduled)":    { dot: "bg-blue-400",   text: "text-blue-300",   bg: "bg-blue-900/20",   border: "border-blue-700" },
    "Interview done (waiting response)":{ dot: "bg-blue-500", text: "text-blue-300",   bg: "bg-blue-900/20",   border: "border-blue-700" },
    "Rejected":                       { dot: "bg-red-500",    text: "text-red-400",    bg: "bg-red-900/20",    border: "border-red-800" },
    "Ghosted":                        { dot: "bg-zinc-400",   text: "text-zinc-400",   bg: "bg-zinc-800/60",   border: "border-zinc-600" },
    "Offer":                          { dot: "bg-emerald-400",text: "text-emerald-300",bg: "bg-emerald-900/20",border: "border-emerald-700" },
  };
  return map[o] || map["No update"];
}

function getDeadlineConfig(dateStr: string | null) {
  if (!dateStr) return { cls: "bg-zinc-800/60 text-zinc-500 border-zinc-700", label: null };
  const today = new Date(); today.setHours(0,0,0,0);
  const deadline = new Date(dateStr); deadline.setHours(0,0,0,0);
  const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  if (days < 0)   return { cls: "bg-red-950/60 text-red-400 border-red-800",      label: `${Math.abs(days)}d overdue` };
  if (days <= 3)  return { cls: "bg-red-900/30 text-red-300 border-red-700",      label: `${days}d left` };
  if (days <= 7)  return { cls: "bg-orange-900/30 text-orange-300 border-orange-700", label: `${days}d left` };
  if (days <= 14) return { cls: "bg-amber-900/30 text-amber-300 border-amber-700",label: `${days}d left` };
  return { cls: "bg-emerald-900/20 text-emerald-300 border-emerald-800", label: `${days}d left` };
}

// ─── RADIAL SCORE RING ────────────────────────────────────────────────────────
function ScoreRing({ score }: { score: number | null }) {
  const cfg = getScoreConfig(score);
  const pct = score ?? 0;
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className={cn("relative rounded-2xl p-6 bg-gradient-to-br border border-zinc-800/50", cfg.bg)}>
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
            <circle
              cx="64" cy="64" r={r} fill="none"
              className={cfg.ring}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {score !== null ? (
              <>
                <span className={cn("text-4xl font-black tabular-nums", cfg.color)}>{score}</span>
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
              i === 0 ? score >= 80 :
              i === 1 ? score >= 60 && score < 80 :
              i === 2 ? score >= 40 && score < 60 :
              score < 40
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
    </div>
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
          <span className={cn("font-semibold text-sm tracking-wide", isApplied ? "text-emerald-300" : "text-zinc-400")}>
            {status}
          </span>
        </div>

        <button
          onClick={() => isApplied ? onStatusChange("Not Applied") : setShowConfirm(true)}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900",
            isApplied ? "bg-emerald-600 focus:ring-emerald-500" : "bg-zinc-700 focus:ring-zinc-500"
          )}
        >
          <span className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300",
            isApplied ? "translate-x-6" : "translate-x-1"
          )} />
        </button>
      </div>

      {showConfirm && (
        <div className="mt-3 p-4 rounded-xl bg-amber-900/10 border border-amber-700/40 animate-in fade-in slide-in-from-top-2 duration-200">
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
        </div>
      )}
    </div>
  );
}

// ─── EXPANDABLE TEXT BLOCK ────────────────────────────────────────────────────
function ExpandableText({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const paragraphs = description.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
  const preview = paragraphs.slice(0, 2);
  const rest = paragraphs.slice(2);

  const renderParagraph = (p: string, key: string) => (
    <p key={key} className="leading-relaxed text-zinc-300 text-sm">
      {p.split('\n').map((line, i, arr) => (
        <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
      ))}
    </p>
  );

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-6 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
          {icon}
        </div>
        <h2 className="text-base font-bold text-zinc-100 tracking-tight">{title}</h2>
      </div>
      <div className="space-y-3">
        {preview.map((p, i) => renderParagraph(p, `p-${i}`))}
        {isExpanded && rest.map((p, i) => renderParagraph(p, `r-${i}`))}
      </div>
      {rest.length > 0 && (
        <button onClick={() => setIsExpanded(!isExpanded)}
          className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider">
          <svg className={cn("w-3 h-3 transition-transform duration-200", isExpanded && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
          {isExpanded ? "Collapse" : `Read more (${rest.length} more section${rest.length > 1 ? "s" : ""})`}
        </button>
      )}
    </div>
  );
}

// ─── JOB HEADER ───────────────────────────────────────────────────────────────
function JobHeader({ title, company, location, tags }: JobHeaderProps) {
  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-6 sm:p-8 backdrop-blur-sm">
      {/* Decorative accent */}
      <div className="w-12 h-1 rounded-full bg-gradient-to-r from-blue-500 to-violet-500 mb-5" />

      <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-50 leading-tight tracking-tight mb-3">
        {title}
      </h1>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 text-sm">
        <span className="font-semibold text-zinc-200">{company}</span>
        <span className="text-zinc-700">·</span>
        <div className="flex items-center gap-1.5 text-zinc-400">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {location}
        </div>
      </div>

      {tags?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, i) => (
            <span key={i} className="px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800/80 text-zinc-300 border border-zinc-700/50 tracking-wide">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── QUICK ACTIONS ────────────────────────────────────────────────────────────
function QuickActions({ jobUrl, applyType, coverLetterText, title }: QuickActionsProps) {
  const [clLoading, setClLoading] = useState(false);
  const [cvLoading, setCvLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCoverLetterDownload = async () => {
    if (!coverLetterText) return;
    setClLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/coverletter-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: coverLetterText }),
      });
      if (!res.ok) throw new Error("Failed to download PDF");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${title}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) { console.error(err); }
    finally { setClLoading(false); }
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm space-y-3">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-4">Quick Actions</span>

      {/* Primary CTA */}
      <a href={jobUrl} target="_blank" rel="noopener noreferrer"
        className="group flex items-center justify-center gap-2 w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold text-sm transition-all duration-200 shadow-lg shadow-blue-900/30">
        <svg className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        View Job Posting
      </a>

      {/* Apply type + copy url row */}
      <div className="flex gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-3 py-2 bg-zinc-800/60 rounded-lg border border-zinc-700/40">
          <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs text-zinc-400 font-medium">{applyType}</span>
        </div>
        <button onClick={handleCopyUrl}
          className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all duration-200",
            copied ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300" : "bg-zinc-800/60 border-zinc-700/40 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600"
          )}>
          {copied ? (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copied</>
          ) : (
            <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copy URL</>
          )}
        </button>
      </div>

      <div className="border-t border-zinc-800/60 pt-3 space-y-2">
        {/* Cover Letter */}
        {coverLetterText ? (
          <button onClick={handleCoverLetterDownload} disabled={clLoading}
            className="group flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-300 hover:text-zinc-100 rounded-xl text-sm font-semibold border border-zinc-700/40 hover:border-zinc-600 transition-all duration-200 disabled:opacity-60">
            {clLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <svg className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {clLoading ? "Generating PDF…" : "Download Cover Letter"}
          </button>
        ) : (
          <div className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-zinc-800/20 text-zinc-600 rounded-xl text-sm border border-zinc-800/50 border-dashed">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Cover Letter Generating…
          </div>
        )}

        {/* CV Download */}
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
  const { cls: deadlineCls, label: deadlineLabel } = getDeadlineConfig(deadline);
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
        {outcomeOpen && (
          <div className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
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
          </div>
        )}
      </div>

      {/* Deadline */}
      <div ref={deadlineRef} className="relative">
        <label className="block text-xs font-medium text-zinc-600 mb-1.5">Deadline</label>
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
        {deadlineOpen && (
          <div className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3">
            <input type="date" value={pendingDeadline} onChange={e => setPendingDeadline(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => { onDeadlineChange(pendingDeadline || null); setDeadlineOpen(false); }}
                className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors font-semibold">
                Confirm
              </button>
              {deadline && (
                <button onClick={() => { onDeadlineChange(null); setPendingDeadline(""); setDeadlineOpen(false); }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-red-400 text-xs rounded-lg transition-colors border border-zinc-700">
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
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
        {notesOpen && (
          <div className="absolute z-50 mt-1.5 w-full bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3">
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
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors font-semibold">
                Save
              </button>
            </div>
          </div>
        )}
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

// ─── [EXTRA 1] COVER LETTER PREVIEW ──────────────────────────────────────────
function CoverLetterPreview({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Cover Letter Preview</span>
        <button onClick={() => setOpen(o => !o)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-semibold">
          {open ? "Collapse ↑" : "Preview ↓"}
        </button>
      </div>
      {open && (
        <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700/40 max-h-64 overflow-y-auto">
          <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap font-mono">{text}</p>
        </div>
      )}
      {!open && (
        <p className="text-xs text-zinc-600 italic line-clamp-2">{text.slice(0, 120)}…</p>
      )}
    </div>
  );
}

// ─── [EXTRA 2] QUICK STATS BAR ────────────────────────────────────────────────
function QuickStats({ job, applicationStatus }: { job: SupabaseJob; applicationStatus: string }) {
  const stats = [
    { label: "Score", value: job.score != null ? `${job.score}/100` : "—", color: job.score && job.score >= 60 ? "text-emerald-400" : "text-zinc-400" },
    { label: "Status", value: applicationStatus === "Applied" ? "Applied ✓" : "Not Applied", color: applicationStatus === "Applied" ? "text-emerald-400" : "text-zinc-500" },
    { label: "Apply Via", value: job.apply_type || "—", color: "text-zinc-400" },
    { label: "Tags", value: `${job.tags?.length ?? 0}`, color: "text-zinc-400" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {stats.map(s => (
        <div key={s.label} className="rounded-xl border border-zinc-800/50 bg-zinc-900/60 p-3 text-center">
          <div className={cn("text-sm font-bold tabular-nums", s.color)}>{s.value}</div>
          <div className="text-xs text-zinc-600 mt-0.5 font-medium">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── [EXTRA 3] SIMILAR TAGS CHIP ROW (visual only, from job tags) ─────────────
function TagCloud({ tags }: { tags: string[] }) {
  if (!tags?.length) return null;
  const tagColors = ["bg-blue-900/30 text-blue-300 border-blue-800/50", "bg-violet-900/30 text-violet-300 border-violet-800/50",
    "bg-cyan-900/30 text-cyan-300 border-cyan-800/50", "bg-teal-900/30 text-teal-300 border-teal-800/50",
    "bg-pink-900/30 text-pink-300 border-pink-800/50"];
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, i) => (
        <span key={i} className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border", tagColors[i % tagColors.length])}>
          #{tag.toLowerCase().replace(/\s+/g, "-")}
        </span>
      ))}
    </div>
  );
}

// ─── [EXTRA 4] TIMELINE / APPLICATION HISTORY ─────────────────────────────────
function ApplicationTimeline({ job, applicationStatus, feedbackStatus }: { job: SupabaseJob; applicationStatus: string; feedbackStatus: string | null }) {
  const events = [
    { label: "Job scraped", date: job.scraped_at, done: true },
    { label: "Score generated", date: job.scored_at, done: !!job.scored_at },
    { label: "Application submitted", date: applicationStatus === "Applied" ? "Done" : null, done: applicationStatus === "Applied" },
    { label: feedbackStatus && feedbackStatus !== "No update" ? feedbackStatus : "Awaiting update", date: null, done: feedbackStatus && feedbackStatus !== "No update" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/80 p-5 backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-widest text-zinc-500 block mb-4">Timeline</span>
      <div className="space-y-0">
        {events.map((e, i) => (
          <div key={i} className="flex gap-3 relative">
            {i < events.length - 1 && (
              <div className="absolute left-[7px] top-5 w-px bg-zinc-800 h-full" />
            )}
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

// ─── [EXTRA 5] KEYBOARD SHORTCUTS HINT ────────────────────────────────────────
function KeyboardHint() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 2000);
    const timer2 = setTimeout(() => setVisible(false), 6000);
    return () => { clearTimeout(timer); clearTimeout(timer2); };
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-full bg-zinc-900/95 border border-zinc-700 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <span className="text-xs text-zinc-400 font-medium">
        Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-xs border border-zinc-700 mx-1">Alt+←</kbd> to go back
      </span>
    </div>
  );
}

// ─── [EXTRA 6] COPY TO CLIPBOARD FOR COVER LETTER TEXT ────────────────────────
function CoverLetterCopyButton({ text }: { text: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!text) return null;
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
        copied ? "bg-emerald-900/30 text-emerald-300 border-emerald-700/50" : "bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 border-zinc-700/40")}>
      {copied ? "✓ Copied!" : "Copy Text"}
    </button>
  );
}

// ─── [EXTRA 7] SCORE BREAKDOWN VISUAL BARS ────────────────────────────────────
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
              <span className="text-xs text-zinc-500 font-mono">{value}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-700"
                style={{ width: `${Math.min(value, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── [EXTRA 8] SHARE / EXPORT BUTTON ──────────────────────────────────────────
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

// ─── LOADING SKELETON ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 animate-pulse">
      <div className="h-14 bg-zinc-900/80 border-b border-zinc-800/50" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {[1, 2, 3].map(i => <div key={i} className={`rounded-2xl bg-zinc-900 border border-zinc-800/50 h-${i === 1 ? "40" : "64"}`} />)}
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

  // Alt+← keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && e.key === "ArrowLeft") navigate(-1);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate]);

  useEffect(() => {
    const fetchJob = async () => {
      setLoading(true);
      setError(null);
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
    } catch (err) { console.error(err); }
  };

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
      {/* Subtle grid bg */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.02) 1px, transparent 0)", backgroundSize: "32px 32px" }} />

      {/* Top nav bar */}
      <div className="sticky top-0 z-40 border-b border-zinc-800/60 bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-200 transition-colors text-sm font-medium group flex-shrink-0">
            <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">Back</span>
          </button>

          {/* Title in nav on scroll */}
          <div className="flex-1 min-w-0 text-center">
            <p className="text-xs text-zinc-600 truncate font-medium">{job.title} · {job.company}</p>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ShareButton job={job} />
            <CoverLetterCopyButton text={coverLetterText} />
          </div>
        </div>
      </div>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
        {/* Quick stats bar */}
        <div className="mb-6">
          <QuickStats job={job} applicationStatus={applicationStatus} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Left: Main Content ── */}
          <div className="lg:col-span-2 space-y-5">
            <JobHeader title={job.title} company={job.company} location={job.location} tags={job.tags} />

            {/* Tag cloud */}
            {job.tags?.length > 0 && (
              <div className="px-1">
                <TagCloud tags={job.tags} />
              </div>
            )}

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

            {/* Score breakdown bars (extra) */}
            <ScoreBreakdownBars breakdown={job.score_breakdown} />

            {/* Application Timeline */}
            <ApplicationTimeline job={job} applicationStatus={applicationStatus} feedbackStatus={feedbackStatus} />
          </div>

          {/* ── Right: Sidebar ── */}
          <div className="lg:col-span-1 space-y-4">
            <ScoreRing score={job.score} />

            <QuickActions
              jobUrl={job.url}
              applyType={job.apply_type}
              coverLetterText={coverLetterText}
              title={job.title}
            />

            <ApplicationStatus status={applicationStatus} onStatusChange={handleApplicationToggle} />

            <JobTracking
              feedbackStatus={feedbackStatus}
              deadline={deadline}
              notes={notes}
              onFeedbackChange={handleFeedbackChange}
              onDeadlineChange={handleDeadlineChange}
              onNotesChange={handleNotesChange}
            />

            {/* Cover letter preview */}
            <CoverLetterPreview text={coverLetterText} />

            <JobMetadata scrapedAt={job.scraped_at} scoredAt={job.scored_at} scoreBreakdown={job.score_breakdown} />
          </div>
        </div>
      </main>

      {/* Keyboard shortcut toast */}
      <KeyboardHint />
    </div>
  );
}

export default JobPage;