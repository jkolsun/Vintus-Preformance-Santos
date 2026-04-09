/**
 * Vintus Performance — Client Dashboard (TrainingPeaks-inspired)
 * Full rewrite: weekly calendar, workout detail, metrics, check-in, trends, chat.
 */

(function () {
  // Auth guard
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  if (localStorage.getItem('vintus_role') === 'ADMIN') {
    window.location.href = 'admin.html';
    return;
  }

  // ── Constants ──
  var DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  var TIER_DISPLAY = {
    PRIVATE_COACHING: 'Private Coaching',
    TRAINING_30DAY: '30-Day',
    TRAINING_60DAY: '60-Day',
    TRAINING_90DAY: '90-Day',
    NUTRITION_4WEEK: '4-Week Nutrition',
    NUTRITION_8WEEK: '8-Week Nutrition'
  };

  var SESSION_TYPE_ICONS = {
    STRENGTH: 'STR',
    CARDIO: 'CARDIO',
    HIIT: 'HIIT',
    FLEXIBILITY: 'FLEX',
    RECOVERY: 'REC',
    CONDITIONING: 'COND',
    POWER: 'PWR',
    ENDURANCE: 'END',
    MOBILITY: 'MOB',
    SPORT_SPECIFIC: 'SPORT'
  };

  // ── State ──
  var currentTier = null;
  var currentWeekOffset = 0;
  var weekSessions = [];
  var overviewData = null;
  var dailySummaryData = null;
  var selectedDate = null;
  var todaySession = null;
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── Timezone-safe date helper ──
  function toLocalDateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function getWeekMonday(offset) {
    var d = new Date(today);
    var dayOfWeek = d.getDay();
    var diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setDate(d.getDate() - diff + (offset * 7));
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // ── Slider live updates ──
  ['ciEnergy', 'ciSoreness', 'ciMood', 'ciSleep'].forEach(function (id) {
    var slider = document.getElementById(id);
    var valEl = document.getElementById(id + 'Val');
    if (slider && valEl) {
      slider.addEventListener('input', function () { valEl.textContent = this.value; });
    }
  });

  // ── Load everything ──
  loadUser();
  loadOverview().then(function (isPending) {
    if (!isPending) {
      loadWeek(0);
      loadTrends();
    }
  });

  // ============================================================
  // User Info → Header
  // ============================================================

  async function loadUser() {
    try {
      var res = await apiGet('/api/v1/auth/me');
      if (res.success && res.data && res.data.user) {
        var user = res.data.user;
        var profile = user.athleteProfile;
        var name = (profile && profile.firstName) || user.email.split('@')[0];
        document.getElementById('athleteName').textContent = name;
      }
    } catch (err) {
      // Keep default
    }
  }

  // ============================================================
  // Overview → Progress, Metrics, Today's Workout
  // ============================================================

  async function loadOverview() {
    try {
      var res = await apiGet('/api/v1/dashboard/overview');
      if (!res.success || !res.data) return false;

      var d = res.data;
      overviewData = d;

      // Check pending approval
      if (d.athlete && d.athlete.subscriptionStatus === 'PENDING_APPROVAL') {
        showPendingState(d);
        return true;
      }

      // Header badges
      if (d.athlete && d.athlete.planTier) {
        currentTier = d.athlete.planTier;
        var tierBadge = document.getElementById('tierBadge');
        tierBadge.textContent = TIER_DISPLAY[currentTier] || currentTier;
        tierBadge.style.display = 'inline-flex';

        // Show manage subscription button for private coaching
        if (currentTier === 'PRIVATE_COACHING') {
          document.getElementById('manageSubBtn').style.display = 'inline-flex';
        }
      }

      if (d.athlete && d.athlete.dayNumber && d.athlete.totalDays) {
        var dayBadge = document.getElementById('dayBadge');
        dayBadge.textContent = 'Day ' + d.athlete.dayNumber + ' of ' + d.athlete.totalDays;
        dayBadge.style.display = 'inline-flex';

        // Progress bar
        var pct = Math.min(100, Math.round((d.athlete.dayNumber / d.athlete.totalDays) * 100));
        var progressEl = document.getElementById('planProgress');
        progressEl.style.display = 'block';
        document.getElementById('progressFill').style.width = pct + '%';

        var weekNum = Math.ceil(d.athlete.dayNumber / 7);
        var totalWeeks = Math.ceil(d.athlete.totalDays / 7);
        document.getElementById('progressText').innerHTML =
          '<span>Week ' + weekNum + ' of ' + totalWeeks + '</span>' +
          '<span>' + pct + '% complete</span>';
      }

      // Metrics
      renderMetrics(d);

      // Today's workout
      renderTodayWorkout(d);

      return false;
    } catch (err) {
      document.getElementById('todayWorkout').innerHTML =
        '<div class="tp-rest-day"><div class="tp-rest-day__text">Unable to load. Please try refreshing.</div></div>';
      return false;
    }
  }

  function showPendingState(d) {
    if (d.athlete && d.athlete.planTier) {
      currentTier = d.athlete.planTier;
      var tierBadge = document.getElementById('tierBadge');
      tierBadge.textContent = TIER_DISPLAY[currentTier] || currentTier;
      tierBadge.style.display = 'inline-flex';
    }

    document.getElementById('todayWorkout').innerHTML =
      '<div class="tp-pending">' +
        '<div class="tp-pending__icon">&#9203;</div>' +
        '<h3 class="tp-pending__title">Your Account is Being Reviewed</h3>' +
        '<p class="tp-pending__text">Thanks for signing up! Your coach is reviewing your profile and will activate your account shortly. You\'ll receive a welcome message once approved.</p>' +
      '</div>';

    document.getElementById('weekGrid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:var(--gray);padding:1.5rem;font-style:italic;">Your training week will appear here once approved.</div>';

    // Hide sections that need data
    document.getElementById('metricsRow').style.display = 'none';
    var trendsCard = document.getElementById('trendsChart');
    if (trendsCard) trendsCard.closest('.tp-trends').style.display = 'none';
  }

  // ============================================================
  // Metrics Row
  // ============================================================

  function renderMetrics(d) {
    var metricsRow = document.getElementById('metricsRow');
    metricsRow.style.display = 'grid';

    // Streak
    var streak = (d.streak && d.streak.currentStreak) ? d.streak.currentStreak : 0;
    document.getElementById('metricStreak').textContent = streak;

    // Readiness (computed from today's check-in data)
    if (d.today && d.today.readiness) {
      var r = d.today.readiness;
      var readinessVals = [];
      if (r.perceivedEnergy != null) readinessVals.push(r.perceivedEnergy);
      if (r.perceivedSoreness != null) readinessVals.push(11 - r.perceivedSoreness); // invert: high soreness = low readiness
      if (r.perceivedMood != null) readinessVals.push(r.perceivedMood);
      if (r.sleepQualityManual != null) readinessVals.push(r.sleepQualityManual);
      if (readinessVals.length > 0) {
        var readinessAvg = readinessVals.reduce(function(a, b) { return a + b; }, 0) / readinessVals.length;
        document.getElementById('metricReadiness').textContent = Math.round(readinessAvg);
      } else {
        document.getElementById('metricReadiness').textContent = '--';
      }
    } else {
      document.getElementById('metricReadiness').textContent = '--';
    }
  }

  // Update adherence + TSS when week data loads
  function updateWeekMetrics(sessions, adherenceRate) {
    // Adherence ring
    if (adherenceRate != null) {
      var pct = Math.round(adherenceRate * 100);
      document.getElementById('metricAdherence').textContent = pct + '%';
      var circumference = 2 * Math.PI * 20; // r=20
      var offset = circumference - (pct / 100) * circumference;
      var arc = document.getElementById('adherenceArc');
      arc.setAttribute('stroke-dashoffset', offset);
      // Color based on adherence
      var color = pct >= 80 ? '#4ade80' : pct >= 50 ? '#fbbf24' : '#f87171';
      arc.setAttribute('stroke', color);
    }

    // TSS
    var plannedTSS = 0;
    var actualTSS = 0;
    sessions.forEach(function(s) {
      if (s.prescribedTSS) plannedTSS += s.prescribedTSS;
      if (s.actualTSS) actualTSS += s.actualTSS;
    });
    if (plannedTSS > 0) {
      document.getElementById('metricTSS').textContent = Math.round(actualTSS);
      document.getElementById('metricTSSSub').textContent = Math.round(actualTSS) + ' / ' + Math.round(plannedTSS);
    } else {
      document.getElementById('metricTSS').textContent = '--';
    }
  }

  // ============================================================
  // Today's Workout Detail Card
  // ============================================================

  function renderTodayWorkout(data) {
    var el = document.getElementById('todayWorkout');

    if (data.today && data.today.workout) {
      todaySession = data.today.workout;
      var s = todaySession;
      var typeBadge = (s.sessionType || '').replace(/_/g, ' ');
      var duration = s.prescribedDuration ? s.prescribedDuration + ' min' : '';
      var tss = s.prescribedTSS ? 'TSS ' + Math.round(s.prescribedTSS) : '';

      var html = '<div class="tp-workout-card">';

      // Header
      html += '<div class="tp-workout-card__header">';
      html += '<div class="tp-workout-card__title">' + escapeHtml(s.title) + '</div>';
      html += '</div>';

      // Meta badges
      html += '<div class="tp-workout-card__meta">';
      if (typeBadge) html += '<span class="tp-workout-card__badge">' + escapeHtml(typeBadge) + '</span>';
      if (duration) html += '<span class="tp-workout-card__badge">' + duration + '</span>';
      if (tss) html += '<span class="tp-workout-card__badge">' + tss + '</span>';
      html += '<span class="tp-workout-card__badge">' + escapeHtml(s.status) + '</span>';
      html += '</div>';

      // Workout content sections (warmup, main, cooldown)
      html += renderWorkoutSections(s);

      // Action buttons
      html += '<div class="tp-workout-card__actions">';
      if (s.status === 'SCHEDULED') {
        html += '<a href="workout.html?id=' + s.id + '" class="tp-workout-card__start-btn">' +
          'Start Workout <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>' +
          '</a>';
        html += '<button class="tp-workout-card__skip-btn" id="skipWorkoutBtn">Skip Session</button>';
      } else if (s.status === 'COMPLETED') {
        html += '<span class="tp-workout-card__completed-label">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' +
          'Completed</span>';
      }
      html += '</div>';
      html += '</div>';

      el.innerHTML = html;

      // Bind skip button
      var skipBtn = document.getElementById('skipWorkoutBtn');
      if (skipBtn) {
        skipBtn.addEventListener('click', function() { openSkipModal(s.id); });
      }
    } else {
      el.innerHTML =
        '<div class="tp-rest-day">' +
          '<div class="tp-rest-day__icon">&#127769;</div>' +
          '<div class="tp-rest-day__text">Rest day. Recovery is part of the process.</div>' +
        '</div>';
    }
  }

  function renderWorkoutSections(session) {
    var html = '';
    var plan = session.content || session.plan || session.prescribedPlan;

    if (!plan) return html;

    // Handle plan as object or JSON string
    var planObj = plan;
    if (typeof plan === 'string') {
      try { planObj = JSON.parse(plan); } catch(e) { return html; }
    }

    if (planObj.warmup && planObj.warmup.length > 0) {
      html += '<div class="tp-workout-card__section">';
      html += '<div class="tp-workout-card__section-label">Warm-up</div>';
      html += renderExerciseList(planObj.warmup);
      html += '</div>';
    }

    if (planObj.main && planObj.main.length > 0) {
      html += '<div class="tp-workout-card__section">';
      html += '<div class="tp-workout-card__section-label">Main</div>';
      html += renderExerciseList(planObj.main);
      html += '</div>';
    }

    if (planObj.cooldown && planObj.cooldown.length > 0) {
      html += '<div class="tp-workout-card__section">';
      html += '<div class="tp-workout-card__section-label">Cool-down</div>';
      html += renderExerciseList(planObj.cooldown);
      html += '</div>';
    }

    // Fallback: if plan is an array of exercises at root level
    if (!planObj.warmup && !planObj.main && !planObj.cooldown && Array.isArray(planObj.exercises)) {
      html += '<div class="tp-workout-card__section">';
      html += '<div class="tp-workout-card__section-label">Exercises</div>';
      html += renderExerciseList(planObj.exercises);
      html += '</div>';
    }

    return html;
  }

  function renderExerciseList(exercises) {
    if (!exercises || !Array.isArray(exercises)) return '';
    var html = '';
    exercises.forEach(function(ex) {
      var name = ex.name || ex.exercise || ex.title || 'Exercise';
      var detail = '';
      if (ex.sets && ex.reps) {
        detail = ex.sets + ' x ' + ex.reps;
        if (ex.weight) detail += ' @ ' + ex.weight;
      } else if (ex.duration) {
        detail = ex.duration;
      } else if (ex.description) {
        detail = ex.description;
      }

      html += '<div class="tp-workout-card__exercise">';
      html += '<span class="tp-workout-card__exercise-name">' + escapeHtml(name) + '</span>';
      if (detail) html += '<span class="tp-workout-card__exercise-detail">' + escapeHtml(detail) + '</span>';
      html += '</div>';

      if (ex.notes) {
        html += '<div class="tp-workout-card__exercise-notes">' + escapeHtml(ex.notes) + '</div>';
      }
    });
    return html;
  }

  // ============================================================
  // Weekly Calendar
  // ============================================================

  // Week navigation
  document.getElementById('weekPrev').addEventListener('click', function() {
    loadWeek(currentWeekOffset - 1);
  });

  document.getElementById('weekNext').addEventListener('click', function() {
    loadWeek(currentWeekOffset + 1);
  });

  async function loadWeek(offset) {
    currentWeekOffset = offset;
    updateWeekLabel(offset);

    try {
      var res = await apiGet('/api/v1/dashboard/week/' + offset);
      weekSessions = (res.success && res.data && res.data.sessions) ? res.data.sessions : [];
      var adherenceRate = (res.success && res.data) ? res.data.adherenceRate : null;
      renderWeekGrid(weekSessions);

      // Update metrics only for current week
      if (offset === 0) {
        updateWeekMetrics(weekSessions, adherenceRate);
        // Adherence text
        var adhEl = document.querySelector('.tp-week__adherence');
        if (adhEl) {
          if (adherenceRate != null && weekSessions.length > 0) {
            adhEl.textContent = Math.round(adherenceRate * 100) + '% adherence this week';
          } else {
            adhEl.textContent = '';
          }
        }
      }
    } catch (err) {
      renderWeekGrid([]);
    }
  }

  function updateWeekLabel(offset) {
    var label = document.getElementById('weekLabel');
    if (offset === 0) {
      label.textContent = 'This Week';
    } else if (offset === -1) {
      label.textContent = 'Last Week';
    } else if (offset === 1) {
      label.textContent = 'Next Week';
    } else {
      var monday = getWeekMonday(offset);
      label.textContent = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' Week';
    }
  }

  function renderWeekGrid(sessions) {
    var grid = document.getElementById('weekGrid');
    grid.innerHTML = '';

    var monday = getWeekMonday(currentWeekOffset);
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

      var cell = document.createElement('div');
      cell.className = 'tp-week__cell' +
        (isToday ? ' tp-week__cell--today' : '') +
        (isPast ? ' tp-week__cell--past' : '');
      cell.setAttribute('data-date', dateStr);

      var statusInfo = getWeekCellStatus(daySessions, isPast);
      var typeLabel = '';
      var durationLabel = '';

      if (daySessions.length > 0) {
        var mainSession = daySessions[0];
        var sessionType = (mainSession.sessionType || '').replace(/_/g, ' ');
        typeLabel = SESSION_TYPE_ICONS[mainSession.sessionType] || sessionType.substring(0, 5).toUpperCase();
        if (mainSession.prescribedDuration) {
          durationLabel = mainSession.prescribedDuration + 'm';
        }
      }

      cell.innerHTML =
        '<span class="tp-week__cell-day">' + DAY_LETTERS[d.getDay()] + '</span>' +
        '<span class="tp-week__cell-date">' + d.getDate() + '</span>' +
        (typeLabel ? '<span class="tp-week__cell-type">' + typeLabel + '</span>' : '') +
        (durationLabel ? '<span class="tp-week__cell-duration">' + durationLabel + '</span>' : '') +
        '<span class="tp-week__cell-status tp-week__cell-status--' + statusInfo.cls + '">' + statusInfo.icon + '</span>';

      // Click to expand detail
      (function(clickDateStr, clickSessions, clickIsToday) {
        cell.addEventListener('click', function() {
          handleCellClick(clickDateStr, clickSessions, clickIsToday);
        });
      })(dateStr, daySessions, isToday);

      grid.appendChild(cell);
    }

    // Adherence line
    var adhEl = grid.parentElement.querySelector('.tp-week__adherence');
    if (!adhEl) {
      adhEl = document.createElement('div');
      adhEl.className = 'tp-week__adherence';
      grid.parentElement.appendChild(adhEl);
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

  function handleCellClick(dateStr, sessions, isToday) {
    // Remove selected state from all cells
    document.querySelectorAll('.tp-week__cell--selected').forEach(function(el) {
      el.classList.remove('tp-week__cell--selected');
    });

    // If clicking today and it's current week, scroll to workout card
    if (isToday && currentWeekOffset === 0 && todaySession) {
      var workoutEl = document.getElementById('todayWorkout');
      workoutEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Highlight cell
      var clickedCell = document.querySelector('[data-date="' + dateStr + '"]');
      if (clickedCell) clickedCell.classList.add('tp-week__cell--selected');
      return;
    }

    // For other days with sessions, show a mini detail inline
    if (sessions.length > 0) {
      var clickedCell = document.querySelector('[data-date="' + dateStr + '"]');
      if (clickedCell) clickedCell.classList.add('tp-week__cell--selected');

      var s = sessions[0];
      var workoutEl = document.getElementById('todayWorkout');
      var typeBadge = (s.sessionType || '').replace(/_/g, ' ');
      var duration = s.prescribedDuration ? s.prescribedDuration + ' min' : '';
      var d = new Date(dateStr + 'T12:00:00');
      var dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      var html = '<div class="tp-workout-card">';
      html += '<div class="tp-workout-card__header">';
      html += '<div class="tp-workout-card__title">' + escapeHtml(s.title || dateLabel) + '</div>';
      html += '</div>';
      html += '<div class="tp-workout-card__meta">';
      html += '<span class="tp-workout-card__badge">' + escapeHtml(dateLabel) + '</span>';
      if (typeBadge) html += '<span class="tp-workout-card__badge">' + escapeHtml(typeBadge) + '</span>';
      if (duration) html += '<span class="tp-workout-card__badge">' + duration + '</span>';
      html += '<span class="tp-workout-card__badge">' + escapeHtml(s.status) + '</span>';
      html += '</div>';
      html += renderWorkoutSections(s);

      if (s.status === 'COMPLETED') {
        html += '<div class="tp-workout-card__actions">' +
          '<span class="tp-workout-card__completed-label">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#4ade80" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>' +
          'Completed</span></div>';
      } else if (s.status === 'SCHEDULED') {
        html += '<div class="tp-workout-card__actions">' +
          '<a href="workout.html?id=' + s.id + '" class="tp-workout-card__start-btn">Start Workout</a>' +
          '</div>';
      }

      html += '</div>';
      workoutEl.innerHTML = html;
      workoutEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // ============================================================
  // Skip Workout Modal
  // ============================================================

  var skipSessionId = null;

  function openSkipModal(sessionId) {
    skipSessionId = sessionId;
    document.getElementById('skipReason').value = '';
    document.getElementById('skipModalOverlay').style.display = 'flex';
  }

  function closeSkipModal() {
    skipSessionId = null;
    document.getElementById('skipModalOverlay').style.display = 'none';
  }

  document.getElementById('skipModalClose').addEventListener('click', closeSkipModal);
  document.getElementById('skipModalCancel').addEventListener('click', closeSkipModal);
  document.getElementById('skipModalOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeSkipModal();
  });

  document.getElementById('skipModalConfirm').addEventListener('click', async function() {
    if (!skipSessionId) return;

    var btn = this;
    var reason = document.getElementById('skipReason').value.trim();
    btn.disabled = true;
    btn.textContent = 'Skipping...';

    try {
      var res = await apiPost('/api/v1/workout/' + encodeURIComponent(skipSessionId) + '/skip', {
        reason: reason || 'No reason provided'
      });

      if (res.success) {
        closeSkipModal();
        // Reload dashboard data
        loadOverview();
        loadWeek(currentWeekOffset);
      } else {
        alert('Failed to skip session: ' + (res.error || 'Unknown error'));
      }
    } catch (err) {
      alert(err.message || 'Failed to skip session.');
    }

    btn.disabled = false;
    btn.textContent = 'Skip Session';
  });

  // ============================================================
  // 14-Day Performance — Clickable Bar Chart + Detail Panel
  // ============================================================

  async function loadTrends() {
    try {
      var res = await apiGet('/api/v1/dashboard/daily-summary?days=14');
      if (!res.success || !res.data) return;

      dailySummaryData = res.data;

      if (!dailySummaryData.days || !dailySummaryData.days.length) {
        document.getElementById('trendsChart').innerHTML =
          '<div class="tp-trends__empty">No data yet. Submit your first check-in above to see your performance.</div>';
        return;
      }

      // Update header score
      var scoreEl = document.getElementById('trendsScore');
      if (dailySummaryData.averageScore != null) {
        var avg = dailySummaryData.averageScore;
        var cls = avg >= 75 ? 'good' : avg >= 50 ? 'moderate' : 'low';
        scoreEl.className = 'tp-trends__score tp-trends__score--' + cls;
        scoreEl.innerHTML = '<strong>' + avg + '</strong> Avg';
      } else {
        scoreEl.textContent = '';
      }

      renderDailyChart(dailySummaryData.days);
    } catch (err) {
      document.getElementById('trendsChart').innerHTML =
        '<div class="tp-trends__empty">Unable to load performance data.</div>';
    }
  }

  function getGradeColor(grade) {
    if (grade === 'green') return '#4ade80';
    if (grade === 'yellow') return '#fbbf24';
    if (grade === 'red') return '#f87171';
    return 'rgba(255,255,255,0.08)';
  }

  function renderDailyChart(days) {
    var container = document.getElementById('trendsChart');
    container.innerHTML = '';

    var chart = document.createElement('div');
    chart.className = 'daily-chart';

    var todayStr = toLocalDateStr(today);

    days.forEach(function (day) {
      var group = document.createElement('div');
      group.className = 'daily-chart__bar-group';
      group.setAttribute('data-date', day.date);

      var d = new Date(day.date + 'T12:00:00');
      var isToday = day.date === todayStr;

      if (isToday) group.classList.add('daily-chart__bar-group--today');

      var bar = document.createElement('div');
      bar.className = 'daily-chart__bar';

      if (day.score != null) {
        bar.style.height = Math.max(8, day.score) + '%';
        bar.style.background = getGradeColor(day.grade);
      } else {
        bar.style.height = '15%';
        bar.classList.add('daily-chart__bar--gray');
      }

      var label = document.createElement('div');
      label.className = 'daily-chart__label';
      label.textContent = DAY_NAMES_SHORT[d.getDay()].charAt(0);

      var dateLabel = document.createElement('div');
      dateLabel.className = 'daily-chart__date';
      dateLabel.textContent = d.getDate();

      group.appendChild(bar);
      group.appendChild(label);
      group.appendChild(dateLabel);

      if (day.dayType !== 'future') {
        group.addEventListener('click', function () {
          if (selectedDate === day.date) {
            closeDailyDetail();
          } else {
            openDailyDetail(day);
            chart.querySelectorAll('.daily-chart__bar-group--active').forEach(function (el) {
              el.classList.remove('daily-chart__bar-group--active');
            });
            group.classList.add('daily-chart__bar-group--active');
          }
        });
      } else {
        group.style.opacity = '0.3';
        group.style.cursor = 'default';
      }

      chart.appendChild(group);
    });

    container.appendChild(chart);

    var detail = document.createElement('div');
    detail.className = 'daily-detail';
    detail.id = 'dailyDetail';
    detail.style.display = 'none';
    container.appendChild(detail);
  }

  function openDailyDetail(day) {
    selectedDate = day.date;
    var panel = document.getElementById('dailyDetail');
    var d = new Date(day.date + 'T12:00:00');
    var dateDisplay = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

    var html = '';

    var titleText = dateDisplay;
    if (day.workout) {
      titleText += ' — ' + escapeHtml(day.workout.title);
    } else if (day.dayType === 'rest') {
      titleText += ' — Rest Day';
    } else if (day.dayType === 'no_data') {
      titleText += ' — No Data';
    }

    var gradeBadge = '';
    if (day.score != null) {
      gradeBadge = '<span class="daily-detail__grade daily-detail__grade--' + day.grade + '">' + day.score + '</span>';
    }

    html += '<div class="daily-detail__header">' +
      '<div class="daily-detail__title">' + titleText + gradeBadge + '</div>' +
      '<button class="daily-detail__close" id="detailClose">&times;</button>' +
    '</div>';

    if (day.dayType === 'missed' || day.dayType === 'skipped') {
      var statusLabel = day.dayType === 'skipped' ? 'Skipped' : 'Missed';
      var statusMsg = '';
      if (day.readiness) {
        if (day.readiness.readinessAvg < 4) {
          statusMsg = day.dayType === 'skipped'
            ? 'Readiness was low (' + day.readiness.readinessAvg.toFixed(1) + '/10). Smart decision.'
            : 'Readiness was low (' + day.readiness.readinessAvg.toFixed(1) + '/10). Your body needed rest.';
        } else if (day.readiness.readinessAvg < 6) {
          statusMsg = statusLabel + '. Readiness was moderate (' + day.readiness.readinessAvg.toFixed(1) + '/10).';
        } else {
          statusMsg = statusLabel + '. Readiness was good (' + day.readiness.readinessAvg.toFixed(1) + '/10) — you had the capacity.';
        }
      } else {
        statusMsg = statusLabel + '. No check-in data for this day.';
      }
      html += '<div class="daily-detail__status daily-detail__status--' + day.dayType + '">' +
        '<strong>' + statusLabel + '</strong> ' + statusMsg +
      '</div>';
    }

    if (day.isDeloadWeek) {
      html += '<div class="daily-detail__deload-badge">Deload Week</div>';
    }

    if (day.breakdown && day.dayType === 'workout' && day.workout && day.workout.status === 'COMPLETED') {
      html += '<div class="daily-detail__section">';
      html += '<div class="daily-detail__section-title">Score Breakdown</div>';

      if (day.breakdown.durationAdherence != null) {
        var durText = '';
        if (day.workout.actualDuration && day.workout.prescribedDuration) {
          durText = day.workout.actualDuration + '/' + day.workout.prescribedDuration + ' min';
        }
        html += buildBreakdownRow('Duration', day.breakdown.durationAdherence, durText);
      }
      if (day.breakdown.tssAdherence != null) {
        var tssText = '';
        if (day.workout.actualTSS && day.workout.prescribedTSS) {
          tssText = Math.round(day.workout.actualTSS) + '/' + Math.round(day.workout.prescribedTSS) + ' TSS';
        }
        html += buildBreakdownRow('Intensity', day.breakdown.tssAdherence, tssText);
      }
      if (day.breakdown.rpeAppropriateness != null) {
        html += buildBreakdownRow('Effort (RPE ' + day.workout.rpe + ')', day.breakdown.rpeAppropriateness, '');
      }
      if (day.breakdown.readinessQuality != null) {
        html += buildBreakdownRow('Readiness', day.breakdown.readinessQuality, '');
      }

      html += '</div>';
    }

    if (day.readiness) {
      html += '<div class="daily-detail__section">';
      html += '<div class="daily-detail__section-title">Check-in Data</div>';
      html += '<div class="daily-detail__readiness">';
      html += buildReadinessItem('Energy', day.readiness.perceivedEnergy);
      html += buildReadinessItem('Soreness', day.readiness.perceivedSoreness);
      html += buildReadinessItem('Mood', day.readiness.perceivedMood);
      html += buildReadinessItem('Sleep', day.readiness.sleepQualityManual);
      html += '</div>';
      html += '</div>';
    }

    if (day.hasWearableData && day.readiness) {
      html += '<div class="daily-detail__section">';
      html += '<div class="daily-detail__section-title">Device Data</div>';
      html += '<div class="daily-detail__readiness">';
      if (day.readiness.hrvMs != null) html += buildReadinessItem('HRV', day.readiness.hrvMs + 'ms');
      if (day.readiness.restingHr != null) html += buildReadinessItem('RHR', day.readiness.restingHr + 'bpm');
      if (day.readiness.sleepScore != null) html += buildReadinessItem('Sleep Score', Math.round(day.readiness.sleepScore));
      if (day.readiness.sleepDurationMin != null) html += buildReadinessItem('Sleep', Math.round(day.readiness.sleepDurationMin / 60 * 10) / 10 + 'h');
      if (day.readiness.steps != null) html += buildReadinessItem('Steps', day.readiness.steps.toLocaleString());
      html += '</div>';
      html += '</div>';
    } else if (dailySummaryData && dailySummaryData.connectedDevices && dailySummaryData.connectedDevices.length === 0) {
      html += '<div class="daily-detail__section">';
      html += '<div class="daily-detail__device-prompt">' +
        'Connect a wearable to see HRV, sleep, and recovery metrics. <a href="onboarding.html">Setup</a>' +
      '</div>';
      html += '</div>';
    }

    if (day.workout && day.workout.athleteNotes) {
      html += '<div class="daily-detail__section">';
      html += '<div class="daily-detail__section-title">Notes</div>';
      html += '<div class="daily-detail__notes">' + escapeHtml(day.workout.athleteNotes) + '</div>';
      html += '</div>';
    }

    if (day.dayType === 'no_data') {
      html += '<div class="daily-detail__empty">' +
        'No check-in or workout data for this day. Regular check-ins help personalize your plan.' +
      '</div>';
    }

    panel.innerHTML = html;
    panel.style.display = 'block';

    document.getElementById('detailClose').addEventListener('click', function () {
      closeDailyDetail();
    });
  }

  function closeDailyDetail() {
    selectedDate = null;
    var panel = document.getElementById('dailyDetail');
    if (panel) panel.style.display = 'none';
    document.querySelectorAll('.daily-chart__bar-group--active').forEach(function (el) {
      el.classList.remove('daily-chart__bar-group--active');
    });
  }

  function buildBreakdownRow(label, score, subtext) {
    var color = score >= 75 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';
    return '<div class="daily-detail__breakdown-row">' +
      '<span class="daily-detail__breakdown-label">' + label + '</span>' +
      '<div class="daily-detail__breakdown-bar"><div class="daily-detail__breakdown-fill" style="width:' + score + '%;background:' + color + ';"></div></div>' +
      '<span class="daily-detail__breakdown-value">' + score + '</span>' +
      (subtext ? '<span class="daily-detail__breakdown-sub">' + subtext + '</span>' : '') +
    '</div>';
  }

  function buildReadinessItem(label, value) {
    return '<div class="daily-detail__readiness-item">' +
      '<span class="daily-detail__readiness-value">' + value + '</span>' +
      '<span class="daily-detail__readiness-label">' + label + '</span>' +
    '</div>';
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
        setTimeout(function () { successEl.classList.remove('show'); }, 4000);
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
    manageSubBtn.querySelector('span').textContent = 'Loading...';
    try {
      var res = await apiPost('/api/v1/checkout/portal');
      if (res.success && res.data && res.data.url) {
        window.location.href = res.data.url;
      } else {
        alert('Unable to open subscription portal.');
        manageSubBtn.querySelector('span').textContent = 'Billing';
      }
    } catch (err) {
      alert(err.message || 'Unable to open portal.');
      manageSubBtn.querySelector('span').textContent = 'Billing';
    }
  });

  // ============================================================
  // Logout
  // ============================================================

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    try {
      await apiPost('/api/v1/auth/logout');
    } catch (e) {
      // Clear local state regardless
    }
    clearToken();
    localStorage.removeItem('vintus_role');
    window.location.href = 'login.html';
  });

  // ============================================================
  // Utility
  // ============================================================

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ============================================================
  // Coach Chat — Slide-Out Panel
  // ============================================================

  var chatPanel = document.getElementById('chatPanel');
  var chatOverlay = document.getElementById('chatOverlay');
  var chatMessages = document.getElementById('chatMessages');
  var chatInput = document.getElementById('chatInput');
  var chatForm = document.getElementById('chatForm');
  var chatSendBtn = document.getElementById('chatSendBtn');
  var chatTyping = document.getElementById('chatTyping');
  var chatOpenBtn = document.getElementById('chatOpenBtn');
  var chatCloseBtn = document.getElementById('chatCloseBtn');
  var chatHistoryLoaded = false;
  var chatSending = false;

  function openChat() {
    chatPanel.classList.add('open');
    chatOverlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    if (!chatHistoryLoaded) {
      loadChatHistory();
    }

    setTimeout(function() { chatInput.focus(); }, 350);
  }

  function closeChat() {
    chatPanel.classList.remove('open');
    chatOverlay.classList.remove('open');
    document.body.style.overflow = '';
  }

  chatOpenBtn.addEventListener('click', openChat);
  chatCloseBtn.addEventListener('click', closeChat);
  chatOverlay.addEventListener('click', closeChat);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && chatPanel.classList.contains('open')) {
      closeChat();
    }
  });

  async function loadChatHistory() {
    try {
      var res = await apiGet('/api/v1/chat/history');
      chatHistoryLoaded = true;

      if (res.success && res.data && res.data.messages && res.data.messages.length > 0) {
        chatMessages.innerHTML = '';
        res.data.messages.forEach(function(msg) {
          appendBubble(msg.role, msg.content, msg.createdAt);
        });
        scrollChatToBottom();
      } else {
        renderChatWelcome();
      }
    } catch (err) {
      chatHistoryLoaded = true;
      renderChatWelcome();
    }
  }

  function renderChatWelcome() {
    chatMessages.innerHTML =
      '<div class="chat-welcome">' +
        '<div class="chat-welcome-title">Coach Jerry</div>' +
        '<div class="chat-welcome-text">Ask me anything about your training, recovery, or how to adjust your plan.</div>' +
        '<div class="chat-welcome-suggestions">' +
          '<button class="chat-suggestion-chip" data-msg="How should I approach today\'s workout?">How should I approach today\'s workout?</button>' +
          '<button class="chat-suggestion-chip" data-msg="I\'m feeling sore today. Should I modify anything?">I\'m feeling sore. Should I modify anything?</button>' +
          '<button class="chat-suggestion-chip" data-msg="Can you explain my current training block?">Explain my current training block</button>' +
        '</div>' +
      '</div>';

    chatMessages.querySelectorAll('.chat-suggestion-chip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        var msg = this.getAttribute('data-msg');
        chatInput.value = msg;
        chatSendBtn.disabled = false;
        handleChatSend();
      });
    });
  }

  chatInput.addEventListener('input', function() {
    chatSendBtn.disabled = !this.value.trim();
  });

  chatForm.addEventListener('submit', function(e) {
    e.preventDefault();
    handleChatSend();
  });

  async function handleChatSend() {
    var messageText = chatInput.value.trim();
    if (!messageText || chatSending) return;

    chatSending = true;
    chatInput.value = '';
    chatSendBtn.disabled = true;

    var welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    appendBubble('user', messageText, new Date().toISOString());
    scrollChatToBottom();

    var readDelay = 200 + Math.random() * 200;
    var typingShown = false;

    var typingTimer = setTimeout(function() {
      showChatTyping();
      scrollChatToBottom();
      typingShown = true;
    }, readDelay);

    var sendStart = Date.now();
    try {
      var res = await apiPost('/api/v1/chat/send', { message: messageText });

      if (res.success && res.data && res.data.assistantMessage) {
        var responseText = res.data.assistantMessage.content;
        var responseTime = res.data.assistantMessage.createdAt;
        var apiElapsed = Date.now() - sendStart;

        var baseDelay = 1500;
        var perCharDelay = 15;
        var charCount = responseText.length;
        var typingDuration = Math.min(4000, Math.max(1500, baseDelay + (charCount * perCharDelay)));
        typingDuration += (Math.random() - 0.5) * 600;

        var remainingDelay = Math.max(400, typingDuration - apiElapsed);

        if (!typingShown) {
          clearTimeout(typingTimer);
          showChatTyping();
          scrollChatToBottom();
        }

        await chatSleep(remainingDelay);

        hideChatTyping();
        appendBubble('assistant', responseText, responseTime);
        scrollChatToBottom();
      } else {
        clearTimeout(typingTimer);
        hideChatTyping();
        appendBubble('assistant', 'Something went wrong. Try sending that again.', new Date().toISOString());
        scrollChatToBottom();
      }
    } catch (err) {
      clearTimeout(typingTimer);
      if (typingShown) {
        await chatSleep(600);
      }
      hideChatTyping();

      var errorMsg = (err && err.status === 429)
        ? "Let's pace this a bit. Try again in a few minutes."
        : 'Connection issue. Try again in a moment.';

      appendBubble('assistant', errorMsg, new Date().toISOString());
      scrollChatToBottom();
    }

    chatSending = false;
    chatInput.focus();
  }

  function chatSleep(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
  }

  function appendBubble(role, content, timestamp) {
    var wrapper = document.createElement('div');
    wrapper.className = 'chat-bubble chat-bubble--' + role;

    var escapedContent = escapeHtml(content);
    var formattedContent = escapedContent.replace(/\n/g, '<br>');

    wrapper.innerHTML = formattedContent +
      '<div class="chat-bubble-time">' + formatChatTime(timestamp) + '</div>';

    chatMessages.appendChild(wrapper);
  }

  function formatChatTime(isoString) {
    var d = new Date(isoString);
    var now = new Date();
    var isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function showChatTyping() {
    chatTyping.style.display = 'flex';
  }

  function hideChatTyping() {
    chatTyping.style.display = 'none';
  }

  function scrollChatToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

})();
