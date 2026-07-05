"use server";

import bcryptjs from "bcryptjs";
import prisma from "@/lib/prisma";
import { signIn } from "@/../auth";
import { signUpSchema, signInSchema, forgotPasswordSchema, resetPasswordSchema } from "@/schemas/auth.schema";
import { AuthError } from "next-auth";

// ============================================================
// Sign Up Action
// ============================================================

export async function signUpAction(formData: FormData) {
  try {
    const rawData = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    // Validate input
    const parsed = signUpSchema.safeParse(rawData);

    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return {
        success: false as const,
        error: "An account with this email already exists",
      };
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 12);

    // Create user with CLIENT role.
    // C9 (account takeover): emailVerified is intentionally left null. Anyone
    // can register a customer's email (it's printed on every invoice), so an
    // unverified credential signup must NOT resolve to that customer's portal
    // data. The portal data gate keys off emailVerified; staff onboard a real
    // client via a portal invite token (generatePortalInvite).
    await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        hashedPassword,
        role: "CLIENT",
      },
    });

    return {
      success: true as const,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error) {
    console.error("[SIGN_UP_ERROR]", error);
    return {
      success: false as const,
      error: "Something went wrong. Please try again.",
    };
  }
}

// ============================================================
// Sign In Action
// ============================================================

export async function signInAction(formData: FormData) {
  try {
    const rawData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    // Validate input
    const parsed = signInSchema.safeParse(rawData);

    if (!parsed.success) {
      return {
        success: false as const,
        error: "Invalid email or password",
      };
    }

    // Determine redirect based on user role
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
      select: { role: true },
    });
    const redirectTo = user?.role === "CLIENT"
      ? "/portal"
      : user?.role === "VENDOR"
        ? "/vendor-portal"
        : "/dashboard";

    await signIn("credentials", {
      email: parsed.data.email.toLowerCase(),
      password: parsed.data.password,
      redirectTo,
    });

    // signIn will redirect on success, so this line is only reached
    // if there is no redirect (which shouldn't happen in normal flow)
    return { success: true as const };
  } catch (error) {
    // NextAuth throws a NEXT_REDIRECT "error" on successful redirect.
    // We need to re-throw it so Next.js can handle the redirect.
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return {
            success: false as const,
            error: "Invalid email or password",
          };
        default:
          return {
            success: false as const,
            error: "Something went wrong. Please try again.",
          };
      }
    }

    // Re-throw non-AuthError errors (e.g., NEXT_REDIRECT)
    throw error;
  }
}

// ============================================================
// Forgot Password Action
// ============================================================

export async function forgotPasswordAction(formData: FormData) {
  try {
    const email = formData.get("email") as string;
    const parsed = forgotPasswordSchema.safeParse({ email });

    if (!parsed.success) {
      return { success: false as const, error: "Please enter a valid email address" };
    }

    const normalizedEmail = parsed.data.email.toLowerCase();

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't reveal that the user doesn't exist
      return {
        success: true as const,
        message: "If an account with that email exists, we've sent a password reset link.",
      };
    }

    // Delete any existing tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { email: normalizedEmail },
    });

    // Generate a secure token
    const { randomBytes } = await import("crypto");
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt,
      },
    });

    // Send email
    const { sendEmail } = await import("@/lib/email");
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;
    const appName = process.env.NEXT_PUBLIC_APP_NAME || "Veloria Grand";

    await sendEmail({
      to: normalizedEmail,
      subject: "Reset Your Password",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">${appName}</h1>
          </div>
          <h2 style="color: #1F2937; margin-bottom: 16px;">Reset Your Password</h2>
          <p style="color: #6B7280; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password.
            This link will expire in 1 hour.
          </p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}"
               style="background: linear-gradient(to right, #4F46E5, #7C3AED); color: white; padding: 12px 32px;
                      text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6;">
            If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
          </p>
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
          <p style="color: #D1D5DB; font-size: 12px; text-align: center;">
            &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
          </p>
        </div>
      `,
    });

    return {
      success: true as const,
      message: "If an account with that email exists, we've sent a password reset link.",
    };
  } catch (error) {
    console.error("[FORGOT_PASSWORD_ERROR]", error);
    return {
      success: false as const,
      error: "Something went wrong. Please try again.",
    };
  }
}

// ============================================================
// Reset Password Action
// ============================================================

export async function resetPasswordAction(formData: FormData) {
  try {
    const rawData = {
      token: formData.get("token") as string,
      password: formData.get("password") as string,
      confirmPassword: formData.get("confirmPassword") as string,
    };

    const parsed = resetPasswordSchema.safeParse(rawData);

    if (!parsed.success) {
      return {
        success: false as const,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      };
    }

    const { token, password } = parsed.data;

    // Find the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return {
        success: false as const,
        error: "Invalid or expired reset link. Please request a new one.",
      };
    }

    // Check expiration
    if (new Date() > resetToken.expiresAt) {
      await prisma.passwordResetToken.delete({ where: { token } });
      return {
        success: false as const,
        error: "This reset link has expired. Please request a new one.",
      };
    }

    // Hash new password
    const hashedPassword = await bcryptjs.hash(password, 12);

    // Update user password and delete token in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { email: resetToken.email },
        data: { hashedPassword },
      }),
      prisma.passwordResetToken.delete({
        where: { token },
      }),
    ]);

    return {
      success: true as const,
      message: "Password reset successfully. You can now sign in with your new password.",
    };
  } catch (error) {
    console.error("[RESET_PASSWORD_ERROR]", error);
    return {
      success: false as const,
      error: "Something went wrong. Please try again.",
    };
  }
}
