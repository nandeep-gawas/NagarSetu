import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const categories = await prisma.category.findMany({
    include: {
      subcategories: {
        orderBy: { name: "asc" },
      },
      department: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ok: true,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      emoji: c.emoji,
      description: c.description,
      department: c.department,
      subcategories: c.subcategories.map((s) => ({
        id: s.id,
        name: s.name,
        categoryId: s.categoryId,
        defaultSeverity: "STANDARD",
      })),
    })),
  });
}
