import re
import sys

file_path = '/home/tohkatakushi/vtm-chronicle/public/js/character_wizard.js'

with open(file_path, 'r') as f:
    content = f.read()

docstrings = {
    'openCharacterCreatorModal': '''/**
 * Opens the character creation wizard modal and resets all progress.
 * This is triggered when the user starts creating a new character.
 * It resets the global `cw_step` counter, clears the current character data (`cw_char`),
 * and brings up the modal UI by changing its CSS display style.
 *
 * @returns {void} No return value.
 * @interacts Modifies the `cw_char` object, displays `#characterCreatorModal`, and calls `renderWizardStep()`.
 */''',
    'closeCharacterCreator': '''/**
 * Closes the character creation wizard modal.
 * This hides the wizard without saving or completing the process.
 *
 * @returns {void} No return value.
 * @interacts Hides the `#characterCreatorModal` by setting its display style to 'none'.
 */''',
    'suggestClan': '''/**
 * Analyzes the user's answers to the personality quiz (Step 2) to suggest a Vampire Clan.
 * It maps each quiz answer to specific traits (like "aggressive", "stealthy", "social"),
 * then counts how many traits match each available Clan's traits.
 *
 * @returns {string} The name of the clan that best matches the user's quiz answers. Ties are broken randomly.
 * @interacts Reads from `cw_char.quiz_answers` and `V5_DATA.clans`.
 */''',
    'nextWizardStep': '''/**
 * Advances the character creation wizard to the next step.
 * It includes validation logic to ensure the user has filled out the current step correctly
 * (e.g., answered all quiz questions, distributed all attribute/skill points).
 * If validation fails, it shows an error message. If it succeeds, it saves the step data and moves forward.
 *
 * @returns {void} No return value.
 * @interacts Reads DOM inputs, updates `cw_step`, calls `saveWizardStep()`, `showWizardError()`, `renderWizardStep()`, and eventually `submitWizardCharacter()`.
 */''',
    'prevWizardStep': '''/**
 * Moves the character creation wizard back to the previous step.
 * Allows the user to revise earlier choices.
 *
 * @returns {void} No return value.
 * @interacts Decrements `cw_step` and calls `renderWizardStep()` to update the UI.
 */''',
    'renderWizardStep': '''/**
 * Renders the HTML content for the current step of the character wizard.
 * Uses the global `cw_step` variable to determine what UI elements (forms, drag-drops, quizzes)
 * should be displayed inside the `#cw-content` container.
 *
 * @returns {void} No return value.
 * @interacts Modifies the DOM (specifically `#cw-title`, `#cw-prompt`, `#cw-content`), reads `cw_prompts` and `cw_char`.
 */''',
    'updatePowerSelects': '''/**
 * Updates the Discipline Power selection dropdowns dynamically.
 * Based on which Disciplines the user chooses for their Best (2 dots) and Second Best (1 dot) powers,
 * this function populates the relevant Level 1 and Level 2 power choices.
 *
 * @returns {void} No return value.
 * @interacts Reads values from `#cw_disc1` and `#cw_disc2`, accesses `V5_DISCIPLINES`, and populates `#cw_disc1_powers` and `#cw_disc2_powers`.
 */''',
    'selectWizardClan': '''/**
 * Selects a vampire clan in Step 3 of the wizard and visually highlights the chosen clan.
 *
 * @param {string} clan - The name of the clan the user clicked on.
 * @returns {void} No return value.
 * @interacts Updates `cw_char.clan`, and modifies CSS backgrounds and borders of clan cards in the DOM.
 */''',
    'updateAgeSelection': '''/**
 * Updates the user's Generation/Age selection in Step 4.
 * Changes visual highlighting for the chosen generation card (Fledgling, Neonate, or Ancilla).
 *
 * @param {HTMLElement} radio - The radio button element that was changed.
 * @returns {void} No return value.
 * @interacts Updates `cw_char.generation` and visually updates the styling of the radio button's parent label.
 */''',
    'updatePredatorSelection': '''/**
 * Updates the selected Predator Type (hunting style) in Step 8.
 * Applies visual highlighting to the selected predator type's card.
 *
 * @param {HTMLElement} labelElement - The label element encapsulating the predator type choice.
 * @returns {void} No return value.
 * @interacts Updates `cw_char.predator_type` based on the child radio input and modifies DOM styles.
 */''',
    'updateAdvantageUI': '''/**
 * Dynamically updates the Advantage/Flaw creation UI (Step 9) when a new perk or problem is selected.
 * Changes the description placeholder, fetches the glossary definition, and restricts the dot rating
 * input to the correct minimum and maximum values based on the selected trait.
 *
 * @param {string} type - Either 'merit' or 'flaw', determining which UI section to update.
 * @returns {void} No return value.
 * @interacts Reads from dropdowns (`#cw_add_merit_name`, etc.), accesses `V5_ADVANTAGES_GLOSSARY`, and modifies input constraints.
 */''',
    'renderCartUI': '''/**
 * Re-renders the shopping-cart style lists of selected Merits and Flaws in Step 9.
 * Shows the current total points versus the required points for the character's generation.
 *
 * @returns {void} No return value.
 * @interacts Reads `cw_char.merits` and `cw_char.flaws`, and updates `#cw_cart_merits` and `#cw_cart_flaws`.
 */''',
    'addCartItem': '''/**
 * Adds a new Merit or Flaw to the character's temporary "cart" in Step 9.
 * Validates that a name was selected and adds it to the `cw_char` object.
 *
 * @param {string} type - Either 'merit' or 'flaw' to specify what is being added.
 * @returns {void} No return value.
 * @interacts Reads input fields, pushes data to `cw_char.merits` or `cw_char.flaws`, and calls `renderCartUI()`.
 */''',
    'removeCartItem': '''/**
 * Removes a Merit or Flaw from the character's list in Step 9 by index.
 *
 * @param {string} type - Either 'merit' or 'flaw'.
 * @param {number} index - The array index of the item to remove.
 * @returns {void} No return value.
 * @interacts Splices elements out of `cw_char.merits` or `cw_char.flaws`, and calls `renderCartUI()`.
 */''',
    'saveWizardStep': '''/**
 * Saves the user's input from the current wizard step into the global `cw_char` object.
 * This runs when the user clicks "Next", ensuring data isn't lost as they move forward.
 *
 * @returns {void} No return value.
 * @interacts Reads various DOM inputs depending on `cw_step` and maps them to `cw_char` properties.
 */''',
    'submitWizardCharacter': '''/**
 * Finalizes the character creation process.
 * Applies final modifiers (like generation bonuses/penalties), packages the `cw_char` data,
 * and sends an asynchronous POST request to the server to save the new character in the database.
 *
 * @returns {Promise<void>} An asynchronous promise representing the submission operation.
 * @interacts Sends a fetch request to `/api/characters`, closes the wizard on success, and reloads the character list via `fetchCharacters()`.
 */''',
    'renderAttrDragDrop': '''/**
 * Generates the HTML for the interactive drag-and-drop Attribute point distributor (Step 5).
 * Creates a pool of draggable tokens representing attribute dots (4, 3, 3, 3, 2, 2, etc.)
 * and target slots for each attribute (Strength, Dexterity, etc.).
 *
 * @returns {string} The HTML string representing the attribute drag-and-drop UI.
 * @interacts Uses `cw_char.attributes` to determine current dot placements.
 */''',
    'cwDragStart': '''/**
 * Handles the start of a drag-and-drop action for an attribute token.
 * Stores the token's value in the event's dataTransfer object so it can be read when dropped.
 *
 * @param {DragEvent} ev - The HTML drag event.
 * @param {string} val - The numeric value of the dragged dot token.
 * @returns {void} No return value.
 * @interacts Modifies the `ev.dataTransfer` payload.
 */''',
    'cwAllowDrop': '''/**
 * Allows an element to accept dragged items by preventing the default browser behavior.
 * This is a standard HTML5 drag-and-drop requirement.
 *
 * @param {DragEvent} ev - The HTML drag event.
 * @returns {void} No return value.
 * @interacts Calls `ev.preventDefault()`.
 */''',
    'cwDrop': '''/**
 * Handles the event when an attribute token is dropped onto an attribute slot.
 * Assigns the token's value to the corresponding attribute and re-renders the UI.
 *
 * @param {DragEvent} ev - The HTML drag event.
 * @param {string} attr - The name of the attribute receiving the points.
 * @returns {void} No return value.
 * @interacts Reads `ev.dataTransfer`, updates `cw_char.attributes`, and calls `renderWizardStep()`.
 */''',
    'cwTokenClick': '''/**
 * Provides an alternative to dragging by allowing mobile/desktop users to click a token to select it.
 * Marks the token as active so the next clicked attribute slot receives its value.
 *
 * @param {string} val - The numeric value of the clicked dot token.
 * @returns {void} No return value.
 * @interacts Sets the global `cw_active_token` and re-renders the step.
 */''',
    'cwAttrClick': '''/**
 * Receives the value of the currently active (clicked) token into the specified attribute slot.
 * Acts as the second half of the click-to-place mechanic (the alternative to drag-and-drop).
 *
 * @param {string} attr - The name of the attribute being clicked.
 * @returns {void} No return value.
 * @interacts Uses `cw_active_token`, updates `cw_char.attributes`, clears `cw_active_token`, and re-renders.
 */''',
    'updateSkillArrayType': '''/**
 * Updates the chosen Skill Distribution array (e.g., Balanced, Specialist, Jack-of-all-Trades) in Step 6.
 * Resets all current skill assignments to 0 so the user can start over with the new array.
 *
 * @param {HTMLSelectElement} sel - The select element containing the chosen array type.
 * @returns {void} No return value.
 * @interacts Updates `cw_skill_array_type`, resets `cw_char.skills`, and re-renders the skill drag-and-drop UI.
 */''',
    'renderSkillDragDrop': '''/**
 * Generates the HTML for the Skill point distributor (Step 6).
 * Creates a pool of dot tokens based on the chosen skill array type, and lists all available skills.
 *
 * @returns {string} The HTML string representing the skill assignment UI.
 * @interacts Uses `cw_skill_array_type`, `SKILL_ARRAYS`, and `cw_char.skills`.
 */''',
    'refreshSkillUI': '''/**
 * Efficiently re-renders just the skill token pool and skill lists without re-rendering the entire step.
 * Useful for fast updates during drag-and-drop operations.
 *
 * @returns {void} No return value.
 * @interacts Modifies `#cw-skill-container` inner HTML by calling `renderSkillDragDrop()`.
 */''',
    'cwSkillDragStart': '''/**
 * Handles the start of a drag-and-drop action for a skill token.
 *
 * @param {DragEvent} ev - The HTML drag event.
 * @param {string} val - The numeric value of the dragged skill token.
 * @returns {void} No return value.
 * @interacts Modifies the `ev.dataTransfer` payload.
 */''',
    'cwSkillDrop': '''/**
 * Handles dropping a skill token onto a specific skill.
 * Validates that the skill doesn't already exceed maximum points and updates the character's skill tally.
 *
 * @param {DragEvent} ev - The HTML drag event.
 * @param {string} sk - The name of the skill receiving the points.
 * @returns {void} No return value.
 * @interacts Updates `cw_char.skills`, calculates remaining available dots, and calls `refreshSkillUI()`.
 */''',
    'cwSkillTokenClick': '''/**
 * Click-to-place alternative for skill tokens.
 * Marks a skill point token as active to be assigned on the next skill click.
 *
 * @param {string} val - The numeric value of the clicked skill token.
 * @returns {void} No return value.
 * @interacts Sets `cw_active_token` and calls `refreshSkillUI()`.
 */''',
    'cwSkillClick': '''/**
 * Click-to-place receiver for skill slots.
 * Assigns the previously clicked active token's value to the clicked skill.
 *
 * @param {string} sk - The name of the skill being clicked.
 * @returns {void} No return value.
 * @interacts Uses `cw_active_token`, updates `cw_char.skills`, clears the active token, and calls `refreshSkillUI()`.
 */''',
    'showWizardError': '''/**
 * Displays an error message inside the wizard UI (usually when validation fails).
 *
 * @param {string} msg - The error text to display to the user.
 * @returns {void} No return value.
 * @interacts Changes the display style and text content of the `#cw-error` DOM element.
 */'''
}

new_content = []
lines = content.split('\n')

for i, line in enumerate(lines):
    # Regex to find standard function definitions
    match = re.match(r'^(async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(', line.strip())
    if match:
        func_name = match.group(2)
        if func_name in docstrings:
            new_content.append(docstrings[func_name])
    new_content.append(line)

with open(file_path, 'w') as f:
    f.write('\n'.join(new_content))

print("Docstrings added successfully.")
