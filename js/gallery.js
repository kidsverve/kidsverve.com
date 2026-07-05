/* ==========================================================================
   gallery.js — renders a gallery from a collection JSON file, builds kid
   filter chips, and opens a lightbox for images or embedded projects.

   Usage on a page:
     <main data-collection="data/drawings.json"> ... </main>
     <script type="module" src="js/gallery.js"></script>
   ========================================================================== */

import { initSite, loadJSON, esc } from "./site.js";

/** Inline SVG placeholder used when an image is missing. */
function placeholder(label, color) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
      <stop offset='0' stop-color='${color}' stop-opacity='0.25'/>
      <stop offset='1' stop-color='${color}' stop-opacity='0.55'/>
    </linearGradient></defs>
    <rect width='400' height='300' fill='url(#g)'/>
    <text x='50%' y='50%' font-family='sans-serif' font-size='90' text-anchor='middle' dominant-baseline='central'>${label}</text>
  </svg>`;
  // encodeURIComponent leaves apostrophes intact, which would break the inline
  // onerror JS string, so encode them too.
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g, "%27")}`;
}

function kidById(kids, id) {
  return kids.find((k) => k.id === id) || { name: "Unknown", color: "#999", emoji: "🎨" };
}

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* ---------- Lightbox ---------- */
function buildLightbox() {
  let box = document.getElementById("lightbox");
  if (box) return box;
  box = document.createElement("div");
  box.id = "lightbox";
  box.className = "lightbox";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = `
    <div class="lightbox__panel">
      <button class="lightbox__close" aria-label="Close">×</button>
      <div class="lightbox__content"></div>
    </div>`;
  document.body.appendChild(box);

  const close = () => {
    box.classList.remove("is-open");
    box.setAttribute("aria-hidden", "true");
    box.querySelector(".lightbox__content").innerHTML = "";
    document.body.style.overflow = "";
  };
  box.querySelector(".lightbox__close").addEventListener("click", close);
  box.addEventListener("click", (e) => { if (e.target === box) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
  return box;
}

function openLightbox(item, kid) {
  const box = buildLightbox();
  const content = box.querySelector(".lightbox__content");
  const media = item.type === "embed" && item.embedUrl
    ? `<div class="lightbox__embed"><iframe src="${esc(item.embedUrl)}" allowtransparency="true" allowfullscreen title="${esc(item.title)}"></iframe></div>`
    : `<div class="lightbox__media"><img src="${esc(item.image)}" alt="${esc(item.title)}"
         onerror="this.onerror=null;this.src='${placeholder(kid.emoji, kid.color)}'"></div>`;
  const links = (item.links || []).map((l) =>
    `<a class="btn btn--ghost" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`
  ).join("");
  content.innerHTML = `
    ${media}
    <div class="lightbox__body">
      <h3>${esc(item.title)}</h3>
      <p class="card__meta"><span aria-hidden="true">${esc(kid.emoji)}</span> ${esc(kid.name)} · ${formatDate(item.date)}</p>
      <p>${esc(item.description || "")}</p>
      ${links ? `<div class="lightbox__links">${links}</div>` : ""}
    </div>`;
  box.classList.add("is-open");
  box.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  box.querySelector(".lightbox__close").focus();
}

/* ---------- Cards ---------- */
function cardHTML(item, kid) {
  const typeBadge = item.type === "embed"
    ? `<span class="card__badge card__badge--type">▶ Play</span>` : "";
  return `
    <button class="card" data-id="${esc(item.id)}" aria-label="Open ${esc(item.title)}">
      <div class="card__media">
        <span class="card__badge" style="background:${esc(kid.color)}">${esc(kid.emoji)} ${esc(kid.name)}</span>
        ${typeBadge}
        <img loading="lazy" src="${esc(item.image)}" alt="${esc(item.title)}"
          onerror="this.onerror=null;this.src='${placeholder(kid.emoji, kid.color)}'">
      </div>
      <div class="card__body">
        <h3>${esc(item.title)}</h3>
        <p class="card__meta">${formatDate(item.date)}</p>
        <p class="card__desc">${esc(item.description || "")}</p>
      </div>
    </button>`;
}

/* ---------- Filters ---------- */
function renderFilters(container, kids, usedKidIds, onSelect) {
  const relevant = kids.filter((k) => usedKidIds.has(k.id));
  if (relevant.length <= 1) return; // no need for filters with a single creator
  const chips = [
    `<button class="chip is-active" data-kid="all" style="background:var(--ink);color:#fff">All</button>`,
    ...relevant.map((k) =>
      `<button class="chip" data-kid="${esc(k.id)}"><span class="dot" style="color:${esc(k.color)}"></span>${esc(k.emoji)} ${esc(k.name)}</button>`
    ),
  ].join("");
  container.innerHTML = chips;
  container.hidden = false;
  container.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    container.querySelectorAll(".chip").forEach((c) => {
      const active = c === chip;
      c.classList.toggle("is-active", active);
      c.style.background = active && chip.dataset.kid !== "all"
        ? kids.find((k) => k.id === chip.dataset.kid)?.color || "var(--ink)"
        : active ? "var(--ink)" : "#fff";
      c.style.color = active ? "#fff" : "var(--ink)";
    });
    onSelect(chip.dataset.kid);
  });
}

/* ---------- Init ---------- */
async function initGallery() {
  const main = document.querySelector("[data-collection]");
  if (!main) return;
  const site = await initSite();
  const kids = site.kids || [];
  const data = await loadJSON(main.dataset.collection);
  const items = data.items || [];

  const titleEl = main.querySelector("[data-collection-title]");
  const subEl = main.querySelector("[data-collection-subtitle]");
  if (titleEl && data.title) titleEl.textContent = data.title;
  if (subEl && data.subtitle) subEl.textContent = data.subtitle;

  const grid = main.querySelector("[data-gallery]");
  const filters = main.querySelector("[data-filters]");
  const usedKidIds = new Set(items.map((i) => i.kid));

  const draw = (filter) => {
    const list = filter && filter !== "all" ? items.filter((i) => i.kid === filter) : items;
    grid.innerHTML = list.length
      ? list.map((i) => cardHTML(i, kidById(kids, i.kid))).join("")
      : `<p class="empty">No creations here yet — check back soon! 🎨</p>`;
    grid.querySelectorAll(".card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const item = items.find((i) => String(i.id) === btn.dataset.id);
        if (item) openLightbox(item, kidById(kids, item.kid));
      });
    });
  };

  if (filters) renderFilters(filters, kids, usedKidIds, draw);
  draw("all");
}

initGallery().catch((err) => {
  console.error(err);
  const grid = document.querySelector("[data-gallery]");
  if (grid) grid.innerHTML = `<p class="empty">Something went wrong loading this gallery.</p>`;
});
