import { describe, expect, it } from 'vitest';
import { parseOptions } from './args.ts';

describe('CLI safety', () => {
  it('requires an explicit origin', () => {
    expect(() => parseOptions([])).toThrow('--base-url is required');
    for (const url of ['ftp://localhost', 'http://user:pass@localhost', 'http://localhost/api'])
      expect(() => parseOptions(['--base-url', url])).toThrow();
  });
  it('permits local names and blocks remote targets', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]', 'oyo.local'])
      expect(parseOptions(['--base-url', `http://${host}`]).users).toBe(60);
    expect(() => parseOptions(['--base-url', 'https://example.com'])).toThrow(
      'Remote host refused',
    );
    expect(parseOptions(['--base-url', 'https://example.com', '--allow-remote']).baseUrl).toBe(
      'https://example.com',
    );
    const args = ['--base-url', 'https://prod.example.com', '--allow-remote'];
    expect(() => parseOptions(args)).toThrow('Production-looking');
    expect(parseOptions([...args, '--i-know-this-is-production']).baseUrl).toBe(
      'https://prod.example.com',
    );
  });
  it('validates numeric flags and scenarios', () => {
    for (const tail of [
      ['--users', '0'],
      ['--concurrency', '1.2'],
      ['--burst-window', '-1'],
      ['--p95-ms', 'NaN'],
      ['--scenario', 'invalid'],
    ])
      expect(() => parseOptions(['--base-url', 'http://localhost', ...tail])).toThrow();
    expect(
      parseOptions(['--base-url', 'http://localhost', '--users', '3'], {
        LOAD_ADMIN_PASSWORD: 'example',
      }),
    ).toMatchObject({ concurrency: 3, adminPassword: 'example' });
  });
});
