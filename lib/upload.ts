import { writeFile, mkdir, readFile, unlink } from "fs/promises";
import path from "path";

/**
 * File storage with two drivers:
 *
 * - "replit": Replit Object Storage. Used automatically on Replit (also in
 *   published deployments, whose disk is wiped on every republish).
 *   Create a bucket once in the Replit "Object Storage" tool.
 * - "local": the ./storage folder on disk, for running on your own machine
 *   or a server with a persistent disk.
 *
 * Override with STORAGE_DRIVER=local|replit.
 *
 * Every file is stored under a key. Keys starting with "public/" (product
 * images, logo) are served to anyone by /api/files/…; everything else
 * (sales materials) only through access-checked routes.
 */
const LOCAL_ROOT = path.join(process.cwd(), "storage");

function driver(): "replit" | "local" {
  const forced = process.env.STORAGE_DRIVER;
  if (forced === "local" || forced === "replit") return forced;
  return process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT ? "replit" : "local";
}

let replitClient: any = null;
async function replit() {
  if (!replitClient) {
    const mod: any = await import("@replit/object-storage");
    replitClient = new mod.Client();
  }
  return replitClient;
}

function bucketError(error: any): Error {
  return new Error(
    `File storage error: ${error?.message || error}. On Replit, open the "Object Storage" tool and create a bucket, then restart the app.`
  );
}

function uniqueName(originalName: string) {
  const safeBase = originalName.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-60) || "file";
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeBase}`;
}

function resolveLocal(key: string): string {
  const full = path.resolve(LOCAL_ROOT, key);
  // Never allow escaping the storage folder.
  if (!full.startsWith(path.resolve(LOCAL_ROOT) + path.sep)) throw new Error("Invalid storage path");
  return full;
}

async function putBytes(key: string, bytes: Buffer) {
  if (driver() === "replit") {
    const client = await replit();
    const res = await client.uploadFromBytes(key, bytes);
    if (res && res.ok === false) throw bucketError(res.error);
    return;
  }
  const full = resolveLocal(key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
}

export async function readStoredFile(key: string): Promise<Buffer> {
  if (key.includes("..")) throw new Error("Invalid storage path");
  if (driver() === "replit") {
    const client = await replit();
    const res = await client.downloadAsBytes(key);
    if (!res || res.ok === false) throw bucketError(res?.error || "not found");
    const value = Array.isArray(res.value) ? res.value[0] : res.value;
    return Buffer.from(value);
  }
  return readFile(resolveLocal(key));
}

export async function deleteStoredFile(key: string | null | undefined) {
  if (!key) return;
  try {
    if (driver() === "replit") {
      const client = await replit();
      await client.delete(key);
    } else {
      await unlink(resolveLocal(key));
    }
  } catch {
    // Already gone — nothing to do.
  }
}

/** Saves an image/logo that anyone may see; returns its public URL. */
export async function saveUploadedFile(
  file: File,
  subdir: string
): Promise<{ url: string; fileType: string }> {
  const key = `public/${subdir}/${uniqueName(file.name)}`;
  await putBytes(key, Buffer.from(await file.arrayBuffer()));
  return { url: `/api/files/${key}`, fileType: file.type || "application/octet-stream" };
}

/** Saves a private file (sales material); returns its storage key. */
export async function savePrivateFile(
  file: File,
  subdir: string
): Promise<{ storagePath: string; fileName: string; fileType: string; fileSize: number }> {
  const key = `private/${subdir}/${uniqueName(file.name)}`;
  await putBytes(key, Buffer.from(await file.arrayBuffer()));
  return {
    storagePath: key,
    fileName: file.name || key,
    fileType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

export async function readPrivateFile(storagePath: string): Promise<Buffer> {
  return readStoredFile(storagePath);
}

export async function deletePrivateFile(storagePath: string | null | undefined) {
  return deleteStoredFile(storagePath);
}
