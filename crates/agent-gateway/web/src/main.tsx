import React from "react";
import ReactDOM from "react-dom/client";

import { GATEWAY_WEBUI_MARKER } from "./lib/runtimeEnv";
import "./index.css";
import "katex/dist/katex.min.css";
import "react-complex-tree/lib/style-modern.css";
import "streamdown/styles.css";
import "./styles.css";

// 渲染前写入 WebUI 运行时标记（isGatewayWebuiRuntime 的唯一权威写入点）。
document.documentElement.dataset.liveagentWebui = GATEWAY_WEBUI_MARKER;

async function loadRoot() {
  if (import.meta.env.VITE_WEB_ONLY_BACKEND === "1") {
    const module = await import("./app/WebOnlyApp");
    return module.default;
  }

  const dashboardPaths = new Set(["/dashboard", "/status-board", "/observatory"]);
  if (dashboardPaths.has(window.location.pathname)) {
    const module = await import("./pages/StatusDashboardPage");
    return module.StatusDashboardPage;
  }

  const module = await import("./App");
  return module.default;
}

const Root = await loadRoot();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
