export type Side = "LONG" | "SHORT" | "FLAT";

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BookLevel {
  p: number;
  q: number;
}

export interface Indicators {
  rsi: number | null;
  macd: { line: number; signal: number; hist: number; histPrev: number } | null;
  stoch: { k: number; d: number } | null;
  bb: { mid: number; upper: number; lower: number; pb: number; width: number } | null;
  atr: number | null;
  vwap: number | null;
  ema8: number | null;
  ema21: number | null;
  ema50: number | null;
}

export interface Factor {
  name: string;
  vote: number;
  detail: string;
}

export interface Gate {
  name: string;
  detail: string;
  pass: boolean;
}

export interface EngineResult {
  dir: -1 | 0 | 1;
  conf: number;
  entry: number | null;
  sl: number | null;
  tp: number | null;
  rr: number;
  size: number;
  factors: Factor[];
  gates: Gate[];
  passes: number;
  lastAlert: number;
}

export interface PastedSignal {
  dir: "long" | "short";
  entry: number;
  ideal: number | null;
  zone: [number, number];
  sl: number;
  tp: number;
  tps: number[];
  rr: number;
  conf: number | null;
  validity: number;
  rsiCond: { op: "<" | ">"; val: number } | null;
  state: "waiting" | "active" | "closed" | "expired";
  expiry: number;
  fired: boolean;
  entryAt: number | null;
}

export interface LogLine {
  id: number;
  t: number;
  msg: string;
  kind: "dim" | "ent" | "sl" | "tp" | "warn";
}

export interface AlertState {
  kind: "entry" | "stop" | "tp" | "expire" | "gate";
  title: string;
  lines: [string, string, string?][];
  note: string;
  sound: "entry" | "stop" | "tp" | "gate";
  until: number;
}

export const EMPTY_ENGINE: EngineResult = {
  dir: 0,
  conf: 0,
  entry: null,
  sl: null,
  tp: null,
  rr: 0,
  size: 0,
  factors: [],
  gates: [],
  passes: 0,
  lastAlert: 0,
};
