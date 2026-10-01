import type { PastedSignal } from "./types";

function getN(t: string, re: RegExp): number | null {
  const m = t.match(re);
  return m ? parseFloat(m[1]!) : null;
}

export function parseSignalText(txt: string): PastedSignal | null {
  const t = txt.replace(/,/g, "");
  let dir: "long" | "short" | null = null;
  if (/LONG\s+SIGNAL|DIRECTION[:：]?\s*[^\n]{0,25}LONG/i.test(t)) dir = "long";
  if (/SHORT\s+SIGNAL|DIRECTION[:：]?\s*[^\n]{0,25}SHORT/i.test(t)) dir = "short";
  if (!dir) return null;

  let zone: [number, number] | null = null;
  const zm = t.match(/ENTRY\s+ZONE[:：]?\s*\$?([\d.]+)\s*[^\d]{1,12}\s*\$?([\d.]+)/i);
  if (zm) {
    const a = +zm[1]!;
    const b = +zm[2]!;
    zone = [Math.min(a, b), Math.max(a, b)];
  }
  const ideal = getN(t, /IDEAL\s+ENTRY[:：]?\s*\$?([\d.]+)/i);
  const single = getN(t, /ENTRY[:：]?\s*\$?([\d.]+)/i);
  const sl = getN(t, /STOP\s+LOSS[:：]?\s*\$?([\d.]+)/i);
  const tps: number[] = [];
  for (const m of t.matchAll(/TP\s*\d[^\n]*?\$\s*([\d.]+)/gi)) tps.push(+m[1]!);
  const tp = getN(t, /TAKE\s+PROFIT[:：]?\s*\$?([\d.]+)/i) || (tps.length ? tps[0]! : null);
  const rrRaw = getN(t, /R\s*:\s*R\s*RATIO[:：]?\s*([\d.]+)/i);
  const conf = getN(t, /CONFIDENCE[:：]?\s*([\d.]+)\s*%/i);
  const validity = getN(t, /TIME\s+VALIDITY[:：]?\s*(\d+)/i) || 12;
  const entry = ideal || single || (zone ? (dir === "short" ? zone[1] : zone[0]) : null);
  if (entry == null || sl == null || tp == null) return null;
  if (!zone) {
    const bw = entry * 0.001;
    zone = [entry - bw, entry + bw];
  }
  const rr =
    rrRaw ||
    (dir === "short" ? (entry - tp) / Math.max(0.0001, sl - entry) : (tp - entry) / Math.max(0.0001, entry - sl));
  let rsiCond: PastedSignal["rsiCond"] = null;
  const rm = t.match(/RSI\s+(?:rejects\s+)?(above|below)\s*(\d+)/i);
  if (rm) rsiCond = { op: rm[1]!.toLowerCase() === "below" ? "<" : ">", val: +rm[2]! };

  return {
    dir,
    entry,
    ideal,
    zone,
    sl,
    tp,
    tps,
    rr,
    conf,
    validity,
    rsiCond,
    state: "waiting",
    expiry: Date.now() + validity * 60000,
    fired: false,
    entryAt: null,
  };
}
