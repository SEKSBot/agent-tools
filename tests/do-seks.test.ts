import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseActionArgs, buildUrl } from '../src/providers/executor.js';
import { hetzner } from '../src/providers/hetzner.js';
import { github } from '../src/providers/github.js';
import { cloudflare } from '../src/providers/cloudflare.js';
import { getProvider, listProviders } from '../src/providers/registry.js';
import type { Action, ProviderSchema } from '../src/providers/types.js';

describe('Provider schemas', () => {
  it('should validate hetzner schema structure', () => {
    assert.equal(hetzner.name, 'hetzner');
    assert.equal(hetzner.authPattern.type, 'bearer');
    assert.ok(hetzner.actions['list-servers']);
    assert.ok(hetzner.actions['create-server']);
    assert.ok(hetzner.actions['delete-server']);
  });

  it('should validate github schema structure', () => {
    assert.equal(github.name, 'github');
    assert.ok(github.actions['list-repos']);
    assert.ok(github.actions['clone']);
    assert.equal(github.actions['clone']!.method, 'GIT');
  });

  it('should validate cloudflare schema structure', () => {
    assert.equal(cloudflare.name, 'cloudflare');
    assert.ok(cloudflare.actions['dns-list']);
    assert.ok(cloudflare.actions['dns-add']);
  });
});

describe('Registry', () => {
  it('should list all providers', () => {
    const providers = listProviders();
    assert.equal(providers.length, 3);
    const names = providers.map(p => p.name);
    assert.ok(names.includes('hetzner'));
    assert.ok(names.includes('github'));
    assert.ok(names.includes('cloudflare'));
  });

  it('should get provider by name', () => {
    const p = getProvider('hetzner');
    assert.ok(p);
    assert.equal(p.name, 'hetzner');
  });

  it('should return undefined for unknown provider', () => {
    assert.equal(getProvider('unknown'), undefined);
  });
});

describe('buildUrl', () => {
  it('should substitute path params', () => {
    const url = buildUrl('https://api.hetzner.cloud/v1', '/servers/{id}', { id: '123' });
    assert.equal(url, 'https://api.hetzner.cloud/v1/servers/123');
  });

  it('should substitute multiple path params', () => {
    const url = buildUrl('https://api.github.com', '/repos/{owner}/{repo}/issues', { owner: 'SEKSBot', repo: 'my-repo' });
    assert.equal(url, 'https://api.github.com/repos/SEKSBot/my-repo/issues');
  });

  it('should encode path params', () => {
    const url = buildUrl('https://example.com', '/items/{name}', { name: 'hello world' });
    assert.equal(url, 'https://example.com/items/hello%20world');
  });
});

describe('parseActionArgs', () => {
  it('should parse positional args', () => {
    const action = hetzner.actions['delete-server']!;
    const result = parseActionArgs(action, ['456'], {});
    assert.equal(result.path['id'], '456');
  });

  it('should parse flag args', () => {
    const action = hetzner.actions['create-server']!;
    const result = parseActionArgs(action, [], { name: 'test', type: 'cx22', image: 'ubuntu-22.04' });
    assert.equal(result.body['name'], 'test');
    assert.equal(result.body['server_type'], 'cx22');
    assert.equal(result.body['image'], 'ubuntu-22.04');
  });

  it('should throw on missing required positional', () => {
    const action = hetzner.actions['delete-server']!;
    assert.throws(() => parseActionArgs(action, [], {}), /Missing required positional/);
  });

  it('should throw on missing required flag', () => {
    const action = hetzner.actions['create-server']!;
    assert.throws(() => parseActionArgs(action, [], { name: 'test' }), /Missing required flag/);
  });

  it('should parse mixed positional and flag args', () => {
    const action = github.actions['create-issue']!;
    const result = parseActionArgs(action, ['SEKSBot', 'repo'], { title: 'Bug', body: 'Details' });
    assert.equal(result.path['owner'], 'SEKSBot');
    assert.equal(result.path['repo'], 'repo');
    assert.equal(result.body['title'], 'Bug');
    assert.equal(result.body['body'], 'Details');
  });

  it('should handle actions with no params', () => {
    const action = hetzner.actions['list-servers']!;
    const result = parseActionArgs(action, [], {});
    assert.deepEqual(result.path, {});
    assert.deepEqual(result.query, {});
    assert.deepEqual(result.body, {});
  });
});
