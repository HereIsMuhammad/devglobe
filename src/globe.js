/**
 * Globe module — 3D interactive globe using globe.gl
 */
const GlobeViz = (() => {
  let globe = null;
  let developers = [];

  function init(containerId, devData) {
    developers = devData;
    const container = document.getElementById(containerId);

    // Only plot developers with valid coordinates, cap at 5000 for performance
    const geoDevs = developers
      .filter(d => d.lat != null && d.lng != null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5000);

    globe = Globe()
      .globeImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-night.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('#3a7ecf')
      .atmosphereAltitude(0.2)
      .width(container.clientWidth)
      .height(container.clientHeight)
      // Points layer for developers
      .pointsData(geoDevs)
      .pointLat(d => d.lat)
      .pointLng(d => d.lng)
      .pointAltitude(d => 0.01 + (d.score / 100) * 0.06)
      .pointRadius(d => 0.3 + (d.score / 100) * 0.7)
      .pointColor(d => Scoring.getPlatformColor(d.scoreDimensions))
      .pointResolution(6)
      // Labels — only top scorers
      .labelsData(geoDevs.filter(d => d.score >= 80))
      .labelLat(d => d.lat)
      .labelLng(d => d.lng)
      .labelText(d => d.login)
      .labelSize(d => 0.6 + (d.score / 100) * 0.4)
      .labelColor(() => 'rgba(226, 232, 240, 0.75)')
      .labelDotRadius(0.3)
      .labelAltitude(0.02)
      // Interaction
      .onPointHover(handleHover)
      .onPointClick(handleClick)
      (container);

    // Auto-rotate
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.4;
    globe.controls().enableDamping = true;

    // Resize handler
    window.addEventListener('resize', () => {
      globe.width(container.clientWidth);
      globe.height(container.clientHeight);
    });

    return globe;
  }

  function handleHover(point, prevPoint) {
    const tooltip = document.getElementById('tooltip');
    if (point) {
      tooltip.innerHTML = `
        <div class="tooltip__header">
          <img class="tooltip__avatar" src="${point.avatarUrl}" alt="${point.login}">
          <div>
            <div class="tooltip__name">${point.name || point.login}</div>
            <div class="tooltip__login">@${point.login}</div>
          </div>
        </div>
        <div class="tooltip__score">Score: ${point.score}/100</div>
        <div class="tooltip__stats">
          <span>⭐ ${formatNum(point.totalStars || 0)}</span>
          <span>👥 ${formatNum(point.followers || 0)}</span>
          ${point.soReputation ? `<span class="tooltip__so">SO ${formatNum(point.soReputation)}</span>` : ''}
        </div>
        <div class="tooltip__meta">
          <span>📍 ${point.location || 'Unknown'}</span>
          ${point.topLanguage ? `<span>· ${point.topLanguage}</span>` : ''}
        </div>
      `;
      tooltip.classList.add('visible');
      globe.controls().autoRotate = false;
    } else {
      tooltip.classList.remove('visible');
      globe.controls().autoRotate = true;
    }
  }

  function formatNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toString();
  }

  function handleClick(point) {
    if (!point) return;
    // Fly to the developer
    flyTo(point.lat, point.lng);
    // Open detail panel
    DetailPanel.show(point);
    // Highlight in leaderboard
    Leaderboard.highlight(point.login);
  }

  function flyTo(lat, lng, altitude = 1.5) {
    globe.pointOfView({ lat, lng, altitude }, 1000);
    globe.controls().autoRotate = false;
  }

  function updateData(filteredDevs) {
    const geoDevs = filteredDevs
      .filter(d => d.lat != null && d.lng != null)
      .slice(0, 5000);
    globe.pointsData(geoDevs);
    globe.labelsData(geoDevs.filter(d => d.score >= 80));
  }

  // Track mouse for tooltip positioning
  document.addEventListener('mousemove', (e) => {
    const tooltip = document.getElementById('tooltip');
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top = (e.clientY + 12) + 'px';
  });

  return { init, flyTo, updateData };
})();
