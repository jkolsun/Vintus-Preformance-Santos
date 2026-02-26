/**
 * Vintus Performance — Navigation Auth Enhancement
 * Runs on every page. Adds Login/Portal links to nav based on auth state.
 * Does NOT modify existing HTML files — only manipulates DOM after load.
 */

(function () {
  document.addEventListener('DOMContentLoaded', function () {
    var loggedIn = !!localStorage.getItem('vintus_token');

    // ── Desktop Nav ──
    var navLinks = document.querySelector('ul.nav-links');
    if (navLinks) {
      var li = document.createElement('li');
      var a = document.createElement('a');

      if (loggedIn) {
        a.href = 'dashboard.html';
        a.textContent = 'Portal';
      } else {
        a.href = 'login.html';
        a.textContent = 'Login';
      }

      // Highlight if on that page
      if (window.location.pathname.includes(a.href.split('/').pop())) {
        a.classList.add('active');
      }

      li.appendChild(a);
      navLinks.appendChild(li);
    }

    // ── Mobile Nav ──
    var mobileNav = document.getElementById('mobileNav');
    if (mobileNav) {
      // Insert before the social links div
      var socialDiv = mobileNav.querySelector('.mobile-social');
      var mobileLink = document.createElement('a');

      if (loggedIn) {
        mobileLink.href = 'dashboard.html';
        mobileLink.textContent = 'Portal';
      } else {
        mobileLink.href = 'login.html';
        mobileLink.textContent = 'Login';
      }

      if (socialDiv) {
        mobileNav.insertBefore(mobileLink, socialDiv);
      } else {
        mobileNav.appendChild(mobileLink);
      }
    }

    // ── If logged in, swap "Free Consultation" CTA with "My Dashboard" ──
    if (loggedIn) {
      var navCta = document.querySelector('.nav-cta');
      if (navCta) {
        navCta.href = 'dashboard.html';
        navCta.textContent = 'My Dashboard';
      }
    }
  });
})();
