// Bundles the extension into dist/ (the folder you "Load unpacked" in chrome://extensions).
import * as esbuild from "esbuild";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, "static"), dist, { recursive: true });

const options = {
  entryPoints: {
    content: join(root, "src/content.ts"),
    background: join(root, "src/background.ts"),
    popup: join(root, "src/popup.ts"),
  },
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome114",
  legalComments: "none",
  logLevel: "info",
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("watching src/ (static/ is copied once; re-run to pick up manifest changes)");
} else {
  await esbuild.build(options);
}
