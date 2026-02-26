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

      // Set password
      var pwRes = await apiPost('/api/v1/onboarding/set-password', { userId: userId, sessionId: sessionId, password: pw });
      if (pwRes.success && pwRes.data && pwRes.data.token) {
        setToken(pwRes.data.token);
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

  // ── Step 3: Routine questionnaire ──
  var step3Btn = document.getElementById('step3Btn');
  step3Btn.addEventListener('click', async function () {
    hideError();

    var wakeTime = document.getElementById('wakeTime').value;
    var bedTime = document.getElementById('bedTime').value;

    if (!wakeTime || !bedTime) { showError('Please set your wake and bed times.'); return; }

    // Collect recovery practices
    var recoveryPractices = [];
    document.querySelectorAll('#recoveryPractices .onboard-checkbox.checked').forEach(function (cb) {
      recoveryPractices.push(cb.getAttribute('data-value'));
    });
    if (recoveryPractices.length === 0) recoveryPractices = ['none'];

    var payload = {
      wakeTime: wakeTime,
      bedTime: bedTime,
      mealsPerDay: parseInt(document.getElementById('mealsPerDay').value, 10),
      hydrationLevel: document.getElementById('hydrationLevel').value,
      supplementsUsed: document.getElementById('supplements').value.trim() || undefined,
      recoveryPractices: recoveryPractices,
      typicalEnergyLevel: parseInt(document.getElementById('energySlider').value, 10),
      typicalSorenessLevel: parseInt(document.getElementById('sorenessSlider').value, 10),
      typicalMoodLevel: parseInt(document.getElementById('moodSlider').value, 10),
      typicalSleepQuality: parseInt(document.getElementById('sleepSlider').value, 10)
    };

    step3Btn.disabled = true;
    step3Btn.textContent = 'Generating your plan...';

    try {
      var res = await apiPost('/api/v1/onboarding/routine', payload);
      if (res.success) {
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
})();
