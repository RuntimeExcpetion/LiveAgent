const API_KEY_ENV_NAMES = [
  "OPENAI_API_KEY",
  "OPENAI_COMPATIBLE_API_KEY",
  "OPENAI_KEY",
  "LLM_API_KEY",
  "VITE_OPENAI_API_KEY",
  "VITE_OPENAI_COMPATIBLE_API_KEY",
];

const BASE_URL_ENV_NAMES = [
  "OPENAI_BASE_URL",
  "OPENAI_COMPATIBLE_BASE_URL",
  "LLM_BASE_URL",
  "VITE_OPENAI_BASE_URL",
  "VITE_OPENAI_COMPATIBLE_BASE_URL",
];

function firstConfiguredEnv(names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) return { name, value };
  }
  return null;
}

function resolveProviderApiKey(requestValue) {
  const explicit = String(requestValue || "").trim();
  if (explicit) return { source: "request", value: explicit };
  const env = firstConfiguredEnv(API_KEY_ENV_NAMES);
  return env ? { source: env.name, value: env.value } : null;
}

function resolveProviderBaseUrl(requestValue, fallback = "https://api.openai.com/v1") {
  const explicit = String(requestValue || "").trim();
  if (explicit) return { source: "request", value: explicit };
  const env = firstConfiguredEnv(BASE_URL_ENV_NAMES);
  return env ? { source: env.name, value: env.value } : { source: "default", value: fallback };
}

module.exports = {
  API_KEY_ENV_NAMES,
  BASE_URL_ENV_NAMES,
  resolveProviderApiKey,
  resolveProviderBaseUrl,
};
