/**
 * Beethoven Web - Giscus Discussions Integration
 * Handles dynamic mounting, repository switching, theme synchronization,
 * and GitHub Discussions connectivity.
 */

const DEFAULT_GISCUS_CONFIG = {
  repo: 'beethovenstudios/beethoven-web',
  repoId: '', // Filled once GitHub repo is created and Giscus app authorized
  category: 'Announcements',
  categoryId: '',
  mapping: 'pathname',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'top',
  lang: 'en'
};

document.addEventListener('DOMContentLoaded', () => {
  initGiscus();
});

function initGiscus() {
  const container = document.getElementById('giscus-container');
  if (!container) return;

  // Load saved repository selection or default
  const savedRepo = localStorage.getItem('bvn_giscus_repo') || DEFAULT_GISCUS_CONFIG.repo;
  const savedRepoId = localStorage.getItem('bvn_giscus_repo_id') || '';
  const savedCategoryId = localStorage.getItem('bvn_giscus_category_id') || '';

  const repoSelect = document.getElementById('giscus-repo-select');
  if (repoSelect) {
    repoSelect.value = savedRepo;
    repoSelect.addEventListener('change', (e) => {
      const newRepo = e.target.value;
      localStorage.setItem('bvn_giscus_repo', newRepo);
      renderGiscus(newRepo);
    });
  }

  const customConfigBtn = document.getElementById('giscus-configure-btn');
  if (customConfigBtn) {
    customConfigBtn.addEventListener('click', toggleGiscusConfigModal);
  }

  // Initial render
  renderGiscus(savedRepo, savedRepoId, savedCategoryId);
}

function renderGiscus(repo, repoId = '', categoryId = '') {
  const container = document.getElementById('giscus-mount');
  const fallbackGuide = document.getElementById('giscus-setup-guide');
  if (!container) return;

  // Clear previous frame
  container.innerHTML = '';

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const giscusTheme = currentTheme === 'dark' ? 'dark_dimmed' : 'light';

  // If repoId is missing, show helpful configuration reminder with direct launch
  const effectiveRepoId = repoId || localStorage.getItem('bvn_giscus_repo_id');
  const effectiveCategoryId = categoryId || localStorage.getItem('bvn_giscus_category_id');

  if (!effectiveRepoId) {
    if (fallbackGuide) fallbackGuide.style.display = 'block';
  } else {
    if (fallbackGuide) fallbackGuide.style.display = 'none';
  }

  const script = document.createElement('script');
  script.src = 'https://giscus.app/client.js';
  script.setAttribute('data-repo', repo);
  script.setAttribute('data-repo-id', effectiveRepoId || 'REPO_PENDING');
  script.setAttribute('data-category', 'General');
  script.setAttribute('data-category-id', effectiveCategoryId || 'CATEGORY_PENDING');
  script.setAttribute('data-mapping', 'pathname');
  script.setAttribute('data-strict', '0');
  script.setAttribute('data-reactions-enabled', '1');
  script.setAttribute('data-emit-metadata', '0');
  script.setAttribute('data-input-position', 'top');
  script.setAttribute('data-theme', giscusTheme);
  script.setAttribute('data-lang', 'en');
  script.setAttribute('crossorigin', 'anonymous');
  script.async = true;

  container.appendChild(script);

  // Update active repo badge in UI
  const currentRepoBadge = document.getElementById('giscus-active-repo-badge');
  if (currentRepoBadge) {
    currentRepoBadge.textContent = repo;
  }
}

function toggleGiscusConfigModal() {
  let modal = document.getElementById('giscus-config-modal');
  if (!modal) {
    modal = createGiscusConfigModal();
    document.body.appendChild(modal);
  }
  modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
}

function createGiscusConfigModal() {
  const modal = document.createElement('div');
  modal.id = 'giscus-config-modal';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  `;

  const currentRepo = localStorage.getItem('bvn_giscus_repo') || DEFAULT_GISCUS_CONFIG.repo;
  const currentRepoId = localStorage.getItem('bvn_giscus_repo_id') || '';
  const currentCatId = localStorage.getItem('bvn_giscus_category_id') || '';

  modal.innerHTML = `
    <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-lg); max-width: 520px; width: 100%; padding: 2rem; box-shadow: var(--shadow-lg);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.25rem;">Configure Giscus Discussions</h3>
        <button id="modal-close-btn" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.4rem;">&times;</button>
      </div>
      <p style="color: var(--text-muted); font-size: 0.88rem; margin-bottom: 1.25rem; line-height: 1.5;">
        Connect Beethoven to your GitHub Organization repository (<a href="https://github.com/beethovenstudios" target="_blank" rel="noopener">beethovenstudios</a>). Ensure GitHub Discussions is enabled in the repo settings.
      </p>
      
      <div style="display:flex; flex-direction:column; gap:1rem; margin-bottom: 1.5rem;">
        <div>
          <label style="display:block; font-size:0.8rem; font-family:var(--font-mono); color:var(--text-muted); margin-bottom:0.35rem;">GitHub Repository</label>
          <input type="text" id="modal-input-repo" value="${currentRepo}" placeholder="beethovenstudios/beethoven" style="width:100%; background:var(--bg-subtle); border:1px solid var(--border); color:var(--text); padding:0.55rem 0.8rem; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:0.85rem;" />
        </div>
        <div>
          <label style="display:block; font-size:0.8rem; font-family:var(--font-mono); color:var(--text-muted); margin-bottom:0.35rem;">Repository ID (from giscus.app)</label>
          <input type="text" id="modal-input-repo-id" value="${currentRepoId}" placeholder="e.g. R_kgDOHwxxxx" style="width:100%; background:var(--bg-subtle); border:1px solid var(--border); color:var(--text); padding:0.55rem 0.8rem; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:0.85rem;" />
        </div>
        <div>
          <label style="display:block; font-size:0.8rem; font-family:var(--font-mono); color:var(--text-muted); margin-bottom:0.35rem;">Category ID (from giscus.app)</label>
          <input type="text" id="modal-input-cat-id" value="${currentCatId}" placeholder="e.g. DIC_kwDOHwxxxx" style="width:100%; background:var(--bg-subtle); border:1px solid var(--border); color:var(--text); padding:0.55rem 0.8rem; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:0.85rem;" />
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button id="modal-cancel-btn" class="btn btn-outline btn-sm">Cancel</button>
        <button id="modal-save-btn" class="btn btn-primary btn-sm">Save &amp; Reload</button>
      </div>
    </div>
  `;

  modal.querySelector('#modal-close-btn').addEventListener('click', () => modal.style.display = 'none');
  modal.querySelector('#modal-cancel-btn').addEventListener('click', () => modal.style.display = 'none');

  modal.querySelector('#modal-save-btn').addEventListener('click', () => {
    const repo = modal.querySelector('#modal-input-repo').value.trim();
    const repoId = modal.querySelector('#modal-input-repo-id').value.trim();
    const catId = modal.querySelector('#modal-input-cat-id').value.trim();

    if (repo) {
      localStorage.setItem('bvn_giscus_repo', repo);
      localStorage.setItem('bvn_giscus_repo_id', repoId);
      localStorage.setItem('bvn_giscus_category_id', catId);
      renderGiscus(repo, repoId, catId);
      modal.style.display = 'none';
    }
  });

  return modal;
}
