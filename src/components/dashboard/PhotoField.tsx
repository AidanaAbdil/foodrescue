"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { uploadBagPhoto } from "@/app/actions/photos";
import { useI18n } from "@/i18n/client";
import { Doodle } from "@/components/Doodle";

const MAX_SIDE = 1600; // px; plenty for a card and the bag page

// Only preview photos we serve ourselves or the sample-data host.
const isKnownPhoto = (url: string) => url.startsWith("/uploads/") || url.startsWith("https://images.unsplash.com/");

// Shrink a photo in the browser before uploading: a 6 MB phone photo becomes
// ~300 KB, which is much faster on mobile data. createImageBitmap also applies
// the camera's rotation (EXIF), so portrait photos don't end up sideways.
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ?? file;
  } catch {
    return file; // the browser can't read it; let the server decide
  }
}

// Photo picker for the bag form. The photo uploads as soon as it's chosen,
// and its URL travels with the form in a hidden "imageUrl" field.
export function PhotoField({ defaultUrl }: { defaultUrl?: string }) {
  const t = useI18n().dict.photo;
  const [url, setUrl] = useState(defaultUrl && isKnownPhoto(defaultUrl) ? defaultUrl : "");
  const [error, setError] = useState("");
  const [uploading, startUpload] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // so choosing the same file again still triggers
    if (!file) return;
    setError("");
    startUpload(async () => {
      const formData = new FormData();
      formData.set("photo", await shrink(file), "photo.jpg");
      try {
        const result = await uploadBagPhoto(formData);
        if ("url" in result) setUrl(result.url);
        else setError(result.error);
      } catch {
        setError(t.failed); // e.g. connection lost
      }
    });
  }

  const button =
    "rounded-lg bg-white px-3 py-1.5 text-sm font-semibold ring-1 ring-stone-300 hover:bg-stone-50 disabled:opacity-60";

  return (
    <div>
      <p className="text-sm font-medium text-stone-700">{t.label}</p>
      <p className="text-sm text-stone-500">{t.hint}</p>
      <input type="hidden" name="imageUrl" value={url} />
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleChange} className="hidden" />

      <div className="mt-2 flex items-center gap-4">
        <div className="relative grid aspect-[16/10] w-40 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand-light text-3xl">
          {url ? (
            <Image src={url} alt="" fill sizes="160px" className="object-cover" />
          ) : (
            <Doodle name="camera" size={40} className="text-brand" />
          )}
          {uploading && (
            <span className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-medium text-stone-700">
              {t.uploading}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={uploading} onClick={() => input.current?.click()} className={`${button} text-stone-800`}>
            {!url && <Doodle name="camera" size={16} className="mr-1.5" />}
            {url ? t.change : t.choose}
          </button>
          {url && !uploading && (
            <button type="button" onClick={() => setUrl("")} className={`${button} text-red-700`}>
              {t.remove}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
