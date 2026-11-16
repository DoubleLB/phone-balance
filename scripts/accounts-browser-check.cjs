const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

async function main() {
  const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}) });
  try {
    let row = { id: "china_broadcasting", updated_at: "2026-11-16T00:00:00Z", data: {
      modifiedAt: "2026-11-16T00:00:00Z", lastUpdated: "2026-11-16T00:00:00Z",
      accounts: [{ id: "unicom-02901185603", carrier: "unicom", number: "02901185603", type: "宽带账号",
        billingType: "daily", dailyCharge: 1, balance: 35, warningThreshold: 7,
        lastSettledDate: "2026-11-15", modifiedAt: "2026-11-16T00:00:00Z" }], accountDefaults: {} } };
    let version = 0;
    const errors = [];
    const clone = (value) => JSON.parse(JSON.stringify(value));
    async function newDevice(width = 390) {
      const context = await browser.newContext({ viewport: { width, height: 844 } });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.clock.install({ time: new Date("2026-11-16T12:00:00Z") });
      await page.route("https://**/*", async (route) => {
        const url = new URL(route.request().url());
        if (url.hostname.endsWith("supabase.co")) {
          const method = route.request().method();
          if (method === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
          if (method === "PATCH") {
            if (url.searchParams.get("updated_at") !== "eq." + row.updated_at) return route.fulfill({ json: [] });
            const body = route.request().postDataJSON();
            row = clone(body);
            row.updated_at = `2026-11-16T12:00:${String(++version).padStart(2, "0")}Z`;
          } else assert.equal(method, "GET", "Existing cloud state must not be overwritten by POST");
          return route.fulfill({ headers: { "access-control-allow-origin": "*" }, json: [row] });
        }
        const relative = decodeURIComponent(url.pathname).replace(/^\//, "") || "index.html";
        const file = path.resolve(__dirname, "../phone-balance", relative);
        const body = await fs.readFile(file);
        const contentType = relative.endsWith(".js") ? "text/javascript" : relative.endsWith(".css") ? "text/css" : relative.endsWith(".svg") ? "image/svg+xml" : "text/html";
        return route.fulfill({ body, contentType });
      });
      await page.goto("https://balance.test/index.html#home");
      await page.waitForFunction(() => document.getElementById("syncMode").textContent === "云端");
      return { page, context };
    }
    async function waitVersion(before) {
      for (let i = 0; i < 200; i++) {
        if (version > before) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error("Cloud mutation did not complete");
    }

    const a = await newDevice();
    assert.equal(await a.page.locator("#overviewAccounts").textContent(), "1 个");
    await a.page.locator("#accountManager summary").click();
    await a.page.locator('[data-action="edit-account"]').click();
    await a.page.locator("#accountStatus").selectOption("paused");
    await a.page.locator("#accountHidden").check();
    let before = version;
    await a.page.locator("#saveAccountBtn").click();
    await waitVersion(before);
    assert.equal(row.data.accounts[0].status, "paused");
    assert.equal(row.data.accounts[0].hidden, true);
    assert.equal(row.data.accounts[0].balance, 35);
    assert.equal(await a.page.locator("#overviewAccounts").textContent(), "0 个");
    const b = await newDevice(320);
    assert.equal(await b.page.locator("#overviewAccounts").textContent(), "0 个");
    await b.page.locator("#accountManager summary").click();
    assert.match(await b.page.locator("#managedAccounts").textContent(), /已停用.*已隐藏/);
    await b.page.locator('[data-action="toggle-account"]').click();
    await b.page.waitForFunction(() => document.getElementById("overviewAccounts").textContent === "1 个");
    await b.page.waitForFunction(() => document.getElementById("syncMode").textContent === "云端");
    await b.page.locator('[data-action="toggle-carrier"][data-carrier="unicom"]').click();
    if (!await b.page.locator('[data-action="detail"]').count()) throw new Error(JSON.stringify({ errors, row, html: await b.page.locator("#carrierList").innerHTML() }));
    await b.page.locator('[data-action="detail"]').click();
    await b.page.waitForFunction(() => document.getElementById("accountStatusPill").textContent === "已停用");
    assert.equal(await b.page.locator("#detailBalance").textContent(), "35.00");
    await b.page.locator("#editAccountBtn").click();
    await b.page.locator("#accountNumber").fill("02901185604");
    before = version;
    await b.page.locator("#saveAccountBtn").click();
    await waitVersion(before);
    assert.equal(row.data.accounts[0].number, "02901185604");
    await b.page.locator("#newAccountBtn").click();
    await b.page.locator("#accountNumber").fill("13900000001");
    await b.page.locator("#accountCarrier").selectOption("mobile");
    await b.page.locator("#accountFee").fill("8");
    await b.page.locator("#accountBalance").fill("100");
    before = version;
    await b.page.locator("#saveAccountBtn").click();
    await waitVersion(before);
    const custom = row.data.accounts.find((account) => account.number === "13900000001");
    assert.ok(custom);
    assert.equal(custom.billingType, "monthEnd");
    assert.equal(await b.page.locator("#overviewMonthlyCost").textContent(), "8.00");
    await b.page.reload();
    await b.page.waitForFunction(() => document.getElementById("syncMode").textContent === "云端");
    assert.equal(await b.page.locator("#overviewAccounts").textContent(), "2 个");
    await b.page.locator("#accountManager summary").click();
    for (const width of [320, 390, 640]) {
      await b.page.setViewportSize({ width, height: 844 });
      assert.ok(await b.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `No overflow at ${width}`);
    }
    await b.page.emulateMedia({ colorScheme: "dark" });
    await b.page.screenshot({ path: path.join(require("node:os").tmpdir(), "phone-balance-accounts-dark.png"), fullPage: true, animations: "disabled" });
    b.page.on("dialog", (dialog) => dialog.accept());
    before = version;
    await b.page.locator(`[data-action="delete-account"][data-id="${custom.id}"]`).click();
    await waitVersion(before);
    assert.equal(row.data.accounts.find((account) => account.id === custom.id).deleted, true);
    await b.page.reload();
    await b.page.waitForFunction(() => document.getElementById("syncMode").textContent === "云端");
    assert.equal(await b.page.locator("#overviewAccounts").textContent(), "1 个");
    assert.equal(row.data.accounts.length, 2, "Default accounts must not be recreated");
    await b.page.locator("#accountManager summary").click();
    before = version;
    await b.page.locator('[data-action="delete-account"]').click();
    await waitVersion(before);
    const emptyDevice = await newDevice();
    assert.equal(await emptyDevice.page.locator("#overviewAccounts").textContent(), "0 个");
    await emptyDevice.page.goto("https://balance.test/index.html#account=unicom-02901185603");
    await emptyDevice.page.waitForFunction(() => window.location.hash === "#home");
    assert.deepEqual(errors, []);
    console.log("Browser check passed: two-device pause/hide/edit/add/delete, reload, mobile layouts and dark theme");
  } finally { await browser.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
