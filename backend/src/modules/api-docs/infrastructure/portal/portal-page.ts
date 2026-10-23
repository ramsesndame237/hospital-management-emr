import type { PortalLocalization } from '../../domain/api-docs.port';

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** JSON sûr dans un `<script type="application/json">` : `<` est échappé pour qu'aucune valeur ne puisse refermer la balise. */
const safeJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Crect width='40' height='40' rx='10' fill='%230b6e8a'/%3E%3Cpath d='M17 9h6v8h8v6h-8v8h-6v-8H9v-6h8z' fill='white'/%3E%3C/svg%3E";

const ICON = {
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="3"/><path d="M12 17h.01M9 7h6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M10 9l5 3-5 3V9z"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.8 2.6 15.2 0 18M12 3c-2.6 2.8-2.6 15.2 0 18"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2.5"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>',
};

export interface PortalPageInput {
  readonly localization: PortalLocalization;
  /** Chemin de la documentation, p. ex. `/api-docs`. */
  readonly docsPath: string;
}

/** Page d'accueil de la documentation. Aucun script en ligne : la CSP n'autorise que les fichiers de même origine. */
export function renderPortalPage({ localization, docsPath }: PortalPageInput): string {
  const { locale, locales, texts: t } = localization;
  const assets = `${docsPath}/_portal`;
  const feature = (icon: string, title: string, text: string) =>
    `<li class="feature">${icon}<div><strong>${esc(title)}</strong><span>${esc(text)}</span></div></li>`;
  const langLinks = locales.length > 1
    ? `<nav class="lang" aria-label="Language">${locales
        .map((l) => `<a href="?lang=${esc(l)}" hreflang="${esc(l)}" lang="${esc(l)}"${l === locale ? ' aria-current="true"' : ''}>${esc(l.toUpperCase())}</a>`)
        .join('')}</nav>`
    : '';

  const config = { locale, docsPath, texts: t };

  return `<!doctype html>
<html lang="${esc(locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light dark">
<title>${esc(t.pageTitle)}</title>
<link rel="icon" href="${FAVICON}">
<link rel="stylesheet" href="${assets}/portal.css">
</head>
<body>
<div class="layout">
  <aside class="hero">
    <div class="brand">
      <svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="11" fill="rgba(255,255,255,.16)"/><path d="M17 9h6v8h8v6h-8v8h-6v-8H9v-6h8z" fill="#fff"/></svg>
      <div>Sanjeevani EMR<small>API</small></div>
    </div>
    <div>
      <h1>${esc(t.heroTitle)}</h1>
      <p class="lead">${esc(t.heroLead)}</p>
      <svg class="pulse" viewBox="0 0 420 56" fill="none" aria-hidden="true"><path d="M0 30h120l14-22 22 44 18-34 12 12h234" stroke="#7ee8d8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <ul class="features">
      ${feature(ICON.shield, t.feature1Title, t.feature1Text)}
      ${feature(ICON.key, t.feature2Title, t.feature2Text)}
      ${feature(ICON.play, t.feature3Title, t.feature3Text)}
      ${feature(ICON.globe, t.feature4Title, t.feature4Text)}
    </ul>
  </aside>

  <main class="panel">
    <div class="topbar">${langLinks}</div>
    <div class="center">
      <div class="card">

        <section id="view-checking" class="state" aria-live="polite">
          <div class="ring" aria-hidden="true"></div>
          <p>${esc(t.checking)}</p>
        </section>

        <section id="view-login" hidden>
          <h2>${esc(t.loginTitle)}</h2>
          <p class="sub">${esc(t.loginLead)}</p>
          <div id="login-alert" class="alert" role="alert" aria-live="assertive">${ICON.alert}<span class="msg"></span></div>
          <form id="login-form" novalidate>
            <div class="field">
              <label for="username">${esc(t.username)}</label>
              <div class="control"><input id="username" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="${esc(t.usernamePlaceholder)}" required maxlength="64"></div>
            </div>
            <div class="field">
              <label for="password">${esc(t.password)}</label>
              <div class="control has-toggle">
                <input id="password" name="password" type="password" autocomplete="current-password" placeholder="${esc(t.passwordPlaceholder)}" required maxlength="1024">
                <button type="button" id="toggle-password" class="toggle" aria-pressed="false">${esc(t.showPassword)}</button>
              </div>
            </div>
            <button id="login-submit" class="btn" type="submit" aria-busy="false"><span class="spinner" aria-hidden="true"></span><span class="label">${esc(t.signIn)}</span></button>
          </form>
        </section>

        <section id="view-mfa" hidden>
          <h2>${esc(t.mfaTitle)}</h2>
          <p class="sub">${esc(t.mfaLead)}</p>
          <div id="mfa-alert" class="alert" role="alert" aria-live="assertive">${ICON.alert}<span class="msg"></span></div>
          <form id="mfa-form" novalidate>
            <div class="field">
              <label id="mfa-code-label" for="mfa-code">${esc(t.mfaCode)}</label>
              <div id="mfa-code-wrap" class="control code"><input id="mfa-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="000 000" required></div>
            </div>
            <button id="mfa-submit" class="btn" type="submit" aria-busy="false"><span class="spinner" aria-hidden="true"></span><span class="label">${esc(t.mfaVerify)}</span></button>
          </form>
          <div class="row">
            <button type="button" id="mfa-mode" class="link">${esc(t.mfaUseRecovery)}</button>
            <button type="button" id="mfa-back" class="link">${esc(t.back)}</button>
          </div>
        </section>

        <section id="view-done" class="state" hidden aria-live="polite">
          <div class="ring" aria-hidden="true"></div>
          <strong id="welcome"></strong>
          <p>${esc(t.redirecting)}</p>
        </section>

        <section id="view-blocked" hidden>
          <h2>${esc(t.accessRestricted)}</h2>
          <div class="alert show info" role="alert">${ICON.alert}<span id="blocked-text" class="msg"></span></div>
          <button type="button" id="blocked-back" class="btn"><span class="label">${esc(t.back)}</span></button>
        </section>

      </div>
    </div>
    <div class="footer">${ICON.lock}<span>${esc(t.footerNote)}</span></div>
  </main>
</div>
<script id="portal-config" type="application/json">${safeJson(config)}</script>
<script src="${assets}/portal.js" defer></script>
</body>
</html>`;
}
