(function () {
  function readSlugFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('slug');
  }

  function setStatus(statusEl, message, isError) {
    if (!statusEl) {
      return;
    }

    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', Boolean(isError));
  }

  function resolveGame(games, requestedSlug) {
    if (!Array.isArray(games) || !games.length) {
      return null;
    }

    if (requestedSlug) {
      const exactMatch = games.find(function (game) {
        return String(game.slug) === requestedSlug;
      });

      if (exactMatch) {
        return exactMatch;
      }
    }

    const firstPlayable = games.find(function (game) {
      return typeof game.gameFile === 'string' && game.gameFile.length > 0;
    });

    return firstPlayable || games[0] || null;
  }

  function bindFullscreen(playerShell, fullscreenButton) {
    if (!playerShell || !fullscreenButton) {
      return;
    }

    if (fullscreenButton.dataset.bound === '1') {
      return;
    }

    if (typeof playerShell.requestFullscreen !== 'function') {
      fullscreenButton.disabled = true;
      fullscreenButton.textContent = 'Fullscreen Unavailable';
      fullscreenButton.dataset.bound = '1';
      return;
    }

    function syncLabel() {
      fullscreenButton.textContent = document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen';
    }

    fullscreenButton.addEventListener('click', async function () {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await playerShell.requestFullscreen();
        }
      } catch (error) {
        console.warn('Fullscreen toggle failed', error);
      }
    });

    document.addEventListener('fullscreenchange', syncLabel);
    syncLabel();
    fullscreenButton.dataset.bound = '1';
  }

  async function renderPlayPage() {
    const statusEl = document.querySelector('[data-play-status]');
    const playerShell = document.querySelector('[data-play-shell]');
    const frameEl = document.querySelector('[data-game-frame]');
    const titleEl = document.querySelector('#play-page-title');
    const subtitleEl = document.querySelector('[data-play-subtitle]');
    const fullscreenButton = document.querySelector('[data-fullscreen-btn]');
    const openDirectLink = document.querySelector('[data-open-direct]');

    if (!statusEl || !playerShell || !frameEl || !window.GMGData) {
      return;
    }

    const games = await window.GMGData.loadJson('data/games.json', window.GMGData.defaultGames);

    if (!games.length) {
      setStatus(statusEl, 'No games available.', true);
      playerShell.hidden = true;
      return;
    }

    const requestedSlug = readSlugFromUrl();
    const selectedGame = resolveGame(games, requestedSlug);

    if (!selectedGame) {
      setStatus(statusEl, 'Could not resolve a game to play.', true);
      playerShell.hidden = true;
      return;
    }

    const gameTitle = selectedGame.title || 'Game';
    const gameFile = typeof selectedGame.gameFile === 'string' ? selectedGame.gameFile : '';

    if (titleEl) {
      titleEl.textContent = 'Play ' + gameTitle;
    }

    if (subtitleEl) {
      subtitleEl.textContent =
        'Running in an embedded container. Use fullscreen only when you choose.';
    }

    document.title = 'Galaxy Mini Games | Play ' + gameTitle;

    if (!gameFile) {
      setStatus(
        statusEl,
        'This game is not available to launch yet. Check its profile for status updates.',
        true
      );
      playerShell.hidden = true;
      return;
    }

    frameEl.src = gameFile;

    if (openDirectLink) {
      openDirectLink.href = gameFile;
    }

    bindFullscreen(playerShell, fullscreenButton);

    playerShell.hidden = false;

    if (requestedSlug && String(selectedGame.slug) !== requestedSlug) {
      setStatus(statusEl, 'Requested game not found. Showing the first playable title.', true);
      return;
    }

    setStatus(statusEl, 'Game loaded in container.', false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderPlayPage);
  } else {
    renderPlayPage();
  }
})();
