// Theme toggle, mobile menu, sidebar scrollspy, reading progress, PDF modal viewer.

(function() {
  // ---- Theme ----
  const THEME_KEY = 'vnr-theme';
  const root = document.documentElement;
  const saved = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = saved || (prefersDark ? 'dark' : 'light');
  root.setAttribute('data-theme', initial);

  function updateThemeButton() {
    const btn = document.querySelector('.theme-toggle');
    if (!btn) return;
    const isDark = root.getAttribute('data-theme') === 'dark';
    btn.innerHTML = isDark ? '☀️ Licht' : '🌙 Donker';
  }

  // ---- PDF Modal ----
  const PDF_TOTAL_PAGES = 264;
  let currentPdfPage = 1;

  function openPdf(page) {
    page = Math.max(1, Math.min(PDF_TOTAL_PAGES, parseInt(page, 10) || 1));
    currentPdfPage = page;
    const modal = document.getElementById('pdfModal');
    const iframe = modal.querySelector('.pdf-modal-iframe');
    const label = document.getElementById('pdfPageLabel');
    const input = modal.querySelector('.pdf-page-input');
    // Use fragment to navigate to a specific page; reload only when src changes
    iframe.src = `boek.pdf#page=${page}&view=FitH`;
    label.textContent = page;
    if (input) input.value = page;
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // Focus the page input for quick navigation
    setTimeout(() => input && input.focus(), 50);
  }

  function closePdf() {
    const modal = document.getElementById('pdfModal');
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    // Clear the iframe so it stops downloading if not yet finished
    const iframe = modal.querySelector('.pdf-modal-iframe');
    iframe.src = '';
  }

  function changePdfPage(delta) {
    openPdf(currentPdfPage + delta);
  }

  // ---- Wire it all up ----
  document.addEventListener('DOMContentLoaded', () => {
    updateThemeButton();

    // Theme toggle
    const themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = root.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        root.setAttribute('data-theme', next);
        localStorage.setItem(THEME_KEY, next);
        updateThemeButton();
      });
    }

    // Mobile menu
    const menuBtn = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    if (menuBtn && sidebar) {
      menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('show');
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      });
    }
    document.querySelectorAll('.sidebar a').forEach(a => {
      a.addEventListener('click', () => {
        if (window.innerWidth <= 920) {
          sidebar.classList.remove('open');
          if (overlay) overlay.classList.remove('show');
        }
      });
    });

    // PDF modal triggers — gated behind Examen-pack
    document.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-page]');
      if (trigger) {
        e.preventDefault();
        // Gate the handboek behind the pack
        if (window.Auth && !window.Auth.isUnlocked()) {
          window.Auth.openUnlockModal();
          return;
        }
        openPdf(trigger.getAttribute('data-page'));
        return;
      }
      if (e.target.matches('[data-close]')) {
        closePdf();
      }
    });

    // Modal controls
    const modal = document.getElementById('pdfModal');
    if (modal) {
      const prevBtn = modal.querySelector('[data-action="prev"]');
      const nextBtn = modal.querySelector('[data-action="next"]');
      const input = modal.querySelector('.pdf-page-input');
      if (prevBtn) prevBtn.addEventListener('click', () => changePdfPage(-1));
      if (nextBtn) nextBtn.addEventListener('click', () => changePdfPage(1));
      if (input) {
        input.addEventListener('change', () => openPdf(input.value));
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') openPdf(input.value);
        });
      }
    }

    // ESC to close modal, arrow keys to navigate within modal
    document.addEventListener('keydown', (e) => {
      const modal = document.getElementById('pdfModal');
      if (!modal || modal.hidden) return;
      if (e.key === 'Escape') { closePdf(); }
      if (e.key === 'ArrowLeft' && !e.target.matches('input')) { changePdfPage(-1); }
      if (e.key === 'ArrowRight' && !e.target.matches('input')) { changePdfPage(1); }
    });

    // Scrollspy + reading progress
    const tocLinks = document.querySelectorAll('.sidebar a[href^="#"]');
    const sections = Array.from(tocLinks)
      .map(a => document.getElementById(a.getAttribute('href').slice(1)))
      .filter(Boolean);
    const progressBar = document.querySelector('.progress-bar');

    function onScroll() {
      if (progressBar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
        progressBar.style.width = pct + '%';
      }
      let activeId = sections[0]?.id;
      const scrollPos = window.scrollY + 120;
      for (const s of sections) {
        if (s.offsetTop <= scrollPos) activeId = s.id;
      }
      tocLinks.forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '#' + activeId);
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  });
})();
