/**
 * Generates all original placeholder artwork (SVG) and sound effects (WAV).
 * Run: npm run assets
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { CATALOG, slugify, type Pattern, type WeaponModel } from "../server/db/catalog.js";

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

// ---------------------------------------------------------------- weapon silhouettes (CS2 models, original drawings)
// Shapes: polygon points, "r:x,y,w,h,rx" rounded rect, or "p:<svg path>" (even-odd fill for holes).
type Shape = string;
const WEAPONS: Record<WeaponModel, Shape[]> = {
  ak47: [
    "p:M10 116 L104 98 L112 98 L112 136 L98 140 L34 166 Q18 170 12 160 Z",
    "108,96 272,96 278,102 278,134 108,136",
    "118,88 264,88 270,96 112,96",
    "150,134 180,134 172,184 146,190 142,172",
    "p:M182 134 L214 134 L212 148 Q198 154 186 148 Z",
    "p:M224 134 L254 134 Q262 160 282 192 L256 206 Q236 172 224 134 Z",
    "278,108 372,108 372,134 278,134",
    "278,98 376,98 376,108 278,108",
    "372,111 478,111 478,119 372,119",
    "452,94 462,94 466,111 450,111",
    "r:476,106,20,18,3",
  ],
  m4a4: [
    "p:M16 108 L94 102 L100 102 L100 142 L70 152 L22 152 Q14 150 14 140 Z",
    "96,111 130,111 130,127 96,127",
    "126,98 278,98 286,108 286,138 126,138",
    "130,89 274,89 274,98 130,98",
    "134,78 152,78 154,89 132,89",
    "150,136 178,136 170,188 144,186",
    "p:M214 136 L244 136 L252 196 Q238 202 224 200 Z",
    "286,101 398,101 398,135 286,135",
    "378,82 390,82 394,101 374,101",
    "398,112 468,112 468,121 398,121",
    "r:466,107,26,19,4",
  ],
  awp: [
    "p:M4 122 L72 106 L134 106 L134 150 L116 150 Q110 130 96 130 Q86 132 84 150 L42 168 Q12 172 6 158 Z",
    "130,104 302,104 308,140 130,142",
    "302,112 488,110 488,121 302,125",
    "r:484,104,24,22,4",
    "r:156,72,128,20,10",
    "r:278,64,32,34,8",
    "r:138,68,24,28,7",
    "182,90 194,90 194,104 182,104",
    "250,90 262,90 262,104 250,104",
    "p:M200 108 L214 108 L226 126 Q220 132 212 128 Z",
    "228,140 254,140 256,170 230,170",
    "p:M420 124 L428 124 L446 186 L438 188 Z",
  ],
  deagle: [
    "p:M116 80 L402 80 L412 90 L412 130 L116 130 Q108 128 108 120 L108 92 Q108 82 116 80 Z",
    "104,84 120,84 120,104 104,104",
    "128,128 384,128 376,144 252,146",
    "p:M148 128 L228 128 L250 228 Q214 238 178 232 L160 204 Z",
    "p:M228 142 L276 142 L270 172 Q250 176 234 166 Z",
  ],
  glock: [
    "p:M150 92 L380 92 Q390 92 390 102 L390 128 L150 128 Z",
    "156,126 378,126 372,142 252,146",
    "p:M168 126 L232 126 L254 220 Q222 230 188 226 L178 200 Z",
    "p:M232 140 L278 140 L272 168 Q252 172 238 164 Z",
  ],
  usps: [
    "p:M108 92 L300 92 Q308 92 308 100 L308 128 L108 128 Z",
    "114,126 296,126 290,142 212,146",
    "p:M124 126 L188 126 L208 220 Q176 230 144 226 L134 200 Z",
    "p:M190 140 L232 140 L228 168 Q208 172 196 164 Z",
    "r:306,95,186,30,14",
  ],
  p90: [
    "p:M36 124 Q40 100 76 94 L380 90 Q424 96 432 124 Q430 146 390 152 L304 152 L284 194 Q266 202 248 196 L240 152 L126 152 L104 184 Q84 192 66 184 L64 154 Q38 148 36 124 Z",
    "r:146,72,236,18,6",
    "432,112 474,112 474,124 432,124",
    "p:M96 124 Q100 108 120 108 Q140 108 140 124 Z",
  ],
  mp9: [
    "p:M26 106 L110 106 L110 118 L44 118 L44 142 L26 142 Z",
    "106,96 334,96 342,106 342,134 106,134",
    "132,87 322,87 322,96 132,96",
    "p:M190 132 L222 132 L232 214 Q214 220 198 214 Z",
    "p:M290 132 L308 132 L304 172 L288 172 Z",
    "342,108 404,108 404,121 342,121",
  ],
  nova: [
    "p:M8 116 L104 104 L112 104 L112 144 L80 164 L22 164 Q8 160 8 148 Z",
    "108,100 248,100 254,140 108,140",
    "248,102 494,102 494,116 248,116",
    "248,118 440,118 440,129 248,129",
    "r:296,115,128,30,9",
    "p:M140 138 L172 138 L164 156 Q150 160 140 152 Z",
  ],
  xm1014: [
    "p:M14 110 L98 104 L104 104 L104 142 L64 152 L20 152 Q12 150 12 140 Z",
    "100,112 132,112 132,126 100,126",
    "128,98 272,98 278,140 128,140",
    "136,89 266,89 266,98 136,98",
    "150,138 178,138 170,188 144,186",
    "272,102 488,102 488,114 272,114",
    "272,117 432,117 432,131 272,131",
  ],
  karambit: [
    "p:M66 128 A36 36 0 1 0 138 128 A36 36 0 1 0 66 128 Z M84 128 A18 18 0 1 0 120 128 A18 18 0 1 0 84 128 Z",
    "p:M132 110 L272 98 Q294 98 296 118 L292 142 L140 152 Q130 140 132 110 Z",
    "p:M290 100 Q372 66 476 52 Q446 104 352 146 Q312 160 292 140 Z",
  ],
  butterfly: [
    "r:30,102,200,24,9",
    "r:30,132,200,24,9",
    "r:16,110,24,40,7",
    "p:M226 108 L424 106 Q474 110 498 124 L474 140 Q440 152 226 150 Z",
  ],
  gloves: [
    "r:176,30,34,70,16",
    "r:214,18,34,82,16",
    "r:252,22,34,78,16",
    "r:290,38,32,64,16",
    "r:172,70,152,112,26",
    "320,108 372,84 392,100 384,120 336,160",
    "r:166,170,166,64,14",
    "r:166,188,166,14,4",
  ],
};

function shapeEl(s: Shape, attrs = ""): string {
  if (s.startsWith("r:")) {
    const [x, y, w, h, rx] = s.slice(2).split(",");
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ${attrs}/>`;
  }
  if (s.startsWith("p:")) return `<path d="${s.slice(2)}" fill-rule="evenodd" clip-rule="evenodd" ${attrs}/>`;
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

function skinSvg(slug: string, weapon: WeaponModel, pattern: Pattern, colors: [string, string, string]): string {
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

// ---------------------------------------------------------------- cases (3/4 view hard weapon case)
const EMBLEMS: Record<string, (a: string) => string> = {
  starter: (a) => `<circle cx="0" cy="0" r="17" fill="none" stroke="${a}" stroke-width="4"/><circle r="6" fill="${a}"/>`,
  neon: (a) => `<path d="M5 -20 L-12 4 H0 L-6 22 L14 -4 H2 Z" fill="${a}"/>`,
  tactical: (a) => `<path d="M-18 -10 L0 -20 L18 -10 M-18 2 L0 -8 L18 2 M-18 14 L0 4 L18 14" fill="none" stroke="${a}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/>`,
  elite: (a) => `<path d="M-20 10 L-16 -14 L-6 -2 L0 -18 L6 -2 L16 -14 L20 10 Z" fill="${a}"/><rect x="-20" y="13" width="40" height="5" rx="2" fill="${a}"/>`,
  shadow: (a) => `<circle r="19" fill="${a}"/><circle cx="9" cy="-6" r="16" fill="#1d2129"/>`,
  spectrum: (a) => `<path d="M0 -20 L20 16 H-20 Z" fill="none" stroke="${a}" stroke-width="4" stroke-linejoin="round"/><path d="M-2 0 L24 -6 M-2 0 L24 2 M-2 0 L24 10" stroke-width="2.6" stroke="#ff7fc4"/><path d="M-2 0 L24 2" stroke-width="2.6" stroke="#5ce1e6"/><path d="M-2 0 L24 10" stroke-width="2.6" stroke="#f5ff6b"/>`,
};

function caseSvg(slug: string, accent: string): string {
  const emblem = (EMBLEMS[slug] ?? EMBLEMS.starter)(accent);
  // Geometry: front face 30..206 x 104..194, depth offset (+22, -24)
  const ridges = [128, 142, 156, 170].map((y) => `<rect x="44" y="${y}" width="148" height="3" rx="1.5" fill="#000" opacity=".35"/><rect x="44" y="${y + 3}" width="148" height="1" fill="#fff" opacity=".06"/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<defs>
<linearGradient id="front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a414d"/><stop offset=".55" stop-color="#232830"/><stop offset="1" stop-color="#15181d"/></linearGradient>
<linearGradient id="top" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#4a525f"/><stop offset="1" stop-color="#2d333c"/></linearGradient>
<linearGradient id="side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1b1f25"/><stop offset="1" stop-color="#101216"/></linearGradient>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${accent}" stop-opacity=".15"/><stop offset=".5" stop-color="${accent}"/><stop offset="1" stop-color="${accent}" stop-opacity=".15"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="${accent}" stop-opacity=".42"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
<radialGradient id="badge" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#2f3540"/><stop offset="1" stop-color="#14171c"/></radialGradient>
<radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9cfd8"/><stop offset=".5" stop-color="#7d8592"/><stop offset="1" stop-color="#4b525d"/></linearGradient>
</defs>
<circle cx="128" cy="140" r="122" fill="url(#glow)"/>
<ellipse cx="136" cy="214" rx="104" ry="13" fill="url(#sh)"/>
<!-- side -->
<path d="M206 104 L228 80 L228 170 Q228 176 222 180 L206 194 Z" fill="url(#side)" stroke="#000" stroke-opacity=".55" stroke-width="1.5"/>
<!-- top -->
<path d="M30 104 L52 80 L228 80 L206 104 Z" fill="url(#top)" stroke="#000" stroke-opacity=".55" stroke-width="1.5"/>
<path d="M52 80 L228 80" stroke="#fff" stroke-opacity=".18" stroke-width="1.5"/>
<!-- handle -->
<path d="M104 92 L108 74 Q110 66 118 66 L152 66 Q160 66 162 74 L166 92" fill="none" stroke="#0d0f12" stroke-width="9" stroke-linecap="round"/>
<path d="M104 92 L108 74 Q110 66 118 66 L152 66 Q160 66 162 74 L166 92" fill="none" stroke="url(#metal)" stroke-width="5" stroke-linecap="round"/>
<!-- front -->
<rect x="30" y="104" width="176" height="90" rx="9" fill="url(#front)" stroke="#000" stroke-opacity=".6" stroke-width="1.5"/>
<rect x="31" y="105" width="174" height="2" rx="1" fill="#fff" opacity=".14"/>
<rect x="30" y="112" width="176" height="3" fill="#000" opacity=".4"/>
${ridges}
<!-- corner guards -->
<path d="M30 160 L30 185 Q30 194 39 194 L62 194 L62 186 L40 186 Q38 186 38 184 L38 160 Z" fill="url(#metal)" opacity=".85"/>
<path d="M206 160 L206 185 Q206 194 197 194 L174 194 L174 186 L196 186 Q198 186 198 184 L198 160 Z" fill="url(#metal)" opacity=".85"/>
<!-- latches -->
<g><rect x="54" y="100" width="22" height="20" rx="3" fill="url(#metal)"/><rect x="58" y="108" width="14" height="4" rx="2" fill="#2a2f37"/></g>
<g><rect x="160" y="100" width="22" height="20" rx="3" fill="url(#metal)"/><rect x="164" y="108" width="14" height="4" rx="2" fill="#2a2f37"/></g>
<!-- accent strip -->
<rect x="38" y="184" width="160" height="3" rx="1.5" fill="url(#acc)"/>
<!-- emblem badge -->
<g transform="translate(118 150)">
<circle r="30" fill="${accent}" opacity=".18"/>
<circle r="25" fill="url(#badge)" stroke="${accent}" stroke-opacity=".9" stroke-width="2"/>
<circle r="25" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="6"/>
${emblem}
</g>
</svg>`;
}

// ---------------------------------------------------------------- write SVGs
let count = 0;
for (const col of CATALOG) {
  writeFileSync(path.join(OUT, "cases", `${col.caseSlug}.svg`), caseSvg(col.caseSlug, col.accent));
  for (const s of col.skins) {
    const slug = slugify(`${s.weapon}-${s.name}`);
    writeFileSync(path.join(OUT, "skins", `${slug}.svg`), skinSvg(slug, s.model, s.pattern, s.colors));
    count++;
  }
}
// Generic placeholder for admin-created skins without an image yet.
writeFileSync(path.join(OUT, "skins", "placeholder.svg"), skinSvg("placeholder", "ak47", "carbon", ["#9aa4b2", "#3a404b", "#16191e"]));
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
