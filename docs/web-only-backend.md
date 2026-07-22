# Web-only backend mode

This mode is for deployments that do **not** use the LiveAgent Gateway ⇄ desktop Agent relay.

It provides Vercel-compatible serverless endpoints at the repository root:

- `GET /api/status` returns a lightweight web-only health payload.
- `POST /api/chat` forwards a non-streaming chat completion request to an OpenAI-compatible API.

## Required environment variables

Set these on the hosting platform:

- `OPENAI_API_KEY` or `OPENAI_COMPATIBLE_API_KEY`: API key used by the backend endpoint.
- `OPENAI_BASE_URL`: optional OpenAI-compatible base URL, defaults to `https://api.openai.com/v1`.
- `OPENAI_MODEL`: optional default model, defaults to `gpt-4.1-mini`.

## Example request

```bash
curl -X POST https://your-app.vercel.app/api/chat \
  -H 'content-type: application/json' \
  -d '{"message":"Hello","model":"gpt-4.1-mini"}'
```

## Important limitations

This backend intentionally bypasses Gateway and desktop Agent communication. It does not provide local-file,
terminal, tunnel, managed-process, or workspace-agent tools. Those capabilities require a real Agent runtime or a
future server-side Agent implementation.

The existing full LiveAgent WebUI still contains Gateway-oriented flows. Use these endpoints as the backend surface for
web-only integration, and keep `VITE_DISABLE_MANAGED_PROCESS=1` / `VITE_DISABLE_MONACO=1` for hosted lightweight builds.
