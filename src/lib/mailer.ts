// Sending email. No email service is connected yet, so during development
// messages are printed in the terminal running `npm run dev`. To go live,
// connect a service here (e.g. Resend) and set EMAIL_PROVIDER.
import "server-only";

import { headers } from "next/headers";

type Email = { to: string; subject: string; text: string };

export async function sendEmail(email: Email) {
  if (!process.env.EMAIL_PROVIDER) {
    if (process.env.NODE_ENV === "production") {
      // Don't pretend an email went out on the live site.
      console.error(`Email not sent (no EMAIL_PROVIDER configured): "${email.subject}" to ${email.to}`);
      return;
    }
    console.log(
      ["", "──────── 📧 Email (development: not actually sent) ────────", `To:      ${email.to}`,
        `Subject: ${email.subject}`, "", email.text, "────────────────────────────────────────────────────────", ""].join("\n"),
    );
    return;
  }
  throw new Error(`Unknown EMAIL_PROVIDER "${process.env.EMAIL_PROVIDER}"`);
}

// The site's address for links in emails and link previews: APP_URL if set (recommended once
// deployed), otherwise worked out from the current request.
export async function siteUrl() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
