/**
 * Vintus Performance — Workout Detail Page
 * Loads workout session from /api/v1/dashboard/workout/:sessionId
 * Handles completion via /api/v1/workout/:sessionId/complete
 */

(function () {
  // Auth guard
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get('id');

  var loadingEl = document.getElementById('workoutLoading');
  var errorEl = document.getElementById('workoutError');
  var errorMsg = document.getElementById('workoutErrorMsg');
  var contentEl = document.getElementById('workoutContent');

  if (!sessionId) {
    showError('No workout ID found. Please go back to your dashboard.');
    return;
  }

  var sessionData = null;
  loadWorkout();

  async function loadWorkout() {
    try {
      var res = await apiGet('/api/v1/dashboard/workout/' + sessionId);

      if (!res.success || !res.data) {
        showError('Unable to load this workout. It may have been removed or rescheduled.');
        return;
      }

      sessionData = res.data;
      renderWorkout(res.data);
    } catch (err) {
      showError(err.message || 'Failed to load workout.');
    }
  }

  function renderWorkout(data) {
    // Title
    document.getElementById('workoutTitle').textContent = data.title || 'Workout';

    // Meta badges
    var metaEl = document.getElementById('workoutMeta');
    var badges = [];

    if (data.sessionType) {
      badges.push(data.sessionType.replace(/_/g, ' '));
    }
    if (data.prescribedDuration) {
      badges.push(data.prescribedDuration + ' min');
    }
    if (data.scheduledDate) {
      var d = new Date(data.scheduledDate);
      badges.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
    }
    if (data.status) {
      badges.push(data.status);
    }

    metaEl.innerHTML = badges.map(function (b) {
      return '<span class="workout-badge">' + escapeHtml(b) + '</span>';
    }).join('');

    // Description
    if (data.description) {
      document.getElementById('workoutDesc').textContent = data.description;
    }

    // Parse content JSON
    var content = data.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch (e) { content = null; }
    }

    if (content) {
      // Warmup
      if (content.warmup && content.warmup.length > 0) {
        var warmupPhase = document.getElementById('warmupPhase');
        var warmupList = document.getElementById('warmupList');
        warmupPhase.style.display = 'block';

        content.warmup.forEach(function (ex) {
          var card = document.createElement('div');
          card.className = 'exercise-card simple';
          card.innerHTML =
            '<div>' +
              '<div class="exercise-name">' + escapeHtml(ex.exercise) + '</div>' +
              (ex.notes ? '<div class="exercise-notes">' + escapeHtml(ex.notes) + '</div>' : '') +
            '</div>' +
            (ex.duration ? '<span class="exercise-duration">' + escapeHtml(ex.duration) + '</span>' : '');
          warmupList.appendChild(card);
        });
      }

      // Main exercises
      if (content.main && content.main.length > 0) {
        var mainPhase = document.getElementById('mainPhase');
        var mainList = document.getElementById('mainList');
        mainPhase.style.display = 'block';

        content.main.forEach(function (ex) {
          var card = document.createElement('div');
          card.className = 'exercise-card';

          var detailsHtml = '';
          if (ex.sets) {
            detailsHtml += '<div class="exercise-detail"><span class="exercise-detail-label">Sets</span><span class="exercise-detail-value">' + ex.sets + '</span></div>';
          }
          if (ex.reps) {
            detailsHtml += '<div class="exercise-detail"><span class="exercise-detail-label">Reps</span><span class="exercise-detail-value">' + escapeHtml(String(ex.reps)) + '</span></div>';
          }
          if (ex.rest) {
            detailsHtml += '<div class="exercise-detail"><span class="exercise-detail-label">Rest</span><span class="exercise-detail-value">' + escapeHtml(ex.rest) + '</span></div>';
          }
          if (ex.intensity) {
            detailsHtml += '<div class="exercise-detail"><span class="exercise-detail-label">Intensity</span><span class="exercise-detail-value">' + escapeHtml(ex.intensity) + '</span></div>';
          }

          card.innerHTML =
            '<div class="exercise-name">' + escapeHtml(ex.exercise) + '</div>' +
            '<div class="exercise-details">' + detailsHtml + '</div>' +
            (ex.notes ? '<div class="exercise-notes">' + escapeHtml(ex.notes) + '</div>' : '');
          mainList.appendChild(card);
        });
      }

      // Cooldown
      if (content.cooldown && content.cooldown.length > 0) {
        var cooldownPhase = document.getElementById('cooldownPhase');
        var cooldownList = document.getElementById('cooldownList');
        cooldownPhase.style.display = 'block';

        content.cooldown.forEach(function (ex) {
          var card = document.createElement('div');
          card.className = 'exercise-card simple';
          card.innerHTML =
            '<div class="exercise-name">' + escapeHtml(ex.exercise) + '</div>' +
            (ex.duration ? '<span class="exercise-duration">' + escapeHtml(ex.duration) + '</span>' : '');
          cooldownList.appendChild(card);
        });
      }
    }

    // Plan info
    if (data.workoutPlan) {
      var planInfo = document.getElementById('planInfo');
      var infoHtml = '';

      if (data.workoutPlan.name) {
        infoHtml += '<div class="plan-info-item"><span class="plan-info-label">Plan</span><span class="plan-info-value">' + escapeHtml(data.workoutPlan.name) + '</span></div>';
      }
      if (data.workoutPlan.weekNumber) {
        infoHtml += '<div class="plan-info-item"><span class="plan-info-label">Week</span><span class="plan-info-value">' + data.workoutPlan.weekNumber + '</span></div>';
      }
      if (data.workoutPlan.blockType) {
        infoHtml += '<div class="plan-info-item"><span class="plan-info-label">Block</span><span class="plan-info-value">' + escapeHtml(data.workoutPlan.blockType) + '</span></div>';
      }

      if (infoHtml) {
        planInfo.innerHTML = infoHtml;
        planInfo.style.display = 'flex';
      }
    }

    // Show complete button or completed message
    if (data.status === 'SCHEDULED') {
      document.getElementById('completeWrap').style.display = 'block';
    } else if (data.status === 'COMPLETED') {
      document.getElementById('completedMsg').style.display = 'block';
    }

    // Show content, hide loading
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  }

  // ── Completion Modal ──
  var modal = document.getElementById('completeModal');
  var completeBtn = document.getElementById('completeBtn');
  var modalClose = document.getElementById('modalClose');
  var modalSubmit = document.getElementById('modalSubmit');
  var rpeSlider = document.getElementById('rpeSlider');
  var rpeValue = document.getElementById('rpeValue');

  // RPE slider live update
  rpeSlider.addEventListener('input', function () {
    rpeValue.textContent = this.value;
  });

  // Open modal
  completeBtn.addEventListener('click', function () {
    // Pre-fill duration if we have prescribed
    if (sessionData && sessionData.prescribedDuration) {
      document.getElementById('actualDuration').value = sessionData.prescribedDuration;
    }
    modal.classList.add('active');
  });

  // Close modal
  modalClose.addEventListener('click', function () {
    modal.classList.remove('active');
  });

  // Close modal on overlay click
  modal.addEventListener('click', function (e) {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });

  // Submit completion
  modalSubmit.addEventListener('click', async function () {
    var duration = parseInt(document.getElementById('actualDuration').value, 10);
    var rpe = parseInt(rpeSlider.value, 10);
    var notes = document.getElementById('athleteNotes').value.trim();

    if (!duration || duration < 1) {
      alert('Please enter the workout duration in minutes.');
      return;
    }

    if (duration > 600) {
      alert('Duration cannot exceed 600 minutes.');
      return;
    }

    modalSubmit.disabled = true;
    modalSubmit.textContent = 'Submitting...';

    var payload = {
      actualDuration: duration,
      rpe: rpe
    };
    if (notes) {
      payload.athleteNotes = notes;
    }

    try {
      var res = await apiPost('/api/v1/workout/' + sessionId + '/complete', payload);

      if (res.success) {
        modal.classList.remove('active');

        // Hide complete button, show success
        document.getElementById('completeWrap').style.display = 'none';
        document.getElementById('completedMsg').style.display = 'block';

        // Update status badge
        var metaEl = document.getElementById('workoutMeta');
        var badges = metaEl.querySelectorAll('.workout-badge');
        if (badges.length > 0) {
          badges[badges.length - 1].textContent = 'COMPLETED';
        }

        // Redirect to dashboard after brief delay
        setTimeout(function () {
          window.location.href = 'dashboard.html';
        }, 2000);
      } else {
        alert('Failed to mark workout as complete. Please try again.');
        modalSubmit.disabled = false;
        modalSubmit.textContent = 'Submit';
      }
    } catch (err) {
      alert(err.message || 'Failed to complete workout.');
      modalSubmit.disabled = false;
      modalSubmit.textContent = 'Submit';
    }
  });

  // ── Helpers ──
  function showError(msg) {
    loadingEl.style.display = 'none';
    errorMsg.textContent = msg;
    errorEl.style.display = 'block';
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
