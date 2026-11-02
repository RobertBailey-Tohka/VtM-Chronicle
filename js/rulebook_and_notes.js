/**
 * Rulebook Codex (tab-rulebook-codex), Quick Rules Reference (widget-quick-rules), PDF Viewer, and Personal Notes (widget-personal-notes)
 */
function filterRulesByCategory(categoryName) {
    activeRuleCategory = categoryName;

    // Query all wiki category chip elements in the DOM to update the active category chip highlight
    const categoryChipElements = document.querySelectorAll('.wiki-chip');
    categoryChipElements.forEach(chipElement => {
        if (chipElement.innerText.trim() === categoryName || (categoryName === 'All' && chipElement.innerText.includes('All'))) {
            chipElement.classList.add('active');
        } else {
            chipElement.classList.remove('active');
        }
    });

    // Look up the rule search input element in the DOM by its ID
    const searchInputElement = document.getElementById('ruleSearchInput');
    const searchQuery = searchInputElement ? searchInputElement.value.toLowerCase().trim() : '';

    let filteredRulesList = allRules;
    if (categoryName !== 'All') {
        filteredRulesList = filteredRulesList.filter(ruleEntry => ruleEntry.category && ruleEntry.category.toLowerCase() === categoryName.toLowerCase());
    }
    if (searchQuery) {
        filteredRulesList = filteredRulesList.filter(ruleEntry =>
            ruleEntry.title.toLowerCase().includes(searchQuery) ||
            (ruleEntry.category && ruleEntry.category.toLowerCase().includes(searchQuery)) ||
            (ruleEntry.content && ruleEntry.content.replace(/<[^>]*>?/gm, '').toLowerCase().includes(searchQuery)) ||
            (ruleEntry.tags && ruleEntry.tags.toLowerCase().includes(searchQuery))
        );
    }
    
    // Check which render function to use depending on the UI
    
    if (typeof renderRulebookHierarchy === 'function') {
        renderRulebookHierarchy(filteredRulesList, searchQuery);
    }
    if (typeof renderRules === 'function') {
        renderRules(filteredRulesList);
    }

}

function searchRules(rawSearchQuery) {
  if (!rawSearchQuery || rawSearchQuery.trim() === '') {
    renderRulebookHierarchy(allRules);
    return;
  }
  const normalizedQuery = rawSearchQuery.toLowerCase().trim();
  const filteredRulesList = allRules.filter(
    ruleEntry => ruleEntry.title.toLowerCase().includes(normalizedQuery) || ruleEntry.content && ruleEntry.content.replace(/<[^>]*>?/gm, '').toLowerCase().includes(normalizedQuery) || ruleEntry.tags && ruleEntry.tags.toLowerCase().includes(normalizedQuery)
  );
  renderRulebookHierarchy(filteredRulesList);
}

function renderRules(rulesList) {
  // Look up the rule articles list container element in the DOM by its ID
  const articlesListElement = document.getElementById('ruleArticlesList');
  if (!articlesListElement) return;
  articlesListElement.innerHTML = '';
  if (rulesList.length === 0) {
    articlesListElement.innerHTML = '<div style="color:#9ca3af;grid-column:1/-1;text-align:center;padding:40px;">No rules found matching criteria. Click "+ New Wiki Article" to create one.</div>';
    return;
  }
  const isStorytellerOrGm = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller';
  rulesList.forEach(ruleEntry => {
    // Create a new <div> card element in memory for each rule article
    const ruleCardElement = document.createElement('div');
    ruleCardElement.className = 'rule-card';
    let tagsHtml = '';
    if (ruleEntry.tags) {
      const tagList = Array.isArray(ruleEntry.tags) ? ruleEntry.tags : ruleEntry.tags.split(',');
      tagsHtml = `
                <div class="rule-card-tags">
                    ${tagList.map(tagName => `<span class="rule-card-tag">#${escapeHtml(tagName.trim())}</span>`).join('')}
                </div>
            `;
    }
    const gmActionsHtml = isStorytellerOrGm ? `
            <div class="rule-card-actions">
                <button class="btn-card-ctrl" onclick="openNewRuleModal(${ruleEntry.id})" title="Edit Article"><i class="fa-solid fa-pen-to-square"></i> Edit</button>
                <button class="btn-card-ctrl" onclick="deleteRuleArticle(${ruleEntry.id})" title="Delete Article"><i class="fa-solid fa-trash"></i></button>
            </div>
        ` : '';
    ruleCardElement.innerHTML = `
            <div class="rule-card-header">
                <h4 class="rule-card-title">${escapeHtml(ruleEntry.title)}</h4>
                <span class="rule-card-badge">${escapeHtml(ruleEntry.category || 'General')}</span>
            </div>
            <div class="rule-card-content">${escapeHtml(ruleEntry.content || ruleEntry.summary || '')}</div>
            ${tagsHtml}
            ${gmActionsHtml}
        `;
    articlesListElement.appendChild(ruleCardElement);
  });
}

window.handleRulebookJsonUpload = async function(changeEvent) {
    const selectedFile = changeEvent.target.files[0];
    if (!selectedFile) return;

    // Ask the user for confirmation via a browser confirm dialog before importing the JSON rulebook
    if (!confirm('Are you sure you want to import this JSON rulebook? This will create multiple rules and chapters.')) {
        changeEvent.target.value = '';
        return;
    }

    try {
        // Read the uploaded JSON file contents as text using the browser File.text() API
        const jsonTextContent = await selectedFile.text();
        const parsedRulebookData = JSON.parse(jsonTextContent);
        
        let createdCount = 0;
        
        const originalCursor = document.body.style.cursor;
        document.body.style.cursor = 'wait';
        
        // Create the root object from the filename
        const rootTitle = selectedFile.name.replace(/\.json$/i, '').replace(/_/g, ' ');
        // Perform an authenticated HTTP POST request to create the top-level rulebook container article
        const rootResponse = await authFetch('/api/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: rootTitle,
                content: '',
                parent_id: null,
                chronicle_id: typeof activeChronicleId !== 'undefined' ? activeChronicleId : null
            })
        });
        
        if (!rootResponse.ok) {
            console.error('Failed to create root rulebook container');
            // Display a browser alert dialog informing the user that root creation failed
            alert('Failed to create the root rulebook container.');
            document.body.style.cursor = originalCursor;
            changeEvent.target.value = '';
            return;
        }
        
        const rootResult = await rootResponse.json();
        const absoluteRootId = rootResult.id;
        createdCount++;
        
        let chapterIndex = 0;
        for (const chapterData of parsedRulebookData) {
            if (!chapterData.chapter) continue;
            
            // Perform an authenticated HTTP POST request to create each chapter article under the root container
            const parentResponse = await authFetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: chapterData.chapter,
                    content: '',
                    parent_id: absoluteRootId,
                    chronicle_id: typeof activeChronicleId !== 'undefined' ? activeChronicleId : null,
                    sort_order: chapterIndex++
                })
            });
            
            if (!parentResponse.ok) {
                console.error('Failed to create chapter:', chapterData.chapter);
                continue;
            }
            
            const parentResult = await parentResponse.json();
            const parentId = parentResult.id;
            createdCount++;
            
            // Create Sections (Children)
            if (chapterData.sections && Array.isArray(chapterData.sections)) {
                let sectionIndex = 0;
                for (const sectionData of chapterData.sections) {
                    if (!sectionData.section) continue;
                    // Perform an authenticated HTTP POST request to create each child section rule under its chapter
                    const childResponse = await authFetch('/api/rules', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title: sectionData.section,
                            content: sectionData.rule || '',
                            parent_id: parentId,
                            chronicle_id: typeof activeChronicleId !== 'undefined' ? activeChronicleId : null,
                            sort_order: sectionIndex++
                        })
                    });
                    
                    if (childResponse.ok) {
                        createdCount++;
                    }
                }
            }
        }
        
        document.body.style.cursor = originalCursor;
        // Display a browser alert summarizing how many rule articles were imported
        alert(`Successfully imported ${createdCount} rule articles!`);
        changeEvent.target.value = '';
        if (typeof loadRulesCodex === 'function') loadRulesCodex();
        
    } catch (errorObject) {
        console.error('Error importing JSON:', errorObject);
        alert('Error parsing JSON file. Make sure it is formatted correctly.');
        document.body.style.cursor = '';
        changeEvent.target.value = '';
    }
};


function openNewRuleModal(editRuleId = null) {
  // Look up the rule modal and its form input elements in the DOM by their IDs
  const modalElement = document.getElementById('newRuleModal');
  if (!modalElement) return;
  const modalTitleElement = document.getElementById('ruleModalTitle');
  const idInputElement = document.getElementById('ruleEditId');
  const titleInputElement = document.getElementById('ruleTitleInput');
  const parentSelectElement = document.getElementById('ruleParentSelect');
  if (parentSelectElement && typeof allRules !== 'undefined') {
    parentSelectElement.innerHTML = '<option value="">-- No Parent (Top Level) --</option>';
    allRules.forEach(ruleEntry => {
      if (ruleEntry.id !== editRuleId) {
        // Create a new <option> element in memory for each potential parent rule
        const optionElement = document.createElement('option');
        optionElement.value = ruleEntry.id;
        optionElement.innerText = ruleEntry.title;
        parentSelectElement.appendChild(optionElement);
      }
    });
  }
  const contentInputElement = document.getElementById('ruleContentInput');
  const tagsInputElement = document.getElementById('ruleTagsInput');
  if (editRuleId) {
    const existingRuleEntry = allRules.find(ruleEntry => ruleEntry.id === editRuleId);
    if (existingRuleEntry) {
      if (modalTitleElement) modalTitleElement.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Codex Article';
      if (idInputElement) idInputElement.value = existingRuleEntry.id;
      if (titleInputElement) titleInputElement.value = existingRuleEntry.title || '';
      if (parentSelectElement) parentSelectElement.value = existingRuleEntry.parent_id || '';
      if (contentInputElement) contentInputElement.value = existingRuleEntry.content || '';
      if (tagsInputElement) tagsInputElement.value = existingRuleEntry.tags || '';
    }
  } else {
    if (modalTitleElement) modalTitleElement.innerHTML = '<i class="fa-solid fa-book-medical"></i> Add Codex Article';
    if (idInputElement) idInputElement.value = '';
    if (titleInputElement) titleInputElement.value = '';
    if (parentSelectElement) parentSelectElement.value = '';
    if (contentInputElement) contentInputElement.value = '';
    if (tagsInputElement) tagsInputElement.value = '';
  }
  const pdfInputElement = document.getElementById('rulePdfInput');
  if (pdfInputElement) pdfInputElement.value = '';
  modalElement.classList.add('active');
}

async function saveRuleSubmit() {
  // Look up the rule form input elements in the DOM by their IDs
  const idInputElement = document.getElementById('ruleEditId');
  const ruleId = idInputElement ? idInputElement.value : '';
  const articleTitle = document.getElementById('ruleTitleInput').value.trim();
  const parentSelectElement = document.getElementById('ruleParentSelect');
  const parentRuleId = parentSelectElement && parentSelectElement.value ? Number(parentSelectElement.value) : null;
  const articleContent = document.getElementById('ruleContentInput').value.trim();
  const articleTags = document.getElementById('ruleTagsInput').value.trim();
  if (!articleTitle) {
    // Display a browser alert if the article title is missing
    alert('Article title is required.');
    return;
  }
  const rulePayload = {
    title: articleTitle,
    parent_id: parentRuleId,
    content: articleContent,
    tags: articleTags,
    chronicle_id: typeof activeChronicleId !== 'undefined' ? activeChronicleId : null
  };

  // Look up the optional PDF attachment file input element in the DOM by its ID
  const pdfFileInputElement = document.getElementById('rulePdfInput');
  if (pdfFileInputElement && pdfFileInputElement.files.length > 0) {
      // Create a browser FormData payload to upload the attached PDF file
      const pdfFormData = new FormData();
      pdfFormData.append('file', pdfFileInputElement.files[0]);
      try {
          // Perform an authenticated HTTP POST request to upload the rulebook PDF file
          const uploadResponse = await authFetch('/api/rules/upload_pdf', { method: 'POST', body: pdfFormData });
          const uploadData = await uploadResponse.json();
          if (uploadData.success && uploadData.pdf_url) {
              rulePayload.pdf_url = uploadData.pdf_url;
          } else {
              alert('PDF Upload failed: ' + uploadData.error);
              return;
          }
      } catch (errorObject) {
          alert('Error uploading PDF');
          return;
      }
  }

  try {
    let fetchResponse;
    if (ruleId) {
      // Perform an authenticated HTTP PUT request to update the existing rule article
      fetchResponse = await authFetch(`/api/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rulePayload)
      });
    } else {
      // Perform an authenticated HTTP POST request to create a new rule article
      fetchResponse = await authFetch('/api/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rulePayload)
      });
    }
    const responseData = await fetchResponse.json();
    if (fetchResponse.ok && responseData.success) {
      closeModal('newRuleModal');
      loadRulesCodex();
    } else {
      alert(responseData.error || 'Failed to save rule article.');
    }
  } catch (errorObject) {
    console.error('Error saving rule article:', errorObject);
    alert('Network error saving rule article.');
  }
}

window.toggleMassDeleteMode = function() {
    // Look up the mass delete toolbar element in the DOM by its ID
    const massDeleteToolbarElement = document.getElementById('massDeleteToolbar');
    const isToolbarHidden = (massDeleteToolbarElement.style.display === 'none');
    massDeleteToolbarElement.style.display = isToolbarHidden ? 'flex' : 'none';
    
    // Query all mass-select checkboxes in the rulebook tree to toggle their visibility
    document.querySelectorAll('.rule-mass-select-checkbox').forEach(checkboxElement => {
        checkboxElement.style.display = isToolbarHidden ? 'inline-block' : 'none';
    });
};

window.toggleSelectAllRules = function(isChecked) {
    // Query all mass-select checkboxes in the rulebook tree to set their checked state
    document.querySelectorAll('.rule-mass-select-checkbox').forEach(checkboxElement => {
        checkboxElement.checked = isChecked;
    });
};

window.handleRuleCheckboxChange = function(changedCheckboxElement) {
    const treeItemButtonElement = changedCheckboxElement.closest('.rule-tree-item');
    if (!treeItemButtonElement) return;
    const branchContainerDiv = treeItemButtonElement.parentElement;
    if (!branchContainerDiv) return;
    
    // Query all descendant checkboxes within this branch container and match the parent's checked state
    const childCheckboxElements = branchContainerDiv.querySelectorAll('.rule-mass-select-checkbox');
    childCheckboxElements.forEach(childCheckbox => {
        childCheckbox.checked = changedCheckboxElement.checked;
    });
};

window.openMassDeleteModal = function() {
    // Query all checked rule mass-select checkboxes in the DOM
    const selectedCheckboxElements = document.querySelectorAll('.rule-mass-select-checkbox:checked');
    if (selectedCheckboxElements.length === 0) {
        // Display a browser alert if no articles are selected for deletion
        alert("No articles selected.");
        return;
    }
    // Look up the mass delete count label and modal container in the DOM by their IDs
    document.getElementById('massDeleteCount').innerText = selectedCheckboxElements.length;
    document.getElementById('massDeleteRulesModal').style.display = 'flex';
};

window.executeMassDelete = async function(shouldCascadeDelete) {
    // Query all checked rule mass-select checkboxes in the DOM
    const selectedCheckboxElements = document.querySelectorAll('.rule-mass-select-checkbox:checked');
    if (selectedCheckboxElements.length === 0) return;
    
    // Hide the mass delete confirmation modal in the DOM
    document.getElementById('massDeleteRulesModal').style.display = 'none';
    
    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';
    
    let deletedCount = 0;
    
    for (const checkboxElement of selectedCheckboxElements) {
        const ruleIdToDelete = checkboxElement.getAttribute('data-id');
        try {
            // Perform an authenticated HTTP DELETE request for each selected rule article
            const fetchResponse = await authFetch(`/api/rules/${ruleIdToDelete}${shouldCascadeDelete ? '?cascade=true' : ''}`, {
                method: 'DELETE'
            });
            if (fetchResponse.ok) {
                deletedCount++;
            }
        } catch (errorObject) {
            console.error('Failed to delete rule', ruleIdToDelete, errorObject);
        }
    }
    
    document.body.style.cursor = originalCursor;
    
    // Look up the select-all checkbox and mass delete toolbar in the DOM to reset them
    const selectAllCheckboxElement = document.getElementById('rulebookSelectAll');
    if (selectAllCheckboxElement) selectAllCheckboxElement.checked = false;
    
    // Automatically turn off mass delete mode
    const massDeleteToolbarElement = document.getElementById('massDeleteToolbar');
    if (massDeleteToolbarElement && massDeleteToolbarElement.style.display !== 'none') {
        toggleMassDeleteMode();
    }
    
    // Display a browser alert confirming how many rule articles were deleted
    alert(`Successfully deleted ${deletedCount} selected article(s).`);
    
    if (typeof loadRulesCodex === 'function') {
        loadRulesCodex();
    }
};


async function deleteRuleArticle(ruleId) {
    // Query all rule mass-select checkboxes in the DOM and uncheck them
    document.querySelectorAll('.rule-mass-select-checkbox').forEach(checkboxElement => checkboxElement.checked = false);
    
    // Query the specific checkbox for the rule we want to delete
    const targetCheckboxElement = document.querySelector(`.rule-mass-select-checkbox[data-id="${ruleId}"]`);
    if (targetCheckboxElement) {
        targetCheckboxElement.checked = true;
        openMassDeleteModal();
    } else {
        // Fallback if they are deleting something not in the hierarchy: ask via browser confirm dialogs
        if (!confirm('Are you sure you want to delete this rule article?')) return;
        const shouldCascadeDelete = confirm('Would you also like to delete all sub-articles nested inside this one? (Click OK to delete all contents, or Cancel to only delete this parent and keep the children as orphans)');
        try {
            // Perform an authenticated HTTP DELETE request to delete the rule article
            const fetchResponse = await authFetch(`/api/rules/${ruleId}${shouldCascadeDelete ? '?cascade=true' : ''}`, { method: 'DELETE' });
            if (fetchResponse.ok) loadRulesCodex();
        } catch (errorObject) {
            console.error(errorObject);
        }
    }
}


function renderRulebookHierarchy(rulesToRender, searchTerm = '') {
  // Look up the rulebook hierarchy tree container element in the DOM by its ID
  const hierarchyContainerElement = document.getElementById('rulebookHierarchy');
  if (!hierarchyContainerElement) return;
  hierarchyContainerElement.innerHTML = '';
  const ruleByIdMap = new Map();
  rulesToRender.forEach(ruleEntry => ruleByIdMap.set(ruleEntry.id, ruleEntry));
  const rootRulesList = [];
  const childrenByParentIdMap = new Map();
  rulesToRender.forEach(ruleEntry => {
    if (!ruleEntry.parent_id || !ruleByIdMap.has(ruleEntry.parent_id)) {
      rootRulesList.push(ruleEntry);
    } else {
      if (!childrenByParentIdMap.has(ruleEntry.parent_id)) childrenByParentIdMap.set(ruleEntry.parent_id, []);
      childrenByParentIdMap.get(ruleEntry.parent_id).push(ruleEntry);
    }
  });
function buildNode(ruleEntry, depthLevel = 0) {
  // Create a wrapper <div> and an interactive row <div> in memory for this rule tree node
  const nodeWrapperElement = document.createElement('div');
  nodeWrapperElement.style.marginLeft = depthLevel * 15 + 'px';
  nodeWrapperElement.style.marginBottom = '4px';
  const treeItemElement = document.createElement('div');
  treeItemElement.className = 'rule-tree-item';
  treeItemElement.style.padding = '6px 10px';
  treeItemElement.style.cursor = 'pointer';
  treeItemElement.style.borderRadius = '4px';
  treeItemElement.style.display = 'flex';
  treeItemElement.style.alignItems = 'center';
  treeItemElement.style.fontSize = '14px';
  treeItemElement.style.color = '#e2e8f0';
  treeItemElement.style.transition = 'background 0.2s';
  treeItemElement.onmouseover = () => treeItemElement.style.background = 'rgba(255,255,255,0.05)';
  treeItemElement.onmouseout = () => treeItemElement.style.background = 'transparent';

  const isStorytellerOrGm = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller' || (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'gm');
  if (isStorytellerOrGm && !searchTerm) {
      treeItemElement.draggable = true;
      treeItemElement.dataset.ruleId = ruleEntry.id;
      treeItemElement.ondragstart = (dragEvent) => {
          dragEvent.dataTransfer.setData('text/plain', ruleEntry.id);
          dragEvent.dataTransfer.effectAllowed = 'move';
          setTimeout(() => treeItemElement.style.opacity = '0.5', 0);
      };
      treeItemElement.ondragend = (dragEvent) => {
          treeItemElement.style.opacity = '1';
          // Query all rule tree items in the DOM to clear drag-over border indicators
          document.querySelectorAll('.rule-tree-item').forEach(itemElement => {
              itemElement.style.border = ''; itemElement.style.borderBottom = ''; itemElement.style.borderTop = '';
          });
      };
      treeItemElement.ondragover = (dragEvent) => {
          dragEvent.preventDefault(); dragEvent.stopPropagation();
          // Query all rule tree items in the DOM to clear previous drag-over borders
          document.querySelectorAll('.rule-tree-item').forEach(itemElement => {
              itemElement.style.border = ''; itemElement.style.borderBottom = ''; itemElement.style.borderTop = '';
          });
          // Measure the tree item's bounding rectangle in the viewport to determine drop placement
          const itemBoundingRect = treeItemElement.getBoundingClientRect();
          const mouseOffsetY = dragEvent.clientY - itemBoundingRect.top;
          if (mouseOffsetY < itemBoundingRect.height * 0.25) {
              treeItemElement.style.borderTop = '2px solid #a855f7';
          } else if (mouseOffsetY > itemBoundingRect.height * 0.75) {
              treeItemElement.style.borderBottom = '2px solid #a855f7';
          } else {
              treeItemElement.style.border = '2px dashed #a855f7';
          }
      };
      treeItemElement.ondragleave = (dragEvent) => {
          treeItemElement.style.border = ''; treeItemElement.style.borderBottom = ''; treeItemElement.style.borderTop = '';
      };
      treeItemElement.ondrop = async (dropEvent) => {
          dropEvent.preventDefault(); dropEvent.stopPropagation();
          treeItemElement.style.border = ''; treeItemElement.style.borderBottom = ''; treeItemElement.style.borderTop = '';
          const draggedRuleId = Number(dropEvent.dataTransfer.getData('text/plain'));
          if (!draggedRuleId || draggedRuleId == ruleEntry.id) return;
          // Measure the tree item's bounding rectangle in the viewport to determine whether to drop before, after, or as a child
          const itemBoundingRect = treeItemElement.getBoundingClientRect();
          const mouseOffsetY = dropEvent.clientY - itemBoundingRect.top;
          
          let newParentId = null;
          let insertMode = 'child';
          if (mouseOffsetY < itemBoundingRect.height * 0.25) {
              newParentId = ruleEntry.parent_id || null;
              insertMode = 'before';
          } else if (mouseOffsetY > itemBoundingRect.height * 0.75) {
              newParentId = ruleEntry.parent_id || null;
              insertMode = 'after';
          } else {
              newParentId = ruleEntry.id;
          }
          
          const draggedRuleEntry = allRules.find(candidateRule => candidateRule.id === draggedRuleId);
          if (!draggedRuleEntry) return;
          
          draggedRuleEntry.parent_id = newParentId;
          
          let siblingRulesList = allRules.filter(candidateRule => candidateRule.parent_id == newParentId && candidateRule.id !== draggedRuleId);
          siblingRulesList.sort((firstRule, secondRule) => (firstRule.sort_order || 0) - (secondRule.sort_order || 0));
          
          if (insertMode === 'child') {
              siblingRulesList.push(draggedRuleEntry);
          } else {
              const targetSiblingIndex = siblingRulesList.findIndex(candidateRule => candidateRule.id === ruleEntry.id);
              if (targetSiblingIndex !== -1) {
                  siblingRulesList.splice(insertMode === 'before' ? targetSiblingIndex : targetSiblingIndex + 1, 0, draggedRuleEntry);
              } else {
                  siblingRulesList.push(draggedRuleEntry);
              }
          }
          
          const reorderUpdates = siblingRulesList.map((siblingRule, sortOrderIndex) => ({ id: siblingRule.id, parent_id: newParentId, sort_order: sortOrderIndex }));
          
          try {
              // Perform an authenticated HTTP PUT request to persist the reordered rule hierarchy
              const fetchResponse = await authFetch('/api/rules/reorder', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ updates: reorderUpdates })
              });
              if (fetchResponse.ok) loadRulesCodex();
          } catch (errorObject) { console.error(errorObject); }
      };
  }

  const childRulesList = childrenByParentIdMap.get(ruleEntry.id) || [];
  const hasChildren = childRulesList.length > 0;
  // Separate the toggle and the title
  let isSearchMatch = false;
  if (searchTerm) {
      isSearchMatch = ruleEntry.title.toLowerCase().includes(searchTerm) || 
                (ruleEntry.content && ruleEntry.content.replace(/<[^>]*>?/gm, '').toLowerCase().includes(searchTerm)) || 
                (ruleEntry.tags && ruleEntry.tags.toLowerCase().includes(searchTerm));
  }
  const matchHighlightStyle = isSearchMatch ? 'color: #ef4444; font-weight: bold;' : '';
  const iconColorHex = isSearchMatch ? '#ef4444' : '#6b7280';
  
  // Look up the mass delete toolbar in the DOM to check if mass-select checkboxes should be shown
  const massDeleteToolbarElement = document.getElementById('massDeleteToolbar');
  const isMassDeleteActive = massDeleteToolbarElement && massDeleteToolbarElement.style.display === 'flex';
  
  treeItemElement.innerHTML = `
            ${isStorytellerOrGm ? `<input type="checkbox" class="rule-mass-select-checkbox gm-only-control" data-id="${ruleEntry.id}" style="margin-right: 8px; cursor: pointer; display: ${isMassDeleteActive ? 'inline-block' : 'none'};" onclick="event.stopPropagation()" onchange="handleRuleCheckboxChange(this)">` : ''}
            <span style="flex:1; display:flex; align-items:center; ${matchHighlightStyle}" class="rule-title-clicker">
                <span style="width: 16px; display: inline-block; text-align: center; margin-right: 6px;">
                    <i class="fa-solid fa-file-lines" style="font-size:10px; color:${iconColorHex};"></i>
                </span>
                ${escapeHtml(ruleEntry.title)}
            </span>
            ${hasChildren ? '<span class="rule-toggle-clicker" style="padding:4px; margin-left:6px;"><i class="fa-solid fa-plus" style="font-size:12px; color:#9ca3af;"></i></span>' : ''}
        `;
  
  // Create a <div> container in memory to hold nested child rule nodes
  const childrenContainerElement = document.createElement('div');
  childrenContainerElement.style.display = 'none';
  
  // Query the clickable title and expand/collapse toggle spans inside the tree item element
  const titleClickerElement = treeItemElement.querySelector('.rule-title-clicker');
  if (titleClickerElement) {
      titleClickerElement.onclick = (mouseEvent) => {
          mouseEvent.stopPropagation();
          openRuleArticle(ruleEntry);
      };
  }

  const toggleClickerElement = treeItemElement.querySelector('.rule-toggle-clicker');
  if (toggleClickerElement && hasChildren) {
      toggleClickerElement.onclick = (mouseEvent) => {
          mouseEvent.stopPropagation();
          const isCurrentlyHidden = childrenContainerElement.style.display === 'none';
          childrenContainerElement.style.display = isCurrentlyHidden ? 'block' : 'none';
          const toggleIconElement = toggleClickerElement.querySelector('i');
          if (toggleIconElement) toggleIconElement.className = isCurrentlyHidden ? 'fa-solid fa-minus' : 'fa-solid fa-plus';
      };
  }
  nodeWrapperElement.appendChild(treeItemElement);
  if (hasChildren) {
    childRulesList.sort((firstChild, secondChild) => (firstChild.sort_order || 0) - (secondChild.sort_order || 0)).forEach(childRuleEntry => childrenContainerElement.appendChild(buildNode(childRuleEntry, depthLevel + 1)));
    nodeWrapperElement.appendChild(childrenContainerElement);
  }
  return nodeWrapperElement;
}

  rootRulesList.sort((firstRoot, secondRoot) => (firstRoot.sort_order || 0) - (secondRoot.sort_order || 0)).forEach(rootRuleEntry => hierarchyContainerElement.appendChild(buildNode(rootRuleEntry, 0)));
  if (rulesToRender.length === 0) hierarchyContainerElement.innerHTML = '<div style="color:#6b7280; font-style:italic; font-size:13px; padding:10px;">No articles found.</div>';

  if (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller' || (typeof currentUser !== 'undefined' && currentUser && currentUser.role === 'gm')) {
      if (!searchTerm) {
          hierarchyContainerElement.ondragover = (dragEvent) => { dragEvent.preventDefault(); };
          hierarchyContainerElement.ondrop = async (dropEvent) => {
              dropEvent.preventDefault();
              if (dropEvent.target !== hierarchyContainerElement && dropEvent.target.id !== 'rulebookHierarchy') return;
              const draggedRuleId = Number(dropEvent.dataTransfer.getData('text/plain'));
              if (!draggedRuleId) return;
              
              const draggedRuleEntry = allRules.find(candidateRule => candidateRule.id === draggedRuleId);
              if (!draggedRuleEntry) return;
              draggedRuleEntry.parent_id = null;
              
              let rootSiblingRules = allRules.filter(candidateRule => candidateRule.parent_id == null && candidateRule.id !== draggedRuleId);
              rootSiblingRules.sort((firstRule, secondRule) => (firstRule.sort_order || 0) - (secondRule.sort_order || 0));
              rootSiblingRules.push(draggedRuleEntry);
              
              const reorderUpdates = rootSiblingRules.map((siblingRule, sortOrderIndex) => ({ id: siblingRule.id, parent_id: null, sort_order: sortOrderIndex }));
              
              try {
                  // Perform an authenticated HTTP PUT request to move the dropped rule article to the top level
                  const fetchResponse = await authFetch('/api/rules/reorder', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ updates: reorderUpdates })
                  });
                  if (fetchResponse.ok) loadRulesCodex();
              } catch (errorObject) {}
          };
      }
  }
}


function openRuleArticle(ruleEntry) {
  // Look up the rulebook article view panel element in the DOM by its ID
  const contentPanelElement = document.getElementById('rulebookArticleView');
  if (!contentPanelElement) return;
  const isStorytellerOrGm = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller' || currentUser && currentUser.role === 'gm';
  contentPanelElement.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px; border-bottom: 1px solid #2a2a35; padding-bottom: 15px;">
            <div>
                <h1 style="margin:0 0 10px 0; font-family:'Cinzel',serif; color:#f8fafc; font-size:28px;">${escapeHtml(ruleEntry.title)}</h1>
                ${ruleEntry.tags ? `<div style="font-size:12px; color:#a855f7;"><i class="fa-solid fa-tags"></i> ${escapeHtml(ruleEntry.tags)}</div>` : ''}
            </div>
            ${isStorytellerOrGm ? `<div style="display:flex; gap:10px;"><button class="btn-action" onclick="inlineEditRuleArticle(${ruleEntry.id})" style="padding:6px 12px; font-size:12px;"><i class="fa-solid fa-pen"></i> Edit</button><button class="btn-action-outline text-danger" onclick="deleteRuleArticle(${ruleEntry.id})" style="padding:6px 12px; font-size:12px; border-color:#ef4444; color:#ef4444;"><i class="fa-solid fa-trash"></i> Delete</button></div>` : ''}
        </div>
        <div class="rule-content" style="line-height:1.6; font-size:15px; color:#d1d5db;">
            ${ruleEntry.pdf_url ? `<button class="btn-action" onclick="openPdfViewer('${ruleEntry.pdf_url}')" style="margin-bottom: 20px;"><i class="fa-solid fa-file-pdf"></i> Read Rulebook PDF</button>` : ''}
            ${(ruleEntry.content && (ruleEntry.content.includes('<p>') || ruleEntry.content.includes('<br>'))) ? ruleEntry.content : formatLineBreaks(ruleEntry.content)}
        </div>
    `;
}


// --- WIDGET RULEBOOK LOGIC ---
function filterWidgetRulebook() {
    // Look up the quick-rules widget search input element in the DOM by its ID
    const searchQueryTerm = document.getElementById('widgetRulebookSearchInput').value.toLowerCase();
    
    let filteredRulesList = allRules;
    if (searchQueryTerm) {
        filteredRulesList = filteredRulesList.filter(ruleEntry => 
            ruleEntry.title.toLowerCase().includes(searchQueryTerm) ||
            (ruleEntry.content && ruleEntry.content.replace(/<[^>]*>?/gm, '').toLowerCase().includes(searchQueryTerm)) ||
            (ruleEntry.tags && ruleEntry.tags.toLowerCase().includes(searchQueryTerm))
        );
        
        const rulesWithAncestorsSet = new Set();
        const ruleByIdMap = new Map();
        allRules.forEach(ruleEntry => ruleByIdMap.set(ruleEntry.id, ruleEntry));
        
        function addWithParents(ruleEntry) {
            if (!ruleEntry) return;
            rulesWithAncestorsSet.add(ruleEntry);
            if (ruleEntry.parent_id && ruleByIdMap.has(ruleEntry.parent_id)) {
                addWithParents(ruleByIdMap.get(ruleEntry.parent_id));
            }
        }
        
        filteredRulesList.forEach(ruleEntry => addWithParents(ruleEntry));
        filteredRulesList = Array.from(rulesWithAncestorsSet);
    }
    
    if (typeof renderWidgetRulebookHierarchy === 'function') {
        renderWidgetRulebookHierarchy(filteredRulesList, searchQueryTerm);
    }
    
    if (searchQueryTerm) {
        // Query all collapsed child containers in the widget rulebook hierarchy to expand them during search
        const hiddenBranchContainers = document.querySelectorAll('#widgetRulebookHierarchy div[style*="display: none"]');
        hiddenBranchContainers.forEach(branchContainer => branchContainer.style.display = 'block');
    }
}

function renderWidgetRulebookHierarchy(rulesToRender, searchTerm = '') {
  // Look up the widget rulebook hierarchy container element in the DOM by its ID
  const hierarchyContainerElement = document.getElementById('widgetRulebookHierarchy');
  if (!hierarchyContainerElement) return;
  hierarchyContainerElement.innerHTML = '';
  const ruleByIdMap = new Map();
  rulesToRender.forEach(ruleEntry => ruleByIdMap.set(ruleEntry.id, ruleEntry));
  const rootRulesList = [];
  const childrenByParentIdMap = new Map();
  rulesToRender.forEach(ruleEntry => {
    if (!ruleEntry.parent_id || !ruleByIdMap.has(ruleEntry.parent_id)) {
      rootRulesList.push(ruleEntry);
    } else {
      if (!childrenByParentIdMap.has(ruleEntry.parent_id)) childrenByParentIdMap.set(ruleEntry.parent_id, []);
      childrenByParentIdMap.get(ruleEntry.parent_id).push(ruleEntry);
    }
  });

  function buildNode(ruleEntry, depthLevel = 0) {
    // Create a wrapper <div> and an interactive row <div> in memory for this widget rule tree node
    const nodeWrapperElement = document.createElement('div');
    nodeWrapperElement.style.marginLeft = depthLevel * 15 + 'px';
    nodeWrapperElement.style.marginBottom = '4px';
    const treeItemElement = document.createElement('div');
    treeItemElement.className = 'rule-tree-item';
    treeItemElement.style.padding = '6px 10px';
    treeItemElement.style.cursor = 'pointer';
    treeItemElement.style.borderRadius = '4px';
    treeItemElement.style.display = 'flex';
    treeItemElement.style.alignItems = 'center';
    treeItemElement.style.fontSize = '14px';
    treeItemElement.style.color = '#e2e8f0';
    treeItemElement.style.transition = 'background 0.2s';
    treeItemElement.onmouseover = () => treeItemElement.style.background = 'rgba(255,255,255,0.05)';
    treeItemElement.onmouseout = () => treeItemElement.style.background = 'transparent';
    const childRulesList = childrenByParentIdMap.get(ruleEntry.id) || [];
    const hasChildren = childRulesList.length > 0;
    
    let isSearchMatch = false;
    if (searchTerm) {
        isSearchMatch = ruleEntry.title.toLowerCase().includes(searchTerm) || 
                  (ruleEntry.content && ruleEntry.content.replace(/<[^>]*>?/gm, '').toLowerCase().includes(searchTerm)) || 
                  (ruleEntry.tags && ruleEntry.tags.toLowerCase().includes(searchTerm));
    }
    const matchHighlightStyle = isSearchMatch ? 'color: #ef4444; font-weight: bold;' : '';
    const iconColorHex = isSearchMatch ? '#ef4444' : '#6b7280';
    
    treeItemElement.innerHTML = `
        <span style="flex:1; display:flex; align-items:center; ${matchHighlightStyle}" class="rule-title-clicker">
            <span style="width: 16px; display: inline-block; text-align: center; margin-right: 6px;">
                <i class="fa-solid fa-file-lines" style="font-size:10px; color:${iconColorHex};"></i>
            </span>
            ${escapeHtml(ruleEntry.title)}
        </span>
        ${hasChildren ? '<span class="rule-toggle-clicker" style="padding:4px; margin-left:6px;"><i class="fa-solid fa-plus" style="font-size:12px; color:#9ca3af;"></i></span>' : ''}
    `;
    
    // Create a <div> container in memory to hold nested child rule nodes
    const childrenContainerElement = document.createElement('div');
    childrenContainerElement.style.display = 'none';
    
    // Query the clickable title and expand/collapse toggle spans inside the tree item element
    const titleClickerElement = treeItemElement.querySelector('.rule-title-clicker');
    if (titleClickerElement) {
        titleClickerElement.onclick = (mouseEvent) => {
            mouseEvent.stopPropagation();
            openWidgetRuleArticle(ruleEntry);
        };
    }

    const toggleClickerElement = treeItemElement.querySelector('.rule-toggle-clicker');
    if (toggleClickerElement && hasChildren) {
        toggleClickerElement.onclick = (mouseEvent) => {
            mouseEvent.stopPropagation();
            const isCurrentlyHidden = childrenContainerElement.style.display === 'none';
            childrenContainerElement.style.display = isCurrentlyHidden ? 'block' : 'none';
            const toggleIconElement = toggleClickerElement.querySelector('i');
            if (toggleIconElement) toggleIconElement.className = isCurrentlyHidden ? 'fa-solid fa-minus' : 'fa-solid fa-plus';
        };
    }
    nodeWrapperElement.appendChild(treeItemElement);
    if (hasChildren) {
      childRulesList.sort((firstChild, secondChild) => (firstChild.sort_order || 0) - (secondChild.sort_order || 0)).forEach(childRuleEntry => childrenContainerElement.appendChild(buildNode(childRuleEntry, depthLevel + 1)));
      nodeWrapperElement.appendChild(childrenContainerElement);
    }
    return nodeWrapperElement;
  }

  rootRulesList.sort((firstRoot, secondRoot) => (firstRoot.sort_order || 0) - (secondRoot.sort_order || 0)).forEach(rootRuleEntry => hierarchyContainerElement.appendChild(buildNode(rootRuleEntry, 0)));
  if (rulesToRender.length === 0) hierarchyContainerElement.innerHTML = '<div style="color:#6b7280; font-style:italic; font-size:13px; padding:10px;">No articles found.</div>';
}

function openWidgetRuleArticle(ruleEntry) {
  // Look up the widget rulebook article view panel element in the DOM by its ID
  const contentPanelElement = document.getElementById('widgetRulebookArticleView');
  if (!contentPanelElement) return;
  const isStorytellerOrGm = activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller' || currentUser && currentUser.role === 'gm';
  contentPanelElement.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px; border-bottom: 1px solid #2a2a35; padding-bottom: 15px;">
            <div>
                <h1 style="margin:0 0 10px 0; font-family:'Cinzel',serif; color:#f8fafc; font-size:28px;">${escapeHtml(ruleEntry.title)}</h1>
                ${ruleEntry.tags ? `<div style="font-size:12px; color:#a855f7;"><i class="fa-solid fa-tags"></i> ${escapeHtml(ruleEntry.tags)}</div>` : ''}
            </div>
            ${isStorytellerOrGm ? `<div style="display:flex; gap:10px;"><button class="btn-action" onclick="inlineEditRuleArticle(${ruleEntry.id})" style="padding:6px 12px; font-size:12px;"><i class="fa-solid fa-pen"></i> Edit</button><button class="btn-action-outline text-danger" onclick="deleteRuleArticle(${ruleEntry.id})" style="padding:6px 12px; font-size:12px; border-color:#ef4444; color:#ef4444;"><i class="fa-solid fa-trash"></i> Delete</button></div>` : ''}
        </div>
        <div class="rule-content" style="line-height:1.6; font-size:15px; color:#d1d5db;">
            ${ruleEntry.pdf_url ? `<button class="btn-action" onclick="openPdfViewer('${ruleEntry.pdf_url}')" style="margin-bottom: 20px;"><i class="fa-solid fa-file-pdf"></i> Read Rulebook PDF</button>` : ''}
            ${(ruleEntry.content && (ruleEntry.content.includes('<p>') || ruleEntry.content.includes('<br>'))) ? ruleEntry.content : formatLineBreaks(ruleEntry.content)}
        </div>
    `;
}
// --- END WIDGET RULEBOOK LOGIC ---


function filterRulebook() {
    // Look up the main rulebook search input element in the DOM by its ID
    const searchQueryTerm = document.getElementById('rulebookSearchInput').value.toLowerCase();
    
    let filteredRulesList = allRules;
    if (searchQueryTerm) {
        filteredRulesList = filteredRulesList.filter(ruleEntry => 
            ruleEntry.title.toLowerCase().includes(searchQueryTerm) ||
            (ruleEntry.content && ruleEntry.content.replace(/<[^>]*>?/gm, '').toLowerCase().includes(searchQueryTerm)) ||
            (ruleEntry.tags && ruleEntry.tags.toLowerCase().includes(searchQueryTerm))
        );
        
        const rulesWithAncestorsSet = new Set();
        const ruleByIdMap = new Map();
        allRules.forEach(ruleEntry => ruleByIdMap.set(ruleEntry.id, ruleEntry));
        
        function addWithParents(ruleEntry) {
            if (!ruleEntry) return;
            rulesWithAncestorsSet.add(ruleEntry);
            if (ruleEntry.parent_id && ruleByIdMap.has(ruleEntry.parent_id)) {
                addWithParents(ruleByIdMap.get(ruleEntry.parent_id));
            }
        }
        
        filteredRulesList.forEach(ruleEntry => addWithParents(ruleEntry));
        filteredRulesList = Array.from(rulesWithAncestorsSet);
    }
    
    if (typeof renderRulebookHierarchy === 'function') {
        renderRulebookHierarchy(filteredRulesList, searchQueryTerm);
    }
    
    if (searchQueryTerm) {
        // Query all collapsed containers and plus icons in the rulebook hierarchy to expand them for search results
        const hiddenBranchContainers = document.querySelectorAll('#rulebookHierarchy div[style*="display: none"]');
        hiddenBranchContainers.forEach(branchContainer => branchContainer.style.display = 'block');
        const expandIcons = document.querySelectorAll('#rulebookHierarchy .fa-plus');
        expandIcons.forEach(iconElement => iconElement.className = 'fa-solid fa-minus');
    }
}


async function loadRulesCodex() {
    try {
        let fetchUrl = '/api/rules/search?q=';
        if (typeof activeChronicleId !== 'undefined' && activeChronicleId) {
            fetchUrl += `&chronicleId=${activeChronicleId}`;
        }
        // Perform an authenticated HTTP GET request to load all rulebook codex articles
        const fetchResponse = await authFetch(fetchUrl);
        allRules = await fetchResponse.json();
        filterRulesByCategory(activeRuleCategory);
    } catch (errorObject) {
        console.error('Failed to load rules codex:', errorObject);
    }
}


window.editRuleArticle = function(ruleId) {
    openNewRuleModal(ruleId);
};


window.inlineEditRuleArticle = async function(ruleId) {
    const targetRuleEntry = allRules.find(ruleEntry => ruleEntry.id === ruleId);
    if (!targetRuleEntry) return;
    
    // Look up the rulebook article view container element in the DOM by its ID
    const contentPanelElement = document.getElementById('rulebookArticleView');
    if (!contentPanelElement) return;

    let parentOptionsHtml = '<option value="">-- No Parent (Top Level) --</option>';
    allRules.forEach(ruleEntry => {
        if (ruleEntry.id !== ruleId) {
            const selectedAttribute = (targetRuleEntry.parent_id === ruleEntry.id) ? 'selected' : '';
            parentOptionsHtml += `<option value="${ruleEntry.id}" ${selectedAttribute}>${escapeHtml(ruleEntry.title)}</option>`;
        }
    });

    contentPanelElement.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px; border-bottom: 1px solid #2a2a35; padding-bottom: 15px;">
            <div style="flex:1; margin-right:20px;">
                <input type="text" id="inlineRuleTitle" class="vtm-input" value="${escapeHtml(targetRuleEntry.title)}" style="width:100%; font-family:'Cinzel',serif; font-size:24px; font-weight:bold; margin-bottom:10px; background:rgba(0,0,0,0.4);" placeholder="Article Title">
                <input type="text" id="inlineRuleTags" class="vtm-input" value="${escapeHtml(targetRuleEntry.tags || '')}" style="width:100%; font-size:12px; color:#a855f7; margin-bottom:10px; background:rgba(0,0,0,0.4);" placeholder="Tags (comma separated)">
                
                <div style="display:flex; align-items:center; gap:10px;">
                    <label style="font-size:12px; color:#9ca3af; text-transform:uppercase;">Parent Article:</label>
                    <select id="inlineRuleParent" class="vtm-input" style="background:rgba(0,0,0,0.4); font-size:12px;">
                        ${parentOptionsHtml}
                    </select>
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-shrink:0;">
                <button class="btn-action-outline" onclick="if(typeof tinymce !== 'undefined') tinymce.remove('#inlineRuleContent'); openRuleArticle(allRules.find(r => r.id === ${targetRuleEntry.id}))" style="padding:6px 12px; font-size:12px;">Cancel</button>
                <button class="btn-action" onclick="saveInlineRuleArticle(${targetRuleEntry.id})" style="padding:6px 12px; font-size:12px;"><i class="fa-solid fa-save"></i> Save</button>
            </div>
        </div>
        <div class="rule-content" style="flex: 1; display: flex; flex-direction: column;">
            <textarea id="inlineRuleContent" class="vtm-input" style="width:100%; height:100%; font-size:15px; color:#d1d5db; line-height:1.6; resize:none; background:rgba(0,0,0,0.2); border: 1px solid #3f3f46; border-radius:4px; padding:15px; font-family:inherit;" placeholder="Write article content here...">${escapeHtml(targetRuleEntry.content || '')}</textarea>
        </div>
        <div style="margin-top:15px; display:flex; justify-content:flex-end;">
            <button class="btn-action-outline text-danger" onclick="deleteRuleArticle(${targetRuleEntry.id})" style="border-color:#ef4444; color:#ef4444;"><i class="fa-solid fa-trash"></i> Delete Article</button>
        

</div>
    `;

    // Initialize TinyMCE rich-text editor
    setTimeout(async () => {
        let dynamicImageList = [];
        try {
            // Fetch the list of available gallery images for TinyMCE using the browser fetch API
            const galleryFetchResponse = await fetch('/api/tinymce-gallery');
            dynamicImageList = await galleryFetchResponse.json();
        } catch(errorObject) { console.error('Failed to load gallery', errorObject); }

        if (typeof tinymce !== 'undefined') {
            // Initialize the third-party TinyMCE WYSIWYG rich-text editor on the #inlineRuleContent textarea
            tinymce.init({
                selector: '#inlineRuleContent',
                min_height: 500, height: 600, autoresize_bottom_margin: 50,
                menubar: false,
                plugins: 'image link lists table',
                toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image table | removeformat',
                skin: 'oxide-dark',
                content_css: 'dark',
                content_style: 'html { background-color: #1e1e24 !important; } body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 15px; color: #e2e8f0; background-color: #1e1e24 !important; } img { max-width: 100%; height: auto; }',
                image_list: dynamicImageList, automatic_uploads: true,
                paste_data_images: true,
                image_title: true,
                file_picker_types: 'image',
                file_picker_callback: function (pickerCallback, currentValue, pickerMeta) {
                    // Look up the Asset Picker modal in the DOM to temporarily boost its z-index above TinyMCE dialogs
                    const pickerModalElement = document.getElementById('assetPickerModal');
                    if (pickerModalElement) {
                        const originalZIndex = pickerModalElement.style.zIndex;
                        
                        pickerModalElement.style.setProperty('z-index', '200000000', 'important');
                        // Query all TinyMCE auxiliary overlay elements in the DOM to temporarily hide them while the asset picker is open
                        document.querySelectorAll('.tox-tinymce-aux').forEach(auxOverlayElement => {
                            auxOverlayElement.dataset.oldVis = auxOverlayElement.style.visibility;
                            auxOverlayElement.style.setProperty('visibility', 'hidden', 'important');
                        });

                        openAssetPicker(selectedAssetUrl => {
                            
                            pickerModalElement.style.removeProperty('z-index');
                            // Restore visibility on all TinyMCE auxiliary overlay elements in the DOM
                            document.querySelectorAll('.tox-tinymce-aux').forEach(auxOverlayElement => {
                                auxOverlayElement.style.visibility = auxOverlayElement.dataset.oldVis || '';
                            });

                            pickerCallback(selectedAssetUrl, { title: selectedAssetUrl.split('/').pop() });
                        });
                        
                        // Also restore z-index if they cancel the modal without selecting
                        const cancelButtonElement = pickerModalElement.querySelector('.btn-close-modal');
                        if (cancelButtonElement) {
                            const previousClickHandler = cancelButtonElement.onclick;
                            cancelButtonElement.onclick = function(mouseEvent) {
                                
                            pickerModalElement.style.removeProperty('z-index');
                            document.querySelectorAll('.tox-tinymce-aux').forEach(auxOverlayElement => {
                                auxOverlayElement.style.visibility = auxOverlayElement.dataset.oldVis || '';
                            });

                                if (previousClickHandler) previousClickHandler.call(this, mouseEvent);
                            };
                        }
                    } else {
                        // Fallback to OS file picker by creating a temporary hidden file <input> element in the DOM
                        const fileInputElement = document.createElement('input');
                        fileInputElement.setAttribute('type', 'file');
                        fileInputElement.setAttribute('accept', 'image/*');
                        fileInputElement.style.position = 'absolute'; fileInputElement.style.top = '-9999px';
                        document.body.appendChild(fileInputElement);
                        fileInputElement.onchange = function () {
                            document.body.removeChild(fileInputElement);
                            const selectedFile = this.files[0];
                            // Instantiate a browser FileReader to read the selected local image into TinyMCE's blob cache
                            const fileReader = new FileReader();
                            fileReader.onload = function () {
                                const blobId = 'blobid' + (new Date()).getTime();
                                const blobCache = tinymce.activeEditor.editorUpload.blobCache;
                                const base64String = fileReader.result.split(',')[1];
                                const blobInfo = blobCache.create(blobId, selectedFile, base64String);
                                blobCache.add(blobInfo);
                                pickerCallback(blobInfo.blobUri(), { title: selectedFile.name });
                            };
                            fileReader.readAsDataURL(selectedFile);
                        };
                        fileInputElement.click();
                    }
                },
                images_upload_handler: function (blobInfo, uploadProgress) {
                    return new Promise((resolve, reject) => {
                        try {
                            const base64DataUrl = 'data:' + blobInfo.blob().type + ';base64,' + blobInfo.base64();
                            // Upload the pasted or selected image blob to the server via the browser fetch API
                            fetch('/api/upload', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ data: base64DataUrl, filename: blobInfo.filename() })
                            })
                            .then(fetchResponse => fetchResponse.json())
                            .then(uploadResult => {
                                if (uploadResult.success && uploadResult.url) {
                                    resolve(uploadResult.url);
                                } else {
                                    reject(uploadResult.error || 'Upload failed');
                                }
                            })
                            .catch(errorObject => reject('HTTP Error: ' + errorObject.message));
                        } catch (errorObject) {
                            reject('Handler error: ' + errorObject.message);
                        }
                    });
                }
            });
        }
    }, 50);
};

window.saveInlineRuleArticle = async function(ruleId) {
    // Look up the inline rule title and tags input elements in the DOM by their IDs
    const articleTitle = document.getElementById('inlineRuleTitle').value.trim();
    const articleTags = document.getElementById('inlineRuleTags').value.trim();
    let articleContent = '';
    if (typeof tinymce !== 'undefined' && tinymce.get('inlineRuleContent')) {
        // Retrieve the edited HTML content from the active TinyMCE editor instance
        articleContent = tinymce.get('inlineRuleContent').getContent();
    } else {
        articleContent = document.getElementById('inlineRuleContent').value.trim();
    }
    const parentSelectElement = document.getElementById('inlineRuleParent');
    const parentRuleId = parentSelectElement && parentSelectElement.value ? Number(parentSelectElement.value) : null;

    if (!articleTitle || !articleContent) {
        // Display a browser alert if title or content is missing
        alert('Title and Content are required.');
        return;
    }

    try {
        // Perform an authenticated HTTP PUT request to save the inline-edited rule article
        const fetchResponse = await authFetch('/api/rules/' + ruleId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: articleTitle, tags: articleTags, content: articleContent, parent_id: parentRuleId })
        });
        const responseData = await fetchResponse.json();
        if (fetchResponse.ok && responseData.success) {
            // Update local cache manually or just reload
            const matchingRuleEntry = allRules.find(ruleEntry => ruleEntry.id === ruleId);
            if (matchingRuleEntry) {
                matchingRuleEntry.title = articleTitle;
                matchingRuleEntry.tags = articleTags;
                matchingRuleEntry.content = articleContent;
                matchingRuleEntry.parent_id = parentRuleId;
            }
            // Destroy the TinyMCE editor instance before re-rendering the article view
            if (typeof tinymce !== 'undefined') tinymce.remove('#inlineRuleContent');
            
            // Re-render UI
            openRuleArticle(matchingRuleEntry);
            
            // Filter handles rebuilding the sidebar
            if (typeof filterRulesByCategory === 'function') {
                filterRulesByCategory(activeRuleCategory);
            }
        } else {
            alert(responseData.error || 'Failed to save article.');
        }
    } catch(errorObject) {
        console.error(errorObject);
        alert('Network error saving article.');
    }
};


// ==========================================
// PERSONAL NOTES LOGIC
// ==========================================
let personalNotes = [];
let activeNoteId = null;

async function loadPersonalNotes() {
    if (!activeChronicleId) return;
    try {
        const requestUrl = activeSubCampaignId 
            ? `/api/notes?chronicle_id=${activeChronicleId}&campaign_id=${activeSubCampaignId}`
            : `/api/notes?chronicle_id=${activeChronicleId}`;
        
        // Perform an authenticated HTTP GET request to fetch the user's personal notes for this chronicle
        const fetchResponse = await authFetch(requestUrl);
        if (fetchResponse.ok) {
            personalNotes = await fetchResponse.json();
            renderPersonalNotesList();
            
            // Auto-select first note if none selected
            if (personalNotes.length > 0 && !activeNoteId) {
                selectPersonalNote(personalNotes[0].id);
            } else if (personalNotes.length === 0) {
                activeNoteId = null;
                renderPersonalNoteEditor();
            } else if (activeNoteId) {
                // Ensure active still exists
                const stillExists = personalNotes.find(noteRecord => noteRecord.id === activeNoteId);
                if (!stillExists) selectPersonalNote(personalNotes[0].id);
                else renderPersonalNoteEditor();
            }
        }
    } catch(errorObject) { console.error('Failed to load notes', errorObject); }
}

function renderPersonalNotesList() {
    // Look up the personal notes list container element in the DOM by its ID
    const notesListContainerElement = document.getElementById('notesListContainer');
    if (!notesListContainerElement) return;
    
    if (personalNotes.length === 0) {
        notesListContainerElement.innerHTML = '<div style="color:#6b7280; font-size:11px; font-style:italic; padding:10px;">No notes yet. Click the + icon to create one.</div>';
        return;
    }
    
    notesListContainerElement.innerHTML = personalNotes.map(noteRecord => `
        <div class="note-list-item ${noteRecord.id === activeNoteId ? 'active' : ''}" onclick="selectPersonalNote(${noteRecord.id})" style="padding: 8px 12px; background: ${noteRecord.id === activeNoteId ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)'}; border-left: 2px solid ${noteRecord.id === activeNoteId ? '#10b981' : 'transparent'}; border-radius: 4px; cursor: pointer; transition: all 0.2s;">
            <div style="font-size:13px; font-weight:bold; color:${noteRecord.id === activeNoteId ? '#10b981' : '#d1d5db'}; margin-bottom:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(noteRecord.title)}</div>
            <div style="font-size:10px; color:#6b7280;">${new Date(noteRecord.updated_at).toLocaleDateString()}</div>
        </div>
    `).join('');
}

function selectPersonalNote(noteId) {
    // If we're currently editing a note, save it before switching
    if (activeNoteId && activeNoteId !== noteId) {
        savePersonalNote();
    }
    
    activeNoteId = noteId;
    renderPersonalNotesList();
    renderPersonalNoteEditor();
}

function renderPersonalNoteEditor() {
    // Look up the note editor empty state and editor container elements in the DOM by their IDs
    const emptyStateElement = document.getElementById('noteEditorEmpty');
    const editorContainerElement = document.getElementById('noteEditorContainer');
    
    if (!activeNoteId) {
        if(emptyStateElement) emptyStateElement.style.display = 'flex';
        if(editorContainerElement) editorContainerElement.style.display = 'none';
        return;
    }
    
    const activeNoteRecord = personalNotes.find(noteRecord => noteRecord.id === activeNoteId);
    if (!activeNoteRecord) return;
    
    if(emptyStateElement) emptyStateElement.style.display = 'none';
    if(editorContainerElement) editorContainerElement.style.display = 'flex';
    
    // Populate the active note ID, title, and content inputs in the DOM
    document.getElementById('activeNoteId').value = activeNoteRecord.id;
    document.getElementById('activeNoteTitle').value = activeNoteRecord.title;
    document.getElementById('activeNoteContent').value = activeNoteRecord.content;
}

async function savePersonalNote() {
    if (!activeNoteId) return;
    // Look up the active note title and content input elements in the DOM by their IDs
    const noteTitle = document.getElementById('activeNoteTitle').value.trim() || 'Untitled Note';
    const noteContent = document.getElementById('activeNoteContent').value;
    
    const activeNoteRecord = personalNotes.find(noteRecord => noteRecord.id === activeNoteId);
    if (!activeNoteRecord) return;
    
    // Only save if changed
    if (activeNoteRecord.title === noteTitle && activeNoteRecord.content === noteContent) return;
    
    activeNoteRecord.title = noteTitle;
    activeNoteRecord.content = noteContent;
    renderPersonalNotesList(); // update title in list immediately
    
    try {
        // Perform an authenticated HTTP PUT request to save the updated personal note on the server
        await authFetch(`/api/notes/${activeNoteId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: noteTitle, content: noteContent })
        });
    } catch(errorObject) { console.error('Failed to save note', errorObject); }
}

async function createNewPersonalNote() {
    if (!activeChronicleId) return;
    try {
        // Perform an authenticated HTTP POST request to create a new blank personal note
        const fetchResponse = await authFetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chronicle_id: activeChronicleId,
                campaign_id: activeSubCampaignId,
                title: 'New Note',
                content: ''
            })
        });
        if (fetchResponse.ok) {
            const createdNoteRecord = await fetchResponse.json();
            personalNotes.unshift(createdNoteRecord);
            selectPersonalNote(createdNoteRecord.id);
        }
    } catch(errorObject) { console.error('Failed to create note', errorObject); }
}

async function deletePersonalNote() {
    if (!activeNoteId) return;
    // Ask the user for confirmation via a browser confirm dialog before deleting the personal note
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    const noteIdToDelete = activeNoteId;
    activeNoteId = null;
    
    // Optimistic UI update
    personalNotes = personalNotes.filter(noteRecord => noteRecord.id !== noteIdToDelete);
    if (personalNotes.length > 0) selectPersonalNote(personalNotes[0].id);
    else {
        renderPersonalNotesList();
        renderPersonalNoteEditor();
    }
    
    try {
        // Perform an authenticated HTTP DELETE request to delete the personal note on the server
        await authFetch(`/api/notes/${noteIdToDelete}`, { method: 'DELETE' });
    } catch(errorObject) { console.error('Failed to delete note', errorObject); }
}




// --- SECURE PDF VIEWER LOGIC ---
var pdfDoc = null;
var pageNum = 1;
var pageRendering = false;
var pageNumPending = null;
var pdfScale = 1.2;

function openPdfViewer(pdfFileUrl) {
    try {
        // Force a unique ID to completely bypass any cached index.html ghosts; remove any existing viewer element in the DOM
        let pdfWidgetElement = document.getElementById('widget-pdf-dynamic');
        if (pdfWidgetElement) pdfWidgetElement.remove(); // Nuke any existing one
        
        // Create a new <div> element in memory for the floating PDF viewer widget
        pdfWidgetElement = document.createElement('div');
        pdfWidgetElement.id = 'widget-pdf-dynamic';
        pdfWidgetElement.className = 'elysium-widget widget-pdf';
        pdfWidgetElement.style.cssText = 'position: absolute !important; top: 100px; left: 100px; width: 900px; height: 700px; display: flex; flex-direction: column; border-radius: 8px; overflow: hidden; resize: both; opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; will-change: top, left; transform: translateZ(0);';
        
        pdfWidgetElement.innerHTML = `
            <div class="widget-header" style="background: rgba(26, 16, 22, 0.8); border-bottom: 1px solid rgba(63, 63, 70, 0.5); padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; cursor: grab; user-select: none;">
                <h3 style="margin: 0; color: #f8fafc; font-size: 16px; font-family: 'Cinzel', serif;"><i class="fa-solid fa-file-pdf" style="color:#ef4444;margin-right:6px;"></i> Rulebook PDF Viewer</h3>
                <button class="btn-close-modal" onclick="document.getElementById('widget-pdf-dynamic').style.display='none'" style="background: transparent; border: none; color: #9ca3af; font-size: 16px; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="flex: 1; position: relative; background: rgba(0,0,0,0.5);">
                <iframe id="pdfViewerIframeDynamic" src="" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
        `;
        
        // Dynamically find the correct container based on the active tab in the DOM
        let targetContainerElement = document.body;
        const activeTabElement = document.querySelector('.tab-view.active');
        if (activeTabElement && activeTabElement.id === 'tab-gameboard') {
            targetContainerElement = document.getElementById('elysiumDesktop') || document.body;
        }
        
        targetContainerElement.appendChild(pdfWidgetElement);
        if (activeTabElement && activeTabElement.id === 'tab-gameboard') {
            if (typeof bringDesktopWidgetToFront === 'function') bringDesktopWidgetToFront(pdfWidgetElement);
        } else {
            // When spawning over a modal in the Character Vault, we need a massive z-index to pierce the overlay
            pdfWidgetElement.style.setProperty('z-index', '999999999', 'important');
        }
        
        // Attach drag listener specifically to this new widget's header element
        const widgetHeaderElement = pdfWidgetElement.querySelector('.widget-header');
        if (widgetHeaderElement) {
            widgetHeaderElement.onmousedown = mouseEvent => {
                if (mouseEvent.target.closest('button, input, select, a, textarea')) return;
                mouseEvent.preventDefault();
                if (typeof bringDesktopWidgetToFront === 'function') bringDesktopWidgetToFront(pdfWidgetElement);
                
                // Disable iframe pointer events during drag to prevent it from stealing mouse events
                const innerIframeElement = pdfWidgetElement.querySelector('iframe');
                if (innerIframeElement) innerIframeElement.style.pointerEvents = 'none';
                
                // Assign directly to the global let variable, NOT window.
                activeWidgetDrag = {
                    widget: pdfWidgetElement,
                    startX: mouseEvent.clientX,
                    startY: mouseEvent.clientY,
                    initialLeft: pdfWidgetElement.offsetLeft,
                    initialTop: pdfWidgetElement.offsetTop
                };
                
                // Restore iframe pointer events when the mouse button is released on the window
                const mouseUpHandler = () => {
                    if (innerIframeElement) innerIframeElement.style.pointerEvents = 'auto';
                    window.removeEventListener('mouseup', mouseUpHandler);
                };
                window.addEventListener('mouseup', mouseUpHandler);
            };
        }

        // Look up the PDF viewer iframe element in the DOM and point it to the PDF.js viewer URL
        const pdfIframeElement = document.getElementById('pdfViewerIframeDynamic');
        pdfIframeElement.src = '/pdfjs/web/viewer.html?file=' + encodeURIComponent(pdfFileUrl);
        
        pdfWidgetElement.style.display = 'flex';
        
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        pdfWidgetElement.style.left = Math.max(0, (viewportWidth - 900) / 2) + 'px';
        pdfWidgetElement.style.top = Math.max(0, (viewportHeight - 700) / 2) + 'px';
    } catch (errorObject) {
        console.error("openPdfViewer error:", errorObject);
        alert("CRITICAL ERROR: " + errorObject.message + "\n\nStack: " + errorObject.stack);
    }
}
