import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { getSessionUser } from "./session";
import { logAuditEvent } from "@/lib/audit";

export interface GuardContext {
  action?: string;
  entityType?: string;
  entityId?: string | null;
}

export type RequireRoleResult =
  | {
      authorized: true;
      user: NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
    }
  | {
      authorized: false;
      response: NextResponse;
    };

/**
 * Server helper requireRole(roles[]) used by every protected API route.
 * Returns 401 if not logged in and 403 if the role is wrong,
 * and logs refused security-relevant attempts to AuditEvent with outcome REFUSED.
 */
export async function requireRole(
  roles: Role[],
  context?: GuardContext
): Promise<RequireRoleResult> {
  const user = await getSessionUser();

  if (!user) {
    await logAuditEvent({
      actorType: "USER",
      actorId: null,
      actorLabel: "anonymous:unauthenticated",
      action: context?.action ?? "PROTECTED_ROUTE_ACCESS",
      entityType: context?.entityType ?? "API_ENDPOINT",
      entityId: context?.entityId ?? null,
      oldValue: null,
      newValue: { requiredRoles: roles },
      reason: `Unauthenticated request refused (401). Required role(s): ${roles.join(", ")}`,
      ruleApplied: "RBAC:requireRole",
      outcome: "REFUSED",
    });

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: "Authentication required. Please log in.",
          code: "UNAUTHENTICATED",
        },
        { status: 401 }
      ),
    };
  }

  if (!roles.includes(user.role)) {
    await logAuditEvent({
      actorType: "USER",
      actorId: user.id,
      actorLabel: `${user.role.toLowerCase()}:${user.email}`,
      action: context?.action ?? "PROTECTED_ROUTE_ACCESS",
      entityType: context?.entityType ?? "API_ENDPOINT",
      entityId: context?.entityId ?? null,
      oldValue: { actorRole: user.role },
      newValue: { requiredRoles: roles },
      reason: `Role ${user.role} is not permitted. Required role(s): ${roles.join(", ")}`,
      ruleApplied: "RBAC:requireRole",
      outcome: "REFUSED",
    });

    return {
      authorized: false,
      response: NextResponse.json(
        {
          error: `Forbidden: Role '${user.role}' is not authorized. Allowed roles: ${roles.join(", ")}.`,
          code: "FORBIDDEN_ROLE",
        },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    user,
  };
}
