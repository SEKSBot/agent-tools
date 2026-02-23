#!/usr/bin/env node
/**
 * seks-git — git wrapper with credential injection via SEKS broker
 */

import { execFileSync } from 'node:child_process';
import { getClient } from '../client.js';

function usage(): never {
  console.error(`Usage: seks-git <command> [args...] --auth-token <secret>

Commands: clone, push, pull (and any other git command)

Options:
  --auth-token <secret>   Token from broker (provider/field format)
                          Injected as x-access-token in HTTPS URLs

Examples:
  seks-git clone https://github.com/org/repo.git --auth-token github/pat
  seks-git push --auth-token github/pat
  seks-git pull origin main --auth-token github/pat`);
  process.exit(1);
}

async function resolveSecret(secret: string): Promise<string> {
  const client = getClient();
  return client.getSecret(secret);
}

function injectTokenIntoUrl(url: string, token: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      parsed.username = 'x-access-token';
      parsed.password = token;
      return parsed.toString();
    }
  } catch {
    // Not a URL, return as-is
  }
  return url;
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help') usage();

  // Extract --auth-token from args
  let authSecret: string | undefined;
  const gitArgs: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--auth-token') {
      authSecret = argv[++i];
    } else {
      gitArgs.push(argv[i]!);
    }
  }

  if (!authSecret) {
    console.error('Error: --auth-token is required');
    usage();
  }

  const token = await resolveSecret(authSecret);
  const command = gitArgs[0];

  // For clone, inject token into the URL argument
  if (command === 'clone') {
    for (let i = 1; i < gitArgs.length; i++) {
      if (!gitArgs[i]!.startsWith('-')) {
        gitArgs[i] = injectTokenIntoUrl(gitArgs[i]!, token);
        break;
      }
    }
  }

  // For push/pull, configure credential helper via env
  // Set GIT_ASKPASS to inject credentials
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
  };

  if (command === 'push' || command === 'pull' || command === 'fetch') {
    // Use -c to set the URL rewrite with credentials
    // We'll use GIT_CONFIG_COUNT approach for credential injection
    const configArgs = [
      '-c', `http.extraHeader=Authorization: Basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`,
    ];
    gitArgs.splice(1, 0, ...configArgs);
  }

  try {
    execFileSync('git', gitArgs, {
      stdio: 'inherit',
      env,
    });
  } catch (err: unknown) {
    const code = (err as { status?: number }).status ?? 1;
    process.exit(code);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
