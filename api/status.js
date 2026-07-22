function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

module.exports = async function status(_request, response) {
  sendJson(response, 200, {
    online: true,
    mode: "web-only",
    gateway: false,
    desktopRelay: false,
    openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  });
};
