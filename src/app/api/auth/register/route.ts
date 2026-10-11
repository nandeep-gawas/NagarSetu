import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, phone, role } = body;

    // Citizens self-register. Officers, supervisors and admins are created by seed or by admin only.
    if (role && role !== "CITIZEN") {
      await logAuditEvent({
        actorType: "USER",
        actorId: null,
        actorLabel: `anonymous:${email || "unknown"}`,
        action: "AUTH_REGISTER_PRIVILEGED_ROLE_ATTEMPT",
        entityType: "User",
        entityId: null,
        oldValue: null,
        newValue: { email, requestedRole: role },
        reason: `Self-registration with privileged role '${role}' refused. Only CITIZEN self-registration is allowed.`,
        ruleApplied: "AuthPolicy:CitizenSelfRegistrationOnly",
        outcome: "REFUSED",
      });

      return NextResponse.json(
        {
          error:
            "Forbidden: Citizens self-register. Officers, supervisors and admins can only be created by an Administrator.",
          code: "PRIVILEGED_REGISTRATION_REFUSED",
        },
        { status: 403 }
      );
    }

    if (!name || !email || !password || String(password).length < 6) {
      return NextResponse.json(
        {
          error:
            "Name, valid email, and password (min 6 characters) are required.",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      await logAuditEvent({
        actorType: "USER",
        actorId: null,
        actorLabel: `anonymous:${normalizedEmail}`,
        action: "AUTH_REGISTER_DUPLICATE_EMAIL",
        entityType: "User",
        entityId: existing.id,
        oldValue: null,
        newValue: { email: normalizedEmail },
        reason: "Registration refused: Email already registered",
        ruleApplied: "AuthPolicy:UniqueEmail",
        outcome: "REFUSED",
      });

      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const user = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        phone: phone ? String(phone).trim() : null,
        role: "CITIZEN",
        isDemo: false,
      },
    });

    await setSessionCookie({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await logAuditEvent({
      actorType: "USER",
      actorId: user.id,
      actorLabel: `citizen:${user.email}`,
      action: "AUTH_REGISTER",
      entityType: "User",
      entityId: user.id,
      oldValue: null,
      newValue: { email: user.email, role: user.role },
      reason: "Citizen self-registration completed",
      ruleApplied: "AuthPolicy:CitizenSelfRegistration",
      outcome: "ACCEPTED",
    });

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          departmentId: user.departmentId,
          isDemo: user.isDemo,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Register error:", err);
    return NextResponse.json(
      { error: "Internal server error during registration." },
      { status: 500 }
    );
  }
}
