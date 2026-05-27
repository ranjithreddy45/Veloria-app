import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import prisma from "@/lib/prisma";
import { signInSchema } from "@/schemas/auth.schema";
import authConfig from "./auth.config";
import type { UserRole } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  trustHost: true,

  adapter: PrismaAdapter(prisma) as never,

  session: {
    strategy: "jwt",
  },

  // Override providers with full implementations
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: "CLIENT" as UserRole,
        };
      },
    }),

    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        // Validate credentials shape
        const parsed = signInSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const { email, password } = parsed.data;

        // Look up user by email
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        // User not found or no password (OAuth-only account)
        if (!user || !user.hashedPassword) {
          return null;
        }

        // Check if account is active
        if (!user.isActive) {
          return null;
        }

        // Verify password
        const isPasswordValid = await bcryptjs.compare(
          password,
          user.hashedPassword
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],

  events: {
    async linkAccount({ user }) {
      // When an OAuth account is linked, mark email as verified
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    },
  },
});
