/**
 * Asset Library (tab-asset-library), Image Picker, and Image Cropper
 */
  
/**
 * Recursively builds a flat list of asset category options for dropdown menus.
 * It traverses the globalAssetCategories array, creating hierarchical labels 
 * (e.g., 'Parent > Child') and prevents infinite loops by tracking seen categories.
 * 
 * @returns {Array<{value: string, label: string}>} Array of option objects for select inputs.
 */
function buildAssetCategoryOptions() {
    const categoryOptionsList = [{ value: '', label: 'Uncategorized' }];
    const seenCategoryIds = new Set();
    function addChildren(parentId, labelPrefix) {
        // Only process objects, ignore any rogue strings
        const childCategories = globalAssetCategories.filter(
            categoryRecord => typeof categoryRecord === 'object' && categoryRecord.parent_id == parentId
        );
        childCategories.forEach(categoryRecord => {
            if (String(categoryRecord.id).startsWith('default_category')) return;
            if (seenCategoryIds.has(categoryRecord.id)) return; // Prevent infinite loops
            seenCategoryIds.add(categoryRecord.id);
            categoryOptionsList.push({ value: categoryRecord.id, label: labelPrefix + categoryRecord.name });
            addChildren(categoryRecord.id, labelPrefix + categoryRecord.name + ' > ');
        });
    }
    addChildren(null, '');
    return categoryOptionsList;
}

let globalAssetCategories = [];
  let bulkSelectedAssets = new Set();
  let currentAssetCategory = null;
  let assetPickerCallback = null;
  let pickerSearchTerm = '';
  let currentCropper = null;
  let cropperResolve = null;
let currentCropperSkipGallery = false;
let currentCropperEntityType = null;
let currentCropperEntityId = null;

  // Register a DOMContentLoaded listener on the document to initialize drag-and-drop asset uploading once the page loads
  document.addEventListener('DOMContentLoaded', () => {
    // Query the main asset library container element in the DOM
    const assetMainElement = document.querySelector('.assets-main');
    if (!assetMainElement) return;
    // Create a new <div> overlay element in memory for drag-and-drop visual feedback
    const dragDropOverlayElement = document.createElement('div');
    dragDropOverlayElement.id = 'dragDropOverlay';
    dragDropOverlayElement.style.cssText = 'position: absolute; inset: 0; background: rgba(220, 38, 38, 0.15); border: 3px dashed #ef4444; border-radius: 12px; z-index: 1000; display: none; align-items: center; justify-content: center; pointer-events: none; backdrop-filter: blur(4px);';
    dragDropOverlayElement.innerHTML = '<h2 style="color: #ef4444; font-family: Cinzel, serif; font-size: 32px; text-shadow: 0 0 20px #000;">DROP FILES TO UPLOAD</h2>';
    assetMainElement.style.position = 'relative';
    assetMainElement.appendChild(dragDropOverlayElement);
    assetMainElement.addEventListener('dragover', dragEvent => {
      if (!dragEvent.dataTransfer.types.includes('Files')) return; // Ignore internal element dragging
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      dragDropOverlayElement.style.display = 'flex';
    });
    assetMainElement.addEventListener('dragleave', dragEvent => {
      dragEvent.preventDefault();
      dragEvent.stopPropagation();
      if (dragEvent.target === dragDropOverlayElement || dragEvent.target === assetMainElement) {
        dragDropOverlayElement.style.display = 'none';
      }
    });
    assetMainElement.addEventListener('drop', async dropEvent => {
      dropEvent.preventDefault();
      dropEvent.stopPropagation();
      dragDropOverlayElement.style.display = 'none';
      if (dropEvent.dataTransfer.files && dropEvent.dataTransfer.files.length > 0) {
        const droppedFilesList = Array.from(dropEvent.dataTransfer.files);
        const imageFilesList = droppedFilesList.filter(selectedFile => selectedFile.type.startsWith('image/'));
        if (imageFilesList.length === 0) {
          if (typeof vtmAlert === 'function') vtmAlert('Please drop valid image files.', 'Invalid Files');
          return;
        }
        const availableCategoryOptions = buildAssetCategoryOptions();
        const selectedUploadCategoryId = await vtmSelectPrompt('Select category to upload these ' + imageFilesList.length + ' assets into:', 'Upload Dropped Assets', availableCategoryOptions, currentAssetCategory || '');
        if (!selectedUploadCategoryId) return;
        for (let selectedFile of imageFilesList) {
          // Construct a browser FormData payload containing the image file and target category metadata
          const uploadFormData = new FormData();
          uploadFormData.append('file', selectedFile);
          uploadFormData.append('chronicleId', activeChronicleId);
          uploadFormData.append('category_id', selectedUploadCategoryId);
          try {
            // Perform an authenticated HTTP POST request to upload the dropped image file to the server
            const fetchResponse = await authFetch('/api/assets/upload', {
              method: 'POST',
              body: uploadFormData
            });
            if (fetchResponse.ok) {
              const responseData = await fetchResponse.json();
              if (responseData.success) {
                globalAssets.unshift(responseData.asset);
              }
            }
          } catch (errorObject) {
            console.error('Upload failed', errorObject);
          }
        }
        renderAssetCategories();
        renderAssetGrid();
      }
    });
  });



function openImagePicker(targetInputId) {
  openAssetPicker(selectedImageUrl => {
    if (targetInputId === 'profileAvatarInput') {
      performProfileCrop(selectedImageUrl);
      return;
    }
    // Look up the target input element in the DOM by its ID and assign the chosen image URL
    const targetInputElement = document.getElementById(targetInputId);
    if (targetInputElement) targetInputElement.value = selectedImageUrl;
    const changeEvent = new Event('change');
    targetInputElement.dispatchEvent(changeEvent);
    if (targetInputId === 'backdropUrlInput') {
      // Look up the global backdrop image element in the DOM and persist the URL in localStorage
      const globalBackdropImageElement = document.getElementById('globalBackdropImg');
      if (globalBackdropImageElement) globalBackdropImageElement.src = selectedImageUrl;
      localStorage.setItem('vtm_global_backdrop', selectedImageUrl);
    }
  });
}

function closeImagePicker() {
  // Look up the image picker modal element in the DOM by its ID and hide it
  document.getElementById('imagePickerModal').classList.remove('active');
}

function switchImageTab(selectedTabName) {
  // Look up the image picker tab content and button elements in the DOM by their IDs
  document.getElementById('tabContentUrl').style.display = selectedTabName === 'url' ? 'block' : 'none';
  document.getElementById('tabContentUpload').style.display = selectedTabName === 'upload' ? 'block' : 'none';
  document.getElementById('tabContentGallery').style.display = selectedTabName === 'gallery' ? 'block' : 'none';
  document.getElementById('btnTabUrl').classList.toggle('active', selectedTabName === 'url');
  document.getElementById('btnTabUpload').classList.toggle('active', selectedTabName === 'upload');
  document.getElementById('btnTabGallery').classList.toggle('active', selectedTabName === 'gallery');
}

function selectGalleryImage(imageSourceUrl) {
  // Query all gallery thumbnail elements in the DOM to clear any previous selection
  document.querySelectorAll('.gallery-thumb').forEach(imageElement => imageElement.classList.remove('selected'));
  event.target.classList.add('selected');
  // Look up the picker URL input element in the DOM by its ID
  document.getElementById('pickerUrlInput').value = new URL(imageSourceUrl).pathname;
}

async function confirmImageSelection() {
  // Look up the target input ID and element in the DOM by their IDs
  const targetInputId = document.getElementById('imagePickerTargetId').value;
  const targetInputElement = document.getElementById(targetInputId);
  if (!targetInputElement) return closeImagePicker();
  // Query the currently active tab button inside the image picker modal
  const activeTabButtonId = document.querySelector('.btn-action-outline.btn-sm.active').id;
  if (activeTabButtonId === 'btnTabUpload') {
    // Look up the file input element in the DOM by its ID
    const fileInputElement = document.getElementById('pickerFileInput');
    // Show a browser alert if no file was selected
    if (!fileInputElement.files.length) return alert('Please select a file to upload.');
    const selectedFile = fileInputElement.files[0];
    // Create a browser FormData instance to package the file for multipart HTTP upload
    const uploadFormData = new FormData();
    uploadFormData.append('file', selectedFile);
    // Look up the upload status text element in the DOM by its ID
    document.getElementById('uploadStatus').innerText = 'Uploading...';
    try {
      // Send an HTTP POST request using the browser fetch API with the auth token from localStorage
      const fetchResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + localStorage.getItem('vtm_auth_token')
        },
        body: uploadFormData
      });
      const responseData = await fetchResponse.json();
      if (responseData.url) {
        targetInputElement.value = responseData.url;
        if (targetInputElement.onchange) targetInputElement.onchange();
        closeImagePicker();
      } else {
        // Look up the upload status element in the DOM to display the server error message
        document.getElementById('uploadStatus').innerText = 'Upload failed: ' + (responseData.error || 'Unknown error');
      }
    } catch (errorObject) {
      // Look up the upload status element in the DOM to display the network error message
      document.getElementById('uploadStatus').innerText = 'Upload error: ' + errorObject.message;
    }
  } else {
    // Look up the picker URL input element in the DOM by its ID
    const selectedUrl = document.getElementById('pickerUrlInput').value.trim();
    targetInputElement.value = selectedUrl;
    if (targetInputElement.onchange) targetInputElement.onchange();
    closeImagePicker();
  }
}


async function fetchAssets() {
  if (!activeChronicleId) return;
  try {
    // Perform an authenticated HTTP GET request to fetch all assets for the active chronicle
    const assetsFetchResponse = await authFetch(`/api/assets?chronicleId=${activeChronicleId}`);
    const assetsResponseData = await assetsFetchResponse.json();
    if (assetsResponseData.success) {
      globalAssets = assetsResponseData.assets;
    }
    // Perform an authenticated HTTP GET request to fetch all asset categories for the active chronicle
    const categoriesFetchResponse = await authFetch(`/api/asset-categories?chronicleId=${activeChronicleId}`);
    const categoriesResponseData = await categoriesFetchResponse.json();
    if (categoriesResponseData.success) {
      globalAssetCategories = categoriesResponseData.categories;
    }
    renderAssetCategories();
    renderAssetGrid();
  } catch (errorObject) {
    console.error(errorObject);
  }
}

function renderAssetCategories() {
  // Look up the asset categories list container element in the DOM by its ID
  const categoryListElement = document.getElementById('assetCategoriesList');
  if (!categoryListElement) return;
  categoryListElement.innerHTML = '';
  categoryListElement.ondragover = (dragEvent) => { dragEvent.preventDefault(); };
  categoryListElement.ondrop = (dropEvent) => {
      dropEvent.preventDefault();
      // If we dropped directly on the list (blank space), move to Uncategorized / Root
      // If it bubbled up from a child, the child would have called dropEvent.stopPropagation()
      const draggedAssetId = dropEvent.dataTransfer.getData('text/plain');
      if (draggedAssetId) {
          if (currentAssetCategory !== null) moveDraggedAssetsToCategory(draggedAssetId, null);
      } else {
          const draggedFolderId = dropEvent.dataTransfer.getData('text/folder');
          if (draggedFolderId) moveAssetCategoryNode(draggedFolderId, null);
      }
  };
  
  // Create Uncategorized root element in memory using document.createElement
  const uncategorizedFolderElement = document.createElement('div');
  uncategorizedFolderElement.className = `asset-category-item ${currentAssetCategory === null ? 'active' : ''}`;
  uncategorizedFolderElement.ondragover = (dragEvent) => { dragEvent.preventDefault(); uncategorizedFolderElement.style.backgroundColor = 'rgba(255,255,255,0.1)'; };
  uncategorizedFolderElement.ondragleave = (dragEvent) => { uncategorizedFolderElement.style.backgroundColor = ''; };
  uncategorizedFolderElement.ondrop = (dropEvent) => {
      dropEvent.preventDefault();
      dropEvent.stopPropagation();
      uncategorizedFolderElement.style.backgroundColor = '';
      const draggedAssetId = dropEvent.dataTransfer.getData('text/plain');
      if (draggedAssetId) {
          if (currentAssetCategory !== null) moveDraggedAssetsToCategory(draggedAssetId, null);
      } else {
          const draggedFolderId = dropEvent.dataTransfer.getData('text/folder');
          if (draggedFolderId) moveAssetCategoryNode(draggedFolderId, null);
      }
  };
  uncategorizedFolderElement.onclick = () => {
      currentAssetCategory = null;
      // Look up the current asset category title heading in the DOM by its ID
      document.getElementById('currentAssetCategoryTitle').innerText = 'Uncategorized';
      bulkSelectedAssets.clear();
      renderAssetCategories();
      renderAssetGrid();
  };
  const uncategorizedAssetCount = globalAssets.filter(assetRecord => !assetRecord.category_id).length;
  uncategorizedFolderElement.innerHTML = `<div style="display:flex; align-items:center;"><i class="fa-solid fa-box-open" style="margin-right:8px; opacity:0.5;"></i><span>Uncategorized</span></div><span class="badge">${uncategorizedAssetCount}</span>`;
  categoryListElement.appendChild(uncategorizedFolderElement);

  function buildAssetNode(categoryRecord, depthLevel = 0) {
      // Create a new <div> element in memory for this category folder row
      const categoryRowElement = document.createElement('div');
      categoryRowElement.draggable = !String(categoryRecord.id).startsWith('default_category');
      categoryRowElement.ondragstart = (dragEvent) => {
          dragEvent.dataTransfer.setData('text/folder', categoryRecord.id);
          dragEvent.dataTransfer.effectAllowed = 'move';
          dragEvent.stopPropagation();
      };
      categoryRowElement.className = `asset-category-item ${categoryRecord.id == currentAssetCategory ? 'active' : ''}`;
      categoryRowElement.style.paddingLeft = (15 + depthLevel * 15) + 'px';
      
      const childCategories = globalAssetCategories.filter(childCategory => childCategory.parent_id == categoryRecord.id);
      const hasChildren = childCategories.length > 0;
      
      const expandIconHtml = hasChildren ? `<i class="fa-solid ${categoryRecord._expanded ? 'fa-folder-open' : 'fa-folder-plus'}" style="margin-right:8px; cursor:pointer; opacity: ${categoryRecord.id == currentAssetCategory ? '1' : '0.5'}" onclick="event.stopPropagation(); this.closest('.asset-category-item').toggleAssetFolder('${categoryRecord.id}')"></i>` : `<i class="fa-solid fa-folder" style="margin-right:8px; opacity:0.5;"></i>`;
      
      categoryRowElement.ondragover = (dragEvent) => { 
          dragEvent.preventDefault(); 
          dragEvent.stopPropagation();
          if (String(categoryRecord.id).startsWith('default_category')) return;
          // Measure the category row's bounding rectangle in the viewport to determine drop zone (before, inside, or after)
          const rowBoundingRect = categoryRowElement.getBoundingClientRect();
          const mouseOffsetY = dragEvent.clientY - rowBoundingRect.top;
          
          categoryRowElement.style.borderTop = '';
          categoryRowElement.style.borderBottom = '';
          categoryRowElement.style.backgroundColor = '';
          
          if (mouseOffsetY < rowBoundingRect.height * 0.25) {
              categoryRowElement.style.borderTop = '2px solid #ef4444';
              categoryRowElement.dataset.dropAction = 'before';
          } else if (mouseOffsetY > rowBoundingRect.height * 0.75) {
              categoryRowElement.style.borderBottom = '2px solid #ef4444';
              categoryRowElement.dataset.dropAction = 'after';
          } else {
              categoryRowElement.style.backgroundColor = 'rgba(255,255,255,0.1)';
              categoryRowElement.dataset.dropAction = 'inside';
          }
      };
      
      categoryRowElement.ondragleave = (dragEvent) => { 
          categoryRowElement.style.borderTop = '';
          categoryRowElement.style.borderBottom = '';
          categoryRowElement.style.backgroundColor = '';
          delete categoryRowElement.dataset.dropAction;
      };
      
      categoryRowElement.ondrop = async (dropEvent) => {
          dropEvent.preventDefault();
          dropEvent.stopPropagation();
          
          const dropAction = categoryRowElement.dataset.dropAction;
          categoryRowElement.style.borderTop = '';
          categoryRowElement.style.borderBottom = '';
          categoryRowElement.style.backgroundColor = '';
          delete categoryRowElement.dataset.dropAction;
          
          if (String(categoryRecord.id).startsWith('default_category')) return;
          
          const draggedAssetId = dropEvent.dataTransfer.getData('text/plain');
          if (draggedAssetId) {
              if (currentAssetCategory != categoryRecord.id) moveDraggedAssetsToCategory(draggedAssetId, categoryRecord.id);
          } else {
              const draggedFolderId = dropEvent.dataTransfer.getData('text/folder');
              if (draggedFolderId && draggedFolderId != categoryRecord.id) {
                  if (dropAction === 'inside') {
                      moveAssetCategoryNode(draggedFolderId, categoryRecord.id);
                  } else {
                      reorderAssetCategoryNode(draggedFolderId, categoryRecord.id, dropAction);
                  }
              }
          }
      };
      categoryRowElement.onclick = () => {
          currentAssetCategory = categoryRecord.id;
          // Look up the current asset category title heading in the DOM by its ID
          document.getElementById('currentAssetCategoryTitle').innerText = categoryRecord.name;
          bulkSelectedAssets.clear();
          renderAssetCategories();
          renderAssetGrid();
      };
      
      categoryRowElement.toggleAssetFolder = function(folderCategoryId) {
          const matchingCategory = globalAssetCategories.find(categoryItem => categoryItem.id == folderCategoryId);
          if (matchingCategory) matchingCategory._expanded = !matchingCategory._expanded;
          renderAssetCategories();
      };
      
      const categoryAssetCount = globalAssets.filter(assetRecord => assetRecord.category_id == categoryRecord.id).length;
      
      const isCurrentCategory = categoryRecord.id == currentAssetCategory;
      const editIconHtml = isCurrentCategory && !String(categoryRecord.id).startsWith('default_category') ? `<i class="fa-solid fa-pencil" style="margin-left:auto; color:#9ca3af; cursor:pointer;" onclick="event.stopPropagation(); startInlineFolderEdit('${categoryRecord.id}', this)"></i>` : '';
      const deleteIconHtml = isCurrentCategory && !String(categoryRecord.id).startsWith('default_category') ? `<i class="fa-solid fa-trash" style="margin-left:4px; color:#ef4444; cursor:pointer;" onclick="event.stopPropagation(); deleteAssetCategory('${categoryRecord.id}', '${escapeHtml(categoryRecord.name).replace(/'/g, "\\'")}')"></i>` : '';
      categoryRowElement.innerHTML = `<div style="display:flex; align-items:center;">${expandIconHtml}<span>${escapeHtml(categoryRecord.name)}</span></div><div style="display:flex; align-items:center; gap:8px;">${categoryAssetCount > 0 ? `<span class="badge">${categoryAssetCount}</span>` : ''}${editIconHtml}${deleteIconHtml}</div>`;

      
      categoryListElement.appendChild(categoryRowElement);
      
      if (categoryRecord._expanded) {
          childCategories.forEach(childCategory => buildAssetNode(childCategory, depthLevel + 1));
      }
  }

  const rootCategoriesList = globalAssetCategories.filter(categoryRecord => typeof categoryRecord === 'object' && !categoryRecord.parent_id);
  rootCategoriesList.forEach(rootCategory => buildAssetNode(rootCategory, 0));
}

function renderAssetGrid() {
  // Look up the asset grid container element in the DOM by its ID
  const assetGridElement = document.getElementById('assetGrid');
  if (!assetGridElement) return;
  assetGridElement.innerHTML = '';
  const filteredAssetsList = globalAssets.filter(
    assetRecord => currentAssetCategory === null ? !assetRecord.category_id : assetRecord.category_id == currentAssetCategory
  );
  filteredAssetsList.forEach(assetRecord => {
    // Create a new <div> card element in memory for each asset
    const assetCardElement = document.createElement('div');
    const isAssetSelected = bulkSelectedAssets.has(assetRecord.id);
    assetCardElement.className = `asset-card ${isAssetSelected ? 'bulk-selected' : ''}`;
    assetCardElement.draggable = !String(assetRecord.id).startsWith('default_asset_');
    assetCardElement.ondragstart = (dragEvent) => {
        dragEvent.dataTransfer.setData('text/plain', assetRecord.id);
        dragEvent.dataTransfer.effectAllowed = 'move';
    };
    if (isAssetSelected) assetCardElement.style.border = '2px solid #ef4444';
    assetCardElement.innerHTML = `
            <input type="checkbox" class="bulk-select-checkbox" ${isAssetSelected ? 'checked' : ''} style="position: absolute; top: 12px; left: 12px; z-index: 10; transform: scale(2.2); cursor: pointer; accent-color: #ef4444;" onclick="toggleBulkSelect('${assetRecord.id}', event)">

            <img src="${escapeHtml(assetRecord.url)}" alt="${escapeHtml(assetRecord.filename)}" loading="lazy" onclick="viewAssetFullscreen('${escapeHtml(assetRecord.url)}')">
            <div class="asset-card-overlay">${escapeHtml(assetRecord.filename)}</div>
            <div class="asset-card-actions">
                <button class="asset-action-btn" title="Copy URL" onclick="copyToClipboard('${escapeHtml(assetRecord.url)}', event)"><i class="fas fa-link"></i></button>
                ${((activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller') || assetRecord.user_id === currentUser?.id) && !String(assetRecord.id).startsWith('default_asset_') ? `
                    <button class="asset-action-btn" title="Move Category" onclick="moveAssetCategory('${assetRecord.id}', event)"><i class="fas fa-folder-open"></i></button>
                    <button class="asset-action-btn" title="Delete" onclick="deleteAsset('${assetRecord.id}', event)"><i class="fas fa-trash"></i></button>
                ` : ''}
            </div>
        `;
    assetGridElement.appendChild(assetCardElement);
  });
  updateBulkActionsUI();
}

function viewAssetFullscreen(assetUrl) {
  // Open the asset image URL in a new browser tab
  window.open(assetUrl, '_blank');
}

function copyToClipboard(textToCopy, mouseEvent) {
  if (mouseEvent) mouseEvent.stopPropagation();
  // Write the URL string to the system clipboard using the browser Clipboard API and notify the user with an alert
  navigator.clipboard.writeText(textToCopy).then(() => alert('URL copied!'));
}

async function handleBulkAssetUpload(changeEvent) {
  if (!activeChronicleId) return;
  const selectedFilesList = changeEvent.target.files;
  if (!selectedFilesList || selectedFilesList.length === 0) return;
  const availableCategoryOptions = buildAssetCategoryOptions();
  const selectedUploadCategoryId = await vtmSelectPrompt('Select category to upload these ' + selectedFilesList.length + ' assets into:', 'Upload Assets', availableCategoryOptions, currentAssetCategory || '');
  if (!selectedUploadCategoryId) {
    changeEvent.target.value = '';
    return;
  }
  for (let fileIndex = 0; fileIndex < selectedFilesList.length; fileIndex++) {
    const selectedFile = selectedFilesList[fileIndex];
    // Create a browser FormData payload for each selected file
    const uploadFormData = new FormData();
    uploadFormData.append('file', selectedFile);
    uploadFormData.append('chronicleId', activeChronicleId);
    uploadFormData.append('category_id', selectedUploadCategoryId);
    try {
      // Perform an authenticated HTTP POST request to upload the asset file
      const fetchResponse = await authFetch('/api/assets/upload', {
        method: 'POST',
        body: uploadFormData
      });
      const responseData = await fetchResponse.json();
      if (responseData.success) {
        globalAssets.unshift(responseData.asset);
      }
    } catch (errorObject) {
      console.error(errorObject);
    }
  }
  changeEvent.target.value = '';
  renderAssetCategories();
  renderAssetGrid();
}

async function createNewAssetCategory() {
  // Look up the new asset category name input element in the DOM by its ID
  const categoryNameInputElement = document.getElementById('newAssetCategoryInput');
  const categoryName = categoryNameInputElement ? categoryNameInputElement.value.trim() : '';
  if (!categoryName) return;
  
  try {
    // Perform an authenticated HTTP POST request to create a new asset category folder
    const fetchResponse = await authFetch('/api/asset-categories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicleId: activeChronicleId,
        name: categoryName,
        parent_id: null // Always create as root, user can drag to nest
      })
    });
    if (fetchResponse.ok) {
      const responseData = await fetchResponse.json();
      if (responseData.success && responseData.id) {
          globalAssetCategories.push({ id: responseData.id, name: responseData.name, parent_id: responseData.parent_id });
          currentAssetCategory = responseData.id;
          // Look up the current asset category title element in the DOM to display the newly created folder name
          document.getElementById('currentAssetCategoryTitle').innerText = responseData.name;
          if (categoryNameInputElement) categoryNameInputElement.value = ''; // Clear input on success
      }
    }
  } catch (errorObject) {
    console.error(errorObject);
  }
  renderAssetCategories();
  renderAssetGrid();
}

async function moveAssetCategory(assetId, mouseEvent) {
  if (mouseEvent) mouseEvent.stopPropagation();
  const availableCategoryOptions = buildAssetCategoryOptions();
  const targetCategoryId = await vtmSelectPrompt('Move asset to category:', 'Move Asset', availableCategoryOptions, '');
  if (!targetCategoryId) return;
  // Perform an authenticated HTTP PUT request to move the asset to the selected category
  const fetchResponse = await authFetch(`/api/assets/${assetId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      category_id: targetCategoryId,
      category: targetCategoryId
    })
  });
  if (fetchResponse.ok) {
    const matchingAssetRecord = globalAssets.find(assetRecord => assetRecord.id === assetId);
    if (matchingAssetRecord) { matchingAssetRecord.category = targetCategoryId; matchingAssetRecord.category_id = targetCategoryId; }
    renderAssetCategories();
    renderAssetGrid();
  }
}

async function deleteAsset(assetId, mouseEvent) {
  if (mouseEvent) mouseEvent.stopPropagation();
  const isConfirmed = await vtmConfirm('Are you sure you want to permanently delete this asset? It will be removed from the server.', 'Delete Asset');
  if (!isConfirmed) return;
  // Perform an authenticated HTTP DELETE request to remove the asset from the server
  const fetchResponse = await authFetch(`/api/assets/${assetId}`, {
    method: 'DELETE'
  });
  if (fetchResponse.ok) {
    globalAssets = globalAssets.filter(assetRecord => assetRecord.id !== assetId);
    renderAssetCategories();
    renderAssetGrid();
  }
}

function openAssetPicker(selectionCallback) {
  assetPickerCallback = selectionCallback;
  // Look up the asset picker modal element in the DOM by its ID and mark it active
  document.getElementById('assetPickerModal').classList.add('active');
  renderPickerCategories();
  renderPickerGrid();
}

function closeAssetPicker() {
  // Look up the asset picker modal element in the DOM by its ID and hide it
  document.getElementById('assetPickerModal').classList.remove('active');
  assetPickerCallback = null;
}

let pickerCurrentCategory = null;
function renderPickerCategories() {
  // Look up the picker categories list container element in the DOM by its ID
  const pickerCategoryListElement = document.getElementById('pickerCategoriesList');
  if (!pickerCategoryListElement) return;
  pickerCategoryListElement.innerHTML = '';
  
  // Create a new <div> element in memory for the Uncategorized option in the asset picker
  const uncategorizedRowElement = document.createElement('div');
  uncategorizedRowElement.className = `asset-category-item ${pickerCurrentCategory === null ? 'active' : ''}`;
  uncategorizedRowElement.ondragover = (dragEvent) => { dragEvent.preventDefault(); uncategorizedRowElement.style.backgroundColor = 'rgba(255,255,255,0.1)'; };
  uncategorizedRowElement.ondragleave = (dragEvent) => { uncategorizedRowElement.style.backgroundColor = ''; };
  uncategorizedRowElement.ondrop = (dropEvent) => {
      dropEvent.preventDefault();
      uncategorizedRowElement.style.backgroundColor = '';
      const draggedAssetId = dropEvent.dataTransfer.getData('text/plain');
      if (draggedAssetId && currentAssetCategory !== null) moveDraggedAssetsToCategory(draggedAssetId, null);
  };
  uncategorizedRowElement.onclick = () => { pickerCurrentCategory = null; renderPickerCategories(); renderPickerGrid(); };
  uncategorizedRowElement.innerHTML = '<span>Uncategorized</span>';
  pickerCategoryListElement.appendChild(uncategorizedRowElement);

  function buildPickerNode(categoryRecord, depthLevel = 0) {
      // Create a new <div> element in memory for this picker category folder
      const categoryRowElement = document.createElement('div');
      categoryRowElement.className = `asset-category-item ${categoryRecord.id == pickerCurrentCategory ? 'active' : ''}`;
      categoryRowElement.style.paddingLeft = (15 + depthLevel * 15) + 'px';
      const childCategories = globalAssetCategories.filter(childCategory => childCategory.parent_id == categoryRecord.id);
      const expandIconHtml = childCategories.length > 0 ? `<i class="fa-solid ${categoryRecord._expanded ? 'fa-minus' : 'fa-plus'}" style="margin-right:8px; cursor:pointer;" onclick="event.stopPropagation(); this.closest('.asset-category-item').togglePickerFolder('${categoryRecord.id}')"></i>` : '<i class="fa-solid fa-folder" style="margin-right:8px; opacity:0.5;"></i>';
      categoryRowElement.onclick = () => { pickerCurrentCategory = categoryRecord.id; renderPickerCategories(); renderPickerGrid(); };
      categoryRowElement.togglePickerFolder = function(folderCategoryId) {
          const matchingCategory = globalAssetCategories.find(categoryItem => categoryItem.id == folderCategoryId);
          if (matchingCategory) matchingCategory._expanded = !matchingCategory._expanded;
          renderPickerCategories();
      };
      categoryRowElement.innerHTML = `<div style="display:flex; align-items:center;">${expandIconHtml}<span>${escapeHtml(categoryRecord.name)}</span></div>`;
      pickerCategoryListElement.appendChild(categoryRowElement);
      if (categoryRecord._expanded) childCategories.forEach(childCategory => buildPickerNode(childCategory, depthLevel + 1));
  }
  globalAssetCategories.filter(categoryRecord => !categoryRecord.parent_id).forEach(rootCategory => buildPickerNode(rootCategory, 0));
}

function renderPickerGrid() {
  // Look up the picker grid container and search input elements in the DOM by their IDs
  const pickerGridElement = document.getElementById('pickerGrid');
  if (!pickerGridElement) return;
  pickerGridElement.innerHTML = '';
  const searchQueryTerm = (document.getElementById('pickerSearchInput').value || '').toLowerCase();
  
  const filteredAssetsList = globalAssets.filter(assetRecord => {
    if (pickerCurrentCategory === null && assetRecord.category_id) return false;
    if (pickerCurrentCategory !== null && assetRecord.category_id != pickerCurrentCategory) return false;
    if (searchQueryTerm && !assetRecord.filename.toLowerCase().includes(searchQueryTerm)) return false;
    return true;
  });
  filteredAssetsList.forEach(assetRecord => {
    // Create a new <div> card element in memory for each selectable asset in the picker
    const assetCardElement = document.createElement('div');
    assetCardElement.className = 'asset-card';
    assetCardElement.onclick = () => {
      if (assetPickerCallback) assetPickerCallback(assetRecord.url);
      closeAssetPicker();
    };
    assetCardElement.innerHTML = `
            <img src="${escapeHtml(assetRecord.url)}" alt="${escapeHtml(assetRecord.filename)}" loading="lazy">
            <div class="asset-card-overlay">${escapeHtml(assetRecord.filename)}</div>
        `;
    pickerGridElement.appendChild(assetCardElement);
  });
}

async function handlePickerDirectUpload(changeEvent) {
  if (!activeChronicleId) return;
  const selectedFile = changeEvent.target.files[0];
  if (!selectedFile) return;
  // Create a browser FormData payload for uploading the selected file directly from the picker
  const uploadFormData = new FormData();
  uploadFormData.append('file', selectedFile);
  uploadFormData.append('chronicleId', activeChronicleId);
  uploadFormData.append('categoryId', pickerCurrentCategory || '');
  try {
    // Perform an authenticated HTTP POST request to upload the new asset file
    const fetchResponse = await authFetch('/api/assets/upload', {
      method: 'POST',
      body: uploadFormData
    });
    const responseData = await fetchResponse.json();
    if (responseData.success) {
      globalAssets.unshift(responseData.asset);
      if (assetPickerCallback) assetPickerCallback(responseData.asset.url);
      closeAssetPicker();
      renderAssetCategories();
      renderAssetGrid();
    }
  } catch (errorObject) {
    console.error(errorObject);
  }
  changeEvent.target.value = '';
}

function openImageCropper(imageUrl, aspectRatio, modalTitle, modalDescription, skipGallery = false, entityType = null, entityId = null) {
  return new Promise(resolve => {
    // Look up the cropper mode label, image element, and modal container in the DOM by their IDs
    document.getElementById('cropperModeLabel').innerText = modalTitle;
    const cropperImageElement = document.getElementById('cropperImageElement');
    cropperImageElement.src = imageUrl;
    document.getElementById('imageCropperModal').classList.add('active');
    if (currentCropper) {
      // Destroy the previous Cropper.js instance before creating a new one
      currentCropper.destroy();
    }
    cropperImageElement.onload = () => {
      // Initialize the third-party Cropper.js library on the image element with the requested aspect ratio
      currentCropper = new Cropper(cropperImageElement, {
        aspectRatio: aspectRatio,
        viewMode: 0,
        background: false,
        zoomable: true,
        dragMode: "move",
        autoCropArea: 1
      });
    };
    cropperResolve = resolve;
    currentCropperSkipGallery = skipGallery;
    currentCropperEntityType = entityType;
    currentCropperEntityId = entityId;
  });
}

function closeImageCropper() {
  // Look up the image cropper modal element in the DOM by its ID and hide it
  document.getElementById('imageCropperModal').classList.remove('active');
  if (currentCropper) {
    // Destroy the active Cropper.js instance to free resources
    currentCropper.destroy();
    currentCropper = null;
  }
  if (cropperResolve) {
    cropperResolve(null);
    cropperResolve = null;
  }
}

async function confirmImageCrop() {
  if (!currentCropper) return;
  // Use the Cropper.js getCroppedCanvas API to render the selected crop region into an HTML5 Canvas
  const croppedCanvasElement = currentCropper.getCroppedCanvas({
    width: 600,
    imageSmoothingQuality: 'high'
  });
  // Convert the HTML5 Canvas contents into a Base64 PNG data URL string
  const base64ImageData = croppedCanvasElement.toDataURL('image/png');
  const resolveCallback = cropperResolve;
  cropperResolve = null;
  closeImageCropper();
  if (!activeChronicleId) {
    if (resolveCallback) resolveCallback(base64ImageData);
    return;
  }
  if (!activeChronicleId) {
    if (resolveCallback) resolveCallback(base64ImageData);
    return;
  }
  try {
    // Perform an authenticated HTTP POST request to upload the cropped Base64 image to the server
    const fetchResponse = await authFetch('/api/assets/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chronicleId: activeChronicleId,
        category: 'Cropped Portraits',
        filename: 'crop_' + Date.now() + '.jpg',
        data: base64ImageData,
        skipGallery: currentCropperSkipGallery,
        entityType: currentCropperEntityType,
        entityId: currentCropperEntityId
      })
    });
    const responseData = await fetchResponse.json();
    if (responseData.success && resolveCallback) {
      resolveCallback(responseData.asset.url);
    }
  } catch (errorObject) {
    console.error(errorObject);
    if (resolveCallback) resolveCallback(null);
  }
}

async function performDualCropForCharacter(sourceImageUrl, characterId) {
  const croppedAvatarUrl = await openImageCropper(sourceImageUrl, 1, 'Step 1: Circle Token (1:1)', 'This first crop is for the small circular token displayed at the top of your character sheet and on the map. Frame it tightly around the face.', true, 'character_avatar', characterId);
  if (!croppedAvatarUrl) return;
  const croppedVaultUrl = await openImageCropper(sourceImageUrl, 2 / 3, 'Step 2: Vault Card (2:3)', 'This second crop is for the tall rectangular card displayed in the Character Vault. Frame the full body or bust.', true, 'character_vault', characterId);
  if (!croppedVaultUrl) return;
  try {
    // Perform an authenticated HTTP PUT request to save both the circular token and tall vault portrait URLs to the character record
    const fetchResponse = await authFetch(`/api/characters/${characterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        avatar_url: croppedAvatarUrl,
        vault_url: croppedVaultUrl
      })
    });
    if (fetchResponse.ok) {
      loadCharacters();
      // Look up the character modal and dossier avatar image elements in the DOM by their IDs
      const headerAvatarImageElement = document.getElementById('modalCharAvatarImg');
      if (headerAvatarImageElement) headerAvatarImageElement.src = croppedAvatarUrl;
      const sheetAvatarImageElement = document.getElementById('dossierAvatarImg');
      if (sheetAvatarImageElement) sheetAvatarImageElement.src = croppedAvatarUrl;
      const matchingCharacterObject = chronicleCharactersList.find(characterRecord => characterRecord.id === characterId);
      if (matchingCharacterObject) {
        matchingCharacterObject.avatar_url = croppedAvatarUrl;
        matchingCharacterObject.vault_url = croppedVaultUrl;
      }
      if (typeof renderCharacterVault === 'function') renderCharacterVaultCards();
    }
  } catch (errorObject) {
    console.error(errorObject);
  }
}

async function performProfileCrop(sourceImageUrl) {
  const croppedAvatarUrl = await openImageCropper(sourceImageUrl, 1, 'Profile Picture (1:1)', 'Frame your profile picture. It will be displayed as a circle across the VTT.', true, 'user_profile', currentUser ? currentUser.id : 'unknown');
  if (!croppedAvatarUrl) return;
  try {
    // Perform an authenticated HTTP PUT request to update the logged-in user's profile avatar
    const fetchResponse = await authFetch('/api/auth/me', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        avatar: croppedAvatarUrl
      })
    });
    if (fetchResponse.ok) {
      currentUser.avatar = croppedAvatarUrl;
      currentUser.avatar_url = croppedAvatarUrl;
      // Look up the profile avatar input element in the DOM by its ID
      const profileAvatarInputElement = document.getElementById('profileAvatarInput');
      if (profileAvatarInputElement) profileAvatarInputElement.value = croppedAvatarUrl;
      if (typeof socket !== 'undefined' && socket && activeChronicleId) {
        // Emit a Socket.IO 'room:join' event to broadcast the user's updated profile avatar to all connected peers
        socket.emit('room:join', {
          campaignId: activeChronicleId,
          userId: currentUser ? currentUser.id : null,
          username: currentUser ? currentUser.username : 'User',
          displayName: currentUser ? currentUser.displayName || currentUser.username : 'User',
          role: activeChronicleRole,
          characterId: activeControlledCharacterId || null,
          avatar: currentUser.avatar || currentUser.avatar_url
        });
      } else {
        if (typeof renderActivePlayersBar === "function") renderActivePlayersBar(currentChronicleActiveUsers);
      }
    }
  } catch (errorObject) {
    console.error(errorObject);
  }
}


function toggleBulkSelect(assetId, mouseEvent) {
  if (mouseEvent) mouseEvent.stopPropagation();
  let normalizedAssetId = assetId;
  if (!isNaN(normalizedAssetId) && typeof normalizedAssetId !== 'number') normalizedAssetId = Number(normalizedAssetId);
  
  if (bulkSelectedAssets.has(normalizedAssetId)) {
    bulkSelectedAssets.delete(normalizedAssetId);
  } else {
    // Check if it was stored as a string as well just in case
    if (bulkSelectedAssets.has(String(normalizedAssetId))) {
      bulkSelectedAssets.delete(String(normalizedAssetId));
    } else {
      bulkSelectedAssets.add(normalizedAssetId);
    }
  }
  renderAssetGrid();
}

function updateBulkActionsUI() {
  // Look up the bulk actions toolbar container and selected count span in the DOM by their IDs
  const bulkActionsContainerElement = document.getElementById('bulkActionsContainer');
  const bulkCountSpanElement = document.getElementById('bulkSelectCount');
  if (!bulkActionsContainerElement || !bulkCountSpanElement) return;
  if (bulkSelectedAssets.size > 0) {
    bulkActionsContainerElement.style.display = 'flex';
    bulkCountSpanElement.innerText = `${bulkSelectedAssets.size} selected`;
  } else {
    bulkActionsContainerElement.style.display = 'none';
  }
}

async function bulkMoveAssets() {
  if (bulkSelectedAssets.size === 0) return;
  const availableCategoryOptions = buildAssetCategoryOptions();
  const targetCategoryId = await vtmSelectPrompt(`Move ${bulkSelectedAssets.size} assets to category:`, 'Bulk Move', availableCategoryOptions, '');
  if (!targetCategoryId) return;
  for (const selectedAssetId of bulkSelectedAssets) {
    // Perform an authenticated HTTP PUT request to move each selected asset into the chosen category
    const fetchResponse = await authFetch(`/api/assets/${selectedAssetId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        category_id: targetCategoryId,
        category: targetCategoryId
      })
    });
    if (fetchResponse.ok) {
      const matchingAssetRecord = globalAssets.find(assetRecord => assetRecord.id === selectedAssetId);
      if (matchingAssetRecord) { matchingAssetRecord.category = targetCategoryId; matchingAssetRecord.category_id = targetCategoryId; }
    }
  }
  bulkSelectedAssets.clear();
  renderAssetCategories();
  renderAssetGrid();
}

async function bulkDeleteAssets() {
  if (bulkSelectedAssets.size === 0) return;
  const isConfirmed = await vtmConfirm(`Are you sure you want to permanently delete ${bulkSelectedAssets.size} assets?`, 'Bulk Delete');
  if (!isConfirmed) return;
  for (const selectedAssetId of bulkSelectedAssets) {
    // Perform an authenticated HTTP DELETE request to delete each selected asset from the server
    const fetchResponse = await authFetch(`/api/assets/${selectedAssetId}`, {
      method: 'DELETE'
    });
    if (fetchResponse.ok) {
      globalAssets = globalAssets.filter(assetRecord => assetRecord.id !== selectedAssetId);
    }
  }
  bulkSelectedAssets.clear();
  renderAssetCategories();
  renderAssetGrid();
}

function toggleSelectAllAssets() {
  const filteredAssetsList = globalAssets.filter(
    assetRecord => currentAssetCategory === null ? !assetRecord.category_id : assetRecord.category_id == currentAssetCategory
  );
  if (bulkSelectedAssets.size === filteredAssetsList.length && filteredAssetsList.length > 0) {
    bulkSelectedAssets.clear();
  } else {
    filteredAssetsList.forEach(assetRecord => bulkSelectedAssets.add(assetRecord.id));
  }
  renderAssetGrid();
}


async function deleteAssetCategory(categoryId, categoryName) {
    // Ask the user for confirmation via a browser confirm dialog before deleting the folder
    if (!confirm('Delete folder "' + categoryName + '"?\n\nAny child folders or images inside it will automatically be moved up into its parent folder (or Uncategorized if it has no parent).')) return;
    try {
        // Perform an authenticated HTTP DELETE request to delete the asset category folder
        const fetchResponse = await authFetch('/api/asset-categories/' + categoryId, { method: 'DELETE' });
        if (fetchResponse.ok) {
            currentAssetCategory = null;
            await fetchAssets();
        }
    } catch(errorObject) { console.error(errorObject); }
}

async function moveDraggedAssetsToCategory(draggedAssetIdString, targetCategoryId) {
    const draggedAssetId = parseInt(draggedAssetIdString);
    const assetIdsToMove = bulkSelectedAssets.has(draggedAssetId) ? Array.from(bulkSelectedAssets) : [draggedAssetId];
    
    // Add a visual loading state to the target folder if we want, but it's fast enough usually
    for (const assetId of assetIdsToMove) {
        try {
            // Perform an authenticated HTTP PUT request to update the category of each dragged asset
            const fetchResponse = await authFetch('/api/assets/' + assetId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ category_id: targetCategoryId || null })
            });
            if (fetchResponse.ok) {
                const matchingAssetRecord = globalAssets.find(assetRecord => assetRecord.id == assetId);
                if (matchingAssetRecord) matchingAssetRecord.category_id = targetCategoryId || null;
            }
        } catch(errorObject) { console.error(errorObject); }
    }
    bulkSelectedAssets.clear();
    renderAssetCategories();
    renderAssetGrid();
}

async function moveAssetCategoryNode(draggedFolderId, targetParentId) {
    if (draggedFolderId == targetParentId) return;
    
    // Circular dependency check
    let ancestorCategoryId = targetParentId;
    while (ancestorCategoryId !== null) {
        if (ancestorCategoryId == draggedFolderId) {
            // Display a browser alert dialog preventing circular folder nesting
            alert("You cannot move a folder into its own sub-folder!");
            return;
        }
        const parentCategoryRecord = globalAssetCategories.find(categoryRecord => categoryRecord.id == ancestorCategoryId);
        ancestorCategoryId = parentCategoryRecord ? parentCategoryRecord.parent_id : null;
    }
    
    try {
        // Perform an authenticated HTTP PUT request to update the parent folder of the dragged category
        const fetchResponse = await authFetch('/api/asset-categories/' + draggedFolderId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parent_id: targetParentId || null })
        });
        if (fetchResponse.ok) {
            await fetchAssets();
        }
    } catch(errorObject) { console.error(errorObject); }
}

async function reorderAssetCategoryNode(draggedFolderId, targetFolderId, dropPosition) {
    const draggedCategoryRecord = globalAssetCategories.find(categoryRecord => categoryRecord.id == draggedFolderId);
    const targetCategoryRecord = globalAssetCategories.find(categoryRecord => categoryRecord.id == targetFolderId);
    if (!draggedCategoryRecord || !targetCategoryRecord) return;
    
    const newParentId = targetCategoryRecord.parent_id;
    
    let ancestorCategoryId = newParentId;
    while (ancestorCategoryId !== null) {
        if (ancestorCategoryId == draggedFolderId) {
            // Display a browser alert dialog preventing circular folder nesting
            alert("You cannot move a folder into its own sub-folder!");
            return;
        }
        const parentCategoryRecord = globalAssetCategories.find(categoryRecord => categoryRecord.id == ancestorCategoryId);
        ancestorCategoryId = parentCategoryRecord ? parentCategoryRecord.parent_id : null;
    }
    
    draggedCategoryRecord.parent_id = newParentId;
    
    let siblingCategories = globalAssetCategories.filter(
        categoryRecord => categoryRecord.parent_id == newParentId && categoryRecord.id != draggedFolderId
    );
    siblingCategories.sort((firstCategory, secondCategory) => (firstCategory.sort_order || 0) - (secondCategory.sort_order || 0));
    
    const targetSiblingIndex = siblingCategories.findIndex(categoryRecord => categoryRecord.id == targetFolderId);
    if (targetSiblingIndex !== -1) {
        if (dropPosition === 'before') {
            siblingCategories.splice(targetSiblingIndex, 0, draggedCategoryRecord);
        } else {
            siblingCategories.splice(targetSiblingIndex + 1, 0, draggedCategoryRecord);
        }
    } else {
        siblingCategories.push(draggedCategoryRecord);
    }
    
    const reorderUpdates = [];
    siblingCategories.forEach((categoryRecord, sortOrderIndex) => {
        categoryRecord.sort_order = sortOrderIndex;
        reorderUpdates.push({ id: categoryRecord.id, parent_id: categoryRecord.parent_id, sort_order: sortOrderIndex });
    });
    
    
    globalAssetCategories.sort((firstCategory, secondCategory) => {
        if (firstCategory.sort_order !== secondCategory.sort_order) {
            return (firstCategory.sort_order || 0) - (secondCategory.sort_order || 0);
        }
        return (firstCategory.name || '').localeCompare(secondCategory.name || '');
    });
    renderAssetCategories();
    
    try {
        // Perform an authenticated HTTP PUT request to persist the new category sort order
        await authFetch('/api/asset-categories/reorder', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: reorderUpdates })
        });
    } catch(errorObject) { console.error(errorObject); }
}

async function editAssetCategory(categoryId, currentCategoryName) {
    const updatedCategoryName = await vtmPrompt('Enter a new name for the folder:', 'Rename Folder', currentCategoryName);
    if (!updatedCategoryName || updatedCategoryName.trim() === '' || updatedCategoryName === currentCategoryName) return;
    
    try {
        // Perform an authenticated HTTP PUT request to rename the asset category folder on the server
        const fetchResponse = await authFetch('/api/asset-categories/' + categoryId, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: updatedCategoryName.trim() })
        });
        if (fetchResponse.ok) {
            const matchingCategoryRecord = globalAssetCategories.find(categoryRecord => categoryRecord.id == categoryId);
            if (matchingCategoryRecord) matchingCategoryRecord.name = updatedCategoryName.trim();
            if (currentAssetCategory == categoryId) {
                // Look up the current asset category title element in the DOM by its ID
                document.getElementById('currentAssetCategoryTitle').innerText = updatedCategoryName.trim();
            }
            // Sort to ensure alphabetical order is maintained if they change name
            globalAssetCategories.sort((firstCategory, secondCategory) => {
                if (firstCategory.sort_order !== secondCategory.sort_order) {
                    return (firstCategory.sort_order || 0) - (secondCategory.sort_order || 0);
                }
                return (firstCategory.name || '').localeCompare(secondCategory.name || '');
            });
            renderAssetCategories();
        }
    } catch(errorObject) { console.error(errorObject); }
}

window.startInlineFolderEdit = function(categoryId, editIconElement) {
    const folderRowElement = editIconElement.closest('.asset-category-item');
    // Query the folder name span inside the folder row element
    const folderNameSpanElement = folderRowElement.querySelector('div span'); // The first span inside the left group is the name
    if (!folderNameSpanElement) return;
    
    const currentFolderName = folderNameSpanElement.innerText;
    
    // Create a temporary text <input> element in memory for inline folder renaming
    const inlineInputElement = document.createElement('input');
    inlineInputElement.type = 'text';
    inlineInputElement.value = currentFolderName;
    inlineInputElement.className = 'vtm-input';
    inlineInputElement.style.width = '100%';
    inlineInputElement.style.marginLeft = '4px';
    inlineInputElement.style.marginRight = '8px';
    inlineInputElement.style.padding = '2px 6px';
    inlineInputElement.style.fontSize = 'inherit';
    inlineInputElement.style.backgroundColor = 'rgba(0,0,0,0.5)';
    inlineInputElement.style.border = '1px solid #4a5568';
    inlineInputElement.style.color = '#e2e8f0';
    
    folderNameSpanElement.replaceWith(inlineInputElement);
    inlineInputElement.focus();
    // Move cursor to end of input
    inlineInputElement.setSelectionRange(inlineInputElement.value.length, inlineInputElement.value.length);
    
    const rightActionGroupElement = folderRowElement.children[1];
    if (rightActionGroupElement) rightActionGroupElement.style.display = 'none';
    
    folderRowElement.draggable = false;
    
    let isEditSaved = false;
    const saveInlineEdit = async () => {
        if (isEditSaved) return;
        isEditSaved = true;
        
        const updatedFolderName = inlineInputElement.value.trim();
        if (!updatedFolderName || updatedFolderName === currentFolderName) {
            renderAssetCategories();
            return;
        }
        
        try {
            // Perform an authenticated HTTP PUT request to save the new folder name
            const fetchResponse = await authFetch('/api/asset-categories/' + categoryId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: updatedFolderName })
            });
            if (fetchResponse.ok) {
                const matchingCategoryRecord = globalAssetCategories.find(categoryRecord => categoryRecord.id == categoryId);
                if (matchingCategoryRecord) matchingCategoryRecord.name = updatedFolderName;
                if (currentAssetCategory == categoryId) {
                    // Look up the current asset category title heading in the DOM by its ID
                    document.getElementById('currentAssetCategoryTitle').innerText = updatedFolderName;
                }
                globalAssetCategories.sort((firstCategory, secondCategory) => {
                    if (firstCategory.sort_order !== secondCategory.sort_order) return (firstCategory.sort_order || 0) - (secondCategory.sort_order || 0);
                    return (firstCategory.name || '').localeCompare(secondCategory.name || '');
                });
            }
        } catch(errorObject) { console.error(errorObject); }
        renderAssetCategories();
    };
    
    inlineInputElement.onkeydown = (keyboardEvent) => {
        if (keyboardEvent.key === 'Enter') {
            keyboardEvent.preventDefault();
            saveInlineEdit();
        }
        if (keyboardEvent.key === 'Escape') {
            keyboardEvent.preventDefault();
            isEditSaved = true;
            renderAssetCategories();
        }
    };
    
    inlineInputElement.onblur = () => saveInlineEdit();
    inlineInputElement.onclick = (mouseEvent) => mouseEvent.stopPropagation();
};


function handlePickerUrlInput() {
    // Prompt the user for a direct image URL using the browser prompt dialog
    const enteredImageUrl = prompt("Enter the direct URL to the image:");
    if (enteredImageUrl && enteredImageUrl.trim()) {
        if (assetPickerCallback) {
            assetPickerCallback(enteredImageUrl.trim());
            closeAssetPicker();
        }
    }
}




// Backwards-compatible aliases for legacy callers
window.switchGameboardMap = switchCityMap;
window.handleGameboardMapUpload = handleCityMapUpload;
window.pushMapToGameboard = pushMapToCityMap;
window.loadDrawerUnrevealedClues = loadOmniUnrevealedClues;
window.loadDrawerUnrevealedLore = loadOmniUnrevealedLore;
window.loadDrawerHookAndAgendas = loadOmniHookAndAgendas;
window.renderStoryWidgetEpisodes = renderChronicleTimelineEpisodes;
window.renderNpcCastWidget = renderCharacterCastWidget;
window.filterNpcCastList = filterCharacterCastList;
window.filterNpcCastCategory = filterCharacterCastCategory;
window.openChronicleLobby = openChronicleHub;
window.renderChronicleLobby = renderChronicleHub;
window.addClueToCorkboard = addClueToBoard;
Object.defineProperties(window, {
  activeCampaignId: { get: () => activeChronicleId, set: (newChronicleId) => { activeChronicleId = newChronicleId; }, configurable: true },
  activeCampaignRole: { get: () => activeChronicleRole, set: (newChronicleRole) => { activeChronicleRole = newChronicleRole; }, configurable: true },
  campaignCharactersList: { get: () => chronicleCharactersList, set: (newCharactersList) => { chronicleCharactersList = newCharactersList; }, configurable: true },
  campaignMembersList: { get: () => chronicleMembersList, set: (newMembersList) => { chronicleMembersList = newMembersList; }, configurable: true }
});
