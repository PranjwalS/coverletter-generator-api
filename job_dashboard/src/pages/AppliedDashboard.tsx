/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

// ─── IMPORTS ──────────────────────────────────────────────────────────────────
import { useNavigate } from "react-router-dom";
import type { SupabaseJob } from "../types/supabase_job";
import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import ReactDOM from "react-dom";
import { supabase } from "../lib/supabase";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/react-table";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { animate } from "motion/react";
import {
  Zap, ChevronDown, ChevronUp, CheckCircle, Clock, X,
  Search, SlidersHorizontal, CalendarIcon, FileText,
  Award, AlertCircle, ArrowUpRight, Briefcase, Target,
  Save, Trash2, Download, Tag, BarChart2, TrendingUp,
  Activity, Eye, Star, ChevronLeft, MapPin, Layers,
  PanelRightOpen, PanelRightClose, RefreshCw,
} from "lucide-react";
import { BGPattern } from "@/components/ui/bg_pattern";
import { SlidingNumber } from "@/components/ui/sliding_number";
import { SpecialText } from "@/components/ui/special_text";
import { Dock, DockIcon } from "@/components/ui/dock";
import Navbar from "@/components/Navbar";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const OUTCOMES = [
  "No update", "OA to do", "OA done (waiting)",
  "Interview to do (scheduled)", "Interview done (waiting response)",
  "Rejected", "Ghosted", "Offer",
];

const OUTCOME_STYLES: Record<string, { bg: string; text: string; border: string; dot: string; row: string }> = {
  "No update":                         { bg:"bg-stone-800",      text:"text-stone-400",  border:"border-stone-600",      dot:"bg-stone-500",   row:"" },
  "OA to do":                          { bg:"bg-amber-950/80",   text:"text-amber-300",  border:"border-amber-700/60",   dot:"bg-amber-400",   row:"" },
  "OA done (waiting)":                 { bg:"bg-amber-950/60",   text:"text-amber-200",  border:"border-amber-700/40",   dot:"bg-amber-300",   row:"" },
  "Interview to do (scheduled)":       { bg:"bg-sky-950/80",     text:"text-sky-300",    border:"border-sky-700/60",     dot:"bg-sky-400",     row:"bg-sky-500/[0.02]" },
  "Interview done (waiting response)": { bg:"bg-sky-950/60",     text:"text-sky-200",    border:"border-sky-700/40",     dot:"bg-sky-300",     row:"bg-sky-500/[0.02]" },
  "Rejected":                          { bg:"bg-red-950/80",     text:"text-red-300",    border:"border-red-700/60",     dot:"bg-red-400",     row:"" },
  "Ghosted":                           { bg:"bg-stone-900/80",   text:"text-stone-500",  border:"border-stone-700/50",   dot:"bg-stone-600",   row:"" },
  "Offer":                             { bg:"bg-emerald-950/80", text:"text-emerald-300",border:"border-emerald-700/60", dot:"bg-emerald-400", row:"bg-emerald-500/[0.02]" },
};
const getOS = (o: string | null) => OUTCOME_STYLES[o ?? "No update"] ?? OUTCOME_STYLES["No update"];

const CONFETTI_PARTICLES = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  x: (Math.random() - 0.5) * 400,
  y: -(Math.random() * 300 + 80),
  color: ["#f59e0b","#10b981","#3b82f6","#fbbf24","#34d399","#60a5fa"][i % 6],
  size: Math.random() * 7 + 3,
  rotate: Math.random() * 360,
  isCircle: Math.random() > 0.5,
}));

// ─── MULTI-FIELD FILTER ───────────────────────────────────────────────────────

const multiFieldFilter: FilterFn<SupabaseJob> = (row, _columnId, filterValue: string) => {
  const q = filterValue.toLowerCase().trim();
  if (!q) return true;
  const job = row.original;
  return [job.title, job.company, job.location, job.job_desc, String(job.id)]
    .some((v) => v?.toLowerCase().includes(q));
};
multiFieldFilter.autoRemove = (val: string) => !val;

// ─── LIVE CLOCK ───────────────────────────────────────────────────────────────

const LiveClock = () => {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[13px] text-amber-600/70 tabular-nums tracking-wider select-none">
      {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
    </span>
  );
};

// ─── TYPEWRITER SEARCH PLACEHOLDER ───────────────────────────────────────────

const PLACEHOLDERS = [
  "Search by role, company, city…",
  "Try \"software engineer\"…",
  "Try \"Toronto\" or \"remote\"…",
  "Try \"interview\" or score > 70…",
  "Search by job ID…",
];

function useTypewriterPlaceholder() {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [phase, setPhase] = useState<"typing" | "pause" | "erasing">("typing");
  const charRef = useRef(0);

  useEffect(() => {
    const target = PLACEHOLDERS[idx];
    let timer: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (charRef.current < target.length) {
        timer = setTimeout(() => { charRef.current++; setDisplayed(target.slice(0, charRef.current)); }, 38);
      } else {
        timer = setTimeout(() => setPhase("pause"), 1800);
      }
    } else if (phase === "pause") {
      timer = setTimeout(() => setPhase("erasing"), 600);
    } else {
      if (charRef.current > 0) {
        timer = setTimeout(() => { charRef.current--; setDisplayed(target.slice(0, charRef.current)); }, 18);
      } else {
        timer = setTimeout(() => {
          setIdx((i) => (i + 1) % PLACEHOLDERS.length);
          setPhase("typing");
        }, 0);
      }
    }
    return () => clearTimeout(timer);
  }, [phase, displayed, idx]);

  return displayed || PLACEHOLDERS[0];
}

// ─── KEYBOARD HINT ────────────────────────────────────────────────────────────

const KbdHint = ({ keys }: { keys: string[] }) => (
  <span className="flex items-center gap-0.5">
    {keys.map(k => (
      <kbd key={k} className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700/50 text-[10px] font-mono text-stone-400 leading-none">
        {k}
      </kbd>
    ))}
  </span>
);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getDaysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.ceil((d.getTime() - t.getTime()) / 86400000);
}

function getDeadlineStyle(dateStr: string | null) {
  const days = getDaysUntil(dateStr);
  if (days === null) return { pill:"bg-stone-900 border-stone-800 text-stone-600", label:"", urgent:false };
  if (days < 0)   return { pill:"bg-stone-900 border-stone-800 text-stone-600",              label:`${Math.abs(days)}d ago`, urgent:false };
  if (days === 0) return { pill:"bg-sky-950 border-sky-600 text-sky-200",                    label:"Today!",        urgent:true  };
  if (days <= 3)  return { pill:"bg-red-950 border-red-700 text-red-300",                    label:`${days}d left`, urgent:true  };
  if (days <= 7)  return { pill:"bg-amber-950 border-amber-700/60 text-amber-300",           label:`${days}d left`, urgent:false };
  if (days <= 14) return { pill:"bg-amber-950/60 border-amber-800/40 text-amber-400/70",     label:`${days}d left`, urgent:false };
  return           { pill:"bg-emerald-950 border-emerald-800/50 text-emerald-500/70",        label:`${days}d left`, urgent:false };
}

function fmtDeadline(dateStr: string | null) {
  if (!dateStr) return "Set deadline";
  const d = new Date(dateStr);
  const hasTime = dateStr.includes("T") && !dateStr.endsWith("T00:00") && !dateStr.endsWith("T00:00:00");
  if (hasTime) return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}) + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

// ─── PORTAL DROPDOWN ─────────────────────────────────────────────────────────

function usePortalDropdown() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const openDropdown = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setCoords({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
    setOpen(true);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        const portalEls = Array.from(document.querySelectorAll("[data-portal-dropdown]"));
        for (const el of portalEls) {
          if (el.contains(e.target as Node)) return;
        }
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const handler = () => close();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [open, close]);

  return { triggerRef, open, openDropdown, close, coords };
}

// ─── CONFETTI ─────────────────────────────────────────────────────────────────

const ConfettiBurst = ({ active, onDone }: { active:boolean; onDone:()=>void }) => {
  useEffect(() => { if (active) { const t = setTimeout(onDone, 2200); return () => clearTimeout(t); } }, [active, onDone]);
  if (!active) return null;
  return ReactDOM.createPortal(
    <div className="fixed inset-0 pointer-events-none z-[9999] flex items-center justify-center">
      {CONFETTI_PARTICLES.map(p => (
        <motion.div key={p.id}
          initial={{ x:0, y:0, opacity:1, scale:0 }}
          animate={{ x:p.x, y:p.y, opacity:0, scale:1, rotate:p.rotate }}
          transition={{ duration:1.6, ease:"easeOut" }}
          style={{ position:"absolute", width:p.size, height:p.size, backgroundColor:p.color, borderRadius:p.isCircle?"50%":"2px" }}
        />
      ))}
    </div>,
    document.body
  );
};

// ─── SAVE INDICATOR ───────────────────────────────────────────────────────────

const SaveIndicator = ({ saving }: { saving:boolean }) => (
  <AnimatePresence>
    {saving && (
      <motion.div
        initial={{ opacity:0, y:8, scale:0.9 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-8, scale:0.9 }}
        transition={{ duration:0.2 }}
        className="fixed bottom-24 right-6 z-[9998] flex items-center gap-2 bg-stone-900 border border-emerald-600/30 text-emerald-400 text-xs font-medium px-3 py-2 rounded-xl shadow-xl"
        style={{ backdropFilter: "blur(12px)" }}
      >
        <Save className="w-3 h-3" /><span>Saved</span>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── TOAST ────────────────────────────────────────────────────────────────────

const Toast = ({ message, visible }: { message: string; visible: boolean }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-5 py-3 rounded-2xl border border-stone-700/50 shadow-xl"
        style={{ background: "rgba(14,11,9,0.96)", backdropFilter: "blur(16px)" }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[12px] text-stone-300 font-medium">{message}</span>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── PIPELINE BAR ─────────────────────────────────────────────────────────────

const PipelineBar = ({ jobs }: { jobs:SupabaseJob[] }) => {
  const stages = [
    { key:"No update",                         color:"bg-stone-700",      label:"Pending" },
    { key:"OA to do",                          color:"bg-amber-500/80",   label:"OA" },
    { key:"OA done (waiting)",                 color:"bg-amber-400/50",   label:"OA Wait" },
    { key:"Interview to do (scheduled)",       color:"bg-sky-500/90",     label:"Interview" },
    { key:"Interview done (waiting response)", color:"bg-sky-400/60",     label:"Int. Wait" },
    { key:"Offer",                             color:"bg-emerald-500",    label:"Offer" },
    { key:"Rejected",                          color:"bg-red-500/70",     label:"Rejected" },
    { key:"Ghosted",                           color:"bg-red-500/25",     label:"Ghosted" },
  ];
  const counts: Record<string,number> = {};
  stages.forEach(s => { counts[s.key] = jobs.filter(j => (j.feedback_status||"No update") === s.key).length; });
  const total = jobs.length || 1;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-px w-8 bg-amber-600/50" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-stone-500">Pipeline</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-stone-900 mb-3">
        {stages.map(s => counts[s.key] > 0 && (
          <motion.div key={s.key} initial={{ width:0 }} animate={{ width:`${(counts[s.key]/total)*100}%` }}
            transition={{ duration:0.8, delay:0.3, ease:[0.16,1,0.3,1] }}
            className={`h-full ${s.color}`} title={`${s.label}: ${counts[s.key]}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-3">
        {stages.filter(s => counts[s.key] > 0).map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
            <span className="text-[11px] font-mono text-stone-500">{s.label} <span className="text-stone-400">{counts[s.key]}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── ANALYTICS DRAWER ────────────────────────────────────────────────────────

const AnalyticsDrawer = ({ open, onClose, jobs }: { open: boolean; onClose: () => void; jobs: SupabaseJob[] }) => {
  const interviews   = jobs.filter(j => j.feedback_status?.includes("Interview")).length;
  const offers       = jobs.filter(j => j.feedback_status === "Offer").length;
  const rejected     = jobs.filter(j => j.feedback_status === "Rejected").length;
  const ghosted      = jobs.filter(j => j.feedback_status === "Ghosted").length;
  const oaPending    = jobs.filter(j => j.feedback_status === "OA to do").length;
  const urgentCount  = jobs.filter(j => { const d = getDaysUntil(j.deadline ?? null); return d !== null && d >= 0 && d <= 3; }).length;
  const withDeadline = jobs.filter(j => j.deadline).length;
  const withNotes    = jobs.filter(j => j.notes && j.notes.trim().length > 0).length;
  const scoredJobs   = jobs.filter(j => j.score);
  const avgScore     = scoredJobs.length
    ? Math.round(scoredJobs.reduce((a, b) => a + (b.score || 0), 0) / scoredJobs.length)
    : 0;
  const topScore     = scoredJobs.length ? Math.max(...scoredJobs.map(j => j.score as number)) : 0;
  const responseRate = jobs.length
    ? Math.round(((interviews + offers + rejected) / jobs.length) * 100)
    : 0;

  const statRows = [
    { label: "Applied",        value: jobs.length,    color: "#a8a29e", icon: <Briefcase className="w-3.5 h-3.5" />,   suffix: "" },
    { label: "Interviews",     value: interviews,     color: "#38bdf8", icon: <Target className="w-3.5 h-3.5" />,      suffix: "" },
    { label: "Offers",         value: offers,         color: "#34d399", icon: <Award className="w-3.5 h-3.5" />,       suffix: "" },
    { label: "OA Pending",     value: oaPending,      color: "#f59e0b", icon: <Activity className="w-3.5 h-3.5" />,    suffix: "" },
    { label: "Rejected",       value: rejected,       color: "#f87171", icon: <X className="w-3.5 h-3.5" />,           suffix: "" },
    { label: "Ghosted",        value: ghosted,        color: "#78716c", icon: <Eye className="w-3.5 h-3.5" />,         suffix: "" },
    { label: "Avg Score",      value: avgScore,       color: "#fb923c", icon: <TrendingUp className="w-3.5 h-3.5" />,  suffix: "" },
    { label: "Top Score",      value: topScore,       color: "#fcd34d", icon: <Star className="w-3.5 h-3.5" />,        suffix: "" },
    { label: "Response Rate",  value: responseRate,   color: "#a78bfa", icon: <BarChart2 className="w-3.5 h-3.5" />,   suffix: "%" },
    { label: "Urgent",         value: urgentCount,    color: urgentCount > 0 ? "#f87171" : "#78716c", icon: <AlertCircle className="w-3.5 h-3.5" />, suffix: "" },
    { label: "With Deadline",  value: withDeadline,   color: "#60a5fa", icon: <CalendarIcon className="w-3.5 h-3.5" />,suffix: "" },
    { label: "With Notes",     value: withNotes,      color: "#86efac", icon: <FileText className="w-3.5 h-3.5" />,    suffix: "" },
  ];

  // Outcome distribution mini chart
  const outcomeStages = [
    { key: "OA to do",                          label: "OA",        color: "#f59e0b" },
    { key: "OA done (waiting)",                 label: "OA Wait",   color: "#fbbf24" },
    { key: "Interview to do (scheduled)",       label: "Interview", color: "#38bdf8" },
    { key: "Interview done (waiting response)", label: "Int Wait",  color: "#7dd3fc" },
    { key: "Offer",                             label: "Offer",     color: "#34d399" },
    { key: "Rejected",                          label: "Rejected",  color: "#f87171" },
    { key: "Ghosted",                           label: "Ghosted",   color: "#78716c" },
    { key: "No update",                         label: "Pending",   color: "#44403c" },
  ];
  const maxCount = Math.max(...outcomeStages.map(s => jobs.filter(j => (j.feedback_status || "No update") === s.key).length), 1);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40" onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 360, damping: 36, mass: 0.9 }}
            className="fixed right-0 top-14 bottom-0 z-50 w-80 border-l border-stone-800/50 overflow-y-auto"
            style={{ background: "rgba(12,10,9,0.97)", backdropFilter: "blur(16px)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-800/40 sticky top-0 z-10"
              style={{ background: "rgba(12,10,9,0.97)", backdropFilter: "blur(16px)" }}
            >
              <div className="flex items-center gap-2.5">
                <BarChart2 className="w-4 h-4 text-amber-500/60" />
                <span className="font-semibold text-stone-200 text-sm">Analytics</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-500 hover:text-amber-400 hover:bg-stone-800/60 transition-all"
                  title="Collapse"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-500 hover:text-stone-200 hover:bg-stone-800/60 transition-all"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stat rows */}
            <div className="p-5 space-y-2.5">
              {statRows.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-stone-800/40"
                  style={{ background: "rgba(28,24,20,0.6)" }}
                >
                  <div className="flex items-center gap-2.5">
                    <span style={{ color: s.color }}>{s.icon}</span>
                    <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">{s.label}</span>
                  </div>
                  <span className="text-lg font-black tabular-nums" style={{ color: s.color }}>
                    <SlidingNumber value={s.value} />{s.suffix}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Outcome distribution chart */}
            <div className="px-5 pb-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-stone-600 mb-4">Outcome Distribution</p>
              <div className="flex items-end gap-1.5 h-24">
                {outcomeStages.map((stage, i) => {
                  const count = jobs.filter(j => (j.feedback_status || "No update") === stage.key).length;
                  const heightPct = (count / maxCount) * 100;
                  return (
                    <div key={stage.key} className="flex-1 flex flex-col items-center gap-1 group">
                      <div className="w-full flex flex-col justify-end" style={{ height: 72 }}>
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(heightPct, count > 0 ? 6 : 0)}%` }}
                          transition={{ duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                          className="w-full rounded-t-sm relative overflow-hidden cursor-default"
                          style={{
                            backgroundColor: `${stage.color}30`,
                            border: `1px solid ${stage.color}40`,
                            borderBottom: "none",
                          }}
                          title={`${stage.label}: ${count}`}
                        >
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "100%" }}
                            transition={{ duration: 0.9, delay: i * 0.08 + 0.15 }}
                            className="absolute bottom-0 left-0 right-0 rounded-t-sm"
                            style={{ background: `linear-gradient(to top, ${stage.color}60, ${stage.color}20)` }}
                          />
                        </motion.div>
                      </div>
                      <span className="text-[8px] font-mono text-stone-600 group-hover:text-stone-400 transition-colors text-center leading-tight">
                        {stage.label.slice(0, 4)}
                      </span>
                      <span className="text-[9px] font-semibold tabular-nums" style={{ color: stage.color }}>
                        {count > 0 ? count : "·"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── OUTCOME DROPDOWN — portal-based ─────────────────────────────────────────

const OutcomeDropdown = ({ job, onChange }: { job:SupabaseJob; onChange:(id:number,val:string)=>void }) => {
  const { triggerRef, open, openDropdown, close, coords } = usePortalDropdown();
  const outcome = job.feedback_status || "No update";
  const s = getOS(outcome);

  const handleSelect = (o: string) => {
    onChange(job.id, o);
    close();
  };

  const menu = open ? ReactDOM.createPortal(
    <div
      data-portal-dropdown="true"
      style={{
        position: "absolute",
        top: coords.top,
        left: coords.left,
        zIndex: 9999,
        minWidth: 240,
      }}
    >
      <motion.div
        initial={{ opacity:0, y:-6, scale:0.97 }}
        animate={{ opacity:1, y:0, scale:1 }}
        exit={{ opacity:0, y:-6, scale:0.97 }}
        transition={{ duration:0.13, ease:[0.16,1,0.3,1] }}
        style={{ backgroundColor: "#0c0a09", border: "1px solid rgba(68,64,60,0.6)", borderRadius: 12, boxShadow: "0 24px 64px rgba(0,0,0,0.85)" }}
      >
        {OUTCOMES.map((o) => {
          const os = getOS(o);
          const isActive = o === outcome;
          return (
            <button
              key={o}
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleSelect(o); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 14px",
                background: isActive ? "rgba(245,158,11,0.08)" : "transparent",
                border: "none", borderLeft: isActive ? "2px solid #f59e0b" : "2px solid transparent",
                cursor: "pointer", textAlign: "left",
                fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 13, fontWeight: isActive ? 600 : 400,
                transition: "background 0.1s",
              }}
              className={`${isActive ? os.text : "text-stone-300"} hover:bg-stone-800/50`}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${os.dot}`} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{o}</span>
              {isActive && <CheckCircle style={{ width: 12, height: 12, opacity: 0.6, flexShrink: 0 }} />}
            </button>
          );
        })}
      </motion.div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        onClick={(e) => { e.stopPropagation(); open ? close() : openDropdown(); }}
        className={`inline-flex items-center gap-2 px-3 py-2 border rounded-xl transition-all duration-150 cursor-pointer select-none w-full ${s.bg} ${s.text} ${s.border}`}
        style={{ fontSize: 12, fontWeight: 500, whiteSpace: "normal", wordBreak: "break-word", minWidth: 0 }}
      >
        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.dot}`} />
        <span className="flex-1 text-left leading-snug">{outcome}</span>
        <ChevronDown className={`w-3 h-3 opacity-50 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {menu}
    </>
  );
};

// ─── DEADLINE CELL ────────────────────────────────────────────────────────────

const DeadlineCell = ({ job, onUpdate }: { job:SupabaseJob; onUpdate:(id:number,date:string|null)=>void }) => {
  const { triggerRef, open, openDropdown, close, coords } = usePortalDropdown();
  const [pd, setPd] = useState("");
  const [pt, setPt] = useState("");
  const { pill, label, urgent } = getDeadlineStyle(job.deadline ?? null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) { close(); return; }
    if (job.deadline) {
      const d = new Date(job.deadline);
      setPd(d.toISOString().split("T")[0]);
      setPt(String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0"));
    } else { setPd(""); setPt(""); }
    openDropdown();
  };

  const confirm = () => {
    if (!pd) { onUpdate(job.id, null); close(); return; }
    onUpdate(job.id, pt && pt !== "00:00" ? `${pd}T${pt}` : pd);
    close();
  };

  const picker = open ? ReactDOM.createPortal(
    <div
      data-portal-dropdown="true"
      style={{ position: "absolute", top: coords.top, left: coords.left, zIndex: 9999, width: 220 }}
    >
      <motion.div
        initial={{ opacity:0, scale:0.95, y:-4 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.95, y:-4 }}
        transition={{ duration:0.13, ease:[0.16,1,0.3,1] }}
        style={{ backgroundColor: "#0c0a09", border: "1px solid rgba(68,64,60,0.6)", borderRadius: 12, padding: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.85)" }}
      >
        <p style={{ fontFamily:"system-ui, -apple-system, sans-serif", fontSize:10, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.1em", color:"#78716c", marginBottom:6 }}>Date</p>
        <input
          type="date" value={pd} onChange={e => setPd(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          style={{ width:"100%", padding:"6px 10px", background:"rgba(28,24,20,0.9)", border:"1px solid rgba(68,64,60,0.6)", color:"#e7e5e4", fontFamily:"system-ui, -apple-system, sans-serif", fontSize:13, borderRadius:8, marginBottom:10, outline:"none", boxSizing:"border-box" }}
        />
        <p style={{ fontFamily:"system-ui, -apple-system, sans-serif", fontSize:10, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.1em", color:"#78716c", marginBottom:6 }}>Time — 24hr (optional)</p>
        <input
          type="time" value={pt} onChange={e => setPt(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          style={{ width:"100%", padding:"6px 10px", background:"rgba(28,24,20,0.9)", border:"1px solid rgba(68,64,60,0.6)", color:"#e7e5e4", fontFamily:"system-ui, -apple-system, sans-serif", fontSize:13, borderRadius:8, marginBottom:12, outline:"none", boxSizing:"border-box" }}
        />
        <div style={{ display:"flex", gap:8 }}>
          <button
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); confirm(); }}
            style={{ flex:1, padding:"7px 0", background:"#f59e0b", color:"#0c0a09", fontFamily:"system-ui, -apple-system, sans-serif", fontSize:13, fontWeight:700, border:"none", borderRadius:8, cursor:"pointer" }}
          >
            Confirm
          </button>
          {job.deadline && (
            <button
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onUpdate(job.id, null); close(); }}
              style={{ padding:"7px 12px", background:"rgba(40,35,30,0.9)", color:"#f87171", fontFamily:"system-ui, -apple-system, sans-serif", fontSize:13, border:"1px solid rgba(68,64,60,0.6)", borderRadius:8, cursor:"pointer" }}
            >
              Clear
            </button>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-2 px-3 py-2 border rounded-xl transition-all duration-150 cursor-pointer select-none w-full ${pill} ${urgent ? "animate-pulse" : ""}`}
        style={{ fontSize: 12, whiteSpace: "normal", wordBreak: "break-word", minWidth: 0 }}
      >
        <CalendarIcon className="w-3 h-3 opacity-70 shrink-0" />
        <span className="flex-1 text-left leading-snug">{fmtDeadline(job.deadline ?? null)}{job.deadline && label ? <span className="opacity-50"> · {label}</span> : null}</span>
      </button>
      {picker}
    </>
  );
};

// ─── NOTES CELL ───────────────────────────────────────────────────────────────

const NotesCell = ({ job, onUpdate }: { job:SupabaseJob; onUpdate:(id:number,notes:string)=>void }) => {
  const { triggerRef, open, openDropdown, close, coords } = usePortalDropdown();
  const [draft, setDraft] = useState(job.notes ?? "");

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) { close(); return; }
    setDraft(job.notes ?? "");
    openDropdown();
  };

  const save = () => { onUpdate(job.id, draft); close(); };

  const panel = open ? ReactDOM.createPortal(
    <div
      data-portal-dropdown="true"
      style={{ position: "absolute", top: coords.top, left: Math.max(8, coords.left - 60), zIndex: 9999, width: 260 }}
    >
      <motion.div
        initial={{ opacity:0, scale:0.95, y:-4 }}
        animate={{ opacity:1, scale:1, y:0 }}
        exit={{ opacity:0, scale:0.95, y:-4 }}
        transition={{ duration:0.13, ease:[0.16,1,0.3,1] }}
        style={{ backgroundColor: "#0c0a09", border: "1px solid rgba(68,64,60,0.6)", borderRadius: 12, padding: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.85)" }}
      >
        <p style={{ fontFamily:"system-ui, -apple-system, sans-serif", fontSize:10, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.1em", color:"#78716c", marginBottom:8 }}>Notes</p>
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onKeyDown={e => { if (e.key==="Enter"&&(e.metaKey||e.ctrlKey)) save(); if (e.key==="Escape") close(); }}
          placeholder="Add notes about this job..."
          rows={4}
          style={{ width:"100%", padding:"8px 10px", background:"rgba(28,24,20,0.9)", border:"1px solid rgba(68,64,60,0.6)", color:"#e7e5e4", fontFamily:"system-ui, -apple-system, sans-serif", fontSize:13, borderRadius:8, marginBottom:10, outline:"none", resize:"none", boxSizing:"border-box" }}
        />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontFamily:"system-ui, -apple-system, sans-serif", fontSize:11, color:"#78716c" }}>⌘↵ to save</span>
          <button
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); save(); }}
            style={{ padding:"6px 14px", background:"#f59e0b", color:"#0c0a09", fontFamily:"system-ui, -apple-system, sans-serif", fontSize:13, fontWeight:700, border:"none", borderRadius:8, cursor:"pointer" }}
          >
            Save
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        title={job.notes ?? ""}
        className={`inline-flex items-center gap-2 px-3 py-2 border rounded-xl transition-all duration-150 cursor-pointer w-full ${job.notes ? "bg-stone-800/60 border-stone-600/50 text-stone-200" : "bg-transparent border-stone-800/50 text-stone-600 hover:border-stone-700/60 hover:text-stone-400"}`}
        style={{ fontSize: 12, whiteSpace: "normal", wordBreak: "break-word", minWidth: 0 }}
      >
        <FileText className="w-3 h-3 opacity-60 shrink-0" />
        <span className="flex-1 text-left leading-snug">{job.notes ? job.notes.slice(0,32)+(job.notes.length>32?"…":"") : "Add note"}</span>
      </button>
      {panel}
    </>
  );
};

// ─── SCORE DISPLAY ────────────────────────────────────────────────────────────

const ScoreDisplay = ({ score }: { score:number|null }) => {
  if (!score) return <span className="text-stone-700 text-base font-mono">—</span>;
  const getTheme = (s: number) => {
    if (s >= 85) return { text: "#f59e0b", barFrom: "#fbbf24", barTo: "#f59e0b" };
    if (s >= 70) return { text: "#fb923c", barFrom: "#fb923c", barTo: "#f97316" };
    if (s >= 50) return { text: "#d97706", barFrom: "#d97706", barTo: "#b45309" };
    return             { text: "#78716c", barFrom: "#78716c", barTo: "#57534e" };
  };
  const c = getTheme(score);
  return (
    <div className="flex flex-col gap-2 py-0.5">
      <div className="flex items-baseline gap-1">
        <span className="text-[18px] font-black tabular-nums leading-none" style={{ color: c.text, textShadow: `0 0 18px ${c.text}44` }}>
          {score}
        </span>
        <span className="text-[10px] font-mono text-stone-600">/100</span>
      </div>
      <div className="w-12 h-[3px] bg-stone-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(to right, ${c.barFrom}, ${c.barTo})` }}
        />
      </div>
    </div>
  );
};

// ─── QUICK FILTER PILLS ───────────────────────────────────────────────────────

const QUICK_FILTERS = [
  { label: "Interviews",   outcomeFilter: "Interview to do (scheduled)", minScore: "" },
  { label: "OA Pending",   outcomeFilter: "OA to do",                    minScore: "" },
  { label: "Offers",       outcomeFilter: "Offer",                       minScore: "" },
  { label: "Urgent",       outcomeFilter: "all",                         minScore: "" }, // handled specially
];

// ─── ROW ACCENT COLOR ─────────────────────────────────────────────────────────

function rowAccentColor(job: SupabaseJob): string {
  if (job.feedback_status === "Offer")     return "rgba(52,211,153,0.6)";
  if (job.feedback_status?.includes("Interview")) return "rgba(56,189,248,0.45)";
  if (job.feedback_status?.includes("OA")) return "rgba(245,158,11,0.4)";
  if (job.feedback_status === "Rejected")  return "rgba(248,113,113,0.3)";
  const days = getDaysUntil(job.deadline ?? null);
  if (days !== null && days >= 0 && days <= 3) return "rgba(248,113,113,0.5)";
  if (job.score && job.score >= 80) return "rgba(245,158,11,0.35)";
  return "transparent";
}

// ─── JOB ROW ──────────────────────────────────────────────────────────────────

const JobRow = ({ row, index, onClick, onOutcomeChange, onDeadlineUpdate, onNotesUpdate, selected, onSelect }: {
  row: ReturnType<ReturnType<typeof useReactTable>["getRowModel"]>["rows"][0];
  index: number; onClick: ()=>void;
  onOutcomeChange: (id:number,val:string)=>void;
  onDeadlineUpdate: (id:number,date:string|null)=>void;
  onNotesUpdate: (id:number,notes:string)=>void;
  selected: boolean; onSelect: (id:number, checked:boolean)=>void;
}) => {
  const ref = useRef<HTMLTableRowElement>(null);
  const inView = useInView(ref, { once:true, margin:"-10px" });
  const [hovered, setHovered] = useState(false);
  const job = row.original as unknown as SupabaseJob;
  const days = getDaysUntil(job.deadline ?? null);
  const isUrgent = days !== null && days >= 0 && days <= 3;
  const accent = rowAccentColor(job);

  return (
    <motion.tr
      ref={ref}
      initial={{ opacity:0, y:10, filter:"blur(4px)" }}
      animate={inView ? { opacity:1, y:0, filter:"blur(0px)" } : {}}
      transition={{ duration:0.45, delay:Math.min(index*0.03, 0.4), ease:[0.16,1,0.3,1] }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer transition-colors duration-150 border-b border-stone-800/40 last:border-0"
      style={{
        borderLeft: `2px solid ${hovered ? accent : accent.replace(/[\d.]+\)$/, m => String(parseFloat(m) * 0.5) + ")")}`,
        backgroundColor: selected ? "rgba(245,158,11,0.04)" : hovered ? "rgba(30,25,20,0.6)" : "transparent",
      }}
    >
      <td className="px-3 py-4 w-10 align-top" onClick={e => e.stopPropagation()}>
        <motion.div animate={{ opacity: hovered||selected ? 1 : 0 }} transition={{ duration:0.15 }}>
          <input type="checkbox" checked={selected} onChange={e => onSelect(job.id, e.target.checked)}
            className="w-3.5 h-3.5 rounded-sm border-stone-600 bg-stone-800 accent-amber-500 cursor-pointer"
          />
        </motion.div>
      </td>

      {row.getVisibleCells().map(cell => {
        const id = cell.column.id;
        const isInteractive = ["feedback_status","deadline","notes"].includes(id);
        return (
          <td
            key={cell.id}
            className="px-4 py-4 align-top"
            onClick={isInteractive ? e => e.stopPropagation() : onClick}
          >
            {id === "feedback_status"
              ? <OutcomeDropdown job={job} onChange={onOutcomeChange} />
              : id === "deadline"
              ? <DeadlineCell job={job} onUpdate={onDeadlineUpdate} />
              : id === "notes"
              ? <NotesCell job={job} onUpdate={onNotesUpdate} />
              : flexRender(cell.column.columnDef.cell, cell.getContext())
            }
          </td>
        );
      })}

      <td className="px-3 py-4 w-8 align-top">
        <AnimatePresence>
          {hovered && !selected && (
            <motion.div initial={{ opacity:0, x:-4 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-4 }} transition={{ duration:0.12 }}
              className="text-amber-600/40" onClick={onClick}
            >
              <ArrowUpRight className="w-4 h-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </motion.tr>
  );
};

// ─── FLOATING DOCK ────────────────────────────────────────────────────────────

const FloatingDock = ({ selectedIds, onBulkOutcome, onExportCSV, onClear }: {
  selectedIds: number[];
  onBulkOutcome: (outcome:string) => void;
  // onBulkDelete: () => void;
  onExportCSV: () => void;
  onClear: () => void;
}) => {
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const count = selectedIds.length;
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          initial={{ y:100, opacity:0, filter:"blur(8px)" }}
          animate={{ y:0, opacity:1, filter:"blur(0px)" }}
          exit={{ y:100, opacity:0, filter:"blur(8px)" }}
          transition={{ type:"spring", stiffness:400, damping:30, mass:0.8 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="relative">
            <AnimatePresence>
              {outcomeOpen && (
                <motion.div
                  initial={{ opacity:0, y:8, scale:0.95 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:8, scale:0.95 }}
                  transition={{ type:"spring", stiffness:400, damping:25 }}
                  className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 min-w-[220px] overflow-hidden rounded-2xl border border-stone-700/50 shadow-2xl"
                  style={{ backgroundColor: "#0c0a09", backdropFilter: "blur(16px)" }}
                >
                  <p className="text-[10px] font-mono uppercase tracking-widest text-stone-500 px-3 py-2.5 border-b border-stone-800/50">
                    Set outcome for {count} job{count>1?"s":""}
                  </p>
                  {OUTCOMES.map(o => {
                    const os = getOS(o);
                    return (
                      <button key={o} onClick={() => { onBulkOutcome(o); setOutcomeOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-[13px] hover:bg-stone-800/50 transition-colors cursor-pointer ${os.text}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${os.dot}`} />{o}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
            <Dock magnification={52} distance={100}>
              <div className="flex items-center justify-center px-3 h-9 bg-amber-500/10 border border-amber-700/30 rounded-xl">
                <span className="text-amber-400 text-sm font-semibold">{count} selected</span>
              </div>
              <div className="w-px h-6 bg-stone-700/60 self-center" />
              <DockIcon label="Set Outcome" onClick={() => setOutcomeOpen(o => !o)} className="bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/40 text-stone-300 hover:text-stone-100 transition-colors"><Tag className="w-4 h-4" /></DockIcon>
              <DockIcon label="Export CSV" onClick={onExportCSV} className="bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/40 text-stone-300 hover:text-stone-100 transition-colors"><Download className="w-4 h-4" /></DockIcon>
              {/* <DockIcon label="Delete selected" onClick={onBulkDelete} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></DockIcon> */}
              <DockIcon label="Clear selection" onClick={onClear} className="bg-stone-800/80 hover:bg-stone-700/80 border border-stone-700/40 text-stone-400 hover:text-stone-200 transition-colors"><X className="w-4 h-4" /></DockIcon>
            </Dock>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

const AppliedDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<SupabaseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([{ id:"score", desc:true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [pulseFresh, setPulseFresh] = useState(false);
  const [density, setDensity] = useState<"comfortable"|"compact">("comfortable");
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const placeholder = useTypewriterPlaceholder();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await supabase.from("jobs").select("*").eq("application_status","Applied");
    if (data) {
      setJobs(data as SupabaseJob[]);
      if (isRefresh) showToast(`Refreshed — ${data.length} applications loaded`);
    }
    if (isRefresh) setRefreshing(false); else setLoading(false);
    setPulseFresh(true);
    setTimeout(() => setPulseFresh(false), 3000);
  }, []);

  useEffect(() => { fetchJobs(false); }, [fetchJobs]);

  // ⌘K → focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ⌘R → refresh
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") { e.preventDefault(); fetchJobs(true); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [fetchJobs]);

  const flash = () => { setSaving(true); setTimeout(() => setSaving(false), 1800); };

  const handleOutcomeChange = async (jobId: number, newOutcome: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, feedback_status: newOutcome } : j));
    flash();
    if (newOutcome === "Offer") setConfetti(true);
    const { error } = await supabase.from("jobs").update({ feedback_status: newOutcome }).eq("id", jobId);
    if (error) console.error("outcome update failed:", error);
  };

  const handleDeadlineUpdate = async (jobId: number, date: string | null) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, deadline: date } : j));
    flash();
    const { error } = await supabase.from("jobs").update({ deadline: date }).eq("id", jobId);
    if (error) console.error("deadline update failed:", error);
  };

  const handleNotesUpdate = async (jobId: number, notes: string) => {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, notes } : j));
    flash();
    const { error } = await supabase.from("jobs").update({ notes }).eq("id", jobId);
    if (error) console.error("notes update failed:", error);
  };

  const handleBulkOutcome = async (outcome: string) => {
    setJobs(prev => prev.map(j => selectedIds.includes(j.id) ? { ...j, feedback_status: outcome } : j));
    setSelectedIds([]);
    flash();
    if (outcome === "Offer") setConfetti(true);
    await Promise.all(selectedIds.map(id => supabase.from("jobs").update({ feedback_status: outcome }).eq("id", id)));
  };

  // const handleBulkDelete = async () => {
  //   setJobs(prev => prev.filter(j => !selectedIds.includes(j.id)));
  //   setSelectedIds([]);
  //   flash();
  //   await Promise.all(selectedIds.map(id => supabase.from("jobs").delete().eq("id", id)));
  // };

  const handleExportCSV = () => {
    const toExport = selectedIds.length > 0
      ? jobs.filter(j => selectedIds.includes(j.id))
      : table.getFilteredRowModel().rows.map(r => r.original);
    const headers = ["Title","Company","Location","Score","Outcome","Deadline","Notes"];
    const rows = toExport.map(j => [j.title,j.company,j.location,j.score,j.feedback_status,j.deadline,j.notes].map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(","));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([[headers.join(","), ...rows].join("\n")],{type:"text/csv"}));
    a.download = `applied-jobs-${Date.now()}.csv`; a.click();
  };

  const handleRowSelect = (id: number, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(x => x !== id));
  };

  const paddingY = density === "compact" ? "py-2.5" : "py-4";

  const columns: ColumnDef<SupabaseJob>[] = [
    {
      accessorKey: "score", header: "Score", id: "score", size: 100,
      filterFn: (row, id, fv) => { const s = row.getValue(id) as number|null; return s !== null && s >= Number(fv); },
      cell: ({ getValue }) => <ScoreDisplay score={getValue() as number|null} />,
    },
    {
      accessorKey: "title", header: "Position", id: "title",
      cell: ({ getValue, row }) => (
        <div className="min-w-0 py-0.5">
          <div className="text-stone-100 text-[15px] font-semibold leading-snug break-words whitespace-normal mb-1">
            {getValue() as string}
          </div>
          <div className="text-stone-400 text-[13px] font-medium break-words whitespace-normal">
            {row.original.company}{row.original.location ? (
              <span className="text-stone-600"> · <MapPin className="w-2.5 h-2.5 inline-block mr-0.5 mb-0.5" />{row.original.location}</span>
            ) : ""}
          </div>
        </div>
      ),
    },
    {
      id: "feedback_status", header: "Outcome", accessorKey: "feedback_status", size: 195,
      filterFn: (row, id, fv) => {
        if (fv === "all") return true;
        return ((row.getValue(id) as string|null)??"No update") === fv;
      },
      cell: () => null,
    },
    {
      id: "deadline", header: "Deadline", accessorKey: "deadline", size: 150,
      cell: () => null,
    },
    {
      id: "notes", header: "Notes", accessorKey: "notes", size: 155,
      cell: () => null,
    },
  ];

  const table = useReactTable({
    data: jobs, columns,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting, onColumnFiltersChange: setColumnFilters, onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: multiFieldFilter,
    state: { sorting, columnFilters, globalFilter },
  });

  useEffect(() => {
    if (outcomeFilter === "all") setColumnFilters(p => p.filter(f => f.id !== "feedback_status"));
    else setColumnFilters(p => [...p.filter(f => f.id !== "feedback_status"), { id:"feedback_status", value:outcomeFilter }]);
  }, [outcomeFilter]);

  useEffect(() => {
    if (minScore === "") setColumnFilters(p => p.filter(f => f.id !== "score"));
    else setColumnFilters(p => [...p.filter(f => f.id !== "score"), { id:"score", value:Number(minScore) }]);
  }, [minScore]);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const hasActiveFilters = globalFilter || outcomeFilter !== "all" || minScore !== "";

  // Urgent filter (special — not a column filter)
  const [urgentOnly, setUrgentOnly] = useState(false);
  const displayRows = urgentOnly
    ? table.getFilteredRowModel().rows.filter(r => {
        const d = getDaysUntil((r.original as SupabaseJob).deadline ?? null);
        return d !== null && d >= 0 && d <= 3;
      })
    : table.getFilteredRowModel().rows;

  const interviews = jobs.filter(j => j.feedback_status?.includes("Interview")).length;
  const offers = jobs.filter(j => j.feedback_status === "Offer").length;
  const urgentCount = jobs.filter(j => { const d = getDaysUntil(j.deadline??null); return d!==null&&d>=0&&d<=3; }).length;

  return (
    <div
      className="min-h-screen text-stone-100 selection:bg-amber-500/25 selection:text-amber-100"
      style={{ backgroundColor: "#0c0a09" }}
    >
      {/* ── ATMOSPHERE ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <BGPattern variant="dots" fill="rgba(120,80,20,0.035)" size={32} mask="fade-edges" />
        <div className="absolute -top-40 -left-40 w-[800px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(160,90,15,0.07) 0%, transparent 65%)" }}
        />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(20,80,60,0.05) 0%, transparent 65%)" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px]"
          style={{ background: "radial-gradient(ellipse, rgba(160,90,15,0.03) 0%, transparent 60%)" }}
        />
      </div>

      <ConfettiBurst active={confetti} onDone={() => setConfetti(false)} />
      <SaveIndicator saving={saving} />
      <Toast message={toastMsg} visible={toastVisible} />
      <Navbar />
      <AnalyticsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} jobs={jobs} />

      <div className="relative z-10 w-full px-6 lg:px-10 xl:px-14 pt-20 pb-32">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 pt-8"
        >
          {/* Eyebrow */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-amber-600/50" />
              <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-amber-600/55">Fall 2026 Co-op Hunt</span>
              <div className={`flex items-center gap-1.5 transition-opacity duration-1000 ${pulseFresh ? "opacity-100" : "opacity-40"}`}>
                <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${pulseFresh ? "animate-pulse" : ""}`} />
              </div>
            </div>
            <LiveClock />
          </div>

          {/* Title + action row */}
          <div className="flex items-end justify-between flex-wrap gap-5">
            <h1 className="text-5xl lg:text-[3.6rem] text-stone-100 leading-[0.92] tracking-tight font-bold flex items-end gap-3 flex-wrap">
              <span className="text-stone-100">APPLIED JOBS</span>
              <span className="text-amber-500">Dashboard</span>
            </h1>

            <div className="flex items-center gap-2 pb-1">
              {/* Refresh */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => fetchJobs(true)}
                disabled={refreshing}
                className="flex items-center gap-2 border border-stone-700/50 bg-stone-900/40 text-stone-400 text-[12px] font-medium px-3 py-2.5 rounded-xl transition-all hover:border-stone-600/70 hover:text-stone-200 disabled:opacity-40"
                title="Refresh (⌘R)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </motion.button>

              {/* Export CSV */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleExportCSV}
                className="flex items-center gap-2.5 border border-stone-700/50 bg-stone-900/40 text-stone-400 text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all hover:border-stone-600/70 hover:text-stone-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export</span>
              </motion.button>

              {/* Analytics */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setDrawerOpen(o => !o)}
                className={`flex items-center gap-2.5 border px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-200 ${
                  drawerOpen
                    ? "border-amber-700/50 bg-amber-950/40 text-amber-400"
                    : "border-stone-700/50 bg-stone-900/40 text-stone-400 hover:border-stone-600/70 hover:text-stone-200"
                }`}
              >
                {drawerOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                <span>Analytics</span>
              </motion.button>

              {/* Density toggle */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setDensity(d => d === "comfortable" ? "compact" : "comfortable")}
                className="flex items-center gap-1.5 border border-stone-700/40 bg-stone-900/40 text-stone-500 text-[11px] font-medium px-3 py-2.5 rounded-xl transition-all hover:border-stone-600/60 hover:text-stone-300"
                title={`Switch to ${density === "comfortable" ? "compact" : "comfortable"} view`}
              >
                <Layers className="w-3.5 h-3.5" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* ── PIPELINE BAR ── */}
        {jobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
          >
            <PipelineBar jobs={jobs} />
          </motion.div>
        )}

        {/* ── QUICK FILTER PILLS ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-wrap items-center gap-2 mb-5"
        >
          {/* Outcome quick-filters */}
          {[
            { label: "Interviews", value: "Interview to do (scheduled)" },
            { label: "OA Pending", value: "OA to do" },
            { label: "Offers",     value: "Offer" },
            { label: "Rejected",   value: "Rejected" },
          ].map(qf => {
            const isActive = outcomeFilter === qf.value;
            return (
              <button
                key={qf.label}
                onClick={() => setOutcomeFilter(isActive ? "all" : qf.value)}
                className={`flex items-center gap-1.5 border text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 ${
                  isActive
                    ? "border-amber-700/60 bg-amber-950/40 text-amber-400"
                    : "border-stone-800/50 bg-stone-900/30 text-stone-500 hover:border-stone-700/70 hover:text-stone-300"
                }`}
              >
                {isActive && <X className="w-2.5 h-2.5" />}
                {qf.label}
              </button>
            );
          })}
          {/* Urgent pill */}
          <button
            onClick={() => setUrgentOnly(u => !u)}
            className={`flex items-center gap-1.5 border text-[11px] font-medium px-3 py-1.5 rounded-full transition-all duration-200 ${
              urgentOnly
                ? "border-red-700/60 bg-red-950/40 text-red-400"
                : urgentCount > 0
                  ? "border-red-900/50 bg-red-950/20 text-red-500/70 hover:border-red-800/70 hover:text-red-400"
                  : "border-stone-800/50 bg-stone-900/30 text-stone-600"
            }`}
          >
            {urgentOnly && <X className="w-2.5 h-2.5" />}
            Urgent {urgentCount > 0 && <span className={`ml-0.5 font-bold ${urgentOnly ? "" : "text-red-500"}`}>{urgentCount}</span>}
          </button>

          <div className="ml-auto text-[11px] text-stone-600 flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest">density:</span>
            <span className="text-stone-500 font-mono">{density}</span>
          </div>
        </motion.div>

        {/* ── SEARCH + FILTERS ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5"
        >
          <div className="flex items-center gap-3 flex-wrap">
            {/* Rich search bar — same as Dashboard */}
            <div className="relative flex items-center flex-1 max-w-[540px] group">
              <div className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ boxShadow: "0 0 0 1px rgba(160,100,20,0.45), 0 0 24px rgba(160,100,20,0.1)" }}
              />
              <div className="absolute inset-0 rounded-2xl border border-stone-700/40 bg-stone-900/60 group-focus-within:border-amber-800/50 transition-colors duration-300" />
              <Search className="absolute left-4 w-4 h-4 text-stone-600 group-focus-within:text-amber-600/60 transition-colors duration-300 pointer-events-none z-10" />
              <input
                ref={searchRef}
                type="text"
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                placeholder={placeholder}
                className="relative z-10 w-full h-11 bg-transparent rounded-2xl text-stone-200 pl-11 pr-16 text-[13.5px] focus:outline-none placeholder-stone-700"
              />
              <div className="absolute right-3.5 z-10 flex items-center gap-1">
                {globalFilter
                  ? <button onClick={() => setGlobalFilter("")} className="text-stone-600 hover:text-stone-300 transition-colors p-1"><X className="w-3.5 h-3.5" /></button>
                  : <KbdHint keys={["⌘", "K"]} />
                }
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setFiltersOpen(o => !o)}
              className={`flex items-center gap-2 border h-11 px-4 text-[12px] font-medium rounded-xl transition-all ${
                filtersOpen
                  ? "border-amber-700/50 bg-amber-950/30 text-amber-400"
                  : "border-stone-700/40 bg-stone-900/40 text-stone-400 hover:border-stone-600/60 hover:text-stone-200"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {hasActiveFilters && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
            </motion.button>

            <AnimatePresence>
              {(hasActiveFilters || urgentOnly) && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                  onClick={() => { setGlobalFilter(""); setOutcomeFilter("all"); setMinScore(""); setUrgentOnly(false); }}
                  className="flex items-center gap-1.5 text-[12px] text-stone-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" /><span>Clear all</span>
                </motion.button>
              )}
            </AnimatePresence>

            <div className="ml-auto text-[12px] text-stone-600 tabular-nums">
              <span className="text-amber-600/60 font-semibold">{urgentOnly ? displayRows.length : filteredCount}</span>
              <span> / {jobs.length}</span>
            </div>
          </div>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-end gap-3 pt-4 pb-1 border-t border-stone-800/30 mt-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-stone-600">Outcome</label>
                    <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}
                      className="appearance-none bg-stone-900/80 border border-stone-700/50 text-stone-300 text-[13px] px-3 py-2 pr-8 rounded-xl focus:outline-none focus:border-amber-700/40 transition-colors cursor-pointer hover:border-stone-600/70 min-w-[190px]"
                    >
                      <option value="all" className="bg-stone-900">All Outcomes</option>
                      {OUTCOMES.map(o => <option key={o} value={o} className="bg-stone-900">{o}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-stone-600">Min Score</label>
                    <input type="number" value={minScore} onChange={e => setMinScore(e.target.value)}
                      placeholder="0–100" min="0" max="100"
                      className="w-24 bg-stone-900/80 border border-stone-700/50 text-stone-300 text-[13px] text-center py-2 px-3 rounded-xl focus:outline-none focus:border-amber-700/40 transition-colors"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── TABLE ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-stone-800/40 overflow-hidden"
          style={{ background: "rgba(16,13,10,0.9)", backdropFilter: "blur(10px)" }}
        >
          {/* Table topbar */}
          <div className="px-5 py-3.5 border-b border-stone-800/40 flex items-center justify-between"
            style={{ background: "rgba(28,22,16,0.5)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-amber-600/50" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-stone-500">Applied Positions</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Auto-saves on change</span>
            </div>
          </div>

          <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
            <colgroup>
              <col style={{ width: 36 }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: 28 }} />
            </colgroup>
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="border-b border-stone-800/30">
                  {/* Select-all checkbox */}
                  <th className="px-3 py-4 w-10">
                    <input type="checkbox"
                      checked={selectedIds.length === table.getFilteredRowModel().rows.length && table.getFilteredRowModel().rows.length > 0}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(table.getFilteredRowModel().rows.map(r => r.original.id));
                        else setSelectedIds([]);
                      }}
                      className="w-3.5 h-3.5 rounded-sm border-stone-600 bg-stone-800 accent-amber-500 cursor-pointer"
                    />
                  </th>
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-4 py-4 text-left text-[11px] font-medium text-stone-500 uppercase tracking-widest whitespace-nowrap ${
                        header.column.getCanSort() ? "cursor-pointer select-none hover:text-stone-300 transition-colors" : ""
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "desc" && <ChevronDown className="w-3 h-3 text-amber-500/70" />}
                        {header.column.getIsSorted() === "asc"  && <ChevronUp   className="w-3 h-3 text-amber-500/70" />}
                      </div>
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              ))}
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-28">
                    <div className="flex flex-col items-center gap-5">
                      <div className="relative w-10 h-10">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                          className="w-10 h-10 rounded-full border border-stone-800 border-t-amber-600/50 absolute inset-0"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-amber-600/30 animate-pulse" />
                        </div>
                      </div>
                      <span className="text-[11px] font-mono uppercase tracking-widest text-stone-600">Fetching applications…</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && displayRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="w-7 h-7 text-stone-800" />
                      <span className="text-stone-600 text-sm">No applications match your filters</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && displayRows.map((row, i) => (
                <JobRow
                  key={row.id}
                  row={row}
                  index={i}
                  onClick={() => navigate(`/jobs/${row.original.id}`)}
                  onOutcomeChange={handleOutcomeChange}
                  onDeadlineUpdate={handleDeadlineUpdate}
                  onNotesUpdate={handleNotesUpdate}
                  selected={selectedIds.includes(row.original.id)}
                  onSelect={handleRowSelect}
                />
              ))}
            </tbody>
          </table>

          {!loading && jobs.length > 0 && (
            <div className="border-t border-stone-800/30 px-5 py-3.5 flex items-center justify-between"
              style={{ background: "rgba(20,16,12,0.4)" }}
            >
              <span className="text-[11px] text-stone-600">
                Showing <span className="text-amber-600/55 font-semibold">{urgentOnly ? displayRows.length : filteredCount}</span> of {jobs.length} applications
                {selectedIds.length > 0 && <span className="text-amber-400/70 ml-2">· {selectedIds.length} selected</span>}
              </span>
              <div className="flex items-center gap-4 text-stone-700 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <KbdHint keys={["⌘", "K"]} />
                  <span className="font-mono">search</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <KbdHint keys={["⌘", "R"]} />
                  <span className="font-mono">refresh</span>
                </div>
              </div>
            </div>
          )}
        </motion.div>

        {/* ── EMPTY STATE ── */}
        {!loading && jobs.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
            className="mt-16 flex flex-col items-center gap-5 text-center"
          >
            <motion.div
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 rounded-full border border-stone-800/60 flex items-center justify-center"
            >
              <Briefcase className="w-6 h-6 text-stone-700" />
            </motion.div>
            <div>
              <p className="text-stone-500 text-sm mb-1">No applications tracked yet.</p>
              <p className="text-stone-700 text-xs">Mark jobs as "Applied" from the main dashboard.</p>
            </div>
          </motion.div>
        )}
      </div>

      <FloatingDock
        selectedIds={selectedIds}
        onBulkOutcome={handleBulkOutcome}
        // onBulkDelete={handleBulkDelete}
        onExportCSV={handleExportCSV}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
};

export default AppliedDashboard;