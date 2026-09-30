(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PhoneBalanceSync = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function timeValue(value) {
    var timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function latestIsoValue(left, right) {
    return timeValue(right) > timeValue(left) ? (right || "") : (left || "");
  }

  function recordModifiedTime(record) {
    return timeValue(record && (record.modifiedAt || record.lastUpdated || record.lastSettledDate));
  }

  function mergeRecordLists(localRecords, remoteRecords) {
    var local = Array.isArray(localRecords) ? clone(localRecords) : [];
    var remote = Array.isArray(remoteRecords) ? remoteRecords : [];
    var remoteById = {};

    remote.forEach(function (record) {
      if (record && record.id) remoteById[record.id] = record;
    });

    var localIds = {};
    local = local.map(function (record) {
      if (!record || !record.id) return record;
      localIds[record.id] = true;
      var remoteRecord = remoteById[record.id];
      if (remoteRecord && recordModifiedTime(remoteRecord) > recordModifiedTime(record)) {
        return clone(remoteRecord);
      }
      return record;
    });

    remote.forEach(function (record) {
      if (record && record.id && !localIds[record.id]) local.push(clone(record));
    });
    return local;
  }

  function mergeRecordMaps(localMap, remoteMap) {
    var localRecords = Object.keys(localMap || {}).map(function (id) {
      return localMap[id];
    });
    var merged = mergeRecordLists(localRecords, Object.keys(remoteMap || {}).map(function (id) {
      return remoteMap[id];
    }));
    var output = {};
    merged.forEach(function (record) {
      if (record && record.id) output[record.id] = record;
    });
    return output;
  }

  function mergeStatesByAccount(localState, remoteState) {
    if (!remoteState) return clone(localState);
    var merged = clone(localState);
    merged.accounts = mergeRecordLists(localState.accounts, remoteState.accounts);
    merged.accountDefaults = mergeRecordMaps(localState.accountDefaults, remoteState.accountDefaults);
    merged.modifiedAt = latestIsoValue(localState.modifiedAt, remoteState.modifiedAt);
    merged.lastUpdated = latestIsoValue(localState.lastUpdated, remoteState.lastUpdated);
    return merged;
  }

  function resolveInitialState(localState, remoteState, hasStoredState) {
    if (!remoteState) {
      return {
        state: clone(localState),
        shouldPush: true,
        source: "local"
      };
    }

    if (!hasStoredState) {
      return {
        state: clone(remoteState),
        shouldPush: false,
        source: "remote"
      };
    }

    return {
      state: mergeStatesByAccount(localState, remoteState),
      shouldPush: false,
      source: "merged"
    };
  }

  return {
    latestIsoValue: latestIsoValue,
    recordModifiedTime: recordModifiedTime,
    mergeRecordLists: mergeRecordLists,
    mergeRecordMaps: mergeRecordMaps,
    mergeStatesByAccount: mergeStatesByAccount,
    resolveInitialState: resolveInitialState
  };
});
