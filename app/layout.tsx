import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sales CRM — digital products distribution",
  description: "Sales CRM for distributing digital products: catalog, sellers, materials, leads and quotes.",
};

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
