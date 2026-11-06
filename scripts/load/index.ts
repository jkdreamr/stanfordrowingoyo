import { writeFile } from 'node:fs/promises';
import { parseOptions, usage } from './args.ts';
import { cleanup, runScenarios } from './scenarios.ts';
import { report } from './report.ts';
import type { Sample } from './stats.ts';

async function main() {
  let options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : error}\n${usage}`);
    process.exitCode = 2;
    return;
  }
  const samples: Sample[] = [];
  const timings: Record<string, number> = {};
  const start = performance.now();
  let failed = false;
  try {
    if (options.cleanup) await cleanup(options, samples);
    else failed = (await runScenarios(options, samples, timings)) > 0;
  } catch (error) {
    console.error(`Run stopped: ${error instanceof Error ? error.message : error}`);
    failed = true;
  }
  const result = report(samples, (performance.now() - start) / 1000, timings, options.p95Ms);
  if (failed) console.error('FAILED: One or more workflows could not complete');
  if (options.json)
    await writeFile(
      options.json,
      JSON.stringify({ ...result, workflowFailed: failed }, null, 2) + '\n',
    );
  if (failed || result.failures.length) process.exitCode = 1;
}
main().catch((error) => {
  console.error(`Load runner failed: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
