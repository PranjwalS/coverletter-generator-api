/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

// ─── IMPORTS ──────────────────────────────────────────────────────────────────
import { useNavigate } from "react-router-dom";
import type { SupabaseJob } from "../types/supabase_job";
import { useState, useEffect, useRef, useCallback, memo } from "react";
import ReactDOM from "react-dom";
import { supabase } from "../lib/supabase";
import {
  useReactTable, getCoreRowModel, getSortedRowModel,
  getFilteredRowModel, flexRender,
  type ColumnDef, type SortingState, type ColumnFiltersState,
} from "@tanstack/react-table";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { animate } from "motion/react";
import {
  Zap, ChevronDown, ChevronUp, CheckCircle, Clock, X,
  Search, SlidersHorizontal, CalendarIcon, FileText,
  Award, AlertCircle, ArrowUpRight, Briefcase, Target,
  Save, Trash2, Download, Tag,
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
  "No update":                         { bg:"bg-zinc-800",      text:"text-zinc-400",  border:"border-zinc-600",      dot:"bg-zinc-500",   row:"" },
  "OA to do":                          { bg:"bg-amber-900/80",  text:"text-amber-300", border:"border-amber-600/70",  dot:"bg-amber-400",  row:"" },
  "OA done (waiting)":                 { bg:"bg-amber-900/60",  text:"text-amber-200", border:"border-amber-600/50",  dot:"bg-amber-300",  row:"" },
  "Interview to do (scheduled)":       { bg:"bg-blue-900/80",   text:"text-blue-300",  border:"border-blue-600/70",   dot:"bg-blue-400",   row:"bg-blue-500/[0.02]" },
  "Interview done (waiting response)": { bg:"bg-blue-900/60",   text:"text-blue-200",  border:"border-blue-600/50",   dot:"bg-blue-300",   row:"bg-blue-500/[0.02]" },
  "Rejected":                          { bg:"bg-red-900/80",    text:"text-red-300",   border:"border-red-600/70",    dot:"bg-red-400",    row:"" },
  "Ghosted":                           { bg:"bg-red-950/80",    text:"text-red-400",   border:"border-red-800/60",    dot:"bg-red-500/70", row:"" },
  "Offer":                             { bg:"bg-green-900/80",  text:"text-green-300", border:"border-green-600/70",  dot:"bg-green-400",  row:"bg-green-500/[0.03]" },
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

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function getDaysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  const t = new Date(); t.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.ceil((d.getTime() - t.getTime()) / 86400000);
}

function getDeadlineStyle(dateStr: string | null) {
  const days = getDaysUntil(dateStr);
  if (days === null) return { pill:"bg-zinc-800 border-zinc-700 text-zinc-500", label:"", urgent:false };
  if (days < 0)   return { pill:"bg-zinc-800 border-zinc-700 text-zinc-500",              label:`${Math.abs(days)}d ago`, urgent:false };
  if (days === 0) return { pill:"bg-blue-900 border-blue-500 text-blue-200",              label:"Today!",        urgent:true  };
  if (days <= 3)  return { pill:"bg-red-900 border-red-500 text-red-300",                 label:`${days}d left`, urgent:true  };
  if (days <= 7)  return { pill:"bg-orange-900 border-orange-600 text-orange-300",        label:`${days}d left`, urgent:false };
  if (days <= 14) return { pill:"bg-yellow-900 border-yellow-600 text-yellow-300",        label:`${days}d left`, urgent:false };
  return           { pill:"bg-green-900 border-green-700 text-green-400",                 label:`${days}d left`, urgent:false };
}

function fmtDeadline(dateStr: string | null) {
  if (!dateStr) return "Set deadline";
  const d = new Date(dateStr);
  const hasTime = dateStr.includes("T") && !dateStr.endsWith("T00:00") && !dateStr.endsWith("T00:00:00");
  if (hasTime) return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}) + " " + String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0");
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
}

// ─── PORTAL DROPDOWN — renders outside the table DOM entirely ─────────────────

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
        // check if click is inside any portal dropdown
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

  // Close on scroll
  useEffect(() => {
    if (!open) return;
    const handler = () => close();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [open, close]);

  return { triggerRef, open, openDropdown, close, coords };
}

// ─── GRAIN ────────────────────────────────────────────────────────────────────

const GrainOverlay = () => (
  <div className="pointer-events-none fixed inset-0 z-50 opacity-[0.015]"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      backgroundRepeat: "repeat", backgroundSize: "128px 128px",
    }}
  />
);

// ─── GLOW EFFECT ──────────────────────────────────────────────────────────────

const GlowingEffect = memo(({ spread=20, disabled=true, proximity=0, inactiveZone=0.7, movementDuration=2, borderWidth=1 }: {
  spread?:number; disabled?:boolean; proximity?:number; inactiveZone?:number; movementDuration?:number; borderWidth?:number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef({ x:0, y:0 });
  const raf = useRef<number>(0);

  const onMove = useCallback((e?: MouseEvent | { x:number; y:number }) => {
    if (!ref.current) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current; if (!el) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const mx = e?.x ?? last.current.x, my = e?.y ?? last.current.y;
      if (e) last.current = { x:mx, y:my };
      const cx = left + width * 0.5, cy = top + height * 0.5;
      if (Math.hypot(mx-cx, my-cy) < 0.5 * Math.min(width,height) * inactiveZone) { el.style.setProperty("--active","0"); return; }
      const ok = mx > left-proximity && mx < left+width+proximity && my > top-proximity && my < top+height+proximity;
      el.style.setProperty("--active", ok ? "1" : "0");
      if (!ok) return;
      const cur = parseFloat(el.style.getPropertyValue("--start")) || 0;
      const tgt = (180 * Math.atan2(my-cy, mx-cx)) / Math.PI + 90;
      animate(cur, cur + ((tgt-cur+180) % 360) - 180, { duration:movementDuration, ease:[0.16,1,0.3,1], onUpdate: v => el.style.setProperty("--start", String(v)) });
    });
  }, [inactiveZone, proximity, movementDuration]);

  useEffect(() => {
    if (disabled) return;
    const sc = () => onMove();
    const pm = (e: PointerEvent) => onMove(e);
    window.addEventListener("scroll", sc, { passive:true });
    document.body.addEventListener("pointermove", pm, { passive:true });
    return () => { if (raf.current) cancelAnimationFrame(raf.current); window.removeEventListener("scroll",sc); document.body.removeEventListener("pointermove",pm); };
  }, [onMove, disabled]);

  if (disabled) return null;
  return (
    <div ref={ref}
      style={{ "--blur":"0px","--spread":spread,"--start":"0","--active":"0","--glowingeffect-border-width":`${borderWidth}px`,"--repeating-conic-gradient-times":"5","--gradient":`radial-gradient(circle,#f59e0b 10%,transparent 20%),radial-gradient(circle at 40% 40%,#d97706 5%,transparent 15%),repeating-conic-gradient(from 236.84deg at 50% 50%,#f59e0b 0%,#d97706 calc(25%/var(--repeating-conic-gradient-times)),#92400e calc(50%/var(--repeating-conic-gradient-times)),#fbbf24 calc(75%/var(--repeating-conic-gradient-times)),#f59e0b calc(100%/var(--repeating-conic-gradient-times)))` } as React.CSSProperties}
      className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity"
    >
      <div className={["glow rounded-[inherit]",'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',"after:[border:var(--glowingeffect-border-width)_solid_transparent]","after:[background:var(--gradient)] after:[background-attachment:fixed]","after:opacity-[var(--active)] after:transition-opacity after:duration-300","after:[mask-clip:padding-box,border-box] after:[mask-composite:intersect]","after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]"].join(" ")} />
    </div>
  );
});
GlowingEffect.displayName = "GlowingEffect";

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
        className="fixed bottom-24 right-6 z-[9998] flex items-center gap-2 bg-zinc-900 border border-green-500/40 text-green-400 text-xs font-medium px-3 py-2 rounded-md shadow-xl"
      >
        <Save className="w-3 h-3" /><span>Saved</span>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─── PIPELINE BAR ─────────────────────────────────────────────────────────────

const PipelineBar = ({ jobs }: { jobs:SupabaseJob[] }) => {
  const stages = [
    { key:"No update",                         color:"bg-zinc-700",     label:"Pending" },
    { key:"OA to do",                          color:"bg-amber-500/80", label:"OA" },
    { key:"OA done (waiting)",                 color:"bg-amber-400/50", label:"OA Wait" },
    { key:"Interview to do (scheduled)",       color:"bg-blue-500/90",  label:"Interview" },
    { key:"Interview done (waiting response)", color:"bg-blue-400/60",  label:"Int. Wait" },
    { key:"Offer",                             color:"bg-green-500",    label:"Offer" },
    { key:"Rejected",                          color:"bg-red-500/70",   label:"Rejected" },
    { key:"Ghosted",                           color:"bg-red-500/25",   label:"Ghosted" },
  ];
  const counts: Record<string,number> = {};
  stages.forEach(s => { counts[s.key] = jobs.filter(j => (j.feedback_status||"No update") === s.key).length; });
  const total = jobs.length || 1;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-[1px] w-6 bg-amber-500/30" />
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">Pipeline</span>
      </div>
      <div className="flex h-1.5 rounded-full overflow-hidden gap-px bg-zinc-900 mb-2">
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
            <span className="text-xs text-zinc-500">{s.label} <span className="text-zinc-500">{counts[s.key]}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── STICKY STATS ─────────────────────────────────────────────────────────────

const StickyStats = ({ jobs, visible }: { jobs:SupabaseJob[]; visible:boolean }) => {
  const interviews = jobs.filter(j => j.feedback_status?.includes("Interview")).length;
  const offers = jobs.filter(j => j.feedback_status === "Offer").length;
  const urgent = jobs.filter(j => { const d = getDaysUntil(j.deadline??null); return d!==null && d>=0 && d<=3; }).length;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ y:-40, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:-40, opacity:0 }} transition={{ duration:0.3, ease:[0.16,1,0.3,1] }}
          className="fixed top-14 left-0 right-0 z-30 border-b border-zinc-800/60 bg-zinc-950/95 backdrop-blur-xl"
        >
          <div className="w-full px-6 lg:px-10 xl:px-14 h-10 flex items-center gap-8">
            <div className="flex items-center gap-2 text-sm text-zinc-400"><Briefcase className="w-3 h-3 text-amber-500/60"/><span className="text-amber-400">{jobs.length}</span> applied</div>
            <div className="flex items-center gap-2 text-sm text-zinc-400"><Target className="w-3 h-3 text-blue-500/60"/><span className="text-blue-400">{interviews}</span> interviews</div>
            <div className="flex items-center gap-2 text-sm text-zinc-400"><Award className="w-3 h-3 text-green-500/60"/><span className="text-green-400">{offers}</span> offers</div>
            {urgent > 0 && <div className="flex items-center gap-2 text-sm"><AlertCircle className="w-3 h-3 text-red-500/80"/><span className="text-red-400">{urgent}</span><span className="text-zinc-600">urgent</span></div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── STAT CARD ────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon, accent, delay=0 }: {
  label:string; value:number; icon:React.ReactNode; accent:"amber"|"green"|"blue"|"red"|"zinc"; delay?:number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once:true });
  const [val, setVal] = useState(0);
  const C = {
    amber:{ text:"text-amber-400", border:"border-amber-500/20", icon:"text-amber-400 border-amber-500/20 bg-amber-500/5" },
    green:{ text:"text-green-400", border:"border-green-500/20", icon:"text-green-400 border-green-500/20 bg-green-500/5" },
    blue: { text:"text-blue-400",  border:"border-blue-500/20",  icon:"text-blue-400 border-blue-500/20 bg-blue-500/5"    },
    red:  { text:"text-red-400",   border:"border-red-500/20",   icon:"text-red-400  border-red-500/20 bg-red-500/5"      },
    zinc: { text:"text-zinc-400",  border:"border-zinc-700/40",  icon:"text-zinc-400 border-zinc-700/40 bg-zinc-800/30"   },
  };
  const c = C[accent];
  useEffect(() => { if (inView) { const t = setTimeout(() => setVal(value), delay*1000+100); return () => clearTimeout(t); } }, [inView, value, delay]);
  return (
    <motion.div ref={ref} initial={{ opacity:0, y:16 }} animate={inView ? { opacity:1, y:0 } : {}}
      transition={{ duration:0.6, delay, ease:[0.16,1,0.3,1] }} className="relative p-[1px] rounded-sm"
    >
      <GlowingEffect spread={28} disabled={false} proximity={70} inactiveZone={0.05} borderWidth={1.5} />
      <div className={`relative border ${c.border} bg-zinc-950 p-5 overflow-hidden h-full rounded-sm`}>
        <div className={`absolute top-0 left-0 w-4 h-4 border-t border-l ${c.border} pointer-events-none`} />
        <div className={`absolute bottom-0 right-0 w-4 h-4 border-b border-r ${c.border} pointer-events-none`} />
        <div className={`inline-flex items-center justify-center w-8 h-8 border rounded-sm mb-3 ${c.icon}`}>{icon}</div>
        <div className={`text-3xl font-bold ${c.text} mb-0.5 flex items-end gap-0.5`}>
          <SlidingNumber value={val} />
        </div>
        <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider" >{label}</div>
      </div>
    </motion.div>
  );
};

// ─── OUTCOME DROPDOWN — portal-based, ALWAYS on top ──────────────────────────

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
        style={{ backgroundColor: "#18181b", border: "1px solid #52525b", borderRadius: 4, boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }}
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
                background: isActive ? "rgba(255,255,255,0.06)" : "transparent",
                border: "none", borderLeft: isActive ? "2px solid #f59e0b" : "2px solid transparent",
                cursor: "pointer", textAlign: "left",
                fontFamily: "system-ui, -apple-system, sans-serif", fontSize: 13, fontWeight: isActive ? 600 : 400,
                transition: "background 0.1s",
              }}
              className={`${isActive ? os.text : "text-zinc-300"} hover:bg-white/5`}
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
        className={`inline-flex items-center gap-2 px-3 py-2 border rounded-md transition-all duration-150 cursor-pointer select-none w-full ${s.bg} ${s.text} ${s.border}`}
        style={{ fontSize: 13, fontWeight: 500, whiteSpace: "normal", wordBreak: "break-word", minWidth: 0 }}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
        <span className="flex-1 text-left leading-snug">{outcome}</span>
        <ChevronDown className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      {menu}
    </>
  );
};

// ─── DEADLINE CELL — portal-based ─────────────────────────────────────────────

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
        style={{ backgroundColor: "#18181b", border: "1px solid #52525b", borderRadius: 4, padding: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }}
      >
        <p style={{ fontFamily:"Inter, system-ui, sans-serif", fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em", color:"#71717a", marginBottom:6 }}>Date</p>
        <input
          type="date" value={pd} onChange={e => setPd(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          style={{ width:"100%", padding:"6px 10px", background:"#27272a", border:"1px solid #52525b", color:"#e4e4e7", fontFamily:"Inter, system-ui, sans-serif", fontSize:13, borderRadius:4, marginBottom:10, outline:"none", boxSizing:"border-box" }}
        />
        <p style={{ fontFamily:"Inter, system-ui, sans-serif", fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em", color:"#71717a", marginBottom:6 }}>Time — 24hr (optional)</p>
        <input
          type="time" value={pt} onChange={e => setPt(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          style={{ width:"100%", padding:"6px 10px", background:"#27272a", border:"1px solid #52525b", color:"#e4e4e7", fontFamily:"Inter, system-ui, sans-serif", fontSize:13, borderRadius:4, marginBottom:12, outline:"none", boxSizing:"border-box" }}
        />
        <div style={{ display:"flex", gap:8 }}>
          <button
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); confirm(); }}
            style={{ flex:1, padding:"7px 0", background:"#f59e0b", color:"#09090b", fontFamily:"Inter, system-ui, sans-serif", fontSize:13, fontWeight:600, border:"none", borderRadius:4, cursor:"pointer" }}
          >
            Confirm
          </button>
          {job.deadline && (
            <button
              onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onUpdate(job.id, null); close(); }}
              style={{ padding:"7px 12px", background:"#3f3f46", color:"#f87171", fontFamily:"Inter, system-ui, sans-serif", fontSize:13, border:"1px solid #52525b", borderRadius:4, cursor:"pointer" }}
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
        className={`inline-flex items-center gap-2 px-3 py-2 border rounded-md transition-all duration-150 cursor-pointer select-none w-full ${pill} ${urgent ? "animate-pulse" : ""}`}
        style={{ fontSize: 13, whiteSpace: "normal", wordBreak: "break-word", minWidth: 0 }}
      >
        <CalendarIcon className="w-3.5 h-3.5 opacity-80 shrink-0" />
        <span className="flex-1 text-left leading-snug">{fmtDeadline(job.deadline ?? null)}{job.deadline && label ? <span className="opacity-60"> · {label}</span> : null}</span>
      </button>
      {picker}
    </>
  );
};

// ─── NOTES CELL — portal-based ────────────────────────────────────────────────

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
        style={{ backgroundColor: "#18181b", border: "1px solid #52525b", borderRadius: 4, padding: 14, boxShadow: "0 24px 64px rgba(0,0,0,0.8)" }}
      >
        <p style={{ fontFamily:"Inter, system-ui, sans-serif", fontSize:11, fontWeight:500, textTransform:"uppercase", letterSpacing:"0.06em", color:"#71717a", marginBottom:8 }}>Notes</p>
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onKeyDown={e => { if (e.key==="Enter"&&(e.metaKey||e.ctrlKey)) save(); if (e.key==="Escape") close(); }}
          placeholder="Add notes about this job..."
          rows={4}
          style={{ width:"100%", padding:"8px 10px", background:"#27272a", border:"1px solid #52525b", color:"#e4e4e7", fontFamily:"Inter, system-ui, sans-serif", fontSize:13, borderRadius:4, marginBottom:10, outline:"none", resize:"none", boxSizing:"border-box" }}
        />
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span style={{ fontFamily:"Inter, system-ui, sans-serif", fontSize:12, color:"#71717a" }}>⌘↵ to save</span>
          <button
            onMouseDown={e => { e.preventDefault(); e.stopPropagation(); save(); }}
            style={{ padding:"6px 14px", background:"#f59e0b", color:"#09090b", fontFamily:"Inter, system-ui, sans-serif", fontSize:13, fontWeight:600, border:"none", borderRadius:4, cursor:"pointer" }}
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
        className={`inline-flex items-center gap-2 px-3 py-2 border rounded-md transition-all duration-150 cursor-pointer w-full ${job.notes ? "bg-zinc-800 border-zinc-600 text-zinc-200" : "bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300"}`}
        style={{ fontSize: 13, whiteSpace: "normal", wordBreak: "break-word", minWidth: 0 }}
      >
        <FileText className="w-3.5 h-3.5 opacity-60 shrink-0" />
        <span className="flex-1 text-left leading-snug">{job.notes ? job.notes.slice(0,32)+(job.notes.length>32?"…":"") : "Add note"}</span>
      </button>
      {panel}
    </>
  );
};

// ─── SCORE DISPLAY ────────────────────────────────────────────────────────────

const ScoreDisplay = ({ score }: { score:number|null }) => {
  if (!score) return <span className="text-zinc-600 text-base">—</span>;
  const color = score>=80?"#f59e0b":score>=60?"#d97706":score>=40?"#b45309":"#ef4444";
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[18px] font-bold tabular-nums leading-none" style={{ color }}>{score}</span>
      <div className="w-10 h-[3px] bg-zinc-800 rounded-full overflow-hidden">
        <motion.div initial={{ width:0 }} animate={{ width:`${score}%` }} transition={{ duration:1, ease:[0.16,1,0.3,1] }}
          className="h-full rounded-full" style={{ backgroundColor:color }}
        />
      </div>
    </div>
  );
};

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
  const outcome = job.feedback_status || "No update";
  const os = getOS(outcome);

  return (
    <motion.tr ref={ref}
      initial={{ opacity:0, y:10, filter:"blur(4px)" }}
      animate={inView ? { opacity:1, y:0, filter:"blur(0px)" } : {}}
      transition={{ duration:0.45, delay:index*0.03, ease:[0.16,1,0.3,1] }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      className={`relative cursor-pointer transition-colors duration-150 border-b border-zinc-800/40 last:border-0 ${selected?"bg-amber-500/5":hovered?"bg-zinc-900/70":isUrgent?"bg-red-500/[0.03]":os.row||"bg-transparent"}`}
    >
      <td className="p-0 w-0 relative">
        <motion.div animate={{ opacity: hovered||isUrgent||selected ? 1 : 0 }}
          className={`absolute left-0 top-0 bottom-0 w-[2px] ${selected?"bg-amber-500":isUrgent?"bg-red-500/60":"bg-amber-500/60"}`}
        />
      </td>

      <td className="px-3 py-4 w-10 align-top" onClick={e => e.stopPropagation()}>
        <motion.div animate={{ opacity: hovered||selected ? 1 : 0 }} transition={{ duration:0.15 }}>
          <input type="checkbox" checked={selected} onChange={e => onSelect(job.id, e.target.checked)}
            className="w-3.5 h-3.5 rounded-sm border-zinc-600 bg-zinc-800 accent-amber-500 cursor-pointer"
          />
        </motion.div>
      </td>

      {row.getVisibleCells().map(cell => {
        const id = cell.column.id;
        const isInteractive = ["feedback_status","deadline","notes"].includes(id);
        return (
          <td
            key={cell.id}
            className="px-3 py-4 align-top"
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
              className="text-amber-500/40" onClick={onClick}
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

const FloatingDock = ({ selectedIds, onBulkOutcome, onBulkDelete, onExportCSV, onClear }: {
  selectedIds: number[];
  onBulkOutcome: (outcome:string) => void;
  onBulkDelete: () => void;
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
                  className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 min-w-[220px] overflow-hidden rounded-sm border border-zinc-600 shadow-2xl"
                  style={{ backgroundColor: "#18181b" }}
                >
                  <p className="text-xs font-medium text-zinc-400 px-3 py-2.5 border-b border-zinc-700">
                    Set outcome for {count} job{count>1?"s":""}
                  </p>
                  {OUTCOMES.map(o => {
                    const os = getOS(o);
                    return (
                      <button key={o} onClick={() => { onBulkOutcome(o); setOutcomeOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-zinc-700/60 transition-colors cursor-pointer ${os.text}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${os.dot}`} />{o}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
            <Dock magnification={52} distance={100}>
              <div className="flex items-center justify-center px-3 h-9 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <span className="text-amber-400 text-sm font-semibold">{count} selected</span>
              </div>
              <div className="w-px h-6 bg-zinc-700/60 self-center" />
              <DockIcon label="Set Outcome" onClick={() => setOutcomeOpen(o => !o)} className="bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/40 text-zinc-300 hover:text-zinc-100 transition-colors"><Tag className="w-4 h-4" /></DockIcon>
              <DockIcon label="Export CSV" onClick={onExportCSV} className="bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/40 text-zinc-300 hover:text-zinc-100 transition-colors"><Download className="w-4 h-4" /></DockIcon>
              <DockIcon label="Delete selected" onClick={onBulkDelete} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 transition-colors"><Trash2 className="w-4 h-4" /></DockIcon>
              <DockIcon label="Clear selection" onClick={onClear} className="bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/40 text-zinc-400 hover:text-zinc-200 transition-colors"><X className="w-4 h-4" /></DockIcon>
            </Dock>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

// const Navbar = () => (
//   <nav className="fixed top-0 left-0 right-0 z-40 border-b border-zinc-800/60 bg-zinc-950/92 backdrop-blur-xl h-14 flex items-center">
//     <div className="w-full px-6 lg:px-10 flex items-center justify-between">
//       <div className="flex items-center gap-3">
//         <div className="w-7 h-7 border border-amber-500/40 flex items-center justify-center bg-amber-500/5 rounded-sm">
//           <Zap className="w-3.5 h-3.5 text-amber-400" />
//         </div>
//         <span className="font-display font-black text-zinc-100 tracking-tight text-lg">JOBSCOUT</span>
//         <div className="hidden md:flex items-center gap-1.5 ml-2">
//           <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
//           <span className="text-xs text-zinc-500">Live</span>
//         </div>
//       </div>
//       <div className="flex items-center gap-4">
//         <a href="/dashboard" className="text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors">All Jobs</a>
//         <motion.a href="/applied" whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}
//           className="flex items-center gap-2 border border-amber-500/30 bg-amber-500/5 text-amber-400 text-sm font-medium px-4 py-2 rounded-md"
//         >
//           <CheckCircle className="w-3.5 h-3.5" /><span>Applied</span>
//         </motion.a>
//       </div>
//     </div>
//   </nav>
// );

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────

const AppliedDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<SupabaseJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([{ id:"score", desc:true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 180);
    window.addEventListener("scroll", h); return () => window.removeEventListener("scroll", h);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("jobs").select("*").eq("application_status","Applied");
      if (data) setJobs(data as SupabaseJob[]);
      setLoading(false);
    })();
  }, []);

  const flash = () => { setSaving(true); setTimeout(() => setSaving(false), 1800); };

  // ALL HANDLERS: optimistic update first, then DB
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

  const handleBulkDelete = async () => {
    setJobs(prev => prev.filter(j => !selectedIds.includes(j.id)));
    setSelectedIds([]);
    flash();
    await Promise.all(selectedIds.map(id => supabase.from("jobs").delete().eq("id", id)));
  };

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

  const columns: ColumnDef<SupabaseJob>[] = [
    {
      accessorKey: "score", header: "Score", id: "score", size: 100,
      filterFn: (row, id, fv) => { const s = row.getValue(id) as number|null; return s !== null && s >= Number(fv); },
      cell: ({ getValue }) => <ScoreDisplay score={getValue() as number|null} />,
    },
    {
      accessorKey: "title", header: "Position", id: "title",
      cell: ({ getValue, row }) => (
        <div className="min-w-0 py-1">
          <div className="text-zinc-100 text-[15px] font-semibold leading-snug break-words whitespace-normal" >{getValue() as string}</div>
          <div className="text-zinc-400 text-[13px] mt-1 break-words whitespace-normal" >{row.original.company}{row.original.location ? ` · ${row.original.location}` : ""}</div>
        </div>
      ),
    },
    {
      id: "feedback_status", header: "Outcome", accessorKey: "feedback_status", size: 195,
      filterFn: (row, id, fv) => ((row.getValue(id) as string|null)??"No update") === fv,
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

  const filtered = table.getFilteredRowModel().rows.length;
  const interviews = jobs.filter(j => j.feedback_status?.includes("Interview")).length;
  const offers = jobs.filter(j => j.feedback_status === "Offer").length;
  const urgentCount = jobs.filter(j => { const d = getDaysUntil(j.deadline??null); return d!==null&&d>=0&&d<=3; }).length;
  const hasActiveFilters = globalFilter || outcomeFilter !== "all" || minScore !== "";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-500/30 selection:text-amber-200">
      <GrainOverlay />
      <ConfettiBurst active={confetti} onDone={() => setConfetti(false)} />
      <SaveIndicator saving={saving} />
      <StickyStats jobs={jobs} visible={scrolled} />

      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <BGPattern variant="dots" fill="rgba(245,158,11,0.04)" size={28} mask="fade-edges" />
        <div className="absolute top-0 right-1/3 w-[600px] h-[400px] bg-amber-500/[0.02] rounded-full blur-[160px]" />
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[300px] bg-green-500/[0.015] rounded-full blur-[120px]" />
      </div>

      <Navbar />

      <div className="relative z-10 w-full px-6 lg:px-10 xl:px-14 pt-20 pb-32">

        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.7, ease:[0.16,1,0.3,1] }} className="mb-8 pt-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-[1px] w-8 bg-amber-500/40" />
            <span className="text-xs font-medium uppercase tracking-widest text-amber-500/70">Application Tracker</span>
          </div>
          <h1 className="font-display text-5xl lg:text-6xl font-black tracking-tight text-zinc-100 leading-[0.9] flex items-end gap-4 flex-wrap">
            <span>APPLIED</span>
            <SpecialText className="text-amber-400 text-5xl lg:text-6xl font-black" speed={18}>JOBS</SpecialText>
          </h1>
          <p className="text-zinc-400 text-sm mt-3" >Track outcomes, deadlines, and notes for every application.</p>
        </motion.div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          <StatCard label="Applied"    value={jobs.length} icon={<Briefcase className="w-4 h-4"/>}  accent="zinc"                        delay={0}    />
          <StatCard label="Interviews" value={interviews}  icon={<Target className="w-4 h-4"/>}     accent="blue"                        delay={0.08} />
          <StatCard label="Offers"     value={offers}      icon={<Award className="w-4 h-4"/>}      accent="green"                       delay={0.16} />
          <StatCard label="Urgent"     value={urgentCount} icon={<AlertCircle className="w-4 h-4"/>} accent={urgentCount>0?"red":"zinc"} delay={0.24} />
        </div>

        {jobs.length > 0 && (
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6, delay:0.35 }}>
            <PipelineBar jobs={jobs} />
          </motion.div>
        )}

        {/* Search + filters */}
        <motion.div initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6, delay:0.4, ease:[0.16,1,0.3,1] }} className="mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex items-center group flex-1 max-w-[480px]">
              <div className="absolute z-[-1] overflow-hidden inset-0 rounded-md blur-[3px] before:absolute before:content-[''] before:z-[-2] before:w-[999px] before:h-[999px] before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:rotate-60 before:bg-[conic-gradient(#09090b,#f59e0b_5%,#09090b_38%,#09090b_50%,#d97706_60%,#09090b_87%)] before:transition-all before:duration-[2000ms] group-hover:before:rotate-[-120deg] group-focus-within:before:rotate-[420deg] group-focus-within:before:duration-[4000ms]" />
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                <Search className="w-4 h-4 text-amber-500/60" />
              </div>
              <input type="text" value={globalFilter} onChange={e => setGlobalFilter(e.target.value)} placeholder="Search applied jobs..."
                className="w-full h-11 bg-zinc-950 rounded-md text-zinc-200 pl-10 pr-4 text-sm focus:outline-none placeholder-zinc-600 border-0"
                style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
              />
            </div>

            <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={() => setFiltersOpen(o => !o)}
              className={`flex items-center gap-2 border px-4 h-11 text-sm font-medium transition-all duration-200 rounded-md ${filtersOpen?"border-amber-500/40 bg-amber-500/10 text-amber-400":"border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"}`}
              style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" /><span>Filters</span>
              {hasActiveFilters && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
            </motion.button>

            <AnimatePresence>
              {hasActiveFilters && (
                <motion.button initial={{ opacity:0, scale:0.85 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0, scale:0.85 }}
                  onClick={() => { setGlobalFilter(""); setOutcomeFilter("all"); setMinScore(""); }}
                  className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-red-400 transition-colors"
                ><X className="w-3 h-3"/><span>Clear</span></motion.button>
              )}
            </AnimatePresence>

            <div className="ml-auto text-sm text-zinc-500">
              <span className="text-amber-500/80">{filtered}</span> / {jobs.length} jobs
            </div>
          </div>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:"auto" }} exit={{ opacity:0, height:0 }} transition={{ duration:0.28, ease:[0.16,1,0.3,1] }} className="overflow-hidden">
                <div className="flex flex-wrap items-end gap-3 pt-3 pb-1 border-t border-zinc-800/40 mt-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-400 mb-0.5">Outcome</label>
                    <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value)}
                      className="appearance-none bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm px-3 py-2 pr-7 focus:outline-none focus:border-amber-500/40 transition-colors cursor-pointer hover:border-zinc-600 rounded-md min-w-[180px]"
                    >
                      <option value="all" className="bg-zinc-900">All Outcomes</option>
                      {OUTCOMES.map(o => <option key={o} value={o} className="bg-zinc-900">{o}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-zinc-400 mb-0.5">Min Score</label>
                    <input type="number" value={minScore} onChange={e => setMinScore(e.target.value)} placeholder="0–100" min="0" max="100"
                      className="w-20 bg-zinc-900 border border-zinc-700 text-zinc-200 text-sm text-center py-2 px-2 focus:outline-none focus:border-amber-500/40 transition-colors rounded-md"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Table */}
        <motion.div initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.6, delay:0.45, ease:[0.16,1,0.3,1] }} className="relative p-[1px] rounded-sm">
          <GlowingEffect spread={80} disabled={false} proximity={160} inactiveZone={0.01} borderWidth={1} />
          <div className="relative border border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm overflow-hidden rounded-sm">
            <table className="w-full border-collapse" style={{ tableLayout: "auto" }}>
              <colgroup>
                <col style={{ width:0 }} />
                <col style={{ width:36 }} />
                {/* score — fixed narrow */}
                <col style={{ width:"7%" }} />
                {/* position — takes remaining space, wraps */}
                <col style={{ width:"auto" }} />
                {/* outcome — generous fixed */}
                <col style={{ width:"18%" }} />
                {/* deadline — generous fixed */}
                <col style={{ width:"14%" }} />
                {/* notes — generous fixed */}
                <col style={{ width:"14%" }} />
                <col style={{ width:28 }} />
              </colgroup>
              <thead>
                {table.getHeaderGroups().map(hg => (
                  <tr key={hg.id} className="border-b border-zinc-800/60 bg-zinc-900/40">
                    <th className="w-0 p-0" />
                    <th className="px-3 py-3.5 w-10">
                      <input type="checkbox"
                        checked={selectedIds.length === table.getFilteredRowModel().rows.length && table.getFilteredRowModel().rows.length > 0}
                        onChange={e => {
                          if (e.target.checked) setSelectedIds(table.getFilteredRowModel().rows.map(r => r.original.id));
                          else setSelectedIds([]);
                        }}
                        className="w-3.5 h-3.5 rounded-sm border-zinc-600 bg-zinc-800 accent-amber-500 cursor-pointer"
                      />
                    </th>
                    {hg.headers.map(header => (
                      <th key={header.id} onClick={header.column.getToggleSortingHandler()}
                        className={`px-3 py-4 text-left text-xs font-medium text-zinc-500 ${header.column.getCanSort()?"cursor-pointer select-none hover:text-zinc-300 transition-colors":""}`}
                        >
                        <div className="flex items-center gap-1.5">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted()==="desc" && <ChevronDown className="w-3 h-3 text-amber-500"/>}
                          {header.column.getIsSorted()==="asc"  && <ChevronUp   className="w-3 h-3 text-amber-500"/>}
                        </div>
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                ))}
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="py-24">
                    <div className="flex flex-col items-center gap-4">
                      <motion.div animate={{ rotate:360 }} transition={{ duration:1.4, repeat:Infinity, ease:"linear" }} className="w-8 h-8 border border-amber-500/30 border-t-amber-500 rounded-full" />
                      <span className="text-sm text-zinc-500">Loading applications...</span>
                    </div>
                  </td></tr>
                )}
                {!loading && table.getRowModel().rows.length === 0 && (
                  <tr><td colSpan={8} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="w-8 h-8 text-zinc-800" />
                      <span className="text-sm text-zinc-500">No applications found</span>
                    </div>
                  </td></tr>
                )}
                {!loading && table.getRowModel().rows.map((row, i) => (
                  <JobRow key={row.id} row={row} index={i}
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
              <div className="border-t border-zinc-800/40 px-4 py-3 flex items-center justify-between bg-zinc-900/20">
                <span className="text-sm text-zinc-500">
                  Showing <span className="text-amber-500/70">{filtered}</span> of {jobs.length} applied jobs
                  {selectedIds.length > 0 && <span className="text-amber-400 ml-2">· {selectedIds.length} selected</span>}
                </span>
                <div className="flex items-center gap-2 text-zinc-700">
                  <Clock className="w-3 h-3" />
                  <span className="text-xs text-zinc-500">Auto-saves on change</span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <FloatingDock
        selectedIds={selectedIds}
        onBulkOutcome={handleBulkOutcome}
        onBulkDelete={handleBulkDelete}
        onExportCSV={handleExportCSV}
        onClear={() => setSelectedIds([])}
      />
    </div>
  );
};

export default AppliedDashboard;