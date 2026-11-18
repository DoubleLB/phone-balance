import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const workerUrl = new URL("./wxpusher-notify.mjs", import.meta.url).href;
const billingUrl = new URL("../phone-balance/js/billing-core.js", import.meta.url).href;
for (const scenario of ["active", "paused-before", "disabled-before", "closed-during", "disabled-during", "closed-initial", "disabled-initial", "dry-run"]) {
  const source = `
    import assert from 'node:assert/strict';
    import billing from ${JSON.stringify(billingUrl)};
    const scenario = ${JSON.stringify(scenario)};
    const today = billing.localDateKeyFromDate(new Date());
    const initial = { id: 'china_broadcasting', updated_at: 'v1', data: { notificationHistory: {}, accounts: [
      { id: 'a', number: 'test', carrier: 'unicom', billingType: 'daily', dailyCharge: 1,
        status: 'active', balance: 1, lastSettledDate: billing.addDays(today, -2),
        warningEnabled: true, warningMode: 'balance', warningThreshold: 8, modifiedAt: '2026-01-01T00:00:00Z' }
    ] } };
    if (scenario === 'closed-initial') initial.data.accounts[0].status = 'closed';
    if (scenario === 'disabled-initial') initial.data.accounts[0].warningEnabled = false;
    let row = structuredClone(initial);
    if (scenario === 'paused-before') {
      row.data.accounts[0] = { ...row.data.accounts[0], status: 'paused', hidden: true, balance: 35 };
      row.data.accounts.push({ id: 'new', status: 'closed', balance: 999 });
    }
    if (scenario === 'disabled-before') row.data.accounts[0].warningEnabled = false;
    let reads = 0, patches = 0, wx = 0, server = 0;
    globalThis.fetch = async (input, options = {}) => {
      const url = new URL(input);
      if (url.hostname.endsWith('supabase.co')) {
        if (!options.method || options.method === 'GET') {
          return Response.json([structuredClone(reads++ === 0 ? initial : row)]);
        }
        assert.equal(options.method, 'PATCH');
        if (++patches === 1) { row.updated_at = 'v2'; return Response.json([]); }
        assert.equal(url.searchParams.get('updated_at'), 'eq.v2');
        row = { ...row, ...JSON.parse(options.body) };
        return Response.json([row]);
      }
      if (url.hostname === 'wxpusher.zjiecode.com') {
        wx++;
        if (scenario === 'closed-during') row.data.accounts[0].status = 'closed';
        if (scenario === 'disabled-during') row.data.accounts[0].warningEnabled = false;
        return Response.json({ code: 1000, success: true, data: [{ code: 1000 }] });
      }
      if (url.hostname === 'sctapi.ftqq.com') { server++; return Response.json({ code: 0 }); }
      throw new Error('Unexpected real network request: ' + input);
    };
    await import(${JSON.stringify(workerUrl)});
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(process.exitCode || 0, 0);
    assert.equal(patches, ['closed-initial', 'dry-run'].includes(scenario) ? 0 : 2, 'Conditional conflicts must be retried; dry-run must be read-only');
    assert.equal(wx, ['active', 'closed-during', 'disabled-during'].includes(scenario) ? 1 : 0);
    assert.equal(server, scenario === 'active' ? 1 : 0, 'Do not send a second channel after account opt-out');
    if (scenario === 'paused-before') {
      assert.equal(row.data.accounts[0].status, 'paused');
      assert.equal(row.data.accounts[0].balance, 35);
      assert.equal(row.data.accounts[1].balance, 999);
    } else if (scenario !== 'closed-initial' && scenario !== 'dry-run') {
      assert.equal(row.data.accounts[0].balance, scenario === 'closed-during' ? 1 : 0, 'Only active cloud accounts are settled');
      if (wx) assert.ok(row.data.notificationHistory.a.warningLastNotifiedAt);
    }
    if (scenario.startsWith('disabled')) assert.equal(row.data.accounts[0].warningEnabled, false);
    if (scenario === 'closed-during') assert.equal(row.data.accounts[0].status, 'closed');
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8", env: { ...process.env, WXPUSHER_APP_TOKEN: "mock", WXPUSHER_UIDS: "mock",
      SERVERCHAN_SENDKEY: "mock", DRY_RUN: scenario === "dry-run" ? "1" : "0" }
  });
  assert.equal(result.status, 0, scenario + "\n" + result.stdout + result.stderr);
}
console.log("Worker regression passed: stop/disable before and during dispatch, read-only dry-run, CAS retries and both channels");
