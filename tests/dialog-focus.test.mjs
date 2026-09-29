import assert from "node:assert/strict";
import test from "node:test";

import { restoreDialogFocus } from "../lib/dialog-focus.mjs";

test("closing a dialog focuses its connected invoking button", () => {
  const calls = [];
  const event = { preventDefault: () => calls.push("prevent default") };
  const opener = { isConnected: true, focus: () => calls.push("opener") };
  const fallback = { isConnected: true, focus: () => calls.push("fallback") };

  restoreDialogFocus(event, opener, fallback);

  assert.deepEqual(calls, ["prevent default", "opener"]);
});

test("closing after a row is deleted focuses Add Scanner", () => {
  const calls = [];
  const event = { preventDefault: () => calls.push("prevent default") };
  const removedButton = { isConnected: false, focus: () => calls.push("removed button") };
  const addButton = { isConnected: true, focus: () => calls.push("Add Scanner") };

  restoreDialogFocus(event, removedButton, addButton);

  assert.deepEqual(calls, ["prevent default", "Add Scanner"]);
});

test("closing a voting confirmation while its action is disabled focuses the stable page control", () => {
  const calls = [];
  restoreDialogFocus(
    { preventDefault: () => calls.push("prevent default") },
    { isConnected: true, disabled: true, focus: () => calls.push("disabled action") },
    { isConnected: true, focus: () => calls.push("page control") },
  );
  assert.deepEqual(calls, ["prevent default", "page control"]);
});

test("closing after the voting page unmounts does not focus a detached or disabled fallback", () => {
  for (const fallback of [{ isConnected: false }, { isConnected: true, disabled: true }]) {
    const calls = [];
    restoreDialogFocus(
      { preventDefault: () => calls.push("prevent default") },
      null,
      { ...fallback, focus: () => calls.push("fallback") },
    );
    assert.deepEqual(calls, []);
  }
});
