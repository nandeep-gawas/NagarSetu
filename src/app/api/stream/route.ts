import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  NagarSetuStreamEvent,
  subscribeToStreamEvents,
} from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let lastSeenAuditTime = new Date(Date.now() - 5000);

  const customStream = new ReadableStream({
    start(controller) {
      // 1. Initial connection handshake
      const initialHandshake: NagarSetuStreamEvent = {
        id: `init-${Date.now()}`,
        type: "ping",
        message: "NagarSetu Live Civic Event Stream Connected",
        timestamp: new Date().toISOString(),
      };
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify(initialHandshake)}\n\n`)
      );

      // 2. In-process direct event push
      const unsubscribe = subscribeToStreamEvents((event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        } catch {
          // Client closed
        }
      });

      // 3. Cross-process polling for worker updates (deadlineMonitor.ts, external mutations)
      const pollInterval = setInterval(async () => {
        if (req.signal.aborted) {
          clearInterval(pollInterval);
          unsubscribe();
          return;
        }

        try {
          const newAudits = await prisma.auditEvent.findMany({
            where: {
              timestamp: { gt: lastSeenAuditTime },
              outcome: "ACCEPTED",
              entityType: { in: ["Issue", "Report"] },
            },
            orderBy: { timestamp: "asc" },
            take: 10,
          });

          if (newAudits.length > 0) {
            lastSeenAuditTime = newAudits[newAudits.length - 1].timestamp;

            for (const audit of newAudits) {
              let streamType: NagarSetuStreamEvent["type"] = "status_changed";
              if (audit.action === "REPORT_SUBMITTED") {
                streamType = "issue_created";
              } else if (
                audit.action === "REPORT_LINKED_TO_EXISTING_ISSUE"
              ) {
                streamType = "report_linked";
              } else if (
                audit.action.includes("ESCALATION")
              ) {
                streamType = "escalation";
              } else if (audit.action === "MISSED_DEADLINE") {
                streamType = "overdue_detected";
              }

              const streamEvent: NagarSetuStreamEvent = {
                id: audit.id,
                type: streamType,
                issueId: audit.entityId || undefined,
                message: audit.reason || audit.action,
                timestamp: audit.timestamp.toISOString(),
              };

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(streamEvent)}\n\n`)
              );
            }
          } else {
            // Heartbeat keep-alive every ~15 seconds
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          }
        } catch {
          // Polling error or disconnect
        }
      }, 2500);

      req.signal.addEventListener("abort", () => {
        clearInterval(pollInterval);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(customStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
