/**
 * Turn & Initiative Tracker Module (#widget-turn-tracker)
 * - Visible to both Storyteller (GM) and Players on the Gameboard.
 * - Players have a strictly read-only view (cannot reorder, step turns, or add/remove entries).
 * - Automatically displays ONLY actively logged-in players (from currentChronicleActiveUsers),
 *   while allowing the GM to explicitly override and add offline players or NPCs as exceptions
 *   (and remove any entry at any time).
 */
(function () {
  let draggedTurnEntryIndex = null;

  function isTurnTrackerGm() {
    return typeof activeChronicleRole !== 'undefined' &&
      (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller');
  }

  function safeEscape(str) {
    if (typeof escapeHtml === 'function') return escapeHtml(String(str || ''));
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getOnlinePlayerEntries() {
    const entries = [];
    const seenIds = new Set();
    const activeUsers = Array.isArray(window.currentChronicleActiveUsers || (typeof currentChronicleActiveUsers !== 'undefined' ? currentChronicleActiveUsers : null))
      ? (window.currentChronicleActiveUsers || currentChronicleActiveUsers)
      : [];
    const allChars = Array.isArray(typeof chronicleCharactersList !== 'undefined' ? chronicleCharactersList : null)
      ? chronicleCharactersList
      : [];

    const effectiveUsers = [...activeUsers];
    if (
      typeof currentUser !== 'undefined' &&
      currentUser &&
      currentUser.id &&
      !isTurnTrackerGm() &&
      !effectiveUsers.some((u) => Number(u.userId || u.id) === Number(currentUser.id))
    ) {
      effectiveUsers.push({
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.displayName || currentUser.username,
        role: 'player',
        avatar: currentUser.avatar || currentUser.avatar_url || null
      });
    }

    effectiveUsers.forEach((u) => {
      if (!u) return;
      const role = String(u.role || '').toLowerCase();
      if (role === 'gm' || role === 'storyteller') return;
      const uid = Number(u.userId || u.id || 0);
      let charRec = u.characterId
        ? allChars.find((c) => Number(c.id) === Number(u.characterId))
        : null;
      if (!charRec && uid) {
        charRec = allChars.find(
          (c) => Number(c.user_id) === uid && String(c.category || '').toLowerCase() === 'pc'
        ) || allChars.find((c) => Number(c.user_id) === uid);
      }
      const entryId = charRec ? `char_${charRec.id}` : `user_${uid || u.username}`;
      if (seenIds.has(entryId)) return;
      seenIds.add(entryId);
      const avatarUrl =
        charRec && charRec.avatar_url && !charRec.avatar_url.includes('bg_page_1.png')
          ? charRec.avatar_url
          : u.avatar || '/images/caine_portrait.jpg?v=2';
      const playerLabel = u.displayName || u.username || (charRec && charRec.player_name) || 'Player';
      entries.push({
        id: entryId,
        userId: uid || (charRec && charRec.user_id ? Number(charRec.user_id) : null),
        characterId: charRec ? Number(charRec.id) : null,
        name: charRec ? charRec.name : playerLabel,
        subtitle: charRec ? `Player: ${playerLabel}` : 'Online Player',
        avatar: avatarUrl,
        isOnline: true,
        manualOverride: false
      });
    });

    return entries;
  }

  function getResolvedTurnTrackerState() {
    if (typeof chronicleUiSettings === 'undefined' || !chronicleUiSettings || typeof chronicleUiSettings !== 'object') {
      window.chronicleUiSettings = {};
    }
    const raw = (chronicleUiSettings && chronicleUiSettings.turn_tracker) || {};
    const round = Math.max(1, Number(raw.round) || 1);
    const savedOrder = Array.isArray(raw.order) ? raw.order : [];
    const excludedOnlineIds = new Set(
      Array.isArray(raw.excluded_online_ids) ? raw.excluded_online_ids.map(String) : []
    );

    const onlineEntries = getOnlinePlayerEntries();
    const onlineById = new Map();
    const onlineByUserId = new Map();
    onlineEntries.forEach((oe) => {
      onlineById.set(String(oe.id), oe);
      if (oe.userId) onlineByUserId.set(Number(oe.userId), oe);
    });

    const allChars = Array.isArray(typeof chronicleCharactersList !== 'undefined' ? chronicleCharactersList : null)
      ? chronicleCharactersList
      : [];

    const resolvedOrder = [];
    const includedIds = new Set();

    // 1. Keep saved entries ONLY if they are currently online OR explicitly added by GM (manualOverride / isStoryteller)
    savedOrder.forEach((item) => {
      if (!item || !item.id) return;
      const itemId = String(item.id);
      if (includedIds.has(itemId)) return;

      const matchingOnline =
        onlineById.get(itemId) ||
        (item.userId ? onlineByUserId.get(Number(item.userId)) : null);
      const isOnlineNow = Boolean(matchingOnline);
      const isManualException = Boolean(item.manualOverride || item.isStoryteller);

      if (!isOnlineNow && !isManualException) {
        // Offline player who was NOT manually overridden by GM -> exclude automatically
        return;
      }
      if (isOnlineNow && excludedOnlineIds.has(itemId) && !item.manualOverride) {
        // Online player explicitly removed by GM -> keep excluded until GM re-adds or resets
        return;
      }

      const charId = item.characterId || (itemId.startsWith('char_') ? Number(itemId.replace('char_', '')) : null);
      const charRec = charId ? allChars.find((c) => Number(c.id) === Number(charId)) : null;

      let resolvedName = item.name || 'Kindred';
      let resolvedSubtitle = item.subtitle || '';
      let resolvedAvatar = item.avatar || '/images/caine_portrait.jpg?v=2';

      if (matchingOnline) {
        resolvedName = matchingOnline.name || resolvedName;
        resolvedSubtitle = matchingOnline.subtitle || resolvedSubtitle;
        resolvedAvatar = matchingOnline.avatar || resolvedAvatar;
      } else if (charRec) {
        resolvedName = charRec.name || resolvedName;
        if (charRec.avatar_url && !charRec.avatar_url.includes('bg_page_1.png')) {
          resolvedAvatar = charRec.avatar_url;
        }
        const isPc = String(charRec.category || '').toLowerCase() === 'pc';
        if (isPc) {
          resolvedSubtitle = charRec.player_name
            ? `Player: ${charRec.player_name} (Offline • GM Added)`
            : 'Offline Player (GM Added)';
        } else {
          resolvedSubtitle = charRec.clan ? `${charRec.clan} • NPC` : 'NPC / Antagonist';
        }
      }

      const finalId = matchingOnline ? String(matchingOnline.id) : itemId;
      if (includedIds.has(finalId)) return;
      includedIds.add(finalId);

      resolvedOrder.push({
        id: finalId,
        userId: matchingOnline ? matchingOnline.userId : (item.userId || (charRec && charRec.user_id ? Number(charRec.user_id) : null)),
        characterId: matchingOnline ? matchingOnline.characterId : (charId || null),
        name: resolvedName,
        subtitle: resolvedSubtitle,
        avatar: resolvedAvatar,
        isStoryteller: Boolean(item.isStoryteller),
        isOnline: isOnlineNow,
        manualOverride: Boolean(item.manualOverride)
      });
    });

    // 2. Append any currently logged-in online player not yet in the order (unless excluded by GM)
    onlineEntries.forEach((oe) => {
      const oeId = String(oe.id);
      if (includedIds.has(oeId)) return;
      if (excludedOnlineIds.has(oeId)) return;
      if (oe.userId && resolvedOrder.some((r) => r.userId && Number(r.userId) === Number(oe.userId))) return;
      includedIds.add(oeId);
      resolvedOrder.push({ ...oe });
    });

    let activeEntryId = raw.active_entry_id ? String(raw.active_entry_id) : null;
    if (!activeEntryId || !resolvedOrder.some((r) => String(r.id) === activeEntryId)) {
      activeEntryId = resolvedOrder[0] ? String(resolvedOrder[0].id) : null;
    }

    return {
      round,
      active_entry_id: activeEntryId,
      order: resolvedOrder,
      excluded_online_ids: Array.from(excludedOnlineIds)
    };
  }

  async function saveTurnTrackerState(updatedTracker) {
    if (typeof activeChronicleId === 'undefined' || !activeChronicleId) return;
    if (typeof chronicleUiSettings === 'undefined' || !chronicleUiSettings || typeof chronicleUiSettings !== 'object') {
      window.chronicleUiSettings = {};
    }
    chronicleUiSettings.turn_tracker = {
      round: Math.max(1, Number(updatedTracker.round) || 1),
      active_entry_id: updatedTracker.active_entry_id || null,
      order: Array.isArray(updatedTracker.order) ? updatedTracker.order : [],
      excluded_online_ids: Array.isArray(updatedTracker.excluded_online_ids)
        ? updatedTracker.excluded_online_ids
        : []
    };
    renderTurnTrackerStates();
    try {
      await authFetch(`/api/chronicles/${activeChronicleId}/ui_settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ui_settings: chronicleUiSettings })
      });
    } catch (err) {
      console.error('Failed to persist turn tracker state:', err);
    }
  }

  function setActiveTurnEntry(entryId) {
    if (!isTurnTrackerGm()) return;
    const tracker = getResolvedTurnTrackerState();
    tracker.active_entry_id = String(entryId);
    saveTurnTrackerState(tracker);
  }

  function stepTurnTracker(delta) {
    if (!isTurnTrackerGm()) return;
    const tracker = getResolvedTurnTrackerState();
    if (!Array.isArray(tracker.order) || tracker.order.length === 0) return;
    let currentIndex = tracker.order.findIndex(
      (item) => String(item.id) === String(tracker.active_entry_id)
    );
    if (currentIndex === -1) {
      currentIndex = 0;
    } else {
      currentIndex += Number(delta || 1);
      if (currentIndex >= tracker.order.length) {
        currentIndex = 0;
        tracker.round = (Number(tracker.round) || 1) + 1;
      } else if (currentIndex < 0) {
        currentIndex = tracker.order.length - 1;
        tracker.round = Math.max(1, (Number(tracker.round) || 1) - 1);
      }
    }
    tracker.active_entry_id = tracker.order[currentIndex].id;
    saveTurnTrackerState(tracker);
  }

  function moveTurnTrackerEntry(index, direction, event) {
    if (event) event.stopPropagation();
    if (!isTurnTrackerGm()) return;
    const tracker = getResolvedTurnTrackerState();
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= tracker.order.length) return;
    const temp = tracker.order[index];
    tracker.order[index] = tracker.order[targetIndex];
    tracker.order[targetIndex] = temp;
    saveTurnTrackerState(tracker);
  }

  function removeTurnTrackerEntry(entryId, event) {
    if (event) event.stopPropagation();
    if (!isTurnTrackerGm()) return;
    const tracker = getResolvedTurnTrackerState();
    const targetId = String(entryId);
    const removedItem = tracker.order.find((item) => String(item.id) === targetId);
    tracker.order = tracker.order.filter((item) => String(item.id) !== targetId);

    // If the removed entry is a currently online player, record in excluded_online_ids so they stay removed until re-added or reset
    if (removedItem && removedItem.isOnline) {
      const excluded = new Set(tracker.excluded_online_ids || []);
      excluded.add(targetId);
      tracker.excluded_online_ids = Array.from(excluded);
    }

    if (String(tracker.active_entry_id) === targetId) {
      tracker.active_entry_id = tracker.order[0] ? tracker.order[0].id : null;
    }
    saveTurnTrackerState(tracker);
  }

  function syncTurnTrackerWithCoterie() {
    if (!isTurnTrackerGm()) return;
    const tracker = getResolvedTurnTrackerState();
    // Clear exclusions so all currently online players are synced back in
    tracker.excluded_online_ids = [];
    const onlineEntries = getOnlinePlayerEntries();
    onlineEntries.forEach((oe) => {
      const exists = tracker.order.some(
        (item) => String(item.id) === String(oe.id) || (oe.userId && item.userId && Number(item.userId) === Number(oe.userId))
      );
      if (!exists) tracker.order.push(oe);
    });
    if (!tracker.active_entry_id && tracker.order[0]) {
      tracker.active_entry_id = tracker.order[0].id;
    }
    saveTurnTrackerState(tracker);
  }

  function addSelectedToTurnTracker() {
    if (!isTurnTrackerGm()) return;
    const selectEl = document.getElementById('turnTrackerAddSelect');
    if (!selectEl || !selectEl.value) return;
    const val = selectEl.value;
    const tracker = getResolvedTurnTrackerState();

    // Remove from excluded_online_ids if re-adding a previously removed online player
    tracker.excluded_online_ids = (tracker.excluded_online_ids || []).filter((id) => String(id) !== String(val));

    if (val === 'storyteller_enemy') {
      const stEntryId = `st_${Date.now()}`;
      tracker.order.push({
        id: stEntryId,
        name: 'Storyteller / Antagonist',
        subtitle: 'NPC Action',
        avatar: '/images/st_avatar.png',
        isStoryteller: true,
        manualOverride: true
      });
    } else if (val.startsWith('char_')) {
      const charId = Number(val.replace('char_', ''));
      const allChars = Array.isArray(typeof chronicleCharactersList !== 'undefined' ? chronicleCharactersList : null)
        ? chronicleCharactersList
        : [];
      const charRec = allChars.find((c) => Number(c.id) === charId);
      if (charRec && !tracker.order.some((item) => String(item.id) === val)) {
        const avatarUrl =
          charRec.avatar_url && !charRec.avatar_url.includes('bg_page_1.png')
            ? charRec.avatar_url
            : '/images/caine_portrait.jpg?v=2';
        const onlineEntries = getOnlinePlayerEntries();
        const isOnlineNow = onlineEntries.some(
          (oe) => String(oe.id) === val || (charRec.user_id && oe.userId && Number(oe.userId) === Number(charRec.user_id))
        );
        const isPc = String(charRec.category || '').toLowerCase() === 'pc';
        tracker.order.push({
          id: val,
          userId: charRec.user_id ? Number(charRec.user_id) : null,
          characterId: Number(charRec.id),
          name: charRec.name || 'Kindred',
          subtitle: isPc
            ? charRec.player_name
              ? `Player: ${charRec.player_name}${isOnlineNow ? '' : ' (Offline • GM Added)'}`
              : isOnlineNow
                ? 'Online Player'
                : 'Offline Player (GM Added)'
            : `${charRec.clan || 'NPC'} • NPC`,
          avatar: avatarUrl,
          isOnline: isOnlineNow,
          manualOverride: true
        });
      }
    } else if (val.startsWith('user_')) {
      const onlineEntries = getOnlinePlayerEntries();
      const onlineMatch = onlineEntries.find((oe) => String(oe.id) === val);
      if (onlineMatch && !tracker.order.some((item) => String(item.id) === val)) {
        tracker.order.push({
          ...onlineMatch,
          manualOverride: false
        });
      }
    }

    if (!tracker.active_entry_id && tracker.order[0]) {
      tracker.active_entry_id = tracker.order[0].id;
    }
    selectEl.value = '';
    saveTurnTrackerState(tracker);
  }

  function clearTurnTrackerOrder() {
    if (!isTurnTrackerGm()) return;
    const onlineOnly = getOnlinePlayerEntries();
    const resetTracker = {
      round: 1,
      active_entry_id: onlineOnly[0] ? onlineOnly[0].id : null,
      order: onlineOnly,
      excluded_online_ids: []
    };
    saveTurnTrackerState(resetTracker);
  }

  function handleTurnRowDragStart(event, index) {
    if (!isTurnTrackerGm()) return;
    draggedTurnEntryIndex = index;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    }
  }

  function handleTurnRowDragOver(event) {
    if (!isTurnTrackerGm()) return;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }

  function handleTurnRowDrop(event, dropIndex) {
    event.preventDefault();
    if (!isTurnTrackerGm()) return;
    const fromIndex =
      draggedTurnEntryIndex !== null
        ? draggedTurnEntryIndex
        : parseInt(event.dataTransfer ? event.dataTransfer.getData('text/plain') : '-1', 10);
    draggedTurnEntryIndex = null;
    if (Number.isNaN(fromIndex) || fromIndex < 0 || fromIndex === dropIndex) return;
    const tracker = getResolvedTurnTrackerState();
    if (fromIndex >= tracker.order.length || dropIndex >= tracker.order.length) return;
    const [movedItem] = tracker.order.splice(fromIndex, 1);
    tracker.order.splice(dropIndex, 0, movedItem);
    saveTurnTrackerState(tracker);
  }

  function populateGmAddDropdown(selectEl, currentOrder) {
    if (!selectEl) return;
    const prevValue = selectEl.value;
    const inOrderIds = new Set((currentOrder || []).map((item) => String(item.id)));
    const onlineEntries = getOnlinePlayerEntries();
    const onlineCharIds = new Set(
      onlineEntries.filter((oe) => oe.characterId).map((oe) => Number(oe.characterId))
    );
    const allChars = Array.isArray(typeof chronicleCharactersList !== 'undefined' ? chronicleCharactersList : null)
      ? chronicleCharactersList
      : [];

    let html = '<option value="">+ Add Player Override or NPC to Turns...</option>';

    // 1. Removed Online Players (if any)
    const missingOnline = onlineEntries.filter((oe) => !inOrderIds.has(String(oe.id)));
    if (missingOnline.length > 0) {
      html += '<optgroup label="Online Players (Not in Turn Order)">';
      missingOnline.forEach((oe) => {
        html += `<option value="${safeEscape(oe.id)}">${safeEscape(oe.name)} (${safeEscape(oe.subtitle)})</option>`;
      });
      html += '</optgroup>';
    }

    // 2. Offline Player Characters (GM Override Exception)
    const offlinePcs = allChars.filter((c) => {
      if (String(c.category || '').toLowerCase() !== 'pc') return false;
      const cid = `char_${c.id}`;
      if (inOrderIds.has(cid)) return false;
      if (onlineCharIds.has(Number(c.id))) return false;
      return true;
    });
    if (offlinePcs.length > 0) {
      html += '<optgroup label="Offline Players (GM Override Exception)">';
      offlinePcs.forEach((c) => {
        const pLabel = c.player_name ? `Player: ${c.player_name} — Offline` : `${c.clan || 'PC'} — Offline`;
        html += `<option value="char_${c.id}">${safeEscape(c.name)} (${safeEscape(pLabel)})</option>`;
      });
      html += '</optgroup>';
    }

    // 3. Storyteller & NPCs
    html += '<optgroup label="Storyteller &amp; NPCs">';
    html += '<option value="storyteller_enemy">+ Storyteller / Antagonist Turn</option>';
    allChars
      .filter((c) => String(c.category || '').toLowerCase() !== 'pc' && !inOrderIds.has(`char_${c.id}`))
      .forEach((c) => {
        html += `<option value="char_${c.id}">${safeEscape(c.name)} (${safeEscape(c.clan || 'NPC')})</option>`;
      });
    html += '</optgroup>';

    selectEl.innerHTML = html;
    if (prevValue && Array.from(selectEl.options).some((o) => o.value === prevValue)) {
      selectEl.value = prevValue;
    }
  }

  function renderTurnTrackerStates() {
    const tracker = getResolvedTurnTrackerState();
    const order = Array.isArray(tracker.order) ? tracker.order : [];
    const activeId = tracker.active_entry_id ? String(tracker.active_entry_id) : null;
    const isStoryteller = isTurnTrackerGm();
    const currentUid =
      typeof currentUser !== 'undefined' && currentUser && currentUser.id
        ? Number(currentUser.id)
        : 0;
    const myCharId =
      typeof activeControlledCharacterId !== 'undefined' && activeControlledCharacterId
        ? Number(activeControlledCharacterId)
        : 0;

    // Toggle GM-only controls inside the widget based on current role
    const gmElementIds = [
      'btnTurnSyncCoterie',
      'btnTurnPrev',
      'btnTurnNext',
      'turnTrackerAddBar',
      'turnTrackerGmSubbar'
    ];
    gmElementIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = isStoryteller ? '' : 'none';
      }
    });

    const roundLabelEl = document.getElementById('turnTrackerRoundLabel');
    if (roundLabelEl) {
      roundLabelEl.innerText = `Round ${tracker.round || 1}`;
    }

    const selectEl = document.getElementById('turnTrackerAddSelect');
    if (selectEl && isStoryteller) {
      populateGmAddDropdown(selectEl, order);
    }

    // Render "Now Acting" Spotlight Banner
    const nowActingEl = document.getElementById('turnTrackerNowActingBanner');
    if (nowActingEl) {
      const activeEntry = order.find((item) => String(item.id) === activeId) || order[0] || null;
      if (!activeEntry) {
        nowActingEl.style.display = 'none';
        nowActingEl.innerHTML = '';
      } else {
        const isMyTurn =
          (currentUid > 0 && Number(activeEntry.userId) === currentUid) ||
          (myCharId > 0 && Number(activeEntry.characterId) === myCharId);
        nowActingEl.style.display = 'flex';
        nowActingEl.innerHTML = `
          <img src="${safeEscape(activeEntry.avatar || '/images/caine_portrait.jpg?v=2')}" onerror="this.onerror=null;this.src='/images/caine_portrait.jpg?v=2';" class="turn-now-acting-avatar" alt="">
          <div class="turn-now-acting-info">
            <div class="turn-now-acting-kicker">${isMyTurn ? '<i class="fa-solid fa-bolt"></i> YOUR TURN TO ACT!' : 'NOW ACTING'}</div>
            <div class="turn-now-acting-name">${safeEscape(activeEntry.name)}</div>
          </div>
          <span class="turn-badge ${isMyTurn ? 'turn-badge-self' : 'turn-badge-acting'}">${isMyTurn ? 'YOUR TURN' : 'ACTING'}</span>
        `;
      }
    }

    // Render Ordered Combatant List
    const widgetListEl = document.getElementById('turnTrackerWidgetList');
    if (!widgetListEl) return;

    if (order.length === 0) {
      widgetListEl.innerHTML = `
        <div class="turn-tracker-empty">
          No active players currently logged in.${isStoryteller ? ' Use the dropdown above to add an offline player or NPC.' : ''}
        </div>
      `;
      return;
    }

    widgetListEl.innerHTML = order
      .map((item, idx) => {
        const isActing = String(item.id) === activeId;
        const isSelf =
          (currentUid > 0 && Number(item.userId) === currentUid) ||
          (myCharId > 0 && Number(item.characterId) === myCharId);
        const rowClasses = [
          'turn-tracker-row',
          isActing ? 'turn-row-acting' : '',
          isStoryteller ? 'turn-row-gm-interactive' : 'turn-row-player-readonly'
        ]
          .filter(Boolean)
          .join(' ');

        const clickAttr = isStoryteller
          ? `onclick="setActiveTurnEntry('${safeEscape(item.id).replace(/'/g, "\\'")}')" draggable="true" ondragstart="handleTurnRowDragStart(event, ${idx})" ondragover="handleTurnRowDragOver(event)" ondrop="handleTurnRowDrop(event, ${idx})"`
          : '';

        const statusBadgeHtml = isActing
          ? `<span class="turn-badge ${isSelf ? 'turn-badge-self' : 'turn-badge-acting'}">${isSelf ? 'YOUR TURN' : 'ACTING'}</span>`
          : '';

        const gmControlsHtml = isStoryteller
          ? `
            <div class="turn-row-gm-btns">
              <button type="button" class="turn-arrow-btn" onclick="moveTurnTrackerEntry(${idx}, -1, event)" ${idx === 0 ? 'disabled' : ''} title="Move Up">
                <img src="images/vtm_arrow_up.svg" alt="Up" draggable="false">
              </button>
              <button type="button" class="turn-arrow-btn" onclick="moveTurnTrackerEntry(${idx}, 1, event)" ${idx === order.length - 1 ? 'disabled' : ''} title="Move Down">
                <img src="images/vtm_arrow_down.svg" alt="Down" draggable="false">
              </button>
              <button type="button" class="turn-remove-btn" onclick="removeTurnTrackerEntry('${safeEscape(item.id).replace(/'/g, "\\'")}', event)" title="Remove from Turn Order">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          `
          : '';

        return `
          <div class="${rowClasses}" ${clickAttr}>
            <span class="turn-row-index ${isActing ? 'turn-index-acting' : ''}">${idx + 1}</span>
            <img src="${safeEscape(item.avatar || '/images/caine_portrait.jpg?v=2')}" onerror="this.onerror=null;this.src='/images/caine_portrait.jpg?v=2';" class="turn-row-avatar ${isActing ? 'turn-avatar-acting' : ''}" alt="">
            <div class="turn-row-meta">
              <div class="turn-row-name-line">
                <span class="turn-row-name">${safeEscape(item.name)}</span>
                ${statusBadgeHtml}
              </div>
              <div class="turn-row-subtitle">${safeEscape(item.subtitle || '')}</div>
            </div>
            ${gmControlsHtml}
          </div>
        `;
      })
      .join('');
  }

  // Expose public API
  window.getTurnTrackerState = getResolvedTurnTrackerState;
  window.saveTurnTrackerState = saveTurnTrackerState;
  window.setActiveTurnEntry = setActiveTurnEntry;
  window.stepTurnTracker = stepTurnTracker;
  window.moveTurnTrackerEntry = moveTurnTrackerEntry;
  window.removeTurnTrackerEntry = removeTurnTrackerEntry;
  window.syncTurnTrackerWithCoterie = syncTurnTrackerWithCoterie;
  window.addSelectedToTurnTracker = addSelectedToTurnTracker;
  window.clearTurnTrackerOrder = clearTurnTrackerOrder;
  window.handleTurnRowDragStart = handleTurnRowDragStart;
  window.handleTurnRowDragOver = handleTurnRowDragOver;
  window.handleTurnRowDrop = handleTurnRowDrop;
  window.renderTurnTrackerStates = renderTurnTrackerStates;

  if (typeof window.vtmIsolateModule === 'function') {
    window.vtmIsolateModule('turn_tracker', [
      'getTurnTrackerState',
      'saveTurnTrackerState',
      'setActiveTurnEntry',
      'stepTurnTracker',
      'moveTurnTrackerEntry',
      'removeTurnTrackerEntry',
      'syncTurnTrackerWithCoterie',
      'addSelectedToTurnTracker',
      'clearTurnTrackerOrder',
      'handleTurnRowDragStart',
      'handleTurnRowDragOver',
      'handleTurnRowDrop',
      'renderTurnTrackerStates'
    ]);
  }
})();
