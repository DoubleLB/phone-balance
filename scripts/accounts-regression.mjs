import assert from "node:assert/strict";
import billing from "../phone-balance/js/billing-core.js";
import accounts from "../phone-balance/js/accounts-core.js";
import sync from "../phone-balance/js/sync-core.js";

for (const status of ["paused", "closed"]) {
  for (const billingType of ["daily", "monthly", "monthEnd"]) {
    const account = { id: "test", status, balance: 35, billingType,
      dailyCharge: 1, monthlyCharge: 59, lastSettledDate: "2026-10-15",
      warningEnabled: true, warningThreshold: 100 };
    assert.equal(billing.settleAccount(account, "2026-11-16"), false);
    assert.equal(account.balance, 35);
    assert.equal(billing.chargeForDate(account, "2026-10-31"), 0);
    assert.equal(billing.warningStatus(account, "2026-11-16").triggered, false);
    assert.equal(accounts.monthlyCost(account, 30), 0);
  }
}

const resumed = { id: "unicom", status: "paused", balance: 35,
  billingType: "daily", dailyCharge: 1, lastSettledDate: "2026-10-15" };
accounts.changeStatus(resumed, "active", "2026-11-16", billing);
assert.equal(resumed.lastSettledDate, "2026-11-15");
billing.settleAccount(resumed, "2026-11-17");
assert.equal(resumed.balance, 34, "No back-charging for the pause interval");
accounts.changeStatus(resumed, "paused", "2026-11-18", billing);
assert.equal(resumed.balance, 33, "Charges settle only through yesterday before pausing");

const deleted = { id: "a", deleted: true, modifiedAt: "2026-11-15T12:00:00Z" };
const stale = { id: "a", balance: 99, modifiedAt: "2026-11-16T12:00:00Z" };
assert.equal(sync.mergeRecordLists([stale], [deleted])[0].deleted, true);
assert.equal(sync.mergeRecordLists([deleted], [stale])[0].deleted, true);
const pausedCloud = { id: "a", status: "paused", balance: 35, userModifiedAt: "2026-11-15T12:00:00Z", modifiedAt: "2026-11-15T12:00:00Z" };
assert.equal(sync.mergeRecordLists([stale], [pausedCloud])[0].status, "paused", "Stale automatic billing cannot undo a pause");
const normalize = (input) => input;
const seeds = [{ id: "default", carrier: "unicom" }];
assert.deepEqual(accounts.normalizeAccounts([], seeds, { unicom: {} }, normalize), []);
assert.equal(accounts.normalizeAccounts(undefined, seeds, { unicom: {} }, normalize).length, 1);
assert.equal(accounts.normalizeAccounts([{ id: "custom", carrier: "unicom" }], seeds, { unicom: {} }, normalize)[0].id, "custom");
assert.equal(accounts.isVisible({ status: "paused" }), true);
assert.equal(accounts.isVisible({ hidden: true }), false);
assert.equal(accounts.monthlyCost({ hidden: true, billingType: "daily", dailyCharge: 1 }, 30), 30,
  "Hiding an active account does not stop its billing");
assert.equal(billing.warningStatus({ deleted: true, balance: -100, warningEnabled: true }, "2026-11-16").triggered, false);
console.log("accounts regression passed: pause, close, resume, hide, delete, dynamic list and sync");
