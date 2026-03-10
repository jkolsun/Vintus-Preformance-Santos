/**
 * Vintus Performance — Admin Dashboard Logic
 */

(function () {
  /* ── Auth Guard ── */
  var role = localStorage.getItem('vintus_role');
  if (!isLoggedIn() || role !== 'ADMIN') {
    window.location.href = 'login.html';
    return;
  }

  /* ── State ── */
  var loadedTabs = { overview: false, clients: false, adherence: false, escalations: false };
  var clientsPage = 1;
  var clientsTotalPages = 1;
  var escalationsPage = 1;
  var escalationsTotalPages = 1;
  var escalationFilter = 'all';
  var currentDetailUserId = null;
  var searchTimeout = null;

  /* ── Utilities ── */
  function esc(str) {
    if (!str && str !== 0) return '';
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str)));
    return d.innerHTML;
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtDateTime(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  function timeAgo(dateStr) {
    if (!dateStr) return 'Never';
    var diff = Date.now() - new Date(dateStr).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs / 24);
    return days + 'd ago';
  }

  function fmtCurrency(amount) {
    return '$' + Number(amount).toLocaleString();
  }

  function fmtPct(val) {
    if (val == null) return '—';
    return Math.round(val * 100) + '%';
  }

  function fmtTier(tier) {
    if (!tier) return '—';
    return tier.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function profileOption(value, label, current) {
    var selected = (current && current.toLowerCase() === value.toLowerCase()) ? ' selected' : '';
    return '<option value="' + esc(value) + '"' + selected + '>' + esc(label) + '</option>';
  }

  function statusBadge(status) {
    if (!status) return '<span class="admin-badge">—</span>';
    var cls = 'admin-badge';
    var s = status.toLowerCase().replace(/_/g, '-');
    if (s === 'active' || s === 'completed') cls += ' admin-badge--active';
    else if (s === 'canceled' || s === 'missed') cls += ' admin-badge--canceled';
    else if (s === 'past-due' || s === 'skipped') cls += ' admin-badge--past-due';
    else if (s === 'scheduled') cls += ' admin-badge--scheduled';
    return '<span class="' + cls + '">' + esc(status) + '</span>';
  }

  function debounce(fn, delay) {
    return function () {
      var args = arguments;
      var ctx = this;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  /* ── Tab Navigation ── */
  var tabs = document.querySelectorAll('.admin-tab');
  var tabContents = document.querySelectorAll('.admin-tab-content');

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var target = tab.getAttribute('data-tab');
      tabs.forEach(function (t) { t.classList.remove('admin-tab--active'); });
      tab.classList.add('admin-tab--active');
      tabContents.forEach(function (tc) { tc.classList.remove('admin-tab-content--active'); });
      var el = document.getElementById('tab' + target.charAt(0).toUpperCase() + target.slice(1));
      if (el) el.classList.add('admin-tab-content--active');
      loadTab(target);
    });
  });

  function loadTab(name, force) {
    if (loadedTabs[name] && !force) return;
    loadedTabs[name] = true;
    if (name === 'overview') loadOverview();
    else if (name === 'clients') loadClients();
    else if (name === 'adherence') loadAdherence();
    else if (name === 'escalations') loadEscalations();
  }

  /* ── Refresh Button ── */
  document.getElementById('refreshBtn').addEventListener('click', function () {
    var active = document.querySelector('.admin-tab--active');
    if (active) loadTab(active.getAttribute('data-tab'), true);
  });

  /* ── Logout ── */
  document.getElementById('adminLogoutBtn').addEventListener('click', async function () {
    try { await apiPost('/api/v1/auth/logout'); } catch (e) { /* ignore */ }
    clearToken();
    localStorage.removeItem('vintus_role');
    window.location.href = 'login.html';
  });

  /* ============================================================
     OVERVIEW TAB
     ============================================================ */

  async function loadOverview() {
    try {
      var results = await Promise.all([
        apiGet('/api/v1/admin/analytics/overview'),
        apiGet('/api/v1/admin/system/health'),
        apiGet('/api/v1/admin/system/cron-status')
      ]);

      var overview = results[0].data;
      var health = results[1].data;
      var cron = results[2].data;

      // KPIs
      document.getElementById('kpiTotal').textContent = overview.totalClients;
      document.getElementById('kpiActive').textContent = overview.activeClients;
      document.getElementById('kpiAdherence').textContent = fmtPct(overview.avgAdherenceRate);
      document.getElementById('kpiMrr').textContent = fmtCurrency(overview.mrr);
      document.getElementById('kpiNew').textContent = overview.newLast30Days;
      document.getElementById('kpiChurned').textContent = overview.churnedLast30Days;

      // Tier breakdown
      var tierEl = document.getElementById('tierBreakdown');
      var maxTier = Math.max(1, Math.max.apply(null, Object.values(overview.byTier)));
      var tierHtml = '';
      var tierKeys = Object.keys(overview.byTier);
      for (var i = 0; i < tierKeys.length; i++) {
        var k = tierKeys[i];
        var v = overview.byTier[k];
        var pct = Math.round((v / maxTier) * 100);
        tierHtml += '<div class="admin-tier-row">' +
          '<span class="admin-tier-label">' + esc(fmtTier(k)) + '</span>' +
          '<div class="admin-tier-bar-bg"><div class="admin-tier-bar" style="width:' + pct + '%"></div></div>' +
          '<span class="admin-tier-count">' + v + '</span>' +
          '</div>';
      }
      tierEl.innerHTML = tierHtml;

      // System health
      var healthEl = document.getElementById('healthGrid');
      var healthHtml = '';
      var services = ['database', 'stripe', 'twilio', 'resend', 'anthropic'];
      for (var j = 0; j < services.length; j++) {
        var svc = services[j];
        var info = health[svc];
        if (!info) continue;
        healthHtml += '<div class="admin-health-row">' +
          '<span class="admin-health-dot admin-health-dot--' + (info.status === 'ok' ? 'ok' : 'error') + '"></span>' +
          '<span class="admin-health-name">' + esc(svc) + '</span>' +
          '<span class="admin-health-latency">' + info.latencyMs + 'ms</span>' +
          '</div>';
      }
      healthEl.innerHTML = healthHtml;

      // Cron status
      var cronEl = document.getElementById('cronStatus');
      cronEl.innerHTML =
        '<div class="admin-cron-item"><span class="admin-cron-label">Last Daily Review</span><span class="admin-cron-value">' + esc(timeAgo(cron.lastDailyReview)) + '</span></div>' +
        '<div class="admin-cron-item"><span class="admin-cron-label">Last Weekly Digest</span><span class="admin-cron-value">' + esc(timeAgo(cron.lastWeeklyDigest)) + '</span></div>' +
        '<div class="admin-cron-item"><span class="admin-cron-label">Active Clients</span><span class="admin-cron-value">' + cron.activeClientCount + '</span></div>' +
        '<div class="admin-cron-item"><span class="admin-cron-label">Recent Errors (7d)</span><span class="admin-cron-value">' + (cron.recentErrors ? cron.recentErrors.length : 0) + '</span></div>';

    } catch (err) {
      document.getElementById('kpiGrid').innerHTML = '<div class="admin-alert admin-alert--error">Failed to load overview: ' + esc(err.message) + '</div>';
    }
  }

  /* ============================================================
     CLIENTS TAB
     ============================================================ */

  var searchInput = document.getElementById('clientSearch');
  var tierFilter = document.getElementById('clientTierFilter');
  var statusFilter = document.getElementById('clientStatusFilter');

  searchInput.addEventListener('input', debounce(function () {
    clientsPage = 1;
    loadClients();
  }, 300));

  tierFilter.addEventListener('change', function () { clientsPage = 1; loadClients(); });
  statusFilter.addEventListener('change', function () { clientsPage = 1; loadClients(); });

  async function loadClients() {
    var params = '?page=' + clientsPage + '&limit=20';
    var search = searchInput.value.trim();
    if (search) params += '&search=' + encodeURIComponent(search);
    var tier = tierFilter.value;
    if (tier) params += '&tier=' + encodeURIComponent(tier);
    var status = statusFilter.value;
    if (status) params += '&status=' + encodeURIComponent(status);

    try {
      var res = await apiGet('/api/v1/admin/clients' + params);
      var data = res.data;
      clientsTotalPages = data.totalPages;

      var body = document.getElementById('clientsBody');
      if (!data.clients.length) {
        body.innerHTML = '<tr><td colspan="6" class="admin-empty">No clients found</td></tr>';
      } else {
        var html = '';
        for (var i = 0; i < data.clients.length; i++) {
          var c = data.clients[i];
          var name = c.athleteProfile
            ? esc(c.athleteProfile.firstName || '') + ' ' + esc(c.athleteProfile.lastName || '')
            : '—';
          var plan = c.subscription ? esc(fmtTier(c.subscription.planTier)) : '—';
          var st = c.subscription ? statusBadge(c.subscription.status) : '—';
          var adh = c.adherence ? fmtPct(c.adherence.rate) : '—';
          html += '<tr class="admin-table-clickable" data-userid="' + esc(c.id) + '">' +
            '<td>' + name.trim() + '</td>' +
            '<td>' + esc(c.email) + '</td>' +
            '<td>' + plan + '</td>' +
            '<td>' + st + '</td>' +
            '<td>' + adh + '</td>' +
            '<td>' + fmtDate(c.createdAt) + '</td>' +
            '</tr>';
        }
        body.innerHTML = html;

        // Click handler for rows
        var rows = body.querySelectorAll('.admin-table-clickable');
        rows.forEach(function (row) {
          row.addEventListener('click', function () {
            var userId = row.getAttribute('data-userid');
            openClientDetail(userId);
          });
        });
      }

      // Pagination
      renderPagination('clientsPagination', clientsPage, clientsTotalPages, function (pg) {
        clientsPage = pg;
        loadClients();
      });

    } catch (err) {
      document.getElementById('clientsBody').innerHTML = '<tr><td colspan="6" class="admin-alert admin-alert--error">' + esc(err.message) + '</td></tr>';
    }
  }

  function renderPagination(elId, page, totalPages, onPageChange) {
    var el = document.getElementById(elId);
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    el.innerHTML =
      '<button class="admin-page-btn"' + (page <= 1 ? ' disabled' : '') + ' id="' + elId + 'Prev">Prev</button>' +
      '<span>Page ' + page + ' of ' + totalPages + '</span>' +
      '<button class="admin-page-btn"' + (page >= totalPages ? ' disabled' : '') + ' id="' + elId + 'Next">Next</button>';

    var prev = document.getElementById(elId + 'Prev');
    var next = document.getElementById(elId + 'Next');
    if (prev && page > 1) prev.addEventListener('click', function () { onPageChange(page - 1); });
    if (next && page < totalPages) next.addEventListener('click', function () { onPageChange(page + 1); });
  }

  /* ============================================================
     CLIENT DETAIL PANEL
     ============================================================ */

  var detailOverlay = document.getElementById('detailOverlay');
  var detailPanel = document.getElementById('detailPanel');
  var detailCloseBtn = document.getElementById('detailCloseBtn');
  var detailBody = document.getElementById('detailBody');
  var detailName = document.getElementById('detailName');

  function openClientDetail(userId) {
    currentDetailUserId = userId;
    detailOverlay.classList.add('admin-detail-overlay--open');
    detailPanel.classList.add('admin-detail-panel--open');
    detailBody.innerHTML = '<div class="admin-loading" style="height:200px;margin-top:1rem;"></div>';
    detailName.textContent = 'Loading...';
    loadClientDetail(userId);
  }

  function closeClientDetail() {
    detailOverlay.classList.remove('admin-detail-overlay--open');
    detailPanel.classList.remove('admin-detail-panel--open');
    currentDetailUserId = null;
  }

  detailCloseBtn.addEventListener('click', closeClientDetail);
  detailOverlay.addEventListener('click', closeClientDetail);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (document.getElementById('overrideOverlay').classList.contains('admin-modal-overlay--open')) {
        closeOverrideModal();
      } else if (detailPanel.classList.contains('admin-detail-panel--open')) {
        closeClientDetail();
      }
    }
  });

  async function loadClientDetail(userId) {
    try {
      var res = await apiGet('/api/v1/admin/clients/' + encodeURIComponent(userId));
      var d = res.data;

      var prof = d.athleteProfile || {};
      var sub = d.subscription;
      var name = (prof.firstName || '') + ' ' + (prof.lastName || '');
      detailName.textContent = name.trim() || d.email;

      var html = '';

      // Profile section — editable form
      html += '<div class="admin-detail-section">' +
        '<div class="admin-detail-section-title">Profile</div>' +
        detailRow('Email', d.email) +
        detailRow('Persona', prof.personaType) +
        detailRow('Risk Flags', Array.isArray(prof.riskFlags) && prof.riskFlags.length ? prof.riskFlags.join(', ') : 'None') +
        detailRow('Consecutive Missed', d.consecutiveMissed || 0) +
        '</div>';

      // Editable training fields
      html += '<div class="admin-detail-section">' +
        '<div class="admin-detail-section-title">Training Settings</div>' +
        '<div class="admin-form-row">' +
          '<div class="admin-form-group">' +
            '<label for="editGoal">Primary Goal</label>' +
            '<select class="admin-select" id="editGoal">' +
              profileOption('build-muscle', 'Build Muscle', prof.primaryGoal) +
              profileOption('lose-fat', 'Lose Fat', prof.primaryGoal) +
              profileOption('endurance', 'Endurance', prof.primaryGoal) +
              profileOption('recomposition', 'Recomposition', prof.primaryGoal) +
              profileOption('well-rounded', 'Well Rounded', prof.primaryGoal) +
            '</select>' +
          '</div>' +
          '<div class="admin-form-group">' +
            '<label for="editExperience">Experience Level</label>' +
            '<select class="admin-select" id="editExperience">' +
              profileOption('beginner', 'Beginner', prof.experienceLevel) +
              profileOption('intermediate', 'Intermediate', prof.experienceLevel) +
              profileOption('advanced', 'Advanced', prof.experienceLevel) +
              profileOption('elite', 'Elite', prof.experienceLevel) +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="admin-form-row">' +
          '<div class="admin-form-group">' +
            '<label for="editTrainingDays">Training Days/Week</label>' +
            '<input type="number" class="admin-input" id="editTrainingDays" min="1" max="7" value="' + (prof.trainingDaysPerWeek || 3) + '">' +
          '</div>' +
          '<div class="admin-form-group">' +
            '<label for="editStress">Stress Level (1-10)</label>' +
            '<input type="number" class="admin-input" id="editStress" min="1" max="10" value="' + (prof.stressLevel || '') + '">' +
          '</div>' +
        '</div>' +
        '<div class="admin-form-row">' +
          '<div class="admin-form-group">' +
            '<label for="editEquipment">Equipment Access</label>' +
            '<select class="admin-select" id="editEquipment">' +
              profileOption('full-gym', 'Full Gym', prof.equipmentAccess) +
              profileOption('home-gym', 'Home Gym', prof.equipmentAccess) +
              profileOption('minimal', 'Minimal', prof.equipmentAccess) +
              profileOption('bodyweight-only', 'Bodyweight Only', prof.equipmentAccess) +
            '</select>' +
          '</div>' +
          '<div class="admin-form-group">' +
            '<label for="editTrainingTime">Preferred Time</label>' +
            '<select class="admin-select" id="editTrainingTime">' +
              profileOption('morning', 'Morning', prof.preferredTrainingTime) +
              profileOption('midday', 'Midday', prof.preferredTrainingTime) +
              profileOption('evening', 'Evening', prof.preferredTrainingTime) +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="admin-form-group">' +
          '<label for="editTimezone">Timezone</label>' +
          '<select class="admin-select" id="editTimezone">' +
            profileOption('America/New_York', 'Eastern (ET)', prof.timezone) +
            profileOption('America/Chicago', 'Central (CT)', prof.timezone) +
            profileOption('America/Denver', 'Mountain (MT)', prof.timezone) +
            profileOption('America/Los_Angeles', 'Pacific (PT)', prof.timezone) +
            profileOption('America/Anchorage', 'Alaska (AKT)', prof.timezone) +
            profileOption('Pacific/Honolulu', 'Hawaii (HT)', prof.timezone) +
          '</select>' +
        '</div>' +
        '<div class="admin-form-group">' +
          '<label for="editInjury">Injury History</label>' +
          '<textarea class="admin-textarea" id="editInjury" rows="2" placeholder="None">' + esc(prof.injuryHistory || '') + '</textarea>' +
        '</div>' +
        '<button class="admin-btn-primary admin-btn-small" id="saveProfileBtn" style="margin-top:0.5rem;">Save Profile</button>' +
        '<div id="profileAlert"></div>' +
        '</div>';

      // Subscription section
      html += '<div class="admin-detail-section">' +
        '<div class="admin-detail-section-title">Subscription</div>';
      if (sub) {
        html += detailRow('Plan', fmtTier(sub.planTier)) +
          detailRow('Status', sub.status) +
          detailRow('Period End', fmtDate(sub.currentPeriodEnd));
      } else {
        html += '<div class="admin-detail-row"><span class="admin-detail-label">No subscription</span></div>';
      }
      html += '</div>';

      // Adherence history
      if (d.adherenceHistory && d.adherenceHistory.length) {
        html += '<div class="admin-detail-section">' +
          '<div class="admin-detail-section-title">Adherence (8 Weeks)</div>' +
          '<table class="admin-mini-table"><thead><tr><th>Week</th><th>Rate</th><th>Done</th><th>Sched</th></tr></thead><tbody>';
        for (var a = 0; a < d.adherenceHistory.length; a++) {
          var ah = d.adherenceHistory[a];
          html += '<tr><td>' + fmtDate(ah.weekStartDate) + '</td><td>' + fmtPct(ah.adherenceRate) + '</td><td>' + ah.completedCount + '</td><td>' + ah.scheduledCount + '</td></tr>';
        }
        html += '</tbody></table></div>';
      }

      // Current workout sessions
      var sessions = (prof.workoutPlans && prof.workoutPlans[0] && prof.workoutPlans[0].sessions) || [];
      if (sessions.length) {
        html += '<div class="admin-detail-section">' +
          '<div class="admin-detail-section-title">Current Plan Sessions</div>' +
          '<table class="admin-mini-table"><thead><tr><th>Date</th><th>Title</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>';
        for (var s = 0; s < sessions.length; s++) {
          var sess = sessions[s];
          html += '<tr>' +
            '<td>' + fmtDate(sess.scheduledDate) + '</td>' +
            '<td>' + esc(sess.title) + '</td>' +
            '<td>' + esc(sess.sessionType) + '</td>' +
            '<td>' + statusBadge(sess.status) + '</td>' +
            '<td><button class="admin-btn-secondary admin-btn-small" data-override-id="' + esc(sess.id) + '">Override</button></td>' +
            '</tr>';
        }
        html += '</tbody></table></div>';
      }

      // Messaging toggle + thread
      var msgDisabled = prof.messagingDisabled || false;
      html += '<div class="admin-detail-section">' +
        '<div class="admin-detail-section-title" style="display:flex;justify-content:space-between;align-items:center;">' +
          '<span>Messages</span>' +
          '<label class="admin-toggle">' +
            '<input type="checkbox" id="msgToggle"' + (msgDisabled ? ' checked' : '') + '>' +
            '<span class="admin-toggle-slider"></span>' +
            '<span class="admin-toggle-label">' + (msgDisabled ? 'Paused' : 'Active') + '</span>' +
          '</label>' +
        '</div>';

      if (d.messageLogs && d.messageLogs.length) {
        html += '<div class="admin-msg-thread">';
        for (var m = 0; m < d.messageLogs.length; m++) {
          var msg = d.messageLogs[m];
          var msgFailed = !!msg.failedAt;
          var channelIcon = msg.channel === 'SMS' ? 'SMS' : 'EMAIL';
          html += '<div class="admin-msg-item' + (msgFailed ? ' admin-msg-item--failed' : '') + '">' +
            '<div class="admin-msg-meta">' +
              '<span class="admin-msg-channel">' + esc(channelIcon) + '</span>' +
              '<span class="admin-msg-category">' + esc(msg.category) + '</span>' +
              '<span class="admin-msg-time">' + fmtDateTime(msg.sentAt) + '</span>' +
              (msgFailed ? '<span class="admin-msg-status admin-msg-status--failed">Failed</span>' : '<span class="admin-msg-status admin-msg-status--sent">Sent</span>') +
            '</div>' +
            '<div class="admin-msg-content">' + esc(msg.content || '') + '</div>' +
            (msg.failureReason ? '<div class="admin-msg-error">' + esc(msg.failureReason) + '</div>' : '') +
          '</div>';
        }
        html += '</div>';
      } else {
        html += '<div class="admin-empty" style="padding:1rem;">No messages sent yet</div>';
      }
      html += '</div>';

      // Escalation events
      if (d.escalationEvents && d.escalationEvents.length) {
        html += '<div class="admin-detail-section">' +
          '<div class="admin-detail-section-title">Escalations</div>';
        for (var e = 0; e < d.escalationEvents.length; e++) {
          var ev = d.escalationEvents[e];
          html += '<div class="admin-esc-card" style="margin-bottom:0.5rem;padding:0.6rem 0.8rem;">' +
            '<div class="admin-esc-card-header">' +
            '<span class="admin-badge admin-badge--' + (ev.resolvedAt ? 'active' : 'canceled') + '">' + esc(ev.escalationLevel) + '</span>' +
            '<span class="admin-esc-date">' + fmtDate(ev.createdAt) + '</span>' +
            '</div>' +
            '<div class="admin-esc-reason">' + esc(ev.triggerReason) + '</div>' +
            (ev.resolution ? '<div class="admin-esc-resolution">' + esc(ev.resolution) + '</div>' : '') +
            '</div>';
        }
        html += '</div>';
      }

      // Admin notes — extract only the admin-written portion after [ADMIN NOTES]
      var rawSummary = prof.aiSummary || '';
      var adminNotesOnly = '';
      var adminMarkerIdx = rawSummary.indexOf('[ADMIN NOTES]');
      if (adminMarkerIdx !== -1) {
        adminNotesOnly = rawSummary.substring(adminMarkerIdx + '[ADMIN NOTES]'.length).trim();
      }
      html += '<div class="admin-detail-section">' +
        '<div class="admin-detail-section-title">Admin Notes</div>' +
        '<textarea class="admin-textarea" id="detailNotes" rows="4" placeholder="Add notes about this client...">' + esc(adminNotesOnly) + '</textarea>' +
        '<button class="admin-btn-primary admin-btn-small" id="saveNotesBtn" style="margin-top:0.5rem;">Save Notes</button>' +
        '<div id="notesAlert"></div>' +
        '</div>';

      // Send custom message
      html += '<div class="admin-detail-section">' +
        '<div class="admin-detail-section-title">Send Message</div>' +
        '<div class="admin-channel-toggle">' +
        '<button class="admin-channel-btn admin-channel-btn--active" data-channel="SMS">SMS</button>' +
        '<button class="admin-channel-btn" data-channel="EMAIL">Email</button>' +
        '</div>' +
        '<textarea class="admin-textarea" id="detailMsgContent" rows="3" placeholder="Message content..."></textarea>' +
        '<button class="admin-btn-primary admin-btn-small" id="sendMsgBtn" style="margin-top:0.5rem;">Send</button>' +
        '<div id="msgAlert"></div>' +
        '</div>';

      // Trigger review
      html += '<div class="admin-detail-section">' +
        '<div class="admin-detail-section-title">Actions</div>' +
        '<button class="admin-btn-secondary" id="triggerReviewBtn">Trigger Daily Review</button>' +
        '<div id="reviewAlert" style="margin-top:0.5rem;"></div>' +
        '</div>';

      detailBody.innerHTML = html;

      // Bind detail events
      bindDetailEvents(userId, sessions);

    } catch (err) {
      detailBody.innerHTML = '<div class="admin-alert admin-alert--error">' + esc(err.message) + '</div>';
    }
  }

  function detailRow(label, value) {
    var display = (value != null && value !== '') ? value : '—';
    return '<div class="admin-detail-row"><span class="admin-detail-label">' + esc(label) + '</span><span class="admin-detail-value">' + esc(display) + '</span></div>';
  }

  function bindDetailEvents(userId, sessions) {
    // Save profile
    var saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
      saveProfileBtn.addEventListener('click', async function () {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = 'Saving...';
        try {
          var payload = {};
          var goal = document.getElementById('editGoal').value;
          if (goal) payload.primaryGoal = goal;
          var exp = document.getElementById('editExperience').value;
          if (exp) payload.experienceLevel = exp;
          var days = document.getElementById('editTrainingDays').value;
          if (days) payload.trainingDaysPerWeek = parseInt(days, 10);
          var stress = document.getElementById('editStress').value;
          if (stress) payload.stressLevel = parseInt(stress, 10);
          var equip = document.getElementById('editEquipment').value;
          if (equip) payload.equipmentAccess = equip;
          var time = document.getElementById('editTrainingTime').value;
          if (time) payload.preferredTrainingTime = time;
          var tz = document.getElementById('editTimezone').value;
          if (tz) payload.timezone = tz;
          var injury = document.getElementById('editInjury').value.trim();
          payload.injuryHistory = injury || null;

          await apiPut('/api/v1/admin/clients/' + encodeURIComponent(userId) + '/profile', payload);
          document.getElementById('profileAlert').innerHTML = '<div class="admin-alert admin-alert--success">Profile saved</div>';
          setTimeout(function () {
            var el = document.getElementById('profileAlert');
            if (el) el.innerHTML = '';
          }, 3000);
        } catch (err) {
          document.getElementById('profileAlert').innerHTML = '<div class="admin-alert admin-alert--error">' + esc(err.message) + '</div>';
        } finally {
          saveProfileBtn.disabled = false;
          saveProfileBtn.textContent = 'Save Profile';
        }
      });
    }

    // Save notes
    var saveNotesBtn = document.getElementById('saveNotesBtn');
    if (saveNotesBtn) {
      saveNotesBtn.addEventListener('click', async function () {
        saveNotesBtn.disabled = true;
        saveNotesBtn.textContent = 'Saving...';
        try {
          var notes = document.getElementById('detailNotes').value.trim();
          if (!notes) {
            document.getElementById('notesAlert').innerHTML = '<div class="admin-alert admin-alert--error">Notes cannot be empty</div>';
            saveNotesBtn.disabled = false;
            saveNotesBtn.textContent = 'Save Notes';
            return;
          }
          await apiPut('/api/v1/admin/clients/' + encodeURIComponent(userId) + '/notes', { notes: notes });
          document.getElementById('notesAlert').innerHTML = '<div class="admin-alert admin-alert--success">Notes saved</div>';
          setTimeout(function () {
            var el = document.getElementById('notesAlert');
            if (el) el.innerHTML = '';
          }, 3000);
        } catch (err) {
          document.getElementById('notesAlert').innerHTML = '<div class="admin-alert admin-alert--error">' + esc(err.message) + '</div>';
        } finally {
          saveNotesBtn.disabled = false;
          saveNotesBtn.textContent = 'Save Notes';
        }
      });
    }

    // Messaging toggle (per-client disable)
    var msgToggle = document.getElementById('msgToggle');
    if (msgToggle) {
      msgToggle.addEventListener('change', async function () {
        var disabled = msgToggle.checked;
        var label = msgToggle.parentElement.querySelector('.admin-toggle-label');
        try {
          await apiPut('/api/v1/admin/clients/' + encodeURIComponent(userId) + '/profile', {
            messagingDisabled: disabled
          });
          if (label) label.textContent = disabled ? 'Paused' : 'Active';
        } catch (err) {
          // Revert on failure
          msgToggle.checked = !disabled;
          alert('Failed to update messaging: ' + err.message);
        }
      });
    }

    // Channel toggle
    var channelBtns = detailBody.querySelectorAll('.admin-channel-btn');
    channelBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        channelBtns.forEach(function (b) { b.classList.remove('admin-channel-btn--active'); });
        btn.classList.add('admin-channel-btn--active');
      });
    });

    // Send message
    var sendMsgBtn = document.getElementById('sendMsgBtn');
    if (sendMsgBtn) {
      sendMsgBtn.addEventListener('click', async function () {
        var content = document.getElementById('detailMsgContent').value.trim();
        if (!content) return;
        var activeChannel = detailBody.querySelector('.admin-channel-btn--active');
        var channel = activeChannel ? activeChannel.getAttribute('data-channel') : 'SMS';
        sendMsgBtn.disabled = true;
        sendMsgBtn.textContent = 'Sending...';
        try {
          await apiPost('/api/v1/admin/clients/' + encodeURIComponent(userId) + '/message', {
            content: content,
            channel: channel
          });
          document.getElementById('msgAlert').innerHTML = '<div class="admin-alert admin-alert--success">Message sent via ' + esc(channel) + '</div>';
          document.getElementById('detailMsgContent').value = '';
          // Refresh thread to show the new message
          loadClientDetail(userId);
          setTimeout(function () {
            var el = document.getElementById('msgAlert');
            if (el) el.innerHTML = '';
          }, 3000);
        } catch (err) {
          document.getElementById('msgAlert').innerHTML = '<div class="admin-alert admin-alert--error">' + esc(err.message) + '</div>';
        } finally {
          sendMsgBtn.disabled = false;
          sendMsgBtn.textContent = 'Send';
        }
      });
    }

    // Trigger review
    var triggerBtn = document.getElementById('triggerReviewBtn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', async function () {
        triggerBtn.disabled = true;
        triggerBtn.textContent = 'Running...';
        try {
          var res = await apiPost('/api/v1/admin/system/trigger-review/' + encodeURIComponent(userId));
          var msg = res.data ? 'Review completed in ' + res.data.durationMs + 'ms' : 'Review completed';
          document.getElementById('reviewAlert').innerHTML = '<div class="admin-alert admin-alert--success">' + esc(msg) + '</div>';
          setTimeout(function () {
            var el = document.getElementById('reviewAlert');
            if (el) el.innerHTML = '';
          }, 5000);
        } catch (err) {
          document.getElementById('reviewAlert').innerHTML = '<div class="admin-alert admin-alert--error">' + esc(err.message) + '</div>';
        } finally {
          triggerBtn.disabled = false;
          triggerBtn.textContent = 'Trigger Daily Review';
        }
      });
    }

    // Workout override buttons
    var overrideBtns = detailBody.querySelectorAll('[data-override-id]');
    overrideBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var sessionId = btn.getAttribute('data-override-id');
        var sessionData = null;
        for (var i = 0; i < sessions.length; i++) {
          if (sessions[i].id === sessionId) { sessionData = sessions[i]; break; }
        }
        openOverrideModal(sessionId, sessionData);
      });
    });
  }

  /* ============================================================
     WORKOUT OVERRIDE MODAL
     ============================================================ */

  var overrideOverlay = document.getElementById('overrideOverlay');
  var overrideCloseBtn = document.getElementById('overrideCloseBtn');
  var overrideCancelBtn = document.getElementById('overrideCancelBtn');
  var overrideForm = document.getElementById('overrideForm');

  function openOverrideModal(sessionId, data) {
    document.getElementById('overrideSessionId').value = sessionId;
    document.getElementById('overrideTitle').value = (data && data.title) || '';
    document.getElementById('overrideDesc').value = (data && data.description) || '';
    document.getElementById('overrideType').value = (data && data.sessionType) || 'STRENGTH_UPPER';
    document.getElementById('overrideStatus').value = (data && data.status) || 'SCHEDULED';
    document.getElementById('overrideDuration').value = (data && data.prescribedDuration) || (data && data.actualDuration) || '';
    document.getElementById('overrideTSS').value = (data && data.prescribedTSS) || '';
    document.getElementById('overrideNotes').value = (data && data.athleteNotes) || '';
    overrideOverlay.classList.add('admin-modal-overlay--open');
  }

  function closeOverrideModal() {
    overrideOverlay.classList.remove('admin-modal-overlay--open');
  }

  overrideCloseBtn.addEventListener('click', closeOverrideModal);
  overrideCancelBtn.addEventListener('click', closeOverrideModal);
  overrideOverlay.addEventListener('click', function (e) {
    if (e.target === overrideOverlay) closeOverrideModal();
  });

  overrideForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    var sessionId = document.getElementById('overrideSessionId').value;
    var saveBtn = document.getElementById('overrideSaveBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    var payload = {};
    var title = document.getElementById('overrideTitle').value.trim();
    if (title) payload.title = title;
    var desc = document.getElementById('overrideDesc').value.trim();
    if (desc) payload.description = desc;
    payload.sessionType = document.getElementById('overrideType').value;
    payload.status = document.getElementById('overrideStatus').value;
    var dur = document.getElementById('overrideDuration').value;
    if (dur) payload.prescribedDuration = parseInt(dur, 10);
    var tss = document.getElementById('overrideTSS').value;
    if (tss) payload.prescribedTSS = parseFloat(tss);
    var notes = document.getElementById('overrideNotes').value.trim();
    if (notes) payload.athleteNotes = notes;

    try {
      await apiPut('/api/v1/admin/workout/' + encodeURIComponent(sessionId), payload);
      closeOverrideModal();
      // Refresh client detail
      if (currentDetailUserId) loadClientDetail(currentDetailUserId);
    } catch (err) {
      alert('Override failed: ' + err.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Override';
    }
  });

  /* ============================================================
     ADHERENCE TAB
     ============================================================ */

  async function loadAdherence() {
    try {
      var res = await apiGet('/api/v1/admin/analytics/adherence');
      var weeks = res.data;

      // Render table
      var body = document.getElementById('adherenceBody');
      if (!weeks || !weeks.length) {
        body.innerHTML = '<tr><td colspan="6" class="admin-empty">No adherence data yet</td></tr>';
      } else {
        var html = '';
        for (var i = 0; i < weeks.length; i++) {
          var w = weeks[i];
          html += '<tr>' +
            '<td>' + esc(w.weekStart) + '</td>' +
            '<td>' + fmtPct(w.avgAdherenceRate) + '</td>' +
            '<td>' + w.totalCompleted + '</td>' +
            '<td>' + w.totalScheduled + '</td>' +
            '<td>' + w.totalMissed + '</td>' +
            '<td>' + w.clientCount + '</td>' +
            '</tr>';
        }
        body.innerHTML = html;

        // Draw chart
        drawAdherenceChart(weeks);
      }

    } catch (err) {
      document.getElementById('adherenceBody').innerHTML = '<tr><td colspan="6" class="admin-alert admin-alert--error">' + esc(err.message) + '</td></tr>';
    }
  }

  function drawAdherenceChart(weeks) {
    var canvas = document.getElementById('adherenceChart');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.parentElement.clientWidth;
    var h = 280;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.scale(dpr, dpr);

    var padLeft = 50;
    var padRight = 20;
    var padTop = 20;
    var padBottom = 50;
    var chartW = w - padLeft - padRight;
    var chartH = h - padTop - padBottom;

    // Clear
    ctx.clearRect(0, 0, w, h);

    if (weeks.length === 0) return;

    // Y-axis: 0-100%
    ctx.strokeStyle = 'rgba(192,192,192,0.08)';
    ctx.lineWidth = 1;
    ctx.font = '10px DM Sans, sans-serif';
    ctx.fillStyle = 'rgba(192,192,192,0.35)';
    ctx.textAlign = 'right';
    for (var y = 0; y <= 100; y += 25) {
      var yy = padTop + chartH - (y / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padLeft, yy);
      ctx.lineTo(w - padRight, yy);
      ctx.stroke();
      ctx.fillText(y + '%', padLeft - 8, yy + 3);
    }

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(192,192,192,0.35)';
    var stepX = chartW / Math.max(1, weeks.length - 1);
    for (var xi = 0; xi < weeks.length; xi++) {
      var xx = padLeft + xi * stepX;
      var label = weeks[xi].weekStart.substring(5); // MM-DD
      ctx.save();
      ctx.translate(xx, h - padBottom + 16);
      ctx.rotate(-0.4);
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // Gradient fill
    var grad = ctx.createLinearGradient(0, padTop, 0, padTop + chartH);
    grad.addColorStop(0, 'rgba(192,192,192,0.12)');
    grad.addColorStop(1, 'rgba(192,192,192,0)');

    ctx.beginPath();
    for (var gi = 0; gi < weeks.length; gi++) {
      var gx = padLeft + gi * stepX;
      var gRate = weeks[gi].avgAdherenceRate;
      var gy = padTop + chartH - (gRate * 100 / 100) * chartH;
      if (gi === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.lineTo(padLeft + (weeks.length - 1) * stepX, padTop + chartH);
    ctx.lineTo(padLeft, padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#c0c0c0';
    ctx.lineWidth = 2;
    for (var li = 0; li < weeks.length; li++) {
      var lx = padLeft + li * stepX;
      var lRate = weeks[li].avgAdherenceRate;
      var ly = padTop + chartH - (lRate * 100 / 100) * chartH;
      if (li === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.stroke();

    // Dots
    ctx.fillStyle = '#c0c0c0';
    for (var di = 0; di < weeks.length; di++) {
      var dx = padLeft + di * stepX;
      var dRate = weeks[di].avgAdherenceRate;
      var dy = padTop + chartH - (dRate * 100 / 100) * chartH;
      ctx.beginPath();
      ctx.arc(dx, dy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ============================================================
     ESCALATIONS TAB
     ============================================================ */

  var escFilterBtns = document.querySelectorAll('.admin-filter-btn');
  escFilterBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      escFilterBtns.forEach(function (b) { b.classList.remove('admin-filter-btn--active'); });
      btn.classList.add('admin-filter-btn--active');
      escalationFilter = btn.getAttribute('data-filter');
      escalationsPage = 1;
      loadEscalations();
    });
  });

  async function loadEscalations() {
    var params = '?page=' + escalationsPage + '&limit=20';
    if (escalationFilter === 'resolved') params += '&resolved=true';
    else if (escalationFilter === 'unresolved') params += '&resolved=false';

    try {
      var res = await apiGet('/api/v1/admin/analytics/escalations' + params);
      var data = res.data;
      escalationsTotalPages = data.totalPages;

      var listEl = document.getElementById('escalationsList');
      if (!data.escalations || !data.escalations.length) {
        listEl.innerHTML = '<div class="admin-empty">No escalations found</div>';
      } else {
        var html = '';
        for (var i = 0; i < data.escalations.length; i++) {
          var esc_item = data.escalations[i];
          var clientName = '—';
          if (esc_item.user && esc_item.user.athleteProfile) {
            clientName = (esc_item.user.athleteProfile.firstName || '') + ' ' + (esc_item.user.athleteProfile.lastName || '');
            clientName = clientName.trim() || esc_item.user.email || '—';
          } else if (esc_item.user) {
            clientName = esc_item.user.email || '—';
          }
          html += '<div class="admin-esc-card">' +
            '<div class="admin-esc-card-header">' +
            '<span class="admin-esc-client">' + esc(clientName) + '</span>' +
            '<span class="admin-esc-date">' + fmtDate(esc_item.createdAt) + '</span>' +
            '</div>' +
            '<div class="admin-esc-reason">' + esc(esc_item.triggerReason) + '</div>' +
            '<div class="admin-esc-meta">' +
            '<span>Level: ' + esc(esc_item.escalationLevel) + '</span>' +
            '<span>Msg: ' + (esc_item.messageSent ? 'Yes' : 'No') + '</span>' +
            '<span>Call: ' + (esc_item.callBooked ? 'Yes' : 'No') + '</span>' +
            '<span>' + (esc_item.resolvedAt ? statusBadge('COMPLETED') : statusBadge('MISSED')) + '</span>' +
            '</div>' +
            (esc_item.resolution ? '<div class="admin-esc-resolution">' + esc(esc_item.resolution) + '</div>' : '') +
            '</div>';
        }
        listEl.innerHTML = html;
      }

      renderPagination('escalationsPagination', escalationsPage, escalationsTotalPages, function (pg) {
        escalationsPage = pg;
        loadEscalations();
      });

    } catch (err) {
      document.getElementById('escalationsList').innerHTML = '<div class="admin-alert admin-alert--error">' + esc(err.message) + '</div>';
    }
  }

  /* ── Init: load overview on page load ── */
  loadTab('overview');

})();
