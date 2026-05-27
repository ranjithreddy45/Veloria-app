"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Chrome } from "lucide-react";
import { signInSchema, type SignInInput } from "@/schemas/auth.schema";
import { signInAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function SignInForm() {
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: SignInInput) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", values.email);
      formData.append("password", values.password);

      const result = await signInAction(formData);

      if (result && !result.success) {
        toast.error(result.error || "Invalid email or password");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1 text-center">
        <h2 className="text-[17px] font-semibold tracking-tight text-foreground">
          Welcome back
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Sign in to continue to your workspace
        </p>
      </div>

      {/* Google Sign In */}
      <Button
        variant="outline"
        className="h-9 w-full gap-2 rounded-md border-border bg-background text-[13px] font-medium hover:bg-muted/60"
        type="button"
        disabled={isPending}
        onClick={() => {
          signIn("google", { callbackUrl: "/dashboard" });
        }}
      >
        <Chrome className="size-4" />
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="h-px w-full bg-border" />
        </div>
        <div className="relative flex justify-center text-[10.5px] uppercase tracking-[0.08em]">
          <span className="bg-card px-2 text-muted-foreground/70">
            or with email
          </span>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-[12px] font-medium text-foreground">
                  Email
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="you@example.com"
                    type="email"
                    autoComplete="email"
                    className="h-9 rounded-md text-[13px]"
                    disabled={isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage className="text-[11.5px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-[12px] font-medium text-foreground">
                    Password
                  </FormLabel>
                  <Link
                    href="/forgot-password"
                    className="text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Forgot?
                  </Link>
                </div>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="Enter your password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      className="h-9 rounded-md pr-14 text-[13px]"
                      disabled={isPending}
                      {...field}
                    />
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded px-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-[11.5px]" />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="h-9 w-full rounded-md bg-primary text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-3.5 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </Form>

      <p className="text-center text-[12.5px] text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link
          href="/sign-up"
          className="font-medium text-foreground transition-colors hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
