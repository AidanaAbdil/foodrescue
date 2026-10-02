import { readUpload } from "@/lib/uploads";

// Serves uploaded photos: GET /uploads/<uuid>.jpg
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[file]">) {
  const { file } = await ctx.params;
  const upload = await readUpload(file);
  if (!upload) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(upload.bytes), {
    headers: {
      "Content-Type": upload.contentType,
      // File names are random and never reused, so browsers can cache forever.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Never let the browser treat an upload as anything but an image.
      "X-Content-Type-Options": "nosniff",
    },
  });
}
