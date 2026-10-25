import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import {
  WorkspaceStorage,
  persistGeneration,
  removeArtifacts,
} from "../app/lib/workspace/storage.ts";
import { localTitle, generationSchema } from "../app/lib/workspace/model.ts";
import { validateBackup, mergeBackup } from "../app/lib/workspace/backup.ts";
import { purchaseFixture } from "../app/lib/flowchart/examples.ts";
const now = new Date().toISOString();
const snapshot = {
  document: purchaseFixture,
  positions: {},
  viewport: { x: 0, y: 0, zoom: 1 },
};
function fixture(version = 1, parent = null, type = "flowchart") {
  const id = `g${version}`;
  return {
    conversation: {
      id: "c",
      projectId: null,
      title: "Approval",
      createdAt: now,
      updatedAt: now,
    },
    artifact: {
      id: "a",
      conversationId: "c",
      type,
      title: "Purchase approval",
      originalPrompt: "Create purchase approval",
      createdAt: now,
      updatedAt: now,
      activeGenerationId: id,
      latestGenerationId: id,
    },
    generation: {
      id,
      artifactId: "a",
      version,
      parentGenerationId: parent,
      instruction:
        version === 1 ? "Create purchase approval" : "Change threshold",
      createdAt: now,
      completedAt: now,
      schemaVersion: 1,
      type,
      ...(type === "flowchart"
        ? { snapshot }
        : {
            theme: "modern",
            revision: "modern-v3",
            program: 'root = Page([Heading("Example")])',
          }),
    },
  };
}
async function save(db, revision, f) {
  return db.write(revision, (tx) =>
    persistGeneration(tx, f.conversation, f.artifact, f.generation),
  );
}
test("schema initializes; successful work, theme, prompts and active selection survive reopening", async () => {
  const name = crypto.randomUUID();
  let db = new WorkspaceStorage(name);
  assert.deepEqual((await db.index()).artifacts, []);
  await save(db, 0, fixture(1, null, "interface"));
  await db.close();
  db = new WorkspaceStorage(name);
  const loaded = await db.load("a");
  assert.equal(loaded.generations[0].theme, "modern");
  assert.equal(loaded.generations[0].instruction, "Create purchase approval");
  assert.equal((await db.index()).activeArtifactId, "a");
  await db.close();
});
test("unlimited immutable versions and refinement from an older version", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  let rev = 0;
  for (let i = 1; i <= 5; i++)
    rev = await save(
      db,
      rev,
      fixture(i, i === 1 ? null : i === 5 ? "g1" : `g${i - 1}`),
    );
  const loaded = await db.load("a");
  assert.equal(loaded.generations.length, 5);
  assert.equal(loaded.generations[0].parentGenerationId, "g1");
  assert.equal(
    loaded.generations.at(-1).snapshot.document.title,
    purchaseFixture.title,
  );
  await db.close();
});
test("manual working document is separate from original snapshot and restores geometry", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  await save(db, 0, fixture());
  const changed = structuredClone(snapshot);
  changed.document.nodes[0].label = "Edited start";
  changed.document.edges[0].target = changed.document.nodes.at(-1).id;
  changed.document.edges[0].label = "Manual branch";
  changed.positions[changed.document.nodes[0].id] = { x: 100, y: 80 };
  await db.write(1, async (tx) => {
    await tx
      .objectStore("working")
      .put({ generationId: "g1", snapshot: changed, updatedAt: now });
  });
  const loaded = await db.load("a");
  assert.equal(
    loaded.working[0].snapshot.document.nodes[0].label,
    "Edited start",
  );
  assert.notEqual(
    loaded.generations[0].snapshot.document.nodes[0].label,
    "Edited start",
  );
  assert.equal(
    loaded.working[0].snapshot.document.edges[0].label,
    "Manual branch",
  );
  assert.equal(
    loaded.working[0].snapshot.document.edges[0].target,
    changed.document.nodes.at(-1).id,
  );
  assert.notEqual(
    loaded.generations[0].snapshot.document.edges[0].label,
    "Manual branch",
  );
  await db.close();
});
test("transaction failures roll back generation and artifact pointers", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  await save(db, 0, fixture());
  await assert.rejects(
    db.write(1, async (tx) => {
      await tx.objectStore("artifacts").delete("a");
      throw new Error("quota failure");
    }),
    /quota/,
  );
  assert.equal((await db.load("a")).generations.length, 1);
  assert.equal((await db.index()).revision, 1);
  await db.close();
});
test("conflicting tabs and stale version numbering cannot overwrite newer work", async () => {
  const name = crypto.randomUUID(),
    a = new WorkspaceStorage(name),
    b = new WorkspaceStorage(name);
  await save(a, 0, fixture());
  await assert.rejects(save(b, 0, fixture(2, "g1")), /Another tab/);
  await assert.rejects(save(b, 1, fixture(3, "g1")), /newer version/);
  assert.equal((await a.load("a")).generations.length, 1);
  await a.close();
  await b.close();
});
test("missing parents do not create partial records", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  await assert.rejects(save(db, 0, fixture(1, "missing")), /base version/);
  assert.equal((await db.index()).artifacts.length, 0);
  await db.close();
});
test("rename retains IDs; deletion cascades generations and working state atomically", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  await save(db, 0, fixture());
  await db.write(1, async (tx) => {
    const a = await tx.objectStore("artifacts").get("a");
    await tx.objectStore("artifacts").put({ ...a, title: "Renamed" });
    await tx
      .objectStore("working")
      .put({ generationId: "g1", snapshot, updatedAt: now });
  });
  assert.equal((await db.load("a")).artifact.title, "Renamed");
  await db.write(2, (tx) => removeArtifacts(tx, ["a"]));
  const b = await db.backup();
  assert.equal(b.generations.length, 0);
  assert.equal(b.working.length, 0);
  assert.equal((await db.index()).activeArtifactId, null);
  await db.close();
});
test("backup round trip, duplicate import and collision remapping preserve relationships", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  await save(db, 0, fixture());
  await save(db, 1, fixture(2, "g1"));
  const b = validateBackup(await db.backup());
  assert.equal(mergeBackup(b, b).artifacts.length, 0);
  const changed = structuredClone(b);
  changed.artifacts[0].title = "Conflicting";
  const remapped = mergeBackup(changed, b);
  assert.notEqual(remapped.artifacts[0].id, "a");
  assert.doesNotThrow(() => validateBackup(remapped));
  assert.equal(
    remapped.generations.find((g) => g.version === 2).parentGenerationId,
    remapped.generations.find((g) => g.version === 1).id,
  );
  const other = new WorkspaceStorage(crypto.randomUUID());
  await other.write(0, async (tx) => {
    for (const key of [
      "projects",
      "conversations",
      "artifacts",
      "generations",
      "working",
    ])
      for (const item of b[key]) await tx.objectStore(key).add(item);
  });
  assert.equal((await other.load("a")).generations.length, 2);
  await db.close();
  await other.close();
});
test("malformed, duplicate, incompatible and dangling backup records are rejected", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  await save(db, 0, fixture());
  const b = await db.backup();
  for (const broken of [
    { ...b, formatVersion: 9 },
    { ...b, generations: [] },
    { ...b, artifacts: [...b.artifacts, ...b.artifacts] },
    { ...b, secrets: "not accepted" },
  ])
    assert.throws(() => validateBackup(broken));
  await db.close();
});
test("local titles are meaningful and bounded; unsupported generation types rejected", () => {
  assert.equal(
    localTitle("Create a customer analytics dashboard."),
    "Customer analytics dashboard",
  );
  assert.ok(localTitle("Build a " + "long ".repeat(50)).length <= 72);
  assert.equal(
    generationSchema.safeParse({ ...fixture().generation, type: "html" })
      .success,
    false,
  );
});

test("mixed-artifact project deletion preserves unrelated unfiled work", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  await db.write(0, async (tx) => {
    await tx
      .objectStore("projects")
      .add({ id: "p", name: "Project", createdAt: now, updatedAt: now });
  });
  const flow = fixture();
  flow.conversation.projectId = "p";
  await save(db, 1, flow);
  const ui = fixture(1, null, "interface");
  ui.artifact.id = "ui";
  ui.generation.id = "ui-g1";
  ui.generation.artifactId = "ui";
  ui.artifact.activeGenerationId = "ui-g1";
  ui.artifact.latestGenerationId = "ui-g1";
  ui.conversation.projectId = "p";
  await save(db, 2, ui);
  const outside = fixture();
  outside.artifact.id = "outside";
  outside.artifact.conversationId = "other-c";
  outside.conversation.id = "other-c";
  outside.generation.id = "outside-g";
  outside.generation.artifactId = "outside";
  outside.artifact.activeGenerationId = "outside-g";
  outside.artifact.latestGenerationId = "outside-g";
  await save(db, 3, outside);
  await db.write(4, async (tx) => {
    const cs = await tx
      .objectStore("conversations")
      .index("projectId")
      .getAll("p");
    const ids = [];
    for (const c of cs)
      ids.push(
        ...(await tx
          .objectStore("artifacts")
          .index("conversationId")
          .getAllKeys(c.id)),
      );
    await removeArtifacts(tx, ids);
    for (const c of cs) await tx.objectStore("conversations").delete(c.id);
    await tx.objectStore("projects").delete("p");
  });
  const index = await db.index();
  assert.equal(index.projects.length, 0);
  assert.deepEqual(
    index.artifacts.map((a) => a.id),
    ["outside"],
  );
  await db.close();
});
test("metadata queries do not need generation payloads; local search uses titles", async () => {
  const db = new WorkspaceStorage(crypto.randomUUID());
  await save(db, 0, fixture());
  await db.write(1, async (tx) => {
    const a = await tx.objectStore("artifacts").get("a");
    await tx.objectStore("artifacts").put({ ...a, title: "Claims dashboard" });
  });
  const idx = await db.index();
  assert.equal(
    idx.artifacts.filter((a) =>
      a.title.toLowerCase().includes(" CLAIM ".trim().toLowerCase()),
    ).length,
    1,
  );
  assert.equal("program" in idx.artifacts[0], false);
  await db.close();
});
test("targeted refinement metadata survives local reopen without altering prior versions", async () => {
  const name=crypto.randomUUID();let db=new WorkspaceStorage(name);
  await save(db,0,fixture(1,null,"interface"));
  const next=fixture(2,"g1","interface");
  next.generation.refinement={kind:"selection",targetId:"chart",component:"Chart",parentId:"section"};
  next.generation.program='root = Page([Heading("Updated")])';
  await save(db,1,next);await db.close();db=new WorkspaceStorage(name);
  const loaded=await db.load("a"),second=loaded.generations.find(g=>g.id==='g2'),first=loaded.generations.find(g=>g.id==='g1');
  assert.equal(second.parentGenerationId,'g1');
  assert.deepEqual(second.refinement,next.generation.refinement);
  assert.equal(first.refinement,undefined);assert.equal(first.program,'root = Page([Heading("Example")])');
  await db.close();
});
