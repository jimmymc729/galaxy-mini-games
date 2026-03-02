(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
  }

  function profileMarkup(game) {
    const title = escapeHtml(game.title || 'Untitled Game');
    const tagline = escapeHtml(game.tagline || 'No tagline yet.');
    const description = escapeHtml(game.description || 'No description yet.');
    const genre = escapeHtml(game.genre || 'Unknown');
    const players = escapeHtml(game.players || 'Unknown');
    const status = escapeHtml(game.status || 'TBD');
    const releaseWindow = escapeHtml(game.releaseWindow || 'TBD');
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
        '"><img class="game-thumb game-thumb--profile" src="' +
        escapeHtml(previewUrl) +
        '" alt="' +
        title +
        ' preview" loading="lazy"></a>'
      : '<div class="game-thumb game-thumb--placeholder game-thumb--profile" aria-hidden="true"></div>';
    const playAction = playUrl
      ? '<a class="play-button" href="' + playUrl + '">Play Now</a>'
      : '';

    return (
      '<div class="game-card__content">' +
      previewMarkup +
      '<h3>' + title + '</h3>' +
      '<p class="game-tagline">' + tagline + '</p>' +
      '<p>' + description + '</p>' +
      '<div class="game-card__meta">' +
      '<span class="meta-pill">' + genre + '</span>' +
      '<span class="meta-pill">' + players + '</span>' +
      '<span class="meta-pill">' + status + '</span>' +
      '<span class="meta-pill">' + releaseWindow + '</span>' +
      '</div>' +
      '<div class="game-card__actions">' +
      playAction +
      '<a class="text-link" href="games.html">Back to all games</a>' +
      '</div>' +
      '</div>'
    );
  }

  async function renderGamePage() {
    const profile = document.querySelector('[data-game-profile]');
    const status = document.querySelector('[data-game-status]');

    if (!profile || !status || !window.GMGData) {
      return;
    }

    const games = await window.GMGData.loadJson('data/games.json', window.GMGData.defaultGames);

    if (!games.length) {
      status.textContent = 'No game data available.';
      status.classList.add('is-error');
      return;
    }

    const requestedSlug = readSlugFromUrl();
    let selectedGame = null;

    if (requestedSlug) {
      selectedGame = games.find(function (game) {
        return String(game.slug) === requestedSlug;
      });
    }

    if (!selectedGame) {
      selectedGame = games[0];
    }

    profile.innerHTML = profileMarkup(selectedGame);

    const headerTitle = document.querySelector('#game-template-title');
    if (headerTitle) {
      headerTitle.textContent = selectedGame.title;
    }

    document.title = 'Galaxy Mini Games | ' + selectedGame.title;
    status.textContent = 'Profile loaded.';

    if (requestedSlug && String(selectedGame.slug) !== requestedSlug) {
      status.textContent = 'Requested slug not found. Showing first game profile.';
      status.classList.add('is-error');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGamePage);
  } else {
    renderGamePage();
  }
})();
