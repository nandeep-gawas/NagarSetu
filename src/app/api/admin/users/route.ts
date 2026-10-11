import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function GET() {
  const guard = await requireRole(["ADMIN", "SUPERVISOR"], {
    action: "ADMIN_LIST_USERS",
    entityType: "User",
  });
  if (!guard.authorized) return guard.response;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      departmentId: true,
      department: true,
      isDemo: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const guard = await requireRole(["ADMIN"], {
    action: "ADMIN_CREATE_STAFF_USER",
    entityType: "User",
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const { name, email, password, phone, role, departmentId } = body;

    const validRoles: Role[] = ["CITIZEN", "OFFICER", "SUPERVISOR", "ADMIN"];
    if (!name || !email || !password || !validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Name, email, password, and valid role are required." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Email is already registered." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const created = await prisma.user.create({
      data: {
        name: String(name).trim(),
        email: normalizedEmail,
        passwordHash,
        phone: phone ? String(phone).trim() : null,
        role: role as Role,
        departmentId: departmentId || null,
        isDemo: false,
      },
      include: { department: true },
    });

    await logAuditEvent({
      actorType: "USER",
      actorId: guard.user.id,
      actorLabel: `admin:${guard.user.email}`,
      action: "ADMIN_CREATE_USER",
      entityType: "User",
      entityId: created.id,
      oldValue: null,
      newValue: {
        email: created.email,
        role: created.role,
        departmentId: created.departmentId,
      },
      reason: `Admin created ${created.role} account`,
      ruleApplied: "AuthPolicy:AdminOnlyStaffCreation",
      outcome: "ACCEPTED",
    });

    return NextResponse.json(
      {
        user: {
          id: created.id,
          name: created.name,
          email: created.email,
          role: created.role,
          departmentId: created.departmentId,
          department: created.department,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Admin create user error:", err);
    return NextResponse.json(
      { error: "Failed to create user." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const guard = await requireRole(["ADMIN"], {
    action: "ADMIN_UPDATE_STAFF_USER",
    entityType: "User",
  });
  if (!guard.authorized) return guard.response;

  try {
    const body = await req.json();
    const { id, role, departmentId } = body;

    if (!id) {
      return NextResponse.json(
        { error: "User ID is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      include: { department: true },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "User not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(role ? { role: role as Role } : {}),
        departmentId: departmentId !== undefined ? (departmentId || null) : existing.departmentId,
      },
      include: { department: true },
    });

    await logAuditEvent({
      actorType: "USER",
      actorId: guard.user.id,
      actorLabel: `admin:${guard.user.email}`,
      action: "ADMIN_UPDATE_STAFF_ASSIGNMENT",
      entityType: "User",
      entityId: updated.id,
      oldValue: { role: existing.role, departmentId: existing.departmentId },
      newValue: { role: updated.role, departmentId: updated.departmentId },
      reason: `Admin updated staff assignment for ${updated.name} (${updated.email})`,
      ruleApplied: "AuthPolicy:AdminStaffManagement",
      outcome: "ACCEPTED",
    });

    return NextResponse.json({
      ok: true,
      user: updated,
    });
  } catch (err) {
    console.error("Admin update user error:", err);
    return NextResponse.json(
      { error: "Failed to update user." },
      { status: 500 }
    );
  }
}
