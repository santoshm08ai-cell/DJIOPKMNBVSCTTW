import { playSound } from "./audio";
import { runEngine } from "./engine";
import { parseNum, utcStr } from "./format";
import { computeIndicators } from "./indicators";
import { patch, pushLog, setPrice, useTerminal } from "./store";
import type { BookLevel, Candle } from "./types";

const INST = "XAU-USDT-SWAP";
const WS_URL = "wss://ws.okx.com:8443/ws/v5/public";
const CT = 0.001;

function okx(path: string, query: Record<string, string>) {
  const qs = new URLSearchParams({ path, ...query });
  return fetch(`/api/okx?${qs.toString()}`, { cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });
}

function goldSpot() {
  return fetch("/api/gold", { cache: "no-store" }).then(async (r) => {
    if (!r.ok) throw new Error("gold");
    return r.json() as Promise<{ price?: number }>;
  });
}

function asCandle(row: string[]): Candle {
  return {
    t: Number(row[0]),
    o: parseNum(row[1]),
    h: parseNum(row[2]),
    l: parseNum(row[3]),
    c: parseNum(row[4]),
    v: parseNum(row[6] ?? row[5]),
  };
}

async function pollTicker() {
  if (useTerminal.getState().paused) return;
  const j = await okx("/api/v5/market/ticker", { instId: INST });
  const d = j?.data?.[0];
  if (!d) return;
  const last = parseNum(d.last);
  const open = parseNum(d.open24h);
  const chgAbs = last - open;
  const chgPct = open ? (chgAbs / open) * 100 : 0;
  setPrice(last);
  patch({
    hi24: parseNum(d.high24h),
    lo24: parseNum(d.low24h),
    vol24: parseNum(d.volCcy24h),
    turnover24: parseNum(d.vol24h) * CT * last,
    chgAbs,
    chgPct,
    bid: parseNum(d.bidPx),
    ask: parseNum(d.askPx),
    lastApi: Date.now(),
    updates: useTerminal.getState().updates + 1,
  });
}

async function pollBooks() {
  if (useTerminal.getState().paused) return;
  const j = await okx("/api/v5/market/books", { instId: INST, sz: "12" });
  const d = j?.data?.[0];
  if (!d) return;
  const map = (rows: string[][]): BookLevel[] =>
    (rows || []).slice(0, 12).map((r) => ({ p: parseNum(r[0]), q: parseNum(r[1]) * CT }));
  patch({
    bids: map(d.bids),
    asks: map(d.asks),
    lastApi: Date.now(),
  });
}

async function pollKlines() {
  if (useTerminal.getState().paused) return;
  const j = await okx("/api/v5/market/candles", { instId: INST, bar: "15m", limit: "200" });
  const rows: string[][] = j?.data ?? [];
  const klines = rows.map(asCandle).reverse();
  const inds = computeIndicators(klines);
  patch({ klines, inds, lastApi: Date.now() });
}

async function pollPremium() {
  if (useTerminal.getState().paused) return;
  const [fr, mk, idx, oi] = await Promise.all([
    okx("/api/v5/public/funding-rate", { instId: INST }),
    okx("/api/v5/public/mark-price", { instId: INST }),
    okx("/api/v5/market/index-tickers", { instId: "XAU-USDT" }),
    okx("/api/v5/public/open-interest", { instId: INST }),
  ]);
  const funding = parseNum(fr?.data?.[0]?.fundingRate);
  const nextFunding = Number(fr?.data?.[0]?.fundingTime || 0) || null;
  const mark = parseNum(mk?.data?.[0]?.markPx);
  const index = parseNum(idx?.data?.[0]?.idxPx);
  const oiCcy = parseNum(oi?.data?.[0]?.oiCcy);
  const prev = useTerminal.getState().oi;
  patch({
    funding,
    nextFunding,
    mark,
    index,
    oiPrev: prev,
    oi: oiCcy,
    lastApi: Date.now(),
  });
}

async function pollLs() {
  if (useTerminal.getState().paused) return;
  const j = await okx("/api/v5/rubik/stat/contracts/long-short-account-ratio", {
    ccy: "XAU",
    period: "5m",
  });
  const rows: [string, string][] = j?.data ?? [];
  if (!rows.length) return;
  const hist = rows.map((r) => parseNum(r[1])).reverse();
  const ratio = hist[hist.length - 1]!;
  const lsLong = (ratio / (1 + ratio)) * 100;
  patch({
    lsRatio: ratio,
    lsLong,
    lsShort: 100 - lsLong,
    lsHist: hist.slice(-30),
    lastApi: Date.now(),
  });
}

async function pollTaker() {
  if (useTerminal.getState().paused) return;
  const j = await okx("/api/v5/rubik/stat/taker-volume", {
    ccy: "XAU",
    instType: "CONTRACTS",
    period: "5m",
  });
  const rows: string[][] = j?.data ?? [];
  if (!rows.length) return;
  const last = rows[0]!;
  const sell = parseNum(last[1]);
  const buy = parseNum(last[2]);
  patch({
    takerSell: sell,
    takerBuy: buy,
    takerRatio: sell === 0 ? null : buy / sell,
    lastApi: Date.now(),
  });
}

async function pollSpot() {
  if (useTerminal.getState().paused) return;
  try {
    const j = await goldSpot();
    if (j?.price) patch({ spot: j.price, lastApi: Date.now() });
  } catch {
    /* optional */
  }
}

export async function runAllPolls() {
  const s = useTerminal.getState();
  if (s.paused) return;
  await Promise.allSettled([
    pollTicker(),
    pollBooks(),
    pollKlines(),
    pollPremium(),
    pollLs(),
    pollTaker(),
    pollSpot(),
  ]);
}

function tickEngine() {
  const s = useTerminal.getState();
  if (s.paused) return;
  const engine = runEngine({
    inds: s.inds,
    klines: s.klines,
    price: s.price,
    funding: s.funding,
    lsRatio: s.lsRatio,
    bids: s.bids,
    asks: s.asks,
    lastWs: s.lastWs,
    lastApi: s.lastApi,
    equity: s.equity,
    riskPct: s.riskPct,
    prev: s.engine,
  });
  patch({ engine, engineStamp: `updated ${utcStr()}` });
  maybeEngineAlert(engine);
  monitorPasted();
}

function maybeEngineAlert(engine: ReturnType<typeof runEngine>) {
  const s = useTerminal.getState();
  if (engine.dir === 0 || engine.passes < 6) return;
  const now = Date.now();
  if (now - engine.lastAlert < 90000) return;
  const p = s.price;
  if (p == null || engine.entry == null || engine.sl == null) return;
  const zone = 0.3 * Math.abs(engine.sl - engine.entry);
  const inZone =
    engine.dir > 0 ? p >= engine.entry - zone && p <= engine.entry + zone : p <= engine.entry + zone && p >= engine.entry - zone;
  if (!inZone) return;
  engine.lastAlert = now;
  patch({
    engine: { ...engine, lastAlert: now },
    alert: {
      kind: "entry",
      title: `${engine.dir > 0 ? "LONG" : "SHORT"} ENTRY ALERT`,
      lines: [
        ["Direction", engine.dir > 0 ? "LONG" : "SHORT", engine.dir > 0 ? "var(--color-up)" : "var(--color-down)"],
        ["Confidence", `${engine.conf}%`, "var(--color-gold)"],
        ["Entry", `$${p.toFixed(2)}`],
        ["Stop Loss", `$${engine.sl.toFixed(2)}`, "var(--color-down)"],
        ["Take Profit", `$${engine.tp?.toFixed(2)}`, "var(--color-up)"],
        ["R:R Ratio", `${engine.rr.toFixed(2)} : 1`],
        ["Position Size", `${engine.size.toFixed(2)} oz`],
        ["Gates Passed", `${engine.passes}/6 ALL CLEAR`, "var(--color-up)"],
      ],
      note: "All 6 gates passed · price inside entry zone · 15m engine",
      sound: "entry",
      until: now + 600000,
    },
  });
  if (s.sound) playSound("entry");
}

function monitorPasted() {
  const s = useTerminal.getState();
  const sig = s.signal;
  if (!sig) return;
  const p = s.price;
  if (p == null) return;
  const now = Date.now();
  const left = sig.expiry - now;
  if (left <= 0) {
    if (sig.state !== "expired") {
      pushLog("SIGNAL EXPIRED after validity window", "warn");
      patch({
        signal: { ...sig, state: "expired" },
        alert: {
          kind: "expire",
          title: "SIGNAL EXPIRED",
          lines: [
            ["Status", "Entry window closed", "var(--color-gold)"],
            ["Last Price", `$${p.toFixed(2)}`],
          ],
          note: "Signal no longer valid",
          sound: "gate",
          until: now + 20000,
        },
      });
      if (s.sound) playSound("gate");
    }
    return;
  }
  if (sig.state === "waiting") {
    let triggered = false;
    let mode = "";
    if (sig.dir === "short") {
      if (p <= sig.zone[1]) {
        triggered = true;
        mode = p >= sig.zone[0] ? "retrace into zone" : "breakdown (chase)";
      }
    } else if (p >= sig.zone[0]) {
      triggered = true;
      mode = p <= sig.zone[1] ? "retrace into zone" : "breakout (chase)";
    }
    if (triggered) {
      if (sig.rsiCond && s.inds?.rsi != null) {
        const ok = sig.rsiCond.op === "<" ? s.inds.rsi < sig.rsiCond.val : s.inds.rsi > sig.rsiCond.val;
        if (!ok) {
          pushLog(
            `Awaiting trigger: RSI ${sig.rsiCond.op} ${sig.rsiCond.val} (now ${s.inds.rsi.toFixed(1)})`,
            "warn",
          );
          return;
        }
      }
      pushLog(`TAKE ENTRY: ${sig.dir.toUpperCase()} @ $${p.toFixed(2)} (${mode})`, "ent");
      patch({
        signal: { ...sig, state: "active", fired: true, entryAt: p },
        alert: {
          kind: "entry",
          title: `TAKE ENTRY NOW — ${sig.dir.toUpperCase()}`,
          lines: [
            ["Trigger", `$${p.toFixed(2)} (${mode})`, "var(--color-gold)"],
            ["Entry Zone", `$${sig.zone[0].toFixed(2)} – $${sig.zone[1].toFixed(2)}`],
            ["Stop Loss", `$${sig.sl.toFixed(2)}`, "var(--color-down)"],
            ["Take Profit", `$${sig.tp.toFixed(2)}`, "var(--color-up)"],
            ["R:R Ratio", `${sig.rr.toFixed(2)} : 1`],
          ],
          note: "Live price entered the entry zone · monitor SL / TP",
          sound: "entry",
          until: now + 600000,
        },
      });
      if (s.sound) playSound("entry");
    }
  } else if (sig.state === "active") {
    const slHit = sig.dir === "short" ? p >= sig.sl : p <= sig.sl;
    const tpHit = sig.dir === "short" ? p <= sig.tp : p >= sig.tp;
    if (slHit) {
      pushLog(`STOP LOSS HIT @ $${p.toFixed(2)}`, "sl");
      patch({
        signal: { ...sig, state: "closed" },
        alert: {
          kind: "stop",
          title: "STOP LOSS HIT",
          lines: [
            ["Side", sig.dir.toUpperCase(), "var(--color-down)"],
            ["SL", `$${sig.sl.toFixed(2)}`],
            ["Exit Price", `$${p.toFixed(2)}`],
          ],
          note: "Honor the stop. No averaging down.",
          sound: "stop",
          until: now + 120000,
        },
      });
      if (s.sound) playSound("stop");
    } else if (tpHit) {
      pushLog(`TAKE PROFIT HIT @ $${p.toFixed(2)}`, "tp");
      patch({
        signal: { ...sig, state: "closed" },
        alert: {
          kind: "tp",
          title: "TAKE PROFIT HIT",
          lines: [
            ["Side", sig.dir.toUpperCase(), "var(--color-up)"],
            ["TP", `$${sig.tp.toFixed(2)}`],
            ["Exit Price", `$${p.toFixed(2)}`],
          ],
          note: "Target reached. Trail remaining position.",
          sound: "tp",
          until: now + 120000,
        },
      });
      if (s.sound) playSound("tp");
    }
  }
}

type WsMsg = {
  event?: string;
  arg?: { channel: string };
  data?: unknown[];
};

function handleWs(msg: WsMsg) {
  if (!msg || msg.event) return;
  const ch = msg.arg?.channel;
  const row = msg.data?.[0] as Record<string, string> | string[] | undefined;
  if (!ch || !row) return;
  const now = Date.now();
  patch({ lastWs: now, wsStatus: "live" });

  if (ch === "tickers") {
    const d = row as Record<string, string>;
    const last = parseNum(d.last);
    setPrice(last);
    if (d.bidPx) patch({ bid: parseNum(d.bidPx), ask: parseNum(d.askPx) });
  } else if (ch === "trades") {
    const d = row as Record<string, string>;
    setPrice(parseNum(d.px));
    const ts = Number(d.ts);
    if (ts) patch({ latency: Math.max(0, now - ts) });
  } else if (ch === "bbo-tbt") {
    const d = row as Record<string, string>;
    const bid = parseNum(d.bidPx);
    const ask = parseNum(d.askPx);
    patch({ bid, ask });
    if (bid && ask) setPrice((bid + ask) / 2);
  } else if (ch === "candle15m") {
    const c = asCandle(row as string[]);
    const bars = [...useTerminal.getState().klines];
    if (!bars.length) return;
    const last = bars[bars.length - 1]!;
    if (c.t === last.t) bars[bars.length - 1] = c;
    else if (c.t > last.t) bars.push(c);
    if (bars.length > 200) bars.shift();
    patch({ klines: bars, inds: computeIndicators(bars) });
  } else if (ch === "funding-rate") {
    const d = row as Record<string, string>;
    patch({
      funding: parseNum(d.fundingRate),
      nextFunding: Number(d.fundingTime) || useTerminal.getState().nextFunding,
    });
  } else if (ch === "mark-price") {
    const d = row as Record<string, string>;
    patch({ mark: parseNum(d.markPx) });
  } else if (ch === "open-interest") {
    const d = row as Record<string, string>;
    const oi = parseNum(d.oiCcy);
    const prev = useTerminal.getState().oi;
    patch({ oiPrev: prev, oi });
  }
}

export function startFeed() {
  let closed = false;
  let ws: WebSocket | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;
  let fail = 0;
  const timers: ReturnType<typeof setInterval>[] = [];

  const connect = () => {
    if (closed) return;
    patch({ wsStatus: fail ? "reconnecting" : "connecting" });
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }
    ws.onopen = () => {
      fail = 0;
      patch({ wsStatus: "live", lastWs: Date.now() });
      ws?.send(
        JSON.stringify({
          op: "subscribe",
          args: [
            { channel: "tickers", instId: INST },
            { channel: "trades", instId: INST },
            { channel: "bbo-tbt", instId: INST },
            { channel: "candle15m", instId: INST },
            { channel: "funding-rate", instId: INST },
            { channel: "mark-price", instId: INST },
            { channel: "open-interest", instId: INST },
          ],
        }),
      );
      if (ping) clearInterval(ping);
      ping = setInterval(() => {
        try {
          ws?.send("ping");
        } catch {
          /* ignore */
        }
      }, 15000);
    };
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string" && ev.data === "pong") return;
      let msg: WsMsg;
      try {
        msg = JSON.parse(ev.data as string) as WsMsg;
      } catch {
        return;
      }
      handleWs(msg);
    };
    ws.onclose = () => {
      patch({ wsStatus: "reconnecting" });
      scheduleReconnect();
    };
    ws.onerror = () => {
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  };

  const scheduleReconnect = () => {
    if (closed) return;
    fail += 1;
    const wait = Math.min(30000, 1000 * 2 ** Math.min(fail, 5));
    setTimeout(connect, wait);
  };

  connect();
  void runAllPolls();
  timers.push(setInterval(() => void pollTicker(), 2500));
  timers.push(setInterval(() => void pollBooks(), 1500));
  timers.push(setInterval(() => void pollKlines(), 12000));
  timers.push(setInterval(() => void pollPremium(), 5000));
  timers.push(setInterval(() => void pollLs(), 30000));
  timers.push(setInterval(() => void pollTaker(), 30000));
  timers.push(setInterval(() => void pollSpot(), 30000));
  timers.push(setInterval(tickEngine, 4000));
  timers.push(
    setInterval(() => {
      const s = useTerminal.getState();
      patch({ clock: `${new Date().toISOString().slice(11, 19)} UTC` });
      if (!s.paused) {
        if (Date.now() - s.lastWs > 15000 && s.wsStatus === "live") patch({ wsStatus: "stale" });
      }
    }, 1000),
  );
  setTimeout(tickEngine, 2200);

  return () => {
    closed = true;
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
    if (ping) clearInterval(ping);
    timers.forEach(clearInterval);
  };
}
