/**
 * Vintus Performance — Client Dashboard (Hub)
 * Loads overview, compact week preview, readiness trends chart, and handles check-in.
 */

(function () {
  // Auth guard
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  var DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var TIER_DISPLAY = {
    PRIVATE_COACHING: 'Private Coaching',
    TRAINING_30DAY: '30-Day Training',
    TRAINING_60DAY: '60-Day Training',
    TRAINING_90DAY: '90-Day Training',
    NUTRITION_4WEEK: '4-Week Nutrition',
    NUTRITION_8WEEK: '8-Week Nutrition'
  };
  var currentTier = null;
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Timezone-safe date helper ──
  function toLocalDateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ── Set date display ──
  var dateEl = document.getElementById('dashDate');
  dateEl.textContent = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // ── Slider live updates ──
  ['ciEnergy', 'ciSoreness', 'ciMood', 'ciSleep'].forEach(function (id) {
    var slider = document.getElementById(id);
    var valEl = document.getElementById(id + 'Val');
    if (slider && valEl) {
      slider.addEventListener('input', function () { valEl.textContent = this.value; });
    }
  });

  // ── Load all data ──
  loadUser();
  loadOverview();
  loadWeekPreview();
  loadTrends();

  // ── Load user info ──
  async function loadUser() {
    try {
      var res = await apiGet('/api/v1/auth/me');
      if (res.success && res.data && res.data.user) {
        var user = res.data.user;
        var profile = user.athleteProfile;
        var name = (profile && profile.firstName) || user.email.split('@')[0];
        var hour = new Date().getHours();
        var greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        document.getElementById('dashGreeting').textContent = greeting + ', ' + name;
      }
    } catch (err) {
      // Greeting stays at default
    }
  }

  // ── Load dashboard overview ──
  async function loadOverview() {
    try {
      var res = await apiGet('/api/v1/dashboard/overview');
      if (!res.success || !res.data) return;

      var d = res.data;

      // Streak
      if (d.streak && d.streak.currentStreak > 0) {
        var streakEl = document.getElementById('dashStreak');
        streakEl.textContent = d.streak.currentStreak + ' day streak';
        streakEl.style.display = 'inline-flex';
      }

      // Account tier
      if (d.athlete && d.athlete.planTier) {
        currentTier = d.athlete.planTier;
        document.getElementById('accountTier').textContent = TIER_DISPLAY[currentTier] || currentTier;
      }

      // Today's workout
      renderToday(d);
    } catch (err) {
      document.getElementById('todayWorkout').innerHTML = '<span class="dash-rest-day">Unable to load. Please try refreshing.</span>';
    }
  }

  function renderToday(data) {
    var el = document.getElementById('todayWorkout');

    if (data.today && data.today.workout) {
      var s = data.today.workout;
      var typeBadge = (s.sessionType || '').replace(/_/g, ' ');
      var duration = s.prescribedDuration ? s.prescribedDuration + ' min' : '';

      el.innerHTML =
        '<div class="dash-workout-title">' + escapeHtml(s.title) + '</div>' +
        '<div class="dash-workout-meta">' +
          '<span class="dash-badge">' + escapeHtml(typeBadge) + '</span>' +
          (duration ? '<span class="dash-badge">' + duration + '</span>' : '') +
          '<span class="dash-badge">' + escapeHtml(s.status) + '</span>' +
        '</div>' +
        (s.status === 'SCHEDULED'
          ? '<a href="workout.html?id=' + s.id + '" class="dash-workout-btn">Start Workout <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></a>'
          : s.status === 'COMPLETED'
            ? '<span style="color:#4ade80;font-weight:600;font-family:var(--font-heading);font-size:0.85rem;text-transform:uppercase;letter-spacing:1px;">Completed</span>'
            : '');
    } else {
      el.innerHTML = '<div class="dash-rest-day">Rest day. Recovery is part of the process.</div>';
    }
  }

  // ============================================================
  // Compact Week Preview
  // ============================================================

  async function loadWeekPreview() {
    try {
      var res = await apiGet('/api/v1/dashboard/week/0');
      var sessions = (res.success && res.data && res.data.sessions) ? res.data.sessions : [];
      var adherenceRate = (res.success && res.data) ? res.data.adherenceRate : null;
      renderWeekStrip(sessions, adherenceRate);
    } catch (err) {
      renderWeekStrip([], null);
    }
  }

  function renderWeekStrip(sessions, adherenceRate) {
    var strip = document.getElementById('weekStrip');
    strip.innerHTML = '';

    var monday = getWeekMonday(0);
    var todayStr = toLocalDateStr(today);

    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(d.getDate() + i);
      var dateStr = toLocalDateStr(d);
      var isPast = dateStr < todayStr;
      var isToday = dateStr === todayStr;

      var daySessions = sessions.filter(function (s) {
        return s.scheduledDate && s.scheduledDate.substring(0, 10) === dateStr;
      });

      var cell = document.createElement('a');
      cell.href = 'calendar.html';
      cell.className = 'dash-week-cell' +
        (isToday ? ' dash-week-cell--today' : '') +
        (isPast ? ' dash-week-cell--past' : '');

      var statusInfo = getWeekCellStatus(daySessions, isPast);

      cell.innerHTML =
        '<span class="dash-week-day">' + DAY_LETTERS[d.getDay()] + '</span>' +
        '<span class="dash-week-date">' + d.getDate() + '</span>' +
        '<span class="dash-week-status dash-week-status--' + statusInfo.cls + '">' + statusInfo.icon + '</span>';

      strip.appendChild(cell);
    }

    // Adherence
    var adhEl = document.getElementById('weekAdherence');
    if (adherenceRate != null && sessions.length > 0) {
      adhEl.textContent = Math.round(adherenceRate * 100) + '% adherence this week';
    } else {
      adhEl.textContent = '';
    }
  }

  function getWeekCellStatus(sessions, isPast) {
    if (sessions.length === 0) {
      return { cls: 'rest', icon: '\u2014' };
    }

    var hasCompleted = sessions.some(function (s) { return s.status === 'COMPLETED'; });
    var hasMissed = sessions.some(function (s) { return s.status === 'MISSED'; });
    var hasSkipped = sessions.some(function (s) { return s.status === 'SKIPPED'; });
    var allScheduled = sessions.every(function (s) { return s.status === 'SCHEDULED'; });

    if (hasCompleted) return { cls: 'completed', icon: '\u2713' };
    if (hasMissed) return { cls: 'missed', icon: '\u2717' };
    if (hasSkipped) return { cls: 'skipped', icon: 'S' };
    if (allScheduled && isPast) return { cls: 'missed', icon: '\u2717' };
    return { cls: 'scheduled', icon: '\u2022' };
  }

  function getWeekMonday(offset) {
    var d = new Date(today);
    var dayOfWeek = d.getDay();
    var diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setDate(d.getDate() - diff + (offset * 7));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ============================================================
  // Readiness Trends — SVG Area Chart
  // ============================================================

  async function loadTrends() {
    try {
      var res = await apiGet('/api/v1/readiness/history?days=14');
      if (!res.success || !res.data) return;

      var records = res.data;
      if (!records.length) {
        document.getElementById('trendsChart').innerHTML =
          '<div class="dash-trends-empty">No check-in data yet. Submit your first check-in above to see your trends.</div>';
        return;
      }

      var sorted = records.sort(function (a, b) {
        return new Date(a.date) - new Date(b.date);
      });

      renderTrendsChart(sorted);
    } catch (err) {
      document.getElementById('trendsChart').innerHTML =
        '<div class="dash-trends-empty">Unable to load trends.</div>';
    }
  }

  function renderTrendsChart(records) {
    var container = document.getElementById('trendsChart');
    container.innerHTML = '';

    var chartW = container.offsetWidth || 600;
    var chartH = 160;
    var padL = 28;
    var padR = 10;
    var padT = 15;
    var padB = 25;
    var plotW = chartW - padL - padR;
    var plotH = chartH - padT - padB;

    // Compute avg readiness for each record
    var points = records.map(function (r, i) {
      var avg = ((r.perceivedEnergy || 5) + (r.sleepQualityManual || 5) + (10 - (r.perceivedSoreness || 5))) / 3;
      var x = padL + (records.length === 1 ? plotW / 2 : (i / (records.length - 1)) * plotW);
      var y = padT + plotH - (avg / 10) * plotH;
      return { x: x, y: y, avg: avg, date: r.date };
    });

    // Current readiness score
    var lastAvg = points[points.length - 1].avg;
    var scoreEl = document.getElementById('trendsScore');
    var scoreClass = lastAvg >= 7 ? 'good' : lastAvg >= 4 ? 'moderate' : 'low';
    scoreEl.className = 'dash-trends-score dash-trends-score--' + scoreClass;
    scoreEl.innerHTML = '<strong>' + lastAvg.toFixed(1) + '</strong> Current';

    // Build SVG
    var svgNS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + chartW + ' ' + chartH);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.style.width = '100%';
    svg.style.height = chartH + 'px';

    // Y-axis gridlines
    [0, 2.5, 5, 7.5, 10].forEach(function (val) {
      var y = padT + plotH - (val / 10) * plotH;

      var line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', padL);
      line.setAttribute('y1', y);
      line.setAttribute('x2', chartW - padR);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', 'rgba(255,255,255,0.06)');
      line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      if (val === 0 || val === 5 || val === 10) {
        var label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', padL - 6);
        label.setAttribute('y', y + 3);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('font-size', '9');
        label.setAttribute('fill', '#666');
        label.setAttribute('font-family', 'Oswald, sans-serif');
        label.textContent = val;
        svg.appendChild(label);
      }
    });

    // Gradient fill definition
    var defs = document.createElementNS(svgNS, 'defs');
    var grad = document.createElementNS(svgNS, 'linearGradient');
    grad.setAttribute('id', 'trendFill');
    grad.setAttribute('x1', '0');
    grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0');
    grad.setAttribute('y2', '1');

    var stop1 = document.createElementNS(svgNS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', scoreClass === 'good' ? '#4ade80' : scoreClass === 'moderate' ? '#fbbf24' : '#f87171');
    stop1.setAttribute('stop-opacity', '0.3');
    grad.appendChild(stop1);

    var stop2 = document.createElementNS(svgNS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', scoreClass === 'good' ? '#4ade80' : scoreClass === 'moderate' ? '#fbbf24' : '#f87171');
    stop2.setAttribute('stop-opacity', '0.02');
    grad.appendChild(stop2);

    defs.appendChild(grad);
    svg.appendChild(defs);

    // Area path
    if (points.length > 1) {
      var areaPath = 'M' + points[0].x + ',' + points[0].y;
      for (var i = 1; i < points.length; i++) {
        areaPath += ' L' + points[i].x + ',' + points[i].y;
      }
      areaPath += ' L' + points[points.length - 1].x + ',' + (padT + plotH);
      areaPath += ' L' + points[0].x + ',' + (padT + plotH) + ' Z';

      var area = document.createElementNS(svgNS, 'path');
      area.setAttribute('d', areaPath);
      area.setAttribute('fill', 'url(#trendFill)');
      svg.appendChild(area);

      // Line path
      var linePath = 'M' + points[0].x + ',' + points[0].y;
      for (var j = 1; j < points.length; j++) {
        linePath += ' L' + points[j].x + ',' + points[j].y;
      }

      var lineEl = document.createElementNS(svgNS, 'path');
      lineEl.setAttribute('d', linePath);
      lineEl.setAttribute('fill', 'none');
      lineEl.setAttribute('stroke', scoreClass === 'good' ? '#4ade80' : scoreClass === 'moderate' ? '#fbbf24' : '#f87171');
      lineEl.setAttribute('stroke-width', '2');
      lineEl.setAttribute('stroke-linejoin', 'round');
      svg.appendChild(lineEl);
    }

    // Data points
    var tooltip = document.createElement('div');
    tooltip.className = 'dash-trend-tooltip';
    container.appendChild(tooltip);

    points.forEach(function (pt) {
      var circle = document.createElementNS(svgNS, 'circle');
      circle.setAttribute('cx', pt.x);
      circle.setAttribute('cy', pt.y);
      circle.setAttribute('r', '4');
      circle.setAttribute('fill', '#0a0a0a');
      circle.setAttribute('stroke', scoreClass === 'good' ? '#4ade80' : scoreClass === 'moderate' ? '#fbbf24' : '#f87171');
      circle.setAttribute('stroke-width', '2');
      circle.style.cursor = 'pointer';

      circle.addEventListener('mouseenter', function (e) {
        var d = new Date(pt.date);
        tooltip.textContent = (d.getMonth() + 1) + '/' + d.getDate() + ' — ' + pt.avg.toFixed(1);
        tooltip.style.display = 'block';
        var rect = container.getBoundingClientRect();
        tooltip.style.left = (pt.x - 30) + 'px';
        tooltip.style.top = (pt.y - 32) + 'px';
      });

      circle.addEventListener('mouseleave', function () {
        tooltip.style.display = 'none';
      });

      svg.appendChild(circle);
    });

    container.insertBefore(svg, tooltip);

    // Date labels
    var labelsDiv = document.createElement('div');
    labelsDiv.className = 'dash-trends-labels';

    // Show up to 7 evenly spaced labels
    var labelCount = Math.min(points.length, 7);
    var step = points.length <= 1 ? 1 : (points.length - 1) / (labelCount - 1);
    for (var k = 0; k < labelCount; k++) {
      var idx = Math.round(k * step);
      if (idx >= points.length) idx = points.length - 1;
      var dateObj = new Date(points[idx].date);
      var span = document.createElement('span');
      span.textContent = (dateObj.getMonth() + 1) + '/' + dateObj.getDate();
      labelsDiv.appendChild(span);
    }

    container.appendChild(labelsDiv);
  }

  // ============================================================
  // Check-in Submission
  // ============================================================

  var checkinBtn = document.getElementById('checkinBtn');
  checkinBtn.addEventListener('click', async function () {
    checkinBtn.disabled = true;
    checkinBtn.textContent = 'Submitting...';

    var payload = {
      perceivedEnergy: parseInt(document.getElementById('ciEnergy').value, 10),
      perceivedSoreness: parseInt(document.getElementById('ciSoreness').value, 10),
      perceivedMood: parseInt(document.getElementById('ciMood').value, 10),
      sleepQualityManual: parseInt(document.getElementById('ciSleep').value, 10)
    };

    try {
      var res = await apiPost('/api/v1/readiness/checkin', payload);
      if (res.success) {
        var successEl = document.getElementById('checkinSuccess');
        successEl.classList.add('show');
        checkinBtn.textContent = 'Submitted';
        loadTrends();
      } else {
        alert('Check-in failed. Please try again.');
        checkinBtn.disabled = false;
        checkinBtn.textContent = 'Submit Check-in';
      }
    } catch (err) {
      alert(err.message || 'Check-in failed.');
      checkinBtn.disabled = false;
      checkinBtn.textContent = 'Submit Check-in';
    }
  });

  // ============================================================
  // Manage Subscription
  // ============================================================

  var manageSubBtn = document.getElementById('manageSubBtn');
  manageSubBtn.addEventListener('click', async function () {
    if (currentTier && currentTier !== 'PRIVATE_COACHING') {
      alert('Your ' + (TIER_DISPLAY[currentTier] || currentTier) + ' plan does not have a recurring subscription to manage. Contact support@vintusperformance.org for assistance.');
      return;
    }
    manageSubBtn.textContent = 'Loading...';
    try {
      var res = await apiPost('/api/v1/checkout/portal');
      if (res.success && res.data && res.data.url) {
        window.location.href = res.data.url;
      } else {
        alert('Unable to open subscription portal.');
        manageSubBtn.textContent = 'Manage';
      }
    } catch (err) {
      alert(err.message || 'Unable to open portal.');
      manageSubBtn.textContent = 'Manage';
    }
  });

  // ============================================================
  // Logout
  // ============================================================

  var logoutBtn = document.getElementById('logoutBtn');
  logoutBtn.addEventListener('click', async function () {
    try {
      await apiPost('/api/v1/auth/logout');
    } catch (e) {
      // Logout API may fail but we still clear local state
    }
    clearToken();
    window.location.href = 'login.html';
  });

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
