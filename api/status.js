const { resolveProviderApiKey, resolveProviderBaseUrl } = require("./providerEnv.js");

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

module.exports = async function status(_request, response) {
  const apiKey = resolveProviderApiKey();
  const baseUrl = resolveProviderBaseUrl();
  sendJson(response, 200, {
    online: true,
    mode: "web-only",
    gateway: false,
    desktopRelay: false,
    openaiBaseUrl: baseUrl.value,
    openaiBaseUrlSource: baseUrl.source,
    apiKeyConfigured: Boolean(apiKey),
    apiKeySource: apiKey?.source ?? null,
  });
};
