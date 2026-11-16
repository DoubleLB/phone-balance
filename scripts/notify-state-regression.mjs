import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const workerUrl = new URL("./wxpusher-notify.mjs", import.meta.url).href;
const billingUrl = new URL("../phone-balance/js/billing-core.js", import.meta.url).href;
for (const stopped of [true, false]) {
  const source = `
    import assert from 'node:assert/strict';
    import billing from ${JSON.stringify(billingUrl)};
    const stopped = ${stopped};
    const today = billing.localDateKeyFromDate(new Date());
    const initial = { id: 'china_broadcasting', updated_at: 'v1', data: { notificationHistory: {}, accounts: [
      { id: 'a', number: 'test', carrier: 'unicom', billingType: 'daily', dailyCharge: 1,
        status: 'active', balance: 1, lastSettledDate: billing.addDays(today, -2),
        warningEnabled: true, warningMode: 'balance', warningThreshold: 8, modifiedAt: '2026-01-01T00:00:00Z' }
    ] } };
    let row = structuredClone(initial);
    if (stopped) {
      row.data.accounts[0] = { ...row.data.accounts[0], status: 'paused', hidden: true, balance: 35 };
      row.data.accounts.push({ id: 'new', status: 'closed', balance: 999 });
    }
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
      if (url.hostname === 'wxpusher.zjiecode.com') { wx++; return Response.json({ code: 1000, success: true, data: [{ code: 1000 }] }); }
      if (url.hostname === 'sctapi.ftqq.com') { server++; return Response.json({ code: 0 }); }
      throw new Error('Unexpected real network request: ' + input);
    };
    await import(${JSON.stringify(workerUrl)});
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(process.exitCode || 0, 0);
    assert.equal(patches, 2, 'Conditional conflicts must be retried');
    assert.equal(wx, stopped ? 0 : 1);
    assert.equal(server, stopped ? 0 : 1);
    if (stopped) {
      assert.equal(row.data.accounts[0].status, 'paused');
      assert.equal(row.data.accounts[0].balance, 35);
      assert.equal(row.data.accounts[1].balance, 999);
    } else {
      assert.equal(row.data.accounts[0].balance, 0, 'Latest cloud data is settled once');
      assert.ok(row.data.notificationHistory.a.warningLastNotifiedAt);
    }
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", source], {
    encoding: "utf8", env: { ...process.env, WXPUSHER_APP_TOKEN: "mock", WXPUSHER_UIDS: "mock",
      SERVERCHAN_SENDKEY: "mock", DRY_RUN: "0" }
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}
console.log("Worker regression passed: stopped accounts, concurrent config, CAS retries and both channels");
