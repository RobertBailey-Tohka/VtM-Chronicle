/**
 * Module Fault Isolation, Error Boundary & Third-Party Worker Bootstrap
 * Ensures that an uncaught exception in any single widget or feature module
 * is logged and contained without breaking other sections of the VTT.
 */
(function () {
  const originalConsoleError = console.error;
  console.error = function (...args) {
    originalConsoleError.apply(console, args);
    try {
      fetch('/api/log_error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'CONSOLE_ERROR: ' + args.map(String).join(' ') })
      }).catch(() => {});
    } catch (e) {}
  };

  window.onerror = function (message, source, lineno, colno, error) {
    try {
      fetch('/api/log_error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          source,
          lineno,
          colno,
          stack: error && error.stack ? error.stack : ''
        })
      }).catch(() => {});
    } catch (e) {}
    return false;
  };

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason = event && event.reason ? (event.reason.stack || event.reason.message || String(event.reason)) : 'Unhandled Promise Rejection';
      originalConsoleError.call(console, '[VtM Fault Boundary] Unhandled async error:', reason);
    } catch (e) {}
  });

  window.addEventListener('DOMContentLoaded', () => {
    try {
      if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      }
    } catch (e) {}

    // Automatically detect if browser served a stale cached index.html from GitHub Pages CDN
    try {
      const currentScript = document.querySelector('script[src*="fault_isolation.js"]');
      const currentVerMatch = currentScript && currentScript.src ? currentScript.src.match(/[?&]v=([^&]+)/) : null;
      const currentVer = currentVerMatch ? currentVerMatch[1] : null;
      if (currentVer) {
        fetch(`index.html?_vtm_check=${Date.now()}`, { cache: 'no-store' })
          .then((r) => (r.ok ? r.text() : ''))
          .then((html) => {
            const liveMatch = html ? html.match(/fault_isolation\.js\?v=([^"&']+)/) : null;
            const liveVer = liveMatch ? liveMatch[1] : null;
            if (liveVer && liveVer !== currentVer) {
              const url = new URL(window.location.href);
              url.searchParams.set('v', liveVer);
              window.location.replace(url.toString());
            }
          })
          .catch(() => {});
      }
    } catch (e) {}
  });

  /**
   * Safely invokes a function (or global function name) inside a fault boundary
   * so that an error in one module never interrupts other modules.
   * Supports both vtmSafeCall(fnOrName, ...args) and vtmSafeCall(label, fn, ...args).
   */
  window.vtmSafeCall = function (firstArg, secondArg, ...restArgs) {
    let label = 'anonymous';
    let targetFn = null;
    let callArgs = [];

    if (typeof firstArg === 'string' && (typeof secondArg === 'function' || secondArg === null)) {
      label = firstArg;
      targetFn = secondArg || window[firstArg];
      callArgs = restArgs;
    } else if (typeof firstArg === 'function') {
      label = firstArg.name || 'anonymous';
      targetFn = firstArg;
      callArgs = secondArg !== undefined ? [secondArg, ...restArgs] : [];
    } else if (typeof firstArg === 'string') {
      label = firstArg;
      targetFn = window[firstArg];
      callArgs = secondArg !== undefined ? [secondArg, ...restArgs] : [];
    }

    try {
      if (typeof targetFn !== 'function') return undefined;
      const result = targetFn(...callArgs);
      if (result && typeof result.catch === 'function') {
        return result.catch((err) => {
          originalConsoleError.call(console, `[VtM Fault Boundary] Async error in ${label}:`, err);
          return undefined;
        });
      }
      return result;
    } catch (err) {
      originalConsoleError.call(console, `[VtM Fault Boundary] Isolated error in ${label}:`, err);
      return undefined;
    }
  };

  /**
   * Wraps a list of global functions belonging to a feature module in a fault boundary
   * so any error inside that module cannot crash callers in other modules.
   */
  window.vtmIsolateModule = function (moduleName, fnNames) {
    if (!Array.isArray(fnNames)) return;
    fnNames.forEach((fnName) => {
      const orig = window[fnName];
      if (typeof orig !== 'function' || orig.__vtmIsolated) return;
      const wrapped = function (...args) {
        try {
          const res = orig.apply(this, args);
          if (res && typeof res.catch === 'function') {
            return res.catch((err) => {
              originalConsoleError.call(console, `[VtM Fault Boundary][${moduleName}.${fnName}]`, err);
              return undefined;
            });
          }
          return res;
        } catch (err) {
          originalConsoleError.call(console, `[VtM Fault Boundary][${moduleName}.${fnName}]`, err);
          return undefined;
        }
      };
      wrapped.__vtmIsolated = true;
      window[fnName] = wrapped;
    });
  };

  // Automatically isolate cross-module widget & subsystem entrypoints once scripts load
  window.addEventListener('DOMContentLoaded', () => {
    window.vtmIsolateModule('chronicle_hub_and_coterie', [
      'renderChronicleHub',
      'renderActivePlayersBar',
      'openCoterieManagerModal',
      'loadCoterieModalData',
      'loadCoterieManagement',
      'syncAutoAcceptToggleUi',
      'toggleAutoAcceptJoinRequests',
      'togglePlayerDrawer'
    ]);
    window.vtmIsolateModule('chat_and_dice', [
      'loadChatMessages',
      'appendChatMessage',
      'updateChatSenderBadge',
      'initDiceWidgetDisplay',
      'loadRecentRolls',
      'submitDiceRoll',
      'stepDiceCounter'
    ]);
    window.vtmIsolateModule('city_map', [
      'initCanvasEngine',
      'loadGameboardState',
      'applySceneState',
      'loadMapPins',
      'renderMapPins',
      'createMapPinSubmit'
    ]);
    window.vtmIsolateModule('character_vault_and_dossier', [
      'loadCharacters',
      'updateDossierWidget',
      'renderCharacterCastWidget',
      'renderCoterieTokens',
      'renderStorytellerGodDossier',
      'renderUnassignedPlayerDossier'
    ]);
    window.vtmIsolateModule('storyteller_workshop_and_omni', [
      'loadCampaignsList',
      'renderChronicleTimelineEpisodes',
      'loadOmniUnrevealedClues',
      'loadOmniUnrevealedLore',
      'loadOmniHookAndAgendas'
    ]);
    window.vtmIsolateModule('clues_and_lore', [
      'loadClueMatricesForWidget',
      'populateClueMatrixWidgetSelect',
      'toggleClueCurrentEpisodeFilter',
      'openClueDetailWidget',
      'loadLoreMatricesForWidget',
      'renderWidgetClueCards',
      'addClueToBoard',
      'removeClueFromGameboard',
      'addLoreToGameboard',
      'removeLoreFromGameboard'
    ]);
    window.vtmIsolateModule('rulebook_and_notes', [
      'loadRulesCodex',
      'renderRulebookHierarchy',
      'renderWidgetRulebookHierarchy',
      'loadPersonalNotes',
      'savePersonalNote'
    ]);
    window.vtmIsolateModule('asset_library', [
      'fetchAssets',
      'fetchClanSymbols'
    ]);
  });
})();
