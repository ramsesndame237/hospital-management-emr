/* Page d'accueil de la documentation : connexion, second facteur, ouverture de la documentation.
 * Aucun framework, aucune ressource externe. Les textes arrivent du serveur dans <script id="portal-config">. */
(function () {
  'use strict';

  var cfg = JSON.parse(document.getElementById('portal-config').textContent);
  var T = cfg.texts;
  var $ = function (id) { return document.getElementById(id); };
  var views = ['checking', 'login', 'mfa', 'done', 'blocked'];
  var creds = { username: '', password: '' };
  var recoveryMode = false;

  function fill(template, values) {
    return template.replace(/\{(\w+)\}/g, function (m, k) { return k in values ? values[k] : m; });
  }

  function show(name) {
    views.forEach(function (v) { $('view-' + v).hidden = v !== name; });
    var focusTarget = { login: 'username', mfa: 'mfa-code' }[name];
    // Sur mobile, un focus au chargement ouvre le clavier et fait défiler la page : on le réserve aux grands écrans,
    // sauf à l'étape MFA où l'utilisateur vient d'agir.
    var desktop = window.matchMedia('(min-width: 921px)').matches;
    if (focusTarget && (desktop || name === 'mfa')) { setTimeout(function () { $(focusTarget).focus(); }, 30); }
  }

  function flash(id, kind, message) {
    var box = $(id);
    box.className = 'alert show ' + kind;
    box.querySelector('.msg').textContent = message;
  }
  function clearFlash(id) { $(id).className = 'alert'; }

  function busy(buttonId, on, idleLabel, busyLabel) {
    var b = $(buttonId);
    b.disabled = on;
    b.setAttribute('aria-busy', on ? 'true' : 'false');
    b.querySelector('.label').textContent = on ? busyLabel : idleLabel;
  }

  function api(path, options) {
    options = options || {};
    var headers = { 'content-type': 'application/json', 'x-locale': cfg.locale };
    if (options.token) { headers.authorization = 'Bearer ' + options.token; }
    return fetch(path, {
      method: options.method || 'POST',
      headers: headers,
      credentials: 'same-origin',
      body: options.body ? JSON.stringify(options.body) : undefined
    }).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
        return { status: res.status, data: data };
      });
    });
  }

  /** Message à afficher pour une erreur de l'API (déjà traduit côté serveur selon la langue de la page). */
  function messageOf(r) {
    if (r.data && Array.isArray(r.data.errors) && r.data.errors.length) {
      return r.data.errors.map(function (e) { return e.message; }).join(' ');
    }
    return (r.data && r.data.message) || T.genericError;
  }

  function opened(name) {
    $('welcome').textContent = fill(T.welcome, { name: name });
    show('done');
    setTimeout(function () { location.replace(cfg.docsPath); }, 900);
  }

  function blocked(message) {
    $('blocked-text').textContent = message;
    show('blocked');
  }

  /** Échange le jeton d'accès contre la session de documentation (cookie httpOnly). */
  function openDocs(token) {
    return api(cfg.docsPath + '/_portal/session', { token: token }).then(function (r) {
      if (r.status === 200) { opened(r.data.displayName); return true; }
      if (r.status === 403) {
        blocked(r.data && r.data.reason === 'setup-required' ? T.setupRequired : T.forbidden);
        return true;
      }
      return false;
    });
  }

  function handleLogin(r) {
    if (r.status === 200 && r.data) {
      if (r.data.status === 'mfa_required') {
        clearFlash('mfa-alert');
        show('mfa');
        return;
      }
      if (r.data.scope === 'setup') { blocked(T.setupRequired); return; }
      return openDocs(r.data.accessToken).then(function (ok) {
        if (!ok) { flash('login-alert', 'error', T.genericError); show('login'); }
      });
    }
    var inMfa = !$('view-mfa').hidden;
    flash(inMfa ? 'mfa-alert' : 'login-alert', 'error', messageOf(r));
  }

  function submitLogin(extra, buttonId, idle, busyLabel) {
    busy(buttonId, true, idle, busyLabel);
    return api('/api/v1/auth/login', { body: Object.assign({ username: creds.username, password: creds.password }, extra) })
      .then(handleLogin)
      .catch(function () { flash(extra ? 'mfa-alert' : 'login-alert', 'error', T.networkError); })
      .then(function () { busy(buttonId, false, idle, busyLabel); });
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearFlash('login-alert');
    creds.username = $('username').value.trim();
    creds.password = $('password').value;
    submitLogin(null, 'login-submit', T.signIn, T.signingIn);
  });

  $('mfa-form').addEventListener('submit', function (e) {
    e.preventDefault();
    clearFlash('mfa-alert');
    var value = $('mfa-code').value.trim();
    var extra = recoveryMode ? { recoveryCode: value } : { totpCode: value };
    submitLogin(extra, 'mfa-submit', T.mfaVerify, T.signingIn).then(function () { $('mfa-code').select(); });
  });

  $('toggle-password').addEventListener('click', function () {
    var input = $('password');
    var visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    this.textContent = visible ? T.showPassword : T.hidePassword;
    this.setAttribute('aria-pressed', visible ? 'false' : 'true');
  });

  $('mfa-mode').addEventListener('click', function () {
    recoveryMode = !recoveryMode;
    var input = $('mfa-code');
    input.value = '';
    input.inputMode = recoveryMode ? 'text' : 'numeric';
    input.maxLength = recoveryMode ? 16 : 7;
    input.autocomplete = recoveryMode ? 'off' : 'one-time-code';
    $('mfa-code-wrap').classList.toggle('recovery', recoveryMode);
    $('mfa-code-label').textContent = recoveryMode ? T.recoveryCode : T.mfaCode;
    this.textContent = recoveryMode ? T.mfaUseApp : T.mfaUseRecovery;
    clearFlash('mfa-alert');
    input.focus();
  });

  $('mfa-back').addEventListener('click', function () {
    $('mfa-code').value = '';
    clearFlash('login-alert');
    show('login');
  });

  $('blocked-back').addEventListener('click', function () {
    api('/api/v1/auth/logout').then(function () { $('password').value = ''; show('login'); });
  });

  // Reprise silencieuse : un utilisateur déjà connecté (cookie de rafraîchissement valide) ne ressaisit rien.
  show('checking');
  api('/api/v1/auth/refresh')
    .then(function (r) {
      if (r.status === 200 && r.data && r.data.scope === 'full') { return openDocs(r.data.accessToken); }
      return false;
    })
    .catch(function () { return false; })
    .then(function (handled) { if (!handled) { show('login'); } });
})();
