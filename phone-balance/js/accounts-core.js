(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./billing-core.js"));
  else root.PhoneBalanceAccounts = factory(root.PhoneBalanceBilling);
})(typeof globalThis !== "undefined" ? globalThis : this, function (billing) {
  "use strict";

  function isActive(account) {
    return billing.isActive(account);
  }

  function isVisible(account) {
    return Boolean(account && !account.deleted && !account.hidden);
  }

  // An explicitly empty list is authoritative; built-in accounts are only seed data.
  function normalizeAccounts(input, defaults, carriers, normalize) {
    var seeds = {};
    defaults.forEach(function (account) { seeds[account.id] = account; });
    var source = Array.isArray(input) ? input : defaults;
    var seen = {};
    return source.filter(function (account) {
      if (!account || typeof account.id !== "string" || !account.id || seen[account.id]) return false;
      if (!Object.prototype.hasOwnProperty.call(carriers, account.carrier)) return false;
      seen[account.id] = true;
      return true;
    }).map(function (account) {
      var fallback = seeds[account.id] || {
        balance: 0, monthlyCharge: 0, dailyCharge: 0, warningThreshold: 10,
        billingType: "monthEnd", lastSettledDate: account.lastSettledDate
      };
      return normalize(Object.assign({}, fallback, account), fallback);
    });
  }

  function changeStatus(account, status, today, billing) {
    var wasActive = isActive(account);
    if (wasActive) billing.settleAccount(account, today);
    account.status = status;
    // Resuming starts today and never charges for days spent paused or closed.
    if (!wasActive && isActive(account)) account.lastSettledDate = billing.addDays(today, -1);
  }

  function monthlyCost(account, monthDays) {
    if (!isActive(account)) return 0;
    return account.billingType === "daily" ? account.dailyCharge * monthDays : account.monthlyCharge;
  }

  return { isActive: isActive, isVisible: isVisible, normalizeAccounts: normalizeAccounts,
    changeStatus: changeStatus, monthlyCost: monthlyCost };
});
