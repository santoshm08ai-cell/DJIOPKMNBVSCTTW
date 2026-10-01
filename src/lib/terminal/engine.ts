import { clamp, fmt } from "./format";
import type { BookLevel, Candle, EngineResult, Factor, Gate, Indicators } from "./types";

export function runEngine(args: {
  inds: Indicators | null;
  klines: Candle[];
  price: number | null;
  funding: number | null;
  lsRatio: number | null;
  bids: BookLevel[];
  asks: BookLevel[];
  lastWs: number;
  lastApi: number;
  equity: number;
  riskPct: number;
  prev: EngineResult;
}): EngineResult {
  const { inds: I, klines: bars, price: p, funding, lsRatio, bids, asks, lastWs, lastApi, equity, riskPct, prev } =
    args;
  if (!I || !bars.length || p == null) return prev;

  const factors: Factor[] = [];
  let dirSum = 0;
  const e8 = I.ema8 ?? p;
  const e21 = I.ema21 ?? p;
  const e50 = I.ema50 ?? p;

  let f1 = 0;
  let f1d = "Stack mixed";
  if (p > e8 && e8 > e21 && e21 > e50) {
    f1 = 1;
    f1d = "Full bull stack (C>8>21>50)";
  } else if (p < e8 && e8 < e21 && e21 < e50) {
    f1 = -1;
    f1d = "Full bear stack (C<8<21<50)";
  } else if (p > e8 && e8 > e21) {
    f1 = 1;
    f1d = "Partial bull (C>8>21)";
  } else if (p < e8 && e8 < e21) {
    f1 = -1;
    f1d = "Partial bear (C<8<21)";
  }
  factors.push({ name: "EMA STACK", vote: f1, detail: f1d });
  dirSum += f1;

  let f2 = 0;
  let f2d = "no data";
  if (I.rsi != null) {
    if (I.rsi < 35) {
      f2 = -1;
      f2d = `RSI ${I.rsi.toFixed(1)} weak / falling`;
    } else if (I.rsi < 50) {
      f2 = -0.5;
      f2d = `RSI ${I.rsi.toFixed(1)} below midline`;
    } else if (I.rsi > 65) {
      f2 = 1;
      f2d = `RSI ${I.rsi.toFixed(1)} strong / rising`;
    } else if (I.rsi > 50) {
      f2 = 0.5;
      f2d = `RSI ${I.rsi.toFixed(1)} above midline`;
    } else f2d = `RSI ${I.rsi.toFixed(1)} midline`;
  }
  factors.push({ name: "RSI (14)", vote: f2, detail: f2d });
  dirSum += f2;

  let f3 = 0;
  let f3d = "no data";
  if (I.macd) {
    f3 = I.macd.hist > 0 ? 1 : -1;
    const acc = I.macd.hist > I.macd.histPrev ? "rising" : "falling";
    f3d = `Hist ${I.macd.hist.toFixed(2)} ${acc}`;
  }
  factors.push({ name: "MACD HIST", vote: f3, detail: f3d });
  dirSum += f3;

  let f4 = 0;
  let f4d = "no data";
  if (I.stoch) {
    if (I.stoch.k > 80) {
      f4 = -1;
      f4d = `Stoch ${I.stoch.k.toFixed(0)} overbought`;
    } else if (I.stoch.k < 20) {
      f4 = 1;
      f4d = `Stoch ${I.stoch.k.toFixed(0)} oversold`;
    } else if (I.stoch.k > 55) {
      f4 = 0.5;
      f4d = `Stoch ${I.stoch.k.toFixed(0)} firm`;
    } else {
      f4 = -0.5;
      f4d = `Stoch ${I.stoch.k.toFixed(0)} soft`;
    }
  }
  factors.push({ name: "STOCH", vote: f4, detail: f4d });
  dirSum += f4;

  let f5 = 0;
  let f5d = "no data";
  if (I.vwap != null) {
    const dv = ((p - I.vwap) / I.vwap) * 100;
    f5 = dv > 0 ? 1 : -1;
    f5d = `Price ${dv > 0 ? "above" : "below"} VWAP (${dv.toFixed(2)}%${Math.abs(dv) > 0.5 ? " far" : ""})`;
    if (I.atr && Math.abs(p - I.vwap) < 0.5 * I.atr) {
      f5 = 0;
      f5d += " -> at VWAP";
    }
  }
  factors.push({ name: "VWAP", vote: f5, detail: f5d });
  dirSum += f5;

  let f6 = 0;
  let f6d = "no data";
  if (funding != null) {
    if (funding > 0.0004) {
      f6 = -1;
      f6d = `Funding +${(funding * 100).toFixed(4)}% crowded longs`;
    } else if (funding < -0.0004) {
      f6 = 1;
      f6d = `Funding ${(funding * 100).toFixed(4)}% crowded shorts`;
    } else {
      f6 = 0;
      f6d = `Funding ${(funding * 100).toFixed(4)}% neutral`;
    }
  }
  factors.push({ name: "FUNDING", vote: f6, detail: f6d });
  dirSum += f6;

  let f7 = 0;
  let f7d = "no data";
  if (lsRatio != null) {
    if (lsRatio > 2.0) {
      f7 = -1;
      f7d = `L/S ${lsRatio.toFixed(2)} extreme long crowd`;
    } else if (lsRatio > 1.55) {
      f7 = -0.5;
      f7d = `L/S ${lsRatio.toFixed(2)} long skewed`;
    } else if (lsRatio < 0.55) {
      f7 = 1;
      f7d = `L/S ${lsRatio.toFixed(2)} extreme short crowd`;
    } else if (lsRatio < 0.85) {
      f7 = 0.5;
      f7d = `L/S ${lsRatio.toFixed(2)} short skewed`;
    } else {
      f7 = 0;
      f7d = `L/S ${lsRatio.toFixed(2)} balanced`;
    }
  }
  factors.push({ name: "L/S RATIO", vote: f7, detail: f7d });
  dirSum += f7;

  const dir: -1 | 0 | 1 = dirSum > 0.5 ? 1 : dirSum < -0.5 ? -1 : 0;
  const votes = Math.abs(dirSum);

  const gates: Gate[] = [];
  let passes = 0;
  const now = Date.now();
  const fresh = now - lastWs < 15000 && now - lastApi < 60000;
  gates.push({
    name: "Data Freshness",
    detail: fresh
      ? "All feeds live"
      : `WS ${((now - lastWs) / 1000).toFixed(0)}s / API ${((now - lastApi) / 1000).toFixed(0)}s ago`,
    pass: fresh,
  });
  if (fresh) passes++;

  const atrP = I.atr && p ? (I.atr / p) * 100 : 0;
  const volOk = atrP >= 0.03 && atrP <= 3.0;
  gates.push({
    name: "Volatility Regime",
    detail: atrP ? `ATR% ${atrP.toFixed(3)}% ${volOk ? "normal" : "EXTREME"}` : "no ATR",
    pass: volOk,
  });
  if (volOk) passes++;

  const edge = Math.abs(votes) >= 3 && dir !== 0;
  gates.push({
    name: "Edge Verification",
    detail: `${votes.toFixed(1)}/7 votes${dir ? (dir > 0 ? " LONG" : " SHORT") : " FLAT"}`,
    pass: edge,
  });
  if (edge) passes++;

  let slDist = 0;
  let rr = 0;
  let sl: number | null = null;
  let tp: number | null = null;
  if (I.atr && p) {
    const n5 = bars.slice(-5);
    const hi5 = Math.max(...n5.map((b) => b.h));
    const lo5 = Math.min(...n5.map((b) => b.l));
    if (dir > 0) {
      sl = Math.max(0.01, lo5 - 0.6 * I.atr);
      slDist = p - sl;
      tp = p + 2.2 * slDist;
      rr = slDist > 0 ? 2.2 : 0;
    } else if (dir < 0) {
      sl = hi5 + 0.6 * I.atr;
      slDist = sl - p;
      tp = p - 2.2 * slDist;
      rr = slDist > 0 ? 2.2 : 0;
    }
  }
  const riskOk = slDist > 0 && slDist >= p * 0.0002 && rr >= 1.5;
  gates.push({
    name: "Risk Sanity",
    detail: slDist ? `SL $${fmt(slDist)} RR ${rr ? rr.toFixed(2) : "--"}` : "no SL",
    pass: riskOk,
  });
  if (riskOk) passes++;

  const bv = bids.reduce((a, b) => a + b.q, 0);
  const av = asks.reduce((a, b) => a + b.q, 0);
  const imb = bv + av > 0 ? (bv - av) / (bv + av) : 0;
  const micro = dir === 0 ? true : dir > 0 ? imb >= -0.6 : imb <= 0.6;
  gates.push({
    name: "Microstructure",
    detail: `OB imbalance ${imb >= 0 ? "+" : ""}${(imb * 100).toFixed(1)}%`,
    pass: micro,
  });
  if (micro) passes++;

  let crowd = 0;
  if (funding != null) crowd += funding > 0.0004 ? 1 : funding < -0.0004 ? -1 : 0;
  if (lsRatio != null) crowd += lsRatio > 2 ? 1 : lsRatio < 0.55 ? -1 : 0;
  const macro = dir === 0 ? true : dir > 0 ? crowd <= 1 : crowd >= -1;
  gates.push({
    name: "Macro Compatibility",
    detail: `Crowd score ${crowd > 0 ? "+" : ""}${crowd} vs ${dir > 0 ? "LONG" : dir < 0 ? "SHORT" : "FLAT"}`,
    pass: macro,
  });
  if (macro) passes++;

  const conf = dir === 0 ? 0 : Math.round(clamp(35 + (votes / 7) * 55 + passes * 2, 30, 95));
  let size = 0;
  if (dir !== 0 && sl != null) {
    const riskAmt = equity * (riskPct / 100);
    const dist = Math.abs(sl - p);
    size = dist > 0 ? riskAmt / dist : 0;
    sl = Math.round(sl * 100) / 100;
    if (tp != null) tp = Math.round(tp * 100) / 100;
  }

  return {
    dir,
    conf,
    entry: dir !== 0 ? p : null,
    sl: dir !== 0 ? sl : null,
    tp: dir !== 0 ? tp : null,
    rr: dir !== 0 ? 2.2 : 0,
    size,
    factors,
    gates,
    passes,
    lastAlert: prev.lastAlert,
  };
}

export function voteLabel(vote: number): "LONG" | "SHORT" | "FLAT" {
  if (vote > 0) return "LONG";
  if (vote < 0) return "SHORT";
  return "FLAT";
}
