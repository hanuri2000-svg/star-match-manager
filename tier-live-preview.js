/* v5.23.10 - SOOP live hover/touch preview for the tier table. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('broadcast') === '1') return;

  const delayMs = 450;
  const root = document.createElement('section');
  root.className = 'tier-live-preview';
  root.hidden = true;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'SOOP LIVE 방송 미리보기');
  root.innerHTML = '<div class="tier-live-preview-head"><span class="tier-live-preview-title"></span><span class="tier-live-preview-badge">● LIVE</span><button class="tier-live-preview-close" type="button" aria-label="미리보기 닫기">×</button></div><div class="tier-live-preview-video"></div><div class="tier-live-preview-foot"><span>방송 재생이 안 되면 SOOP에서 열어줘.</span><a target="_blank" rel="noopener noreferrer" class="tier-live-preview-open">SOOP에서 보기 ↗</a></div>';
  document.body.appendChild(root);

  const title = root.querySelector('.tier-live-preview-title');
  const video = root.querySelector('.tier-live-preview-video');
  const openLink = root.querySelector('.tier-live-preview-open');
  const closeButton = root.querySelector('.tier-live-preview-close');
  let activeAnchor = null;
  let openTimer = 0;
  let closeTimer = 0;

  function clearTimers() {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    openTimer = 0;
    closeTimer = 0;
  }

  function parseEmbed(urlString) {
    try {
      const url = new URL(urlString);
      if (url.protocol !== 'https:') return '';
      const allowed = ['play.sooplive.com', 'play.sooplive.co.kr', 'ch.sooplive.co.kr', 'ch.sooplive.com'];
      if (!allowed.includes(url.hostname.toLowerCase())) return '';
      const path = url.pathname.split('/').filter(Boolean);
      const id = path[0] || '';
      if (!/^[a-z0-9_-]{1,40}$/i.test(id)) return '';
      const broadNo = path[1] && /^\d{1,20}$/.test(path[1]) ? '/' + path[1] : '';
      return 'https://play.sooplive.com/' + encodeURIComponent(id) + broadNo +
        '/embed?autoPlay=true&mutePlay=true&showChat=false';
    } catch (_) {
      return '';
    }
  }

  function position(anchor) {
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(440, window.innerWidth - 20);
    const height = root.getBoundingClientRect().height || 320;
    const left = Math.min(Math.max(10, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 10);
    const below = rect.bottom + 12;
    const top = below + height <= window.innerHeight - 8
      ? below : Math.max(8, rect.top - height - 12);
    root.style.width = width + 'px';
    root.style.left = left + 'px';
    root.style.top = top + 'px';
  }

  function closePreview() {
    clearTimers();
    activeAnchor = null;
    root.hidden = true;
    root.classList.remove('is-open');
    // Detaching the iframe stops playback and releases the stream immediately.
    video.replaceChildren();
  }

  function showPreview(anchor) {
    if (!anchor || !anchor.isConnected || !anchor.classList.contains('native-live')) return;
    const liveUrl = anchor.href;
    const embed = parseEmbed(liveUrl);
    if (!embed) return;
    clearTimers();

    if (activeAnchor === anchor && !root.hidden) {
      position(anchor);
      return;
    }
    activeAnchor = anchor;
    const name = anchor.closest('.native-tier-player')?.querySelector('strong')?.textContent?.trim() || '선수';
    title.textContent = name + ' 방송 미리보기';
    openLink.href = liveUrl;
    video.replaceChildren();
    const iframe = document.createElement('iframe');
    iframe.title = name + ' SOOP 실시간 방송';
    iframe.src = embed;
    iframe.loading = 'eager';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
    iframe.setAttribute('allowfullscreen', '');
    video.appendChild(iframe);
    root.hidden = false;
    root.classList.add('is-open');
    position(anchor);
  }

  function delayedClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closePreview, 230);
  }

  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const anchor = event.target.closest?.('.native-live');
    if (!anchor || anchor.contains(event.relatedTarget)) return;
    clearTimers();
    if (anchor === activeAnchor && !root.hidden) return;
    openTimer = setTimeout(() => showPreview(anchor), delayMs);
  });

  document.addEventListener('pointerout', event => {
    if (event.pointerType === 'touch') return;
    const anchor = event.target.closest?.('.native-live');
    if (!anchor || anchor.contains(event.relatedTarget)) return;
    clearTimeout(openTimer);
    openTimer = 0;
    if (!root.hidden) delayedClose();
  });

  root.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  root.addEventListener('pointerleave', delayedClose);
  closeButton.addEventListener('click', closePreview);
  document.addEventListener('focusin', event => {
    const anchor = event.target.closest?.('.native-live');
    if (!anchor) return;
    clearTimers();
    openTimer = setTimeout(() => showPreview(anchor), delayMs);
  });
  document.addEventListener('click', event => {
    const anchor = event.target.closest?.('.native-live');
    if (anchor) {
      const touchMode = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      if (!touchMode) return; // Preserve the existing click-to-watch behavior on desktop.
      event.preventDefault();
      if (activeAnchor === anchor && !root.hidden) closePreview();
      else showPreview(anchor);
      return;
    }
    if (!root.hidden && !root.contains(event.target)) closePreview();
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !root.hidden) closePreview();
  });
  window.addEventListener('scroll', () => { if (!root.hidden) closePreview(); }, {passive:true, capture:true});
  window.addEventListener('resize', () => { if (!root.hidden && activeAnchor) position(activeAnchor); });
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-tab]') && !root.hidden) closePreview();
  });
})();
