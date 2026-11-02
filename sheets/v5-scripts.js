document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const charId = urlParams.get('char_id');
    const isReadonly = urlParams.get('readonly') === 'true';
    let currentSheetData = {};
    
    // Listen for sync messages from the VTT parent
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'sync_sheet_data') {
            if (event.data.sheet_data) {
                // Update our stale tracking object so triggerSave doesn't overwrite it
                currentSheetData = JSON.parse(JSON.stringify(event.data.sheet_data));
                
                // Re-render trackers in the DOM!
                document.querySelectorAll('.dot-group').forEach(group => {
                    if (!group.id) return;
                    let val = currentSheetData[group.id];
                    if (group.id === 'health') val = val || currentSheetData['health_states'];
                    if (group.id === 'willpower') val = val || currentSheetData['willpower_states'];
                    if (group.id === 'humanity') val = val || currentSheetData['humanity_states'];
                    
                    if (Array.isArray(val)) {
                        const dots = group.querySelectorAll('.dot');
                        
                        // If capacity changed (Widget added/removed boxes), we need to update our dots!
                        if (group.classList.contains('square-group') && (group.id === 'health_states' || group.id === 'willpower_states' || group.id === 'humanity_states')) {
                            // If the widget's array has more boxes than our DOM, we can't easily add elements here because they're static HTML,
                            // BUT we can at least map the existing dots to the new array state!
                            dots.forEach((dot, i) => {
                                if (val[i]) dot.setAttribute('data-state', val[i]);
                                else dot.setAttribute('data-state', 'empty');
                            });
                        } else {
                            dots.forEach((dot, i) => {
                                if (val[i]) dot.setAttribute('data-state', val[i]);
                            });
                        }
                    }
                });
            }
        }
    });

    // 0. GENERATE DOTS
    document.querySelectorAll('.dot-group').forEach(group => {
        if (group.children.length > 0 && group.querySelector('.dot')) return; // Already generated
        const max = parseInt(group.getAttribute('data-max') || '5');
        const isSquare = group.classList.contains('square-group');
        for (let i = 0; i < max; i++) {
            const dot = document.createElement('div');
            dot.className = isSquare ? 'dot square' : 'dot';
            group.appendChild(dot);
        }
    });


        // --- BEGIN DISCIPLINE IDS ---
    console.log("[DEBUG] Searching for Disciplines section...");
    let discHeaders = document.querySelectorAll('.section-header, .alt-header');
    let discSection = Array.from(discHeaders).find(h => h.textContent.toLowerCase().includes('disciplines'));
    console.log("[DEBUG] Found Discipline header:", !!discSection);
    if (discSection) {
        let grid = discSection.nextElementSibling;
        console.log("[DEBUG] Found Discipline grid:", !!grid);
        if (grid) {
            let columns = grid.querySelectorAll('.dot-row');
            console.log("[DEBUG] Found Discipline columns:", columns.length);
            columns.forEach((dotRow, discIndex) => {
                let discInput = dotRow.querySelector('input');
                let discDots = dotRow.querySelector('.dot-group');
                if (discInput) {
                    discInput.id = 'discipline_name_' + discIndex;
                    console.log("[DEBUG] Assigned ID:", discInput.id);
                }
                if (discDots) discDots.id = 'discipline_dots_' + discIndex;
                let powerInputs = dotRow.parentElement.querySelectorAll('.input-line input');
                powerInputs.forEach((pInput, pIndex) => {
                    pInput.id = 'discipline_power_' + discIndex + '_' + pIndex;
                });
                console.log(`[DEBUG] Assigned ${powerInputs.length} power IDs for Discipline ${discIndex}`);
            });
        }
    }
    // --- END DISCIPLINE IDS ---



    document.querySelectorAll('input, textarea, select').forEach((el, index) => {
        if (!el.id || el.id.startsWith('input_field')) {
            let parent = el.parentElement;
        let labelText = '';
        let lbl = parent.querySelector('label, span, .box-header, .box-label, .section-header, .alt-header');
        if (lbl) {
            labelText = lbl.textContent.trim();
        } else {
            let prev = el.previousElementSibling;
            if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.classList.contains('box-header') || prev.classList.contains('section-header') || prev.classList.contains('alt-header'))) {
                labelText = prev.textContent.trim();
            } else {
                // Check if it's the hunting roll input in the ALT sheet
                let parentPrev = parent.previousElementSibling;
                if (parentPrev && parentPrev.classList.contains('alt-header')) {
                    labelText = parentPrev.textContent.trim();
                } else {
                    labelText = 'field_' + index;
                }
            }
        }
        
            let baseId = labelText.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_');
            if (el.classList.contains('line-fill') && parent.querySelector('.dot-group')) {
                baseId += '_specialty';
            }
            if (!baseId) baseId = 'input_field';
            
            let finalId = baseId;
            let counter = 1;
            while (document.getElementById(finalId) && document.getElementById(finalId) !== el) {
                finalId = baseId + '_' + counter;
                counter++;
            }
            el.id = finalId;
        } // Close if(!el.id...) block
        
        if (isReadonly) el.readOnly = true;
        el.addEventListener('input', triggerSave);
    });


    // 3. Base ID for dot-groups
    document.querySelectorAll('.dot-group').forEach((group, index) => {
        if (!group.id || group.id.startsWith('group_') || group.id.startsWith('dot_group')) {
            let parent = group.parentElement;
        let labelText = '';
        let lbl = parent.querySelector('label, span, .box-header, .box-label, .section-header, .alt-header, .inline-label');
        if (lbl) {
            labelText = lbl.textContent.trim();
        } else {
            let parentPrev = parent.previousElementSibling;
            while (parentPrev && !labelText) {
                if (parentPrev.classList && (parentPrev.classList.contains('section-header') || parentPrev.classList.contains('alt-header') || parentPrev.classList.contains('box-header'))) {
                    labelText = parentPrev.textContent.trim();
                } else if (parentPrev.querySelector && parentPrev.querySelector('label, span, .section-header')) {
                    let innerLbl = parentPrev.querySelector('label, span, .section-header');
                    labelText = innerLbl.textContent.trim();
                }
                parentPrev = parentPrev.previousElementSibling;
            }
            if (!labelText) {
                let prev = group.previousElementSibling;
                if (prev && (prev.tagName === 'LABEL' || prev.tagName === 'SPAN' || prev.classList.contains('box-header') || prev.classList.contains('section-header') || prev.classList.contains('alt-header') || prev.classList.contains('inline-label'))) {
                    labelText = prev.textContent.trim();
                } else {
                    labelText = 'group_' + index;
                }
            }
        }
        
        let baseId = labelText.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_');
            if (!baseId) baseId = 'dot_group';
            
            let finalId = baseId;
            let counter = 1;
            while (document.getElementById(finalId) && document.getElementById(finalId) !== group) {
                finalId = baseId + '_' + counter;
                counter++;
            }
            group.id = finalId;
        } // Close the if (!group.id...) block
        
        // Setup click logic for trackers (Health, Willpower, Humanity)
        if (group.classList.contains('square-group')) {
            // Inject arrows if they don't exist
            if (!group.querySelector('.tracker-arrow')) {
                const leftArrow = document.createElement('span');
                leftArrow.className = 'tracker-arrow left-arrow';
                leftArrow.innerHTML = '&#9664;';
                leftArrow.style.cursor = 'pointer';
                leftArrow.style.marginRight = '5px';
                leftArrow.style.userSelect = 'none';
                
                const rightArrow = document.createElement('span');
                rightArrow.className = 'tracker-arrow right-arrow';
                rightArrow.innerHTML = '&#9654;';
                rightArrow.style.cursor = 'pointer';
                rightArrow.style.marginLeft = '5px';
                rightArrow.style.userSelect = 'none';
                
                group.insertBefore(leftArrow, group.firstChild);
                group.appendChild(rightArrow);
                
                leftArrow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (isReadonly) return;
                    const squares = Array.from(group.querySelectorAll('.dot.square'));
                    let states = squares.map(sq => sq.getAttribute('data-state') || 'empty');
                    
                    if (group.id === 'hunger' || group.id === 'humanity' || group.id === 'humanity_states') {
                        // Rating Tracker: Decrease rating (Remove right-most 'filled')
                        let lastFilled = states.lastIndexOf('filled');
                        if (lastFilled !== -1) {
                            squares[lastFilled].setAttribute('data-state', 'empty');
                            triggerSave();
                        }
                    } else {
                        // Capacity Tracker: Decrease capacity (Add 'filled' black box to the right-most white box)
                        let currentBlacks = states.filter(s => s === 'filled').length;
                        if (currentBlacks < squares.length) {
                            const targetIndex = squares.length - currentBlacks - 1;
                            squares[targetIndex].setAttribute('data-state', 'filled');
                            triggerSave();
                        }
                    }
                });
                
                rightArrow.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (isReadonly) return;
                    const squares = Array.from(group.querySelectorAll('.dot.square'));
                    let states = squares.map(sq => sq.getAttribute('data-state') || 'empty');
                    
                    if (group.id === 'hunger' || group.id === 'humanity' || group.id === 'humanity_states') {
                        // Rating Tracker: Increase rating (Add 'filled' to left-most 'empty')
                        let firstEmpty = states.indexOf('empty');
                        if (firstEmpty !== -1) {
                            squares[firstEmpty].setAttribute('data-state', 'filled');
                            triggerSave();
                        }
                    } else {
                        // Capacity Tracker: Increase capacity (Remove left-most 'filled' black box)
                        let currentBlacks = states.filter(s => s === 'filled').length;
                        if (currentBlacks > 0) {
                            const targetIndex = squares.length - currentBlacks;
                            squares[targetIndex].setAttribute('data-state', 'empty');
                            triggerSave();
                        }
                    }
                });
            }
            
            group.addEventListener('click', (e) => {
                if (e.target.classList.contains('square')) {
                    if (isReadonly) return;
                    if (group.id === 'hunger') return; // Hunger does not take damage!
                    
                    const curr = e.target.getAttribute('data-state') || 'empty';
                    if (curr === 'filled') return; // Don't cycle capacity boxes!
                    
                    if (curr === 'empty') {
                        e.target.setAttribute('data-state', 'superficial');
                    } else if (curr === 'superficial') {
                        if (group.id === 'humanity' || group.id === 'humanity_states') {
                            e.target.setAttribute('data-state', 'empty'); // Humanity only uses Stains (/)
                        } else {
                            e.target.setAttribute('data-state', 'aggravated');
                        }
                    } else {
                        e.target.setAttribute('data-state', 'empty');
                    }
                    
                    // Tracker sorting disabled for better UX
                    
                    triggerSave();
                }
            });
        } else {
            // Setup click logic for normal dots
            group.addEventListener('click', (e) => {
                if (isReadonly) return;
                if (e.target.classList.contains('dot')) {
                    const dots = Array.from(group.querySelectorAll('.dot'));
                    const index = dots.indexOf(e.target);
                    const isActive = e.target.classList.contains('active');
                    if (isActive && index === dots.length - 1) {
                        e.target.classList.remove('active');
                    } else if (isActive && index === dots.filter(d => d.classList.contains('active')).length - 1) {
                        e.target.classList.remove('active');
                    } else {
                        dots.forEach((dot, i) => {
                            if (i <= index) dot.classList.add('active');
                            else dot.classList.remove('active');
                        });
                    }
                    triggerSave();
                }
            });
        }
    });

    // 4. Inject Template Dropdown
    if (!isReadonly) {
        const templateSelect = document.createElement('div');
        templateSelect.innerHTML = `
            <div style="position:fixed; bottom: 24px; right: 24px; z-index:9999; background:rgba(18,25,34,0.95); padding:8px 12px; border-radius:6px; border:1px solid #7f1d1d; box-shadow: 0 4px 12px rgba(0,0,0,0.8); display:flex; align-items:center; gap:8px;">
                <label style="color:#d1d5db; font-family:'Bebas Neue', sans-serif; letter-spacing:1px; font-size:16px;">SHEET TEMPLATE</label>
                <select id="sheetTemplateSelect" style="background:#140e11; color:#ef4444; border:1px solid #372128; padding:4px 8px; border-radius:4px; font-weight:bold; outline:none; cursor:pointer;">
                    <option value="V5-Character-Sheet.html">Standard 2-Page</option>
                    <option value="V5-Character-Sheet-ALT.html">Alternative 2-Page</option>
                    <option value="V5-Character-Sheet-4pg.html">Extended 4-Page</option>
                </select>
            </div>
        `;
        document.body.appendChild(templateSelect);
        
        const currentFile = window.location.pathname.split('/').pop() || 'V5-Character-Sheet.html';
        document.getElementById('sheetTemplateSelect').value = currentFile;
        
        document.getElementById('sheetTemplateSelect').addEventListener('change', (e) => {
            const newTemplate = e.target.value;
            triggerSave(newTemplate);
            setTimeout(() => {
                window.location.href = `./${newTemplate}?char_id=${charId}&readonly=false`;
            }, 300);
        });
    }

    // 5. Load data from server
    if (charId) {
        fetch(`/api/characters/${charId}`)
        .then(res => res.json())
        .then(char => {
            // --- CUSTOM CLANS INJECTION ---
            if (char.chronicle_id) {
                fetch(`/api/clan-symbols?chronicleId=${char.chronicle_id}`, {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('vtm_auth_token') }
                })
                    .then(res => res.json())
                    .then(symbols => {
                        const clanSelect = document.getElementById('clan');
                        if (clanSelect && symbols && Array.isArray(symbols)) {
                            // Collect existing options to avoid duplicates
                            const existingOptions = Array.from(clanSelect.options).map(o => o.value.toLowerCase());
                            symbols.forEach(sym => {
                                if (sym.clan_name && !existingOptions.includes(sym.clan_name.toLowerCase()) && sym.clan_name.toLowerCase() !== 'custom') {
                                    const opt = document.createElement('option');
                                    opt.value = sym.clan_name;
                                    opt.textContent = sym.clan_name;
                                    // Insert right before the "custom" option at the bottom
                                    const customOpt = Array.from(clanSelect.options).find(o => o.value === 'custom');
                                    if (customOpt) {
                                        clanSelect.insertBefore(opt, customOpt);
                                    } else {
                                        clanSelect.appendChild(opt);
                                    }
                                }
                            });
                            // Re-apply the value if it was set
                            if (char.sheet_data && char.sheet_data.clan) {
                                // If the saved clan is completely custom and STILL not in the list, add it!
                                const savedClan = char.sheet_data.clan;
                                const finalOptions = Array.from(clanSelect.options).map(o => o.value.toLowerCase());
                                if (savedClan && !finalOptions.includes(savedClan.toLowerCase()) && savedClan.toLowerCase() !== 'custom' && savedClan.toLowerCase() !== 'mortal') {
                                    const opt = document.createElement('option');
                                    opt.value = savedClan;
                                    opt.textContent = savedClan;
                                    const customOpt = Array.from(clanSelect.options).find(o => o.value === 'custom');
                                    if (customOpt) clanSelect.insertBefore(opt, customOpt);
                                    else clanSelect.appendChild(opt);
                                }
                                clanSelect.value = savedClan;
                            }
                        }
                    }).catch(err => console.error("Error fetching clan symbols:", err));
            }
            // -------------------------------
            let sheet = char.sheet_data || {};
            if (typeof sheet === 'string') {
                try { sheet = JSON.parse(sheet); } catch(e){ sheet = {}; }
            }
            
            
            // --- CROSS-SHEET TRANSLATION LAYER ---
            sheet['total'] = sheet['total'] || sheet['total_experience'];
            sheet['spent'] = sheet['spent'] || sheet['spent_experience'];
            sheet['total_experience'] = sheet['total_experience'] || sheet['total'];
            sheet['spent_experience'] = sheet['spent_experience'] || sheet['spent'];
            
            sheet['predator_type'] = sheet['predator_type'] || sheet['predator'];
            sheet['predator'] = sheet['predator'] || sheet['predator_type'];

            if (sheet['history']) sheet['notes'] = sheet['notes'] || sheet['history'];

            // Consolidate Merits/Backgrounds/Flaws into Advantages & Flaws for the Main sheet
            let combinedAdv = [];
            
            // Extract from Merits, Backgrounds, Flaws across all 15 possible rows
            ['merit', 'background', 'flaw'].forEach(cat => {
                for(let i=1; i<=15; i++) {
                    let n = sheet[cat + '_name_' + i];
                    let d = sheet[cat + '_rating_' + i];
                    if (n) combinedAdv.push({ n, d });
                }
            });
            
            // Also extract from advantages_flaws to prevent dataloss of anything already saved there
            for(let i=1; i<=9; i++) {
                let n = sheet['adv_flaw_name_' + i];
                let d = sheet['adv_flaw_rating_' + i];
                if (n && !combinedAdv.find(x => x.n === n)) combinedAdv.push({ n, d });
            }
            
            // Re-map the combined list to the Main sheet's adv_flaw_name_X
            for(let i=1; i<=9; i++) {
                if (combinedAdv[i-1]) {
                    sheet['adv_flaw_name_' + i] = combinedAdv[i-1].n;
                    sheet['adv_flaw_rating_' + i] = combinedAdv[i-1].d;
                }
            }
            
            // Distribute back to Merits on the Extended/ALT sheets if they are missing
            for(let i=1; i<=9; i++) {
                let n = sheet['adv_flaw_name_' + i];
                if (n) {
                    let found = false;
                    ['merit', 'background', 'flaw'].forEach(cat => {
                        for(let j=1; j<=15; j++) {
                            if (sheet[cat + '_name_' + j] === n) found = true;
                        }
                    });
                    if (!found) {
                        for(let j=1; j<=15; j++) {
                            if (!sheet['merit_name_' + j]) {
                                sheet['merit_name_' + j] = n;
                                sheet['merit_rating_' + j] = sheet['adv_flaw_rating_' + i];
                                break;
                            }
                        }
                    }
                }
            }
            // -------------------------------------

            currentSheetData = sheet;
            document.querySelectorAll('input, textarea, select').forEach(el => {
                if (sheet[el.id] !== undefined) el.value = sheet[el.id];
            });
            
            // Seed specialties from native DB columns if they are not already in sheet_data
            if (sheet.specialties && typeof sheet.specialties === 'object') {
                for (const [skill, spec] of Object.entries(sheet.specialties)) {
                    let specInput = document.getElementById(skill + '_specialty');
                    if (specInput && !specInput.value.trim()) {
                        specInput.value = spec;
                    }
                }
            }
            // Seed disciplines from database format if they haven't been edited on this sheet yet
            console.log("[DEBUG] Checking disciplines_full in sheet:", !!sheet.disciplines_full);
            if (sheet.disciplines_full && Array.isArray(sheet.disciplines_full)) {
                sheet.disciplines_full.forEach((disc, discIndex) => {
                    console.log(`[DEBUG] Processing DB Discipline ${discIndex}: ${disc.name}`);
                    let dName = document.getElementById('discipline_name_' + discIndex);
                    let dDots = document.getElementById('discipline_dots_' + discIndex);
                    console.log(`[DEBUG] Found DOM element for Discipline ${discIndex}: `, !!dName);
                    if (dName) {
                        console.log(`[DEBUG] DOM element current value: '${dName.value}'`);
                        if (!dName.value.trim()) {
                            dName.value = disc.name;

                            console.log(`[DEBUG] Set value to: ${disc.name}`);
                        } else {
                            console.log(`[DEBUG] Value was already set, skipping overwrite.`);
                        }
                    }
                    if (dDots && !sheet[dDots.id]) {
                        let dots = dDots.querySelectorAll('.dot');
                        dots.forEach((dot, i) => { if (i < disc.level) dot.classList.add('active'); });
                    }
                    if (disc.powers && Array.isArray(disc.powers)) {
                        disc.powers.forEach((p, pIndex) => {
                            let pInput = document.getElementById('discipline_power_' + discIndex + '_' + pIndex);
                            if (pInput && !pInput.value.trim()) pInput.value = p;
                        });
                    }
                });
            }
            
            document.querySelectorAll('.dot-group').forEach(group => {
                let val = sheet[group.id];
                if (group.id === 'health') val = val || sheet['health_states'];
                if (group.id === 'willpower') val = val || sheet['willpower_states'];
                if (group.id === 'humanity') val = val || sheet['humanity_states'];
                if (Array.isArray(val)) {
                    const dots = group.querySelectorAll('.dot');
                    dots.forEach((dot, i) => {
                        if (val[i]) dot.setAttribute('data-state', val[i]);
                    });
                } else if (val !== undefined) {
                    const dots = group.querySelectorAll('.dot');
                    dots.forEach((dot, i) => {
                        if (i < val) dot.classList.add('active');
                        else dot.classList.remove('active');
                    });
                }
            });
        });
    }

    
    

    // --- UI: SAVE INDICATOR ---
    const saveIndicator = document.createElement('div');
    saveIndicator.id = 'sheet-save-indicator';
    saveIndicator.style.position = 'fixed';
    saveIndicator.style.bottom = '20px';
    saveIndicator.style.right = '20px';
    saveIndicator.style.padding = '8px 16px';
    saveIndicator.style.borderRadius = '4px';
    saveIndicator.style.fontFamily = '"Goudy Old Style", serif';
    saveIndicator.style.fontSize = '14px';
    saveIndicator.style.fontWeight = 'bold';
    saveIndicator.style.zIndex = '9999';
    saveIndicator.style.transition = 'opacity 0.3s';
    saveIndicator.style.opacity = '0';
    saveIndicator.style.pointerEvents = 'none';
    document.body.appendChild(saveIndicator);

    function showSaveState(state, message) {
        saveIndicator.style.opacity = '1';
        saveIndicator.innerText = message;
        if (state === 'saving') {
            saveIndicator.style.backgroundColor = '#f39c12';
            saveIndicator.style.color = '#fff';
        } else if (state === 'saved') {
            saveIndicator.style.backgroundColor = '#27ae60';
            saveIndicator.style.color = '#fff';
            setTimeout(() => { saveIndicator.style.opacity = '0'; }, 2000);
        } else if (state === 'error') {
            saveIndicator.style.backgroundColor = '#c0392b';
            saveIndicator.style.color = '#fff';
        }
    }

    // --- GLOBAL ERROR CATCHER ---
    window.addEventListener('error', (e) => {
        showSaveState('error', 'SCRIPT ERROR: ' + e.message);
        console.error("Global Sheet Error:", e.error);
    });
    window.addEventListener('unhandledrejection', (e) => {
        showSaveState('error', 'PROMISE ERROR: ' + e.reason);
        console.error("Unhandled Rejection:", e.reason);
    });

    // 6. Save function
    let saveTimeout = null;
    function triggerSave(overrideTemplate = null) {
    if (overrideTemplate && typeof overrideTemplate !== "string") overrideTemplate = null;
        if (!charId || isReadonly) return;
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            let sheet = Object.assign({}, currentSheetData);
            document.querySelectorAll('input, textarea, select').forEach(el => {
                sheet[el.id] = el.value;
            });
            document.querySelectorAll('.dot-group').forEach(group => {
                if (group.classList.contains('square-group')) {
                    const states = Array.from(group.querySelectorAll('.dot')).map(d => d.getAttribute('data-state') || 'empty');
                    sheet[group.id] = states;
                } else {
                    const rating = group.querySelectorAll('.dot.active').length;
                    sheet[group.id] = rating;
                }
            });

            // Retain the template choice
            const currentFile = overrideTemplate || window.location.pathname.split('/').pop() || 'V5-Character-Sheet.html';
            sheet.sheet_template = currentFile;
            
            showSaveState('saving', 'Saving...');
            const token = localStorage.getItem('vtm_auth_token');
            fetch(`/api/characters/${charId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({ sheet_data: sheet })
            }).then(async (res) => {
                if (!res.ok) {
                    let errMsg = res.statusText;
                    try {
                        const errData = await res.json();
                        errMsg = errData.error || errMsg;
                    } catch(e) {}
                    console.error('[CRITICAL] Sheet Save Failed:', res.status, errMsg);
                    showSaveState('error', 'SAVE FAILED: ' + errMsg);
                    alert('Save Failed! Your changes were rejected by the server: ' + errMsg);
                } else {
                    showSaveState('saved', 'All changes saved.');
                }
            }).catch(err => {
                console.error('[CRITICAL] Network error during save:', err);
                showSaveState('error', 'NETWORK ERROR');
                alert('Network Error! Could not reach the server to save your changes.');
            });
        }, 500);
    }
});
