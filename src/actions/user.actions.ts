"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { serialize } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import bcryptjs from "bcryptjs";
import { hasPermission } from "@/lib/permissions";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Get Users (Paginated)
// ============================================================

export async function getUsers(params?: {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "users:read")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      role: { not: "CLIENT" }, // Exclude portal users from admin view
    };

    if (params?.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ];
    }

    if (params?.role) {
      where.role = params.role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          image: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip,
      }),
      prisma.user.count({ where }),
    ]);

    return serialize({
      success: true as const,
      data: {
        users,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error("[GET_USERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch users" };
  }
}

// ============================================================
// Create User
// ============================================================

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "users:create")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Check email uniqueness
    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (existing) {
      return { success: false as const, error: "A user with this email already exists" };
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        hashedPassword,
        role: data.role as "SUPER_ADMIN" | "ADMIN" | "SALES_EXEC" | "EVENT_COORDINATOR" | "FINANCE" | "STAFF",
        phone: data.phone || null,
      },
    });

    await logActivity({
      userId: session.user.id as string,
      action: "created",
      entityType: "User",
      entityId: user.id,
    });

    revalidatePath("/settings/users");

    return { success: true as const, data: { id: user.id } };
  } catch (error) {
    console.error("[CREATE_USER_ERROR]", error);
    return { success: false as const, error: "Failed to create user" };
  }
}

// ============================================================
// Update User
// ============================================================

export async function updateUser(
  id: string,
  data: {
    name?: string;
    role?: string;
    phone?: string;
  }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "users:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.role !== undefined) {
      updateData.role = data.role as "SUPER_ADMIN" | "ADMIN" | "SALES_EXEC" | "EVENT_COORDINATOR" | "FINANCE" | "STAFF";
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: session.user.id as string,
      action: "updated",
      entityType: "User",
      entityId: user.id,
    });

    revalidatePath("/settings/users");

    return { success: true as const };
  } catch (error) {
    console.error("[UPDATE_USER_ERROR]", error);
    return { success: false as const, error: "Failed to update user" };
  }
}

// ============================================================
// Toggle User Active Status
// ============================================================

export async function toggleUserActive(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    if (!hasPermission(session.user.role as string, "users:update")) {
      return { success: false as const, error: "Insufficient permissions" };
    }

    // Cannot deactivate yourself
    if (id === session.user.id) {
      return { success: false as const, error: "You cannot deactivate your own account" };
    }

    // Get current user state
    const user = await prisma.user.findUnique({
      where: { id },
      select: { role: true, isActive: true },
    });

    if (!user) {
      return { success: false as const, error: "User not found" };
    }

    // Cannot deactivate last SUPER_ADMIN
    if (user.role === "SUPER_ADMIN" && user.isActive) {
      const superAdminCount = await prisma.user.count({
        where: { role: "SUPER_ADMIN", isActive: true },
      });
      if (superAdminCount <= 1) {
        return {
          success: false as const,
          error: "Cannot deactivate the last Super Admin",
        };
      }
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });

    await logActivity({
      userId: session.user.id as string,
      action: user.isActive ? "deactivated" : "activated",
      entityType: "User",
      entityId: id,
    });

    revalidatePath("/settings/users");

    return { success: true as const };
  } catch (error) {
    console.error("[TOGGLE_USER_ACTIVE_ERROR]", error);
    return { success: false as const, error: "Failed to update user status" };
  }
}
