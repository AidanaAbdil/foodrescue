import type { MetadataRoute } from "next";

// robots.txt: on a demo site (DEMO=true) ask search engines to stay away.
export default function robots(): MetadataRoute.Robots {
  return process.env.DEMO === "true"
    ? { rules: { userAgent: "*", disallow: "/" } }
    : { rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/orders", "/pay"] } };
}
