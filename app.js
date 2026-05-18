/**
 * Legendas IA — Main Application Logic
 *
 * This is the scaffold for the tool's core functionality.
 * Replace the contents below with the actual feature implementation.
 *
 * Available globals:
 *   - window.AppSupabase.getClient()  — Supabase client (for DB operations)
 *   - window.ApiKeyManager.getActiveKey() — returns { service, key, config } or null
 *   - window.ApiKeyManager.getKey('openai') — get key for a specific service
 *   - MembershipGate.getSession() — returns { email, name, phone, timestamp }
 */

const App = (function() {
  function init() {
    console.log('Legendas IA initialized');

    // Get the current member session
    const session = MembershipGate.getSession();
    if (session) {
      const nameEl = document.getElementById('user-name');
      if (nameEl) nameEl.textContent = session.name || 'Maestro';
    }

    // ========================================
    // YOUR APPLICATION LOGIC GOES HERE
    // ========================================

    // Example: Making an AI call with the user's key
    // const activeKey = ApiKeyManager.getActiveKey();
    // if (activeKey) {
    //   console.log('Using ' + activeKey.config.name + ' API');
    //   // Make API call with activeKey.key
    // }

    // Example: Saving data to Supabase
    // const sb = AppSupabase.getClient();
    // sb.from('your_table').insert({ ... });

    // Example: Reading data from Supabase
    // const sb = AppSupabase.getClient();
    // const { data, error } = await sb.from('your_table').select('*').eq('user_email', session.email);

    // ========================================
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', function() {
  // App initializes after membership gate and API key manager
  setTimeout(function() {
    const session = MembershipGate.getSession();
    if (session) {
      App.init();
    }
  }, 100);
});
