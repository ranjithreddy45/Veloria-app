import { type DefaultSession } from "next-auth";
import { type UserRole } from "@prisma/client";

export type ExtendedUser = DefaultSession["user"] & {
  id: string;
  role: UserRole;
  /**
   * LEGACY full effective list. Still honoured when present so sessions issued
   * before the 431 fix keep working; `bakePerms` no longer writes it.
   */
  perms?: string[];
  /** Override delta from the role defaults (RolePermission rows). */
  permsAdd?: string[];
  permsDel?: string[];
  /** An authenticator app is enrolled (drives the 2FA policy banner). */
  twoFactorEnabled?: boolean;
  /** Signed in via Google / WhatsApp OTP and still owes a code (/two-factor). */
  twoFactorPending?: boolean;
  /** Challenge id bound to this session while twoFactorPending. */
  twoFactorSid?: string;
};

declare module "next-auth" {
  interface Session {
    user: ExtendedUser;
  }

  interface User {
    role: UserRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    perms?: string[];
    permsAdd?: string[];
    permsDel?: string[];
    tfa?: boolean; // two-factor enrolled
    tfaPending?: boolean; // second factor still owed for this session
    tfaSid?: string; // challenge id (see UserTwoFactorChallenge)
  }
}
