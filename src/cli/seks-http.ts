#!/usr/bin/env node
/**
 * seks-http — HTTP client with credential injection via SEKS broker
 */

import { getClient } from '../client.js';

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface Options {
  method: string;
  url: string;
  headers: Record<string, string>;
  headerSecrets: { header: string; secret: string }[];
  authBearer?: string;
  authBasicUser?: string;
  authBasicPass?: string;
  capability?: string;
  data?: string;
  timeout: number;
}

function usage(): never {
  console.error(`Usage: seks-http <method> <url> [options]

Methods: get, post, put, patch, delete

Options:
  --auth-bearer <secret>           Bearer token from broker (provider/field)
  --auth-basic-user <secret>       Basic auth username from broker
  --auth-basic-pass <secret>       Basic auth password from broker
  --header-secret 'Header:secret'  Inject secret as header value
  --capability <provider/action>   Broker resolves credential
  --header 'Name: value'           Static header
  --data <body>                    Request body
  --timeout <seconds>              Request timeout (default: 30)
  --help                           Show this help`);
  process.exit(1);
}

function parseArgs(argv: string[]): Options {
  if (argv.length < 2) usage();

  const method = argv[0]!.toLowerCase();
  if (!(METHODS as readonly string[]).includes(method)) {
    console.error(`Unknown method: ${argv[0]}`);
    usage();
  }

  const url = argv[1]!;
  const opts: Options = { method: method.toUpperCase(), url, headers: {}, headerSecrets: [], timeout: 30 };

  let i = 2;
  while (i < argv.length) {
    const arg = argv[i]!;
    switch (arg) {
      case '--auth-bearer':
        opts.authBearer = argv[++i]; break;
      case '--auth-basic-user':
        opts.authBasicUser = argv[++i]; break;
      case '--auth-basic-pass':
        opts.authBasicPass = argv[++i]; break;
      case '--capability':
        opts.capability = argv[++i]; break;
      case '--header': {
        const h = argv[++i]!;
        const colon = h.indexOf(':');
        if (colon < 1) { console.error(`Invalid header: ${h}`); process.exit(1); }
        opts.headers[h.slice(0, colon).trim()] = h.slice(colon + 1).trim();
        break;
      }
      case '--header-secret': {
        const h = argv[++i]!;
        const colon = h.indexOf(':');
        if (colon < 1) { console.error(`Invalid header-secret: ${h}`); process.exit(1); }
        opts.headerSecrets.push({ header: h.slice(0, colon).trim(), secret: h.slice(colon + 1).trim() });
        break;
      }
      case '--data':
        opts.data = argv[++i]; break;
      case '--timeout':
        opts.timeout = parseInt(argv[++i]!, 10); break;
      case '--help':
        usage();
      default:
        console.error(`Unknown option: ${arg}`);
        usage();
    }
    i++;
  }

  return opts;
}

async function resolveSecret(secret: string): Promise<string> {
  const client = getClient();
  // Secret is a name like HETZNER_API_TOKEN or GITHUB_PERSONAL_ACCESS_TOKEN
  return client.getSecret(secret);
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const headers: Record<string, string> = { ...opts.headers };

  // Resolve capability first if provided
  if (opts.capability) {
    // Capability = provider/action, broker resolves which credential
    const client = getClient();
    const slash = opts.capability.indexOf('/');
    if (slash > 0) {
      const provider = opts.capability.slice(0, slash);
      // Use proxy request through broker which handles credential injection
      try {
        const urlObj = new URL(opts.url);
        const response = await client.proxyRequest(provider, urlObj.pathname + urlObj.search, {
          method: opts.method,
          headers,
          body: opts.data,
        });
        const body = await response.text();
        process.stderr.write(`${response.status} ${response.statusText}\n`);
        for (const [k, v] of response.headers.entries()) {
          process.stderr.write(`${k}: ${v}\n`);
        }
        process.stdout.write(body);
        return;
      } catch (err) {
        console.error(`Capability request failed: ${err}`);
        process.exit(1);
      }
    }
  }

  // Resolve auth
  if (opts.authBearer) {
    const token = await resolveSecret(opts.authBearer);
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (opts.authBasicUser || opts.authBasicPass) {
    const user = opts.authBasicUser ? await resolveSecret(opts.authBasicUser) : '';
    const pass = opts.authBasicPass ? await resolveSecret(opts.authBasicPass) : '';
    headers['Authorization'] = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
  }

  // Resolve header secrets
  for (const hs of opts.headerSecrets) {
    headers[hs.header] = await resolveSecret(hs.secret);
  }

  // Make request
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout * 1000);

    const response = await fetch(opts.url, {
      method: opts.method,
      headers,
      body: opts.data,
      signal: controller.signal,
    });

    clearTimeout(timer);

    // Status/headers to stderr
    process.stderr.write(`${response.status} ${response.statusText}\n`);
    for (const [k, v] of response.headers.entries()) {
      process.stderr.write(`${k}: ${v}\n`);
    }

    // Body to stdout
    const body = await response.arrayBuffer();
    process.stdout.write(Buffer.from(body));
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`Request timed out after ${opts.timeout}s`);
      process.exit(1);
    }
    console.error(`Request failed: ${err}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
