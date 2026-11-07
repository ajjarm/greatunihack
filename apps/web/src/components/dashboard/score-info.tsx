"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ScoreInfo({ label, children, details, className = "" }: { label: string; children: ReactNode; details: ReactNode; className?: string }) {
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const positionPopup = useCallback(() => {
    const rect = button.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(288, window.innerWidth - 32);
    const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
    const top = rect.bottom + 8 + 220 > window.innerHeight ? Math.max(16, rect.top - 228) : rect.bottom + 8;
    setPosition({ top, left });
  }, []);
  useEffect(() => {
    if (!open) return;
    positionPopup();
    window.addEventListener("resize", positionPopup);
    window.addEventListener("scroll", positionPopup, true);
    return () => {
      window.removeEventListener("resize", positionPopup);
      window.removeEventListener("scroll", positionPopup, true);
    };
  }, [open, positionPopup]);

  return <>
    <button ref={button} type="button" aria-label={`${label}. Show explanation`} aria-describedby={open ? id : undefined} aria-expanded={open} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} className={`cursor-help text-left underline decoration-[var(--color-border)] decoration-dotted underline-offset-4 ${className}`}>{children}</button>
    {open && createPortal(<div id={id} role="tooltip" className="dashboard-pop pointer-events-none fixed z-50 w-72 max-w-[calc(100vw-2rem)] bg-[var(--color-popover)] p-3 text-left text-xs font-normal leading-relaxed text-[var(--color-text)] shadow-[var(--shadow-float)]" style={{ ...position, borderRadius: "var(--radius-md)" }}><p className="font-semibold">{label}</p><div className="mt-2 space-y-1 text-[var(--color-text-muted)]">{details}</div></div>, document.body)}
  </>;
}
