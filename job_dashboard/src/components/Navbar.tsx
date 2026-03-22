"use client";

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";

// ─── DECRYPT EFFECT ───────────────────────────────────────────────────────────
// Exact replica of StableDecryptEffect from prompt 2:
// continuously scrambles characters, resolves left-to-right at speed 0.5
// runs on mount/re-trigger, cleans up properly

function DecryptText({ text, trigger }: { text: string; trigger: boolean }) {
  const [displayed, setDisplayed] = useState(text);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const iterRef = useRef(0);

  useEffect(() => {
    if (!trigger) {
      if (animRef.current) clearInterval(animRef.current);
      const t = setTimeout(() => setDisplayed(text), 0);
      return () => clearTimeout(t);
    }

    iterRef.current = 0;
    if (animRef.current) clearInterval(animRef.current);

    const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const SPEED = 0.5;
    const FPS   = 24;

    animRef.current = setInterval(() => {
      setDisplayed(
        text
          .split("")
          .map((char, i) => {
            if (char === " ") return " ";
            if (i < iterRef.current) return text[i];
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join("")
      );
      iterRef.current += SPEED;
      if (iterRef.current >= text.length) {
        clearInterval(animRef.current!);
        setDisplayed(text);
      }
    }, 1000 / FPS);

    return () => { if (animRef.current) clearInterval(animRef.current); };
  }, [trigger, text]);

  return (
    <span
      style={{
        display: "inline-block",
        minWidth: `${text.length}ch`,
        fontFamily: "inherit",
        letterSpacing: "inherit",
      }}
    >
      {displayed}
    </span>
  );
}

// ─── FOUR-DOT LOGO (from mini-navbar prompt 1) ────────────────────────────────

function FourDots() {
  return (
    <div className="relative" style={{ width: 18, height: 18 }}>
      {[
        { top: 0,    left: "50%",  transform: "translateX(-50%)" },
        { top: "50%",left: 0,      transform: "translateY(-50%)" },
        { top: "50%",right: 0,     transform: "translateY(-50%)" },
        { bottom: 0, left: "50%",  transform: "translateX(-50%)" },
      ].map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            width: 5, height: 5,
            background: "rgba(161,161,170,0.65)",
            ...s,
          }}
        />
      ))}
    </div>
  );
}

// ─── NAV BUTTON ───────────────────────────────────────────────────────────────
// Combines both prompts:
//   · Dot grid radial-gradient overlay fades in/out (opacity 0.4s ease-in-out) — prompt 2
//   · White scaleX sweep with motion.div (originX:0 in, originX:1 out) — prompt 2
//   · Text color: dimmed → white (hover) → black (active sweep) — prompt 2
//   · DecryptText scrambles while hovered and not active — prompt 2

function NavButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const showDotGrid = hovered && !active;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative h-full flex items-center justify-center overflow-hidden"
      style={{ minWidth: 112, padding: "0 26px" }}
    >
      {/* Dot grid — fades in on hover, hidden when active */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #4a4a4a 1px, transparent 1px)",
          backgroundSize: "8px 8px",
          opacity: showDotGrid ? 1 : 0,
          transition: "opacity 0.4s ease-in-out",
          zIndex: 0,
        }}
      />

      {/* White active sweep — scaleX from left, exits from right */}
      <AnimatePresence>
        {active && (
          <motion.div
            className="absolute inset-0 bg-white"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0, originX: 1 }}
            transition={{ duration: 0.4, ease: "easeInOut" }}
            style={{ zIndex: 1 }}
          />
        )}
      </AnimatePresence>

      {/* Right-edge divider */}
      <div
        aria-hidden
        className="absolute right-0 pointer-events-none"
        style={{
          top: "22%", bottom: "22%",
          width: 1,
          background: "rgba(63,63,70,0.55)",
          zIndex: 3,
        }}
      />

      {/* Label — sits above both layers */}
      <span
        className="relative uppercase text-[11px] font-medium select-none"
        style={{
          letterSpacing: "0.14em",
          zIndex: 2,
          color: active
            ? "#000000"
            : hovered
            ? "#ffffff"
            : "rgba(255,255,255,0.48)",
          transition: "color 0.25s ease",
        }}
      >
        <DecryptText text={label} trigger={showDotGrid} />
      </span>
    </button>
  );
}

// ─── MAIN NAVBAR ──────────────────────────────────────────────────────────────

const LINKS = [
  { label: "Home",      path: "/" },
  { label: "Dashboard", path: "/dashboard" },
  { label: "Applied",   path: "/applied" },
];

const PILL_STYLE = {
  backgroundColor: "rgba(12,12,12,0.90)",
  border: "1px solid rgba(63,63,70,0.80)",
  borderRadius: 9999,
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
} as React.CSSProperties;

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [scrolled, setScrolled]       = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  // close mobile menu on route change — deferred to avoid sync setState in effect
  const prevPathRef = useRef(pathname);
  useEffect(() => {
    if (prevPathRef.current !== pathname) {
      prevPathRef.current = pathname;
      const t = setTimeout(() => setMobileOpen(false), 0);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  return (
    <>
      {/* ════════════════════ DESKTOP PILL ════════════════════ */}
      <nav
        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 hidden sm:flex items-center"
        style={{
          ...PILL_STYLE,
          height: 50,
          overflow: "hidden",
          boxShadow: scrolled
            ? "0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,158,11,0.07)"
            : "0 2px 20px rgba(0,0,0,0.35)",
          transition: "box-shadow 0.4s ease",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 h-full shrink-0"
          style={{
            padding: "0 20px 0 18px",
            borderRight: "1px solid rgba(63,63,70,0.60)",
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 26, height: 26,
              border: "1px solid rgba(245,158,11,0.45)",
              background: "rgba(245,158,11,0.08)",
              borderRadius: 4,
            }}
          >
            <Zap size={13} className="text-amber-400" />
          </div>
          <span
            className="font-display text-white"
            style={{ fontSize: 13, letterSpacing: "0.22em" }}
          >
            JOBSCOUT
          </span>
        </div>

        {/* Nav buttons */}
        {LINKS.map((link) => (
          <NavButton
            key={link.path}
            label={link.label}
            active={pathname === link.path}
            onClick={() => navigate(link.path)}
          />
        ))}

        {/* Four-dot ornament (mini-navbar prompt) */}
        <div
          className="flex items-center justify-center h-full shrink-0"
          style={{
            padding: "0 16px",
            borderLeft: "1px solid rgba(63,63,70,0.60)",
          }}
        >
          <FourDots />
        </div>
      </nav>

      {/* ════════════════════ MOBILE PILL ════════════════════ */}
      <nav
        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 flex sm:hidden items-center"
        style={{
          ...PILL_STYLE,
          height: 46,
          width: "calc(100vw - 32px)",
          maxWidth: 400,
          overflow: "hidden",
          boxShadow: "0 4px 28px rgba(0,0,0,0.55)",
        }}
      >
        <div
          className="flex items-center gap-2 flex-1 h-full"
          style={{
            padding: "0 16px",
            borderRight: "1px solid rgba(63,63,70,0.60)",
          }}
        >
          <div
            className="flex items-center justify-center shrink-0"
            style={{
              width: 24, height: 24,
              border: "1px solid rgba(245,158,11,0.45)",
              background: "rgba(245,158,11,0.08)",
              borderRadius: 3,
            }}
          >
            <Zap size={11} className="text-amber-400" />
          </div>
          <span
            className="font-display text-white"
            style={{ fontSize: 12, letterSpacing: "0.20em" }}
          >
            JOBSCOUT
          </span>
        </div>

        {/* Hamburger / close */}
        <button
          onClick={() => setMobileOpen((o) => !o)}
          className="flex items-center justify-center h-full shrink-0"
          style={{ padding: "0 18px" }}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          <AnimatePresence mode="wait">
            {mobileOpen ? (
              <motion.svg
                key="x"
                initial={{ rotate: -45, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0,   opacity: 1, scale: 1   }}
                exit={{    rotate:  45, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="rgba(255,255,255,0.75)"
                strokeWidth="2" strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </motion.svg>
            ) : (
              <motion.svg
                key="burger"
                initial={{ rotate:  45, opacity: 0, scale: 0.7 }}
                animate={{ rotate:  0,  opacity: 1, scale: 1   }}
                exit={{    rotate: -45, opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.18 }}
                width="16" height="12" viewBox="0 0 18 12" fill="none"
              >
                <path d="M1 1H17"  stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M1 6H17"  stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M1 11H17" stroke="rgba(255,255,255,0.75)" strokeWidth="1.5" strokeLinecap="round"/>
              </motion.svg>
            )}
          </AnimatePresence>
        </button>
      </nav>

      {/* ════════════════════ MOBILE DROPDOWN ════════════════════ */}
      {/* Spring pop-down, staggered link entries */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,   scale: 1    }}
            exit={{    opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 26 }}
            className="fixed sm:hidden z-40 flex flex-col"
            style={{
              top: 70,
              left: "50%",
              transform: "translateX(-50%)",
              width: "calc(100vw - 32px)",
              maxWidth: 400,
              backgroundColor: "rgba(10,10,10,0.97)",
              border: "1px solid rgba(63,63,70,0.80)",
              borderRadius: 16,
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.65)",
            }}
          >
            {LINKS.map((link, i) => {
              const isActive = pathname === link.path;
              return (
                <motion.button
                  key={link.path}
                  initial={{ opacity: 0, x: -14 }}
                  animate={{ opacity: 1, x: 0   }}
                  transition={{ delay: i * 0.07, duration: 0.22, ease: "easeOut" }}
                  onClick={() => navigate(link.path)}
                  className="relative flex items-center gap-3 w-full text-left"
                  style={{
                    padding: "15px 20px",
                    borderBottom:
                      i < LINKS.length - 1
                        ? "1px solid rgba(63,63,70,0.45)"
                        : "none",
                    background: isActive
                      ? "rgba(245,158,11,0.05)"
                      : "transparent",
                  }}
                >
                  {/* Active left bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-0 bottom-0"
                      style={{ width: 2, background: "#f59e0b" }}
                    />
                  )}

                  <div
                    className="rounded-full shrink-0"
                    style={{
                      width: 6, height: 6,
                      background: isActive
                        ? "#f59e0b"
                        : "rgba(255,255,255,0.18)",
                    }}
                  />

                  <span
                    className="text-sm font-medium tracking-wide flex-1"
                    style={{
                      color: isActive ? "#fff" : "rgba(255,255,255,0.50)",
                    }}
                  >
                    {link.label}
                  </span>

                  {isActive && (
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.12em",
                        color: "rgba(245,158,11,0.55)",
                      }}
                    >
                      active
                    </span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;