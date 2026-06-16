const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || "https://rhkzsyhxezlppfxqzalm.supabase.co",
  supabaseKey: process.env.SUPABASE_ANON_KEY || "sb_publishable_jg7Ht5A1SXFfkn4VZImQKA_eAHoh5uZ",
  table: process.env.SUPABASE_TABLE || "balance_state",
  rowId: process.env.SUPABASE_ROW_ID || "china_broadcasting",
  appToken: process.env.WXPUSHER_APP_TOKEN || "",
  uids: String(process.env.WXPUSHER_UIDS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
  dryRun: String(process.env.DRY_RUN || "") === "1"
};

function log(message) {
  console.log(`[notify] ${message}`);
}

function fail(message) {
  console.error(`[notify] ${message}`);
  process.exitCode = 1;
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
  if (account.billingType === "monthEnd") return isLastDayOfMonth(key) ? safeNumber(account.monthlyCharge, 0) : 0;
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

function warningStatus(account, today) {
  const settledBalance = roundMoney(safeNumber(account.balance, 0));
  const estimate = estimateUsage(settledBalance, account, today);
  const enabled = account.warningEnabled !== false;
  const mode = account.warningMode === "days" ? "days" : "balance";
  const threshold = safeNumber(account.warningThreshold, mode === "days" ? 30 : 10);
  const triggered = enabled
    ? (mode === "days" ? estimate.days <= threshold : settledBalance <= threshold)
    : false;

  let reason = "";
  if (!enabled) {
    reason = "提醒已关闭";
  } else if (mode === "days") {
    reason = `可用天数 ${estimate.days} 天，阈值 ${threshold} 天`;
  } else {
    reason = settledBalance < 0
      ? `当前欠费 ¥${Math.abs(settledBalance).toFixed(2)}`
      : `当前余额 ¥${settledBalance.toFixed(2)}，阈值 ¥${threshold.toFixed(2)}`;
  }

  return {
    enabled,
    mode,
    threshold,
    triggered,
    daysLeft: estimate.days,
    until: estimate.until,
    reason,
    cooldownHours: Math.max(1, safeNumber(account.warningCooldownHours, 24))
  };
}

function cooldownPassed(account, nowIso) {
  const last = new Date(account.warningLastNotifiedAt || 0).getTime();
  if (!Number.isFinite(last) || last <= 0) return true;
  const cooldownHours = Math.max(1, safeNumber(account.warningCooldownHours, 24));
  return new Date(nowIso).getTime() - last >= cooldownHours * 3600 * 1000;
}

function formatChinaDate(key) {
  const parts = partsFromKey(key);
  return `${parts.year}年${parts.month}月${parts.day}日`;
}

function buildMessage(account, status) {
  const type = account.type || "账号";
  const carrier = account.carrier || "";
  const balanceText = status.mode === "balance"
    ? `余额 ¥${roundMoney(account.balance).toFixed(2)}`
    : `可用天数 ${status.daysLeft} 天`;
  return [
    "余额提醒",
    `${carrier} ${account.number} (${type})`,
    balanceText,
    status.reason,
    `预计可用至 ${formatChinaDate(status.until)}`
  ].join("\n");
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

async function loadRemoteState() {
  const url = `${CONFIG.supabaseUrl.replace(/\/+$/, "")}/rest/v1/${encodeURIComponent(CONFIG.table)}?id=eq.${encodeURIComponent(CONFIG.rowId)}&select=id,data,updated_at`;
  const response = await fetch(url, {
    headers: {
      apikey: CONFIG.supabaseKey,
      Authorization: `Bearer ${CONFIG.supabaseKey}`
    }
  });
  if (!response.ok) {
    throw new Error(`读取 Supabase 失败: HTTP ${response.status}`);
  }
  const rows = await response.json();
  return rows && rows[0] ? rows[0] : null;
}

async function saveRemoteState(data) {
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
      id: CONFIG.rowId,
      data,
      updated_at: new Date().toISOString()
    })
  });
}

async function sendWxPusher(message) {
  const body = {
    appToken: CONFIG.appToken,
    content: message,
    summary: message.slice(0, 64),
    contentType: 1,
    uids: CONFIG.uids,
    verifyPay: false
  };

  return requestJson("https://wxpusher.zjiecode.com/api/send/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function main() {
  if (!CONFIG.appToken || CONFIG.uids.length === 0) {
    log("缺少 WXPUSHER_APP_TOKEN 或 WXPUSHER_UIDS，已跳过。");
    return;
  }

  const row = await loadRemoteState();
  if (!row || !row.data || !Array.isArray(row.data.accounts)) {
    log("未找到可用的远程账号数据，已跳过。");
    return;
  }

  const today = dateKeyFromDate(new Date());
  const nowIso = new Date().toISOString();
  const state = row.data;
  let changed = false;
  const notifications = [];

  for (const account of state.accounts) {
    if (settleAccount(account, today)) changed = true;

    const status = warningStatus(account, today);
    if (!status.triggered) continue;
    if (account.warningChannel !== "wxpusher") continue;
    if (!cooldownPassed(account, nowIso)) continue;

    notifications.push({ account, status, message: buildMessage(account, status) });
  }

  if (!notifications.length && !changed) {
    log("没有需要处理的变更。");
    return;
  }

  if (notifications.length) {
    let hasSendFailure = false;

    for (const item of notifications) {
      if (CONFIG.dryRun) {
        log(`[dry-run] ${item.message.replace(/\n/g, " | ")}`);
        item.account.warningLastNotifiedAt = nowIso;
        changed = true;
        continue;
      }

      try {
        const result = await sendWxPusher(item.message);
        if (!isWxPusherSendSuccess(result)) {
          hasSendFailure = true;
          fail(`WxPusher rejected ${item.account.number}: ${JSON.stringify(result)}`);
          continue;
        }

        log(`已发送 ${item.account.number}: ${JSON.stringify(result)}`);
        item.account.warningLastNotifiedAt = nowIso;
        changed = true;
      } catch (error) {
        hasSendFailure = true;
        fail(`WxPusher request failed for ${item.account.number}: ${error && error.message ? error.message : String(error)}`);
      }
    }

    if (hasSendFailure) {
      throw new Error("One or more WxPusher notifications failed.");
    }
  }

  if (changed) {
    state.lastUpdated = nowIso;
    state.modifiedAt = nowIso;
    await saveRemoteState(state);
    log("已更新远程状态。");
  }
}

main().catch((error) => {
  fail(error && error.stack ? error.stack : String(error));
});
