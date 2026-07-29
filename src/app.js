/**
 * App — main entry point, orchestrates data loading and module initialization
 */
const App = (() => {
  const DATA_URL = '/api/developers';

  async function init() {
    showLoading(true);

    try {
      // Load developer data
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`Failed to load data: ${response.status}`);
      const rawDevelopers = await response.json();

      // Score all developers
      const developers = Scoring.scoreAll(rawDevelopers);

      // Initialize modules
      GlobeViz.init('globe-container', developers);
      Leaderboard.init(developers);

      showLoading(false);
    } catch (err) {
      console.error('Failed to initialize app:', err);
      showError(err.message);
    }
  }

  function showLoading(visible) {
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay && visible) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">Loading developer data...</div>
      `;
      document.body.appendChild(overlay);
    } else if (overlay && !visible) {
      overlay.classList.add('hidden');
      setTimeout(() => overlay.remove(), 500);
    }
  }

  function showError(message) {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.innerHTML = `
        <div style="text-align:center;max-width:400px">
          <div style="font-size:48px;margin-bottom:16px">⚠️</div>
          <div style="font-size:16px;margin-bottom:8px">Failed to load data</div>
          <div style="font-size:13px;color:#94a3b8">${message}</div>
          <button onclick="location.reload()" style="margin-top:16px;padding:8px 20px;background:#3b82f6;border:none;border-radius:6px;color:white;cursor:pointer">Retry</button>
        </div>
      `;
    }
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);

  return { init };
})();
