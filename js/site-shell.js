(function () {
  const navItems = [
    { id: 'home', label: 'Home', href: 'index.html' },
    { id: 'games', label: 'Games', href: 'games.html' },
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
      '<a class="logo logo-link" href="index.html" aria-label="Galaxy Mini Games home">Galaxy Mini Games</a>' +
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

  function initShell() {
    const pageId = document.body ? document.body.dataset.page : '';
    renderHeader(pageId);
    renderFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
})();
