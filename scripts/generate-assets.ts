/**
 * Generates all original placeholder artwork (SVG) and sound effects (WAV).
 * Run: npm run assets
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATALOG, slugify, type Pattern, type WeaponType } from "../server/db/catalog.js";

const OUT = path.resolve("web/public/assets");
for (const d of ["skins", "cases", "icons", "avatars", "sounds"]) mkdirSync(path.join(OUT, d), { recursive: true });

// ---------------------------------------------------------------- deterministic RNG
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- weapon silhouettes (original, stylised)
type Shape = string; // polygon points, or "r:x,y,w,h,rx" for rounded rects
const WEAPONS: Record<WeaponType, Shape[]> = {
  rifle: [
    "18,118 92,104 100,104 100,150 70,170 20,168 14,150",
    "96,96 300,96 312,108 312,140 96,140",
    "300,104 400,104 404,134 300,134",
    "400,112 492,112 492,124 400,124",
    "380,88 392,88 392,104 380,104",
    "150,80 250,80 256,96 144,96",
    "222,138 256,138 270,204 240,212",
    "150,138 182,138 172,192 146,190",
  ],
  smg: [
    "40,110 110,104 110,138 60,150 40,146",
    "106,92 330,92 340,104 340,138 106,138",
    "336,108 430,108 430,122 336,122",
    "250,136 278,136 282,214 254,214",
    "150,136 182,136 174,196 146,194",
    "180,78 280,78 284,92 176,92",
  ],
  pistol: [
    "120,84 380,84 392,96 392,126 120,126",
    "130,124 360,124 350,140 260,140",
    "150,124 220,124 238,222 172,228 160,200",
    "220,138 266,138 262,166 228,160",
    "392,100 410,100 410,116 392,116",
  ],
  sniper: [
    "10,120 110,108 120,108 120,150 90,164 24,170 10,156",
    "116,104 300,104 306,140 116,140",
    "300,114 500,112 500,122 300,126",
    "r:144,68,152,24,12",
    "180,88 192,88 192,104 180,104",
    "250,88 262,88 262,104 250,104",
    "220,138 248,138 252,176 222,176",
    "130,138 160,138 152,190 126,188",
    "420,124 428,124 444,180 436,182",
  ],
  shotgun: [
    "16,116 110,104 116,104 116,146 80,166 22,166 12,150",
    "112,100 260,100 266,140 112,140",
    "260,104 488,104 488,120 260,120",
    "r:300,122,140,20,6",
    "140,138 172,138 162,188 136,186",
  ],
  knife: [
    "200,118 440,104 492,96 470,124 420,142 200,144",
    "r:184,96,22,68,6",
    "60,112 190,112 190,148 70,152 50,140",
    "r:36,114,28,38,10",
  ],
  gloves: [
    "r:176,30,34,70,16",
    "r:214,18,34,82,16",
    "r:252,22,34,78,16",
    "r:290,38,32,64,16",
    "r:172,70,152,112,26",
    "320,108 372,84 392,100 384,120 336,160",
    "r:166,170,166,64,14",
  ],
};

function shapeEl(s: Shape, attrs = ""): string {
  if (s.startsWith("r:")) {
    const [x, y, w, h, rx] = s.slice(2).split(",");
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${attrs}/>`;
  }
  return `<polygon points="${s}" ${attrs}/>`;
}

// ---------------------------------------------------------------- patterns
function patternDefs(id: string, p: Pattern, c: [string, string, string], seed: string): { defs: string; overlay: string } {
  const r = rng(seed);
  switch (p) {
    case "stripes":
      return {
        defs: `<pattern id="${id}" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><rect width="28" height="28" fill="${c[1]}"/><rect width="12" height="28" fill="${c[0]}" opacity=".9"/><rect x="20" width="3" height="28" fill="${c[2]}" opacity=".6"/></pattern>`,
        overlay: `<rect width="512" height="256" fill="url(#${id})"/>`,
      };
    case "hex": {
      const hex = "M14 0 L28 8 L28 24 L14 32 L0 24 L0 8 Z";
      return {
        defs: `<pattern id="${id}" width="28" height="48" patternUnits="userSpaceOnUse"><rect width="28" height="48" fill="${c[2]}"/><path d="${hex}" fill="none" stroke="${c[0]}" stroke-width="1.6" opacity=".85"/><path d="${hex}" transform="translate(14 24)" fill="${c[1]}" fill-opacity=".35" stroke="${c[0]}" stroke-width="1.2" opacity=".7"/><path d="${hex}" transform="translate(-14 24)" fill="${c[1]}" fill-opacity=".35" stroke="${c[0]}" stroke-width="1.2" opacity=".7"/></pattern>`,
        overlay: `<rect width="512" height="256" fill="url(#${id})"/>`,
      };
    }
    case "circuit": {
      let d = "";
      let dots = "";
      for (let i = 0; i < 26; i++) {
        const x = Math.round(r() * 512);
        const y = Math.round(r() * 256);
        const len = 20 + Math.round(r() * 70);
        const dir = r() > 0.5 ? 1 : -1;
        d += `M${x} ${y} h${len * dir} l${14 * dir} ${r() > 0.5 ? 14 : -14} h${Math.round(len / 2) * dir} `;
        dots += `<circle cx="${x}" cy="${y}" r="3.2" fill="${c[0]}"/>`;
      }
      return {
        defs: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[2]}"/><stop offset="1" stop-color="${c[1]}"/></linearGradient>`,
        overlay: `<rect width="512" height="256" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${c[0]}" stroke-width="2" opacity=".9"/>${dots}`,
      };
    }
    case "camo": {
      let blobs = "";
      for (let i = 0; i < 46; i++) {
        const col = c[i % 3];
        blobs += `<ellipse cx="${(r() * 520).toFixed(0)}" cy="${(r() * 260).toFixed(0)}" rx="${(14 + r() * 34).toFixed(0)}" ry="${(8 + r() * 20).toFixed(0)}" transform="rotate(${(r() * 180).toFixed(0)} 256 128)" fill="${col}" opacity=".9"/>`;
      }
      return { defs: "", overlay: `<rect width="512" height="256" fill="${c[1]}"/>${blobs}` };
    }
    case "fade":
      return {
        defs: `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.3"><stop offset="0" stop-color="${c[2]}"/><stop offset=".45" stop-color="${c[1]}"/><stop offset="1" stop-color="${c[0]}"/></linearGradient>`,
        overlay: `<rect width="512" height="256" fill="url(#${id})"/>`,
      };
    case "carbon":
      return {
        defs: `<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${c[2]}"/><rect width="6" height="6" fill="${c[1]}" opacity=".8"/><rect x="6" y="6" width="6" height="6" fill="${c[1]}" opacity=".8"/></pattern><linearGradient id="${id}g" x1="0" x2="1"><stop offset="0" stop-color="${c[0]}" stop-opacity="0"/><stop offset=".5" stop-color="${c[0]}" stop-opacity=".55"/><stop offset="1" stop-color="${c[0]}" stop-opacity="0"/></linearGradient>`,
        overlay: `<rect width="512" height="256" fill="url(#${id})"/><rect y="104" width="512" height="26" fill="url(#${id}g)"/>`,
      };
    case "waves": {
      let paths = "";
      for (let i = 0; i < 12; i++) {
        const y = 10 + i * 22;
        paths += `<path d="M0 ${y} C 64 ${y - 14}, 128 ${y + 14}, 192 ${y} S 320 ${y - 14}, 384 ${y} S 512 ${y + 14}, 540 ${y}" fill="none" stroke="${i % 2 ? c[0] : c[1]}" stroke-width="${i % 2 ? 4 : 7}" opacity=".85"/>`;
      }
      return { defs: "", overlay: `<rect width="512" height="256" fill="${c[2]}"/>${paths}` };
    }
    case "shards": {
      let tris = "";
      for (let i = 0; i < 40; i++) {
        const x = r() * 512;
        const y = r() * 256;
        const s = 20 + r() * 60;
        tris += `<polygon points="${x.toFixed(0)},${y.toFixed(0)} ${(x + s).toFixed(0)},${(y + s * (r() - 0.5)).toFixed(0)} ${(x + s * (r() - 0.3)).toFixed(0)},${(y + s).toFixed(0)}" fill="${c[i % 3]}" opacity="${(0.55 + r() * 0.45).toFixed(2)}"/>`;
      }
      return { defs: "", overlay: `<rect width="512" height="256" fill="${c[1]}"/>${tris}` };
    }
  }
}

function skinSvg(slug: string, weapon: WeaponType, pattern: Pattern, colors: [string, string, string]): string {
  const shapes = WEAPONS[weapon];
  const id = slug.replace(/[^a-z0-9]/g, "");
  const { defs, overlay } = patternDefs(`p${id}`, pattern, colors, slug);
  const clip = shapes.map((s) => shapeEl(s)).join("");
  const outline = shapes.map((s) => shapeEl(s, `fill="none" stroke="#05060a" stroke-opacity=".65" stroke-width="2.5" stroke-linejoin="round"`)).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 256" width="512" height="256">
<defs>${defs}<clipPath id="c${id}">${clip}</clipPath>
<linearGradient id="h${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".35" stop-color="#fff" stop-opacity=".06"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
<radialGradient id="s${id}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="256" cy="232" rx="210" ry="14" fill="url(#s${id})"/>
<g clip-path="url(#c${id})">${overlay}<rect width="512" height="256" fill="url(#h${id})"/></g>
${outline}
</svg>`;
}

// ---------------------------------------------------------------- cases
const EMBLEMS: Record<string, (a: string) => string> = {
  starter: (a) => `<circle cx="128" cy="150" r="26" fill="none" stroke="${a}" stroke-width="6"/><circle cx="128" cy="150" r="9" fill="${a}"/>`,
  neon: (a) => `<path d="M136 118 L110 156 H128 L118 184 L148 142 H130 Z" fill="${a}"/>`,
  tactical: (a) => `<path d="M100 140 L128 124 L156 140 M100 160 L128 144 L156 160 M100 180 L128 164 L156 180" fill="none" stroke="${a}" stroke-width="7" stroke-linejoin="round"/>`,
  elite: (a) => `<path d="M128 120 L156 150 L128 182 L100 150 Z" fill="none" stroke="${a}" stroke-width="6"/><path d="M128 136 L142 150 L128 166 L114 150 Z" fill="${a}"/>`,
  shadow: (a) => `<path d="M140 124 A30 30 0 1 0 140 178 A24 24 0 1 1 140 124 Z" fill="${a}"/>`,
  spectrum: (a) => `<path d="M128 120 L158 176 H98 Z" fill="none" stroke="${a}" stroke-width="6" stroke-linejoin="round"/><path d="M128 146 L170 160" stroke="#ff7fc4" stroke-width="3"/><path d="M128 146 L170 168" stroke="#5ce1e6" stroke-width="3"/><path d="M128 146 L170 152" stroke="#f5ff6b" stroke-width="3"/>`,
};

function caseSvg(slug: string, accent: string): string {
  const emblem = (EMBLEMS[slug] ?? EMBLEMS.starter)(accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<defs>
<linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2f38"/><stop offset="1" stop-color="#14171c"/></linearGradient>
<linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a404b"/><stop offset="1" stop-color="#22262d"/></linearGradient>
<linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".9"/><stop offset="1" stop-color="${accent}" stop-opacity=".25"/></linearGradient>
<radialGradient id="g" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
<radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="128" cy="140" r="118" fill="url(#g)"/>
<ellipse cx="128" cy="222" rx="96" ry="12" fill="url(#sh)"/>
<rect x="40" y="96" width="176" height="120" rx="14" fill="url(#b)" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
<rect x="40" y="96" width="176" height="120" rx="14" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width="1.5"/>
<rect x="32" y="70" width="192" height="36" rx="10" fill="url(#l)" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
<rect x="32" y="70" width="192" height="6" rx="3" fill="#fff" opacity=".12"/>
<rect x="110" y="96" width="36" height="16" rx="4" fill="url(#a)"/>
<rect x="40" y="200" width="176" height="4" fill="url(#a)" opacity=".7"/>
<rect x="52" y="116" width="6" height="88" rx="3" fill="url(#a)" opacity=".5"/>
<rect x="198" y="116" width="6" height="88" rx="3" fill="url(#a)" opacity=".5"/>
${emblem}
</svg>`;
}

// ---------------------------------------------------------------- write SVGs
let count = 0;
for (const col of CATALOG) {
  writeFileSync(path.join(OUT, "cases", `${col.caseSlug}.svg`), caseSvg(col.caseSlug, col.accent));
  for (const s of col.skins) {
    const slug = slugify(`${s.weapon}-${s.name}`);
    writeFileSync(path.join(OUT, "skins", `${slug}.svg`), skinSvg(slug, s.weapon, s.pattern, s.colors));
    count++;
  }
}
// Generic placeholder for admin-created skins without an image yet.
writeFileSync(path.join(OUT, "skins", "placeholder.svg"), skinSvg("placeholder", "rifle", "carbon", ["#9aa4b2", "#3a404b", "#16191e"]));
writeFileSync(path.join(OUT, "cases", "placeholder.svg"), caseSvg("starter", "#9aa4b2"));

writeFileSync(
  path.join(OUT, "icons", "app.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b9bff"/><stop offset="1" stop-color="#5ce1e6"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="#101217"/><path d="M18 40c0 5 6 8 14 8s14-3 14-8-6-7-14-8-14-3-14-8 6-8 14-8 14 3 14 8" fill="none" stroke="url(#g)" stroke-width="5.5" stroke-linecap="round"/></svg>`,
);
writeFileSync(
  path.join(OUT, "avatars", "default.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2f38"/><stop offset="1" stop-color="#16191e"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="48" cy="38" r="16" fill="#4a505c"/><path d="M18 84c4-16 16-24 30-24s26 8 30 24" fill="#4a505c"/></svg>`,
);

// ---------------------------------------------------------------- sounds (synthesised, quiet)
function wav(seconds: number, fn: (t: number) => number): Buffer {
  const rate = 22050;
  const n = Math.floor(seconds * rate);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const v = Math.max(-1, Math.min(1, fn(i / rate)));
    buf.writeInt16LE(Math.round(v * 32767 * 0.35), 44 + i * 2);
  }
  return buf;
}
const env = (t: number, a: number, d: number) => (t < a ? t / a : Math.exp(-(t - a) / d));
const noise = rng("noise");
writeFileSync(path.join(OUT, "sounds", "tap.wav"), wav(0.06, (t) => Math.sin(2 * Math.PI * 1800 * t) * env(t, 0.002, 0.015)));
writeFileSync(
  path.join(OUT, "sounds", "open.wav"),
  wav(0.7, (t) => (noise() * 2 - 1) * 0.5 * env(t, 0.25, 0.15) * Math.sin(Math.PI * Math.min(1, t / 0.7)) + Math.sin(2 * Math.PI * (200 + 500 * t) * t) * 0.3 * env(t, 0.3, 0.2)),
);
writeFileSync(path.join(OUT, "sounds", "tick.wav"), wav(0.03, (t) => Math.sin(2 * Math.PI * 2600 * t) * env(t, 0.001, 0.006)));
writeFileSync(
  path.join(OUT, "sounds", "reveal.wav"),
  wav(0.9, (t) => (Math.sin(2 * Math.PI * 660 * t) * env(t, 0.005, 0.25) + Math.sin(2 * Math.PI * 990 * t) * env(Math.max(0, t - 0.12), 0.005, 0.3) * (t > 0.12 ? 1 : 0)) * 0.6),
);
writeFileSync(
  path.join(OUT, "sounds", "achievement.wav"),
  wav(1.0, (t) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    let v = 0;
    notes.forEach((f, i) => {
      const s = t - i * 0.1;
      if (s > 0) v += Math.sin(2 * Math.PI * f * s) * env(s, 0.005, 0.25) * 0.4;
    });
    return v;
  }),
);

console.log(`Generated ${count} skin images, ${CATALOG.length} cases, icons, avatar and 5 sounds.`);
