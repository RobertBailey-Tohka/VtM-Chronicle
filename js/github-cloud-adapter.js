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

  const STORAGE_KEY = 'vtm_chronicle_cloud_state_v4';
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
        localStorage.removeItem('vtm_chronicle_cloud_state_v2');
        localStorage.removeItem('vtm_chronicle_cloud_state_v3');
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
      // Normalize legacy hidden_from_user_ids values ('[]' -> null, and old '[12,13]' -> all active player IDs)
      if (Array.isArray(seed.characters)) {
        const allPlayerUserIds = (seed.chronicle_members || [])
          .filter((cm) => cm.role !== 'storyteller' && cm.role !== 'gm' && Number(cm.user_id) !== 11)
          .map((cm) => Number(cm.user_id));
        for (const ch of seed.characters) {
          if (ch.hidden_from_user_ids === '[]' || (Array.isArray(ch.hidden_from_user_ids) && ch.hidden_from_user_ids.length === 0)) {
            ch.hidden_from_user_ids = null;
          } else if (
            ch.category !== 'pc' &&
            (ch.hidden_from_user_ids === '[12,13]' ||
              (Array.isArray(ch.hidden_from_user_ids) &&
                ch.hidden_from_user_ids.length === 2 &&
                ch.hidden_from_user_ids.includes(12) &&
                ch.hidden_from_user_ids.includes(13)))
          ) {
            ch.hidden_from_user_ids = JSON.stringify(allPlayerUserIds);
          }
        }
      }
      db = seed;

      // Clear any legacy auto-injected token (.vtm_cloud_sig) so visitors are not auto-logged in as Storyteller
      const existingToken = localStorage.getItem('vtm_auth_token') || '';
      if (existingToken && !existingToken.endsWith('.vtm_session_v2')) {
        localStorage.removeItem('vtm_auth_token');
        localStorage.removeItem('vtm_user');
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
    return `${b64}.vtm_session_v2`;
  }

  function extractValidAuthUser(headers) {
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
        if (!token.endsWith('.vtm_session_v2')) return null;
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
    return null;
  }

  function parseAuthUser(headers) {
    const valid = extractValidAuthUser(headers);
    if (valid) return valid;
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
  let sseReconnectTimer = null;
  let fastLivePollTimer = null;
  let currentCloudStatusLabel = 'CLOUD VTT';
  const activePresencesByUserId = new Map();
  const processedRealtimeIds = new Set();
  let localPresenceRecord = null;
  let presenceReplyTimer = null;
  let stSyncTimer = null;

  function markRealtimeIdProcessed(id) {
    if (!id) return false;
    const key = String(id);
    if (processedRealtimeIds.has(key)) return true;
    processedRealtimeIds.add(key);
    if (processedRealtimeIds.size > 600) {
      const first = processedRealtimeIds.values().next().value;
      processedRealtimeIds.delete(first);
    }
    return false;
  }

  function emitToLocalSockets(event, payload) {
    const outPayload = rewritePayloadUrlsOut(payload);
    for (const sock of virtualSockets) {
      sock._trigger(event, outPayload);
    }
  }

  function emitCombinedPresences() {
    const now = Date.now();
    for (const [uid, pres] of activePresencesByUserId.entries()) {
      if (localPresenceRecord && Number(uid) === Number(localPresenceRecord.userId)) continue;
      if (pres.lastSeen && now - pres.lastSeen > 240000) {
        activePresencesByUserId.delete(uid);
      }
    }
    if (localPresenceRecord && localPresenceRecord.userId) {
      localPresenceRecord.lastSeen = now;
      activePresencesByUserId.set(Number(localPresenceRecord.userId), localPresenceRecord);
    }
    const list = Array.from(activePresencesByUserId.values());
    if (list.length > 0) {
      emitToLocalSockets('presence:sync', list);
    }
  }

  function sendRawNtfyPacket(pkt) {
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
        return true;
      } else if (pkt && pkt.type !== 'overflow_pkt') {
        nativeFetch('https://bytebin.lucko.me/post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: bodyStr,
        })
          .then((res) => (res && res.ok ? res.json() : null))
          .then((json) => {
            if (json && json.key) {
              const overflowEnvelope = JSON.stringify({
                senderId: pkt.senderId || CLIENT_ID,
                ts: pkt.ts || Date.now(),
                type: 'overflow_pkt',
                key: json.key,
              });
              nativeFetch(`https://ntfy.sh/${encodeURIComponent(cfg.topic)}`, {
                method: 'POST',
                body: overflowEnvelope,
              }).catch(() => {});
            }
          })
          .catch(() => {});
        return true;
      }
    }
    return false;
  }

  function broadcastLocalPresence(isJoin = false, isReply = false) {
    if (!localPresenceRecord) {
      const authUser = extractValidAuthUser();
      if (authUser && authUser.id) {
        const defChronId = defaultChronicleId();
        const isGm = isChronicleGM(defChronId, authUser.id);
        const ownedPc = !isGm
          ? (db && db.characters ? db.characters : []).find(
              (c) =>
                Number(c.chronicle_id) === defChronId &&
                String(c.category || '').toLowerCase() === 'pc' &&
                Number(c.user_id) === Number(authUser.id)
            )
          : null;
        localPresenceRecord = {
          socketId: CLIENT_ID,
          userId: authUser.id,
          username: authUser.username,
          displayName: authUser.displayName || authUser.username,
          role: isGm ? 'gm' : 'player',
          avatar: authUser.avatar_url || authUser.avatar || null,
          isSpectator: !ownedPc,
          characterId: ownedPc ? ownedPc.id : null,
          characterName: ownedPc ? ownedPc.name : null,
          characterClan: ownedPc ? ownedPc.clan : null,
          avatarUrl: ownedPc ? ownedPc.avatar_url : null,
          hunger: ownedPc ? Number(ownedPc.hunger || 1) : 0,
          lastSeen: Date.now(),
        };
      }
    }
    if (!localPresenceRecord || !localPresenceRecord.userId) return;
    localPresenceRecord.lastSeen = Date.now();
    activePresencesByUserId.set(Number(localPresenceRecord.userId), localPresenceRecord);
    emitCombinedPresences();
    sendRawNtfyPacket({
      senderId: CLIENT_ID,
      ts: Date.now(),
      type: 'presence_update',
      isJoin: Boolean(isJoin),
      isReply: Boolean(isReply),
      presence: localPresenceRecord,
    });
  }

  function parseEpisodeMapsArray(mapsField) {
    let parsed = mapsField;
    while (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed || '[]');
      } catch (e) {
        parsed = [];
        break;
      }
    }
    return Array.isArray(parsed) ? parsed : [];
  }

  function enrichGameboardSceneState(gs) {
    if (!gs) return null;
    const boardCopy = { ...gs };
    if (boardCopy.active_episode_id && db && Array.isArray(db.episodes)) {
      const ep = db.episodes.find((e) => Number(e.id) === Number(boardCopy.active_episode_id));
      if (ep) {
        const camp = (db.campaigns || []).find((c) => Number(c.id) === Number(ep.campaign_id));
        boardCopy.active_episode_title = ep.title;
        boardCopy.active_episode_number = ep.episode_number;
        boardCopy.active_arc_title = camp ? camp.title : 'Main Campaign';
        boardCopy.active_episode_maps = parseEpisodeMapsArray(ep.maps);
      }
    }
    return boardCopy;
  }

  function broadcastSceneSyncPacket(gs, epRecord = null) {
    if (!gs) return;
    const enriched = enrichGameboardSceneState(gs);
    const ep =
      epRecord ||
      (enriched.active_episode_id && db && Array.isArray(db.episodes)
        ? db.episodes.find((e) => Number(e.id) === Number(enriched.active_episode_id))
        : null);
    const epMaps = ep ? parseEpisodeMapsArray(ep.maps) : enriched.active_episode_maps || [];
    sendRawNtfyPacket({
      senderId: CLIENT_ID,
      ts: Date.now(),
      type: 'scene_sync',
      chronicle_id: enriched.chronicle_id || defaultChronicleId(),
      scene: {
        id: enriched.id,
        chronicle_id: enriched.chronicle_id,
        active_episode_id: enriched.active_episode_id,
        active_episode_title: enriched.active_episode_title || (ep ? ep.title : ''),
        active_episode_number: enriched.active_episode_number || (ep ? ep.episode_number : 1),
        active_arc_title: enriched.active_arc_title || 'Main Campaign',
        active_episode_maps: epMaps,
        active_location: enriched.active_location || '',
        active_mood_text: enriched.active_mood_text || '',
        active_map_url: enriched.active_map_url || '',
        active_scene_banner: enriched.active_scene_banner || '',
        active_npc_persona: enriched.active_npc_persona || '',
        active_npc_avatar: enriched.active_npc_avatar || '',
        game_time: enriched.game_time || '',
      },
      episode: ep
        ? {
            id: ep.id,
            chronicle_id: ep.chronicle_id,
            campaign_id: ep.campaign_id,
            episode_number: ep.episode_number,
            title: ep.title,
            location: ep.location || '',
            hook: String(ep.hook || '').slice(0, 700),
            fallout_notes: String(ep.fallout_notes || '').slice(0, 700),
            concepts: String(ep.concepts || '').slice(0, 400),
            revealed: ep.revealed ? 1 : 0,
            status: ep.status || 'active',
            maps: JSON.stringify(epMaps),
          }
        : null,
    });
  }

  function broadcastStorytellerAuthoritativeState() {
    if (!db || !Array.isArray(db.characters)) return;
    const authUser = extractValidAuthUser();
    if (!authUser || !isChronicleGM(defaultChronicleId(), authUser.id)) return;
    const compactChars = db.characters.map((c) => {
      let sd = {};
      try {
        sd = typeof c.sheet_data === 'string' ? JSON.parse(c.sheet_data || '{}') : c.sheet_data || {};
      } catch (e) {}
      const rec = {
        i: c.id,
        u: c.user_id,
        x: sd.total_experience ?? sd.total ?? '0',
      };
      if (sd.spent_experience !== undefined || sd.spent !== undefined) {
        rec.s = String(sd.spent_experience ?? sd.spent ?? '0');
      }
      const h = parseNullableHiddenIds(c.hidden_from_user_ids);
      if (h && h.length > 0) rec.h = h;
      const cf = safeParseJsonArray(c.concealed_fields);
      if (cf.length > 0) rec.c = cf;
      if (sd.player_base_edit_unlocked) rec.b = 1;
      if (String(c.category || '').toLowerCase() === 'pc') {
        rec.hu = c.hunger ?? 1;
        rec.hm = c.humanity ?? 7;
        if (Array.isArray(sd.health_states)) rec.hp = sd.health_states;
        if (Array.isArray(sd.willpower_states)) rec.wp = sd.willpower_states;
        if (Array.isArray(sd.humanity_states)) rec.hs = sd.humanity_states;
        if (sd.health_max !== undefined) rec.hm_max = sd.health_max;
        if (sd.willpower_max !== undefined) rec.wp_max = sd.willpower_max;
        if (c.updated_at) rec.ut = c.updated_at;
      }
      return rec;
    });
    sendRawNtfyPacket({
      senderId: CLIENT_ID,
      ts: Date.now(),
      type: 'st_authoritative_sync',
      characters: compactChars,
    });
    const gs =
      (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === defaultChronicleId()) ||
      (db.gameboard_state || [])[0];
    if (gs) {
      broadcastSceneSyncPacket(gs);
    }
  }

  function applyIncomingPacket(pkt, isReplay = false) {
    if (!pkt) return;
    if (!isReplay && pkt.senderId === CLIENT_ID) return;
    if (pkt.pktId && markRealtimeIdProcessed(pkt.pktId)) return;

    if (pkt.type === 'overflow_pkt' && pkt.key) {
      nativeFetch(`https://bytebin.lucko.me/${encodeURIComponent(pkt.key)}`)
        .then((res) => (res && res.ok ? res.json() : null))
        .then((unpacked) => {
          if (unpacked && typeof unpacked === 'object' && unpacked.type !== 'overflow_pkt') {
            if (pkt.pktId) unpacked.pktId = `${pkt.pktId}_unpacked`;
            applyIncomingPacket(unpacked, isReplay);
          }
        })
        .catch(() => {});
      return;
    }

    if (pkt.type === 'scene_sync' && pkt.scene) {
      if (db) {
        if (pkt.episode && pkt.episode.id !== undefined) {
          db.episodes = db.episodes || [];
          const epIdx = db.episodes.findIndex((e) => Number(e.id) === Number(pkt.episode.id));
          if (epIdx >= 0) {
            db.episodes[epIdx] = { ...db.episodes[epIdx], ...pkt.episode };
          } else {
            db.episodes.push(pkt.episode);
          }
        }
        db.gameboard_state = db.gameboard_state || [];
        const targetChronId = Number(pkt.chronicle_id || pkt.scene.chronicle_id) || defaultChronicleId();
        let gs =
          db.gameboard_state.find((g) => Number(g.chronicle_id) === targetChronId) || db.gameboard_state[0];
        if (!gs) {
          gs = { id: 1, chronicle_id: targetChronId };
          db.gameboard_state.push(gs);
        }
        if (pkt.scene.active_episode_id !== undefined && pkt.scene.active_episode_id !== null)
          gs.active_episode_id = pkt.scene.active_episode_id;
        if (pkt.scene.active_location !== undefined && pkt.scene.active_location !== '')
          gs.active_location = pkt.scene.active_location;
        if (pkt.scene.active_mood_text !== undefined && pkt.scene.active_mood_text !== '')
          gs.active_mood_text = pkt.scene.active_mood_text;
        if (pkt.scene.active_scene_banner) gs.active_scene_banner = pkt.scene.active_scene_banner;
        if (pkt.scene.active_npc_persona) gs.active_npc_persona = pkt.scene.active_npc_persona;
        if (pkt.scene.active_npc_avatar) gs.active_npc_avatar = pkt.scene.active_npc_avatar;
        if (pkt.scene.game_time) gs.game_time = pkt.scene.game_time;
        if (pkt.scene.active_map_url) {
          gs.active_map_url = pkt.scene.active_map_url;
          let cs = {};
          try {
            cs = typeof gs.canvas_state === 'string' ? JSON.parse(gs.canvas_state || '{}') : gs.canvas_state || {};
          } catch (e) {}
          cs.backdrop = pkt.scene.active_map_url;
          gs.canvas_state = JSON.stringify(cs);
        }
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        } catch (e) {}
        if (!isReplay) {
          const enriched = {
            ...enrichGameboardSceneState(gs),
            ...pkt.scene,
          };
          emitToLocalSockets('gameboard:scene_updated', enriched);
          if (pkt.scene.active_map_url) {
            emitToLocalSockets('gameboard:map_updated', {
              chronicle_id: targetChronId,
              active_map_url: pkt.scene.active_map_url,
            });
          }
          if (pkt.episode) {
            emitToLocalSockets('episode:updated', pkt.episode);
          }
        }
      }
      return;
    }

    if (pkt.type === 'dice_roll' && pkt.roll) {
      const roll = pkt.roll;
      const rollDedupKey = roll.roll_uid || `roll_${roll.id}_${roll.roller_name}`;
      if (markRealtimeIdProcessed(rollDedupKey)) return;
      if (db) {
        if (!Array.isArray(db.dice_rolls)) db.dice_rolls = [];
        const existingIdx = db.dice_rolls.findIndex((r) => Number(r.id) === Number(roll.id));
        if (existingIdx >= 0) db.dice_rolls[existingIdx] = roll;
        else db.dice_rolls.push(roll);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        } catch (e) {}
      }
      if (!isReplay || Date.now() - (pkt.ts || 0) < 15000) {
        emitToLocalSockets('dice:result', roll);
      }
      return;
    }

    if (pkt.type === 'presence_update' && pkt.presence && pkt.presence.userId) {
      if (!isReplay || Date.now() - (pkt.ts || 0) < 240000) {
        activePresencesByUserId.set(Number(pkt.presence.userId), {
          ...pkt.presence,
          lastSeen: pkt.ts || Date.now(),
        });
        if (!isReplay) emitCombinedPresences();
      }
      if (!isReplay && pkt.isJoin && !pkt.isReply) {
        if (presenceReplyTimer) clearTimeout(presenceReplyTimer);
        presenceReplyTimer = setTimeout(() => {
          broadcastLocalPresence(false, true);
        }, 400);
        const authUser = extractValidAuthUser();
        if (authUser && isChronicleGM(defaultChronicleId(), authUser.id)) {
          if (stSyncTimer) clearTimeout(stSyncTimer);
          stSyncTimer = setTimeout(() => {
            broadcastStorytellerAuthoritativeState();
          }, 700);
        }
      }
      return;
    }

    if (pkt.type === 'presence_leave' && pkt.userId) {
      if (!localPresenceRecord || Number(pkt.userId) !== Number(localPresenceRecord.userId)) {
        activePresencesByUserId.delete(Number(pkt.userId));
        if (!isReplay) emitCombinedPresences();
      }
      return;
    }

    if (pkt.type === 'xp_sync' && Array.isArray(pkt.updates) && db && Array.isArray(db.characters)) {
      for (const u of pkt.updates) {
        const ch = db.characters.find((c) => Number(c.id) === Number(u.id));
        if (!ch) continue;
        let sd = {};
        try {
          sd = typeof ch.sheet_data === 'string' ? JSON.parse(ch.sheet_data || '{}') : ch.sheet_data || {};
        } catch (e) {}
        sd.total_experience = String(u.total_experience);
        sd.total = String(u.total_experience);
        if (u.spent_experience !== undefined) {
          sd.spent_experience = String(u.spent_experience);
          sd.spent = String(u.spent_experience);
        }
        if (u.xp_log_entry) {
          if (!Array.isArray(sd.xp_log)) sd.xp_log = [];
          if (!sd.xp_log.some((e) => e && e.id === u.xp_log_entry.id)) {
            sd.xp_log.unshift(u.xp_log_entry);
          }
        }
        ch.sheet_data = JSON.stringify(sd);
        ch.updated_at = new Date(pkt.ts || Date.now()).toISOString();
        if (!isReplay) {
          emitToLocalSockets('character:updated', { id: ch.id });
        }
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
      } catch (e) {}
      return;
    }

    if (pkt.type === 'st_authoritative_sync' && Array.isArray(pkt.characters) && db && Array.isArray(db.characters)) {
      let anyChanged = false;
      for (const sc of pkt.characters) {
        const cid = sc.i !== undefined ? sc.i : sc.id;
        const ch = db.characters.find((c) => Number(c.id) === Number(cid));
        if (!ch) continue;
        const uid = sc.u !== undefined ? sc.u : sc.user_id;
        if (uid !== undefined) ch.user_id = uid;
        if (sc.player_name !== undefined) ch.player_name = sc.player_name;
        if (sc.category !== undefined) ch.category = sc.category;
        if (sc.authorized_user_ids !== undefined) ch.authorized_user_ids = sc.authorized_user_ids;
        if (sc.i !== undefined) {
          ch.hidden_from_user_ids = Array.isArray(sc.h) && sc.h.length > 0 ? JSON.stringify(sc.h) : null;
          ch.concealed_fields = Array.isArray(sc.c) && sc.c.length > 0 ? JSON.stringify(sc.c) : '[]';
        } else {
          if (sc.hidden_from_user_ids !== undefined) ch.hidden_from_user_ids = sc.hidden_from_user_ids;
          if (sc.concealed_fields !== undefined) ch.concealed_fields = sc.concealed_fields;
        }
        let sd = {};
        try {
          sd = typeof ch.sheet_data === 'string' ? JSON.parse(ch.sheet_data || '{}') : ch.sheet_data || {};
        } catch (e) {}
        const totXp = sc.x !== undefined ? sc.x : sc.total_experience;
        if (totXp !== undefined && String(sd.total_experience) !== String(totXp)) {
          sd.total_experience = String(totXp);
          sd.total = String(totXp);
          anyChanged = true;
        }
        if (sc.i !== undefined) {
          sd.player_base_edit_unlocked = Boolean(sc.b);
        } else if (sc.player_base_edit_unlocked !== undefined) {
          sd.player_base_edit_unlocked = Boolean(sc.player_base_edit_unlocked);
        }
        const canApplyVitals =
          !ch.updated_at || !sc.ut || new Date(sc.ut).getTime() >= new Date(ch.updated_at).getTime();
        if (canApplyVitals) {
          if (sc.s !== undefined) {
            sd.spent_experience = String(sc.s);
            sd.spent = String(sc.s);
          }
          if (sc.hu !== undefined) {
            ch.hunger = Number(sc.hu);
            sd.hunger = Array(5)
              .fill('empty')
              .map((_, i) => (i < ch.hunger ? 'filled' : 'empty'));
          }
          if (sc.hm !== undefined) {
            ch.humanity = Number(sc.hm);
          }
          if (Array.isArray(sc.hp)) {
            sd.health_states = sc.hp;
            ch.health_superficial = sc.hp.filter((s) => s === 'superficial').length;
            ch.health_aggravated = sc.hp.filter((s) => s === 'aggravated').length;
          }
          if (Array.isArray(sc.wp)) {
            sd.willpower_states = sc.wp;
            ch.willpower_superficial = sc.wp.filter((s) => s === 'superficial').length;
            ch.willpower_aggravated = sc.wp.filter((s) => s === 'aggravated').length;
          }
          if (Array.isArray(sc.hs)) {
            sd.humanity_states = sc.hs;
            sd.humanity = sc.hs;
            ch.humanity = sc.hs.filter((s) => s === 'filled').length;
            sd.stains = sc.hs.filter((s) => s === 'superficial').length;
          }
          if (sc.hm_max !== undefined) sd.health_max = sc.hm_max;
          if (sc.wp_max !== undefined) sd.willpower_max = sc.wp_max;
          if (sc.ut) ch.updated_at = sc.ut;
        }
        ch.sheet_data = JSON.stringify(sd);
        anyChanged = true;
      }
      if (anyChanged) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        } catch (e) {}
        if (!isReplay) {
          emitToLocalSockets('character:updated', {});
        }
      }
      return;
    }

    if (pkt.type === 'char_delta' && pkt.id && db && Array.isArray(db.characters)) {
      const ch = db.characters.find((c) => Number(c.id) === Number(pkt.id));
      if (ch) {
        if (pkt.rowPatch && typeof pkt.rowPatch === 'object') {
          Object.assign(ch, pkt.rowPatch);
        }
        let sd = {};
        try {
          sd = typeof ch.sheet_data === 'string' ? JSON.parse(ch.sheet_data || '{}') : ch.sheet_data || {};
        } catch (e) {}
        if (pkt.sheetPatch && typeof pkt.sheetPatch === 'object') {
          const { xp_upgrades: incomingXpUpgrades, ...restPatch } = pkt.sheetPatch;
          Object.assign(sd, restPatch);
          if (incomingXpUpgrades && typeof incomingXpUpgrades === 'object') {
            sd.xp_upgrades = { ...(sd.xp_upgrades || {}), ...incomingXpUpgrades };
          }
          if (Array.isArray(sd.hunger)) {
            ch.hunger = sd.hunger.filter((s) => s === 'filled').length;
          }
          if (Array.isArray(sd.humanity_states)) {
            ch.humanity = sd.humanity_states.filter((s) => s === 'filled').length;
            sd.stains = sd.humanity_states.filter((s) => s === 'superficial').length;
          }
          if (Array.isArray(sd.health_states)) {
            ch.health_superficial = sd.health_states.filter((s) => s === 'superficial').length;
            ch.health_aggravated = sd.health_states.filter((s) => s === 'aggravated').length;
          }
          if (Array.isArray(sd.willpower_states)) {
            ch.willpower_superficial = sd.willpower_states.filter((s) => s === 'superficial').length;
            ch.willpower_aggravated = sd.willpower_states.filter((s) => s === 'aggravated').length;
          }
          ch.sheet_data = JSON.stringify(sd);
        }
        ch.updated_at = new Date(pkt.ts || Date.now()).toISOString();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        } catch (e) {}
        if (!isReplay) {
          emitToLocalSockets('character:updated', { id: ch.id });
          emitToLocalSockets('character:vitals_updated', {
            id: ch.id,
            character_id: ch.id,
            hunger: ch.hunger,
            humanity: ch.humanity,
            health_superficial: ch.health_superficial,
            health_aggravated: ch.health_aggravated,
            willpower_superficial: ch.willpower_superficial,
            willpower_aggravated: ch.willpower_aggravated,
            sheet_data: sd,
          });
        }
      }
      return;
    }

    if (pkt.type === 'socket_event') {
      if (pkt.event === 'dice:result' && pkt.data) {
        const rollDedupKey = pkt.data.roll_uid || `roll_${pkt.data.id}_${pkt.data.roller_name}`;
        if (markRealtimeIdProcessed(rollDedupKey)) return;
        if (db) {
          if (!Array.isArray(db.dice_rolls)) db.dice_rolls = [];
          const existingIdx = db.dice_rolls.findIndex((r) => Number(r.id) === Number(pkt.data.id));
          if (existingIdx >= 0) db.dice_rolls[existingIdx] = pkt.data;
          else db.dice_rolls.push(pkt.data);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
          } catch (e) {}
        }
      }
      if (pkt.event === 'gameboard:canvas_updated' && pkt.data && pkt.data.canvas_state !== undefined && db) {
        const targetChronId = Number(pkt.data.chronicle_id || pkt.data.campaign_id) || defaultChronicleId();
        const gs = (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === targetChronId) || (db.gameboard_state || [])[0];
        if (gs) {
          gs.canvas_state =
            typeof pkt.data.canvas_state === 'string'
              ? pkt.data.canvas_state
              : JSON.stringify(pkt.data.canvas_state);
          gs.updated_at = new Date(pkt.ts || Date.now()).toISOString();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
          } catch (e) {}
        }
      }
      if (pkt.event === 'gameboard:relationship_map_updated' && pkt.data && pkt.data.map_state !== undefined && db) {
        const targetChronId = Number(pkt.data.chronicle_id || pkt.data.campaign_id) || defaultChronicleId();
        const gs = (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === targetChronId) || (db.gameboard_state || [])[0];
        if (gs) {
          gs.relationship_map_state =
            typeof pkt.data.map_state === 'string'
              ? pkt.data.map_state
              : JSON.stringify(pkt.data.map_state || {});
          gs.updated_at = new Date(pkt.ts || Date.now()).toISOString();
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
          } catch (e) {}
        }
      }
      if (pkt.dbPatch && db) {
        applyDbPatch(pkt.dbPatch, true);
      }
      if (!isReplay) {
        emitToLocalSockets(pkt.event, pkt.data);
      }
    } else if (pkt.type === 'db:patch' && db) {
      applyDbPatch(pkt.data, isReplay);
    } else if ((pkt.type === 'cloud_snapshot' || pkt.type === 'cloud:snapshot') && pkt.key && !isReplay) {
      pullCloudSnapshot(pkt.key);
    }
  }

  function applyDbPatch(patch, isReplay = false) {
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
    if (!isReplay) {
      if (table === 'characters') {
        emitToLocalSockets('character:updated', {
          id: row ? row.id : deleteId,
          deleted: deleteId !== undefined,
        });
      } else if (table === 'episodes' || table === 'clues' || table === 'lore_entries' || table === 'scenes') {
        emitToLocalSockets('episode:updated', row || {});
      } else if (table === 'map_pins') {
        emitToLocalSockets('gameboard:pins_updated', {
          chronicle_id: row ? row.chronicle_id : defaultChronicleId(),
        });
      } else if (table === 'npc_categories') {
        emitToLocalSockets('character:updated', {});
      } else if (table === 'custom_rules') {
        emitToLocalSockets('rules:updated', {});
      }
    }
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
    sendRawNtfyPacket(pkt);
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

  async function pollRecentNtfyHistory(topic, sinceWindow = '12h', allowRecentDiceRollReplay = false) {
    try {
      await ensureDbLoaded();
      const res = await nativeFetch(`https://ntfy.sh/${encodeURIComponent(topic)}/json?poll=1&since=${encodeURIComponent(sinceWindow)}`);
      if (!res || !res.ok) return;
      const text = await res.text();
      if (!text) return;
      const lines = text.split('\n').filter((l) => l.trim());
      for (const line of lines) {
        try {
          const wrapper = JSON.parse(line);
          if (wrapper && wrapper.event === 'message' && wrapper.message) {
            const pkt = JSON.parse(wrapper.message);
            if (!pkt) continue;
            if (wrapper.id) pkt.pktId = wrapper.id;
            if (
              allowRecentDiceRollReplay &&
              (pkt.type === 'dice_roll' || (pkt.type === 'socket_event' && pkt.event === 'dice:result')) &&
              Date.now() - (pkt.ts || (wrapper.time ? wrapper.time * 1000 : 0)) < 14000
            ) {
              await applyIncomingPacket(pkt, false);
              continue;
            }
            // Replay state-syncing packets and recent presence packets without re-popping old dice roll animations
            if (
              pkt.type === 'xp_sync' ||
              pkt.type === 'st_authoritative_sync' ||
              pkt.type === 'char_delta' ||
              pkt.type === 'scene_sync' ||
              pkt.type === 'socket_event' ||
              pkt.type === 'overflow_pkt' ||
              pkt.type === 'presence_update' ||
              pkt.type === 'presence_leave' ||
              pkt.type === 'db:patch' ||
              pkt.type === 'cloud_snapshot' ||
              pkt.type === 'cloud:snapshot'
            ) {
              // Suppress reply storm while replaying historical presence packets
              if (pkt.type === 'presence_update') pkt.requestReply = false;
              await applyIncomingPacket(pkt, !allowRecentDiceRollReplay);
            }
          }
        } catch (e) {}
      }
      if (!allowRecentDiceRollReplay) {
        emitToLocalSockets('character:updated', {});
        emitToLocalSockets('episode:updated', {});
        const gs =
          (db && (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === defaultChronicleId())) ||
          (db && (db.gameboard_state || [])[0]);
        if (gs) {
          emitToLocalSockets('gameboard:scene_updated', enrichGameboardSceneState(gs));
          let cs = {};
          try {
            cs = typeof gs.canvas_state === 'string' ? JSON.parse(gs.canvas_state || '{}') : gs.canvas_state || {};
          } catch (e) {}
          emitToLocalSockets('gameboard:canvas_updated', {
            chronicle_id: gs.chronicle_id,
            campaign_id: gs.chronicle_id,
            canvas_state: cs,
          });
          let ms = {};
          try {
            ms =
              typeof gs.relationship_map_state === 'string'
                ? JSON.parse(gs.relationship_map_state || '{}')
                : gs.relationship_map_state || {};
          } catch (e) {}
          emitToLocalSockets('gameboard:relationship_map_updated', {
            chronicle_id: gs.chronicle_id,
            campaign_id: gs.chronicle_id,
            map_state: ms,
          });
        }
        emitCombinedPresences();
      }
    } catch (e) {}
  }

  function connectNtfySse(topic) {
    if (!topic || typeof EventSource === 'undefined') return;
    try {
      if (sseSource) {
        try {
          sseSource.close();
        } catch (e) {}
      }
      sseSource = new EventSource(`https://ntfy.sh/${encodeURIComponent(topic)}/sse`);
      sseSource.onopen = () => {
        updateCloudBadgeStatus('CLOUD LIVE');
        broadcastLocalPresence(true);
        broadcastStorytellerAuthoritativeState();
      };
      sseSource.onmessage = (ev) => {
        try {
          const wrapper = JSON.parse(ev.data);
          if (wrapper && wrapper.event === 'message' && wrapper.message) {
            const pkt = JSON.parse(wrapper.message);
            if (pkt) {
              if (wrapper.id) pkt.pktId = wrapper.id;
              applyIncomingPacket(pkt, false);
            }
          }
        } catch (e) {}
      };
      sseSource.onerror = () => {
        updateCloudBadgeStatus('RECONNECTING...');
        if (sseReconnectTimer) clearTimeout(sseReconnectTimer);
        sseReconnectTimer = setTimeout(() => {
          const latestCfg = getCloudConfig();
          if (latestCfg.syncEnabled && latestCfg.topic) {
            connectNtfySse(latestCfg.topic);
          }
        }, 4500);
      };
    } catch (e) {}
  }

  function startRealtimeListeners() {
    if (localBus) {
      localBus.onmessage = (ev) => applyIncomingPacket(ev.data, false);
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
      pollRecentNtfyHistory(cfg.topic, '12h', false);
      connectNtfySse(cfg.topic);

      // Fast 4-second live catch-up poll so dice rolls and XP updates arrive even if SSE temporarily hiccups
      if (fastLivePollTimer) clearInterval(fastLivePollTimer);
      fastLivePollTimer = setInterval(() => {
        const latestCfg = getCloudConfig();
        if (latestCfg.syncEnabled && latestCfg.topic && navigator.onLine) {
          pollRecentNtfyHistory(latestCfg.topic, '12s', true);
        }
      }, 4000);

      setInterval(() => {
        broadcastLocalPresence(false, true);
      }, 30000);

      window.addEventListener('beforeunload', () => {
        if (localPresenceRecord && localPresenceRecord.userId) {
          sendRawNtfyPacket({
            senderId: CLIENT_ID,
            ts: Date.now(),
            type: 'presence_leave',
            userId: localPresenceRecord.userId,
          });
        }
      });
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
    const validUser = extractValidAuthUser();
    const user = validUser || parseAuthUser();
    const defChronId = defaultChronicleId();

    if (event === 'room:join') {
      const campId =
        typeof data === 'object' && data !== null
          ? Number(data.chronicleId || data.campaignId) || defChronId
          : Number(data) || defChronId;
      sock.chronicleId = campId;
      const uid = Number((data && data.userId) || (validUser && validUser.id) || user.id);
      const uRole = (data && data.role) || (validUser && validUser.role) || user.role || 'player';
      let charData = null;
      if (data && data.characterId) {
        charData = (db.characters || []).find((c) => Number(c.id) === Number(data.characterId)) || null;
      } else if (uRole !== 'gm' && uid) {
        charData =
          (db.characters || []).find(
            (c) =>
              Number(c.chronicle_id) === campId &&
              String(c.category || '').toLowerCase() === 'pc' &&
              Number(c.user_id) === uid
          ) || null;
      }
      const presence = {
        socketId: sock.id,
        userId: uid,
        username: (data && data.username) || (validUser && validUser.username) || user.username,
        displayName:
          (data && data.displayName) ||
          (validUser && (validUser.displayName || validUser.username)) ||
          user.displayName ||
          user.username,
        role: uRole,
        isSpectator: !charData,
        characterId: charData ? charData.id : null,
        characterName: charData ? charData.name : null,
        characterClan: charData ? charData.clan : null,
        avatarUrl: charData ? charData.avatar_url : null,
        hunger: charData ? Number(charData.hunger || 1) : 0,
      };
      sock.presence = presence;
      localPresenceRecord = presence;
      activePresencesByUserId.set(Number(presence.userId), { ...presence, lastSeen: Date.now() });
      emitCombinedPresences();
      broadcastLocalPresence(true);
      if (uRole === 'gm' || Number(uid) === 11) {
        broadcastStorytellerAuthoritativeState();
      }
      return;
    }

    if (event === 'presence:set_character') {
      const { characterId, isSpectator } = data || {};
      const c = characterId ? (db.characters || []).find((x) => Number(x.id) === Number(characterId)) : null;
      const baseUser = validUser || user;
      const presence = {
        ...(sock.presence || {
          socketId: sock.id,
          userId: baseUser.id,
          username: baseUser.username,
          displayName: baseUser.displayName || baseUser.username,
          role: baseUser.role || 'player',
        }),
        isSpectator: Boolean(isSpectator || !c),
        characterId: c ? c.id : null,
        characterName: c ? c.name : null,
        characterClan: c ? c.clan : null,
        avatarUrl: c ? c.avatar_url : null,
        hunger: c ? Number(c.hunger || 1) : 0,
      };
      sock.presence = presence;
      localPresenceRecord = presence;
      activePresencesByUserId.set(Number(presence.userId), { ...presence, lastSeen: Date.now() });
      emitCombinedPresences();
      broadcastLocalPresence(false);
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
      roll.id = Math.max(nextId('dice_rolls'), Math.floor(Date.now() % 1000000000) * 100 + Math.floor(Math.random() * 100));
      roll.roll_uid = `${CLIENT_ID}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      roll.chronicle_id = campId;
      markRealtimeIdProcessed(roll.roll_uid);
      db.dice_rolls = db.dice_rolls || [];
      db.dice_rolls.push(roll);
      persistDb();
      emitToLocalSockets('dice:result', roll);
      sendRawNtfyPacket({
        senderId: CLIENT_ID,
        ts: Date.now(),
        type: 'dice_roll',
        roll,
      });
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
      const enrichedGs = enrichGameboardSceneState(gs);
      emitToLocalSockets('gameboard:scene_updated', enrichedGs);
      broadcastSceneSyncPacket(enrichedGs);
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

  function parseNullableHiddenIds(val) {
    if (val === null || val === undefined || val === 'null' || val === '' || val === '[]') return null;
    if (Array.isArray(val)) {
      const nums = val.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
      return nums.length > 0 ? nums : null;
    }
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          const nums = parsed.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
          return nums.length > 0 ? nums : null;
        }
      } catch (e) {}
    }
    return null;
  }

  function formatCharacterForApi(r) {
    const authIds = safeParseJsonArray(r.authorized_user_ids);
    const concealedFields = safeParseJsonArray(r.concealed_fields);
    const hiddenFromIds = parseNullableHiddenIds(r.hidden_from_user_ids);

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
      try {
        localStorage.setItem('vtm_user', JSON.stringify(userPayload));
      } catch (e) {}
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
      try {
        localStorage.setItem('vtm_user', JSON.stringify(userPayload));
      } catch (e) {}
      return jsonResponse({ success: true, token: makeMockToken(userPayload), user: userPayload });
    }

    if (path === '/api/auth/me' && method === 'GET') {
      const authUser = extractValidAuthUser(headers);
      if (!authUser) {
        return jsonResponse({ error: 'Not authenticated' }, 401);
      }
      const u = (db.users || []).find((x) => Number(x.id) === Number(authUser.id)) || authUser;
      const isGm =
        u.role === 'gm' ||
        u.username === 'TohkaTakushi' ||
        (db.chronicles || []).some((c) => Number(c.gm_id) === Number(u.id));
      return jsonResponse({
        user: {
          ...authUser,
          id: u.id,
          username: u.username,
          displayName: u.display_name || u.displayName || u.username,
          role: isGm ? 'gm' : u.role || authUser.role || 'player',
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
      let boardCopy = enrichGameboardSceneState(gs);

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
        emitToLocalSockets('gameboard:map_updated', {
          chronicle_id: targetChronicleId,
          active_map_url: mapUrl,
        });
        emitToLocalSockets('gameboard:canvas_updated', {
          chronicle_id: targetChronicleId,
          campaign_id: targetChronicleId,
          canvas_state: cs,
        });
        broadcastSceneSyncPacket(gs);
      }
      return jsonResponse({ success: true, map_url: mapUrl });
    }

    if (path === '/api/gameboard/scene' && method === 'POST') {
      const targetChronicleId = Number(body.chronicle_id) || defChronId;
      let gs = (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === targetChronicleId) || db.gameboard_state[0];
      let targetEp = null;
      if (gs) {
        if (body.active_scene_banner !== undefined && body.active_scene_banner !== null)
          gs.active_scene_banner = stripBasePathFromUrl(body.active_scene_banner);
        if (body.active_location !== undefined && body.active_location !== null) gs.active_location = body.active_location;
        if (body.active_npc_persona !== undefined && body.active_npc_persona !== null)
          gs.active_npc_persona = body.active_npc_persona;
        if (body.active_npc_avatar !== undefined && body.active_npc_avatar !== null)
          gs.active_npc_avatar = stripBasePathFromUrl(body.active_npc_avatar);
        if (body.active_mood_text !== undefined && body.active_mood_text !== null) gs.active_mood_text = body.active_mood_text;
        if (body.active_episode_id !== undefined && body.active_episode_id !== null) {
          gs.active_episode_id = Number(body.active_episode_id);
          targetEp = (db.episodes || []).find((e) => Number(e.id) === Number(body.active_episode_id)) || null;
          if (targetEp) {
            targetEp.revealed = 1;
            if (!targetEp.status || targetEp.status === 'planned' || targetEp.status === 'planning') {
              targetEp.status = 'active';
            }
            const epMaps = parseEpisodeMapsArray(targetEp.maps);
            const firstMapObj =
              epMaps.length > 0 ? (typeof epMaps[0] === 'string' ? { url: epMaps[0] } : epMaps[0]) : null;
            if (!body.active_location) {
              gs.active_location =
                targetEp.location || (firstMapObj && firstMapObj.name) || targetEp.title || gs.active_location || '';
            }
            if (!body.active_mood_text) {
              gs.active_mood_text =
                targetEp.hook || (firstMapObj && firstMapObj.mood) || targetEp.concepts || gs.active_mood_text || '';
            }
            const pushedMapUrl = body.active_map_url || (firstMapObj && firstMapObj.url) || null;
            if (pushedMapUrl) {
              const cleanedMapUrl = stripBasePathFromUrl(pushedMapUrl);
              gs.active_map_url = cleanedMapUrl;
              let cs = {};
              try {
                cs = typeof gs.canvas_state === 'string' ? JSON.parse(gs.canvas_state || '{}') : gs.canvas_state || {};
              } catch (e) {}
              cs.backdrop = cleanedMapUrl;
              gs.canvas_state = JSON.stringify(cs);
            }
          }
        }
        if (body.active_map_url && !targetEp) {
          const cleanedMapUrl = stripBasePathFromUrl(body.active_map_url);
          gs.active_map_url = cleanedMapUrl;
          let cs = {};
          try {
            cs = typeof gs.canvas_state === 'string' ? JSON.parse(gs.canvas_state || '{}') : gs.canvas_state || {};
          } catch (e) {}
          cs.backdrop = cleanedMapUrl;
          gs.canvas_state = JSON.stringify(cs);
        }
        if (body.game_time !== undefined && body.game_time !== null) gs.game_time = body.game_time;
        gs.updated_at = new Date().toISOString();
        persistDb();
        const enrichedGs = enrichGameboardSceneState(gs);
        emitToLocalSockets('gameboard:scene_updated', enrichedGs);
        if (enrichedGs.active_map_url) {
          emitToLocalSockets('gameboard:map_updated', {
            chronicle_id: targetChronicleId,
            active_map_url: enrichedGs.active_map_url,
          });
        }
        if (targetEp) {
          emitToLocalSockets('episode:updated', targetEp);
        }
        broadcastSceneSyncPacket(enrichedGs, targetEp);
        return jsonResponse({ success: true, state: enrichedGs });
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
        publishRealtimeEvent('gameboard:canvas_updated', {
          chronicle_id: targetChronicleId,
          campaign_id: targetChronicleId,
          canvas_state: cleanedCanvas,
          updated_by: user.displayName || user.username,
        });
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
        publishRealtimeEvent('gameboard:relationship_map_updated', {
          chronicle_id: targetChronicleId,
          campaign_id: targetChronicleId,
          map_state: cleanedMap,
          updated_by: user.displayName || user.username,
        });
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
          ? (db.characters || []).filter((c) => Number(c.chronicle_id) === cId && String(c.category || '').toLowerCase() === 'pc')
          : (db.characters || []).filter((c) => Number(c.id) === charId && Number(c.chronicle_id) === cId);

      const updatedChars = [];
      for (const char of targets) {
        let sd = {};
        try {
          sd = typeof char.sheet_data === 'string' ? JSON.parse(char.sheet_data || '{}') : char.sheet_data || {};
        } catch (e) {}
        const currentTotal = parseInt(sd.total_experience || sd.total || 0, 10) || 0;
        const currentSpent = parseInt(sd.spent_experience || sd.spent || 0, 10) || 0;
        const newTotal = Math.max(0, currentTotal + amount);
        sd.total_experience = String(newTotal);
        sd.total = String(newTotal);
        sd.spent_experience = String(currentSpent);
        sd.spent = String(currentSpent);
        if (!Array.isArray(sd.xp_log)) sd.xp_log = [];
        const nowIso = new Date().toISOString();
        sd.xp_log.unshift({
          id: 'xp_award_' + Date.now() + '_' + char.id,
          type: amount >= 0 ? 'award' : 'deduct',
          scope: target === 'campaign' ? 'campaign' : 'individual',
          amount,
          previousTotal: currentTotal,
          newTotal,
          reason,
          by: user.displayName || user.username || 'Storyteller',
          timestamp: nowIso,
          date: nowIso,
        });
        char.sheet_data = JSON.stringify(sd);
        char.updated_at = nowIso;
        updatedChars.push({
          id: char.id,
          name: char.name,
          total_experience: newTotal,
          spent_experience: currentSpent,
          new_total: newTotal,
          sheet_data: sd,
        });
        emitToLocalSockets('character:updated', { id: char.id });
        emitToLocalSockets('vtm:xp_updated', { character_id: char.id, total_experience: newTotal, spent_experience: currentSpent, xp_log: sd.xp_log });
      }
      persistDb();
      if (updatedChars.length > 0) {
        sendRawNtfyPacket({
          senderId: CLIENT_ID,
          ts: Date.now(),
          type: 'xp_sync',
          chronicle_id: cId,
          updates: updatedChars.map((u) => ({
            id: u.id,
            total_experience: u.total_experience,
            spent_experience: u.spent_experience,
            xp_log: Array.isArray(u.sheet_data && u.sheet_data.xp_log) ? u.sheet_data.xp_log.slice(0, 15) : [],
          })),
        });
        broadcastStorytellerAuthoritativeState();
      }
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
        emitToLocalSockets('episode:updated', ep);
        const gs =
          (db.gameboard_state || []).find((g) => Number(g.chronicle_id) === Number(ep.chronicle_id || defChronId)) ||
          (db.gameboard_state || [])[0];
        if (gs && Number(gs.active_episode_id) === Number(ep.id)) {
          if (body.location !== undefined && body.location) gs.active_location = body.location;
          if (body.hook !== undefined && body.hook) gs.active_mood_text = body.hook;
          persistDb();
          const enrichedGs = enrichGameboardSceneState(gs);
          emitToLocalSockets('gameboard:scene_updated', enrichedGs);
          broadcastSceneSyncPacket(enrichedGs, ep);
        } else if (gs) {
          broadcastSceneSyncPacket(gs, ep);
        }
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
      const isGm = isChronicleGM(cId, user.id);
      const list = (db.characters || [])
        .filter((c) => Number(c.chronicle_id) === cId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(formatCharacterForApi)
        .filter((c) => {
          if (isGm || Number(c.user_id) === Number(user.id)) return true;
          if (Array.isArray(c.hidden_from_user_ids) && c.hidden_from_user_ids.map(Number).includes(Number(user.id))) {
            return false;
          }
          return true;
        });
      return jsonResponse(list);
    }

    if (path === '/api/characters' && method === 'GET') {
      const cId = Number(q.get('chronicle_id') || q.get('campaign_id')) || defChronId;
      const cat = q.get('category');
      const isGm = isChronicleGM(cId, user.id);
      const list = (db.characters || [])
        .filter((c) => Number(c.chronicle_id) === cId && (!cat || c.category === cat))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(formatCharacterForApi)
        .filter((c) => {
          if (isGm || Number(c.user_id) === Number(user.id)) return true;
          if (Array.isArray(c.hidden_from_user_ids) && c.hidden_from_user_ids.map(Number).includes(Number(user.id))) {
            return false;
          }
          return true;
        });
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
        hidden_from_user_ids: null,
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
      const is15BoxHealth =
        tracker === 'health' &&
        (String(sheet.sheet_template || '').includes('ALT') ||
          (Array.isArray(states) && states.length === 15) ||
          (Array.isArray(sheet.health_states) && sheet.health_states.length === 15));
      const totalTrackerBoxes = is15BoxHealth ? 15 : 10;

      if (tracker && capacity !== undefined) {
        sheet[tracker + '_max'] = Number(capacity);
        const existingStates = Array.isArray(states)
          ? [...states]
          : Array.isArray(sheet[tracker + '_states'])
            ? [...sheet[tracker + '_states']]
            : Array(totalTrackerBoxes).fill('empty');
        while (existingStates.length < totalTrackerBoxes) existingStates.push('empty');
        for (let i = 0; i < totalTrackerBoxes; i++) {
          if (i >= Number(capacity)) existingStates[i] = 'filled';
          else if (existingStates[i] === 'filled') existingStates[i] = 'empty';
        }
        sheet[tracker + '_states'] = existingStates;
        if (tracker === 'health') {
          char.health_aggravated = existingStates.filter((s) => s === 'aggravated').length;
          char.health_superficial = existingStates.filter((s) => s === 'superficial').length;
        } else if (tracker === 'willpower') {
          char.willpower_aggravated = existingStates.filter((s) => s === 'aggravated').length;
          char.willpower_superficial = existingStates.filter((s) => s === 'superficial').length;
        }
      } else if (tracker && Array.isArray(states)) {
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
          sheet.humanity = states;
        }
      } else if (type && delta !== undefined) {
        let curHum = Number(char.humanity ?? 7);
        let curStains = Number(sheet.stains || 0);
        let curHunger = Number(char.hunger || 0);
        if (type === 'humanity') {
          curHum = Math.max(0, Math.min(10, curHum + Number(delta)));
          char.humanity = curHum;
          const st = sheet.humanity_states ? [...sheet.humanity_states] : Array(10).fill('empty');
          for (let i = 0; i < 10; i++) {
            if (i < curHum) st[i] = 'filled';
            else if (st[i] === 'filled') st[i] = 'empty';
          }
          sheet.humanity_states = st;
          sheet.humanity = st;
        } else if (type === 'stain') {
          curStains = Math.max(0, Math.min(10, curStains + Number(delta)));
          sheet.stains = curStains;
          const st = sheet.humanity_states ? [...sheet.humanity_states] : Array(10).fill('empty');
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
        if (hunger !== undefined) {
          const curHunger = Math.max(0, Math.min(5, Number(hunger)));
          char.hunger = curHunger;
          sheet.hunger = Array(5)
            .fill('empty')
            .map((_, i) => (i < curHunger ? 'filled' : 'empty'));
        }
        if (humanity !== undefined) {
          const curHum = Math.max(0, Math.min(10, Number(humanity)));
          char.humanity = curHum;
          const curStains = Number(sheet.stains || 0);
          const st = Array.isArray(sheet.humanity_states) ? [...sheet.humanity_states] : Array(10).fill('empty');
          for (let i = 0; i < 10; i++) {
            if (i < curHum) st[i] = 'filled';
            else if (i >= 10 - curStains) st[i] = 'superficial';
            else st[i] = 'empty';
          }
          sheet.humanity_states = st;
          sheet.humanity = st;
        }
      }

      char.sheet_data = JSON.stringify(sheet);
      char.updated_at = new Date().toISOString();
      persistDb();
      const formatted = { ...formatCharacterForApi(char), success: true };
      emitToLocalSockets('character:vitals_updated', {
        id: char.id,
        character_id: char.id,
        sheet_data: formatted.sheet_data,
        hunger: char.hunger,
        humanity: char.humanity,
        health_superficial: char.health_superficial,
        health_aggravated: char.health_aggravated,
        willpower_superficial: char.willpower_superficial,
        willpower_aggravated: char.willpower_aggravated,
      });
      emitToLocalSockets('character:updated', { id: char.id });

      // Send a compact (~250 byte) char_delta packet so Health, Willpower, Humanity, and Hunger sync immediately over ntfy
      sendRawNtfyPacket({
        senderId: CLIENT_ID,
        ts: Date.now(),
        type: 'char_delta',
        id: char.id,
        rowPatch: {
          hunger: char.hunger,
          humanity: char.humanity,
          health_superficial: char.health_superficial,
          health_aggravated: char.health_aggravated,
          willpower_superficial: char.willpower_superficial,
          willpower_aggravated: char.willpower_aggravated,
        },
        sheetPatch: {
          hunger: sheet.hunger,
          health_states: sheet.health_states,
          willpower_states: sheet.willpower_states,
          humanity_states: sheet.humanity_states,
          humanity: sheet.humanity,
          health_max: sheet.health_max,
          willpower_max: sheet.willpower_max,
          stains: sheet.stains,
        },
      });
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

        const sheetPatch = {};
        const rowPatch = {};

        if (body.sheet_data && typeof body.sheet_data === 'object') {
          const sd = body.sheet_data;
          for (const k of Object.keys(sd)) {
            if (JSON.stringify(existingSheet[k]) !== JSON.stringify(sd[k])) {
              sheetPatch[k] = sd[k];
            }
          }
          if (sd.name) {
            char.name = sd.name;
            rowPatch.name = sd.name;
          }
          if (sd.clan) {
            char.clan = sd.clan;
            rowPatch.clan = sd.clan;
          }
          if (sd.concept) {
            char.concept = sd.concept;
            rowPatch.concept = sd.concept;
          }
          if (Array.isArray(sd.hunger)) {
            char.hunger = sd.hunger.filter((s) => s === 'filled').length;
            rowPatch.hunger = char.hunger;
          }
          if (Array.isArray(sd.humanity_states)) {
            char.humanity = sd.humanity_states.filter((s) => s === 'filled').length;
            sd.stains = sd.humanity_states.filter((s) => s === 'superficial').length;
            rowPatch.humanity = char.humanity;
          } else if (Array.isArray(sd.humanity)) {
            char.humanity = sd.humanity.filter((s) => s === 'filled').length;
            rowPatch.humanity = char.humanity;
          }
          if (Array.isArray(sd.health_states)) {
            char.health_superficial = sd.health_states.filter((s) => s === 'superficial').length;
            char.health_aggravated = sd.health_states.filter((s) => s === 'aggravated').length;
            rowPatch.health_superficial = char.health_superficial;
            rowPatch.health_aggravated = char.health_aggravated;
          }
          if (Array.isArray(sd.willpower_states)) {
            char.willpower_superficial = sd.willpower_states.filter((s) => s === 'superficial').length;
            char.willpower_aggravated = sd.willpower_states.filter((s) => s === 'aggravated').length;
            rowPatch.willpower_superficial = char.willpower_superficial;
            rowPatch.willpower_aggravated = char.willpower_aggravated;
          }
          existingSheet = { ...existingSheet, ...sd };
          char.sheet_data = JSON.stringify(existingSheet);
        }

        if (body.name !== undefined) {
          char.name = body.name;
          rowPatch.name = char.name;
        }
        if (body.short_name !== undefined) {
          char.short_name = body.short_name;
          rowPatch.short_name = char.short_name;
        }
        if (body.clan !== undefined) {
          char.clan = body.clan;
          rowPatch.clan = char.clan;
        }
        if (body.concept !== undefined) {
          char.concept = body.concept;
          rowPatch.concept = char.concept;
        }
        if (body.hunger !== undefined) {
          char.hunger = Number(body.hunger);
          rowPatch.hunger = char.hunger;
        }
        if (body.humanity !== undefined) {
          char.humanity = Number(body.humanity);
          rowPatch.humanity = char.humanity;
        }
        if (body.avatar_url !== undefined) {
          char.avatar_url = stripBasePathFromUrl(body.avatar_url);
          rowPatch.avatar_url = char.avatar_url;
        }
        if (body.vault_url !== undefined) {
          char.vault_url = stripBasePathFromUrl(body.vault_url);
          rowPatch.vault_url = char.vault_url;
        }
        if (body.authorized_user_ids !== undefined) {
          char.authorized_user_ids = Array.isArray(body.authorized_user_ids)
            ? JSON.stringify(body.authorized_user_ids)
            : body.authorized_user_ids;
          rowPatch.authorized_user_ids = char.authorized_user_ids;
        }
        if (body.concealed_fields !== undefined) {
          char.concealed_fields = Array.isArray(body.concealed_fields)
            ? JSON.stringify(body.concealed_fields)
            : body.concealed_fields;
          rowPatch.concealed_fields = char.concealed_fields;
        }
        if (body.hidden_from_user_ids !== undefined) {
          if (body.hidden_from_user_ids === null || body.hidden_from_user_ids === 'null') {
            char.hidden_from_user_ids = null;
          } else if (Array.isArray(body.hidden_from_user_ids)) {
            let hideIds = body.hidden_from_user_ids.map(Number).filter((n) => !Number.isNaN(n) && n > 0);
            if (hideIds.length === 0) {
              // Caller sent [] to hide from all players when chronicleMembersList wasn't loaded
              hideIds = (db.chronicle_members || [])
                .filter(
                  (m) =>
                    Number(m.chronicle_id) === Number(char.chronicle_id) &&
                    m.role !== 'gm' &&
                    Number(m.user_id) !== Number(char.user_id)
                )
                .map((m) => Number(m.user_id));
            }
            char.hidden_from_user_ids = hideIds.length > 0 ? JSON.stringify(hideIds) : null;
          } else {
            const parsed = parseNullableHiddenIds(body.hidden_from_user_ids);
            char.hidden_from_user_ids = parsed ? JSON.stringify(parsed) : null;
          }
          rowPatch.hidden_from_user_ids = char.hidden_from_user_ids;
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
        // Send compact delta packet directly over ntfy so cross-browser sheet edits, XP spends, redactions, and visibility toggles arrive immediately
        const deltaPkt = {
          senderId: CLIENT_ID,
          ts: Date.now(),
          type: 'char_delta',
          id: char.id,
          rowPatch,
          sheetPatch,
        };
        const deltaStr = JSON.stringify(deltaPkt);
        if (deltaStr.length < 3600) {
          sendRawNtfyPacket(deltaPkt);
        } else {
          // Send immediate inline compact delta for vitals/XP/privacy AND send full delta via bytebin overflow
          const compactSheetPatch = {};
          const essentialKeys = [
            'total_experience',
            'total',
            'spent_experience',
            'spent',
            'xp_locked_baselines',
            'sheet_template',
            'name',
            'clan',
            'concept',
            'predator',
            'ambition',
            'desire',
            'hunger',
            'health_states',
            'willpower_states',
            'humanity_states',
            'humanity',
            'health_max',
            'willpower_max',
            'stains',
            'blood_potency',
          ];
          for (const k of Object.keys(sheetPatch)) {
            if (
              essentialKeys.includes(k) ||
              k.startsWith('attr_') ||
              k.startsWith('skill_') ||
              k.startsWith('disc_')
            ) {
              compactSheetPatch[k] = sheetPatch[k];
            }
          }
          sendRawNtfyPacket({
            senderId: CLIENT_ID,
            ts: Date.now(),
            type: 'char_delta',
            id: char.id,
            rowPatch,
            sheetPatch: compactSheetPatch,
          });
          sendRawNtfyPacket(deltaPkt);
        }
        return jsonResponse({
          success: true,
          hidden_from_user_ids: parseNullableHiddenIds(char.hidden_from_user_ids),
          concealed_fields: safeParseJsonArray(char.concealed_fields),
        });
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
    currentCloudStatusLabel = label;
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
      pill.innerHTML = `<i class="fa-solid fa-cloud" style="color:#ef4444;"></i> <span id="vtmCloudBadgeText">${currentCloudStatusLabel}</span>`;
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
