/**
 * Vintus Performance — Login Page Logic
 */

(function () {
  // If already logged in, redirect to dashboard
  if (isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return;
  }

  var form = document.getElementById('loginForm');
  var errorDiv = document.getElementById('loginError');
  var submitBtn = document.getElementById('loginSubmit');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorDiv.style.display = 'none';

    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;

    if (!email || !password) {
      showError('Please enter both email and password.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.login-submit-text').textContent = 'Signing in...';

    try {
      var res = await apiPost('/api/v1/auth/login', { email: email, password: password });

      if (res.success && res.data && res.data.token) {
        setToken(res.data.token);
        window.location.href = 'dashboard.html';
      } else {
        showError('Login failed. Please check your credentials.');
      }
    } catch (err) {
      showError(err.message || 'Login failed. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.login-submit-text').textContent = 'Sign In';
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
})();
