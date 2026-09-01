import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://attendance-hq.com";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/qr-code-attendance", changefreq: "weekly", priority: "0.9" },
  { path: "/club-attendance-tracker", changefreq: "weekly", priority: "0.9" },
  { path: "/greek-life-attendance", changefreq: "weekly", priority: "0.9" },
  { path: "/church-attendance-app", changefreq: "weekly", priority: "0.9" },
  { path: "/pre-event-headcount", changefreq: "weekly", priority: "0.9" },
  { path: "/attendance-reports", changefreq: "weekly", priority: "0.9" },
  { path: "/club-officer-roles", changefreq: "weekly", priority: "0.8" },
  { path: "/vs-google-forms", changefreq: "monthly", priority: "0.7" },
  { path: "/help", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/sign-in", changefreq: "yearly", priority: "0.4" },
  { path: "/sign-up", changefreq: "yearly", priority: "0.4" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = ENTRIES.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");
        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
