"use strict";

// Emits only fixed classifications and numeric resource counters, never log text.
const fs = require("node:fs");

const RULES = [
  ["oom", /heap out of memory|ineffective mark-compacts|allocation failed.*heap|\bENOMEM\b|out[- ]of[- ]memory|oom[_ -]kill/i],
  ["disk", /\bENOSPC\b|no space left on device|disk quota exceeded|\bEDQUOT\b/i],
  ["font", /failed to (fetch|download).*font|next\/font.*(error|failed)|fonts\.googleapis\.com/i],
  ["prerender", /error occurred prerendering|prerender-error/i],
  ["native_engine", /PrismaClient(Initialization|RustPanic)Error|query engine.*(failed|error|exited)|unable to (require|load).*engine|failed to load SWC binary|SWC binary.*(failed|error)|wrong ELF class|invalid ELF header|error while loading shared libraries|ERR_DLOPEN_FAILED|module did not self-register/i],
  ["module", /module not found|MODULE_NOT_FOUND|cannot find module|can.t resolve/i],
  ["type", /type error:|error TS[0-9]{4}/i],
  ["configuration", /invalid supabaseUrl|supabaseKey is required|(missing|required|not configured).*(NEXT_PUBLIC|SUPABASE|DATABASE_URL)|(NEXT_PUBLIC|SUPABASE|DATABASE_URL).*(missing|required|not configured)/i],
  ["network", /\b(ETIMEDOUT|ECONNRESET|EAI_AGAIN|ENOTFOUND|CERT_HAS_EXPIRED|UNABLE_TO_VERIFY_LEAF_SIGNATURE)\b|fetch failed|socket hang up|TLS.*(handshake|certificate)/i],
  ["task_lock", /unable to acquire lock|another instance of next build|\b(EADDRINUSE|EBUSY|EAGAIN)\b|resource temporarily unavailable/i],
  ["worker", /build worker exited|worker.*(terminated|killed|crashed)|\b(SIGKILL|SIGABRT|SIGSEGV)\b|^\s*killed\s*$/im],
  ["compile", /failed to compile/i],
];
const PHASES = [
  ["webpack", "creating an optimized production build"],
  ["compiled", "compiled successfully"],
  ["typecheck", "running typescript"],
  ["page_data", "collecting page data"],
  ["static_generation", "generating static pages"],
  ["traces", "collecting build traces"],
  ["optimization", "finalizing page optimization"],
  ["complete", "route (app)"],
];
const CODES = ["ENOMEM", "ENOSPC", "EDQUOT", "ETIMEDOUT", "ECONNRESET", "EAI_AGAIN", "ENOTFOUND", "EADDRINUSE", "EBUSY", "EAGAIN", "ERR_DLOPEN_FAILED", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"];

function classifyBuildLog(log, exitCode = 1) {
  const text = typeof log === "string" ? log : "";
  const lower = text.toLowerCase();
  let phase = "unknown", latest = -1;
  for (const [name, marker] of PHASES) {
    const position = lower.lastIndexOf(marker);
    if (position > latest) { phase = name; latest = position; }
  }
  const signal = ["SIGKILL", "SIGABRT", "SIGSEGV"].find((name) => new RegExp(`\\b${name}\\b`).test(text))
    ?? ({ 137: "SIGKILL", 134: "SIGABRT", 139: "SIGSEGV" }[exitCode] ?? "none");
  const category = RULES.find(([, rule]) => rule.test(text))?.[0]
    ?? (signal !== "none" ? "worker" : "unknown");
  const code = CODES.find((name) => new RegExp(`\\b${name}\\b`).test(text)) ?? "none";
  return { category, phase, signal, code };
}

function readNumber(path) {
  try {
    const value = fs.readFileSync(path, "utf8").trim();
    return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  } catch { return null; }
}

function resourceSnapshot(phase) {
  const result = { phase: phase === "before" ? "before" : "after" };
  try {
    const memory = fs.readFileSync("/proc/meminfo", "utf8");
    for (const [field, key] of [["total_kib", "MemTotal"], ["available_kib", "MemAvailable"]]) {
      const value = memory.match(new RegExp(`^${key}:\\s+(\\d+) kB$`, "m"));
      result[field] = value ? Number(value[1]) : null;
    }
  } catch { /* Resource files are optional outside Linux. */ }
  result.cgroup_current_bytes = readNumber("/sys/fs/cgroup/memory.current");
  result.cgroup_max_bytes = readNumber("/sys/fs/cgroup/memory.max");
  try {
    const events = fs.readFileSync("/sys/fs/cgroup/memory.events", "utf8");
    for (const key of ["oom", "oom_kill"]) {
      const value = events.match(new RegExp(`^${key} (\\d+)$`, "m"));
      result[`cgroup_${key}`] = value ? Number(value[1]) : null;
    }
  } catch { /* Do not print filesystem errors or paths. */ }
  try {
    const disk = fs.statfsSync(process.cwd());
    result.disk_total_bytes = disk.blocks * disk.bsize;
    result.disk_available_bytes = disk.bavail * disk.bsize;
  } catch { /* Diagnostic collection must never change the build outcome. */ }
  return result;
}

function main(args) {
  if (args[0] === "--resources") {
    console.log(`::notice title=Build runner resources::${JSON.stringify(resourceSnapshot(args[1]))}`);
    return;
  }
  const exitCode = /^\d{1,3}$/.test(args[1] ?? "") && Number(args[1]) <= 255 ? Number(args[1]) : 1;
  let log = "";
  let file;
  try {
    // Bound memory use even when a failed compiler produced an unusually large log.
    file = fs.openSync(args[0], "r");
    const size = fs.fstatSync(file).size, limit = 8 * 1024 * 1024;
    const head = Buffer.alloc(Math.min(size, limit));
    fs.readSync(file, head, 0, head.length, 0);
    log = head.toString("utf8");
    if (size > limit) {
      const tail = Buffer.alloc(Math.min(size - limit, limit));
      fs.readSync(file, tail, 0, tail.length, size - tail.length);
      log += `\n${tail.toString("utf8")}`;
    }
  } catch { /* A missing log remains UNKNOWN. */ }
  finally { if (file !== undefined) try { fs.closeSync(file); } catch { /* Optional diagnostic only. */ } }
  const { category, phase, signal, code } = classifyBuildLog(log, exitCode);
  console.log(`::error title=Production build diagnostic::category=${category}; phase=${phase}; build_exit=${exitCode}; worker_signal=${signal}; code=${code}. Authenticated build logs remain the full evidence.`);
}

module.exports = { classifyBuildLog, resourceSnapshot };
if (require.main === module) main(process.argv.slice(2));
