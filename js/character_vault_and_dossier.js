/**
 * Character Sheet Vault (tab-character-vault), Character Dossier (widget-character-dossier), and Character Cast (widget-character-cast)
 */
function changeGmPersona(personaName) {
  if (!activeChronicleId) return;
  const personaAvatarUrlMap = {
    'Storyteller': '/images/st_avatar.png'
  };
  const resolvedAvatarUrl = personaAvatarUrlMap[personaName] || '/images/default_npc.jpg';
  // Perform an authenticated HTTP POST request to update the active GM/NPC persona on the gameboard scene
  authFetch('/api/gameboard/scene', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // Serialize the chronicle ID, active persona name, and avatar URL into a JSON payload
    body: JSON.stringify({
      chronicle_id: activeChronicleId,
      active_npc_persona: personaName,
      active_npc_avatar: resolvedAvatarUrl
    })
  });
}


function assumeActiveControl(characterId) {
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
  if (!characterRecord) return;

  // Verify ownership before allowing a player to assume control
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  let isOwnerOrAuthorizedPilot = true;
  if (!isStoryteller) {
      const authorizedUserIdsList = Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
      isOwnerOrAuthorizedPilot = currentUser && (characterRecord.user_id === currentUser.id || authorizedUserIdsList.includes(currentUser.id));
  }
  
  if (!isOwnerOrAuthorizedPilot) {
      // Just load it into the dossier widget for viewing, do not change chat persona
      currentLoadedCharacterId = characterId;
      updateDossierWidget(characterRecord);
      if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
      
      // Look up the modal assume-control button element in the DOM by ID
      const modalAssumeControlButton = document.getElementById('btnModalAssumeControl');
      if (modalAssumeControlButton) {
        modalAssumeControlButton.innerText = 'Assume Control';
        modalAssumeControlButton.classList.remove('active-pilot');
      }
      return;
  }
  activeControlledCharacterId = characterId;
  activeNpcPersonaId = null;
  currentLoadedCharacterId = characterId;
  renderCoterieTokens(chronicleCharactersList);
  updateDossierWidget(characterRecord);
  // Look up the dice persona selector dropdown in the DOM by ID
  const dicePersonaSelectElement = document.getElementById('dicePersonaSelect');
  if (dicePersonaSelectElement) {
    dicePersonaSelectElement.value = String(characterId);
  }
  // Look up the dice roller name input element in the DOM by ID
  const diceRollerNameInputElement = document.getElementById('diceRollerName');
  if (diceRollerNameInputElement) {
    diceRollerNameInputElement.value = characterRecord.name;
  }
  // Look up the chat sender label element in the DOM by ID
  const chatSenderLabelElement = document.getElementById('chatSenderLabel');
  if (chatSenderLabelElement) {
    chatSenderLabelElement.innerText = `Speaking as: ${characterRecord.name}`;
  }
  

  const canEditCharacter = isStoryteller || isOwnerOrAuthorizedPilot;
  // Look up the privacy mode toggle button element in the DOM by ID
  const privacyModeToggleButton = document.getElementById('btnPrivacyModeToggle');
  if (privacyModeToggleButton) {
    if (canEditCharacter) {
      privacyModeToggleButton.style.display = 'inline-flex';
      privacyModeToggleButton.classList.remove('active-pilot');
    } else {
      privacyModeToggleButton.style.display = 'none';
    }
  }
  // Look up the modal assume-control button element in the DOM by ID
  const modalAssumeControlButton = document.getElementById('btnModalAssumeControl');
  if (modalAssumeControlButton) {
    modalAssumeControlButton.innerText = 'Active Persona (Currently Piloting)';
    modalAssumeControlButton.classList.add('active-pilot');
  }
  renderCharacterCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
  if (socket && activeChronicleId) {
    // Emit a Socket.IO event to notify the server and other players of the user's active character presence
    socket.emit('presence:set_character', {
      campaignId: activeChronicleId,
      characterId: characterId,
      isSpectator: false
    });
  }
}

function isCharacterHiddenFromPlayers(characterRecord) {
  if (!characterRecord) return false;
  const rawHidden = characterRecord.hidden_from_user_ids;
  if (rawHidden === null || rawHidden === undefined || rawHidden === 'null' || rawHidden === '' || rawHidden === '[]') {
    return false;
  }
  if (Array.isArray(rawHidden)) {
    return rawHidden.length > 0;
  }
  if (typeof rawHidden === 'string') {
    try {
      const parsed = JSON.parse(rawHidden);
      return Array.isArray(parsed) && parsed.length > 0;
    } catch (e) {
      return false;
    }
  }
  return false;
}

function isCharacterHiddenFromCurrentUser(characterRecord) {
  if (!characterRecord) return false;
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (isStoryteller) return false;
  if (!currentUser) return false;
  if (Number(characterRecord.user_id) === Number(currentUser.id)) return false;
  let hiddenList = characterRecord.hidden_from_user_ids;
  if (typeof hiddenList === 'string') {
    try {
      hiddenList = JSON.parse(hiddenList);
    } catch (e) {
      hiddenList = null;
    }
  }
  if (Array.isArray(hiddenList) && hiddenList.map(Number).includes(Number(currentUser.id))) {
    return true;
  }
  return false;
}

function renderCharacterCastWidget() {
  // Look up the NPC cast list container element in the DOM by ID
  const npcCastListContainerElement = document.getElementById('npcCastListContainer');
  if (!npcCastListContainerElement) return;
  npcCastListContainerElement.innerHTML = '';
  let castCharactersList = (Array.isArray(chronicleCharactersList) ? chronicleCharactersList : []).filter(
    characterRecord => !isCharacterHiddenFromCurrentUser(characterRecord)
  );
  // Removed aggressive filter: players can see all unhidden characters in the Cast Widget
  // Look up the default Storyteller persona entry element in the DOM by ID
  const defaultStorytellerEntryElement = document.getElementById('npcEntry-default');
  if (defaultStorytellerEntryElement) {
    if ((activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') || activeChronicleRole === 'storyteller') {
      defaultStorytellerEntryElement.style.display = 'flex';
      if (!activeNpcPersonaId && !activeControlledCharacterId) {
        defaultStorytellerEntryElement.classList.add('active-persona');
        // Query the active indicator ring element inside the default entry
        const activeIndicatorElement = defaultStorytellerEntryElement.querySelector('.npc-active-indicator');
        if (activeIndicatorElement) activeIndicatorElement.classList.add('ring-active');
      } else {
        defaultStorytellerEntryElement.classList.remove('active-persona');
        // Query the active indicator ring element inside the default entry
        const activeIndicatorElement = defaultStorytellerEntryElement.querySelector('.npc-active-indicator');
        if (activeIndicatorElement) activeIndicatorElement.classList.remove('ring-active');
      }
    } else {
      defaultStorytellerEntryElement.style.display = 'none';
    }
    let filteredCharactersList = castCharactersList;
    if (activeNpcCastCategory !== 'all') {
      filteredCharactersList = filteredCharactersList.filter(characterRecord => characterRecord.category === activeNpcCastCategory);
    }
    // Look up the cast search input element in the DOM by ID
    const castSearchInputElement = document.getElementById('npcCastSearchInput');
    const searchQueryText = castSearchInputElement ? castSearchInputElement.value.toLowerCase().trim() : '';
    if (searchQueryText) {
      filteredCharactersList = filteredCharactersList.filter(characterRecord => {
        const normalizedSearchQuery = searchQueryText.toLowerCase();
        const characterFullNameLower = characterRecord.name ? characterRecord.name.toLowerCase() : '';
        const characterShortNameLower = characterRecord.short_name ? characterRecord.short_name.toLowerCase() : '';
        const characterClanLower = characterRecord.clan ? characterRecord.clan.toLowerCase() : '';
        const characterConceptLower = characterRecord.concept ? characterRecord.concept.toLowerCase() : '';
        const fallbackFirstNameLower = (characterRecord.short_name || (characterRecord.name ? characterRecord.name.split(' ')[0] : '')).toLowerCase();
        return characterFullNameLower.includes(normalizedSearchQuery) || characterShortNameLower.includes(normalizedSearchQuery) || characterClanLower.includes(normalizedSearchQuery) || characterConceptLower.includes(normalizedSearchQuery) || fallbackFirstNameLower.includes(normalizedSearchQuery);
      });
    }
    if (filteredCharactersList.length === 0) {
      npcCastListContainerElement.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;text-align:center;padding:24px 10px;">No characters found matching filter.</div>';
      return;
    }
    filteredCharactersList.sort((firstCharacter, secondCharacter) => {
      if (firstCharacter.category === 'pc' && secondCharacter.category !== 'pc') return -1;
      if (firstCharacter.category !== 'pc' && secondCharacter.category === 'pc') return 1;
      return (firstCharacter.short_name || firstCharacter.name).localeCompare(secondCharacter.short_name || secondCharacter.name);
    });
    filteredCharactersList.forEach(characterRecord => {
      const isActivePersona = activeNpcPersonaId === characterRecord.id || activeControlledCharacterId === characterRecord.id;
      // Create a <div> element in memory for the character cast entry row
      const castEntryElement = document.createElement('div');
      castEntryElement.className = `npc-cast-entry ${isActivePersona ? 'active-persona' : ''}`;
      castEntryElement.id = `npc-entry-${characterRecord.id}`;
      castEntryElement.title = `Click to assume control of ${characterRecord.name}`;
      castEntryElement.onclick = () => {
        if ((activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') || activeChronicleRole === 'storyteller') {
          if (characterRecord.category === 'pc') {
            assumeActiveControl(characterRecord.id);
          } else {
            toggleNpcPersona(characterRecord.id);
          }
        } else {
          assumeActiveControl(characterRecord.id);
        }
      };
      const resolvedAvatarImageUrl = characterRecord.avatar_url && !characterRecord.avatar_url.includes('bg_page_1.png') ? characterRecord.avatar_url : '/images/caine_portrait.jpg?v=2';
      let characterCategoryLabel = characterRecord.category && characterRecord.category !== 'Uncategorized' ? characterRecord.category : 'NPC';
      if (characterRecord.category === 'pc') {
          characterCategoryLabel = characterRecord.player_name ? characterRecord.player_name : 'Unassigned';
      } else if (characterRecord.category === 'important_kindred') { characterCategoryLabel = 'Elder'; }
      else if (characterRecord.category === 'kindred') { characterCategoryLabel = 'Kindred'; }
      else if (characterRecord.category === 'important_human') { characterCategoryLabel = 'VIP Human'; }
      else if (characterRecord.category === 'human') { characterCategoryLabel = 'Human'; }
      castEntryElement.innerHTML = `
            <div class="npc-avatar-wrap">
                <img src="${resolvedAvatarImageUrl}" alt="${escapeHtml(characterRecord.name)}" class="npc-thumb-img">
                <span class="npc-active-indicator ${isActivePersona ? 'ring-active' : ''}"></span>
            </div>
            <div class="npc-meta-block">
                <div class="npc-name">${escapeHtml(characterRecord.short_name || characterRecord.name)}</div>
                <div class="npc-subtext">${escapeHtml(characterRecord.clan || 'Unknown')} &bull; ${characterCategoryLabel}</div>
            </div>
            <div class="npc-right-actions">
                ${(activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') ? (() => {
                    const isHiddenFromPlayers = isCharacterHiddenFromPlayers(characterRecord);
                    const visibilityIconClass = isHiddenFromPlayers ? 'fa-eye-slash' : 'fa-eye';
                    const visibilityIconColor = isHiddenFromPlayers ? '#ef4444' : '#9ca3af';
                    return `<button type="button" class="btn-npc-peek" onclick="quickToggleVisibility(event, ${characterRecord.id}, ${isHiddenFromPlayers})" title="Toggle Visibility" style="color:${visibilityIconColor};"><i class="fa-solid ${visibilityIconClass}"></i></button>`;
                })() : ''}
                <button type="button" class="btn-npc-peek" onclick="event.stopPropagation(); openFloatingDossierWidget(${characterRecord.id});" title="Open Floating Sheet"><i class="fa-solid fa-file-lines"></i></button>
            </div>
        `;
      // Append the character cast entry element into the cast list container in the DOM
      npcCastListContainerElement.appendChild(castEntryElement);
    });
  }
}

function filterCharacterCastList(searchQueryText) {
  renderCharacterCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
}

function toggleNpcPersona(npcCharacterId) {
  if (activeNpcPersonaId === npcCharacterId) {
    selectStorytellerDefaultPersona();
  } else {
    selectNpcPersona(npcCharacterId);
  }
}

function selectNpcPersona(npcCharacterId) {
  const npcCharacterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === npcCharacterId);
  if (!npcCharacterRecord) return;
  activeNpcPersonaId = npcCharacterId;
  activeControlledCharacterId = null;
  renderCharacterCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
  restoreWidget('widget-character-dossier');
  updateDossierWidget(npcCharacterRecord);
  // Look up the dice persona select dropdown in the DOM by ID
  const dicePersonaSelectElement = document.getElementById('dicePersonaSelect');
  if (dicePersonaSelectElement) {
    dicePersonaSelectElement.value = String(npcCharacterRecord.id);
  }
  // Look up the dice roller name input in the DOM by ID
  const diceRollerNameInputElement = document.getElementById('diceRollerName');
  if (diceRollerNameInputElement) {
    diceRollerNameInputElement.value = npcCharacterRecord.name;
  }
  // Look up the chat sender label element in the DOM by ID
  const chatSenderLabelElement = document.getElementById('chatSenderLabel');
  if (chatSenderLabelElement) {
    chatSenderLabelElement.innerText = `Speaking as: ${npcCharacterRecord.name}`;
  }
  // Look up the GM persona select dropdown in the DOM by ID
  const gmPersonaSelectElement = document.getElementById('gmPersonaSelect');
  if (gmPersonaSelectElement) {
    gmPersonaSelectElement.value = npcCharacterRecord.name;
  }
  renderCoterieTokens(chronicleCharactersList);
  if (socket && activeChronicleId) {
    // Emit a Socket.IO event to broadcast the Storyteller's active NPC persona to the chronicle room
    socket.emit('presence:set_character', {
      campaignId: activeChronicleId,
      characterId: npcCharacterId,
      isSpectator: false
    });
  }
}

function selectStorytellerDefaultPersona() {
  activeNpcPersonaId = null;
  activeControlledCharacterId = null;
  renderCharacterCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
  // Look up the dice persona select dropdown in the DOM by ID
  const dicePersonaSelectElement = document.getElementById('dicePersonaSelect');
  if (dicePersonaSelectElement) {
    dicePersonaSelectElement.value = 'storyteller_world';
  }
  // Look up the dice roller name input element in the DOM by ID
  const diceRollerNameInputElement = document.getElementById('diceRollerName');
  if (diceRollerNameInputElement) {
    diceRollerNameInputElement.value = 'Storyteller';
  }
  // Look up the chat sender label element in the DOM by ID
  const chatSenderLabelElement = document.getElementById('chatSenderLabel');
  if (chatSenderLabelElement) {
    chatSenderLabelElement.innerText = 'Speaking as: Storyteller';
  }
  // Look up the GM persona select dropdown in the DOM by ID
  const gmPersonaSelectElement = document.getElementById('gmPersonaSelect');
  if (gmPersonaSelectElement) {
    gmPersonaSelectElement.value = 'Storyteller';
  }
  renderCoterieTokens(chronicleCharactersList);
  if (socket && activeChronicleId) {
    // Emit a Socket.IO event to set the Storyteller's presence back to default spectator/narrator mode
    socket.emit('presence:set_character', {
      campaignId: activeChronicleId,
      characterId: null,
      isSpectator: true
    });
  }
}


async function loadCharacters() {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch all characters for the active chronicle
    const fetchResponse = await authFetch(`/api/characters?campaign_id=${activeChronicleId}&_t=${Date.now()}`);
    if (!fetchResponse.ok) return;
    // Parse the JSON response into an array of character records
    const fetchedCharactersList = await fetchResponse.json();
    chronicleCharactersList = fetchedCharactersList;
    const activePersonaCharacter = fetchedCharactersList.find(characterRecord => characterRecord.id === (activeNpcPersonaId || activeControlledCharacterId)) || fetchedCharactersList[0];
    const currentlyViewedCharacter = fetchedCharactersList.find(characterRecord => characterRecord.id === currentLoadedCharacterId);
    if (currentlyViewedCharacter) {
        updateDossierWidget(currentlyViewedCharacter);
    } else if (activePersonaCharacter) {
        updateDossierWidget(activePersonaCharacter);
    }
    
    // Query all character dossier widget elements in the DOM to update any floating secondary dossier widgets
    document.querySelectorAll('.widget-character-dossier').forEach(floatingDossierWidgetElement => {
        if (floatingDossierWidgetElement.id && floatingDossierWidgetElement.id.startsWith('widget-character-dossier-')) {
            const floatingCharacterIdString = floatingDossierWidgetElement.id.replace('widget-character-dossier-', '');
            const floatingCharacterRecord = fetchedCharactersList.find(characterRecord => characterRecord.id === parseInt(floatingCharacterIdString, 10));
            if (floatingCharacterRecord) updateDossierWidget(floatingCharacterRecord, floatingDossierWidgetElement.id);
        }
    });
    renderCoterieTokens(fetchedCharactersList);
    if (socket && activeChronicleId) {
      // Emit a Socket.IO event to synchronize the user's active character presence with the room
      socket.emit('presence:set_character', {
        campaignId: activeChronicleId,
        characterId: activeNpcPersonaId || activeControlledCharacterId || null,
        isSpectator: !activeNpcPersonaId && !activeControlledCharacterId
      });
    }
    populateDicePersonaSelector();
    renderCharacterCastWidget();
    if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
    renderCharacterVaultCards();

    // Query all <iframe> elements in the DOM to broadcast updated concealed_fields for real-time privacy sync
    document.querySelectorAll('iframe').forEach(iframeElement => {
        if (iframeElement.src.includes('V5-Character-Sheet')) {
            try {
                // Parse the query string parameters from the iframe's src URL using the URLSearchParams Web API
                const iframeUrlSearchParams = new URLSearchParams(iframeElement.src.split('?')[1]);
                const iframeCharacterId = parseInt(iframeUrlSearchParams.get('char_id'), 10);
                const characterRecord = chronicleCharactersList.find(candidateCharacter => Number(candidateCharacter.id) === iframeCharacterId);
                if (characterRecord) {
                    let concealedFieldsList = [];
                    try { concealedFieldsList = typeof characterRecord.concealed_fields === 'string' ? JSON.parse(characterRecord.concealed_fields) : (characterRecord.concealed_fields || []); } catch(jsonParseError){}
                    if (!Array.isArray(concealedFieldsList)) concealedFieldsList = [];
                    // Send a cross-document message to the embedded character sheet iframe window to apply field redaction
                    iframeElement.contentWindow.postMessage({ type: 'APPLY_REDACTION', concealedFields: concealedFieldsList }, '*');
                    // Send cross-document messages to synchronize updated XP and sheet data live
                    iframeElement.contentWindow.postMessage({ type: 'vtm:remote_character_updated', charId: iframeCharacterId }, '*');
                    const parsedSheetData = typeof characterRecord.sheet_data === 'string'
                        ? JSON.parse(characterRecord.sheet_data || '{}')
                        : (characterRecord.sheet_data || {});
                    iframeElement.contentWindow.postMessage({ type: 'vtm:sync_sheet', sheet_data: parsedSheetData }, '*');
                }
            } catch(iframeSyncError) {}
        }
    });
    // Refresh the Chronicle XP Manager table if the modal is currently open
    const xpModalElement = document.getElementById('chronicleXpManagerModal');
    if (xpModalElement && xpModalElement.classList.contains('active') && typeof renderChronicleXpRosterTable === 'function') {
      renderChronicleXpRosterTable();
    }
  } catch (errorObject) {
    // Log any error encountered while loading characters to the developer console
    console.error(errorObject);
  }
}

function dragCharacterStart(dragEventObject, characterId) {
  if ((activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller')) return;
  dragEventObject.dataTransfer.setData("text/plain", characterId);
  dragEventObject.currentTarget.style.opacity = '0.5';
}

function dragEnterSection(dragEventObject) {
  if ((activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller')) return;
  dragEventObject.preventDefault();
  const carouselSectionElement = dragEventObject.currentTarget;
  carouselSectionElement.classList.add('drag-hover-target');
}

function dragLeaveSection(dragEventObject) {
  if ((activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller')) return;
  const carouselSectionElement = dragEventObject.currentTarget;
  if (!carouselSectionElement.contains(dragEventObject.relatedTarget)) {
    carouselSectionElement.classList.remove('drag-hover-target');
  }
}

function allowDropCharacter(dragEventObject) {
  if ((activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller')) return;
  dragEventObject.preventDefault();
}

async function dropCharacter(dropEventObject, targetCategoryName) {
  if ((activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller')) return;
  dropEventObject.preventDefault();
  const droppedCharacterIdString = dropEventObject.dataTransfer.getData("text/plain");
  const droppedCharacterId = parseInt(droppedCharacterIdString);
  if (!droppedCharacterId) return;
  // Query all character card elements in the DOM and restore their full opacity
  const characterCardElements = document.querySelectorAll('.character-card, .vault-card');
  characterCardElements.forEach(cardElement => cardElement.style.opacity = '1');
  // Query all carousel section elements in the DOM and remove the drag hover highlight class
  const carouselSectionElements = document.querySelectorAll('.carousel-section');
  carouselSectionElements.forEach(sectionElement => sectionElement.classList.remove('drag-hover-target'));
  await updateCharacterCategory(droppedCharacterId, targetCategoryName);
}

function renderCharacterVaultCards() {
  // Look up the Storyteller Award XP button in the Character Vault header and toggle its visibility
  const vaultAwardXpButtonElement = document.getElementById('vaultBtnAwardXp');
  if (vaultAwardXpButtonElement) {
    const isStorytellerUser = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
    vaultAwardXpButtonElement.style.display = isStorytellerUser ? 'inline-flex' : 'none';
  }
  // Look up the dynamic character carousels container element in the DOM by ID
  const carouselsContainerElement = document.getElementById('dynamicCharacterCarousels');
  if (!carouselsContainerElement) return;
  let carouselsHtml = '';
  const visibleVaultCharactersList = (Array.isArray(chronicleCharactersList) ? chronicleCharactersList : []).filter(
    characterRecord => !isCharacterHiddenFromCurrentUser(characterRecord)
  );
  const playerCharactersList = visibleVaultCharactersList.filter(characterRecord => String(characterRecord.category).trim().toLowerCase() === 'pc');
  if (playerCharactersList.length > 0) {
    carouselsHtml += `
            <div class="carousel-section" ondragenter="dragEnterSection(event)" ondragleave="dragLeaveSection(event)" ondragover="allowDropCharacter(event)" ondrop="dropCharacter(event, 'pc')">
                <div class="c1-category-header">
        
        <div class="c1-cat-text">
            <div class="c1-cat-title">Player Characters</div>
            <div class="c1-cat-subtitle">Primary Protagonists <i class="fa-solid fa-droplet" style="color:#ef4444;margin-left:4px;"></i></div>
        </div>
    </div>
                <div class="carousel-track" id="carousel-pc">
                    ${playerCharactersList.map(characterRecord => generateCharacterCardHtml(characterRecord)).join('')}
                </div>
            </div>
        `;
  }
  let validCustomCategoryNames = [];
  if (typeof npcCategoriesList !== 'undefined' && Array.isArray(npcCategoriesList)) {
    npcCategoriesList.forEach(npcCategoryRecord => {
      if (!npcCategoryRecord || !npcCategoryRecord.name) return;
      validCustomCategoryNames.push(npcCategoryRecord.name);
      const categoryCharactersList = visibleVaultCharactersList.filter(characterRecord => characterRecord.category === npcCategoryRecord.name);
      const isStorytellerUser = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
      if (categoryCharactersList.length > 0 || isStorytellerUser) {
        carouselsHtml += `
                    <div class="carousel-section" ondragenter="dragEnterSection(event)" ondragleave="dragLeaveSection(event)" ondragover="allowDropCharacter(event)" ondrop="dropCharacter(event, '${escapeHtml(npcCategoryRecord.name).replace(/'/g, "\'")}')">
                        <div class="c1-category-header">
        
        <div class="c1-cat-text">
            <div class="c1-cat-title">${escapeHtml(npcCategoryRecord.name)}</div>
            <div class="c1-cat-subtitle">${escapeHtml(npcCategoryRecord.description || 'Character Vault Roster')} <i class="fa-solid fa-droplet" style="color:#ef4444;margin-left:4px;"></i></div>
        </div>
    </div>
                        <div class="carousel-track" id="carousel-${escapeHtml(npcCategoryRecord.name).replace(/\s+/g, '-')}">
                            ${categoryCharactersList.length > 0 ? categoryCharactersList.map(characterRecord => generateCharacterCardHtml(characterRecord)).join('') : '<div style="color:#4b5563; font-style:italic; font-size:12px; padding:20px; border:1px dashed #374151; border-radius:4px; width:100%; text-align:center;">Drag & Drop characters here</div>'}
                        </div>
                    </div>
                `;
      }
    });
  }
  const knownCategoryNamesLower = ['pc', ...validCustomCategoryNames].map(categoryName => String(categoryName).toLowerCase());
  const uncategorizedCharactersList = visibleVaultCharactersList.filter(characterRecord => !knownCategoryNamesLower.includes(String(characterRecord.category || '').toLowerCase()));
  if (uncategorizedCharactersList.length > 0) {
    carouselsHtml += `
            <div class="carousel-section" ondragenter="dragEnterSection(event)" ondragleave="dragLeaveSection(event)" ondragover="allowDropCharacter(event)" ondrop="dropCharacter(event, 'Uncategorized')">
                <div class="c1-category-header">
        
        <div class="c1-cat-text">
            <div class="c1-cat-title" style="color:#9ca3af;">Uncategorized</div>
            <div class="c1-cat-subtitle">Other NPCs <i class="fa-solid fa-droplet" style="color:#ef4444;margin-left:4px;"></i></div>
        </div>
    </div>
                <div class="carousel-track" id="carousel-other">
                    ${uncategorizedCharactersList.map(characterRecord => generateCharacterCardHtml(characterRecord)).join('')}
                </div>
            </div>
        `;
  }
  carouselsContainerElement.innerHTML = carouselsHtml;
}

function generateCharacterCardHtml(characterRecord) {
  if (!characterRecord) return '';
  const ownerUserId = characterRecord.user_id;
  const authorizedUserIdsList = Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
  const isCharacterOwner = currentUser && characterRecord.user_id === currentUser.id;
  const isAuthorizedPilot = currentUser && authorizedUserIdsList.includes(currentUser.id);
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  let cardClickActionAttribute = `onclick="openCharacterSheet(${characterRecord.id}, '${escapeHtml(characterRecord.name).replace(/'/g, "\'")}', '${escapeHtml(characterRecord.clan).replace(/'/g, "\'")}')"`;
  let resolvedAvatarImageUrl = '/images/caine_portrait.jpg?v=2';
  let restrictedVisibilityBadgeHtml = '';
  if (isCharacterHiddenFromPlayers(characterRecord)) {
      restrictedVisibilityBadgeHtml = '<i class="fa-solid fa-eye-slash" style="color:#ef4444; position:absolute; top:8px; right:8px; font-size:14px; text-shadow:0 0 4px #000;" title="Restricted Visibility"></i>';
  }
  if (characterRecord.vault_url && !characterRecord.vault_url.includes('bg_page_1.png')) {
    resolvedAvatarImageUrl = characterRecord.vault_url;
  } else if (characterRecord.avatar_url && !characterRecord.avatar_url.includes('bg_page_1.png')) {
    resolvedAvatarImageUrl = characterRecord.avatar_url;
  }
  const playerOwnerFirstName = characterRecord.player_name ? escapeHtml(characterRecord.player_name.split(' ')[0]) : 'NPC';
  let generationOrConceptDisplay = 'Unknown';
  if (characterRecord.sheet_data) {
    try {
      // Parse the character's sheet data JSON if stored as a string
      const parsedSheetData = typeof characterRecord.sheet_data === 'string' ? JSON.parse(characterRecord.sheet_data) : characterRecord.sheet_data;
      if (parsedSheetData.generation) {
        generationOrConceptDisplay = parsedSheetData.generation.toString().replace(/generation/i, 'Gen').trim();
        if (!isNaN(generationOrConceptDisplay)) {
          if (generationOrConceptDisplay === '1') generationOrConceptDisplay += 'st Gen'; else if (generationOrConceptDisplay === '2') generationOrConceptDisplay += 'nd Gen'; else if (generationOrConceptDisplay === '3') generationOrConceptDisplay += 'rd Gen'; else generationOrConceptDisplay += 'th Gen';
        }
      } else if (characterRecord.concept) {
        generationOrConceptDisplay = characterRecord.concept.length > 15 ? characterRecord.concept.substring(0, 15) + '...' : characterRecord.concept;
      }
    } catch (jsonParseError) {}
  } else if (characterRecord.concept) {
    generationOrConceptDisplay = characterRecord.concept.length > 15 ? characterRecord.concept.substring(0, 15) + '...' : characterRecord.concept;
  }
  if (generationOrConceptDisplay === 'Unknown' && characterRecord.category === 'npc') generationOrConceptDisplay = 'NPC';
  return `
        <div class="vault-card" ${cardClickActionAttribute} draggable="${isStoryteller ? 'true' : 'false'}" ondragstart="dragCharacterStart(event, ${characterRecord.id})">
            <!-- Glass Background (Clipped) -->
            <div class="vault-glass"></div>
            
            ${(() => {
    if (isStoryteller) {
      const isHiddenFromPlayers = isCharacterHiddenFromPlayers(characterRecord);
      const visibilityIconClass = isHiddenFromPlayers ? 'fa-eye-slash' : 'fa-eye';
      const visibilityIconColor = isHiddenFromPlayers ? '#ef4444' : '#9ca3af';
      return `<div class="vault-delete-btn" onclick="promptDeleteCharacter(event, ${characterRecord.id}, '${escapeHtml(characterRecord.name).replace(/'/g, "\\'")}')" title="Delete Character"><i class="fa-solid fa-trash-can"></i></div>
              <div class="vault-hide-btn ${isHiddenFromPlayers ? 'hidden-state' : 'revealed-state'}" onclick="quickToggleVisibility(event, ${characterRecord.id}, ${isHiddenFromPlayers})" title="Toggle Visibility"><i class="fa-solid ${visibilityIconClass}"></i></div>`;
    } else if (isCharacterOwner) {
      return `<div class="vault-delete-btn" onclick="promptDeleteCharacter(event, ${characterRecord.id}, '${escapeHtml(characterRecord.name).replace(/'/g, "\\'")}')" title="Delete Character"><i class="fa-solid fa-trash-can"></i></div>`;
    }
    return '';
  })()}
            
            <!-- Avatar (Clipped) -->
            <div class="vault-avatar">
                <img src="${resolvedAvatarImageUrl}" alt="${escapeHtml(characterRecord.name)}">
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
    const characterClanName = characterRecord.clan || 'Unknown';
    const matchingClanSymbolRecord = globalClanSymbols.find(clanSymbolRecord => clanSymbolRecord.clan_name.toLowerCase() === characterClanName.toLowerCase());
    if (matchingClanSymbolRecord) {
      return `<div class="vault-clan-symbol"><img src="${escapeHtml(matchingClanSymbolRecord.symbol_url)}"></div>`;
    }
    return '';
  })()}
            <div class="vault-content">
                <div class="vault-name">${escapeHtml(characterRecord.short_name || characterRecord.name.split(' ')[0])}</div>
                <div class="vault-clan">${escapeHtml(characterRecord.clan || 'Unknown')}</div>
                <div class="vault-stats">
                    <div class="vault-stat">
                        <span class="v-label">Player</span>
                        <span class="v-value">${playerOwnerFirstName}</span>
                    </div>
                    
                </div>
            </div>
        </div>
    `;
}

async function openNewCharacterModal() {
  if (!activeChronicleId) return;
  
  try {
    // Perform an authenticated HTTP POST request to create a new blank character record on the server
    const fetchResponse = await authFetch('/api/characters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Serialize the default character properties into a JSON string payload
      body: JSON.stringify({
        chronicle_id: activeChronicleId,
        name: 'Unnamed Kindred',
        clan: 'Caitiff',
        concept: 'Fledgling',
        avatar_url: '/images/caine_portrait.jpg?v=2',
        category: 'pc'
      })
    });
    
    // Parse the JSON response from the server
    const responsePayload = await fetchResponse.json();
    if (fetchResponse.ok && responsePayload.success) {
      loadCharacters();
      openCharacterSheet(responsePayload.id, 'Unnamed Kindred', 'Caitiff', currentUser.id, currentUser.displayName);
    } else {
      // Display a native browser alert if character creation failed
      alert(responsePayload.error || 'Failed to create blank character sheet.');
    }
  } catch (errorObject) {
    // Log the error to the developer console and alert the user
    console.error(errorObject);
    alert('An error occurred while creating the character.');
  }
}

function handleNewCharAvatarFile(fileInputChangeEvent) {
  const selectedAvatarFile = fileInputChangeEvent.target.files[0];
  if (!selectedAvatarFile) return;
  // Instantiate a browser FileReader to read the selected local image file as a base64 Data URL
  const fileReaderInstance = new FileReader();
  fileReaderInstance.onload = fileReaderLoadEvent => {
    newCharAvatarDataUrl = fileReaderLoadEvent.target.result;
  };
  // Start reading the file contents asynchronously as a Data URL string
  fileReaderInstance.readAsDataURL(selectedAvatarFile);
}

async function createCharacterSubmit() {
  // Read the new character form fields from the DOM by their element IDs
  const characterName = document.getElementById('newCharName').value.trim();
  const characterClan = document.getElementById('newCharClan').value;
  const characterConcept = document.getElementById('newCharConcept').value.trim();
  const avatarUrlInputText = document.getElementById('newCharAvatar').value.trim();
  const characterCategory = document.getElementById('newCharCategory').value;
  // Display a native browser alert if no character name was entered
  if (!characterName) return alert('Character name is required.');
  try {
    let resolvedAvatarUrl = avatarUrlInputText;
    if (newCharAvatarDataUrl) {
      // Perform an authenticated HTTP POST request to upload the base64 avatar image to the server
      const uploadFetchResponse = await authFetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Serialize the base64 image data and target filename into a JSON string payload
        body: JSON.stringify({
          data: newCharAvatarDataUrl,
          filename: `${characterName}_avatar.png`
        })
      });
      // Parse the upload JSON response to retrieve the hosted image URL
      const uploadResponsePayload = await uploadFetchResponse.json();
      if (uploadResponsePayload.url) resolvedAvatarUrl = uploadResponsePayload.url;
    }
    // Perform an authenticated HTTP POST request to save the new character record
    const createCharacterResponse = await authFetch('/api/characters', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the new character record fields into a JSON string payload
      body: JSON.stringify({
        chronicle_id: activeChronicleId,
        name: characterName,
        clan: characterClan,
        concept: characterConcept,
        avatar_url: resolvedAvatarUrl || '/images/caine_portrait.jpg?v=2',
        category: characterCategory || 'pc'
      })
    });
    // Parse the character creation JSON response
    const createCharacterPayload = await createCharacterResponse.json();
    if (createCharacterResponse.ok && createCharacterPayload.success) {
      newCharAvatarDataUrl = null;
      
      // Look up and reset the new character form fields in the DOM by ID
      const characterNameInputElement = document.getElementById('newCharName'); if (characterNameInputElement) characterNameInputElement.value = '';
      const characterPlayerInputElement = document.getElementById('newCharPlayer'); if (characterPlayerInputElement) characterPlayerInputElement.value = '';
      const characterConceptInputElement = document.getElementById('newCharConcept'); if (characterConceptInputElement) characterConceptInputElement.value = '';
      const characterClanSelectElement = document.getElementById('newCharClan'); if (characterClanSelectElement) characterClanSelectElement.value = 'Brujah';
      const avatarPreviewContainerElement = document.getElementById('newCharAvatarPreview'); if (avatarPreviewContainerElement) avatarPreviewContainerElement.innerHTML = '<i class="fa-solid fa-user"></i>';
      closeModal('newCharacterModal');

      loadCharacters();
      openCharacterSheet(createCharacterPayload.id, characterName, characterClan, currentUser.id, currentUser.displayName);
    } else {
      // Display a native browser alert if the server returned an error
      alert(createCharacterPayload.error || 'Failed to create character sheet.');
    }
  } catch (errorObject) {
    // Display a native browser alert on network failure
    alert('Network error creating character.');
  }
}

function openCharacterSheet(characterId, characterName, characterClan, ownerUserId, ownerPlayerName) {
  currentLoadedCharacterId = characterId;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
  // Look up the modal character name, clan, and avatar image elements in the DOM by ID
  const resolvedCharTitle = characterName || (characterRecord ? characterRecord.name : 'Character Dossier');
  const resolvedClanTitle = characterClan || (characterRecord ? characterRecord.clan : 'Vampire: The Masquerade V5');
  const modalCharacterNameElement = document.getElementById('modalCharName');
  if (modalCharacterNameElement) modalCharacterNameElement.innerText = resolvedCharTitle;
  const modalCharacterClanElement = document.getElementById('modalCharClan');
  if (modalCharacterClanElement) modalCharacterClanElement.innerText = resolvedClanTitle;
  const sheetWindowHeaderTitleElement = document.getElementById('sheetWindowHeaderTitle');
  if (sheetWindowHeaderTitleElement) {
    sheetWindowHeaderTitleElement.innerText = `${resolvedCharTitle.toUpperCase()} — ${resolvedClanTitle.toUpperCase()}`;
  }
  const modalAvatarImageElement = document.getElementById('modalCharAvatarImg');
  const resolvedAvatarImageUrl = characterRecord && characterRecord.avatar_url && !characterRecord.avatar_url.includes('bg_page_1.png') ? characterRecord.avatar_url : '/images/caine_portrait.jpg?v=2';
  if (modalAvatarImageElement) modalAvatarImageElement.src = resolvedAvatarImageUrl;
  
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  const targetOwnerUserId = ownerUserId || (characterRecord ? characterRecord.user_id : null);
  const isCharacterOwner = Boolean(currentUser && targetOwnerUserId !== null && Number(currentUser.id) === Number(targetOwnerUserId));
  const authorizedUserIdsList = characterRecord && Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
  
  const isAuthorizedPilot = Boolean(currentUser && authorizedUserIdsList.map(Number).includes(Number(currentUser.id)));
  const canPilotCharacter = isStoryteller || isCharacterOwner || isAuthorizedPilot;
  const canEditCharacter = isStoryteller || isCharacterOwner || isAuthorizedPilot;

  // Populate the 7-Point NPC profile fields in the DOM for the Storyteller
  if (characterRecord) {
      const npcWantInputElement = document.getElementById('sheet_npc_npc_current_want');
      if (npcWantInputElement) npcWantInputElement.value = characterRecord.npc_current_want || '';
      const npcMaskInputElement = document.getElementById('sheet_npc_npc_mask_truth');
      if (npcMaskInputElement) npcMaskInputElement.value = characterRecord.npc_mask_truth || '';
      const npcTaboosInputElement = document.getElementById('sheet_npc_npc_taboos');
      if (npcTaboosInputElement) npcTaboosInputElement.value = characterRecord.npc_taboos || '';
      const npcMannerismsInputElement = document.getElementById('sheet_npc_npc_mannerisms');
      if (npcMannerismsInputElement) npcMannerismsInputElement.value = characterRecord.npc_mannerisms || '';
      const npcBiasesInputElement = document.getElementById('sheet_npc_npc_biases');
      if (npcBiasesInputElement) npcBiasesInputElement.value = characterRecord.npc_biases || '';
      const npcHiddenSecretInputElement = document.getElementById('sheet_npc_npc_hidden_secret');
      if (npcHiddenSecretInputElement) npcHiddenSecretInputElement.value = characterRecord.npc_hidden_secret || '';
      const npcActiveMemoriesInputElement = document.getElementById('sheet_npc_npc_active_memories');
      if (npcActiveMemoriesInputElement) npcActiveMemoriesInputElement.value = characterRecord.npc_active_memories || '';
      const npcFactionTimelineInputElement = document.getElementById('sheet_npc_npc_faction_timeline');
      if (npcFactionTimelineInputElement) npcFactionTimelineInputElement.value = characterRecord.npc_faction_timeline || '';
  }

  // Look up the quick visibility button in the dossier header by ID
  const dossierQuickVisibilityButton = document.getElementById('dossierQuickVisibilityBtn');
  if (dossierQuickVisibilityButton) {
      if (isStoryteller) {
          dossierQuickVisibilityButton.style.display = 'inline-block';
          const isHiddenFromPlayers = isCharacterHiddenFromPlayers(characterRecord);
          dossierQuickVisibilityButton.innerHTML = '<i class="fa-solid ' + (isHiddenFromPlayers ? 'fa-eye-slash' : 'fa-eye') + '" style="color:' + (isHiddenFromPlayers ? '#ef4444' : '#9ca3af') + ';"></i>';
      } else {
          dossierQuickVisibilityButton.style.display = 'none';
      }
  }
  // Look up the modal character short name input element in the DOM by ID
  const modalShortNameInputElement = document.getElementById('modalCharShortName');
  if (modalShortNameInputElement) {
    modalShortNameInputElement.value = characterRecord && characterRecord.short_name ? characterRecord.short_name : '';
    if (canEditCharacter) {
      modalShortNameInputElement.disabled = false;
      modalShortNameInputElement.style.opacity = '1';
    } else {
      modalShortNameInputElement.disabled = true;
      modalShortNameInputElement.style.opacity = '0.5';
    }
  }
  
  // Look up the modal character category container and wrapper elements in the DOM by ID
  const modalCategoryWrapperElement = document.getElementById('modalCharCategoryWrapper');
  const modalCategoryContainerElement = document.getElementById('modalCharCategoryContainer');
  if (modalCategoryContainerElement) {
    if (isStoryteller && characterRecord) {
      if (modalCategoryWrapperElement) modalCategoryWrapperElement.style.display = 'block';
      modalCategoryContainerElement.style.display = 'block';
      let categoryOptionElementsHtml = `<option value="pc" ${characterRecord.category === 'pc' ? 'selected' : ''}>Player Character (PC)</option><option value="Uncategorized" ${characterRecord.category === 'Uncategorized' ? 'selected' : ''}>Uncategorized</option>`;
      if (typeof npcCategoriesList !== 'undefined' && Array.isArray(npcCategoriesList)) {
        npcCategoriesList.forEach(npcCategoryRecord => {
          const selectedAttributeString = characterRecord.category === npcCategoryRecord.name ? 'selected' : '';
          categoryOptionElementsHtml += `<option value="${escapeHtml(npcCategoryRecord.name)}" ${selectedAttributeString}>${escapeHtml(npcCategoryRecord.name)}</option>`;
        });
      }
      modalCategoryContainerElement.innerHTML = `<select class="vtm-input" onchange="updateCharacterCategory(${characterRecord.id}, this.value)" style="width:100%; font-size:13px;">
                ${categoryOptionElementsHtml}
            </select>`;
    } else {
      if (modalCategoryWrapperElement) modalCategoryWrapperElement.style.display = 'none';
      modalCategoryContainerElement.style.display = 'none';
      modalCategoryContainerElement.innerHTML = '';
    }
  }

  // Look up the modal ownership status badge container element in the DOM by ID
  const ownershipStatusContainerElement = document.getElementById('modalOwnershipStatus');
  if (ownershipStatusContainerElement) {
      if (isCharacterOwner) {
        ownershipStatusContainerElement.innerHTML = `<span class="badge-edit-unlocked"><i class="fa-solid fa-lock-open"></i> Owner</span>`;
      } else if (isAuthorizedPilot) {
        ownershipStatusContainerElement.innerHTML = `<span class="badge-edit-unlocked" style="background:rgba(59,130,246,0.2);color:#60a5fa;border:1px solid rgba(59,130,246,0.4);"><i class="fa-solid fa-user-shield"></i> Co-Pilot</span>`;
      } else if (isStoryteller) {
        ownershipStatusContainerElement.innerHTML = `<span class="badge-edit-unlocked"><i class="fa-solid fa-crown"></i> Storyteller</span>`;
      } else {
        ownershipStatusContainerElement.innerHTML = `<span class="badge-edit-locked"><i class="fa-solid fa-lock"></i> Read-Only</span>`;
      }
  }

  // Look up the privacy mode toggle button element in the DOM by ID
  const privacyModeToggleButton = document.getElementById('btnPrivacyModeToggle');
  if (privacyModeToggleButton) {
    if (canEditCharacter) {
      privacyModeToggleButton.style.display = 'inline-flex';
      privacyModeToggleButton.classList.remove('active-pilot');
    } else {
      privacyModeToggleButton.style.display = 'none';
    }
  }

  // Look up the delete character button and danger zone card in the DOM by ID
  const deleteCharacterButtonElement = document.getElementById('btnModalDeleteChar');
  const dangerZoneCardElement = document.getElementById('sheetDangerZoneCard');
  if (deleteCharacterButtonElement) {
    deleteCharacterButtonElement.style.display = (isStoryteller || isCharacterOwner) ? 'inline-flex' : 'none';
  }
  if (dangerZoneCardElement) {
    dangerZoneCardElement.style.display = (isStoryteller || isCharacterOwner) ? 'flex' : 'none';
  }

  // Look up the modal assume-control button element in the DOM by ID
  const modalAssumeControlButton = document.getElementById('btnModalAssumeControl');
  if (modalAssumeControlButton) {
    if (canPilotCharacter) {
      modalAssumeControlButton.style.display = 'inline-flex';
      if (activeControlledCharacterId === characterId) {
        modalAssumeControlButton.innerText = 'Active Persona (Currently Piloting)';
        modalAssumeControlButton.classList.add('active-pilot');
      } else {
        modalAssumeControlButton.innerHTML = '<i class="fa-solid fa-gamepad"></i> Assume Active Control';
        modalAssumeControlButton.classList.remove('active-pilot');
      }
    } else {
      modalAssumeControlButton.style.display = 'none';
    }
  }

  // Look up the GM controller reassignment container and Storyteller tools card in the DOM by ID
  const gmReassignControlContainerElement = document.getElementById('gmReassignControl');
  const sheetStToolsCardElement = document.getElementById('sheetStToolsCard');
  if (sheetStToolsCardElement) {
    sheetStToolsCardElement.style.display = isStoryteller ? 'grid' : 'none';
  }
  if (gmReassignControlContainerElement) {
    if (isStoryteller) {
      gmReassignControlContainerElement.style.display = 'flex';
      populateControllerManagementPanel(characterRecord || ({
        id: characterId,
        user_id: ownerUserId,
        authorized_user_ids: []
      }));
    } else {
      gmReassignControlContainerElement.style.display = 'none';
    }
  }

  // Populate the inline Character Visibility & Sheet Redactions card inside the Settings panel
  const privacyInlineCardElement = document.getElementById('sheetPrivacyInlineCard');
  if (privacyInlineCardElement) {
    privacyInlineCardElement.style.display = canEditCharacter ? 'block' : 'none';
  }
  if (typeof renderInlineSettingsPrivacyAndVisibility === 'function') {
    renderInlineSettingsPrivacyAndVisibility(characterId);
  }

  // Look up the embedded character sheet iframe element in the DOM by ID
  const sheetIframeElement = document.getElementById('sheetFrame');
  let sheetTemplateFilename = 'V5-Character-Sheet.html';
  let initialAvailableXp = 0;
  if (characterRecord && characterRecord.sheet_data) {
    let parsedSheetData = characterRecord.sheet_data;
    if (typeof parsedSheetData === 'string') {
      try {
        // Parse the serialized sheet data JSON string
        parsedSheetData = JSON.parse(parsedSheetData);
      } catch (jsonParseError) {}
    }
    if (parsedSheetData && typeof parsedSheetData === 'object') {
      if (parsedSheetData.sheet_template && typeof parsedSheetData.sheet_template === "string" && parsedSheetData.sheet_template.endsWith(".html")) {
        sheetTemplateFilename = parsedSheetData.sheet_template;
      }
      const totalXpNumber = parseInt(parsedSheetData.total_experience ?? parsedSheetData.total ?? '0', 10) || 0;
      const spentXpNumber = parseInt(parsedSheetData.spent_experience ?? parsedSheetData.spent ?? '0', 10) || 0;
      initialAvailableXp = totalXpNumber - spentXpNumber;
    }
  }

  // Reset Storyteller Player Preview mode state when opening a sheet and show the 1-click 'View as Player' toggle in the Left Sidebar footer
  isSheetModalPlayerPreviewActive = false;
  const sidebarExitPreviewButton = document.getElementById('btnSidebarExitPlayerPreview');
  if (sidebarExitPreviewButton) {
    sidebarExitPreviewButton.style.display = isStoryteller ? 'flex' : 'none';
    sidebarExitPreviewButton.innerHTML = '<i class="fa-solid fa-eye"></i> View as Player';
    sidebarExitPreviewButton.style.borderColor = 'rgba(96, 165, 250, 0.45)';
    sidebarExitPreviewButton.style.background = 'rgba(30, 58, 138, 0.25)';
    sidebarExitPreviewButton.style.color = '#93c5fd';
  }

  // Update the Sheet Layout dropdown in the Settings panel
  const modalTemplateSelectElement = document.getElementById('modalSheetTemplateSelect');
  if (modalTemplateSelectElement) {
    modalTemplateSelectElement.value = sheetTemplateFilename;
    modalTemplateSelectElement.disabled = !canEditCharacter;
  }

  // Update the Experience badges in the Left Sidebar
  const sidebarXpBadgeElement = document.getElementById('modalSidebarXpBadge');
  if (sidebarXpBadgeElement) {
    sidebarXpBadgeElement.textContent = `${initialAvailableXp} XP`;
  }
  const modalExperienceButtonElement = document.getElementById('btnModalExperienceToggle');
  const modalExperienceLabelElement = document.getElementById('modalXpBtnLabel');
  if (modalExperienceButtonElement) {
    modalExperienceButtonElement.style.display = canEditCharacter ? 'flex' : 'none';
    if (modalExperienceLabelElement) {
      modalExperienceLabelElement.textContent = `${initialAvailableXp} XP Available`;
    }
  }

  // Configure Left Sidebar tabs for Storyteller vs Player
  const privacyNavTabButton = document.getElementById('sheetNavTabPrivacy');
  if (privacyNavTabButton) {
    privacyNavTabButton.style.display = canEditCharacter ? 'flex' : 'none';
  }
  const npcNavTabButton = document.getElementById('sheetNavTabNpc');
  if (npcNavTabButton) {
    npcNavTabButton.style.display = isStoryteller ? 'flex' : 'none';
  }
  const settingsNavTitleElement = document.getElementById('sheetNavSettingsTitle');
  const settingsNavSubElement = document.getElementById('sheetNavSettingsSub');
  const settingsNavIconElement = document.getElementById('sheetNavSettingsIcon');
  if (settingsNavTitleElement) {
    settingsNavTitleElement.textContent = isStoryteller ? 'Storyteller & Settings' : 'Sheet Settings';
  }
  if (settingsNavSubElement) {
    settingsNavSubElement.textContent = isStoryteller ? 'XP, Rules & Ownership' : 'Layout & Alias';
  }
  if (settingsNavIconElement) {
    settingsNavIconElement.className = isStoryteller
      ? 'fa-solid fa-crown sheet-sidebar-tab-icon'
      : 'fa-solid fa-gear sheet-sidebar-tab-icon';
  }

  // Always default to Tab 1: Pure Character Sheet view when opening a character
  switchSheetModalTab('sheet');

  if (sheetIframeElement) {
    sheetIframeElement.onload = () => {
      try {
        if (sheetIframeElement.contentWindow && sheetIframeElement.contentWindow.document) {
          sheetIframeElement.contentWindow.document.addEventListener(
            'mousedown',
            () => {
              if (typeof bringCharacterSheetWindowToFront === 'function') {
                bringCharacterSheetWindowToFront();
              }
            },
            true
          );
        }
      } catch (e) {}
    };
    sheetIframeElement.src = `/sheets/${sheetTemplateFilename}?char_id=${characterId}&readonly=${!canEditCharacter}&is_gm=${isStoryteller}&_t=${Date.now()}`;
  }
  
  // Look up the character sheet modal element in the DOM by ID and display it
  const characterSheetModalElement = document.getElementById('characterSheetModal');
  if (characterSheetModalElement) {
    if (characterSheetModalElement.parentElement !== document.body) {
      document.body.appendChild(characterSheetModalElement);
    }
    characterSheetModalElement.classList.add('active');
  }
  const sheetWindowElement = document.getElementById('characterSheetWindow');
  if (sheetWindowElement) {
    const rect = sheetWindowElement.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.left < 12) sheetWindowElement.style.left = '16px';
    if (rect.top < 54) sheetWindowElement.style.top = '56px';
    if (rect.width > vw - 24) sheetWindowElement.style.width = `${Math.max(540, vw - 32)}px`;
    if (rect.height > vh - 68) sheetWindowElement.style.height = `${Math.max(400, vh - 72)}px`;
  }
  if (typeof initCharacterSheetWindowDragAndResize === 'function') {
    initCharacterSheetWindowDragAndResize();
  }
  if (typeof bringCharacterSheetWindowToFront === 'function') {
    bringCharacterSheetWindowToFront();
  }
}

function assumeActiveControlFromModal() {
  if (currentLoadedCharacterId) {
    assumeActiveControl(currentLoadedCharacterId);
  }
}

function populateControllerManagementPanel(characterRecord) {
  // Look up the character owner select dropdown element in the DOM by ID
  const ownerSelectElement = document.getElementById('charOwnerSelect');
  if (ownerSelectElement) {
    ownerSelectElement.innerHTML = '<option value="">NPC / Storyteller Owned</option>';
    const activeChronicleMembersList = chronicleMembersList.filter(memberRecord => memberRecord.status === 'active');
    activeChronicleMembersList.forEach(memberRecord => {
      // Create an <option> element in memory for each active chronicle member
      const optionElement = document.createElement('option');
      optionElement.value = memberRecord.id;
      optionElement.innerText = `${memberRecord.display_name} (@${memberRecord.username})`;
      if (memberRecord.id === characterRecord.user_id) optionElement.selected = true;
      // Append the option element into the owner select dropdown
      ownerSelectElement.appendChild(optionElement);
    });
  }
  // Look up the safety-net controller checkboxes container element in the DOM by ID
  const safetyNetCheckboxesContainerElement = document.getElementById('charSafetyNetCheckboxes');
  if (safetyNetCheckboxesContainerElement) {
    safetyNetCheckboxesContainerElement.innerHTML = '';
    const activeChronicleMembersList = chronicleMembersList.filter(memberRecord => memberRecord.status === 'active');
    const authorizedUserIdsList = Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
    if (activeChronicleMembersList.length === 0) {
      safetyNetCheckboxesContainerElement.innerHTML = '<span style="font-size:11px;color:#94a3b8;font-style:italic;">No other players at this table</span>';
    } else {
      activeChronicleMembersList.forEach(memberRecord => {
        // Create a <label> element in memory to wrap the member's safety-net checkbox
        const checkboxLabelElement = document.createElement('label');
        checkboxLabelElement.className = 'safety-net-label';
        const isMemberAuthorized = authorizedUserIdsList.includes(memberRecord.id);
        checkboxLabelElement.innerHTML = `
                    <input type="checkbox" class="safety-net-chk" value="${memberRecord.id}" ${isMemberAuthorized ? 'checked' : ''}>
                    <span>${escapeHtml(memberRecord.display_name)}</span>
                `;
        // Append the checkbox label element into the safety-net container
        safetyNetCheckboxesContainerElement.appendChild(checkboxLabelElement);
      });
    }
  }
}




async function saveCharacterControllersSubmit() {
  if (!currentLoadedCharacterId) return;
  // Read the selected primary owner user ID from the dropdown element in the DOM
  const selectedPrimaryOwnerUserId = document.getElementById('charOwnerSelect').value;
  // Query all checked safety-net checkboxes in the DOM
  const checkedSafetyNetCheckboxElements = document.querySelectorAll('.safety-net-chk:checked');
  const authorizedUserIdsList = Array.from(checkedSafetyNetCheckboxElements).map(checkboxElement => parseInt(checkboxElement.value)).filter(parsedUserId => !isNaN(parsedUserId));
  try {
    // Perform an authenticated HTTP POST request to update the character's primary owner and authorized controllers
    const fetchResponse = await authFetch(`/api/characters/${currentLoadedCharacterId}/manage-controllers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the primary user ID and authorized user IDs array into a JSON payload
      body: JSON.stringify({
        primary_user_id: selectedPrimaryOwnerUserId ? parseInt(selectedPrimaryOwnerUserId) : null,
        authorized_user_ids: authorizedUserIdsList
      })
    });
    // Parse the JSON response from the server
    const responsePayload = await fetchResponse.json();
    if (fetchResponse.ok && responsePayload.success) {
      loadCharacters();
      // Display a native browser alert confirming the controller assignments were updated
      alert('Character assignments & safety net controllers updated successfully!');
    } else {
      alert(responsePayload.error || 'Failed to update controllers.');
    }
  } catch (errorObject) {
    // Display a native browser alert on network failure
    alert('Network error updating controllers.');
  }
}

function triggerDossierAvatarUpload(characterId = currentLoadedCharacterId) {
  openAssetPicker(selectedAssetUrl => {
    performDualCropForCharacter(selectedAssetUrl, characterId);
  });
}

function handleDossierAvatarUpload(fileInputChangeEvent) {
  const selectedAvatarFile = fileInputChangeEvent.target.files[0];
  if (!selectedAvatarFile || !currentLoadedCharacterId) return;
  uploadAvatarForCharacter(currentLoadedCharacterId, selectedAvatarFile);
}

function triggerModalAvatarUpload() {
  openAssetPicker(selectedAssetUrl => {
    performDualCropForCharacter(selectedAssetUrl, currentLoadedCharacterId);
  });
}

function handleModalAvatarUpload(fileInputChangeEvent) {
  const selectedAvatarFile = fileInputChangeEvent.target.files[0];
  if (!selectedAvatarFile || !currentLoadedCharacterId) return;
  uploadAvatarForCharacter(currentLoadedCharacterId, selectedAvatarFile);
}

async function uploadAvatarForCharacter(characterId, avatarFile) {
  if (!avatarFile) return;
  // Instantiate a browser FileReader to read the uploaded avatar image as a base64 Data URL
  const fileReaderInstance = new FileReader();
  fileReaderInstance.onload = async fileReaderLoadEvent => {
    const base64EncodedImageData = fileReaderLoadEvent.target.result;
    try {
      // Perform an authenticated HTTP POST request to upload the new character portrait to the server
      const fetchResponse = await authFetch(`/api/characters/${characterId}/avatar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Serialize the base64 image data and original filename into a JSON string payload
        body: JSON.stringify({
          data: base64EncodedImageData,
          filename: avatarFile.name
        })
      });
      // Parse the JSON response containing the new avatar URL
      const responsePayload = await fetchResponse.json();
      if (fetchResponse.ok && responsePayload.avatar_url) {
        const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
        if (characterRecord) characterRecord.avatar_url = responsePayload.avatar_url;
        // Look up the dossier avatar image element in the DOM by ID and update its source
        const dossierAvatarImageElement = document.getElementById('dossierAvatarImg');
        if (dossierAvatarImageElement && currentLoadedCharacterId === characterId) {
          dossierAvatarImageElement.src = responsePayload.avatar_url;
        }
        // Look up the modal character avatar image element in the DOM by ID and update its source
        const modalAvatarImageElement = document.getElementById('modalCharAvatarImg');
        if (modalAvatarImageElement) modalAvatarImageElement.src = responsePayload.avatar_url;
        loadCharacters();
        // Display a native browser alert confirming the portrait update
        alert('Portrait updated successfully!');
      } else {
        alert(responsePayload.error || 'Failed to upload portrait image.');
      }
    } catch (errorObject) {
      // Display a native browser alert on network failure
      alert('Network error uploading portrait.');
    }
  };
  // Start reading the image file contents as a base64 Data URL
  fileReaderInstance.readAsDataURL(avatarFile);
}

function closeSheetModal() {
  // Look up the character sheet modal element in the DOM by ID and remove the 'active' class to hide it
  document.getElementById('characterSheetModal').classList.remove('active');
}


async function openMyCharacterDossier() {
  if (!activeChronicleId) return alert('Please enter a chronicle first.');
  try {
    // Perform an authenticated HTTP GET request to fetch all characters in the active chronicle
    const fetchResponse = await authFetch(`/api/characters?campaign_id=${activeChronicleId}&_t=${Date.now()}`);
    if (!fetchResponse.ok) return;
    // Parse the JSON response into an array of character records
    const charactersList = await fetchResponse.json();
    const ownedCharacterRecord = charactersList.find(characterRecord => currentUser && characterRecord.user_id === currentUser.id);
    if (ownedCharacterRecord) {
      openCharacterSheet(ownedCharacterRecord.id, ownedCharacterRecord.name, ownedCharacterRecord.clan, ownedCharacterRecord.user_id, ownedCharacterRecord.player_name);
    } else {
      switchTab('character-vault');
    }
  } catch (errorObject) {
    // Log any error opening the user's character dossier to the developer console
    console.error('Failed to open dossier:', errorObject);
  }
}

async function adjustDossierVitals(vitalType, changeDelta, characterId = currentLoadedCharacterId) {
  if (!characterId) return;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
  if (!characterRecord) return;
  try {
    // Perform an authenticated HTTP POST request to adjust the character's vital tracker on the server
    const fetchResponse = await authFetch(`/api/characters/${characterRecord.id}/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the vital type and numeric delta into a JSON string payload
      body: JSON.stringify({
        type: vitalType,
        delta: changeDelta
      })
    });
    // Parse the JSON response from the server
    const responsePayload = await fetchResponse.json();
    if (fetchResponse.ok && responsePayload.success) {
      Object.assign(characterRecord, responsePayload);
      if (responsePayload.sheet_data) characterRecord.sheet_data = responsePayload.sheet_data;
      if (currentLoadedCharacterId === characterRecord.id) {
        updateDossierWidget(characterRecord, 'widget-character-dossier');
      }
      // Check if a floating secondary dossier widget exists in the DOM for this character and update it
      if (document.getElementById('widget-character-dossier-' + characterRecord.id)) {
        updateDossierWidget(characterRecord, 'widget-character-dossier-' + characterRecord.id);
      }
      syncOpenSheetIframe(characterRecord);
    } else {
      console.error('Failed to update vitals:', responsePayload.error);
      alert('Widget Save Failed: ' + responsePayload.error);
    }
  } catch (errorObject) {
    // Log the error to the developer console and alert the user
    console.error('Error updating vitals:', errorObject);
    alert('Network error while updating vitals.');
  }
}

function syncOpenSheetIframe(characterRecord) {
  // Look up the character sheet iframe element in the DOM by ID
  const sheetIframeElement = document.getElementById('sheetFrame');
  if (sheetIframeElement && sheetIframeElement.contentWindow && currentLoadedCharacterId === characterRecord.id) {
    // Send a cross-document message to the embedded character sheet iframe window to synchronize vital and sheet data
    sheetIframeElement.contentWindow.postMessage({
      type: 'vtm:sync_sheet',
      char_id: characterRecord.id,
      char: characterRecord,
      sheet_data: characterRecord.sheet_data
    }, '*');
  }
}

function normalizeDossierCapacityTracker(rawTrackerStatesArray, explicitMaxCapacity, targetMaxBoxes = 10, fallbackCapacity = 5) {
  let recordedDamageStates = [];
  let resolvedCapacity = typeof explicitMaxCapacity === 'number' && explicitMaxCapacity > 0 ? explicitMaxCapacity : null;

  if (Array.isArray(rawTrackerStatesArray) && (rawTrackerStatesArray.length === 10 || rawTrackerStatesArray.length === 15)) {
    const firstFilledBoxIndex = rawTrackerStatesArray.indexOf('filled');
    const hasUnfilledBoxAfterFilled = firstFilledBoxIndex !== -1 && rawTrackerStatesArray.slice(firstFilledBoxIndex).some(boxState => boxState !== 'filled');
    const relevantStatesSlice = (hasUnfilledBoxAfterFilled && rawTrackerStatesArray.length === 15 && firstFilledBoxIndex <= 10)
      ? rawTrackerStatesArray.slice(0, 10)
      : rawTrackerStatesArray;
    const activeCapacityStates = relevantStatesSlice.filter(boxState => boxState !== 'filled');
    if (resolvedCapacity === null) resolvedCapacity = activeCapacityStates.length;
    recordedDamageStates = activeCapacityStates.filter(boxState => boxState === 'aggravated' || boxState === 'superficial' || boxState === 'empty');
  }

  if (resolvedCapacity === null || resolvedCapacity <= 0) resolvedCapacity = fallbackCapacity;
  const maximumTrackerBoxes = Array.isArray(rawTrackerStatesArray) && rawTrackerStatesArray.length === 15 ? 15 : targetMaxBoxes;
  resolvedCapacity = Math.min(Math.max(resolvedCapacity, 1), maximumTrackerBoxes);

  const normalizedTrackerStates = [];
  for (let boxIndex = 0; boxIndex < maximumTrackerBoxes; boxIndex++) {
    if (boxIndex < resolvedCapacity) {
      const damageStateAtBox = recordedDamageStates[boxIndex];
      normalizedTrackerStates.push(damageStateAtBox === 'aggravated' || damageStateAtBox === 'superficial' ? damageStateAtBox : 'empty');
    } else {
      normalizedTrackerStates.push('filled');
    }
  }
  return { states: normalizedTrackerStates, capacity: resolvedCapacity, maxLen: maximumTrackerBoxes };
}

async function adjustDossierCapacity(trackerName, capacityDelta) {
  if (!currentLoadedCharacterId) return;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === currentLoadedCharacterId);
  if (!characterRecord) return;
  const parsedSheetData = typeof characterRecord.sheet_data === 'object' && characterRecord.sheet_data !== null ? characterRecord.sheet_data : {};
  const isAlternateSheetTemplate = parsedSheetData.sheet_template === 'V5-Character-Sheet-ALT.html' && trackerName === 'health';
  const maximumTrackBoxes = (Array.isArray(parsedSheetData[trackerName + '_states']) && parsedSheetData[trackerName + '_states'].length === 15) || isAlternateSheetTemplate ? 15 : 10;
  const fallbackCapacityValue = trackerName === 'health'
    ? Number(parsedSheetData.stamina || 2) + 3
    : Number(parsedSheetData.composure || 2) + Number(parsedSheetData.resolve || 2);
  const normalizedTrackerResult = normalizeDossierCapacityTracker(parsedSheetData[trackerName + '_states'], parsedSheetData[trackerName + '_max'] || characterRecord[trackerName + '_max'], maximumTrackBoxes, fallbackCapacityValue);
  let currentCapacity = normalizedTrackerResult.capacity;
  let updatedCapacity = Math.max(1, Math.min(maximumTrackBoxes, currentCapacity + capacityDelta));
  if (updatedCapacity === currentCapacity) return;
  
  let normalizedStatesArray = normalizedTrackerResult.states;
  
  try {
    // Perform an authenticated HTTP POST request to update the character's maximum tracker capacity on the server
    const fetchResponse = await authFetch(`/api/characters/${characterRecord.id}/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the tracker name, new capacity, and states array into a JSON payload
      body: JSON.stringify({
        tracker: trackerName,
        capacity: updatedCapacity,
        states: normalizedStatesArray
      })
    });
    // Parse the JSON response from the server
    const responsePayload = await fetchResponse.json();
    if (fetchResponse.ok && responsePayload.success) {
      Object.assign(characterRecord, responsePayload);
      if (responsePayload.sheet_data) characterRecord.sheet_data = responsePayload.sheet_data;
      updateDossierWidget(characterRecord);
      syncOpenSheetIframe(characterRecord);
    } else {
      // Display a native browser alert if the server rejected the save
      alert('Widget save rejected by server.');
    }
  } catch (errorObject) {
    // Log the error to the developer console and alert the user
    console.error('Error adjusting capacity:', errorObject);
    alert('Network error while adjusting capacity.');
  }
}

function clickDossierHunger(targetHungerLevel) {
  if (!currentLoadedCharacterId) return;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === currentLoadedCharacterId);
  if (!characterRecord) return;
  let currentHungerLevel = characterRecord.hunger !== undefined ? Number(characterRecord.hunger) : 1;
  let updatedHungerLevel = targetHungerLevel;
  if (currentHungerLevel === targetHungerLevel) {
    updatedHungerLevel = targetHungerLevel - 1;
  }
  setDossierPip('hunger', updatedHungerLevel);
}

async function cycleDossierDamagePip(trackerName, boxIndex, characterId = currentLoadedCharacterId) {
  if (!characterId) return;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
  if (!characterRecord) return;
  
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  const isCharacterOwner = currentUser && currentUser.id === characterRecord.user_id;
  const authorizedUserIdsList = Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
  const isAuthorizedPilot = currentUser && authorizedUserIdsList.includes(currentUser.id);
  if (!isStoryteller && !isCharacterOwner && !isAuthorizedPilot) {
    // Display a native browser alert if the user lacks permission to edit vitals
    alert("You do not have permission to edit this character's vitals.");
    return;
  }
  
  const parsedSheetData = typeof characterRecord.sheet_data === 'object' && characterRecord.sheet_data !== null ? characterRecord.sheet_data : {};
  let trackerStatesArray = Array.isArray(parsedSheetData[trackerName + '_states']) ? [...parsedSheetData[trackerName + '_states']] : null;
  let trackerCapacity = 10;

  if (trackerName === 'health') {
    const isAlternateSheetTemplate = parsedSheetData.sheet_template === 'V5-Character-Sheet-ALT.html';
    const maximumTrackerBoxes = (trackerStatesArray && trackerStatesArray.length === 15) || isAlternateSheetTemplate ? 15 : 10;
    const normalizedTrackerResult = normalizeDossierCapacityTracker(trackerStatesArray, parsedSheetData.health_max || characterRecord.health_max, maximumTrackerBoxes, Number(parsedSheetData.stamina || 2) + 3);
    trackerStatesArray = normalizedTrackerResult.states;
    trackerCapacity = normalizedTrackerResult.capacity;
  } else if (trackerName === 'willpower') {
    const normalizedTrackerResult = normalizeDossierCapacityTracker(trackerStatesArray, parsedSheetData.willpower_max || characterRecord.willpower_max, 10, Number(parsedSheetData.composure || 2) + Number(parsedSheetData.resolve || 2));
    trackerStatesArray = normalizedTrackerResult.states;
    trackerCapacity = normalizedTrackerResult.capacity;
  } else if (trackerName === 'humanity') {
    trackerCapacity = characterRecord.humanity !== undefined ? Number(characterRecord.humanity) : 7;
    if (!trackerStatesArray || trackerStatesArray.length !== 10) {
      const humanityStainsCount = parsedSheetData.stains !== undefined ? Number(parsedSheetData.stains) : 0;
      trackerStatesArray = Array(10).fill('empty').map((_, pipIndex) => {
        if (pipIndex < trackerCapacity) return 'filled';
        if (pipIndex >= 10 - humanityStainsCount) return 'superficial';
        return 'empty';
      });
    }
  }

  const currentBoxState = trackerStatesArray[boxIndex] || 'empty';
  // For Health and Willpower, 'filled' black boxes are capacity caps and should not be cycled as damage unless humanity
  if (trackerName !== 'humanity' && currentBoxState === 'filled') return;

  let defaultUnmarkedBoxState = 'empty';
  if (trackerName === 'humanity') {
    defaultUnmarkedBoxState = boxIndex < trackerCapacity ? 'filled' : 'empty';
  } else {
    defaultUnmarkedBoxState = boxIndex < trackerCapacity ? 'empty' : 'filled';
  }

  if (currentBoxState === 'empty' || currentBoxState === 'filled') {
    trackerStatesArray[boxIndex] = 'superficial';
  } else if (currentBoxState === 'superficial') {
    trackerStatesArray[boxIndex] = trackerName === 'humanity' ? defaultUnmarkedBoxState : 'aggravated';
  } else {
    trackerStatesArray[boxIndex] = defaultUnmarkedBoxState;
  }
  
  try {
    // Perform an authenticated HTTP POST request to persist the updated damage/vital pip states on the server
    const fetchResponse = await authFetch(`/api/characters/${characterRecord.id}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Serialize the tracker name and updated states array into a JSON string payload
      body: JSON.stringify({ tracker: trackerName, states: trackerStatesArray })
    });
    // Parse the JSON response from the server
    const responsePayload = await fetchResponse.json();
    if (fetchResponse.ok && responsePayload.success) {
      Object.assign(characterRecord, responsePayload);
      if (responsePayload.sheet_data) characterRecord.sheet_data = responsePayload.sheet_data;
      if (currentLoadedCharacterId === characterRecord.id) {
        updateDossierWidget(characterRecord, 'widget-character-dossier');
      }
      // Look up any floating secondary dossier widget for this character in the DOM and refresh it
      if (document.getElementById('widget-character-dossier-' + characterRecord.id)) {
        updateDossierWidget(characterRecord, 'widget-character-dossier-' + characterRecord.id);
      }
      if (typeof syncOpenSheetIframe === 'function') syncOpenSheetIframe(characterRecord);
    } else {
      alert('Widget save rejected by server.');
    }
  } catch (errorObject) {
    // Log the error to the developer console and alert the user
    console.error('Error toggling damage pip:', errorObject);
    alert('Network error while toggling damage pip.');
  }
}

async function setDossierPip(trackerName, targetPipValue) {
  if (!currentLoadedCharacterId) return;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === currentLoadedCharacterId);
  if (!characterRecord) return;
  try {
    const vitalUpdatePayload = trackerName === 'hunger' ? {
      hunger: targetPipValue
    } : {
      humanity: targetPipValue
    };
    // Perform an authenticated HTTP POST request to set the hunger or humanity rating on the server
    const fetchResponse = await authFetch(`/api/characters/${characterRecord.id}/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the vital update object into a JSON string payload
      body: JSON.stringify(vitalUpdatePayload)
    });
    // Parse the JSON response from the server
    const responsePayload = await fetchResponse.json();
    if (fetchResponse.ok && responsePayload.success) {
      Object.assign(characterRecord, responsePayload);
      if (responsePayload.sheet_data) characterRecord.sheet_data = responsePayload.sheet_data;
      updateDossierWidget(characterRecord);
      syncOpenSheetIframe(characterRecord);
    } else {
      alert('Widget save rejected by server.');
    }
  } catch (errorObject) {
    // Log the error to the developer console and alert the user
    console.error('Error setting pip:', errorObject);
    alert('Network error while setting pip.');
  }
}

async function toggleDossierHumanityPip(pipIndex) {
  if (!currentLoadedCharacterId) return;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === currentLoadedCharacterId);
  if (!characterRecord) return;
  const currentHumanityRating = characterRecord.humanity !== undefined ? Number(characterRecord.humanity) : 7;
  if (pipIndex < currentHumanityRating) {
    return;
  }
  adjustDossierVitals('stain', 1);
}

function updateDossierWidget(characterRecord, widgetContainerId = 'widget-character-dossier') {
  try {
    if (!characterRecord) return;
    if (widgetContainerId === 'widget-character-dossier') {
      currentLoadedCharacterId = characterRecord.id;
    }
    const elementIdSuffix = widgetContainerId === 'widget-character-dossier' ? '' : `-${characterRecord.id}`;
    // Helper function that looks up a dossier element in the DOM by its base ID plus any floating-widget suffix
    const getDossierElementById = (baseElementId) => document.getElementById(baseElementId + elementIdSuffix);

    const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
    const isCharacterOwner = currentUser && currentUser.id === characterRecord.user_id;
    const authorizedUserIdsList = Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
    const isAuthorizedPilot = currentUser && authorizedUserIdsList.includes(currentUser.id);
    const canEditDossier = isStoryteller || isCharacterOwner || isAuthorizedPilot;
    
    let concealedFieldsList = [];
    if (characterRecord.concealed_fields) {
      try {
        // Parse the concealed fields list from JSON if stored as a string
        concealedFieldsList = typeof characterRecord.concealed_fields === 'string' ? JSON.parse(characterRecord.concealed_fields) : characterRecord.concealed_fields;
        if (!Array.isArray(concealedFieldsList)) concealedFieldsList = [];
      } catch(jsonParseError) {}
    }

    const characterNameElement = getDossierElementById('dossierCharName');
    if (characterNameElement) {
        if (!canEditDossier && (concealedFieldsList.includes('section_profile') || concealedFieldsList.includes('name'))) {
            characterNameElement.innerText = characterRecord.short_name ? characterRecord.short_name : '[REDACTED]';
        } else {
            characterNameElement.innerText = characterRecord.name || 'Unknown Kindred';
        }
    }
    const widgetTitleElement = getDossierElementById('dossierWidgetTitle');
    if (widgetTitleElement) {
        if (!canEditDossier && (concealedFieldsList.includes('section_profile') || concealedFieldsList.includes('name'))) {
            widgetTitleElement.innerText = characterRecord.short_name ? `${characterRecord.short_name.toUpperCase()}'S DOSSIER` : 'DOSSIER [REDACTED]';
        } else {
            widgetTitleElement.innerText = `${characterRecord.name.toUpperCase()}'S DOSSIER`;
        }
    }

    const characterClanElement = getDossierElementById('dossierClan');
    if (characterClanElement) characterClanElement.innerText = (!canEditDossier && (concealedFieldsList.includes('section_profile') || concealedFieldsList.includes('clan'))) ? '[REDACTED]' : (characterRecord.clan || 'Unknown');
    const characterPathOrConceptElement = getDossierElementById('dossierPath');
    if (characterPathOrConceptElement) {
      if (!canEditDossier && (concealedFieldsList.includes('section_profile') || concealedFieldsList.includes('concept'))) {
        characterPathOrConceptElement.innerText = '[REDACTED]';
      } else {
        characterPathOrConceptElement.innerText = characterRecord.concept ? `${characterRecord.concept}` : `Humanity (${characterRecord.humanity || 7})`;
      }
    }
    const avatarImageElement = getDossierElementById('dossierAvatarImg');
    const resolvedAvatarImageUrl = characterRecord.avatar_url && !characterRecord.avatar_url.includes('bg_page_1.png') ? characterRecord.avatar_url : '/images/caine_portrait.jpg?v=2';
    if (avatarImageElement) avatarImageElement.src = resolvedAvatarImageUrl;
    const playerOwnerElement = getDossierElementById('dossierPlayerOwner');
    if (playerOwnerElement) {
      playerOwnerElement.innerText = characterRecord.player_name || (characterRecord.category === 'pc' ? 'Unassigned' : 'NPC / Storyteller');
    }
    
    const categoryWrapperElement = getDossierElementById('dossierCategoryWrap');
    const categorySelectContainerElement = getDossierElementById('dossierCategorySelect');
    if (categoryWrapperElement && categorySelectContainerElement) {
      if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
        categoryWrapperElement.style.display = 'block';
        let categoryOptionsHtml = `<option value="Uncategorized">Uncategorized</option>`;
        (typeof npcCategoriesList !== 'undefined' && npcCategoriesList ? npcCategoriesList : []).forEach(npcCategoryRecord => {
          const selectedAttributeString = characterRecord.category === npcCategoryRecord.name ? 'selected' : '';
          categoryOptionsHtml += `<option value="${escapeHtml(npcCategoryRecord.name)}" ${selectedAttributeString}>${escapeHtml(npcCategoryRecord.name)}</option>`;
        });
        categorySelectContainerElement.innerHTML = `<select onchange="updateCharacterCategory(${characterRecord.id}, this.value)" style="background:transparent; color:#9ca3af; border:1px solid #4b5563; border-radius:3px; padding:2px 4px; font-size:11px; outline:none;">
                ${categoryOptionsHtml}
            </select>`;
      } else {
        categoryWrapperElement.style.display = 'none';
      }
      const assumeControlWrapperElement = getDossierElementById('dossierAssumeControlWrap');
      if (assumeControlWrapperElement) {
        const authorizedPilotIdsList = Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
        const isOwnedOrAuthorizedToCurrentUser = currentUser && (characterRecord.user_id === currentUser.id || authorizedPilotIdsList.includes(currentUser.id));
        const isChronicleStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
        const isCurrentlyControlledCharacter = activeControlledCharacterId === characterRecord.id;
        if ((isOwnedOrAuthorizedToCurrentUser || isChronicleStoryteller) && !isCurrentlyControlledCharacter) {
          assumeControlWrapperElement.style.display = 'block';
        } else {
          assumeControlWrapperElement.style.display = 'none';
        }
      }
        const parsedSheetData = typeof characterRecord.sheet_data === 'object' && characterRecord.sheet_data !== null ? characterRecord.sheet_data : {};
        const hungerLevel = characterRecord.hunger !== undefined ? Number(characterRecord.hunger) : 1;
        const hungerValueElement = getDossierElementById('dossierHungerVal');
        if (hungerValueElement) hungerValueElement.innerText = `${hungerLevel} / 5`;
        const hungerPipsContainerElement = getDossierElementById('dossierHungerPips');
        if (hungerPipsContainerElement) {
          if (!canEditDossier && (concealedFieldsList.includes('section_vitals') || concealedFieldsList.includes('hunger'))) {
            hungerPipsContainerElement.innerHTML = '<span style="color:#ef4444;font-size:12px;font-family:monospace;">[REDACTED]</span>';
          } else {
            hungerPipsContainerElement.innerHTML = Array(5).fill(0).map((_, pipIndex) => {
              const isHungerPipFilled = pipIndex < hungerLevel;
              return `<div class="dossier-pip ${isHungerPipFilled ? 'pip-hunger' : 'pip-empty'}" onclick="clickDossierHunger(${pipIndex + 1})" title="Hunger ${pipIndex + 1} (Click to set 1..${pipIndex + 1})">${isHungerPipFilled ? '' : ''}</div>`;
            }).join('');
          }
        }
        const staminaRating = Number(parsedSheetData.stamina || parsedSheetData.attributes && parsedSheetData.attributes.stamina || 2);
        let fortitudeRating = 0;
        if (parsedSheetData.disciplines && parsedSheetData.disciplines.Fortitude) fortitudeRating = Number(parsedSheetData.disciplines.Fortitude);
        const defaultHealthCapacity = Math.min(10, Math.max(3, staminaRating + 3 + fortitudeRating));
        const normalizedHealthTracker = normalizeDossierCapacityTracker(parsedSheetData.health_states, parsedSheetData.health_max || characterRecord.health_max, 10, defaultHealthCapacity);
        const maxHealthCapacity = normalizedHealthTracker.capacity;
        // Render 10 boxes in the compact Dossier widget (or up to maxHealthCapacity if maxHealthCapacity > 10)
        const displayedHealthBoxCount = Math.max(10, maxHealthCapacity);
        const displayedHealthStates = normalizedHealthTracker.states.slice(0, displayedHealthBoxCount);
        const healthValueElement = getDossierElementById('dossierHealthVal');
        const healthPipsContainerElement = getDossierElementById('dossierHealthPips');
        if (!canEditDossier && (concealedFieldsList.includes('section_vitals') || concealedFieldsList.includes('health_states'))) {
            if (healthValueElement) healthValueElement.innerText = '-';
            if (healthPipsContainerElement) healthPipsContainerElement.innerHTML = '<span style="color:#ef4444;font-size:12px;font-family:monospace;">[REDACTED]</span>';
        } else {
            if (healthValueElement) healthValueElement.innerText = `${maxHealthCapacity}`;
            if (healthPipsContainerElement) {
              healthPipsContainerElement.innerHTML = displayedHealthStates.map((boxDamageState, pipIndex) => {
                if (boxDamageState === 'aggravated') {
                  return `<div class="dossier-pip pip-aggravated" onclick="cycleDossierDamagePip('health', ${pipIndex}, ${characterRecord.id})" title="Aggravated Damage (Click to clear)">X</div>`;
                } else if (boxDamageState === 'superficial') {
                  return `<div class="dossier-pip pip-superficial" onclick="cycleDossierDamagePip('health', ${pipIndex}, ${characterRecord.id})" title="Superficial Damage (Click to upgrade)">/</div>`;
                } else if (boxDamageState === 'filled') {
                  return `<div class="dossier-pip pip-black" title="Beyond Max Health"></div>`;
                } else {
                  return `<div class="dossier-pip pip-empty" onclick="cycleDossierDamagePip('health', ${pipIndex}, ${characterRecord.id})" title="Unharmed (Click to mark damage)"></div>`;
                }
              }).join('');
            }
        }
        const composureRating = Number(parsedSheetData.composure || parsedSheetData.attributes && parsedSheetData.attributes.composure || 2);
        const resolveRating = Number(parsedSheetData.resolve || parsedSheetData.attributes && parsedSheetData.attributes.resolve || 2);
        const defaultWillpowerCapacity = Math.min(10, Math.max(2, composureRating + resolveRating));
        const normalizedWillpowerTracker = normalizeDossierCapacityTracker(parsedSheetData.willpower_states, parsedSheetData.willpower_max || characterRecord.willpower_max, 10, defaultWillpowerCapacity);
        const maxWillpowerCapacity = normalizedWillpowerTracker.capacity;
        const displayedWillpowerStates = normalizedWillpowerTracker.states.slice(0, 10);
        const willpowerValueElement = getDossierElementById('dossierWpVal');
        const willpowerPipsContainerElement = getDossierElementById('dossierWpPips');
        if (!canEditDossier && (concealedFieldsList.includes('section_vitals') || concealedFieldsList.includes('willpower_states'))) {
            if (willpowerValueElement) willpowerValueElement.innerText = '-';
            if (willpowerPipsContainerElement) willpowerPipsContainerElement.innerHTML = '<span style="color:#ef4444;font-size:12px;font-family:monospace;">[REDACTED]</span>';
        } else {
            if (willpowerValueElement) willpowerValueElement.innerText = `${maxWillpowerCapacity}`;
            if (willpowerPipsContainerElement) {
              willpowerPipsContainerElement.innerHTML = displayedWillpowerStates.map((boxDamageState, pipIndex) => {
                if (boxDamageState === 'aggravated') {
                  return `<div class="dossier-pip pip-aggravated" onclick="cycleDossierDamagePip('willpower', ${pipIndex}, ${characterRecord.id})" title="Aggravated Willpower">X</div>`;
                } else if (boxDamageState === 'superficial') {
                  return `<div class="dossier-pip pip-superficial" onclick="cycleDossierDamagePip('willpower', ${pipIndex}, ${characterRecord.id})" title="Superficial Willpower">/</div>`;
                } else if (boxDamageState === 'filled') {
                  return `<div class="dossier-pip pip-black" title="Beyond Max Willpower"></div>`;
                } else {
                  return `<div class="dossier-pip pip-empty" onclick="cycleDossierDamagePip('willpower', ${pipIndex}, ${characterRecord.id})" title="Unspent"></div>`;
                }
              }).join('');
            }
        }
        const humanityRating = characterRecord.humanity !== undefined ? Number(characterRecord.humanity) : 7;
        const humanityStainsCount = parsedSheetData.stains !== undefined ? Number(parsedSheetData.stains) : 0;
        const humanityValueElement = getDossierElementById('dossierHumanityVal');
        const stainsValueElement = getDossierElementById('dossierStainsVal');
        const humanityPipsContainerElement = getDossierElementById('dossierHumanityPips');
        if (!canEditDossier && (concealedFieldsList.includes('section_vitals') || concealedFieldsList.includes('humanity_states'))) {
            if (humanityValueElement) humanityValueElement.innerText = '- / -';
            if (stainsValueElement) stainsValueElement.innerText = '-';
            if (humanityPipsContainerElement) humanityPipsContainerElement.innerHTML = '<span style="color:#ef4444;font-size:12px;font-family:monospace;">[REDACTED]</span>';
        } else {
            if (humanityValueElement) humanityValueElement.innerText = `${humanityRating} / 10`;
            if (stainsValueElement) stainsValueElement.innerText = `${humanityStainsCount}`;
            if (humanityPipsContainerElement) {
              let humanityStatesArray = parsedSheetData.humanity_states && Array.isArray(parsedSheetData.humanity_states) && parsedSheetData.humanity_states.length === 10 ? parsedSheetData.humanity_states : Array(10).fill('empty').map((_, pipIndex) => {
                if (pipIndex < humanityRating) return 'filled';
                if (pipIndex >= 10 - humanityStainsCount) return 'superficial';
                return 'empty';
              });
              humanityPipsContainerElement.innerHTML = humanityStatesArray.map((boxDamageState, pipIndex) => {
                if (boxDamageState === 'aggravated') {
                  return `<div class="dossier-pip pip-aggravated" onclick="cycleDossierDamagePip('humanity', ${pipIndex}, ${characterRecord.id})" title="Aggravated Damage">X</div>`;
                } else if (boxDamageState === 'superficial') {
                  return `<div class="dossier-pip pip-stain" onclick="cycleDossierDamagePip('humanity', ${pipIndex}, ${characterRecord.id})" title="Stain (Click to upgrade)">/</div>`;
                } else if (boxDamageState === 'filled') {
                  return `<div class="dossier-pip pip-humanity" onclick="cycleDossierDamagePip('humanity', ${pipIndex}, ${characterRecord.id})" title="Humanity Rating (Click to override)"></div>`;
                } else {
                  return `<div class="dossier-pip pip-empty" onclick="cycleDossierDamagePip('humanity', ${pipIndex}, ${characterRecord.id})" title="Empty Box"></div>`;
                }
              }).join('');
            }
        }
        const attributesStatsContainerElement = getDossierElementById('dossierStatsContainer');
        if (attributesStatsContainerElement) {
          const getAttributeDisplayValue = (attributeKey, fallbackRating = 1) => {
            if (!canEditDossier && (concealedFieldsList.includes('section_attributes') || concealedFieldsList.includes(attributeKey))) return '<span style="color:#ef4444;font-size:10px;">[RED]</span>';
            let attributeValue = fallbackRating;
            if (parsedSheetData[attributeKey] !== undefined && parsedSheetData[attributeKey] !== null && parsedSheetData[attributeKey] !== '') attributeValue = Number(parsedSheetData[attributeKey]);
            else if (parsedSheetData.attributes && parsedSheetData.attributes[attributeKey] !== undefined && parsedSheetData.attributes[attributeKey] !== null) attributeValue = Number(parsedSheetData.attributes[attributeKey]);
            return attributeValue;
          };
          const strengthDisplay = getAttributeDisplayValue('strength', 1);
          const dexterityDisplay = getAttributeDisplayValue('dexterity', 1);
          const staminaDisplay = getAttributeDisplayValue('stamina', 1);
          const charismaDisplay = getAttributeDisplayValue('charisma', 1);
          const manipulationDisplay = getAttributeDisplayValue('manipulation', 1);
          const composureDisplay = getAttributeDisplayValue('composure', 1);
          const intelligenceDisplay = getAttributeDisplayValue('intelligence', 1);
          const witsDisplay = getAttributeDisplayValue('wits', 1);
          const resolveDisplay = getAttributeDisplayValue('resolve', 1);
          attributesStatsContainerElement.innerHTML = `
            <div class="dossier-attrs-grid">
                <div class="attr-col">
                    <span class="attr-col-hdr">Physical</span>
                    <div class="attr-micro-row"><span>Strength</span><strong>${strengthDisplay}</strong></div>
                    <div class="attr-micro-row"><span>Dexterity</span><strong>${dexterityDisplay}</strong></div>
                    <div class="attr-micro-row"><span>Stamina</span><strong>${staminaDisplay}</strong></div>
                </div>
                <div class="attr-col">
                    <span class="attr-col-hdr">Social</span>
                    <div class="attr-micro-row"><span>Charisma</span><strong>${charismaDisplay}</strong></div>
                    <div class="attr-micro-row"><span>Manipulation</span><strong>${manipulationDisplay}</strong></div>
                    <div class="attr-micro-row"><span>Composure</span><strong>${composureDisplay}</strong></div>
                </div>
                <div class="attr-col">
                    <span class="attr-col-hdr">Mental</span>
                    <div class="attr-micro-row"><span>Intelligence</span><strong>${intelligenceDisplay}</strong></div>
                    <div class="attr-micro-row"><span>Wits</span><strong>${witsDisplay}</strong></div>
                    <div class="attr-micro-row"><span>Resolve</span><strong>${resolveDisplay}</strong></div>
                </div>
            </div>
        `;
        }
        const skillsContainerElement = getDossierElementById('dossierSkillsContainer');
        if (skillsContainerElement) {
          let populatedSkillsList = [];
          const validSkillKeys = ['athletics', 'brawl', 'craft', 'drive', 'firearms', 'larceny', 'melee', 'stealth', 'survival', 'animal_ken', 'etiquette', 'insight', 'intimidation', 'leadership', 'performance', 'persuasion', 'streetwise', 'subterfuge', 'academics', 'awareness', 'finance', 'investigation', 'medicine', 'occult', 'politics', 'science', 'technology'];
          for (const skillKey of validSkillKeys) {
            let skillRating = 0;
            if (parsedSheetData[skillKey] !== undefined && parsedSheetData[skillKey] !== null && parsedSheetData[skillKey] !== '') {
              skillRating = Number(parsedSheetData[skillKey]);
            } else if (parsedSheetData.skills && typeof parsedSheetData.skills === 'object' && parsedSheetData.skills[skillKey] !== undefined && parsedSheetData.skills[skillKey] !== null) {
              skillRating = Number(parsedSheetData.skills[skillKey]);
            }
            if (skillRating > 0) {
              populatedSkillsList.push({
                name: formatSkillLabel(skillKey),
                val: skillRating
              });
            }
          }
          populatedSkillsList.sort((firstSkill, secondSkill) => secondSkill.val - firstSkill.val);
          if (!canEditDossier && concealedFieldsList.includes('section_skills')) {
            skillsContainerElement.innerHTML = '<div style="padding:10px; color:#ef4444; font-style:italic; font-size:12px;">[REDACTED]</div>';
          } else {
            if (!canEditDossier) {
                populatedSkillsList = populatedSkillsList.filter(skillEntry => !concealedFieldsList.includes(skillEntry.name.toLowerCase()));
            }
            if (populatedSkillsList.length === 0) {
              skillsContainerElement.innerHTML = '<div style="padding:8px; color:#aaa; font-style:italic; font-size:12px;">No skills recorded</div>';
            } else {
              skillsContainerElement.innerHTML = populatedSkillsList.slice(0, 6).map(skillEntry => `
                <div class="skill-chip">
                    <span>${escapeHtml(skillEntry.name)}</span>
                    <strong>${skillEntry.val}</strong>
                </div>
              `).join('');
            }
          }
        }
        const disciplinesContainerElement = getDossierElementById('dossierDisciplinesContainer');
        if (disciplinesContainerElement) {
          let populatedDisciplinesList = [];
          let foundFlatDisciplineFields = false;
          for (let disciplineIndex = 0; disciplineIndex < 6; disciplineIndex++) {
            const disciplineName = parsedSheetData['discipline_name_' + disciplineIndex];
            const disciplineDots = parsedSheetData['discipline_dots_' + disciplineIndex];
            if (disciplineName && disciplineName.trim() && disciplineDots !== undefined) {
              foundFlatDisciplineFields = true;
              let disciplinePowersList = [];
              for (let powerIndex = 0; powerIndex < 5; powerIndex++) {
                let powerNameValue = parsedSheetData['discipline_power_' + disciplineIndex + '_' + powerIndex];
                if (powerNameValue && typeof powerNameValue === 'string' && powerNameValue.trim()) disciplinePowersList.push(powerNameValue.trim());
              }
              populatedDisciplinesList.push({
                name: disciplineName.trim(),
                level: Number(disciplineDots),
                powers: disciplinePowersList
              });
            }
          }
          if (!foundFlatDisciplineFields && parsedSheetData.disciplines_full && Array.isArray(parsedSheetData.disciplines_full)) {
            populatedDisciplinesList = parsedSheetData.disciplines_full.filter(disciplineEntry => disciplineEntry && disciplineEntry.name && Number(disciplineEntry.level) > 0);
          } else if (!foundFlatDisciplineFields && parsedSheetData.disciplines && typeof parsedSheetData.disciplines === 'object') {
            for (const [disciplineName, disciplineLevel] of Object.entries(parsedSheetData.disciplines)) {
              if (Number(disciplineLevel) > 0) populatedDisciplinesList.push({
                name: disciplineName,
                level: Number(disciplineLevel),
                powers: []
              });
            }
          }
          if (!canEditDossier && concealedFieldsList.includes('section_disciplines')) {
            disciplinesContainerElement.innerHTML = '<div style="padding:10px; color:#ef4444; font-style:italic; font-size:12px;">[REDACTED]</div>';
          } else if (populatedDisciplinesList.length === 0) {
            disciplinesContainerElement.innerHTML = '<div class="disc-no-powers" style="padding:10px; color:#aaa; font-style:italic;">No disciplines recorded</div>';
          } else {
            if (!canEditDossier) {
                // If specific disciplines are redacted
                populatedDisciplinesList = populatedDisciplinesList.filter(disciplineEntry => !concealedFieldsList.includes(disciplineEntry.name.toLowerCase()));
            }
            disciplinesContainerElement.innerHTML = populatedDisciplinesList.map(disciplineEntry => {
              const clampedDisciplineLevel = Math.min(5, Math.max(1, Number(disciplineEntry.level || 1)));
              const filledDotsHtml = ('&#x25CF;').repeat(clampedDisciplineLevel);
              const disciplinePowersList = disciplineEntry.powers && Array.isArray(disciplineEntry.powers) ? disciplineEntry.powers.filter(powerName => powerName && typeof powerName === 'string' && powerName.trim()) : [];
              const powersListHtml = disciplinePowersList.length > 0 ? `<div class="disc-powers-list">${disciplinePowersList.map(powerName => `<div class="disc-power-item"><i class="fa-solid fa-angle-right"></i> <span>${escapeHtml(powerName)}</span></div>`).join('')}</div>` : '<div class="disc-no-powers">No powers cataloged</div>';
              return `
                    <div class="discipline-entry-card">
                        <div class="discipline-chip">
                            <span class="disc-name">${escapeHtml(disciplineEntry.name)}</span>
                            <span class="disc-dots">${filledDotsHtml}</span>
                        </div>
                        ${powersListHtml}
                    </div>
                `;
            }).join('');
          }
        }
      }
  } catch (errorObject) {
    // Log any critical dossier widget rendering error to the developer console
    console.error('CRITICAL WIDGET ERROR:', errorObject);
  }
}

function formatSkillLabel(rawSkillIdentifier) {
  if (!rawSkillIdentifier) return '';
  return rawSkillIdentifier.replace(/_/g, ' ').replace(/\b\w/g, initialLetter => initialLetter.toUpperCase());
}

function assumeActiveControlFromCurrentDossier() {
  if (currentLoadedCharacterId) {
    assumeActiveControl(currentLoadedCharacterId);
  }
}

async function loadCharacterDossierWidget(characterId) {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch all characters for the active chronicle
    const fetchResponse = await authFetch(`/api/characters?campaign_id=${activeChronicleId}&_t=${Date.now()}`);
    if (!fetchResponse.ok) return;
    // Parse the JSON response into an array of character records
    const charactersList = await fetchResponse.json();
    const targetCharacterRecord = charactersList.find(candidateCharacter => candidateCharacter.id === characterId);
    if (targetCharacterRecord) updateDossierWidget(targetCharacterRecord);
  } catch (errorObject) {
    // Log any error loading the character dossier to the developer console
    console.error('Failed to load character dossier:', errorObject);
  }
}

function openCurrentFullSheet() {
  if (currentLoadedCharacterId) {
    openFloatingCharacterSheet(currentLoadedCharacterId);
  } else {
    switchTab('character-vault');
  }
}


function deleteCharacterDirectly(characterId) {
  // Display a native browser confirmation dialog before permanently deleting the character
  if (!confirm('Are you absolutely sure you want to delete this character? This cannot be undone.')) return;
  // Perform an authenticated HTTP DELETE request to delete the character on the server
  authFetch('/api/characters/' + characterId, {
    method: 'DELETE'
  }).then(fetchResponse => fetchResponse.json()).then(responsePayload => {
    if (responsePayload.success) {
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
      loadCharacters();
    } else {
      // Display a native browser alert if deletion failed
      alert('Failed to delete character: ' + responsePayload.error);
    }
  }).catch(errorObject => console.error(errorObject));
}

window.deleteCharacterSubmit = async function () {
  if (!currentLoadedCharacterId) return;
  const targetCharId = currentLoadedCharacterId;
  const charRecord = (chronicleCharactersList || []).find(c => Number(c.id) === Number(targetCharId));
  const charName = charRecord ? charRecord.name : 'this character';
  const isConfirmed = typeof vtmConfirm === 'function'
    ? await vtmConfirm(`Are you absolutely sure you want to delete "${charName}"? This action cannot be undone and will permanently erase this character from the chronicle.`, 'DESTRUCTIVE ACTION')
    : confirm(`Are you absolutely sure you want to delete "${charName}"? This cannot be undone.`);
  if (!isConfirmed) return;
  try {
    const fetchResponse = await authFetch('/api/characters/' + targetCharId, { method: 'DELETE' });
    const responsePayload = await fetchResponse.json();
    if (responsePayload.success) {
      if (Number(activeControlledCharacterId) === Number(targetCharId)) activeControlledCharacterId = null;
      if (Number(activeNpcPersonaId) === Number(targetCharId)) activeNpcPersonaId = null;
      currentLoadedCharacterId = null;
      if (typeof closeSheetModal === 'function') closeSheetModal();
      const floatingSheet = document.getElementById(`floating-sheet-${targetCharId}`);
      if (floatingSheet) floatingSheet.remove();
      const floatingDossier = document.getElementById(`widget-character-dossier-${targetCharId}`);
      if (floatingDossier) floatingDossier.remove();
      if (typeof vtmAlert === 'function') {
        vtmAlert(`${charName} has been successfully deleted.`, 'Character Deleted');
      }
      loadCharacters();
    } else {
      if (typeof vtmAlert === 'function') {
        vtmAlert('Failed to delete character: ' + (responsePayload.error || 'Unknown error'), 'Error');
      } else {
        alert('Failed to delete character: ' + (responsePayload.error || 'Unknown error'));
      }
    }
  } catch (errorObject) {
    console.error(errorObject);
  }
};


async function loadNpcCategories() {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch custom NPC categories for the active chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/npc-categories`);
    if (fetchResponse.ok) {
      // Parse the JSON response into the global NPC categories list
      npcCategoriesList = await fetchResponse.json();
      renderNpcCategoryChips();
      populateCharacterCategoryDropdowns();
      renderCharacterCastWidget();
      if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
    }
  } catch (errorObject) {
    // Log any error loading NPC categories to the developer console
    console.error('Failed to load NPC categories', errorObject);
  }
}

function renderNpcCategoryChips() {
  // Look up the dynamic NPC category chips container element in the DOM by ID
  const categoryChipsContainerElement = document.getElementById('dynamicNpcCategoryChips');
  if (!categoryChipsContainerElement) return;
  let categoryChipsHtml = `<button class="npc-chip ${activeNpcCastCategory === 'all' ? 'active' : ''}" id="npcChip-all" onclick="filterCharacterCastCategory('all')">ALL</button>`;
  categoryChipsHtml += `<button class="npc-chip ${activeNpcCastCategory === 'pc' ? 'active' : ''}" id="npcChip-pc" onclick="filterCharacterCastCategory('pc')">PLAYERS</button>`;
  npcCategoriesList.forEach(npcCategoryRecord => {
    const isCurrentActiveCategory = activeNpcCastCategory === npcCategoryRecord.name;
    categoryChipsHtml += `<button class="npc-chip ${isCurrentActiveCategory ? 'active' : ''}" id="npcChip-${npcCategoryRecord.id}" onclick="filterCharacterCastCategory('${escapeHtml(npcCategoryRecord.name)}')">${escapeHtml(npcCategoryRecord.name)}</button>`;
  });
  if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
    categoryChipsHtml += `<button class="npc-chip" onclick="openNpcCategoryManager()" title="Manage Categories" style="background:rgba(255,255,255,0.1);"><i class="fa-solid fa-gear"></i></button>`;
  }
  categoryChipsContainerElement.innerHTML = categoryChipsHtml;
}

function filterCharacterCastCategory(selectedCategoryName) {
  activeNpcCastCategory = selectedCategoryName;
  renderNpcCategoryChips();
  renderCharacterCastWidget();
  if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
}

function populateCharacterCategoryDropdowns() {
  ['newCharCategory', 'editCharCategory'].forEach(dropdownElementId => {
    // Look up the category select dropdown element in the DOM by ID
    const categorySelectElement = document.getElementById(dropdownElementId);
    if (!categorySelectElement) return;
    const previousSelectedValue = categorySelectElement.value;
    let optionsHtml = `<option value="pc">Player Character (PC)</option>`;
    npcCategoriesList.forEach(npcCategoryRecord => {
      optionsHtml += `<option value="${escapeHtml(npcCategoryRecord.name)}">${escapeHtml(npcCategoryRecord.name)}</option>`;
    });
    optionsHtml += `<option value="Uncategorized">Uncategorized</option>`;
    categorySelectElement.innerHTML = optionsHtml;
    // Query the select element to check if an option matching the previous value still exists
    if (previousSelectedValue && categorySelectElement.querySelector(`option[value="${previousSelectedValue}"]`)) {
      categorySelectElement.value = previousSelectedValue;
    } else if (dropdownElementId === 'newCharCategory') {
      categorySelectElement.value = 'pc';
    }
  });
}

function openNpcCategoryManager() {
  // Look up the NPC category manager modal element in the DOM by ID
  const categoryManagerModalElement = document.getElementById('npcCategoryManagerModal');
  if (categoryManagerModalElement) {
    // Clear the new NPC category name input field in the DOM
    document.getElementById('newNpcCategoryInput').value = '';
    renderNpcCategoryManagerList();
    categoryManagerModalElement.classList.add('active');
  }
}

function closeNpcCategoryManager() {
  // Look up the NPC category manager modal element in the DOM by ID and hide it
  const categoryManagerModalElement = document.getElementById('npcCategoryManagerModal');
  if (categoryManagerModalElement) categoryManagerModalElement.classList.remove('active');
}

function renderNpcCategoryManagerList() {
  // Look up the NPC category manager list container in the DOM by ID
  const categoryManagerListElement = document.getElementById('npcCategoryManagerList');
  if (!categoryManagerListElement) return;
  if (npcCategoriesList.length === 0) {
    categoryManagerListElement.innerHTML = '<div style="color:#6b7280; font-size:12px; font-style:italic;">No custom categories created yet.</div>';
    return;
  }
  categoryManagerListElement.innerHTML = npcCategoriesList.map(npcCategoryRecord => {
    if (window.editingNpcCategoryId === npcCategoryRecord.id) {
      return `
<div class="category-list-item" style="flex-direction: column; gap: 8px;">
    <div style="display:flex; flex-direction:column; gap:4px; width:100%;">
        <input type="text" id="editCatName_${npcCategoryRecord.id}" class="form-control vtm-input" value="${escapeHtml(npcCategoryRecord.name)}" style="width:100%; font-weight:bold; font-size:14px;">
        <input type="text" id="editCatDesc_${npcCategoryRecord.id}" class="form-control vtm-input" value="${escapeHtml(npcCategoryRecord.description || '')}" style="width:100%; font-size:11px;" placeholder="Description...">
    </div>
    <div style="display:flex; gap:6px; justify-content:flex-end;">
        <button class="btn-action-outline btn-sm" onclick="cancelEditNpcCategory()">Cancel</button>
        <button class="btn-action btn-sm" onclick="saveNpcCategoryInline(${npcCategoryRecord.id})">Save</button>
    </div>
</div>
`;
    } else {
      return `
<div class="category-list-item">
    <div style="display:flex; flex-direction:column; width:100%; cursor:pointer;" onclick="startEditNpcCategory(${npcCategoryRecord.id})">
        <span style="color:#e5e7eb; font-weight:bold; font-size:14px;">${escapeHtml(npcCategoryRecord.name)}</span>
        <span style="color:#9ca3af; font-size:11px;">${escapeHtml(npcCategoryRecord.description || '')}</span>
    </div>
    <div style="display:flex; gap:6px; align-items:flex-start;">
        <button class="cat-btn" onclick="moveNpcCategory(-1, ${npcCategoryRecord.id})" title="Move Up"><i class="fa-solid fa-arrow-up"></i></button>
        <button class="cat-btn" onclick="moveNpcCategory(1, ${npcCategoryRecord.id})" title="Move Down"><i class="fa-solid fa-arrow-down"></i></button>
        <button class="cat-btn" onclick="startEditNpcCategory(${npcCategoryRecord.id})" title="Edit"><i class="fa-solid fa-pencil"></i></button>
        <button class="cat-btn danger" onclick="deleteNpcCategory(${npcCategoryRecord.id}, '${escapeHtml(npcCategoryRecord.name).replace(/'/g, "\\'")}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
    </div>
</div>
`;
    }
  }).join('');
}

function startEditNpcCategory(categoryId) {
  window.editingNpcCategoryId = categoryId;
  renderNpcCategoryManagerList();
}

function cancelEditNpcCategory() {
  window.editingNpcCategoryId = null;
  renderNpcCategoryManagerList();
}

async function saveNpcCategoryInline(categoryId) {
  // Look up the inline category name and description input elements in the DOM by ID
  const categoryNameInputElement = document.getElementById('editCatName_' + categoryId);
  const categoryDescriptionInputElement = document.getElementById('editCatDesc_' + categoryId);
  if (!categoryNameInputElement) return;
  const updatedCategoryName = categoryNameInputElement.value.trim();
  const updatedCategoryDescription = categoryDescriptionInputElement ? categoryDescriptionInputElement.value.trim() : '';
  if (!updatedCategoryName) {
    if (typeof vtmAlert === 'function') vtmAlert("Name cannot be empty");
    return;
  }
  try {
    // Perform an authenticated HTTP PUT request to update the NPC category name and description on the server
    const fetchResponse = await authFetch(`/api/npc-categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the updated category name and description into a JSON payload
      body: JSON.stringify({
        name: updatedCategoryName,
        description: updatedCategoryDescription
      })
    });
    if (fetchResponse.ok) {
      window.editingNpcCategoryId = null;
      await loadNpcCategories();
      renderNpcCategoryManagerList();
    } else {
      if (typeof vtmAlert === 'function') vtmAlert("Failed to update category.");
    }
  } catch (errorObject) {
    // Log any error saving the inline category edit to the developer console
    console.error(errorObject);
  }
}

async function addNpcCategory() {
  // Look up the new NPC category name and description input elements in the DOM by ID
  const newCategoryNameInputElement = document.getElementById('newNpcCategoryInput');
  const newCategoryName = newCategoryNameInputElement ? newCategoryNameInputElement.value.trim() : '';
  const newCategoryDescriptionInputElement = document.getElementById('newNpcCategoryDescInput');
  const newCategoryDescription = newCategoryDescriptionInputElement ? newCategoryDescriptionInputElement.value.trim() : '';
  if (!newCategoryName) return;
  try {
    // Perform an authenticated HTTP POST request to create a new custom NPC category for the active chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/npc-categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the new category name and description into a JSON payload
      body: JSON.stringify({
        name: newCategoryName,
        description: newCategoryDescription
      })
    });
    if (fetchResponse.ok) {
      newCategoryNameInputElement.value = '';
      await loadNpcCategories();
      renderNpcCategoryManagerList();
    } else {
      // Parse the error response JSON payload and alert the user
      const errorPayload = await fetchResponse.json();
      alert('Error: ' + errorPayload.error);
    }
  } catch (errorObject) {
    // Log any error adding the NPC category to the developer console
    console.error(errorObject);
  }
}


async function editNpcCategory(categoryId, currentCategoryName, currentCategoryDescription) {
  const promptedCategoryName = await vtmPrompt("Edit category name:", currentCategoryName);
  if (promptedCategoryName === null) return;
  const promptedCategoryDescription = await vtmPrompt("Edit category description:", currentCategoryDescription || '');
  if (promptedCategoryDescription === null) return;
  if (!promptedCategoryName.trim()) return alert("Name cannot be empty");
  try {
    // Perform an authenticated HTTP PUT request to update the NPC category on the server
    const fetchResponse = await authFetch(`/api/npc-categories/${categoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the updated name and description into a JSON payload
      body: JSON.stringify({
        name: promptedCategoryName.trim(),
        description: promptedCategoryDescription.trim()
      })
    });
    if (fetchResponse.ok) {
      await loadNpcCategories();
    } else {
      alert("Failed to update category.");
    }
  } catch (errorObject) {
    // Log the error to the developer console and alert the user
    console.error(errorObject);
    alert("Error updating category.");
  }
}

async function deleteNpcCategory(categoryId, categoryName) {
  // Display a native browser confirmation dialog before deleting the NPC category
  if (!confirm(`Are you sure you want to delete the "${categoryName}" category? All NPCs inside it will be marked as "Uncategorized".`)) return;
  try {
    // Perform an authenticated HTTP DELETE request to delete the NPC category on the server
    const fetchResponse = await authFetch(`/api/npc-categories/${categoryId}`, {
      method: 'DELETE'
    });
    if (fetchResponse.ok) {
      chronicleCharactersList.forEach(characterRecord => {
        if (characterRecord.category === categoryName) characterRecord.category = 'Uncategorized';
      });
      if (activeNpcCastCategory === categoryName) activeNpcCastCategory = 'all';
      await loadNpcCategories();
      renderNpcCategoryManagerList();
      renderCharacterCastWidget();
      if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
      renderCharacterVaultCards();
    }
  } catch (errorObject) {
    // Log any error deleting the NPC category to the developer console
    console.error(errorObject);
  }
}

async function updateCharacterCategory(characterId, updatedCategoryName) {
  if (!activeChronicleId || (activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller')) return;
  try {
    // Perform an authenticated HTTP PUT request to update the character's vault category on the server
    const fetchResponse = await authFetch(`/api/characters/${characterId}/category`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the updated category name into a JSON string payload
      body: JSON.stringify({
        category: updatedCategoryName
      })
    });
    if (fetchResponse.ok) {
      const targetCharacterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
      if (targetCharacterRecord) targetCharacterRecord.category = updatedCategoryName;
      renderCharacterVaultCards();
      renderCharacterCastWidget();
      if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
    }
  } catch (errorObject) {
    // Log any error updating the character category to the developer console
    console.error(errorObject);
  }
}


async function fetchClanSymbols() {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch custom clan symbol mappings for the active chronicle
    const fetchResponse = await authFetch(`/api/clan-symbols?chronicleId=${activeChronicleId}`);
    if (fetchResponse.ok) {
      // Parse the JSON response into the global clan symbols array
      globalClanSymbols = await fetchResponse.json();
      renderCharacterVaultCards();
    }
  } catch (errorObject) {
    // Log any error fetching clan symbols to the developer console
    console.error(errorObject);
  }
}

function openClanSymbolsModal() {
  // Look up and reset the clan symbol form inputs and modal visibility in the DOM by ID
  document.getElementById('newClanSymbolName').value = '';
  document.getElementById('customClanSymbolNameInput').value = '';
  document.getElementById('newClanSymbolName').style.display = 'block';
  if (document.getElementById('customClanSymbolNameContainer')) document.getElementById('customClanSymbolNameContainer').style.display = 'none';
  document.getElementById('clanSymbolsModal').classList.add('active');
  renderClanSymbolsList();
}

function renderClanSymbolsList() {
  // Look up the clan symbols list container element in the DOM by ID
  const clanSymbolsListElement = document.getElementById('clanSymbolsList');
  clanSymbolsListElement.innerHTML = '';
  if (globalClanSymbols.length === 0) {
    clanSymbolsListElement.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 20px;">No clan symbols mapped yet.</div>';
    return;
  }
  globalClanSymbols.forEach(clanSymbolRecord => {
    // Create a <div> element in memory for each clan symbol item row
    const symbolItemElement = document.createElement('div');
    symbolItemElement.className = 'clan-symbol-item';
    symbolItemElement.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <img src="${escapeHtml(clanSymbolRecord.symbol_url)}" alt="Symbol">
                <div style="color: white; font-family: 'Cinzel', serif;">${escapeHtml(clanSymbolRecord.clan_name)}</div>
            </div>
            <button class="btn-action-outline text-danger" style="padding: 4px 8px; font-size: 12px; border-color: #ef4444; color: #ef4444;" onclick="deleteClanSymbol(${clanSymbolRecord.id})"><i class="fa-solid fa-trash"></i></button>
        `;
    // Append the clan symbol item element into the list container in the DOM
    clanSymbolsListElement.appendChild(symbolItemElement);
  });
}

function assignNewClanSymbol() {
  // Look up the clan name select dropdown and custom clan name text input in the DOM by ID
  const clanNameSelectElement = document.getElementById('newClanSymbolName');
  const customClanNameInputElement = document.getElementById('customClanSymbolNameInput');
  let selectedClanName = clanNameSelectElement.value;
  if (selectedClanName === 'custom') {
    selectedClanName = customClanNameInputElement.value.trim();
  } else {
    selectedClanName = selectedClanName ? selectedClanName.trim() : '';
  }
  if (!selectedClanName) return vtmAlert('Please select a Clan first.', 'Missing Info');
  if (globalClanSymbols.find(clanSymbolRecord => clanSymbolRecord.clan_name.toLowerCase() === selectedClanName.toLowerCase())) {
    return vtmAlert('Symbol for this clan already exists. Delete the old one first or it will be overwritten.', 'Warning');
  }
  // Hide the clan symbols modal while the asset picker and image cropper are open
  document.getElementById('clanSymbolsModal').classList.remove('active');
  openAssetPicker(async selectedAssetUrl => {
    if (!selectedAssetUrl) {
      // Re-open the clan symbols modal in the DOM if no asset was selected
      document.getElementById('clanSymbolsModal').classList.add('active');
      return;
    }
    const croppedSymbolImageUrl = await openImageCropper(selectedAssetUrl, 1, 'Clan Symbol (1:1)', 'Crop the clan symbol. It will be displayed in the small bubble at the bottom of Character Vault cards.', true, 'clan_symbol', selectedClanName);
    // Re-open the clan symbols modal in the DOM after cropping finishes
    document.getElementById('clanSymbolsModal').classList.add('active');
    if (!croppedSymbolImageUrl) return;
    try {
      // Perform an authenticated HTTP POST request to save the new clan symbol mapping on the server
      const fetchResponse = await authFetch('/api/clan-symbols', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // Serialize the chronicle ID, clan name, and cropped symbol URL into a JSON payload
        body: JSON.stringify({
          chronicleId: activeChronicleId,
          clan_name: selectedClanName,
          symbol_url: croppedSymbolImageUrl
        })
      });
      if (fetchResponse.ok) {
        clanNameSelectElement.value = '';
        customClanNameInputElement.value = '';
        // Hide the custom clan name input container in the DOM if present
        if (document.getElementById('customClanSymbolNameContainer')) document.getElementById('customClanSymbolNameContainer').style.display = 'none';
        clanNameSelectElement.style.display = 'block';
        await fetchClanSymbols();
        renderClanSymbolsList();
      }
    } catch (errorObject) {
      // Log any error assigning the new clan symbol to the developer console
      console.error(errorObject);
    }
  });
}

async function deleteClanSymbol(clanSymbolId) {
  if (!await vtmConfirm('Are you sure you want to delete this Clan Symbol mapping?')) return;
  try {
    // Perform an authenticated HTTP DELETE request to remove the clan symbol mapping from the server
    const fetchResponse = await authFetch(`/api/clan-symbols/${clanSymbolId}`, {
      method: 'DELETE'
    });
    if (fetchResponse.ok) {
      globalClanSymbols = globalClanSymbols.filter(clanSymbolRecord => clanSymbolRecord.id !== clanSymbolId);
      renderClanSymbolsList();
      renderCharacterVaultCards();
    }
  } catch (errorObject) {
    // Log any error deleting the clan symbol to the developer console
    console.error(errorObject);
  }
}


async function saveCharacterShortName(updatedShortName) {
  if (!currentLoadedCharacterId) return;
  try {
    // Perform an authenticated HTTP PUT request to save the character's short display name on the server
    const fetchResponse = await authFetch(`/api/characters/${currentLoadedCharacterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // Serialize the updated short name into a JSON string payload
      body: JSON.stringify({ short_name: updatedShortName })
    });
    if (fetchResponse.ok) {
      const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === currentLoadedCharacterId);
      if (characterRecord) characterRecord.short_name = updatedShortName;
      if (typeof renderCharacterVaultCards === 'function') renderCharacterVaultCards();
      if (typeof renderCharacterCastWidget === 'function') renderCharacterCastWidget();
      // Emit a Socket.IO update event so remote clients see the short name change on the board/vault immediately
      if (typeof socket !== 'undefined' && activeChronicleId) {
        socket.emit('character:update', { id: currentLoadedCharacterId });
      }
    }
  } catch(errorObject) {
    // Log any error saving the short name to the developer console
    console.error(errorObject);
  }
}

function openFloatingCharacterSheet(characterId) {
  // Look up the Elysium desktop container element in the DOM by ID
  const elysiumDesktopElement = document.getElementById('elysiumDesktop');
  if (!elysiumDesktopElement) return;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
  if (!characterRecord) return;
  
  const floatingSheetWidgetId = `floating-sheet-${characterId}`;
  // Check if a floating sheet widget for this character already exists in the DOM and bring it to front if so
  if (document.getElementById(floatingSheetWidgetId)) {
    bringDesktopWidgetToFront(document.getElementById(floatingSheetWidgetId));
    return;
  }
  
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  const ownerUserId = characterRecord.user_id;
  const isCharacterOwner = currentUser && currentUser.id === ownerUserId;
  const authorizedUserIdsList = Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
  const isAuthorizedPilot = currentUser && authorizedUserIdsList.includes(currentUser.id);
  const canEditCharacter = isStoryteller || isCharacterOwner || isAuthorizedPilot;
  
  let sheetTemplateFilename = 'V5-Character-Sheet.html';
  if (characterRecord && characterRecord.sheet_data) {
    let parsedSheetData = characterRecord.sheet_data;
    if (typeof parsedSheetData === 'string') {
      try { parsedSheetData = JSON.parse(parsedSheetData); } catch (jsonParseError) {}
    }
    if (parsedSheetData.sheet_template && typeof parsedSheetData.sheet_template === "string" && parsedSheetData.sheet_template.endsWith(".html")) sheetTemplateFilename = parsedSheetData.sheet_template;
  }
  
  // Create a new <div> element in memory for the floating character sheet desktop widget
  const floatingSheetWidgetElement = document.createElement('div');
  floatingSheetWidgetElement.className = 'elysium-widget widget-matrix-popup';
  floatingSheetWidgetElement.id = floatingSheetWidgetId;
  floatingSheetWidgetElement.style.position = 'absolute';
  floatingSheetWidgetElement.style.left = '50px';
  floatingSheetWidgetElement.style.top = '50px';
  floatingSheetWidgetElement.style.width = '880px';
  floatingSheetWidgetElement.style.height = '85vh';
  floatingSheetWidgetElement.style.zIndex = '1000';
  
  console.log("REOPENING SHEET: " + sheetTemplateFilename);
  floatingSheetWidgetElement.innerHTML = `
    <div class="widget-header" style="cursor:move;">
        <div style="display:flex;align-items:center;gap:8px;">
            <i class="fa-solid fa-file-lines" style="color:#ef4444;"></i> 
            <span style="font-weight:bold;color:#f3f4f6;font-family:'Cinzel', serif;">${escapeHtml(characterRecord.short_name || characterRecord.name)}</span>
            <span style="font-size:10px;color:#9ca3af;font-family:'Inter', sans-serif;">(${escapeHtml(characterRecord.clan || 'Unknown')})</span>
        </div>
        <div class="widget-header-controls">
            
            ${canEditCharacter ? `<button class="btn-action-outline btn-sm" onclick="toggleIframePrivacyEditMode(this)" style="border-color:#6b7280; color:#9ca3af; margin-right:8px; padding:2px 6px; font-size:10px;"><i class="fa-solid fa-user-secret"></i> Edit Privacy</button>` : ''}
            <button class="btn-w-ctrl" onclick="this.closest('.elysium-widget').remove()"><i class="fa-solid fa-xmark"></i></button>

        </div>
    </div>
    <div class="widget-body" style="padding:0; overflow:hidden; height: calc(100% - 30px);">
        <iframe src="/sheets/${sheetTemplateFilename}?char_id=${characterId}&readonly=${!canEditCharacter}&is_gm=${isStoryteller}&_t=${Date.now()}" style="width:100%; height:100%; border:none; background:transparent;"></iframe>
    </div>
    <div class="widget-resize-handle"></div>
  `;
  
  // Append the floating sheet widget into the Elysium desktop container in the DOM
  elysiumDesktopElement.appendChild(floatingSheetWidgetElement);
  if (typeof initDesktopWidgetsDragAndResize === 'function') {
    initDesktopWidgetsDragAndResize();
  }
  bringDesktopWidgetToFront(floatingSheetWidgetElement);
}

function loadAndShowDossier(characterId) {
  loadCharacterDossierWidget(characterId);
  // Look up the primary character dossier widget in the DOM by ID and make it visible
  const dossierWidgetElement = document.getElementById('widget-character-dossier');
  if (dossierWidgetElement) {
    dossierWidgetElement.style.display = 'flex';
    bringDesktopWidgetToFront(dossierWidgetElement);
  }
}

function openFloatingDossierWidget(characterId) {
  // Look up the Elysium desktop container element in the DOM by ID
  const elysiumDesktopElement = document.getElementById('elysiumDesktop');
  if (!elysiumDesktopElement) return;
  const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
  if (!characterRecord) return;
  
  const floatingDossierWidgetId = `widget-character-dossier-${characterId}`;
  // Check if a floating dossier widget for this character already exists in the DOM
  if (document.getElementById(floatingDossierWidgetId)) {
    bringDesktopWidgetToFront(document.getElementById(floatingDossierWidgetId));
    return;
  }

  // Look up the primary dossier widget in the DOM to use its inner HTML as a template
  const dossierTemplateWidgetElement = document.getElementById('widget-character-dossier');
  if (!dossierTemplateWidgetElement) return;

  // We want the inner HTML of the dossier widget, but we'll recreate the shell so it's draggable
  let clonedDossierHtmlString = dossierTemplateWidgetElement.innerHTML;
  
  // Replace IDs: id="dossierXXX" -> id="dossierXXX-characterId"
  clonedDossierHtmlString = clonedDossierHtmlString.replace(/id="dossier([A-Za-z0-9_]+)"/g, `id="dossier$1-${characterId}"`);
  
  // Replace adjustDossierVitals calls
  clonedDossierHtmlString = clonedDossierHtmlString.replace(/onclick="triggerDossierAvatarUpload\\(\\)"/g, `onclick="triggerDossierAvatarUpload(${characterId})`); clonedDossierHtmlString = clonedDossierHtmlString.replace(/adjustDossierVitals\('([^']+)',\s*(-?[0-9]+)\)/g, `adjustDossierVitals('$1', $2, ${characterId})`);
  
  // cycleDossierDamagePip calls are generated dynamically in updateDossierWidget!
  // Wait! We don't need to regex them in the HTML, because updateDossierWidget generates them!
  // BUT we must update updateDossierWidget to generate them with characterId!
  
  // Create a new <div> element in memory for the floating dossier widget
  const floatingDossierWidgetElement = document.createElement('div');
  floatingDossierWidgetElement.className = 'elysium-widget widget-character-dossier';
  floatingDossierWidgetElement.id = floatingDossierWidgetId;
  floatingDossierWidgetElement.style.position = 'absolute';
  floatingDossierWidgetElement.style.left = '100px';
  floatingDossierWidgetElement.style.top = '100px';
  floatingDossierWidgetElement.style.width = '340px';
  floatingDossierWidgetElement.style.height = 'auto'; // Allow it to size to content by default
  floatingDossierWidgetElement.style.zIndex = '1000';
  
  floatingDossierWidgetElement.innerHTML = clonedDossierHtmlString;
  
  // Query the widget actions container in the cloned header and replace its buttons with expand and close controls
  const widgetActionsContainerElement = floatingDossierWidgetElement.querySelector('.widget-actions');
  if (widgetActionsContainerElement) {
    widgetActionsContainerElement.innerHTML = `
      <button class="btn-w-ctrl" onclick="openFloatingCharacterSheet(${characterId})" title="Expand Full Sheet"><i class="fa-solid fa-up-right-from-square"></i></button>
      <button class="btn-w-ctrl" onclick="this.closest('.elysium-widget').remove()"><i class="fa-solid fa-xmark" style="font-size: 18px; margin-top:2px;"></i></button>
    `;
  }
  
  // Query the header element inside the floating widget to make it draggable
  const widgetHeaderElement = floatingDossierWidgetElement.querySelector('.widget-header');
  if (widgetHeaderElement) {
    widgetHeaderElement.style.cursor = 'move';
  }
  
  // Query and remove any duplicate resize handles cloned from the template
  floatingDossierWidgetElement.querySelectorAll('.widget-resize-handle').forEach(existingResizeHandleElement => existingResizeHandleElement.remove());
  
  // Create and append a fresh resize handle element
  const newResizeHandleElement = document.createElement('div');
  newResizeHandleElement.className = 'widget-resize-handle';
  floatingDossierWidgetElement.appendChild(newResizeHandleElement);
  
  // Append the floating dossier widget into the Elysium desktop container in the DOM
  elysiumDesktopElement.appendChild(floatingDossierWidgetElement);
  
  if (typeof initDesktopWidgetsDragAndResize === 'function') {
    initDesktopWidgetsDragAndResize();
  }
  bringDesktopWidgetToFront(floatingDossierWidgetElement);
  
  updateDossierWidget(characterRecord, floatingDossierWidgetId);
}



let privacyExpandedSections = {};
let currentPrivacyConcealedFields = [];
let privacyWidgetTargetCharId = null;
let currentHiddenFromFields = null;

const PRIVACY_SECTION_MAP = {
    'section_profile': { label: 'Profile', fields: ['name', 'concept', 'predator', 'chronicle', 'ambition', 'clan', 'sire', 'desire', 'generation', 'title', 'true_age', 'apparent_age', 'date_of_birth', 'date_of_death'] },
    'section_attributes': { label: 'Attributes', fields: ['strength', 'dexterity', 'stamina', 'charisma', 'manipulation', 'composure', 'intelligence', 'wits', 'resolve'] },
    'section_vitals': { label: 'Vitals & Trackers', fields: ['health_states', 'willpower_states', 'humanity_states', 'hunger'] },
    'section_skills': { label: 'Skills', fields: ['athletics', 'brawl', 'craft', 'drive', 'firearms', 'larceny', 'melee', 'stealth', 'survival', 'animal_ken', 'etiquette', 'insight', 'intimidation', 'leadership', 'performance', 'persuasion', 'streetwise', 'subterfuge', 'academics', 'awareness', 'finance', 'investigation', 'medicine', 'occult', 'politics', 'science', 'technology'] },
    'section_disciplines': { label: 'Disciplines', fields: [] },
    'section_advantages': { label: 'Advantages', fields: [] },
    'section_biography': { label: 'Biography', fields: ['chronicle_tenets', 'touchstones_convictions', 'clan_bane', 'notes', 'history', 'appearance', 'distinguishing_features', 'possessions', 'haven_location', 'haven_location_notes', 'haven_description', 'haven_notes'] }
};

// Populate the dynamic arrays
for(let disciplineSlotIndex = 0; disciplineSlotIndex <= 5; disciplineSlotIndex++) {
    PRIVACY_SECTION_MAP.section_disciplines.fields.push('discipline_name_' + disciplineSlotIndex);
    PRIVACY_SECTION_MAP.section_disciplines.fields.push('discipline_dots_' + disciplineSlotIndex);
    for(let powerSlotIndex = 0; powerSlotIndex < 5; powerSlotIndex++) PRIVACY_SECTION_MAP.section_disciplines.fields.push('discipline_power_' + disciplineSlotIndex + '_' + powerSlotIndex);
}
for(let advantageSlotIndex = 1; advantageSlotIndex <= 9; advantageSlotIndex++) {
    PRIVACY_SECTION_MAP.section_advantages.fields.push('adv_flaw_name_' + advantageSlotIndex);
    PRIVACY_SECTION_MAP.section_advantages.fields.push('adv_flaw_rating_' + advantageSlotIndex);
}
for(let meritSlotIndex = 1; meritSlotIndex <= 12; meritSlotIndex++) {
    PRIVACY_SECTION_MAP.section_advantages.fields.push('merit_name_' + meritSlotIndex, 'merit_rating_' + meritSlotIndex);
    if (meritSlotIndex <= 10) PRIVACY_SECTION_MAP.section_advantages.fields.push('background_name_' + meritSlotIndex, 'background_rating_' + meritSlotIndex);
    PRIVACY_SECTION_MAP.section_advantages.fields.push('flaw_name_' + meritSlotIndex, 'flaw_rating_' + meritSlotIndex);
}

function togglePrivacyEditMode() {
    switchSheetModalTab('privacy');
}

function toggleIframePrivacyEditMode(privacyToggleButtonElement) {
    // Find the closest ancestor desktop widget element to locate its embedded sheet iframe
    const parentFloatingSheetWidgetElement = privacyToggleButtonElement
        ? privacyToggleButtonElement.closest('.elysium-widget')
        : null;
    if (parentFloatingSheetWidgetElement) {
        // querySelector finds the embedded character sheet iframe inside the floating sheet window
        const floatingSheetIframe = parentFloatingSheetWidgetElement.querySelector('iframe');
        if (floatingSheetIframe && floatingSheetIframe.contentWindow) {
            const isAlreadyActive = privacyToggleButtonElement.classList.contains('active-pilot');
            if (isAlreadyActive) {
                privacyToggleButtonElement.classList.remove('active-pilot');
                privacyToggleButtonElement.style.borderColor = '#6b7280';
                privacyToggleButtonElement.style.color = '#9ca3af';
            } else {
                privacyToggleButtonElement.classList.add('active-pilot');
                privacyToggleButtonElement.style.borderColor = '#a855f7';
                privacyToggleButtonElement.style.color = '#e9d5ff';
            }
            // Send a cross-document message to toggle the on-sheet Privacy & Redactions bar inside the floating sheet iframe
            floatingSheetIframe.contentWindow.postMessage({
                type: 'vtm:toggle_privacy_drawer'
            }, '*');
            return;
        }
    }
    switchSheetModalTab('privacy');
}

async function fetchCurrentPrivacyFields(characterId) {
    const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
    if (!characterRecord) return [];
    if (typeof characterRecord.concealed_fields === 'string') {
        try { return JSON.parse(characterRecord.concealed_fields); } catch(jsonParseError) { return []; }
    }
    if (Array.isArray(characterRecord.concealed_fields)) return characterRecord.concealed_fields;
    return [];
}

async function fetchCurrentVisibilityFields(characterId) {
    const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
    if (!characterRecord) return null;
    if (typeof characterRecord.hidden_from_user_ids === 'string') {
        try { return JSON.parse(characterRecord.hidden_from_user_ids); } catch(jsonParseError) { return null; }
    }
    if (Array.isArray(characterRecord.hidden_from_user_ids)) return characterRecord.hidden_from_user_ids;
    return [];
}

async function updateVisibilitySettings() {
    if (!privacyWidgetTargetCharId) return;
    try {
        // Send an authenticated HTTP PUT request to update which users this character is hidden from
        const putRes = await authFetch('/api/characters/' + privacyWidgetTargetCharId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            // Serialize the hidden user IDs array into a JSON string payload
            body: JSON.stringify({ hidden_from_user_ids: currentHiddenFromFields })
        });
        if (putRes.ok) {
            try {
                const putJson = await putRes.json();
                if (putJson && putJson.hidden_from_user_ids !== undefined) {
                    currentHiddenFromFields = putJson.hidden_from_user_ids;
                }
            } catch (e) {}
        }
        const characterRecord = chronicleCharactersList.find(candidateCharacter => Number(candidateCharacter.id) === Number(privacyWidgetTargetCharId));
        if (characterRecord) characterRecord.hidden_from_user_ids = currentHiddenFromFields;
        
        // Reload widgets to show badge
        if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
        if (typeof renderCharacterCastWidget === 'function') renderCharacterCastWidget();
        if (Number(currentLoadedCharacterId) === Number(privacyWidgetTargetCharId)) {
            const nowHidden = isCharacterHiddenFromPlayers(characterRecord);
            const dossierQuickVisibilityButton = document.getElementById('dossierQuickVisibilityBtn');
            if (dossierQuickVisibilityButton) {
                const visibilityIconClass = nowHidden ? 'fa-eye-slash' : 'fa-eye';
                const visibilityIconColor = nowHidden ? '#ef4444' : '#9ca3af';
                dossierQuickVisibilityButton.innerHTML = `<i class="fa-solid ${visibilityIconClass}" style="color:${visibilityIconColor};"></i>`;
            }
            const modalQuickVisibilityButton = document.getElementById('btnModalQuickVisibility');
            if (modalQuickVisibilityButton) {
                const visibilityIconClass = nowHidden ? 'fa-eye-slash' : 'fa-eye';
                const visibilityIconColor = nowHidden ? '#ef4444' : '#9ca3af';
                modalQuickVisibilityButton.innerHTML = `<i class="fa-solid ${visibilityIconClass}" style="color:${visibilityIconColor};"></i> Toggle All`;
            }
        }
    } catch(errorObject) {
        // Log any error updating visibility settings to the developer console
        console.error(errorObject);
    }
}

async function toggleVisibilityMember(targetUserId) {
    if (!privacyWidgetTargetCharId && currentLoadedCharacterId) {
        privacyWidgetTargetCharId = currentLoadedCharacterId;
    }
    if (!currentHiddenFromFields) currentHiddenFromFields = [];
    if (currentHiddenFromFields.includes(targetUserId)) {
        currentHiddenFromFields = currentHiddenFromFields.filter(hiddenUserId => hiddenUserId !== targetUserId);
    } else {
        currentHiddenFromFields.push(targetUserId);
    }
    if (currentHiddenFromFields.length === 0) currentHiddenFromFields = null;
    await updateVisibilitySettings();
    populateParentPrivacyWidget();
    if (typeof renderInlineSettingsPrivacyAndVisibility === 'function') {
        renderInlineSettingsPrivacyAndVisibility(privacyWidgetTargetCharId);
    }
}

async function toggleConcealmentItem(fieldOrSectionId) {
    if (!fieldOrSectionId) return;
    if (!privacyWidgetTargetCharId && currentLoadedCharacterId) {
        privacyWidgetTargetCharId = currentLoadedCharacterId;
    }
    if (currentPrivacyConcealedFields.includes(fieldOrSectionId)) {
        currentPrivacyConcealedFields = currentPrivacyConcealedFields.filter(concealedItemId => concealedItemId !== fieldOrSectionId);
    } else {
        currentPrivacyConcealedFields.push(fieldOrSectionId);
    }
    
    // Retrieve the user's authentication token from browser localStorage
    const authenticationToken = localStorage.getItem('vtm_auth_token');
    if (!privacyWidgetTargetCharId) return;
    try {
        // Send an HTTP PUT request using the browser Fetch API to update the character's concealed fields list
        await fetch('/api/characters/' + privacyWidgetTargetCharId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authenticationToken ? 'Bearer ' + authenticationToken : ''
            },
            // Serialize the updated concealed fields array into a JSON string payload
            body: JSON.stringify({ concealed_fields: currentPrivacyConcealedFields })
        });
        
        // Update local list
        const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === privacyWidgetTargetCharId);
        if (characterRecord) characterRecord.concealed_fields = currentPrivacyConcealedFields;
        
        // Query all <iframe> elements in the DOM and push the updated redaction list to matching character sheet iframes
        document.querySelectorAll('iframe').forEach(iframeElement => {
            if (iframeElement.src && iframeElement.src.includes('char_id=' + privacyWidgetTargetCharId) && iframeElement.contentWindow) {
                // Send a cross-document message to the embedded iframe window to apply the updated field redactions
                iframeElement.contentWindow.postMessage({ type: 'APPLY_REDACTION', concealedFields: currentPrivacyConcealedFields }, '*');
            }
        });
        
        // Reload Dossier
        if (typeof updateDossierWidget === 'function') {
            updateDossierWidget(characterRecord);
            // Look up any floating secondary dossier widget for this character in the DOM and update it
            const floatingDossierWidgetElement = document.getElementById('widget-character-dossier-' + privacyWidgetTargetCharId);
            if (floatingDossierWidgetElement) updateDossierWidget(characterRecord, floatingDossierWidgetElement.id);
        }
        
    } catch(errorObject) {
        // Log any error toggling field concealment to the developer console
        console.error(errorObject);
    }
    
    populateParentPrivacyWidget();
    if (typeof renderInlineSettingsPrivacyAndVisibility === 'function') {
        renderInlineSettingsPrivacyAndVisibility(privacyWidgetTargetCharId);
    }
}

async function openMasterPrivacyWidget(characterId) {
    const targetCharacterId = characterId || currentLoadedCharacterId;
    if (!targetCharacterId) return;
    privacyWidgetTargetCharId = targetCharacterId;
    currentPrivacyConcealedFields = await fetchCurrentPrivacyFields(targetCharacterId);
    currentHiddenFromFields = await fetchCurrentVisibilityFields(targetCharacterId);

    // Hide any legacy floating privacy widget if present
    const legacyPrivacyWidget = document.getElementById('parentPrivacyManagerWidget');
    if (legacyPrivacyWidget) {
        legacyPrivacyWidget.style.display = 'none';
    }

    // Look up the character sheet modal to check if this character's sheet is already open
    const characterSheetModalElement = document.getElementById('characterSheetModal');
    const isSheetModalAlreadyOpenForChar =
        characterSheetModalElement &&
        characterSheetModalElement.classList.contains('active') &&
        Number(currentLoadedCharacterId) === Number(targetCharacterId);

    if (!isSheetModalAlreadyOpenForChar) {
        const characterRecord = chronicleCharactersList.find(candidateCharacter => Number(candidateCharacter.id) === Number(targetCharacterId));
        openCharacterSheet(
            targetCharacterId,
            characterRecord ? characterRecord.name : 'Character',
            characterRecord ? characterRecord.clan : ''
        );
        // setTimeout activates On-Sheet Privacy Mode once the character sheet iframe finishes loading
        setTimeout(() => {
            switchSheetModalTab('privacy');
        }, 450);
    } else {
        switchSheetModalTab('privacy');
    }
}

function populateParentPrivacyWidget() {
    // Look up the privacy manager widget body element in the DOM by ID
    const widgetBodyElement = document.getElementById('parentPmWidgetBody');
    if (!widgetBodyElement) return;
    widgetBodyElement.innerHTML = '';
    
    
    // ADVANCED CHARACTER VISIBILITY ACCORDION
    const isVisibilityAccordionExpanded = privacyExpandedSections['advanced_visibility'] || false;
    const isVisibilityRestricted = currentHiddenFromFields !== null;
    
    // Create the header row <div> element for the player visibility accordion section
    const visibilityHeaderRowElement = document.createElement('div');
    visibilityHeaderRowElement.style.display = 'flex';
    visibilityHeaderRowElement.style.justifyContent = 'space-between';
    visibilityHeaderRowElement.style.alignItems = 'center';
    visibilityHeaderRowElement.style.padding = '10px 12px';
    visibilityHeaderRowElement.style.background = isVisibilityAccordionExpanded ? 'rgba(0,0,0,0.3)' : 'transparent';
    visibilityHeaderRowElement.style.borderBottom = '2px solid #ef4444';
    visibilityHeaderRowElement.style.cursor = 'pointer';
    
    // Create the title wrapper <div> element for the visibility accordion header
    const visibilityTitleWrapperElement = document.createElement('div');
    visibilityTitleWrapperElement.style.display = 'flex';
    visibilityTitleWrapperElement.style.alignItems = 'center';
    visibilityTitleWrapperElement.style.gap = '10px';
    visibilityTitleWrapperElement.innerHTML = `<i class="fa-solid ${isVisibilityAccordionExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="color:#ef4444;font-size:12px;width:12px;"></i>
                           <span style="color:#f87171; font-size:14px; font-family:'Bebas Neue', sans-serif; letter-spacing:1px;">HIDE FROM PLAYERS</span>`;
                           
    visibilityTitleWrapperElement.onclick = () => {
        privacyExpandedSections['advanced_visibility'] = !privacyExpandedSections['advanced_visibility'];
        populateParentPrivacyWidget();
    };
    
    visibilityHeaderRowElement.appendChild(visibilityTitleWrapperElement);
    widgetBodyElement.appendChild(visibilityHeaderRowElement);

    if (isVisibilityAccordionExpanded) {
        // Create the accordion body container <div> element for the player visibility checklist
        const visibilityAccordionBodyElement = document.createElement('div');
        visibilityAccordionBodyElement.style.padding = '12px 12px 12px 28px';
        visibilityAccordionBodyElement.style.background = 'rgba(0,0,0,0.1)';
        visibilityAccordionBodyElement.style.borderBottom = '1px solid #372128';
        visibilityAccordionBodyElement.style.display = 'flex';
        visibilityAccordionBodyElement.style.flexDirection = 'column';
        visibilityAccordionBodyElement.style.gap = '8px';
        
        // Create a helper text <span> element explaining the visibility checkboxes
        const visibilityHelperTextElement = document.createElement('span');
        visibilityHelperTextElement.style.color = '#ef4444';
        visibilityHelperTextElement.style.fontSize = '10px';
        visibilityHelperTextElement.style.fontStyle = 'italic';
        visibilityHelperTextElement.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Check the players who should NOT see this character.';
        visibilityAccordionBodyElement.appendChild(visibilityHelperTextElement);
        
        // Create a container <div> element for the list of player checkboxes
        const membersChecklistContainerElement = document.createElement('div');
        membersChecklistContainerElement.style.display = 'flex';
        membersChecklistContainerElement.style.flexDirection = 'column';
        membersChecklistContainerElement.style.gap = '6px';
        membersChecklistContainerElement.style.marginTop = '4px';
        
        const activeChronicleMembersList = chronicleMembersList.filter(memberRecord => memberRecord.status === 'active');
        if (activeChronicleMembersList.length === 0) {
            membersChecklistContainerElement.innerHTML = '<span style="color:#9ca3af;font-size:11px;font-style:italic;">No other players at this table.</span>';
        } else {
            const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === privacyWidgetTargetCharId);
            const characterOwnerUserId = characterRecord ? characterRecord.user_id : null;
            
            activeChronicleMembersList.forEach(memberRecord => {
                // Create a <div> row element for each member in the visibility checklist
                const memberRowElement = document.createElement('div');
                memberRowElement.style.display = 'flex';
                memberRowElement.style.alignItems = 'center';
                memberRowElement.style.gap = '8px';
                
                const isMemberCharacterOwner = memberRecord.id === characterOwnerUserId;
                const isMemberStoryteller = memberRecord.role === 'storyteller' || (currentChronicleData && memberRecord.id === currentChronicleData.gm_id);
                
                const isAlwaysAllowedToView = isMemberCharacterOwner || isMemberStoryteller;
                const isHiddenFromMember = isAlwaysAllowedToView ? false : (currentHiddenFromFields || []).includes(memberRecord.id);
                
                let roleBadgeHtml = '';
                if (isMemberCharacterOwner) roleBadgeHtml = ' <span style="color:#60a5fa;">(Owner)</span>';
                else if (isMemberStoryteller) roleBadgeHtml = ' <span style="color:#f59e0b;">(ST)</span>';

                memberRowElement.innerHTML = `<input type="checkbox" id="vis_member_${memberRecord.id}" ${isHiddenFromMember ? 'checked' : ''} ${isAlwaysAllowedToView ? 'disabled' : ''}>
                                   <label for="vis_member_${memberRecord.id}" style="color:${isAlwaysAllowedToView ? '#6b7280' : '#9ca3af'}; font-size:11px; cursor:${isAlwaysAllowedToView ? 'not-allowed' : 'pointer'};">${memberRecord.username}${roleBadgeHtml}</label>`;
                                   
                if (!isAlwaysAllowedToView) {
                    // Query the checkbox input inside the member row and attach a change handler
                    memberRowElement.querySelector('input').onchange = () => { toggleVisibilityMember(memberRecord.id); };
                }
                membersChecklistContainerElement.appendChild(memberRowElement);
            });
            if (membersChecklistContainerElement.children.length === 0) {
                 membersChecklistContainerElement.innerHTML = '<span style="color:#9ca3af;font-size:11px;font-style:italic;">Only GM and Owner present.</span>';
            }
        }
        visibilityAccordionBodyElement.appendChild(membersChecklistContainerElement);
        widgetBodyElement.appendChild(visibilityAccordionBodyElement);
    }
    
    // NORMAL PRIVACY ACCORDIONS
    for (const [sectionIdentifier, sectionMetadata] of Object.entries(PRIVACY_SECTION_MAP)) {
        const isSectionAccordionExpanded = privacyExpandedSections[sectionIdentifier] || false;
        const isEntireSectionConcealed = currentPrivacyConcealedFields.includes(sectionIdentifier);
        
        // Create the accordion header row <div> element for this sheet section
        const sectionHeaderRowElement = document.createElement('div');
        sectionHeaderRowElement.style.display = 'flex';
        sectionHeaderRowElement.style.justifyContent = 'space-between';
        sectionHeaderRowElement.style.alignItems = 'center';
        sectionHeaderRowElement.style.padding = '10px 12px';
        sectionHeaderRowElement.style.background = isSectionAccordionExpanded ? 'rgba(0,0,0,0.3)' : 'transparent';
        sectionHeaderRowElement.style.borderBottom = '1px solid #372128';
        sectionHeaderRowElement.style.cursor = 'pointer';
        
        // Create the title wrapper <div> element for the section header
        const sectionTitleWrapperElement = document.createElement('div');
        sectionTitleWrapperElement.style.display = 'flex';
        sectionTitleWrapperElement.style.alignItems = 'center';
        sectionTitleWrapperElement.style.gap = '10px';
        sectionTitleWrapperElement.innerHTML = `<i class="fa-solid ${isSectionAccordionExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}" style="color:#9ca3af;font-size:12px;width:12px;"></i>
                               <span style="color:#f3f4f6; font-size:14px; font-family:'Bebas Neue', sans-serif; letter-spacing:1px;">${sectionMetadata.label.toUpperCase()}</span>`;
        sectionTitleWrapperElement.onclick = () => {
            privacyExpandedSections[sectionIdentifier] = !privacyExpandedSections[sectionIdentifier];
            populateParentPrivacyWidget();
        };
        
        // Create the eye-icon toggle <button> element for concealing/revealing the entire section
        const sectionToggleButtonElement = document.createElement('button');
        sectionToggleButtonElement.style.background = 'none';
        sectionToggleButtonElement.style.border = 'none';
        sectionToggleButtonElement.style.cursor = 'pointer';
        sectionToggleButtonElement.style.fontSize = '16px';
        sectionToggleButtonElement.innerHTML = isEntireSectionConcealed ? '<i class="fa-solid fa-eye-slash" style="color:#ef4444;"></i>' : '<i class="fa-solid fa-eye" style="color:#9ca3af;"></i>';
        sectionToggleButtonElement.onclick = (clickEventObject) => {
            clickEventObject.stopPropagation();
            toggleConcealmentItem(sectionIdentifier);
        };
        
        sectionHeaderRowElement.appendChild(sectionTitleWrapperElement);
        sectionHeaderRowElement.appendChild(sectionToggleButtonElement);
        widgetBodyElement.appendChild(sectionHeaderRowElement);
        
        // Accordion Body
        if (isSectionAccordionExpanded) {
            // Create the container <div> element for the individual field rows in this section
            const sectionFieldsContainerElement = document.createElement('div');
            sectionFieldsContainerElement.style.padding = '8px 12px 12px 28px';
            sectionFieldsContainerElement.style.background = 'rgba(0,0,0,0.1)';
            sectionFieldsContainerElement.style.borderBottom = '1px solid #372128';
            sectionFieldsContainerElement.style.display = 'flex';
            sectionFieldsContainerElement.style.flexDirection = 'column';
            sectionFieldsContainerElement.style.gap = '8px';
            
            sectionMetadata.fields.forEach(fieldIdentifier => {
                // Create a <div> row element for the individual sheet field
                const fieldRowElement = document.createElement('div');
                fieldRowElement.style.display = 'flex';
                fieldRowElement.style.justifyContent = 'space-between';
                fieldRowElement.style.alignItems = 'center';
                
                let formattedFieldLabel = fieldIdentifier.replace(/_/g, ' ');
                const disciplinePowerMatch = fieldIdentifier.match(/^discipline_power_(\d+)_(\d+)$/);
                if (disciplinePowerMatch) formattedFieldLabel = 'Discipline ' + (parseInt(disciplinePowerMatch[1]) + 1) + ' Power ' + (parseInt(disciplinePowerMatch[2]) + 1);
                
                const disciplineNameMatch = fieldIdentifier.match(/^discipline_name_(\d+)$/);
                if (disciplineNameMatch) formattedFieldLabel = 'Discipline ' + (parseInt(disciplineNameMatch[1]) + 1) + ' Name';
                
                const disciplineRatingMatch = fieldIdentifier.match(/^discipline_dots_(\d+)$/);
                if (disciplineRatingMatch) formattedFieldLabel = 'Discipline ' + (parseInt(disciplineRatingMatch[1]) + 1) + ' Rating';
                
                const advantageNameMatch = fieldIdentifier.match(/^adv_flaw_name_(\d+)$/);
                if (advantageNameMatch) formattedFieldLabel = 'Adv/Flaw ' + advantageNameMatch[1] + ' Name';
                
                const advantageRatingMatch = fieldIdentifier.match(/^adv_flaw_rating_(\d+)$/);
                if (advantageRatingMatch) formattedFieldLabel = 'Adv/Flaw ' + advantageRatingMatch[1] + ' Rating';
                
                const tenetFieldMatch = fieldIdentifier.match(/^tenet_(\d+)$/);
                if (tenetFieldMatch) formattedFieldLabel = 'Tenet ' + (parseInt(tenetFieldMatch[1]) + 1);
                
                const touchstoneFieldMatch = fieldIdentifier.match(/^touchstone_(\d+)$/);
                if (touchstoneFieldMatch) formattedFieldLabel = 'Touchstone ' + (parseInt(touchstoneFieldMatch[1]) + 1);
                
                const isFieldConcealed = currentPrivacyConcealedFields.includes(fieldIdentifier) || isEntireSectionConcealed;
                const visibilityIconColor = isFieldConcealed ? '#ef4444' : '#9ca3af';
                const visibilityIconClass = isFieldConcealed ? 'fa-eye-slash' : 'fa-eye';
                
                fieldRowElement.innerHTML = `<span style="color:#d1d5db; font-size:12px; font-family:'Inter', sans-serif; text-transform:capitalize;">${formattedFieldLabel}</span>
                                 <button style="background:none;border:none;cursor:pointer;font-size:14px;"><i class="fa-solid ${visibilityIconClass}" style="color:${visibilityIconColor};"></i></button>`;
                
                // Query the toggle button inside the field row and attach a click handler
                fieldRowElement.querySelector('button').onclick = () => {
                    if (isEntireSectionConcealed) {
                        // Display a native browser alert explaining that section-level redaction overrides individual fields
                        alert("Cannot toggle individual fields while the entire section is hidden.");
                        return;
                    }
                    toggleConcealmentItem(fieldIdentifier);
                };
                
                sectionFieldsContainerElement.appendChild(fieldRowElement);
            });
            widgetBodyElement.appendChild(sectionFieldsContainerElement);
        }
    }
}

async function quickToggleVisibility(clickEventObject, characterId, isCurrentlyHidden) {
    if (clickEventObject) {
        clickEventObject.stopPropagation();
        clickEventObject.preventDefault();
    }
    const characterRecord = chronicleCharactersList.find(candidateCharacter => Number(candidateCharacter.id) === Number(characterId));
    const effectiveIsCurrentlyHidden = isCurrentlyHidden !== undefined ? Boolean(isCurrentlyHidden) : isCharacterHiddenFromPlayers(characterRecord);

    let updatedHiddenUserIdsList = null;
    if (!effectiveIsCurrentlyHidden) {
        if ((!Array.isArray(chronicleMembersList) || chronicleMembersList.length === 0) && activeChronicleId) {
            try {
                const membersRes = await authFetch(`/api/chronicles/${activeChronicleId}/members`);
                if (membersRes.ok) {
                    chronicleMembersList = await membersRes.json();
                }
            } catch (e) {}
        }
        const activeChronicleMembersList = (Array.isArray(chronicleMembersList) ? chronicleMembersList : []).filter(
            memberRecord => memberRecord.status === 'active' || !memberRecord.status
        );
        const characterOwnerUserId = characterRecord ? Number(characterRecord.user_id) : null;

        updatedHiddenUserIdsList = [];
        activeChronicleMembersList.forEach(memberRecord => {
            const memberUserId = Number(memberRecord.id || memberRecord.user_id);
            const isMemberCharacterOwner = characterOwnerUserId !== null && memberUserId === characterOwnerUserId;
            const isMemberStoryteller =
                memberRecord.role === 'storyteller' ||
                memberRecord.role === 'gm' ||
                (currentChronicleData && memberUserId === Number(currentChronicleData.gm_id));
            if (!isMemberCharacterOwner && !isMemberStoryteller && !isNaN(memberUserId)) {
                updatedHiddenUserIdsList.push(memberUserId);
            }
        });
    }

    try {
        // Send an authenticated HTTP PUT request to update the character's visibility restriction list
        const putRes = await authFetch('/api/characters/' + characterId, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            // Serialize the updated hidden user IDs list into a JSON string payload
            body: JSON.stringify({ hidden_from_user_ids: updatedHiddenUserIdsList })
        });
        if (putRes.ok) {
            try {
                const putJson = await putRes.json();
                if (putJson && putJson.hidden_from_user_ids !== undefined) {
                    updatedHiddenUserIdsList = putJson.hidden_from_user_ids;
                }
            } catch (e) {}
        }
        if (characterRecord) characterRecord.hidden_from_user_ids = updatedHiddenUserIdsList;
        
        if (typeof renderCharacterVaultCards === "function") renderCharacterVaultCards();
        if (typeof renderCharacterCastWidget === 'function') renderCharacterCastWidget();
        if (Number(currentLoadedCharacterId) === Number(characterId)) {
            const nowHidden = isCharacterHiddenFromPlayers(characterRecord);
            // Look up and update the Dossier quick visibility button in the DOM by ID
            const dossierQuickVisibilityButton = document.getElementById('dossierQuickVisibilityBtn');
            if (dossierQuickVisibilityButton) {
                const visibilityIconClass = nowHidden ? 'fa-eye-slash' : 'fa-eye';
                const visibilityIconColor = nowHidden ? '#ef4444' : '#9ca3af';
                dossierQuickVisibilityButton.innerHTML = `<i class="fa-solid ${visibilityIconClass}" style="color:${visibilityIconColor};"></i>`;
            }
            // Look up and update the Modal quick visibility button in the DOM by ID
            const modalQuickVisibilityButton = document.getElementById('btnModalQuickVisibility');
            if (modalQuickVisibilityButton) {
                const visibilityIconClass = nowHidden ? 'fa-eye-slash' : 'fa-eye';
                const visibilityIconColor = nowHidden ? '#ef4444' : '#9ca3af';
                modalQuickVisibilityButton.innerHTML = `<i class="fa-solid ${visibilityIconClass}" style="color:${visibilityIconColor};"></i> Toggle All`;
            }
        }
        
        if (Number(privacyWidgetTargetCharId) === Number(characterId)) {
            currentHiddenFromFields = updatedHiddenUserIdsList;
            populateParentPrivacyWidget();
        }
        if (Number(currentLoadedCharacterId) === Number(characterId) && currentSheetModalSidebarTab === 'privacy') {
            switchSheetModalTab('privacy');
        }
        if (typeof renderInlineSettingsPrivacyAndVisibility === 'function') {
            renderInlineSettingsPrivacyAndVisibility(characterId);
        }
    } catch(errorObject) {
        // Log any error toggling character visibility to the developer console
        console.error(errorObject);
    }
}

async function quickToggleVisibilityDossier() {
    if (!currentLoadedCharacterId) return;
    const characterRecord = chronicleCharactersList.find(candidateCharacter => Number(candidateCharacter.id) === Number(currentLoadedCharacterId));
    if (!characterRecord) return;
    const isCurrentlyHidden = isCharacterHiddenFromPlayers(characterRecord);
    await quickToggleVisibility(null, currentLoadedCharacterId, isCurrentlyHidden);
}

async function quickToggleVisibilityModal() {
    if (!currentLoadedCharacterId) return;
    const characterRecord = chronicleCharactersList.find(candidateCharacter => Number(candidateCharacter.id) === Number(currentLoadedCharacterId));
    if (!characterRecord) return;
    const isCurrentlyHidden = isCharacterHiddenFromPlayers(characterRecord);
    await quickToggleVisibility(null, currentLoadedCharacterId, isCurrentlyHidden);
}


let dragScrollInterval = null;
function initCharacterContainerDragScroll() {
    // Query the DOM for the characters container element
    const charactersContainerElement = document.querySelector('.characters-container');
    if (!charactersContainerElement) return;
    
    // Attach a dragover listener to auto-scroll the container when dragging near its top or bottom edges
    charactersContainerElement.addEventListener('dragover', (dragOverEventObject) => {
        // Measure the container's on-screen bounding rectangle
        const containerBoundingRect = charactersContainerElement.getBoundingClientRect();
        const topScrollTriggerThreshold = containerBoundingRect.top + 50;
        const bottomScrollTriggerThreshold = containerBoundingRect.bottom - 50;
        
        // Clear any existing auto-scroll interval timer
        clearInterval(dragScrollInterval);
        
        if (dragOverEventObject.clientY < topScrollTriggerThreshold) {
            // Start a repeating timer to scroll the container upward every 20 milliseconds
            dragScrollInterval = setInterval(() => { charactersContainerElement.scrollTop -= 15; }, 20);
        } else if (dragOverEventObject.clientY > bottomScrollTriggerThreshold) {
            // Start a repeating timer to scroll the container downward every 20 milliseconds
            dragScrollInterval = setInterval(() => { charactersContainerElement.scrollTop += 15; }, 20);
        }
    });
    
    // Attach dragleave, drop, and dragend listeners to stop the auto-scroll timer when dragging ends
    charactersContainerElement.addEventListener('dragleave', () => clearInterval(dragScrollInterval));
    charactersContainerElement.addEventListener('drop', () => clearInterval(dragScrollInterval));
    charactersContainerElement.addEventListener('dragend', () => clearInterval(dragScrollInterval));
}

// Register a DOMContentLoaded listener on the document to initialize drag-scrolling once the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initCharacterContainerDragScroll();
});


async function moveNpcCategory(directionDelta, categoryId) {
    const currentCategoryIndex = npcCategoriesList.findIndex(categoryRecord => categoryRecord.id === categoryId);
    if (currentCategoryIndex === -1) return;
    const targetCategoryIndex = currentCategoryIndex + directionDelta;
    if (targetCategoryIndex < 0 || targetCategoryIndex >= npcCategoriesList.length) return;
    
    // Swap
    const temporaryCategorySwapHolder = npcCategoriesList[currentCategoryIndex];
    npcCategoriesList[currentCategoryIndex] = npcCategoriesList[targetCategoryIndex];
    npcCategoriesList[targetCategoryIndex] = temporaryCategorySwapHolder;
    
    // Update sort orders locally
    npcCategoriesList.forEach((categoryRecord, sortIndex) => categoryRecord.sort_order = sortIndex);
    
    renderNpcCategoryManagerList();
    if (typeof renderCharacterVaultCards === 'function') renderCharacterVaultCards();
    
    try {
        // Perform an authenticated HTTP POST request to persist the new NPC category sort order on the server
        await authFetch('/api/chronicles/' + activeChronicleId + '/npc-categories/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Serialize the array of category IDs and sort orders into a JSON string payload
            body: JSON.stringify(npcCategoriesList.map(categoryRecord => ({id: categoryRecord.id, sort_order: categoryRecord.sort_order})))
        });
    } catch (errorObject) {
        // Log any error reordering NPC categories to the developer console
        console.error(errorObject);
    }
}

/**
 * Opens the Storyteller Chronicle Experience Point (XP) Manager modal and populates the character XP roster.
 */
function openChronicleXpManagerModal() {
    // Look up the Chronicle XP Manager modal element in the DOM by ID
    const chronicleXpModalElement = document.getElementById('chronicleXpManagerModal');
    if (!chronicleXpModalElement) return;
    renderChronicleXpRosterTable();
    // Add the 'active' CSS class to display the modal overlay
    chronicleXpModalElement.classList.add('active');
}

/**
 * Renders the table of characters in the Chronicle XP Manager modal showing Total, Spent, and Available XP,
 * along with per-character XP adjustment controls.
 */
function renderChronicleXpRosterTable() {
    // Look up the table body element for the Chronicle XP roster in the DOM by ID
    const rosterTableBodyElement =
        document.getElementById('chronicleXpRosterTableBody') ||
        document.getElementById('chronicleXpRosterBody');
    if (!rosterTableBodyElement) return;

    if (!Array.isArray(chronicleCharactersList) || chronicleCharactersList.length === 0) {
        rosterTableBodyElement.innerHTML = '<tr><td colspan="6" style="padding:18px; text-align:center; color:#6b7280; font-style:italic;">No characters found in this chronicle.</td></tr>';
        return;
    }

    // Sort characters so Player Characters ('pc') appear first, followed by NPCs alphabetically
    const sortedCharactersForXpTable = [...chronicleCharactersList].sort((characterA, characterB) => {
        const isCharacterAPc = String(characterA.category || '').trim().toLowerCase() === 'pc';
        const isCharacterBPc = String(characterB.category || '').trim().toLowerCase() === 'pc';
        if (isCharacterAPc && !isCharacterBPc) return -1;
        if (!isCharacterAPc && isCharacterBPc) return 1;
        return String(characterA.name || '').localeCompare(String(characterB.name || ''));
    });

    rosterTableBodyElement.innerHTML = sortedCharactersForXpTable.map(characterRecord => {
        let parsedCharacterSheetData = {};
        try {
            // Parse the character's sheet_data JSON string if it is serialized
            parsedCharacterSheetData = typeof characterRecord.sheet_data === 'string'
                ? JSON.parse(characterRecord.sheet_data)
                : (characterRecord.sheet_data || {});
        } catch (jsonParseError) {
            parsedCharacterSheetData = {};
        }

        const totalExperiencePoints = parseInt(parsedCharacterSheetData.total_experience || parsedCharacterSheetData.total || 0, 10) || 0;
        const spentExperiencePoints = parseInt(parsedCharacterSheetData.spent_experience || parsedCharacterSheetData.spent || 0, 10) || 0;
        const availableExperiencePoints = totalExperiencePoints - spentExperiencePoints;
        const isPlayerCharacter = String(characterRecord.category || '').trim().toLowerCase() === 'pc';
        const categoryBadgeHtml = isPlayerCharacter
            ? '<span style="background:rgba(245,158,11,0.18); color:#fcd34d; border:1px solid #b45309; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:bold; margin-left:6px;">PC</span>'
            : `<span style="background:rgba(107,114,128,0.18); color:#9ca3af; border:1px solid #374151; padding:2px 6px; border-radius:4px; font-size:10px; margin-left:6px;">${escapeHtml(characterRecord.category || 'NPC')}</span>`;

        return `
            <tr style="border-bottom:1px solid #1f2937;">
                <td style="padding:8px;">
                    <div style="font-weight:bold; color:#f3f4f6;">${escapeHtml(characterRecord.name || 'Unnamed')}${categoryBadgeHtml}</div>
                </td>
                <td style="padding:8px; font-size:12px; color:#9ca3af;">${escapeHtml(characterRecord.player_name || (isPlayerCharacter ? 'Player' : 'Storyteller'))}</td>
                <td style="padding:8px; text-align:center; font-weight:bold; color:#e5e7eb;">${totalExperiencePoints}</td>
                <td style="padding:8px; text-align:center; font-weight:bold; color:#f87171;">${spentExperiencePoints}</td>
                <td style="padding:8px; text-align:center; font-weight:bold; color:${availableExperiencePoints > 0 ? '#4ade80' : '#9ca3af'};">${availableExperiencePoints}</td>
                <td style="padding:8px;">
                    <div style="display:flex; gap:6px; align-items:center;">
                        <input type="number" id="charXpAmount_${characterRecord.id}" value="1" step="1" style="width:64px; background:#09090b; border:1px solid #374151; color:#fff; padding:4px 6px; border-radius:4px; font-size:12px;">
                        <input type="text" id="charXpReason_${characterRecord.id}" placeholder="Reason (e.g. Roleplay bonus / Correction)" style="flex:1; background:#09090b; border:1px solid #374151; color:#fff; padding:4px 8px; border-radius:4px; font-size:12px;">
                        <button class="btn-secondary btn-sm" onclick="submitChronicleXpAdjustment('character', ${characterRecord.id})" style="background:#7f1d1d; border-color:#ef4444; color:#fecaca; white-space:nowrap;">Apply</button>
                        <button class="btn-secondary btn-sm" onclick="document.getElementById('chronicleXpManagerModal').classList.remove('active'); openCharacterSheet(${characterRecord.id}, '${escapeHtml(characterRecord.name || '').replace(/'/g, "\\'")}', '${escapeHtml(characterRecord.clan || '').replace(/'/g, "\\'")}');" style="font-size:11px; padding:4px 8px; white-space:nowrap;" title="Open Sheet to inspect Base Compliance or Refund XP"><i class="fa-solid fa-file-signature"></i> Sheet</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Submits a Campaign XP (all Player Characters) or Individual Character XP adjustment (positive or negative) to the server.
 */
async function submitChronicleXpAdjustment(targetScope, targetCharacterId) {
    if (!activeChronicleId) return;

    let experienceAmountDelta = 0;
    let adjustmentReasonText = '';

    if (targetScope === 'campaign') {
        // Read the campaign-wide XP amount and reason input elements from the DOM by ID
        const campaignAmountInputElement =
            document.getElementById('campaignXpDeltaInput') ||
            document.getElementById('campaignXpAmountInput');
        const campaignReasonInputElement = document.getElementById('campaignXpReasonInput');
        experienceAmountDelta = parseInt(campaignAmountInputElement ? campaignAmountInputElement.value : '0', 10);
        adjustmentReasonText = campaignReasonInputElement && campaignReasonInputElement.value.trim()
            ? campaignReasonInputElement.value.trim()
            : 'Campaign Episode XP';
    } else {
        // Read the individual character's XP amount and reason input elements from the DOM by ID
        const characterAmountInputElement = document.getElementById(`charXpAmount_${targetCharacterId}`);
        const characterReasonInputElement = document.getElementById(`charXpReason_${targetCharacterId}`);
        experienceAmountDelta = parseInt(characterAmountInputElement ? characterAmountInputElement.value : '0', 10);
        adjustmentReasonText = characterReasonInputElement && characterReasonInputElement.value.trim()
            ? characterReasonInputElement.value.trim()
            : 'Individual Storyteller XP Adjustment';
    }

    if (isNaN(experienceAmountDelta) || experienceAmountDelta === 0) {
        // Display a native browser alert if the entered XP amount is zero or invalid
        alert('Please enter a non-zero XP amount (positive to award XP, negative to remove XP).');
        return;
    }

    try {
        // Perform an authenticated HTTP POST request to the chronicle award-xp endpoint
        const awardXpFetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/award-xp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Serialize the XP target scope, character ID, amount delta, and reason into a JSON string payload
            body: JSON.stringify({
                target: targetScope === 'campaign' ? 'campaign' : 'character',
                character_id: targetCharacterId || null,
                amount: experienceAmountDelta,
                reason: adjustmentReasonText
            })
        });

        const responseContentType = awardXpFetchResponse.headers.get('content-type') || '';
        if (awardXpFetchResponse.ok && responseContentType.includes('application/json')) {
            // Parse the JSON response returned by the server
            const awardXpResponseData = await awardXpFetchResponse.json();
            // Reload the chronicle characters list so the table and any open sheets reflect the updated XP totals
            await loadCharacters();
            renderChronicleXpRosterTable();
            const openSheetFrame = document.getElementById('sheetFrame');
            if (openSheetFrame && openSheetFrame.contentWindow) {
                openSheetFrame.contentWindow.postMessage({ type: 'vtm:remote_character_updated' }, '*');
            }
            const signStr = experienceAmountDelta > 0 ? `+${experienceAmountDelta}` : `${experienceAmountDelta}`;
            if (targetScope === 'campaign') {
                const campaignReasonInputElement = document.getElementById('campaignXpReasonInput');
                if (campaignReasonInputElement) campaignReasonInputElement.value = '';
                alert(`Applied ${signStr} XP to all ${awardXpResponseData.updated_count || ''} Player Characters!`);
            } else {
                const characterReasonInputElement = document.getElementById(`charXpReason_${targetCharacterId}`);
                if (characterReasonInputElement) characterReasonInputElement.value = '';
            }
            return;
        }

        // If the server returned a JSON error (e.g., 400 or 403), show the server error message
        if (responseContentType.includes('application/json') && awardXpFetchResponse.status !== 404) {
            const awardXpResponseData = await awardXpFetchResponse.json();
            alert(awardXpResponseData.error || 'Failed to apply XP adjustment.');
            return;
        }

        // Seamless fallback if node server.js has not been restarted since /api/chronicles/:id/award-xp was added:
        // Update target character(s) directly via PUT /api/characters/:id
        const targetCharactersToUpdate = (Array.isArray(chronicleCharactersList) ? chronicleCharactersList : []).filter(characterRecord => {
            if (targetScope === 'campaign') {
                return String(characterRecord.category || 'pc').trim().toLowerCase() === 'pc';
            }
            return Number(characterRecord.id) === Number(targetCharacterId);
        });

        for (const characterRecord of targetCharactersToUpdate) {
            let parsedSheetData = {};
            try {
                // Parse the character's existing sheet_data JSON string or object
                parsedSheetData = typeof characterRecord.sheet_data === 'string'
                    ? JSON.parse(characterRecord.sheet_data || '{}')
                    : (characterRecord.sheet_data ? JSON.parse(JSON.stringify(characterRecord.sheet_data)) : {});
            } catch (jsonParseError) {
                parsedSheetData = {};
            }

            const previousTotalXp = Number(parsedSheetData.total_experience || parsedSheetData.total || 0);
            const currentSpentXp = Number(parsedSheetData.spent_experience || parsedSheetData.spent || 0);
            const newTotalXp = Math.max(0, previousTotalXp + experienceAmountDelta);

            parsedSheetData.total_experience = String(newTotalXp);
            parsedSheetData.total = String(newTotalXp);
            parsedSheetData.spent_experience = String(currentSpentXp);
            parsedSheetData.spent = String(currentSpentXp);

            if (!Array.isArray(parsedSheetData.xp_log)) {
                parsedSheetData.xp_log = [];
            }
            parsedSheetData.xp_log.unshift({
                id: 'xp_award_' + Date.now() + '_' + characterRecord.id,
                type: experienceAmountDelta > 0 ? 'award' : 'deduct',
                scope: targetScope === 'campaign' ? 'campaign' : 'individual',
                amount: experienceAmountDelta,
                previousTotal: previousTotalXp,
                newTotal: newTotalXp,
                reason: adjustmentReasonText,
                by: (currentUser && (currentUser.displayName || currentUser.username)) || 'Storyteller',
                timestamp: new Date().toISOString()
            });

            // Save the updated sheet_data via the existing PUT /api/characters/:id endpoint
            await authFetch(`/api/characters/${characterRecord.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheet_data: parsedSheetData })
            });
        }

        // Reload the chronicle characters list so the table and any open sheets reflect the updated XP totals
        await loadCharacters();
        renderChronicleXpRosterTable();
    } catch (networkErrorObject) {
        // Log any network or parsing error to the developer console and alert the Storyteller
        console.error('Failed to submit chronicle XP adjustment:', networkErrorObject);
        alert('Network error while applying XP adjustment.');
    }
}

// Tracks whether the Storyteller is currently previewing the open character sheet from the Player's perspective
let isSheetModalPlayerPreviewActive = false;
// Tracks which left-sidebar tab is currently active ('sheet' | 'xp' | 'privacy' | 'npc' | 'settings')
let currentSheetModalSidebarTab = 'sheet';

/**
 * Switches the active tab in the Character Sheet Modal's Left Sidebar ('sheet', 'xp', 'privacy', 'npc', or 'settings').
 */
function switchSheetModalTab(targetTabName) {
    currentSheetModalSidebarTab = targetTabName || 'sheet';

    // Look up the 5 sidebar tab buttons in the DOM by ID
    const tabSheetButton = document.getElementById('sheetNavTabSheet');
    const tabXpButton = document.getElementById('btnModalExperienceToggle');
    const tabPrivacyButton = document.getElementById('sheetNavTabPrivacy');
    const tabNpcButton = document.getElementById('sheetNavTabNpc');
    const tabSettingsButton = document.getElementById('btnModalStSheetTools');

    if (tabSheetButton) tabSheetButton.classList.toggle('active', currentSheetModalSidebarTab === 'sheet');
    if (tabXpButton) tabXpButton.classList.toggle('active', currentSheetModalSidebarTab === 'xp');
    if (tabPrivacyButton) tabPrivacyButton.classList.toggle('active', currentSheetModalSidebarTab === 'privacy');
    if (tabNpcButton) tabNpcButton.classList.toggle('active', currentSheetModalSidebarTab === 'npc');
    if (tabSettingsButton) tabSettingsButton.classList.toggle('active', currentSheetModalSidebarTab === 'settings');

    // Look up the 3 workspace view containers in the DOM by ID
    const sheetIframeContainerElement = document.getElementById('sheetIframeContainer');
    const npcProfilePanelElement = document.getElementById('gmNpcProfileSidebar');
    const settingsPanelElement = document.getElementById('sheetSettingsViewPanel');
    const sheetIframeElement = document.getElementById('sheetFrame');

    const showIframeView =
        currentSheetModalSidebarTab === 'sheet' ||
        currentSheetModalSidebarTab === 'xp' ||
        currentSheetModalSidebarTab === 'privacy';
    if (sheetIframeContainerElement) {
        sheetIframeContainerElement.style.display = showIframeView ? 'flex' : 'none';
    }
    if (npcProfilePanelElement) {
        npcProfilePanelElement.style.display = currentSheetModalSidebarTab === 'npc' ? 'block' : 'none';
    }
    if (settingsPanelElement) {
        settingsPanelElement.style.display = currentSheetModalSidebarTab === 'settings' ? 'block' : 'none';
    }

    // Synchronize the embedded sheet iframe's mode ('sheet', 'xp', or 'privacy') with the selected tab
    if (sheetIframeElement && sheetIframeElement.contentWindow && showIframeView) {
        let eligiblePlayersForPrivacy = [];
        let hiddenFromUserIdsForPrivacy = [];
        if (currentSheetModalSidebarTab === 'privacy' && currentLoadedCharacterId) {
            privacyWidgetTargetCharId = currentLoadedCharacterId;
            if ((!Array.isArray(chronicleMembersList) || chronicleMembersList.length === 0) && activeChronicleId) {
                authFetch(`/api/chronicles/${activeChronicleId}/members`)
                    .then(res => res.ok ? res.json() : [])
                    .then(members => {
                        if (Array.isArray(members) && members.length > 0) {
                            chronicleMembersList = members;
                            if (currentSheetModalSidebarTab === 'privacy') {
                                switchSheetModalTab('privacy');
                            }
                        }
                    })
                    .catch(() => {});
            }
            const activeMembersList = Array.isArray(chronicleMembersList)
                ? chronicleMembersList.filter(memberRecord => memberRecord.status === 'active' || !memberRecord.status)
                : [];
            const characterRecord = chronicleCharactersList.find(
                candidateCharacter => Number(candidateCharacter.id) === Number(currentLoadedCharacterId)
            );
            const characterOwnerUserId = characterRecord ? Number(characterRecord.user_id) : null;
            eligiblePlayersForPrivacy = activeMembersList.filter(memberRecord => {
                const memberId = Number(memberRecord.id || memberRecord.user_id);
                const isMemberOwner = characterOwnerUserId !== null && memberId === characterOwnerUserId;
                const isMemberStoryteller =
                    memberRecord.role === 'storyteller' ||
                    memberRecord.role === 'gm' ||
                    (currentChronicleData && memberId === Number(currentChronicleData.gm_id));
                return !isMemberOwner && !isMemberStoryteller;
            });
            if (characterRecord && characterRecord.hidden_from_user_ids) {
                try {
                    hiddenFromUserIdsForPrivacy = typeof characterRecord.hidden_from_user_ids === 'string'
                        ? JSON.parse(characterRecord.hidden_from_user_ids)
                        : characterRecord.hidden_from_user_ids;
                } catch (parseError) {
                    hiddenFromUserIdsForPrivacy = [];
                }
            }
            if (!Array.isArray(hiddenFromUserIdsForPrivacy)) {
                hiddenFromUserIdsForPrivacy = [];
            }
            currentHiddenFromFields = hiddenFromUserIdsForPrivacy;
        }
        // Send a cross-document message to the character sheet iframe to activate pure 'sheet' mode, 'xp' upgrade mode, or 'privacy' redaction mode
        sheetIframeElement.contentWindow.postMessage({
            type: 'vtm:set_sheet_tab_mode',
            mode: currentSheetModalSidebarTab,
            eligiblePlayers: eligiblePlayersForPrivacy,
            hiddenFromUserIds: hiddenFromUserIdsForPrivacy
        }, '*');
    }
}

/**
 * Legacy helper preserved for backwards compatibility: no-op now that Privacy & Redactions has its own dedicated sidebar tab.
 */
async function renderInlineSettingsPrivacyAndVisibility(characterId) {
    return characterId;
}

/**
 * Legacy helper preserved for backwards compatibility: switches to the Experience & Upgrades sidebar tab.
 */
function toggleSheetExperienceDrawer() {
    switchSheetModalTab(currentSheetModalSidebarTab === 'xp' ? 'sheet' : 'xp');
}

/**
 * Legacy helper preserved for backwards compatibility: switches to the Storyteller & Settings sidebar tab.
 */
function toggleSheetStorytellerDrawer() {
    switchSheetModalTab(currentSheetModalSidebarTab === 'settings' ? 'sheet' : 'settings');
}

/**
 * Submits a Storyteller XP award or removal directly inline inside the Storyteller & Settings panel.
 */
async function submitModalStorytellerXpAward() {
    // Look up the Storyteller XP award form inputs in the DOM by ID
    const amountInputElement = document.getElementById('modalStAwardXpAmount');
    const targetSelectElement = document.getElementById('modalStAwardXpTarget');
    const reasonInputElement = document.getElementById('modalStAwardXpReason');
    const feedbackElement = document.getElementById('settingsXpAwardFeedback');
    const sheetIframeElement = document.getElementById('sheetFrame');

    const experienceAmountDelta = parseInt(amountInputElement ? amountInputElement.value : '0', 10);
    const targetScope = targetSelectElement ? targetSelectElement.value : 'character';
    const adjustmentReasonText = reasonInputElement ? reasonInputElement.value.trim() : '';

    if (!experienceAmountDelta || isNaN(experienceAmountDelta)) {
        // Display a native browser alert if the XP amount is 0 or invalid
        alert('Please enter a non-zero XP amount (positive to award XP, negative to remove XP).');
        return;
    }

    if (sheetIframeElement && sheetIframeElement.contentWindow) {
        // Send a cross-document message to the embedded character sheet iframe so it applies and logs the XP change immediately
        sheetIframeElement.contentWindow.postMessage({
            type: 'vtm:award_xp_from_sidebar',
            amount: experienceAmountDelta,
            target: targetScope,
            reason: adjustmentReasonText
        }, '*');
        if (reasonInputElement) reasonInputElement.value = '';
        if (feedbackElement) {
            const signLabel = experienceAmountDelta > 0 ? `+${experienceAmountDelta}` : `${experienceAmountDelta}`;
            feedbackElement.textContent = `✔ Applied ${signLabel} XP (${targetScope === 'campaign' ? 'All Campaign PCs' : 'This Character'})`;
            feedbackElement.style.display = 'block';
            // setTimeout hides the inline confirmation message after 3.5 seconds
            setTimeout(() => {
                feedbackElement.style.display = 'none';
            }, 3500);
        }
    }
}

/**
 * Refunds a specific XP purchase entry directly from the inline XP History & Refunds list inside the Settings panel.
 */
function refundSheetXpEntryFromSettings(logIndex) {
    // Look up the embedded character sheet iframe element in the DOM by ID
    const sheetIframeElement = document.getElementById('sheetFrame');
    if (sheetIframeElement && sheetIframeElement.contentWindow) {
        // Send a cross-document message to the character sheet iframe to refund the specified purchase entry
        sheetIframeElement.contentWindow.postMessage({
            type: 'vtm:refund_xp_entry',
            logIndex: Number(logIndex)
        }, '*');
    }
}

/**
 * Toggles whether the Player is allowed to freely edit permanent Black Base Dots (`player_base_edit_unlocked`)
 * or locks & snapshots the current Base Stats for the character.
 */
function togglePlayerBaseStatsUnlockFromSettings() {
    // Look up the embedded character sheet iframe element in the DOM by ID
    const sheetIframeElement = document.getElementById('sheetFrame');
    if (sheetIframeElement && sheetIframeElement.contentWindow) {
        // Send a cross-document message to the character sheet iframe to toggle player base stat editing unlock/lock & snapshot
        sheetIframeElement.contentWindow.postMessage({
            type: 'vtm:toggle_player_base_unlock'
        }, '*');
    }
}

/**
 * Re-snapshots all current dots on the sheet as permanent Black Base Dots directly from the Settings panel.
 */
function resnapshotSheetBaseStatsFromSettings() {
    // Look up the embedded character sheet iframe element in the DOM by ID
    const sheetIframeElement = document.getElementById('sheetFrame');
    if (sheetIframeElement && sheetIframeElement.contentWindow) {
        // Send a cross-document message to the character sheet iframe to re-snapshot current ratings as base stats
        sheetIframeElement.contentWindow.postMessage({
            type: 'vtm:resnapshot_base_stats'
        }, '*');
    }
}

/**
 * Converts a pre-snapshot 1-dot skill upgrade from `base_stats` into a Crimson Red XP dot (`xp_upgrades`) directly from Settings.
 */
function convertPreSnapshotSkillUpgradeFromSettings() {
    // Look up the skill selector dropdown and character sheet iframe in the DOM by ID
    const skillSelectElement = document.getElementById('settingsInlineSkillAutoFixSelect');
    const sheetIframeElement = document.getElementById('sheetFrame');
    const selectedSkillKey = skillSelectElement ? skillSelectElement.value : '';
    if (!selectedSkillKey || !sheetIframeElement || !sheetIframeElement.contentWindow) return;

    // Send a cross-document message to the character sheet iframe to move 1 dot of the selected skill into xp_upgrades
    sheetIframeElement.contentWindow.postMessage({
        type: 'vtm:convert_presnapshot_skill',
        skillKey: selectedSkillKey
    }, '*');
}

/**
 * Switches from the Settings panel to the Character Sheet with Storyteller Base Stat Edit Mode enabled.
 */
function activateSheetBaseDotsEditMode() {
    switchSheetModalTab('sheet');
    // Look up the embedded character sheet iframe element in the DOM by ID
    const sheetIframeElement = document.getElementById('sheetFrame');
    if (sheetIframeElement && sheetIframeElement.contentWindow) {
        // Send a cross-document message to the character sheet iframe to enable permanent Black Base Dot editing mode
        sheetIframeElement.contentWindow.postMessage({
            type: 'vtm:set_sheet_tab_mode',
            mode: 'base_edit'
        }, '*');
    }
}

/**
 * Switches to the Character Sheet and opens the V5 Base Creation Rules Compliance Report modal.
 */
function openSheetComplianceFromSettings() {
    switchSheetModalTab('settings');
}

/**
 * Switches to the Character Sheet and opens the Experience Point History & Storyteller Refunds modal.
 */
function openSheetXpHistoryFromSettings() {
    switchSheetModalTab('settings');
}

/**
 * Toggles the Character Sheet Modal between Storyteller View and exact Player Perspective Preview.
 */
function toggleSheetPlayerPreviewMode() {
    const isStorytellerUser = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
    if (!isStorytellerUser) return;

    isSheetModalPlayerPreviewActive = !isSheetModalPlayerPreviewActive;

    // Look up the Storyteller-only UI elements in the Character Sheet Modal
    const npcNavTabButton = document.getElementById('sheetNavTabNpc');
    const sheetStToolsCardElement = document.getElementById('sheetStToolsCard');
    const gmReassignControlContainerElement = document.getElementById('gmReassignControl');
    const modalCategoryWrapperElement = document.getElementById('modalCharCategoryWrapper');
    const sidebarExitPreviewButton = document.getElementById('btnSidebarExitPlayerPreview');
    const ownershipStatusContainerElement = document.getElementById('modalOwnershipStatus');
    const settingsNavTitleElement = document.getElementById('sheetNavSettingsTitle');
    const settingsNavSubElement = document.getElementById('sheetNavSettingsSub');
    const settingsNavIconElement = document.getElementById('sheetNavSettingsIcon');
    const settingsPanelHeadingTextElement = document.getElementById('sheetSettingsPanelHeadingText');
    const sheetIframeElement = document.getElementById('sheetFrame');

    if (isSheetModalPlayerPreviewActive) {
        // Hide Storyteller-only tabs and cards so the Storyteller sees the exact Player perspective
        if (npcNavTabButton) npcNavTabButton.style.display = 'none';
        if (sheetStToolsCardElement) sheetStToolsCardElement.style.display = 'none';
        if (gmReassignControlContainerElement) gmReassignControlContainerElement.style.display = 'none';
        if (modalCategoryWrapperElement) modalCategoryWrapperElement.style.display = 'none';
        if (sidebarExitPreviewButton) {
            sidebarExitPreviewButton.style.display = 'flex';
            sidebarExitPreviewButton.innerHTML = '<i class="fa-solid fa-crown"></i> Exit Player View';
            sidebarExitPreviewButton.style.borderColor = '#f59e0b';
            sidebarExitPreviewButton.style.background = 'rgba(245, 158, 11, 0.22)';
            sidebarExitPreviewButton.style.color = '#fde68a';
        }

        if (settingsNavTitleElement) settingsNavTitleElement.textContent = 'Sheet Settings';
        if (settingsNavSubElement) settingsNavSubElement.textContent = 'Layout & Alias';
        if (settingsNavIconElement) settingsNavIconElement.className = 'fa-solid fa-gear sheet-sidebar-tab-icon';
        if (settingsPanelHeadingTextElement) settingsPanelHeadingTextElement.textContent = 'Sheet Settings';

        if (ownershipStatusContainerElement) {
            ownershipStatusContainerElement.innerHTML = `<span class="badge-edit-unlocked" style="background:rgba(59,130,246,0.2);color:#93c5fd;border:1px solid #60a5fa;"><i class="fa-solid fa-eye"></i> Player View</span>`;
        }
        // If currently on the NPC or Privacy tab, return to the main Character Sheet tab so the Storyteller sees the exact redacted sheet
        if (currentSheetModalSidebarTab === 'npc' || currentSheetModalSidebarTab === 'privacy') {
            switchSheetModalTab('sheet');
        }
    } else {
        // Restore Storyteller tabs, cards, and controls
        if (npcNavTabButton) npcNavTabButton.style.display = 'flex';
        if (sheetStToolsCardElement) sheetStToolsCardElement.style.display = 'grid';
        if (gmReassignControlContainerElement) gmReassignControlContainerElement.style.display = 'flex';
        if (modalCategoryWrapperElement) modalCategoryWrapperElement.style.display = 'block';
        if (sidebarExitPreviewButton) {
            sidebarExitPreviewButton.style.display = 'flex';
            sidebarExitPreviewButton.innerHTML = '<i class="fa-solid fa-eye"></i> View as Player';
            sidebarExitPreviewButton.style.borderColor = 'rgba(96, 165, 250, 0.45)';
            sidebarExitPreviewButton.style.background = 'rgba(30, 58, 138, 0.25)';
            sidebarExitPreviewButton.style.color = '#93c5fd';
        }

        if (settingsNavTitleElement) settingsNavTitleElement.textContent = 'Storyteller & Settings';
        if (settingsNavSubElement) settingsNavSubElement.textContent = 'XP, Rules & Ownership';
        if (settingsNavIconElement) settingsNavIconElement.className = 'fa-solid fa-crown sheet-sidebar-tab-icon';
        if (settingsPanelHeadingTextElement) settingsPanelHeadingTextElement.textContent = 'Storyteller & Sheet Settings';

        if (ownershipStatusContainerElement) {
            ownershipStatusContainerElement.innerHTML = `<span class="badge-edit-unlocked"><i class="fa-solid fa-crown"></i> Storyteller</span>`;
        }
    }

    if (sheetIframeElement && sheetIframeElement.contentWindow) {
        // Send a cross-document message to the character sheet iframe to switch between Player Preview and Storyteller mode
        sheetIframeElement.contentWindow.postMessage({
            type: 'vtm:set_player_preview',
            isPlayerPreview: isSheetModalPlayerPreviewActive
        }, '*');
    }
}

/**
 * Instructs the embedded character sheet iframe to save and switch to a different sheet layout template.
 */
function changeSheetTemplateFromModalHeader(newTemplateFilename) {
    // Look up the embedded character sheet iframe element in the DOM by ID
    const sheetIframeElement = document.getElementById('sheetFrame');
    if (sheetIframeElement && sheetIframeElement.contentWindow) {
        // Send a cross-document message to the character sheet iframe to save and switch templates
        sheetIframeElement.contentWindow.postMessage({
            type: 'vtm:change_template',
            template: newTemplateFilename
        }, '*');
    }
    switchSheetModalTab('sheet');
}

// Listen for live XP badge, compliance report, privacy redactions, and XP log updates from the embedded character sheet iframe
window.addEventListener('message', (messageEventObject) => {
    if (!messageEventObject.data || typeof messageEventObject.data !== 'object') return;

    if (messageEventObject.data.type === 'vtm:set_hidden_from_users') {
        const targetCharId = Number(messageEventObject.data.charId || currentLoadedCharacterId);
        const updatedHiddenIds =
            Array.isArray(messageEventObject.data.hiddenFromUserIds) &&
            messageEventObject.data.hiddenFromUserIds.length > 0
                ? messageEventObject.data.hiddenFromUserIds
                : null;
        if (targetCharId) {
            privacyWidgetTargetCharId = targetCharId;
            currentHiddenFromFields = updatedHiddenIds;
            updateVisibilitySettings();
        }
        return;
    }

    if (messageEventObject.data.type === 'vtm:privacy_sync') {
        const syncedCharId = Number(messageEventObject.data.charId || currentLoadedCharacterId);
        const syncedConcealedFields = Array.isArray(messageEventObject.data.concealedFields)
            ? messageEventObject.data.concealedFields
            : [];
        currentPrivacyConcealedFields = syncedConcealedFields;
        const characterRecord = chronicleCharactersList.find(candidateCharacter => Number(candidateCharacter.id) === syncedCharId);
        if (characterRecord) {
            characterRecord.concealed_fields = syncedConcealedFields;
            if (typeof updateDossierWidget === 'function') {
                updateDossierWidget(characterRecord);
            }
        }
        const privacyNavSubElement = document.getElementById('sheetNavSubPrivacy');
        if (privacyNavSubElement) {
            privacyNavSubElement.textContent = syncedConcealedFields.length > 0
                ? `${syncedConcealedFields.length} Redacted • Click Sheet`
                : 'Click Sheet Fields to Redact';
        }
        return;
    }

    if (messageEventObject.data.type === 'vtm:xp_badge_sync') {
        const availableXpCount = Number(messageEventObject.data.availableXp ?? 0);
        const spentXpCount = Number(messageEventObject.data.spentXp ?? 0);
        const totalXpCount = Number(messageEventObject.data.totalXp ?? 0);
        const isXpDrawerOpen = Boolean(messageEventObject.data.xpDrawerOpen);
        const isPrivacyDrawerOpen = Boolean(messageEventObject.data.privacyDrawerOpen);
        const isPlayerBaseUnlocked = Boolean(messageEventObject.data.playerBaseEditUnlocked);
        const syncedConcealedFields = Array.isArray(messageEventObject.data.concealedFields)
            ? messageEventObject.data.concealedFields
            : [];
        const isCompliant = Boolean(messageEventObject.data.isCompliant);
        const issueCount = Number(messageEventObject.data.issueCount ?? 0);
        const complianceChecksList = Array.isArray(messageEventObject.data.complianceChecks) ? messageEventObject.data.complianceChecks : [];
        const complianceIssuesList = Array.isArray(messageEventObject.data.complianceIssues) ? messageEventObject.data.complianceIssues : [];
        const preSnapshotSkillCandidates = Array.isArray(messageEventObject.data.preSnapshotSkillCandidates) ? messageEventObject.data.preSnapshotSkillCandidates : [];
        const xpLogEntries = Array.isArray(messageEventObject.data.xpLog) ? messageEventObject.data.xpLog : [];

        // Update the 'Unlock Base Dots for Player' / 'Lock & Snapshot Base Dots' toggle button inside Storyteller & Settings
        const playerBaseUnlockBtn = document.getElementById('btnSettingsTogglePlayerBaseUnlock');
        if (playerBaseUnlockBtn) {
            if (isPlayerBaseUnlocked) {
                playerBaseUnlockBtn.innerHTML = `<i class="fa-solid fa-lock"></i> Lock &amp; Snapshot Base Dots (Currently Unlocked for Player)`;
                playerBaseUnlockBtn.style.borderColor = '#10b981';
                playerBaseUnlockBtn.style.background = 'rgba(16, 185, 129, 0.22)';
                playerBaseUnlockBtn.style.color = '#6ee7b7';
            } else {
                playerBaseUnlockBtn.innerHTML = `<i class="fa-solid fa-lock-open"></i> Unlock Base Dots for Player (0 XP Blank Sheet Setup)`;
                playerBaseUnlockBtn.style.borderColor = '#f59e0b';
                playerBaseUnlockBtn.style.background = 'rgba(245, 158, 11, 0.14)';
                playerBaseUnlockBtn.style.color = '#fcd34d';
            }
        }

        // Update the top identity XP badge in the Left Sidebar ('Brujah • 37 XP')
        const sidebarXpBadgeElement = document.getElementById('modalSidebarXpBadge');
        if (sidebarXpBadgeElement) {
            sidebarXpBadgeElement.textContent = `${availableXpCount} XP`;
        }

        // Update the 'Experience & Upgrades' tab subtitle in the Left Sidebar
        const modalExperienceLabelElement = document.getElementById('modalXpBtnLabel');
        if (modalExperienceLabelElement) {
            modalExperienceLabelElement.textContent = `${availableXpCount} XP Available`;
        }

        // Update the 'Privacy & Redactions' tab subtitle in the Left Sidebar
        const privacyNavSubElement = document.getElementById('sheetNavSubPrivacy');
        if (privacyNavSubElement) {
            privacyNavSubElement.textContent = syncedConcealedFields.length > 0
                ? `${syncedConcealedFields.length} Redacted • Click Sheet`
                : 'Click Sheet Fields to Redact';
        }

        // Update inline XP summary pills inside the Settings panel
        const xpTotalValElement = document.getElementById('settingsXpTotalVal');
        const xpSpentValElement = document.getElementById('settingsXpSpentVal');
        const xpAvailValElement = document.getElementById('settingsXpAvailVal');
        if (xpTotalValElement) xpTotalValElement.textContent = String(totalXpCount);
        if (xpSpentValElement) xpSpentValElement.textContent = String(spentXpCount);
        if (xpAvailValElement) xpAvailValElement.textContent = String(availableXpCount);

        // If the user clicked '✖ Close' on the green XP bar or '✔ Done Editing Privacy' on the purple Privacy bar, sync the sidebar tab highlight back to 'Character Sheet'
        if (!isXpDrawerOpen && currentSheetModalSidebarTab === 'xp') {
            currentSheetModalSidebarTab = 'sheet';
            const tabSheetButton = document.getElementById('sheetNavTabSheet');
            const tabXpButton = document.getElementById('btnModalExperienceToggle');
            if (tabSheetButton) tabSheetButton.classList.add('active');
            if (tabXpButton) tabXpButton.classList.remove('active');
        }
        if (!isPrivacyDrawerOpen && currentSheetModalSidebarTab === 'privacy') {
            currentSheetModalSidebarTab = 'sheet';
            const tabSheetButton = document.getElementById('sheetNavTabSheet');
            const tabPrivacyButton = document.getElementById('sheetNavTabPrivacy');
            if (tabSheetButton) tabSheetButton.classList.add('active');
            if (tabPrivacyButton) tabPrivacyButton.classList.remove('active');
        }

        // Update the V5 Base Rules Compliance badge inside the Storyteller & Settings panel
        const complianceBadgeElement = document.getElementById('btnModalComplianceStatus');
        if (complianceBadgeElement) {
            if (isCompliant) {
                complianceBadgeElement.innerHTML = `<i class="fa-solid fa-circle-check"></i> Compliant (${complianceChecksList.length}/${complianceChecksList.length})`;
                complianceBadgeElement.style.borderColor = '#10b981';
                complianceBadgeElement.style.background = 'rgba(16,185,129,0.15)';
                complianceBadgeElement.style.color = '#6ee7b7';
            } else {
                complianceBadgeElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${issueCount} Issue${issueCount === 1 ? '' : 's'}`;
                complianceBadgeElement.style.borderColor = '#f59e0b';
                complianceBadgeElement.style.background = 'rgba(245,158,11,0.18)';
                complianceBadgeElement.style.color = '#fde68a';
            }
        }

        // Populate the Pre-Snapshot 1-Dot Skill Upgrade Auto-Fix Banner if detected
        const skillAutoFixBoxElement = document.getElementById('settingsInlineSkillAutoFixBox');
        const skillAutoFixSelectElement = document.getElementById('settingsInlineSkillAutoFixSelect');
        const skillAutoFixDescElement = document.getElementById('settingsInlineSkillAutoFixDesc');
        if (skillAutoFixBoxElement && skillAutoFixSelectElement) {
            if (preSnapshotSkillCandidates.length > 0) {
                skillAutoFixBoxElement.style.display = 'block';
                if (skillAutoFixDescElement) {
                    skillAutoFixDescElement.textContent = `Base Skills have 1 extra dot above ${preSnapshotSkillCandidates[0].distributionLabel}. Choose which skill was upgraded to convert that dot into a Crimson Red XP Upgrade:`;
                }
                skillAutoFixSelectElement.innerHTML = preSnapshotSkillCandidates.map(candidate =>
                    `<option value="${escapeHtml(candidate.skillKey)}">${escapeHtml(candidate.skillName)} (Base ${candidate.toRating} → ${candidate.fromRating} + 1 Red XP Dot)</option>`
                ).join('');
            } else {
                skillAutoFixBoxElement.style.display = 'none';
            }
        }

        // Render the Inline V5 Base Rules Checklist inside the Settings panel
        const complianceListContainerElement = document.getElementById('settingsInlineComplianceList');
        if (complianceListContainerElement) {
            let checklistHtml = '';
            complianceIssuesList.forEach(issueItem => {
                checklistHtml += `
                    <div style="background:rgba(127,29,29,0.28); border:1px solid rgba(239,68,68,0.45); border-radius:6px; padding:8px 10px;">
                        <div style="font-size:12px; font-weight:bold; color:#fca5a5;"><i class="fa-solid fa-circle-xmark"></i> ${escapeHtml(issueItem.category || 'Rule Issue')}</div>
                        <div style="font-size:11px; color:#e5e7eb; margin-top:2px; line-height:1.35;">${escapeHtml(issueItem.detail || '')}</div>
                    </div>
                `;
            });
            complianceChecksList.forEach(passedItem => {
                checklistHtml += `
                    <div style="background:rgba(6,78,59,0.25); border:1px solid rgba(16,185,129,0.35); border-radius:6px; padding:7px 10px;">
                        <div style="font-size:12px; font-weight:bold; color:#6ee7b7;"><i class="fa-solid fa-circle-check"></i> ${escapeHtml(passedItem.category || 'Passed')}</div>
                        <div style="font-size:11px; color:#d1fae5; margin-top:2px; line-height:1.35;">${escapeHtml(passedItem.detail || '')}</div>
                    </div>
                `;
            });
            complianceListContainerElement.innerHTML = checklistHtml || '<div style="color:#6b7280; font-size:12px; padding:10px;">No compliance data available.</div>';
        }

        // Render the Inline XP History & Refunds List inside the Settings panel
        const xpLogListContainerElement = document.getElementById('settingsInlineXpLogList');
        if (xpLogListContainerElement) {
            if (xpLogEntries.length === 0) {
                xpLogListContainerElement.innerHTML = '<div style="color:#6b7280; font-style:italic; font-size:12px; padding:12px; text-align:center;">No Experience Point awards or purchases recorded yet.</div>';
            } else {
                xpLogListContainerElement.innerHTML = xpLogEntries.map((logEntry, entryIndex) => {
                    const formattedDate = logEntry.timestamp ? new Date(logEntry.timestamp).toLocaleDateString() : '';
                    let badgeColor = '#fca5a5';
                    let signPrefix = '';

                    if (logEntry.type === 'award') {
                        badgeColor = '#34d399';
                        signPrefix = `+${logEntry.amount} XP Awarded`;
                    } else if (logEntry.type === 'deduct') {
                        badgeColor = '#fbbf24';
                        signPrefix = `${logEntry.amount} XP Removed`;
                    } else if (logEntry.type === 'refund') {
                        badgeColor = '#60a5fa';
                        signPrefix = `Refunded (+${Math.abs(logEntry.cost || 0)} XP)`;
                    } else {
                        badgeColor = '#f87171';
                        signPrefix = `Spent ${logEntry.cost} XP`;
                    }

                    const descriptionText = escapeHtml(logEntry.label || logEntry.reason || 'XP Transaction');
                    const canRefund = logEntry.type === 'purchase' && !logEntry.refunded;
                    const refundButtonHtml = canRefund
                        ? `<button type="button" onclick="refundSheetXpEntryFromSettings(${entryIndex})" style="background:#7f1d1d; color:#fef2f2; border:1px solid #ef4444; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;">↩ Refund (+${logEntry.cost} XP)</button>`
                        : '';

                    return `
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:7px 10px; border-radius:5px; background:rgba(0,0,0,0.35); border:1px solid rgba(255,255,255,0.07); font-size:12px;">
                            <div style="display:flex; flex-direction:column; gap:2px; min-width:0;">
                                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                                    <strong style="color:${badgeColor};">${signPrefix}</strong> — <span style="color:#f3f4f6;">${descriptionText}</span>
                                </div>
                                <div style="font-size:10px; color:#9ca3af;">
                                    ${formattedDate}${logEntry.by ? ` • By ${escapeHtml(logEntry.by)}` : ''}${logEntry.refunded ? ' • <em>(Refunded)</em>' : ''}
                                </div>
                            </div>
                            ${refundButtonHtml}
                        </div>
                    `;
                }).join('');
            }
        }
    }
});


