import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Palette mirrors ThreatBubbleChart's CATEGORY_PALETTE so generated
// thumbnails feel visually coherent with the bubble chart.
const THUMB_PALETTE = [
  "#f87171", "#fb923c", "#facc15", "#4ade80", "#22d3ee",
  "#60a5fa", "#a78bfa", "#f472b6", "#34d399", "#fbbf24",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Build a deterministic, brand-styled SVG thumbnail.
 *  Layout: site grid background + centered `web3threat.actor` wordmark,
 *  with a thin category-colored accent bar at the bottom so different
 *  categories remain visually distinguishable. */
export function generateThumbnail(_name: string, category: string): string {
  const accent = THUMB_PALETTE[hashString(category) % THUMB_PALETTE.length];
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>` +
      `<defs>` +
        `<pattern id='grid' width='16' height='16' patternUnits='userSpaceOnUse'>` +
          `<path d='M16 0H0V16' fill='none' stroke='#ffffff' stroke-opacity='0.04' stroke-width='1'/>` +
        `</pattern>` +
      `</defs>` +
      `<rect width='200' height='200' fill='#0a0a0a'/>` +
      `<rect width='200' height='200' fill='url(#grid)'/>` +
      // Centered wordmark: web3threat.actor in brand colors
      `<text x='100' y='106' font-family='Inter, system-ui, sans-serif' font-weight='800' font-size='22' letter-spacing='-1' text-anchor='middle'>` +
        `<tspan fill='#ef4444'>web3</tspan>` +
        `<tspan fill='#a3a3a3'>threat</tspan>` +
        `<tspan fill='#525252'>.actor</tspan>` +
      `</text>` +
      // Category accent bar at bottom
      `<rect x='0' y='192' width='200' height='8' fill='${accent}'/>` +
    `</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Build a Twitter/X intent URL for sharing an exploit card. */
export function buildShareUrl(opts: {
  title: string;
  loss?: string | null;
  date?: string;
  attackVector?: string;
  exploitId: string;
}): string {
  const dateStr = opts.date
    ? new Date(opts.date).toLocaleDateString(undefined, { year: "numeric", month: "short" })
    : "";
  const lossPart = opts.loss ? `${opts.loss} lost in the ` : "";
  const vectorPart = opts.attackVector ? ` ${opts.attackVector}` : "";
  const datePart = dateStr ? ` (${dateStr})` : "";
  const text = `${lossPart}${opts.title}${vectorPart} exploit${datePart} — via web3threat.actor`;
  const url = `https://web3threat.actor/exploit/${opts.exploitId}`;
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}
