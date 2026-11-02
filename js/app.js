let currentMapPins = [];
let globalClanSymbols = [];
let npcCategoriesList = [];
const socket = io();
let currentUser = null;
let activeCampaignRole = null;
let currentAuthMode = 'login';
let activeCampaignId = null;
let activeEpisodeId = 1;
let currentLoadedCharacterId = null;
let activeControlledCharacterId = null;
let campaignCharactersList = [];
let currentCampaignData = null;
let currentEpisodeData = null;
let campaignMembersList = [];
socket.on('connect', () => {
  document.getElementById('socketStatus').innerHTML = '<span class="status-dot"></span> <span class="status-text">LIVE</span>';
  socket.emit('room:join', activeCampaignId || 1);
});
socket.on('disconnect', () => {
  document.getElementById('socketStatus').innerHTML = '<span class="status-dot" style="background:#ef4444;box-shadow:0 0 6px #ef4444;"></span> <span class="status-text" style="color:#ef4444;">OFFLINE</span>';
});
socket.on('dice:result', roll => {
  appendDiceRollToLedger(roll);
});
socket.on('dice:secret_rolled', data => {
  if (activeCampaignRole === 'player') {
    const ledger = document.getElementById('diceLedger');
    const entry = document.createElement('div');
    entry.className = 'roll-entry';
    entry.innerHTML = `<span style="color:#9ca3af;font-style:italic;"><i class="fa-solid fa-user-secret"></i> ${data.rollerName} rolled a secret test.</span>`;
    ledger.prepend(entry);
  }
});
socket.on('gameboard:scene_updated', state => {
  applySceneState(state);
});
socket.on('gameboard:canvas_updated', data => {
  if (activeCampaignId && data.campaign_id === activeCampaignId && data.canvas_state) {
    loadCanvasFromState(data.canvas_state, false);
  }
});
socket.on('chat:new_message', msg => {
  if (activeCampaignId && (msg.chronicle_id === activeCampaignId || msg.campaign_id === activeCampaignId)) {
    appendChatMessage(msg);
  }
});
socket.on('gameboard:clue_revealed', clue => {
  addClueToCorkboard(clue);
  loadClueMatricesForWidget();
  if (activeEpisodeId && (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
});
socket.on('gameboard:clue_hidden', data => {
  removeClueFromGameboard(data.id);
  loadClueMatricesForWidget();
  if (activeEpisodeId && (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
});
socket.on('gameboard:lore_revealed', lore => {
  addLoreToGameboard(lore);
  loadLoreMatricesForWidget();
  if (activeEpisodeId && (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
});
socket.on('gameboard:lore_hidden', data => {
  removeLoreFromGameboard(data.id);
  loadLoreMatricesForWidget();
  if (activeEpisodeId && (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
});
socket.on('character:updated', char => {
  if (activeCampaignId) {
    loadGameboardState();
    loadCharacters();
  }
});
socket.on('character:vitals_updated', data => {
  if (activeCampaignId) {
    loadCharacters();
  }
});
socket.on('gameboard:map_updated', data => {
  if (data && data.active_map_url) {
    switchGameboardMap(data.active_map_url);
  }
});
socket.on('rules:updated', () => {
  loadRulesCodex();
});
socket.on('coterie:request_received', data => {
  if ((activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') && activeCampaignId === data.campaign_id) {
    updatePendingBadgeCount();
    const pendingModal = document.getElementById('coterieManagerModal');
    if (pendingModal && pendingModal.classList.contains('active')) {
      loadCoterieModalData();
    }
  }
});
socket.on('coterie:request_approved', data => {
  if (currentUser && currentUser.id === data.user_id) {
    alert('Your request to join the chronicle has been approved by the Storyteller!');
    const lobbyView = document.getElementById('tab-lobby');
    if (lobbyView && lobbyView.classList.contains('active')) {
      renderChronicleLobby();
    }
  }
});
socket.on('presence:sync', activeUsers => {
  currentCampaignActiveUsers = activeUsers || [];
  renderActivePlayersBar(currentCampaignActiveUsers);
});
document.addEventListener('DOMContentLoaded', () => {
  checkActiveSession();
  loadRulesCodex();
  initDesktopWidgetsDragAndResize();
  initDiceWidgetDisplay();
  const savedOpacity = localStorage.getItem('vtm_widget_opacity');
  if (savedOpacity) {
    document.documentElement.style.setProperty('--widget-opacity', (parseInt(savedOpacity, 10) / 100).toFixed(2));
  }
  const savedBrightness = localStorage.getItem('vtm_backdrop_brightness');
  if (savedBrightness) {
    document.documentElement.style.setProperty('--backdrop-brightness', (parseInt(savedBrightness, 10) / 100).toFixed(2));
  }
  const savedBackdrop = localStorage.getItem('vtm_global_backdrop');
  if (savedBackdrop) {
    const globalImg = document.getElementById('globalBackdropImg');
    if (globalImg) globalImg.src = savedBackdrop;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const activeModals = document.querySelectorAll('.vtm-modal.active, .modal-backdrop.active, .modal.active');
    activeModals.forEach(m => m.classList.remove('active'));
  }
});
let activeNpcPersonaId = null;
let activeNpcCastCategory = 'all';
let currentCampaignActiveUsers = [];
let personaSelectorDropdownEl = null;
let newCharAvatarDataUrl = null;
const createLoreEntrySubmit = createLoreSubmit;
let allRules = [];
let activeRuleCategory = 'All';
let canvasState = {
  backdrop: '/images/concept_map.jpg',
  entities: [],
  links: []
};
let canvasTransform = {
  panX: 0,
  panY: 0,
  zoom: 1.0,
  isPanning: false,
  startX: 0,
  startY: 0
};
let activeDragEntity = null;
let activeResizeEntity = null;
let linkingSourceEntityId = null;
let saveCanvasTimeout = null;
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
let highestDesktopWidgetZIndex = 50;
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
let allCampaignClueMatrices = [];
let activeWidgetMatrixId = null;
let allCampaignLoreMatrices = [];
let activeWidgetLoreMatrixId = null;
let activeLoreWidgetCategory = 'all';
window.addEventListener('click', e => {
  if (!e.target.closest('.elysium-dropdown-container')) closeVttDropdown();
  if (!e.target.closest('.elysium-user-capsule')) closeUserDropdown();
});
window.addEventListener('message', event => {
  if (event.data && event.data.type === 'vtm:sheet_updated') {
    const charId = Number(event.data.char_id);
    const char = campaignCharactersList.find(c => c.id === charId);
    if (char) {
      if (event.data.vitals) {
        Object.assign(char, event.data.vitals);
      }
      if (event.data.sheet_data) {
        char.sheet_data = event.data.sheet_data;
      }
      if (currentLoadedCharacterId === charId || activeControlledCharacterId === charId || activeNpcPersonaId === charId) {
        updateDossierWidget(char);
      }
      renderCoterieTokens(campaignCharactersList);
      renderNpcCastWidget();
      loadCharacters();
    }
  }
});


// --- NEW GLOBALS ---
const originalToggleWidget = toggleWidget;
  window.toggleWidget = function (widgetId) {
    originalToggleWidget(widgetId);
    if (widgetId === 'widget-story') {
      renderStoryWidgetEpisodes();
    }
  };
  let mapPinMode = false;
  document.getElementById('canvasStage')?.addEventListener('click', async e => {
    if (!mapPinMode) return;
    const stage = e.currentTarget;
    const rect = stage.getBoundingClientRect();
    let scale = 1;
    const transformMatch = stage.style.transform.match(/scale\(([^)]+)\)/);
    if (transformMatch) scale = parseFloat(transformMatch[1]);
    const x = Math.round((e.clientX - rect.left) / scale);
    const y = Math.round((e.clientY - rect.top) / scale);
    const title = prompt("Enter location title:");
    if (!title) {
      toggleMapPinMode();
      return;
    }
    const desc = prompt("Enter location description (optional):") || "";
    let rawUrl = document.getElementById('episodeMapSelector')?.value || canvasState?.backdrop || '';
    const mapUrl = new URL(rawUrl, window.location.origin).pathname;
    try {
      const res = await authFetch(`/api/chronicles/${activeCampaignId}/pins`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          map_url: mapUrl,
          x,
          y,
          title,
          description: desc
        })
      });
      if (res.ok) {
        loadMapPins();
      }
    } catch (err) {
      console.error(err);
    }
    toggleMapPinMode();
  });
  socket.on('gameboard:pins_updated', () => {
    if (typeof loadMapPins === 'function') loadMapPins();
    if (typeof loadCampaignPins === 'function') loadCampaignPins();
  });
  window.editingNpcCategoryId = null;
  let vtmPromptResolve = null;
  let globalAssets = [];
  let globalAssetCategories = [];
  let bulkSelectedAssets = new Set();
  let currentAssetCategory = 'Uncategorized';
  let assetPickerCallback = null;
  let pickerSearchTerm = '';
  let currentCropper = null;
  let cropperResolve = null;
let currentCropperSkipGallery = false;
let currentCropperEntityType = null;
let currentCropperEntityId = null;
  window.alert = function (message) {
    if (typeof vtmAlert === 'function') {
      vtmAlert(message);
    } else {
      console.warn('Alert:', message);
    }
  };
  document.addEventListener('DOMContentLoaded', () => {
    const assetMain = document.querySelector('.assets-main');
    if (!assetMain) return;
    const overlay = document.createElement('div');
    overlay.id = 'dragDropOverlay';
    overlay.style.cssText = 'position: absolute; inset: 0; background: rgba(220, 38, 38, 0.15); border: 3px dashed #ef4444; border-radius: 12px; z-index: 1000; display: none; align-items: center; justify-content: center; pointer-events: none; backdrop-filter: blur(4px);';
    overlay.innerHTML = '<h2 style="color: #ef4444; font-family: Cinzel, serif; font-size: 32px; text-shadow: 0 0 20px #000;">DROP FILES TO UPLOAD</h2>';
    assetMain.style.position = 'relative';
    assetMain.appendChild(overlay);
    assetMain.addEventListener('dragover', e => {
      e.preventDefault();
      e.stopPropagation();
      overlay.style.display = 'flex';
    });
    assetMain.addEventListener('dragleave', e => {
      e.preventDefault();
      e.stopPropagation();
      if (e.target === overlay || e.target === assetMain) {
        overlay.style.display = 'none';
      }
    });
    assetMain.addEventListener('drop', async e => {
      e.preventDefault();
      e.stopPropagation();
      overlay.style.display = 'none';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const files = Array.from(e.dataTransfer.files);
        const imageFiles = files.filter(f => f.type.startsWith('image/'));
        if (imageFiles.length === 0) {
          if (typeof vtmAlert === 'function') vtmAlert('Please drop valid image files.', 'Invalid Files');
          return;
        }
        const availableCats = ['Uncategorized', ...globalAssetCategories];
        const uploadCat = await vtmSelectPrompt('Select category to upload these ' + imageFiles.length + ' assets into:', 'Upload Dropped Assets', availableCats, currentAssetCategory);
        if (!uploadCat) return;
        for (let file of imageFiles) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('chronicleId', activeCampaignId);
          formData.append('category', uploadCat);
          try {
            const res = await authFetch('/api/assets/upload', {
              method: 'POST',
              body: formData
            });
            if (res.ok) {
              const data = await res.json();
              if (data.success) {
                globalAssets.unshift(data.asset);
              }
            }
          } catch (err) {
            console.error('Upload failed', err);
          }
        }
        renderAssetCategories();
        renderAssetGrid();
      }
    });
  });


// --- ALL FUNCTIONS ---
function openClueDetailWidget(clueId) {
  let clue = null;
  let matrixName = '';
  for (const matrix of allCampaignClueMatrices) {
    if (matrix.clues) {
      const found = matrix.clues.find(c => c.id === clueId);
      if (found) {
        clue = found;
        matrixName = matrix.title;
        break;
      }
    }
  }
  
  if (!clue) return;
  
  const widget = document.getElementById('widget-clue-detail');
  const titleEl = document.getElementById('clueDetailTitle');
  const bodyEl = document.getElementById('clueDetailBody');
  if (titleEl) titleEl.innerText = clue.title;
  let html = `
      <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #3f3f46;">
          <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase;">Origin Matrix</div>
          <div style="font-size:12px; color:#9ca3af;">${escapeHtml(matrixName)}</div>
      </div>
      <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #3f3f46;">
          <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase;">Delivery Method</div>
          <div style="font-size:12px; color:#9ca3af;">${escapeHtml(clue.delivery_method || 'Unknown')}</div>
      </div>
      <div>
          <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase; margin-bottom:5px;">Detailed Description</div>
          <div style="white-space:pre-wrap;">${escapeHtml(clue.description || 'No description provided.')}</div>
      </div>
  `;
  if (bodyEl) bodyEl.innerHTML = html;
  if (widget) {
    widget.style.display = 'flex';
    if (typeof bringDesktopWidgetToFront === 'function') bringDesktopWidgetToFront(widget);
  }
}


function authFetch(url, options = {}) {
  const token = localStorage.getItem('vtm_auth_token');
  const headers = options.headers ? {
    ...options.headers
  } : {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, {
    ...options,
    headers
  });
}

function handleClueRevealed(clue) {
  if (!clue || !clue.id) return;
  const now = Date.now();
  if (lastHandledClueId === clue.id && now - lastHandledClueTime < 1000) {
    return;
  }
  lastHandledClueId = clue.id;
  lastHandledClueTime = now;
  console.log('[Trace][Socket] Received clue revealed/update event:', clue);
  addClueToCorkboard(clue);
  loadClueMatricesForWidget();
  if (activeEpisodeId && (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
}

async function checkActiveSession() {
  const token = localStorage.getItem('vtm_auth_token');
  if (!token) {
    showAuthGateway();
    return;
  }
  try {
    const res = await authFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      hideAuthGateway();
      returnToChronicleHub();
    } else {
      localStorage.removeItem('vtm_auth_token');
      showAuthGateway();
    }
  } catch (err) {
    console.error('Session check failed:', err);
    showAuthGateway();
  }
}

function showAuthGateway() {
  document.getElementById('authGateway').style.display = 'flex';
  document.getElementById('authErrorMessage').style.display = 'none';
  switchAuthTab('login');
}

function hideAuthGateway() {
  document.getElementById('authGateway').style.display = 'none';
}

function switchAuthTab(mode) {
  currentAuthMode = mode;
  document.getElementById('authTabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('authTabRegister').classList.toggle('active', mode === 'register');
  document.getElementById('authDisplayNameGroup').style.display = mode === 'register' ? 'block' : 'none';
  document.getElementById('authSubmitBtn').innerText = mode === 'login' ? 'ENTER THE NIGHT' : 'CREATE ACCOUNT & ENTER';
  document.getElementById('authErrorMessage').style.display = 'none';
  const passInput = document.getElementById('authPassword');
  const passIcon = document.getElementById('togglePasswordIcon');
  if (passInput) passInput.type = 'password';
  if (passIcon) {
    passIcon.classList.remove('fa-eye-slash');
    passIcon.classList.add('fa-eye');
  }
}

function togglePasswordVisibility(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon = document.getElementById(iconId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) {
      icon.classList.remove('fa-eye');
      icon.classList.add('fa-eye-slash');
    }
  } else {
    input.type = 'password';
    if (icon) {
      icon.classList.remove('fa-eye-slash');
      icon.classList.add('fa-eye');
    }
  }
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.submitAuth = submitAuth;
}

function submitAuth(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  return handleAuthSubmit(event || window.event || ({
    preventDefault: () => {}
  }));
}

async function handleAuthSubmit(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const displayName = document.getElementById('authDisplayName').value.trim();
  const errorBox = document.getElementById('authErrorMessage');
  errorBox.style.display = 'none';
  const endpoint = currentAuthMode === 'register' ? '/api/auth/register' : '/api/auth/login';
  const payload = {
    username,
    password,
    display_name: displayName
  };
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem('vtm_auth_token', data.token);
      currentUser = data.user;
      hideAuthGateway();
      returnToChronicleHub();
    } else {
      errorBox.innerText = data.error || 'Authentication failed. Please verify credentials.';
      errorBox.style.display = 'block';
    }
  } catch (err) {
    errorBox.innerText = 'Network error contacting authentication server.';
    errorBox.style.display = 'block';
  }
}

function logout() {
  if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('room:leave');
  localStorage.removeItem('vtm_auth_token');
  currentUser = null;
  activeCampaignId = null;
  activeCampaignRole = null;
  showAuthGateway();
}

function returnToChronicleHub() {
  if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('room:leave');
  activeCampaignId = null;
  activeCampaignRole = null;
  currentCampaignData = null;
  document.body.className = 'role-hub';
  if (currentUser) {
    const name = currentUser.displayName || currentUser.username;
    const disp = document.getElementById('profileDisplayName');
    if (disp) disp.innerText = name;
    const badge = document.getElementById('profileRoleBadge');
    if (badge) badge.innerText = 'HUB';
    const userDrop = document.getElementById('userDropdownUsername');
    if (userDrop) userDrop.innerText = name;
  }
  const sessionTitle = document.getElementById('headerSessionTitle') || document.getElementById('headerChronicleTitle');
  if (sessionTitle) sessionTitle.innerText = 'THE CHRONICLE HUB';
  const actLabel = document.getElementById('headerActLabel');
  if (actLabel) actLabel.innerText = 'DIRECTORY';
  const activeWorkspace = document.getElementById('activeWorkspaceLabel');
  if (activeWorkspace) activeWorkspace.innerText = 'HUB';
  switchTab('lobby');
  renderChronicleLobby();
  renderActivePlayersBar();
}

function enterChronicle(campaignId, role, targetTab = 'gameboard') {
  activeCampaignId = campaignId;
  activeCampaignRole = role;
  document.body.className = `role-${role}`;
  const name = currentUser ? currentUser.displayName || currentUser.username : 'Kindred';
  const disp = document.getElementById('profileDisplayName');
  if (disp) disp.innerText = name;
  const badge = document.getElementById('profileRoleBadge');
  if (badge) badge.innerText = role === 'gm' || role === 'storyteller' ? 'STORYTELLER' : 'COTERIE PLAYER';
  const userDrop = document.getElementById('userDropdownUsername');
  if (userDrop) userDrop.innerText = name;
  const activeWorkspace = document.getElementById('activeWorkspaceLabel');
  if (activeWorkspace) activeWorkspace.innerText = 'VTT';
  document.querySelectorAll('.gm-only-control').forEach(el => {
    el.style.display = role === 'gm' || role === 'storyteller' ? '' : 'none';
  });
  document.querySelectorAll('.player-only-display').forEach(el => {
    el.style.display = role === 'player' ? '' : 'none';
  });
  const diceRollerName = document.getElementById('diceRollerName');
  if (diceRollerName) {
    diceRollerName.value = role === 'gm' ? 'Storyteller' : name;
  }
  socket.emit('room:join', {
    campaignId: activeCampaignId,
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
  switchTab(targetTab);
  authFetch(`/api/chronicles/${campaignId}`).then(res => res.json()).then(camp => {
    if (camp && camp.title) {
      const sTitle = document.getElementById('headerSessionTitle');
      if (sTitle) sTitle.innerText = camp.title.toUpperCase();
      const aLabel = document.getElementById('headerActLabel');
      if (aLabel) aLabel.innerText = 'ACT 1';
    }
  }).catch(err => console.error(err));
  loadGameboardState();
  loadCharacters();
  loadRecentRolls();
  loadClueMatricesForWidget();
  loadLoreMatricesForWidget();
  loadNpcCategories();
  if (role === 'gm') {
    loadCampaignsList();
    updatePendingBadgeCount();
  }
}

function switchTab(tabId) {
  if (tabId === 'campaigns' && activeCampaignRole !== 'gm') {
    alert('Access denied: The Chronicles & Arcs workshop is restricted to the Storyteller.');
    return;
  }
  if ((tabId === 'gameboard' || tabId === 'characters') && !activeCampaignId) {
    alert('Please select or create a chronicle first.');
    returnToChronicleHub();
    return;
  }
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
  const activeBtn = document.getElementById(`tabBtn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');
  const activeView = document.getElementById(`tab-${tabId}`);
  if (activeView) activeView.classList.add('active');
  if (tabId === 'campaigns' && (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller')) {
    loadCoterieManagement();
  } else if (tabId === 'lobby') {
    activeCampaignId = null;
    activeCampaignRole = null;
    if (typeof socket !== 'undefined' && socket && socket.connected) socket.emit('room:leave');
    renderChronicleLobby();
  } else if (tabId === 'gameboard') {
    setTimeout(() => {
      initDesktopWidgetsDragAndResize();
      renderClueCords();
    }, 80);
  }
}

function toggleStorytellerDrawer() {
  const drawer = document.getElementById('storytellerDrawer');
  drawer.classList.toggle('open');
  if (drawer.classList.contains('open')) {
    loadDrawerUnrevealedClues();
    loadDrawerUnrevealedLore();
  }
}

async function loadGameboardState() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/gameboard/state?campaign_id=${activeCampaignId}`);
    if (res.status === 403) {
      console.warn('Access denied to campaign table. Redirecting to lobby directory.');
      openChronicleLobby();
      return;
    }
    const data = await res.json();
    if (data.gameboard) {
      applySceneState(data.gameboard);
      const gameboardDropdown = document.getElementById('episodeMapSelector');
      if (gameboardDropdown) {
        gameboardDropdown.innerHTML = '';
        const maps = data.gameboard.active_episode_maps || [];
        if (maps.length === 0) {
          gameboardDropdown.innerHTML = '<option value="/images/concept_map.jpg">Default Concept Map</option>';
        } else {
          maps.forEach((m, i) => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.innerText = 'Map ' + (i + 1) + ': ' + m.split('/').pop();
            gameboardDropdown.appendChild(opt);
          });
        }
        if (data.gameboard.active_map_url) gameboardDropdown.value = data.gameboard.active_map_url;
      }
    }
    if (data.players && data.players.length > 0) {
      ;
      renderCoterieTokens(data.players);
      populateDicePersonaSelector();
    }
    if (data.discoveredClues && data.discoveredClues.length > 0) {
      data.discoveredClues.forEach(c => {
        const existing = currentEpisodeClues.find(cl => cl.id === `e${c.id}` || cl.title.toLowerCase() === c.title.toLowerCase());
        if (existing) {
          existing.status = 'discovered';
          existing.title = c.title;
          existing.description = c.description;
        }
      });
    }
    if (typeof updateClueCardsDisplay === 'function') updateClueCardsDisplay();
    const corkboard = document.getElementById('discoveredCluesList');
    corkboard.innerHTML = '';
    if (data.discoveredClues && data.discoveredClues.length > 0) {
      data.discoveredClues.forEach(c => addClueToCorkboard(c));
    } else {
      corkboard.innerHTML = '<div class="clue-empty-state">No clues uncovered yet. Search the scene!</div>';
    }
    const loreContainer = document.getElementById('discoveredLoreList');
    loreContainer.innerHTML = '';
    if (data.discoveredLore && data.discoveredLore.length > 0) {
      data.discoveredLore.forEach(l => addLoreToGameboard(l));
    } else {
      loreContainer.innerHTML = '<div class="clue-empty-state">No setting lore uncovered yet. Question elders and search archives!</div>';
    }
  } catch (err) {
    console.error('Failed to load gameboard state:', err);
  }
}

function toggleAtmosphereBanner() {
  const wrap = document.getElementById('atmosphereBannerWrap');
  const icon = document.getElementById('atmosphereToggleIcon');
  if (!wrap) return;
  if (wrap.classList.contains('collapsed')) {
    wrap.classList.remove('collapsed');
    if (icon) icon.className = 'fa-solid fa-chevron-up';
  } else {
    wrap.classList.add('collapsed');
    if (icon) icon.className = 'fa-solid fa-chevron-down';
  }
}

function applySceneState(state) {
  if (state.active_scene_banner) {
    const banner = document.getElementById('sceneBannerImg') || document.getElementById('sceneBanner');
    if (banner) banner.src = state.active_scene_banner;
  }
  if (state.active_location) {
    const loc = document.getElementById('sceneLocation');
    if (loc) loc.innerText = state.active_location;
  }
  if (state.active_mood_text) {
    const mood = document.getElementById('sceneMoodText');
    if (mood) mood.innerText = state.active_mood_text;
  }
  if (state.active_npc_persona) {
    const disp = document.getElementById('gmPersonaDisplay');
    if (disp) disp.innerText = state.active_npc_persona;
    const sel = document.getElementById('gmPersonaSelect');
    if (sel) sel.value = state.active_npc_persona;
  }
  if (state.canvas_state) {
    loadCanvasFromState(state.canvas_state, false);
  }
  if (state.game_time) {
    const clock = document.getElementById('gameClock');
    if (clock) clock.innerText = state.game_time;
  }
  if (state.active_arc_title && state.active_episode_title) {
    const actLabel = document.getElementById('headerActLabel');
    if (actLabel) {
      actLabel.innerText = `${state.active_arc_title.toUpperCase()}: ${state.active_episode_title.toUpperCase()}`;
    }
  }
}

function addClueToCorkboard(clue) {
  const corkboard = document.getElementById('discoveredCluesList');
  const empty = corkboard.querySelector('.clue-empty-state');
  if (empty) empty.remove();
  const existingCard = document.getElementById(`clue-card-${clue.id}`);
  if (existingCard) return;
  const isRevealed = clue.discovered || true;
  const revealed = Boolean(clue.discovered);
  const card = document.createElement('div');
  card.id = `clue-card-${clue.id}`;
  card.className = 'clue-pin-card';
  const rot = Math.floor(Math.random() * 10) - 5;
  const mx = Math.floor(Math.random() * 20) - 10;
  const my = Math.floor(Math.random() * 20) - 10;
  const lineX = Math.floor(Math.random() * 200) - 100;
  const lineY = Math.floor(Math.random() * 200) - 100;
  card.style.transform = `rotate(${rot}deg) translate(${mx}px, ${my}px)`;
  card.style.position = 'relative';
  card.style.margin = '15px';
  card.style.zIndex = Math.floor(Math.random() * 10) + 1;
  let contentHtml = '';
  if (!revealed) {
    card.style.background = '#eab308';
    card.style.border = '2px solid #a16207';
    card.style.color = '#713f12';
    card.style.padding = '20px';
    card.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
    contentHtml = `
            <div style="position:absolute; top:50%; left:50%; transform: translate(-50%, -50%) rotate(-15deg); color:#ef4444; border:3px solid #ef4444; padding:4px; font-weight:900; letter-spacing:2px; opacity:0.8; font-size:14px; pointer-events:none;">SEALED</div>
            <div style="text-align:center; font-weight:bold; margin-bottom: 10px;">EVIDENCE FILE #${clue.id}</div>
            <div style="text-align:center; font-size: 10px;">TOP SECRET</div>
            <div style="text-align:center; font-size: 10px; margin-top: 5px;">${clue.matrix_title || 'Clue Matrix'}</div>
        `;
  } else {
    card.style.background = '#fdf6e3';
    card.style.border = '1px solid #d1d5db';
    card.style.padding = '15px';
    card.style.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.3)';
    contentHtml = `
            <div style="position:absolute; top:10px; right:10px; color:#ef4444; border:2px solid #ef4444; padding:2px; font-weight:bold; transform:rotate(10deg); opacity:0.6; font-size:10px; pointer-events:none;">CLASSIFIED</div>
            <div style="font-size:10px;text-transform:uppercase;color:#b45309;font-weight:700; border-bottom:1px dashed #b45309; padding-bottom:4px; margin-bottom:8px;">${clue.matrix_title || 'Clue Matrix'}</div>
            <h5 style="margin:0 0 5px 0; font-size:14px; font-weight:bold;"><i class="fa-solid fa-thumbtack" style="color:#ef4444; position:relative; z-index:2;"></i> ${clue.title}</h5>
            <p style="font-size:12px; line-height:1.4; margin:0 0 10px 0;">${clue.description}</p>
            <div style="font-size:9px;color:#6b7280; border-top:1px solid #e5e7eb; padding-top:4px;">
                <span><strong>Vector:</strong> ${clue.delivery_method || 'Discovered'}</span><br>
                <span><strong>Scene:</strong> ${clue.location_hint || 'General'}</span>
            </div>
        `;
  }
  const redString = `
        <svg style="position:absolute; top:20px; left:20px; width:200%; height:200%; overflow:visible; z-index:-1; pointer-events:none;">
            <line x1="0" y1="0" x2="${lineX}" y2="${lineY}" stroke="#ef4444" stroke-width="2" opacity="0.6"/>
        </svg>
    `;
  card.innerHTML = contentHtml + redString;
  corkboard.prepend(card);
}

function removeClueFromGameboard(clueId) {
  const card = document.getElementById(`clue-card-${clueId}`);
  if (card) card.remove();
  const corkboard = document.getElementById('discoveredCluesList');
  if (corkboard.querySelectorAll('.clue-pin-card').length === 0) {
    corkboard.innerHTML = '<div class="clue-empty-state">No clues uncovered yet. Search the scene!</div>';
  }
}

function addLoreToGameboard(lore) {
  const loreContainer = document.getElementById('discoveredLoreList');
  const empty = loreContainer.querySelector('.clue-empty-state');
  if (empty) empty.remove();
  const existingCard = document.getElementById(`lore-card-${lore.id}`);
  if (existingCard) return;
  const card = document.createElement('div');
  card.id = `lore-card-${lore.id}`;
  card.className = 'lore-parchment-card';
  card.innerHTML = `
        <div class="lore-card-header">
            <span class="lore-cat-badge">${lore.category || 'Chronicle Lore'}</span>
            <span class="lore-matrix-tag">${lore.matrix_title || 'Lore Archive'}</span>
        </div>
        <h5><i class="fa-solid fa-book-bookmark"></i> ${lore.title}</h5>
        <p class="lore-content">${lore.content}</p>
        <div class="lore-footer">
            <span><i class="fa-solid fa-scroll"></i> <strong>Revealed via:</strong> ${lore.revelation_vector || 'Elder Whispers'}</span>
        </div>
    `;
  loreContainer.prepend(card);
}

function removeLoreFromGameboard(loreId) {
  const card = document.getElementById(`lore-card-${loreId}`);
  if (card) card.remove();
  const loreContainer = document.getElementById('discoveredLoreList');
  if (loreContainer.querySelectorAll('.lore-parchment-card').length === 0) {
    loreContainer.innerHTML = '<div class="clue-empty-state">No setting lore uncovered yet. Question elders and search archives!</div>';
  }
}

function changeGmPersona(name) {
  if (!activeCampaignId) return;
  const avatarMap = {
    'Storyteller': '/images/st_avatar.png'
  };
  const avatar = avatarMap[name] || '/images/default_npc.jpg';
  authFetch('/api/gameboard/scene', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeCampaignId,
      active_npc_persona: name,
      active_npc_avatar: avatar
    })
  });
}

function broadcastSceneUpdate() {
  const loc = document.getElementById('drawerLocation').value;
  const mood = document.getElementById('drawerMood').value;
  authFetch('/api/gameboard/scene', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeCampaignId,
      active_location: loc,
      active_mood_text: mood
    })
  });
  toggleStorytellerDrawer();
}

function renderD10Svg(value, isHunger) {
  const val = parseInt(value, 10);
  const num = isNaN(val) ? 1 : val;
  const isTen = num === 10;
  const isSuccess = num >= 6;
  const isBestial = isHunger && num === 1;
  const isMessy = isHunger && isTen;
  const id = 'd10_' + Math.random().toString(36).substr(2, 6);
  let cCenter1, cCenter2, cTopL1, cTopL2, cTopR1, cTopR2, cBotL, cBotR, strokeRidge, glowClass;
  if (isHunger) {
    cCenter1 = '#c21a1a';
    cCenter2 = '#6e0a0a';
    cTopL1 = '#e02828';
    cTopL2 = '#9c1414';
    cTopR1 = '#9c1414';
    cTopR2 = '#5a0606';
    cBotL = '#3b0404';
    cBotR = '#280202';
    strokeRidge = 'rgba(255, 120, 120, 0.45)';
    glowClass = isMessy ? 'glow-messy-crit' : isBestial ? 'glow-bestial-fail' : 'glow-hunger';
  } else {
    cCenter1 = isTen ? '#2c333d' : '#22272e';
    cCenter2 = isTen ? '#181c22' : '#101317';
    cTopL1 = '#3a424e';
    cTopL2 = '#232932';
    cTopR1 = '#262d36';
    cTopR2 = '#171b21';
    cBotL = '#111418';
    cBotR = '#0a0c0e';
    strokeRidge = isTen ? 'rgba(251, 191, 36, 0.55)' : 'rgba(255, 255, 255, 0.25)';
    glowClass = isTen ? 'glow-crit' : isSuccess ? 'glow-success' : '';
  }
  let symbolContent = '';
  if (isBestial) {
    symbolContent = `
            <g transform="translate(50, 42) scale(0.9)">
                <path d="M 0 -13 C -8 -13 -13 -8 -13 0 C -13 5 -10 9 -5 11 L -5 13 C -5 14 -4 15 -3 15 L 3 15 C 4 15 5 14 5 13 L 5 11 C 10 9 13 5 13 0 C 13 -8 8 -13 0 -13 Z" fill="#141416"/>
                <ellipse cx="-4.5" cy="-1.5" rx="3.2" ry="2.2" fill="#d90404" transform="rotate(10 -4.5 -1.5)"/>
                <ellipse cx="4.5" cy="-1.5" rx="3.2" ry="2.2" fill="#d90404" transform="rotate(-10 4.5 -1.5)"/>
                <polygon points="-3,15 -1,15 -2,19" fill="#141416"/>
                <polygon points="1,15 3,15 2,19" fill="#141416"/>
            </g>
        `;
  } else if (isMessy) {
    symbolContent = `
            <g filter="drop-shadow(0 0 5px #ff4444)">
                <path d="M 34 37 L 27 31 L 31 40 L 26 44 L 34 44" fill="#fee2e2"/>
                <path d="M 66 37 L 73 31 L 69 40 L 74 44 L 66 44" fill="#fee2e2"/>
                <circle cx="50" cy="27" r="5.2" stroke="#fee2e2" stroke-width="2.4" fill="none"/>
                <line x1="41" y1="35" x2="59" y2="35" stroke="#fee2e2" stroke-width="2.4" stroke-linecap="round"/>
                <polygon points="47.5,35 52.5,35 52,50 50,56 48,50" fill="#fee2e2"/>
            </g>
        `;
  } else if (isTen && !isHunger) {
    symbolContent = `
            <g filter="drop-shadow(0 1px 3px rgba(0,0,0,0.8))">
                <!-- Star Left (bottom-left of crossbar towards blade bottom, fully enclosed) -->
                <polygon points="39,45 39.9,46.8 42,47 40.4,48.5 40.9,50.6 39,49.5 37.1,50.6 37.6,48.5 36,47 38.1,46.8" fill="#ffffff"/>
                <!-- Star Right (bottom-right of crossbar towards blade bottom, fully enclosed) -->
                <polygon points="61,45 61.9,46.8 64,47 62.4,48.5 62.9,50.6 61,49.5 59.1,50.6 59.6,48.5 58,47 60.1,46.8" fill="#ffffff"/>
                <!-- Ankh Loop -->
                <circle cx="50" cy="27" r="5.2" stroke="#ffffff" stroke-width="2.4" fill="none"/>
                <!-- Ankh Crossbar -->
                <line x1="41" y1="35" x2="59" y2="35" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round"/>
                <!-- Ankh Dagger Blade -->
                <polygon points="47.5,35 52.5,35 52,50 50,56 48,50" fill="#ffffff"/>
            </g>
        `;
  } else if (isSuccess) {
    const fillCol = isHunger ? '#fee2e2' : '#ffffff';
    symbolContent = `
            <g filter="drop-shadow(0 1px 3px rgba(0,0,0,0.8))">
                <circle cx="50" cy="27" r="5.2" stroke="${fillCol}" stroke-width="2.4" fill="none"/>
                <line x1="41" y1="35" x2="59" y2="35" stroke="${fillCol}" stroke-width="2.4" stroke-linecap="round"/>
                <polygon points="47.5,35 52.5,35 52,50 50,56 48,50" fill="${fillCol}"/>
            </g>
        `;
  } else {
    symbolContent = '';
  }
  const cTopLeft = isHunger ? '#a80000' : '#20242a';
  const cTopRight = isHunger ? '#7a0000' : '#14171a';
  const cBotLeft = isHunger ? '#570000' : '#181b1f';
  const cBotRight = isHunger ? '#380000' : '#0c0e10';
  const cCenterGrad1 = isHunger ? '#ff1a1a' : '#2a2e35';
  const cCenterGrad2 = isHunger ? '#d90404' : '#181b20';
  const strokeRidgeLine = isHunger ? 'rgba(255,160,160,0.45)' : isTen ? 'rgba(251,191,36,0.6)' : 'rgba(255,255,255,0.25)';
  return `
        <div class="v5-d10-die-wrapper ${glowClass}" title="${isHunger ? 'Hunger Die' : 'Regular Die'}: ${num}">
            <svg viewBox="0 0 100 100" class="v5-d10-svg">
                <defs>
                    <linearGradient id="${id}_center" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="${cCenterGrad1}"/>
                        <stop offset="100%" stop-color="${cCenterGrad2}"/>
                    </linearGradient>
                </defs>

                <!-- Ground Shadow -->
                <polygon points="50,6 92,42 92,66 50,98 8,66 8,42" fill="rgba(0,0,0,0.6)"/>

                <!-- Top Left Bevel (Lit) -->
                <polygon points="50,4 8,40 8,64 24,60" fill="${cTopLeft}"/>

                <!-- Top Right Bevel (Shadow) -->
                <polygon points="50,4 92,40 92,64 76,60" fill="${cTopRight}"/>

                <!-- Bottom Left Facet -->
                <polygon points="24,60 8,64 50,96 50,78" fill="${cBotLeft}"/>

                <!-- Bottom Right Facet (Deep Shadow) -->
                <polygon points="76,60 92,64 50,96 50,78" fill="${cBotRight}"/>

                <!-- Center Front Dominant Kite Face -->
                <polygon points="50,4 76,60 50,78 24,60" fill="url(#${id}_center)"/>

                <!-- Chiseled Edge Highlights -->
                <line x1="50" y1="4" x2="24" y2="60" stroke="${strokeRidgeLine}" stroke-width="0.9"/>
                <line x1="50" y1="4" x2="76" y2="60" stroke="${strokeRidgeLine}" stroke-width="0.8"/>
                <line x1="24" y1="60" x2="50" y2="78" stroke="rgba(0,0,0,0.65)" stroke-width="0.9"/>
                <line x1="76" y1="60" x2="50" y2="78" stroke="rgba(0,0,0,0.75)" stroke-width="0.9"/>
                <line x1="50" y1="78" x2="50" y2="96" stroke="rgba(0,0,0,0.85)" stroke-width="1.1"/>
                <polyline points="50,4 8,40 8,64 50,96 92,64 92,40 50,4" fill="none" stroke="rgba(0,0,0,0.7)" stroke-width="0.9"/>

                <!-- Face Symbol / Numeral -->
                ${symbolContent}
            </svg>
        </div>
    `;
}

function initDiceWidgetDisplay() {
  const facetsContainer = document.getElementById('diceFacetsDisplay');
  if (facetsContainer) {
    facetsContainer.innerHTML = [renderD10Svg(10, false), renderD10Svg(8, false), renderD10Svg(4, false), renderD10Svg(9, false), renderD10Svg(1, true)].join('');
  }
}

function executeDiceRoll() {
  const poolEl = document.getElementById('diceCount') || document.getElementById('dicePool');
  const hungerEl = document.getElementById('diceHunger');
  const personaSelect = document.getElementById('dicePersonaSelect');
  const rollerEl = document.getElementById('diceRollerName');
  const secretEl = document.getElementById('diceSecret');
  const totalPool = Math.max(1, parseInt(poolEl ? poolEl.value : 6) || 1);
  const hunger = Math.max(0, parseInt(hungerEl ? hungerEl.value : 1) || 0);
  const isSecret = secretEl ? secretEl.checked : false;
  let rollerName = currentUser && (currentUser.displayName || currentUser.username) || (rollerEl ? rollerEl.value : 'Kindred');
  let characterId = null;
  let characterName = 'Action';
  let isStorytellerWorld = false;
  const selectedPersona = personaSelect ? personaSelect.value : 'storyteller_world';
  if (selectedPersona === 'storyteller_world') {
    isStorytellerWorld = true;
    rollerName = 'Storyteller';
    characterName = 'Storyteller / World';
  } else if (selectedPersona === 'general_player') {
    characterName = rollerName;
  } else {
    characterId = parseInt(selectedPersona, 10);
    const char = campaignCharactersList.find(c => c.id === characterId);
    if (char) {
      characterName = char.name;
      if ((activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller')) {
        rollerName = `Storyteller (for ${char.name})`;
      } else {
        rollerName = currentUser ? currentUser.displayName || currentUser.username : char.name;
      }
    }
  }
  
  if (socket && socket.connected) {
    socket.emit('dice:roll', {
      campaignId: activeCampaignId || 1,
      rollerName,
      characterId,
      characterName,
      poolSize: totalPool,
      hungerCount: hunger,
      isSecret,
      isStorytellerWorld
    });
  }
}

function executeRouseCheck() {
  const personaSelect = document.getElementById('dicePersonaSelect');
  let rollerName = currentUser && (currentUser.displayName || currentUser.username) || 'Kindred';
  let charName = 'Rouse Check';
  let charId = null;
  let isStorytellerWorld = false;
  const selectedPersona = personaSelect ? personaSelect.value : 'storyteller_world';
  if (selectedPersona === 'storyteller_world') {
    isStorytellerWorld = true;
    rollerName = 'Storyteller';
  } else if (selectedPersona !== 'general_player') {
    charId = parseInt(selectedPersona, 10);
    const char = campaignCharactersList.find(c => c.id === charId);
    if (char) {
      charName = `${char.name} (Rouse)`;
      if (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') rollerName = `Storyteller (for ${char.name})`;
    }
    if (socket && socket.connected) {
      socket.emit('dice:roll', {
        campaignId: activeCampaignId || 1,
        rollerName,
        characterId: charId,
        characterName: charName,
        poolSize: 1,
        hungerCount: 1,
        isSecret: false,
        isStorytellerWorld
      });
    }
  }
}

async function loadRecentRolls() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/rolls?campaign_id=${activeCampaignId}`);
    if (!res.ok) return;
    const rolls = await res.json();
    const chatStream = document.getElementById('chatMessagesStream');
    if (chatStream) {
      chatStream.querySelectorAll('.channel-rolls').forEach(el => el.remove());
    }
    const ledger = document.getElementById('diceLedger');
    if (ledger) ledger.innerHTML = '';
    rolls.slice().reverse().forEach(r => appendDiceRollToLedger(r, false));
  } catch (err) {
    console.error('Failed to load recent rolls:', err);
  }
}

function appendDiceRollToLedger(r, scrollChat = true) {
  const regularDice = r.regular_results ? r.regular_results.toString().split(',').filter(Boolean) : [];
  const hungerDice = r.hunger_results ? r.hunger_results.toString().split(',').filter(Boolean) : [];
  let diceHtml = '';
  regularDice.forEach(d => {
    diceHtml += renderD10Svg(d, false);
  });
  hungerDice.forEach(d => {
    diceHtml += renderD10Svg(d, true);
  });
  const isSecretBadge = r.is_secret ? '<span style="color:#d97706;font-size:10px;"><i class="fa-solid fa-eye-slash"></i> SECRET</span>' : '';
  const resultTypeRaw = r.result_type || 'SUCCESS';
  const resultTypeLabel = resultTypeRaw.replace('_', ' ').toUpperCase();
  const timeStr = r.timestamp || r.created_at ? new Date(r.timestamp || r.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  const chatStream = document.getElementById('chatMessagesStream');
  if (chatStream) {
    const chatEntry = document.createElement('div');
    chatEntry.className = 'chat-msg-entry channel-rolls roll-chat-card';
    chatEntry.dataset.channel = 'rolls';
    if (currentChatChannel !== 'all' && currentChatChannel !== 'rolls') {
      chatEntry.style.display = 'none';
    }
    const hitsLabel = `${r.successes || 0} Hits`;
    const diffLabel = r.difficulty ? `Diff ${r.difficulty}` : '';
    chatEntry.innerHTML = `
            <div class="chat-msg-header">
                <span class="chat-msg-author author-roll"><i class="fa-solid fa-dice-d20" style="color:#ef4444;margin-right:4px;"></i> ${escapeHtml(r.roller_name || 'Storyteller')} ${isSecretBadge}</span>
                <span class="chat-msg-time">${timeStr}</span>
            </div>
            <div class="chat-roll-body">
                <div class="chat-roll-summary">
                    <span class="badge-result badge-${resultTypeRaw.toLowerCase()}">${resultTypeLabel}</span>
                    <span class="chat-roll-meta">${hitsLabel}${diffLabel ? ' • ' + diffLabel : ''}</span>
                </div>
                <div class="chat-roll-dice-grid">
                    ${diceHtml}
                </div>
            </div>
        `;
    chatStream.appendChild(chatEntry);
    if (scrollChat && (currentChatChannel === 'rolls' || currentChatChannel === 'all')) {
      chatStream.scrollTop = chatStream.scrollHeight;
    }
    const ledger = document.getElementById('diceLedger');
    if (ledger) {
      const entry = document.createElement('div');
      entry.className = 'roll-entry';
      entry.innerHTML = `
            <div class="roll-header">
                <span class="roll-roller">${escapeHtml(r.roller_name || 'Storyteller')} ${isSecretBadge}</span>
                <span class="badge-result badge-${resultTypeRaw.toLowerCase()}">${resultTypeLabel} (${r.successes} Hits / Diff ${r.difficulty})</span>
            </div>
            <div class="roll-dice-display">${diceHtml}</div>
        `;
      ledger.prepend(entry);
    }
    const facetsContainer = document.getElementById('diceFacetsDisplay');
    if (facetsContainer) {
      facetsContainer.innerHTML = '';
      const allDice = [...regularDice.map(val => ({
        val,
        isHunger: false
      })), ...hungerDice.map(val => ({
        val,
        isHunger: true
      }))];
      allDice.forEach(d => {
        facetsContainer.innerHTML += renderD10Svg(d.val, d.isHunger);
      });
    }
    const resultList = document.getElementById('diceResultDiceList');
    if (resultList) {
      const fullList = [...regularDice, ...hungerDice.map(h => `${h} (Hunger)`)].join(', ');
      resultList.innerText = fullList || 'None';
    }
    const resultCount = document.getElementById('diceResultSuccessCount');
    if (resultCount) {
      resultCount.className = `badge-success-count badge-${resultTypeRaw.toLowerCase()}`;
      resultCount.innerText = `${r.successes || 0} Successes (${resultTypeLabel})`;
    }
  }
}



function renderCoterieTokens(chars) {
  renderActivePlayersBar(currentCampaignActiveUsers);
}

function renderActivePlayersBar(activeUsers) {
  const coterieContainer = document.getElementById('playerTokens');
  if (!coterieContainer) return;
  coterieContainer.innerHTML = '';
  const isLobby = !activeCampaignId || document.getElementById('tab-lobby') && document.getElementById('tab-lobby').classList.contains('active');
  if (isLobby) {
    if (!currentUser) return;
    activeUsers = [{
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName || currentUser.username,
      role: currentUser.role || activeCampaignRole || 'player',
      characterName: null,
      characterId: null,
      avatar: currentUser.avatar || currentUser.avatar_url || '/images/default_avatar.png'
    }];
  }
  if (!activeUsers) activeUsers = [];
  const uniqueUsers = [];
  const seen = new Set();
  const storytellers = [];
  const players = [];
  activeUsers.forEach(u => {
    const isStoryteller = u.role === 'gm' || u.role === 'storyteller';
    if (isStoryteller) storytellers.push(u); else players.push(u);
  });
  const createGroup = (title, users, icon) => {
    if (users.length === 0) return;
    const sectionHeader = document.createElement('h4');
    sectionHeader.style.cssText = "margin: 10px 0 5px 0; font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;";
    sectionHeader.innerHTML = `<i class="${icon}"></i> ${title}`;
    coterieContainer.appendChild(sectionHeader);
    users.forEach(u => {
      const isSelf = currentUser && u.userId === currentUser.id;
      let charObj = null;
      if (u.characterId) {
        charObj = campaignCharactersList.find(c => c.id === u.characterId);
      }
      let avatarSrc = u.avatar || '/images/default_avatar.png';
      if (charObj && charObj.avatar_url && !charObj.avatar_url.includes('bg_page_1.png')) {
          avatarSrc = charObj.avatar_url;
      }
      let primaryName = u.displayName || u.username;
      let secondaryName = u.characterName || (u.role === 'gm' || u.role === 'storyteller' ? 'Storyteller' : 'Spectating');
      if ((u.role === 'gm' || u.role === 'storyteller') && u.activePersonaName) {
        secondaryName = u.activePersonaName;
      }
      const item = document.createElement('div');
      item.className = 'coterie-drop-token';
      item.title = `${primaryName} — Playing as ${secondaryName}`;
      let hungerBadge = '';
      if (charObj && charObj.vitals && charObj.vitals.hunger >= 3) {
        hungerBadge = `<span class="coterie-token-hunger-badge">${charObj.vitals.hunger}</span>`;
      }
      item.onclick = e => {
        if (isSelf) togglePersonaSelectorDropdown(e); else if (charObj) {
          updateDossierWidget(charObj);
          restoreWidget('widget-dossier');
        }
      };
      item.innerHTML = `
                <div class="coterie-token-avatar-wrap">
                    <img src="${avatarSrc}" alt="${escapeHtml(primaryName)}" class="coterie-token-img">
                    ${hungerBadge}
                    <span class="coterie-token-status-dot dot-active" style="position:absolute; bottom:-2px; right:-2px; width:10px; height:10px; border-radius:50%; background:#22c55e; border:2px solid #10171f;"></span>
                </div>
                <div class="player-drawer-info">
                    <div class="player-drawer-name">${escapeHtml(primaryName)}</div>
                    <div class="player-drawer-role">${escapeHtml(secondaryName)}</div>
                </div>
            `;
      coterieContainer.appendChild(item);
    });
  };
  createGroup('Storytellers', storytellers, 'fa-solid fa-crown');
  createGroup('Active Coterie', players, 'fa-solid fa-users');
}

function assumeActiveControl(characterId) {
  const char = campaignCharactersList.find(c => c.id === characterId);
  if (!char) return;
  activeControlledCharacterId = characterId;
  activeNpcPersonaId = null;
  currentLoadedCharacterId = characterId;
  renderCoterieTokens(campaignCharactersList);
  updateDossierWidget(char);
  const personaSelect = document.getElementById('dicePersonaSelect');
  if (personaSelect) {
    personaSelect.value = String(characterId);
  }
  const rollerEl = document.getElementById('diceRollerName');
  if (rollerEl) {
    rollerEl.value = char.name;
  }
  const chatLabel = document.getElementById('chatSenderLabel');
  if (chatLabel) {
    chatLabel.innerText = `Speaking as: ${char.name}`;
  }
  

  const privacyBtn = document.getElementById('btnPrivacyModeToggle');
  if (privacyBtn) {
    if (canEdit) {
      privacyBtn.style.display = 'inline-flex';
      privacyBtn.classList.remove('active-pilot');
    } else {
      privacyBtn.style.display = 'none';
    }
  }
  const modalAssume = document.getElementById('btnModalAssumeControl');
  if (modalAssume) {
    modalAssume.innerText = 'Active Persona (Currently Piloting)';
    modalAssume.classList.add('active-pilot');
  }
  renderNpcCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
  if (socket && activeCampaignId) {
    socket.emit('presence:set_character', {
      campaignId: activeCampaignId,
      characterId: characterId,
      isSpectator: false
    });
  }
}

function renderNpcCastWidget() {
  const container = document.getElementById('npcCastListContainer');
  if (!container) return;
  container.innerHTML = '';
  let castList = campaignCharactersList;
  // Removed aggressive filter: players can see all unhidden characters in the Cast Widget
  const defaultEntry = document.getElementById('npcEntry-default');
  if (defaultEntry) {
    if ((activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') || activeCampaignRole === 'storyteller') {
      defaultEntry.style.display = 'flex';
      if (!activeNpcPersonaId && !activeControlledCharacterId) {
        defaultEntry.classList.add('active-persona');
        const ind = defaultEntry.querySelector('.npc-active-indicator');
        if (ind) ind.classList.add('ring-active');
      } else {
        defaultEntry.classList.remove('active-persona');
        const ind = defaultEntry.querySelector('.npc-active-indicator');
        if (ind) ind.classList.remove('ring-active');
      }
    } else {
      defaultEntry.style.display = 'none';
    }
    let filtered = castList;
    if (activeNpcCastCategory !== 'all') {
      filtered = filtered.filter(c => c.category === activeNpcCastCategory);
    }
    const searchInput = document.getElementById('npcCastSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
    if (query) {
      filtered = filtered.filter(c => {
        const q = query.toLowerCase();
        const n = c.name ? c.name.toLowerCase() : '';
        const sn = c.short_name ? c.short_name.toLowerCase() : '';
        const cl = c.clan ? c.clan.toLowerCase() : '';
        const co = c.concept ? c.concept.toLowerCase() : '';
        const fb = (c.short_name || (c.name ? c.name.split(' ')[0] : '')).toLowerCase();
        return n.includes(q) || sn.includes(q) || cl.includes(q) || co.includes(q) || fb.includes(q);
      });
    }
    if (filtered.length === 0) {
      container.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;text-align:center;padding:24px 10px;">No characters found matching filter.</div>';
      return;
    }
    filtered.sort((a, b) => {
      if (a.category === 'pc' && b.category !== 'pc') return -1;
      if (a.category !== 'pc' && b.category === 'pc') return 1;
      return (a.short_name || a.name).localeCompare(b.short_name || b.name);
    });
    filtered.forEach(char => {
      const isSelected = activeNpcPersonaId === char.id || activeControlledCharacterId === char.id;
      const item = document.createElement('div');
      item.className = `npc-cast-entry ${isSelected ? 'active-persona' : ''}`;
      item.id = `npc-entry-${char.id}`;
      item.title = `Click to assume control of ${char.name}`;
      item.onclick = () => {
        if ((activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') || activeCampaignRole === 'storyteller') {
          if (char.category === 'pc') {
            assumeActiveControl(char.id);
          } else {
            toggleNpcPersona(char.id);
          }
        } else {
          assumeActiveControl(char.id);
        }
      };
      const avatarSrc = char.avatar_url && !char.avatar_url.includes('bg_page_1.png') ? char.avatar_url : '/images/caine_portrait.jpg?v=2';
      let categoryLabel = 'NPC';
      if (char.category === 'pc') categoryLabel = 'Player Character'; else if (char.category === 'important_kindred') categoryLabel = 'Elder'; else if (char.category === 'kindred') categoryLabel = 'Kindred'; else if (char.category === 'important_human') categoryLabel = 'VIP Human'; else if (char.category === 'human') categoryLabel = 'Human';
      item.innerHTML = `
            <div class="npc-avatar-wrap">
                <img src="${avatarSrc}" alt="${escapeHtml(char.name)}" class="npc-thumb-img">
                <span class="npc-active-indicator ${isSelected ? 'ring-active' : ''}"></span>
            </div>
            <div class="npc-meta-block">
                <div class="npc-name">${escapeHtml(char.short_name || char.name)}</div>
                <div class="npc-subtext">${escapeHtml(char.clan || 'Unknown')} &bull; ${categoryLabel}</div>
            </div>
            <div class="npc-right-actions">
                ${(activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') ? (() => {
                    const isHidden = char.hidden_from_user_ids !== null && char.hidden_from_user_ids !== undefined && char.hidden_from_user_ids !== 'null';
                    const eyeClass = isHidden ? 'fa-eye-slash' : 'fa-eye';
                    const eyeColor = isHidden ? '#ef4444' : '#9ca3af';
                    return `<button type="button" class="btn-npc-peek" onclick="quickToggleVisibility(event, ${char.id}, ${isHidden})" title="Toggle Visibility" style="color:${eyeColor};"><i class="fa-solid ${eyeClass}"></i></button>`;
                })() : ''}
                <button type="button" class="btn-npc-peek" onclick="event.stopPropagation(); openFloatingDossierWidget(${char.id});" title="Open Floating Sheet"><i class="fa-solid fa-file-lines"></i></button>
            </div>
        `;
      container.appendChild(item);
    });
  }
}

function filterNpcCastList(query) {
  renderNpcCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
}

function toggleNpcPersona(npcId) {
  if (activeNpcPersonaId === npcId) {
    selectStorytellerDefaultPersona();
  } else {
    selectNpcPersona(npcId);
  }
}

function selectNpcPersona(npcId) {
  const npc = campaignCharactersList.find(c => c.id === npcId);
  if (!npc) return;
  activeNpcPersonaId = npcId;
  activeControlledCharacterId = null;
  renderNpcCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
  restoreWidget('widget-dossier');
  updateDossierWidget(npc);
  const select = document.getElementById('dicePersonaSelect');
  if (select) {
    select.value = String(npc.id);
  }
  const rollerEl = document.getElementById('diceRollerName');
  if (rollerEl) {
    rollerEl.value = npc.name;
  }
  const chatLabel = document.getElementById('chatSenderLabel');
  if (chatLabel) {
    chatLabel.innerText = `Speaking as: ${npc.name}`;
  }
  const personaSel = document.getElementById('gmPersonaSelect');
  if (personaSel) {
    personaSel.value = npc.name;
  }
  renderCoterieTokens(campaignCharactersList);
  if (socket && activeCampaignId) {
    socket.emit('presence:set_character', {
      campaignId: activeCampaignId,
      characterId: npcId,
      isSpectator: false
    });
  }
}

function selectStorytellerDefaultPersona() {
  activeNpcPersonaId = null;
  activeControlledCharacterId = null;
  renderNpcCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
  const select = document.getElementById('dicePersonaSelect');
  if (select) {
    select.value = 'storyteller_world';
  }
  const rollerEl = document.getElementById('diceRollerName');
  if (rollerEl) {
    rollerEl.value = 'Storyteller';
  }
  const chatLabel = document.getElementById('chatSenderLabel');
  if (chatLabel) {
    chatLabel.innerText = 'Speaking as: Storyteller';
  }
  const personaSel = document.getElementById('gmPersonaSelect');
  if (personaSel) {
    personaSel.value = 'Storyteller';
  }
  renderCoterieTokens(campaignCharactersList);
  if (socket && activeCampaignId) {
    socket.emit('presence:set_character', {
      campaignId: activeCampaignId,
      characterId: null,
      isSpectator: true
    });
  }
}

function populateDicePersonaSelector() {
  const select = document.getElementById('dicePersonaSelect');
  if (!select) return;
  select.innerHTML = '';
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
  if (isGM) {
    const optST = document.createElement('option');
    optST.value = 'storyteller_world';
    optST.innerText = 'Storyteller / World (Pure RNG)';
    select.appendChild(optST);
    const pcs = campaignCharactersList.filter(c => c.category === 'pc');
    if (pcs.length > 0) {
      const pcGroup = document.createElement('optgroup');
      pcGroup.label = 'Player Characters';
      pcs.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.innerText = `${c.name} [Player: ${c.player_name || 'Unassigned'}]`;
        pcGroup.appendChild(opt);
      });
      select.appendChild(pcGroup);
    }
    const npcs = campaignCharactersList.filter(c => c.category !== 'pc');
    if (npcs.length > 0) {
      const npcGroup = document.createElement('optgroup');
      npcGroup.label = 'NPC Cast & Personas';
      npcs.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        opt.innerText = `${c.name} (${c.clan || 'NPC'})`;
        npcGroup.appendChild(opt);
      });
      select.appendChild(npcGroup);
    }
    if (activeNpcPersonaId) {
      select.value = String(activeNpcPersonaId);
    } else if (activeControlledCharacterId) {
      select.value = String(activeControlledCharacterId);
    } else {
      select.value = 'storyteller_world';
    }
  } else {
    const myChars = campaignCharactersList.filter(c => {
      const authList = Array.isArray(c.authorized_user_ids) ? c.authorized_user_ids : [];
      return currentUser && (c.user_id === currentUser.id || authList.includes(currentUser.id));
    });
    if (myChars.length === 0) {
      const opt = document.createElement('option');
      opt.value = 'general_player';
      opt.innerText = currentUser ? currentUser.displayName || currentUser.username : 'Kindred';
      select.appendChild(opt);
    } else {
      myChars.forEach(c => {
        const opt = document.createElement('option');
        opt.value = String(c.id);
        const isPrimary = currentUser && c.user_id === currentUser.id;
        opt.innerText = `${c.name} ${isPrimary ? '(Owner)' : '(Authorized Pilot)'}`;
        select.appendChild(opt);
      });
      if (activeControlledCharacterId && myChars.some(c => c.id === activeControlledCharacterId)) {
        select.value = String(activeControlledCharacterId);
      } else if (myChars.length > 0) {
        select.value = String(myChars[0].id);
        activeControlledCharacterId = myChars[0].id;
      }
    }
  }
}

function handleDicePersonaChange(val) {
  if (val === 'storyteller_world' || val === 'general_player') {
    selectStorytellerDefaultPersona();
    return;
  }
  const charId = parseInt(val, 10);
  if (!isNaN(charId)) {
    const char = campaignCharactersList.find(c => c.id === charId);
    if (char && char.category !== 'pc' && (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller')) {
      selectNpcPersona(charId);
    } else {
      assumeActiveControl(charId);
    }
  }
  let newCharAvatarDataUrl = null;
}

async function loadCharacters() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/characters?campaign_id=${activeCampaignId}&_t=${Date.now()}`);
    if (!res.ok) return;
    const chars = await res.json();
    campaignCharactersList = chars;
    const activeChar = chars.find(c => c.id === (activeNpcPersonaId || activeControlledCharacterId)) || chars[0];
    if (activeChar) updateDossierWidget(activeChar);
    renderCoterieTokens(chars);
    if (socket && activeCampaignId) {
      socket.emit('presence:set_character', {
        campaignId: activeCampaignId,
        characterId: activeNpcPersonaId || activeControlledCharacterId || null,
        isSpectator: !activeNpcPersonaId && !activeControlledCharacterId
      });
    }
    populateDicePersonaSelector();
    renderNpcCastWidget();
    if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
    renderCharacterVaultCards();
  } catch (err) {
    console.error(err);
  }
}

function dragCharacterStart(ev, charId) {
  if (activeCampaignRole !== 'gm') return;
  ev.dataTransfer.setData("text/plain", charId);
  ev.currentTarget.style.opacity = '0.5';
}

function dragEnterSection(ev) {
  if (activeCampaignRole !== 'gm') return;
  ev.preventDefault();
  const section = ev.currentTarget;
  section.classList.add('drag-hover-target');
}

function dragLeaveSection(ev) {
  if (activeCampaignRole !== 'gm') return;
  const section = ev.currentTarget;
  if (!section.contains(ev.relatedTarget)) {
    section.classList.remove('drag-hover-target');
  }
}

function allowDropCharacter(ev) {
  if (activeCampaignRole !== 'gm') return;
  ev.preventDefault();
}

async function dropCharacter(ev, newCategory) {
  if (activeCampaignRole !== 'gm') return;
  ev.preventDefault();
  const charIdStr = ev.dataTransfer.getData("text/plain");
  const charId = parseInt(charIdStr);
  if (!charId) return;
  const cards = document.querySelectorAll('.character-card, .vault-card');
  cards.forEach(c => c.style.opacity = '1');
  const sections = document.querySelectorAll('.carousel-section');
  sections.forEach(s => s.classList.remove('drag-hover-target'));
  await updateCharacterCategory(charId, newCategory);
}

function renderCharacterVaultCards() {
  const container = document.getElementById('dynamicCharacterCarousels');
  if (!container) return;
  let html = '';
  const pcs = campaignCharactersList.filter(c => String(c.category).trim().toLowerCase() === 'pc');
  if (pcs.length > 0) {
    html += `
            <div class="carousel-section" ondragenter="dragEnterSection(event)" ondragleave="dragLeaveSection(event)" ondragover="allowDropCharacter(event)" ondrop="dropCharacter(event, 'pc')">
                <div class="c1-category-header">
        
        <div class="c1-cat-text">
            <div class="c1-cat-title">Player Characters</div>
            <div class="c1-cat-subtitle">Primary Protagonists <i class="fa-solid fa-droplet" style="color:#ef4444;margin-left:4px;"></i></div>
        </div>
    </div>
                <div class="carousel-track" id="carousel-pc">
                    ${pcs.map(c => generateCharacterCardHtml(c)).join('')}
                </div>
            </div>
        `;
  }
  let validCustomCategories = [];
  if (typeof npcCategoriesList !== 'undefined' && Array.isArray(npcCategoriesList)) {
    npcCategoriesList.forEach(cat => {
      if (!cat || !cat.name) return;
      validCustomCategories.push(cat.name);
      const npcs = campaignCharactersList.filter(c => c.category === cat.name);
      if (true) {
        html += `
                    <div class="carousel-section" ondragenter="dragEnterSection(event)" ondragleave="dragLeaveSection(event)" ondragover="allowDropCharacter(event)" ondrop="dropCharacter(event, '${escapeHtml(cat.name).replace(/'/g, "\'")}')">
                        <div class="c1-category-header">
        
        <div class="c1-cat-text">
            <div class="c1-cat-title">${escapeHtml(cat.name)}</div>
            <div class="c1-cat-subtitle">${escapeHtml(cat.description || 'Character Vault Roster')} <i class="fa-solid fa-droplet" style="color:#ef4444;margin-left:4px;"></i></div>
        </div>
    </div>
                        <div class="carousel-track" id="carousel-${escapeHtml(cat.name).replace(/\s+/g, '-')}">
                            ${npcs.length > 0 ? npcs.map(c => generateCharacterCardHtml(c)).join('') : '<div style="color:#4b5563; font-style:italic; font-size:12px; padding:20px; border:1px dashed #374151; border-radius:4px; width:100%; text-align:center;">Drag & Drop characters here</div>'}
                        </div>
                    </div>
                `;
      }
    });
  }
  const knownCats = ['pc', ...validCustomCategories].map(s => String(s).toLowerCase());
  const others = campaignCharactersList.filter(c => !knownCats.includes(String(c.category || '').toLowerCase()));
  if (others.length > 0) {
    html += `
            <div class="carousel-section" ondragenter="dragEnterSection(event)" ondragleave="dragLeaveSection(event)" ondragover="allowDropCharacter(event)" ondrop="dropCharacter(event, 'Uncategorized')">
                <div class="c1-category-header">
        
        <div class="c1-cat-text">
            <div class="c1-cat-title" style="color:#9ca3af;">Uncategorized</div>
            <div class="c1-cat-subtitle">Other NPCs <i class="fa-solid fa-droplet" style="color:#ef4444;margin-left:4px;"></i></div>
        </div>
    </div>
                <div class="carousel-track" id="carousel-other">
                    ${others.map(c => generateCharacterCardHtml(c)).join('')}
                </div>
            </div>
        `;
  }
  container.innerHTML = html;
}

function generateCharacterCardHtml(c) {
  if (!c) return '';
  const ownerUserId = c.user_id;
  const authList = Array.isArray(c.authorized_user_ids) ? c.authorized_user_ids : [];
  const isOwner = currentUser && c.user_id === currentUser.id;
  const isAuthorized = currentUser && authList.includes(currentUser.id);
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
  let clickAction = `onclick="openCharacterSheet(${c.id}, '${escapeHtml(c.name).replace(/'/g, "\'")}', '${escapeHtml(c.clan).replace(/'/g, "\'")}')"`;
  let avatarSrc = '/images/caine_portrait.jpg?v=2';
  let restrictedBadge = '';
  if (c.hidden_from_user_ids !== null && c.hidden_from_user_ids !== undefined && c.hidden_from_user_ids !== 'null') {
      restrictedBadge = '<i class="fa-solid fa-eye-slash" style="color:#ef4444; position:absolute; top:8px; right:8px; font-size:14px; text-shadow:0 0 4px #000;" title="Restricted Visibility"></i>';
  }
  if (c.vault_url && !c.vault_url.includes('bg_page_1.png')) {
    avatarSrc = c.vault_url;
  } else if (c.avatar_url && !c.avatar_url.includes('bg_page_1.png')) {
    avatarSrc = c.avatar_url;
  }
  const playerLabel = c.player_name ? escapeHtml(c.player_name.split(' ')[0]) : 'NPC';
  let genDisplay = 'Unknown';
  if (c.sheet_data) {
    try {
      const sheet = typeof c.sheet_data === 'string' ? JSON.parse(c.sheet_data) : c.sheet_data;
      if (sheet.generation) {
        genDisplay = sheet.generation.toString().replace(/generation/i, 'Gen').trim();
        if (!isNaN(genDisplay)) {
          if (genDisplay === '1') genDisplay += 'st Gen'; else if (genDisplay === '2') genDisplay += 'nd Gen'; else if (genDisplay === '3') genDisplay += 'rd Gen'; else genDisplay += 'th Gen';
        }
      } else if (c.concept) {
        genDisplay = c.concept.length > 15 ? c.concept.substring(0, 15) + '...' : c.concept;
      }
    } catch (e) {}
  } else if (c.concept) {
    genDisplay = c.concept.length > 15 ? c.concept.substring(0, 15) + '...' : c.concept;
  }
  if (genDisplay === 'Unknown' && c.category === 'npc') genDisplay = 'NPC';
  return `
        <div class="vault-card" ${clickAction} draggable="${isGM ? 'true' : 'false'}" ondragstart="dragCharacterStart(event, ${c.id})">
            <!-- Glass Background (Clipped) -->
            <div class="vault-glass"></div>
            
            ${(() => {
    if (isGM) {
      const isHidden = c.hidden_from_user_ids !== null && c.hidden_from_user_ids !== undefined && c.hidden_from_user_ids !== 'null';
      const eyeClass = isHidden ? 'fa-eye-slash' : 'fa-eye';
      const eyeColor = isHidden ? '#ef4444' : '#9ca3af';
      return `<div class="vault-delete-btn" onclick="promptDeleteCharacter(event, ${c.id}, '${escapeHtml(c.name).replace(/'/g, "\\'")}')" title="Delete Character"><i class="fa-solid fa-trash-can"></i></div>
              <div class="vault-hide-btn ${isHidden ? 'hidden-state' : 'revealed-state'}" onclick="quickToggleVisibility(event, ${c.id}, ${isHidden})" title="Toggle Visibility"><i class="fa-solid ${eyeClass}"></i></div>`;
    } else if (isOwner) {
      return `<div class="vault-delete-btn" onclick="promptDeleteCharacter(event, ${c.id}, '${escapeHtml(c.name).replace(/'/g, "\\'")}')" title="Delete Character"><i class="fa-solid fa-trash-can"></i></div>`;
    }
    return '';
  })()}
            
            <!-- Avatar (Clipped) -->
            <div class="vault-avatar">
                <img src="${avatarSrc}" alt="${escapeHtml(c.name)}">
            </div>

            <!-- Painted Silver Details (Wrapper Clipped to remove AI red margins) -->
            <div class="vault-frame-wrapper">
                <img class="vault-frame-img" src="/images/concept_frame_cropped.jpg?v=5" />
            </div>

            <!-- Master Mathematical Outline (Hidden since we use full mask now) -->
            <svg class="vault-master-svg" viewBox="0 0 260 396" style="display:none;">
                <path class="vault-outer-line" d="M 12 1 L 248 1 A 11 11 0 0 1 259 12 L 259 360 A 11 11 0 0 1 248 371 L 160 371 C 150 371, 145 395, 130 395 C 115 395, 110 371, 100 371 L 12 371 A 11 11 0 0 1 1 360 L 1 12 A 11 11 0 0 1 12 1 Z" />
            </svg>

            
            ${(() => {
    const clan = c.clan || 'Unknown';
    const symObj = globalClanSymbols.find(s => s.clan_name.toLowerCase() === clan.toLowerCase());
    if (symObj) {
      return `<div class="vault-clan-symbol"><img src="${escapeHtml(symObj.symbol_url)}"></div>`;
    }
    return '';
  })()}
            <div class="vault-content">
                <div class="vault-name">${escapeHtml(c.short_name || c.name.split(' ')[0])}</div>
                <div class="vault-clan">${escapeHtml(c.clan || 'Unknown')}</div>
                <div class="vault-stats">
                    <div class="vault-stat">
                        <span class="v-label">Player</span>
                        <span class="v-value">${playerLabel}</span>
                    </div>
                    
                </div>
            </div>
        </div>
    `;
}

function openNewCharacterModal() {
  if (document.getElementById('newCharName')) document.getElementById('newCharName').value = '';
  if (document.getElementById('newCharConcept')) document.getElementById('newCharConcept').value = '';
  if (document.getElementById('newCharAvatar')) document.getElementById('newCharAvatar').value = '';
  if (document.getElementById('newCharNpcMask')) document.getElementById('newCharNpcMask').value = '';
  if (document.getElementById('newCharNpcWant')) document.getElementById('newCharNpcWant').value = '';
  if (document.getElementById('newCharNpcLine')) document.getElementById('newCharNpcLine').value = '';
  if (document.getElementById('newCharNpcMannerisms')) document.getElementById('newCharNpcMannerisms').value = '';
  if (document.getElementById('newCharNpcBiases')) document.getElementById('newCharNpcBiases').value = '';
  if (document.getElementById('newCharNpcSecret')) document.getElementById('newCharNpcSecret').value = '';
  if (document.getElementById('newCharNpcMemories')) document.getElementById('newCharNpcMemories').value = '';
  const m = document.getElementById('newCharacterModal');
  if (m) m.classList.add('active');
}

function handleNewCharAvatarFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    newCharAvatarDataUrl = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function createCharacterSubmit() {
  const name = document.getElementById('newCharName').value.trim();
  const clan = document.getElementById('newCharClan').value;
  const concept = document.getElementById('newCharConcept').value.trim();
  const avatarInput = document.getElementById('newCharAvatar').value.trim();
  const category = document.getElementById('newCharCategory').value;
  if (!name) return alert('Character name is required.');
  try {
    let finalAvatar = avatarInput;
    if (newCharAvatarDataUrl) {
      const upRes = await authFetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: newCharAvatarDataUrl,
          filename: `${name}_avatar.png`
        })
      });
      const upData = await upRes.json();
      if (upData.url) finalAvatar = upData.url;
    }
    const res = await authFetch('/api/characters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicle_id: activeCampaignId,
        name,
        clan,
        concept,
        avatar_url: finalAvatar || '/images/caine_portrait.jpg?v=2',
        category: category || 'pc'
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      newCharAvatarDataUrl = null;
      closeModal('newCharacterModal');
      loadCharacters();
      openCharacterSheet(data.id, name, clan, currentUser.id, currentUser.displayName);
    } else {
      alert(data.error || 'Failed to create character sheet.');
    }
  } catch (err) {
    alert('Network error creating character.');
  }
}

function openCharacterSheet(id, name, clan, ownerUserId, ownerPlayerName) {
  currentLoadedCharacterId = id;
  const char = campaignCharactersList.find(c => c.id === id);
  const nameEl = document.getElementById('modalCharName');
  if (nameEl) nameEl.innerText = name || (char ? char.name : 'Character Dossier');
  const clanEl = document.getElementById('modalCharClan');
  if (clanEl) clanEl.innerText = clan || (char ? char.clan : 'Vampire: The Masquerade V5');
  const avatarThumb = document.getElementById('modalCharAvatarImg');
  const avatarSrc = char && char.avatar_url && !char.avatar_url.includes('bg_page_1.png') ? char.avatar_url : '/images/caine_portrait.jpg?v=2';
  if (avatarThumb) avatarThumb.src = avatarSrc;
  
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
  const isOwner = currentUser && currentUser.id === (ownerUserId || (char ? char.user_id : null));
  const authList = char && Array.isArray(char.authorized_user_ids) ? char.authorized_user_ids : [];
  
  const isAuthorizedPilot = currentUser && authList.includes(currentUser.id);
  const canPilot = isGM || isOwner || isAuthorizedPilot;
  const canEdit = isGM || isOwner || isAuthorizedPilot;

  // Populate the 7-Point NPC profile fields for the GM
  if (char) {
      const field_want = document.getElementById('sheet_npc_npc_current_want');
      if (field_want) field_want.value = char.npc_current_want || '';
      const field_mask = document.getElementById('sheet_npc_npc_mask_truth');
      if (field_mask) field_mask.value = char.npc_mask_truth || '';
      const field_line = document.getElementById('sheet_npc_npc_taboos');
      if (field_line) field_line.value = char.npc_taboos || '';
      const field_manner = document.getElementById('sheet_npc_npc_mannerisms');
      if (field_manner) field_manner.value = char.npc_mannerisms || '';
      const field_biases = document.getElementById('sheet_npc_npc_biases');
      if (field_biases) field_biases.value = char.npc_biases || '';
      const field_secret = document.getElementById('sheet_npc_npc_hidden_secret');
      if (field_secret) field_secret.value = char.npc_hidden_secret || '';
      const field_memories = document.getElementById('sheet_npc_npc_active_memories');
      if (field_memories) field_memories.value = char.npc_active_memories || '';
      const field_timeline = document.getElementById('sheet_npc_npc_faction_timeline');
      if (field_timeline) field_timeline.value = char.npc_faction_timeline || '';
  }

  const gmSidebar = document.getElementById('gmNpcProfileSidebar');
  if (gmSidebar) {
      gmSidebar.style.display = isGM ? 'flex' : 'none';
  }


    const dossierVisBtn = document.getElementById('dossierQuickVisibilityBtn');
  if (dossierVisBtn) {
      if (isGM) {
          dossierVisBtn.style.display = 'inline-block';
          const isHidden = char && char.hidden_from_user_ids !== null && char.hidden_from_user_ids !== undefined && char.hidden_from_user_ids !== 'null';
          dossierVisBtn.innerHTML = '<i class="fa-solid ' + (isHidden ? 'fa-eye-slash' : 'fa-eye') + '" style="color:' + (isHidden ? '#ef4444' : '#9ca3af') + ';"></i>';
      } else {
          dossierVisBtn.style.display = 'none';
      }
  }
  const shortNameInput = document.getElementById('modalCharShortName');
  if (shortNameInput) {
    shortNameInput.value = char && char.short_name ? char.short_name : '';
    if (canEdit) {
      shortNameInput.disabled = false;
      shortNameInput.style.opacity = '1';
    } else {
      shortNameInput.disabled = true;
      shortNameInput.style.opacity = '0.5';
    }
  }
  
  const catContainer = document.getElementById('modalCharCategoryContainer');
  if (catContainer) {
    if (isGM && char) {
      catContainer.style.display = 'block';
      let catOptions = `<option value="pc" ${char.category === 'pc' ? 'selected' : ''}>Player Character (PC)</option><option value="Uncategorized" ${char.category === 'Uncategorized' ? 'selected' : ''}>Uncategorized</option>`;
      if (typeof npcCategoriesList !== 'undefined' && Array.isArray(npcCategoriesList)) {
        npcCategoriesList.forEach(cat => {
          const selected = char.category === cat.name ? 'selected' : '';
          catOptions += `<option value="${escapeHtml(cat.name)}" ${selected}>${escapeHtml(cat.name)}</option>`;
        });
      }
      catContainer.innerHTML = `<select onchange="updateCharacterCategory(${char.id}, this.value)" style="background:transparent; color:#9ca3af; border:1px solid #4b5563; border-radius:3px; padding:2px 4px; font-size:11px; outline:none; margin-top:4px;">
                ${catOptions}
            </select>`;
    } else {
      catContainer.style.display = 'none';
      catContainer.innerHTML = '';
    }
  }

  const statusWrap = document.getElementById('modalOwnershipStatus');
  if (statusWrap) {
      if (isOwner) {
        statusWrap.innerHTML = `<span class="badge-edit-unlocked"><i class="fa-solid fa-lock-open"></i> Full Edit Access (Owner)</span>`;
      } else if (isAuthorizedPilot) {
        statusWrap.innerHTML = `<span class="badge-edit-unlocked" style="background:rgba(59,130,246,0.2);color:#60a5fa;border:1px solid rgba(59,130,246,0.4);"><i class="fa-solid fa-user-shield"></i> Authorized Pilot (Safety Net)</span>`;
      } else if (isGM) {
        statusWrap.innerHTML = `<span class="badge-edit-unlocked"><i class="fa-solid fa-crown"></i> Full Edit Access (Storyteller)</span>`;
      } else {
        statusWrap.innerHTML = `<span class="badge-edit-locked"><i class="fa-solid fa-lock"></i> Viewing Dossier (Owned by ${ownerPlayerName || (char ? char.player_name : 'Another Player')})</span>`;
      }
  }


  const privacyBtn = document.getElementById('btnPrivacyModeToggle');
  if (privacyBtn) {
    if (canEdit) {
      privacyBtn.style.display = 'inline-flex';
      privacyBtn.classList.remove('active-pilot');
    } else {
      privacyBtn.style.display = 'none';
    }
  }

  const modalAssume = document.getElementById('btnModalAssumeControl');


  if (modalAssume) {
    if (canPilot) {
      modalAssume.style.display = 'inline-flex';
      if (activeControlledCharacterId === id) {
        modalAssume.innerText = 'Active Persona (Currently Piloting)';
        modalAssume.classList.add('active-pilot');
      } else {
        modalAssume.innerHTML = '<i class="fa-solid fa-gamepad"></i> Assume Active Control';
        modalAssume.classList.remove('active-pilot');
      }
    } else {
      modalAssume.style.display = 'none';
    }
  }

  const gmReassignBox = document.getElementById('gmReassignControl');
  if (gmReassignBox) {
    if (isGM) {
      gmReassignBox.style.display = 'flex';
      populateControllerManagementPanel(char || ({
        id,
        user_id: ownerUserId,
        authorized_user_ids: []
      }));
    } else {
      gmReassignBox.style.display = 'none';
    }
  }

  const iframe = document.getElementById('sheetFrame');
  if (iframe) {
    let sheetTemplate = 'V5-Character-Sheet.html';
    if (char && char.sheet_data) {
      let parsed = char.sheet_data;
      if (typeof parsed === 'string') {
        try {
          parsed = JSON.parse(parsed);
        } catch (e) {}
      }
      if (parsed.sheet_template && typeof parsed.sheet_template === "string" && parsed.sheet_template.endsWith(".html")) sheetTemplate = parsed.sheet_template;
    }
    iframe.src = `/sheets/${sheetTemplate}?char_id=${id}&readonly=${!canEdit}&_t=${Date.now()}`;
  }
  
  const modal = document.getElementById('characterSheetModal');
  if (modal) modal.classList.add('active');
}

function assumeActiveControlFromModal() {
  if (currentLoadedCharacterId) {
    assumeActiveControl(currentLoadedCharacterId);
  }
}

function populateControllerManagementPanel(char) {
  const select = document.getElementById('charOwnerSelect');
  if (select) {
    select.innerHTML = '<option value="">NPC / Storyteller Owned</option>';
    const activeMembers = campaignMembersList.filter(m => m.status === 'active');
    activeMembers.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.innerText = `${m.display_name} (@${m.username})`;
      if (m.id === char.user_id) opt.selected = true;
      select.appendChild(opt);
    });
  }
  const checkContainer = document.getElementById('charSafetyNetCheckboxes');
  if (checkContainer) {
    checkContainer.innerHTML = '';
    const activeMembers = campaignMembersList.filter(m => m.status === 'active');
    const authList = Array.isArray(char.authorized_user_ids) ? char.authorized_user_ids : [];
    if (activeMembers.length === 0) {
      checkContainer.innerHTML = '<span style="font-size:11px;color:#94a3b8;font-style:italic;">No other players at this table</span>';
    } else {
      activeMembers.forEach(m => {
        const label = document.createElement('label');
        label.className = 'safety-net-label';
        const isChecked = authList.includes(m.id);
        label.innerHTML = `
                    <input type="checkbox" class="safety-net-chk" value="${m.id}" ${isChecked ? 'checked' : ''}>
                    <span>${escapeHtml(m.display_name)}</span>
                `;
        checkContainer.appendChild(label);
      });
    }
  }
}

let allChroniclesData = [];
let activeSubCampaignId = null;


async function saveCharacterControllersSubmit() {
  if (!currentLoadedCharacterId) return;
  const primaryUserId = document.getElementById('charOwnerSelect').value;
  const checkedBoxes = document.querySelectorAll('.safety-net-chk:checked');
  const authIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value)).filter(id => !isNaN(id));
  try {
    const res = await authFetch(`/api/characters/${currentLoadedCharacterId}/manage-controllers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        primary_user_id: primaryUserId ? parseInt(primaryUserId) : null,
        authorized_user_ids: authIds
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loadCharacters();
      alert('Character assignments & safety net controllers updated successfully!');
    } else {
      alert(data.error || 'Failed to update controllers.');
    }
  } catch (err) {
    alert('Network error updating controllers.');
  }
}

function triggerDossierAvatarUpload(charId = currentLoadedCharacterId) {
  openAssetPicker(url => {
    performDualCropForCharacter(url, charId);
  });
}

function handleDossierAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file || !currentLoadedCharacterId) return;
  uploadAvatarForCharacter(currentLoadedCharacterId, file);
}

function triggerModalAvatarUpload() {
  openAssetPicker(url => {
    performDualCropForCharacter(url, currentLoadedCharacterId);
  });
}

function handleModalAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file || !currentLoadedCharacterId) return;
  uploadAvatarForCharacter(currentLoadedCharacterId, file);
}

async function uploadAvatarForCharacter(characterId, file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const base64Data = e.target.result;
    try {
      const res = await authFetch(`/api/characters/${characterId}/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          data: base64Data,
          filename: file.name
        })
      });
      const data = await res.json();
      if (res.ok && data.avatar_url) {
        const char = campaignCharactersList.find(c => c.id === characterId);
        if (char) char.avatar_url = data.avatar_url;
        const dossierImg = document.getElementById('dossierAvatarImg');
        if (dossierImg && currentLoadedCharacterId === characterId) {
          dossierImg.src = data.avatar_url;
        }
        const modalImg = document.getElementById('modalCharAvatarImg');
        if (modalImg) modalImg.src = data.avatar_url;
        loadCharacters();
        alert('Portrait updated successfully!');
      } else {
        alert(data.error || 'Failed to upload portrait image.');
      }
    } catch (err) {
      alert('Network error uploading portrait.');
    }
  };
  reader.readAsDataURL(file);
}

function closeSheetModal() {
  document.getElementById('characterSheetModal').classList.remove('active');
}

async function updatePendingBadgeCount() {
  if (activeCampaignRole !== 'gm' || !activeCampaignId) return;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/members`);
    if (res.ok) {
      const members = await res.json();
      const pendingCount = members.filter(m => m.status === 'pending').length;
      const badge = document.getElementById('pendingRequestsBadge');
      if (badge) {
        if (pendingCount > 0) {
          badge.innerText = pendingCount;
          badge.style.display = 'inline-block';
        } else {
          badge.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error('Failed to update pending badge:', err);
  }
}

async function loadCoterieManagement() {
  if (activeCampaignRole !== 'gm' || !activeCampaignId) return;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/members`);
    campaignMembersList = await res.json();
    updatePendingBadgeCount();
    const activeMembers = campaignMembersList.filter(m => m.status === 'active');
    const tableBody = document.getElementById('modalActiveMembersList');
    if (tableBody) {
      tableBody.innerHTML = '';
      if (activeMembers.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;font-style:italic;">No active players at this table yet. Invite registered users below!</td></tr>';
      } else {
        activeMembers.forEach(m => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
                        <td><strong>${m.username}</strong></td>
                        <td>${m.display_name}</td>
                        <td>${new Date(m.joined_at).toLocaleDateString()}</td>
                        <td><span class="delivery-badge">${m.character_count || 0} Sheet(s)</span></td>
                        <td>
                            <button class="btn-text-danger" onclick="removeCoterieMember(${m.id})" title="Remove player from chronicle">
                                <i class="fa-solid fa-user-xmark"></i> Remove
                            </button>
                        </td>
                    `;
          tableBody.appendChild(tr);
        });
      }
    }
    const availRes = await authFetch(`/api/chronicles/${activeCampaignId}/available-players`);
    const availablePlayers = await availRes.json();
    const inviteSelect = document.getElementById('modalAvailablePlayersSelect');
    if (inviteSelect) {
      inviteSelect.innerHTML = '';
      if (availablePlayers.length === 0) {
        inviteSelect.innerHTML = '<option value="">No other registered players in database</option>';
      } else {
        inviteSelect.innerHTML = '<option value="">Select a registered player to invite...</option>';
        availablePlayers.forEach(p => {
          const opt = document.createElement('option');
          opt.value = p.id;
          opt.innerText = `${p.display_name} (@${p.username})`;
          inviteSelect.appendChild(opt);
        });
      }
    }
  } catch (err) {
    console.error('Failed to load coterie management:', err);
  }
}

async function invitePlayerSubmit() {
  const select = document.getElementById('modalAvailablePlayersSelect');
  const userId = select.value;
  if (!userId) return alert('Please select a registered player to invite.');
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: parseInt(userId)
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loadCoterieManagement();
      loadCharacters();
      loadGameboardState();
      alert('Player invited to chronicle table successfully!');
    } else {
      alert(data.error || 'Failed to invite player.');
    }
  } catch (err) {
    alert('Error sending invite.');
  }
}

async function removeCoterieMember(userId) {
  if (!confirm('Remove this player from the chronicle table?')) return;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/members/${userId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      loadCoterieManagement();
      loadCharacters();
      loadGameboardState();
    }
  } catch (err) {
    console.error(err);
  }
}

async function openCoterieManagerModal() {
  if (!activeCampaignId) {
    alert('Please select or create an active chronicle first.');
    return;
  }
  document.getElementById('coterieManagerModal').classList.add('active');
  loadCoterieModalData();
}

async function loadCoterieModalData() {
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/members`);
    const allMembers = await res.json();
    campaignMembersList = allMembers;
    const pendingRequests = allMembers.filter(m => m.status === 'pending');
    const activeMembers = allMembers.filter(m => m.status === 'active');
    const badge = document.getElementById('pendingRequestsBadge');
    if (badge) {
      if (pendingRequests.length > 0) {
        badge.innerText = pendingRequests.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    const pendingContainer = document.getElementById('coteriePendingList');
    if (pendingRequests.length === 0) {
      pendingContainer.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No pending join requests right now.</div>';
    } else {
      pendingContainer.innerHTML = '<div class="pending-requests-container"></div>';
      const innerWrap = pendingContainer.querySelector('.pending-requests-container');
      pendingRequests.forEach(p => {
        const item = document.createElement('div');
        item.className = 'pending-request-card';
        item.innerHTML = `
                    <div class="pending-user-info">
                        <span class="pending-user-name">${p.display_name} (@${p.username})</span>
                        <span class="pending-user-sub">Requested ${new Date(p.joined_at).toLocaleDateString()}</span>
                    </div>
                    <div class="pending-actions">
                        <button class="btn-action btn-sm" onclick="approveCoterieRequest(${p.id})"><i class="fa-solid fa-check"></i> Approve</button>
                        <button class="btn-danger btn-sm" onclick="denyCoterieRequest(${p.id})"><i class="fa-solid fa-xmark"></i> Deny</button>
                    </div>
                `;
        innerWrap.appendChild(item);
      });
    }
    const activeTableBody = document.getElementById('modalActiveMembersList');
    activeTableBody.innerHTML = '';
    if (activeMembers.length === 0) {
      activeTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;font-style:italic;">No active players at this table yet.</td></tr>';
    } else {
      activeMembers.forEach(m => {
        const tr = document.createElement('tr');
        let roleHtml = `<td>${m.role === 'storyteller' ? 'Storyteller' : 'Player'}</td>`;
        if (currentCampaignData && currentCampaignData.gm_id === currentUser.id && m.id !== currentUser.id) {
          roleHtml = `
                        <td>
                            <select class="form-control" style="font-size:12px; padding:2px 5px; width:auto; border-radius:4px;" onchange="changeMemberRole(${m.id}, this.value)">
                                <option value="player" ${m.role === 'player' ? 'selected' : ''}>Player</option>
                                <option value="storyteller" ${m.role === 'storyteller' ? 'selected' : ''}>Storyteller</option>
                            </select>
                        </td>
                    `;
        }
        tr.innerHTML = `
                    <td><strong>${m.username}</strong></td>
                    <td>${m.display_name}</td>
                    <td>${new Date(m.joined_at).toLocaleDateString()}</td>
                    <td><span class="delivery-badge">${m.character_count || 0} Sheet(s)</span></td>
                    ${roleHtml}
                    <td>
                        <button class="btn-text-danger" onclick="removeCoterieMemberFromModal(${m.id})" title="Remove player from chronicle">
                            <i class="fa-solid fa-user-xmark"></i> Remove
                        </button>
                    </td>
                `;
        activeTableBody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Failed to load coterie modal data:', err);
  }
}

async function approveCoterieRequest(userId) {
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/approve-join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loadCoterieModalData();
      loadCoterieManagement();
      loadGameboardState();
    } else {
      alert(data.error || 'Failed to approve player.');
    }
  } catch (err) {
    alert('Error approving request.');
  }
}

async function denyCoterieRequest(userId) {
  if (!confirm('Are you sure you want to deny this join request?')) return;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/deny-join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loadCoterieModalData();
      loadCoterieManagement();
    } else {
      alert(data.error || 'Failed to deny request.');
    }
  } catch (err) {
    alert('Error denying request.');
  }
}

async function invitePlayerFromModal() {
  const select = document.getElementById('modalAvailablePlayersSelect');
  const userId = select.value;
  if (!userId) return alert('Please select a registered player to invite.');
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: parseInt(userId)
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loadCoterieModalData();
      loadCoterieManagement();
      loadGameboardState();
      alert('Player invited to chronicle table successfully!');
    } else {
      alert(data.error || 'Failed to invite player.');
    }
  } catch (err) {
    alert('Error inviting player.');
  }
}

async function removeCoterieMemberFromModal(userId) {
  if (!confirm('Are you sure you want to remove this player from the chronicle?')) return;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/members/${userId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loadCoterieModalData();
      loadCoterieManagement();
      loadGameboardState();
    } else {
      alert(data.error || 'Failed to remove player.');
    }
  } catch (err) {
    alert('Error removing player.');
  }
}

function openChronicleLobby() {
  returnToChronicleHub();
}

async function renderChronicleLobby() {
  renderActivePlayersBar();
  const container = document.getElementById('chronicleLobbyGrid');
  if (!container) return;
  container.innerHTML = '<div style="color:#9ca3af;font-style:italic;">Loading active chronicles...</div>';
  try {
    const res = await authFetch('/api/chronicles/directory');
    if (!res.ok) {
      container.innerHTML = '<div style="color:#ef4444;">Failed to load chronicle directory.</div>';
      return;
    }
    const chronicles = await res.json();
    container.innerHTML = '';
    const ownedChronicles = chronicles.filter(c => c.is_owner);
    const joinedChronicles = chronicles.filter(c => !c.is_owner && c.member_status === 'active');
    const discoverChronicles = chronicles.filter(c => !c.is_owner && c.member_status !== 'active');
    const s1 = document.createElement('div');
    s1.className = 'hub-section';
    s1.innerHTML = `<div class="hub-section-title" style="border-bottom:none; margin-bottom:0;"><i class="fa-solid fa-crown"></i> Chronicles You Lead (Storyteller)</div>` + '<div class="celtic-divider"><div class="celtic-line-left"></div><img src="/images/celtic_diamond_center.png" class="celtic-knot-center"><div class="celtic-line-right"></div></div>';
    const g1 = document.createElement('div');
    g1.className = 'hub-cards-grid';
    if (ownedChronicles.length === 0) {
      g1.innerHTML = '<div class="hub-empty-state">You do not lead any chronicles yet. Click "+ Forge New Chronicle" above to architect your world.</div>';
    } else {
      ownedChronicles.forEach(c => g1.appendChild(createChronicleCard(c, 'lead')));
    }
    s1.appendChild(g1);
    container.appendChild(s1);
    const s2 = document.createElement('div');
    s2.className = 'hub-section';
    s2.innerHTML = `<div class="hub-section-title" style="border-bottom:none; margin-bottom:0;"><i class="fa-solid fa-droplet"></i> Chronicles You've Joined (Coterie Member)</div>` + '<div class="celtic-divider"><div class="celtic-line-left"></div><img src="/images/celtic_diamond_center.png" class="celtic-knot-center"><div class="celtic-line-right"></div></div>';
    const g2 = document.createElement('div');
    g2.className = 'hub-cards-grid';
    if (joinedChronicles.length === 0) {
      g2.innerHTML = '<div class="hub-empty-state">You have not joined any chronicles as a player yet. Browse active chronicles below to request an invitation.</div>';
    } else {
      joinedChronicles.forEach(c => g2.appendChild(createChronicleCard(c, 'joined')));
    }
    s2.appendChild(g2);
    container.appendChild(s2);
    const s3 = document.createElement('div');
    s3.className = 'hub-section';
    s3.innerHTML = `<div class="hub-section-title" style="border-bottom:none; margin-bottom:0;"><i class="fa-solid fa-globe"></i> Discover Active Chronicles</div>` + '<div class="celtic-divider"><div class="celtic-line-left"></div><img src="/images/celtic_diamond_center.png" class="celtic-knot-center"><div class="celtic-line-right"></div></div>';
    const g3 = document.createElement('div');
    g3.className = 'hub-cards-grid';
    if (discoverChronicles.length === 0) {
      g3.innerHTML = '<div class="hub-empty-state">No other active chronicles are available to join right now.</div>';
    } else {
      discoverChronicles.forEach(c => g3.appendChild(createChronicleCard(c, 'discover')));
    }
    s3.appendChild(g3);
    container.appendChild(s3);
  } catch (err) {
    console.error('Error loading lobby:', err);
    container.innerHTML = '<div style="color:#ef4444;">Error loading chronicles.</div>';
  }
}

function createChronicleCard(c, actionType) {
  const card = document.createElement('div');
  card.className = 'chronicle-lobby-card';
  let statusBadge = '';
  let actionBtn = '';
  if (actionType === 'lead') {
    statusBadge = '<span class="badge-status-active"><i class="fa-solid fa-crown"></i> Storyteller Lead</span>';
    actionBtn = `<button class="btn-action" onclick="enterChronicle(${c.id}, 'gm')"><i class="fa-solid fa-masks-theater"></i> Enter Storyteller Sanctum</button>`;
  } else if (actionType === 'joined') {
    if (c.member_role === 'storyteller') {
      statusBadge = '<span class="badge-status-active"><i class="fa-solid fa-crown"></i> Storyteller</span>';
      actionBtn = `<button class="btn-action" onclick="enterChronicle(${c.id}, 'storyteller')"><i class="fa-solid fa-masks-theater"></i> Enter Storyteller Sanctum</button>`;
    } else {
      statusBadge = '<span class="badge-status-active"><i class="fa-solid fa-check-circle"></i> Coterie Member</span>';
      actionBtn = `<button class="btn-action" onclick="enterChronicle(${c.id}, 'player')"><i class="fa-solid fa-dice-d20"></i> Enter Gameboard</button>`;
    }
  } else {
    if (c.member_status === 'pending') {
      statusBadge = '<span class="badge-status-pending"><i class="fa-solid fa-hourglass-half"></i> Request Pending</span>';
      actionBtn = `<button class="btn-action-outline" disabled style="opacity:0.65;cursor:not-allowed;"><i class="fa-solid fa-clock"></i> Awaiting Storyteller</button>`;
    } else {
      statusBadge = '<span class="badge-status-unjoined"><i class="fa-solid fa-lock"></i> Unjoined</span>';
      actionBtn = `<button class="btn-action" onclick="requestJoinCampaign(${c.id})"><i class="fa-solid fa-hand"></i> Request to Join</button>`;
    }
  }
  const pCount = c.player_count !== undefined ? c.player_count : 0;
  card.innerHTML = `
                <div class="chronicle-card-top">
                    <div class="chronicle-card-header">
                        <div class="chronicle-card-title">${c.title}</div>
                        ${statusBadge}
                    </div>
                    <div class="chronicle-card-gm"><i class="fa-solid fa-mask"></i> Storyteller: <strong>${c.gm_name || 'Storyteller'}</strong></div>
                    <div class="chronicle-card-meta">
                        <span><i class="fa-solid fa-city"></i> ${c.setting_city || 'Radcliff'}</span>
                        <span><i class="fa-solid fa-calendar"></i> ${c.setting_year || 'Modern Nights'}</span>
                        <span><i class="fa-solid fa-users"></i> ${pCount} Player(s)</span>
                    </div>
                    ${c.core_pitch ? `<div class="chronicle-card-pitch">"${c.core_pitch}"</div>` : ''}
                    <div class="chronicle-card-desc">${c.description || 'No public chronicle overview provided.'}</div>
                </div>
                <div class="chronicle-card-actions">
                    ${actionBtn}
                </div>
            `;
  return card;
}

async function requestJoinCampaign(campaignId) {
  try {
    const res = await authFetch(`/api/chronicles/${campaignId}/request-join`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert('Your request to join this chronicle has been submitted to the Storyteller!');
      renderChronicleLobby();
    } else {
      alert(data.error || 'Failed to submit join request.');
    }
  } catch (err) {
    alert('Network error submitting join request.');
  }
}

async function updateMaxCharactersLimit(val) {
  const limit = parseInt(val) || 2;
  try {
    await authFetch(`/api/chronicles/${activeCampaignId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        max_characters_per_player: limit
      })
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadCampaignsList() {
  try {
    const res = await authFetch('/api/chronicles');
    const chronicles = await res.json();
    allChroniclesData = chronicles;
    const chronSelect = document.getElementById('chronicleSelect');
    if (!chronSelect) return;
    chronSelect.innerHTML = '';
    chronicles.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.innerText = `${c.title} (${c.setting_city}, ${c.setting_year})`;
      if (c.id === activeCampaignId) opt.selected = true;
      chronSelect.appendChild(opt);
    });
    if (chronicles.length > 0) {
      const targetChron = chronicles.find(c => c.id === activeCampaignId) || chronicles[0];
      activeCampaignId = targetChron.id;
      displayCampaignOverview(targetChron);
      const campSelect = document.getElementById('campaignSelect');
      campSelect.innerHTML = '';
      if (targetChron.campaigns && targetChron.campaigns.length > 0) {
        targetChron.campaigns.forEach(camp => {
          const opt = document.createElement('option');
          opt.value = camp.id;
          opt.innerText = camp.title;
          if (camp.id === activeSubCampaignId) opt.selected = true;
          campSelect.appendChild(opt);
        });
        const targetCamp = targetChron.campaigns.find(camp => camp.id === activeSubCampaignId) || targetChron.campaigns[0];
        activeSubCampaignId = targetCamp.id;
        renderEpisodesList(targetCamp.episodes || []);
        if (targetCamp.episodes && targetCamp.episodes.length > 0) {
          loadEpisodeDetails(targetCamp.episodes[0].id);
        } else {
          document.getElementById('episodeCardsList').innerHTML = '<p>No episodes in this campaign.</p>';
        }
      } else {
        campSelect.innerHTML = '<option value="">No Campaigns</option>';
        document.getElementById('episodeCardsList').innerHTML = '<p>No campaigns found.</p>';
      }
      loadCoterieManagement();
    }
  } catch (err) {
    console.error('Failed to load chronicles:', err);
  }
}

function switchChronicle(id) {
  activeCampaignId = parseInt(id);
  activeSubCampaignId = null;
  socket.emit('room:join', activeCampaignId);
  loadCampaignsList();
  loadCharacters();
  loadGameboardState();
  loadRecentRolls();
}

function switchCampaign(id) {
  activeSubCampaignId = parseInt(id);
  const chron = allChroniclesData.find(c => c.id === activeCampaignId);
  if (chron && chron.campaigns) {
    const camp = chron.campaigns.find(c => c.id === activeSubCampaignId);
    if (camp) {
      renderEpisodesList(camp.episodes || []);
      if (camp.episodes && camp.episodes.length > 0) {
        loadEpisodeDetails(camp.episodes[0].id);
      }
    }
  }
  const createLoreEntrySubmit = createLoreSubmit;
  let allRules = [];
  let activeRuleCategory = 'All';
  let canvasState = {
    backdrop: '/images/concept_map.jpg',
    entities: [],
    links: []
  };
  let canvasTransform = {
    panX: 0,
    panY: 0,
    zoom: 1.0,
    isPanning: false,
    startX: 0,
    startY: 0
  };
  let activeDragEntity = null;
  let activeResizeEntity = null;
  let linkingSourceEntityId = null;
  let saveCanvasTimeout = null;
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
}

function openNewCampaignModal() {
  document.getElementById('newCampaignModal').classList.add('active');
}

function displayCampaignOverview(camp) {
  currentCampaignData = camp;
  const sessionTitle = document.getElementById('headerSessionTitle');
  if (sessionTitle) sessionTitle.innerText = camp.title.toUpperCase();
  const chronicTitle = document.getElementById('headerChronicleTitle');
  if (chronicTitle) chronicTitle.innerText = camp.title.toUpperCase();
  const actLabel = document.getElementById('headerActLabel');
  if (actLabel) actLabel.innerText = 'ACT 1';
  const chronicMeta = document.getElementById('headerChronicleMeta');
  if (chronicMeta) chronicMeta.innerText = `${camp.setting_city} • ${camp.setting_year} • Vampire: The Masquerade V5`;
  if (document.getElementById('campPitch')) document.getElementById('campPitch').value = camp.core_pitch || '';
  if (document.getElementById('campTenets')) document.getElementById('campTenets').value = camp.chronicle_tenets || '';
  if (document.getElementById('campFactions')) document.getElementById('campFactions').value = camp.main_factions || '';
  if (document.getElementById('campMaxChars')) document.getElementById('campMaxChars').value = camp.max_characters_per_player || 2;
}

function saveCampaignDetails() {
  if (!document.getElementById('campPitch')) return;
  const pitch = document.getElementById('campPitch').value;
  const tenets = document.getElementById('campTenets').value;
  const factions = document.getElementById('campFactions').value;
  const maxChars = parseInt(document.getElementById('campMaxChars').value, 10) || 2;
  authFetch('/api/chronicles/' + activeCampaignId, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      core_pitch: pitch,
      chronicle_tenets: tenets,
      main_factions: factions,
      max_characters_per_player: maxChars
    })
  }).then(res => res.json()).then(() => {
    alert('Campaign Overview details saved successfully!');
  });
}


let draggedEpisodeCard = null;
async function saveEpisodeOrder() {
    const list = document.getElementById('episodeCardsList');
    const cards = Array.from(list.querySelectorAll('.episode-card-item'));
    const newOrderIds = cards.map(c => parseInt(c.dataset.id));
    
    cards.forEach((c, i) => {
        const epNumSpan = c.querySelector('.ep-num');
        if (epNumSpan) epNumSpan.innerText = `Ep ${i + 1}`;
    });
    
    const token = localStorage.getItem('vtm_auth_token');
    try {
        await fetch(`/api/campaigns/${activeCampaignId}/episodes/reorder`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            },
            body: JSON.stringify({ episode_ids: newOrderIds })
        });
    } catch(err) {
        console.error('Failed to save episode order:', err);
    }
}

function renderEpisodesList(episodes) {
  const list = document.getElementById('episodeCardsList');
  list.innerHTML = '';
  episodes.forEach((ep, index) => {
    const card = document.createElement('div');
    card.className = `episode-card-item ${ep.id === activeEpisodeId ? 'active' : ''}`;
    card.onclick = () => loadEpisodeDetails(ep.id);
    card.draggable = true;
    card.dataset.id = ep.id;
    card.innerHTML = `
            <span class="ep-num" style="cursor: grab;">Ep ${ep.episode_number}</span>
            <div class="ep-meta" style="flex:1; cursor: pointer;">
                <strong>${ep.title}</strong>
                <span class="ep-status status-${ep.status || 'planning'}">${ep.status || 'Planning'}</span>
            </div>
            <button class="btn-action-outline btn-sm text-danger" onclick="deleteEpisode(${ep.id}, event)" style="padding:2px 6px; border:none; background:transparent;" title="Delete Episode"><i class="fa-solid fa-trash"></i></button>
        `;
    
    card.addEventListener('dragstart', (e) => {
        draggedEpisodeCard = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => card.style.opacity = '0.5', 0);
    });
    
    card.addEventListener('dragend', (e) => {
        draggedEpisodeCard = null; card.classList.remove('dragging');
        card.style.opacity = '1';
        list.querySelectorAll('.episode-card-item').forEach(c => {
            c.style.borderTop = '';
            c.style.borderBottom = '';
        });
    });
    
    
        
    
    
    
    

    list.appendChild(card);
  });

  // Attach drag events to the list's parent container to catch drops in the empty space
    const listContainer = list.parentElement;
  
  list.style.minHeight = '50px';
  list.style.paddingBottom = '20px'; 
  
  function getDragInsertionPoint(y) {
      const cards = Array.from(list.querySelectorAll('.episode-card-item:not(.dragging)'));
      let closest = null;
      let closestOffset = Number.POSITIVE_INFINITY;
      
      cards.forEach(card => {
          const box = card.getBoundingClientRect();
          const offset = y - (box.top + box.height / 2);
          if (offset > 0 && offset < closestOffset) {
              closestOffset = offset;
              closest = card;
          }
      });
      return closest;
  }
  
  listContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      list.querySelectorAll('.episode-card-item').forEach(c => { c.style.borderTop = ''; c.style.borderBottom = ''; });
      
      if (!draggedEpisodeCard) return;
      
      const insertAfterCard = getDragInsertionPoint(e.clientY);
      
      if (insertAfterCard) {
          insertAfterCard.style.borderBottom = '2px solid #ef4444';
      } else {
          // If it's above everything, highlight top of first card
          const firstCard = list.querySelector('.episode-card-item:not(.dragging)');
          if (firstCard) firstCard.style.borderTop = '2px solid #ef4444';
      }
  });
  
  listContainer.addEventListener('dragleave', (e) => {
      list.querySelectorAll('.episode-card-item').forEach(c => { c.style.borderTop = ''; c.style.borderBottom = ''; });
  });
  
  listContainer.addEventListener('drop', (e) => {
      e.preventDefault();
      if (!draggedEpisodeCard) return;
      
      list.querySelectorAll('.episode-card-item').forEach(c => { c.style.borderTop = ''; c.style.borderBottom = ''; });
      
      const insertAfterCard = getDragInsertionPoint(e.clientY);
      
      if (insertAfterCard) {
          if (insertAfterCard !== draggedEpisodeCard) {
              insertAfterCard.after(draggedEpisodeCard);
              saveEpisodeOrder();
          }
      } else {
          const firstCard = list.querySelector('.episode-card-item:not(.dragging)');
          if (firstCard && firstCard !== draggedEpisodeCard) {
              firstCard.before(draggedEpisodeCard);
              saveEpisodeOrder();
          }
      }
  });
}


async function loadEpisodeDetails(epId) {
  activeEpisodeId = epId;
  document.querySelectorAll('.episode-card-item').forEach(c => c.classList.remove('active'));
  try {
    const res = await authFetch(`/api/episodes/${epId}`);
    const ep = await res.json();
    while (typeof ep.scenes === 'string') {
      try {
        ep.scenes = JSON.parse(ep.scenes);
      } catch (e) {
        ep.scenes = [];
        break;
      }
    }
    if (!Array.isArray(ep.scenes)) ep.scenes = [];
    while (typeof ep.npc_agendas === 'string') {
      try {
        ep.npc_agendas = JSON.parse(ep.npc_agendas);
      } catch (e) {
        ep.npc_agendas = [];
        break;
      }
    }
    if (!Array.isArray(ep.npc_agendas)) ep.npc_agendas = [];
    currentEpisodeData = ep;
    renderEpisodeMaps();
    const epTitleEl = document.getElementById('activeEpTitle') || document.getElementById('epDetailTitle');
    const epTitleInput = document.getElementById('epTitleInput');
    if (epTitleInput) epTitleInput.value = ep.title || '';
    if (epTitleEl) epTitleEl.innerText = `Episode ${ep.episode_number}: ${ep.title}`;
    const epHookEl = document.getElementById('epHook');
    if (epHookEl) epHookEl.value = ep.hook || '';
    const mapInput = document.getElementById('epBannerInput');
    if (mapInput) mapInput.value = ep.primary_location || '/images/concept_map.jpg';
    if (typeof updateWorkshopMinimap === 'function') updateWorkshopMinimap();
    
    const agendasList = document.getElementById('epAgendasList');
    agendasList.innerHTML = '';
    
    // We fetch the characters to resolve ref_ids
    authFetch('/api/characters?campaign_id=' + activeCampaignId + '&_t=' + Date.now())
    .then(r => r.json())
    .then(campaignChars => {
        if (ep.npc_agendas && ep.npc_agendas.length > 0) {
            ep.npc_agendas.forEach((npc, index) => {
                const card = document.createElement('div');
                card.className = 'agenda-card';
                
                // Backwards compatibility for old raw objects vs new ref_id objects
                let charData = npc; 
                let isLinked = false;
                if (npc.ref_id) {
                    const found = campaignChars.find(c => c.id === npc.ref_id);
                    if (found) {
                        charData = {
                            id: found.id,
                            name: found.name,
                            wants: found.npc_current_want,
                            mask: found.npc_mask_truth,
                            line: found.npc_taboos,
                            mannerisms: found.npc_mannerisms,
                            biases: found.npc_biases,
                            secret: found.npc_hidden_secret,
                            memories: found.npc_active_memories,
                            timeline: found.npc_faction_timeline
                        };
                        isLinked = true;
                    } else {
                        charData = { name: "Unknown Character (Deleted?)" };
                    }
                }

                card.innerHTML = `
                    <div class="agenda-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <strong><i class="fa-solid fa-user-secret" style="color:#10b981;"></i> ${escapeHtml(charData.name || 'Unknown')}</strong>
                        <button class="btn-card-ctrl" onclick="removeNpcAgenda(${index})" title="Remove from Episode" style="color:#ef4444; background:transparent; border:none; cursor:pointer; font-size:14px;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div class="agenda-body" style="display:flex; flex-direction:column; gap:8px;">
                        ${isLinked ? `
                            <div>
                                <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Current Want (Tonight)</label>
                                <textarea id="workshop_npc_${charData.id}_npc_current_want" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${charData.id}, 'npc_current_want', this.value)">${escapeHtml(charData.wants || '')}</textarea>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Mask vs Truth</label>
                                    <textarea id="workshop_npc_${charData.id}_npc_mask_truth" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${charData.id}, 'npc_mask_truth', this.value)">${escapeHtml(charData.mask || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Line in the Sand</label>
                                    <textarea id="workshop_npc_${charData.id}_npc_taboos" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${charData.id}, 'npc_taboos', this.value)">${escapeHtml(charData.line || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Mannerisms</label>
                                    <textarea id="workshop_npc_${charData.id}_npc_mannerisms" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${charData.id}, 'npc_mannerisms', this.value)">${escapeHtml(charData.mannerisms || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Biases</label>
                                    <textarea id="workshop_npc_${charData.id}_npc_biases" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${charData.id}, 'npc_biases', this.value)">${escapeHtml(charData.biases || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#f59e0b; text-transform:uppercase;">The Hidden Secret</label>
                                    <textarea id="workshop_npc_${charData.id}_npc_hidden_secret" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${charData.id}, 'npc_hidden_secret', this.value)">${escapeHtml(charData.secret || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Active Memories</label>
                                    <textarea id="workshop_npc_${charData.id}_npc_active_memories" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${charData.id}, 'npc_active_memories', this.value)">${escapeHtml(charData.memories || '')}</textarea>
                                </div>
                            </div>
                            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">
                                <label style="font-size:10px; color:#ef4444; text-transform:uppercase;"><i class="fa-solid fa-clock-rotate-left"></i> Faction Timeline / Plot Spine</label>
                                <textarea id="workshop_npc_${charData.id}_npc_faction_timeline" class="vtm-input" rows="2" placeholder="What will they do across the episodes if players never intervene?" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2); border-color:rgba(239, 68, 68, 0.3);" onchange="updateCharacterNpcField(${charData.id}, 'npc_faction_timeline', this.value)">${escapeHtml(charData.timeline || '')}</textarea>
                            </div>
                        ` : `
                            <p><strong>Wants (Tonight):</strong> ${escapeHtml(charData.wants || charData.want || 'Unknown')}</p>
                            <p style="font-size:10px; color:#ef4444;">(Legacy unlinked NPC. Remove and re-add from Vault to link and edit full 7-point profile).</p>
                        `}
                    </div>
                `;
                agendasList.appendChild(card);
            });
        } else {
            agendasList.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No NPC agendas configured yet.</div>';
        }
    });
    
    const scenesList = document.getElementById('epScenesList');
    if (scenesList) {
      scenesList.innerHTML = '';
      if (ep.scenes && ep.scenes.length > 0) {
        ep.scenes.forEach(sc => {
          const card = document.createElement('div');
          card.className = 'scene-flow-card';
          card.innerHTML = `
                        <div class="scene-flow-header">
                            <div class="scene-title-badge">
                                <h4>${sc.title}</h4>
                                <span class="scene-loc-tag"><i class="fa-solid fa-location-dot"></i> ${sc.location}</span>
                            </div>
                            <div class="scene-actions">
                                <button class="btn-push-scene" onclick="pushSceneToGameboard('${encodeURIComponent(JSON.stringify(sc))}')">
                                    <i class="fa-solid fa-satellite-dish"></i> PUSH TO GAMEBOARD
                                </button>
                            </div>
                        </div>
                        <div class="scene-flow-body">
                            <p class="scene-mood"><em>"${sc.mood}"</em></p>
                            <p class="scene-obj"><strong>Objectives:</strong> ${sc.objectives}</p>
                            <div class="scene-clues-box">
                                <div><strong>Investigation (Standard):</strong> ${sc.standard_clue || 'Obvious clue.'}</div>
                                <div><strong>Investigation (Exceptional):</strong> ${sc.exceptional_clue || 'Hidden secret.'}</div>
                            </div>
                        </div>
                    `;
          scenesList.appendChild(card);
        });
      } else {
        scenesList.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No scenes mapped out yet.</div>';
      }
    }
    renderClueMatrices(ep.matrices || []);
    renderLoreMatrices(ep.lore_matrices || []);
  } catch (err) {
    console.error('Failed to load episode details:', err);
  }
}

function pushSceneToGameboard(encodedScene) {
  const sc = JSON.parse(decodeURIComponent(encodedScene));
  socket.emit('scene:push', {
    campaignId: activeCampaignId,
    banner: sc.banner || '/images/banner_1200x400.jpg',
    location: sc.location,
    mood: sc.mood
  });
  const wrap = document.getElementById('atmosphereBannerWrap');
  if (wrap && wrap.classList.contains('collapsed')) {
    toggleAtmosphereBanner();
  }
  if (sc.map_url) {
    switchGameboardMap(sc.map_url);
  }
  alert(`Scene "${sc.title}" has been pushed live to the Gameboard!`);
}

function renderClueMatrices(matrices) {
  const container = document.getElementById('epMatricesContainer');
  container.innerHTML = '';
  if (matrices.length === 0) {
    container.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No clue matrices created yet. Click "+ New Clue Matrix" to build one!</div>';
    return;
  }
  matrices.forEach(m => {
    const matrixCard = document.createElement('div');
    matrixCard.className = 'matrix-panel-card';
    let cluesRows = '';
    if (m.clues && m.clues.length > 0) {
      m.clues.forEach(c => {
        const actionButton = c.discovered ? `<button class="btn-action-conceal" onclick="toggleClue(${c.id})" title="Hide from Gameboard"><i class="fa-solid fa-eye-slash"></i> Re-Hide</button>` : `<button class="btn-action-reveal" onclick="toggleClue(${c.id})" title="Publish to Gameboard"><i class="fa-solid fa-bullhorn"></i> Reveal</button>`;
        cluesRows += `
                    <tr>
                        <td><strong>${c.title}</strong><br>
                            <small style="color:#3b82f6;"><i class="fa-solid fa-shoe-prints"></i> ${c.description || 'No mechanical lead.'}</small><br>
                            <small style="color:#8b5cf6;"><i class="fa-solid fa-heart-crack"></i> ${c.emotional_depth || 'No emotional depth.'}</small>
                        </td>
                        <td><span class="delivery-badge">${c.delivery_method || 'Found item'}</span></td>
                        <td><span style="font-size:11px;color:#d1d5db;">${c.location_hint || 'Any scene'}</span></td>
                        <td>${c.discovered ? '<span style="color:#10b981;font-weight:700;"><i class="fa-solid fa-check"></i> Discovered</span>' : '<span style="color:#9ca3af;">Hidden</span>'}</td>
                        <td>
                            <div style="display:flex; gap:6px;">
                                ${actionButton}
                                <button class="btn-action-outline btn-sm" onclick="openEditClueModal(${c.id})" title="Edit Clue"><i class="fa-solid fa-pencil"></i></button>
                                <button class="btn-action-outline btn-sm text-danger" onclick="deleteClue(${c.id})" title="Delete Clue" style="border-color:#ef4444; color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
      });
    } else {
      cluesRows = '<tr><td colspan="5" style="color:#9ca3af;font-style:italic;text-align:center;">No clues in this matrix yet. Add one below!</td></tr>';
    }
    matrixCard.innerHTML = `
            <div class="matrix-card-header">
                <div>
                    <h4><i class="fa-solid fa-folder-open"></i> ${m.title}</h4>
                    <span class="matrix-notes">${m.notes || 'Independent / Floating Clue Matrix'}</span>
                </div>
                <div>
                    <button class="btn-action-small" onclick="openClueMatrixWidget(${m.id})" title="Open as floating widget on Board"><i class="fa-solid fa-window-restore"></i> Pop to Board</button>
                    <button class="btn-action-small" onclick="openAddClueModal(${m.id})"><i class="fa-solid fa-plus"></i> Add Clue</button>
                    <button class="btn-text-danger" onclick="deleteMatrix(${m.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="matrix-table-wrap">
                <table class="clue-matrix-table">
                    <thead>
                        <tr>
                            <th>Clue Payload</th>
                            <th>Delivery Vector</th>
                            <th>Target Scene</th>
                            <th>Status</th>
                            <th style="min-width:110px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>${cluesRows}</tbody>
                </table>
            </div>
        `;
    container.appendChild(matrixCard);
  });
}

function toggleClue(clueId) {
  authFetch(`/api/clues/${clueId}/toggle`, {
    method: 'POST'
  }).then(res => res.json()).then(() => {
    if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
    const drawer = document.getElementById('storytellerDrawer');
    if (drawer && drawer.classList.contains('open')) {
      loadDrawerUnrevealedClues();
    }
  }).catch(err => console.error('Failed to toggle clue:', err));
}

function renderLoreMatrices(matrices) {
  const container = document.getElementById('epLoreMatricesContainer');
  container.innerHTML = '';
  if (matrices.length === 0) {
    container.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No lore matrices created yet. Click "+ New Lore Matrix" to build one!</div>';
    return;
  }
  matrices.forEach(m => {
    const matrixCard = document.createElement('div');
    matrixCard.className = 'matrix-panel-card lore-matrix-card';
    let entriesRows = '';
    if (m.entries && m.entries.length > 0) {
      m.entries.forEach(e => {
        const actionButton = e.discovered ? `<button class="btn-action-conceal" onclick="toggleLore(${e.id})" title="Hide from Gameboard"><i class="fa-solid fa-eye-slash"></i> Re-Hide</button>` : `<button class="btn-action-reveal" onclick="toggleLore(${e.id})" title="Publish to Gameboard"><i class="fa-solid fa-book-open"></i> Reveal Lore</button>`;
        entriesRows += `
                    <tr>
                        <td><strong>${e.title}</strong><br><small style="color:#d1d5db;line-height:1.3;display:block;margin-top:2px;">${e.content.substring(0, 120)}...</small></td>
                        <td><span class="lore-cat-badge">${e.category || 'Kindred History'}</span></td>
                        <td><span style="font-size:11px;color:#fca5a5;">${e.revelation_vector || 'Elder Whispers'}</span></td>
                        <td>${e.discovered ? '<span style="color:#10b981;font-weight:700;"><i class="fa-solid fa-check"></i> Revealed</span>' : '<span style="color:#9ca3af;">Hidden</span>'}</td>
                        <td>${actionButton}</td>
                    </tr>
                `;
      });
    } else {
      entriesRows = '<tr><td colspan="5" style="color:#9ca3af;font-style:italic;text-align:center;">No lore revelations in this matrix yet. Add one below!</td></tr>';
    }
    matrixCard.innerHTML = `
            <div class="matrix-card-header">
                <div>
                    <h4><i class="fa-solid fa-book-journal-whills"></i> ${m.title}</h4>
                    <span class="matrix-notes">${m.notes || 'Chronicle Lore & Revelation Archive'}</span>
                </div>
                <div>
                    <button class="btn-action-small" onclick="openAddLoreModal(${m.id})"><i class="fa-solid fa-plus"></i> Add Revelation</button>
                    <button class="btn-text-danger" onclick="deleteLoreMatrix(${m.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="matrix-table-wrap">
                <table class="clue-matrix-table">
                    <thead>
                        <tr>
                            <th>Revelation Title & Text</th>
                            <th>Category</th>
                            <th>Revelation Vector (How to Learn)</th>
                            <th>Status</th>
                            <th style="min-width:110px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>${entriesRows}</tbody>
                </table>
            </div>
        `;
    container.appendChild(matrixCard);
  });
}

function toggleLore(loreId) {
  authFetch(`/api/lore_entries/${loreId}/toggle`, {
    method: 'POST'
  }).then(res => res.json()).then(() => {
    if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
    const drawer = document.getElementById('storytellerDrawer');
    if (drawer && drawer.classList.contains('open')) {
      loadDrawerUnrevealedLore();
    }
  }).catch(err => console.error('Failed to toggle lore:', err));
}

async function loadDrawerUnrevealedClues() {
  const list = document.getElementById('drawerUnrevealedClues');
  list.innerHTML = 'Loading...';
  try {
    const res = await authFetch(`/api/matrices?episode_id=${activeEpisodeId}&campaign_id=${activeCampaignId}`);
    const matrices = await res.json();
    list.innerHTML = '';
    matrices.forEach(m => {
      if (m.clues && m.clues.length > 0) {
        const group = document.createElement('div');
        group.style.marginBottom = '12px';
        group.innerHTML = `<h5 style="color:#fca5a5;font-size:12px;margin-bottom:6px;border-bottom:1px solid #372329;padding-bottom:2px;">${m.title}</h5>`;
        m.clues.forEach(c => {
          const item = document.createElement('div');
          item.style.marginBottom = '8px';
          item.style.padding = '6px';
          item.style.background = '#191216';
          item.style.borderRadius = '4px';
          const btn = c.discovered ? `<button class="btn-action-conceal" onclick="toggleClue(${c.id})"><i class="fa-solid fa-eye-slash"></i> Re-Hide</button>` : `<button class="btn-action-reveal" onclick="toggleClue(${c.id})"><i class="fa-solid fa-bullhorn"></i> Push to Corkboard</button>`;
          item.innerHTML = `
                        <div style="font-size:12px;font-weight:700;color:#f3f4f6;">${c.title}</div>
                        <div style="font-size:10px;color:#d97706;margin-bottom:4px;">Vector: ${c.delivery_method}</div>
                        ${btn}
                    `;
          group.appendChild(item);
        });
        list.appendChild(group);
      }
    });
    if (list.innerHTML === '') {
      list.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;">No clues found in current episode.</div>';
    }
  } catch (err) {
    console.error(err);
  }
}

async function loadDrawerUnrevealedLore() {
  const list = document.getElementById('drawerUnrevealedLore');
  list.innerHTML = 'Loading...';
  try {
    const res = await authFetch(`/api/lore_matrices?episode_id=${activeEpisodeId}&campaign_id=${activeCampaignId}`);
    const matrices = await res.json();
    list.innerHTML = '';
    matrices.forEach(m => {
      if (m.entries && m.entries.length > 0) {
        const group = document.createElement('div');
        group.style.marginBottom = '12px';
        group.innerHTML = `<h5 style="color:#fbbf24;font-size:12px;margin-bottom:6px;border-bottom:1px solid #372329;padding-bottom:2px;">${m.title}</h5>`;
        m.entries.forEach(e => {
          const item = document.createElement('div');
          item.style.marginBottom = '8px';
          item.style.padding = '6px';
          item.style.background = '#191216';
          item.style.borderRadius = '4px';
          const btn = e.discovered ? `<button class="btn-action-conceal" onclick="toggleLore(${e.id})"><i class="fa-solid fa-eye-slash"></i> Re-Hide</button>` : `<button class="btn-action-reveal" onclick="toggleLore(${e.id})"><i class="fa-solid fa-book-open"></i> Push to Gameboard</button>`;
          item.innerHTML = `
                        <div style="font-size:12px;font-weight:700;color:#f3f4f6;">${e.title}</div>
                        <div style="font-size:10px;color:#fca5a5;margin-bottom:4px;">Learned via: ${e.revelation_vector}</div>
                        ${btn}
                    `;
          group.appendChild(item);
        });
        list.appendChild(group);
      }
    });
    if (list.innerHTML === '') {
      list.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;">No lore entries found in current episode.</div>';
    }
  } catch (err) {
    console.error(err);
  }
}

function openNewEpisodeModal() {
  document.getElementById('newEpisodeModal').classList.add('active');
}

function openNewMatrixModal() {
  document.getElementById('newMatrixModal').classList.add('active');
}

function openAddClueModal(matrixId) {
  const el = document.getElementById('targetMatrixId') || document.getElementById('newClueMatrixId');
  if (el) el.value = matrixId;
  document.getElementById('newClueModal').classList.add('active');
}

function openNewLoreMatrixModal() {
  document.getElementById('newLoreMatrixModal').classList.add('active');
}

function openAddLoreModal(matrixId) {
  const el = document.getElementById('targetLoreMatrixId') || document.getElementById('newLoreMatrixId');
  if (el) el.value = matrixId;
  const modal = document.getElementById('newLoreModal') || document.getElementById('newLoreEntryModal');
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('active');
    el.style.display = '';
  }
}

function openNewChronicleModal() {
  const m = document.getElementById('newChronicleModal');
  if (m) m.classList.add('active');
}

function createChronicleSubmit() {
  const title = document.getElementById('newChronicleTitle')?.value.trim() || document.getElementById('newCampTitle')?.value.trim() || '';
  const city = document.getElementById('newChronicleCity')?.value.trim() || document.getElementById('newCampCity')?.value.trim() || '';
  const year = document.getElementById('newChronicleYear')?.value.trim() || document.getElementById('newCampYear')?.value.trim() || '';
  const desc = document.getElementById('newChronicleDesc')?.value.trim() || document.getElementById('newCampDesc')?.value.trim() || '';
  const maxChars = parseInt(document.getElementById('newChronicleMaxChars')?.value || document.getElementById('newCampMaxChars')?.value) || 2;
  if (!title) return alert('Chronicle title is required.');
  authFetch('/api/chronicles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      setting_city: city,
      setting_year: year,
      description: desc,
      max_characters_per_player: maxChars
    })
  }).then(res => res.json()).then(data => {
    if (data.id) {
      closeModal('newChronicleModal');
      closeModal('newCampaignModal');
      enterChronicle(data.id, 'gm', 'campaigns');
      alert(`Chronicle "${title}" forged successfully!`);
    } else {
      alert(data.error || 'Failed to create chronicle.');
    }
  }).catch(err => {
    console.error(err);
    alert('Network error creating chronicle.');
  });
}

function createCampaignSubmit() {
  const title = document.getElementById('newCampaignTitle')?.value.trim() || document.getElementById('newCampTitle')?.value.trim() || '';
  if (!title) return alert('Campaign title is required.');
  if (!activeCampaignId) return alert('Please select an active chronicle first.');
  authFetch(`/api/chronicles/${activeCampaignId}/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      description: ''
    })
  }).then(res => res.json()).then(data => {
    if (data.id) {
      closeModal('newCampaignModal');
      activeSubCampaignId = data.id;
      loadCampaignsList();
      alert(`Campaign "${title}" created successfully!`);
    } else {
      alert(data.error || 'Failed to create campaign.');
    }
  }).catch(err => {
    console.error(err);
    alert('Network error creating campaign.');
  });
}

function createEpisodeSubmit() {
  const epNumInput = document.getElementById('newEpNumber') || document.getElementById('newEpNum') || document.getElementById('newEpisodeNum');
  const epNum = parseInt(epNumInput ? epNumInput.value : 1) || 1;
  const title = document.getElementById('newEpTitle')?.value.trim() || document.getElementById('newEpisodeTitle')?.value.trim() || '';
  const loc = document.getElementById('newEpLoc')?.value.trim() || '';
  const mood = document.getElementById('newEpMood')?.value.trim() || '';
  const concepts = document.getElementById('newEpConcepts')?.value.trim() || (loc ? `Location: ${loc}` : 'Chronicle Arc');
  if (!title) return alert('Episode title is required.');
  if (!activeCampaignId) return alert('Please select or create an active chronicle first.');
  authFetch(`/api/chronicles/${activeCampaignId}/episodes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      episode_number: epNum,
      title,
      concepts,
      hook: mood,
      campaign_id: activeSubCampaignId
    })
  }).then(res => res.json()).then(data => {
    if (data.id) {
      closeModal('newEpisodeModal');
      loadCampaignsList();
      alert(`Episode "${title}" created successfully!`);
    } else {
      alert(data.error || 'Failed to create episode.');
    }
  }).catch(err => {
    console.error(err);
    alert('Network error creating episode.');
  });
}

function createMatrixSubmit() {
  const title = document.getElementById('newMatrixTitle')?.value.trim() || '';
  const notes = document.getElementById('newMatrixNotes')?.value.trim() || '';
  if (!title) return alert('Matrix title is required.');
  if (!activeCampaignId) return alert('Please select an active chronicle first.');
  authFetch('/api/matrices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeCampaignId,
      episode_id: activeEpisodeId || null,
      title,
      notes
    })
  }).then(res => res.json()).then(data => {
    if (data.id) {
      console.log('[Trace][ClueMatrix] Matrix created:', data);
      if (currentEpisodeData) {
        if (!currentEpisodeData.matrices || !Array.isArray(currentEpisodeData.matrices)) {
          currentEpisodeData.matrices = [];
        }
        currentEpisodeData.matrices.push(data);
      }
      if (!allCampaignClueMatrices || !Array.isArray(allCampaignClueMatrices)) {
        allCampaignClueMatrices = [];
      }
      if (!allCampaignClueMatrices.some(m => m.id === data.id)) {
        allCampaignClueMatrices.push(data);
      }
      closeModal('newMatrixModal');
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadClueMatricesForWidget();
      alert(`Clue Matrix "${title}" created successfully!`);
    } else {
      alert(data.error || 'Failed to create clue matrix.');
    }
  }).catch(err => {
    console.error(err);
    alert('Network error creating clue matrix.');
  });
}

function deleteMatrix(id) {
  if (confirm('Delete this clue matrix and all clues inside it?')) {
    authFetch(`/api/matrices/${id}`, {
      method: 'DELETE'
    }).then(res => res.json()).then(() => {
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadClueMatricesForWidget();
    });
  }
}

function createClueSubmit() {
  const matrixEl = document.getElementById('targetMatrixId') || document.getElementById('newClueMatrixId');
  const matrixId = matrixEl ? matrixEl.value : null;
  const title = document.getElementById('newClueTitle')?.value.trim() || '';
  const delivery = document.getElementById('newClueDelivery')?.value.trim() || document.getElementById('newClueMethod')?.value.trim() || 'Found item';
  const loc = document.getElementById('newClueLocation')?.value.trim() || '';
  const desc = document.getElementById('newClueDesc')?.value.trim() || '';
  if (!matrixId) return alert('No target matrix selected.');
  if (!title) return alert('Clue title is required.');
  authFetch('/api/clues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      matrix_id: parseInt(matrixId),
      title,
      delivery_method: delivery,
      location_hint: loc,
      description: desc
    })
  }).then(res => res.json()).then(data => {
    if (data.id) {
      closeModal('newClueModal');
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadClueMatricesForWidget();
      alert(`Clue "${title}" added successfully!`);
    } else {
      alert(data.error || 'Failed to create clue revelation.');
    }
  }).catch(err => {
    console.error(err);
    alert('Network error adding clue revelation.');
  });
}

function createLoreMatrixSubmit() {
  const title = document.getElementById('newLoreMatrixTitle')?.value.trim() || '';
  const notes = document.getElementById('newLoreMatrixNotes')?.value.trim() || '';
  if (!title) return alert('Lore Matrix title is required.');
  if (!activeCampaignId) return alert('Please select an active chronicle first.');
  authFetch('/api/lore_matrices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeCampaignId,
      episode_id: activeEpisodeId || null,
      title,
      notes
    })
  }).then(res => res.json()).then(data => {
    if (data.id) {
      console.log('[Trace][LoreMatrix] Lore matrix created:', data);
      if (currentEpisodeData) {
        if (!currentEpisodeData.lore_matrices || !Array.isArray(currentEpisodeData.lore_matrices)) {
          currentEpisodeData.lore_matrices = [];
        }
        currentEpisodeData.lore_matrices.push(data);
      }
      if (!allCampaignLoreMatrices || !Array.isArray(allCampaignLoreMatrices)) {
        allCampaignLoreMatrices = [];
      }
      if (!allCampaignLoreMatrices.some(m => m.id === data.id)) {
        allCampaignLoreMatrices.push(data);
      }
      closeModal('newLoreMatrixModal');
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadLoreMatricesForWidget();
      alert(`Lore Matrix "${title}" created successfully!`);
    } else {
      alert(data.error || 'Failed to create lore matrix.');
    }
  }).catch(err => {
    console.error(err);
    alert('Network error creating lore matrix.');
  });
}

function deleteLoreMatrix(id) {
  if (confirm('Delete this lore matrix and all lore revelations inside it?')) {
    authFetch(`/api/lore_matrices/${id}`, {
      method: 'DELETE'
    }).then(res => res.json()).then(() => {
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadLoreMatricesForWidget();
    });
  }
}

function createLoreSubmit() {
  const matrixEl = document.getElementById('targetLoreMatrixId') || document.getElementById('newLoreMatrixId');
  const matrixId = matrixEl ? matrixEl.value : null;
  const title = document.getElementById('newLoreTitle')?.value.trim() || '';
  const category = document.getElementById('newLoreCategory')?.value || 'Kindred History';
  const vector = document.getElementById('newLoreVector')?.value.trim() || 'Elder Whispers';
  const content = document.getElementById('newLoreContent')?.value.trim() || '';
  if (!matrixId) return alert('No target lore matrix selected.');
  if (!title || !content) return alert('Title and Lore Content are required.');
  authFetch('/api/lore_entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      matrix_id: parseInt(matrixId),
      title,
      category,
      revelation_vector: vector,
      content
    })
  }).then(res => res.json()).then(data => {
    if (data.id) {
      closeModal('newLoreModal');
      closeModal('newLoreEntryModal');
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadLoreMatricesForWidget();
      alert(`Lore revelation "${title}" saved successfully!`);
    } else {
      alert(data.error || 'Failed to add lore entry.');
    }
  }).catch(err => {
    console.error(err);
    alert('Network error adding lore entry.');
  });
}

function saveEpisodeDetails() {
  if (!activeEpisodeId) return;
  const title = document.getElementById('epTitleInput').value.trim();
  const statusSelect = document.getElementById('epStatusSelect');
  const status = statusSelect ? statusSelect.value : 'planning';
  const hook = document.getElementById('epHook').value.trim();
  authFetch(`/api/episodes/${activeEpisodeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      status,
      hook,
      maps: currentEpisodeData.maps || []
    })
  }).then(res => res.json()).then(data => {
    if (data.success) alert('Episode details saved successfully!'); else alert('Failed to save episode: ' + data.error);
    loadEpisodeDetails(activeEpisodeId);
    if (typeof fetchEpisodes === "function") fetchEpisodes();
  }).catch(e => {
    console.error(e);
    alert('Error saving episode details.');
  });
}

function saveEpisodeEdits() {
  const hook = document.getElementById('epHook').value;
  authFetch(`/api/episodes/${activeEpisodeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      hook
    })
  }).then(res => res.json()).then(() => alert('Episode Hook saved!'));
}


async function addNpcAgendaPrompt() {
    if (!activeCampaignId) return alert('Select a chronicle first.');
    try {
        const res = await authFetch('/api/characters?campaign_id=' + activeCampaignId + '&_t=' + Date.now());
        if (!res.ok) throw new Error('Failed to fetch characters');
        const chars = await res.json();
        
        let selectHtml = '<select id="npcSelectDropdown" style="width:100%; padding:8px; background:#140e11; border:1px solid #3f3f46; color:#f8fafc; margin-bottom:12px; outline:none; border-radius:4px;">';
        selectHtml += '<option value="">-- Select a Character --</option>';
        chars.forEach(c => {
            selectHtml += `<option value="${c.id}">${escapeHtml(c.name)} ${c.title ? '('+escapeHtml(c.title)+')' : ''}</option>`;
        });
        selectHtml += '</select>';

        const charId = await new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay active';
            modal.style.zIndex = '9999999';
            modal.innerHTML = `
                <div class="modal-container" style="max-width:400px; background:#120b0f; border:1px solid #7f1d1d; border-radius:8px;">
                    <div class="modal-header" style="padding:16px; border-bottom:1px solid #372128; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px; color:#f8fafc;"><i class="fa-solid fa-user-plus" style="color:#10b981;"></i> Select NPC to Add</h3>
                        <button class="btn-close-modal" style="background:transparent; border:none; color:#d1d5db; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="modal-body" style="padding:16px;">
                        ${selectHtml}
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button class="btn-action-outline btn-cancel">Cancel</button>
                            <button class="btn-action btn-confirm">Add NPC</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const cleanup = () => { modal.remove(); };
            modal.querySelector('.btn-close-modal').onclick = () => { cleanup(); resolve(null); };
            modal.querySelector('.btn-cancel').onclick = () => { cleanup(); resolve(null); };
            modal.querySelector('.btn-confirm').onclick = () => { 
                const val = modal.querySelector('#npcSelectDropdown').value;
                cleanup(); 
                resolve(val ? parseInt(val) : null); 
            };
        });

        if (!charId) return;

        if (!currentEpisodeData) currentEpisodeData = {};
        if (typeof currentEpisodeData.npc_agendas === 'string') {
            try { currentEpisodeData.npc_agendas = JSON.parse(currentEpisodeData.npc_agendas); } catch(e) { currentEpisodeData.npc_agendas = []; }
        }
        if (!Array.isArray(currentEpisodeData.npc_agendas)) currentEpisodeData.npc_agendas = [];
        
        // Push the character_id as a reference object
        currentEpisodeData.npc_agendas.push({ ref_id: charId });
        await authFetch(`/api/episodes/${activeEpisodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ npc_agendas: currentEpisodeData.npc_agendas })
        });
        loadEpisodeDetails(activeEpisodeId);
    } catch(e) {
        console.error(e);
        alert('Error loading character list');
    }
}

function filterRulesByCategory(category) {
    activeRuleCategory = category;

    // Update active category chip
    const chips = document.querySelectorAll('.wiki-chip');
    chips.forEach(chip => {
        if (chip.innerText.trim() === category || (category === 'All' && chip.innerText.includes('All'))) {
            chip.classList.add('active');
        } else {
            chip.classList.remove('active');
        }
    });

    const searchInput = document.getElementById('ruleSearchInput');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    let filtered = allRules;
    if (category !== 'All') {
        filtered = filtered.filter(r => r.category && r.category.toLowerCase() === category.toLowerCase());
    }
    if (query) {
        filtered = filtered.filter(r =>
            r.title.toLowerCase().includes(query) ||
            (r.category && r.category.toLowerCase().includes(query)) ||
            (r.content && r.content.toLowerCase().includes(query)) ||
            (r.tags && r.tags.toLowerCase().includes(query))
        );
    }
    
    // Check which render function to use depending on the UI
    
    if (typeof renderRulebookHierarchy === 'function') {
        renderRulebookHierarchy(filtered);
    }
    if (typeof renderRules === 'function') {
        renderRules(filtered);
    }

}

function searchRules(query) {
  if (!query || query.trim() === '') {
    renderRulebookHierarchy(allRules);
    return;
  }
  const q = query.toLowerCase().trim();
  const filtered = allRules.filter(r => r.title.toLowerCase().includes(q) || r.content && r.content.toLowerCase().includes(q) || r.tags && r.tags.toLowerCase().includes(q));
  renderRulebookHierarchy(filtered);
}

function renderRules(rules) {
  const list = document.getElementById('ruleArticlesList');
  if (!list) return;
  list.innerHTML = '';
  if (rules.length === 0) {
    list.innerHTML = '<div style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No rules found matching criteria. Click "+ New Wiki Article" to create one.</div>';
    return;
  }
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
  rules.forEach(r => {
    const card = document.createElement('div');
    card.className = 'rule-card';
    let tagsHtml = '';
    if (r.tags) {
      const tagList = Array.isArray(r.tags) ? r.tags : r.tags.split(',');
      tagsHtml = `
                <div class="rule-card-tags">
                    ${tagList.map(t => `<span class="rule-card-tag">#${escapeHtml(t.trim())}</span>`).join('')}
                </div>
            `;
    }
    const gmActions = isGM ? `
            <div class="rule-card-actions">
                <button class="btn-card-ctrl" onclick="openNewRuleModal(${r.id})" title="Edit Article"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                <button class="btn-card-ctrl" onclick="deleteRuleArticle(${r.id})" title="Delete Article"><i class="fa-solid fa-trash"></i></button>
            </div>
        ` : '';
    card.innerHTML = `
            <div class="rule-card-header">
                <h4 class="rule-card-title">${escapeHtml(r.title)}</h4>
                <span class="rule-card-badge">${escapeHtml(r.category || 'General')}</span>
            </div>
            <div class="rule-card-content">${escapeHtml(r.content || r.summary || '')}</div>
            ${tagsHtml}
            ${gmActions}
        `;
    list.appendChild(card);
  });
}

function openNewRuleModal(editRuleId = null) {
  const modal = document.getElementById('newRuleModal');
  if (!modal) return;
  const modalTitle = document.getElementById('ruleModalTitle');
  const idInput = document.getElementById('ruleEditId');
  const titleInput = document.getElementById('ruleTitleInput');
  const catSelect = document.getElementById('ruleCategorySelect');
  const contentInput = document.getElementById('ruleContentInput');
  const tagsInput = document.getElementById('ruleTagsInput');
  if (editRuleId) {
    const rule = allRules.find(r => r.id === editRuleId);
    if (rule) {
      if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Codex Article';
      if (idInput) idInput.value = rule.id;
      if (titleInput) titleInput.value = rule.title || '';
      if (catSelect) catSelect.value = rule.category || 'Core Mechanics';
      if (contentInput) contentInput.value = rule.content || '';
      if (tagsInput) tagsInput.value = rule.tags || '';
    }
  } else {
    if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-book-medical"></i> Add Codex Article';
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (catSelect) catSelect.value = 'Core Mechanics';
    if (contentInput) contentInput.value = '';
    if (tagsInput) tagsInput.value = '';
  }
  modal.classList.add('active');
}

async function saveRuleSubmit() {
  const idInput = document.getElementById('ruleEditId');
  const ruleId = idInput ? idInput.value : '';
  const title = document.getElementById('ruleTitleInput').value.trim();
  const category = document.getElementById('ruleCategorySelect').value;
  const content = document.getElementById('ruleContentInput').value.trim();
  const tags = document.getElementById('ruleTagsInput').value.trim();
  if (!title || !content) {
    alert('Article title and content are required.');
    return;
  }
  const payload = {
    title,
    category,
    content,
    tags
  };
  try {
    let res;
    if (ruleId) {
      res = await authFetch(`/api/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } else {
      res = await authFetch('/api/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    }
    const data = await res.json();
    if (res.ok && data.success) {
      closeModal('newRuleModal');
      loadRulesCodex();
    } else {
      alert(data.error || 'Failed to save rule article.');
    }
  } catch (err) {
    console.error('Error saving rule article:', err);
    alert('Network error saving rule article.');
  }
}

async function deleteRuleArticle(ruleId) {
  if (!confirm('Are you sure you want to delete this rule article?')) return;
  try {
    const res = await authFetch(`/api/rules/${ruleId}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok && data.success) {
      loadRulesCodex();
    } else {
      alert(data.error || 'Failed to delete rule article.');
    }
  } catch (err) {
    console.error('Error deleting rule article:', err);
    alert('Network error deleting rule article.');
  }
}

function initCanvasEngine() {
  const viewport = document.getElementById('canvasViewport');
  const stage = document.getElementById('canvasStage');
  if (!viewport || !stage) return;
  viewport.ondragstart = e => {
    e.preventDefault();
    return false;
  };
  viewport.onmousedown = e => {
    if (e.button !== 0) return;
    if (e.target.closest('.canvas-card') || e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    e.preventDefault();
    if (window.getSelection) {
      window.getSelection().removeAllRanges();
    }
    canvasTransform.isPanning = true;
    canvasTransform.startX = e.clientX - canvasTransform.panX;
    canvasTransform.startY = e.clientY - canvasTransform.panY;
    viewport.style.cursor = 'grabbing';
  };
  if (!canvasListenersAttached) {
    canvasListenersAttached = true;
    window.addEventListener('mousemove', e => {
      if (canvasTransform.isPanning) {
        e.preventDefault();
        canvasTransform.panX = e.clientX - canvasTransform.startX;
        canvasTransform.panY = e.clientY - canvasTransform.startY;
        applyCanvasTransform();
      } else if (activeDragEntity) {
        handleEntityDragMove(e);
      } else if (activeResizeEntity) {
        handleEntityResizeMove(e);
      } else if (isChatDragging) {
        handleChatDragMove(e);
      }
    });
    window.addEventListener('mouseup', e => {
      if (canvasTransform.isPanning) {
        canvasTransform.isPanning = false;
        const vp = document.getElementById('canvasViewport');
        if (vp) vp.style.cursor = 'grab';
      }
      if (activeDragEntity) {
        activeDragEntity = null;
        debouncedSaveCanvasState();
        if (typeof loadMapPins === 'function') loadMapPins();
      }
      if (activeResizeEntity) {
        activeResizeEntity = null;
        debouncedSaveCanvasState();
        if (typeof loadMapPins === 'function') loadMapPins();
      }
      if (isChatDragging) {
        isChatDragging = false;
      }
    });
  }
  viewport.onwheel = e => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    canvasTransform.zoom = Math.min(Math.max(canvasTransform.zoom + zoomDelta, 0.4), 2.5);
    applyCanvasTransform();
  };
  initFloatingChatDraggable();
}

function applyCanvasTransform() {
  const stage = document.getElementById('canvasStage');
  if (!stage) return;
  stage.style.transform = `translate(${canvasTransform.panX}px, ${canvasTransform.panY}px) scale(${canvasTransform.zoom})`;
  renderSvgConnectors();
  const pins = document.querySelectorAll('.map-pin-marker');
  const invScale = 1 / canvasTransform.zoom;
  pins.forEach(pin => {
    pin.style.transform = `scale(${invScale})`;
  });
}

function resetCanvasTransform() {
  canvasTransform.panX = 0;
  canvasTransform.panY = 0;
  canvasTransform.zoom = 1.0;
  applyCanvasTransform();
}

function loadCanvasFromState(rawState, shouldPersist = false) {
  if (!rawState) return;
  try {
    const parsed = typeof rawState === 'string' ? JSON.parse(rawState) : rawState;
    canvasState = {
      backdrop: parsed.backdrop && parsed.backdrop !== '/images/banner_1200x400.jpg' && parsed.backdrop !== '/images/tactical_london_map.jpg' ? parsed.backdrop : '/images/concept_map.jpg',
      entities: Array.isArray(parsed.entities) ? parsed.entities : [],
      links: Array.isArray(parsed.links) ? parsed.links : []
    };
    const backdropImg = document.getElementById('canvasBackdropImg');
    if (backdropImg && canvasState.backdrop) {
      backdropImg.src = canvasState.backdrop;
    }
    const episodeMapSelector = document.getElementById('episodeMapSelector');
    if (episodeMapSelector && canvasState.backdrop) {
      episodeMapSelector.value = canvasState.backdrop;
    }
    renderCanvasEntities();
    renderSvgConnectors();
    if (shouldPersist) debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  } catch (err) {
    console.error('Failed to parse canvas state:', err);
  }
}

function renderCanvasEntities() {
  const container = document.getElementById('canvasEntitiesLayer');
  if (!container) return;
  container.innerHTML = '';
  canvasState.entities.forEach(entity => {
    const card = createEntityDomElement(entity);
    container.appendChild(card);
  });
}

function createEntityDomElement(entity) {
  const card = document.createElement('div');
  card.id = `canvas-entity-${entity.id}`;
  card.className = `canvas-card ${entity.type === 'image' ? 'canvas-image-card' : 'canvas-text-card'}`;
  card.style.left = `${entity.x}px`;
  card.style.top = `${entity.y}px`;
  card.style.width = `${entity.width || 280}px`;
  card.style.height = `${entity.height || 200}px`;
  card.style.zIndex = entity.zIndex || 10;
  const theme = CARD_COLOR_THEMES.find(t => t.name === entity.color) || CARD_COLOR_THEMES[0];
  card.style.borderColor = theme.border;
  card.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${theme.glow}`;
  const isImage = entity.type === 'image';
  const iconClass = isImage ? 'fa-camera' : 'fa-note-sticky';
  card.innerHTML = `
        <div class="card-header" onmousedown="handleEntityDragStart(event, '${entity.id}')" style="cursor: grab;">
            <div style="display:flex;align-items:center;gap:6px;flex:1;overflow:hidden;">
                <i class="fa-solid fa-grip-vertical" style="opacity: 0.4; margin-right: 2px;"></i>
                <i class="fa-solid ${iconClass} card-icon" style="color:${theme.accent};"></i>
                <input class="card-title-input" value="${escapeHtml(entity.title || 'Untitled Note')}" onchange="updateEntityTitle('${entity.id}', this.value)" placeholder="Label...">
            </div>
            <div class="card-header-actions" onmousedown="event.stopPropagation()">
                ${!isImage ? `<button class="btn-card-ctrl" onclick="cycleEntityFontSize('${entity.id}')" title="Adjust Font Size"><i class="fa-solid fa-text-height"></i></button>` : ''}
                <button class="btn-card-ctrl" onclick="cycleEntityColor('${entity.id}')" title="Change Mood Color" style="color:${theme.accent};"><i class="fa-solid fa-palette"></i></button>
                <button class="btn-card-ctrl ${linkingSourceEntityId === entity.id ? 'active-link-mode' : ''}" onclick="toggleLinkMode('${entity.id}')" title="Connect / Link to another note"><i class="fa-solid fa-link"></i></button>
                <button class="btn-card-ctrl" onclick="deleteCanvasEntity('${entity.id}')" title="Remove Note"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>
        <div class="card-body">
            ${isImage ? `
                <div class="card-image-wrap">
                    <img src="${entity.imageUrl}" alt="${escapeHtml(entity.title)}" onerror="this.src='/images/banner_1200x400.jpg'">
                </div>
                ${entity.caption ? `<div class="card-image-caption" contenteditable="true" onblur="updateEntityCaption('${entity.id}', this.innerText)">${escapeHtml(entity.caption)}</div>` : ''}
            ` : `
                <div class="card-text-editor" contenteditable="true" style="font-size:${entity.fontSize || '14px'};" onblur="updateEntityContent('${entity.id}', this.innerHTML)">${entity.content || 'Write notes, whisperings, or clues here...'}</div>
            `}
        </div>
        <div class="card-resize-handle" onmousedown="handleEntityResizeStart(event, '${entity.id}')"></div>
    `;
  return card;
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function spawnCanvasTextNote() {
  if (!canvasState) canvasState = {
    backdrop: '',
    entities: [],
    links: []
  };
  if (!canvasState.entities || !Array.isArray(canvasState.entities)) canvasState.entities = [];
  if (!canvasState.links || !Array.isArray(canvasState.links)) canvasState.links = [];
  const id = 'note-' + Date.now();
  const x = Math.round(200 - canvasTransform.panX / canvasTransform.zoom);
  const y = Math.round(150 - canvasTransform.panY / canvasTransform.zoom);
  const newNote = {
    id,
    type: 'note',
    title: 'Investigation Note',
    content: 'New lead uncovered in the district...',
    x: Math.max(20, x),
    y: Math.max(20, y),
    width: 280,
    height: 180,
    color: 'crimson',
    fontSize: '14px',
    zIndex: (canvasState.entities.length + 1) * 2
  };
  canvasState.entities.push(newNote);
  console.log('[Trace][Canvas] Pushed sticky note. Total:', canvasState.entities.length);
  renderCanvasEntities();
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}

function openAddImageModal() {
  document.getElementById('canvasAddImageModal').classList.add('active');
}

function createCanvasImageSubmit() {
  const title = document.getElementById('newCanvasImageTitle').value.trim() || 'Evidence Photograph';
  const url = document.getElementById('newCanvasImageUrl').value.trim();
  const caption = document.getElementById('newCanvasImageCaption').value.trim();
  if (!url) {
    alert('Please provide an Image URL.');
    return;
  }
  if (!canvasState) canvasState = {
    backdrop: '',
    entities: [],
    links: []
  };
  if (!canvasState.entities || !Array.isArray(canvasState.entities)) canvasState.entities = [];
  if (!canvasState.links || !Array.isArray(canvasState.links)) canvasState.links = [];
  const id = 'img-' + Date.now();
  const x = Math.round(250 - canvasTransform.panX / canvasTransform.zoom);
  const y = Math.round(180 - canvasTransform.panY / canvasTransform.zoom);
  const newImgEntity = {
    id,
    type: 'image',
    title,
    imageUrl: url,
    caption,
    x: Math.max(20, x),
    y: Math.max(20, y),
    width: 320,
    height: 240,
    color: 'amber',
    zIndex: (canvasState.entities.length + 1) * 2
  };
  canvasState.entities.push(newImgEntity);
  console.log('[Trace][Canvas] Pushed image entity. Total:', canvasState.entities.length);
  renderCanvasEntities();
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
  closeModal('canvasAddImageModal');
  document.getElementById('newCanvasImageTitle').value = '';
  document.getElementById('newCanvasImageUrl').value = '';
  document.getElementById('newCanvasImageCaption').value = '';
}

function openBackdropSettingsModal() {
  const modal = document.getElementById('canvasBackdropModal');
  if (modal) {
    const globalImg = document.getElementById('globalBackdropImg');
    const currentUrl = (globalImg ? globalImg.src : '') || localStorage.getItem('vtm_global_backdrop') || '/images/elysium_backdrop.jpg';
    const input = document.getElementById('backdropUrlInput');
    if (input) input.value = currentUrl;
    const currentOpacity = localStorage.getItem('vtm_widget_opacity') || 82;
    const slider = document.getElementById('widgetOpacitySlider');
    if (slider) slider.value = currentOpacity;
    const valText = document.getElementById('widgetOpacityValueText');
    if (valText) valText.innerText = `${currentOpacity}%`;
    const currentBrightness = localStorage.getItem('vtm_backdrop_brightness') || 100;
    const bSlider = document.getElementById('backdropBrightnessSlider');
    if (bSlider) bSlider.value = currentBrightness;
    const bValText = document.getElementById('backdropBrightnessValueText');
    if (bValText) bValText.innerText = `${currentBrightness}%`;
    const uploadStatus = document.getElementById('backdropUploadStatus');
    if (uploadStatus) uploadStatus.style.display = 'none';
    modal.classList.add('active');
  }
}

function updateWidgetOpacity(val) {
  const pct = parseInt(val, 10);
  const alpha = (pct / 100).toFixed(2);
  document.documentElement.style.setProperty('--widget-opacity', alpha);
  const valText = document.getElementById('widgetOpacityValueText');
  if (valText) valText.innerText = `${pct}%`;
  const slider = document.getElementById('widgetOpacitySlider');
  if (slider) slider.value = pct;
  localStorage.setItem('vtm_widget_opacity', pct);
}

function setWidgetOpacityPreset(val) {
  updateWidgetOpacity(val);
}

function updateBackdropBrightness(val) {
  const pct = parseInt(val, 10);
  const alpha = (pct / 100).toFixed(2);
  document.documentElement.style.setProperty('--backdrop-brightness', alpha);
  const valText = document.getElementById('backdropBrightnessValueText');
  if (valText) valText.innerText = `${pct}%`;
  const slider = document.getElementById('backdropBrightnessSlider');
  if (slider) slider.value = pct;
  localStorage.setItem('vtm_backdrop_brightness', pct);
}

function setBackdropBrightnessPreset(val) {
  updateBackdropBrightness(val);
}

async function uploadImageFile(file, statusEl) {
  if (!file) return null;
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.style.color = '#ef4444';
    statusEl.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading ${escapeHtml(file.name)}...`;
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await authFetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            data: reader.result,
            filename: file.name
          })
        });
        const data = await res.json();
        if (res.ok && data.success && data.url) {
          if (statusEl) {
            statusEl.style.color = '#10b981';
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> Image uploaded successfully!`;
          }
          resolve(data.url);
        } else {
          const err = data.error || 'Upload failed.';
          if (statusEl) {
            statusEl.style.color = '#ef4444';
            statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(err)}`;
          }
          reject(new Error(err));
        }
      } catch (err) {
        if (statusEl) {
          statusEl.style.color = '#ef4444';
          statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Network error during upload.`;
        }
        reject(err);
      }
    };
    reader.onerror = () => {
      if (statusEl) {
        statusEl.style.color = '#ef4444';
        statusEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Failed to read local file.`;
      }
      reject(new Error('Failed to read file'));
    };
    reader.readAsDataURL(file);
  });
}

async function handleBackdropFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('backdropUploadStatus');
  try {
    const url = await uploadImageFile(file, statusEl);
    if (url) {
      const input = document.getElementById('backdropUrlInput');
      if (input) input.value = url;
      const globalImg = document.getElementById('globalBackdropImg');
      if (globalImg) globalImg.src = url;
      localStorage.setItem('vtm_global_backdrop', url);
    }
  } catch (err) {
    console.error('Backdrop upload failed:', err);
  }
}

async function handleCanvasImageFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('canvasImageUploadStatus');
  try {
    const url = await uploadImageFile(file, statusEl);
    if (url) {
      const urlInput = document.getElementById('newCanvasImageUrl');
      if (urlInput) urlInput.value = url;
      const titleInput = document.getElementById('newCanvasImageTitle');
      if (titleInput && !titleInput.value.trim()) {
        titleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
    }
  } catch (err) {
    console.error('Canvas image upload failed:', err);
  }
}

async function handleGameboardMapUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  try {
    const url = await uploadImageFile(file, null);
    if (url) {
      switchGameboardMap(url);
      const sel = document.getElementById('episodeMapSelector');
      if (sel) {
        const opt = document.createElement('option');
        opt.value = url;
        opt.innerText = `Custom Map: ${file.name.replace(/\.[^/.]+$/, '')}`;
        opt.selected = true;
        sel.prepend(opt);
      }
      if ((activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') && activeCampaignId) {
        authFetch('/api/gameboard/map', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chronicle_id: activeCampaignId,
            map_url: url
          })
        });
      }
    }
  } catch (err) {
    console.error('Gameboard map upload failed:', err);
    alert('Failed to upload map: ' + err.message);
  }
}

function setBackdropPreset(url) {
  const input = document.getElementById('backdropUrlInput');
  if (input) input.value = url;
  saveCanvasBackdropSubmit();
}

function saveCanvasBackdropSubmit() {
  const url = document.getElementById('backdropUrlInput').value.trim();
  if (!url) return;
  const globalImg = document.getElementById('globalBackdropImg');
  if (globalImg) globalImg.src = url;
  localStorage.setItem('vtm_global_backdrop', url);
  closeModal('canvasBackdropModal');
}

function switchGameboardMap(url) {
  if (!url) return;
  const mapImg = document.getElementById('canvasBackdropImg');
  if (mapImg) mapImg.src = url;
  canvasState.backdrop = url;
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}

function populateEpisodeMaps(scenes) {
  const sel = document.getElementById('episodeMapSelector');
  if (!sel) return;
  sel.innerHTML = `
        <option value="/images/concept_map.jpg">London Tactical Street Map</option>
        <option value="/images/tactical_london_map.jpg">Greater London Overview</option>
        <option value="/images/banner_1200x400.jpg">Highway 31W Crime Scene</option>
    `;
  if (Array.isArray(scenes)) {
    scenes.forEach((s, idx) => {
      const mapUrl = s.banner || s.map_url;
      if (mapUrl) {
        const opt = document.createElement('option');
        opt.value = mapUrl;
        opt.innerText = `Scene ${idx + 1}: ${s.title || s.location || 'Tactical Scene'}`;
        sel.appendChild(opt);
      }
    });
  }
}

function handleEntityDragStart(e, entityId) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.classList.contains('fa-solid')) return;
  e.preventDefault();
  const entity = canvasState.entities.find(ent => ent.id === entityId);
  if (!entity) return;
  bringEntityToFront(entityId);
  activeDragEntity = {
    entity,
    startX: e.clientX,
    startY: e.clientY,
    initialX: entity.x,
    initialY: entity.y
  };
}

function handleEntityDragMove(e) {
  if (!activeDragEntity) return;
  const dx = (e.clientX - activeDragEntity.startX) / canvasTransform.zoom;
  const dy = (e.clientY - activeDragEntity.startY) / canvasTransform.zoom;
  activeDragEntity.entity.x = Math.round(activeDragEntity.initialX + dx);
  activeDragEntity.entity.y = Math.round(activeDragEntity.initialY + dy);
  const el = document.getElementById(`canvas-entity-${activeDragEntity.entity.id}`);
  if (el) {
    el.style.left = `${activeDragEntity.entity.x}px`;
    el.style.top = `${activeDragEntity.entity.y}px`;
  }
  renderSvgConnectors();
}

function handleEntityResizeStart(e, entityId) {
  e.preventDefault();
  e.stopPropagation();
  const entity = canvasState.entities.find(ent => ent.id === entityId);
  if (!entity) return;
  bringEntityToFront(entityId);
  activeResizeEntity = {
    entity,
    startX: e.clientX,
    startY: e.clientY,
    initialW: entity.width || 280,
    initialH: entity.height || 200
  };
}

function handleEntityResizeMove(e) {
  if (!activeResizeEntity) return;
  const dw = (e.clientX - activeResizeEntity.startX) / canvasTransform.zoom;
  const dh = (e.clientY - activeResizeEntity.startY) / canvasTransform.zoom;
  const newW = Math.max(180, Math.round(activeResizeEntity.initialW + dw));
  const newH = Math.max(120, Math.round(activeResizeEntity.initialH + dh));
  activeResizeEntity.entity.width = newW;
  activeResizeEntity.entity.height = newH;
  const el = document.getElementById(`canvas-entity-${activeResizeEntity.entity.id}`);
  if (el) {
    el.style.width = `${newW}px`;
    el.style.height = `${newH}px`;
  }
  renderSvgConnectors();
}

function bringEntityToFront(entityId) {
  const highestZ = canvasState.entities.reduce((max, ent) => Math.max(max, ent.zIndex || 10), 10);
  const entity = canvasState.entities.find(ent => ent.id === entityId);
  if (entity) {
    entity.zIndex = highestZ + 1;
    const el = document.getElementById(`canvas-entity-${entityId}`);
    if (el) el.style.zIndex = entity.zIndex;
  }
}

function updateEntityTitle(id, val) {
  const ent = canvasState.entities.find(e => e.id === id);
  if (ent) {
    ent.title = val;
    debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  }
}

function updateEntityContent(id, val) {
  const ent = canvasState.entities.find(e => e.id === id);
  if (ent) {
    ent.content = val;
    debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  }
}

function updateEntityCaption(id, val) {
  const ent = canvasState.entities.find(e => e.id === id);
  if (ent) {
    ent.caption = val;
    debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  }
}

function cycleEntityColor(id) {
  const ent = canvasState.entities.find(e => e.id === id);
  if (!ent) return;
  const currentIndex = CARD_COLOR_THEMES.findIndex(t => t.name === ent.color);
  const nextTheme = CARD_COLOR_THEMES[(currentIndex + 1) % CARD_COLOR_THEMES.length];
  ent.color = nextTheme.name;
  const el = document.getElementById(`canvas-entity-${id}`);
  if (el) {
    el.style.borderColor = nextTheme.border;
    el.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${nextTheme.glow}`;
    const icon = el.querySelector('.card-icon');
    if (icon) icon.style.color = nextTheme.accent;
  }
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}

function cycleEntityFontSize(id) {
  const ent = canvasState.entities.find(e => e.id === id);
  if (!ent) return;
  const currentIndex = FONT_SIZE_STEPS.indexOf(ent.fontSize || '14px');
  const nextSize = FONT_SIZE_STEPS[(currentIndex + 1) % FONT_SIZE_STEPS.length];
  ent.fontSize = nextSize;
  const el = document.getElementById(`canvas-entity-${id}`);
  if (el) {
    const editor = el.querySelector('.card-text-editor');
    if (editor) editor.style.fontSize = nextSize;
  }
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}

function deleteCanvasEntity(id) {
  canvasState.entities = canvasState.entities.filter(e => e.id !== id);
  canvasState.links = canvasState.links.filter(l => l.from !== id && l.to !== id);
  renderCanvasEntities();
  renderSvgConnectors();
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}

function toggleLinkMode(entityId) {
  if (!linkingSourceEntityId) {
    linkingSourceEntityId = entityId;
    renderCanvasEntities();
  } else if (linkingSourceEntityId === entityId) {
    linkingSourceEntityId = null;
    renderCanvasEntities();
  } else {
    if (!canvasState) canvasState = {
      backdrop: '',
      entities: [],
      links: []
    };
    if (!canvasState.links || !Array.isArray(canvasState.links)) canvasState.links = [];
    if (!canvasState.entities || !Array.isArray(canvasState.entities)) canvasState.entities = [];
    const existingIndex = canvasState.links.findIndex(l => l.from === linkingSourceEntityId && l.to === entityId || l.from === entityId && l.to === linkingSourceEntityId);
    if (existingIndex >= 0) {
      canvasState.links.splice(existingIndex, 1);
    } else {
      canvasState.links.push({
        from: linkingSourceEntityId,
        to: entityId,
        color: '#ef4444'
      });
      console.log('[Trace][Canvas] Pushed new link. Total:', canvasState.links.length);
    }
    linkingSourceEntityId = null;
    renderCanvasEntities();
    renderSvgConnectors();
    debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  }
}

function renderSvgConnectors() {
  const svg = document.getElementById('canvasSvgOverlay');
  if (!svg) return;
  svg.innerHTML = '';
  if (!canvasState.links || canvasState.links.length === 0) return;
  canvasState.links.forEach(link => {
    const source = canvasState.entities.find(e => e.id === link.from);
    const target = canvasState.entities.find(e => e.id === link.to);
    if (!source || !target) return;
    const x1 = source.x + (source.width || 280) / 2;
    const y1 = source.y + (source.height || 200) / 2;
    const x2 = target.x + (target.width || 280) / 2;
    const y2 = target.y + (target.height || 200) / 2;
    const dx = (x2 - x1) * 0.4;
    const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', link.color || '#ef4444');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-dasharray', '6 3');
    path.style.filter = 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.7))';
    svg.appendChild(path);
  });
}

function debouncedSaveCanvasState() {
  if (saveCanvasTimeout) clearTimeout(saveCanvasTimeout);
  saveCanvasTimeout = setTimeout(() => {
    if (!activeCampaignId) return;
    authFetch('/api/gameboard/canvas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicle_id: activeCampaignId,
        canvas_state: canvasState
      })
    }).catch(err => console.error('Failed to sync canvas state:', err));
  }, 600);
}

function initFloatingChatDraggable() {
  const handle = document.getElementById('glassChatDragHandle');
  const chatBox = document.getElementById('floatingGlassChat');
  if (!handle || !chatBox) return;
  handle.onmousedown = e => {
    if (e.target.tagName === 'BUTTON' || e.target.classList.contains('btn-chat-min')) return;
    isChatDragging = true;
    const rect = chatBox.getBoundingClientRect();
    chatDragOffset.x = e.clientX - rect.left;
    chatDragOffset.y = e.clientY - rect.top;
  };
}

function handleChatDragMove(e) {
  if (!isChatDragging) return;
  const chatBox = document.getElementById('floatingGlassChat');
  if (!chatBox) return;
  const viewport = document.getElementById('canvasViewport');
  const vpRect = viewport ? viewport.getBoundingClientRect() : {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight
  };
  const newLeft = Math.max(10, Math.min(e.clientX - vpRect.left - chatDragOffset.x, vpRect.width - 380));
  const newTop = Math.max(10, Math.min(e.clientY - vpRect.top - chatDragOffset.y, vpRect.height - 60));
  chatBox.style.left = `${newLeft}px`;
  chatBox.style.top = `${newTop}px`;
  chatBox.style.right = 'auto';
}

function toggleChatCollapse() {
  const chatBox = document.getElementById('floatingGlassChat');
  if (chatBox) chatBox.classList.toggle('minimized');
}

function toggleChatVisibility() {
  const chatBox = document.getElementById('floatingGlassChat');
  if (!chatBox) return;
  if (chatBox.style.display === 'none') {
    chatBox.style.display = 'flex';
  } else {
    chatBox.style.display = 'none';
  }
}

function switchChatChannel(ch) {
  currentChatChannel = ch;
  document.querySelectorAll('.chat-tab-btn').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.getElementById(`chatTab-${ch}`);
  if (targetBtn) targetBtn.classList.add('active');
  const items = document.querySelectorAll('.chat-msg-entry');
  items.forEach(el => {
    if (ch === 'all' || el.dataset.channel === ch) {
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  });
  const inputBar = document.getElementById('chatInputBar') || document.querySelector('.chat-input-bar');
  const rollsNotice = document.getElementById('chatRollsNotice');
  if (ch === 'rolls') {
    if (inputBar) inputBar.style.display = 'none';
    if (rollsNotice) rollsNotice.style.display = 'flex';
  } else {
    if (inputBar) inputBar.style.display = 'flex';
    if (rollsNotice) rollsNotice.style.display = 'none';
  }
  const stream = document.getElementById('chatMessagesStream');
  if (stream) stream.scrollTop = stream.scrollHeight;
}

function updateChatSenderBadge() {
  const label = document.getElementById('chatSenderLabel');
  if (!label) return;
  if (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') {
    const personaSel = document.getElementById('gmPersonaSelect');
    const persona = personaSel ? personaSel.value : 'Storyteller';
    label.innerText = `Speaking as: ${persona}`;
  } else {
    const name = currentUser && (currentUser.displayName || currentUser.username) || 'Player';
    label.innerText = `Speaking as: ${name}`;
  }
}

async function loadChatMessages() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/chat/messages?campaign_id=${activeCampaignId}`);
    if (!res.ok) return;
    const messages = await res.json();
    const stream = document.getElementById('chatMessagesStream');
    if (!stream) return;
    stream.innerHTML = '';
    messages.forEach(m => appendChatMessage(m, false));
    stream.scrollTop = stream.scrollHeight;
  } catch (err) {
    console.error('Failed to load chat messages:', err);
  }
}

async function sendChatMessageSubmit(e) {
  e.preventDefault();
  if (currentChatChannel === 'rolls') return;
  const input = document.getElementById('chatInputText');
  const msgText = input.value.trim();
  if (!msgText || !activeCampaignId) return;
  let senderName = currentUser ? currentUser.displayName || currentUser.username : 'Wanderer';
  if (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') {
    const personaSel = document.getElementById('gmPersonaSelect');
    if (personaSel && personaSel.value) senderName = personaSel.value;
  }
  try {
    const res = await authFetch('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicle_id: activeCampaignId,
        channel: currentChatChannel,
        sender_name: senderName,
        sender_role: activeCampaignRole,
        message: msgText
      })
    });
    if (res.ok) {
      input.value = '';
    }
  } catch (err) {
    console.error('Failed to send chat message:', err);
  }
}

function appendChatMessage(msg, scroll = true) {
  const stream = document.getElementById('chatMessagesStream');
  if (!stream) return;
  const entry = document.createElement('div');
  entry.className = `chat-msg-entry channel-${msg.channel}`;
  entry.dataset.channel = msg.channel;
  const isCurrentChannel = currentChatChannel === 'all' || currentChatChannel === msg.channel;
  if (!isCurrentChannel) {
    entry.style.display = 'none';
  }
  const timeStr = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';
  const isGm = msg.sender_role === 'gm';
  const roleTag = isGm ? '<span class="chat-role-gm">GM</span>' : '';
  entry.innerHTML = `
        <div class="chat-msg-header">
            <span class="chat-msg-author ${isGm ? 'author-gm' : ''}">${roleTag} ${escapeHtml(msg.sender_name)}</span>
            <span class="chat-msg-time">${timeStr}</span>
        </div>
        <div class="chat-msg-text">${escapeHtml(msg.message)}</div>
    `;
  stream.appendChild(entry);
  if (scroll) stream.scrollTop = stream.scrollHeight;
}

function toggleFloatingDiceTray() {
  const modal = document.getElementById('floatingDiceModal');
  if (modal) modal.classList.toggle('active');
}

function toggleFloatingClueMatrix() {
  const modal = document.getElementById('floatingClueMatrixModal');
  if (modal) modal.classList.toggle('active');
}

function switchMatrixModalTab(tab) {
  const cluesView = document.getElementById('matrixModalCluesView');
  const loreView = document.getElementById('matrixModalLoreView');
  const cluesTab = document.getElementById('matrixTab-clues');
  const loreTab = document.getElementById('matrixTab-lore');
  if (tab === 'clues') {
    if (cluesView) cluesView.style.display = 'block';
    if (loreView) loreView.style.display = 'none';
    if (cluesTab) cluesTab.classList.add('active');
    if (loreTab) loreTab.classList.remove('active');
  } else {
    if (cluesView) cluesView.style.display = 'none';
    if (loreView) loreView.style.display = 'block';
    if (cluesTab) cluesTab.classList.remove('active');
    if (loreTab) loreTab.classList.add('active');
  }
}

async function openMyCharacterDossier() {
  if (!activeCampaignId) return alert('Please enter a chronicle first.');
  try {
    const res = await authFetch(`/api/characters?campaign_id=${activeCampaignId}&_t=${Date.now()}`);
    if (!res.ok) return;
    const chars = await res.json();
    const myChar = chars.find(c => currentUser && c.user_id === currentUser.id);
    if (myChar) {
      openCharacterSheet(myChar.id, myChar.name, myChar.clan, myChar.user_id, myChar.player_name);
    } else {
      switchTab('characters');
    }
  } catch (err) {
    console.error('Failed to open dossier:', err);
  }
}

async function adjustDossierVitals(type, delta, charId = currentLoadedCharacterId) {
  if (!charId) return;
  const char = campaignCharactersList.find(c => c.id === charId);
  if (!char) return;
  try {
    const res = await authFetch(`/api/characters/${char.id}/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        delta
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Object.assign(char, data);
      if (data.sheet_data) char.sheet_data = data.sheet_data;
      if (currentLoadedCharacterId === char.id) {
        updateDossierWidget(char, 'widget-dossier');
      }
      if (document.getElementById('widget-dossier-' + char.id)) {
        updateDossierWidget(char, 'widget-dossier-' + char.id);
      }
      syncOpenSheetIframe(char);
    } else {
      console.error('Failed to update vitals:', data.error);
      alert('Widget Save Failed: ' + data.error);
    }
  } catch (err) {
    console.error('Error updating vitals:', err);
    alert('Network error while updating vitals.');
  }
}

function syncOpenSheetIframe(char) {
  const iframe = document.getElementById('sheetFrame');
  if (iframe && iframe.contentWindow && currentLoadedCharacterId === char.id) {
    iframe.contentWindow.postMessage({
      type: 'vtm:sync_sheet',
      char_id: char.id,
      char: char,
      sheet_data: char.sheet_data
    }, '*');
  }
}

async function adjustDossierCapacity(tracker, delta) {
  if (!currentLoadedCharacterId) return;
  const char = campaignCharactersList.find(c => c.id === currentLoadedCharacterId);
  if (!char) return;
  const sheet = typeof char.sheet_data === 'object' && char.sheet_data !== null ? char.sheet_data : {};
  let currentCap = tracker === 'health' ? char.health_max || sheet.health_max || Number(sheet.stamina || 2) + 3 : char.willpower_max || sheet.willpower_max || Number(sheet.composure || 3) + Number(sheet.resolve || 2);
  let newCap = Math.max(1, Math.min(10, currentCap + delta));
  if (newCap === currentCap) return;
  
  let states = Array.isArray(sheet[tracker + '_states']) ? [...sheet[tracker + '_states']] : Array(10).fill('empty');
  
  try {
    const res = await authFetch(`/api/characters/${char.id}/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tracker,
        capacity: newCap,
        states: states
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Object.assign(char, data);
      if (data.sheet_data) char.sheet_data = data.sheet_data;
      updateDossierWidget(char);
      syncOpenSheetIframe(char);
    } else {
      alert('Widget save rejected by server.');
    }
  } catch (err) {
    console.error('Error adjusting capacity:', err);
    alert('Network error while adjusting capacity.');
  }
}

function clickDossierHunger(targetVal) {
  if (!currentLoadedCharacterId) return;
  const char = campaignCharactersList.find(c => c.id === currentLoadedCharacterId);
  if (!char) return;
  let currentH = char.hunger !== undefined ? Number(char.hunger) : 1;
  let newH = targetVal;
  if (currentH === targetVal) {
    newH = targetVal - 1;
  }
  setDossierPip('hunger', newH);
}

async function cycleDossierDamagePip(tracker, index, charId = currentLoadedCharacterId) {
  if (!charId) return;
  const char = campaignCharactersList.find(c => c.id === charId);
  if (!char) return;
  
  // We need to bypass the strict permissions check for testing, but let's just make sure it works!
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
  const isOwner = currentUser && currentUser.id === char.user_id;
  const authList = Array.isArray(char.authorized_user_ids) ? char.authorized_user_ids : [];
  const isAuth = currentUser && authList.includes(currentUser.id);
  if (!isGM && !isOwner && !isAuth) {
    alert("You do not have permission to edit this character's vitals.");
    return;
  }
  
  const sheet = typeof char.sheet_data === 'object' && char.sheet_data !== null ? char.sheet_data : {};
  let states = Array.isArray(sheet[tracker + '_states']) ? [...sheet[tracker + '_states']] : null;
  
  if (!states || states.length !== 10) {
    states = Array(10).fill('empty');
    if (tracker === 'health') {
      const hMax = sheet.health_max || Number(sheet.stamina || 2) + 3;
      const agg = Number(char.health_aggravated || 0);
      const sup = Number(char.health_superficial || 0);
      for (let i = 0; i < 10; i++) {
        if (i >= hMax) states[i] = 'filled';
        else if (i < agg) states[i] = 'aggravated';
        else if (i < agg + sup) states[i] = 'superficial';
        else states[i] = 'empty';
      }
    } else if (tracker === 'willpower') {
      const wMax = sheet.willpower_max || Number(sheet.composure || 3) + Number(sheet.resolve || 2);
      const agg = Number(char.willpower_aggravated || 0);
      const sup = Number(char.willpower_superficial || 0);
      for (let i = 0; i < 10; i++) {
        if (i >= wMax) states[i] = 'filled';
        else if (i < agg) states[i] = 'aggravated';
        else if (i < agg + sup) states[i] = 'superficial';
        else states[i] = 'empty';
      }
    } else if (tracker === 'humanity') {
      const humanity = char.humanity !== undefined ? Number(char.humanity) : 7;
      const stains = sheet.stains !== undefined ? Number(sheet.stains) : 0;
      for (let i = 0; i < 10; i++) {
        if (i < humanity) states[i] = 'filled'; else if (i >= 10 - stains) states[i] = 'superficial';
      }
    }
  }

  // Look for the base state! But since the widget doesn't store base state in DOM cleanly, 
  // we just assume the first X are filled based on capacity!
  const curr = states[index] || 'empty';
  
  let capacity = 10;
  if (tracker === 'health') capacity = sheet.health_max || Number(sheet.stamina || 2) + 3;
  if (tracker === 'willpower') capacity = sheet.willpower_max || Number(sheet.composure || 3) + Number(sheet.resolve || 2);
  if (tracker === 'humanity') capacity = char.humanity !== undefined ? Number(char.humanity) : 7;
  
  let baseState = 'empty';
  if (tracker === 'humanity') {
    baseState = index < capacity ? 'filled' : 'empty';
  } else {
    baseState = index < capacity ? 'empty' : 'filled';
  }

  if (curr === 'empty' || curr === 'filled') {
    states[index] = 'superficial';
  } else if (curr === 'superficial') {
    states[index] = tracker === 'humanity' ? baseState : 'aggravated';
  } else {
    states[index] = baseState;
  }
  
  try {
    const res = await authFetch(`/api/characters/${char.id}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracker, states })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Object.assign(char, data);
      if (data.sheet_data) char.sheet_data = data.sheet_data;
      if (currentLoadedCharacterId === char.id) {
        updateDossierWidget(char, 'widget-dossier');
      }
      if (document.getElementById('widget-dossier-' + char.id)) {
        updateDossierWidget(char, 'widget-dossier-' + char.id);
      }
      if (typeof syncOpenSheetIframe === 'function') syncOpenSheetIframe(char);
    } else {
      alert('Widget save rejected by server.');
    }
  } catch (err) {
    console.error('Error toggling damage pip:', err);
    alert('Network error while toggling damage pip.');
  }
}

async function setDossierPip(tracker, val) {
  if (!currentLoadedCharacterId) return;
  const char = campaignCharactersList.find(c => c.id === currentLoadedCharacterId);
  if (!char) return;
  try {
    const payload = tracker === 'hunger' ? {
      hunger: val
    } : {
      humanity: val
    };
    const res = await authFetch(`/api/characters/${char.id}/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok && data.success) {
      Object.assign(char, data);
      if (data.sheet_data) char.sheet_data = data.sheet_data;
      updateDossierWidget(char);
      syncOpenSheetIframe(char);
    } else {
      alert('Widget save rejected by server.');
    }
  } catch (err) {
    console.error('Error setting pip:', err);
    alert('Network error while setting pip.');
  }
}

async function toggleDossierHumanityPip(index) {
  if (!currentLoadedCharacterId) return;
  const char = campaignCharactersList.find(c => c.id === currentLoadedCharacterId);
  if (!char) return;
  const currentH = char.humanity !== undefined ? Number(char.humanity) : 7;
  if (index < currentH) {
    return;
  }
  adjustDossierVitals('stain', 1);
}

function updateDossierWidget(char, containerId = 'widget-dossier') {
  try {
    if (!char) return;
    if (containerId === 'widget-dossier') {
      currentLoadedCharacterId = char.id;
    }
    const suffix = containerId === 'widget-dossier' ? '' : `-${char.id}`;
    const getEl = (id) => document.getElementById(id + suffix);

    const nameEl = getEl('dossierCharName');
    if (nameEl) nameEl.innerText = char.name || 'Unknown Kindred';
    const titleEl = getEl('dossierWidgetTitle');
    if (titleEl) titleEl.innerText = `${char.name.toUpperCase()}'S DOSSIER`;
    
    const isGM_d = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
    const isOwner_d = currentUser && currentUser.id === char.user_id;
    const authList_d = Array.isArray(char.authorized_user_ids) ? char.authorized_user_ids : [];
    const isAuth_d = currentUser && authList_d.includes(currentUser.id);
    const canEdit_d = isGM_d || isOwner_d || isAuth_d;
    
    let concealed = [];
    if (char.concealed_fields) {
      try {
        concealed = typeof char.concealed_fields === 'string' ? JSON.parse(char.concealed_fields) : char.concealed_fields;
        if (!Array.isArray(concealed)) concealed = [];
      } catch(e) {}
    }

    const clanEl = getEl('dossierClan');
    if (clanEl) clanEl.innerText = (!canEdit_d && (concealed.includes('section_profile') || concealed.includes('clan'))) ? '[REDACTED]' : (char.clan || 'Unknown');
    const pathEl = getEl('dossierPath');
    if (pathEl) {
      if (!canEdit_d && (concealed.includes('section_profile') || concealed.includes('concept'))) {
        pathEl.innerText = '[REDACTED]';
      } else {
        pathEl.innerText = char.concept ? `${char.concept}` : `Humanity (${char.humanity || 7})`;
      }
    }
    const avatarEl = getEl('dossierAvatarImg');
    const avatarSrc = char.avatar_url && !char.avatar_url.includes('bg_page_1.png') ? char.avatar_url : '/images/caine_portrait.jpg?v=2';
    if (avatarEl) avatarEl.src = avatarSrc;
    const ownerEl = getEl('dossierPlayerOwner');
    if (ownerEl) {
      if (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') {
        let catOptions = `<option value="Uncategorized">Uncategorized</option>`;
        (typeof npcCategoriesList !== 'undefined' && npcCategoriesList ? npcCategoriesList : []).forEach(cat => {
          const selected = char.category === cat.name ? 'selected' : '';
          catOptions += `<option value="${escapeHtml(cat.name)}" ${selected}>${escapeHtml(cat.name)}</option>`;
        });
        ownerEl.innerHTML = `<select onchange="updateCharacterCategory(${char.id}, this.value)" style="background:transparent; color:#9ca3af; border:1px solid #4b5563; border-radius:3px; padding:2px 4px; font-size:11px; outline:none;">
                ${catOptions}
            </select>`;
      } else {
        ownerEl.innerText = char.player_name || (char.category === 'pc' ? 'Unassigned' : 'NPC / Storyteller');
      }
      const assumeWrap = getEl('dossierAssumeControlWrap');
      if (assumeWrap) {
        const authList = Array.isArray(char.authorized_user_ids) ? char.authorized_user_ids : [];
        const isMine = currentUser && (char.user_id === currentUser.id || authList.includes(currentUser.id));
        const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
        const isCurrentlyActive = activeControlledCharacterId === char.id;
        if ((isMine || isGM) && !isCurrentlyActive) {
          assumeWrap.style.display = 'block';
        } else {
          assumeWrap.style.display = 'none';
        }
      }
        const sheet = typeof char.sheet_data === 'object' && char.sheet_data !== null ? char.sheet_data : {};
        const hunger = char.hunger !== undefined ? Number(char.hunger) : 1;
        const hungerVal = getEl('dossierHungerVal');
        if (hungerVal) hungerVal.innerText = `${hunger} / 5`;
        const hungerPips = getEl('dossierHungerPips');
        if (hungerPips) {
          hungerPips.innerHTML = Array(5).fill(0).map((_, i) => {
            const isFilled = i < hunger;
            return `<div class="dossier-pip ${isFilled ? 'pip-hunger' : 'pip-empty'}" onclick="clickDossierHunger(${i + 1})" title="Hunger ${i + 1} (Click to set 1..${i + 1})">${isFilled ? '' : ''}</div>`;
          }).join('');
        }
        const stamina = Number(sheet.stamina || sheet.attributes && sheet.attributes.stamina || 2);
        let fort = 0;
        if (sheet.disciplines && sheet.disciplines.Fortitude) fort = Number(sheet.disciplines.Fortitude);
        const maxHp = char.health_max || sheet.health_max || Math.min(10, Math.max(3, stamina + 3 + fort));
        const hpAgg = char.health_aggravated || 0;
        const hpSuper = char.health_superficial || 0;
        const remainingHp = Math.max(0, maxHp - hpSuper - hpAgg);
        const hpVal = getEl('dossierHealthVal');
        if (hpVal) hpVal.innerText = `${maxHp}`;
        const hpPips = getEl('dossierHealthPips');
        if (hpPips) {
          let hStates = sheet.health_states && Array.isArray(sheet.health_states) && sheet.health_states.length === 10 ? sheet.health_states : Array(10).fill('empty').map((_, i) => {
            if (i >= maxHp) return 'filled';
            if (i < hpAgg) return 'aggravated';
            if (i < hpAgg + hpSuper) return 'superficial';
            return 'empty';
          });
          hpPips.innerHTML = hStates.map((st, i) => {
            if (st === 'aggravated') {
              return `<div class="dossier-pip pip-aggravated" onclick="cycleDossierDamagePip('health', ${i}, ${char.id})" title="Aggravated Damage (Click to clear)">X</div>`;
            } else if (st === 'superficial') {
              return `<div class="dossier-pip pip-superficial" onclick="cycleDossierDamagePip('health', ${i}, ${char.id})" title="Superficial Damage (Click to upgrade)">/</div>`;
            } else if (st === 'filled') {
              return `<div class="dossier-pip pip-black" onclick="cycleDossierDamagePip('health', ${i}, ${char.id})" title="Beyond Max Health (Click to override)"></div>`;
            } else {
              return `<div class="dossier-pip pip-empty" onclick="cycleDossierDamagePip('health', ${i}, ${char.id})" title="Unharmed (Click to mark damage)"></div>`;
            }
          }).join('');
        }
        const comp = Number(sheet.composure || sheet.attributes && sheet.attributes.composure || 3);
        const res = Number(sheet.resolve || sheet.attributes && sheet.attributes.resolve || 2);
        const maxWp = char.willpower_max || sheet.willpower_max || Math.min(10, Math.max(2, comp + res));
        const wpAgg = char.willpower_aggravated || 0;
        const wpSuper = char.willpower_superficial || 0;
        const remainingWp = Math.max(0, maxWp - wpSuper - wpAgg);
        const wpVal = getEl('dossierWpVal');
        if (wpVal) wpVal.innerText = `${maxWp}`;
        const wpPips = getEl('dossierWpPips');
        if (wpPips) {
          let wStates = sheet.willpower_states && Array.isArray(sheet.willpower_states) && sheet.willpower_states.length === 10 ? sheet.willpower_states : Array(10).fill('empty').map((_, i) => {
            if (i >= maxWp) return 'filled';
            if (i < wpAgg) return 'aggravated';
            if (i < wpAgg + wpSuper) return 'superficial';
            return 'empty';
          });
          wpPips.innerHTML = wStates.map((st, i) => {
            if (st === 'aggravated') {
              return `<div class="dossier-pip pip-aggravated" onclick="cycleDossierDamagePip('willpower', ${i}, ${char.id})" title="Aggravated Willpower">X</div>`;
            } else if (st === 'superficial') {
              return `<div class="dossier-pip pip-superficial" onclick="cycleDossierDamagePip('willpower', ${i}, ${char.id})" title="Superficial Willpower">/</div>`;
            } else if (st === 'filled') {
              return `<div class="dossier-pip pip-black" onclick="cycleDossierDamagePip('willpower', ${i}, ${char.id})" title="Beyond Max Willpower (Click to override)"></div>`;
            } else {
              return `<div class="dossier-pip pip-empty" onclick="cycleDossierDamagePip('willpower', ${i}, ${char.id})" title="Unspent"></div>`;
            }
          }).join('');
        }
        const humanity = char.humanity !== undefined ? Number(char.humanity) : 7;
        const stains = sheet.stains !== undefined ? Number(sheet.stains) : 0;
        const humanityVal = getEl('dossierHumanityVal');
        if (humanityVal) humanityVal.innerText = `${humanity} / 10`;
        const stainsVal = getEl('dossierStainsVal');
        if (stainsVal) stainsVal.innerText = `${stains}`;
        const humanityPips = getEl('dossierHumanityPips');
        if (humanityPips) {
          let humStates = sheet.humanity_states && Array.isArray(sheet.humanity_states) && sheet.humanity_states.length === 10 ? sheet.humanity_states : Array(10).fill('empty').map((_, i) => {
            if (i < humanity) return 'filled';
            if (i >= 10 - stains) return 'superficial';
            return 'empty';
          });
          humanityPips.innerHTML = humStates.map((st, i) => {
            if (st === 'aggravated') {
              return `<div class="dossier-pip pip-aggravated" onclick="cycleDossierDamagePip('humanity', ${i}, ${char.id})" title="Aggravated Damage">X</div>`;
            } else if (st === 'superficial') {
              return `<div class="dossier-pip pip-stain" onclick="cycleDossierDamagePip('humanity', ${i}, ${char.id})" title="Stain (Click to upgrade)">/</div>`;
            } else if (st === 'filled') {
              return `<div class="dossier-pip pip-humanity" onclick="cycleDossierDamagePip('humanity', ${i}, ${char.id})" title="Humanity Rating (Click to override)"></div>`;
            } else {
              return `<div class="dossier-pip pip-empty" onclick="cycleDossierDamagePip('humanity', ${i}, ${char.id})" title="Empty Box"></div>`;
            }
          }).join('');
        }
        const statsContainer = getEl('dossierStatsContainer');
        if (statsContainer) {
          const getAttr = (key, fallback = 2) => {
            if (sheet[key] !== undefined && sheet[key] !== null) return Number(sheet[key]);
            if (sheet.attributes && sheet.attributes[key] !== undefined && sheet.attributes[key] !== null) return Number(sheet.attributes[key]);
            return fallback;
          };
          const str = getAttr('strength', 2);
          const dex = getAttr('dexterity', 3);
          const sta = getAttr('stamina', 2);
          const cha = getAttr('charisma', 3);
          const man = getAttr('manipulation', 3);
          const com = getAttr('composure', 3);
          const int = getAttr('intelligence', 2);
          const wit = getAttr('wits', 3);
          const res = getAttr('resolve', 2);
          statsContainer.innerHTML = `
            <div class="dossier-attrs-grid">
                <div class="attr-col">
                    <span class="attr-col-hdr">Physical</span>
                    <div class="attr-micro-row"><span>Strength</span><strong>${str}</strong></div>
                    <div class="attr-micro-row"><span>Dexterity</span><strong>${dex}</strong></div>
                    <div class="attr-micro-row"><span>Stamina</span><strong>${sta}</strong></div>
                </div>
                <div class="attr-col">
                    <span class="attr-col-hdr">Social</span>
                    <div class="attr-micro-row"><span>Charisma</span><strong>${cha}</strong></div>
                    <div class="attr-micro-row"><span>Manipulation</span><strong>${man}</strong></div>
                    <div class="attr-micro-row"><span>Composure</span><strong>${com}</strong></div>
                </div>
                <div class="attr-col">
                    <span class="attr-col-hdr">Mental</span>
                    <div class="attr-micro-row"><span>Intelligence</span><strong>${int}</strong></div>
                    <div class="attr-micro-row"><span>Wits</span><strong>${wit}</strong></div>
                    <div class="attr-micro-row"><span>Resolve</span><strong>${res}</strong></div>
                </div>
            </div>
        `;
        }
        const skillsContainer = getEl('dossierSkillsContainer');
        if (skillsContainer) {
          let skillList = [];
          const validSkills = ['athletics', 'brawl', 'craft', 'drive', 'firearms', 'larceny', 'melee', 'stealth', 'survival', 'animal_ken', 'etiquette', 'insight', 'intimidation', 'leadership', 'performance', 'persuasion', 'streetwise', 'subterfuge', 'academics', 'awareness', 'finance', 'investigation', 'medicine', 'occult', 'politics', 'science', 'technology'];
          for (const sk of validSkills) {
            let val = 0;
            if (sheet[sk] !== undefined && sheet[sk] !== null && sheet[sk] !== '') {
              val = Number(sheet[sk]);
            } else if (sheet.skills && typeof sheet.skills === 'object' && sheet.skills[sk] !== undefined && sheet.skills[sk] !== null) {
              val = Number(sheet.skills[sk]);
            }
            if (val > 0) {
              skillList.push({
                name: formatSkillLabel(sk),
                val
              });
            }
          }
          skillList.sort((a, b) => b.val - a.val);
          if (skillList.length === 0) {
            skillList = [{
              name: 'Persuasion',
              val: 4
            }, {
              name: 'Insight',
              val: 3
            }, {
              name: 'Stealth',
              val: 3
            }, {
              name: 'Subterfuge',
              val: 2
            }];
          }
          skillsContainer.innerHTML = skillList.slice(0, 6).map(s => `
            <div class="skill-chip">
                <span>${escapeHtml(s.name)}</span>
                <strong>${s.val}</strong>
            </div>
        `).join('');
        }
        const disciplinesContainer = getEl('dossierDisciplinesContainer');
        if (disciplinesContainer) {
          let discList = [];
          let foundFlatDisc = false;
          for (let i = 0; i < 6; i++) {
            const dName = sheet['discipline_name_' + i];
            const dDots = sheet['discipline_dots_' + i];
            if (dName && dName.trim() && dDots !== undefined) {
              foundFlatDisc = true;
              let powers = [];
              for (let p = 0; p < 5; p++) {
                let pwr = sheet['discipline_power_' + i + '_' + p];
                if (pwr && typeof pwr === 'string' && pwr.trim()) powers.push(pwr.trim());
              }
              discList.push({
                name: dName.trim(),
                level: Number(dDots),
                powers: powers
              });
            }
          }
          if (!foundFlatDisc && sheet.disciplines_full && Array.isArray(sheet.disciplines_full)) {
            discList = sheet.disciplines_full.filter(d => d && d.name && Number(d.level) > 0);
          } else if (!foundFlatDisc && sheet.disciplines && typeof sheet.disciplines === 'object') {
            for (const [name, lvl] of Object.entries(sheet.disciplines)) {
              if (Number(lvl) > 0) discList.push({
                name,
                level: Number(lvl),
                powers: []
              });
            }
          }
          if (discList.length === 0) {
            disciplinesContainer.innerHTML = '<div class="disc-no-powers" style="padding:10px; color:#aaa; font-style:italic;">No disciplines recorded</div>';
          } else {
            disciplinesContainer.innerHTML = discList.map(d => {
              const level = Math.min(5, Math.max(1, Number(d.level || 1)));
              const dots = ('&#x25CF;').repeat(level);
              const powers = d.powers && Array.isArray(d.powers) ? d.powers.filter(p => p && typeof p === 'string' && p.trim()) : [];
              const powersHtml = powers.length > 0 ? `<div class="disc-powers-list">${powers.map(p => `<div class="disc-power-item"><i class="fa-solid fa-angle-right"></i> <span>${escapeHtml(p)}</span></div>`).join('')}</div>` : '<div class="disc-no-powers">No powers cataloged</div>';
              return `
                    <div class="discipline-entry-card">
                        <div class="discipline-chip">
                            <span class="disc-name">${escapeHtml(d.name)}</span>
                            <span class="disc-dots">${dots}</span>
                        </div>
                        ${powersHtml}
                    </div>
                `;
            }).join('');
          }
        }
      }
  } catch (err) {
    console.error('CRITICAL WIDGET ERROR:', err);
  }
}

function formatSkillLabel(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function assumeActiveControlFromCurrentDossier() {
  if (currentLoadedCharacterId) {
    assumeActiveControl(currentLoadedCharacterId);
  }
}

async function loadCharacterDossierWidget(charId) {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/characters?campaign_id=${activeCampaignId}&_t=${Date.now()}`);
    if (!res.ok) return;
    const chars = await res.json();
    const char = chars.find(c => c.id === charId);
    if (char) updateDossierWidget(char);
  } catch (err) {
    console.error('Failed to load character dossier:', err);
  }
}

function openCurrentFullSheet() {
  if (currentLoadedCharacterId) {
    openFloatingCharacterSheet(currentLoadedCharacterId);
  } else {
    switchTab('characters');
  }
}

function toggleWidgetCollapse(widgetId) {
  const w = document.getElementById(widgetId);
  if (!w) return;
  const body = w.querySelector('.widget-body');
  if (!body) return;
  if (body.style.display === 'none') {
    body.style.display = '';
    w.style.minHeight = '';
  } else {
    body.style.display = 'none';
    w.style.minHeight = '38px';
  }
}

function toggleWidgetClose(widgetId) {
  const w = document.getElementById(widgetId);
  if (w) w.style.display = 'none';
}

function restoreWidget(widgetId) {
  const w = document.getElementById(widgetId);
  if (w) {
    w.style.display = 'flex';
    const body = w.querySelector('.widget-body');
    if (body) body.style.display = '';
    w.style.minHeight = '';
    bringDesktopWidgetToFront(w);
    if (widgetId === 'widget-clues') {
      setTimeout(() => renderClueCords(), 50);
    }
  }
  let highestDesktopWidgetZIndex = 50;
  let activeWidgetDrag = null;
  let activeWidgetResize = null;
  let desktopListenersAttached = false;
}

function bringDesktopWidgetToFront(widget) {
  if (!widget) return;
  highestDesktopWidgetZIndex++;
  widget.style.zIndex = highestDesktopWidgetZIndex;
}

function initDesktopWidgetsDragAndResize() {
  const desktop = document.getElementById('elysiumDesktop');
  if (!desktop) return;
  const widgets = desktop.querySelectorAll('.elysium-widget');
  widgets.forEach(w => {
    w.onmousedown = () => {
      bringDesktopWidgetToFront(w);
    };
    const header = w.querySelector('.widget-header');
    if (header) {
      header.onmousedown = e => {
        if (e.target.closest('button, input, select, a, textarea')) return;
        e.preventDefault();
        bringDesktopWidgetToFront(w);
        activeWidgetDrag = {
          widget: w,
          startX: e.clientX,
          startY: e.clientY,
          initialLeft: w.offsetLeft,
          initialTop: w.offsetTop
        };
      };
    }
    const resizeHandle = w.querySelector('.widget-resize-handle');
    if (resizeHandle) {
      resizeHandle.onmousedown = e => {
        e.preventDefault();
        e.stopPropagation();
        bringDesktopWidgetToFront(w);
        activeWidgetResize = {
          widget: w,
          startX: e.clientX,
          startY: e.clientY,
          initialWidth: w.offsetWidth,
          initialHeight: w.offsetHeight
        };
      };
    }
    if (!desktopListenersAttached) {
      desktopListenersAttached = true;
      window.addEventListener('mousemove', e => {
        if (activeWidgetDrag) {
          const dx = e.clientX - activeWidgetDrag.startX;
          const dy = e.clientY - activeWidgetDrag.startY;
          const newLeft = Math.max(0, activeWidgetDrag.initialLeft + dx);
          const newTop = Math.max(0, activeWidgetDrag.initialTop + dy);
          activeWidgetDrag.widget.style.left = `${newLeft}px`;
          activeWidgetDrag.widget.style.top = `${newTop}px`;
          if (activeWidgetDrag.widget.id === 'widget-clues' || activeWidgetDrag.widget.classList.contains('widget-matrix-popup')) {
            renderClueCords();
          }
        } else if (activeWidgetResize) {
          const dw = e.clientX - activeWidgetResize.startX;
          const dh = e.clientY - activeWidgetResize.startY;
          const newW = Math.max(220, activeWidgetResize.initialWidth + dw);
          const newH = Math.max(140, activeWidgetResize.initialHeight + dh);
          activeWidgetResize.widget.style.width = `${newW}px`;
          activeWidgetResize.widget.style.height = `${newH}px`;
          if (activeWidgetResize.widget.id === 'widget-clues' || activeWidgetResize.widget.classList.contains('widget-matrix-popup')) {
            renderClueCords();
          }
        }
      });
      window.addEventListener('mouseup', () => {
        if (activeWidgetDrag) {
          activeWidgetDrag = null;
        }
        if (activeWidgetResize) {
          activeWidgetResize = null;
          renderClueCords();
        }
      });
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
    let allCampaignClueMatrices = [];
    let activeWidgetMatrixId = null;
  });
}

async function loadClueMatricesForWidget() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/episodes?campaign_id=${activeCampaignId}`);
    if (!res.ok) return;
    const episodes = await res.json();
    let allMatrices = [];
    for (const ep of episodes) {
      const epRes = await authFetch(`/api/episodes/${ep.id}`);
      if (epRes.ok) {
        const epData = await epRes.json();
        if (epData.matrices && Array.isArray(epData.matrices)) {
          epData.matrices.forEach(m => {
            m.episode_title = ep.title;
            allMatrices.push(m);
          });
        }
      }
    }
    allCampaignClueMatrices = allMatrices;
    const select = document.getElementById('clueMatrixWidgetSelect');
    if (select) {
      select.innerHTML = '<option value="">Select Investigation Matrix...</option>';
      allMatrices.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.innerText = `${m.title} (${m.episode_title || 'Episode'})`;
        select.appendChild(opt);
      });
      if (allMatrices.length > 0) {
        if (!activeWidgetMatrixId || !allMatrices.some(m => m.id === activeWidgetMatrixId)) {
          activeWidgetMatrixId = allMatrices[0].id;
        }
        select.value = String(activeWidgetMatrixId);
        renderWidgetClueCards(activeWidgetMatrixId);
      } else {
        renderWidgetClueCards(null);
      }
    }
  } catch (err) {
    console.error('Failed to load clue matrices for widget:', err);
  }
}

function handleClueMatrixWidgetChange(matrixId) {
  activeWidgetMatrixId = matrixId ? parseInt(matrixId, 10) : null;
  renderWidgetClueCards(activeWidgetMatrixId);
}

function renderWidgetClueCards(matrixId) {
  const canvas = document.getElementById('clueCardsCanvas');
  if (!canvas) return;
  if (!matrixId) {
    canvas.innerHTML = `
            <svg class="clue-cords-svg" id="clueCordsSvg"></svg>
            <div class="clue-empty-notice" style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:11px;">
                <i class="fa-solid fa-magnifying-glass" style="font-size:24px;color:#ef4444;margin-bottom:8px;opacity:0.6;display:block;"></i>
                No clue matrix selected. Choose one above to view evidence.
            </div>
        `;
    return;
  }
  const matrix = allCampaignClueMatrices.find(m => m.id === matrixId);
  if (!matrix || !matrix.clues || matrix.clues.length === 0) {
    canvas.innerHTML = `
            <svg class="clue-cords-svg" id="clueCordsSvg"></svg>
            <div class="clue-empty-notice" style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:11px;">
                <i class="fa-solid fa-folder-open" style="font-size:24px;color:#ef4444;margin-bottom:8px;opacity:0.6;display:block;"></i>
                No clues cataloged in "${escapeHtml(matrix ? matrix.title : 'this matrix')}" yet.
            </div>
        `;
    return;
  }
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
  let cardsHtml = '<svg class="clue-cords-svg" id="clueCordsSvg"></svg>';
  matrix.clues.forEach((c, idx) => {
    const isRevealed = Boolean(c.discovered);
    const posClass = `clue-pos-${idx % 10 + 1}`;
    if (!isRevealed && !isGM) {
      cardsHtml += `
                <div class="clue-mockup-card ${posClass}" onclick="alert('This clue has not been revealed yet.')" title="Sealed Evidence" style="background:#fbbf24; border-radius:4px; border:2px solid #b45309; box-shadow:0 4px 6px rgba(0,0,0,0.5);">
                    <div style="background:#b45309; color:#fef3c7; font-size:10px; font-weight:bold; padding:2px 10px; border-radius:2px; transform:rotate(-15deg); margin-bottom:10px; border:1px dashed #fef3c7;">CONFIDENTIAL</div>
                    <div style="font-size:12px; font-weight:bold; color:#78350f; text-align:center; padding:0 5px;">${escapeHtml(c.title)}</div>
                    <div style="position:absolute; top:5px; right:5px; color:#d97706;"><i class="fa-solid fa-lock"></i></div>
                </div>
            `;
    } else {
      cardsHtml += `
                <div class="clue-mockup-card ${posClass}" onclick="openClueDetailWidget(${c.id})" title="Inspect Evidence" style="background:#f3f4f6; border-radius:2px; border:1px solid #d1d5db; box-shadow:0 2px 4px rgba(0,0,0,0.3); background-image: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.05) 100%);">
                    <div style="position:absolute; top:10px; color:#ef4444; font-size:9px; font-weight:900; text-align:center; border:2px solid #ef4444; padding:2px; transform:rotate(-5deg); opacity:0.8;">CLASSIFIED<br>FOU // COTERIE</div>
                    <div style="font-size:12px; font-weight:bold; color:#111827; text-align:center; padding:0 10px; margin-top:20px;">${escapeHtml(c.title)}</div>
                    ${!isRevealed && isGM ? '<div style="position:absolute; bottom:5px; left:5px; color:#ef4444; font-size:10px; font-weight:bold;"><i class="fa-solid fa-eye-slash"></i> Hidden</div>' : ''}
                </div>
            `;
    }
  });
  canvas.innerHTML = cardsHtml;
  if (typeof renderClueCords === 'function') {
    setTimeout(() => renderClueCords('clueCardsCanvas', 'clueCordsSvg'), 60);
  }
}

function handleClueCardClick(clueKey) {
  let clue = null;
  if (typeof clueKey === 'object' && clueKey !== null) {
    clue = clueKey;
  } else {
    clue = currentEpisodeClues.find(c => String(c.id).toLowerCase() === String(clueKey).toLowerCase() || String(c.code).toLowerCase() === String(clueKey).toLowerCase());
    if (!clue) {
      for (const m of allCampaignClueMatrices) {
        const found = (m.clues || []).find(c => String(c.id) === String(clueKey));
        if (found) {
          clue = found;
          break;
        }
      }
    }
    if (clue) openClueReaderModal(clue);
  }
}

function openClueReaderModal(clue) {
  const modal = document.getElementById('clueReaderModal');
  if (!modal) return;
  const badge = document.getElementById('modalClueBadge');
  const title = document.getElementById('modalClueTitle');
  const status = document.getElementById('modalClueStatus');
  const vector = document.getElementById('modalClueVector');
  const loc = document.getElementById('modalClueLocation');
  const heading = document.getElementById('modalClueHeading');
  const fullText = document.getElementById('modalClueFullText');
  const stamp = document.getElementById('modalClueStamp');
  const isDiscovered = clue.status === 'discovered' || clue.discovered === 1 || clue.discovered === true;
  if (badge) badge.innerText = clue.code || 'EVIDENCE';
  if (title) title.innerText = isDiscovered ? (clue.title || 'FORENSIC PIECE').toUpperCase() : 'CLASSIFIED EVIDENCE';
  if (status) {
    status.innerText = isDiscovered ? 'DISCOVERED' : 'CLASSIFIED / UNFOUND';
    status.className = isDiscovered ? 'status-uncovered' : 'status-classified';
  }
  if (vector) vector.innerText = isDiscovered ? clue.delivery_method || 'Evidence Archive' : 'Unknown Vector';
  if (loc) loc.innerText = isDiscovered ? clue.location_hint || 'Undisclosed Scene' : 'Undisclosed Scene';
  if (heading) heading.innerText = isDiscovered ? `Forensic Dossier: ${clue.title}` : 'RESTRICTED ARCHIVE FILE';
  if (stamp) {
    stamp.innerHTML = isDiscovered ? 'CLASSIFIED // FOR OFFICIAL USE ONLY (FOUO)<br><span style="font-size:9.5px;letter-spacing:1px;font-weight:700;">ASSIGNED TO: COTERIE | KINDRED ARCHIVE</span>' : 'RESTRICTED // CLASSIFIED (FOUO)<br><span style="font-size:9.5px;letter-spacing:1px;font-weight:700;">ASSIGNED TO: COTERIE</span>';
  }
  if (fullText) {
    if (isDiscovered) {
      fullText.innerHTML = '<strong style="color:#3b82f6;">PLOT LEAD:</strong> ' + escapeHtml(clue.description || '') + '<br><br><strong style="color:#8b5cf6;">EMOTIONAL CONTEXT:</strong> ' + escapeHtml(clue.emotional_depth || '');
    } else {
      fullText.innerText = 'This investigation piece has not yet been uncovered by the coterie. Investigate active scenes, interrogate witnesses, or examine the gameboard to unlock this dossier.';
    }
  }
  modal.classList.add('active');
}

  window.promptDeleteCharacter = async function (e, id, name) {
    e.stopPropagation();
    const confirmed = await vtmConfirm(`Are you absolutely sure you want to delete "${name}"? This action cannot be undone and will permanently erase this character from the chronicle.`, 'DESTRUCTIVE ACTION');
    if (confirmed) {
      authFetch('/api/characters/' + id, {
        method: 'DELETE'
      }).then(res => res.json()).then(data => {
        if (data.success) {
          if (activeControlledCharacterId === id) activeControlledCharacterId = null;
          if (activeNpcPersonaId === id) activeNpcPersonaId = null;
          vtmAlert(`${name} has been successfully deleted.`, 'Character Deleted');
          loadCharacters();
        } else {
          vtmAlert('Failed to delete character: ' + data.error, 'Error');
        }
      }).catch(err => {
        console.error(err);
        vtmAlert('A network error occurred while deleting the character.', 'Error');
      });
    }
  };
  window.addEventListener('resize', () => {
    document.querySelectorAll('.elysium-widget').forEach(w => {
      if (w.style.display !== 'none') {
        const rect = w.getBoundingClientRect();
        let left = parseInt(w.style.left) || 0;
        let top = parseInt(w.style.top) || 0;
        if (left + rect.width > window.innerWidth) w.style.left = Math.max(0, window.innerWidth - rect.width) + 'px';
        if (top + rect.height > window.innerHeight) w.style.top = Math.max(0, window.innerHeight - rect.height) + 'px';
      }
    });
  });

function renderClueCords(canvasId = 'clueCardsCanvas', svgId = 'clueCordsSvg') {
  const canvas = document.getElementById(canvasId);
  const svg = document.getElementById(svgId);
  if (!canvas || !svg) return;
  const cards = canvas.querySelectorAll('.clue-mockup-card, .clue-mini-card');
  if (cards.length < 2) {
    svg.innerHTML = '';
    return;
  }
  const cRect = canvas.getBoundingClientRect();
  if (cRect.width === 0 || cRect.height === 0) return;
  svg.setAttribute('width', cRect.width);
  svg.setAttribute('height', cRect.height);
  let lines = '';
  for (let i = 0; i < cards.length - 1; i++) {
    const c1 = cards[i];
    const c2 = cards[i + 1];
    const r1 = c1.getBoundingClientRect();
    const r2 = c2.getBoundingClientRect();
    let x1, y1, x2, y2;
    if (r1.left < r2.left) {
      x1 = r1.right - cRect.left;
      y1 = r1.top + r1.height * 0.70 - cRect.top;
      x2 = r2.left - cRect.left;
      y2 = r2.top + r2.height * 0.25 - cRect.top;
    } else {
      x1 = r1.left - cRect.left;
      y1 = r1.top + r1.height * 0.70 - cRect.top;
      x2 = r2.right - cRect.left;
      y2 = r2.top + r2.height * 0.25 - cRect.top;
    }
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round" filter="drop-shadow(0 0 4px rgba(220,38,38,0.8))" />`;
  }
  svg.innerHTML = lines;
}

async function openClueMatrixWidget(matrixId) {
  if (!activeCampaignId) return alert('Please enter a chronicle first.');
  try {
    const res = await authFetch(`/api/episodes/${activeEpisodeId || 1}`);
    if (!res.ok) return;
    const ep = await res.json();
    const matrices = ep.matrices || [];
    const matrix = matrices.find(m => m.id == matrixId) || matrices[0];
    if (!matrix) return alert('Clue matrix not found.');
    switchTab('gameboard');
    const widgetId = `widget-matrix-${matrix.id}`;
    let existingWidget = document.getElementById(widgetId);
    if (existingWidget) {
      existingWidget.style.display = 'flex';
      bringDesktopWidgetToFront(existingWidget);
      return;
    }
    const desktop = document.getElementById('elysiumDesktop');
    if (!desktop) return;
    const clues = matrix.clues || [];
    let cluesHtml = '';
    if (clues.length > 0) {
      clues.forEach((c, idx) => {
        const isPaper = c.discovered || idx % 2 === 1;
        cluesHtml += `
                    <div class="clue-mockup-card clue-pos-${idx % 4 + 1} ${isPaper ? 'clue-paper-card' : ''}" onclick="openClueDetailWidget(${c.id})" title="Click to inspect full dossier">
                        <div class="clue-card-id">${c.code || 'EVIDENCE'}</div>
                        <div class="clue-card-title">${escapeHtml(c.title)}</div>
                    </div>
                `;
      });
    } else {
      cluesHtml = `
                <div class="clue-mockup-card clue-pos-1 clue-paper-card">
                    <div class="clue-card-id">E1</div>
                    <div class="clue-card-title">${escapeHtml(matrix.title)}</div>
                </div>
            `;
    }
    const popup = document.createElement('div');
    popup.className = 'elysium-widget widget-clues widget-matrix-popup';
    popup.id = widgetId;
    popup.style.top = '70px';
    popup.style.left = '400px';
    popup.style.width = '270px';
    popup.style.height = '480px';
    popup.style.zIndex = ++highestDesktopWidgetZIndex;
    popup.innerHTML = `
            <div class="widget-header">
                <span class="widget-title"><i class="fa-solid fa-folder-tree" style="color:#ef4444;margin-right:6px;"></i> ${escapeHtml(matrix.title).toUpperCase()}</span>
                <div class="widget-actions">
                    <button class="btn-w-ctrl" onclick="toggleWidgetCollapse('${widgetId}')">&minus;</button>
                    <button class="btn-w-ctrl" onclick="document.getElementById('${widgetId}').remove()">&times;</button>
                </div>
            </div>
            <div class="widget-body clues-widget-body">
                <div class="clue-cards-canvas" id="canvas-matrix-${matrix.id}">
                    <svg class="clue-cords-svg" id="svg-matrix-${matrix.id}"></svg>
                    ${cluesHtml}
                </div>
            </div>
            <div class="widget-resize-handle"></div>
        `;
    desktop.appendChild(popup);
    initDesktopWidgetsDragAndResize();
    setTimeout(() => {
      renderClueCords(`canvas-matrix-${matrix.id}`, `svg-matrix-${matrix.id}`);
    }, 100);
  } catch (err) {
    console.error('Failed to spawn matrix widget:', err);
  }
}

async function loadLoreMatricesForWidget() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/lore_matrices?campaign_id=${activeCampaignId}`);
    if (!res.ok) return;
    const matrices = await res.json();
    allCampaignLoreMatrices = matrices || [];
    const select = document.getElementById('loreMatrixWidgetSelect');
    if (select) {
      select.innerHTML = '<option value="">Select Lore Archive Volume...</option>';
      allCampaignLoreMatrices.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.innerText = m.title;
        select.appendChild(opt);
      });
      if (allCampaignLoreMatrices.length > 0) {
        if (!activeWidgetLoreMatrixId || !allCampaignLoreMatrices.some(m => m.id === activeWidgetLoreMatrixId)) {
          activeWidgetLoreMatrixId = allCampaignLoreMatrices[0].id;
        }
        select.value = String(activeWidgetLoreMatrixId);
        renderWidgetLoreEntries(activeWidgetLoreMatrixId, activeLoreWidgetCategory);
      } else {
        renderWidgetLoreEntries(null, activeLoreWidgetCategory);
      }
    }
  } catch (err) {
    console.error('Failed to load lore matrices for widget:', err);
  }
}

function handleLoreMatrixWidgetChange(matrixId) {
  activeWidgetLoreMatrixId = matrixId ? parseInt(matrixId, 10) : null;
  renderWidgetLoreEntries(activeWidgetLoreMatrixId, activeLoreWidgetCategory);
}

function filterLoreWidgetCategory(cat) {
  activeLoreWidgetCategory = cat;
  document.querySelectorAll('.lore-category-chips .lore-chip').forEach(c => c.classList.remove('active'));
  const chips = document.querySelectorAll('.lore-category-chips .lore-chip');
  chips.forEach(c => {
    if (cat === 'all' && c.id === 'loreChip-all' || c.innerText.toLowerCase().includes(cat.toLowerCase())) {
      c.classList.add('active');
    }
  });
  renderWidgetLoreEntries(activeWidgetLoreMatrixId, activeLoreWidgetCategory);
}

function renderWidgetLoreEntries(matrixId, category = 'all', containerId = 'loreWidgetContent') {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!matrixId) {
    container.innerHTML = `
            <div class="clue-empty-notice" style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:11px;">
                <i class="fa-solid fa-book-bookmark" style="font-size:24px;color:#f59e0b;margin-bottom:8px;opacity:0.6;display:block;"></i>
                No lore volume selected. Choose one above to inspect uncovered setting secrets.
            </div>
        `;
    return;
  }
  const matrix = allCampaignLoreMatrices.find(m => m.id === matrixId);
  if (!matrix || !matrix.entries || matrix.entries.length === 0) {
    container.innerHTML = `
            <div class="clue-empty-notice" style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:11px;">
                <i class="fa-solid fa-scroll" style="font-size:24px;color:#f59e0b;margin-bottom:8px;opacity:0.6;display:block;"></i>
                No lore revelations discovered in "${escapeHtml(matrix ? matrix.title : 'this archive')}" yet.
            </div>
        `;
    return;
  }
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
  let entries = matrix.entries.filter(e => isGM || e.discovered);
  if (category && category !== 'all') {
    entries = entries.filter(e => (e.category || '').toLowerCase() === category.toLowerCase());
  }
  if (entries.length === 0) {
    container.innerHTML = `
            <div class="clue-empty-notice" style="text-align:center;padding:24px 10px;color:#9ca3af;font-size:11px;">
                No lore revelations discovered under category "${escapeHtml(category)}".
            </div>
        `;
    return;
  }
  container.innerHTML = entries.map(e => `
        <div class="lore-entry-card">
            <div class="lore-card-header">
                <h5 class="lore-card-title">${escapeHtml(e.title)}</h5>
                <span class="lore-cat-badge">${escapeHtml(e.category || 'Kindred History')}</span>
            </div>
            <div class="lore-card-vector">
                <i class="fa-solid fa-feather-pointed"></i> <span>Learned via: ${escapeHtml(e.revelation_vector || 'Elder Whispers')}</span>
                ${isGM ? e.discovered ? '<span style="color:#10b981;margin-left:auto;font-weight:700;"><i class="fa-solid fa-check"></i> Revealed</span>' : '<span style="color:#9ca3af;margin-left:auto;">Hidden</span>' : ''}
            </div>
            <div class="lore-card-content">${escapeHtml(e.content)}</div>
        </div>
    `).join('');
}

function popOutCurrentClueMatrix() {
  if (!activeWidgetMatrixId) return alert('Please select a clue matrix first.');
  spawnFloatingClueMatrix(activeWidgetMatrixId);
}

function spawnFloatingClueMatrix(matrixId) {
  const matrix = allCampaignClueMatrices.find(m => m.id === matrixId);
  if (!matrix) return alert('Clue matrix not found.');
  const desktop = document.getElementById('elysiumDesktop');
  if (!desktop) return;
  const uniqueId = `widget-clue-popout-${matrix.id}-${Date.now()}`;
  const canvasId = `canvas-popout-${matrix.id}-${Date.now()}`;
  const svgId = `svg-popout-${matrix.id}-${Date.now()}`;
  const clues = matrix.clues || [];
  let cluesHtml = '';
  if (clues.length > 0) {
    clues.forEach((c, idx) => {
      const isPaper = c.discovered || idx % 2 === 1;
      cluesHtml += `
                <div class="clue-mockup-card clue-pos-${idx % 4 + 1} ${isPaper ? 'clue-paper-card' : ''}" onclick="openClueDetailWidget(${c.id})" title="Click to inspect full dossier">
                    <div class="clue-card-id">${c.code || 'EVIDENCE'}</div>
                    <div class="clue-card-title">${escapeHtml(c.title)}</div>
                </div>
            `;
    });
  } else {
    cluesHtml = `
            <div class="clue-mockup-card clue-pos-1 clue-paper-card">
                <div class="clue-card-id">E1</div>
                <div class="clue-card-title">${escapeHtml(matrix.title)}</div>
            </div>
        `;
  }
  const win = document.createElement('div');
  win.className = 'elysium-widget widget-clues widget-clue-popout';
  win.id = uniqueId;
  win.style.top = `${100 + Math.floor(Math.random() * 60)}px`;
  win.style.left = `${350 + Math.floor(Math.random() * 80)}px`;
  win.style.width = '290px';
  win.style.height = '500px';
  win.style.zIndex = ++highestDesktopWidgetZIndex;
  win.innerHTML = `
        <div class="widget-header">
            <span class="widget-title"><i class="fa-solid fa-table-cells" style="color:#ef4444;margin-right:6px;"></i> ${escapeHtml(matrix.title).toUpperCase()}</span>
            <div class="widget-actions">
                <button class="btn-w-ctrl" onclick="toggleWidgetCollapse('${uniqueId}')">&minus;</button>
                <button class="btn-w-ctrl" onclick="document.getElementById('${uniqueId}').remove()">&times;</button>
            </div>
        </div>
        <div class="widget-body clues-widget-body">
            <div class="clue-cards-canvas" id="${canvasId}">
                <svg class="clue-cords-svg" id="${svgId}"></svg>
                ${cluesHtml}
            </div>
        </div>
        <div class="widget-resize-handle"></div>
    `;
  desktop.appendChild(win);
  initDesktopWidgetsDragAndResize();
  setTimeout(() => {
    renderClueCords(canvasId, svgId);
  }, 80);
}

function popOutCurrentLoreMatrix() {
  if (!activeWidgetLoreMatrixId) return alert('Please select a lore archive volume first.');
  spawnFloatingLoreMatrix(activeWidgetLoreMatrixId);
}

function spawnFloatingLoreMatrix(matrixId) {
  const matrix = allCampaignLoreMatrices.find(m => m.id === matrixId);
  if (!matrix) return alert('Lore volume not found.');
  const desktop = document.getElementById('elysiumDesktop');
  if (!desktop) return;
  const uniqueId = `widget-lore-popout-${matrix.id}-${Date.now()}`;
  const contentId = `lore-content-${matrix.id}-${Date.now()}`;
  const win = document.createElement('div');
  win.className = 'elysium-widget widget-lore widget-lore-popout';
  win.id = uniqueId;
  win.style.top = `${120 + Math.floor(Math.random() * 60)}px`;
  win.style.left = `${680 + Math.floor(Math.random() * 80)}px`;
  win.style.width = '330px';
  win.style.height = '520px';
  win.style.zIndex = ++highestDesktopWidgetZIndex;
  win.innerHTML = `
        <div class="widget-header">
            <span class="widget-title"><i class="fa-solid fa-book-journal-whills" style="color:#f59e0b;margin-right:6px;"></i> ${escapeHtml(matrix.title).toUpperCase()}</span>
            <div class="widget-actions">
                <button class="btn-w-ctrl" onclick="toggleWidgetCollapse('${uniqueId}')">&minus;</button>
                <button class="btn-w-ctrl" onclick="document.getElementById('${uniqueId}').remove()">&times;</button>
            </div>
        </div>
        <div class="widget-body lore-widget-body" id="${contentId}"></div>
        <div class="widget-resize-handle"></div>
    `;
  desktop.appendChild(win);
  initDesktopWidgetsDragAndResize();
  renderWidgetLoreEntries(matrixId, 'all', contentId);
}

function toggleVttDropdown(e) {
  e.stopPropagation();
  const menu = document.getElementById('vttDropdownMenu');
  if (menu) menu.classList.toggle('active');
  closeUserDropdown();
}

function closeVttDropdown() {
  const menu = document.getElementById('vttDropdownMenu');
  if (menu) menu.classList.remove('active');
}

function toggleUserDropdown(e) {
  e.stopPropagation();
  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.classList.toggle('active');
  closeVttDropdown();
}

function closeUserDropdown() {
  const menu = document.getElementById('userDropdownMenu');
  if (menu) menu.classList.remove('active');
}

function toggleVoiceMute() {
  const btn = document.getElementById('voiceToggleBtn');
  if (!btn) return;
  const icon = btn.querySelector('i');
  if (icon.classList.contains('fa-microphone')) {
    icon.className = 'fa-solid fa-microphone-slash';
    btn.style.color = '#ef4444';
  } else {
    icon.className = 'fa-solid fa-microphone';
    btn.style.color = '';
  }
}

function toggleFullscreenMode() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => console.error(err));
  } else {
    document.exitFullscreen().catch(err => console.error(err));
  }
}

function openProfileSettingsModal() {
  closeUserDropdown();
  if (!currentUser) return;
  document.getElementById('profileAvatarInput').value = currentUser.avatar_url || '';
  document.getElementById('profileBioInput').value = currentUser.bio || '';
  document.getElementById('profileSettingsModal').classList.add('active');
}

async function saveProfileSettings() {
  const bio = document.getElementById('profileBioInput').value.trim();
  const avatar_url = document.getElementById('profileAvatarInput').value.trim();
  try {
    const res = await authFetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        bio,
        avatar_url
      })
    });
    if (res.ok) {
      currentUser.bio = bio;
      currentUser.avatar_url = avatar_url;
      currentUser.avatar = avatar_url;
      closeModal('profileSettingsModal');
      if (typeof socket !== 'undefined' && socket && activeCampaignId) {
        socket.emit('room:join', {
          campaignId: activeCampaignId,
          userId: currentUser ? currentUser.id : null,
          username: currentUser ? currentUser.username : 'User',
          displayName: currentUser ? currentUser.displayName || currentUser.username : 'User',
          role: activeCampaignRole,
          characterId: activeControlledCharacterId || null,
          avatar: currentUser.avatar || currentUser.avatar_url
        });
      } else {
        if (typeof renderActivePlayersBar === "function") renderActivePlayersBar(currentCampaignActiveUsers);
      }
    } else {
      alert('Failed to save profile settings.');
    }
  } catch (e) {
    console.error(e);
  }
}

function openSecuritySettingsModal() {
  closeUserDropdown();
  if (!currentUser) return;
  document.getElementById('securityUsernameInput').value = currentUser.username || '';
  document.getElementById('securityPasswordInput').value = '';
  document.getElementById('securityPasswordConfirmInput').value = '';
  document.getElementById('securitySettingsModal').classList.add('active');
}

async function saveSecuritySettings() {
  const username = document.getElementById('securityUsernameInput').value.trim();
  const password = document.getElementById('securityPasswordInput').value.trim();
  const confirmPassword = document.getElementById('securityPasswordConfirmInput').value.trim();
  if (!username) return alert('Username is required.');
  if (password !== confirmPassword) return alert('Passwords do not match.');
  try {
    const payload = {
      username
    };
    if (password) payload.password = password;
    const res = await authFetch('/api/users/security', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      currentUser.username = username;
      const userDrop = document.getElementById('userDropdownUsername');
      if (userDrop) userDrop.innerText = currentUser.displayName || username;
      closeModal('securitySettingsModal');
      alert('Security settings updated successfully.');
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Failed to save security settings: ${data.error || 'Server error.'}`);
    }
  } catch (e) {
    console.error(e);
  }
}

function updateWorkshopMinimap(explicitUrl) {
  const url = explicitUrl || '/images/concept_map.jpg';
  const img = document.getElementById('workshopMinimapImg');
  if (img) img.src = url;
  loadCampaignPins();
}

async function loadCampaignPins(explicitUrl) {
  if (!activeCampaignId) return;
  const img = document.getElementById('workshopMinimapImg');
  let rawUrl = explicitUrl || (img ? img.getAttribute('src') : null) || '/images/concept_map.jpg';
  const mapUrl = new URL(rawUrl, window.location.origin).pathname;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/pins?mapUrl=${encodeURIComponent(mapUrl)}`);
    if (res.ok) {
      currentMapPins = await res.json();
      renderWorkshopPinsList();
      renderPinsOnGameboard();
    }
  } catch (e) {
    console.error(e);
  }
}

function renderWorkshopPinsList() {
  const minimapContainer = document.getElementById('workshopMinimapPins');
  const listContainer = document.getElementById('workshopMapPinsList');
  if (!minimapContainer || !listContainer) return;
  minimapContainer.innerHTML = '';
  listContainer.innerHTML = '';
  currentMapPins.forEach((p, index) => {
    const px = p.x / 2800 * 100;
    const py = p.y / 2000 * 100;
    minimapContainer.innerHTML += `<div style="position:absolute; left:${px}%; top:${py}%; transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center; cursor:pointer;" onclick="handlePinClick(event, ${p.id})" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', ${p.id});">
            <div style="background:#ef4444; color:#fff; font-size:10px; font-weight:bold; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:-4px; z-index:2; border:1px solid #7f1d1d;">${index + 1}</div>
            <i class="fa-solid fa-location-dot" title="${escapeHtml(p.title)}" style="color:#ef4444; font-size:16px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));"></i>
        </div>`;
    listContainer.innerHTML += `
        <div style="background:#140e11; border:1px solid #372128; border-radius:6px; padding:12px; display:flex; gap:12px; align-items:flex-start;">
            <div style="background:#ef4444; color:#fff; font-size:12px; font-weight:bold; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${index + 1}</div>
            <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
                <input type="text" value="${escapeHtml(p.title)}" onchange="updatePin(${p.id}, 'title', this.value)" style="background:transparent; border:none; border-bottom:1px solid #372128; color:#ef4444; font-weight:bold; padding:4px 0; font-size:14px; outline:none;" placeholder="Location Title">
                <textarea onchange="updatePin(${p.id}, 'description', this.value)" rows="1" style="background:transparent; border:1px solid #2a191f; border-radius:4px; color:#d1d5db; padding:6px; font-size:12px; resize:vertical; outline:none; font-family:inherit;" placeholder="Hover description / details... (Optional)">${escapeHtml(p.description || '')}</textarea>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                    <textarea onchange="updatePin(${p.id}, 'security_measures', this.value)" rows="2" style="background:transparent; border:1px solid #2a191f; border-left:2px solid #ef4444; border-radius:4px; color:#d1d5db; padding:6px; font-size:11px; resize:vertical; outline:none; font-family:inherit;" placeholder="Security Measures & Obstacles...">${escapeHtml(p.security_measures || '')}</textarea>
                    <textarea onchange="updatePin(${p.id}, 'infiltration_routes', this.value)" rows="2" style="background:transparent; border:1px solid #2a191f; border-left:2px solid #10b981; border-radius:4px; color:#d1d5db; padding:6px; font-size:11px; resize:vertical; outline:none; font-family:inherit;" placeholder="Alternative Infiltration Routes...">${escapeHtml(p.infiltration_routes || '')}</textarea>
                </div>
            </div>
            <button class="btn-card-ctrl" onclick="deletePin(${p.id})" style="color:#ef4444;" title="Delete Pin"><i class="fa-solid fa-trash"></i></button>
        </div>
        `;
  });
}

async function updatePin(pinId, field, value) {
  const pin = currentMapPins.find(p => p.id === pinId);
  if (!pin) return;
  pin[field] = value;
  try {
    await authFetch(`/api/chronicles/${activeCampaignId}/pins/${pinId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: pin.title,
        description: pin.description,
        security_measures: pin.security_measures,
        infiltration_routes: pin.infiltration_routes
      })
    });
    renderWorkshopPinsList();
    renderPinsOnGameboard();
  } catch (e) {
    console.error(e);
  }
}

async function deletePin(pinId) {
  if (!confirm('Delete this location pin?')) return;
  try {
    await authFetch(`/api/chronicles/${activeCampaignId}/pins/${pinId}`, {
      method: 'DELETE'
    });
    loadCampaignPins();
  } catch (e) {
    console.error(e);
  }
}



function renderPinsOnGameboard() {
  if (typeof loadMapPins === "function") loadMapPins();
}

function openImagePicker(targetInputId) {
  openAssetPicker(url => {
    if (targetInputId === 'profileAvatarInput') {
      performProfileCrop(url);
      return;
    }
    const input = document.getElementById(targetInputId);
    if (input) input.value = url;
    const evt = new Event('change');
    input.dispatchEvent(evt);
    if (targetInputId === 'backdropUrlInput') {
      const globalImg = document.getElementById('globalBackdropImg');
      if (globalImg) globalImg.src = url;
      localStorage.setItem('vtm_global_backdrop', url);
    }
  });
}

function closeImagePicker() {
  document.getElementById('imagePickerModal').classList.remove('active');
}

function switchImageTab(tab) {
  document.getElementById('tabContentUrl').style.display = tab === 'url' ? 'block' : 'none';
  document.getElementById('tabContentUpload').style.display = tab === 'upload' ? 'block' : 'none';
  document.getElementById('tabContentGallery').style.display = tab === 'gallery' ? 'block' : 'none';
  document.getElementById('btnTabUrl').classList.toggle('active', tab === 'url');
  document.getElementById('btnTabUpload').classList.toggle('active', tab === 'upload');
  document.getElementById('btnTabGallery').classList.toggle('active', tab === 'gallery');
}

function selectGalleryImage(src) {
  document.querySelectorAll('.gallery-thumb').forEach(img => img.classList.remove('selected'));
  event.target.classList.add('selected');
  document.getElementById('pickerUrlInput').value = new URL(src).pathname;
}

async function confirmImageSelection() {
  const targetId = document.getElementById('imagePickerTargetId').value;
  const targetInput = document.getElementById(targetId);
  if (!targetInput) return closeImagePicker();
  const activeTab = document.querySelector('.btn-action-outline.btn-sm.active').id;
  if (activeTab === 'btnTabUpload') {
    const fileInput = document.getElementById('pickerFileInput');
    if (!fileInput.files.length) return alert('Please select a file to upload.');
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);
    document.getElementById('uploadStatus').innerText = 'Uploading...';
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('vtm_auth_token')
        },
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        targetInput.value = data.url;
        if (targetInput.onchange) targetInput.onchange();
        closeImagePicker();
      } else {
        document.getElementById('uploadStatus').innerText = 'Upload failed: ' + (data.error || 'Unknown error');
      }
    } catch (e) {
      document.getElementById('uploadStatus').innerText = 'Upload error: ' + e.message;
    }
  } else {
    const url = document.getElementById('pickerUrlInput').value.trim();
    targetInput.value = url;
    if (targetInput.onchange) targetInput.onchange();
    closeImagePicker();
  }
}

function addMapToEpisode(url) {
  if (!url) return;
  if (!currentEpisodeData) return;
  if (!Array.isArray(currentEpisodeData.maps)) currentEpisodeData.maps = [];
  currentEpisodeData.maps.push(url);
  document.getElementById('hiddenNewMapTarget').value = '';
  renderEpisodeMaps();
  saveEpisodeDetails();
}

function removeMapFromEpisode(index) {
  if (!confirm('Remove this map from the episode?')) return;
  currentEpisodeData.maps.splice(index, 1);
  renderEpisodeMaps();
  saveEpisodeDetails();
}

function pushMapToGameboard(url) {
  if (!activeCampaignId) return;
  authFetch('/api/gameboard/map', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeCampaignId,
      map_url: url
    })
  }).then(() => {
    alert('Map pushed to live Gameboard!');
    const img = document.getElementById('workshopMinimapImg');
    if (img) img.src = url;
    loadCampaignPins(url);
  });
}

function renderEpisodeMaps() {
  const container = document.getElementById('epMapsListContainer');
  if (!container || !currentEpisodeData) return;
  let maps = currentEpisodeData.maps;
  if (typeof maps === 'string') {
    try {
      maps = JSON.parse(maps);
    } catch (e) {
      maps = [];
    }
  }
  if (!Array.isArray(maps)) maps = [];
  currentEpisodeData.maps = maps;
  if (maps.length === 0) {
    container.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No maps added. Click Add Map to upload or link one.</div>';
    return;
  }
  container.innerHTML = '';
  maps.forEach((mapUrl, index) => {
    const row = document.createElement('div');
    row.style.cssText = "display:flex; align-items:center; gap:8px; background:#140e11; padding:6px; border-radius:4px; border:1px solid #372128;";
    row.style.cursor = 'pointer';
    row.onclick = () => {
        const img = document.getElementById('workshopMinimapImg');
        if (img) img.src = mapUrl;
        loadCampaignPins(mapUrl);
    };
    row.innerHTML = `
            <img src="${mapUrl}" style="width:40px; height:40px; object-fit:cover; border-radius:2px; border:1px solid #7f1d1d;">
            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:12px; color:#d1d5db;">${mapUrl.split('/').pop()}</div>
            <button class="btn-card-ctrl" onclick="event.stopPropagation(); removeMapFromEpisode(${index})" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
        `;
    container.appendChild(row);
  });
  const img = document.getElementById('workshopMinimapImg');
  if (img && maps.length > 0 && img.src.includes('concept_map.jpg')) {
    img.src = maps[0];
    loadCampaignPins(maps[0]);
  }
}

function toggleWidget(widgetId) {
  const w = document.getElementById(widgetId);
  if (!w) return;
  const isHidden = window.getComputedStyle(w).display === 'none';
  if (isHidden) {
    w.style.display = 'flex';
    if (typeof bringDesktopWidgetToFront === 'function') bringDesktopWidgetToFront(w);
  } else {
    w.style.display = 'none';
  }
}

function deleteCharacterDirectly(id) {
  if (!confirm('Are you absolutely sure you want to delete this character? This cannot be undone.')) return;
  authFetch('/api/characters/' + id, {
    method: 'DELETE'
  }).then(res => res.json()).then(data => {
    if (data.success) {
      if (activeControlledCharacterId === id) activeControlledCharacterId = null;
      if (activeNpcPersonaId === id) activeNpcPersonaId = null;
      loadCharacters();
    } else {
      alert('Failed to delete character: ' + data.error);
    }
  }).catch(err => console.error(err));
}

function autofillNpcProfile(charId) {
  const select = document.getElementById('epNpcSelect');
  if (!select || !charId) return;
  const opt = select.options[select.selectedIndex];
  if (opt && opt.dataset.profile) {
    try {
      const profile = JSON.parse(opt.dataset.profile);
      if (profile.mask) document.getElementById('epNpcMask').value = profile.mask;
      if (profile.want) document.getElementById('epNpcWant').value = profile.want;
      if (profile.line) document.getElementById('epNpcLine').value = profile.line;
      if (profile.mannerisms) document.getElementById('epNpcMannerisms').value = profile.mannerisms;
      if (profile.biases) document.getElementById('epNpcBiases').value = profile.biases;
      if (profile.secret) document.getElementById('epNpcSecret').value = profile.secret;
      if (profile.memories) document.getElementById('epNpcMemories').value = profile.memories;
    } catch (e) {}
  }
}

function openAddEpisodeNpcModal() {
  console.log("Opening Add Episode NPC Modal");
  const select = document.getElementById('epNpcSelect');
  if (select) {
    select.innerHTML = '<option value="">Select an NPC...</option>';
    authFetch(`/api/chronicles/${activeChronicleId}/characters`).then(r => r.json()).then(chars => {
      if (Array.isArray(chars)) {
        chars.filter(c => c.category === 'npc').forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = c.name;
          if (c.sheet_data) {
            try {
              const parsed = JSON.parse(c.sheet_data);
              opt.dataset.profile = JSON.stringify(parsed.profile || ({}));
            } catch (e) {}
          }
          select.appendChild(opt);
        });
      }
    }).catch(console.error);
  }
  document.getElementById('epNpcCustomName').value = '';
  document.getElementById('epNpcMask').value = '';
  document.getElementById('epNpcWant').value = '';
  document.getElementById('epNpcLine').value = '';
  document.getElementById('epNpcMannerisms').value = '';
  document.getElementById('epNpcBiases').value = '';
  document.getElementById('epNpcSecret').value = '';
  document.getElementById('epNpcMemories').value = '';
  document.getElementById('epNpcWants').value = '';
  openModal('addEpisodeNpcModal');
}

function addEpisodeNpcSubmit() {
  const select = document.getElementById('epNpcSelect');
  let name = document.getElementById('epNpcCustomName').value;
  if (!name && select && select.selectedIndex > 0) {
    name = select.options[select.selectedIndex].textContent;
  }
  if (!name) return alert("Must provide or select an NPC name.");
  const mask = document.getElementById('epNpcMask').value;
  const want = document.getElementById('epNpcWant').value;
  const line = document.getElementById('epNpcLine').value;
  const mannerisms = document.getElementById('epNpcMannerisms').value;
  const biases = document.getElementById('epNpcBiases').value;
  const secret = document.getElementById('epNpcSecret').value;
  const memories = document.getElementById('epNpcMemories').value;
  const wants = document.getElementById('epNpcWants').value;
  if (!currentEpisodeData) currentEpisodeData = {};
  while (typeof currentEpisodeData.npc_agendas === 'string') {
    try {
      currentEpisodeData.npc_agendas = JSON.parse(currentEpisodeData.npc_agendas);
    } catch (e) {
      currentEpisodeData.npc_agendas = [];
      break;
    }
  }
  if (!Array.isArray(currentEpisodeData.npc_agendas)) {
    currentEpisodeData.npc_agendas = [];
  }
  const agendas = currentEpisodeData.npc_agendas;
  agendas.push({
    name,
    mask,
    want,
    line,
    mannerisms,
    biases,
    secret,
    memories,
    wants
  });
  console.log('[Trace][Episode] Pushed new NPC agenda. Count:', agendas.length);
  authFetch(`/api/episodes/${activeEpisodeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      npc_agendas: agendas
    })
  }).then(r => r.json()).then(() => {
    closeModal('addEpisodeNpcModal');
    const btn = document.querySelector(`.list-group-item[onclick="loadEpisode(${activeEpisodeId})"]`);
    if (btn) btn.click();
  });
}

function renderRulebookHierarchy(rulesToRender) {
  const container = document.getElementById('rulebookHierarchy');
  if (!container) return;
  container.innerHTML = '';
  const ruleMap = new Map();
  rulesToRender.forEach(r => ruleMap.set(r.id, r));
  const roots = [];
  const childrenMap = new Map();
  rulesToRender.forEach(r => {
    if (!r.parent_id || !ruleMap.has(r.parent_id)) {
      roots.push(r);
    } else {
      if (!childrenMap.has(r.parent_id)) childrenMap.set(r.parent_id, []);
      childrenMap.get(r.parent_id).push(r);
    }
  });
function buildNode(rule, level = 0) {
  const div = document.createElement('div');
  div.style.marginLeft = level * 15 + 'px';
  div.style.marginBottom = '4px';
  const btn = document.createElement('div');
  btn.className = 'rule-tree-item';
  btn.style.padding = '6px 10px';
  btn.style.cursor = 'pointer';
  btn.style.borderRadius = '4px';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.fontSize = '14px';
  btn.style.color = '#e2e8f0';
  btn.style.transition = 'background 0.2s';
  btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.05)';
  btn.onmouseout = () => btn.style.background = 'transparent';
  const children = childrenMap.get(rule.id) || [];
  const hasChildren = children.length > 0;
  btn.innerHTML = `
            <span style="width: 16px; display: inline-block; text-align: center; margin-right: 6px;">
                ${hasChildren ? '<i class="fa-solid fa-chevron-right" style="font-size:10px; color:#9ca3af;"></i>' : '<i class="fa-solid fa-file-lines" style="font-size:10px; color:#6b7280;"></i>'}
            </span>
            <span style="flex:1;">${escapeHtml(rule.title)}</span>
        `;
  const childrenContainer = document.createElement('div');
  childrenContainer.style.display = 'none';
  btn.onclick = e => {
    if (hasChildren) {
      const isHidden = childrenContainer.style.display === 'none';
      childrenContainer.style.display = isHidden ? 'block' : 'none';
      const icon = btn.querySelector('.fa-chevron-right, .fa-chevron-down');
      if (icon) icon.className = isHidden ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-right';
    }
    openRuleArticle(rule);
  };
  div.appendChild(btn);
  if (hasChildren) {
    children.forEach(child => childrenContainer.appendChild(buildNode(child, level + 1)));
    div.appendChild(childrenContainer);
  }
  return div;
}

  roots.sort((a, b) => a.title.localeCompare(b.title)).forEach(root => container.appendChild(buildNode(root, 0)));
  if (rulesToRender.length === 0) container.innerHTML = '<div style="color:#6b7280; font-style:italic; font-size:13px; padding:10px;">No articles found.</div>';
}


function openRuleArticle(rule) {
  const contentPanel = document.getElementById('rulebookArticleView');
  if (!contentPanel) return;
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller' || currentUser && currentUser.role === 'gm';
  contentPanel.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px; border-bottom: 1px solid #2a2a35; padding-bottom: 15px;">
            <div>
                <h1 style="margin:0 0 10px 0; font-family:'Cinzel',serif; color:#f8fafc; font-size:28px;">${escapeHtml(rule.title)}</h1>
                ${rule.tags ? `<div style="font-size:12px; color:#a855f7;"><i class="fa-solid fa-tags"></i> ${escapeHtml(rule.tags)}</div>` : ''}
            </div>
            ${isGM ? `<button class="btn-action" onclick="editRuleArticle(${rule.id})" style="padding:6px 12px; font-size:12px;"><i class="fa-solid fa-pen"></i> Edit</button>` : ''}
        </div>
        <div class="rule-content" style="line-height:1.6; font-size:15px; color:#d1d5db;">
            ${formatLineBreaks(rule.content)}
        </div>
    `;
}

async function renderStoryWidgetEpisodes() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/episodes?campaign_id=${activeCampaignId}`);
    if (!res.ok) return;
    const episodes = await res.json();
    const bodyEl = document.getElementById('storyWidgetBody');
    if (!bodyEl) return;
    const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
    let html = '';
    episodes.sort((a, b) => a.number - b.number).forEach(ep => {
      const isRevealed = Boolean(ep.revealed || ep.status === 'revealed' || ep.status === 'completed');
      if (!isRevealed && !isGM) {
        html += `
                    <div onclick="openSealedEpisodeWidget(${ep.id}, ${ep.episode_number})" title="Sealed Episode" style="width:120px; height:160px; background:#fbbf24; border-radius:4px; border:2px solid #b45309; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; position:relative; box-shadow:0 4px 6px rgba(0,0,0,0.5);">
                        <div style="background:#b45309; color:#fef3c7; font-size:10px; font-weight:bold; padding:2px 10px; border-radius:2px; transform:rotate(-15deg); margin-bottom:10px; border:1px dashed #fef3c7;">CONFIDENTIAL</div>
                        <div style="font-size:12px; font-weight:bold; color:#78350f; text-align:center; padding:0 5px;">Episode ${ep.episode_number}</div>
                        <div style="position:absolute; top:5px; right:5px; color:#d97706;"><i class="fa-solid fa-lock"></i></div>
                    </div>
                `;
      } else {
        html += `
                    <div onclick="openEpisodeDetailWidget(${ep.id})" title="Inspect Episode" style="width:120px; height:160px; background:#f3f4f6; border-radius:2px; border:1px solid #d1d5db; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; position:relative; box-shadow:0 2px 4px rgba(0,0,0,0.3); background-image: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.05) 100%);">
                        <div style="position:absolute; top:10px; color:#ef4444; font-size:9px; font-weight:900; text-align:center; border:2px solid #ef4444; padding:2px; transform:rotate(-5deg); opacity:0.8;">CLASSIFIED<br>FOU // COTERIE</div>
                        <div style="font-size:12px; font-weight:bold; color:#111827; text-align:center; padding:0 10px; margin-top:20px;">Ep ${ep.episode_number}:<br>${escapeHtml(ep.title)}</div>
                        ${!isRevealed && isGM ? '<div style="position:absolute; bottom:5px; left:5px; color:#ef4444; font-size:10px; font-weight:bold;"><i class="fa-solid fa-eye-slash"></i> Hidden</div>' : ''}
                    </div>
                `;
      }
    });
    bodyEl.innerHTML = html;
  } catch (err) {
    console.error('Failed to load story episodes:', err);
  }
}

function openSealedEpisodeWidget(epId, epNumber) {
  let widget = document.getElementById('widget-clue-detail');
  let titleEl = document.getElementById('clueDetailTitle');
  let bodyEl = document.getElementById('clueDetailBody');
  if (titleEl) titleEl.innerText = `Episode ${epNumber}: Sealed`;
  let html = `
        <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #3f3f46; text-align:center;">
            <div style="font-size:18px; color:#ef4444; font-weight:bold; margin-bottom:10px;"><i class="fa-solid fa-lock"></i> TOP SECRET</div>
            <div style="font-size:14px; color:#d1d5db;">This episode has not been revealed yet.</div>
        </div>
    `;
  if (bodyEl) bodyEl.innerHTML = html;
  if (widget) {
    widget.style.display = 'flex';
    bringDesktopWidgetToFront(widget);
  }
}

function openEpisodeDetailWidget(epId) {
  authFetch(`/api/episodes/${epId}`).then(r => r.json()).then(ep => {
    let widget = document.getElementById('widget-clue-detail');
    let titleEl = document.getElementById('clueDetailTitle');
    let bodyEl = document.getElementById('clueDetailBody');
    if (titleEl) titleEl.innerText = `Episode ${ep.episode_number}: ${ep.title}`;
    let html = `
            <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #3f3f46;">
                <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase;">Location</div>
                <div style="font-size:12px; color:#9ca3af;">${escapeHtml(ep.location || 'Unknown')}</div>
            </div>
            <div>
                <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase; margin-bottom:5px;">Episode Summary</div>
                <div style="white-space:pre-wrap;">${escapeHtml(ep.summary || 'No summary available.')}</div>
            </div>
        `;
    if (bodyEl) bodyEl.innerHTML = html;
    if (widget) {
      widget.style.display = 'flex';
      bringDesktopWidgetToFront(widget);
    }
  });
}

function toggleMapPinMode() {
  mapPinMode = !mapPinMode;
  const vp = document.getElementById('canvasViewport');
  if (vp) vp.style.cursor = mapPinMode ? 'crosshair' : 'default';
  const btn = document.getElementById('btnPinMode');
  if (btn) {
    if (mapPinMode) btn.classList.add('active-tool'); else btn.classList.remove('active-tool');
  }
}

async function loadMapPins() {
  if (!activeCampaignId) return;
  let rawUrl = document.getElementById('episodeMapSelector')?.value || canvasState?.backdrop || '';
  if (!rawUrl) return;
  const mapUrl = new URL(rawUrl, window.location.origin).pathname;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/pins?mapUrl=${encodeURIComponent(mapUrl)}`);
    if (!res.ok) return;
    const pins = await res.json();
    renderMapPins(pins);
  } catch (e) {
    console.error(e);
  }
}

function renderMapPins(pins) {
  const layer = document.getElementById('canvasPinsLayer');
  if (!layer) return;
  layer.innerHTML = '';
  pins.forEach(pin => {
    const marker = document.createElement('div');
    marker.className = 'map-pin-marker';
    marker.style.left = pin.x + 'px';
    marker.style.top = pin.y + 'px';
    marker.style.transform = `scale(${1 / (typeof canvasTransform !== 'undefined' ? canvasTransform.zoom : 1)})`;
    marker.style.transformOrigin = 'bottom center';
    marker.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
    const tooltip = document.createElement('div');
    tooltip.className = 'map-pin-tooltip';
    const h4 = document.createElement('h4');
    h4.innerText = pin.title || 'Unknown Location';
    tooltip.appendChild(h4);
    if (pin.description) {
      const p = document.createElement('p');
      p.innerText = pin.description;
      tooltip.appendChild(p);
    }
    if (pin.security_measures) {
      const p2 = document.createElement('p');
      p2.innerHTML = '<strong style="color:#ef4444;font-size:10px;">SECURITY:</strong><br>' + escapeHtml(pin.security_measures);
      p2.style.borderLeft = '2px solid #ef4444';
      p2.style.paddingLeft = '6px';
      p2.style.marginTop = '6px';
      tooltip.appendChild(p2);
    }
    if (pin.infiltration_routes) {
      const p3 = document.createElement('p');
      p3.innerHTML = '<strong style="color:#10b981;font-size:10px;">ROUTES:</strong><br>' + escapeHtml(pin.infiltration_routes);
      p3.style.borderLeft = '2px solid #10b981';
      p3.style.paddingLeft = '6px';
      p3.style.marginTop = '6px';
      tooltip.appendChild(p3);
    }
    marker.appendChild(tooltip);
    layer.appendChild(marker);
  });
}

function filterRulebook() {
  const term = document.getElementById('rulebookSearchInput').value.toLowerCase();
  document.querySelectorAll('#rulebookIndexList li').forEach(li => {
    li.style.display = li.innerText.toLowerCase().includes(term) ? '' : 'none';
  });
}

function pushEpisodeToGameboard() {
  if (!activeCampaignId || !activeEpisodeId) return;
  authFetch('/api/gameboard/scene', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeCampaignId,
      active_episode_id: activeEpisodeId
    })
  }).then(res => res.json()).then(data => {
    if (data.success) {
      alert('Episode set as Active!');
      if (typeof checkGameState === 'function') checkGameState();
    }
  });
}

async function loadNpcCategories() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/npc-categories`);
    if (res.ok) {
      npcCategoriesList = await res.json();
      renderNpcCategoryChips();
      populateCharacterCategoryDropdowns();
      renderNpcCastWidget();
      if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
    }
  } catch (e) {
    console.error('Failed to load NPC categories', e);
  }
}

function renderNpcCategoryChips() {
  const container = document.getElementById('dynamicNpcCategoryChips');
  if (!container) return;
  let html = `<button class="npc-chip ${activeNpcCastCategory === 'all' ? 'active' : ''}" id="npcChip-all" onclick="filterNpcCastCategory('all')">ALL</button>`;
  html += `<button class="npc-chip ${activeNpcCastCategory === 'pc' ? 'active' : ''}" id="npcChip-pc" onclick="filterNpcCastCategory('pc')">PLAYERS</button>`;
  npcCategoriesList.forEach(cat => {
    const isActive = activeNpcCastCategory === cat.name;
    html += `<button class="npc-chip ${isActive ? 'active' : ''}" id="npcChip-${cat.id}" onclick="filterNpcCastCategory('${escapeHtml(cat.name)}')">${escapeHtml(cat.name)}</button>`;
  });
  if (activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') {
    html += `<button class="npc-chip" onclick="openNpcCategoryManager()" title="Manage Categories" style="background:rgba(255,255,255,0.1);"><i class="fa-solid fa-gear"></i></button>`;
  }
  container.innerHTML = html;
}

function filterNpcCastCategory(category) {
  activeNpcCastCategory = category;
  renderNpcCategoryChips();
  renderNpcCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
}

function populateCharacterCategoryDropdowns() {
  ['newCharCategory', 'editCharCategory'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const currentVal = sel.value;
    let html = `<option value="pc">Player Character (PC)</option>`;
    npcCategoriesList.forEach(cat => {
      html += `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`;
    });
    html += `<option value="Uncategorized">Uncategorized</option>`;
    sel.innerHTML = html;
    if (currentVal && sel.querySelector(`option[value="${currentVal}"]`)) {
      sel.value = currentVal;
    } else if (id === 'newCharCategory') {
      sel.value = 'pc';
    }
  });
}

function openNpcCategoryManager() {
  const modal = document.getElementById('npcCategoryManagerModal');
  if (modal) {
    document.getElementById('newNpcCategoryInput').value = '';
    renderNpcCategoryManagerList();
    modal.classList.add('active');
  }
}

function closeNpcCategoryManager() {
  const modal = document.getElementById('npcCategoryManagerModal');
  if (modal) modal.classList.remove('active');
}

function renderNpcCategoryManagerList() {
  const list = document.getElementById('npcCategoryManagerList');
  if (!list) return;
  if (npcCategoriesList.length === 0) {
    list.innerHTML = '<div style="color:#6b7280; font-size:12px; font-style:italic;">No custom categories created yet.</div>';
    return;
  }
  list.innerHTML = npcCategoriesList.map(cat => {
    if (window.editingNpcCategoryId === cat.id) {
      return `
<div class="category-list-item" style="flex-direction: column; gap: 8px;">
    <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
        <input type="text" id="editCatName_${cat.id}" class="form-control vtm-input" value="${escapeHtml(cat.name)}" style="width:100%; font-weight:bold; font-size:14px;">
        <input type="text" id="editCatDesc_${cat.id}" class="form-control vtm-input" value="${escapeHtml(cat.description || '')}" style="width:100%; font-size:11px;" placeholder="Description...">
    </div>
    <div style="display:flex; gap:6px; justify-content:flex-end;">
        <button class="btn-action-outline btn-sm" onclick="cancelEditNpcCategory()">Cancel</button>
        <button class="btn-action btn-sm" onclick="saveNpcCategoryInline(${cat.id})">Save</button>
    </div>
</div>
`;
    } else {
      return `
<div class="category-list-item">
    <div style="display:flex; flex-direction:column; width:100%; cursor:pointer;" onclick="startEditNpcCategory(${cat.id})">
        <span style="color:#e5e7eb; font-weight:bold; font-size:14px;">${escapeHtml(cat.name)}</span>
        <span style="color:#9ca3af; font-size:11px;">${escapeHtml(cat.description || '')}</span>
    </div>
    <div style="display:flex; gap:6px; align-items:flex-start;">
        <button class="cat-btn" onclick="startEditNpcCategory(${cat.id})" title="Edit"><i class="fa-solid fa-pencil"></i></button>
        <button class="cat-btn danger" onclick="deleteNpcCategory(${cat.id}, '${escapeHtml(cat.name).replace(/'/g, "\\'")}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
    </div>
</div>
`;
    }
  }).join('');
}

function startEditNpcCategory(id) {
  window.editingNpcCategoryId = id;
  renderNpcCategoryManagerList();
}

function cancelEditNpcCategory() {
  window.editingNpcCategoryId = null;
  renderNpcCategoryManagerList();
}

async function saveNpcCategoryInline(id) {
  const nameInput = document.getElementById('editCatName_' + id);
  const descInput = document.getElementById('editCatDesc_' + id);
  if (!nameInput) return;
  const newName = nameInput.value.trim();
  const newDesc = descInput ? descInput.value.trim() : '';
  if (!newName) {
    if (typeof vtmAlert === 'function') vtmAlert("Name cannot be empty");
    return;
  }
  try {
    const res = await authFetch(`/api/npc-categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newName,
        description: newDesc
      })
    });
    if (res.ok) {
      window.editingNpcCategoryId = null;
      await loadNpcCategories();
      renderNpcCategoryManagerList();
    } else {
      if (typeof vtmAlert === 'function') vtmAlert("Failed to update category.");
    }
  } catch (e) {
    console.error(e);
  }
}

async function addNpcCategory() {
  const input = document.getElementById('newNpcCategoryInput');
  const name = input ? input.value.trim() : '';
  const descInput = document.getElementById('newNpcCategoryDescInput');
  const description = descInput ? descInput.value.trim() : '';
  if (!name) return;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/npc-categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description
      })
    });
    if (res.ok) {
      input.value = '';
      await loadNpcCategories();
      renderNpcCategoryManagerList();
    } else {
      const err = await res.json();
      alert('Error: ' + err.error);
    }
  } catch (e) {
    console.error(e);
  }
}

function vtmPrompt(message, title = 'Input Required', defaultValue = '') {
  return new Promise(resolve => {
    document.getElementById('vtmDialogTitle').innerText = title;
    document.getElementById('vtmDialogMessage').innerText = message;
    document.getElementById('vtmDialogIcon').className = 'fa-solid fa-pen-to-square';
    const inputContainer = document.getElementById('vtmDialogInputContainer');
    inputContainer.style.display = 'block';
    const inputField = document.getElementById('vtmDialogInput');
    inputField.value = defaultValue;
    const cancelBtn = document.getElementById('vtmDialogCancelBtn');
    cancelBtn.style.display = 'block';
    cancelBtn.innerText = 'Cancel';
    const confirmBtn = document.getElementById('vtmDialogConfirmBtn');
    confirmBtn.innerText = 'Save';
    const modal = document.getElementById('vtmDialogModal');
    modal.classList.add('active');
    setTimeout(() => inputField.focus(), 50);
    const cleanup = () => {
      modal.classList.remove('active');
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      inputField.onkeydown = null;
    };
    const submit = () => {
      cleanup();
      resolve(inputField.value);
    };
    confirmBtn.onclick = submit;
    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
    inputField.onkeydown = e => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    };
  });
}



async function editNpcCategory(id, currentName, currentDesc) {
  const newName = await vtmPrompt("Edit category name:", currentName);
  if (newName === null) return;
  const newDesc = await vtmPrompt("Edit category description:", currentDesc || '');
  if (newDesc === null) return;
  if (!newName.trim()) return alert("Name cannot be empty");
  try {
    const res = await authFetch(`/api/npc-categories/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: newName.trim(),
        description: newDesc.trim()
      })
    });
    if (res.ok) {
      await loadNpcCategories();
    } else {
      alert("Failed to update category.");
    }
  } catch (e) {
    console.error(e);
    alert("Error updating category.");
  }
}

async function deleteNpcCategory(id, name) {
  if (!confirm(`Are you sure you want to delete the "${name}" category? All NPCs inside it will be marked as "Uncategorized".`)) return;
  try {
    const res = await authFetch(`/api/npc-categories/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      campaignCharactersList.forEach(c => {
        if (c.category === name) c.category = 'Uncategorized';
      });
      if (activeNpcCastCategory === name) activeNpcCastCategory = 'all';
      await loadNpcCategories();
      renderNpcCategoryManagerList();
      renderNpcCastWidget();
      if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
      renderCharacterVaultCards();
    }
  } catch (e) {
    console.error(e);
  }
}

async function updateCharacterCategory(charId, newCategory) {
  if (!activeCampaignId || activeCampaignRole !== 'gm') return;
  try {
    const res = await authFetch(`/api/characters/${charId}/category`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category: newCategory
      })
    });
    if (res.ok) {
      const c = campaignCharactersList.find(ch => ch.id === charId);
      if (c) c.category = newCategory;
      renderCharacterVaultCards();
      renderNpcCastWidget();
      if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
    }
  } catch (e) {
    console.error(e);
  }
}

async function fetchAssets() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/assets?chronicleId=${activeCampaignId}`);
    const data = await res.json();
    if (data.success) {
      globalAssets = data.assets;
    }
    const resCats = await authFetch(`/api/asset-categories?chronicleId=${activeCampaignId}`);
    const dataCats = await resCats.json();
    if (dataCats.success) {
      globalAssetCategories = dataCats.categories.map(c => c.name);
    }
    renderAssetCategories();
    renderAssetGrid();
  } catch (e) {
    console.error(e);
  }
}

function renderAssetCategories() {
  const list = document.getElementById('assetCategoriesList');
  if (!list) return;
  list.innerHTML = '';
  const activeCats = new Set(globalAssets.map(a => a.category).filter(c => c && c !== 'Uncategorized'));
  globalAssetCategories.forEach(c => activeCats.add(c));
  if (currentAssetCategory && currentAssetCategory !== 'Uncategorized') activeCats.add(currentAssetCategory);
  const categories = ['Uncategorized', ...Array.from(activeCats)];
  categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = `asset-category-item ${cat === currentAssetCategory ? 'active' : ''}`;
    div.onclick = () => {
      currentAssetCategory = cat;
      document.getElementById('currentAssetCategoryTitle').innerText = cat;
      bulkSelectedAssets.clear();
      renderAssetCategories();
      renderAssetGrid();
    };
    const count = globalAssets.filter(a => (a.category || 'Uncategorized') === cat).length;
    div.innerHTML = `
            <span>${escapeHtml(cat)}</span>
            <span style="background: rgba(0,0,0,0.5); padding: 2px 6px; border-radius: 10px; font-size: 11px;">${count}</span>
        `;
    list.appendChild(div);
  });
}

function renderAssetGrid() {
  const grid = document.getElementById('assetGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const filtered = globalAssets.filter(a => (a.category || 'Uncategorized') === currentAssetCategory);
  filtered.forEach(asset => {
    const card = document.createElement('div');
    const isSelected = bulkSelectedAssets.has(asset.id);
    card.className = `asset-card ${isSelected ? 'bulk-selected' : ''}`;
    if (isSelected) card.style.border = '2px solid #ef4444';
    card.innerHTML = `
            <input type="checkbox" class="bulk-select-checkbox" ${isSelected ? 'checked' : ''} style="position: absolute; top: 12px; left: 12px; z-index: 10; transform: scale(2.2); cursor: pointer; accent-color: #ef4444;" onclick="toggleBulkSelect(${asset.id}, event)">

            <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.filename)}" loading="lazy" onclick="viewAssetFullscreen('${escapeHtml(asset.url)}')">
            <div class="asset-card-overlay">${escapeHtml(asset.filename)}</div>
            <div class="asset-card-actions">
                <button class="asset-action-btn" title="Copy URL" onclick="copyToClipboard('${escapeHtml(asset.url)}', event)"><i class="fas fa-link"></i></button>
                ${(activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller') || asset.user_id === currentUser?.id ? `
                    <button class="asset-action-btn" title="Move Category" onclick="moveAssetCategory(${asset.id}, event)"><i class="fas fa-folder-open"></i></button>
                    <button class="asset-action-btn" title="Delete" onclick="deleteAsset(${asset.id}, event)"><i class="fas fa-trash"></i></button>
                ` : ''}
            </div>
        `;
    grid.appendChild(card);
  });
  updateBulkActionsUI();
}

function viewAssetFullscreen(url) {
  window.open(url, '_blank');
}

function copyToClipboard(text, e) {
  if (e) e.stopPropagation();
  navigator.clipboard.writeText(text).then(() => alert('URL copied!'));
}

async function handleBulkAssetUpload(event) {
  if (!activeCampaignId) return;
  const files = event.target.files;
  if (!files || files.length === 0) return;
  const availableCats = ['Uncategorized', ...globalAssetCategories];
  const uploadCat = await vtmSelectPrompt('Select category to upload these ' + files.length + ' assets into:', 'Upload Assets', availableCats, currentAssetCategory);
  if (!uploadCat) {
    event.target.value = '';
    return;
  }
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const formData = new FormData();
    formData.append('file', file);
    formData.append('chronicleId', activeCampaignId);
    formData.append('category', uploadCat);
    try {
      const res = await authFetch('/api/assets/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        globalAssets.unshift(data.asset);
      }
    } catch (e) {
      console.error(e);
    }
  }
  event.target.value = '';
  renderAssetCategories();
  renderAssetGrid();
}

async function createNewAssetCategory() {
  const name = await vtmPrompt('Enter a name for the new Asset Category:', 'New Category');
  if (!name) return;
  try {
    const res = await authFetch('/api/asset-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicleId: activeCampaignId,
        name: name
      })
    });
    if (res.ok) {
      if (!globalAssetCategories.includes(name)) globalAssetCategories.push(name);
    }
  } catch (e) {
    console.error(e);
  }
  currentAssetCategory = name;
  document.getElementById('currentAssetCategoryTitle').innerText = name;
  renderAssetCategories();
  renderAssetGrid();
}

async function moveAssetCategory(assetId, e) {
  if (e) e.stopPropagation();
  const availableCats = ['Uncategorized', ...globalAssetCategories];
  const newCat = await vtmSelectPrompt('Move asset to category:', 'Move Asset', availableCats, 'Uncategorized');
  if (!newCat) return;
  const res = await authFetch(`/api/assets/${assetId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      category: newCat
    })
  });
  if (res.ok) {
    const asset = globalAssets.find(a => a.id === assetId);
    if (asset) asset.category = newCat;
    renderAssetCategories();
    renderAssetGrid();
  }
}

async function deleteAsset(assetId, e) {
  if (e) e.stopPropagation();
  const confirmed = await vtmConfirm('Are you sure you want to permanently delete this asset? It will be removed from the server.', 'Delete Asset');
  if (!confirmed) return;
  const res = await authFetch(`/api/assets/${assetId}`, {
    method: 'DELETE'
  });
  if (res.ok) {
    globalAssets = globalAssets.filter(a => a.id !== assetId);
    renderAssetCategories();
    renderAssetGrid();
  }
}

function openAssetPicker(callback) {
  assetPickerCallback = callback;
  document.getElementById('assetPickerModal').classList.add('active');
  renderPickerCategories();
  renderPickerGrid();
}

function closeAssetPicker() {
  document.getElementById('assetPickerModal').classList.remove('active');
  assetPickerCallback = null;
}

function renderPickerCategories() {
  const list = document.getElementById('pickerCategoriesList');
  if (!list) return;
  list.innerHTML = '';
  const activeCats2 = new Set(globalAssets.map(a => a.category).filter(c => c && c !== 'Uncategorized'));
  globalAssetCategories.forEach(c => activeCats2.add(c));
  if (currentAssetCategory && currentAssetCategory !== 'Uncategorized') activeCats2.add(currentAssetCategory);
  const categories = ['All', 'Uncategorized', ...Array.from(activeCats2)];
  categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = `asset-category-item ${cat === (window.pickerCurrentCat || 'All') ? 'active' : ''}`;
    div.style.padding = '6px 10px';
    div.innerText = cat;
    div.onclick = () => {
      window.pickerCurrentCat = cat;
      renderPickerCategories();
      renderPickerGrid();
    };
    list.appendChild(div);
  });
}

function renderPickerGrid() {
  const grid = document.getElementById('pickerGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const term = (document.getElementById('pickerSearchInput').value || '').toLowerCase();
  const currentCat = window.pickerCurrentCat || 'All';
  const filtered = globalAssets.filter(a => {
    if (currentCat !== 'All' && (a.category || 'Uncategorized') !== currentCat) return false;
    if (term && !a.filename.toLowerCase().includes(term)) return false;
    return true;
  });
  filtered.forEach(asset => {
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.onclick = () => {
      if (assetPickerCallback) assetPickerCallback(asset.url);
      closeAssetPicker();
    };
    card.innerHTML = `
            <img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.filename)}" loading="lazy">
            <div class="asset-card-overlay">${escapeHtml(asset.filename)}</div>
        `;
    grid.appendChild(card);
  });
}

async function handlePickerDirectUpload(event) {
  if (!activeCampaignId) return;
  const file = event.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('chronicleId', activeCampaignId);
  formData.append('category', window.pickerCurrentCat && window.pickerCurrentCat !== 'All' ? window.pickerCurrentCat : 'Uncategorized');
  try {
    const res = await authFetch('/api/assets/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      globalAssets.unshift(data.asset);
      if (assetPickerCallback) assetPickerCallback(data.asset.url);
      closeAssetPicker();
      renderAssetCategories();
      renderAssetGrid();
    }
  } catch (e) {
    console.error(e);
  }
  event.target.value = '';
}

function openImageCropper(imageUrl, aspectRatio, title, description, skipGallery = false, entityType = null, entityId = null) {
  return new Promise(resolve => {
    document.getElementById('cropperModeLabel').innerText = title;
    const imgEl = document.getElementById('cropperImageElement');
    imgEl.src = imageUrl;
    document.getElementById('imageCropperModal').classList.add('active');
    if (currentCropper) {
      currentCropper.destroy();
    }
    imgEl.onload = () => {
      currentCropper = new Cropper(imgEl, {
        aspectRatio: aspectRatio,
        viewMode: 0,
        background: false,
        zoomable: true,
        dragMode: "move",
        autoCropArea: 1
      });
    };
    cropperResolve = resolve;
    currentCropperSkipGallery = skipGallery;
    currentCropperEntityType = entityType;
    currentCropperEntityId = entityId;
  });
}

function closeImageCropper() {
  document.getElementById('imageCropperModal').classList.remove('active');
  if (currentCropper) {
    currentCropper.destroy();
    currentCropper = null;
  }
  if (cropperResolve) {
    cropperResolve(null);
    cropperResolve = null;
  }
}

async function confirmImageCrop() {
  if (!currentCropper) return;
  const canvas = currentCropper.getCroppedCanvas({
    width: 600,
    imageSmoothingQuality: 'high'
  });
  const base64Data = canvas.toDataURL('image/png');
  const resolveCb = cropperResolve;
  cropperResolve = null;
  closeImageCropper();
  if (!activeCampaignId) {
    if (resolveCb) resolveCb(base64Data);
    return;
  }
  if (!activeCampaignId) {
    if (resolveCb) resolveCb(base64Data);
    return;
  }
  try {
    const res = await authFetch('/api/assets/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicleId: activeCampaignId,
        category: 'Cropped Portraits',
        filename: 'crop_' + Date.now() + '.jpg',
        data: base64Data,
        skipGallery: currentCropperSkipGallery,
        entityType: currentCropperEntityType,
        entityId: currentCropperEntityId
      })
    });
    const data = await res.json();
    if (data.success && resolveCb) {
      resolveCb(data.asset.url);
    }
  } catch (e) {
    console.error(e);
    if (resolveCb) resolveCb(null);
  }
}

async function performDualCropForCharacter(sourceUrl, charId) {
  const avatarUrl = await openImageCropper(sourceUrl, 1, 'Step 1: Circle Token (1:1)', 'This first crop is for the small circular token displayed at the top of your character sheet and on the map. Frame it tightly around the face.', true, 'character_avatar', charId);
  if (!avatarUrl) return;
  const vaultUrl = await openImageCropper(sourceUrl, 2 / 3, 'Step 2: Vault Card (2:3)', 'This second crop is for the tall rectangular card displayed in the Character Vault. Frame the full body or bust.', true, 'character_vault', charId);
  if (!vaultUrl) return;
  try {
    const res = await authFetch(`/api/characters/${charId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        avatar_url: avatarUrl,
        vault_url: vaultUrl
      })
    });
    if (res.ok) {
      loadCharacters();
      const headerAvatar = document.getElementById('modalCharAvatarImg');
      if (headerAvatar) headerAvatar.src = avatarUrl;
      const sheetAvatar = document.getElementById('dossierAvatarImg');
      if (sheetAvatar) sheetAvatar.src = avatarUrl;
      const charObj = campaignCharactersList.find(c => c.id === charId);
      if (charObj) {
        charObj.avatar_url = avatarUrl;
        charObj.vault_url = vaultUrl;
      }
      if (typeof renderCharacterVault === 'function') renderCharacterVaultCards();
    }
  } catch (e) {
    console.error(e);
  }
}

async function performProfileCrop(sourceUrl) {
  const avatarUrl = await openImageCropper(sourceUrl, 1, 'Profile Picture (1:1)', 'Frame your profile picture. It will be displayed as a circle across the VTT.', true, 'user_profile', currentUser ? currentUser.id : 'unknown');
  if (!avatarUrl) return;
  try {
    const res = await authFetch('/api/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        avatar: avatarUrl
      })
    });
    if (res.ok) {
      currentUser.avatar = avatarUrl;
      currentUser.avatar_url = avatarUrl;
      const profInput = document.getElementById('profileAvatarInput');
      if (profInput) profInput.value = avatarUrl;
      if (typeof socket !== 'undefined' && socket && activeCampaignId) {
        socket.emit('room:join', {
          campaignId: activeCampaignId,
          userId: currentUser ? currentUser.id : null,
          username: currentUser ? currentUser.username : 'User',
          displayName: currentUser ? currentUser.displayName || currentUser.username : 'User',
          role: activeCampaignRole,
          characterId: activeControlledCharacterId || null,
          avatar: currentUser.avatar || currentUser.avatar_url
        });
      } else {
        if (typeof renderActivePlayersBar === "function") renderActivePlayersBar(currentCampaignActiveUsers);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function vtmSelectPrompt(message, title = 'Select Option', options = [], defaultValue = '') {
  return new Promise(resolve => {
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
    options.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt;
      el.innerText = opt;
      if (opt === defaultValue) el.selected = true;
      selectField.appendChild(el);
    });
    const cancelBtn = document.getElementById('vtmDialogCancelBtn');
    cancelBtn.style.display = 'block';
    cancelBtn.innerText = 'Cancel';
    const confirmBtn = document.getElementById('vtmDialogConfirmBtn');
    confirmBtn.innerText = 'Save';
    const modal = document.getElementById('vtmDialogModal');
    modal.classList.add('active');
    setTimeout(() => selectField.focus(), 50);
    const cleanup = () => {
      modal.classList.remove('active');
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
      selectField.onkeydown = null;
      inputField.style.display = 'block';
      selectField.style.display = 'none';
    };
    const submit = () => {
      cleanup();
      resolve(selectField.value);
    };
    confirmBtn.onclick = submit;
    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };
    selectField.onkeydown = e => {
      if (e.key === 'Enter') submit();
      if (e.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    };
  });
}

function vtmAlert(message, title = 'Notice') {
  return new Promise(resolve => {
    document.getElementById('vtmDialogTitle').innerText = title;
    document.getElementById('vtmDialogMessage').innerText = message;
    document.getElementById('vtmDialogIcon').className = 'fa-solid fa-circle-info';
    document.getElementById('vtmDialogInputContainer').style.display = 'none';
    document.getElementById('vtmDialogCancelBtn').style.display = 'none';
    const confirmBtn = document.getElementById('vtmDialogConfirmBtn');
    confirmBtn.innerText = 'OK';
    const modal = document.getElementById('vtmDialogModal');
    modal.classList.add('active');
    const cleanup = () => {
      modal.classList.remove('active');
      confirmBtn.onclick = null;
    };
    confirmBtn.onclick = () => {
      cleanup();
      resolve();
    };
  });
}

function vtmConfirm(message, title = 'Confirm') {
  return new Promise(resolve => {
    document.getElementById('vtmDialogTitle').innerText = title;
    document.getElementById('vtmDialogMessage').innerText = message;
    document.getElementById('vtmDialogIcon').className = 'fa-solid fa-triangle-exclamation';
    document.getElementById('vtmDialogInputContainer').style.display = 'none';
    const cancelBtn = document.getElementById('vtmDialogCancelBtn');
    cancelBtn.style.display = 'block';
    cancelBtn.innerText = 'Cancel';
    const confirmBtn = document.getElementById('vtmDialogConfirmBtn');
    confirmBtn.innerText = 'Confirm';
    const modal = document.getElementById('vtmDialogModal');
    modal.classList.add('active');
    const cleanup = () => {
      modal.classList.remove('active');
      confirmBtn.onclick = null;
      cancelBtn.onclick = null;
    };
    confirmBtn.onclick = () => {
      cleanup();
      resolve(true);
    };
    cancelBtn.onclick = () => {
      cleanup();
      resolve(false);
    };
  });
}

function toggleBulkSelect(assetId, event) {
  if (event) event.stopPropagation();
  if (bulkSelectedAssets.has(assetId)) {
    bulkSelectedAssets.delete(assetId);
  } else {
    bulkSelectedAssets.add(assetId);
  }
  renderAssetGrid();
}

function updateBulkActionsUI() {
  const container = document.getElementById('bulkActionsContainer');
  const countSpan = document.getElementById('bulkSelectCount');
  if (!container || !countSpan) return;
  if (bulkSelectedAssets.size > 0) {
    container.style.display = 'flex';
    countSpan.innerText = `${bulkSelectedAssets.size} selected`;
  } else {
    container.style.display = 'none';
  }
}

async function bulkMoveAssets() {
  if (bulkSelectedAssets.size === 0) return;
  const availableCats = ['Uncategorized', ...globalAssetCategories];
  const newCat = await vtmSelectPrompt(`Move ${bulkSelectedAssets.size} assets to category:`, 'Bulk Move', availableCats, 'Uncategorized');
  if (!newCat) return;
  for (const id of bulkSelectedAssets) {
    const res = await authFetch(`/api/assets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category: newCat
      })
    });
    if (res.ok) {
      const asset = globalAssets.find(a => a.id === id);
      if (asset) asset.category = newCat;
    }
  }
  bulkSelectedAssets.clear();
  renderAssetCategories();
  renderAssetGrid();
}

async function bulkDeleteAssets() {
  if (bulkSelectedAssets.size === 0) return;
  const confirmed = await vtmConfirm(`Are you sure you want to permanently delete ${bulkSelectedAssets.size} assets?`, 'Bulk Delete');
  if (!confirmed) return;
  for (const id of bulkSelectedAssets) {
    const res = await authFetch(`/api/assets/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      globalAssets = globalAssets.filter(a => a.id !== id);
    }
  }
  bulkSelectedAssets.clear();
  renderAssetCategories();
  renderAssetGrid();
}

function toggleSelectAllAssets() {
  const filtered = globalAssets.filter(a => (a.category || 'Uncategorized') === currentAssetCategory);
  if (bulkSelectedAssets.size === filtered.length && filtered.length > 0) {
    bulkSelectedAssets.clear();
  } else {
    filtered.forEach(a => bulkSelectedAssets.add(a.id));
  }
  renderAssetGrid();
}

async function fetchClanSymbols() {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/clan-symbols?chronicleId=${activeCampaignId}`);
    if (res.ok) {
      globalClanSymbols = await res.json();
      renderCharacterVaultCards();
    }
  } catch (e) {
    console.error(e);
  }
}

function openClanSymbolsModal() {
  document.getElementById('newClanSymbolName').value = '';
  document.getElementById('customClanSymbolNameInput').value = '';
  document.getElementById('newClanSymbolName').style.display = 'block';
  if (document.getElementById('customClanSymbolNameContainer')) document.getElementById('customClanSymbolNameContainer').style.display = 'none';
  document.getElementById('clanSymbolsModal').classList.add('active');
  renderClanSymbolsList();
}

function renderClanSymbolsList() {
  const list = document.getElementById('clanSymbolsList');
  list.innerHTML = '';
  if (globalClanSymbols.length === 0) {
    list.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">No clan symbols mapped yet.</div>';
    return;
  }
  globalClanSymbols.forEach(sym => {
    const div = document.createElement('div');
    div.className = 'clan-symbol-item';
    div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <img src="${escapeHtml(sym.symbol_url)}" alt="Symbol">
                <div style="color: white; font-family: 'Cinzel', serif;">${escapeHtml(sym.clan_name)}</div>
            </div>
            <button class="btn-action-outline text-danger" style="padding: 4px 8px; font-size: 12px; border-color: #ef4444; color: #ef4444;" onclick="deleteClanSymbol(${sym.id})"><i class="fa-solid fa-trash"></i></button>
        `;
    list.appendChild(div);
  });
}

function assignNewClanSymbol() {
  const nameSelect = document.getElementById('newClanSymbolName');
  const nameTextInput = document.getElementById('customClanSymbolNameInput');
  let clanName = nameSelect.value;
  if (clanName === 'custom') {
    clanName = nameTextInput.value.trim();
  } else {
    clanName = clanName ? clanName.trim() : '';
  }
  if (!clanName) return vtmAlert('Please select a Clan first.', 'Missing Info');
  if (globalClanSymbols.find(s => s.clan_name.toLowerCase() === clanName.toLowerCase())) {
    return vtmAlert('Symbol for this clan already exists. Delete the old one first or it will be overwritten.', 'Warning');
  }
  document.getElementById('clanSymbolsModal').classList.remove('active');
  openAssetPicker(async url => {
    if (!url) {
      document.getElementById('clanSymbolsModal').classList.add('active');
      return;
    }
    const croppedUrl = await openImageCropper(url, 1, 'Clan Symbol (1:1)', 'Crop the clan symbol. It will be displayed in the small bubble at the bottom of Character Vault cards.', true, 'clan_symbol', clanName);
    document.getElementById('clanSymbolsModal').classList.add('active');
    if (!croppedUrl) return;
    try {
      const res = await authFetch('/api/clan-symbols', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chronicleId: activeCampaignId,
          clan_name: clanName,
          symbol_url: croppedUrl
        })
      });
      if (res.ok) {
        nameSelect.value = '';
        nameTextInput.value = '';
        if (document.getElementById('customClanSymbolNameContainer')) document.getElementById('customClanSymbolNameContainer').style.display = 'none';
        nameSelect.style.display = 'block';
        await fetchClanSymbols();
        renderClanSymbolsList();
      }
    } catch (e) {
      console.error(e);
    }
  });
}

async function deleteClanSymbol(id) {
  if (!await vtmConfirm('Are you sure you want to delete this Clan Symbol mapping?')) return;
  try {
    const res = await authFetch(`/api/clan-symbols/${id}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      globalClanSymbols = globalClanSymbols.filter(s => s.id !== id);
      renderClanSymbolsList();
      renderCharacterVaultCards();
    }
  } catch (e) {
    console.error(e);
  }
}

function toggleTimeWidget() {
  if (activeCampaignRole !== 'gm' && activeCampaignRole !== 'storyteller') return;
  const w = document.getElementById('timeWidget');
  if (!w) return;
  if (w.style.display === 'none' || !w.style.display) {
    w.style.display = 'block';
    const clock = document.getElementById('gameClock');
    if (clock) document.getElementById('timeWidgetInput').value = (clock.innerText || clock.textContent || '').trim();
    if (typeof makeFloating === 'function') makeFloating(w, document.getElementById('timeWidgetHeader'));
  } else {
    w.style.display = 'none';
  }
}

async function saveGameTime() {
  const val = document.getElementById('timeWidgetInput').value.trim();
  if (!val) return;
  try {
    const res = await authFetch('/api/gameboard/scene', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicle_id: activeCampaignId,
        game_time: val
      })
    });
    if (res.ok) {
      toggleTimeWidget();
    }
  } catch (e) {
    console.error(e);
  }
}

function togglePlayerDrawer() {
  const drawer = document.getElementById('playerRosterDrawer');
  if (drawer) {
    drawer.classList.toggle('open');
  }
}

async function changeMemberRole(userId, newRole) {
  if (!activeCampaignId) return;
  try {
    const res = await authFetch(`/api/chronicles/${activeCampaignId}/members/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: newRole
      })
    });
    if (res.ok) {
      alert('Role updated successfully.');
      openCoterieManagementModal();
    } else {
      const data = await res.json();
      alert('Failed to update role: ' + (data.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Failed to update role.');
  }
}


async function deleteActiveCampaign() {
  const campId = document.getElementById('campaignSelect').value;
  if (!campId) return;
  const confirmed = await vtmConfirm('Are you sure you want to delete this Campaign/Arc and all its episodes?', 'Delete Campaign');
  if (!confirmed) return;
  try {
    const res = await authFetch(`/api/campaigns/${campId}`, { method: 'DELETE' });
    if (res.ok) {
      loadCampaignsList();
    } else {
      const data = await res.json();
      vtmAlert(data.error || 'Failed to delete campaign', 'Error');
    }
  } catch (e) {
    console.error(e);
  }
}

async function deleteEpisode(epId, e) {
  if (e) e.stopPropagation();
  const confirmed = await vtmConfirm('Are you sure you want to delete this episode?', 'Delete Episode');
  if (!confirmed) return;
  try {
    const res = await authFetch(`/api/episodes/${epId}`, { method: 'DELETE' });
    if (res.ok) {
      loadEpisodes();
    } else {
      const data = await res.json();
      vtmAlert(data.error || 'Failed to delete episode', 'Error');
    }
  } catch (e) {
    console.error(e);
  }
}

async function saveCharacterShortName(val) {
  if (!currentLoadedCharacterId) return;
  try {
    const res = await authFetch(`/api/characters/${currentLoadedCharacterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ short_name: val })
    });
    if (res.ok) {
      const char = campaignCharactersList.find(c => c.id === currentLoadedCharacterId);
      if (char) char.short_name = val;
      if (typeof renderCharacterVaultCards === 'function') renderCharacterVaultCards();
      if (typeof renderNpcCastWidget === 'function') renderNpcCastWidget();
      // Emitting the update so remote clients see the short name update on the board/vault immediately
      if (typeof socket !== 'undefined' && activeCampaignId) {
        socket.emit('character:update', { id: currentLoadedCharacterId });
      }
    }
  } catch(e) {
    console.error(e);
  }
}

function openFloatingCharacterSheet(charId) {
  const desktop = document.getElementById('elysiumDesktop');
  if (!desktop) return;
  const char = campaignCharactersList.find(c => c.id === charId);
  if (!char) return;
  
  const widgetId = `floating-sheet-${charId}`;
  if (document.getElementById(widgetId)) {
    bringDesktopWidgetToFront(document.getElementById(widgetId));
    return;
  }
  
  const isGM = activeCampaignRole === 'gm' || activeCampaignRole === 'storyteller';
  const ownerUserId = char.user_id;
  const isOwner = currentUser && currentUser.id === ownerUserId;
  const authList = Array.isArray(char.authorized_user_ids) ? char.authorized_user_ids : [];
  const isAuthorizedPilot = currentUser && authList.includes(currentUser.id);
  const canEdit = isGM || isOwner || isAuthorizedPilot;
  
  let sheetTemplate = 'V5-Character-Sheet.html';
  if (char && char.sheet_data) {
    let parsed = char.sheet_data;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (e) {}
    }
    if (parsed.sheet_template && typeof parsed.sheet_template === "string" && parsed.sheet_template.endsWith(".html")) sheetTemplate = parsed.sheet_template;
  }
  
  const widget = document.createElement('div');
  widget.className = 'elysium-widget widget-matrix-popup';
  widget.id = widgetId;
  widget.style.position = 'absolute';
  widget.style.left = '50px';
  widget.style.top = '50px';
  widget.style.width = '880px';
  widget.style.height = '85vh';
  widget.style.zIndex = '1000';
  
  widget.innerHTML = `
    <div class="widget-header" style="cursor:move;">
        <div style="display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-file-lines" style="color:#ef4444;"></i> 
            <span style="font-weight:bold;color:#f3f4f6;font-family:'Cinzel', serif;">${escapeHtml(char.short_name || char.name)}</span>
            <span style="font-size:10px;color:#9ca3af;font-family:'Inter', sans-serif;">(${escapeHtml(char.clan || 'Unknown')})</span>
        </div>
        <div class="widget-header-controls">
            
            ${canEdit ? `<button class="btn-action-outline btn-sm" onclick="toggleIframePrivacyEditMode(this)" style="border-color:#6b7280; color:#9ca3af; margin-right:8px; padding:2px 6px; font-size:10px;"><i class="fa-solid fa-user-secret"></i> Edit Privacy</button>` : ''}
            <button onclick="this.closest('.elysium-widget').remove()"><i class="fa-solid fa-xmark"></i></button>

        </div>
    </div>
    <div class="widget-body" style="padding:0; overflow:hidden; height: calc(100% - 30px);">
        <iframe src="/sheets/${sheetTemplate}?char_id=${charId}&readonly=${!canEdit}&_t=${Date.now()}" style="width:100%; height:100%; border:none; background:transparent;"></iframe>
    </div>
    <div class="widget-resize-handle"></div>
  `;
  
  desktop.appendChild(widget);
  if (typeof initDesktopWidgetsDragAndResize === 'function') {
    initDesktopWidgetsDragAndResize();
  }
  bringDesktopWidgetToFront(widget);
}

function loadAndShowDossier(charId) {
  loadCharacterDossierWidget(charId);
  const w = document.getElementById('widget-dossier');
  if (w) {
    w.style.display = 'flex';
    bringDesktopWidgetToFront(w);
  }
}

function openFloatingDossierWidget(charId) {
  const desktop = document.getElementById('elysiumDesktop');
  if (!desktop) return;
  const char = campaignCharactersList.find(c => c.id === charId);
  if (!char) return;
  
  const widgetId = `widget-dossier-${charId}`;
  if (document.getElementById(widgetId)) {
    bringDesktopWidgetToFront(document.getElementById(widgetId));
    return;
  }

  const templateWidget = document.getElementById('widget-dossier');
  if (!templateWidget) return;

  // We want the inner HTML of the dossier widget, but we'll recreate the shell so it's draggable
  let htmlStr = templateWidget.innerHTML;
  
  // Replace IDs: id="dossierXXX" -> id="dossierXXX-charId"
  htmlStr = htmlStr.replace(/id="dossier([A-Za-z0-9_]+)"/g, `id="dossier$1-${charId}"`);
  
  // Replace adjustDossierVitals calls
  htmlStr = htmlStr.replace(/onclick="triggerDossierAvatarUpload\\(\\)"/g, `onclick="triggerDossierAvatarUpload(${charId})`); htmlStr = htmlStr.replace(/adjustDossierVitals\('([^']+)',\s*(-?[0-9]+)\)/g, `adjustDossierVitals('$1', $2, ${charId})`);
  
  // cycleDossierDamagePip calls are generated dynamically in updateDossierWidget!
  // Wait! We don't need to regex them in the HTML, because updateDossierWidget generates them!
  // BUT we must update updateDossierWidget to generate them with charId!
  
  const widget = document.createElement('div');
  widget.className = 'elysium-widget widget-matrix-popup';
  widget.id = widgetId;
  widget.style.position = 'absolute';
  widget.style.left = '100px';
  widget.style.top = '100px';
  widget.style.width = '340px';
  widget.style.height = '700px';
  widget.style.zIndex = '1000';
  
  widget.innerHTML = htmlStr;
  
  // Remove the toggle buttons in the cloned header and replace with close button
  const actionsWrap = widget.querySelector('.widget-actions');
  if (actionsWrap) {
    actionsWrap.innerHTML = `
      <button class="btn-w-ctrl" onclick="openFloatingCharacterSheet(${charId})" title="Expand Full Sheet"><i class="fa-solid fa-up-right-from-square"></i></button>
      <button class="btn-w-ctrl" onclick="this.closest('.elysium-widget').remove()">×</button>
    `;
  }
  
  // Make the header draggable
  const header = widget.querySelector('.widget-header');
  if (header) {
    header.style.cursor = 'move';
  }
  
  // Append a resize handle
  const resizer = document.createElement('div');
  resizer.className = 'widget-resize-handle';
  widget.appendChild(resizer);
  
  desktop.appendChild(widget);
  
  if (typeof initDesktopWidgetsDragAndResize === 'function') {
    initDesktopWidgetsDragAndResize();
  }
  bringDesktopWidgetToFront(widget);
  
  updateDossierWidget(char, widgetId);
}



let privacyExpandedSections = {};
let currentPrivacyConcealedFields = [];
let privacyWidgetTargetCharId = null;
let currentHiddenFromFields = null;

const PRIVACY_SECTION_MAP = {
    'section_profile': { label: 'Profile', fields: ['name', 'concept', 'predator', 'chronicle', 'ambition', 'clan', 'sire', 'desire', 'generation'] },
    'section_attributes': { label: 'Attributes', fields: ['strength', 'dexterity', 'stamina', 'charisma', 'manipulation', 'composure', 'intelligence', 'wits', 'resolve'] },
    'section_vitals': { label: 'Health & Willpower', fields: ['health_states', 'willpower_states', 'humanity_states'] },
    'section_skills': { label: 'Skills', fields: ['athletics', 'brawl', 'craft', 'drive', 'firearms', 'larceny', 'melee', 'stealth', 'survival', 'animal_ken', 'etiquette', 'insight', 'intimidation', 'leadership', 'performance', 'persuasion', 'streetwise', 'subterfuge', 'academics', 'awareness', 'finance', 'investigation', 'medicine', 'occult', 'politics', 'science', 'technology'] },
    'section_disciplines': { label: 'Disciplines', fields: [] },
    'section_advantages': { label: 'Advantages', fields: [] },
    'section_biography': { label: 'Biography', fields: ['chronicle_tenets', 'touchstones_convictions', 'clan_bane', 'notes', 'history', 'appearance', 'distinguishing_features'] }
};

// Populate the dynamic arrays
for(let i=0; i<=5; i++) {
    PRIVACY_SECTION_MAP.section_disciplines.fields.push('discipline_name_' + i);
    PRIVACY_SECTION_MAP.section_disciplines.fields.push('discipline_dots_' + i);
    for(let j=0; j<5; j++) PRIVACY_SECTION_MAP.section_disciplines.fields.push('discipline_power_' + i + '_' + j);
}
for(let i=1; i<=9; i++) {
    PRIVACY_SECTION_MAP.section_advantages.fields.push('adv_flaw_name_' + i);
    PRIVACY_SECTION_MAP.section_advantages.fields.push('adv_flaw_rating_' + i);
}

function togglePrivacyEditMode() {
    const btn = document.getElementById('btnPrivacyModeToggle');
    if (btn.classList.contains('active-pilot')) {
        btn.classList.remove('active-pilot');
        btn.style.borderColor = '#6b7280';
        btn.style.color = '#9ca3af';
        const w = document.getElementById('parentPrivacyManagerWidget');
        if (w) w.style.display = 'none';
    } else {
        btn.classList.add('active-pilot');
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#ef4444';
        openMasterPrivacyWidget(currentLoadedCharacterId);
    }
}

function toggleIframePrivacyEditMode(btn) {
    if (btn.classList.contains('active-pilot')) {
        btn.classList.remove('active-pilot');
        btn.style.borderColor = '#6b7280';
        btn.style.color = '#9ca3af';
        const w = document.getElementById('parentPrivacyManagerWidget');
        if (w) w.style.display = 'none';
    } else {
        btn.classList.add('active-pilot');
        btn.style.borderColor = '#ef4444';
        btn.style.color = '#ef4444';
        // Extract charId from widget id if needed, or assume currentLoadedCharacterId
        const widget = btn.closest('.elysium-widget');
        const match = widget.id.match(/floating-sheet-(\d+)/);
        const charId = match ? parseInt(match[1]) : currentLoadedCharacterId;
        openMasterPrivacyWidget(charId);
    }
}

async function fetchCurrentPrivacyFields(charId) {
    const char = campaignCharactersList.find(c => c.id === charId);
    if (!char) return [];
    if (typeof char.concealed_fields === 'string') {
        try { return JSON.parse(char.concealed_fields); } catch(e) { return []; }
    }
    if (Array.isArray(char.concealed_fields)) return char.concealed_fields;
    return [];
}

async function fetchCurrentVisibilityFields(charId) {
    const char = campaignCharactersList.find(c => c.id === charId);
    if (!char) return null;
    if (typeof char.hidden_from_user_ids === 'string') {
        try { return JSON.parse(char.hidden_from_user_ids); } catch(e) { return null; }
    }
    if (Array.isArray(char.hidden_from_user_ids)) return char.hidden_from_user_ids;
    return [];
}

async function updateVisibilitySettings() {
    const token = localStorage.getItem('vtm_auth_token');
    if (!privacyWidgetTargetCharId) return;
    try {
        await fetch('/api/characters/' + privacyWidgetTargetCharId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            },
            body: JSON.stringify({ hidden_from_user_ids: currentHiddenFromFields })
        });
        const char = campaignCharactersList.find(c => c.id === privacyWidgetTargetCharId);
        if (char) char.hidden_from_user_ids = currentHiddenFromFields;
        
        // Reload widgets to show badge
        if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
        if (typeof renderNpcCastWidget === 'function') renderNpcCastWidget();
    } catch(e) {
        console.error(e);
    }
}

async function toggleVisibilityMember(userId) {
    if (!currentHiddenFromFields) currentHiddenFromFields = [];
    if (currentHiddenFromFields.includes(userId)) {
        currentHiddenFromFields = currentHiddenFromFields.filter(id => id !== userId);
    } else {
        currentHiddenFromFields.push(userId);
    }
    if (currentHiddenFromFields.length === 0) currentHiddenFromFields = null;
    await updateVisibilitySettings();
    populateParentPrivacyWidget();
}

async function toggleConcealmentItem(fieldOrSectionId) {
    if (!fieldOrSectionId) return;
    if (currentPrivacyConcealedFields.includes(fieldOrSectionId)) {
        currentPrivacyConcealedFields = currentPrivacyConcealedFields.filter(id => id !== fieldOrSectionId);
    } else {
        currentPrivacyConcealedFields.push(fieldOrSectionId);
    }
    
    const token = localStorage.getItem('vtm_auth_token');
    if (!privacyWidgetTargetCharId) return;
    try {
        await fetch('/api/characters/' + privacyWidgetTargetCharId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            },
            body: JSON.stringify({ concealed_fields: currentPrivacyConcealedFields })
        });
        
        // Update local list
        const char = campaignCharactersList.find(c => c.id === privacyWidgetTargetCharId);
        if (char) char.concealed_fields = currentPrivacyConcealedFields;
        
        // Push update to iframes
        document.querySelectorAll('iframe').forEach(iframe => {
            if (iframe.src.includes('V5-Character-Sheet') && iframe.src.includes('char_id=' + privacyWidgetTargetCharId)) {
                iframe.contentWindow.postMessage({ type: 'APPLY_REDACTION', concealedFields: currentPrivacyConcealedFields }, '*');
            }
        });
        
        // Reload Dossier
        if (typeof updateDossierWidget === 'function') {
            updateDossierWidget(char);
            const floatDossier = document.getElementById('widget-dossier-' + privacyWidgetTargetCharId);
            if (floatDossier) updateDossierWidget(char, floatDossier.id);
        }
        
    } catch(e) {
        console.error(e);
    }
    
    populateParentPrivacyWidget();
}

async function openMasterPrivacyWidget(charId) {
    privacyWidgetTargetCharId = charId;
    currentPrivacyConcealedFields = await fetchCurrentPrivacyFields(charId);
    currentHiddenFromFields = await fetchCurrentVisibilityFields(charId);
    
    let w = document.getElementById('parentPrivacyManagerWidget');
    if (!w) {
        w = document.createElement('div');
        w.id = 'parentPrivacyManagerWidget';
        w.className = 'elysium-widget';
        w.style.position = 'absolute';
        w.style.top = '100px';
        w.style.left = '100px';
        w.style.width = '300px';
        w.style.height = '450px';
        w.style.background = 'rgba(18,25,34,0.95)';
        w.style.border = '1px solid #7f1d1d';
        w.style.borderRadius = '6px';
        w.style.boxShadow = '0 4px 12px rgba(0,0,0,0.8)';
        w.style.display = 'flex';
        w.style.flexDirection = 'column';
        w.style.zIndex = '100000';
        
        // Resize logic
        w.style.resize = 'both';
        w.style.overflow = 'hidden';
        
        // Drag logic
        let isDragging = false;
        let dragStartX, dragStartY, initialLeft, initialTop;
        const header = document.createElement('div');
        header.id = 'parentPmWidgetHeader';
        header.style.padding = '8px';
        header.style.background = 'rgba(0,0,0,0.5)';
        header.style.borderBottom = '1px solid #372128';
        header.style.cursor = 'move';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.innerHTML = `<span style="color:#f3f4f6; font-family:'Bebas Neue', sans-serif; letter-spacing:1px; font-size:16px;">PRIVACY MANAGER</span>
                            <button id="parentPmClose" style="background:none;border:none;color:#9ca3af;cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>`;
        
        header.onmousedown = (e) => {
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            initialLeft = w.offsetLeft;
            initialTop = w.offsetTop;
            if (typeof bringDesktopWidgetToFront === 'function') bringDesktopWidgetToFront(w);
        };
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            w.style.left = (initialLeft + (e.clientX - dragStartX)) + 'px';
            w.style.top = (initialTop + (e.clientY - dragStartY)) + 'px';
        });
        document.addEventListener('mouseup', () => { isDragging = false; });
        
        w.appendChild(header);
        
        const body = document.createElement('div');
        body.id = 'parentPmWidgetBody';
        body.style.padding = '0';
        body.style.display = 'flex';
        body.style.flexDirection = 'column';
        body.style.overflowY = 'auto';
        body.style.flex = '1';
        
        w.appendChild(body);
        document.body.appendChild(w);
        
        document.getElementById('parentPmClose').onclick = () => {
            w.style.display = 'none';
            // Un-highlight buttons
            document.querySelectorAll('#btnPrivacyModeToggle, .elysium-widget button').forEach(b => {
                if (b.innerText && b.innerText.includes('Edit Privacy') && b.classList.contains('active-pilot')) {
                    b.classList.remove('active-pilot');
                    b.style.borderColor = '#6b7280';
                    b.style.color = '#9ca3af';
                }
            });
        };
    }
    
    if (typeof bringDesktopWidgetToFront === 'function') bringDesktopWidgetToFront(w);
    populateParentPrivacyWidget();
    w.style.display = 'flex';
}

function populateParentPrivacyWidget() {
    const body = document.getElementById('parentPmWidgetBody');
    if (!body) return;
    body.innerHTML = '';
    
    
    // ADVANCED CHARACTER VISIBILITY ACCORDION
    const isVisExpanded = privacyExpandedSections['advanced_visibility'] || false;
    const isRestricted = currentHiddenFromFields !== null;
    
    const visHeaderRow = document.createElement('div');
    visHeaderRow.style.display = 'flex';
    visHeaderRow.style.justifyContent = 'space-between';
    visHeaderRow.style.alignItems = 'center';
    visHeaderRow.style.padding = '10px 12px';
    visHeaderRow.style.background = isVisExpanded ? 'rgba(0,0,0,0.3)' : 'transparent';
    visHeaderRow.style.borderBottom = '2px solid #ef4444';
    visHeaderRow.style.cursor = 'pointer';
    
    const visTitleWrap = document.createElement('div');
    visTitleWrap.style.display = 'flex';
    visTitleWrap.style.alignItems = 'center';
    visTitleWrap.style.gap = '10px';
        visTitleWrap.innerHTML = `<i class="fa-solid ${isVisExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="color:#ef4444;font-size:12px;width:12px;"></i>
                           <span style="color:#f87171; font-size:14px; font-family:'Bebas Neue', sans-serif; letter-spacing:1px;">HIDE FROM PLAYERS</span>`;
                           
    visTitleWrap.onclick = () => {
        privacyExpandedSections['advanced_visibility'] = !privacyExpandedSections['advanced_visibility'];
        populateParentPrivacyWidget();
    };
    
    visHeaderRow.appendChild(visTitleWrap);
    body.appendChild(visHeaderRow);

    if (isVisExpanded) {
        const visContainer = document.createElement('div');
        visContainer.style.padding = '12px 12px 12px 28px';
        visContainer.style.background = 'rgba(0,0,0,0.1)';
        visContainer.style.borderBottom = '1px solid #372128';
        visContainer.style.display = 'flex';
        visContainer.style.flexDirection = 'column';
        visContainer.style.gap = '8px';
        
        const helperText = document.createElement('span');
        helperText.style.color = '#ef4444';
        helperText.style.fontSize = '10px';
        helperText.style.fontStyle = 'italic';
        helperText.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Check the players who should NOT see this character.';
        visContainer.appendChild(helperText);
        
        const listWrap = document.createElement('div');
        listWrap.style.display = 'flex';
        listWrap.style.flexDirection = 'column';
        listWrap.style.gap = '6px';
        listWrap.style.marginTop = '4px';
        
        const activeMembers = campaignMembersList.filter(m => m.status === 'active');
        if (activeMembers.length === 0) {
            listWrap.innerHTML = '<span style="color:#9ca3af;font-size:11px;font-style:italic;">No other players at this table.</span>';
        } else {
            const char = campaignCharactersList.find(c => c.id === privacyWidgetTargetCharId);
            const ownerId = char ? char.user_id : null;
            
            activeMembers.forEach(m => {
                const mRow = document.createElement('div');
                mRow.style.display = 'flex';
                mRow.style.alignItems = 'center';
                mRow.style.gap = '8px';
                
                const isOwner = m.id === ownerId;
                const isGM = m.role === 'storyteller' || (currentCampaignData && m.id === currentCampaignData.gm_id);
                
                const forceAllowed = isOwner || isGM;
                const isHiddenFromThem = forceAllowed ? false : (currentHiddenFromFields || []).includes(m.id);
                
                let extraLabel = '';
                if (isOwner) extraLabel = ' <span style="color:#60a5fa;">(Owner)</span>';
                else if (isGM) extraLabel = ' <span style="color:#f59e0b;">(ST)</span>';

                mRow.innerHTML = `<input type="checkbox" id="vis_member_${m.id}" ${isHiddenFromThem ? 'checked' : ''} ${forceAllowed ? 'disabled' : ''}>
                                   <label for="vis_member_${m.id}" style="color:${forceAllowed ? '#6b7280' : '#9ca3af'}; font-size:11px; cursor:${forceAllowed ? 'not-allowed' : 'pointer'};">${m.username}${extraLabel}</label>`;
                                   
                if (!forceAllowed) {
                    mRow.querySelector('input').onchange = () => { toggleVisibilityMember(m.id); };
                }
                listWrap.appendChild(mRow);
            });
            if (listWrap.children.length === 0) {
                 listWrap.innerHTML = '<span style="color:#9ca3af;font-size:11px;font-style:italic;">Only GM and Owner present.</span>';
            }
        }
        visContainer.appendChild(listWrap);
        body.appendChild(visContainer);
    }
    
    // NORMAL PRIVACY ACCORDIONS
    for (const [secId, secData] of Object.entries(PRIVACY_SECTION_MAP)) {
        const isExpanded = privacyExpandedSections[secId] || false;
        const isSectionHidden = currentPrivacyConcealedFields.includes(secId);
        
        // Accordion Header
        const headerRow = document.createElement('div');
        headerRow.style.display = 'flex';
        headerRow.style.justifyContent = 'space-between';
        headerRow.style.alignItems = 'center';
        headerRow.style.padding = '10px 12px';
        headerRow.style.background = isExpanded ? 'rgba(0,0,0,0.3)' : 'transparent';
        headerRow.style.borderBottom = '1px solid #372128';
        headerRow.style.cursor = 'pointer';
        
        const titleWrap = document.createElement('div');
        titleWrap.style.display = 'flex';
        titleWrap.style.alignItems = 'center';
        titleWrap.style.gap = '10px';
        titleWrap.innerHTML = `<i class="fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="color:#9ca3af;font-size:12px;width:12px;"></i>
                               <span style="color:#f3f4f6; font-size:14px; font-family:'Bebas Neue', sans-serif; letter-spacing:1px;">${secData.label.toUpperCase()}</span>`;
        titleWrap.onclick = () => {
            privacyExpandedSections[secId] = !privacyExpandedSections[secId];
            populateParentPrivacyWidget();
        };
        
        const toggleBtn = document.createElement('button');
        toggleBtn.style.background = 'none';
        toggleBtn.style.border = 'none';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.style.fontSize = '16px';
        toggleBtn.innerHTML = isSectionHidden ? '<i class="fa-solid fa-eye-slash" style="color:#ef4444;"></i>' : '<i class="fa-solid fa-eye" style="color:#9ca3af;"></i>';
        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            toggleConcealmentItem(secId);
        };
        
        headerRow.appendChild(titleWrap);
        headerRow.appendChild(toggleBtn);
        body.appendChild(headerRow);
        
        // Accordion Body
        if (isExpanded) {
            const fieldContainer = document.createElement('div');
            fieldContainer.style.padding = '8px 12px 12px 28px';
            fieldContainer.style.background = 'rgba(0,0,0,0.1)';
            fieldContainer.style.borderBottom = '1px solid #372128';
            fieldContainer.style.display = 'flex';
            fieldContainer.style.flexDirection = 'column';
            fieldContainer.style.gap = '8px';
            
            secData.fields.forEach(field => {
                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                
                let labelText = field.replace(/_/g, ' ');
                const dPwrMatch = field.match(/^discipline_power_(\d+)_(\d+)$/);
                if (dPwrMatch) labelText = 'Discipline ' + (parseInt(dPwrMatch[1]) + 1) + ' Power ' + (parseInt(dPwrMatch[2]) + 1);
                
                const dNameMatch = field.match(/^discipline_name_(\d+)$/);
                if (dNameMatch) labelText = 'Discipline ' + (parseInt(dNameMatch[1]) + 1) + ' Name';
                
                const dDotsMatch = field.match(/^discipline_dots_(\d+)$/);
                if (dDotsMatch) labelText = 'Discipline ' + (parseInt(dDotsMatch[1]) + 1) + ' Rating';
                
                const advNameMatch = field.match(/^adv_flaw_name_(\d+)$/);
                if (advNameMatch) labelText = 'Adv/Flaw ' + advNameMatch[1] + ' Name';
                
                const advRatMatch = field.match(/^adv_flaw_rating_(\d+)$/);
                if (advRatMatch) labelText = 'Adv/Flaw ' + advRatMatch[1] + ' Rating';
                
                const tenetMatch = field.match(/^tenet_(\d+)$/);
                if (tenetMatch) labelText = 'Tenet ' + (parseInt(tenetMatch[1]) + 1);
                
                const touchMatch = field.match(/^touchstone_(\d+)$/);
                if (touchMatch) labelText = 'Touchstone ' + (parseInt(touchMatch[1]) + 1);
                
                const isHidden = currentPrivacyConcealedFields.includes(field) || isSectionHidden;
                const iconColor = isHidden ? '#ef4444' : '#9ca3af';
                const iconClass = isHidden ? 'fa-eye-slash' : 'fa-eye';
                
                row.innerHTML = `<span style="color:#d1d5db; font-size:12px; font-family:'Inter', sans-serif; text-transform:capitalize;">${labelText}</span>
                                 <button style="background:none;border:none;cursor:pointer;font-size:14px;"><i class="fa-solid ${iconClass}" style="color:${iconColor};"></i></button>`;
                
                row.querySelector('button').onclick = () => {
                    if (isSectionHidden) {
                        alert("Cannot toggle individual fields while the entire section is hidden.");
                        return;
                    }
                    toggleConcealmentItem(field);
                };
                
                fieldContainer.appendChild(row);
            });
            body.appendChild(fieldContainer);
        }
    }
}

async function quickToggleVisibility(event, charId, currentlyHidden) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const token = localStorage.getItem('vtm_auth_token');
    
    let newHiddenList = null;
    if (!currentlyHidden) {
        const activeMembers = campaignMembersList.filter(m => m.status === 'active');
        const char = campaignCharactersList.find(c => c.id === charId);
        const ownerId = char ? char.user_id : null;
        
        newHiddenList = [];
        activeMembers.forEach(m => {
            const isOwner = m.id === ownerId;
            const isGM = m.role === 'storyteller' || (currentCampaignData && m.id === currentCampaignData.gm_id);
            if (!isOwner && !isGM) {
                newHiddenList.push(m.id);
            }
        });
        if (newHiddenList.length === 0) newHiddenList = null;
    }
    
    try {
        await fetch('/api/characters/' + charId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': token ? 'Bearer ' + token : ''
            },
            body: JSON.stringify({ hidden_from_user_ids: newHiddenList })
        });
        const char = campaignCharactersList.find(c => c.id === charId);
        if (char) char.hidden_from_user_ids = newHiddenList;
        
        if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
        if (typeof renderNpcCastWidget === 'function') renderNpcCastWidget();
        if (currentLoadedCharacterId === charId) {
            // Update the Dossier button
            const dossierVisBtn = document.getElementById('dossierQuickVisibilityBtn');
            if (dossierVisBtn) {
                const eyeClass = newHiddenList !== null ? 'fa-eye-slash' : 'fa-eye';
                const eyeColor = newHiddenList !== null ? '#ef4444' : '#9ca3af';
                dossierVisBtn.innerHTML = `<i class="fa-solid ${eyeClass}" style="color:${eyeColor};"></i>`;
            }
            // Update the Modal button
            const btnModalVis = document.getElementById('btnModalQuickVisibility');
            if (btnModalVis) {
                const eyeClass = newHiddenList !== null ? 'fa-eye-slash' : 'fa-eye';
                const eyeColor = newHiddenList !== null ? '#ef4444' : '#9ca3af';
                btnModalVis.innerHTML = `<i class="fa-solid ${eyeClass}" style="color:${eyeColor};"></i>`;
            }
        }
        
        if (privacyWidgetTargetCharId === charId) {
            currentHiddenFromFields = newHiddenList;
            populateParentPrivacyWidget();
        }
    } catch(e) {
        console.error(e);
    }
}

async function quickToggleVisibilityDossier() {
    if (!currentLoadedCharacterId) return;
    const char = campaignCharactersList.find(c => c.id === currentLoadedCharacterId);
    if (!char) return;
    const isHidden = char.hidden_from_user_ids !== null && char.hidden_from_user_ids !== undefined && char.hidden_from_user_ids !== 'null';
    await quickToggleVisibility(null, currentLoadedCharacterId, isHidden);
}

async function quickToggleVisibilityModal() {
    if (!currentLoadedCharacterId) return;
    const char = campaignCharactersList.find(c => c.id === currentLoadedCharacterId);
    if (!char) return;
    const isHidden = char.hidden_from_user_ids !== null && char.hidden_from_user_ids !== undefined && char.hidden_from_user_ids !== 'null';
    await quickToggleVisibility(null, currentLoadedCharacterId, isHidden);
}

window.activeMapMode = 'add';
;

let isDraggingPin = null;

function handlePinClick(event, pinId) {
    if (window.activeMapMode === 'delete') {
        event.stopPropagation();
        deletePin(pinId);
    }
}


setTimeout(() => {
    const container = document.querySelector('.workshop-minimap-container');
    if (container) {
        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });
        container.addEventListener('drop', (e) => {
            e.preventDefault();
            const pinId = e.dataTransfer.getData('text/plain');
            if (!pinId) return;
            
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const pctX = (x / rect.width) * 100;
            const pctY = (y / rect.height) * 100;
            
            const absX = Math.round((pctX / 100) * 2800);
            const absY = Math.round((pctY / 100) * 2000);
            
            const token = localStorage.getItem('vtm_auth_token');
            fetch(`/api/chronicles/${activeCampaignId}/pins/${pinId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({ x: absX, y: absY })
            }).then(res => res.json()).then(data => {
                if(data.success) {
                    const img = document.getElementById('workshopMinimapImg');
                    loadCampaignPins(img.getAttribute('src'));
                }
            });
        });
    }
}, 1000);


async function createMapPinSubmit() {
  const title = document.getElementById('newPinTitle').value.trim();
  const desc = document.getElementById('newPinDescription') ? document.getElementById('newPinDescription').value.trim() : '';
  const security = document.getElementById('newPinSecurity') ? document.getElementById('newPinSecurity').value.trim() : '';
  const infiltration = document.getElementById('newPinInfiltration') ? document.getElementById('newPinInfiltration').value.trim() : '';
  if (!title) return alert('Location title required.');

  const img = document.getElementById('workshopMinimapImg');
  let rawUrl = img ? img.getAttribute('src') : '/images/concept_map.jpg';
  const mapUrl = new URL(rawUrl, window.location.origin).pathname;
  const pctX = parseFloat(document.getElementById('newPinX').value);
  const pctY = parseFloat(document.getElementById('newPinY').value);

  const x = Math.round((pctX / 100) * 2800);
  const y = Math.round((pctY / 100) * 2000);

  try {
      const res = await authFetch('/api/chronicles/' + activeCampaignId + '/pins', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              map_url: mapUrl,
              x: x,
              y: y,
              title: title,
              description: desc,
              security_measures: security,
              infiltration_routes: infiltration
          })
      });
      closeModal('newMapPinModal');
      loadCampaignPins(mapUrl);
  } catch (e) {
      console.error(e);
  }
}


// --- DIAGNOSTIC HUD & ROBUST INLINE LOGIC ---
window.activeMapMode = 'add';

window.vtmMapLog = function(msg, isError = false) {
    const hud = document.getElementById('mapDiagnosticHUD');
    if (hud) {
        hud.style.display = 'block';
        const p = document.createElement('div');
        p.style.color = isError ? '#ef4444' : '#10b981';
        p.style.marginBottom = '4px';
        p.style.fontFamily = 'monospace';
        p.innerText = '[' + new Date().toLocaleTimeString() + '] ' + msg;
        hud.prepend(p);
    }
    console.log('[MAP DIAGNOSTIC] ' + msg);
};

window.vtmMapSetMode = function(mode) {
    vtmMapLog("Executing vtmMapSetMode('" + mode + "')");
    window.activeMapMode = mode;
    const btnAdd = document.getElementById('btnMapModeAdd');
    const btnMove = document.getElementById('btnMapModeMove');
    const btnDelete = document.getElementById('btnMapModeDelete');
    const label = document.getElementById('mapModeLabel');
    const pinsContainer = document.getElementById('workshopMinimapPins');

    if (btnAdd) btnAdd.classList.remove('active');
    if (btnMove) btnMove.classList.remove('active');
    if (btnDelete) btnDelete.classList.remove('active');
    
    if (mode === 'add') {
        if (btnAdd) btnAdd.classList.add('active');
        if (label) label.innerText = 'Mode: Add (Click Map)';
        if (pinsContainer) pinsContainer.style.pointerEvents = 'none';
        vtmMapLog('Set to ADD mode. Map clicks enabled.');
    } else if (mode === 'move') {
        if (btnMove) btnMove.classList.add('active');
        if (label) label.innerText = 'Mode: Move (Drag Pin)';
        if (pinsContainer) pinsContainer.style.pointerEvents = 'auto';
        vtmMapLog('Set to MOVE mode. Pins are draggable.');
    } else if (mode === 'delete') {
        if (btnDelete) btnDelete.classList.add('active');
        if (label) label.innerText = 'Mode: Delete (Click Pin)';
        if (pinsContainer) pinsContainer.style.pointerEvents = 'auto';
        vtmMapLog('Set to DELETE mode. Click a pin to delete.');
    }
};

window.vtmHandleMapClick = function(e) {
    if (e) e.stopPropagation();
    vtmMapLog("Map clicked. Target: " + (e.target ? e.target.tagName : 'unknown') + ", Mode: " + window.activeMapMode);
    
    if (!activeCampaignId) {
        vtmMapLog('ERROR: activeCampaignId is null. Chronicle not loaded?', true);
        return;
    }
    if (window.activeMapMode !== 'add') {
        vtmMapLog("Ignored click because mode is " + window.activeMapMode + ", not 'add'.");
        return;
    }

    const mapContainer = document.getElementById('workshopMinimapContainer');
    if (!mapContainer) {
        vtmMapLog('ERROR: mapContainer is null.', true);
        return;
    }

    const rect = mapContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pctX = (x / rect.width) * 100;
    const pctY = (y / rect.height) * 100;

    vtmMapLog("Calculated coordinates: X=" + pctX.toFixed(2) + "%, Y=" + pctY.toFixed(2) + "%");

    const modal = document.getElementById('newMapPinModal');
    if (modal) {
        document.getElementById('newPinX').value = pctX;
        document.getElementById('newPinY').value = pctY;
        document.getElementById('newPinTitle').value = '';
        const desc = document.getElementById('newPinDescription');
        if (desc) desc.value = '';
        modal.classList.add('active'); modal.style.zIndex = '9999999';
        vtmMapLog("Modal opened successfully. Display: " + modal.style.display + ", z-index: " + modal.style.zIndex);
    } else {
        vtmMapLog('CRITICAL ERROR: newMapPinModal not found in DOM!', true);
    }
};

// Overwrite createMapPinSubmit to add tracing
const oldCreateSubmit = createMapPinSubmit;
createMapPinSubmit = async function() {
    vtmMapLog("createMapPinSubmit() called");
    try {
        await oldCreateSubmit();
        vtmMapLog("createMapPinSubmit() completed successfully");
    } catch(e) {
        vtmMapLog("ERROR in createMapPinSubmit: " + e.message, true);
    }
};



async function updateCharacterNpcField(charId, field, value) {
    try {
        const res = await authFetch('/api/characters/' + charId + '/npc-fields', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ field, value })
        });
        if (!res.ok) throw new Error('Failed to update NPC field');
        
        // Update global cache
        if (typeof campaignCharactersList !== 'undefined') {
            const char = campaignCharactersList.find(c => c.id === charId);
            if (char) char[field] = value;
        }

        // Update character vault UI if open
        const sheetInput = document.getElementById('sheet_npc_' + field);
        if (sheetInput && currentLoadedCharacterId === charId) sheetInput.value = value;

        // Update Storyteller Workshop UI if rendered
        const workshopInput = document.getElementById('workshop_npc_' + charId + '_' + field);
        if (workshopInput) workshopInput.value = value;

    } catch (e) {
        console.error(e);
        alert('Failed to save NPC field update.');
    }
}




window.removeNpcAgenda = function(index) {
  if (!currentEpisodeData) currentEpisodeData = {};
  while (typeof currentEpisodeData.npc_agendas === 'string') {
    try {
      currentEpisodeData.npc_agendas = JSON.parse(currentEpisodeData.npc_agendas);
    } catch (e) {
      currentEpisodeData.npc_agendas = [];
      break;
    }
  }
  if (!Array.isArray(currentEpisodeData.npc_agendas)) {
    currentEpisodeData.npc_agendas = [];
  }
  const agendas = currentEpisodeData.npc_agendas;
  agendas.splice(index, 1);
  console.log('[Trace][Episode] Removed NPC agenda at index', index);
  authFetch('/api/episodes/' + activeEpisodeId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ npc_agendas: agendas })
  }).then(() => loadEpisodeDetails(activeEpisodeId));
};


window.openEditClueModal = function(id) {
    let targetClue = null;
    for (let m of allCampaignClueMatrices) {
        targetClue = m.clues.find(c => c.id === id);
        if (targetClue) break;
    }
    if (!targetClue) return;

    document.getElementById('editClueId').value = targetClue.id;
    document.getElementById('editClueTitle').value = targetClue.title || '';
    document.getElementById('editClueDelivery').value = targetClue.delivery_method || '';
    document.getElementById('editClueLocation').value = targetClue.location_hint || '';
    document.getElementById('editClueDesc').value = targetClue.description || '';
    const emotional = document.getElementById('editClueEmotional');
    if (emotional) emotional.value = targetClue.emotional_depth || '';

    document.getElementById('editClueModal').classList.add('active');
};

window.editClueSubmit = async function() {
    const id = document.getElementById('editClueId').value;
    const title = document.getElementById('editClueTitle').value.trim();
    if (!title) return alert('Title required');

    try {
        const res = await authFetch('/api/clues/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                delivery_method: document.getElementById('editClueDelivery').value.trim(),
                location_hint: document.getElementById('editClueLocation').value.trim(),
                description: document.getElementById('editClueDesc').value.trim(),
                emotional_depth: document.getElementById('editClueEmotional') ? document.getElementById('editClueEmotional').value.trim() : ''
            })
        });
        if (res.ok) {
            closeModal('editClueModal');
            loadEpisodeDetails(activeEpisodeId); // Reloads the matrices
        } else {
            alert('Failed to update clue');
        }
    } catch(e) {
        console.error(e);
        alert('Error updating clue');
    }
};

window.deleteClue = async function(id) {
    if (!confirm('Are you sure you want to delete this clue completely?')) return;
    try {
        const res = await authFetch('/api/clues/' + id, { method: 'DELETE' });
        if (res.ok) {
            loadEpisodeDetails(activeEpisodeId);
        } else {
            alert('Failed to delete clue');
        }
    } catch(e) {
        console.error(e);
    }
};


function formatLineBreaks(str) {
    if (!str) return '';
    return str.replace(/\n/g, '<br>');
}


async function loadRulesCodex() {
    try {
        const res = await authFetch('/api/rules/search?q=');
        allRules = await res.json();
        filterRulesByCategory(activeRuleCategory);
    } catch (err) {
        console.error('Failed to load rules codex:', err);
    }
}


window.editRuleArticle = function(id) {
    openNewRuleModal(id);
};
