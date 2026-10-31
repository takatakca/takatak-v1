#!/usr/bin/env node
// Generates the homepage video loops with the Runway API, from the shot list in
// scripts/media/runway-shots.json. Each shot animates one licensed photo
// (image to video), so the people stay real.
//
//   node scripts/media/runway-generate.mjs                 dry run: lists shots and total seconds
//   node scripts/media/runway-generate.mjs --run           generates every shot (spends credits)
//   node scripts/media/runway-generate.mjs --run --only website,local
//   node scripts/media/runway-generate.mjs --run --vertical   9:16 copies for social posts
//
// Needs RUNWAYML_API_SECRET in the environment and network access to
// api.dev.runwayml.com. Horizontal clips go to public/media/videos/<key>.mp4 and
// are registered in src/lib/website/media-manifest.json, so the site starts
// playing them on its own. Vertical clips go to public/media/social/ and are
// not used by the site.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const API = "https://api.dev.runwayml.com/v1";
const VERSION = "2024-11-06";
const MANIFEST = path.join(ROOT, "src/lib/website/media-manifest.json");

const args = process.argv.slice(2);
const run = args.includes("--run");
const vertical = args.includes("--vertical");
const onlyArg = args.find((a) => a.startsWith("--only"));
const only = onlyArg ? (onlyArg.includes("=") ? onlyArg.split("=")[1] : args[args.indexOf(onlyArg) + 1] ?? "").split(",").filter(Boolean) : null;

const config = JSON.parse(await readFile(path.join(ROOT, "scripts/media/runway-shots.json"), "utf8"));
const shots = config.shots.filter((s) => !only || only.includes(s.key));
const ratio = vertical ? config.verticalRatio : config.ratio;

console.log(`${shots.length} shot(s) · ${config.model} · ${config.duration}s each · ${ratio} · ${shots.length * config.duration}s of video in total`);
for (const s of shots) console.log(`  - ${s.key.padEnd(10)} ${s.photo}`);
if (!run) {
  console.log("\nDry run. Add --run to generate (this spends Runway credits).");
  process.exit(0);
}

const secret = process.env.RUNWAYML_API_SECRET?.trim();
if (!secret) {
  console.error("RUNWAYML_API_SECRET is not set.");
  process.exit(1);
}
const headers = { Authorization: `Bearer ${secret}`, "X-Runway-Version": VERSION, "Content-Type": "application/json" };

const mime = (file) => (file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function generate(shot) {
  const bytes = await readFile(path.join(ROOT, shot.photo));
  const promptImage = `data:${mime(shot.photo)};base64,${bytes.toString("base64")}`;
  const start = await fetch(`${API}/image_to_video`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: config.model, promptImage, promptText: shot.prompt, ratio, duration: config.duration }),
  });
  if (!start.ok) throw new Error(`start ${start.status}: ${(await start.text()).slice(0, 300)}`);
  const { id } = await start.json();
  for (let i = 0; i < 120; i++) {
    await sleep(5000);
    const res = await fetch(`${API}/tasks/${id}`, { headers });
    if (!res.ok) throw new Error(`poll ${res.status}`);
    const task = await res.json();
    if (task.status === "SUCCEEDED") return task.output?.[0];
    if (task.status === "FAILED" || task.status === "CANCELLED") throw new Error(`task ${task.status}: ${task.failure ?? ""}`);
  }
  throw new Error("timed out after 10 minutes");
}

const outDir = path.join(ROOT, vertical ? "public/media/social" : "public/media/videos");
await mkdir(outDir, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, "utf8")) : { videos: {} };

for (const shot of shots) {
  process.stdout.write(`${shot.key}: generating… `);
  try {
    const url = await generate(shot);
    if (!url) throw new Error("no output URL");
    const file = await fetch(url);
    if (!file.ok) throw new Error(`download ${file.status}`);
    const name = vertical ? `${shot.key}-vertical.mp4` : `${shot.key}.mp4`;
    await writeFile(path.join(outDir, name), Buffer.from(await file.arrayBuffer()));
    if (!vertical) {
      manifest.videos[shot.key] = `/media/videos/${name}`;
      await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    console.log(`saved ${path.relative(ROOT, path.join(outDir, name))}`);
  } catch (error) {
    console.log(`failed (${error instanceof Error ? error.message : error})`);
  }
}
