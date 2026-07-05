/* ==========================================================================
   site.js — loads data/site.json and renders the dynamic header, nav,
   footer, and theme colours on every page. Edit data/site.json to update
   the menu, footer, kids, and branding everywhere at once.
   ========================================================================== */

/** Resolve a data/asset path relative to the site root regardless of page. */
export function root(path) {
  return path;
}

/** Fetch JSON with a friendly error. */
export async function loadJSON(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return res.json();
}

/** Escape text destined for HTML to prevent markup injection. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** Apply theme colours from site.json onto CSS custom properties. */
function applyTheme(theme = {}) {
  const rootEl = document.documentElement;
  const map = {
    primary: "--primary", secondary: "--secondary", accent: "--accent",
    purple: "--purple", ink: "--ink",
  };
  for (const [key, cssVar] of Object.entries(map)) {
    if (theme[key]) rootEl.style.setProperty(cssVar, theme[key]);
  }
}

/** Current page filename, e.g. "drawings.html" (defaults to index.html). */
function currentPage() {
  const file = window.location.pathname.split("/").pop();
  return file && file.length ? file : "index.html";
}

function renderHeader(site) {
  const header = document.getElementById("site-header");
  if (!header) return;
  const active = currentPage();
  const navItems = (site.nav || []).map((item) => {
    const isActive = item.href === active ? " is-active" : "";
    return `<a href="${esc(item.href)}" class="${isActive.trim()}"${
      item.href === active ? ' aria-current="page"' : ""
    }><span class="nav__icon" aria-hidden="true">${esc(item.icon || "")}</span>${esc(item.label)}</a>`;
  }).join("");

  header.innerHTML = `
    <div class="container site-header__inner">
      <a class="brand" href="index.html" aria-label="${esc(site.siteName)} home">
        <span class="brand__logo" aria-hidden="true"><img class="brand__logo-img" src="assets/util/kidsverve-logo.png" alt=""></span>
        <span>
          <span class="brand__name">${esc(site.siteName)}</span><br>
          <span class="brand__tag">${esc(site.tagline || "")}</span>
        </span>
      </a>
      <button class="nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="primary-nav">☰</button>
      <nav class="nav" id="primary-nav" aria-label="Primary">${navItems}</nav>
    </div>`;

  const toggle = header.querySelector(".nav-toggle");
  const nav = header.querySelector(".nav");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
}

function renderFooter(site) {
  const footer = document.getElementById("site-footer");
  if (!footer) return;
  const f = site.footer || {};
  const visitsBadge = `
    <span class="footer__visits" id="visit-count" hidden>
      <span class="footer__visits-icon" aria-hidden="true">👀</span>
      <span class="footer__visits-num"><strong>…</strong></span>
      <span class="footer__visits-label">visits</span>
    </span>`;
  const colList = f.columns || [];
  const columns = colList.map((col, i) => `
    <div class="footer__col">
      <h4>${esc(col.title)}</h4>
      <ul>${(col.links || []).map((l) => `<li><a href="${esc(l.href)}">${esc(l.label)}</a></li>`).join("")}</ul>
      ${i === colList.length - 1 ? visitsBadge : ""}
    </div>`).join("");
  const brandIcons = {
    youtube: `<svg class="footer__social-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="#FF0000" d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.39.53A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12C4.5 20.45 12 20.45 12 20.45s7.5 0 9.39-.53a3 3 0 0 0 2.11-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8Z"/><path fill="#fff" d="M9.55 15.57V8.43L15.82 12l-6.27 3.57Z"/></svg>`,
    email: `<svg class="footer__social-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="#ef7f1a" d="M3 7h18a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 21 21H3a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 3 7Z"/><rect x="5" y="2" width="14" height="12.5" rx="1" fill="#f6f6f7"/><text x="12" y="9.6" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="700" fill="#5f7683">@</text><path fill="#f4a81d" d="M1.5 8 12 16 1.5 21.5V8Z"/><path fill="#f4a81d" d="M22.5 8 12 16l10.5 5.5V8Z"/><path fill="#ffc529" d="M1.7 21.4 12 13.6l10.3 7.8a1.5 1.5 0 0 1-1.3.6H3a1.5 1.5 0 0 1-1.3-.6Z"/></svg>`,
    instagram: `<svg class="footer__social-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><defs><linearGradient id="kv-ig-grad" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#feda75"/><stop offset=".25" stop-color="#fa7e1e"/><stop offset=".5" stop-color="#d62976"/><stop offset=".75" stop-color="#962fbf"/><stop offset="1" stop-color="#4f5bd5"/></linearGradient></defs><path fill="url(#kv-ig-grad)" d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.15 0-3.5.01-4.74.07-1.14.05-1.76.24-2.17.4-.55.22-.94.47-1.35.88-.41.41-.66.8-.88 1.35-.16.41-.35 1.03-.4 2.17-.06 1.24-.07 1.6-.07 4.74s.01 3.5.07 4.74c.05 1.14.24 1.76.4 2.17.22.55.47.94.88 1.35.41.41.8.66 1.35.88.41.16 1.03.35 2.17.4 1.24.06 1.6.07 4.74.07s3.5-.01 4.74-.07c1.14-.05 1.76-.24 2.17-.4.55-.22.94-.47 1.35-.88.41-.41.66-.8.88-1.35.16-.41.35-1.03.4-2.17.06-1.24.07-1.6.07-4.74s-.01-3.5-.07-4.74c-.05-1.14-.24-1.76-.4-2.17a3.64 3.64 0 0 0-.88-1.35 3.64 3.64 0 0 0-1.35-.88c-.41-.16-1.03-.35-2.17-.4-1.24-.06-1.6-.07-4.74-.07Zm0 2.76a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6Zm0 1.62a3.68 3.68 0 1 0 0 7.36 3.68 3.68 0 0 0 0-7.36Zm5.5-.68a1.24 1.24 0 1 1 0 2.48 1.24 1.24 0 0 1 0-2.48Z"/></svg>`,
  };
  const social = (f.social || []).map((s) => {
    const brand = String(s.brand || "").toLowerCase();
    const icon = brandIcons[brand] || `<span aria-hidden="true">${esc(s.icon)}</span>`;
    const external = /^https?:/i.test(s.href || "") ? ' target="_blank" rel="noopener"' : "";
    return `<a href="${esc(s.href)}" aria-label="${esc(s.label)}" title="${esc(s.title || s.label)}"${external}>${icon}</a>`;
  }).join("");
  const copyright = esc((f.copyright || "").replace("{{year}}", String(new Date().getFullYear())));

  footer.innerHTML = `
    <div class="container">
      <div class="footer__grid">
        <div class="footer__about">
          <h3><img class="footer__logo" src="assets/util/kidsverve-logo.png" alt=""> ${esc(site.siteName)}</h3>
          <p>${esc(f.about || "")}</p>
          <div class="footer__social">
            <div class="footer__social-icons">${social}</div>
          </div>
        </div>
        ${columns}
      </div>
      <div class="footer__bottom">${copyright}</div>
    </div>`;
}

/**
 * Show a global visit count in the footer. GitHub Pages is static, so the count
 * is persisted by a free external hit-counter (Abacus). It increments once per
 * browser session and reads on later page loads. Fails silently if offline.
 */
async function loadVisitCount(counter) {
  const el = document.getElementById("visit-count");
  if (!el || !counter || !counter.namespace || !counter.key) return;
  const base = "https://abacus.jasoncameron.dev";
  const counted = sessionStorage.getItem("kv_visit_counted");
  const action = counted ? "get" : "hit";
  try {
    const res = await fetch(`${base}/${action}/${encodeURIComponent(counter.namespace)}/${encodeURIComponent(counter.key)}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (!counted) sessionStorage.setItem("kv_visit_counted", "1");
    const value = Number(data.value ?? 0).toLocaleString();
    el.querySelector("strong").textContent = value;
    el.hidden = false;
  } catch {
    // Leave the counter hidden if the service is unreachable.
  }
}

/** Load site config, render chrome, and return the config for pages to reuse. */
export async function initSite() {
  const site = await loadJSON("data/site.json");
  document.title = document.title || site.siteName;
  applyTheme(site.theme);
  renderHeader(site);
  renderFooter(site);
  loadVisitCount(site.footer && site.footer.visitorCounter);
  return site;
}
