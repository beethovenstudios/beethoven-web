# beethoven-web

The website for [**Beethoven**](https://github.com/anydaytv/beethoven), a free, open-source C++20 code studio and agentic harness for local models.

- **Live:** https://beethovenstudios.github.io/beethoven-web/
- **Engine:** https://github.com/anydaytv/beethoven (moves to `beethovenstudios/beethoven` at release candidate)

## What is here

A static site, no build step, no framework, no analytics.

| Path | What it is |
|---|---|
| `index.html` | The home page, laid out as movements of a score: the problem, the rule, an interactive demo, the engine, hardware, limits, quickstart, discussions. |
| `docs.html` | Curated reference plus the engine repository's own Markdown rendered on load, so the docs cannot drift from the code. |
| `css/site.css` | One stylesheet. Paper and ink, gold for emphasis, staff lines as section rules. Light and dark. |
| `js/slice-demo.js` | "What the model sees": a one-file reimplementation of Beethoven's symbol slicing, running the Tree-sitter C++ grammar in WebAssembly. |
| `js/live-docs.js` | Fetches `README.md`, `docs/Beethoven.md`, `docs/prompt_specification.md` and `docs/TODO.md` from the engine repository and renders them with marked. |
| `js/giscus.js` | GitHub Discussions comments through Giscus, theme synced with the page. |
| `js/site.js` | Theme toggle, mobile menu, copy buttons, docs scroll-spy. |
| `vendor/` | `web-tree-sitter` 0.27 (MIT), `tree-sitter-cpp` 0.23 grammar (MIT), `marked` (MIT). Vendored so the site has no runtime CDN dependency beyond fonts and Giscus. |
| `assets/screens/` | Real screenshots of the Dear ImGui workbench, converted to WebP. |

## Local preview

Any static server works. The Tree-sitter demo needs the page served over HTTP, not opened from disk.

```sh
python -m http.server 3000
# or
npx serve -l 3000 .
```

## Deploy

Pushes to `main` deploy to GitHub Pages through `.github/workflows/deploy.yml`. The whole repository is uploaded as-is.

## Giscus

- Repository: `beethovenstudios/beethoven-web`
- Category: `General`
- IDs are in `js/giscus.js`. The Giscus app must be installed on the repository and Discussions must be enabled.

## License

Site content and code: Apache-2.0, © 2026 Arthur Aszman. Vendored libraries carry their own licenses in `vendor/`.
