/* ==========================================================================
   home.js — powers the homepage: renders chrome, category counts, and a
   "Latest creations" preview pulled from all collections.
   ========================================================================== */

import { initSite, loadJSON, esc } from "./site.js";

const COLLECTIONS = [
  { file: "data/drawings.json", href: "drawings.html", emoji: "✏️", label: "Drawings" },
  { file: "data/paintings.json", href: "paintings.html", emoji: "🖌️", label: "Paintings" },
  { file: "data/codings.json", href: "codings.html", emoji: "💻", label: "Codings" },
];

function placeholder(label, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
    <rect width='400' height='300' fill='${color}' fill-opacity='0.25'/>
    <text x='50%' y='50%' font-size='90' text-anchor='middle' dominant-baseline='central'>${label}</text>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}`;
}

function formatDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

async function initHome() {
  const site = await initSite();
  const kids = site.kids || [];
  const kidById = (id) => kids.find((k) => k.id === id) || { name: "", color: "#999", emoji: "🎨" };

  const results = await Promise.all(
    COLLECTIONS.map(async (c) => ({ ...c, data: await loadJSON(c.file).catch(() => ({ items: [] })) }))
  );

  // Category cards with live counts.
  const catsEl = document.querySelector("[data-cats]");
  if (catsEl) {
    catsEl.innerHTML = results.map((c) => `
      <a class="cat" href="${esc(c.href)}">
        <div class="cat__emoji" aria-hidden="true">${c.emoji}</div>
        <h3>${esc(c.label)}</h3>
        <p>${(c.data.items || []).length} creation${(c.data.items || []).length === 1 ? "" : "s"} to explore →</p>
      </a>`).join("");
  }

  // Latest creations across all collections.
  const latestEl = document.querySelector("[data-latest]");
  if (latestEl) {
    const all = results.flatMap((c) => (c.data.items || []).map((i) => ({ ...i, _href: c.href })));
    all.sort((a, b) => new Date(b.date) - new Date(a.date));
    const featured = all.slice(0, 6);
    latestEl.innerHTML = featured.map((item) => {
      const kid = kidById(item.kid);
      return `
        <a class="card" href="${esc(item._href)}" style="display:block">
          <div class="card__media">
            <span class="card__badge" style="background:${esc(kid.color)}">${esc(kid.emoji)} ${esc(kid.name)}</span>
            <img loading="lazy" src="${esc(item.image)}" alt="${esc(item.title)}"
              onerror="this.onerror=null;this.src='${placeholder(kid.emoji, kid.color)}'">
          </div>
          <div class="card__body">
            <h3>${esc(item.title)}</h3>
            <p class="card__meta">${formatDate(item.date)}</p>
          </div>
        </a>`;
    }).join("");
  }
}

initHome().catch((err) => console.error(err));
