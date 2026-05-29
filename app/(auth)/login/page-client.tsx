"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import { useState } from "react";

import { AlertCircle } from "lucide-react";

import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { z } from "zod";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { next } = useParams as { next?: string };
  const router = useRouter();
  const searchParams = useSearchParams();
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
      <div className="w-full max-w-md">
        <div className="items-left flex flex-col space-y-3 py-6">
          <Link href="https://www.papermark.com" target="_blank">
            <img
              src="/_static/papermark-logo.svg"
              alt="Papermark Logo"
              className="mb-10 h-7 w-auto self-start"
            />
          </Link>
          <Link href="/">
            <span className="text-balance text-3xl font-semibold text-gray-900">
              Welcome to Papermark
            </span>
          </Link>
          <h3 className="text-balance text-sm text-gray-800">
            Sign in with your email to continue.
          </h3>
        </div>

        {isSSORequired && (
          <div className="mb-2 flex items-start gap-3 rounded-[4px] border border-orange-200 bg-orange-50 px-4 py-3">
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
          className="flex flex-col gap-4 pt-4"
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
                // Store email in sessionStorage for the verification page
                try {
                  sessionStorage.setItem(
                    "pendingVerificationEmail",
                    emailValidation.data,
                  );
                } catch {
                  // sessionStorage not available, verification page will show email input
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
          <Label className="sr-only" htmlFor="email">
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
              "flex h-10 w-full rounded-[4px] border-0 bg-background bg-white px-3 py-2 text-sm text-gray-900 ring-1 ring-gray-200 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white",
              email.length > 0 && !emailValidation.success
                ? "ring-red-500"
                : "ring-gray-200",
            )}
          />
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!emailValidation.success || isSubmitting}
            className={cn(
              "focus:shadow-outline w-full transform rounded-[4px] px-4 py-2 text-white transition-colors duration-300 ease-in-out focus:outline-none disabled:opacity-100",
              "bg-black hover:bg-gray-900",
            )}
          >
            {emailButtonText}
          </Button>
        </form>

        <p className="mt-10 w-full text-xs text-muted-foreground">
          By continuing, you agree to Papermark&apos;s{" "}
          <a
            href="https://www.papermark.com/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="https://www.papermark.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Privacy Policy
          </a>
          .
        </p>
      </div>
    </div>
  );
}
