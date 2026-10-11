import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { setSessionCookie } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, "login", 15, 60 * 1000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetMs);
  }

  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        department: {
          include: { category: true },
        },
      },
    });

    if (!user) {
      await logAuditEvent({
        actorType: "USER",
        actorId: null,
        actorLabel: `anonymous:${normalizedEmail}`,
        action: "AUTH_LOGIN_ATTEMPT",
        entityType: "User",
        entityId: null,
        oldValue: null,
        newValue: { email: normalizedEmail },
        reason: "Login refused: Account not found",
        ruleApplied: "AuthPolicy:VerifyCredentials",
        outcome: "REFUSED",
      });

      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    const validPassword = await bcrypt.compare(
      String(password),
      user.passwordHash
    );
    if (!validPassword) {
      await logAuditEvent({
        actorType: "USER",
        actorId: user.id,
        actorLabel: `${user.role.toLowerCase()}:${user.email}`,
        action: "AUTH_LOGIN_ATTEMPT",
        entityType: "User",
        entityId: user.id,
        oldValue: null,
        newValue: { email: normalizedEmail },
        reason: "Login refused: Invalid password",
        ruleApplied: "AuthPolicy:VerifyCredentials",
        outcome: "REFUSED",
      });

      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    await setSessionCookie({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    await logAuditEvent({
      actorType: "USER",
      actorId: user.id,
      actorLabel: `${user.role.toLowerCase()}:${user.email}`,
      action: "AUTH_LOGIN",
      entityType: "User",
      entityId: user.id,
      oldValue: null,
      newValue: { role: user.role, departmentId: user.departmentId },
      reason: "User logged in via session cookie",
      ruleApplied: "AuthPolicy:SessionCookieAuth",
      outcome: "ACCEPTED",
    });

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        departmentId: user.departmentId,
        department: user.department,
        isDemo: user.isDemo,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "Internal server error during login." },
      { status: 500 }
    );
  }
}
