// Uploaded bag photos, stored as files in ./uploads and served by
// src/app/uploads/[file]/route.ts at /uploads/<name>.
//
// Local disk is fine for development. Once the site is deployed, this module
// is the one place to switch to cloud storage (e.g. S3 or Cloudflare R2).
import "server-only";

import { randomUUID } from "node:crypto";
import { access, mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

const TYPES = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;
type Extension = keyof typeof TYPES;

// Only names we generate: a UUID plus a known extension. Checking this before
// touching the disk also blocks tricks like "../../.env".
const FILE_NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;
const UPLOAD_URL = /^\/uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/;

// Identify the image type from the file's first bytes ("magic numbers")
// rather than trusting its name or the browser-reported type.
function detectType(bytes: Buffer): Extension | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export type SaveResult = { url: string } | { error: "type" | "size" };

export async function savePhoto(file: File): Promise<SaveResult> {
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) return { error: "size" };
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = detectType(bytes);
  if (!ext) return { error: "type" };

  const name = `${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), bytes);
  return { url: `/uploads/${name}` };
}

// Is this one of our upload URLs (and does the file still exist)?
export async function uploadExists(url: string) {
  const name = url.match(UPLOAD_URL)?.[1];
  if (!name) return false;
  try {
    await access(path.join(UPLOAD_DIR, name));
    return true;
  } catch {
    return false;
  }
}

// Delete an uploaded photo once nothing uses it any more. A regular bag's
// photo is shared by its schedule and every bag published from it, so check
// all of them. Ignores non-upload URLs (like the sample-data photos).
export async function deleteUploadIfUnused(url: string | null | undefined) {
  const name = url?.match(UPLOAD_URL)?.[1];
  if (!name) return;
  const [bags, schedules] = await Promise.all([
    prisma.surpriseBag.count({ where: { imageUrl: url } }),
    prisma.bagSchedule.count({ where: { imageUrl: url } }),
  ]);
  if (bags + schedules === 0) await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}

// Photos uploaded but never saved with a bag (the owner closed the form).
// Deletes uploads older than a day that no bag uses.
export async function cleanUpAbandonedUploads() {
  let names: string[];
  try {
    names = (await readdir(UPLOAD_DIR)).filter((name) => FILE_NAME.test(name));
  } catch {
    return; // no uploads folder yet
  }
  const where = { imageUrl: { startsWith: "/uploads/" } };
  const inUse = new Set(
    [
      ...(await prisma.surpriseBag.findMany({ where, select: { imageUrl: true } })),
      ...(await prisma.bagSchedule.findMany({ where, select: { imageUrl: true } })),
    ].map((row) => row.imageUrl),
  );
  const dayAgo = Date.now() - 86_400_000;
  for (const name of names) {
    if (inUse.has(`/uploads/${name}`)) continue;
    const file = path.join(UPLOAD_DIR, name);
    const { mtimeMs } = await stat(file);
    if (mtimeMs < dayAgo) await unlink(file).catch(() => {});
  }
}

// For the file-serving route.
export async function readUpload(name: string) {
  if (!FILE_NAME.test(name)) return null;
  try {
    const bytes = await readFile(path.join(UPLOAD_DIR, name));
    return { bytes, contentType: TYPES[name.split(".").pop() as Extension] };
  } catch {
    return null;
  }
}
