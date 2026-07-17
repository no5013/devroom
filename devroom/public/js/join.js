(function () {
  'use strict';

  // IMPL-01-7: Read session code (and optional instructor role/token) from URL query params
  var params = new URLSearchParams(window.location.search);
  var sessionCode = params.get('code');
  var roleParam  = params.get('role');
  var tokenParam = params.get('token');

  var errorEl = document.getElementById('error');

  function showError(msg) {
    if (errorEl) {
      errorEl.textContent = msg;
    }
  }

  // IMPL-01-3: renderIdentity sets avatar src and username text, enables enter button
  function renderIdentity(identity) {
    document.getElementById('avatar').src = '/api/avatar/' + identity.avatarSeed;
    document.getElementById('username').textContent = identity.name;
    var btn = document.getElementById('enter-btn');
    btn.disabled = false;
    btn.onclick = function () {
      window.location.href = '/room.html?code=' + sessionCode;
    };
  }

  if (!sessionCode) {
    showError('No session code provided. Please use a valid join link.');
    return;
  }

  // IMPL-01-6: Identity persistence — check sessionStorage for existing identity
  // Skip the cache if the URL is requesting a specific role (e.g. instructor link)
  // that differs from what was previously cached, so role is always applied correctly.
  var stored = sessionStorage.getItem('devroom_identity');
  if (stored) {
    try {
      var cached = JSON.parse(stored);
      var cachedRoleMatches = !roleParam || cached.role === roleParam;
      if (cached && cached.sessionCode === sessionCode && cachedRoleMatches) {
        renderIdentity(cached);
        return;
      }
    } catch (e) {
      // Corrupt cache — fall through to API call
    }
  }

  // Build join URL, forwarding role + token if present (instructor link)
  var joinUrl = '/api/sessions/' + sessionCode + '/join';
  if (roleParam && tokenParam) {
    joinUrl += '?role=' + encodeURIComponent(roleParam) + '&token=' + encodeURIComponent(tokenParam);
  }

  // Call join API to get a new identity
  fetch(joinUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
    .then(function (res) {
      return res.json().then(function (data) {
        if (!res.ok) {
          throw new Error(data.error || 'Failed to join session');
        }
        return data;
      });
    })
    .then(function (result) {
      // Persist identity in sessionStorage
      sessionStorage.setItem(
        'devroom_identity',
        JSON.stringify(Object.assign({}, result, { sessionCode: sessionCode }))
      );
      renderIdentity(result);
    })
    .catch(function (err) {
      showError(err.message);
    });
})();
