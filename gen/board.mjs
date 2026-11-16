/**
 * 方向D（石のとなり）6×6・石6。上下左右の隣数。うそは1マス、表示は正しい数±1。
 * 即解型: 表示0、空いた十字の1、数字が唯一、次数超え、次数いっぱい穴、
 * 次数いっぱいなのに足りない、一直線の両側が石で表示1以下（辺の挟み1の一般化）。
 * 隣接最大2つでは、数字が唯一と辺・内部の次数全体型は括れない（試験で固定）。
 * 核はうそマス名。プレイヤーの共有には出さない。
 */
export const SIZE = 6;
export const STONE_COUNT = 6;
export const N = SIZE * SIZE;

/** 左上から横へ。01-spec の仮名。 */
export const CELL_KANA = [
  "ア",
  "イ",
  "ウ",
  "エ",
  "オ",
  "カ",
  "キ",
  "ク",
  "ケ",
  "コ",
  "サ",
  "シ",
  "ス",
  "セ",
  "ソ",
  "タ",
  "チ",
  "ツ",
  "テ",
  "ト",
  "ナ",
  "ニ",
  "ヌ",
  "ネ",
  "ノ",
  "ハ",
  "ヒ",
  "フ",
  "ヘ",
  "ホ",
  "マ",
  "ミ",
  "ム",
  "メ",
  "モ",
  "ヤ",
];

export const SHARE_WIN = ["石のとなり", "当たりです"];
export const SHARE_LOSE = ["石のとなり", "今日はここまでです"];

/** @type {number[][]} */
export const NEI = Array.from({ length: N }, (_, i) => {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const out = [];
  if (r > 0) out.push(i - SIZE);
  if (r + 1 < SIZE) out.push(i + SIZE);
  if (c > 0) out.push(i - 1);
  if (c + 1 < SIZE) out.push(i + 1);
  return out;
});

export const DEG = NEI.map((a) => a.length);

const FW_DIGIT = { 0: "０", 1: "１", 2: "２", 3: "３", 4: "４" };

/**
 * @param {number} i
 * @returns {"corner" | "edge" | "interior"}
 */
export function cellRegion(i) {
  const r = Math.floor(i / SIZE);
  const c = i % SIZE;
  const onEdge = r === 0 || r === SIZE - 1 || c === 0 || c === SIZE - 1;
  if (!onEdge) return "interior";
  if ((r === 0 || r === SIZE - 1) && (c === 0 || c === SIZE - 1)) return "corner";
  return "edge";
}

export const REGION_JA = {
  corner: "角",
  edge: "辺",
  interior: "内部",
};

/**
 * @param {number} n
 * @param {number} k
 * @param {(combo: number[]) => void} fn
 */
export function forEachCombo(n, k, fn) {
  const c = Array.from({ length: k }, (_, i) => i);
  while (true) {
    fn(c);
    let i = k - 1;
    while (i >= 0 && c[i] === n - k + i) i -= 1;
    if (i < 0) return;
    c[i] += 1;
    for (let j = i + 1; j < k; j += 1) c[j] = c[j - 1] + 1;
  }
}

/**
 * @param {string} s
 */
export function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {Iterable<number>} stones
 * @returns {Uint8Array}
 */
export function occupy(stones) {
  const occupied = new Uint8Array(N);
  for (const s of stones) occupied[s] = 1;
  return occupied;
}

/**
 * @param {Uint8Array | number[]} occupied
 * @returns {Int8Array}
 */
export function actualCounts(occupied) {
  const shown = new Int8Array(N);
  for (let i = 0; i < N; i += 1) {
    if (occupied[i]) {
      shown[i] = -1;
      continue;
    }
    let t = 0;
    const nei = NEI[i];
    for (let j = 0; j < nei.length; j += 1) t += occupied[nei[j]];
    shown[i] = t;
  }
  return shown;
}

/**
 * 数字マスの正しい隣数の頻度。うそを入れる前。
 * @param {Int8Array | number[]} shown
 */
export function digitFreq(shown) {
  const freq = new Uint16Array(5);
  for (let i = 0; i < N; i += 1) {
    const v = shown[i];
    if (v >= 0) freq[v] += 1;
  }
  return freq;
}

/**
 * 一直線の両側が石で、表示が 1 以下。辺の挟み1の一般化（内部の縦横も含む）。
 * @param {number} lie
 * @param {number} displayed
 * @param {Uint8Array | number[]} occupied
 */
export function collinearSandwich(lie, displayed, occupied) {
  if (displayed > 1) return false;
  const r = Math.floor(lie / SIZE);
  const c = lie % SIZE;
  const left = c > 0 ? lie - 1 : -1;
  const right = c + 1 < SIZE ? lie + 1 : -1;
  if (left >= 0 && right >= 0 && occupied[left] && occupied[right]) return true;
  const up = r > 0 ? lie - SIZE : -1;
  const down = r + 1 < SIZE ? lie + SIZE : -1;
  if (up >= 0 && down >= 0 && occupied[up] && occupied[down]) return true;
  return false;
}

/**
 * そのマスと直交隣の最大2つだけを見て、表示が取りうる隣数の外になる。
 * 次数超え、表示0、次数いっぱい穴、角の両隣石なのに1、辺の挟み1、L字2石の1、を含む。
 * 数字が唯一は含まない。辺・内部の空いた十字の1と次数いっぱいなのに足りない（隣3〜4）も含まない。
 * @param {number} lie
 * @param {number} displayed
 * @param {Uint8Array | number[]} occupied
 */
export function localBoundContradiction(lie, displayed, occupied) {
  const nei = NEI[lie];
  const n = nei.length;
  /**
   * @param {number[]} subset
   */
  function outOfRange(subset) {
    let stones = 0;
    for (const i of subset) stones += occupied[i] ? 1 : 0;
    const min = stones;
    const max = stones + (n - subset.length);
    return displayed < min || displayed > max;
  }
  if (outOfRange([])) return true;
  for (let i = 0; i < n; i += 1) {
    if (outOfRange([nei[i]])) return true;
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (outOfRange([nei[i], nei[j]])) return true;
    }
  }
  return false;
}

/**
 * @param {{ actual: number, displayed: number, lie: number, freq: Uint16Array | number[], occupied?: Uint8Array | number[] }} p
 */
export function instantFlags(p) {
  const deg = DEG[p.lie];
  const displayZero = p.displayed === 0;
  const isolatedOne = p.actual === 0 && p.displayed === 1;
  const uniqueDigit = p.freq[p.displayed] === 0;
  const overDegree = p.displayed > deg;
  const degreeFullHole = p.displayed === deg && p.actual < deg;
  const fullNeighborhoodLow = p.actual === deg && p.displayed < deg;
  const sandwich =
    p.occupied != null ? collinearSandwich(p.lie, p.displayed, p.occupied) : false;
  const localBound =
    p.occupied != null ? localBoundContradiction(p.lie, p.displayed, p.occupied) : false;
  return {
    displayZero,
    isolatedOne,
    uniqueDigit,
    overDegree,
    degreeFullHole,
    fullNeighborhoodLow,
    sandwich,
    localBound,
    instant:
      displayZero ||
      isolatedOne ||
      uniqueDigit ||
      overDegree ||
      degreeFullHole ||
      fullNeighborhoodLow ||
      sandwich,
  };
}

/**
 * 角の次数は2。±1 で表示が 0..4 に入る組は次の5つだけ。
 * uniqueDigit を無視しても、すべて既存型か新型に当たる。
 * @returns {Array<{ actual: number, displayed: number, type: string, flags: ReturnType<typeof instantFlags> }>}
 */
export function classifyCornerDeltas() {
  const lie = 0;
  const freq = [1, 1, 1, 1, 1];
  const rows = [];
  for (let actual = 0; actual <= DEG[lie]; actual += 1) {
    for (const delta of [-1, 1]) {
      const displayed = actual + delta;
      if (displayed < 0 || displayed > 4) continue;
      const flags = instantFlags({ actual, displayed, lie, freq });
      let type = "none";
      if (flags.displayZero) type = "displayZero";
      else if (flags.isolatedOne) type = "isolatedOne";
      else if (flags.overDegree) type = "overDegree";
      else if (flags.degreeFullHole) type = "degreeFullHole";
      else if (flags.fullNeighborhoodLow) type = "fullNeighborhoodLow";
      else if (flags.uniqueDigit) type = "uniqueDigit";
      rows.push({ actual, displayed, type, flags });
    }
  }
  return rows;
}

/**
 * 表示盤のうそマス。石は見えるので、正しい隣数と表示が違うマスを数える。
 * @param {Uint8Array | number[]} occupied
 * @param {(number | string)[]} displayedBoard -1 or "石" が石。それ以外は表示数字。
 * @returns {{ count: number, lies: number[] }}
 */
export function countLies(occupied, displayedBoard) {
  const lies = [];
  for (let i = 0; i < N; i += 1) {
    if (occupied[i]) continue;
    const raw = displayedBoard[i];
    const shown = raw === "石" || raw === -1 ? -1 : Number(raw);
    let actual = 0;
    const nei = NEI[i];
    for (let j = 0; j < nei.length; j += 1) actual += occupied[nei[j]];
    if (shown !== actual) lies.push(i);
  }
  return { count: lies.length, lies };
}

/**
 * @param {number[]} stones
 * @param {number} lie
 * @param {number} displayed
 */
export function displayedBoard(stones, lie, displayed) {
  const occupied = occupy(stones);
  const actual = actualCounts(occupied);
  /** @type {number[]} */
  const board = Array.from({ length: N }, (_, i) => (occupied[i] ? -1 : actual[i]));
  board[lie] = displayed;
  return { occupied, actual, board };
}

/**
 * @param {number[]} stones
 */
export function stoneScatter(stones) {
  const rows = stones.map((i) => Math.floor(i / SIZE));
  const cols = stones.map((i) => i % SIZE);
  const rowSpan = Math.max(...rows) - Math.min(...rows);
  const colSpan = Math.max(...cols) - Math.min(...cols);
  const nRows = new Set(rows).size;
  const nCols = new Set(cols).size;
  const quads = new Set();
  for (let k = 0; k < stones.length; k += 1) {
    quads.add((rows[k] < 3 ? 0 : 2) + (cols[k] < 3 ? 0 : 1));
  }
  const spread = rowSpan >= 3 && colSpan >= 3 && nRows >= 4 && nCols >= 4 && quads.size >= 3;
  return { rowSpan, colSpan, nRows, nCols, nQuad: quads.size, spread };
}

/**
 * 1マスに仮名と中身。名の行と数字の行は分けない。
 * @param {(number | string)[]} board
 */
export function formatBoardInline(board) {
  const lines = [];
  for (let r = 0; r < SIZE; r += 1) {
    const cells = [];
    for (let c = 0; c < SIZE; c += 1) {
      const i = r * SIZE + c;
      const v = board[i];
      const body = v === "石" || v === -1 ? "石" : (FW_DIGIT[Number(v)] ?? String(v));
      cells.push(`${CELL_KANA[i]}${body}`);
    }
    lines.push(cells.join(" "));
  }
  return lines.join("\n");
}

/**
 * @param {(number | string)[]} board
 */
export function formatBoardTable(board) {
  const rows = [];
  for (let r = 0; r < SIZE; r += 1) {
    const cells = [];
    for (let c = 0; c < SIZE; c += 1) {
      const i = r * SIZE + c;
      const v = board[i];
      const body = v === "石" || v === -1 ? "石" : String(v);
      cells.push(`${CELL_KANA[i]} ${body}`);
    }
    rows.push(`| ${cells.join(" | ")} |`);
    if (r === 0) rows.push(`| ${Array.from({ length: SIZE }, () => ":---:").join(" | ")} |`);
  }
  return rows.join("\n");
}

/**
 * @param {unknown} stones
 * @returns {string[] | null}
 */
export function normalizeStones(stones) {
  if (!Array.isArray(stones) || stones.length !== STONE_COUNT) return null;
  const out = [];
  const seen = new Set();
  for (const s of stones) {
    if (!Number.isInteger(s) || s < 0 || s >= N) return null;
    if (seen.has(s)) return null;
    seen.add(s);
    out.push(s);
  }
  out.sort((a, b) => a - b);
  return out;
}

/**
 * 1問を検査する。出荷に載せてよいとき ok。
 * @param {{ stones: unknown, lie: unknown, displayed: unknown }} raw
 */
export function inspectPuzzle(raw) {
  /** @type {string[]} */
  const errors = [];
  const stones = normalizeStones(raw.stones);
  if (!stones) errors.push("石は6個の重複しない 0..35");
  if (!Number.isInteger(raw.lie) || raw.lie < 0 || raw.lie >= N) {
    errors.push("うそマスの番号が 0..35 ではない");
  }
  if (!Number.isInteger(raw.displayed) || raw.displayed < 0 || raw.displayed > 4) {
    errors.push("表示が 0..4 の整数ではない");
  }
  if (errors.length) {
    return {
      ok: false,
      errors,
      stones,
      lie: raw.lie,
      displayed: raw.displayed,
    };
  }
  const lie = raw.lie;
  const displayed = raw.displayed;
  if (stones.includes(lie)) errors.push("うそマスが石のうえにある");
  const { occupied, actual, board } = displayedBoard(stones, lie, displayed);
  const truth = actual[lie];
  const delta = displayed - truth;
  if (delta !== 1 && delta !== -1) errors.push("表示が正しい隣数から ±1 ではない");
  const freq = digitFreq(actual);
  freq[truth] -= 1;
  const flags = instantFlags({ actual: truth, displayed, lie, freq, occupied });
  if (flags.displayZero) errors.push("即解: 表示0");
  if (flags.isolatedOne) errors.push("即解: 空いた十字の1");
  if (flags.uniqueDigit) errors.push("即解: 数字が唯一");
  if (flags.overDegree) errors.push("即解: 次数超え");
  if (flags.degreeFullHole) errors.push("即解: 次数いっぱい穴");
  if (flags.fullNeighborhoodLow) errors.push("即解: 次数いっぱいなのに足りない");
  if (flags.sandwich) errors.push("即解: 一直線の両側が石で表示1以下");
  const lieScan = countLies(occupied, board);
  if (lieScan.count === 0) errors.push("うそが 0 マス");
  if (lieScan.count >= 2) errors.push(`うそが ${lieScan.count} マス`);
  if (lieScan.count === 1 && lieScan.lies[0] !== lie) {
    errors.push("うそのマスが一意だが記録と違う");
  }
  const region = cellRegion(lie);
  return {
    ok: errors.length === 0,
    errors,
    stones,
    lie,
    lieKana: CELL_KANA[lie],
    displayed,
    actual: truth,
    delta,
    offsetJa: delta === 1 ? "1多い" : delta === -1 ? "1少ない" : "不正",
    region,
    regionJa: REGION_JA[region],
    flags,
    lieCount: lieScan.count,
    board,
    occupied,
  };
}
