(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    const parsedDate = new Date(value + 'T00:00:00');

    if (Number.isNaN(parsedDate.getTime())) {
      return 'Date TBD';
    }

    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(parsedDate);
  }

  function updateCardMarkup(update) {
    const title = escapeHtml(update.title || 'Update');
    const summary = escapeHtml(update.summary || 'Details coming soon.');
    const type = escapeHtml(update.type || 'General');
    const published = formatDate(update.date || '');

    return (
      '<article class="game-card update-card">' +
      '<div class="meta-row">' +
      '<span class="meta-pill">' + type + '</span>' +
      '<time class="update-date" datetime="' + escapeHtml(update.date || '') + '">' + published + '</time>' +
      '</div>' +
      '<h3>' + title + '</h3>' +
      '<p>' + summary + '</p>' +
      '</article>'
    );
  }

  async function renderUpdatesPage() {
    const list = document.querySelector('[data-updates-list]');
    const status = document.querySelector('[data-updates-status]');

    if (!list || !status || !window.GMGData) {
      return;
    }

    const updates = await window.GMGData.loadJson('data/updates.json', window.GMGData.defaultUpdates);

    if (!updates.length) {
      status.textContent = 'No updates published yet.';
      status.classList.add('is-error');
      return;
    }

    updates.sort(function (a, b) {
      return String(b.date || '').localeCompare(String(a.date || ''));
    });

    list.innerHTML = updates.map(updateCardMarkup).join('');
    status.textContent = updates.length + ' updates loaded.';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderUpdatesPage);
  } else {
    renderUpdatesPage();
  }
})();
