# API-only WebUI backend

This mode keeps the original LiveAgent WebUI and uses serverless API endpoints instead of the LiveAgent Gateway ⇄ desktop Agent relay.

It provides Vercel-compatible serverless endpoints at the repository root:

- `GET /api/status` returns a lightweight web-only health payload.
- `POST /api/chat` forwards chat completion requests to an OpenAI-compatible API. Set `stream: true` to receive SSE `thinking`, `token`, and `done` events.
- `POST /api/models` fetches model IDs through the backend so the original settings UI can refresh models without Gateway.

## Required environment variables

Set these on the hosting platform:

- `OPENAI_API_KEY` or `OPENAI_COMPATIBLE_API_KEY`: API key used by the backend endpoint. The backend also accepts `OPENAI_KEY`, `LLM_API_KEY`, `VITE_OPENAI_API_KEY`, and `VITE_OPENAI_COMPATIBLE_API_KEY` for Vercel projects that already use those names.
- `OPENAI_BASE_URL`: optional OpenAI-compatible base URL, defaults to `https://api.openai.com/v1`. The backend also accepts `OPENAI_COMPATIBLE_BASE_URL`, `LLM_BASE_URL`, `VITE_OPENAI_BASE_URL`, and `VITE_OPENAI_COMPATIBLE_BASE_URL`.
- `OPENAI_MODEL`: optional default model, defaults to `gpt-4.1-mini`.

For the bundled Vercel WebUI build, keep these front-end build flags enabled so the original UI does not attempt desktop/Gateway-only paths:

- `VITE_DISABLE_GATEWAY_WEBSOCKET=1`
- `VITE_DISABLE_MANAGED_PROCESS=1`
- `VITE_DISABLE_MONACO=1`

You can verify what the serverless function can see by opening `/api/status`; it returns `apiKeyConfigured`, `apiKeySource`, and `openaiBaseUrlSource` without exposing the secret.

## Example request

```bash
curl -X POST https://your-app.vercel.app/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Hello","model":"gpt-4.1-mini"}'
```

## Streaming responses

When the original WebUI runs with `VITE_DISABLE_GATEWAY_WEBSOCKET=1`, chat requests are sent to `/api/chat` with `stream: true`. The endpoint proxies upstream SSE chunks and emits:

- `thinking` for provider reasoning fields such as `reasoning_content`, `reasoning`, or `thinking`.
- `token` for visible assistant text.
- `done` when the upstream sends `[DONE]` or the stream closes.

The UI can only show thinking content when the selected OpenAI-compatible provider exposes it; hidden chain-of-thought that the provider does not return cannot be displayed.

## Important limitations

This backend intentionally bypasses Gateway and desktop Agent communication. It does not provide local-file,
terminal, tunnel, managed-process, or workspace-agent tools. Those capabilities require separate server-side API
implementations.

The original LiveAgent WebUI remains the default UI. Use `/api/chat`, `/api/models`, and `/api/status` as the backend surface, and keep
`VITE_DISABLE_GATEWAY_WEBSOCKET=1`, `VITE_DISABLE_MANAGED_PROCESS=1`, and `VITE_DISABLE_MONACO=1` for hosted
API-only builds so no browser WebSocket is constructed.
