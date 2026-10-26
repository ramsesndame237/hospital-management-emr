/* Barre de session affichée par-dessus Swagger UI : qui est connecté, et le moyen de se déconnecter. */
(function () {
  'use strict';
  var base = '/api-docs/_portal';

  function build(me) {
    var bar = document.createElement('div');
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Session');
    bar.style.cssText =
      'position:fixed;top:10px;right:14px;z-index:2147483000;display:flex;align-items:center;gap:10px;' +
      'padding:6px 8px 6px 14px;border-radius:999px;font:600 13px/1 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'color:#e8f4f8;background:rgba(6,50,74,.94);box-shadow:0 6px 20px rgba(6,50,74,.35);border:1px solid rgba(255,255,255,.14)';

    var dot = document.createElement('span');
    dot.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#2dd4bf;box-shadow:0 0 0 3px rgba(45,212,191,.25)';
    var name = document.createElement('span');
    name.textContent = me.displayName;

    var out = document.createElement('button');
    out.type = 'button';
    out.textContent = me.signOut;
    out.style.cssText = 'cursor:pointer;border:0;border-radius:999px;padding:8px 14px;font:inherit;color:#06324a;background:#e8f4f8';
    out.addEventListener('click', function () {
      out.disabled = true;
      fetch(base + '/logout', { method: 'POST', credentials: 'same-origin' })
        .then(function () { return fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }); })
        .catch(function () { /* la déconnexion locale suffit à fermer l'accès à la documentation */ })
        .then(function () { location.reload(); });
    });

    bar.appendChild(dot);
    bar.appendChild(name);
    bar.appendChild(out);
    document.body.appendChild(bar);
  }

  /**
   * Pré-remplit « Authorize » avec un jeton d'accès frais, obtenu grâce au cookie de rafraîchissement : les endpoints
   * sont testables dès l'ouverture de la page. Renouvelé avant l'expiration (15 min) ; aucun jeton n'est stocké
   * dans le navigateur (persistAuthorization est désactivé).
   */
  function authorize() {
    return fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (t) {
        if (!t || !t.accessToken) { return; }
        // `window.ui` est créé au chargement de la page : on patiente brièvement s'il n'est pas encore là.
        var tries = 0;
        (function apply() {
          if (window.ui && window.ui.preauthorizeApiKey) { window.ui.preauthorizeApiKey('bearer', t.accessToken); return; }
          if (++tries < 40) { setTimeout(apply, 150); }
        })();
      })
      .catch(function () { /* l'utilisateur peut toujours utiliser « Authorize » à la main */ });
  }

  fetch(base + '/me', { credentials: 'same-origin' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (me) {
      if (!me) { return; }
      build(me);
      authorize();
      setInterval(authorize, 12 * 60 * 1000);
    })
    .catch(function () { /* barre facultative */ });
})();
