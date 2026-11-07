"use client";
import "./nudge.css";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { hostClose, hostResize } from "@/lib/host";
import type { Assessment, Purchase, WaitingItem } from "@/lib/types";
import * as api from "./api";
import { NudgeCard } from "./NudgeCard";
import { NudgeToast } from "./NudgeToast";

export type DoneInfo = { decision: api.DecisionIn; waitingItem?: WaitingItem; purchase?: Purchase };

const FINAL = ["wait", "buy_anyway", "dismiss"] as const;

/** Reads the query; a new query remounts the loader so its state starts fresh. */
export function NudgeClient() {
  const params = useSearchParams();
  const assessmentId = params.get("assessmentId");
  const scenario = params.get("scenario");
  if (!assessmentId && !scenario) {
    return <Message error="Add ?scenario=scn_1_impulse or ?assessmentId=… to the URL." />;
  }
  return <NudgeLoader key={`${assessmentId ?? ""}|${scenario ?? ""}`} assessmentId={assessmentId} scenario={scenario} />;
}

function Message({ error }: { error?: string | null }) {
  return (
    <div className="p-3">
      <div className="nudge-card p-5 flex flex-col gap-2" data-busy={error ? "false" : "true"} aria-busy={!error}>
        {error ? (
          <p className="nudge-error px-3 py-2 text-sm" role="alert">
            {error}
          </p>
        ) : (
          <p className="nudge-muted text-sm nudge-risk-figure">Having a second think…</p>
        )}
      </div>
    </div>
  );
}

/** Loads the assessment, owns every API call, and re-renders from each response. */
function NudgeLoader({ assessmentId, scenario }: { assessmentId: string | null; scenario: string | null }) {
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // which action is in flight
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [toastGone, setToastGone] = useState(false);
  // the toast is decided by the first verdict only; a later re-judge to go_ahead stays in the card
  const [isToast, setIsToast] = useState(false);
  const started = useRef(false);

  // load once (guarded so dev StrictMode does not create two assessments)
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (assessmentId ? api.getAssessment(assessmentId) : api.assessScenario(scenario!))
      .then((a) => {
        setAssessment(a);
        setIsToast(a.verdict === "go_ahead");
        if ((FINAL as readonly string[]).includes(a.decision)) setDone({ decision: a.decision as api.DecisionIn });
      })
      .catch((e: Error) => setError(e.message));
  }, [assessmentId, scenario]);

  const run = useCallback(
    async (label: string, fn: () => Promise<Assessment>) => {
      if (busy) return;
      setBusy(label);
      setError(null);
      try {
        setAssessment(await fn());
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [busy],
  );

  const id = assessment?.id;
  const onNegotiate = (optionId: string) => id && run(`neg:${optionId}`, () => api.postNegotiate(id, optionId));
  const onReason = (text: string) => id && run("reason", () => api.postReason(id, text));
  const onEssential = (itemIndex: number, essential: boolean) =>
    id && run(`ess:${itemIndex}`, () => api.patchEssential(id, itemIndex, essential));

  const onDecision = useCallback(
    async (decision: api.DecisionIn) => {
      if (!id || busy || done) return;
      setBusy(`dec:${decision}`);
      setError(null);
      try {
        const res = await api.patchDecision(id, decision);
        setAssessment(res.assessment);
        setDone({ decision, waitingItem: res.waitingItem, purchase: res.purchase });
        hostClose();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(null);
      }
    },
    [id, busy, done],
  );

  // Escape = Dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !assessment || done || isToast) return;
      e.preventDefault();
      // first Escape inside a text box just leaves the box; the next one dismisses
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.blur();
        return;
      }
      onDecision("dismiss");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assessment, done, isToast, onDecision]);


  // toast auto-closes after 3 seconds
  useEffect(() => {
    if (!isToast || toastGone) return;
    const t = setTimeout(() => {
      setToastGone(true);
      hostClose();
    }, 3000);
    return () => clearTimeout(t);
  }, [isToast, toastGone]);

  // tell the host our height after every render, and whenever layout changes (expand, animations)
  useLayoutEffect(() => {
    if (isToast) hostResize(72);
    else hostResize(document.body.scrollHeight);
  });
  useEffect(() => {
    if (isToast || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => hostResize(document.body.scrollHeight));
    ro.observe(document.body);
    return () => ro.disconnect();
  }, [isToast]);

  if (!assessment) return <Message error={error} />;

  if (isToast) {
    return toastGone ? (
      <p className="p-3 text-sm nudge-muted">Closed. Enjoy it.</p>
    ) : (
      <div className="p-0">
        <NudgeToast assessment={assessment} onClose={() => { setToastGone(true); hostClose(); }} />
      </div>
    );
  }

  return (
    <div className="p-3">
      <NudgeCard
        assessment={assessment}
        busy={busy}
        error={error}
        done={done}
        onNegotiate={onNegotiate}
        onReason={onReason}
        onEssential={onEssential}
        onDecision={onDecision}
      />
    </div>
  );
}
