const GATEWAY_URL_ENV = "VITE_LIVEAGENT_GATEWAY_URL";

function normalizeOrigin(value: unknown): string {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  try {
    const url = new URL(raw);
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.replace(/\/$/, "");
  }
}

function readConfiguredGatewayOrigin(): string {
  return normalizeOrigin(import.meta.env?.[GATEWAY_URL_ENV]);
}

export function getBrowserOrigin(): string {
  if (typeof window === "undefined") return "";
  const origin = window.location?.origin;
  if (typeof origin === "string" && origin.trim()) return origin;
  const href = window.location?.href;
  return typeof href === "string" && href.trim() ? new URL(href).origin : "";
}

export function getGatewayHttpOrigin(): string {
  return readConfiguredGatewayOrigin() || getBrowserOrigin();
}

export function getGatewayWebSocketOrigin(): string {
  const origin = getGatewayHttpOrigin();
  if (!origin) return "";
  const url = new URL(origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}
