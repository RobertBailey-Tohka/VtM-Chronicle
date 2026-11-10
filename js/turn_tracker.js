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

    // 1. Keep saved entries ONLY if they are actual players who are currently online OR explicitly added by GM (manualOverride)
    savedOrder.forEach((item) => {
      if (!item || !item.id || item.isStoryteller) return;
      const itemId = String(item.id);
      if (includedIds.has(itemId)) return;

      const charId = item.characterId || (itemId.startsWith('char_') ? Number(itemId.replace('char_', '')) : null);
      const charRec = charId ? allChars.find((c) => Number(c.id) === Number(charId)) : null;
      if (charRec && String(charRec.category || '').toLowerCase() !== 'pc') {
        // Only actual players belong in the turn queue
        return;
      }

      const matchingOnline =
        onlineById.get(itemId) ||
        (item.userId ? onlineByUserId.get(Number(item.userId)) : null);
      const isOnlineNow = Boolean(matchingOnline);
      const isManualException = Boolean(item.manualOverride);

      if (!isOnlineNow && !isManualException) {
        // Offline player who was NOT manually overridden by GM -> exclude automatically
        return;
      }
      if (isOnlineNow && excludedOnlineIds.has(itemId) && !item.manualOverride) {
        // Online player explicitly removed by GM -> keep excluded until GM re-adds or resets
        return;
      }

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
        resolvedSubtitle = charRec.player_name
          ? `Player: ${charRec.player_name} (Offline • GM Added)`
          : 'Offline Player (GM Added)';
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

  function getAllSelectablePlayers() {
    const onlineEntries = getOnlinePlayerEntries();
    const onlineByCharId = new Map();
    const onlineByUserId = new Map();
    onlineEntries.forEach((oe) => {
      if (oe.characterId) onlineByCharId.set(Number(oe.characterId), oe);
      if (oe.userId) onlineByUserId.set(Number(oe.userId), oe);
    });

    const allChars = Array.isArray(typeof chronicleCharactersList !== 'undefined' ? chronicleCharactersList : null)
      ? chronicleCharactersList
      : [];
    const pcChars = allChars.filter((c) => String(c.category || '').toLowerCase() === 'pc');

    const players = [];
    const seenIds = new Set();

    pcChars.forEach((c) => {
      const entryId = `char_${c.id}`;
      if (seenIds.has(entryId)) return;
      seenIds.add(entryId);
      const onlineMatch =
        onlineByCharId.get(Number(c.id)) ||
        (c.user_id ? onlineByUserId.get(Number(c.user_id)) : null);
      const isOnline = Boolean(onlineMatch);
      const avatarUrl =
        c.avatar_url && !c.avatar_url.includes('bg_page_1.png')
          ? c.avatar_url
          : (onlineMatch && onlineMatch.avatar) || '/images/caine_portrait.jpg?v=2';
      const playerName = c.player_name || (onlineMatch && onlineMatch.subtitle ? onlineMatch.subtitle.replace(/^Player:\s*/i, '') : 'Player');
      players.push({
        id: entryId,
        userId: c.user_id ? Number(c.user_id) : (onlineMatch ? onlineMatch.userId : null),
        characterId: Number(c.id),
        name: c.name || 'Kindred',
        playerName,
        clan: c.clan || 'Kindred',
        avatar: avatarUrl,
        isOnline
      });
    });

    // Also include any online player who doesn't have a PC record yet
    onlineEntries.forEach((oe) => {
      if (seenIds.has(String(oe.id))) return;
      if (oe.userId && players.some((p) => p.userId && Number(p.userId) === Number(oe.userId))) return;
      seenIds.add(String(oe.id));
      players.push({
        id: String(oe.id),
        userId: oe.userId,
        characterId: oe.characterId || null,
        name: oe.name,
        playerName: oe.subtitle ? oe.subtitle.replace(/^Player:\s*/i, '') : oe.name,
        clan: 'Player',
        avatar: oe.avatar || '/images/caine_portrait.jpg?v=2',
        isOnline: true
      });
    });

    return players.sort((a, b) => {
      if (a.isOnline !== b.isOnline) return a.isOnline ? -1 : 1;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function renderTurnTrackerAddPlayerModalList() {
    const listEl = document.getElementById('turnTrackerAddPlayerList');
    if (!listEl) return;
    const tracker = getResolvedTurnTrackerState();
    const inOrderIds = new Set((tracker.order || []).map((item) => String(item.id)));
    const inOrderUserIds = new Set(
      (tracker.order || []).filter((item) => item.userId).map((item) => Number(item.userId))
    );
    const players = getAllSelectablePlayers();

    if (players.length === 0) {
      listEl.innerHTML = `<div style="padding:16px; text-align:center; color:#9ca3af; font-size:12px;">No players found in this chronicle.</div>`;
      return;
    }

    listEl.innerHTML = players
      .map((p) => {
        const alreadyInQueue =
          inOrderIds.has(String(p.id)) || (p.userId && inOrderUserIds.has(Number(p.userId)));
        const statusPill = p.isOnline
          ? `<span style="font-size:9px; padding:1px 6px; border-radius:999px; background:rgba(16,185,129,0.18); color:#34d399; border:1px solid rgba(16,185,129,0.4); font-weight:700;">ONLINE</span>`
          : `<span style="font-size:9px; padding:1px 6px; border-radius:999px; background:rgba(156,163,175,0.12); color:#9ca3af; border:1px solid rgba(156,163,175,0.28); font-weight:700;">OFFLINE</span>`;

        const actionBtn = alreadyInQueue
          ? `<button type="button" onclick="removeTurnTrackerEntry('${safeEscape(p.id).replace(/'/g, "\\'")}', event)" style="padding:5px 10px; font-size:11px; font-weight:700; border-radius:5px; background:rgba(255,255,255,0.06); color:#9ca3af; border:1px solid rgba(255,255,255,0.14); cursor:pointer; white-space:nowrap;" title="Click to remove from queue">
               <i class="fa-solid fa-check" style="color:#10b981; margin-right:4px;"></i> In Queue
             </button>`
          : `<button type="button" onclick="addPlayerToTurnQueue('${safeEscape(p.id).replace(/'/g, "\\'")}')" style="padding:5px 12px; font-size:11px; font-weight:700; border-radius:5px; background:#dc2626; color:#ffffff; border:1px solid #ef4444; cursor:pointer; white-space:nowrap; box-shadow:0 0 8px rgba(239,68,68,0.35);">
               <i class="fa-solid fa-plus"></i> Add to Queue
             </button>`;

        return `
          <div style="display:flex; align-items:center; gap:10px; padding:9px 11px; background:${alreadyInQueue ? 'rgba(255,255,255,0.03)' : 'rgba(24,13,18,0.92)'}; border:1px solid ${alreadyInQueue ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.28)'}; border-radius:7px;">
            <img src="${safeEscape(p.avatar)}" onerror="this.onerror=null;this.src='/images/caine_portrait.jpg?v=2';" style="width:34px; height:34px; border-radius:50%; object-fit:cover; border:1.5px solid ${p.isOnline ? '#10b981' : '#4b5563'}; flex-shrink:0;" alt="">
            <div style="flex:1; min-width:0;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:13px; font-weight:700; color:#f8fafc; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeEscape(p.name)}</span>
                ${statusPill}
              </div>
              <div style="font-size:11px; color:#9ca3af; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                Player: ${safeEscape(p.playerName)} • ${safeEscape(p.clan)}
              </div>
            </div>
            ${actionBtn}
          </div>
        `;
      })
      .join('');
  }

  function openTurnTrackerAddPlayerModal() {
    if (!isTurnTrackerGm()) return;
    const modalEl = document.getElementById('turnTrackerAddPlayerModal');
    if (!modalEl) return;
    renderTurnTrackerAddPlayerModalList();
    modalEl.classList.add('active');
    modalEl.style.display = 'flex';
  }

  function closeTurnTrackerAddPlayerModal() {
    const modalEl = document.getElementById('turnTrackerAddPlayerModal');
    if (!modalEl) return;
    modalEl.classList.remove('active');
    modalEl.style.display = 'none';
  }

  function addPlayerToTurnQueue(val) {
    if (!isTurnTrackerGm() || !val) return;
    const tracker = getResolvedTurnTrackerState();

    // Remove from excluded_online_ids if re-adding a previously removed online player
    tracker.excluded_online_ids = (tracker.excluded_online_ids || []).filter((id) => String(id) !== String(val));

    if (val.startsWith('char_')) {
      const charId = Number(val.replace('char_', ''));
      const allChars = Array.isArray(typeof chronicleCharactersList !== 'undefined' ? chronicleCharactersList : null)
        ? chronicleCharactersList
        : [];
      const charRec = allChars.find((c) => Number(c.id) === charId);
      if (charRec && String(charRec.category || '').toLowerCase() === 'pc' && !tracker.order.some((item) => String(item.id) === val)) {
        const avatarUrl =
          charRec.avatar_url && !charRec.avatar_url.includes('bg_page_1.png')
            ? charRec.avatar_url
            : '/images/caine_portrait.jpg?v=2';
        const onlineEntries = getOnlinePlayerEntries();
        const isOnlineNow = onlineEntries.some(
          (oe) => String(oe.id) === val || (charRec.user_id && oe.userId && Number(oe.userId) === Number(charRec.user_id))
        );
        tracker.order.push({
          id: val,
          userId: charRec.user_id ? Number(charRec.user_id) : null,
          characterId: Number(charRec.id),
          name: charRec.name || 'Kindred',
          subtitle: charRec.player_name
            ? `Player: ${charRec.player_name}${isOnlineNow ? '' : ' (Offline • GM Added)'}`
            : isOnlineNow
              ? 'Online Player'
              : 'Offline Player (GM Added)',
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
    saveTurnTrackerState(tracker);
    renderTurnTrackerAddPlayerModalList();
  }

  function addSelectedToTurnTracker() {
    openTurnTrackerAddPlayerModal();
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

  function renderTurnTrackerStates() {
    const tracker = getResolvedTurnTrackerState();
    const order = Array.isArray(tracker.order) ? tracker.order : [];
    const activeId = tracker.active_entry_id ? String(tracker.active_entry_id) : null;
    const isStoryteller = isTurnTrackerGm();
    const currentUid =
      typeof currentUser !== 'undefined' && currentUser && currentUser.id
        ? Number(currentUser.id)
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

    const addModalEl = document.getElementById('turnTrackerAddPlayerModal');
    if (addModalEl && addModalEl.classList.contains('active') && isStoryteller) {
      renderTurnTrackerAddPlayerModalList();
    }

    // Render "Now Acting" Spotlight Banner
    const nowActingEl = document.getElementById('turnTrackerNowActingBanner');
    if (nowActingEl) {
      const activeEntry = order.find((item) => String(item.id) === activeId) || order[0] || null;
      if (!activeEntry) {
        nowActingEl.style.display = 'none';
        nowActingEl.innerHTML = '';
      } else {
        const isMyTurn = !isStoryteller && currentUid > 0 && Number(activeEntry.userId) === currentUid;
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
          No active players currently logged in.${isStoryteller ? ' Click "Add Player to Queue" above to add an offline player.' : ''}
        </div>
      `;
      return;
    }

    widgetListEl.innerHTML = order
      .map((item, idx) => {
        const isActing = String(item.id) === activeId;
        const isSelf = !isStoryteller && currentUid > 0 && Number(item.userId) === currentUid;
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
  window.openTurnTrackerAddPlayerModal = openTurnTrackerAddPlayerModal;
  window.closeTurnTrackerAddPlayerModal = closeTurnTrackerAddPlayerModal;
  window.addPlayerToTurnQueue = addPlayerToTurnQueue;
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
      'openTurnTrackerAddPlayerModal',
      'closeTurnTrackerAddPlayerModal',
      'addPlayerToTurnQueue',
      'clearTurnTrackerOrder',
      'handleTurnRowDragStart',
      'handleTurnRowDragOver',
      'handleTurnRowDrop',
      'renderTurnTrackerStates'
    ]);
  }
})();
