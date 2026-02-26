/**
 * Vintus Performance — Results Page
 * Two modes:
 *   1. Full assessment: ?id=profileId → fetch AI summary from backend
 *   2. Quick quiz:      ?source=quiz  → generate summary from localStorage quiz data
 * Handles plan selection → Stripe Checkout (authenticated) or redirect (unauthenticated)
 */

(function () {
  var params = new URLSearchParams(window.location.search);
  var profileId = params.get('id');
  var source = params.get('source');

  var loadingEl = document.getElementById('resultsLoading');
  var errorEl = document.getElementById('resultsError');
  var errorMsg = document.getElementById('resultsErrorMsg');
  var contentEl = document.getElementById('resultsContent');

  // Quick quiz flow — no profileId needed
  if (source === 'quiz') {
    renderQuizResults();
  } else if (profileId) {
    loadResults();
  } else {
    showError('No assessment ID found. Please complete the assessment first.');
  }

  // ── Full assessment: fetch from backend ──
  async function loadResults() {
    try {
      var res = await apiGet('/api/v1/intake/results/' + profileId);

      if (!res.success || !res.data) {
        showError('Unable to load your results. Please try again.');
        return;
      }

      renderResults(res.data);
    } catch (err) {
      showError(err.message || 'Failed to load results.');
    }
  }

  function renderResults(data) {
    // AI Summary
    var summaryEl = document.getElementById('aiSummaryText');
    summaryEl.textContent = data.summary || 'Your personalized analysis is being generated. Check back shortly.';

    // Persona badge
    if (data.persona) {
      var badge = document.getElementById('personaBadge');
      var label = data.persona.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      badge.textContent = label;
      badge.style.display = 'inline-flex';
    }

    // Risk flags
    if (data.riskFlags && data.riskFlags.length > 0) {
      var flagsEl = document.getElementById('riskFlags');
      data.riskFlags.forEach(function (flag) {
        var div = document.createElement('div');
        div.className = 'results-flag';
        div.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
          '<span>' + escapeHtml(flag) + '</span>';
        flagsEl.appendChild(div);
      });
      flagsEl.style.display = 'flex';
    }

    // Show content, hide loading
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  }

  // ── Quick quiz: generate summary from localStorage data ──
  function renderQuizResults() {
    var quizRaw = localStorage.getItem('vintusQuizData');
    var quiz = quizRaw ? JSON.parse(quizRaw) : {};

    var goalMap = {
      'build-muscle': 'building muscle and gaining strength',
      'lose-fat': 'losing fat and getting lean',
      'improve-endurance': 'improving endurance and stamina',
      'overall-health': 'improving overall health and wellness'
    };
    var experienceMap = {
      'beginner': 'someone new to structured training',
      'intermediate': 'someone with 1-3 years of training experience',
      'advanced': 'an experienced athlete ready for elite-level programming'
    };
    var challengeMap = {
      'consistency': 'staying consistent with your routine',
      'nutrition': 'dialing in your nutrition',
      'motivation': 'maintaining motivation',
      'time': 'finding time in your busy schedule'
    };
    var daysMap = {
      '2-3': '2-3 days per week',
      '4-5': '4-5 days per week',
      '6+': '6+ days per week'
    };

    var firstName = quiz.first_name || 'There';
    var goal = goalMap[quiz.primary_goal] || 'achieving your fitness goals';
    var exp = experienceMap[quiz.experience] || 'someone looking to level up';
    var days = daysMap[quiz.training_days] || 'your available schedule';
    var challenge = challengeMap[quiz.challenge] || 'overcoming obstacles';

    var summary = firstName + ', based on your responses, your primary focus is ' + goal + '. ' +
      'As ' + exp + ', you\'re ready for a program that matches your current abilities while progressively challenging you. ' +
      'With ' + days + ', we can design an efficient program that maximizes every session. ' +
      'Your biggest challenge — ' + challenge + ' — is something we address directly in our coaching methodology.';

    var summaryEl = document.getElementById('aiSummaryText');
    summaryEl.textContent = summary;

    // Hide persona badge and risk flags for quiz flow
    var badge = document.getElementById('personaBadge');
    if (badge) badge.style.display = 'none';

    // Show content, hide loading
    loadingEl.style.display = 'none';
    contentEl.style.display = 'block';
  }

  // ── Plan selection ──
  document.querySelectorAll('.plan-select').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var tier = this.getAttribute('data-tier');

      // Private Coaching → book a consultation call
      if (tier === 'PRIVATE_COACHING') {
        window.location.href = 'book.html';
        return;
      }

      // For authenticated users with a profileId → Stripe Checkout
      if (profileId && isLoggedIn()) {
        btn.disabled = true;
        btn.textContent = 'Processing...';

        try {
          var res = await apiPost('/api/v1/checkout/session', {
            tier: tier,
            profileId: profileId,
            successUrl: window.location.origin + '/onboarding.html',
            cancelUrl: window.location.href
          });

          if (res.success && res.data && res.data.url) {
            window.location.href = res.data.url;
          } else {
            alert('Unable to start checkout. Please try again.');
            btn.disabled = false;
            btn.textContent = 'Select Plan';
          }
        } catch (err) {
          alert(err.message || 'Checkout failed. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Select Plan';
        }
        return;
      }

      // Unauthenticated users → go to assessment to create full profile
      localStorage.setItem('vintus_selected_tier', tier);
      window.location.href = 'assessment.html';
    });
  });

  function showError(msg) {
    loadingEl.style.display = 'none';
    errorMsg.textContent = msg;
    errorEl.style.display = 'block';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
