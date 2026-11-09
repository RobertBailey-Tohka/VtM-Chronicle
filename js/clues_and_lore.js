/**
 * Clue Evidence Board (widget-clue-board) and Lore Codex Archive (widget-lore-archive)
 */
// --- ALL FUNCTIONS ---
/**
 * Opens a detailed widget to display information about a specific clue.
 * It searches the 'allChronicleClueMatrices' array to find the clue by its ID,
 * then updates the DOM elements of the clue detail widget with the clue's 
 * title, origin matrix, delivery method, and description. It also handles 
 * custom UI styling if configured.
 * 
 * @param {string} clueId - The unique identifier of the clue to display.
 * @returns {void}
 */
function openClueDetailWidget(clueId) {
  let matchedClueRecord = null;
  let originMatrixName = '';
  for (const clueMatrixRecord of allChronicleClueMatrices) {
    if (clueMatrixRecord.clues) {
      const foundClueRecord = clueMatrixRecord.clues.find(clueItem => clueItem.id === clueId);
      if (foundClueRecord) {
        matchedClueRecord = foundClueRecord;
        originMatrixName = clueMatrixRecord.title;
        break;
      }
    }
  }
  
  if (!matchedClueRecord) return;
  
  // Look up the clue detail widget, header, title, and body elements in the DOM
  const clueDetailWidgetElement = document.getElementById('widget-clue-detail');
  const widgetHeaderElement = clueDetailWidgetElement ? clueDetailWidgetElement.querySelector('.widget-header') : null;
  const clueDetailTitleElement = document.getElementById('clueDetailTitle');
  const clueDetailBodyElement = document.getElementById('clueDetailBody');
  
  if (clueDetailTitleElement) clueDetailTitleElement.innerText = matchedClueRecord.title;
  
  let detailBodyHtml = '';
  if (chronicleUiSettings && chronicleUiSettings.cluePaperBg) {
      // CUSTOM PAPER RENDERING
      clueDetailWidgetElement.style.background = `url('${chronicleUiSettings.cluePaperBg}') center/100% 100% no-repeat`;
      clueDetailWidgetElement.style.backgroundColor = 'transparent';
      clueDetailWidgetElement.style.backdropFilter = 'none';
      clueDetailWidgetElement.style.webkitBackdropFilter = 'none';
      clueDetailWidgetElement.style.border = 'none';
      clueDetailWidgetElement.style.boxShadow = 'none';
      clueDetailWidgetElement.style.cursor = 'grab';
      if (widgetHeaderElement) {
          widgetHeaderElement.style.background = 'transparent';
          widgetHeaderElement.style.borderBottom = 'none';
          widgetHeaderElement.style.position = 'absolute';
          widgetHeaderElement.style.top = '0';
          widgetHeaderElement.style.right = '0';
          widgetHeaderElement.style.width = '100%';
          widgetHeaderElement.style.zIndex = '100';
          
          // Query the widget title span and control button inside the widget header element
          const widgetTitleSpanElement = widgetHeaderElement.querySelector('.widget-title');
          if (widgetTitleSpanElement) widgetTitleSpanElement.style.display = 'none';
          
          const closeButtonElement = widgetHeaderElement.querySelector('.btn-w-ctrl');
          if (closeButtonElement) {
              closeButtonElement.className = 'custom-paper-close-btn';
              closeButtonElement.innerHTML = '×';
              // Remove old inline styles
              closeButtonElement.style.color = '';
              closeButtonElement.style.fontSize = '';
              closeButtonElement.style.textShadow = '';
          }
      }
      
      const topPercentage = chronicleUiSettings.clueDetailTop !== undefined ? chronicleUiSettings.clueDetailTop : 10;
      const leftPercentage = chronicleUiSettings.clueDetailLeft !== undefined ? chronicleUiSettings.clueDetailLeft : 10;
      const widthPercentage = chronicleUiSettings.clueDetailWidth !== undefined ? chronicleUiSettings.clueDetailWidth : 80;
      const heightPercentage = chronicleUiSettings.clueDetailHeight !== undefined ? chronicleUiSettings.clueDetailHeight : 80;
      const fontSizePixels = chronicleUiSettings.clueDetailFontSize !== undefined ? chronicleUiSettings.clueDetailFontSize : 12;
      const fontColorHex = chronicleUiSettings.clueTextColor || '#111827';
      const textHaloCss = chronicleUiSettings.clueTextHalo !== false ? 'text-shadow:0 0 4px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.8);' : '';
      
      if (clueDetailBodyElement) {
          clueDetailBodyElement.style.position = 'absolute';
          clueDetailBodyElement.style.top = topPercentage + '%';
          clueDetailBodyElement.style.left = leftPercentage + '%';
          clueDetailBodyElement.style.width = widthPercentage + '%';
          clueDetailBodyElement.style.height = heightPercentage + '%';
          clueDetailBodyElement.style.padding = '0';
          clueDetailBodyElement.style.color = fontColorHex;
          clueDetailBodyElement.style.fontSize = fontSizePixels + 'px';
          // Important: use a standard font or whatever the custom paper aesthetic demands
          detailBodyHtml = `
              <div style="margin-bottom:10px; ${textHaloCss}">
                  <strong>Matrix:</strong> ${escapeHtml(originMatrixName)}<br>
                  <strong>Method:</strong> ${escapeHtml(matchedClueRecord.delivery_method || 'Unknown')}
              </div>
              <div style="white-space:pre-wrap; ${textHaloCss}">${escapeHtml(matchedClueRecord.description || '')}</div>
          `;
      }
  } else {
      // DEFAULT VTM WIDGET RENDERING
      clueDetailWidgetElement.style.background = '';
      clueDetailWidgetElement.style.backgroundColor = '';
      clueDetailWidgetElement.style.backdropFilter = '';
      clueDetailWidgetElement.style.webkitBackdropFilter = '';
      clueDetailWidgetElement.style.border = '';
      clueDetailWidgetElement.style.boxShadow = '';
      clueDetailWidgetElement.style.cursor = '';
      if (widgetHeaderElement) {
          widgetHeaderElement.style.background = '';
          widgetHeaderElement.style.borderBottom = '';
          widgetHeaderElement.style.position = '';
          widgetHeaderElement.style.top = '';
          widgetHeaderElement.style.right = '';
          widgetHeaderElement.style.width = '';
          widgetHeaderElement.style.zIndex = '';
          
          // Query the widget title span and control button inside the widget header element
          const widgetTitleSpanElement = widgetHeaderElement.querySelector('.widget-title');
          if (widgetTitleSpanElement) widgetTitleSpanElement.style.display = '';
          
          const closeButtonElement = widgetHeaderElement.querySelector('.btn-w-ctrl');
          if (closeButtonElement) {
              closeButtonElement.className = 'btn-w-ctrl';
              closeButtonElement.innerHTML = '×';
              closeButtonElement.style.color = '';
              closeButtonElement.style.fontSize = '';
              closeButtonElement.style.textShadow = '';
          }
      }
      if (clueDetailBodyElement) {
          clueDetailBodyElement.style.position = '';
          clueDetailBodyElement.style.top = '';
          clueDetailBodyElement.style.left = '';
          clueDetailBodyElement.style.width = '';
          clueDetailBodyElement.style.height = '';
          clueDetailBodyElement.style.padding = '';
          clueDetailBodyElement.style.color = '';
          clueDetailBodyElement.style.fontSize = '';
      }
      detailBodyHtml = `
          <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #3f3f46;">
              <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase;">Origin Matrix</div>
              <div style="font-size:12px; color:#9ca3af;">${escapeHtml(originMatrixName)}</div>
          </div>
          <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #3f3f46;">
              <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase;">Delivery Method</div>
              <div style="font-size:12px; color:#9ca3af;">${escapeHtml(matchedClueRecord.delivery_method || 'Unknown')}</div>
          </div>
          <div>
              <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase; margin-bottom:5px;">Detailed Description</div>
              <div style="white-space:pre-wrap;">${escapeHtml(matchedClueRecord.description || 'No description provided.')}</div>
          </div>
      `;
  }
  
  if (clueDetailBodyElement) clueDetailBodyElement.innerHTML = detailBodyHtml;
  if (clueDetailWidgetElement) {
    clueDetailWidgetElement.style.display = 'flex';
    if (typeof bringDesktopWidgetToFront === 'function') bringDesktopWidgetToFront(clueDetailWidgetElement);
  }
}


/**
 * Handles the event when a new clue is revealed to the players via WebSockets.
 * It debounces duplicate events, updates the UI corkboard and clue matrices, 
 * and refreshes episode details for game masters/storytellers.
 * 
 * @param {Object} clueRecord - The clue object containing details like id, title, and description.
 * @returns {void}
 */
function handleClueRevealed(clueRecord) {
  if (!clueRecord || !clueRecord.id) return;
  const currentTimestampMs = Date.now();
  if (lastHandledClueId === clueRecord.id && currentTimestampMs - lastHandledClueTime < 1000) {
    return;
  }
  lastHandledClueId = clueRecord.id;
  lastHandledClueTime = currentTimestampMs;
  console.log('[Trace][Socket] Received clue revealed/update event:', clueRecord);
  addClueToBoard(clueRecord);
  loadClueMatricesForWidget();
  if (activeEpisodeId && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) loadEpisodeDetails(activeEpisodeId);
}


function addClueToBoard(clueRecord) {
  // Look up the discovered clues corkboard container and empty state notice in the DOM
  const corkboardElement = document.getElementById('discoveredCluesList');
  const emptyStateElement = corkboardElement.querySelector('.clue-empty-state');
  if (emptyStateElement) emptyStateElement.remove();
  // Check if a card for this clue ID already exists in the DOM
  const existingCardElement = document.getElementById(`clue-card-${clueRecord.id}`);
  if (existingCardElement) return;
  const isRevealed = clueRecord.discovered || true;
  const isClueDiscovered = Boolean(clueRecord.discovered);
  // Create a new <div> element in memory for the pinned clue card
  const clueCardElement = document.createElement('div');
  clueCardElement.id = `clue-card-${clueRecord.id}`;
  clueCardElement.className = 'clue-pin-card';
  const rotationDegrees = Math.floor(Math.random() * 10) - 5;
  const offsetTranslateX = Math.floor(Math.random() * 20) - 10;
  const offsetTranslateY = Math.floor(Math.random() * 20) - 10;
  const redStringLineEndX = Math.floor(Math.random() * 200) - 100;
  const redStringLineEndY = Math.floor(Math.random() * 200) - 100;
  clueCardElement.style.transform = `rotate(${rotationDegrees}deg) translate(${offsetTranslateX}px, ${offsetTranslateY}px)`;
  clueCardElement.style.position = 'relative';
  clueCardElement.style.margin = '15px';
  clueCardElement.style.zIndex = Math.floor(Math.random() * 10) + 1;
  let cardContentHtml = '';
  if (!isClueDiscovered) {
    clueCardElement.style.background = '#eab308';
    clueCardElement.style.border = '2px solid #a16207';
    clueCardElement.style.color = '#713f12';
    clueCardElement.style.padding = '20px';
    clueCardElement.style.boxShadow = '0 4px 6px rgba(0,0,0,0.5)';
    cardContentHtml = `
            <div style="position:absolute; top:50%; left:50%; transform: translate(-50%, -50%) rotate(-15deg); color:#ef4444; border:3px solid #ef4444; padding:4px; font-weight:900; letter-spacing:2px; opacity:0.8; font-size:14px; pointer-events:none;">SEALED</div>
            <div style="text-align:center; font-weight:bold; margin-bottom: 10px;">EVIDENCE FILE #${clueRecord.id}</div>
            <div style="text-align:center; font-size: 10px;">TOP SECRET</div>
            <div style="text-align:center; font-size: 10px; margin-top: 5px;">${clueRecord.matrix_title || 'Clue Matrix'}</div>
        `;
  } else {
    clueCardElement.style.background = '#fdf6e3';
    clueCardElement.style.border = '1px solid #d1d5db';
    clueCardElement.style.padding = '15px';
    clueCardElement.style.boxShadow = 'inset 0 0 10px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.3)';
    cardContentHtml = `
            <div style="position:absolute; top:10px; right:10px; color:#ef4444; border:2px solid #ef4444; padding:2px; font-weight:bold; transform:rotate(10deg); opacity:0.6; font-size:10px; pointer-events:none;">CLASSIFIED</div>
            <div style="font-size:10px;text-transform:uppercase;color:#b45309;font-weight:700; border-bottom:1px dashed #b45309; padding-bottom:4px; margin-bottom:8px;">${clueRecord.matrix_title || 'Clue Matrix'}</div>
            <h5 style="margin:0 0 5px 0; font-size:14px; font-weight:bold;"><i class="fa-solid fa-thumbtack" style="color:#ef4444; position:relative; z-index:2;"></i> ${clueRecord.title}</h5>
            <p style="font-size:12px; line-height:1.4; margin:0 0 10px 0;">${clueRecord.description}</p>
            <div style="font-size:9px;color:#6b7280; border-top:1px solid #e5e7eb; padding-top:4px;">
                <span><strong>Vector:</strong> ${clueRecord.delivery_method || 'Discovered'}</span><br>
                <span><strong>Scene:</strong> ${clueRecord.location_hint || 'General'}</span>
            </div>
        `;
  }
  const redStringSvgHtml = `
        <svg style="position:absolute; top:20px; left:20px; width:200%; height:200%; overflow:visible; z-index:-1; pointer-events:none;">
            <line x1="0" y1="0" x2="${redStringLineEndX}" y2="${redStringLineEndY}" stroke="#ef4444" stroke-width="2" opacity="0.6"/>
        </svg>
    `;
  clueCardElement.innerHTML = cardContentHtml + redStringSvgHtml;
  corkboardElement.prepend(clueCardElement);
}

function removeClueFromGameboard(clueId) {
  // Look up the clue card element in the DOM by its ID and remove it
  const clueCardElement = document.getElementById(`clue-card-${clueId}`);
  if (clueCardElement) clueCardElement.remove();
  // Look up the discovered clues corkboard container and check if any clue cards remain
  const corkboardElement = document.getElementById('discoveredCluesList');
  if (corkboardElement.querySelectorAll('.clue-pin-card').length === 0) {
    corkboardElement.innerHTML = '<div class="clue-empty-state">No clues uncovered yet. Search the scene!</div>';
  }
}

function addLoreToGameboard(loreRecord) {
  // Look up the discovered lore list container and empty state notice in the DOM
  const loreContainerElement = document.getElementById('discoveredLoreList');
  const emptyStateElement = loreContainerElement.querySelector('.clue-empty-state');
  if (emptyStateElement) emptyStateElement.remove();
  // Check if a card for this lore entry ID already exists in the DOM
  const existingLoreCardElement = document.getElementById(`lore-card-${loreRecord.id}`);
  if (existingLoreCardElement) return;
  // Create a new <div> element in memory for the lore parchment card
  const loreCardElement = document.createElement('div');
  loreCardElement.id = `lore-card-${loreRecord.id}`;
  loreCardElement.className = 'lore-parchment-card';
  loreCardElement.innerHTML = `
        <div class="lore-card-header">
            <span class="lore-matrix-tag">${loreRecord.matrix_title || 'Lore Archive'}</span>
        </div>
        <h5><i class="fa-solid fa-book-bookmark"></i> ${loreRecord.title}</h5>
        <p class="lore-content">${loreRecord.content}</p>
        <div class="lore-footer">
            <span><i class="fa-solid fa-scroll"></i> <strong>Revealed via:</strong> ${loreRecord.revelation_vector || 'Elder Whispers'}</span>
        </div>
    `;


  loreContainerElement.prepend(loreCardElement);
}

function removeLoreFromGameboard(loreId) {
  // Look up the lore card element in the DOM by its ID and remove it
  const loreCardElement = document.getElementById(`lore-card-${loreId}`);
  if (loreCardElement) loreCardElement.remove();
  // Look up the discovered lore container and check if any lore cards remain
  const loreContainerElement = document.getElementById('discoveredLoreList');
  if (loreContainerElement.querySelectorAll('.lore-parchment-card').length === 0) {
    loreContainerElement.innerHTML = '<div class="clue-empty-state">No setting lore uncovered yet. Question elders and search archives!</div>';
  }
}


function renderClueMatrices(clueMatricesList) {
  // Look up the episode clue matrices container element in the DOM by its ID
  const matricesContainerElement = document.getElementById('epMatricesContainer');
  matricesContainerElement.innerHTML = '';
  if (clueMatricesList.length === 0) {
    matricesContainerElement.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No clue matrices created yet. Click "+ New Clue Matrix" to build one!</div>';
    return;
  }
  clueMatricesList.forEach(clueMatrixRecord => {
    // Create a new <div> element in memory for each clue matrix panel card
    const matrixCardElement = document.createElement('div');
    matrixCardElement.className = 'matrix-panel-card';
    let cluesRowsHtml = '';
    if (clueMatrixRecord.clues && clueMatrixRecord.clues.length > 0) {
      clueMatrixRecord.clues.forEach(clueRecord => {
        const actionButtonHtml = clueRecord.discovered ? `<button class="btn-action-conceal" onclick="toggleClue(${clueRecord.id})" title="Hide from Gameboard"><i class="fa-solid fa-eye-slash"></i> Re-Hide</button>` : `<button class="btn-action-reveal" onclick="toggleClue(${clueRecord.id})" title="Publish to Gameboard"><i class="fa-solid fa-bullhorn"></i> Reveal</button>`;
        cluesRowsHtml += `
                    <tr>
                        <td><strong>${clueRecord.title}</strong><br>
                            <small style="color:#3b82f6;"><i class="fa-solid fa-shoe-prints"></i> ${clueRecord.description || 'No mechanical lead.'}</small><br>
                            <small style="color:#8b5cf6;"><i class="fa-solid fa-heart-crack"></i> ${clueRecord.emotional_depth || 'No emotional depth.'}</small>
                        </td>
                        <td><span class="delivery-badge">${clueRecord.delivery_method || 'Found item'}</span></td>
                        <td><span style="font-size:11px;color:#d1d5db;">${clueRecord.location_hint || 'Any scene'}</span></td>
                        <td>${clueRecord.discovered ? '<span style="color:#10b981;font-weight:700;"><i class="fa-solid fa-check"></i> Discovered</span>' : '<span style="color:#9ca3af;">Hidden</span>'}</td>
                        <td>
                            <div style="display:flex; gap:6px;">
                                ${actionButtonHtml}
                                <button class="btn-action-outline btn-sm" onclick="openEditClueModal(${clueRecord.id})" title="Edit Clue"><i class="fa-solid fa-pencil"></i></button>
                                <button class="btn-action-outline btn-sm text-danger" onclick="deleteClue(${clueRecord.id})" title="Delete Clue" style="border-color:#ef4444; color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
                            </div>
                        </td>
                    </tr>
                `;
      });
    } else {
      cluesRowsHtml = '<tr><td colspan="4" style="color:#9ca3af;font-style:italic;text-align:center;">No clues in this matrix yet. Add one below!</td></tr>';
    }
    matrixCardElement.innerHTML = `
            <div class="matrix-card-header">
                <div>
                    <h4><i class="fa-solid fa-folder-open"></i> ${clueMatrixRecord.title}</h4>
                    <span class="matrix-notes">${clueMatrixRecord.notes || 'Independent / Floating Clue Matrix'}</span>
                </div>
                <div>
                    <button class="btn-action-small" onclick="openClueMatrixWidget(${clueMatrixRecord.id})" title="Open as floating widget on Board"><i class="fa-solid fa-window-restore"></i> Pop to Board</button>
                    <button class="btn-action-small" onclick="openAddClueModal(${clueMatrixRecord.id})"><i class="fa-solid fa-plus"></i> Add Clue</button>
                    <button class="btn-text-danger" onclick="deleteMatrix(${clueMatrixRecord.id})"><i class="fa-solid fa-trash"></i></button>
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
                    <tbody>${cluesRowsHtml}</tbody>
                </table>
            </div>
        `;
    matricesContainerElement.appendChild(matrixCardElement);
  });
}

function toggleClue(clueId) {
  // Perform an authenticated HTTP POST request to toggle whether the clue is revealed to players
  authFetch(`/api/clues/${clueId}/toggle`, {
    method: 'POST'
  }).then(fetchResponse => fetchResponse.json()).then(() => {
    if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
    // Look up the Storyteller omni-drawer widget in the DOM to refresh unrevealed clues if open
    const omniWidgetElement = document.getElementById('widget-storyteller-omni');
    if (omniWidgetElement && omniWidgetElement.style.display !== 'none') {
      loadOmniUnrevealedClues();
    }
    if (typeof loadClueMatricesForWidget === 'function') {
      loadClueMatricesForWidget();
    }
  }).catch(errorObject => console.error('Failed to toggle clue:', errorObject));
}

function renderLoreMatrices(loreMatricesList) {
  // Look up the episode lore matrices container element in the DOM by its ID
  const loreMatricesContainerElement = document.getElementById('epLoreMatricesContainer');
  loreMatricesContainerElement.innerHTML = '';
  if (loreMatricesList.length === 0) {
    loreMatricesContainerElement.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No lore matrices created yet. Click "+ New Lore Matrix" to build one!</div>';
    return;
  }
  loreMatricesList.forEach(loreMatrixRecord => {
    // Create a new <div> element in memory for each lore matrix panel card
    const matrixCardElement = document.createElement('div');
    matrixCardElement.className = 'matrix-panel-card lore-matrix-card';
    let entriesRowsHtml = '';
    if (loreMatrixRecord.entries && loreMatrixRecord.entries.length > 0) {
      loreMatrixRecord.entries.forEach(loreEntryRecord => {
        const actionButtonHtml = loreEntryRecord.discovered ? `<button class="btn-action-conceal" onclick="toggleLore(${loreEntryRecord.id})" title="Hide Lore"><i class="fa-solid fa-eye-slash"></i> Hide Lore</button>` : `<button class="btn-action-reveal" onclick="toggleLore(${loreEntryRecord.id})" title="Reveal Lore"><i class="fa-solid fa-book-open"></i> Reveal Lore</button>`;
        entriesRowsHtml += `
                    <tr>
                        <td><strong>${loreEntryRecord.title}</strong><br><small style="color:#d1d5db;line-height:1.3;display:block;margin-top:2px;">${loreEntryRecord.content.substring(0, 120)}...</small></td>
                        <td><span style="font-size:11px;color:#fca5a5;"><i class="fa-solid fa-graduation-cap"></i> ${escapeHtml(loreEntryRecord.revelation_vector || 'Elder Whispers')}</span></td>
                        <td>${loreEntryRecord.discovered ? '<span style="color:#10b981;font-weight:700;"><i class="fa-solid fa-check"></i> Revealed</span>' : '<span style="color:#9ca3af;">Hidden</span>'}</td>
                        <td style="text-align: right;">
                            ${actionButtonHtml}
                            <button class="btn-action-outline" style="padding: 4px 8px; font-size: 11px; margin-left: 4px;" onclick="editLoreEntry(${loreEntryRecord.id})" title="Edit Lore"><i class="fa-solid fa-pencil"></i></button>
                            <button class="btn-action-outline" style="padding: 4px 8px; font-size: 11px; margin-left: 4px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);" onclick="deleteLoreEntry(${loreEntryRecord.id}, '${escapeHtml(loreEntryRecord.title).replace(/'/g, "\\'")}')" title="Delete Lore"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
      });
    } else {
      entriesRowsHtml = '<tr><td colspan="4" style="color:#9ca3af;font-style:italic;text-align:center;">No lore revelations in this matrix yet. Add one below!</td></tr>';
    }
    matrixCardElement.innerHTML = `
            <div class="matrix-card-header">
                <div>
                    <h4><i class="fa-solid fa-book-journal-whills"></i> ${loreMatrixRecord.title}</h4>
                    <span class="matrix-notes">${loreMatrixRecord.notes || 'Chronicle Lore & Revelation Archive'}</span>
                </div>
                <div>
                    <button class="btn-action-small" onclick="openAddLoreModal(${loreMatrixRecord.id})"><i class="fa-solid fa-plus"></i> Add Revelation</button>
                    <button class="btn-text-danger" onclick="deleteLoreMatrix(${loreMatrixRecord.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
            <div class="matrix-table-wrap">
                <table class="clue-matrix-table">
                    <thead>
                        <tr>
                            <th>Revelation Title & Text</th>
                            <th>Revelation Vector (How to Learn)</th>
                            <th>Status</th>
                            <th style="min-width:110px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>${entriesRowsHtml}</tbody>
                </table>
            </div>
        `;
    loreMatricesContainerElement.appendChild(matrixCardElement);
  });
}

function toggleLore(loreId) {
  // Perform an authenticated HTTP POST request to toggle whether the lore entry is revealed to players
  authFetch(`/api/lore_entries/${loreId}/toggle`, {
    method: 'POST'
  }).then(fetchResponse => fetchResponse.json()).then(async () => {
    if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
    // Look up the Storyteller omni-drawer widget in the DOM to refresh unrevealed lore if open
    const omniWidgetElement = document.getElementById('widget-storyteller-omni');
    if (omniWidgetElement && omniWidgetElement.style.display !== 'none') {
      loadOmniUnrevealedLore();
    }
    // Also explicitly refresh the Lore Widget data if it's open in the DOM
    const loreArchiveWidgetElement = document.getElementById('widget-lore-archive');
    if (loreArchiveWidgetElement && loreArchiveWidgetElement.style.display !== 'none') {
       await loadLoreMatricesForWidget();
       if (activeWidgetLoreMatrixId) {
           renderWidgetLoreEntries(activeWidgetLoreMatrixId);
       }
    }
  }).catch(errorObject => console.error('Failed to toggle lore:', errorObject));
}


function openNewMatrixModal() {
  // Look up the new clue matrix modal element in the DOM by its ID and mark it active
  document.getElementById('newMatrixModal').classList.add('active');
}

function openAddClueModal(matrixId) {
  // Look up the target clue matrix ID hidden input and the new clue modal in the DOM by their IDs
  const targetMatrixInputElement = document.getElementById('targetMatrixId') || document.getElementById('newClueMatrixId');
  if (targetMatrixInputElement) targetMatrixInputElement.value = matrixId;
  document.getElementById('newClueModal').classList.add('active');
}

function openNewLoreMatrixModal() {
  // Look up the new lore matrix modal element in the DOM by its ID and mark it active
  document.getElementById('newLoreMatrixModal').classList.add('active');
}

function openAddLoreModal(matrixId) {
  // Look up the target lore matrix ID hidden input and the new lore modal in the DOM by their IDs
  const targetLoreMatrixInputElement = document.getElementById('targetLoreMatrixId') || document.getElementById('newLoreMatrixId');
  if (targetLoreMatrixInputElement) targetLoreMatrixInputElement.value = matrixId;
  const loreModalElement = document.getElementById('newLoreModal') || document.getElementById('newLoreEntryModal');
  if (loreModalElement) loreModalElement.classList.add('active');
}


function createMatrixSubmit() {
  // Look up the new clue matrix title and notes input elements in the DOM by their IDs
  const matrixTitle = document.getElementById('newMatrixTitle')?.value.trim() || '';
  const matrixNotes = document.getElementById('newMatrixNotes')?.value.trim() || '';
  // Display a browser alert if required fields are missing
  if (!matrixTitle) return alert('Matrix title is required.');
  if (!activeChronicleId) return alert('Please select an active chronicle first.');
  // Perform an authenticated HTTP POST request to create a new clue matrix
  authFetch('/api/matrices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeChronicleId,
      episode_id: activeEpisodeId || null,
      title: matrixTitle,
      notes: matrixNotes
    })
  }).then(fetchResponse => fetchResponse.json()).then(createdMatrixData => {
    if (createdMatrixData.id) {
      console.log('[Trace][ClueMatrix] Matrix created:', createdMatrixData);
      if (currentEpisodeData) {
        if (!currentEpisodeData.matrices || !Array.isArray(currentEpisodeData.matrices)) {
          currentEpisodeData.matrices = [];
        }
        currentEpisodeData.matrices.push(createdMatrixData);
      }
      if (!allChronicleClueMatrices || !Array.isArray(allChronicleClueMatrices)) {
        allChronicleClueMatrices = [];
      }
      if (!allChronicleClueMatrices.some(existingMatrix => existingMatrix.id === createdMatrixData.id)) {
        allChronicleClueMatrices.push(createdMatrixData);
      }
      
      // Clear the clue matrix form input elements in the DOM
      const matrixTitleInputElement = document.getElementById('newMatrixTitle'); if (matrixTitleInputElement) matrixTitleInputElement.value = '';
      const matrixDescriptionInputElement = document.getElementById('newMatrixDesc'); if (matrixDescriptionInputElement) matrixDescriptionInputElement.value = '';
      closeModal('newMatrixModal');

      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadClueMatricesForWidget();
      // Display a browser alert confirming creation of the clue matrix
      alert(`Clue Matrix "${matrixTitle}" created successfully!`);
    } else {
      alert(createdMatrixData.error || 'Failed to create clue matrix.');
    }
  }).catch(errorObject => {
    console.error(errorObject);
    alert('Network error creating clue matrix.');
  });
}

async function deleteMatrix(matrixId) {
  const isConfirmed = typeof vtmConfirm === 'function'
    ? await vtmConfirm('Delete this clue matrix and all clues inside it?', 'Delete Clue Matrix')
    : true;
  if (isConfirmed) {
    // Perform an authenticated HTTP DELETE request to delete the clue matrix
    authFetch(`/api/matrices/${matrixId}`, {
      method: 'DELETE'
    }).then(fetchResponse => fetchResponse.json()).then(() => {
      if (Array.isArray(allChronicleClueMatrices)) {
        allChronicleClueMatrices = allChronicleClueMatrices.filter(m => Number(m.id) !== Number(matrixId));
      }
      const floatingWidget = document.getElementById(`widget-matrix-${matrixId}`);
      if (floatingWidget) floatingWidget.remove();
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadClueMatricesForWidget();
      if (typeof loadGameboardState === 'function') loadGameboardState();
    });
  }
}

function createClueSubmit() {
  // Look up the clue form input elements in the DOM by their IDs
  const matrixInputElement = document.getElementById('targetMatrixId') || document.getElementById('newClueMatrixId');
  const matrixId = matrixInputElement ? matrixInputElement.value : null;
  const clueTitle = document.getElementById('newClueTitle')?.value.trim() || '';
  const deliveryMethod = document.getElementById('newClueDelivery')?.value.trim() || document.getElementById('newClueMethod')?.value.trim() || 'Found item';
  const locationHint = document.getElementById('newClueLocation')?.value.trim() || '';
  const clueDescription = document.getElementById('newClueDesc')?.value.trim() || '';
  const emotionalDepth = document.getElementById('newClueEmotional')?.value.trim() || '';
  // Display a browser alert if required fields are missing
  if (!matrixId) return alert('No target matrix selected.');
  if (!clueTitle) return alert('Clue title is required.');
  // Perform an authenticated HTTP POST request to create the new clue record
  authFetch('/api/clues', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      matrix_id: parseInt(matrixId),
      title: clueTitle,
      delivery_method: deliveryMethod,
      location_hint: locationHint,
      description: clueDescription,
      emotional_depth: emotionalDepth
    })
  }).then(fetchResponse => fetchResponse.json()).then(createdClueData => {
    if (createdClueData.id) {
      
      // Clear Clue Form inputs in the DOM
      const clueTitleInputElement = document.getElementById('newClueTitle'); if (clueTitleInputElement) clueTitleInputElement.value = '';
      const clueDeliveryInputElement = document.getElementById('newClueDelivery'); if (clueDeliveryInputElement) clueDeliveryInputElement.value = '';
      const clueMethodInputElement = document.getElementById('newClueMethod'); if (clueMethodInputElement) clueMethodInputElement.value = '';
      const clueLocationInputElement = document.getElementById('newClueLocation'); if (clueLocationInputElement) clueLocationInputElement.value = '';
      const clueDescriptionInputElement = document.getElementById('newClueDesc'); if (clueDescriptionInputElement) clueDescriptionInputElement.value = '';
      const clueEmotionalInputElement = document.getElementById('newClueEmotional'); if (clueEmotionalInputElement) clueEmotionalInputElement.value = '';
      closeModal('newClueModal');

      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadClueMatricesForWidget();
      // Display a browser alert confirming that the clue was added
      alert(`Clue "${clueTitle}" added successfully!`);
    } else {
      alert(createdClueData.error || 'Failed to create clue revelation.');
    }
  }).catch(errorObject => {
    console.error(errorObject);
    alert('Network error adding clue revelation.');
  });
}

function createLoreMatrixSubmit() {
  // Look up the new lore matrix title and notes input elements in the DOM by their IDs
  const loreMatrixTitle = document.getElementById('newLoreMatrixTitle')?.value.trim() || '';
  const loreMatrixNotes = document.getElementById('newLoreMatrixNotes')?.value.trim() || '';
  // Display a browser alert if required fields are missing
  if (!loreMatrixTitle) return alert('Lore Matrix title is required.');
  if (!activeChronicleId) return alert('Please select an active chronicle first.');
  // Perform an authenticated HTTP POST request to create a new lore matrix
  authFetch('/api/lore_matrices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeChronicleId,
      episode_id: activeEpisodeId || null,
      title: loreMatrixTitle,
      notes: loreMatrixNotes
    })
  }).then(fetchResponse => fetchResponse.json()).then(createdLoreMatrixData => {
    if (createdLoreMatrixData.id) {
      console.log('[Trace][LoreMatrix] Lore matrix created:', createdLoreMatrixData);
      if (currentEpisodeData) {
        if (!currentEpisodeData.lore_matrices || !Array.isArray(currentEpisodeData.lore_matrices)) {
          currentEpisodeData.lore_matrices = [];
        }
        currentEpisodeData.lore_matrices.push(createdLoreMatrixData);
      }
      if (!allChronicleLoreMatrices || !Array.isArray(allChronicleLoreMatrices)) {
        allChronicleLoreMatrices = [];
      }
      if (!allChronicleLoreMatrices.some(existingLoreMatrix => existingLoreMatrix.id === createdLoreMatrixData.id)) {
        allChronicleLoreMatrices.push(createdLoreMatrixData);
      }
      
      // Clear the lore matrix form inputs in the DOM
      const loreMatrixTitleInputElement = document.getElementById('newLoreMatrixTitle'); if (loreMatrixTitleInputElement) loreMatrixTitleInputElement.value = '';
      const loreMatrixDescInputElement = document.getElementById('newLoreMatrixDesc'); if (loreMatrixDescInputElement) loreMatrixDescInputElement.value = '';
      closeModal('newLoreMatrixModal');

      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadLoreMatricesForWidget();
      // Display a browser alert confirming creation of the lore matrix
      alert(`Lore Matrix "${loreMatrixTitle}" created successfully!`);
    } else {
      alert(createdLoreMatrixData.error || 'Failed to create lore matrix.');
    }
  }).catch(errorObject => {
    console.error(errorObject);
    alert('Network error creating lore matrix.');
  });
}

async function deleteLoreMatrix(loreMatrixId) {
  const isConfirmed = typeof vtmConfirm === 'function'
    ? await vtmConfirm('Delete this lore matrix and all lore revelations inside it?', 'Delete Lore Matrix')
    : true;
  if (isConfirmed) {
    // Perform an authenticated HTTP DELETE request to delete the lore matrix
    authFetch(`/api/lore_matrices/${loreMatrixId}`, {
      method: 'DELETE'
    }).then(fetchResponse => fetchResponse.json()).then(() => {
      if (Array.isArray(allChronicleLoreMatrices)) {
        allChronicleLoreMatrices = allChronicleLoreMatrices.filter(m => Number(m.id) !== Number(loreMatrixId));
      }
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadLoreMatricesForWidget();
      if (typeof loadGameboardState === 'function') loadGameboardState();
    });
  }
}

function createLoreSubmit() {
  // Look up the new lore entry form input elements in the DOM by their IDs
  const loreMatrixInputElement = document.getElementById('targetLoreMatrixId') || document.getElementById('newLoreMatrixId');
  const loreMatrixId = loreMatrixInputElement ? loreMatrixInputElement.value : null;
  const loreTitle = document.getElementById('newLoreTitle')?.value.trim() || '';
  const revelationVector = document.getElementById('newLoreVector')?.value.trim() || 'Elder Whispers';
  const loreContent = document.getElementById('newLoreContent')?.value.trim() || '';
  // Display a browser alert if required fields are missing
  if (!loreMatrixId) return alert('No target lore matrix selected.');
  if (!loreTitle || !loreContent) return alert('Title and Lore Content are required.');
  // Perform an authenticated HTTP POST request to create a new lore entry
  authFetch('/api/lore_entries', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      matrix_id: parseInt(loreMatrixId),
      title: loreTitle,
      revelation_vector: revelationVector,
      content: loreContent
    })
  }).then(fetchResponse => fetchResponse.json()).then(createdLoreEntryData => {
    if (createdLoreEntryData.id) {
      
      // Clear Lore Form inputs in the DOM
      const loreTitleInputElement = document.getElementById('newLoreTitle'); if (loreTitleInputElement) loreTitleInputElement.value = '';
      const loreVectorInputElement = document.getElementById('newLoreVector'); if (loreVectorInputElement) loreVectorInputElement.value = '';
      const loreContentInputElement = document.getElementById('newLoreContent'); if (loreContentInputElement) loreContentInputElement.value = '';
      closeModal('newLoreModal');

      closeModal('newLoreEntryModal');
      if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
      loadLoreMatricesForWidget();
      // Display a browser alert confirming creation of the lore revelation
      alert(`Lore revelation "${loreTitle}" saved successfully!`);
    } else {
      alert(createdLoreEntryData.error || 'Failed to add lore entry.');
    }
  }).catch(errorObject => {
    console.error(errorObject);
    alert('Network error adding lore entry.');
  });
}


function toggleFloatingClueMatrix() {
  // Look up the floating clue matrix modal element in the DOM by its ID and toggle its active class
  const modalElement = document.getElementById('floatingClueMatrixModal');
  if (modalElement) modalElement.classList.toggle('active');
}

function switchMatrixModalTab(selectedTabName) {
  // Look up the matrix modal clues/lore view containers and tab buttons in the DOM by their IDs
  const cluesViewElement = document.getElementById('matrixModalCluesView');
  const loreViewElement = document.getElementById('matrixModalLoreView');
  const cluesTabButton = document.getElementById('matrixTab-clues');
  const loreTabButton = document.getElementById('matrixTab-lore');
  if (selectedTabName === 'clues') {
    if (cluesViewElement) cluesViewElement.style.display = 'block';
    if (loreViewElement) loreViewElement.style.display = 'none';
    if (cluesTabButton) cluesTabButton.classList.add('active');
    if (loreTabButton) loreTabButton.classList.remove('active');
  } else {
    if (cluesViewElement) cluesViewElement.style.display = 'none';
    if (loreViewElement) loreViewElement.style.display = 'block';
    if (cluesTabButton) cluesTabButton.classList.remove('active');
    if (loreTabButton) loreTabButton.classList.add('active');
  }
}


async function loadClueMatricesForWidget() {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch all episodes for the active chronicle
    const episodesFetchResponse = await authFetch(`/api/episodes?campaign_id=${activeChronicleId}`);
    if (!episodesFetchResponse.ok) return;
    const episodesList = await episodesFetchResponse.json();
    let collectedMatricesList = [];
    for (const episodeSummary of episodesList) {
      // Perform an authenticated HTTP GET request to load each episode's full clue matrices
      const episodeDetailResponse = await authFetch(`/api/episodes/${episodeSummary.id}`);
      if (episodeDetailResponse.ok) {
        const episodeDetailData = await episodeDetailResponse.json();
        if (episodeDetailData.matrices && Array.isArray(episodeDetailData.matrices)) {
          episodeDetailData.matrices.forEach(clueMatrixRecord => {
            clueMatrixRecord.episode_title = episodeSummary.title;
            collectedMatricesList.push(clueMatrixRecord);
          });
        }
      }
    }
    allChronicleClueMatrices = collectedMatricesList;
    // Look up the clue matrix widget select dropdown element in the DOM by its ID
    const matrixSelectElement = document.getElementById('clueMatrixWidgetSelect');
    if (matrixSelectElement) {
      matrixSelectElement.innerHTML = '<option value="">Select Investigation Matrix...</option>';
      collectedMatricesList.forEach(clueMatrixRecord => {
        // Create a new <option> element in memory for each clue matrix
        const optionElement = document.createElement('option');
        optionElement.value = clueMatrixRecord.id;
        optionElement.innerText = `${clueMatrixRecord.title} (${clueMatrixRecord.episode_title || 'Episode'})`;
        matrixSelectElement.appendChild(optionElement);
      });
      if (collectedMatricesList.length > 0) {
        const liveEpId = Number(window.liveGameboardEpisodeId || activeEpisodeId || 0);
        const liveEpMatrix = liveEpId
          ? collectedMatricesList.find(clueMatrixRecord => Number(clueMatrixRecord.episode_id) === liveEpId)
          : null;
        if (!activeWidgetMatrixId || !collectedMatricesList.some(clueMatrixRecord => clueMatrixRecord.id === activeWidgetMatrixId)) {
          activeWidgetMatrixId = (liveEpMatrix || collectedMatricesList[0]).id;
        }
        matrixSelectElement.value = String(activeWidgetMatrixId);
        renderWidgetClueCards(activeWidgetMatrixId);
      } else {
        renderWidgetClueCards(null);
      }
    }
  } catch (errorObject) {
    console.error('Failed to load clue matrices for widget:', errorObject);
  }
}

function handleClueMatrixWidgetChange(matrixId) {
  activeWidgetMatrixId = matrixId ? parseInt(matrixId, 10) : null;
  renderWidgetClueCards(activeWidgetMatrixId);
}

function renderWidgetClueCards(matrixId) {
  // Look up the clue cards canvas container element in the DOM by its ID
  const clueCardsCanvasElement = document.getElementById('clueCardsCanvas');
  if (!clueCardsCanvasElement) return;
  if (!matrixId) {
    clueCardsCanvasElement.innerHTML = `
            <svg class="clue-cords-svg" id="clueCordsSvg"></svg>
            <div class="clue-empty-notice" style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:11px;">
                <i class="fa-solid fa-magnifying-glass" style="font-size:24px;color:#ef4444;margin-bottom:8px;opacity:0.6;display:block;"></i>
                No clue matrix selected. Choose one above to view evidence.
            </div>
        `;
    return;
  }
  const selectedMatrixRecord = allChronicleClueMatrices.find(clueMatrixRecord => clueMatrixRecord.id === matrixId);
  if (!selectedMatrixRecord || !selectedMatrixRecord.clues || selectedMatrixRecord.clues.length === 0) {
    clueCardsCanvasElement.innerHTML = `
            <svg class="clue-cords-svg" id="clueCordsSvg"></svg>
            <div class="clue-empty-notice" style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:11px;">
                <i class="fa-solid fa-folder-open" style="font-size:24px;color:#ef4444;margin-bottom:8px;opacity:0.6;display:block;"></i>
                No clues cataloged in "${escapeHtml(selectedMatrixRecord ? selectedMatrixRecord.title : 'this matrix')}" yet.
            </div>
        `;
    return;
  }
  const isStorytellerOrGm = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  let cardsHtml = '<svg class="clue-cords-svg" id="clueCordsSvg"></svg>';
  selectedMatrixRecord.clues.forEach((clueRecord, clueIndex) => {
    const isRevealed = Boolean(clueRecord.discovered);
    const positionClassName = `clue-pos-${clueIndex % 10 + 1}`;
    if (!isRevealed && !isStorytellerOrGm) {
      const envelopeStyle = chronicleUiSettings.clueEnvelopeBg 
          ? `background:url('${chronicleUiSettings.clueEnvelopeBg}') center/contain no-repeat; background-color:transparent; border:none; box-shadow:none; border-radius:0; backdrop-filter:none; -webkit-backdrop-filter:none;`
          : `background:#fbbf24; border-radius:4px; border:2px solid #b45309; box-shadow:0 4px 6px rgba(0,0,0,0.5);`;
      
      const stampHtml = chronicleUiSettings.clueEnvelopeBg ? '' : '<div style="background:#b45309; color:#fef3c7; font-size:10px; font-weight:bold; padding:2px 10px; border-radius:2px; transform:rotate(-15deg); margin-bottom:10px; border:1px dashed #fef3c7;">CONFIDENTIAL</div>';
      // If a custom envelope is used, hide the title completely to let the envelope art shine, 
      // or at least obscure the name. We'll use '???' for default envelopes, and hide completely for custom.
      const titleHtml = chronicleUiSettings.clueEnvelopeBg 
          ? '' 
          : `<div style="font-size:12px; font-weight:bold; color:#78350f; text-align:center; padding:0 5px; text-shadow:0 0 2px rgba(255,255,255,0.8);">???</div>`;
          
      cardsHtml += `
                <div class="clue-mockup-card ${positionClassName}" onclick="alert('This clue has not been revealed yet.')" title="Sealed Evidence" style="${envelopeStyle}">
                    ${stampHtml}
                    ${titleHtml}
                    <div style="position:absolute; top:5px; right:5px; color:#e2e8f0; font-size:14px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));"><i class="fa-solid fa-lock"></i></div>
                </div>
            `;
    } else {
      const paperStyle = chronicleUiSettings.cluePaperBg
          ? `background:url('${chronicleUiSettings.cluePaperBg}') center/contain no-repeat; background-color:transparent; border:none; box-shadow:none; border-radius:0; backdrop-filter:none; -webkit-backdrop-filter:none;`
          : `background:#f3f4f6; border-radius:2px; border:1px solid #d1d5db; box-shadow:0 2px 4px rgba(0,0,0,0.3); background-image: radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.05) 100%);`;
          
      const paperStampHtml = chronicleUiSettings.cluePaperBg ? '' : '<div style="position:absolute; top:10px; color:#ef4444; font-size:9px; font-weight:900; text-align:center; border:2px solid #ef4444; padding:2px; transform:rotate(-5deg); opacity:0.8;">CLASSIFIED<br>FOU // COTERIE</div>';
      
      const gmToggleHtml = isStorytellerOrGm ? `
          <div style="position:absolute; bottom:5px; left:5px; z-index: 10;">
              <button onclick="event.stopPropagation(); toggleClue(${clueRecord.id});" title="Toggle Visibility" style="background:rgba(0,0,0,0.6); border:1px solid rgba(255,255,255,0.1); color:${isRevealed ? '#10b981' : '#ef4444'}; font-size:10px; font-weight:bold; cursor:pointer; padding:3px 6px; border-radius:4px; backdrop-filter:blur(4px);">
                  <i class="fa-solid ${isRevealed ? 'fa-eye' : 'fa-eye-slash'}"></i> ${isRevealed ? 'Revealed' : 'Hidden'}
              </button>
          </div>
      ` : '';

      const fontSizePixels = chronicleUiSettings.clueTextFontSize !== undefined ? chronicleUiSettings.clueTextFontSize : 10;
      const fontColorHex = chronicleUiSettings.clueTextColor || '#111827';
      const textHaloCss = chronicleUiSettings.clueTextHalo !== false ? 'text-shadow:0 0 4px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.8);' : '';
      
      const topPercentage = chronicleUiSettings.clueTextTop !== undefined ? chronicleUiSettings.clueTextTop : 18;
      const leftPercentage = chronicleUiSettings.clueTextLeft !== undefined ? chronicleUiSettings.clueTextLeft : 10;
      const widthPercentage = chronicleUiSettings.clueTextWidth !== undefined ? chronicleUiSettings.clueTextWidth : 80;
      const heightPercentage = chronicleUiSettings.clueTextHeight !== undefined ? chronicleUiSettings.clueTextHeight : 60;
      
      const dynamicTitleHtml = `
          <div style="position:absolute; top:${topPercentage}%; left:${leftPercentage}%; width:${widthPercentage}%; height:${heightPercentage}%; display:flex; align-items:flex-start; justify-content:center; overflow:hidden;">
              <div style="font-size:${fontSizePixels}px; font-weight:800; color:${fontColorHex}; text-align:center; line-height:1.1; width:100%; ${textHaloCss}">${escapeHtml(clueRecord.title)}</div>
          </div>`;

      cardsHtml += `
                <div class="clue-mockup-card ${positionClassName}" onclick="openClueDetailWidget(${clueRecord.id})" title="Inspect Evidence" style="${paperStyle}">
                    ${paperStampHtml}
                    ${dynamicTitleHtml}
                    ${gmToggleHtml}
                </div>
            `;
    }
  });
  clueCardsCanvasElement.innerHTML = cardsHtml;
  if (typeof renderClueCords === 'function') {
    setTimeout(() => renderClueCords('clueCardsCanvas', 'clueCordsSvg'), 60);
  }
}

function handleClueCardClick(clueKey) {
  let matchedClueRecord = null;
  if (typeof clueKey === 'object' && clueKey !== null) {
    matchedClueRecord = clueKey;
  } else {
    matchedClueRecord = currentEpisodeClues.find(
      clueItem => String(clueItem.id).toLowerCase() === String(clueKey).toLowerCase() || String(clueItem.code).toLowerCase() === String(clueKey).toLowerCase()
    );
    if (!matchedClueRecord) {
      for (const clueMatrixRecord of allChronicleClueMatrices) {
        const foundClueRecord = (clueMatrixRecord.clues || []).find(clueItem => String(clueItem.id) === String(clueKey));
        if (foundClueRecord) {
          matchedClueRecord = foundClueRecord;
          break;
        }
      }
    }
    if (matchedClueRecord) openClueReaderModal(matchedClueRecord);
  }
}

function openClueReaderModal(clueRecord) {
  // Look up the clue reader modal and its internal detail elements in the DOM by their IDs
  const modalElement = document.getElementById('clueReaderModal');
  if (!modalElement) return;
  const badgeElement = document.getElementById('modalClueBadge');
  const titleElement = document.getElementById('modalClueTitle');
  const statusElement = document.getElementById('modalClueStatus');
  const vectorElement = document.getElementById('modalClueVector');
  const locationElement = document.getElementById('modalClueLocation');
  const headingElement = document.getElementById('modalClueHeading');
  const fullTextElement = document.getElementById('modalClueFullText');
  const stampElement = document.getElementById('modalClueStamp');
  const isDiscovered = clueRecord.status === 'discovered' || clueRecord.discovered === 1 || clueRecord.discovered === true;
  if (badgeElement) badgeElement.innerText = clueRecord.code || 'EVIDENCE';
  if (titleElement) titleElement.innerText = isDiscovered ? (clueRecord.title || 'FORENSIC PIECE').toUpperCase() : 'CLASSIFIED EVIDENCE';
  if (statusElement) {
    statusElement.innerText = isDiscovered ? 'DISCOVERED' : 'CLASSIFIED / UNFOUND';
    statusElement.className = isDiscovered ? 'status-uncovered' : 'status-classified';
  }
  if (vectorElement) vectorElement.innerText = isDiscovered ? clueRecord.delivery_method || 'Evidence Archive' : 'Unknown Vector';
  if (locationElement) locationElement.innerText = isDiscovered ? clueRecord.location_hint || 'Undisclosed Scene' : 'Undisclosed Scene';
  if (headingElement) headingElement.innerText = isDiscovered ? `Forensic Dossier: ${clueRecord.title}` : 'RESTRICTED ARCHIVE FILE';
  if (stampElement) {
    stampElement.innerHTML = isDiscovered ? 'CLASSIFIED // FOR OFFICIAL USE ONLY (FOUO)<br><span style="font-size:9.5px;letter-spacing:1px;font-weight:700;">ASSIGNED TO: COTERIE | KINDRED ARCHIVE</span>' : 'RESTRICTED // CLASSIFIED (FOUO)<br><span style="font-size:9.5px;letter-spacing:1px;font-weight:700;">ASSIGNED TO: COTERIE</span>';
  }
  if (fullTextElement) {
    if (isDiscovered) {
      fullTextElement.innerHTML = '<strong style="color:#3b82f6;">PLOT LEAD:</strong> ' + escapeHtml(clueRecord.description || '') + '<br><br><strong style="color:#8b5cf6;">EMOTIONAL CONTEXT:</strong> ' + escapeHtml(clueRecord.emotional_depth || '');
    } else {
      fullTextElement.innerText = 'This investigation piece has not yet been uncovered by the coterie. Investigate active scenes, interrogate witnesses, or examine the gameboard to unlock this dossier.';
    }
  }
  modalElement.classList.add('active');
}

  window.promptDeleteCharacter = async function (mouseEvent, characterId, characterName) {
    mouseEvent.stopPropagation();
    const isConfirmed = await vtmConfirm(`Are you absolutely sure you want to delete "${characterName}"? This action cannot be undone and will permanently erase this character from the chronicle.`, 'DESTRUCTIVE ACTION');
    if (isConfirmed) {
      // Perform an authenticated HTTP DELETE request to permanently remove the character from the chronicle
      authFetch('/api/characters/' + characterId, {
        method: 'DELETE'
      }).then(fetchResponse => fetchResponse.json()).then(responseData => {
        if (responseData.success) {
          if (Number(activeControlledCharacterId) === Number(characterId)) activeControlledCharacterId = null;
          if (Number(activeNpcPersonaId) === Number(characterId)) activeNpcPersonaId = null;
          if (Number(currentLoadedCharacterId) === Number(characterId)) {
            currentLoadedCharacterId = null;
            if (typeof closeSheetModal === 'function') closeSheetModal();
          }
          const floatingSheet = document.getElementById(`floating-sheet-${characterId}`);
          if (floatingSheet) floatingSheet.remove();
          const floatingDossier = document.getElementById(`widget-character-dossier-${characterId}`);
          if (floatingDossier) floatingDossier.remove();
          vtmAlert(`${characterName} has been successfully deleted.`, 'Character Deleted');
          loadCharacters();
        } else {
          vtmAlert('Failed to delete character: ' + responseData.error, 'Error');
        }
      }).catch(errorObject => {
        console.error(errorObject);
        vtmAlert('A network error occurred while deleting the character.', 'Error');
      });
    }
  };
  // Register a global resize listener on the browser window to keep floating desktop widgets within viewport bounds
  window.addEventListener('resize', () => {
    // Query all desktop widget elements in the DOM
    document.querySelectorAll('.elysium-widget').forEach(widgetElement => {
      if (widgetElement.style.display !== 'none') {
        // Measure the widget's bounding rectangle in the browser viewport
        const widgetBoundingRect = widgetElement.getBoundingClientRect();
        let currentLeftPixels = parseInt(widgetElement.style.left) || 0;
        let currentTopPixels = parseInt(widgetElement.style.top) || 0;
        if (currentLeftPixels + widgetBoundingRect.width > window.innerWidth) widgetElement.style.left = Math.max(0, window.innerWidth - widgetBoundingRect.width) + 'px';
        if (currentTopPixels + widgetBoundingRect.height > window.innerHeight) widgetElement.style.top = Math.max(0, window.innerHeight - widgetBoundingRect.height) + 'px';
      }
    });
  });

function renderClueCords(canvasId = 'clueCardsCanvas', svgId = 'clueCordsSvg') {
  // Look up the clue canvas container and SVG overlay elements in the DOM by their IDs
  const canvasElement = document.getElementById(canvasId);
  const svgOverlayElement = document.getElementById(svgId);
  if (!canvasElement || !svgOverlayElement) return;
  // Query all clue card elements inside the canvas container
  const clueCardElements = canvasElement.querySelectorAll('.clue-mockup-card, .clue-mini-card');
  if (clueCardElements.length < 2) {
    svgOverlayElement.innerHTML = '';
    return;
  }
  // Measure the canvas container's bounding rectangle in the viewport
  const canvasBoundingRect = canvasElement.getBoundingClientRect();
  if (canvasBoundingRect.width === 0 || canvasBoundingRect.height === 0) return;
  svgOverlayElement.setAttribute('width', canvasBoundingRect.width);
  svgOverlayElement.setAttribute('height', canvasBoundingRect.height);
  let svgLinesHtml = '';
  for (let cardIndex = 0; cardIndex < clueCardElements.length - 1; cardIndex++) {
    const firstCardElement = clueCardElements[cardIndex];
    const secondCardElement = clueCardElements[cardIndex + 1];
    // Measure both consecutive clue cards' bounding rectangles in the viewport
    const firstCardRect = firstCardElement.getBoundingClientRect();
    const secondCardRect = secondCardElement.getBoundingClientRect();
    let startX, startY, endX, endY;
    if (firstCardRect.left < secondCardRect.left) {
      startX = firstCardRect.right - canvasBoundingRect.left;
      startY = firstCardRect.top + firstCardRect.height * 0.70 - canvasBoundingRect.top;
      endX = secondCardRect.left - canvasBoundingRect.left;
      endY = secondCardRect.top + secondCardRect.height * 0.25 - canvasBoundingRect.top;
    } else {
      startX = firstCardRect.left - canvasBoundingRect.left;
      startY = firstCardRect.top + firstCardRect.height * 0.70 - canvasBoundingRect.top;
      endX = secondCardRect.right - canvasBoundingRect.left;
      endY = secondCardRect.top + secondCardRect.height * 0.25 - canvasBoundingRect.top;
    }
    svgLinesHtml += `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="#dc2626" stroke-width="1.8" stroke-linecap="round" filter="drop-shadow(0 0 4px rgba(220,38,38,0.8))" />`;
  }
  svgOverlayElement.innerHTML = svgLinesHtml;
}

async function openClueMatrixWidget(matrixId) {
  // Display a browser alert if no active chronicle is selected
  if (!activeChronicleId) return alert('Please enter a chronicle first.');
  try {
    let targetMatrixRecord = (allChronicleClueMatrices || []).find(clueMatrixRecord => clueMatrixRecord.id == matrixId);
    if (!targetMatrixRecord) {
      // Perform an authenticated HTTP GET request to fetch the active episode's matrices
      const targetEpId = window.liveGameboardEpisodeId || activeEpisodeId || 12;
      const fetchResponse = await authFetch(`/api/episodes/${targetEpId}`);
      if (fetchResponse.ok) {
        const episodeData = await fetchResponse.json();
        const matricesList = episodeData.matrices || [];
        targetMatrixRecord = matricesList.find(clueMatrixRecord => clueMatrixRecord.id == matrixId) || matricesList[0];
      }
    }
    // Display a browser alert if the requested clue matrix was not found
    if (!targetMatrixRecord) return alert('Clue matrix not found.');
    switchTab('gameboard');
    const widgetId = `widget-matrix-${targetMatrixRecord.id}`;
    // Check if the floating matrix widget already exists in the DOM
    let existingWidgetElement = document.getElementById(widgetId);
    if (existingWidgetElement) {
      existingWidgetElement.style.display = 'flex';
      bringDesktopWidgetToFront(existingWidgetElement);
      return;
    }
    // Look up the desktop workspace container element in the DOM by its ID
    const desktopElement = document.getElementById('elysiumDesktop');
    if (!desktopElement) return;
    const cluesList = targetMatrixRecord.clues || [];
    let cluesHtml = '';
    if (cluesList.length > 0) {
      cluesList.forEach((clueRecord, clueIndex) => {
        const isPaperCard = clueRecord.discovered || clueIndex % 2 === 1;
        cluesHtml += `
                    <div class="clue-mockup-card clue-pos-${clueIndex % 4 + 1} ${isPaperCard ? 'clue-paper-card' : ''}" onclick="openClueDetailWidget(${clueRecord.id})" title="Click to inspect full dossier">
                        <div class="clue-card-id">${clueRecord.code || 'EVIDENCE'}</div>
                        <div class="clue-card-title">${escapeHtml(clueRecord.title)}</div>
                    </div>
                `;
      });
    } else {
      cluesHtml = `
                <div class="clue-mockup-card clue-pos-1 clue-paper-card">
                    <div class="clue-card-id">E1</div>
                    <div class="clue-card-title">${escapeHtml(targetMatrixRecord.title)}</div>
                </div>
            `;
    }
    // Create a new <div> element in memory for the floating clue matrix popup widget
    const popupWidgetElement = document.createElement('div');
    popupWidgetElement.className = 'elysium-widget widget-clue-board widget-matrix-popup';
    popupWidgetElement.id = widgetId;
    popupWidgetElement.style.top = '70px';
    popupWidgetElement.style.left = '400px';
    popupWidgetElement.style.width = '270px';
    popupWidgetElement.style.height = '480px';
    popupWidgetElement.style.zIndex = ++highestDesktopWidgetZIndex;
    popupWidgetElement.innerHTML = `
            <div class="widget-header">
                <span class="widget-title"><i class="fa-solid fa-folder-tree" style="color:#ef4444;margin-right:6px;"></i> ${escapeHtml(targetMatrixRecord.title).toUpperCase()}</span>
                <div class="widget-actions">
                    <button class="btn-w-ctrl" onclick="document.getElementById('${widgetId}').remove()">&times;</button>
                </div>
            </div>
            <div class="widget-body clues-widget-body">
                <div class="clue-cards-canvas" id="canvas-matrix-${targetMatrixRecord.id}">
                    <svg class="clue-cords-svg" id="svg-matrix-${targetMatrixRecord.id}"></svg>
                    ${cluesHtml}
                </div>
            </div>
            <div class="widget-resize-handle"></div>
        `;
    desktopElement.appendChild(popupWidgetElement);
    initDesktopWidgetsDragAndResize();
    setTimeout(() => {
      renderClueCords(`canvas-matrix-${targetMatrixRecord.id}`, `svg-matrix-${targetMatrixRecord.id}`);
    }, 100);
  } catch (errorObject) {
    console.error('Failed to spawn matrix widget:', errorObject);
  }
}

async function loadLoreMatricesForWidget() {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch all lore matrices for the active chronicle
    const fetchResponse = await authFetch(`/api/lore_matrices?campaign_id=${activeChronicleId}`);
    if (!fetchResponse.ok) return;
    const loreMatricesList = await fetchResponse.json();
    allChronicleLoreMatrices = loreMatricesList || [];
    // Look up the lore matrix widget select dropdown element in the DOM by its ID
    const loreMatrixSelectElement = document.getElementById('loreMatrixWidgetSelect');
    if (loreMatrixSelectElement) {
      loreMatrixSelectElement.innerHTML = '<option value="">Select Lore Archive Volume...</option>';
      allChronicleLoreMatrices.forEach(loreMatrixRecord => {
        // Create a new <option> element in memory for each lore matrix volume
        const optionElement = document.createElement('option');
        optionElement.value = loreMatrixRecord.id;
        optionElement.innerText = loreMatrixRecord.title;
        loreMatrixSelectElement.appendChild(optionElement);
      });
      if (allChronicleLoreMatrices.length > 0) {
        if (!activeWidgetLoreMatrixId || !allChronicleLoreMatrices.some(loreMatrixRecord => loreMatrixRecord.id === activeWidgetLoreMatrixId)) {
          activeWidgetLoreMatrixId = allChronicleLoreMatrices[0].id;
        }
        loreMatrixSelectElement.value = String(activeWidgetLoreMatrixId);
        renderWidgetLoreEntries(activeWidgetLoreMatrixId);
      } else {
        renderWidgetLoreEntries(null);
      }
    }
  } catch (errorObject) {
    console.error('Failed to load lore matrices for widget:', errorObject);
  }
}

function handleLoreMatrixWidgetChange(matrixId) {
  activeWidgetLoreMatrixId = matrixId ? parseInt(matrixId, 10) : null;
  renderWidgetLoreEntries(activeWidgetLoreMatrixId);
}



function renderWidgetLoreEntries(matrixId, containerId = 'loreWidgetContent') {
  // Look up the lore widget content container element in the DOM by its ID
  const loreContentContainerElement = document.getElementById(containerId);
  if (!loreContentContainerElement) return;
  if (!matrixId) {
    loreContentContainerElement.innerHTML = `
            <div class="clue-empty-notice" style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:11px;">
                <i class="fa-solid fa-book-bookmark" style="font-size:24px;color:#f59e0b;margin-bottom:8px;opacity:0.6;display:block;"></i>
                No lore volume selected. Choose one above to inspect uncovered setting secrets.
            </div>
        `;
    return;
  }
  const selectedLoreMatrixRecord = allChronicleLoreMatrices.find(loreMatrixRecord => loreMatrixRecord.id === matrixId);
  if (!selectedLoreMatrixRecord || !selectedLoreMatrixRecord.entries || selectedLoreMatrixRecord.entries.length === 0) {
    loreContentContainerElement.innerHTML = `
            <div class="clue-empty-notice" style="text-align:center;padding:30px 10px;color:#9ca3af;font-size:11px;">
                <i class="fa-solid fa-scroll" style="font-size:24px;color:#f59e0b;margin-bottom:8px;opacity:0.6;display:block;"></i>
                No lore revelations discovered in "${escapeHtml(selectedLoreMatrixRecord ? selectedLoreMatrixRecord.title : 'this archive')}" yet.
            </div>
        `;
    return;
  }
  const isStorytellerOrGm = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  let visibleLoreEntries = selectedLoreMatrixRecord.entries.filter(loreEntryRecord => isStorytellerOrGm || loreEntryRecord.discovered);
  
  if (visibleLoreEntries.length === 0) {
    loreContentContainerElement.innerHTML = `
            <div class="clue-empty-notice" style="text-align:center;padding:24px 10px;color:#9ca3af;font-size:11px;">
                No lore revelations discovered in this matrix.
            </div>
        `;
    return;
  }
  loreContentContainerElement.innerHTML = visibleLoreEntries.map(loreEntryRecord => `
        <div class="lore-entry-card">
            <div class="lore-card-header">
                <h5 class="lore-card-title">${escapeHtml(loreEntryRecord.title)}</h5>
                </div>
            <div class="lore-card-vector">
                <i class="fa-solid fa-feather-pointed"></i> <span>Learned via: ${escapeHtml(loreEntryRecord.revelation_vector || 'Elder Whispers')}</span>
                ${isStorytellerOrGm ? loreEntryRecord.discovered ? '<span style="color:#10b981;margin-left:auto;font-weight:700;"><i class="fa-solid fa-check"></i> Revealed</span>' : '<span style="color:#9ca3af;margin-left:auto;">Hidden</span>' : ''}
            </div>
            <div class="lore-card-content">${escapeHtml(loreEntryRecord.content)}</div>
        </div>
    `).join('');
}

function popOutCurrentClueMatrix() {
  // Display a browser alert if no clue matrix is currently selected
  if (!activeWidgetMatrixId) return alert('Please select a clue matrix first.');
  spawnFloatingClueMatrix(activeWidgetMatrixId);
}

function spawnFloatingClueMatrix(matrixId) {
  const selectedMatrixRecord = allChronicleClueMatrices.find(clueMatrixRecord => clueMatrixRecord.id === matrixId);
  // Display a browser alert if the selected clue matrix was not found
  if (!selectedMatrixRecord) return alert('Clue matrix not found.');
  // Look up the desktop workspace container element in the DOM by its ID
  const desktopElement = document.getElementById('elysiumDesktop');
  if (!desktopElement) return;
  const uniqueWidgetId = `widget-clue-popout-${selectedMatrixRecord.id}-${Date.now()}`;
  const canvasId = `canvas-popout-${selectedMatrixRecord.id}-${Date.now()}`;
  const svgId = `svg-popout-${selectedMatrixRecord.id}-${Date.now()}`;
  const cluesList = selectedMatrixRecord.clues || [];
  let cluesHtml = '';
  if (cluesList.length > 0) {
    cluesList.forEach((clueRecord, clueIndex) => {
      const isPaperCard = clueRecord.discovered || clueIndex % 2 === 1;
      cluesHtml += `
                <div class="clue-mockup-card clue-pos-${clueIndex % 4 + 1} ${isPaperCard ? 'clue-paper-card' : ''}" onclick="openClueDetailWidget(${clueRecord.id})" title="Click to inspect full dossier">
                    <div class="clue-card-id">${clueRecord.code || 'EVIDENCE'}</div>
                    <div class="clue-card-title">${escapeHtml(clueRecord.title)}</div>
                </div>
            `;
    });
  } else {
    cluesHtml = `
            <div class="clue-mockup-card clue-pos-1 clue-paper-card">
                <div class="clue-card-id">E1</div>
                <div class="clue-card-title">${escapeHtml(selectedMatrixRecord.title)}</div>
            </div>
        `;
  }
  // Create a new <div> element in memory for the popped-out floating clue matrix window
  const floatingWindowElement = document.createElement('div');
  floatingWindowElement.className = 'elysium-widget widget-clue-board widget-clue-popout';
  floatingWindowElement.id = uniqueWidgetId;
  floatingWindowElement.style.top = `${100 + Math.floor(Math.random() * 60)}px`;
  floatingWindowElement.style.left = `${350 + Math.floor(Math.random() * 80)}px`;
  floatingWindowElement.style.width = '290px';
  floatingWindowElement.style.height = '500px';
  floatingWindowElement.style.zIndex = ++highestDesktopWidgetZIndex;
  floatingWindowElement.innerHTML = `
        <div class="widget-header">
            <span class="widget-title"><i class="fa-solid fa-table-cells" style="color:#ef4444;margin-right:6px;"></i> ${escapeHtml(selectedMatrixRecord.title).toUpperCase()}</span>
            <div class="widget-actions">
                <button class="btn-w-ctrl" onclick="document.getElementById('${uniqueWidgetId}').remove()">&times;</button>
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
  desktopElement.appendChild(floatingWindowElement);
  initDesktopWidgetsDragAndResize();
  setTimeout(() => {
    renderClueCords(canvasId, svgId);
  }, 80);
}

function popOutCurrentLoreMatrix() {
  // Display a browser alert if no lore archive volume is currently selected
  if (!activeWidgetLoreMatrixId) return alert('Please select a lore archive volume first.');
  spawnFloatingLoreMatrix(activeWidgetLoreMatrixId);
}

function spawnFloatingLoreMatrix(matrixId) {
  const selectedLoreMatrixRecord = allChronicleLoreMatrices.find(loreMatrixRecord => loreMatrixRecord.id === matrixId);
  // Display a browser alert if the selected lore archive volume was not found
  if (!selectedLoreMatrixRecord) return alert('Lore volume not found.');
  // Look up the desktop workspace container element in the DOM by its ID
  const desktopElement = document.getElementById('elysiumDesktop');
  if (!desktopElement) return;
  const uniqueWidgetId = `widget-lore-archive-popout-${selectedLoreMatrixRecord.id}-${Date.now()}`;
  const contentContainerId = `lore-content-${selectedLoreMatrixRecord.id}-${Date.now()}`;
  // Create a new <div> element in memory for the popped-out floating lore archive window
  const floatingWindowElement = document.createElement('div');
  floatingWindowElement.className = 'elysium-widget widget-lore-archive widget-lore-archive-popout';
  floatingWindowElement.id = uniqueWidgetId;
  floatingWindowElement.style.top = `${120 + Math.floor(Math.random() * 60)}px`;
  floatingWindowElement.style.left = `${680 + Math.floor(Math.random() * 80)}px`;
  floatingWindowElement.style.width = '330px';
  floatingWindowElement.style.height = '520px';
  floatingWindowElement.style.zIndex = ++highestDesktopWidgetZIndex;
  floatingWindowElement.innerHTML = `
        <div class="widget-header">
            <span class="widget-title"><i class="fa-solid fa-book-journal-whills" style="color:#f59e0b;margin-right:6px;"></i> ${escapeHtml(selectedLoreMatrixRecord.title).toUpperCase()}</span>
            <div class="widget-actions">
                <button class="btn-w-ctrl" onclick="document.getElementById('${uniqueWidgetId}').remove()">&times;</button>
            </div>
        </div>
        <div class="widget-body lore-widget-body" id="${contentContainerId}"></div>
        <div class="widget-resize-handle"></div>
    `;
  desktopElement.appendChild(floatingWindowElement);
  initDesktopWidgetsDragAndResize();
  renderWidgetLoreEntries(matrixId, 'all', contentContainerId);
}


window.openEditClueModal = function(clueId) {
    let targetClueRecord = null;
    for (let clueMatrixRecord of allChronicleClueMatrices) {
        targetClueRecord = clueMatrixRecord.clues.find(clueItem => clueItem.id === clueId);
        if (targetClueRecord) break;
    }
    if (!targetClueRecord) return;

    // Look up the edit clue modal input elements in the DOM by their IDs and populate them
    document.getElementById('editClueId').value = targetClueRecord.id;
    document.getElementById('editClueTitle').value = targetClueRecord.title || '';
    document.getElementById('editClueDelivery').value = targetClueRecord.delivery_method || '';
    document.getElementById('editClueLocation').value = targetClueRecord.location_hint || '';
    document.getElementById('editClueDesc').value = targetClueRecord.description || '';
    const emotionalInputElement = document.getElementById('editClueEmotional');
    if (emotionalInputElement) emotionalInputElement.value = targetClueRecord.emotional_depth || '';

    document.getElementById('editClueModal').classList.add('active');
};

window.editClueSubmit = async function() {
    // Look up the edit clue ID and title input elements in the DOM by their IDs
    const clueId = document.getElementById('editClueId').value;
    const clueTitle = document.getElementById('editClueTitle').value.trim();
    // Display a browser alert if the title is empty
    if (!clueTitle) return alert('Title required');

    try {
        // Perform an authenticated HTTP PUT request to update the clue details on the server
        const fetchResponse = await authFetch('/api/clues/' + clueId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: clueTitle,
                delivery_method: document.getElementById('editClueDelivery').value.trim(),
                location_hint: document.getElementById('editClueLocation').value.trim(),
                description: document.getElementById('editClueDesc').value.trim(),
                emotional_depth: document.getElementById('editClueEmotional') ? document.getElementById('editClueEmotional').value.trim() : ''
            })
        });
        if (fetchResponse.ok) {
            closeModal('editClueModal');
            loadEpisodeDetails(activeEpisodeId);
            loadClueMatricesForWidget();
        } else {
            alert('Failed to update clue');
        }
    } catch(errorObject) {
        console.error(errorObject);
        alert('Error updating clue');
    }
};

window.deleteClue = async function(clueId) {
    const isConfirmed = typeof vtmConfirm === 'function'
      ? await vtmConfirm('Are you sure you want to delete this clue completely?', 'Delete Clue')
      : true;
    if (!isConfirmed) return;
    try {
        // Perform an authenticated HTTP DELETE request to delete the clue from the server
        const fetchResponse = await authFetch('/api/clues/' + clueId, { method: 'DELETE' });
        if (fetchResponse.ok) {
            if (typeof removeClueFromGameboard === 'function') removeClueFromGameboard(clueId);
            if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
            loadClueMatricesForWidget();
        } else {
            alert('Failed to delete clue');
        }
    } catch(errorObject) {
        console.error(errorObject);
    }
};



async function deleteLoreEntry(loreEntryId, loreTitle) {
    const isConfirmed = typeof vtmConfirm === 'function'
      ? await vtmConfirm('Are you sure you want to permanently delete the lore revelation "' + loreTitle + '"?', 'Delete Lore Entry')
      : true;
    if (!isConfirmed) return;
    try {
        // Perform an authenticated HTTP DELETE request to remove the lore entry from the server
        const fetchResponse = await authFetch('/api/lore_entries/' + loreEntryId, { method: 'DELETE' });
        if (fetchResponse.ok) {
            if (typeof removeLoreFromGameboard === 'function') removeLoreFromGameboard(loreEntryId);
            if (activeEpisodeId) loadEpisodeDetails(activeEpisodeId);
            loadLoreMatricesForWidget();
        }
    } catch(errorObject) { console.error(errorObject); }
}

async function editLoreEntry(loreEntryId) {
    // Find the lore entry in allChronicleLoreMatrices
    let targetLoreEntryRecord = null;
    for (const loreMatrixRecord of allChronicleLoreMatrices) {
        if (loreMatrixRecord.entries) {
            targetLoreEntryRecord = loreMatrixRecord.entries.find(loreEntryItem => loreEntryItem.id == loreEntryId);
            if (targetLoreEntryRecord) break;
        }
    }
    // Display a browser alert if the lore entry could not be found in memory
    if (!targetLoreEntryRecord) return alert("Lore entry not found in memory.");

    // Reuse the Add Lore modal in the DOM, changing its button text to "Update" and overriding its onclick handler
    document.getElementById('newLoreTitle').value = targetLoreEntryRecord.title;
    const vectorInputElement = document.getElementById('newLoreVector');
    if (vectorInputElement) vectorInputElement.value = targetLoreEntryRecord.revelation_vector || '';
    document.getElementById('newLoreContent').value = targetLoreEntryRecord.content;
    
    // Look up the modal and query its header title and save button in the DOM
    const loreModalElement = document.getElementById('newLoreModal');
    const modalTitleElement = loreModalElement.querySelector('.modal-header h3');
    modalTitleElement.innerHTML = '<i class="fa-solid fa-pen" style="color:#ef4444;margin-right:6px;"></i> Edit Lore Revelation';
    
    const saveButtonElement = loreModalElement.querySelector('.btn-action');
    const originalOnclickHandler = saveButtonElement.onclick;
    saveButtonElement.innerText = 'Update Revelation';
    saveButtonElement.onclick = async () => {
        // Look up the edited lore title and content inputs in the DOM
        const updatedTitle = document.getElementById('newLoreTitle').value.trim();
        const updatedVector = vectorInputElement ? vectorInputElement.value.trim() : '';
        const updatedContent = document.getElementById('newLoreContent').value.trim();
        
        if (!updatedTitle || !updatedContent) return alert('Title and Content are required.');
        
        try {
            // Perform an authenticated HTTP PUT request to save the updated lore entry
            const fetchResponse = await authFetch('/api/lore_entries/' + loreEntryId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: updatedTitle, revelation_vector: updatedVector, content: updatedContent })
            });
            if (fetchResponse.ok) {
                
      // Clear Lore Form inputs in the DOM
      const loreTitleInputElement = document.getElementById('newLoreTitle'); if (loreTitleInputElement) loreTitleInputElement.value = '';
      const loreVectorInputElement = document.getElementById('newLoreVector'); if (loreVectorInputElement) loreVectorInputElement.value = '';
      const loreContentInputElement = document.getElementById('newLoreContent'); if (loreContentInputElement) loreContentInputElement.value = '';
      closeModal('newLoreModal');

                loadEpisodeDetails(activeEpisodeId);
                loadLoreMatricesForWidget();
            }
        } catch(errorObject) { console.error(errorObject); }
    };
    
    // When the modal closes, reset the button back to Create mode for the next time they click "+ Add Lore"
    const originalCloseHandler = loreModalElement.querySelector('.btn-close-modal').onclick;
    const resetModal = () => {
        modalTitleElement.innerHTML = '<i class="fa-solid fa-scroll" style="color:#ef4444;margin-right:6px;"></i> Add Lore Revelation';
        saveButtonElement.innerText = 'Save Lore Revelation';
        saveButtonElement.onclick = originalOnclickHandler; // restore original create action
        document.getElementById('newLoreTitle').value = '';
        if(vectorInputElement) vectorInputElement.value = '';
        document.getElementById('newLoreContent').value = '';
    };
    
    // Attach one-time click listeners to the modal close and cancel buttons in the DOM
    loreModalElement.querySelector('.btn-close-modal').addEventListener('click', resetModal, { once: true });
    loreModalElement.querySelector('.btn-action-outline').addEventListener('click', resetModal, { once: true });
    
    loreModalElement.style.display = 'flex';
}


let chronicleUiSettings = {};

async function handleClueBgUpload(changeEvent, backgroundType) {
    const selectedFile = changeEvent.target.files[0];
    if (!selectedFile) return;
    
    // Instantiate a browser FileReader to convert the uploaded file into a Base64 data URL
    const fileReader = new FileReader();
    fileReader.onload = async (loadEvent) => {
        const base64Data = loadEvent.target.result;
        try {
            // Perform an authenticated HTTP POST request to upload the Base64 background image
            const fetchResponse = await authFetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: base64Data, filename: selectedFile.name })
            });
            const responseData = await fetchResponse.json();
            if (responseData.success) {
                // Save it to ui_settings
                if (backgroundType === 'paper') chronicleUiSettings.cluePaperBg = responseData.url;
                if (backgroundType === 'envelope') chronicleUiSettings.clueEnvelopeBg = responseData.url;
                
                // Push updated UI settings to the server via an authenticated HTTP PUT request
                await authFetch(`/api/chronicles/${activeChronicleId}/ui_settings`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(chronicleUiSettings)
                });
                
                // Re-render
                if (typeof activeWidgetMatrixId !== 'undefined' && activeWidgetMatrixId) {
                    renderWidgetClueCards(activeWidgetMatrixId);
                }
            }
        } catch (errorObject) {
            console.error('Clue background upload failed', errorObject);
            alert('Upload failed.');
        }
    };
    // Read the selected file as a Base64 data URL string using the browser FileReader API
    fileReader.readAsDataURL(selectedFile);
}


function openClueBgPicker(backgroundType) {
    openAssetPicker((selectedImageUrl) => {
        if (backgroundType === 'paper') {
            tempClueConfig.cluePaperBg = selectedImageUrl;
            // Look up the clue config paper preview and visual placer elements in the DOM by their IDs
            const paperPreviewElement = document.getElementById('clueConfigPaperPreview');
            if (paperPreviewElement) { paperPreviewElement.src = selectedImageUrl; paperPreviewElement.style.display = 'block'; }
            
            // Preview it live
            chronicleUiSettings.cluePaperBg = selectedImageUrl;
            const visualPlacerElement = document.getElementById('clueVisualPlacer');
            if (visualPlacerElement) visualPlacerElement.style.background = `url('${selectedImageUrl}') center/contain no-repeat`;
            const detailVisualPlacerElement = document.getElementById('clueDetailVisualPlacer');
            if (detailVisualPlacerElement) detailVisualPlacerElement.style.background = `url('${selectedImageUrl}') center/contain no-repeat`;
        }
        if (backgroundType === 'envelope') {
            tempClueConfig.clueEnvelopeBg = selectedImageUrl;
            // Look up the clue config envelope preview element in the DOM by its ID
            const envelopePreviewElement = document.getElementById('clueConfigEnvPreview');
            if (envelopePreviewElement) { envelopePreviewElement.src = selectedImageUrl; envelopePreviewElement.style.display = 'block'; }
            
            // Preview it live
            chronicleUiSettings.clueEnvelopeBg = selectedImageUrl;
        }
        
        if (typeof activeWidgetMatrixId !== 'undefined' && activeWidgetMatrixId) {
            renderWidgetClueCards(activeWidgetMatrixId);
        }
    });
}

let tempClueConfig = {
    clueEnvelopeBg: null,
    cluePaperBg: null
};

function openClueConfigModal() {
    if (!chronicleUiSettings) chronicleUiSettings = {};
    
    // Copy existing settings to temp
    tempClueConfig.clueEnvelopeBg = chronicleUiSettings.clueEnvelopeBg || '';
    tempClueConfig.cluePaperBg = chronicleUiSettings.cluePaperBg || '';
    
    // Look up the preview image elements in the DOM by their IDs
    const envelopePreviewElement = document.getElementById('clueConfigEnvPreview');
    if (tempClueConfig.clueEnvelopeBg) { envelopePreviewElement.src = tempClueConfig.clueEnvelopeBg; envelopePreviewElement.style.display = 'block'; } else { envelopePreviewElement.style.display = 'none'; }
    
    const paperPreviewElement = document.getElementById('clueConfigPaperPreview');
    if (tempClueConfig.cluePaperBg) { paperPreviewElement.src = tempClueConfig.cluePaperBg; paperPreviewElement.style.display = 'block'; } else { paperPreviewElement.style.display = 'none'; }
    
    // Look up and populate all clue configuration input elements in the DOM by their IDs
    document.getElementById('clueConfigFontSize').value = chronicleUiSettings.clueTextFontSize !== undefined ? chronicleUiSettings.clueTextFontSize : 10;
    document.getElementById('clueConfigColor').value = chronicleUiSettings.clueTextColor || '#111827';
    document.getElementById('clueConfigHalo').checked = chronicleUiSettings.clueTextHalo !== false;
    
    document.getElementById('clueTextTop').value = chronicleUiSettings.clueTextTop !== undefined ? chronicleUiSettings.clueTextTop : 18;
    document.getElementById('clueTextLeft').value = chronicleUiSettings.clueTextLeft !== undefined ? chronicleUiSettings.clueTextLeft : 10;
    document.getElementById('clueTextWidth').value = chronicleUiSettings.clueTextWidth !== undefined ? chronicleUiSettings.clueTextWidth : 80;
    document.getElementById('clueTextHeight').value = chronicleUiSettings.clueTextHeight !== undefined ? chronicleUiSettings.clueTextHeight : 60;
    
    document.getElementById('clueDetailTop').value = chronicleUiSettings.clueDetailTop !== undefined ? chronicleUiSettings.clueDetailTop : 10;
    document.getElementById('clueDetailLeft').value = chronicleUiSettings.clueDetailLeft !== undefined ? chronicleUiSettings.clueDetailLeft : 10;
    document.getElementById('clueDetailWidth').value = chronicleUiSettings.clueDetailWidth !== undefined ? chronicleUiSettings.clueDetailWidth : 80;
    document.getElementById('clueDetailHeight').value = chronicleUiSettings.clueDetailHeight !== undefined ? chronicleUiSettings.clueDetailHeight : 80;
    
    updateClueBoxFromInputs();
    updateClueDetailBoxFromInputs();
    
    // Look up the visual placer elements in the DOM to set their background to the paper image
    const visualPlacerElement = document.getElementById('clueVisualPlacer');
    const detailVisualPlacerElement = document.getElementById('clueDetailVisualPlacer');
    if (visualPlacerElement) {
        if (tempClueConfig.cluePaperBg) {
            visualPlacerElement.style.background = `url('${tempClueConfig.cluePaperBg}') center/contain no-repeat`;
            if (detailVisualPlacerElement) detailVisualPlacerElement.style.background = `url('${tempClueConfig.cluePaperBg}') center/contain no-repeat`;
        } else {
            visualPlacerElement.style.background = `#f3f4f6`;
            if (detailVisualPlacerElement) detailVisualPlacerElement.style.background = `#f3f4f6`;
        }
    }
    
    // Look up the clue config modal element in the DOM and mark it active
    document.getElementById('clueConfigModal').classList.add('active');
}

function updateClueTextConfigLive() {
    // Read the live clue text layout values from the DOM inputs and trigger a re-render to preview behind the modal
    if (!chronicleUiSettings) chronicleUiSettings = {};
    chronicleUiSettings.clueTextTop = parseInt(document.getElementById('clueTextTop').value, 10);
    chronicleUiSettings.clueTextLeft = parseInt(document.getElementById('clueTextLeft').value, 10);
    chronicleUiSettings.clueTextWidth = parseInt(document.getElementById('clueTextWidth').value, 10);
    chronicleUiSettings.clueTextHeight = parseInt(document.getElementById('clueTextHeight').value, 10);
    chronicleUiSettings.clueTextFontSize = parseInt(document.getElementById('clueConfigFontSize').value, 10);
    
    chronicleUiSettings.clueDetailTop = parseInt(document.getElementById('clueDetailTop').value, 10);
    chronicleUiSettings.clueDetailLeft = parseInt(document.getElementById('clueDetailLeft').value, 10);
    chronicleUiSettings.clueDetailWidth = parseInt(document.getElementById('clueDetailWidth').value, 10);
    chronicleUiSettings.clueDetailHeight = parseInt(document.getElementById('clueDetailHeight').value, 10);
    
    // Look up the clue preview text element in the DOM by its ID
    const previewTextElement = document.getElementById('cluePreviewText');
    if (previewTextElement) {
        previewTextElement.style.fontSize = chronicleUiSettings.clueTextFontSize + 'px';
        previewTextElement.style.color = chronicleUiSettings.clueTextColor;
        previewTextElement.style.textShadow = chronicleUiSettings.clueTextHalo ? '0 0 4px rgba(255,255,255,1), 0 0 8px rgba(255,255,255,0.8)' : 'none';
    }
    chronicleUiSettings.clueTextColor = document.getElementById('clueConfigColor').value;
    chronicleUiSettings.clueTextHalo = document.getElementById('clueConfigHalo').checked;
    
    if (typeof activeWidgetMatrixId !== 'undefined' && activeWidgetMatrixId) {
        renderWidgetClueCards(activeWidgetMatrixId);
    }
}

function saveClueConfig() {
    if (!chronicleUiSettings) chronicleUiSettings = {};
    
    // Read all clue configuration input values from the DOM by their IDs
    chronicleUiSettings.clueEnvelopeBg = tempClueConfig.clueEnvelopeBg;
    chronicleUiSettings.cluePaperBg = tempClueConfig.cluePaperBg;
    chronicleUiSettings.clueTextTop = parseInt(document.getElementById('clueTextTop').value, 10);
    chronicleUiSettings.clueTextLeft = parseInt(document.getElementById('clueTextLeft').value, 10);
    chronicleUiSettings.clueTextWidth = parseInt(document.getElementById('clueTextWidth').value, 10);
    chronicleUiSettings.clueTextHeight = parseInt(document.getElementById('clueTextHeight').value, 10);
    chronicleUiSettings.clueTextFontSize = parseInt(document.getElementById('clueConfigFontSize').value, 10);
    chronicleUiSettings.clueTextColor = document.getElementById('clueConfigColor').value;
    chronicleUiSettings.clueTextHalo = document.getElementById('clueConfigHalo').checked;
    
    // Perform an authenticated HTTP PUT request to persist the chronicle UI settings on the server
    authFetch(`/api/chronicles/${activeChronicleId}/ui_settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chronicleUiSettings)
    }).then(() => {
        // Look up the clue config modal element in the DOM and close it
        document.getElementById('clueConfigModal').classList.remove('active');
        if (typeof activeWidgetMatrixId !== 'undefined' && activeWidgetMatrixId) {
            renderWidgetClueCards(activeWidgetMatrixId);
        }
    }).catch(errorObject => console.error(errorObject));
}

// --- CLUE DRAG & RESIZE LOGIC ---
let isClueDragging = false;
let isClueResizing = false;
let clueDragStart = {x:0, y:0};
let clueBoxStart = {top:0, left:0, width:0, height:0};
let clueResizeDir = '';

// Register a DOMContentLoaded listener on the document to initialize clue drag-box positioning controls
document.addEventListener('DOMContentLoaded', () => {
    // Look up the clue drag box and visual placer container elements in the DOM by their IDs
    const dragBoxElement = document.getElementById('clueDragBox');
    const visualPlacerContainerElement = document.getElementById('clueVisualPlacer');
    if(!dragBoxElement || !visualPlacerContainerElement) return;
    
    dragBoxElement.addEventListener('mousedown', (mouseEvent) => {
        if (mouseEvent.target.classList.contains('clue-resize-handle')) {
            isClueResizing = true;
            clueResizeDir = mouseEvent.target.getAttribute('data-dir');
        } else {
            isClueDragging = true;
        }
        
        clueDragStart = {x: mouseEvent.clientX, y: mouseEvent.clientY};
        clueBoxStart = {
            top: dragBoxElement.offsetTop,
            left: dragBoxElement.offsetLeft,
            width: dragBoxElement.offsetWidth,
            height: dragBoxElement.offsetHeight
        };
        mouseEvent.preventDefault(); // Prevent text selection
    });
    
    document.addEventListener('mousemove', (mouseEvent) => {
        if (!isClueDragging && !isClueResizing) return;
        
        const deltaX = mouseEvent.clientX - clueDragStart.x;
        const deltaY = mouseEvent.clientY - clueDragStart.y;
        
        const containerWidth = visualPlacerContainerElement.offsetWidth;
        const containerHeight = visualPlacerContainerElement.offsetHeight;
        
        let newTopPixels = clueBoxStart.top;
        let newLeftPixels = clueBoxStart.left;
        let newWidthPixels = clueBoxStart.width;
        let newHeightPixels = clueBoxStart.height;
        
        if (isClueDragging) {
            newTopPixels += deltaY;
            newLeftPixels += deltaX;
        } else if (isClueResizing) {
            if (clueResizeDir.includes('n')) { newTopPixels += deltaY; newHeightPixels -= deltaY; }
            if (clueResizeDir.includes('s')) { newHeightPixels += deltaY; }
            if (clueResizeDir.includes('w')) { newLeftPixels += deltaX; newWidthPixels -= deltaX; }
            if (clueResizeDir.includes('e')) { newWidthPixels += deltaX; }
        }
        
        // Boundaries
        if (newWidthPixels < 20) newWidthPixels = 20;
        if (newHeightPixels < 20) newHeightPixels = 20;
        if (newLeftPixels < 0) newLeftPixels = 0;
        if (newTopPixels < 0) newTopPixels = 0;
        if (newLeftPixels + newWidthPixels > containerWidth) newWidthPixels = containerWidth - newLeftPixels;
        if (newTopPixels + newHeightPixels > containerHeight) newHeightPixels = containerHeight - newTopPixels;
        
        dragBoxElement.style.top = newTopPixels + 'px';
        dragBoxElement.style.left = newLeftPixels + 'px';
        dragBoxElement.style.width = newWidthPixels + 'px';
        dragBoxElement.style.height = newHeightPixels + 'px';
        
        // Update percentage inputs in the DOM by their IDs
        document.getElementById('clueTextTop').value = Math.round((newTopPixels / containerHeight) * 100);
        document.getElementById('clueTextLeft').value = Math.round((newLeftPixels / containerWidth) * 100);
        document.getElementById('clueTextWidth').value = Math.round((newWidthPixels / containerWidth) * 100);
        document.getElementById('clueTextHeight').value = Math.round((newHeightPixels / containerHeight) * 100);
        
        updateClueTextConfigLive();
    });
    
    document.addEventListener('mouseup', () => {
        isClueDragging = false;
        isClueResizing = false;
    });
});

function updateClueBoxFromInputs() {
    // Look up the clue drag box and coordinate input elements in the DOM by their IDs
    const dragBoxElement = document.getElementById('clueDragBox');
    if (!dragBoxElement) return;
    dragBoxElement.style.top = document.getElementById('clueTextTop').value + '%';
    dragBoxElement.style.left = document.getElementById('clueTextLeft').value + '%';
    dragBoxElement.style.width = document.getElementById('clueTextWidth').value + '%';
    dragBoxElement.style.height = document.getElementById('clueTextHeight').value + '%';
    updateClueTextConfigLive();
}
// --------------------------------

// --- CLUE DETAIL DRAG & RESIZE LOGIC ---
let isDetailDragging = false;
let isDetailResizing = false;
let detailDragStart = {x:0, y:0};
let detailBoxStart = {top:0, left:0, width:0, height:0};
let detailResizeDir = '';

// Register a DOMContentLoaded listener on the document to initialize clue detail drag-box positioning controls
document.addEventListener('DOMContentLoaded', () => {
    // Look up the clue detail drag box and visual placer container elements in the DOM by their IDs
    const detailDragBoxElement = document.getElementById('clueDetailDragBox');
    const detailVisualPlacerContainerElement = document.getElementById('clueDetailVisualPlacer');
    if(!detailDragBoxElement || !detailVisualPlacerContainerElement) return;
    
    detailDragBoxElement.addEventListener('mousedown', (mouseEvent) => {
        if (mouseEvent.target.classList.contains('clue-detail-resize-handle')) {
            isDetailResizing = true;
            detailResizeDir = mouseEvent.target.getAttribute('data-dir');
        } else {
            isDetailDragging = true;
        }
        
        detailDragStart = {x: mouseEvent.clientX, y: mouseEvent.clientY};
        detailBoxStart = {
            top: detailDragBoxElement.offsetTop,
            left: detailDragBoxElement.offsetLeft,
            width: detailDragBoxElement.offsetWidth,
            height: detailDragBoxElement.offsetHeight
        };
        mouseEvent.preventDefault();
    });
    
    document.addEventListener('mousemove', (mouseEvent) => {
        if (!isDetailDragging && !isDetailResizing) return;
        
        const deltaX = mouseEvent.clientX - detailDragStart.x;
        const deltaY = mouseEvent.clientY - detailDragStart.y;
        
        const containerWidth = detailVisualPlacerContainerElement.offsetWidth;
        const containerHeight = detailVisualPlacerContainerElement.offsetHeight;
        
        let newTopPixels = detailBoxStart.top;
        let newLeftPixels = detailBoxStart.left;
        let newWidthPixels = detailBoxStart.width;
        let newHeightPixels = detailBoxStart.height;
        
        if (isDetailDragging) {
            newTopPixels += deltaY;
            newLeftPixels += deltaX;
        } else if (isDetailResizing) {
            if (detailResizeDir.includes('n')) { newTopPixels += deltaY; newHeightPixels -= deltaY; }
            if (detailResizeDir.includes('s')) { newHeightPixels += deltaY; }
            if (detailResizeDir.includes('w')) { newLeftPixels += deltaX; newWidthPixels -= deltaX; }
            if (detailResizeDir.includes('e')) { newWidthPixels += deltaX; }
        }
        
        if (newWidthPixels < 20) newWidthPixels = 20;
        if (newHeightPixels < 20) newHeightPixels = 20;
        if (newLeftPixels < 0) newLeftPixels = 0;
        if (newTopPixels < 0) newTopPixels = 0;
        if (newLeftPixels + newWidthPixels > containerWidth) newWidthPixels = containerWidth - newLeftPixels;
        if (newTopPixels + newHeightPixels > containerHeight) newHeightPixels = containerHeight - newTopPixels;
        
        detailDragBoxElement.style.top = newTopPixels + 'px';
        detailDragBoxElement.style.left = newLeftPixels + 'px';
        detailDragBoxElement.style.width = newWidthPixels + 'px';
        detailDragBoxElement.style.height = newHeightPixels + 'px';
        
        // Update clue detail percentage inputs in the DOM by their IDs
        document.getElementById('clueDetailTop').value = Math.round((newTopPixels / containerHeight) * 100);
        document.getElementById('clueDetailLeft').value = Math.round((newLeftPixels / containerWidth) * 100);
        document.getElementById('clueDetailWidth').value = Math.round((newWidthPixels / containerWidth) * 100);
        document.getElementById('clueDetailHeight').value = Math.round((newHeightPixels / containerHeight) * 100);
        
        updateClueDetailBoxFromInputs();
    });
    
    document.addEventListener('mouseup', () => {
        isDetailDragging = false;
        isDetailResizing = false;
    });
});

function updateClueDetailBoxFromInputs() {
    // Look up the clue detail drag box and coordinate input elements in the DOM by their IDs
    const detailDragBoxElement = document.getElementById('clueDetailDragBox');
    if (!detailDragBoxElement) return;
    detailDragBoxElement.style.top = document.getElementById('clueDetailTop').value + '%';
    detailDragBoxElement.style.left = document.getElementById('clueDetailLeft').value + '%';
    detailDragBoxElement.style.width = document.getElementById('clueDetailWidth').value + '%';
    detailDragBoxElement.style.height = document.getElementById('clueDetailHeight').value + '%';
    
    // Save to memory
    if (!chronicleUiSettings) chronicleUiSettings = {};
    chronicleUiSettings.clueDetailTop = parseInt(document.getElementById('clueDetailTop').value, 10);
    chronicleUiSettings.clueDetailLeft = parseInt(document.getElementById('clueDetailLeft').value, 10);
    chronicleUiSettings.clueDetailWidth = parseInt(document.getElementById('clueDetailWidth').value, 10);
    chronicleUiSettings.clueDetailHeight = parseInt(document.getElementById('clueDetailHeight').value, 10);
}
// --------------------------------
