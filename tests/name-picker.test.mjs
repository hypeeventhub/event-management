import assert from "node:assert/strict";
import test from "node:test";
import { createNamePickerModel } from "../lib/name-picker.mjs";

test("models a pool of 1005 names without producing one visual item per name", () => {
  const entries = Array.from({ length: 1005 }, (_, index) => ({ id: index + 1, name: `Guest ${index + 1}` }));
  assert.deepEqual(createNamePickerModel(entries), { count: 1005, initialName: "Guest 1" });
  assert.deepEqual(createNamePickerModel(entries, { id: 900, name: "Selected Guest" }), { count: 1005, initialName: "Selected Guest" });
});
