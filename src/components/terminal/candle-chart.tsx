import { useEffect, useRef } from "react";
import { emaArr } from "@/lib/terminal/indicators";
import { clamp, fmt, fmtShort, hhmm } from "@/lib/terminal/format";
import { patch, useTerminal } from "@/lib/terminal/store";

export function CandleChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tip = useTerminal((s) => s.ohlcTip);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let last = 0;

    const draw = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (W === 0 || H === 0) return;
      if (cv.width !== Math.floor(W * dpr) || cv.height !== Math.floor(H * dpr)) {
        cv.width = Math.floor(W * dpr);
        cv.height = Math.floor(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#0a1018";
      ctx.fillRect(0, 0, W, H);

      const s = useTerminal.getState();
      const bars = s.klines;
      if (bars.length < 2) {
        ctx.fillStyle = "#3a4d70";
        ctx.font = "13px IBM Plex Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText("LOADING 15m DATA…", W / 2, H / 2);
        ctx.fillText(`${bars.length} candles`, W / 2, H / 2 + 18);
        return;
      }

      const closes = bars.map((b) => b.c);
      const e8 = emaArr(closes, 8);
      const e21 = emaArr(closes, 21);
      const e50 = emaArr(closes, 50);
      const PAD = 64;
      const top = 12;
      const priceH = H * 0.74;
      const volTop = priceH + 14;
      const volH = H - priceH - 22;
      const plotW = W - PAD;
      const plotH = priceH - top;
      let min = Infinity;
      let max = -Infinity;
      for (const b of bars) {
        min = Math.min(min, b.l);
        max = Math.max(max, b.h);
      }
      for (const v of e50) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      let span = max - min || 1;
      min -= span * 0.08;
      max += span * 0.08;
      span = max - min;
      const bw = plotW / bars.length;
      const yFor = (v: number) => top + ((max - v) / span) * plotH;

      ctx.strokeStyle = "#15213a";
      ctx.fillStyle = "#3a4d70";
      ctx.font = "9px IBM Plex Mono, monospace";
      ctx.textAlign = "left";
      for (let g = 0; g <= 5; g++) {
        const gy = top + (plotH * g) / 5;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W - PAD, gy);
        ctx.stroke();
        ctx.fillText(fmt(max - (span * g) / 5, 2), W - PAD + 4, gy + 3);
      }
      let maxVol = 0.0001;
      for (const b of bars) if (b.v > maxVol) maxVol = b.v;
      ctx.textAlign = "right";
      const step = Math.max(1, Math.round(bars.length / 8));
      for (let ti = 0; ti < bars.length; ti += step) {
        const tx = 8 + ti * bw + bw / 2;
        ctx.fillText(hhmm(bars[ti]!.t), Math.min(tx, W - PAD - 2), H - 6);
      }
      ctx.textAlign = "left";
      for (let bi = 0; bi < bars.length; bi++) {
        const b = bars[bi]!;
        const up = b.c >= b.o;
        const x = 8 + bi * bw;
        ctx.strokeStyle = up ? "#2ecf9a" : "#ff5d5d";
        ctx.fillStyle = up ? "#2ecf9a" : "#ff5d5d";
        ctx.beginPath();
        ctx.moveTo(x + bw / 2, yFor(b.h));
        ctx.lineTo(x + bw / 2, yFor(b.l));
        ctx.stroke();
        const bw2 = Math.max(1, bw * 0.62);
        const yO = yFor(b.o);
        const yC = yFor(b.c);
        ctx.fillRect(x + (bw - bw2) / 2, Math.min(yO, yC), bw2, Math.max(1, Math.abs(yC - yO)));
        const vh = volH * (b.v / maxVol);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(x + (bw - bw2) / 2, volTop + volH - vh, bw2, vh);
        ctx.globalAlpha = 1;
      }
      const drawEma = (arr: number[], color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        for (let e = 0; e < arr.length; e++) {
          const ex = 8 + e * bw + bw / 2;
          const ey = yFor(arr[e]!);
          if (e === 0) ctx.moveTo(ex, ey);
          else ctx.lineTo(ex, ey);
        }
        ctx.stroke();
      };
      drawEma(e8, "#5aa0ff");
      drawEma(e21, "#c9a227");
      drawEma(e50, "#9aa7c7");
      const p = s.price;
      if (p != null) {
        const lp = yFor(p);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = "rgba(232,238,247,.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, lp);
        ctx.lineTo(W - PAD, lp);
        ctx.stroke();
        ctx.setLineDash([]);
        const tagTxt = fmt(p);
        ctx.font = "bold 10px IBM Plex Mono, monospace";
        const tw = ctx.measureText(tagTxt).width + 8;
        const lastUp = bars[bars.length - 1]!.c >= bars[bars.length - 1]!.o;
        ctx.fillStyle = lastUp ? "#2ecf9a" : "#ff5d5d";
        ctx.fillRect(W - PAD, lp - 9, tw, 18);
        ctx.fillStyle = "#07090f";
        ctx.fillText(tagTxt, W - PAD + 4, lp + 4);
      }
      if (s.hoverIdx >= 0 && s.hoverIdx < bars.length) {
        const b2 = bars[s.hoverIdx]!;
        const cx = 8 + s.hoverIdx * bw + bw / 2;
        ctx.strokeStyle = "rgba(168,182,200,.35)";
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(cx, top);
        ctx.lineTo(cx, priceH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const e = s.engine;
      if (e.entry != null && e.sl != null && e.tp != null && e.dir !== 0) {
        const drawLvl = (v: number, color: string) => {
          const y = yFor(v);
          if (y < top || y > priceH) return;
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(W - PAD, y);
          ctx.stroke();
          ctx.setLineDash([]);
        };
        drawLvl(e.entry, "rgba(232,238,247,.35)");
        drawLvl(e.sl, "rgba(255,93,93,.7)");
        drawLvl(e.tp, "rgba(46,207,154,.7)");
      }
    };

    const loop = (t: number) => {
      if (t - last > 180) {
        last = t;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onMove = (ev: MouseEvent) => {
      const cv = canvasRef.current;
      if (!cv) return;
      const r = cv.getBoundingClientRect();
      const x = ev.clientX - r.left;
      const bars = useTerminal.getState().klines;
      if (!bars.length) return;
      const idx = clamp(Math.floor((x - 8) / ((cv.clientWidth - 64) / bars.length)), 0, bars.length - 1);
      const b = bars[idx]!;
      patch({
        hoverIdx: idx,
        ohlcTip: `${hhmm(b.t)}Z  O ${fmt(b.o)}  H ${fmt(b.h)}  L ${fmt(b.l)}  C ${fmt(b.c)}  V ${fmtShort(b.v)}`,
      });
    };
    const onLeave = () => patch({ hoverIdx: -1 });
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      ro.disconnect();
    };
  }, []);

  return (
    <section className="panel" id="chart-panel" style={{ flex: 1, minHeight: 240 }}>
      <div className="hd">
        <span>XAUUSDT · 15m · 200 CANDLES</span>
        <span className="hdr flex items-center gap-3">
          <span className="legend hidden items-center gap-2 sm:flex">
            <span>
              <i style={{ background: "#5aa0ff" }} />
              EMA8
            </span>
            <span>
              <i style={{ background: "#c9a227" }} />
              EMA21
            </span>
            <span>
              <i style={{ background: "#9aa7c7" }} />
              EMA50
            </span>
          </span>
        </span>
      </div>
      <div className="bd relative p-0" style={{ padding: 0 }}>
        <canvas ref={canvasRef} className="block h-full w-full cursor-crosshair" />
        <div className="pointer-events-none absolute top-1.5 left-2 font-mono text-[10px] text-mute">{tip}</div>
      </div>
    </section>
  );
}
