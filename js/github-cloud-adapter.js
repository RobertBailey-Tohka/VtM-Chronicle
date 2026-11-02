/**
 * Vampire: The Masquerade (V5) — Elysium Virtual Tabletop
 * Serverless GitHub Pages & Cloud Sync Adapter (Oct 26 / Nov 1 Edition)
 *
 * Automatically activates when hosted on GitHub Pages (*.github.io) or when
 * the local Express/MariaDB backend (/api/health) is unreachable.
 *
 * Features:
 * - Full REST API emulation for all /api/* routes (Auth, Chronicles, Campaigns,
 *   Episodes, Gameboard State/Canvas/Pins/Relationship Map, Clues, Lore,
 *   Characters, V5 Sheets, Vitals, Award XP, Controllers, NPC Fields,
 *   Personal Notes, Rules Codex Tree/PDFs, Clan Symbols, Asset Library + Default Assets,
 *   TinyMCE Gallery, Chat, and Dice Rolls)
 * - Full Socket.IO client/server emulation
 * - Real-time cross-device & cross-tab synchronization via ntfy.sh SSE +
 *   BroadcastChannel + Cloud JSON State Sync (bytebin)
 * - Automatic GitHub Pages repository subpath asset resolution
 */
(function () {
  'use strict';

  // If running inside a character sheet iframe and parent already has the adapter active,
  // bind directly to the parent's fetch & storage so edits sync instantaneously.
  try {
    if (window.parent && window.parent !== window && window.parent.__VTM_CLOUD_ADAPTER__) {
      window.__VTM_CLOUD_ADAPTER__ = window.parent.__VTM_CLOUD_ADAPTER__;
      window.fetch = function (input, init) {
        return window.parent.fetch(input, init);
      };
      console.log('[VtM Cloud Adapter] Connected character sheet iframe to parent VTT state engine.');
      return;
    }
  } catch (e) {
    // Cross-origin frame check fallback
  }

  const STORAGE_KEY = 'vtm_chronicle_cloud_state_v2';
  const CLOUD_CONFIG_KEY = 'vtm_chronicle_cloud_config_v2';
  const NTFY_DEFAULT_TOPIC = 'vtm-elysium-labyrinth-2026-sync';
  const CLIENT_ID = 'vtm_' + Math.random().toString(36).substring(2, 10);

  // Detect base path (e.g. "/VtM-Chronicle" on GitHub Pages)
  function detectBasePath() {
    const p = window.location.pathname || '/';
    const sheetsIdx = p.indexOf('/sheets/');
    if (sheetsIdx > 0) return p.substring(0, sheetsIdx);
    const indexIdx = p.indexOf('/index.html');
    if (indexIdx > 0) return p.substring(0, indexIdx);
    const trimmed = p.replace(/\/+$/, '');
    if (!trimmed || trimmed === '') return '';
    const parts = trimmed.split('/').filter(Boolean);
    if (parts.length >= 1 && (window.location.hostname.endsWith('github.io') || parts[0] !== 'sheets')) {
      return '/' + parts[0];
    }
    return '';
  }

  const BASE_PATH = detectBasePath();

  function prefixAssetUrl(url) {
    if (!url || typeof url !== 'string' || !BASE_PATH) return url;
    if (
      (url.startsWith('/images/') ||
        url.startsWith('/uploads/') ||
        url.startsWith('/default_assets/') ||
        url.startsWith('/sheets/') ||
        url.startsWith('/css/') ||
        url.startsWith('/js/') ||
        url.startsWith('/pdfjs/') ||
        url.startsWith('/webfonts/') ||
        url === '/dossier_template.html') &&
      !url.startsWith(BASE_PATH + '/')
    ) {
      return BASE_PATH + url;
    }
    return url;
  }

  function stripBasePathFromUrl(url) {
    if (!url || typeof url !== 'string' || !BASE_PATH) return url;
    if (url.startsWith(BASE_PATH + '/')) {
      return url.substring(BASE_PATH.length);
    }
    return url;
  }

  function rewritePayloadUrlsOut(obj) {
    if (!BASE_PATH || obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') {
      if (obj.startsWith('{') || obj.startsWith('[')) {
        try {
          const parsed = JSON.parse(obj);
          return JSON.stringify(rewritePayloadUrlsOut(parsed));
        } catch (e) {
          return prefixAssetUrl(obj);
        }
      }
      return prefixAssetUrl(obj);
    }
    if (Array.isArray(obj)) return obj.map(rewritePayloadUrlsOut);
    if (typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = rewritePayloadUrlsOut(v);
      }
      return out;
    }
    return obj;
  }

  function rewritePayloadUrlsIn(obj) {
    if (!BASE_PATH || obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return stripBasePathFromUrl(obj);
    if (Array.isArray(obj)) return obj.map(rewritePayloadUrlsIn);
    if (typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) {
        out[k] = rewritePayloadUrlsIn(v);
      }
      return out;
    }
    return obj;
  }

  const nativeFetch = window.fetch.bind(window);
  let isServerlessMode =
    window.location.hostname.endsWith('github.io') ||
    window.location.protocol === 'file:' ||
    window.location.search.includes('serverless=1');
  let modeCheckPromise = null;
  let stateReadyPromise = null;
  let db = null;

  // BroadcastChannel for instant multi-tab sync
  const localBus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('vtm_chronicle_bus_v2') : null;

  // Virtual Socket.IO registry
  const virtualSockets = new Set();
  const characterRollHistory = {};

  function defaultChronicleId() {
    if (db && Array.isArray(db.chronicles) && db.chronicles.length > 0) {
      return Number(db.chronicles[0].id) || 6;
    }
    return 6;
  }

  function getCloudConfig() {
    try {
      const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return {
        topic: parsed.topic || NTFY_DEFAULT_TOPIC,
        syncEnabled: parsed.syncEnabled !== false,
        lastCloudKey: parsed.lastCloudKey || null,
      };
    } catch (e) {
      return { topic: NTFY_DEFAULT_TOPIC, syncEnabled: true, lastCloudKey: null };
    }
  }

  function saveCloudConfig(cfg) {
    try {
      localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify({ ...getCloudConfig(), ...cfg }));
    } catch (e) {}
  }

  async function checkBackendMode() {
    if (isServerlessMode) return true;
    if (modeCheckPromise) return modeCheckPromise;
    modeCheckPromise = (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 1200);
        const res = await nativeFetch((BASE_PATH || '') + '/api/health', { signal: ctrl.signal });
        clearTimeout(timer);
        if (res.ok) {
          isServerlessMode = false;
          return false;
        }
      } catch (e) {}
      isServerlessMode = true;
      return true;
    })();
    return modeCheckPromise;
  }

  async function ensureDbLoaded() {
    if (db) return db;
    if (stateReadyPromise) return stateReadyPromise;
    stateReadyPromise = (async () => {
      let seed = null;
      const inSheetsDir = window.location.pathname.includes('/sheets/');
      const candidates = [
        (BASE_PATH || '') + '/data/chronicle-state.json',
        inSheetsDir ? '../data/chronicle-state.json' : 'data/chronicle-state.json',
        './data/chronicle-state.json',
      ];
      for (const url of candidates) {
        try {
          const res = await nativeFetch(url, { cache: 'no-cache' });
          if (res.ok) {
            seed = await res.json();
            break;
          }
        } catch (e) {}
      }

      if (seed && seed.tables && typeof seed.tables === 'object') {
        seed = { ...seed, ...seed.tables };
        delete seed.tables;
      }

      if (!seed) {
        seed = {
          users: [{ id: 11, username: 'TohkaTakushi', display_name: 'TohkaTakushi', role: 'gm' }],
          chronicles: [{ id: 6, title: "Labyrinth's Children", setting_city: 'Louisville, KY', setting_year: '1999', gm_id: 11 }],
          campaigns: [{ id: 5, chronicle_id: 6, title: 'The Labrynth', gm_id: 11 }],
          chronicle_members: [],
          episodes: [],
          clue_matrices: [],
          clues: [],
          lore_matrices: [],
          lore_entries: [],
          gameboard_state: [],
          gameboard_pins: [],
          npc_categories: [],
          rules_codex: [],
          clan_symbols: [],
          asset_categories: [],
          chronicle_assets: [],
          chat_messages: [],
          characters: [],
          dice_rolls: [],
          personal_notes: [],
          default_assets: [],
          default_asset_categories: [],
          uploaded_files: [],
        };
      }

      // Ensure all expected table arrays exist
      const expectedArrays = [
        'users',
        'chronicles',
        'campaigns',
        'chronicle_members',
        'episodes',
        'clue_matrices',
        'clues',
        'lore_matrices',
        'lore_entries',
        'gameboard_state',
        'gameboard_pins',
        'npc_categories',
        'rules_codex',
        'clan_symbols',
        'asset_categories',
        'chronicle_assets',
        'chat_messages',
        'characters',
        'dice_rolls',
        'personal_notes',
        'default_assets',
        'default_asset_categories',
        'uploaded_files',
      ];
      for (const tbl of expectedArrays) {
        if (!Array.isArray(seed[tbl])) seed[tbl] = [];
      }

      // Overlay any locally saved edits
      try {
        localStorage.removeItem('vtm_chronicle_cloud_state_v1');
        const savedRaw = localStorage.getItem(STORAGE_KEY);
        if (savedRaw) {
          const saved = JSON.parse(savedRaw);
          if (saved && Array.isArray(saved.characters) && Array.isArray(saved.chronicles) && saved.chronicles.length > 0) {
            for (const key of Object.keys(seed)) {
              if (
                Array.isArray(seed[key]) &&
                Array.isArray(saved[key]) &&
                key !== 'default_assets' &&
                key !== 'default_asset_categories'
              ) {
                const byId = new Map(seed[key].map((item) => [Number(item.id), item]));
                for (const sItem of saved[key]) {
                  if (sItem && sItem.id !== undefined) {
                    byId.set(Number(sItem.id), { ...byId.get(Number(sItem.id)), ...sItem });
                  }
                }
                if (Array.isArray(saved._deleted?.[key])) {
                  for (const delId of saved._deleted[key]) byId.delete(Number(delId));
                }
                seed[key] = Array.from(byId.values());
              }
            }
            seed._deleted = saved._deleted || {};
            seed._updatedAt = saved._updatedAt || seed.exportedAt;
          }
        }
      } catch (e) {
        console.warn('[VtM Cloud Adapter] Could not merge localStorage state:', e);
      }

      seed._deleted = seed._deleted || {};
      db = seed;

      // Ensure active user session matches a valid user in db.users
      let currentStoredUser = null;
      try {
        const rawUser = localStorage.getItem('vtm_user');
        if (rawUser) currentStoredUser = JSON.parse(rawUser);
      } catch (e) {}

      const matchedUser =
        currentStoredUser &&
        db.users.find(
          (u) =>
            Number(u.id) === Number(currentStoredUser.id) ||
            (currentStoredUser.username &&
              String(u.username).toLowerCase() === String(currentStoredUser.username).toLowerCase())
        );

      if (!localStorage.getItem('vtm_auth_token') || !matchedUser || Number(matchedUser.id) !== Number(currentStoredUser?.id)) {
        const targetUser = matchedUser || db.users.find((u) => u.username === 'TohkaTakushi') || db.users[0];
        if (targetUser) {
          const isGm =
            targetUser.role === 'gm' ||
            targetUser.username === 'TohkaTakushi' ||
            (db.chronicles || []).some((c) => Number(c.gm_id) === Number(targetUser.id));
          const uPayload = {
            id: targetUser.id,
            username: targetUser.username,
            displayName: targetUser.display_name || targetUser.username,
            role: isGm ? 'gm' : targetUser.role || 'player',
            bio: targetUser.bio || null,
            avatar_url: targetUser.avatar_url || null,
            avatar: targetUser.avatar_url || null,
          };
          localStorage.setItem('vtm_auth_token', makeMockToken(uPayload));
          localStorage.setItem('vtm_user', JSON.stringify(uPayload));
        }
      }

      return db;
    })();
    return stateReadyPromise;
  }

  function persistDb(broadcastPatch = null) {
    if (!db) return;
    db._updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      console.warn('[VtM Cloud Adapter] localStorage quota warning:', e);
    }
    if (broadcastPatch) {
      publishRealtimeEvent('db:patch', broadcastPatch);
    }
  }

  function recordDelete(table, id) {
    if (!db._deleted) db._deleted = {};
    if (!Array.isArray(db._deleted[table])) db._deleted[table] = [];
    if (!db._deleted[table].includes(Number(id))) {
      db._deleted[table].push(Number(id));
    }
  }

  function nextId(table) {
    const arr = db[table] || [];
    let max = 0;
    for (const r of arr) {
      if (Number(r.id) > max) max = Number(r.id);
    }
    return max + 1;
  }

  function makeMockToken(userPayload) {
    const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(userPayload))))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `${b64}.vtm_cloud_sig`;
  }

  function parseAuthUser(headers) {
    try {
      let auth = '';
      if (headers) {
        if (typeof headers.get === 'function') auth = headers.get('Authorization') || headers.get('authorization') || '';
        else auth = headers.Authorization || headers.authorization || '';
      }
      if (!auth && localStorage.getItem('vtm_auth_token')) {
        auth = 'Bearer ' + localStorage.getItem('vtm_auth_token');
      }
      if (auth && auth.startsWith('Bearer ')) {
        const token = auth.substring(7);
        const [data] = token.split('.');
        if (data) {
          const json = decodeURIComponent(escape(atob(data.replace(/-/g, '+').replace(/_/g, '/'))));
          const parsed = JSON.parse(json);
          if (db && Array.isArray(db.users)) {
            const byId = db.users.find((u) => Number(u.id) === Number(parsed.id));
            if (byId) return { ...parsed, id: byId.id, username: byId.username, displayName: byId.display_name || byId.username };
            const byName = db.users.find(
              (u) => parsed.username && String(u.username).toLowerCase() === String(parsed.username).toLowerCase()
            );
            if (byName) return { ...parsed, id: byName.id, username: byName.username, displayName: byName.display_name || byName.username };
          }
          return parsed;
        }
      }
    } catch (e) {}
    const fallback = (db && db.users && db.users.find((u) => u.username === 'TohkaTakushi')) ||
      (db && db.users && db.users[0]) || {
        id: 11,
        username: 'TohkaTakushi',
        displayName: 'TohkaTakushi',
        role: 'gm',
      };
    return {
      id: fallback.id,
      username: fallback.username,
      displayName: fallback.display_name || fallback.displayName || fallback.username,
      role: fallback.role || 'gm',
    };
  }

  function isChronicleGM(chronicleId, userId) {
    if (!chronicleId || !userId || !db) return true;
    const c = (db.chronicles || []).find((x) => Number(x.id) === Number(chronicleId));
    if (c && Number(c.gm_id) === Number(userId)) return true;
    const m = (db.chronicle_members || []).find(
      (x) => Number(x.chronicle_id) === Number(chronicleId) && Number(x.user_id) === Number(userId)
    );
    if (m && (m.role === 'storyteller' || m.role === 'gm')) return true;
    const u = (db.users || []).find((x) => Number(x.id) === Number(userId));
    if (u && (u.role === 'gm' || u.username === 'TohkaTakushi' || u.username === 'storyteller')) return true;
    return false;
  }

  // ---------------- REAL-TIME SYNC ENGINE (BroadcastChannel + ntfy.sh SSE) ----------------
  let sseSource = null;

  function emitToLocalSockets(event, payload) {
    const outPayload = rewritePayloadUrlsOut(payload);
    for (const sock of virtualSockets) {
      sock._trigger(event, outPayload);
    }
  }

  function applyIncomingPacket(pkt) {
    if (!pkt || pkt.senderId === CLIENT_ID) return;
    if (pkt.type === 'socket_event') {
      if (pkt.dbPatch && db) {
        applyDbPatch(pkt.dbPatch);
      }
      emitToLocalSockets(pkt.event, pkt.data);
    } else if (pkt.type === 'db:patch' && db) {
      applyDbPatch(pkt.data);
    } else if (pkt.type === 'cloud_snapshot' && pkt.key) {
      pullCloudSnapshot(pkt.key);
    }
  }

  function applyDbPatch(patch) {
    if (!patch || !db) return;
    const { table, row, deleteId } = patch;
    if (!table || !Array.isArray(db[table])) return;
    if (deleteId !== undefined) {
      db[table] = db[table].filter((r) => Number(r.id) !== Number(deleteId));
      recordDelete(table, deleteId);
    } else if (row && row.id !== undefined) {
      const idx = db[table].findIndex((r) => Number(r.id) === Number(row.id));
      if (idx >= 0) db[table][idx] = { ...db[table][idx], ...row };
      else db[table].push(row);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {}
  }

  function publishRealtimeEvent(event, data, dbPatch = null) {
    const pkt = {
      senderId: CLIENT_ID,
      ts: Date.now(),
      type: event === 'db:patch' ? 'db:patch' : 'socket_event',
      event,
      data,
      dbPatch,
    };
    if (localBus) {
      try {
        localBus.postMessage(pkt);
      } catch (e) {}
    }
    const cfg = getCloudConfig();
    if (cfg.syncEnabled && cfg.topic && navigator.onLine) {
      const bodyStr = JSON.stringify(pkt);
      if (bodyStr.length < 3800) {
        nativeFetch(`https://ntfy.sh/${encodeURIComponent(cfg.topic)}`, {
          method: 'POST',
          body: bodyStr,
        }).catch(() => {});
      } else {
        pushCloudSnapshot(false);
      }
    }
  }

  async function pushCloudSnapshot(showAlert = false) {
    await ensureDbLoaded();
    try {
      const res = await nativeFetch('https://bytebin.lucko.me/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(db),
      });
      if (res.ok) {
        const { key } = await res.json();
        if (key) {
          saveCloudConfig({ lastCloudKey: key });
          const cfg = getCloudConfig();
          if (cfg.topic) {
            nativeFetch(`https://ntfy.sh/${encodeURIComponent(cfg.topic)}`, {
              method: 'POST',
              body: JSON.stringify({
                senderId: CLIENT_ID,
                ts: Date.now(),
                type: 'cloud_snapshot',
                key,
              }),
            }).catch(() => {});
          }
          updateCloudBadgeStatus('CLOUD SYNCED');
          if (showAlert) alert(`Chronicle state synced to cloud! Share code: ${key}`);
          return key;
        }
      }
    } catch (e) {
      if (showAlert) alert('Cloud push failed: ' + e.message);
    }
    return null;
  }

  async function pullCloudSnapshot(key, showAlert = false) {
    if (!key) return;
    try {
      const res = await nativeFetch(`https://bytebin.lucko.me/${encodeURIComponent(key)}`);
      if (res.ok) {
        let remoteDb = await res.json();
        if (remoteDb && remoteDb.tables && typeof remoteDb.tables === 'object') {
          remoteDb = { ...remoteDb, ...remoteDb.tables };
          delete remoteDb.tables;
        }
        if (remoteDb && remoteDb.characters && remoteDb.chronicles) {
          db = remoteDb;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
          saveCloudConfig({ lastCloudKey: key });
          updateCloudBadgeStatus('CLOUD UPDATED');
          emitToLocalSockets('character:updated', {});
          emitToLocalSockets('rules:updated', {});
          if (showAlert) {
            alert('Cloud state loaded! Reloading table...');
            window.location.reload();
          }
        }
      }
    } catch (e) {
      if (showAlert) alert('Could not load cloud snapshot: ' + e.message);
    }
  }

  function startRealtimeListeners() {
    if (localBus) {
      localBus.onmessage = (ev) => applyIncomingPacket(ev.data);
    }
    window.addEventListener('storage', (ev) => {
      if (ev.key === STORAGE_KEY && ev.newValue) {
        try {
          db = JSON.parse(ev.newValue);
          emitToLocalSockets('character:updated', {});
        } catch (e) {}
      }
    });

    const cfg = getCloudConfig();
    if (!cfg.syncEnabled || !cfg.topic || typeof EventSource === 'undefined') return;
    try {
      if (sseSource) sseSource.close();
      sseSource = new EventSource(`https://ntfy.sh/${encodeURIComponent(cfg.topic)}/sse`);
      sseSource.onopen = () => updateCloudBadgeStatus('CLOUD LIVE');
      sseSource.onmessage = (ev) => {
        try {
          const wrapper = JSON.parse(ev.data);
          if (wrapper && wrapper.event === 'message' && wrapper.message) {
            const pkt = JSON.parse(wrapper.message);
            applyIncomingPacket(pkt);
          }
        } catch (e) {}
      };
      sseSource.onerror = () => updateCloudBadgeStatus('LOCAL / OFFLINE');
    } catch (e) {}
  }

  // ---------------- V5 DICE ENGINE (Exact replica of services/dice_and_sockets.js) ----------------
  function rollV5Dice(rollerName, characterId, characterName, poolSize, hungerCount, isSecret, isStorytellerWorld) {
    const hungerDiceCount = Math.min(Number(hungerCount) || 0, Number(poolSize) || 1);
    const regularDiceCount = Math.max(0, (Number(poolSize) || 1) - hungerDiceCount);
    const rollD10 = () => Math.floor(Math.random() * 10) + 1;

    const regularResults = [];
    for (let i = 0; i < regularDiceCount; i++) regularResults.push(rollD10());
    const hungerResults = [];
    for (let i = 0; i < hungerDiceCount; i++) hungerResults.push(rollD10());

    let regularTens = regularResults.filter((d) => d === 10).length;
    let hungerTens = hungerResults.filter((d) => d === 10).length;
    let totalTens = regularTens + hungerTens;
    let criticalPairs = Math.floor(totalTens / 2);
    let regularSuccesses = regularResults.filter((d) => d >= 6 && d <= 9).length;
    let hungerSuccesses = hungerResults.filter((d) => d >= 6 && d <= 9).length;
    let totalSuccesses = regularSuccesses + hungerSuccesses + totalTens + criticalPairs * 2;

    const historyKey = isStorytellerWorld ? null : characterId ? `char_${characterId}` : `roller_${rollerName}`;
    const history = historyKey ? characterRollHistory[historyKey] || { consecutiveCrits: 0, consecutiveFails: 0 } : null;
    let appliedIntervention = null;

    if (history && !isStorytellerWorld) {
      if (history.consecutiveCrits >= 2 && criticalPairs >= 1) {
        if (regularTens >= 1) {
          const idx = regularResults.indexOf(10);
          if (idx !== -1) regularResults[idx] = 9;
        } else if (hungerTens >= 1) {
          const idx = hungerResults.indexOf(10);
          if (idx !== -1) hungerResults[idx] = 9;
        }
        regularTens = regularResults.filter((d) => d === 10).length;
        hungerTens = hungerResults.filter((d) => d === 10).length;
        totalTens = regularTens + hungerTens;
        criticalPairs = Math.floor(totalTens / 2);
        regularSuccesses = regularResults.filter((d) => d >= 6 && d <= 9).length;
        hungerSuccesses = hungerResults.filter((d) => d >= 6 && d <= 9).length;
        totalSuccesses = regularSuccesses + hungerSuccesses + totalTens + criticalPairs * 2;
        appliedIntervention = 'HOT_STREAK_DAMPENED';
      } else if (history.consecutiveFails >= 2 && totalSuccesses <= 1) {
        let boosted = 0;
        for (let i = 0; i < regularResults.length && boosted < 2; i++) {
          if (regularResults[i] < 6) {
            regularResults[i] = 6 + (boosted % 2);
            boosted++;
          }
        }
        regularTens = regularResults.filter((d) => d === 10).length;
        hungerTens = hungerResults.filter((d) => d === 10).length;
        totalTens = regularTens + hungerTens;
        criticalPairs = Math.floor(totalTens / 2);
        regularSuccesses = regularResults.filter((d) => d >= 6 && d <= 9).length;
        hungerSuccesses = hungerResults.filter((d) => d >= 6 && d <= 9).length;
        totalSuccesses = regularSuccesses + hungerSuccesses + totalTens + criticalPairs * 2;
        appliedIntervention = 'COLD_STREAK_MITIGATED';
      }
    }

    let resultType = 'FAILURE';
    const hungerOnes = hungerResults.filter((d) => d === 1).length;
    if (criticalPairs > 0) {
      resultType = hungerTens > 0 ? 'MESSY_CRITICAL' : 'CRITICAL_WIN';
    } else if (totalSuccesses >= 1) {
      resultType = 'SUCCESS';
    } else {
      resultType = hungerOnes > 0 ? 'BESTIAL_FAILURE' : 'FAILURE';
    }

    if (history && !isStorytellerWorld) {
      if (criticalPairs > 0) {
        history.consecutiveCrits++;
        history.consecutiveFails = 0;
      } else if (totalSuccesses <= 1) {
        history.consecutiveFails++;
        history.consecutiveCrits = 0;
      } else {
        history.consecutiveCrits = 0;
        history.consecutiveFails = 0;
      }
      characterRollHistory[historyKey] = history;
    }

    return {
      roller_name: rollerName,
      character_id: characterId || null,
      character_name: characterName,
      pool_size: poolSize,
      hunger_dice: hungerCount,
      difficulty: 0,
      regular_results: regularResults.join(','),
      hunger_results: hungerResults.join(','),
      successes: totalSuccesses,
      margin: totalSuccesses,
      result_type: resultType,
      is_secret: isSecret ? 1 : 0,
      is_storyteller_world: isStorytellerWorld ? 1 : 0,
      intervention: appliedIntervention,
      created_at: new Date().toISOString(),
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------- VIRTUAL SOCKET.IO CLIENT ----------------
  function createVirtualSocket() {
    const handlers = {};
    const sock = {
      id: CLIENT_ID,
      connected: true,
      chronicleId: 6,
      on(event, fn) {
        if (!handlers[event]) handlers[event] = [];
        handlers[event].push(fn);
        if (event === 'connect') {
          setTimeout(() => fn(), 50);
        }
        return sock;
      },
      off(event, fn) {
        if (!handlers[event]) return sock;
        if (!fn) delete handlers[event];
        else handlers[event] = handlers[event].filter((h) => h !== fn);
        return sock;
      },
      _trigger(event, data) {
        const list = handlers[event] || [];
        for (const fn of list) {
          try {
            fn(data);
          } catch (e) {
            console.error(`[VtM Socket] Error in handler for ${event}:`, e);
          }
        }
      },
      emit(event, data) {
        handleSocketClientEmit(sock, event, data);
        return sock;
      },
    };
    virtualSockets.add(sock);
    return sock;
  }

  async function handleSocketClientEmit(sock, event, data) {
    await ensureDbLoaded();
    const user = parseAuthUser();
    const defChronId = defaultChronicleId();

    if (event === 'room:join') {
      const campId =
        typeof data === 'object' && data !== null
          ? Number(data.chronicleId || data.campaignId) || defChronId
          : Number(data) || defChronId;
      sock.chronicleId = campId;
      let charData = null;
      if (data && data.characterId) {
        charData = (db.characters || []).find((c) => Number(c.id) === Number(data.characterId)) || null;
      }
      const presence = {
        socketId: sock.id,
        userId: (data && data.userId) || user.id,
        username: (data && data.username) || user.username,
        displayName: (data && data.displayName) || user.displayName || user.username,
        role: (data && data.role) || user.role || 'gm',
        isSpectator: !charData,
        characterId: charData ? charData.id : null,
        characterName: charData ? charData.name : null,
        characterClan: charData ? charData.clan : null,
        avatarUrl: charData ? charData.avatar_url : null,
        hunger: charData ? Number(charData.hunger || 1) : 0,
      };
      sock.presence = presence;
      emitToLocalSockets('presence:sync', [presence]);
      return;
    }

    if (event === 'presence:set_character') {
      const { characterId, isSpectator } = data || {};
      const c = characterId ? (db.characters || []).find((x) => Number(x.id) === Number(characterId)) : null;
      const presence = {
        ...(sock.presence || {
          socketId: sock.id,
          userId: user.id,
          username: user.username,
          displayName: user.displayName,
          role: user.role || 'gm',
        }),
        isSpectator: Boolean(isSpectator || !c),
        characterId: c ? c.id : null,
        characterName: c ? c.name : null,
        characterClan: c ? c.clan : null,
        avatarUrl: c ? c.avatar_url : null,
        hunger: c ? Number(c.hunger || 1) : 0,
      };
      sock.presence = presence;
      emitToLocalSockets('presence:sync', [presence]);
      return;
    }

    if (event === 'dice:roll') {
      const {
        chronicleId,
        campaignId,
        rollerName,
        characterId,
        characterName,
        poolSize,
        hungerCount,
        isSecret,
        isStorytellerWorld,
      } = data || {};
      const campId = Number(chronicleId || campaignId) || defChronId;
      const roll = rollV5Dice(rollerName, characterId, characterName, poolSize, hungerCount, isSecret, isStorytellerWorld);
      roll.id = nextId('dice_rolls');
      roll.chronicle_id = campId;
      db.dice_rolls = db.dice_rolls || [];
      db.dice_rolls.push(roll);
      persistDb();
      emitToLocalSockets('dice:result', roll);
      publishRealtimeEvent('dice:result', roll, { table: 'dice_rolls', row: roll });
      return;
    }

    if (event === 'scene:push') {
      const campId = Number((data && (data.chronicleId || data.campaignId)) || defChronId);
      let gs = (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === campId) || db.gameboard_state[0];
      if (!gs) {
        gs = { id: 1, chronicle_id: campId };
        db.gameboard_state.push(gs);
      }
      if (data.banner !== undefined && data.banner !== null) gs.active_scene_banner = stripBasePathFromUrl(data.banner);
      if (data.location !== undefined && data.location !== null) gs.active_location = data.location;
      if (data.mood !== undefined && data.mood !== null) gs.active_mood_text = data.mood;
      if (data.episode_id !== undefined && data.episode_id !== null) gs.active_episode_id = data.episode_id;
      gs.updated_at = new Date().toISOString();
      persistDb();
      emitToLocalSockets('gameboard:scene_updated', gs);
      publishRealtimeEvent('gameboard:scene_updated', gs, { table: 'gameboard_state', row: gs });
      return;
    }

    if (event === 'vtm:live_sheet_edit' || event === 'sheet:live_edit') {
      emitToLocalSockets(event, data);
      publishRealtimeEvent(event, data);
    }
  }

  // Always provide or wrap window.io so app.js `const socket = io();` works cleanly
  const nativeIo = window.io;
  window.io = function (...args) {
    if (!isServerlessMode && typeof nativeIo === 'function') {
      try {
        return nativeIo(...args);
      } catch (e) {}
    }
    return createVirtualSocket();
  };

  // ---------------- REST API ROUTER ----------------
  function jsonResponse(payload, status = 200) {
    const bodyObj = rewritePayloadUrlsOut(payload);
    return new Response(JSON.stringify(bodyObj), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  function safeParseJsonArray(val) {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  function formatCharacterForApi(r) {
    const authIds = safeParseJsonArray(r.authorized_user_ids);
    const concealedFields = safeParseJsonArray(r.concealed_fields);
    const hiddenFromIds = safeParseJsonArray(r.hidden_from_user_ids);

    let sheetData = {};
    try {
      sheetData = typeof r.sheet_data === 'string' ? JSON.parse(r.sheet_data || '{}') : r.sheet_data || {};
    } catch (e) {
      sheetData = {};
    }
    const hg = Number(r.hunger || 0);
    sheetData.hunger = Array(5)
      .fill('empty')
      .map((_, i) => (i < hg ? 'filled' : 'empty'));
    const hum = Number(
      r.humanity !== null && r.humanity !== undefined
        ? r.humanity
        : sheetData.humanity !== undefined && !Array.isArray(sheetData.humanity)
        ? sheetData.humanity
        : 7
    );
    if (Array.isArray(sheetData.humanity_states)) {
      sheetData.humanity_states = [...sheetData.humanity_states];
      for (let i = 0; i < 10; i++) {
        if (i < hum) sheetData.humanity_states[i] = 'filled';
        else if (sheetData.humanity_states[i] === 'filled') sheetData.humanity_states[i] = 'empty';
      }
      sheetData.humanity = sheetData.humanity_states;
    } else {
      sheetData.humanity = Array(10)
        .fill('empty')
        .map((_, i) => (i < hum ? 'filled' : 'empty'));
      sheetData.humanity_states = sheetData.humanity;
    }
    return {
      ...r,
      humanity: hum,
      authorized_user_ids: authIds,
      concealed_fields: concealedFields,
      hidden_from_user_ids: hiddenFromIds,
      sheet_data: sheetData,
    };
  }

  async function handleApiRequest(urlObj, method, headers, rawBody) {
    await ensureDbLoaded();
    const defChronId = defaultChronicleId();
    let path = urlObj.pathname;
    if (BASE_PATH && path.startsWith(BASE_PATH + '/')) {
      path = path.substring(BASE_PATH.length);
    }
    const q = urlObj.searchParams;
    let body = {};
    if (rawBody) {
      if (typeof rawBody === 'string') {
        try {
          body = rewritePayloadUrlsIn(JSON.parse(rawBody));
        } catch (e) {}
      } else if (typeof FormData !== 'undefined' && rawBody instanceof FormData) {
        body = {};
        rawBody.forEach((v, k) => {
          body[k] = v;
        });
      }
    }
    const user = parseAuthUser(headers);

    // 1. Health & Error Log
    if (path === '/api/health') {
      return jsonResponse({ status: 'healthy', mode: 'github-cloud-serverless', timestamp: new Date().toISOString() });
    }
    if (path === '/api/log_error') {
      return jsonResponse({ ok: true });
    }

    // 2. Auth & Profile
    if (path === '/api/auth/login' && method === 'POST') {
      const uname = (body.username || '').trim().toLowerCase();
      let u =
        (db.users || []).find(
          (x) =>
            (x.username || '').toLowerCase() === uname ||
            (x.display_name || '').toLowerCase() === uname
        ) || null;
      if (!u && uname) {
        u = {
          id: nextId('users'),
          username: body.username.trim(),
          display_name: body.username.trim(),
          role: 'player',
          created_at: new Date().toISOString(),
        };
        db.users.push(u);
        persistDb({ table: 'users', row: u });
      }
      if (!u) return jsonResponse({ error: 'User not found.' }, 401);
      const isGm =
        u.role === 'gm' ||
        u.username === 'TohkaTakushi' ||
        (db.chronicles || []).some((c) => Number(c.gm_id) === Number(u.id));
      const userPayload = {
        id: u.id,
        username: u.username,
        displayName: u.display_name || u.username,
        role: isGm ? 'gm' : u.role || 'player',
        bio: u.bio || null,
        avatar_url: u.avatar_url || null,
        avatar: u.avatar_url || null,
      };
      const token = makeMockToken(userPayload);
      return jsonResponse({ success: true, token, user: userPayload });
    }

    if (path === '/api/auth/register' && method === 'POST') {
      const username = (body.username || '').trim();
      const displayName = (body.display_name || body.displayName || username).trim();
      if (!username) return jsonResponse({ error: 'Username required.' }, 400);
      const existing = (db.users || []).find((x) => (x.username || '').toLowerCase() === username.toLowerCase());
      if (existing) return jsonResponse({ error: 'Username already taken.' }, 400);
      const newUser = {
        id: nextId('users'),
        username,
        display_name: displayName,
        role: 'player',
        created_at: new Date().toISOString(),
        bio: null,
        avatar_url: null,
      };
      db.users.push(newUser);
      db.chronicle_members.push({
        id: nextId('chronicle_members'),
        chronicle_id: defChronId,
        user_id: newUser.id,
        status: 'active',
        role: 'player',
        joined_at: new Date().toISOString(),
      });
      persistDb({ table: 'users', row: newUser });
      const userPayload = { id: newUser.id, username: newUser.username, displayName: newUser.display_name, role: 'player' };
      return jsonResponse({ success: true, token: makeMockToken(userPayload), user: userPayload });
    }

    if (path === '/api/auth/me' && method === 'GET') {
      const u = (db.users || []).find((x) => Number(x.id) === Number(user.id)) || user;
      const isGm =
        u.role === 'gm' ||
        u.username === 'TohkaTakushi' ||
        (db.chronicles || []).some((c) => Number(c.gm_id) === Number(u.id));
      return jsonResponse({
        user: {
          ...user,
          id: u.id,
          username: u.username,
          displayName: u.display_name || u.displayName || u.username,
          role: isGm ? 'gm' : u.role || user.role || 'player',
          bio: u.bio || null,
          avatar_url: u.avatar_url || null,
          avatar: u.avatar_url || null,
        },
      });
    }

    if (path === '/api/auth/me' && method === 'PUT') {
      const u = (db.users || []).find((x) => Number(x.id) === Number(user.id));
      const newAvatar = stripBasePathFromUrl(body.avatar || body.avatar_url || null);
      if (u) {
        u.avatar_url = newAvatar;
        persistDb({ table: 'users', row: u });
      }
      return jsonResponse({ success: true, avatar: newAvatar });
    }

    if (path === '/api/auth/dashboard' && method === 'GET') {
      const myCampaigns = (db.chronicles || []).filter((c) => Number(c.gm_id) === Number(user.id));
      const joinedCampaigns = (db.chronicles || []).filter((c) => {
        if (Number(c.gm_id) === Number(user.id)) return false;
        return (db.chronicle_members || []).some(
          (cm) => Number(cm.chronicle_id) === Number(c.id) && Number(cm.user_id) === Number(user.id)
        );
      });
      const myCharacters = (db.characters || []).filter((c) => Number(c.user_id) === Number(user.id));
      return jsonResponse({
        user,
        myCampaigns,
        joinedCampaigns,
        myCharacters,
      });
    }

    if (path === '/api/users/profile' && method === 'PUT') {
      const u = (db.users || []).find((x) => Number(x.id) === Number(user.id));
      if (u) {
        if (body.bio !== undefined) u.bio = body.bio || null;
        if (body.avatar_url !== undefined) u.avatar_url = stripBasePathFromUrl(body.avatar_url) || null;
        persistDb({ table: 'users', row: u });
      }
      return jsonResponse({ success: true });
    }

    if (path === '/api/users/security' && method === 'PUT') {
      const u = (db.users || []).find((x) => Number(x.id) === Number(user.id));
      if (u && body.username) {
        u.username = body.username;
        persistDb({ table: 'users', row: u });
      }
      return jsonResponse({ success: true });
    }

    // 2b. Personal Notes (/api/notes)
    if (path === '/api/notes' && method === 'GET') {
      const chronicleId = Number(q.get('chronicle_id') || q.get('campaign_id')) || defChronId;
      const notes = (db.personal_notes || [])
        .filter((n) => Number(n.user_id) === Number(user.id) && Number(n.chronicle_id) === chronicleId)
        .sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
      return jsonResponse(notes);
    }

    if (path === '/api/notes' && method === 'POST') {
      const chronicleId = Number(body.chronicle_id || body.campaign_id) || defChronId;
      const now = new Date().toISOString();
      const note = {
        id: nextId('personal_notes'),
        user_id: user.id,
        chronicle_id: chronicleId,
        campaign_id: body.campaign_id ? Number(body.campaign_id) : null,
        title: body.title || 'New Note',
        content: body.content || '',
        created_at: now,
        updated_at: now,
      };
      db.personal_notes.push(note);
      persistDb({ table: 'personal_notes', row: note });
      return jsonResponse(note);
    }

    const noteItemMatch = path.match(/^\/api\/notes\/(\d+)$/);
    if (noteItemMatch) {
      const noteId = Number(noteItemMatch[1]);
      if (method === 'PUT') {
        const note = (db.personal_notes || []).find((n) => Number(n.id) === noteId);
        if (note) {
          if (body.title !== undefined) note.title = body.title;
          if (body.content !== undefined) note.content = body.content;
          note.updated_at = new Date().toISOString();
          persistDb({ table: 'personal_notes', row: note });
        }
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.personal_notes = (db.personal_notes || []).filter((n) => Number(n.id) !== noteId);
        recordDelete('personal_notes', noteId);
        persistDb({ table: 'personal_notes', deleteId: noteId });
        return jsonResponse({ success: true });
      }
    }

    // 3. Gameboard State, Map, Scene, Canvas, Relationship Map
    if (path === '/api/gameboard/state' && method === 'GET') {
      const chronicleId = Number(q.get('chronicle_id') || q.get('campaign_id')) || defChronId;
      const gs =
        (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === chronicleId) ||
        (db.gameboard_state || [])[0] ||
        null;
      let boardCopy = gs ? { ...gs } : null;
      if (boardCopy && boardCopy.active_episode_id) {
        const ep = (db.episodes || []).find((e) => Number(e.id) === Number(boardCopy.active_episode_id));
        if (ep) {
          const camp = (db.campaigns || []).find((c) => Number(c.id) === Number(ep.campaign_id));
          boardCopy.active_episode_title = ep.title;
          boardCopy.active_arc_title = camp ? camp.title : 'Main Campaign';
          try {
            boardCopy.active_episode_maps =
              typeof ep.maps === 'string' ? JSON.parse(ep.maps || '[]') : ep.maps || [];
          } catch (e) {
            boardCopy.active_episode_maps = [];
          }
        }
      }

      const matricesById = new Map((db.clue_matrices || []).map((m) => [Number(m.id), m]));
      const discoveredClues = (db.clues || [])
        .filter((c) => {
          const m = matricesById.get(Number(c.matrix_id));
          return Number(c.discovered) === 1 && m && Number(m.chronicle_id) === chronicleId;
        })
        .map((c) => ({
          ...c,
          matrix_title: matricesById.get(Number(c.matrix_id))?.title || '',
        }));

      const loreMatById = new Map((db.lore_matrices || []).map((m) => [Number(m.id), m]));
      const discoveredLore = (db.lore_entries || [])
        .filter((le) => {
          const lm = loreMatById.get(Number(le.matrix_id));
          return Number(le.discovered) === 1 && lm && Number(lm.chronicle_id) === chronicleId;
        })
        .map((le) => ({
          ...le,
          matrix_title: loreMatById.get(Number(le.matrix_id))?.title || '',
        }));

      const players = (db.characters || [])
        .filter((c) => Number(c.chronicle_id) === chronicleId && (c.category === 'pc' || c.category === 'Kindred'))
        .map(formatCharacterForApi);

      return jsonResponse({
        gameboard: boardCopy,
        discoveredClues,
        discoveredLore,
        players,
      });
    }

    if (path === '/api/gameboard/map' && method === 'POST') {
      const targetChronicleId = Number(body.chronicle_id) || defChronId;
      const mapUrl = stripBasePathFromUrl(body.map_url);
      let gs = (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === targetChronicleId) || db.gameboard_state[0];
      if (gs) {
        gs.active_map_url = mapUrl;
        let cs = {};
        try {
          cs = typeof gs.canvas_state === 'string' ? JSON.parse(gs.canvas_state || '{}') : gs.canvas_state || {};
        } catch (e) {}
        cs.backdrop = mapUrl;
        gs.canvas_state = JSON.stringify(cs);
        persistDb();
        emitToLocalSockets('gameboard:canvas_updated', {
          chronicle_id: targetChronicleId,
          campaign_id: targetChronicleId,
          canvas_state: cs,
        });
        publishRealtimeEvent(
          'gameboard:canvas_updated',
          { chronicle_id: targetChronicleId, campaign_id: targetChronicleId, canvas_state: cs },
          { table: 'gameboard_state', row: gs }
        );
      }
      return jsonResponse({ success: true, map_url: mapUrl });
    }

    if (path === '/api/gameboard/scene' && method === 'POST') {
      const targetChronicleId = Number(body.chronicle_id) || defChronId;
      let gs = (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === targetChronicleId) || db.gameboard_state[0];
      if (gs) {
        if (body.active_scene_banner !== undefined && body.active_scene_banner !== null)
          gs.active_scene_banner = stripBasePathFromUrl(body.active_scene_banner);
        if (body.active_location !== undefined && body.active_location !== null) gs.active_location = body.active_location;
        if (body.active_npc_persona !== undefined && body.active_npc_persona !== null)
          gs.active_npc_persona = body.active_npc_persona;
        if (body.active_npc_avatar !== undefined && body.active_npc_avatar !== null)
          gs.active_npc_avatar = stripBasePathFromUrl(body.active_npc_avatar);
        if (body.active_mood_text !== undefined && body.active_mood_text !== null) gs.active_mood_text = body.active_mood_text;
        if (body.active_episode_id !== undefined && body.active_episode_id !== null)
          gs.active_episode_id = body.active_episode_id;
        if (body.game_time !== undefined && body.game_time !== null) gs.game_time = body.game_time;
        gs.updated_at = new Date().toISOString();
        persistDb();
        emitToLocalSockets('gameboard:scene_updated', gs);
        publishRealtimeEvent('gameboard:scene_updated', gs, { table: 'gameboard_state', row: gs });
      }
      return jsonResponse({ success: true, state: gs });
    }

    if (path === '/api/gameboard/canvas' && method === 'POST') {
      const targetChronicleId = Number(body.chronicle_id) || defChronId;
      let gs = (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === targetChronicleId) || db.gameboard_state[0];
      if (gs) {
        const cleanedCanvas = rewritePayloadUrlsIn(body.canvas_state);
        gs.canvas_state = typeof cleanedCanvas === 'string' ? cleanedCanvas : JSON.stringify(cleanedCanvas);
        gs.updated_at = new Date().toISOString();
        persistDb();
        emitToLocalSockets('gameboard:canvas_updated', {
          chronicle_id: targetChronicleId,
          campaign_id: targetChronicleId,
          canvas_state: cleanedCanvas,
          updated_by: user.displayName || user.username,
        });
        publishRealtimeEvent(
          'gameboard:canvas_updated',
          {
            chronicle_id: targetChronicleId,
            campaign_id: targetChronicleId,
            canvas_state: cleanedCanvas,
            updated_by: user.displayName || user.username,
          },
          { table: 'gameboard_state', row: gs }
        );
      }
      return jsonResponse({ success: true });
    }

    if (path === '/api/gameboard/relationship-map' && method === 'POST') {
      const targetChronicleId = Number(body.chronicle_id) || defChronId;
      let gs = (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === targetChronicleId) || db.gameboard_state[0];
      if (gs) {
        const cleanedMap = rewritePayloadUrlsIn(body.map_state);
        gs.relationship_map_state = typeof cleanedMap === 'string' ? cleanedMap : JSON.stringify(cleanedMap || {});
        gs.updated_at = new Date().toISOString();
        persistDb();
        emitToLocalSockets('gameboard:relationship_map_updated', {
          chronicle_id: targetChronicleId,
          campaign_id: targetChronicleId,
          map_state: cleanedMap,
          updated_by: user.displayName || user.username,
        });
        publishRealtimeEvent(
          'gameboard:relationship_map_updated',
          {
            chronicle_id: targetChronicleId,
            campaign_id: targetChronicleId,
            map_state: cleanedMap,
            updated_by: user.displayName || user.username,
          },
          { table: 'gameboard_state', row: gs }
        );
      }
      return jsonResponse({ success: true });
    }

    // 4. Chat Messages
    if (path === '/api/chat/messages' && method === 'GET') {
      const chronicleId = Number(q.get('chronicle_id') || q.get('campaign_id')) || defChronId;
      const msgs = (db.chat_messages || [])
        .filter((m) => Number(m.chronicle_id) === chronicleId)
        .sort((a, b) => Number(a.id) - Number(b.id))
        .slice(-100);
      return jsonResponse(msgs);
    }

    if (path === '/api/chat/messages' && method === 'POST') {
      const chronicleId = Number(body.chronicle_id) || defChronId;
      const isGM = isChronicleGM(chronicleId, user.id);
      const newMsg = {
        id: nextId('chat_messages'),
        chronicle_id: chronicleId,
        user_id: user.id,
        sender_name: body.sender_name || user.displayName || user.username,
        sender_role: body.sender_role || (isGM ? 'gm' : 'player'),
        channel: body.channel || 'ic',
        message: (body.message || '').trim(),
        created_at: new Date().toISOString(),
      };
      db.chat_messages.push(newMsg);
      persistDb();
      emitToLocalSockets('chat:new_message', newMsg);
      publishRealtimeEvent('chat:new_message', newMsg, { table: 'chat_messages', row: newMsg });
      return jsonResponse({ success: true, message: newMsg });
    }

    // 5. Map Pins
    const pinsListMatch = path.match(/^\/api\/chronicles\/(\d+)\/pins$/);
    if (pinsListMatch) {
      const chronId = Number(pinsListMatch[1]);
      if (method === 'GET') {
        const mapUrl = stripBasePathFromUrl(q.get('mapUrl') || '');
        const pins = (db.gameboard_pins || []).filter(
          (p) => Number(p.chronicle_id) === chronId && (!mapUrl || stripBasePathFromUrl(p.map_url) === mapUrl)
        );
        return jsonResponse(pins);
      }
      if (method === 'POST') {
        const pin = {
          id: nextId('gameboard_pins'),
          chronicle_id: chronId,
          map_url: stripBasePathFromUrl(body.map_url || ''),
          x: Number(body.x) || 0,
          y: Number(body.y) || 0,
          title: body.title || 'New Pin',
          description: body.description || '',
          security_measures: body.security_measures || '',
          infiltration_routes: body.infiltration_routes || '',
          created_at: new Date().toISOString(),
        };
        db.gameboard_pins.push(pin);
        persistDb({ table: 'gameboard_pins', row: pin });
        emitToLocalSockets('gameboard:pins_updated', { chronicle_id: chronId });
        return jsonResponse({ id: pin.id, pin });
      }
    }

    const pinItemMatch = path.match(/^\/api\/chronicles\/(\d+)\/pins\/(\d+)$/);
    if (pinItemMatch) {
      const chronId = Number(pinItemMatch[1]);
      const pinId = Number(pinItemMatch[2]);
      if (method === 'PUT') {
        const pin = (db.gameboard_pins || []).find((p) => Number(p.id) === pinId && Number(p.chronicle_id) === chronId);
        if (pin) {
          if (body.title !== undefined) pin.title = body.title;
          if (body.description !== undefined) pin.description = body.description;
          if (body.security_measures !== undefined) pin.security_measures = body.security_measures;
          if (body.infiltration_routes !== undefined) pin.infiltration_routes = body.infiltration_routes;
          if (body.x !== undefined) pin.x = Number(body.x);
          if (body.y !== undefined) pin.y = Number(body.y);
          persistDb({ table: 'gameboard_pins', row: pin });
          emitToLocalSockets('gameboard:pins_updated', { chronicle_id: chronId });
        }
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.gameboard_pins = (db.gameboard_pins || []).filter((p) => Number(p.id) !== pinId);
        recordDelete('gameboard_pins', pinId);
        persistDb({ table: 'gameboard_pins', deleteId: pinId });
        emitToLocalSockets('gameboard:pins_updated', { chronicle_id: chronId });
        return jsonResponse({ success: true });
      }
    }

    // 6. Chronicles & Directory & Members & UI Settings & Award XP
    if (path === '/api/chronicles' && method === 'GET') {
      const list = (db.chronicles || []).map((c) => {
        const campaigns = (db.campaigns || [])
          .filter((camp) => Number(camp.chronicle_id) === Number(c.id))
          .map((camp) => ({
            ...camp,
            episodes: (db.episodes || [])
              .filter(
                (ep) =>
                  Number(ep.campaign_id) === Number(camp.id) ||
                  (!ep.campaign_id && Number(ep.chronicle_id) === Number(c.id))
              )
              .sort((a, b) => Number(a.episode_number) - Number(b.episode_number)),
          }));
        return { ...c, campaigns };
      });
      return jsonResponse(list);
    }

    if (path === '/api/chronicles' && method === 'POST') {
      const newChron = {
        id: nextId('chronicles'),
        title: body.title || 'New Chronicle',
        setting_city: body.setting_city || '',
        setting_year: body.setting_year || '',
        description: body.description || '',
        max_characters_per_player: body.max_characters_per_player || 2,
        gm_id: user.id,
        created_at: new Date().toISOString(),
      };
      db.chronicles.push(newChron);
      const newCamp = {
        id: nextId('campaigns'),
        chronicle_id: newChron.id,
        title: newChron.title + ' - Main Story',
        description: 'Primary campaign arc.',
        gm_id: user.id,
        created_at: new Date().toISOString(),
      };
      db.campaigns.push(newCamp);
      const newEp = {
        id: nextId('episodes'),
        chronicle_id: newChron.id,
        campaign_id: newCamp.id,
        episode_number: 1,
        title: 'Prologue',
        status: 'active',
        created_at: new Date().toISOString(),
      };
      db.episodes.push(newEp);
      persistDb({ table: 'chronicles', row: newChron });
      return jsonResponse({ success: true, id: newChron.id });
    }

    if ((path === '/api/chronicles/directory' || path === '/api/campaigns/directory') && method === 'GET') {
      const list = (db.chronicles || []).map((c) => {
        const gmUser = (db.users || []).find((u) => Number(u.id) === Number(c.gm_id));
        const mem = (db.chronicle_members || []).find(
          (cm) => Number(cm.chronicle_id) === Number(c.id) && Number(cm.user_id) === Number(user.id)
        );
        const isOwner = Number(c.gm_id) === Number(user.id) || user.role === 'gm' || user.username === 'TohkaTakushi';
        const activePlayers = (db.chronicle_members || []).filter(
          (cm) => Number(cm.chronicle_id) === Number(c.id) && (cm.status === 'active' || !cm.status)
        ).length;
        return {
          ...c,
          gm_name: gmUser ? gmUser.display_name || gmUser.username : 'Storyteller',
          is_owner: Boolean(isOwner),
          member_status: isOwner ? 'active' : mem ? mem.status || 'active' : 'active',
          member_role: isOwner ? 'storyteller' : mem ? mem.role || 'player' : 'player',
          player_count: activePlayers,
        };
      });
      return jsonResponse(list);
    }

    const chronUiSettingsMatch = path.match(/^\/api\/chronicles\/(\d+)\/ui_settings$/);
    if (chronUiSettingsMatch && method === 'PUT') {
      const cId = Number(chronUiSettingsMatch[1]);
      const chron = (db.chronicles || []).find((c) => Number(c.id) === cId);
      if (chron) {
        chron.ui_settings = typeof body === 'string' ? body : JSON.stringify(body || {});
        persistDb({ table: 'chronicles', row: chron });
        emitToLocalSockets('chronicle:ui_settings_updated', { chronicle_id: cId, ui_settings: body });
      }
      return jsonResponse({ success: true });
    }

    const awardXpMatch = path.match(/^\/api\/chronicles\/(\d+)\/award-xp$/);
    if (awardXpMatch && method === 'POST') {
      const cId = Number(awardXpMatch[1]);
      const amount = Number(body.amount) || 0;
      const reason = body.reason || 'Storyteller Award';
      const target = body.target;
      const charId = Number(body.character_id);
      const targets =
        target === 'campaign'
          ? (db.characters || []).filter((c) => Number(c.chronicle_id) === cId && c.category === 'pc')
          : (db.characters || []).filter((c) => Number(c.id) === charId && Number(c.chronicle_id) === cId);

      const updatedChars = [];
      for (const char of targets) {
        let sd = {};
        try {
          sd = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : char.sheet_data || {};
        } catch (e) {}
        const currentTotal = parseInt(sd.total_experience || sd.total || 0, 10) || 0;
        const newTotal = Math.max(0, currentTotal + amount);
        sd.total_experience = String(newTotal);
        sd.total = String(newTotal);
        if (!Array.isArray(sd.xp_log)) sd.xp_log = [];
        sd.xp_log.unshift({
          date: new Date().toISOString(),
          amount,
          reason,
          new_total: newTotal,
          by: user.displayName || user.username || 'Storyteller',
        });
        char.sheet_data = JSON.stringify(sd);
        char.updated_at = new Date().toISOString();
        updatedChars.push({ id: char.id, name: char.name, new_total: newTotal, sheet_data: sd });
        emitToLocalSockets('character:updated', { id: char.id });
        emitToLocalSockets('vtm:xp_updated', { character_id: char.id, total_experience: newTotal, xp_log: sd.xp_log });
      }
      persistDb();
      return jsonResponse({ success: true, updated_count: updatedChars.length, characters: updatedChars });
    }

    const chronIdMatch = path.match(/^\/api\/chronicles\/(\d+)$/);
    if (chronIdMatch) {
      const cId = Number(chronIdMatch[1]);
      const chron = (db.chronicles || []).find((c) => Number(c.id) === cId);
      if (method === 'GET') {
        return chron ? jsonResponse(chron) : jsonResponse({ error: 'Chronicle not found' }, 404);
      }
      if (method === 'PUT' && chron) {
        Object.assign(chron, {
          title: body.title ?? chron.title,
          setting_city: body.setting_city ?? chron.setting_city,
          setting_year: body.setting_year ?? chron.setting_year,
          description: body.description ?? chron.description,
          core_pitch: body.core_pitch ?? chron.core_pitch,
          chronicle_tenets: body.chronicle_tenets ?? chron.chronicle_tenets,
          main_factions: body.main_factions ?? chron.main_factions,
          max_characters_per_player: body.max_characters_per_player ?? chron.max_characters_per_player,
        });
        persistDb({ table: 'chronicles', row: chron });
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.chronicles = (db.chronicles || []).filter((c) => Number(c.id) !== cId);
        recordDelete('chronicles', cId);
        persistDb({ table: 'chronicles', deleteId: cId });
        return jsonResponse({ success: true });
      }
    }

    const chronMembersMatch = path.match(/^\/api\/chronicles\/(\d+)\/members$/);
    if (chronMembersMatch && method === 'GET') {
      const cId = Number(chronMembersMatch[1]);
      const members = (db.chronicle_members || [])
        .filter((cm) => Number(cm.chronicle_id) === cId)
        .map((cm) => {
          const u = (db.users || []).find((x) => Number(x.id) === Number(cm.user_id)) || {};
          const charCount = (db.characters || []).filter(
            (ch) => Number(ch.chronicle_id) === cId && Number(ch.user_id) === Number(cm.user_id)
          ).length;
          return {
            id: u.id || cm.user_id,
            username: u.username || 'player',
            display_name: u.display_name || u.username || 'Player',
            role: cm.role || 'player',
            joined_at: cm.joined_at,
            status: cm.status || 'active',
            character_count: charCount,
          };
        });
      return jsonResponse(members);
    }

    const memberRoleMatch = path.match(/^\/api\/chronicles\/(\d+)\/members\/(\d+)\/role$/);
    if (memberRoleMatch && method === 'PUT') {
      const cId = Number(memberRoleMatch[1]);
      const targetUserId = Number(memberRoleMatch[2]);
      const mem = (db.chronicle_members || []).find(
        (cm) => Number(cm.chronicle_id) === cId && Number(cm.user_id) === targetUserId
      );
      if (mem) {
        mem.role = body.role || 'player';
        persistDb({ table: 'chronicle_members', row: mem });
      }
      return jsonResponse({ success: true, message: 'Role updated' });
    }

    const memberDelMatch = path.match(/^\/api\/chronicles\/(\d+)\/members\/(\d+)$/);
    if (memberDelMatch && method === 'DELETE') {
      const cId = Number(memberDelMatch[1]);
      const targetUserId = Number(memberDelMatch[2]);
      db.chronicle_members = (db.chronicle_members || []).filter(
        (cm) => !(Number(cm.chronicle_id) === cId && Number(cm.user_id) === targetUserId)
      );
      persistDb();
      return jsonResponse({ success: true });
    }

    const availPlayersMatch = path.match(/^\/api\/chronicles\/(\d+)\/available-players$/);
    if (availPlayersMatch && method === 'GET') {
      const cId = Number(availPlayersMatch[1]);
      const activeIds = new Set(
        (db.chronicle_members || [])
          .filter((cm) => Number(cm.chronicle_id) === cId && (cm.status === 'active' || !cm.status))
          .map((cm) => Number(cm.user_id))
      );
      const players = (db.users || []).filter((u) => Number(u.id) !== Number(user.id) && !activeIds.has(Number(u.id)));
      return jsonResponse(players);
    }

    const inviteMatch = path.match(/^\/api\/chronicles\/(\d+)\/(invite|request-join|approve-join|deny-join)$/);
    if (inviteMatch && method === 'POST') {
      const cId = Number(inviteMatch[1]);
      const action = inviteMatch[2];
      const targetUserId = Number(body.user_id || user.id);
      if (action === 'deny-join') {
        db.chronicle_members = (db.chronicle_members || []).filter(
          (cm) => !(Number(cm.chronicle_id) === cId && Number(cm.user_id) === targetUserId)
        );
        persistDb();
        return jsonResponse({ success: true, message: 'Request denied.' });
      }
      let mem = (db.chronicle_members || []).find(
        (cm) => Number(cm.chronicle_id) === cId && Number(cm.user_id) === targetUserId
      );
      if (!mem) {
        mem = {
          id: nextId('chronicle_members'),
          chronicle_id: cId,
          user_id: targetUserId,
          joined_at: new Date().toISOString(),
          status: action === 'request-join' ? 'pending' : 'active',
          role: 'player',
        };
        db.chronicle_members.push(mem);
      } else {
        mem.status = action === 'request-join' ? mem.status || 'pending' : 'active';
      }
      persistDb({ table: 'chronicle_members', row: mem });
      return jsonResponse({ success: true, status: mem.status, message: 'Updated membership.' });
    }

    // 7. Campaigns & Episodes
    const chronCampMatch = path.match(/^\/api\/chronicles\/(\d+)\/campaigns$/);
    if (chronCampMatch) {
      const cId = Number(chronCampMatch[1]);
      if (method === 'GET') {
        return jsonResponse((db.campaigns || []).filter((c) => Number(c.chronicle_id) === cId));
      }
      if (method === 'POST') {
        const newCamp = {
          id: nextId('campaigns'),
          chronicle_id: cId,
          title: body.title || 'New Campaign',
          description: body.description || '',
          gm_id: user.id,
          created_at: new Date().toISOString(),
        };
        db.campaigns.push(newCamp);
        persistDb({ table: 'campaigns', row: newCamp });
        return jsonResponse({ success: true, id: newCamp.id });
      }
    }

    const campItemMatch = path.match(/^\/api\/campaigns\/(\d+)$/);
    if (campItemMatch) {
      const campId = Number(campItemMatch[1]);
      if (method === 'PUT') {
        const camp = (db.campaigns || []).find((c) => Number(c.id) === campId);
        if (camp) {
          if (body.title !== undefined) camp.title = body.title;
          if (body.description !== undefined) camp.description = body.description;
          persistDb({ table: 'campaigns', row: camp });
        }
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.campaigns = (db.campaigns || []).filter((c) => Number(c.id) !== campId);
        recordDelete('campaigns', campId);
        persistDb({ table: 'campaigns', deleteId: campId });
        return jsonResponse({ success: true });
      }
    }

    const chronEpsMatch = path.match(/^\/api\/chronicles\/(\d+)\/episodes$/);
    if (chronEpsMatch && method === 'POST') {
      const cId = Number(chronEpsMatch[1]);
      const campId =
        Number(body.campaign_id) ||
        (db.campaigns || []).find((c) => Number(c.chronicle_id) === cId)?.id ||
        1;
      const newEp = {
        id: nextId('episodes'),
        chronicle_id: cId,
        campaign_id: campId,
        episode_number: Number(body.episode_number) || 1,
        title: body.title || 'New Episode',
        location: body.location || '',
        revealed: body.revealed ? 1 : 0,
        concepts: body.concepts || '',
        hook: body.hook || '',
        scenes: typeof body.scenes === 'string' ? body.scenes : JSON.stringify(body.scenes || []),
        npc_agendas: typeof body.npc_agendas === 'string' ? body.npc_agendas : JSON.stringify(body.npc_agendas || []),
        status: 'planned',
        created_at: new Date().toISOString(),
        maps: null,
      };
      db.episodes.push(newEp);
      persistDb({ table: 'episodes', row: newEp });
      return jsonResponse({ success: true, id: newEp.id });
    }

    if (path === '/api/episodes' && method === 'GET') {
      const cId = Number(q.get('chronicle_id') || q.get('campaign_id')) || defChronId;
      const eps = (db.episodes || [])
        .filter((e) => Number(e.chronicle_id) === cId || Number(e.campaign_id) === cId)
        .sort((a, b) => Number(a.episode_number) - Number(b.episode_number));
      return jsonResponse(eps);
    }

    if ((path === '/api/episodes/reorder' || /^\/api\/campaigns\/\d+\/episodes\/reorder$/.test(path)) && method === 'PUT') {
      if (Array.isArray(body.order)) {
        for (const item of body.order) {
          const ep = (db.episodes || []).find((e) => Number(e.id) === Number(item.id));
          if (ep) ep.episode_number = Number(item.episode_number);
        }
        persistDb();
      } else if (Array.isArray(body.episode_ids)) {
        body.episode_ids.forEach((epId, idx) => {
          const ep = (db.episodes || []).find((e) => Number(e.id) === Number(epId));
          if (ep) ep.episode_number = idx + 1;
        });
        persistDb();
      }
      return jsonResponse({ success: true });
    }

    const epItemMatch = path.match(/^\/api\/episodes\/(\d+)$/);
    if (epItemMatch) {
      const epId = Number(epItemMatch[1]);
      if (method === 'DELETE') {
        db.episodes = (db.episodes || []).filter((e) => Number(e.id) !== epId);
        recordDelete('episodes', epId);
        persistDb({ table: 'episodes', deleteId: epId });
        return jsonResponse({ success: true });
      }
      const ep = (db.episodes || []).find((e) => Number(e.id) === epId);
      if (!ep) return jsonResponse({ error: 'Episode not found' }, 404);
      if (method === 'GET') {
        const copy = { ...ep };
        try {
          copy.scenes = typeof copy.scenes === 'string' ? JSON.parse(copy.scenes || '[]') : copy.scenes || [];
        } catch (e) {
          copy.scenes = [];
        }
        try {
          copy.npc_agendas =
            typeof copy.npc_agendas === 'string' ? JSON.parse(copy.npc_agendas || '[]') : copy.npc_agendas || [];
        } catch (e) {
          copy.npc_agendas = [];
        }
        copy.matrices = (db.clue_matrices || [])
          .filter((m) => Number(m.episode_id) === epId)
          .map((m) => ({
            ...m,
            clues: (db.clues || []).filter((c) => Number(c.matrix_id) === Number(m.id)),
          }));
        copy.lore_matrices = (db.lore_matrices || [])
          .filter((lm) => Number(lm.episode_id) === epId)
          .map((lm) => ({
            ...lm,
            entries: (db.lore_entries || []).filter((le) => Number(le.matrix_id) === Number(lm.id)),
          }));
        return jsonResponse(copy);
      }
      if (method === 'PUT') {
        if (body.title !== undefined) ep.title = body.title;
        if (body.location !== undefined) ep.location = body.location;
        if (body.revealed !== undefined) ep.revealed = body.revealed ? 1 : 0;
        if (body.episode_number !== undefined) ep.episode_number = body.episode_number;
        if (body.concepts !== undefined) ep.concepts = body.concepts;
        if (body.hook !== undefined) ep.hook = body.hook;
        if (body.scenes !== undefined)
          ep.scenes = typeof body.scenes === 'string' ? body.scenes : JSON.stringify(body.scenes);
        if (body.npc_agendas !== undefined)
          ep.npc_agendas = typeof body.npc_agendas === 'string' ? body.npc_agendas : JSON.stringify(body.npc_agendas);
        if (body.maps !== undefined)
          ep.maps = typeof body.maps === 'string' ? body.maps : JSON.stringify(body.maps);
        if (body.status !== undefined) ep.status = body.status;
        if (body.fallout_notes !== undefined) ep.fallout_notes = body.fallout_notes;
        persistDb({ table: 'episodes', row: ep });
        return jsonResponse({ success: true });
      }
    }

    // 8. Clue Matrices & Clues
    if (path === '/api/matrices') {
      if (method === 'GET') {
        const cId = Number(q.get('chronicle_id') || q.get('campaign_id')) || defChronId;
        const epId = q.get('episode_id') ? Number(q.get('episode_id')) : null;
        const mats = (db.clue_matrices || [])
          .filter((m) => Number(m.chronicle_id) === cId && (!epId || Number(m.episode_id) === epId || !m.episode_id))
          .map((m) => ({
            ...m,
            clues: (db.clues || []).filter((c) => Number(c.matrix_id) === Number(m.id)),
          }));
        return jsonResponse(mats);
      }
      if (method === 'POST') {
        const m = {
          id: nextId('clue_matrices'),
          chronicle_id: Number(body.chronicle_id || body.campaign_id) || defChronId,
          episode_id: body.episode_id ? Number(body.episode_id) : null,
          title: body.title || 'New Matrix',
          notes: body.notes || '',
          created_at: new Date().toISOString(),
        };
        db.clue_matrices.push(m);
        persistDb({ table: 'clue_matrices', row: m });
        return jsonResponse({ success: true, id: m.id });
      }
    }

    const matDelMatch = path.match(/^\/api\/matrices\/(\d+)$/);
    if (matDelMatch && method === 'DELETE') {
      const mId = Number(matDelMatch[1]);
      db.clue_matrices = (db.clue_matrices || []).filter((m) => Number(m.id) !== mId);
      recordDelete('clue_matrices', mId);
      persistDb({ table: 'clue_matrices', deleteId: mId });
      return jsonResponse({ success: true });
    }

    if (path === '/api/clues' && method === 'POST') {
      const clue = {
        id: nextId('clues'),
        matrix_id: Number(body.matrix_id) || 1,
        title: body.title || 'New Clue',
        description: body.description || '',
        emotional_depth: body.emotional_depth || '',
        delivery_method: body.delivery_method || 'Found item',
        location_hint: body.location_hint || 'Floating',
        discovered: 0,
        discovered_at: null,
        created_at: new Date().toISOString(),
      };
      db.clues.push(clue);
      persistDb({ table: 'clues', row: clue });
      return jsonResponse({ success: true, id: clue.id });
    }

    const clueItemMatch = path.match(/^\/api\/clues\/(\d+)$/);
    if (clueItemMatch) {
      const clueId = Number(clueItemMatch[1]);
      if (method === 'PUT') {
        const clue = (db.clues || []).find((c) => Number(c.id) === clueId);
        if (clue) {
          if (body.title !== undefined) clue.title = body.title;
          if (body.description !== undefined) clue.description = body.description;
          if (body.emotional_depth !== undefined) clue.emotional_depth = body.emotional_depth;
          if (body.delivery_method !== undefined) clue.delivery_method = body.delivery_method;
          if (body.location_hint !== undefined) clue.location_hint = body.location_hint;
          persistDb({ table: 'clues', row: clue });
        }
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.clues = (db.clues || []).filter((c) => Number(c.id) !== clueId);
        recordDelete('clues', clueId);
        persistDb({ table: 'clues', deleteId: clueId });
        return jsonResponse({ success: true });
      }
    }

    const clueToggleMatch = path.match(/^\/api\/clues\/(\d+)\/toggle$/);
    if (clueToggleMatch && method === 'POST') {
      const clueId = Number(clueToggleMatch[1]);
      const clue = (db.clues || []).find((c) => Number(c.id) === clueId);
      if (!clue) return jsonResponse({ error: 'Clue not found' }, 404);
      clue.discovered = clue.discovered ? 0 : 1;
      clue.discovered_at = clue.discovered ? new Date().toISOString() : null;
      const mat = (db.clue_matrices || []).find((m) => Number(m.id) === Number(clue.matrix_id));
      const enriched = { ...clue, matrix_title: mat?.title || '', chronicle_id: mat?.chronicle_id || defChronId };
      persistDb();
      emitToLocalSockets('gameboard:clue_update', {
        chronicle_id: enriched.chronicle_id,
        campaign_id: enriched.chronicle_id,
      });
      if (clue.discovered) {
        emitToLocalSockets('gameboard:clue_revealed', enriched);
        publishRealtimeEvent('gameboard:clue_revealed', enriched, { table: 'clues', row: clue });
      } else {
        emitToLocalSockets('gameboard:clue_hidden', { id: clueId });
        publishRealtimeEvent('gameboard:clue_hidden', { id: clueId }, { table: 'clues', row: clue });
      }
      return jsonResponse({ success: true, clue: enriched, discovered: clue.discovered });
    }

    // 9. Lore Matrices & Entries
    if (path === '/api/lore_matrices') {
      if (method === 'GET') {
        const cId = Number(q.get('chronicle_id') || q.get('campaign_id')) || defChronId;
        const rows = (db.lore_matrices || [])
          .filter((lm) => Number(lm.chronicle_id) === cId)
          .map((lm) => ({
            ...lm,
            entries: (db.lore_entries || []).filter((le) => Number(le.matrix_id) === Number(lm.id)),
          }));
        return jsonResponse(rows);
      }
      if (method === 'POST') {
        const lm = {
          id: nextId('lore_matrices'),
          chronicle_id: Number(body.chronicle_id || body.campaign_id) || defChronId,
          episode_id: body.episode_id ? Number(body.episode_id) : null,
          title: body.title || 'New Lore Matrix',
          notes: body.notes || '',
          created_at: new Date().toISOString(),
        };
        db.lore_matrices.push(lm);
        persistDb({ table: 'lore_matrices', row: lm });
        return jsonResponse({ success: true, id: lm.id });
      }
    }

    const loreMatDelMatch = path.match(/^\/api\/lore_matrices\/(\d+)$/);
    if (loreMatDelMatch && method === 'DELETE') {
      const lmId = Number(loreMatDelMatch[1]);
      db.lore_matrices = (db.lore_matrices || []).filter((m) => Number(m.id) !== lmId);
      recordDelete('lore_matrices', lmId);
      persistDb({ table: 'lore_matrices', deleteId: lmId });
      return jsonResponse({ success: true });
    }

    if (path === '/api/lore_entries' && method === 'POST') {
      const entry = {
        id: nextId('lore_entries'),
        matrix_id: Number(body.matrix_id) || 1,
        title: body.title || 'New Lore',
        category: body.category || 'Local History',
        revelation_vector: body.revelation_vector || '',
        content: body.content || '',
        discovered: 0,
        discovered_at: null,
        created_at: new Date().toISOString(),
      };
      db.lore_entries.push(entry);
      persistDb({ table: 'lore_entries', row: entry });
      return jsonResponse({ success: true, id: entry.id });
    }

    const loreEntryItemMatch = path.match(/^\/api\/lore_entries\/(\d+)$/);
    if (loreEntryItemMatch) {
      const leId = Number(loreEntryItemMatch[1]);
      if (method === 'PUT') {
        const le = (db.lore_entries || []).find((x) => Number(x.id) === leId);
        if (le) {
          if (body.title !== undefined) le.title = body.title;
          if (body.revelation_vector !== undefined) le.revelation_vector = body.revelation_vector;
          if (body.content !== undefined) le.content = body.content;
          persistDb({ table: 'lore_entries', row: le });
        }
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.lore_entries = (db.lore_entries || []).filter((x) => Number(x.id) !== leId);
        recordDelete('lore_entries', leId);
        persistDb({ table: 'lore_entries', deleteId: leId });
        return jsonResponse({ success: true });
      }
    }

    const loreToggleMatch = path.match(/^\/api\/lore(?:_entries)?\/(\d+)\/toggle$/);
    if (loreToggleMatch && method === 'POST') {
      const loreId = Number(loreToggleMatch[1]);
      const le = (db.lore_entries || []).find((x) => Number(x.id) === loreId);
      if (!le) return jsonResponse({ error: 'Lore not found' }, 404);
      le.discovered = le.discovered ? 0 : 1;
      le.discovered_at = le.discovered ? new Date().toISOString() : null;
      const lm = (db.lore_matrices || []).find((m) => Number(m.id) === Number(le.matrix_id));
      const enriched = { ...le, matrix_title: lm?.title || '', chronicle_id: lm?.chronicle_id || defChronId };
      persistDb();
      if (le.discovered) {
        emitToLocalSockets('gameboard:lore_revealed', enriched);
        publishRealtimeEvent('gameboard:lore_revealed', enriched, { table: 'lore_entries', row: le });
      } else {
        emitToLocalSockets('gameboard:lore_hidden', { id: loreId });
        publishRealtimeEvent('gameboard:lore_hidden', { id: loreId }, { table: 'lore_entries', row: le });
      }
      return jsonResponse({ success: true, lore: enriched, discovered: le.discovered });
    }

    // 10. Characters, Sheets, Vitals, Categories, Controllers, NPC Fields
    const chronCharsMatch = path.match(/^\/api\/chronicles\/(\d+)\/characters$/);
    if (chronCharsMatch && method === 'GET') {
      const cId = Number(chronCharsMatch[1]);
      const list = (db.characters || [])
        .filter((c) => Number(c.chronicle_id) === cId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(formatCharacterForApi);
      return jsonResponse(list);
    }

    if (path === '/api/characters' && method === 'GET') {
      const cId = Number(q.get('chronicle_id') || q.get('campaign_id')) || defChronId;
      const cat = q.get('category');
      const list = (db.characters || [])
        .filter((c) => Number(c.chronicle_id) === cId && (!cat || c.category === cat))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(formatCharacterForApi);
      return jsonResponse(list);
    }

    if (path === '/api/characters' && method === 'POST') {
      const cId = Number(body.chronicle_id || body.campaign_id) || defChronId;
      const newChar = {
        id: nextId('characters'),
        chronicle_id: cId,
        user_id: body.user_id || user.id,
        name: body.name || 'New Kindred',
        short_name: body.short_name || null,
        player_name: body.player_name || user.displayName || user.username,
        category: body.category || 'pc',
        clan: body.clan || 'Caitiff',
        concept: body.concept || 'Fledgling',
        avatar_url: stripBasePathFromUrl(body.avatar_url || '/sheets/bg_page_1.png'),
        vault_url: null,
        hunger: 1,
        health_superficial: 0,
        health_aggravated: 0,
        willpower_superficial: 0,
        willpower_aggravated: 0,
        humanity: 7,
        authorized_user_ids: '[]',
        concealed_fields: '[]',
        hidden_from_user_ids: '[]',
        sheet_data: typeof body.sheet_data === 'object' ? JSON.stringify(body.sheet_data) : body.sheet_data || '{}',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.characters.push(newChar);
      persistDb();
      emitToLocalSockets('character:updated', { id: newChar.id });
      publishRealtimeEvent('character:updated', { id: newChar.id }, { table: 'characters', row: newChar });
      return jsonResponse({ success: true, id: newChar.id });
    }

    const charControllersMatch = path.match(/^\/api\/characters\/(\d+)\/manage-controllers$/);
    if (charControllersMatch && method === 'POST') {
      const charId = Number(charControllersMatch[1]);
      const char = (db.characters || []).find((c) => Number(c.id) === charId);
      if (!char) return jsonResponse({ error: 'Character not found' }, 404);
      if (body.primary_user_id !== undefined) char.user_id = Number(body.primary_user_id);
      if (body.player_name !== undefined) char.player_name = body.player_name;
      if (body.authorized_user_ids !== undefined) {
        char.authorized_user_ids = Array.isArray(body.authorized_user_ids)
          ? JSON.stringify(body.authorized_user_ids)
          : body.authorized_user_ids;
      }
      persistDb({ table: 'characters', row: char });
      emitToLocalSockets('vtm:sheet_updated', {
        characterId: charId,
        user_id: char.user_id,
        authorized_user_ids: safeParseJsonArray(char.authorized_user_ids),
        player_name: char.player_name,
      });
      return jsonResponse({ success: true, message: 'Character controllers updated successfully.' });
    }

    const charNpcFieldsMatch = path.match(/^\/api\/characters\/(\d+)\/npc-fields$/);
    if (charNpcFieldsMatch && method === 'PUT') {
      const charId = Number(charNpcFieldsMatch[1]);
      const char = (db.characters || []).find((c) => Number(c.id) === charId);
      if (!char) return jsonResponse({ error: 'Character not found' }, 404);
      const allowedFields = [
        'npc_mask_truth',
        'npc_current_want',
        'npc_taboos',
        'npc_mannerisms',
        'npc_biases',
        'npc_hidden_secret',
        'npc_active_memories',
        'npc_faction_timeline',
      ];
      if (body.field && allowedFields.includes(body.field)) {
        char[body.field] = body.value || '';
        char.updated_at = new Date().toISOString();
        persistDb({ table: 'characters', row: char });
      }
      return jsonResponse({ success: true, field: body.field, value: body.value });
    }

    const charAvatarMatch = path.match(/^\/api\/characters\/(\d+)\/avatar$/);
    if (charAvatarMatch && method === 'POST') {
      const charId = Number(charAvatarMatch[1]);
      const char = (db.characters || []).find((c) => Number(c.id) === charId);
      if (!char) return jsonResponse({ error: 'Character not found' }, 404);
      if (body.avatar_url) char.avatar_url = stripBasePathFromUrl(body.avatar_url);
      if (body.vault_url) char.vault_url = stripBasePathFromUrl(body.vault_url);
      persistDb({ table: 'characters', row: char });
      return jsonResponse({ success: true, avatar_url: char.avatar_url });
    }

    const charVitalsMatch = path.match(/^\/api\/characters\/(\d+)\/vitals$/);
    if (charVitalsMatch && method === 'POST') {
      const charId = Number(charVitalsMatch[1]);
      const char = (db.characters || []).find((c) => Number(c.id) === charId);
      if (!char) return jsonResponse({ error: 'Character not found' }, 404);
      let sheet = {};
      try {
        sheet = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : char.sheet_data || {};
      } catch (e) {}

      const { hunger, humanity, tracker, states, capacity, type, delta } = body;
      if (tracker && Array.isArray(states)) {
        sheet[tracker + '_states'] = states;
        if (tracker === 'health') {
          char.health_aggravated = states.filter((s) => s === 'aggravated').length;
          char.health_superficial = states.filter((s) => s === 'superficial').length;
        } else if (tracker === 'willpower') {
          char.willpower_aggravated = states.filter((s) => s === 'aggravated').length;
          char.willpower_superficial = states.filter((s) => s === 'superficial').length;
        } else if (tracker === 'humanity') {
          char.humanity = states.filter((s) => s === 'filled').length;
          sheet.stains = states.filter((s) => s === 'superficial').length;
        }
      } else if (tracker && capacity !== undefined) {
        sheet[tracker + '_max'] = capacity;
        const st = sheet[tracker + '_states'] || Array(10).fill('empty');
        for (let i = 0; i < 10; i++) {
          if (i >= capacity) st[i] = 'filled';
          else if (st[i] === 'filled') st[i] = 'empty';
        }
        sheet[tracker + '_states'] = st;
      } else if (type && delta !== undefined) {
        let curHum = Number(char.humanity ?? 7);
        let curStains = Number(sheet.stains || 0);
        let curHunger = Number(char.hunger || 0);
        if (type === 'humanity') {
          curHum = Math.max(0, Math.min(10, curHum + Number(delta)));
          char.humanity = curHum;
          const st = sheet.humanity_states || Array(10).fill('empty');
          for (let i = 0; i < 10; i++) {
            if (i < curHum) st[i] = 'filled';
            else if (st[i] === 'filled') st[i] = 'empty';
          }
          sheet.humanity_states = st;
          sheet.humanity = st;
        } else if (type === 'stain') {
          curStains = Math.max(0, Math.min(10, curStains + Number(delta)));
          sheet.stains = curStains;
          const st = sheet.humanity_states || Array(10).fill('empty');
          for (let i = 0; i < 10; i++) {
            if (i < curHum) st[i] = 'filled';
            else if (i >= 10 - curStains) st[i] = 'superficial';
            else st[i] = 'empty';
          }
          sheet.humanity_states = st;
          sheet.humanity = st;
        } else if (type === 'hunger') {
          curHunger = Math.max(0, Math.min(5, curHunger + Number(delta)));
          char.hunger = curHunger;
          sheet.hunger = Array(5)
            .fill('empty')
            .map((_, i) => (i < curHunger ? 'filled' : 'empty'));
        }
      } else {
        if (hunger !== undefined) char.hunger = Number(hunger);
        if (humanity !== undefined) char.humanity = Number(humanity);
      }

      char.sheet_data = JSON.stringify(sheet);
      char.updated_at = new Date().toISOString();
      persistDb();
      const formatted = { ...formatCharacterForApi(char), success: true };
      emitToLocalSockets('character:vitals_updated', {
        character_id: char.id,
        sheet_data: formatted.sheet_data,
        hunger: char.hunger,
        humanity: char.humanity,
      });
      publishRealtimeEvent(
        'character:vitals_updated',
        { character_id: char.id, sheet_data: formatted.sheet_data, hunger: char.hunger, humanity: char.humanity },
        { table: 'characters', row: char }
      );
      return jsonResponse(formatted);
    }

    const charCatMatch = path.match(/^\/api\/characters\/(\d+)\/category$/);
    if (charCatMatch && method === 'PUT') {
      const charId = Number(charCatMatch[1]);
      const char = (db.characters || []).find((c) => Number(c.id) === charId);
      if (!char) return jsonResponse({ error: 'Character not found' }, 404);
      char.category = body.category || 'Uncategorized';
      persistDb({ table: 'characters', row: char });
      return jsonResponse({ success: true, category: char.category });
    }

    const charItemMatch = path.match(/^\/api\/characters\/(\d+)$/);
    if (charItemMatch) {
      const charId = Number(charItemMatch[1]);
      const char = (db.characters || []).find((c) => Number(c.id) === charId);
      if (!char) return jsonResponse({ error: 'Character not found' }, 404);
      if (method === 'GET') {
        return jsonResponse(formatCharacterForApi(char));
      }
      if (method === 'PUT') {
        let existingSheet = {};
        try {
          existingSheet =
            typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : char.sheet_data || {};
        } catch (e) {}

        if (body.sheet_data && typeof body.sheet_data === 'object') {
          const sd = body.sheet_data;
          if (sd.name) char.name = sd.name;
          if (sd.clan) char.clan = sd.clan;
          if (sd.concept) char.concept = sd.concept;
          if (Array.isArray(sd.hunger)) {
            char.hunger = sd.hunger.filter((s) => s === 'filled').length;
          }
          if (Array.isArray(sd.humanity_states)) {
            char.humanity = sd.humanity_states.filter((s) => s === 'filled').length;
            sd.stains = sd.humanity_states.filter((s) => s === 'superficial').length;
          } else if (Array.isArray(sd.humanity)) {
            char.humanity = sd.humanity.filter((s) => s === 'filled').length;
          }
          if (Array.isArray(sd.health_states)) {
            char.health_superficial = sd.health_states.filter((s) => s === 'superficial').length;
            char.health_aggravated = sd.health_states.filter((s) => s === 'aggravated').length;
          }
          if (Array.isArray(sd.willpower_states)) {
            char.willpower_superficial = sd.willpower_states.filter((s) => s === 'superficial').length;
            char.willpower_aggravated = sd.willpower_states.filter((s) => s === 'aggravated').length;
          }
          existingSheet = { ...existingSheet, ...sd };
          char.sheet_data = JSON.stringify(existingSheet);
        }

        if (body.name !== undefined) char.name = body.name;
        if (body.short_name !== undefined) char.short_name = body.short_name;
        if (body.clan !== undefined) char.clan = body.clan;
        if (body.concept !== undefined) char.concept = body.concept;
        if (body.hunger !== undefined) char.hunger = Number(body.hunger);
        if (body.humanity !== undefined) char.humanity = Number(body.humanity);
        if (body.avatar_url !== undefined) char.avatar_url = stripBasePathFromUrl(body.avatar_url);
        if (body.vault_url !== undefined) char.vault_url = stripBasePathFromUrl(body.vault_url);
        if (body.authorized_user_ids !== undefined) {
          char.authorized_user_ids = Array.isArray(body.authorized_user_ids)
            ? JSON.stringify(body.authorized_user_ids)
            : body.authorized_user_ids;
        }
        if (body.concealed_fields !== undefined) {
          char.concealed_fields = Array.isArray(body.concealed_fields)
            ? JSON.stringify(body.concealed_fields)
            : body.concealed_fields;
        }
        if (body.hidden_from_user_ids !== undefined) {
          char.hidden_from_user_ids = Array.isArray(body.hidden_from_user_ids)
            ? JSON.stringify(body.hidden_from_user_ids)
            : body.hidden_from_user_ids;
        }
        char.updated_at = new Date().toISOString();
        persistDb();
        emitToLocalSockets('character:updated', { id: char.id });
        emitToLocalSockets('character:vitals_updated', {
          id: char.id,
          character_id: char.id,
          hunger: char.hunger,
          health_superficial: char.health_superficial,
          health_aggravated: char.health_aggravated,
          willpower_superficial: char.willpower_superficial,
          willpower_aggravated: char.willpower_aggravated,
          humanity: char.humanity,
          sheet_data: existingSheet,
        });
        publishRealtimeEvent('character:updated', { id: char.id }, { table: 'characters', row: char });
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.characters = (db.characters || []).filter((c) => Number(c.id) !== charId);
        recordDelete('characters', charId);
        persistDb({ table: 'characters', deleteId: charId });
        emitToLocalSockets('character:updated', { id: charId, deleted: true });
        return jsonResponse({ success: true });
      }
    }

    // 11. NPC Categories
    if (path === '/api/npc-categories/reorder' && method === 'PUT') {
      if (Array.isArray(body.updates)) {
        for (const item of body.updates) {
          const cat = (db.npc_categories || []).find((c) => Number(c.id) === Number(item.id));
          if (cat) cat.sort_order = Number(item.sort_order) || 0;
        }
        persistDb();
      }
      return jsonResponse({ success: true });
    }

    const npcCatChronMatch = path.match(/^\/api\/chronicles\/(\d+)\/npc-categories$/);
    if (npcCatChronMatch) {
      const cId = Number(npcCatChronMatch[1]);
      if (method === 'GET') {
        const cats = (db.npc_categories || [])
          .filter((c) => Number(c.chronicle_id) === cId)
          .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(a.id) - Number(b.id));
        return jsonResponse(cats);
      }
      if (method === 'POST') {
        const cat = {
          id: nextId('npc_categories'),
          chronicle_id: cId,
          name: body.name || 'New Category',
          description: body.description || 'Character Vault Roster',
          sort_order: 0,
          created_at: new Date().toISOString(),
        };
        db.npc_categories.push(cat);
        persistDb({ table: 'npc_categories', row: cat });
        return jsonResponse({ success: true, ...cat });
      }
    }

    const npcCatItemMatch = path.match(/^\/api\/npc-categories\/(\d+)$/);
    if (npcCatItemMatch) {
      const catId = Number(npcCatItemMatch[1]);
      const cat = (db.npc_categories || []).find((c) => Number(c.id) === catId);
      if (!cat) return jsonResponse({ error: 'Not found' }, 404);
      if (method === 'PUT') {
        const oldName = cat.name;
        cat.name = body.name || cat.name;
        cat.description = body.description ?? cat.description;
        for (const ch of db.characters || []) {
          if (Number(ch.chronicle_id) === Number(cat.chronicle_id) && ch.category === oldName) {
            ch.category = cat.name;
          }
        }
        persistDb({ table: 'npc_categories', row: cat });
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        for (const ch of db.characters || []) {
          if (Number(ch.chronicle_id) === Number(cat.chronicle_id) && ch.category === cat.name) {
            ch.category = 'Uncategorized';
          }
        }
        db.npc_categories = (db.npc_categories || []).filter((c) => Number(c.id) !== catId);
        recordDelete('npc_categories', catId);
        persistDb({ table: 'npc_categories', deleteId: catId });
        return jsonResponse({ success: true });
      }
    }

    // 12. Rules Codex (Hierarchical Tree + PDF Upload + Reorder)
    if (path === '/api/rules/categories' && method === 'GET') {
      const cats = Array.from(
        new Set((db.rules_codex || []).map((r) => r.category).filter(Boolean))
      ).sort();
      return jsonResponse(cats);
    }

    if (path === '/api/rules/search' && method === 'GET') {
      const query = (q.get('q') || '').toLowerCase();
      const cat = q.get('category') || '';
      const chronId = q.get('chronicle_id') ? Number(q.get('chronicle_id')) : null;
      const results = (db.rules_codex || [])
        .filter((r) => {
          if (chronId && r.chronicle_id !== null && r.chronicle_id !== undefined && Number(r.chronicle_id) !== chronId) {
            return false;
          }
          if (cat && r.category !== cat) return false;
          if (!query) return true;
          return (
            (r.title || '').toLowerCase().includes(query) ||
            (r.summary || '').toLowerCase().includes(query) ||
            (r.content || '').toLowerCase().includes(query) ||
            (r.tags || '').toLowerCase().includes(query)
          );
        })
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || (a.title || '').localeCompare(b.title || ''));
      return jsonResponse(results);
    }

    if (path === '/api/rules/reorder' && method === 'PUT') {
      if (Array.isArray(body.updates)) {
        for (const item of body.updates) {
          const rule = (db.rules_codex || []).find((r) => Number(r.id) === Number(item.id));
          if (rule) {
            rule.parent_id = item.parent_id ? Number(item.parent_id) : null;
            rule.sort_order = Number(item.sort_order) || 0;
          }
        }
        persistDb();
        emitToLocalSockets('rules:updated', { reordered: true });
      }
      return jsonResponse({ success: true });
    }

    if (path === '/api/rules/upload_pdf' && method === 'POST') {
      let pdfUrl = body.pdf_url || '';
      const pdfBlob = body.pdf || body.file;
      if (pdfBlob && typeof Blob !== 'undefined' && pdfBlob instanceof Blob) {
        pdfUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(pdfBlob);
        });
      }
      return jsonResponse({ success: true, pdf_url: pdfUrl });
    }

    if (path === '/api/rules' && method === 'POST') {
      const rule = {
        id: nextId('rules_codex'),
        parent_id: body.parent_id ? Number(body.parent_id) : null,
        chronicle_id: body.chronicle_id ? Number(body.chronicle_id) : null,
        title: body.title || 'Untitled Rule',
        category: body.category || 'Core Rules',
        summary: body.summary || '',
        content: body.content || '',
        pdf_url: body.pdf_url ? stripBasePathFromUrl(body.pdf_url) : null,
        tags: body.tags || '',
        sort_order: Number(body.sort_order) || 0,
      };
      db.rules_codex.push(rule);
      persistDb({ table: 'rules_codex', row: rule });
      emitToLocalSockets('rules:updated', { id: rule.id, title: rule.title });
      return jsonResponse({ success: true, id: rule.id });
    }

    const ruleItemMatch = path.match(/^\/api\/rules\/(\d+)$/);
    if (ruleItemMatch) {
      const rId = Number(ruleItemMatch[1]);
      if (method === 'PUT') {
        const rule = (db.rules_codex || []).find((r) => Number(r.id) === rId);
        if (rule) {
          Object.assign(rule, {
            parent_id: body.parent_id !== undefined ? (body.parent_id ? Number(body.parent_id) : null) : rule.parent_id,
            chronicle_id:
              body.chronicle_id !== undefined ? (body.chronicle_id ? Number(body.chronicle_id) : null) : rule.chronicle_id,
            title: body.title ?? rule.title,
            category: body.category ?? rule.category,
            summary: body.summary ?? rule.summary,
            content: body.content ?? rule.content,
            pdf_url: body.pdf_url !== undefined ? stripBasePathFromUrl(body.pdf_url) : rule.pdf_url,
            tags: body.tags ?? rule.tags,
            sort_order: body.sort_order !== undefined ? Number(body.sort_order) : rule.sort_order,
          });
          persistDb({ table: 'rules_codex', row: rule });
          emitToLocalSockets('rules:updated', { id: rule.id, title: rule.title });
        }
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.rules_codex = (db.rules_codex || []).filter((r) => Number(r.id) !== rId);
        recordDelete('rules_codex', rId);
        persistDb({ table: 'rules_codex', deleteId: rId });
        emitToLocalSockets('rules:updated', { id: rId, deleted: true });
        return jsonResponse({ success: true });
      }
    }

    // 13. Dice Rolls Ledger
    if (path === '/api/rolls' && method === 'GET') {
      const cId = Number(q.get('chronicle_id')) || defChronId;
      const rolls = (db.dice_rolls || [])
        .filter((r) => Number(r.chronicle_id) === cId)
        .sort((a, b) => new Date(b.created_at || b.timestamp || 0) - new Date(a.created_at || a.timestamp || 0))
        .slice(0, 50);
      return jsonResponse(rolls);
    }

    // 14. Assets, Default Assets, TinyMCE Gallery, Uploads, Asset Categories, Clan Symbols
    if (path === '/api/upload' && method === 'POST') {
      return jsonResponse({ success: true, url: body.data });
    }

    if (path === '/api/tinymce-gallery' && method === 'GET') {
      const uploadedList = (db.uploaded_files || []).map((f) => ({
        title: f.filename,
        value: f.url,
      }));
      const assetList = (db.chronicle_assets || []).map((a) => ({
        title: a.filename,
        value: a.url,
      }));
      const seen = new Set();
      const merged = [];
      for (const item of [...assetList, ...uploadedList]) {
        if (item.value && !seen.has(item.value)) {
          seen.add(item.value);
          merged.push(item);
        }
      }
      return jsonResponse(merged);
    }

    if (path === '/api/assets' && method === 'GET') {
      const cId = Number(q.get('chronicleId') || q.get('chronicle_id')) || defChronId;
      const rows = (db.chronicle_assets || [])
        .filter((a) => Number(a.chronicle_id) === cId)
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      const defaultAssets = db.default_assets || [];
      return jsonResponse({ success: true, assets: [...defaultAssets, ...rows] });
    }

    if (path === '/api/assets/upload' && method === 'POST') {
      const cId = Number(body.chronicleId || body.chronicle_id) || defChronId;
      let dataUrl = body.data || '';
      let fname = body.filename || 'upload.png';
      if (body.file && typeof Blob !== 'undefined' && body.file instanceof Blob) {
        fname = body.file.name || fname;
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(body.file);
        });
      }

      const entityType = body.entityType;
      const entityId = body.entityId;
      if (entityType && entityId) {
        if (entityType === 'user_profile') {
          const u = (db.users || []).find((x) => Number(x.id) === Number(entityId));
          if (u) u.avatar_url = dataUrl;
        } else if (entityType === 'character_avatar') {
          const ch = (db.characters || []).find((x) => Number(x.id) === Number(entityId));
          if (ch) ch.avatar_url = dataUrl;
        } else if (entityType === 'character_vault') {
          const ch = (db.characters || []).find((x) => Number(x.id) === Number(entityId));
          if (ch) ch.vault_url = dataUrl;
        } else if (entityType === 'clan_symbol') {
          const existingSym = (db.clan_symbols || []).find(
            (s) => Number(s.chronicle_id) === cId && s.clan_name === entityId
          );
          if (existingSym) existingSym.symbol_url = dataUrl;
          else {
            db.clan_symbols.push({
              id: nextId('clan_symbols'),
              chronicle_id: cId,
              clan_name: entityId,
              symbol_url: dataUrl,
            });
          }
        }
      }

      const skipGallery = body.skipGallery === 'true' || body.skipGallery === true;
      const asset = {
        id: skipGallery ? 'temp_' + Date.now() : nextId('chronicle_assets'),
        chronicle_id: cId,
        user_id: user.id,
        filename: fname,
        url: dataUrl,
        category: body.category || 'Uncategorized',
        created_at: new Date().toISOString(),
      };
      if (!skipGallery) {
        db.chronicle_assets.push(asset);
      }
      persistDb();
      return jsonResponse({ success: true, asset });
    }

    const assetItemMatch = path.match(/^\/api\/assets\/(\d+)$/);
    if (assetItemMatch) {
      const aId = Number(assetItemMatch[1]);
      if (method === 'PUT') {
        const asset = (db.chronicle_assets || []).find((a) => Number(a.id) === aId);
        if (asset) {
          if (body.category !== undefined) asset.category = body.category;
          if (body.filename !== undefined) asset.filename = body.filename;
          persistDb({ table: 'chronicle_assets', row: asset });
        }
        return jsonResponse({ success: true });
      }
      if (method === 'DELETE') {
        db.chronicle_assets = (db.chronicle_assets || []).filter((a) => Number(a.id) !== aId);
        recordDelete('chronicle_assets', aId);
        persistDb({ table: 'chronicle_assets', deleteId: aId });
        return jsonResponse({ success: true });
      }
    }

    if (path === '/api/asset-categories/reorder' && method === 'PUT') {
      if (Array.isArray(body.updates)) {
        for (const item of body.updates) {
          const cat = (db.asset_categories || []).find((c) => Number(c.id) === Number(item.id));
          if (cat) {
            cat.parent_id = item.parent_id ? Number(item.parent_id) : null;
            cat.sort_order = Number(item.sort_order) || 0;
          }
        }
        persistDb();
      }
      return jsonResponse({ success: true });
    }

    const assetCatItemMatch = path.match(/^\/api\/asset-categories\/(\d+)$/);
    if (assetCatItemMatch) {
      const catId = Number(assetCatItemMatch[1]);
      const cat = (db.asset_categories || []).find((c) => Number(c.id) === catId);
      if (!cat) return jsonResponse({ error: 'Category not found' }, 404);
      if (method === 'PUT') {
        const oldName = cat.name;
        if (body.name) cat.name = body.name.trim();
        for (const a of db.chronicle_assets || []) {
          if (Number(a.chronicle_id) === Number(cat.chronicle_id) && a.category === oldName) {
            a.category = cat.name;
          }
        }
        persistDb({ table: 'asset_categories', row: cat });
        return jsonResponse({ success: true, name: cat.name });
      }
      if (method === 'DELETE') {
        for (const a of db.chronicle_assets || []) {
          if (Number(a.chronicle_id) === Number(cat.chronicle_id) && a.category === cat.name) {
            a.category = 'Uncategorized';
          }
        }
        db.asset_categories = (db.asset_categories || []).filter((c) => Number(c.id) !== catId);
        recordDelete('asset_categories', catId);
        persistDb({ table: 'asset_categories', deleteId: catId });
        return jsonResponse({ success: true });
      }
    }

    if (path === '/api/asset-categories') {
      if (method === 'GET') {
        const cId = Number(q.get('chronicleId') || q.get('chronicle_id')) || defChronId;
        const cats = (db.asset_categories || [])
          .filter((c) => Number(c.chronicle_id) === cId)
          .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || (a.name || '').localeCompare(b.name || ''));
        const defaultCats = db.default_asset_categories || [];
        return jsonResponse({ success: true, categories: [...defaultCats, ...cats] });
      }
      if (method === 'POST') {
        const cId = Number(body.chronicleId || body.chronicle_id) || defChronId;
        const name = (body.name || '').trim();
        let cat = (db.asset_categories || []).find((c) => Number(c.chronicle_id) === cId && c.name === name);
        if (name && !cat) {
          cat = {
            id: nextId('asset_categories'),
            chronicle_id: cId,
            name,
            parent_id: body.parent_id ? Number(body.parent_id) : null,
            sort_order: 0,
          };
          db.asset_categories.push(cat);
          persistDb({ table: 'asset_categories', row: cat });
        }
        return jsonResponse({ success: true, id: cat ? cat.id : null, name, parent_id: cat ? cat.parent_id : null });
      }
    }

    if (path === '/api/clan-symbols') {
      if (method === 'GET') {
        const cId = Number(q.get('chronicleId') || q.get('chronicle_id')) || defChronId;
        const rows = (db.clan_symbols || []).filter((s) => Number(s.chronicle_id) === cId);
        return jsonResponse(rows);
      }
      if (method === 'POST') {
        const cId = Number(body.chronicleId || body.chronicle_id) || defChronId;
        const existing = (db.clan_symbols || []).find(
          (s) => Number(s.chronicle_id) === cId && s.clan_name === body.clan_name
        );
        if (existing) {
          existing.symbol_url = stripBasePathFromUrl(body.symbol_url);
          persistDb({ table: 'clan_symbols', row: existing });
        } else {
          const row = {
            id: nextId('clan_symbols'),
            chronicle_id: cId,
            clan_name: body.clan_name,
            symbol_url: stripBasePathFromUrl(body.symbol_url),
          };
          db.clan_symbols.push(row);
          persistDb({ table: 'clan_symbols', row: row });
        }
        return jsonResponse({ success: true, clan_name: body.clan_name, symbol_url: body.symbol_url });
      }
    }

    const clanSymDelMatch = path.match(/^\/api\/clan-symbols\/(\d+)$/);
    if (clanSymDelMatch && method === 'DELETE') {
      const sId = Number(clanSymDelMatch[1]);
      db.clan_symbols = (db.clan_symbols || []).filter((s) => Number(s.id) !== sId);
      recordDelete('clan_symbols', sId);
      persistDb({ table: 'clan_symbols', deleteId: sId });
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: true });
  }

  // Intercept window.fetch for /api/* requests and root-relative asset requests on GitHub Pages
  window.fetch = async function (input, init = {}) {
    const rawUrl = typeof input === 'string' ? input : input && input.url ? input.url : String(input);
    const urlObj = new URL(rawUrl, window.location.origin);
    let checkPath = urlObj.pathname;
    if (BASE_PATH && checkPath.startsWith(BASE_PATH + '/')) {
      checkPath = checkPath.substring(BASE_PATH.length);
    }

    if (checkPath.startsWith('/api/')) {
      const serverless = await checkBackendMode();
      if (serverless) {
        const method = (init.method || (typeof input === 'object' && input.method) || 'GET').toUpperCase();
        const headers = init.headers || (typeof input === 'object' && input.headers) || {};
        const body = init.body !== undefined ? init.body : undefined;
        return handleApiRequest(urlObj, method, headers, body);
      }
    }

    if (BASE_PATH && typeof input === 'string' && input.startsWith('/') && !input.startsWith(BASE_PATH + '/')) {
      return nativeFetch(prefixAssetUrl(input), init);
    }
    return nativeFetch(input, init);
  };

  // ---------------- SUBPATH DOM ASSET FIXER & CLOUD SYNC UI ----------------
  if (BASE_PATH) {
    try {
      const origSetAttr = Element.prototype.setAttribute;
      Element.prototype.setAttribute = function (name, value) {
        if ((name === 'src' || name === 'href') && typeof value === 'string' && value.startsWith('/')) {
          value = prefixAssetUrl(value);
        }
        return origSetAttr.call(this, name, value);
      };

      const htmlDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
      if (htmlDesc && typeof htmlDesc.set === 'function') {
        Object.defineProperty(Element.prototype, 'innerHTML', {
          ...htmlDesc,
          set(val) {
            if (typeof val === 'string') {
              val = val
                .replace(
                  /((?:src|href)=["'])\/(images|uploads|default_assets|sheets|css|js|pdfjs|webfonts)\//g,
                  `$1${BASE_PATH}/$2/`
                )
                .replace(
                  /(url\(["']?)\/(images|uploads|default_assets|sheets|css|js|pdfjs|webfonts)\//g,
                  `$1${BASE_PATH}/$2/`
                );
            }
            return htmlDesc.set.call(this, val);
          },
        });
      }

      for (const Proto of [
        typeof HTMLImageElement !== 'undefined' ? HTMLImageElement.prototype : null,
        typeof HTMLIFrameElement !== 'undefined' ? HTMLIFrameElement.prototype : null,
      ]) {
        if (!Proto) continue;
        const desc = Object.getOwnPropertyDescriptor(Proto, 'src');
        if (desc && typeof desc.set === 'function') {
          Object.defineProperty(Proto, 'src', {
            ...desc,
            set(val) {
              const fixed = typeof val === 'string' && val.startsWith('/') ? prefixAssetUrl(val) : val;
              return desc.set.call(this, fixed);
            },
          });
        }
      }
    } catch (e) {}
  }

  function fixSubpathDomAssets(root = document) {
    if (!BASE_PATH) return;
    const els = root.querySelectorAll ? root.querySelectorAll('img[src^="/"], iframe[src^="/"], option[value^="/"]') : [];
    els.forEach((el) => {
      if (el.hasAttribute('src')) {
        const v = el.getAttribute('src');
        const fixed = prefixAssetUrl(v);
        if (fixed !== v) el.setAttribute('src', fixed);
      }
      if (el.tagName === 'OPTION' && el.hasAttribute('value')) {
        const v = el.getAttribute('value');
        const fixed = prefixAssetUrl(v);
        if (fixed !== v) el.setAttribute('value', fixed);
      }
    });
  }

  function updateCloudBadgeStatus(label) {
    const el = document.getElementById('vtmCloudBadgeText');
    if (el) el.textContent = label;
  }

  function injectCloudSyncControls() {
    if (window.location.pathname.includes('/sheets/')) return;
    if (document.getElementById('vtmCloudSyncPill')) return;

    const rightBar = document.querySelector('.elysium-bar-right');
    if (rightBar) {
      const pill = document.createElement('button');
      pill.id = 'vtmCloudSyncPill';
      pill.className = 'btn-action-outline btn-sm';
      pill.style.cssText =
        'margin-right: 10px; display: inline-flex; align-items: center; gap: 6px; border-color: rgba(239,68,68,0.45); font-size: 11px; padding: 4px 10px;';
      pill.title = 'Cloud Sync, Account Switcher & Backup Manager';
      pill.innerHTML = `<i class="fa-solid fa-cloud" style="color:#ef4444;"></i> <span id="vtmCloudBadgeText">CLOUD VTT</span>`;
      pill.onclick = () => openCloudSyncModal();
      rightBar.insertBefore(pill, rightBar.firstChild);
    }

    // Also add quick account switcher inside the login form for 1-click sign-in on GitHub Pages
    const authForm = document.getElementById('authForm');
    if (authForm && !document.getElementById('vtmQuickLoginBox') && db && Array.isArray(db.users)) {
      const box = document.createElement('div');
      box.id = 'vtmQuickLoginBox';
      box.style.cssText =
        'margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); text-align: left;';
      box.innerHTML = `
        <div style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 8px;">
          <i class="fa-solid fa-bolt" style="color:#ef4444;"></i> Quick Chronicle Sign-In (No Password Required on GitHub Pages)
        </div>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          ${db.users
            .map(
              (u) => `
            <button type="button" class="btn-action-outline btn-sm" style="font-size: 11px; padding: 4px 8px;" data-quick-user="${u.username}">
              <i class="fa-solid ${u.role === 'gm' || u.username === 'TohkaTakushi' ? 'fa-crown' : 'fa-user'}" style="color:${
                u.role === 'gm' || u.username === 'TohkaTakushi' ? '#f59e0b' : '#ef4444'
              };"></i> ${u.display_name || u.username}
            </button>`
            )
            .join('')}
        </div>
      `;
      box.querySelectorAll('[data-quick-user]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const uname = btn.getAttribute('data-quick-user');
          const uInput = document.getElementById('authUsername');
          const pInput = document.getElementById('authPassword');
          if (uInput) uInput.value = uname;
          if (pInput) pInput.value = 'chronicle';
          authForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        });
      });
      authForm.appendChild(box);
    }
  }

  function openCloudSyncModal() {
    let modal = document.getElementById('vtmCloudSyncModal');
    if (modal) modal.remove();

    const cfg = getCloudConfig();
    const users = (db && db.users) || [];
    const currentUser = parseAuthUser();

    modal = document.createElement('div');
    modal.id = 'vtmCloudSyncModal';
    modal.className = 'modal-overlay active';
    modal.style.cssText = 'display:flex; z-index: 1000000;';
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };

    modal.innerHTML = `
      <div class="modal-container" style="max-width: 540px; width: 92%;">
        <div class="modal-header">
          <h3><i class="fa-solid fa-cloud" style="color:#ef4444;margin-right:8px;"></i> Elysium Cloud Sync & Account Switcher</h3>
          <button class="btn-close-modal" onclick="document.getElementById('vtmCloudSyncModal').remove()"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="modal-body form-body" style="display:flex; flex-direction:column; gap:14px;">
          <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:6px; padding:10px 12px; font-size:12px; color:#e2e8f0; line-height:1.5;">
            <strong>Zero-VPN Cloud Mode Active:</strong> Dice rolls, chat messages, scene transitions, clue reveals, and character sheet edits sync live across browsers via <code>ntfy.sh</code> SSE and cloud state snapshots.
          </div>

          <div class="form-col">
            <label>Switch Active Account (Current: <strong>${currentUser.displayName || currentUser.username}</strong>)</label>
            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">
              ${users
                .map(
                  (u) => `
                <button type="button" class="btn-action-outline btn-sm" data-switch-user="${u.id}" style="font-size:11px; padding:5px 10px; ${
                    Number(u.id) === Number(currentUser.id) ? 'border-color:#ef4444; background:rgba(239,68,68,0.2);' : ''
                  }">
                  <i class="fa-solid ${u.role === 'gm' || u.username === 'TohkaTakushi' ? 'fa-crown' : 'fa-user'}"></i>
                  ${u.display_name || u.username}
                </button>`
                )
                .join('')}
            </div>
          </div>

          <div class="form-col">
            <label>Live Sync Channel Topic (ntfy.sh SSE)</label>
            <div style="display:flex; gap:8px;">
              <input type="text" id="vtmCloudTopicInput" class="vtm-input" value="${cfg.topic}" style="flex:1;">
              <button type="button" class="btn-action" id="vtmSaveTopicBtn">Save Channel</button>
            </div>
          </div>

          <div class="form-col">
            <label>Cloud Snapshot Sync (Push / Pull Full Table State Across Devices)</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn-action" id="vtmPushCloudBtn"><i class="fa-solid fa-cloud-arrow-up"></i> Push Table to Cloud</button>
              <input type="text" id="vtmPullKeyInput" class="vtm-input" placeholder="Snapshot code..." value="${
                cfg.lastCloudKey || ''
              }" style="width:150px;">
              <button type="button" class="btn-action-outline" id="vtmPullCloudBtn"><i class="fa-solid fa-cloud-arrow-down"></i> Pull</button>
            </div>
          </div>

          <div class="form-col" style="border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;">
            <label>Chronicle Database Backup & Restore</label>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button type="button" class="btn-action-outline btn-sm" id="vtmExportJsonBtn"><i class="fa-solid fa-download"></i> Export Full JSON</button>
              <label class="btn-action-outline btn-sm" style="cursor:pointer; margin:0;">
                <i class="fa-solid fa-upload"></i> Import JSON
                <input type="file" id="vtmImportJsonInput" accept=".json" style="display:none;">
              </label>
              <button type="button" class="btn-action-outline btn-sm" id="vtmResetCanonicalBtn" style="border-color:#ef4444; color:#fca5a5;">
                <i class="fa-solid fa-rotate-left"></i> Reset to Linux Mint Live State
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelectorAll('[data-switch-user]').forEach((btn) => {
      btn.onclick = () => {
        const uid = Number(btn.getAttribute('data-switch-user'));
        const u = users.find((x) => Number(x.id) === uid);
        if (u) {
          const isGm =
            u.role === 'gm' ||
            u.username === 'TohkaTakushi' ||
            (db.chronicles || []).some((c) => Number(c.gm_id) === Number(u.id));
          const payload = {
            id: u.id,
            username: u.username,
            displayName: u.display_name || u.username,
            role: isGm ? 'gm' : u.role || 'player',
            bio: u.bio || null,
            avatar_url: u.avatar_url || null,
            avatar: u.avatar_url || null,
          };
          localStorage.setItem('vtm_auth_token', makeMockToken(payload));
          localStorage.setItem('vtm_user', JSON.stringify(payload));
          window.location.reload();
        }
      };
    });

    modal.querySelector('#vtmSaveTopicBtn').onclick = () => {
      const topic = modal.querySelector('#vtmCloudTopicInput').value.trim() || NTFY_DEFAULT_TOPIC;
      saveCloudConfig({ topic });
      startRealtimeListeners();
      alert('Live sync channel updated to: ' + topic);
    };

    modal.querySelector('#vtmPushCloudBtn').onclick = async () => {
      const key = await pushCloudSnapshot(true);
      if (key && modal.querySelector('#vtmPullKeyInput')) {
        modal.querySelector('#vtmPullKeyInput').value = key;
      }
    };

    modal.querySelector('#vtmPullCloudBtn').onclick = async () => {
      const key = modal.querySelector('#vtmPullKeyInput').value.trim();
      if (!key) return alert('Enter a snapshot code first.');
      await pullCloudSnapshot(key, true);
    };

    modal.querySelector('#vtmExportJsonBtn').onclick = () => {
      const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vtm-chronicle-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
    };

    modal.querySelector('#vtmImportJsonInput').onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          let imported = JSON.parse(reader.result);
          if (imported && imported.tables && typeof imported.tables === 'object') {
            imported = { ...imported, ...imported.tables };
            delete imported.tables;
          }
          if (imported && imported.characters && imported.chronicles) {
            db = imported;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
            alert('Chronicle database imported! Reloading...');
            window.location.reload();
          } else {
            alert('Invalid chronicle JSON file.');
          }
        } catch (err) {
          alert('Failed to parse JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    };

    modal.querySelector('#vtmResetCanonicalBtn').onclick = () => {
      if (confirm('Reset local browser state back to the canonical Linux Mint database dump?')) {
        localStorage.removeItem(STORAGE_KEY);
        window.location.reload();
      }
    };
  }

  // Expose adapter API
  window.__VTM_CLOUD_ADAPTER__ = {
    ensureDbLoaded,
    pushCloudSnapshot,
    pullCloudSnapshot,
    openCloudSyncModal,
    prefixAssetUrl,
  };

  // Boot sequence
  checkBackendMode().then(async (serverless) => {
    if (serverless) {
      await ensureDbLoaded();
      startRealtimeListeners();
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          fixSubpathDomAssets();
          injectCloudSyncControls();
        });
      } else {
        fixSubpathDomAssets();
        injectCloudSyncControls();
      }
      if (BASE_PATH && typeof MutationObserver !== 'undefined') {
        const obs = new MutationObserver((mutations) => {
          for (const m of mutations) {
            if (m.type === 'childList') {
              m.addedNodes.forEach((n) => {
                if (n.nodeType === 1) fixSubpathDomAssets(n);
              });
            } else if (m.type === 'attributes' && m.target && m.target.nodeType === 1) {
              const v = m.target.getAttribute('src');
              if (v && v.startsWith('/') && !v.startsWith(BASE_PATH + '/')) {
                const fixed = prefixAssetUrl(v);
                if (fixed !== v) m.target.setAttribute('src', fixed);
              }
            }
          }
        });
        const startObs = () => {
          if (document.body) {
            obs.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ['src'],
            });
          }
        };
        if (document.body) startObs();
        else document.addEventListener('DOMContentLoaded', startObs);
      }
    }
  });
})();
