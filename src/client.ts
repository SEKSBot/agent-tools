/**
 * Shared broker client factory for CLI tools.
 */

import { BrokerClient } from '@botsters/broker-client';
import { loadConfig } from './config.js';

let _client: BrokerClient | undefined;

export function getClient(): BrokerClient {
  if (!_client) {
    _client = new BrokerClient(loadConfig());
  }
  return _client;
}
