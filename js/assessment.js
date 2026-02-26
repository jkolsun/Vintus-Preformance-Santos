/**
 * Vintus Performance — Expanded Assessment Survey (8 Steps)
 * Submits to POST /api/v1/intake/full (expandedIntakeSchema)
 */

(function () {
  var TOTAL_STEPS = 8;
  var currentStep = 1;

  // Collected answers
  var answers = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    occupation: '',
    timezone: 'America/New_York',
    primaryGoal: '',
    secondaryGoals: [],
    trainingDaysPerWeek: 4,
    preferredTrainingTime: '',
    experienceLevel: '',
    equipmentAccess: '',
    injuryHistory: '',
    currentActivity: '',
    sleepSchedule: '',
    stressLevel: 5,
    travelFrequency: '',
    biggestChallenge: ''
  };

  // DOM refs
  var slides = document.querySelectorAll('.assess-slide');
  var steps = document.querySelectorAll('.assess-step');
  var progressBar = document.getElementById('progressBar');
  var backBtn = document.getElementById('assessBack');
  var nextBtn = document.getElementById('assessNext');
  var submitBtn = document.getElementById('assessSubmit');

  // ── Slider live updates ──
  var trainingSlider = document.getElementById('trainingDaysPerWeek');
  var trainingValue = document.getElementById('trainingDaysValue');
  if (trainingSlider) {
    trainingSlider.addEventListener('input', function () {
      trainingValue.textContent = this.value;
      answers.trainingDaysPerWeek = parseInt(this.value, 10);
    });
  }

  var stressSlider = document.getElementById('stressLevel');
  var stressValue = document.getElementById('stressValue');
  if (stressSlider) {
    stressSlider.addEventListener('input', function () {
      stressValue.textContent = this.value;
      answers.stressLevel = parseInt(this.value, 10);
    });
  }

  // ── Option card selection (single-select) ──
  document.querySelectorAll('.assess-options').forEach(function (group) {
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('.assess-option');
      if (!btn) return;

      // Deselect siblings
      group.querySelectorAll('.assess-option').forEach(function (o) { o.classList.remove('selected'); });
      btn.classList.add('selected');

      var field = group.getAttribute('data-field');
      var value = btn.getAttribute('data-value');
      if (field && value) {
        answers[field] = value;
      }
    });
  });

  // ── Multi-select checkboxes ──
  document.querySelectorAll('.assess-checkbox').forEach(function (cb) {
    cb.addEventListener('click', function () {
      cb.classList.toggle('checked');
      updateSecondaryGoals();
    });
  });

  function updateSecondaryGoals() {
    var checked = document.querySelectorAll('#secondaryGoals .assess-checkbox.checked');
    answers.secondaryGoals = [];
    checked.forEach(function (c) {
      answers.secondaryGoals.push(c.getAttribute('data-value'));
    });
  }

  // ── Navigation ──
  backBtn.addEventListener('click', function () {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  nextBtn.addEventListener('click', function () {
    if (!validateStep(currentStep)) return;
    collectStepData(currentStep);
    if (currentStep < TOTAL_STEPS) goToStep(currentStep + 1);
  });

  submitBtn.addEventListener('click', async function () {
    if (!validateStep(currentStep)) return;
    collectStepData(currentStep);
    await submitAssessment();
  });

  function goToStep(step) {
    // Hide current
    slides[currentStep - 1].classList.remove('active');
    // Show next
    slides[step - 1].classList.add('active');

    currentStep = step;
    updateProgress();
    updateButtons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgress() {
    var pct = ((currentStep - 1) / (TOTAL_STEPS - 1)) * 100;
    progressBar.style.width = pct + '%';

    steps.forEach(function (s, i) {
      s.classList.remove('active', 'completed');
      if (i + 1 === currentStep) s.classList.add('active');
      else if (i + 1 < currentStep) s.classList.add('completed');
    });
  }

  function updateButtons() {
    backBtn.style.visibility = currentStep === 1 ? 'hidden' : 'visible';
    if (currentStep === TOTAL_STEPS) {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'block';
    } else {
      nextBtn.style.display = 'block';
      submitBtn.style.display = 'none';
    }
  }

  // ── Validation per step ──
  function validateStep(step) {
    switch (step) {
      case 1:
        var fn = document.getElementById('firstName').value.trim();
        var ln = document.getElementById('lastName').value.trim();
        var em = document.getElementById('email').value.trim();
        if (!fn || !ln || !em) { alert('Please fill in your name and email.'); return false; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { alert('Please enter a valid email address.'); return false; }
        return true;
      case 2:
        return true; // All optional
      case 3:
        if (!answers.primaryGoal) { alert('Please select your primary goal.'); return false; }
        return true;
      case 4:
        if (!answers.experienceLevel) { alert('Please select your experience level.'); return false; }
        return true;
      case 5:
        if (!answers.equipmentAccess) { alert('Please select your equipment access.'); return false; }
        return true;
      case 6:
        return true; // All optional
      case 7:
        return true; // All optional
      case 8:
        return true; // All optional
      default:
        return true;
    }
  }

  // ── Collect data from current step ──
  function collectStepData(step) {
    switch (step) {
      case 1:
        answers.firstName = document.getElementById('firstName').value.trim();
        answers.lastName = document.getElementById('lastName').value.trim();
        answers.email = document.getElementById('email').value.trim();
        answers.phone = document.getElementById('phone').value.trim();
        break;
      case 2:
        answers.dateOfBirth = document.getElementById('dateOfBirth').value || '';
        answers.occupation = document.getElementById('occupation').value.trim();
        answers.timezone = document.getElementById('timezone').value;
        break;
      // Steps 3, 4, 5 — handled by click handlers (answers.primaryGoal, etc.)
      case 6:
        answers.injuryHistory = document.getElementById('injuryHistory').value.trim();
        answers.currentActivity = document.getElementById('currentActivity').value.trim();
        break;
      case 7:
        answers.sleepSchedule = document.getElementById('sleepSchedule').value.trim();
        // stressLevel and secondaryGoals handled by slider/checkbox handlers
        break;
      case 8:
        answers.biggestChallenge = document.getElementById('biggestChallenge').value.trim();
        // travelFrequency handled by click handler
        break;
    }
  }

  // ── Submit to backend ──
  async function submitAssessment() {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    // Build payload matching expandedIntakeSchema exactly
    var payload = {
      firstName: answers.firstName,
      lastName: answers.lastName,
      email: answers.email,
      primaryGoal: answers.primaryGoal,
      trainingDaysPerWeek: answers.trainingDaysPerWeek,
      experienceLevel: answers.experienceLevel,
      equipmentAccess: answers.equipmentAccess
    };

    // Optional fields — only include if provided
    if (answers.phone) payload.phone = answers.phone;
    if (answers.dateOfBirth) payload.dateOfBirth = answers.dateOfBirth;
    if (answers.occupation) payload.occupation = answers.occupation;
    if (answers.timezone) payload.timezone = answers.timezone;
    if (answers.secondaryGoals.length) payload.secondaryGoals = answers.secondaryGoals;
    if (answers.preferredTrainingTime) payload.preferredTrainingTime = answers.preferredTrainingTime;
    if (answers.currentActivity) payload.currentActivity = answers.currentActivity;
    if (answers.injuryHistory) payload.injuryHistory = answers.injuryHistory;
    if (answers.sleepSchedule) payload.sleepSchedule = answers.sleepSchedule;
    if (answers.stressLevel) payload.stressLevel = answers.stressLevel;
    if (answers.travelFrequency) payload.travelFrequency = answers.travelFrequency;
    if (answers.biggestChallenge) payload.biggestChallenge = answers.biggestChallenge;

    try {
      var res = await apiPost('/api/v1/intake/full', payload);

      if (res.success && res.data && res.data.profileId) {
        window.location.href = 'results.html?id=' + res.data.profileId;
      } else {
        alert('Submission succeeded but no profile ID was returned. Please contact support.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Assessment';
      }
    } catch (err) {
      alert(err.message || 'Submission failed. Please try again.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Assessment';
    }
  }

  // Init
  updateProgress();
  updateButtons();
})();
