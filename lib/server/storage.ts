import { randomBytes } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config, serverToday, storageEnabled } from "./config";
import { ApiError, badRequest } from "./http";

/*
 * Uploaded files live in a DigitalOcean Space (S3-compatible), in one folder
 * (DO_FOLDER, "Bills" unless set):  Bills/<villa id>/<YYYY-MM>/<random>-<file name>
 *
 * Files are private. The Space is shared with other sites and receipts can
 * hold personal details, so nobody can open one by guessing its address:
 * the app checks the villa, then hands out a link that works for 5 minutes.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

let client: S3Client | null = null;

/** The S3 endpoint is the region's address. A Space's own address (https://<space>.<region>...) is accepted too. */
function regionEndpoint() {
  const { endpoint, space } = config.storage;
  try {
    const u = new URL(endpoint);
    if (u.hostname.startsWith(`${space}.`)) u.hostname = u.hostname.slice(space.length + 1);
    return u.origin;
  } catch {
    return endpoint;
  }
}

function s3() {
  if (!storageEnabled()) throw new ApiError(503, "uploads_off", "File uploads are not set up yet. Please contact the platform administrator.");
  client ??= new S3Client({
    region: config.storage.region,
    endpoint: regionEndpoint(),
    // Spaces use <space>.<region>.digitaloceanspaces.com; only a local stand-in server (tests) needs the path form.
    forcePathStyle: /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(config.storage.endpoint),
    credentials: { accessKeyId: config.storage.accessKey, secretAccessKey: config.storage.secretKey },
  });
  return client;
}

/** The start of every key a villa may use, so one villa can never point at another's file. */
export const villaPrefix = (villaId: string) => `${config.storage.folder}/${villaId}/`;

const safeName = (name: string) =>
  name
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(-80) || "receipt";

/** Saves one receipt (a photo or a PDF) for the villa. Returns the key to keep and the original file name. */
export async function saveReceipt(villaId: string, file: File): Promise<{ key: string; name: string }> {
  if (!file || typeof file.arrayBuffer !== "function") throw badRequest("Choose a file to upload.");
  const ext = TYPES[file.type];
  if (!ext) throw badRequest("Receipts can be a photo (JPG, PNG, WebP, HEIC) or a PDF.");
  if (file.size === 0) throw badRequest("That file is empty.");
  if (file.size > MAX_BYTES) throw badRequest("That file is too big. Receipts can be up to 10 MB.");

  const base = safeName(file.name.replace(/\.[^.]+$/, ""));
  const key = `${villaPrefix(villaId)}${serverToday().slice(0, 7)}/${randomBytes(8).toString("hex")}-${base}.${ext}`;
  try {
    await s3().send(
      new PutObjectCommand({
        Bucket: config.storage.space,
        Key: key,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: file.type,
        ACL: "private",
        CacheControl: "private, max-age=0",
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("[storage] upload failed", error);
    throw new ApiError(502, "upload_failed", "The file could not be uploaded. Please try again.");
  }
  return { key, name: file.name.slice(0, 255) };
}

/** A link to the file that works for 5 minutes. */
export async function receiptLink(key: string, name?: string | null) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: config.storage.space,
      Key: key,
      ...(name ? { ResponseContentDisposition: `inline; filename="${safeName(name)}"` } : {}),
    }),
    { expiresIn: 300 },
  );
}

/** Removes a file. Never fails the request that called it: a file left behind only costs storage. */
export async function deleteStored(key: string | null | undefined) {
  if (!key || !storageEnabled()) return;
  try {
    await s3().send(new DeleteObjectCommand({ Bucket: config.storage.space, Key: key }));
  } catch (error) {
    console.error("[storage] could not delete", key, error);
  }
}
