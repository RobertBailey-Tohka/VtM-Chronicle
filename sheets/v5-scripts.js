const KNOWN_V5_BACKGROUNDS = [
    'allies', 'contacts', 'fame', 'haven', 'herd', 'influence', 'mask', 'mawla',
    'resources', 'retainers', 'status', 'zeroed', 'cobbler', 'safe house', 'armory',
    'watchmen', 'laboratory', 'library', 'luxury', 'postern', 'security system',
    'surgery', 'warding', 'cell', 'chasse', 'lien', 'portillon'
];

const KNOWN_V5_FLAWS = [
    'flaw', 'prey exclusion', 'adversary', 'enemy', 'enemies', 'dark secret', 'shunned',
    'suspect', 'stalkers', 'infamy', 'known blankbody', 'known corpse', 'stigma',
    'repulsive', 'ugly', 'illiterate', 'archaic', 'living in the past', 'crone',
    'folkloric bane', 'folkloric block', 'stigmata', 'stake bait', 'starving decay',
    'twice cursed', 'organovore', 'methuselah\'s thirst', 'farmer', 'vegan',
    'addiction', 'hopeless addiction', 'badger\'s hide', 'beacon of the unholy',
    'compromised haven', 'creepy', 'haunted', 'no haven', 'obvious predator',
    'disliked', 'despised', 'destitute', 'debt', 'ward'
];

const BLOOD_POTENCY_TABLE = {
    0: { surge: '1 die',  mend: '1 superficial', power: 'None',  reroll: 'None',          bane: '0', penalty: 'None' },
    1: { surge: '2 dice', mend: '1 superficial', power: 'None',  reroll: 'Level 1',       bane: '2', penalty: 'None' },
    2: { surge: '2 dice', mend: '2 superficial', power: '1 die', reroll: 'Level 1',       bane: '2', penalty: 'Animal/bagged blood slakes half' },
    3: { surge: '3 dice', mend: '2 superficial', power: '1 die', reroll: 'Level 2 & below', bane: '3', penalty: 'Animal/bagged blood slakes none' },
    4: { surge: '3 dice', mend: '3 superficial', power: '2 dice', reroll: 'Level 2 & below', bane: '3', penalty: 'Slake 1 less from humans' },
    5: { surge: '4 dice', mend: '3 superficial', power: '2 dice', reroll: 'Level 3 & below', bane: '4', penalty: 'Slake 1 less; must drain & kill for < 2 Hunger' },
    6: { surge: '4 dice', mend: '3 superficial', power: '3 dice', reroll: 'Level 3 & below', bane: '4', penalty: 'Slake 2 less; must drain & kill for < 2 Hunger' },
    7: { surge: '5 dice', mend: '3 superficial', power: '3 dice', reroll: 'Level 4 & below', bane: '5', penalty: 'Slake 2 less; must drain & kill for < 2 Hunger' },
    8: { surge: '5 dice', mend: '4 superficial', power: '4 dice', reroll: 'Level 4 & below', bane: '5', penalty: 'Slake 2 less; must drain & kill for < 3 Hunger' },
    9: { surge: '6 dice', mend: '4 superficial', power: '4 dice', reroll: 'Level 5 & below', bane: '6', penalty: 'Slake 2 less; must drain & kill for < 3 Hunger' },
    10:{ surge: '6 dice', mend: '5 superficial', power: '5 dice', reroll: 'Level 5 & below', bane: '6', penalty: 'Slake 3 less; must drain & kill for < 3 Hunger' }
};

/**
 * Infers whether an Advantage/Flaw entry is a Merit, Background, or Flaw based on its name
 * or explicit tag (`merit`, `background`, `flaw`).
 *
 * @param {string} advantageName - The advantage/flaw name text.
 * @param {string} [explicitCategoryType] - Optional explicit type ('merit', 'background', 'flaw').
 * @returns {'merit'|'background'|'flaw'}
 */
function detectAdvantageCategory(advantageName, explicitCategoryType) {
    if (explicitCategoryType === 'merit' || explicitCategoryType === 'background' || explicitCategoryType === 'flaw') {
        return explicitCategoryType;
    }
    const lowerCaseAdvantageName = String(advantageName || '').trim().toLowerCase();
    if (!lowerCaseAdvantageName) return 'merit';
    if (lowerCaseAdvantageName.includes('(flaw)') || lowerCaseAdvantageName.startsWith('flaw:') || lowerCaseAdvantageName.endsWith('- flaw')) return 'flaw';
    if (lowerCaseAdvantageName.includes('(background)') || lowerCaseAdvantageName.startsWith('background:')) return 'background';
    if (lowerCaseAdvantageName.includes('(merit)') || lowerCaseAdvantageName.startsWith('merit:')) return 'merit';
    for (const knownFlawName of KNOWN_V5_FLAWS) {
        if (
            lowerCaseAdvantageName === knownFlawName ||
            lowerCaseAdvantageName.startsWith(knownFlawName + ' ') ||
            lowerCaseAdvantageName.startsWith(knownFlawName + ':') ||
            lowerCaseAdvantageName.startsWith(knownFlawName + ' (')
        ) {
            return 'flaw';
        }
    }
    for (const knownBackgroundName of KNOWN_V5_BACKGROUNDS) {
        if (
            lowerCaseAdvantageName === knownBackgroundName ||
            lowerCaseAdvantageName.startsWith(knownBackgroundName + ' ') ||
            lowerCaseAdvantageName.startsWith(knownBackgroundName + ':') ||
            lowerCaseAdvantageName.startsWith(knownBackgroundName + ' (')
        ) {
            return 'background';
        }
    }
    return 'merit';
}

/**
 * Normalizes a capacity tracker array (Health or Willpower) so that it cleanly fits
 * `targetMaxBoxes` (e.g., 10 boxes on Standard/4-Page, 15 boxes on ALT).
 *
 * Also repairs previously corrupted 15-box arrays where trailing `'empty'` boxes
 * appeared after `'filled'` (solid black capacity-cap) boxes when switching from a 10-box sheet.
 *
 * @param {Array<string>|number|undefined} rawTrackerValue - Existing tracker array or numeric capacity.
 * @param {number|undefined} explicitMaxCapacity - Optional explicit `health_max` or `willpower_max` capacity.
 * @param {number} targetMaxBoxes - Number of boxes in the current sheet's DOM tracker (10 or 15).
 * @param {number} fallbackCapacity - Default usable capacity if uninitialized.
 * @returns {{ states: Array<string>, capacity: number }}
 */
function normalizeCapacityTracker(rawTrackerValue, explicitMaxCapacity, targetMaxBoxes, fallbackCapacity = 5) {
    let damageStates = [];
    let usableCapacity = typeof explicitMaxCapacity === 'number' && explicitMaxCapacity > 0 ? explicitMaxCapacity : null;

    if (typeof rawTrackerValue === 'number' && rawTrackerValue > 0) {
        usableCapacity = rawTrackerValue;
    } else if (Array.isArray(rawTrackerValue) && rawTrackerValue.length > 0) {
        const firstFilledBoxIndex = rawTrackerValue.indexOf('filled');
        const hasEmptyAfterFilled = firstFilledBoxIndex !== -1 && rawTrackerValue.slice(firstFilledBoxIndex).some(boxState => boxState !== 'filled');

        if (hasEmptyAfterFilled && rawTrackerValue.length === 15 && firstFilledBoxIndex <= 10) {
            // Repair legacy 10-to-15 bug where indices 10..14 were left as 'empty' after 'filled' boxes
            const originalTenBoxes = rawTrackerValue.slice(0, 10);
            const nonFilledBoxes = originalTenBoxes.filter(boxState => boxState !== 'filled');
            if (usableCapacity === null) usableCapacity = nonFilledBoxes.length;
            damageStates = nonFilledBoxes.filter(boxState => boxState === 'aggravated' || boxState === 'superficial' || boxState === 'empty');
        } else {
            const nonFilledBoxes = rawTrackerValue.filter(boxState => boxState !== 'filled');
            if (usableCapacity === null) usableCapacity = nonFilledBoxes.length;
            damageStates = nonFilledBoxes.filter(boxState => boxState === 'aggravated' || boxState === 'superficial' || boxState === 'empty');
        }
    }

    if (usableCapacity === null || usableCapacity <= 0) {
        usableCapacity = fallbackCapacity;
    }
    usableCapacity = Math.min(Math.max(usableCapacity, 1), targetMaxBoxes);

    const normalizedBoxStates = [];
    for (let boxIndex = 0; boxIndex < targetMaxBoxes; boxIndex++) {
        if (boxIndex < usableCapacity) {
            const currentBoxDamageState = damageStates[boxIndex];
            normalizedBoxStates.push(
                currentBoxDamageState === 'aggravated' || currentBoxDamageState === 'superficial'
                    ? currentBoxDamageState
                    : 'empty'
            );
        } else {
            normalizedBoxStates.push('filled');
        }
    }
    return { states: normalizedBoxStates, capacity: usableCapacity };
}

/**
 * Bidirectionally synchronizes the Standard 2-Page combined `adv_flaw_*` fields
 * and the ALT / 4-Page separated `merit_*`, `background_*`, and `flaw_*` fields.
 *
 * @param {Object} sheetData - The sheet_data object to synchronize in place.
 * @param {'from_combined'|'from_split'|'auto'} syncMode - Direction of sync.
 */
function syncAdvantagesAndSplitSections(sheetData, syncMode = 'auto') {
    const hasBaseStatsObj = sheetData.base_stats && typeof sheetData.base_stats === 'object';
    const hasXpUpgradesObj = sheetData.xp_upgrades && typeof sheetData.xp_upgrades === 'object';

    const combinedEntries = [];
    for (let rowNumber = 1; rowNumber <= 9; rowNumber++) {
        const ratingKey = 'adv_flaw_rating_' + rowNumber;
        const entryName = String(sheetData['adv_flaw_name_' + rowNumber] || '').trim();
        const entryRating = Number(sheetData[ratingKey] || 0);
        const xpDots = hasXpUpgradesObj ? Number(sheetData.xp_upgrades[ratingKey] || 0) : 0;
        const baseDots = hasBaseStatsObj && sheetData.base_stats[ratingKey] !== undefined
            ? Number(sheetData.base_stats[ratingKey] || 0)
            : Math.max(0, entryRating - xpDots);
        const rawCategoryType = sheetData['adv_flaw_type_' + rowNumber];
        if (entryName) {
            const detectedCategoryType = detectAdvantageCategory(entryName, rawCategoryType);
            sheetData['adv_flaw_type_' + rowNumber] = detectedCategoryType;
            combinedEntries.push({
                name: entryName,
                rating: entryRating,
                baseDots: baseDots,
                xpDots: xpDots,
                type: detectedCategoryType
            });
        } else {
            sheetData['adv_flaw_name_' + rowNumber] = '';
            sheetData[ratingKey] = 0;
            if (hasBaseStatsObj) sheetData.base_stats[ratingKey] = 0;
            if (hasXpUpgradesObj) sheetData.xp_upgrades[ratingKey] = 0;
        }
    }

    const splitMerits = [];
    const splitBackgrounds = [];
    const splitFlaws = [];
    for (let rowNumber = 1; rowNumber <= 12; rowNumber++) {
        const meritRatingKey = 'merit_rating_' + rowNumber;
        const meritName = String(sheetData['merit_name_' + rowNumber] || '').trim();
        const meritRating = Number(sheetData[meritRatingKey] || 0);
        const meritXpDots = hasXpUpgradesObj ? Number(sheetData.xp_upgrades[meritRatingKey] || 0) : 0;
        const meritBaseDots = hasBaseStatsObj && sheetData.base_stats[meritRatingKey] !== undefined
            ? Number(sheetData.base_stats[meritRatingKey] || 0)
            : Math.max(0, meritRating - meritXpDots);
        if (meritName) {
            splitMerits.push({ name: meritName, rating: meritRating, baseDots: meritBaseDots, xpDots: meritXpDots, type: 'merit' });
        } else {
            sheetData['merit_name_' + rowNumber] = '';
            sheetData[meritRatingKey] = 0;
            if (hasBaseStatsObj) sheetData.base_stats[meritRatingKey] = 0;
            if (hasXpUpgradesObj) sheetData.xp_upgrades[meritRatingKey] = 0;
        }

        if (rowNumber <= 10) {
            const bgRatingKey = 'background_rating_' + rowNumber;
            const backgroundName = String(sheetData['background_name_' + rowNumber] || '').trim();
            const backgroundRating = Number(sheetData[bgRatingKey] || 0);
            const bgXpDots = hasXpUpgradesObj ? Number(sheetData.xp_upgrades[bgRatingKey] || 0) : 0;
            const bgBaseDots = hasBaseStatsObj && sheetData.base_stats[bgRatingKey] !== undefined
                ? Number(sheetData.base_stats[bgRatingKey] || 0)
                : Math.max(0, backgroundRating - bgXpDots);
            if (backgroundName) {
                splitBackgrounds.push({ name: backgroundName, rating: backgroundRating, baseDots: bgBaseDots, xpDots: bgXpDots, type: 'background' });
            } else {
                sheetData['background_name_' + rowNumber] = '';
                sheetData[bgRatingKey] = 0;
                if (hasBaseStatsObj) sheetData.base_stats[bgRatingKey] = 0;
                if (hasXpUpgradesObj) sheetData.xp_upgrades[bgRatingKey] = 0;
            }
        }

        const flawRatingKey = 'flaw_rating_' + rowNumber;
        const flawName = String(sheetData['flaw_name_' + rowNumber] || '').trim();
        const flawRating = Number(sheetData[flawRatingKey] || 0);
        const flawXpDots = hasXpUpgradesObj ? Number(sheetData.xp_upgrades[flawRatingKey] || 0) : 0;
        const flawBaseDots = hasBaseStatsObj && sheetData.base_stats[flawRatingKey] !== undefined
            ? Number(sheetData.base_stats[flawRatingKey] || 0)
            : Math.max(0, flawRating - flawXpDots);
        if (flawName) {
            splitFlaws.push({ name: flawName, rating: flawRating, baseDots: flawBaseDots, xpDots: flawXpDots, type: 'flaw' });
        } else {
            sheetData['flaw_name_' + rowNumber] = '';
            sheetData[flawRatingKey] = 0;
            if (hasBaseStatsObj) sheetData.base_stats[flawRatingKey] = 0;
            if (hasXpUpgradesObj) sheetData.xp_upgrades[flawRatingKey] = 0;
        }
    }
    const splitTotalCount = splitMerits.length + splitBackgrounds.length + splitFlaws.length;

    let effectiveSyncMode = syncMode;
    if (effectiveSyncMode === 'auto') {
        // document.getElementById searches the DOM for an element with the given ID (here checking if the split Merit input exists)
        const isSplitDom = typeof document !== 'undefined' && !!document.getElementById('merit_name_1');
        // document.getElementById checks if the Standard 2-Page combined Advantage/Flaw input exists in the current DOM
        const isCombinedDom = typeof document !== 'undefined' && !!document.getElementById('adv_flaw_name_1');

        if (combinedEntries.length > 0 && splitTotalCount === 0) {
            effectiveSyncMode = 'from_combined';
        } else if (splitTotalCount > 0 && combinedEntries.length === 0) {
            effectiveSyncMode = 'from_split';
        } else if (combinedEntries.length > 0 && splitTotalCount > 0) {
            // Trust the currently active template's section as authoritative so deleted rows never resurrect
            if (isSplitDom) {
                effectiveSyncMode = 'from_split';
            } else if (isCombinedDom) {
                effectiveSyncMode = 'from_combined';
            }
        }
    }

    if (effectiveSyncMode === 'from_combined') {
        const meritEntries = combinedEntries.filter(advantageEntry => advantageEntry.type === 'merit');
        const backgroundEntries = combinedEntries.filter(advantageEntry => advantageEntry.type === 'background');
        const flawEntries = combinedEntries.filter(advantageEntry => advantageEntry.type === 'flaw');

        for (let rowNumber = 1; rowNumber <= 12; rowNumber++) {
            const meritItem = meritEntries[rowNumber - 1];
            sheetData['merit_name_' + rowNumber] = meritItem ? meritItem.name : '';
            sheetData['merit_rating_' + rowNumber] = meritItem ? meritItem.rating : 0;
            if (hasBaseStatsObj) sheetData.base_stats['merit_rating_' + rowNumber] = meritItem ? meritItem.baseDots : 0;
            if (hasXpUpgradesObj) sheetData.xp_upgrades['merit_rating_' + rowNumber] = meritItem ? meritItem.xpDots : 0;

            if (rowNumber <= 10) {
                const bgItem = backgroundEntries[rowNumber - 1];
                sheetData['background_name_' + rowNumber] = bgItem ? bgItem.name : '';
                sheetData['background_rating_' + rowNumber] = bgItem ? bgItem.rating : 0;
                if (hasBaseStatsObj) sheetData.base_stats['background_rating_' + rowNumber] = bgItem ? bgItem.baseDots : 0;
                if (hasXpUpgradesObj) sheetData.xp_upgrades['background_rating_' + rowNumber] = bgItem ? bgItem.xpDots : 0;
            }

            const flawItem = flawEntries[rowNumber - 1];
            sheetData['flaw_name_' + rowNumber] = flawItem ? flawItem.name : '';
            sheetData['flaw_rating_' + rowNumber] = flawItem ? flawItem.rating : 0;
            if (hasBaseStatsObj) sheetData.base_stats['flaw_rating_' + rowNumber] = flawItem ? flawItem.baseDots : 0;
            if (hasXpUpgradesObj) sheetData.xp_upgrades['flaw_rating_' + rowNumber] = flawItem ? flawItem.xpDots : 0;
        }
    } else if (effectiveSyncMode === 'from_split') {
        const mergedEntries = [...splitMerits, ...splitBackgrounds, ...splitFlaws];
        for (let rowNumber = 1; rowNumber <= 18; rowNumber++) {
            if (rowNumber <= 9) {
                const mergedItem = mergedEntries[rowNumber - 1];
                sheetData['adv_flaw_name_' + rowNumber] = mergedItem ? mergedItem.name : '';
                sheetData['adv_flaw_rating_' + rowNumber] = mergedItem ? mergedItem.rating : 0;
                sheetData['adv_flaw_type_' + rowNumber] = mergedItem ? mergedItem.type : 'merit';
                if (hasBaseStatsObj) sheetData.base_stats['adv_flaw_rating_' + rowNumber] = mergedItem ? mergedItem.baseDots : 0;
                if (hasXpUpgradesObj) sheetData.xp_upgrades['adv_flaw_rating_' + rowNumber] = mergedItem ? mergedItem.xpDots : 0;
            } else {
                delete sheetData['adv_flaw_name_' + rowNumber];
                delete sheetData['adv_flaw_rating_' + rowNumber];
            }
        }
    }
}

/**
 * Normalizes and migrates all legacy or template-specific keys in `sheetData` into canonical keys
 * so that all 3 character sheet templates (Standard 2-Page, Alternative 2-Page, Expanded 4-Page)
 * read and write the exact same data structure.
 *
 * @param {Object} sheetData - The character's sheet_data object.
 * @param {Object} [characterRecord] - Optional character DB record for top-level fallbacks.
 * @returns {Object} The normalized sheet object.
 */
function normalizeSheetData(sheetData, characterRecord = {}) {
    if (!sheetData || typeof sheetData !== 'object') sheetData = {};

    // 1. Core profile & biographical fields
    if (!sheetData.name && characterRecord.name) sheetData.name = characterRecord.name;
    if (!sheetData.clan && characterRecord.clan) sheetData.clan = characterRecord.clan;
    if (!sheetData.concept && characterRecord.concept) sheetData.concept = characterRecord.concept;

    sheetData.predator = sheetData.predator || sheetData.predator_type || '';
    sheetData.predator_type = sheetData.predator;

    sheetData.total_experience = sheetData.total_experience || sheetData.total || '';
    sheetData.spent_experience = sheetData.spent_experience || sheetData.spent || '';
    sheetData.total = sheetData.total_experience;
    sheetData.spent = sheetData.spent_experience;

    sheetData.hunting_roll = sheetData.hunting_roll || sheetData.hunting || '';
    sheetData.hunting = sheetData.hunting_roll;

    sheetData.touchstones_convictions = sheetData.touchstones_convictions || sheetData.touchstones__convictions || '';
    sheetData.touchstones__convictions = sheetData.touchstones_convictions;

    // Appearance & Distinguishing Features (migrate from ALT's old description / description_1)
    if (!sheetData.appearance && sheetData.description) sheetData.appearance = sheetData.description;
    if (!sheetData.distinguishing_features && sheetData.description_1) sheetData.distinguishing_features = sheetData.description_1;

    // History & Notes (migrate from 4pg's old character_history / true_age_1)
    if (!sheetData.history && sheetData.character_history) sheetData.history = sheetData.character_history;
    if (!sheetData.notes && sheetData.true_age_1) sheetData.notes = sheetData.true_age_1;

    // 2. Flatten nested attributes & skills if present from NPC seed scripts or wizard
    if (sheetData.attributes && typeof sheetData.attributes === 'object') {
        for (const [attributeName, attributeValue] of Object.entries(sheetData.attributes)) {
            const normalizedAttributeKey = attributeName.toLowerCase();
            if (sheetData[normalizedAttributeKey] === undefined && typeof attributeValue === 'number') {
                sheetData[normalizedAttributeKey] = attributeValue;
            }
        }
    }
    if (sheetData.skills && typeof sheetData.skills === 'object') {
        for (const [skillName, skillValue] of Object.entries(sheetData.skills)) {
            const normalizedSkillKey = skillName.toLowerCase().replace(/\s+/g, '_');
            // Avoid overwriting if already set, and ignore corrupted discipline powers stored in skills
            if (sheetData[normalizedSkillKey] === undefined && typeof skillValue === 'number') {
                sheetData[normalizedSkillKey] = skillValue;
            }
        }
    }

    // 3. Migrate legacy ALT discipline keys (field_39..69, group_39..44, 1..5, 1_1..5_5)
    const altDisciplineNameFields = ['field_39', 'field_45', 'field_51', 'field_57', 'field_63', 'field_69'];
    const altDisciplineDotGroups = ['group_39', 'group_40', 'group_41', 'group_42', 'group_43', 'group_44'];
    altDisciplineNameFields.forEach((legacyFieldKey, disciplineSlotIndex) => {
        if (!sheetData['discipline_name_' + disciplineSlotIndex] && sheetData[legacyFieldKey]) {
            sheetData['discipline_name_' + disciplineSlotIndex] = sheetData[legacyFieldKey];
        }
    });
    altDisciplineDotGroups.forEach((legacyGroupKey, disciplineSlotIndex) => {
        if (sheetData['discipline_dots_' + disciplineSlotIndex] === undefined && typeof sheetData[legacyGroupKey] === 'number') {
            sheetData['discipline_dots_' + disciplineSlotIndex] = sheetData[legacyGroupKey];
        }
    });
    for (let disciplineIndex = 0; disciplineIndex < 6; disciplineIndex++) {
        for (let powerIndex = 0; powerIndex < 5; powerIndex++) {
            const canonicalPowerKey = `discipline_power_${disciplineIndex}_${powerIndex}`;
            const legacyAltPowerKey = disciplineIndex === 0 ? `${powerIndex + 1}` : `${powerIndex + 1}_${disciplineIndex}`;
            if (!sheetData[canonicalPowerKey] && sheetData[legacyAltPowerKey] && typeof sheetData[legacyAltPowerKey] === 'string') {
                sheetData[canonicalPowerKey] = sheetData[legacyAltPowerKey];
            }
        }
    }

    // Also seed from disciplines_full or nested disciplines object if canonical slots are empty
    if (Array.isArray(sheetData.disciplines_full)) {
        sheetData.disciplines_full.forEach((disciplineObject, disciplineIndex) => {
            if (disciplineIndex > 5 || !disciplineObject) return;
            if (!sheetData['discipline_name_' + disciplineIndex] && disciplineObject.name) {
                sheetData['discipline_name_' + disciplineIndex] = disciplineObject.name;
            }
            if (!sheetData['discipline_dots_' + disciplineIndex] && typeof disciplineObject.level === 'number') {
                sheetData['discipline_dots_' + disciplineIndex] = disciplineObject.level;
            }
            if (Array.isArray(disciplineObject.powers)) {
                disciplineObject.powers.forEach((powerName, powerIndex) => {
                    if (powerIndex < 5 && !sheetData[`discipline_power_${disciplineIndex}_${powerIndex}`] && powerName) {
                        sheetData[`discipline_power_${disciplineIndex}_${powerIndex}`] = powerName;
                    }
                });
            }
        });
    } else if (sheetData.disciplines && typeof sheetData.disciplines === 'object' && !Array.isArray(sheetData.disciplines)) {
        const hasAnyCanonicalDiscipline = [0, 1, 2, 3, 4, 5].some(disciplineIndex => sheetData['discipline_name_' + disciplineIndex]);
        if (!hasAnyCanonicalDiscipline) {
            Object.entries(sheetData.disciplines).slice(0, 6).forEach(([disciplineName, disciplineValue], disciplineIndex) => {
                sheetData['discipline_name_' + disciplineIndex] = disciplineName;
                if (typeof disciplineValue === 'number') {
                    sheetData['discipline_dots_' + disciplineIndex] = disciplineValue;
                } else if (disciplineValue && typeof disciplineValue === 'object') {
                    if (typeof disciplineValue.level === 'number') sheetData['discipline_dots_' + disciplineIndex] = disciplineValue.level;
                    if (Array.isArray(disciplineValue.powers)) {
                        disciplineValue.powers.slice(0, 5).forEach((powerName, powerIndex) => {
                            sheetData[`discipline_power_${disciplineIndex}_${powerIndex}`] = powerName;
                        });
                    }
                }
            });
        }
    }

    // 4. Migrate legacy Weapons keys from ALT (dmg, dmg_1..dmg_7) & 4pg (weapons, weapons_1..weapons_13)
    for (let weaponRowNumber = 1; weaponRowNumber <= 7; weaponRowNumber++) {
        const canonicalWeaponNameKey = 'weapon_name_' + weaponRowNumber;
        const canonicalWeaponDamageKey = 'weapon_dmg_' + weaponRowNumber;
        if (weaponRowNumber <= 4) {
            const altWeaponNameKey = weaponRowNumber === 1 ? 'dmg' : `dmg_${(weaponRowNumber - 1) * 2}`;
            const altWeaponDamageKey = `dmg_${(weaponRowNumber - 1) * 2 + 1}`;
            if (!sheetData[canonicalWeaponNameKey] && sheetData[altWeaponNameKey]) sheetData[canonicalWeaponNameKey] = sheetData[altWeaponNameKey];
            if (!sheetData[canonicalWeaponDamageKey] && sheetData[altWeaponDamageKey]) sheetData[canonicalWeaponDamageKey] = sheetData[altWeaponDamageKey];
        }
        const fourPageWeaponNameKey = (weaponRowNumber - 1) * 2 === 0 ? 'weapons' : `weapons_${(weaponRowNumber - 1) * 2}`;
        const fourPageWeaponDamageKey = `weapons_${(weaponRowNumber - 1) * 2 + 1}`;
        if (!sheetData[canonicalWeaponNameKey] && sheetData[fourPageWeaponNameKey]) sheetData[canonicalWeaponNameKey] = sheetData[fourPageWeaponNameKey];
        if (!sheetData[canonicalWeaponDamageKey] && sheetData[fourPageWeaponDamageKey]) sheetData[canonicalWeaponDamageKey] = sheetData[fourPageWeaponDamageKey];
    }

    // 5. Migrate legacy 4pg Rituals (name_1..14), Vehicles (vehicles..vehicles_6), and Haven fields
    for (let rowIndex = 1; rowIndex <= 7; rowIndex++) {
        const legacyRitualNameKey = `name_${(rowIndex - 1) * 2 + 1}`;
        const legacyRitualLevelKey = `name_${(rowIndex - 1) * 2 + 2}`;
        if (!sheetData['ritual_name_' + rowIndex] && sheetData[legacyRitualNameKey]) sheetData['ritual_name_' + rowIndex] = sheetData[legacyRitualNameKey];
        if (!sheetData['ritual_level_' + rowIndex] && sheetData[legacyRitualLevelKey]) sheetData['ritual_level_' + rowIndex] = sheetData[legacyRitualLevelKey];

        const legacyVehicleKey = rowIndex === 1 ? 'vehicles' : `vehicles_${rowIndex - 1}`;
        if (!sheetData['vehicle_' + rowIndex] && sheetData[legacyVehicleKey]) sheetData['vehicle_' + rowIndex] = sheetData[legacyVehicleKey];

        const legacyHavenMeritNameKey = `field_${167 + rowIndex}`;
        const legacyHavenMeritRatingKey = `group_${81 + rowIndex}`;
        if (!sheetData['haven_merit_name_' + rowIndex] && sheetData[legacyHavenMeritNameKey]) sheetData['haven_merit_name_' + rowIndex] = sheetData[legacyHavenMeritNameKey];
        if (sheetData['haven_merit_rating_' + rowIndex] === undefined && typeof sheetData[legacyHavenMeritRatingKey] === 'number') {
            sheetData['haven_merit_rating_' + rowIndex] = sheetData[legacyHavenMeritRatingKey];
        }

        const legacyHavenFlawNameKey = `field_${174 + rowIndex}`;
        const legacyHavenFlawRatingKey = `group_${88 + rowIndex}`;
        if (!sheetData['haven_flaw_name_' + rowIndex] && sheetData[legacyHavenFlawNameKey]) sheetData['haven_flaw_name_' + rowIndex] = sheetData[legacyHavenFlawNameKey];
        if (sheetData['haven_flaw_rating_' + rowIndex] === undefined && typeof sheetData[legacyHavenFlawRatingKey] === 'number') {
            sheetData['haven_flaw_rating_' + rowIndex] = sheetData[legacyHavenFlawRatingKey];
        }
    }
    if (!sheetData.haven_location && sheetData.location) sheetData.haven_location = sheetData.location;
    if (!sheetData.haven_location_notes && sheetData.location_1) sheetData.haven_location_notes = sheetData.location_1;

    // 6. Synchronize Advantages & Flaws <-> Merits / Backgrounds / Flaws
    syncAdvantagesAndSplitSections(sheetData, 'auto');

    // 7. Normalize Health & Willpower capacity trackers for the current DOM's data-max
    // document.getElementById looks up the Health tracker container element by ID so we can read its maximum box count
    const healthGroupElement = document.getElementById('health_states') || document.getElementById('health');
    // getAttribute reads the 'data-max' HTML attribute from the Health tracker element
    const healthMaxBoxes = healthGroupElement ? (parseInt(healthGroupElement.getAttribute('data-max')) || 10) : 10;
    const rawHealthStates = sheetData.health_states || sheetData.health;
    const staminaRating = typeof sheetData.stamina === 'number' && sheetData.stamina > 0 ? sheetData.stamina : 2;
    const normalizedHealth = normalizeCapacityTracker(rawHealthStates, sheetData.health_max, healthMaxBoxes, staminaRating + 3);
    sheetData.health_states = normalizedHealth.states;
    sheetData.health_max = normalizedHealth.capacity;

    // document.getElementById looks up the Willpower tracker container element by ID
    const willpowerGroupElement = document.getElementById('willpower_states') || document.getElementById('willpower');
    // getAttribute reads the 'data-max' HTML attribute from the Willpower tracker element
    const willpowerMaxBoxes = willpowerGroupElement ? (parseInt(willpowerGroupElement.getAttribute('data-max')) || 10) : 10;
    const rawWillpowerStates = sheetData.willpower_states || sheetData.willpower;
    const composureRating = typeof sheetData.composure === 'number' && sheetData.composure > 0 ? sheetData.composure : 2;
    const resolveRating = typeof sheetData.resolve === 'number' && sheetData.resolve > 0 ? sheetData.resolve : 2;
    const normalizedWillpower = normalizeCapacityTracker(rawWillpowerStates, sheetData.willpower_max, willpowerMaxBoxes, composureRating + resolveRating);
    sheetData.willpower_states = normalizedWillpower.states;
    sheetData.willpower_max = normalizedWillpower.capacity;

    // 8. Normalize Humanity & Hunger rating trackers
    if (!Array.isArray(sheetData.humanity_states)) {
        const humanityRating = typeof sheetData.humanity === 'number' ? sheetData.humanity : (typeof characterRecord.humanity === 'number' ? characterRecord.humanity : 7);
        sheetData.humanity_states = Array.from({ length: 10 }, (_, boxIndex) => boxIndex < humanityRating ? 'filled' : 'empty');
    }
    if (!Array.isArray(sheetData.hunger)) {
        const hungerRating = typeof sheetData.hunger === 'number' ? sheetData.hunger : (typeof characterRecord.hunger === 'number' ? characterRecord.hunger : 1);
        sheetData.hunger = Array.from({ length: 5 }, (_, boxIndex) => boxIndex < hungerRating ? 'filled' : 'empty');
    }

    // 9. Ensure permanent Base Stats snapshot and XP upgrade structures exist on every character
    ensureBaseStatsSnapshot(sheetData, false);

    return sheetData;
}

// --- V5 BASE STATS SNAPSHOT, COMPLIANCE CHECKER & XP COST ENGINE ---

const V5_ATTRIBUTE_KEYS = [
    'strength', 'dexterity', 'stamina',
    'charisma', 'manipulation', 'composure',
    'intelligence', 'wits', 'resolve'
];

const V5_SKILL_KEYS = [
    'athletics', 'brawl', 'craft', 'drive', 'firearms', 'larceny', 'melee', 'stealth', 'survival',
    'animal_ken', 'etiquette', 'insight', 'intimidation', 'leadership', 'performance', 'persuasion', 'streetwise', 'subterfuge',
    'academics', 'awareness', 'finance', 'investigation', 'medicine', 'occult', 'politics', 'science', 'technology'
];

const V5_DISCIPLINE_DOT_KEYS = [
    'discipline_dots_0', 'discipline_dots_1', 'discipline_dots_2',
    'discipline_dots_3', 'discipline_dots_4', 'discipline_dots_5'
];

const V5_CLAN_DISCIPLINES_MAP = {
    'brujah': ['celerity', 'potence', 'presence'],
    'gangrel': ['animalism', 'fortitude', 'protean'],
    'malkavian': ['auspex', 'dominate', 'obfuscate'],
    'nosferatu': ['animalism', 'obfuscate', 'potence'],
    'toreador': ['auspex', 'celerity', 'presence'],
    'tremere': ['auspex', 'blood sorcery', 'dominate'],
    'ventrue': ['dominate', 'fortitude', 'presence'],
    'banu haqim': ['blood sorcery', 'celerity', 'obfuscate'],
    'hecata': ['auspex', 'fortitude', 'oblivion'],
    'lasombra': ['dominate', 'oblivion', 'potence'],
    'the ministry': ['obfuscate', 'presence', 'protean'],
    'ministry': ['obfuscate', 'presence', 'protean'],
    'ravnos': ['animalism', 'obfuscate', 'presence'],
    'salubri': ['auspex', 'dominate', 'fortitude'],
    'tzimisce': ['animalism', 'dominate', 'protean'],
    'caitiff': [],
    'thin-blood': ['thin-blood alchemy']
};

/**
 * Returns the complete list of circular dot-group IDs tracked by the Base + XP system.
 *
 * @returns {string[]} Array of dot group IDs.
 */
function getTrackedRatingGroupIds() {
    const trackedIds = [
        ...V5_ATTRIBUTE_KEYS,
        ...V5_SKILL_KEYS,
        ...V5_DISCIPLINE_DOT_KEYS,
        'blood_potency'
    ];
    for (let rowNumber = 1; rowNumber <= 9; rowNumber++) {
        trackedIds.push('adv_flaw_rating_' + rowNumber);
    }
    for (let rowNumber = 1; rowNumber <= 12; rowNumber++) {
        trackedIds.push('merit_rating_' + rowNumber);
        if (rowNumber <= 10) trackedIds.push('background_rating_' + rowNumber);
        trackedIds.push('flaw_rating_' + rowNumber);
    }
    for (let rowNumber = 1; rowNumber <= 7; rowNumber++) {
        trackedIds.push('haven_merit_rating_' + rowNumber);
        trackedIds.push('haven_flaw_rating_' + rowNumber);
    }
    return trackedIds;
}

/**
 * Recalculates the authoritative `spent_experience` from committed `xp_upgrades`
 * (Attributes, Skills, Disciplines/Powers, Merits/Backgrounds, Blood Potency)
 * plus any non-refunded Specialty/Ritual/Formula purchases in `xp_log`.
 *
 * @param {Object} sheetData - The character's normalized sheet_data object.
 * @returns {number} Authoritative total spent XP.
 */
function recalculateAuthoritativeSpentXp(sheetData) {
    if (!sheetData || typeof sheetData !== 'object') return 0;
    const baseStats = (sheetData.base_stats && typeof sheetData.base_stats === 'object') ? sheetData.base_stats : {};
    const xpUpgrades = (sheetData.xp_upgrades && typeof sheetData.xp_upgrades === 'object') ? sheetData.xp_upgrades : {};

    let computedSpent = 0;
    const primaryStatIds = [
        ...V5_ATTRIBUTE_KEYS,
        ...V5_SKILL_KEYS,
        ...V5_DISCIPLINE_DOT_KEYS,
        'blood_potency'
    ];
    for (let rowNumber = 1; rowNumber <= 7; rowNumber++) {
        primaryStatIds.push('haven_merit_rating_' + rowNumber);
    }

    primaryStatIds.forEach(groupId => {
        const xpDots = Number(xpUpgrades[groupId] || 0);
        if (xpDots > 0) {
            const baseRating = Number(baseStats[groupId] || 0);
            const calc = calculateV5DotUpgradeCost(groupId, baseRating, baseRating + xpDots, sheetData);
            computedSpent += Number(calc.totalCost || 0);
        }
    });

    // For Merits/Backgrounds, avoid double-counting between split (merit_rating_N / background_rating_N) and combined (adv_flaw_rating_N)
    let splitAdvUpgradeCost = 0;
    for (let rowNumber = 1; rowNumber <= 12; rowNumber++) {
        const meritXpDots = Number(xpUpgrades['merit_rating_' + rowNumber] || 0);
        if (meritXpDots > 0) splitAdvUpgradeCost += meritXpDots * 3;
        if (rowNumber <= 10) {
            const bgXpDots = Number(xpUpgrades['background_rating_' + rowNumber] || 0);
            if (bgXpDots > 0) splitAdvUpgradeCost += bgXpDots * 3;
        }
    }
    let combinedAdvUpgradeCost = 0;
    for (let rowNumber = 1; rowNumber <= 9; rowNumber++) {
        const advXpDots = Number(xpUpgrades['adv_flaw_rating_' + rowNumber] || 0);
        if (advXpDots > 0) combinedAdvUpgradeCost += advXpDots * 3;
    }
    computedSpent += Math.max(splitAdvUpgradeCost, combinedAdvUpgradeCost);

    // Add non-dot purchases (Skill Specialties, Blood Sorcery Rituals, Thin-Blood Formulae) from xp_log
    if (Array.isArray(sheetData.xp_log)) {
        sheetData.xp_log.forEach(logEntry => {
            if (!logEntry || logEntry.type !== 'purchase' || logEntry.refunded) return;
            if (!logEntry.targetId || logEntry.category === 'specialty' || logEntry.category === 'ritual' || logEntry.category === 'formula') {
                computedSpent += Number(logEntry.cost || 0);
            }
        });
    }

    sheetData.spent_experience = String(computedSpent);
    sheetData.spent = String(computedSpent);
    return computedSpent;
}

/**
 * Snapshots all existing character dots into `sheetData.base_stats` if not already initialized
 * (or if `forceResnapshot` is true), and ensures `sheetData.xp_upgrades` and `sheetData.xp_log` exist.
 * Also keeps combined (`adv_flaw_rating_N`) and split (`merit_rating_N` / `background_rating_N`) XP/Base
 * ratings synchronized across sheet templates.
 *
 * @param {Object} sheetData - The character's normalized sheet_data object.
 * @param {boolean} forceResnapshot - When true, overwrites base_stats with current total ratings and resets XP dot upgrades.
 */
function ensureBaseStatsSnapshot(sheetData, forceResnapshot = false) {
    if (!sheetData || typeof sheetData !== 'object') return;
    if (!sheetData.xp_upgrades || typeof sheetData.xp_upgrades !== 'object') {
        sheetData.xp_upgrades = {};
    }
    if (!Array.isArray(sheetData.xp_log)) {
        sheetData.xp_log = [];
    }

    const trackedGroupIds = getTrackedRatingGroupIds();
    const needsInitialSnapshot = forceResnapshot || !sheetData.base_stats || typeof sheetData.base_stats !== 'object' || Object.keys(sheetData.base_stats).length === 0;

    if (needsInitialSnapshot) {
        sheetData.base_stats = {};
        if (forceResnapshot) {
            sheetData.xp_upgrades = {};
        }
        trackedGroupIds.forEach(groupId => {
            const currentRatingValue = Number(sheetData[groupId] || 0);
            const existingXpDots = forceResnapshot ? 0 : Number(sheetData.xp_upgrades[groupId] || 0);
            sheetData.base_stats[groupId] = Math.max(0, currentRatingValue - existingXpDots);
        });
        sheetData.base_stats_snapshotted_at = new Date().toISOString();
    } else {
        // Ensure any newly populated advantage/merit/background rows have a base_stats entry
        trackedGroupIds.forEach(groupId => {
            if (sheetData.base_stats[groupId] === undefined) {
                const currentRatingValue = Number(sheetData[groupId] || 0);
                const existingXpDots = Number(sheetData.xp_upgrades[groupId] || 0);
                sheetData.base_stats[groupId] = Math.max(0, currentRatingValue - existingXpDots);
            }
            // Keep total rating equal to base_stats + xp_upgrades
            const baseDotCount = Number(sheetData.base_stats[groupId] || 0);
            const xpDotCount = Number(sheetData.xp_upgrades[groupId] || 0);
            if (baseDotCount + xpDotCount > 0 || sheetData[groupId] !== undefined) {
                sheetData[groupId] = baseDotCount + xpDotCount;
            }
        });
    }

    // Ensure Total & Spent Experience have clean string representations
    if (!sheetData.total_experience && sheetData.total_experience !== '0') {
        sheetData.total_experience = sheetData.total || '0';
    }
    sheetData.total = String(sheetData.total_experience);
    recalculateAuthoritativeSpentXp(sheetData);
}

/**
 * Evaluates a character's `base_stats` against the official Vampire: The Masquerade V5
 * Character Creation rules to verify whether their baseline stats are rule-compliant.
 *
 * @param {Object} sheetData - The character's normalized sheet_data object.
 * @returns {{ isCompliant: boolean, issues: Array<{category: string, detail: string}>, passedChecks: Array<{category: string, detail: string}> }}
 */
function evaluateV5BaseStatCompliance(sheetData) {
    const baseStats = (sheetData && sheetData.base_stats) ? sheetData.base_stats : (sheetData || {});
    const complianceIssues = [];
    const passedChecks = [];

    // 1. ATTRIBUTES CHECK: Official V5 requires 1 at 4, 3 at 3, 4 at 2, 1 at 1 (Total = 22 dots)
    const attributeRatings = V5_ATTRIBUTE_KEYS.map(attributeKey => Number(baseStats[attributeKey] ?? sheetData[attributeKey] ?? 1));
    const sortedAttributeRatings = [...attributeRatings].sort((ratingA, ratingB) => ratingB - ratingA);
    const expectedAttributeArray = [4, 3, 3, 3, 2, 2, 2, 2, 1];
    const totalAttributeDots = attributeRatings.reduce((sum, rating) => sum + rating, 0);
    // JSON.stringify compares the sorted array of 9 attribute ratings against the official V5 array
    const attributesMatchV5 = JSON.stringify(sortedAttributeRatings) === JSON.stringify(expectedAttributeArray);

    if (attributesMatchV5) {
        passedChecks.push({
            category: 'Attributes',
            detail: 'Matches V5 standard array: 1 at 4, 3 at 3, 4 at 2, 1 at 1 (22 dots total).'
        });
    } else {
        const countAt4 = attributeRatings.filter(rating => rating === 4).length;
        const countAt3 = attributeRatings.filter(rating => rating === 3).length;
        const countAt2 = attributeRatings.filter(rating => rating === 2).length;
        const countAt1 = attributeRatings.filter(rating => rating === 1).length;
        const countInvalid = attributeRatings.filter(rating => rating < 1 || rating > 4).length;
        complianceIssues.push({
            category: 'Attributes',
            detail: `Current base Attributes are [${sortedAttributeRatings.join(', ')}] (${totalAttributeDots} dots: ${countAt4}@4, ${countAt3}@3, ${countAt2}@2, ${countAt1}@1${countInvalid ? `, ${countInvalid} out-of-bounds` : ''}). V5 creation requires 1 at 4, 3 at 3, 4 at 2, 1 at 1 (22 dots total).`
        });
    }

    // 2. SKILLS CHECK: Official V5 arrays are Jack of All Trades (29 dots), Balanced (26 dots), or Specialist (22 Corebook / 20 Generator dots),
    // plus optional +1 skill dot when a Predator Type specialty is placed into a 0-dot skill at character creation.
    const skillRatings = V5_SKILL_KEYS.map(skillKey => Number(baseStats[skillKey] ?? sheetData[skillKey] ?? 0));
    const nonZeroSkillRatings = skillRatings.filter(rating => rating > 0).sort((ratingA, ratingB) => ratingB - ratingA);
    const totalSkillDots = skillRatings.reduce((sum, rating) => sum + rating, 0);

    const officialSkillDistributions = {
        'Jack of All Trades (1@3, 8@2, 10@1 = 29 dots)': [3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        'Jack of All Trades + Predator 0-Dot Skill Bonus (1@3, 8@2, 11@1 = 30 dots)': [3, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        'Balanced (3@3, 5@2, 7@1 = 26 dots)': [3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1],
        'Balanced + Predator 0-Dot Skill Bonus (3@3, 5@2, 8@1 = 27 dots)': [3, 3, 3, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1],
        'Specialist (1@4, 3@3, 3@2, 3@1 = 22 dots)': [4, 3, 3, 3, 2, 2, 2, 1, 1, 1],
        'Specialist + Predator 0-Dot Skill Bonus (1@4, 3@3, 3@2, 4@1 = 23 dots)': [4, 3, 3, 3, 2, 2, 2, 1, 1, 1, 1],
        'Specialist — Character Generator (1@4, 2@3, 3@2, 4@1 = 20 dots)': [4, 3, 3, 2, 2, 2, 1, 1, 1, 1],
        'Specialist — Character Generator + Predator 0-Dot Skill Bonus (1@4, 2@3, 3@2, 5@1 = 21 dots)': [4, 3, 3, 2, 2, 2, 1, 1, 1, 1, 1]
    };

    let matchedSkillDistributionName = null;
    for (const [distributionLabel, expectedArray] of Object.entries(officialSkillDistributions)) {
        // JSON.stringify checks if the sorted non-zero skill ratings match this official V5 skill distribution
        if (JSON.stringify(nonZeroSkillRatings) === JSON.stringify(expectedArray)) {
            matchedSkillDistributionName = distributionLabel;
            break;
        }
    }

    // Check if the character's base_stats Skills are 1 single upgraded dot above an official V5 creation array
    // (which happens when a character upgraded 1 skill dot on their sheet before base_stats was snapshotted)
    const preSnapshotSkillCandidates = [];
    if (!matchedSkillDistributionName) {
        V5_SKILL_KEYS.forEach((skillKey, skillIndex) => {
            const currentBaseRating = skillRatings[skillIndex];
            if (currentBaseRating <= 0) return;
            const testRatings = [...skillRatings];
            testRatings[skillIndex] = currentBaseRating - 1;
            const sortedTestNonZero = testRatings.filter(rating => rating > 0).sort((ratingA, ratingB) => ratingB - ratingA);
            for (const [distributionLabel, expectedArray] of Object.entries(officialSkillDistributions)) {
                // JSON.stringify compares the hypothetical pre-upgrade skill array against each official V5 distribution
                if (JSON.stringify(sortedTestNonZero) === JSON.stringify(expectedArray)) {
                    const prettySkillName = skillKey.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
                    const xpCostForDot = (currentBaseRating - 1) === 0 ? 3 : currentBaseRating * 3;
                    preSnapshotSkillCandidates.push({
                        skillKey: skillKey,
                        skillName: prettySkillName,
                        fromRating: currentBaseRating - 1,
                        toRating: currentBaseRating,
                        xpCost: xpCostForDot,
                        distributionLabel: distributionLabel
                    });
                    break;
                }
            }
        });
    }

    if (matchedSkillDistributionName) {
        passedChecks.push({
            category: 'Skills',
            detail: `Matches V5 ${matchedSkillDistributionName}.`
        });
    } else {
        const skillCountAt5 = skillRatings.filter(rating => rating >= 5).length;
        const skillCountAt4 = skillRatings.filter(rating => rating === 4).length;
        const skillCountAt3 = skillRatings.filter(rating => rating === 3).length;
        const skillCountAt2 = skillRatings.filter(rating => rating === 2).length;
        const skillCountAt1 = skillRatings.filter(rating => rating === 1).length;
        const candidateHintText = preSnapshotSkillCandidates.length > 0
            ? ` (Looks like ${preSnapshotSkillCandidates[0].distributionLabel} + 1 upgraded dot — use "Convert Extra Dot to Red XP Upgrade" to move the upgraded dot out of Base Stats.)`
            : '';
        complianceIssues.push({
            category: 'Skills',
            detail: `Current base Skills total ${totalSkillDots} dots (${skillCountAt5 ? `${skillCountAt5}@5, ` : ''}${skillCountAt4}@4, ${skillCountAt3}@3, ${skillCountAt2}@2, ${skillCountAt1}@1). Does not match V5 Specialist (20–23 dots), Balanced (26–27 dots), or Jack of All Trades (29–30 dots).${candidateHintText}`
        });
    }

    // 3. DISCIPLINES CHECK: V5 creation grants 2 dots in one In-Clan, 1 dot in another (3 dots) + 1 Predator Type dot (3-4 dots total; 0 for Thin-Bloods)
    const clanNameLower = String(sheetData.clan || '').toLowerCase().trim();
    const isThinBlood = clanNameLower.includes('thin-blood') || clanNameLower.includes('thin blood');
    const disciplineRatings = V5_DISCIPLINE_DOT_KEYS.map(disciplineDotKey => Number(baseStats[disciplineDotKey] ?? sheetData[disciplineDotKey] ?? 0)).filter(rating => rating > 0);
    const totalDisciplineDots = disciplineRatings.reduce((sum, rating) => sum + rating, 0);
    const maxSingleDiscipline = disciplineRatings.length > 0 ? Math.max(...disciplineRatings) : 0;

    if (isThinBlood) {
        if (totalDisciplineDots <= 1) {
            passedChecks.push({
                category: 'Disciplines',
                detail: `Thin-Blood base Discipline dots (${totalDisciplineDots}) within creation limits.`
            });
        } else {
            complianceIssues.push({
                category: 'Disciplines',
                detail: `Thin-Blood has ${totalDisciplineDots} base Discipline dots (V5 Thin-Bloods start with 0 Discipline dots unless granted 1 dot by a Merit).`
            });
        }
    } else if (totalDisciplineDots >= 3 && totalDisciplineDots <= 4 && maxSingleDiscipline <= 3) {
        passedChecks.push({
            category: 'Disciplines',
            detail: `Base Discipline dots (${totalDisciplineDots} total: [${disciplineRatings.join(', ')}]) match V5 creation (2 In-Clan + 1 In-Clan + Predator bonus).`
        });
    } else {
        complianceIssues.push({
            category: 'Disciplines',
            detail: `Current base Discipline dots total ${totalDisciplineDots} ([${disciplineRatings.join(', ') || 'none'}]). V5 creation grants 3 base dots (one at 2, one at 1) plus 1 Predator Type dot (3–4 dots total, max level 3).`
        });
    }

    // 4. ADVANTAGES & FLAWS CHECK: V5 creation requires at least 2 Flaw dots and ~7 base Advantage dots (+ Predator bonuses)
    let totalAdvantageDots = 0;
    let totalFlawDots = 0;
    for (let rowNumber = 1; rowNumber <= 12; rowNumber++) {
        if (sheetData['merit_name_' + rowNumber]) {
            totalAdvantageDots += Number(baseStats['merit_rating_' + rowNumber] ?? sheetData['merit_rating_' + rowNumber] ?? 0);
        }
        if (rowNumber <= 10 && sheetData['background_name_' + rowNumber]) {
            totalAdvantageDots += Number(baseStats['background_rating_' + rowNumber] ?? sheetData['background_rating_' + rowNumber] ?? 0);
        }
        if (sheetData['flaw_name_' + rowNumber]) {
            totalFlawDots += Number(baseStats['flaw_rating_' + rowNumber] ?? sheetData['flaw_rating_' + rowNumber] ?? 0);
        }
    }
    if (totalAdvantageDots >= 7 && totalAdvantageDots <= 12 && totalFlawDots >= 2) {
        passedChecks.push({
            category: 'Advantages & Flaws',
            detail: `Base Advantages (${totalAdvantageDots} dots) and Flaws (${totalFlawDots} dots) comply with V5 creation (7 base Advantage dots + Predator Type bonuses, min 2 Flaw dots).`
        });
    } else {
        complianceIssues.push({
            category: 'Advantages & Flaws',
            detail: `Base Advantages: ${totalAdvantageDots} dots, Base Flaws: ${totalFlawDots} dots. V5 creation grants 7 Advantage dots (+1 to +3 from Predator Type) and requires at least 2 Flaw dots.`
        });
    }

    // 5. DERIVED TRACKERS & BLOOD POTENCY CHECK
    const effectiveStamina = Number(sheetData.stamina || baseStats.stamina || 2);
    const effectiveComposure = Number(sheetData.composure || baseStats.composure || 2);
    const effectiveResolve = Number(sheetData.resolve || baseStats.resolve || 2);
    const expectedWillpowerMax = effectiveComposure + effectiveResolve;
    const actualWillpowerMax = Number(sheetData.willpower_max || expectedWillpowerMax);

    if (actualWillpowerMax === expectedWillpowerMax) {
        passedChecks.push({
            category: 'Willpower Tracker',
            detail: `Willpower capacity (${actualWillpowerMax}) matches Composure (${effectiveComposure}) + Resolve (${effectiveResolve}).`
        });
    } else {
        complianceIssues.push({
            category: 'Willpower Tracker',
            detail: `Willpower capacity is ${actualWillpowerMax}, but Composure (${effectiveComposure}) + Resolve (${effectiveResolve}) = ${expectedWillpowerMax}.`
        });
    }

    return {
        isCompliant: complianceIssues.length === 0,
        issues: complianceIssues,
        passedChecks: passedChecks,
        preSnapshotSkillCandidates: preSnapshotSkillCandidates
    };
}

/**
 * Formats a human-readable display name for any dot-group ID on the character sheet.
 *
 * @param {string} dotGroupId - The ID of the dot group (e.g., 'strength', 'animal_ken', 'discipline_dots_0').
 * @param {Object} sheetData - The character's current sheet_data object.
 * @returns {string} Human-readable label for the stat.
 */
function formatStatDisplayName(dotGroupId, sheetData) {
    if (!dotGroupId) return 'Stat';
    if (dotGroupId.startsWith('discipline_dots_')) {
        const slotIndex = dotGroupId.replace('discipline_dots_', '');
        // document.getElementById checks the live input field for the Discipline name first
        const liveNameInput = document.getElementById('discipline_name_' + slotIndex);
        const disciplineName = (liveNameInput && liveNameInput.value.trim()) || (sheetData && sheetData['discipline_name_' + slotIndex]) || `Discipline #${Number(slotIndex) + 1}`;
        return `Discipline: ${disciplineName}`;
    }
    const advantageMatch = dotGroupId.match(/^(adv_flaw|merit|background|flaw|haven_merit|haven_flaw)_rating_(\d+)$/);
    if (advantageMatch) {
        const prefix = advantageMatch[1];
        const rowNumber = advantageMatch[2];
        const nameFieldId = `${prefix}_name_${rowNumber}`;
        // document.getElementById looks up the text input for the Advantage/Merit/Background/Flaw row
        const liveAdvantageInput = document.getElementById(nameFieldId);
        const rowTitle = (liveAdvantageInput && liveAdvantageInput.value.trim()) || (sheetData && sheetData[nameFieldId]) || `${prefix.replace('_', ' ')} #${rowNumber}`;
        return rowTitle;
    }
    return dotGroupId
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Calculates the official Vampire: The Masquerade V5 Experience Point (XP) cost
 * to upgrade a circular dot group from `fromRating` to `toRating`.
 *
 * Official V5 Multipliers:
 * - Attribute: New Level x 5 XP
 * - Skill: New Level x 3 XP
 * - In-Clan Discipline: New Level x 5 XP
 * - Out-of-Clan Discipline: New Level x 7 XP
 * - Caitiff Discipline: New Level x 6 XP
 * - Thin-Blood Alchemy: New Level x 3 XP
 * - Advantage (Merit / Background / Haven Merit): Flat 3 XP per dot
 * - Blood Potency: New Level x 10 XP
 *
 * @param {string} dotGroupId - The ID of the dot group being upgraded.
 * @param {number} fromRating - Current rating before the upgrade.
 * @param {number} toRating - Target rating after the upgrade.
 * @param {Object} sheetData - The character's sheet_data object (used to check Clan and Discipline names).
 * @returns {{ totalCost: number, breakdown: string, category: string }}
 */
function calculateV5DotUpgradeCost(dotGroupId, fromRating, toRating, sheetData) {
    if (toRating <= fromRating) {
        return { totalCost: 0, breakdown: '0 XP', category: 'none' };
    }

    let totalXpCost = 0;
    let stepDescriptions = [];
    let upgradeCategory = 'stat';

    if (V5_ATTRIBUTE_KEYS.includes(dotGroupId)) {
        upgradeCategory = 'attribute';
        for (let nextLevel = fromRating + 1; nextLevel <= toRating; nextLevel++) {
            const stepCost = nextLevel * 5;
            totalXpCost += stepCost;
            stepDescriptions.push(`Lvl ${nextLevel} (${stepCost} XP)`);
        }
    } else if (V5_SKILL_KEYS.includes(dotGroupId)) {
        upgradeCategory = 'skill';
        for (let nextLevel = fromRating + 1; nextLevel <= toRating; nextLevel++) {
            const stepCost = nextLevel * 3;
            totalXpCost += stepCost;
            stepDescriptions.push(`Lvl ${nextLevel} (${stepCost} XP)`);
        }
    } else if (dotGroupId.startsWith('discipline_dots_')) {
        upgradeCategory = 'discipline';
        const slotIndex = dotGroupId.replace('discipline_dots_', '');
        // document.getElementById checks the Discipline name input and Clan select dropdown on the sheet
        const liveDisciplineInput = document.getElementById('discipline_name_' + slotIndex);
        const liveClanElement = document.getElementById('clan');
        const disciplineNameLower = String((liveDisciplineInput && liveDisciplineInput.value) || (sheetData && sheetData['discipline_name_' + slotIndex]) || '').toLowerCase().trim();
        const clanNameLower = String((liveClanElement && liveClanElement.value) || (sheetData && sheetData.clan) || '').toLowerCase().trim();

        let multiplier = 7; // Default Out-of-Clan multiplier (x7)
        let multiplierLabel = 'Out-of-Clan ×7';

        if (disciplineNameLower.includes('alchemy')) {
            multiplier = 3;
            multiplierLabel = 'Thin-Blood Alchemy ×3';
        } else if (clanNameLower.includes('caitiff')) {
            multiplier = 6;
            multiplierLabel = 'Caitiff ×6';
        } else {
            const inClanList = V5_CLAN_DISCIPLINES_MAP[clanNameLower] || [];
            const isInClan = inClanList.some(inClanDisc => disciplineNameLower.includes(inClanDisc));
            if (isInClan) {
                multiplier = 5;
                multiplierLabel = 'In-Clan ×5';
            }
        }

        for (let nextLevel = fromRating + 1; nextLevel <= toRating; nextLevel++) {
            const stepCost = nextLevel * multiplier;
            totalXpCost += stepCost;
            stepDescriptions.push(`Lvl ${nextLevel} (${stepCost} XP [${multiplierLabel}])`);
        }
    } else if (dotGroupId === 'blood_potency') {
        upgradeCategory = 'blood_potency';
        for (let nextLevel = fromRating + 1; nextLevel <= toRating; nextLevel++) {
            const stepCost = nextLevel * 10;
            totalXpCost += stepCost;
            stepDescriptions.push(`BP ${nextLevel} (${stepCost} XP)`);
        }
    } else if (dotGroupId.match(/^(adv_flaw|merit|background|haven_merit)_rating_(\d+)$/)) {
        upgradeCategory = 'advantage';
        const dotsAdded = toRating - fromRating;
        totalXpCost = dotsAdded * 3;
        stepDescriptions.push(`${dotsAdded} dot(s) × 3 XP`);
    } else {
        // Flaws or custom trackers cost 0 XP
        upgradeCategory = 'other';
        totalXpCost = 0;
        stepDescriptions.push('0 XP');
    }

    return {
        totalCost: totalXpCost,
        breakdown: stepDescriptions.join(' + '),
        category: upgradeCategory
    };
}

/**
 * Updates the Blood Potency derived stats inputs (`blood_surge`, `mend_amount`,
 * `power_bonus`, `rouse_reroll`, `bane_severity`, `feeding_penalty`) in the DOM
 * and in `sheet` when Blood Potency dots are clicked.
 *
 * @param {number} bloodPotencyRating - Blood Potency rating (0 to 10).
 */
function applyBloodPotencyTable(bloodPotencyRating) {
    const derivedBloodStats = BLOOD_POTENCY_TABLE[bloodPotencyRating] || BLOOD_POTENCY_TABLE[0];
    const fieldIdToValueMap = {
        'blood_surge': derivedBloodStats.surge,
        'mend_amount': derivedBloodStats.mend,
        'power_bonus': derivedBloodStats.power,
        'rouse_reroll': derivedBloodStats.reroll,
        'bane_severity': derivedBloodStats.bane,
        'feeding_penalty': derivedBloodStats.penalty
    };
    for (const [inputFieldId, derivedStatValue] of Object.entries(fieldIdToValueMap)) {
        // document.getElementById finds the input field for each Blood Potency derived stat so we can update its displayed text
        const statInputElement = document.getElementById(inputFieldId);
        if (statInputElement) statInputElement.value = derivedStatValue;
    }
}

/**
 * Main initialization block that runs when the DOM is fully loaded.
 * 
 * This block handles the setup of the character sheet UI. It parses URL parameters
 * to determine the character ID and whether the sheet is in readonly mode.
 * It also sets up message listeners for cross-window communication (e.g., Virtual Tabletop sync),
 * initializes dots for trackers, sets up dynamic element IDs, fetches character data,
 * and binds save triggers.
 * 
 * @listens document#DOMContentLoaded
 */
// document.addEventListener registers a callback function that runs as soon as the HTML document finishes loading
document.addEventListener('DOMContentLoaded', () => {
    // URLSearchParams parses the query string parameters (like ?char_id=5&readonly=true) from the browser's current URL
    const urlParams = new URLSearchParams(window.location.search);
    // urlParams.get retrieves the value of a specific URL query parameter by name
    const charId = urlParams.get('char_id');
    const isReadonly = urlParams.get('readonly') === 'true';
    let currentSheetData = {};
    let isViewerStoryteller = urlParams.get('is_gm') === 'true';
    // When true, the Storyteller is previewing the exact Player Perspective ("View as Player" toggle)
    let isPlayerPreviewOverride = false;
    // Whether the Player Experience drawer is open at the top of the sheet (hidden by default!)
    let isXpDrawerOpen = false;
    // Whether the Storyteller Sheet Tools drawer is open at the top of the sheet (hidden by default!)
    let isStDrawerOpen = false;
    // Whether the On-Sheet Privacy & Redaction Mode bar is open at the top of the sheet (hidden by default!)
    let isPrivacyDrawerOpen = false;
    let characterChronicleId = null;
    // Storyteller sheet mode: 'xp' (Spend or Refund Crimson Red XP dots) or 'base' (Edit permanent Black Base dots)
    let storytellerSheetMode = 'xp';
    // Whether the Guided "Spend XP" highlight mode is currently toggled ON
    let isSpendXpHighlightMode = false;
    // Player's temporary uncommitted XP shopping cart
    let pendingXpCart = [];

    /**
     * Returns true if the current viewer has Storyteller privileges AND is not currently in "View as Player" preview mode.
     */
    function isEffectiveStoryteller() {
        return isViewerStoryteller && !isPlayerPreviewOverride;
    }

    /**
     * Returns true if the Storyteller has unlocked Black Base Dot editing for the player (`sheetData.player_base_edit_unlocked === true`).
     */
    function isPlayerBaseEditUnlocked() {
        return Boolean(currentSheetData && currentSheetData.player_base_edit_unlocked);
    }

    /**
     * Checks whether a given circular dot group has a valid name filled in (for Disciplines/Merits/Backgrounds)
     * so we only highlight rows that are actually in use when Spend XP Mode is active.
     */
    function isDotGroupEligibleForXpHighlight(groupId) {
        if (V5_ATTRIBUTE_KEYS.includes(groupId) || V5_SKILL_KEYS.includes(groupId) || groupId === 'blood_potency') {
            return true;
        }
        if (groupId.startsWith('discipline_dots_')) {
            const slotIdx = groupId.replace('discipline_dots_', '');
            const discInput = document.getElementById('discipline_name_' + slotIdx);
            const discName = String((discInput && discInput.value) || (currentSheetData && currentSheetData['discipline_name_' + slotIdx]) || '').trim();
            return discName.length > 0;
        }
        const advMatch = groupId.match(/^(adv_flaw|merit|background|haven_merit)_rating_(\d+)$/);
        if (advMatch) {
            const prefix = advMatch[1];
            const rowNum = advMatch[2];
            if (prefix === 'adv_flaw') {
                const badgeEl = document.getElementById('adv_flaw_type_' + rowNum);
                if (badgeEl && badgeEl.getAttribute('data-adv-type') === 'flaw') return false;
            }
            const nameInput = document.getElementById(`${prefix}_name_${rowNum}`);
            const rowName = String((nameInput && nameInput.value) || (currentSheetData && currentSheetData[`${prefix}_name_${rowNum}`]) || '').trim();
            return rowName.length > 0;
        }
        return false;
    }

    /**
     * Renders a circular `.dot-group` element with visual dot tiers:
     * 1. `.dot.active.base-dot` (Solid Black) for permanent Character Creation / Base dots.
     * 2. `.dot.active.xp-dot` (Solid Crimson Red #991b1b) for committed XP-purchased dots.
     * 3. `.dot.xp-cart-dot` (Pulsing Crimson outline) for pending uncommitted XP cart dots.
     * 4. `.dot.xp-affordable-next` (Glowing Emerald Green outline) for the next affordable dot when Spend XP Mode is ON.
     *
     * @param {HTMLElement} dotGroupElement - The circular `.dot-group` DOM container.
     */
    function renderCircularDotGroup(dotGroupElement) {
        if (!dotGroupElement || !dotGroupElement.id || dotGroupElement.classList.contains('square-group')) return;
        const groupId = dotGroupElement.id;
        const baseStatsMap = (currentSheetData && currentSheetData.base_stats) ? currentSheetData.base_stats : {};
        const xpUpgradesMap = (currentSheetData && currentSheetData.xp_upgrades) ? currentSheetData.xp_upgrades : {};

        const baseDotCount = Number(baseStatsMap[groupId] ?? currentSheetData[groupId] ?? 0);
        const committedXpDotCount = Number(xpUpgradesMap[groupId] ?? 0);
        const committedTotalRating = baseDotCount + committedXpDotCount;

        // Check if this dot group has a pending upgrade in the player's uncommitted XP cart
        const pendingCartIndex = pendingXpCart.findIndex(cartItem => cartItem.type === 'dot' && cartItem.targetId === groupId);
        const pendingCartEntry = pendingCartIndex !== -1 ? pendingXpCart[pendingCartIndex] : null;
        const pendingTargetRating = pendingCartEntry ? Number(pendingCartEntry.toRating) : committedTotalRating;

        const totalAwardedXp = Number(currentSheetData.total_experience || currentSheetData.total || 0);
        const alreadySpentXp = Number(currentSheetData.spent_experience || currentSheetData.spent || 0);
        const otherCartCost = pendingXpCart.reduce((sum, item, idx) => idx === pendingCartIndex ? sum : sum + Number(item.cost || 0), 0);
        const availableXpForThisStat = totalAwardedXp - alreadySpentXp - otherCartCost;
        const effectiveSt = isEffectiveStoryteller();
        const isEligibleForHighlight = isSpendXpHighlightMode && storytellerSheetMode !== 'base' && !isReadonly && isDotGroupEligibleForXpHighlight(groupId);

        const statLabel = formatStatDisplayName(groupId, currentSheetData);

        // querySelectorAll retrieves all circular dot elements inside this rating group
        const dotElements = dotGroupElement.querySelectorAll('.dot');
        dotElements.forEach((dotElement, dotIndex) => {
            const dotLevelNumber = dotIndex + 1;
            dotElement.classList.remove('active', 'base-dot', 'xp-dot', 'xp-cart-dot', 'xp-affordable-next', 'xp-unaffordable-next');

            if (dotIndex < baseDotCount) {
                dotElement.classList.add('active', 'base-dot');
                dotElement.title = effectiveSt && storytellerSheetMode === 'base'
                    ? `${statLabel} ${dotLevelNumber} (Base Stat — Click to adjust black starting dots)`
                    : `${statLabel} ${dotLevelNumber} (Starting Base Stat — Locked)`;
            } else if (dotIndex < committedTotalRating) {
                dotElement.classList.add('active', 'xp-dot');
                dotElement.title = effectiveSt
                    ? `${statLabel} ${dotLevelNumber} (Purchased with XP — Storyteller: Click this red dot to refund XP)`
                    : `${statLabel} ${dotLevelNumber} (Purchased with XP — Ask Storyteller if you need a refund)`;
            } else if (dotIndex < pendingTargetRating) {
                dotElement.classList.add('xp-cart-dot');
                dotElement.title = `${statLabel} ${dotLevelNumber} (In Pending XP Cart — Click to remove from cart, or click 'Commit XP Spend' at the top)`;
            } else {
                if (effectiveSt && storytellerSheetMode === 'base') {
                    dotElement.title = `Set ${statLabel} Starting Base Rating to ${dotLevelNumber} (0 XP)`;
                } else {
                    const upgradeCostPreview = calculateV5DotUpgradeCost(groupId, committedTotalRating, dotLevelNumber, currentSheetData);
                    if (upgradeCostPreview.totalCost > 0) {
                        const canAffordThisDot = upgradeCostPreview.totalCost <= availableXpForThisStat;
                        if (isEligibleForHighlight && dotIndex === pendingTargetRating) {
                            if (canAffordThisDot) {
                                dotElement.classList.add('xp-affordable-next');
                                dotElement.title = `🟢 Click to Upgrade ${statLabel} to Dot ${dotLevelNumber} (Cost: ${upgradeCostPreview.totalCost} XP — ${upgradeCostPreview.breakdown})`;
                            } else {
                                dotElement.classList.add('xp-unaffordable-next');
                                dotElement.title = `Need ${upgradeCostPreview.totalCost - availableXpForThisStat} more XP to Upgrade ${statLabel} to Dot ${dotLevelNumber} (Costs ${upgradeCostPreview.totalCost} XP, you have ${availableXpForThisStat} XP available)`;
                            }
                        } else {
                            dotElement.title = canAffordThisDot
                                ? `Click to Upgrade ${statLabel} to Dot ${dotLevelNumber} (Cost: ${upgradeCostPreview.totalCost} XP — ${upgradeCostPreview.breakdown})`
                                : `${statLabel} Dot ${dotLevelNumber} — Costs ${upgradeCostPreview.totalCost} XP (Need ${upgradeCostPreview.totalCost - availableXpForThisStat} more XP)`;
                        }
                    } else {
                        dotElement.title = `${statLabel} ${dotLevelNumber}`;
                    }
                }
            }
        });
    }

    /**
     * Re-renders all circular dot groups and updates the Experience inputs and floating XP toolbar.
     */
    function refreshAllXpVisuals() {
        // document.querySelectorAll selects all dot groups on the sheet so we can refresh their Base/XP/Cart colors
        document.querySelectorAll('.dot-group').forEach(dotGroupElement => {
            if (!dotGroupElement.classList.contains('square-group')) {
                renderCircularDotGroup(dotGroupElement);
            }
        });

        const totalXpValue = Number(currentSheetData.total_experience || currentSheetData.total || 0);
        const spentXpValue = recalculateAuthoritativeSpentXp(currentSheetData);
        const pendingCartCost = pendingXpCart.reduce((sum, item) => sum + Number(item.cost || 0), 0);
        const availableXpValue = totalXpValue - spentXpValue - pendingCartCost;

        ['total_experience', 'total'].forEach(fieldId => {
            // document.getElementById locates the Total Experience input field on the sheet
            const inputElement = document.getElementById(fieldId);
            if (inputElement) {
                inputElement.value = String(totalXpValue);
                inputElement.readOnly = true;
                inputElement.setAttribute('readonly', 'readonly');
                inputElement.title = 'Total Experience (Controlled strictly by Storyteller awards/deductions)';
            }
        });
        ['spent_experience', 'spent'].forEach(fieldId => {
            // document.getElementById locates the Spent Experience input field on the sheet
            const inputElement = document.getElementById(fieldId);
            if (inputElement) {
                inputElement.value = pendingCartCost > 0
                    ? `${spentXpValue} (+${pendingCartCost} cart)`
                    : String(spentXpValue);
                inputElement.readOnly = true;
                inputElement.setAttribute('readonly', 'readonly');
                inputElement.classList.toggle('xp-field-highlight', spentXpValue > 0 || pendingCartCost > 0);
                inputElement.title = `Spent XP: ${spentXpValue} (Calculated automatically from XP upgrades) | Available XP: ${availableXpValue}`;
            }
        });

        updateXpToolbarAndCartUi();
    }

    /**
     * Updates derived Health and Willpower capacities when Stamina, Composure, or Resolve changes.
     *
     * @param {string} changedStatId - The attribute ID that changed ('stamina', 'composure', or 'resolve').
     */
    function syncDerivedTrackerCapacitiesOnAttributeChange(changedStatId) {
        if (changedStatId === 'stamina') {
            const newStaminaRating = Number(currentSheetData.stamina || 2);
            const newHealthCapacity = newStaminaRating + 3;
            currentSheetData.health_max = newHealthCapacity;
            // document.getElementById finds the Health tracker container element
            const healthGroupElement = document.getElementById('health_states') || document.getElementById('health');
            const maxBoxes = healthGroupElement ? (parseInt(healthGroupElement.getAttribute('data-max')) || 10) : 10;
            const normalizedHealth = normalizeCapacityTracker(currentSheetData.health_states, newHealthCapacity, maxBoxes, newHealthCapacity);
            currentSheetData.health_states = normalizedHealth.states;
            if (healthGroupElement) {
                // querySelectorAll gets all square boxes in the Health tracker to update their capacity states
                healthGroupElement.querySelectorAll('.dot').forEach((boxElement, boxIndex) => {
                    boxElement.setAttribute('data-state', normalizedHealth.states[boxIndex] || 'empty');
                });
            }
        } else if (changedStatId === 'composure' || changedStatId === 'resolve') {
            const newComposureRating = Number(currentSheetData.composure || 2);
            const newResolveRating = Number(currentSheetData.resolve || 2);
            const newWillpowerCapacity = newComposureRating + newResolveRating;
            currentSheetData.willpower_max = newWillpowerCapacity;
            // document.getElementById finds the Willpower tracker container element
            const willpowerGroupElement = document.getElementById('willpower_states') || document.getElementById('willpower');
            const maxBoxes = willpowerGroupElement ? (parseInt(willpowerGroupElement.getAttribute('data-max')) || 10) : 10;
            const normalizedWillpower = normalizeCapacityTracker(currentSheetData.willpower_states, newWillpowerCapacity, maxBoxes, newWillpowerCapacity);
            currentSheetData.willpower_states = normalizedWillpower.states;
            if (willpowerGroupElement) {
                // querySelectorAll gets all square boxes in the Willpower tracker to update their capacity states
                willpowerGroupElement.querySelectorAll('.dot').forEach((boxElement, boxIndex) => {
                    boxElement.setAttribute('data-state', normalizedWillpower.states[boxIndex] || 'empty');
                });
            }
        }
    }
    
    // Listen for sync messages from the VTT parent
    /**
     * Listens for sync and header control messages from the parent VTT modal window.
     * 
     * @param {MessageEvent} messageEvent - The message event sent from the parent window.
     * @listens window#message
     */
    // window.addEventListener listens for cross-window postMessage events sent from the parent Virtual Tabletop frame
    window.addEventListener('message', async (messageEvent) => {
        if (!messageEvent.data || !messageEvent.data.type) return;

        if (messageEvent.data.type === 'vtm:set_sheet_tab_mode') {
            const requestedTabMode = messageEvent.data.mode;
            if (requestedTabMode === 'sheet') {
                isXpDrawerOpen = false;
                isStDrawerOpen = false;
                isPrivacyDrawerOpen = false;
                isSpendXpHighlightMode = false;
                if (storytellerSheetMode === 'base') {
                    storytellerSheetMode = 'xp';
                }
                refreshAllXpVisuals();
                applyRedaction();
            } else if (requestedTabMode === 'xp') {
                isXpDrawerOpen = true;
                isStDrawerOpen = false;
                isPrivacyDrawerOpen = false;
                storytellerSheetMode = 'xp';
                isSpendXpHighlightMode = true;
                refreshAllXpVisuals();
                applyRedaction();
            } else if (requestedTabMode === 'privacy') {
                if (!isReadonly) {
                    if (Array.isArray(messageEvent.data.eligiblePlayers)) {
                        window.vtmEligiblePlayersList = messageEvent.data.eligiblePlayers;
                    }
                    if (messageEvent.data.hiddenFromUserIds !== undefined) {
                        window.vtmHiddenFromUserIds = messageEvent.data.hiddenFromUserIds;
                    }
                    isPrivacyDrawerOpen = true;
                    isXpDrawerOpen = false;
                    isStDrawerOpen = false;
                    isSpendXpHighlightMode = false;
                    if (storytellerSheetMode === 'base') {
                        storytellerSheetMode = 'xp';
                    }
                    refreshAllXpVisuals();
                    applyRedaction();
                    showSaveState('saved', 'Privacy Mode Active: Click any section pill above or any field/stat on the sheet to toggle [REDACTED]');
                }
            } else if (requestedTabMode === 'base_edit') {
                if (isEffectiveStoryteller()) {
                    storytellerSheetMode = 'base';
                    isXpDrawerOpen = false;
                    isStDrawerOpen = false;
                    isPrivacyDrawerOpen = false;
                    isSpendXpHighlightMode = false;
                    refreshAllXpVisuals();
                    applyRedaction();
                    showSaveState('saved', 'Storyteller Mode: Click any dot on the sheet to edit permanent Black Base Dots');
                }
            } else if (requestedTabMode === 'open_compliance') {
                isXpDrawerOpen = false;
                isStDrawerOpen = false;
                isPrivacyDrawerOpen = false;
                isSpendXpHighlightMode = false;
                refreshAllXpVisuals();
                renderComplianceReportModal();
                // document.getElementById displays the V5 Base Stat Compliance modal overlay
                const complianceModalElement = document.getElementById('xp-compliance-modal');
                if (complianceModalElement) complianceModalElement.style.display = 'flex';
            } else if (requestedTabMode === 'open_xp_log') {
                isXpDrawerOpen = false;
                isStDrawerOpen = false;
                isPrivacyDrawerOpen = false;
                isSpendXpHighlightMode = false;
                refreshAllXpVisuals();
                renderXpHistoryLogList();
                // document.getElementById displays the XP Advancement & History Log modal overlay
                const xpAdvancementModalElement = document.getElementById('xp-advancement-modal');
                if (xpAdvancementModalElement) xpAdvancementModalElement.style.display = 'flex';
            }
            return;
        }

        if (messageEvent.data.type === 'vtm:toggle_privacy_drawer') {
            if (isReadonly) return;
            isPrivacyDrawerOpen = !isPrivacyDrawerOpen;
            if (isPrivacyDrawerOpen) {
                isXpDrawerOpen = false;
                isStDrawerOpen = false;
                isSpendXpHighlightMode = false;
                if (storytellerSheetMode === 'base') storytellerSheetMode = 'xp';
            }
            refreshAllXpVisuals();
            applyRedaction();
            return;
        }

        if (messageEvent.data.type === 'vtm:award_xp_from_sidebar') {
            await submitStorytellerSheetXpDelta(
                Number(messageEvent.data.amount || 0),
                messageEvent.data.target || 'character',
                messageEvent.data.reason || '',
                null
            );
            return;
        }

        if (messageEvent.data.type === 'vtm:refund_xp_entry') {
            if (!isEffectiveStoryteller() || isReadonly) return;
            refundCommittedPurchaseEntry(Number(messageEvent.data.logIndex));
            return;
        }

        if (messageEvent.data.type === 'vtm:resnapshot_base_stats') {
            if (!isEffectiveStoryteller() || isReadonly) return;
            // window.confirm asks the Storyteller to confirm re-snapshotting current sheet ratings as permanent base stats
            if (!window.confirm('STORYTELLER BASE STAT SNAPSHOT\n\nConvert all current dots on this sheet into permanent Black Base Dots and clear Red XP dot upgrades?')) {
                return;
            }
            ensureBaseStatsSnapshot(currentSheetData, true);
            pendingXpCart = [];
            refreshAllXpVisuals();
            triggerSave(null, true);
            showSaveState('saved', 'All current dots locked in as permanent Black Base Dots');
            return;
        }

        if (messageEvent.data.type === 'vtm:toggle_player_base_unlock') {
            if (!isEffectiveStoryteller() || isReadonly) return;
            const currentlyUnlocked = Boolean(currentSheetData.player_base_edit_unlocked);
            const nextUnlockedState = !currentlyUnlocked;
            currentSheetData.player_base_edit_unlocked = nextUnlockedState;
            if (!nextUnlockedState) {
                // Locking: snapshot all current Base Stats and return to XP mode
                ensureBaseStatsSnapshot(currentSheetData, false);
                currentSheetData.base_stats_snapshotted_at = new Date().toISOString();
                storytellerSheetMode = 'xp';
            } else {
                isXpDrawerOpen = false;
                isSpendXpHighlightMode = false;
            }
            refreshAllXpVisuals();
            triggerSave(null, true);
            showSaveState(
                'saved',
                nextUnlockedState
                    ? 'Base Stat editing UNLOCKED for Player (0 XP Black Dots)'
                    : 'Base Stats LOCKED & Snapshotted for Player!'
            );
            return;
        }

        function syncSquareTrackerDomFromCurrentSheetData() {
            document.querySelectorAll('.dot-group.square-group').forEach(dotGroupElement => {
                if (!dotGroupElement.id) return;
                let trackerValue = currentSheetData[dotGroupElement.id];
                if (dotGroupElement.id === 'health' || dotGroupElement.id === 'health_states') {
                    trackerValue = currentSheetData.health_states || currentSheetData.health;
                } else if (dotGroupElement.id === 'willpower' || dotGroupElement.id === 'willpower_states') {
                    trackerValue = currentSheetData.willpower_states || currentSheetData.willpower;
                } else if (dotGroupElement.id === 'humanity' || dotGroupElement.id === 'humanity_states') {
                    trackerValue = currentSheetData.humanity_states || currentSheetData.humanity;
                } else if (dotGroupElement.id === 'hunger') {
                    trackerValue = currentSheetData.hunger;
                }
                if (typeof trackerValue === 'number') {
                    const maxBoxes = parseInt(dotGroupElement.getAttribute('data-max')) || 10;
                    if (dotGroupElement.id === 'hunger' || dotGroupElement.id === 'humanity' || dotGroupElement.id === 'humanity_states') {
                        trackerValue = Array.from({ length: maxBoxes }, (_, boxIndex) => boxIndex < trackerValue ? 'filled' : 'empty');
                    } else {
                        trackerValue = Array.from({ length: maxBoxes }, (_, boxIndex) => boxIndex < trackerValue ? 'empty' : 'filled');
                    }
                }
                if (Array.isArray(trackerValue)) {
                    const dotElements = dotGroupElement.querySelectorAll('.dot');
                    dotElements.forEach((dotElement, dotIndex) => {
                        dotElement.classList.remove('active');
                        dotElement.setAttribute('data-state', trackerValue[dotIndex] || 'empty');
                    });
                }
            });
        }

        if (messageEvent.data.type === 'vtm:remote_character_updated') {
            if (!charId) return;
            try {
                // localStorage.getItem retrieves the active user's bearer token for authenticated API calls
                const authToken = localStorage.getItem('vtm_auth_token') || localStorage.getItem('vtm_token');
                // fetch queries the latest character record from the server so remote Storyteller unlock/lock or XP grants update live
                const remoteResponse = await fetch(`/api/characters/${charId}`, {
                    headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
                });
                if (remoteResponse.ok) {
                    const remoteCharPayload = await remoteResponse.json();
                    const remoteSheetData = typeof remoteCharPayload.sheet_data === 'string'
                        ? JSON.parse(remoteCharPayload.sheet_data || '{}')
                        : (remoteCharPayload.sheet_data || {});
                    const prevUnlocked = Boolean(currentSheetData.player_base_edit_unlocked);
                    const nextUnlocked = Boolean(remoteSheetData.player_base_edit_unlocked);
                    const mergedBaseStats = {
                        ...(currentSheetData.base_stats || {}),
                        ...(remoteSheetData.base_stats || {})
                    };
                    const mergedXpUpgrades = {
                        ...(currentSheetData.xp_upgrades || {}),
                        ...(remoteSheetData.xp_upgrades || {})
                    };
                    currentSheetData = {
                        ...currentSheetData,
                        ...remoteSheetData,
                        base_stats: mergedBaseStats,
                        xp_upgrades: mergedXpUpgrades,
                        player_base_edit_unlocked: nextUnlocked
                    };
                    if (remoteSheetData.total_experience !== undefined) {
                        currentSheetData.total_experience = remoteSheetData.total_experience;
                        currentSheetData.total = String(remoteSheetData.total_experience);
                    }
                    if (remoteSheetData.spent_experience !== undefined) {
                        currentSheetData.spent_experience = remoteSheetData.spent_experience;
                        currentSheetData.spent = String(remoteSheetData.spent_experience);
                    }
                    if (!Array.isArray(remoteSheetData.hunger) && remoteCharPayload.hunger !== undefined) {
                        const hVal = Math.max(0, Math.min(5, Number(remoteCharPayload.hunger) || 0));
                        currentSheetData.hunger = Array.from({ length: 5 }, (_, i) => i < hVal ? 'filled' : 'empty');
                    }
                    currentSheetData = normalizeSheetData(currentSheetData, remoteCharPayload);
                    document.querySelectorAll('input, textarea, select').forEach(el => {
                        if (!el.id || document.activeElement === el) return;
                        if (currentSheetData[el.id] !== undefined) {
                            if (el.type === 'checkbox') {
                                el.checked = Boolean(currentSheetData[el.id]);
                            } else if (String(el.value) !== String(currentSheetData[el.id])) {
                                el.value = currentSheetData[el.id];
                            }
                        }
                    });
                    syncSquareTrackerDomFromCurrentSheetData();
                    document.querySelectorAll('.dot-group:not(.square-group)').forEach(dotGroupElement => {
                        if (!dotGroupElement.id) return;
                        if (currentSheetData[dotGroupElement.id] !== undefined) {
                            renderCircularDotGroup(dotGroupElement);
                        }
                    });
                    if (remoteCharPayload.concealed_fields !== undefined) {
                        try {
                            const parsedConcealed = typeof remoteCharPayload.concealed_fields === 'string'
                                ? JSON.parse(remoteCharPayload.concealed_fields || '[]')
                                : remoteCharPayload.concealed_fields;
                            if (Array.isArray(parsedConcealed)) {
                                concealedFields = parsedConcealed;
                            }
                        } catch (e) {}
                    }
                    if (remoteCharPayload.hidden_from_user_ids !== undefined) {
                        try {
                            const parsedHidden = typeof remoteCharPayload.hidden_from_user_ids === 'string'
                                ? JSON.parse(remoteCharPayload.hidden_from_user_ids || '[]')
                                : remoteCharPayload.hidden_from_user_ids;
                            window.vtmHiddenFromUserIds = Array.isArray(parsedHidden) ? parsedHidden : [];
                        } catch (e) {
                            window.vtmHiddenFromUserIds = [];
                        }
                    }
                    applyRedaction();
                    if (window.vtmCurrentSheetTabMode === 'privacy' && typeof renderUnifiedPrivacyModeBar === 'function') {
                        renderUnifiedPrivacyModeBar();
                    }
                    refreshAllXpVisuals();
                    if (prevUnlocked !== nextUnlocked) {
                        showSaveState(
                            'saved',
                            nextUnlocked
                                ? '🔓 Storyteller unlocked Base Stat editing for you!'
                                : '🔒 Storyteller locked & snapshotted your Base Stats!'
                        );
                    }
                }
            } catch (remoteSyncError) {
                console.warn('Remote character sync warning:', remoteSyncError);
            }
            return;
        }

        if (messageEvent.data.type === 'vtm:convert_presnapshot_skill') {
            if (!isEffectiveStoryteller() || isReadonly) return;
            const targetSkillKey = String(messageEvent.data.skillKey || '').trim();
            if (!targetSkillKey || !V5_SKILL_KEYS.includes(targetSkillKey)) return;
            ensureBaseStatsSnapshot(currentSheetData, false);
            const currentBaseSkillDots = Number(currentSheetData.base_stats[targetSkillKey] || 0);
            if (currentBaseSkillDots <= 0) return;

            const currentXpSkillDots = Number(currentSheetData.xp_upgrades[targetSkillKey] || 0);
            const newBaseSkillDots = currentBaseSkillDots - 1;
            const newXpSkillDots = currentXpSkillDots + 1;
            const totalSkillDots = newBaseSkillDots + newXpSkillDots;
            const xpCostForDot = newBaseSkillDots === 0 ? 3 : currentBaseSkillDots * 3;
            const prettySkillName = formatStatDisplayName(targetSkillKey, currentSheetData);

            currentSheetData.base_stats[targetSkillKey] = newBaseSkillDots;
            currentSheetData.xp_upgrades[targetSkillKey] = newXpSkillDots;
            currentSheetData[targetSkillKey] = totalSkillDots;

            if (!Array.isArray(currentSheetData.xp_log)) {
                currentSheetData.xp_log = [];
            }
            const alreadyLoggedPurchase = currentSheetData.xp_log.some(
                entry => entry && entry.type === 'purchase' && !entry.refunded && entry.targetId === targetSkillKey && Number(entry.toRating) === totalSkillDots
            );
            if (!alreadyLoggedPurchase) {
                currentSheetData.xp_log.unshift({
                    id: 'xp_buy_converted_' + Date.now() + '_' + targetSkillKey,
                    type: 'purchase',
                    category: 'skill',
                    targetId: targetSkillKey,
                    fromRating: newBaseSkillDots,
                    toRating: totalSkillDots,
                    cost: xpCostForDot,
                    label: `${prettySkillName} (${newBaseSkillDots} → ${totalSkillDots})`,
                    timestamp: new Date().toISOString()
                });
            }

            refreshAllXpVisuals();
            triggerSave(null, true);
            showSaveState('saved', `Converted ${prettySkillName} dot ${currentBaseSkillDots} from Base Stat to Crimson Red XP Upgrade!`);
            return;
        }

        if (messageEvent.data.type === 'vtm:toggle_xp_drawer') {
            isXpDrawerOpen = !isXpDrawerOpen;
            if (isXpDrawerOpen) {
                isPrivacyDrawerOpen = false;
                storytellerSheetMode = 'xp';
                isSpendXpHighlightMode = true;
            } else {
                isSpendXpHighlightMode = false;
            }
            refreshAllXpVisuals();
            return;
        }

        if (messageEvent.data.type === 'vtm:toggle_st_drawer') {
            if (!isEffectiveStoryteller()) return;
            isStDrawerOpen = !isStDrawerOpen;
            if (!isStDrawerOpen && storytellerSheetMode === 'base') {
                storytellerSheetMode = 'xp';
            }
            refreshAllXpVisuals();
            return;
        }

        if (messageEvent.data.type === 'vtm:set_player_preview') {
            isPlayerPreviewOverride = Boolean(messageEvent.data.isPlayerPreview);
            window.isSheetPlayerPreviewActive = isPlayerPreviewOverride;
            if (isPlayerPreviewOverride) {
                isStDrawerOpen = false;
                isPrivacyDrawerOpen = false;
                storytellerSheetMode = 'xp';
            }
            refreshAllXpVisuals();
            applyRedaction();
            return;
        }

        if (messageEvent.data.type === 'vtm:change_template' && messageEvent.data.template) {
            const newTemplateFilename = messageEvent.data.template;
            await triggerSave(newTemplateFilename, true);
            // window.parent.postMessage sends a message to the parent VTT window asking it to reload the iframe with the newly chosen template
            window.parent.postMessage({
                type: 'vtm:reopen_sheet',
                char_id: charId,
                template: newTemplateFilename
            }, '*');
            return;
        }

        if (messageEvent.data.type === 'vtm:sync_sheet') {
            if (messageEvent.data.sheet_data) {
                const incomingSheet = typeof messageEvent.data.sheet_data === 'string'
                    ? JSON.parse(messageEvent.data.sheet_data || '{}')
                    : JSON.parse(JSON.stringify(messageEvent.data.sheet_data));
                currentSheetData = normalizeSheetData({
                    ...currentSheetData,
                    ...incomingSheet,
                    base_stats: { ...(currentSheetData.base_stats || {}), ...(incomingSheet.base_stats || {}) },
                    xp_upgrades: { ...(currentSheetData.xp_upgrades || {}), ...(incomingSheet.xp_upgrades || {}) }
                });
                document.querySelectorAll('input, textarea, select').forEach(el => {
                    if (!el.id || document.activeElement === el) return;
                    if (currentSheetData[el.id] !== undefined) {
                        if (el.type === 'checkbox') {
                            el.checked = Boolean(currentSheetData[el.id]);
                        } else if (String(el.value) !== String(currentSheetData[el.id])) {
                            el.value = currentSheetData[el.id];
                        }
                    }
                });
                syncSquareTrackerDomFromCurrentSheetData();
                document.querySelectorAll('.dot-group:not(.square-group)').forEach(dotGroupElement => {
                    if (!dotGroupElement.id) return;
                    if (currentSheetData[dotGroupElement.id] !== undefined) {
                        renderCircularDotGroup(dotGroupElement);
                    }
                });
                refreshAllXpVisuals();
            }
        }
    });

    // 0. GENERATE DOTS
    // document.querySelectorAll finds all '.dot-group' containers on the sheet so we can populate them with clickable dot divs
    document.querySelectorAll('.dot-group').forEach(dotGroupElement => {
        if (dotGroupElement.children.length > 0 && dotGroupElement.querySelector('.dot')) return; // Already generated
        // getAttribute reads how many dots or squares to generate (defaulting to 5)
        const maxDots = parseInt(dotGroupElement.getAttribute('data-max') || '5');
        const isSquareTracker = dotGroupElement.classList.contains('square-group');
        for (let dotIndex = 0; dotIndex < maxDots; dotIndex++) {
            // document.createElement creates a new HTML <div> element in memory for a single dot or square box
            const dotElement = document.createElement('div');
            dotElement.className = isSquareTracker ? 'dot square' : 'dot';
            // appendChild inserts the newly created dot <div> into the dot group container in the DOM
            dotGroupElement.appendChild(dotElement);
        }
    });

    // 0b. INJECT M / B / F CATEGORY BADGES ON STANDARD 2-PAGE ADVANTAGES & FLAWS ROWS
    for (let rowNumber = 1; rowNumber <= 9; rowNumber++) {
        // document.getElementById locates the Advantage/Flaw name text input for this row
        const advantageInput = document.getElementById('adv_flaw_name_' + rowNumber);
        // document.getElementById checks whether the category badge has already been created for this row
        if (advantageInput && advantageInput.parentElement && !document.getElementById('adv_flaw_type_' + rowNumber)) {
            // document.createElement creates a clickable <span> badge to show Merit (M), Background (B), or Flaw (F)
            const categoryBadgeElement = document.createElement('span');
            categoryBadgeElement.id = 'adv_flaw_type_' + rowNumber;
            categoryBadgeElement.className = 'adv-type-badge adv-badge-empty';
            categoryBadgeElement.setAttribute('data-adv-type', 'merit');
            categoryBadgeElement.textContent = 'M';
            categoryBadgeElement.title = 'Category: Merit (click to cycle Merit / Background / Flaw for cross-sheet sync)';
            // insertBefore places the badge element right before the text input inside its parent container
            advantageInput.parentElement.insertBefore(categoryBadgeElement, advantageInput);

            // addEventListener attaches a click handler to cycle the badge between Merit, Background, and Flaw
            categoryBadgeElement.addEventListener('click', (clickEvent) => {
                // stopPropagation prevents the click event from bubbling up to parent elements
                clickEvent.stopPropagation();
                if (isReadonly) return;
                const categoryRotationOrder = ['merit', 'background', 'flaw'];
                const categoryBadgeLabels = { merit: 'M', background: 'B', flaw: 'F' };
                const categoryBadgeTitles = {
                    merit: 'Category: Merit (click to cycle Merit / Background / Flaw)',
                    background: 'Category: Background (click to cycle Merit / Background / Flaw)',
                    flaw: 'Category: Flaw (click to cycle Merit / Background / Flaw)'
                };
                const currentCategory = categoryBadgeElement.getAttribute('data-adv-type') || 'merit';
                const nextCategory = categoryRotationOrder[(categoryRotationOrder.indexOf(currentCategory) + 1) % categoryRotationOrder.length];
                categoryBadgeElement.setAttribute('data-adv-type', nextCategory);
                categoryBadgeElement.textContent = categoryBadgeLabels[nextCategory];
                categoryBadgeElement.title = categoryBadgeTitles[nextCategory];
                categoryBadgeElement.setAttribute('data-manual-override', 'true');
                categoryBadgeElement.classList.toggle('adv-badge-empty', !advantageInput.value.trim());
                triggerSave();
            });

            // addEventListener listens for typing in the Advantage/Flaw name input to auto-detect its M/B/F category
            advantageInput.addEventListener('input', () => {
                categoryBadgeElement.classList.toggle('adv-badge-empty', !advantageInput.value.trim());
                if (categoryBadgeElement.getAttribute('data-manual-override') === 'true') return;
                const inferredCategory = detectAdvantageCategory(advantageInput.value);
                const categoryBadgeLabels = { merit: 'M', background: 'B', flaw: 'F' };
                categoryBadgeElement.setAttribute('data-adv-type', inferredCategory);
                categoryBadgeElement.textContent = categoryBadgeLabels[inferredCategory];
            });
        }
    }

    // --- BEGIN DISCIPLINE IDS ---
    // document.querySelectorAll grabs all section header elements so we can locate the Disciplines section
    let disciplineHeaderElements = document.querySelectorAll('.section-header, .alt-header');
    let disciplineSectionHeader = Array.from(disciplineHeaderElements).find(headerElement => headerElement.textContent.toLowerCase().includes('disciplines'));
    if (disciplineSectionHeader) {
        let disciplineGridElement = disciplineSectionHeader.nextElementSibling;
        if (disciplineGridElement) {
            // querySelectorAll finds all discipline header rows inside the Disciplines grid
            let disciplineHeaderRows = disciplineGridElement.querySelectorAll('.dot-row');
            disciplineHeaderRows.forEach((disciplineDotRow, disciplineIndex) => {
                // querySelector finds the text input for the Discipline's name and the dot-group for its level
                let disciplineNameInput = disciplineDotRow.querySelector('input');
                let disciplineDotsGroup = disciplineDotRow.querySelector('.dot-group');
                if (disciplineNameInput && (!disciplineNameInput.id || !disciplineNameInput.id.startsWith('discipline_name_'))) {
                    disciplineNameInput.id = 'discipline_name_' + disciplineIndex;
                }
                if (disciplineDotsGroup && (!disciplineDotsGroup.id || !disciplineDotsGroup.id.startsWith('discipline_dots_'))) {
                    disciplineDotsGroup.id = 'discipline_dots_' + disciplineIndex;
                }
                // querySelectorAll finds the 5 power text inputs belonging to this Discipline block
                let powerInputElements = disciplineDotRow.parentElement.querySelectorAll('.input-line input');
                powerInputElements.forEach((powerInputElement, powerIndex) => {
                    if (!powerInputElement.id || !powerInputElement.id.startsWith('discipline_power_')) {
                        powerInputElement.id = 'discipline_power_' + disciplineIndex + '_' + powerIndex;
                    }
                });
            });
        }
    }
    // --- END DISCIPLINE IDS ---



    // document.querySelectorAll selects every form control on the character sheet to assign deterministic IDs and save listeners
    document.querySelectorAll('input, textarea, select').forEach((formControlElement, controlIndex) => {
        if (!formControlElement.id || formControlElement.id.startsWith('input_field')) {
            let parentContainer = formControlElement.parentElement;
            let labelText = '';
            // querySelector searches the parent element for a label or header describing this input field
            let labelElement = parentContainer.querySelector('label, span, .box-header, .box-label, .section-header, .alt-header');
            if (labelElement) {
                labelText = labelElement.textContent.trim();
            } else {
                let previousSiblingElement = formControlElement.previousElementSibling;
                if (previousSiblingElement && (previousSiblingElement.tagName === 'LABEL' || previousSiblingElement.tagName === 'SPAN' || previousSiblingElement.classList.contains('box-header') || previousSiblingElement.classList.contains('section-header') || previousSiblingElement.classList.contains('alt-header'))) {
                    labelText = previousSiblingElement.textContent.trim();
                } else {
                    // Check if it's the hunting roll input in the ALT sheet
                    let parentPreviousSibling = parentContainer.previousElementSibling;
                    if (parentPreviousSibling && parentPreviousSibling.classList.contains('alt-header')) {
                        labelText = parentPreviousSibling.textContent.trim();
                    } else {
                        labelText = 'field_' + controlIndex;
                    }
                }
            }
        
            let baseFieldId = labelText.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_');
            if (formControlElement.classList.contains('line-fill') && parentContainer.querySelector('.dot-group')) {
                baseFieldId += '_specialty';
            }
            if (!baseFieldId) baseFieldId = 'input_field';
            
            let uniqueFieldId = baseFieldId;
            let duplicateCounter = 1;
            // document.getElementById checks if another element already uses this ID so we can append a number to keep IDs unique
            while (document.getElementById(uniqueFieldId) && document.getElementById(uniqueFieldId) !== formControlElement) {
                uniqueFieldId = baseFieldId + '_' + duplicateCounter;
                duplicateCounter++;
            }
            formControlElement.id = uniqueFieldId;
        } // Close if(!formControlElement.id...) block
        
        if (
            formControlElement.id === 'total_experience' ||
            formControlElement.id === 'spent_experience' ||
            formControlElement.id === 'total' ||
            formControlElement.id === 'spent'
        ) {
            formControlElement.readOnly = true;
            formControlElement.setAttribute('readonly', 'readonly');
            formControlElement.style.cursor = 'not-allowed';
            formControlElement.addEventListener('keydown', (e) => e.preventDefault());
            formControlElement.addEventListener('paste', (e) => e.preventDefault());
            return;
        }

        if (isReadonly) {
            if (formControlElement.type === 'checkbox' || formControlElement.tagName === 'SELECT') formControlElement.disabled = true;
            else formControlElement.readOnly = true;
        }
        // addEventListener binds an 'input' listener so typing into any field auto-saves the sheet
        formControlElement.addEventListener('input', () => {
            const advantageNameMatch = formControlElement.id && formControlElement.id.match(/^(merit|background|flaw|adv_flaw)_name_(\d+)$/);
            if (advantageNameMatch && !formControlElement.value.trim()) {
                // document.getElementById finds the corresponding dot-rating group when an advantage name is cleared
                const correspondingRatingGroup = document.getElementById(`${advantageNameMatch[1]}_rating_${advantageNameMatch[2]}`);
                if (correspondingRatingGroup) {
                    // querySelectorAll finds all filled dots in that row and clears them when the text is erased
                    correspondingRatingGroup.querySelectorAll('.dot.active').forEach(activeDotElement => activeDotElement.classList.remove('active'));
                }
            }
            triggerSave();
        });
        if (formControlElement.type === 'checkbox' || formControlElement.tagName === 'SELECT') {
            // addEventListener triggers a save whenever a dropdown selection or checkbox state changes
            formControlElement.addEventListener('change', () => triggerSave());
        }
    });


    // 3. Base ID for dot-groups
    // document.querySelectorAll iterates over all dot/square tracker groups to ensure each has a unique ID and click handler
    document.querySelectorAll('.dot-group').forEach((dotGroupElement, groupIndex) => {
        if (!dotGroupElement.id || dotGroupElement.id.startsWith('group_') || dotGroupElement.id.startsWith('dot_group')) {
            let parentContainer = dotGroupElement.parentElement;
            let labelText = '';
            // querySelector looks for a nearby label element inside the same row/container
            let labelElement = parentContainer.querySelector('label, span, .box-header, .box-label, .section-header, .alt-header, .inline-label');
            if (labelElement) {
                labelText = labelElement.textContent.trim();
            } else {
                let parentPreviousSibling = parentContainer.previousElementSibling;
                while (parentPreviousSibling && !labelText) {
                    if (parentPreviousSibling.classList && (parentPreviousSibling.classList.contains('section-header') || parentPreviousSibling.classList.contains('alt-header') || parentPreviousSibling.classList.contains('box-header'))) {
                        labelText = parentPreviousSibling.textContent.trim();
                    } else if (parentPreviousSibling.querySelector && parentPreviousSibling.querySelector('label, span, .section-header')) {
                        let innerLabelElement = parentPreviousSibling.querySelector('label, span, .section-header');
                        labelText = innerLabelElement.textContent.trim();
                    }
                    parentPreviousSibling = parentPreviousSibling.previousElementSibling;
                }
                if (!labelText) {
                    let previousSiblingElement = dotGroupElement.previousElementSibling;
                    if (previousSiblingElement && (previousSiblingElement.tagName === 'LABEL' || previousSiblingElement.tagName === 'SPAN' || previousSiblingElement.classList.contains('box-header') || previousSiblingElement.classList.contains('section-header') || previousSiblingElement.classList.contains('alt-header') || previousSiblingElement.classList.contains('inline-label'))) {
                        labelText = previousSiblingElement.textContent.trim();
                    } else {
                        labelText = 'group_' + groupIndex;
                    }
                }
            }
        
            let baseGroupId = labelText.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_');
            if (!baseGroupId) baseGroupId = 'dot_group';
            
            let uniqueGroupId = baseGroupId;
            let duplicateCounter = 1;
            // document.getElementById checks if another element already has this ID
            while (document.getElementById(uniqueGroupId) && document.getElementById(uniqueGroupId) !== dotGroupElement) {
                uniqueGroupId = baseGroupId + '_' + duplicateCounter;
                duplicateCounter++;
            }
            dotGroupElement.id = uniqueGroupId;
        } // Close the if (!dotGroupElement.id...) block
        
        // Setup click logic for trackers (Health, Willpower, Humanity)
        if (dotGroupElement.classList.contains('square-group')) {
            // Inject arrows if they don't exist
            if (!dotGroupElement.querySelector('.tracker-arrow')) {
                // document.createElement creates the left arrow button for decreasing rating/capacity
                const leftArrowElement = document.createElement('span');
                leftArrowElement.className = 'tracker-arrow left-arrow';
                leftArrowElement.innerHTML = '&#9664;';
                leftArrowElement.style.cursor = 'pointer';
                leftArrowElement.style.marginRight = '5px';
                leftArrowElement.style.userSelect = 'none';
                
                // document.createElement creates the right arrow button for increasing rating/capacity
                const rightArrowElement = document.createElement('span');
                rightArrowElement.className = 'tracker-arrow right-arrow';
                rightArrowElement.innerHTML = '&#9654;';
                rightArrowElement.style.cursor = 'pointer';
                rightArrowElement.style.marginLeft = '5px';
                rightArrowElement.style.userSelect = 'none';
                
                // insertBefore and appendChild place the left and right arrows at the start and end of the square tracker
                dotGroupElement.insertBefore(leftArrowElement, dotGroupElement.firstChild);
                dotGroupElement.appendChild(rightArrowElement);
                
                /**
                 * Event listener for the left arrow on square-group trackers (e.g., Health, Willpower, Humanity).
                 * 
                 * Clicking the left arrow decreases the tracker's current value. Depending on the tracker type:
                 * - For rating trackers (Hunger, Humanity), it removes the right-most 'filled' state.
                 * - For capacity trackers, it decreases the usable capacity by adding a 'filled' black cap box to the right.
                 * 
                 * @param {MouseEvent} clickEvent - The click event on the left arrow.
                 */
                // addEventListener attaches the click handler to the left tracker arrow
                leftArrowElement.addEventListener('click', (clickEvent) => {
                    clickEvent.stopPropagation();
                    if (isReadonly) return;
                    // querySelectorAll gets all square boxes in this tracker
                    const squareElements = Array.from(dotGroupElement.querySelectorAll('.dot.square'));
                    let boxStates = squareElements.map(squareElement => squareElement.getAttribute('data-state') || 'empty');
                    
                    if (dotGroupElement.id === 'hunger' || dotGroupElement.id === 'humanity' || dotGroupElement.id === 'humanity_states') {
                        // Rating Tracker: Decrease rating (Remove right-most 'filled')
                        let lastFilledBoxIndex = boxStates.lastIndexOf('filled');
                        if (lastFilledBoxIndex !== -1) {
                            squareElements[lastFilledBoxIndex].setAttribute('data-state', 'empty');
                            triggerSave(null, true);
                        }
                    } else {
                        // Capacity Tracker: Decrease capacity (Add 'filled' black box to the right-most usable box)
                        let currentBlackCapCount = boxStates.filter(boxState => boxState === 'filled').length;
                        if (currentBlackCapCount < squareElements.length - 1) {
                            const targetBoxIndex = squareElements.length - currentBlackCapCount - 1;
                            squareElements[targetBoxIndex].setAttribute('data-state', 'filled');
                            triggerSave(null, true);
                        }
                    }
                });
                
                /**
                 * Event listener for the right arrow on square-group trackers.
                 * 
                 * Clicking the right arrow increases the tracker's current value. Depending on the tracker type:
                 * - For rating trackers (Hunger, Humanity), it changes the left-most 'empty' box to 'filled'.
                 * - For capacity trackers, it increases the usable capacity by removing the left-most 'filled' black cap box.
                 * 
                 * @param {MouseEvent} clickEvent - The click event on the right arrow.
                 */
                // addEventListener attaches the click handler to the right tracker arrow
                rightArrowElement.addEventListener('click', (clickEvent) => {
                    clickEvent.stopPropagation();
                    if (isReadonly) return;
                    // querySelectorAll gets all square boxes in this tracker
                    const squareElements = Array.from(dotGroupElement.querySelectorAll('.dot.square'));
                    let boxStates = squareElements.map(squareElement => squareElement.getAttribute('data-state') || 'empty');
                    
                    if (dotGroupElement.id === 'hunger' || dotGroupElement.id === 'humanity' || dotGroupElement.id === 'humanity_states') {
                        // Rating Tracker: Increase rating (Add 'filled' to left-most 'empty')
                        let firstEmptyBoxIndex = boxStates.indexOf('empty');
                        if (firstEmptyBoxIndex !== -1) {
                            squareElements[firstEmptyBoxIndex].setAttribute('data-state', 'filled');
                            triggerSave(null, true);
                        }
                    } else {
                        // Capacity Tracker: Increase capacity (Remove left-most 'filled' black box)
                        let currentBlackCapCount = boxStates.filter(boxState => boxState === 'filled').length;
                        if (currentBlackCapCount > 0) {
                            const targetBoxIndex = squareElements.length - currentBlackCapCount;
                            squareElements[targetBoxIndex].setAttribute('data-state', 'empty');
                            triggerSave(null, true);
                        }
                    }
                });
            }
            
            /**
             * Event listener for clicking on individual squares in a tracker group.
             * 
             * This function handles the complex state toggling for damage/usage in trackers.
             * - For Hunger, it sets all squares up to the clicked one to 'filled' and the rest to 'empty'.
             * - For others (Health, Willpower), it toggles through states: 'empty' -> 'superficial' -> 'aggravated' -> base state.
             * Humanity is a special case that only uses superficial ('stains') and ignores aggravated.
             * 
             * @param {MouseEvent} clickEvent - The click event on the group.
             */
            // addEventListener handles clicks on individual square boxes inside the tracker
            dotGroupElement.addEventListener('click', (clickEvent) => {
                if (clickEvent.target.classList.contains('square')) {
                    if (isReadonly) return;
                    
                    if (dotGroupElement.id === 'hunger') {
                        // querySelectorAll retrieves all square boxes inside the Hunger tracker
                        const hungerBoxElements = Array.from(dotGroupElement.querySelectorAll('.dot'));
                        const clickedBoxIndex = hungerBoxElements.indexOf(clickEvent.target);
                        const boxStates = hungerBoxElements.map(boxElement => boxElement.getAttribute('data-state') || 'empty');
                        const currentFilledCount = boxStates.filter(boxState => boxState === 'filled').length;
                        
                        let newHungerRating = clickedBoxIndex + 1;
                        if (boxStates[clickedBoxIndex] === 'filled' && clickedBoxIndex === currentFilledCount - 1) {
                            newHungerRating = clickedBoxIndex;
                        }
                        
                        hungerBoxElements.forEach((boxElement, boxIndex) => {
                            boxElement.setAttribute('data-state', boxIndex < newHungerRating ? 'filled' : 'empty');
                        });
                        triggerSave(null, true);
                        return;
                    }

                    
                    const currentBoxState = clickEvent.target.getAttribute('data-state') || 'empty';
                    
                    // Capacity & Rating Trackers: 'filled' boxes are un-clickable for damage/stains
                    if (currentBoxState === 'filled') return;

                    if (currentBoxState === 'empty') {
                        clickEvent.target.setAttribute('data-state', 'superficial');
                    } else if (currentBoxState === 'superficial') {
                        if (dotGroupElement.id === 'humanity' || dotGroupElement.id === 'humanity_states') {
                            clickEvent.target.setAttribute('data-state', 'empty'); // Humanity only uses Stains (/)
                        } else {
                            clickEvent.target.setAttribute('data-state', 'aggravated');
                        }
                    } else {
                        clickEvent.target.setAttribute('data-state', 'empty');
                    }
                    
                    // removeAttribute cleans up any legacy 'data-base-state' attribute on the clicked square
                    clickEvent.target.removeAttribute('data-base-state'); // Cleanup any stale attributes
                    
                    triggerSave(null, true);
                }
            });
        } else {
            // Setup click logic for circular rating dot groups (Attributes, Skills, Disciplines, Advantages, Blood Potency)
            /**
             * Event listener for clicking on circular rating dot groups.
             *
             * - In Storyteller 'base' mode: Modifies permanent Black Base Dots (`base_stats[groupId]`) directly at 0 XP cost.
             * - In 'xp' mode (Default for Players & Storytellers):
             *   - Clicking an empty dot above current rating adds the upgrade to `pendingXpCart` (Pulsing Crimson Cart Dots).
             *   - Clicking a pulsing cart dot adjusts or removes the pending item from `pendingXpCart`.
             *   - Clicking a committed Crimson Red XP dot (`xp-dot`) as Storyteller prompts to refund the XP to the player;
             *     clicking as a Player notifies them that only the Storyteller can refund committed XP.
             *   - Clicking a Black Base dot (`base-dot`) notifies that Base Stats are locked.
             *
             * @param {MouseEvent} clickEvent - The click event on the circular dot group.
             */
            // addEventListener handles clicking a circular rating dot (Attributes, Skills, Disciplines, Advantages, Blood Potency)
            dotGroupElement.addEventListener('click', (clickEvent) => {
                if (isReadonly) return;
                if (!clickEvent.target.classList.contains('dot')) return;

                const groupId = dotGroupElement.id;
                // querySelectorAll retrieves all circular dots in this rating group
                const dotElements = Array.from(dotGroupElement.querySelectorAll('.dot'));
                const clickedDotIndex = dotElements.indexOf(clickEvent.target);
                const clickedLevelNumber = clickedDotIndex + 1;

                ensureBaseStatsSnapshot(currentSheetData, false);
                const currentBaseDots = Number(currentSheetData.base_stats[groupId] || 0);
                const currentXpDots = Number(currentSheetData.xp_upgrades[groupId] || 0);
                const committedTotalRating = currentBaseDots + currentXpDots;
                const statDisplayName = formatStatDisplayName(groupId, currentSheetData);

                const effectiveSt = isEffectiveStoryteller();

                // --- MODE 1: STORYTELLER EDIT BASE STATS OR STORYTELLER-UNLOCKED PLAYER BASE STAT EDITING (BLACK DOTS) ---
                if ((effectiveSt && storytellerSheetMode === 'base') || isPlayerBaseEditUnlocked()) {
                    let newBaseDotCount = clickedLevelNumber;
                    if (clickedLevelNumber === currentBaseDots) {
                        newBaseDotCount = Math.max(0, currentBaseDots - 1);
                    }
                    currentSheetData.base_stats[groupId] = newBaseDotCount;
                    currentSheetData[groupId] = newBaseDotCount + currentXpDots;

                    if (groupId === 'blood_potency') {
                        applyBloodPotencyTable(currentSheetData[groupId]);
                    }
                    if (groupId === 'stamina' || groupId === 'composure' || groupId === 'resolve') {
                        syncDerivedTrackerCapacitiesOnAttributeChange(groupId);
                    }
                    refreshAllXpVisuals();
                    triggerSave();
                    return;
                }

                // --- MODE 2: FLAWS (Flaw dots do not cost XP; allow editing in Base Mode or if row is Flaw) ---
                const isFlawRow = groupId.startsWith('flaw_rating_') || groupId.startsWith('haven_flaw_rating_') || (
                    groupId.startsWith('adv_flaw_rating_') &&
                    // document.getElementById checks if the Standard 2-Page row badge is set to 'flaw'
                    document.getElementById(groupId.replace('adv_flaw_rating_', 'adv_flaw_type_'))?.getAttribute('data-adv-type') === 'flaw'
                );
                if (isFlawRow) {
                    if (!effectiveSt && !isPlayerBaseEditUnlocked() && currentBaseDots > 0 && clickedLevelNumber <= currentBaseDots) {
                        showSaveState('error', 'Base Flaws are locked. Ask your Storyteller to modify Flaws.');
                        return;
                    }
                    let newFlawRating = clickedLevelNumber === currentBaseDots ? Math.max(0, currentBaseDots - 1) : clickedLevelNumber;
                    currentSheetData.base_stats[groupId] = newFlawRating;
                    currentSheetData[groupId] = newFlawRating;
                    refreshAllXpVisuals();
                    triggerSave();
                    return;
                }

                // --- MODE 3: XP ADVANCEMENT & STORYTELLER REFUND MODE (CRIMSON RED DOTS) ---
                const existingCartItemIndex = pendingXpCart.findIndex(cartItem => cartItem.type === 'dot' && cartItem.targetId === groupId);
                const existingCartItem = existingCartItemIndex !== -1 ? pendingXpCart[existingCartItemIndex] : null;

                // Subcase A: Clicked inside the Black Base Dots
                if (clickedLevelNumber <= currentBaseDots) {
                    if (effectiveSt) {
                        showSaveState('error', `Base Stat (${statDisplayName} ${currentBaseDots}). Use 'Storyteller & Settings' → 'Edit Base Dots' or 'Unlock Base Dots for Player' to modify black dots.`);
                    } else {
                        showSaveState('error', `${statDisplayName} ${currentBaseDots} is a locked Base Stat. Ask your Storyteller to unlock Base Stat editing if you need to change it.`);
                    }
                    return;
                }

                // Subcase B: Clicked inside Committed Crimson Red XP Dots
                if (clickedLevelNumber <= committedTotalRating) {
                    if (!effectiveSt) {
                        showSaveState('error', `${statDisplayName} ${clickedLevelNumber} was purchased with XP. Only the Storyteller can refund committed XP.`);
                        return;
                    }
                    // Storyteller Refund Flow: refund from committedTotalRating down to (clickedLevelNumber - 1)
                    const newRatingAfterRefund = clickedLevelNumber - 1;
                    const refundCostCalculation = calculateV5DotUpgradeCost(groupId, newRatingAfterRefund, committedTotalRating, currentSheetData);
                    const refundXpAmount = refundCostCalculation.totalCost;

                    // window.confirm asks the Storyteller to confirm refunding the committed XP dot(s)
                    const confirmedRefund = window.confirm(
                        `STORYTELLER XP REFUND\n\nRefund ${statDisplayName} from ${committedTotalRating} down to ${newRatingAfterRefund} and return ${refundXpAmount} XP to this character?`
                    );
                    if (!confirmedRefund) return;

                    // Remove any pending cart item for this stat as well
                    if (existingCartItemIndex !== -1) {
                        pendingXpCart.splice(existingCartItemIndex, 1);
                    }

                    currentSheetData.xp_upgrades[groupId] = Math.max(0, newRatingAfterRefund - currentBaseDots);
                    currentSheetData[groupId] = newRatingAfterRefund;

                    const previousSpentXp = Number(currentSheetData.spent_experience || currentSheetData.spent || 0);
                    const updatedSpentXp = Math.max(0, previousSpentXp - refundXpAmount);
                    currentSheetData.spent_experience = String(updatedSpentXp);
                    currentSheetData.spent = String(updatedSpentXp);

                    currentSheetData.xp_log.unshift({
                        id: 'xp_refund_' + Date.now() + '_' + groupId,
                        type: 'refund',
                        category: refundCostCalculation.category,
                        targetId: groupId,
                        label: `Refunded ${statDisplayName} (${committedTotalRating} → ${newRatingAfterRefund})`,
                        fromRating: committedTotalRating,
                        toRating: newRatingAfterRefund,
                        cost: -refundXpAmount,
                        timestamp: new Date().toISOString()
                    });

                    if (groupId === 'blood_potency') {
                        applyBloodPotencyTable(newRatingAfterRefund);
                    }
                    if (groupId === 'stamina' || groupId === 'composure' || groupId === 'resolve') {
                        syncDerivedTrackerCapacitiesOnAttributeChange(groupId);
                    }

                    refreshAllXpVisuals();
                    triggerSave(null, true);
                    return;
                }

                // Subcase C: Clicked on a Pending Cart Dot or an Empty Dot above committedTotalRating
                if (existingCartItem && clickedLevelNumber === existingCartItem.toRating) {
                    // Clicking the highest pending cart dot removes it from the cart
                    pendingXpCart.splice(existingCartItemIndex, 1);
                    refreshAllXpVisuals();
                    return;
                }

                const upgradeCalculation = calculateV5DotUpgradeCost(groupId, committedTotalRating, clickedLevelNumber, currentSheetData);
                const totalAwardedXp = Number(currentSheetData.total_experience || currentSheetData.total || 0);
                const alreadySpentXp = Number(currentSheetData.spent_experience || currentSheetData.spent || 0);
                const otherCartItemsCost = pendingXpCart.reduce((sum, item, itemIndex) => {
                    return itemIndex === existingCartItemIndex ? sum : sum + Number(item.cost || 0);
                }, 0);
                const availableXpForThisStat = totalAwardedXp - alreadySpentXp - otherCartItemsCost;

                if (upgradeCalculation.totalCost > availableXpForThisStat) {
                    showSaveState(
                        'error',
                        `Not enough XP! ${statDisplayName} (${committedTotalRating} → ${clickedLevelNumber}) costs ${upgradeCalculation.totalCost} XP (${availableXpForThisStat} XP available).`
                    );
                    return;
                }

                const newCartEntry = {
                    id: 'cart_' + groupId,
                    type: 'dot',
                    category: upgradeCalculation.category,
                    targetId: groupId,
                    label: `${statDisplayName}: ${committedTotalRating} → ${clickedLevelNumber}`,
                    breakdown: upgradeCalculation.breakdown,
                    fromRating: committedTotalRating,
                    toRating: clickedLevelNumber,
                    cost: upgradeCalculation.totalCost
                };

                if (existingCartItemIndex !== -1) {
                    pendingXpCart[existingCartItemIndex] = newCartEntry;
                } else {
                    pendingXpCart.push(newCartEntry);
                }

                refreshAllXpVisuals();
            });
        }
    });

    // 4. Inject Hidden-by-Default Top Drawers (Player Experience Drawer, Storyteller Sheet Tools Drawer, Pending XP Cart Bar, and Modals)
    // document.createElement creates the sticky top dock container; it is hidden by default so the parchment sheet has zero clutter when opened!
    const xpSystemUiContainer = document.createElement('div');
    xpSystemUiContainer.id = 'xp-sheet-top-dock';
    xpSystemUiContainer.style.cssText = 'position:sticky; top:0; z-index:9998; width:100%; max-width:850px; margin:0 auto; font-family:sans-serif; display:flex; flex-direction:column; gap:8px;';
    xpSystemUiContainer.innerHTML = `
        <!-- Standalone Fallback Bar (Only shown if the sheet URL is opened directly in a browser tab outside the VTT modal) -->
        <div id="xp-standalone-fallback-bar" style="display:none; background:rgba(18,22,31,0.97); padding:6px 12px; border-radius:8px; border:1px solid #450a0a; align-items:center; justify-content:space-between; gap:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <button type="button" id="btn-standalone-xp-toggle" style="background:#991b1b; color:#fff; border:1px solid #f87171; padding:4px 10px; border-radius:5px; font-size:12px; font-weight:bold; cursor:pointer;">
                    ✨ Experience
                </button>
                <button type="button" id="btn-standalone-st-toggle" style="display:none; background:#78350f; color:#fde68a; border:1px solid #d97706; padding:4px 10px; border-radius:5px; font-size:12px; font-weight:bold; cursor:pointer;">
                    👑 ST Sheet Tools
                </button>
            </div>
            <div style="display:flex; align-items:center; gap:6px;">
                <label style="color:#9ca3af; font-size:11px; font-weight:bold;">Layout:</label>
                <select id="sheetTemplateSelect" style="background:#140e11; color:#ef4444; border:1px solid #372128; padding:3px 8px; border-radius:4px; font-weight:bold; font-size:12px; outline:none; cursor:pointer;">
                    <option value="V5-Character-Sheet.html">Standard 2-Page</option>
                    <option value="V5-Character-Sheet-ALT.html">Alternative 2-Page</option>
                    <option value="V5-Character-Sheet-4pg.html">Expanded 4-Page</option>
                </select>
            </div>
        </div>

        <!-- 1. PLAYER EXPERIENCE DRAWER (Hidden by default; slides open when clicking '✨ Experience' in the window header) -->
        <div id="xp-player-drawer" style="display:none; background:linear-gradient(135deg, #064e3b 0%, #111827 100%); color:#ecfdf5; padding:10px 14px; border-radius:8px; border:1px solid #10b981; box-shadow:0 6px 16px rgba(0,0,0,0.65); font-size:12px; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:260px; flex-wrap:wrap;">
                <!-- XP Pool Pill -->
                <div style="background:rgba(0,0,0,0.45); border:1px solid rgba(255,255,255,0.18); padding:5px 10px; border-radius:5px; color:#f3f4f6; font-size:12px; font-weight:bold; display:flex; align-items:center; gap:6px; white-space:nowrap;">
                    <span style="color:#6ee7b7;">✨ XP:</span>
                    <span id="xp-avail-badge" style="color:#34d399;">0 Available</span>
                    <span style="color:#d1d5db; font-weight:normal;">(<span id="xp-spent-badge">0</span> Spent / <span id="xp-total-badge">0</span> Total)</span>
                </div>
                <!-- Guided 1-Line Instruction -->
                <div id="xp-guided-spend-text" style="line-height:1.4; flex:1; min-width:200px;"></div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <button type="button" id="btn-banner-open-specialties" style="background:#047857; color:#fff; border:1px solid #34d399; padding:6px 11px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;" title="Buy a Skill Specialty (3 XP), Blood Sorcery Ritual, or Thin-Blood Formula">
                    + Buy Specialty / Ritual
                </button>
                <button type="button" id="btn-open-xp-modal" style="background:#1f2937; color:#e5e7eb; border:1px solid #4b5563; padding:6px 11px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;" title="View Experience Point Award & Purchase History">
                    📜 XP History
                </button>
                <button type="button" id="btn-banner-close-spend-mode" style="background:rgba(0,0,0,0.4); color:#d1fae5; border:1px solid #059669; padding:6px 10px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;" title="Close Experience Bar and turn off green dot highlights">
                    ✖ Close
                </button>
            </div>
        </div>

        <!-- 2. STORYTELLER SHEET TOOLS DRAWER (Hidden by default; slides open when Storyteller clicks '👑 ST Sheet Tools' in the window header) -->
        <div id="xp-st-drawer" style="display:none; background:linear-gradient(135deg, #3b1704 0%, #18181b 100%); color:#fef3c7; padding:10px 14px; border-radius:8px; border:1px solid #d97706; box-shadow:0 6px 16px rgba(0,0,0,0.65); font-size:12px; flex-direction:column; gap:10px;">
            <!-- Top Row: Storyteller Mode & Compliance Tools -->
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; border-bottom:1px solid rgba(217,119,6,0.28); padding-bottom:8px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="font-weight:bold; color:#fde68a; font-size:12px;">👑 Storyteller Sheet Tools:</span>
                    <button type="button" id="btn-v5-compliance-badge" style="background:#064e3b; color:#a7f3d0; border:1px solid #059669; padding:5px 10px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;" title="Inspect V5 Character Creation Base Stat Compliance">
                        ✅ V5 Base Compliant
                    </button>
                    <button type="button" id="btn-st-toggle-mode" style="background:#1e293b; color:#f8fafc; border:1px solid #475569; padding:5px 10px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;" title="Switch to Edit Base Dots mode to freely add or remove permanent starting Black Creation Dots (0 XP)">
                        🛠️ Edit Base Dots (Black)
                    </button>
                    <button type="button" id="btn-st-open-refund-log" style="background:#1f2937; color:#e5e7eb; border:1px solid #4b5563; padding:5px 10px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;" title="Open XP History Log to review or refund player purchases">
                        📜 XP Log & Refunds
                    </button>
                </div>
                <button type="button" id="btn-st-close-drawer" style="background:rgba(0,0,0,0.35); color:#fde68a; border:1px solid #b45309; padding:4px 9px; border-radius:4px; font-size:11px; cursor:pointer;">
                    ✖ Close
                </button>
            </div>

            <!-- Second Row: Give or Remove XP -->
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <span style="font-weight:bold; color:#fcd34d; font-size:12px; white-space:nowrap;" title="Enter a positive number (e.g. 3) to award XP, or a negative number (e.g. -2) to remove XP">⭐ Give / Remove XP:</span>
                <input type="number" id="st-inline-xp-amount" value="3" step="1" style="width:65px; background:#18181b; color:#fff; border:1px solid #d97706; padding:5px 8px; border-radius:4px; font-size:13px; font-weight:bold;" title="Positive number = Award XP, Negative number = Remove XP">
                <select id="st-inline-xp-target" style="background:#18181b; color:#fde68a; border:1px solid #d97706; padding:5px 8px; border-radius:4px; font-size:12px;">
                    <option value="character">This Character Only</option>
                    <option value="campaign">All Campaign PCs (Episode XP)</option>
                </select>
                <input type="text" id="st-inline-xp-reason" placeholder="Reason (e.g. Episode 4 XP / Roleplay Bonus / Correction)" style="flex:1; min-width:190px; background:#18181b; color:#fff; border:1px solid #78350f; padding:5px 8px; border-radius:4px; font-size:12px;">
                <button type="button" id="btn-st-inline-apply-xp" style="background:#d97706; color:#18181b; border:none; padding:6px 14px; border-radius:4px; font-weight:bold; font-size:12px; cursor:pointer; white-space:nowrap;">
                    ✔ Apply XP
                </button>
            </div>
        </div>

        <!-- Storyteller / Player Base Stat Edit Mode Active Banner -->
        <div id="st-base-mode-banner" style="display:none; background:linear-gradient(135deg, #1e3a8a 0%, #172554 100%); color:#eff6ff; padding:9px 14px; border-radius:8px; border:1px solid #60a5fa; box-shadow:0 4px 12px rgba(0,0,0,0.5); font-size:12px; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
            <div id="st-base-mode-banner-text" style="line-height:1.45; flex:1;">
                <strong>🛠️ Editing Starting Base Dots (Black):</strong> Click any circular dot on the sheet below to freely add or remove permanent <strong>Black Starting Creation Dots</strong> (costs 0 XP).
            </div>
            <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                <button type="button" id="btn-st-banner-toggle-player-unlock" style="display:none; background:#b45309; color:#fffbeb; border:1px solid #fbbf24; padding:5px 12px; border-radius:5px; font-size:12px; font-weight:bold; cursor:pointer; white-space:nowrap;">
                    🔓 Unlock for Player Too
                </button>
                <button type="button" id="btn-st-exit-base-mode" style="background:#2563eb; color:#fff; border:1px solid #93c5fd; padding:5px 12px; border-radius:5px; font-size:12px; font-weight:bold; cursor:pointer; white-space:nowrap;">
                    ✔ Done Editing Base Dots
                </button>
            </div>
        </div>

        <!-- 2b. ON-SHEET PRIVACY & REDACTION BAR (Appears when Owner or Storyteller opens '🕵️ Privacy & Redactions' so they can redact sections or individual fields while viewing the live sheet) -->
        <style>
            /* Subtle crimson dashed indicator shown to Owner & Storyteller on redacted fields while viewing their real data */
            .sheet-page input[data-vtm-redacted="true"],
            .sheet-page textarea[data-vtm-redacted="true"],
            .sheet-page select[data-vtm-redacted="true"] {
                outline: 1.5px dashed #ef4444 !important;
                outline-offset: 1px;
                background-color: rgba(239, 68, 68, 0.11) !important;
            }
            .sheet-page .dot-group[data-vtm-redacted="true"] {
                outline: 1.5px dashed #ef4444 !important;
                outline-offset: 2px;
                background-color: rgba(239, 68, 68, 0.11) !important;
                border-radius: 4px;
            }
            /* Interactive point-and-click highlight when Privacy & Redactions Mode is active */
            body.vtm-privacy-edit-mode .sheet-page input[id],
            body.vtm-privacy-edit-mode .sheet-page textarea[id],
            body.vtm-privacy-edit-mode .sheet-page select[id],
            body.vtm-privacy-edit-mode .sheet-page .dot-group[id],
            body.vtm-privacy-edit-mode .sheet-page .stat-row,
            body.vtm-privacy-edit-mode .sheet-page .advantage-row {
                cursor: pointer !important;
                transition: outline 0.12s ease, background-color 0.12s ease;
            }
            body.vtm-privacy-edit-mode .sheet-page input[id]:hover,
            body.vtm-privacy-edit-mode .sheet-page textarea[id]:hover,
            body.vtm-privacy-edit-mode .sheet-page select[id]:hover,
            body.vtm-privacy-edit-mode .sheet-page .dot-group[id]:hover {
                outline: 2px dashed #a855f7 !important;
                outline-offset: 2px;
                background-color: rgba(168, 85, 247, 0.15) !important;
            }
        </style>
        <div id="xp-privacy-drawer" style="display:none; background:linear-gradient(135deg, #2e1065 0%, #18181b 100%); color:#f3e8ff; padding:10px 14px; border-radius:8px; border:1px solid #a855f7; box-shadow:0 6px 16px rgba(0,0,0,0.7); font-size:12px; flex-direction:column; gap:8px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; flex:1;">
                    <span style="background:rgba(0,0,0,0.45); border:1px solid #a855f7; padding:4px 9px; border-radius:5px; color:#e9d5ff; font-weight:bold; white-space:nowrap;">
                        🕵️ Privacy & Redaction Mode (<span id="privacy-redacted-count-badge">0</span> Redacted)
                    </span>
                    <span style="color:#ddd6fe; font-size:11.5px; line-height:1.35;">
                        Click any <strong>Section Pill</strong> below to hide/reveal a whole section, or <strong>click any field, stat, power, or row directly on the sheet</strong> to toggle <strong style="color:#f87171;">[REDACTED]</strong> for other players.
                    </span>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <button type="button" id="btn-privacy-reveal-all" style="background:#1f2937; color:#d1d5db; border:1px solid #4b5563; padding:5px 10px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;" title="Un-redact all sections and fields so everything is visible">
                        👁️ Reveal All
                    </button>
                    <button type="button" id="btn-privacy-close-drawer" style="background:#7e22ce; color:#fff; border:1px solid #c084fc; padding:5px 12px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; white-space:nowrap;" title="Finish editing privacy and return to normal Character Sheet mode">
                        ✔ Done Editing Privacy
                    </button>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; padding-top:6px; border-top:1px solid rgba(168,85,247,0.25);">
                <span style="font-size:11px; color:#c4b5fd; font-weight:bold; margin-right:2px;">Quick Section Toggles:</span>
                <div id="privacy-bar-section-pills" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex:1;"></div>
            </div>
            <div id="privacy-st-player-visibility-row" style="display:none; align-items:center; gap:6px; flex-wrap:wrap; padding-top:6px; border-top:1px solid rgba(168,85,247,0.25);">
                <span style="font-size:11px; color:#fca5a5; font-weight:bold; margin-right:2px;" title="Checked/Hidden players will not see this character at all in the Character Vault or Cast Roster">👑 Hide Character From Players:</span>
                <div id="privacy-st-player-visibility-pills" style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex:1;"></div>
            </div>
        </div>

        <!-- 3. PENDING XP SHOPPING CART BAR (Appears automatically whenever uncommitted XP upgrades are in the cart) -->
        <div id="xp-pending-cart-bar" style="display:none; background:linear-gradient(135deg, #450a0a 0%, #1f1216 100%); color:#fef2f2; padding:10px 16px; border-radius:8px; border:2px solid #dc2626; box-shadow:0 6px 18px rgba(0,0,0,0.75); align-items:center; gap:14px; justify-content:space-between; flex-wrap:wrap;">
            <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="font-weight:bold; font-size:13px; color:#fca5a5; letter-spacing:0.5px;">
                    🔴 PENDING XP CART (<span id="xp-cart-count">0</span> Upgrade<span id="xp-cart-plural">s</span> — <span id="xp-cart-total-cost">0</span> XP)
                </div>
                <div id="xp-cart-summary-text" style="font-size:12px; color:#e5e7eb;"></div>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <button type="button" id="btn-commit-xp-cart" style="background:#16a34a; color:#fff; border:1px solid #86efac; padding:7px 14px; border-radius:5px; font-weight:bold; font-size:12px; cursor:pointer; box-shadow:0 0 10px rgba(22,163,74,0.5);">
                    ✔ Commit XP Spend (Lock in Red Dots)
                </button>
                <button type="button" id="btn-clear-xp-cart" style="background:rgba(0,0,0,0.45); color:#d1d5db; border:1px solid #6b7280; padding:7px 10px; border-radius:5px; font-size:12px; cursor:pointer;">
                    ✖ Cancel / Clear Cart
                </button>
            </div>
        </div>

        <!-- V5 Base Stat Compliance Modal -->
        <div id="xp-compliance-modal" style="display:none; position:fixed; inset:0; z-index:10001; background:rgba(0,0,0,0.75); align-items:center; justify-content:center; font-family:sans-serif;">
            <div style="background:#18181b; color:#f4f4f5; width:600px; max-width:92vw; max-height:85vh; border-radius:10px; border:1px solid #7f1d1d; box-shadow:0 12px 32px rgba(0,0,0,0.9); display:flex; flex-direction:column; overflow:hidden;">
                <div style="padding:14px 18px; background:#271215; border-bottom:1px solid #450a0a; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:bold; font-size:16px; color:#fca5a5;">📋 V5 Character Creation Base Stat Compliance</div>
                    <button type="button" id="btn-close-compliance-modal" style="background:transparent; border:none; color:#9ca3af; font-size:18px; cursor:pointer;">✖</button>
                </div>
                <div id="xp-compliance-modal-body" style="padding:16px 18px; overflow-y:auto; display:flex; flex-direction:column; gap:12px; font-size:13px; line-height:1.5;"></div>
                <div style="padding:12px 18px; background:#121215; border-top:1px solid #27272a; display:flex; justify-content:space-between; align-items:center;">
                    <div id="st-compliance-actions" style="display:none; gap:8px;">
                        <button type="button" id="btn-st-switch-base-from-compliance" style="background:#1d4ed8; color:#fff; border:none; padding:7px 12px; border-radius:5px; font-size:12px; font-weight:bold; cursor:pointer;">
                            🛠️ Switch to Edit Base Dots Mode
                        </button>
                        <button type="button" id="btn-st-resnapshot-base" style="background:#374151; color:#e5e7eb; border:1px solid #4b5563; padding:7px 12px; border-radius:5px; font-size:12px; cursor:pointer;" title="Snapshots all current dots on the sheet as permanent Black Base Dots">
                            📸 Re-Snapshot Current Dots as Base
                        </button>
                    </div>
                    <button type="button" id="btn-close-compliance-footer" style="background:#3f3f46; color:#fff; border:none; padding:7px 16px; border-radius:5px; font-size:12px; font-weight:bold; cursor:pointer; margin-left:auto;">Close</button>
                </div>
            </div>
        </div>

        <!-- XP Advancement Shop, Log & Storyteller XP Award Modal -->
        <div id="xp-advancement-modal" style="display:none; position:fixed; inset:0; z-index:10001; background:rgba(0,0,0,0.75); align-items:center; justify-content:center; font-family:sans-serif;">
            <div style="background:#18181b; color:#f4f4f5; width:680px; max-width:94vw; max-height:88vh; border-radius:10px; border:1px solid #7f1d1d; box-shadow:0 12px 32px rgba(0,0,0,0.9); display:flex; flex-direction:column; overflow:hidden;">
                <div style="padding:14px 18px; background:#271215; border-bottom:1px solid #450a0a; display:flex; justify-content:space-between; align-items:center;">
                    <div style="font-weight:bold; font-size:16px; color:#fca5a5;">✨ Buy Specialties / Rituals & View XP History Log</div>
                    <button type="button" id="btn-close-xp-modal" style="background:transparent; border:none; color:#9ca3af; font-size:18px; cursor:pointer;">✖</button>
                </div>
                <div style="padding:16px 18px; overflow-y:auto; display:flex; flex-direction:column; gap:18px; font-size:13px;">
                    <!-- Official V5 Reference Table -->
                    <div style="background:#27272a; padding:10px 14px; border-radius:6px; border-left:3px solid #dc2626;">
                        <div style="font-weight:bold; color:#fca5a5; margin-bottom:4px;">💡 Official V5 Experience Point Costs</div>
                        <div style="color:#d4d4d8; font-size:12px;">
                            • <strong>Dot Upgrades (Click glowing green dots 🟢 directly on the sheet):</strong> Attribute = New Level × 5 XP | Skill = New Level × 3 XP | In-Clan Discipline = New Level × 5 XP | Out-of-Clan = New Level × 7 XP | Caitiff = New Level × 6 XP | Thin-Blood Alchemy = New Level × 3 XP | Merit/Background = 3 XP per dot | Blood Potency = New Level × 10 XP.
                        </div>
                    </div>

                    <!-- Non-Dot Upgrades: Add Skill Specialty or Ritual/Formula to XP Cart -->
                    <div style="background:#1f1f23; border:1px solid #3f3f46; padding:12px 14px; border-radius:6px;">
                        <div style="font-weight:bold; color:#f3f4f6; margin-bottom:10px;">➕ Buy Non-Dot Upgrades (Skill Specialty / Blood Sorcery Ritual / Thin-Blood Formula)</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px;">
                            <!-- New Skill Specialty (3 XP) -->
                            <div style="background:#18181b; padding:10px; border-radius:6px; border:1px solid #27272a;">
                                <div style="font-weight:bold; color:#fca5a5; font-size:12px; margin-bottom:6px;">New Skill Specialty (3 XP)</div>
                                <select id="xp-specialty-skill-select" style="width:100%; background:#27272a; color:#fff; border:1px solid #3f3f46; padding:5px; border-radius:4px; margin-bottom:6px; font-size:12px;"></select>
                                <input type="text" id="xp-specialty-text-input" placeholder="e.g. Kindred, Lockpicking..." style="width:100%; box-sizing:border-box; background:#27272a; color:#fff; border:1px solid #3f3f46; padding:5px 8px; border-radius:4px; margin-bottom:8px; font-size:12px;">
                                <button type="button" id="btn-add-specialty-to-cart" style="width:100%; background:#991b1b; color:#fff; border:none; padding:6px; border-radius:4px; font-weight:bold; font-size:12px; cursor:pointer;">
                                    + Add Specialty to XP Cart (3 XP)
                                </button>
                            </div>

                            <!-- Blood Sorcery Ritual / Thin-Blood Formula -->
                            <div style="background:#18181b; padding:10px; border-radius:6px; border:1px solid #27272a;">
                                <div style="font-weight:bold; color:#fca5a5; font-size:12px; margin-bottom:6px;">Ritual (Lvl×3 XP) / Formula (Lvl×2 XP)</div>
                                <div style="display:flex; gap:6px; margin-bottom:6px;">
                                    <select id="xp-ritual-type-select" style="flex:1; background:#27272a; color:#fff; border:1px solid #3f3f46; padding:5px; border-radius:4px; font-size:12px;">
                                        <option value="ritual">Blood Sorcery Ritual (×3 XP)</option>
                                        <option value="formula">Thin-Blood Formula (×2 XP)</option>
                                    </select>
                                    <select id="xp-ritual-level-select" style="width:75px; background:#27272a; color:#fff; border:1px solid #3f3f46; padding:5px; border-radius:4px; font-size:12px;">
                                        <option value="1">Lvl 1</option>
                                        <option value="2">Lvl 2</option>
                                        <option value="3">Lvl 3</option>
                                        <option value="4">Lvl 4</option>
                                        <option value="5">Lvl 5</option>
                                    </select>
                                </div>
                                <input type="text" id="xp-ritual-name-input" placeholder="Ritual or Formula name..." style="width:100%; box-sizing:border-box; background:#27272a; color:#fff; border:1px solid #3f3f46; padding:5px 8px; border-radius:4px; margin-bottom:8px; font-size:12px;">
                                <button type="button" id="btn-add-ritual-to-cart" style="width:100%; background:#991b1b; color:#fff; border:none; padding:6px; border-radius:4px; font-weight:bold; font-size:12px; cursor:pointer;">
                                    + Add Ritual/Formula to XP Cart
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Storyteller Quick Award / Deduct XP Panel (Visible only to Storyteller) -->
                    <div id="st-modal-xp-grant-box" style="display:none; background:#291d12; border:1px solid #b45309; padding:12px 14px; border-radius:6px;">
                        <div style="font-weight:bold; color:#fde68a; margin-bottom:8px;">👑 Storyteller Experience Point Controls (Give or Remove XP)</div>
                        <div style="display:grid; grid-template-columns:110px 160px 1fr auto; gap:8px; align-items:center;">
                            <input type="number" id="st-xp-amount-input" value="2" step="1" style="background:#18181b; color:#fff; border:1px solid #d97706; padding:6px 8px; border-radius:4px; font-size:13px; font-weight:bold;" title="Use positive number to award XP (e.g. 3) or negative number to remove XP (e.g. -2)">
                            <select id="st-xp-target-select" style="background:#18181b; color:#fde68a; border:1px solid #d97706; padding:6px; border-radius:4px; font-size:12px;">
                                <option value="character">This Character Only</option>
                                <option value="campaign">All Campaign PCs</option>
                            </select>
                            <input type="text" id="st-xp-reason-input" placeholder="Reason (e.g. Episode 4 / Roleplay Bonus / Correction)" style="background:#18181b; color:#fff; border:1px solid #78350f; padding:6px 8px; border-radius:4px; font-size:12px;">
                            <button type="button" id="btn-st-apply-xp-delta" style="background:#d97706; color:#18181b; border:none; padding:7px 12px; border-radius:4px; font-weight:bold; font-size:12px; cursor:pointer; white-space:nowrap;">
                                Apply XP
                            </button>
                        </div>
                        <div style="font-size:11px; color:#fcd34d; margin-top:6px;">
                            Tip: Enter a positive number (like <strong>3</strong>) to grant XP, or a negative number (like <strong>-2</strong>) to remove XP if you made a mistake.
                        </div>
                    </div>

                    <!-- XP History & Storyteller Refund List -->
                    <div>
                        <div style="font-weight:bold; color:#f3f4f6; margin-bottom:8px;">📜 Experience Point History & Upgrades Log <span style="font-weight:normal; font-size:11px; color:#9ca3af;">(Storyteller can refund any purchase below)</span></div>
                        <div id="xp-history-log-list" style="display:flex; flex-direction:column; gap:6px; max-height:240px; overflow-y:auto; background:#121215; padding:10px; border-radius:6px; border:1px solid #27272a;"></div>
                    </div>
                </div>
                <div style="padding:12px 18px; background:#121215; border-top:1px solid #27272a; display:flex; justify-content:flex-end;">
                    <button type="button" id="btn-close-xp-modal-footer" style="background:#3f3f46; color:#fff; border:none; padding:7px 16px; border-radius:5px; font-size:12px; font-weight:bold; cursor:pointer;">Close</button>
                </div>
            </div>
        </div>
    `;
    // document.body.insertBefore places the sticky top dock at the very top of the body BEFORE the first .sheet-page so it never covers the character sheet
    document.body.insertBefore(xpSystemUiContainer, document.body.firstChild);

    // Populate the Skill Specialty dropdown inside the XP Advancement Modal
    // document.getElementById locates the skill dropdown for purchasing a new specialty
    const specialtySkillSelect = document.getElementById('xp-specialty-skill-select');
    if (specialtySkillSelect) {
        V5_SKILL_KEYS.forEach(skillKey => {
            // document.createElement creates an <option> for each V5 Skill
            const optionElement = document.createElement('option');
            optionElement.value = skillKey;
            optionElement.textContent = formatStatDisplayName(skillKey, currentSheetData);
            specialtySkillSelect.appendChild(optionElement);
        });
    }

    const currentTemplateFilename = window.location.pathname.split('/').pop() || 'V5-Character-Sheet.html';
    // document.querySelector checks if an <option> exists for the current HTML file name
    if (document.querySelector(`#sheetTemplateSelect option[value='${currentTemplateFilename}']`)) {
        // document.getElementById sets the dropdown's selected value to match the currently open sheet template
        document.getElementById('sheetTemplateSelect').value = currentTemplateFilename;
    }

    // document.getElementById finds the template dropdown and addEventListener listens for template changes
    document.getElementById('sheetTemplateSelect')?.addEventListener('change', async function() {
        const newTemplateFilename = this.value;
        await triggerSave(newTemplateFilename, true);
        // window.parent.postMessage sends a message to the parent VTT window asking it to reload the iframe with the newly chosen template
        window.parent.postMessage({
            type: 'vtm:reopen_sheet',
            char_id: charId,
            template: newTemplateFilename
        }, '*');
    });

    /**
     * Persists the current `concealedFields` array to the server (`PUT /api/characters/:id`)
     * and notifies the parent VTT frame so all views stay synchronized.
     */
    async function saveConcealedFieldsToServer(toastMessage) {
        if (isReadonly || !charId) return;
        try {
            // localStorage.getItem reads the JWT token for authenticated API calls
            const authToken = localStorage.getItem('vtm_auth_token');
            // fetch sends an HTTP PUT request to persist the updated concealed_fields list
            const putResponse = await fetch(`/api/characters/${charId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                body: JSON.stringify({ concealed_fields: concealedFields })
            });
            if (putResponse.ok) {
                showSaveState('saved', toastMessage || 'Privacy & Redaction settings saved');
            } else {
                showSaveState('error', 'Failed to save Privacy settings');
            }
        } catch (networkError) {
            console.error('Error saving concealed_fields:', networkError);
            showSaveState('error', 'Network error saving Privacy settings');
        }
        if (window.parent && window.parent !== window) {
            // window.parent.postMessage notifies the parent VTT modal so its Settings tab pills stay in sync
            window.parent.postMessage({
                type: 'vtm:privacy_sync',
                charId: Number(charId),
                concealedFields: concealedFields
            }, '*');
        }
    }

    /**
     * Updates the hidden-by-default Player Experience drawer, Storyteller Sheet Tools drawer,
     * On-Sheet Privacy & Redactions drawer, Pending XP Cart bar, and syncs live badge state up to the parent modal header.
     */
    function updateXpToolbarAndCartUi() {
        const totalXp = Number(currentSheetData.total_experience || currentSheetData.total || 0);
        const spentXp = Number(currentSheetData.spent_experience || currentSheetData.spent || 0);
        const cartCost = pendingXpCart.reduce((sum, item) => sum + Number(item.cost || 0), 0);
        const availableXp = totalXp - spentXp - cartCost;
        const effectiveSt = isEffectiveStoryteller();

        // document.getElementById locates the XP counter badges inside the Player Experience drawer
        const availBadge = document.getElementById('xp-avail-badge');
        const spentBadge = document.getElementById('xp-spent-badge');
        const totalBadge = document.getElementById('xp-total-badge');
        if (availBadge) {
            availBadge.textContent = `${availableXp} Available`;
            availBadge.style.color = availableXp > 0 ? '#34d399' : (availableXp === 0 ? '#9ca3af' : '#ef4444');
        }
        if (spentBadge) spentBadge.textContent = String(spentXp);
        if (totalBadge) totalBadge.textContent = String(totalXp);

        // Update V5 Base Stat Compliance Badge inside Storyteller Tools drawer
        const complianceResult = evaluateV5BaseStatCompliance(currentSheetData);
        // document.getElementById finds the compliance badge button
        const complianceBadgeButton = document.getElementById('btn-v5-compliance-badge');
        if (complianceBadgeButton) {
            if (complianceResult.isCompliant) {
                complianceBadgeButton.textContent = '✅ V5 Base Compliant';
                complianceBadgeButton.style.background = '#064e3b';
                complianceBadgeButton.style.color = '#a7f3d0';
                complianceBadgeButton.style.borderColor = '#059669';
            } else {
                complianceBadgeButton.textContent = `⚠️ ${complianceResult.issues.length} Base Rule Issue${complianceResult.issues.length === 1 ? '' : 's'}`;
                complianceBadgeButton.style.background = '#78350f';
                complianceBadgeButton.style.color = '#fde68a';
                complianceBadgeButton.style.borderColor = '#d97706';
            }
        }

        // Show standalone fallback bar only when opened outside the VTT modal iframe
        const isStandaloneWindow = (window.self === window.top);
        const standaloneBar = document.getElementById('xp-standalone-fallback-bar');
        const standaloneStBtn = document.getElementById('btn-standalone-st-toggle');
        if (standaloneBar) {
            standaloneBar.style.display = isStandaloneWindow ? 'flex' : 'none';
        }
        if (standaloneStBtn) {
            standaloneStBtn.style.display = (isStandaloneWindow && effectiveSt && !isReadonly) ? 'inline-block' : 'none';
        }

        // Show/hide Storyteller-only modal sections
        // document.getElementById locates the Storyteller control containers
        const stModalXpGrantBox = document.getElementById('st-modal-xp-grant-box');
        const stComplianceActions = document.getElementById('st-compliance-actions');
        const stBaseBanner = document.getElementById('st-base-mode-banner');
        const stDrawerElement = document.getElementById('xp-st-drawer');
        if (stModalXpGrantBox) stModalXpGrantBox.style.display = (effectiveSt && !isReadonly) ? 'block' : 'none';
        if (stComplianceActions) stComplianceActions.style.display = (effectiveSt && !isReadonly) ? 'flex' : 'none';
        if (stDrawerElement) {
            stDrawerElement.style.display = (isStDrawerOpen && effectiveSt && !isReadonly) ? 'flex' : 'none';
        }

        // Update the On-Sheet Privacy & Redactions Drawer (#xp-privacy-drawer)
        // document.getElementById locates the Privacy & Redactions drawer and section pills container
        const privacyDrawerElement = document.getElementById('xp-privacy-drawer');
        const privacySectionPillsContainer = document.getElementById('privacy-bar-section-pills');
        const privacyCountBadge = document.getElementById('privacy-redacted-count-badge');
        const isPrivacyActive = Boolean(isPrivacyDrawerOpen && !isReadonly && !isPlayerPreviewOverride);
        // document.body.classList.toggle enables or disables purple hover outlines on sheet fields
        document.body.classList.toggle('vtm-privacy-edit-mode', isPrivacyActive);

        if (privacyDrawerElement) {
            privacyDrawerElement.style.display = isPrivacyActive ? 'flex' : 'none';
        }
        if (privacyCountBadge) {
            privacyCountBadge.textContent = String(Array.isArray(concealedFields) ? concealedFields.length : 0);
        }
        if (privacySectionPillsContainer && isPrivacyActive && typeof SECTION_MAP === 'object') {
            privacySectionPillsContainer.innerHTML = '';
            Object.entries(SECTION_MAP).forEach(([sectionKey, sectionInfo]) => {
                const isSectionRedacted = Array.isArray(concealedFields) && concealedFields.includes(sectionKey);
                // document.createElement builds a quick-toggle pill button for each sheet section
                const pillButton = document.createElement('button');
                pillButton.type = 'button';
                pillButton.style.cssText = isSectionRedacted
                    ? 'background:#7f1d1d; color:#fecaca; border:1px solid #ef4444; padding:4px 9px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:4px;'
                    : 'background:#1f2937; color:#e5e7eb; border:1px solid #4b5563; padding:4px 9px; border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer; display:inline-flex; align-items:center; gap:4px;';
                pillButton.innerHTML = `${isSectionRedacted ? '🙈' : '👁️'} ${sectionInfo.label}: <span style="text-decoration:underline;">${isSectionRedacted ? 'REDACTED' : 'Visible'}</span>`;
                pillButton.title = isSectionRedacted
                    ? `Click to reveal the ${sectionInfo.label} section to other players`
                    : `Click to redact the entire ${sectionInfo.label} section from other players`;
                pillButton.addEventListener('click', () => {
                    if (!Array.isArray(concealedFields)) concealedFields = [];
                    if (concealedFields.includes(sectionKey)) {
                        concealedFields = concealedFields.filter(itemKey => itemKey !== sectionKey);
                    } else {
                        concealedFields.push(sectionKey);
                    }
                    applyRedaction();
                    updateXpToolbarAndCartUi();
                    saveConcealedFieldsToServer(`${sectionInfo.label} section ${concealedFields.includes(sectionKey) ? 'REDACTED' : 'revealed'}!`);
                });
                privacySectionPillsContainer.appendChild(pillButton);
            });
        }

        // Storyteller-only Whole-Character Player Visibility Row inside #xp-privacy-drawer
        // document.getElementById locates the Storyteller player visibility row and pill container
        const stPlayerVisibilityRow = document.getElementById('privacy-st-player-visibility-row');
        const stPlayerVisibilityPills = document.getElementById('privacy-st-player-visibility-pills');
        const eligiblePlayers = Array.isArray(window.vtmEligiblePlayersList) ? window.vtmEligiblePlayersList : [];
        if (stPlayerVisibilityRow && stPlayerVisibilityPills) {
            if (isPrivacyActive && effectiveSt && eligiblePlayers.length > 0) {
                stPlayerVisibilityRow.style.display = 'flex';
                stPlayerVisibilityPills.innerHTML = '';
                const hiddenIds = Array.isArray(window.vtmHiddenFromUserIds) ? window.vtmHiddenFromUserIds : [];

                // Add 'Toggle All' quick button
                // document.createElement creates the Toggle All visibility button
                const toggleAllButton = document.createElement('button');
                toggleAllButton.type = 'button';
                const allHidden = eligiblePlayers.length > 0 && eligiblePlayers.every(playerObj => hiddenIds.includes(playerObj.id));
                toggleAllButton.style.cssText = allHidden
                    ? 'background:#7f1d1d; color:#fecaca; border:1px solid #ef4444; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;'
                    : 'background:#111827; color:#9ca3af; border:1px solid #4b5563; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;';
                toggleAllButton.textContent = allHidden ? '🙈 Hidden From All (Reveal All)' : '👁️ Hide From All Players';
                toggleAllButton.addEventListener('click', () => {
                    if (allHidden) {
                        window.vtmHiddenFromUserIds = null;
                    } else {
                        window.vtmHiddenFromUserIds = eligiblePlayers.map(playerObj => playerObj.id);
                    }
                    updateXpToolbarAndCartUi();
                    if (window.parent && window.parent !== window) {
                        // window.parent.postMessage asks the parent VTT window to toggle whole-character visibility for all players
                        window.parent.postMessage({
                            type: 'vtm:set_hidden_from_users',
                            charId: Number(charId),
                            hiddenFromUserIds: window.vtmHiddenFromUserIds
                        }, '*');
                    }
                    showSaveState('saved', allHidden ? 'Character visible to all players in Vault' : 'Character hidden from all players in Vault');
                });
                stPlayerVisibilityPills.appendChild(toggleAllButton);

                eligiblePlayers.forEach(playerObj => {
                    const isHiddenFromThisPlayer = hiddenIds.includes(playerObj.id);
                    // document.createElement creates a pill button for each player in the chronicle
                    const playerPill = document.createElement('button');
                    playerPill.type = 'button';
                    playerPill.style.cssText = isHiddenFromThisPlayer
                        ? 'background:rgba(127,29,29,0.55); color:#fca5a5; border:1px solid #ef4444; padding:3px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;'
                        : 'background:rgba(31,41,55,0.7); color:#d1d5db; border:1px solid #4b5563; padding:3px 8px; border-radius:4px; font-size:11px; cursor:pointer;';
                    playerPill.textContent = `${isHiddenFromThisPlayer ? '🙈 Hidden: ' : '👁️ '}${playerObj.username || 'Player'}`;
                    playerPill.title = isHiddenFromThisPlayer
                        ? `Click to allow ${playerObj.username} to see this character in the Character Vault`
                        : `Click to hide this entire character from ${playerObj.username} in the Character Vault`;
                    playerPill.addEventListener('click', () => {
                        let nextHidden = Array.isArray(window.vtmHiddenFromUserIds) ? [...window.vtmHiddenFromUserIds] : [];
                        if (nextHidden.includes(playerObj.id)) {
                            nextHidden = nextHidden.filter(idItem => idItem !== playerObj.id);
                        } else {
                            nextHidden.push(playerObj.id);
                        }
                        window.vtmHiddenFromUserIds = nextHidden.length > 0 ? nextHidden : null;
                        updateXpToolbarAndCartUi();
                        if (window.parent && window.parent !== window) {
                            // window.parent.postMessage asks the parent VTT window to persist the updated hidden_from_user_ids array
                            window.parent.postMessage({
                                type: 'vtm:set_hidden_from_users',
                                charId: Number(charId),
                                hiddenFromUserIds: window.vtmHiddenFromUserIds
                            }, '*');
                        }
                        showSaveState('saved', `${playerObj.username}: ${isHiddenFromThisPlayer ? 'Can now see character' : 'Character hidden from player'}`);
                    });
                    stPlayerVisibilityPills.appendChild(playerPill);
                });
            } else {
                stPlayerVisibilityRow.style.display = 'none';
            }
        }

        // Update the Player Experience Drawer (#xp-player-drawer)
        // document.getElementById locates the Player Experience drawer and guided instruction text
        const playerXpDrawer = document.getElementById('xp-player-drawer');
        const guidedSpendText = document.getElementById('xp-guided-spend-text');
        if (playerXpDrawer && guidedSpendText) {
            if (isXpDrawerOpen && storytellerSheetMode !== 'base' && !isReadonly) {
                playerXpDrawer.style.display = 'flex';
                if (availableXp < 3 && pendingXpCart.length === 0) {
                    playerXpDrawer.style.background = 'linear-gradient(135deg, #78350f 0%, #1c1917 100%)';
                    playerXpDrawer.style.borderColor = '#f59e0b';
                    guidedSpendText.innerHTML = `
                        <strong>Need at least 3 XP to buy an upgrade.</strong> (Cheapest V5 upgrades: Level 1 Skill, Skill Specialty, or Merit/Background dot = <strong>3 XP</strong>).
                        ${effectiveSt ? 'Use <strong>👑 Storyteller & Settings</strong> in the left sidebar to award XP!' : 'Wait for your Storyteller to award session XP.'}
                    `;
                } else {
                    playerXpDrawer.style.background = 'linear-gradient(135deg, #064e3b 0%, #111827 100%)';
                    playerXpDrawer.style.borderColor = '#10b981';
                    guidedSpendText.innerHTML = `
                        <strong>🟢 Click any glowing green dot on the sheet below</strong> to add it to your XP Cart${effectiveSt && spentXp > 0 ? ' (or click any <strong>Crimson Red dot 🔴</strong> to refund it)' : ''}!
                    `;
                }
            } else {
                playerXpDrawer.style.display = 'none';
            }
        }

        // document.getElementById updates the Storyteller Base Mode toggle button and banner appearance
        const modeToggleButton = document.getElementById('btn-st-toggle-mode');
        const stBaseBannerText = document.getElementById('st-base-mode-banner-text');
        const stBannerTogglePlayerUnlockBtn = document.getElementById('btn-st-banner-toggle-player-unlock');
        const stExitBaseModeBtn = document.getElementById('btn-st-exit-base-mode');
        const playerBaseUnlocked = isPlayerBaseEditUnlocked();
        const isBaseBannerActive = !isReadonly && ((effectiveSt && storytellerSheetMode === 'base') || playerBaseUnlocked);

        if (modeToggleButton) {
            if (effectiveSt && (storytellerSheetMode === 'base' || playerBaseUnlocked)) {
                modeToggleButton.textContent = '🛠️ Editing Base Dots (ON)';
                modeToggleButton.style.background = '#1d4ed8';
                modeToggleButton.style.borderColor = '#60a5fa';
            } else {
                modeToggleButton.textContent = '🛠️ Edit Base Dots (Black)';
                modeToggleButton.style.background = '#1e293b';
                modeToggleButton.style.borderColor = '#475569';
            }
        }

        if (stBaseBanner) {
            if (isBaseBannerActive) {
                stBaseBanner.style.display = 'flex';
                if (playerBaseUnlocked) {
                    stBaseBanner.style.background = 'linear-gradient(135deg, #78350f 0%, #1c1917 100%)';
                    stBaseBanner.style.borderColor = '#f59e0b';
                    if (effectiveSt) {
                        if (stBaseBannerText) {
                            stBaseBannerText.innerHTML = '<strong>🔓 Base Stat Editing UNLOCKED FOR PLAYER:</strong> Both you and the player can freely click any dot below to set permanent <strong>Black Starting Creation Dots</strong> (0 XP). When finished, click <strong>Lock &amp; Snapshot Base Dots</strong>.';
                        }
                        if (stBannerTogglePlayerUnlockBtn) {
                            stBannerTogglePlayerUnlockBtn.style.display = 'inline-block';
                            stBannerTogglePlayerUnlockBtn.textContent = '🔒 Lock & Snapshot Base Dots';
                            stBannerTogglePlayerUnlockBtn.style.background = '#059669';
                            stBannerTogglePlayerUnlockBtn.style.borderColor = '#6ee7b7';
                        }
                        if (stExitBaseModeBtn) {
                            stExitBaseModeBtn.style.display = 'none';
                        }
                    } else {
                        if (stBaseBannerText) {
                            stBaseBannerText.innerHTML = '<strong>🔓 Base Stat Editing Unlocked by Storyteller:</strong> Click any circular dot on the sheet below to freely add or remove your starting <strong>Black Base Dots</strong> (0 XP). Tell your Storyteller when you are ready for them to lock &amp; snapshot your Base Stats!';
                        }
                        if (stBannerTogglePlayerUnlockBtn) stBannerTogglePlayerUnlockBtn.style.display = 'none';
                        if (stExitBaseModeBtn) stExitBaseModeBtn.style.display = 'none';
                    }
                } else {
                    stBaseBanner.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)';
                    stBaseBanner.style.borderColor = '#60a5fa';
                    if (stBaseBannerText) {
                        stBaseBannerText.innerHTML = '<strong>🛠️ Storyteller Base Dot Edit Mode:</strong> Click any circular dot on the sheet below to freely add or remove permanent <strong>Black Starting Creation Dots</strong> (costs 0 XP).';
                    }
                    if (stBannerTogglePlayerUnlockBtn) {
                        stBannerTogglePlayerUnlockBtn.style.display = 'inline-block';
                        stBannerTogglePlayerUnlockBtn.textContent = '🔓 Unlock for Player Too';
                        stBannerTogglePlayerUnlockBtn.style.background = '#b45309';
                        stBannerTogglePlayerUnlockBtn.style.borderColor = '#fbbf24';
                    }
                    if (stExitBaseModeBtn) {
                        stExitBaseModeBtn.style.display = 'inline-block';
                    }
                }
            } else {
                stBaseBanner.style.display = 'none';
            }
        }

        // Update Pending XP Cart Bar
        // document.getElementById locates the Pending XP Cart bar elements
        const cartBarElement = document.getElementById('xp-pending-cart-bar');
        const cartCountSpan = document.getElementById('xp-cart-count');
        const cartPluralSpan = document.getElementById('xp-cart-plural');
        const cartCostSpan = document.getElementById('xp-cart-total-cost');
        const cartSummaryText = document.getElementById('xp-cart-summary-text');

        if (cartBarElement) {
            if (pendingXpCart.length > 0 && !isReadonly) {
                cartBarElement.style.display = 'flex';
                if (cartCountSpan) cartCountSpan.textContent = String(pendingXpCart.length);
                if (cartPluralSpan) cartPluralSpan.textContent = pendingXpCart.length === 1 ? '' : 's';
                if (cartCostSpan) cartCostSpan.textContent = String(cartCost);
                if (cartSummaryText) {
                    cartSummaryText.textContent = pendingXpCart.map(item => `${item.label} (${item.cost} XP)`).join(' • ');
                }
            } else {
                cartBarElement.style.display = 'none';
            }
        }

        // Adjust top dock bottom margin so it takes up zero space when all drawers are closed
        const anyTopBarVisible = isStandaloneWindow ||
            (isXpDrawerOpen && storytellerSheetMode !== 'base' && !isReadonly) ||
            (isStDrawerOpen && effectiveSt && !isReadonly) ||
            isPrivacyActive ||
            isBaseBannerActive ||
            (pendingXpCart.length > 0 && !isReadonly);
        xpSystemUiContainer.style.margin = anyTopBarVisible ? '-10px auto 14px auto' : '0 auto';

        // Notify parent VTT modal header and inline Settings dashboard so they stay synchronized with live XP, compliance, privacy, and history states
        if (window.parent && window.parent !== window) {
            // window.parent.postMessage sends the live XP balance, compliance report, privacy state, and XP log up to the parent VTT window
            window.parent.postMessage({
                type: 'vtm:xp_badge_sync',
                availableXp: availableXp,
                spentXp: spentXp,
                totalXp: totalXp,
                xpDrawerOpen: isXpDrawerOpen && storytellerSheetMode !== 'base',
                stDrawerOpen: isStDrawerOpen && effectiveSt,
                privacyDrawerOpen: isPrivacyActive,
                playerBaseEditUnlocked: playerBaseUnlocked,
                concealedFields: Array.isArray(concealedFields) ? concealedFields : [],
                isCompliant: complianceResult.isCompliant,
                issueCount: complianceResult.issues.length,
                complianceChecks: complianceResult.passedChecks || [],
                complianceIssues: complianceResult.issues || [],
                preSnapshotSkillCandidates: complianceResult.preSnapshotSkillCandidates || [],
                xpLog: Array.isArray(currentSheetData.xp_log) ? currentSheetData.xp_log : []
            }, '*');
        }
    }

    /**
     * Renders the V5 Base Stat Compliance Report inside `#xp-compliance-modal-body`.
     */
    function renderComplianceReportModal() {
        const complianceResult = evaluateV5BaseStatCompliance(currentSheetData);
        const effectiveSt = isEffectiveStoryteller();
        // document.getElementById locates the body container of the compliance modal
        const modalBodyElement = document.getElementById('xp-compliance-modal-body');
        if (!modalBodyElement) return;

        let reportHtml = '';
        if (complianceResult.isCompliant) {
            reportHtml += `
                <div style="background:#064e3b; color:#ecfdf5; padding:12px 14px; border-radius:6px; border:1px solid #059669; font-weight:bold;">
                    ✅ All Base Character Creation Stats Comply with Official Vampire: The Masquerade V5 Rules!
                </div>
            `;
        } else {
            reportHtml += `
                <div style="background:#451a03; color:#fef3c7; padding:12px 14px; border-radius:6px; border:1px solid #d97706;">
                    <div style="font-weight:bold; margin-bottom:6px;">⚠️ ${complianceResult.issues.length} V5 Base Stat Discrepanc${complianceResult.issues.length === 1 ? 'y' : 'ies'} Detected</div>
                    <div style="font-size:12px; color:#fde68a;">
                        ${effectiveSt
                            ? 'As Storyteller, you can click "Switch to Edit Base Dots Mode" below to adjust this character\'s permanent black base dots directly on the sheet.'
                            : 'Your Storyteller can review and adjust your permanent black Base Dots if any creation stats need correction.'}
                    </div>
                </div>
            `;
            complianceResult.issues.forEach(issueItem => {
                reportHtml += `
                    <div style="background:#271215; border:1px solid #991b1b; padding:10px 12px; border-radius:6px;">
                        <div style="font-weight:bold; color:#fca5a5;">❌ ${issueItem.category}</div>
                        <div style="color:#e5e7eb; font-size:12px; margin-top:3px;">${issueItem.detail}</div>
                    </div>
                `;
            });
        }

        complianceResult.passedChecks.forEach(passedItem => {
            reportHtml += `
                <div style="background:#14261c; border:1px solid #065f46; padding:10px 12px; border-radius:6px;">
                    <div style="font-weight:bold; color:#6ee7b7;">✔ ${passedItem.category}</div>
                    <div style="color:#d1fae5; font-size:12px; margin-top:3px;">${passedItem.detail}</div>
                </div>
            `;
        });

        modalBodyElement.innerHTML = reportHtml;
    }

    /**
     * Renders the Experience Point History Log & Storyteller Refund buttons inside `#xp-history-log-list`.
     */
    function renderXpHistoryLogList() {
        // document.getElementById locates the history list container inside the XP modal
        const logListContainer = document.getElementById('xp-history-log-list');
        if (!logListContainer) return;
        const effectiveSt = isEffectiveStoryteller();

        const logEntries = Array.isArray(currentSheetData.xp_log) ? currentSheetData.xp_log : [];
        if (logEntries.length === 0) {
            logListContainer.innerHTML = '<div style="color:#9ca3af; font-style:italic; text-align:center; padding:14px;">No Experience Point awards or purchases recorded yet.</div>';
            return;
        }

        logListContainer.innerHTML = '';
        logEntries.forEach((logEntry, entryIndex) => {
            // document.createElement creates a row div for each XP log entry
            const rowElement = document.createElement('div');
            rowElement.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px 10px; border-radius:5px; background:#1f1f23; border:1px solid #27272a; font-size:12px;';

            const formattedDate = logEntry.timestamp ? new Date(logEntry.timestamp).toLocaleString() : '';
            let badgeColor = '#fca5a5';
            let signPrefix = '';

            if (logEntry.type === 'award') {
                badgeColor = '#34d399';
                signPrefix = `+${logEntry.amount} XP Awarded`;
            } else if (logEntry.type === 'deduct') {
                badgeColor = '#fbbf24';
                signPrefix = `${logEntry.amount} XP Removed`;
            } else if (logEntry.type === 'refund') {
                badgeColor = '#60a5fa';
                signPrefix = `Refunded (+${Math.abs(logEntry.cost || 0)} XP)`;
            } else {
                badgeColor = '#f87171';
                signPrefix = `Spent ${logEntry.cost} XP`;
            }

            const descriptionText = logEntry.label || logEntry.reason || 'XP Transaction';
            const canStorytellerRefundEntry = effectiveSt && !isReadonly && logEntry.type === 'purchase' && !logEntry.refunded;

            rowElement.innerHTML = `
                <div style="display:flex; flex-direction:column; gap:2px;">
                    <div><strong style="color:${badgeColor};">${signPrefix}</strong> — <span style="color:#f3f4f6;">${descriptionText}</span></div>
                    <div style="font-size:10px; color:#9ca3af;">${formattedDate}${logEntry.by ? ` • By ${logEntry.by}` : ''}${logEntry.refunded ? ' • <em>(Refunded)</em>' : ''}</div>
                </div>
            `;

            if (canStorytellerRefundEntry) {
                // document.createElement creates a Storyteller-only Refund button for this purchase entry
                const refundButton = document.createElement('button');
                refundButton.type = 'button';
                refundButton.textContent = `↩ Refund (+${logEntry.cost} XP)`;
                refundButton.style.cssText = 'background:#7f1d1d; color:#fef2f2; border:1px solid #ef4444; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer; margin-left:10px; white-space:nowrap;';
                // addEventListener attaches the Storyteller refund handler for this log entry
                refundButton.addEventListener('click', () => {
                    refundCommittedPurchaseEntry(entryIndex);
                });
                rowElement.appendChild(refundButton);
            }

            logListContainer.appendChild(rowElement);
        });
    }

    /**
     * Refunds a committed XP purchase entry from `currentSheetData.xp_log` (Storyteller Only).
     *
     * @param {number} logIndex - Index of the purchase entry in `currentSheetData.xp_log`.
     */
    function refundCommittedPurchaseEntry(logIndex) {
        if (!isEffectiveStoryteller() || isReadonly) return;
        const logEntry = currentSheetData.xp_log && currentSheetData.xp_log[logIndex];
        if (!logEntry || logEntry.type !== 'purchase' || logEntry.refunded) return;

        // window.confirm asks the Storyteller to confirm refunding this specific upgrade
        if (!window.confirm(`STORYTELLER XP REFUND\n\nRefund "${logEntry.label}" and return ${logEntry.cost} XP to this character?`)) {
            return;
        }

        if (logEntry.targetId && currentSheetData.xp_upgrades && currentSheetData.xp_upgrades[logEntry.targetId] !== undefined) {
            const dotsToRemove = Math.max(1, Number(logEntry.toRating || 0) - Number(logEntry.fromRating || 0));
            currentSheetData.xp_upgrades[logEntry.targetId] = Math.max(0, Number(currentSheetData.xp_upgrades[logEntry.targetId] || 0) - dotsToRemove);
            const baseDots = Number(currentSheetData.base_stats[logEntry.targetId] || 0);
            currentSheetData[logEntry.targetId] = baseDots + currentSheetData.xp_upgrades[logEntry.targetId];

            if (logEntry.targetId === 'blood_potency') {
                applyBloodPotencyTable(currentSheetData[logEntry.targetId]);
            }
            if (logEntry.targetId === 'stamina' || logEntry.targetId === 'composure' || logEntry.targetId === 'resolve') {
                syncDerivedTrackerCapacitiesOnAttributeChange(logEntry.targetId);
            }
        } else if (logEntry.category === 'specialty' && logEntry.skillKey && logEntry.specialtyText) {
            const specialtyFieldId = logEntry.skillKey + '_specialty';
            // document.getElementById locates the skill's specialty text input to remove the refunded specialty
            const specialtyInput = document.getElementById(specialtyFieldId);
            const currentText = String((specialtyInput && specialtyInput.value) || currentSheetData[specialtyFieldId] || '');
            const updatedSpecs = currentText
                .split(',')
                .map(part => part.trim())
                .filter(part => part && part.toLowerCase() !== String(logEntry.specialtyText).toLowerCase())
                .join(', ');
            currentSheetData[specialtyFieldId] = updatedSpecs;
            if (specialtyInput) specialtyInput.value = updatedSpecs;
        } else if ((logEntry.category === 'ritual' || logEntry.category === 'formula') && logEntry.ritualSlotIndex) {
            const nameFieldId = 'ritual_name_' + logEntry.ritualSlotIndex;
            const levelFieldId = 'ritual_level_' + logEntry.ritualSlotIndex;
            currentSheetData[nameFieldId] = '';
            currentSheetData[levelFieldId] = '';
            // document.getElementById clears the ritual name and level inputs if present on the 4-page sheet
            const nameInput = document.getElementById(nameFieldId);
            const levelInput = document.getElementById(levelFieldId);
            if (nameInput) nameInput.value = '';
            if (levelInput) levelInput.value = '';
        }

        logEntry.refunded = true;
        const previousSpent = Number(currentSheetData.spent_experience || currentSheetData.spent || 0);
        const newSpent = Math.max(0, previousSpent - Number(logEntry.cost || 0));
        currentSheetData.spent_experience = String(newSpent);
        currentSheetData.spent = String(newSpent);

        currentSheetData.xp_log.unshift({
            id: 'xp_refund_' + Date.now(),
            type: 'refund',
            category: logEntry.category,
            targetId: logEntry.targetId,
            label: `Refunded ${logEntry.label}`,
            cost: -Number(logEntry.cost || 0),
            timestamp: new Date().toISOString()
        });

        refreshAllXpVisuals();
        renderXpHistoryLogList();
        triggerSave(null, true);
    }

    /**
     * Commits all pending items in `pendingXpCart` into permanent Crimson Red XP upgrades,
     * increments `spent_experience`, logs each purchase in `xp_log`, and saves to the server.
     */
    function commitPendingXpCart() {
        if (pendingXpCart.length === 0 || isReadonly) return;

        const totalCartCost = pendingXpCart.reduce((sum, item) => sum + Number(item.cost || 0), 0);
        const totalAwardedXp = Number(currentSheetData.total_experience || currentSheetData.total || 0);
        const currentSpentXp = Number(currentSheetData.spent_experience || currentSheetData.spent || 0);
        const availableXp = totalAwardedXp - currentSpentXp;

        if (totalCartCost > availableXp) {
            showSaveState('error', `Cannot commit: Cart costs ${totalCartCost} XP, but only ${availableXp} XP is available.`);
            return;
        }

        ensureBaseStatsSnapshot(currentSheetData, false);

        pendingXpCart.forEach(cartItem => {
            if (cartItem.type === 'dot' && cartItem.targetId) {
                const baseDots = Number(currentSheetData.base_stats[cartItem.targetId] || 0);
                const newXpDotCount = Math.max(0, Number(cartItem.toRating) - baseDots);
                currentSheetData.xp_upgrades[cartItem.targetId] = newXpDotCount;
                currentSheetData[cartItem.targetId] = baseDots + newXpDotCount;

                if (cartItem.targetId === 'blood_potency') {
                    applyBloodPotencyTable(currentSheetData[cartItem.targetId]);
                }
                if (cartItem.targetId === 'stamina' || cartItem.targetId === 'composure' || cartItem.targetId === 'resolve') {
                    syncDerivedTrackerCapacitiesOnAttributeChange(cartItem.targetId);
                }
            } else if (cartItem.type === 'specialty' && cartItem.skillKey && cartItem.specialtyText) {
                const specialtyFieldId = cartItem.skillKey + '_specialty';
                // document.getElementById finds the specialty text input for the chosen skill
                const specialtyInputElement = document.getElementById(specialtyFieldId);
                const existingSpecialtyValue = String((specialtyInputElement && specialtyInputElement.value) || currentSheetData[specialtyFieldId] || '').trim();
                const combinedSpecialtyValue = existingSpecialtyValue
                    ? `${existingSpecialtyValue}, ${cartItem.specialtyText}`
                    : cartItem.specialtyText;
                currentSheetData[specialtyFieldId] = combinedSpecialtyValue;
                if (specialtyInputElement) {
                    specialtyInputElement.value = combinedSpecialtyValue;
                }
            } else if (cartItem.type === 'ritual') {
                // Find the first open ritual slot (1..7) or append to Notes if on 2-page sheet
                let assignedSlot = null;
                for (let rowIndex = 1; rowIndex <= 7; rowIndex++) {
                    if (!currentSheetData['ritual_name_' + rowIndex]) {
                        assignedSlot = rowIndex;
                        currentSheetData['ritual_name_' + rowIndex] = cartItem.ritualName;
                        currentSheetData['ritual_level_' + rowIndex] = `Level ${cartItem.ritualLevel}`;
                        // document.getElementById updates the Ritual name and level inputs if visible in the DOM
                        const ritualNameInput = document.getElementById('ritual_name_' + rowIndex);
                        const ritualLevelInput = document.getElementById('ritual_level_' + rowIndex);
                        if (ritualNameInput) ritualNameInput.value = currentSheetData['ritual_name_' + rowIndex];
                        if (ritualLevelInput) ritualLevelInput.value = currentSheetData['ritual_level_' + rowIndex];
                        break;
                    }
                }
                cartItem.ritualSlotIndex = assignedSlot;
            }

            currentSheetData.xp_log.unshift({
                id: 'xp_buy_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                type: 'purchase',
                category: cartItem.category,
                targetId: cartItem.targetId || null,
                skillKey: cartItem.skillKey || null,
                specialtyText: cartItem.specialtyText || null,
                ritualSlotIndex: cartItem.ritualSlotIndex || null,
                label: cartItem.label,
                fromRating: cartItem.fromRating,
                toRating: cartItem.toRating,
                cost: Number(cartItem.cost || 0),
                timestamp: new Date().toISOString()
            });
        });

        const updatedSpentXp = currentSpentXp + totalCartCost;
        currentSheetData.spent_experience = String(updatedSpentXp);
        currentSheetData.spent = String(updatedSpentXp);

        pendingXpCart = [];
        refreshAllXpVisuals();
        renderXpHistoryLogList();
        triggerSave(null, true);
    }

    // Bind XP Drawer & Modal Event Listeners
    // document.getElementById binds the standalone fallback buttons if the sheet is opened directly in a browser tab
    document.getElementById('btn-standalone-xp-toggle')?.addEventListener('click', () => {
        isXpDrawerOpen = !isXpDrawerOpen;
        isSpendXpHighlightMode = isXpDrawerOpen;
        if (isXpDrawerOpen) storytellerSheetMode = 'xp';
        refreshAllXpVisuals();
    });
    document.getElementById('btn-standalone-st-toggle')?.addEventListener('click', () => {
        if (!isEffectiveStoryteller()) return;
        isStDrawerOpen = !isStDrawerOpen;
        refreshAllXpVisuals();
    });

    // document.getElementById binds the Commit XP Spend button
    document.getElementById('btn-commit-xp-cart')?.addEventListener('click', () => {
        commitPendingXpCart();
    });
    // document.getElementById binds the Clear XP Cart button
    document.getElementById('btn-clear-xp-cart')?.addEventListener('click', () => {
        pendingXpCart = [];
        refreshAllXpVisuals();
    });
    // document.getElementById binds the V5 Compliance Badge button to open the Compliance Report modal
    document.getElementById('btn-v5-compliance-badge')?.addEventListener('click', () => {
        renderComplianceReportModal();
        // document.getElementById displays the compliance modal
        const complianceModal = document.getElementById('xp-compliance-modal');
        if (complianceModal) complianceModal.style.display = 'flex';
    });
    // document.getElementById binds the close buttons on the Compliance modal
    document.getElementById('btn-close-compliance-modal')?.addEventListener('click', () => {
        document.getElementById('xp-compliance-modal').style.display = 'none';
    });
    document.getElementById('btn-close-compliance-footer')?.addEventListener('click', () => {
        document.getElementById('xp-compliance-modal').style.display = 'none';
    });
    // document.getElementById binds the Storyteller button to switch directly to Edit Base Stats mode from the compliance report
    document.getElementById('btn-st-switch-base-from-compliance')?.addEventListener('click', () => {
        if (!isEffectiveStoryteller()) return;
        storytellerSheetMode = 'base';
        isXpDrawerOpen = false;
        isSpendXpHighlightMode = false;
        document.getElementById('xp-compliance-modal').style.display = 'none';
        refreshAllXpVisuals();
        showSaveState('saved', 'Storyteller Mode: Editing Permanent Black Base Dots');
    });
    // document.getElementById binds the Storyteller button to re-snapshot all current dots on the sheet as permanent Base Stats
    document.getElementById('btn-st-resnapshot-base')?.addEventListener('click', () => {
        if (!isEffectiveStoryteller()) return;
        // window.confirm asks the Storyteller before overwriting base_stats with current dot ratings
        if (!window.confirm('Lock all current dots on this sheet as the character\'s permanent Black Base Dots (and reset XP dot upgrades to 0)?')) {
            return;
        }
        ensureBaseStatsSnapshot(currentSheetData, true);
        refreshAllXpVisuals();
        renderComplianceReportModal();
        triggerSave(null, true);
    });

    // document.getElementById binds the '+ Buy Specialty / Ritual' button inside the Player Experience drawer
    document.getElementById('btn-banner-open-specialties')?.addEventListener('click', () => {
        renderXpHistoryLogList();
        const xpModal = document.getElementById('xp-advancement-modal');
        if (xpModal) xpModal.style.display = 'flex';
    });
    // document.getElementById binds the '✖ Close' button inside the Player Experience drawer
    document.getElementById('btn-banner-close-spend-mode')?.addEventListener('click', () => {
        isXpDrawerOpen = false;
        isSpendXpHighlightMode = false;
        refreshAllXpVisuals();
    });
    // document.getElementById binds the '✖ Close' button inside the Storyteller Sheet Tools drawer
    document.getElementById('btn-st-close-drawer')?.addEventListener('click', () => {
        isStDrawerOpen = false;
        if (storytellerSheetMode === 'base') storytellerSheetMode = 'xp';
        refreshAllXpVisuals();
    });
    // document.getElementById binds the 'Done Editing Base Dots' button inside the Storyteller Base Mode banner
    document.getElementById('btn-st-exit-base-mode')?.addEventListener('click', () => {
        storytellerSheetMode = 'xp';
        refreshAllXpVisuals();
        showSaveState('saved', 'Exited Base Stat Edit Mode');
    });
    // document.getElementById binds the 'Unlock for Player Too' / 'Lock & Snapshot Base Dots' button inside the Base Mode banner
    document.getElementById('btn-st-banner-toggle-player-unlock')?.addEventListener('click', () => {
        if (!isEffectiveStoryteller() || isReadonly) return;
        const currentlyUnlocked = Boolean(currentSheetData.player_base_edit_unlocked);
        const nextUnlockedState = !currentlyUnlocked;
        currentSheetData.player_base_edit_unlocked = nextUnlockedState;
        if (!nextUnlockedState) {
            ensureBaseStatsSnapshot(currentSheetData, false);
            currentSheetData.base_stats_snapshotted_at = new Date().toISOString();
            storytellerSheetMode = 'xp';
        } else {
            isXpDrawerOpen = false;
            isSpendXpHighlightMode = false;
        }
        refreshAllXpVisuals();
        triggerSave(null, true);
        showSaveState(
            'saved',
            nextUnlockedState
                ? 'Base Stat editing UNLOCKED for Player (0 XP Black Dots)'
                : 'Base Stats LOCKED & Snapshotted for Player!'
        );
    });

    // document.getElementById binds the '✔ Done Editing Privacy' button inside the Privacy & Redactions drawer
    document.getElementById('btn-privacy-close-drawer')?.addEventListener('click', () => {
        isPrivacyDrawerOpen = false;
        refreshAllXpVisuals();
        applyRedaction();
        showSaveState('saved', 'Exited Privacy & Redaction Mode');
    });

    // document.getElementById binds the '👁️ Reveal All' button inside the Privacy & Redactions drawer
    document.getElementById('btn-privacy-reveal-all')?.addEventListener('click', () => {
        if (isReadonly) return;
        concealedFields = [];
        applyRedaction();
        updateXpToolbarAndCartUi();
        saveConcealedFieldsToServer('All sections and fields revealed to players!');
    });

    // Capture-phase click listener that lets the Owner or Storyteller click any field, stat, or row directly on the sheet while Privacy Mode is active
    // document.addEventListener intercepts clicks in the capture phase before inputs focus or dots toggle
    document.addEventListener('click', (clickEvent) => {
        if (!isPrivacyDrawerOpen || isReadonly || isPlayerPreviewOverride) return;
        // Ignore clicks on the top dock drawers, modals, or save toast
        if (
            clickEvent.target.closest('#xp-sheet-top-dock') ||
            clickEvent.target.closest('#sheet-save-indicator')
        ) {
            return;
        }
        // Only intercept clicks inside the character sheet pages
        const sheetPageContainer = clickEvent.target.closest('.sheet-page');
        if (!sheetPageContainer) return;

        // Locate the clicked input, textarea, select, or dot-group
        let targetElement = clickEvent.target.closest('.dot-group[id], input[id], textarea[id], select[id]');
        if (!targetElement) {
            const parentRowContainer = clickEvent.target.closest('.stat-row, .advantage-row, .field-group, .bio-box');
            if (parentRowContainer) {
                // querySelector finds the primary stat dot-group or input inside the clicked row
                targetElement = parentRowContainer.querySelector('.dot-group[id], input[id]:not(.specialty-input), textarea[id], select[id]') ||
                    parentRowContainer.querySelector('input[id]');
            }
        }
        if (!targetElement || !targetElement.id) return;

        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        if (typeof targetElement.blur === 'function') {
            targetElement.blur();
        }

        const rawElementId = targetElement.id;
        // Build the list of paired field keys so redacting a row or tracker redacts all of its aliases together
        let targetKeysGroup = [rawElementId];
        if (rawElementId === 'health' || rawElementId === 'health_states') {
            targetKeysGroup = ['health_states', 'health'];
        } else if (rawElementId === 'willpower' || rawElementId === 'willpower_states') {
            targetKeysGroup = ['willpower_states', 'willpower'];
        } else if (rawElementId === 'humanity' || rawElementId === 'humanity_states') {
            targetKeysGroup = ['humanity_states', 'humanity'];
        } else if (/^(adv_flaw|merit|background|flaw)_(name|rating)_(\d+)$/.test(rawElementId)) {
            const rowMatch = rawElementId.match(/^(adv_flaw|merit|background|flaw)_(name|rating)_(\d+)$/);
            if (rowMatch) {
                targetKeysGroup = [`${rowMatch[1]}_name_${rowMatch[3]}`, `${rowMatch[1]}_rating_${rowMatch[3]}`];
            }
        } else if (V5_SKILL_KEYS.includes(rawElementId)) {
            targetKeysGroup = [rawElementId, `${rawElementId}_specialty`];
        }

        // Determine if this field belongs to a section in SECTION_MAP
        const primaryCanonicalKey = targetKeysGroup[0];
        let parentSectionId = null;
        if (typeof SECTION_MAP === 'object') {
            for (const [sectionKey, sectionMeta] of Object.entries(SECTION_MAP)) {
                if (sectionMeta.fields.includes(primaryCanonicalKey) || sectionMeta.fields.includes(rawElementId)) {
                    parentSectionId = sectionKey;
                    break;
                }
            }
            if (!parentSectionId && rawElementId.endsWith('_specialty')) {
                parentSectionId = 'section_skills';
            }
        }

        if (!Array.isArray(concealedFields)) concealedFields = [];
        const friendlyFieldLabel = formatStatDisplayName(primaryCanonicalKey, currentSheetData);

        // If the entire parent section is currently redacted, clicking a single field reveals just this field while keeping the rest of the section redacted
        if (parentSectionId && concealedFields.includes(parentSectionId)) {
            concealedFields = concealedFields.filter(existingKey => existingKey !== parentSectionId);
            const sectionFields = (SECTION_MAP[parentSectionId] && SECTION_MAP[parentSectionId].fields) || [];
            sectionFields.forEach(sectionFieldKey => {
                if (!targetKeysGroup.includes(sectionFieldKey) && !concealedFields.includes(sectionFieldKey)) {
                    concealedFields.push(sectionFieldKey);
                }
            });
            concealedFields = concealedFields.filter(existingKey => !targetKeysGroup.includes(existingKey));
            applyRedaction();
            updateXpToolbarAndCartUi();
            saveConcealedFieldsToServer(`Revealed ${friendlyFieldLabel} (rest of section remains redacted)`);
            return;
        }

        const isCurrentlyRedacted = targetKeysGroup.some(keyItem => concealedFields.includes(keyItem));
        if (isCurrentlyRedacted) {
            concealedFields = concealedFields.filter(existingKey => !targetKeysGroup.includes(existingKey));
        } else {
            targetKeysGroup.forEach(keyItem => {
                if (!concealedFields.includes(keyItem)) {
                    concealedFields.push(keyItem);
                }
            });
        }

        applyRedaction();
        updateXpToolbarAndCartUi();
        saveConcealedFieldsToServer(`${friendlyFieldLabel}: ${isCurrentlyRedacted ? 'Visible to players' : 'REDACTED from players'}`);
    }, true);

    // document.getElementById binds the XP History / Log buttons to open the XP Advancement Modal
    document.getElementById('btn-open-xp-modal')?.addEventListener('click', () => {
        renderXpHistoryLogList();
        const xpModal = document.getElementById('xp-advancement-modal');
        if (xpModal) xpModal.style.display = 'flex';
    });
    document.getElementById('btn-st-open-refund-log')?.addEventListener('click', () => {
        renderXpHistoryLogList();
        const xpModal = document.getElementById('xp-advancement-modal');
        if (xpModal) xpModal.style.display = 'flex';
    });
    // document.getElementById binds the close buttons on the XP Advancement Modal
    document.getElementById('btn-close-xp-modal')?.addEventListener('click', () => {
        document.getElementById('xp-advancement-modal').style.display = 'none';
    });
    document.getElementById('btn-close-xp-modal-footer')?.addEventListener('click', () => {
        document.getElementById('xp-advancement-modal').style.display = 'none';
    });

    // document.getElementById binds the Storyteller Mode Toggle button ('xp' <-> 'base')
    document.getElementById('btn-st-toggle-mode')?.addEventListener('click', () => {
        if (!isEffectiveStoryteller()) return;
        storytellerSheetMode = storytellerSheetMode === 'xp' ? 'base' : 'xp';
        if (storytellerSheetMode === 'base') {
            isXpDrawerOpen = false;
            isSpendXpHighlightMode = false;
        }
        refreshAllXpVisuals();
        showSaveState(
            'saved',
            storytellerSheetMode === 'base'
                ? 'Storyteller Mode: Editing Starting Base Dots (Black)'
                : 'Storyteller Mode: Normal Sheet View'
        );
    });

    // document.getElementById binds the '+ Add Specialty to Cart (3 XP)' button inside the XP Modal
    document.getElementById('btn-add-specialty-to-cart')?.addEventListener('click', () => {
        if (isReadonly) return;
        // document.getElementById reads the selected skill and specialty text input
        const skillSelect = document.getElementById('xp-specialty-skill-select');
        const specialtyInput = document.getElementById('xp-specialty-text-input');
        const chosenSkillKey = skillSelect ? skillSelect.value : '';
        const specialtyTextValue = specialtyInput ? specialtyInput.value.trim() : '';

        if (!chosenSkillKey || !specialtyTextValue) {
            showSaveState('error', 'Please select a Skill and enter a Specialty name.');
            return;
        }

        const totalXp = Number(currentSheetData.total_experience || currentSheetData.total || 0);
        const spentXp = Number(currentSheetData.spent_experience || currentSheetData.spent || 0);
        const currentCartCost = pendingXpCart.reduce((sum, item) => sum + Number(item.cost || 0), 0);
        if (totalXp - spentXp - currentCartCost < 3) {
            showSaveState('error', 'Not enough Available XP to add a Skill Specialty (Costs 3 XP).');
            return;
        }

        const skillDisplayName = formatStatDisplayName(chosenSkillKey, currentSheetData);
        pendingXpCart.push({
            id: 'cart_spec_' + Date.now(),
            type: 'specialty',
            category: 'specialty',
            skillKey: chosenSkillKey,
            specialtyText: specialtyTextValue,
            label: `Specialty (${skillDisplayName}: ${specialtyTextValue})`,
            cost: 3
        });
        if (specialtyInput) specialtyInput.value = '';
        document.getElementById('xp-advancement-modal').style.display = 'none';
        refreshAllXpVisuals();
        showSaveState('saved', `Added Specialty "${specialtyTextValue}" (3 XP) to Pending XP Cart!`);
    });

    // document.getElementById binds the '+ Add Ritual/Formula to Cart' button inside the XP Modal
    document.getElementById('btn-add-ritual-to-cart')?.addEventListener('click', () => {
        if (isReadonly) return;
        // document.getElementById reads the ritual type, level, and name inputs
        const ritualTypeSelect = document.getElementById('xp-ritual-type-select');
        const ritualLevelSelect = document.getElementById('xp-ritual-level-select');
        const ritualNameInput = document.getElementById('xp-ritual-name-input');

        const ritualType = ritualTypeSelect ? ritualTypeSelect.value : 'ritual';
        const ritualLevel = parseInt(ritualLevelSelect ? ritualLevelSelect.value : '1', 10) || 1;
        const ritualName = ritualNameInput ? ritualNameInput.value.trim() : '';

        if (!ritualName) {
            showSaveState('error', 'Please enter the Ritual or Formula name.');
            return;
        }

        const costMultiplier = ritualType === 'formula' ? 2 : 3;
        const ritualXpCost = ritualLevel * costMultiplier;

        const totalXp = Number(currentSheetData.total_experience || currentSheetData.total || 0);
        const spentXp = Number(currentSheetData.spent_experience || currentSheetData.spent || 0);
        const currentCartCost = pendingXpCart.reduce((sum, item) => sum + Number(item.cost || 0), 0);
        if (totalXp - spentXp - currentCartCost < ritualXpCost) {
            showSaveState('error', `Not enough Available XP! Level ${ritualLevel} ${ritualType === 'formula' ? 'Formula' : 'Ritual'} costs ${ritualXpCost} XP.`);
            return;
        }

        pendingXpCart.push({
            id: 'cart_ritual_' + Date.now(),
            type: 'ritual',
            category: ritualType,
            ritualName: ritualName,
            ritualLevel: ritualLevel,
            label: `${ritualType === 'formula' ? 'Formula' : 'Ritual'} Lvl ${ritualLevel}: ${ritualName}`,
            cost: ritualXpCost
        });
        if (ritualNameInput) ritualNameInput.value = '';
        document.getElementById('xp-advancement-modal').style.display = 'none';
        refreshAllXpVisuals();
        showSaveState('saved', `Added ${ritualName} (${ritualXpCost} XP) to Pending XP Cart!`);
    });

    /**
     * Shared helper that submits a Storyteller XP award or removal for either this character or all Campaign PCs.
     * Uses direct sheet save (`PUT /api/characters/:id`) for individual character XP and includes a seamless fallback
     * if the server has not yet been restarted to load `/api/chronicles/:id/award-xp`.
     */
    async function submitStorytellerSheetXpDelta(xpDelta, targetScope, reasonText, reasonInputElement) {
        if (!isEffectiveStoryteller()) return;
        if (!xpDelta || isNaN(xpDelta)) {
            showSaveState('error', 'Enter a non-zero XP amount (positive to grant, negative to remove).');
            return;
        }

        const sanitizedReason = reasonText || (targetScope === 'campaign' ? 'Campaign Session XP' : 'Individual Storyteller XP');

        try {
            // Case 1: Individual Character XP — update currentSheetData and save directly via PUT /api/characters/:id
            if (targetScope !== 'campaign') {
                const previousTotalXp = Number(currentSheetData.total_experience || currentSheetData.total || 0);
                const newTotalXp = Math.max(0, previousTotalXp + xpDelta);
                currentSheetData.total_experience = String(newTotalXp);
                currentSheetData.total = String(newTotalXp);
                if (!Array.isArray(currentSheetData.xp_log)) currentSheetData.xp_log = [];
                currentSheetData.xp_log.unshift({
                    id: 'xp_award_' + Date.now(),
                    type: xpDelta > 0 ? 'award' : 'deduct',
                    scope: 'individual',
                    amount: xpDelta,
                    previousTotal: previousTotalXp,
                    newTotal: newTotalXp,
                    reason: sanitizedReason,
                    by: 'Storyteller',
                    timestamp: new Date().toISOString()
                });
                if (reasonInputElement) reasonInputElement.value = '';
                refreshAllXpVisuals();
                renderXpHistoryLogList();
                await triggerSave(null, true);
                showSaveState('saved', `${xpDelta > 0 ? 'Awarded' : 'Removed'} ${Math.abs(xpDelta)} XP for this character!`);
                return;
            }

            // Case 2: Campaign-Wide XP across all PCs in the chronicle
            if (!characterChronicleId) {
                showSaveState('error', 'Missing Chronicle ID for Campaign XP.');
                return;
            }

            // localStorage.getItem reads the user's JWT authentication token
            const authToken = localStorage.getItem('vtm_auth_token');
            const authHeaders = {
                'Content-Type': 'application/json',
                'Authorization': authToken ? `Bearer ${authToken}` : ''
            };

            // Try the batch endpoint first
            // fetch sends an authenticated POST request to award or deduct XP across all PCs
            const response = await fetch(`/api/chronicles/${characterChronicleId}/award-xp`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    amount: xpDelta,
                    target: 'campaign',
                    character_id: Number(charId),
                    reason: sanitizedReason
                })
            });

            const contentType = response.headers.get('content-type') || '';
            if (response.ok && contentType.includes('application/json')) {
                const responseData = await response.json();
                const updatedSelf = (responseData.characters || []).find(charSummary => Number(charSummary.id) === Number(charId));
                if (updatedSelf) {
                    const updatedTotal = updatedSelf.total_experience !== undefined ? updatedSelf.total_experience : updatedSelf.new_total;
                    currentSheetData.total_experience = String(updatedTotal ?? 0);
                    currentSheetData.total = String(updatedTotal ?? 0);
                    if (updatedSelf.sheet_data && Array.isArray(updatedSelf.sheet_data.xp_log)) {
                        currentSheetData.xp_log = updatedSelf.sheet_data.xp_log;
                    } else {
                        if (!Array.isArray(currentSheetData.xp_log)) currentSheetData.xp_log = [];
                        currentSheetData.xp_log.unshift({
                            id: 'xp_award_' + Date.now(),
                            type: xpDelta > 0 ? 'award' : 'deduct',
                            scope: 'campaign',
                            amount: xpDelta,
                            reason: sanitizedReason,
                            by: 'Storyteller',
                            timestamp: new Date().toISOString()
                        });
                    }
                }
                if (reasonInputElement) reasonInputElement.value = '';
                refreshAllXpVisuals();
                renderXpHistoryLogList();
                showSaveState('saved', `${xpDelta > 0 ? 'Awarded' : 'Removed'} ${Math.abs(xpDelta)} Campaign XP across ${responseData.updated_count} PC(s)!`);
                return;
            }

            // Seamless fallback if node server.js has not been restarted since /award-xp was added:
            // Fetch all PCs via GET /api/characters and update each PC via PUT /api/characters/:id
            // fetch retrieves all characters in this chronicle
            const listResponse = await fetch(`/api/characters?chronicle_id=${characterChronicleId}`, {
                headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {}
            });
            if (!listResponse.ok) {
                showSaveState('error', 'Failed to load campaign characters for XP update.');
                return;
            }
            const allCharacters = await listResponse.json();
            const pcCharacters = (Array.isArray(allCharacters) ? allCharacters : []).filter(
                characterItem => String(characterItem.category || 'pc').trim().toLowerCase() === 'pc'
            );

            let updatedPcCount = 0;
            for (const pcRecord of pcCharacters) {
                const isCurrentOpenSheet = Number(pcRecord.id) === Number(charId);
                const sheetObj = isCurrentOpenSheet
                    ? currentSheetData
                    : (typeof pcRecord.sheet_data === 'object' && pcRecord.sheet_data ? pcRecord.sheet_data : {});
                const prevTotal = Number(sheetObj.total_experience || sheetObj.total || 0);
                const nextTotal = Math.max(0, prevTotal + xpDelta);
                sheetObj.total_experience = String(nextTotal);
                sheetObj.total = String(nextTotal);
                if (!Array.isArray(sheetObj.xp_log)) sheetObj.xp_log = [];
                sheetObj.xp_log.unshift({
                    id: 'xp_award_' + Date.now() + '_' + pcRecord.id,
                    type: xpDelta > 0 ? 'award' : 'deduct',
                    scope: 'campaign',
                    amount: xpDelta,
                    previousTotal: prevTotal,
                    newTotal: nextTotal,
                    reason: sanitizedReason,
                    by: 'Storyteller',
                    timestamp: new Date().toISOString()
                });

                if (isCurrentOpenSheet) {
                    await triggerSave(null, true);
                } else {
                    // fetch sends a PUT request to update each other PC's sheet_data
                    await fetch(`/api/characters/${pcRecord.id}`, {
                        method: 'PUT',
                        headers: authHeaders,
                        body: JSON.stringify({ sheet_data: sheetObj })
                    });
                }
                updatedPcCount++;
            }

            if (reasonInputElement) reasonInputElement.value = '';
            refreshAllXpVisuals();
            renderXpHistoryLogList();
            showSaveState('saved', `${xpDelta > 0 ? 'Awarded' : 'Removed'} ${Math.abs(xpDelta)} Campaign XP across ${updatedPcCount} PC(s)!`);
        } catch (networkError) {
            console.error('Error applying XP delta:', networkError);
            showSaveState('error', 'Network error applying XP: ' + (networkError.message || 'Check server connection'));
        }
    }

    // document.getElementById binds the Storyteller inline '✔ Apply XP' button on the top dock
    document.getElementById('btn-st-inline-apply-xp')?.addEventListener('click', () => {
        const amountInput = document.getElementById('st-inline-xp-amount');
        const targetSelect = document.getElementById('st-inline-xp-target');
        const reasonInput = document.getElementById('st-inline-xp-reason');
        submitStorytellerSheetXpDelta(
            parseInt(amountInput ? amountInput.value : '0', 10),
            targetSelect ? targetSelect.value : 'character',
            reasonInput ? reasonInput.value.trim() : '',
            reasonInput
        );
    });

    // document.getElementById binds the Storyteller 'Apply XP' button inside the XP Modal
    document.getElementById('btn-st-apply-xp-delta')?.addEventListener('click', () => {
        const amountInput = document.getElementById('st-xp-amount-input');
        const targetSelect = document.getElementById('st-xp-target-select');
        const reasonInput = document.getElementById('st-xp-reason-input');
        submitStorytellerSheetXpDelta(
            parseInt(amountInput ? amountInput.value : '0', 10),
            targetSelect ? targetSelect.value : 'character',
            reasonInput ? reasonInput.value.trim() : '',
            reasonInput
        );
    });

    // 5. Load data from server
    if (charId) {
        // localStorage.getItem reads the JWT token so the server can identify if the viewer is the Storyteller
        const viewerAuthToken = localStorage.getItem('vtm_auth_token');
        // fetch sends an HTTP GET request to the server API to retrieve the character's JSON record
        fetch(`/api/characters/${charId}?_t=` + Date.now(), {
            headers: viewerAuthToken ? { 'Authorization': 'Bearer ' + viewerAuthToken } : {}
        })
        .then(fetchResponse => fetchResponse.json())
        .then(characterRecord => {
            if (characterRecord.is_storyteller !== undefined) {
                isViewerStoryteller = Boolean(characterRecord.is_storyteller);
            }
            characterChronicleId = characterRecord.chronicle_id || null;

            // --- CUSTOM CLANS INJECTION ---
            if (characterRecord.chronicle_id) {
                // fetch requests custom clan symbols for this chronicle, using localStorage.getItem to read the user's JWT auth token
                fetch(`/api/clan-symbols?chronicleId=${characterRecord.chronicle_id}`, {
                    headers: { 'Authorization': 'Bearer ' + localStorage.getItem('vtm_auth_token') }
                })
                    .then(symbolsResponse => symbolsResponse.json())
                    .then(clanSymbolsList => {
                        // document.getElementById locates the Clan <select> dropdown on the character sheet
                        const clanSelectElement = document.getElementById('clan');
                        if (clanSelectElement && clanSelectElement.tagName === 'SELECT' && clanSymbolsList && Array.isArray(clanSymbolsList)) {
                            const existingClanOptions = Array.from(clanSelectElement.options).map(optionElement => optionElement.value.toLowerCase());
                            clanSymbolsList.forEach(clanSymbolItem => {
                                if (clanSymbolItem.clan_name && !existingClanOptions.includes(clanSymbolItem.clan_name.toLowerCase()) && clanSymbolItem.clan_name.toLowerCase() !== 'custom') {
                                    // document.createElement creates a new <option> element for the custom clan
                                    const newClanOptionElement = document.createElement('option');
                                    newClanOptionElement.value = clanSymbolItem.clan_name;
                                    newClanOptionElement.textContent = clanSymbolItem.clan_name;
                                    const customOptionElement = Array.from(clanSelectElement.options).find(optionElement => optionElement.value === 'custom');
                                    if (customOptionElement) {
                                        clanSelectElement.insertBefore(newClanOptionElement, customOptionElement);
                                    } else {
                                        clanSelectElement.appendChild(newClanOptionElement);
                                    }
                                }
                            });
                            if (currentSheetData && currentSheetData.clan) {
                                const savedClanName = currentSheetData.clan;
                                const finalClanOptions = Array.from(clanSelectElement.options).map(optionElement => optionElement.value.toLowerCase());
                                if (savedClanName && !finalClanOptions.includes(savedClanName.toLowerCase()) && savedClanName.toLowerCase() !== 'custom' && savedClanName.toLowerCase() !== 'mortal') {
                                    // document.createElement creates a fallback <option> if the character's saved clan isn't in the list yet
                                    const fallbackClanOption = document.createElement('option');
                                    fallbackClanOption.value = savedClanName;
                                    fallbackClanOption.textContent = savedClanName;
                                    const customOptionElement = Array.from(clanSelectElement.options).find(optionElement => optionElement.value === 'custom');
                                    if (customOptionElement) clanSelectElement.insertBefore(fallbackClanOption, customOptionElement);
                                    else clanSelectElement.appendChild(fallbackClanOption);
                                }
                                clanSelectElement.value = savedClanName;
                            }
                        }
                    }).catch(errorObject => console.error("Error fetching clan symbols:", errorObject));
            }
            // -------------------------------
            
            // Load concealed fields
            if (characterRecord.concealed_fields) {
                try {
                    // JSON.parse converts the serialized JSON string of concealed field IDs back into a JavaScript array
                    concealedFields = typeof characterRecord.concealed_fields === 'string' ? JSON.parse(characterRecord.concealed_fields) : characterRecord.concealed_fields;
                    if (!Array.isArray(concealedFields)) concealedFields = [];
                } catch(parseError) { concealedFields = []; }
            }

            let rawSheetData = characterRecord.sheet_data || {};
            if (typeof rawSheetData === 'string') {
                // JSON.parse parses the character's sheet_data string into a JavaScript object
                try { rawSheetData = JSON.parse(rawSheetData); } catch(parseError){ rawSheetData = {}; }
            }
            const hadBaseStatsSnapshotBeforeLoad = Boolean(rawSheetData && rawSheetData.base_stats && Object.keys(rawSheetData.base_stats).length > 0);
            
            // Normalize cross-template fields, trackers, disciplines, advantages, and ensure Base Stats snapshot
            let normalizedSheet = normalizeSheetData(rawSheetData, characterRecord);
            currentSheetData = normalizedSheet;

            // Ensure custom clan is selectable immediately even before clan-symbols finishes
            // document.getElementById locates the Clan <select> element
            const clanSelectElement = document.getElementById('clan');
            if (clanSelectElement && clanSelectElement.tagName === 'SELECT' && normalizedSheet.clan) {
                const existingOptionValues = Array.from(clanSelectElement.options).map(optionElement => optionElement.value.toLowerCase());
                if (!existingOptionValues.includes(String(normalizedSheet.clan).toLowerCase())) {
                    // document.createElement creates an <option> for the character's custom clan
                    const customClanOption = document.createElement('option');
                    customClanOption.value = normalizedSheet.clan;
                    customClanOption.textContent = normalizedSheet.clan;
                    const customOptionPlaceholder = Array.from(clanSelectElement.options).find(optionElement => optionElement.value === 'custom');
                    if (customOptionPlaceholder) clanSelectElement.insertBefore(customClanOption, customOptionPlaceholder);
                    else clanSelectElement.appendChild(customClanOption);
                }
            }

            // document.querySelectorAll selects all text inputs, textareas, and dropdowns to populate them from normalizedSheet
            document.querySelectorAll('input, textarea, select').forEach(formControlElement => {
                if (formControlElement.id === 'sheetTemplateSelect' || formControlElement.id.startsWith('xp-') || formControlElement.id.startsWith('st-xp-')) return;
                if (normalizedSheet[formControlElement.id] !== undefined) {
                    if (formControlElement.type === 'checkbox') {
                        formControlElement.checked = Boolean(normalizedSheet[formControlElement.id] && normalizedSheet[formControlElement.id] !== 'false');
                    } else {
                        formControlElement.value = normalizedSheet[formControlElement.id];
                    }
                }
            });

            // Update M / B / F badges on Standard 2-Page sheet
            const categoryBadgeLabels = { merit: 'M', background: 'B', flaw: 'F' };
            for (let rowNumber = 1; rowNumber <= 9; rowNumber++) {
                // document.getElementById finds the M/B/F category badge for each Advantage/Flaw row
                const categoryBadgeElement = document.getElementById('adv_flaw_type_' + rowNumber);
                if (categoryBadgeElement) {
                    const rowNameValue = String(normalizedSheet['adv_flaw_name_' + rowNumber] || '').trim();
                    const detectedCategory = detectAdvantageCategory(rowNameValue, normalizedSheet['adv_flaw_type_' + rowNumber]);
                    categoryBadgeElement.setAttribute('data-adv-type', detectedCategory);
                    categoryBadgeElement.textContent = categoryBadgeLabels[detectedCategory] || 'M';
                    categoryBadgeElement.classList.toggle('adv-badge-empty', !rowNameValue);
                    if (normalizedSheet['adv_flaw_type_' + rowNumber]) {
                        categoryBadgeElement.setAttribute('data-manual-override', 'true');
                    }
                }
            }
            
            // Seed specialties from native DB columns if they are not already in sheet_data
            if (normalizedSheet.specialties && typeof normalizedSheet.specialties === 'object') {
                for (const [skillKey, specialtyText] of Object.entries(normalizedSheet.specialties)) {
                    // document.getElementById locates the specialty input field for this skill
                    let specialtyInputElement = document.getElementById(skillKey + '_specialty');
                    if (specialtyInputElement && !specialtyInputElement.value.trim()) {
                        specialtyInputElement.value = specialtyText;
                    }
                }
            }
            
            // document.querySelectorAll iterates through all dot/square groups to render their saved ratings or box states
            document.querySelectorAll('.dot-group').forEach(dotGroupElement => {
                let savedGroupValue = normalizedSheet[dotGroupElement.id];
                if (dotGroupElement.id === 'health') savedGroupValue = savedGroupValue || normalizedSheet['health_states'];
                if (dotGroupElement.id === 'willpower') savedGroupValue = savedGroupValue || normalizedSheet['willpower_states'];
                if (dotGroupElement.id === 'humanity') savedGroupValue = savedGroupValue || normalizedSheet['humanity_states'];
                
                if (dotGroupElement.classList.contains('square-group') && typeof savedGroupValue === 'number') {
                    let maxBoxes = parseInt(dotGroupElement.getAttribute('data-max')) || 10;
                    const isRatingTracker = dotGroupElement.id === 'hunger' || dotGroupElement.id === 'humanity' || dotGroupElement.id === 'humanity_states';
                    savedGroupValue = Array.from({length: maxBoxes}, (_, boxIndex) => boxIndex < savedGroupValue ? (isRatingTracker ? 'filled' : 'empty') : (isRatingTracker ? 'empty' : 'filled'));
                }
                
                if (Array.isArray(savedGroupValue)) {
                    // querySelectorAll gets all individual square/dot elements inside this tracker
                    const dotElements = dotGroupElement.querySelectorAll('.dot');
                    dotElements.forEach((dotElement, dotIndex) => {
                        dotElement.classList.remove('active');
                        if (savedGroupValue[dotIndex]) dotElement.setAttribute('data-state', savedGroupValue[dotIndex]);
                        else dotElement.setAttribute('data-state', 'empty');
                    });
                } else {
                    renderCircularDotGroup(dotGroupElement);
                }
            });

            refreshAllXpVisuals();

            // If this existing character did not have a base_stats snapshot yet, persist the initial snapshot immediately
            if (!hadBaseStatsSnapshotBeforeLoad && !isReadonly) {
                triggerSave(null, true);
            }

            // setTimeout schedules applyRedaction to run after 50ms once all DOM updates have settled
            setTimeout(applyRedaction, 50);

        });
    }

    
    

    // --- UI: SAVE INDICATOR ---
    // document.createElement creates the floating toast notification element that shows save progress
    const saveIndicator = document.createElement('div');
    saveIndicator.id = 'sheet-save-indicator';
    saveIndicator.style.position = 'fixed';
    saveIndicator.style.top = '18px';
    saveIndicator.style.right = '20px';
    saveIndicator.style.padding = '8px 16px';
    saveIndicator.style.borderRadius = '4px';
    saveIndicator.style.fontFamily = '"Goudy Old Style", serif';
    saveIndicator.style.fontSize = '14px';
    saveIndicator.style.fontWeight = 'bold';
    saveIndicator.style.zIndex = '10002';
    saveIndicator.style.transition = 'opacity 0.3s';
    saveIndicator.style.opacity = '0';
    saveIndicator.style.pointerEvents = 'none';
    // document.body.appendChild adds the save indicator element to the page
    document.body.appendChild(saveIndicator);

    /**
     * Updates the UI to show the current save status of the character sheet.
     * 
     * This function displays a small, transient pop-up in the corner of the screen
     * indicating whether the sheet is currently saving, has saved successfully, or
     * encountered an error.
     * 
     * @param {string} saveState - The current save state: 'saving', 'saved', or 'error'.
     * @param {string} statusMessage - The text to display to the user in the indicator.
     */
    function showSaveState(saveState, statusMessage) {
        saveIndicator.style.opacity = '1';
        saveIndicator.innerText = statusMessage;
        if (saveState === 'saving') {
            saveIndicator.style.backgroundColor = '#f39c12';
            saveIndicator.style.color = '#fff';
        } else if (saveState === 'saved') {
            saveIndicator.style.backgroundColor = '#27ae60';
            saveIndicator.style.color = '#fff';
            // setTimeout hides the green 'All changes saved' banner after 2500 milliseconds
            setTimeout(() => { saveIndicator.style.opacity = '0'; }, 2500);
        } else if (saveState === 'error') {
            saveIndicator.style.backgroundColor = '#c0392b';
            saveIndicator.style.color = '#fff';
            // setTimeout fades out error banners after 4500 milliseconds
            setTimeout(() => { saveIndicator.style.opacity = '0'; }, 4500);
        }
    }

    // --- GLOBAL ERROR CATCHER ---
    // window.addEventListener listens for uncaught runtime JavaScript errors on the window
    window.addEventListener('error', (errorEvent) => {
        showSaveState('error', 'SCRIPT ERROR: ' + errorEvent.message);
        console.error("Global Sheet Error:", errorEvent.error);
    });
    // window.addEventListener listens for unhandled Promise rejections
    window.addEventListener('unhandledrejection', (rejectionEvent) => {
        showSaveState('error', 'PROMISE ERROR: ' + rejectionEvent.reason);
        console.error("Unhandled Rejection:", rejectionEvent.reason);
    });

    // 6. Save function
    let saveTimeout = null;
    /**
     * Gathers all data from the sheet inputs/dots, synchronizes cross-template fields,
     * and sends a save request to the server.
     * 
     * @param {string|null} overrideTemplate - An optional template name to save as the current template.
     * @param {boolean} immediate - If true, executes the save immediately and returns a Promise.
     * @returns {Promise<void>|undefined}
     */
    function triggerSave(overrideTemplate = null, immediate = false) {
        if (overrideTemplate && typeof overrideTemplate !== "string") overrideTemplate = null;
        if (!charId || isReadonly) return Promise.resolve();
        // clearTimeout cancels any pending debounced save timer so we don't fire redundant network requests while the user is still typing
        clearTimeout(saveTimeout);

        const performSave = () => {
            let updatedSheetData = Object.assign({}, currentSheetData);
            // document.querySelectorAll reads the current value of every input, textarea, and select element on the sheet
            document.querySelectorAll('input, textarea, select').forEach(formControlElement => {
                if (!formControlElement.id) return;
                // Skip floating toolbar/modal UI inputs so they are not saved as sheet fields
                if (
                    formControlElement.closest('#xp-sheet-top-dock') ||
                    formControlElement.id === 'sheetTemplateSelect' ||
                    formControlElement.id.startsWith('xp-') ||
                    formControlElement.id.startsWith('st-xp-') ||
                    formControlElement.id.startsWith('st-inline-xp-') ||
                    formControlElement.id === 'total_experience' ||
                    formControlElement.id === 'spent_experience' ||
                    formControlElement.id === 'total' ||
                    formControlElement.id === 'spent'
                ) {
                    return;
                }
                if (formControlElement.type === 'checkbox') {
                    updatedSheetData[formControlElement.id] = formControlElement.checked;
                } else {
                    updatedSheetData[formControlElement.id] = formControlElement.value;
                }
            });
            // document.querySelectorAll reads the current state of every dot rating group and square tracker group
            document.querySelectorAll('.dot-group').forEach(dotGroupElement => {
                if (!dotGroupElement.id) return;
                if (dotGroupElement.classList.contains('square-group')) {
                    // querySelectorAll collects the 'data-state' attribute from each square box in the tracker
                    const boxStates = Array.from(dotGroupElement.querySelectorAll('.dot')).map(dotElement => dotElement.getAttribute('data-state') || 'empty');
                    updatedSheetData[dotGroupElement.id] = boxStates;
                } else {
                    // For circular rating dots, the authoritative rating is base_stats + committed xp_upgrades (excluding uncommitted cart dots)
                    const baseDots = Number((updatedSheetData.base_stats && updatedSheetData.base_stats[dotGroupElement.id]) || 0);
                    const xpDots = Number((updatedSheetData.xp_upgrades && updatedSheetData.xp_upgrades[dotGroupElement.id]) || 0);
                    updatedSheetData[dotGroupElement.id] = baseDots + xpDots;
                }
            });

            // Save M / B / F badge categories from Standard 2-Page sheet if present
            // document.getElementById checks if the Standard 2-Page combined Advantages section is present in the DOM
            const hasStandardAdvantages = !!document.getElementById('adv_flaw_name_1');
            if (hasStandardAdvantages) {
                for (let rowNumber = 1; rowNumber <= 9; rowNumber++) {
                    // document.getElementById reads the M/B/F badge element for each Advantage/Flaw row
                    const categoryBadgeElement = document.getElementById('adv_flaw_type_' + rowNumber);
                    const advantageNameValue = updatedSheetData['adv_flaw_name_' + rowNumber];
                    if (categoryBadgeElement) {
                        updatedSheetData['adv_flaw_type_' + rowNumber] = detectAdvantageCategory(advantageNameValue, categoryBadgeElement.getAttribute('data-adv-type'));
                    }
                }
                syncAdvantagesAndSplitSections(updatedSheetData, 'from_combined');
            } else if (document.getElementById('merit_name_1')) {
                syncAdvantagesAndSplitSections(updatedSheetData, 'from_split');
            }

            // Persist explicit health_max and willpower_max capacities so 10-box <-> 15-box transitions never corrupt
            if (Array.isArray(updatedSheetData.health_states)) {
                updatedSheetData.health_max = updatedSheetData.health_states.filter(boxState => boxState !== 'filled').length;
            }
            if (Array.isArray(updatedSheetData.willpower_states)) {
                updatedSheetData.willpower_max = updatedSheetData.willpower_states.filter(boxState => boxState !== 'filled').length;
            }

            // Keep cross-template aliases in sync
            updatedSheetData.predator_type = updatedSheetData.predator;
            updatedSheetData.total = String(updatedSheetData.total_experience || '0');
            updatedSheetData.spent = String(updatedSheetData.spent_experience || '0');
            updatedSheetData.hunting = updatedSheetData.hunting_roll;
            updatedSheetData.touchstones__convictions = updatedSheetData.touchstones_convictions;

            // Retain the template choice
            const currentTemplateFilename = overrideTemplate || window.location.pathname.split('/').pop() || 'V5-Character-Sheet.html';
            updatedSheetData.sheet_template = currentTemplateFilename;
            currentSheetData = updatedSheetData;
            
            showSaveState('saving', 'Saving...');
            // localStorage.getItem retrieves the user's authentication token from browser storage
            const authToken = localStorage.getItem('vtm_auth_token');
            // fetch sends an HTTP PUT request with JSON.stringify payload to save the updated sheet data on the server
            return fetch(`/api/characters/${charId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': authToken ? `Bearer ${authToken}` : ''
                },
                body: JSON.stringify({ sheet_data: updatedSheetData })
            }).then(async (saveResponse) => {
                if (!saveResponse.ok) {
                    let errorMessage = saveResponse.statusText;
                    try {
                        const errorResponseData = await saveResponse.json();
                        errorMessage = errorResponseData.error || errorMessage;
                    } catch(jsonParseError) {}
                    console.error('[CRITICAL] Sheet Save Failed:', saveResponse.status, errorMessage);
                    showSaveState('error', 'SAVE FAILED: ' + errorMessage);
                    alert('Save Failed! Your changes were rejected by the server: ' + errorMessage);
                } else {
                    showSaveState('saved', 'All changes saved.');
                    // Broadcast the updated state to the parent window so the main app cache stays perfectly synced
                    // window.parent.postMessage notifies the parent Virtual Tabletop frame that the character sheet data was updated
                    window.parent.postMessage({
                        type: 'vtm:sheet_updated',
                        char_id: charId,
                        sheet_data: updatedSheetData
                    }, '*');
                }
            }).catch(networkError => {
                console.error('[CRITICAL] Network error during save:', networkError);
                showSaveState('error', 'NETWORK ERROR');
                alert('Network Error! Could not reach the server to save your changes.');
            });
        };

        if (immediate) {
            return performSave();
        }
        // setTimeout debounces the save call by waiting 500ms after the user's last edit before sending the network request
        saveTimeout = setTimeout(performSave, 500);
    }
});


// --- PRIVACY & CONCEALMENT LOGIC ---
let privacyEditMode = false;
let concealedFields = [];
// URLSearchParams reads the 'char_id' and 'readonly' query parameters from the current page URL
let localCharId = new URLSearchParams(window.location.search).get('char_id');
let isSheetReadonly = new URLSearchParams(window.location.search).get('readonly') === 'true';

let newDisciplines = [];
for (let disciplineIndex = 0; disciplineIndex <= 5; disciplineIndex++) {
    newDisciplines.push('discipline_name_' + disciplineIndex);
    newDisciplines.push('discipline_dots_' + disciplineIndex);
    for (let powerIndex = 0; powerIndex < 5; powerIndex++) {
        newDisciplines.push('discipline_power_' + disciplineIndex + '_' + powerIndex);
    }
}
let newAdvantages = [];
for (let rowNumber = 1; rowNumber <= 9; rowNumber++) {
    newAdvantages.push('adv_flaw_name_' + rowNumber);
    newAdvantages.push('adv_flaw_rating_' + rowNumber);
}
for (let rowNumber = 1; rowNumber <= 12; rowNumber++) {
    newAdvantages.push('merit_name_' + rowNumber, 'merit_rating_' + rowNumber);
    if (rowNumber <= 10) newAdvantages.push('background_name_' + rowNumber, 'background_rating_' + rowNumber);
    newAdvantages.push('flaw_name_' + rowNumber, 'flaw_rating_' + rowNumber);
}

const SECTION_MAP = {
    'section_profile': { label: 'Profile', fields: ['name', 'concept', 'predator', 'chronicle', 'ambition', 'clan', 'sire', 'desire', 'generation', 'title', 'true_age', 'apparent_age', 'date_of_birth', 'date_of_death'] },
    'section_attributes': { label: 'Attributes', fields: ['strength', 'dexterity', 'stamina', 'charisma', 'manipulation', 'composure', 'intelligence', 'wits', 'resolve'] },
    'section_vitals': { label: 'Vitals & Trackers', fields: ['health_states', 'willpower_states', 'humanity_states', 'hunger'] },
    'section_skills': { label: 'Skills', fields: ['athletics', 'brawl', 'craft', 'drive', 'firearms', 'larceny', 'melee', 'stealth', 'survival', 'animal_ken', 'etiquette', 'insight', 'intimidation', 'leadership', 'performance', 'persuasion', 'streetwise', 'subterfuge', 'academics', 'awareness', 'finance', 'investigation', 'medicine', 'occult', 'politics', 'science', 'technology'] },
    'section_disciplines': { label: 'Disciplines', fields: newDisciplines },
    'section_advantages': { label: 'Advantages', fields: newAdvantages },
    'section_biography': { label: 'Biography', fields: ['chronicle_tenets', 'touchstones_convictions', 'clan_bane', 'notes', 'history', 'appearance', 'distinguishing_features', 'possessions', 'haven_location', 'haven_location_notes', 'haven_description', 'haven_notes'] }
};

/**
 * Global message listener for privacy/redaction updates.
 * 
 * If a 'APPLY_REDACTION' message is received (typically from the parent VTT window),
 * it updates the list of fields/sections the current user is not allowed to see.
 * If the sheet is in readonly mode and redaction rules have changed, it forces a page reload
 * to ensure sensitive data is properly wiped from the initial HTML. Otherwise, it simply
 * re-applies the visual redaction rules.
 * 
 * @param {MessageEvent} messageEvent - The message event containing redaction data.
 * @listens window#message
 */
// window.addEventListener listens for 'APPLY_REDACTION' messages sent from the parent VTT window
window.addEventListener('message', (messageEvent) => {
    if (messageEvent.data && messageEvent.data.type === 'APPLY_REDACTION') {
        if (Array.isArray(messageEvent.data.concealedFields)) {
            // JSON.stringify serializes the old and new concealedFields arrays so we can compare if the privacy rules changed
            const previousConcealedJson = JSON.stringify(concealedFields);
            const updatedConcealedJson = JSON.stringify(messageEvent.data.concealedFields);
            concealedFields = messageEvent.data.concealedFields;

            // Only force a reload if this viewer is actively being restricted by redactions
            // AND the redaction rules actually changed.
            if (isSheetReadonly && previousConcealedJson !== updatedConcealedJson) {
                const reloadUrl = new URL(window.location.href);
                reloadUrl.searchParams.set('_t', Date.now());
                window.location.href = reloadUrl.toString();
            } else {
                applyRedaction();
            }
        }
    }
});

// APPLY REDACTION FOR NON-OWNERS, STORYTELLER PLAYER PREVIEW, AND OWNER/STORYTELLER LIVE REDACTION INDICATORS
/**
 * Applies visual redaction or redaction indicators to the character sheet based on `concealedFields`:
 * 1. When viewed by another player (`isSheetReadonly`) OR when the Storyteller enables "👁️ View as Player" (`window.isSheetPlayerPreviewActive`),
 *    concealed fields and dot groups are masked with bold crimson `[REDACTED]` text (reversibly, so exiting Player Preview restores all original values).
 * 2. When viewed by the Character Owner or Storyteller in normal/edit mode, the real values remain visible and editable,
 *    and concealed fields/dot groups are marked with `data-vtm-redacted="true"` (crimson dashed outline + subtle crimson tint)
 *    so the Owner/Storyteller can see their sheet and what is redacted at the same time.
 */
function applyRedaction() {
    const shouldMaskRedactedContent = Boolean(isSheetReadonly || window.isSheetPlayerPreviewActive);
    const activeConcealedList = Array.isArray(concealedFields) ? concealedFields : [];

    // document.querySelectorAll selects all inputs, dropdowns, textareas, and dot groups on the character sheet
    document.querySelectorAll('.sheet-page input, .sheet-page select, .sheet-page textarea, .sheet-page .dot-group').forEach(sheetElement => {
        if (!sheetElement.id) return;

        let canonicalFieldId = sheetElement.id;
        if (canonicalFieldId === 'health') canonicalFieldId = 'health_states';
        if (canonicalFieldId === 'willpower') canonicalFieldId = 'willpower_states';
        if (canonicalFieldId === 'humanity') canonicalFieldId = 'humanity_states';

        let parentSectionId = 'unknown';
        for (const [sectionKey, sectionMetadata] of Object.entries(SECTION_MAP)) {
            if (sectionMetadata.fields.includes(canonicalFieldId) || sectionMetadata.fields.includes(sheetElement.id)) {
                parentSectionId = sectionKey;
                break;
            }
        }
        if (parentSectionId === 'unknown' && sheetElement.id.endsWith('_specialty')) {
            parentSectionId = 'section_skills';
        }

        const baseSkillForSpecialty = sheetElement.id.endsWith('_specialty')
            ? sheetElement.id.replace(/_specialty$/, '')
            : null;

        const isSectionConcealed = activeConcealedList.includes(parentSectionId);
        const isFieldConcealed =
            activeConcealedList.includes(sheetElement.id) ||
            activeConcealedList.includes(canonicalFieldId) ||
            Boolean(baseSkillForSpecialty && activeConcealedList.includes(baseSkillForSpecialty));
        const isElementConcealed = isSectionConcealed || isFieldConcealed;

        // Step 1: If this element was previously masked by Player Preview (or a prior redaction state) and now needs to be unmasked, restore it first
        if (sheetElement.dataset.vtmMaskedByPreview === 'true' && (!shouldMaskRedactedContent || !isElementConcealed)) {
            if (sheetElement.tagName === 'INPUT' || sheetElement.tagName === 'TEXTAREA') {
                if (sheetElement.dataset.vtmOriginalValue !== undefined) {
                    sheetElement.value = sheetElement.dataset.vtmOriginalValue;
                }
                sheetElement.style.color = sheetElement.dataset.vtmOriginalColor || '';
                sheetElement.style.fontWeight = sheetElement.dataset.vtmOriginalWeight || '';
                sheetElement.readOnly = isSheetReadonly;
            } else if (sheetElement.tagName === 'SELECT') {
                // querySelector locates the temporary [REDACTED] option injected during preview masking
                const previewRedactedOpt = sheetElement.querySelector('option.vtm-preview-redacted-opt');
                if (previewRedactedOpt) previewRedactedOpt.remove();
                if (sheetElement.dataset.vtmOriginalValue !== undefined) {
                    sheetElement.value = sheetElement.dataset.vtmOriginalValue;
                }
                sheetElement.style.color = sheetElement.dataset.vtmOriginalColor || '';
                sheetElement.style.fontWeight = sheetElement.dataset.vtmOriginalWeight || '';
                sheetElement.disabled = isSheetReadonly;
            } else if (sheetElement.classList.contains('dot-group')) {
                sheetElement.style.display = '';
                // querySelector locates the temporary [REDACTED] span injected next to the dot group
                const existingRedactedSpan = sheetElement.parentElement ? sheetElement.parentElement.querySelector('.redacted-text') : null;
                if (existingRedactedSpan) existingRedactedSpan.remove();
            }
            delete sheetElement.dataset.vtmMaskedByPreview;
        }

        // Step 2: Apply either masked [REDACTED] view (for other players / Player Preview) or live Owner/ST redaction badge
        if (isElementConcealed) {
            if (shouldMaskRedactedContent) {
                sheetElement.removeAttribute('data-vtm-redacted');
                if (sheetElement.tagName === 'INPUT' || sheetElement.tagName === 'TEXTAREA') {
                    if (sheetElement.dataset.vtmMaskedByPreview !== 'true') {
                        sheetElement.dataset.vtmOriginalValue = sheetElement.value;
                        sheetElement.dataset.vtmOriginalColor = sheetElement.style.color || '';
                        sheetElement.dataset.vtmOriginalWeight = sheetElement.style.fontWeight || '';
                    }
                    sheetElement.value = '[REDACTED]';
                    sheetElement.style.color = '#ef4444';
                    sheetElement.style.fontWeight = 'bold';
                    sheetElement.readOnly = true;
                    sheetElement.dataset.vtmMaskedByPreview = 'true';
                } else if (sheetElement.tagName === 'SELECT') {
                    if (sheetElement.dataset.vtmMaskedByPreview !== 'true') {
                        sheetElement.dataset.vtmOriginalValue = sheetElement.value;
                        sheetElement.dataset.vtmOriginalColor = sheetElement.style.color || '';
                        sheetElement.dataset.vtmOriginalWeight = sheetElement.style.fontWeight || '';
                    }
                    if (!sheetElement.querySelector('option.vtm-preview-redacted-opt')) {
                        // document.createElement creates a temporary '[REDACTED]' <option> to mask the select dropdown's value
                        const redactedOptionElement = document.createElement('option');
                        redactedOptionElement.className = 'vtm-preview-redacted-opt';
                        redactedOptionElement.value = '__vtm_redacted__';
                        redactedOptionElement.textContent = '[REDACTED]';
                        sheetElement.appendChild(redactedOptionElement);
                    }
                    sheetElement.value = '__vtm_redacted__';
                    sheetElement.style.color = '#ef4444';
                    sheetElement.style.fontWeight = 'bold';
                    sheetElement.disabled = true;
                    sheetElement.dataset.vtmMaskedByPreview = 'true';
                } else if (sheetElement.classList.contains('dot-group')) {
                    sheetElement.style.display = 'none';
                    if (sheetElement.parentElement && !sheetElement.parentElement.querySelector('.redacted-text')) {
                        // document.createElement creates a <span> displaying '[REDACTED]' in place of the hidden dot group
                        const redactedLabelSpan = document.createElement('span');
                        redactedLabelSpan.className = 'redacted-text';
                        redactedLabelSpan.textContent = '[REDACTED]';
                        redactedLabelSpan.style.color = '#ef4444';
                        redactedLabelSpan.style.fontWeight = 'bold';
                        redactedLabelSpan.style.marginLeft = '10px';
                        redactedLabelSpan.style.fontFamily = 'monospace';
                        redactedLabelSpan.style.fontSize = '13px';
                        sheetElement.parentElement.appendChild(redactedLabelSpan);
                    }
                    sheetElement.dataset.vtmMaskedByPreview = 'true';
                }
            } else {
                // Owner or Storyteller viewing their live sheet: keep real value readable and highlight with data-vtm-redacted
                sheetElement.setAttribute('data-vtm-redacted', 'true');
                sheetElement.title = '🙈 REDACTED for other players (Visible to you)';
            }
        } else {
            sheetElement.removeAttribute('data-vtm-redacted');
            if (sheetElement.title === '🙈 REDACTED for other players (Visible to you)') {
                sheetElement.removeAttribute('title');
            }
        }
    });
}

