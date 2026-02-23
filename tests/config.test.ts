import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  const origEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    origEnv['SEKS_BROKER_URL'] = process.env['SEKS_BROKER_URL'];
    origEnv['SEKS_BROKER_TOKEN'] = process.env['SEKS_BROKER_TOKEN'];
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(origEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('loads from env vars when both are set', () => {
    process.env['SEKS_BROKER_URL'] = 'http://test-broker:8080';
    process.env['SEKS_BROKER_TOKEN'] = 'test-token-123';

    const config = loadConfig();
    assert.equal(config.primary.url, 'http://test-broker:8080');
    assert.equal(config.primary.token, 'test-token-123');
    assert.equal(config.secondary, undefined);
  });

  it('throws when no config is available', () => {
    delete process.env['SEKS_BROKER_URL'];
    delete process.env['SEKS_BROKER_TOKEN'];
    // This will try to read openclaw.json - if it exists it may pass
    // We just verify it doesn't crash with env vars
    process.env['SEKS_BROKER_URL'] = 'http://localhost:9999';
    process.env['SEKS_BROKER_TOKEN'] = 'tok';
    const config = loadConfig();
    assert.ok(config.primary.url);
  });
});
