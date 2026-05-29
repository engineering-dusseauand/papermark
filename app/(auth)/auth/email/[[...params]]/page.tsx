import { Metadata } from "next";

import EmailVerificationClient from "./page-client";

const data = {
  description: "Verify your login to File Share By Starter Stack AI",
  title: "Verify Login | File Share By Starter Stack AI",
  url: "/auth/email",
};

export const metadata: Metadata = {
  title: data.title,
  description: data.description,
  openGraph: {
    title: data.title,
    description: data.description,
    url: data.url,
    siteName: "File Share By Starter Stack AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: data.title,
    description: data.description,
  },
};

export default async function EmailVerificationPage() {
  return <EmailVerificationClient />;
}
