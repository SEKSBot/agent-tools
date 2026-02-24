#!/usr/bin/env node
/**
 * seks-wrangler — wrangler wrapper with Cloudflare secret injection via broker
 */

import { spawn } from 'node:child_process';
import { getClient } from '../client.js';

interface ParsedArgs {
  cwd?: string;
  wranglerArgs: string[];
}

function usage(): never {
  console.error(`Usage: seks-wrangler [--cwd <path>] <wrangler args...>

Wraps wrangler and injects CLOUDFLARE_API_TOKEN from the broker.
Also injects CLOUDFLARE_ACCOUNT_ID when available.

Special handling:
  seks-wrangler [--cwd <path>] secret put <name> --secret-value <broker_secret_name> [wrangler args...]
    Fetches <broker_secret_name> from broker and pipes it to wrangler stdin.

Examples:
  seks-wrangler whoami
  seks-wrangler deploy
  seks-wrangler --cwd ./workers/my-app dev
  seks-wrangler secret put API_KEY --secret-value CLOUDFLARE_MY_API_KEY

Options:
  --cwd <path>   Working directory for wrangler
  --help         Show this help`);
  process.exit(1);
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0 || argv[0] === '--help') usage();

  const wranglerArgs: string[] = [];
  let cwd: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--help') usage();
    if (arg === '--cwd') {
      cwd = argv[++i];
      if (!cwd) {
        console.error('Error: --cwd requires a value');
        usage();
      }
      continue;
    }
    wranglerArgs.push(arg);
  }

  if (wranglerArgs.length === 0) usage();
  return { cwd, wranglerArgs };
}

function extractSecretPutValue(args: string[]): { brokerSecretName?: string; wranglerArgs: string[] } {
  const isSecretPut = args[0] === 'secret' && args[1] === 'put' && !!args[2];
  if (!isSecretPut) {
    return { wranglerArgs: args };
  }

  const nextArgs: string[] = [];
  let brokerSecretName: string | undefined;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--secret-value') {
      brokerSecretName = args[++i];
      if (!brokerSecretName) {
        console.error('Error: --secret-value requires a broker secret name');
        process.exit(1);
      }
      continue;
    }
    nextArgs.push(arg);
  }

  return { brokerSecretName, wranglerArgs: nextArgs };
}

async function main() {
  const { cwd, wranglerArgs } = parseArgs(process.argv.slice(2));
  const { brokerSecretName, wranglerArgs: finalWranglerArgs } = extractSecretPutValue(wranglerArgs);
  const client = getClient();

  let apiToken = await client.getSecret('CLOUDFLARE_API_TOKEN');
  let accountId: string | undefined;
  try {
    accountId = await client.getSecret('CLOUDFLARE_ACCOUNT_ID');
  } catch {
    // Optional secret, skip silently.
  }

  let secretValue: string | undefined;
  if (brokerSecretName) {
    secretValue = await client.getSecret(brokerSecretName);
  }

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    CLOUDFLARE_API_TOKEN: apiToken,
  };
  if (accountId) {
    childEnv['CLOUDFLARE_ACCOUNT_ID'] = accountId;
  }

  const child = spawn('wrangler', finalWranglerArgs, {
    cwd,
    env: childEnv,
    stdio: brokerSecretName ? ['pipe', 'inherit', 'inherit'] : 'inherit',
  });

  if (brokerSecretName && child.stdin) {
    child.stdin.write(secretValue ?? '');
    child.stdin.end('\n');
  }

  child.on('error', (err) => {
    console.error(`Failed to start wrangler: ${err instanceof Error ? err.message : String(err)}`);
    delete childEnv['CLOUDFLARE_API_TOKEN'];
    delete childEnv['CLOUDFLARE_ACCOUNT_ID'];
    apiToken = '';
    accountId = undefined;
    secretValue = undefined;
    process.exit(1);
  });

  child.on('exit', (code, signal) => {
    delete childEnv['CLOUDFLARE_API_TOKEN'];
    delete childEnv['CLOUDFLARE_ACCOUNT_ID'];
    apiToken = '';
    accountId = undefined;
    secretValue = undefined;

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

main().catch((err: unknown) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
