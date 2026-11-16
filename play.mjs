/**
 * 方向D 統合ページ。盤は stock.json、正誤は gen/board.mjs の inspectPuzzle、
 * 結果と保存と共有は share/share.mjs。トラック2の仮の1問は使わない。
 * 画面文の正本は 02-copy.md。日替わりの見出しと連続日は出さない。
 * 日替わりは 01-spec の JST 暦日。開始日は START_DATE_JST の1か所。
 */
import {
  CELL_KANA,
  inspectPuzzle,
} from "./gen/board.mjs";
import {
  loadRecord,
  saveOutcome,
  viewModel,
} from "./share/share.mjs";

export const INTRO_KEY = "ishi-no-tonari.intro.v1";

/** 見本 3×3。01-spec の表。押す対象ではない。 */
export const SAMPLE = [
  { kana: "ア", stone: true },
  { kana: "イ", stone: false, value: 1 },
  { kana: "ウ", stone: false, value: 1 },
  { kana: "エ", stone: false, value: 1 },
  { kana: "オ", stone: false, value: 2 },
  { kana: "カ", stone: true },
  { kana: "キ", stone: false, value: 1 },
  { kana: "ク", stone: true },
  { kana: "ケ", stone: false, value: 2 },
];

/** 説明・見本・本番の文。結果と空状態は share の COPY。 */
export const SCREEN_COPY = {
  E1: "石のとなり",
  E2: "マインスイーパーに似ています。\n数字は上下左右の石の数です。\n斜めは数えません。\nうその数字が1つだけあります。\nそのマスを押してください。",
  E3: "見本を見る",
  S1: "見本",
  S2: "これは見本です。\nこの盤は見るだけです。\nまんなかの2は、上下左右の石の数です。\n斜めの石は数えません。",
  S5: "はじめる",
  S6: "見本を見る",
  S7: "閉じる",
  P1: "石のとなり",
  P2: "数字は上下左右の石の数です。\n斜めは数えません。\nうその数字が1つだけあります。",
  P3: "マスを押すのは1回だけです。",
  P8: "たて6、よこ6の盤",
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
 * 公開開始日（Asia/Tokyo の暦日）。01-spec は「日付は JST の暦日」と
 * 在庫が尽きた日は Z1 と書く。開始日の暦対応は正本に無いのでここ1か所。
 * 2026-11-16 JST をフリーズ日1とし、以降1日ずつ進む。
 */
export const START_DATE_JST = "2026-11-16";

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
  return {
    empty,
    visit2,
    failCopy,
    requestedDay,
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
export function selectBoard(stock, params) {
  if (params.empty) {
    return { hasBoard: false, day: null, info: null, raw: null };
  }
  if (!Array.isArray(stock?.days)) {
    return { hasBoard: false, day: null, info: null, raw: null };
  }
  const length = stock.days.length;
  const requested = params.requestedDay;
  const todayDay = params.todayDay;
  let day;
  if (requested == null) {
    day = todayDay;
  } else if (!Number.isInteger(requested) || requested > todayDay) {
    return { hasBoard: false, day: null, info: null, raw: null };
  } else {
    day = requested;
  }
  if (!Number.isInteger(day) || day < 1 || day > length) {
    return { hasBoard: false, day: null, info: null, raw: null };
  }
  const raw = stock.days[day - 1];
  const info = inspectPuzzle({
    stones: raw.stones,
    lie: raw.lie,
    displayed: raw.displayed,
  });
  if (!info.ok) {
    return { hasBoard: false, day, info, raw };
  }
  return { hasBoard: true, day, info, raw };
}

/**
 * 正誤は inspectPuzzle が返した唯一のうそマス。仮の1問の4型判定は使わない。
 *
 * @param {ReturnType<typeof inspectPuzzle> | null} info
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
  if (info.occupied[i]) {
    return { ignored: true, win: false };
  }
  return { ignored: false, win: kana === info.lieKana };
}

/**
 * @param {string} kana
 * @param {boolean} stone
 * @param {number | null} value
 */
export function ariaFor(kana, stone, value) {
  if (stone) {
    return `${kana}、石`;
  }
  return `${kana}、${value}`;
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
  return { daily: true, todayKey: `stock-${day}` };
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
  const overlayBoard = document.getElementById("overlay-board");
  const playBoard = document.getElementById("play-board");
  const sampleDialog = document.getElementById("sample-dialog");
  const btnE3 = document.getElementById("btn-e3");
  const btnS5 = document.getElementById("btn-s5");
  const btnS6 = document.getElementById("btn-s6");
  const btnS7 = document.getElementById("btn-s7");
  const btnCopy = document.getElementById("btn-copy");
  const resultBlock = document.getElementById("result-block");
  const resultText = document.getElementById("result-text");
  const shareLines = document.getElementById("share-lines");
  const copyStatus = document.getElementById("copy-status");

  const params = parsePlayParams(globalThis.location.search, currentNowMs());
  const selected = selectBoard(stockJson, params);
  const storage = globalThis.localStorage;
  const record = selected.hasBoard
    ? loadRecord(storage, saveOptions(selected.day))
    : { version: 1, outcome: null };
  let overlay = false;
  let pressed = record.outcome ? "saved" : null;
  /** @type {"" | "ok" | "fail"} */
  let copyState = "";
  const returnVisit = params.visit2 || introSeen();

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

  function fillSample(board) {
    board.replaceChildren();
    for (const cell of SAMPLE) {
      board.append(makeCell(cell.kana, cell.stone, cell.stone ? null : cell.value, false, "S3"));
    }
  }

  function fillPlay() {
    playBoard.replaceChildren();
    if (!selected.hasBoard || !selected.info) {
      return;
    }
    const board = selected.info.board;
    for (let i = 0; i < CELL_KANA.length; i += 1) {
      const kana = CELL_KANA[i];
      const stone = board[i] === -1;
      const value = stone ? null : board[i];
      const copyId = stone ? "P5" : "P4";
      playBoard.append(makeCell(kana, stone, value, !stone, copyId));
    }
  }

  function makeCell(kana, stone, value, pressable, copyId) {
    const el = document.createElement(pressable ? "button" : "div");
    if (pressable) {
      el.type = "button";
    }
    el.className = stone ? "cell cell-stone" : "cell";
    el.dataset.kana = kana;
    el.dataset.copyId = copyId;
    el.setAttribute("aria-label", ariaFor(kana, stone, value));
    const kanaEl = document.createElement("span");
    kanaEl.className = "cell-kana";
    kanaEl.textContent = kana;
    const bodyEl = document.createElement("span");
    bodyEl.className = "cell-body";
    bodyEl.textContent = stone ? "石" : String(value);
    el.append(kanaEl, bodyEl);
    if (pressable) {
      el.addEventListener("click", () => onPlayPress(kana));
    }
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
      record: selected.hasBoard ? record : null,
      copyState,
      streak: 12,
    });
  }

  function renderResult() {
    const view = currentView();
    if (!view.result) {
      resultBlock.hidden = true;
      copyStatus.hidden = true;
      copyStatus.textContent = "";
      return;
    }
    const win = record.outcome === "hit";
    resultBlock.hidden = false;
    resultText.dataset.copyId = win ? "W1" : "L1";
    resultText.textContent = view.result;
    shareLines.dataset.copyId = win ? "W5" : "L4";
    shareLines.textContent = view.share;
    btnCopy.dataset.copyId = win ? "W6" : "L5";
    btnCopy.textContent = view.copyLabel;
    if (view.copyStatus) {
      copyStatus.hidden = false;
      copyStatus.dataset.copyId = copyState === "ok" ? (win ? "W7" : "L6") : win ? "W8" : "L7";
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

  function onPlayPress(kana) {
    if (overlay) {
      return;
    }
    if (record.outcome === "hit" || record.outcome === "miss") {
      return;
    }
    const judged = judgePress(selected.info, kana);
    if (judged.ignored) {
      return;
    }
    const outcome = judged.win ? "hit" : "miss";
    const saved = saveOutcome(storage, outcome, saveOptions(selected.day));
    record.outcome = saved.outcome;
    record.dateKey = saved.dateKey;
    pressed = kana;
    lockPlayBoard(kana);
    copyState = "";
    renderResult();
    resultText.focus();
  }

  async function copyShare() {
    const view = currentView();
    if (view.share === "") {
      return;
    }
    const win = record.outcome === "hit";
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
      copyStatus.dataset.copyId = win ? "W7" : "L6";
    } catch {
      copyState = "fail";
      copyStatus.dataset.copyId = win ? "W8" : "L7";
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
    const kanaEl = el.querySelector(".cell-kana");
    const bodyEl = el.querySelector(".cell-body");
    const kanaRect = kanaEl.getBoundingClientRect();
    const bodyRect = bodyEl.getBoundingClientRect();
    const inside =
      kanaRect.left >= rect.left - 0.5 &&
      kanaRect.right <= rect.right + 0.5 &&
      kanaRect.top >= rect.top - 0.5 &&
      kanaRect.bottom <= rect.bottom + 0.5 &&
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
      kanaAndBodyInside: inside,
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
    const roots = [app, sampleDialog.open ? sampleDialog : null].filter(Boolean);
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
      board: playBoard,
      result: resultText,
      share: shareLines,
      copy: btnCopy,
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
        returnVisit,
        pressed,
        resultVisible: !resultBlock.hidden,
        hasBoard: selected.hasBoard,
        day: selected.day,
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
        cellsInside: sampleCells.every((cell) => cell.kanaAndBodyInside),
        pressable: sampleCells.some((cell) => cell.tag === "BUTTON"),
      },
      play: {
        count: playCells.length,
        minShort: playCells.length ? playMinShort : null,
        gaps: playGaps,
        cellsInside: playCells.every((cell) => cell.kanaAndBodyInside),
        stoneButtons: playCells
          .filter((cell) => cell.tag === "BUTTON" && cell.className.includes("cell-stone"))
          .map((cell) => cell.kana),
        numberButtons: playCells
          .filter((cell) => cell.tag === "BUTTON" && !cell.className.includes("cell-stone"))
          .map((cell) => cell.kana),
        inView: {
          p2: inViewport(keys.p2, innerWidth, innerHeight),
          p3: inViewport(keys.p3, innerWidth, innerHeight),
          board: inViewport(keys.board, innerWidth, innerHeight),
          result: resultBlock.hidden ? true : inViewport(keys.result, innerWidth, innerHeight),
          share: resultBlock.hidden ? true : inViewport(keys.share, innerWidth, innerHeight),
          copy: resultBlock.hidden ? true : inViewport(keys.copy, innerWidth, innerHeight),
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

  fillSample(sampleBoard);
  fillSample(overlayBoard);
  fillPlay();

  btnE3.addEventListener("click", () => showScreen("sample"));
  btnS5.addEventListener("click", () => {
    markIntroSeen();
    showScreen("play");
  });
  btnS6.addEventListener("click", openSampleOverlay);
  btnS7.addEventListener("click", closeSampleOverlay);
  sampleDialog.addEventListener("close", () => {
    overlay = false;
    screenPlay.inert = false;
  });
  btnCopy.addEventListener("click", () => {
    copyShare();
  });

  if (!selected.hasBoard) {
    showScreen("empty");
    return;
  }

  if (record.outcome === "hit" || record.outcome === "miss") {
    btnS6.hidden = false;
    lockPlayBoard(null);
    renderResult();
    showScreen("play");
    return;
  }

  if (returnVisit) {
    btnS6.hidden = false;
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
