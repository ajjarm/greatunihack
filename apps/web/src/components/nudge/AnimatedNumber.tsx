"use client";
import { useEffect, useRef, useState } from "react";

/** Reads a CSS duration token (e.g. --motion-base) in ms; 0 when reduced motion zeroes it. */
function tokenMs(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return fallback;
  return raw.endsWith("ms") ? n : n * 1000;
}

/** Counts from the previous value to the new one over --motion-base. */
export function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const start = shownRef.current;
    if (start === value) return;
    // reduced motion zeroes the token; 1ms still lands on the final value in one frame
    const duration = Math.max(1, tokenMs("--motion-base", 220));
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = start + (value - start) * eased;
      shownRef.current = p === 1 ? value : v;
      setShown(shownRef.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return <span className="nudge-num">{format(Math.round(shown))}</span>;
}
