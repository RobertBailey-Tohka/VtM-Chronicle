/**
 * Chronicle Hub (tab-chronicle-hub) and Coterie & Player Management
 */


function renderCoterieTokens(characterRecords) {
  renderActivePlayersBar(currentChronicleActiveUsers);
}

function renderActivePlayersBar(activeUsers) {
  // Query the DOM for the player tokens container element by its ID
  const coterieContainer = document.getElementById('playerTokens');
  if (!coterieContainer) return;
  coterieContainer.innerHTML = '';
  
  // Query the DOM for the chronicle hub tab element to check if the user is currently in the lobby
  const chronicleHubTabElement = document.getElementById('tab-chronicle-hub');
  const isLobby = !activeChronicleId || chronicleHubTabElement && chronicleHubTabElement.classList.contains('active');
  if (isLobby) {
    if (!currentUser) return;
    activeUsers = [{
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.displayName || currentUser.username,
      role: currentUser.role || activeChronicleRole || 'player',
      characterName: null,
      characterId: null,
      avatar: currentUser.avatar || currentUser.avatar_url || '/images/caine_portrait.jpg'
    }];
  }
  if (!activeUsers) activeUsers = [];
  
  // Query the DOM for the player count badge label element by its ID
  const playerCountLabelElement = document.getElementById('playerCountLabel');
  if (playerCountLabelElement) playerCountLabelElement.innerText = activeUsers.length;
  
  const uniqueUsers = [];
  const seenUserIds = new Set();
  const storytellers = [];
  const players = [];
  activeUsers.forEach(userObject => {
    const isStoryteller = userObject.role === 'gm' || userObject.role === 'storyteller';
    if (isStoryteller) storytellers.push(userObject); else players.push(userObject);
  });
  const createGroup = (groupTitle, groupUsers, iconClass) => {
    if (groupUsers.length === 0) return;
    // Create an h4 heading element in the DOM for the player group section
    const sectionHeader = document.createElement('h4');
    sectionHeader.style.cssText = "margin: 10px 0 5px 0; font-size: 11px; text-transform: uppercase; color: #9ca3af; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;";
    sectionHeader.innerHTML = `<i class="${iconClass}"></i> ${groupTitle}`;
    coterieContainer.appendChild(sectionHeader);
    groupUsers.forEach(userObject => {
      const isSelf = currentUser && userObject.userId === currentUser.id;
      let characterRecord = null;
      if (userObject.characterId) {
        characterRecord = chronicleCharactersList.find(characterItem => characterItem.id === userObject.characterId);
      }
      let avatarSrc = userObject.avatar || '/images/caine_portrait.jpg';
      if (characterRecord && characterRecord.avatar_url && !characterRecord.avatar_url.includes('bg_page_1.png')) {
          avatarSrc = characterRecord.avatar_url;
      }
      let primaryName = userObject.displayName || userObject.username;
      let secondaryName = userObject.characterName || (userObject.role === 'gm' || userObject.role === 'storyteller' ? 'Storyteller' : 'Spectating');
      if ((userObject.role === 'gm' || userObject.role === 'storyteller') && userObject.activePersonaName) {
        secondaryName = userObject.activePersonaName;
      }
      // Create a div element in the DOM to represent the player's token in the active coterie drawer
      const tokenItemElement = document.createElement('div');
      tokenItemElement.className = 'coterie-drop-token';
      tokenItemElement.title = `${primaryName} — Playing as ${secondaryName}`;
      let hungerBadge = '';
      if (characterRecord && characterRecord.vitals && characterRecord.vitals.hunger >= 3) {
        hungerBadge = `<span class="coterie-token-hunger-badge">${characterRecord.vitals.hunger}</span>`;
      }
      tokenItemElement.onclick = clickEvent => {
        if (isSelf) togglePersonaSelectorDropdown(clickEvent); else if (characterRecord) {
          updateDossierWidget(characterRecord);
          restoreWidget('widget-character-dossier');
        }
      };
      const isStorytellerUser = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
      const targetUserId = Number(userObject.userId || userObject.id || 0);
      const canKickPlayer = isStorytellerUser && !isSelf && targetUserId > 0 && userObject.role !== 'gm' && userObject.role !== 'storyteller';
      const kickBtnHtml = canKickPlayer
        ? `<button type="button" class="btn-text-danger" onclick="kickPlayerFromDrawer(event, ${targetUserId}, '${escapeHtml(primaryName).replace(/'/g, "\\'")}')" title="Remove ${escapeHtml(primaryName)} from Chronicle immediately" style="margin-left:auto; padding:4px 8px; font-size:11px; border-radius:4px; border:1px solid rgba(239,68,68,0.35); background:rgba(239,68,68,0.12); color:#f87171; cursor:pointer; flex-shrink:0;"><i class="fa-solid fa-user-xmark"></i></button>`
        : '';
      tokenItemElement.innerHTML = `
                <div class="coterie-token-avatar-wrap">
                    <img src="${avatarSrc}" alt="${escapeHtml(primaryName)}" class="coterie-token-img">
                    ${hungerBadge}
                    <span class="coterie-token-status-dot dot-active" style="position:absolute; bottom:-2px; right:-2px; width:10px; height:10px; border-radius:50%; background:#22c55e; border:2px solid #10171f;"></span>
                </div>
                <div class="player-drawer-info" style="flex:1; min-width:0;">
                    <div class="player-drawer-name">${escapeHtml(primaryName)}</div>
                    <div class="player-drawer-role">${escapeHtml(secondaryName)}</div>
                </div>
                ${kickBtnHtml}
            `;
      coterieContainer.appendChild(tokenItemElement);
    });
  };
  createGroup('Storytellers', storytellers, 'fa-solid fa-crown');
  createGroup('Active Coterie', players, 'fa-solid fa-users');
  if (typeof renderTurnTrackerStates === 'function') renderTurnTrackerStates();
}

async function kickPlayerFromDrawer(event, userId, playerName) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  if (!activeChronicleId || !userId) return;
  const label = playerName || `Player #${userId}`;
  const confirmed = typeof window.vtmConfirm === 'function'
    ? await window.vtmConfirm(`Remove "${label}" from the Chronicle immediately? They will be evicted to the Chronicle Hub right away.`)
    : confirm(`Remove "${label}" from the Chronicle immediately?`);
  if (!confirmed) return;
  try {
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/members/${userId}`, {
      method: 'DELETE'
    });
    if (fetchResponse.ok) {
      if (Array.isArray(currentChronicleActiveUsers)) {
        currentChronicleActiveUsers = currentChronicleActiveUsers.filter(u => Number(u.userId || u.id) !== Number(userId));
        renderActivePlayersBar(currentChronicleActiveUsers);
      }
      loadCoterieManagement();
      loadCoterieModalData();
      loadCharacters();
      loadGameboardState();
    } else {
      const errData = await fetchResponse.json().catch(() => ({}));
      alert(errData.error || 'Failed to remove player.');
    }
  } catch (err) {
    console.error('Error kicking player from drawer:', err);
  }
}
window.kickPlayerFromDrawer = kickPlayerFromDrawer;


let allChroniclesData = [];
let activeSubCampaignId = null;

async function updatePendingBadgeCount() {
  if ((activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller') || !activeChronicleId) return;
  try {
    // Send an authenticated HTTP GET request to fetch the chronicle's member list
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/members`);
    if (fetchResponse.ok) {
      // Parse the JSON array of chronicle members from the HTTP response
      const membersList = await fetchResponse.json();
      const pendingCount = membersList.filter(memberRow => memberRow.status === 'pending').length;
      // Query the DOM for the pending join requests notification badge element by its ID
      const pendingBadgeElement = document.getElementById('pendingRequestsBadge');
      if (pendingBadgeElement) {
        if (pendingCount > 0) {
          pendingBadgeElement.innerText = pendingCount;
          pendingBadgeElement.style.display = 'inline-block';
        } else {
          pendingBadgeElement.style.display = 'none';
        }
      }
      const modalPendingBadge = document.getElementById('modalPendingRequestsBadge');
      if (modalPendingBadge) {
        if (pendingCount > 0) {
          modalPendingBadge.innerText = pendingCount;
          modalPendingBadge.style.display = 'inline-block';
        } else {
          modalPendingBadge.style.display = 'none';
        }
      }
    }
  } catch (errorObject) {
    console.error('Failed to update pending badge:', errorObject);
  }
}

async function loadCoterieManagement() {
  if ((activeChronicleRole !== 'gm' && activeChronicleRole !== 'storyteller') || !activeChronicleId) return;
  try {
    // Send an authenticated HTTP GET request to load all members of the active chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/members`);
    // Parse the JSON array of chronicle members from the HTTP response
    chronicleMembersList = await fetchResponse.json();
    updatePendingBadgeCount();
    const activeMembers = chronicleMembersList.filter(memberRow => memberRow.status === 'active');
    // Query the DOM for the active members table body element by its ID
    const tableBodyElement = document.getElementById('modalActiveMembersList');
    if (tableBodyElement) {
      tableBodyElement.innerHTML = '';
      if (activeMembers.length === 0) {
        tableBodyElement.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#9ca3af;font-style:italic;">No active players at this table yet. Invite registered users below!</td></tr>';
      } else {
        activeMembers.forEach(memberRow => {
          // Create a new table row element in the DOM for each active coterie member
          const tableRowElement = document.createElement('tr');
          tableRowElement.innerHTML = `
                        <td><strong>${memberRow.username}</strong></td>
                        <td>${memberRow.display_name}</td>
                        <td>${new Date(memberRow.joined_at).toLocaleDateString()}</td>
                        <td><span class="delivery-badge">${memberRow.character_count || 0} Sheet(s)</span></td>
                        <td>
                            <button class="btn-text-danger" onclick="removeCoterieMember(${memberRow.id})" title="Remove player from chronicle">
                                <i class="fa-solid fa-user-xmark"></i> Remove
                            </button>
                        </td>
                    `;
          tableBodyElement.appendChild(tableRowElement);
        });
      }
    }
    // Send an authenticated HTTP GET request to fetch registered users not yet in this chronicle
    const availablePlayersResponse = await authFetch(`/api/chronicles/${activeChronicleId}/available-players`);
    // Parse the JSON array of available players from the HTTP response
    const availablePlayers = await availablePlayersResponse.json();
    // Query the DOM for the available players dropdown select element by its ID
    const inviteSelectElement = document.getElementById('modalAvailablePlayersSelect');
    if (inviteSelectElement) {
      inviteSelectElement.innerHTML = '';
      if (availablePlayers.length === 0) {
        inviteSelectElement.innerHTML = '<option value="">No other registered players in database</option>';
      } else {
        inviteSelectElement.innerHTML = '<option value="">Select a registered player to invite...</option>';
        availablePlayers.forEach(playerObject => {
          // Create a new option element in the DOM for each available player
          const optionElement = document.createElement('option');
          optionElement.value = playerObject.id;
          optionElement.innerText = `${playerObject.display_name} (@${playerObject.username})`;
          inviteSelectElement.appendChild(optionElement);
        });
      }
    }
  } catch (errorObject) {
    console.error('Failed to load coterie management:', errorObject);
  }
}

async function invitePlayerSubmit() {
  // Query the DOM for the available players dropdown select element by its ID
  const availablePlayersSelectElement = document.getElementById('modalAvailablePlayersSelect');
  const userId = availablePlayersSelectElement.value;
  // Display an alert notification if no player was selected
  if (!userId) return alert('Please select a registered player to invite.');
  try {
    // Send an authenticated HTTP POST request to invite the selected user to the chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: parseInt(userId)
      })
    });
    // Parse the JSON response payload from the server
    const responseData = await fetchResponse.json();
    if (fetchResponse.ok && responseData.success) {
      loadCoterieManagement();
      loadCharacters();
      loadGameboardState();
      // Display a confirmation alert notification to the user
      alert('Player invited to chronicle table successfully!');
    } else {
      // Display an error alert notification to the user
      alert(responseData.error || 'Failed to invite player.');
    }
  } catch (errorObject) {
    // Display an error alert notification if the network request fails
    alert('Error sending invite.');
  }
}

async function removeCoterieMember(userId) {
  // Prompt the user with a confirmation dialog before removing the member
  const confirmed = typeof window.vtmConfirm === 'function'
    ? await window.vtmConfirm('Remove this player from the chronicle table immediately?')
    : confirm('Remove this player from the chronicle table?');
  if (!confirmed) return;
  try {
    // Send an authenticated HTTP DELETE request to remove the member from the chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/members/${userId}`, {
      method: 'DELETE'
    });
    if (fetchResponse.ok) {
      if (Array.isArray(currentChronicleActiveUsers)) {
        currentChronicleActiveUsers = currentChronicleActiveUsers.filter(u => Number(u.userId || u.id) !== Number(userId));
        renderActivePlayersBar(currentChronicleActiveUsers);
      }
      loadCoterieManagement();
      loadCharacters();
      loadGameboardState();
    }
  } catch (errorObject) {
    console.error(errorObject);
  }
}

async function openCoterieManagerModal() {
  if (!activeChronicleId) {
    // Display an alert notification if no chronicle is currently active
    alert('Please select or create an active chronicle first.');
    return;
  }
  // Query the DOM for the coterie manager modal element by its ID and mark it active
  document.getElementById('coterieManagerModal').classList.add('active');
  loadCoterieModalData();
}

async function loadCoterieModalData() {
  try {
    // Send an authenticated HTTP GET request to fetch all members and pending requests for the chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/members`);
    // Parse the JSON array of members from the HTTP response
    const allMembers = await fetchResponse.json();
    chronicleMembersList = allMembers;
    if (typeof syncAutoAcceptToggleUi === 'function') syncAutoAcceptToggleUi();
    const pendingRequests = allMembers.filter(memberRow => memberRow.status === 'pending');
    const activeMembers = allMembers.filter(memberRow => memberRow.status === 'active');
    // Query the DOM for the pending requests badge element by its ID
    const pendingBadgeElement = document.getElementById('pendingRequestsBadge');
    if (pendingBadgeElement) {
      if (pendingRequests.length > 0) {
        pendingBadgeElement.innerText = pendingRequests.length;
        pendingBadgeElement.style.display = 'inline-block';
      } else {
        pendingBadgeElement.style.display = 'none';
      }
    }
    const modalPendingBadge = document.getElementById('modalPendingRequestsBadge');
    if (modalPendingBadge) {
      if (pendingRequests.length > 0) {
        modalPendingBadge.innerText = pendingRequests.length;
        modalPendingBadge.style.display = 'inline-block';
      } else {
        modalPendingBadge.style.display = 'none';
      }
    }
    // Query the DOM for the pending join requests list container element by its ID
    const pendingContainerElement = document.getElementById('coteriePendingList');
    if (pendingRequests.length === 0) {
      pendingContainerElement.innerHTML = '<div style="color:#9ca3af;font-size:12px;font-style:italic;">No pending join requests right now.</div>';
    } else {
      pendingContainerElement.innerHTML = '<div class="pending-requests-container"></div>';
      // Query the newly created inner container element inside the pending list container
      const innerWrapElement = pendingContainerElement.querySelector('.pending-requests-container');
      pendingRequests.forEach(pendingMemberRow => {
        // Create a div element in the DOM for each pending join request card
        const pendingCardElement = document.createElement('div');
        pendingCardElement.className = 'pending-request-card';
        pendingCardElement.innerHTML = `
                    <div class="pending-user-info">
                        <span class="pending-user-name">${pendingMemberRow.display_name} (@${pendingMemberRow.username})</span>
                        <span class="pending-user-sub">Requested ${new Date(pendingMemberRow.joined_at).toLocaleDateString()}</span>
                    </div>
                    <div class="pending-actions">
                        <button class="btn-action btn-sm" onclick="approveCoterieRequest(${pendingMemberRow.id})"><i class="fa-solid fa-check"></i> Approve</button>
                        <button class="btn-danger btn-sm" onclick="denyCoterieRequest(${pendingMemberRow.id})"><i class="fa-solid fa-xmark"></i> Deny</button>
                    </div>
                `;
        innerWrapElement.appendChild(pendingCardElement);
      });
    }
    // Query the DOM for the active members table body element by its ID
    const activeTableBody = document.getElementById('modalActiveMembersList');
    activeTableBody.innerHTML = '';
    if (activeMembers.length === 0) {
      activeTableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#9ca3af;font-style:italic;">No active players at this table yet.</td></tr>';
    } else {
      activeMembers.forEach(memberRow => {
        // Create a table row element in the DOM for each active member in the modal table
        const tableRowElement = document.createElement('tr');
        let roleHtml = `<td>${memberRow.role === 'storyteller' ? 'Storyteller' : 'Player'}</td>`;
        if (currentChronicleData && currentChronicleData.gm_id === currentUser.id && memberRow.id !== currentUser.id) {
          roleHtml = `
                        <td>
                            <select class="form-control" style="font-size:12px; padding:2px 5px; width:auto; border-radius:4px;" onchange="changeMemberRole(${memberRow.id}, this.value)">
                                <option value="player" ${memberRow.role === 'player' ? 'selected' : ''}>Player</option>
                                <option value="storyteller" ${memberRow.role === 'storyteller' ? 'selected' : ''}>Storyteller</option>
                            </select>
                        </td>
                    `;
        }
        tableRowElement.innerHTML = `
                    <td><strong>${memberRow.username}</strong></td>
                    <td>${memberRow.display_name}</td>
                    <td>${new Date(memberRow.joined_at).toLocaleDateString()}</td>
                    <td><span class="delivery-badge">${memberRow.character_count || 0} Sheet(s)</span></td>
                    ${roleHtml}
                    <td>
                        <button class="btn-text-danger" onclick="removeCoterieMemberFromModal(${memberRow.id})" title="Remove player from chronicle">
                            <i class="fa-solid fa-user-xmark"></i> Remove
                        </button>
                    </td>
                `;
        activeTableBody.appendChild(tableRowElement);
      });
    }
    // Also populate the available players dropdown in the modal so the Storyteller can directly invite registered players
    const availablePlayersResponse = await authFetch(`/api/chronicles/${activeChronicleId}/available-players`);
    if (availablePlayersResponse.ok) {
      const availablePlayers = await availablePlayersResponse.json();
      const inviteSelectElement = document.getElementById('modalAvailablePlayersSelect');
      if (inviteSelectElement) {
        inviteSelectElement.innerHTML = '';
        if (availablePlayers.length === 0) {
          inviteSelectElement.innerHTML = '<option value="">No other registered players in database</option>';
        } else {
          inviteSelectElement.innerHTML = '<option value="">Select a registered player to invite...</option>';
          availablePlayers.forEach(playerObject => {
            const optionElement = document.createElement('option');
            optionElement.value = playerObject.id;
            optionElement.innerText = `${playerObject.display_name} (@${playerObject.username})`;
            inviteSelectElement.appendChild(optionElement);
          });
        }
      }
    }
  } catch (errorObject) {
    console.error('Failed to load coterie modal data:', errorObject);
  }
}

async function approveCoterieRequest(userId) {
  try {
    // Send an authenticated HTTP POST request to approve a user's pending join request
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/approve-join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId
      })
    });
    // Parse the JSON response payload from the server
    const responseData = await fetchResponse.json();
    if (fetchResponse.ok && responseData.success) {
      loadCoterieModalData();
      loadCoterieManagement();
      loadGameboardState();
    } else {
      // Display an error alert notification to the user
      alert(responseData.error || 'Failed to approve player.');
    }
  } catch (errorObject) {
    // Display an error alert notification if the network request fails
    alert('Error approving request.');
  }
}

async function denyCoterieRequest(userId) {
  const isConfirmed = typeof vtmConfirm === 'function'
    ? await vtmConfirm('Are you sure you want to deny this join request?', 'Deny Join Request')
    : true;
  if (!isConfirmed) return;
  try {
    // Send an authenticated HTTP POST request to deny a user's pending join request
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/deny-join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: userId
      })
    });
    // Parse the JSON response payload from the server
    const responseData = await fetchResponse.json();
    if (fetchResponse.ok && responseData.success) {
      loadCoterieModalData();
      loadCoterieManagement();
    } else {
      // Display an error alert notification to the user
      alert(responseData.error || 'Failed to deny request.');
    }
  } catch (errorObject) {
    // Display an error alert notification if the network request fails
    alert('Error denying request.');
  }
}

async function invitePlayerFromModal() {
  // Query the DOM for the available players dropdown select element by its ID
  const availablePlayersSelectElement = document.getElementById('modalAvailablePlayersSelect');
  const userId = availablePlayersSelectElement.value;
  // Display an alert notification if no player was selected
  if (!userId) return alert('Please select a registered player to invite.');
  try {
    // Send an authenticated HTTP POST request to invite the selected user to the chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_id: parseInt(userId)
      })
    });
    // Parse the JSON response payload from the server
    const responseData = await fetchResponse.json();
    if (fetchResponse.ok && responseData.success) {
      loadCoterieModalData();
      loadCoterieManagement();
      loadGameboardState();
      // Display a confirmation alert notification to the user
      alert('Player invited to chronicle table successfully!');
    } else {
      // Display an error alert notification to the user
      alert(responseData.error || 'Failed to invite player.');
    }
  } catch (errorObject) {
    // Display an error alert notification if the network request fails
    alert('Error inviting player.');
  }
}

async function removeCoterieMemberFromModal(userId) {
  // Prompt the user with a confirmation dialog before removing the player
  const confirmed = typeof window.vtmConfirm === 'function'
    ? await window.vtmConfirm('Are you sure you want to remove this player from the chronicle immediately?')
    : confirm('Are you sure you want to remove this player from the chronicle?');
  if (!confirmed) return;
  try {
    // Send an authenticated HTTP DELETE request to remove the player from the chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/members/${userId}`, {
      method: 'DELETE'
    });
    // Parse the JSON response payload from the server
    const responseData = await fetchResponse.json();
    if (fetchResponse.ok && responseData.success) {
      if (Array.isArray(currentChronicleActiveUsers)) {
        currentChronicleActiveUsers = currentChronicleActiveUsers.filter(u => Number(u.userId || u.id) !== Number(userId));
        renderActivePlayersBar(currentChronicleActiveUsers);
      }
      loadCoterieModalData();
      loadCoterieManagement();
      loadGameboardState();
    } else {
      // Display an error alert notification to the user
      alert(responseData.error || 'Failed to remove player.');
    }
  } catch (errorObject) {
    // Display an error alert notification if the network request fails
    alert('Error removing player.');
  }
}

function openChronicleHub() {
  returnToChronicleHub();
}

async function renderChronicleHub() {
  renderActivePlayersBar();
  // Query the DOM for the chronicle hub grid container element by its ID
  const hubGridContainerElement = document.getElementById('chronicleHubGrid');
  if (!hubGridContainerElement) return;
  hubGridContainerElement.innerHTML = '<div style="color:#9ca3af;font-style:italic;">Loading active chronicles...</div>';
  try {
    // Send an authenticated HTTP GET request to fetch the directory of all chronicles
    const fetchResponse = await authFetch('/api/chronicles/directory');
    if (!fetchResponse.ok) {
      hubGridContainerElement.innerHTML = '<div style="color:#ef4444;">Failed to load chronicle directory.</div>';
      return;
    }
    // Parse the JSON array of chronicle records from the HTTP response
    const chroniclesList = await fetchResponse.json();
    hubGridContainerElement.innerHTML = '';
    const ownedChronicles = chroniclesList.filter(chronicleRecord => chronicleRecord.is_owner);
    const joinedChronicles = chroniclesList.filter(chronicleRecord => !chronicleRecord.is_owner && chronicleRecord.member_status === 'active');
    const discoverChronicles = chroniclesList.filter(chronicleRecord => !chronicleRecord.is_owner && chronicleRecord.member_status !== 'active');
    // Create a div element in the DOM for the "Chronicles You Lead" section
    const ownedSectionElement = document.createElement('div');
    ownedSectionElement.className = 'hub-section';
    ownedSectionElement.innerHTML = `<div class="hub-section-title" style="border-bottom:none; margin-bottom:0;"><i class="fa-solid fa-crown"></i> Chronicles You Lead (Storyteller)</div>` + '<div class="celtic-divider"><div class="celtic-line-left"></div><img src="/images/celtic_diamond_center.png" class="celtic-knot-center"><div class="celtic-line-right"></div></div>';
    // Create a div element in the DOM to hold the grid of owned chronicle cards
    const ownedCardsGridElement = document.createElement('div');
    ownedCardsGridElement.className = 'hub-cards-grid';
    if (ownedChronicles.length === 0) {
      ownedCardsGridElement.innerHTML = '<div class="hub-empty-state">You do not lead any chronicles yet. Click "+ Forge New Chronicle" above to architect your world.</div>';
    } else {
      ownedChronicles.forEach(chronicleRecord => ownedCardsGridElement.appendChild(createChronicleCard(chronicleRecord, 'lead')));
    }
    ownedSectionElement.appendChild(ownedCardsGridElement);
    hubGridContainerElement.appendChild(ownedSectionElement);
    // Create a div element in the DOM for the "Chronicles You've Joined" section
    const joinedSectionElement = document.createElement('div');
    joinedSectionElement.className = 'hub-section';
    joinedSectionElement.innerHTML = `<div class="hub-section-title" style="border-bottom:none; margin-bottom:0;"><i class="fa-solid fa-droplet"></i> Chronicles You've Joined (Coterie Member)</div>` + '<div class="celtic-divider"><div class="celtic-line-left"></div><img src="/images/celtic_diamond_center.png" class="celtic-knot-center"><div class="celtic-line-right"></div></div>';
    // Create a div element in the DOM to hold the grid of joined chronicle cards
    const joinedCardsGridElement = document.createElement('div');
    joinedCardsGridElement.className = 'hub-cards-grid';
    if (joinedChronicles.length === 0) {
      joinedCardsGridElement.innerHTML = '<div class="hub-empty-state">You have not joined any chronicles as a player yet. Browse active chronicles below to request an invitation.</div>';
    } else {
      joinedChronicles.forEach(chronicleRecord => joinedCardsGridElement.appendChild(createChronicleCard(chronicleRecord, 'joined')));
    }
    joinedSectionElement.appendChild(joinedCardsGridElement);
    hubGridContainerElement.appendChild(joinedSectionElement);
    // Create a div element in the DOM for the "Discover Active Chronicles" section
    const discoverSectionElement = document.createElement('div');
    discoverSectionElement.className = 'hub-section';
    discoverSectionElement.innerHTML = `<div class="hub-section-title" style="border-bottom:none; margin-bottom:0;"><i class="fa-solid fa-globe"></i> Discover Active Chronicles</div>` + '<div class="celtic-divider"><div class="celtic-line-left"></div><img src="/images/celtic_diamond_center.png" class="celtic-knot-center"><div class="celtic-line-right"></div></div>';
    // Create a div element in the DOM to hold the grid of discoverable chronicle cards
    const discoverCardsGridElement = document.createElement('div');
    discoverCardsGridElement.className = 'hub-cards-grid';
    if (discoverChronicles.length === 0) {
      discoverCardsGridElement.innerHTML = '<div class="hub-empty-state">No other active chronicles are available to join right now.</div>';
    } else {
      discoverChronicles.forEach(chronicleRecord => discoverCardsGridElement.appendChild(createChronicleCard(chronicleRecord, 'discover')));
    }
    discoverSectionElement.appendChild(discoverCardsGridElement);
    hubGridContainerElement.appendChild(discoverSectionElement);
  } catch (errorObject) {
    console.error('Error loading lobby:', errorObject);
    hubGridContainerElement.innerHTML = '<div style="color:#ef4444;">Error loading chronicles.</div>';
  }
}

function createChronicleCard(chronicleRecord, actionType) {
  // Create a div element in the DOM to represent a single chronicle card in the hub
  const cardElement = document.createElement('div');
  cardElement.className = 'chronicle-lobby-card';
  let statusBadge = '';
  let actionButtonHtml = '';
  if (actionType === 'lead') {
    statusBadge = '<span class="badge-status-active"><i class="fa-solid fa-crown"></i> Storyteller Lead</span>';
    actionButtonHtml = `<button class="btn-action" onclick="enterChronicle(${chronicleRecord.id}, 'gm')"><i class="fa-solid fa-masks-theater"></i> Enter Storyteller Sanctum</button>`;
  } else if (actionType === 'joined') {
    if (chronicleRecord.member_role === 'storyteller') {
      statusBadge = '<span class="badge-status-active"><i class="fa-solid fa-crown"></i> Storyteller</span>';
      actionButtonHtml = `<button class="btn-action" onclick="enterChronicle(${chronicleRecord.id}, 'storyteller')"><i class="fa-solid fa-masks-theater"></i> Enter Storyteller Sanctum</button>`;
    } else {
      statusBadge = '<span class="badge-status-active"><i class="fa-solid fa-check-circle"></i> Coterie Member</span>';
      actionButtonHtml = `<button class="btn-action" onclick="enterChronicle(${chronicleRecord.id}, 'player')"><i class="fa-solid fa-dice-d20"></i> Enter Gameboard</button>`;
    }
  } else {
    if (chronicleRecord.member_status === 'pending') {
      statusBadge = '<span class="badge-status-pending"><i class="fa-solid fa-hourglass-half"></i> Request Pending</span>';
      actionButtonHtml = `<button class="btn-action-outline" disabled style="opacity:0.65;cursor:not-allowed;"><i class="fa-solid fa-clock"></i> Awaiting Storyteller</button>`;
    } else {
      statusBadge = '<span class="badge-status-unjoined"><i class="fa-solid fa-lock"></i> Unjoined</span>';
      actionButtonHtml = `<button class="btn-action" onclick="requestJoinCampaign(${chronicleRecord.id})"><i class="fa-solid fa-hand"></i> Request to Join</button>`;
    }
  }
  const playerCount = chronicleRecord.player_count !== undefined ? chronicleRecord.player_count : 0;
  cardElement.innerHTML = `
                <div class="chronicle-card-top">
                    <div class="chronicle-card-header">
                        <div class="chronicle-card-title">${chronicleRecord.title}</div>
                        ${statusBadge}
                    </div>
                    <div class="chronicle-card-gm"><i class="fa-solid fa-mask"></i> Storyteller: <strong>${chronicleRecord.gm_name || 'Storyteller'}</strong></div>
                    <div class="chronicle-card-meta">
                        <span><i class="fa-solid fa-city"></i> ${chronicleRecord.setting_city || 'Radcliff'}</span>
                        <span><i class="fa-solid fa-calendar"></i> ${chronicleRecord.setting_year || 'Modern Nights'}</span>
                        <span><i class="fa-solid fa-users"></i> ${playerCount} Player(s)</span>
                    </div>
                    ${chronicleRecord.core_pitch ? `<div class="chronicle-card-pitch">"${chronicleRecord.core_pitch}"</div>` : ''}
                    <div class="chronicle-card-desc">${chronicleRecord.description || 'No public chronicle overview provided.'}</div>
                </div>
                <div class="chronicle-card-actions">
                    ${actionButtonHtml}
                </div>
            `;
  return cardElement;
}

async function requestJoinCampaign(campaignId) {
  try {
    // Send an authenticated HTTP POST request to submit a join request for the specified chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${campaignId}/request-join`, {
      method: 'POST'
    });
    // Parse the JSON response payload from the server
    const responseData = await fetchResponse.json();
    if (fetchResponse.ok && responseData.success) {
      if (responseData.status === 'active') {
        alert('Auto-Accept is enabled on this Chronicle — you have joined the Coterie!');
      } else {
        alert('Your request to join this chronicle has been submitted to the Storyteller!');
      }
      renderChronicleHub();
    } else {
      // Display an error alert notification to the user
      alert(responseData.error || 'Failed to submit join request.');
    }
  } catch (errorObject) {
    // Display an error alert notification if the network request fails
    alert('Network error submitting join request.');
  }
}

async function updateMaxCharactersLimit(newLimitValue) {
  const parsedLimit = parseInt(newLimitValue) || 2;
  try {
    // Send an authenticated HTTP PUT request to update the maximum characters per player setting
    await authFetch(`/api/chronicles/${activeChronicleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        max_characters_per_player: parsedLimit
      })
    });
  } catch (errorObject) {
    console.error(errorObject);
  }
}


function openNewChronicleModal() {
  // Query the DOM for the new chronicle modal element by its ID
  const newChronicleModalElement = document.getElementById('newChronicleModal');
  if (newChronicleModalElement) newChronicleModalElement.classList.add('active');
}

function createChronicleSubmit() {
  // Query the DOM for the new chronicle title, city, year, description, and max character inputs
  const title = document.getElementById('newChronicleTitle')?.value.trim() || document.getElementById('newCampTitle')?.value.trim() || '';
  const city = document.getElementById('newChronicleCity')?.value.trim() || document.getElementById('newCampCity')?.value.trim() || '';
  const year = document.getElementById('newChronicleYear')?.value.trim() || document.getElementById('newCampYear')?.value.trim() || '';
  const descriptionText = document.getElementById('newChronicleDesc')?.value.trim() || document.getElementById('newCampDesc')?.value.trim() || '';
  const maxCharactersCount = parseInt(document.getElementById('newChronicleMaxChars')?.value || document.getElementById('newCampMaxChars')?.value) || 2;
  // Display an alert notification if the required chronicle title is missing
  if (!title) return alert('Chronicle title is required.');
  // Send an authenticated HTTP POST request to create a new chronicle on the server
  authFetch('/api/chronicles', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      setting_city: city,
      setting_year: year,
      description: descriptionText,
      max_characters_per_player: maxCharactersCount
    })
  }).then(fetchResponse => fetchResponse.json()).then(responseData => {
    if (responseData.id) {
      closeModal('newChronicleModal');
      
      // Query the DOM for the legacy campaign title and description inputs to clear them
      const campaignTitleInputElement = document.getElementById('newCampaignTitle'); if (campaignTitleInputElement) campaignTitleInputElement.value = '';
      const campaignDescriptionInputElement = document.getElementById('newCampaignDesc'); if (campaignDescriptionInputElement) campaignDescriptionInputElement.value = '';
      closeModal('newCampaignModal');

      enterChronicle(responseData.id, 'gm', 'campaigns');
      // Display a confirmation alert notification to the user
      alert(`Chronicle "${title}" forged successfully!`);
    } else {
      // Display an error alert notification to the user
      alert(responseData.error || 'Failed to create chronicle.');
    }
  }).catch(errorObject => {
    console.error(errorObject);
    // Display an error alert notification if the network request fails
    alert('Network error creating chronicle.');
  });
}


function syncAutoAcceptToggleUi() {
  const isAutoAcceptEnabled = !!(typeof chronicleUiSettings !== 'undefined' && chronicleUiSettings && chronicleUiSettings.auto_approve_join);
  const modalCheckbox = document.getElementById('modalAutoAcceptInvitesToggle');
  if (modalCheckbox) modalCheckbox.checked = isAutoAcceptEnabled;
  const drawerCheckbox = document.getElementById('drawerAutoAcceptInvitesToggle');
  if (drawerCheckbox) drawerCheckbox.checked = isAutoAcceptEnabled;
  const statusLabel = document.getElementById('modalAutoAcceptStatusLabel');
  if (statusLabel) {
    statusLabel.innerText = isAutoAcceptEnabled ? 'ON' : 'OFF';
    statusLabel.style.color = isAutoAcceptEnabled ? '#f87171' : '#9ca3af';
  }
}
window.syncAutoAcceptToggleUi = syncAutoAcceptToggleUi;

async function toggleAutoAcceptJoinRequests(checkboxElement) {
  if (!activeChronicleId) return;
  const wantsToEnable = !!(checkboxElement && checkboxElement.checked);
  if (wantsToEnable && typeof vtmConfirm === 'function') {
    const confirmed = await vtmConfirm(
      'WARNING: You should NOT turn this on unless you are actively expecting players right now.\n\nWhile Auto-Accept is enabled, ANY visitor can bypass Storyteller approval and immediately enter and view your Chronicle.\n\nAre you sure you want to enable Auto-Accept Join Requests?',
      'Security Warning — Auto-Accept Invitations'
    );
    if (!confirmed) {
      syncAutoAcceptToggleUi();
      return;
    }
  }
  if (typeof chronicleUiSettings === 'undefined' || !chronicleUiSettings || typeof chronicleUiSettings !== 'object') {
    chronicleUiSettings = {};
  }
  chronicleUiSettings.auto_approve_join = wantsToEnable;
  syncAutoAcceptToggleUi();
  try {
    await authFetch(`/api/chronicles/${activeChronicleId}/ui_settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ui_settings: chronicleUiSettings })
    });
  } catch (err) {
    console.error('Failed to save auto_approve_join setting:', err);
  }
}
window.toggleAutoAcceptJoinRequests = toggleAutoAcceptJoinRequests;

function togglePlayerDrawer() {
  // Query the DOM for the player roster drawer element by its ID
  const playerRosterDrawerElement = document.getElementById('playerRosterDrawer');
  if (playerRosterDrawerElement) {
    playerRosterDrawerElement.classList.toggle('open');
    if (playerRosterDrawerElement.classList.contains('open')) {
      syncAutoAcceptToggleUi();
      renderTurnTrackerStates();
    }
  }
}

let draggedTurnEntryIndex = null;

function buildDefaultTurnOrderFromRoster() {
  const entries = [];
  const seenKeys = new Set();
  const activeUsers = Array.isArray(currentChronicleActiveUsers) ? currentChronicleActiveUsers : [];
  const allChars = Array.isArray(chronicleCharactersList) ? chronicleCharactersList : [];

  // 1. Add active players first
  activeUsers.forEach(u => {
    const isSt = u.role === 'gm' || u.role === 'storyteller';
    if (isSt) return;
    const uid = Number(u.userId || u.id || 0);
    let charRec = u.characterId ? allChars.find(c => Number(c.id) === Number(u.characterId)) : null;
    if (!charRec && uid) {
      charRec = allChars.find(c => Number(c.user_id) === uid);
    }
    const entryId = charRec ? `char_${charRec.id}` : `user_${uid || u.username}`;
    if (seenKeys.has(entryId)) return;
    seenKeys.add(entryId);
    const avatarUrl = (charRec && charRec.avatar_url && !charRec.avatar_url.includes('bg_page_1.png'))
      ? charRec.avatar_url
      : (u.avatar || '/images/caine_portrait.jpg?v=2');
    entries.push({
      id: entryId,
      userId: uid || null,
      characterId: charRec ? Number(charRec.id) : null,
      name: charRec ? charRec.name : (u.displayName || u.username || 'Player'),
      subtitle: charRec ? `Player: ${u.displayName || u.username}` : 'Coterie Player',
      avatar: avatarUrl
    });
  });

  // 2. Also include any PCs in the chronicle not yet in the list
  allChars.filter(c => String(c.category || '').toLowerCase() === 'pc').forEach(charRec => {
    const entryId = `char_${charRec.id}`;
    if (seenKeys.has(entryId)) return;
    seenKeys.add(entryId);
    const avatarUrl = (charRec.avatar_url && !charRec.avatar_url.includes('bg_page_1.png'))
      ? charRec.avatar_url
      : '/images/caine_portrait.jpg?v=2';
    entries.push({
      id: entryId,
      userId: charRec.user_id ? Number(charRec.user_id) : null,
      characterId: Number(charRec.id),
      name: charRec.name || 'Kindred',
      subtitle: charRec.player_name ? `Player: ${charRec.player_name}` : (charRec.clan || 'PC'),
      avatar: avatarUrl
    });
  });

  return entries;
}

function getTurnTrackerState() {
  if (typeof chronicleUiSettings === 'undefined' || !chronicleUiSettings || typeof chronicleUiSettings !== 'object') {
    chronicleUiSettings = {};
  }
  let tracker = chronicleUiSettings.turn_tracker;
  if (!tracker || typeof tracker !== 'object') {
    tracker = { round: 1, active_entry_id: null, order: [] };
  }
  if (!Array.isArray(tracker.order) || tracker.order.length === 0) {
    const defaultOrder = buildDefaultTurnOrderFromRoster();
    tracker = {
      round: Number(tracker.round) || 1,
      active_entry_id: tracker.active_entry_id || (defaultOrder[0] ? defaultOrder[0].id : null),
      order: defaultOrder
    };
  }
  return tracker;
}

async function saveTurnTrackerState(updatedTracker) {
  if (!activeChronicleId) return;
  if (typeof chronicleUiSettings === 'undefined' || !chronicleUiSettings || typeof chronicleUiSettings !== 'object') {
    chronicleUiSettings = {};
  }
  chronicleUiSettings.turn_tracker = updatedTracker;
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
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (!isStoryteller) return;
  const tracker = getTurnTrackerState();
  tracker.active_entry_id = String(entryId);
  saveTurnTrackerState(tracker);
}
window.setActiveTurnEntry = setActiveTurnEntry;

function stepTurnTracker(delta) {
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (!isStoryteller) return;
  const tracker = getTurnTrackerState();
  if (!Array.isArray(tracker.order) || tracker.order.length === 0) return;
  let currentIndex = tracker.order.findIndex(item => String(item.id) === String(tracker.active_entry_id));
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
window.stepTurnTracker = stepTurnTracker;

function moveTurnTrackerEntry(index, direction, event) {
  if (event) event.stopPropagation();
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (!isStoryteller) return;
  const tracker = getTurnTrackerState();
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= tracker.order.length) return;
  const temp = tracker.order[index];
  tracker.order[index] = tracker.order[targetIndex];
  tracker.order[targetIndex] = temp;
  saveTurnTrackerState(tracker);
}
window.moveTurnTrackerEntry = moveTurnTrackerEntry;

function removeTurnTrackerEntry(entryId, event) {
  if (event) event.stopPropagation();
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (!isStoryteller) return;
  const tracker = getTurnTrackerState();
  tracker.order = tracker.order.filter(item => String(item.id) !== String(entryId));
  if (String(tracker.active_entry_id) === String(entryId)) {
    tracker.active_entry_id = tracker.order[0] ? tracker.order[0].id : null;
  }
  saveTurnTrackerState(tracker);
}
window.removeTurnTrackerEntry = removeTurnTrackerEntry;

function syncTurnTrackerWithCoterie() {
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (!isStoryteller) return;
  const tracker = getTurnTrackerState();
  const existingOrder = Array.isArray(tracker.order) ? [...tracker.order] : [];
  const defaultRoster = buildDefaultTurnOrderFromRoster();
  defaultRoster.forEach(candidate => {
    const exists = existingOrder.some(item => String(item.id) === String(candidate.id));
    if (!exists) existingOrder.push(candidate);
  });
  tracker.order = existingOrder;
  if (!tracker.active_entry_id && tracker.order[0]) {
    tracker.active_entry_id = tracker.order[0].id;
  }
  saveTurnTrackerState(tracker);
}
window.syncTurnTrackerWithCoterie = syncTurnTrackerWithCoterie;

function addSelectedToTurnTracker() {
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (!isStoryteller) return;
  const selectEl = document.getElementById('turnTrackerAddSelect');
  if (!selectEl || !selectEl.value) return;
  const val = selectEl.value;
  const tracker = getTurnTrackerState();
  if (!Array.isArray(tracker.order)) tracker.order = [];

  if (val === 'storyteller_enemy') {
    const stEntryId = `st_${Date.now()}`;
    tracker.order.push({
      id: stEntryId,
      name: 'Storyteller / Antagonist',
      subtitle: 'NPC Action',
      avatar: '/images/st_avatar.png',
      isStoryteller: true
    });
  } else if (val.startsWith('char_')) {
    const charId = Number(val.replace('char_', ''));
    const charRec = (chronicleCharactersList || []).find(c => Number(c.id) === charId);
    if (charRec && !tracker.order.some(item => String(item.id) === val)) {
      const avatarUrl = (charRec.avatar_url && !charRec.avatar_url.includes('bg_page_1.png'))
        ? charRec.avatar_url
        : '/images/caine_portrait.jpg?v=2';
      tracker.order.push({
        id: val,
        userId: charRec.user_id ? Number(charRec.user_id) : null,
        characterId: Number(charRec.id),
        name: charRec.name || 'Kindred',
        subtitle: charRec.player_name ? `Player: ${charRec.player_name}` : (charRec.clan || 'NPC'),
        avatar: avatarUrl
      });
    }
  }
  if (!tracker.active_entry_id && tracker.order[0]) {
    tracker.active_entry_id = tracker.order[0].id;
  }
  selectEl.value = '';
  saveTurnTrackerState(tracker);
}
window.addSelectedToTurnTracker = addSelectedToTurnTracker;

function clearTurnTrackerOrder() {
  const isStoryteller = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  if (!isStoryteller) return;
  const defaultOrder = buildDefaultTurnOrderFromRoster();
  const resetTracker = {
    round: 1,
    active_entry_id: defaultOrder[0] ? defaultOrder[0].id : null,
    order: defaultOrder
  };
  saveTurnTrackerState(resetTracker);
}
window.clearTurnTrackerOrder = clearTurnTrackerOrder;

function handleTurnRowDragStart(event, index) {
  draggedTurnEntryIndex = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
  }
}
window.handleTurnRowDragStart = handleTurnRowDragStart;

function handleTurnRowDragOver(event) {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
}
window.handleTurnRowDragOver = handleTurnRowDragOver;

function handleTurnRowDrop(event, targetIndex) {
  event.preventDefault();
  if (draggedTurnEntryIndex === null || draggedTurnEntryIndex === targetIndex) return;
  const tracker = getTurnTrackerState();
  if (!Array.isArray(tracker.order)) return;
  const [movedItem] = tracker.order.splice(draggedTurnEntryIndex, 1);
  if (movedItem) {
    tracker.order.splice(targetIndex, 0, movedItem);
    draggedTurnEntryIndex = null;
    saveTurnTrackerState(tracker);
  }
}
window.handleTurnRowDrop = handleTurnRowDrop;

function renderTurnTrackerStates() {
  const tracker = getTurnTrackerState();
  const orderList = Array.isArray(tracker.order) ? tracker.order : [];
  const activeEntry = orderList.find(item => String(item.id) === String(tracker.active_entry_id)) || orderList[0] || null;
  const activeEntryId = activeEntry ? String(activeEntry.id) : null;
  const roundNum = Number(tracker.round) || 1;

  // 1. Render inside the Players (X) Drawer (#drawerTurnTrackerContainer) — visible to BOTH Players and Storyteller
  const drawerContainer = document.getElementById('drawerTurnTrackerContainer');
  if (drawerContainer) {
    if (orderList.length === 0) {
      drawerContainer.innerHTML = `
        <div style="font-size:11px; color:#9ca3af; font-style:italic; text-align:center; padding:6px 0;">
          No turn order active yet.
        </div>
      `;
    } else {
      const rowsHtml = orderList.map((entry, idx) => {
        const isCurrentTurn = String(entry.id) === activeEntryId;
        const isMyTurn = isCurrentTurn && currentUser && Number(entry.userId) === Number(currentUser.id);
        const turnBadge = isCurrentTurn
          ? `<span style="margin-left:auto; padding:2px 7px; border-radius:999px; font-size:9.5px; font-weight:800; letter-spacing:0.6px; background:#ef4444; color:#fff; box-shadow:0 0 8px rgba(239,68,68,0.65);">${isMyTurn ? 'YOUR TURN' : 'ACTING'}</span>`
          : `<span style="margin-left:auto; font-size:10px; color:#6b7280; font-family:monospace;">#${idx + 1}</span>`;
        return `
          <div class="turn-tracker-row ${isCurrentTurn ? 'active-turn' : ''}" style="padding:6px 8px;">
            <span style="width:18px; height:18px; border-radius:50%; background:${isCurrentTurn ? '#ef4444' : 'rgba(255,255,255,0.08)'}; color:#fff; font-size:10px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">${idx + 1}</span>
            <img src="${escapeHtml(entry.avatar || '/images/caine_portrait.jpg?v=2')}" onerror="this.onerror=null;this.src='/images/caine_portrait.jpg';" alt="" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid ${isCurrentTurn ? '#ef4444' : 'rgba(255,255,255,0.2)'}; flex-shrink:0;">
            <div style="min-width:0; flex:1;">
              <div style="font-size:12px; font-weight:700; color:${isCurrentTurn ? '#fff' : '#e2e8f0'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(entry.name)}</div>
              <div style="font-size:10px; color:#9ca3af; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(entry.subtitle || '')}</div>
            </div>
            ${turnBadge}
          </div>
        `;
      }).join('');

      drawerContainer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1px; color:#f8fafc;">
            <i class="fa-solid fa-hourglass-half" style="color:#ef4444; margin-right:5px;"></i> Turn Order
          </span>
          <span style="font-size:10.5px; font-weight:800; color:#fbbf24; background:rgba(245,158,11,0.12); border:1px solid rgba(245,158,11,0.35); padding:2px 8px; border-radius:999px;">
            Round ${roundNum}
          </span>
        </div>
        ${activeEntry ? `
          <div style="margin-bottom:8px; padding:6px 9px; background:rgba(239,68,68,0.14); border:1px solid rgba(239,68,68,0.4); border-radius:6px; font-size:11px; color:#fecdd3; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-bolt" style="color:#ef4444;"></i>
            <span>Now Acting: <strong style="color:#fff;">${escapeHtml(activeEntry.name)}</strong></span>
          </div>
        ` : ''}
        <div style="display:flex; flex-direction:column; gap:5px; max-height:240px; overflow-y:auto;">
          ${rowsHtml}
        </div>
      `;
    }
  }

  // 2. Render inside the GM-only Turn Tracker Widget (#widget-turn-tracker)
  const roundLabelEl = document.getElementById('turnTrackerRoundLabel');
  if (roundLabelEl) roundLabelEl.innerText = `Round ${roundNum}`;

  const addSelectEl = document.getElementById('turnTrackerAddSelect');
  if (addSelectEl) {
    const existingIds = new Set(orderList.map(item => String(item.id)));
    let optionsHtml = `<option value="">+ Add Kindred / NPC to Turn Order...</option>`;
    optionsHtml += `<option value="storyteller_enemy">+ Storyteller / Antagonist Turn</option>`;
    (chronicleCharactersList || []).forEach(charRec => {
      const cid = `char_${charRec.id}`;
      if (!existingIds.has(cid)) {
        const tag = String(charRec.category || '').toLowerCase() === 'pc' ? 'PC' : (charRec.clan || 'NPC');
        optionsHtml += `<option value="${cid}">${escapeHtml(charRec.name)} (${escapeHtml(tag)})</option>`;
      }
    });
    addSelectEl.innerHTML = optionsHtml;
  }

  const widgetListEl = document.getElementById('turnTrackerWidgetList');
  if (widgetListEl) {
    if (orderList.length === 0) {
      widgetListEl.innerHTML = `
        <div style="padding:16px; text-align:center; color:#9ca3af; font-size:12px; font-style:italic;">
          No combatants in turn order. Click the sync icon above or add a character.
        </div>
      `;
    } else {
      widgetListEl.innerHTML = orderList.map((entry, idx) => {
        const isCurrentTurn = String(entry.id) === activeEntryId;
        const canMoveUp = idx > 0;
        const canMoveDown = idx < orderList.length - 1;
        return `
          <div class="turn-tracker-row ${isCurrentTurn ? 'active-turn' : ''}"
               draggable="true"
               ondragstart="handleTurnRowDragStart(event, ${idx})"
               ondragover="handleTurnRowDragOver(event)"
               ondrop="handleTurnRowDrop(event, ${idx})"
               onclick="setActiveTurnEntry('${escapeHtml(String(entry.id)).replace(/'/g, "\\'")}')"
               title="Click to mark as ${escapeHtml(entry.name)}'s turn (or drag to reorder)"
               style="cursor:pointer;">
            <span style="width:20px; height:20px; border-radius:50%; background:${isCurrentTurn ? '#ef4444' : 'rgba(255,255,255,0.08)'}; color:#fff; font-size:10.5px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">
              ${idx + 1}
            </span>
            <img src="${escapeHtml(entry.avatar || '/images/caine_portrait.jpg?v=2')}" onerror="this.onerror=null;this.src='/images/caine_portrait.jpg';" alt="" style="width:28px; height:28px; border-radius:50%; object-fit:cover; border:1px solid ${isCurrentTurn ? '#ef4444' : 'rgba(255,255,255,0.2)'}; flex-shrink:0;">
            <div style="min-width:0; flex:1;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-size:12.5px; font-weight:700; color:${isCurrentTurn ? '#fff' : '#e2e8f0'}; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(entry.name)}</span>
                ${isCurrentTurn ? `<span style="padding:1px 6px; border-radius:999px; font-size:9px; font-weight:800; background:#ef4444; color:#fff; letter-spacing:0.5px;">TURN</span>` : ''}
              </div>
              <div style="font-size:10px; color:#9ca3af; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(entry.subtitle || '')}</div>
            </div>
            <div style="display:flex; align-items:center; gap:4px; flex-shrink:0;" onclick="event.stopPropagation();">
              <button type="button" class="turn-reorder-btn" onclick="moveTurnTrackerEntry(${idx}, -1, event)" ${!canMoveUp ? 'disabled style="opacity:0.3;cursor:default;"' : ''} title="Move Up">
                <img src="images/vtm_arrow_up.svg" alt="Up" draggable="false">
              </button>
              <button type="button" class="turn-reorder-btn" onclick="moveTurnTrackerEntry(${idx}, 1, event)" ${!canMoveDown ? 'disabled style="opacity:0.3;cursor:default;"' : ''} title="Move Down">
                <img src="images/vtm_arrow_down.svg" alt="Down" draggable="false">
              </button>
              <button type="button" class="turn-reorder-btn" onclick="removeTurnTrackerEntry('${escapeHtml(String(entry.id)).replace(/'/g, "\\'")}', event)" title="Remove from Turn Order" style="color:#f87171;">
                <i class="fa-solid fa-xmark" style="font-size:11px;"></i>
              </button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}
window.renderTurnTrackerStates = renderTurnTrackerStates;

async function changeMemberRole(userId, newRole) {
  if (!activeChronicleId) return;
  try {
    // Send an authenticated HTTP PUT request to update a member's role in the active chronicle
    const fetchResponse = await authFetch(`/api/chronicles/${activeChronicleId}/members/${userId}/role`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: newRole
      })
    });
    if (fetchResponse.ok) {
      // Display a confirmation alert notification to the user
      alert('Role updated successfully.');
      loadCoterieModalData();
      loadCoterieManagement();
    } else {
      // Parse the JSON error payload from the HTTP response
      const responseData = await fetchResponse.json();
      // Display an error alert notification to the user
      alert('Failed to update role: ' + (responseData.error || 'Unknown error'));
    }
  } catch (errorObject) {
    // Display an error alert notification if the network request fails
    alert('Failed to update role.');
  }
}
