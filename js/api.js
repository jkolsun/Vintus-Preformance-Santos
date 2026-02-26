/**
 * Vintus Performance — API Utility Module
 * Provides authenticated fetch wrappers for all backend calls.
 */

const API_BASE = (window.VINTUS_CONFIG && window.VINTUS_CONFIG.API_URL) || 'http://localhost:4000';

/* ── Token Management ── */

function getToken() {
  return localStorage.getItem('vintus_token');
}

function setToken(token) {
  localStorage.setItem('vintus_token', token);
}

function clearToken() {
  localStorage.removeItem('vintus_token');
}

function isLoggedIn() {
  return !!getToken();
}

/* ── Core Fetch Wrapper ── */

async function apiFetch(path, options) {
  var url = API_BASE + path;
  var headers = options.headers || {};
  headers['Accept'] = 'application/json';

  var token = getToken();
  if (token) {
    headers['Authorization'] = 'Bearer ' + token;
  }

  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  options.headers = headers;

  var res;
  try {
    res = await fetch(url, options);
  } catch (err) {
    throw new Error('Network error. Please check your connection.');
  }

  // 401 → clear token and redirect to login
  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = 'login.html';
    }
    throw new Error('Session expired. Please log in again.');
  }

  var data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('Invalid response from server.');
  }

  if (!res.ok) {
    var message = (data && data.error) || ('Request failed with status ' + res.status);
    var error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

/* ── HTTP Method Helpers ── */

function apiGet(path) {
  return apiFetch(path, { method: 'GET' });
}

function apiPost(path, body) {
  return apiFetch(path, { method: 'POST', body: body || undefined });
}

function apiPut(path, body) {
  return apiFetch(path, { method: 'PUT', body: body || undefined });
}

function apiDelete(path) {
  return apiFetch(path, { method: 'DELETE' });
}
