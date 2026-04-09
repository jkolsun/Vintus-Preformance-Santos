/**
 * Vintus Performance — Reset Password Page Logic
 */

(function () {
  var form = document.getElementById('resetForm');
  var errorDiv = document.getElementById('formError');
  var successDiv = document.getElementById('successMsg');
  var submitBtn = document.getElementById('submitBtn');

  // Extract token from URL query string
  var params = new URLSearchParams(window.location.search);
  var token = params.get('token');

  if (!token) {
    form.style.display = 'none';
    errorDiv.textContent = 'Invalid or missing reset link. Please request a new one.';
    errorDiv.style.display = 'block';
    return;
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';

    var newPassword = document.getElementById('newPassword').value;
    var confirmPassword = document.getElementById('confirmPassword').value;

    if (!newPassword || !confirmPassword) {
      showError('Please fill in both password fields.');
      return;
    }

    if (newPassword !== confirmPassword) {
      showError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      showError('Password must be at least 8 characters.');
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      showError('Password must contain at least 1 uppercase letter.');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      showError('Password must contain at least 1 number.');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.login-submit-text').textContent = 'Resetting...';

    try {
      await apiPost('/api/v1/auth/reset-password', {
        token: token,
        newPassword: newPassword
      });

      form.style.display = 'none';
      successDiv.style.display = 'block';

      // Redirect to login after 2 seconds
      setTimeout(function () {
        window.location.href = 'login.html';
      }, 2000);
    } catch (err) {
      showError(err.message || 'Reset failed. The link may have expired.');
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.login-submit-text').textContent = 'Reset Password';
    }
  });

  function showError(msg) {
    errorDiv.textContent = msg;
    errorDiv.style.display = 'block';
  }
})();
