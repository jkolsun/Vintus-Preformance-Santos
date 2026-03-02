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
  // 14-Day Performance — Clickable Bar Chart + Detail Panel
  // ============================================================

  var dailySummaryData = null;
  var selectedDate = null;

  async function loadTrends() {
    try {
      var res = await apiGet('/api/v1/dashboard/daily-summary?days=14');
      if (!res.success || !res.data) return;

      dailySummaryData = res.data;

      if (!dailySummaryData.days || !dailySummaryData.days.length) {
        document.getElementById('trendsChart').innerHTML =
          '<div class="dash-trends-empty">No data yet. Submit your first check-in above to see your performance.</div>';
        return;
      }

      // Update header score
      var scoreEl = document.getElementById('trendsScore');
      if (dailySummaryData.averageScore != null) {
        var avg = dailySummaryData.averageScore;
        var cls = avg >= 75 ? 'good' : avg >= 50 ? 'moderate' : 'low';
        scoreEl.className = 'dash-trends-score dash-trends-score--' + cls;
        scoreEl.innerHTML = '<strong>' + avg + '</strong> Avg';
      } else {
        scoreEl.textContent = '';
      }

      renderDailyChart(dailySummaryData.days);
    } catch (err) {
      document.getElementById('trendsChart').innerHTML =
        '<div class="dash-trends-empty">Unable to load performance data.</div>';
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
    var dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      label.textContent = dayNames[d.getDay()].charAt(0);

      var dateLabel = document.createElement('div');
      dateLabel.className = 'daily-chart__date';
      dateLabel.textContent = d.getDate();

      group.appendChild(bar);
      group.appendChild(label);
      group.appendChild(dateLabel);

      // Click handler
      if (day.dayType !== 'future') {
        group.addEventListener('click', function () {
          if (selectedDate === day.date) {
            closeDailyDetail();
          } else {
            openDailyDetail(day);
            // Update active state
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

    // Detail panel placeholder
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

    // Header
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

    // Status message for missed/skipped
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

    // Deload badge
    if (day.isDeloadWeek) {
      html += '<div class="daily-detail__deload-badge">Deload Week</div>';
    }

    // Score breakdown (completed workouts)
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

    // Readiness section
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

    // Wearable data
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

    // Athlete notes
    if (day.workout && day.workout.athleteNotes) {
      html += '<div class="daily-detail__section">';
      html += '<div class="daily-detail__section-title">Notes</div>';
      html += '<div class="daily-detail__notes">' + escapeHtml(day.workout.athleteNotes) + '</div>';
      html += '</div>';
    }

    // No data message
    if (day.dayType === 'no_data') {
      html += '<div class="daily-detail__empty">' +
        'No check-in or workout data for this day. Regular check-ins help personalize your plan.' +
      '</div>';
    }

    panel.innerHTML = html;
    panel.style.display = 'block';

    // Close button handler
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

  // ── Open / Close ──

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

  // ── Load History ──

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

  // ── Send Message with Human-Like Delays ──

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

    // Clear welcome state if present
    var welcome = chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // 1. Show user bubble immediately
    appendBubble('user', messageText, new Date().toISOString());
    scrollChatToBottom();

    // 2. Read-before-type delay (200-400ms)
    var readDelay = 200 + Math.random() * 200;
    var typingShown = false;

    var typingTimer = setTimeout(function() {
      showChatTyping();
      scrollChatToBottom();
      typingShown = true;
    }, readDelay);

    // 3. Send to API
    var sendStart = Date.now();
    try {
      var res = await apiPost('/api/v1/chat/send', { message: messageText });

      if (res.success && res.data && res.data.assistantMessage) {
        var responseText = res.data.assistantMessage.content;
        var responseTime = res.data.assistantMessage.createdAt;
        var apiElapsed = Date.now() - sendStart;

        // 4. Calculate human-like typing delay
        var baseDelay = 1500;
        var perCharDelay = 15;
        var charCount = responseText.length;
        var typingDuration = Math.min(4000, Math.max(1500, baseDelay + (charCount * perCharDelay)));
        typingDuration += (Math.random() - 0.5) * 600;

        // Subtract API time already elapsed
        var remainingDelay = Math.max(400, typingDuration - apiElapsed);

        // Ensure typing indicator is showing before we wait
        if (!typingShown) {
          clearTimeout(typingTimer);
          showChatTyping();
          scrollChatToBottom();
        }

        await chatSleep(remainingDelay);

        // 5. Show response
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

  // ── DOM Helpers ──

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
