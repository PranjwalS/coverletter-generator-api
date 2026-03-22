"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "motion/react";

interface SpecialTextProps {
  children: string;
  speed?: number;
  delay?: number;
  className?: string;
  inView?: boolean;
  once?: boolean;
}

const RANDOM_CHARS = "_!X$0-+*#";
function getRandomChar(prevChar?: string): string {
  let char: string;
  do { char = RANDOM_CHARS[Math.floor(Math.random() * RANDOM_CHARS.length)]; }
  while (char === prevChar);
  return char;
}

export function SpecialText({ children, speed = 20, delay = 0, className = "", inView = false, once = true }: SpecialTextProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const isInView = useInView(containerRef, { once, margin: "-100px" });
  const shouldAnimate = inView ? isInView : true;
  const text = children;
  const [displayText, setDisplayText] = useState<string>(" ".repeat(text.length));
  const [currentPhase, setCurrentPhase] = useState<"phase1" | "phase2">("phase1");
  const [animationStep, setAnimationStep] = useState<number>(0);
  const [hasStarted, setHasStarted] = useState(() => !inView && delay <= 0);
  const intervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeoutRef = useRef<number | null>(null);

  function startAnimation() {
    setHasStarted(true);
    setDisplayText(" ".repeat(text.length));
    setCurrentPhase("phase1");
    setAnimationStep(0);
  }

useEffect(() => {
  if (shouldAnimate && !hasStarted) {
    if (delay <= 0) {
      startTimeoutRef.current = window.setTimeout(() => startAnimation(), 0);
      return;
    }
    startTimeoutRef.current = window.setTimeout(() => startAnimation(), delay * 1000);
  }
  return () => { if (startTimeoutRef.current) window.clearTimeout(startTimeoutRef.current); };
}, [shouldAnimate, hasStarted, delay]);

  useEffect(() => {
    if (!hasStarted) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (currentPhase === "phase1") {
        const maxSteps = text.length * 2;
        const currentLength = Math.min(animationStep + 1, text.length);
        const chars: string[] = [];
        for (let i = 0; i < currentLength; i++) chars.push(getRandomChar(i > 0 ? chars[i - 1] : undefined));
        for (let i = currentLength; i < text.length; i++) chars.push("\u00A0");
        setDisplayText(chars.join(""));
        if (animationStep < maxSteps - 1) setAnimationStep(p => p + 1);
        else { setCurrentPhase("phase2"); setAnimationStep(0); }
      } else {
        const revealedCount = Math.floor(animationStep / 2);
        const chars: string[] = [];
        for (let i = 0; i < revealedCount && i < text.length; i++) chars.push(text[i]);
        if (revealedCount < text.length) chars.push(animationStep % 2 === 0 ? "_" : getRandomChar());
        for (let i = chars.length; i < text.length; i++) chars.push(getRandomChar());
        setDisplayText(chars.join(""));
        if (animationStep < text.length * 2 - 1) setAnimationStep(p => p + 1);
        else {
          setDisplayText(text);
          if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        }
      }
    }, speed);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [currentPhase, animationStep, text, speed, hasStarted]);

  return (
    <span ref={containerRef} className={`inline-flex font-mono ${className}`}>
      {displayText}
    </span>
  );
}