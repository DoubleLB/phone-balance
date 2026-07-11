(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PhoneBalanceBilling = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function safeNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function roundMoney(value) {
    return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
  }

  function dateKey(year, month, day) {
    return year + "-" + pad(month) + "-" + pad(day);
  }

  function dateKeyFromDate(date) {
    return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }

  function localDateKeyFromDate(date) {
    return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
  }

  function partsFromKey(key) {
    var parts = String(key).split("-").map(Number);
    return { year: parts[0], month: parts[1], day: parts[2] };
  }

  function addDays(key, amount) {
    var parts = partsFromKey(key);
    var date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
    return dateKeyFromDate(date);
  }

  function compareKeys(a, b) {
    var aParts = partsFromKey(a);
    var bParts = partsFromKey(b);
    var aTime = Date.UTC(aParts.year, aParts.month - 1, aParts.day);
    var bTime = Date.UTC(bParts.year, bParts.month - 1, bParts.day);
    if (aTime === bTime) return 0;
    return aTime < bTime ? -1 : 1;
  }

  function daysInMonthFor(year, month) {
    return new Date(year, month, 0).getDate();
  }

  function isLastDayOfMonth(key) {
    var parts = partsFromKey(key);
    return parts.day === daysInMonthFor(parts.year, parts.month);
  }

  function dailyFeeFor(account, key) {
    if (account.billingType === "daily") return safeNumber(account.dailyCharge, 0);
    if (account.billingType === "monthEnd") return 0;
    var parts = partsFromKey(key);
    return safeNumber(account.monthlyCharge, 0) / daysInMonthFor(parts.year, parts.month);
  }

  function chargeForDate(account, key) {
    if (account.billingType === "daily") return safeNumber(account.dailyCharge, 0);
    if (account.billingType === "monthEnd") {
      return isLastDayOfMonth(key) ? safeNumber(account.monthlyCharge, 0) : 0;
    }
    return dailyFeeFor(account, key);
  }

  function monthSettledFeeFor(account, todayKeyValue) {
    var parts = partsFromKey(todayKeyValue);
    if (account.billingType === "monthEnd") {
      return parts.day > daysInMonthFor(parts.year, parts.month) ? safeNumber(account.monthlyCharge, 0) : 0;
    }
    return dailyFeeFor(account, todayKeyValue) * Math.max(0, parts.day - 1);
  }

  function settleAccount(account, today) {
    var yesterday = addDays(today, -1);
    var cursor = addDays(account.lastSettledDate || today, 1);
    var changed = false;

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
    var remaining = balance;
    var cursor = startKey;
    var days = 0;

    while (days < 3650) {
      var fee = chargeForDate(account, cursor);
      if (remaining + 0.0000001 < fee) break;
      remaining -= fee;
      days += 1;
      cursor = addDays(cursor, 1);
    }

    return {
      days: days,
      until: days > 0 ? addDays(startKey, days - 1) : startKey
    };
  }

  function endOfMonthKey(key) {
    var parts = partsFromKey(key);
    return dateKeyFromDate(new Date(Date.UTC(parts.year, parts.month, 0)));
  }

  function endOfMonthOffsetKey(key, offset) {
    var parts = partsFromKey(key);
    return dateKeyFromDate(new Date(Date.UTC(parts.year, parts.month + offset, 0)));
  }

  function daysUntilKey(fromKey, toKey) {
    var fromParts = partsFromKey(fromKey);
    var toParts = partsFromKey(toKey);
    var fromTime = Date.UTC(fromParts.year, fromParts.month - 1, fromParts.day);
    var toTime = Date.UTC(toParts.year, toParts.month - 1, toParts.day);
    return Math.max(0, Math.round((toTime - fromTime) / 86400000));
  }

  function monthEndProjection(account, today) {
    var monthlyCharge = safeNumber(account.monthlyCharge, 0);
    var balance = roundMoney(safeNumber(account.balance, 0));
    var fullMonthsSupported = monthlyCharge > 0 ? Math.max(0, Math.floor(balance / monthlyCharge)) : 0;
    var nextChargeDate = endOfMonthKey(today);
    var attentionDate = endOfMonthOffsetKey(today, fullMonthsSupported);
    var postChargeBalance = roundMoney(balance - monthlyCharge);

    return {
      fullMonthsSupported: fullMonthsSupported,
      nextChargeDate: nextChargeDate,
      attentionDate: attentionDate,
      postChargeBalance: postChargeBalance
    };
  }

  function normalizeWarningMode(value, fallback) {
    if (value === "balance" || value === "days" || value === "afterCharge") return value;
    if (fallback === "balance" || fallback === "days" || fallback === "afterCharge") return fallback;
    return "balance";
  }

  function warningStatus(account, today) {
    var settledBalance = roundMoney(safeNumber(account.balance, 0));
    var estimate = estimateUsage(settledBalance, account, today);
    var enabled = account.warningEnabled !== false;
    var mode = normalizeWarningMode(account.warningMode, "balance");
    var threshold = safeNumber(account.warningThreshold, mode === "days" ? 30 : 10);
    var monthEndInfo = account.billingType === "monthEnd" ? monthEndProjection(account, today) : null;
    var dailyFee = dailyFeeFor(account, today);
    var attentionDate = monthEndInfo ? monthEndInfo.attentionDate : estimate.until;
    var attentionDays = monthEndInfo ? daysUntilKey(today, attentionDate) : estimate.days;
    var postChargeBalance = monthEndInfo ? monthEndInfo.postChargeBalance : roundMoney(settledBalance - dailyFee);
    var comparableDays = attentionDays;
    var triggered = enabled
      ? (mode === "days"
        ? comparableDays <= threshold
        : mode === "afterCharge"
          ? postChargeBalance <= threshold
          : settledBalance <= threshold)
      : false;
    var reason = "";

    if (!enabled) {
      reason = "当前账号未启用提醒。";
    } else if (mode === "days") {
      reason = triggered
        ? (comparableDays > 0
          ? "预计仅剩约 " + comparableDays + " 天，已低于 " + trimNumber(threshold) + " 天提醒线"
          : "预计可用时间已不足 1 天")
        : "预计可用约 " + comparableDays + " 天";
    } else if (mode === "afterCharge") {
      reason = triggered
        ? (postChargeBalance < 0
          ? "下次扣费后预计欠费 ¥" + money(Math.abs(postChargeBalance), 2)
          : "下次扣费后余额将低于提醒线 ¥" + money(threshold, 2))
        : "下次扣费后预计余额 ¥" + money(postChargeBalance, 2);
    } else {
      reason = triggered
        ? (settledBalance < 0
          ? "当前已欠费 ¥" + money(Math.abs(settledBalance), 2)
          : "余额已低于提醒线 ¥" + money(threshold, 2))
        : "当前余额 ¥" + money(settledBalance, 2);
    }

    return {
      enabled: enabled,
      mode: mode,
      threshold: threshold,
      triggered: triggered,
      reason: reason,
      balance: settledBalance,
      daysLeft: comparableDays,
      until: attentionDate,
      estimatedUsageDays: estimate.days,
      estimatedUsageUntil: estimate.until,
      postChargeBalance: postChargeBalance,
      fullMonthsSupported: monthEndInfo ? monthEndInfo.fullMonthsSupported : 0,
      nextChargeDate: monthEndInfo ? monthEndInfo.nextChargeDate : "",
      attentionDate: attentionDate,
      attentionDays: attentionDays,
      cooldownHours: Math.max(1, safeNumber(account.warningCooldownHours, 24))
    };
  }

  function money(value, digits) {
    return Number(value).toFixed(digits);
  }

  function trimNumber(value) {
    return String(Number(Number(value).toFixed(3)));
  }

  return {
    addDays: addDays,
    chargeForDate: chargeForDate,
    compareKeys: compareKeys,
    dailyFeeFor: dailyFeeFor,
    dateKey: dateKey,
    dateKeyFromDate: dateKeyFromDate,
    daysInMonthFor: daysInMonthFor,
    daysUntilKey: daysUntilKey,
    endOfMonthKey: endOfMonthKey,
    endOfMonthOffsetKey: endOfMonthOffsetKey,
    estimateUsage: estimateUsage,
    localDateKeyFromDate: localDateKeyFromDate,
    monthEndProjection: monthEndProjection,
    monthSettledFeeFor: monthSettledFeeFor,
    normalizeWarningMode: normalizeWarningMode,
    pad: pad,
    partsFromKey: partsFromKey,
    roundMoney: roundMoney,
    safeNumber: safeNumber,
    settleAccount: settleAccount,
    warningStatus: warningStatus
  };
});
