import type { Page, TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { test, expect } from './fixtures';
import { seedEntry } from './helpers';

type Sample = { at: number; transform: string; opacity: number; x: number; y: number };
type Record = {
  text: string;
  born: number;
  exit: number | null;
  removed: number | null;
  entry: { start: number; duration: number; iterations: number; rate: number } | null;
  samples: Sample[];
  events: { at: number; type: string; name: string }[];
};
type Probe = { records: Record[]; maxVisible: number };
type ProbeWindow = Window & { toastMotion: Probe };

async function observe(page: Page) {
  await page.evaluate(() => {
    const probe: Probe = { records: [], maxVisible: 0 };
    (window as unknown as ProbeWindow).toastMotion = probe;
    const nodes = new Map<HTMLElement, Record>();
    const scan = () => {
      const visible = document.querySelectorAll<HTMLElement>('.ui-toast');
      probe.maxVisible = Math.max(probe.maxVisible, visible.length);
      for (const node of Array.from(visible)) {
        if (!nodes.has(node)) {
          const record: Record = {
            text: node.textContent ?? '',
            born: performance.now(),
            exit: null,
            removed: null,
            entry: null,
            samples: [],
            events: [],
          };
          nodes.set(node, record);
          probe.records.push(record);
          for (const type of ['animationstart', 'animationend', 'animationcancel'])
            node.addEventListener(type, (event) =>
              record.events.push({
                at: performance.now() - record.born,
                type,
                name: (event as AnimationEvent).animationName,
              }),
            );
        }
      }
      for (const [node, record] of nodes) {
        if (!node.isConnected && record.removed === null)
          record.removed = performance.now() - record.born;
        if (node.classList.contains('is-leaving') && record.exit === null)
          record.exit = performance.now() - record.born;
      }
    };
    new MutationObserver(scan).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class'],
    });
    const sample = () => {
      scan();
      for (const [node, record] of nodes) {
        if (!node.isConnected) continue;
        const style = getComputedStyle(node);
        const animation = node
          .getAnimations()
          .find(
            (animation) =>
              animation instanceof CSSAnimation && animation.animationName === 'ui-toast-enter',
          );
        if (animation?.startTime !== null && animation?.startTime !== undefined && !record.entry) {
          const timing = animation.effect!.getTiming();
          record.entry = {
            start: Number(animation.startTime) - record.born,
            duration: Number(timing.duration),
            iterations: Number(timing.iterations),
            rate: animation.playbackRate,
          };
        }
        const box = node.getBoundingClientRect();
        record.samples.push({
          at: performance.now() - record.born,
          transform: style.transform,
          opacity: Number(style.opacity),
          x: box.x,
          y: box.y,
        });
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function report(page: Page, info: TestInfo) {
  const probe = await page.evaluate(() => (window as unknown as ProbeWindow).toastMotion);
  await writeFile(info.outputPath('toast-motion.json'), JSON.stringify(probe, null, 2));
  await info.attach('toast-motion.json', {
    body: JSON.stringify(probe, null, 2),
    contentType: 'application/json',
  });
  return probe;
}

function stable(record: Record) {
  expect(record.entry).not.toBeNull();
  expect(record.entry!.duration).toBeLessThanOrEqual(400);
  expect(record.entry!.iterations).toBe(1);
  expect(record.entry!.rate).toBe(1);
  const beforeExit = record.samples.filter((sample) => sample.at < record.exit!);
  const settled = beforeExit.filter((sample) => sample.at - record.entry!.start >= 430);
  expect(settled.length).toBeGreaterThan(10);
  expect(new Set(settled.map((sample) => sample.transform)).size).toBe(1);
  expect(new Set(settled.map((sample) => `${sample.x},${sample.y}`)).size).toBe(1);
  expect(settled.every((sample) => sample.opacity === 1)).toBe(true);
  const lastChange = beforeExit.reduce(
    (last, sample, index) =>
      index && sample.transform !== beforeExit[index - 1].transform ? sample.at : last,
    0,
  );
  expect(
    record.events.filter(
      (event) => event.type === 'animationstart' && event.name === 'ui-toast-enter',
    ),
  ).toHaveLength(1);
  console.log(
    `TOAST_STABLE ${JSON.stringify({ text: record.text, entryDurationMs: record.entry!.duration, lastObservedTransformChangeMs: lastChange, stableSamples: settled.length, exitAtMs: record.exit, removedAtMs: record.removed })}`,
  );
}

test('saved-session toast settles and remains still until its automatic exit', async ({
  makeRower,
}, info) => {
  test.setTimeout(60_000);
  const { page } = await makeRower();
  await page.goto('/log');
  await page.getByLabel('Meters', { exact: true }).fill('1800');
  await page.getByLabel('Title', { exact: true }).fill('Toast Motion');
  await observe(page);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForFunction(() =>
    (window as unknown as ProbeWindow).toastMotion.records.some(
      (record) => record.text.includes('Session saved') && record.removed !== null,
    ),
  );
  const probe = await report(page, info);
  const record = probe.records.find((record) => record.text.includes('Session saved'))!;
  stable(record);
  expect(record.exit).toBeGreaterThanOrEqual(3700);
  expect(record.removed! - record.exit!).toBeGreaterThanOrEqual(150);
  expect(probe.maxVisible).toBe(1);
});

test('replaced toasts settle and a stable toast dismisses with its exit animation', async ({
  makeRower,
}, info) => {
  test.setTimeout(60_000);
  const rower = await makeRower();
  const entry = await seedEntry(rower, 'Toast Replacement');
  const { page } = rower;
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => {} },
    });
  });
  await page.goto(`/entries/${entry.id}`);
  await observe(page);
  for (let count = 1; count <= 4; count++) {
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    await page.waitForFunction(
      (count) => (window as unknown as ProbeWindow).toastMotion.records.length === count,
      count,
    );
  }
  await page.waitForFunction(
    () =>
      ((window as unknown as ProbeWindow).toastMotion.records.at(-1)?.samples.at(-1)?.at ?? 0) >=
      1500,
  );
  await page.screenshot({ path: info.outputPath('toast-stable.png') });
  await page.getByRole('button', { name: 'Dismiss Notification', exact: true }).click();
  await page.waitForFunction(
    () => (window as unknown as ProbeWindow).toastMotion.records.at(-1)!.removed !== null,
  );
  const probe = await report(page, info);
  expect(probe.records).toHaveLength(4);
  expect(probe.maxVisible).toBe(1);
  const record = probe.records.at(-1)!;
  stable(record);
  expect(record.exit).toBeLessThan(3700);
  expect(
    record.events.some(
      (event) => event.type === 'animationstart' && event.name === 'ui-toast-exit',
    ),
  ).toBe(true);
  expect(record.removed! - record.exit!).toBeGreaterThanOrEqual(150);
  const exitSamples = record.samples.filter((sample) => sample.at > record.exit!);
  expect(exitSamples.some((sample) => sample.opacity < 0.9)).toBe(true);
  expect(new Set(exitSamples.map((sample) => sample.transform)).size).toBeGreaterThan(1);
});
