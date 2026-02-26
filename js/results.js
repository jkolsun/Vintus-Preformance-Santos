/**
 * Vintus Performance — Results Page
 * Fetches AI summary from /api/v1/intake/results/:profileId
 * Handles plan selection → Stripe Checkout
 */

(function () {
  var params = new URLSearchParams(window.location.search);
  var profileId = params.get('id');

  var loadingEl = document.getElementById('resultsLoading');
  var errorEl = document.getElementById('resultsError');
  var errorMsg = document.getElementById('resultsErrorMsg');
  var contentEl = document.getElementById('resultsContent');

  if (!profileId) {
    showError('No assessment ID found. Please complete the assessment first.');
    return;
  }

  loadResults();

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

  // ── Plan selection → Stripe Checkout ──
  document.querySelectorAll('.plan-select').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      var tier = this.getAttribute('data-tier');
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
