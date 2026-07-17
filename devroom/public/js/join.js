(function () {
  'use strict';

  // IMPL-01-7: Read session code from URL query param
  var params = new URLSearchParams(window.location.search);
  var sessionCode = params.get('code');

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
  var stored = sessionStorage.getItem('devroom_identity');
  if (stored) {
    try {
      var cached = JSON.parse(stored);
      if (cached && cached.sessionCode === sessionCode) {
        renderIdentity(cached);
        return;
      }
    } catch (e) {
      // Corrupt cache — fall through to API call
    }
  }

  // Call join API to get a new identity
  fetch('/api/sessions/' + sessionCode + '/join', {
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
