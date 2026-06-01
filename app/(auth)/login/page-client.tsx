"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { Suspense, useState } from "react";

import { AlertCircle } from "lucide-react";

import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  // useSearchParams must be wrapped in a Suspense boundary, otherwise the whole
  // route bails out to client-side rendering (missingSuspenseWithCSRBailout),
  // which can surface as a root-level hydration mismatch.
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginFallback() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2 pb-8">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            File Share
          </span>
          <h1 className="text-balance text-2xl font-semibold text-gray-900">
            File Share By Starter Stack AI
          </h1>
          <p className="text-balance text-sm leading-relaxed text-gray-600">
            Sign in with your email to continue.
          </p>
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? undefined;
  const authError = searchParams?.get("error");
  const isSSORequired = authError === "require-saml-sso";

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [email, setEmail] = useState<string>("");
  const [emailButtonText, setEmailButtonText] = useState<string>(
    "Continue with Email",
  );

  const emailSchema = z
    .string()
    .trim()
    .toLowerCase()
    .min(3, { message: "Please enter a valid email." })
    .email({ message: "Please enter a valid email." });

  const emailValidation = emailSchema.safeParse(email);

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-2 pb-8">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            File Share
          </span>
          <h1 className="text-balance text-2xl font-semibold text-gray-900">
            File Share By Starter Stack AI
          </h1>
          <p className="text-balance text-sm leading-relaxed text-gray-600">
            Sign in with your email to continue.
          </p>
        </div>

        {isSSORequired && (
          <div className="mb-4 flex items-start gap-3 rounded-md border border-orange-200 bg-orange-50 px-4 py-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-orange-900">
                Your organization requires SSO login
              </p>
              <p className="mt-1 text-sm text-orange-700">
                Please contact your administrator to sign in with your
                company&apos;s identity provider.
              </p>
            </div>
          </div>
        )}

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!emailValidation.success) {
              toast.error(emailValidation.error.errors[0].message);
              return;
            }

            setIsSubmitting(true);
            signIn("email", {
              email: emailValidation.data,
              redirect: false,
              ...(next && next.length > 0 ? { callbackUrl: next } : {}),
            }).then((res) => {
              if (res?.ok && !res?.error) {
                // Store email so the verification page can use it directly.
                try {
                  sessionStorage.setItem(
                    "pendingVerificationEmail",
                    emailValidation.data,
                  );
                } catch {
                  // sessionStorage unavailable; verification page will redirect back.
                }
                router.push("/auth/email");
              } else {
                setEmailButtonText("Error sending email - try again?");
                toast.error("Error sending email - try again?");
                setIsSubmitting(false);
              }
            });
          }}
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="email" className="text-sm text-gray-900">
              Email
            </Label>
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isSubmitting}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={cn(
                "flex h-10 w-full rounded-md border-0 bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-gray-200 transition-colors placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-50",
                email.length > 0 && !emailValidation.success
                  ? "ring-red-500 focus-visible:ring-red-500"
                  : "ring-gray-200",
              )}
            />
          </div>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!emailValidation.success || isSubmitting}
            className="focus:shadow-outline w-full transform rounded-md bg-black px-4 py-2 text-white transition-colors duration-300 ease-in-out hover:bg-gray-900 focus:outline-none disabled:opacity-50"
          >
            {emailButtonText}
          </Button>
        </form>
      </div>
    </div>
  );
}
