/**
 * Core State, Authentication, Navigation Tabs (switchTab), Desktop Widget Manager (toggleWidget), Chronicle Time, and VTM Dialogs
 */

// ---------------- CANONICAL NAMING & LEGACY COMPATIBILITY ----------------
const LEGACY_TAB_ID_MAP = {
  "lobby": "chronicle-hub",
  "characters": "character-vault",
  "campaigns": "storyteller-workshop",
  "rulebook": "rulebook-codex",
  "assets": "asset-library"
};
function normalizeTabId(tabId) {
  return LEGACY_TAB_ID_MAP[tabId] || tabId;
}

const LEGACY_WIDGET_ID_MAP = {
  "widget-map": "widget-city-map",
  "widget-dossier": "widget-character-dossier",
  "widget-npc-cast": "widget-character-cast",
  "widget-clues": "widget-clue-board",
  "widget-lore": "widget-lore-archive",
  "widget-story": "widget-chronicle-timeline",
  "widget-notes": "widget-personal-notes",
  "widget-rules": "widget-quick-rules",
  "widget-omni": "widget-storyteller-omni",
  "timeWidget": "widget-chronicle-time"
};
function normalizeWidgetId(widgetId) {
  return LEGACY_WIDGET_ID_MAP[widgetId] || widgetId;
}

const PERSISTENT_VISIBILITY_WIDGET_IDS = new Set([
  'widget-chat',
  'widget-dice',
  'widget-city-map',
  'widget-character-dossier',
  'widget-character-cast',
  'widget-clue-board',
  'widget-lore-archive',
  'widget-chronicle-timeline',
  'widget-personal-notes',
  'widget-quick-rules',
  'widget-storyteller-omni'
]);

function getWidgetLayoutStorageKey() {
  let uid = 'default';
  if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
    uid = String(currentUser.id);
  } else {
    try {
      const savedUser = JSON.parse(localStorage.getItem('vtm_user') || 'null');
      if (savedUser && savedUser.id) uid = String(savedUser.id);
    } catch (e) {}
  }
  return `vtm_widget_layout_v1_${uid}`;
}

/**
 * Saves the current visibility, position (left/top), dimensions (width/height),
 * z-index, and collapsed state of all Elysium widgets to localStorage so that
 * closing/reopening a widget or leaving and returning to the website restores
 * the exact layout the player or Storyteller had.
 *
 * @returns {void}
 */
function saveWidgetVisibility() {
  try {
    const storageKey = getWidgetLayoutStorageKey();
    let existingLayout = {};
    try {
      existingLayout = JSON.parse(localStorage.getItem(storageKey) || localStorage.getItem('vtm_widget_layout_v1') || '{}') || {};
    } catch (e) {
      existingLayout = {};
    }
    const widgetVisibilityStates = {};
    document.querySelectorAll('.elysium-widget').forEach(widgetElement => {
      if (!widgetElement.id) return;
      const computedStyle = window.getComputedStyle(widgetElement);
      const isVisible = computedStyle.display !== 'none';
      widgetVisibilityStates[widgetElement.id] = computedStyle.display;

      const prevEntry = existingLayout[widgetElement.id] || {};
      const bodyEl = widgetElement.querySelector('.widget-body');
      const isCollapsed = Boolean(bodyEl && bodyEl.style.display === 'none');

      // Only update coordinates/dimensions if currently visible or explicitly styled in inline CSS
      const leftVal = widgetElement.style.left || prevEntry.left || null;
      const topVal = widgetElement.style.top || prevEntry.top || null;
      const widthVal = widgetElement.style.width || prevEntry.width || null;
      const heightVal = widgetElement.style.height || prevEntry.height || null;
      const zIndexVal = widgetElement.style.zIndex || prevEntry.zIndex || null;

      existingLayout[widgetElement.id] = {
        display: PERSISTENT_VISIBILITY_WIDGET_IDS.has(widgetElement.id)
          ? (isVisible ? 'flex' : 'none')
          : (prevEntry.display || 'none'),
        left: leftVal,
        top: topVal,
        width: widthVal,
        height: heightVal,
        zIndex: zIndexVal,
        collapsed: isCollapsed
      };
    });

    const sheetWin = document.getElementById('characterSheetWindow');
    if (sheetWin) {
      const prevSheet = existingLayout.characterSheetWindow || {};
      existingLayout.characterSheetWindow = {
        left: sheetWin.style.left || prevSheet.left || null,
        top: sheetWin.style.top || prevSheet.top || null,
        width: sheetWin.style.width || prevSheet.width || null,
        height: sheetWin.style.height || prevSheet.height || null
      };
    }

    localStorage.setItem(storageKey, JSON.stringify(existingLayout));
    localStorage.setItem('vtm_widget_layout_v1', JSON.stringify(existingLayout));
    localStorage.setItem('vtm_widget_vis', JSON.stringify(widgetVisibilityStates));
  } catch (err) {
    console.warn('Could not persist widget layout state:', err);
  }
}

function restoreWidgetLayoutState() {
  try {
    const storageKey = getWidgetLayoutStorageKey();
    const rawLayout = localStorage.getItem(storageKey) || localStorage.getItem('vtm_widget_layout_v1');
    const savedVisRaw = localStorage.getItem('vtm_widget_vis');
    const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';

    if (rawLayout) {
      const layoutMap = JSON.parse(rawLayout);
      if (layoutMap && typeof layoutMap === 'object') {
        const vw = window.innerWidth || 1920;
        const vh = window.innerHeight || 1080;

        document.querySelectorAll('.elysium-widget').forEach(widgetElement => {
          const id = widgetElement.id;
          if (!id || !layoutMap[id]) return;
          const entry = layoutMap[id];

          // Restore position & dimensions (even if currently closed, so reopening places it where the user left it)
          if (entry.left) {
            const parsedLeft = parseFloat(entry.left);
            if (!Number.isNaN(parsedLeft)) {
              const clampedLeft = Math.max(0, Math.min(parsedLeft, Math.max(40, vw - 160)));
              widgetElement.style.left = `${clampedLeft}px`;
            }
          }
          if (entry.top) {
            const parsedTop = parseFloat(entry.top);
            if (!Number.isNaN(parsedTop)) {
              const clampedTop = Math.max(0, Math.min(parsedTop, Math.max(40, vh - 80)));
              widgetElement.style.top = `${clampedTop}px`;
            }
          }
          if (entry.width) {
            const parsedW = parseFloat(entry.width);
            if (!Number.isNaN(parsedW) && parsedW >= 180) {
              widgetElement.style.width = `${Math.min(parsedW, vw - 16)}px`;
            }
          }
          if (entry.height) {
            const parsedH = parseFloat(entry.height);
            if (!Number.isNaN(parsedH) && parsedH >= 120) {
              widgetElement.style.height = `${Math.min(parsedH, vh - 56)}px`;
            }
          }
          if (entry.zIndex) {
            const zNum = parseInt(entry.zIndex, 10);
            if (!Number.isNaN(zNum)) {
              widgetElement.style.zIndex = String(zNum);
              if (zNum > highestDesktopWidgetZIndex && zNum < 100000) {
                highestDesktopWidgetZIndex = zNum;
              }
            }
          }

          const bodyEl = widgetElement.querySelector('.widget-body');
          if (bodyEl) {
            if (entry.collapsed) {
              bodyEl.style.display = 'none';
              widgetElement.style.minHeight = '38px';
            } else {
              bodyEl.style.display = '';
              widgetElement.style.minHeight = '';
            }
          }

          if (PERSISTENT_VISIBILITY_WIDGET_IDS.has(id) && entry.display !== undefined) {
            if (widgetElement.classList.contains('gm-only-control') && !isStoryteller && activeChronicleRole) {
              widgetElement.style.display = 'none';
            } else {
              widgetElement.style.display = entry.display === 'none' ? 'none' : 'flex';
              if (entry.display !== 'none' && id === 'widget-quick-rules') {
                if (typeof allRules !== 'undefined' && allRules.length > 0) {
                  if (typeof renderWidgetRulebookHierarchy === 'function') renderWidgetRulebookHierarchy(allRules);
                } else if (typeof loadRulesCodex === 'function') {
                  loadRulesCodex().then(() => {
                    if (typeof renderWidgetRulebookHierarchy === 'function') renderWidgetRulebookHierarchy(allRules);
                  });
                }
              }
            }
          }
        });

        const sheetWin = document.getElementById('characterSheetWindow');
        if (sheetWin && layoutMap.characterSheetWindow) {
          const sw = layoutMap.characterSheetWindow;
          if (sw.left) sheetWin.style.left = sw.left;
          if (sw.top) sheetWin.style.top = sw.top;
          if (sw.width) sheetWin.style.width = sw.width;
          if (sw.height) sheetWin.style.height = sw.height;
        }
        return true;
      }
    }

    if (savedVisRaw) {
      const visMap = JSON.parse(savedVisRaw);
      if (visMap && typeof visMap === 'object') {
        document.querySelectorAll('.elysium-widget').forEach(widgetElement => {
          const id = widgetElement.id;
          if (PERSISTENT_VISIBILITY_WIDGET_IDS.has(id) && visMap[id] !== undefined) {
            if (widgetElement.classList.contains('gm-only-control') && !isStoryteller && activeChronicleRole) {
              widgetElement.style.display = 'none';
            } else {
              widgetElement.style.display = visMap[id] === 'none' ? 'none' : 'flex';
            }
          }
        });
        return true;
      }
    }
  } catch (e) {
    console.warn('Failed to restore widget layout state:', e);
  }
  return false;
}

let currentMapPins = [];
let globalClanSymbols = [];
let npcCategoriesList = [];
// Initialize a real-time bidirectional WebSocket connection to the server using the Socket.IO client library
const socket = io();
let currentUser = null;
let activeChronicleRole = null;
let currentAuthMode = 'login';
let activeChronicleId = null;
let activeEpisodeId = 12;
let currentLoadedCharacterId = null;
let activeControlledCharacterId = null;
let chronicleCharactersList = [];
let currentChronicleData = null;
let currentEpisodeData = null;
let chronicleMembersList = [];
// Listen for the Socket.IO 'connect' event fired when the client establishes a connection to the server
socket.on('connect', () => {
  // Query the DOM for the socket connection status indicator element by its ID
  document.getElementById('socketStatus').innerHTML = '<span class="status-dot"></span> <span class="status-text">LIVE</span>';
  // Emit a Socket.IO event to join the active chronicle's real-time broadcast room only if inside an approved chronicle
  if (activeChronicleId && currentUser) {
    socket.emit('room:join', {
      campaignId: activeChronicleId,
      chronicleId: activeChronicleId,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName || currentUser.username,
      role: activeChronicleRole || 'player',
      avatar: currentUser.avatar || currentUser.avatar_url || null,
      characterId: activeControlledCharacterId || null
    });
  }
});
// Listen for the Socket.IO 'disconnect' event fired when the connection to the server is lost
socket.on('disconnect', () => {
  // Query the DOM for the socket connection status indicator element by its ID
  document.getElementById('socketStatus').innerHTML = '<span class="status-dot" style="background:#ef4444;box-shadow:0 0 6px #ef4444;"></span> <span class="status-text" style="color:#ef4444;">OFFLINE</span>';
});
// Listen for incoming dice roll results broadcast by the server via Socket.IO
socket.on('dice:result', rollResult => { if (typeof window.enqueueCinematicRoll === 'function') { window.enqueueCinematicRoll(rollResult); } else { appendDiceRollToLedger(rollResult); } });
// Listen for secret dice roll notifications broadcast by the server via Socket.IO
socket.on('dice:secret_rolled', secretRollData => {
  if (activeChronicleRole === 'player') {
    // Query the DOM for the dice ledger container element by its ID
    const diceLedgerElement = document.getElementById('diceLedger');
    // Create a new div element in the DOM to display the secret roll notice
    const rollEntryElement = document.createElement('div');
    rollEntryElement.className = 'roll-entry';
    rollEntryElement.innerHTML = `<span style="color:#9ca3af;font-style:italic;"><i class="fa-solid fa-user-secret"></i> ${secretRollData.rollerName} rolled a secret test.</span>`;
    diceLedgerElement.prepend(rollEntryElement);
  }
});
// Listen for gameboard scene updates broadcast by the server via Socket.IO
socket.on('gameboard:scene_updated', sceneState => {
  applySceneState(sceneState);
});
// Listen for episode updates broadcast by the server via Socket.IO
socket.on('episode:updated', updatedEpisode => {
  if (activeChronicleId && typeof loadGameboardState === 'function') loadGameboardState();
  if (typeof renderChronicleTimelineEpisodes === 'function') renderChronicleTimelineEpisodes();
  if (typeof loadClueMatricesForWidget === 'function') loadClueMatricesForWidget();
  if (typeof loadLoreMatricesForWidget === 'function') loadLoreMatricesForWidget();
});
// Listen for relationship map updates broadcast by the server via Socket.IO
socket.on('gameboard:relationship_map_updated', relationshipMapData => {
  if (activeChronicleId && (String(relationshipMapData.chronicle_id) === String(activeChronicleId)) && relationshipMapData.map_state && typeof loadRmapState === 'function') {
      if (typeof rmapDraggingNode !== 'undefined' && (rmapDraggingNode !== null || rmapConnectingFrom !== null)) return;
      const parsedMapState = typeof relationshipMapData.map_state === 'string' ? JSON.parse(relationshipMapData.map_state) : relationshipMapData.map_state;
      loadRmapState(parsedMapState);
  }
});
// Listen for gameboard canvas updates broadcast by the server via Socket.IO
socket.on('gameboard:canvas_updated', canvasUpdateData => {
  if (activeChronicleId && (String(canvasUpdateData.campaign_id) === String(activeChronicleId) || String(canvasUpdateData.chronicle_id) === String(activeChronicleId)) && canvasUpdateData.canvas_state) {
    loadCanvasFromState(canvasUpdateData.canvas_state, false);
  }
});
// Listen for new chat messages broadcast by the server via Socket.IO
socket.on('chat:new_message', messageData => {
  if (activeChronicleId && (messageData.chronicle_id === activeChronicleId || messageData.campaign_id === activeChronicleId)) {
    appendChatMessage(messageData);
  }
});
// Listen for clue reveal events broadcast by the server via Socket.IO
socket.on('gameboard:clue_revealed', revealedClueData => {
  addClueToBoard(revealedClueData);
  loadClueMatricesForWidget();
  if (activeEpisodeId && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
});
// Listen for clue hide events broadcast by the server via Socket.IO
socket.on('gameboard:clue_hidden', hiddenClueData => {
  removeClueFromGameboard(hiddenClueData.id);
  loadClueMatricesForWidget();
  if (activeEpisodeId && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
});
// Listen for lore reveal events broadcast by the server via Socket.IO
socket.on('gameboard:lore_revealed', revealedLoreData => {
  addLoreToGameboard(revealedLoreData);
  loadLoreMatricesForWidget();
  if (activeEpisodeId && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
});
// Listen for lore hide events broadcast by the server via Socket.IO
socket.on('gameboard:lore_hidden', hiddenLoreData => {
  removeLoreFromGameboard(hiddenLoreData.id);
  loadLoreMatricesForWidget();
  if (activeEpisodeId && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
});
// Listen for chronicle UI setting updates broadcast by the server via Socket.IO
socket.on('chronicle:ui_settings_updated', (uiSettingsData) => {
    chronicleUiSettings = (uiSettingsData && uiSettingsData.ui_settings) ? uiSettingsData.ui_settings : uiSettingsData;
    if (typeof activeWidgetMatrixId !== 'undefined' && activeWidgetMatrixId) {
        renderWidgetClueCards(activeWidgetMatrixId);
    }
});

// Helper to notify any open character sheet iframes (Vault modal + floating widgets) when a character updates
function notifyOpenCharacterSheetFrames(updatedCharId) {
  const targetId = updatedCharId ? Number(updatedCharId) : null;
  if (
    typeof currentLoadedCharacterId !== 'undefined' &&
    currentLoadedCharacterId &&
    (!targetId || targetId === Number(currentLoadedCharacterId))
  ) {
    const sheetIframeElement = document.getElementById('sheetFrame');
    if (sheetIframeElement && sheetIframeElement.contentWindow) {
      sheetIframeElement.contentWindow.postMessage({
        type: 'vtm:remote_character_updated',
        charId: Number(currentLoadedCharacterId)
      }, '*');
    }
  }
  document.querySelectorAll('iframe[src*="V5-Character-Sheet"]').forEach(frame => {
    if (frame.id === 'sheetFrame' || !frame.contentWindow) return;
    const match = (frame.src || '').match(/[?&]id=(\d+)/);
    const frameCharId = match ? Number(match[1]) : null;
    if (!targetId || !frameCharId || targetId === frameCharId) {
      frame.contentWindow.postMessage({
        type: 'vtm:remote_character_updated',
        charId: frameCharId || targetId
      }, '*');
    }
  });
}

// Listen for character sheet updates broadcast by the server via Socket.IO
socket.on('character:updated', updatedCharacterRecord => {
  if (activeChronicleId) {
    loadGameboardState();
    loadCharacters();
    notifyOpenCharacterSheetFrames(updatedCharacterRecord && (updatedCharacterRecord.id || updatedCharacterRecord.character_id));
  }
});
// Listen for character vitals updates broadcast by the server via Socket.IO
socket.on('character:vitals_updated', vitalsUpdateData => {
  if (activeChronicleId) {
    loadCharacters();
    notifyOpenCharacterSheetFrames(vitalsUpdateData && (vitalsUpdateData.id || vitalsUpdateData.character_id));
  }
});
// Listen for active city map URL changes broadcast by the server via Socket.IO
socket.on('gameboard:map_updated', mapUpdateData => {
  if (mapUpdateData && mapUpdateData.active_map_url) {
    switchCityMap(mapUpdateData.active_map_url);
  }
});
// Listen for rulebook codex updates broadcast by the server via Socket.IO
socket.on('rules:updated', () => {
  loadRulesCodex();
});
// Listen for incoming coterie join requests broadcast by the server via Socket.IO
socket.on('coterie:request_received', requestData => {
  const targetChronId = Number(requestData && (requestData.chronicle_id || requestData.campaign_id || requestData.chronicleId));
  if ((activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') && Number(activeChronicleId) === targetChronId) {
    updatePendingBadgeCount();
    // Query the DOM for the coterie manager modal element by its ID
    const pendingModalElement = document.getElementById('coterieManagerModal');
    if (pendingModalElement && pendingModalElement.classList.contains('active')) {
      loadCoterieModalData();
    }
    if (typeof loadCoterieManagement === 'function') {
      loadCoterieManagement();
    }
  }
});
// Listen for coterie join request approvals broadcast by the server via Socket.IO
socket.on('coterie:request_approved', approvalData => {
  const approvedUid = Number(approvalData && (approvalData.user_id || approvalData.userId));
  if (currentUser && Number(currentUser.id) === approvedUid) {
    // Display an alert notification informing the user their join request was approved
    alert('Your request to join the chronicle has been approved by the Storyteller!');
    // Query the DOM for the chronicle hub tab view element by its ID
    const lobbyViewElement = document.getElementById('tab-chronicle-hub');
    if (lobbyViewElement && lobbyViewElement.classList.contains('active')) {
      renderChronicleHub();
    }
  }
});
function evictRemovedPlayerToHub(reasonMessage) {
  // Close any open modal or character sheet overlay immediately
  document.querySelectorAll('.vtm-modal.active, .modal-backdrop.active, .modal.active').forEach(modalElement => {
    modalElement.classList.remove('active');
    modalElement.style.display = '';
  });
  const sheetModal = document.getElementById('characterSheetModal');
  if (sheetModal) {
    sheetModal.classList.remove('active');
    sheetModal.style.display = '';
  }
  localStorage.removeItem('vtm_last_chronicle_id');
  localStorage.removeItem('vtm_last_chronicle_role');
  localStorage.setItem('vtm_active_tab', 'chronicle-hub');
  if (reasonMessage) {
    alert(reasonMessage);
  }
  returnToChronicleHub();
}
window.evictRemovedPlayerToHub = evictRemovedPlayerToHub;

// Listen for coterie member removal or request denial broadcast by the server via Socket.IO
socket.on('coterie:member_removed', removalData => {
  const removedUid = Number(removalData && (removalData.user_id || removalData.userId));
  const targetChronId = Number(removalData && (removalData.chronicle_id || removalData.campaign_id || removalData.chronicleId));
  if (currentUser && Number(currentUser.id) === removedUid) {
    if (activeChronicleId && (!targetChronId || Number(activeChronicleId) === targetChronId)) {
      evictRemovedPlayerToHub('You have been removed from this Chronicle by the Storyteller. Returning to the Chronicle Hub.');
    } else {
      const lobbyViewElement = document.getElementById('tab-chronicle-hub');
      if (lobbyViewElement && lobbyViewElement.classList.contains('active')) {
        renderChronicleHub();
      }
    }
  } else if (removedUid) {
    // Update the active player roster and coterie management views immediately for the Storyteller and other players
    if (Array.isArray(currentChronicleActiveUsers)) {
      currentChronicleActiveUsers = currentChronicleActiveUsers.filter(u => Number(u.userId || u.id) !== removedUid);
      if (typeof renderActivePlayersBar === 'function') {
        renderActivePlayersBar(currentChronicleActiveUsers);
      }
    }
    if (typeof loadCoterieManagement === 'function') loadCoterieManagement();
    if (typeof loadCoterieModalData === 'function') {
      const coterieModal = document.getElementById('coterieManagementModal');
      if (coterieModal && (coterieModal.classList.contains('active') || coterieModal.style.display === 'flex')) {
        loadCoterieModalData();
      }
    }
  }
});
// Listen for active player presence synchronization events from Socket.IO
socket.on('presence:sync', activeUsersList => {
  currentChronicleActiveUsers = activeUsersList || [];
  renderActivePlayersBar(currentChronicleActiveUsers);
});
// Register a DOMContentLoaded listener on the document to initialize the application once HTML parsing finishes
document.addEventListener('DOMContentLoaded', () => {
  checkActiveSession();
  loadRulesCodex();
  initDesktopWidgetsDragAndResize();
  initDiceWidgetDisplay();
  try {
      const restoredSavedLayout = restoreWidgetLayoutState();
      if (!restoredSavedLayout) {
          // Read the user's configured startup widgets list from browser localStorage
          let startupList = localStorage.getItem('vtm_startup_widgets');
          if (!startupList) {
              startupList = ['widget-chat', 'widget-dice', 'widget-city-map', 'widget-character-dossier'];
          } else {
              startupList = JSON.parse(startupList).map(normalizeWidgetId);
          }
          
          // Query all Elysium widget elements in the DOM to set their initial startup visibility
          document.querySelectorAll('.elysium-widget').forEach(widgetElement => {
              if (startupList.includes(widgetElement.id)) {
                  widgetElement.style.display = 'flex';
                  if (widgetElement.id === 'widget-quick-rules') {
                      if (typeof allRules !== 'undefined' && allRules.length > 0) {
                          if (typeof renderWidgetRulebookHierarchy === 'function') renderWidgetRulebookHierarchy(allRules);
                      } else {
                          loadRulesCodex().then(() => {
                              if (typeof renderWidgetRulebookHierarchy === 'function') renderWidgetRulebookHierarchy(allRules);
                          });
                      }
                  }
              } else {
                  widgetElement.style.display = 'none';
              }
          });
      }
  } catch(startupError) { console.error('Startup widget error:', startupError); }
  window.addEventListener('beforeunload', () => {
    try { saveWidgetVisibility(); } catch (e) {}
  });
  // Read the saved widget opacity percentage from browser localStorage
  const savedOpacity = localStorage.getItem('vtm_widget_opacity');
  if (savedOpacity) {
    document.documentElement.style.setProperty('--widget-opacity', (parseInt(savedOpacity, 10) / 100).toFixed(2));
  }
  // Read the saved backdrop brightness percentage from browser localStorage
  const savedBrightness = localStorage.getItem('vtm_backdrop_brightness');
  if (savedBrightness) {
    document.documentElement.style.setProperty('--backdrop-brightness', (parseInt(savedBrightness, 10) / 100).toFixed(2));
  }
  // Read the saved global backdrop image URL from browser localStorage
  const savedBackdrop = localStorage.getItem('vtm_global_backdrop');
  if (savedBackdrop) {
    // Query the DOM for the global backdrop image element by its ID
    const globalBackdropImageElement = document.getElementById('globalBackdropImg');
    if (globalBackdropImageElement) globalBackdropImageElement.src = savedBackdrop;
  }
});
// Register a keydown event listener on the document to close active modals when Escape is pressed
document.addEventListener('keydown', keyboardEvent => {
  if (keyboardEvent.key === 'Escape') {
    // Query all currently active modal elements in the DOM
    const activeModals = document.querySelectorAll('.vtm-modal.active, .modal-backdrop.active, .modal.active');
    activeModals.forEach(modalElement => modalElement.classList.remove('active'));
  }
});
let activeNpcPersonaId = null;
let activeNpcCastCategory = 'all';
let currentChronicleActiveUsers = [];
let personaSelectorDropdownEl = null;
let newCharAvatarDataUrl = null;
function createLoreEntrySubmit(...submitArguments) { return createLoreSubmit(...submitArguments); }
let allRules = [];
let activeRuleCategory = 'All';
let canvasState = {
  backdrop: '/images/concept_map.jpg',
  entities: [],
  links: []
};
let canvasTransform = {
  panX: -413,
  panY: -227,
  zoom: 0.4,
  isPanning: false,
  startX: 0,
  startY: 0
};
let activeDragEntity = null;
let activeResizeEntity = null;
let linkingSourceEntityId = null;
let unlinkingSourceEntityId = null;

const CARD_COLOR_THEMES = [{
  name: 'crimson',
  border: 'rgba(239, 68, 68, 0.4)',
  glow: 'rgba(239, 68, 68, 0.25)',
  accent: '#ef4444'
}, {
  name: 'amber',
  border: 'rgba(245, 158, 11, 0.4)',
  glow: 'rgba(245, 158, 11, 0.25)',
  accent: '#f59e0b'
}, {
  name: 'emerald',
  border: 'rgba(16, 185, 129, 0.4)',
  glow: 'rgba(16, 185, 129, 0.25)',
  accent: '#10b981'
}, {
  name: 'sapphire',
  border: 'rgba(59, 130, 246, 0.4)',
  glow: 'rgba(59, 130, 246, 0.25)',
  accent: '#3b82f6'
}, {
  name: 'amethyst',
  border: 'rgba(168, 85, 247, 0.4)',
  glow: 'rgba(168, 85, 247, 0.25)',
  accent: '#a855f7'
}, {
  name: 'obsidian',
  border: 'rgba(255, 255, 255, 0.15)',
  glow: 'rgba(0, 0, 0, 0.5)',
  accent: '#9ca3af'
}];
const FONT_SIZE_STEPS = ['12px', '14px', '16px', '18px'];
let canvasListenersAttached = false;
let currentChatChannel = 'ic';
let isChatDragging = false;
let chatDragOffset = {
  x: 0,
  y: 0
};
let highestDesktopWidgetZIndex = 100;
let activeWidgetDrag = null;
let activeWidgetResize = null;
let desktopListenersAttached = false;
let currentEpisodeClues = [{
  id: 'e1',
  code: 'E1',
  title: 'Ritual Site',
  status: 'discovered',
  delivery_method: 'Crime Scene Search',
  location_hint: 'St. Jude Crypt, Camden',
  description: 'An intricate circle of purified ash and dried sanguine vitae was uncovered near the eastern crypt gate. Preliminary occult analysis indicates early-stage Thaumaturgical ritualism, abandoned approximately 48 hours prior to discovery.'
}, {
  id: 'e2',
  code: 'E2',
  title: 'Sanguine Treaty',
  status: 'discovered',
  delivery_method: 'Archival Decryption',
  location_hint: 'Tremere Chantry Library',
  description: 'A scorched parchment detailing a non-aggression pact between local Ventrue elders and the Anarch barony, sealed in blood in 1982. Mentions mutual silence regarding incidents along Highway 31W.'
}, {
  id: 'e3',
  code: 'E3',
  title: 'Police Report',
  status: 'discovered',
  delivery_method: 'Police Wiretap / Contact',
  location_hint: 'Radcliff Precinct Archives',
  description: 'Official homicide incident report #1982-A4. The coroner classified multiple exsanguinations along the roadway as "violent animal predations" under direct orders from an unidentified municipal commissioner.'
}, {
  id: 'e4',
  code: 'E4',
  title: 'Missing Tremere',
  status: 'discovered',
  delivery_method: 'Coterie Interrogation',
  location_hint: 'The Black Rose Nightclub',
  description: 'Scholar Sean Mercer of House Tremere failed to report to evening roll call for three consecutive weeks. Witnesses report he was last observed departing in an unmarked black sedan heading towards the grain mill.'
}];
let allChronicleClueMatrices = [];
let activeWidgetMatrixId = null;
let allChronicleLoreMatrices = [];
let activeWidgetLoreMatrixId = null;
let activeLoreWidgetCategory = 'all';
// Register a global click listener on the window to close open header dropdowns when clicking outside them
window.addEventListener('click', clickEvent => {
  if (!clickEvent.target.closest('.elysium-dropdown-container')) closeVttDropdown();
  if (!clickEvent.target.closest('.elysium-user-capsule')) closeUserDropdown();
});
// Register a cross-window message listener on the window to handle character sheet iframe events
window.addEventListener('message', messageEvent => {
  if (messageEvent.data && messageEvent.data.type === 'vtm:reopen_sheet') {
    const characterId = Number(messageEvent.data.char_id);
    const newTemplate = messageEvent.data.template;
    
    const characterRecord = chronicleCharactersList.find(characterItem => characterItem.id === characterId);
    if (characterRecord && newTemplate) {
      try {
        let parsedSheetData = typeof characterRecord.sheet_data === 'string' ? JSON.parse(characterRecord.sheet_data) : characterRecord.sheet_data;
        if (!parsedSheetData) parsedSheetData = {};
        parsedSheetData.sheet_template = newTemplate;
        characterRecord.sheet_data = parsedSheetData;
      } catch(parseError) {}
    }
    
    // Check if the modal version of the character sheet is open
    // Query the DOM for the character sheet modal element by its ID
    const sheetModalElement = document.getElementById('characterSheetModal');
    if (sheetModalElement && sheetModalElement.classList.contains('active') && currentLoadedCharacterId === characterId) {
       // Query the DOM for the character sheet iframe element by its ID
       const sheetIframeElement = document.getElementById('sheetFrame');
       if (sheetIframeElement) {
           const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
           const authList = characterRecord && Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids.map(Number) : [];
           const canEdit = Boolean(
             isStoryteller ||
             (characterRecord && currentUser && (Number(characterRecord.user_id) === Number(currentUser.id) || authList.includes(Number(currentUser.id))))
           );
           sheetIframeElement.src = `/sheets/${newTemplate}?char_id=${characterId}&readonly=${!canEdit}&is_gm=${isStoryteller}&_t=${Date.now()}`;
       }
    } else {
       // Otherwise, assume it's the floating widget version
       const widgetId = `floating-sheet-${characterId}`;
       // Query the DOM for any existing floating character sheet widget for this character
       const existingWidgetElement = document.getElementById(widgetId);
       if (existingWidgetElement) existingWidgetElement.remove();
       openFloatingCharacterSheet(characterId);
    }
    return;
  }
  
  if (messageEvent.data && messageEvent.data.type === 'vtm:sheet_updated') {
    const characterId = Number(messageEvent.data.char_id);
    const characterRecord = chronicleCharactersList.find(characterItem => characterItem.id === characterId);
    if (characterRecord) {
      if (messageEvent.data.vitals) {
        Object.assign(characterRecord, messageEvent.data.vitals);
      }
      if (messageEvent.data.sheet_data) {
        characterRecord.sheet_data = messageEvent.data.sheet_data;
      }
      if (currentLoadedCharacterId === characterId || activeControlledCharacterId === characterId || activeNpcPersonaId === characterId) {
        updateDossierWidget(characterRecord);
      }
      renderCoterieTokens(chronicleCharactersList);
      renderCharacterCastWidget();
      loadCharacters();
    }
  }
});


// --- NEW GLOBALS ---
const originalToggleWidget = toggleWidget;
  window.toggleWidget = function (widgetId) {
    originalToggleWidget(widgetId);
    if (widgetId === 'widget-chronicle-timeline') {
      renderChronicleTimelineEpisodes();
  loadPersonalNotes();
    }
  };
  let mapPinMode = false;
  // Query the DOM for the canvas stage element and attach a click listener for placing map pins
  document.getElementById('canvasStage')?.addEventListener('click', async clickEvent => {
    if (!mapPinMode) return;
    const canvasStageElement = clickEvent.currentTarget;
    // Measure the screen bounding rectangle of the canvas stage element
    const stageBoundingRect = canvasStageElement.getBoundingClientRect();
    let scale = 1;
    const transformMatch = canvasStageElement.style.transform.match(/scale\(([^)]+)\)/);
    if (transformMatch) scale = parseFloat(transformMatch[1]);
    const pinCoordinateX = Math.round((clickEvent.clientX - stageBoundingRect.left) / scale);
    const pinCoordinateY = Math.round((clickEvent.clientY - stageBoundingRect.top) / scale);
    // Query the active city map URL in normalized form
    const rawUrl = typeof getActiveCityMapUrl === 'function'
      ? getActiveCityMapUrl()
      : (canvasState?.backdrop || document.getElementById('episodeMapSelector')?.value || '');
    const mapUrl = typeof normalizeCityMapUrl === 'function'
      ? normalizeCityMapUrl(rawUrl)
      : new URL(rawUrl, window.location.origin).pathname;

    toggleMapPinMode();

    // Open the aesthetic VTM Drop Map Pin Modal (#newMapPinModal) instead of native browser prompt()
    const modalElement = document.getElementById('newMapPinModal');
    if (modalElement) {
      modalElement.dataset.coordMode = 'stage';
      modalElement.dataset.targetMapUrl = mapUrl;
      const pinXInput = document.getElementById('newPinX');
      const pinYInput = document.getElementById('newPinY');
      const pinTitleInput = document.getElementById('newPinTitle');
      const pinDescInput = document.getElementById('newPinDescription');
      const pinSecInput = document.getElementById('newPinSecurity');
      const pinInfInput = document.getElementById('newPinInfiltration');
      if (pinXInput) pinXInput.value = String(pinCoordinateX);
      if (pinYInput) pinYInput.value = String(pinCoordinateY);
      if (pinTitleInput) {
        pinTitleInput.value = '';
        pinTitleInput.onkeydown = (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            if (typeof createMapPinSubmit === 'function') createMapPinSubmit();
          }
        };
      }
      if (pinDescInput) pinDescInput.value = '';
      if (pinSecInput) pinSecInput.value = '';
      if (pinInfInput) pinInfInput.value = '';
      modalElement.classList.add('active');
      modalElement.style.zIndex = '9999999';
      setTimeout(() => {
        if (pinTitleInput) pinTitleInput.focus();
      }, 50);
    }
  });
  // Listen for map pin updates broadcast by the server via Socket.IO
  socket.on('gameboard:pins_updated', () => {
    if (typeof loadMapPins === 'function') loadMapPins();
    if (typeof loadCampaignPins === 'function' && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) {
      loadCampaignPins();
    }
  });
  window.editingNpcCategoryId = null;
  let vtmPromptResolve = null;
  let globalAssets = [];

  window.alert = function (message) {
    if (typeof vtmAlert === 'function') {
      vtmAlert(message);
    } else {
      console.warn('Alert:', message);
    }
  };



/**
 * A wrapper around the standard browser fetch API that automatically includes 
 * the user's authentication token in the request headers. This ensures that 
 * API calls to protected endpoints are properly authorized.
 * 
 * @param {string} url - The URL to fetch.
 * @param {Object} [options={}] - Additional options for the fetch request (e.g., method, body).
 * @returns {Promise<Response>} A promise that resolves to the fetch Response object.
 */
function authFetch(url, options = {}) {
  // Retrieve the stored JWT authentication token from browser localStorage
  const token = localStorage.getItem('vtm_auth_token');
  const headers = options.headers ? { ...options.headers } : {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  // Execute an HTTP network request using the browser's native Fetch API
  return fetch(url, { ...options, headers }).then(async (fetchResponse) => {
      if (fetchResponse.status === 400) {
          const clonedResponse = fetchResponse.clone();
          try {
              const errorResponseData = await clonedResponse.json();
              if (errorResponseData.error && errorResponseData.error.includes('DATA_INTEGRITY_ERROR')) {
                  // Display an alert notification warning the user of a data integrity error
                  alert(errorResponseData.error + "\n\nThis incident has been logged. Please notify your Storyteller or Administrator.");
              }
          } catch(jsonParseError) {}
      } else if (fetchResponse.status === 403 && activeChronicleId && activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller') {
          const clonedResponse = fetchResponse.clone();
          try {
              const errorResponseData = await clonedResponse.json();
              if (errorResponseData && errorResponseData.error && (errorResponseData.error.includes('Access denied') || errorResponseData.error.includes('approval is required') || errorResponseData.error.includes('no longer an active member'))) {
                  evictRemovedPlayerToHub(errorResponseData.error);
              }
          } catch (jsonParseError) {}
      }
      return fetchResponse;
  });
}


/**
 * Checks if the user has a valid active session by verifying their auth token 
 * with the backend server. If valid, it logs the user in and loads their last 
 * active chronicle; otherwise, it displays the authentication gateway.
 * 
 * @returns {Promise<void>}
 */
async function checkActiveSession() {
  // Retrieve the stored JWT authentication token from browser localStorage
  const token = localStorage.getItem('vtm_auth_token');
  if (!token) {
    showAuthGateway();
    return;
  }
  try {
    // Send an authenticated HTTP GET request to verify the current user's session
    const fetchResponse = await authFetch('/api/auth/me');
    if (fetchResponse.ok) {
      // Parse the JSON user session data from the HTTP response
      const sessionData = await fetchResponse.json();
      currentUser = sessionData.user;
      hideAuthGateway();
      // Read the last active chronicle ID and role from browser localStorage
      const lastChronicleId = localStorage.getItem('lastChronicleId');
      const lastChronicleRole = localStorage.getItem('lastChronicleRole');
      if (lastChronicleId && lastChronicleRole) {
          // Read the last active navigation tab ID from browser localStorage
          const savedTab = localStorage.getItem('vtm_active_tab') || 'gameboard';
          enterChronicle(lastChronicleId, lastChronicleRole, savedTab);
      } else {
          returnToChronicleHub();
      }
    } else {
      // Remove the expired or invalid authentication token from browser localStorage
      localStorage.removeItem('vtm_auth_token');
      showAuthGateway();
    }
  } catch (errorObject) {
    console.error('Session check failed:', errorObject);
    showAuthGateway();
  }
}

/**
 * Displays the authentication gateway (login/register screen) to the user.
 * It makes the gateway container visible and resets any previous error messages.
 * 
 * @returns {void}
 */
function showAuthGateway() {
  // Query the DOM for the authentication gateway overlay and error message elements by their IDs
  document.getElementById('authGateway').style.display = 'flex';
  document.getElementById('authErrorMessage').style.display = 'none';
  switchAuthTab('login');
}

/**
 * Hides the authentication gateway from the screen.
 * This is called after a successful login or session verification.
 * 
 * @returns {void}
 */
function hideAuthGateway() {
  // Query the DOM for the authentication gateway overlay element by its ID and hide it
  document.getElementById('authGateway').style.display = 'none';
}

function switchAuthTab(authMode) {
  currentAuthMode = authMode;
  // Query the DOM for the authentication tab buttons, display name group, submit button, and error box
  document.getElementById('authTabLogin').classList.toggle('active', authMode === 'login');
  document.getElementById('authTabRegister').classList.toggle('active', authMode === 'register');
  document.getElementById('authDisplayNameGroup').style.display = authMode === 'register' ? 'block' : 'none';
  document.getElementById('authSubmitBtn').innerText = authMode === 'login' ? 'ENTER THE NIGHT' : 'CREATE ACCOUNT & ENTER';
  document.getElementById('authErrorMessage').style.display = 'none';
  // Query the DOM for the password input and password visibility toggle icon elements
  const passwordInputElement = document.getElementById('authPassword');
  const passwordToggleIconElement = document.getElementById('togglePasswordIcon');
  if (passwordInputElement) passwordInputElement.type = 'password';
  if (passwordToggleIconElement) {
    passwordToggleIconElement.classList.remove('fa-eye-slash');
    passwordToggleIconElement.classList.add('fa-eye');
  }
}

function togglePasswordVisibility(inputElementId, iconElementId) {
  // Query the DOM for the target password input and eye icon elements by their IDs
  const passwordInputElement = document.getElementById(inputElementId);
  const toggleIconElement = document.getElementById(iconElementId);
  if (!passwordInputElement) return;
  if (passwordInputElement.type === 'password') {
    passwordInputElement.type = 'text';
    if (toggleIconElement) {
      toggleIconElement.classList.remove('fa-eye');
      toggleIconElement.classList.add('fa-eye-slash');
    }
  } else {
    passwordInputElement.type = 'password';
    if (toggleIconElement) {
      toggleIconElement.classList.remove('fa-eye-slash');
      toggleIconElement.classList.add('fa-eye');
    }
  }
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.submitAuth = submitAuth;
}

function submitAuth(submitEvent) {
  if (submitEvent && typeof submitEvent.preventDefault === 'function') submitEvent.preventDefault();
  return handleAuthSubmit(submitEvent || window.event || ({
    preventDefault: () => {}
  }));
}

async function handleAuthSubmit(submitEvent) {
  if (submitEvent && typeof submitEvent.preventDefault === 'function') submitEvent.preventDefault();
  // Query the DOM for the authentication username, password, display name, and error box elements
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const displayName = document.getElementById('authDisplayName').value.trim();
  const errorMessageElement = document.getElementById('authErrorMessage');
  errorMessageElement.style.display = 'none';
  const endpoint = currentAuthMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const payload = {
    username,
    password,
    display_name: displayName
  };
  try {
    // Send an HTTP POST request using the browser Fetch API to authenticate or register the user
    const fetchResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    // Parse the JSON authentication response from the server
    const authResponseData = await fetchResponse.json();
    if (fetchResponse.ok && authResponseData.success) {
      // Store the returned JWT authentication token in browser localStorage
      localStorage.setItem('vtm_auth_token', authResponseData.token);
      currentUser = authResponseData.user;
      hideAuthGateway();
      returnToChronicleHub();
    } else {
      errorMessageElement.innerText = authResponseData.error || 'Authentication failed. Please verify credentials.';
      errorMessageElement.style.display = 'block';
    }
  } catch (errorObject) {
    errorMessageElement.innerText = 'Network error contacting authentication server.';
    errorMessageElement.style.display = 'block';
  }
}

function logout() {
  // Emit a Socket.IO event to leave the current chronicle room before logging out
  if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('room:leave');
  // Remove the user's authentication token from browser localStorage
  localStorage.removeItem('vtm_auth_token');
  localStorage.removeItem('vtm_user');
  currentUser = null;
  activeChronicleId = null;
  activeChronicleRole = null;
  showAuthGateway();
}

function returnToChronicleHub() {
  // Clear the last active chronicle ID and role from browser localStorage
  localStorage.removeItem('lastChronicleId');
  localStorage.removeItem('lastChronicleRole');
  // Emit a Socket.IO event to leave the active chronicle room when returning to the hub
  if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('room:leave');
  activeChronicleId = null;
  activeChronicleRole = null;
  currentChronicleData = null;
  document.body.className = 'role-hub';
  if (currentUser) {
    const userDisplayName = currentUser.displayName || currentUser.username;
    // Query the DOM for the profile display name, role badge, and user dropdown label elements
    const profileDisplayNameElement = document.getElementById('profileDisplayName');
    if (profileDisplayNameElement) profileDisplayNameElement.innerText = userDisplayName;
    const profileRoleBadgeElement = document.getElementById('profileRoleBadge');
    if (profileRoleBadgeElement) profileRoleBadgeElement.innerText = 'HUB';
    const userDropdownUsernameElement = document.getElementById('userDropdownUsername');
    if (userDropdownUsernameElement) userDropdownUsernameElement.innerText = userDisplayName;
  }
  // Query the DOM for the header session title, act label, and active workspace label elements
  const sessionTitle = document.getElementById('headerSessionTitle') || document.getElementById('headerChronicleTitle');
  if (sessionTitle) sessionTitle.innerText = 'THE CHRONICLE HUB';
  const actLabel = document.getElementById('headerActLabel');
  if (actLabel) actLabel.innerText = 'DIRECTORY';
  const activeWorkspace = document.getElementById('activeWorkspaceLabel');
  if (activeWorkspace) activeWorkspace.innerText = 'HUB';
  switchTab('chronicle-hub');
  renderChronicleHub();
  renderActivePlayersBar();
  // Query the DOM for the game clock header elements and time widget to hide them while in the hub
  const headerTime = document.getElementById('headerTimeLabel');
  if (headerTime) headerTime.style.display = 'none';
  const timeDivider = document.getElementById('headerTimeDivider');
  if (timeDivider) timeDivider.style.display = 'none';
  const timeWidget = document.getElementById('widget-chronicle-time');
  if (timeWidget) timeWidget.style.display = 'none';
}

async function enterChronicle(campaignId, role, targetTab = 'gameboard') {
  campaignId = parseInt(campaignId);
  if (!campaignId || Number.isNaN(campaignId)) {
    returnToChronicleHub();
    return;
  }
  try {
    const dirResponse = await authFetch('/api/chronicles/directory');
    if (dirResponse.ok) {
      const chroniclesDirectory = await dirResponse.json();
      const chronEntry = Array.isArray(chroniclesDirectory)
        ? chroniclesDirectory.find(c => Number(c.id) === Number(campaignId))
        : null;
      if (!chronEntry || (!chronEntry.is_owner && chronEntry.member_status !== 'active')) {
        localStorage.removeItem('lastChronicleId');
        localStorage.removeItem('lastChronicleRole');
        if (chronEntry && chronEntry.member_status === 'pending') {
          alert('Your request to join this Chronicle is awaiting Storyteller approval.');
        } else if (chronEntry) {
          alert('Access denied: The Storyteller must approve your request before you can view or enter this Chronicle.');
        }
        returnToChronicleHub();
        return;
      }
      // Enforce verified role from server/directory
      if (chronEntry.is_owner) {
        role = 'gm';
      } else if (chronEntry.member_role === 'storyteller' || chronEntry.member_role === 'gm') {
        role = 'storyteller';
      } else {
        role = 'player';
      }
    }
  } catch (verifyError) {
    console.error('Failed to verify chronicle membership:', verifyError);
  }
  // Save the active chronicle ID and role to browser localStorage for session persistence
  localStorage.setItem('lastChronicleId', campaignId);
  localStorage.setItem('lastChronicleRole', role);
  activeChronicleId = campaignId;
  activeChronicleRole = role;
  currentLoadedCharacterId = null;
  activeControlledCharacterId = null;
  activeNpcPersonaId = null;
  if (role === 'gm' || role === 'storyteller') {
    if (typeof renderStorytellerGodDossier === 'function') renderStorytellerGodDossier('widget-character-dossier');
  } else {
    if (typeof renderUnassignedPlayerDossier === 'function') renderUnassignedPlayerDossier('widget-character-dossier');
  }
  document.body.className = `role-${role}`;
  const userDisplayName = currentUser ? currentUser.displayName || currentUser.username : 'Kindred';
  // Query the DOM for the profile display name, role badge, and user dropdown elements
  const profileDisplayNameElement = document.getElementById('profileDisplayName');
  if (profileDisplayNameElement) profileDisplayNameElement.innerText = userDisplayName;
  const profileRoleBadgeElement = document.getElementById('profileRoleBadge');
  if (profileRoleBadgeElement) profileRoleBadgeElement.innerText = role === 'gm' || role === 'storyteller' ? 'STORYTELLER' : 'COTERIE PLAYER';
  const userDropdownUsernameElement = document.getElementById('userDropdownUsername');
  if (userDropdownUsernameElement) userDropdownUsernameElement.innerText = currentUser ? currentUser.username : 'Kindred';
  const userDropdownAvatarImageElement = document.getElementById('userDropdownAvatarImg');
  const userDropdownAvatarIconElement = document.getElementById('userDropdownAvatarIcon');
  if (userDropdownAvatarImageElement && userDropdownAvatarIconElement && currentUser && currentUser.avatar_url) {
      userDropdownAvatarImageElement.src = currentUser.avatar_url;
      userDropdownAvatarImageElement.style.display = 'block';
      userDropdownAvatarIconElement.style.display = 'none';
  } else if (userDropdownAvatarImageElement && userDropdownAvatarIconElement && currentUser && currentUser.avatar) {
      userDropdownAvatarImageElement.src = currentUser.avatar;
      userDropdownAvatarImageElement.style.display = 'block';
      userDropdownAvatarIconElement.style.display = 'none';
  }
  // Query the DOM for the active workspace label element by its ID
  const activeWorkspace = document.getElementById('activeWorkspaceLabel');
  if (activeWorkspace) activeWorkspace.innerText = 'VTT';
  // Query all Storyteller-only control elements in the DOM and toggle visibility based on role
  document.querySelectorAll('.gm-only-control').forEach(targetElement => {
    if (role === 'gm' || role === 'storyteller') {
        // Do not accidentally unhide GM-only widgets that have been explicitly closed or set by startup scripts
        if (!targetElement.classList.contains('elysium-widget')) {
            targetElement.style.display = '';
        }
    } else {
        targetElement.style.display = 'none';
    }
  });
  // Query all player-only display elements in the DOM and toggle visibility based on role
  document.querySelectorAll('.player-only-display').forEach(targetElement => {
     targetElement.style.display = role === 'player' ? '' : 'none';
  });
  // Restore user-specific widget positions, dimensions, and open/closed states for this user/role
  restoreWidgetLayoutState();
  // Query the DOM for the header time label, divider, and dice roller name input elements
  const headerTime = document.getElementById('headerTimeLabel');
  if (headerTime) {
    headerTime.style.display = '';
    const isStoryteller = role === 'gm' || role === 'storyteller';
    headerTime.style.cursor = isStoryteller ? 'pointer' : 'default';
    headerTime.title = isStoryteller ? 'Adjust Game Clock' : 'In-Game Time';
  }
  const timeDivider = document.getElementById('headerTimeDivider');
  if (timeDivider) timeDivider.style.display = '';
  const diceRollerName = document.getElementById('diceRollerName');
  if (diceRollerName) {
    diceRollerName.value = (role === 'gm' || role === 'storyteller') ? 'Storyteller' : userDisplayName;
  }
  // Emit a Socket.IO event to join the chronicle's real-time room and announce user presence
  socket.emit('room:join', {
    campaignId: activeChronicleId,
    userId: currentUser ? currentUser.id : null,
    username: currentUser ? currentUser.username : 'User',
    displayName: currentUser ? currentUser.displayName || currentUser.username : 'User',
    role: role, avatar: currentUser ? (currentUser.avatar || currentUser.avatar_url) : null,
    characterId: activeControlledCharacterId || null
  });
  initCanvasEngine();
  loadChatMessages();
  fetchAssets();
  fetchClanSymbols();
  loadRecentRolls();
  updateChatSenderBadge();
  switchTab(targetTab); if(allRules.length > 0) renderRulebookHierarchy(allRules); else loadRulesCodex();
  // Send an authenticated HTTP GET request to fetch metadata and UI settings for the active chronicle
  authFetch(`/api/chronicles/${campaignId}`).then(fetchResponse => fetchResponse.json()).then(chronicleRecord => {
    if (chronicleRecord && chronicleRecord.ui_settings) {
        try {
            const parsedUiSettings = typeof chronicleRecord.ui_settings === 'string' ? JSON.parse(chronicleRecord.ui_settings) : chronicleRecord.ui_settings;
            if (parsedUiSettings && typeof parsedUiSettings === 'object') {
                chronicleUiSettings = parsedUiSettings;
                if (typeof syncAutoAcceptToggleUi === 'function') syncAutoAcceptToggleUi();
                // Re-render clues now that settings are loaded
                if (typeof activeWidgetMatrixId !== 'undefined' && activeWidgetMatrixId) {
                    renderWidgetClueCards(activeWidgetMatrixId);
                }
            }
        } catch(jsonParseError) {}
    }
    if (chronicleRecord && chronicleRecord.title) {
      // Query the DOM for the header session title and act label elements
      const sessionTitleElement = document.getElementById('headerSessionTitle');
      if (sessionTitleElement) sessionTitleElement.innerText = chronicleRecord.title.toUpperCase();
      const actLabelElement = document.getElementById('headerActLabel');
      if (actLabelElement && (!window.liveGameboardSceneState || !window.liveGameboardSceneState.active_episode_title)) {
        if (!actLabelElement.innerText || actLabelElement.innerText.trim() === '' || actLabelElement.innerText.trim() === 'ACT 1') {
          actLabelElement.innerText = 'ACT 1';
        }
      }
    }
  }).catch(errorObject => console.error(errorObject));
  loadGameboardState();
  loadCharacters();
  authFetch(`/api/chronicles/${campaignId}/members`).then(res => res.ok ? res.json() : []).then(members => {
    if (Array.isArray(members)) {
      chronicleMembersList = members;
    }
  }).catch(() => {});
  loadRecentRolls();
  loadClueMatricesForWidget();
  loadLoreMatricesForWidget();
  loadNpcCategories();
  renderChronicleTimelineEpisodes();
  if (role === 'gm' || role === 'storyteller') {
    loadCampaignsList();
    updatePendingBadgeCount();
  }
}

function switchTab(tabId) {
  tabId = normalizeTabId(tabId);
  if (tabId === 'storyteller-workshop' && (activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller')) {
    // Display an alert notification when a non-Storyteller attempts to open the workshop tab
    alert('Access denied: The Chronicles & Arcs workshop is restricted to the Storyteller.');
    return;
  }
  if ((tabId === 'gameboard' || tabId === 'character-vault') && !activeChronicleId) {
    // Display an alert notification if no chronicle is selected
    alert('Please select or create a chronicle first.');
    returnToChronicleHub();
    return;
  }
  // Query all navigation tab buttons and tab view containers in the DOM to reset their active state
  document.querySelectorAll('.tab-btn').forEach(tabButtonElement => tabButtonElement.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(tabViewElement => tabViewElement.classList.remove('active'));
  // Query the DOM for the target tab button and target tab view container by their IDs
  const activeTabButtonElement = document.getElementById(`tabBtn-${tabId}`);
  if (activeTabButtonElement) activeTabButtonElement.classList.add('active');
  const activeTabViewElement = document.getElementById(`tab-${tabId}`);
  if (activeTabViewElement) activeTabViewElement.classList.add('active');
  // Persist the newly selected tab ID in browser localStorage
  localStorage.setItem('vtm_active_tab', tabId);
  if (tabId === 'storyteller-workshop' && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) {
    loadCoterieManagement();
  } else if (tabId === 'chronicle-hub') {
    activeChronicleId = null;
    activeChronicleRole = null;
    // Emit a Socket.IO event to leave the chronicle room when switching back to the hub
    if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('room:leave');
    // Query the DOM for the time header and widget elements to hide them in the hub
    const headerTime = document.getElementById('headerTimeLabel');
    if (headerTime) headerTime.style.display = 'none';
    const timeDivider = document.getElementById('headerTimeDivider');
    if (timeDivider) timeDivider.style.display = 'none';
    const timeWidget = document.getElementById('widget-chronicle-time');
    if (timeWidget) timeWidget.style.display = 'none';
    const sheetModal = document.getElementById('characterSheetModal');
    if (sheetModal) sheetModal.classList.remove('active');
    const rulesWidget = document.getElementById('widget-quick-rules');
    if (rulesWidget) rulesWidget.style.display = 'none';
    renderChronicleHub();
  } else if (tabId === 'gameboard') {
    // Schedule a short timer so the gameboard DOM layout settles before initializing widget bounds and clue cords
    setTimeout(() => {
      initDesktopWidgetsDragAndResize();
      renderClueCords();
    }, 80);
  }
}




function closeModal(modalElementId) {
  // Query the DOM for the modal element by its ID
  const modalElement = document.getElementById(modalElementId);
  if (modalElement) {
    modalElement.classList.remove('active');
    modalElement.style.display = '';
  }
}


function escapeHtml(rawText) {
  if (!rawText) return '';
  return rawText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


function toggleWidgetCollapse(widgetId) {
  widgetId = normalizeWidgetId(widgetId);
  // Query the DOM for the target desktop widget element by its ID
  const widgetElement = document.getElementById(widgetId);
  if (!widgetElement) return;
  // Query the widget element for its inner body container
  const widgetBodyElement = widgetElement.querySelector('.widget-body');
  if (!widgetBodyElement) return;
  if (widgetBodyElement.style.display === 'none') {
    widgetBodyElement.style.display = '';
    widgetElement.style.minHeight = '';
  } else {
    widgetBodyElement.style.display = 'none';
    widgetElement.style.minHeight = '38px';
  }
  saveWidgetVisibility();
}

function toggleWidgetClose(widgetId) {
  widgetId = normalizeWidgetId(widgetId);
  // Query the DOM for the target desktop widget element by its ID
  const widgetElement = document.getElementById(widgetId);
  if (widgetElement) {
    widgetElement.style.display = 'none';
    saveWidgetVisibility();
  }
}

function restoreWidget(widgetId) {
  widgetId = normalizeWidgetId(widgetId);
  // Query the DOM for the target desktop widget element by its ID
  const widgetElement = document.getElementById(widgetId);
  if (widgetElement) {
    widgetElement.style.display = 'flex';
    // Query the widget element for its inner body container
    const widgetBodyElement = widgetElement.querySelector('.widget-body');
    if (widgetBodyElement) widgetBodyElement.style.display = '';
    widgetElement.style.minHeight = '';
    bringDesktopWidgetToFront(widgetElement);
    saveWidgetVisibility();
    if (widgetId === 'widget-clue-board') {
      // Schedule a brief timer to redraw the SVG clue cords after the clue board widget becomes visible
      setTimeout(() => renderClueCords(), 50);
    }
  }
}

let highestFloatingOverlayZIndex = 100510;

function bringCharacterSheetWindowToFront() {
  const sheetModal = document.getElementById('characterSheetModal');
  if (!sheetModal) return;
  if (sheetModal.parentElement !== document.body) {
    document.body.appendChild(sheetModal);
  }
  highestFloatingOverlayZIndex++;
  sheetModal.style.setProperty('z-index', String(highestFloatingOverlayZIndex), 'important');
}

function bringDesktopWidgetToFront(widgetElement) {
  if (!widgetElement) return;
  const sheetModal = document.getElementById('characterSheetModal');
  const isSheetOpen = sheetModal && sheetModal.classList.contains('active');
  const activeTab = document.querySelector('.tab-view.active');
  const isOutsideGameboard = activeTab && activeTab.id !== 'tab-gameboard';
  if (
    widgetElement.id === 'widget-quick-rules' ||
    isSheetOpen ||
    isOutsideGameboard ||
    widgetElement.parentElement === document.body ||
    widgetElement.style.getPropertyPriority('z-index') === 'important'
  ) {
    if (widgetElement.id === 'widget-quick-rules' && widgetElement.parentElement !== document.body) {
      document.body.appendChild(widgetElement);
    }
    highestFloatingOverlayZIndex++;
    widgetElement.style.setProperty('z-index', String(highestFloatingOverlayZIndex), 'important');
    return;
  }

  highestDesktopWidgetZIndex++;
  widgetElement.style.zIndex = highestDesktopWidgetZIndex;
}

function shrinkWidgetToFitViewport(containerElement) {
  if (!containerElement) return;
  if (containerElement.id === 'characterSheetWindow') {
    bringCharacterSheetWindowToFront();
  } else {
    bringDesktopWidgetToFront(containerElement);
  }
  const computedPos = window.getComputedStyle(containerElement).position;
  const isFixed = computedPos === 'fixed' || containerElement.id === 'characterSheetWindow';
  const rect = containerElement.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const parentTopOffset = isFixed ? 0 : (containerElement.offsetParent ? containerElement.offsetParent.getBoundingClientRect().top : 52);
  const parentLeftOffset = isFixed ? 0 : (containerElement.offsetParent ? containerElement.offsetParent.getBoundingClientRect().left : 0);

  let targetViewportTop = Math.max(58, Math.min(rect.top, vh - 260));
  let targetViewportLeft = Math.max(12, Math.min(rect.left, vw - 320));
  const maxAllowedHeight = Math.max(220, vh - targetViewportTop - 16);
  const maxAllowedWidth = Math.max(280, vw - targetViewportLeft - 16);

  // If the bottom is below the browser window, or if the user clicks Shrink to make it more compact:
  let newHeight;
  if (rect.bottom > vh - 12) {
    newHeight = maxAllowedHeight;
  } else {
    newHeight = Math.max(240, Math.min(maxAllowedHeight, Math.round(rect.height * 0.78)));
  }
  let newWidth = Math.min(rect.width, maxAllowedWidth);
  if (rect.width > vw * 0.85) {
    newWidth = Math.max(460, Math.round(vw * 0.72));
  }

  containerElement.style.left = `${Math.max(0, targetViewportLeft - parentLeftOffset)}px`;
  containerElement.style.top = `${Math.max(isFixed ? 54 : 4, targetViewportTop - parentTopOffset)}px`;
  containerElement.style.width = `${newWidth}px`;
  containerElement.style.height = `${newHeight}px`;
  containerElement.dataset.isMaximized = 'false';
  saveWidgetVisibility();
  if (containerElement.id === 'widget-clue-board' || containerElement.classList.contains('widget-matrix-popup')) {
    renderClueCords();
  }
}
window.shrinkWidgetToFitViewport = shrinkWidgetToFitViewport;

function attachMultiDirectionResizeHandles(containerElement, minWidth = 320, minHeight = 220) {
  if (!containerElement) return;
  const requiredDirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  requiredDirs.forEach((dir) => {
    if (!containerElement.querySelector(`.sheet-window-resize-handle[data-resize-dir="${dir}"]`)) {
      const h = document.createElement('div');
      h.className = `sheet-window-resize-handle sheet-resize-${dir}`;
      h.dataset.resizeDir = dir;
      if (dir === 'n' || dir === 'nw' || dir === 'ne') {
        h.title = 'Drag down to shrink from top (and pull bottom into window)';
      }
      containerElement.appendChild(h);
    }
  });

  // Also inject a one-click "Shrink / Fit to Window" button into the widget's top header bar if not already present
  const actionsBar =
    containerElement.querySelector('.widget-header .widget-actions') ||
    containerElement.querySelector('.sheet-window-drag-actions');
  if (actionsBar && !actionsBar.querySelector('.btn-shrink-fit-top')) {
    const shrinkBtn = document.createElement('button');
    shrinkBtn.type = 'button';
    shrinkBtn.className =
      containerElement.id === 'characterSheetWindow'
        ? 'sheet-window-ctrl-btn btn-shrink-fit-top'
        : 'btn-w-ctrl btn-shrink-fit-top';
    shrinkBtn.title = 'Shrink widget to fit inside browser window';
    shrinkBtn.innerHTML =
      containerElement.id === 'characterSheetWindow'
        ? '<i class="fa-solid fa-down-left-and-up-right-to-center"></i> Shrink'
        : '<i class="fa-solid fa-down-left-and-up-right-to-center"></i>';
    shrinkBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      shrinkWidgetToFitViewport(containerElement);
    };
    actionsBar.insertBefore(shrinkBtn, actionsBar.firstChild);
  }

  const handles = containerElement.querySelectorAll('.sheet-window-resize-handle, .widget-resize-handle');
  handles.forEach((handleEl) => {
    handleEl.onmousedown = (mouseEvent) => {
      mouseEvent.preventDefault();
      mouseEvent.stopPropagation();
      if (containerElement.id === 'characterSheetWindow') {
        bringCharacterSheetWindowToFront();
      } else {
        bringDesktopWidgetToFront(containerElement);
      }
      const computedPos = window.getComputedStyle(containerElement).position;
      const isFixed = computedPos === 'fixed' || containerElement.id === 'characterSheetWindow';
      const rect = containerElement.getBoundingClientRect();
      const startLeft = isFixed ? rect.left : containerElement.offsetLeft;
      const startTop = isFixed ? rect.top : containerElement.offsetTop;
      containerElement.style.left = `${startLeft}px`;
      containerElement.style.top = `${startTop}px`;
      containerElement.style.width = `${rect.width}px`;
      containerElement.style.height = `${rect.height}px`;
      containerElement.dataset.isMaximized = 'false';
      document.body.classList.add('vtm-dragging-or-resizing');
      activeWidgetResize = {
        widget: containerElement,
        isFixed,
        dir: handleEl.dataset.resizeDir || 'se',
        startX: mouseEvent.clientX,
        startY: mouseEvent.clientY,
        initialLeft: startLeft,
        initialTop: startTop,
        initialViewportTop: rect.top,
        initialViewportBottom: rect.bottom,
        initialWidth: rect.width,
        initialHeight: rect.height,
        minWidth,
        minHeight,
      };
    };
  });
}

function initCharacterSheetWindowDragAndResize() {
  const sheetWin = document.getElementById('characterSheetWindow');
  if (!sheetWin) return;
  const dragBar = document.getElementById('sheetWindowDragBar');
  const sidebarIdentity = document.getElementById('sheetSidebarIdentityDragArea');

  const startSheetDrag = (mouseEvent) => {
    if (mouseEvent.target.closest('button, input, select, a, textarea')) return;
    mouseEvent.preventDefault();
    bringCharacterSheetWindowToFront();
    const rect = sheetWin.getBoundingClientRect();
    sheetWin.style.left = `${rect.left}px`;
    sheetWin.style.top = `${rect.top}px`;
    sheetWin.style.width = `${rect.width}px`;
    sheetWin.style.height = `${rect.height}px`;
    sheetWin.dataset.isMaximized = 'false';
    document.body.classList.add('vtm-dragging-or-resizing');
    activeWidgetDrag = {
      widget: sheetWin,
      startX: mouseEvent.clientX,
      startY: mouseEvent.clientY,
      initialLeft: rect.left,
      initialTop: rect.top,
    };
  };

  if (dragBar) dragBar.onmousedown = startSheetDrag;
  if (sidebarIdentity) {
    sidebarIdentity.style.cursor = 'move';
    sidebarIdentity.onmousedown = startSheetDrag;
  }
  attachMultiDirectionResizeHandles(sheetWin, 520, 360);
}

function toggleMaximizeCharacterSheetWindow() {
  const sheetWin = document.getElementById('characterSheetWindow');
  const maxBtn = document.getElementById('btnSheetWindowMaximize');
  if (!sheetWin) return;
  bringCharacterSheetWindowToFront();
  if (sheetWin.dataset.isMaximized === 'true') {
    sheetWin.style.left = sheetWin.dataset.prevLeft || 'calc(50vw - min(560px, 45vw))';
    sheetWin.style.top = sheetWin.dataset.prevTop || '56px';
    sheetWin.style.width = sheetWin.dataset.prevWidth || 'min(1120px, 90vw)';
    sheetWin.style.height = sheetWin.dataset.prevHeight || 'min(820px, 86vh)';
    sheetWin.dataset.isMaximized = 'false';
    if (maxBtn) maxBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
  } else {
    const rect = sheetWin.getBoundingClientRect();
    sheetWin.dataset.prevLeft = `${rect.left}px`;
    sheetWin.dataset.prevTop = `${rect.top}px`;
    sheetWin.dataset.prevWidth = `${rect.width}px`;
    sheetWin.dataset.prevHeight = `${rect.height}px`;
    sheetWin.style.left = '12px';
    sheetWin.style.top = '52px';
    sheetWin.style.width = `${window.innerWidth - 24}px`;
    sheetWin.style.height = `${window.innerHeight - 64}px`;
    sheetWin.dataset.isMaximized = 'true';
    if (maxBtn) maxBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
  }
}

function openFloatingRulebookCodex() {
  const rulesWidget = document.getElementById('widget-quick-rules');
  if (!rulesWidget) return;
  const isHidden = window.getComputedStyle(rulesWidget).display === 'none';
  if (isHidden) {
    toggleWidget('widget-quick-rules');
  }
  rulesWidget.style.display = 'flex';
  rulesWidget.style.position = 'fixed';
  if (rulesWidget.parentElement !== document.body) {
    document.body.appendChild(rulesWidget);
  }
  initDesktopWidgetsDragAndResize();
  bringDesktopWidgetToFront(rulesWidget);

  setTimeout(() => {
    if (rulesWidget.parentElement !== document.body) {
      document.body.appendChild(rulesWidget);
    }
    rulesWidget.style.position = 'fixed';
    const rect = rulesWidget.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.top < 54) rulesWidget.style.top = '58px';
    if (rect.left < 12) rulesWidget.style.left = '24px';
    if (rect.right > vw - 12) {
      rulesWidget.style.left = `${Math.max(16, vw - rect.width - 20)}px`;
    }
    if (rect.bottom > vh - 12) {
      rulesWidget.style.top = `${Math.max(58, vh - rect.height - 20)}px`;
    }
    bringDesktopWidgetToFront(rulesWidget);
  }, 25);

  // Auto-populate Rules Widget if needed
  if (typeof allRules !== 'undefined' && allRules.length > 0) {
    if (typeof renderWidgetRulebookHierarchy === 'function') {
      renderWidgetRulebookHierarchy(allRules);
    }
  } else if (typeof loadRulesCodex === 'function') {
    loadRulesCodex().then(() => {
      if (typeof renderWidgetRulebookHierarchy === 'function') {
        renderWidgetRulebookHierarchy(allRules);
      }
    });
  }
}

function tileSheetAndRulebookSideBySide() {
  openFloatingRulebookCodex();
  const sheetModal = document.getElementById('characterSheetModal');
  const sheetWin = document.getElementById('characterSheetWindow');
  const rulesWidget = document.getElementById('widget-quick-rules');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const topY = 54;
  const usableH = Math.max(420, vh - topY - 14);

  if (sheetModal && sheetModal.classList.contains('active') && sheetWin) {
    const leftW = Math.max(540, Math.floor((vw - 30) * 0.57));
    const rightW = Math.max(380, vw - leftW - 30);
    sheetWin.style.left = '10px';
    sheetWin.style.top = `${topY}px`;
    sheetWin.style.width = `${leftW}px`;
    sheetWin.style.height = `${usableH}px`;
    sheetWin.dataset.isMaximized = 'false';

    if (rulesWidget) {
      rulesWidget.style.position = 'fixed';
      rulesWidget.style.left = `${10 + leftW + 10}px`;
      rulesWidget.style.top = `${topY}px`;
      rulesWidget.style.width = `${rightW}px`;
      rulesWidget.style.height = `${usableH}px`;
      bringDesktopWidgetToFront(rulesWidget);
    }
  } else if (rulesWidget) {
    rulesWidget.style.position = 'fixed';
    rulesWidget.style.left = `${Math.max(20, Math.floor(vw * 0.45))}px`;
    rulesWidget.style.top = `${topY}px`;
    rulesWidget.style.width = `${Math.max(420, Math.floor(vw * 0.52))}px`;
    rulesWidget.style.height = `${usableH}px`;
    bringDesktopWidgetToFront(rulesWidget);
  }
}

function initDesktopWidgetsDragAndResize() {
  // Query the DOM for the Elysium desktop container element by its ID
  let desktopContainerElement = document.getElementById('elysiumDesktop');
  if (!desktopContainerElement) desktopContainerElement = document.body;
  
  initCharacterSheetWindowDragAndResize();

  // Move generic popups into the desktop when on gameboard so they can be dragged!
  const activeTab = document.querySelector('.tab-view.active');
  const isOnGameboard = !activeTab || activeTab.id === 'tab-gameboard';
  const clueDetailWidget = document.getElementById('widget-clue-detail');
  if (clueDetailWidget && isOnGameboard && clueDetailWidget.parentElement !== desktopContainerElement) {
      desktopContainerElement.appendChild(clueDetailWidget);
  }
  const storyWidget = document.getElementById('widget-chronicle-timeline');
  if (storyWidget && isOnGameboard && storyWidget.parentElement !== desktopContainerElement) {
      desktopContainerElement.appendChild(storyWidget);
  }
  const notesWidget = document.getElementById('widget-personal-notes');
  if (notesWidget && isOnGameboard && notesWidget.parentElement !== desktopContainerElement) {
      desktopContainerElement.appendChild(notesWidget);
  }
  const rulesWidget = document.getElementById('widget-quick-rules');
  if (rulesWidget && isOnGameboard && rulesWidget.parentElement !== desktopContainerElement && rulesWidget.style.position !== 'fixed') {
      desktopContainerElement.appendChild(rulesWidget);
  }
  const pdfWidget = document.getElementById('widget-pdf');
  if (pdfWidget && isOnGameboard && pdfWidget.parentElement !== desktopContainerElement) {
      desktopContainerElement.appendChild(pdfWidget);
  }
  // Query all Elysium widget elements across the entire document (including floating widgets on document.body)
  const widgetElements = document.querySelectorAll('.elysium-widget');
  widgetElements.forEach(widgetElement => {
    // If it's the paper popup, map dragging to the ENTIRE widget body!
    if (widgetElement.id === 'widget-clue-detail') {
        widgetElement.onmousedown = mouseEvent => {
            if (mouseEvent.target.closest('button, input, select, a, textarea, [contenteditable="true"]')) return;
            mouseEvent.preventDefault();
            bringDesktopWidgetToFront(widgetElement);
            document.body.classList.add('vtm-dragging-or-resizing');
            activeWidgetDrag = {
              widget: widgetElement,
              startX: mouseEvent.clientX,
              startY: mouseEvent.clientY,
              initialLeft: widgetElement.offsetLeft,
              initialTop: widgetElement.offsetTop
            };
        };
    } else {
        widgetElement.onmousedown = () => {
          bringDesktopWidgetToFront(widgetElement);
        };
        // Query the widget element for its header bar to attach drag listeners
        const headerElement = widgetElement.querySelector('.widget-header');
        if (headerElement) {
          headerElement.onmousedown = mouseEvent => {
            if (mouseEvent.target.closest('button, input, select, a, textarea')) return;
            mouseEvent.preventDefault();
            bringDesktopWidgetToFront(widgetElement);
            document.body.classList.add('vtm-dragging-or-resizing');
            activeWidgetDrag = {
              widget: widgetElement,
              startX: mouseEvent.clientX,
              startY: mouseEvent.clientY,
              initialLeft: widgetElement.offsetLeft,
              initialTop: widgetElement.offsetTop
            };
          };
        }
    }
    attachMultiDirectionResizeHandles(widgetElement, 260, 180);
    if (!desktopListenersAttached) {
      desktopListenersAttached = true;
      // Attach a global mousemove listener to the window to handle active widget dragging and resizing
      window.addEventListener('mousemove', mouseEvent => {
        if (activeWidgetDrag) {
          const deltaX = mouseEvent.clientX - activeWidgetDrag.startX;
          const deltaY = mouseEvent.clientY - activeWidgetDrag.startY;
          const isFixedWindow =
            activeWidgetDrag.widget.id === 'characterSheetWindow' ||
            activeWidgetDrag.widget.style.position === 'fixed';
          const minTop = isFixedWindow ? 52 : 0;
          const minLeft = isFixedWindow ? 8 : 0;
          const maxLeft = Math.max(minLeft, window.innerWidth - 140);
          const maxTop = Math.max(minTop, window.innerHeight - 70);
          const newLeft = Math.min(maxLeft, Math.max(minLeft, activeWidgetDrag.initialLeft + deltaX));
          const newTop = Math.min(maxTop, Math.max(minTop, activeWidgetDrag.initialTop + deltaY));
          activeWidgetDrag.widget.style.left = `${newLeft}px`;
          activeWidgetDrag.widget.style.top = `${newTop}px`;
          if (activeWidgetDrag.widget.id === 'widget-clue-board' || activeWidgetDrag.widget.classList.contains('widget-matrix-popup')) {
            renderClueCords();
          }
        } else if (activeWidgetResize) {
          const dir = activeWidgetResize.dir || 'se';
          const deltaWidth = mouseEvent.clientX - activeWidgetResize.startX;
          const deltaHeight = mouseEvent.clientY - activeWidgetResize.startY;
          const minW = activeWidgetResize.minWidth || 220;
          const minH = activeWidgetResize.minHeight || 140;

          if (dir.includes('e')) {
            const newWidth = Math.max(minW, activeWidgetResize.initialWidth + deltaWidth);
            activeWidgetResize.widget.style.width = `${newWidth}px`;
          }
          if (dir.includes('s')) {
            const newHeight = Math.max(minH, activeWidgetResize.initialHeight + deltaHeight);
            activeWidgetResize.widget.style.height = `${newHeight}px`;
          }
          if (dir.includes('w')) {
            const proposedWidth = activeWidgetResize.initialWidth - deltaWidth;
            if (proposedWidth >= minW) {
              activeWidgetResize.widget.style.width = `${proposedWidth}px`;
              activeWidgetResize.widget.style.left = `${Math.max(0, activeWidgetResize.initialLeft + deltaWidth)}px`;
            }
          }
          if (dir.includes('n')) {
            const minTopAllowed = activeWidgetResize.isFixed ? 52 : 2;
            const vh = window.innerHeight;
            if (deltaHeight > 0 && activeWidgetResize.initialViewportBottom > vh - 12) {
              // When the bottom of the widget is hidden beneath the browser window and the player drags
              // the top edge/corner down to shrink it, pull the bottom up into the visible viewport too
              const maxFittingHeight = Math.max(minH, vh - activeWidgetResize.initialViewportTop - 16);
              const baseHeight = Math.min(activeWidgetResize.initialHeight, maxFittingHeight);
              const shrunkHeight = Math.max(minH, baseHeight - deltaHeight * 1.35);
              activeWidgetResize.widget.style.height = `${shrunkHeight}px`;
              activeWidgetResize.widget.style.top = `${Math.max(minTopAllowed, activeWidgetResize.initialTop + Math.min(deltaHeight * 0.35, 80))}px`;
            } else {
              const proposedHeight = activeWidgetResize.initialHeight - deltaHeight;
              if (proposedHeight >= minH) {
                activeWidgetResize.widget.style.height = `${proposedHeight}px`;
                activeWidgetResize.widget.style.top = `${Math.max(minTopAllowed, activeWidgetResize.initialTop + deltaHeight)}px`;
              }
            }
          }
          if (activeWidgetResize.widget.id === 'widget-clue-board' || activeWidgetResize.widget.classList.contains('widget-matrix-popup')) {
            renderClueCords();
          }
        }
      });
      // Attach a global mouseup listener to the window to end active widget dragging or resizing
      window.addEventListener('mouseup', () => {
        document.body.classList.remove('vtm-dragging-or-resizing');
        const didDragOrResize = Boolean(activeWidgetDrag || activeWidgetResize);
        if (activeWidgetDrag) {
          activeWidgetDrag = null;
        }
        if (activeWidgetResize) {
          activeWidgetResize = null;
          renderClueCords();
        }
        if (didDragOrResize) {
          saveWidgetVisibility();
        }
      });
      // Attach a global resize listener to the window to redraw clue cords when the browser window resizes
      window.addEventListener('resize', () => {
        renderClueCords();
      });
    }
    renderClueCords();
    let currentEpisodeClues = [{
      id: 'e1',
      code: 'E1',
      title: 'Ritual Site',
      status: 'discovered',
      delivery_method: 'Crime Scene Search',
      location_hint: 'St. Jude Crypt, Camden',
      description: 'An intricate circle of purified ash and dried sanguine vitae was uncovered near the eastern crypt gate. Preliminary occult analysis indicates early-stage Thaumaturgical ritualism, abandoned approximately 48 hours prior to discovery.'
    }, {
      id: 'e2',
      code: 'E2',
      title: 'Sanguine Treaty',
      status: 'discovered',
      delivery_method: 'Archival Decryption',
      location_hint: 'Tremere Chantry Library',
      description: 'A scorched parchment detailing a non-aggression pact between local Ventrue elders and the Anarch barony, sealed in blood in 1982. Mentions mutual silence regarding incidents along Highway 31W.'
    }, {
      id: 'e3',
      code: 'E3',
      title: 'Police Report',
      status: 'discovered',
      delivery_method: 'Police Wiretap / Contact',
      location_hint: 'Radcliff Precinct Archives',
      description: 'Official homicide incident report #1982-A4. The coroner classified multiple exsanguinations along the roadway as "violent animal predations" under direct orders from an unidentified municipal commissioner.'
    }, {
      id: 'e4',
      code: 'E4',
      title: 'Missing Tremere',
      status: 'discovered',
      delivery_method: 'Coterie Interrogation',
      location_hint: 'The Black Rose Nightclub',
      description: 'Scholar Sean Mercer of House Tremere failed to report to evening roll call for three consecutive weeks. Witnesses report he was last observed departing in an unmarked black sedan heading towards the grain mill.'
    }];
    let allChronicleClueMatrices = [];
    let activeWidgetMatrixId = null;
  });
}


function toggleVttDropdown(clickEvent) {
  clickEvent.stopPropagation();
  // Query the DOM for the VTT workspace dropdown menu element by its ID
  const dropdownMenuElement = document.getElementById('vttDropdownMenu');
  if (dropdownMenuElement) dropdownMenuElement.classList.toggle('active');
  closeUserDropdown();
}

function closeVttDropdown() {
  // Query the DOM for the VTT workspace dropdown menu element by its ID
  const dropdownMenuElement = document.getElementById('vttDropdownMenu');
  if (dropdownMenuElement) dropdownMenuElement.classList.remove('active');
}

function toggleUserDropdown(clickEvent) {
  clickEvent.stopPropagation();
  // Query the DOM for the user profile dropdown menu element by its ID
  const dropdownMenuElement = document.getElementById('userDropdownMenu');
  if (dropdownMenuElement) dropdownMenuElement.classList.toggle('active');
  closeVttDropdown();
}

function closeUserDropdown() {
  // Query the DOM for the user profile dropdown menu element by its ID
  const dropdownMenuElement = document.getElementById('userDropdownMenu');
  if (dropdownMenuElement) dropdownMenuElement.classList.remove('active');
}

function toggleVoiceMute() {
  // Query the DOM for the voice chat mute toggle button element by its ID
  const voiceToggleButtonElement = document.getElementById('voiceToggleBtn');
  if (!voiceToggleButtonElement) return;
  // Query the button element for its child FontAwesome icon element
  const microphoneIconElement = voiceToggleButtonElement.querySelector('i');
  if (microphoneIconElement.classList.contains('fa-microphone')) {
    microphoneIconElement.className = 'fa-solid fa-microphone-slash';
    voiceToggleButtonElement.style.color = '#ef4444';
  } else {
    microphoneIconElement.className = 'fa-solid fa-microphone';
    voiceToggleButtonElement.style.color = '';
  }
}

function toggleFullscreenMode() {
  if (!document.fullscreenElement) {
    // Request the browser to place the document root element into fullscreen mode
    document.documentElement.requestFullscreen().catch(errorObject => console.error(errorObject));
  } else {
    // Exit browser fullscreen mode via the Document Fullscreen API
    document.exitFullscreen().catch(errorObject => console.error(errorObject));
  }
}

function openProfileSettingsModal() {
  closeUserDropdown();
  if (!currentUser) return;
  // Query the DOM for the profile avatar input, bio input, and profile settings modal elements
  document.getElementById('profileAvatarInput').value = currentUser.avatar_url || '';
  document.getElementById('profileBioInput').value = currentUser.bio || '';
  document.getElementById('profileSettingsModal').classList.add('active');
}

async function saveProfileSettings() {
  // Query the DOM for the profile bio and avatar URL input elements
  const bio = document.getElementById('profileBioInput').value.trim();
  const avatar_url = document.getElementById('profileAvatarInput').value.trim();
  try {
    // Send an authenticated HTTP PUT request to update the user's profile bio and avatar URL
    const fetchResponse = await authFetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bio,
        avatar_url
      })
    });
    if (fetchResponse.ok) {
      currentUser.bio = bio;
      currentUser.avatar_url = avatar_url;
      currentUser.avatar = avatar_url;
      closeModal('profileSettingsModal');
      if (typeof socket !== 'undefined' && socket && activeChronicleId) {
        // Emit a Socket.IO event to refresh the user's avatar and profile presence in the active room
        socket.emit('room:join', {
          campaignId: activeChronicleId,
          userId: currentUser ? currentUser.id : null,
          username: currentUser ? currentUser.username : 'User',
          displayName: currentUser ? currentUser.displayName || currentUser.username : 'User',
          role: activeChronicleRole,
          characterId: activeControlledCharacterId || null,
          avatar: currentUser.avatar || currentUser.avatar_url
        });
      } else {
        if (typeof renderActivePlayersBar === "function") renderActivePlayersBar(currentChronicleActiveUsers);
      }
    } else {
      // Display an error alert notification if saving profile settings failed
      alert('Failed to save profile settings.');
    }
  } catch (errorObject) {
    console.error(errorObject);
  }
}

function openSecuritySettingsModal() {
  closeUserDropdown();
  if (!currentUser) return;
  // Query the DOM for the security username, password inputs, and security settings modal elements
  document.getElementById('securityUsernameInput').value = currentUser.username || '';
  document.getElementById('securityPasswordInput').value = '';
  document.getElementById('securityPasswordConfirmInput').value = '';
  document.getElementById('securitySettingsModal').classList.add('active');
}

async function saveSecuritySettings() {
  // Query the DOM for the security username, password, and confirm password input elements
  const username = document.getElementById('securityUsernameInput').value.trim();
  const password = document.getElementById('securityPasswordInput').value.trim();
  const confirmPassword = document.getElementById('securityPasswordConfirmInput').value.trim();
  // Display an alert notification if the username is empty or passwords do not match
  if (!username) return alert('Username is required.');
  if (password !== confirmPassword) return alert('Passwords do not match.');
  try {
    const payload = {
      username
    };
    if (password) payload.password = password;
    // Send an authenticated HTTP PUT request to update the user's security credentials
    const fetchResponse = await authFetch('/api/users/security', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (fetchResponse.ok) {
      currentUser.username = username;
      // Query the DOM for the user dropdown username and avatar elements to refresh them
      const userDropdownUsernameElement = document.getElementById('userDropdownUsername');
      if (userDropdownUsernameElement) userDropdownUsernameElement.innerText = currentUser ? currentUser.username : username;
      const userDropdownAvatarImageElement = document.getElementById('userDropdownAvatarImg');
      const userDropdownAvatarIconElement = document.getElementById('userDropdownAvatarIcon');
      if (userDropdownAvatarImageElement && userDropdownAvatarIconElement && currentUser && currentUser.avatar_url) {
          userDropdownAvatarImageElement.src = currentUser.avatar_url;
          userDropdownAvatarImageElement.style.display = 'block';
          userDropdownAvatarIconElement.style.display = 'none';
      } else if (userDropdownAvatarImageElement && userDropdownAvatarIconElement && currentUser && currentUser.avatar) {
          userDropdownAvatarImageElement.src = currentUser.avatar;
          userDropdownAvatarImageElement.style.display = 'block';
          userDropdownAvatarIconElement.style.display = 'none';
      }
      closeModal('securitySettingsModal');
      // Display a confirmation alert notification to the user
      alert('Security settings updated successfully.');
    } else {
      // Parse the JSON error response payload
      const errorResponseData = await fetchResponse.json().catch(() => ({}));
      // Display an error alert notification to the user
      alert(`Failed to save security settings: ${errorResponseData.error || 'Server error.'}`);
    }
  } catch (errorObject) {
    console.error(errorObject);
  }
}



function toggleWidget(widgetId) {
  widgetId = normalizeWidgetId(widgetId);
  // Query the DOM for the target desktop widget element by its ID
  const widgetElement = document.getElementById(widgetId);
  if (!widgetElement) return;
  // Read the computed CSS display style of the widget via the browser window API
  const isHidden = window.getComputedStyle(widgetElement).display === 'none';
  if (isHidden) {
    widgetElement.style.display = 'flex';
    
    // Dynamically route the widget so it doesn't get swallowed by hidden tabs or trapped under modals
    let targetContainer = document.body;
    // Query the DOM for the currently active tab view element
    const activeTab = document.querySelector('.tab-view.active');
    const sheetModal = document.getElementById('characterSheetModal');
    const isSheetOpen = sheetModal && sheetModal.classList.contains('active');
    if (activeTab && activeTab.id === 'tab-gameboard' && !isSheetOpen && widgetId !== 'widget-quick-rules') {
        // Query the DOM for the Elysium desktop container element by its ID
        targetContainer = document.getElementById('elysiumDesktop') || document.body;
        widgetElement.style.removeProperty('z-index');
        widgetElement.style.position = 'absolute';
    } else {
        widgetElement.style.position = 'fixed';
    }
    if (widgetElement.parentElement !== targetContainer) {
        targetContainer.appendChild(widgetElement);
    }
    initDesktopWidgetsDragAndResize();
    
    // Auto-populate Rules Widget
    if (widgetId === 'widget-quick-rules') {
        if (typeof allRules !== 'undefined' && allRules.length > 0) {
            if (typeof renderWidgetRulebookHierarchy === 'function') {
                renderWidgetRulebookHierarchy(allRules);
            }
        } else {
            loadRulesCodex().then(() => {
                if (typeof renderWidgetRulebookHierarchy === 'function') {
                    renderWidgetRulebookHierarchy(allRules);
                }
            });
        }
    }
    if (typeof bringDesktopWidgetToFront === 'function') bringDesktopWidgetToFront(widgetElement);
    
    // Schedule a short timer to clamp the widget inside the visible browser viewport after rendering
    setTimeout(() => {
        // Measure the screen bounding rectangle of the widget element
        const widgetBoundingRect = widgetElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        let newLeft = parseFloat(widgetElement.style.left);
        if (isNaN(newLeft)) newLeft = widgetBoundingRect.left;
        let newTop = parseFloat(widgetElement.style.top);
        if (isNaN(newTop)) newTop = widgetBoundingRect.top;
        
        let clamped = false;
        
        if (widgetBoundingRect.left < 0) { newLeft = 20; clamped = true; }
        if (widgetBoundingRect.top < 0) { newTop = 20; clamped = true; }
        if (widgetBoundingRect.right > viewportWidth) { newLeft = Math.max(20, viewportWidth - widgetBoundingRect.width - 20); clamped = true; }
        if (widgetBoundingRect.bottom > viewportHeight) { newTop = Math.max(20, viewportHeight - widgetBoundingRect.height - 60); clamped = true; }
        
        if (clamped) {
            widgetElement.style.left = newLeft + 'px';
            widgetElement.style.top = newTop + 'px';
        }
        saveWidgetVisibility();
    }, 10);
  } else {
    widgetElement.style.display = 'none';
    saveWidgetVisibility();
  }
}


function vtmPrompt(message, title = 'Input Required', defaultValue = '') {
  return new Promise(resolvePromise => {
    // Query the DOM for the custom dialog title, message, icon, and input elements by their IDs
    document.getElementById('vtmDialogTitle').innerText = title;
    document.getElementById('vtmDialogMessage').innerText = message;
    document.getElementById('vtmDialogIcon').className = 'fa-solid fa-pen-to-square';
    const inputContainer = document.getElementById('vtmDialogInputContainer');
    inputContainer.style.display = 'block';
    const inputField = document.getElementById('vtmDialogInput');
    inputField.value = defaultValue;
    const cancelButtonElement = document.getElementById('vtmDialogCancelBtn');
    cancelButtonElement.style.display = 'block';
    cancelButtonElement.innerText = 'Cancel';
    const confirmButtonElement = document.getElementById('vtmDialogConfirmBtn');
    confirmButtonElement.innerText = 'Save';
    const dialogModalElement = document.getElementById('vtmDialogModal');
    dialogModalElement.classList.add('active');
    // Schedule a short timer to focus the dialog text input once the modal is visible
    setTimeout(() => inputField.focus(), 50);
    const cleanup = () => {
      dialogModalElement.classList.remove('active');
      confirmButtonElement.onclick = null;
      cancelButtonElement.onclick = null;
      inputField.onkeydown = null;
    };
    const submit = () => {
      cleanup();
      resolvePromise(inputField.value);
    };
    confirmButtonElement.onclick = submit;
    cancelButtonElement.onclick = () => {
      cleanup();
      resolvePromise(null);
    };
    inputField.onkeydown = keyboardEvent => {
      if (keyboardEvent.key === 'Enter') submit();
      if (keyboardEvent.key === 'Escape') {
        cleanup();
        resolvePromise(null);
      }
    };
  });
}




function vtmSelectPrompt(message, title = 'Select Option', options = [], defaultValue = '') {
  return new Promise(resolvePromise => {
    // Query the DOM for the custom dialog title, message, icon, input container, and select elements
    document.getElementById('vtmDialogTitle').innerText = title;
    document.getElementById('vtmDialogMessage').innerText = message;
    document.getElementById('vtmDialogIcon').className = 'fa-solid fa-list-ul';
    const inputContainer = document.getElementById('vtmDialogInputContainer');
    inputContainer.style.display = 'block';
    const inputField = document.getElementById('vtmDialogInput');
    inputField.style.display = 'none';
    const selectField = document.getElementById('vtmDialogSelect');
    selectField.style.display = 'block';
    selectField.innerHTML = '';
    options.forEach(optionItem => {
      // Create a new option element in the DOM for each selectable choice
      const optionElement = document.createElement('option');
      if (typeof optionItem === 'object' && optionItem !== null) {
          optionElement.value = optionItem.value;
          optionElement.innerText = optionItem.label;
          if (optionItem.value == defaultValue) optionElement.selected = true;
      } else {
          optionElement.value = optionItem;
          optionElement.innerText = optionItem;
          if (optionItem == defaultValue) optionElement.selected = true;
      }
      selectField.appendChild(optionElement);
    });
    // Query the DOM for the dialog cancel button, confirm button, and modal container elements
    const cancelButtonElement = document.getElementById('vtmDialogCancelBtn');
    cancelButtonElement.style.display = 'block';
    cancelButtonElement.innerText = 'Cancel';
    const confirmButtonElement = document.getElementById('vtmDialogConfirmBtn');
    confirmButtonElement.innerText = 'Save';
    const dialogModalElement = document.getElementById('vtmDialogModal');
    dialogModalElement.classList.add('active');
    // Schedule a short timer to focus the select dropdown once the modal is visible
    setTimeout(() => selectField.focus(), 50);
    const cleanup = () => {
      dialogModalElement.classList.remove('active');
      confirmButtonElement.onclick = null;
      cancelButtonElement.onclick = null;
      selectField.onkeydown = null;
      inputField.style.display = 'block';
      selectField.style.display = 'none';
    };
    const submit = () => {
      cleanup();
      resolvePromise(selectField.value);
    };
    confirmButtonElement.onclick = submit;
    cancelButtonElement.onclick = () => {
      cleanup();
      resolvePromise(null);
    };
    selectField.onkeydown = keyboardEvent => {
      if (keyboardEvent.key === 'Enter') submit();
      if (keyboardEvent.key === 'Escape') {
        cleanup();
        resolvePromise(null);
      }
    };
  });
}

function vtmAlert(message, title = 'Notice') {
    return new Promise(resolvePromise => {
        // Query the DOM for the toast notification container element by its ID
        let toastContainerElement = document.getElementById('vtm-toast-container');
        if (!toastContainerElement) {
            // Create a new div element in the DOM to hold toast notifications if none exists
            toastContainerElement = document.createElement('div');
            toastContainerElement.id = 'vtm-toast-container';
            toastContainerElement.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
            document.body.appendChild(toastContainerElement);
        }
        
        const isError = String(message).toLowerCase().includes('fail') || String(message).toLowerCase().includes('error');
        const bgColor = isError ? 'rgba(153, 27, 27, 0.95)' : 'rgba(20, 14, 17, 0.95)';
        const borderColor = isError ? '#ef4444' : '#3b82f6';
        const icon = isError ? 'fa-triangle-exclamation' : 'fa-circle-check';
        const iconColor = isError ? '#ef4444' : '#10b981';
        
        // Create a new div element in the DOM for the individual toast alert card
        const toastElement = document.createElement('div');
        toastElement.style.cssText = `background: ${bgColor}; color: #f8fafc; padding: 12px 20px; border-radius: 4px; border: 1px solid ${borderColor}; border-left: 4px solid ${borderColor}; box-shadow: 0 4px 12px rgba(0,0,0,0.5); font-size: 13px; min-width: 250px; max-width: 350px; display: flex; flex-direction: column; gap: 4px; opacity: 0; transform: translateX(50px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); pointer-events: auto;`;
        
        toastElement.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; font-weight:bold; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#9ca3af;">
                <i class="fa-solid ${icon}" style="color:${iconColor}; font-size:14px;"></i> ${title}
            </div>
            <div style="line-height:1.4;">${message}</div>
        `;
        
        toastContainerElement.appendChild(toastElement);
        
        // Animate in using nested browser requestAnimationFrame calls so the initial CSS state is committed first
        requestAnimationFrame(() => {
            // Trigger the slide-in transition on the next animation frame
            requestAnimationFrame(() => {
                toastElement.style.opacity = '1';
                toastElement.style.transform = 'translateX(0)';
            });
        });
        
        // Animate out after 4 seconds using browser timers
        setTimeout(() => {
            toastElement.style.opacity = '0';
            toastElement.style.transform = 'translateX(50px)';
            // Remove the toast element from the DOM after its fade-out animation finishes
            setTimeout(() => toastElement.remove(), 300);
        }, 4000);
        
        resolvePromise();
    });
}

function vtmConfirm(message, title = 'Confirm') {
  return new Promise(resolvePromise => {
    // Query the DOM for the custom confirmation dialog elements by their IDs
    document.getElementById('vtmDialogTitle').innerText = title;
    document.getElementById('vtmDialogMessage').innerText = message;
    document.getElementById('vtmDialogIcon').className = 'fa-solid fa-triangle-exclamation';
    document.getElementById('vtmDialogInputContainer').style.display = 'none';
    const cancelButtonElement = document.getElementById('vtmDialogCancelBtn');
    cancelButtonElement.style.display = 'block';
    cancelButtonElement.innerText = 'Cancel';
    const confirmButtonElement = document.getElementById('vtmDialogConfirmBtn');
    confirmButtonElement.innerText = 'Confirm';
    const dialogModalElement = document.getElementById('vtmDialogModal');
    dialogModalElement.classList.add('active');
    const cleanup = () => {
      dialogModalElement.classList.remove('active');
      confirmButtonElement.onclick = null;
      cancelButtonElement.onclick = null;
    };
    confirmButtonElement.onclick = () => {
      cleanup();
      resolvePromise(true);
    };
    cancelButtonElement.onclick = () => {
      cleanup();
      resolvePromise(false);
    };
  });
}


function makeFloating(widgetElement, headerElement) {
  if (!widgetElement || !headerElement || headerElement.__floatingAttached) return;
  headerElement.__floatingAttached = true;
  let isDragging = false;
  let startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
  
  headerElement.onmousedown = (mouseEvent) => {
    if (mouseEvent.target.closest('button, input, select, textarea')) return;
    mouseEvent.preventDefault();
    isDragging = true;
    startX = mouseEvent.clientX;
    startY = mouseEvent.clientY;
    // Measure the current screen bounding rectangle of the floating widget element
    const widgetBoundingRect = widgetElement.getBoundingClientRect();
    initialLeft = widgetBoundingRect.left;
    initialTop = widgetBoundingRect.top;
    
    const onMouseMove = (mouseMoveEvent) => {
      if (!isDragging) return;
      const deltaX = mouseMoveEvent.clientX - startX;
      const deltaY = mouseMoveEvent.clientY - startY;
      widgetElement.style.left = `${Math.max(10, initialLeft + deltaX)}px`;
      widgetElement.style.top = `${Math.max(10, initialTop + deltaY)}px`;
      widgetElement.style.right = 'auto';
      widgetElement.style.bottom = 'auto';
    };
    
    const onMouseUp = () => {
      isDragging = false;
      // Remove the temporary drag event listeners from the browser window
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    
    // Attach temporary mousemove and mouseup listeners to the window while dragging
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
}

function formatGameTimeString(inputTimeString) {
  if (!inputTimeString) return '';
  let formattedTimeString = inputTimeString.trim();
  // Strip leading zeros before single-digit hours (e.g., "08:00 pm" -> "8:00 pm", "02:30 AM" -> "2:30 AM")
  formattedTimeString = formattedTimeString.replace(/^0([1-9]:)/, '$1');
  // If user inputs a compact hour like "8pm" or "10am", expand to "8:00pm" or "10:00am"
  const singleHourMatch = formattedTimeString.match(/^([1-9]|1[0-2])\s*([ap]m)$/i);
  if (singleHourMatch) {
    formattedTimeString = `${singleHourMatch[1]}:00${singleHourMatch[2].toLowerCase()}`;
  } else {
    formattedTimeString = formattedTimeString.replace(/\s*([ap]m)$/i, (fullMatch, meridiemSuffix) => meridiemSuffix.toLowerCase());
  }
  return formattedTimeString;
}

function setTimePreset(presetStr) {
  // Query the DOM for the time widget text input element by its ID
  const timeWidgetInputElement = document.getElementById('timeWidgetInput');
  if (timeWidgetInputElement) {
    timeWidgetInputElement.value = formatGameTimeString(presetStr);
    timeWidgetInputElement.focus();
  }
}

function toggleTimeWidget() {
  if ((activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller')) return;
  // Query the DOM for the chronicle time widget element by its ID
  const timeWidgetElement = document.getElementById('widget-chronicle-time');
  if (!timeWidgetElement) return;
  // Check whether the time widget is currently hidden via inline or computed CSS styles
  const isHidden = timeWidgetElement.style.display === 'none' || !timeWidgetElement.style.display || getComputedStyle(timeWidgetElement).display === 'none';
  if (isHidden) {
    timeWidgetElement.style.display = 'block';
    // Query the DOM for the header game clock display and time widget input elements
    const gameClockElement = document.getElementById('gameClock');
    const timeWidgetInputElement = document.getElementById('timeWidgetInput');
    if (gameClockElement && timeWidgetInputElement) {
      timeWidgetInputElement.value = (gameClockElement.innerText || gameClockElement.textContent || '').trim();
      timeWidgetInputElement.focus();
      timeWidgetInputElement.select();
    }
    // Query the DOM for the time widget header element to make the popup draggable
    const timeWidgetHeaderElement = document.getElementById('timeWidgetHeader');
    if (timeWidgetHeaderElement) makeFloating(timeWidgetElement, timeWidgetHeaderElement);
  } else {
    timeWidgetElement.style.display = 'none';
  }
}

async function saveGameTime() {
  // Query the DOM for the time widget text input element by its ID
  const timeWidgetInputElement = document.getElementById('timeWidgetInput');
  if (!timeWidgetInputElement) return;
  let formattedTimeValue = timeWidgetInputElement.value.trim();
  if (!formattedTimeValue) return;
  formattedTimeValue = formatGameTimeString(formattedTimeValue);
  const startTime = Date.now();
  console.log(`[TRACE] Updating game clock for chronicle ${activeChronicleId} to: "${formattedTimeValue}"`);
  try {
    // Send an authenticated HTTP POST request to persist the updated in-game time for the chronicle scene
    const fetchResponse = await authFetch('/api/gameboard/scene', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicle_id: activeChronicleId,
        game_time: formattedTimeValue
      })
    });
    if (fetchResponse.ok) {
      const duration = Date.now() - startTime;
      console.log(`[TRACE] Game clock successfully persisted in ${duration}ms`);
      // Query the DOM for the header game clock display element by its ID
      const gameClockElement = document.getElementById('gameClock');
      if (gameClockElement) gameClockElement.innerText = formattedTimeValue;
      toggleTimeWidget();
    } else {
      console.error(`[ERROR] Failed to persist game clock: status ${fetchResponse.status}`);
    }
  } catch (errorObject) {
    console.error('[ERROR] Exception saving game clock:', errorObject);
  }
}


function formatLineBreaks(rawText) {
    if (!rawText) return '';
    return rawText.replace(/\n/g, '<br>');
}
