import { useEffect, useState } from 'react';

export type SfxName = 'blip' | 'select' | 'coin' | 'hit';
export type Tone = {
  freq: number;
  to?: number;
  dur?: number;
  type?: OscillatorType;
  vol?: number;
  delay?: number;
};
const KEY = 'oyo-arcade-sound';
let on = false;
let ctx: AudioContext | null = null;
const sources = new Map<AudioScheduledSourceNode, GainNode>();
const subs = new Set<(on: boolean) => void>();
function suspend() {
  for (const source of sources.keys()) {
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  }
  if (ctx) void ctx.suspend().catch(() => {});
}
function setOn(value: boolean) {
  on = value;
  try {
    localStorage.setItem(KEY, value ? 'on' : 'off');
  } catch {
    /* storage unavailable */
  }
  if (!value) suspend();
  subs.forEach((notify) => notify(value));
}
function unlock() {
  if (!on || document.hidden) return;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ctx && AC) ctx = new AC();
    if (ctx) void ctx.resume().catch(() => {});
  } catch {
    /* audio unavailable */
  }
}
function connect(source: AudioScheduledSourceNode & AudioNode, gain: GainNode) {
  if (!ctx) return;
  source.connect(gain).connect(ctx.destination);
  sources.set(source, gain);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
    sources.delete(source);
  };
}
function tone({ freq, to, dur = 0.12, type = 'square', vol = 0.18, delay = 0 }: Tone) {
  if (!on || !ctx || ctx.state !== 'running' || document.hidden) return;
  const t = ctx.currentTime + delay,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(vol * 0.5, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  connect(o, g);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function noise(dur = 0.25, vol = 0.25) {
  if (!on || !ctx || ctx.state !== 'running' || document.hidden) return;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const source = ctx.createBufferSource(),
    gain = ctx.createGain();
  source.buffer = buffer;
  gain.gain.value = vol * 0.5;
  connect(source, gain);
  source.start();
}
export const sfx = {
  unlock,
  suspend,
  tone,
  noise,
  play(name: SfxName, pitch = 1) {
    if (name === 'blip') tone({ freq: 660 * pitch, dur: 0.05, vol: 0.12 });
    if (name === 'select')
      tone({ freq: 520 * pitch, to: 880 * pitch, dur: 0.08, type: 'triangle', vol: 0.2 });
    if (name === 'coin') {
      tone({ freq: 988 * pitch, dur: 0.06, vol: 0.14 });
      tone({ freq: 1319 * pitch, dur: 0.16, vol: 0.14, delay: 0.06 });
    }
    if (name === 'hit')
      tone({ freq: 220 * pitch, to: 90 * pitch, dur: 0.12, type: 'sawtooth', vol: 0.18 });
  },
};
export function useSound(): [boolean, (on: boolean) => void] {
  const [value, setValue] = useState(() => {
    try {
      on = localStorage.getItem(KEY) === 'on';
    } catch {
      on = false;
    }
    return on;
  });
  useEffect(() => {
    subs.add(setValue);
    const hide = () => {
      if (document.hidden) suspend();
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      subs.delete(setValue);
      document.removeEventListener('visibilitychange', hide);
      suspend();
      if (ctx) {
        void ctx.close().catch(() => {});
        ctx = null;
      }
      for (const [source, gain] of sources) {
        source.disconnect();
        gain.disconnect();
        source.onended = null;
      }
      sources.clear();
    };
  }, []);
  return [value, setOn];
}
