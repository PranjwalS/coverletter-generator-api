/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useInView } from "framer-motion";
import {
  Zap, Target, ChevronRight,
  Mail, Github, Linkedin, ArrowUpRight, Search,
  FileText, Bell, BarChart2, CheckCircle
} from "lucide-react";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import { FallingPattern } from "@/components/ui/falling-pattern";
import { supabase } from "./lib/supabase";
import type { SupabaseJob } from "./types/supabase_job";
import Navbar from "./components/Navbar";

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface FeatureCardProps { icon: React.ReactNode; title: string; description: string; index: number; }
interface StepProps { number: string; title: string; description: string; index: number; }

// ─── STATIC DATA (features + steps don't need DB) ─────────────────────────────

const FEATURES: FeatureCardProps[] = [
  { icon: <Search className="w-5 h-5" />,    title: "Intelligent Scraping",    description: "Pulls from LinkedIn and major boards every 4 hours. No manual searching. Just results that match your exact criteria.", index: 0 },
  { icon: <Target className="w-5 h-5" />,    title: "AI Scoring Engine",       description: "Every job gets a relevance score based on your CV, skills, and preferred role type. See your best matches instantly.", index: 1 },
  { icon: <FileText className="w-5 h-5" />,  title: "Cover Letter Gen",        description: "LLM-powered cover letters tailored per job description. Generated in seconds, downloaded as PDF.", index: 2 },
  { icon: <Zap className="w-5 h-5" />,       title: "Chrome Autofill",         description: "Extension that fills application forms with your profile data. One click replaces ten minutes of typing.", index: 3 },
  { icon: <Bell className="w-5 h-5" />,      title: "Email Alerts",            description: "Get notified immediately when high-scoring jobs drop. Never miss a deadline again.", index: 4 },
  { icon: <BarChart2 className="w-5 h-5" />, title: "Application Tracking",    description: "Full dashboard to track every application — status, outcome, notes, deadlines. Your search history, organised.", index: 5 },
];

const STEPS: StepProps[] = [
  { number: "01", title: "Connect your profile",  description: "Drop your CV and preferences. The system learns your stack, experience, and what you're looking for.", index: 0 },
  { number: "02", title: "Jobs come to you",       description: "Crawler runs every few hours scraping relevant co-op and internship postings across the web.", index: 1 },
  { number: "03", title: "Apply in seconds",       description: "Score-ranked jobs, pre-written cover letters, autofill extension. From open to applied in under a minute.", index: 2 },
];

// ─── DERIVED STATS from real DB data ──────────────────────────────────────────

function deriveStats(allJobs: SupabaseJob[], appliedJobs: SupabaseJob[]) {
  const scoredJobs    = allJobs.filter(j => j.score != null && j.score >= 1);
  const avgScore      = scoredJobs.length > 0
    ? Math.round(scoredJobs.reduce((s, j) => s + (j.score ?? 0), 0) / scoredJobs.length)
    : 0;
  const interviews    = appliedJobs.filter(j => j.feedback_status?.includes("Interview")).length;
  const offers        = appliedJobs.filter(j => j.feedback_status === "Offer").length;

  return [
    { value: `${allJobs.length.toLocaleString()}`,  label: "Jobs in Database",     delay: 0    },
    { value: `${appliedJobs.length}`,               label: "Applications Sent",    delay: 0.1  },
    { value: `${avgScore > 0 ? avgScore : "—"}`,    label: "Avg Match Score",      delay: 0.2  },
    { value: interviews > 0 ? `${interviews}` : offers > 0 ? `${offers} offer${offers > 1 ? "s" : ""}` : "—",
                                                    label: interviews > 0 ? "Interviews Landed" : "Offers Received", delay: 0.3 },
  ];
}

// ─── GRAIN OVERLAY ────────────────────────────────────────────────────────────

const GrainOverlay = () => (
  <div
    className="pointer-events-none fixed inset-0 z-50 opacity-[0.018]"
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      backgroundRepeat: "repeat",
      backgroundSize: "128px 128px",
    }}
  />
);

// ─── STAT CARD ────────────────────────────────────────────────────────────────

const StatCard = ({ value, label, delay = 0 }: { value: string; label: string; delay?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative"
    >
      <div className="relative border border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm p-8 overflow-hidden transition-all duration-300 hover:border-zinc-700/60">
        <GlowingEffect spread={40} glow={false} disabled={false} proximity={80} inactiveZone={0.1} borderWidth={2} />
        <div className="absolute top-0 left-0 w-6 h-6 border-t border-l border-amber-500/30 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-6 h-6 border-b border-r border-amber-500/30 pointer-events-none" />
        <div className="relative z-10">
          <div className=" text-5xl font-black text-amber-400 tracking-tight mb-2">
            {inView ? value : "—"}
          </div>
          <div className="text-zinc-500 text-xs font-mono uppercase tracking-[0.15em]">{label}</div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── FEATURE CARD ─────────────────────────────────────────────────────────────

const FeatureCard = ({ icon, title, description, index }: FeatureCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      className="relative min-h-[13rem] border border-zinc-800/60 bg-zinc-950/50 p-2 overflow-hidden group"
    >
      <GlowingEffect spread={40} glow={false} disabled={false} proximity={64} inactiveZone={0.01} borderWidth={2} />
      <div className="relative z-10 h-full border border-zinc-800/40 bg-zinc-950/60 p-6 flex flex-col gap-4">
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/0 to-transparent group-hover:via-amber-500/50 transition-all duration-700 pointer-events-none" />
        <div className="inline-flex items-center justify-center w-9 h-9 border border-amber-500/20 text-amber-400 bg-amber-500/5 shrink-0">
          {icon}
        </div>
        <div>
          <h3 className=" text-xl font-black text-zinc-100 tracking-tight mb-2">{title}</h3>
          <p className="text-zinc-500 text-xs leading-relaxed font-mono">{description}</p>
        </div>
        <div className="mt-auto flex items-center gap-2 text-amber-500/0 group-hover:text-amber-500/60 transition-all duration-300">
          <span className="text-[10px] font-mono uppercase tracking-widest">Learn more</span>
          <ArrowUpRight className="w-3 h-3" />
        </div>
      </div>
    </motion.div>
  );
};

// ─── STEP CARD ────────────────────────────────────────────────────────────────

const Step = ({ number, title, description, index }: StepProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay: index * 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="relative min-h-[14rem] border border-zinc-800/60 bg-zinc-950/40 p-2 group"
    >
      <GlowingEffect spread={35} glow={false} disabled={false} proximity={64} inactiveZone={0.05} borderWidth={2} />
      <div className="relative z-10 h-full border border-zinc-800/40 p-7">
        <div className="absolute top-0 left-0 w-10 h-10 border-t border-l border-amber-500/20 group-hover:border-amber-500/40 transition-all duration-500 pointer-events-none" />
        <div className=" text-6xl font-black text-zinc-800/50 group-hover:text-amber-500/15 transition-all duration-500 leading-none mb-5">{number}</div>
        <h3 className=" font-black text-zinc-100 text-2xl mb-3 tracking-tight">{title}</h3>
        <p className="text-zinc-500 text-sm leading-relaxed font-mono">{description}</p>
      </div>
    </motion.div>
  );
};

// ─── TICKER — built from real top-scored jobs ─────────────────────────────────

const Ticker = ({ jobs }: { jobs: SupabaseJob[] }) => {
  // Take top 10 by score, fall back to static placeholders if DB empty
  const items = jobs.length > 0
    ? [...jobs]
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, 12)
        .map(j => `${j.company} · ${j.title} · ${j.score ?? "—"}`)
    : [
        "Stripe · SWE Intern · 94", "Shopify · Backend Co-op · 88",
        "Cohere · ML Intern · 82",  "Vercel · Full Stack · 79",
        "Anthropic · Research Eng · 97",
      ];

  const doubled = [...items, ...items];

  return (
    <div className="relative overflow-hidden border-y border-zinc-800/40 py-3 bg-zinc-950/80 backdrop-blur-sm">
      <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        className="flex gap-14 whitespace-nowrap"
      >
        {doubled.map((item, i) => {
          const parts = item.split(" · ");
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-1 h-1 rounded-full bg-amber-500/40" />
              <span className="font-mono text-xs">
                <span className="text-zinc-300">{parts[0]}</span>
                <span className="text-zinc-600"> · </span>
                <span className="text-zinc-500">{parts[1]}</span>
                <span className="text-zinc-600"> · </span>
                <span className="text-amber-500/80">{parts[2]}</span>
              </span>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
};

// ─── HERO ─────────────────────────────────────────────────────────────────────

const Hero = ({ topJob }: { topJob: SupabaseJob | null }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: containerRef });
  const y       = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const opacity = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  return (
    <section ref={containerRef} className="relative min-h-screen flex flex-col justify-center overflow-hidden pt-16">
    <div className="absolute inset-0 z-0">
      <FallingPattern
        backgroundColor="#050505"
        color="rgba(255, 163, 3, 0.81)"
        blurIntensity="0.4em"
        duration={160}
        density={1.4}
        className="h-full w-full [mask-image:radial-gradient(ellipse_80%_60%_at_50%_40%,transparent_10%,#09090b_90%)]"
      />
    </div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,158,11,0.08)_0%,_transparent_65%)]" />
      </div>

      <motion.div style={{ y, opacity }} className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-16 items-center py-24">

          {/* LEFT */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="inline-flex items-center gap-3 border border-amber-500/20 bg-amber-500/5 px-4 py-2 mb-8"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500/80">Co-op & Internship Automation</span>
            </motion.div>

            {["FIND.", "SCORE.", "APPLY."].map((word, i) => (
              <div key={word} className="overflow-hidden">
                <motion.h1
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "font-display text-[5rem] lg:text-[6rem] xl:text-[7.5rem] font-black leading-[0.88] tracking-[-0.02em]",
                    i === 0 && "text-zinc-100",
                    i === 1 && "text-amber-400",
                    i === 2 && "text-zinc-700"
                  )}
                >
                  {word}
                </motion.h1>
              </div>
            ))}

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.72, ease: [0.16, 1, 0.3, 1] }}
              className="text-zinc-400 text-sm leading-relaxed font-mono max-w-sm mt-8 mb-10"
            >
              Automated job aggregation, AI-powered scoring, and one-click
              applications. Built for CS co-op and internship hunters.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-4"
            >
              <motion.a
                href="/dashboard"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="group relative flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold text-[11px] uppercase tracking-widest px-7 py-4 transition-all duration-200 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 skew-x-12 pointer-events-none" />
                <span className="relative">Open Dashboard</span>
                <ArrowUpRight className="w-4 h-4 relative group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </motion.a>
              <a
                href="#how-it-works"
                className="flex items-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 font-mono text-[11px] uppercase tracking-widest px-7 py-4 transition-all duration-200"
              >
                <span>See How It Works</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </a>
            </motion.div>
          </div>

          {/* RIGHT — terminal + floating cards using real top job */}
{/* RIGHT — replace the entire relative h-[440px] div with this */}
<div className="relative hidden lg:flex lg:flex-col gap-4 justify-center h-[440px]">

  {/* Top row — match card + terminal side by side */}
  <div className="flex gap-4 items-start">

    {/* Terminal */}
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 border border-zinc-700/60 bg-zinc-950/98 backdrop-blur-xl shadow-2xl shadow-black/60"
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800/60">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        <span className="ml-2 text-[10px] font-mono text-zinc-500">jobscout — crawler</span>
      </div>
      <div className="p-5 space-y-2">
        {[
          { t: "$ crawler start --board linkedin",   c: "text-zinc-400" },
          { t: "> Scraping Fall 2026 co-op postings...", c: "text-zinc-500" },
          { t: "> Scoring against profile...",        c: "text-zinc-500" },
          { t: "> Email alert sent ✓",               c: "text-green-400/80" },
        ].map((line, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 1.4 + i * 0.12 }}
            className={`font-mono text-xs ${line.c}`}
          >
            {line.t}
          </motion.div>
        ))}
        <motion.span
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 1, delay: 2.2, repeat: Infinity }}
          className="font-mono text-xs text-amber-400"
        >█</motion.span>
      </div>
    </motion.div>

    {/* Top match card */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1, delay: 1.3, ease: [0.16, 1, 0.3, 1] }}
      className="w-56 border border-zinc-700/60 bg-zinc-950/98 backdrop-blur-xl p-5 shadow-2xl shadow-black/60 shrink-0"
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500/70">Top Match</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[10px] font-mono text-zinc-500">Live</span>
        </div>
      </div>
      {topJob ? (
        <>
          <div className=" font-black text-zinc-100 text-sm mb-1 truncate">{topJob.title}</div>
          <div className="text-zinc-500 text-xs font-mono mb-4 truncate">{topJob.company}{topJob.location ? ` · ${topJob.location}` : ""}</div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-[2px] bg-zinc-800 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${topJob.score ?? 0}%` }}
                transition={{ duration: 1.5, delay: 1.8, ease: [0.16, 1, 0.3, 1] }}
                className="h-full bg-amber-400"
              />
            </div>
            <span className="font-mono text-xs font-bold text-amber-400">{topJob.score}</span>
          </div>
        </>
      ) : (
        <div className="text-zinc-600 text-xs font-mono">Loading top match...</div>
      )}
    </motion.div>
  </div>

  {/* Cover letter card — full width below */}
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 1, delay: 1.7, ease: [0.16, 1, 0.3, 1] }}
    className="border border-zinc-700/60 bg-zinc-950/98 backdrop-blur-xl p-5 shadow-2xl shadow-black/60"
  >
    <div className="flex items-center gap-2 mb-3">
      <FileText className="w-3 h-3 text-amber-500/70" />
      <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500/70">Cover Letter</span>
    </div>
    <div className="space-y-1.5">
      {[100, 85, 70, 90, 55].map((w, i) => (
        <div key={i} className="h-[3px] bg-zinc-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${w}%` }}
            transition={{ duration: 0.8, delay: 2.0 + i * 0.1, ease: "easeOut" }}
            className="h-full bg-zinc-600 rounded-full"
          />
        </div>
      ))}
    </div>
    <div className="mt-4 flex items-center gap-2 text-green-400/70">
      <CheckCircle className="w-3 h-3" />
      <span className="text-[10px] font-mono">Generated in 4.2s</span>
    </div>
  </motion.div>

</div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.2, duration: 0.8 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-10"
      >
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-700">Scroll</span>
        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-[1px] h-8 bg-gradient-to-b from-amber-500/40 to-transparent"
        />
      </motion.div>
    </section>
  );
};

// ─── DASHBOARD PREVIEW — real top-5 jobs ──────────────────────────────────────

const DashboardPreview = ({
  appliedJobs,
  allJobsCount,
  avgScore,
  interviewCount,
}: {
  appliedJobs: SupabaseJob[];
  allJobsCount: number;
  avgScore: number;
  interviewCount: number;
}) => {
  const topFive = [...appliedJobs]
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 4);

  return (
    <section className="relative overflow-hidden bg-zinc-950">
      <ContainerScroll
        titleComponent={
          <div className="mb-4">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-3 border border-amber-500/20 bg-amber-500/5 px-4 py-2 mb-6"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500/80">Live Dashboard</span>
            </motion.div>
            <h2 className=" text-5xl md:text-7xl font-black tracking-tight text-zinc-100 leading-[0.9]">
              YOUR FEED.
              <br />
              <span className="text-amber-400">RANKED.</span>
            </h2>
          </div>
        }
      >
        <div className="h-full w-full bg-zinc-900 p-4 md:p-6 flex flex-col gap-4 overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className=" font-black text-zinc-200 text-sm tracking-tight">JOBSCOUT</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-[10px] font-mono text-zinc-500 border border-zinc-800 px-2 py-1">
                {allJobsCount > 0 ? `${allJobsCount.toLocaleString()} jobs in db` : "Loading..."}
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>

          {/* Stats row — real numbers */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Jobs",  value: allJobsCount > 0 ? allJobsCount.toLocaleString() : "—" },
              { label: "Applied",     value: appliedJobs.length > 0 ? String(appliedJobs.length) : "—" },
              { label: "Interviews",  value: interviewCount > 0 ? String(interviewCount) : "—" },
              { label: "Avg Score",   value: avgScore > 0 ? String(avgScore) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="border border-zinc-800 p-3 bg-zinc-950/60">
                <div className="font-display font-black text-amber-400 text-xl">{value}</div>
                <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Job list — real applied jobs sorted by score */}
          <div className="flex-1 space-y-2 overflow-hidden">
            {topFive.length > 0 ? topFive.map((job) => (
              <div key={job.id} className="flex items-center justify-between border border-zinc-800/60 bg-zinc-950/40 p-3 gap-4">
                <div className="flex-1 min-w-0">
                  <div className=" font-black text-zinc-200 text-xs truncate">{job.title}</div>
                  <div className="text-[10px] font-mono text-zinc-600 truncate">
                    {job.company}{job.location ? ` · ${job.location}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-20 h-[2px] bg-zinc-800 overflow-hidden">
                    <div className="h-full bg-amber-500" style={{ width: `${job.score ?? 0}%` }} />
                  </div>
                  <span className="font-mono text-xs font-bold text-amber-400 w-6">{job.score ?? "—"}</span>
                  {job.feedback_status && job.feedback_status !== "No update" && (
                    <div className="border border-amber-500/20 text-amber-500/70 text-[9px] font-mono px-2 py-0.5 truncate max-w-[80px]">
                      {job.feedback_status}
                    </div>
                  )}
                </div>
              </div>
            )) : (
              <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-xs">
                No applications yet — open the dashboard to get started
              </div>
            )}
          </div>
        </div>
      </ContainerScroll>
    </section>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [allJobs,     setAllJobs]     = useState<SupabaseJob[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<SupabaseJob[]>([]);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: all }, { data: applied }] = await Promise.all([
        supabase.from("jobs").select("id, title, company, location, score, feedback_status").order("score", { ascending: false }),
        supabase.from("jobs").select("id, title, company, location, score, feedback_status, deadline, notes").eq("application_status", "Applied").order("score", { ascending: false }),
      ]);
      if (all)     setAllJobs(all as SupabaseJob[]);
      if (applied) setAppliedJobs(applied as SupabaseJob[]);
      setLoading(false);
    })();
  }, []);

  // Derived values
  const topJob        = allJobs[0] ?? null;
  const avgScore = (() => {
    const scored = allJobs.filter(j => j.score != null && j.score >= 1);
    return scored.length > 0
      ? Math.round(scored.reduce((s, j) => s + (j.score ?? 0), 0) / scored.length)
      : 0;
  })();
  const interviewCount = appliedJobs.filter(j => j.feedback_status?.includes("Interview")).length;
  const stats          = deriveStats(allJobs, appliedJobs);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-amber-500/30 selection:text-amber-200">
      <GrainOverlay />

      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[700px] h-[500px] bg-amber-500/[0.025] rounded-full blur-[150px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[500px] h-[400px] bg-amber-600/[0.03] rounded-full blur-[120px]" />
      </div>

      <Navbar />

      {/* ── HERO — passes real top job for the match card ── */}
      <Hero topJob={topJob} />

      {/* ── TICKER — real top jobs from DB ── */}
      <Ticker jobs={allJobs} />

      {/* ── STATS — derived from real DB counts ── */}
      <section className="relative py-28 border-b border-zinc-800/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => <StatCard key={stat.label} {...stat} />)}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="relative py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-4 mb-5"
            >
              <div className="h-[1px] w-10 bg-amber-500/40" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500/70">The System</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className=" text-5xl lg:text-6xl font-black tracking-tight text-zinc-100 leading-[0.9] max-w-lg"
            >
              EVERYTHING
              <br />
              <span className="text-zinc-600">YOU NEED.</span>
            </motion.h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => <FeatureCard key={f.title} {...f} />)}
          </div>
        </div>
      </section>

      {/* ── DASHBOARD PREVIEW — real applied jobs ── */}
      <DashboardPreview
        appliedJobs={appliedJobs}
        allJobsCount={allJobs.length}
        avgScore={avgScore}
        interviewCount={interviewCount}
      />

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className="relative py-32 border-t border-zinc-800/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="mb-20">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-4 mb-5"
            >
              <div className="h-[1px] w-10 bg-amber-500/40" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500/70">Process</span>
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className=" text-5xl lg:text-6xl font-black tracking-tight text-zinc-100 leading-[0.9]"
            >
              THREE
              <br />
              <span className="text-zinc-600">STEPS.</span>
            </motion.h2>
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            {STEPS.map((step) => <Step key={step.number} {...step} />)}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative py-36 border-t border-zinc-800/30 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <FallingPattern
            color="rgba(245,158,11,0.25)"
            backgroundColor="#09090b"
            duration={180}
            blurIntensity="1.2em"
            density={1.5}
            className="h-full w-full [mask-image:radial-gradient(ellipse_60%_80%_at_50%_50%,transparent_20%,#09090b_75%)]"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-[800px] h-[400px] bg-amber-500/[0.05] rounded-full blur-[140px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-3 border border-amber-500/20 bg-amber-500/5 px-4 py-2 mb-10">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-amber-500/80">Ready to start</span>
            </div>

            <h2 className="font-display text-7xl lg:text-[7rem] xl:text-[9rem] font-black tracking-[-0.02em] text-zinc-100 leading-[0.88] mb-8">
              STOP
              <br />
              <span className="text-amber-400">SEARCHING.</span>
              <br />
              <span className="text-zinc-700">START</span>
              <br />
              <span className="text-zinc-600">APPLYING.</span>
            </h2>

            <p className="text-zinc-500 font-mono text-sm leading-relaxed max-w-sm mx-auto mb-12">
              Your next co-op is already out there. Let the system find it,
              score it, and help you apply — automatically.
            </p>

            <motion.a
              href="/dashboard"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex items-center gap-3 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono font-bold text-[11px] uppercase tracking-widest px-10 py-5 transition-all duration-200 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 skew-x-12 pointer-events-none" />
              <span className="relative">Open the Dashboard</span>
              <ArrowUpRight className="w-4 h-4 relative group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </motion.a>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-zinc-800/40 py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-3 h-3 text-amber-400/70" />
            </div>
            <span className=" font-black text-zinc-700 text-sm tracking-tight">JOBSCOUT</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-700 uppercase tracking-widest">
            Built for CS students hunting co-ops
          </span>
          <div className="flex items-center gap-5">
            {[
              { icon: <Github className="w-4 h-4" />,   href: "https://github.com/PranjwalS" },
              { icon: <Linkedin className="w-4 h-4" />, href: "https://linkedin.com/in/pranjwal-singh-01979b242" },
              { icon: <Mail className="w-4 h-4" />,     href: "mailto:singhpranjwal@gmail.com" },
            ].map(({ icon, href }, i) => (
              <a key={i} href={href} className="text-zinc-600 hover:text-amber-400/80 transition-colors duration-200">{icon}</a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}