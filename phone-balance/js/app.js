(function () {
      "use strict";

      var STORAGE_KEY = "phone_balance_overview_v3";
      var CLOUD_SYNC = {
        enabled: true,
        supabaseUrl: "https://rhkzsyhxezlppfxqzalm.supabase.co",
        anonKey: "sb_publishable_jg7Ht5A1SXFfkn4VZImQKA_eAHoh5uZ",
        table: "balance_state",
        rowId: "china_broadcasting"
      };

      var CARRIERS = {
        broadcasting: { name: "中国广电", logo: "广", icon: "svg/中国广电.svg", color: "#0f766e", color2: "#14b8a6" },
        telecom: { name: "中国电信", logo: "电", icon: "svg/中国电信.svg", color: "#2563eb", color2: "#38bdf8" },
        mobile: { name: "中国移动", logo: "移", icon: "svg/中国移动.svg", color: "#16a34a", color2: "#22c55e" },
        unicom: { name: "中国联通", logo: "联", icon: "svg/中国联通.svg", color: "#f87171", color2: "#fb923c", color3: "#fbbf24" }
      };

      var DEFAULT_STATE = {
        lastUpdated: "2026-06-16T00:00:00+08:00",
        modifiedAt: "2026-06-16T00:00:00+08:00",
        openCarriers: ["broadcasting"],
        accountDefaults: {},
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
      var currentRoute = parseRoute();
      var homeScrollY = 0;
      var toastTimer = null;
      var cloudReady = false;
      var cloudBusy = false;
      var pushTimer = null;
      var syncState = {
        mode: "local",
        title: "本地存储",
        text: "当前设备仍可离线使用；接入云端后，同一网址下的账号数据可在多设备之间自动同步。",
        syncedAt: ""
      };

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
        warningInputLabel: document.getElementById("warningInputLabel"),
        warningInput: document.getElementById("warningInput"),
        warningEnabledInput: document.getElementById("warningEnabledInput"),
        warningModeInput: document.getElementById("warningModeInput"),
        warningCooldownInput: document.getElementById("warningCooldownInput"),
        warningChannelInput: document.getElementById("warningChannelInput"),
        notifySummary: document.getElementById("notifySummary"),
        rechargeAmountInput: document.getElementById("rechargeAmountInput"),
        addRechargeBtn: document.getElementById("addRechargeBtn"),
        syncNowBtn: document.getElementById("syncNowBtn"),
        syncMode: document.getElementById("syncMode"),
        syncTitle: document.getElementById("syncTitle"),
        syncText: document.getElementById("syncText"),
        syncLastAt: document.getElementById("syncLastAt"),
        syncDot: document.getElementById("syncDot"),
        saveBtn: document.getElementById("saveBtn"),
        resetAccountBtn: document.getElementById("resetAccountBtn"),
        setDefaultBtn: document.getElementById("setDefaultBtn"),
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

      function rawDefaultState() {
        return JSON.parse(JSON.stringify(DEFAULT_STATE));
      }

      function cloneDefault() {
        return normalizeState(rawDefaultState());
      }

      function cloneStateSnapshot(input) {
        return JSON.parse(JSON.stringify(input || state));
      }

      function normalizeState(input) {
        var next = Object.assign(rawDefaultState(), input || {});
        var defaults = rawDefaultState().accounts;
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
        next.accountDefaults = normalizeAccountDefaults(input && input.accountDefaults, defaults);
        next.lastUpdated = next.lastUpdated || DEFAULT_STATE.lastUpdated;
        next.modifiedAt = next.modifiedAt || next.lastUpdated || DEFAULT_STATE.modifiedAt;
        return next;
      }

      function normalizeAccountDefaults(input, defaults) {
        var output = {};
        var source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
        defaults.forEach(function (fallback) {
          var account = source[fallback.id];
          if (account && typeof account === "object") {
            output[fallback.id] = normalizeAccount(Object.assign({}, fallback, account), fallback);
          }
        });
        return output;
      }

      function normalizeAccount(account, fallback) {
        account.balance = safeNumber(account.balance, fallback.balance);
        account.monthlyCharge = safeNumber(account.monthlyCharge, fallback.monthlyCharge || 0);
        account.dailyCharge = safeNumber(account.dailyCharge, fallback.dailyCharge || 0);
        account.warningThreshold = safeNumber(account.warningThreshold, fallback.warningThreshold || 0);
        account.billingType = normalizeBillingType(account.billingType, fallback.billingType, account.carrier);
        account.lastSettledDate = isDateKey(account.lastSettledDate) ? account.lastSettledDate : fallback.lastSettledDate;
        applyDefaultWarningSettings(account, fallback);
        return account;
      }

      function defaultWarningSettings(account) {
        if (account && account.billingType === "daily") {
          return {
            warningEnabled: true,
            warningMode: "balance",
            warningThreshold: 8,
            warningCooldownHours: 24,
            warningChannel: "wxpusher",
            warningLastNotifiedAt: ""
          };
        }

        return {
          warningEnabled: true,
          warningMode: "days",
          warningThreshold: 30,
          warningCooldownHours: 24,
          warningChannel: "wxpusher",
          warningLastNotifiedAt: ""
        };
      }

      function normalizeWarningMode(value, fallback) {
        return value === "days" ? "days" : "balance";
      }

      function normalizeWarningChannel(value, fallback) {
        if (value === "sms" || value === "browser" || value === "wxpusher") return value;
        return fallback || "wxpusher";
      }

      function applyDefaultWarningSettings(account, fallback) {
        var defaults = defaultWarningSettings(account);
        account.warningEnabled = typeof account.warningEnabled === "boolean"
          ? account.warningEnabled
          : (typeof fallback.warningEnabled === "boolean" ? fallback.warningEnabled : defaults.warningEnabled);
        account.warningMode = normalizeWarningMode(account.warningMode, fallback.warningMode || defaults.warningMode);
        account.warningThreshold = safeNumber(account.warningThreshold, safeNumber(fallback.warningThreshold, defaults.warningThreshold));
        account.warningCooldownHours = safeNumber(account.warningCooldownHours, safeNumber(fallback.warningCooldownHours, defaults.warningCooldownHours));
        account.warningChannel = normalizeWarningChannel(account.warningChannel, fallback.warningChannel || defaults.warningChannel);
        account.warningLastNotifiedAt = typeof account.warningLastNotifiedAt === "string"
          ? account.warningLastNotifiedAt
          : (typeof fallback.warningLastNotifiedAt === "string" ? fallback.warningLastNotifiedAt : defaults.warningLastNotifiedAt);
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

      function serializeCloudState(snapshot) {
        var source = normalizeState(snapshot || state);
        return {
          schemaVersion: 3,
          modifiedAt: source.modifiedAt,
          lastUpdated: source.lastUpdated,
          accountDefaults: serializeAccountDefaults(source.accountDefaults),
          accounts: source.accounts.map(function (account) {
            return serializeAccount(account);
          })
        };
      }

      function serializeAccountDefaults(defaults) {
        var output = {};
        Object.keys(defaults || {}).forEach(function (id) {
          output[id] = serializeAccount(defaults[id]);
        });
        return output;
      }

      function serializeAccount(account) {
        return {
          id: account.id,
          carrier: account.carrier,
          type: account.type,
          number: account.number,
          billingType: account.billingType,
          balance: roundMoney(account.balance),
          lastSettledDate: account.lastSettledDate,
          monthlyCharge: roundMoney(account.monthlyCharge || 0),
          dailyCharge: roundMoney(account.dailyCharge || 0),
          warningThreshold: roundMoney(account.warningThreshold || 0),
          warningEnabled: account.warningEnabled !== false,
          warningMode: account.warningMode || "balance",
          warningCooldownHours: roundMoney(account.warningCooldownHours || 24),
          warningChannel: account.warningChannel || "wxpusher",
          warningLastNotifiedAt: account.warningLastNotifiedAt || ""
        };
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

      function dateKeyFromDate(date) {
        return dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
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

      function monthDayText(key) {
        var parts = partsFromKey(key);
        return parts.month + "月" + parts.day + "日";
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

      function billingStandardText(account, dailyFee) {
        if (account.billingType === "daily") {
          return "日费 ¥" + money(account.dailyCharge, 2) + "/天，每日结算";
        }

        if (account.billingType === "monthEnd") {
          return "月费 ¥" + money(account.monthlyCharge, 2) + "/月，月末一次扣费";
        }

        return "月费 ¥" + money(account.monthlyCharge, 2) + "/月，按当月天数折算为 ¥" + money(dailyFee, 3) + "/天";
      }

      function monthEndProjection(account, today) {
        var monthlyCharge = safeNumber(account.monthlyCharge, 0);
        var balance = roundMoney(account.balance);
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

      function chargeRuleText(account, data) {
        if (account.billingType === "daily") {
          return "按日扣费：每天结束后扣 ¥" + money(account.dailyCharge, 2) + "。";
        }

        if (account.billingType === "monthEnd") {
          return "月末扣费：每月最后一天一次扣 ¥" + money(account.monthlyCharge, 2) + "。";
        }

        return "按月折算：每月固定扣 ¥" + money(account.monthlyCharge, 2) + "，本月按每天 ¥" + money(data.dailyFee, 3) + " 结算。";
      }

      function timeValue(value) {
        var timestamp = new Date(value || 0).getTime();
        return Number.isFinite(timestamp) ? timestamp : 0;
      }

      function stateModifiedTime(snapshot) {
        return timeValue(snapshot && (snapshot.modifiedAt || snapshot.lastUpdated));
      }

      function buildLegacyMergedState(remoteData, baseState, rowUpdatedAt) {
        if (!remoteData || (remoteData.anchorBalance == null && remoteData.monthlyCharge == null && remoteData.warningThreshold == null && !remoteData.lastSettledDate)) {
          return null;
        }

        var merged = cloneStateSnapshot(baseState || cloneDefault());
        var account = merged.accounts.find(function (item) {
          return item.id === "broadcasting-19290397571";
        });
        if (!account) return null;

        account.balance = safeNumber(remoteData.anchorBalance, account.balance);
        account.monthlyCharge = safeNumber(remoteData.monthlyCharge, account.monthlyCharge);
        account.warningThreshold = safeNumber(remoteData.warningThreshold, account.warningThreshold);
        account.lastSettledDate = isDateKey(remoteData.lastSettledDate) ? remoteData.lastSettledDate : account.lastSettledDate;
        merged.lastUpdated = remoteData.lastUpdated || rowUpdatedAt || merged.lastUpdated;
        merged.modifiedAt = remoteData.modifiedAt || remoteData.lastUpdated || rowUpdatedAt || merged.modifiedAt;
        return normalizeState(merged);
      }

      function decodeRemoteState(row, baseState) {
        if (!row || !row.data) return null;
        var remoteData = row.data;
        if (Array.isArray(remoteData.accounts)) {
          return normalizeState({
            lastUpdated: remoteData.lastUpdated || row.updated_at || (baseState && baseState.lastUpdated),
            modifiedAt: remoteData.modifiedAt || remoteData.lastUpdated || row.updated_at || (baseState && baseState.modifiedAt),
            openCarriers: (baseState && baseState.openCarriers) || cloneDefault().openCarriers,
            accountDefaults: remoteData.accountDefaults || (baseState && baseState.accountDefaults),
            accounts: remoteData.accounts
          });
        }
        return buildLegacyMergedState(remoteData, baseState, row.updated_at);
      }

      function remoteNeedsMigration(row) {
        return Boolean(row && row.data && !Array.isArray(row.data.accounts));
      }

      function isCloudConfigured() {
        return Boolean(
          CLOUD_SYNC.enabled &&
          CLOUD_SYNC.supabaseUrl &&
          CLOUD_SYNC.anonKey &&
          CLOUD_SYNC.table &&
          CLOUD_SYNC.rowId &&
          window.fetch
        );
      }

      function cloudEndpoint() {
        return CLOUD_SYNC.supabaseUrl.replace(/\/+$/, "") + "/rest/v1/" + encodeURIComponent(CLOUD_SYNC.table);
      }

      function cloudHeaders(extra) {
        var headers = {
          apikey: CLOUD_SYNC.anonKey,
          Authorization: "Bearer " + CLOUD_SYNC.anonKey,
          "Content-Type": "application/json"
        };
        Object.keys(extra || {}).forEach(function (key) {
          headers[key] = extra[key];
        });
        return headers;
      }

      function renderSyncStatus(mode, message, syncedAt) {
        if (mode) syncState.mode = mode;
        if (message) syncState.text = message;
        if (syncedAt) syncState.syncedAt = syncedAt;

        if (!isCloudConfigured()) {
          syncState.mode = "local";
          syncState.title = "本地存储";
          syncState.text = "当前设备仍可离线使用；接入云端后，同一网址下的账号数据可在多设备之间自动同步。";
        } else if (syncState.mode === "busy") {
          syncState.title = "正在同步";
        } else if (syncState.mode === "error") {
          syncState.title = "同步异常";
        } else {
          syncState.mode = "ready";
          syncState.title = "云端同步已开启";
        }

        if (!els.syncMode) return;

        els.syncDot.className = "sync-dot";
        if (syncState.mode === "busy") {
          els.syncMode.textContent = "同步中";
          els.syncDot.classList.add("busy");
        } else if (syncState.mode === "error") {
          els.syncMode.textContent = "异常";
          els.syncDot.classList.add("error");
        } else if (syncState.mode === "ready") {
          els.syncMode.textContent = "云端";
          els.syncDot.classList.add("ready");
        } else {
          els.syncMode.textContent = "本地";
        }

        els.syncTitle.textContent = syncState.title;
        els.syncText.textContent = syncState.text;
        els.syncLastAt.textContent = syncState.syncedAt ? formatDateTime(syncState.syncedAt) : "--";
      }

      function isRemoteNewer(remoteState, localState) {
        var remoteTime = stateModifiedTime(remoteState);
        var localTime = stateModifiedTime(localState);
        return remoteTime > localTime;
      }

      function scheduleCloudPush(delay) {
        if (!cloudReady || !isCloudConfigured()) return;
        window.clearTimeout(pushTimer);
        pushTimer = window.setTimeout(function () {
          if (cloudBusy) {
            scheduleCloudPush(500);
            return;
          }
          pushCloudState(false);
        }, typeof delay === "number" ? delay : 700);
      }

      function flushCloudPush(showMessage) {
        if (!isCloudConfigured()) return Promise.resolve(false);
        if (!cloudReady) {
          scheduleCloudPush(700);
          return Promise.resolve(false);
        }
        window.clearTimeout(pushTimer);
        if (cloudBusy) {
          scheduleCloudPush(500);
          return Promise.resolve(false);
        }
        return pushCloudState(Boolean(showMessage));
      }

      function pullCloudState(showMessage) {
        if (!isCloudConfigured() || cloudBusy) return Promise.resolve(false);

        cloudBusy = true;
        renderSyncStatus("busy", "正在读取云端数据。");

        var localState = normalizeState(cloneStateSnapshot(state));
        var url = cloudEndpoint()
          + "?id=eq." + encodeURIComponent(CLOUD_SYNC.rowId)
          + "&select=id,data,updated_at";

        return fetch(url, { headers: cloudHeaders() })
          .then(function (response) {
            if (!response.ok) throw new Error("读取失败 " + response.status);
            return response.json();
          })
          .then(function (rows) {
            var row = rows && rows[0];
            var remoteState = decodeRemoteState(row, localState);
            var needsMigration = remoteNeedsMigration(row);

            cloudReady = true;

            if (remoteState && isRemoteNewer(remoteState, localState)) {
              state = remoteState;
              settleAll();
              saveState();
              render();
              if (needsMigration) {
                scheduleCloudPush(0);
              }
              renderSyncStatus("ready", "已使用云端最新数据。", row.updated_at || remoteState.modifiedAt);
              if (showMessage) showToast("已同步云端数据");
              return true;
            }

            if (!row || !remoteState || needsMigration || isRemoteNewer(localState, remoteState)) {
              scheduleCloudPush(0);
            }

            renderSyncStatus("ready", row ? "当前设备数据已接入云端。": "正在创建首份云端数据。", row && (row.updated_at || (row.data && row.data.modifiedAt)));
            if (showMessage) showToast(row ? "同步检查已完成" : "正在创建云端数据");
            return false;
          })
          .catch(function (error) {
            renderSyncStatus("error", error.message || "云端暂时不可用，已保留本地数据。");
            if (showMessage) showToast("云端暂时不可用");
            return false;
          })
          .finally(function () {
            cloudBusy = false;
          });
      }

      function pushCloudState(showMessage) {
        if (!isCloudConfigured() || cloudBusy) return Promise.resolve(false);

        cloudBusy = true;
        renderSyncStatus("busy", "正在保存到云端。");

        var body = JSON.stringify({
          id: CLOUD_SYNC.rowId,
          data: serializeCloudState(state),
          updated_at: new Date().toISOString()
        });

        return fetch(cloudEndpoint() + "?on_conflict=id", {
          method: "POST",
          headers: cloudHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
          body: body
        })
          .then(function (response) {
            if (!response.ok) throw new Error("保存失败 " + response.status);
            var syncedAt = new Date().toISOString();
            renderSyncStatus("ready", "云端数据已保存。", syncedAt);
            if (showMessage) showToast("已同步到云端");
            return true;
          })
          .catch(function (error) {
            renderSyncStatus("error", error.message || "云端保存失败，已保留本地数据。");
            if (showMessage) showToast("云端保存失败");
            return false;
          })
          .finally(function () {
            cloudBusy = false;
          });
      }

      function syncNow() {
        if (!isCloudConfigured()) {
          renderSyncStatus();
          return showToast("当前仅本地存储");
        }
        pullCloudState(false).then(function () {
          if (cloudBusy) return;
          pushCloudState(true);
        });
      }

      function setupCloudSync() {
        if (!isCloudConfigured()) {
          renderSyncStatus();
          return;
        }
        pullCloudState(false);
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
          var now = new Date().toISOString();
          state.lastUpdated = now;
          state.modifiedAt = now;
          saveState();
          scheduleCloudPush();
        }
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

      function warningThresholdLabel(mode) {
        return mode === "days" ? "预计可用天数阈值（天）" : "余额预警阈值（元）";
      }

      function warningRuleText(account) {
        if (account.warningEnabled === false) {
          return "当前账号已关闭提醒规则。";
        }

        if (account.warningMode === "days") {
          return "预计可用时间低于 " + trimNumber(account.warningThreshold) + " 天时触发提醒，默认 " + trimNumber(account.warningCooldownHours || 24) + " 小时内不重复提醒。";
        }

        return "余额低于 ¥" + money(account.warningThreshold, 2) + " 时触发提醒，默认 " + trimNumber(account.warningCooldownHours || 24) + " 小时内不重复提醒。";
      }

      function warningStatus(account, data) {
        var mode = normalizeWarningMode(account.warningMode);
        var threshold = safeNumber(account.warningThreshold, 0);
        var comparableDays = typeof data.attentionDays === "number" ? data.attentionDays : data.daysLeft;
        var triggered = false;
        var reason = "";

        if (account.warningEnabled === false) {
          return {
            enabled: false,
            mode: mode,
            threshold: threshold,
            triggered: false,
            reason: "当前账号未启用提醒。",
            summary: warningRuleText(account)
          };
        }

        if (mode === "days") {
          triggered = comparableDays <= threshold;
          reason = triggered
            ? (comparableDays > 0
              ? "预计仅剩约 " + comparableDays + " 天，已低于 " + trimNumber(threshold) + " 天提醒线"
              : "预计可用时间已不足 1 天")
            : "预计可用约 " + comparableDays + " 天";
        } else {
          triggered = data.balance <= threshold;
          reason = triggered
            ? (data.balance < 0
              ? "当前已欠费 ¥" + money(Math.abs(data.balance), 2)
              : "余额已低于提醒线 ¥" + money(threshold, 2))
            : "当前余额 ¥" + money(data.balance, 2);
        }

        return {
          enabled: true,
          mode: mode,
          threshold: threshold,
          triggered: triggered,
          reason: reason,
          summary: warningRuleText(account)
        };
      }

      function updateWarningInputLabel() {
        if (!els.warningInputLabel || !els.warningModeInput) return;
        els.warningInputLabel.textContent = warningThresholdLabel(els.warningModeInput.value);
      }

      function computeAccount(account) {
        var today = todayKey();
        var todayParts = partsFromKey(today);
        var monthDays = daysInMonthFor(todayParts.year, todayParts.month);
        var settledDays = account.billingType === "monthEnd" ? 0 : Math.max(0, todayParts.day - 1);
        var dailyFee = dailyFeeFor(account, today);
        var estimate = estimateUsage(account.balance, account, today);
        var monthEndInfo = account.billingType === "monthEnd" ? monthEndProjection(account, today) : null;
        var attentionDate = monthEndInfo ? monthEndInfo.attentionDate : estimate.until;
        var attentionDays = monthEndInfo ? daysUntilKey(today, attentionDate) : estimate.days;
        var statusLabel = monthEndInfo
          ? (monthEndInfo.fullMonthsSupported > 0
            ? "可撑 " + monthEndInfo.fullMonthsSupported + " 个整月"
            : "本月末需关注")
          : (estimate.days > 0 ? "约 " + estimate.days + " 天" : "不足 1 天");
        var status = warningStatus(account, {
          balance: roundMoney(account.balance),
          daysLeft: attentionDays,
          attentionDays: attentionDays
        });

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
          daysLeft: attentionDays,
          until: attentionDate,
          estimatedUsageDays: estimate.days,
          estimatedUsageUntil: estimate.until,
          nextChargeDate: monthEndInfo ? monthEndInfo.nextChargeDate : "",
          fullMonthsSupported: monthEndInfo ? monthEndInfo.fullMonthsSupported : 0,
          postChargeBalance: monthEndInfo ? monthEndInfo.postChargeBalance : roundMoney(account.balance - dailyFee),
          feeStandardText: billingStandardText(account, dailyFee),
          chargeRuleText: chargeRuleText(account, { dailyFee: dailyFee }),
          attentionLabel: statusLabel,
          attentionMeta: monthEndInfo
            ? ("下次扣费 " + monthDayText(monthEndInfo.nextChargeDate))
            : (estimate.days > 0 ? ("至 " + readableDate(estimate.until)) : "今日用完后将触发扣费"),
          warning: status.triggered,
          warningMode: status.mode,
          warningThreshold: status.threshold,
          warningText: status.reason,
          warningRuleText: status.summary
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

      function builtInDefaultAccountById(id) {
        return DEFAULT_STATE.accounts.find(function (account) {
          return account.id === id;
        });
      }

      function defaultAccountById(id) {
        var account = (state.accountDefaults && state.accountDefaults[id]) || builtInDefaultAccountById(id);
        return account ? JSON.parse(JSON.stringify(account)) : null;
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
          if (compareKeys(item.data.until, best.data.until) !== 0) {
            return compareKeys(item.data.until, best.data.until) < 0 ? item : best;
          }
          return item.data.balance < best.data.balance ? item : best;
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
        var soonestLabel = els.overviewSoonest && els.overviewSoonest.parentNode ? els.overviewSoonest.parentNode.querySelector("span") : null;
        var soonestTitle = soonest ? (CARRIERS[soonest.account.carrier].name + " · " + soonest.account.number) : "";
        var soonestDate = soonest ? (soonest.data.until ? readableDate(soonest.data.until) : "今天") : "--";

        els.overviewBalance.textContent = money(stats.total, 2);
        els.overviewAccounts.textContent = stats.accountCount + " 个";
        els.overviewWarningTag.textContent = warningCount > 0 ? warningCount + " 个预警" : "全部正常";
        if (soonestLabel) {
          soonestLabel.textContent = "最早需要关注";
        }
        els.overviewSoonest.innerHTML = soonest
          ? ('<span class="soonest-main">' + escapeHtml(soonestDate) + '</span><small>' + escapeHtml(soonestTitle) + '</small>')
          : "--";
        els.overviewNote.textContent = warningCount > 0
          ? "已有账号触发提醒规则，建议优先查看预警账号；本页仅做本地估算，不代表运营商实时余额。"
          : (soonest
            ? ("最早需要关注的是 " + CARRIERS[soonest.account.carrier].name + " " + soonest.account.number + "，页面仅做本地估算。")
            : "当日费用尚未扣除，页面只根据本地保存余额进行估算。");
        els.overviewCard.classList.toggle("warning", warningCount > 0);
      }

      function renderWarnings(items) {
        var warnings = items.filter(function (item) {
          return item.data.warning;
        }).sort(function (a, b) {
          if (compareKeys(a.data.until, b.data.until) !== 0) return compareKeys(a.data.until, b.data.until);
          return a.data.balance - b.data.balance;
        });

        els.warningSummary.textContent = warnings.length > 0 ? warnings.length + " 个需要关注" : "暂无预警";
        els.warningSection.classList.toggle("safe", warnings.length === 0);
        if (warnings.length === 0) {
          els.warningList.innerHTML = '<p>当前没有触发提醒规则的账号。</p>';
          return;
        }

        els.warningList.innerHTML = warnings.map(function (item) {
          return ''
            + '<div class="warning-item" style="--carrier-color:' + item.carrier.color + '">'
            + '  <div>'
            + '    <strong>' + escapeHtml(item.account.number) + '</strong>'
            + '    <span>' + escapeHtml(item.carrier.name) + ' · ' + escapeHtml(item.account.type) + ' · ' + escapeHtml(item.data.attentionLabel) + ' · ' + escapeHtml(item.data.feeStandardText) + '</span>'
            + '  </div>'
            + '  <button class="detail-btn" type="button" data-action="detail" data-id="' + escapeHtml(item.account.id) + '">详情</button>'
            + '</div>';
        }).join("");
      }

      function renderAccountRow(account) {
        var carrier = CARRIERS[account.carrier];
        var data = computeAccount(account);
        return ''
          + '<div class="account-row' + (data.warning ? " warning" : "") + '" style="--carrier-color:' + carrier.color + '">'
          + '  <div>'
          + '    <h3 class="number">' + escapeHtml(account.number) + '</h3>'
          + '    <p>' + escapeHtml(account.type) + ' · ' + escapeHtml(carrier.name) + ' · ' + escapeHtml(data.feeStandardText) + '</p>'
          + '    <div class="row-money money">¥' + money(data.balance, 2) + '</div>'
          + '  </div>'
          + '  <div class="row-side">'
          + '    <span class="days-chip' + (data.warning ? " warning" : "") + '">' + (data.warning ? "预警 · " : "") + escapeHtml(data.attentionLabel) + '</span>'
          + '    <button class="detail-btn" type="button" data-action="detail" data-id="' + escapeHtml(account.id) + '">详情</button>'
          + '  </div>'
          + '</div>';
      }

      function balanceRiskClass(data) {
        if (data.warning) return "risk-red";
        if (data.daysLeft < 30) return "risk-orange";
        if (data.daysLeft < 90) return "risk-green";
        return "risk-blue";
      }

      function renderDetail(accountId) {
        var account = accountById(accountId) || state.accounts[0];
        var carrier = CARRIERS[account.carrier];
        var data = computeAccount(account);
        var primaryMetricLabel = els.detailDaysLeft && els.detailDaysLeft.parentNode ? els.detailDaysLeft.parentNode.querySelector("span") : null;
        var primaryMetricSubline = els.detailUntil && els.detailUntil.parentNode ? els.detailUntil.parentNode : null;
        var dailyFeeLabel = els.dailyFee ? els.dailyFee.previousElementSibling : null;
        var chargeDetailHint = document.querySelector(".charge-detail-body p");

        activeAccountId = account.id;
        els.detailPage.style.setProperty("--carrier-color", carrier.color);
        els.detailPage.style.setProperty("--carrier-color-2", carrier.color2);
        els.detailPage.style.setProperty("--carrier-color-3", carrier.color3 || "#22c55e");
        els.detailTitle.textContent = account.number;
        els.detailAccount.textContent = carrier.name + " · " + account.type;
        els.detailBalance.textContent = money(data.balance, 2);
        if (primaryMetricLabel) {
          primaryMetricLabel.textContent = account.billingType === "monthEnd" ? "可撑完整月租" : "预计可用";
        }
        els.detailDaysLeft.textContent = account.billingType === "monthEnd"
          ? (data.fullMonthsSupported + " 个")
          : (data.estimatedUsageDays > 0 ? "约 " + data.estimatedUsageDays + " 天" : "不足 1 天");
        if (primaryMetricSubline) {
          primaryMetricSubline.childNodes[0].nodeValue = account.billingType === "monthEnd" ? "下次扣费 " : "至 ";
        }
        els.detailUntil.textContent = account.billingType === "monthEnd"
          ? readableDate(data.nextChargeDate)
          : (data.estimatedUsageDays > 0 ? readableDate(data.estimatedUsageUntil) : "今天");
        if (dailyFeeLabel) {
          dailyFeeLabel.textContent = account.billingType === "monthEnd" ? "计费方式" : "每日扣费金额";
        }
        els.dailyFee.textContent = account.billingType === "monthEnd" ? data.feeStandardText : "¥" + money(data.dailyFee, 3);
        els.monthSettledFee.textContent = "¥" + money(data.monthSettledFee, 2);
        els.daysInMonth.textContent = data.monthDays + " 天";
        els.settledDays.textContent = data.settledDays + " 天";
        els.chargeLabel.textContent = account.billingType === "daily" ? "每日固定扣款额" : (account.billingType === "monthEnd" ? "月末固定扣款额" : "月固定扣款额");
        els.fixedCharge.textContent = account.billingType === "daily" ? "¥" + money(account.dailyCharge, 2) : "¥" + money(account.monthlyCharge, 2);
        if (chargeDetailHint) {
          chargeDetailHint.textContent = account.billingType === "monthEnd"
            ? ("当前余额可支撑 " + data.fullMonthsSupported + " 个完整月租，下次扣费日为 " + readableDate(data.nextChargeDate) + "。")
            : data.chargeRuleText;
        }
        els.warningText.textContent = data.warningText;
        els.balancePanel.classList.remove("risk-blue", "risk-green", "risk-orange", "risk-red");
        els.balancePanel.classList.add(balanceRiskClass(data));
        els.balancePanel.classList.toggle("warning", data.warning);
        els.balanceInput.value = money(data.balance, 2);
        els.chargeInput.value = account.billingType === "daily" ? trimNumber(account.dailyCharge) : trimNumber(account.monthlyCharge);
        els.warningInput.value = trimNumber(account.warningThreshold);
        els.warningEnabledInput.checked = account.warningEnabled !== false;
        els.warningModeInput.value = account.warningMode === "days" ? "days" : "balance";
        els.warningCooldownInput.value = trimNumber(account.warningCooldownHours || 24);
        els.warningChannelInput.value = account.warningChannel || "wxpusher";
        updateWarningInputLabel();
        if (els.notifySummary) {
          els.notifySummary.textContent = data.warningRuleText;
        }
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
        renderSyncStatus();
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
          return;
        }
        window.location.hash = "home";
      }

      function navigateDetail(accountId) {
        if (!parseRoute().accountId) {
          homeScrollY = window.scrollY || window.pageYOffset || 0;
        }
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

      function readSettingsForm() {
        var balance = Number(els.balanceInput.value);
        var charge = Number(els.chargeInput.value);
        var warning = Number(els.warningInput.value);
        var cooldown = Number(els.warningCooldownInput.value);

        if (!Number.isFinite(balance)) return showToast("请输入有效余额");
        if (!Number.isFinite(charge) || charge < 0) return showToast("请输入有效扣款金额");
        if (!Number.isFinite(warning) || warning < 0) return showToast("请输入有效预警阈值");
        if (!Number.isFinite(cooldown) || cooldown < 1) return showToast("请输入有效提醒间隔");

        return {
          balance: roundMoney(balance),
          charge: roundMoney(charge),
          warningThreshold: roundMoney(warning),
          warningEnabled: Boolean(els.warningEnabledInput && els.warningEnabledInput.checked),
          warningMode: els.warningModeInput && els.warningModeInput.value === "days" ? "days" : "balance",
          warningCooldownHours: Math.max(1, Math.round(cooldown)),
          warningChannel: els.warningChannelInput ? els.warningChannelInput.value : "wxpusher"
        };
      }

      function applySettingsToAccount(account, values) {
        account.balance = values.balance;
        if (account.billingType === "daily") {
          account.dailyCharge = values.charge;
        } else {
          account.monthlyCharge = values.charge;
        }
        account.warningThreshold = values.warningThreshold;
        account.warningEnabled = values.warningEnabled;
        account.warningMode = values.warningMode;
        account.warningCooldownHours = values.warningCooldownHours;
        account.warningChannel = values.warningChannel;
        account.warningLastNotifiedAt = "";
        account.lastSettledDate = addDays(todayKey(), -1);
      }

      function saveSettings() {
        var account = accountById(activeAccountId);
        var values = readSettingsForm();
        if (!account || !values) return;

        applySettingsToAccount(account, values);
        var now = new Date().toISOString();
        state.lastUpdated = now;
        state.modifiedAt = now;
        saveState();
        flushCloudPush(false);
        render();
        showToast("设置已保存");
      }

      function setCurrentAsDefault() {
        var account = accountById(activeAccountId);
        var values = readSettingsForm();
        if (!account || !values) return;

        var fallback = builtInDefaultAccountById(account.id) || account;
        var nextDefault = normalizeAccount(Object.assign({}, fallback, account), fallback);
        applySettingsToAccount(nextDefault, values);
        state.accountDefaults = state.accountDefaults || {};
        state.accountDefaults[account.id] = nextDefault;
        var now = new Date().toISOString();
        state.lastUpdated = now;
        state.modifiedAt = now;
        saveState();
        flushCloudPush(false);
        showToast("当前配置已设为默认值");
      }

      function addRecharge() {
        var account = accountById(activeAccountId);
        if (!account) return;

        var amount = Number(els.rechargeAmountInput.value);
        if (!Number.isFinite(amount) || amount <= 0) return showToast("请输入有效充值金额");

        account.balance = roundMoney(account.balance + amount);
        account.lastSettledDate = addDays(todayKey(), -1);
        var now = new Date().toISOString();
        state.lastUpdated = now;
        state.modifiedAt = now;
        saveState();
        flushCloudPush(false);
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
        account.lastSettledDate = addDays(todayKey(), -1);
        applyDefaultWarningSettings(account, builtInDefaultAccountById(activeAccountId) || fallback);
        var now = new Date().toISOString();
        state.lastUpdated = now;
        state.modifiedAt = now;
        saveState();
        flushCloudPush(false);
        render();
        showToast("此账号已恢复默认");
      }

      function refreshNow(showMessage) {
        state.lastUpdated = new Date().toISOString();
        saveState();
        render();
        pullCloudState(false);
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
      if (els.syncNowBtn) {
        els.syncNowBtn.addEventListener("click", syncNow);
      }
      els.saveBtn.addEventListener("click", saveSettings);
      els.resetAccountBtn.addEventListener("click", resetCurrentAccount);
      if (els.setDefaultBtn) {
        els.setDefaultBtn.addEventListener("click", setCurrentAsDefault);
      }
      if (els.warningModeInput) {
        els.warningModeInput.addEventListener("change", updateWarningInputLabel);
      }

      window.addEventListener("hashchange", function () {
        var previousRoute = currentRoute;
        var nextRoute = parseRoute();
        if (!previousRoute.accountId && nextRoute.accountId) {
          homeScrollY = window.scrollY || window.pageYOffset || 0;
        }
        currentRoute = nextRoute;
        render();
        if (nextRoute.accountId) {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else if (previousRoute.accountId) {
          window.requestAnimationFrame(function () {
            window.scrollTo({ top: homeScrollY, behavior: "auto" });
          });
        }
      });

      document.addEventListener("visibilitychange", function () {
        if (!document.hidden) refreshNow(false);
      });

      window.addEventListener("online", function () {
        pullCloudState(false);
      });

      render();
      setupCloudSync();

      if (!window.location.hash) {
        window.history.replaceState(null, "", "#home");
      }

      window.setInterval(function () {
        if (lastRenderedDate !== todayKey()) {
          refreshNow(false);
        } else {
          els.homeUpdated.textContent = formatDateTime(state.lastUpdated);
          els.detailUpdated.textContent = formatDateTime(state.lastUpdated);
          if (!document.hidden) pullCloudState(false);
        }
      }, 30000);
    })();
