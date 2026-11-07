/** Feature switches for the live Brain. Fixture mode stays the default. */
export function brainLive(): boolean {
  return process.env.BRAIN_MODE === "live";
}

/** The Claude-judged Spend Score is off unless both switches are on. */
export function scoreLive(): boolean {
  return brainLive() && process.env.SCORE_MODE === "live";
}
