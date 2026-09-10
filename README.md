# Beethoven Web (`beethoven-web`)

Official project website and documentation reader for [**Beethoven**](https://github.com/anydaytv/beethoven), the bare-metal C++20 agentic harness that enables small local models (7B–14B) to punch above their weight.

Planned repository location upon Release Candidate (RC): [`https://github.com/beethovenstudios/beethoven-web`](https://github.com/beethovenstudios/beethoven-web).

---

## 🌟 Features

- **High-Tech Aesthetic:** Inspired by Beethoven's own design tokens (`#090a0d` obsidian, neon cyan/blue `#4da3ff`, subtle gradients, and glassmorphism).
- **Interactive Terminal & Workbench Showcase:** Switch between Orchestrator Blueprint JSON, Tree-Sitter AST resolution, safe concurrent splicing, and shadow compiler stderr repair loops.
- **Interactive Execution Pipeline:** Visual 5-step walkthrough of Beethoven's execution lifecycle.
- **Giscus Discussions Integration:** Built-in comments powered by GitHub Discussions, complete with repository switcher, setup wizard, and real-time dark/light theme synchronization.
- **Documentation Browser (`docs.html`):** In-browser documentation reader covering architecture rationale, prompt XML metadata tags, CMake presets, and lint gates with sidebar search filtering.
- **Zero-Build Deployment:** Pure, dependency-free HTML5/CSS3/ES modules that load instantly (&lt;50ms) and can be hosted directly on GitHub Pages.
- **Automated CI/CD:** Ready-to-go GitHub Actions workflow (`.github/workflows/deploy.yml`) for continuous deployment to GitHub Pages.

---

## 🚀 Local Development & Preview

You can preview the website locally using any static HTTP server:

```sh
# Using Python
python -m http.server 3000

# Or using Node / npm
npm start
```

Then visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 💬 Giscus Configuration Guide

The website features first-class integration with [Giscus](https://giscus.app), allowing visitors to ask questions and comment using GitHub Discussions.

To connect your own organization or repository:

1. **Enable Discussions on your repo:**
   - Go to your repository on GitHub: `Settings` &rarr; `General` &rarr; Check **Discussions**.
2. **Install the Giscus GitHub App:**
   - Visit [github.com/apps/giscus](https://github.com/apps/giscus) and grant access to your repository (e.g. `beethovenstudios/beethoven-web` or `beethovenstudios/beethoven`).
3. **Configure IDs:**
   - Visit [giscus.app](https://giscus.app) and type your repository name.
   - Copy the generated `data-repo-id` and `data-category-id`.
   - In the website's Discussions section, click **"Setup / Config"** and paste your IDs. They are saved directly into your browser's `localStorage` and will persist across sessions.

---

## 📦 Deploying to GitHub Pages

### Option A: Via GitHub Actions (Recommended)

1. Create the repository on GitHub under the organization:
   `https://github.com/beethovenstudios/beethoven-web` (or `anydaytv/beethoven-web`).
2. Push this repository to `main`:
   ```sh
   git add .
   git commit -m "feat: initial Beethoven website with Giscus integration"
   git push -u origin main
   ```
3. In GitHub repo settings, navigate to **Settings &rarr; Pages &rarr; Source &rarr; GitHub Actions**.
4. The workflow in `.github/workflows/deploy.yml` will automatically build and publish the site!

### Option B: Deploy from Branch

1. In repository **Settings &rarr; Pages &rarr; Build and deployment**:
   - Source: **Deploy from a branch**
   - Branch: `main` / `/ (root)`
2. Click **Save**.

---

## 📄 License

Distributed under the Apache-2.0 License. See Beethoven's [LICENSE](https://github.com/anydaytv/beethoven/blob/master/LICENSE) for details.
