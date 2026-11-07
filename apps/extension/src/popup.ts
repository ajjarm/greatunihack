import type { Home } from "../../web/src/lib/types";
import { DEFAULT_WEB_URL, getPausedUntil, getWebUrl, setWebUrl } from "./config";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

function pounds(pence: number): string {
  const sign = pence < 0 ? "-" : "";
  const abs = Math.abs(pence);
  const whole = abs % 100 === 0;
  return `${sign}£${(abs / 100).toLocaleString("en-GB", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}

async function loadHome() {
  const err = $("error");
  err.hidden = true;
  try {
    const base = await getWebUrl();
    const res = await fetch(`${base}/api/home`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const home = (await res.json()) as Home;
    $("safe").textContent = pounds(home.safeToSpendPence);
    const d = home.daysToNextIncome;
    $("income").textContent = `${d} ${d === 1 ? "day" : "days"}${home.nextIncome ? ` · ${home.nextIncome.name}` : ""}`;
    $("bill").textContent = home.nextBill ? `${home.nextBill.name} ${pounds(home.nextBill.amountPence)}, ${shortDate(home.nextBill.date)}` : "None due";
  } catch (e) {
    $("safe").textContent = "–";
    $("income").textContent = "–";
    $("bill").textContent = "–";
    err.textContent = `Can't reach ${await getWebUrl()}. Is the dev server running?`;
    err.hidden = false;
    console.warn(e);
  }
}

async function renderPause() {
  const until = await getPausedUntil();
  const paused = until > Date.now();
  const note = $("pausedNote");
  note.hidden = !paused;
  note.textContent = paused
    ? `Paused until ${new Date(until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}. It won't step in until then.`
    : "";
  $("pause").textContent = paused ? "Resume now" : "Pause for 1 hour";
}

$("pause").addEventListener("click", async () => {
  const paused = (await getPausedUntil()) > Date.now();
  await chrome.storage.local.set({ pausedUntil: paused ? 0 : Date.now() + 60 * 60 * 1000 });
  await renderPause();
});

$("dashboard").addEventListener("click", async () => {
  await chrome.tabs.create({ url: `${await getWebUrl()}/home` });
  window.close();
});

$<HTMLFormElement>("urlForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = $<HTMLInputElement>("webUrl");
  input.value = await setWebUrl(input.value || DEFAULT_WEB_URL);
  await loadHome();
});

(async () => {
  $<HTMLInputElement>("webUrl").value = await getWebUrl();
  await Promise.all([loadHome(), renderPause()]);
})();
