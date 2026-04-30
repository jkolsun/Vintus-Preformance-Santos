/**
 * Vintus Performance — Settings Page Logic
 */

(function () {
  // Require auth — redirect to login if not logged in
  if (!isLoggedIn()) {
    window.location.href = '/login';
    return;
  }

  var loadingEl = document.getElementById('settingsLoading');
  var contentEl = document.getElementById('settingsContent');

  // Profile form elements
  var profileForm = document.getElementById('profileForm');
  var profileBtn = document.getElementById('profileBtn');
  var profileBtnText = document.getElementById('profileBtnText');
  var profileSuccess = document.getElementById('profileSuccess');
  var profileError = document.getElementById('profileError');

  // Password form elements
  var passwordForm = document.getElementById('passwordForm');
  var passwordBtn = document.getElementById('passwordBtn');
  var passwordBtnText = document.getElementById('passwordBtnText');
  var passwordSuccess = document.getElementById('passwordSuccess');
  var passwordError = document.getElementById('passwordError');

  // Subscription elements
  var subscriptionCard = document.getElementById('subscriptionCard');
  var subTier = document.getElementById('subTier');
  var subStatus = document.getElementById('subStatus');
  var subPeriodEnd = document.getElementById('subPeriodEnd');
  var manageSubBtn = document.getElementById('manageSubBtn');
  var manageSubBtnText = document.getElementById('manageSubBtnText');
  var subError = document.getElementById('subError');

  // ── Load user data ──
  loadUserData();

  async function loadUserData() {
    try {
      var res = await apiGet('/api/v1/auth/me');
      var user = res.data.user;

      // Populate profile fields
      var profile = user.athleteProfile || {};
      document.getElementById('firstName').value = profile.firstName || '';
      document.getElementById('lastName').value = profile.lastName || '';
      document.getElementById('phone').value = profile.phone || '';
      document.getElementById('email').value = user.email || '';

      // Set timezone dropdown
      var tzSelect = document.getElementById('timezone');
      var tz = profile.timezone || 'America/New_York';
      for (var i = 0; i < tzSelect.options.length; i++) {
        if (tzSelect.options[i].value === tz) {
          tzSelect.selectedIndex = i;
          break;
        }
      }

      // Populate subscription info
      var sub = user.subscription;
      subscriptionCard.style.display = 'block';
      if (sub) {

        // Tier display name
        var tierNames = {
          'DIY_DIGITAL': 'DIY Digital',
          'GUIDED_COACHING': 'Guided Coaching',
          'PRIVATE_COACHING': 'Private Coaching'
        };
        subTier.textContent = tierNames[sub.planTier] || sub.planTier || '--';

        // Status badge
        var statusLower = (sub.status || '').toLowerCase();
        var badgeClass = 'settings-badge--default';
        if (statusLower === 'active') badgeClass = 'settings-badge--active';
        else if (statusLower === 'trialing') badgeClass = 'settings-badge--trialing';
        else if (statusLower === 'canceled' || statusLower === 'past_due') badgeClass = 'settings-badge--' + statusLower;

        subStatus.innerHTML = '<span class="settings-badge ' + badgeClass + '">' + (sub.status || '--') + '</span>';

        // Period end date
        if (sub.currentPeriodEnd) {
          var d = new Date(sub.currentPeriodEnd);
          subPeriodEnd.textContent = d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });
        } else {
          subPeriodEnd.textContent = '--';
        }

        // Show manage button only for PRIVATE_COACHING
        if (sub.planTier === 'PRIVATE_COACHING') {
          manageSubBtn.style.display = 'block';
        }
      } else {
        // No subscription — show empty state
        subTier.textContent = 'No active plan';
        subStatus.innerHTML = '<span class="settings-badge settings-badge--default">None</span>';
        subPeriodEnd.textContent = '--';
      }

      // Show content, hide loading
      loadingEl.style.display = 'none';
      contentEl.style.display = 'block';
    } catch (err) {
      loadingEl.innerHTML = 'Failed to load settings. <a href="#" onclick="window.location.reload();return false;" style="color:var(--silver);text-decoration:underline;">Retry</a>';
    }
  }

  // ── Profile form submit ──
  profileForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    profileSuccess.style.display = 'none';
    profileError.style.display = 'none';

    var firstName = document.getElementById('firstName').value.trim();
    var lastName = document.getElementById('lastName').value.trim();
    var phone = document.getElementById('phone').value.trim() || null;
    var timezone = document.getElementById('timezone').value;

    if (!firstName || !lastName) {
      showMsg(profileError, 'First and last name are required.');
      return;
    }

    profileBtn.disabled = true;
    profileBtnText.textContent = 'Saving...';

    try {
      await apiPut('/api/v1/profile', {
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        timezone: timezone
      });

      showMsg(profileSuccess, 'Profile updated successfully.');
    } catch (err) {
      showMsg(profileError, err.message || 'Failed to update profile.');
    } finally {
      profileBtn.disabled = false;
      profileBtnText.textContent = 'Save Changes';
    }
  });

  // ── Password form submit ──
  passwordForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    passwordSuccess.style.display = 'none';
    passwordError.style.display = 'none';

    var oldPassword = document.getElementById('oldPassword').value;
    var newPassword = document.getElementById('newPassword').value;
    var confirmNewPassword = document.getElementById('confirmNewPassword').value;

    if (!oldPassword || !newPassword || !confirmNewPassword) {
      showMsg(passwordError, 'Please fill in all password fields.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      showMsg(passwordError, 'New passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      showMsg(passwordError, 'Password must be at least 8 characters.');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      showMsg(passwordError, 'Password must contain at least 1 uppercase letter.');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      showMsg(passwordError, 'Password must contain at least 1 number.');
      return;
    }

    passwordBtn.disabled = true;
    passwordBtnText.textContent = 'Updating...';

    try {
      await apiPut('/api/v1/auth/password', {
        oldPassword: oldPassword,
        newPassword: newPassword
      });

      showMsg(passwordSuccess, 'Password updated. Redirecting to login...');
      passwordForm.style.display = 'none';

      // Clear auth and redirect after 2 seconds
      setTimeout(function () {
        clearToken();
        localStorage.removeItem('vintus_role');
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      showMsg(passwordError, err.message || 'Failed to update password.');
      passwordBtn.disabled = false;
      passwordBtnText.textContent = 'Update Password';
    }
  });

  // ── Manage Subscription button ──
  manageSubBtn.addEventListener('click', async function () {
    subError.style.display = 'none';
    manageSubBtn.disabled = true;
    manageSubBtnText.textContent = 'Loading...';

    try {
      var res = await apiPost('/api/v1/checkout/portal');
      if (res.data && res.data.url) {
        window.location.href = res.data.url;
      } else {
        showMsg(subError, 'Could not open billing portal.');
      }
    } catch (err) {
      showMsg(subError, err.message || 'Failed to open billing portal.');
    } finally {
      manageSubBtn.disabled = false;
      manageSubBtnText.textContent = 'Manage Subscription';
    }
  });

  // ── Helper: show message ──
  function showMsg(el, msg) {
    el.textContent = msg;
    el.style.display = 'block';
  }
})();
