/* ==========================================================================
   gallery.js — renders a gallery from a collection JSON file, builds kid
   filter chips, and opens a lightbox for images or embedded projects.

   Usage on a page:
     <main data-collection="data/drawings.json"> ... </main>
     <script type="module" src="js/gallery.js"></script>
   ========================================================================== */

import { initSite, loadJSON, esc } from "./site.js?v=6";

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

/* ---------- HEIC support ----------
   Browsers cannot natively decode HEIC images (common on phone cameras). We
   lazily load the heic2any library only when an image fails to load, attempt an
   in-browser conversion to JPEG, and fall back to the placeholder if that also
   fails. Pre-converting with assets/util/convert-heic.ps1 is still preferred for
   performance, but this keeps cards working for any stray HEIC files. */
const HEIC_TO_MODULE = "https://cdn.jsdelivr.net/npm/heic-to@1.1.14/+esm";
let heicToPromise = null;

// Lazily import the heic-to library (modern libheif build) only when needed.
function loadHeicTo() {
  if (!heicToPromise) heicToPromise = import(HEIC_TO_MODULE);
  return heicToPromise;
}

async function decodeHeicToObjectURL(url) {
  const res = await fetch(url, { cache: "reload" });
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  const blob = await res.blob();

  // Inspect the ISO-BMFF 'ftyp' brand to confirm this is really HEIC before
  // invoking the decoder. If it turns out to be an ordinary image the browser
  // could not decode from cache, just reuse the freshly fetched bytes directly.
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  const boxType = String.fromCharCode(...header.slice(4, 8));
  const brand = String.fromCharCode(...header.slice(8, 12));
  const isHeic = boxType === "ftyp" && /hei|mif|hev|msf/.test(brand);

  if (!isHeic) return URL.createObjectURL(blob);

  const { heicTo } = await loadHeicTo();
  const jpegBlob = await heicTo({ blob, type: "image/jpeg", quality: 0.9 });
  return URL.createObjectURL(jpegBlob);
}

/**
 * Load an image into an <img> with HEIC support. Files with a .heic/.heif
 * extension are decoded up front (browsers never render them and may not even
 * fire an error event). For anything else we load normally and only decode as
 * HEIC if the load fails (covers HEIC files mislabeled as .jpg). Any unrecovered
 * failure shows the placeholder. The error handler is attached before the load
 * starts to avoid missing an early error event.
 */
function loadImage(img, source, placeholderSrc) {
  let recovering = false;

  const showPlaceholder = () => { img.src = placeholderSrc; };

  const recoverAsHeic = async () => {
    if (recovering) return;
    recovering = true;
    try {
      img.src = await decodeHeicToObjectURL(source);
    } catch (_) {
      showPlaceholder();
    }
  };

  img.addEventListener("error", () => {
    if (recovering) { showPlaceholder(); return; }
    recoverAsHeic();
  });

  if (/\.hei[cf]$/i.test(source)) {
    recoverAsHeic();
  } else {
    img.src = source;
  }
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
const SLIDESHOW_INTERVAL = 2000;
const lightboxState = { list: [], index: 0, kids: [], timer: null };

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
      <div class="lightbox__toolbar">
        <button class="lightbox__tool" data-action="play" aria-label="Play slideshow" title="Play slideshow (Space)">▶</button>
        <button class="lightbox__tool" data-action="download" aria-label="Download image" title="Download">⤓</button>
        <button class="lightbox__tool" data-action="fullscreen" aria-label="View fullscreen" title="Fullscreen">⛶</button>
        <button class="lightbox__tool lightbox__close" data-action="close" aria-label="Close" title="Close (Esc)">×</button>
      </div>
      <button class="lightbox__nav lightbox__nav--prev" data-action="prev" aria-label="Previous image" title="Previous (←)">‹</button>
      <button class="lightbox__nav lightbox__nav--next" data-action="next" aria-label="Next image" title="Next (→)">›</button>
      <div class="lightbox__content"></div>
    </div>`;
  document.body.appendChild(box);

  box.addEventListener("click", (e) => {
    if (e.target === box) { closeLightbox(); return; }
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === "close") closeLightbox();
    else if (action === "prev") showLightboxAt(lightboxState.index - 1);
    else if (action === "next") showLightboxAt(lightboxState.index + 1);
    else if (action === "play") toggleSlideshow();
    else if (action === "download") downloadCurrent();
    else if (action === "fullscreen") toggleFullscreen();
  });

  document.addEventListener("keydown", (e) => {
    if (!box.classList.contains("is-open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") showLightboxAt(lightboxState.index - 1);
    else if (e.key === "ArrowRight") showLightboxAt(lightboxState.index + 1);
    else if (e.key === " ") { e.preventDefault(); toggleSlideshow(); }
  });

  return box;
}

function stopSlideshow() {
  if (lightboxState.timer) { clearInterval(lightboxState.timer); lightboxState.timer = null; }
  const box = document.getElementById("lightbox");
  const playBtn = box && box.querySelector('[data-action="play"]');
  if (playBtn) {
    playBtn.textContent = "▶";
    playBtn.setAttribute("aria-label", "Play slideshow");
    playBtn.classList.remove("is-playing");
  }
}

function toggleSlideshow() {
  if (lightboxState.timer) { stopSlideshow(); return; }
  if (lightboxState.list.length <= 1) return;
  const playBtn = document.getElementById("lightbox").querySelector('[data-action="play"]');
  if (playBtn) {
    playBtn.textContent = "⏸";
    playBtn.setAttribute("aria-label", "Pause slideshow");
    playBtn.classList.add("is-playing");
  }
  lightboxState.timer = setInterval(() => showLightboxAt(lightboxState.index + 1), SLIDESHOW_INTERVAL);
}

function toggleFullscreen() {
  const box = document.getElementById("lightbox");
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else if (box.requestFullscreen) box.requestFullscreen().catch(() => {});
}

async function downloadCurrent() {
  const item = lightboxState.list[lightboxState.index];
  if (!item || !item.image) return;
  const box = document.getElementById("lightbox");
  const img = box.querySelector(".lightbox__media img");
  const safeName = (item.title || "image").trim().replace(/[^\w.-]+/g, "_") || "image";
  try {
    // Prefer the already-displayed source so converted HEIC downloads as JPEG.
    const src = img && img.src && !img.src.startsWith("data:") ? img.src : item.image;
    const res = await fetch(src);
    const blob = await res.blob();
    const ext = (blob.type && blob.type.split("/")[1]) || "jpg";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.${ext === "jpeg" ? "jpg" : ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (_) {
    window.open(item.image, "_blank", "noopener");
  }
}

function closeLightbox() {
  const box = document.getElementById("lightbox");
  if (!box) return;
  stopSlideshow();
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  box.classList.remove("is-open");
  box.setAttribute("aria-hidden", "true");
  box.querySelector(".lightbox__content").innerHTML = "";
  document.body.style.overflow = "";
}

function renderLightbox() {
  const box = buildLightbox();
  const content = box.querySelector(".lightbox__content");
  const item = lightboxState.list[lightboxState.index];
  const kid = kidById(lightboxState.kids, item.kid);
  const isEmbed = item.type === "embed" && item.embedUrl;
  const media = isEmbed
    ? `<div class="lightbox__embed"><iframe src="${esc(item.embedUrl)}" allowtransparency="true" allowfullscreen title="${esc(item.title)}"></iframe></div>`
    : `<div class="lightbox__media"><img alt="${esc(item.title)}"></div>`;
  const links = (item.links || []).map((l) =>
    `<a class="btn btn--ghost" href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)}</a>`
  ).join("");
  const counter = lightboxState.list.length > 1
    ? `<span class="lightbox__counter">${lightboxState.index + 1} / ${lightboxState.list.length}</span>` : "";
  content.innerHTML = `
    ${media}
    <div class="lightbox__body">
      <h3>${esc(item.title)}</h3>
      <p class="card__meta"><span aria-hidden="true">${esc(kid.emoji)}</span> ${esc(kid.name)} · ${formatDate(item.date)} ${counter}</p>
      <p>${esc(item.description || "")}</p>
      ${links ? `<div class="lightbox__links">${links}</div>` : ""}
    </div>`;
  const lightboxImg = content.querySelector(".lightbox__media img");
  if (lightboxImg) loadImage(lightboxImg, item.image, placeholder(kid.emoji, kid.color));

  // Toggle controls that only apply to certain item types / list sizes.
  const single = lightboxState.list.length <= 1;
  box.querySelectorAll(".lightbox__nav").forEach((n) => { n.hidden = single; });
  const playBtn = box.querySelector('[data-action="play"]');
  const downloadBtn = box.querySelector('[data-action="download"]');
  if (playBtn) playBtn.hidden = single;
  if (downloadBtn) downloadBtn.hidden = isEmbed;
}

function showLightboxAt(index) {
  const len = lightboxState.list.length;
  if (!len) return;
  lightboxState.index = (index + len) % len; // wrap around both ends
  renderLightbox();
}

function openLightbox(list, index, kids) {
  lightboxState.list = list;
  lightboxState.index = index;
  lightboxState.kids = kids;
  const box = buildLightbox();
  renderLightbox();
  box.classList.add("is-open");
  box.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  const closeBtn = box.querySelector(".lightbox__close");
  if (closeBtn) closeBtn.focus();
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
        <img loading="lazy" alt="${esc(item.title)}">
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
      const item = items.find((i) => String(i.id) === btn.dataset.id);
      const kid = item ? kidById(kids, item.kid) : null;
      const img = btn.querySelector(".card__media img");
      if (img && item && kid) loadImage(img, item.image, placeholder(kid.emoji, kid.color));
      btn.addEventListener("click", () => {
        const index = list.findIndex((i) => String(i.id) === btn.dataset.id);
        if (index >= 0) openLightbox(list, index, kids);
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
