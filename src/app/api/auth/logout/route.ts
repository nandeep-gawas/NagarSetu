import { NextResponse } from "next/server";
import { clearSessionCookie, getSessionUser } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST() {
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

  return NextResponse.json({ success: true });
}
