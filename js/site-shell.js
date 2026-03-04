(function () {
  const GA_MEASUREMENT_ID = 'G-ZCHTLPM0KL';

  const navItems = [
    { id: 'games', label: 'Games', href: 'index.html' },
    { id: 'updates', label: 'Updates', href: 'updates.html' },
    { id: 'about', label: 'About', href: 'about.html' }
  ];

  function renderHeader(pageId) {
    const header = document.querySelector('[data-site-header]');

    if (!header) {
      return;
    }

    const navMarkup = navItems
      .map(function (item) {
        const activeClass = item.id === pageId ? ' is-active' : '';
        return '<li><a class="nav-link' + activeClass + '" href="' + item.href + '">' + item.label + '</a></li>';
      })
      .join('');

    header.innerHTML =
      '<div class="container header-wrap">' +
      '<a class="logo logo-link" href="index.html" aria-label="Galaxy Mini Games">Galaxy Mini Games</a>' +
      '<nav class="site-nav" aria-label="Primary">' +
      '<ul class="nav-list">' +
      navMarkup +
      '</ul>' +
      '</nav>' +
      '</div>';
  }

  function renderFooter() {
    const footer = document.querySelector('[data-site-footer]');

    if (!footer) {
      return;
    }

    const year = new Date().getFullYear();

    footer.innerHTML =
      '<div class="container footer-wrap">' +
      '<p>Galaxy Mini Games</p>' +
      '<p class="footer-copy">Retro browser arcade builds. ' + year + '.</p>' +
      '</div>';
  }

  function initAnalytics() {
    if (!GA_MEASUREMENT_ID || window.location.protocol === 'file:') {
      return;
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };

    if (!window.__GMG_GA_LOADER_ADDED) {
      const loader = document.createElement('script');
      loader.async = true;
      loader.src =
        'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
      loader.dataset.gmgGaLoader = '1';
      document.head.appendChild(loader);
      window.__GMG_GA_LOADER_ADDED = true;
    }

    if (!window.__GMG_GA_CONFIGURED) {
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });
      window.__GMG_GA_CONFIGURED = true;
    }

    window.GMGAnalytics = window.GMGAnalytics || {
      track: function (eventName, eventParams) {
        if (!eventName || typeof window.gtag !== 'function') {
          return;
        }

        window.gtag('event', eventName, eventParams || {});
      }
    };
  }

  function initShell() {
    const pageId = document.body ? document.body.dataset.page : '';
    initAnalytics();
    renderHeader(pageId);
    renderFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
})();
