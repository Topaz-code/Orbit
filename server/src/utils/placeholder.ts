/**
 * Deterministic local media generation.
 *
 * The spec allowed DiceBear + picsum.photos, but Orbit's promise is "zero external service
 * dependencies", and many self-hosting environments (including air-gapped laptops) cannot reach
 * them. We generate avatars, covers and photo placeholders as SVG files on disk instead, seeded
 * from a string so the same user always gets the same art.
 */
import fs from 'node:fs';
import path from 'node:path';
import { UPLOADS_DIR } from '../config/paths.js';
import { seededRandom } from './helpers.js';

const PALETTES: Array<[string, string]> = [
  ['#6366f1', '#8b5cf6'],
  ['#06b6d4', '#3b82f6'],
  ['#f59e0b', '#ef4444'],
  ['#22c55e', '#06b6d4'],
  ['#ec4899', '#8b5cf6'],
  ['#14b8a6', '#6366f1'],
  ['#f97316', '#ec4899'],
  ['#8b5cf6', '#0ea5e9'],
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

function writeSvg(category: string, filename: string, svg: string): string {
  const dir = path.join(UPLOADS_DIR, category);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), svg, 'utf8');
  return `/uploads/${category}/${filename}`;
}

/** Circular gradient avatar with initials — the DiceBear replacement. */
export function generateAvatar(seed: string, displayName: string): string {
  const random = seededRandom(seed);
  const [from, to] = PALETTES[Math.floor(random() * PALETTES.length)]!;
  const rotation = Math.floor(random() * 360);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200" role="img" aria-label="${displayName}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${rotation} 0.5 0.5)">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#g)"/>
  <circle cx="${40 + random() * 120}" cy="${30 + random() * 60}" r="${20 + random() * 40}" fill="#ffffff" opacity="0.12"/>
  <circle cx="${20 + random() * 160}" cy="${120 + random() * 60}" r="${25 + random() * 45}" fill="#ffffff" opacity="0.10"/>
  <text x="100" y="100" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="78" font-weight="700"
        fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initials(displayName)}</text>
</svg>`;
  return writeSvg('avatars', `${seed}.svg`, svg);
}

/** Wide gradient banner with orbital rings — used for profile and group covers. */
export function generateCover(seed: string, category: 'covers' | 'groups' = 'covers'): string {
  const random = seededRandom(`cover-${seed}`);
  const [from, to] = PALETTES[Math.floor(random() * PALETTES.length)]!;
  const rings = Array.from({ length: 5 }, (_, index) => {
    const cx = random() * 1200;
    const cy = random() * 400;
    const r = 60 + random() * 220;
    return `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${r.toFixed(0)}" ry="${(r * 0.42).toFixed(0)}" fill="none" stroke="#ffffff" stroke-opacity="${(0.05 + random() * 0.12).toFixed(2)}" stroke-width="${(1 + random() * 2).toFixed(1)}" transform="rotate(${(random() * 60 - 30).toFixed(0)} ${cx.toFixed(0)} ${cy.toFixed(0)})"/>`;
  }).join('\n  ');
  const stars = Array.from({ length: 40 }, () => {
    const cx = (random() * 1200).toFixed(0);
    const cy = (random() * 400).toFixed(0);
    const r = (random() * 1.8 + 0.4).toFixed(1);
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" opacity="${(0.15 + random() * 0.5).toFixed(2)}"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs><linearGradient id="c" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${from}"/><stop offset="55%" stop-color="${to}"/><stop offset="100%" stop-color="#0f172a"/>
  </linearGradient></defs>
  <rect width="1200" height="400" fill="url(#c)"/>
  ${stars}
  ${rings}
</svg>`;
  return writeSvg(category, `${seed}.svg`, svg);
}

/** Abstract "photo" for demo posts and stories — the picsum.photos replacement. */
export function generatePhoto(
  seed: string,
  label: string,
  category: 'posts' | 'stories' | 'messages' = 'posts',
  aspect: 'landscape' | 'portrait' = 'landscape',
): string {
  const random = seededRandom(`photo-${seed}`);
  const [from, to] = PALETTES[Math.floor(random() * PALETTES.length)]!;
  const width = aspect === 'landscape' ? 1080 : 720;
  const height = aspect === 'landscape' ? 720 : 1280;

  const blobs = Array.from({ length: 7 }, () => {
    const cx = (random() * width).toFixed(0);
    const cy = (random() * height).toFixed(0);
    const r = (random() * width * 0.32 + width * 0.08).toFixed(0);
    const color = random() > 0.5 ? '#ffffff' : '#0f172a';
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${(0.05 + random() * 0.16).toFixed(2)}"/>`;
  }).join('');

  const bars = Array.from({ length: 12 }, (_, index) => {
    const x = (index * width) / 12;
    const h = random() * height * 0.5;
    return `<rect x="${x.toFixed(0)}" y="${(height - h).toFixed(0)}" width="${(width / 12 - 6).toFixed(0)}" height="${h.toFixed(0)}" fill="#ffffff" opacity="${(0.04 + random() * 0.08).toFixed(2)}" rx="8"/>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>
  </linearGradient></defs>
  <rect width="${width}" height="${height}" fill="url(#p)"/>
  ${blobs}${bars}
  <text x="${width / 2}" y="${height - 48}" font-family="Inter, ui-sans-serif, system-ui, sans-serif" font-size="34" font-weight="600"
        fill="#ffffff" fill-opacity="0.92" text-anchor="middle">${escapeXml(label)}</text>
</svg>`;
  return writeSvg(category, `${seed}.svg`, svg);
}

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
