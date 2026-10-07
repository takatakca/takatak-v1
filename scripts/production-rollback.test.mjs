import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, chmod, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

test("a failed public acceptance after activation restores the captured release and restarts", async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), "takatak-rollback-"));
  const binaries = path.join(temporary, "fixture-bin");
  await mkdir(binaries);
  await mkdir(path.join(temporary, "takatak-ssh"));
  await writeFile(path.join(temporary, "takatak-ssh", "config"), "Host takatak-production\nHostName must-never-connect.invalid\n");
  const commands = {
    ssh: `#!/usr/bin/env bash\nscript="$(cat)"\nif [[ "$script" == *'printf'* ]]; then printf '%s' '/home/operator/apps/takatak/releases/old/app';\nelif [[ "$script" == *'current.rollback'* ]]; then echo rollback >> "$TRACE_FILE";\nelif [[ "$script" == *'current.new'* ]]; then echo activate >> "$TRACE_FILE";\nelif [[ "$script" == *'bash -lc'* ]]; then echo restart >> "$TRACE_FILE";\nfi\n`,
    scp: "#!/usr/bin/env bash\necho upload >> \"$TRACE_FILE\"\n",
    gh: "#!/usr/bin/env bash\nprintf '%s' \"$RELEASE_SHA\"\n",
    sleep: "#!/usr/bin/env bash\nexit 0\n",
    curl: "#!/usr/bin/env bash\nprintf '%s' '{\"ok\":true,\"checks\":{\"database\":\"ok\",\"supabase\":\"ok\"}}'\n",
    node: "#!/usr/bin/env bash\nif [[ \"${1:-}\" == scripts/production-release-smoke.mjs ]]; then echo rejected >> \"$TRACE_FILE\";exit 1;fi\nexit 0\n",
  };
  try {
    for (const [command, contents] of Object.entries(commands)) {
      const filename = path.join(binaries, command);
      await writeFile(filename, contents);
      await chmod(filename, 0o755);
    }
    const bash = process.platform === "win32" ? "C:\\Program Files\\Git\\bin\\bash.exe" : "bash";
    const fixturePath = process.platform === "win32" ? '$(cygpath -u "$FIXTURE_BIN")' : '$FIXTURE_BIN';
    const command = `export PATH="${fixturePath}:$PATH"; case "$(command -v ssh)" in */fixture-bin/ssh) ;; *) echo "SSH mock not selected" >&2; exit 12 ;; esac; exec bash deploy/linux/promote-production.sh`;
    const result = spawnSync(bash, ["--noprofile", "--norc", "-c", command], {
      encoding: "utf8", timeout: 15_000,
      env: { ...process.env, FIXTURE_BIN: binaries, RUNNER_TEMP: temporary.replaceAll("\\", "/"), TRACE_FILE: path.join(temporary, "trace").replaceAll("\\", "/"), RELEASE_SHA: "a".repeat(40), GITHUB_RUN_ID: "42", PRODUCTION_ORIGIN: "https://takatak.ca", PROMOTION_MODE: "promote", TKT_APP_ROOT: "/home/operator/apps/takatak", TKT_RESTART_COMMAND: "synthetic-approved-restart", GH_REPO: "takatakca/takatak-v1" },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, result.stderr);
    const trace = (await readFile(path.join(temporary, "trace"), "utf8")).trim().split("\n");
    assert.equal(trace.filter((entry) => entry === "activate").length, 1);
    assert.equal(trace.filter((entry) => entry === "rollback").length, 1);
    assert.equal(trace.filter((entry) => entry === "restart").length, 2);
    assert.ok(trace.indexOf("rollback") > trace.indexOf("activate"));
    assert.match(result.stdout, /Previous release restored/);
  } finally {
    const resolved = path.resolve(temporary);
    assert.ok(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}takatak-rollback-`));
    await rm(resolved, { recursive: true, force: true });
  }
});
