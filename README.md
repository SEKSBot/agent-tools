# @botsters/agent-tools

CLI tools for working with the Botsters broker, with runtime secret resolution for HTTP, Git, Wrangler, and provider-driven actions.

Carried forward from @seksbot/seks-tools. seks-wrangler designed by AeonByte.

## Install

```bash
npm install -g @botsters/agent-tools
```

## Configuration

Config is resolved in this order:

1. Environment variables: `BOTSTERS_BROKER_URL` + `BOTSTERS_BROKER_TOKEN` (fallback: `SEKS_BROKER_URL` + `SEKS_BROKER_TOKEN`)
2. `~/.openclaw/openclaw.json`: `botsters.broker.primary` / `botsters.broker.secondary` (fallback: `seks.broker.*`)
3. `~/.openclaw/openclaw.json`: `botsters.broker.url` / `botsters.broker.token` legacy shape (fallback: `seks.broker.*`)

## Tools

### `seks-http`

HTTP client wrapper that resolves auth material from broker secrets.

```bash
# Bearer auth from broker secret
seks-http get https://api.github.com/user --auth-bearer GITHUB_PERSONAL_ACCESS_TOKEN

# Basic auth from broker secrets
seks-http get https://api.example.com/secure \
  --auth-basic-user SERVICE_USERNAME \
  --auth-basic-pass SERVICE_PASSWORD

# Custom header secret injection
seks-http get https://api.example.com/data \
  --header-secret 'X-API-Key:MY_API_KEY'

# Capability-based request routing
seks-http get https://api.github.com/repos --capability github/read
```

### `seks-git`

Git wrapper that injects broker token secrets into HTTPS-authenticated workflows.

```bash
seks-git clone https://github.com/org/repo.git --auth-token GITHUB_PERSONAL_ACCESS_TOKEN
seks-git push --auth-token GITHUB_PERSONAL_ACCESS_TOKEN
seks-git pull origin main --auth-token GITHUB_PERSONAL_ACCESS_TOKEN
```

### `seks-wrangler`

Wrangler wrapper that fetches Cloudflare credentials from the broker and runs `wrangler` with injected env vars.

- Always fetches `CLOUDFLARE_API_TOKEN`
- Injects `CLOUDFLARE_ACCOUNT_ID` when available
- Supports `--cwd <path>`
- Special `secret put` mode: `--secret-value <broker_secret_name>` resolves from broker and pipes to wrangler stdin

```bash
seks-wrangler whoami
seks-wrangler deploy
seks-wrangler --cwd ./workers/site dev
seks-wrangler secret put API_KEY --secret-value CLOUDFLARE_MY_API_KEY
```

### `listseks`

Discovery command for secrets/capabilities exposed through the broker.

```bash
listseks
listseks --capabilities
listseks --provider github
listseks --json
```

### `do-seks`

Capability-first provider command runner for supported integrations.

```bash
do-seks providers
do-seks github actions
do-seks github repos/list my-org --json
do-seks cloudflare zones/list --verbose
```

## Development

```bash
pnpm install
pnpm build
pnpm test
```
