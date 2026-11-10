import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import path from "path";

/** Public files (product images, logo) — served directly by Next.js. */
const PUBLIC_ROOT = path.join(process.cwd(), "public", "uploads");
/**
 * Private files (sales materials) — NOT under /public, so they can only be
 * downloaded through /api/materials/[id] (which checks product access) or a
 * tracked client link (/s/[token]).
 */
const PRIVATE_ROOT = path.join(process.cwd(), "storage");

function uniqueName(originalName: string) {
  const safeBase = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-60) || "file";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}`;
}

/** Saves an image/logo to /public/uploads/<subdir>/ and returns its public URL. */
export async function saveUploadedFile(
  file: File,
  subdir: string
): Promise<{ url: string; fileType: string }> {
  const dir = path.join(PUBLIC_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const name = uniqueName(file.name);
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return { url: `/uploads/${subdir}/${name}`, fileType: file.type || "application/octet-stream" };
}

/** Saves a file to private storage and returns the relative storage path. */
export async function savePrivateFile(
  file: File,
  subdir: string
): Promise<{ storagePath: string; fileName: string; fileType: string; fileSize: number }> {
  const dir = path.join(PRIVATE_ROOT, subdir);
  await mkdir(dir, { recursive: true });
  const name = uniqueName(file.name);
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return {
    storagePath: `${subdir}/${name}`,
    fileName: file.name || name,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

function resolvePrivate(storagePath: string): string {
  const full = path.resolve(PRIVATE_ROOT, storagePath);
  // Never allow escaping the storage folder.
  if (!full.startsWith(path.resolve(PRIVATE_ROOT) + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return full;
}

export async function readPrivateFile(storagePath: string): Promise<Buffer> {
  return readFile(resolvePrivate(storagePath));
}

export async function deletePrivateFile(storagePath: string | null | undefined) {
  if (!storagePath) return;
  try {
    await unlink(resolvePrivate(storagePath));
  } catch {
    // Already gone — nothing to do.
  }
}
