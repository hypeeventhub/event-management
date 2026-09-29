import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const navigation = await import("../lib/voting-navigation.mjs").catch(() => ({}));

test("saved event voting navigation uses the encoded backend source ID", () => {
  assert.equal(navigation.getVotingHref?.({ sourceId: "event/annual gala?" }), "/events/event%2Fannual%20gala%3F/voting");
});

test("unsaved events have no voting destination", () => {
  assert.equal(navigation.getVotingHref?.({ title: "Draft" }), null);
  assert.equal(navigation.getVotingHref?.(null), null);
});

test("voting route layouts provide page titles without wrapping their content", async () => {
  const routes = [
    ["../app/events/[id]/voting/layout.js", "Voting"],
    ["../app/events/[id]/voting/[subject]/leaderboard/layout.js", "Voting Leaderboard"],
    ["../app/vote/[slug]/layout.js", "Vote"],
  ];

  for (const [path, title] of routes) {
    const code = await readFile(new URL(path, import.meta.url), "utf8");
    const layout = await import(`data:text/javascript,${encodeURIComponent(code)}`);
    const child = { route: path };
    assert.equal(layout.metadata.title, title);
    assert.equal(layout.default({ children: child }), child);
  }
});
