"use client";
import type { TimelinePoint } from "@/lib/types";
import { day, money } from "./format";

const W = 352;
const H = 120;
const PAD = { l: 4, r: 4, t: 10, b: 18 };

/** Small SVG of projected balance: before (solid) and after this basket (dashed), with income and bill markers. */
export function TimelineChart({ points }: { points: TimelinePoint[] }) {
  if (points.length < 2) return null;
  const vals = points.flatMap((p) => [p.projectedPence, p.projectedAfterPence ?? p.projectedPence]);
  const min = Math.min(0, ...vals);
  const max = Math.max(...vals, 1);
  const x = (i: number) => PAD.l + (i / (points.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - min) / (max - min)) * (H - PAD.t - PAD.b);
  const path = (get: (p: TimelinePoint) => number) =>
    points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(" ");
  const hasAfter = points.some((p) => p.projectedAfterPence !== undefined);
  const lowAfter = Math.min(...points.map((p) => p.projectedAfterPence ?? p.projectedPence));

  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Projected balance to ${day(points[points.length - 1].date, false)}; lowest after this basket ${money(lowAfter)}`}>
        {min < 0 && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--color-stop)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
        )}
        {points.map((p, i) =>
          p.events.map((e, j) => (
            <g key={`${i}-${j}`}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={PAD.t}
                y2={H - PAD.b}
                stroke={e.type === "income" ? "var(--color-go)" : "var(--color-stop)"}
                strokeWidth={1}
                opacity={0.25}
              />
              <circle cx={x(i)} cy={H - PAD.b + 6} r={3} fill={e.type === "income" ? "var(--color-go)" : "var(--color-stop)"}>
                <title>{`${e.name} ${money(e.amountPence)} on ${day(p.date)}`}</title>
              </circle>
            </g>
          )),
        )}
        <path d={path((p) => p.projectedPence)} fill="none" stroke="var(--color-text-muted)" strokeWidth={1.5} />
        {hasAfter && (
          <path
            d={path((p) => p.projectedAfterPence ?? p.projectedPence)}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth={2}
            strokeDasharray="5 3"
          />
        )}
      </svg>
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] nudge-muted">
        <span className="flex items-center gap-1">
          <span className="nudge-swatch" style={{ background: "var(--color-text-muted)" }} /> without this
        </span>
        {hasAfter && (
          <span className="flex items-center gap-1">
            <span className="nudge-swatch" style={{ background: "var(--color-accent)" }} /> with this basket
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="nudge-dot" style={{ background: "var(--color-go)" }} /> income
        </span>
        <span className="flex items-center gap-1">
          <span className="nudge-dot" style={{ background: "var(--color-stop)" }} /> bill
        </span>
        <span className="ml-auto">
          {day(points[0].date, false)} – {day(points[points.length - 1].date, false)}
        </span>
      </figcaption>
    </figure>
  );
}
