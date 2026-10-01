'use strict';

const LANZOU_RESOLVER_API = 'https://lanzou.opengl.top/index.php?url=';

async function resolveLanzouDirectUrl(lanzouUrl, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(LANZOU_RESOLVER_API + encodeURIComponent(lanzouUrl), {
      signal: controller.signal
    });
    if (!response.ok) throw new Error('resolver_http_error');
    const result = await response.json();
    if (!result || typeof result.downUrl !== 'string') throw new Error('invalid_resolver_response');
    const directUrl = new URL(result.downUrl);
    if (!['https:', 'http:'].includes(directUrl.protocol)) throw new Error('invalid_download_url');
    return directUrl.href;
  } finally {
    clearTimeout(timeout);
  }
}

function triggerDownload(url) {
  const link = document.createElement('a');
  link.href = url;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

document.addEventListener('DOMContentLoaded', () => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 767px)');
  root.classList.add('enhanced');

  // Apply the saved theme before paint; keep all controls in sync here.
  const themeButton = document.querySelector('.theme-toggle');
  function updateTheme(theme) {
    root.dataset.theme = theme;
    themeButton.setAttribute('aria-label', theme === 'dark' ? '切换至浅色模式' : '切换至深色模式');
    themeButton.setAttribute('aria-pressed', String(theme === 'light'));
    document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#f7f6fa' : '#0b0b10';
  }
  updateTheme(root.dataset.theme);
  themeButton.hidden = false;
  themeButton.addEventListener('click', () => {
    const theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    updateTheme(theme);
    try { localStorage.setItem('danbo-theme', theme); } catch (_) { /* Theme still works without storage. */ }
  });

  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.getElementById('nav-links');
  const menuLinks = [...menu.querySelectorAll('a')];
  menuButton.hidden = false;
  function setMenu(open, restoreFocus = false) {
    menu.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    if (open) menuLinks[0].focus({ preventScroll: true });
    else if (restoreFocus) menuButton.focus({ preventScroll: true });
  }
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  menuLinks.forEach(link => link.addEventListener('click', () => setMenu(false, mobile.matches)));
  document.addEventListener('click', event => {
    if (!event.target.closest('.site-header') && menu.classList.contains('is-open')) setMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (!mobile.matches || !menu.classList.contains('is-open')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(false, true);
    }
    if (event.key === 'Tab') {
      const focusable = [...menuLinks, themeButton, menuButton];
      const index = focusable.indexOf(document.activeElement);
      if (event.shiftKey && index === 0) {
        event.preventDefault(); menuButton.focus();
      } else if (!event.shiftKey && index === focusable.length - 1) {
        event.preventDefault(); menuLinks[0].focus();
      }
    }
  });
  mobile.addEventListener('change', () => setMenu(false));

  // Progressive enhancement: all installation steps are readable without JavaScript.
  const tabList = document.querySelector('.tutorial-tabs');
  const tabs = [...tabList.querySelectorAll('.tutorial-tab')];
  const panels = [...document.querySelectorAll('.tutorial-panel')];
  function selectPlatform(platform, focus = false) {
    tabs.forEach(tab => {
      const selected = tab.dataset.platform === platform;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    panels.forEach(panel => { panel.hidden = panel.id !== 'panel-' + platform; });
  }
  tabList.hidden = false;
  selectPlatform('ios');
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectPlatform(tab.dataset.platform));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) {
        event.preventDefault();
        selectPlatform(tabs[next].dataset.platform, true);
      }
    });
  });
  document.querySelectorAll('[data-guide]').forEach(link => {
    link.addEventListener('click', () => selectPlatform(link.dataset.guide));
  });

  // FAQ uses native details elements; only one answer stays expanded.
  const faqs = [...document.querySelectorAll('.faq-item')];
  faqs.forEach(faq => faq.addEventListener('toggle', () => {
    if (faq.open) faqs.forEach(other => { if (other !== faq) other.open = false; });
  }));

  // No autoplay: the reader controls the post-credits sequence.
  const quotes = [...document.querySelectorAll('.movie-quote')];
  const quoteCount = document.getElementById('quote-current');
  let quoteIndex = 0;
  function showQuote(index) {
    quoteIndex = (index + quotes.length) % quotes.length;
    quotes.forEach((quote, i) => { quote.hidden = i !== quoteIndex; });
    quoteCount.textContent = String(quoteIndex + 1).padStart(2, '0');
  }
  showQuote(0);
  document.querySelector('.quote-controls').hidden = false;
  document.querySelector('.quote-prev').addEventListener('click', () => showQuote(quoteIndex - 1));
  document.querySelector('.quote-next').addEventListener('click', () => showQuote(quoteIndex + 1));

  // Keep each original download URL accessible when the resolver is unavailable.
  document.querySelectorAll('.download-link').forEach(link => {
    link.addEventListener('click', async event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href);
      if (link.dataset.skipResolve === 'true' || !/(^|\.)lanzou[a-z]*\.com$/i.test(url.hostname)) return;
      event.preventDefault();
      if (link.getAttribute('aria-busy') === 'true') return;
      const card = link.closest('.download-card');
      const label = link.querySelector('span');
      const originalLabel = label.textContent;
      const feedback = card.querySelector('.download-feedback');
      const fallback = card.querySelector('.download-fallback');
      link.setAttribute('aria-busy', 'true');
      link.setAttribute('aria-disabled', 'true');
      label.textContent = '正在准备…';
      feedback.textContent = '正在获取下载链接，请稍候。';
      fallback.hidden = true;
      try {
        const directUrl = await resolveLanzouDirectUrl(link.href);
        triggerDownload(directUrl);
        feedback.textContent = '下载已准备好。如未开始，可打开原始下载页面。';
      } catch (error) {
        feedback.textContent = error.name === 'AbortError'
          ? '获取链接超时。点击下载按钮重试，或打开原始页面。'
          : '暂时无法获取链接。点击下载按钮重试，或打开原始页面。';
      } finally {
        fallback.href = link.href;
        fallback.hidden = false;
        label.textContent = originalLabel;
        link.removeAttribute('aria-busy');
        link.removeAttribute('aria-disabled');
      }
    });
  });

  const dialog = document.querySelector('.screenshot-dialog');
  const previewImage = document.getElementById('preview-image');
  const previewTitle = document.getElementById('preview-title');
  let previewTrigger;
  if (typeof dialog.showModal === 'function') {
    document.querySelectorAll('[data-preview]').forEach(button => {
      button.hidden = false;
      button.addEventListener('click', () => {
        previewTrigger = button;
        previewImage.src = mobile.matches ? button.dataset.mobilePreview : button.dataset.preview;
        previewImage.alt = button.dataset.previewTitle;
        previewTitle.textContent = button.dataset.previewTitle;
        dialog.showModal();
      });
    });
  }
  document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => { if (previewTrigger) previewTrigger.focus({ preventScroll: true }); });

  // Only animate after the observer exists; a blocked script never hides content.
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        entry.target.classList.remove('will-reveal');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -20px 0px' });
    document.querySelectorAll('.reveal').forEach(element => {
      if (!reduceMotion.matches && element.getBoundingClientRect().top > window.innerHeight) element.classList.add('will-reveal');
      revealObserver.observe(element);
    });
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) document.querySelectorAll('.will-reveal').forEach(element => element.classList.remove('will-reveal'));
    });

    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const activeHref = '#' + entry.target.id;
        menuLinks.forEach(link => {
          if (link.getAttribute('href') === activeHref) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-20% 0px -65% 0px', threshold: 0 });
    document.querySelectorAll('#hero, #overview, #download, #tutorial, #quotes').forEach(section => sectionObserver.observe(section));
  }
});
