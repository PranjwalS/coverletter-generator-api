"use client";

import { useNavigate } from "react-router-dom";
import type { SupabaseJob } from "../types/supabase_job";
import { useState, useEffect, useRef, memo, useCallback } from "react";
import { supabase } from "../lib/supabase";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState,
} from "@tanstack/react-table";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { animate } from "motion/react";
import {
  ChevronUp, ChevronDown, BarChart2, Briefcase,
  CheckCircle, TrendingUp, SlidersHorizontal, X, Search,
  Clock, ArrowUpRight,
} from "lucide-react";
import { BGPattern } from "@/components/ui/bg_pattern";
import { SlidingNumber } from "@/components/ui/sliding_number";
import { SpecialText } from "@/components/ui/special_text";
import Navbar from "@/components/Navbar";

// ─── INLINE GLOWING EFFECT (no path alias dep) ───────────────────────────────

const GlowingEffect = memo(({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  spread = 20, disabled = true,
  proximity = 0, inactiveZone = 0.7, movementDuration = 2, borderWidth = 1,
}: {
  spread?: number; glow?: boolean; disabled?: boolean; proximity?: number;
  inactiveZone?: number; movementDuration?: number; borderWidth?: number;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastPosition = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>(0);

  const handleMove = useCallback((e?: MouseEvent | { x: number; y: number }) => {
    if (!containerRef.current) return;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const mx = e?.x ?? lastPosition.current.x;
      const my = e?.y ?? lastPosition.current.y;
      if (e) lastPosition.current = { x: mx, y: my };
      const cx = left + width * 0.5, cy = top + height * 0.5;
      if (Math.hypot(mx - cx, my - cy) < 0.5 * Math.min(width, height) * inactiveZone) {
        el.style.setProperty("--active", "0"); return;
      }
      const isActive = mx > left - proximity && mx < left + width + proximity && my > top - proximity && my < top + height + proximity;
      el.style.setProperty("--active", isActive ? "1" : "0");
      if (!isActive) return;
      const cur = parseFloat(el.style.getPropertyValue("--start")) || 0;
      const target = (180 * Math.atan2(my - cy, mx - cx)) / Math.PI + 90;
      const diff = ((target - cur + 180) % 360) - 180;
      animate(cur, cur + diff, {
        duration: movementDuration, ease: [0.16, 1, 0.3, 1],
        onUpdate: (v) => el.style.setProperty("--start", String(v)),
      });
    });
  }, [inactiveZone, proximity, movementDuration]);

  useEffect(() => {
    if (disabled) return;
    const onScroll = () => handleMove();
    const onPointer = (e: PointerEvent) => handleMove(e);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.body.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      window.removeEventListener("scroll", onScroll);
      document.body.removeEventListener("pointermove", onPointer);
    };
  }, [handleMove, disabled]);

  if (disabled) return null;

  return (
    <div
      ref={containerRef}
      style={{
        "--blur": "0px", "--spread": spread, "--start": "0", "--active": "0",
        "--glowingeffect-border-width": `${borderWidth}px`,
        "--repeating-conic-gradient-times": "5",
        "--gradient": `radial-gradient(circle, #f59e0b 10%, transparent 20%),
          radial-gradient(circle at 40% 40%, #d97706 5%, transparent 15%),
          radial-gradient(circle at 60% 60%, #92400e 10%, transparent 20%),
          radial-gradient(circle at 40% 60%, #fbbf24 10%, transparent 20%),
          repeating-conic-gradient(from 236.84deg at 50% 50%,
            #f59e0b 0%, #d97706 calc(25%/var(--repeating-conic-gradient-times)),
            #92400e calc(50%/var(--repeating-conic-gradient-times)),
            #fbbf24 calc(75%/var(--repeating-conic-gradient-times)),
            #f59e0b calc(100%/var(--repeating-conic-gradient-times)))`,
      } as React.CSSProperties}
      className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity"
    >
      <div className={[
        "glow rounded-[inherit]",
        'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
        "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
        "after:[background:var(--gradient)] after:[background-attachment:fixed]",
        "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
        "after:[mask-clip:padding-box,border-box] after:[mask-composite:intersect]",
        "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]",
      ].join(" ")} />
    </div>
  );
});
GlowingEffect.displayName = "GlowingEffect";

// ─── GRAIN ────────────────────────────────────────────────────────────────────

const GrainOverlay = () => (
  <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.015]"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundRepeat: "repeat", backgroundSize: "128px 128px",
    }}
  />
);

// ─── ANIMATED STAT CARD ──────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  icon: React.ReactNode;
  accent: "amber" | "green" | "blue" | "zinc";
  delay?: number;
  sublabel?: string;
}

const ACCENTS = {
  amber: { text: "text-amber-400", border: "border-amber-500/20", icon: "text-amber-400 border-amber-500/20 bg-amber-500/5" },
  green: { text: "text-green-400", border: "border-green-500/20", icon: "text-green-400 border-green-500/20 bg-green-500/5" },
  blue:  { text: "text-blue-400",  border: "border-blue-500/20",  icon: "text-blue-400  border-blue-500/20  bg-blue-500/5"  },
  zinc:  { text: "text-zinc-400",  border: "border-zinc-700/40",  icon: "text-zinc-400  border-zinc-700/40  bg-zinc-800/30" },
};

const StatCard = ({ label, value, suffix = "", icon, accent, delay = 0, sublabel }: StatCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const [displayVal, setDisplayVal] = useState(0);
  const colors = ACCENTS[accent];

  useEffect(() => {
    if (!inView) return;
    const timeout = setTimeout(() => setDisplayVal(value), delay * 1000 + 200);
    return () => clearTimeout(timeout);
  }, [inView, value, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative p-[1px] rounded-sm"
    >
      <GlowingEffect spread={30} disabled={false} proximity={70} inactiveZone={0.05} borderWidth={1.5} />
      <div className={`relative border ${colors.border} bg-zinc-950 p-5 overflow-hidden h-full rounded-sm`}>
        {/* Subtle corner marks */}
        <div className={`absolute top-0 left-0 w-4 h-4 border-t border-l ${colors.border} pointer-events-none`} />
        <div className={`absolute bottom-0 right-0 w-4 h-4 border-b border-r ${colors.border} pointer-events-none`} />

        <div className="flex items-start justify-between mb-3">
          <div className={`flex items-center justify-center w-8 h-8 border rounded-sm ${colors.icon}`}>
            {icon}
          </div>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: delay + 1 }}
            className={`${colors.text} opacity-30`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
          </motion.div>
        </div>

        {/* SlidingNumber for animated count */}
        <div className={`font-display text-3xl font-black ${colors.text} tracking-tight mb-0.5 flex items-end gap-0.5`}>
          <SlidingNumber value={displayVal} />
          {suffix && <span className="text-lg mb-0.5">{suffix}</span>}
        </div>
        <div className="text-zinc-500 text-[11px] font-mono uppercase tracking-widest">{label}</div>
        {sublabel && <div className="text-zinc-700 text-[10px] font-mono mt-0.5">{sublabel}</div>}
      </div>
    </motion.div>
  );
};

// ─── SCORE DISPLAY ────────────────────────────────────────────────────────────

const ScoreDisplay = ({ score }: { score: number | null }) => {
  if (!score) return <span className="text-zinc-700 font-mono text-sm">—</span>;
  const color = score >= 80 ? "#f59e0b" : score >= 60 ? "#d97706" : score >= 40 ? "#92400e" : "#ef4444";
  return (
    <div className="flex items-center gap-2">
      <span className="font-display text-xl font-black tabular-nums" style={{ color }}>
        {score}
      </span>
      <div className="w-16 h-[3px] bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          className="h-full rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}50` }}
        />
      </div>
    </div>
  );
};

// ─── STATUS BADGE ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }: { status: string | null }) => {
  const s = status || "Not Applied";
  const styles: Record<string, string> = {
    "Applied":     "bg-green-500/10 border-green-500/30 text-green-400",
    "Interview":   "bg-amber-500/10 border-amber-500/30 text-amber-400",
    "Offer":       "bg-blue-500/10  border-blue-500/30  text-blue-400",
    "Rejected":    "bg-red-500/10   border-red-500/30   text-red-400",
    "Ghosted":     "bg-zinc-800/60  border-zinc-700/40  text-zinc-500",
    "Not Applied": "bg-transparent  border-zinc-700/50  text-zinc-500",
  };
  return (
    <span className={`inline-flex items-center border px-2.5 py-1 text-xs font-mono uppercase tracking-widest whitespace-nowrap rounded-sm ${styles[s] || styles["Not Applied"]}`}>
      {s}
    </span>
  );
};

// ─── GLOWING SEARCH BAR ──────────────────────────────────────────────────────

const GlowingSearchBar = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
  <div className="relative flex items-center group flex-1 max-w-[560px]">
    {/* Animated glow border */}
    <div className="absolute z-[-1] overflow-hidden inset-0 rounded-md blur-[3px]
      before:absolute before:content-[''] before:z-[-2] before:w-[999px] before:h-[999px]
      before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-60
      before:bg-[conic-gradient(#09090b,#f59e0b_5%,#09090b_38%,#09090b_50%,#d97706_60%,#09090b_87%)]
      before:transition-all before:duration-[2000ms]
      group-hover:before:rotate-[-120deg]
      group-focus-within:before:rotate-[420deg] group-focus-within:before:duration-[4000ms]" />
    <div className="absolute z-[-1] overflow-hidden inset-0 rounded-md blur-[0.5px]
      before:absolute before:content-[''] before:z-[-2] before:w-[600px] before:h-[600px]
      before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-70
      before:bg-[conic-gradient(#09090b,#f59e0b_5%,#09090b_14%,#09090b_50%,#d97706_60%,#09090b_64%)]
      before:transition-all before:duration-[2000ms]
      group-hover:before:rotate-[-110deg]
      group-focus-within:before:rotate-[430deg] group-focus-within:before:duration-[4000ms]" />

    {/* Search icon */}
    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" fill="none">
        <circle stroke="url(#sg2)" r="8" cy="11" cx="11" />
        <line stroke="url(#sl2)" y2="16.65" y1="22" x2="16.65" x1="22" />
        <defs>
          <linearGradient gradientTransform="rotate(50)" id="sg2">
            <stop stopColor="#fbbf24" offset="0%" /><stop stopColor="#92400e" offset="100%" />
          </linearGradient>
          <linearGradient id="sl2">
            <stop stopColor="#92400e" offset="0%" /><stop stopColor="#44403c" offset="100%" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search jobs, companies, locations..."
      className="w-full h-11 bg-zinc-950 rounded-md text-zinc-200 pl-11 pr-4 text-sm font-mono focus:outline-none placeholder-zinc-600 tracking-wide border-0"
    />
  </div>
);

// ─── TABLE ROW ────────────────────────────────────────────────────────────────

const JobRow = ({
  row, index, onClick,
}: {
  row: ReturnType<ReturnType<typeof useReactTable>["getRowModel"]>["rows"][0];
  index: number;
  onClick: () => void;
}) => {
  const ref = useRef<HTMLTableRowElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10px" });
  const [hovered, setHovered] = useState(false);

  return (
    <motion.tr
      ref={ref}
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.45, delay: index * 0.035, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative cursor-pointer transition-colors duration-150 border-b border-zinc-800/50 last:border-0 ${hovered ? "bg-zinc-900/70" : "bg-transparent"}`}
    >
      {/* Left amber accent */}
      <td className="p-0 w-0 relative">
        <motion.div
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className="absolute left-0 top-0 bottom-0 w-[2px] bg-amber-500/70"
        />
      </td>

      {row.getVisibleCells().map((cell) => (
        <td key={cell.id} className="px-4 py-4 align-middle">
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}

      <td className="px-3 py-4 w-8">
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -4 }}
              transition={{ duration: 0.12 }}
              className="text-amber-500/50"
            >
              <ArrowUpRight className="w-4 h-4" />
            </motion.div>
          )}
        </AnimatePresence>
      </td>
    </motion.tr>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<SupabaseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("jobs").select("*");
      if (data) setJobs(data as SupabaseJob[]);
      setLoading(false);
    })();
  }, []);

  const uniqueLocations = Array.from(new Set(jobs.map((j) => j.location).filter(Boolean))).sort();

  // ── columns ──────────────────────────────────────────────────────────────

  const columns: ColumnDef<SupabaseJob>[] = [
    {
      accessorKey: "score", header: "Score", id: "score",
      size: 120,
      filterFn: (row, id, fv) => { const s = row.getValue(id) as number | null; return s !== null && s >= Number(fv); },
      cell: ({ getValue }) => <ScoreDisplay score={getValue() as number | null} />,
    },
    {
      accessorKey: "title", header: "Position", id: "title",
      size: 340,
      cell: ({ getValue, row }) => (
        <div className="min-w-0">
          <div className="font-display font-black text-zinc-100 text-2xl tracking-tight leading-tight truncate">
            {getValue() as string}
          </div>
          <div className="text-zinc-500 text-sm font-mono mt-0.5">{row.original.company}</div>
        </div>
      ),
    },
    {
      accessorKey: "location", header: "Location", id: "location",
      size: 200,
      filterFn: (row, id, fv) => {
        const loc = row.getValue(id) as string | null;
        return loc?.toLowerCase().includes((fv as string).toLowerCase()) ?? false;
      },
      cell: ({ getValue }) => (
        <span className="text-zinc-400 text-sm font-mono  block max-w-[180px]">
          {(getValue() as string) || "—"}
        </span>
      ),
    },
    {
      id: "application_status", header: "Status", accessorKey: "application_status",
      size: 140,
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
    state: { sorting, columnFilters, globalFilter },
  });

  // location filter
  useEffect(() => {
    if (locationFilter === "all") {
      setColumnFilters(p => p.filter(f => f.id !== "location"));
    } else {
      setColumnFilters(p => [...p.filter(f => f.id !== "location"), { id: "location", value: locationFilter }]);
    }
  }, [locationFilter]);

  // status filter
  useEffect(() => {
    if (statusFilter === "all") {
      setColumnFilters(p => p.filter(f => f.id !== "application_status"));
    } else {
      setColumnFilters(p => [...p.filter(f => f.id !== "application_status"), { id: "application_status", value: statusFilter }]);
    }
  }, [statusFilter]);

  // score filter
  useEffect(() => {
    if (minScore === "") {
      setColumnFilters(p => p.filter(f => f.id !== "score"));
    } else {
      setColumnFilters(p => [...p.filter(f => f.id !== "score"), { id: "score", value: Number(minScore) }]);
    }
  }, [minScore]);

  const filteredCount = table.getFilteredRowModel().rows.length;
  const appliedCount = jobs.filter(j => j.application_status === "Applied").length;
  const highMatch = jobs.filter(j => (j.score || 0) >= 80).length;
  const avgScore = jobs.length
    ? Math.round(jobs.filter(j => j.score).reduce((a, b) => a + (b.score || 0), 0) / (jobs.filter(j => j.score).length || 1))
    : 0;

  const hasActiveFilters = globalFilter || locationFilter !== "all" || statusFilter !== "all" || minScore !== "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-500/30 selection:text-amber-200">
      <GrainOverlay />

      {/* BGPattern background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <BGPattern variant="grid" fill="rgba(245,158,11,0.035)" size={40} mask="fade-edges" />
        <div className="absolute top-0 left-1/3 w-[700px] h-[500px] bg-amber-500/[0.025] rounded-full blur-[160px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-amber-600/[0.02] rounded-full blur-[120px]" />
      </div>

      <Navbar />

      <div className="relative z-10 w-full px-6 lg:px-10 xl:px-14 pt-20 pb-20">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-8 pt-6"
        >
          <div className="flex items-center gap-4 mb-2">
            <div className="h-[1px] w-8 bg-amber-500/40" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500/70">Fall 2026 Co-op Hunt</span>
          </div>
          <h1 className="font-display text-5xl lg:text-6xl font-black tracking-tight text-zinc-100 leading-[0.9] flex items-end gap-4">
            <span>JOB </span>
            <SpecialText className="text-amber-400 text-5xl lg:text-6xl font-black" speed={18}>
              DASHBOARD
            </SpecialText>
          </h1>
        </motion.div>

        {/* ── STAT CARDS ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total Jobs" value={jobs.length} icon={<Briefcase className="w-4 h-4" />} accent="zinc" delay={0} />
          <StatCard label="High Match" value={highMatch} sublabel="Score ≥ 80" icon={<TrendingUp className="w-4 h-4" />} accent="amber" delay={0.08} />
          <StatCard label="Applied" value={appliedCount} icon={<CheckCircle className="w-4 h-4" />} accent="green" delay={0.16} />
          <StatCard label="Avg Score" value={avgScore} icon={<BarChart2 className="w-4 h-4" />} accent="blue" delay={0.24} />
        </div>

        {/* ── SEARCH + FILTERS ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mb-5"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <GlowingSearchBar value={globalFilter} onChange={setGlobalFilter} />

            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setFiltersOpen(o => !o)}
              className={[
                "flex items-center gap-2 border px-4 h-11 font-mono text-[11px] uppercase tracking-widest transition-all duration-200 rounded-sm",
                filtersOpen
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                  : "border-zinc-800/60 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
              ].join(" ")}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {hasActiveFilters && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </motion.button>

            <AnimatePresence>
              {hasActiveFilters && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
                  whileHover={{ scale: 1.05 }}
                  onClick={() => { setGlobalFilter(""); setLocationFilter("all"); setStatusFilter("all"); setMinScore(""); }}
                  className="flex items-center gap-1.5 text-zinc-600 hover:text-red-400 font-mono text-[10px] uppercase tracking-widest transition-colors"
                >
                  <X className="w-3 h-3" /><span>Clear</span>
                </motion.button>
              )}
            </AnimatePresence>

            <div className="ml-auto text-[11px] font-mono text-zinc-600">
              <span className="text-amber-500/80">{filteredCount}</span> / {jobs.length} jobs
            </div>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="flex flex-wrap items-center gap-3 pt-3 pb-1 border-t border-zinc-800/40 mt-3">
                  {/* Location */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Location</label>
                    <select
                      value={locationFilter}
                      onChange={e => setLocationFilter(e.target.value)}
                      className="appearance-none bg-zinc-900 border border-zinc-800/60 text-zinc-300 text-xs font-mono px-3 py-2 pr-7 focus:outline-none focus:border-amber-500/30 transition-colors cursor-pointer hover:border-zinc-700 rounded-sm min-w-[160px]"
                    >
                      <option value="all" className="bg-zinc-900">All Locations</option>
                      {uniqueLocations.map(l => <option key={l} value={l} className="bg-zinc-900">{l}</option>)}
                    </select>
                  </div>

                  {/* Status */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Status</label>
                    <select
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value)}
                      className="appearance-none bg-zinc-900 border border-zinc-800/60 text-zinc-300 text-xs font-mono px-3 py-2 pr-7 focus:outline-none focus:border-amber-500/30 transition-colors cursor-pointer hover:border-zinc-700 rounded-sm min-w-[140px]"
                    >
                      <option value="all" className="bg-zinc-900">All Statuses</option>
                      <option value="Not Applied" className="bg-zinc-900">Not Applied</option>
                      <option value="Applied" className="bg-zinc-900">Applied</option>
                      <option value="Interview" className="bg-zinc-900">Interview</option>
                      <option value="Offer" className="bg-zinc-900">Offer</option>
                      <option value="Rejected" className="bg-zinc-900">Rejected</option>
                    </select>
                  </div>

                  {/* Min score */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">Min Score</label>
                    <input
                      type="number" value={minScore}
                      onChange={e => setMinScore(e.target.value)}
                      placeholder="0–100" min="0" max="100"
                      className="w-20 bg-zinc-900 border border-zinc-800/60 text-zinc-300 text-xs font-mono text-center py-2 px-2 focus:outline-none focus:border-amber-500/30 transition-colors rounded-sm"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── TABLE ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="relative p-[1px] rounded-sm"
        >
          <GlowingEffect spread={80} disabled={false} proximity={160} inactiveZone={0.01} borderWidth={1} />

          <div className="relative border border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm overflow-hidden rounded-sm">

            {/* Table — full width, columns auto-sized */}
            <table className="w-full table-fixed border-collapse">
              <colgroup>
                <col className="w-0" />          {/* accent line */}
                <col className="w-[150px]" />    {/* score */}
                <col />                          {/* position — takes all remaining space */}
                <col className="w-[300px]" />    {/* location */}
                <col className="w-[140px]" />    {/* status */}
                <col className="w-8" />          {/* arrow */}
              </colgroup>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} className="border-b border-zinc-800/60 bg-zinc-900/40">
                    <th className="w-0 p-0" />
                    {hg.headers.map(header => (
                      <th
                        key={header.id}
                        onClick={header.column.getToggleSortingHandler()}
                        className={[
                          "px-4 py-3.5 text-left text-[11px] font-mono uppercase tracking-widest text-zinc-500 whitespace-nowrap",
                          header.column.getCanSort() ? "cursor-pointer select-none hover:text-zinc-300 transition-colors" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === "desc" && <ChevronDown className="w-3 h-3 text-amber-500" />}
                          {header.column.getIsSorted() === "asc"  && <ChevronUp   className="w-3 h-3 text-amber-500" />}
                        </div>
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                ))}
              </thead>

              <tbody>
                {/* Loading */}
                {loading && (
                  <tr>
                    <td colSpan={columns.length + 2} className="py-24">
                      <div className="flex flex-col items-center gap-4">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                          className="w-8 h-8 border border-amber-500/30 border-t-amber-500 rounded-full"
                        />
                        <span className="text-[11px] font-mono uppercase tracking-widest text-zinc-600">Loading jobs...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Empty */}
                {!loading && table.getRowModel().rows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 2} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Search className="w-8 h-8 text-zinc-800" />
                        <span className="text-zinc-600 font-mono text-xs uppercase tracking-widest">No jobs found</span>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Rows */}
                {!loading && table.getRowModel().rows.map((row, i) => (
                  <JobRow key={row.id} row={row} index={i} onClick={() => navigate(`/jobs/${row.original.id}`)} />
                ))}
              </tbody>
            </table>

            {/* Footer */}
            {!loading && jobs.length > 0 && (
              <div className="border-t border-zinc-800/40 px-4 py-3 flex items-center justify-between bg-zinc-900/20">
                <span className="text-[11px] font-mono text-zinc-700">
                  Showing <span className="text-amber-500/70">{filteredCount}</span> of {jobs.length} jobs
                </span>
                <div className="flex items-center gap-2 text-zinc-700">
                  <Clock className="w-3 h-3" />
                  <span className="text-[10px] font-mono uppercase tracking-widest">Updated hourly</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;