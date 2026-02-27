/**
 * Vintus Performance — Client Dashboard
 * Loads overview, calendar week view, readiness trends, and handles check-in.
 */

(function () {
  // Auth guard
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

  // Calendar state
  var currentWeekOffset = 0;
  var weekSessions = [];
  var draggedSessionId = null;
  var isMobile = window.innerWidth <= 768;

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
  loadWeek(0);
  loadTrends();

  // ── Resize handler for mobile detection ──
  window.addEventListener('resize', function () {
    var wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;
    if (wasMobile !== isMobile) renderCalendar();
  });

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
          ? '<a href="workout.html?id=' + s.id + '" class="dash-workout-btn">Start Workout</a>'
          : s.status === 'COMPLETED'
            ? '<span style="color:#4ade80;font-weight:600;">Completed!</span>'
            : '');
    } else {
      el.innerHTML = '<div class="dash-rest-day">Rest day. Recovery is part of the process.</div>';
    }
  }

  // ============================================================
  // Calendar Week View
  // ============================================================

  async function loadWeek(offset) {
    if (typeof offset === 'number') currentWeekOffset = offset;

    try {
      var res = await apiGet('/api/v1/dashboard/week/' + currentWeekOffset);
      if (!res.success || !res.data) return;

      weekSessions = res.data.sessions || [];

      // Update title
      var monday = getWeekMonday(currentWeekOffset);
      var sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      var titleEl = document.getElementById('calTitle');

      if (currentWeekOffset === 0) {
        titleEl.textContent = 'This Week';
      } else if (currentWeekOffset === -1) {
        titleEl.textContent = 'Last Week';
      } else if (currentWeekOffset === 1) {
        titleEl.textContent = 'Next Week';
      } else {
        titleEl.textContent = formatShortDate(monday) + ' \u2013 ' + formatShortDate(sunday);
      }

      // Adherence
      var adhEl = document.getElementById('calAdherence');
      var adhRate = res.data.adherenceRate;
      if (adhRate != null && weekSessions.length > 0) {
        adhEl.textContent = Math.round(adhRate * 100) + '% adherence';
      } else {
        adhEl.textContent = '';
      }

      renderCalendar();
    } catch (err) {
      // Calendar stays at loading
    }
  }

  function getWeekMonday(offset) {
    var d = new Date(today);
    var dayOfWeek = d.getDay();
    var diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setDate(d.getDate() - diff + (offset * 7));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function renderCalendar() {
    var grid = document.getElementById('calGrid');
    grid.innerHTML = '';

    var monday = getWeekMonday(currentWeekOffset);
    var todayStr = today.toISOString().split('T')[0];

    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(d.getDate() + i);
      var dateStr = d.toISOString().split('T')[0];
      var isPast = dateStr < todayStr;
      var isToday = dateStr === todayStr;

      // Find all sessions for this day
      var daySessions = weekSessions.filter(function (s) {
        return s.scheduledDate && s.scheduledDate.substring(0, 10) === dateStr;
      });

      var dayEl = document.createElement('div');
      dayEl.className = 'cal-day' + (isToday ? ' cal-day--today' : '') + (isPast ? ' cal-day--past' : '');
      dayEl.setAttribute('data-date', dateStr);

      // Day header
      var header = document.createElement('div');
      header.className = 'cal-day-header';
      header.innerHTML =
        '<span class="cal-day-name">' + DAY_NAMES[d.getDay()] + '</span>' +
        '<span class="cal-day-num">' + d.getDate() + '</span>';
      dayEl.appendChild(header);

      // Day body
      var body = document.createElement('div');
      body.className = 'cal-day-body';

      if (daySessions.length === 0) {
        var restLabel = document.createElement('span');
        restLabel.style.cssText = 'color:var(--gray-dark);font-size:0.65rem;font-style:italic;padding:0.25rem;';
        restLabel.textContent = 'Rest';
        body.appendChild(restLabel);
      } else {
        daySessions.forEach(function (session) {
          body.appendChild(buildWorkoutCard(session, isPast));
        });
      }

      dayEl.appendChild(body);

      // Desktop drag-and-drop target
      if (!isMobile) {
        dayEl.addEventListener('dragover', handleDragOver);
        dayEl.addEventListener('dragleave', handleDragLeave);
        dayEl.addEventListener('drop', handleDrop);
      }

      grid.appendChild(dayEl);
    }
  }

  function buildWorkoutCard(session, isPast) {
    var statusClass = getStatusClass(session.status);
    var typeBadge = (session.sessionType || '').replace(/_/g, ' ');
    var duration = session.prescribedDuration ? session.prescribedDuration + ' min' : '';
    var statusIcon = getStatusIcon(session.status);

    // A past SCHEDULED session is visually "missed" even if backend hasn't marked it yet
    var isMissedVisually = session.status === 'SCHEDULED' && isPast;
    if (isMissedVisually) {
      statusClass = 'missed';
      statusIcon = '\u2717';
    }

    var isDraggable = session.status === 'SCHEDULED' && !isPast;

    var card = document.createElement('div');
    card.className = 'cal-workout cal-workout--' + statusClass;
    card.setAttribute('data-session-id', session.id);

    if (isDraggable) {
      card.setAttribute('draggable', 'true');
      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragend', handleDragEnd);
    }

    card.innerHTML =
      '<div class="cal-workout-type">' + escapeHtml(typeBadge) + '</div>' +
      '<div class="cal-workout-title">' + escapeHtml(session.title) + '</div>' +
      '<div class="cal-workout-meta">' +
        '<span>' + duration + '</span>' +
        '<span class="cal-workout-status">' + statusIcon + '</span>' +
      '</div>';

    // Click to open workout detail
    card.addEventListener('click', function (e) {
      if (e.defaultPrevented) return;
      window.location.href = 'workout.html?id=' + session.id;
    });

    // Mobile: long-press to move (only SCHEDULED future sessions)
    if (isMobile && isDraggable) {
      var longPressTimer;
      card.addEventListener('touchstart', function (e) {
        longPressTimer = setTimeout(function () {
          e.preventDefault();
          openMoveModal(session.id);
        }, 500);
      }, { passive: false });
      card.addEventListener('touchend', function () { clearTimeout(longPressTimer); });
      card.addEventListener('touchmove', function () { clearTimeout(longPressTimer); });
    }

    // Missed workout replan button
    if (isMissedVisually) {
      var replanBtn = document.createElement('button');
      replanBtn.className = 'cal-workout-replan';
      replanBtn.textContent = 'Auto-Replan';
      replanBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        triggerReplan(session.id);
      });
      card.appendChild(replanBtn);
    }

    return card;
  }

  // ── Drag-and-Drop (Desktop) ──

  function handleDragStart(e) {
    draggedSessionId = this.getAttribute('data-session-id');
    this.classList.add('cal-workout--dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedSessionId);
  }

  function handleDragEnd() {
    this.classList.remove('cal-workout--dragging');
    draggedSessionId = null;
    document.querySelectorAll('.cal-day--dragover').forEach(function (el) {
      el.classList.remove('cal-day--dragover');
    });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    var dayEl = e.target.closest('.cal-day');
    if (dayEl && !dayEl.classList.contains('cal-day--dragover')) {
      document.querySelectorAll('.cal-day--dragover').forEach(function (el) {
        el.classList.remove('cal-day--dragover');
      });
      dayEl.classList.add('cal-day--dragover');
    }
  }

  function handleDragLeave(e) {
    var dayEl = e.target.closest('.cal-day');
    if (dayEl && !dayEl.contains(e.relatedTarget)) {
      dayEl.classList.remove('cal-day--dragover');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    var dayEl = e.target.closest('.cal-day');
    if (!dayEl) return;
    dayEl.classList.remove('cal-day--dragover');

    var sessionId = e.dataTransfer.getData('text/plain');
    var newDate = dayEl.getAttribute('data-date');
    var todayStr = today.toISOString().split('T')[0];

    if (!sessionId || !newDate) return;

    if (newDate < todayStr) {
      showToast('Cannot move a workout to a past date.');
      return;
    }

    rescheduleSession(sessionId, newDate);
  }

  // ── API Calls ──

  async function rescheduleSession(sessionId, newDate) {
    try {
      var res = await apiPost('/api/v1/workout/' + sessionId + '/reschedule', {
        newDate: newDate
      });
      if (res.success) {
        showToast('Workout rescheduled.');
        loadWeek(currentWeekOffset);
      } else {
        showToast(res.error || 'Reschedule failed.');
      }
    } catch (err) {
      showToast(err.message || 'Reschedule failed.');
    }
  }

  async function triggerReplan(sessionId) {
    if (!confirm('This will mark this workout as missed and auto-adjust your remaining plan. Continue?')) {
      return;
    }
    try {
      var res = await apiPost('/api/v1/workout/' + sessionId + '/replan');
      if (res.success) {
        showToast('Plan adjusted for missed workout.');
        if (res.data && res.data.sessions) {
          weekSessions = res.data.sessions;
          renderCalendar();
        } else {
          loadWeek(currentWeekOffset);
        }
        loadOverview();
      } else {
        showToast(res.error || 'Replan failed.');
      }
    } catch (err) {
      showToast(err.message || 'Replan failed.');
    }
  }

  // ── Mobile Move Modal ──

  function openMoveModal(sessionId) {
    var modal = document.getElementById('calMoveModal');
    var daysContainer = document.getElementById('calMoveDays');
    daysContainer.innerHTML = '';

    var monday = getWeekMonday(currentWeekOffset);
    var todayStr = today.toISOString().split('T')[0];

    for (var i = 0; i < 7; i++) {
      var d = new Date(monday);
      d.setDate(d.getDate() + i);
      var dateStr = d.toISOString().split('T')[0];
      var isPastDay = dateStr < todayStr;

      var btn = document.createElement('button');
      btn.className = 'cal-move-day-btn';
      btn.textContent = DAY_NAMES[d.getDay()] + '\n' + d.getDate();
      btn.style.whiteSpace = 'pre-line';
      btn.setAttribute('data-date', dateStr);
      btn.disabled = isPastDay;

      btn.addEventListener('click', function () {
        var targetDate = this.getAttribute('data-date');
        modal.style.display = 'none';
        rescheduleSession(sessionId, targetDate);
      });

      daysContainer.appendChild(btn);
    }

    modal.style.display = 'flex';
  }

  document.getElementById('calMoveCancel').addEventListener('click', function () {
    document.getElementById('calMoveModal').style.display = 'none';
  });

  // ── Week Navigation ──

  document.getElementById('calPrev').addEventListener('click', function () {
    if (currentWeekOffset > -52) loadWeek(currentWeekOffset - 1);
  });

  document.getElementById('calNext').addEventListener('click', function () {
    if (currentWeekOffset < 4) loadWeek(currentWeekOffset + 1);
  });

  // ── Helpers ──

  function getStatusClass(status) {
    switch (status) {
      case 'COMPLETED': return 'completed';
      case 'MISSED': return 'missed';
      case 'SKIPPED': return 'skipped';
      case 'RESCHEDULED': return 'rescheduled';
      default: return 'scheduled';
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'COMPLETED': return '\u2713';
      case 'MISSED': return '\u2717';
      case 'SKIPPED': return 'S';
      default: return '\u2022';
    }
  }

  function formatShortDate(d) {
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function showToast(msg) {
    var existing = document.querySelector('.cal-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'cal-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(function () { toast.remove(); }, 3000);
  }

  // ── Load readiness trends ──
  async function loadTrends() {
    try {
      var res = await apiGet('/api/v1/readiness/history?days=14');
      if (!res.success || !res.data) return;

      var barsEl = document.getElementById('trendBars');
      var labelsEl = document.getElementById('trendLabels');
      barsEl.innerHTML = '';
      labelsEl.innerHTML = '';

      var records = res.data;
      if (!records.length) {
        barsEl.innerHTML = '<span class="dash-loading" style="font-style:italic;">No check-in data yet.</span>';
        return;
      }

      var sorted = records.sort(function (a, b) {
        return new Date(a.date) - new Date(b.date);
      });

      sorted.forEach(function (r) {
        var avg = ((r.perceivedEnergy || 5) + (r.sleepQualityManual || 5) + (10 - (r.perceivedSoreness || 5))) / 3;
        var pct = (avg / 10) * 100;
        var barClass = avg >= 7 ? 'good' : avg >= 4 ? 'moderate' : 'low';

        var bar = document.createElement('div');
        bar.className = 'dash-trend-bar ' + barClass;
        bar.style.height = Math.max(pct, 8) + '%';
        bar.title = 'Avg: ' + avg.toFixed(1);
        barsEl.appendChild(bar);

        var label = document.createElement('span');
        var d = new Date(r.date);
        label.textContent = (d.getMonth() + 1) + '/' + d.getDate();
        labelsEl.appendChild(label);
      });
    } catch (err) {
      // Trends stay empty
    }
  }

  // ── Check-in submission ──
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
        document.getElementById('checkinSuccess').style.display = 'block';
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

  // ── Manage subscription ──
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

  // ── Logout ──
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
