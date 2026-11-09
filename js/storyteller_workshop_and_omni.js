/**
 * Storyteller Workshop (tab-storyteller-workshop), Storyteller Omni (widget-storyteller-omni), and Chronicle Timeline (widget-chronicle-timeline)
 */
async function loadCampaignsList() {
  try {
    // Perform an authenticated HTTP GET request to fetch all chronicles from the server API
    const fetchResponse = await authFetch('/api/chronicles');
    // Parse the JSON response body into an array of chronicle records
    const chroniclesList = await fetchResponse.json();
    allChroniclesData = chroniclesList;
    // Look up the chronicle dropdown select element in the DOM by its ID
    const chronicleSelectElement = document.getElementById('chronicleSelect');
    if (!chronicleSelectElement) return;
    chronicleSelectElement.innerHTML = '';
    chroniclesList.forEach(chronicleRecord => {
      // Create a new HTML <option> element in memory for the chronicle dropdown
      const optionElement = document.createElement('option');
      optionElement.value = chronicleRecord.id;
      optionElement.innerText = `${chronicleRecord.title} (${chronicleRecord.setting_city}, ${chronicleRecord.setting_year})`;
      if (chronicleRecord.id === activeChronicleId) optionElement.selected = true;
      // Append the newly created option element into the chronicle select dropdown
      chronicleSelectElement.appendChild(optionElement);
    });
    if (chroniclesList.length > 0) {
      const targetChronicleRecord = chroniclesList.find(chronicleRecord => chronicleRecord.id === activeChronicleId) || chroniclesList[0];
      activeChronicleId = targetChronicleRecord.id;
      displayCampaignOverview(targetChronicleRecord);
      // Look up the sub-campaign dropdown select element in the DOM by its ID
      const campaignSelectElement = document.getElementById('campaignSelect');
      campaignSelectElement.innerHTML = '';
      if (targetChronicleRecord.campaigns && targetChronicleRecord.campaigns.length > 0) {
        targetChronicleRecord.campaigns.forEach(campaignRecord => {
          // Create a new HTML <option> element in memory for the sub-campaign dropdown
          const optionElement = document.createElement('option');
          optionElement.value = campaignRecord.id;
          optionElement.innerText = campaignRecord.title;
          if (campaignRecord.id === activeSubCampaignId) optionElement.selected = true;
          // Append the newly created option element into the sub-campaign select dropdown
          campaignSelectElement.appendChild(optionElement);
        });
        const targetCampaignRecord = targetChronicleRecord.campaigns.find(campaignRecord => campaignRecord.id === activeSubCampaignId) || targetChronicleRecord.campaigns[0];
        activeSubCampaignId = targetCampaignRecord.id;
        renderEpisodesList(targetCampaignRecord.episodes || []);
        if (targetCampaignRecord.episodes && targetCampaignRecord.episodes.length > 0) {
          const preferredEpisodeId = (activeEpisodeId && activeEpisodeId !== 1)
            ? activeEpisodeId
            : (window.liveGameboardEpisodeId || 12);
          const targetEpisodeRecord =
            targetCampaignRecord.episodes.find(episodeRecord => Number(episodeRecord.id) === Number(preferredEpisodeId)) ||
            targetCampaignRecord.episodes.find(episodeRecord => episodeRecord.status === 'active') ||
            targetCampaignRecord.episodes[0];
          loadEpisodeDetails(targetEpisodeRecord.id);
        } else {
          activeEpisodeId = null;
          currentEpisodeData = null;
          clearEpisodeDetailsPane();
          // Look up the episode cards list container in the DOM and display an empty state message
          document.getElementById('episodeCardsList').innerHTML = '<p>No episodes in this campaign.</p>';
        }
      } else {
        activeEpisodeId = null;
        currentEpisodeData = null;
        clearEpisodeDetailsPane();
        campaignSelectElement.innerHTML = '<option value="">No Campaigns</option>';
        // Look up the episode cards list container in the DOM and display an empty state message
        document.getElementById('episodeCardsList').innerHTML = '<p>No campaigns found.</p>';
      }
      loadCoterieManagement();
    }
  } catch (errorObject) {
    // Log the error details to the browser developer console
    console.error('Failed to load chronicles:', errorObject);
  }
}

async function renameChronicle() {
  if (!activeChronicleId) return;
  const chronicleRecord = allChroniclesData.find(candidateChronicle => candidateChronicle.id === activeChronicleId);
  if (!chronicleRecord) return;
  // Display a styled VTM prompt dialog asking the user for a new chronicle name
  const promptedChronicleName = await vtmPrompt('Enter new name for the Chronicle:', 'Rename Chronicle', chronicleRecord.title || '');
  if (promptedChronicleName === null) return;
  
  // Display a styled VTM prompt dialog asking the user for the setting city
  const promptedSettingCity = await vtmPrompt('Enter setting location/city:', 'Chronicle Setting City', chronicleRecord.setting_city || '');
  if (promptedSettingCity === null) return;
  
  // Display a styled VTM prompt dialog asking the user for the setting year
  const promptedSettingYear = await vtmPrompt('Enter setting year:', 'Chronicle Setting Year', chronicleRecord.setting_year || '');
  if (promptedSettingYear === null) return;
  
  const finalChronicleTitle = promptedChronicleName.trim() || chronicleRecord.title;
  
  try {
    // Perform an authenticated HTTP PUT request to update the chronicle metadata on the server
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // Serialize the updated chronicle properties into a JSON string payload
      body: JSON.stringify({ title: finalChronicleTitle, setting_city: promptedSettingCity.trim(), setting_year: promptedSettingYear.trim() })
    });
    if (fetchResponse.ok) {
      vtmAlert('Chronicle updated.', 'Success');
      loadCampaignsList();
    } else {
      vtmAlert('Failed to update chronicle.', 'Error');
    }
  } catch (errorObject) {
    // Log any network or unexpected error to the browser console
    console.error(errorObject);
  }
}

async function deleteChronicle() {
  if (!activeChronicleId) return;
  if (allChroniclesData.length <= 1) {
    vtmAlert('Cannot delete the last remaining Chronicle.', 'Error');
    return;
  }
  const isDeletionConfirmed = await vtmConfirm('Are you sure you want to delete this Chronicle and ALL its campaigns and episodes? This cannot be undone.', 'Delete Chronicle');
  if (!isDeletionConfirmed) return;
  
  try {
    // Perform an authenticated HTTP DELETE request to remove the active chronicle from the server
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}`, { method: 'DELETE' });
    if (fetchResponse.ok) {
      vtmAlert('Chronicle deleted.', 'Success');
      activeChronicleId = allChroniclesData.find(chronicleRecord => chronicleRecord.id !== activeChronicleId).id;
      loadCampaignsList();
    } else {
      vtmAlert('Failed to delete chronicle.', 'Error');
    }
  } catch (errorObject) {
    // Log any network or unexpected error to the browser console
    console.error(errorObject);
  }
}

async function renameCampaign() {
  if (!activeSubCampaignId || !activeChronicleId) return;
  const chronicleRecord = allChroniclesData.find(candidateChronicle => candidateChronicle.id === activeChronicleId);
  if (!chronicleRecord || !chronicleRecord.campaigns) return;
  const campaignRecord = chronicleRecord.campaigns.find(candidateCampaign => candidateCampaign.id === activeSubCampaignId);
  if (!campaignRecord) return;
  
  // Display a styled VTM prompt dialog asking the user for a new campaign name
  const promptedCampaignName = await vtmPrompt('Enter new name for the Campaign (Arc):', 'Rename Campaign / Arc', campaignRecord.title || '');
  if (!promptedCampaignName || promptedCampaignName.trim() === '' || promptedCampaignName === campaignRecord.title) return;
  
  try {
    // Perform an authenticated HTTP PUT request to rename the campaign on the server
    const fetchResponse = await authFetch(`/api/campaigns/${activeSubCampaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      // Serialize the updated campaign title into a JSON string payload
      body: JSON.stringify({ title: promptedCampaignName.trim() })
    });
    if (fetchResponse.ok) {
      vtmAlert('Campaign renamed.', 'Success');
      loadCampaignsList();
    } else {
      vtmAlert('Failed to rename campaign.', 'Error');
    }
  } catch (errorObject) {
    // Log any network or unexpected error to the browser console
    console.error(errorObject);
  }
}

async function deleteCampaign() {
  if (!activeSubCampaignId || !activeChronicleId) return;
  const chronicleRecord = allChroniclesData.find(candidateChronicle => candidateChronicle.id === activeChronicleId);
  if (!chronicleRecord || !chronicleRecord.campaigns) return;
  if (chronicleRecord.campaigns.length <= 1) {
    vtmAlert('Cannot delete the last remaining Campaign in this Chronicle.', 'Error');
    return;
  }
  const isDeletionConfirmed = await vtmConfirm('Are you sure you want to delete this Campaign and ALL its episodes? This cannot be undone.', 'Delete Campaign');
  if (!isDeletionConfirmed) return;
  
  try {
    // Perform an authenticated HTTP DELETE request to delete the sub-campaign on the server
    const fetchResponse = await authFetch(`/api/campaigns/${activeSubCampaignId}`, { method: 'DELETE' });
    if (fetchResponse.ok) {
      vtmAlert('Campaign deleted.', 'Success');
      activeSubCampaignId = chronicleRecord.campaigns.find(candidateCampaign => candidateCampaign.id !== activeSubCampaignId).id;
      loadCampaignsList();
    } else {
      vtmAlert('Failed to delete campaign.', 'Error');
    }
  } catch (errorObject) {
    // Log any network or unexpected error to the browser console
    console.error(errorObject);
  }
}

function switchChronicle(chronicleId) {
  activeChronicleId = parseInt(chronicleId);
  activeSubCampaignId = null;
  // Emit a Socket.IO event to join the real-time room for the newly selected chronicle
  socket.emit('room:join', activeChronicleId);
  loadCampaignsList();
  loadCharacters();
  loadGameboardState();
  loadRecentRolls();
}

function switchCampaign(campaignId) {
  activeSubCampaignId = parseInt(campaignId);
  const chronicleRecord = allChroniclesData.find(candidateChronicle => candidateChronicle.id === activeChronicleId);
  if (chronicleRecord && chronicleRecord.campaigns) {
    const campaignRecord = chronicleRecord.campaigns.find(candidateCampaign => candidateCampaign.id === activeSubCampaignId);
    if (campaignRecord) {
      renderEpisodesList(campaignRecord.episodes || []);
      if (campaignRecord.episodes && campaignRecord.episodes.length > 0) {
        loadEpisodeDetails(campaignRecord.episodes[0].id);
      } else {
        activeEpisodeId = null;
        currentEpisodeData = null;
        clearEpisodeDetailsPane();
        const episodeCardsListElement = document.getElementById('episodeCardsList');
        if (episodeCardsListElement) episodeCardsListElement.innerHTML = '<p>No episodes in this campaign.</p>';
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
  // Look up the new campaign modal element in the DOM by ID and add the 'active' CSS class to display it
  document.getElementById('newCampaignModal').classList.add('active');
}

function displayCampaignOverview(chronicleRecord) {
  currentChronicleData = chronicleRecord;
  // Look up the header session title element in the DOM by ID
  const sessionTitleElement = document.getElementById('headerSessionTitle');
  if (sessionTitleElement) sessionTitleElement.innerText = chronicleRecord.title.toUpperCase();
  // Look up the header chronicle title element in the DOM by ID
  const chronicleTitleElement = document.getElementById('headerChronicleTitle');
  if (chronicleTitleElement) chronicleTitleElement.innerText = chronicleRecord.title.toUpperCase();
  // Look up the header act label element in the DOM by ID (preserve active episode title if already loaded)
  const actLabelElement = document.getElementById('headerActLabel');
  if (actLabelElement) {
    if (window.liveGameboardSceneState && window.liveGameboardSceneState.active_episode_title) {
      const arcLabel = (window.liveGameboardSceneState.active_arc_title || 'ACT 1').toUpperCase();
      actLabelElement.innerText = `${arcLabel}: ${window.liveGameboardSceneState.active_episode_title.toUpperCase()}`;
    } else if (!actLabelElement.innerText || actLabelElement.innerText.trim() === '' || actLabelElement.innerText.trim() === 'ACT 1') {
      actLabelElement.innerText = 'ACT 1';
    }
  }
  // Look up the header chronicle metadata element in the DOM by ID
  const chronicleMetaElement = document.getElementById('headerChronicleMeta');
  if (chronicleMetaElement) chronicleMetaElement.innerText = `${chronicleRecord.setting_city} • ${chronicleRecord.setting_year} • Vampire: The Masquerade V5`;
  // Populate the campaign overview form inputs in the DOM if they exist
  if (document.getElementById('campPitch')) document.getElementById('campPitch').value = chronicleRecord.core_pitch || '';
  if (document.getElementById('campTenets')) document.getElementById('campTenets').value = chronicleRecord.chronicle_tenets || '';
  if (document.getElementById('campFactions')) document.getElementById('campFactions').value = chronicleRecord.main_factions || '';
  if (document.getElementById('campMaxChars')) document.getElementById('campMaxChars').value = chronicleRecord.max_characters_per_player || 2;
}

function saveCampaignDetails() {
  // Check whether the campaign pitch input element exists in the DOM before reading form values
  if (!document.getElementById('campPitch')) return;
  // Read the current values from the campaign overview input elements in the DOM
  const corePitchText = document.getElementById('campPitch').value;
  const chronicleTenetsText = document.getElementById('campTenets').value;
  const mainFactionsText = document.getElementById('campFactions').value;
  const maxCharactersPerPlayer = parseInt(document.getElementById('campMaxChars').value, 10) || 2;
  // Perform an authenticated HTTP PUT request to save the chronicle overview details to the server
  authFetch('/api/chronicles/' + activeChronicleId, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    // Serialize the updated overview fields into a JSON string payload
    body: JSON.stringify({
      core_pitch: corePitchText,
      chronicle_tenets: chronicleTenetsText,
      main_factions: mainFactionsText,
      max_characters_per_player: maxCharactersPerPlayer
    })
  }).then(fetchResponse => fetchResponse.json()).then(() => {
    // Display a native browser alert dialog confirming the overview details were saved
    alert('Campaign Overview details saved successfully!');
  });
}


let draggedEpisodeCard = null;
async function saveEpisodeOrder() {
    // Look up the episode cards list container element in the DOM by ID
    const episodeCardsListElement = document.getElementById('episodeCardsList');
    // Query all episode card item elements inside the list container and convert the NodeList to an Array
    const episodeCardElements = Array.from(episodeCardsListElement.querySelectorAll('.episode-card-item'));
    const orderedEpisodeIds = episodeCardElements.map(episodeCardElement => parseInt(episodeCardElement.dataset.id));
    
    episodeCardElements.forEach((episodeCardElement, cardIndex) => {
        // Find the episode number badge element inside the card
        const episodeNumberSpanElement = episodeCardElement.querySelector('.ep-num');
        if (episodeNumberSpanElement) episodeNumberSpanElement.innerText = `Ep ${cardIndex + 1}`;
    });
    
    // Retrieve the user's authentication token from the browser's localStorage
    const authenticationToken = localStorage.getItem('vtm_auth_token');
    try {
        // Send an HTTP PUT request using the browser Fetch API to persist the new episode order
        await fetch(`/api/campaigns/${activeChronicleId}/episodes/reorder`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authenticationToken ? 'Bearer ' + authenticationToken : ''
            },
            // Serialize the ordered array of episode IDs into a JSON payload
            body: JSON.stringify({ episode_ids: orderedEpisodeIds })
        });
    } catch(errorObject) {
        // Log any error that occurred while saving the episode order to the developer console
        console.error('Failed to save episode order:', errorObject);
    }
}

function updatePushEpisodeHeaderBtn() {
  const pushBtn = document.querySelector('.episode-details-pane button[onclick*="pushEpisodeToGameboard"]');
  if (!pushBtn) return;
  const isLive = Boolean(activeEpisodeId && window.liveGameboardEpisodeId && Number(activeEpisodeId) === Number(window.liveGameboardEpisodeId));
  if (isLive) {
    pushBtn.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> Active on Gameboard (Re-Push)';
    pushBtn.style.background = 'linear-gradient(135deg, #059669, #10b981)';
    pushBtn.style.borderColor = '#34d399';
    pushBtn.style.boxShadow = '0 0 12px rgba(16, 185, 129, 0.45)';
  } else {
    pushBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Push to Gameboard (Set Active)';
    pushBtn.style.background = '';
    pushBtn.style.borderColor = '';
    pushBtn.style.boxShadow = '';
  }
}

function renderEpisodesList(episodeRecordsList) {
  // Look up the episode cards list container in the DOM by ID
  const episodeCardsListElement = document.getElementById('episodeCardsList');
  if (!episodeCardsListElement) return;
  episodeCardsListElement.innerHTML = '';
  episodeRecordsList.forEach((episodeRecord, episodeIndex) => {
    const isSelected = Number(episodeRecord.id) === Number(activeEpisodeId);
    const isLiveOnBoard = Boolean(window.liveGameboardEpisodeId && Number(episodeRecord.id) === Number(window.liveGameboardEpisodeId));
    // Create a new <div> element in memory to represent the episode card
    const episodeCardElement = document.createElement('div');
    episodeCardElement.className = `episode-card-item ${isSelected ? 'active' : ''}`;
    if (isLiveOnBoard) {
      episodeCardElement.style.borderColor = 'rgba(16, 185, 129, 0.65)';
      episodeCardElement.style.boxShadow = 'inset 0 0 10px rgba(16, 185, 129, 0.15)';
    }
    episodeCardElement.onclick = () => loadEpisodeDetails(episodeRecord.id);
    episodeCardElement.draggable = true;
    episodeCardElement.dataset.id = episodeRecord.id;
    episodeCardElement.innerHTML = `
            <span class="ep-num" style="cursor: grab;">Ep ${episodeRecord.episode_number}</span>
            <div class="ep-meta" style="flex:1; cursor: pointer; display:flex; align-items:center; gap:6px; min-width:0;">
                <strong style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(episodeRecord.title || 'Untitled')}</strong>
                ${isLiveOnBoard ? '<span class="ep-live-badge" style="font-size:9px; font-weight:800; padding:1px 5px; border-radius:3px; background:rgba(16,185,129,0.2); color:#34d399; border:1px solid rgba(16,185,129,0.5); letter-spacing:0.5px; flex-shrink:0;">LIVE</span>' : ''}
            </div>
            <button class="btn-push-ep-card btn-action-outline btn-sm" onclick="event.stopPropagation(); pushEpisodeToGameboard(${episodeRecord.id})" style="padding:2px 6px; border:none; background:transparent; color:${isLiveOnBoard ? '#10b981' : '#f59e0b'};" title="${isLiveOnBoard ? 'Currently Active on Gameboard (Click to Re-Push)' : 'Push Episode to Gameboard'}">
                <i class="fa-solid fa-satellite-dish"></i>
            </button>
            <button class="btn-reveal-toggle btn-action-outline btn-sm" onclick="event.stopPropagation(); toggleEpisodeReveal(${episodeRecord.id}, ${!episodeRecord.revealed})" style="padding:2px 6px; border:none; background:transparent; color:${episodeRecord.revealed ? '#10b981' : '#6b7280'};" title="${episodeRecord.revealed ? 'Currently Revealed to Players. Click to Hide.' : 'Currently Hidden. Click to Reveal.'}">
                <i class="fa-solid ${episodeRecord.revealed ? 'fa-eye' : 'fa-eye-slash'}"></i>
            </button>
            <button class="btn-action-outline btn-sm text-danger" onclick="event.stopPropagation(); deleteEpisode(${episodeRecord.id}, event)" style="padding:2px 6px; border:none; background:transparent;" title="Delete Episode"><i class="fa-solid fa-trash"></i></button>
        `;
    
    // Attach a dragstart event listener to initiate drag-and-drop reordering for this card
    episodeCardElement.addEventListener('dragstart', (dragEventObject) => {
        draggedEpisodeCard = episodeCardElement;
        episodeCardElement.classList.add('dragging');
        dragEventObject.dataTransfer.effectAllowed = 'move';
        // Schedule a zero-delay timer to dim the card opacity after the browser captures the drag ghost image
        setTimeout(() => episodeCardElement.style.opacity = '0.5', 0);
    });
    
    // Attach a dragend event listener to clean up visual drag states once dropping finishes or cancels
    episodeCardElement.addEventListener('dragend', (dragEventObject) => {
        draggedEpisodeCard = null; episodeCardElement.classList.remove('dragging');
        episodeCardElement.style.opacity = '1';
        // Query all episode card items and clear their top and bottom drop-indicator borders
        episodeCardsListElement.querySelectorAll('.episode-card-item').forEach(cardElement => {
            cardElement.style.borderTop = '';
            cardElement.style.borderBottom = '';
        });
    });
    
    // Append the constructed episode card element into the episode list container in the DOM
    episodeCardsListElement.appendChild(episodeCardElement);
  });

  // Attach drag events to the list's parent container to catch drops in the empty space
  const episodeListContainerElement = episodeCardsListElement.parentElement;
  
  episodeCardsListElement.style.minHeight = '50px';
  episodeCardsListElement.style.paddingBottom = '20px'; 
  
  function getDragInsertionPoint(cursorVerticalPositionY) {
      // Query all episode card elements that are not currently being dragged
      const nonDraggingCardElements = Array.from(episodeCardsListElement.querySelectorAll('.episode-card-item:not(.dragging)'));
      let closestCardElement = null;
      let closestVerticalOffset = Number.POSITIVE_INFINITY;
      
      nonDraggingCardElements.forEach(candidateCardElement => {
          // Measure the on-screen bounding rectangle of the candidate card element
          const cardBoundingBox = candidateCardElement.getBoundingClientRect();
          const verticalOffsetFromCenter = cursorVerticalPositionY - (cardBoundingBox.top + cardBoundingBox.height / 2);
          if (verticalOffsetFromCenter > 0 && verticalOffsetFromCenter < closestVerticalOffset) {
              closestVerticalOffset = verticalOffsetFromCenter;
              closestCardElement = candidateCardElement;
          }
      });
      return closestCardElement;
  }
  
  // Attach a dragover event listener on the container to highlight the drop insertion position
  episodeListContainerElement.addEventListener('dragover', (dragEventObject) => {
      dragEventObject.preventDefault();
      dragEventObject.dataTransfer.dropEffect = 'move';
      
      // Clear any previous drop-indicator borders from all episode cards
      episodeCardsListElement.querySelectorAll('.episode-card-item').forEach(cardElement => { cardElement.style.borderTop = ''; cardElement.style.borderBottom = ''; });
      
      if (!draggedEpisodeCard) return;
      
      const insertAfterCardElement = getDragInsertionPoint(dragEventObject.clientY);
      
      if (insertAfterCardElement) {
          insertAfterCardElement.style.borderBottom = '2px solid #ef4444';
      } else {
          // If it's above everything, find and highlight the top border of the first non-dragging card
          const firstCardElement = episodeCardsListElement.querySelector('.episode-card-item:not(.dragging)');
          if (firstCardElement) firstCardElement.style.borderTop = '2px solid #ef4444';
      }
  });
  
  // Attach a dragleave event listener to clear drop-indicator borders when the cursor leaves the container
  episodeListContainerElement.addEventListener('dragleave', (dragEventObject) => {
      // Query all episode cards and remove their temporary border styles
      episodeCardsListElement.querySelectorAll('.episode-card-item').forEach(cardElement => { cardElement.style.borderTop = ''; cardElement.style.borderBottom = ''; });
  });
  
  // Attach a drop event listener to insert the dragged card at the target position and persist the new order
  episodeListContainerElement.addEventListener('drop', (dragEventObject) => {
      dragEventObject.preventDefault();
      if (!draggedEpisodeCard) return;
      
      // Clear temporary drop-indicator borders from all episode cards
      episodeCardsListElement.querySelectorAll('.episode-card-item').forEach(cardElement => { cardElement.style.borderTop = ''; cardElement.style.borderBottom = ''; });
      
      const insertAfterCardElement = getDragInsertionPoint(dragEventObject.clientY);
      
      if (insertAfterCardElement) {
          if (insertAfterCardElement !== draggedEpisodeCard) {
              // Insert the dragged card element immediately after the target card in the DOM
              insertAfterCardElement.after(draggedEpisodeCard);
              saveEpisodeOrder();
          }
      } else {
          // Find the first non-dragging card element in the list
          const firstCardElement = episodeCardsListElement.querySelector('.episode-card-item:not(.dragging)');
          if (firstCardElement && firstCardElement !== draggedEpisodeCard) {
              // Insert the dragged card element before the first card in the DOM
              firstCardElement.before(draggedEpisodeCard);
              saveEpisodeOrder();
          }
      }
  });
}


async function loadEpisodeDetails(episodeId) {
  activeEpisodeId = episodeId;
  // Query all episode card items in the DOM and toggle the 'active' highlight class on the selected episode
  document.querySelectorAll('.episode-card-item').forEach(episodeCardElement => {
    episodeCardElement.classList.toggle('active', Number(episodeCardElement.dataset.id) === Number(episodeId));
  });
  updatePushEpisodeHeaderBtn();
  try {
    // Perform an authenticated HTTP GET request to fetch the full details of the selected episode
    const fetchResponse = await authFetch(`/api/episodes/${episodeId}`);
    // Parse the JSON response into an episode record object
    const episodeRecord = await fetchResponse.json();
    while (typeof episodeRecord.scenes === 'string') {
      try {
        // Parse the serialized JSON string of scenes into a JavaScript array
        episodeRecord.scenes = JSON.parse(episodeRecord.scenes);
      } catch (jsonParseError) {
        episodeRecord.scenes = [];
        break;
      }
    }
    if (!Array.isArray(episodeRecord.scenes)) episodeRecord.scenes = [];
    while (typeof episodeRecord.npc_agendas === 'string') {
      try {
        // Parse the serialized JSON string of NPC agendas into a JavaScript array
        episodeRecord.npc_agendas = JSON.parse(episodeRecord.npc_agendas);
      } catch (jsonParseError) {
        episodeRecord.npc_agendas = [];
        break;
      }
    }
    if (!Array.isArray(episodeRecord.npc_agendas)) episodeRecord.npc_agendas = [];
    currentEpisodeData = episodeRecord;
    renderEpisodeMaps();
    // Look up the episode title display elements and input field in the DOM by ID
    const episodeTitleElement = document.getElementById('activeEpTitle') || document.getElementById('epDetailTitle');
    const episodeTitleInputElement = document.getElementById('epTitleInput');
    if (episodeTitleInputElement) episodeTitleInputElement.value = episodeRecord.title || '';
    if (episodeTitleElement) episodeTitleElement.innerText = `Episode ${episodeRecord.episode_number}: ${episodeRecord.title}`;
    
    // Look up the episode status dropdown in the DOM by ID
    const episodeStatusSelectElement = document.getElementById('epStatusSelect');
    if (episodeStatusSelectElement) episodeStatusSelectElement.value = episodeRecord.status || 'planning';
    
    // Look up the episode location input element in the DOM by ID
    const episodeLocationInputElement = document.getElementById('epLocation');
    if (episodeLocationInputElement) episodeLocationInputElement.value = episodeRecord.location || '';
    
    // Look up the episode hook input element in the DOM by ID
    const episodeHookInputElement = document.getElementById('epHook');
    if (episodeHookInputElement) episodeHookInputElement.value = episodeRecord.hook || '';
    
    // Look up the episode concepts input element in the DOM by ID
    const episodeConceptsInputElement = document.getElementById('epConcepts');
    if (episodeConceptsInputElement) episodeConceptsInputElement.value = episodeRecord.concepts || '';
    
    // Look up the episode summary / fallout notes input element in the DOM by ID
    const episodeSummaryInputElement = document.getElementById('epSummary');
    if (episodeSummaryInputElement) episodeSummaryInputElement.value = episodeRecord.fallout_notes || '';
    
    // Removed broken updateWorkshopMinimap() which was hard-resetting the map to concept_map.jpg
    
    // Look up the NPC agendas container element in the DOM by ID
    const episodeAgendasListElement = document.getElementById('epAgendasList');
    episodeAgendasListElement.innerHTML = '';
    
    // We fetch the characters to resolve ref_ids via an authenticated HTTP GET request
    authFetch('/api/characters?campaign_id=' + activeChronicleId + '&_t=' + Date.now())
    .then(charactersFetchResponse => charactersFetchResponse.json())
    .then(campaignCharactersList => {
        if (episodeRecord.npc_agendas && episodeRecord.npc_agendas.length > 0) {
            episodeRecord.npc_agendas.forEach((npcAgendaEntry, agendaIndex) => {
                // Create a new <div> element in memory for the NPC agenda card
                const agendaCardElement = document.createElement('div');
                agendaCardElement.className = 'agenda-card';
                
                // Backwards compatibility for old raw objects vs new ref_id objects
                let resolvedCharacterAgendaData = npcAgendaEntry; 
                let isLinkedToVaultCharacter = false;
                if (npcAgendaEntry.ref_id) {
                    const matchingCharacterRecord = campaignCharactersList.find(characterRecord => characterRecord.id === npcAgendaEntry.ref_id);
                    if (matchingCharacterRecord) {
                        resolvedCharacterAgendaData = {
                            id: matchingCharacterRecord.id,
                            name: matchingCharacterRecord.name,
                            wants: matchingCharacterRecord.npc_current_want,
                            mask: matchingCharacterRecord.npc_mask_truth,
                            line: matchingCharacterRecord.npc_taboos,
                            mannerisms: matchingCharacterRecord.npc_mannerisms,
                            biases: matchingCharacterRecord.npc_biases,
                            secret: matchingCharacterRecord.npc_hidden_secret,
                            memories: matchingCharacterRecord.npc_active_memories,
                            timeline: matchingCharacterRecord.npc_faction_timeline
                        };
                        isLinkedToVaultCharacter = true;
                    } else {
                        resolvedCharacterAgendaData = { name: "Unknown Character (Deleted?)" };
                    }
                }

                agendaCardElement.innerHTML = `
                    <div class="agenda-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <strong><i class="fa-solid fa-user-secret" style="color:#10b981;"></i> ${escapeHtml(resolvedCharacterAgendaData.name || 'Unknown')}</strong>
                        <button class="btn-card-ctrl" onclick="removeNpcAgenda(${agendaIndex})" title="Remove from Episode" style="color:#ef4444; background:transparent; border:none; cursor:pointer; font-size:14px;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                    <div class="agenda-body" style="display:flex; flex-direction:column; gap:8px;">
                        ${isLinkedToVaultCharacter ? `
                            <div>
                                <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Current Want (Tonight)</label>
                                <textarea id="workshop_npc_${resolvedCharacterAgendaData.id}_npc_current_want" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${resolvedCharacterAgendaData.id}, 'npc_current_want', this.value)">${escapeHtml(resolvedCharacterAgendaData.wants || '')}</textarea>
                            </div>
                            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Mask vs Truth</label>
                                    <textarea id="workshop_npc_${resolvedCharacterAgendaData.id}_npc_mask_truth" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${resolvedCharacterAgendaData.id}, 'npc_mask_truth', this.value)">${escapeHtml(resolvedCharacterAgendaData.mask || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Line in the Sand</label>
                                    <textarea id="workshop_npc_${resolvedCharacterAgendaData.id}_npc_taboos" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${resolvedCharacterAgendaData.id}, 'npc_taboos', this.value)">${escapeHtml(resolvedCharacterAgendaData.line || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Mannerisms</label>
                                    <textarea id="workshop_npc_${resolvedCharacterAgendaData.id}_npc_mannerisms" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${resolvedCharacterAgendaData.id}, 'npc_mannerisms', this.value)">${escapeHtml(resolvedCharacterAgendaData.mannerisms || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Biases</label>
                                    <textarea id="workshop_npc_${resolvedCharacterAgendaData.id}_npc_biases" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${resolvedCharacterAgendaData.id}, 'npc_biases', this.value)">${escapeHtml(resolvedCharacterAgendaData.biases || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#f59e0b; text-transform:uppercase;">The Hidden Secret</label>
                                    <textarea id="workshop_npc_${resolvedCharacterAgendaData.id}_npc_hidden_secret" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${resolvedCharacterAgendaData.id}, 'npc_hidden_secret', this.value)">${escapeHtml(resolvedCharacterAgendaData.secret || '')}</textarea>
                                </div>
                                <div>
                                    <label style="font-size:10px; color:#9ca3af; text-transform:uppercase;">Active Memories</label>
                                    <textarea id="workshop_npc_${resolvedCharacterAgendaData.id}_npc_active_memories" class="vtm-input" rows="2" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2);" onchange="updateCharacterNpcField(${resolvedCharacterAgendaData.id}, 'npc_active_memories', this.value)">${escapeHtml(resolvedCharacterAgendaData.memories || '')}</textarea>
                                </div>
                            </div>
                            <div style="margin-top:8px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.1);">
                                <label style="font-size:10px; color:#ef4444; text-transform:uppercase;"><i class="fa-solid fa-clock-rotate-left"></i> Faction Timeline / Plot Spine</label>
                                <textarea id="workshop_npc_${resolvedCharacterAgendaData.id}_npc_faction_timeline" class="vtm-input" rows="2" placeholder="What will they do across the episodes if players never intervene?" style="width:100%; font-size:12px; resize:vertical; background:rgba(0,0,0,0.2); border-color:rgba(239, 68, 68, 0.3);" onchange="updateCharacterNpcField(${resolvedCharacterAgendaData.id}, 'npc_faction_timeline', this.value)">${escapeHtml(resolvedCharacterAgendaData.timeline || '')}</textarea>
                            </div>
                        ` : `
                            <p><strong>Wants (Tonight):</strong> ${escapeHtml(resolvedCharacterAgendaData.wants || resolvedCharacterAgendaData.want || 'Unknown')}</p>
                            <p style="font-size:10px; color:#ef4444;">(Legacy unlinked NPC. Remove and re-add from Vault to link and edit full 7-point profile).</p>
                        `}
                    </div>
                `;
                // Append the constructed agenda card element into the agendas list container
                episodeAgendasListElement.appendChild(agendaCardElement);
            });
        } else {
            episodeAgendasListElement.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No NPC agendas configured yet.</div>';
        }
    });
    
    // Look up the episode scenes list container element in the DOM by ID
    const episodeScenesListElement = document.getElementById('epScenesList');
    if (episodeScenesListElement) {
      episodeScenesListElement.innerHTML = '';
      if (episodeRecord.scenes && episodeRecord.scenes.length > 0) {
        episodeRecord.scenes.forEach(sceneRecord => {
          // Create a new <div> element in memory for the scene flow card
          const sceneCardElement = document.createElement('div');
          sceneCardElement.className = 'scene-flow-card';
          sceneCardElement.innerHTML = `
                        <div class="scene-flow-header">
                            <div class="scene-title-badge">
                                <h4>${sceneRecord.title}</h4>
                                <span class="scene-loc-tag"><i class="fa-solid fa-location-dot"></i> ${sceneRecord.location}</span>
                            </div>
                            <div class="scene-actions">
                                <button class="btn-push-scene" onclick="pushSceneToGameboard('${encodeURIComponent(JSON.stringify(sceneRecord))}')">
                                    <i class="fa-solid fa-satellite-dish"></i> PUSH TO GAMEBOARD
                                </button>
                            </div>
                        </div>
                        <div class="scene-flow-body">
                            <p class="scene-mood"><em>"${sceneRecord.mood}"</em></p>
                            <p class="scene-obj"><strong>Objectives:</strong> ${sceneRecord.objectives}</p>
                            <div class="scene-clues-box">
                                <div><strong>Investigation (Standard):</strong> ${sceneRecord.standard_clue || 'Obvious clue.'}</div>
                                <div><strong>Investigation (Exceptional):</strong> ${sceneRecord.exceptional_clue || 'Hidden secret.'}</div>
                            </div>
                        </div>
                    `;
          // Append the scene card element into the scenes list container
          episodeScenesListElement.appendChild(sceneCardElement);
        });
      } else {
        episodeScenesListElement.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No scenes mapped out yet.</div>';
      }
    }
    renderClueMatrices(episodeRecord.matrices || []);
    renderLoreMatrices(episodeRecord.lore_matrices || []);
    
    // Auto-refresh Omni widget if it's currently open by checking its computed CSS display property
    const storytellerOmniWidgetElement = document.getElementById('widget-storyteller-omni');
    if (storytellerOmniWidgetElement && window.getComputedStyle(storytellerOmniWidgetElement).display !== 'none') {
        loadOmniUnrevealedClues();
        loadOmniUnrevealedLore();
        loadOmniHookAndAgendas();
    }
  } catch (errorObject) {
    // Log any error encountered while loading episode details to the developer console
    console.error('Failed to load episode details:', errorObject);
  }
}

function pushSceneToGameboard(encodedSceneJson) {
  // Decode the URI-encoded scene string and parse it from JSON into an object
  const sceneRecord = JSON.parse(decodeURIComponent(encodedSceneJson));
  // Emit a Socket.IO event to broadcast the new scene banner, location, and mood to all connected players
  socket.emit('scene:push', {
    campaignId: activeChronicleId,
    banner: sceneRecord.banner || '/images/banner_1200x400.jpg',
    location: sceneRecord.location,
    mood: sceneRecord.mood
  });
  if (activeChronicleId) {
    authFetch('/api/gameboard/scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chronicle_id: activeChronicleId,
        active_scene_banner: sceneRecord.banner || '/images/banner_1200x400.jpg',
        active_location: sceneRecord.location || '',
        active_mood_text: sceneRecord.mood || '',
        active_map_url: sceneRecord.map_url || undefined
      })
    }).catch(() => {});
  }
  // Look up the atmosphere banner wrapper element in the DOM by ID
  const atmosphereBannerWrapperElement = document.getElementById('atmosphereBannerWrap');
  if (atmosphereBannerWrapperElement && atmosphereBannerWrapperElement.classList.contains('collapsed')) {
    toggleAtmosphereBanner();
  }
  if (sceneRecord.map_url) {
    switchCityMap(sceneRecord.map_url, true);
  }
  // Display a native browser alert confirming the scene was pushed live
  alert(`Scene "${sceneRecord.title}" has been pushed live to the Gameboard!`);
}


async function loadOmniUnrevealedClues() {
  // Look up the Omni widget unrevealed clues container element in the DOM by ID
  const unrevealedCluesListElement = document.getElementById('omniUnrevealedClues');
  // Find the closest ancestor element matching '.widget-body' to preserve its scroll position
  const widgetScrollContainerElement = unrevealedCluesListElement ? unrevealedCluesListElement.closest('.widget-body') : null;
  const savedScrollTopPosition = widgetScrollContainerElement ? widgetScrollContainerElement.scrollTop : 0;
  if (!unrevealedCluesListElement) return;
  const targetClueEpId = window.liveGameboardEpisodeId || activeEpisodeId || 12;
  if (!targetClueEpId) {
      unrevealedCluesListElement.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;">Please load an episode first.</div>';
      return;
  }
  try {
    // Perform an authenticated HTTP GET request to fetch clue matrices for the active episode
    const fetchResponse = await authFetch(`/api/matrices?episode_id=${targetClueEpId}&campaign_id=${activeChronicleId}`);
    // Parse the JSON response into an array of clue matrix objects
    const clueMatricesList = await fetchResponse.json();
    unrevealedCluesListElement.innerHTML = '';
    clueMatricesList.forEach(clueMatrixRecord => {
      if (clueMatrixRecord.clues && clueMatrixRecord.clues.length > 0) {
        // Create a <div> container element for this clue matrix group
        const matrixGroupElement = document.createElement('div');
        matrixGroupElement.style.marginBottom = '12px';
        matrixGroupElement.innerHTML = `<h5 style="color:#fca5a5;font-size:12px;margin-bottom:6px;border-bottom:1px solid #372329;padding-bottom:2px;">${clueMatrixRecord.title}</h5>`;
        clueMatrixRecord.clues.forEach(clueRecord => {
          // Create a <div> element for each individual clue item
          const clueItemElement = document.createElement('div');
          clueItemElement.style.marginBottom = '8px';
          clueItemElement.style.padding = '6px';
          clueItemElement.style.background = '#191216';
          clueItemElement.style.borderRadius = '4px';
          const toggleClueButtonHtml = clueRecord.discovered ? `<button class="btn-action-conceal" onclick="toggleClue(${clueRecord.id})"><i class="fa-solid fa-eye-slash"></i> Re-Hide</button>` : `<button class="btn-action-reveal" onclick="toggleClue(${clueRecord.id})"><i class="fa-solid fa-bullhorn"></i> Push to Corkboard</button>`;
          clueItemElement.innerHTML = `
                        <div style="font-size:12px;font-weight:700;color:#f3f4f6;">${clueRecord.title}</div>
                        <div style="font-size:10px;color:#d97706;margin-bottom:4px;">Vector: ${clueRecord.delivery_method}</div>\n                        ${clueRecord.description ? `<div style="font-size:11px;color:#d1d5db;margin-bottom:6px;line-height:1.3;">${escapeHtml(clueRecord.description)}</div>` : ''} 
                        ${toggleClueButtonHtml}
                    `;
          // Append the clue item element into the matrix group container
          matrixGroupElement.appendChild(clueItemElement);
        });
        // Append the matrix group container into the unrevealed clues list in the DOM
        unrevealedCluesListElement.appendChild(matrixGroupElement);
      }
    });
    if (unrevealedCluesListElement.innerHTML === '') {
      unrevealedCluesListElement.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;">No clues found in current episode.</div>';
    }
    if (widgetScrollContainerElement) widgetScrollContainerElement.scrollTop = savedScrollTopPosition;
  } catch (errorObject) {
    // Log any network or parsing error to the developer console
    console.error(errorObject);
  }
}

async function loadOmniUnrevealedLore() {
  // Look up the Omni widget unrevealed lore container element in the DOM by ID
  const unrevealedLoreListElement = document.getElementById('omniUnrevealedLore');
  // Find the closest ancestor element matching '.widget-body' to preserve its scroll position
  const widgetScrollContainerElement = unrevealedLoreListElement ? unrevealedLoreListElement.closest('.widget-body') : null;
  const savedScrollTopPosition = widgetScrollContainerElement ? widgetScrollContainerElement.scrollTop : 0;
  if (!unrevealedLoreListElement) return;
  const targetLoreEpId = window.liveGameboardEpisodeId || activeEpisodeId || 12;
  if (!targetLoreEpId) {
      unrevealedLoreListElement.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;">Please load an episode first.</div>';
      return;
  }
  try {
    // Perform an authenticated HTTP GET request to fetch lore matrices for the active episode
    const fetchResponse = await authFetch(`/api/lore_matrices?episode_id=${targetLoreEpId}&campaign_id=${activeChronicleId}`);
    // Parse the JSON response into an array of lore matrix objects
    const loreMatricesList = await fetchResponse.json();
    unrevealedLoreListElement.innerHTML = '';
    loreMatricesList.forEach(loreMatrixRecord => {
      if (loreMatrixRecord.entries && loreMatrixRecord.entries.length > 0) {
        // Create a <div> container element for this lore matrix group
        const matrixGroupElement = document.createElement('div');
        matrixGroupElement.style.marginBottom = '12px';
        matrixGroupElement.innerHTML = `<h5 style="color:#fbbf24;font-size:12px;margin-bottom:6px;border-bottom:1px solid #372329;padding-bottom:2px;">${loreMatrixRecord.title}</h5>`;
        loreMatrixRecord.entries.forEach(loreEntryRecord => {
          // Create a <div> element for each individual lore entry item
          const loreItemElement = document.createElement('div');
          loreItemElement.style.marginBottom = '8px';
          loreItemElement.style.padding = '6px';
          loreItemElement.style.background = '#191216';
          loreItemElement.style.borderRadius = '4px';
          const toggleLoreButtonHtml = loreEntryRecord.discovered ? `<button class="btn-action-conceal" onclick="toggleLore(${loreEntryRecord.id})"><i class="fa-solid fa-eye-slash"></i> Hide Lore</button>` : `<button class="btn-action-reveal" onclick="toggleLore(${loreEntryRecord.id})"><i class="fa-solid fa-book-open"></i> Reveal Lore</button>`;
          loreItemElement.innerHTML = `
                        <div style="font-size:12px;font-weight:700;color:#f3f4f6;">${loreEntryRecord.title}</div>
                        <div style="font-size:10px;color:#fca5a5;margin-bottom:4px;">Learned via: ${loreEntryRecord.revelation_vector}</div>
                        ${loreEntryRecord.content ? `<div style="font-size:11px;color:#d1d5db;margin-bottom:6px;line-height:1.3;">${escapeHtml(loreEntryRecord.content)}</div>` : ''}
                        ${toggleLoreButtonHtml}
                    `;
          // Append the lore item element into the matrix group container
          matrixGroupElement.appendChild(loreItemElement);
        });
        // Append the matrix group container into the unrevealed lore list in the DOM
        unrevealedLoreListElement.appendChild(matrixGroupElement);
      }
    });
    if (unrevealedLoreListElement.innerHTML === '') {
      unrevealedLoreListElement.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;">No lore entries found in current episode.</div>';
    }
    if (widgetScrollContainerElement) widgetScrollContainerElement.scrollTop = savedScrollTopPosition;
  } catch (errorObject) {
    // Log any network or parsing error to the developer console
    console.error(errorObject);
  }
}

function openNewEpisodeModal() {
  // Look up the new episode modal element in the DOM by ID and add the 'active' CSS class to display it
  document.getElementById('newEpisodeModal').classList.add('active');
}


function createCampaignSubmit() {
  // Read the new campaign title from the input element in the DOM
  const newCampaignTitle = document.getElementById('newCampaignTitle')?.value.trim() || document.getElementById('newCampTitle')?.value.trim() || '';
  // Display a native browser alert if no campaign title was entered
  if (!newCampaignTitle) return alert('Campaign title is required.');
  if (!activeChronicleId) return alert('Please select an active chronicle first.');
  // Perform an authenticated HTTP POST request to create a new sub-campaign under the active chronicle
  authFetch(`/api/chronicles/${activeChronicleId}/campaigns`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // Serialize the new campaign title and description into a JSON string payload
    body: JSON.stringify({
      title: newCampaignTitle,
      description: ''
    })
  }).then(fetchResponse => fetchResponse.json()).then(responsePayload => {
    if (responsePayload.id) {
      // Clear the campaign creation form inputs in the DOM
      const campaignTitleInputElement = document.getElementById('newCampaignTitle'); if (campaignTitleInputElement) campaignTitleInputElement.value = '';
      const campaignDescriptionInputElement = document.getElementById('newCampaignDesc'); if (campaignDescriptionInputElement) campaignDescriptionInputElement.value = '';
      closeModal('newCampaignModal');

      activeSubCampaignId = responsePayload.id;
      loadCampaignsList();
      // Display a native browser alert confirming the campaign was created
      alert(`Campaign "${newCampaignTitle}" created successfully!`);
    } else {
      alert(responsePayload.error || 'Failed to create campaign.');
    }
  }).catch(errorObject => {
    // Log the error to the developer console and notify the user
    console.error(errorObject);
    alert('Network error creating campaign.');
  });
}

function createEpisodeSubmit() {
  // Look up the episode number and metadata input elements in the DOM by ID
  const episodeNumberInputElement = document.getElementById('newEpNumber') || document.getElementById('newEpNum') || document.getElementById('newEpisodeNum');
  const episodeNumber = parseInt(episodeNumberInputElement ? episodeNumberInputElement.value : 1) || 1;
  const episodeTitle = document.getElementById('newEpTitle')?.value.trim() || document.getElementById('newEpisodeTitle')?.value.trim() || '';
  const episodeLocation = document.getElementById('newEpLoc')?.value.trim() || '';
  const episodeMoodHook = document.getElementById('newEpMood')?.value.trim() || '';
  const episodeConcepts = document.getElementById('newEpConcepts')?.value.trim() || 'Chronicle Arc';
  // Display a native browser alert if required fields are missing
  if (!episodeTitle) return alert('Episode title is required.');
  if (!activeChronicleId) return alert('Please select or create an active chronicle first.');
  // Perform an authenticated HTTP POST request to create a new episode in the active chronicle
  authFetch(`/api/chronicles/${activeChronicleId}/episodes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // Serialize the new episode properties into a JSON string payload
    body: JSON.stringify({
      episode_number: episodeNumber,
      title: episodeTitle,
      concepts: episodeConcepts,
      hook: episodeMoodHook,
      location: episodeLocation,
      campaign_id: activeSubCampaignId
    })
  }).then(fetchResponse => fetchResponse.json()).then(responsePayload => {
    if (responsePayload.id) {
      // Clear the episode creation form inputs in the DOM
      const episodeTitleInputElement = document.getElementById('newEpisodeTitle'); if (episodeTitleInputElement) episodeTitleInputElement.value = '';
      const episodeDescriptionInputElement = document.getElementById('newEpisodeDesc'); if (episodeDescriptionInputElement) episodeDescriptionInputElement.value = '';
      closeModal('newEpisodeModal');

      loadCampaignsList();
      // Display a native browser alert confirming the episode was created
      alert(`Episode "${episodeTitle}" created successfully!`);
    } else {
      alert(responsePayload.error || 'Failed to create episode.');
    }
  }).catch(errorObject => {
    // Log the error to the developer console and notify the user
    console.error(errorObject);
    alert('Network error creating episode.');
  });
}


function saveEpisodeDetails() {
  if (!activeEpisodeId) return;
  // Read the current episode form field values from the DOM by their element IDs
  const episodeTitle = document.getElementById('epTitleInput').value.trim();
  const episodeStatusSelectElement = document.getElementById('epStatusSelect');
  const episodeStatus = episodeStatusSelectElement ? episodeStatusSelectElement.value : 'planning';
  const episodeHook = document.getElementById('epHook')?.value.trim() || '';
  const episodeLocation = document.getElementById('epLocation')?.value.trim() || '';
  const episodeConcepts = document.getElementById('epConcepts')?.value.trim() || '';
  const episodeFalloutNotes = document.getElementById('epSummary') ? document.getElementById('epSummary').value.trim() : '';
  
  // Sync back to the Omni Widget if it's currently open
  if (currentEpisodeData && currentEpisodeData.id === activeEpisodeId) {
      currentEpisodeData.hook = episodeHook;
      currentEpisodeData.location = episodeLocation;
      currentEpisodeData.concepts = episodeConcepts;
      currentEpisodeData.fallout_notes = episodeFalloutNotes;
      if (typeof loadOmniHookAndAgendas === 'function') loadOmniHookAndAgendas();
  }
  
  // Perform an authenticated HTTP PUT request to update the episode details on the server
  authFetch(`/api/episodes/${activeEpisodeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    // Serialize the updated episode fields into a JSON string payload
    body: JSON.stringify({
      title: episodeTitle,
      status: episodeStatus,
      hook: episodeHook,
      concepts: episodeConcepts,
      fallout_notes: episodeFalloutNotes,
      location: episodeLocation,
      maps: currentEpisodeData.maps || []
    })
  }).then(fetchResponse => fetchResponse.json()).then(responsePayload => {
    // Display a native browser alert indicating whether the save succeeded
    if (responsePayload.success) alert('Episode details saved successfully!'); else alert('Failed to save episode: ' + responsePayload.error);
    loadEpisodeDetails(activeEpisodeId);
    if (typeof loadCampaignsList === "function") loadCampaignsList();
  }).catch(errorObject => {
    // Log the error to the developer console and alert the user
    console.error(errorObject);
    alert('Error saving episode details.');
  });
}

function saveEpisodeEdits() {
  // Read the episode hook value from the DOM input element
  const episodeHookText = document.getElementById('epHook').value;
  // Perform an authenticated HTTP PUT request to save the updated episode hook
  authFetch(`/api/episodes/${activeEpisodeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    // Serialize the hook field into a JSON payload
    body: JSON.stringify({
      hook: episodeHookText
    })
  }).then(fetchResponse => fetchResponse.json()).then(() => alert('Episode Hook saved!'));
}


async function addNpcAgendaPrompt() {
    if (!activeChronicleId) return alert('Select a chronicle first.');
    try {
        // Perform an authenticated HTTP GET request to fetch all characters in the active chronicle
        const fetchResponse = await authFetch('/api/characters?campaign_id=' + activeChronicleId + '&_t=' + Date.now());
        if (!fetchResponse.ok) throw new Error('Failed to fetch characters');
        // Parse the JSON response into an array of character records
        const charactersList = await fetchResponse.json();
        
        let characterSelectDropdownHtml = '<select id="npcSelectDropdown" style="width:100%; padding:8px; background:#140e11; border:1px solid #3f3f46; color:#f8fafc; margin-bottom:12px; outline:none; border-radius:4px;">';
        characterSelectDropdownHtml += '<option value="">-- Select a Character --</option>';
        charactersList.forEach(characterRecord => {
            characterSelectDropdownHtml += `<option value="${characterRecord.id}">${escapeHtml(characterRecord.name)} ${characterRecord.title ? '('+escapeHtml(characterRecord.title)+')' : ''}</option>`;
        });
        characterSelectDropdownHtml += '</select>';

        const selectedCharacterId = await new Promise((resolveSelectionPromise) => {
            // Create a modal overlay <div> element in memory for selecting an NPC
            const modalOverlayElement = document.createElement('div');
            modalOverlayElement.className = 'modal-overlay active';
            modalOverlayElement.style.zIndex = '9999999';
            modalOverlayElement.innerHTML = `
                <div class="modal-container" style="max-width:400px; background:#120b0f; border:1px solid #7f1d1d; border-radius:8px;">
                    <div class="modal-header" style="padding:16px; border-bottom:1px solid #372128; display:flex; justify-content:space-between; align-items:center;">
                        <h3 style="margin:0; font-size:16px; color:#f8fafc;"><i class="fa-solid fa-user-plus" style="color:#10b981;"></i> Select NPC to Add</h3>
                        <button class="btn-close-modal" style="background:transparent; border:none; color:#d1d5db; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="modal-body" style="padding:16px;">
                        ${characterSelectDropdownHtml}
                        <div style="display:flex; justify-content:flex-end; gap:8px;">
                            <button class="btn-action-outline btn-cancel">Cancel</button>
                            <button class="btn-action btn-confirm">Add NPC</button>
                        </div>
                    </div>
                </div>
            `;
            // Append the modal overlay element to the document body so it appears on screen
            document.body.appendChild(modalOverlayElement);

            const removeModalElement = () => { modalOverlayElement.remove(); };
            // Query the modal buttons within the modal overlay and attach click handlers
            modalOverlayElement.querySelector('.btn-close-modal').onclick = () => { removeModalElement(); resolveSelectionPromise(null); };
            modalOverlayElement.querySelector('.btn-cancel').onclick = () => { removeModalElement(); resolveSelectionPromise(null); };
            modalOverlayElement.querySelector('.btn-confirm').onclick = () => { 
                // Query the dropdown select element inside the modal to read the chosen character ID
                const selectedDropdownValue = modalOverlayElement.querySelector('#npcSelectDropdown').value;
                removeModalElement(); 
                resolveSelectionPromise(selectedDropdownValue ? parseInt(selectedDropdownValue) : null); 
            };
        });

        if (!selectedCharacterId) return;

        if (!currentEpisodeData) currentEpisodeData = {};
        if (typeof currentEpisodeData.npc_agendas === 'string') {
            try { currentEpisodeData.npc_agendas = JSON.parse(currentEpisodeData.npc_agendas); } catch(jsonParseError) { currentEpisodeData.npc_agendas = []; }
        }
        if (!Array.isArray(currentEpisodeData.npc_agendas)) currentEpisodeData.npc_agendas = [];
        
        // Push the character_id as a reference object
        currentEpisodeData.npc_agendas.push({ ref_id: selectedCharacterId });
        // Perform an authenticated HTTP PUT request to save the updated NPC agendas array to the episode
        await authFetch(`/api/episodes/${activeEpisodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Serialize the updated NPC agendas array into a JSON string payload
            body: JSON.stringify({ npc_agendas: currentEpisodeData.npc_agendas })
        });
        loadEpisodeDetails(activeEpisodeId);
    } catch(errorObject) {
        // Log any error to the console and alert the user
        console.error(errorObject);
        alert('Error loading character list');
    }
}


function updateWorkshopMinimap(explicitMapUrl) {
  const resolvedMapUrl = explicitMapUrl || '/images/concept_map.jpg';
  // Look up the workshop minimap image element in the DOM by ID
  const minimapImageElement = document.getElementById('workshopMinimapImg');
  if (minimapImageElement) minimapImageElement.src = resolvedMapUrl;
  loadCampaignPins();
}

let workshopMapPins = [];

async function loadCampaignPins(explicitMapUrl) {
  if (!activeChronicleId) return;
  // Look up the workshop minimap image element in the DOM by ID
  const minimapImageElement = document.getElementById('workshopMinimapImg');
  let rawMapUrl = explicitMapUrl || (minimapImageElement ? minimapImageElement.getAttribute('src') : null) || '/images/concept_map.jpg';
  const normalizedMapPathname = typeof normalizeCityMapUrl === 'function'
    ? normalizeCityMapUrl(rawMapUrl)
    : new URL(rawMapUrl, window.location.origin).pathname;
  try {
    // Perform an authenticated HTTP GET request to load map pins for the specified map URL
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/pins?mapUrl=${encodeURIComponent(normalizedMapPathname)}`);
    if (fetchResponse.ok) {
      workshopMapPins = await fetchResponse.json();
      renderWorkshopPinsList();
      renderPinsOnGameboard();
    }
  } catch (errorObject) {
    // Log any error loading campaign pins to the developer console
    console.error(errorObject);
  }
}

function renderWorkshopPinsList() {
  // Look up the minimap pins overlay and the pins list container elements in the DOM by ID
  const minimapPinsContainerElement = document.getElementById('workshopMinimapPins');
  const mapPinsListContainerElement = document.getElementById('workshopMapPinsList');
  if (!minimapPinsContainerElement || !mapPinsListContainerElement) return;
  minimapPinsContainerElement.innerHTML = '';
  mapPinsListContainerElement.innerHTML = '';
  const pinsToRender = Array.isArray(workshopMapPins) ? workshopMapPins : [];
  pinsToRender.forEach((mapPinRecord, pinIndex) => {
    const horizontalPercentageX = mapPinRecord.x / 2800 * 100;
    const verticalPercentageY = mapPinRecord.y / 2000 * 100;
    minimapPinsContainerElement.innerHTML += `<div style="position:absolute; left:${horizontalPercentageX}%; top:${verticalPercentageY}%; transform:translate(-50%, -100%); display:flex; flex-direction:column; align-items:center; cursor:pointer;" onclick="handlePinClick(event, ${mapPinRecord.id})" draggable="true" ondragstart="event.dataTransfer.setData('text/plain', ${mapPinRecord.id});">
            <div style="background:#ef4444; color:#fff; font-size:10px; font-weight:bold; width:16px; height:16px; border-radius:50%; display:flex; align-items:center; justify-content:center; margin-bottom:-4px; z-index:2; border:1px solid #7f1d1d;">${pinIndex + 1}</div>
            <i class="fa-solid fa-location-dot" title="${escapeHtml(mapPinRecord.title)}" style="color:#ef4444; font-size:16px; filter:drop-shadow(0 2px 4px rgba(0,0,0,0.8));"></i>
        </div>`;
    mapPinsListContainerElement.innerHTML += `
        <div style="background:#140e11; border:1px solid #372128; border-radius:6px; padding:12px; display:flex; gap:12px; align-items:flex-start;">
            <div style="background:#ef4444; color:#fff; font-size:12px; font-weight:bold; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${pinIndex + 1}</div>
            <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
                <input type="text" value="${escapeHtml(mapPinRecord.title)}" onchange="updatePin(${mapPinRecord.id}, 'title', this.value)" style="background:transparent; border:none; border-bottom:1px solid #372128; color:#ef4444; font-weight:bold; padding:4px 0; font-size:14px; outline:none;" placeholder="Location Title">
                <textarea onchange="updatePin(${mapPinRecord.id}, 'description', this.value)" rows="2" style="background:transparent; border:1px solid #2a191f; border-radius:4px; color:#d1d5db; padding:6px; font-size:12px; resize:vertical; outline:none; font-family:inherit;" placeholder="Location description / details... (Optional)">${escapeHtml(mapPinRecord.description || '')}</textarea>
            </div>
            <button class="btn-card-ctrl" onclick="deletePin(${mapPinRecord.id})" style="color:#ef4444;" title="Delete Pin"><i class="fa-solid fa-trash"></i></button>
        </div>
        `;
  });
}

async function updatePin(pinId, fieldName, newFieldValue) {
  const targetPinRecord = (workshopMapPins || []).find(pinRecord => pinRecord.id === pinId) || (currentMapPins || []).find(pinRecord => pinRecord.id === pinId);
  if (!targetPinRecord) return;
  targetPinRecord[fieldName] = newFieldValue;
  try {
    // Perform an authenticated HTTP PUT request to update the map pin details on the server
    await authFetch(`/api/chronicles/${activeChronicleId}/pins/${pinId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      // Serialize the updated pin fields into a JSON string payload
      body: JSON.stringify({
        title: targetPinRecord.title,
        description: targetPinRecord.description,
        security_measures: '',
        infiltration_routes: ''
      })
    });
    renderWorkshopPinsList();
    renderPinsOnGameboard();
  } catch (errorObject) {
    // Log any network or server error to the developer console
    console.error(errorObject);
  }
}

async function deletePin(pinId) {
  const isConfirmed = typeof vtmConfirm === 'function'
    ? await vtmConfirm('Delete this location pin?', 'Delete Location Pin')
    : true;
  if (!isConfirmed) return;
  try {
    // Perform an authenticated HTTP DELETE request to remove the pin from the server
    await authFetch(`/api/chronicles/${activeChronicleId}/pins/${pinId}`, {
      method: 'DELETE'
    });
    loadCampaignPins();
  } catch (errorObject) {
    // Log any error deleting the pin to the developer console
    console.error(errorObject);
  }
}



function renderPinsOnGameboard() {
  if (typeof loadMapPins === "function") loadMapPins();
}


function addMapToEpisode(mapImageUrl) {
  if (!mapImageUrl) return;
  if (!currentEpisodeData) return;
  if (!Array.isArray(currentEpisodeData.maps)) currentEpisodeData.maps = [];
  currentEpisodeData.maps.push({ url: mapImageUrl, name: mapImageUrl.split('/').pop().replace(/\.[^/.]+$/, ""), mood: '' });
  // Look up the hidden map target input in the DOM and reset its value
  document.getElementById('hiddenNewMapTarget').value = '';
  renderEpisodeMaps();
  saveEpisodeDetails();
}

function updateEpisodeMap(mapIndex, fieldName, newFieldValue) {
    if (!currentEpisodeData || !currentEpisodeData.maps || !currentEpisodeData.maps[mapIndex]) return;
    
    // Convert string to object if needed
    if (typeof currentEpisodeData.maps[mapIndex] === 'string') {
        const existingMapUrl = currentEpisodeData.maps[mapIndex];
        currentEpisodeData.maps[mapIndex] = { url: existingMapUrl, name: existingMapUrl.split('/').pop().replace(/\.[^/.]+$/, ""), mood: '' };
    }
    
    currentEpisodeData.maps[mapIndex][fieldName] = newFieldValue;
    saveEpisodeDetails();
}

async function removeMapFromEpisode(mapIndex) {
  const isConfirmed = typeof vtmConfirm === 'function'
    ? await vtmConfirm('Remove this map from the episode?', 'Remove Episode Map')
    : true;
  if (!isConfirmed) return;
  currentEpisodeData.maps.splice(mapIndex, 1);
  renderEpisodeMaps();
  saveEpisodeDetails();
}

function pushMapToCityMap(mapImageUrl) {
  if (!activeChronicleId) return;
  // Perform an authenticated HTTP POST request to set the active city map on the live gameboard
  authFetch('/api/gameboard/map', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    // Serialize the chronicle ID and map URL into a JSON payload
    body: JSON.stringify({
      chronicle_id: activeChronicleId,
      map_url: mapImageUrl
    })
  }).then(() => {
    // Display a native browser alert confirming the map was pushed to the gameboard
    alert('Map pushed to live Gameboard!');
    // Look up the workshop minimap image element in the DOM and update its source
    const minimapImageElement = document.getElementById('workshopMinimapImg');
    if (minimapImageElement) minimapImageElement.src = mapImageUrl;
    loadCampaignPins(mapImageUrl);
  });
}

function renderEpisodeMaps() {
  // Look up the episode maps list container element in the DOM by ID
  const episodeMapsContainerElement = document.getElementById('epMapsListContainer');
  if (!episodeMapsContainerElement || !currentEpisodeData) return;
  let episodeMapsList = currentEpisodeData.maps;
  if (typeof episodeMapsList === 'string') {
    try {
      // Parse the JSON string of episode maps into an array
      episodeMapsList = JSON.parse(episodeMapsList);
    } catch (jsonParseError) {
      episodeMapsList = [];
    }
  }
  if (!Array.isArray(episodeMapsList)) episodeMapsList = [];
  currentEpisodeData.maps = episodeMapsList;
  if (episodeMapsList.length === 0) {
    episodeMapsContainerElement.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No maps added. Click Add Map to upload or link one.</div>';
    return;
  }
  episodeMapsContainerElement.innerHTML = '';
  episodeMapsList.forEach((mapEntry, mapIndex) => {
    const normalizedMapObject = typeof mapEntry === 'string' ? { url: mapEntry, name: mapEntry.split('/').pop().replace(/\.[^/.]+$/, ""), mood: '' } : mapEntry;
    
    // Create a <div> element in memory for the episode map row
    const mapRowElement = document.createElement('div');
    mapRowElement.style.cssText = "display:flex; align-items:center; gap:8px; background:#140e11; padding:6px; border-radius:4px; border:1px solid #372128;";
    mapRowElement.style.cursor = 'pointer';
    mapRowElement.onclick = () => {
        // Look up the workshop minimap image element in the DOM and switch its preview to this map
        const minimapImageElement = document.getElementById('workshopMinimapImg');
        if (minimapImageElement) minimapImageElement.src = normalizedMapObject.url;
        loadCampaignPins(normalizedMapObject.url);
    };
    mapRowElement.innerHTML = `
        <img src="${normalizedMapObject.url}" style="width:40px; height:40px; object-fit:cover; border-radius:2px; border:1px solid #7f1d1d;">
        <div style="flex:1; display:flex; flex-direction:column; gap:4px; overflow:hidden;">
            <input type="text" class="vtm-input" style="font-size:11px; padding:2px 4px; height:auto;" value="${escapeHtml(normalizedMapObject.name || '')}" placeholder="Scene Location" onchange="updateEpisodeMap(${mapIndex}, 'name', this.value)" onclick="event.stopPropagation()">
            <input type="text" class="vtm-input" style="font-size:11px; padding:2px 4px; height:auto; color:#9ca3af;" value="${escapeHtml(normalizedMapObject.mood || '')}" placeholder="Scene Mood" onchange="updateEpisodeMap(${mapIndex}, 'mood', this.value)" onclick="event.stopPropagation()">
        </div>
        <div style="width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:10px; color:#6b7280; text-align:right;" title="${normalizedMapObject.url}">${normalizedMapObject.url.split('/').pop()}</div>
        <button class="btn-card-ctrl" onclick="event.stopPropagation(); removeMapFromEpisode(${mapIndex})" style="color:#ef4444;"><i class="fa-solid fa-trash"></i></button>
    `;
    // Append the map row element into the episode maps container in the DOM
    episodeMapsContainerElement.appendChild(mapRowElement);
  });
  // Look up the workshop minimap image element in the DOM by ID
  const minimapImageElement = document.getElementById('workshopMinimapImg');
  if (minimapImageElement) {
      console.log("[DEBUG] renderEpisodeMaps - maps length:", episodeMapsList.length);
      if (episodeMapsList.length > 0) {
          const firstMapUrl = typeof episodeMapsList[0] === 'string' ? episodeMapsList[0] : episodeMapsList[0].url;
          console.log("[DEBUG] renderEpisodeMaps - setting src to:", firstMapUrl);
          minimapImageElement.src = firstMapUrl;
          loadCampaignPins(firstMapUrl);
      } else {
          console.log("[DEBUG] renderEpisodeMaps - no maps, setting default");
          minimapImageElement.src = '/images/concept_map.jpg';
          loadCampaignPins('/images/concept_map.jpg');
      }
  }
}

function autofillNpcProfile(characterId) {
  // Look up the episode NPC select dropdown element in the DOM by ID
  const npcSelectElement = document.getElementById('epNpcSelect');
  if (!npcSelectElement || !characterId) return;
  const selectedOptionElement = npcSelectElement.options[npcSelectElement.selectedIndex];
  if (selectedOptionElement && selectedOptionElement.dataset.profile) {
    try {
      // Parse the JSON profile data stored in the option's data-profile attribute
      const parsedNpcProfile = JSON.parse(selectedOptionElement.dataset.profile);
      // Populate each NPC profile input element in the DOM by ID if present
      if (parsedNpcProfile.mask) document.getElementById('epNpcMask').value = parsedNpcProfile.mask;
      if (parsedNpcProfile.want) document.getElementById('epNpcWant').value = parsedNpcProfile.want;
      if (parsedNpcProfile.line) document.getElementById('epNpcLine').value = parsedNpcProfile.line;
      if (parsedNpcProfile.mannerisms) document.getElementById('epNpcMannerisms').value = parsedNpcProfile.mannerisms;
      if (parsedNpcProfile.biases) document.getElementById('epNpcBiases').value = parsedNpcProfile.biases;
      if (parsedNpcProfile.secret) document.getElementById('epNpcSecret').value = parsedNpcProfile.secret;
      if (parsedNpcProfile.memories) document.getElementById('epNpcMemories').value = parsedNpcProfile.memories;
    } catch (jsonParseError) {}
  }
}

function openAddEpisodeNpcModal() {
  console.log("Opening Add Episode NPC Modal");
  // Look up the episode NPC select dropdown element in the DOM by ID
  const npcSelectElement = document.getElementById('epNpcSelect');
  if (npcSelectElement) {
    npcSelectElement.innerHTML = '<option value="">Select an NPC...</option>';
    // Perform an authenticated HTTP GET request to fetch all characters for the active chronicle
    authFetch(`/api/chronicles/${activeChronicleId}/characters`).then(fetchResponse => fetchResponse.json()).then(charactersList => {
      if (Array.isArray(charactersList)) {
        charactersList.filter(characterRecord => characterRecord.category === 'npc').forEach(characterRecord => {
          // Create an <option> element in memory for each NPC character
          const optionElement = document.createElement('option');
          optionElement.value = characterRecord.id;
          optionElement.textContent = characterRecord.name;
          if (characterRecord.sheet_data) {
            try {
              // Parse the character's sheet data JSON and attach the profile object as a JSON string attribute
              const parsedSheetData = JSON.parse(characterRecord.sheet_data);
              optionElement.dataset.profile = JSON.stringify(parsedSheetData.profile || ({}));
            } catch (jsonParseError) {}
          }
          // Append the option element into the NPC select dropdown
          npcSelectElement.appendChild(optionElement);
        });
      }
    }).catch(console.error);
  }
  // Reset all NPC modal form fields in the DOM by ID
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
  // Look up the NPC select dropdown and custom name input elements in the DOM by ID
  const npcSelectElement = document.getElementById('epNpcSelect');
  let npcName = document.getElementById('epNpcCustomName').value;
  if (!npcName && npcSelectElement && npcSelectElement.selectedIndex > 0) {
    npcName = npcSelectElement.options[npcSelectElement.selectedIndex].textContent;
  }
  // Display a native browser alert if no NPC name was selected or entered
  if (!npcName) return alert("Must provide or select an NPC name.");
  // Read the NPC agenda profile fields from the DOM input elements by ID
  const npcMaskTruth = document.getElementById('epNpcMask').value;
  const npcCurrentWant = document.getElementById('epNpcWant').value;
  const npcLineInSand = document.getElementById('epNpcLine').value;
  const npcMannerisms = document.getElementById('epNpcMannerisms').value;
  const npcBiases = document.getElementById('epNpcBiases').value;
  const npcHiddenSecret = document.getElementById('epNpcSecret').value;
  const npcActiveMemories = document.getElementById('epNpcMemories').value;
  const npcGeneralWants = document.getElementById('epNpcWants').value;
  if (!currentEpisodeData) currentEpisodeData = {};
  while (typeof currentEpisodeData.npc_agendas === 'string') {
    try {
      // Parse the JSON string of NPC agendas into an array
      currentEpisodeData.npc_agendas = JSON.parse(currentEpisodeData.npc_agendas);
    } catch (jsonParseError) {
      currentEpisodeData.npc_agendas = [];
      break;
    }
  }
  if (!Array.isArray(currentEpisodeData.npc_agendas)) {
    currentEpisodeData.npc_agendas = [];
  }
  const episodeNpcAgendasList = currentEpisodeData.npc_agendas;
  episodeNpcAgendasList.push({
    name: npcName,
    mask: npcMaskTruth,
    want: npcCurrentWant,
    line: npcLineInSand,
    mannerisms: npcMannerisms,
    biases: npcBiases,
    secret: npcHiddenSecret,
    memories: npcActiveMemories,
    wants: npcGeneralWants
  });
  console.log('[Trace][Episode] Pushed new NPC agenda. Count:', episodeNpcAgendasList.length);
  // Perform an authenticated HTTP PUT request to save the updated NPC agendas list to the episode
  authFetch(`/api/episodes/${activeEpisodeId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    // Serialize the updated NPC agendas array into a JSON string payload
    body: JSON.stringify({
      npc_agendas: episodeNpcAgendasList
    })
  }).then(fetchResponse => fetchResponse.json()).then(() => {
    closeModal('addEpisodeNpcModal');
    // Query the DOM for the episode list item button matching the active episode and trigger a click
    const episodeListButtonElement = document.querySelector(`.list-group-item[onclick="loadEpisode(${activeEpisodeId})"]`);
    if (episodeListButtonElement) episodeListButtonElement.click();
  });
}



async function renderChronicleTimelineEpisodes() {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch all episodes and campaigns for the active chronicle
    const [fetchResponse, chronResponse] = await Promise.all([
      authFetch(`/api/episodes?chronicle_id=${activeChronicleId}`),
      authFetch(`/api/chronicles/${activeChronicleId}/campaigns`).catch(() => null)
    ]);
    if (!fetchResponse.ok) return;
    // Parse the JSON response into an array of episode records
    let episodeRecordsList = await fetchResponse.json();
    let campaignsList = [];
    if (chronResponse && chronResponse.ok) {
      try {
        campaignsList = await chronResponse.json();
      } catch (e) {}
    }
    if (!Array.isArray(campaignsList) || campaignsList.length === 0) {
      const chronRec = (Array.isArray(allChroniclesData) ? allChroniclesData : []).find(c => Number(c.id) === Number(activeChronicleId));
      if (chronRec && Array.isArray(chronRec.campaigns)) {
        campaignsList = chronRec.campaigns;
      }
    }
    // Look up the story timeline sidebar element in the DOM by ID
    const timelineSidebarElement = document.getElementById('storyTimelineSidebar');
    if (!timelineSidebarElement) return;
    
    const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
    let timelineSidebarHtml = '';

    // Build ordered Campaign groups so each Campaign shows its own Episode 1..X sequence
    const campaignMap = new Map();
    if (Array.isArray(campaignsList)) {
      campaignsList
        .slice()
        .sort((a, b) => Number(a.id) - Number(b.id))
        .forEach((camp, idx) => {
          campaignMap.set(Number(camp.id), {
            id: Number(camp.id),
            index: idx + 1,
            title: camp.title || `Campaign ${idx + 1}`,
            episodes: []
          });
        });
    }
    (Array.isArray(episodeRecordsList) ? episodeRecordsList : []).forEach(ep => {
      const cId = Number(ep.campaign_id || 0);
      if (!campaignMap.has(cId)) {
        const nextIdx = campaignMap.size + 1;
        campaignMap.set(cId, {
          id: cId,
          index: nextIdx,
          title: ep.campaign_title || (cId === 5 ? 'The Labrynth' : cId === 6 ? 'The Crossroads' : `Campaign ${nextIdx}`),
          episodes: []
        });
      }
      campaignMap.get(cId).episodes.push(ep);
    });

    const orderedGroups = Array.from(campaignMap.values()).filter(g => g.episodes.length > 0);
    const flatSortedEpisodes = [];

    orderedGroups.forEach((group, groupIdx) => {
      group.episodes.sort((a, b) => Number(a.episode_number) - Number(b.episode_number));
      const hasLiveInGroup = group.episodes.some(ep => window.liveGameboardEpisodeId && Number(ep.id) === Number(window.liveGameboardEpisodeId));
      timelineSidebarHtml += `
        <div style="position: relative; margin-top: ${groupIdx === 0 ? '0px' : '12px'}; margin-bottom: 4px; padding: 5px 8px; background: ${hasLiveInGroup ? 'rgba(185, 28, 28, 0.22)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${hasLiveInGroup ? 'rgba(239, 68, 68, 0.45)' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 5px; margin-left: -8px;">
          <div style="font-size: 9px; color: #f87171; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Campaign ${group.index}</div>
          <div style="font-size: 11px; color: #f3f4f6; font-family: 'Cinzel', serif; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(group.title)}">${escapeHtml(group.title)}</div>
        </div>
      `;

      group.episodes.forEach(episodeRecord => {
        flatSortedEpisodes.push(episodeRecord);
        const isRevealed = Boolean(episodeRecord.revealed) || (window.liveGameboardEpisodeId && Number(episodeRecord.id) === Number(window.liveGameboardEpisodeId));
        const isLiveEp = Boolean(window.liveGameboardEpisodeId && Number(episodeRecord.id) === Number(window.liveGameboardEpisodeId));
        
        if (!isRevealed && !isStoryteller) {
            // Locked episode for players
            timelineSidebarHtml += `
              <div style="position: relative; cursor: not-allowed; opacity: 0.5;">
                  <div style="position: absolute; left: -21px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: #6b7280;"></div>
                  <div style="font-size: 10px; color: #6b7280; font-weight: bold;">Ep ${episodeRecord.episode_number}</div>
                  <div style="font-size: 12px; color: #9ca3af; font-family: 'Cinzel', serif; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Classified</div>
                  <i class="fa-solid fa-lock" style="position: absolute; right: 0; top: 4px; font-size: 10px; color: #ef4444;"></i>
              </div>
            `;
        } else {
            // Revealed episode or GM view
            const isHiddenBadge = (!isRevealed && isStoryteller) ? '<i class="fa-solid fa-eye-slash" style="color:#ef4444; margin-left:4px;" title="Hidden from players"></i>' : '';
            const liveBadge = isLiveEp ? '<span style="font-size:8px; padding:1px 4px; border-radius:3px; background:rgba(16,185,129,0.2); color:#34d399; border:1px solid rgba(16,185,129,0.5); margin-left:4px;">LIVE</span>' : '';
            
            timelineSidebarHtml += `
              <div style="position: relative; cursor: pointer; transition: all 0.2s;" class="timeline-ep-item" data-ep-id="${episodeRecord.id}" onclick="loadTimelineEpisodeDetail(${episodeRecord.id}, this)" onmouseover="this.style.transform='translateX(2px)'" onmouseout="this.style.transform='none'">
                  <div class="timeline-dot" style="position: absolute; left: -21px; top: 4px; width: 8px; height: 8px; border-radius: 50%; background: ${isLiveEp ? '#10b981' : '#9ca3af'}; transition: all 0.2s;"></div>
                  <div style="font-size: 10px; color: #9ca3af; font-weight: bold;" class="timeline-ep-num">Ep ${episodeRecord.episode_number} ${isHiddenBadge}${liveBadge}</div>
                  <div style="font-size: 12px; color: #d1d5db; font-family: 'Cinzel', serif; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" class="timeline-ep-title">${escapeHtml(episodeRecord.title)}</div>
              </div>
            `;
        }
      });
    });

    timelineSidebarElement.innerHTML = timelineSidebarHtml;
    const targetAutoEpId = window.liveGameboardEpisodeId || (flatSortedEpisodes.find(e => e.revealed) || flatSortedEpisodes[0])?.id;
    const timelineContentEl = document.getElementById('storyTimelineContent');
    if (targetAutoEpId && timelineContentEl && (timelineContentEl.innerText.includes('Select an episode') || window.lastTimelineLoadedEpId === Number(targetAutoEpId))) {
      const itemEl = timelineSidebarElement.querySelector(`.timeline-ep-item[data-ep-id="${targetAutoEpId}"]`);
      if (itemEl) {
        window.lastTimelineLoadedEpId = Number(targetAutoEpId);
        loadTimelineEpisodeDetail(targetAutoEpId, itemEl);
      }
    }
  } catch (errorObject) {
    // Log any error loading story timeline episodes to the developer console
    console.error('Failed to load story episodes:', errorObject);
  }
}

async function loadTimelineEpisodeDetail(episodeId, clickedTimelineItemElement) {
    // Query all timeline dots in the DOM and reset their styles to inactive
    document.querySelectorAll('.timeline-ep-item .timeline-dot').forEach(timelineDotElement => {
        timelineDotElement.style.background = '#9ca3af';
        timelineDotElement.style.boxShadow = 'none';
        timelineDotElement.style.transform = 'none';
        timelineDotElement.style.left = '-21px';
        timelineDotElement.style.width = '8px';
        timelineDotElement.style.height = '8px';
    });
    // Query all timeline episode number and title labels in the DOM and reset their text colors
    document.querySelectorAll('.timeline-ep-item .timeline-ep-num').forEach(labelElement => labelElement.style.color = '#9ca3af');
    document.querySelectorAll('.timeline-ep-item .timeline-ep-title').forEach(labelElement => labelElement.style.color = '#d1d5db');
    
    // Highlight active dot inside the clicked timeline item element
    if (clickedTimelineItemElement) {
        // Query the timeline dot child element within the clicked item
        const timelineDotElement = clickedTimelineItemElement.querySelector('.timeline-dot');
        if (timelineDotElement) {
            timelineDotElement.style.background = '#ef4444';
            timelineDotElement.style.boxShadow = '0 0 8px #ef4444';
            timelineDotElement.style.left = '-23px';
            timelineDotElement.style.width = '12px';
            timelineDotElement.style.height = '12px';
        }
        // Query the episode number and title child elements within the clicked item
        const episodeNumberElement = clickedTimelineItemElement.querySelector('.timeline-ep-num');
        if (episodeNumberElement) episodeNumberElement.style.color = '#fca5a5';
        const episodeTitleElement = clickedTimelineItemElement.querySelector('.timeline-ep-title');
        if (episodeTitleElement) episodeTitleElement.style.color = '#ffffff';
    }

    // Look up the story timeline content container in the DOM by ID
    const timelineContentContainerElement = document.getElementById('storyTimelineContent');
    if (!timelineContentContainerElement) return;
    
    timelineContentContainerElement.innerHTML = '<div style="display:flex; height:100%; align-items:center; justify-content:center; color:#ef4444;"><i class="fa-solid fa-circle-notch fa-spin text-2xl"></i></div>';
    
    try {
        // Perform an authenticated HTTP GET request to fetch the episode details for the timeline view
        const fetchResponse = await authFetch(`/api/episodes/${episodeId}`);
        if (!fetchResponse.ok) throw new Error('Failed to fetch');
        // Parse the JSON response into an episode record object
        const episodeRecord = await fetchResponse.json();
        
        const campaignTitleBadge = episodeRecord.campaign_title
            ? `<div style="font-size: 10px; background: rgba(255,255,255,0.08); color: #e5e7eb; border: 1px solid rgba(255,255,255,0.15); display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-bottom: 16px; margin-right: 6px; letter-spacing: 0.8px; text-transform: uppercase;">${escapeHtml(episodeRecord.campaign_title)}</div>`
            : '';
        let episodeDetailHtml = `
            <h2 style="font-family: 'Cinzel', serif; font-size: 20px; color: #ffffff; font-weight: bold; margin: 0 0 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">${escapeHtml(episodeRecord.title)}</h2>
            ${campaignTitleBadge}<div style="font-size: 10px; background: rgba(239,68,68,0.2); color: #fca5a5; display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: bold; margin-bottom: 16px; letter-spacing: 1px;">EPISODE ${episodeRecord.episode_number}</div>
        `;
        
        if (episodeRecord.location) {
            episodeDetailHtml += `
                <div style="margin-bottom: 16px;">
                    <div style="font-size: 10px; color: #ef4444; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;"><i class="fa-solid fa-location-dot"></i> Primary Location</div>
                    <div style="font-size: 13px; color: #d1d5db;">${escapeHtml(episodeRecord.location)}</div>
                </div>
            `;
        }
        

        episodeDetailHtml += `
            <div style="margin-bottom: 20px;">
                <div style="font-size: 10px; color: #ef4444; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;"><i class="fa-solid fa-file-lines"></i> Episode Synopsis</div>
                <div style="font-size: 13px; color: #d1d5db; line-height: 1.6; white-space: pre-wrap; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">${escapeHtml(episodeRecord.hook || 'No archival hook available for this episode.')}</div>
            </div>
            <div>
                <div style="font-size: 10px; color: #3b82f6; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;"><i class="fa-solid fa-feather"></i> Episode Summary</div>
                <div style="font-size: 13px; color: #d1d5db; line-height: 1.6; white-space: pre-wrap; background: rgba(0,0,0,0.4); padding: 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05);">${escapeHtml(episodeRecord.fallout_notes || 'No summary has been written for this episode yet.')}</div>
            </div>
        `;

        
        timelineContentContainerElement.innerHTML = episodeDetailHtml;
    } catch(errorObject) {
        timelineContentContainerElement.innerHTML = '<div style="color:#ef4444; text-align:center; padding:20px;">Error loading episode archive.</div>';
    }
}

function openSealedEpisodeWidget(episodeId, episodeNumber) {
  // Look up the clue detail widget and its title and body elements in the DOM by ID
  let clueDetailWidgetElement = document.getElementById('widget-clue-detail');
  let clueDetailTitleElement = document.getElementById('clueDetailTitle');
  let clueDetailBodyElement = document.getElementById('clueDetailBody');
  if (clueDetailTitleElement) clueDetailTitleElement.innerText = `Episode ${episodeNumber}: Sealed`;
  let sealedEpisodeHtml = `
        <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #3f3f46; text-align:center;">
            <div style="font-size:18px; color:#ef4444; font-weight:bold; margin-bottom:10px;"><i class="fa-solid fa-lock"></i> TOP SECRET</div>
            <div style="font-size:14px; color:#d1d5db;">This episode has not been revealed yet.</div>
        </div>
    `;
  if (clueDetailBodyElement) clueDetailBodyElement.innerHTML = sealedEpisodeHtml;
  if (clueDetailWidgetElement) {
    clueDetailWidgetElement.style.display = 'flex';
    bringDesktopWidgetToFront(clueDetailWidgetElement);
  }
}

function openEpisodeDetailWidget(episodeId) {
  // Perform an authenticated HTTP GET request to fetch the episode details by ID
  authFetch(`/api/episodes/${episodeId}`).then(fetchResponse => fetchResponse.json()).then(episodeRecord => {
    // Look up the clue detail widget and its title and body elements in the DOM by ID
    let clueDetailWidgetElement = document.getElementById('widget-clue-detail');
    let clueDetailTitleElement = document.getElementById('clueDetailTitle');
    let clueDetailBodyElement = document.getElementById('clueDetailBody');
    if (clueDetailTitleElement) clueDetailTitleElement.innerText = `Episode ${episodeRecord.episode_number}: ${episodeRecord.title}`;
    let episodeDetailHtml = `
            <div style="margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #3f3f46;">
                <div style="font-size:10px; color:#a855f7; font-weight:bold; text-transform:uppercase;">Location</div>
                <div style="font-size:12px; color:#9ca3af;">${escapeHtml(episodeRecord.location || 'Unknown')}</div>
            </div>
            <div>
                <div style="font-size:10px; color:#ef4444; font-weight:bold; text-transform:uppercase; margin-bottom:5px;">Episode Synopsis</div>
                <div style="white-space:pre-wrap; margin-bottom: 15px;">${escapeHtml(episodeRecord.hook || 'No synopsis available.')}</div>
                <div style="font-size:10px; color:#3b82f6; font-weight:bold; text-transform:uppercase; margin-bottom:5px;">Episode Summary</div>
                <div style="white-space:pre-wrap;">${escapeHtml(episodeRecord.fallout_notes || 'No summary available.')}</div>
            </div>
        `;
    if (clueDetailBodyElement) clueDetailBodyElement.innerHTML = episodeDetailHtml;
    if (clueDetailWidgetElement) {
      clueDetailWidgetElement.style.display = 'flex';
      bringDesktopWidgetToFront(clueDetailWidgetElement);
    }
  });
}


function clearEpisodeDetailsPane() {
  const episodeTitleElement = document.getElementById('activeEpTitle') || document.getElementById('epDetailTitle');
  if (episodeTitleElement) episodeTitleElement.innerText = 'No Episode Selected';
  const episodeTitleInputElement = document.getElementById('epTitleInput');
  if (episodeTitleInputElement) episodeTitleInputElement.value = '';
  const episodeLocationInputElement = document.getElementById('epLocation');
  if (episodeLocationInputElement) episodeLocationInputElement.value = '';
  const episodeHookInputElement = document.getElementById('epHook');
  if (episodeHookInputElement) episodeHookInputElement.value = '';
  const episodeConceptsInputElement = document.getElementById('epConcepts');
  if (episodeConceptsInputElement) episodeConceptsInputElement.value = '';
  const episodeSummaryInputElement = document.getElementById('epSummary');
  if (episodeSummaryInputElement) episodeSummaryInputElement.value = '';
  const episodeAgendasListElement = document.getElementById('epAgendasList');
  if (episodeAgendasListElement) episodeAgendasListElement.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No episode selected.</div>';
  const episodeScenesListElement = document.getElementById('epScenesList');
  if (episodeScenesListElement) episodeScenesListElement.innerHTML = '';
  const episodeMapsContainerElement = document.getElementById('epMapsListContainer');
  if (episodeMapsContainerElement) episodeMapsContainerElement.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No episode selected.</div>';
  const clueMatricesContainerElement = document.getElementById('clueMatricesContainer');
  if (clueMatricesContainerElement) clueMatricesContainerElement.innerHTML = '';
  const loreMatricesContainerElement = document.getElementById('loreMatricesContainer');
  if (loreMatricesContainerElement) loreMatricesContainerElement.innerHTML = '';
  updatePushEpisodeHeaderBtn();
}

window.loadEpisodes = loadCampaignsList;

async function deleteActiveCampaign() {
  // Read the currently selected campaign ID from the campaign dropdown in the DOM
  const selectedCampaignId = document.getElementById('campaignSelect').value;
  if (!selectedCampaignId) return;
  const isDeletionConfirmed = await vtmConfirm('Are you sure you want to delete this Campaign/Arc and all its episodes?', 'Delete Campaign');
  if (!isDeletionConfirmed) return;
  try {
    // Perform an authenticated HTTP DELETE request to delete the selected campaign on the server
    const fetchResponse = await authFetch(`/api/campaigns/${selectedCampaignId}`, { method: 'DELETE' });
    if (fetchResponse.ok) {
      if (Number(activeSubCampaignId) === Number(selectedCampaignId)) {
        activeSubCampaignId = null;
        activeEpisodeId = null;
        currentEpisodeData = null;
      }
      await loadCampaignsList();
      if (typeof renderChronicleTimelineEpisodes === 'function') renderChronicleTimelineEpisodes();
      if (typeof loadGameboardState === 'function') loadGameboardState();
    } else {
      // Parse the error response JSON payload from the server
      const responsePayload = await fetchResponse.json();
      vtmAlert(responsePayload.error || 'Failed to delete campaign', 'Error');
    }
  } catch (errorObject) {
    // Log any network or unexpected error to the developer console
    console.error(errorObject);
  }
}

async function deleteEpisode(episodeId, clickEventObject) {
  if (clickEventObject) clickEventObject.stopPropagation();
  const isDeletionConfirmed = await vtmConfirm('Are you sure you want to delete this episode?', 'Delete Episode');
  if (!isDeletionConfirmed) return;
  try {
    // Perform an authenticated HTTP DELETE request to remove the episode from the server
    const fetchResponse = await authFetch(`/api/episodes/${episodeId}`, { method: 'DELETE' });
    if (fetchResponse.ok) {
      if (Number(activeEpisodeId) === Number(episodeId)) {
        activeEpisodeId = null;
        currentEpisodeData = null;
        clearEpisodeDetailsPane();
      }
      await loadCampaignsList();
      if (typeof renderChronicleTimelineEpisodes === 'function') renderChronicleTimelineEpisodes();
      if (typeof loadClueMatricesForWidget === 'function') loadClueMatricesForWidget();
      if (typeof loadLoreMatricesForWidget === 'function') loadLoreMatricesForWidget();
      if (typeof loadGameboardState === 'function') loadGameboardState();
    } else {
      // Parse the error response JSON payload from the server
      const responsePayload = await fetchResponse.json();
      vtmAlert(responsePayload.error || 'Failed to delete episode', 'Error');
    }
  } catch (errorObject) {
    // Log any network or unexpected error to the developer console
    console.error(errorObject);
  }
}


async function updateCharacterNpcField(characterId, npcFieldName, newFieldValue) {
    try {
        // Perform an authenticated HTTP PUT request to update a specific 7-point NPC profile field
        const fetchResponse = await authFetch('/api/characters/' + characterId + '/npc-fields', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Serialize the field name and updated value into a JSON string payload
            body: JSON.stringify({ field: npcFieldName, value: newFieldValue })
        });
        if (!fetchResponse.ok) throw new Error('Failed to update NPC field');
        
        // Update global cache
        if (typeof chronicleCharactersList !== 'undefined') {
            const characterRecord = chronicleCharactersList.find(candidateCharacter => candidateCharacter.id === characterId);
            if (characterRecord) characterRecord[npcFieldName] = newFieldValue;
        }

        // Look up and update the character vault NPC profile input in the DOM if open
        const sheetNpcFieldInputElement = document.getElementById('sheet_npc_' + npcFieldName);
        if (sheetNpcFieldInputElement && currentLoadedCharacterId === characterId) sheetNpcFieldInputElement.value = newFieldValue;

        // Look up and update the Storyteller Workshop NPC field input in the DOM if rendered
        const workshopNpcFieldInputElement = document.getElementById('workshop_npc_' + characterId + '_' + npcFieldName);
        if (workshopNpcFieldInputElement) workshopNpcFieldInputElement.value = newFieldValue;

    } catch (errorObject) {
        // Log the error to the developer console and notify the user
        console.error(errorObject);
        alert('Failed to save NPC field update.');
    }
}




window.removeNpcAgenda = function(agendaIndex) {
  if (!currentEpisodeData) currentEpisodeData = {};
  while (typeof currentEpisodeData.npc_agendas === 'string') {
    try {
      // Parse the JSON string of NPC agendas into an array
      currentEpisodeData.npc_agendas = JSON.parse(currentEpisodeData.npc_agendas);
    } catch (jsonParseError) {
      currentEpisodeData.npc_agendas = [];
      break;
    }
  }
  if (!Array.isArray(currentEpisodeData.npc_agendas)) {
    currentEpisodeData.npc_agendas = [];
  }
  const episodeNpcAgendasList = currentEpisodeData.npc_agendas;
  episodeNpcAgendasList.splice(agendaIndex, 1);
  console.log('[Trace][Episode] Removed NPC agenda at index', agendaIndex);
  // Perform an authenticated HTTP PUT request to persist the updated NPC agendas array after removal
  authFetch('/api/episodes/' + activeEpisodeId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    // Serialize the updated NPC agendas array into a JSON string payload
    body: JSON.stringify({ npc_agendas: episodeNpcAgendasList })
  }).then(() => loadEpisodeDetails(activeEpisodeId));
};



async function loadOmniHookAndAgendas() {
  // Look up the Omni widget hook, concepts, and NPC agendas elements in the DOM by ID
  const omniEpisodeHookInputElement = document.getElementById('omniEpHook');
  const omniEpisodeConceptsInputElement = document.getElementById('omniEpConcepts');
  const omniNpcAgendasContainerElement = document.getElementById('omniNpcAgendas');
  if (!omniEpisodeHookInputElement || !omniEpisodeConceptsInputElement || !omniNpcAgendasContainerElement) return;
  if (!activeEpisodeId || !currentEpisodeData) {
      omniEpisodeHookInputElement.value = '';
      omniEpisodeConceptsInputElement.value = '';
      omniNpcAgendasContainerElement.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;">Please load an episode first.</div>';
      return;
  }
  
  const episodeRecord = currentEpisodeData;
  
  omniEpisodeHookInputElement.value = episodeRecord.hook || '';
  omniEpisodeConceptsInputElement.value = episodeRecord.concepts || '';
  // Look up the Omni widget episode summary input element in the DOM by ID
  const omniEpisodeSummaryInputElement = document.getElementById('omniEpSummary');
  if (omniEpisodeSummaryInputElement) {
      omniEpisodeSummaryInputElement.value = episodeRecord.fallout_notes || '';
  }

  omniNpcAgendasContainerElement.innerHTML = '';
  let npcAgendasCardsHtml = '';
  
  if (episodeRecord.npc_agendas && episodeRecord.npc_agendas.length > 0) {
      let campaignCharactersList = [];
      try {
          // Perform an authenticated HTTP GET request to fetch all characters in the active chronicle
          const fetchResponse = await authFetch('/api/characters?campaign_id=' + activeChronicleId + '&_t=' + Date.now());
          if (fetchResponse.ok) campaignCharactersList = await fetchResponse.json();
      } catch(errorObject) { console.error(errorObject); }
      
      episodeRecord.npc_agendas.forEach(agendaEntry => {
          let targetCharacterId = null;
          if (typeof agendaEntry === 'object' && agendaEntry !== null) {
              targetCharacterId = agendaEntry.ref_id || agendaEntry.char_id || agendaEntry.id;
          } else {
              targetCharacterId = agendaEntry;
          }
          
          let resolvedNpcData = null;
          if (targetCharacterId && campaignCharactersList.length > 0) {
              resolvedNpcData = campaignCharactersList.find(characterRecord => characterRecord.id == targetCharacterId);
          }
          if (!resolvedNpcData) resolvedNpcData = agendaEntry; // fallback to legacy raw data
          
          const npcDisplayName = resolvedNpcData.name || 'Unknown';
          const npcCurrentWant = resolvedNpcData.npc_current_want || resolvedNpcData.wants || resolvedNpcData.want;
          const npcMaskTruth = resolvedNpcData.npc_mask_truth || resolvedNpcData.mask;
          const npcLineInSand = resolvedNpcData.npc_taboos || resolvedNpcData.line;
          const npcMannerisms = resolvedNpcData.npc_mannerisms || resolvedNpcData.mannerisms;
          const npcBiases = resolvedNpcData.npc_biases || resolvedNpcData.biases;
          const npcHiddenSecret = resolvedNpcData.npc_hidden_secret || resolvedNpcData.secret;
          const npcActiveMemories = resolvedNpcData.npc_active_memories || resolvedNpcData.memories;
          const npcFactionTimeline = resolvedNpcData.npc_faction_timeline || resolvedNpcData.timeline;

          npcAgendasCardsHtml += `
            <div style="background:#191216; padding:10px; border-radius:6px; margin-bottom:12px; border:1px solid #27272a;">
                <div style="font-size:13px; font-weight:800; color:#10b981; margin-bottom:8px; border-bottom:1px solid #27272a; padding-bottom:4px;"><i class="fa-solid fa-user-secret"></i> ${escapeHtml(npcDisplayName)}</div>
                
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <div><strong style="color:#9ca3af; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Want (Tonight):</strong> 
                        <textarea class="vtm-input" rows="2" style="width:100%; font-size:12px; padding:4px;" onblur="saveNpcAgendaField(${targetCharacterId}, 'npc_current_want', this.value)">${escapeHtml(npcCurrentWant || '')}</textarea></div>
                    
                    <div><strong style="color:#9ca3af; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Mask vs Truth:</strong> 
                        <textarea class="vtm-input" rows="2" style="width:100%; font-size:12px; padding:4px;" onblur="saveNpcAgendaField(${targetCharacterId}, 'npc_mask_truth', this.value)">${escapeHtml(npcMaskTruth || '')}</textarea></div>
                        
                    <div><strong style="color:#9ca3af; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Line in Sand:</strong> 
                        <textarea class="vtm-input" rows="2" style="width:100%; font-size:12px; padding:4px;" onblur="saveNpcAgendaField(${targetCharacterId}, 'npc_taboos', this.value)">${escapeHtml(npcLineInSand || '')}</textarea></div>
                        
                    <div><strong style="color:#9ca3af; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Mannerisms:</strong> 
                        <textarea class="vtm-input" rows="2" style="width:100%; font-size:12px; padding:4px;" onblur="saveNpcAgendaField(${targetCharacterId}, 'npc_mannerisms', this.value)">${escapeHtml(npcMannerisms || '')}</textarea></div>
                        
                    <div><strong style="color:#9ca3af; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Biases:</strong> 
                        <textarea class="vtm-input" rows="2" style="width:100%; font-size:12px; padding:4px;" onblur="saveNpcAgendaField(${targetCharacterId}, 'npc_biases', this.value)">${escapeHtml(npcBiases || '')}</textarea></div>
                        
                    <div><strong style="color:#f59e0b; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Hidden Secret:</strong> 
                        <textarea class="vtm-input" rows="2" style="width:100%; font-size:12px; padding:4px; border-color:#f59e0b55;" onblur="saveNpcAgendaField(${targetCharacterId}, 'npc_hidden_secret', this.value)">${escapeHtml(npcHiddenSecret || '')}</textarea></div>
                        
                    <div><strong style="color:#9ca3af; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Memories:</strong> 
                        <textarea class="vtm-input" rows="2" style="width:100%; font-size:12px; padding:4px;" onblur="saveNpcAgendaField(${targetCharacterId}, 'npc_active_memories', this.value)">${escapeHtml(npcActiveMemories || '')}</textarea></div>
                        
                    <div><strong style="color:#ef4444; font-size:10px; text-transform:uppercase; display:block; margin-bottom:2px;">Timeline/Plot:</strong> 
                        <textarea class="vtm-input" rows="2" style="width:100%; font-size:12px; padding:4px; border-color:#ef444455;" onblur="saveNpcAgendaField(${targetCharacterId}, 'npc_faction_timeline', this.value)">${escapeHtml(npcFactionTimeline || '')}</textarea></div>
                </div>
            </div>`;
      });
  }
  
  if (npcAgendasCardsHtml) {
      omniNpcAgendasContainerElement.innerHTML = npcAgendasCardsHtml;
  } else {
      omniNpcAgendasContainerElement.innerHTML = '<div style="color:#9ca3af;font-size:11px;font-style:italic;">No NPC agendas configured yet.</div>';
  }
}


async function saveEpisodeHookFromOmni(updatedHookText) {
    if (!activeEpisodeId || !currentEpisodeData) return;
    try {
        // Perform an authenticated HTTP PUT request to save the updated episode hook from the Omni widget
        await authFetch(`/api/episodes/${activeEpisodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Serialize the updated hook text into a JSON string payload
            body: JSON.stringify({ hook: updatedHookText })
        });
        currentEpisodeData.hook = updatedHookText;
        // Look up the Workshop episode hook input element in the DOM and keep it synchronized
        const workshopHookInputElement = document.getElementById('epHook');
        if (workshopHookInputElement) workshopHookInputElement.value = updatedHookText;
    } catch (errorObject) { console.error(errorObject); }
}

async function saveEpisodeConceptsFromOmni(updatedConceptsText) {
    if (!activeEpisodeId || !currentEpisodeData) return;
    try {
        // Perform an authenticated HTTP PUT request to save the updated episode concepts from the Omni widget
        await authFetch(`/api/episodes/${activeEpisodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Serialize the updated concepts text into a JSON string payload
            body: JSON.stringify({ concepts: updatedConceptsText })
        });
        currentEpisodeData.concepts = updatedConceptsText;
        // Look up the Workshop episode concepts input element in the DOM and keep it synchronized
        const workshopConceptsInputElement = document.getElementById('epConcepts');
        if (workshopConceptsInputElement) workshopConceptsInputElement.value = updatedConceptsText;
    } catch (errorObject) { console.error(errorObject); }
}

async function saveEpisodeSummaryFromOmni(updatedSummaryText) {
    if (!activeEpisodeId || !currentEpisodeData) return;
    try {
        // Perform an authenticated HTTP PUT request to save the updated episode summary from the Omni widget
        await authFetch(`/api/episodes/${activeEpisodeId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Serialize the episode title, status, hook, and updated fallout notes into a JSON payload
            body: JSON.stringify({
                title: currentEpisodeData.title,
                status: currentEpisodeData.status,
                hook: currentEpisodeData.hook,
                fallout_notes: updatedSummaryText
            })
        });
        currentEpisodeData.fallout_notes = updatedSummaryText;
        // Look up the Workshop episode summary input in the DOM and keep it in sync if open
        const workshopSummaryInputElement = document.getElementById('epSummary');
        if (workshopSummaryInputElement) workshopSummaryInputElement.value = updatedSummaryText;
    } catch (errorObject) {
        // Log any error saving the episode summary to the developer console
        console.error("Failed to save episode summary from omni:", errorObject);
    }
}

async function saveNpcAgendaField(characterId, npcFieldName, updatedFieldValue) {
    try {
        const updateRequestPayload = {};
        updateRequestPayload[npcFieldName] = updatedFieldValue;
        // Perform an authenticated HTTP PUT request to save the updated NPC agenda field on the character record
        await authFetch(`/api/characters/${characterId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            // Serialize the dynamic field update object into a JSON string payload
            body: JSON.stringify(updateRequestPayload)
        });
        // We do NOT call loadCharacters here because it would rebuild the Omni widget and steal focus!
        // We just silently save to the DB. Next time the Omni widget opens, it will fetch fresh.
        console.log("Saved " + npcFieldName + " for character " + characterId);
    } catch (errorObject) {
        // Log any error saving the NPC agenda field to the developer console
        console.error("Failed to save agenda field:", errorObject);
    }
}

function syncWorkshopToOmni(workshopFieldId, updatedFieldValue) {
    if (!currentEpisodeData) return;
    if (workshopFieldId === 'epHook') {
        currentEpisodeData.hook = updatedFieldValue;
        // Look up the hook outline element in the DOM to update only the hook text without a full re-render
        const drawerHookOutlineElement = document.getElementById('drawerHookOutline');
        if (drawerHookOutlineElement) {
            drawerHookOutlineElement.innerHTML = `<div style="margin-bottom:8px;"><strong>The Hook:</strong> ${escapeHtml(currentEpisodeData.hook || 'None')}</div>
                                  <div><strong>Outline / Concepts:</strong> ${escapeHtml(currentEpisodeData.concepts || 'None')}</div>`;
        }
    } else if (workshopFieldId === 'epSummary') {
        currentEpisodeData.fallout_notes = updatedFieldValue;
        // Look up the Omni widget episode summary input in the DOM and synchronize its value
        const omniEpisodeSummaryInputElement = document.getElementById('omniEpSummary');
        if (omniEpisodeSummaryInputElement) omniEpisodeSummaryInputElement.value = updatedFieldValue;
    }
}


window.pushEpisodeToGameboard = async function(targetEpisodeId = null) {
  const epId = targetEpisodeId || activeEpisodeId;
  if (!activeChronicleId || !epId) {
    if (typeof vtmAlert === 'function') vtmAlert('Please select an episode first.', 'Notice');
    else alert('Please select an episode first.');
    return;
  }

  try {
    let epRecord = (currentEpisodeData && Number(currentEpisodeData.id) === Number(epId)) ? currentEpisodeData : null;
    const isEditingCurrentEp = Number(epId) === Number(activeEpisodeId);

    if (isEditingCurrentEp && document.getElementById('epTitleInput')) {
      const editedTitle = document.getElementById('epTitleInput')?.value.trim() || (epRecord ? epRecord.title : 'Untitled Episode');
      const editedLocation = document.getElementById('epLocation')?.value.trim() ?? (epRecord ? epRecord.location : '');
      const editedHook = document.getElementById('epHook')?.value.trim() ?? (epRecord ? epRecord.hook : '');
      const editedConcepts = document.getElementById('epConcepts')?.value.trim() ?? (epRecord ? epRecord.concepts : '');
      const editedSummary = document.getElementById('epSummary')?.value.trim() ?? (epRecord ? epRecord.fallout_notes : '');
      const editedMaps = (currentEpisodeData && Array.isArray(currentEpisodeData.maps)) ? currentEpisodeData.maps : [];

      await authFetch(`/api/episodes/${epId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editedTitle,
          status: 'active',
          revealed: true,
          hook: editedHook,
          concepts: editedConcepts,
          fallout_notes: editedSummary,
          location: editedLocation,
          maps: editedMaps,
          _skipBroadcast: true
        })
      });

      if (epRecord) {
        epRecord.title = editedTitle;
        epRecord.location = editedLocation;
        epRecord.hook = editedHook;
        epRecord.concepts = editedConcepts;
        epRecord.fallout_notes = editedSummary;
        epRecord.revealed = 1;
        epRecord.status = 'active';
        epRecord.maps = editedMaps;
      }
    } else {
      await authFetch(`/api/episodes/${epId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revealed: true, status: 'active', _skipBroadcast: true })
      });
    }

    if (!epRecord) {
      const epRes = await authFetch(`/api/episodes/${epId}`);
      if (epRes.ok) epRecord = await epRes.json();
    }

    let parsedMaps = epRecord ? epRecord.maps : [];
    while (typeof parsedMaps === 'string') {
      try {
        parsedMaps = JSON.parse(parsedMaps || '[]');
      } catch (e) {
        parsedMaps = [];
        break;
      }
    }
    if (!Array.isArray(parsedMaps)) parsedMaps = [];

    let primaryMapObj = null;
    let primaryEpisodeMapUrl = null;
    if (parsedMaps.length > 0) {
      primaryMapObj = typeof parsedMaps[0] === 'string' ? { url: parsedMaps[0], name: '', mood: '' } : parsedMaps[0];
      primaryEpisodeMapUrl = primaryMapObj ? primaryMapObj.url : null;
    }

    const pushedLocation =
      (epRecord && epRecord.location) ||
      (primaryMapObj && primaryMapObj.name) ||
      (epRecord && epRecord.title) ||
      '';
    const pushedMood =
      (epRecord && epRecord.hook) ||
      (primaryMapObj && primaryMapObj.mood) ||
      (epRecord && epRecord.concepts) ||
      '';

    const sceneRes = await authFetch('/api/gameboard/scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chronicle_id: activeChronicleId,
        active_episode_id: Number(epId),
        active_location: pushedLocation,
        active_mood_text: pushedMood,
        active_map_url: primaryEpisodeMapUrl || undefined
      })
    });
    const responsePayload = await sceneRes.json();

    if (responsePayload && responsePayload.success) {
      window.liveGameboardEpisodeId = Number(epId);
      if (responsePayload.state) {
        window.liveGameboardSceneState = responsePayload.state;
      }
      if (primaryEpisodeMapUrl && typeof switchCityMap === 'function') {
        switchCityMap(primaryEpisodeMapUrl);
      }

      // Sync Omni inputs immediately if present
      const omniLocationInput = document.getElementById('omniLocation');
      if (omniLocationInput && pushedLocation) omniLocationInput.value = pushedLocation;
      const omniMoodInput = document.getElementById('omniMood');
      if (omniMoodInput && pushedMood) omniMoodInput.value = pushedMood;

      // Refresh Gameboard, Timeline, Clue/Lore widgets, and Workshop UI
      if (typeof loadGameboardState === 'function') await loadGameboardState();
      if (typeof renderChronicleTimelineEpisodes === 'function') renderChronicleTimelineEpisodes();
      if (typeof loadClueMatricesForWidget === 'function') loadClueMatricesForWidget();
      if (typeof loadLoreMatricesForWidget === 'function') loadLoreMatricesForWidget();
      if (typeof loadOmniUnrevealedClues === 'function') loadOmniUnrevealedClues();
      if (typeof loadOmniUnrevealedLore === 'function') loadOmniUnrevealedLore();
      if (typeof loadOmniHookAndAgendas === 'function') loadOmniHookAndAgendas();
      if (typeof loadCampaignsList === 'function') loadCampaignsList();
      updatePushEpisodeHeaderBtn();

      const epDisplayTitle = (epRecord && epRecord.title) ? epRecord.title : `Episode #${epId}`;
      if (typeof vtmAlert === 'function') {
        vtmAlert(`Episode "${epDisplayTitle}" is now LIVE on the Gameboard and revealed to all players!`, 'Episode Pushed to Gameboard');
      } else {
        alert(`Episode "${epDisplayTitle}" is now LIVE on the Gameboard and revealed to all players!`);
      }
    }
  } catch (err) {
    console.error('Failed to push episode to gameboard:', err);
    if (typeof vtmAlert === 'function') vtmAlert('Failed to push episode to Gameboard.', 'Error');
    else alert('Failed to push episode to Gameboard.');
  }
};

window.toggleEpisodeReveal = function(episodeId, forcedRevealState = null) {
    if (!episodeId) return;
    
    let isCurrentlyRevealed = false;
    // Query the DOM for the episode card element matching the given episode ID
    const episodeCardElement = document.querySelector(`.episode-card-item[data-id="${episodeId}"]`);
    let revealToggleIconElement = null;
    let revealToggleButtonElement = null;
    
    if (episodeCardElement) {
        // Query the reveal toggle button and its icon element inside the episode card
        revealToggleIconElement = episodeCardElement.querySelector('.btn-reveal-toggle i');
        revealToggleButtonElement = episodeCardElement.querySelector('.btn-reveal-toggle');
        if (revealToggleIconElement && revealToggleIconElement.classList.contains('fa-eye')) {
            isCurrentlyRevealed = true;
        }
    }
    
    const nextRevealState = forcedRevealState !== null ? forcedRevealState : !isCurrentlyRevealed;
    
    // Optimistic DOM update
    if (revealToggleIconElement && revealToggleButtonElement) {
        revealToggleIconElement.className = `fa-solid ${nextRevealState ? 'fa-eye' : 'fa-eye-slash'}`;
        revealToggleButtonElement.style.color = nextRevealState ? '#10b981' : '#6b7280';
        revealToggleButtonElement.title = nextRevealState ? 'Currently Revealed to Players. Click to Hide.' : 'Currently Hidden. Click to Reveal.';
        
        revealToggleButtonElement.onclick = (clickEventObject) => {
            clickEventObject.stopPropagation();
            window.toggleEpisodeReveal(episodeId, !nextRevealState);
        };
    }
    
    // Perform an authenticated HTTP PUT request to update the episode's revealed status on the server
    authFetch(`/api/episodes/${episodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Serialize the new revealed boolean state into a JSON string payload
        body: JSON.stringify({ revealed: nextRevealState })
    }).then(fetchResponse => fetchResponse.json()).then(responsePayload => {
        if (typeof renderChronicleTimelineEpisodes === "function") renderChronicleTimelineEpisodes();
    });
};

if (typeof socket !== 'undefined') {
    // Register a Socket.IO event listener to handle real-time error messages sent by the server
    socket.on('error', (socketErrorMessage) => {
        if (typeof socketErrorMessage === 'string' && socketErrorMessage.includes('DATA_INTEGRITY_ERROR')) {
            // Display a native browser alert when a critical data integrity error is reported
            alert(socketErrorMessage + "\n\nThis incident has been logged. Please notify your Storyteller or Administrator.");
        } else {
            // Log general Socket.IO errors to the browser developer console
            console.error('Socket error:', socketErrorMessage);
        }
    });
}
