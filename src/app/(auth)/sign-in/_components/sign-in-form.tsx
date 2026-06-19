"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Chrome, MessageCircle } from "lucide-react";
import { signInSchema, type SignInInput } from "@/schemas/auth.schema";
import { signInAction } from "@/actions/auth.actions";
import { requestLoginOtp } from "@/actions/otp.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type AuthMode = "password" | "otp";
type OtpStep = "phone" | "code";

export default function SignInForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);

  // WhatsApp OTP state
  const [authMode, setAuthMode] = useState<AuthMode>("password");
  const [otpStep, setOtpStep] = useState<OtpStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);

  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
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

  async function handleSendCode() {
    if (phone.replace(/\D/g, "").length < 10) {
      toast.error("Enter a valid mobile number.");
      return;
    }
    setOtpSending(true);
    try {
      const res = await requestLoginOtp(phone);
      if (!res.success) {
        toast.error(res.error || "Couldn't send code.");
        return;
      }
      toast.success("If this number has an account, a code is on its way via WhatsApp.");
      setOtpStep("code");
    } catch {
      toast.error("Couldn't send code — please try again.");
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyCode() {
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code.");
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await signIn("otp", {
        phone,
        code,
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (!res || res.error) {
        toast.error("Invalid or expired code. Please try again.");
        return;
      }
      router.push(res.url || "/dashboard");
    } catch {
      toast.error("Sign-in failed — please try again.");
    } finally {
      setOtpVerifying(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <h2 className="text-ink-gradient large-title text-[26px]">
          Welcome back
        </h2>
        <p className="text-[13px] text-muted-foreground">
          Sign in to continue to your workspace
        </p>
      </div>

      {/* Google Sign In */}
      <Button
        variant="outline"
        className="sheen-sweep relative h-10 w-full gap-2 overflow-hidden rounded-lg border-border bg-background text-[13px] font-medium transition-colors hover:bg-muted/60"
        type="button"
        disabled={isPending}
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
      >
        <Chrome className="size-4" />
        Continue with Google
      </Button>

      <div className="relative py-0.5">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <span className="divider-fade w-full" />
        </div>
        <div className="relative flex justify-center text-[10.5px] uppercase tracking-[0.08em]">
          <span className="bg-card px-2.5 text-muted-foreground/70">
            {authMode === "otp" ? "or with WhatsApp" : "or with email"}
          </span>
        </div>
      </div>

      {authMode === "password" ? (
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
                      className="h-10 rounded-lg text-[13px]"
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
                        className="h-10 rounded-lg pr-14 text-[13px]"
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
              className="button-sheen h-10 w-full rounded-lg text-[13px] font-semibold text-primary-foreground"
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
      ) : (
        <div className="space-y-3.5">
          {otpStep === "phone" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-foreground">
                  Mobile number
                </Label>
                <Input
                  placeholder="+91 98765 43210"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  className="h-10 rounded-lg text-[13px]"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={otpSending}
                />
                <p className="text-[11px] text-muted-foreground">
                  We&apos;ll send a one-time code to this number on WhatsApp.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleSendCode}
                disabled={otpSending}
                className="button-sheen h-10 w-full gap-2 rounded-lg text-[13px] font-semibold text-primary-foreground"
              >
                {otpSending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <MessageCircle className="size-4" />
                )}
                Send code
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[12px] font-medium text-foreground">
                    Enter code
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep("phone");
                      setCode("");
                    }}
                    className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    Change number
                  </button>
                </div>
                <Input
                  placeholder="6-digit code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  className="h-11 rounded-lg text-center text-[17px] font-semibold tracking-[0.5em]"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  disabled={otpVerifying}
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={otpSending}
                  className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  {otpSending ? "Resending…" : "Resend code"}
                </button>
              </div>
              <Button
                type="button"
                onClick={handleVerifyCode}
                disabled={otpVerifying}
                className="button-sheen h-10 w-full gap-2 rounded-lg text-[13px] font-semibold text-primary-foreground"
              >
                {otpVerifying ? (
                  <>
                    <Loader2 className="mr-2 size-3.5 animate-spin" />
                    Verifying…
                  </>
                ) : (
                  "Verify & sign in"
                )}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Toggle between password and WhatsApp OTP */}
      <button
        type="button"
        onClick={() => {
          setAuthMode((m) => (m === "password" ? "otp" : "password"));
          setOtpStep("phone");
          setCode("");
        }}
        className="flex w-full items-center justify-center gap-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground"
      >
        {authMode === "password" ? (
          <>
            <MessageCircle className="size-3.5" />
            Sign in with a WhatsApp code instead
          </>
        ) : (
          "Sign in with email & password instead"
        )}
      </button>

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
