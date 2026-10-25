import { cliFixture } from "./helpers/cli-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  providers,
  localProvider,
  decodeCli,
  cliArguments,
  executableFor,
  CliWorker,
} from "../app/lib/model/cli.ts";
test("only explicit supported CLI providers; no hosted provider accepted", () => {
  const old = process.env.II_CLI_PROVIDER;
  try {
    process.env.II_CLI_PROVIDER = "openrouter";
    assert.throws(localProvider, /Choose/);
    for (const value of providers) {
      process.env.II_CLI_PROVIDER = value;
      assert.equal(localProvider(), value);
    }
  } finally {
    if (old === undefined) delete process.env.II_CLI_PROVIDER;
    else process.env.II_CLI_PROVIDER = old;
  }
});
test("CLI protocols decode text, errors and tools without leaking diagnostics", () => {
  assert.deepEqual(
    decodeCli("codex", {
      type: "item.completed",
      item: { type: "agent_message", text: "Hello" },
    }),
    { text: "Hello" },
  );
  assert.deepEqual(
    decodeCli("codex", {
      type: "item.started",
      item: { type: "command_execution" },
    }),
    { tool: true },
  );
  assert.deepEqual(
    decodeCli("claude", {
      type: "stream_event",
      event: { delta: { type: "text_delta", text: "Hi" } },
    }),
    { text: "Hi" },
  );
  assert.deepEqual(
    decodeCli("claude", { type: "result", is_error: true, result: "secret" }),
    { failed: true },
  );
  assert.deepEqual(
    decodeCli("gemini", { type: "message", role: "assistant", content: "Hi" }),
    { text: "Hi" },
  );
  assert.deepEqual(decodeCli("gemini", { type: "tool_use" }), { tool: true });
});
test("CLI flags restrict tools, hooks and shell interpolation", () => {
  const codex = cliArguments("codex", "my/model");
  assert.ok(codex.includes("shell_tool"));
  assert.ok(codex.includes("--ignore-user-config"));
  assert.ok(codex.includes("read-only"));
  const claude = cliArguments("claude");
  assert.equal(claude[claude.indexOf("--tools") + 1], "");
  assert.ok(claude.includes("--strict-mcp-config"));
  assert.ok(claude.includes("--no-session-persistence"));
  assert.ok(cliArguments("gemini").includes("--sandbox"));
});
test("missing configured executable fails without shell execution", async () => {
  process.env.II_CODEX_PATH = join(tmpdir(), "ii-nonexistent-cli");
  await assert.rejects(executableFor("codex"), /not found/);
  delete process.env.II_CODEX_PATH;
});
test("subprocess transport: success, malformed output, failure, bounded output and cancellation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ii-test-"));

  try {
    for (const [body, error] of [
      [
        `process.stdin.resume();process.stdin.on('end',()=>console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'Fixture'}})))`,
        null,
      ],
      [`console.log('not-json')`, /unsupported response/],
      [
        `console.log(JSON.stringify({type:'error',message:'private diagnostic'}))`,
        /could not finish/,
      ],
      [
        `console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'x'.repeat(64001)}}))`,
        /too large/,
      ],
    ]) {
      process.env.II_CODEX_PATH = await cliFixture(dir, body);
      const chunks = [];
      const p = new CliWorker("codex", "Test only").turn(
        "Synthetic",
        (x) => chunks.push(x),
        new AbortController().signal,
      );
      if (error) await assert.rejects(p, error);
      else {
        assert.equal(await p, "Fixture");
        assert.deepEqual(chunks, ["Fixture"]);
      }
    }
    process.env.II_CODEX_PATH = await cliFixture(dir, "setInterval(()=>{},1000)");
    const abort = new AbortController();
    const pending = new CliWorker("codex", "Test").turn(
      "Synthetic",
      () => {},
      abort.signal,
    );
    setTimeout(() => abort.abort(), 100);
    await assert.rejects(pending, /stopped/);
  } finally {
    delete process.env.II_CODEX_PATH;
    await rm(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});

test("Codex nonfatal diagnostic items are not executable tools", () => {
  assert.deepEqual(
    decodeCli("codex", {
      type: "item.completed",
      item: { type: "error", message: "nonfatal diagnostic" },
    }),
    {},
  );
  assert.deepEqual(
    decodeCli("codex", {
      type: "item.completed",
      item: { type: "command_execution" },
    }),
    { tool: true },
  );
});
