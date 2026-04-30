/**
 * Vintus Performance — Post-Purchase Onboarding (4 Steps)
 * Step 1: Verify Stripe session → Set password
 * Step 2: Device connection (MVP: all Coming Soon)
 * Step 3: Routine questionnaire → POST /api/v1/onboarding/routine
 * Step 4: Success → dashboard
 */

(function () {
  var currentStep = 1;
  var userId = null;
  var currentTier = null;

  var errorEl = document.getElementById('onboardError');
  var params = new URLSearchParams(window.location.search);
  var sessionId = params.get('session_id');

  // ── Checkbox toggles ──
  document.querySelectorAll('.onboard-checkbox').forEach(function (cb) {
    cb.addEventListener('click', function () {
      cb.classList.toggle('checked');
    });
  });

  // ── Slider live updates ──
  setupSlider('energySlider', 'energyVal');
  setupSlider('sorenessSlider', 'sorenessVal');
  setupSlider('moodSlider', 'moodVal');
  setupSlider('sleepSlider', 'sleepVal');

  function setupSlider(sliderId, valueId) {
    var slider = document.getElementById(sliderId);
    var display = document.getElementById(valueId);
    if (slider && display) {
      slider.addEventListener('input', function () { display.textContent = this.value; });
    }
  }

  // ── Step 1: Verify session and set password ──
  var step1Btn = document.getElementById('step1Btn');
  step1Btn.addEventListener('click', async function () {
    hideError();

    if (!sessionId) {
      showError('No checkout session found. Please complete purchase first.');
      return;
    }

    var pw = document.getElementById('obPassword').value;
    var pwConfirm = document.getElementById('obPasswordConfirm').value;

    if (!pw || pw.length < 8) { showError('Password must be at least 8 characters.'); return; }
    if (!/[A-Z]/.test(pw)) { showError('Password must contain at least 1 uppercase letter.'); return; }
    if (!/[0-9]/.test(pw)) { showError('Password must contain at least 1 number.'); return; }
    if (pw !== pwConfirm) { showError('Passwords do not match.'); return; }

    step1Btn.disabled = true;
    step1Btn.textContent = 'Verifying...';

    try {
      // Verify the Stripe checkout session
      var verifyRes = await apiPost('/api/v1/onboarding/verify-session', { sessionId: sessionId });
      if (!verifyRes.success || !verifyRes.data) {
        showError('Could not verify your purchase. Please contact support.');
        step1Btn.disabled = false;
        step1Btn.textContent = 'Set Password & Continue';
        return;
      }

      userId = verifyRes.data.userId;
      currentTier = verifyRes.data.tier || null;

      // Set password
      var pwRes = await apiPost('/api/v1/onboarding/set-password', { userId: userId, sessionId: sessionId, password: pw });
      if (pwRes.success && pwRes.data && pwRes.data.token) {
        setToken(pwRes.data.token);
        localStorage.setItem('vintus_role', 'CLIENT');
        goToStep(2);
      } else {
        showError('Failed to set password. Please try again.');
        step1Btn.disabled = false;
        step1Btn.textContent = 'Set Password & Continue';
      }
    } catch (err) {
      showError(err.message || 'Something went wrong.');
      step1Btn.disabled = false;
      step1Btn.textContent = 'Set Password & Continue';
    }
  });

  // ── Step 2: Device connection (skip for MVP) ──
  var step2Btn = document.getElementById('step2Btn');
  step2Btn.addEventListener('click', function () {
    goToStep(3);
  });

  // ── Section collapse toggles ──
  document.querySelectorAll('.onboard-section-header').forEach(function (header) {
    header.addEventListener('click', function () {
      var section = header.closest('.onboard-form-section');
      section.classList.toggle('open');
    });
  });

  // ── Injury repeater ──
  var injuryCount = 0;
  var addInjuryBtn = document.getElementById('addInjuryBtn');
  if (addInjuryBtn) {
    addInjuryBtn.addEventListener('click', function () {
      injuryCount++;
      var row = document.createElement('div');
      row.className = 'onboard-injury-row';
      row.setAttribute('data-injury-idx', injuryCount);
      row.innerHTML =
        '<div class="onboard-fields-row">' +
          '<div class="onboard-field"><input type="text" class="injury-area" placeholder="Body area (e.g. Left knee)"></div>' +
          '<div class="onboard-field"><select class="injury-severity">' +
            '<option value="mild">Mild</option>' +
            '<option value="moderate">Moderate</option>' +
            '<option value="severe">Severe</option>' +
          '</select></div>' +
        '</div>' +
        '<div class="onboard-fields-row">' +
          '<div class="onboard-field" style="flex:1;"><input type="text" class="injury-notes" placeholder="Notes (optional)"></div>' +
          '<button type="button" class="onboard-remove-btn" style="align-self:center;">Remove</button>' +
        '</div>';
      row.querySelector('.onboard-remove-btn').addEventListener('click', function () {
        row.remove();
      });
      document.getElementById('injuryList').appendChild(row);
    });
  }

  // ── Event date toggle ──
  var goalTimelineEl = document.getElementById('goalTimeline');
  if (goalTimelineEl) {
    goalTimelineEl.addEventListener('change', function () {
      var eventFields = document.getElementById('eventFields');
      eventFields.style.display = this.value === 'event-date' ? '' : 'none';
    });
  }

  // ── Step 3: Extended questionnaire ──
  var step3Btn = document.getElementById('step3Btn');
  step3Btn.addEventListener('click', async function () {
    hideError();

    var wakeTime = document.getElementById('wakeTime').value;
    var bedTime = document.getElementById('bedTime').value;
    var mealsPerDay = document.getElementById('mealsPerDay').value;

    if (!wakeTime || !bedTime) { showError('Please set your wake and bed times.'); return; }
    if (!mealsPerDay || parseInt(mealsPerDay, 10) < 1 || parseInt(mealsPerDay, 10) > 10) { showError('Please select a valid number of meals per day.'); return; }
    if (!document.getElementById('hydrationLevel').value) { showError('Please select your hydration level.'); return; }

    // Collect recovery practices
    var recoveryPractices = [];
    document.querySelectorAll('#recoveryPractices .onboard-checkbox.checked').forEach(function (cb) {
      recoveryPractices.push(cb.getAttribute('data-value'));
    });
    if (recoveryPractices.length === 0) recoveryPractices = ['none'];

    // Collect injuries
    var injuries = [];
    document.querySelectorAll('.onboard-injury-row').forEach(function (row) {
      var area = row.querySelector('.injury-area').value.trim();
      if (area) {
        injuries.push({
          area: area,
          severity: row.querySelector('.injury-severity').value,
          notes: row.querySelector('.injury-notes').value.trim() || undefined
        });
      }
    });

    // Height conversion: ft + in → total inches
    var heightFt = document.getElementById('heightFt').value;
    var heightIn = document.getElementById('heightIn').value;
    var heightInches = (heightFt && heightIn !== '') ? (parseInt(heightFt, 10) * 12 + parseInt(heightIn, 10)) : undefined;

    // Helper for optional selects
    function optVal(id) { var v = document.getElementById(id).value; return v || undefined; }
    function optInt(id) { var v = document.getElementById(id).value; return v ? parseInt(v, 10) : undefined; }
    function optFloat(id) { var v = document.getElementById(id).value; return v ? parseFloat(v) : undefined; }
    function optText(id) { var v = document.getElementById(id).value.trim(); return v || undefined; }

    // Previous PT radio
    var ptRadio = document.querySelector('input[name="previousPT"]:checked');
    var previousPT = ptRadio ? ptRadio.value === 'true' : undefined;

    var payload = {
      // Existing fields
      wakeTime: wakeTime,
      bedTime: bedTime,
      mealsPerDay: parseInt(document.getElementById('mealsPerDay').value, 10),
      hydrationLevel: document.getElementById('hydrationLevel').value,
      supplementsUsed: optText('supplements'),
      recoveryPractices: recoveryPractices,
      typicalEnergyLevel: parseInt(document.getElementById('energySlider').value, 10),
      typicalSorenessLevel: parseInt(document.getElementById('sorenessSlider').value, 10),
      typicalMoodLevel: parseInt(document.getElementById('moodSlider').value, 10),
      typicalSleepQuality: parseInt(document.getElementById('sleepSlider').value, 10),

      // Physical Profile
      heightInches: heightInches,
      weightLbs: optFloat('weightLbs'),
      bodyFatEstimate: optVal('bodyFatEstimate'),

      // Training Background
      yearsTraining: optInt('yearsTraining'),
      currentProgram: optText('currentProgram'),
      benchPressMax: optVal('benchPressMax'),
      squatMax: optVal('squatMax'),
      deadliftMax: optVal('deadliftMax'),
      cardioBase: optVal('cardioBase'),
      exercisesLoved: optText('exercisesLoved'),
      exercisesHated: optText('exercisesHated'),

      // Lifestyle
      workType: optVal('workType'),
      sessionLength: optInt('sessionLength'),
      dietaryApproach: optVal('dietaryApproach'),
      alcoholFrequency: optVal('alcoholFrequency'),
      caffeineDaily: optVal('caffeineDaily'),

      // Injuries & Health
      specificInjuries: injuries.length > 0 ? injuries : undefined,
      chronicConditions: optText('chronicConditions'),
      medications: optText('medications'),
      previousPT: previousPT,

      // Goal Details
      targetWeight: optFloat('targetWeight'),
      goalTimeline: optVal('goalTimeline'),
      eventDate: optText('eventDate'),
      eventDescription: optText('eventDescription')
    };

    // Remove undefined keys for cleaner JSON
    Object.keys(payload).forEach(function (k) {
      if (payload[k] === undefined) delete payload[k];
    });

    step3Btn.disabled = true;
    step3Btn.textContent = 'Generating your plan...';

    try {
      var res = await apiPost('/api/v1/onboarding/routine', payload);
      if (res.success) {
        // Customize success message based on plan type
        var msgEl = document.getElementById('successMsg');
        if (msgEl && currentTier) {
          var isNutrition = currentTier.indexOf('NUTRITION') === 0;
          if (isNutrition) {
            msgEl.textContent = 'Your personalized nutrition plan is ready. Head to your dashboard to get started.';
          } else {
            msgEl.textContent = 'Your personalized plan has been generated. Your coach will review your profile and activate your account shortly.';
          }
        }
        goToStep(4);
      } else {
        showError('Failed to save routine. Please try again.');
        step3Btn.disabled = false;
        step3Btn.textContent = 'Complete Setup';
      }
    } catch (err) {
      showError(err.message || 'Failed to save routine.');
      step3Btn.disabled = false;
      step3Btn.textContent = 'Complete Setup';
    }
  });

  // ── Step Navigation ──
  function goToStep(step) {
    document.querySelectorAll('.onboard-step').forEach(function (s) { s.classList.remove('active'); });
    var target = document.querySelector('.onboard-step[data-step="' + step + '"]');
    if (target) target.classList.add('active');

    // Update indicators
    document.querySelectorAll('.onboard-step-dot').forEach(function (dot, i) {
      dot.classList.remove('active', 'completed');
      if (i + 1 === step) dot.classList.add('active');
      else if (i + 1 < step) dot.classList.add('completed');
    });
    document.querySelectorAll('.onboard-step-line').forEach(function (line, i) {
      line.classList.toggle('completed', i + 1 < step);
    });

    currentStep = step;
    hideError();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Auto-redirect to dashboard after reaching step 4
    if (step === 4) {
      var redirectNote = document.createElement('p');
      redirectNote.style.cssText = 'color:var(--gray);font-size:0.85rem;margin-top:1rem;text-align:center;';
      redirectNote.textContent = 'Redirecting to your dashboard...';
      if (target) target.querySelector('.onboard-success').appendChild(redirectNote);
      setTimeout(function () { window.location.href = '/dashboard'; }, 2500);
    }
  }

  function showError(msg) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  function hideError() {
    errorEl.style.display = 'none';
  }

  // If no session_id and user is already logged in, skip to step 2
  if (!sessionId && isLoggedIn()) {
    goToStep(2);
  }

  // Dead-end guard: no session_id and not logged in
  if (!sessionId && !isLoggedIn()) {
    showError('No checkout session found. Please complete your assessment and purchase a plan first.');
    document.getElementById('step1').querySelector('.onboard-btn').style.display = 'none';
    var backLink = document.createElement('a');
    backLink.href = 'assessment.html';
    backLink.textContent = 'Go to Assessment';
    backLink.className = 'onboard-btn';
    backLink.style.cssText = 'display:inline-block;text-decoration:none;text-align:center;margin-top:1rem;';
    document.getElementById('step1').querySelector('.onboard-card').appendChild(backLink);
  }
})();
