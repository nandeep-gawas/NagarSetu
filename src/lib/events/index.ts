import { EventEmitter } from "events";

export interface IssueDomainEvent {
  type: "issue.created" | "issue.updated";
  issueId: string;
  publicRef: string;
  status: string;
  priority: string;
  reportCount: number;
  timestamp: string;
  payload?: unknown;
}

class NagarSetuEventBus extends EventEmitter {
  private recentEvents: IssueDomainEvent[] = [];

  emitIssueEvent(
    type: "issue.created" | "issue.updated",
    event: Omit<IssueDomainEvent, "type" | "timestamp">
  ) {
    const fullEvent: IssueDomainEvent = {
      ...event,
      type,
      timestamp: new Date().toISOString(),
    };
    this.recentEvents.unshift(fullEvent);
    if (this.recentEvents.length > 100) {
      this.recentEvents.pop();
    }
    this.emit(type, fullEvent);
    this.emit("issue.*", fullEvent);
    return fullEvent;
  }

  getRecentEvents(limit = 20): IssueDomainEvent[] {
    return this.recentEvents.slice(0, limit);
  }
}

const globalForEvents = globalThis as unknown as {
  nagarSetuEvents: NagarSetuEventBus | undefined;
};

export const issueEvents =
  globalForEvents.nagarSetuEvents ?? new NagarSetuEventBus();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.nagarSetuEvents = issueEvents;
}
