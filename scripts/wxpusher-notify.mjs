import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const billing = require("../phone-balance/js/billing-core.js");
const {
  addDays,
  compareKeys,
  localDateKeyFromDate,
  partsFromKey,
  roundMoney,
  safeNumber,
  settleAccount,
  warningStatus
} = billing;

const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || "https://rhkzsyhxezlppfxqzalm.supabase.co",
  supabaseKey: process.env.SUPABASE_ANON_KEY || "sb_publishable_jg7Ht5A1SXFfkn4VZImQKA_eAHoh5uZ",
  table: process.env.SUPABASE_TABLE || "balance_state",
  rowId: process.env.SUPABASE_ROW_ID || "china_broadcasting",
  wxPusherAppToken: process.env.WXPUSHER_APP_TOKEN || "",
  wxPusherUids: String(process.env.WXPUSHER_UIDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  serverChanSendKey: process.env.SERVERCHAN_SENDKEY || process.env.SERVERCHAN_SEND_KEY || "",
  dryRun: String(process.env.DRY_RUN || "") === "1"
};

function log(message) {
  console.log(`[notify] ${message}`);
}

function fail(message) {
  console.error(`[notify] ${message}`);
  process.exitCode = 1;
}

function warn(message) {
  console.warn(`[notify] ${message}`);
}

function accountNotificationKey(account) {
  return account.id || `${account.carrier || "account"}-${account.number || "unknown"}`;
}

function latestIso(left, right) {
  const leftTime = new Date(left || 0).getTime();
  const rightTime = new Date(right || 0).getTime();
  if (!Number.isFinite(leftTime) || leftTime <= 0) return right || "";
  if (!Number.isFinite(rightTime) || rightTime <= 0) return left || "";
  return rightTime > leftTime ? right : left;
}

function notificationLastNotifiedAt(account, notificationState) {
  const records = notificationState && notificationState.accounts;
  const record = records && records[accountNotificationKey(account)];
  return latestIso(account.warningLastNotifiedAt, record && record.warningLastNotifiedAt);
}

function cooldownPassed(account, nowIso, notificationState) {
  const lastNotifiedAt = notificationLastNotifiedAt(account, notificationState);
  const last = new Date(lastNotifiedAt || 0).getTime();
  if (!Number.isFinite(last) || last <= 0) return true;
  const cooldownHours = Math.max(1, safeNumber(account.warningCooldownHours, 24));
  return new Date(nowIso).getTime() - last >= cooldownHours * 3600 * 1000;
}

function createNotificationState(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    schemaVersion: 1,
    updatedAt: source.updatedAt || "",
    accounts: source.accounts && typeof source.accounts === "object" && !Array.isArray(source.accounts)
      ? source.accounts
      : source && !source.schemaVersion
        ? source
        : {}
  };
}

function markNotificationSent(notificationState, account, nowIso, providers) {
  const state = createNotificationState(notificationState);
  state.accounts[accountNotificationKey(account)] = {
    warningLastNotifiedAt: nowIso,
    providers: providers || [],
    number: account.number || "",
    carrier: account.carrier || ""
  };
  state.updatedAt = nowIso;
  return state;
}

function mergeAccountNotificationHistory(notificationState, accounts) {
  const state = createNotificationState(notificationState);
  let changed = false;

  for (const account of accounts || []) {
    const key = accountNotificationKey(account);
    const accountLastNotifiedAt = account.warningLastNotifiedAt || "";
    const existing = state.accounts[key] || {};
    const latest = latestIso(existing.warningLastNotifiedAt, accountLastNotifiedAt);

    if (latest && latest !== existing.warningLastNotifiedAt) {
      state.accounts[key] = {
        ...existing,
        warningLastNotifiedAt: latest,
        number: existing.number || account.number || "",
        carrier: existing.carrier || account.carrier || ""
      };
      changed = true;
    }
  }

  if (changed) {
    state.updatedAt = new Date().toISOString();
  }

  return { state, changed };
}

function syncNotificationHistoryToMainState(state, notificationState) {
  const next = createNotificationState(notificationState);
  state.notificationHistory = next.accounts;
}

function formatChinaDate(key) {
  const parts = partsFromKey(key);
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

function buildTextPayload(account, status) {
  const type = account.type || "账号";
  const carrier = account.carrier || "运营商";
  const balanceText = status.mode === "afterCharge"
    ? `扣费后预计 ${status.postChargeBalance.toFixed(2)} 元`
    : status.mode === "balance"
      ? `余额 ${roundMoney(account.balance).toFixed(2)} 元`
      : `预计可用 ${status.daysLeft} 天`;

  return {
    title: `余额提醒 · ${carrier} ${account.number}`,
    lines: [
      `${carrier} ${account.number} (${type})`,
      balanceText,
      status.reason,
      status.mode === "afterCharge" && status.nextChargeDate
        ? `下次扣费日 ${formatChinaDate(status.nextChargeDate)}`
        : `预计可用至 ${formatChinaDate(status.until)}`,
      `检查时间 ${new Date().toLocaleString("zh-CN", { hour12: false, timeZone: "Asia/Shanghai" })}`
    ]
  };
}

function buildWxPusherMessage(payload) {
  return [payload.title, ...payload.lines].join("\n");
}

function buildServerChanPayload(payload) {
  return {
    title: payload.title,
    desp: [
      `## ${payload.title}`,
      "",
      ...payload.lines.map((line) => `- ${line}`)
    ].join("\n")
  };
}

async function requestJson(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  return json;
}

function normalizeToArray(value) {
  return Array.isArray(value) ? value : [];
}

function isWxPusherSendSuccess(result) {
  if (!result || result.code !== 1000 || result.success === false) {
    return false;
  }

  const items = normalizeToArray(result.data);
  if (!items.length) {
    return false;
  }

  return items.every((item) => item && item.code === 1000);
}

function isServerChanSendSuccess(result) {
  if (!result || typeof result !== "object") return false;
  return result.code === 0;
}

function getEnabledProviders() {
  const providers = [];

  if (CONFIG.wxPusherAppToken && CONFIG.wxPusherUids.length) {
    providers.push("wxpusher");
  }

  if (CONFIG.serverChanSendKey) {
    providers.push("serverchan");
  }

  return providers;
}

async function loadSupabaseRow(rowId) {
  const url = `${CONFIG.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${encodeURIComponent(CONFIG.table)}?id=eq.${encodeURIComponent(rowId)}&select=id,data,updated_at`;
  const response = await fetch(url, {
    headers: {
      apikey: CONFIG.supabaseKey,
      Authorization: `Bearer ${CONFIG.supabaseKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to load Supabase state: HTTP ${response.status}`);
  }

  const rows = await response.json();
  return rows && rows[0] ? rows[0] : null;
}

async function loadRemoteState() {
  return loadSupabaseRow(CONFIG.rowId);
}

async function saveRemoteState(data) {
  // Always settle the latest remote accounts, never upload a stale worker snapshot.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const latestRow = await loadRemoteState();
    if (!latestRow || !latestRow.updated_at || !Array.isArray(latestRow.data?.accounts)) {
      throw new Error("Remote state missing; refusing to recreate accounts from stale data.");
    }
    const next = latestRow.data;
    const history = createNotificationState(next.notificationHistory);
    const incoming = createNotificationState(data.notificationHistory);
    for (const [id, record] of Object.entries(incoming.accounts)) {
      const previous = history.accounts[id] || {};
      if (latestIso(previous.warningLastNotifiedAt, record.warningLastNotifiedAt) === record.warningLastNotifiedAt) {
        history.accounts[id] = record;
      }
    }
    next.notificationHistory = history.accounts;
    const today = localDateKeyFromDate(new Date());
    for (const account of next.accounts) {
      if (settleAccount(account, today)) account.modifiedAt = new Date().toISOString();
      account.warningLastNotifiedAt = latestIso(account.warningLastNotifiedAt, history.accounts[account.id]?.warningLastNotifiedAt);
    }
    next.lastUpdated = new Date().toISOString();
    next.modifiedAt = next.lastUpdated;
    const url = `${CONFIG.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${encodeURIComponent(CONFIG.table)}`
      + `?id=eq.${encodeURIComponent(CONFIG.rowId)}&updated_at=eq.${encodeURIComponent(latestRow.updated_at)}`;
    const result = await requestJson(url, {
      method: "PATCH",
      headers: { apikey: CONFIG.supabaseKey, Authorization: `Bearer ${CONFIG.supabaseKey}`,
        "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify({ data: next, updated_at: new Date().toISOString() })
    });
    if (Array.isArray(result) && result.length) return;
  }
  throw new Error("Remote state changed repeatedly; retry on next run.");
}

async function sendWxPusher(payload) {
  const body = {
    appToken: CONFIG.wxPusherAppToken,
    content: buildWxPusherMessage(payload),
    summary: payload.title.slice(0, 64),
    contentType: 1,
    uids: CONFIG.wxPusherUids,
    verifyPay: false
  };

  return requestJson("https://wxpusher.zjiecode.com/api/send/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function sendServerChan(payload) {
  const serverChanPayload = buildServerChanPayload(payload);
  const body = new URLSearchParams({
    title: serverChanPayload.title,
    desp: serverChanPayload.desp,
    channel: "9"
  });

  return requestJson(`https://sctapi.ftqq.com/${CONFIG.serverChanSendKey}.send`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body
  });
}

function notificationSkipReason(account, today, nowIso, history) {
  if (!account) return "account missing";
  if (!billing.isActive(account)) return `account ${account.deleted ? "deleted" : account.status}`;
  if (account.warningEnabled === false) return "notifications disabled";
  if (!warningStatus(account, today).triggered) return "warning cleared";
  if (!cooldownPassed(account, nowIso, history)) return "cooldown active";
  return "";
}

async function latestNotification(accountId, today, nowIso, provider) {
  const row = await loadRemoteState();
  const account = row?.data?.accounts?.find((item) => item.id === accountId);
  if (account) settleAccount(account, today);
  const reason = notificationSkipReason(account, today, nowIso, createNotificationState(row?.data?.notificationHistory));
  if (reason) {
    log(`Skipped ${accountId} before ${provider}: ${reason}.`);
    return null;
  }
  return buildTextPayload(account, warningStatus(account, today));
}

async function dispatchNotification(accountId, today, nowIso) {
  const providerResults = [];

  for (const provider of getEnabledProviders()) {
    try {
      // A stop saved while one provider is sending must suppress the next provider.
      const payload = await latestNotification(accountId, today, nowIso, provider);
      if (!payload) continue;
      const result = await (provider === "wxpusher" ? sendWxPusher(payload) : sendServerChan(payload));
      providerResults.push({
        provider,
        ok: provider === "wxpusher" ? isWxPusherSendSuccess(result) : isServerChanSendSuccess(result),
        result
      });
    } catch (error) {
      providerResults.push({
        provider,
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  return providerResults;
}

async function main() {
  const providers = getEnabledProviders();
  if (!providers.length) {
    log("No notification provider configured, skipped.");
    return;
  }

  const row = await loadRemoteState();
  if (!row || !row.data || !Array.isArray(row.data.accounts)) {
    log("Remote account state not found, skipped.");
    return;
  }

  let notificationState = createNotificationState(row.data.notificationHistory);
  const mergedNotificationHistory = mergeAccountNotificationHistory(notificationState, row.data.accounts);
  notificationState = mergedNotificationHistory.state;
  let notificationChanged = mergedNotificationHistory.changed;
  const today = localDateKeyFromDate(new Date());
  const nowIso = new Date().toISOString();
  const state = row.data;
  let changed = false;
  const notifications = [];

  for (const account of state.accounts) {
    if (settleAccount(account, today)) changed = true;

    const reason = notificationSkipReason(account, today, nowIso, notificationState);
    if (reason) {
      log(`Skipped ${accountNotificationKey(account)}: ${reason}.`);
      continue;
    }

    notifications.push({
      account
    });
  }

  if (!notifications.length && !changed && !notificationChanged) {
    log("No changes to process.");
    return;
  }

  if (notifications.length) {
    let hasAccountFailure = false;

    for (const item of notifications) {
      if (CONFIG.dryRun) {
        const payload = await latestNotification(item.account.id, today, nowIso, "dry-run");
        if (payload) log(`[dry-run] ${payload.title}`);
        continue;
      }

      const results = await dispatchNotification(item.account.id, today, nowIso);
      if (!results.length) continue;
      const successCount = results.filter((result) => result.ok).length;

      for (const result of results) {
        if (result.ok) {
          log(`Sent ${item.account.number} via ${result.provider}: ${JSON.stringify(result.result)}`);
        } else if (result.error) {
          warn(`${result.provider} request failed for ${item.account.number}: ${result.error}`);
        } else {
          warn(`${result.provider} rejected ${item.account.number}: ${JSON.stringify(result.result)}`);
        }
      }

      if (successCount > 0) {
        const sentProviders = results
          .filter((result) => result.ok)
          .map((result) => result.provider);
        item.account.warningLastNotifiedAt = nowIso;
        notificationState = markNotificationSent(notificationState, item.account, nowIso, sentProviders);
        notificationChanged = true;
        changed = true;
      } else {
        fail(`All providers failed for ${item.account.number}.`);
        hasAccountFailure = true;
      }
    }

    if (hasAccountFailure) {
      throw new Error("One or more notifications failed on all providers.");
    }
  }

  if (CONFIG.dryRun) {
    log("[dry-run] No messages sent or remote data written.");
    return;
  }

  if (notificationChanged) {
    syncNotificationHistoryToMainState(state, notificationState);
    changed = true;
  }

  if (changed) {
    state.lastUpdated = nowIso;
    state.modifiedAt = nowIso;
    await saveRemoteState(state);
    log("Remote state updated.");
  }
}

main().catch((error) => {
  fail(error && error.stack ? error.stack : String(error));
});
