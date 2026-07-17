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
    }
  });

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

  // Disable send initially until connected
  sendBtn.disabled = true;
})();
