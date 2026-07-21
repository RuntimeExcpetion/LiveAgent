export type GatewaySidebarStatusFreshnessState = {
  socketConnected: boolean;
};

export type GatewaySidebarStatusFreshnessEvent =
  | { type: "connection"; connected: boolean }
  | { type: "status" };

export const INITIAL_GATEWAY_SIDEBAR_STATUS_FRESHNESS: GatewaySidebarStatusFreshnessState = {
  socketConnected: false,
};

export function reduceGatewaySidebarStatusFreshness(
  state: GatewaySidebarStatusFreshnessState,
  event: GatewaySidebarStatusFreshnessEvent,
): GatewaySidebarStatusFreshnessState {
  if (event.type === "connection") {
    return { socketConnected: event.connected };
  }
  return state;
}

export function shouldDisableGatewaySidebarSections(input: {
  connectionLost: boolean;
  socketConnected: boolean;
}): boolean {
  return input.connectionLost || !input.socketConnected;
}
