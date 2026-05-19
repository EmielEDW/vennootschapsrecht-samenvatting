// Client-side access control for the Examen-pack.
// SHA-256 hashing input + matching against valid-codes.json.
// Stores unlock state in localStorage.
//
// Security note: this is light access control (€5 product, classmates).
// Pre-image attacks on 8-char codes from a 32-char alphabet are infeasible
// in a browser, and a leaked code can simply be invalidated by removing
// its hash from valid-codes.json.

(function() {
  const STORAGE_KEY = 'vnr-pack-unlocked-v1';
  const STORAGE_CODE_KEY = 'vnr-pack-code-v1';
  let _cache = null;

  async function sha256(text) {
    const enc = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function loadValidCodes() {
    if (_cache) return _cache;
    const res = await fetch('valid-codes.json');
    if (!res.ok) throw new Error('Kon valid-codes.json niet laden');
    _cache = await res.json();
    return _cache;
  }

  function normalize(code) {
    return (code || '').toUpperCase().replace(/[\s-]/g, '');
  }

  async function validateCode(code) {
    code = normalize(code);
    if (code.length < 6) return false;
    const data = await loadValidCodes();
    const h = await sha256(data.salt + code);
    return data.hashes.includes(h);
  }

  function isUnlocked() {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  function getSavedCode() {
    return localStorage.getItem(STORAGE_CODE_KEY) || '';
  }

  async function unlock(code) {
    const ok = await validateCode(code);
    if (ok) {
      localStorage.setItem(STORAGE_KEY, '1');
      localStorage.setItem(STORAGE_CODE_KEY, normalize(code));
      _emit('unlock');
    }
    return ok;
  }

  function lock() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_CODE_KEY);
    _emit('lock');
  }

  const _listeners = new Set();
  function onChange(cb) { _listeners.add(cb); return () => _listeners.delete(cb); }
  function _emit(ev) { _listeners.forEach(cb => { try { cb(ev); } catch (e) {} }); }

  // Re-emit on cross-tab unlock
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) _emit(e.newValue === '1' ? 'unlock' : 'lock');
  });

  // === Unlock modal ===
  function buildModal() {
    if (document.getElementById('unlockModal')) return;
    const html = `
<div class="unlock-modal" id="unlockModal" hidden role="dialog" aria-labelledby="unlockTitle">
  <div class="unlock-backdrop" data-unlock-close></div>
  <div class="unlock-content">
    <button class="unlock-close" data-unlock-close aria-label="Sluiten">✕</button>
    <div class="unlock-badge">💎 EXAMEN-PACK</div>
    <h2 id="unlockTitle">Ontgrendel het volledige pakket</h2>
    <p class="unlock-lead">De gratis samenvatting helpt je slagen — het Examen-pack helpt je <strong>onderscheiding</strong> halen.</p>
    <ul class="unlock-features">
      <li><strong>200+ flashcards</strong> (gratis: 40) met progress-tracking</li>
      <li><strong>Volledige quiz</strong> met scoring en feedback</li>
      <li><strong>Cheat-sheet</strong> — printbare A4 'spiekbriefje'</li>
      <li><strong>Last-minute speedrun</strong> — alles in 30 minuten</li>
      <li><strong>Handboek-PDF</strong> ingebouwde viewer + download</li>
      <li>Toegang voor altijd · betaal éénmalig</li>
    </ul>
    <div class="unlock-actions">
      <a class="unlock-buy" id="unlockBuyBtn" href="STRIPE_PAYMENT_LINK_HERE" target="_blank" rel="noopener">
        <span class="price">€5</span>
        <span class="label">Koop nu via Stripe →</span>
      </a>
      <div class="unlock-divider"><span>of</span></div>
      <form class="unlock-form" id="unlockForm">
        <label for="unlockInput">Heb je al een toegangscode?</label>
        <div class="unlock-input-row">
          <input type="text" id="unlockInput" placeholder="bv. 5KP3-X7QM" autocomplete="off" maxlength="20">
          <button type="submit">Ontgrendel</button>
        </div>
        <div class="unlock-feedback" id="unlockFeedback"></div>
      </form>
    </div>
    <p class="unlock-footer">Na betaling krijg je je code per mail (handmatig verstuurd, meestal binnen het uur). Vragen? DM <a href="mailto:emieldewaele@gmail.com">emieldewaele@gmail.com</a>.</p>
  </div>
</div>`;
    const div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstElementChild);

    const modal = document.getElementById('unlockModal');
    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-unlock-close]')) closeModal();
    });
    document.getElementById('unlockForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('unlockInput');
      const fb = document.getElementById('unlockFeedback');
      const code = input.value.trim();
      if (!code) return;
      fb.textContent = 'Aan het controleren…';
      fb.className = 'unlock-feedback';
      const ok = await unlock(code);
      if (ok) {
        fb.textContent = '✓ Code geldig! Je hebt nu toegang tot alles.';
        fb.className = 'unlock-feedback ok';
        setTimeout(() => {
          closeModal();
          // Reload to apply unlock everywhere
          window.location.reload();
        }, 900);
      } else {
        fb.textContent = '✗ Deze code is niet geldig. Check spelling of mail mij.';
        fb.className = 'unlock-feedback err';
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });
  }

  function openModal() {
    buildModal();
    document.getElementById('unlockModal').hidden = false;
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      const i = document.getElementById('unlockInput');
      if (i) i.focus();
    }, 50);
  }
  function closeModal() {
    const m = document.getElementById('unlockModal');
    if (m) m.hidden = true;
    document.body.style.overflow = '';
  }

  // Click any [data-open-unlock] to open modal
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open-unlock]');
    if (t) {
      e.preventDefault();
      openModal();
    }
  });

  // === Status badge in header ===
  function updateHeaderBadge() {
    const span = document.querySelector('[data-pack-status]');
    if (!span) return;
    if (isUnlocked()) {
      span.innerHTML = '<span class="pack-badge unlocked">💎 Pack actief</span>';
      span.title = 'Examen-pack ontgrendeld';
    } else {
      span.innerHTML = '<button class="pack-badge locked" data-open-unlock>💎 Ontgrendel pack</button>';
    }
  }

  // Public API
  window.Auth = {
    isUnlocked,
    unlock,
    lock,
    validateCode,
    onChange,
    openUnlockModal: openModal,
    closeUnlockModal: closeModal,
    getSavedCode,
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateHeaderBadge();
    onChange(updateHeaderBadge);
    // If URL ?code=XYZ, auto-unlock
    const url = new URL(window.location.href);
    const codeParam = url.searchParams.get('code');
    if (codeParam && !isUnlocked()) {
      unlock(codeParam).then(ok => {
        if (ok) {
          url.searchParams.delete('code');
          history.replaceState({}, '', url.toString());
          alert('Examen-pack ontgrendeld! ✓');
          window.location.reload();
        }
      });
    }
  });
})();
