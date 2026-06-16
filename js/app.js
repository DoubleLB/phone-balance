(function () {
      "use strict";

      var STORAGE_KEY = "phone_balance_overview_v3";

      var CARRIERS = {
        broadcasting: { name: "中国广电", logo: "广", icon: "svg/中国广电.svg", color: "#0f766e", color2: "#14b8a6" },
        telecom: { name: "中国电信", logo: "电", icon: "svg/中国电信.svg", color: "#2563eb", color2: "#38bdf8" },
        mobile: { name: "中国移动", logo: "移", icon: "svg/中国移动.svg", color: "#16a34a", color2: "#22c55e" },
        unicom: { name: "中国联通", logo: "联", icon: "svg/中国联通.svg", color: "#f87171", color2: "#fb923c", color3: "#fbbf24" }
      };

      var DEFAULT_STATE = {
        lastUpdated: "2026-06-16T00:00:00+08:00",
        openCarriers: ["broadcasting"],
        accounts: [
          {
            id: "broadcasting-19290397571",
            carrier: "broadcasting",
            type: "手机号",
            number: "19290397571",
            billingType: "monthly",
            balance: 47.68,
            lastSettledDate: "2026-06-15",
            monthlyCharge: 28,
            warningThreshold: 10
          },
          {
            id: "telecom-19929896163",
            carrier: "telecom",
            type: "手机号",
            number: "19929896163",
            billingType: "monthEnd",
            balance: 167,
            lastSettledDate: "2026-06-15",
            monthlyCharge: 59,
            warningThreshold: 20
          },
          {
            id: "telecom-17719749522",
            carrier: "telecom",
            type: "手机号",
            number: "17719749522",
            billingType: "monthEnd",
            balance: 77,
            lastSettledDate: "2026-06-15",
            monthlyCharge: 59,
            warningThreshold: 20
          },
          {
            id: "unicom-02901185603",
            carrier: "unicom",
            type: "宽带账号",
            number: "02901185603",
            billingType: "daily",
            balance: 35,
            lastSettledDate: "2026-06-15",
            dailyCharge: 1,
            warningThreshold: 7
          },
          {
            id: "mobile-13891108369",
            carrier: "mobile",
            type: "手机号",
            number: "13891108369",
            billingType: "monthEnd",
            balance: 193.92,
            lastSettledDate: "2026-06-15",
            monthlyCharge: 8,
            warningThreshold: 10
          },
          {
            id: "mobile-13892179959",
            carrier: "mobile",
            type: "手机号",
            number: "13892179959",
            billingType: "monthEnd",
            balance: 73.64,
            lastSettledDate: "2026-06-15",
            monthlyCharge: 11,
            warningThreshold: 10
          },
          {
            id: "mobile-13468597998",
            carrier: "mobile",
            type: "手机号",
            number: "13468597998",
            billingType: "monthEnd",
            balance: 114.29,
            lastSettledDate: "2026-06-15",
            monthlyCharge: 9,
            warningThreshold: 10
          },
          {
            id: "mobile-13474400407",
            carrier: "mobile",
            type: "手机号",
            number: "13474400407",
            billingType: "monthEnd",
            balance: 88.66,
            lastSettledDate: "2026-06-15",
            monthlyCharge: 8,
            warningThreshold: 10
          }
        ]
      };

      var state = loadState();
      var activeAccountId = "";
      var lastRenderedDate = "";
      var toastTimer = null;

      var els = {
        homePage: document.getElementById("homePage"),
        detailPage: document.getElementById("detailPage"),
        overviewCard: document.getElementById("overviewCard"),
        overviewBalance: document.getElementById("overviewBalance"),
        overviewWarningTag: document.getElementById("overviewWarningTag"),
        overviewAccounts: document.getElementById("overviewAccounts"),
        overviewSoonest: document.getElementById("overviewSoonest"),
        overviewNote: document.getElementById("overviewNote"),
        warningSection: document.getElementById("warningSection"),
        warningSummary: document.getElementById("warningSummary"),
        warningList: document.getElementById("warningList"),
        homeUpdated: document.getElementById("homeUpdated"),
        detailUpdated: document.getElementById("detailUpdated"),
        carrierList: document.getElementById("carrierList"),
        toggleAllBtn: document.getElementById("toggleAllBtn"),
        refreshBtn: document.getElementById("refreshBtn"),
        backBtn: document.getElementById("backBtn"),
        detailTitle: document.getElementById("detailTitle"),
        detailAccount: document.getElementById("detailAccount"),
        balancePanel: document.getElementById("balancePanel"),
        detailBalance: document.getElementById("detailBalance"),
        warningText: document.getElementById("warningText"),
        detailDaysLeft: document.getElementById("detailDaysLeft"),
        detailUntil: document.getElementById("detailUntil"),
        dailyFee: document.getElementById("dailyFee"),
        monthSettledFee: document.getElementById("monthSettledFee"),
        daysInMonth: document.getElementById("daysInMonth"),
        settledDays: document.getElementById("settledDays"),
        chargeLabel: document.getElementById("chargeLabel"),
        fixedCharge: document.getElementById("fixedCharge"),
        balanceInput: document.getElementById("balanceInput"),
        chargeInput: document.getElementById("chargeInput"),
        chargeInputLabel: document.getElementById("chargeInputLabel"),
        warningInput: document.getElementById("warningInput"),
        rechargeAmountInput: document.getElementById("rechargeAmountInput"),
        addRechargeBtn: document.getElementById("addRechargeBtn"),
        saveBtn: document.getElementById("saveBtn"),
        resetAccountBtn: document.getElementById("resetAccountBtn"),
        toast: document.getElementById("toast")
      };

      function loadState() {
        try {
          var raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) {
            return cloneDefault();
          }
          return normalizeState(JSON.parse(raw));
        } catch (error) {
          return cloneDefault();
        }
      }

      function cloneDefault() {
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
      }

      function normalizeState(input) {
        var next = Object.assign(cloneDefault(), input || {});
        var defaults = cloneDefault().accounts;
        var byId = {};

        (Array.isArray(input && input.accounts) ? input.accounts : []).forEach(function (account) {
          byId[account.id] = account;
        });

        next.accounts = defaults.map(function (account) {
          return normalizeAccount(Object.assign({}, account, byId[account.id] || {}), account);
        });

        next.openCarriers = Array.isArray(next.openCarriers) ? next.openCarriers.filter(function (carrier) {
          return Boolean(CARRIERS[carrier]);
        }) : ["broadcasting"];
        next.lastUpdated = next.lastUpdated || DEFAULT_STATE.lastUpdated;
        return next;
      }

      function normalizeAccount(account, fallback) {
        account.balance = safeNumber(account.balance, fallback.balance);
        account.monthlyCharge = safeNumber(account.monthlyCharge, fallback.monthlyCharge || 0);
        account.dailyCharge = safeNumber(account.dailyCharge, fallback.dailyCharge || 0);
        account.warningThreshold = safeNumber(account.warningThreshold, fallback.warningThreshold || 0);
        account.billingType = normalizeBillingType(account.billingType, fallback.billingType, account.carrier);
        account.lastSettledDate = isDateKey(account.lastSettledDate) ? account.lastSettledDate : fallback.lastSettledDate;
        return account;
      }

      function normalizeBillingType(value, fallback, carrierKey) {
        if ((carrierKey === "telecom" || carrierKey === "mobile") && value === "monthly") {
          return "monthEnd";
        }
        if (value === "daily" || value === "monthly" || value === "monthEnd") return value;
        return fallback || "monthly";
      }

      function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }

      function safeNumber(value, fallback) {
        var number = Number(value);
        return Number.isFinite(number) ? number : fallback;
      }

      function pad(value) {
        return String(value).padStart(2, "0");
      }

      function todayKey() {
        var date = new Date();
        return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
      }

      function dateKey(year, month, day) {
        return year + "-" + pad(month) + "-" + pad(day);
      }

      function partsFromKey(key) {
        var parts = String(key).split("-").map(Number);
        return { year: parts[0], month: parts[1], day: parts[2] };
      }

      function addDays(key, amount) {
        var parts = partsFromKey(key);
        var date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + amount));
        return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
      }

      function compareKeys(a, b) {
        var aParts = partsFromKey(a);
        var bParts = partsFromKey(b);
        var aTime = Date.UTC(aParts.year, aParts.month - 1, aParts.day);
        var bTime = Date.UTC(bParts.year, bParts.month - 1, bParts.day);
        if (aTime === bTime) return 0;
        return aTime < bTime ? -1 : 1;
      }

      function isDateKey(value) {
        return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
      }

      function daysInMonthFor(year, month) {
        return new Date(year, month, 0).getDate();
      }

      function dailyFeeFor(account, key) {
        if (account.billingType === "daily") return account.dailyCharge;
        if (account.billingType === "monthEnd") return 0;
        var parts = partsFromKey(key);
        return account.monthlyCharge / daysInMonthFor(parts.year, parts.month);
      }

      function isLastDayOfMonth(key) {
        var parts = partsFromKey(key);
        return parts.day === daysInMonthFor(parts.year, parts.month);
      }

      function chargeForDate(account, key) {
        if (account.billingType === "daily") return account.dailyCharge;
        if (account.billingType === "monthEnd") return isLastDayOfMonth(key) ? account.monthlyCharge : 0;
        return dailyFeeFor(account, key);
      }

      function monthSettledFeeFor(account, todayKeyValue) {
        var parts = partsFromKey(todayKeyValue);
        if (account.billingType === "monthEnd") {
          return parts.day > daysInMonthFor(parts.year, parts.month) ? account.monthlyCharge : 0;
        }
        return dailyFeeFor(account, todayKeyValue) * Math.max(0, parts.day - 1);
      }

      function roundMoney(value) {
        return Math.round((Number(value) + Number.EPSILON) * 1000000) / 1000000;
      }

      function money(value, digits) {
        return Number(value).toFixed(digits);
      }

      function readableDate(key) {
        var parts = partsFromKey(key);
        return parts.year + "年" + parts.month + "月" + parts.day + "日";
      }

      function formatDateTime(value) {
        var date = new Date(value);
        if (Number.isNaN(date.getTime())) date = new Date();
        return pad(date.getMonth() + 1) + "-" + pad(date.getDate()) + " " + pad(date.getHours()) + ":" + pad(date.getMinutes());
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, function (char) {
          return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#39;"
          }[char];
        });
      }

      function trimNumber(value) {
        return String(Number(Number(value).toFixed(3)));
      }

      function settleAccount(account) {
        var today = todayKey();
        var yesterday = addDays(today, -1);
        var cursor = addDays(account.lastSettledDate, 1);
        var changed = false;

        while (compareKeys(cursor, yesterday) <= 0) {
          account.balance = roundMoney(account.balance - chargeForDate(account, cursor));
          account.lastSettledDate = cursor;
          cursor = addDays(cursor, 1);
          changed = true;
        }

        return changed;
      }

      function settleAll() {
        var changed = false;
        state.accounts.forEach(function (account) {
          if (settleAccount(account)) changed = true;
        });
        if (changed) {
          state.lastUpdated = new Date().toISOString();
          saveState();
        }
      }

      function computeAccount(account) {
        var today = todayKey();
        var todayParts = partsFromKey(today);
        var monthDays = daysInMonthFor(todayParts.year, todayParts.month);
        var settledDays = account.billingType === "monthEnd" ? 0 : Math.max(0, todayParts.day - 1);
        var dailyFee = dailyFeeFor(account, today);
        var estimate = estimateUsage(account.balance, account, today);

        return {
          id: account.id,
          carrier: account.carrier,
          type: account.type,
          number: account.number,
          balance: roundMoney(account.balance),
          dailyFee: dailyFee,
          monthSettledFee: monthSettledFeeFor(account, today),
          monthDays: monthDays,
          settledDays: settledDays,
          daysLeft: estimate.days,
          until: estimate.until,
          warning: account.balance < account.warningThreshold,
          warningText: account.balance < 0
            ? "当前已欠费 ¥" + money(Math.abs(account.balance), 2)
            : "余额低于预警阈值 ¥" + money(account.warningThreshold, 2)
        };
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

      function carrierAccounts(carrierKey) {
        return state.accounts.filter(function (account) {
          return account.carrier === carrierKey;
        });
      }

      function carrierTotal(accounts) {
        return roundMoney(accounts.reduce(function (sum, account) {
          return sum + account.balance;
        }, 0));
      }

      function accountById(id) {
        return state.accounts.find(function (account) {
          return account.id === id;
        });
      }

      function defaultAccountById(id) {
        return DEFAULT_STATE.accounts.find(function (account) {
          return account.id === id;
        });
      }

      function computedAccounts() {
        return state.accounts.map(function (account) {
          return {
            account: account,
            carrier: CARRIERS[account.carrier],
            data: computeAccount(account)
          };
        });
      }

      function overviewStats(items) {
        var total = roundMoney(items.reduce(function (sum, item) {
          return sum + item.data.balance;
        }, 0));
        var warnings = items.filter(function (item) {
          return item.data.warning;
        });
        var soonest = items.reduce(function (best, item) {
          if (!best) return item;
          if (item.data.daysLeft !== best.data.daysLeft) {
            return item.data.daysLeft < best.data.daysLeft ? item : best;
          }
          return compareKeys(item.data.until, best.data.until) < 0 ? item : best;
        }, null);

        return {
          total: total,
          accountCount: items.length,
          warnings: warnings,
          soonest: soonest
        };
      }

      function isCarrierOpen(carrierKey) {
        return state.openCarriers.indexOf(carrierKey) !== -1;
      }

      function areAllCarriersOpen() {
        return Object.keys(CARRIERS).every(function (carrierKey) {
          return isCarrierOpen(carrierKey);
        });
      }

      function renderHome() {
        var keys = Object.keys(CARRIERS);
        var items = computedAccounts();
        renderOverview(overviewStats(items));
        renderWarnings(items);
        els.homeUpdated.textContent = formatDateTime(state.lastUpdated);
        els.toggleAllBtn.textContent = areAllCarriersOpen() ? "全部收起" : "全部展开";
        els.carrierList.innerHTML = keys.map(function (carrierKey) {
          var carrier = CARRIERS[carrierKey];
          var accounts = carrierAccounts(carrierKey);
          var open = isCarrierOpen(carrierKey);
          var rows = accounts.map(renderAccountRow).join("");
          return ''
            + '<article class="carrier-card' + (open ? " open" : "") + '" style="--carrier-color:' + carrier.color + '">'
            + '  <button class="carrier-main" type="button" data-action="toggle-carrier" data-carrier="' + carrierKey + '">'
            + '    <span>'
            + '      <span class="carrier-title-row">'
            + '        <span class="carrier-logo" aria-hidden="true">'
            + '          <img src="' + escapeHtml(carrier.icon) + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\';">'
            + '          <span class="logo-fallback">' + escapeHtml(carrier.logo) + '</span>'
            + '        </span>'
            + '        <span class="carrier-text">'
            + '          <span class="carrier-name">' + escapeHtml(carrier.name) + '</span>'
            + '          <span class="carrier-meta">' + accounts.length + ' 个账号</span>'
            + '        </span>'
            + '      </span>'
            + '    </span>'
            + '    <span>'
            + '      <span class="carrier-total money">¥' + money(carrierTotal(accounts), 2) + '</span>'
            + '      <span class="chevron"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"></path></svg></span>'
            + '    </span>'
            + '  </button>'
            + '  <div class="carrier-accounts">' + rows + '</div>'
            + '</article>';
        }).join("");
      }

      function renderOverview(stats) {
        var warningCount = stats.warnings.length;
        var soonest = stats.soonest;

        els.overviewBalance.textContent = money(stats.total, 2);
        els.overviewAccounts.textContent = stats.accountCount + " 个";
        els.overviewWarningTag.textContent = warningCount > 0 ? warningCount + " 个预警" : "全部正常";
        els.overviewSoonest.textContent = soonest
          ? (soonest.data.daysLeft > 0 ? readableDate(soonest.data.until) : "今天")
          : "--";
        els.overviewNote.textContent = warningCount > 0
          ? "已有账号低于预警阈值，建议优先查看预警账号。"
          : "当日费用尚未扣除，页面只根据本地保存余额进行估算。";
        els.overviewCard.classList.toggle("warning", warningCount > 0);
      }

      function renderWarnings(items) {
        var warnings = items.filter(function (item) {
          return item.data.warning;
        }).sort(function (a, b) {
          if (a.data.daysLeft !== b.data.daysLeft) return a.data.daysLeft - b.data.daysLeft;
          return a.data.balance - b.data.balance;
        });

        els.warningSummary.textContent = warnings.length > 0 ? warnings.length + " 个需要关注" : "暂无预警";
        els.warningSection.classList.toggle("safe", warnings.length === 0);
        if (warnings.length === 0) {
          els.warningList.innerHTML = '<p>当前没有低于预警阈值的账号。</p>';
          return;
        }

        els.warningList.innerHTML = warnings.map(function (item) {
          var daysText = item.data.daysLeft > 0 ? "约 " + item.data.daysLeft + " 天" : "不足 1 天";
          return ''
            + '<div class="warning-item" style="--carrier-color:' + item.carrier.color + '">'
            + '  <div>'
            + '    <strong>' + escapeHtml(item.account.number) + '</strong>'
            + '    <span>' + escapeHtml(item.carrier.name) + ' · ' + escapeHtml(item.account.type) + ' · ' + daysText + '</span>'
            + '  </div>'
            + '  <button class="detail-btn" type="button" data-action="detail" data-id="' + escapeHtml(item.account.id) + '">详情</button>'
            + '</div>';
        }).join("");
      }

      function renderAccountRow(account) {
        var carrier = CARRIERS[account.carrier];
        var data = computeAccount(account);
        var daysText = data.daysLeft > 0 ? "约 " + data.daysLeft + " 天" : "不足 1 天";
        return ''
          + '<div class="account-row' + (data.warning ? " warning" : "") + '" style="--carrier-color:' + carrier.color + '">'
          + '  <div>'
          + '    <h3 class="number">' + escapeHtml(account.number) + '</h3>'
          + '    <p>' + escapeHtml(account.type) + ' · ' + escapeHtml(carrier.name) + '</p>'
          + '    <div class="row-money money">¥' + money(data.balance, 2) + '</div>'
          + '  </div>'
          + '  <div class="row-side">'
          + '    <span class="days-chip' + (data.warning ? " warning" : "") + '">' + (data.warning ? "预警 · " : "") + daysText + '</span>'
          + '    <button class="detail-btn" type="button" data-action="detail" data-id="' + escapeHtml(account.id) + '">详情</button>'
          + '  </div>'
          + '</div>';
      }

      function renderDetail(accountId) {
        var account = accountById(accountId) || state.accounts[0];
        var carrier = CARRIERS[account.carrier];
        var data = computeAccount(account);

        activeAccountId = account.id;
        els.detailPage.style.setProperty("--carrier-color", carrier.color);
        els.detailPage.style.setProperty("--carrier-color-2", carrier.color2);
        els.detailPage.style.setProperty("--carrier-color-3", carrier.color3 || "#22c55e");
        els.detailTitle.textContent = account.number;
        els.detailAccount.textContent = carrier.name + " · " + account.type;
        els.detailBalance.textContent = money(data.balance, 2);
        els.detailDaysLeft.textContent = data.daysLeft > 0 ? "约 " + data.daysLeft + " 天" : "不足 1 天";
        els.detailUntil.textContent = data.daysLeft > 0 ? readableDate(data.until) : "今天";
        els.dailyFee.textContent = account.billingType === "monthEnd" ? "月末一次扣款" : "¥" + money(data.dailyFee, 3);
        els.monthSettledFee.textContent = "¥" + money(data.monthSettledFee, 2);
        els.daysInMonth.textContent = data.monthDays + " 天";
        els.settledDays.textContent = data.settledDays + " 天";
        els.chargeLabel.textContent = account.billingType === "daily" ? "每日固定扣款额" : (account.billingType === "monthEnd" ? "月末固定扣款额" : "月固定扣款额");
        els.fixedCharge.textContent = account.billingType === "daily" ? "¥" + money(account.dailyCharge, 2) : "¥" + money(account.monthlyCharge, 2);
        els.warningText.textContent = data.warningText;
        els.balancePanel.classList.toggle("warning", data.warning);
        els.balanceInput.value = money(data.balance, 2);
        els.chargeInput.value = account.billingType === "daily" ? trimNumber(account.dailyCharge) : trimNumber(account.monthlyCharge);
        els.warningInput.value = trimNumber(account.warningThreshold);
        els.chargeInputLabel.textContent = account.billingType === "daily" ? "每日固定扣款金额（元）" : (account.billingType === "monthEnd" ? "月末固定扣款金额（元）" : "每月固定扣款金额（元）");
        els.detailUpdated.textContent = formatDateTime(state.lastUpdated);
      }

      function render() {
        settleAll();
        var route = parseRoute();
        if (route.accountId) {
          els.homePage.classList.add("hidden");
          els.detailPage.classList.remove("hidden");
          renderDetail(route.accountId);
        } else {
          els.detailPage.classList.add("hidden");
          els.homePage.classList.remove("hidden");
          renderHome();
        }
        lastRenderedDate = todayKey();
      }

      function parseRoute() {
        var hash = window.location.hash || "#home";
        var match = hash.match(/^#account=(.+)$/);
        return match ? { accountId: decodeURIComponent(match[1]) } : { accountId: "" };
      }

      function navigateHome() {
        if (window.location.hash === "#home" || window.location.hash === "") {
          render();
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        window.location.hash = "home";
      }

      function navigateDetail(accountId) {
        window.location.hash = "account=" + encodeURIComponent(accountId);
      }

      function toggleCarrier(carrierKey) {
        var index = state.openCarriers.indexOf(carrierKey);
        if (index === -1) {
          state.openCarriers.push(carrierKey);
        } else {
          state.openCarriers.splice(index, 1);
        }
        saveState();
        renderHome();
      }

      function toggleAllCarriers() {
        if (areAllCarriersOpen()) {
          state.openCarriers = [];
        } else {
          state.openCarriers = Object.keys(CARRIERS);
        }
        saveState();
        renderHome();
      }

      function saveSettings() {
        var account = accountById(activeAccountId);
        if (!account) return;

        var balance = Number(els.balanceInput.value);
        var charge = Number(els.chargeInput.value);
        var warning = Number(els.warningInput.value);

        if (!Number.isFinite(balance)) return showToast("请输入有效余额");
        if (!Number.isFinite(charge) || charge < 0) return showToast("请输入有效扣款金额");
        if (!Number.isFinite(warning) || warning < 0) return showToast("请输入有效预警阈值");

        account.balance = roundMoney(balance);
        if (account.billingType === "daily") {
          account.dailyCharge = roundMoney(charge);
        } else {
          account.monthlyCharge = roundMoney(charge);
        }
        account.warningThreshold = roundMoney(warning);
        account.lastSettledDate = addDays(todayKey(), -1);
        state.lastUpdated = new Date().toISOString();
        saveState();
        render();
        showToast("设置已保存");
      }

      function addRecharge() {
        var account = accountById(activeAccountId);
        if (!account) return;

        var amount = Number(els.rechargeAmountInput.value);
        if (!Number.isFinite(amount) || amount <= 0) return showToast("请输入有效充值金额");

        account.balance = roundMoney(account.balance + amount);
        account.lastSettledDate = addDays(todayKey(), -1);
        state.lastUpdated = new Date().toISOString();
        saveState();
        els.rechargeAmountInput.value = "";
        render();
        showToast("充值已加入余额");
      }

      function resetCurrentAccount() {
        var account = accountById(activeAccountId);
        var fallback = defaultAccountById(activeAccountId);
        if (!account || !fallback) return;
        if (!window.confirm("恢复此账号默认值会覆盖当前余额，是否继续？")) return;

        Object.keys(fallback).forEach(function (key) {
          account[key] = fallback[key];
        });
        state.lastUpdated = new Date().toISOString();
        saveState();
        render();
        showToast("此账号已恢复默认");
      }

      function refreshNow(showMessage) {
        state.lastUpdated = new Date().toISOString();
        saveState();
        render();
        if (showMessage) showToast("已刷新");
      }

      function showToast(message) {
        window.clearTimeout(toastTimer);
        els.toast.textContent = message;
        els.toast.classList.add("show");
        toastTimer = window.setTimeout(function () {
          els.toast.classList.remove("show");
        }, 1800);
      }

      document.addEventListener("click", function (event) {
        var actionTarget = event.target.closest("[data-action]");
        if (!actionTarget) return;

        var action = actionTarget.getAttribute("data-action");
        if (action === "toggle-carrier") {
          toggleCarrier(actionTarget.getAttribute("data-carrier"));
        }
        if (action === "detail") {
          navigateDetail(actionTarget.getAttribute("data-id"));
        }
      });

      els.refreshBtn.addEventListener("click", function () {
        refreshNow(true);
      });

      els.toggleAllBtn.addEventListener("click", toggleAllCarriers);
      els.backBtn.addEventListener("click", navigateHome);
      els.addRechargeBtn.addEventListener("click", addRecharge);
      els.saveBtn.addEventListener("click", saveSettings);
      els.resetAccountBtn.addEventListener("click", resetCurrentAccount);

      window.addEventListener("hashchange", function () {
        render();
        window.scrollTo({ top: 0, behavior: "smooth" });
      });

      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) refreshNow(false);
      });

      render();

      if (!window.location.hash) {
        window.history.replaceState(null, "", "#home");
      }

      window.setInterval(function () {
        if (lastRenderedDate !== todayKey()) {
          refreshNow(false);
        } else {
          els.homeUpdated.textContent = formatDateTime(state.lastUpdated);
          els.detailUpdated.textContent = formatDateTime(state.lastUpdated);
        }
      }, 30000);
    })();
