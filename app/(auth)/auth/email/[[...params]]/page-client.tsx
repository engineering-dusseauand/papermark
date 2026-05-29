"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const BRAND_NAME = "File Share By Starter Stack AI";

export default function EmailVerificationClient() {
  const router = useRouter();
  const codeInputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    let pendingEmail: string | null = null;
    try {
      pendingEmail = sessionStorage.getItem("pendingVerificationEmail");
    } catch {
      // sessionStorage not available
    }

    // The email is collected on the login step. If it's missing (e.g. direct
    // navigation), send the user back to re-enter it instead of asking here.
    if (!pendingEmail) {
      router.replace("/login");
      return;
    }

    setEmail(pendingEmail);
    setTimeout(() => {
      codeInputRef.current?.focus();
    }, 100);
  }, [router]);

  // Code verification
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim().toUpperCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (
          response.status === 410 ||
          response.status === 401 ||
          data.error?.includes("expired") ||
          data.error?.includes("Invalid code")
        ) {
          setIsExpired(true);
          setError("This code has expired or is invalid.");
        } else if (response.status === 429) {
          setError(
            data.error || "Too many attempts. Please wait before trying again.",
          );
        } else {
          setError(data.error || "Verification failed. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      // Successful verification - clear the stored email and redirect.
      try {
        sessionStorage.removeItem("pendingVerificationEmail");
      } catch {
        // ignore
      }

      if (data.callbackUrl) {
        router.push(data.callbackUrl);
      } else {
        // No callback URL in response - stop loading and show error
        setIsLoading(false);
        setError(
          "Unable to complete sign-in: missing callback URL. Please try again.",
        );
      }
    } catch (err) {
      setError("An error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  if (isExpired) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-white px-4">
        <div className="w-full max-w-md">
          <div className="items-left flex flex-col space-y-3 py-6">
            <span className="mb-10 self-start text-lg font-semibold text-gray-900">
              {BRAND_NAME}
            </span>
            <span className="text-balance text-3xl font-semibold text-gray-900">
              Code Expired
            </span>
            <h3 className="text-balance text-sm text-gray-800">
              This login code has expired or has already been used.
            </h3>
          </div>
          <div className="flex flex-col gap-4 pt-4">
            <Link href="/login">
              <Button className="focus:shadow-outline w-full transform rounded-[4px] bg-black px-4 py-2 text-white transition-colors duration-300 ease-in-out hover:bg-gray-900 focus:outline-none">
                Request a new code
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white px-4">
      <div className="w-full max-w-md">
        <div className="items-left flex flex-col space-y-3 py-6">
          <span className="mb-10 self-start text-lg font-semibold text-gray-900">
            {BRAND_NAME}
          </span>
          <span className="text-balance text-3xl font-semibold text-gray-900">
            Check your email
          </span>
          <h3 className="text-balance text-sm text-gray-800">
            We sent a login code to{" "}
            <span className="font-medium">{email}</span>
          </h3>
        </div>

        <form className="flex flex-col gap-4 pt-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              ref={codeInputRef}
              id="code"
              placeholder="Enter 10-character code"
              type="text"
              autoCapitalize="characters"
              autoComplete="one-time-code"
              autoCorrect="off"
              disabled={isLoading}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={10}
              className="flex h-10 w-full rounded-[4px] border-0 bg-background bg-white px-3 py-2 font-mono text-lg tracking-widest text-gray-900 ring-1 ring-gray-200 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground placeholder:font-sans placeholder:text-sm placeholder:tracking-normal focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            loading={isLoading}
            disabled={isLoading || !email || code.length < 10}
            className="focus:shadow-outline w-full transform rounded-[4px] bg-black px-4 py-2 text-white transition-colors duration-300 ease-in-out hover:bg-gray-900 focus:outline-none disabled:opacity-100"
          >
            Verify
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Didn&apos;t receive a code?{" "}
          <Link href="/login" className="text-gray-900 underline">
            Try again
          </Link>
        </p>
      </div>
    </div>
  );
}
