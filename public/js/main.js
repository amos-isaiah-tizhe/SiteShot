/* ============================================================
   OneXp SiteShot — Main JS
   ============================================================ */

// ---- Mobile menu toggle ----
document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => {
      const open = mobileNav.style.display === 'flex';
      mobileNav.style.display = open ? 'none' : 'flex';
      menuBtn.setAttribute('aria-expanded', String(!open));
    });
  }

  // ---- FAQ accordion ----
  document.querySelectorAll('.faq-trigger').forEach((btn) => {
    btn.addEventListener('click', () => {
      const answer = btn.nextElementSibling;
      const icon = btn.querySelector('.faq-icon');
      const isOpen = answer.classList.contains('open');
      answer.classList.toggle('open', !isOpen);
      icon.classList.toggle('open', !isOpen);
    });
  });

  // ---- Screenshot capture form ----
  const captureForm = document.getElementById('capture-form');
  if (captureForm) {
    initCaptureForm();
  }

  // ---- Set current year in footer ----
  const yearEls = document.querySelectorAll('.current-year');
  yearEls.forEach(el => { el.textContent = new Date().getFullYear(); });
});

// ---- Screenshot capture ----
function initCaptureForm() {
  const DEVICE_PRESETS = {
    desktop: { width: 1440, height: 900 },
    tablet:  { width: 768,  height: 1024 },
    mobile:  { width: 390,  height: 844 },
  };

  const form       = document.getElementById('capture-form');
  const urlInput   = document.getElementById('url');
  const widthInput = document.getElementById('width');
  const heightInput= document.getElementById('height');
  const formatSel  = document.getElementById('format');
  const fullPageCb = document.getElementById('fullPage');
  const submitBtn  = document.getElementById('submit-btn');
  const errorEl    = document.getElementById('capture-error');
  const resultEl   = document.getElementById('screenshot-result');
  const deviceBtns = document.querySelectorAll('.device-btn');

  // Auto-fill URL from query param and trigger capture
// Auto-fill URL from query param and trigger capture
const params = new URLSearchParams(window.location.search);
const presetUrl = params.get('url');
if (presetUrl) {
  urlInput.value = presetUrl;
  setTimeout(() => form.requestSubmit(), 500);
}

// Device preset buttons
deviceBtns.forEach(btn => {
  // Device preset buttons
    btn.addEventListener('click', () => {
      const d = btn.dataset.device;
      deviceBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      widthInput.value  = DEVICE_PRESETS[d].width;
      heightInput.value = DEVICE_PRESETS[d].height;
    });
  });

  // Disable height when full page
  fullPageCb.addEventListener('change', () => {
    heightInput.disabled = fullPageCb.checked;
  });
  heightInput.disabled = fullPageCb.checked;

  // Validate URL
  function normalizeUrl(input) {
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
      const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      const u = new URL(withProto);
      if (!u.hostname.includes('.')) return null;
      return u.toString();
    } catch {
      return null;
    }
  }

  function buildScreenshotUrl(opts) {
  const params = new URLSearchParams({
    url:      opts.url,
    width:    opts.width,
    height:   opts.height,
    fullPage: opts.fullPage,
    format:   opts.format
  });
  return `/api/screenshot?${params.toString()}`;
}

// Show guest limit modal

function showGuestLimitModal() {
  // Remove existing modal if any
  const existing = document.getElementById('guest-limit-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'guest-limit-modal';
  modal.style.cssText = `
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  `;

  modal.innerHTML = `
    <div style="
      background: var(--color-surface);
      border-radius: var(--radius);
      padding: 2rem;
      max-width: 28rem;
      width: 100%;
      text-align: center;
      box-shadow: var(--shadow-lg);
    ">
      <div style="font-size:2.5rem;color:var(--color-primary);margin-bottom:1rem">
        <i class="fa-solid fa-camera"></i>
      </div>
      <h2 style="font-size:1.25rem;font-weight:800;margin-bottom:0.5rem">
        You've used all 5 free captures
      </h2>
      <p style="color:var(--color-text-muted);font-size:0.875rem;margin-bottom:1.5rem;line-height:1.6">
        Create a free account to get <strong>100 captures per month</strong>
        plus PNG, PDF export and API access.
      </p>
      <div style="display:flex;flex-direction:column;gap:0.75rem">
        <a href="/register" class="btn-primary btn-full">
          Create free account
        </a>
        <a href="/login" class="btn-secondary btn-full">
          Log in to existing account
        </a>
        <button onclick="document.getElementById('guest-limit-modal').remove()" style="
          background:none;border:none;color:var(--color-text-muted);
          font-size:0.8rem;cursor:pointer;padding:0.25rem
        ">
          Dismiss — resets in 24 hours
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
}

// Error handling

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }
  function clearError() {
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearError();

    const normalized = normalizeUrl(urlInput.value);
    if (!normalized) {
      showError('Please enter a valid website URL.');
      return;
    }

    const format   = formatSel.value;
    const fullPage = fullPageCb.checked;
    const width    = parseInt(widthInput.value, 10)  || 1440;
    const height   = parseInt(heightInput.value, 10) || 900;
    const src      = buildScreenshotUrl({ url: normalized, width, height, fullPage, format });

    // Show guest usage warning after 3rd capture
const guestCount = parseInt(sessionStorage.getItem('guestCount') || '0') + 1;
sessionStorage.setItem('guestCount', guestCount);
if (guestCount === 3) {
  const warn = document.createElement('p');
  warn.id = 'guest-warn';
  warn.style.cssText = 'font-size:0.8rem;color:var(--color-text-muted);margin-top:0.5rem;text-align:center';
  warn.innerHTML = '<i class="fa-solid fa-circle-info" style="margin-right:0.3rem;color:var(--color-primary)"></i>You have <strong>2 free captures</strong> left today. <a href="/register" style="color:var(--color-primary)">Sign up</a> for 100/month free.';
  const existing = document.getElementById('guest-warn');
  if (existing) existing.remove();
  captureForm.appendChild(warn);
}

    // Show loading state

submitBtn.disabled    = true;
submitBtn.textContent = 'Capturing…';
resultEl.style.display = 'none';

// Show bot warning after 10 seconds
const botWarningTimer = setTimeout(() => {
  const existing = document.getElementById('bot-warning');
  if (!existing) {
    const warning = document.createElement('p');
    warning.id = 'bot-warning';
    warning.className = 'form-error';
    warning.style.marginTop = '0.5rem';
    warning.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="margin-right:0.4rem"></i> This website may be blocking access, this may take longer than usual.';
    form.appendChild(warning);
  }
}, 70000);

    // Build result UI
    const urlSpan    = document.getElementById('result-url');
    const openLink   = document.getElementById('result-open');
    const dlLink     = document.getElementById('result-download');
    const imgEl      = document.getElementById('result-img');
    const iframeEl   = document.getElementById('result-iframe');

    urlSpan.textContent     = normalized;
    urlSpan.title           = normalized;
    openLink.href           = src;
    dlLink.href             = src;
    dlLink.download         = `siteshot.${format}`;

    if (format === 'pdf') {
      imgEl.style.display    = 'none';
      iframeEl.style.display = 'block';
      iframeEl.src           = src;
      iframeEl.onload = () => {
        submitBtn.disabled    = false;
        submitBtn.textContent = 'Capture screenshot';
      };
    } else {
    iframeEl.style.display = 'none';
imgEl.style.display    = 'none';
imgEl.src              = src;
imgEl.alt              = `Screenshot of ${normalized}`;
imgEl.onload = () => {
  clearTimeout(botWarningTimer);
  const warning = document.getElementById('bot-warning');
  if (warning) warning.remove();
  document.getElementById('capture-loader').style.display = 'none';
  imgEl.style.display   = 'block';
  submitBtn.disabled    = false;
  submitBtn.textContent = 'Capture screenshot';
};
     imgEl.onerror = async () => {
  clearTimeout(botWarningTimer);
  const warning = document.getElementById('bot-warning');
  if (warning) warning.remove();
  submitBtn.disabled    = false;
  submitBtn.textContent = 'Capture screenshot';

  // Check if it's a guest limit error
  try {
    const checkRes  = await fetch(src);
    const data      = await checkRes.json();
    if (data.error === 'guest_limit') {
      showGuestLimitModal();
      return;
    }
  } catch {}

  showError('Could not capture this URL. Please try another.');
  resultEl.style.display = 'none';
};
    }

   // Show loader
resultEl.style.display = 'block';
resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });

const loaderEl = document.getElementById('capture-loader');
loaderEl.style.display = 'flex';
imgEl.style.display = 'none';
iframeEl.style.display = 'none';
  });
}
