(function () {
  'use strict';

  // ── Bootstrap identity from sessionStorage ──────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var sessionCode = params.get('code');
  var identity = null;
  try {
    var raw = sessionStorage.getItem('devroom_identity');
    if (raw) identity = JSON.parse(raw);
  } catch(e) {}

  if (!sessionCode || !identity || identity.sessionCode !== sessionCode) {
    window.location.href = '/join?code=' + (sessionCode || '');
    return;
  }

  // ── Socket.io connection ─────────────────────────────────────────────────
  var socket = io();
  var messagesEl = document.getElementById('messages');
  var inputEl = document.getElementById('chat-input');
  var sendBtn = document.getElementById('send-btn');
  var scrollBtn = document.getElementById('scroll-bottom-btn');
  var participantsList = document.getElementById('participants-list');
  var participants = {};   // participantId → { name, avatarSeed, role }

  socket.on('connect', function () {
    sendBtn.disabled = false;
    socket.emit('chat:join', {
      sessionCode: identity.sessionCode,
      participantId: identity.participantId,
      token: identity.token
    });
  });

  socket.on('disconnect', function () { sendBtn.disabled = true; });

  // ── Presence ─────────────────────────────────────────────────────────────
  socket.on('presence:list', function (list) {
    list.forEach(addParticipant);
  });

  socket.on('presence:join', function (p) { addParticipant(p); });

  socket.on('presence:leave', function (ev) {
    delete participants[ev.participantId];
    renderParticipantList();
  });

  function addParticipant(p) {
    participants[p.participantId] = p;
    renderParticipantList();
  }

  function renderParticipantList() {
    participantsList.innerHTML = '';
    Object.values(participants).forEach(function (p) {
      var li = document.createElement('li');
      li.className = 'participant-item';
      li.dataset.participantId = p.participantId;
      var img = document.createElement('img');
      img.src = '/api/avatar/' + p.avatarSeed;
      img.width = 24; img.height = 24;
      var span = document.createElement('span');
      span.textContent = p.name;
      li.appendChild(img);
      li.appendChild(span);
      participantsList.appendChild(li);
    });
    // Update participant count in instructor panel
    var count = Object.keys(participants).length;
    var countEl = document.getElementById('participant-count');
    if (countEl) countEl.textContent = count + ' online';
  }

  // ── Auto-scroll ───────────────────────────────────────────────────────────
  function isNearBottom() {
    return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 80;
  }

  messagesEl.addEventListener('scroll', function () {
    scrollBtn.hidden = isNearBottom();
  });

  scrollBtn.addEventListener('click', function () {
    messagesEl.scrollTop = messagesEl.scrollHeight;
    scrollBtn.hidden = true;
  });

  // ── Render a message ─────────────────────────────────────────────────────
  function renderMessage(msg) {
    var wasNearBottom = isNearBottom();

    var div = document.createElement('div');
    div.className = 'message' + (msg.role === 'instructor' ? ' instructor' : '');
    div.dataset.messageId = msg.id;

    var img = document.createElement('img');
    img.className = 'message-avatar';
    img.src = '/api/avatar/' + msg.avatarSeed;
    img.width = 36; img.height = 36;

    var right = document.createElement('div');
    right.className = 'message-right';

    var header = document.createElement('div');
    header.className = 'message-header';

    var author = document.createElement('span');
    author.className = 'message-author';
    author.textContent = msg.authorName;

    header.appendChild(author);

    if (msg.role === 'instructor') {
      var badge = document.createElement('span');
      badge.className = 'instructor-badge';
      badge.textContent = 'Instructor';
      header.appendChild(badge);
    }

    var textEl = document.createElement('div');
    textEl.className = 'message-text';
    textEl.innerHTML = parseMessage(msg.text);

    // Run highlight.js on any code blocks
    textEl.querySelectorAll('pre code').forEach(function (block) {
      hljs.highlightElement(block);
    });

    right.appendChild(header);
    right.appendChild(textEl);
    div.appendChild(img);
    div.appendChild(right);
    messagesEl.appendChild(div);

    if (wasNearBottom) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
      scrollBtn.hidden = true;
    } else {
      scrollBtn.hidden = false;
    }
  }

  // ── Triple-backtick parser ────────────────────────────────────────────────
  function parseMessage(text) {
    // Replace ```lang\ncode\n``` with <pre><code class="language-lang">code</code></pre>
    // Then escape remaining HTML and convert newlines to <br>
    var parts = [];
    var fenceRe = /```(\w*)\n?([\s\S]*?)```/g;
    var lastIndex = 0;
    var match;
    while ((match = fenceRe.exec(text)) !== null) {
      // Plain text before this fence
      if (match.index > lastIndex) {
        parts.push('<span class="plain">' + escapeHtml(text.slice(lastIndex, match.index)) + '</span>');
      }
      var lang = match[1] || 'plaintext';
      parts.push('<pre><code class="language-' + lang + '">' + escapeHtml(match[2]) + '</code></pre>');
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push('<span class="plain">' + escapeHtml(text.slice(lastIndex)) + '</span>');
    }
    // Convert \n to <br> in plain spans
    return parts.join('').replace(/<span class="plain">([\s\S]*?)<\/span>/g, function(_, t) {
      return '<span class="plain">' + t.replace(/\n/g, '<br>') + '</span>';
    });
  }

  function escapeHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Incoming messages ─────────────────────────────────────────────────────
  socket.on('chat:message', function (msg) {
    renderMessage(msg);
    // Fun effect: floating emoji particles for 🎉 (receiver side)
    if (msg.text.includes('🎉') && msg.authorName !== identity.name) {
      launchEmojiParticles();
    }
  });

  // ── Send ──────────────────────────────────────────────────────────────────
  document.getElementById('chat-form').addEventListener('submit', function (e) {
    e.preventDefault();
    sendMessage();
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // Shift+Enter: default behaviour (inserts newline) — do nothing
  });

  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || sendBtn.disabled) return;
    if (inputEl.value.trimStart().startsWith('/')) {
      handleSlashCommand(inputEl.value.trim());
      return;
    }
    socket.emit('chat:send', { text: inputEl.value });
    // Confetti for sender on 🎉
    if (inputEl.value.includes('🎉')) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.7 } });
    }
    inputEl.value = '';
    inputEl.style.height = 'auto';
  }

  // ── Floating emoji particles (receiver) ───────────────────────────────────
  function launchEmojiParticles() {
    // Simple confetti burst in green
    confetti({ particleCount: 60, spread: 60, colors: ['#3fb950', '#f0883e', '#58a6ff'], origin: { y: 0.6 } });
  }

  // ── Session info ──────────────────────────────────────────────────────────
  socket.on('session:info', function (info) {
    document.getElementById('session-name').textContent = '> ' + info.sessionName;
    if (identity.role === 'instructor') {
      document.getElementById('instructor-panel').style.display = 'block';
      window._instructorToken = info.instructorToken;
      window._sessionId = info.sessionId;
      loadPollHistory();
    }
  });

  // US-08 removed: #create-poll-btn click listener (poll drawer toggle)
  // US-08 removed: #cancel-poll-btn click listener
  // US-08 removed: #add-option-btn click listener
  // US-08 removed: #submit-poll-btn click listener

  // ── Incoming poll events ──────────────────────────────────────────────────
  // Per-option personal click counters for the current poll
  var personalCounts = {};   // optionId → number
  var aggregateTotals = {};  // optionId → number (from server)
  var pollClosed = false;
  var currentPollId = null;

  function renderBars(containerId, totals, options, voterCount) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var totalVotes = Object.values(totals).reduce(function(s, v) { return s + v; }, 0);
    container.innerHTML = '';
    options.forEach(function(opt) {
      var count = totals[opt.id] || 0;
      var pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
      var row = document.createElement('div');
      row.className = 'bar-row';
      row.dataset.optionId = opt.id;
      row.innerHTML =
        '<div class="bar-label"><span>' + opt.label + '</span>' +
        '<span class="bar-stat">' + count + ' (' + pct + '%)</span></div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>';
      container.appendChild(row);
    });
  }

  function updateBars(containerId, totals) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var totalVotes = Object.values(totals).reduce(function(s, v) { return s + v; }, 0);
    container.querySelectorAll('.bar-row').forEach(function(row) {
      var optId = row.dataset.optionId;
      var count = totals[optId] || 0;
      var pct = totalVotes > 0 ? Math.round(count / totalVotes * 100) : 0;
      var fill = row.querySelector('.bar-fill');
      var stat = row.querySelector('.bar-stat');
      if (fill) fill.style.width = pct + '%';
      if (stat) stat.textContent = count + ' (' + pct + '%)';
    });
  }

  function renderPollCard(poll, frozen) {
    var card = document.createElement('div');
    card.className = 'poll-card' + (frozen ? ' poll-card-frozen' : '');
    card.dataset.pollId = poll.id;

    var header = document.createElement('div');
    header.className = 'poll-card-header';

    var badge = document.createElement('span');
    badge.className = 'poll-badge';
    badge.textContent = frozen ? '📊 Poll — Final Results' : '📊 Poll';
    header.appendChild(badge);

    // Close button — only instructor, only active poll
    if (!frozen && identity.role === 'instructor') {
      var closeBtn = document.createElement('button');
      closeBtn.id = 'close-poll-btn-card';
      closeBtn.textContent = 'Close Poll ✕';
      closeBtn.addEventListener('click', function() {
        if (!currentPollId) return;
        fetch('/api/sessions/' + window._sessionId + '/polls/' + currentPollId + '?token=' + window._instructorToken, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' })
        }).catch(function() {});
      });
      header.appendChild(closeBtn);
    }

    card.appendChild(header);

    var qEl = document.createElement('div');
    qEl.className = 'poll-card-question';
    qEl.textContent = poll.question;
    card.appendChild(qEl);

    var optionsEl = document.createElement('div');
    optionsEl.className = 'poll-card-options';

    poll.options.forEach(function(opt) {
      var btn = document.createElement('button');
      btn.className = 'poll-vote-btn';
      btn.dataset.optionId = opt.id;
      btn.disabled = true; // enabled in US-09

      var labelEl = document.createElement('span');
      labelEl.textContent = opt.label;

      var totalEl = document.createElement('span');
      totalEl.className = 'btn-total';
      totalEl.dataset.role = 'total';
      totalEl.textContent = 'Total: 0';

      var personalEl = document.createElement('span');
      personalEl.className = 'btn-personal';
      personalEl.dataset.role = 'personal';
      personalEl.textContent = 'You: 0';

      btn.appendChild(labelEl);
      btn.appendChild(totalEl);
      btn.appendChild(personalEl);
      optionsEl.appendChild(btn);
    });

    card.appendChild(optionsEl);
    return card;
  }

  socket.on('poll:started', function(poll) {
    currentPollId = poll.id;
    pollClosed = false;
    personalCounts = {};
    aggregateTotals = {};
    window._currentPollOptions = poll.options;

    // Render the new in-chat card
    var card = renderPollCard(poll, false);
    document.getElementById('poll-card-area').innerHTML = '';
    document.getElementById('poll-card-area').appendChild(card);

    // Re-enable create poll button for instructor (if it somehow still exists)
    var cpBtn = document.getElementById('create-poll-btn');
    if (cpBtn) cpBtn.disabled = true;

    // Hide old overlay (backwards compat)
    var oldOverlay = document.getElementById('active-poll-overlay');
    if (oldOverlay) oldOverlay.style.display = 'none';
  });

  socket.on('poll:active', function(poll) {
    // Same as poll:started — render the card for late-joining clients
    if (!poll) return;
    currentPollId = poll.id;
    pollClosed = false;
    personalCounts = {};
    aggregateTotals = {};
    window._currentPollOptions = poll.options;

    var card = renderPollCard(poll, false);
    document.getElementById('poll-card-area').innerHTML = '';
    document.getElementById('poll-card-area').appendChild(card);
  });

  // IMPL-05-7: live totals from server
  socket.on('poll:results', function(ev) {
    if (!ev || ev.pollId !== currentPollId) return;
    aggregateTotals = ev.totals || {};
    // Update vote button totals (existing)
    document.querySelectorAll('.poll-vote-btn').forEach(function(btn) {
      var optId = btn.dataset.optionId;
      var totalEl = btn.querySelector('[data-role="total"]');
      if (totalEl) totalEl.textContent = 'Total: ' + (aggregateTotals[optId] || 0);
    });
    // Instructor: update results panel bars and voter count
    if (identity.role === 'instructor' && window._currentPollOptions) {
      updateBars('results-bars', ev.totals);
      if (ev.voterCount !== undefined) {
        document.getElementById('results-voter-count').textContent =
          ev.voterCount + ' participant' + (ev.voterCount !== 1 ? 's' : '') + ' responded';
      }
    }
    // Participant: update participant-results-panel if visible
    if (identity.role !== 'instructor' && window._currentPollOptions) {
      updateBars('participant-results-bars', ev.totals);
    }
  });

  socket.on('poll:closed', function(ev) {
    pollClosed = true;
    currentPollId = null;

    // Freeze the active card and move it into #messages
    var cardArea = document.getElementById('poll-card-area');
    var activeCard = cardArea.querySelector('.poll-card');
    if (activeCard && window._currentPollOptions) {
      var frozen = renderPollCard(
        { id: ev && ev.pollId, question: activeCard.querySelector('.poll-card-question').textContent, options: window._currentPollOptions },
        true
      );
      // Copy final vote totals into the frozen card
      activeCard.querySelectorAll('.poll-vote-btn').forEach(function(btn) {
        var optId = btn.dataset.optionId;
        var frozenBtn = frozen.querySelector('.poll-vote-btn[data-option-id="' + optId + '"]');
        if (frozenBtn) {
          var tEl = btn.querySelector('[data-role="total"]');
          var frozenT = frozenBtn.querySelector('[data-role="total"]');
          if (tEl && frozenT) frozenT.textContent = tEl.textContent;
        }
      });
      messagesEl.appendChild(frozen);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    cardArea.innerHTML = '';

    // Re-enable instructor controls
    if (identity.role === 'instructor') {
      var cpBtn = document.getElementById('create-poll-btn');
      if (cpBtn) cpBtn.disabled = false;
      loadPollHistory();
    }
    window._currentPollOptions = null;
  });

  // US-08 removed: #close-poll-btn (old overlay) click listener
  // US-08 removed: #show-results-btn click listener
  // US-08 removed: #projector-mode-btn click listener

  // ── poll:results-visibility (participant view) ────────────────────────────
  socket.on('poll:results-visibility', function(ev) {
    var panel = document.getElementById('participant-results-panel');
    if (!panel) return;
    if (ev.visible) {
      panel.style.display = 'block';
      // Initialise bars if not yet done
      if (window._currentPollOptions) {
        renderBars('participant-results-bars', aggregateTotals, window._currentPollOptions);
      }
    } else {
      panel.style.display = 'none';
    }
  });

  // ── Poll history (instructor only) ────────────────────────────────────────
  function loadPollHistory() {
    if (identity.role !== 'instructor') return;
    fetch('/api/sessions/' + window._sessionId + '/polls?token=' + window._instructorToken)
      .then(function (r) { return r.json(); })
      .then(function (polls) {
        var histEl = document.getElementById('poll-history');
        var listEl = document.getElementById('poll-history-list');
        var closedPolls = polls.filter(function (p) { return p.status === 'closed'; });
        histEl.style.display = closedPolls.length ? 'block' : 'none';
        listEl.innerHTML = '';
        closedPolls.forEach(function (poll) {
          var li = document.createElement('li');
          li.style.cssText = 'margin-bottom:0.5rem; font-size:0.8rem; color:#8b949e;';
          li.innerHTML = '<strong style="color:#c9d1d9">' + poll.question + '</strong>';
          poll.options.forEach(function (opt) {
            var votes = (poll.results && poll.results[opt.id]) || 0;
            li.innerHTML += '<div style="padding-left:0.5rem">' + opt.label + ': <span style="color:#3fb950">' + votes + ' votes</span></div>';
          });
          listEl.appendChild(li);
        });
      })
      .catch(function () {});
  }

  // ── End session button ────────────────────────────────────────────────────
  document.getElementById('end-session-btn').addEventListener('click', function () {
    if (!confirm('End this session for everyone?')) return;
    fetch('/api/sessions/' + window._sessionId + '?token=' + window._instructorToken, { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .catch(function () {});
  });

  // ── Session ended ─────────────────────────────────────────────────────────
  socket.on('session:ended', function () {
    var modal = document.getElementById('session-ended-modal');
    modal.style.display = 'flex';
    document.getElementById('send-btn').disabled = true;
    document.getElementById('chat-input').disabled = true;
    var endBtn = document.getElementById('end-session-btn');
    if (endBtn) endBtn.disabled = true;
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
  });

  // ── Chat system message helper ────────────────────────────────────────────
  function showChatError(msg) {
    var div = document.createElement('div');
    div.className = 'chat-system-msg chat-error';
    div.textContent = msg;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    setTimeout(function() { if (div.parentNode) div.parentNode.removeChild(div); }, 4000);
  }

  // ── Slash command parser ──────────────────────────────────────────────────
  // Input: "/poll Is everyone ready? | Yes | No | Maybe"
  // Returns: { question: "Is everyone ready?", options: ["Yes", "No", "Maybe"] }
  // Returns null for bare "/poll" or "/poll close"
  function parsePollCommand(text) {
    var body = text.replace(/^\/poll\s*/i, '').trim();
    if (!body || body.toLowerCase() === 'close') return null;
    var parts = body.split('|').map(function(s) { return s.trim(); });
    return { question: parts[0], options: parts.slice(1) };
  }

  // ── Slash command dispatcher ──────────────────────────────────────────────
  function handleSlashCommand(text) {
    var lower = text.toLowerCase();

    // /poll close
    if (lower === '/poll close') {
      if (identity.role !== 'instructor') return;
      if (!currentPollId) { showChatError('No active poll to close.'); return; }
      fetch('/api/sessions/' + window._sessionId + '/polls/' + currentPollId + '?token=' + window._instructorToken, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'closed' })
      }).catch(function() { showChatError('Failed to close poll.'); });
      inputEl.value = '';
      return;
    }

    // /poll (any other form)
    if (lower.startsWith('/poll')) {
      if (identity.role !== 'instructor') return; // silently ignore for participants

      var parsed = parsePollCommand(text);

      // Bare /poll — show usage
      if (!parsed) {
        var info = document.createElement('div');
        info.className = 'chat-system-msg chat-info';
        info.textContent = 'Usage: /poll Question? | Option1 | Option2 [| ...]';
        messagesEl.appendChild(info);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        setTimeout(function() { if (info.parentNode) info.parentNode.removeChild(info); }, 5000);
        return;
      }

      var question = parsed.question;
      var options = parsed.options;

      // Validate
      if (!question) { showChatError('Poll question cannot be empty.'); return; }
      if (options.length < 2) { showChatError('At least 2 options required (separate with |).'); return; }
      if (options.length > 6) { showChatError('Maximum 6 options allowed.'); return; }
      for (var i = 0; i < options.length; i++) {
        if (options[i].length > 30) {
          showChatError('Option "' + options[i].slice(0, 20) + '…" exceeds 30 characters.'); return;
        }
        if (!options[i]) { showChatError('Option labels cannot be empty.'); return; }
      }

      // Create via REST API
      fetch('/api/sessions/' + window._sessionId + '/polls?token=' + window._instructorToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question, options: options })
      })
      .then(function(r) { return r.json().then(function(d) { return { ok: r.ok, data: d }; }); })
      .then(function(res) {
        if (!res.ok) {
          var msg = res.data.error || 'Failed to create poll';
          if (res.data.error && res.data.error.includes('already active')) {
            msg = 'A poll is already active — close it first with /poll close';
          }
          showChatError(msg);
        } else {
          // Success: clear input; poll:started socket event will render the poll
          inputEl.value = '';
          inputEl.style.height = 'auto';
        }
      })
      .catch(function() { showChatError('Network error creating poll.'); });
      return;
    }

    // Unknown command
    showChatError('Unknown command: ' + text.split(' ')[0]);
  }

  // Disable send initially until connected
  sendBtn.disabled = true;
})();
