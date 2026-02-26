/**
 * Vintus Performance — Client Dashboard
 * Loads overview, week view, readiness trends, and handles check-in.
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
  loadWeek();
  loadTrends();

  // ── Load user info ──
  async function loadUser() {
    try {
      var res = await apiGet('/api/v1/auth/me');
      if (res.success && res.data && res.data.user) {
        var user = res.data.user;
        var profile = user.athleteProfile;
        var name = (profile && profile.firstName) || user.email.split('@')[0];
        var hour = today.getHours();
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

  // ── Load week view ──
  async function loadWeek() {
    try {
      var res = await apiGet('/api/v1/dashboard/week/0');
      if (!res.success || !res.data) return;

      var weekEl = document.getElementById('weekView');
      weekEl.innerHTML = '';

      var sessions = res.data.sessions || [];

      // Build 7 days starting from Monday of current week
      var monday = new Date(today);
      var dayOfWeek = monday.getDay();
      var diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      monday.setDate(monday.getDate() - diff);

      for (var i = 0; i < 7; i++) {
        var d = new Date(monday);
        d.setDate(d.getDate() + i);
        var dateStr = d.toISOString().split('T')[0];

        var session = sessions.find(function (s) {
          return s.scheduledDate && s.scheduledDate.substring(0, 10) === dateStr;
        });

        var isToday = dateStr === today.toISOString().split('T')[0];
        var statusClass = 'rest';
        var statusIcon = '—';

        if (session) {
          switch (session.status) {
            case 'COMPLETED': statusClass = 'completed'; statusIcon = '\u2713'; break;
            case 'MISSED': statusClass = 'missed'; statusIcon = '\u2717'; break;
            case 'SCHEDULED': statusClass = 'scheduled'; statusIcon = '\u2022'; break;
            case 'SKIPPED': statusClass = 'missed'; statusIcon = 'S'; break;
            default: statusClass = 'scheduled'; statusIcon = '\u2022';
          }
        }

        var dayEl = document.createElement('div');
        dayEl.className = 'dash-day' + (isToday ? ' today' : '');
        dayEl.innerHTML =
          '<span class="dash-day-label">' + DAY_NAMES[d.getDay()] + '</span>' +
          '<span class="dash-day-status ' + statusClass + '">' + statusIcon + '</span>';

        if (session && session.id) {
          dayEl.style.cursor = 'pointer';
          dayEl.setAttribute('data-id', session.id);
          dayEl.addEventListener('click', function () {
            window.location.href = 'workout.html?id=' + this.getAttribute('data-id');
          });
        }

        weekEl.appendChild(dayEl);
      }
    } catch (err) {
      // Week view stays at loading
    }
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

      // Show last 14 days (most recent on right)
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
        // Reload trends
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
