/**
 * Post-build script: reads db.json and generates per-exploit HTML files
 * with correct OG / Twitter Card meta tags so crawlers see the right
 * title, description, and thumbnail for shared links.
 *
 * Each generated file is a copy of dist/index.html with injected meta tags.
 * The SPA client-side router handles the actual rendering.
 *
 * Run after `vite build`: tsx scripts/prerender-og.ts
 */
import fs from "node:fs";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname, "..", "dist");
const DB_PATH = path.join(DIST, "db.json");
const TEMPLATE_PATH = path.join(DIST, "index.html");
const SITE_URL = process.env.SITE_URL || "https://web3threat.actor";

interface Exploit {
  id: string;
  attack_type: string;
  thumbnail?: string | null;
  affected_protocol: { name: string; version: string | null };
  date: string;
  chain: string;
  loss_amount: string | null;
  severity: string;
  description: string;
}

interface AttackType {
  id: string;
  name: string;
  category: string;
}

interface DB {
  attack_types: AttackType[];
  exploits: Exploit[];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function main() {
  const db: DB = JSON.parse(fs.readFileSync(DB_PATH, "utf-8"));
  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  let generated = 0;

  for (const exploit of db.exploits) {
    const attackType = db.attack_types.find(
      (t) => t.id === exploit.attack_type
    );
    const title = `${exploit.affected_protocol.name} — ${attackType?.name || exploit.attack_type}`;
    const description = exploit.description;
    const url = `${SITE_URL}/exploit/${exploit.id}`;

    // Resolve thumbnail: use the exploit's thumbnail if set, otherwise the
    // site-level fallback (the SVG fallback is data-URI and won't work for
    // OG images, so we use a static site logo instead).
    const image = exploit.thumbnail
      ? `${SITE_URL}${exploit.thumbnail}`
      : `${SITE_URL}/favicon.png`;

    const metaTags = [
      // Open Graph
      `<meta property="og:type" content="article" />`,
      `<meta property="og:url" content="${escapeHtml(url)}" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(description)}" />`,
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
      `<meta property="og:site_name" content="web3threat.actor" />`,
      // Twitter Card
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    ].join("\n    ");

    // Strip existing homepage OG / Twitter meta tags so crawlers only see
    // the exploit-specific ones we inject below.
    const stripped = template
      .replace(/<meta\s+(?:property="og:|name="twitter:)[^>]*\/>\s*\n?/g, "");

    const html = stripped
      .replace(
        "<title>web3threat.actor</title>",
        `<title>${escapeHtml(title)} | web3threat.actor</title>\n    ${metaTags}`
      );

    const dir = path.join(DIST, "exploit", exploit.id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), html);
    generated++;
  }

  console.log(`[prerender-og] Generated ${generated} exploit pages with OG meta tags.`);

  // GitHub Pages SPA fallback: copy index.html → 404.html so all routes
  // resolve to the SPA shell instead of returning a real 404.
  fs.copyFileSync(TEMPLATE_PATH, path.join(DIST, "404.html"));
  console.log("[prerender-og] Created 404.html SPA fallback.");
}

main();
