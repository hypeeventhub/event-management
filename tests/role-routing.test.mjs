import assert from "node:assert/strict";
import test from "node:test";

import { canAccessRoute, getNavigationForRole, getRoleHome } from "../lib/role-routing.mjs";

test("role homes are exact and unknown roles have no protected destination", () => {
  assert.equal(getRoleHome("Admin"), "/");
  assert.equal(getRoleHome("Scanner"), "/scanner");
  assert.equal(getRoleHome("admin"), null);
  assert.equal(getRoleHome(null), null);
});

test("admins can access scanner tools while scanner accounts stay restricted", () => {
  assert.equal(canAccessRoute("Admin", "/"), true);
  assert.equal(canAccessRoute("Admin", "/manage-users"), true);
  assert.equal(canAccessRoute("Admin", "/scanner"), true);
  assert.equal(canAccessRoute("Admin", "/settings"), true);
  assert.equal(canAccessRoute("Admin", "/events/sample/raffle"), true);
  assert.equal(canAccessRoute("Admin", "/events/sample/raffle/extra"), false);
  assert.equal(canAccessRoute("Scanner", "/scanner"), true);
  assert.equal(canAccessRoute("Scanner", "/settings"), true);
  assert.equal(canAccessRoute("Scanner", "/"), false);
  assert.equal(canAccessRoute("Scanner", "/manage-users"), false);
  assert.equal(canAccessRoute("Scanner", "/events/sample/raffle"), false);
  assert.equal(canAccessRoute("Operator", "/scanner"), false);
});

test("admins receive scanner navigation while scanner accounts remain limited", () => {
  assert.deepEqual(getNavigationForRole("Admin"), [
    { label: "Dashboard", href: "/" },
    { label: "Check In & Scanner", href: "/scanner" },
  ]);
  assert.deepEqual(getNavigationForRole("Scanner"), [
    { label: "Check In & Scanner", href: "/scanner" },
  ]);
  assert.deepEqual(getNavigationForRole("Operator"), []);
});

test("only admins can access voting administration and nested leaderboards", () => {
  assert.equal(canAccessRoute("Admin", "/events/gala/voting"), true);
  assert.equal(canAccessRoute("Admin", "/events/gala/voting/award/leaderboard"), true);
  assert.equal(canAccessRoute("Admin", "/events/gala/voting/award/leaderboard/extra"), false);
  assert.equal(canAccessRoute("Scanner", "/events/gala/voting"), false);
  assert.equal(canAccessRoute("Scanner", "/events/gala/voting/award/leaderboard"), false);
  assert.equal(canAccessRoute("Operator", "/events/gala/voting"), false);
});
