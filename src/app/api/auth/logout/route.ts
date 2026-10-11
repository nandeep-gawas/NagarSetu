import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

async function performLogout() {
  const user = await getSessionUser();
  await clearSessionCookie();

  if (user) {
    await logAuditEvent({
      actorType: "USER",
      actorId: user.id,
      actorLabel: `${user.role.toLowerCase()}:${user.email}`,
      action: "AUTH_LOGOUT",
      entityType: "User",
      entityId: user.id,
      oldValue: { sessionActive: true },
      newValue: { sessionActive: false },
      reason: "User logged out",
      ruleApplied: "AuthPolicy:SessionLogout",
      outcome: "ACCEPTED",
    });
  }
}

export async function POST() {
  await performLogout();
  return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
  await performLogout();
  return NextResponse.redirect(new URL("/login", req.url));
}

