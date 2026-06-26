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

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateKeyFromDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function partsFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return { year, month, day };
}

function addDays(key, amount) {
  const parts = partsFromKey(key);
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
  return dateKeyFromDate(date);
}

function compareKeys(a, b) {
  const ap = partsFromKey(a);
  const bp = partsFromKey(b);
  const at = Date.UTC(ap.year, ap.month - 1, ap.day);
  const bt = Date.UTC(bp.year, bp.month - 1, bp.day);
  return at === bt ? 0 : at < bt ? -1 : 1;
}

function daysInMonthFor(year, month) {
  return new Date(year, month, 0).getDate();
}

function isLastDayOfMonth(key) {
  const parts = partsFromKey(key);
  return parts.day === daysInMonthFor(parts.year, parts.month);
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
}

function dailyFeeFor(account, key) {
  if (account.billingType === "daily") return safeNumber(account.dailyCharge, 0);
  if (account.billingType === "monthEnd") return 0;
  const parts = partsFromKey(key);
  return safeNumber(account.monthlyCharge, 0) / daysInMonthFor(parts.year, parts.month);
}

function chargeForDate(account, key) {
  if (account.billingType === "daily") return safeNumber(account.dailyCharge, 0);
  if (account.billingType === "monthEnd") {
    return isLastDayOfMonth(key) ? safeNumber(account.monthlyCharge, 0) : 0;
  }
  return dailyFeeFor(account, key);
}

function settleAccount(account, today) {
  const yesterday = addDays(today, -1);
  let cursor = addDays(account.lastSettledDate || today, 1);
  let changed = false;

  while (compareKeys(cursor, yesterday) <= 0) {
    account.balance = roundMoney(safeNumber(account.balance, 0) - chargeForDate(account, cursor));
    account.lastSettledDate = cursor;
    cursor = addDays(cursor, 1);
    changed = true;
  }

  return changed;
}

function estimateUsage(balance, account, startKey) {
  if (balance <= 0) return { days: 0, until: startKey };
  let remaining = balance;
  let cursor = startKey;
  let days = 0;

  while (days < 3650) {
    const fee = chargeForDate(account, cursor);
    if (remaining + 1e-7 < fee) break;
    remaining -= fee;
    days += 1;
    cursor = addDays(cursor, 1);
  }

  return {
    days,
    until: days > 0 ? addDays(startKey, days - 1) : startKey
  };
}

function endOfMonthKey(key) {
  const parts = partsFromKey(key);
  return dateKeyFromDate(new Date(Date.UTC(parts.year, parts.month, 0)));
}

function monthEndProjection(account, today) {
  const monthlyCharge = safeNumber(account.monthlyCharge, 0);
  const balance = roundMoney(safeNumber(account.balance, 0));
  const fullMonthsSupported = monthlyCharge > 0 ? Math.max(0, Math.floor(balance / monthlyCharge)) : 0;
  const nextChargeDate = endOfMonthKey(today);
  const postChargeBalance = roundMoney(balance - monthlyCharge);

  return {
    fullMonthsSupported,
    nextChargeDate,
    postChargeBalance
  };
}

function warningStatus(account, today) {
  const settledBalance = roundMoney(safeNumber(account.balance, 0));
  const estimate = estimateUsage(settledBalance, account, today);
  const enabled = account.warningEnabled !== false;
  const mode = account.warningMode === "days" || account.warningMode === "afterCharge" ? account.warningMode : "balance";
  const threshold = safeNumber(account.warningThreshold, mode === "days" ? 30 : 10);
  const monthEndInfo = account.billingType === "monthEnd" ? monthEndProjection(account, today) : null;
  const postChargeBalance = monthEndInfo ? monthEndInfo.postChargeBalance : roundMoney(settledBalance - safeNumber(account.dailyCharge, 0));
  const triggered = enabled
    ? (mode === "days"
      ? estimate.days <= threshold
      : mode === "afterCharge"
        ? postChargeBalance <= threshold
        : settledBalance <= threshold)
    : false;

  let reason = "";
  if (!enabled) {
    reason = "提醒已关闭";
  } else if (mode === "days") {
    reason = `预计可用 ${estimate.days} 天，低于 ${threshold} 天阈值`;
  } else if (mode === "afterCharge") {
    reason = postChargeBalance < 0
      ? `下次扣费后预计欠费 ¥${Math.abs(postChargeBalance).toFixed(2)}`
      : `下次扣费后预计余额 ¥${postChargeBalance.toFixed(2)}`;
  } else {
    reason = settledBalance < 0
      ? `当前欠费 ${Math.abs(settledBalance).toFixed(2)} 元`
      : `当前余额 ${settledBalance.toFixed(2)} 元，低于 ${threshold.toFixed(2)} 元阈值`;
  }

  return {
    enabled,
    mode,
    threshold,
    triggered,
    daysLeft: estimate.days,
    until: estimate.until,
    postChargeBalance,
    fullMonthsSupported: monthEndInfo ? monthEndInfo.fullMonthsSupported : 0,
    nextChargeDate: monthEndInfo ? monthEndInfo.nextChargeDate : "",
    reason,
    cooldownHours: Math.max(1, safeNumber(account.warningCooldownHours, 24))
  };
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

function shouldSendBackgroundNotification(account) {
  return account.warningChannel !== "browser";
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

async function saveSupabaseRow(rowId, data) {
  const url = `${CONFIG.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${encodeURIComponent(CONFIG.table)}?on_conflict=id`;
  await requestJson(url, {
    method: "POST",
    headers: {
      apikey: CONFIG.supabaseKey,
      Authorization: `Bearer ${CONFIG.supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({
      id: rowId,
      data,
      updated_at: new Date().toISOString()
    })
  });
}

async function loadRemoteState() {
  return loadSupabaseRow(CONFIG.rowId);
}

async function saveRemoteState(data) {
  return saveSupabaseRow(CONFIG.rowId, data);
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

async function dispatchNotification(payload) {
  const providerResults = [];

  if (CONFIG.wxPusherAppToken && CONFIG.wxPusherUids.length) {
    try {
      const result = await sendWxPusher(payload);
      providerResults.push({
        provider: "wxpusher",
        ok: isWxPusherSendSuccess(result),
        result
      });
    } catch (error) {
      providerResults.push({
        provider: "wxpusher",
        ok: false,
        error: error && error.message ? error.message : String(error)
      });
    }
  }

  if (CONFIG.serverChanSendKey) {
    try {
      const result = await sendServerChan(payload);
      providerResults.push({
        provider: "serverchan",
        ok: isServerChanSendSuccess(result),
        result
      });
    } catch (error) {
      providerResults.push({
        provider: "serverchan",
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
  const today = dateKeyFromDate(new Date());
  const nowIso = new Date().toISOString();
  const state = row.data;
  let changed = false;
  const notifications = [];

  for (const account of state.accounts) {
    if (settleAccount(account, today)) changed = true;

    const status = warningStatus(account, today);
    if (!status.triggered) continue;
    if (!shouldSendBackgroundNotification(account)) continue;
    if (!cooldownPassed(account, nowIso, notificationState)) continue;

    notifications.push({
      account,
      payload: buildTextPayload(account, status)
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
        log(`[dry-run] ${item.payload.title}`);
        item.account.warningLastNotifiedAt = nowIso;
        notificationState = markNotificationSent(notificationState, item.account, nowIso, ["dry-run"]);
        notificationChanged = true;
        changed = true;
        continue;
      }

      const results = await dispatchNotification(item.payload);
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
