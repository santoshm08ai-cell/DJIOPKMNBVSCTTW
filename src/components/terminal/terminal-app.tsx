import { useEffect, type ReactNode } from "react";
import { Maximize, Pause, Play, RefreshCw, Volume2, VolumeX } from "lucide-react";
import { voteLabel } from "@/lib/terminal/engine";
import { runAllPolls, startFeed } from "@/lib/terminal/feed";
import { clamp, fmt, fmtShort, signed, utcStr } from "@/lib/terminal/format";
import { parseSignalText } from "@/lib/terminal/parse-signal";
import { patch, pushLog, useTerminal } from "@/lib/terminal/store";
import { CandleChart } from "./candle-chart";

function MiniFill({
  left,
  width,
  color,
}: {
  left: string;
  width: string;
  color: string;
}) {
  return <div className="f" style={{ left, width, background: color }} />;
}

export function TerminalApp() {
  const s = useTerminal();

  useEffect(() => startFeed(), []);

  useEffect(() => {
    const equity = Number(localStorage.getItem("aurum-equity"));
    const risk = Number(localStorage.getItem("aurum-risk"));
    patch({
      sound: localStorage.getItem("aurum-sound") !== "off",
      equity: Number.isFinite(equity) && equity > 0 ? equity : 10000,
      riskPct: Number.isFinite(risk) && risk > 0 ? risk : 1,
    });
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (ev.code === "KeyR") void runAllPolls();
      else if (ev.code === "Space") {
        ev.preventDefault();
        togglePause();
      } else if (ev.code === "KeyF") toggleFs();
      else if (ev.code === "KeyS") toggleSound();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const up = (s.chgPct ?? 0) >= 0;
  const pxClass = s.priceDir === 1 ? "flash-up" : s.priceDir === -1 ? "flash-dn" : "";
  const wsOk = s.wsStatus === "live";
  const frUp = (s.funding ?? 0) >= 0;
  const nextFund = formatNext(s.nextFunding);
  const I = s.inds;
  const last = s.price ?? (s.klines.length ? s.klines[s.klines.length - 1]!.c : null);
  const bv = s.bids.reduce((a, b) => a + b.q, 0);
  const av = s.asks.reduce((a, b) => a + b.q, 0);
  const imb = bv + av > 0 ? ((bv - av) / (bv + av)) * 100 : 0;
  const maxQ = Math.max(0.0001, ...s.bids.map((b) => b.q), ...s.asks.map((a) => a.q));
  const spread = s.ask != null && s.bid != null ? s.ask - s.bid : null;
  const e = s.engine;
  const confLeft = e.dir > 0 ? "50%" : e.dir < 0 ? `${50 - Math.abs(e.conf)}%` : "50%";
  const lsPos = s.lsRatio != null ? clamp(((s.lsRatio - 0.5) / 1.5) * 100, 0, 100) : 50;
  const takerTot = (s.takerBuy ?? 0) + (s.takerSell ?? 0);
  const buyP = takerTot > 0 ? ((s.takerBuy ?? 0) / takerTot) * 100 : 50;
  const oiDelta = s.oi != null && s.oiPrev != null ? s.oi - s.oiPrev : null;
  const premium =
    s.price != null && s.spot != null ? ((s.price - s.spot) / s.spot) * 100 : null;
  const alertLeft = s.alert ? Math.max(0, Math.ceil((s.alert.until - Date.now()) / 1000)) : 0;

  return (
    <div className="desk">
      {s.paused ? <div className="pause-badge">PAUSED</div> : null}

      <header className="desk-top">
        <div className="desk-logo">
          <span className="dot" />
          XAU/USDT
          <span className="sub">LIVE 15m TERMINAL</span>
        </div>
        <div className="sym-tag">XAUUSDT · PERP</div>
        <div className="tb-item hide-sm">
          <span className="k">Mark</span>
          <span className="v">{fmt(s.mark)}</span>
        </div>
        <div className="tb-item hide-sm">
          <span className="k">Index</span>
          <span className="v">{fmt(s.index)}</span>
        </div>
        <div className="tb-item">
          <span className="k">Funding</span>
          <span className={`v ${frUp ? "up" : "down"}`}>
            {s.funding == null ? "--" : `${(s.funding * 100).toFixed(4)}%`}
          </span>
        </div>
        <div className="flex-1" />
        <span className="font-mono text-[10.5px] text-mute">
          lat {s.latency == null || s.latency > 5000 ? "--" : `${s.latency}ms`}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={`ws-dot ${wsOk ? "ok" : "bad"}`} />
          <span className="font-mono text-[10.5px] text-mute">
            {s.wsStatus === "live" ? "LIVE WS" : s.wsStatus.toUpperCase()}
          </span>
        </span>
        <button className={`tb-btn ${s.paused ? "on" : ""}`} onClick={togglePause} title="Space">
          {s.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
          {s.paused ? "Resume" : "Pause"}
        </button>
        <button className={`tb-btn ${s.sound ? "on" : ""}`} onClick={toggleSound} title="S">
          {s.sound ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}
          {s.sound ? "Sound ON" : "Sound OFF"}
        </button>
        <button className="tb-btn hide-sm" onClick={toggleFs} title="F">
          <Maximize className="size-3.5" />
          Fullscreen
        </button>
        <button className="tb-btn" onClick={() => void runAllPolls()} title="R">
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
        <span className="font-mono text-[13px] font-semibold text-cyan">{s.clock}</span>
      </header>

      <main className="desk-main">
        <div className="col">
          <section className="panel">
            <div className="hd">
              <span>XAU/USDT · 15m</span>
              <span className="hdr">{s.lastWs ? utcStr(s.lastWs) : "--"}</span>
            </div>
            <div className="bd">
              <div className={`big-px ${pxClass}`}>{fmt(s.price)}</div>
              <div className="chg-row">
                <span className={up ? "up" : "down"}>{signed(s.chgAbs ?? 0)}</span>{" "}
                <span className={up ? "up" : "down"}>({signed(s.chgPct ?? 0)}%)</span>
              </div>
              <Kv k="24h HIGH" v={fmt(s.hi24)} cls="up" />
              <Kv k="24h LOW" v={fmt(s.lo24)} cls="down" />
              <Kv k="24h VOLUME" v={`${fmtShort(s.vol24)} oz`} />
              <Kv k="24h TURNOVER" v={fmtShort(s.turnover24)} />
              <Kv k="MARK PRICE" v={fmt(s.mark)} />
              <Kv k="INDEX PRICE" v={fmt(s.index)} />
              <Kv k="SPOT GOLD" v={fmt(s.spot)} />
              <Kv
                k="FUT PREMIUM"
                v={premium == null ? "--" : `${signed(premium, 3)}%`}
                cls={premium != null && premium >= 0 ? "up" : "down"}
              />
              <Kv
                k="FUNDING RATE"
                v={s.funding == null ? "--" : `${(s.funding * 100).toFixed(4)}%`}
                cls={frUp ? "up" : "down"}
              />
              <Kv k="NEXT FUNDING" v={nextFund} />
              <Kv k="OPEN INTEREST" v={s.oi == null ? "--" : `${fmt(s.oi, 0)} oz`} />
            </div>
          </section>

          <section className="panel" style={{ flex: 1 }}>
            <div className="hd">
              <span>ORDER BOOK · TOP 12</span>
              <span className="hdr">{s.lastWs ? utcStr(s.lastWs) : "--"}</span>
            </div>
            <div className="bd" style={{ padding: "4px 8px 8px" }}>
              <div className="meter gauge" style={{ marginBottom: 2 }}>
                <span className="lab down">ASK</span>
                <div className="bar">
                  <div
                    className="fill"
                    style={{
                      width: `${Math.abs(imb)}%`,
                      left: imb >= 0 ? "50%" : `${50 - Math.abs(imb)}%`,
                      background: "linear-gradient(90deg, var(--color-down), var(--color-gold), var(--color-up))",
                    }}
                  />
                  <div className="mid" />
                </div>
                <span className="lab up">BID</span>
              </div>
              <div className="flex justify-between px-1 font-mono text-[10px] text-mute">
                <span>
                  IMBALANCE{" "}
                  <b className="text-gold">
                    {imb >= 0 ? "+" : ""}
                    {imb.toFixed(1)}%
                  </b>
                </span>
                <span>
                  SPREAD{" "}
                  <b className="text-gold">
                    {spread == null
                      ? "--"
                      : `$${spread.toFixed(2)} (${s.price ? ((spread / s.price) * 100).toFixed(3) : "--"}%)`}
                  </b>
                </span>
              </div>
              <div className="mt-1.5 grid grid-cols-[1fr_1.2fr_1fr] gap-1.5 px-1 text-[8.5px] tracking-widest text-mute">
                <span>PRICE</span>
                <span className="text-right">QTY oz</span>
                <span className="text-right">TOTAL</span>
              </div>
              <div>
                {[...s.asks].reverse().map((a, i) => {
                  const tot = s.asks.slice(0, s.asks.length - i).reduce((x, y) => x + y.q, 0);
                  return (
                    <div className="book-row ask-row" key={`a-${a.p}`}>
                      <div className="bar" style={{ width: `${(a.q / maxQ) * 100}%` }} />
                      <span className="p ask">{fmt(a.p)}</span>
                      <span className="q">{fmt(a.q, 3)}</span>
                      <span className="tot">{fmt(tot, 3)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="py-1 text-center font-mono text-[13px] font-bold">
                {s.bid != null && s.ask != null ? fmt((s.bid + s.ask) / 2) : "--"}
              </div>
              <div>
                {s.bids.map((b, i) => {
                  const tot = s.bids.slice(0, i + 1).reduce((x, y) => x + y.q, 0);
                  return (
                    <div className="book-row bid-row" key={`b-${b.p}`}>
                      <div className="bar" style={{ width: `${(b.q / maxQ) * 100}%` }} />
                      <span className="p bid">{fmt(b.p)}</span>
                      <span className="q">{fmt(b.q, 3)}</span>
                      <span className="tot">{fmt(tot, 3)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <div className="col">
          <CandleChart />

          <section className="panel" style={{ flex: "0 0 auto", maxHeight: "46%" }}>
            <div className="hd">
              <span>7-FACTOR SIGNAL ENGINE</span>
              <span className="hdr">{s.engineStamp}</span>
            </div>
            <div className="bd" style={{ padding: "6px 8px" }}>
              {e.factors.map((f) => (
                <div className="factor-row" key={f.name}>
                  <span className="fn">{f.name}</span>
                  <span className="text-[9.5px] text-mute-2">{f.detail}</span>
                  <span className={`chip ${voteLabel(f.vote)}`}>{voteLabel(f.vote)}</span>
                </div>
              ))}
              <div className="mt-2 mb-1 flex justify-between text-[9.5px] font-bold tracking-widest text-mute uppercase">
                <span>6-Gate Validation</span>
                <span className="text-gold">{e.passes}/6</span>
              </div>
              {e.gates.map((g) => (
                <div className="gate-row" key={g.name}>
                  <span className="gn">{g.name}</span>
                  <span className="text-[9px] text-mute">{g.detail}</span>
                  <span className={`chip ${g.pass ? "PASS" : "FAIL"}`}>{g.pass ? "PASS" : "FAIL"}</span>
                </div>
              ))}
              <div className="eng-grid">
                <div className="eng-box">
                  <div className="l">Direction</div>
                  <div
                    className="b"
                    style={{
                      color: e.dir > 0 ? "var(--color-up)" : e.dir < 0 ? "var(--color-down)" : "var(--color-mute)",
                    }}
                  >
                    {e.dir > 0 ? "LONG" : e.dir < 0 ? "SHORT" : "FLAT"}
                  </div>
                </div>
                <div className="eng-box">
                  <div className="l">Confidence</div>
                  <div className="b" style={{ color: e.conf >= 70 ? "var(--color-gold)" : "var(--color-ink)" }}>
                    {e.dir ? `${e.conf}%` : "--"}
                  </div>
                </div>
                <div className="eng-box">
                  <div className="l">Entry</div>
                  <div className="b sm">{e.entry ? fmt(e.entry) : "--"}</div>
                </div>
                <div className="eng-box">
                  <div className="l">SL / TP</div>
                  <div className="b sm">{e.sl ? `${fmt(e.sl)} / ${fmt(e.tp)}` : "--"}</div>
                </div>
                <div className="eng-box">
                  <div className="l">R:R</div>
                  <div className="b sm">{e.rr ? `${e.rr.toFixed(2)} : 1` : "--"}</div>
                </div>
                <div className="eng-box">
                  <div className="l">Size (1% risk)</div>
                  <div className="b sm">{e.size ? `${e.size.toFixed(2)} oz` : "--"}</div>
                </div>
              </div>
              <div className="conf-bar">
                <div
                  className="fill"
                  style={{
                    width: `${Math.abs(e.conf)}%`,
                    left: confLeft,
                    background: e.dir > 0 ? "var(--color-up)" : e.dir < 0 ? "var(--color-down)" : "var(--color-mute)",
                  }}
                />
                <div className="mk" />
              </div>
              <div className="text-center font-mono text-[10px] text-mute">
                {e.dir
                  ? `DIRECTION ${e.dir > 0 ? "LONG" : "SHORT"} · ${e.conf}% confidence`
                  : "waiting for confluence"}
              </div>
            </div>
          </section>

          <section className="panel" style={{ flex: "0 0 auto" }}>
            <div className="hd">
              <span>PASTE SIGNAL → LIVE MONITOR</span>
              <span
                className="hdr"
                style={{
                  color:
                    s.signal?.state === "active"
                      ? "var(--color-gold)"
                      : s.signal?.dir === "short"
                        ? "var(--color-down)"
                        : s.signal?.dir === "long"
                          ? "var(--color-up)"
                          : undefined,
                }}
              >
                {signalStateLabel(s)}
              </span>
            </div>
            <div className="bd">
              <textarea
                id="sigText"
                className="sig-area"
                placeholder="Paste a signal block (Direction, Entry Zone, Stop Loss, Take Profit, R:R, Time Validity)…"
              />
              <div className="mt-1.5 mb-1 flex flex-wrap items-center gap-1.5">
                <button className="btn gold" onClick={activateSignal}>
                  Parse & Monitor
                </button>
                {s.signal ? (
                  <button
                    className="btn red"
                    onClick={() => {
                      patch({ signal: null });
                      pushLog("Signal cancelled", "dim");
                    }}
                  >
                    Cancel Signal
                  </button>
                ) : null}
                <button
                  className="btn"
                  onClick={() => {
                    const el = document.getElementById("sigText") as HTMLTextAreaElement | null;
                    if (el) el.value = "";
                  }}
                >
                  Clear
                </button>
                <span className="flex-1" />
                <span className="flex items-center gap-1 text-[10px] text-mute">
                  Equity $
                  <input
                    className="num-in"
                    type="number"
                    value={s.equity}
                    onChange={(ev) => {
                      const v = Number(ev.target.value) || 10000;
                      patch({ equity: v });
                      localStorage.setItem("aurum-equity", String(v));
                    }}
                  />
                  Risk
                  <input
                    className="num-in"
                    style={{ width: 44 }}
                    type="number"
                    step={0.5}
                    value={s.riskPct}
                    onChange={(ev) => {
                      const v = Number(ev.target.value) || 1;
                      patch({ riskPct: v });
                      localStorage.setItem("aurum-risk", String(v));
                    }}
                  />
                  %
                </span>
              </div>
              {s.signal ? (
                <div className="mb-1.5 flex flex-wrap gap-1">
                  <span className="sc">
                    DIR{" "}
                    <b style={{ color: s.signal.dir === "short" ? "var(--color-down)" : "var(--color-up)" }}>
                      {s.signal.dir.toUpperCase()}
                    </b>
                  </span>
                  <span className="sc">
                    ZONE{" "}
                    <b>
                      {fmt(s.signal.zone[0])} – {fmt(s.signal.zone[1])}
                    </b>
                  </span>
                  <span className="sc">
                    SL <b style={{ color: "var(--color-down)" }}>{fmt(s.signal.sl)}</b>
                  </span>
                  <span className="sc">
                    TP <b style={{ color: "var(--color-up)" }}>{fmt(s.signal.tp)}</b>
                  </span>
                  <span className="sc">
                    R:R <b>{s.signal.rr.toFixed(2)} : 1</b>
                  </span>
                  <span className="sc">
                    VALID <b>{s.signal.validity} min</b>
                  </span>
                </div>
              ) : null}
              <div className="sig-log">
                {s.logs.length === 0 ? (
                  <div className="l dim">Paste a LONG/SHORT signal block to arm live SL/TP monitoring.</div>
                ) : (
                  s.logs.map((l) => (
                    <div className={`l ${l.kind}`} key={l.id}>
                      [{utcStr(l.t)}] {l.msg}
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="col col-right">
          <section className="panel">
            <div className="hd">
              <span>TECHNICAL INDICATORS · 15m</span>
            </div>
            <div className="bd">
              <Ind
                name="RSI (14)"
                value={I?.rsi == null ? "--" : I.rsi.toFixed(1)}
                color={I?.rsi != null ? (I.rsi > 70 ? "var(--color-down)" : I.rsi < 30 ? "var(--color-up)" : undefined) : undefined}
              >
                {I?.rsi != null ? (
                  <MiniFill
                    left={`${I.rsi}%`}
                    width={`${Math.max(2, (Math.abs(I.rsi - 50) / 50) * 100)}%`}
                    color={I.rsi >= 50 ? "var(--color-up)" : "var(--color-down)"}
                  />
                ) : null}
              </Ind>
              <Ind
                name="MACD (12,26,9)"
                value={I?.macd ? `${I.macd.line >= 0 ? "+" : ""}${I.macd.line.toFixed(2)}` : "--"}
                color={I?.macd ? (I.macd.line >= 0 ? "var(--color-up)" : "var(--color-down)") : undefined}
              >
                {I?.macd ? (
                  <MiniFill
                    left="50%"
                    width={`${clamp((Math.abs(I.macd.line) / 20) * 100, 2, 100)}%`}
                    color={I.macd.line >= 0 ? "var(--color-up)" : "var(--color-down)"}
                  />
                ) : null}
              </Ind>
              <Ind
                name="HISTOGRAM"
                value={I?.macd ? `${I.macd.hist >= 0 ? "+" : ""}${I.macd.hist.toFixed(2)}` : "--"}
                color={I?.macd ? (I.macd.hist >= 0 ? "var(--color-up)" : "var(--color-down)") : undefined}
              >
                {I?.macd ? (
                  <MiniFill
                    left="50%"
                    width={`${clamp((Math.abs(I.macd.hist) / 15) * 100, 2, 100)}%`}
                    color={I.macd.hist >= 0 ? "var(--color-up)" : "var(--color-down)"}
                  />
                ) : null}
              </Ind>
              <Ind
                name="STOCH %K / %D"
                value={I?.stoch ? `${I.stoch.k.toFixed(0)} / ${I.stoch.d.toFixed(0)}` : "--"}
                color={
                  I?.stoch ? (I.stoch.k > 80 ? "var(--color-down)" : I.stoch.k < 20 ? "var(--color-up)" : undefined) : undefined
                }
              >
                {I?.stoch ? (
                  <MiniFill
                    left="0"
                    width={`${clamp(I.stoch.k, 0, 100)}%`}
                    color={I.stoch.k > 80 ? "var(--color-down)" : I.stoch.k < 20 ? "var(--color-up)" : "var(--color-gold)"}
                  />
                ) : null}
              </Ind>
              <Ind name="BOLLINGER %B" value={I?.bb ? I.bb.pb.toFixed(2) : "--"}>
                {I?.bb ? (
                  <MiniFill left="0" width={`${clamp(I.bb.pb * 100, 0, 100)}%`} color="var(--color-violet)" />
                ) : null}
              </Ind>
              <Ind
                name="VWAP DELTA"
                value={
                  I?.vwap != null && last
                    ? `${(((last - I.vwap) / I.vwap) * 100 >= 0 ? "+" : "") + (((last - I.vwap) / I.vwap) * 100).toFixed(2)}%`
                    : "--"
                }
                color={
                  I?.vwap != null && last
                    ? last >= I.vwap
                      ? "var(--color-up)"
                      : "var(--color-down)"
                    : undefined
                }
              >
                {I?.vwap != null && last ? (
                  <MiniFill
                    left="50%"
                    width={`${clamp(Math.abs(((last - I.vwap) / I.vwap) * 100) * 20, 2, 100)}%`}
                    color={last >= I.vwap ? "var(--color-up)" : "var(--color-down)"}
                  />
                ) : null}
              </Ind>
              <Ind name="ATR (14)" value={I?.atr == null ? "--" : I.atr.toFixed(2)}>
                {I?.atr != null && last ? (
                  <MiniFill
                    left="0"
                    width={`${clamp((I.atr / last) * 100 * 20, 2, 100)}%`}
                    color="var(--color-cyan)"
                  />
                ) : null}
              </Ind>
              <Ind
                name="EMA STACK"
                value={emaStack(I, last).split(" ")[0]!}
                color={
                  emaStack(I, last).startsWith("BULL")
                    ? "var(--color-up)"
                    : emaStack(I, last).startsWith("BEAR")
                      ? "var(--color-down)"
                      : "var(--color-mute)"
                }
              >
                <MiniFill
                  left="0"
                  width="100%"
                  color={
                    emaStack(I, last).startsWith("BULL")
                      ? "var(--color-up)"
                      : emaStack(I, last).startsWith("BEAR")
                        ? "var(--color-down)"
                        : "var(--color-gold)"
                  }
                />
              </Ind>
              <Kv
                k="EMA 8 / 21 / 50"
                v={I?.ema8 ? `${fmt(I.ema8)} / ${fmt(I.ema21)} / ${fmt(I.ema50)}` : "--"}
              />
              <Kv
                k="BOLL 20 / 2"
                v={I?.bb ? `${fmt(I.bb.lower)} / ${fmt(I.bb.mid)} / ${fmt(I.bb.upper)}` : "--"}
              />
              <Kv
                k="VOLATILITY ATR%"
                v={I?.atr && last ? `${((I.atr / last) * 100).toFixed(3)}%` : "--"}
              />
            </div>
          </section>

          <section className="panel" style={{ flex: 1 }}>
            <div className="hd">
              <span>DERIVATIVES & SENTIMENT</span>
              <span className="hdr">{s.lastApi ? utcStr(s.lastApi) : "--"}</span>
            </div>
            <div className="bd">
              <div className="mb-1 text-[9px] tracking-widest text-mute uppercase">Global L/S Account Ratio</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-gold">
                  {s.lsRatio == null ? "--" : s.lsRatio.toFixed(3)}
                </span>
                <div className="relative h-3 flex-1 overflow-hidden rounded-[3px] border border-desk-line bg-[#0a1018]">
                  <div
                    className="absolute top-0 bottom-0 left-0"
                    style={{
                      width: `${lsPos}%`,
                      background: "linear-gradient(90deg, var(--color-down), var(--color-gold), var(--color-up))",
                    }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[#4a5d80]" />
                </div>
              </div>
              <div className="mt-1 mb-2 flex justify-between font-mono text-[10px] text-mute">
                <span>
                  LONG <b className="up">{s.lsLong == null ? "--" : s.lsLong.toFixed(1)}</b>%
                </span>
                <span>{lsTrend(s.lsHist)}</span>
                <span>
                  <b className="down">{s.lsShort == null ? "--" : s.lsShort.toFixed(1)}</b>% SHORT
                </span>
              </div>
              <div className="mb-1 text-[9px] tracking-widest text-mute uppercase">Taker Buy / Sell Volume</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-cyan">
                  {s.takerRatio == null ? "--" : s.takerRatio.toFixed(3)}
                </span>
                <div className="split-bar flex-1">
                  <div className="b" style={{ width: `${buyP}%`, background: "var(--color-up)" }} />
                  <div className="b" style={{ width: `${100 - buyP}%`, background: "var(--color-down)" }} />
                </div>
              </div>
              <div className="mt-1 mb-2 flex justify-between font-mono text-[10px] text-mute">
                <span>
                  BUY <b className="up">{fmtShort(s.takerBuy)}</b>
                </span>
                <span>
                  SELL <b className="down">{fmtShort(s.takerSell)}</b>
                </span>
              </div>
              <Kv k="OPEN INTEREST" v={s.oi == null ? "--" : `${fmt(s.oi, 0)} oz`} />
              <Kv
                k="OI CHANGE"
                v={
                  oiDelta == null
                    ? "--"
                    : `${oiDelta >= 0 ? "+" : ""}${fmt(oiDelta, 0)} (${s.oiPrev ? ((oiDelta / s.oiPrev) * 100).toFixed(2) : "0.00"}%)`
                }
                cls={oiDelta != null && oiDelta >= 0 ? "up" : "down"}
              />
              <Kv
                k="FUNDING (8H)"
                v={s.funding == null ? "--" : `${(s.funding * 100).toFixed(4)}%`}
                cls={frUp ? "up" : "down"}
              />
              <Kv
                k="FUNDING ANNUAL"
                v={s.funding == null ? "--" : `${(s.funding * 3 * 365 * 100).toFixed(2)}%`}
                cls={frUp ? "up" : "down"}
              />
              <Kv k="NEXT FUNDING" v={nextFund} />
              <Kv k="VENUE" v={s.venue} />
            </div>
          </section>
        </div>
      </main>

      <footer className="desk-foot">
        <span>
          WS <b>{s.wsStatus}</b>
        </span>
        <span>
          API <b>{s.lastApi ? "ok" : "--"}</b>
        </span>
        <span>
          LAST UPDATE <b>{s.lastApi ? utcStr(s.lastApi) : "--"}</b>
        </span>
        <span>
          UPDATES <b>{s.updates}</b>
        </span>
        <span>
          ENGINE <b>{e.dir > 0 ? "LONG BIAS" : e.dir < 0 ? "SHORT BIAS" : "FLAT"}</b>
        </span>
        <span className="flex-1" />
        <span className="hide-sm">R refresh · SPACE pause · F fullscreen · S sound</span>
        <span>Not financial advice</span>
      </footer>

      {s.alert && Date.now() < s.alert.until ? (
        <div className="alert-overlay">
          <div className={`alert-box ${s.alert.kind === "stop" ? "stop" : s.alert.kind === "tp" ? "tp" : ""}`}>
            <div className="ah">
              <span>{s.alert.title}</span>
              <button className="btn red" onClick={() => patch({ alert: null })}>
                DISMISS
              </button>
            </div>
            <div className="ab">
              {s.alert.lines.map((l) => (
                <div className="row" key={l[0]}>
                  <span className="k">{l[0]}</span>
                  <span className="v" style={l[2] ? { color: l[2] } : undefined}>
                    {l[1]}
                  </span>
                </div>
              ))}
            </div>
            <div className="af">
              <span>{s.alert.note}</span>
              <span>auto-dismiss {alertLeft}s</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Kv({ k, v, cls }: { k: string; v: string; cls?: string }) {
  return (
    <div className="kv">
      <span className="k">{k}</span>
      <span className={`v ${cls ?? ""}`}>{v}</span>
    </div>
  );
}

function Ind({
  name,
  value,
  color,
  children,
}: {
  name: string;
  value: string;
  color?: string;
  children?: ReactNode;
}) {
  return (
    <div className="ind-row">
      <span className="in">{name}</span>
      <div className="mini-bar">{children}</div>
      <span className="iv font-mono text-right font-semibold" style={color ? { color } : undefined}>
        {value}
      </span>
    </div>
  );
}

function emaStack(I: ReturnType<typeof useTerminal.getState>["inds"], last: number | null) {
  if (!I?.ema8 || !I.ema21 || !I.ema50 || last == null) return "MIXED";
  if (last > I.ema8 && I.ema8 > I.ema21 && I.ema21 > I.ema50) return "BULL ALIGNED";
  if (last < I.ema8 && I.ema8 < I.ema21 && I.ema21 < I.ema50) return "BEAR ALIGNED";
  return "MIXED";
}

function lsTrend(hist: number[]) {
  if (hist.length < 6) return "--";
  const prev = hist[hist.length - 6]!;
  const cur = hist[hist.length - 1]!;
  return cur > prev ? "L/S RISING" : "L/S FALLING";
}

function formatNext(ms: number | null) {
  if (!ms) return "--";
  const secs = Math.max(0, Math.round((ms - Date.now()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

function signalStateLabel(s: ReturnType<typeof useTerminal.getState>) {
  const sig = s.signal;
  if (!sig) return "inactive";
  if (sig.state === "expired") return "expired";
  if (sig.state === "closed") return "closed";
  if (sig.state === "active") return "ACTIVE";
  const minLeft = Math.max(0, Math.ceil((sig.expiry - Date.now()) / 60000));
  return `${sig.dir} | waiting ${minLeft}m`;
}

function togglePause() {
  const paused = !useTerminal.getState().paused;
  patch({ paused });
  if (!paused) void runAllPolls();
}

function toggleSound() {
  const sound = !useTerminal.getState().sound;
  patch({ sound });
  localStorage.setItem("aurum-sound", sound ? "on" : "off");
}

function toggleFs() {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen();
}

function activateSignal() {
  const el = document.getElementById("sigText") as HTMLTextAreaElement | null;
  const txt = el?.value || "";
  if (!txt.trim()) {
    pushLog("Paste a signal block first", "warn");
    return;
  }
  const parsed = parseSignalText(txt);
  if (!parsed) {
    pushLog("Could not parse. Need DIRECTION, ENTRY or ENTRY ZONE, STOP LOSS, TAKE PROFIT", "warn");
    return;
  }
  patch({ signal: parsed });
  pushLog(
    `${parsed.dir.toUpperCase()} signal loaded. Entry zone ${fmt(parsed.zone[0])} – ${fmt(parsed.zone[1])} | SL ${fmt(parsed.sl)} | TP ${fmt(parsed.tp)} | valid ${parsed.validity}min`,
    "dim",
  );
}
