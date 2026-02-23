/**
 * Config resolution for agent-tools CLIs.
 * 
 * Order:
 * 1. Env vars (BOTSTERS_BROKER_URL + BOTSTERS_BROKER_TOKEN, fallback to SEKS_BROKER_*)
 * 2. ~/.openclaw/openclaw.json → botsters.broker.primary / botsters.broker.secondary (fallback: seks.broker.*)
 * 3. ~/.openclaw/openclaw.json → botsters.broker.url / botsters.broker.token (legacy, fallback: seks.broker.*)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { BrokerConfig } from '@botsters/broker-client';

export function loadConfig(): BrokerConfig {
  // 1. Env vars
  const envUrl = process.env['BOTSTERS_BROKER_URL'] ?? process.env['SEKS_BROKER_URL'];
  const envToken = process.env['BOTSTERS_BROKER_TOKEN'] ?? process.env['SEKS_BROKER_TOKEN'];
  if (envUrl && envToken) {
    return { primary: { url: envUrl, token: envToken } };
  }

  // 2-3. openclaw.json
  const configPath = join(homedir(), '.openclaw', 'openclaw.json');
  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    throw new Error(
      'No broker config found. Set BOTSTERS_BROKER_URL + BOTSTERS_BROKER_TOKEN (or SEKS_BROKER_URL + SEKS_BROKER_TOKEN) or configure ~/.openclaw/openclaw.json'
    );
  }

  const json = JSON.parse(raw) as Record<string, unknown>;
  const botsters = json['botsters'] as Record<string, unknown> | undefined;
  const seks = json['seks'] as Record<string, unknown> | undefined;
  const broker =
    (botsters?.['broker'] as Record<string, unknown> | undefined) ??
    (seks?.['broker'] as Record<string, unknown> | undefined);
  if (!broker) {
    throw new Error('No botsters.broker or seks.broker section in ~/.openclaw/openclaw.json');
  }

  // Primary/secondary pattern
  const primary = broker['primary'] as { url?: string; token?: string; tokenCommand?: string } | undefined;
  if (primary?.url && (primary.token || primary.tokenCommand)) {
    const config: BrokerConfig = {
      primary: { url: primary.url, ...(primary.token ? { token: primary.token } : { tokenCommand: primary.tokenCommand! }) },
    };
    const secondary = broker['secondary'] as { url?: string; token?: string; tokenCommand?: string } | undefined;
    if (secondary?.url && (secondary.token || secondary.tokenCommand)) {
      config.secondary = { url: secondary.url, ...(secondary.token ? { token: secondary.token } : { tokenCommand: secondary.tokenCommand! }) };
    }
    return config;
  }

  // Legacy single-broker
  const url = broker['url'] as string | undefined;
  const token = broker['token'] as string | undefined;
  if (url && token) {
    return { primary: { url, token } };
  }

  throw new Error('Invalid botsters.broker/seks.broker config in ~/.openclaw/openclaw.json');
}
