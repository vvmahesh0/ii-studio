import crossSpawn from "cross-spawn";
import { spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { delimiter, isAbsolute, join, win32 } from "node:path";

export function executableCandidates(name: string, explicit?: string, platform = process.platform, env = process.env, home = homedir()): string[] {
  const windows = platform === "win32";
  const path = windows ? win32 : { join, isAbsolute };
  if (explicit) {
    if (!path.isAbsolute(explicit)) throw new Error("Configured CLI paths must be absolute.");
    if (windows && !/\.(exe|cmd|bat)$/i.test(explicit)) throw new Error("On Windows configure an .exe, .cmd or .bat launcher, not a PowerShell-only .ps1 script.");
    return [explicit];
  }
  const pathValue = Object.entries(env).find(([key]) => windows ? key.toLowerCase() === "path" : key === "PATH")?.[1] ?? "";
  const dirs = [path.join(home, ".local", "bin"), ...pathValue.split(windows ? ";" : delimiter).map(dir => dir.replace(/^"|"$/g, "")).filter(Boolean)];
  const extensions = windows ? (env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(ext => /^\.(exe|cmd|bat)$/i.test(ext)) : [""];
  return [...new Set(dirs.filter(dir => path.isAbsolute(dir)).flatMap(dir => extensions.map(ext => path.join(dir, name + ext.toLowerCase()))))];
}

export async function findExecutable(name: string, explicit?: string): Promise<string> {
  for (const candidate of executableCandidates(name, explicit)) {
    try {
      await access(candidate, process.platform === "win32" ? constants.F_OK : constants.X_OK);
      if ((await stat(candidate)).isFile()) return candidate;
    } catch { /* Continue through the known PATH entries. */ }
  }
  throw new Error(`${name} was not found. Install and sign in using its official CLI, then configure its absolute provider path if needed. Windows requires an .exe, .cmd or .bat launcher.`);
}

/** Prompts stay on stdin. cross-spawn handles Windows npm shims and argument quoting. */
export function spawnCli(executable: string, args: string[], cwd: string): ChildProcessWithoutNullStreams {
  return crossSpawn(executable, args, { cwd, stdio: ["pipe", "pipe", "pipe"], detached: process.platform !== "win32", windowsHide: true }) as ChildProcessWithoutNullStreams;
}

/** Only the owned child/group is terminated, never a process-name wildcard. */
export function terminateCli(child: ChildProcessWithoutNullStreams, graceMs = 1500): void {
  const pid = child.pid;
  if (!pid || !Number.isSafeInteger(pid) || pid <= 0 || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    const systemRoot = process.env.SystemRoot || process.env.SYSTEMROOT;
    if (!systemRoot || !win32.isAbsolute(systemRoot)) { child.kill(); return; }
    // Synchronous so the process tree is gone before temp cleanup / parent exit.
    // taskkill never receives user text, executable names or prompt arguments.
    const result = spawnSync(win32.join(systemRoot, "System32", "taskkill.exe"), ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: 5000 });
    if (result.error || result.status !== 0) child.kill();
    return;
  }
  try { process.kill(-pid, "SIGTERM"); } catch { child.kill("SIGTERM"); }
  const escalation = setTimeout(() => {
    try { process.kill(-pid, "SIGKILL"); } catch { /* Already stopped. */ }
  }, graceMs);
  escalation.unref();
}
