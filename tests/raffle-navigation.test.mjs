import assert from "node:assert/strict";
import test from "node:test";

const navigation = await import("../lib/raffle-navigation.mjs").catch(() => ({}));

test("saved event raffle navigation uses its backend source ID", () => {
  assert.equal(navigation.getRaffleHref?.({ sourceId: "hashed-slug" }), "/events/hashed-slug/raffle");
});

test("unsaved events have no raffle destination", () => {
  assert.equal(navigation.getRaffleHref?.({ title: "Draft" }), null);
});
