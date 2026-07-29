/**
 * Leaderboard module — ranked sidebar list with search & filter
 * Uses virtual scrolling for performance with large datasets
 */
const Leaderboard = (() => {
  const listEl = document.getElementById('leaderboard-list');
  const searchInput = document.getElementById('search-input');
  const filterCountry = document.getElementById('filter-country');
  const filterLang = document.getElementById('filter-language');
  const filterSort = document.getElementById('filter-sort');
  const searchMode = document.getElementById('search-mode');

  let allDevelopers = [];
  let filteredDevelopers = [];
  let activeSearchAbort = null;

  // Virtual scrolling state
  const ITEM_HEIGHT = 62;
  const BUFFER = 10;
  let scrollContainer = null;
  let contentEl = null;
  let renderedRange = { start: -1, end: -1 };

  function init(developers) {
    allDevelopers = developers;
    filteredDevelopers = [...developers];

    // Set up virtual scroll container
    listEl.innerHTML = '';
    listEl.style.position = 'relative';
    contentEl = document.createElement('div');
    contentEl.style.position = 'relative';
    listEl.appendChild(contentEl);

    populateLanguageFilter(developers);
    populateCountryFilter(developers);
    renderVirtual();

    listEl.addEventListener('scroll', () => requestAnimationFrame(renderVirtual));

    // Debounced search
    let searchTimer;
    searchInput.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const mode = searchMode.value;
        if (mode === 'vector' || mode === 'hybrid') {
          apiSearch();
        } else {
          applyFilters();
        }
      }, 400);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchTimer);
        const mode = searchMode.value;
        if (mode === 'vector' || mode === 'hybrid') {
          apiSearch();
        } else {
          applyFilters();
        }
      }
    });
    searchMode.addEventListener('change', () => {
      if (!searchInput.value.trim()) return;
      const mode = searchMode.value;
      if (mode === 'vector' || mode === 'hybrid') {
        apiSearch();
      } else {
        applyFilters();
      }
    });
    filterCountry.addEventListener('change', applyFilters);
    filterLang.addEventListener('change', applyFilters);
    filterSort.addEventListener('change', applyFilters);
  }

  function populateCountryFilter(developers) {
    const countries = new Map();
    developers.forEach(d => {
      if (d.location) {
        // Extract country from location (last part after comma)
        const parts = d.location.split(',').map(s => s.trim());
        const country = parts[parts.length - 1];
        if (country) countries.set(country, (countries.get(country) || 0) + 1);
      }
    });

    // Sort by developer count descending, limit to top 50 countries
    const sorted = [...countries.entries()]
      .filter(([c]) => c.length > 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50);
    sorted.forEach(([country, count]) => {
      const opt = document.createElement('option');
      opt.value = country;
      const label = country.length > 15 ? country.slice(0, 14) + '…' : country;
      opt.textContent = `${label} (${count})`;
      filterCountry.appendChild(opt);
    });
  }

  function populateLanguageFilter(developers) {
    const langs = new Set();
    developers.forEach(d => {
      if (d.topLanguage) langs.add(d.topLanguage);
    });

    const sorted = [...langs].sort();
    sorted.forEach(lang => {
      const opt = document.createElement('option');
      opt.value = lang;
      opt.textContent = lang;
      filterLang.appendChild(opt);
    });
  }

  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const country = filterCountry.value;
    const lang = filterLang.value;
    const sort = filterSort.value;

    filteredDevelopers = allDevelopers.filter(d => {
      const matchesSearch = !query ||
        (d.login && d.login.toLowerCase().includes(query)) ||
        (d.name && d.name.toLowerCase().includes(query)) ||
        (d.location && d.location.toLowerCase().includes(query));
      const matchesLang = !lang || d.topLanguage === lang;
      const matchesCountry = !country || (d.location && d.location.includes(country));
      return matchesSearch && matchesLang && matchesCountry;
    });

    // Sort
    filteredDevelopers.sort((a, b) => {
      switch (sort) {
        case 'stars': return (b.totalStars || 0) - (a.totalStars || 0);
        case 'commits': return (b.totalCommits || 0) - (a.totalCommits || 0);
        case 'soRep': return (b.soReputation || 0) - (a.soReputation || 0);
        default: return b.score - a.score;
      }
    });

    renderedRange = { start: -1, end: -1 };
    listEl.scrollTop = 0;
    renderVirtual();
    GlobeViz.updateData(filteredDevelopers);
  }

  async function apiSearch() {
    const query = searchInput.value.trim();
    if (!query) { applyFilters(); return; }

    if (activeSearchAbort) activeSearchAbort.abort();
    const controller = new AbortController();
    activeSearchAbort = controller;

    const mode = searchMode.value;
    searchInput.style.opacity = '0.5';

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&mode=${mode}&top=20`,
        { signal: controller.signal }
      );
      const data = await res.json();
      if (controller.signal.aborted) return;

      filteredDevelopers = data.results || [];
      // Compute scores using the full dataset's max values
      filteredDevelopers = Scoring.scoreAll(filteredDevelopers);
      renderedRange = { start: -1, end: -1 };
      listEl.scrollTop = 0;
      renderVirtual();
      GlobeViz.updateData(filteredDevelopers);
    } catch (e) {
      if (e.name !== 'AbortError') console.error('Search failed:', e);
    } finally {
      if (!controller.signal.aborted) searchInput.style.opacity = '1';
    }
  }

  function renderVirtual() {
    const devs = filteredDevelopers;
    const totalHeight = devs.length * ITEM_HEIGHT;
    contentEl.style.height = totalHeight + 'px';

    const scrollTop = listEl.scrollTop;
    const viewHeight = listEl.clientHeight;
    const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
    const end = Math.min(devs.length, Math.ceil((scrollTop + viewHeight) / ITEM_HEIGHT) + BUFFER);

    // Skip if range hasn't changed
    if (start === renderedRange.start && end === renderedRange.end) return;
    renderedRange = { start, end };

    // Remove old items
    contentEl.querySelectorAll('.lb-item').forEach(el => el.remove());

    // Render visible items
    const fragment = document.createDocumentFragment();
    for (let i = start; i < end; i++) {
      const dev = devs[i];
      const li = document.createElement('li');
      li.className = 'lb-item';
      li.dataset.login = dev.login;
      li.style.position = 'absolute';
      li.style.top = (i * ITEM_HEIGHT) + 'px';
      li.style.left = '0';
      li.style.right = '0';
      li.style.height = ITEM_HEIGHT + 'px';
      li.innerHTML = `
        <span class="lb-item__rank">${i + 1}</span>
        <img class="lb-item__avatar" src="${dev.avatarUrl}" alt="${dev.login}" loading="lazy">
        <div class="lb-item__info">
          <div class="lb-item__name">${dev.name || dev.login}</div>
          <div class="lb-item__meta">${dev.topLanguage || ''} · ${dev.location || 'Unknown'}</div>
          <div class="lb-item__badges">
            <span class="lb-badge lb-badge--gh" title="GitHub Stars">★ ${formatNum(dev.totalStars)}</span>
            ${dev.soReputation ? `<span class="lb-badge lb-badge--so" title="SO Reputation">● ${formatNum(dev.soReputation)}</span>` : ''}
          </div>
        </div>
        <span class="lb-item__score">${dev.score}</span>
      `;

      li.addEventListener('click', () => {
        GlobeViz.flyTo(dev.lat, dev.lng);
        DetailPanel.show(dev);
        highlight(dev.login);
      });

      fragment.appendChild(li);
    }
    contentEl.appendChild(fragment);
  }

  function highlight(login) {
    contentEl.querySelectorAll('.lb-item').forEach(el => {
      el.classList.toggle('active', el.dataset.login === login);
    });

    // Scroll to the developer
    const idx = filteredDevelopers.findIndex(d => d.login === login);
    if (idx >= 0) {
      listEl.scrollTop = idx * ITEM_HEIGHT - listEl.clientHeight / 2;
      requestAnimationFrame(renderVirtual);
    }
  }

  function formatNum(n) {
    if (!n) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }

  return { init, highlight, applyFilters };
})();
