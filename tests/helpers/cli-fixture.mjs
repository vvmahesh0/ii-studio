import { writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
export async function cliFixture(directory, body, name = "fake cli") {
 const script = join(directory, name + ".cjs");
 await writeFile(script, body);
 const launcher = join(directory, name + (process.platform === "win32" ? ".cmd" : ""));
 if (process.platform === "win32") await writeFile(launcher, `@echo off\r\n"${process.execPath}" "%~dp0${name}.cjs" %*\r\n`);
 else { await writeFile(launcher, `#!${process.execPath}\n${body}\n`); await chmod(launcher, 0o700); }
 return launcher;
}
