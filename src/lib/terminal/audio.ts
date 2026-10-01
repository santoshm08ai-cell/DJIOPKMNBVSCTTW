let ctx: AudioContext | null = null;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function beep(freq: number, dur: number, delay = 0, type: OscillatorType = "sine") {
  const AC = ac();
  if (!AC) return;
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t0 = AC.currentTime + delay;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(AC.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

export function playSound(type: "entry" | "stop" | "tp" | "gate") {
  if (type === "entry") {
    beep(660, 0.14, 0);
    beep(880, 0.14, 0.16);
    beep(1100, 0.2, 0.32);
  } else if (type === "stop") {
    beep(420, 0.18, 0, "square");
    beep(320, 0.18, 0.2, "square");
    beep(210, 0.28, 0.4, "square");
  } else if (type === "tp") {
    beep(880, 0.14, 0);
    beep(1100, 0.14, 0.16);
    beep(1320, 0.24, 0.32);
  } else {
    beep(520, 0.12, 0);
  }
}
