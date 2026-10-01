export function fmt(n: number | null | undefined, d = 2): string {
  if (n == null || Number.isNaN(n)) return "--";
  return Number(n).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

export function fmtShort(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "--";
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return fmt(n, n % 1 === 0 ? 0 : 2);
}

export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function utcStr(ms?: number) {
  return new Date(ms ?? Date.now()).toISOString().slice(11, 19);
}

export function hhmm(ms: number) {
  const d = new Date(ms);
  const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

export function parseNum(s: unknown): number {
  return parseFloat(String(s).replace(/[,$\s]/g, ""));
}

export function signed(n: number, d = 2) {
  const t = fmt(n, d);
  return n > 0 ? `+${t}` : t;
}

export function ctToOz(contracts: number) {
  return contracts * 0.001;
}
