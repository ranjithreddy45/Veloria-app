import { type DefaultSession } from "next-auth";
import { type UserRole } from "@prisma/client";

export type ExtendedUser = DefaultSession["user"] & {
  id: string;
  role: UserRole;
  perms?: string[]; // effective permissions, or ["*"] for admins
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
  }
}
