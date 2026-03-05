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
    const description = escapeHtml(game.description || game.tagline || 'Details coming soon.');
    const genre = escapeHtml(game.genre || 'Unknown');
    const players = escapeHtml(game.players || 'Unknown');
    const status = escapeHtml(game.status || 'TBD');
    const releaseWindow = escapeHtml(game.releaseWindow || 'TBD');
    const slug = encodeURIComponent(game.slug || 'unknown');
    const playUrl = escapeHtml(typeof game.playUrl === 'string' ? game.playUrl : '');
    const rawGameUrl = escapeHtml(typeof game.gameFile === 'string' ? game.gameFile : '');
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
    const mobileFeedTarget = rawGameUrl || previewTarget;
    const mobileFeedPreview = previewUrl
      ? '<img class="game-thumb game-thumb--mobile-feed" src="' +
        escapeHtml(previewUrl) +
        '" alt="' +
        title +
        ' preview" loading="lazy">'
      : '<div class="game-thumb game-thumb--placeholder game-thumb--mobile-feed" aria-hidden="true"></div>';
    const mobileFeedMarkup =
      '<a class="game-mobile-feed-link" href="' +
      mobileFeedTarget +
      '" target="_blank" rel="noopener">' +
      mobileFeedPreview +
      '<span class="game-mobile-feed-title">' +
      title +
      '</span></a>';
    const playAction = playUrl
      ? '<a class="play-button" href="' + playUrl + '">Play Now</a>'
      : '';

    return (
      '<article class="game-card game-card-listing">' +
      mobileFeedMarkup +
      previewMarkup +
      '<h3>' + title + '</h3>' +
      '<p>' + description + '</p>' +
      '<div class="game-card__meta">' +
      '<span class="meta-pill">' + genre + '</span>' +
      '<span class="meta-pill">' + players + '</span>' +
      '<span class="meta-pill">' + status + '</span>' +
      '<span class="meta-pill">' + releaseWindow + '</span>' +
      '</div>' +
      '<div class="game-card__actions">' +
      playAction +
      '<a class="text-link" href="game.html?slug=' + slug + '">Open Game Profile</a>' +
      '</div>' +
      '</article>'
    );
  }

  async function renderGamesPage() {
    const list = document.querySelector('[data-games-list]');
    const status = document.querySelector('[data-games-status]');

    if (!list || !status || !window.GMGData) {
      return;
    }

    const games = await window.GMGData.loadJson('data/games.json', window.GMGData.defaultGames);

    if (!games.length) {
      status.textContent = 'No games found in the roster.';
      status.classList.add('is-error');
      return;
    }

    // Show newest additions first (assuming new games are appended to data/games.json).
    const orderedGames = games.slice().reverse();
    list.innerHTML = orderedGames.map(gameCardMarkup).join('');
    status.textContent = orderedGames.length + ' games loaded.';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderGamesPage);
  } else {
    renderGamesPage();
  }
})();
