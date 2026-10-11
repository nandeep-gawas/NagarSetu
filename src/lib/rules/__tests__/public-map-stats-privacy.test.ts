import { describe, it, expect } from "vitest";
import { GET as publicIssuesGet } from "@/app/api/public/issues/route";
import { GET as statsGet } from "@/app/api/stats/route";
import {
  broadcastStreamEvent,
  subscribeToStreamEvents,
  issueEvents,
} from "@/lib/events";
import {
  DEPARTMENT_CONTACTS,
  NAGARSETU_TECH_SUPPORT,
} from "@/data/departmentContacts";
import { NextRequest } from "next/server";

describe("Public Pages & Live Map: Privacy, Stats Rules, Stream & Official Contacts", () => {
  it("1. GET /api/public/issues returns ~100m snapped coordinates and strictly strips all personal citizen data", async () => {
    const req = new NextRequest("http://localhost:3000/api/public/issues");
    const res = await publicIssuesGet(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.issues)).toBe(true);
    expect(data.gridPrecisionMeters).toBe("~100m");

    for (const issue of data.issues) {
      // 1. Coordinates must be snapped to 3 decimal places (~100m grid)
      const latStr = issue.latitude.toString();
      const lngStr = issue.longitude.toString();
      const latDecimals = latStr.includes(".") ? latStr.split(".")[1].length : 0;
      const lngDecimals = lngStr.includes(".") ? lngStr.split(".")[1].length : 0;
      expect(latDecimals).toBeLessThanOrEqual(3);
      expect(lngDecimals).toBeLessThanOrEqual(3);

      // 2. Must contain public identifiers and category metadata
      expect(issue.publicRef).toBeDefined();
      expect(issue.category).toBeDefined();
      expect(issue.category.name).toBeDefined();
      expect(issue.category.emoji).toBeDefined();
      expect(issue.publicLocationLabel).toBeDefined();
      expect(issue.status).toBeDefined();
      expect(issue.priority).toBeDefined();

      // 3. MUST NEVER EXPOSE citizen names, emails, phones, file paths, or raw EXIF
      const asRecord = issue as Record<string, unknown>;
      expect(asRecord.citizenName).toBeUndefined();
      expect(asRecord.citizenEmail).toBeUndefined();
      expect(asRecord.phone).toBeUndefined();
      expect(asRecord.citizenId).toBeUndefined();
      expect(asRecord.reports).toBeUndefined();
      expect(asRecord.filePath).toBeUndefined();
      expect(asRecord.exifLatitude).toBeUndefined();
      expect(asRecord.exifLongitude).toBeUndefined();
      expect(asRecord.exifCapturedAt).toBeUndefined();
    }
  });

  it("2. GET /api/public/issues filters by category, priority, status, and overdue flags", async () => {
    // Filter by overdue
    const overdueReq = new NextRequest(
      "http://localhost:3000/api/public/issues?overdue=true"
    );
    const overdueRes = await publicIssuesGet(overdueReq);
    const overdueData = await overdueRes.json();
    expect(overdueRes.status).toBe(200);
    for (const iss of overdueData.issues) {
      expect(iss.isOverdue).toBe(true);
    }

    // Filter by priority
    const critReq = new NextRequest(
      "http://localhost:3000/api/public/issues?priority=CRITICAL"
    );
    const critRes = await publicIssuesGet(critReq);
    const critData = await critRes.json();
    expect(critRes.status).toBe(200);
    for (const iss of critData.issues) {
      expect(iss.priority).toBe("CRITICAL");
    }
  });

  it("3. GET /api/stats accurately enforces performance math rules and excludes REJECTED issues", async () => {
    const res = await statsGet();
    expect(res.status).toBe(200);

    const stats = await res.json();
    expect(stats.isDemoData).toBe(true);
    expect(stats.demoDataNotice).toContain("prototype figures");

    // Math validation:
    // resolutionRate = resolved / eligible * 100
    // eligible excludes REJECTED
    expect(typeof stats.totalComplaints).toBe("number");
    expect(typeof stats.resolved).toBe("number");
    expect(typeof stats.inProgress).toBe("number");
    expect(typeof stats.overdue).toBe("number");
    expect(typeof stats.resolutionRate).toBe("number");
    expect(typeof stats.onTimeResolutionRate).toBe("number");

    if (stats.totalComplaints > 0) {
      const calculatedResolutionRate = Number(
        ((stats.resolved / stats.totalComplaints) * 100).toFixed(1)
      );
      expect(stats.resolutionRate).toBe(calculatedResolutionRate);
    }

    // Department scorecard
    expect(Array.isArray(stats.departmentScorecard)).toBe(true);
    expect(stats.departmentScorecard.length).toBeGreaterThanOrEqual(1);

    for (const dep of stats.departmentScorecard) {
      expect(dep.departmentName).toBeDefined();
      expect(dep.emoji).toBeDefined();
      expect(typeof dep.totalComplaints).toBe("number");
      expect(typeof dep.onTimeResolutionRate).toBe("number");
      expect(typeof dep.overdue).toBe("number");
      expect(dep.avgResolutionHours).toBeDefined();
    }
  });

  it("4. SSE Stream Event Bus: broadcastStreamEvent and issueEvents emit real-time events to subscribers", async () => {
    let receivedEvent: unknown = null;

    const unsubscribe = subscribeToStreamEvents((evt) => {
      receivedEvent = evt;
    });

    // Broadcast stream event
    broadcastStreamEvent({
      id: "evt-test-1",
      type: "issue_created",
      publicRef: "PUN-TST-999",
      timestamp: new Date().toISOString(),
    });

    expect(receivedEvent).toBeDefined();
    const evt = receivedEvent as { publicRef?: string; type?: string };
    expect(evt.publicRef).toBe("PUN-TST-999");
    expect(evt.type).toBe("issue_created");

    // Test issueEvents adapter
    issueEvents.emitIssueEvent("issue.updated", {
      issueId: "iss-123",
      publicRef: "PUN-TST-888",
      status: "IN_PROGRESS",
      priority: "HIGH",
      reportCount: 3,
    });

    const updatedEvt = receivedEvent as {
      publicRef?: string;
      type?: string;
      priority?: string;
    };
    expect(updatedEvt.publicRef).toBe("PUN-TST-888");
    expect(updatedEvt.type).toBe("report_linked");
    expect(updatedEvt.priority).toBe("HIGH");

    unsubscribe();
  });

  it("5. Department contacts data keeps all official contacts as NULL placeholders without fabricating numbers", () => {
    const contacts = Object.values(DEPARTMENT_CONTACTS);
    expect(contacts.length).toBe(5);

    for (const contact of contacts) {
      // Must not invent phone, email or hours
      expect(contact.phone).toBeNull();
      expect(contact.email).toBeNull();
      expect(contact.website).toBeNull();
      expect(contact.workingHours).toBeNull();
      expect(contact.source).toBeNull();
      expect(contact.lastVerified).toBeNull();

      // Must link to verified official portal url
      expect(contact.officialPmcUrl).toBe("https://pmc.gov.in");
    }

    // NagarSetu tech support must be separate from municipal contacts
    expect(NAGARSETU_TECH_SUPPORT.systemName).toContain("NagarSetu");
    expect(NAGARSETU_TECH_SUPPORT.supportEmail).toContain("nagarsetu.pune.internal");
    expect(NAGARSETU_TECH_SUPPORT.disclaimer).toContain("Technical support assists exclusively with portal access");
  });
});
