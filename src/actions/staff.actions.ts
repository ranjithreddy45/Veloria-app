"use server";

import { auth } from "@/../auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import {
  staffProfileSchema,
  createShiftSchema,
  updateShiftSchema,
  type StaffProfileInput,
  type CreateShiftInput,
  type UpdateShiftInput,
} from "@/schemas/staff.schema";
import type { ShiftStatus, PayrollStatus } from "@prisma/client";
import { serialize } from "@/lib/utils";
import { logActivity } from "@/lib/activity-logger";

// ============================================================
// Get Staff Profiles (list all with user details)
// ============================================================

export async function getStaffProfiles() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const profiles = await prisma.staffProfile.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        _count: {
          select: { shifts: true, payroll: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(profiles) };
  } catch (error) {
    console.error("[GET_STAFF_PROFILES_ERROR]", error);
    return { success: false as const, error: "Failed to fetch staff profiles" };
  }
}

// ============================================================
// Get Staff Profile (get or create for a user)
// ============================================================

export async function getStaffProfile(userId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    let profile = await prisma.staffProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { id: true, name: true, email: true, image: true },
        },
        shifts: {
          orderBy: { date: "desc" },
          take: 20,
        },
        payroll: {
          orderBy: { month: "desc" },
          take: 12,
        },
      },
    });

    if (!profile) {
      profile = await prisma.staffProfile.create({
        data: { userId },
        include: {
          user: {
            select: { id: true, name: true, email: true, image: true },
          },
          shifts: {
            orderBy: { date: "desc" },
            take: 20,
          },
          payroll: {
            orderBy: { month: "desc" },
            take: 12,
          },
        },
      });
    }

    return { success: true as const, data: serialize(profile) };
  } catch (error) {
    console.error("[GET_STAFF_PROFILE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch staff profile" };
  }
}

// ============================================================
// Update Staff Profile
// ============================================================

export async function updateStaffProfile(id: string, data: StaffProfileInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = staffProfileSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const profileData = parsed.data;

    const profile = await prisma.staffProfile.update({
      where: { id },
      data: {
        department: profileData.department || null,
        designation: profileData.designation || null,
        hourlyRate: profileData.hourlyRate || null,
        monthlyRate: profileData.monthlyRate || null,
        bankDetails: profileData.bankDetails
          ? (profileData.bankDetails as Prisma.InputJsonValue)
          : undefined,
        emergencyContact: profileData.emergencyContact
          ? (profileData.emergencyContact as Prisma.InputJsonValue)
          : undefined,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "StaffProfile",
      entityId: profile.id,
    });

    revalidatePath("/staff");
    return { success: true as const, data: serialize(profile) };
  } catch (error) {
    console.error("[UPDATE_STAFF_PROFILE_ERROR]", error);
    return { success: false as const, error: "Failed to update staff profile" };
  }
}

// ============================================================
// Get Staff Schedule (shifts with filters)
// ============================================================

export async function getStaffSchedule(params?: {
  staffId?: string;
  startDate?: string;
  endDate?: string;
  status?: ShiftStatus;
}) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (params?.staffId) {
      where.staffId = params.staffId;
    }

    if (params?.startDate || params?.endDate) {
      where.date = {};
      if (params.startDate) {
        where.date.gte = new Date(params.startDate);
      }
      if (params?.endDate) {
        where.date.lte = new Date(params.endDate);
      }
    }

    if (params?.status) {
      where.status = params.status;
    }

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        staff: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        booking: {
          select: { id: true, bookingNumber: true, eventName: true },
        },
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    });

    return { success: true as const, data: serialize(shifts) };
  } catch (error) {
    console.error("[GET_STAFF_SCHEDULE_ERROR]", error);
    return { success: false as const, error: "Failed to fetch staff schedule" };
  }
}

// ============================================================
// Create Shift
// ============================================================

export async function createShift(data: CreateShiftInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = createShiftSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const shiftData = parsed.data;
    const shiftDate = new Date(shiftData.date);
    shiftDate.setHours(0, 0, 0, 0);

    const shift = await prisma.shift.create({
      data: {
        date: shiftDate,
        startTime: shiftData.startTime,
        endTime: shiftData.endTime,
        role: shiftData.role,
        staffId: shiftData.staffId,
        bookingId: shiftData.bookingId || null,
      },
      include: {
        staff: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "Shift",
      entityId: shift.id,
    });

    revalidatePath("/staff");
    return { success: true as const, data: serialize(shift) };
  } catch (error) {
    console.error("[CREATE_SHIFT_ERROR]", error);
    return { success: false as const, error: "Failed to create shift" };
  }
}

// ============================================================
// Update Shift
// ============================================================

export async function updateShift(id: string, data: UpdateShiftInput) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const parsed = updateShiftSchema.safeParse(data);
    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Shift not found" };
    }

    const shiftData = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (shiftData.date) {
      const shiftDate = new Date(shiftData.date);
      shiftDate.setHours(0, 0, 0, 0);
      updateData.date = shiftDate;
    }
    if (shiftData.startTime !== undefined) updateData.startTime = shiftData.startTime;
    if (shiftData.endTime !== undefined) updateData.endTime = shiftData.endTime;
    if (shiftData.role !== undefined) updateData.role = shiftData.role;
    if (shiftData.status !== undefined) updateData.status = shiftData.status;
    if (shiftData.hoursWorked !== undefined) updateData.hoursWorked = shiftData.hoursWorked;
    if (shiftData.overtimeHours !== undefined) updateData.overtimeHours = shiftData.overtimeHours;
    if (shiftData.bookingId !== undefined) {
      updateData.bookingId = shiftData.bookingId || null;
    }

    const shift = await prisma.shift.update({
      where: { id },
      data: updateData,
      include: {
        staff: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "updated",
      entityType: "Shift",
      entityId: shift.id,
    });

    revalidatePath("/staff");
    return { success: true as const, data: serialize(shift) };
  } catch (error) {
    console.error("[UPDATE_SHIFT_ERROR]", error);
    return { success: false as const, error: "Failed to update shift" };
  }
}

// ============================================================
// Delete Shift
// ============================================================

export async function deleteShift(id: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.shift.findUnique({ where: { id } });
    if (!existing) {
      return { success: false as const, error: "Shift not found" };
    }

    await prisma.shift.delete({ where: { id } });

    await logActivity({
      userId: session.user.id,
      action: "deleted",
      entityType: "Shift",
      entityId: id,
    });

    revalidatePath("/staff");
    return { success: true as const, data: { id } };
  } catch (error) {
    console.error("[DELETE_SHIFT_ERROR]", error);
    return { success: false as const, error: "Failed to delete shift" };
  }
}

// ============================================================
// Get Payroll (all entries for a month)
// ============================================================

export async function getPayroll(month: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const entries = await prisma.payrollEntry.findMany({
      where: { month },
      include: {
        staff: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true as const, data: serialize(entries) };
  } catch (error) {
    console.error("[GET_PAYROLL_ERROR]", error);
    return { success: false as const, error: "Failed to fetch payroll" };
  }
}

// ============================================================
// Generate Payroll (auto-generate from shifts for a month)
// ============================================================

export async function generatePayroll(month: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    // Validate month format YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return { success: false as const, error: "Month must be in YYYY-MM format" };
    }

    const [yearStr, monthStr] = month.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0);

    // Get all staff profiles
    const staffProfiles = await prisma.staffProfile.findMany({
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (staffProfiles.length === 0) {
      return { success: false as const, error: "No staff profiles found" };
    }

    const results = [];

    for (const staff of staffProfiles) {
      // Check if payroll already exists for this staff+month
      const existing = await prisma.payrollEntry.findUnique({
        where: { staffId_month: { staffId: staff.id, month } },
      });

      if (existing) {
        results.push(existing);
        continue;
      }

      // Get completed shifts for this staff in the month
      const shifts = await prisma.shift.findMany({
        where: {
          staffId: staff.id,
          date: { gte: startDate, lte: endDate },
          status: "COMPLETED",
        },
      });

      // Calculate pay
      const totalHoursWorked = shifts.reduce(
        (sum, s) => sum + (s.hoursWorked ? Number(s.hoursWorked) : 0),
        0
      );
      const totalOvertimeHours = shifts.reduce(
        (sum, s) => sum + (s.overtimeHours ? Number(s.overtimeHours) : 0),
        0
      );

      let basePay = 0;
      let overtimePay = 0;

      if (staff.monthlyRate && Number(staff.monthlyRate) > 0) {
        // Monthly rate takes precedence
        basePay = Number(staff.monthlyRate);
      } else if (staff.hourlyRate && Number(staff.hourlyRate) > 0) {
        basePay = totalHoursWorked * Number(staff.hourlyRate);
      }

      if (staff.hourlyRate && Number(staff.hourlyRate) > 0) {
        // Overtime at 1.5x hourly rate
        overtimePay = totalOvertimeHours * Number(staff.hourlyRate) * 1.5;
      }

      const deductions = 0;
      const netPay = basePay + overtimePay - deductions;

      const entry = await prisma.payrollEntry.create({
        data: {
          month,
          basePay,
          overtimePay,
          deductions,
          netPay,
          staffId: staff.id,
          status: "DRAFT",
        },
      });

      results.push(entry);
    }

    await logActivity({
      userId: session.user.id,
      action: "created",
      entityType: "PayrollEntry",
      entityId: month,
      changes: { month, count: results.length },
    });

    revalidatePath("/staff/payroll");
    return { success: true as const, data: serialize(results) };
  } catch (error) {
    console.error("[GENERATE_PAYROLL_ERROR]", error);
    return { success: false as const, error: "Failed to generate payroll" };
  }
}

// ============================================================
// Approve Payroll
// ============================================================

export async function approvePayroll(entryId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.payrollEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      return { success: false as const, error: "Payroll entry not found" };
    }

    if (existing.status !== "DRAFT") {
      return {
        success: false as const,
        error: "Only draft payroll entries can be approved",
      };
    }

    const entry = await prisma.payrollEntry.update({
      where: { id: entryId },
      data: { status: "APPROVED" },
    });

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "PayrollEntry",
      entityId: entry.id,
      changes: { from: "DRAFT", to: "APPROVED" },
    });

    revalidatePath("/staff/payroll");
    return { success: true as const, data: serialize(entry) };
  } catch (error) {
    console.error("[APPROVE_PAYROLL_ERROR]", error);
    return { success: false as const, error: "Failed to approve payroll" };
  }
}

// ============================================================
// Mark Payroll Paid
// ============================================================

export async function markPayrollPaid(entryId: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false as const, error: "Unauthorized" };
    }

    const existing = await prisma.payrollEntry.findUnique({
      where: { id: entryId },
    });

    if (!existing) {
      return { success: false as const, error: "Payroll entry not found" };
    }

    if (existing.status !== "APPROVED") {
      return {
        success: false as const,
        error: "Only approved payroll entries can be marked as paid",
      };
    }

    const entry = await prisma.payrollEntry.update({
      where: { id: entryId },
      data: {
        status: "PAID",
        paidAt: new Date(),
      },
    });

    await logActivity({
      userId: session.user.id,
      action: "status_changed",
      entityType: "PayrollEntry",
      entityId: entry.id,
      changes: { from: "APPROVED", to: "PAID" },
    });

    revalidatePath("/staff/payroll");
    return { success: true as const, data: serialize(entry) };
  } catch (error) {
    console.error("[MARK_PAYROLL_PAID_ERROR]", error);
    return { success: false as const, error: "Failed to mark payroll as paid" };
  }
}

// ============================================================
// Get Users (for staff profile creation dropdowns)
// ============================================================

export async function getStaffUsers() {
  try {
    const session = await auth();
    if (!session?.user) {
      return { success: false as const, error: "Unauthorized" };
    }

    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, image: true },
      orderBy: { name: "asc" },
    });

    return { success: true as const, data: serialize(users) };
  } catch (error) {
    console.error("[GET_STAFF_USERS_ERROR]", error);
    return { success: false as const, error: "Failed to fetch users" };
  }
}
