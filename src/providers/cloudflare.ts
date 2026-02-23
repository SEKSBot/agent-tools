import { ProviderSchema } from './types.js';

export const cloudflare: ProviderSchema = {
  name: "cloudflare",
  displayName: "Cloudflare",
  baseUrl: "https://api.cloudflare.com/client/v4",
  authPattern: { type: "bearer", secretName: "CLOUDFLARE_API_TOKEN" },
  actions: {
    "list-zones": {
      description: "List all zones",
      method: "GET",
      path: "/zones",
      capability: "zones.list",
    },
    "dns-list": {
      description: "List DNS records for a zone",
      method: "GET",
      path: "/zones/{zone_id}/dns_records",
      capability: "dns.list",
      params: [
        { name: "zone_id", flag: "--zone", required: true, location: "path" },
      ],
    },
    "dns-add": {
      description: "Add a DNS record",
      method: "POST",
      path: "/zones/{zone_id}/dns_records",
      capability: "dns.write",
      body: "json",
      params: [
        { name: "zone_id", flag: "--zone", required: true, location: "path" },
        { name: "type", flag: "--type", required: true, location: "body" },
        { name: "name", flag: "--name", required: true, location: "body" },
        { name: "content", flag: "--content", required: true, location: "body" },
      ],
    },
    "dns-delete": {
      description: "Delete a DNS record",
      method: "DELETE",
      path: "/zones/{zone_id}/dns_records/{id}",
      capability: "dns.delete",
      params: [
        { name: "zone_id", flag: "--zone", required: true, location: "path" },
        { name: "id", position: 0, required: true, location: "path" },
      ],
    },
  },
};
