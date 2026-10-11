import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    include: {
      issue: {
        select: {
          id: true,
          publicRef: true,
          status: true,
          priority: true,
          publicLocationLabel: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return NextResponse.json({
    ok: true,
    notifications,
    unreadCount,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body.markAllRead) {
      await prisma.notification.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ ok: true, markedAll: true });
    }

    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  } catch (err) {
    console.error("Notifications PATCH error:", err);
    return NextResponse.json({ ok: false, error: "Failed to update notifications" }, { status: 500 });
  }
}
