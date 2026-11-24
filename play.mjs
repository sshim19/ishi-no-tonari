/**
 * 方向D 統合ページ。盤は stock.json、正誤は gen/board.mjs の inspectHiddenPuzzle、
 * 結果と保存と共有は share/share.mjs。トラック2の仮の1問は使わない。
 * 画面文の正本は 02-copy.md。日替わりの見出しと連続日は出さない。
 * 日替わりは 01-spec の JST 暦日。開始日は START_DATE_JST の1か所。
 * 1暦日は在庫 5 問。問の並びは汎用のスロットで、盤の見せ方は問ごとに差し替えられる。
 * 石マスと数字マスの見た目は cellFace の1か所。隠す版はそこだけ差し替える。
 */
import {
  CELL_KANA,
  inspectHiddenPuzzle,
} from "./gen/board.mjs";
import {
  PUZZLES_PER_DAY,
  dayComplete,
  firstOpenSlot,
  loadDayRecord,
  progressLine,
  saveSlot,
  viewModel,
} from "./share/share.mjs";

export const INTRO_KEY = "ishi-no-tonari.intro.v1";

/** 見本 3×3。石は左上とまんなか。押す対象ではない。 */
export const SAMPLE_TRUE = [
  { kana: "ア", stone: true, value: 0 },
  { kana: "イ", stone: false, value: 2 },
  { kana: "ウ", stone: false, value: 0 },
  { kana: "エ", stone: false, value: 2 },
  { kana: "オ", stone: true, value: 0 },
  { kana: "カ", stone: false, value: 1 },
  { kana: "キ", stone: false, value: 0 },
  { kana: "ク", stone: false, value: 1 },
  { kana: "ケ", stone: false, value: 0 },
];

/** 石を消した見本。右上の1がうそ。 */
export const SAMPLE_PUZZLE = [
  { kana: "ア", stone: true, value: 0 },
  { kana: "イ", stone: false, value: 2 },
  { kana: "ウ", stone: false, value: 1 },
  { kana: "エ", stone: false, value: 2 },
  { kana: "オ", stone: true, value: 0 },
  { kana: "カ", stone: false, value: 1 },
  { kana: "キ", stone: false, value: 0 },
  { kana: "ク", stone: false, value: 1 },
  { kana: "ケ", stone: false, value: 0 },
];

/** @deprecated 説明盤。SAMPLE_TRUE と同じ。 */
export const SAMPLE = SAMPLE_TRUE;

/**
 * 説明・見本・本番の文。結果と空状態は share の COPY。
 * 石の見せ方を変えるときは E2 / S2 / P2 / P3 / P5 を差し替える。
 */
export const SCREEN_COPY = {
  E1: "石のとなり",
  E2: "マインスイーパーに似ています。\n石は6個ありますが、見えません。\nどのマスにも、上下左右にある石の数が書いてあります。\n斜めは数えません。\nうその数字が1つだけあります。\nそのマスを押してください。",
  E3: "見本を見る",
  S1: "見本",
  S2: "これは見本です。\nこの盤は見るだけです。\n石は2個です。左上とまんなかは、どちらも0です。\n0でも石のことがあります。",
  S8: "下の盤は石を消しています。右上の1がうそです。",
  S5: "はじめる",
  S6: "見本を見る",
  S7: "閉じる",
  P1: "石のとなり",
  P2: "石は6個ありますが、見えません。\nどのマスにも、上下左右の石の数があります。\n斜めは数えません。うその数字が1つだけあります。",
  P3: "マスを押すのは1回だけです。",
  P8: "たて6、よこ6の盤",
  P10: "3問目／5問",
  N1: "次の問題へ",
  C1: "このマスでいいですか？",
  C3: "決める",
  C4: "やめる",
  A1: "答え",
  A2: "うそのマスを選んでください",
  H1: "ヒント",
  H2: "ヒントを選んでください",
  H3: "本当のマスを1つ開ける",
  H4: "本当の行を一列開ける",
};

export const FORBIDDEN = [
  "1手",
  "移す",
  "控える",
  "1回まで",
  "数に入れたマスの名",
  "数を足す前に思ったこと",
  "内部",
  "角",
  "辺",
  "嘘の型",
  "表示0",
  "空いた十字",
  "次数超え",
  "数字が唯一",
  "ナイト",
  "桂",
  "うそみち",
];

/**
 * 公開開始日（Asia/Tokyo の暦日）。開始日の暦対応は正本に無いのでここ1か所。
 * 2026-11-16 JST をフリーズ日1とし、以降1日ずつ進む。
 * 1暦日は在庫 5 問、フリーズ分は 6 暦日。開始前は Z1。
 * 日7以降は ((暦日-1) % 6)+1 で在庫を周回する。保存キーは実暦日のまま。
 */
export const START_DATE_JST = "2026-11-16";
export const PLAYABLE_CALENDAR_DAYS = 24;

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {number} epochMs
 * @returns {string}
 */
export function jstDateKey(epochMs) {
  const shifted = new Date(Number(epochMs) + JST_OFFSET_MS);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} dateKey
 * @returns {number}
 */
function utcDayCount(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

/**
 * 開始日を日1とする。開始前は 0 以下。日31は 31。
 *
 * @param {number} epochMs
 * @param {string} [startDateJst]
 * @returns {number}
 */
export function dayNumberFromEpoch(epochMs, startDateJst = START_DATE_JST) {
  return utcDayCount(jstDateKey(epochMs)) - utcDayCount(startDateJst) + 1;
}

/**
 * 計測ハーネスが時計を固定するときだけ使う。公開 URL のクエリには出さない。
 *
 * @returns {number}
 */
export function currentNowMs() {
  const injected = globalThis.M4D_nowMs;
  if (typeof injected === "number" && Number.isFinite(injected)) {
    return injected;
  }
  return Date.now();
}

/**
 * @param {string | URLSearchParams} search
 * @param {number} [nowMs]
 */
export function parsePlayParams(search, nowMs = currentNowMs()) {
  const params =
    typeof search === "string"
      ? new URLSearchParams(search.startsWith("?") ? search.slice(1) : search)
      : search;
  const empty = params.get("empty") === "1";
  const visit2 = params.get("visit") === "2";
  const failCopy = params.get("failCopy") === "1";
  const rawDay = params.get("day");
  let requestedDay = null;
  if (rawDay != null && rawDay !== "") {
    requestedDay = Number(rawDay);
  }
  const rawSlot = params.get("slot");
  let requestedSlot = null;
  if (rawSlot != null && rawSlot !== "") {
    requestedSlot = Number(rawSlot);
  }
  return {
    empty,
    visit2,
    failCopy,
    requestedDay,
    requestedSlot,
    todayDay: dayNumberFromEpoch(nowMs),
  };
}

/**
 * @param {{ days?: unknown }} stock
 * @param {{
 *   empty: boolean,
 *   requestedDay: number | null,
 *   todayDay: number,
 * }} params
 */
function emptyDay() {
  return { hasBoard: false, day: null, calendarDay: null, info: null, raw: null, puzzles: [] };
}

/**
 * 暦日 N の盤は、周回後の有効日 E=((N-1)%6)+1 の在庫 5E-4 から 5E。
 * 開始前（N<1）は盤なし。保存の day / calendarDay は実暦日 N のまま。
 *
 * @param {{ days?: unknown }} stock
 * @param {{
 *   empty: boolean,
 *   requestedDay: number | null,
 *   todayDay: number,
 * }} params
 */
export function selectDay(stock, params) {
  if (params.empty) {
    return emptyDay();
  }
  if (!Array.isArray(stock?.days)) {
    return emptyDay();
  }
  const requested = params.requestedDay;
  const todayDay = params.todayDay;
  let calendarDay;
  if (requested == null) {
    calendarDay = todayDay;
  } else if (!Number.isInteger(requested) || requested > todayDay) {
    return emptyDay();
  } else {
    calendarDay = requested;
  }
  if (!Number.isInteger(calendarDay) || calendarDay < 1) {
    return emptyDay();
  }
  const effectiveDay =
    ((calendarDay - 1) % PLAYABLE_CALENDAR_DAYS) + 1;
  const start = (effectiveDay - 1) * PUZZLES_PER_DAY;
  const slice = stock.days.slice(start, start + PUZZLES_PER_DAY);
  if (slice.length !== PUZZLES_PER_DAY) {
    return emptyDay();
  }
  const puzzles = [];
  for (const raw of slice) {
    const info = inspectHiddenPuzzle({
      stones: raw.stones,
      lie: raw.lie,
      displayed: raw.displayed,
    });
    if (!info.ok) {
      return emptyDay();
    }
    puzzles.push({ info, raw, stockDay: raw.day });
  }
  return {
    hasBoard: true,
    day: calendarDay,
    calendarDay,
    info: puzzles[0].info,
    raw: puzzles[0].raw,
    puzzles,
  };
}

/**
 * 暦日の先頭の問。互換のため残す。5問の並びは selectDay。
 *
 * @param {{ days?: unknown }} stock
 * @param {{
 *   empty: boolean,
 *   requestedDay: number | null,
 *   todayDay: number,
 * }} params
 */
export function selectBoard(stock, params) {
  return selectDay(stock, params);
}

/**
 * @param {number | null | undefined} requestedSlot
 * @returns {number | null}
 */
export function parseSlot(requestedSlot) {
  if (!Number.isInteger(requestedSlot)) {
    return null;
  }
  if (requestedSlot < 1 || requestedSlot > PUZZLES_PER_DAY) {
    return null;
  }
  return requestedSlot - 1;
}

/**
 * 正誤は inspectHiddenPuzzle が返した唯一のうそマス。石のマスも押せる。
 *
 * @param {ReturnType<typeof inspectHiddenPuzzle> | null} info
 * @param {string} kana
 */
export function judgePress(info, kana) {
  if (!info || !info.ok) {
    return { ignored: true, win: false };
  }
  const i = CELL_KANA.indexOf(kana);
  if (i < 0) {
    return { ignored: true, win: false };
  }
  return { ignored: false, win: kana === info.lieKana };
}

/**
 * ヒント用。石でもうそでもなく、まだ開いていない本当のマスを1つ選ぶ。
 *
 * @param {{ occupied?: ArrayLike<number>, lie?: number } | null} info
 * @param {Iterable<string>} [alreadyHinted]
 * @param {() => number} [rand]
 * @returns {string | null}
 */
export function pickHintCell(info, alreadyHinted = [], rand = Math.random) {
  if (!info || !Number.isInteger(info.lie)) {
    return null;
  }
  const hinted = alreadyHinted instanceof Set ? alreadyHinted : new Set(alreadyHinted);
  const candidates = [];
  for (let i = 0; i < CELL_KANA.length; i += 1) {
    if (info.occupied?.[i]) {
      continue;
    }
    if (i === info.lie) {
      continue;
    }
    const kana = CELL_KANA[i];
    if (hinted.has(kana)) {
      continue;
    }
    candidates.push(kana);
  }
  if (candidates.length === 0) {
    return null;
  }
  const index = Math.floor(rand() * candidates.length);
  return candidates[Math.min(Math.max(index, 0), candidates.length - 1)];
}

/**
 * ヒント用。うそマスを含まない、まだ開いていない行を1つ選ぶ。行は 0 始まり。
 *
 * @param {{ lie?: number } | null} info
 * @param {Iterable<number>} [alreadyHintedRows]
 * @param {() => number} [rand]
 * @returns {number | null}
 */
export function pickHintRow(info, alreadyHintedRows = [], rand = Math.random) {
  if (!info || !Number.isInteger(info.lie)) {
    return null;
  }
  const hinted = alreadyHintedRows instanceof Set ? alreadyHintedRows : new Set(alreadyHintedRows);
  const lieRow = Math.floor(info.lie / 6);
  const candidates = [];
  for (let r = 0; r < 6; r += 1) {
    if (r === lieRow || hinted.has(r)) {
      continue;
    }
    candidates.push(r);
  }
  if (candidates.length === 0) {
    return null;
  }
  const index = Math.floor(rand() * candidates.length);
  return candidates[Math.min(Math.max(index, 0), candidates.length - 1)];
}

/**
 * @param {number} row
 * @returns {string[]}
 */
export function rowKanas(row) {
  if (!Number.isInteger(row) || row < 0 || row > 5) {
    return [];
  }
  const start = row * 6;
  return CELL_KANA.slice(start, start + 6);
}

/**
 * マスの見た目と押せるか。石を隠す版はここだけ差し替える。
 * いまは石マスに「石」を出し、数字マスだけ押せる。
 *
 * @param {{
 *   stone: boolean,
 *   value: number | null,
 *   sample?: boolean,
 * }} cell
 */
export function cellFace(cell) {
  const stone = Boolean(cell.stone);
  const sample = Boolean(cell.sample);
  const revealed = Boolean(cell.revealed);
  const drawStone = Boolean(cell.drawStone);
  const value = cell.value;
  if (sample) {
    const showStone = drawStone && stone;
    return {
      body: showStone ? "石" : String(value),
      value: showStone ? null : value,
      className: showStone ? "cell cell-stone" : "cell",
      copyId: "S3",
      pressable: false,
      stoneVisible: showStone,
    };
  }
  if (revealed && stone) {
    return {
      body: "石",
      value: null,
      className: "cell cell-stone",
      copyId: "P5",
      pressable: false,
      stoneVisible: true,
    };
  }
  return {
    body: String(value),
    value,
    className: "cell",
    copyId: "P4",
    pressable: !revealed,
    stoneVisible: false,
  };
}

/**
 * マスの読み上げ。仮名は出さない。行・列は 1 始まり。本文は cellFace。
 *
 * @param {number} row
 * @param {number} col
 * @param {boolean} stone
 * @param {number | null} value
 */
export function ariaFor(row, col, stone, value, options = {}) {
  const face = cellFace({ stone, value, ...options });
  return `上から${row}番目、左から${col}番目、${face.body}`;
}

/**
 * 画面には日を出さない。保存の衝突を避けるキーだけに使う。
 *
 * @param {number | null} day
 */
export function saveOptions(day) {
  if (!day) {
    return { daily: false };
  }
  return { daily: true, todayKey: `day-${day}` };
}

/**
 * @returns {Promise<typeof import("./gen/stock.json")>}
 */
export async function loadStock() {
  const res = await fetch(new URL("./gen/stock.json", import.meta.url));
  if (!res.ok) {
    throw new Error("stock");
  }
  return res.json();
}

async function boot() {
  const document = globalThis.document;
  const stockJson = await loadStock();
  const app = document.getElementById("app");
  const screenExplain = document.getElementById("screen-explain");
  const screenSample = document.getElementById("screen-sample");
  const screenEmpty = document.getElementById("screen-empty");
  const screenPlay = document.getElementById("screen-play");
  const sampleBoard = document.getElementById("sample-board");
  const samplePuzzleBoard = document.getElementById("sample-puzzle-board");
  const overlayBoard = document.getElementById("overlay-board");
  const overlayPuzzleBoard = document.getElementById("overlay-puzzle-board");
  const playBoard = document.getElementById("play-board");
  const sampleDialog = document.getElementById("sample-dialog");
  const confirmDialog = document.getElementById("confirm-dialog");
  const confirmTitle = document.getElementById("confirm-title");
  const confirmDetail = document.getElementById("confirm-detail");
  const btnConfirmOk = document.getElementById("btn-confirm-ok");
  const btnConfirmCancel = document.getElementById("btn-confirm-cancel");
  const btnE3 = document.getElementById("btn-e3");
  const btnS5 = document.getElementById("btn-s5");
  const btnS6 = document.getElementById("btn-s6");
  const btnS7 = document.getElementById("btn-s7");
  const btnCopy = document.getElementById("btn-copy");
  const btnNext = document.getElementById("btn-next");
  const resultBlock = document.getElementById("result-block");
  const resultText = document.getElementById("result-text");
  const shareLines = document.getElementById("share-lines");
  const copyStatus = document.getElementById("copy-status");
  const playProgress = document.getElementById("play-progress");
  const playLead = document.querySelector("#screen-play [data-copy-id='P2']");
  const playRule = document.querySelector("#screen-play [data-copy-id='P3']");
  const answerHint = document.getElementById("answer-hint");
  const btnAnswer = document.getElementById("btn-answer");
  const btnHint = document.getElementById("btn-hint");
  const hintDialog = document.getElementById("hint-dialog");
  const hintTitle = document.getElementById("hint-title");
  const btnHintCell = document.getElementById("btn-hint-cell");
  const btnHintRow = document.getElementById("btn-hint-row");
  const btnHintCancel = document.getElementById("btn-hint-cancel");

  const params = parsePlayParams(globalThis.location.search, currentNowMs());
  const selected = selectDay(stockJson, params);
  const storage = globalThis.localStorage;
  const dateKey = selected.hasBoard ? saveOptions(selected.calendarDay).todayKey : "";
  let overlay = false;
  /** @type {string | null} */
  let pressed = null;
  /** @type {string | null} */
  let pendingKana = null;
  let confirmRestoreFocus = true;
  let answerMode = false;
  /** @type {Record<string, "green" | "red">} */
  let memos = Object.create(null);
  /** @type {Set<string>} */
  let hinted = new Set();
  /** @type {Set<number>} */
  let hintedRows = new Set();
  let hintRestoreFocus = true;
  /** @type {"" | "ok" | "fail"} */
  let copyState = "";
  const returnVisit = params.visit2 || introSeen();

  function currentRecord() {
    if (!selected.hasBoard) {
      return { version: 2, dateKey: "", outcomes: [null, null, null, null, null] };
    }
    return loadDayRecord(storage, dateKey);
  }

  function activeSlot() {
    const pinned = parseSlot(params.requestedSlot);
    if (pinned != null) {
      return pinned;
    }
    const rec = currentRecord();
    const open = firstOpenSlot(rec.outcomes);
    if (open >= 0) {
      return open;
    }
    return PUZZLES_PER_DAY - 1;
  }

  let slotIndex = selected.hasBoard ? activeSlot() : 0;

  function currentPuzzle() {
    return selected.puzzles[slotIndex] ?? null;
  }

  function introSeen() {
    try {
      return storage.getItem(INTRO_KEY) === "1";
    } catch {
      return false;
    }
  }

  function markIntroSeen() {
    try {
      storage.setItem(INTRO_KEY, "1");
    } catch {
      // 保存できない端末でも、このセッションの本番は進める
    }
  }

  function fillSample(board, cells, drawStone) {
    board.replaceChildren();
    for (let i = 0; i < cells.length; i += 1) {
      const cell = cells[i];
      const face = cellFace({
        stone: cell.stone,
        value: cell.value,
        sample: true,
        drawStone,
      });
      board.append(makeCell(cell.kana, face, i, 3));
    }
  }

  function fillPlay() {
    playBoard.replaceChildren();
    const puzzle = currentPuzzle();
    if (!selected.hasBoard || !puzzle) {
      return;
    }
    const revealed = Boolean(slotOutcome());
    const hidden = puzzle.info.hiddenBoard;
    const truth = puzzle.info.neighborCounts;
    for (let i = 0; i < CELL_KANA.length; i += 1) {
      const kana = CELL_KANA[i];
      const stone = Boolean(puzzle.info.occupied[i]);
      const value = revealed && i === puzzle.info.lie ? truth[i] : hidden[i];
      const face = cellFace({ stone, value, revealed });
      const el = makeCell(kana, face, i, 6);
      applyMemoClass(el, kana);
      applyHintClass(el, kana);
      playBoard.append(el);
    }
  }

  function makeCell(kana, face, index, cols) {
    const el = document.createElement(face.pressable ? "button" : "div");
    if (face.pressable) {
      el.type = "button";
    }
    el.className = face.className;
    el.dataset.kana = kana;
    el.dataset.copyId = face.copyId;
    const row = Math.floor(index / cols) + 1;
    const col = (index % cols) + 1;
    el.setAttribute("aria-label", `上から${row}番目、左から${col}番目、${face.body}`);
    const bodyEl = document.createElement("span");
    bodyEl.className = "cell-body";
    bodyEl.textContent = face.body;
    el.append(bodyEl);
    if (face.pressable) {
      el.addEventListener("click", () => onPlayPress(kana));
    }
    el.addEventListener("animationend", onHintOpenAnimationEnd);
    return el;
  }

  function showScreen(name) {
    screenExplain.hidden = name !== "explain";
    screenSample.hidden = name !== "sample";
    screenEmpty.hidden = name !== "empty";
    screenPlay.hidden = name !== "play";
    const heading = document.querySelector(`#screen-${name} h1`);
    if (heading) {
      heading.focus();
    }
  }

  function currentView() {
    return viewModel({
      hasBoard: selected.hasBoard,
      daily: true,
      record: selected.hasBoard ? currentRecord() : null,
      copyState,
      streak: 12,
      slot: slotIndex,
    });
  }

  function slotOutcome() {
    const rec = currentRecord();
    const value = rec.outcomes[slotIndex];
    return value === "hit" || value === "miss" ? value : null;
  }

  function renderPlayChrome() {
    if (playProgress) {
      playProgress.textContent = progressLine(slotIndex);
      playProgress.dataset.copyId = "P10";
    }
    const rec = currentRecord();
    const complete = dayComplete(rec.outcomes);
    const outcome = slotOutcome();
    const compact = Boolean(outcome) || complete;
    if (playLead) playLead.hidden = compact;
    if (playRule) playRule.hidden = compact;
    btnS6.hidden = !returnVisit || compact;
    renderAnswerChrome();
    renderHintChrome();
  }

  function applyMemoClass(el, kana) {
    el.classList.remove("cell-memo-green", "cell-memo-red");
    const memo = memos[kana];
    if (memo === "green") {
      el.classList.add("cell-memo-green");
    } else if (memo === "red") {
      el.classList.add("cell-memo-red");
    }
  }

  function cycleMemo(kana) {
    const current = memos[kana] ?? null;
    const next = current === null ? "green" : current === "green" ? "red" : null;
    if (next) {
      memos[kana] = next;
    } else {
      delete memos[kana];
    }
    const el = playBoard.querySelector(`[data-kana="${kana}"]`);
    if (el) {
      applyMemoClass(el, kana);
    }
  }

  function setAnswerMode(on) {
    answerMode = Boolean(on) && !slotOutcome();
    renderAnswerChrome();
  }

  function renderAnswerChrome() {
    const answering = answerMode && !slotOutcome();
    if (btnAnswer) {
      btnAnswer.hidden = Boolean(slotOutcome());
      btnAnswer.classList.toggle("is-active", answering);
      btnAnswer.setAttribute("aria-pressed", answering ? "true" : "false");
    }
    if (answerHint) {
      answerHint.hidden = !answering;
    }
    screenPlay.classList.toggle("is-answer-mode", answering);
  }

  function applyHintClass(el, kana) {
    const on = hinted.has(kana);
    el.classList.toggle("cell-hint-safe", on);
    const aria = el.getAttribute("aria-label") || "";
    const base = aria.replace(/、本当$/, "");
    if (base) {
      el.setAttribute("aria-label", on ? `${base}、本当` : base);
    }
  }

  function applyHintsToBoard() {
    for (const el of playBoard.querySelectorAll(".cell")) {
      applyHintClass(el, el.dataset.kana);
    }
  }

  function prefersReducedMotion() {
    return Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  }

  function clearHintOpening(el) {
    el.classList.remove("cell-hint-opening");
    el.style.removeProperty("--hint-open-delay");
  }

  function onHintOpenAnimationEnd(event) {
    if (event.animationName !== "hint-open") {
      return;
    }
    clearHintOpening(event.currentTarget);
  }

  function playHintOpening(kanas) {
    if (prefersReducedMotion()) {
      return;
    }
    for (let i = 0; i < kanas.length; i += 1) {
      const el = playBoard.querySelector(`[data-kana="${kanas[i]}"]`);
      if (!el) {
        continue;
      }
      clearHintOpening(el);
      void el.offsetWidth;
      if (i > 0) {
        el.style.setProperty("--hint-open-delay", `${i * 50}ms`);
      }
      el.classList.add("cell-hint-opening");
    }
  }

  function currentHintInfo() {
    return currentPuzzle()?.info ?? null;
  }

  function hintCellAvailable() {
    return pickHintCell(currentHintInfo(), hinted) != null;
  }

  function hintRowAvailable() {
    return pickHintRow(currentHintInfo(), hintedRows) != null;
  }

  function renderHintChrome() {
    if (!btnHint) {
      return;
    }
    const committed = Boolean(slotOutcome());
    btnHint.hidden = committed;
    btnHint.disabled = committed || (!hintCellAvailable() && !hintRowAvailable());
  }

  function anyOverlayOpen() {
    return Boolean(sampleDialog.open || confirmDialog.open || (hintDialog && hintDialog.open));
  }

  function syncOverlay() {
    overlay = anyOverlayOpen();
    if (!overlay) {
      screenPlay.inert = false;
    }
  }

  function closeHint(options = {}) {
    const restore = options.restoreFocus !== false;
    hintRestoreFocus = restore;
    if (hintDialog && hintDialog.open) {
      hintDialog.close();
      return;
    }
    syncOverlay();
    if (restore && btnHint && typeof btnHint.focus === "function") {
      btnHint.focus();
    }
  }

  function openHintMenu() {
    if (!hintDialog || slotOutcome()) {
      return;
    }
    const cellOk = hintCellAvailable();
    const rowOk = hintRowAvailable();
    if (btnHintCell) {
      btnHintCell.disabled = !cellOk;
    }
    if (btnHintRow) {
      btnHintRow.disabled = !rowOk;
    }
    if (!cellOk && !rowOk) {
      renderHintChrome();
      return;
    }
    overlay = true;
    screenPlay.inert = true;
    hintRestoreFocus = true;
    hintDialog.showModal();
    if (hintTitle) {
      hintTitle.focus();
    }
  }

  function revealHintCell() {
    const kana = pickHintCell(currentHintInfo(), hinted);
    if (!kana) {
      return false;
    }
    hinted.add(kana);
    applyHintsToBoard();
    playHintOpening([kana]);
    renderHintChrome();
    return true;
  }

  function revealHintRow() {
    const row = pickHintRow(currentHintInfo(), hintedRows);
    if (row == null) {
      return false;
    }
    hintedRows.add(row);
    const kanas = rowKanas(row);
    for (const kana of kanas) {
      hinted.add(kana);
    }
    applyHintsToBoard();
    playHintOpening(kanas);
    renderHintChrome();
    return true;
  }

  function onHintCell() {
    revealHintCell();
    closeHint({ restoreFocus: false });
    if (btnHint && !btnHint.hidden && typeof btnHint.focus === "function") {
      btnHint.focus();
    }
  }

  function onHintRow() {
    revealHintRow();
    closeHint({ restoreFocus: false });
    if (btnHint && !btnHint.hidden && typeof btnHint.focus === "function") {
      btnHint.focus();
    }
  }

  function renderResult() {
    const view = currentView();
    const rec = currentRecord();
    const complete = dayComplete(rec.outcomes);
    const outcome = slotOutcome();
    renderPlayChrome();
    if (!view.result) {
      resultBlock.hidden = true;
      shareLines.hidden = true;
      btnCopy.hidden = true;
      btnNext.hidden = true;
      copyStatus.hidden = true;
      copyStatus.textContent = "";
      return;
    }
    resultBlock.hidden = false;
    if (complete) {
      resultText.dataset.copyId = "D1";
      resultText.textContent = view.result;
      shareLines.hidden = false;
      shareLines.dataset.copyId = "D5";
      shareLines.textContent = view.share;
      btnCopy.hidden = false;
      btnCopy.dataset.copyId = "W6";
      btnCopy.textContent = view.copyLabel;
      btnNext.hidden = true;
    } else {
      resultText.dataset.copyId = outcome === "hit" ? "W1" : "L1";
      resultText.textContent = view.result;
      shareLines.hidden = true;
      shareLines.textContent = "";
      btnCopy.hidden = true;
      btnNext.hidden = slotIndex >= PUZZLES_PER_DAY - 1;
      btnNext.dataset.copyId = "N1";
      btnNext.textContent = SCREEN_COPY.N1;
    }
    if (view.copyStatus) {
      copyStatus.hidden = false;
      copyStatus.dataset.copyId = copyState === "ok" ? "W7" : "W8";
      copyStatus.textContent = view.copyStatus;
    } else {
      copyStatus.hidden = true;
      copyStatus.textContent = "";
    }
  }

  function lockPlayBoard(pressedKana) {
    const cells = playBoard.querySelectorAll("button.cell");
    for (const cell of cells) {
      cell.disabled = true;
      if (pressedKana && cell.dataset.kana === pressedKana) {
        cell.classList.add("is-pressed");
      }
    }
  }

  function cellPlaceLabel(kana) {
    const i = CELL_KANA.indexOf(kana);
    if (i < 0) {
      return "";
    }
    const row = Math.floor(i / 6) + 1;
    const col = (i % 6) + 1;
    return `上から${row}番目、左から${col}番目`;
  }

  function markPendingCell(kana) {
    for (const cell of playBoard.querySelectorAll("button.cell")) {
      cell.classList.toggle("is-pending", Boolean(kana) && cell.dataset.kana === kana);
    }
  }

  function resetConfirmState() {
    const last = pendingKana;
    pendingKana = null;
    syncOverlay();
    markPendingCell(null);
    if (confirmRestoreFocus && last) {
      const el = playBoard.querySelector(`[data-kana="${last}"]`);
      if (el && !el.disabled && typeof el.focus === "function") {
        el.focus();
      }
    }
  }

  function closeConfirm(options = {}) {
    confirmRestoreFocus = options.restoreFocus !== false;
    if (confirmDialog.open) {
      confirmDialog.close();
      return;
    }
    resetConfirmState();
  }

  function openConfirm(kana) {
    pendingKana = kana;
    confirmDetail.textContent = `${cellPlaceLabel(kana)}です。`;
    markPendingCell(kana);
    overlay = true;
    screenPlay.inert = true;
    confirmRestoreFocus = true;
    confirmDialog.showModal();
    confirmTitle.focus();
  }

  function commitPress(kana) {
    const puzzle = currentPuzzle();
    if (!puzzle) {
      return;
    }
    const judged = judgePress(puzzle.info, kana);
    if (judged.ignored) {
      return;
    }
    const outcome = judged.win ? "hit" : "miss";
    saveSlot(storage, dateKey, slotIndex, outcome);
    pressed = kana;
    answerMode = false;
    fillPlay();
    lockPlayBoard(kana);
    copyState = "";
    renderResult();
    resultText.focus();
  }

  function onPlayPress(kana) {
    if (overlay) {
      return;
    }
    if (slotOutcome()) {
      return;
    }
    const puzzle = currentPuzzle();
    if (!puzzle) {
      return;
    }
    const judged = judgePress(puzzle.info, kana);
    if (judged.ignored) {
      return;
    }
    if (answerMode) {
      openConfirm(kana);
      return;
    }
    cycleMemo(kana);
  }

  function onConfirmOk() {
    const kana = pendingKana;
    if (!kana) {
      closeConfirm({ restoreFocus: false });
      return;
    }
    closeConfirm({ restoreFocus: false });
    commitPress(kana);
  }

  function goNextPuzzle() {
    if (slotIndex >= PUZZLES_PER_DAY - 1) {
      return;
    }
    slotIndex += 1;
    pressed = slotOutcome() ? "saved" : null;
    copyState = "";
    answerMode = false;
    memos = Object.create(null);
    hinted = new Set();
    hintedRows = new Set();
    fillPlay();
    if (slotOutcome()) {
      lockPlayBoard(null);
    }
    renderResult();
    const heading = document.querySelector("#screen-play h1");
    if (heading) {
      heading.focus();
    }
  }

  async function copyShare() {
    const view = currentView();
    if (view.share === "") {
      return;
    }
    if (params.failCopy) {
      copyState = "fail";
      renderResult();
      return;
    }
    try {
      if (globalThis.navigator.clipboard && globalThis.navigator.clipboard.writeText) {
        await globalThis.navigator.clipboard.writeText(view.share);
      } else {
        throw new Error("no clipboard");
      }
      copyState = "ok";
      copyStatus.dataset.copyId = "W7";
    } catch {
      copyState = "fail";
      copyStatus.dataset.copyId = "W8";
    }
    renderResult();
  }

  function openSampleOverlay() {
    overlay = true;
    screenPlay.inert = true;
    sampleDialog.showModal();
  }

  function closeSampleOverlay() {
    overlay = false;
    screenPlay.inert = false;
    if (sampleDialog.open) {
      sampleDialog.close();
    }
    btnS6.focus();
  }

  function collectCell(el) {
    const rect = el.getBoundingClientRect();
    const bodyEl = el.querySelector(".cell-body");
    const bodyRect = bodyEl.getBoundingClientRect();
    const inside =
      bodyRect.left >= rect.left - 0.5 &&
      bodyRect.right <= rect.right + 0.5 &&
      bodyRect.top >= rect.top - 0.5 &&
      bodyRect.bottom <= rect.bottom + 0.5;
    return {
      kana: el.dataset.kana,
      tag: el.tagName,
      className: el.className,
      disabled: Boolean(el.disabled),
      width: rect.width,
      height: rect.height,
      short: Math.min(rect.width, rect.height),
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      bodyInside: inside,
      body: bodyEl.textContent,
      hasKanaSpan: Boolean(el.querySelector(".cell-kana")),
      aria: el.getAttribute("aria-label"),
    };
  }

  function gaps(cells) {
    if (cells.length < 2) {
      return [];
    }
    const sorted = [...cells].sort((a, b) => a.top - b.top || a.left - b.left);
    const rowGap = sorted[1].left - sorted[0].right;
    return [rowGap];
  }

  function visibleCopy() {
    const rows = [];
    const roots = [
      app,
      sampleDialog.open ? sampleDialog : null,
      confirmDialog.open ? confirmDialog : null,
      hintDialog && hintDialog.open ? hintDialog : null,
    ].filter(Boolean);
    for (const root of roots) {
      for (const el of root.querySelectorAll("[data-copy-id]")) {
        if (el.closest("[hidden]") || (el.offsetParent === null && el.tagName !== "DIALOG")) {
          continue;
        }
        rows.push({
          id: el.dataset.copyId,
          text: el.classList.contains("share-lines")
            ? el.textContent
            : el.innerText.replace(/\s+/g, " ").trim(),
        });
      }
    }
    return rows;
  }

  function ariaStrings() {
    const out = [];
    for (const el of document.querySelectorAll("[aria-label], [aria-roledescription], [aria-description], [title], [alt]")) {
      if (el.closest("[hidden]")) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      const inOpenDialog = Boolean(el.closest("dialog[open]"));
      if (!inOpenDialog && rect.width <= 0 && rect.height <= 0) {
        continue;
      }
      for (const attr of ["aria-label", "aria-roledescription", "aria-description", "title", "alt"]) {
        const value = el.getAttribute(attr);
        if (value) {
          out.push({ attr, value });
        }
      }
    }
    return out;
  }

  function textLineCount(el) {
    if (!el || el.hidden || el.closest("[hidden]")) {
      return 0;
    }
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = new Set();
    for (const rect of range.getClientRects()) {
      if (rect.height >= 8 && rect.width >= 8) {
        tops.add(Math.round(rect.top));
      }
    }
    return tops.size;
  }

  function inViewport(el, vw, vh) {
    if (!el || el.hidden || el.closest("[hidden]")) {
      return true;
    }
    const rect = el.getBoundingClientRect();
    return rect.left >= -0.5 && rect.right <= vw + 0.5 && rect.top >= -0.5 && rect.bottom <= vh + 0.5;
  }

  globalThis.M4D_collect = function collect() {
    const innerWidth = globalThis.innerWidth;
    const innerHeight = globalThis.innerHeight;
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    function visibleCells(selector) {
      return [...document.querySelectorAll(selector)]
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        })
        .map(collectCell);
    }
    const sampleCells = visibleCells("#sample-board .cell, #overlay-board .cell");
    const playCells = visibleCells("#play-board .cell");
    const sampleMinShort = sampleCells.reduce((min, cell) => Math.min(min, cell.short), Infinity);
    const playMinShort = playCells.reduce((min, cell) => Math.min(min, cell.short), Infinity);
    const playGaps = gaps(playCells);
    const sampleGaps = gaps(sampleCells);
    const keys = {
      p2: document.querySelector("#screen-play [data-copy-id='P2']"),
      p3: document.querySelector("#screen-play [data-copy-id='P3']"),
      progress: playProgress,
      board: playBoard,
      result: resultText,
      share: shareLines,
      copy: btnCopy,
      next: btnNext,
      empty: document.querySelector("#screen-empty [data-copy-id='Z1']"),
    };
    const visibleBlob = visibleCopy()
      .map((row) => row.text)
      .join("\n");
    return {
      screen: {
        explain: !screenExplain.hidden,
        sample: !screenSample.hidden,
        empty: !screenEmpty.hidden,
        play: !screenPlay.hidden,
        overlay: sampleDialog.open,
        confirm: confirmDialog.open,
        hint: Boolean(hintDialog && hintDialog.open),
        pendingKana,
        hintedKanas: [...hinted],
        hintedRows: [...hintedRows],
        hintVisible: Boolean(btnHint) && !btnHint.hidden,
        hintDisabled: Boolean(btnHint) && btnHint.disabled,
        answerVisible: Boolean(btnAnswer) && !btnAnswer.hidden,
        answerMode,
        returnVisit,
        pressed,
        resultVisible: !resultBlock.hidden,
        hasBoard: selected.hasBoard,
        day: selected.calendarDay,
        slot: slotIndex + 1,
        stockDay: currentPuzzle()?.stockDay ?? null,
        complete: selected.hasBoard ? dayComplete(currentRecord().outcomes) : false,
        nextVisible: Boolean(btnNext) && !btnNext.hidden,
      },
      viewport: {
        innerWidth,
        innerHeight,
        scrollWidth,
        overflowX: scrollWidth > innerWidth,
      },
      sample: {
        count: sampleCells.length,
        minShort: sampleCells.length ? sampleMinShort : null,
        gaps: sampleGaps,
        cellsInside: sampleCells.every((cell) => cell.bodyInside),
        pressable: sampleCells.some((cell) => cell.tag === "BUTTON"),
        hasKanaSpan: sampleCells.some((cell) => cell.hasKanaSpan),
        ariaOk: sampleCells.every((cell) => /^上から\d+番目、左から\d+番目、/.test(cell.aria || "")),
      },
      play: {
        count: playCells.length,
        minShort: playCells.length ? playMinShort : null,
        gaps: playGaps,
        cellsInside: playCells.every((cell) => cell.bodyInside),
        hasKanaSpan: playCells.some((cell) => cell.hasKanaSpan),
        ariaOk: playCells.every((cell) => /^上から\d+番目、左から\d+番目、/.test(cell.aria || "")),
        stoneButtons: playCells
          .filter((cell) => cell.tag === "BUTTON" && cell.className.includes("cell-stone"))
          .map((cell) => cell.kana),
        numberButtons: playCells
          .filter((cell) => cell.tag === "BUTTON" && !cell.className.includes("cell-stone"))
          .map((cell) => cell.kana),
        stoneCellsAfterReveal: playCells.filter(
          (cell) => cell.className.includes("cell-stone") && cell.body === "石",
        ).length,
        inView: {
          p2: inViewport(keys.p2, innerWidth, innerHeight),
          p3: inViewport(keys.p3, innerWidth, innerHeight),
          progress: inViewport(keys.progress, innerWidth, innerHeight),
          board: inViewport(keys.board, innerWidth, innerHeight),
          result: resultBlock.hidden ? true : inViewport(keys.result, innerWidth, innerHeight),
          share: shareLines.hidden ? true : inViewport(keys.share, innerWidth, innerHeight),
          copy: btnCopy.hidden ? true : inViewport(keys.copy, innerWidth, innerHeight),
          next: btnNext.hidden ? true : inViewport(keys.next, innerWidth, innerHeight),
          empty: screenEmpty.hidden ? true : inViewport(keys.empty, innerWidth, innerHeight),
        },
      },
      copy: visibleCopy(),
      visibleBlob,
      shareText: shareLines.textContent,
      lines: {
        e2: textLineCount(document.querySelector("#screen-explain [data-copy-id='E2']")),
        s2: textLineCount(document.querySelector("#screen-sample [data-copy-id='S2']")),
        p2: textLineCount(document.querySelector("#screen-play [data-copy-id='P2']")),
      },
      aria: ariaStrings(),
      title: document.title,
      extras: currentView().extras,
    };
  };

  fillSample(sampleBoard, SAMPLE_TRUE, true);
  fillSample(samplePuzzleBoard, SAMPLE_PUZZLE, false);
  fillSample(overlayBoard, SAMPLE_TRUE, true);
  fillSample(overlayPuzzleBoard, SAMPLE_PUZZLE, false);
  fillPlay();

  btnE3.addEventListener("click", () => showScreen("sample"));
  btnS5.addEventListener("click", () => {
    markIntroSeen();
    showScreen("play");
  });
  btnS6.addEventListener("click", openSampleOverlay);
  btnS7.addEventListener("click", closeSampleOverlay);
  sampleDialog.addEventListener("close", () => {
    syncOverlay();
  });
  btnConfirmOk.addEventListener("click", onConfirmOk);
  btnConfirmCancel.addEventListener("click", () => closeConfirm());
  confirmDialog.addEventListener("close", () => {
    resetConfirmState();
  });
  confirmDialog.addEventListener("click", (event) => {
    if (event.target === confirmDialog) {
      closeConfirm();
    }
  });
  btnCopy.addEventListener("click", () => {
    copyShare();
  });
  btnNext.addEventListener("click", () => {
    goNextPuzzle();
  });
  if (btnAnswer) {
    btnAnswer.addEventListener("click", () => {
      if (overlay || slotOutcome()) {
        return;
      }
      setAnswerMode(!answerMode);
    });
  }
  if (btnHint) {
    btnHint.addEventListener("click", () => {
      if (overlay || slotOutcome()) {
        return;
      }
      openHintMenu();
    });
  }
  if (btnHintCell) {
    btnHintCell.addEventListener("click", onHintCell);
  }
  if (btnHintRow) {
    btnHintRow.addEventListener("click", onHintRow);
  }
  if (btnHintCancel) {
    btnHintCancel.addEventListener("click", () => closeHint());
  }
  if (hintDialog) {
    hintDialog.addEventListener("close", () => {
      const restore = hintRestoreFocus;
      syncOverlay();
      if (restore && btnHint && !btnHint.hidden && typeof btnHint.focus === "function") {
        btnHint.focus();
      }
    });
    hintDialog.addEventListener("click", (event) => {
      if (event.target === hintDialog) {
        closeHint();
      }
    });
  }

  if (!selected.hasBoard) {
    showScreen("empty");
    return;
  }

  const openingOutcome = slotOutcome();
  if (openingOutcome) {
    pressed = "saved";
    lockPlayBoard(null);
    renderResult();
    showScreen("play");
    return;
  }

  renderPlayChrome();
  if (returnVisit) {
    showScreen("play");
  } else {
    showScreen("explain");
  }
}

const playPage = Boolean(
  globalThis.document?.getElementById("app") && globalThis.document.querySelector("#play-board"),
);
if (playPage) {
  boot().catch((error) => {
    const app = globalThis.document?.getElementById("app");
    if (app) {
      app.replaceChildren(globalThis.document.createTextNode("今日の盤はまだありません"));
    }
    console.error(error);
  });
}
