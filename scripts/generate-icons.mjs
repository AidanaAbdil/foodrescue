// Generates the app icons from the leaf logo. Run with:  npm run icons
// Uses the Google Chrome installed on this Mac to turn SVG into PNG.
// Change BRAND / BACKGROUND / LEAF here if the logo or colours change.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const BRAND = "#c2553a"; // terracotta (--color-brand)
const LEAF = `
  <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
  <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />`;

// A square icon: terracotta background, white leaf taking up `scale` of the width.
// Maskable icons get a smaller leaf: Android may crop them to a circle.
function squareIcon(scale) {
  const size = 24 / scale;
  const offset = (size - 24) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-offset} ${-offset} ${size} ${size}">
  <rect x="${-offset}" y="${-offset}" width="${size}" height="${size}" fill="${BRAND}"/>
  <g fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${LEAF}</g>
</svg>`;
}

// Browser-tab icon: round, like the logo.
const roundIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 36 36">
  <circle cx="12" cy="12" r="18" fill="${BRAND}"/>
  <g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${LEAF}</g>
</svg>`;

const root = path.resolve(import.meta.dirname, "..");
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const work = mkdtempSync(path.join(tmpdir(), "icons-"));

// Headless Chrome writes the screenshot but doesn't always exit by itself,
// so wait for the file, then close Chrome.
async function png(svg, size, out) {
  const html = path.join(work, "icon.html");
  const target = path.join(root, out);
  writeFileSync(html, `<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  rmSync(target, { force: true });
  const proc = spawn(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${work}/profile`,
    `--window-size=${size},${size}`, "--default-background-color=00000000", `--screenshot=${target}`, `file://${html}`],
    { stdio: "ignore" });
  for (let waited = 0; !(existsSync(target) && statSync(target).size > 0); waited += 100) {
    if (waited > 30_000) throw new Error(`Chrome didn't produce ${out}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await new Promise((resolve) => setTimeout(resolve, 300)); // let it finish writing
  proc.kill();
  console.log("✓", out);
}

writeFileSync(path.join(root, "src/app/icon.svg"), roundIcon); // browser tab
console.log("✓ src/app/icon.svg");
await png(squareIcon(0.62), 180, "src/app/apple-icon.png"); // iPhone home screen (iOS rounds the corners)
await png(squareIcon(0.62), 192, "public/icons/icon-192.png");
await png(squareIcon(0.62), 512, "public/icons/icon-512.png");
await png(squareIcon(0.45), 512, "public/icons/maskable-512.png");
