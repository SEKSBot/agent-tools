#!/usr/bin/env node
/**
 * do-seks — Capability-first CLI for agents to interact with external services.
 */

import { getProvider, listProviders } from '../providers/registry.js';
import { parseActionArgs, execute, ExecuteOptions } from '../providers/executor.js';

function usage(): never {
  console.error(`Usage: do-seks <provider> <action> [args...] [flags]

Discovery:
  do-seks providers                List available providers
  do-seks <provider> actions       List actions for a provider
  do-seks <provider> <action> --help  Show action details

Global flags:
  --json       JSON output (default for API responses)
  --verbose    Show request details on stderr
  --dry-run    Show what would happen without executing
  --help       Show this help`);
  process.exit(1);
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help') usage();

  // Parse global flags
  const globalFlags: ExecuteOptions = { json: false, verbose: false, dryRun: false };
  const remaining: string[] = [];
  for (const arg of argv) {
    switch (arg) {
      case '--json': globalFlags.json = true; break;
      case '--verbose': globalFlags.verbose = true; break;
      case '--dry-run': globalFlags.dryRun = true; break;
      default: remaining.push(arg);
    }
  }

  const command = remaining[0]!;

  // "providers" command
  if (command === 'providers') {
    const providers = listProviders();
    console.log('PROVIDER     DESCRIPTION');
    for (const p of providers) {
      console.log(`${p.name.padEnd(13)}${p.displayName}`);
    }
    return;
  }

  // Look up provider
  const schema = getProvider(command);
  if (!schema) {
    console.error(`Unknown provider: ${command}`);
    console.error(`Run 'do-seks providers' to see available providers.`);
    process.exit(1);
  }

  const actionName = remaining[1];

  // "<provider> actions" or no action
  if (!actionName || actionName === 'actions') {
    console.log(`Actions for ${schema.displayName}:\n`);
    console.log('ACTION           DESCRIPTION');
    for (const [name, action] of Object.entries(schema.actions)) {
      console.log(`${name.padEnd(17)}${action.description}`);
    }
    return;
  }

  const action = schema.actions[actionName];
  if (!action) {
    console.error(`Unknown action: ${actionName} for provider ${schema.name}`);
    console.error(`Run 'do-seks ${schema.name} actions' to see available actions.`);
    process.exit(1);
  }

  // Parse remaining args (after provider and action)
  const actionArgv = remaining.slice(2);

  // Check for --help on action
  if (actionArgv.includes('--help')) {
    console.log(`${schema.name} ${actionName} — ${action.description}\n`);
    console.log(`Method: ${action.method}`);
    console.log(`Path:   ${action.path}`);
    if (action.params && action.params.length > 0) {
      console.log(`\nParameters:`);
      for (const p of action.params) {
        const pos = p.position !== undefined ? `(positional ${p.position})` : '';
        const flag = p.flag ?? '';
        const req = p.required ? 'required' : 'optional';
        console.log(`  ${(flag || p.name).padEnd(15)} ${req.padEnd(10)} ${pos} [${p.location}]`);
      }
    }
    return;
  }

  // Split into positional args and flags
  const positionalArgs: string[] = [];
  const flags: Record<string, string> = {};
  let i = 0;
  while (i < actionArgv.length) {
    const arg = actionArgv[i]!;
    if (arg.startsWith('--')) {
      const flagName = arg.slice(2);
      flags[flagName] = actionArgv[++i] ?? '';
    } else {
      positionalArgs.push(arg);
    }
    i++;
  }

  // Handle "owner/repo" shorthand for github — split into two positional args
  if (schema.name === 'github' && positionalArgs.length === 1 && positionalArgs[0]!.includes('/')) {
    const [owner, repo] = positionalArgs[0]!.split('/', 2);
    positionalArgs[0] = owner!;
    positionalArgs.splice(1, 0, repo!);
  }

  try {
    const params = parseActionArgs(action, positionalArgs, flags);
    execute(schema, action, params, globalFlags).catch(err => {
      console.error(`Error: ${err}`);
      process.exit(1);
    });
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}

main();
