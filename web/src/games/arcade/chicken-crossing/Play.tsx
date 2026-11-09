import { useEffect, useRef, useState } from 'react';
import { sfx } from '../kit/sfx';
import { useCanvas } from '../kit/canvas';
import { useGameLoop } from '../kit/loop';
import { useKeys } from '../kit/keys';
import { useGestures } from '../kit/gestures';
import type { ArcadePlayProps } from '../kit/types';
import type { ChickenStats } from '../../../../../shared/games/chickenCrossing';
import {
  IDLE_GRACE,
  createState,
  laneAt,
  step,
  type Biome,
  type Death,
  type Direction,
} from './logic';
import { burst, createView, draw, follow } from './draw';
import './chicken-crossing.css';

const directions: Direction[] = ['up', 'left', 'right', 'down'];
const directionFor: Record<string, Direction> = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
};
const biomeNames: Record<Biome, string> = {
  meadow: 'the meadow',
  orchard: 'the orchard',
  dunes: 'the dunes',
  tundra: 'the tundra',
};
const endings: Record<Death, [string, string]> = {
  car: ['Flattened', 'wait for the gap, then go.'],
  train: ['Caught by the Train', 'when the light flashes, stay off the tracks.'],
  water: ['Splash', 'chickens ride logs and lily pads, they do not swim.'],
  drift: ['Swept Away', 'hop off before the log leaves the field.'],
  hawk: ['Snatched', 'the hawk comes for chickens who stand still.'],
};
const DEATH_ANIM = 1.05;
export default function Play({
  seed,
  paused,
  reducedMotion,
  setScore,
  onGameOver,
  endRequested,
}: ArcadePlayProps<ChickenStats>) {
  const { ref, size, ctx } = useCanvas();
  const pending = useRef<Direction | null>(null);
  const keys = useKeys((code, event) => {
    if (!paused && !event?.repeat && directionFor[code]) pending.current = directionFor[code];
  }, !paused);
  const [s] = useState(() => ({
    world: createState(seed),
    view: createView(),
    over: false,
    bell: 0,
    ring: 0,
    trains: new Set<number>(),
  }));
  const [readout, setReadout] = useState({ distance: 0, coins: 0 });
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [hurry, setHurry] = useState(false);
  const [moved, setMoved] = useState(false);

  useEffect(() => {
    setScore(0);
  }, [setScore]);
  useEffect(() => {
    pending.current = null;
    s.world.queued = null;
    s.world.repeat = 0;
    keys.clear();
  }, [paused, s, keys]);
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const end = (quit = false) => {
    const w = s.world;
    const [title, tip] = quit
      ? ['Run Ended', 'Come back for another crossing.']
      : endings[w.death ?? 'car'];
    onGameOver({
      score: w.score,
      stats: {
        rows: w.maxRow,
        coins: w.coins,
        hops: w.hops,
        death: quit ? 'quit' : (w.death ?? 'car'),
        duration_ms: Math.round(w.time * 1000),
      },
      title,
      detail: `${w.maxRow} ${w.maxRow === 1 ? 'row' : 'rows'}, ${w.coins} ${w.coins === 1 ? 'coin' : 'coins'}. ${tip}`,
    });
  };

  const endRef = useRef(end);
  endRef.current = end;
  useEffect(() => {
    if (endRequested && !s.over) {
      s.over = true;
      endRef.current(true);
    }
  }, [endRequested, s]);
  const emit: typeof burst = (...args) => {
    if (!reducedMotion) burst(...args);
  };

  useGameLoop(
    (dt) => {
      const w = s.world;
      const v = s.view;
      v.time += dt;
      follow(v, w, size.w, size.h, reducedMotion ? 1 : dt);
      if (reducedMotion) v.fx = [];
      if (v.death >= 0) {
        v.death += dt;
        if (v.death >= DEATH_ANIM && !s.over) {
          s.over = true;
          end();
        }
        return;
      }
      const held = directions.find((d) => keys.down(d)) ?? null;
      const ev = step(w, dt, { held, press: pending.current });
      if (dt > 0) pending.current = null;
      if (ev.hopped) {
        sfx.play('blip', 1.2 + Math.random() * 0.2);
        if (!moved) setMoved(true);
      }
      if (ev.blocked) sfx.tone({ freq: 150, to: 110, dur: 0.06, type: 'triangle', vol: 0.12 });
      if (ev.landed && !ev.crashed) {
        const lane = laneAt(w, Math.round(w.y));
        if (lane?.kind === 'river') emit(v, 'ring', w.x, w.y, 1);
        else emit(v, 'dust', w.x, w.y, 4, 0.5);
      }
      if (ev.scored) {
        setScore(w.score);
        setReadout({ distance: w.maxRow, coins: w.coins });
      }
      if (ev.collected) {
        sfx.play('coin');
        emit(v, 'coin', w.x, w.y, 1, 0);
      } else if (ev.milestone) sfx.play('select');
      if (ev.biome)
        setToast({ text: biomeNames[laneAt(w, w.maxRow)?.biome ?? 'meadow'], key: w.maxRow });
      if (ev.bell) s.bell = 1.3;
      if (s.bell > 0) {
        s.bell -= dt;
        s.ring -= dt;
        if (s.ring <= 0) {
          s.ring = 0.32;
          sfx.tone({ freq: 1480, dur: 0.07, type: 'triangle', vol: 0.06 });
          sfx.tone({ freq: 1110, dur: 0.08, type: 'triangle', vol: 0.05, delay: 0.05 });
        }
      }
      for (const lane of w.lanes) {
        const running = lane.kind === 'rail' && !!lane.train?.running;
        if (running && !s.trains.has(lane.row) && Math.abs(lane.row - w.y) < 5)
          sfx.noise(0.55, 0.1);
        if (running) s.trains.add(lane.row);
        else s.trains.delete(lane.row);
      }
      const late = w.started && w.idle > IDLE_GRACE - 1.5;
      if (late !== hurry) setHurry(late);
      if (ev.crashed) {
        v.death = 0;
        const d = w.death;
        if (d === 'car' || d === 'train') {
          sfx.play('hit');
          emit(v, 'feather', w.x, w.y, d === 'train' ? 12 : 7, d === 'train' ? 2.2 : 1);
        } else if (d === 'hawk') {
          sfx.tone({ freq: 1500, to: 680, dur: 0.4, type: 'sawtooth', vol: 0.05 });
          emit(v, 'feather', w.x, w.y, 5, 0.7);
        } else {
          sfx.noise(0.3, 0.18);
          sfx.tone({ freq: 520, to: 160, dur: 0.25, type: 'sine', vol: 0.1 });
          emit(v, 'splash', w.x, w.y, 9, 1.1);
          emit(v, 'ring', w.x, w.y, 1);
        }
      }
    },
    () => {
      const c = ctx();
      if (c) draw(c, size.w, size.h, s.world, s.view);
    },
    { running: !paused && !s.over },
  );

  const gestures = useGestures((gesture) => {
    pending.current = gesture === 'tap' ? 'up' : gesture;
  }, !paused && !s.over);
  const hint = 'Tap To Hop · Swipe Or Use Arrow Keys To Move';
  return (
    <div className="g-chicken-crossing">
      <div className="g-chicken-crossing-field">
        <canvas
          ref={ref}
          aria-label={`Chicken Crossing: ${readout.distance} rows, ${readout.coins} coins`}
          {...gestures}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
      {toast && (
        <div key={toast.key} className="g-chicken-crossing-toast">
          {toast.text}
        </div>
      )}
      <div className={`g-chicken-crossing-info${hurry ? ' is-hurry' : ''}`} aria-live="off">
        {hurry
          ? 'Keep Moving'
          : moved
            ? `${readout.distance} ${readout.distance === 1 ? 'Row' : 'Rows'} · ${readout.coins} ${readout.coins === 1 ? 'Coin' : 'Coins'}`
            : hint}
      </div>
    </div>
  );
}
