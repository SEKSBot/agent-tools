import { ProviderSchema } from './types.js';
import { hetzner } from './hetzner.js';
import { github } from './github.js';
import { cloudflare } from './cloudflare.js';

const providers: Map<string, ProviderSchema> = new Map();

function register(schema: ProviderSchema) {
  providers.set(schema.name, schema);
}

register(hetzner);
register(github);
register(cloudflare);

export function getProvider(name: string): ProviderSchema | undefined {
  return providers.get(name);
}

export function listProviders(): ProviderSchema[] {
  return Array.from(providers.values());
}
