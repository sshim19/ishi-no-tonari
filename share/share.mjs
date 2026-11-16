/**
 * 石のとなり（方向D）の共有と保存。純関数。
 * DOM・localStorage・fetch・Date.now は参照しない。保存先は呼び出し側が渡す。
 * 画面に出す文は 02-copy.md の ID をそのまま使う。
 */

export const STORAGE_KEY = "ishi-no-tonari.v1";

/** @typedef {"hit" | "miss"} Outcome */

/**
 * @typedef {{
 *   version: 1,
 *   outcome: Outcome | null,
 *   dateKey?: string,
 * }} SaveRecord
 */

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
  W8: "コピーできませんでした。上の2行は残っています。",
  L1: "はずれです。今日はここまでです。",
  L2: "石のとなり",
  L3: "今日はここまでです",
  L4: "石のとなり\n今日はここまでです",
  L5: "コピー",
  L6: "コピーしました",
  L7: "コピーできませんでした。上の2行は残っています。",
  Z1: "今日の盤はまだありません",
  Z2: "当たりです",
  Z3: "はずれです。今日はここまでです。",
};

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
  /** @type {SaveRecord} */
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
  if (!daily) {
    return { version: 1, outcome: record.outcome };
  }
  if (record.outcome && record.dateKey === todayKey) {
    return { version: 1, outcome: record.outcome, dateKey: record.dateKey };
  }
  return { version: 1, outcome: null };
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
  if (current.outcome) return current;
  if (outcome !== "hit" && outcome !== "miss") return current;
  /** @type {SaveRecord} */
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
 *   hasBoard: boolean,
 *   daily: boolean,
 *   record: SaveRecord | null | undefined,
 *   copyState?: "" | "ok" | "fail",
 *   streak?: number,
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

  const outcome = input.record?.outcome ?? null;
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
