import { ProviderSchema, Action, ParamDef } from './types.js';
import { getClient } from '../client.js';

export interface ResolvedParams {
  path: Record<string, string>;
  query: Record<string, string>;
  body: Record<string, string>;
}

export interface ExecuteOptions {
  json: boolean;
  verbose: boolean;
  dryRun: boolean;
}

/**
 * Parse positional args and flags into resolved params for an action.
 */
export function parseActionArgs(action: Action, args: string[], flags: Record<string, string>): ResolvedParams {
  const result: ResolvedParams = { path: {}, query: {}, body: {} };
  const params = action.params ?? [];

  // Resolve positional params
  const positionals = params.filter(p => p.position !== undefined).sort((a, b) => a.position! - b.position!);
  for (const p of positionals) {
    const val = args[p.position!];
    if (val !== undefined) {
      result[p.location][p.name] = val;
    } else if (p.required) {
      throw new Error(`Missing required positional argument: ${p.name} (position ${p.position})`);
    }
  }

  // Resolve flag params
  for (const p of params) {
    if (p.flag) {
      const flagName = p.flag.replace(/^--/, '');
      const val = flags[flagName];
      if (val !== undefined) {
        result[p.location][p.name] = val;
      } else if (p.required && result[p.location][p.name] === undefined) {
        throw new Error(`Missing required flag: ${p.flag}`);
      }
    }
  }

  return result;
}

/**
 * Build the full URL with path param substitution.
 */
export function buildUrl(baseUrl: string, pathTemplate: string, pathParams: Record<string, string>): string {
  let path = pathTemplate;
  for (const [key, value] of Object.entries(pathParams)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }
  return baseUrl + path;
}

/**
 * Execute an action against a provider.
 */
export async function execute(
  schema: ProviderSchema,
  action: Action,
  params: ResolvedParams,
  opts: ExecuteOptions,
): Promise<void> {
  // Handle GIT method (clone delegation)
  if (action.method === 'GIT') {
    await executeGit(schema, action, params, opts);
    return;
  }

  const url = buildUrl(schema.baseUrl, action.path, params.path);

  // Build query string
  const urlObj = new URL(url);
  for (const [k, v] of Object.entries(params.query)) {
    urlObj.searchParams.set(k, v);
  }

  // Build body
  let bodyStr: string | undefined;
  if (action.body === 'json' && Object.keys(params.body).length > 0) {
    bodyStr = JSON.stringify(params.body);
  }

  // Resolve auth
  const client = getClient();
  const secret = await client.getSecret(schema.authPattern.secretName);

  const headers: Record<string, string> = {};
  if (schema.authPattern.type === 'bearer') {
    headers['Authorization'] = `Bearer ${secret}`;
  } else if (schema.authPattern.type === 'header') {
    headers[schema.authPattern.headerName!] = secret;
  } else if (schema.authPattern.type === 'basic') {
    headers['Authorization'] = `Basic ${Buffer.from(secret).toString('base64')}`;
  }

  if (bodyStr) {
    headers['Content-Type'] = 'application/json';
  }

  // GitHub wants User-Agent
  if (schema.name === 'github') {
    headers['User-Agent'] = 'do-seks/1.0';
  }

  if (opts.verbose) {
    process.stderr.write(`${action.method} ${urlObj.toString()}\n`);
    for (const [k, v] of Object.entries(headers)) {
      if (k === 'Authorization') {
        process.stderr.write(`${k}: ${v.slice(0, 15)}...\n`);
      } else {
        process.stderr.write(`${k}: ${v}\n`);
      }
    }
    if (bodyStr) process.stderr.write(`Body: ${bodyStr}\n`);
  }

  if (opts.dryRun) {
    const info = {
      method: action.method,
      url: urlObj.toString(),
      headers: Object.fromEntries(
        Object.entries(headers).map(([k, v]) =>
          k === 'Authorization' ? [k, v.slice(0, 15) + '...'] : [k, v]
        )
      ),
      body: bodyStr ? JSON.parse(bodyStr) : undefined,
    };
    process.stdout.write(JSON.stringify(info, null, 2) + '\n');
    return;
  }

  // Execute request
  const response = await fetch(urlObj.toString(), {
    method: action.method,
    headers,
    body: bodyStr,
  });

  if (opts.verbose) {
    process.stderr.write(`${response.status} ${response.statusText}\n`);
  }

  const text = await response.text();

  if (!response.ok) {
    process.stderr.write(`Error ${response.status}: ${response.statusText}\n`);
    process.stderr.write(text + '\n');
    process.exit(1);
  }

  // Output
  if (opts.json) {
    // Pretty-print JSON
    try {
      process.stdout.write(JSON.stringify(JSON.parse(text), null, 2) + '\n');
    } catch {
      process.stdout.write(text + '\n');
    }
  } else {
    // Try to format as table
    try {
      const data = JSON.parse(text);
      const formatted = formatResponse(data, schema.name, action);
      process.stdout.write(formatted + '\n');
    } catch {
      process.stdout.write(text + '\n');
    }
  }
}

async function executeGit(
  schema: ProviderSchema,
  action: Action,
  params: ResolvedParams,
  opts: ExecuteOptions,
): Promise<void> {
  const owner = params.path['owner'];
  const repo = params.path['repo'];
  const dest = params.body['dest'] || repo;
  const repoUrl = `https://github.com/${owner}/${repo}.git`;

  if (opts.dryRun) {
    process.stdout.write(JSON.stringify({ command: 'seks-git', args: ['clone', repoUrl, dest] }, null, 2) + '\n');
    return;
  }

  if (opts.verbose) {
    process.stderr.write(`seks-git clone ${repoUrl} ${dest}\n`);
  }

  const { execFileSync } = await import('node:child_process');
  try {
    execFileSync('seks-git', ['clone', repoUrl, dest], { stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}

/**
 * Format API response as a human-readable table.
 */
function formatResponse(data: unknown, provider: string, action: Action): string {
  // Unwrap common API patterns
  let items: unknown[] | undefined;
  if (Array.isArray(data)) {
    items = data;
  } else if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Hetzner wraps in e.g. { servers: [...] }, Cloudflare in { result: [...] }
    for (const key of ['servers', 'ssh_keys', 'images', 'result', 'zones', 'dns_records']) {
      if (Array.isArray(obj[key])) {
        items = obj[key] as unknown[];
        break;
      }
    }
    if (!items) {
      // Single object response
      return JSON.stringify(data, null, 2);
    }
  }

  if (!items || items.length === 0) {
    return '(no results)';
  }

  // Pick columns based on provider/action
  const columns = pickColumns(provider, action);
  if (!columns) {
    return JSON.stringify(items, null, 2);
  }

  return formatTable(items as Record<string, unknown>[], columns);
}

function pickColumns(provider: string, action: Action): { key: string; label: string }[] | null {
  const actionName = Object.entries({
    'servers.list': [
      { key: 'name', label: 'NAME' },
      { key: 'status', label: 'STATUS' },
      { key: 'public_net.ipv4.ip', label: 'IP' },
      { key: 'server_type.name', label: 'TYPE' },
      { key: 'datacenter.name', label: 'DATACENTER' },
    ],
    'ssh-keys.list': [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'NAME' },
      { key: 'fingerprint', label: 'FINGERPRINT' },
    ],
    'images.list': [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'NAME' },
      { key: 'type', label: 'TYPE' },
      { key: 'status', label: 'STATUS' },
    ],
    'repos.list': [
      { key: 'full_name', label: 'REPO' },
      { key: 'private', label: 'PRIVATE' },
      { key: 'language', label: 'LANG' },
      { key: 'updated_at', label: 'UPDATED' },
    ],
    'issues.list': [
      { key: 'number', label: '#' },
      { key: 'title', label: 'TITLE' },
      { key: 'state', label: 'STATE' },
      { key: 'user.login', label: 'AUTHOR' },
    ],
    'zones.list': [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'NAME' },
      { key: 'status', label: 'STATUS' },
    ],
    'dns.list': [
      { key: 'id', label: 'ID' },
      { key: 'type', label: 'TYPE' },
      { key: 'name', label: 'NAME' },
      { key: 'content', label: 'CONTENT' },
    ],
  }).find(([cap]) => cap === action.capability);

  return actionName ? actionName[1] : null;
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return '';
    }
  }
  return current === undefined || current === null ? '' : String(current);
}

function formatTable(items: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const widths = columns.map(c => c.label.length);
  const rows = items.map(item =>
    columns.map((c, i) => {
      const val = getNestedValue(item, c.key);
      widths[i] = Math.max(widths[i]!, val.length);
      return val;
    })
  );

  const header = columns.map((c, i) => c.label.padEnd(widths[i]!)).join('  ');
  const body = rows.map(row => row.map((v, i) => v.padEnd(widths[i]!)).join('  ')).join('\n');
  return header + '\n' + body;
}
