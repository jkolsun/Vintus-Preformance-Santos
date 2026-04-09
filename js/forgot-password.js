/**
 * Vintus Performance — Forgot Password Page Logic
 */

(function () {
  var form = document.getElementById('forgotForm');
  var errorDiv = document.getElementById('formError');
  var successDiv = document.getElementById('successMsg');
  var submitBtn = document.getElementById('submitBtn');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    var email = document.getElementById('email').value.trim();

    if (!email) {
      showError('Please enter your email address.');
      return;
    }

    // Basic email format validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('Please enter a valid email address.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.login-submit-text').textContent = 'Sending...';

    try {
      await apiPost('/api/v1/auth/forgot-password', { email: email });

      // Always show success (backend never reveals if email exists)
      form.style.display = 'none';
      successDiv.style.display = 'block';
    } catch (err) {
      showError(err.message || 'Something went wrong. Please try again.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.login-submit-text').textContent = 'Send Reset Link';
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
})();
