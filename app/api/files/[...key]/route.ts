import { NextRequest, NextResponse } from "next/server";
import { readStoredFile } from "@/lib/upload";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
};

/** Serves public files (product images, logo). Private files are never served here. */
export async function GET(_req: NextRequest, { params }: { params: { key: string[] } }) {
  const key = params.key.join("/");
  if (!key.startsWith("public/") || key.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const bytes = await readStoredFile(key);
    const ext = key.split(".").pop()?.toLowerCase() || "";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": TYPES[ext] || "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
        // SVGs can contain scripts; never let them run in our origin.
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
