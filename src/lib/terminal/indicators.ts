import type { Candle, Indicators } from "./types";

export function emaArr(arr: number[], p: number): number[] {
  if (!arr.length) return [];
  const k = 2 / (p + 1);
  const out: number[] = [arr[0]!];
  let prev = arr[0]!;
  for (let i = 1; i < arr.length; i++) {
    prev = arr[i]! * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function rsiVal(closes: number[], p = 14): number | null {
  if (closes.length < p + 1) return null;
  let g = 0;
  let l = 0;
  for (let i = 1; i <= p; i++) {
    const d = closes[i]! - closes[i - 1]!;
    if (d >= 0) g += d;
    else l -= d;
  }
  g /= p;
  l /= p;
  let rs = l === 0 ? 100 : g / l;
  let v = 100 - 100 / (1 + rs);
  for (let j = p + 1; j < closes.length; j++) {
    const dd = closes[j]! - closes[j - 1]!;
    g = (g * (p - 1) + Math.max(dd, 0)) / p;
    l = (l * (p - 1) + Math.max(-dd, 0)) / p;
    rs = l === 0 ? 100 : g / l;
    v = 100 - 100 / (1 + rs);
  }
  return v;
}

export function macdVal(closes: number[]) {
  const f = emaArr(closes, 12);
  const s = emaArr(closes, 26);
  const line = closes.map((_, i) => f[i]! - s[i]!);
  const sg = emaArr(line, 9);
  const hist = line.map((v, i) => v - sg[i]!);
  const n = line.length;
  return {
    line: line[n - 1]!,
    signal: sg[n - 1]!,
    hist: hist[n - 1]!,
    histPrev: hist[n - 2] ?? hist[n - 1]!,
  };
}

export function stochVal(bars: Candle[], p = 14) {
  if (bars.length < p + 1) return null;
  const n = bars.length;
  const K: number[] = [];
  for (let i = p - 1; i < n; i++) {
    let ll = Infinity;
    let hh = -Infinity;
    for (let j = i - (p - 1); j <= i; j++) {
      ll = Math.min(ll, bars[j]!.l);
      hh = Math.max(hh, bars[j]!.h);
    }
    K.push(hh === ll ? 50 : ((bars[i]!.c - ll) / (hh - ll)) * 100);
  }
  const lastK = K[K.length - 1]!;
  const dN = Math.min(3, K.length);
  let dSum = 0;
  for (let q = K.length - dN; q < K.length; q++) dSum += K[q]!;
  return { k: lastK, d: dSum / dN };
}

export function bbVal(closes: number[], p = 20, m = 2) {
  if (closes.length < p) return null;
  const slice = closes.slice(closes.length - p);
  const sma = slice.reduce((a, b) => a + b, 0) / p;
  const sd = Math.sqrt(slice.reduce((a, b) => a + (b - sma) ** 2, 0) / p);
  const c = closes[closes.length - 1]!;
  return {
    mid: sma,
    upper: sma + m * sd,
    lower: sma - m * sd,
    pb: (2 * m * sd) === 0 ? 0.5 : (c - (sma - m * sd)) / (2 * m * sd),
    width: sma === 0 ? 0 : (2 * m * sd) / sma,
  };
}

export function atrVal(bars: Candle[], p = 14) {
  if (bars.length < p + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i]!;
    const pb = bars[i - 1]!;
    trs.push(Math.max(b.h - b.l, Math.abs(b.h - pb.c), Math.abs(b.l - pb.c)));
  }
  let a = trs.slice(0, p).reduce((x, y) => x + y, 0) / p;
  for (let j = p; j < trs.length; j++) a = (a * (p - 1) + trs[j]!) / p;
  return a;
}

export function vwapVal(bars: Candle[]) {
  let pv = 0;
  let vv = 0;
  for (const b of bars) {
    const tp = (b.h + b.l + b.c) / 3;
    pv += tp * b.v;
    vv += b.v;
  }
  return vv === 0 ? null : pv / vv;
}

export function computeIndicators(bars: Candle[]): Indicators | null {
  if (!bars.length) return null;
  const closes = bars.map((b) => b.c);
  const e8 = emaArr(closes, 8);
  const e21 = emaArr(closes, 21);
  const e50 = emaArr(closes, 50);
  return {
    rsi: rsiVal(closes),
    macd: macdVal(closes),
    stoch: stochVal(bars),
    bb: bbVal(closes),
    atr: atrVal(bars),
    vwap: vwapVal(bars),
    ema8: e8[e8.length - 1] ?? null,
    ema21: e21[e21.length - 1] ?? null,
    ema50: e50[e50.length - 1] ?? null,
  };
}
