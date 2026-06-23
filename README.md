# HookInspect

[![Netlify Status](https://api.netlify.com/api/v1/badges/f7075444-21aa-43f3-b6c8-036ffc24ec8b/deploy-status)](https://app.netlify.com/projects/hookinspect/deploys)
[![ko-fi](https://img.shields.io/badge/Support%20me%20on%20Ko--fi-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/T7Q321QA0O)

A free, open-source webhook testing tool. Generate a unique URL, send HTTP requests to it, and inspect the full details — headers, body, query parameters — in real time.

**Live demo:** [hookinspect.netlify.app](https://hookinspect.netlify.app)

![HookInspect screenshot](https://placehold.co/900x500/f8fafc/4f46e5?text=HookInspect)

---

## Features

- **Instant webhook URL** — create a unique endpoint in one click, no sign-up required
- **All HTTP methods** — GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, and more
- **Full request inspection** — headers table, body with JSON pretty-print, query params, raw HTTP view
- **Auto-refresh** — new requests appear automatically via polling (every 3 seconds)
- **Persistent requests** — captured requests are cached in `localStorage` and survive tab/browser closes
- **Recent Webhooks** — index page shows up to 10 previously visited endpoints with pagination (4 per page)
- **Copy helpers** — copy the webhook URL, body, or raw request with one click
- **Responsive** — works on desktop, tablet, and mobile

## Tech Stack

| Layer    | Technology                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------ |
| Frontend | Vanilla HTML / CSS / JavaScript (no framework, no build step)                                    |
| Backend  | [Netlify Functions v2](https://docs.netlify.com/functions/overview/) (Node.js 18+)               |
| Storage  | [Netlify Blobs](https://docs.netlify.com/blobs/overview/) (site-scoped, persists across deploys) |
| Hosting  | [Netlify](https://netlify.com)                                                                   |

## Project Structure

```
hookinspect/
├── netlify/
│   └── functions/
│       ├── new.js          # POST /api/new — create endpoint
│       ├── receive.js      # * /r/*       — capture incoming webhooks
│       └── requests.js     # GET/DELETE /api/requests/:endpointId
├── public/                 # Static files (served as-is, no build)
│   ├── index.html          # Landing page
│   ├── inspector.html      # Webhook inspector page
│   ├── style.css           # All styles
│   ├── index.js            # Landing page logic + recent webhooks history
│   ├── inspector.js        # Inspector logic: polling, tabs, copy, localStorage
│   └── favicon.svg
├── netlify.toml            # Build config + redirects
└── package.json
```

## Local Development

Requires [Netlify CLI](https://docs.netlify.com/cli/get-started/) because Netlify Blobs (storage) only works inside the Netlify runtime.

```bash
# 1. Install Netlify CLI globally
npm install -g netlify-cli

# 2. Clone and install dependencies
git clone https://github.com/cibofdevs/hookinspect.git
cd hookinspect
npm install

# 3. Log in to Netlify (first time only)
netlify login

# 4. Start the dev server
netlify dev
```

The app will be available at `http://localhost:8888`.

> **Note:** Blobs data is stored locally under `.netlify/blobs-serve/` during development. This directory is git-ignored.

## API Reference

| Method   | Path                        | Description                                                                            |
| -------- | --------------------------- | -------------------------------------------------------------------------------------- |
| `POST`   | `/api/new`                  | Create a new webhook endpoint. Returns `{ id, createdAt }`.                            |
| `*`      | `/r/:id`                    | Receive a webhook. Accepts any HTTP method and path. Returns `{ status: "received" }`. |
| `GET`    | `/api/requests/:endpointId` | List all captured requests for an endpoint (newest first, max 100).                    |
| `DELETE` | `/api/requests/:endpointId` | Delete all captured requests for an endpoint.                                          |

### Example — send a test webhook

```bash
curl -X POST https://hookinspect.netlify.app/r/YOUR_ENDPOINT_ID \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "id": 42}'
```

## Storage Limits

| Item                      | Limit                                           |
| ------------------------- | ----------------------------------------------- |
| Requests per endpoint     | 100 (oldest are trimmed automatically)          |
| Request body size         | 100 KB (truncated if exceeded)                  |
| Recent Webhooks history   | 10 endpoints (stored in browser `localStorage`) |
| Netlify Blobs (free tier) | 1 GB included                                   |

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

```bash
# Run locally
netlify dev

# Lint / format — no toolchain configured yet, just keep style consistent
```

## License

[MIT](LICENSE)

---

Made by **Ahmad Wijaya** — [@cibofdevs](https://github.com/cibofdevs)
