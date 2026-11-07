/**
 * Helpers the nudge page uses to talk to whatever hosts it (the Chrome extension's
 * iframe). In a plain browser tab they are harmless no-ops. Shared contract; change via a handoff.
 */
import type { HostMessage } from "./types";

function post(msg: HostMessage) {
  if (typeof window === "undefined") return;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(msg, "*");
  }
}

export function hostResize(height: number) {
  post({ source: "st-nudge", type: "resize", height: Math.ceil(height) });
}

export function hostClose() {
  post({ source: "st-nudge", type: "close" });
}

export function hostOpenDashboard(path?: string) {
  post({ source: "st-nudge", type: "open", path });
}

/** True when the page is embedded by a host (iframe), false in a normal tab. */
export function isHosted() {
  return typeof window !== "undefined" && window.parent !== window;
}
