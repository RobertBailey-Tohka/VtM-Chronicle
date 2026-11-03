/**
 * City Map (widget-city-map), Map Pins, Backdrop Settings, and Interactive Map Entities
 */

window.startLinkMode = function(entityId) {
    if (linkingSourceEntityId === entityId) {
        linkingSourceEntityId = null; // Toggle off if clicked again
    } else {
        linkingSourceEntityId = entityId;
        unlinkingSourceEntityId = null;
    }
    renderCanvasEntities();
};

window.startUnlinkMode = function(entityId) {
    if (unlinkingSourceEntityId === entityId) {
        unlinkingSourceEntityId = null;
    } else {
        unlinkingSourceEntityId = entityId;
        linkingSourceEntityId = null;
    }
    renderCanvasEntities();
};

window.finalizeLinkAction = function(targetEntityId) {
    if (!linkingSourceEntityId && !unlinkingSourceEntityId) return;
    
    if (!canvasState) canvasState = { backdrop: '', entities: [], links: [] };
    if (!canvasState.links || !Array.isArray(canvasState.links)) canvasState.links = [];
    
    if (linkingSourceEntityId) {
        if (linkingSourceEntityId === targetEntityId) return; // Can't link to self
        const existingConnectionLink = canvasState.links.find(
            connectionLink => (connectionLink.from === linkingSourceEntityId && connectionLink.to === targetEntityId) || (connectionLink.from === targetEntityId && connectionLink.to === linkingSourceEntityId)
        );
        if (!existingConnectionLink) {
            canvasState.links.push({
                from: linkingSourceEntityId,
                to: targetEntityId,
                color: '#ef4444'
            });
        }
        linkingSourceEntityId = null;
    } else if (unlinkingSourceEntityId) {
        const existingConnectionIndex = canvasState.links.findIndex(
            connectionLink => (connectionLink.from === unlinkingSourceEntityId && connectionLink.to === targetEntityId) || (connectionLink.from === targetEntityId && connectionLink.to === unlinkingSourceEntityId)
        );
        if (existingConnectionIndex >= 0) {
            canvasState.links.splice(existingConnectionIndex, 1);
        }
        unlinkingSourceEntityId = null;
    }
    
    renderCanvasEntities();
    if (typeof renderSvgConnectors === 'function') renderSvgConnectors();
    debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
};
let saveCanvasTimeout = null;

async function loadGameboardState() {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch the current gameboard state for the active chronicle
    const fetchResponse = await authFetch(`/api/gameboard/state?campaign_id=${activeChronicleId}`);
    if (fetchResponse.status === 403) {
      console.warn('Access denied to campaign table. Redirecting to lobby directory.');
      openChronicleHub();
      return;
    }
    // Parse the JSON response body returned by the server
    const responseData = await fetchResponse.json();
    if (responseData.gameboard) {
      // Look up the episode map selector dropdown element in the DOM by its ID
      const gameboardDropdown = document.getElementById('episodeMapSelector');
      if (gameboardDropdown) {
        gameboardDropdown.innerHTML = '';
        const episodeMapsList = responseData.gameboard.active_episode_maps || [];
        if (episodeMapsList.length === 0) {
          gameboardDropdown.innerHTML = '<option value="/images/concept_map.jpg">Default Concept Map</option>';
        } else {
          window.gameboardActiveEpisodeMapsCache = episodeMapsList; // Cache this globally so pushMapToPlayers can use it without the workshop
          episodeMapsList.forEach((mapEntry, mapIndex) => {
            const mapObject = typeof mapEntry === 'string' ? { url: mapEntry, name: 'Map ' + (mapIndex + 1), mood: '' } : mapEntry;
            // Create a new HTML <option> element in memory for the dropdown menu
            const optionElement = document.createElement('option');
            optionElement.value = mapObject.url;
            
            let displayLabel = mapObject.name || ('Map ' + (mapIndex + 1));
            if (mapObject.mood) displayLabel += ' • ' + mapObject.mood;
            displayLabel += ' (' + mapObject.url.split('/').pop() + ')';
            
            optionElement.innerText = displayLabel;
            gameboardDropdown.appendChild(optionElement);
          });
        }
      }
      
      applySceneState(responseData.gameboard);
      
      // If canvasState didn't set a backdrop, fall back to active_map_url
      if (gameboardDropdown && responseData.gameboard.active_map_url && (!canvasState || !canvasState.backdrop)) {
          gameboardDropdown.value = responseData.gameboard.active_map_url;
      }
    }
    if (responseData.players && responseData.players.length > 0) {
      ;
      renderCoterieTokens(responseData.players);
      populateDicePersonaSelector();
    }
    if (responseData.discoveredClues && responseData.discoveredClues.length > 0) {
      responseData.discoveredClues.forEach(discoveredClueRecord => {
        const existingEpisodeClue = currentEpisodeClues.find(
          episodeClueItem => episodeClueItem.id === `e${discoveredClueRecord.id}` || episodeClueItem.title.toLowerCase() === discoveredClueRecord.title.toLowerCase()
        );
        if (existingEpisodeClue) {
          existingEpisodeClue.status = 'discovered';
          existingEpisodeClue.title = discoveredClueRecord.title;
          existingEpisodeClue.description = discoveredClueRecord.description;
        }
      });
    }
    if (typeof updateClueCardsDisplay === 'function') updateClueCardsDisplay();
    // Look up the discovered clues corkboard container element in the DOM by its ID
    const corkboardElement = document.getElementById('discoveredCluesList');
    corkboardElement.innerHTML = '';
    if (responseData.discoveredClues && responseData.discoveredClues.length > 0) {
      responseData.discoveredClues.forEach(clueRecord => addClueToBoard(clueRecord));
    } else {
      corkboardElement.innerHTML = '<div class="clue-empty-state">No clues uncovered yet. Search the scene!</div>';
    }
    // Look up the discovered lore list container element in the DOM by its ID
    const loreContainerElement = document.getElementById('discoveredLoreList');
    loreContainerElement.innerHTML = '';
    if (responseData.discoveredLore && responseData.discoveredLore.length > 0) {
      responseData.discoveredLore.forEach(loreRecord => addLoreToGameboard(loreRecord));
    } else {
      loreContainerElement.innerHTML = '<div class="clue-empty-state">No setting lore uncovered yet. Question elders and search archives!</div>';
    }
  } catch (errorObject) {
    console.error('Failed to load gameboard state:', errorObject);
  }
}

function toggleAtmosphereBanner() {
  // Look up the atmosphere banner wrapper and toggle icon elements in the DOM by their IDs
  const bannerWrapperElement = document.getElementById('atmosphereBannerWrap');
  const toggleIconElement = document.getElementById('atmosphereToggleIcon');
  if (!bannerWrapperElement) return;
  if (bannerWrapperElement.classList.contains('collapsed')) {
    bannerWrapperElement.classList.remove('collapsed');
    if (toggleIconElement) toggleIconElement.className = 'fa-solid fa-chevron-up';
  } else {
    bannerWrapperElement.classList.add('collapsed');
    if (toggleIconElement) toggleIconElement.className = 'fa-solid fa-chevron-down';
  }
}

function applySceneState(sceneStateData) {
  if (!sceneStateData) return;
  const previousEpisodeId = window.liveGameboardEpisodeId;
  window.liveGameboardSceneState = {
    ...(window.liveGameboardSceneState || {}),
    ...sceneStateData,
  };
  if (sceneStateData.active_episode_id) {
    window.liveGameboardEpisodeId = Number(sceneStateData.active_episode_id);
  }
  if (sceneStateData.active_scene_banner) {
    // Look up the scene banner image element in the DOM by its ID
    const bannerImageElement = document.getElementById('sceneBannerImg') || document.getElementById('sceneBanner');
    if (bannerImageElement) bannerImageElement.src = sceneStateData.active_scene_banner;
  }
  if (sceneStateData.active_location) {
    // Look up the scene location text element in the DOM by its ID
    const locationTextElement = document.getElementById('sceneLocation');
    if (locationTextElement) locationTextElement.innerText = sceneStateData.active_location;
    const omniLoc = document.getElementById('omniLocation');
    if (omniLoc && document.activeElement !== omniLoc) omniLoc.value = sceneStateData.active_location;
  }
  if (sceneStateData.active_mood_text) {
    // Look up the scene mood text element in the DOM by its ID
    const moodTextElement = document.getElementById('sceneMoodText');
    if (moodTextElement) moodTextElement.innerText = sceneStateData.active_mood_text;
    const omniMood = document.getElementById('omniMood');
    if (omniMood && document.activeElement !== omniMood) omniMood.value = sceneStateData.active_mood_text;
  }
  if (sceneStateData.active_npc_persona) {
    // Look up the GM persona display and select elements in the DOM by their IDs
    const personaDisplayElement = document.getElementById('gmPersonaDisplay');
    if (personaDisplayElement) personaDisplayElement.innerText = sceneStateData.active_npc_persona;
    const personaSelectElement = document.getElementById('gmPersonaSelect');
    if (personaSelectElement) personaSelectElement.value = sceneStateData.active_npc_persona;
  }
  if (Array.isArray(sceneStateData.active_episode_maps)) {
    const gameboardDropdown = document.getElementById('episodeMapSelector');
    if (gameboardDropdown) {
      gameboardDropdown.innerHTML = '';
      if (sceneStateData.active_episode_maps.length === 0) {
        gameboardDropdown.innerHTML = '<option value="/images/concept_map.jpg">Default Concept Map</option>';
      } else {
        window.gameboardActiveEpisodeMapsCache = sceneStateData.active_episode_maps;
        sceneStateData.active_episode_maps.forEach((mapEntry, mapIndex) => {
          const mapObject = typeof mapEntry === 'string' ? { url: mapEntry, name: 'Map ' + (mapIndex + 1), mood: '' } : mapEntry;
          const optionElement = document.createElement('option');
          optionElement.value = mapObject.url;
          let displayLabel = mapObject.name || ('Map ' + (mapIndex + 1));
          if (mapObject.mood) displayLabel += ' • ' + mapObject.mood;
          displayLabel += ' (' + (mapObject.url || '').split('/').pop() + ')';
          optionElement.innerText = displayLabel;
          gameboardDropdown.appendChild(optionElement);
        });
      }
    }
  }
  if (sceneStateData.canvas_state) {
    loadCanvasFromState(sceneStateData.canvas_state, false);
  }
  if (sceneStateData.active_map_url) {
    switchCityMap(sceneStateData.active_map_url);
  }
  if (sceneStateData.relationship_map_state && typeof loadRmapState === 'function') {
      const parsedRelationshipMapState = typeof sceneStateData.relationship_map_state === 'string' ? JSON.parse(sceneStateData.relationship_map_state) : sceneStateData.relationship_map_state;
      loadRmapState(parsedRelationshipMapState);
  }
  if (sceneStateData.game_time) {
    // Look up the in-game clock display element in the DOM by its ID
    const clockElement = document.getElementById('gameClock');
    if (clockElement) clockElement.innerText = formatGameTimeString(sceneStateData.game_time);
  }
  if (sceneStateData.active_episode_title) {
    // Look up the header act label element in the DOM by its ID
    const actLabelElement = document.getElementById('headerActLabel');
    if (actLabelElement) {
      const arcTitle = sceneStateData.active_arc_title || `EPISODE ${sceneStateData.active_episode_number || 1}`;
      actLabelElement.innerText = `${arcTitle.toUpperCase()}: ${sceneStateData.active_episode_title.toUpperCase()}`;
    }
  }
  if (sceneStateData.active_episode_id && Number(sceneStateData.active_episode_id) !== Number(previousEpisodeId)) {
    if (typeof renderChronicleTimelineEpisodes === 'function') renderChronicleTimelineEpisodes();
    if (typeof loadClueMatricesForWidget === 'function') loadClueMatricesForWidget();
    if (typeof loadLoreMatricesForWidget === 'function') loadLoreMatricesForWidget();
    if (typeof updatePushEpisodeHeaderBtn === 'function') updatePushEpisodeHeaderBtn();
  }
}

function broadcastSceneUpdate() {
  // Look up the Storyteller omni-drawer location and mood input elements in the DOM by their IDs
  const locationTextValue = document.getElementById('omniLocation').value;
  const moodTextValue = document.getElementById('omniMood').value;
  // Perform an authenticated HTTP POST request to broadcast the updated scene location and mood to all players
  authFetch('/api/gameboard/scene', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chronicle_id: activeChronicleId,
      active_location: locationTextValue,
      active_mood_text: moodTextValue
    })
  });
  toggleWidget('widget-storyteller-omni');
}


function initCanvasEngine() {
  // Retrieve the saved map pan and zoom state from the browser's persistent localStorage
  const savedTransformJson = localStorage.getItem('vtm_map_state');
  if (savedTransformJson) {
      try {
          const parsedTransformState = JSON.parse(savedTransformJson);
          if (parsedTransformState.zoom !== undefined) canvasTransform.zoom = parsedTransformState.zoom;
          if (parsedTransformState.panX !== undefined) canvasTransform.panX = parsedTransformState.panX;
          if (parsedTransformState.panY !== undefined) canvasTransform.panY = parsedTransformState.panY;
      } catch(parseError){}
  }
  applyCanvasTransform();
  // Look up the canvas viewport and stage elements in the DOM by their IDs
  const viewportElement = document.getElementById('canvasViewport');
  const stageElement = document.getElementById('canvasStage');
  if (!viewportElement || !stageElement) return;
  viewportElement.ondragstart = dragEvent => {
    dragEvent.preventDefault();
    return false;
  };
  viewportElement.onmousedown = mouseEvent => {
    if (mouseEvent.button !== 0) return;
    if (typeof mapPinMode !== 'undefined' && mapPinMode) return;
    if (mouseEvent.target.closest('.canvas-card') || mouseEvent.target.closest('.map-pin-marker') || mouseEvent.target.closest('button') || mouseEvent.target.closest('input') || mouseEvent.target.closest('select')) {
      return;
    }
    mouseEvent.preventDefault();
    if (window.getSelection) {
      // Clear any active browser text selection so dragging the canvas does not highlight page text
      window.getSelection().removeAllRanges();
    }
    canvasTransform.isPanning = true;
    canvasTransform.startX = mouseEvent.clientX - canvasTransform.panX;
    canvasTransform.startY = mouseEvent.clientY - canvasTransform.panY;
    viewportElement.style.cursor = 'grabbing';
  };
  if (!canvasListenersAttached) {
    canvasListenersAttached = true;
    // Register a global mousemove listener on the browser window to handle canvas panning, card dragging, and card resizing
    window.addEventListener('mousemove', mouseEvent => {
      if (canvasTransform.isPanning) {
        mouseEvent.preventDefault();
        canvasTransform.panX = mouseEvent.clientX - canvasTransform.startX;
        canvasTransform.panY = mouseEvent.clientY - canvasTransform.startY;
        applyCanvasTransform();
      } else if (activeDragEntity) {
        handleEntityDragMove(mouseEvent);
      } else if (activeResizeEntity) {
        handleEntityResizeMove(mouseEvent);
      } else if (isChatDragging) {
        handleChatDragMove(mouseEvent);
      }
    });
    // Register a global mouseup listener on the browser window to finish panning, dragging, or resizing operations
    window.addEventListener('mouseup', mouseEvent => {
      if (canvasTransform.isPanning) {
        canvasTransform.isPanning = false;
        // Look up the canvas viewport element in the DOM to restore its grab cursor
        const currentViewportElement = document.getElementById('canvasViewport');
        if (currentViewportElement) currentViewportElement.style.cursor = 'grab';
      }
      if (activeDragEntity) { activeDragEntity = null; saveCanvasStateImmediate();
        if (typeof loadMapPins === 'function') loadMapPins();
      }
      if (activeResizeEntity) { activeResizeEntity = null; saveCanvasStateImmediate();
        if (typeof loadMapPins === 'function') loadMapPins();
      }
      if (isChatDragging) {
        isChatDragging = false;
      }
    });
  }
  viewportElement.onwheel = wheelEvent => {
    wheelEvent.preventDefault();
    const zoomDelta = wheelEvent.deltaY < 0 ? 0.08 : -0.08;
    const oldZoom = canvasTransform.zoom;
    const newZoom = Math.min(Math.max(oldZoom + zoomDelta, 0.1), 2.5);
    
    // Measure the viewport element's position on screen using the browser's getBoundingClientRect API
    const viewportBoundingRect = viewportElement.getBoundingClientRect();
    const mouseOffsetX = wheelEvent.clientX - viewportBoundingRect.left;
    const mouseOffsetY = wheelEvent.clientY - viewportBoundingRect.top;
    
    canvasTransform.panX = mouseOffsetX - (mouseOffsetX - canvasTransform.panX) * (newZoom / oldZoom);
    canvasTransform.panY = mouseOffsetY - (mouseOffsetY - canvasTransform.panY) * (newZoom / oldZoom);
    canvasTransform.zoom = newZoom;
    applyCanvasTransform();
  };
  initFloatingChatDraggable();
}

function applyCanvasTransform() {
  // Look up the canvas stage element in the DOM by its ID
  const stageElement = document.getElementById('canvasStage');
  if (!stageElement) return;
  stageElement.style.transform = `translate(${canvasTransform.panX}px, ${canvasTransform.panY}px) scale(${canvasTransform.zoom})`;
  renderSvgConnectors();
  // Query all map pin marker elements in the DOM to counter-scale them so pins stay a readable size while zooming
  const mapPinElements = document.querySelectorAll('.map-pin-marker');
  const inverseZoomScale = 1 / canvasTransform.zoom;
  mapPinElements.forEach(pinMarkerElement => {
    pinMarkerElement.style.transform = `scale(${inverseZoomScale})`;
  });

  // Save the updated zoom and pan coordinates to the browser's persistent localStorage
  localStorage.setItem('vtm_map_state', JSON.stringify({
      zoom: canvasTransform.zoom,
      panX: canvasTransform.panX,
      panY: canvasTransform.panY
  }));
}

function resetCanvasTransform() {
  canvasTransform.panX = -413;
  canvasTransform.panY = -227;
  canvasTransform.zoom = 0.4;
  applyCanvasTransform();
}

function loadCanvasFromState(rawState, shouldPersist = false) {
  if (!rawState) return;
  try {
    const parsedCanvasState = typeof rawState === 'string' ? JSON.parse(rawState) : rawState;
    canvasState = {
      backdrop: parsedCanvasState.backdrop ? parsedCanvasState.backdrop : '/images/concept_map.jpg',
      entities: Array.isArray(parsedCanvasState.entities) ? parsedCanvasState.entities : [],
      links: Array.isArray(parsedCanvasState.links) ? parsedCanvasState.links : []
    };
    // Look up the canvas backdrop image element in the DOM by its ID
    const backdropImageElement = document.getElementById('canvasBackdropImg');
    if (backdropImageElement && canvasState.backdrop) {
      backdropImageElement.src = canvasState.backdrop;
    }
    // Look up the episode map selector dropdown element in the DOM by its ID
    const episodeMapSelector = document.getElementById('episodeMapSelector');
    if (episodeMapSelector && canvasState.backdrop) {
      episodeMapSelector.value = canvasState.backdrop;
    }
    renderCanvasEntities();
    renderSvgConnectors();
    if (shouldPersist) debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  } catch (errorObject) {
    console.error('Failed to parse canvas state:', errorObject);
  }
}

function normalizeCityMapUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  let pathname = rawUrl.trim();
  try {
    if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
      pathname = new URL(pathname).pathname;
    } else {
      pathname = new URL(pathname, window.location.origin).pathname;
    }
  } catch (e) {}
  try {
    pathname = decodeURIComponent(pathname);
  } catch (e) {}
  pathname = pathname.replace(/^\/VtM-Chronicle(?=\/)/i, '');
  return pathname;
}

function getActiveCityMapUrl() {
  const fromState = (typeof canvasState !== 'undefined' && canvasState && canvasState.backdrop) ? canvasState.backdrop : '';
  const backdropAttr = document.getElementById('canvasBackdropImg')?.getAttribute('src') || '';
  const fromSelect = document.getElementById('episodeMapSelector')?.value || '';
  return fromState || backdropAttr || fromSelect || '/images/concept_map.jpg';
}

function renderCanvasEntities() {
  // Look up the canvas entities layer container in the DOM by its ID
  const entitiesContainerElement = document.getElementById('canvasEntitiesLayer');
  if (!entitiesContainerElement) return;
  
  // Look up the current selected map URL in normalized form
  const currentMapUrl = normalizeCityMapUrl(getActiveCityMapUrl());
  let needsSave = false;
  
  // Track valid IDs to remove orphans
  const validEntityDomIds = new Set();
  
  canvasState.entities.forEach(canvasEntity => {
    if (!canvasEntity.mapUrl && currentMapUrl) {
        canvasEntity.mapUrl = currentMapUrl;
        needsSave = true;
    }
    if (canvasEntity.mapUrl && normalizeCityMapUrl(canvasEntity.mapUrl) !== currentMapUrl) return;
    
    validEntityDomIds.add(`canvas-entity-${canvasEntity.id}`);
    
    // Check if a DOM element for this canvas entity already exists on the page
    const existingCardElement = document.getElementById(`canvas-entity-${canvasEntity.id}`);
    if (existingCardElement) {
        // Update position and size without wiping innerHTML
        existingCardElement.style.left = `${canvasEntity.x}px`;
        existingCardElement.style.top = `${canvasEntity.y}px`;
        existingCardElement.style.width = `${canvasEntity.width || 480}px`;
        existingCardElement.style.height = `${canvasEntity.height || 320}px`;
        existingCardElement.style.zIndex = canvasEntity.zIndex || 10;
        
        const colorTheme = CARD_COLOR_THEMES.find(themeOption => themeOption.name === canvasEntity.color) || CARD_COLOR_THEMES[0];
        existingCardElement.style.borderColor = colorTheme.border;
        existingCardElement.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${colorTheme.glow}`;
        
        // Find the card icon element inside the existing card DOM element
        const cardIconElement = existingCardElement.querySelector('.card-icon');
        if (cardIconElement) cardIconElement.style.color = colorTheme.accent;
        
        // Find the palette icon inside the card to update its button accent color
        const paletteIconElement = existingCardElement.querySelector('.fa-palette');
        if (paletteIconElement && paletteIconElement.parentElement) paletteIconElement.parentElement.style.color = colorTheme.accent;

        // Find the textarea editor inside the card to sync its font size and text content
        const textEditorElement = existingCardElement.querySelector('.card-text-editor');
        if (textEditorElement) {
            textEditorElement.style.fontSize = canvasEntity.fontSize || '20px';
            if (document.activeElement !== textEditorElement) {
                textEditorElement.value = canvasEntity.content || '';
            }
        }
        
        // Find the title input inside the card to sync its title value if not currently focused
        const titleInputElement = existingCardElement.querySelector('.card-title-input');
        if (titleInputElement && document.activeElement !== titleInputElement) {
            titleInputElement.value = canvasEntity.title || 'Note';
        }
        
        // Update active link classes by querying all control buttons inside this card
        const cardControlButtons = existingCardElement.querySelectorAll('.btn-card-ctrl');
        cardControlButtons.forEach(buttonElement => {
            if (buttonElement.title === 'Link to another note / marker') {
                if (typeof linkingSourceEntityId !== 'undefined' && linkingSourceEntityId === canvasEntity.id) buttonElement.classList.add('active-link-mode');
                else buttonElement.classList.remove('active-link-mode');
            }
            if (buttonElement.title === 'Break Link') {
                if (typeof unlinkingSourceEntityId !== 'undefined' && unlinkingSourceEntityId === canvasEntity.id) buttonElement.classList.add('active-link-mode');
                else buttonElement.classList.remove('active-link-mode');
            }
        });
    } else {
        const newCardElement = createEntityDomElement(canvasEntity);
        entitiesContainerElement.appendChild(newCardElement);
    }
  });
  
  // Remove orphans
  Array.from(entitiesContainerElement.children).forEach(childElement => {
      if (!validEntityDomIds.has(childElement.id)) {
          childElement.remove();
      }
  });
  
  // If we're in link mode, ensure all cards have crosshair and onclick, else remove them
  Array.from(entitiesContainerElement.children).forEach(cardElement => {
      if (typeof linkingSourceEntityId !== 'undefined' && (linkingSourceEntityId || unlinkingSourceEntityId)) {
          cardElement.style.cursor = 'crosshair';
          cardElement.onclick = (mouseEvent) => {
              mouseEvent.stopPropagation();
              const targetEntityId = cardElement.id.replace('canvas-entity-', '');
              if (typeof finalizeLinkAction === 'function') finalizeLinkAction(targetEntityId);
          };
      } else {
          cardElement.style.cursor = 'default';
          cardElement.onclick = null;
      }
  });
  
  if (needsSave && typeof debouncedSaveCanvasState === 'function') debouncedSaveCanvasState();
}

function createEntityDomElement(canvasEntity) {
  // Create a new <div> element in memory for the canvas card
  const cardElement = document.createElement('div');
  cardElement.id = `canvas-entity-${canvasEntity.id}`;
  cardElement.className = `canvas-card ${canvasEntity.type === 'image' ? 'canvas-image-card' : 'canvas-text-card'}`;
  if (typeof linkingSourceEntityId !== 'undefined' && (linkingSourceEntityId || unlinkingSourceEntityId)) {
      cardElement.style.cursor = 'crosshair';
      cardElement.onclick = (mouseEvent) => {
          mouseEvent.stopPropagation();
          if (typeof finalizeLinkAction === 'function') finalizeLinkAction(String(canvasEntity.id));
      };
  }
  cardElement.style.left = `${canvasEntity.x}px`;
  cardElement.style.top = `${canvasEntity.y}px`;
  cardElement.style.width = `${canvasEntity.width || 480}px`;
  cardElement.style.height = `${canvasEntity.height || 320}px`;
  cardElement.style.zIndex = canvasEntity.zIndex || 10;
  const colorTheme = CARD_COLOR_THEMES.find(themeOption => themeOption.name === canvasEntity.color) || CARD_COLOR_THEMES[0];
  cardElement.style.borderColor = colorTheme.border;
  cardElement.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${colorTheme.glow}`;
  const isImageEntity = canvasEntity.type === 'image';
  const iconClass = isImageEntity ? 'fa-camera' : 'fa-note-sticky';
  cardElement.innerHTML = `
        <div class="card-header" onmousedown="handleEntityDragStart(event, '${canvasEntity.id}')" style="cursor: grab;">
            <div style="display:flex;align-items:center;gap:6px;flex:1;overflow:hidden;">
                <i class="fa-solid fa-grip-vertical" style="opacity: 0.5; padding: 8px 14px 8px 8px; font-size: 24px; cursor: grab;"></i>
                <i class="fa-solid ${iconClass} card-icon" style="color:${colorTheme.accent};"></i>
                <input class="card-title-input" value="${escapeHtml(canvasEntity.title || 'Note')}" onmousedown="if (event.detail > 1) { event.stopPropagation(); } else { event.preventDefault(); }" ondblclick="this.focus()" oninput="debouncedUpdateEntityTitle('${canvasEntity.id}', this.value)" placeholder="Label..." title="Double-click to rename">
            </div>
            <div class="card-header-actions" onmousedown="event.stopPropagation()">
                ${!isImageEntity ? `<button class="btn-card-ctrl" onclick="cycleEntityFontSize('${canvasEntity.id}')" title="Adjust Font Size"><i class="fa-solid fa-text-height"></i></button>` : ''}
                <button class="btn-card-ctrl" onclick="cycleEntityColor('${canvasEntity.id}')" title="Change Mood Color" style="color:${colorTheme.accent};"><i class="fa-solid fa-palette"></i></button>
                <button class="btn-card-ctrl ${linkingSourceEntityId === canvasEntity.id ? 'active-link-mode' : ''}" onclick="event.stopPropagation(); startLinkMode('${canvasEntity.id}')" title="Link to another note / marker"><i class="fa-solid fa-link"></i></button>
                <button class="btn-card-ctrl ${typeof unlinkingSourceEntityId !== 'undefined' && unlinkingSourceEntityId === canvasEntity.id ? 'active-link-mode' : ''}" onclick="event.stopPropagation(); startUnlinkMode('${canvasEntity.id}')" title="Break Link"><i class="fa-solid fa-link-slash"></i></button>
                <button class="btn-card-ctrl" onclick="deleteCanvasEntity('${canvasEntity.id}')" title="Remove Note"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>
        <div class="card-body">
            ${isImageEntity ? `
                <div class="card-image-wrap">
                    <img src="${canvasEntity.imageUrl}" alt="${escapeHtml(canvasEntity.title)}" onerror="this.src='/images/banner_1200x400.jpg'">
                </div>
                ${canvasEntity.caption ? `<div class="card-image-caption" contenteditable="true" onmousedown="event.stopPropagation(); this.focus();" onblur="updateEntityCaption('${canvasEntity.id}', this.innerText)">${escapeHtml(canvasEntity.caption)}</div>` : ''}
            ` : `
                <textarea class="card-text-editor vtm-textarea" style="font-size:${canvasEntity.fontSize || '20px'}; resize:none; background:transparent; border:none; color:inherit; width:100%; height:100%; outline:none; font-family:inherit;" onmousedown="event.stopPropagation();" oninput="debouncedUpdateEntityContent('${canvasEntity.id}', this.value)" placeholder="Write notes, whisperings, or clues here...">${canvasEntity.content || ''}</textarea>
            `}
        </div>
        <div class="card-resize-handle" onmousedown="handleEntityResizeStart(event, '${canvasEntity.id}')"></div>
    `;
  return cardElement;
}


function spawnCanvasTextNote() {
  if (!canvasState) canvasState = {
    backdrop: '',
    entities: [],
    links: []
  };
  if (!canvasState.entities || !Array.isArray(canvasState.entities)) canvasState.entities = [];
  if (!canvasState.links || !Array.isArray(canvasState.links)) canvasState.links = [];
  const noteEntityId = 'note-' + Date.now();
  const spawnPositionX = Math.round(200 - canvasTransform.panX / canvasTransform.zoom);
  const spawnPositionY = Math.round(150 - canvasTransform.panY / canvasTransform.zoom);
  const newNoteEntity = {
    id: noteEntityId,
    type: 'note',
    title: 'Note',
    content: '',
    x: Math.max(20, spawnPositionX),
    y: Math.max(20, spawnPositionY),
    width: 600,
    height: 400,
    color: 'crimson',
    fontSize: '20px',
    zIndex: (canvasState.entities.length + 1) * 2
  };
  canvasState.entities.push(newNoteEntity);
  console.log('[Trace][Canvas] Pushed sticky note. Total:', canvasState.entities.length);
  renderCanvasEntities();
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}

function openAddImageModal() {
  // Look up the add-image modal element in the DOM and mark it active
  document.getElementById('canvasAddImageModal').classList.add('active');
}

function createCanvasImageSubmit() {
  // Look up the image title, URL, and caption input elements in the DOM by their IDs
  const imageTitle = document.getElementById('newCanvasImageTitle').value.trim() || 'Evidence Photograph';
  const imageUrl = document.getElementById('newCanvasImageUrl').value.trim();
  const imageCaption = document.getElementById('newCanvasImageCaption').value.trim();
  if (!imageUrl) {
    // Display a browser alert dialog informing the user that an image URL is required
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
  const imageEntityId = 'img-' + Date.now();
  const spawnPositionX = Math.round(250 - canvasTransform.panX / canvasTransform.zoom);
  const spawnPositionY = Math.round(180 - canvasTransform.panY / canvasTransform.zoom);
  const newImageEntity = {
    id: imageEntityId,
    type: 'image',
    title: imageTitle,
    imageUrl: imageUrl,
    caption: imageCaption,
    x: Math.max(20, spawnPositionX),
    y: Math.max(20, spawnPositionY),
    width: 320,
    height: 240,
    color: 'amber',
    zIndex: (canvasState.entities.length + 1) * 2
  };
  canvasState.entities.push(newImageEntity);
  console.log('[Trace][Canvas] Pushed image entity. Total:', canvasState.entities.length);
  renderCanvasEntities();
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
  closeModal('canvasAddImageModal');
  // Clear the image form input elements in the DOM
  document.getElementById('newCanvasImageTitle').value = '';
  document.getElementById('newCanvasImageUrl').value = '';
  document.getElementById('newCanvasImageCaption').value = '';
}

function openBackdropSettingsModal() {
  // Look up the backdrop settings modal element in the DOM by its ID
  const modalElement = document.getElementById('canvasBackdropModal');
  if (modalElement) {
    // Look up the global backdrop image element in the DOM and read any saved settings from localStorage
    const globalBackdropImageElement = document.getElementById('globalBackdropImg');
    const currentBackdropUrl = (globalBackdropImageElement ? globalBackdropImageElement.src : '') || localStorage.getItem('vtm_global_backdrop') || '/images/elysium_backdrop.jpg';
    const backdropUrlInputElement = document.getElementById('backdropUrlInput');
    if (backdropUrlInputElement) backdropUrlInputElement.value = currentBackdropUrl;
    // Read the saved widget opacity percentage from localStorage
    const currentOpacityPercentage = localStorage.getItem('vtm_widget_opacity') || 82;
    const opacitySliderElement = document.getElementById('widgetOpacitySlider');
    if (opacitySliderElement) opacitySliderElement.value = currentOpacityPercentage;
    const opacityValueTextElement = document.getElementById('widgetOpacityValueText');
    if (opacityValueTextElement) opacityValueTextElement.innerText = `${currentOpacityPercentage}%`;
    // Read the saved backdrop brightness percentage from localStorage
    const currentBrightnessPercentage = localStorage.getItem('vtm_backdrop_brightness') || 100;
    const brightnessSliderElement = document.getElementById('backdropBrightnessSlider');
    if (brightnessSliderElement) brightnessSliderElement.value = currentBrightnessPercentage;
    const brightnessValueTextElement = document.getElementById('backdropBrightnessValueText');
    if (brightnessValueTextElement) brightnessValueTextElement.innerText = `${currentBrightnessPercentage}%`;
    const uploadStatusElement = document.getElementById('backdropUploadStatus');
    if (uploadStatusElement) uploadStatusElement.style.display = 'none';
    
    // Read the list of startup widgets from localStorage
    let startupWidgetsList = localStorage.getItem('vtm_startup_widgets');
    if (!startupWidgetsList) {
        startupWidgetsList = ['widget-chat', 'widget-dice', 'widget-city-map', 'widget-character-dossier'];
    } else {
        try { startupWidgetsList = JSON.parse(startupWidgetsList).map(normalizeWidgetId); } catch(parseError) { startupWidgetsList = []; }
    }
    // Query all startup widget checkbox elements in the DOM to sync their checked states
    document.querySelectorAll('.startup-widget-cb').forEach(checkboxElement => {
        checkboxElement.checked = startupWidgetsList.includes(checkboxElement.value);
    });
    
    modalElement.classList.add('active');
  }
}

function updateWidgetOpacity(opacityValue) {
  const opacityPercentage = parseInt(opacityValue, 10);
  const alphaDecimal = (opacityPercentage / 100).toFixed(2);
  document.documentElement.style.setProperty('--widget-opacity', alphaDecimal);
  // Look up the widget opacity text and slider elements in the DOM by their IDs
  const opacityValueTextElement = document.getElementById('widgetOpacityValueText');
  if (opacityValueTextElement) opacityValueTextElement.innerText = `${opacityPercentage}%`;
  const opacitySliderElement = document.getElementById('widgetOpacitySlider');
  if (opacitySliderElement) opacitySliderElement.value = opacityPercentage;
  // Save the widget opacity percentage to the browser's persistent localStorage
  localStorage.setItem('vtm_widget_opacity', opacityPercentage);
}

function setWidgetOpacityPreset(opacityPresetValue) {
  updateWidgetOpacity(opacityPresetValue);
}

function updateBackdropBrightness(brightnessValue) {
  const brightnessPercentage = parseInt(brightnessValue, 10);
  const brightnessDecimal = (brightnessPercentage / 100).toFixed(2);
  document.documentElement.style.setProperty('--backdrop-brightness', brightnessDecimal);
  // Look up the backdrop brightness text and slider elements in the DOM by their IDs
  const brightnessValueTextElement = document.getElementById('backdropBrightnessValueText');
  if (brightnessValueTextElement) brightnessValueTextElement.innerText = `${brightnessPercentage}%`;
  const brightnessSliderElement = document.getElementById('backdropBrightnessSlider');
  if (brightnessSliderElement) brightnessSliderElement.value = brightnessPercentage;
  // Save the backdrop brightness percentage to the browser's persistent localStorage
  localStorage.setItem('vtm_backdrop_brightness', brightnessPercentage);
}

function setBackdropBrightnessPreset(brightnessPresetValue) {
  updateBackdropBrightness(brightnessPresetValue);
}

async function uploadImageFile(selectedFile, statusElement) {
  if (!selectedFile) return null;
  if (statusElement) {
    statusElement.style.display = 'block';
    statusElement.style.color = '#ef4444';
    statusElement.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading ${escapeHtml(selectedFile.name)}...`;
  }
  return new Promise((resolve, reject) => {
    // Instantiate a browser FileReader to read the selected local image file as a Base64 Data URL
    const fileReader = new FileReader();
    fileReader.onload = async () => {
      try {
        // Perform an authenticated HTTP POST request to upload the Base64-encoded image to the server
        const fetchResponse = await authFetch('/api/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            data: fileReader.result,
            filename: selectedFile.name
          })
        });
        const responseData = await fetchResponse.json();
        if (fetchResponse.ok && responseData.success && responseData.url) {
          if (statusElement) {
            statusElement.style.color = '#10b981';
            statusElement.innerHTML = `<i class="fa-solid fa-circle-check"></i> Image uploaded successfully!`;
          }
          resolve(responseData.url);
        } else {
          const errorMessage = responseData.error || 'Upload failed.';
          if (statusElement) {
            statusElement.style.color = '#ef4444';
            statusElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${escapeHtml(errorMessage)}`;
          }
          reject(new Error(errorMessage));
        }
      } catch (errorObject) {
        if (statusElement) {
          statusElement.style.color = '#ef4444';
          statusElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Network error during upload.`;
        }
        reject(errorObject);
      }
    };
    fileReader.onerror = () => {
      if (statusElement) {
        statusElement.style.color = '#ef4444';
        statusElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Failed to read local file.`;
      }
      reject(new Error('Failed to read file'));
    };
    // Start reading the file contents into a Base64 data URL string using the browser FileReader API
    fileReader.readAsDataURL(selectedFile);
  });
}

async function handleBackdropFileUpload(changeEvent) {
  const selectedFile = changeEvent.target.files && changeEvent.target.files[0];
  if (!selectedFile) return;
  // Look up the backdrop upload status element in the DOM by its ID
  const statusElement = document.getElementById('backdropUploadStatus');
  try {
    const uploadedImageUrl = await uploadImageFile(selectedFile, statusElement);
    if (uploadedImageUrl) {
      // Look up the backdrop URL input and global backdrop image elements in the DOM by their IDs
      const backdropUrlInputElement = document.getElementById('backdropUrlInput');
      if (backdropUrlInputElement) backdropUrlInputElement.value = uploadedImageUrl;
      const globalBackdropImageElement = document.getElementById('globalBackdropImg');
      if (globalBackdropImageElement) globalBackdropImageElement.src = uploadedImageUrl;
      // Save the new global backdrop URL in the browser's persistent localStorage
      localStorage.setItem('vtm_global_backdrop', uploadedImageUrl);
    }
  } catch (errorObject) {
    console.error('Backdrop upload failed:', errorObject);
  }
}

async function handleCanvasImageFileUpload(changeEvent) {
  const selectedFile = changeEvent.target.files && changeEvent.target.files[0];
  if (!selectedFile) return;
  // Look up the canvas image upload status element in the DOM by its ID
  const statusElement = document.getElementById('canvasImageUploadStatus');
  try {
    const uploadedImageUrl = await uploadImageFile(selectedFile, statusElement);
    if (uploadedImageUrl) {
      // Look up the new canvas image URL and title input elements in the DOM by their IDs
      const urlInputElement = document.getElementById('newCanvasImageUrl');
      if (urlInputElement) urlInputElement.value = uploadedImageUrl;
      const titleInputElement = document.getElementById('newCanvasImageTitle');
      if (titleInputElement && !titleInputElement.value.trim()) {
        titleInputElement.value = selectedFile.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
    }
  } catch (errorObject) {
    console.error('Canvas image upload failed:', errorObject);
  }
}

async function handleCityMapUpload(changeEvent) {
  const selectedFile = changeEvent.target.files && changeEvent.target.files[0];
  if (!selectedFile) return;
  try {
    const uploadedMapUrl = await uploadImageFile(selectedFile, null);
    if (uploadedMapUrl) {
      switchCityMap(uploadedMapUrl);
      // Look up the episode map selector dropdown element in the DOM by its ID
      const mapSelectorElement = document.getElementById('episodeMapSelector');
      if (mapSelectorElement) {
        // Create a new <option> element in memory for the uploaded custom map
        const optionElement = document.createElement('option');
        optionElement.value = uploadedMapUrl;
        optionElement.innerText = `Custom Map: ${selectedFile.name.replace(/\.[^/.]+$/, '')}`;
        optionElement.selected = true;
        mapSelectorElement.prepend(optionElement);
      }
      if ((activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') && activeChronicleId) {
        // Perform an authenticated HTTP POST request to set the active gameboard map for the chronicle
        authFetch('/api/gameboard/map', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            chronicle_id: activeChronicleId,
            map_url: uploadedMapUrl
          })
        });
      }
    }
  } catch (errorObject) {
    console.error('Gameboard map upload failed:', errorObject);
    // Display a browser alert dialog informing the user that the map upload failed
    alert('Failed to upload map: ' + errorObject.message);
  }
}

function setBackdropPreset(presetBackdropUrl) {
  // Look up the backdrop URL input element in the DOM by its ID
  const backdropUrlInputElement = document.getElementById('backdropUrlInput');
  if (backdropUrlInputElement) backdropUrlInputElement.value = presetBackdropUrl;
  saveCanvasBackdropSubmit();
}

function saveCanvasBackdropSubmit() {
  // Look up the backdrop URL input element in the DOM by its ID
  const backdropUrl = document.getElementById('backdropUrlInput').value.trim();
  if (backdropUrl) {
      // Look up the global backdrop image element in the DOM by its ID
      const globalBackdropImageElement = document.getElementById('globalBackdropImg');
      if (globalBackdropImageElement) globalBackdropImageElement.src = backdropUrl;
      // Save the backdrop URL to the browser's persistent localStorage
      localStorage.setItem('vtm_global_backdrop', backdropUrl);
  }
  
  // Query all checked startup widget checkboxes in the DOM and save their values to localStorage
  const checkedWidgetIds = Array.from(document.querySelectorAll('.startup-widget-cb:checked')).map(checkboxElement => checkboxElement.value);
  localStorage.setItem('vtm_startup_widgets', JSON.stringify(checkedWidgetIds));
  
  // Immediately apply the new startup widget layout by querying all desktop widgets in the DOM
  document.querySelectorAll('.elysium-widget').forEach(widgetElement => {
      // Exclude special dynamic popups
      if (widgetElement.id === 'widget-clue-detail' || widgetElement.id === 'widget-clue-popout' || widgetElement.id === 'widget-lore-archive-popout') return;
      
      if (checkedWidgetIds.includes(widgetElement.id)) {
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
          // Only hide standard toggleable widgets, don't accidentally hide dynamic ones
          // Check if a corresponding startup checkbox exists in the DOM for this widget ID
          if (document.querySelector(`.startup-widget-cb[value="${widgetElement.id}"]`)) {
              widgetElement.style.display = 'none';
          }
      }
  });
  
  closeModal('canvasBackdropModal');
}

function switchCityMap(mapImageUrl, syncIfGm = false) {
  if (!mapImageUrl) return;
  if (typeof canvasState !== 'undefined' && canvasState) {
    canvasState.backdrop = mapImageUrl;
  }
  // Look up the canvas backdrop image element in the DOM by its ID
  const mapImageElement = document.getElementById('canvasBackdropImg');
  if (mapImageElement) mapImageElement.src = mapImageUrl;

  const mapSelectorElement = document.getElementById('episodeMapSelector');
  if (mapSelectorElement) {
    const targetNorm = normalizeCityMapUrl(mapImageUrl);
    let matchedOpt = Array.from(mapSelectorElement.options || []).find(
      opt => normalizeCityMapUrl(opt.value) === targetNorm
    );
    if (!matchedOpt && mapImageUrl) {
      matchedOpt = document.createElement('option');
      matchedOpt.value = mapImageUrl;
      matchedOpt.innerText = mapImageUrl.split('/').pop() || 'Active Map';
      mapSelectorElement.appendChild(matchedOpt);
    }
    if (matchedOpt) {
      mapSelectorElement.value = matchedOpt.value;
    }
  }
  
  if (typeof loadMapPins === 'function') loadMapPins();
  if (typeof renderCanvasEntities === 'function') renderCanvasEntities();

  if (syncIfGm && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) {
    if (typeof window.pushMapToPlayers === 'function') {
      window.pushMapToPlayers();
    }
  }
}

window.pushMapToPlayers = function() {
    // Look up the episode map selector dropdown element in the DOM by its ID
    const mapSelectorElement = document.getElementById('episodeMapSelector');
    if (!mapSelectorElement) return;
    
    const targetMapUrl = mapSelectorElement.value;
    canvasState.backdrop = targetMapUrl;
    switchCityMap(targetMapUrl);
    
    if (typeof saveCanvasStateImmediate === 'function') {
        saveCanvasStateImmediate();
        console.log('[GM] Pushed map to players:', targetMapUrl);
    }
    if (activeChronicleId && targetMapUrl) {
        authFetch('/api/gameboard/map', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chronicle_id: activeChronicleId, map_url: targetMapUrl })
        }).catch(() => {});
    }
    
    // Auto-push the associated Scene Location and Scene Mood for this map
    let episodeMapsArray = [];
    if (currentEpisodeData && Array.isArray(currentEpisodeData.maps)) episodeMapsArray = currentEpisodeData.maps;
    else if (window.gameboardActiveEpisodeMapsCache) episodeMapsArray = window.gameboardActiveEpisodeMapsCache;
    
    if (episodeMapsArray.length > 0) {
        const matchingMapObject = episodeMapsArray.find(mapEntry => (typeof mapEntry === 'string' ? mapEntry : mapEntry.url) === targetMapUrl);
        if (matchingMapObject && typeof matchingMapObject === 'object') {
            const locationName = matchingMapObject.name || '';
            const locationMood = matchingMapObject.mood || '';
            
            // Sync to Omni-Drawer inputs in the DOM just in case they open it
            const omniLocationInput = document.getElementById('omniLocation');
            if (omniLocationInput && locationName) omniLocationInput.value = locationName;
            const omniMoodInput = document.getElementById('omniMood');
            if (omniMoodInput && locationMood) omniMoodInput.value = locationMood;
            
            // Push via API only when non-empty so we don't wipe the episode's primary location/hook
            if (activeChronicleId && (locationName || locationMood)) {
                const payload = { chronicle_id: activeChronicleId };
                if (locationName) payload.active_location = locationName;
                if (locationMood) payload.active_mood_text = locationMood;
                authFetch('/api/gameboard/scene', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).then(() => console.log('[GM] Auto-pushed scene atmosphere linked to map.')).catch(errorObject => console.error(errorObject));
            }
        }
    }
};

function populateEpisodeMaps(scenesList) {
  // Look up the episode map selector dropdown element in the DOM by its ID
  const mapSelectorElement = document.getElementById('episodeMapSelector');
  if (!mapSelectorElement) return;
  mapSelectorElement.innerHTML = `
        <option value="/images/concept_map.jpg">City Street Map</option>
        <option value="/images/tactical_london_map.jpg">Greater London Overview</option>
        <option value="/images/banner_1200x400.jpg">Highway 31W Crime Scene</option>
    `;
  if (Array.isArray(scenesList)) {
    scenesList.forEach((sceneObject, sceneIndex) => {
      const mapUrl = sceneObject.banner || sceneObject.map_url;
      if (mapUrl) {
        // Create a new <option> element in memory for each scene map
        const optionElement = document.createElement('option');
        optionElement.value = mapUrl;
        optionElement.innerText = `Scene ${sceneIndex + 1}: ${sceneObject.title || sceneObject.location || 'City Scene'}`;
        mapSelectorElement.appendChild(optionElement);
      }
    });
  }
}

function handleEntityDragStart(mouseEvent, entityId) {
  if (mouseEvent.target.tagName === 'BUTTON') return;
  if (mouseEvent.target.tagName !== 'INPUT') mouseEvent.preventDefault();
  const targetEntity = canvasState.entities.find(entityItem => entityItem.id === entityId);
  if (!targetEntity) return;
  bringEntityToFront(entityId);
  activeDragEntity = {
    entity: targetEntity,
    startX: mouseEvent.clientX,
    startY: mouseEvent.clientY,
    initialX: targetEntity.x,
    initialY: targetEntity.y
  };
}

function handleEntityDragMove(mouseEvent) {
  if (!activeDragEntity) return;
  const deltaX = (mouseEvent.clientX - activeDragEntity.startX) / canvasTransform.zoom;
  const deltaY = (mouseEvent.clientY - activeDragEntity.startY) / canvasTransform.zoom;
  const newPositionX = Math.round(activeDragEntity.initialX + deltaX);
  const newPositionY = Math.round(activeDragEntity.initialY + deltaY);
  
  // Update the reference we hold
  activeDragEntity.entity.x = newPositionX;
  activeDragEntity.entity.y = newPositionY;
  
  // CRITICAL: Also update the LIVE canvasState array because websockets might have replaced it!
  if (canvasState && canvasState.entities) {
      const liveEntity = canvasState.entities.find(entityItem => String(entityItem.id) === String(activeDragEntity.entity.id));
      if (liveEntity) {
          liveEntity.x = newPositionX;
          liveEntity.y = newPositionY;
      }
  }
  // Look up the dragged entity's card element in the DOM by its ID to update its position immediately
  const entityDomElement = document.getElementById(`canvas-entity-${activeDragEntity.entity.id}`);
  if (entityDomElement) {
    entityDomElement.style.left = `${activeDragEntity.entity.x}px`;
    entityDomElement.style.top = `${activeDragEntity.entity.y}px`;
  }
  renderSvgConnectors();
}

function handleEntityResizeStart(mouseEvent, entityId) {
  mouseEvent.preventDefault();
  mouseEvent.stopPropagation();
  const targetEntity = canvasState.entities.find(entityItem => entityItem.id === entityId);
  if (!targetEntity) return;
  bringEntityToFront(entityId);
  activeResizeEntity = {
    entity: targetEntity,
    startX: mouseEvent.clientX,
    startY: mouseEvent.clientY,
    initialW: targetEntity.width || 480,
    initialH: targetEntity.height || 320
  };
}

function handleEntityResizeMove(mouseEvent) {
  if (!activeResizeEntity) return;
  const deltaWidth = (mouseEvent.clientX - activeResizeEntity.startX) / canvasTransform.zoom;
  const deltaHeight = (mouseEvent.clientY - activeResizeEntity.startY) / canvasTransform.zoom;
  const newWidth = Math.max(180, Math.round(activeResizeEntity.initialW + deltaWidth));
  const newHeight = Math.max(120, Math.round(activeResizeEntity.initialH + deltaHeight));
  activeResizeEntity.entity.width = newWidth;
  activeResizeEntity.entity.height = newHeight;
  // Look up the resized entity's card element in the DOM by its ID to update its width and height
  const entityDomElement = document.getElementById(`canvas-entity-${activeResizeEntity.entity.id}`);
  if (entityDomElement) {
    entityDomElement.style.width = `${newWidth}px`;
    entityDomElement.style.height = `${newHeight}px`;
  }
  renderSvgConnectors();
}

function bringEntityToFront(entityId) {
  const highestZIndex = canvasState.entities.reduce((maxZIndex, entityItem) => Math.max(maxZIndex, entityItem.zIndex || 10), 10);
  const targetEntity = canvasState.entities.find(entityItem => entityItem.id === entityId);
  if (targetEntity) {
    targetEntity.zIndex = highestZIndex + 1;
    // Look up the entity card element in the DOM by its ID to update its z-index stacking order
    const entityDomElement = document.getElementById(`canvas-entity-${entityId}`);
    if (entityDomElement) entityDomElement.style.zIndex = targetEntity.zIndex;
  }
}

function updateEntityTitle(entityId, newTitleValue) {
  const targetEntity = canvasState.entities.find(entityItem => entityItem.id === entityId);
  if (targetEntity) {
    targetEntity.title = newTitleValue;
    debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  }
}

function updateEntityContent(entityId, newContentValue) {
  const targetEntity = canvasState.entities.find(entityItem => entityItem.id === entityId);
  if (targetEntity) {
    targetEntity.content = newContentValue;
    debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  }
}

// Map the debounced HTML calls to their base functions.
// (debouncedSaveCanvasState handles the actual request throttling)
window.debouncedUpdateEntityTitle = function(entityId, newTitleValue) {
    updateEntityTitle(entityId, newTitleValue);
};

window.debouncedUpdateEntityContent = function(entityId, newContentValue) {
    updateEntityContent(entityId, newContentValue);
};


function updateEntityCaption(entityId, newCaptionValue) {
  const targetEntity = canvasState.entities.find(entityItem => entityItem.id === entityId);
  if (targetEntity) {
    targetEntity.caption = newCaptionValue;
    debouncedSaveCanvasState();
    if (typeof loadMapPins === 'function') loadMapPins();
  }
}

function cycleEntityColor(entityId) {
  const targetEntity = canvasState.entities.find(entityItem => entityItem.id === entityId);
  if (!targetEntity) return;
  const currentThemeIndex = CARD_COLOR_THEMES.findIndex(themeOption => themeOption.name === targetEntity.color);
  const nextTheme = CARD_COLOR_THEMES[(currentThemeIndex + 1) % CARD_COLOR_THEMES.length];
  targetEntity.color = nextTheme.name;
  // Look up the entity card element in the DOM by its ID to apply the new color theme styles
  const entityDomElement = document.getElementById(`canvas-entity-${entityId}`);
  if (entityDomElement) {
    entityDomElement.style.borderColor = nextTheme.border;
    entityDomElement.style.boxShadow = `0 10px 30px rgba(0,0,0,0.8), 0 0 15px ${nextTheme.glow}`;
    // Find the card icon inside the card element to update its accent color
    const iconElement = entityDomElement.querySelector('.card-icon');
    if (iconElement) iconElement.style.color = nextTheme.accent;
  }
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}

function cycleEntityFontSize(entityId) {
  const targetEntity = canvasState.entities.find(entityItem => entityItem.id === entityId);
  if (!targetEntity) return;
  const currentFontSizeIndex = FONT_SIZE_STEPS.indexOf(targetEntity.fontSize || '14px');
  const nextFontSize = FONT_SIZE_STEPS[(currentFontSizeIndex + 1) % FONT_SIZE_STEPS.length];
  targetEntity.fontSize = nextFontSize;
  // Look up the entity card element in the DOM by its ID to update its text editor font size
  const entityDomElement = document.getElementById(`canvas-entity-${entityId}`);
  if (entityDomElement) {
    const editorElement = entityDomElement.querySelector('.card-text-editor');
    if (editorElement) editorElement.style.fontSize = nextFontSize;
  }
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}

function deleteCanvasEntity(entityId) {
  canvasState.entities = canvasState.entities.filter(entityItem => entityItem.id !== entityId);
  canvasState.links = canvasState.links.filter(connectionLink => connectionLink.from !== entityId && connectionLink.to !== entityId);
  renderCanvasEntities();
  renderSvgConnectors();
  debouncedSaveCanvasState();
  if (typeof loadMapPins === 'function') loadMapPins();
}



function renderSvgConnectors() {
  // Look up the SVG overlay element in the DOM by its ID
  const svgOverlayElement = document.getElementById('canvasSvgOverlay');
  if (!svgOverlayElement) return;
  svgOverlayElement.innerHTML = '';
  if (!canvasState.links || canvasState.links.length === 0) return;
  canvasState.links.forEach(connectionLink => {
    let sourceEntity = canvasState.entities.find(entityItem => String(entityItem.id) === String(connectionLink.from));
    let targetEntity = canvasState.entities.find(entityItem => String(entityItem.id) === String(connectionLink.to));
    let sourceIsPin = false, targetIsPin = false;
    
    if (!sourceEntity && typeof currentMapPins !== 'undefined') {
        sourceEntity = currentMapPins.find(mapPinRecord => String(mapPinRecord.id) === String(connectionLink.from));
        sourceIsPin = !!sourceEntity;
    }
    if (!targetEntity && typeof currentMapPins !== 'undefined') {
        targetEntity = currentMapPins.find(mapPinRecord => String(mapPinRecord.id) === String(connectionLink.to));
        targetIsPin = !!targetEntity;
    }
    
    if (!sourceEntity || !targetEntity) return;

    let startX = parseFloat(sourceEntity.x) + (parseFloat(sourceEntity.width) || 480) / 2;
    let startY = parseFloat(sourceEntity.y) + (parseFloat(sourceEntity.height) || 320) / 2;
    let endX = parseFloat(targetEntity.x) + (parseFloat(targetEntity.width) || 480) / 2;
    let endY = parseFloat(targetEntity.y) + (parseFloat(targetEntity.height) || 320) / 2;
    
    // Override with exact DOM positions to avoid any logic drifts
    if (sourceIsPin) {
        // Query the pins layer in the DOM to find the matching map pin marker element
        const sourcePinDomElement = document.getElementById('canvasPinsLayer').querySelector(`.map-pin-marker[onclick*="'${sourceEntity.id}'"]`) || 
                          Array.from(document.querySelectorAll('.map-pin-marker')).find(markerElement => markerElement.onclick && markerElement.onclick.toString().includes(`finalizeLinkAction('${sourceEntity.id}')`)) ||
                          Array.from(document.querySelectorAll('.map-pin-marker')).find(markerElement => markerElement.style.left === sourceEntity.x + 'px');
        if (sourcePinDomElement) {
            startX = parseFloat(sourcePinDomElement.style.left);
            startY = parseFloat(sourcePinDomElement.style.top);
        } else {
            startX = parseFloat(sourceEntity.x);
            startY = parseFloat(sourceEntity.y);
        }
    }
    
    if (targetIsPin) {
        // Query all map pin markers in the DOM to find the target pin marker element
        const targetPinDomElement = Array.from(document.querySelectorAll('.map-pin-marker')).find(markerElement => markerElement.style.left === targetEntity.x + 'px');
        if (targetPinDomElement) {
            endX = parseFloat(targetPinDomElement.style.left);
            endY = parseFloat(targetPinDomElement.style.top);
        } else {
            endX = parseFloat(targetEntity.x);
            endY = parseFloat(targetEntity.y);
        }
    }
    
    // Also override notecards using DOM to be completely certain
    if (!sourceIsPin) {
        // Look up the source entity card element in the DOM by its ID
        const sourceCardDomElement = document.getElementById(`canvas-entity-${sourceEntity.id}`);
        if (sourceCardDomElement) {
            startX = parseFloat(sourceCardDomElement.style.left) + sourceCardDomElement.offsetWidth / 2;
            startY = parseFloat(sourceCardDomElement.style.top) + sourceCardDomElement.offsetHeight / 2;
        } else {
            return; // Not on this map
        }
    }
    if (!targetIsPin) {
        // Look up the target entity card element in the DOM by its ID
        const targetCardDomElement = document.getElementById(`canvas-entity-${targetEntity.id}`);
        if (targetCardDomElement) {
            endX = parseFloat(targetCardDomElement.style.left) + targetCardDomElement.offsetWidth / 2;
            endY = parseFloat(targetCardDomElement.style.top) + targetCardDomElement.offsetHeight / 2;
        } else {
            return; // Not on this map
        }
    }
    const controlPointOffsetX = (endX - startX) * 0.4;
    const svgPathData = `M ${startX} ${startY} C ${startX + controlPointOffsetX} ${startY}, ${endX - controlPointOffsetX} ${endY}, ${endX} ${endY}`;
    console.log('[Trace][SVG] Drawing link', {
        from: connectionLink.from, to: connectionLink.to,
        sIsPin: sourceIsPin, tIsPin: targetIsPin,
        x1: startX, y1: startY, x2: endX, y2: endY,
        sx: sourceEntity.x, sy: sourceEntity.y,
        tx: targetEntity.x, ty: targetEntity.y
    });
    // Create an SVG <path> element in the SVG namespace to draw the red string connector
    const svgPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svgPathElement.setAttribute('d', svgPathData);
    svgPathElement.setAttribute('fill', 'none');
    svgPathElement.setAttribute('stroke', connectionLink.color || '#ef4444');
    svgPathElement.setAttribute('stroke-width', '2.5');
    svgPathElement.setAttribute('stroke-linecap', 'round');
    svgPathElement.setAttribute('stroke-dasharray', '6 3');
    svgPathElement.style.filter = 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.7))';
    svgOverlayElement.appendChild(svgPathElement);
  });
}


function saveCanvasStateImmediate() {
  if (saveCanvasTimeout) clearTimeout(saveCanvasTimeout);
  if (!activeChronicleId) return;
  // Perform an authenticated HTTP POST request to immediately persist the canvas state to the server
  authFetch('/api/gameboard/canvas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chronicle_id: activeChronicleId,
      canvas_state: canvasState
    })
  }).catch(errorObject => console.error('Failed to sync canvas state:', errorObject));
}

function debouncedSaveCanvasState() {
  if (saveCanvasTimeout) clearTimeout(saveCanvasTimeout);
  saveCanvasTimeout = setTimeout(() => {
    if (!activeChronicleId) return;
    // Perform an authenticated HTTP POST request after the debounce delay to persist the canvas state
    authFetch('/api/gameboard/canvas', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicle_id: activeChronicleId,
        canvas_state: canvasState
      })
    }).catch(errorObject => console.error('Failed to sync canvas state:', errorObject));
  }, 600);
}


function toggleMapPinMode() {
  mapPinMode = !mapPinMode;
  // Look up the canvas viewport and pin mode button elements in the DOM by their IDs
  const viewportElement = document.getElementById('canvasViewport');
  if (viewportElement) viewportElement.style.cursor = mapPinMode ? 'crosshair' : 'default';
  const pinModeButtonElement = document.getElementById('btnPinMode');
  if (pinModeButtonElement) {
    if (mapPinMode) pinModeButtonElement.classList.add('active-tool'); else pinModeButtonElement.classList.remove('active-tool');
  }
}

async function loadMapPins() {
  if (!activeChronicleId) return;
  const rawMapUrl = getActiveCityMapUrl();
  if (!rawMapUrl) return;
  const mapUrlPathname = normalizeCityMapUrl(rawMapUrl);
  try {
    // Perform an authenticated HTTP GET request to load all map pins for the active chronicle and map URL
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/pins?mapUrl=${encodeURIComponent(mapUrlPathname)}`);
    if (!fetchResponse.ok) return;
    const mapPinsList = await fetchResponse.json();
    currentMapPins = mapPinsList;
    renderMapPins(mapPinsList);
    if (typeof renderSvgConnectors === 'function') renderSvgConnectors();
  } catch (errorObject) {
    console.error(errorObject);
  }
}

function renderMapPins(mapPinsList) {
  // Look up the canvas pins layer container in the DOM by its ID
  const pinsLayerElement = document.getElementById('canvasPinsLayer');
  if (!pinsLayerElement) return;
  pinsLayerElement.innerHTML = '';
  mapPinsList.forEach(mapPinRecord => {
    // Create a new <div> element in memory for the map pin marker
    const markerElement = document.createElement('div');
    markerElement.className = 'map-pin-marker';
    markerElement.style.left = mapPinRecord.x + 'px';
    markerElement.style.top = mapPinRecord.y + 'px';
    markerElement.style.pointerEvents = 'auto';
    markerElement.style.cursor = 'pointer';
    markerElement.style.transform = `scale(${1 / (typeof canvasTransform !== 'undefined' ? canvasTransform.zoom : 1)})`;
    markerElement.style.transformOrigin = 'bottom center';
    markerElement.innerHTML = '<i class="fa-solid fa-location-dot"></i>';
    markerElement.onclick = (mouseEvent) => {
        if (typeof linkingSourceEntityId !== 'undefined' && (linkingSourceEntityId || unlinkingSourceEntityId)) {
            mouseEvent.stopPropagation();
            if (typeof finalizeLinkAction === 'function') finalizeLinkAction(String(mapPinRecord.id));
        }
    };
    // Create tooltip container and heading elements in memory for the map pin
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'map-pin-tooltip';
    tooltipElement.style.pointerEvents = 'auto';
    const headingElement = document.createElement('h4');
    headingElement.innerText = mapPinRecord.title || 'Unknown Location';
    tooltipElement.appendChild(headingElement);
    if (mapPinRecord.description) {
      // Create a paragraph element for the pin description
      const descriptionParagraph = document.createElement('p');
      descriptionParagraph.innerText = mapPinRecord.description;
      tooltipElement.appendChild(descriptionParagraph);
    }
    if (mapPinRecord.security_measures) {
      // Create a paragraph element for the pin security measures
      const securityParagraph = document.createElement('p');
      securityParagraph.innerHTML = '<strong style="color:#ef4444;font-size:10px;">SECURITY:</strong><br>' + escapeHtml(mapPinRecord.security_measures);
      securityParagraph.style.borderLeft = '2px solid #ef4444';
      securityParagraph.style.paddingLeft = '6px';
      securityParagraph.style.marginTop = '6px';
      tooltipElement.appendChild(securityParagraph);
    }
    if (mapPinRecord.infiltration_routes) {
      // Create a paragraph element for the pin infiltration routes
      const routesParagraph = document.createElement('p');
      routesParagraph.innerHTML = '<strong style="color:#10b981;font-size:10px;">ROUTES:</strong><br>' + escapeHtml(mapPinRecord.infiltration_routes);
      routesParagraph.style.borderLeft = '2px solid #10b981';
      routesParagraph.style.paddingLeft = '6px';
      routesParagraph.style.marginTop = '6px';
      tooltipElement.appendChild(routesParagraph);
    }
    if (typeof activeChronicleRole !== 'undefined' && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller')) {
      const delPinBtn = document.createElement('button');
      delPinBtn.type = 'button';
      delPinBtn.className = 'btn-secondary';
      delPinBtn.style.cssText = 'margin-top:8px;padding:3px 8px;font-size:10px;color:#ef4444;border-color:rgba(239,68,68,0.4);width:100%;cursor:pointer;';
      delPinBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete Pin';
      delPinBtn.onclick = async (ev) => {
        ev.stopPropagation();
        await authFetch(`/api/chronicles/${activeChronicleId}/pins/${mapPinRecord.id}`, { method: 'DELETE' });
        loadMapPins();
      };
      tooltipElement.appendChild(delPinBtn);
    }

    markerElement.appendChild(tooltipElement);
    pinsLayerElement.appendChild(markerElement);
  });
}


window.activeMapMode = 'add';
;

let isDraggingPin = null;

function handlePinClick(mouseEvent, pinId) {
    if (window.activeMapMode === 'delete') {
        mouseEvent.stopPropagation();
        deletePin(pinId);
    }
}


setTimeout(() => {
    // Query the workshop minimap container element in the DOM
    const minimapContainerElement = document.querySelector('.workshop-minimap-container');
    if (minimapContainerElement) {
        minimapContainerElement.addEventListener('dragover', (dragEvent) => {
            dragEvent.preventDefault();
            dragEvent.dataTransfer.dropEffect = 'move';
        });
        minimapContainerElement.addEventListener('drop', (dropEvent) => {
            dropEvent.preventDefault();
            const pinId = dropEvent.dataTransfer.getData('text/plain');
            if (!pinId) return;
            
            // Measure the minimap container's bounding rectangle in the viewport
            const containerBoundingRect = dropEvent.currentTarget.getBoundingClientRect();
            const offsetX = dropEvent.clientX - containerBoundingRect.left;
            const offsetY = dropEvent.clientY - containerBoundingRect.top;
            const percentageX = (offsetX / containerBoundingRect.width) * 100;
            const percentageY = (offsetY / containerBoundingRect.height) * 100;
            
            const absoluteMapX = Math.round((percentageX / 100) * 2800);
            const absoluteMapY = Math.round((percentageY / 100) * 2000);
            
            // Read the authentication token from localStorage and send an HTTP PUT request via browser fetch to update the pin coordinates
            const authToken = localStorage.getItem('vtm_auth_token');
            fetch(`/api/chronicles/${activeChronicleId}/pins/${pinId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + authToken
                },
                body: JSON.stringify({ x: absoluteMapX, y: absoluteMapY })
            }).then(fetchResponse => fetchResponse.json()).then(responseData => {
                if(responseData.success) {
                    // Look up the workshop minimap image element in the DOM to reload its pins
                    const minimapImageElement = document.getElementById('workshopMinimapImg');
                    loadCampaignPins(minimapImageElement.getAttribute('src'));
                }
            });
        });
    }
}, 1000);


async function createMapPinSubmit() {
  // Look up the new map pin input elements in the DOM by their IDs
  const pinTitle = document.getElementById('newPinTitle').value.trim();
  const pinDescription = document.getElementById('newPinDescription') ? document.getElementById('newPinDescription').value.trim() : '';
  const securityMeasures = document.getElementById('newPinSecurity') ? document.getElementById('newPinSecurity').value.trim() : '';
  const infiltrationRoutes = document.getElementById('newPinInfiltration') ? document.getElementById('newPinInfiltration').value.trim() : '';
  // Show a browser alert if the location title is missing
  if (!pinTitle) return alert('Location title required.');

  // Look up the workshop minimap image and coordinate input elements in the DOM by their IDs
  const minimapImageElement = document.getElementById('workshopMinimapImg');
  let rawMapUrl = minimapImageElement ? minimapImageElement.getAttribute('src') : '/images/concept_map.jpg';
  const mapUrlPathname = normalizeCityMapUrl(rawMapUrl);
  const percentageX = parseFloat(document.getElementById('newPinX').value);
  const percentageY = parseFloat(document.getElementById('newPinY').value);

  const mapCoordinateX = Math.round((percentageX / 100) * 2800);
  const mapCoordinateY = Math.round((percentageY / 100) * 2000);

  try {
      // Perform an authenticated HTTP POST request to create the new map pin on the server
      const fetchResponse = await authFetch('/api/chronicles/' + activeChronicleId + '/pins', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              map_url: mapUrlPathname,
              x: mapCoordinateX,
              y: mapCoordinateY,
              title: pinTitle,
              description: pinDescription,
              security_measures: securityMeasures,
              infiltration_routes: infiltrationRoutes
          })
      });
      closeModal('newMapPinModal');
      loadCampaignPins(mapUrlPathname);
      loadMapPins();
  } catch (errorObject) {
      console.error(errorObject);
  }
}


// --- DIAGNOSTIC HUD & ROBUST INLINE LOGIC ---
window.activeMapMode = 'add';

window.vtmMapLog = function(logMessage, isError = false) {
    // Look up the diagnostic HUD element in the DOM by its ID
    const diagnosticHudElement = document.getElementById('mapDiagnosticHUD');
    if (diagnosticHudElement) {
        diagnosticHudElement.style.display = 'block';
        // Create a new <div> log line element in memory
        const logLineElement = document.createElement('div');
        logLineElement.style.color = isError ? '#ef4444' : '#10b981';
        logLineElement.style.marginBottom = '4px';
        logLineElement.style.fontFamily = 'monospace';
        logLineElement.innerText = '[' + new Date().toLocaleTimeString() + '] ' + logMessage;
        diagnosticHudElement.prepend(logLineElement);
    }
    console.log('[MAP DIAGNOSTIC] ' + logMessage);
};

window.vtmMapSetMode = function(interactionMode) {
    vtmMapLog("Executing vtmMapSetMode('" + interactionMode + "')");
    window.activeMapMode = interactionMode;
    // Look up the map mode toolbar buttons, label, and pins container in the DOM by their IDs
    const addModeButton = document.getElementById('btnMapModeAdd');
    const moveModeButton = document.getElementById('btnMapModeMove');
    const deleteModeButton = document.getElementById('btnMapModeDelete');
    const modeLabelElement = document.getElementById('mapModeLabel');
    const pinsContainerElement = document.getElementById('workshopMinimapPins');

    if (addModeButton) addModeButton.classList.remove('active');
    if (moveModeButton) moveModeButton.classList.remove('active');
    if (deleteModeButton) deleteModeButton.classList.remove('active');
    
    if (interactionMode === 'add') {
        if (addModeButton) addModeButton.classList.add('active');
        if (modeLabelElement) modeLabelElement.innerText = 'Mode: Add (Click Map)';
        if (pinsContainerElement) pinsContainerElement.style.pointerEvents = 'none';
        vtmMapLog('Set to ADD mode. Map clicks enabled.');
    } else if (interactionMode === 'move') {
        if (moveModeButton) moveModeButton.classList.add('active');
        if (modeLabelElement) modeLabelElement.innerText = 'Mode: Move (Drag Pin)';
        if (pinsContainerElement) pinsContainerElement.style.pointerEvents = 'auto';
        vtmMapLog('Set to MOVE mode. Pins are draggable.');
    } else if (interactionMode === 'delete') {
        if (deleteModeButton) deleteModeButton.classList.add('active');
        if (modeLabelElement) modeLabelElement.innerText = 'Mode: Delete (Click Pin)';
        if (pinsContainerElement) pinsContainerElement.style.pointerEvents = 'auto';
        vtmMapLog('Set to DELETE mode. Click a pin to delete.');
    }
};

window.vtmHandleMapClick = function(mouseEvent) {
    if (mouseEvent) mouseEvent.stopPropagation();
    vtmMapLog("Map clicked. Target: " + (mouseEvent.target ? mouseEvent.target.tagName : 'unknown') + ", Mode: " + window.activeMapMode);
    
    if (!activeChronicleId) {
        vtmMapLog('ERROR: activeChronicleId is null. Chronicle not loaded?', true);
        return;
    }
    if (window.activeMapMode !== 'add') {
        vtmMapLog("Ignored click because mode is " + window.activeMapMode + ", not 'add'.");
        return;
    }

    // Look up the workshop minimap container element in the DOM by its ID
    const mapContainerElement = document.getElementById('workshopMinimapContainer');
    if (!mapContainerElement) {
        vtmMapLog('ERROR: mapContainer is null.', true);
        return;
    }

    // Measure the minimap container's bounding rectangle in the viewport
    const containerBoundingRect = mapContainerElement.getBoundingClientRect();
    const clickOffsetX = mouseEvent.clientX - containerBoundingRect.left;
    const clickOffsetY = mouseEvent.clientY - containerBoundingRect.top;
    const percentageX = (clickOffsetX / containerBoundingRect.width) * 100;
    const percentageY = (clickOffsetY / containerBoundingRect.height) * 100;

    vtmMapLog("Calculated coordinates: X=" + percentageX.toFixed(2) + "%, Y=" + percentageY.toFixed(2) + "%");

    // Look up the new map pin modal and its coordinate/title/description inputs in the DOM by their IDs
    const modalElement = document.getElementById('newMapPinModal');
    if (modalElement) {
        document.getElementById('newPinX').value = percentageX;
        document.getElementById('newPinY').value = percentageY;
        document.getElementById('newPinTitle').value = '';
        const descriptionInputElement = document.getElementById('newPinDescription');
        if (descriptionInputElement) descriptionInputElement.value = '';
        modalElement.classList.add('active'); modalElement.style.zIndex = '9999999';
        vtmMapLog("Modal opened successfully. Display: " + modalElement.style.display + ", z-index: " + modalElement.style.zIndex);
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
    } catch(errorObject) {
        vtmMapLog("ERROR in createMapPinSubmit: " + errorObject.message, true);
    }
};
