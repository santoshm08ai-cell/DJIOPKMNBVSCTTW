import { create } from "zustand";
import { EMPTY_ENGINE, type AlertState, type BookLevel, type Candle, type EngineResult, type Indicators, type LogLine, type PastedSignal } from "./types";

export type WsStatus = "connecting" | "live" | "reconnecting" | "stale";

export interface TerminalState {
  price: number | null;
  prevPrice: number | null;
  priceDir: -1 | 0 | 1;
  bid: number | null;
  ask: number | null;
  mark: number | null;
  index: number | null;
  funding: number | null;
  nextFunding: number | null;
  hi24: number | null;
  lo24: number | null;
  vol24: number | null;
  turnover24: number | null;
  chgAbs: number | null;
  chgPct: number | null;
  oi: number | null;
  oiPrev: number | null;
  spot: number | null;
  lsRatio: number | null;
  lsLong: number | null;
  lsShort: number | null;
  lsHist: number[];
  takerRatio: number | null;
  takerBuy: number | null;
  takerSell: number | null;
  bids: BookLevel[];
  asks: BookLevel[];
  klines: Candle[];
  lastWs: number;
  lastApi: number;
  updates: number;
  paused: boolean;
  sound: boolean;
  venue: string;
  wsStatus: WsStatus;
  latency: number | null;
  engine: EngineResult;
  signal: PastedSignal | null;
  inds: Indicators | null;
  logs: LogLine[];
  alert: AlertState | null;
  equity: number;
  riskPct: number;
  ohlcTip: string;
  clock: string;
  hoverIdx: number;
  engineStamp: string;
}

let logSeq = 1;

export const useTerminal = create<TerminalState>(() => ({
  price: null,
  prevPrice: null,
  priceDir: 0,
  bid: null,
  ask: null,
  mark: null,
  index: null,
  funding: null,
  nextFunding: null,
  hi24: null,
  lo24: null,
  vol24: null,
  turnover24: null,
  chgAbs: null,
  chgPct: null,
  oi: null,
  oiPrev: null,
  spot: null,
  lsRatio: null,
  lsLong: null,
  lsShort: null,
  lsHist: [],
  takerRatio: null,
  takerBuy: null,
  takerSell: null,
  bids: [],
  asks: [],
  klines: [],
  lastWs: 0,
  lastApi: 0,
  updates: 0,
  paused: false,
  sound: true,
  venue: "OKX SWAP",
  wsStatus: "connecting",
  latency: null,
  engine: EMPTY_ENGINE,
  signal: null,
  inds: null,
  logs: [],
  alert: null,
  equity: 10000,
  riskPct: 1,
  ohlcTip: "O --  H --  L --  C --  V --",
  clock: "--:--:--",
  hoverIdx: -1,
  engineStamp: "idle",
}));

export function patch(partial: Partial<TerminalState>) {
  useTerminal.setState(partial);
}

export function setPrice(p: number) {
  const s = useTerminal.getState();
  if (s.paused) return;
  const prev = s.price;
  const dir: -1 | 0 | 1 = prev == null ? 0 : p > prev ? 1 : p < prev ? -1 : 0;
  const klines = s.klines.length
    ? s.klines.map((k, i) => {
        if (i !== s.klines.length - 1) return k;
        return { ...k, c: p, h: Math.max(k.h, p), l: Math.min(k.l, p) };
      })
    : s.klines;
  useTerminal.setState({
    prevPrice: prev,
    price: p,
    priceDir: dir,
    klines,
  });
}

export function pushLog(msg: string, kind: LogLine["kind"] = "dim") {
  const line: LogLine = { id: logSeq++, t: Date.now(), msg, kind };
  const logs = [line, ...useTerminal.getState().logs].slice(0, 40);
  useTerminal.setState({ logs });
}
