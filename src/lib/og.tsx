// Link-preview images (Open Graph): the card WhatsApp, Telegram and others
// show when someone shares a link. Drawn on the server as a 1200×630 PNG.
import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { readUpload } from "@/lib/uploads";

export const OG_SIZE = { width: 1200, height: 630 };

// Noto Sans covers Russian and Kazakh letters and ₸ (see assets/fonts).
const fonts = Promise.all(
  (["Regular", "Bold"] as const).map(async (style) => ({
    name: "Noto Sans",
    data: await readFile(path.join(process.cwd(), `assets/fonts/NotoSans-${style}.ttf`)),
    weight: style === "Bold" ? (700 as const) : (400 as const),
    style: "normal" as const,
  })),
);

const BRAND = "#c2553a";

// Long names would run off the card: cut them with "…".
const short = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text);
const SAGE = "#e3ebdd";

// A photo the image renderer can draw: web addresses as they are, our own
// uploads as data. WebP isn't supported, so those fall back to the letter.
async function drawablePhoto(url: string | null | undefined) {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  const name = url.match(/^\/uploads\/(.+)$/)?.[1];
  const file = name ? await readUpload(name) : null;
  if (!file || file.contentType === "image/webp") return null;
  return `data:${file.contentType};base64,${file.bytes.toString("base64")}`;
}

type Card = {
  eyebrow: string; // small line above the title, e.g. the store name
  title: string;
  lines?: string[];
  price?: string;
  oldPrice?: string;
  badge?: string; // e.g. "−67%"
  photo?: string | null;
  letter?: string; // shown in a circle when there's no photo (emoji would need an outside service)
};

export async function ogImage(card: Card) {
  const photo = await drawablePhoto(card.photo);
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#faf8f5", fontFamily: "Noto Sans" }}>
        {/* Picture on the left */}
        <div style={{ display: "flex", width: 470, height: "100%", background: SAGE, alignItems: "center", justifyContent: "center", position: "relative" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- drawn into a PNG, not a web page
            <img src={photo} alt="" width={470} height={630} style={{ objectFit: "cover", width: 470, height: 630 }} />
          ) : (
            <div style={{ display: "flex", width: 220, height: 220, borderRadius: 999, background: BRAND, color: "white", fontSize: 120, fontWeight: 700, alignItems: "center", justifyContent: "center" }}>
              {(card.letter ?? "F").toUpperCase()}
            </div>
          )}
          {card.badge && (
            <div style={{ position: "absolute", top: 32, left: 32, background: "#5e7d5a", color: "white", fontSize: 34, fontWeight: 700, padding: "6px 20px", borderRadius: 999 }}>
              {card.badge}
            </div>
          )}
        </div>
        {/* Text on the right */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "56px 60px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 700, color: BRAND, marginBottom: 28 }}>
              <div style={{ width: 34, height: 34, borderRadius: 999, background: BRAND, marginRight: 12 }} />
              FoodRescue
            </div>
            <div style={{ fontSize: 30, color: "#78716c" }}>{short(card.eyebrow, 45)}</div>
            <div style={{ fontSize: 58, fontWeight: 700, color: "#1c1917", lineHeight: 1.15, marginTop: 10 }}>{short(card.title, 55)}</div>
            {(card.lines ?? []).map((line) => (
              <div key={line} style={{ fontSize: 30, color: "#57534e", marginTop: 14 }}>
                {short(line, 45)}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "baseline" }}>
            {card.price && <div style={{ fontSize: 64, fontWeight: 700, color: BRAND }}>{card.price}</div>}
            {card.oldPrice && (
              <div style={{ fontSize: 34, color: "#a8a29e", textDecoration: "line-through", marginLeft: 20 }}>{card.oldPrice}</div>
            )}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await fonts },
  );
}
