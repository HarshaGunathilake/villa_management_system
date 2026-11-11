import { requireVillaAdmin, requireVillaCanEdit } from "@/lib/server/auth";
import { badRequest, route } from "@/lib/server/http";
import { saveReceipt } from "@/lib/server/storage";

/**
 * Upload a receipt (a photo or a PDF) for the signed-in admin's own villa.
 * It is stored privately in the DigitalOcean Space under Bills/<villa>/; the
 * answer is the key to send with the expense or bill payment that it belongs to.
 */
export const POST = route(async (request) => {
  const { villaId } = await requireVillaAdmin();
  await requireVillaCanEdit(villaId);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Choose a file to upload.");
  const saved = await saveReceipt(villaId, file);
  return { ok: true, ...saved };
}, { fileUpload: true });
