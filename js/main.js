/**
 * Beethoven Web - Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initTerminalTabs();
  initCopyButtons();
  initPipelineStepper();
  initSmoothScroll();
});

/* ==========================================================================
   Theme Management (Dark / Light with LocalStorage & Giscus Sync)
   ========================================================================== */
function initTheme() {
  const savedTheme = localStorage.getItem('bvn_theme') || 'dark';
  setTheme(savedTheme);

  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(newTheme);
      localStorage.setItem('bvn_theme', newTheme);
    });
  });
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtns = document.querySelectorAll('.theme-toggle-btn');
  toggleBtns.forEach(btn => {
    btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    btn.innerHTML = theme === 'dark' 
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
  });

  // Sync with Giscus if active
  syncGiscusTheme(theme);
}

function syncGiscusTheme(theme) {
  const giscusFrame = document.querySelector('iframe.giscus-frame');
  if (!giscusFrame) return;

  const giscusTheme = theme === 'dark' ? 'dark_dimmed' : 'light';
  giscusFrame.contentWindow.postMessage(
    { giscus: { setConfig: { theme: giscusTheme } } },
    'https://giscus.app'
  );
}

/* ==========================================================================
   Mobile Menu Navigation
   ========================================================================== */
function initMobileMenu() {
  const menuBtn = document.querySelector('.mobile-menu-btn');
  const navMenu = document.querySelector('.nav-menu');

  if (!menuBtn || !navMenu) return;

  menuBtn.addEventListener('click', () => {
    navMenu.classList.toggle('open');
    const isOpen = navMenu.classList.contains('open');
    menuBtn.setAttribute('aria-expanded', isOpen);
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
    });
  });
}

/* ==========================================================================
   Interactive Terminal Tabs
   ========================================================================== */
function initTerminalTabs() {
  const tabs = document.querySelectorAll('.terminal-tab');
  const views = document.querySelectorAll('.code-view');

  if (!tabs.length || !views.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');

      tabs.forEach(t => t.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      const targetView = document.getElementById(targetId);
      if (targetView) {
        targetView.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   Copy to Clipboard Functionality
   ========================================================================== */
function initCopyButtons() {
  const copyBtns = document.querySelectorAll('.copy-btn, .snippet-copy');

  copyBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      let textToCopy = '';

      if (btn.getAttribute('data-copy-target')) {
        const targetElement = document.querySelector(btn.getAttribute('data-copy-target'));
        if (targetElement) {
          textToCopy = targetElement.innerText || targetElement.textContent;
        }
      } else if (btn.getAttribute('data-clipboard')) {
        textToCopy = btn.getAttribute('data-clipboard');
      } else {
        const parent = btn.closest('.workbench-showcase') || btn.closest('.code-snippet');
        const activeView = parent ? parent.querySelector('.code-view.active') || parent.querySelector('code') : null;
        if (activeView) {
          textToCopy = activeView.innerText || activeView.textContent;
        }
      }

      if (!textToCopy) return;

      try {
        await navigator.clipboard.writeText(textToCopy.trim());
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> <span>Copied!</span>`;
        btn.style.borderColor = '#34d399';

        setTimeout(() => {
          btn.innerHTML = originalHTML;
          btn.style.borderColor = '';
        }, 2000);
      } catch (err) {
        console.warn('Clipboard copy failed:', err);
      }
    });
  });
}

/* ==========================================================================
   Interactive Pipeline Stepper
   ========================================================================== */
const pipelineStages = [
  {
    step: 1,
    title: "1. Goal Decomposition & Interface Blueprints",
    desc: "The Orchestrator LLM breaks high-level user prompts into discrete, atomic tasks. Before any code is synthesized, a strict JSON blueprint defines every symbol contract, target file, scope, and behavioral expectation. C++ code enforces structural integrity without relying on fuzzy model interpretations.",
    badges: ["JSON Blueprint", "Structural Gate", "Zero Regex Overrule"],
    code: `// Orchestrator Blueprint Contract
{
  "tasks": [
    {
      "id": 1,
      "target_file": "src/core/vfs.cpp",
      "scope": "symbol:vfs_mount",
      "behaviour": "Support read-only overlay mounts with shadow file tracking.",
      "dependencies": []
    }
  ]
}`
  },
  {
    step: 2,
    title: "2. Live Tree-Sitter AST Symbol Extraction",
    desc: "Beethoven parses the codebase in-memory with Tree-Sitter. When a worker is assigned to modify a function or struct, Beethoven extracts the exact AST byte-ranges of the symbol, its signatures, and dependent headers, injecting them verbatim into the prompt. Workers never guess a signature.",
    badges: ["Tree-Sitter C++", "In-Memory AST", "Verbatim Byte-Ranges"],
    code: `// Tree-Sitter AST Extraction
[AST Resolution: src/core/vfs.h]
Byte range: 1240-1412
Symbol: bool vfs_mount(const std::string& path, uint32_t flags);
Dependencies extracted:
  - struct VfsMountContext (core/types.h:42)
  - enum class MountFlags : uint8_t (core/types.h:88)`
  },
  {
    step: 3,
    title: "3. Concurrency-First Worker Pool",
    desc: "Tasks targeting separate files run concurrently across high-speed C++ worker threads. When multiple tasks touch the same file, Beethoven sequences their execution within a wave, tracking byte-offset shifts in real time so concurrent edits splice cleanly without merge conflicts.",
    badges: ["std::jthread", "Lock-Free Ring Buffers", "Dynamic Offset Tracking"],
    code: `// Safe Concurrent Splicing Pipeline
Wave #1 Dispatched:
  -> Worker Thread #4: editing src/net/socket.cpp (range 40-120)
  -> Worker Thread #7: editing src/core/vfs.cpp (range 150-280)
  -> Worker Thread #2: queued for src/core/vfs.cpp (offset shifted by +18 bytes)`
  },
  {
    step: 4,
    title: "4. Pluggable Shadow Compiler Validation",
    desc: "Before any edit touches the host project tree, it is validated in an in-memory shadow buffer against the language's declared verification adapter. If compilation fails, the stderr stream is fed directly into a localized repair loop before the worker concludes its turn.",
    badges: ["Instant std::err", "Zero Context Bleed", "Language Adapters"],
    code: `// Shadow Compiler Diagnostic Check
[Adapter: clang++ -fsyntax-only -std=c++20]
Validation status: REPAIR TRIGGERED
stderr:
  src/core/vfs.cpp:64:12: error: no matching member function for call to 'emplace'
Candidate repair injected into worker session. Repaired in 420ms.`
  },
  {
    step: 5,
    title: "5. Whole-Tree Invariant Gates & CTest",
    desc: "Once all wave tasks land, the project test harness runs. Four hard architectural source gates (layer rules, empty catch guards, hang breach lock-free safety, and voice ordering) verify codebase health before committing to version control.",
    badges: ["Source Lint Gates", "CTest Suites", "Zero Rot Policy"],
    code: `// Beethoven Invariant Verification
Gate [check_layer_rule]    : PASSED (ai/llm isolation verified)
Gate [check_empty_catch]   : PASSED (no swallowed exceptions)
Gate [check_hang_path]     : PASSED (allocation-free breach confirmed)
Gate [check_voice_locks]   : PASSED (audio lock hierarchy verified)
Result: 116/116 GoogleTest suites passing.`
  }
];

function initPipelineStepper() {
  const stepNodes = document.querySelectorAll('.step-node');
  const infoContainer = document.querySelector('.pipeline-detail-info');
  const codeBox = document.querySelector('.pipeline-code-box');

  if (!stepNodes.length || !infoContainer || !codeBox) return;

  stepNodes.forEach((node, index) => {
    node.addEventListener('click', () => {
      stepNodes.forEach(n => n.classList.remove('active'));
      node.classList.add('active');

      const stage = pipelineStages[index];
      if (!stage) return;

      const badgesHtml = stage.badges
        .map(b => `<span class="pipeline-badge">${b}</span>`)
        .join('');

      infoContainer.innerHTML = `
        <h4>${stage.title}</h4>
        <p>${stage.desc}</p>
        <div class="pipeline-detail-badges">
          ${badgesHtml}
        </div>
      `;

      codeBox.innerHTML = `<code>${escapeHtml(stage.code)}</code>`;
    });
  });
}

function escapeHtml(string) {
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ==========================================================================
   Smooth Scrolling
   ========================================================================== */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });
}
