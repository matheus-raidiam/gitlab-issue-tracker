/* auth.js — login simples com allowlist + passcode */
(function (window) {
  const SESSION_KEY = 'ofb_session';

  /* EDITAR AQUI ↓↓↓ */
  const ALLOWLIST = [
    'login@raidiam.com',
    // 'outra.pessoa@empresa.com',
  ].map(s => s.trim().toLowerCase());

  const PASSCODE = 'dashofb!'; // troque aqui
  const TTL_MIN = 12 * 60;     // sessão válida por 12h
  /* EDITAR AQUI ↑↑↑ */

  function createSession(email) {
    const now = Date.now();
    const session = {
      email: email.toLowerCase(),
      createdAt: now,
      expiresAt: now + TTL_MIN * 60 * 1000,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function readSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { return null; }
  }

  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function isLoggedIn() {
    const s = readSession();
    return !!(s && s.email && Date.now() < s.expiresAt);
  }

  function signIn(email, passcode) {
    email = (email || '').trim().toLowerCase();
    passcode = (passcode || '').trim();

    if (!ALLOWLIST.includes(email)) return { ok: false, msg: 'E-mail não autorizado' };
    if (passcode !== PASSCODE)      return { ok: false, msg: 'Código inválido' };

    createSession(email);
    return { ok: true };
  }

  function signOut() { clearSession(); }

  function requireAuth() {
    if (!isLoggedIn()) window.location.href = 'login.html';
  }

  window.Auth = { signIn, signOut, isLoggedIn, requireAuth };
})(window);
