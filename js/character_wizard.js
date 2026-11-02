/**
 * @file character_wizard.js
 * @description
 * Interactive 8-Step Vampire: The Masquerade 5th Edition (V5) Guided Character Creator.
 *
 * Steps:
 * 1. Identity & Sheet Template (Name, Concept, Ambition, Desire, Sheet Template, Role)
 * 2. Clan & Lineage (16 Clans with optional 5-Question Personality Quiz, Sire, Sect)
 * 3. Sea of Time (Childer/Fledgling, Neonate, Ancilla — Generation, Blood Potency, Humanity, XP)
 * 4. Attributes (1×4, 3×3, 4×2, 1×1 with direct dot clicking, token assignment, presets & live Health/Willpower)
 * 5. Skills & Specialties (Balanced, Jack-of-all-Trades, Specialist arrays + Free Specialty + Craft/Academics/Performance/Science specialties)
 * 6. Predator Type (12 V5 Predator Types + interactive choice of Predator Specialty & +1 Discipline dot)
 * 7. Disciplines & Powers (2-dot & 1-dot starting Disciplines + automatic Predator Type +1 dot integration up to Level 3)
 * 8. Advantages, Flaws & Biography (Merits, Backgrounds, Flaws separated + Predator bonuses + Convictions, Touchstones & Backstory)
 */

let cw_step = 1;
const CW_TOTAL_STEPS = 8;
let cw_active_token = null;
let cw_skill_array_type = 'Balanced';
let cw_quiz_open = false;
let cw_adv_filter = 'Backgrounds';

const SKILL_ARRAYS = {
    'Balanced': [3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1],
    'Jack-of-all-Trades': [3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    'Specialist': [4, 3, 3, 2, 2, 2, 1, 1, 1, 1]
};

const ATTRIBUTE_ARRAY = [4, 3, 3, 3, 2, 2, 2, 2, 1];

const CW_STEP_LABELS = [
    "1. Identity",
    "2. Clan",
    "3. Age & Gen",
    "4. Attributes",
    "5. Skills",
    "6. Predator",
    "7. Disciplines",
    "8. Advantages & Bio"
];

const CW_SKILL_CATEGORIES = {
    physical: ["athletics", "brawl", "craft", "drive", "firearms", "larceny", "melee", "stealth", "survival"],
    social: ["animal_ken", "etiquette", "insight", "intimidation", "leadership", "performance", "persuasion", "streetwise", "subterfuge"],
    mental: ["academics", "awareness", "finance", "investigation", "medicine", "occult", "politics", "science", "technology"]
};

const CW_AUTO_SPECIALTY_SKILLS = ["academics", "craft", "performance", "science"];

let cw_char = {};

/**
 * Creates a fresh default `cw_char` state object for the wizard.
 *
 * @returns {Object} Initial character state.
 */
function createInitialWizardState() {
    const initialSkillsObject = {};
    [...CW_SKILL_CATEGORIES.physical, ...CW_SKILL_CATEGORIES.social, ...CW_SKILL_CATEGORIES.mental].forEach(skillKey => {
        initialSkillsObject[skillKey] = 0;
    });

    return {
        name: '',
        short_name: '',
        concept: '',
        ambition: '',
        desire: '',
        sheet_template: 'V5-Character-Sheet.html',
        category: 'pc',
        quiz_answers: [],
        clan: 'Brujah',
        sire: '',
        sect: 'Camarilla',
        age_tier: 'Neonate', // 'Fledgling', 'Neonate', 'Ancilla'
        generation: '13th',
        attributes: {
            strength: 0, dexterity: 0, stamina: 0,
            charisma: 0, manipulation: 0, composure: 0,
            intelligence: 0, wits: 0, resolve: 0
        },
        skills: initialSkillsObject,
        free_specialty_skill: '',
        free_specialty_text: '',
        auto_specialties: {
            academics: '',
            craft: '',
            performance: '',
            science: ''
        },
        predator_type: '',
        predator_specialty_skill: '',
        predator_specialty_text: '',
        predator_discipline: '',
        predator_custom_notes: {},
        disc_primary: 'Celerity',
        disc_secondary: 'Potence',
        disc_powers: {}, // { [discName]: [power1, power2, ...] }
        merits: [],      // { name, rating, desc, category: 'merit' | 'background' }
        flaws: [],       // { name, rating, desc, category: 'flaw' }
        touchstones: '',
        chronicle_tenets: '',
        true_age: '',
        apparent_age: '',
        dob: '',
        dod: '',
        appearance: '',
        distinguishing_features: '',
        history: ''
    };
}

/**
 * Initializes and opens the Character Creation Wizard modal.
 * Resets the current step to 1 and populates default `cw_char` state.
 *
 * @returns {void}
 */
function openCharacterCreatorModal() {
    cw_step = 1;
    cw_active_token = null;
    cw_skill_array_type = 'Balanced';
    cw_quiz_open = false;
    cw_adv_filter = 'Backgrounds';
    cw_char = createInitialWizardState();

    // document.getElementById locates the Character Creator modal overlay in the DOM so we can make it visible
    const creatorModalElement = document.getElementById('characterCreatorModal');
    if (creatorModalElement) creatorModalElement.style.display = 'flex';
    renderWizardStep();
}

/**
 * Closes the Character Creation Wizard modal.
 *
 * @returns {void}
 */
function closeCharacterCreator() {
    // document.getElementById locates the Character Creator modal overlay so we can hide it
    const creatorModalElement = document.getElementById('characterCreatorModal');
    if (creatorModalElement) creatorModalElement.style.display = 'none';
}

/**
 * Evaluates the user's answers from the optional 5-question personality quiz
 * to recommend V5 Clans.
 *
 * @returns {string[]} Sorted array of clan names from highest match to lowest.
 */
function calculateRecommendedClans() {
    const clanScores = {};
    for (const clanName in V5_DATA.clans) clanScores[clanName] = 0;

    const firstQuestionAnswer = cw_char.quiz_answers[0];
    if (firstQuestionAnswer === 'force') { clanScores['Brujah'] += 2; clanScores['Gangrel'] += 2; clanScores['Potence'] = 1; }
    if (firstQuestionAnswer === 'manipulate') { clanScores['Ventrue'] += 2; clanScores['Lasombra'] += 2; clanScores['The Ministry'] += 2; clanScores['Toreador'] += 1; }
    if (firstQuestionAnswer === 'stealth') { clanScores['Nosferatu'] += 2; clanScores['Obfuscate'] = 1; clanScores['Banu Haqim'] += 1; clanScores['Ravnos'] += 2; }
    if (firstQuestionAnswer === 'knowledge') { clanScores['Tremere'] += 2; clanScores['Malkavian'] += 2; clanScores['Hecata'] += 2; clanScores['Tzimisce'] += 1; }

    const secondQuestionAnswer = cw_char.quiz_answers[1];
    if (secondQuestionAnswer === 'elite') { clanScores['Ventrue'] += 2; clanScores['Toreador'] += 2; clanScores['Lasombra'] += 1; }
    if (secondQuestionAnswer === 'punk') { clanScores['Brujah'] += 2; clanScores['The Ministry'] += 1; clanScores['Caitiff'] += 1; clanScores['Thin-Blood'] += 1; }
    if (secondQuestionAnswer === 'outcast') { clanScores['Gangrel'] += 2; clanScores['Nosferatu'] += 2; clanScores['Caitiff'] += 2; clanScores['Ravnos'] += 2; }
    if (secondQuestionAnswer === 'occult') { clanScores['Tremere'] += 2; clanScores['Hecata'] += 2; clanScores['Malkavian'] += 1; clanScores['Salubri'] += 1; }

    const thirdQuestionAnswer = cw_char.quiz_answers[2];
    if (thirdQuestionAnswer === 'loss_of_control') { clanScores['Ventrue'] += 1; clanScores['Tremere'] += 1; clanScores['Banu Haqim'] += 2; }
    if (thirdQuestionAnswer === 'irrelevance') { clanScores['Toreador'] += 2; clanScores['Brujah'] += 1; clanScores['Lasombra'] += 2; }
    if (thirdQuestionAnswer === 'exposure') { clanScores['Nosferatu'] += 2; clanScores['Ravnos'] += 1; clanScores['Salubri'] += 2; clanScores['The Ministry'] += 1; }
    if (thirdQuestionAnswer === 'servitude') { clanScores['Gangrel'] += 2; clanScores['Tzimisce'] += 2; clanScores['Caitiff'] += 1; }

    const fourthQuestionAnswer = cw_char.quiz_answers[3];
    if (fourthQuestionAnswer === 'power') { clanScores['Ventrue'] += 2; clanScores['Lasombra'] += 2; clanScores['Tremere'] += 1; clanScores['Tzimisce'] += 2; }
    if (fourthQuestionAnswer === 'passion') { clanScores['Toreador'] += 2; clanScores['Brujah'] += 2; clanScores['The Ministry'] += 2; }
    if (fourthQuestionAnswer === 'truth') { clanScores['Malkavian'] += 2; clanScores['Hecata'] += 1; clanScores['Nosferatu'] += 1; clanScores['Banu Haqim'] += 1; }
    if (fourthQuestionAnswer === 'survival') { clanScores['Gangrel'] += 2; clanScores['Thin-Blood'] += 3; clanScores['Caitiff'] += 2; clanScores['Ravnos'] += 2; }

    const fifthQuestionAnswer = cw_char.quiz_answers[4];
    if (fifthQuestionAnswer === 'monster') { clanScores['Hecata'] += 1; clanScores['Lasombra'] += 2; clanScores['Tzimisce'] += 2; clanScores['The Ministry'] += 1; }
    if (fifthQuestionAnswer === 'curse') { clanScores['Salubri'] += 3; clanScores['Thin-Blood'] += 2; clanScores['Malkavian'] += 1; clanScores['Toreador'] += 1; }
    if (fifthQuestionAnswer === 'weapon') { clanScores['Banu Haqim'] += 2; clanScores['Brujah'] += 2; clanScores['Tremere'] += 1; }

    return Object.keys(V5_DATA.clans).sort((firstClanName, secondClanName) => (clanScores[secondClanName] || 0) - (clanScores[firstClanName] || 0));
}

/**
 * Jumps directly to an earlier completed step (or next step if current step is valid).
 *
 * @param {number} targetStep - 1-indexed step number.
 * @returns {void}
 */
function jumpToWizardStep(targetStep) {
    if (targetStep === cw_step) return;
    if (targetStep < cw_step) {
        saveWizardStep();
        cw_step = targetStep;
        cw_active_token = null;
        renderWizardStep();
    } else if (targetStep === cw_step + 1) {
        nextWizardStep();
    }
}

/**
 * Renders the top step-indicator bar inside `#cw-stepper`.
 *
 * @returns {void}
 */
function renderStepperBar() {
    // document.getElementById locates the top wizard step-indicator container element
    const stepperContainerElement = document.getElementById('cw-stepper');
    if (!stepperContainerElement) return;

    const stepsHtml = CW_STEP_LABELS.map((stepLabel, stepIndex) => {
        const stepNumber = stepIndex + 1;
        const isCurrentStep = stepNumber === cw_step;
        const isCompletedStep = stepNumber < cw_step;
        const buttonBackground = isCurrentStep ? '#ef4444' : (isCompletedStep ? 'rgba(168, 85, 247, 0.22)' : 'rgba(39, 39, 42, 0.6)');
        const buttonBorderColor = isCurrentStep ? '#ef4444' : (isCompletedStep ? '#a855f7' : '#3f3f46');
        const buttonTextColor = isCurrentStep ? '#ffffff' : (isCompletedStep ? '#e9d5ff' : '#a1a1aa');
        const buttonCursorStyle = stepNumber <= cw_step + 1 ? 'pointer' : 'default';
        return `<button type="button" onclick="jumpToWizardStep(${stepNumber})" style="background:${buttonBackground}; border:1px solid ${buttonBorderColor}; color:${buttonTextColor}; padding:5px 10px; border-radius:4px; font-size:11px; font-weight:${isCurrentStep ? '700' : '500'}; cursor:${buttonCursorStyle}; white-space:nowrap; transition:all 0.15s;">
            ${isCompletedStep ? '<i class="fa-solid fa-check" style="margin-right:3px;font-size:10px;"></i>' : ''}${stepLabel}
        </button>`;
    }).join('');

    stepperContainerElement.innerHTML = `<div style="display:flex; gap:6px; overflow-x:auto; align-items:center;">${stepsHtml}</div>`;
}

/**
 * Updates the compact character summary in the modal footer (`#cw-step-summary`).
 *
 * @returns {void}
 */
function renderFooterSummary() {
    // document.getElementById locates the footer summary element inside the wizard modal
    const summaryContainerElement = document.getElementById('cw-step-summary');
    if (!summaryContainerElement) return;
    const summaryParts = [];
    if (cw_char.name) summaryParts.push(`<strong style="color:#e4e4e7;">${escapeWizardHtml(cw_char.name)}</strong>`);
    if (cw_char.clan) summaryParts.push(`<span style="color:#a855f7;">${escapeWizardHtml(cw_char.clan)}</span>`);
    if (cw_char.age_tier) summaryParts.push(`<span>${escapeWizardHtml(cw_char.age_tier)} (${escapeWizardHtml(cw_char.generation)})</span>`);
    if (cw_char.predator_type && cw_char.predator_type !== 'None') summaryParts.push(`<span style="color:#f87171;">${escapeWizardHtml(cw_char.predator_type)}</span>`);
    summaryContainerElement.innerHTML = summaryParts.join(' &bull; ');
}

/**
 * Escapes HTML special characters for safe rendering inside wizard templates.
 *
 * @param {string} rawString - Input string.
 * @returns {string} Escaped HTML string.
 */
function escapeWizardHtml(rawString) {
    if (rawString === null || rawString === undefined) return '';
    return String(rawString)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Computes the character's effective Blood Potency based on Clan, Age Tier, and Generation.
 *
 * @returns {number} Blood Potency rating (0 to 2).
 */
function getWizardBloodPotency() {
    if (cw_char.clan === 'Thin-Blood' || ['14th', '15th', '16th'].includes(cw_char.generation)) {
        return 0;
    }
    if (cw_char.age_tier === 'Ancilla' || ['10th', '11th'].includes(cw_char.generation)) {
        return 2;
    }
    return 1;
}

/**
 * Computes the character's starting Humanity including Age Tier and Predator Type modifiers.
 *
 * @returns {number} Starting Humanity (1 to 10).
 */
function getWizardStartingHumanity() {
    let baseHumanity = cw_char.age_tier === 'Ancilla' ? 6 : 7;
    if (cw_char.predator_type && cw_char.predator_type !== 'None' && V5_DATA.predator_types[cw_char.predator_type]) {
        baseHumanity += (V5_DATA.predator_types[cw_char.predator_type].humanity_change || 0);
    }
    return Math.max(1, Math.min(10, baseHumanity));
}

/**
 * Returns the Blood Potency table row for a given Blood Potency rating.
 *
 * @param {number} bloodPotencyRating - Blood Potency rating (0 to 2).
 * @returns {Object} Blood Potency derived traits.
 */
function getWizardBloodPotencyStats(bloodPotencyRating) {
    if (bloodPotencyRating <= 0) {
        return {
            blood_surge: "1 die",
            mend_amount: "1 Superficial",
            power_bonus: "None",
            rouse_reroll: "None",
            bane_severity: 0,
            feeding_penalty: "None"
        };
    }
    if (bloodPotencyRating === 1) {
        return {
            blood_surge: "2 dice",
            mend_amount: "1 Superficial",
            power_bonus: "None",
            rouse_reroll: "Level 1",
            bane_severity: 2,
            feeding_penalty: "None"
        };
    }
    return {
        blood_surge: "2 dice",
        mend_amount: "2 Superficial",
        power_bonus: "1 die",
        rouse_reroll: "Level 1",
        bane_severity: 2,
        feeding_penalty: "Animal & bagged blood slake half"
    };
}

/**
 * Renders the current step of the Character Creation Wizard.
 *
 * @returns {void}
 */
function renderWizardStep() {
    // document.getElementById looks up the wizard modal's title, lore prompt, content container, error banner, and navigation buttons
    const titleElement = document.getElementById('cw-title');
    const promptElement = document.getElementById('cw-prompt');
    const contentContainerElement = document.getElementById('cw-content');
    const errorBannerElement = document.getElementById('cw-error');
    const previousButtonElement = document.getElementById('cw-btn-prev');
    const nextButtonElement = document.getElementById('cw-btn-next');

    if (errorBannerElement) errorBannerElement.style.display = 'none';
    if (previousButtonElement) previousButtonElement.style.visibility = cw_step === 1 ? 'hidden' : 'visible';
    if (nextButtonElement) {
        if (cw_step === CW_TOTAL_STEPS) {
            nextButtonElement.innerHTML = '<i class="fa-solid fa-check"></i> Embrace Character';
            nextButtonElement.style.background = '#dc2626';
        } else {
            nextButtonElement.innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
            nextButtonElement.style.background = '';
        }
    }

    renderStepperBar();
    renderFooterSummary();

    // =========================================================================
    // STEP 1: IDENTITY & SHEET TEMPLATE
    // =========================================================================
    if (cw_step === 1) {
        titleElement.innerText = "Step 1: Identity, Concept & Sheet Template";
        promptElement.innerText = "\"Before the Blood claimed you, you had a name, a mortal calling, and desires that refuse to die. Who were you—and which sheet will chronicle your unlife?\"";

        const isStorytellerOrGM = typeof activeChronicleRole !== 'undefined' && (activeChronicleRole === 'gm' || activeChronicleRole === 'storyteller');
        const sheetTemplateOptions = [
            {
                id: 'V5-Character-Sheet.html',
                title: 'Standard 2-Page Sheet',
                desc: 'Classic official V5 2-page layout with unified Advantages & Flaws (M/B/F badges) and 10-box trackers.'
            },
            {
                id: 'V5-Character-Sheet-ALT.html',
                title: 'Alternative 2-Page Sheet',
                desc: 'Expanded 2-page layout featuring separate Merits, Backgrounds, and Flaws columns and 15-box trackers.'
            },
            {
                id: 'V5-Character-Sheet-4pg.html',
                title: 'Expanded 4-Page Sheet',
                desc: 'Comprehensive 4-page dossier adding Blood Sorcery Rituals, Haven Merits/Flaws, Vehicles, and extended Lore.'
            }
        ];

        const templateCardsHtml = sheetTemplateOptions.map(templateOption => {
            const isTemplateSelected = cw_char.sheet_template === templateOption.id;
            return `
                <label onclick="selectWizardTemplate('${templateOption.id}')" style="display:block; padding:12px; border:1px solid ${isTemplateSelected ? '#ef4444' : '#3f3f46'}; border-radius:6px; cursor:pointer; background:${isTemplateSelected ? 'rgba(239, 68, 68, 0.14)' : 'rgba(0,0,0,0.35)'}; transition:all 0.15s;">
                    <input type="radio" name="cw_tpl_radio" value="${templateOption.id}" ${isTemplateSelected ? 'checked' : ''} style="display:none;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="color:#fff; font-size:13px;">${templateOption.title}</strong>
                        ${isTemplateSelected ? '<i class="fa-solid fa-circle-check" style="color:#ef4444;"></i>' : ''}
                    </div>
                    <div style="font-size:11px; color:#a1a1aa; line-height:1.4;">${templateOption.desc}</div>
                </label>
            `;
        }).join('');

        contentContainerElement.innerHTML = `
            <div style="display:grid; grid-template-columns:2fr 1fr; gap:15px; margin-bottom:15px;">
                <div class="form-col">
                    <label>Character Full Name <span style="color:#ef4444;">*</span></label>
                    <input type="text" id="cw_name" class="vtm-input" value="${escapeWizardHtml(cw_char.name)}" placeholder="e.g. Victoria Ash">
                </div>
                <div class="form-col">
                    <label>Short Name / Moniker (Optional)</label>
                    <input type="text" id="cw_short_name" class="vtm-input" value="${escapeWizardHtml(cw_char.short_name)}" placeholder="e.g. Victoria">
                </div>
            </div>
            <div class="form-col" style="margin-bottom:15px;">
                <label>Character Concept <span style="color:#ef4444;">*</span></label>
                <input type="text" id="cw_concept" class="vtm-input" value="${escapeWizardHtml(cw_char.concept)}" placeholder="e.g. Disgraced Forensic Pathologist, Underground Punk Promoter, Paranoid Hacker">
                <small style="color:#a1a1aa; margin-top:4px; display:block;">A concise 2–4 word summary of who your character was in mortal life and how they operate tonight.</small>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:18px;">
                <div class="form-col">
                    <label>Ambition (Long-Term Goal)</label>
                    <input type="text" id="cw_ambition" class="vtm-input" value="${escapeWizardHtml(cw_char.ambition)}" placeholder="e.g. Clear my mortal family's debt and destroy my Sire's rival">
                </div>
                <div class="form-col">
                    <label>Desire (Immediate Session Goal)</label>
                    <input type="text" id="cw_desire" class="vtm-input" value="${escapeWizardHtml(cw_char.desire)}" placeholder="e.g. Secure feeding rights to the Velvet Lounge">
                </div>
            </div>
            <div class="form-col" style="margin-bottom:15px;">
                <label style="margin-bottom:8px; display:block;">Preferred Character Sheet Template <span style="color:#a1a1aa; font-weight:normal; font-size:11px;">(You can freely switch templates at any time later!)</span></label>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
                    ${templateCardsHtml}
                </div>
            </div>
            ${isStorytellerOrGM ? `
            <div class="form-col" style="margin-top:12px; padding-top:12px; border-top:1px solid #27272a;">
                <label>Storyteller Option: Character Classification</label>
                <select id="cw_category" class="vtm-input" style="max-width:320px;">
                    <option value="pc" ${cw_char.category === 'pc' ? 'selected' : ''}>Player Character (PC)</option>
                    <option value="Uncategorized" ${cw_char.category !== 'pc' ? 'selected' : ''}>Storyteller NPC</option>
                </select>
            </div>
            ` : ''}
        `;
    }

    // =========================================================================
    // STEP 2: CLAN & LINEAGE (WITH OPTIONAL PERSONALITY QUIZ)
    // =========================================================================
    else if (cw_step === 2) {
        titleElement.innerText = "Step 2: Clan, Lineage & Sect";
        promptElement.innerText = "\"Sixteen lineages carry the curse of Caine—or none at all. Pick your Clan directly below, or open the optional 5-Question Quiz if you want help finding a match.\"";

        const hasCompletedQuiz = cw_char.quiz_answers.filter(Boolean).length === 5;
        const recommendedClansList = hasCompletedQuiz ? calculateRecommendedClans() : [];
        const topThreeRecommendedClans = recommendedClansList.slice(0, 3);

        const clanNamesList = Object.keys(V5_DATA.clans);
        if (hasCompletedQuiz) {
            clanNamesList.sort((firstClan, secondClan) => recommendedClansList.indexOf(firstClan) - recommendedClansList.indexOf(secondClan));
        }

        const selectedClanData = V5_DATA.clans[cw_char.clan] || V5_DATA.clans['Brujah'];

        const clanCardsHtml = clanNamesList.map(clanName => {
            const clanMetadata = V5_DATA.clans[clanName];
            const isSelected = cw_char.clan === clanName;
            const isTopMatch = topThreeRecommendedClans.includes(clanName);
            const matchRank = topThreeRecommendedClans.indexOf(clanName) + 1;

            let symbolHtml = '';
            if (typeof globalClanSymbols !== 'undefined' && Array.isArray(globalClanSymbols)) {
                const matchingSymbolRecord = globalClanSymbols.find(symbolEntry => symbolEntry.clan_name && symbolEntry.clan_name.toLowerCase() === clanName.toLowerCase());
                if (matchingSymbolRecord && matchingSymbolRecord.symbol_url) {
                    symbolHtml = `<img src="${escapeWizardHtml(matchingSymbolRecord.symbol_url)}" alt="${escapeWizardHtml(clanName)}" style="width:28px; height:28px; object-fit:contain; filter:drop-shadow(0 0 4px rgba(0,0,0,0.8));">`;
                }
            }

            const disciplineBadgesHtml = (clanName === 'Caitiff' ? ['Any 2 Disciplines'] : clanMetadata.disciplines).map(disciplineName =>
                `<span style="background:rgba(168, 85, 247, 0.18); border:1px solid rgba(168, 85, 247, 0.4); color:#e9d5ff; font-size:10px; padding:1px 6px; border-radius:3px;">${escapeWizardHtml(disciplineName)}</span>`
            ).join(' ');

            return `
                <div onclick="selectWizardClan('${clanName}')" style="padding:12px; border:1px solid ${isSelected ? '#ef4444' : (isTopMatch ? '#a855f7' : '#3f3f46')}; border-radius:6px; cursor:pointer; background:${isSelected ? 'rgba(239, 68, 68, 0.16)' : 'rgba(0,0,0,0.35)'}; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.15s;">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                ${symbolHtml}
                                <strong style="color:#fff; font-size:14px;">${escapeWizardHtml(clanName)}</strong>
                            </div>
                            ${isTopMatch ? `<span style="background:#a855f7; color:#fff; font-size:10px; font-weight:bold; padding:2px 6px; border-radius:4px;">#${matchRank} Quiz Match</span>` : ''}
                        </div>
                        <div style="display:flex; flex-wrap:wrap; gap:4px; margin-bottom:6px;">${disciplineBadgesHtml}</div>
                        <p style="font-size:11px; color:#a1a1aa; margin:0; line-height:1.4;">${escapeWizardHtml(clanMetadata.desc)}</p>
                    </div>
                </div>
            `;
        }).join('');

        contentContainerElement.innerHTML = `
            <!-- Collapsible Optional Quiz -->
            <div style="margin-bottom:16px; background:rgba(168, 85, 247, 0.08); border:1px solid rgba(168, 85, 247, 0.35); border-radius:6px; padding:10px 14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="toggleWizardClanQuiz()">
                    <span style="color:#e9d5ff; font-size:13px; font-weight:600;"><i class="fa-solid fa-compass" style="margin-right:6px; color:#a855f7;"></i> Not sure which Clan fits your character? Take the optional 5-Question Quiz</span>
                    <span style="color:#a855f7; font-size:12px;">${cw_quiz_open ? 'Hide Quiz ▲' : 'Open Quiz ▼'}</span>
                </div>
                <div id="cw-quiz-panel" style="display:${cw_quiz_open ? 'block' : 'none'}; margin-top:12px; padding-top:12px; border-top:1px solid rgba(168, 85, 247, 0.25);">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; font-size:12px;">
                        <div>
                            <strong style="color:#fff; display:block; margin-bottom:4px;">1. How do you solve a serious problem?</strong>
                            <select class="vtm-input" onchange="setWizardQuizAnswer(0, this.value)">
                                <option value="">-- Choose --</option>
                                <option value="force" ${cw_char.quiz_answers[0]==='force'?'selected':''}>Smash through it with raw force and intimidation</option>
                                <option value="manipulate" ${cw_char.quiz_answers[0]==='manipulate'?'selected':''}>Charm, bribe, or manipulate others to do it</option>
                                <option value="stealth" ${cw_char.quiz_answers[0]==='stealth'?'selected':''}>Strike from the shadows and leave no trace</option>
                                <option value="knowledge" ${cw_char.quiz_answers[0]==='knowledge'?'selected':''}>Research their weaknesses and outsmart them</option>
                            </select>
                        </div>
                        <div>
                            <strong style="color:#fff; display:block; margin-bottom:4px;">2. Where do you feel most at home?</strong>
                            <select class="vtm-input" onchange="setWizardQuizAnswer(1, this.value)">
                                <option value="">-- Choose --</option>
                                <option value="elite" ${cw_char.quiz_answers[1]==='elite'?'selected':''}>High-society penthouses, galleries, and boardrooms</option>
                                <option value="punk" ${cw_char.quiz_answers[1]==='punk'?'selected':''}>Riotous underground clubs and street protests</option>
                                <option value="outcast" ${cw_char.quiz_answers[1]==='outcast'?'selected':''}>Abandoned tunnels, backroads, or the wilderness</option>
                                <option value="occult" ${cw_char.quiz_answers[1]==='occult'?'selected':''}>Candlelit libraries, morgues, and occult sanctums</option>
                            </select>
                        </div>
                        <div>
                            <strong style="color:#fff; display:block; margin-bottom:4px;">3. What is your deepest fear?</strong>
                            <select class="vtm-input" onchange="setWizardQuizAnswer(2, this.value)">
                                <option value="">-- Choose --</option>
                                <option value="loss_of_control" ${cw_char.quiz_answers[2]==='loss_of_control'?'selected':''}>Losing control of my mind or my inner Beast</option>
                                <option value="irrelevance" ${cw_char.quiz_answers[2]==='irrelevance'?'selected':''}>Being forgotten, powerless, or humiliated</option>
                                <option value="exposure" ${cw_char.quiz_answers[2]==='exposure'?'selected':''}>Having my secrets or monstrous nature exposed</option>
                                <option value="servitude" ${cw_char.quiz_answers[2]==='servitude'?'selected':''}>Being chained or enslaved to someone else's will</option>
                            </select>
                        </div>
                        <div>
                            <strong style="color:#fff; display:block; margin-bottom:4px;">4. What drives you through the night?</strong>
                            <select class="vtm-input" onchange="setWizardQuizAnswer(3, this.value)">
                                <option value="">-- Choose --</option>
                                <option value="power" ${cw_char.quiz_answers[3]==='power'?'selected':''}>Dominion, authority, and respect</option>
                                <option value="passion" ${cw_char.quiz_answers[3]==='passion'?'selected':''}>Beauty, rebellion, and intense sensation</option>
                                <option value="truth" ${cw_char.quiz_answers[3]==='truth'?'selected':''}>Uncovering forbidden truths and secrets</option>
                                <option value="survival" ${cw_char.quiz_answers[3]==='survival'?'selected':''}>Surviving against all odds on my own terms</option>
                            </select>
                        </div>
                        <div style="grid-column:span 2;">
                            <strong style="color:#fff; display:block; margin-bottom:4px;">5. How do you view the vampiric Embrace?</strong>
                            <select class="vtm-input" onchange="setWizardQuizAnswer(4, this.value)">
                                <option value="">-- Choose --</option>
                                <option value="monster" ${cw_char.quiz_answers[4]==='monster'?'selected':''}>A dark ascension—I am a predator above kine</option>
                                <option value="curse" ${cw_char.quiz_answers[4]==='curse'?'selected':''}>A tragic curse—I fight to hold onto my humanity</option>
                                <option value="weapon" ${cw_char.quiz_answers[4]==='weapon'?'selected':''}>A weapon—to punish the wicked or tear down the corrupt</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Selected Clan Bane & Compulsion Banner -->
            <div style="background:rgba(239, 68, 68, 0.08); border:1px solid #ef4444; border-radius:6px; padding:12px 16px; margin-bottom:16px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <span style="font-family:'Cinzel', serif; font-size:16px; font-weight:bold; color:#ef4444;">Selected Clan: ${escapeWizardHtml(cw_char.clan)}</span>
                    <span style="font-size:12px; color:#d4d4d8;">Disciplines: <strong style="color:#a855f7;">${cw_char.clan === 'Caitiff' ? 'Any 2 Disciplines' : escapeWizardHtml(selectedClanData.disciplines.join(', '))}</strong></span>
                </div>
                <div style="font-size:12px; color:#e4e4e7; margin-bottom:4px;"><strong style="color:#fca5a5;">Clan Bane:</strong> ${escapeWizardHtml(selectedClanData.bane)}</div>
                <div style="font-size:12px; color:#e4e4e7;"><strong style="color:#c084fc;">Clan Compulsion:</strong> ${escapeWizardHtml(selectedClanData.compulsion)}</div>
            </div>

            <!-- 16 Clans Grid -->
            <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px; max-height:310px; overflow-y:auto; padding-right:6px; margin-bottom:16px;">
                ${clanCardsHtml}
            </div>

            <!-- Sire & Sect -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; padding-top:12px; border-top:1px solid #27272a;">
                <div class="form-col">
                    <label>Sire (The Vampire Who Embraced You)</label>
                    <input type="text" id="cw_sire" class="vtm-input" value="${escapeWizardHtml(cw_char.sire)}" placeholder="e.g. Critias, Unknown, or Driven Away">
                </div>
                <div class="form-col">
                    <label>Sect / Faction Allegiance</label>
                    <select id="cw_sect" class="vtm-input" onchange="cw_char.sect = this.value">
                        ${['Camarilla', 'Anarch', 'Independent', 'Autarkis', 'Ashirra', 'Sabbat', 'Unaligned'].map(sectName =>
                            `<option value="${sectName}" ${cw_char.sect === sectName ? 'selected' : ''}>${sectName}</option>`
                        ).join('')}
                    </select>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // STEP 3: SEA OF TIME (AGE TIER, GENERATION & BLOOD POTENCY)
    // =========================================================================
    else if (cw_step === 3) {
        titleElement.innerText = "Step 3: The Sea of Time (Age, Generation & Blood Potency)";
        promptElement.innerText = "\"How long have you walked the night, and how thick is the Blood of Caine within your veins? Older Kindred command stronger vitae and advantages, but carry deeper flaws and eroded Humanity.\"";

        const isThinBlood = cw_char.clan === 'Thin-Blood';
        if (isThinBlood && !['14th', '15th', '16th'].includes(cw_char.generation)) {
            cw_char.age_tier = 'Fledgling';
            cw_char.generation = '14th';
        }

        const ageTierDefinitions = [
            {
                id: 'Fledgling',
                title: 'Childer / Fledgling',
                era: 'Embraced within the last 15 years',
                gens: isThinBlood ? ['14th', '15th', '16th'] : ['13th', '14th', '15th', '16th'],
                desc: 'Newly Embraced and still learning the rules of the night. Standard starting traits with 0 bonus XP.',
                summary: 'Blood Potency 1 (0 if 14th–16th Gen) • Humanity 7 • 7 Advantage pts / 2 Flaw pts • 0 Bonus XP'
            },
            {
                id: 'Neonate',
                title: 'Neonate',
                era: 'Embraced between 1940 and a decade ago',
                gens: isThinBlood ? ['14th', '15th', '16th'] : ['12th', '13th'],
                desc: 'Established in Kindred society and independent from your Sire. Grants 15 free Experience Points.',
                summary: 'Blood Potency 1 • Humanity 7 • 7 Advantage pts / 2 Flaw pts • 15 Bonus XP'
            },
            {
                id: 'Ancilla',
                title: 'Ancilla',
                era: 'Embraced between 1780 and 1940',
                gens: isThinBlood ? ['14th'] : ['10th', '11th'],
                desc: 'A seasoned veteran of over a century of night. Higher Blood Potency (+1) and +2 Advantages, at the cost of +2 Flaws and -1 Humanity.',
                summary: 'Blood Potency 2 • Humanity 6 (-1) • 9 Advantage pts / 4 Flaw pts • 35 Bonus XP'
            }
        ];

        const tierCardsHtml = ageTierDefinitions.map(tierDefinition => {
            const isTierSelected = cw_char.age_tier === tierDefinition.id;
            return `
                <div onclick="selectWizardAgeTier('${tierDefinition.id}')" style="padding:14px; border:1px solid ${isTierSelected ? '#ef4444' : '#3f3f46'}; border-radius:6px; cursor:pointer; background:${isTierSelected ? 'rgba(239, 68, 68, 0.14)' : 'rgba(0,0,0,0.35)'}; transition:all 0.15s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="color:#fff; font-size:15px;">${tierDefinition.title}</strong>
                        <span style="font-size:11px; color:#a855f7; font-weight:600;">${tierDefinition.era}</span>
                    </div>
                    <p style="font-size:12px; color:#d4d4d8; margin:4px 0 8px 0;">${tierDefinition.desc}</p>
                    <div style="font-size:11px; color:#fca5a5; background:rgba(0,0,0,0.4); padding:6px 10px; border-radius:4px;">${tierDefinition.summary}</div>
                </div>
            `;
        }).join('');

        const activeTierDefinition = ageTierDefinitions.find(tierDefinition => tierDefinition.id === cw_char.age_tier) || ageTierDefinitions[1];
        if (!activeTierDefinition.gens.includes(cw_char.generation)) {
            cw_char.generation = activeTierDefinition.gens[0];
        }

        const bloodPotencyRating = getWizardBloodPotency();
        const bloodPotencyStats = getWizardBloodPotencyStats(bloodPotencyRating);
        const startingHumanity = getWizardStartingHumanity();

        contentContainerElement.innerHTML = `
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:18px;">
                ${tierCardsHtml}
            </div>
            <div style="display:grid; grid-template-columns:1fr 2fr; gap:16px; align-items:stretch;">
                <div style="background:rgba(0,0,0,0.35); border:1px solid #3f3f46; border-radius:6px; padding:14px;">
                    <label style="display:block; color:#fff; font-size:13px; font-weight:600; margin-bottom:8px;">Exact Generation</label>
                    <select id="cw_gen_select" class="vtm-input" onchange="cw_char.generation = this.value; renderWizardStep();">
                        ${activeTierDefinition.gens.map(generationLabel => `<option value="${generationLabel}" ${cw_char.generation === generationLabel ? 'selected' : ''}>${generationLabel} Generation</option>`).join('')}
                    </select>
                    <div style="margin-top:12px; font-size:12px; color:#a1a1aa; line-height:1.5;">
                        <div>Starting Blood Potency: <strong style="color:#ef4444;">${bloodPotencyRating}</strong></div>
                        <div>Base Starting Humanity: <strong style="color:#a855f7;">${startingHumanity}</strong></div>
                        <div>Starting Experience: <strong style="color:#fff;">${cw_char.age_tier === 'Ancilla' ? 35 : (cw_char.age_tier === 'Neonate' ? 15 : 0)} XP</strong></div>
                    </div>
                </div>
                <div style="background:rgba(0,0,0,0.35); border:1px solid #3f3f46; border-radius:6px; padding:14px;">
                    <strong style="display:block; color:#ef4444; font-size:13px; margin-bottom:8px;"><i class="fa-solid fa-droplet"></i> Derived Blood Potency (${bloodPotencyRating}) Stats (Auto-Filled on Sheet)</strong>
                    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; font-size:12px;">
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:4px;"><span style="color:#a1a1aa; display:block; font-size:10px;">BLOOD SURGE</span><strong style="color:#fff;">${bloodPotencyStats.blood_surge}</strong></div>
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:4px;"><span style="color:#a1a1aa; display:block; font-size:10px;">MEND AMOUNT</span><strong style="color:#fff;">${bloodPotencyStats.mend_amount}</strong></div>
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:4px;"><span style="color:#a1a1aa; display:block; font-size:10px;">POWER BONUS</span><strong style="color:#fff;">${bloodPotencyStats.power_bonus}</strong></div>
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:4px;"><span style="color:#a1a1aa; display:block; font-size:10px;">ROUSE RE-ROLL</span><strong style="color:#fff;">${bloodPotencyStats.rouse_reroll}</strong></div>
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:4px;"><span style="color:#a1a1aa; display:block; font-size:10px;">BANE SEVERITY</span><strong style="color:#ef4444;">${bloodPotencyStats.bane_severity}</strong></div>
                        <div style="background:rgba(255,255,255,0.03); padding:8px; border-radius:4px;"><span style="color:#a1a1aa; display:block; font-size:10px;">FEEDING PENALTY</span><strong style="color:#fff;">${bloodPotencyStats.feeding_penalty}</strong></div>
                    </div>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // STEP 4: ATTRIBUTES (1×4, 3×3, 4×2, 1×1)
    // =========================================================================
    else if (cw_step === 4) {
        titleElement.innerText = "Step 4: Attributes (1×4, 3×3, 4×2, 1×1)";
        promptElement.innerText = "\"Assign your nine Attributes: one at 4 dots (your peak trait), three at 3 dots, four at 2 dots, and one at 1 dot (your weak spot). Click directly on any Attribute's dots or use the token pool below.\"";
        contentContainerElement.innerHTML = `<div id="cw-attr-container">${renderAttrDragDrop()}</div>`;
    }

    // =========================================================================
    // STEP 5: SKILLS & SPECIALTIES
    // =========================================================================
    else if (cw_step === 5) {
        titleElement.innerText = "Step 5: Skills & Skill Specialties";
        promptElement.innerText = "\"Choose a Skill distribution array (Balanced, Jack-of-all-Trades, or Specialist), assign your Skill dots by clicking on any Skill's dots, and pick your starting Skill Specialties.\"";
        contentContainerElement.innerHTML = `<div id="cw-skill-container">${renderSkillDragDrop()}</div>`;
    }

    // =========================================================================
    // STEP 6: PREDATOR TYPE (FEEDING STYLE & BONUS CHOICES)
    // =========================================================================
    else if (cw_step === 6) {
        titleElement.innerText = "Step 6: Predator Type (Feeding Style & Bonuses)";
        promptElement.innerText = "\"How do you hunt to slake your Hunger? Your Predator Type grants a bonus Skill Specialty, +1 Discipline dot (applied in Step 7), and feeding Merits/Flaws (applied in Step 8).\"";
        contentContainerElement.innerHTML = renderPredatorTypeStep();
    }

    // =========================================================================
    // STEP 7: DISCIPLINES & POWERS
    // =========================================================================
    else if (cw_step === 7) {
        titleElement.innerText = "Step 7: Disciplines & Vampiric Powers";
        promptElement.innerText = "\"Choose two In-Clan Disciplines (one at 2 dots and one at 1 dot). Your Predator Type bonus (+1 Discipline dot) automatically upgrades one of your Disciplines or unlocks a third!\"";
        contentContainerElement.innerHTML = renderDisciplinesStep();
    }

    // =========================================================================
    // STEP 8: ADVANTAGES (MERITS, BACKGROUNDS, FLAWS) & BIOGRAPHY
    // =========================================================================
    else if (cw_step === 8) {
        titleElement.innerText = "Step 8: Merits, Backgrounds, Flaws & Biography";
        promptElement.innerText = "\"Spend your Advantage points on Backgrounds and Merits, choose your required Flaws, and record your mortal Touchstones, Convictions, and personal history.\"";
        contentContainerElement.innerHTML = renderAdvantagesAndBioStep();
    }
}

/**
 * Selects the preferred character sheet template in Step 1.
 *
 * @param {string} templateFilename - Template filename.
 * @returns {void}
 */
function selectWizardTemplate(templateFilename) {
    saveWizardStep();
    cw_char.sheet_template = templateFilename;
    renderWizardStep();
}

/**
 * Toggles the optional 5-Question Clan Personality Quiz in Step 2.
 *
 * @returns {void}
 */
function toggleWizardClanQuiz() {
    saveWizardStep();
    cw_quiz_open = !cw_quiz_open;
    renderWizardStep();
}

/**
 * Records an answer to one of the optional Clan Quiz questions and re-renders Step 2.
 *
 * @param {number} questionIndex - Question index (0–4).
 * @param {string} answerValue - Selected answer key.
 * @returns {void}
 */
function setWizardQuizAnswer(questionIndex, answerValue) {
    saveWizardStep();
    cw_char.quiz_answers[questionIndex] = answerValue;
    const hasAllAnswers = cw_char.quiz_answers.filter(Boolean).length === 5;
    if (hasAllAnswers) {
        const recommendedClans = calculateRecommendedClans();
        if (recommendedClans.length > 0) selectWizardClan(recommendedClans[0]);
        return;
    }
    renderWizardStep();
}

/**
 * Updates `cw_char.clan` when a Clan card is clicked in Step 2, and resets default Disciplines
 * to match the newly chosen Clan's In-Clan Disciplines.
 *
 * @param {string} clanName - Clan name.
 * @returns {void}
 */
function selectWizardClan(clanName) {
    saveWizardStep();
    cw_char.clan = clanName;
    const clanMetadata = V5_DATA.clans[clanName];
    if (clanName === 'Thin-Blood') {
        cw_char.age_tier = 'Fledgling';
        cw_char.generation = '14th';
        cw_char.predator_type = 'None';
        cw_char.disc_primary = 'Thin-Blood Alchemy';
        cw_char.disc_secondary = '';
    } else if (clanMetadata && Array.isArray(clanMetadata.disciplines)) {
        cw_char.disc_primary = clanMetadata.disciplines[0] || 'Celerity';
        cw_char.disc_secondary = clanMetadata.disciplines[1] || 'Potence';
        if (cw_char.predator_type === 'None') {
            cw_char.predator_type = '';
        }
    }
    cw_char.disc_powers = {};
    renderWizardStep();
}

/**
 * Selects the Sea of Time Age Tier (`Fledgling`, `Neonate`, or `Ancilla`) in Step 3.
 *
 * @param {string} ageTier - Age tier identifier.
 * @returns {void}
 */
function selectWizardAgeTier(ageTier) {
    saveWizardStep();
    cw_char.age_tier = ageTier;
    if (cw_char.clan === 'Thin-Blood') {
        cw_char.generation = '14th';
    } else if (ageTier === 'Ancilla') {
        cw_char.generation = '10th';
    } else if (ageTier === 'Neonate') {
        cw_char.generation = '13th';
    } else {
        cw_char.generation = '13th';
    }
    renderWizardStep();
}

/**
 * Applies a quick Attribute preset in Step 4.
 *
 * @param {string} presetName - Preset type ('physical', 'social', 'mental', 'clear').
 * @returns {void}
 */
function applyWizardAttributePreset(presetName) {
    if (presetName === 'clear') {
        for (const attributeKey in cw_char.attributes) cw_char.attributes[attributeKey] = 0;
    } else if (presetName === 'physical') {
        cw_char.attributes = {
            strength: 4, dexterity: 3, stamina: 3,
            charisma: 2, manipulation: 2, composure: 3,
            intelligence: 2, wits: 2, resolve: 1
        };
    } else if (presetName === 'social') {
        cw_char.attributes = {
            strength: 1, dexterity: 2, stamina: 2,
            charisma: 4, manipulation: 3, composure: 3,
            intelligence: 2, wits: 2, resolve: 3
        };
    } else if (presetName === 'mental') {
        cw_char.attributes = {
            strength: 1, dexterity: 2, stamina: 2,
            charisma: 2, manipulation: 2, composure: 3,
            intelligence: 4, wits: 3, resolve: 3
        };
    }
    cw_active_token = null;
    // document.getElementById locates the Step 4 Attribute UI container to re-render the updated dot assignments
    const attributeContainerElement = document.getElementById('cw-attr-container');
    if (attributeContainerElement) attributeContainerElement.innerHTML = renderAttrDragDrop();
}

/**
 * Sets an Attribute directly to a desired dot rating `targetRating` (1–4) when the user clicks
 * directly on a dot inside an Attribute row.
 * Intelligently consumes from the available `ATTRIBUTE_ARRAY` pool or swaps with another Attribute
 * if all tokens of `targetRating` are currently assigned.
 *
 * @param {string} attributeKey - Attribute key.
 * @param {number} targetRating - Desired dot value (1–4).
 * @returns {void}
 */
function setWizardAttrDirect(attributeKey, targetRating) {
    if (targetRating < 1 || targetRating > 4) return;
    if (cw_char.attributes[attributeKey] === targetRating) {
        cw_char.attributes[attributeKey] = 0;
        cw_active_token = null;
        // document.getElementById locates the Step 4 Attribute UI container and re-renders it
        document.getElementById('cw-attr-container').innerHTML = renderAttrDragDrop();
        return;
    }

    // Check if targetRating is available in the remaining pool
    const remainingAttributePool = [...ATTRIBUTE_ARRAY];
    for (const [otherAttributeKey, assignedRating] of Object.entries(cw_char.attributes)) {
        if (otherAttributeKey !== attributeKey && assignedRating > 0) {
            const poolMatchIndex = remainingAttributePool.indexOf(assignedRating);
            if (poolMatchIndex > -1) remainingAttributePool.splice(poolMatchIndex, 1);
        }
    }

    if (remainingAttributePool.includes(targetRating)) {
        cw_char.attributes[attributeKey] = targetRating;
    } else {
        // Swap with the first attribute that currently holds targetRating
        const holderAttributeKey = Object.keys(cw_char.attributes).find(candidateKey => candidateKey !== attributeKey && cw_char.attributes[candidateKey] === targetRating);
        if (holderAttributeKey) {
            cw_char.attributes[holderAttributeKey] = cw_char.attributes[attributeKey] || 0;
            cw_char.attributes[attributeKey] = targetRating;
        }
    }
    cw_active_token = null;
    // document.getElementById locates the Step 4 Attribute UI container and updates its HTML
    document.getElementById('cw-attr-container').innerHTML = renderAttrDragDrop();
}

/**
 * Generates the HTML for the interactive Attribute allocator (Step 4).
 * Supports both direct dot clicking (1–4) and token click/drag-and-drop, plus live Health/Willpower preview.
 *
 * @returns {string} HTML string for Step 4.
 */
function renderAttrDragDrop() {
    const remainingAttributePool = [...ATTRIBUTE_ARRAY];
    Object.values(cw_char.attributes).filter(assignedRating => assignedRating > 0).forEach(assignedRating => {
        const poolMatchIndex = remainingAttributePool.indexOf(assignedRating);
        if (poolMatchIndex > -1) remainingAttributePool.splice(poolMatchIndex, 1);
    });

    const availableTokenCounts = {};
    remainingAttributePool.forEach(tokenValue => availableTokenCounts[tokenValue] = (availableTokenCounts[tokenValue] || 0) + 1);

    let tokenPoolHtml = Object.keys(availableTokenCounts).sort((firstValue, secondValue) => secondValue - firstValue).map(tokenValueString => {
        const tokenValue = parseInt(tokenValueString);
        const tokenCount = availableTokenCounts[tokenValue];
        let dotsHtml = '';
        for (let dotIndex = 0; dotIndex < 5; dotIndex++) {
            dotsHtml += dotIndex < tokenValue
                ? '<span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#ef4444; margin-right:3px; vertical-align:middle;"></span>'
                : '<span style="display:inline-block; width:10px; height:10px; border-radius:50%; border:1px solid #52525b; margin-right:3px; vertical-align:middle;"></span>';
        }
        return `<div class="cw-token" draggable="true" ondragstart="cwDragStart(event, ${tokenValue})" onclick="cwTokenClick(${tokenValue})" style="padding:6px 10px; border:1px solid ${cw_active_token === tokenValue ? '#ef4444' : '#3f3f46'}; border-radius:4px; cursor:pointer; background:${cw_active_token === tokenValue ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.35)'}; display:inline-flex; align-items:center; margin-right:6px;">
            <span style="color:#fff; font-size:12px; font-weight:bold; margin-right:6px;">${tokenCount}× (${tokenValue})</span> ${dotsHtml}
        </div>`;
    }).join('');

    if (!tokenPoolHtml) {
        tokenPoolHtml = `<span style="color:#22c55e; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> All 9 Attributes assigned! (Click any dot to adjust or swap)</span>`;
    }

    const attributeCategories = [
        { title: 'Physical', keys: ['strength', 'dexterity', 'stamina'], hints: { strength: 'Raw physical might & melee force', dexterity: 'Agility, speed & hand-eye coordination', stamina: 'Endurance, toughness & Health (+3)' } },
        { title: 'Social', keys: ['charisma', 'manipulation', 'composure'], hints: { charisma: 'Charm, presence & natural magnetism', manipulation: 'Subterfuge, persuasion & leverage', composure: 'Poise, restraint & Willpower' } },
        { title: 'Mental', keys: ['intelligence', 'wits', 'resolve'], hints: { intelligence: 'Memory, logic & academic reasoning', wits: 'Intuition, reaction speed & awareness', resolve: 'Focus, determination & Willpower' } }
    ];

    const categoryColumnsHtml = attributeCategories.map(attributeCategory => {
        const attributeRowsHtml = attributeCategory.keys.map(attributeKey => {
            const currentRating = cw_char.attributes[attributeKey] || 0;
            let dotsHtml = '';
            for (let dotNumber = 1; dotNumber <= 5; dotNumber++) {
                const isDotFilled = dotNumber <= currentRating;
                const isFifthDotCap = dotNumber === 5;
                dotsHtml += `<span onclick="event.stopPropagation(); ${isFifthDotCap ? '' : `setWizardAttrDirect('${attributeKey}', ${dotNumber})`}" title="${isFifthDotCap ? 'Max starting Attribute is 4' : `Set ${attributeKey} to ${dotNumber}`}" style="display:inline-block; width:14px; height:14px; border-radius:50%; background:${isDotFilled ? '#ef4444' : 'transparent'}; border:1px solid ${isDotFilled ? '#ef4444' : (isFifthDotCap ? '#27272a' : '#71717a')}; margin-right:4px; cursor:${isFifthDotCap ? 'not-allowed' : 'pointer'}; opacity:${isFifthDotCap ? '0.35' : '1'}; transition:transform 0.1s;"></span>`;
            }
            return `
                <div style="padding:10px 12px; border:1px ${cw_active_token && currentRating === 0 ? 'dashed #ef4444' : 'solid #3f3f46'}; border-radius:6px; background:${currentRating > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0,0,0,0.3)'}; margin-bottom:8px; cursor:pointer;"
                     ondragover="cwAllowDrop(event)" ondrop="cwDrop(event, '${attributeKey}')" onclick="cwAttrClick('${attributeKey}')">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="text-transform:capitalize; color:#fff; font-size:13px;">${attributeKey}</strong>
                        <div style="display:flex; align-items:center;">${dotsHtml}</div>
                    </div>
                    <div style="font-size:11px; color:#a1a1aa;">${attributeCategory.hints[attributeKey]}</div>
                </div>
            `;
        }).join('');
        return `<div><h4 style="color:#a855f7; margin:0 0 10px 0; text-align:center; font-family:'Cinzel',serif;">${attributeCategory.title}</h4>${attributeRowsHtml}</div>`;
    }).join('');

    const derivedHealthBoxes = (cw_char.attributes.stamina || 1) + 3;
    const derivedWillpowerBoxes = (cw_char.attributes.composure || 1) + (cw_char.attributes.resolve || 1);

    return `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid #27272a;">
            <div id="cw-token-container">${tokenPoolHtml}</div>
            <div style="display:flex; gap:6px; align-items:center;">
                <span style="font-size:11px; color:#a1a1aa;">Quick Presets:</span>
                <button type="button" onclick="applyWizardAttributePreset('physical')" style="background:rgba(255,255,255,0.06); border:1px solid #3f3f46; color:#e4e4e7; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">Physical</button>
                <button type="button" onclick="applyWizardAttributePreset('social')" style="background:rgba(255,255,255,0.06); border:1px solid #3f3f46; color:#e4e4e7; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">Social</button>
                <button type="button" onclick="applyWizardAttributePreset('mental')" style="background:rgba(255,255,255,0.06); border:1px solid #3f3f46; color:#e4e4e7; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">Mental</button>
                <button type="button" onclick="applyWizardAttributePreset('clear')" style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; color:#fca5a5; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">Reset</button>
            </div>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px; margin-bottom:14px;" id="cw-attr-grid">
            ${categoryColumnsHtml}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; background:rgba(0,0,0,0.4); border:1px solid #3f3f46; border-radius:6px; padding:10px 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:#d4d4d8;"><i class="fa-solid fa-heart-pulse" style="color:#ef4444; margin-right:6px;"></i> Derived <strong>Health</strong> (Stamina + 3):</span>
                <strong style="color:#ef4444; font-size:15px;">${derivedHealthBoxes} Boxes</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-size:12px; color:#d4d4d8;"><i class="fa-solid fa-brain" style="color:#a855f7; margin-right:6px;"></i> Derived <strong>Willpower</strong> (Composure + Resolve):</span>
                <strong style="color:#a855f7; font-size:15px;">${derivedWillpowerBoxes} Boxes</strong>
            </div>
        </div>
    `;
}

/**
 * Handles the start of a drag-and-drop action for an attribute token.
 *
 * @param {DragEvent} dragEvent - The HTML drag event.
 * @param {number} tokenValue - The numeric value of the dragged dot token.
 * @returns {void}
 */
function cwDragStart(dragEvent, tokenValue) {
    // dataTransfer.setData stores the dragged token's numeric dot value on the browser's drag event payload
    dragEvent.dataTransfer.setData("text/plain", tokenValue);
}

/**
 * Allows an element to accept dragged items by preventing the default browser behavior.
 *
 * @param {DragEvent} dragEvent - The HTML drag event.
 * @returns {void}
 */
function cwAllowDrop(dragEvent) {
    // preventDefault tells the browser that this DOM element is a valid drop target
    dragEvent.preventDefault();
}

/**
 * Handles dropping an attribute token onto an attribute slot.
 *
 * @param {DragEvent} dragEvent - The HTML drag event.
 * @param {string} attributeKey - The name of the attribute receiving the points.
 * @returns {void}
 */
function cwDrop(dragEvent, attributeKey) {
    // preventDefault stops the browser from performing any default drop handling (like opening text as a link)
    dragEvent.preventDefault();
    // dataTransfer.getData retrieves the numeric dot rating that was stored when the drag started
    const droppedValue = parseInt(dragEvent.dataTransfer.getData("text/plain"));
    if (!droppedValue) return;
    cw_char.attributes[attributeKey] = droppedValue;
    cw_active_token = null;
    // document.getElementById finds the Attribute step container to re-render the updated ratings
    document.getElementById('cw-attr-container').innerHTML = renderAttrDragDrop();
}

/**
 * Selects an Attribute pool token for click-to-place assignment.
 *
 * @param {number} tokenValue - Token dot value.
 * @returns {void}
 */
function cwTokenClick(tokenValue) {
    cw_active_token = cw_active_token === tokenValue ? null : tokenValue;
    // document.getElementById updates the Step 4 Attribute UI to highlight the selected token
    document.getElementById('cw-attr-container').innerHTML = renderAttrDragDrop();
}

/**
 * Assigns or clears an Attribute slot when clicked.
 *
 * @param {string} attributeKey - Attribute key.
 * @returns {void}
 */
function cwAttrClick(attributeKey) {
    if (cw_active_token) {
        cw_char.attributes[attributeKey] = cw_active_token;
        cw_active_token = null;
        // document.getElementById re-renders the Step 4 Attribute UI after assigning the active token
        document.getElementById('cw-attr-container').innerHTML = renderAttrDragDrop();
    } else if (cw_char.attributes[attributeKey] > 0) {
        cw_char.attributes[attributeKey] = 0;
        // document.getElementById re-renders the Step 4 Attribute UI after clearing the attribute
        document.getElementById('cw-attr-container').innerHTML = renderAttrDragDrop();
    }
}

/**
 * Updates the chosen Skill Distribution array in Step 5 and resets current skill assignments.
 *
 * @param {HTMLSelectElement} selectElement - Select element.
 * @returns {void}
 */
function updateSkillArrayType(selectElement) {
    saveSkillSpecialtiesFromDOM();
    cw_skill_array_type = selectElement.value;
    for (const skillKey in cw_char.skills) cw_char.skills[skillKey] = 0;
    cw_active_token = null;
    refreshSkillUI();
}

/**
 * Clears all assigned Skills in Step 5.
 *
 * @returns {void}
 */
function clearWizardSkills() {
    saveSkillSpecialtiesFromDOM();
    for (const skillKey in cw_char.skills) cw_char.skills[skillKey] = 0;
    cw_active_token = null;
    refreshSkillUI();
}

/**
 * Sets a Skill directly to `targetRating` (1–4) when the user clicks on a dot in Step 5.
 *
 * @param {string} skillKey - Skill key.
 * @param {number} targetRating - Desired dot value (1–4).
 * @returns {void}
 */
function setWizardSkillDirect(skillKey, targetRating) {
    saveSkillSpecialtiesFromDOM();
    if (targetRating < 1 || targetRating > 4) return;
    if (cw_char.skills[skillKey] === targetRating) {
        cw_char.skills[skillKey] = 0;
        cw_active_token = null;
        refreshSkillUI();
        return;
    }

    const remainingSkillPool = [...SKILL_ARRAYS[cw_skill_array_type]];
    for (const [otherSkillKey, assignedRating] of Object.entries(cw_char.skills)) {
        if (otherSkillKey !== skillKey && assignedRating > 0) {
            const poolMatchIndex = remainingSkillPool.indexOf(assignedRating);
            if (poolMatchIndex > -1) remainingSkillPool.splice(poolMatchIndex, 1);
        }
    }

    if (remainingSkillPool.includes(targetRating)) {
        cw_char.skills[skillKey] = targetRating;
    } else {
        // If active token is set, use that, otherwise swap with last skill holding targetRating if targetRating exists in array
        if (SKILL_ARRAYS[cw_skill_array_type].includes(targetRating)) {
            const holderSkillKey = Object.keys(cw_char.skills).find(candidateKey => candidateKey !== skillKey && cw_char.skills[candidateKey] === targetRating);
            if (holderSkillKey) {
                cw_char.skills[holderSkillKey] = cw_char.skills[skillKey] || 0;
                cw_char.skills[skillKey] = targetRating;
            }
        }
    }
    cw_active_token = null;
    refreshSkillUI();
}

/**
 * Persists specialty inputs from Step 5 DOM before re-rendering the Skill UI.
 *
 * @returns {void}
 */
function saveSkillSpecialtiesFromDOM() {
    // document.getElementById reads the selected skill and specialty text inputs from the Step 5 DOM
    const freeSpecialtySkillSelect = document.getElementById('cw_free_spec_skill');
    const freeSpecialtyTextInput = document.getElementById('cw_free_spec_text');
    if (freeSpecialtySkillSelect) cw_char.free_specialty_skill = freeSpecialtySkillSelect.value;
    if (freeSpecialtyTextInput) cw_char.free_specialty_text = freeSpecialtyTextInput.value;

    CW_AUTO_SPECIALTY_SKILLS.forEach(skillKey => {
        // document.getElementById locates any visible automatic specialty input field (Academics, Craft, Performance, Science)
        const autoSpecialtyInputElement = document.getElementById(`cw_auto_spec_${skillKey}`);
        if (autoSpecialtyInputElement) cw_char.auto_specialties[skillKey] = autoSpecialtyInputElement.value;
    });
}

/**
 * Generates the HTML for Step 5 (Skills & Specialties).
 *
 * @returns {string} HTML string for Step 5.
 */
function renderSkillDragDrop() {
    const remainingSkillPool = [...SKILL_ARRAYS[cw_skill_array_type]];
    Object.values(cw_char.skills).filter(assignedRating => assignedRating > 0).forEach(assignedRating => {
        const poolMatchIndex = remainingSkillPool.indexOf(assignedRating);
        if (poolMatchIndex > -1) remainingSkillPool.splice(poolMatchIndex, 1);
    });

    const availableTokenCounts = {};
    remainingSkillPool.forEach(tokenValue => availableTokenCounts[tokenValue] = (availableTokenCounts[tokenValue] || 0) + 1);

    let tokenPoolHtml = Object.keys(availableTokenCounts).sort((firstValue, secondValue) => secondValue - firstValue).map(tokenValueString => {
        const tokenValue = parseInt(tokenValueString);
        const tokenCount = availableTokenCounts[tokenValue];
        let dotsHtml = '';
        for (let dotIndex = 0; dotIndex < 5; dotIndex++) {
            dotsHtml += dotIndex < tokenValue
                ? '<span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:#ef4444; margin-right:2px; vertical-align:middle;"></span>'
                : '<span style="display:inline-block; width:9px; height:9px; border-radius:50%; border:1px solid #52525b; margin-right:2px; vertical-align:middle;"></span>';
        }
        return `<div class="cw-token" draggable="true" ondragstart="cwSkillDragStart(event, ${tokenValue})" onclick="cwSkillTokenClick(${tokenValue})" style="padding:5px 9px; border:1px solid ${cw_active_token === tokenValue ? '#ef4444' : '#3f3f46'}; border-radius:4px; cursor:pointer; background:${cw_active_token === tokenValue ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.35)'}; display:inline-flex; align-items:center; margin-right:6px;">
            <span style="color:#fff; font-size:12px; font-weight:bold; margin-right:5px;">${tokenCount}× (${tokenValue})</span> ${dotsHtml}
        </div>`;
    }).join('');

    if (!tokenPoolHtml) {
        tokenPoolHtml = `<span style="color:#22c55e; font-size:13px; font-weight:600;"><i class="fa-solid fa-circle-check"></i> All Skill dots assigned!</span>`;
    }

    const maxAllowedInArray = Math.max(...SKILL_ARRAYS[cw_skill_array_type]);

    const renderSkillColumn = (categoryTitle, skillKeyList) => {
        const skillRowsHtml = skillKeyList.map(skillKey => {
            const currentRating = cw_char.skills[skillKey] || 0;
            let dotsHtml = '';
            for (let dotNumber = 1; dotNumber <= 5; dotNumber++) {
                const isDotFilled = dotNumber <= currentRating;
                const isDotDisabled = dotNumber > maxAllowedInArray;
                dotsHtml += `<span onclick="event.stopPropagation(); ${isDotDisabled ? '' : `setWizardSkillDirect('${skillKey}', ${dotNumber})`}" title="${isDotDisabled ? `Max rating in ${cw_skill_array_type} array is ${maxAllowedInArray}` : `Set ${skillKey.replace('_', ' ')} to ${dotNumber}`}" style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${isDotFilled ? '#ef4444' : 'transparent'}; border:1px solid ${isDotFilled ? '#ef4444' : (isDotDisabled ? '#27272a' : '#71717a')}; margin-right:3px; cursor:${isDotDisabled ? 'not-allowed' : 'pointer'}; opacity:${isDotDisabled ? '0.3' : '1'};"></span>`;
            }

            const displaySkillName = skillKey.replace('_', ' ');
            const hasAutoSpecialty = CW_AUTO_SPECIALTY_SKILLS.includes(skillKey) && currentRating > 0;
            return `
                <div style="padding:7px 10px; border:1px ${cw_active_token && currentRating === 0 ? 'dashed #ef4444' : 'solid #3f3f46'}; border-radius:5px; cursor:pointer; background:${currentRating > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0,0,0,0.25)'}; margin-bottom:5px;"
                     ondragover="cwAllowDrop(event)" ondrop="cwSkillDrop(event, '${skillKey}')" onclick="cwSkillClick('${skillKey}')">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="text-transform:capitalize; font-size:12px; color:${currentRating > 0 ? '#fff' : '#d4d4d8'}; font-weight:${currentRating > 0 ? '600' : '400'};">${displaySkillName}</span>
                        <div style="display:flex; align-items:center;">${dotsHtml}</div>
                    </div>
                    ${hasAutoSpecialty ? `
                        <div onclick="event.stopPropagation();" style="margin-top:6px; padding-top:5px; border-top:1px dashed rgba(168,85,247,0.4);">
                            <input type="text" id="cw_auto_spec_${skillKey}" class="vtm-input" style="padding:3px 6px; font-size:11px; height:24px;" value="${escapeWizardHtml(cw_char.auto_specialties[skillKey] || '')}" oninput="cw_char.auto_specialties['${skillKey}'] = this.value" placeholder="Free ${displaySkillName} specialty (required)...">
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        return `<div><h4 style="color:#a855f7; margin:0 0 8px 0; text-align:center; font-family:'Cinzel',serif; font-size:14px;">${categoryTitle}</h4>${skillRowsHtml}</div>`;
    };

    const skillsWithDots = Object.keys(cw_char.skills).filter(skillKey => cw_char.skills[skillKey] > 0);
    if (cw_char.free_specialty_skill && !skillsWithDots.includes(cw_char.free_specialty_skill)) {
        cw_char.free_specialty_skill = skillsWithDots[0] || '';
    } else if (!cw_char.free_specialty_skill && skillsWithDots.length > 0) {
        cw_char.free_specialty_skill = skillsWithDots[0];
    }

    return `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <label style="color:#fff; font-size:12px; font-weight:600; white-space:nowrap;">Distribution Array:</label>
                <select class="vtm-input" style="padding:5px 10px; font-size:12px; width:auto;" onchange="updateSkillArrayType(this)">
                    <option value="Balanced" ${cw_skill_array_type === 'Balanced' ? 'selected' : ''}>Balanced (Three 3s, Five 2s, Seven 1s — 15 Skills)</option>
                    <option value="Jack-of-all-Trades" ${cw_skill_array_type === 'Jack-of-all-Trades' ? 'selected' : ''}>Jack-of-all-Trades (One 3, Eight 2s, Ten 1s — 19 Skills)</option>
                    <option value="Specialist" ${cw_skill_array_type === 'Specialist' ? 'selected' : ''}>Specialist (One 4, Two 3s, Three 2s, Four 1s — 10 Skills)</option>
                </select>
            </div>
            <div style="display:flex; gap:6px;">
                <button type="button" onclick="clearWizardSkills()" style="background:rgba(239,68,68,0.1); border:1px solid #ef4444; color:#fca5a5; border-radius:4px; padding:4px 8px; font-size:11px; cursor:pointer;">Clear Skills</button>
            </div>
        </div>

        <div style="min-height:38px; margin-bottom:12px; border-bottom:1px solid #27272a; padding-bottom:8px;" id="cw-token-container">
            ${tokenPoolHtml}
        </div>

        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:16px;" id="cw-skill-grid">
            ${renderSkillColumn('Physical', CW_SKILL_CATEGORIES.physical)}
            ${renderSkillColumn('Social', CW_SKILL_CATEGORIES.social)}
            ${renderSkillColumn('Mental', CW_SKILL_CATEGORIES.mental)}
        </div>

        <!-- Free Specialty Bar -->
        <div style="background:rgba(168, 85, 247, 0.08); border:1px solid rgba(168, 85, 247, 0.4); border-radius:6px; padding:12px 16px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong style="color:#e9d5ff; font-size:13px;"><i class="fa-solid fa-star" style="color:#a855f7; margin-right:6px;"></i> Starting Free Skill Specialty <span style="color:#ef4444;">*</span></strong>
                <span style="font-size:11px; color:#a1a1aa;">(Academics, Craft, Performance & Science also grant automatic free specialties when dotted above!)</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 2fr; gap:12px;">
                <div>
                    <select id="cw_free_spec_skill" class="vtm-input" onchange="cw_char.free_specialty_skill = this.value">
                        ${skillsWithDots.length === 0
                            ? '<option value="">Assign at least 1 Skill dot above first</option>'
                            : skillsWithDots.map(skillKey => `<option value="${skillKey}" ${cw_char.free_specialty_skill === skillKey ? 'selected' : ''}>${skillKey.replace('_', ' ').replace(/\b\w/g, firstLetter => firstLetter.toUpperCase())} (${cw_char.skills[skillKey]} dots)</option>`).join('')
                        }
                    </select>
                </div>
                <div>
                    <input type="text" id="cw_free_spec_text" class="vtm-input" value="${escapeWizardHtml(cw_char.free_specialty_text)}" oninput="cw_char.free_specialty_text = this.value" placeholder="e.g. Knives, Improvisation, First Aid, Lockpicking, Parkour...">
                </div>
            </div>
        </div>
    `;
}

/**
 * Re-renders the Step 5 Skill UI while preserving scroll position and typed specialties.
 *
 * @returns {void}
 */
function refreshSkillUI() {
    // document.getElementById locates the Step 5 Skill container element to replace its inner HTML
    const skillContainerElement = document.getElementById('cw-skill-container');
    if (skillContainerElement) skillContainerElement.innerHTML = renderSkillDragDrop();
}

/**
 * Handles the start of a drag-and-drop action for a skill token.
 *
 * @param {DragEvent} dragEvent - The HTML drag event.
 * @param {number} tokenValue - The numeric value of the dragged skill token.
 * @returns {void}
 */
function cwSkillDragStart(dragEvent, tokenValue) {
    // dataTransfer.setData stores the dragged skill token's rating value in the drag event
    dragEvent.dataTransfer.setData("text/plain", tokenValue);
}

/**
 * Handles dropping a skill token onto a specific skill.
 *
 * @param {DragEvent} dragEvent - The HTML drag event.
 * @param {string} skillKey - The name of the skill receiving the points.
 * @returns {void}
 */
function cwSkillDrop(dragEvent, skillKey) {
    // preventDefault allows the drop event to complete normally on this skill row
    dragEvent.preventDefault();
    saveSkillSpecialtiesFromDOM();
    // dataTransfer.getData reads the numeric rating value stored when dragging started
    const droppedValue = parseInt(dragEvent.dataTransfer.getData("text/plain"));
    if (!droppedValue) return;
    cw_char.skills[skillKey] = droppedValue;
    cw_active_token = null;
    refreshSkillUI();
}

/**
 * Selects a Skill pool token for click-to-place assignment.
 *
 * @param {number} tokenValue - Skill token value.
 * @returns {void}
 */
function cwSkillTokenClick(tokenValue) {
    saveSkillSpecialtiesFromDOM();
    cw_active_token = cw_active_token === tokenValue ? null : tokenValue;
    refreshSkillUI();
}

/**
 * Assigns or clears a Skill slot when clicked.
 *
 * @param {string} skillKey - Skill key.
 * @returns {void}
 */
function cwSkillClick(skillKey) {
    saveSkillSpecialtiesFromDOM();
    if (cw_active_token) {
        cw_char.skills[skillKey] = cw_active_token;
        cw_active_token = null;
        refreshSkillUI();
    } else if (cw_char.skills[skillKey] > 0) {
        cw_char.skills[skillKey] = 0;
        refreshSkillUI();
    }
}

// =============================================================================
// STEP 6: PREDATOR TYPE
// =============================================================================

/**
 * Selects a Predator Type in Step 6 and initializes its default Specialty and Discipline choices.
 *
 * @param {string} predatorTypeKey - Predator Type key or `'None'`.
 * @returns {void}
 */
function selectWizardPredatorType(predatorTypeKey) {
    cw_char.predator_type = predatorTypeKey;
    if (predatorTypeKey !== 'None' && V5_DATA.predator_types[predatorTypeKey]) {
        const predatorTypeData = V5_DATA.predator_types[predatorTypeKey];
        const specialtySkillKeys = Object.keys(predatorTypeData.specialties || {});
        if (specialtySkillKeys.length > 0) {
            cw_char.predator_specialty_skill = specialtySkillKeys[0];
            cw_char.predator_specialty_text = predatorTypeData.specialties[specialtySkillKeys[0]];
        }
        const disciplineChoices = predatorTypeData.discipline_choices || [];
        const clanDisciplines = (V5_DATA.clans[cw_char.clan] && V5_DATA.clans[cw_char.clan].disciplines) || [];
        // Prefer an in-clan discipline if one of the choices is in-clan
        const inClanDisciplineMatch = disciplineChoices.find(disciplineName => clanDisciplines.includes(disciplineName));
        cw_char.predator_discipline = inClanDisciplineMatch || disciplineChoices[0] || '';
    } else {
        cw_char.predator_specialty_skill = '';
        cw_char.predator_specialty_text = '';
        cw_char.predator_discipline = '';
    }
    renderWizardStep();
    if (typeof setTimeout === 'function') {
        // setTimeout waits 40ms for the DOM to finish rendering the Predator customization panel before scrolling to it
        setTimeout(() => {
            // document.getElementById locates the Predator Type bonus customization panel
            const customizePanelElement = document.getElementById('cw-predator-customize');
            if (customizePanelElement && typeof customizePanelElement.scrollIntoView === 'function') {
                // scrollIntoView smoothly scrolls the wizard modal so the bonus customization panel is visible
                customizePanelElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 40);
    }
}

/**
 * Selects which of the Predator Type's Specialty options the player wants in Step 6.
 *
 * @param {string} skillKey - Skill key.
 * @param {string} defaultSpecialtyLabel - Default specialty label.
 * @returns {void}
 */
function selectPredatorSpecialtyChoice(skillKey, defaultSpecialtyLabel) {
    cw_char.predator_specialty_skill = skillKey;
    cw_char.predator_specialty_text = defaultSpecialtyLabel;
    renderWizardStep();
}

/**
 * Renders Step 6 (Predator Type selection and bonus choices).
 * Places the Predator Type selection grid at the top and the bonus customization panel below.
 *
 * @returns {string} HTML string for Step 6.
 */
function renderPredatorTypeStep() {
    const canSkipPredator = cw_char.clan === 'Thin-Blood' || cw_char.age_tier === 'Fledgling';
    const predatorTypeNames = Object.keys(V5_DATA.predator_types);

    if (cw_char.predator_type && cw_char.predator_type !== 'None' && !V5_DATA.predator_types[cw_char.predator_type]) {
        cw_char.predator_type = '';
    }
    if (!cw_char.predator_type && cw_char.clan === 'Thin-Blood') {
        cw_char.predator_type = 'None';
    }

    let noneCardHtml = '';
    if (canSkipPredator) {
        const isNoneSelected = cw_char.predator_type === 'None';
        noneCardHtml = `
            <div onclick="selectWizardPredatorType('None')" style="padding:12px; border:1px solid ${isNoneSelected ? '#ef4444' : '#3f3f46'}; border-radius:6px; cursor:pointer; background:${isNoneSelected ? 'rgba(239,68,68,0.16)' : 'rgba(0,0,0,0.35)'}; margin-bottom:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#fff; font-size:14px;">No Predator Type (${cw_char.clan === 'Thin-Blood' ? 'Thin-Blood' : 'Childer / Fledgling'})</strong>
                    <span style="font-size:11px; color:#a1a1aa;">Official V5 Rule</span>
                </div>
                <div style="font-size:12px; color:#a1a1aa; margin-top:4px;">In V5, Thin-Bloods and newly Embraced Childer/Fledglings have not yet developed a settled hunting style and do not take a Predator Type.</div>
            </div>
        `;
    }

    const predatorCardsHtml = predatorTypeNames.map(predatorName => {
        const predatorData = V5_DATA.predator_types[predatorName];
        const isSelected = cw_char.predator_type === predatorName;
        const specialtySummary = Object.entries(predatorData.specialties).map(([skillKey, specialtyText]) => `${skillKey.replace('_', ' ')} (${specialtyText})`).join(' OR ');
        const disciplineSummary = predatorData.discipline_choices.join(' OR ');
        const humanityModifierLabel = predatorData.humanity_change > 0 ? `+${predatorData.humanity_change} Humanity` : (predatorData.humanity_change < 0 ? `${predatorData.humanity_change} Humanity` : '');

        return `
            <div onclick="selectWizardPredatorType('${predatorName}')" style="padding:12px; border:2px solid ${isSelected ? '#ef4444' : '#3f3f46'}; border-radius:6px; cursor:pointer; background:${isSelected ? 'rgba(239, 68, 68, 0.18)' : 'rgba(0,0,0,0.35)'}; display:flex; flex-direction:column; justify-content:space-between; transition:all 0.15s;">
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <strong style="color:#fff; font-size:14px;">${escapeWizardHtml(predatorName)} ${isSelected ? '<i class="fa-solid fa-circle-check" style="color:#ef4444; margin-left:4px;"></i>' : ''}</strong>
                        ${humanityModifierLabel ? `<span style="font-size:10px; padding:1px 6px; border-radius:3px; background:${predatorData.humanity_change > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}; color:${predatorData.humanity_change > 0 ? '#86efac' : '#fca5a5'};">${humanityModifierLabel}</span>` : ''}
                    </div>
                    <p style="font-size:11px; color:#a1a1aa; margin:0 0 8px 0; line-height:1.35;">${escapeWizardHtml(predatorData.desc)}</p>
                </div>
                <div style="font-size:11px; color:#d4d4d8; border-top:1px solid #27272a; padding-top:6px;">
                    <div style="text-transform:capitalize;"><strong style="color:#a855f7;">Specialty:</strong> ${escapeWizardHtml(specialtySummary)}</div>
                    <div><strong style="color:#ef4444;">+1 Discipline:</strong> ${escapeWizardHtml(disciplineSummary)}</div>
                </div>
            </div>
        `;
    }).join('');

    let choicesPanelHtml = '';
    if (!cw_char.predator_type) {
        choicesPanelHtml = `
            <div id="cw-predator-customize" style="background:rgba(168, 85, 247, 0.08); border:1px dashed #a855f7; border-radius:6px; padding:14px 16px; margin-top:16px; text-align:center; color:#e9d5ff; font-size:13px;">
                <i class="fa-solid fa-hand-pointer" style="color:#a855f7; margin-right:6px;"></i> Click a <strong>Predator Type</strong> card above to customize its bonus Skill Specialty and +1 Discipline dot.
            </div>
        `;
    } else if (cw_char.predator_type !== 'None' && V5_DATA.predator_types[cw_char.predator_type]) {
        const predatorData = V5_DATA.predator_types[cw_char.predator_type];
        const specialtyEntries = Object.entries(predatorData.specialties);
        if (!predatorData.specialties[cw_char.predator_specialty_skill]) {
            cw_char.predator_specialty_skill = specialtyEntries[0][0];
            cw_char.predator_specialty_text = specialtyEntries[0][1];
        }
        if (!predatorData.discipline_choices.includes(cw_char.predator_discipline)) {
            cw_char.predator_discipline = predatorData.discipline_choices[0];
        }

        const specialtyRadiosHtml = specialtyEntries.map(([skillKey, specialtyName]) => {
            const isChecked = cw_char.predator_specialty_skill === skillKey;
            const currentSkillDots = cw_char.skills[skillKey] || 0;
            const dotStatusNote = currentSkillDots === 0 ? `<span style="color:#fbbf24; font-size:10px;">(You have 0 dots in ${skillKey.replace('_', ' ')} — V5 rules grant +1 dot in this Skill instead!)</span>` : `<span style="color:#86efac; font-size:10px;">(${currentSkillDots} dots)</span>`;
            return `
                <label onclick="selectPredatorSpecialtyChoice('${skillKey}', '${escapeWizardHtml(specialtyName)}')" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid ${isChecked ? '#a855f7' : '#3f3f46'}; border-radius:4px; background:${isChecked ? 'rgba(168,85,247,0.15)' : 'rgba(0,0,0,0.3)'}; cursor:pointer; margin-bottom:6px;">
                    <input type="radio" name="cw_pred_spec" ${isChecked ? 'checked' : ''} style="accent-color:#a855f7;">
                    <span style="font-size:12px; color:#fff; text-transform:capitalize;"><strong>${skillKey.replace('_', ' ')}</strong>: ${escapeWizardHtml(specialtyName)} ${dotStatusNote}</span>
                </label>
            `;
        }).join('');

        const disciplineRadiosHtml = predatorData.discipline_choices.map(disciplineName => {
            const isChecked = cw_char.predator_discipline === disciplineName;
            const clanDisciplines = (V5_DATA.clans[cw_char.clan] && V5_DATA.clans[cw_char.clan].disciplines) || [];
            const isInClan = cw_char.clan === 'Caitiff' || clanDisciplines.includes(disciplineName);
            return `
                <label onclick="cw_char.predator_discipline = '${disciplineName}'; renderWizardStep();" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid ${isChecked ? '#ef4444' : '#3f3f46'}; border-radius:4px; background:${isChecked ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.3)'}; cursor:pointer; margin-bottom:6px;">
                    <input type="radio" name="cw_pred_disc" ${isChecked ? 'checked' : ''} style="accent-color:#ef4444;">
                    <span style="font-size:12px; color:#fff;"><strong>+1 ${escapeWizardHtml(disciplineName)}</strong> <span style="font-size:10px; color:${isInClan ? '#c084fc' : '#a1a1aa'};">(${isInClan ? 'In-Clan' : 'Out-of-Clan'})</span></span>
                </label>
            `;
        }).join('');

        const automaticAdvantagesHtml = [
            ...(predatorData.advantages || []).map(advantageEntry => `<span style="color:#86efac;">+ ${advantageEntry.name} (${advantageEntry.rating}): ${advantageEntry.desc}</span>`),
            ...(predatorData.flaws || []).map(flawEntry => `<span style="color:#fca5a5;">• Flaw: ${flawEntry.name} (${flawEntry.rating}): ${flawEntry.desc}</span>`)
        ].join('<br>') || '<span style="color:#a1a1aa;">No additional Merits/Flaws</span>';

        choicesPanelHtml = `
            <div id="cw-predator-customize" style="background:rgba(239, 68, 68, 0.08); border:1px solid #ef4444; border-radius:6px; padding:14px 16px; margin-top:16px;">
                <div style="font-family:'Cinzel', serif; font-size:15px; font-weight:bold; color:#ef4444; margin-bottom:10px;">
                    2. Customize Your ${escapeWizardHtml(cw_char.predator_type)} Bonuses
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:14px;">
                    <div>
                        <label style="font-size:12px; color:#e9d5ff; font-weight:600; display:block; margin-bottom:6px;">Choose Bonus Specialty:</label>
                        ${specialtyRadiosHtml}
                        <input type="text" class="vtm-input" style="padding:4px 8px; font-size:11px; margin-top:4px;" value="${escapeWizardHtml(cw_char.predator_specialty_text)}" oninput="cw_char.predator_specialty_text = this.value" placeholder="Customize specialty text...">
                    </div>
                    <div>
                        <label style="font-size:12px; color:#fca5a5; font-weight:600; display:block; margin-bottom:6px;">Choose +1 Discipline Dot:</label>
                        ${disciplineRadiosHtml}
                    </div>
                    <div>
                        <label style="font-size:12px; color:#d4d4d8; font-weight:600; display:block; margin-bottom:6px;">Automatic Traits (Step 8):</label>
                        <div style="font-size:11px; line-height:1.5; background:rgba(0,0,0,0.35); padding:8px 10px; border-radius:4px; border:1px solid #27272a;">
                            ${automaticAdvantagesHtml}
                            ${predatorData.humanity_change !== 0 ? `<div style="margin-top:4px; color:#e4e4e7;"><strong>Humanity Modifier:</strong> ${predatorData.humanity_change > 0 ? '+' + predatorData.humanity_change : predatorData.humanity_change}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div style="font-family:'Cinzel', serif; font-size:15px; font-weight:bold; color:#e4e4e7; margin-bottom:8px;">
            1. Select Your Predator Type (Feeding Style)
        </div>
        ${noneCardHtml}
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:10px; max-height:280px; overflow-y:auto; padding-right:6px;">
            ${predatorCardsHtml}
        </div>
        ${choicesPanelHtml}
    `;
}

// =============================================================================
// STEP 7: DISCIPLINES & POWERS
// =============================================================================

/**
 * Computes the final map of Discipline ratings `{ [discName]: dots }` combining the
 * 2-dot primary Discipline, 1-dot secondary Discipline, and +1 Predator Type Discipline dot.
 *
 * @returns {Object} Map of `{ [discName]: number }`.
 */
function computeWizardDisciplineTotals() {
    if (cw_char.clan === 'Thin-Blood') {
        const hasThinBloodAlchemistMerit = cw_char.merits.some(meritItem => meritItem.name.toLowerCase().includes('thin-blood alchemist'));
        return hasThinBloodAlchemistMerit ? { 'Thin-Blood Alchemy': 1 } : {};
    }

    const disciplineTotals = {};
    if (cw_char.disc_primary) disciplineTotals[cw_char.disc_primary] = 2;
    if (cw_char.disc_secondary && cw_char.disc_secondary !== cw_char.disc_primary) {
        disciplineTotals[cw_char.disc_secondary] = 1;
    }

    if (cw_char.predator_type && cw_char.predator_type !== 'None' && cw_char.predator_discipline) {
        const predatorBonusDiscipline = cw_char.predator_discipline;
        disciplineTotals[predatorBonusDiscipline] = (disciplineTotals[predatorBonusDiscipline] || 0) + 1;
    }
    return disciplineTotals;
}

/**
 * Returns all powers available up to `maxLevel` for a given Discipline `disciplineName`.
 *
 * @param {string} disciplineName - Discipline name.
 * @param {number} maxLevel - Maximum level (1, 2, or 3).
 * @returns {Array<{name: string, level: number, desc: string}>} List of powers.
 */
function getAvailablePowersUpToLevel(disciplineName, maxLevel) {
    const disciplineDefinition = V5_DISCIPLINES[disciplineName];
    if (!disciplineDefinition) return [];
    const availablePowersList = [];
    if (maxLevel >= 1 && disciplineDefinition.l1) {
        for (const [powerName, powerDescription] of Object.entries(disciplineDefinition.l1)) {
            availablePowersList.push({ name: powerName, level: 1, desc: powerDescription });
        }
    }
    if (maxLevel >= 2 && disciplineDefinition.l2) {
        for (const [powerName, powerDescription] of Object.entries(disciplineDefinition.l2)) {
            availablePowersList.push({ name: powerName, level: 2, desc: powerDescription });
        }
    }
    if (maxLevel >= 3 && disciplineDefinition.l3) {
        for (const [powerName, powerDescription] of Object.entries(disciplineDefinition.l3)) {
            availablePowersList.push({ name: powerName, level: 3, desc: powerDescription });
        }
    }
    return availablePowersList;
}

/**
 * Updates a selected Discipline power in `cw_char.disc_powers` and refreshes Step 7.
 *
 * @param {string} disciplineName - Discipline name.
 * @param {number} powerSlotIndex - 0-based power slot index.
 * @param {string} selectedPowerName - Selected power name.
 * @returns {void}
 */
function selectWizardDiscPower(disciplineName, powerSlotIndex, selectedPowerName) {
    if (!cw_char.disc_powers[disciplineName]) cw_char.disc_powers[disciplineName] = [];
    cw_char.disc_powers[disciplineName][powerSlotIndex] = selectedPowerName;
    renderWizardStep();
}

/**
 * Renders Step 7 (Disciplines & Powers selection).
 *
 * @returns {string} HTML string for Step 7.
 */
function renderDisciplinesStep() {
    if (cw_char.clan === 'Thin-Blood') {
        return `
            <div style="background:rgba(168, 85, 247, 0.1); border:1px solid #a855f7; border-radius:6px; padding:18px;">
                <h4 style="color:#a855f7; margin:0 0 8px 0;">Thin-Blood Vampiric Traits</h4>
                <p style="font-size:13px; color:#e4e4e7; line-height:1.5; margin:0;">
                    As a Duskborn (Thin-Blood), you do not begin with innate Clan Disciplines. Instead, you can select <strong>Thin-Blood Alchemist (1)</strong> or <strong>Discipline Affinity (1)</strong> in <strong>Step 8 (Merits & Flaws)</strong>!
                </p>
            </div>
        `;
    }

    const clanData = V5_DATA.clans[cw_char.clan] || V5_DATA.clans['Brujah'];
    const availableDisciplines = cw_char.clan === 'Caitiff'
        ? Object.keys(V5_DISCIPLINES).filter(disciplineName => disciplineName !== 'Thin-Blood Alchemy')
        : clanData.disciplines;

    if (!availableDisciplines.includes(cw_char.disc_primary)) {
        cw_char.disc_primary = availableDisciplines[0];
    }
    if (!availableDisciplines.includes(cw_char.disc_secondary) || cw_char.disc_secondary === cw_char.disc_primary) {
        cw_char.disc_secondary = availableDisciplines.find(disciplineName => disciplineName !== cw_char.disc_primary) || availableDisciplines[1];
    }

    const disciplineTotals = computeWizardDisciplineTotals();
    const predatorBonusDiscipline = (cw_char.predator_type && cw_char.predator_type !== 'None') ? cw_char.predator_discipline : '';

    // Ensure default non-duplicate power selections for each active discipline
    for (const [disciplineName, dotCount] of Object.entries(disciplineTotals)) {
        if (!Array.isArray(cw_char.disc_powers[disciplineName])) cw_char.disc_powers[disciplineName] = [];
        const selectedPowerNamesSet = new Set();
        for (let slotIndex = 0; slotIndex < dotCount; slotIndex++) {
            const maxAllowedLevel = slotIndex + 1;
            const availablePowerOptions = getAvailablePowersUpToLevel(disciplineName, maxAllowedLevel);
            const currentPowerName = cw_char.disc_powers[disciplineName][slotIndex];
            if (!currentPowerName || !availablePowerOptions.some(powerOption => powerOption.name === currentPowerName) || selectedPowerNamesSet.has(currentPowerName)) {
                const fallbackPowerOption = availablePowerOptions.find(powerOption => !selectedPowerNamesSet.has(powerOption.name)) || availablePowerOptions[0];
                cw_char.disc_powers[disciplineName][slotIndex] = fallbackPowerOption ? fallbackPowerOption.name : '';
            }
            if (cw_char.disc_powers[disciplineName][slotIndex]) selectedPowerNamesSet.add(cw_char.disc_powers[disciplineName][slotIndex]);
        }
        cw_char.disc_powers[disciplineName] = cw_char.disc_powers[disciplineName].slice(0, dotCount);
    }

    const disciplineCardsHtml = Object.entries(disciplineTotals).map(([disciplineName, dotCount]) => {
        const disciplineMetadata = V5_DISCIPLINES[disciplineName] || { desc: '' };
        const hasPredatorBonus = predatorBonusDiscipline === disciplineName;
        let dotsVisualHtml = '';
        for (let dotNumber = 1; dotNumber <= 5; dotNumber++) {
            dotsVisualHtml += `<span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:${dotNumber <= dotCount ? '#ef4444' : 'transparent'}; border:1px solid ${dotNumber <= dotCount ? '#ef4444' : '#52525b'}; margin-right:3px;"></span>`;
        }

        let powerSelectsHtml = '';
        for (let powerSlotIndex = 0; powerSlotIndex < dotCount; powerSlotIndex++) {
            const maxAllowedLevel = powerSlotIndex + 1;
            const availablePowerOptions = getAvailablePowersUpToLevel(disciplineName, maxAllowedLevel);
            const currentPowerName = cw_char.disc_powers[disciplineName][powerSlotIndex] || '';
            const selectedPowerObject = availablePowerOptions.find(powerOption => powerOption.name === currentPowerName);

            const optionsHtml = availablePowerOptions.map(powerOption => {
                const isUsedInAnotherSlot = cw_char.disc_powers[disciplineName].some((otherPowerName, otherSlotIndex) => otherSlotIndex !== powerSlotIndex && otherPowerName === powerOption.name);
                return `<option value="${escapeWizardHtml(powerOption.name)}" ${currentPowerName === powerOption.name ? 'selected' : ''} ${isUsedInAnotherSlot ? 'disabled' : ''}>Level ${powerOption.level}: ${escapeWizardHtml(powerOption.name)}${isUsedInAnotherSlot ? ' (Already selected)' : ''}</option>`;
            }).join('');

            powerSelectsHtml += `
                <div style="margin-bottom:10px; background:rgba(0,0,0,0.3); padding:10px; border-radius:5px; border:1px solid #27272a;">
                    <label style="font-size:11px; color:#a855f7; font-weight:600; display:block; margin-bottom:4px;">
                        Power Slot ${powerSlotIndex + 1} (Choose up to Level ${maxAllowedLevel}) ${hasPredatorBonus && powerSlotIndex === dotCount - 1 ? '<span style="color:#fca5a5;">— Predator Type +1 Bonus Dot</span>' : ''}
                    </label>
                    <select class="vtm-input" style="margin-bottom:6px;" onchange="selectWizardDiscPower('${disciplineName}', ${powerSlotIndex}, this.value)">
                        ${optionsHtml}
                    </select>
                    <div style="font-size:11px; color:#d4d4d8; line-height:1.4;">${escapeWizardHtml(selectedPowerObject ? selectedPowerObject.desc : '')}</div>
                </div>
            `;
        }

        return `
            <div style="background:rgba(0,0,0,0.35); border:1px solid ${hasPredatorBonus ? '#ef4444' : '#3f3f46'}; border-radius:6px; padding:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div>
                        <strong style="color:#fff; font-size:15px;">${escapeWizardHtml(disciplineName)}</strong>
                        ${hasPredatorBonus ? `<span style="background:rgba(239,68,68,0.2); color:#fca5a5; font-size:10px; padding:2px 6px; border-radius:4px; margin-left:6px;">Includes +1 ${escapeWizardHtml(cw_char.predator_type)} Dot</span>` : ''}
                    </div>
                    <div>${dotsVisualHtml}</div>
                </div>
                <p style="font-size:11px; color:#a1a1aa; margin:0 0 10px 0;">${escapeWizardHtml(disciplineMetadata.desc)}</p>
                ${powerSelectsHtml}
            </div>
        `;
    }).join('');

    return `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px; margin-bottom:16px; background:rgba(168,85,247,0.08); border:1px solid rgba(168,85,247,0.35); border-radius:6px; padding:12px 16px;">
            <div class="form-col">
                <label style="color:#e9d5ff;">Primary Starting Discipline (2 Base Dots)</label>
                <select class="vtm-input" onchange="cw_char.disc_primary = this.value; if(cw_char.disc_secondary === this.value) cw_char.disc_secondary = '${availableDisciplines[0]}' === this.value ? '${availableDisciplines[1]}' : '${availableDisciplines[0]}'; renderWizardStep();">
                    ${availableDisciplines.map(disciplineName => `<option value="${disciplineName}" ${cw_char.disc_primary === disciplineName ? 'selected' : ''}>${disciplineName}</option>`).join('')}
                </select>
            </div>
            <div class="form-col">
                <label style="color:#e9d5ff;">Secondary Starting Discipline (1 Base Dot)</label>
                <select class="vtm-input" onchange="cw_char.disc_secondary = this.value; renderWizardStep();">
                    ${availableDisciplines.filter(disciplineName => disciplineName !== cw_char.disc_primary).map(disciplineName => `<option value="${disciplineName}" ${cw_char.disc_secondary === disciplineName ? 'selected' : ''}>${disciplineName}</option>`).join('')}
                </select>
            </div>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:14px;">
            ${disciplineCardsHtml}
        </div>
    `;
}

// =============================================================================
// STEP 8: ADVANTAGES (MERITS, BACKGROUNDS, FLAWS) & BIOGRAPHY
// =============================================================================

/**
 * Parses a Merit, Background, or Flaw string like `"Resources (1-5)"` or `"Beautiful (2)"`
 * into its base name, min rating, and max rating.
 *
 * @param {string} rawLabel - Option label from `V5_DATA`.
 * @returns {{raw: string, baseName: string, min: number, max: number}} Parsed metadata.
 */
function parseAdvantageLabel(rawLabel) {
    if (!rawLabel) return { raw: '', baseName: '', min: 1, max: 5 };
    const rangeMatch = rawLabel.match(/^(.*?)\s*\((\d+)-(\d+)\)$/);
    if (rangeMatch) {
        return {
            raw: rawLabel,
            baseName: rangeMatch[1].trim(),
            min: parseInt(rangeMatch[2]),
            max: parseInt(rangeMatch[3])
        };
    }
    const exactMatch = rawLabel.match(/^(.*?)\s*\((\d+)\)$/);
    if (exactMatch) {
        const exactRatingValue = parseInt(exactMatch[2]);
        return {
            raw: rawLabel,
            baseName: exactMatch[1].trim(),
            min: exactRatingValue,
            max: exactRatingValue
        };
    }
    return { raw: rawLabel, baseName: rawLabel.trim(), min: 1, max: 5 };
}

/**
 * Renders Step 8 (Merits, Backgrounds, Flaws & Final Biography).
 *
 * @returns {string} HTML string for Step 8.
 */
function renderAdvantagesAndBioStep() {
    const requiredAdvantageDots = cw_char.age_tier === 'Ancilla' ? 9 : 7;
    const requiredFlawDots = cw_char.age_tier === 'Ancilla' ? 4 : 2;
    const spentAdvantageDots = cw_char.merits.reduce((sumSoFar, meritItem) => sumSoFar + (parseInt(meritItem.rating) || 0), 0);
    const spentFlawDots = cw_char.flaws.reduce((sumSoFar, flawItem) => sumSoFar + (parseInt(flawItem.rating) || 0), 0);

    // Gather Predator Type & Clan automatic traits
    const automaticTraits = [];
    if (cw_char.clan === 'Nosferatu') {
        automaticTraits.push({ key: 'clan_nos', name: 'Repulsive', rating: 2, type: 'flaw', source: 'Nosferatu Clan Bane', defaultDesc: '-2 dice to relevant Social pools' });
    } else if (cw_char.clan === 'Caitiff') {
        automaticTraits.push({ key: 'clan_caitiff', name: 'Suspect', rating: 1, type: 'flaw', source: 'Caitiff Outcast', defaultDesc: 'Distrusted by Kindred society' });
    }
    if (cw_char.predator_type && cw_char.predator_type !== 'None' && V5_DATA.predator_types[cw_char.predator_type]) {
        const predatorData = V5_DATA.predator_types[cw_char.predator_type];
        (predatorData.advantages || []).forEach((advantageEntry, advantageIndex) => {
            automaticTraits.push({ key: `pred_adv_${advantageIndex}`, name: advantageEntry.name, rating: advantageEntry.rating, type: advantageEntry.type || 'background', source: `${cw_char.predator_type} Predator`, defaultDesc: advantageEntry.desc || '' });
        });
        (predatorData.flaws || []).forEach((flawEntry, flawIndex) => {
            automaticTraits.push({ key: `pred_flaw_${flawIndex}`, name: flawEntry.name, rating: flawEntry.rating, type: 'flaw', source: `${cw_char.predator_type} Predator`, defaultDesc: flawEntry.desc || '' });
        });
    }

    const automaticTraitsHtml = automaticTraits.length > 0 ? automaticTraits.map(automaticTrait => {
        const customNoteValue = cw_char.predator_custom_notes[automaticTrait.key] !== undefined ? cw_char.predator_custom_notes[automaticTrait.key] : automaticTrait.defaultDesc;
        const badgeColor = automaticTrait.type === 'flaw' ? '#ef4444' : (automaticTrait.type === 'background' ? '#3b82f6' : '#a855f7');
        return `
            <div style="display:grid; grid-template-columns:180px 1fr; gap:10px; align-items:center; margin-bottom:6px; background:rgba(0,0,0,0.3); padding:6px 10px; border-radius:4px; border:1px solid #27272a;">
                <div>
                    <span style="background:${badgeColor}; color:#fff; font-size:9px; font-weight:bold; padding:1px 5px; border-radius:3px; text-transform:uppercase; margin-right:5px;">${automaticTrait.type}</span>
                    <strong style="color:#fff; font-size:12px;">${escapeWizardHtml(automaticTrait.name)} (${automaticTrait.rating})</strong>
                    <div style="font-size:10px; color:#a1a1aa;">From ${escapeWizardHtml(automaticTrait.source)}</div>
                </div>
                <input type="text" class="vtm-input" style="padding:4px 8px; font-size:11px;" value="${escapeWizardHtml(customNoteValue)}" oninput="cw_char.predator_custom_notes['${automaticTrait.key}'] = this.value" placeholder="Specify details (e.g. who is this Contact, Herd, or Enemy?)...">
            </div>
        `;
    }).join('') : '<div style="font-size:12px; color:#a1a1aa; font-style:italic;">None from Predator Type / Clan.</div>';

    // Category options for Advantages
    const meritCategoryNames = Object.keys(V5_DATA.merits_backgrounds);
    if (!meritCategoryNames.includes(cw_adv_filter)) cw_adv_filter = meritCategoryNames[0];
    const currentMeritOptions = V5_DATA.merits_backgrounds[cw_adv_filter] || [];

    const allFlawOptions = [];
    for (const [flawCategoryName, flawLabelList] of Object.entries(V5_DATA.flaws)) {
        flawLabelList.forEach(flawLabel => allFlawOptions.push({ cat: flawCategoryName, label: flawLabel }));
    }

    return `
        <!-- Automatic Predator & Clan Traits -->
        <div style="background:rgba(255,255,255,0.03); border:1px solid #3f3f46; border-radius:6px; padding:12px 14px; margin-bottom:16px;">
            <strong style="color:#e4e4e7; font-size:13px; display:block; margin-bottom:8px;">
                <i class="fa-solid fa-gift" style="color:#a855f7; margin-right:6px;"></i> Included Predator Type & Clan Traits <span style="font-size:11px; color:#a1a1aa; font-weight:normal;">(Free — does not count against your ${requiredAdvantageDots} Advantage / ${requiredFlawDots} Flaw points)</span>
            </strong>
            ${automaticTraitsHtml}
        </div>

        <!-- Free Advantages & Flaws Side-by-Side -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:18px;">
            <!-- Merits & Backgrounds Box -->
            <div style="background:rgba(0,0,0,0.35); border:1px solid #3f3f46; border-radius:6px; padding:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong style="color:#a855f7; font-size:14px;">Merits & Backgrounds</strong>
                    <span id="cw_merits_count" style="font-size:12px; font-weight:bold; padding:2px 8px; border-radius:4px; background:rgba(168,85,247,0.15); color:${spentAdvantageDots === requiredAdvantageDots ? '#86efac' : '#e9d5ff'};">${spentAdvantageDots} / ${requiredAdvantageDots} Dots</span>
                </div>
                <div style="margin-bottom:8px;">
                    <label style="font-size:11px; color:#a1a1aa;">1. Category:</label>
                    <select id="cw_merit_cat_select" class="vtm-input" style="padding:5px 8px; font-size:12px; margin-bottom:6px;" onchange="cw_adv_filter = this.value; saveBioInputsFromDOM(); renderWizardStep();">
                        ${meritCategoryNames.map(categoryName => `<option value="${escapeWizardHtml(categoryName)}" ${cw_adv_filter === categoryName ? 'selected' : ''}>${escapeWizardHtml(categoryName)}</option>`).join('')}
                    </select>
                    <label style="font-size:11px; color:#a1a1aa;">2. Select Trait & Dot Rating:</label>
                    <div style="display:flex; gap:6px; margin-bottom:6px;">
                        <select id="cw_add_merit_name" class="vtm-input" style="flex:1; padding:5px 8px; font-size:12px;" onchange="updateAdvantageUI('merit')">
                            ${currentMeritOptions.map(meritOptionLabel => `<option value="${escapeWizardHtml(meritOptionLabel)}">${escapeWizardHtml(meritOptionLabel)}</option>`).join('')}
                        </select>
                        <input type="number" id="cw_add_merit_rating" class="vtm-input" style="width:64px; text-align:center;" min="1" max="5" value="1">
                    </div>
                    <div id="cw_merit_glossary" style="font-size:11px; color:#c084fc; min-height:28px; margin-bottom:6px; font-style:italic;"></div>
                    <div style="display:flex; gap:6px;">
                        <input type="text" id="cw_add_merit_desc" class="vtm-input" style="flex:1; padding:5px 8px; font-size:12px;" placeholder="Details (e.g. Police Detective, Luxury Loft)...">
                        <button type="button" class="btn-action" style="padding:5px 12px; font-size:12px; background:#7e22ce; white-space:nowrap;" onclick="addCartItem('merit')"><i class="fa-solid fa-plus"></i> Add</button>
                    </div>
                </div>
                <div id="cw_cart_merits" style="max-height:170px; overflow-y:auto; margin-top:10px;"></div>
            </div>

            <!-- Flaws Box -->
            <div style="background:rgba(0,0,0,0.35); border:1px solid #3f3f46; border-radius:6px; padding:14px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <strong style="color:#ef4444; font-size:14px;">Character Flaws</strong>
                    <span id="cw_flaws_count" style="font-size:12px; font-weight:bold; padding:2px 8px; border-radius:4px; background:rgba(239,68,68,0.15); color:${spentFlawDots === requiredFlawDots ? '#86efac' : '#fca5a5'};">${spentFlawDots} / ${requiredFlawDots} Dots</span>
                </div>
                <div style="margin-bottom:8px;">
                    <label style="font-size:11px; color:#a1a1aa;">Select Flaw & Dot Rating:</label>
                    <div style="display:flex; gap:6px; margin-bottom:6px;">
                        <select id="cw_add_flaw_name" class="vtm-input" style="flex:1; padding:5px 8px; font-size:12px;" onchange="updateAdvantageUI('flaw')">
                            ${allFlawOptions.map(flawOption => `<option value="${escapeWizardHtml(flawOption.label)}">[${escapeWizardHtml(flawOption.cat.split(' ')[0])}] ${escapeWizardHtml(flawOption.label)}</option>`).join('')}
                        </select>
                        <input type="number" id="cw_add_flaw_rating" class="vtm-input" style="width:64px; text-align:center;" min="1" max="5" value="1">
                    </div>
                    <div id="cw_flaw_glossary" style="font-size:11px; color:#fca5a5; min-height:28px; margin-bottom:6px; font-style:italic;"></div>
                    <div style="display:flex; gap:6px;">
                        <input type="text" id="cw_add_flaw_desc" class="vtm-input" style="flex:1; padding:5px 8px; font-size:12px;" placeholder="Details (e.g. Hunted by former Sire)...">
                        <button type="button" class="btn-action" style="padding:5px 12px; font-size:12px; white-space:nowrap;" onclick="addCartItem('flaw')"><i class="fa-solid fa-plus"></i> Add</button>
                    </div>
                </div>
                <div id="cw_cart_flaws" style="max-height:170px; overflow-y:auto; margin-top:10px;"></div>
            </div>
        </div>

        <!-- Morality & Biography Section -->
        <div style="background:rgba(0,0,0,0.35); border:1px solid #3f3f46; border-radius:6px; padding:16px;">
            <h4 style="color:#ef4444; font-family:'Cinzel',serif; margin:0 0 12px 0;">Morality, Touchstones & Personal History</h4>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:12px;">
                <div class="form-col">
                    <label>Convictions & Touchstones (Moral Anchors)</label>
                    <textarea id="cw_bio_touchstones" class="vtm-input" rows="3" placeholder="e.g. Conviction: Never harm a child.\nTouchstone: Elena Rivera (my mortal sister, ER nurse).">${escapeWizardHtml(cw_char.touchstones)}</textarea>
                </div>
                <div class="form-col">
                    <label>Chronicle Tenets (If Known)</label>
                    <textarea id="cw_bio_tenets" class="vtm-input" rows="3" placeholder="Shared moral rules of your Chronicle table...">${escapeWizardHtml(cw_char.chronicle_tenets)}</textarea>
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr 1fr; gap:10px; margin-bottom:12px;">
                <div class="form-col">
                    <label>True Age</label>
                    <input type="text" id="cw_bio_true_age" class="vtm-input" value="${escapeWizardHtml(cw_char.true_age)}" placeholder="e.g. 84">
                </div>
                <div class="form-col">
                    <label>Apparent Age</label>
                    <input type="text" id="cw_bio_apparent_age" class="vtm-input" value="${escapeWizardHtml(cw_char.apparent_age)}" placeholder="e.g. Late 20s">
                </div>
                <div class="form-col">
                    <label>Date of Birth</label>
                    <input type="text" id="cw_bio_dob" class="vtm-input" value="${escapeWizardHtml(cw_char.dob)}" placeholder="e.g. Oct 14, 1942">
                </div>
                <div class="form-col">
                    <label>Date of Embrace</label>
                    <input type="text" id="cw_bio_dod" class="vtm-input" value="${escapeWizardHtml(cw_char.dod)}" placeholder="e.g. Nov 3, 1971">
                </div>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
                <div class="form-col">
                    <label>Physical Appearance</label>
                    <textarea id="cw_bio_appearance" class="vtm-input" rows="3" placeholder="Height, build, clothing style, bearing...">${escapeWizardHtml(cw_char.appearance)}</textarea>
                </div>
                <div class="form-col">
                    <label>Distinguishing Features</label>
                    <textarea id="cw_bio_features" class="vtm-input" rows="3" placeholder="Scars, tattoos, piercing gaze, voice...">${escapeWizardHtml(cw_char.distinguishing_features)}</textarea>
                </div>
                <div class="form-col">
                    <label>History & Backstory</label>
                    <textarea id="cw_bio_history" class="vtm-input" rows="3" placeholder="Mortal life, the night of your Embrace, and current goals...">${escapeWizardHtml(cw_char.history)}</textarea>
                </div>
            </div>
        </div>
    `;
}

/**
 * Updates the glossary preview and valid rating bounds when a Merit/Background/Flaw
 * is selected in Step 8.
 *
 * @param {string} advantageType - `'merit'` or `'flaw'`.
 * @returns {void}
 */
function updateAdvantageUI(advantageType) {
    // document.getElementById locates the trait dropdown, rating number input, and glossary description div for Merits or Flaws
    const traitSelectElement = document.getElementById(advantageType === 'merit' ? 'cw_add_merit_name' : 'cw_add_flaw_name');
    const ratingInputElement = document.getElementById(advantageType === 'merit' ? 'cw_add_merit_rating' : 'cw_add_flaw_rating');
    const glossaryDescriptionElement = document.getElementById(advantageType === 'merit' ? 'cw_merit_glossary' : 'cw_flaw_glossary');
    if (!traitSelectElement || !ratingInputElement || !glossaryDescriptionElement) return;

    const rawSelectedLabel = traitSelectElement.value;
    const parsedAdvantage = parseAdvantageLabel(rawSelectedLabel);
    const glossaryText = V5_ADVANTAGES_GLOSSARY[rawSelectedLabel] || V5_ADVANTAGES_GLOSSARY[parsedAdvantage.baseName] || '';
    glossaryDescriptionElement.innerText = glossaryText;

    ratingInputElement.min = parsedAdvantage.min;
    ratingInputElement.max = parsedAdvantage.max;
    const currentRatingValue = parseInt(ratingInputElement.value) || parsedAdvantage.min;
    if (currentRatingValue < parsedAdvantage.min || currentRatingValue > parsedAdvantage.max) {
        ratingInputElement.value = parsedAdvantage.min;
    }
    ratingInputElement.disabled = (parsedAdvantage.min === parsedAdvantage.max);
    ratingInputElement.style.opacity = (parsedAdvantage.min === parsedAdvantage.max) ? '0.6' : '1';
}

/**
 * Renders the lists of added Merits/Backgrounds and Flaws in Step 8.
 *
 * @returns {void}
 */
function renderCartUI() {
    const requiredAdvantageDots = cw_char.age_tier === 'Ancilla' ? 9 : 7;
    const requiredFlawDots = cw_char.age_tier === 'Ancilla' ? 4 : 2;
    const currentAdvantageDots = cw_char.merits.reduce((sumSoFar, meritItem) => sumSoFar + (parseInt(meritItem.rating) || 0), 0);
    const currentFlawDots = cw_char.flaws.reduce((sumSoFar, flawItem) => sumSoFar + (parseInt(flawItem.rating) || 0), 0);

    // document.getElementById locates the Merits/Backgrounds and Flaws cart list containers in Step 8
    const meritsCartContainer = document.getElementById('cw_cart_merits');
    const flawsCartContainer = document.getElementById('cw_cart_flaws');
    if (!meritsCartContainer || !flawsCartContainer) return;

    meritsCartContainer.innerHTML = cw_char.merits.length === 0
        ? '<div style="font-size:12px; color:#9ca3af; font-style:italic;">No Merits or Backgrounds added yet.</div>'
        : cw_char.merits.map((meritItem, meritIndex) => `
            <div style="background:rgba(0,0,0,0.4); border:1px solid #3f3f46; padding:6px 10px; border-radius:4px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="background:${meritItem.category === 'background' ? '#3b82f6' : '#a855f7'}; color:#fff; font-size:9px; font-weight:bold; padding:1px 5px; border-radius:3px; text-transform:uppercase; margin-right:5px;">${meritItem.category || 'merit'}</span>
                    <strong style="color:#fff; font-size:12px;">${escapeWizardHtml(meritItem.name)} (${meritItem.rating})</strong>
                    ${meritItem.desc ? `<div style="font-size:11px; color:#d4d4d8;">${escapeWizardHtml(meritItem.desc)}</div>` : ''}
                </div>
                <button type="button" onclick="removeCartItem('merit', ${meritIndex})" style="background:transparent; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');

    flawsCartContainer.innerHTML = cw_char.flaws.length === 0
        ? '<div style="font-size:12px; color:#9ca3af; font-style:italic;">No Flaws added yet.</div>'
        : cw_char.flaws.map((flawItem, flawIndex) => `
            <div style="background:rgba(0,0,0,0.4); border:1px solid #3f3f46; padding:6px 10px; border-radius:4px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <span style="background:#ef4444; color:#fff; font-size:9px; font-weight:bold; padding:1px 5px; border-radius:3px; text-transform:uppercase; margin-right:5px;">FLAW</span>
                    <strong style="color:#fff; font-size:12px;">${escapeWizardHtml(flawItem.name)} (${flawItem.rating})</strong>
                    ${flawItem.desc ? `<div style="font-size:11px; color:#d4d4d8;">${escapeWizardHtml(flawItem.desc)}</div>` : ''}
                </div>
                <button type="button" onclick="removeCartItem('flaw', ${flawIndex})" style="background:transparent; border:none; color:#ef4444; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');

    // document.getElementById locates the dot counter badges for Merits and Flaws
    const meritsCountBadgeElement = document.getElementById('cw_merits_count');
    const flawsCountBadgeElement = document.getElementById('cw_flaws_count');
    if (meritsCountBadgeElement) {
        meritsCountBadgeElement.innerText = `${currentAdvantageDots} / ${requiredAdvantageDots} Dots`;
        meritsCountBadgeElement.style.color = currentAdvantageDots === requiredAdvantageDots ? '#86efac' : (currentAdvantageDots > requiredAdvantageDots ? '#fca5a5' : '#e9d5ff');
    }
    if (flawsCountBadgeElement) {
        flawsCountBadgeElement.innerText = `${currentFlawDots} / ${requiredFlawDots} Dots`;
        flawsCountBadgeElement.style.color = currentFlawDots >= requiredFlawDots ? '#86efac' : '#fca5a5';
    }
}

/**
 * Adds a Merit/Background or Flaw item in Step 8.
 *
 * @param {string} advantageType - `'merit'` or `'flaw'`.
 * @returns {void}
 */
function addCartItem(advantageType) {
    // document.getElementById hides any previous error banner when adding a new item
    const errorBannerElement = document.getElementById('cw-error');
    if (errorBannerElement) errorBannerElement.style.display = 'none';

    // document.getElementById locates the trait name select, dot rating input, and description text input
    const traitSelectElement = document.getElementById(advantageType === 'merit' ? 'cw_add_merit_name' : 'cw_add_flaw_name');
    const ratingInputElement = document.getElementById(advantageType === 'merit' ? 'cw_add_merit_rating' : 'cw_add_flaw_rating');
    const descriptionInputElement = document.getElementById(advantageType === 'merit' ? 'cw_add_merit_desc' : 'cw_add_flaw_desc');
    if (!traitSelectElement || !ratingInputElement) return;

    const parsedAdvantage = parseAdvantageLabel(traitSelectElement.value);
    if (!parsedAdvantage.baseName) return showWizardError("Please select a trait.");

    let dotRating = parseInt(ratingInputElement.value) || parsedAdvantage.min;
    if (dotRating < parsedAdvantage.min || dotRating > parsedAdvantage.max) {
        dotRating = Math.max(parsedAdvantage.min, Math.min(parsedAdvantage.max, dotRating));
    }
    const customDescription = descriptionInputElement ? descriptionInputElement.value.trim() : '';

    if (advantageType === 'merit') {
        const backgroundOptionLabels = V5_DATA.merits_backgrounds['Backgrounds'] || [];
        const isBackgroundCategory = cw_adv_filter === 'Backgrounds' || backgroundOptionLabels.some(backgroundLabel => parseAdvantageLabel(backgroundLabel).baseName.toLowerCase() === parsedAdvantage.baseName.toLowerCase());
        cw_char.merits.push({
            name: parsedAdvantage.baseName,
            rating: dotRating,
            desc: customDescription,
            category: isBackgroundCategory ? 'background' : 'merit'
        });
    } else {
        cw_char.flaws.push({
            name: parsedAdvantage.baseName,
            rating: dotRating,
            desc: customDescription,
            category: 'flaw'
        });
    }

    if (descriptionInputElement) descriptionInputElement.value = '';
    renderCartUI();
}

/**
 * Removes a Merit/Background or Flaw from the list in Step 8.
 *
 * @param {string} advantageType - `'merit'` or `'flaw'`.
 * @param {number} itemIndex - Array index to remove.
 * @returns {void}
 */
function removeCartItem(advantageType, itemIndex) {
    if (advantageType === 'merit') cw_char.merits.splice(itemIndex, 1);
    else cw_char.flaws.splice(itemIndex, 1);
    renderCartUI();
}

/**
 * Saves the biography fields from Step 8 DOM into `cw_char`.
 *
 * @returns {void}
 */
function saveBioInputsFromDOM() {
    const getTrimmedInputValueById = elementId => {
        // document.getElementById finds the biography input/textarea element by its ID
        const inputElement = document.getElementById(elementId);
        return inputElement ? inputElement.value.trim() : null;
    };
    const touchstonesValue = getTrimmedInputValueById('cw_bio_touchstones'); if (touchstonesValue !== null) cw_char.touchstones = touchstonesValue;
    const chronicleTenetsValue = getTrimmedInputValueById('cw_bio_tenets'); if (chronicleTenetsValue !== null) cw_char.chronicle_tenets = chronicleTenetsValue;
    const trueAgeValue = getTrimmedInputValueById('cw_bio_true_age'); if (trueAgeValue !== null) cw_char.true_age = trueAgeValue;
    const apparentAgeValue = getTrimmedInputValueById('cw_bio_apparent_age'); if (apparentAgeValue !== null) cw_char.apparent_age = apparentAgeValue;
    const dateOfBirthValue = getTrimmedInputValueById('cw_bio_dob'); if (dateOfBirthValue !== null) cw_char.dob = dateOfBirthValue;
    const dateOfEmbraceValue = getTrimmedInputValueById('cw_bio_dod'); if (dateOfEmbraceValue !== null) cw_char.dod = dateOfEmbraceValue;
    const appearanceValue = getTrimmedInputValueById('cw_bio_appearance'); if (appearanceValue !== null) cw_char.appearance = appearanceValue;
    const distinguishingFeaturesValue = getTrimmedInputValueById('cw_bio_features'); if (distinguishingFeaturesValue !== null) cw_char.distinguishing_features = distinguishingFeaturesValue;
    const historyValue = getTrimmedInputValueById('cw_bio_history'); if (historyValue !== null) cw_char.history = historyValue;
}

/**
 * Saves inputs from the current wizard step into `cw_char`.
 *
 * @returns {void}
 */
function saveWizardStep() {
    if (cw_step === 1) {
        // document.getElementById reads the Step 1 identity text inputs and role dropdown from the DOM
        const nameInputElement = document.getElementById('cw_name'); if (nameInputElement) cw_char.name = nameInputElement.value.trim();
        const shortNameInputElement = document.getElementById('cw_short_name'); if (shortNameInputElement) cw_char.short_name = shortNameInputElement.value.trim();
        const conceptInputElement = document.getElementById('cw_concept'); if (conceptInputElement) cw_char.concept = conceptInputElement.value.trim();
        const ambitionInputElement = document.getElementById('cw_ambition'); if (ambitionInputElement) cw_char.ambition = ambitionInputElement.value.trim();
        const desireInputElement = document.getElementById('cw_desire'); if (desireInputElement) cw_char.desire = desireInputElement.value.trim();
        const categorySelectElement = document.getElementById('cw_category'); if (categorySelectElement) cw_char.category = categorySelectElement.value;
    } else if (cw_step === 2) {
        // document.getElementById reads the Step 2 Sire text input and Sect dropdown from the DOM
        const sireInputElement = document.getElementById('cw_sire'); if (sireInputElement) cw_char.sire = sireInputElement.value.trim();
        const sectSelectElement = document.getElementById('cw_sect'); if (sectSelectElement && sectSelectElement.value) cw_char.sect = sectSelectElement.value;
    } else if (cw_step === 3) {
        // document.getElementById reads the Step 3 Generation select element from the DOM
        const generationSelectElement = document.getElementById('cw_gen_select'); if (generationSelectElement && generationSelectElement.value) cw_char.generation = generationSelectElement.value;
    } else if (cw_step === 5) {
        saveSkillSpecialtiesFromDOM();
    } else if (cw_step === 8) {
        saveBioInputsFromDOM();
    }
}

/**
 * Validates the current step and advances to the next step (or submits the character on Step 8).
 *
 * @returns {void}
 */
function nextWizardStep() {
    saveWizardStep();

    if (cw_step === 1) {
        if (!cw_char.name) return showWizardError("Please enter a Character Name.");
        if (!cw_char.concept) return showWizardError("Please enter a Character Concept.");
    } else if (cw_step === 2) {
        if (!cw_char.clan) return showWizardError("Please select a Clan.");
    } else if (cw_step === 4) {
        const unassignedAttributeCount = Object.values(cw_char.attributes).filter(attributeRating => attributeRating === 0).length;
        if (unassignedAttributeCount > 0) {
            return showWizardError(`Please assign all 9 Attributes before proceeding (${unassignedAttributeCount} remaining).`);
        }
    } else if (cw_step === 5) {
        const totalExpectedSkills = SKILL_ARRAYS[cw_skill_array_type].length;
        const assignedSkillsCount = Object.values(cw_char.skills).filter(skillRating => skillRating > 0).length;
        if (assignedSkillsCount < totalExpectedSkills) {
            return showWizardError(`Please assign all ${totalExpectedSkills} Skill ratings in your ${cw_skill_array_type} array (${totalExpectedSkills - assignedSkillsCount} remaining).`);
        }
        if (!cw_char.free_specialty_skill || !cw_char.free_specialty_text.trim()) {
            return showWizardError("Please choose a Skill and enter a name for your 1 free starting Specialty.");
        }
        for (const autoSpecialtySkillKey of CW_AUTO_SPECIALTY_SKILLS) {
            if (cw_char.skills[autoSpecialtySkillKey] > 0 && !(cw_char.auto_specialties[autoSpecialtySkillKey] || '').trim()) {
                return showWizardError(`In V5, having dots in ${autoSpecialtySkillKey.toUpperCase()} grants a free specialty—please enter your ${autoSpecialtySkillKey} specialty.`);
            }
        }
    } else if (cw_step === 6) {
        if (!cw_char.predator_type) {
            return showWizardError("Please select a Predator Type above.");
        }
    } else if (cw_step === 7) {
        if (cw_char.clan !== 'Thin-Blood') {
            const disciplineTotals = computeWizardDisciplineTotals();
            for (const [disciplineName, dotCount] of Object.entries(disciplineTotals)) {
                const chosenPowerNames = (cw_char.disc_powers[disciplineName] || []).filter(Boolean);
                if (chosenPowerNames.length < dotCount) {
                    return showWizardError(`Please select ${dotCount} power(s) for ${disciplineName}.`);
                }
                if (new Set(chosenPowerNames).size !== chosenPowerNames.length) {
                    return showWizardError(`Please select distinct powers for ${disciplineName}.`);
                }
            }
        }
    } else if (cw_step === CW_TOTAL_STEPS) {
        const requiredAdvantageDots = cw_char.age_tier === 'Ancilla' ? 9 : 7;
        const requiredFlawDots = cw_char.age_tier === 'Ancilla' ? 4 : 2;
        const currentAdvantageDots = cw_char.merits.reduce((sumSoFar, meritItem) => sumSoFar + (parseInt(meritItem.rating) || 0), 0);
        const currentFlawDots = cw_char.flaws.reduce((sumSoFar, flawItem) => sumSoFar + (parseInt(flawItem.rating) || 0), 0);

        if (currentAdvantageDots !== requiredAdvantageDots) {
            return showWizardError(`Please spend exactly ${requiredAdvantageDots} dots on Merits & Backgrounds (currently ${currentAdvantageDots} / ${requiredAdvantageDots}).`);
        }
        if (currentFlawDots < requiredFlawDots) {
            return showWizardError(`Please select at least ${requiredFlawDots} dots of Flaws (currently ${currentFlawDots} / ${requiredFlawDots}).`);
        }
        submitWizardCharacter();
        return;
    }

    cw_step++;
    cw_active_token = null;
    renderWizardStep();
    if (cw_step === 8) {
        updateAdvantageUI('merit');
        updateAdvantageUI('flaw');
        renderCartUI();
    }
}

/**
 * Moves back one step in the wizard while preserving inputs.
 *
 * @returns {void}
 */
function prevWizardStep() {
    if (cw_step <= 1) return;
    saveWizardStep();
    cw_step--;
    cw_active_token = null;
    renderWizardStep();
    if (cw_step === 8) {
        updateAdvantageUI('merit');
        updateAdvantageUI('flaw');
        renderCartUI();
    }
}

/**
 * Displays a validation or status error inside `#cw-error`.
 *
 * @param {string} errorMessage - Error message text.
 * @returns {void}
 */
function showWizardError(errorMessage) {
    // document.getElementById locates the error alert banner inside the wizard modal
    const errorBannerElement = document.getElementById('cw-error');
    if (errorBannerElement) {
        errorBannerElement.innerText = errorMessage;
        errorBannerElement.style.display = 'block';
        // scrollIntoView smoothly scrolls the modal so the user immediately sees the validation error message
        errorBannerElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * Packages the completed `cw_char` data into canonical V5 `sheet_data` keys for all 3 sheet templates,
 * creates the character via `POST /api/characters`, updates `humanity` and `sheet_data` via `PUT /api/characters/:id`,
 * and opens the newly created character sheet.
 *
 * @returns {Promise<void>}
 */
async function submitWizardCharacter() {
    if (!cw_char.name) {
        cw_step = 1;
        renderWizardStep();
        return showWizardError("Your character must have a name.");
    }

    const bloodPotencyRating = getWizardBloodPotency();
    const bloodPotencyStats = getWizardBloodPotencyStats(bloodPotencyRating);
    const startingHumanity = getWizardStartingHumanity();
    const clanMetadata = V5_DATA.clans[cw_char.clan] || {};
    const totalExperiencePoints = cw_char.age_tier === 'Ancilla' ? 35 : (cw_char.age_tier === 'Neonate' ? 15 : 0);

    // Clone skills so Predator Type 0-dot skill specialty rule can add +1 skill dot if applicable
    const finalSkills = { ...cw_char.skills };
    const finalSpecialties = {};

    // 1. Free Specialty
    if (cw_char.free_specialty_skill && cw_char.free_specialty_text.trim()) {
        finalSpecialties[cw_char.free_specialty_skill] = cw_char.free_specialty_text.trim();
    }

    // 2. Automatic Specialties (Academics, Craft, Performance, Science)
    for (const autoSpecialtySkillKey of CW_AUTO_SPECIALTY_SKILLS) {
        if (finalSkills[autoSpecialtySkillKey] > 0 && (cw_char.auto_specialties[autoSpecialtySkillKey] || '').trim()) {
            const specialtyText = cw_char.auto_specialties[autoSpecialtySkillKey].trim();
            finalSpecialties[autoSpecialtySkillKey] = finalSpecialties[autoSpecialtySkillKey] ? `${finalSpecialties[autoSpecialtySkillKey]}, ${specialtyText}` : specialtyText;
        }
    }

    // 3. Predator Type Specialty (or +1 Skill dot if character had 0 dots in that skill per V5 rules)
    if (cw_char.predator_type && cw_char.predator_type !== 'None' && cw_char.predator_specialty_skill) {
        const predatorSkillKey = cw_char.predator_specialty_skill;
        const predatorSpecialtyText = (cw_char.predator_specialty_text || '').trim();
        if ((finalSkills[predatorSkillKey] || 0) === 0) {
            finalSkills[predatorSkillKey] = 1;
        } else if (predatorSpecialtyText) {
            finalSpecialties[predatorSkillKey] = finalSpecialties[predatorSkillKey] ? `${finalSpecialties[predatorSkillKey]}, ${predatorSpecialtyText}` : predatorSpecialtyText;
        }
    }

    // Check if Fortitude Resilience was chosen -> adds Fortitude rating to Health max!
    const disciplineTotals = computeWizardDisciplineTotals();
    const fortitudeDots = disciplineTotals['Fortitude'] || 0;
    const fortitudePowers = cw_char.disc_powers['Fortitude'] || [];
    const hasResiliencePower = fortitudeDots > 0 && fortitudePowers.includes('Resilience');

    const healthMaxCapacity = (cw_char.attributes.stamina || 1) + 3 + (hasResiliencePower ? fortitudeDots : 0);
    const willpowerMaxCapacity = (cw_char.attributes.composure || 1) + (cw_char.attributes.resolve || 1);

    // document.querySelector finds the active chronicle title in the sidebar so we can pre-fill the Chronicle field on the sheet
    const activeChronicleHeaderElement = document.querySelector('#sidebar h2');
    // document.getElementById finds the logged-in user's display name element to pre-fill the Player field on the sheet
    const playerNameElement = document.getElementById('userDropdownUsername');

    const sheetData = {
        name: cw_char.name,
        short_name: cw_char.short_name || cw_char.name.split(' ')[0],
        concept: cw_char.concept,
        clan: cw_char.clan,
        sire: cw_char.sire || '',
        sect: cw_char.sect || 'Camarilla',
        generation: cw_char.generation,
        predator: cw_char.predator_type === 'None' ? '' : cw_char.predator_type,
        predator_type: cw_char.predator_type === 'None' ? '' : cw_char.predator_type,
        chronicle: activeChronicleHeaderElement ? activeChronicleHeaderElement.innerText.trim() : '',
        player: playerNameElement ? playerNameElement.innerText.trim() : '',
        ambition: cw_char.ambition || '',
        desire: cw_char.desire || '',
        blood_potency: bloodPotencyRating,
        blood_surge: bloodPotencyStats.blood_surge,
        mend_amount: bloodPotencyStats.mend_amount,
        power_bonus: bloodPotencyStats.power_bonus,
        rouse_reroll: bloodPotencyStats.rouse_reroll,
        bane_severity: bloodPotencyStats.bane_severity,
        feeding_penalty: bloodPotencyStats.feeding_penalty,
        clan_bane: clanMetadata.bane || '',
        compulsion: clanMetadata.compulsion || '',
        humanity: startingHumanity,
        humanity_states: Array.from({ length: 10 }, (_, boxIndex) => boxIndex < startingHumanity ? 'filled' : 'empty'),
        hunger: ['filled', 'empty', 'empty', 'empty', 'empty'],
        health_max: healthMaxCapacity,
        willpower_max: willpowerMaxCapacity,
        health_states: Array.from({ length: 15 }, (_, boxIndex) => boxIndex < healthMaxCapacity ? 'empty' : 'filled'),
        willpower_states: Array.from({ length: 15 }, (_, boxIndex) => boxIndex < willpowerMaxCapacity ? 'empty' : 'filled'),
        total_experience: String(totalExperiencePoints),
        total: String(totalExperiencePoints),
        spent_experience: '0',
        spent: '0',
        chronicle_tenets: cw_char.chronicle_tenets || '',
        touchstones_convictions: cw_char.touchstones || '',
        touchstones__convictions: cw_char.touchstones || '',
        true_age: cw_char.true_age || '',
        apparent_age: cw_char.apparent_age || '',
        date_of_birth: cw_char.dob || '',
        date_of_death: cw_char.dod || '',
        appearance: cw_char.appearance || '',
        description: cw_char.appearance || '',
        distinguishing_features: cw_char.distinguishing_features || '',
        history: cw_char.history || '',
        sheet_template: cw_char.sheet_template || 'V5-Character-Sheet.html'
    };

    // Attributes
    for (const [attributeKey, attributeRating] of Object.entries(cw_char.attributes)) {
        sheetData[attributeKey] = attributeRating;
    }

    // Skills & Specialties
    for (const [skillKey, skillRating] of Object.entries(finalSkills)) {
        sheetData[skillKey] = skillRating;
    }
    for (const [skillKey, specialtyString] of Object.entries(finalSpecialties)) {
        sheetData[`spec_${skillKey}`] = specialtyString;
        sheetData[`${skillKey}_specialty`] = specialtyString;
    }

    // Disciplines (include Thin-Blood Discipline Affinity / Thin-Blood Alchemist if selected in Step 8)
    const finalDisciplinesMap = { ...disciplineTotals };
    const finalDisciplinePowersMap = { ...cw_char.disc_powers };
    if (cw_char.clan === 'Thin-Blood') {
        cw_char.merits.forEach(meritItem => {
            if (meritItem.name.toLowerCase().includes('thin-blood alchemist')) {
                finalDisciplinesMap['Thin-Blood Alchemy'] = 1;
                finalDisciplinePowersMap['Thin-Blood Alchemy'] = [meritItem.desc || 'Far Reach'];
            } else if (meritItem.name.toLowerCase().includes('discipline affinity')) {
                const chosenAffinityDiscipline = (meritItem.desc && V5_DISCIPLINES[meritItem.desc]) ? meritItem.desc : 'Auspex';
                finalDisciplinesMap[chosenAffinityDiscipline] = 1;
                const firstLevelOnePower = Object.keys(V5_DISCIPLINES[chosenAffinityDiscipline].l1 || {})[0] || '';
                finalDisciplinePowersMap[chosenAffinityDiscipline] = [firstLevelOnePower];
            }
        });
    }

    let disciplineSlotIndex = 0;
    for (const [disciplineName, dotCount] of Object.entries(finalDisciplinesMap)) {
        if (disciplineSlotIndex >= 6 || dotCount <= 0) continue;
        sheetData[`discipline_name_${disciplineSlotIndex}`] = disciplineName;
        sheetData[`discipline_dots_${disciplineSlotIndex}`] = dotCount;
        const selectedPowersList = finalDisciplinePowersMap[disciplineName] || [];
        selectedPowersList.slice(0, dotCount).forEach((powerName, powerSlotIndex) => {
            sheetData[`discipline_power_${disciplineSlotIndex}_${powerSlotIndex}`] = powerName;
        });
        disciplineSlotIndex++;
    }

    // Combine Predator/Clan automatic traits + Player-chosen Merits, Backgrounds, and Flaws
    const allMeritsAndBackgrounds = [];
    const allFlaws = [];

    if (cw_char.clan === 'Nosferatu') {
        const customNote = cw_char.predator_custom_notes['clan_nos'] !== undefined ? cw_char.predator_custom_notes['clan_nos'] : 'Nosferatu Clan Bane';
        allFlaws.push({ name: 'Repulsive', rating: 2, desc: customNote, category: 'flaw' });
    } else if (cw_char.clan === 'Caitiff') {
        const customNote = cw_char.predator_custom_notes['clan_caitiff'] !== undefined ? cw_char.predator_custom_notes['clan_caitiff'] : 'Caitiff Outcast';
        allFlaws.push({ name: 'Suspect', rating: 1, desc: customNote, category: 'flaw' });
    }

    if (cw_char.predator_type && cw_char.predator_type !== 'None' && V5_DATA.predator_types[cw_char.predator_type]) {
        const predatorData = V5_DATA.predator_types[cw_char.predator_type];
        (predatorData.advantages || []).forEach((advantageEntry, advantageIndex) => {
            const customNoteKey = `pred_adv_${advantageIndex}`;
            const customNote = cw_char.predator_custom_notes[customNoteKey] !== undefined ? cw_char.predator_custom_notes[customNoteKey] : (advantageEntry.desc || '');
            allMeritsAndBackgrounds.push({ name: advantageEntry.name, rating: advantageEntry.rating, desc: customNote, category: advantageEntry.type || 'background' });
        });
        (predatorData.flaws || []).forEach((flawEntry, flawIndex) => {
            const customNoteKey = `pred_flaw_${flawIndex}`;
            const customNote = cw_char.predator_custom_notes[customNoteKey] !== undefined ? cw_char.predator_custom_notes[customNoteKey] : (flawEntry.desc || '');
            allFlaws.push({ name: flawEntry.name, rating: flawEntry.rating, desc: customNote, category: 'flaw' });
        });
    }

    cw_char.merits.forEach(meritItem => allMeritsAndBackgrounds.push(meritItem));
    cw_char.flaws.forEach(flawItem => allFlaws.push(flawItem));

    let meritRowNumber = 1;
    let backgroundRowNumber = 1;
    let flawRowNumber = 1;
    let combinedRowNumber = 1;

    allMeritsAndBackgrounds.forEach(advantageItem => {
        const isBackground = advantageItem.category === 'background';
        const formattedAdvantageLabel = advantageItem.name + (advantageItem.desc ? `: ${advantageItem.desc}` : '');
        if (isBackground && backgroundRowNumber <= 7) {
            sheetData[`background_name_${backgroundRowNumber}`] = formattedAdvantageLabel;
            sheetData[`background_rating_${backgroundRowNumber}`] = advantageItem.rating;
            backgroundRowNumber++;
        } else if (!isBackground && meritRowNumber <= 7) {
            sheetData[`merit_name_${meritRowNumber}`] = formattedAdvantageLabel;
            sheetData[`merit_rating_${meritRowNumber}`] = advantageItem.rating;
            meritRowNumber++;
        }
        if (combinedRowNumber <= 11) {
            sheetData[`adv_flaw_name_${combinedRowNumber}`] = formattedAdvantageLabel;
            sheetData[`adv_flaw_rating_${combinedRowNumber}`] = advantageItem.rating;
            sheetData[`adv_flaw_type_${combinedRowNumber}`] = isBackground ? 'background' : 'merit';
            combinedRowNumber++;
        }
    });

    allFlaws.forEach(flawItem => {
        const formattedFlawLabel = flawItem.name + (flawItem.desc ? `: ${flawItem.desc}` : '');
        if (flawRowNumber <= 7) {
            sheetData[`flaw_name_${flawRowNumber}`] = formattedFlawLabel;
            sheetData[`flaw_rating_${flawRowNumber}`] = flawItem.rating;
            flawRowNumber++;
        }
        if (combinedRowNumber <= 11) {
            sheetData[`adv_flaw_name_${combinedRowNumber}`] = formattedFlawLabel;
            sheetData[`adv_flaw_rating_${combinedRowNumber}`] = flawItem.rating;
            sheetData[`adv_flaw_type_${combinedRowNumber}`] = 'flaw';
            combinedRowNumber++;
        }
    });

    // Snapshot all starting creation ratings into base_stats so future XP dot upgrades stay strictly separated
    sheetData.base_stats = {};
    Object.keys(cw_char.attributes).forEach(attributeKey => {
        sheetData.base_stats[attributeKey] = Number(sheetData[attributeKey] || 1);
    });
    Object.keys(finalSkills).forEach(skillKey => {
        sheetData.base_stats[skillKey] = Number(sheetData[skillKey] || 0);
    });
    for (let disciplineSlotIndex = 0; disciplineSlotIndex < 6; disciplineSlotIndex++) {
        const disciplineDotKey = `discipline_dots_${disciplineSlotIndex}`;
        sheetData.base_stats[disciplineDotKey] = Number(sheetData[disciplineDotKey] || 0);
    }
    sheetData.base_stats.blood_potency = Number(sheetData.blood_potency || 0);
    for (let rowIndex = 1; rowIndex <= 12; rowIndex++) {
        ['adv_flaw', 'merit', 'background', 'flaw', 'haven_merit', 'haven_flaw'].forEach(prefixName => {
            const ratingKey = `${prefixName}_rating_${rowIndex}`;
            if (sheetData[ratingKey] !== undefined) {
                sheetData.base_stats[ratingKey] = Number(sheetData[ratingKey] || 0);
            }
        });
    }
    sheetData.xp_upgrades = {};
    sheetData.xp_log = [];
    sheetData.base_stats_snapshotted_at = new Date().toISOString();

    try {
        const targetChronicleId = typeof activeChronicleId !== 'undefined' && activeChronicleId ? activeChronicleId : 1;
        // authFetch sends an authenticated HTTP POST request with a JSON.stringify body to create the new character in the database
        const createCharacterResponse = await authFetch('/api/characters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chronicle_id: targetChronicleId,
                name: cw_char.name,
                short_name: cw_char.short_name || cw_char.name.split(' ')[0],
                clan: cw_char.clan,
                concept: cw_char.concept,
                avatar_url: '/images/caine_portrait.jpg?v=2',
                category: cw_char.category || 'pc',
                sheet_data: sheetData
            })
        });

        // createCharacterResponse.json parses the server's JSON response containing the new character's database ID
        const createdCharacterData = await createCharacterResponse.json();
        if (!createCharacterResponse.ok || createdCharacterData.error) {
            return showWizardError(createdCharacterData.error || 'Failed to create character.');
        }

        // Persist top-level humanity column and complete sheet_data
        // authFetch sends an authenticated HTTP PUT request with JSON.stringify to store the starting Humanity, Hunger, and full sheet_data
        await authFetch(`/api/characters/${createdCharacterData.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: cw_char.name,
                short_name: cw_char.short_name || cw_char.name.split(' ')[0],
                clan: cw_char.clan,
                concept: cw_char.concept,
                humanity: startingHumanity,
                hunger: 1,
                sheet_data: sheetData
            })
        });

        closeCharacterCreator();
        // loadCharacters refreshes the sidebar character roster in the main VTT UI
        if (typeof loadCharacters === 'function') loadCharacters();
        // openCharacterSheet immediately opens the newly created character's interactive V5 sheet modal
        if (typeof openCharacterSheet === 'function' && typeof currentUser !== 'undefined' && currentUser) {
            openCharacterSheet(createdCharacterData.id, cw_char.name, cw_char.clan, currentUser.id, currentUser.displayName);
        }
    } catch (submissionError) {
        console.error(submissionError);
        showWizardError('Error saving character to server.');
    }
}
