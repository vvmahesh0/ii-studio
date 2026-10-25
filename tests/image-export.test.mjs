import test from "node:test";
import assert from "node:assert/strict";
import {
  captureDimensions,
  pngFilename,
  copyPng,
  PNG,
} from "../app/lib/image/png.ts";
const blob = new Blob(["png-test"], { type: PNG });
test("pending browser clipboard writes release the action with a download fallback", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = copyPng(async () => blob, {
    secure: true,
    Item,
    write: () => new Promise(() => {}),
  });
  const rejected = assert.rejects(pending, /Export PNG/);
  t.mock.timers.tick(10000);
  await rejected;
});
class Item {
  static supports(type) {
    return type === PNG;
  }
  constructor(data) {
    this.data = data;
  }
}
test("capture keeps desktop dimensions and chooses a bounded high resolution", () => {
  const s = captureDimensions(1280, 2400);
  assert.equal(s.width, 1280);
  assert.equal(s.height, 2400);
  assert.equal(s.pixelRatio, 2);
  const tall = captureDimensions(1280, 10000);
  assert.ok(tall.pixelRatio >= 1);
  assert.ok(tall.width * tall.height * tall.pixelRatio ** 2 <= 24_000_001);
});
test("oversized, empty and nonfinite captures fail instead of cropping or shrinking", () => {
  for (const [w, h] of [
    [0, 12],
    [NaN, 20],
    [Infinity, 20],
    [1280, 20000],
    [9000, 9000],
  ])
    assert.throws(() => captureDimensions(w, h));
});
test("artifact filenames are descriptive and cannot contain path separators", () => {
  assert.equal(pngFilename("Customer dashboard"), "customer-dashboard.png");
  assert.equal(pngFilename("../../Report: Q1?"), "report-q1.png");
  assert.equal(pngFilename(""), "interface.png");
  assert.equal(pngFilename("顧客 概要"), "顧客-概要.png");
});
test("clipboard write starts before asynchronous capture, and resolves only after PNG written", async () => {
  const calls = [];
  await copyPng(
    async () => {
      calls.push("capture");
      return blob;
    },
    {
      secure: true,
      Item,
      write: async (items) => {
        calls.push("write");
        assert.equal((await items[0].data[PNG]).type, PNG);
        calls.push("written");
      },
    },
  );
  assert.deepEqual(calls, ["write", "capture", "written"]);
});
test("unsupported or insecure clipboard never reports copied and offers Export PNG", async () => {
  for (const env of [
    { secure: false, Item, write: async () => {} },
    { secure: true },
    {
      secure: true,
      Item: class extends Item {
        static supports() {
          return false;
        }
      },
      write: async () => {},
    },
  ])
    await assert.rejects(
      copyPng(async () => blob, env),
      /Export PNG/,
    );
});
test("permission rejection waits for capture cleanup and explains fallback", async () => {
  let settled = false;
  await assert.rejects(
    copyPng(
      async () => {
        await Promise.resolve();
        settled = true;
        return blob;
      },
      {
        secure: true,
        Item,
        write: async () => {
          throw new Error("NotAllowedError");
        },
      },
    ),
    /Clipboard access was blocked/,
  );
  assert.equal(settled, true);
});
test("capture failure is not disguised as a clipboard permission failure", async () => {
  await assert.rejects(
    copyPng(
      async () => {
        throw new Error("Image too large");
      },
      {
        secure: true,
        Item,
        write: async (items) => {
          await items[0].data[PNG];
        },
      },
    ),
    /Image too large/,
  );
});
test("synchronous clipboard rejection also cleans up promised capture", async () => {
  let captured = false;
  await assert.rejects(
    copyPng(
      async () => {
        captured = true;
        return blob;
      },
      {
        secure: true,
        Item,
        write: () => {
          throw new Error("denied");
        },
      },
    ),
    /Export PNG/,
  );
  assert.equal(captured, true);
});
