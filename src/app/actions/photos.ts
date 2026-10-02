"use server";

import { getI18n } from "@/i18n/server";
import { requireOwner } from "@/lib/session";
import { savePhoto } from "@/lib/uploads";

export type UploadResult = { url: string } | { error: string };

// Called by the photo picker as soon as an owner chooses a photo, so the
// photo isn't lost if another field in the bag form has an error.
export async function uploadBagPhoto(formData: FormData): Promise<UploadResult> {
  await requireOwner();
  const t = (await getI18n()).dict.photo;

  const file = formData.get("photo");
  if (!(file instanceof File)) return { error: t.failed };

  const result = await savePhoto(file);
  if ("url" in result) return result;
  return { error: result.error === "size" ? t.tooBig : t.wrongType };
}
