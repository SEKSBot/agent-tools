import { ProviderSchema } from './types.js';

export const hetzner: ProviderSchema = {
  name: "hetzner",
  displayName: "Hetzner Cloud",
  baseUrl: "https://api.hetzner.cloud/v1",
  authPattern: { type: "bearer", secretName: "HETZNER_API_TOKEN" },
  actions: {
    "list-servers": {
      description: "List all servers",
      method: "GET",
      path: "/servers",
      capability: "servers.list",
    },
    "get-server": {
      description: "Get server details",
      method: "GET",
      path: "/servers/{id}",
      capability: "servers.read",
      params: [
        { name: "id", position: 0, required: true, location: "path" },
      ],
    },
    "create-server": {
      description: "Create a new server",
      method: "POST",
      path: "/servers",
      capability: "servers.create",
      body: "json",
      params: [
        { name: "name", flag: "--name", required: true, location: "body" },
        { name: "server_type", flag: "--type", required: true, location: "body" },
        { name: "image", flag: "--image", required: true, location: "body" },
      ],
    },
    "delete-server": {
      description: "Delete a server",
      method: "DELETE",
      path: "/servers/{id}",
      capability: "servers.delete",
      params: [
        { name: "id", position: 0, required: true, location: "path" },
      ],
    },
    "list-ssh-keys": {
      description: "List all SSH keys",
      method: "GET",
      path: "/ssh_keys",
      capability: "ssh-keys.list",
    },
    "list-images": {
      description: "List all images",
      method: "GET",
      path: "/images",
      capability: "images.list",
    },
  },
};
