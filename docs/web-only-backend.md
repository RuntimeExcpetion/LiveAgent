# API-only WebUI backend

This mode keeps the original LiveAgent WebUI and uses serverless API endpoints instead of the LiveAgent Gateway ⇄ desktop Agent relay.

It provides Vercel-compatible serverless endpoints at the repository root:

- `GET /api/status` returns a lightweight web-only health payload.
- `POST /api/chat` forwards a non-streaming chat completion request to an OpenAI-compatible API.
- `POST /api/models` fetches model IDs through the backend so the original settings UI can refresh models without Gateway.

## Required environment variables

Set these on the hosting platform:

- `OPENAI_API_KEY` or `OPENAI_COMPATIBLE_API_KEY`: API key used by the backend endpoint.
- `OPENAI_BASE_URL`: optional OpenAI-compatible base URL, defaults to `https://api.openai.com/v1`.
- `OPENAI_MODEL`: optional default model, defaults to `gpt-4.1-mini`.

For the bundled Vercel WebUI build, keep these front-end build flags enabled so the original UI does not attempt desktop/Gateway-only paths:

- `VITE_DISABLE_GATEWAY_WEBSOCKET=1`
- `VITE_DISABLE_MANAGED_PROCESS=1`
- `VITE_DISABLE_MONACO=1`

## Example request

```bash
curl -X POST https://your-app.vercel.app/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Hello","model":"gpt-4.1-mini"}'
```

## Important limitations

This backend intentionally bypasses Gateway and desktop Agent communication. It does not provide local-file,
terminal, tunnel, managed-process, or workspace-agent tools. Those capabilities require separate server-side API
implementations.

The original LiveAgent WebUI remains the default UI. Use `/api/chat`, `/api/models`, and `/api/status` as the backend surface, and keep
`VITE_DISABLE_GATEWAY_WEBSOCKET=1`, `VITE_DISABLE_MANAGED_PROCESS=1`, and `VITE_DISABLE_MONACO=1` for hosted
API-only builds so no browser WebSocket is constructed.
