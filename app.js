const App = (function() {
  let _selectedPlatform = 'instagram';
  let _selectedTone = 'profissional';

  function setupChipGroups() {
    document.querySelectorAll('.chip-group').forEach(function(group) {
      group.querySelectorAll('.chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
          group.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
          chip.classList.add('active');
          if (group.id === 'gen-platform') _selectedPlatform = chip.dataset.value;
          if (group.id === 'gen-tone') _selectedTone = chip.dataset.value;
        });
      });
    });
  }

  function buildPrompt() {
    var topic = document.getElementById('gen-topic').value.trim();
    var context = document.getElementById('gen-context').value.trim();
    var count = document.getElementById('gen-count').value;
    var hashtags = document.getElementById('gen-hashtags').value === 'sim';
    var emojis = document.getElementById('gen-emoji').value === 'sim';

    var platformGuide = {
      instagram: 'Instagram (até 2200 caracteres, foco visual, uso de quebras de linha)',
      linkedin: 'LinkedIn (tom profissional, networking, storytelling de carreira)',
      twitter: 'Twitter/X (máximo 280 caracteres por legenda, conciso e impactante)',
      facebook: 'Facebook (conversacional, engajamento, pode ser mais longo)'
    };

    var toneGuide = {
      profissional: 'profissional e confiante',
      descontrado: 'descontraído e divertido',
      inspirador: 'inspirador e motivacional',
      vendedor: 'persuasivo e orientado à venda (copywriting)',
      educativo: 'educativo e informativo'
    };

    var prompt = 'Você é um especialista em social media e copywriting em português brasileiro.\n\n';
    prompt += 'Crie ' + count + ' legenda(s) para ' + platformGuide[_selectedPlatform] + '.\n';
    prompt += 'Tom: ' + toneGuide[_selectedTone] + '.\n';
    prompt += 'Assunto/nicho: ' + (topic || 'geral') + '.\n';
    if (context) prompt += 'Contexto adicional: ' + context + '\n';
    prompt += '\nRegras:\n';
    prompt += '- Escreva em português brasileiro com acentos corretos\n';
    prompt += '- Cada legenda deve ser única e criativa\n';
    if (hashtags) {
      prompt += '- Inclua 5-10 hashtags relevantes ao final de cada legenda\n';
    } else {
      prompt += '- NÃO inclua hashtags\n';
    }
    if (emojis) {
      prompt += '- Use emojis de forma natural ao longo do texto\n';
    } else {
      prompt += '- NÃO use emojis\n';
    }
    if (_selectedPlatform === 'twitter') {
      prompt += '- IMPORTANTE: cada legenda deve ter no máximo 280 caracteres\n';
    }
    prompt += '\nFormato de resposta: retorne APENAS as legendas, separadas por "---" em uma linha própria. Sem numeração, sem títulos, sem explicações.';
    return prompt;
  }

  async function callOpenAI(apiKey, prompt) {
    var resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um copywriter brasileiro especialista em redes sociais.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })
    });
    if (!resp.ok) {
      var err = {};
      try { err = await resp.json(); } catch(e) {}
      throw new Error(err.error ? err.error.message : 'Erro da API OpenAI (HTTP ' + resp.status + ')');
    }
    var data = await resp.json();
    return data.choices[0].message.content;
  }

  async function callOpenRouter(apiKey, prompt) {
    var resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
        'HTTP-Referer': window.location.origin
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Você é um copywriter brasileiro especialista em redes sociais.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })
    });
    if (!resp.ok) {
      var err = {};
      try { err = await resp.json(); } catch(e) {}
      throw new Error(err.error ? err.error.message : 'Erro da API OpenRouter (HTTP ' + resp.status + ')');
    }
    var data = await resp.json();
    return data.choices[0].message.content;
  }

  function parseCaptions(raw) {
    return raw.split('---')
      .map(function(s) { return s.trim(); })
      .filter(function(s) { return s.length > 10; });
  }

  function renderResults(captions) {
    var section = document.getElementById('results-section');
    var list = document.getElementById('results-list');
    list.innerHTML = '';

    captions.forEach(function(caption, i) {
      var card = document.createElement('div');
      card.className = 'result-card';

      var badge = document.createElement('span');
      badge.className = 'result-badge';
      badge.textContent = 'Legenda ' + (i + 1);

      var text = document.createElement('div');
      text.className = 'result-text';
      text.textContent = caption;

      var actions = document.createElement('div');
      actions.className = 'result-actions';

      var copyBtn = document.createElement('button');
      copyBtn.className = 'btn-copy';
      copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar';
      copyBtn.addEventListener('click', function() {
        navigator.clipboard.writeText(caption).then(function() {
          copyBtn.classList.add('copied');
          copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Copiado!';
          setTimeout(function() {
            copyBtn.classList.remove('copied');
            copyBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar';
          }, 2000);
        });
      });

      var charCount = document.createElement('span');
      charCount.className = 'char-count';
      charCount.textContent = caption.length + ' caracteres';

      actions.appendChild(copyBtn);
      actions.appendChild(charCount);
      card.appendChild(badge);
      card.appendChild(text);
      card.appendChild(actions);
      list.appendChild(card);
    });

    section.style.display = 'block';
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (window.Analytics) Analytics.trackAction('generate_captions', {
      platform: _selectedPlatform,
      tone: _selectedTone,
      count: captions.length
    });
  }

  function setupCopyAll() {
    document.getElementById('copy-all-btn').addEventListener('click', function() {
      var texts = [];
      document.querySelectorAll('.result-text').forEach(function(el) {
        texts.push(el.textContent);
      });
      var all = texts.join('\n\n---\n\n');
      navigator.clipboard.writeText(all).then(function() {
        var btn = document.getElementById('copy-all-btn');
        btn.textContent = 'Copiado!';
        setTimeout(function() { btn.textContent = 'Copiar todas'; }, 2000);
      });
    });
  }

  function setupGenerate() {
    var submitBtn = document.getElementById('gen-submit');
    var errorEl = document.getElementById('gen-error');
    var noKeyBanner = document.getElementById('gen-no-key');
    var setupKeyBtn = document.getElementById('gen-setup-key');

    if (setupKeyBtn) {
      setupKeyBtn.addEventListener('click', function() {
        var modal = document.getElementById('key-modal');
        if (modal) {
          ApiKeyManager.renderInputs('modal-key-inputs');
          modal.style.display = 'flex';
        }
      });
    }

    function updateKeyStatus() {
      var activeKey = ApiKeyManager.getActiveKey();
      if (activeKey) {
        noKeyBanner.style.display = 'none';
        submitBtn.disabled = false;
      } else {
        noKeyBanner.style.display = 'flex';
        submitBtn.disabled = true;
      }
    }

    updateKeyStatus();
    window.addEventListener('storage', updateKeyStatus);
    var modalSaveBtn = document.getElementById('modal-save');
    if (modalSaveBtn) {
      modalSaveBtn.addEventListener('click', function() {
        setTimeout(updateKeyStatus, 100);
      });
    }

    submitBtn.addEventListener('click', async function() {
      var activeKey = ApiKeyManager.getActiveKey();
      if (!activeKey) {
        noKeyBanner.style.display = 'flex';
        return;
      }

      var topic = document.getElementById('gen-topic').value.trim();
      if (!topic) {
        errorEl.textContent = 'Por favor, informe o assunto ou nicho.';
        errorEl.style.display = 'block';
        document.getElementById('gen-topic').focus();
        return;
      }

      errorEl.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.querySelector('.btn-text').style.display = 'none';
      submitBtn.querySelector('.btn-loading').style.display = 'inline';

      try {
        var prompt = buildPrompt();
        var result = await RateLimiter.executeWithLimit('generate', async function() {
          if (activeKey.service === 'openrouter') {
            return callOpenRouter(activeKey.key, prompt);
          }
          return callOpenAI(activeKey.key, prompt);
        });

        if (result === null) return;

        var captions = parseCaptions(result);
        if (captions.length === 0) {
          errorEl.textContent = 'A IA não retornou legendas válidas. Tente novamente.';
          errorEl.style.display = 'block';
          return;
        }

        renderResults(captions);
      } catch (err) {
        errorEl.textContent = err.message || 'Erro ao gerar legendas. Verifique sua chave de API e tente novamente.';
        errorEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.querySelector('.btn-text').style.display = 'inline';
        submitBtn.querySelector('.btn-loading').style.display = 'none';
        updateKeyStatus();
      }
    });
  }

  function init() {
    var session = MembershipGate.getSession();
    if (session) {
      var nameEl = document.getElementById('user-name');
      if (nameEl) nameEl.textContent = session.name || 'Maestro';
    }

    setupChipGroups();
    setupGenerate();
    setupCopyAll();
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var session = MembershipGate.getSession();
    if (session) {
      App.init();
    }
  }, 100);
});
