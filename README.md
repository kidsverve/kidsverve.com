# KidsVerve

A playful, colourful static website that showcases kids' **drawings**, **paintings**, and
**coding projects**. Built for GitHub Pages with no build step — just HTML, CSS, and a
little JavaScript. All content is driven by simple JSON files, so you can add creations
and update the menu or footer without touching the page code.

## How the site works

```text
kidsverve.com/
├── index.html          Home page (hero, categories, latest creations)
├── drawings.html       Drawings gallery
├── paintings.html      Paintings gallery
├── codings.html        Coding projects (cards + playable embeds)
├── about.html          About page
├── 404.html            Friendly not-found page
├── CNAME               Custom domain (kidsverve.com)
├── css/styles.css      Theme and layout
├── js/
│   ├── site.js         Builds the header, menu, footer, and theme from site.json
│   ├── gallery.js      Renders a gallery, kid filters, and the lightbox
│   └── home.js         Powers the homepage preview
├── data/
│   ├── site.json       Menu, footer, kids, branding, theme colours
│   ├── drawings.json   Drawing entries
│   ├── paintings.json  Painting entries
│   └── codings.json    Coding project entries
└── assets/             Image files for each category
```

## Update the menu, footer, or colours

Everything shared across pages lives in [`data/site.json`](data/site.json). Change it once
and every page updates:

- **`nav`** — the top menu. Add, remove, or reorder items.
- **`footer`** — the about text, link columns, social links, and copyright.
- **`kids`** — the list of creators (name, colour, emoji). Used for badges and filters.
- **`theme`** — the site colours.

## Add a new drawing, painting, or coding project

1. Drop the image into the matching folder under `assets/` (for example
   `assets/drawings/my-art.jpg`).
2. Open the matching file in `data/` (for example `data/drawings.json`) and add an entry:

   ```json
   {
     "id": "d4",
     "title": "My New Drawing",
     "kid": "aadhav",
     "date": "2026-07-01",
     "image": "assets/drawings/my-art.jpg",
     "description": "A short description of the artwork."
   }
   ```

3. Save and commit. The gallery updates automatically. If the image is missing, a
   coloured placeholder appears instead.

### Coding projects (cards and embeds)

Entries in `data/codings.json` support two styles:

- **Card** — set `"type": "card"` and add `links` (for example a link to play the game).
- **Embed** — set `"type": "embed"` and add an `"embedUrl"` (for example a Scratch embed
  link like `https://scratch.mit.edu/projects/PROJECT_ID/embed`). The project becomes
  playable right inside the site.

## Preview locally

Because the site loads JSON with `fetch`, open it through a local web server (not by
double-clicking the HTML file):

```powershell
# From the project folder
python -m http.server 8000
# then open http://localhost:8000
```

<!-- ## Deploy to GitHub Pages

1. Push these files to the `kidsverve/kidsverve.com` repository (default branch).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select your default
   branch, and the `/ (root)` folder. Save.
4. Under **Custom domain**, confirm `kidsverve.com` (the `CNAME` file sets this).
5. Point your domain's DNS to GitHub Pages, then enable **Enforce HTTPS**. -->

Your site goes live at `https://www.kidsverve.com`.
