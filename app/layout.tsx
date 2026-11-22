import type { Metadata } from "next";
import "./globals.css";
import { getSettings } from "@/lib/settings";

/** Tab title follows the company name in Settings. */
export async function generateMetadata(): Promise<Metadata> {
  let company = "AURELIA GROUP d.o.o.";
  try {
    company = (await getSettings()).companyName || company;
  } catch {
    /* database not reachable at build time */
  }
  return {
    title: `Distribution Hub — ${company}`,
    description: "Sales CRM for distributing digital products: catalog, sellers, materials, leads and quotes.",
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans text-ink-900 antialiased">{children}</body>
    </html>
  );
}
