import { EventEmitter } from "events";

export interface NagarSetuStreamEvent {
  id: string;
  type:
    | "issue_created"
    | "report_linked"
    | "status_changed"
    | "escalation"
    | "overdue_detected"
    | "ping";
  issueId?: string;
  publicRef?: string;
  referenceId?: string;
  status?: string;
  priority?: string;
  reportCount?: number;
  message?: string;
  timestamp: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __nagarsetu_event_bus__: EventEmitter | undefined;
}

const eventBus = global.__nagarsetu_event_bus__ ?? new EventEmitter();
eventBus.setMaxListeners(100);
if (process.env.NODE_ENV !== "production") {
  global.__nagarsetu_event_bus__ = eventBus;
}

export function broadcastStreamEvent(event: NagarSetuStreamEvent) {
  eventBus.emit("nagarsetu_event", event);
}

export function subscribeToStreamEvents(
  handler: (event: NagarSetuStreamEvent) => void
) {
  eventBus.on("nagarsetu_event", handler);
  return () => {
    eventBus.off("nagarsetu_event", handler);
  };
}

export const issueEvents = {
  emitIssueEvent(
    eventType: string,
    payload: {
      issueId: string;
      publicRef?: string;
      status?: string;
      priority?: string;
      reportCount?: number;
      [key: string]: unknown;
    }
  ) {
    const streamType =
      eventType === "issue.updated" ? "report_linked" : "issue_created";
    broadcastStreamEvent({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: streamType,
      issueId: payload.issueId,
      publicRef: payload.publicRef,
      status: payload.status,
      priority: payload.priority,
      reportCount: payload.reportCount,
      timestamp: new Date().toISOString(),
    });
  },
};
