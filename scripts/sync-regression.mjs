import assert from "node:assert/strict";
import sync from "../phone-balance/js/sync-core.js";

const remote = {
  modifiedAt: "2026-10-01T01:26:12.536Z",
  lastUpdated: "2026-10-01T01:26:12.536Z",
  accounts: [
    {
      id: "broadcasting-19290397571",
      balance: 12.34,
      modifiedAt: "2026-09-30T17:26:12.536Z"
    }
  ],
  accountDefaults: {}
};

const defaultsAfterStartupSettlement = {
  modifiedAt: "2026-10-01T01:30:00.000Z",
  lastUpdated: "2026-10-01T01:30:00.000Z",
  accounts: [
    {
      id: "broadcasting-19290397571",
      balance: 47.68,
      modifiedAt: "2026-10-01T01:30:00.000Z"
    }
  ],
  accountDefaults: {}
};

const freshBrowser = sync.resolveInitialState(defaultsAfterStartupSettlement, remote, false);
assert.equal(freshBrowser.source, "remote");
assert.equal(freshBrowser.shouldPush, false);
assert.equal(freshBrowser.state.accounts[0].balance, 12.34);

const deviceA = {
  modifiedAt: "2026-10-01T02:00:00.000Z",
  lastUpdated: "2026-10-01T02:00:00.000Z",
  accounts: [
    { id: "a", balance: 88, modifiedAt: "2026-10-01T02:00:00.000Z" },
    { id: "b", balance: 20, modifiedAt: "2026-10-01T01:00:00.000Z" }
  ],
  accountDefaults: {}
};
const deviceB = {
  modifiedAt: "2026-10-01T02:01:00.000Z",
  lastUpdated: "2026-10-01T02:01:00.000Z",
  accounts: [
    { id: "a", balance: 10, modifiedAt: "2026-10-01T01:00:00.000Z" },
    { id: "b", balance: 77, modifiedAt: "2026-10-01T02:01:00.000Z" }
  ],
  accountDefaults: {}
};
const merged = sync.mergeStatesByAccount(deviceA, deviceB);
assert.equal(merged.accounts.find((account) => account.id === "a").balance, 88);
assert.equal(merged.accounts.find((account) => account.id === "b").balance, 77);

console.log("sync regression passed: fresh cloud hydration and account-level merge");
