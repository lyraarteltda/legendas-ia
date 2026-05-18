/**
 * Membership Gate — verifies user is a paying Maestria da IA member.
 * Supports WhatsApp OTP flow with fallback to simple email+phone check.
 * Periodic re-validation every 4 hours.
 */
const MembershipGate = (function() {
  const SESSION_KEY = 'maestria_member_session';
  const SESSION_DURATION = 24 * 60 * 60 * 1000;
  const REVALIDATION_INTERVAL = 4 * 60 * 60 * 1000;

  const LOGIN_RATE_KEY = 'maestria_login_attempts';
  const LOGIN_RATE_WINDOW = 15 * 60 * 1000;
  const LOGIN_RATE_MAX = 5;

  let _pendingEmail = '';
  let _pendingPhone = '';

  function getStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (Date.now() - session.timestamp > SESSION_DURATION) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }

  function storeSession(member) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      email: member.buyer_email,
      name: member.buyer_name,
      phone: member.buyer_phone,
      timestamp: Date.now(),
      lastValidation: Date.now()
    }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function normalizePhone(phone) {
    return phone.replace(/\D/g, '');
  }

  function checkLoginRateLimit() {
    try {
      const raw = localStorage.getItem(LOGIN_RATE_KEY);
      if (!raw) return true;
      const data = JSON.parse(raw);
      const validAttempts = data.filter(function(t) { return Date.now() - t < LOGIN_RATE_WINDOW; });
      localStorage.setItem(LOGIN_RATE_KEY, JSON.stringify(validAttempts));
      return validAttempts.length < LOGIN_RATE_MAX;
    } catch {
      return true;
    }
  }

  function recordLoginAttempt() {
    try {
      const raw = localStorage.getItem(LOGIN_RATE_KEY);
      const data = raw ? JSON.parse(raw) : [];
      data.push(Date.now());
      localStorage.setItem(LOGIN_RATE_KEY, JSON.stringify(data));
    } catch {}
  }

  async function verifyMembership(email, phone) {
    const sb = window.AppSupabase.getClient();
    const normalizedPhone = normalizePhone(phone);

    const { data, error } = await sb
      .from('comunidade_purchases')
      .select('buyer_name, buyer_email, buyer_phone, product_name, payment_status')
      .eq('payment_status', 'approved')
      .eq('buyer_email', email.toLowerCase().trim())
      .limit(1)
      .single();

    if (error) {
      if (error.message && error.message.includes('rows')) {
        return { verified: false, reason: 'not_found' };
      }
      return { verified: false, reason: 'error', message: error.message };
    }

    if (!data) {
      return { verified: false, reason: 'not_found' };
    }

    const dbPhone = normalizePhone(data.buyer_phone || '');
    if (dbPhone && normalizedPhone) {
      const phoneMatch = dbPhone.includes(normalizedPhone) || normalizedPhone.includes(dbPhone);
      if (!phoneMatch) {
        return { verified: false, reason: 'phone_mismatch' };
      }
    }

    return { verified: true, member: data };
  }

  async function revalidateSession() {
    const session = getStoredSession();
    if (!session) return;

    var lastVal = session.lastValidation || session.timestamp;
    if (Date.now() - lastVal < REVALIDATION_INTERVAL) return;

    try {
      const sb = window.AppSupabase.getClient();
      const { data } = await sb
        .from('comunidade_purchases')
        .select('payment_status')
        .eq('buyer_email', session.email)
        .eq('payment_status', 'approved')
        .limit(1)
        .single();

      if (!data) {
        clearSession();
        showScreen('gate-screen');
        return;
      }

      var updated = JSON.parse(localStorage.getItem(SESSION_KEY));
      updated.lastValidation = Date.now();
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
    } catch {}
  }

  async function sendOTP(email, phone) {
    try {
      var resp = await fetch('/.netlify/functions/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, phone: phone })
      });
      return await resp.json();
    } catch {
      return { sent: false, fallback: true };
    }
  }

  async function verifyOTP(email, code) {
    try {
      var resp = await fetch('/.netlify/functions/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, code: code })
      });
      return await resp.json();
    } catch {
      return { verified: false, error: 'Erro de conexão. Tente novamente.' };
    }
  }

  function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
    var target = document.getElementById(screenId);
    if (target) target.classList.add('active');
  }

  function getErrorMessage(reason) {
    switch (reason) {
      case 'not_found':
        return 'E-mail não encontrado entre os membros aprovados. Verifique se usou o mesmo e-mail da compra.';
      case 'phone_mismatch':
        return 'O WhatsApp informado não corresponde ao cadastro. Verifique o número.';
      case 'rate_limited':
        return 'Muitas tentativas. Aguarde 15 minutos antes de tentar novamente.';
      case 'error':
        return 'Erro ao verificar. Tente novamente em alguns segundos.';
      default:
        return 'Não foi possível verificar o acesso. Tente novamente.';
    }
  }

  function createOTPScreen() {
    if (document.getElementById('otp-screen')) return;

    var screen = document.createElement('div');
    screen.id = 'otp-screen';
    screen.className = 'screen';
    screen.innerHTML =
      '<div class="gate-container" style="display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px;">' +
        '<div style="width:100%;max-width:420px;text-align:center;">' +
          '<div class="gate-header">' +
            '<h1 class="gradient-text">Verificação por WhatsApp</h1>' +
            '<p class="subtitle">Enviamos um código de 6 dígitos para o seu WhatsApp. Digite-o abaixo.</p>' +
          '</div>' +
          '<div class="gate-form" style="margin-bottom:24px;">' +
            '<div class="form-group">' +
              '<label for="otp-code">Código de verificação</label>' +
              '<input type="text" id="otp-code" placeholder="000000" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" style="text-align:center;font-size:24px;letter-spacing:8px;">' +
            '</div>' +
            '<button type="button" id="otp-submit" class="btn-primary">' +
              '<span class="btn-text">Verificar código</span>' +
              '<span class="btn-loading" style="display:none;">Verificando...</span>' +
            '</button>' +
            '<p id="otp-error" class="error-message" style="display:none;"></p>' +
          '</div>' +
          '<p class="gate-footer"><a href="#" id="otp-back">Voltar e tentar novamente</a></p>' +
        '</div>' +
      '</div>';

    document.body.appendChild(screen);

    document.getElementById('otp-submit').addEventListener('click', handleOTPSubmit);
    document.getElementById('otp-code').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') handleOTPSubmit();
    });
    document.getElementById('otp-back').addEventListener('click', function(e) {
      e.preventDefault();
      showScreen('gate-screen');
    });
  }

  async function handleOTPSubmit() {
    var codeInput = document.getElementById('otp-code');
    var submitBtn = document.getElementById('otp-submit');
    var errorEl = document.getElementById('otp-error');
    var code = codeInput.value.trim();

    if (code.length !== 6) {
      errorEl.textContent = 'Digite o código de 6 dígitos.';
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.querySelector('.btn-text').style.display = 'none';
    submitBtn.querySelector('.btn-loading').style.display = 'inline';

    try {
      var result = await verifyOTP(_pendingEmail, code);

      if (result.verified && result.member) {
        storeSession(result.member);
        var nameEl = document.getElementById('user-name');
        if (nameEl) nameEl.textContent = result.member.buyer_name || 'Maestro';
        showScreen('key-screen');
        if (window.ApiKeyManager) window.ApiKeyManager.renderInputs();
      } else {
        errorEl.textContent = result.error || 'Código inválido. Tente novamente.';
        errorEl.style.display = 'block';
      }
    } catch {
      errorEl.textContent = 'Erro de conexão. Tente novamente.';
      errorEl.style.display = 'block';
    } finally {
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').style.display = 'inline';
      submitBtn.querySelector('.btn-loading').style.display = 'none';
    }
  }

  function init() {
    var session = getStoredSession();
    if (session) {
      var nameEl = document.getElementById('user-name');
      if (nameEl) nameEl.textContent = session.name || 'Maestro';
      showScreen('key-screen');
      if (window.ApiKeyManager) {
        var hasKeys = window.ApiKeyManager.hasRequiredKeys();
        if (hasKeys) showScreen('app-screen');
      }
      revalidateSession();
      return;
    }

    showScreen('gate-screen');
    createOTPScreen();

    var form = document.getElementById('gate-form');
    if (!form) return;

    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      var emailInput = document.getElementById('gate-email');
      var phoneInput = document.getElementById('gate-phone');
      var submitBtn = document.getElementById('gate-submit');
      var errorEl = document.getElementById('gate-error');
      var btnText = submitBtn.querySelector('.btn-text');
      var btnLoading = submitBtn.querySelector('.btn-loading');

      if (!checkLoginRateLimit()) {
        errorEl.textContent = getErrorMessage('rate_limited');
        errorEl.style.display = 'block';
        return;
      }

      recordLoginAttempt();
      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      btnText.style.display = 'none';
      btnLoading.style.display = 'inline';

      try {
        var result = await verifyMembership(emailInput.value, phoneInput.value);

        if (result.verified) {
          _pendingEmail = emailInput.value.toLowerCase().trim();
          _pendingPhone = normalizePhone(phoneInput.value);

          var otpResult = await sendOTP(_pendingEmail, _pendingPhone);

          if (otpResult.sent) {
            showScreen('otp-screen');
            var otpInput = document.getElementById('otp-code');
            if (otpInput) { otpInput.value = ''; otpInput.focus(); }
          } else if (otpResult.fallback) {
            console.warn('OTP send failed — using fallback direct verification');
            storeSession(result.member);
            var nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.textContent = result.member.buyer_name || 'Maestro';
            showScreen('key-screen');
            if (window.ApiKeyManager) window.ApiKeyManager.renderInputs();
          } else {
            errorEl.textContent = otpResult.error || 'Erro ao enviar código. Tente novamente.';
            errorEl.style.display = 'block';
          }
        } else {
          errorEl.textContent = getErrorMessage(result.reason);
          errorEl.style.display = 'block';
        }
      } catch (err) {
        errorEl.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
        errorEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
      }
    });

    var logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', function() {
        clearSession();
        showScreen('gate-screen');
      });
    }
  }

  return {
    init: init,
    getSession: getStoredSession,
    clearSession: clearSession,
    showScreen: showScreen,
    verifyMembership: verifyMembership,
    revalidateSession: revalidateSession
  };
})();

document.addEventListener('DOMContentLoaded', function() {
  MembershipGate.init();
});
