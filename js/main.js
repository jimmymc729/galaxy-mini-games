(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function gameCardMarkup(game) {
    const title = escapeHtml(game.title || 'Untitled Game');
    const tagline = escapeHtml(game.tagline || 'Details coming soon.');
    const genre = escapeHtml(game.genre || 'Unknown');
    const status = escapeHtml(game.status || 'TBD');
    const slug = encodeURIComponent(game.slug || 'unknown');
    const playUrl = escapeHtml(typeof game.playUrl === 'string' ? game.playUrl : '');
    const previewTarget = playUrl || ('game.html?slug=' + slug);
    const previewUrl =
      window.GMGData && typeof window.GMGData.getPreviewUrl === 'function'
        ? window.GMGData.getPreviewUrl(game)
        : '';
    const previewMarkup = previewUrl
      ? '<a class="game-thumb-link" href="' +
        previewTarget +
        '"><img class="game-thumb" src="' +
        escapeHtml(previewUrl) +
        '" alt="' +
        title +
        ' preview" loading="lazy"></a>'
      : '<div class="game-thumb game-thumb--placeholder" aria-hidden="true"></div>';
    const playAction = playUrl
      ? '<a class="play-button" href="' + playUrl + '">Play Now</a>'
      : '';

    return (
      '<article class="game-card game-card-listing">' +
      previewMarkup +
      '<h3>' + title + '</h3>' +
      '<p>' + tagline + '</p>' +
      '<div class="game-card__meta">' +
      '<span class="meta-pill">' + genre + '</span>' +
      '<span class="meta-pill">' + status + '</span>' +
      '</div>' +
      '<div class="game-card__actions">' +
      playAction +
      '<a class="text-link" href="game.html?slug=' + slug + '">Open Game Profile</a>' +
      '</div>' +
      '</article>'
    );
  }

  async function renderHomeGames() {
    const grid = document.querySelector('[data-home-games]');
    const status = document.querySelector('[data-home-status]');

    if (!grid || !status || !window.GMGData) {
      return;
    }

    const games = await window.GMGData.loadJson('data/games.json', window.GMGData.defaultGames);

    if (!games.length) {
      status.textContent = 'No games available yet.';
      return;
    }

    const spotlight = games.slice(0, 4);

    grid.innerHTML = spotlight.map(gameCardMarkup).join('');
    status.textContent = spotlight.length + ' game profiles loaded.';
  }

  function initHomePage() {
    renderHomeGames();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomePage);
  } else {
    initHomePage();
  }
})();
