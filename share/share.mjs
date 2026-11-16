/**
 * 石のとなり（方向D）の共有と保存。純関数。
 * DOM・localStorage・fetch・Date.now は参照しない。保存先は呼び出し側が渡す。
 * 画面に出す文は 02-copy.md の ID をそのまま使う。
 */

export const STORAGE_KEY = "ishi-no-tonari.v1";
export const PUZZLES_PER_DAY = 5;

/** @typedef {"hit" | "miss"} Outcome */
/** @typedef {(Outcome | null)[]} DayOutcomes */

/**
 * @typedef {{
 *   version: 1,
 *   outcome: Outcome | null,
 *   dateKey?: string,
 * }} SaveRecordV1
 */

/**
 * @typedef {{
 *   version: 2,
 *   dateKey?: string,
 *   outcomes: DayOutcomes,
 * }} SaveRecordV2
 */

/** @typedef {SaveRecordV1 | SaveRecordV2} SaveRecord */

/**
 * @typedef {{
 *   empty: string,
 *   result: string,
 *   share: string,
 *   copyLabel: string,
 *   copyStatus: string,
 *   extras: string[],
 * }} ShareView
 */

/** 02-copy.md の画面文。W4 は正本に無い。Z4 は出さない。 */
export const COPY = {
  W1: "当たりです",
  W2: "石のとなり",
  W3: "当たりです",
  W5: "石のとなり\n当たりです",
  W6: "コピー",
  W7: "コピーしました",
  W8: "コピーできませんでした。上の3行は残っています。",
  L1: "はずれです",
  L2: "石のとなり",
  L3: "今日はここまでです",
  L4: "石のとなり\n今日はここまでです",
  L5: "コピー",
  L6: "コピーしました",
  L7: "コピーできませんでした。上の3行は残っています。",
  Z1: "今日の盤はまだありません",
  Z2: "当たりです",
  Z3: "はずれです",
  D1: "5問中3問当たりです。",
  D5: "石のとなり\n○○×○×\n5問中3問当たりです",
};

/**
 * @returns {DayOutcomes}
 */
export function emptyOutcomes() {
  return [null, null, null, null, null];
}

/**
 * @param {unknown} outcomes
 * @returns {DayOutcomes}
 */
export function normalizeOutcomes(outcomes) {
  const next = emptyOutcomes();
  if (!Array.isArray(outcomes)) {
    return next;
  }
  for (let i = 0; i < PUZZLES_PER_DAY; i += 1) {
    const value = outcomes[i];
    if (value === "hit" || value === "miss") {
      next[i] = value;
    }
  }
  return next;
}

/**
 * @param {unknown} outcomes
 * @returns {boolean}
 */
export function dayComplete(outcomes) {
  const list = normalizeOutcomes(outcomes);
  return list.every((value) => value === "hit" || value === "miss");
}

/**
 * @param {unknown} outcomes
 * @returns {number}
 */
export function firstOpenSlot(outcomes) {
  const list = normalizeOutcomes(outcomes);
  return list.findIndex((value) => value !== "hit" && value !== "miss");
}

/**
 * @param {unknown} outcomes
 * @returns {number}
 */
export function hitCount(outcomes) {
  return normalizeOutcomes(outcomes).filter((value) => value === "hit").length;
}

/**
 * 進捗の代表は 02-copy P10「3問目／5問」。slot は 0 始まり。
 *
 * @param {number} slot
 * @returns {string}
 */
export function progressLine(slot) {
  return `${slot + 1}問目／${PUZZLES_PER_DAY}問`;
}

/**
 * 画面の1日まとめ。代表は 02-copy D1。句点あり。
 *
 * @param {unknown} outcomes
 * @returns {string}
 */
export function summaryLine(outcomes) {
  return `${PUZZLES_PER_DAY}問中${hitCount(outcomes)}問当たりです。`;
}

/**
 * @param {Outcome | null | undefined} outcome
 * @returns {string}
 */
export function buildShareText(outcome) {
  if (outcome === "hit") return COPY.W5;
  if (outcome === "miss") return COPY.L4;
  return "";
}

/**
 * 1日5問が揃ったあとの共有。代表は 02-copy D5。答えのマスは出さない。
 *
 * @param {unknown} outcomes
 * @returns {string}
 */
export function buildDayShareText(outcomes) {
  if (!dayComplete(outcomes)) {
    return "";
  }
  const marks = normalizeOutcomes(outcomes)
    .map((value) => (value === "hit" ? "○" : "×"))
    .join("");
  return `石のとなり\n${marks}\n${PUZZLES_PER_DAY}問中${hitCount(outcomes)}問当たりです`;
}

/**
 * @param {Outcome | null | undefined} outcome
 * @returns {string}
 */
export function resultText(outcome) {
  if (outcome === "hit") return COPY.W1;
  if (outcome === "miss") return COPY.L1;
  return "";
}

/**
 * @param {"" | "ok" | "fail" | undefined} copyState
 * @returns {string}
 */
export function copyStatusText(copyState) {
  if (copyState === "ok") return COPY.W7;
  if (copyState === "fail") return COPY.W8;
  return "";
}

/**
 * 日替わりオフでは出さない。オンでも 02-copy.md 初版の画面全文には無いので出さない。
 *
 * @param {boolean} daily
 * @param {number} n
 * @returns {string}
 */
export function consecutiveDaysText(daily, n) {
  if (!daily || n < 1) return "";
  return "";
}

/**
 * 日替わり見出し。02-copy.md 初版の画面全文に無いので出さない。
 *
 * @returns {string}
 */
export function todayHeadline() {
  return "";
}

/**
 * 送り先の一覧は出さない。
 *
 * @returns {string[]}
 */
export function copyDestinations() {
  return [];
}

/**
 * @param {string | null | undefined} raw
 * @returns {SaveRecord}
 */
export function parseRecord(raw) {
  if (typeof raw !== "string" || raw === "") {
    return { version: 1, outcome: null };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { version: 1, outcome: null };
    }
    if (parsed.version === 2) {
      const dateKey =
        typeof parsed.dateKey === "string" && parsed.dateKey !== ""
          ? parsed.dateKey
          : undefined;
      /** @type {SaveRecordV2} */
      const out = { version: 2, outcomes: normalizeOutcomes(parsed.outcomes) };
      if (dateKey) out.dateKey = dateKey;
      return out;
    }
    const outcome =
      parsed.outcome === "hit" || parsed.outcome === "miss" ? parsed.outcome : null;
    const dateKey =
      typeof parsed.dateKey === "string" && parsed.dateKey !== ""
        ? parsed.dateKey
        : undefined;
    if (dateKey) return { version: 1, outcome, dateKey };
    return { version: 1, outcome };
  } catch {
    return { version: 1, outcome: null };
  }
}

/**
 * 個人情報のキーは書かない。渡されても落とす。
 *
 * @param {SaveRecord} record
 * @returns {string}
 */
export function serializeRecord(record) {
  if (record.version === 2) {
    /** @type {SaveRecordV2} */
    const out = { version: 2, outcomes: normalizeOutcomes(record.outcomes) };
    if (typeof record.dateKey === "string" && record.dateKey !== "") {
      out.dateKey = record.dateKey;
    }
    return JSON.stringify(out);
  }
  /** @type {SaveRecordV1} */
  const out = { version: 1, outcome: null };
  if (record.outcome === "hit" || record.outcome === "miss") {
    out.outcome = record.outcome;
  }
  if (typeof record.dateKey === "string" && record.dateKey !== "") {
    out.dateKey = record.dateKey;
  }
  return JSON.stringify(out);
}

/**
 * @param {{ getItem: (key: string) => string | null }} storage
 * @param {{ daily?: boolean, todayKey?: string }} [options]
 * @returns {SaveRecord}
 */
export function loadRecord(storage, options) {
  const daily = Boolean(options?.daily);
  const todayKey = options?.todayKey ?? "";
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  const record = parseRecord(raw);
  if (record.version === 2) {
    if (!daily) {
      return { version: 2, outcomes: record.outcomes };
    }
    if (record.dateKey === todayKey) {
      return record;
    }
    return { version: 2, dateKey: todayKey, outcomes: emptyOutcomes() };
  }
  if (!daily) {
    return { version: 1, outcome: record.outcome };
  }
  if (record.outcome && record.dateKey === todayKey) {
    return { version: 1, outcome: record.outcome, dateKey: record.dateKey };
  }
  return { version: 1, outcome: null };
}

/**
 * 暦日ごとの 5 問。スロットは 0 始まり。埋まっているマスは上書きしない。
 *
 * @param {{ getItem: (key: string) => string | null }} storage
 * @param {string} dateKey
 * @returns {SaveRecordV2}
 */
export function loadDayRecord(storage, dateKey) {
  const record = loadRecord(storage, { daily: true, todayKey: dateKey });
  if (record.version === 2 && record.dateKey === dateKey) {
    return record;
  }
  return { version: 2, dateKey, outcomes: emptyOutcomes() };
}

/**
 * 1回押したあとは上書きしない。
 *
 * @param {{
 *   getItem: (key: string) => string | null,
 *   setItem: (key: string, value: string) => void,
 * }} storage
 * @param {Outcome} outcome
 * @param {{ daily?: boolean, todayKey?: string }} [options]
 * @returns {SaveRecord}
 */
export function saveOutcome(storage, outcome, options) {
  const daily = Boolean(options?.daily);
  const todayKey = options?.todayKey ?? "";
  const current = loadRecord(storage, options);
  if (current.version === 2) {
    return current;
  }
  if (current.outcome) return current;
  if (outcome !== "hit" && outcome !== "miss") return current;
  /** @type {SaveRecordV1} */
  const next = daily
    ? { version: 1, outcome, dateKey: todayKey }
    : { version: 1, outcome };
  try {
    storage.setItem(STORAGE_KEY, serializeRecord(next));
    return next;
  } catch {
    return current;
  }
}

/**
 * @param {{
 *   getItem: (key: string) => string | null,
 *   setItem: (key: string, value: string) => void,
 * }} storage
 * @param {string} dateKey
 * @param {number} slot
 * @param {Outcome} outcome
 * @returns {SaveRecordV2}
 */
export function saveSlot(storage, dateKey, slot, outcome) {
  const current = loadDayRecord(storage, dateKey);
  if (outcome !== "hit" && outcome !== "miss") return current;
  if (!Number.isInteger(slot) || slot < 0 || slot >= PUZZLES_PER_DAY) {
    return current;
  }
  if (current.outcomes[slot]) return current;
  const outcomes = normalizeOutcomes(current.outcomes);
  outcomes[slot] = outcome;
  /** @type {SaveRecordV2} */
  const next = { version: 2, dateKey, outcomes };
  try {
    storage.setItem(STORAGE_KEY, serializeRecord(next));
    return next;
  } catch {
    return current;
  }
}

/**
 * @param {SaveRecord | null | undefined} record
 * @returns {Outcome | null}
 */
function slotOutcome(record, slot) {
  if (!record) return null;
  if (record.version === 2) {
    const value = record.outcomes[slot];
    return value === "hit" || value === "miss" ? value : null;
  }
  return record.outcome === "hit" || record.outcome === "miss" ? record.outcome : null;
}

/**
 * @param {{
 *   hasBoard: boolean,
 *   daily: boolean,
 *   record: SaveRecord | null | undefined,
 *   copyState?: "" | "ok" | "fail",
 *   streak?: number,
 *   slot?: number,
 * }} input
 * @returns {ShareView}
 */
export function viewModel(input) {
  const extras = [];
  const headline = todayHeadline();
  const days = consecutiveDaysText(Boolean(input.daily), Number(input.streak) || 0);
  if (headline) extras.push(headline);
  if (days) extras.push(days);

  if (!input.hasBoard) {
    return {
      empty: COPY.Z1,
      result: "",
      share: "",
      copyLabel: "",
      copyStatus: "",
      extras,
    };
  }

  const record = input.record;
  if (record?.version === 2) {
    if (dayComplete(record.outcomes)) {
      return {
        empty: "",
        result: summaryLine(record.outcomes),
        share: buildDayShareText(record.outcomes),
        copyLabel: COPY.W6,
        copyStatus: copyStatusText(input.copyState),
        extras,
      };
    }
    const slot = Number.isInteger(input.slot) ? input.slot : firstOpenSlot(record.outcomes);
    const outcome = slotOutcome(record, slot);
    if (outcome !== "hit" && outcome !== "miss") {
      return {
        empty: "",
        result: "",
        share: "",
        copyLabel: "",
        copyStatus: "",
        extras,
      };
    }
    return {
      empty: "",
      result: resultText(outcome),
      share: "",
      copyLabel: "",
      copyStatus: "",
      extras,
    };
  }

  const outcome = record?.outcome ?? null;
  if (outcome !== "hit" && outcome !== "miss") {
    return {
      empty: "",
      result: "",
      share: "",
      copyLabel: "",
      copyStatus: "",
      extras,
    };
  }

  return {
    empty: "",
    result: resultText(outcome),
    share: buildShareText(outcome),
    copyLabel: COPY.W6,
    copyStatus: copyStatusText(input.copyState),
    extras,
  };
}

/**
 * 画面に出す文を1つにまとめる。共有のクリップボードは view.share だけである。
 *
 * @param {ShareView} view
 * @returns {string}
 */
export function visibleBlob(view) {
  return [
    view.empty,
    ...view.extras,
    view.result,
    view.share,
    view.copyLabel,
    view.copyStatus,
  ]
    .filter((part) => part)
    .join("\n");
}
