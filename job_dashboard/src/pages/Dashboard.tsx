/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useNavigate } from "react-router-dom";
import type { SupabaseJob } from "../types/supabase_job";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState,
  type FilterFn,
} from "@tanstack/react-table";
import { motion, AnimatePresence, useInView } from "framer-motion";
import {
  ChevronUp, ChevronDown, Briefcase, CheckCircle,
  TrendingUp, SlidersHorizontal, X, Search,
  ArrowUpRight, PanelRightOpen, PanelRightClose,
  Orbit, Clock, Zap, MapPin, BarChart2,
  ChevronLeft, Building2, Star, Target,
  Activity, Award, Flame, RefreshCw,
  Eye, Layers, Network,
} from "lucide-react";
import { BGPattern } from "@/components/ui/bg_pattern";
import { SlidingNumber } from "@/components/ui/sliding_number";
import { SpecialText } from "@/components/ui/special_text";
import Navbar from "@/components/Navbar";
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline";

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
  "Try \"applied\" or score > 80…",
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

// ─── SCORE FLAME ─────────────────────────────────────────────────────────────

const ScoreFlame = ({ score }: { score: number | null }) => {
  if (!score) return <span className="text-stone-600 text-sm font-mono tabular-nums">—</span>;

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
        {/* FIX #1: slightly smaller score number */}
        <span className="text-[18px] font-black tabular-nums leading-none" style={{ color: c.text, textShadow: `0 0 18px ${c.text}44` }}>
          {score}
        </span>
        <span className="text-[10px] font-mono text-stone-600">/100</span>
      </div>
      <div className="w-14 h-[3px] bg-stone-800 rounded-full overflow-hidden">
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

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string | null }) => {
  const s = status || "Not Applied";
  const styles: Record<string, { pill: string; dot: string }> = {
    "Applied":     { pill: "bg-emerald-950/70 border-emerald-700/40 text-emerald-300",  dot: "bg-emerald-400" },
    "Not Applied": { pill: "bg-transparent   border-stone-800     text-stone-600",      dot: "bg-stone-700"  },
  };
  const st = styles[s] || styles["Not Applied"];
  return (
    <span className={`inline-flex items-center gap-2 border px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide whitespace-nowrap ${st.pill}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {s}
    </span>
  );
};

// ─── SCORE → LEFT BORDER ACCENT ──────────────────────────────────────────────

function rowAccentColor(score: number | null): string {
  if (!score) return "transparent";
  if (score >= 85) return "rgba(245,158,11,0.6)";
  if (score >= 70) return "rgba(251,146,60,0.45)";
  if (score >= 50) return "rgba(180,120,30,0.35)";
  return "rgba(120,113,108,0.25)";
}

// ─── JOB CARD ROW ─────────────────────────────────────────────────────────────

const JobCard = ({
  row, index, onClick,
}: {
  row: ReturnType<ReturnType<typeof useReactTable>["getRowModel"]>["rows"][0];
  index: number;
  onClick: () => void;
}) => {
  const ref = useRef<HTMLTableRowElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [hovered, setHovered] = useState(false);
  const job = row.original as unknown as SupabaseJob;
  const accent = rowAccentColor(job.score);

  return (
    <motion.tr
      ref={ref}
      initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
      animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
      transition={{ duration: 0.55, delay: Math.min(index * 0.04, 0.5), ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer border-b border-stone-800/40 last:border-0 transition-all duration-200"
      style={{
        borderLeft: `2px solid ${hovered ? accent : accent.replace(/[\d.]+\)$/, m => String(parseFloat(m) * 0.6) + ")")}`,
        backgroundColor: hovered ? "rgba(30,25,20,0.6)" : "transparent",
        boxShadow: hovered ? "inset 0 0 80px rgba(180,100,20,0.025)" : "none",
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-5 py-5 align-middle">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
      <td className="px-4 py-5 w-10">
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -5 }}
              transition={{ duration: 0.15 }}
              className="text-amber-600/40"
            >
              <ArrowUpRight className="w-4 h-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </motion.tr>
  );
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon, color, delay = 0 }: {
  label: string; value: number; icon: React.ReactNode; color: string; delay?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (inView) { const t = setTimeout(() => setVal(value), delay * 1000 + 80); return () => clearTimeout(t); }
  }, [inView, value, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl px-5 py-5 overflow-hidden border border-stone-800/50"
      style={{ background: "rgba(20,17,14,0.8)" }}
    >
      <div className="absolute top-0 right-0 w-20 h-20 pointer-events-none"
        style={{ background: `radial-gradient(circle at top right, ${color}18, transparent 70%)` }}
      />
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${color}12`, color }}
      >
        {icon}
      </div>
      <div className="text-[30px] font-black leading-none mb-1.5 tabular-nums" style={{ color }}>
        <SlidingNumber value={val} />
      </div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-stone-500">{label}</div>
    </motion.div>
  );
};

// ─── HISTOGRAM 2D ────────────────────────────────────────────────────────────

interface HistogramBand {
  label: string;
  color: string;
  count: number;
  max: number;
}

const Histogram2D = ({ jobs }: { jobs: SupabaseJob[] }) => {
  const bands: HistogramBand[] = useMemo(() => {
    const scored = jobs.filter(j => j.score !== null && j.score !== undefined);
    const unscored = jobs.filter(j => j.score === null || j.score === undefined);
    return [
      { label: "80–100", color: "#f59e0b", count: scored.filter(j => (j.score || 0) >= 80).length, max: 0 },
      { label: "60–79",  color: "#fb923c", count: scored.filter(j => (j.score || 0) >= 60 && (j.score || 0) < 80).length, max: 0 },
      { label: "40–59",  color: "#d97706", count: scored.filter(j => (j.score || 0) >= 40 && (j.score || 0) < 60).length, max: 0 },
      { label: "20–39",  color: "#78716c", count: scored.filter(j => (j.score || 0) >= 20 && (j.score || 0) < 40).length, max: 0 },
      { label: "0–19",   color: "#44403c", count: scored.filter(j => (j.score || 0) < 20).length, max: 0 },
      { label: "N/A",    color: "#292524", count: unscored.length, max: 0 },
    ];
  }, [jobs]);

  const maxCount = Math.max(...bands.map(b => b.count), 1);

  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-stone-600 mb-4">Score Distribution</p>
      <div className="flex items-end gap-2 h-24">
        {bands.map((band, i) => {
          const heightPct = (band.count / maxCount) * 100;
          return (
            <div key={band.label} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="w-full flex flex-col justify-end" style={{ height: 80 }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(heightPct, band.count > 0 ? 6 : 0)}%` }}
                  transition={{ duration: 0.9, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full rounded-t-md relative overflow-hidden cursor-default"
                  style={{
                    backgroundColor: `${band.color}30`,
                    border: `1px solid ${band.color}40`,
                    borderBottom: "none",
                  }}
                  title={`${band.label}: ${band.count}`}
                >
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: "100%" }}
                    transition={{ duration: 0.9, delay: i * 0.1 + 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute bottom-0 left-0 right-0 rounded-t-sm"
                    style={{ background: `linear-gradient(to top, ${band.color}60, ${band.color}20)` }}
                  />
                  {band.count > 0 && (
                    <div className="absolute top-1 left-0 right-0 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-[9px] font-bold text-stone-200" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
                        {band.count}
                      </span>
                    </div>
                  )}
                </motion.div>
              </div>
              <span className="text-[9px] font-mono text-stone-600 group-hover:text-stone-400 transition-colors text-center leading-tight">
                {band.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* Count labels underneath */}
      <div className="flex gap-2 mt-2">
        {bands.map(band => (
          <div key={band.label} className="flex-1 text-center">
            <span className="text-[10px] font-semibold tabular-nums" style={{ color: band.color }}>
              {band.count > 0 ? band.count : "·"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── MINI SPARKLINE ──────────────────────────────────────────────────────────

const MiniSparkline = ({ data, color }: { data: number[]; color: string }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 24;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
      <circle
        cx={pts.split(" ")[pts.split(" ").length - 1]?.split(",")[0]}
        cy={pts.split(" ")[pts.split(" ").length - 1]?.split(",")[1]}
        r="2" fill={color}
      />
    </svg>
  );
};

// ─── TOP COMPANIES MINI LIST ──────────────────────────────────────────────────

const TopCompanies = ({ jobs }: { jobs: SupabaseJob[] }) => {
  const companies = useMemo(() => {
    const map: Record<string, { count: number; maxScore: number; avgScore: number; scores: number[] }> = {};
    jobs.forEach(j => {
      const co = j.company || "Unknown";
      if (!map[co]) map[co] = { count: 0, maxScore: 0, avgScore: 0, scores: [] };
      map[co].count++;
      if (j.score) {
        map[co].scores.push(j.score);
        map[co].maxScore = Math.max(map[co].maxScore, j.score);
      }
    });
    Object.values(map).forEach(v => {
      v.avgScore = v.scores.length ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : 0;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].avgScore - a[1].avgScore)
      .slice(0, 5);
  }, [jobs]);

  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-stone-600 mb-3">Top Companies (by avg score)</p>
      <div className="space-y-2">
        {companies.map(([name, info], i) => (
          <motion.div
            key={name}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.3 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] text-stone-700 font-mono w-4 shrink-0">{i + 1}.</span>
              <span className="text-[12px] text-stone-300 truncate max-w-[110px]">{name}</span>
              <span className="text-[10px] text-stone-600">×{info.count}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-14 h-[3px] bg-stone-800 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${info.avgScore}%` }}
                  transition={{ duration: 0.8, delay: 0.1 * i }}
                  className="h-full rounded-full bg-amber-600/70"
                />
              </div>
              <span className="text-[11px] font-mono tabular-nums text-amber-600/80 w-8 text-right">{info.avgScore}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── STAT DRAWER ─────────────────────────────────────────────────────────────

const StatDrawer = ({ open, onClose, jobs }: { open: boolean; onClose: () => void; jobs: SupabaseJob[] }) => {
  const appliedCount    = jobs.filter(j => j.application_status === "Applied").length;
  const highMatch       = jobs.filter(j => (j.score || 0) >= 80).length;
  const scoredJobs      = jobs.filter(j => j.score);
  const avgScore        = scoredJobs.length
    ? Math.round(scoredJobs.reduce((a, b) => a + (b.score || 0), 0) / scoredJobs.length)
    : 0;
  const medianScore     = useMemo(() => {
    const sorted = scoredJobs.map(j => j.score as number).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }, [scoredJobs]);
  const unscoredCount   = jobs.filter(j => !j.score).length;
  const topScore        = scoredJobs.length ? Math.max(...scoredJobs.map(j => j.score as number)) : 0;
  const coverageRate    = jobs.length ? Math.round((scoredJobs.length / jobs.length) * 100) : 0;

  const statRows = [
    { label: "Total",        value: jobs.length,       color: "#a8a29e", icon: <Briefcase className="w-3.5 h-3.5" />,  suffix: "" },
    { label: "High Match",   value: highMatch,          color: "#f59e0b", icon: <Zap className="w-3.5 h-3.5" />,        suffix: "" },
    { label: "Avg Score",    value: avgScore,           color: "#fb923c", icon: <TrendingUp className="w-3.5 h-3.5" />, suffix: "" },
    { label: "Median Score", value: medianScore,        color: "#fcd34d", icon: <Activity className="w-3.5 h-3.5" />,   suffix: "" },
    { label: "Top Score",    value: topScore,           color: "#34d399", icon: <Award className="w-3.5 h-3.5" />,      suffix: "" },
    { label: "Applied",      value: appliedCount,       color: "#6ee7b7", icon: <CheckCircle className="w-3.5 h-3.5" />,suffix: "" },
    { label: "Scored",       value: scoredJobs.length,  color: "#60a5fa", icon: <Star className="w-3.5 h-3.5" />,       suffix: "" },
    { label: "Unscored",     value: unscoredCount,      color: "#78716c", icon: <Eye className="w-3.5 h-3.5" />,        suffix: "" },
    { label: "Coverage",     value: coverageRate,       color: "#a78bfa", icon: <Target className="w-3.5 h-3.5" />,     suffix: "%" },
  ];

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
            {/* FIX #2c: Header with close X + collapse arrow */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-stone-800/40 sticky top-0 z-10"
              style={{ background: "rgba(12,10,9,0.97)", backdropFilter: "blur(16px)" }}
            >
              <div className="flex items-center gap-2.5">
                <BarChart2 className="w-4 h-4 text-amber-500/60" />
                <span className="font-semibold text-stone-200 text-sm">Analytics</span>
              </div>
              <div className="flex items-center gap-1">
                {/* FIX #2b: Side collapse arrow */}
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-500 hover:text-amber-400 hover:bg-stone-800/60 transition-all"
                  title="Collapse"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-stone-500 hover:text-stone-200 hover:bg-stone-800/60 transition-all"
                  title="Close"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Stat rows — FIX #2a: removed Interviews + Rejected, added Median, Top Score, Scored, Unscored, Coverage */}
            <div className="p-5 space-y-2.5">
              {statRows.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
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

            {/* FIX #4: Proper 2D histogram */}
            <div className="px-5 pb-6">
              <Histogram2D jobs={jobs} />
            </div>

            {/* EXTRA: Top companies */}
            {jobs.length > 0 && (
              <div className="px-5 pb-8 border-t border-stone-800/30 pt-5">
                <TopCompanies jobs={jobs} />
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

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

// ═══════════════════════════════════════════════════════════════════════════════
// ─── ORBIT GRAPH ─────────────────────────────────────────────────────────────
// Proper force-directed style graph with meaningful edges:
//   Vertices = top 100 jobs by score
//   Edges drawn when:
//     1. Same company (strong)
//     2. Same location city (medium)
//     3. Similar title keywords (medium)
//     4. Score within 8 pts of each other AND same status (weak — shown faint)
// Nodes sized by score. Layout: concentric rings by score band.
// ═══════════════════════════════════════════════════════════════════════════════

type ONode = {
  id: number;
  label: string;       // company name (trimmed)
  sublabel: string;    // role title (trimmed)
  score: number;
  status: string;
  location: string;
  x: number;
  y: number;
  ring: number;        // 0=inner (≥80), 1=mid (60-79), 2=outer (<60)
  color: string;
};

type OEdge = {
  a: number; b: number;
  reason: "company" | "location" | "title" | "score";
  strength: number;   // 0..1
};

function buildOrbitGraph(jobs: SupabaseJob[]): { nodes: ONode[]; edges: OEdge[] } {
  const top = jobs
    .filter(j => j.score !== null && j.score !== undefined)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 100);

  const scoreColor = (s: number) => {
    if (s >= 85) return "#f59e0b";
    if (s >= 70) return "#fb923c";
    if (s >= 50) return "#d97706";
    return "#78716c";
  };

  const ring = (s: number) => s >= 80 ? 0 : s >= 60 ? 1 : 2;
  const ringRadii = [110, 195, 275];
  const ringCounts = [0, 0, 0];
  top.forEach(j => ringCounts[ring(j.score || 0)]++);

  const ringIdx = [0, 0, 0];
  const nodes: ONode[] = top.map((j) => {
    const r = ring(j.score || 0);
    const idx = ringIdx[r]++;
    const total = ringCounts[r];
    const angle = ((idx / Math.max(total, 1)) * 2 * Math.PI) - Math.PI / 2;
    const radius = ringRadii[r];
    return {
      id: j.id,
      label: (j.company || "Unknown").slice(0, 16),
      sublabel: (j.title || "").slice(0, 22),
      score: j.score || 0,
      status: j.application_status || "Not Applied",
      location: j.location || "",
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
      ring: r,
      color: scoreColor(j.score || 0),
    };
  });

  const edges: OEdge[] = [];
  const edgeSet = new Set<string>();
  const addEdge = (a: number, b: number, reason: OEdge["reason"], strength: number) => {
    const key = `${Math.min(a, b)}-${Math.max(a, b)}-${reason}`;
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ a, b, reason, strength }); }
  };

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const ni = nodes[i]; const nj = nodes[j];
      const ji = top[i];   const jj = top[j];
      // Company match
      if (ji.company && jj.company && ji.company.toLowerCase() === jj.company.toLowerCase()) {
        addEdge(ni.id, nj.id, "company", 1.0);
      }
      // Location city match (first word of location)
      const cityI = (ji.location || "").split(",")[0].trim().toLowerCase();
      const cityJ = (jj.location || "").split(",")[0].trim().toLowerCase();
      if (cityI && cityJ && cityI === cityJ && cityI.length > 2) {
        addEdge(ni.id, nj.id, "location", 0.65);
      }
      // Title keyword overlap
      const wordsI = new Set((ji.title || "").toLowerCase().split(/\W+/).filter(w => w.length > 3));
      const wordsJ = new Set((jj.title || "").toLowerCase().split(/\W+/).filter(w => w.length > 3));
      const overlap = [...wordsI].filter(w => wordsJ.has(w)).length;
      if (overlap >= 2) {
        addEdge(ni.id, nj.id, "title", Math.min(0.85, 0.4 + overlap * 0.15));
      }
      // Score proximity + same status
      if (Math.abs(ni.score - nj.score) <= 8 && ni.status === nj.status && ni.status !== "Not Applied") {
        addEdge(ni.id, nj.id, "score", 0.3);
      }
    }
  }

  return { nodes, edges };
}

const EDGE_COLORS: Record<OEdge["reason"], string> = {
  company:  "rgba(245,158,11,0.7)",
  location: "rgba(96,165,250,0.5)",
  title:    "rgba(167,139,250,0.45)",
  score:    "rgba(120,113,108,0.25)",
};

const EDGE_LABELS: Record<OEdge["reason"], string> = {
  company:  "Same company",
  location: "Same city",
  title:    "Similar role",
  score:    "Score + status",
};

interface OrbitGraphState {
  hoveredId: number | null;
  selectedId: number | null;
  pan: { x: number; y: number };
  zoom: number;
  dragging: boolean;
  dragStart: { x: number; y: number; panX: number; panY: number } | null;
}

const OrbitGraph = ({ jobs }: { jobs: SupabaseJob[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<OrbitGraphState>({
    hoveredId: null, selectedId: null,
    pan: { x: 0, y: 0 }, zoom: 1,
    dragging: false, dragStart: null,
  });
  const stateRef = useRef(state);
  useEffect(() => {
  stateRef.current = state;
  });

  const { nodes, edges } = useMemo(() => buildOrbitGraph(jobs), [jobs]);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  // ── DRAW ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    const cx = width / 2 + stateRef.current.pan.x;
    const cy = height / 2 + stateRef.current.pan.y;
    const z = stateRef.current.zoom;
    const { hoveredId, selectedId } = stateRef.current;

    ctx.clearRect(0, 0, width, height);

    // Orbit rings
    const ringRadii = [110, 195, 275];
    const ringLabels = ["≥80", "60–79", "<60"];
    const ringColors = ["rgba(245,158,11,0.08)", "rgba(251,146,60,0.05)", "rgba(120,113,108,0.04)"];
    ringRadii.forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * z, 0, Math.PI * 2);
      ctx.strokeStyle = ringColors[i].replace("0.0", "0.1");
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      // Ring label
      ctx.fillStyle = "rgba(120,113,108,0.4)";
      ctx.font = `${Math.max(9, 9 * z)}px monospace`;
      ctx.fillText(ringLabels[i], cx + r * z + 4, cy - 4);
    });

    // Center glow
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 45 * z);
    cg.addColorStop(0, "rgba(245,158,11,0.25)");
    cg.addColorStop(1, "transparent");
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.arc(cx, cy, 45 * z, 0, Math.PI * 2);
    ctx.fill();
    // Center node
    ctx.beginPath();
    ctx.arc(cx, cy, 10 * z, 0, Math.PI * 2);
    ctx.fillStyle = "#f59e0b";
    ctx.fill();
    ctx.font = `bold ${Math.max(8, 8 * z)}px monospace`;
    ctx.fillStyle = "rgba(245,158,11,0.6)";
    ctx.textAlign = "center";
    ctx.fillText("SCOUT", cx, cy + 22 * z);
    ctx.textAlign = "left";

    // Edges — determine visibility
    const activeId = selectedId ?? hoveredId;
    const connectedIds = new Set<number>();
    if (activeId !== null) {
      edges.forEach(e => {
        if (e.a === activeId) connectedIds.add(e.b);
        if (e.b === activeId) connectedIds.add(e.a);
      });
    }

    edges.forEach(e => {
      const na = nodeMap.get(e.a); const nb = nodeMap.get(e.b);
      if (!na || !nb) return;
      const isHighlighted = activeId !== null && (e.a === activeId || e.b === activeId);
      const isDimmed = activeId !== null && !isHighlighted;
      if (isDimmed && e.reason === "score") return; // hide weakest when dimmed

      const ax = cx + na.x * z, ay = cy + na.y * z;
      const bx = cx + nb.x * z, by = cy + nb.y * z;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      // Slight curve via midpoint
      const mx = (ax + bx) / 2 + (ay - by) * 0.08;
      const my = (ay + by) / 2 + (bx - ax) * 0.08;
      ctx.quadraticCurveTo(mx, my, bx, by);

      const baseColor = EDGE_COLORS[e.reason];
      ctx.strokeStyle = isDimmed ? baseColor.replace(/[\d.]+\)$/, "0.08)") : isHighlighted ? baseColor.replace(/[\d.]+\)$/, "0.9)") : baseColor;
      ctx.lineWidth = isHighlighted ? Math.max(1.5, e.strength * 2.5) : Math.max(0.5, e.strength * 1.2);
      ctx.stroke();
    });

    // Nodes
    nodes.forEach(n => {
      const nx = cx + n.x * z, ny = cy + n.y * z;
      const isHovered = n.id === hoveredId;
      const isSelected = n.id === selectedId;
      const isConnected = connectedIds.has(n.id);
      const isDimmed = activeId !== null && !isHovered && !isSelected && !isConnected;

      const baseRadius = Math.max(5, Math.min(11, 4 + (n.score / 100) * 7));
      const r = baseRadius * z * (isHovered || isSelected ? 1.35 : 1);

      // Glow
      if (!isDimmed) {
        const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 3);
        glow.addColorStop(0, n.color + (isSelected ? "50" : isHovered ? "40" : "20"));
        glow.addColorStop(1, "transparent");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(nx, ny, r * 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = isDimmed ? "rgba(40,35,30,0.6)" : isSelected ? n.color : `${n.color}CC`;
      ctx.fill();
      ctx.strokeStyle = isDimmed ? "rgba(80,70,60,0.3)" : isSelected ? "#fff" : n.color;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Label (only if hovered/selected/connected, or zoom > 1.4)
      if ((isHovered || isSelected || isConnected || z > 1.4) && !isDimmed) {
        const fontSize = Math.max(9, 9.5 * z);
        ctx.font = `${isSelected ? "bold " : ""}${fontSize}px monospace`;
        ctx.fillStyle = isSelected ? "#fff" : "rgba(214,211,208,0.85)";
        const labelY = ny + r + fontSize + 2;
        ctx.textAlign = "center";
        ctx.fillText(n.label, nx, labelY);
        if (isSelected || isHovered) {
          ctx.font = `${Math.max(8, 8 * z)}px monospace`;
          ctx.fillStyle = "rgba(120,113,108,0.8)";
          ctx.fillText(n.sublabel, nx, labelY + fontSize + 1);
          ctx.fillStyle = n.color;
          ctx.fillText(`${n.score}/100`, nx, labelY + fontSize * 2 + 2);
        }
        ctx.textAlign = "left";
      }
    });
  }, [nodes, edges, nodeMap]);

  // ── ANIMATION LOOP ────────────────────────────────────────────────────────
  useEffect(() => {
    let raf: number;
    let angle = 0;
    const animate = () => {
      // Slowly auto-rotate nodes when nothing selected
      if (!stateRef.current.selectedId && !stateRef.current.dragging) {
        angle += 0.0008;
        nodes.forEach(n => {
          const rad = Math.sqrt(n.x ** 2 + n.y ** 2);
          const currentAngle = Math.atan2(n.y, n.x) + 0.0008;
          n.x = rad * Math.cos(currentAngle);
          n.y = rad * Math.sin(currentAngle);
        });
      }
      draw();
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [draw, nodes]);

  // ── CANVAS RESIZE ─────────────────────────────────────────────────────────
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) { canvas.width = rect.width; canvas.height = rect.height; }
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // ── HIT TEST ──────────────────────────────────────────────────────────────
  const hitTest = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const cx = canvas.width / 2 + stateRef.current.pan.x;
    const cy = canvas.height / 2 + stateRef.current.pan.y;
    const z = stateRef.current.zoom;
    let best: ONode | null = null, bestDist = Infinity;
    nodes.forEach(n => {
      const nx = cx + n.x * z, ny = cy + n.y * z;
      const d = Math.hypot(mx - nx, my - ny);
      const r = Math.max(5, Math.min(11, 4 + (n.score / 100) * 7)) * z + 6;
      if (d < r && d < bestDist) { best = n; bestDist = d; }
    });
    return best;
  }, [nodes]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (stateRef.current.dragging && stateRef.current.dragStart) {
      setState(s => ({
        ...s,
        pan: {
          x: stateRef.current.dragStart!.panX + e.clientX - stateRef.current.dragStart!.x,
          y: stateRef.current.dragStart!.panY + e.clientY - stateRef.current.dragStart!.y,
        }
      }));
      return;
    }
    const n = hitTest(e.clientX, e.clientY);
    setState(s => ({ ...s, hoveredId: n?.id ?? null }));
    if (canvasRef.current) canvasRef.current.style.cursor = n ? "pointer" : "grab";
  }, [hitTest]);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setState(s => ({
      ...s, dragging: true,
      dragStart: { x: e.clientX, y: e.clientY, panX: s.pan.x, panY: s.pan.y }
    }));
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDragging = stateRef.current.dragging;
    const ds = stateRef.current.dragStart;
    const moved = ds ? Math.hypot(e.clientX - ds.x, e.clientY - ds.y) > 4 : false;
    setState(s => ({ ...s, dragging: false, dragStart: null }));
    if (!moved) {
      const n = hitTest(e.clientX, e.clientY);
      setState(s => ({ ...s, selectedId: n?.id === s.selectedId ? null : (n?.id ?? null) }));
    }
  }, [hitTest]);

  const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setState(s => ({ ...s, zoom: Math.min(3, Math.max(0.4, s.zoom * (e.deltaY < 0 ? 1.1 : 0.91))) }));
  }, []);

  const selectedNode = state.selectedId !== null ? nodeMap.get(state.selectedId) : null;
  const connectedEdges = selectedNode
    ? edges.filter(e => e.a === selectedNode.id || e.b === selectedNode.id)
    : [];

  return (
    <div className="relative w-full h-full flex flex-col">
      {/* Legend */}
      <div className="absolute top-3 left-4 flex flex-wrap gap-x-4 gap-y-1 z-10 pointer-events-none">
        {(Object.entries(EDGE_LABELS) as [OEdge["reason"], string][]).map(([reason, label]) => (
          <div key={reason} className="flex items-center gap-1.5">
            <div className="w-5 h-[2px] rounded-full" style={{ backgroundColor: EDGE_COLORS[reason].replace(/[\d.]+\)$/, "0.9)") }} />
            <span className="text-[10px] font-mono text-stone-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Zoom controls */}
      <div className="absolute top-3 right-4 flex items-center gap-1 z-10">
        <button
          onClick={() => setState(s => ({ ...s, zoom: Math.min(3, s.zoom * 1.2) }))}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-600 transition-all text-sm font-mono"
        >+</button>
        <button
          onClick={() => setState(s => ({ ...s, zoom: Math.max(0.4, s.zoom * 0.83) }))}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-600 transition-all text-sm font-mono"
        >−</button>
        <button
          onClick={() => setState(s => ({ ...s, zoom: 1, pan: { x: 0, y: 0 }, selectedId: null }))}
          className="w-7 h-7 rounded-lg flex items-center justify-center bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-600 transition-all"
        ><RefreshCw className="w-3 h-3" /></button>
      </div>

      {/* Node count */}
      <div className="absolute bottom-16 left-4 pointer-events-none z-10">
        <span className="text-[10px] font-mono text-stone-700">{nodes.length} nodes · {edges.length} edges</span>
      </div>

      <canvas
        ref={canvasRef}
        className="w-full flex-1 cursor-grab active:cursor-grabbing"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={() => setState(s => ({ ...s, hoveredId: null, dragging: false, dragStart: null }))}
        onWheel={onWheel}
      />

      {/* Selected node detail panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-4 left-4 right-4 mx-auto max-w-xs rounded-2xl border border-stone-700/50 overflow-hidden"
            style={{ background: "rgba(14,11,9,0.95)", backdropFilter: "blur(12px)" }}
          >
            <div className="px-4 pt-3.5 pb-3">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="text-stone-100 font-semibold text-[13px] leading-snug">{selectedNode.sublabel}</p>
                  <p className="text-stone-400 text-[12px]">{selectedNode.label}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[18px] font-black tabular-nums" style={{ color: selectedNode.color }}>
                    {selectedNode.score}
                  </span>
                  <StatusBadge status={selectedNode.status} />
                </div>
              </div>
              {selectedNode.location && (
                <div className="flex items-center gap-1.5 text-[11px] text-stone-500 mb-2.5">
                  <MapPin className="w-3 h-3" />{selectedNode.location}
                </div>
              )}
              {connectedEdges.length > 0 && (
                <div className="pt-2.5 border-t border-stone-800/50">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-stone-600 mb-2">Connected via</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["company","location","title","score"] as OEdge["reason"][]).map(reason => {
                      const c = connectedEdges.filter(e => e.reason === reason).length;
                      return c > 0 ? (
                        <span key={reason} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] border"
                          style={{ borderColor: EDGE_COLORS[reason].replace(/[\d.]+\)$/, "0.5)"), color: EDGE_COLORS[reason].replace(/[\d.]+\)$/, "0.9)"), background: EDGE_COLORS[reason].replace(/[\d.]+\)$/, "0.1)") }}>
                          <span className="font-semibold">{c}</span> {EDGE_LABELS[reason]}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── ORBITAL PANEL ───────────────────────────────────────────────────────────

const OrbitalPanel = ({ open, onClose, jobs }: { open: boolean; onClose: () => void; jobs: SupabaseJob[] }) => {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-stone-950/85 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 24 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed inset-6 lg:inset-10 z-50 rounded-3xl border border-stone-700/40 overflow-hidden shadow-2xl"
            style={{ background: "#090807" }}
          >
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-6 border-b border-stone-800/40 z-10 bg-stone-950/80 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <Network className="w-4 h-4 text-amber-500/70" />
                <span className="text-[13px] font-semibold text-stone-200">Job Orbit Graph</span>
                <span className="text-[11px] text-stone-600">— top {Math.min(100, jobs.filter(j => j.score).length)} scored positions · click to inspect · scroll to zoom · drag to pan</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Edge legend badges */}
                <div className="hidden lg:flex items-center gap-3 mr-4">
                  {(Object.entries(EDGE_LABELS) as [OEdge["reason"], string][]).map(([r, l]) => (
                    <div key={r} className="flex items-center gap-1.5">
                      <div className="w-4 h-[2px]" style={{ backgroundColor: EDGE_COLORS[r].replace(/[\d.]+\)$/, "0.9)") }} />
                      <span className="text-[10px] font-mono text-stone-500">{l}</span>
                    </div>
                  ))}
                </div>
                <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-stone-500 hover:text-stone-200 hover:bg-stone-800/60 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="h-full pt-14">
              {jobs.filter(j => j.score).length > 0
                ? <OrbitGraph jobs={jobs} />
                : (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-stone-600">
                    <Network className="w-8 h-8 opacity-30" />
                    <p className="text-sm">No scored positions yet — orbit is empty.</p>
                  </div>
                )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ─── TOAST NOTIFICATION ──────────────────────────────────────────────────────
// EXTRA #1: Toast for new jobs loaded / refresh

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

// ─── SCORE TIER BADGE ─────────────────────────────────────────────────────────
// EXTRA #2: Inline tier label next to score bar

const ScoreTier = ({ score }: { score: number | null }) => {
  if (!score) return null;
  if (score >= 85) return <span className="text-[9px] font-bold tracking-widest text-amber-500/80 uppercase">Elite</span>;
  if (score >= 70) return <span className="text-[9px] font-bold tracking-widest text-orange-400/70 uppercase">Strong</span>;
  if (score >= 50) return <span className="text-[9px] font-bold tracking-widest text-yellow-700/70 uppercase">Fair</span>;
  return <span className="text-[9px] font-bold tracking-widest text-stone-600 uppercase">Low</span>;
};

// ─── TABLE DENSITY TOGGLE ─────────────────────────────────────────────────────
// EXTRA #3: Compact / comfortable view toggle

type Density = "comfortable" | "compact";

// ─── QUICK FILTER PILLS ───────────────────────────────────────────────────────
// EXTRA #4: One-click preset filter chips above the table

const QUICK_FILTERS = [
  { label: "High Match",  statusFilter: "all", minScore: "80" },
  { label: "Not Applied", statusFilter: "Not Applied", minScore: "" },
  { label: "Applied",     statusFilter: "Applied", minScore: "" },
  // { label: "Interview",   statusFilter: "Interview", minScore: "" },
];

// ─── REFRESH BUTTON ───────────────────────────────────────────────────────────
// EXTRA #5: Manual refresh with spinner (inside header action area)

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs]                 = useState<SupabaseJob[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [sorting, setSorting]           = useState<SortingState>([{ id: "score", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter]   = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter]     = useState("all");
  const [minScore, setMinScore]           = useState("");
  const [filtersOpen, setFiltersOpen]     = useState(false);
  const [drawerOpen, setDrawerOpen]       = useState(false);
  const [orbitalOpen, setOrbitalOpen]     = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [pulseFresh, setPulseFresh]       = useState(false);
  const [density, setDensity]             = useState<Density>("comfortable");
  const [toastMsg, setToastMsg]           = useState("");
  const [toastVisible, setToastVisible]   = useState(false);
  const searchRef  = useRef<HTMLInputElement>(null);
  const placeholder = useTypewriterPlaceholder();

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await supabase.from("jobs").select("*");
    if (data) {
      setJobs(data as SupabaseJob[]);
      if (isRefresh) showToast(`Refreshed — ${data.length} positions loaded`);
    }
    if (isRefresh) setRefreshing(false); else setLoading(false);
    setLastRefreshed(new Date());
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

  const uniqueLocations = Array.from(new Set(jobs.map(j => j.location).filter(Boolean))).sort() as string[];

  // EXTRA #6: Keyboard shortcut R → refresh
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "r") {
        e.preventDefault();
        fetchJobs(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [fetchJobs]);

  const paddingY = density === "compact" ? "py-2.5" : "py-5";

  const columns: ColumnDef<SupabaseJob>[] = [
    {
      accessorKey: "score", header: "Score", id: "score",
      filterFn: (row, id, fv) => { const s = row.getValue(id) as number | null; return s !== null && s >= Number(fv); },
      cell: ({ getValue }) => (
        <div>
          <ScoreFlame score={getValue() as number | null} />
          <ScoreTier score={getValue() as number | null} />
        </div>
      ),
    },
    {
      accessorKey: "title", header: "Position", id: "title",
      cell: ({ getValue, row }) => (
        <div className="min-w-0 py-0.5">
          <div className="text-stone-100 text-[15px] font-semibold leading-snug break-words whitespace-normal mb-1">
            {getValue() as string}
          </div>
          <div className="text-stone-400 text-[13px] font-medium break-words whitespace-normal">
            {row.original.company}
          </div>
        </div>
      ),
    },
    {
      accessorKey: "location", header: "Location", id: "location",
      filterFn: (row, id, fv) => {
        const loc = row.getValue(id) as string | null;
        return loc?.toLowerCase().includes((fv as string).toLowerCase()) ?? false;
      },
      cell: ({ getValue }) => {
        const loc = getValue() as string | null;
        return loc ? (
          <div className="flex items-center gap-1.5 text-[13px] text-stone-400 font-medium whitespace-nowrap">
            <MapPin className="w-3 h-3 text-stone-600 shrink-0" />
            <span>{loc}</span>
          </div>
        ) : (
          <span className="text-stone-700 text-sm">—</span>
        );
      },
    },
    {
      id: "application_status", header: "Status", accessorKey: "application_status",
      filterFn: (row, id, fv) => ((row.getValue(id) as string | null) || "Not Applied") === fv,
      cell: ({ getValue }) => <StatusBadge status={getValue() as string | null} />,
    },
  ];

  const table = useReactTable({
    data: jobs, columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: multiFieldFilter,
    state: { sorting, columnFilters, globalFilter },
  });

  useEffect(() => {
    if (locationFilter === "all") setColumnFilters(p => p.filter(f => f.id !== "location"));
    else setColumnFilters(p => [...p.filter(f => f.id !== "location"), { id: "location", value: locationFilter }]);
  }, [locationFilter]);

  useEffect(() => {
    if (statusFilter === "all") setColumnFilters(p => p.filter(f => f.id !== "application_status"));
    else setColumnFilters(p => [...p.filter(f => f.id !== "application_status"), { id: "application_status", value: statusFilter }]);
  }, [statusFilter]);

  useEffect(() => {
    if (minScore === "") setColumnFilters(p => p.filter(f => f.id !== "score"));
    else setColumnFilters(p => [...p.filter(f => f.id !== "score"), { id: "score", value: Number(minScore) }]);
  }, [minScore]);

  const filteredCount    = table.getFilteredRowModel().rows.length;
  const hasActiveFilters = globalFilter || locationFilter !== "all" || statusFilter !== "all" || minScore !== "";

  const applyQuickFilter = (qf: typeof QUICK_FILTERS[0]) => {
    setStatusFilter(qf.statusFilter);
    setMinScore(qf.minScore);
  };

  const activeQuickFilter = QUICK_FILTERS.find(
    qf => qf.statusFilter === statusFilter && qf.minScore === minScore
  );

  return (
    <div className="min-h-screen text-stone-100 selection:bg-amber-500/25 selection:text-amber-100"
      style={{ backgroundColor: "#0c0a09" }}
    >
      {/* ── ATMOSPHERE ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <BGPattern variant="dots" fill="rgba(120,80,20,0.035)" size={32} mask="fade-edges" />
        <div className="absolute -top-40 -left-40 w-[800px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(160,90,15,0.08) 0%, transparent 65%)" }}
        />
        <div className="absolute bottom-0 right-0 w-[600px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(40,80,120,0.06) 0%, transparent 65%)" }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px]"
          style={{ background: "radial-gradient(ellipse, rgba(160,90,15,0.04) 0%, transparent 60%)" }}
        />
      </div>

      <Navbar />
      <StatDrawer   open={drawerOpen}   onClose={() => setDrawerOpen(false)}   jobs={jobs} />
      <OrbitalPanel open={orbitalOpen}  onClose={() => setOrbitalOpen(false)}  jobs={jobs} />
      <Toast message={toastMsg} visible={toastVisible} />

      <div className="relative z-10 w-full px-6 lg:px-10 xl:px-14 pt-20 pb-28">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-10 pt-8"
        >
          {/* Eyebrow — FIX #3: removed left time, kept only LiveClock on right, made label more visible */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-amber-600/50" />
              <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-amber-600/55">Fall 2026 Co-op Hunt</span>
              <div className={`flex items-center gap-1.5 transition-opacity duration-1000 ${pulseFresh ? "opacity-100" : "opacity-40"}`}>
                <div className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${pulseFresh ? "animate-pulse" : ""}`} />
              </div>
            </div>
            {/* FIX #3: clock is now on the right, bigger and more visible */}
            <LiveClock />
          </div>

          {/* Title + action row */}
          <div className="flex items-end justify-between flex-wrap gap-5">
            {/* FIX #4: title uses standard font (not display/special), matching the table grid typography */}
            <h1 className="text-5xl lg:text-[3.6rem] text-stone-100 leading-[0.92] tracking-tight font-bold flex items-end gap-3 flex-wrap">
              <span className="text-stone-100">ALL JOBS</span>
              <span className="text-amber-500">Dashboard</span>
            </h1>

            <div className="flex items-center gap-2 pb-1">
              {/* EXTRA #5: Manual refresh button */}
              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => fetchJobs(true)}
                disabled={refreshing}
                className="flex items-center gap-2 border border-stone-700/50 bg-stone-900/40 text-stone-400 text-[12px] font-medium px-3 py-2.5 rounded-xl transition-all hover:border-stone-600/70 hover:text-stone-200 disabled:opacity-40"
                title="Refresh (⌘R)"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={() => setOrbitalOpen(true)}
                className="flex items-center gap-2.5 border border-amber-800/40 bg-amber-950/30 text-amber-500/80 text-[13px] font-semibold px-5 py-2.5 rounded-xl transition-all hover:border-amber-700/60 hover:bg-amber-950/50 hover:text-amber-400"
              >
                <Network className="w-4 h-4" />
                <span>Job Orbit</span>
              </motion.button>

              {/* FIX #2: Analytics button bigger, NO job count before expanding, with collapse arrow */}
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

              {/* EXTRA #3: Density toggle */}
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

        {/* ── QUICK FILTER PILLS (EXTRA #4) ── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="flex flex-wrap items-center gap-2 mb-5"
        >
          {QUICK_FILTERS.map(qf => {
            const isActive = activeQuickFilter?.label === qf.label;
            return (
              <button
                key={qf.label}
                onClick={() => isActive ? (setStatusFilter("all"), setMinScore("")) : applyQuickFilter(qf)}
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
          <div className="ml-auto text-[11px] text-stone-600 flex items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase tracking-widest">density:</span>
            <span className="text-stone-500 font-mono">{density}</span>
          </div>
        </motion.div>

        {/* ── SEARCH + FILTERS ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5"
        >
          <div className="flex items-center gap-3 flex-wrap">
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
                onChange={(e) => setGlobalFilter(e.target.value)}
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
              {hasActiveFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                  onClick={() => { setGlobalFilter(""); setLocationFilter("all"); setStatusFilter("all"); setMinScore(""); }}
                  className="flex items-center gap-1.5 text-[12px] text-stone-500 hover:text-red-400 transition-colors"
                >
                  <X className="w-3 h-3" /><span>Clear all</span>
                </motion.button>
              )}
            </AnimatePresence>

            <div className="ml-auto text-[12px] text-stone-600 tabular-nums">
              <span className="text-amber-600/60 font-semibold">{filteredCount}</span>
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
                <div className="flex flex-wrap items-center gap-3 pt-4 pb-1 border-t border-stone-800/30 mt-4">
                  {[
                    { label: "Location", value: locationFilter, set: setLocationFilter, options: [["all","All Locations"], ...uniqueLocations.map(l => [l, l])] as [string,string][] },
                    { label: "Status",   value: statusFilter,   set: setStatusFilter,   options: [["all","All Statuses"],  ...["Not Applied","Applied"].map(s => [s,s])] as [string,string][] },
                  ].map(f => (
                    <div key={f.label} className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-mono uppercase tracking-widest text-stone-600">{f.label}</label>
                      <select value={f.value} onChange={e => f.set(e.target.value)}
                        className="appearance-none bg-stone-900/80 border border-stone-700/50 text-stone-300 text-[13px] px-3 py-2 pr-8 rounded-xl focus:outline-none focus:border-amber-700/40 transition-colors cursor-pointer hover:border-stone-600/70 min-w-[160px]"
                      >
                        {f.options.map(([v, l]) => <option key={v} value={v} className="bg-stone-900">{l}</option>)}
                      </select>
                    </div>
                  ))}
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
          transition={{ duration: 0.55, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl border border-stone-800/40 overflow-hidden"
          style={{ background: "rgba(16,13,10,0.9)", backdropFilter: "blur(10px)" }}
        >
          {/* Table topbar */}
          <div className="px-5 py-3.5 border-b border-stone-800/40 flex items-center justify-between"
            style={{ background: "rgba(28,22,16,0.5)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-amber-600/50" />
              <span className="text-[11px] font-mono uppercase tracking-widest text-stone-500">All Positions</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-mono uppercase tracking-widest">Updated hourly</span>
            </div>
          </div>

          <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
            <colgroup>
              <col style={{ width: "8%" }} />
              <col style={{ width: "auto" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: 40 }} />
            </colgroup>
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id} className="border-b border-stone-800/30">
                  {hg.headers.map(header => (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`px-5 py-4 text-left text-[11px] font-medium text-stone-500 uppercase tracking-widest whitespace-nowrap ${
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
                  <th className="w-10" />
                </tr>
              ))}
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="py-28">
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
                      <span className="text-[11px] font-mono uppercase tracking-widest text-stone-600">Fetching positions…</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-24 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="w-7 h-7 text-stone-800" />
                      <span className="text-stone-600 text-sm">No positions match your filters</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && table.getRowModel().rows.map((row, i) => (
                <motion.tr
                  key={row.id}
                  ref={undefined}
                  initial={{ opacity: 0, y: 16, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.55, delay: Math.min(i * 0.04, 0.5), ease: [0.16, 1, 0.3, 1] }}
                  onClick={() => navigate(`/jobs/${row.original.id}`)}
                  className="relative cursor-pointer border-b border-stone-800/40 last:border-0 transition-all duration-200 group"
                  style={{
                    borderLeft: `2px solid ${rowAccentColor(row.original.score)}`,
                  }}
                  whileHover={{ backgroundColor: "rgba(30,25,20,0.6)" }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={`px-5 ${paddingY} align-middle`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                  <td className={`px-4 ${paddingY} w-10`}>
                    <div className="text-amber-600/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>

          {!loading && jobs.length > 0 && (
            <div className="border-t border-stone-800/30 px-5 py-3.5 flex items-center justify-between"
              style={{ background: "rgba(20,16,12,0.4)" }}
            >
              <span className="text-[11px] text-stone-600">
                Showing <span className="text-amber-600/55 font-semibold">{filteredCount}</span> of {jobs.length} positions
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
              <Orbit className="w-6 h-6 text-stone-700" />
            </motion.div>
            <div>
              <p className="text-stone-500 text-sm mb-1">Your orbit is empty.</p>
              <p className="text-stone-700 text-xs">Add some positions to get started.</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;