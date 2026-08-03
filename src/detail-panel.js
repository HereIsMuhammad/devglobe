/**
 * Detail Panel — shows developer info with D3 charts
 */
const DetailPanel = (() => {
  const panel = document.getElementById('detail-panel');
  const closeBtn = document.getElementById('detail-close');
  let currentDev = null;

  closeBtn.addEventListener('click', hide);

  function show(dev) {
    currentDev = dev;
    panel.classList.add('open');
    renderHeader(dev);
    renderStats(dev);
    renderRadarChart(dev);
    renderSOActivity(dev);
    renderHeatmap(dev);
    // Fetch full details (languages, topRepos, bio) on demand
    fetchFullDetails(dev);
  }

  async function fetchFullDetails(dev) {
    try {
      const res = await fetch(`/api/developer?id=${encodeURIComponent(dev.id)}`);
      if (res.ok) {
        const full = await res.json();
        Object.assign(dev, full);
      }
    } catch (e) { /* use existing data as fallback */ }
    renderLanguages(dev);
    renderRepos(dev);
  }

  function hide() {
    panel.classList.remove('open');
    currentDev = null;
  }

  function renderHeader(dev) {
    const header = document.getElementById('detail-header');
    header.innerHTML = `
      <div class="detail-header">
        <img class="detail-header__avatar" src="${dev.avatarUrl}" alt="${dev.login}">
        <div>
          <div class="detail-header__name">${dev.name || dev.login}</div>
          <div class="detail-header__location">📍 ${dev.location || 'Unknown location'}</div>
          <span class="detail-header__score-badge">Score: ${dev.score}/100</span>
          <div class="detail-header__links">
            <a href="https://github.com/${dev.login}" target="_blank">GitHub ↗</a>
            ${dev.soUserId ? `<a href="https://stackoverflow.com/users/${dev.soUserId}" target="_blank">StackOverflow ↗</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderStats(dev) {
    const container = document.getElementById('detail-stats');
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-card__value">${formatNumber(dev.totalStars || 0)}</div>
          <div class="stat-card__label">Stars</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${formatNumber(dev.totalCommits || 0)}</div>
          <div class="stat-card__label">Commits</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__value">${formatNumber(dev.followers || 0)}</div>
          <div class="stat-card__label">Followers</div>
        </div>
        <div class="stat-card stat-card--so">
          <div class="stat-card__value">${formatNumber(dev.soReputation || 0)}</div>
          <div class="stat-card__label">SO Reputation</div>
        </div>
        <div class="stat-card stat-card--so">
          <div class="stat-card__value">${formatNumber(dev.soAnswers || 0)}</div>
          <div class="stat-card__label">SO Answers</div>
        </div>
        <div class="stat-card stat-card--so">
          <div class="stat-card__value">${dev.soBadges || 0}</div>
          <div class="stat-card__label">SO Badges</div>
        </div>
      </div>
    `;
  }

  function renderSOActivity(dev) {
    const container = document.getElementById('chart-so');
    container.innerHTML = '';

    const soRep = dev.soReputation || 0;
    const soAnswers = dev.soAnswers || 0;
    const soAcceptRate = dev.soAcceptRate || 0;
    const soBadges = dev.soBadges || 0;

    if (!soRep && !soAnswers) {
      container.innerHTML = '<div class="so-empty">No StackOverflow profile linked</div>';
      return;
    }

    // SO bar chart showing relative metrics
    const metrics = [
      { label: 'Reputation', value: soRep, max: 1000000, color: '#f48024' },
      { label: 'Answers', value: soAnswers, max: 10000, color: '#ff9f4a' },
      { label: 'Accept Rate', value: soAcceptRate, max: 100, color: '#ffcc80', suffix: '%' },
      { label: 'Badges', value: soBadges, max: 500, color: '#ffe0b2' }
    ];

    const barHtml = metrics.map(m => {
      const pct = Math.min((m.value / m.max) * 100, 100);
      const display = m.suffix ? m.value + m.suffix : formatNumber(m.value);
      return `
        <div class="so-bar">
          <div class="so-bar__label">${m.label}</div>
          <div class="so-bar__track">
            <div class="so-bar__fill" style="width:${pct}%;background:${m.color}"></div>
          </div>
          <div class="so-bar__value">${display}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div class="so-bars">${barHtml}</div>`;
    if (dev.soUserId) {
      container.innerHTML += `<a class="so-profile-link" href="https://stackoverflow.com/users/${dev.soUserId}" target="_blank">View full SO profile ↗</a>`;
    }
  }

  function renderRadarChart(dev) {
    const container = document.getElementById('chart-radar');
    container.innerHTML = '';

    const dims = dev.scoreDimensions;
    const data = [
      { axis: 'Stars', value: dims.stars },
      { axis: 'Commits', value: dims.commits },
      { axis: 'Reach', value: dims.repoReach },
      { axis: 'SO Rep', value: dims.soReputation },
      { axis: 'SO Engage', value: dims.soEngagement },
      { axis: 'Community', value: dims.community }
    ];

    const width = 260, height = 260;
    const radius = Math.min(width, height) / 2 - 30;
    const levels = 5;
    const angleSlice = (Math.PI * 2) / data.length;

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    // Grid circles
    for (let i = 1; i <= levels; i++) {
      svg.append('circle')
        .attr('r', (radius / levels) * i)
        .attr('fill', 'none')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 0.5);
    }

    // Axis lines
    data.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      svg.append('line')
        .attr('x1', 0).attr('y1', 0)
        .attr('x2', radius * Math.cos(angle))
        .attr('y2', radius * Math.sin(angle))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 0.5);

      // Labels
      svg.append('text')
        .attr('x', (radius + 16) * Math.cos(angle))
        .attr('y', (radius + 16) * Math.sin(angle))
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .text(d.axis);
    });

    // Data polygon
    const line = d3.lineRadial()
      .radius(d => d.value * radius)
      .angle((d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    svg.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'rgba(59, 130, 246, 0.2)')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2);

    // Data dots
    data.forEach((d, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      svg.append('circle')
        .attr('cx', d.value * radius * Math.cos(angle))
        .attr('cy', d.value * radius * Math.sin(angle))
        .attr('r', 4)
        .attr('fill', '#3b82f6');
    });
  }

  function renderHeatmap(dev) {
    const container = document.getElementById('chart-heatmap');
    container.innerHTML = '';

    // Generate mock weekly contribution data (52 weeks × 7 days)
    const contributions = dev.contributions || generateMockContributions(dev.totalCommits || 500);

    const cellSize = 11;
    const weeks = 52;
    const days = 7;
    const width = weeks * (cellSize + 2) + 40;
    const height = days * (cellSize + 2) + 20;

    const colorScale = d3.scaleQuantize()
      .domain([0, d3.max(contributions)])
      .range(['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353']);

    const svg = d3.select(container)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%');

    contributions.forEach((value, i) => {
      const week = Math.floor(i / 7);
      const day = i % 7;
      svg.append('rect')
        .attr('x', week * (cellSize + 2) + 20)
        .attr('y', day * (cellSize + 2))
        .attr('width', cellSize)
        .attr('height', cellSize)
        .attr('rx', 2)
        .attr('fill', colorScale(value));
    });

    // Day labels
    ['Mon', 'Wed', 'Fri'].forEach((label, i) => {
      svg.append('text')
        .attr('x', 0)
        .attr('y', (i * 2 + 1) * (cellSize + 2) + cellSize / 2)
        .attr('fill', '#64748b')
        .attr('font-size', '9px')
        .attr('dominant-baseline', 'middle')
        .text(label);
    });
  }

  function renderLanguages(dev) {
    const container = document.getElementById('chart-languages');
    container.innerHTML = '';

    const languages = dev.languages || [
      { name: dev.topLanguage || 'JavaScript', percent: 45 },
      { name: 'TypeScript', percent: 25 },
      { name: 'Python', percent: 15 },
      { name: 'Other', percent: 15 }
    ];

    const width = 120, height = 120;
    const radius = Math.min(width, height) / 2;
    const colors = ['#3b82f6', '#8b5cf6', '#f48024', '#2ea44f', '#64748b'];

    const pie = d3.pie().value(d => d.percent).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.55).outerRadius(radius);

    const svg = d3.select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    svg.selectAll('path')
      .data(pie(languages))
      .join('path')
      .attr('d', arc)
      .attr('fill', (d, i) => colors[i % colors.length]);

    // Legend
    const legend = d3.select(container)
      .append('div')
      .style('font-size', '11px');

    languages.forEach((lang, i) => {
      legend.append('div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('gap', '6px')
        .style('margin-bottom', '4px')
        .html(`<span style="width:8px;height:8px;border-radius:50%;background:${colors[i % colors.length]};display:inline-block"></span>
               <span style="color:#e2e8f0">${lang.name}</span>
               <span style="color:#64748b">${lang.percent}%</span>`);
    });
  }

  function renderRepos(dev) {
    const container = document.getElementById('chart-repos');
    container.innerHTML = '';

    const repos = dev.topRepos || [
      { name: 'project-1', stars: 1200, forks: 340 },
      { name: 'project-2', stars: 890, forks: 120 },
      { name: 'project-3', stars: 450, forks: 89 }
    ];

    repos.slice(0, 5).forEach(repo => {
      const item = document.createElement('div');
      item.className = 'repo-item';
      item.innerHTML = `
        <span class="repo-item__name">${repo.name}</span>
        <span class="repo-item__stats">
          <span>⭐ ${formatNumber(repo.stars)}</span>
          <span>🍴 ${formatNumber(repo.forks)}</span>
        </span>
      `;
      container.appendChild(item);
    });
  }

  function generateMockContributions(totalCommits) {
    const days = 364;
    const data = [];
    const avg = totalCommits / days;
    for (let i = 0; i < days; i++) {
      // Simulate realistic pattern: more commits on weekdays
      const isWeekend = (i % 7 === 0 || i % 7 === 6);
      const base = isWeekend ? avg * 0.3 : avg * 1.4;
      data.push(Math.max(0, Math.round(base + (Math.random() - 0.5) * avg * 2)));
    }
    return data;
  }

  function formatNumber(n) {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }

  return { show, hide };
})();
