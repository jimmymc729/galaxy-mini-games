(function () {
  const defaultGames = [
    {
      slug: 'sea-monkey-simulator',
      title: 'Sea Monkey Simulator',
      tagline: 'Grow a tiny colony into a thriving neon ecosystem.',
      description:
        'Balance food, oxygen, and tank upgrades while your sea monkey colony expands through calm management loops.',
      genre: 'Simulation',
      players: 'Single Player',
      status: 'Playable',
      releaseWindow: 'Live Now',
      playUrl: 'play.html?slug=sea-monkey-simulator',
      gameFile: 'sea-monkey-simulator.html',
      previewImage: 'assets/previews/sea-monkey-simulator-preview.png'
    },
    {
      slug: 'microcosm',
      title: 'Microcosm',
      tagline: 'Guide a single-celled organism through a luminous microscopic arena.',
      description:
        'Absorb glucose, amino acids, and ATP while dodging predatory protozoa and viscous gel zones in a stylized microscope world.',
      genre: 'Arcade',
      players: 'Single Player + AI Bots',
      status: 'Playable',
      releaseWindow: 'Live Now',
      playUrl: 'play.html?slug=microcosm',
      gameFile: 'microcosm/index.html',
      previewImage: 'assets/previews/microcosm-preview.png'
    },
    {
      slug: 'infinite-runner',
      title: 'Space Runner',
      tagline: 'Dash the ring-depth and blast through alien swarms.',
      description:
        'Lane-shift, jump, and fire your way through a fast arcade run while your ship health and speed pressure climb.',
      genre: 'Arcade Runner',
      players: 'Single Player',
      status: 'Playable',
      releaseWindow: 'Live Now',
      playUrl: 'play.html?slug=infinite-runner',
      gameFile: 'infinite-runner/index.html',
      previewImage: 'assets/previews/space-runner-preview.png'
    },
    {
      slug: 'moonjet-cavern',
      title: 'Moonjet Cavern',
      tagline: 'Thread a jetpack astronaut through narrow lunar caverns.',
      description:
        'Tap to thrust, avoid stone pillars, and chase high scores in this tight one-button arcade challenge.',
      genre: 'Arcade',
      players: 'Single Player',
      status: 'Playable',
      releaseWindow: 'Live Now',
      playUrl: 'play.html?slug=moonjet-cavern',
      gameFile: 'moonjet-cavern/index.html',
      previewImage: 'assets/previews/moonjet-cavern-preview.png'
    },
    {
      slug: 'asteroid-drifter',
      title: 'Asteroid Drifter',
      tagline: 'Thread your ship through shifting asteroid belts.',
      description:
        'Arcade score-runner with precision dodging, collectible boosts, and escalating cosmic storm patterns.',
      genre: 'Arcade',
      players: 'Single Player',
      status: 'Prototype',
      releaseWindow: 'Q3 2026'
    },
    {
      slug: 'lunar-loop-racer',
      title: 'Lunar Loop Racer',
      tagline: 'Low-gravity laps with boost pads and risky shortcuts.',
      description:
        'Race compact moon circuits, chain perfect drifts, and chase leaderboard-ready lap times.',
      genre: 'Racing',
      players: '1-4 Local Turns',
      status: 'Design',
      releaseWindow: 'Q4 2026'
    },
    {
      slug: 'nebula-kitchen',
      title: 'Nebula Kitchen',
      tagline: 'Cook chaotic alien orders under stellar time pressure.',
      description:
        'Fast reaction kitchen management with escalating order complexity and combo-based scoring.',
      genre: 'Party',
      players: '1-2 Players',
      status: 'Concept',
      releaseWindow: 'TBD'
    }
  ];

  const defaultUpdates = [
    {
      date: '2026-03-01',
      title: 'Portal V1 Visual Pass',
      summary:
        'Shipped the retro-galactic visual direction with neon typography, atmospheric layers, and responsive card layouts.',
      type: 'Design'
    },
    {
      date: '2026-02-28',
      title: 'Sea Monkey Simulator Core Loop Drafted',
      summary:
        'Defined the initial colony growth loop, tank upgrade milestones, and progression pacing goals.',
      type: 'Gameplay'
    }
  ];

  function cloneEntries(entries) {
    return entries.map(function (entry) {
      return Object.assign({}, entry);
    });
  }

  function previewStorageKey(slug) {
    return 'gmg-preview-' + String(slug || 'unknown');
  }

  function getPreviewUrl(game) {
    if (!game || typeof game !== 'object') {
      return '';
    }

    if (typeof game.previewImage === 'string' && game.previewImage.length > 0) {
      return game.previewImage;
    }

    if (!game.slug) {
      return '';
    }

    try {
      return window.localStorage.getItem(previewStorageKey(game.slug)) || '';
    } catch (error) {
      console.warn('Preview storage unavailable', error);
      return '';
    }
  }

  function savePreviewUrl(slug, dataUrl) {
    if (!slug || typeof dataUrl !== 'string' || dataUrl.length === 0) {
      return false;
    }

    try {
      window.localStorage.setItem(previewStorageKey(slug), dataUrl);
      return true;
    } catch (error) {
      console.warn('Failed to save preview', error);
      return false;
    }
  }

  async function loadJson(path, fallbackEntries) {
    try {
      const response = await fetch(path, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Request failed with status ' + response.status);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : cloneEntries(fallbackEntries);
    } catch (error) {
      console.warn('Using fallback data for', path, error);
      return cloneEntries(fallbackEntries);
    }
  }

  window.GMGData = {
    defaultGames: defaultGames,
    defaultUpdates: defaultUpdates,
    loadJson: loadJson,
    getPreviewUrl: getPreviewUrl,
    savePreviewUrl: savePreviewUrl
  };
})();
