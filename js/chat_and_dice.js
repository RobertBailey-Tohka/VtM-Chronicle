/**
 * Crimson Revelry Chat (widget-chat) and Dice Roller (widget-dice)
 */
// renderD10Svg(value, isHunger, state = 0) is provided by dice_animations.js


function initDiceWidgetDisplay() {
  // Query the DOM for the dice facets preview container element by its ID
  const facetsContainerElement = document.getElementById('diceFacetsDisplay');
  if (facetsContainerElement) {
    facetsContainerElement.innerHTML = [renderD10Svg(10, false), renderD10Svg(8, false), renderD10Svg(4, false), renderD10Svg(9, false), renderD10Svg(1, true)].join('');
  }
}

function executeDiceRoll() {
  // Query the DOM for the dice pool count input element by its ID
  const poolInputElement = document.getElementById('diceCount') || document.getElementById('dicePool');
  // Query the DOM for the hunger dice count input element by its ID
  const hungerInputElement = document.getElementById('diceHunger');
  // Query the DOM for the dice persona dropdown selector element by its ID
  const personaSelectElement = document.getElementById('dicePersonaSelect');
  // Query the DOM for the roller name input element by its ID
  const rollerNameInputElement = document.getElementById('diceRollerName');
  // Query the DOM for the secret roll checkbox input element by its ID
  const secretCheckboxElement = document.getElementById('diceSecret');
  const totalPool = Math.max(1, parseInt(poolInputElement ? poolInputElement.value : 6) || 1);
  const hunger = Math.max(0, parseInt(hungerInputElement ? hungerInputElement.value : 1) || 0);
  const isSecret = secretCheckboxElement ? secretCheckboxElement.checked : false;
  let rollerName = currentUser && (currentUser.displayName || currentUser.username) || (rollerNameInputElement ? rollerNameInputElement.value : 'Kindred');
  let characterId = null;
  let characterName = 'Action';
  let isStorytellerWorld = false;
  let selectedPersona = personaSelectElement ? personaSelectElement.value : '';
  if (!selectedPersona) {
    if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
      selectedPersona = 'storyteller_world';
    } else if (typeof activeDossierCharId !== 'undefined' && activeDossierCharId) {
      selectedPersona = String(activeDossierCharId);
    } else {
      selectedPersona = 'general_player';
    }
  }
  if (selectedPersona === 'storyteller_world') {
    if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
      isStorytellerWorld = true;
      rollerName = 'Storyteller';
      characterName = 'Storyteller / World';
    } else {
      characterName = rollerName;
    }
  } else if (selectedPersona === 'general_player') {
    characterName = rollerName;
  } else {
    characterId = parseInt(selectedPersona, 10);
    const characterRecord = chronicleCharactersList.find(characterItem => Number(characterItem.id) === Number(characterId));
    if (characterRecord) {
      characterName = characterRecord.name;
      if ((activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) {
        rollerName = `Storyteller (for ${characterRecord.name})`;
      } else {
        rollerName = characterRecord.name;
      }
    }
  }
  
  if (socket) {
    // Emit a Socket.IO event to the server to request a dice roll calculation and broadcast
    socket.emit('dice:roll', {
      campaignId: activeChronicleId || 6,
      chronicleId: activeChronicleId || 6,
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
  // Query the DOM for the dice persona dropdown selector element by its ID
  const personaSelectElement = document.getElementById('dicePersonaSelect');
  let rollerName = currentUser && (currentUser.displayName || currentUser.username) || 'Kindred';
  let characterName = 'Rouse Check';
  let characterId = null;
  let isStorytellerWorld = false;
  let selectedPersona = personaSelectElement ? personaSelectElement.value : '';
  if (!selectedPersona) {
    if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
      selectedPersona = 'storyteller_world';
    } else if (typeof activeDossierCharId !== 'undefined' && activeDossierCharId) {
      selectedPersona = String(activeDossierCharId);
    } else {
      selectedPersona = 'general_player';
    }
  }
  if (selectedPersona === 'storyteller_world') {
    if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
      isStorytellerWorld = true;
      rollerName = 'Storyteller';
      characterName = 'Storyteller (Rouse)';
    } else {
      characterName = `${rollerName} (Rouse)`;
    }
  } else if (selectedPersona === 'general_player') {
    characterName = `${rollerName} (Rouse)`;
  } else {
    characterId = parseInt(selectedPersona, 10);
    const characterRecord = chronicleCharactersList.find(characterItem => Number(characterItem.id) === Number(characterId));
    if (characterRecord) {
      characterName = `${characterRecord.name} (Rouse)`;
      if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
        rollerName = `Storyteller (for ${characterRecord.name})`;
      } else {
        rollerName = characterRecord.name;
      }
    }
  }
  if (socket) {
    // Emit a Socket.IO event to the server to perform a single-die Rouse Check roll
    socket.emit('dice:roll', {
      campaignId: activeChronicleId || 6,
      chronicleId: activeChronicleId || 6,
      rollerName,
      characterId: characterId,
      characterName: characterName,
      poolSize: 1,
      hungerCount: 1,
      isSecret: false,
      isStorytellerWorld
    });
  }
}

async function loadRecentRolls() {
  if (!activeChronicleId) return;
  try {
    // Send an authenticated HTTP GET request to fetch recent dice rolls for the active chronicle
    const fetchResponse = await authFetch(`/api/rolls?campaign_id=${activeChronicleId}`);
    if (!fetchResponse.ok) return;
    // Parse the JSON array of roll records from the HTTP response
    const rollRecords = await fetchResponse.json();
    // Query the DOM for the chat message stream container by its ID
    const chatStreamElement = document.getElementById('chatMessagesStream');
    if (chatStreamElement) {
      // Query all existing roll channel elements inside the chat stream and remove them
      chatStreamElement.querySelectorAll('.channel-rolls').forEach(rollChannelElement => rollChannelElement.remove());
    }
    // Query the DOM for the dice ledger container element by its ID
    const diceLedgerElement = document.getElementById('diceLedger');
    if (diceLedgerElement) diceLedgerElement.innerHTML = '';
    rollRecords.slice().reverse().forEach(rollRecord => appendDiceRollToLedger(rollRecord, false));
  } catch (errorObject) {
    console.error('Failed to load recent rolls:', errorObject);
  }
}

function appendDiceRollToLedger(rollRecord, scrollChat = true) {
  const regularDice = rollRecord.regular_results ? rollRecord.regular_results.toString().split(',').filter(Boolean) : [];
  const hungerDice = rollRecord.hunger_results ? rollRecord.hunger_results.toString().split(',').filter(Boolean) : [];
  let diceHtml = '';
  regularDice.forEach(dieValue => {
    diceHtml += renderD10Svg(dieValue, false);
  });
  hungerDice.forEach(dieValue => {
    diceHtml += renderD10Svg(dieValue, true);
  });
  const isSecretBadge = rollRecord.is_secret ? '<span style="color:#d97706;font-size:10px;"><i class="fa-solid fa-eye-slash"></i> SECRET</span>' : '';
  const resultTypeRaw = rollRecord.result_type || 'SUCCESS';
  const resultTypeLabel = resultTypeRaw.replace('_', ' ').toUpperCase();
  const formattedTimeString = rollRecord.timestamp || rollRecord.created_at ? new Date(rollRecord.timestamp || rollRecord.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  // Query the DOM for the chat message stream container by its ID
  const chatStreamElement = document.getElementById('chatMessagesStream');
  if (chatStreamElement) {
    // Create a new div element in the DOM to represent the roll card inside the chat stream
    const chatEntryElement = document.createElement('div');
    chatEntryElement.className = 'chat-msg-entry channel-rolls roll-chat-card';
    chatEntryElement.dataset.channel = 'rolls';
    if (currentChatChannel !== 'all' && currentChatChannel !== 'rolls') {
      chatEntryElement.style.display = 'none';
    }
    const hitsLabel = `${rollRecord.successes || 0} Hits`;
    const difficultyLabel = rollRecord.difficulty ? `Diff ${rollRecord.difficulty}` : '';
    chatEntryElement.innerHTML = `
            <div class="chat-msg-header">
                <span class="chat-msg-author author-roll"><i class="fa-solid fa-dice-d20" style="color:#ef4444;margin-right:4px;"></i> ${escapeHtml(rollRecord.roller_name || 'Storyteller')} ${isSecretBadge}</span>
                <span class="chat-msg-time">${formattedTimeString}</span>
            </div>
            <div class="chat-roll-body">
                <div class="chat-roll-summary">
                    <span class="badge-result badge-${resultTypeRaw.toLowerCase()}">${resultTypeLabel}</span>
                    <span class="chat-roll-meta">${hitsLabel}${difficultyLabel ? ' • ' + difficultyLabel : ''}</span>
                </div>
                <div class="chat-roll-dice-grid">
                    ${diceHtml}
                </div>
            </div>
        `;
    chatStreamElement.appendChild(chatEntryElement);
    if (scrollChat && (currentChatChannel === 'rolls' || currentChatChannel === 'all')) {
      chatStreamElement.scrollTop = chatStreamElement.scrollHeight;
    }
    // Query the DOM for the dice ledger container element by its ID
    const diceLedgerElement = document.getElementById('diceLedger');
    if (diceLedgerElement) {
      // Create a new div element in the DOM to represent the roll entry in the dice ledger
      const ledgerEntryElement = document.createElement('div');
      ledgerEntryElement.className = 'roll-entry';
      ledgerEntryElement.innerHTML = `
            <div class="roll-header">
                <span class="roll-roller">${escapeHtml(rollRecord.roller_name || 'Storyteller')} ${isSecretBadge}</span>
                <span class="badge-result badge-${resultTypeRaw.toLowerCase()}">${resultTypeLabel} (${rollRecord.successes} Hits / Diff ${rollRecord.difficulty})</span>
            </div>
            <div class="roll-dice-display">${diceHtml}</div>
        `;
      diceLedgerElement.prepend(ledgerEntryElement);
    }
    // Query the DOM for the dice facets display container element by its ID
    const facetsContainerElement = document.getElementById('diceFacetsDisplay');
    if (facetsContainerElement) {
      facetsContainerElement.innerHTML = '';
      const allDice = [...regularDice.map(dieValue => ({
        dieValue,
        isHunger: false
      })), ...hungerDice.map(dieValue => ({
        dieValue,
        isHunger: true
      }))];
      allDice.forEach(dieObject => {
        facetsContainerElement.innerHTML += renderD10Svg(dieObject.dieValue, dieObject.isHunger);
      });
    }
    // Query the DOM for the dice result text list element by its ID
    const resultListElement = document.getElementById('diceResultDiceList');
    if (resultListElement) {
      const fullList = [...regularDice, ...hungerDice.map(hungerDieValue => `${hungerDieValue} (Hunger)`)].join(', ');
      resultListElement.innerText = fullList || 'None';
    }
    // Query the DOM for the dice result success count badge element by its ID
    const resultCountElement = document.getElementById('diceResultSuccessCount');
    if (resultCountElement) {
      resultCountElement.className = `badge-success-count badge-${resultTypeRaw.toLowerCase()}`;
      resultCountElement.innerText = `${rollRecord.successes || 0} Successes (${resultTypeLabel})`;
    }
  }
}


function populateDicePersonaSelector() {
  // Query the DOM for the dice persona dropdown selector element by its ID
  const personaSelectElement = document.getElementById('dicePersonaSelect');
  if (!personaSelectElement) return;
  personaSelectElement.innerHTML = '';
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (isStoryteller) {
    // Create a new option element in the DOM for the default Storyteller / World persona
    const storytellerOptionElement = document.createElement('option');
    storytellerOptionElement.value = 'storyteller_world';
    storytellerOptionElement.innerText = 'Storyteller / World (Pure RNG)';
    personaSelectElement.appendChild(storytellerOptionElement);
    const playerCharacters = chronicleCharactersList.filter(characterRecord => characterRecord.category === 'pc');
    if (playerCharacters.length > 0) {
      // Create a new optgroup element in the DOM to group Player Characters in the dropdown
      const playerCharacterOptGroup = document.createElement('optgroup');
      playerCharacterOptGroup.label = 'Player Characters';
      playerCharacters.forEach(characterRecord => {
        // Create a new option element in the DOM for each Player Character
        const optionElement = document.createElement('option');
        optionElement.value = String(characterRecord.id);
        optionElement.innerText = `${characterRecord.name} [Player: ${characterRecord.player_name || 'Unassigned'}]`;
        playerCharacterOptGroup.appendChild(optionElement);
      });
      personaSelectElement.appendChild(playerCharacterOptGroup);
    }
    const nonPlayerCharacters = chronicleCharactersList.filter(characterRecord => characterRecord.category !== 'pc');
    if (nonPlayerCharacters.length > 0) {
      // Create a new optgroup element in the DOM to group NPCs in the dropdown
      const npcOptGroup = document.createElement('optgroup');
      npcOptGroup.label = 'NPC Cast & Personas';
      nonPlayerCharacters.forEach(characterRecord => {
        // Create a new option element in the DOM for each NPC
        const optionElement = document.createElement('option');
        optionElement.value = String(characterRecord.id);
        optionElement.innerText = `${characterRecord.name} (${characterRecord.clan || 'NPC'})`;
        npcOptGroup.appendChild(optionElement);
      });
      personaSelectElement.appendChild(npcOptGroup);
    }
    if (activeNpcPersonaId) {
      personaSelectElement.value = String(activeNpcPersonaId);
    } else if (activeControlledCharacterId) {
      personaSelectElement.value = String(activeControlledCharacterId);
    } else {
      personaSelectElement.value = 'storyteller_world';
    }
  } else {
    const ownedOrAuthorizedCharacters = chronicleCharactersList.filter(characterRecord => {
      const authorizedUserIds = Array.isArray(characterRecord.authorized_user_ids) ? characterRecord.authorized_user_ids : [];
      return currentUser && (characterRecord.user_id === currentUser.id || authorizedUserIds.includes(currentUser.id));
    });
    if (ownedOrAuthorizedCharacters.length === 0) {
      // Create a fallback option element in the DOM when the player has no assigned characters
      const optionElement = document.createElement('option');
      optionElement.value = 'general_player';
      optionElement.innerText = currentUser ? currentUser.displayName || currentUser.username : 'Kindred';
      personaSelectElement.appendChild(optionElement);
    } else {
      ownedOrAuthorizedCharacters.forEach(characterRecord => {
        // Create an option element in the DOM for each character the player owns or pilots
        const optionElement = document.createElement('option');
        optionElement.value = String(characterRecord.id);
        const isPrimary = currentUser && characterRecord.user_id === currentUser.id;
        optionElement.innerText = `${characterRecord.name} ${isPrimary ? '(Owner)' : '(Authorized Pilot)'}`;
        personaSelectElement.appendChild(optionElement);
      });
      if (activeControlledCharacterId && ownedOrAuthorizedCharacters.some(characterRecord => characterRecord.id === activeControlledCharacterId)) {
        personaSelectElement.value = String(activeControlledCharacterId);
      } else if (ownedOrAuthorizedCharacters.length > 0) {
        personaSelectElement.value = String(ownedOrAuthorizedCharacters[0].id);
        activeControlledCharacterId = ownedOrAuthorizedCharacters[0].id;
      }
    }
  }
}

function handleDicePersonaChange(selectedPersonaValue) {
  if (selectedPersonaValue === 'storyteller_world' || selectedPersonaValue === 'general_player') {
    selectStorytellerDefaultPersona();
    return;
  }
  const characterId = parseInt(selectedPersonaValue, 10);
  if (!isNaN(characterId)) {
    const characterRecord = chronicleCharactersList.find(characterItem => characterItem.id === characterId);
    if (characterRecord && characterRecord.category !== 'pc' && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) {
      selectNpcPersona(characterId);
    } else {
      assumeActiveControl(characterId);
    }
  }
  let newCharAvatarDataUrl = null;
}


function initFloatingChatDraggable() {
  // Query the DOM for the floating chat drag handle element by its ID
  const dragHandleElement = document.getElementById('glassChatDragHandle');
  // Query the DOM for the floating glass chat container element by its ID
  const chatBoxElement = document.getElementById('floatingGlassChat');
  if (!dragHandleElement || !chatBoxElement) return;
  dragHandleElement.onmousedown = mouseEvent => {
    if (mouseEvent.target.tagName === 'BUTTON' || mouseEvent.target.classList.contains('btn-chat-min')) return;
    isChatDragging = true;
    // Measure the current screen bounding rectangle of the floating chat box via the browser DOM API
    const chatBoxBoundingRect = chatBoxElement.getBoundingClientRect();
    chatDragOffset.x = mouseEvent.clientX - chatBoxBoundingRect.left;
    chatDragOffset.y = mouseEvent.clientY - chatBoxBoundingRect.top;
  };
}

function handleChatDragMove(mouseEvent) {
  if (!isChatDragging) return;
  // Query the DOM for the floating glass chat container element by its ID
  const chatBoxElement = document.getElementById('floatingGlassChat');
  if (!chatBoxElement) return;
  // Query the DOM for the main canvas viewport element by its ID
  const canvasViewportElement = document.getElementById('canvasViewport');
  // Measure the bounding rectangle of the viewport (or fall back to window dimensions)
  const viewportBoundingRect = canvasViewportElement ? canvasViewportElement.getBoundingClientRect() : {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight
  };
  const newLeft = Math.max(10, Math.min(mouseEvent.clientX - viewportBoundingRect.left - chatDragOffset.x, viewportBoundingRect.width - 380));
  const newTop = Math.max(10, Math.min(mouseEvent.clientY - viewportBoundingRect.top - chatDragOffset.y, viewportBoundingRect.height - 60));
  chatBoxElement.style.left = `${newLeft}px`;
  chatBoxElement.style.top = `${newTop}px`;
  chatBoxElement.style.right = 'auto';
}

function toggleChatCollapse() {
  // Query the DOM for the floating glass chat container element by its ID
  const chatBoxElement = document.getElementById('floatingGlassChat');
  if (chatBoxElement) chatBoxElement.classList.toggle('minimized');
}

function toggleChatVisibility() {
  // Query the DOM for the floating glass chat container element by its ID
  const chatBoxElement = document.getElementById('floatingGlassChat');
  if (!chatBoxElement) return;
  if (chatBoxElement.style.display === 'none') {
    chatBoxElement.style.display = 'flex';
  } else {
    chatBoxElement.style.display = 'none';
  }
}

function switchChatChannel(channelName) {
  currentChatChannel = channelName;
  // Query all chat channel tab buttons in the DOM and remove the active highlight class
  document.querySelectorAll('.chat-tab-btn').forEach(tabButtonElement => tabButtonElement.classList.remove('active'));
  // Query the DOM for the selected chat channel tab button by its ID
  const targetTabButtonElement = document.getElementById(`chatTab-${channelName}`);
  if (targetTabButtonElement) targetTabButtonElement.classList.add('active');
  // Query all chat message entry elements in the DOM to filter visibility by channel
  const chatMessageElements = document.querySelectorAll('.chat-msg-entry');
  chatMessageElements.forEach(messageElement => {
    if (channelName === 'all' || messageElement.dataset.channel === channelName) {
      messageElement.style.display = 'block';
    } else {
      messageElement.style.display = 'none';
    }
  });
  // Query the DOM for the chat input bar element by ID or CSS class
  const chatInputBarElement = document.getElementById('chatInputBar') || document.querySelector('.chat-input-bar');
  // Query the DOM for the read-only rolls channel notice element by its ID
  const rollsNoticeElement = document.getElementById('chatRollsNotice');
  if (channelName === 'rolls') {
    if (chatInputBarElement) chatInputBarElement.style.display = 'none';
    if (rollsNoticeElement) rollsNoticeElement.style.display = 'flex';
  } else {
    if (chatInputBarElement) chatInputBarElement.style.display = 'flex';
    if (rollsNoticeElement) rollsNoticeElement.style.display = 'none';
  }
  // Query the DOM for the chat message stream container by its ID
  const chatStreamElement = document.getElementById('chatMessagesStream');
  if (chatStreamElement) chatStreamElement.scrollTop = chatStreamElement.scrollHeight;
}

function updateChatSenderBadge() {
  // Query the DOM for the chat sender badge label element by its ID
  const senderLabelElement = document.getElementById('chatSenderLabel');
  if (!senderLabelElement) return;
  if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
    // Query the DOM for the GM persona select dropdown element by its ID
    const gmPersonaSelectElement = document.getElementById('gmPersonaSelect');
    const selectedPersonaName = gmPersonaSelectElement ? gmPersonaSelectElement.value : 'Storyteller';
    senderLabelElement.innerText = `Speaking as: ${selectedPersonaName}`;
  } else {
    const senderDisplayName = currentUser && (currentUser.displayName || currentUser.username) || 'Player';
    senderLabelElement.innerText = `Speaking as: ${senderDisplayName}`;
  }
}

async function loadChatMessages() {
  if (!activeChronicleId) return;
  try {
    // Send an authenticated HTTP GET request to load chat history for the active chronicle
    const fetchResponse = await authFetch(`/api/chat/messages?campaign_id=${activeChronicleId}`);
    if (!fetchResponse.ok) return;
    // Parse the JSON array of chat messages from the HTTP response
    const chatMessages = await fetchResponse.json();
    // Query the DOM for the chat message stream container by its ID
    const chatStreamElement = document.getElementById('chatMessagesStream');
    if (!chatStreamElement) return;
    // Remove only non-roll chat messages so dice roll history cards (.channel-rolls) in the stream are preserved
    chatStreamElement.querySelectorAll('.chat-msg-entry:not(.channel-rolls)').forEach(el => el.remove());
    chatMessages.forEach(messageData => appendChatMessage(messageData, false));
    chatStreamElement.scrollTop = chatStreamElement.scrollHeight;
  } catch (errorObject) {
    console.error('Failed to load chat messages:', errorObject);
  }
}

async function sendChatMessageSubmit(submitEvent) {
  submitEvent.preventDefault();
  if (currentChatChannel === 'rolls') return;
  // Query the DOM for the chat message text input element by its ID
  const chatTextInputElement = document.getElementById('chatInputText');
  const trimmedMessageText = chatTextInputElement.value.trim();
  if (!trimmedMessageText || !activeChronicleId) return;
  let senderName = currentUser ? currentUser.displayName || currentUser.username : 'Wanderer';
  if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') {
    // Query the DOM for the GM persona select dropdown element by its ID
    const gmPersonaSelectElement = document.getElementById('gmPersonaSelect');
    if (gmPersonaSelectElement && gmPersonaSelectElement.value) senderName = gmPersonaSelectElement.value;
  }
  try {
    // Send an authenticated HTTP POST request to persist and broadcast the new chat message
    const fetchResponse = await authFetch('/api/chat/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicle_id: activeChronicleId,
        channel: currentChatChannel,
        sender_name: senderName,
        sender_role: activeChronicleRole,
        message: trimmedMessageText
      })
    });
    if (fetchResponse.ok) {
      chatTextInputElement.value = '';
    }
  } catch (errorObject) {
    console.error('Failed to send chat message:', errorObject);
  }
}

function appendChatMessage(messageData, shouldScroll = true) {
  // Query the DOM for the chat message stream container by its ID
  const chatStreamElement = document.getElementById('chatMessagesStream');
  if (!chatStreamElement) return;
  // Create a new div element in the DOM to hold the single chat message entry
  const messageEntryElement = document.createElement('div');
  messageEntryElement.className = `chat-msg-entry channel-${messageData.channel}`;
  messageEntryElement.dataset.channel = messageData.channel;
  const isCurrentChannel = currentChatChannel === 'all' || currentChatChannel === messageData.channel;
  if (!isCurrentChannel) {
    messageEntryElement.style.display = 'none';
  }
  const formattedTimeString = messageData.created_at ? new Date(messageData.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';
  const isStorytellerSender = messageData.sender_role === 'gm' || messageData.sender_role === 'storyteller';
  const roleTag = isStorytellerSender ? '<span class="chat-role-gm">GM</span>' : '';
  messageEntryElement.innerHTML = `
        <div class="chat-msg-header">
            <span class="chat-msg-author ${isStorytellerSender ? 'author-gm' : ''}">${roleTag} ${escapeHtml(messageData.sender_name)}</span>
            <span class="chat-msg-time">${formattedTimeString}</span>
        </div>
        <div class="chat-msg-text">${escapeHtml(messageData.message)}</div>
    `;
  chatStreamElement.appendChild(messageEntryElement);
  if (shouldScroll) chatStreamElement.scrollTop = chatStreamElement.scrollHeight;
}

function toggleFloatingDiceTray() {
  // Query the DOM for the floating dice modal element by its ID
  const floatingDiceModalElement = document.getElementById('floatingDiceModal');
  if (floatingDiceModalElement) floatingDiceModalElement.classList.toggle('active');
}
