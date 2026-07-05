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
        <span class="brand__logo" aria-hidden="true"><svg class="brand__star" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="#ffd23f" stroke="#ff9f1c" stroke-width="0.7" stroke-linejoin="round"/><circle cx="9.7" cy="10.7" r="1" fill="#2b2d42"/><circle cx="14.3" cy="10.7" r="1" fill="#2b2d42"/><path d="M9.9 12.9c.7 1.2 3.5 1.2 4.2 0" fill="none" stroke="#2b2d42" stroke-width="0.9" stroke-linecap="round"/></svg></span>
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
  const social = (f.social || []).map((s) =>
    `<a href="${esc(s.href)}" aria-label="${esc(s.label)}" title="${esc(s.label)}"><span aria-hidden="true">${esc(s.icon)}</span></a>`
  ).join("");
  const copyright = esc((f.copyright || "").replace("{{year}}", String(new Date().getFullYear())));

  footer.innerHTML = `
    <div class="container">
      <div class="footer__grid">
        <div class="footer__about">
          <h3>${esc(site.logoEmoji || "🎨")} ${esc(site.siteName)}</h3>
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
