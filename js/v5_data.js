/**
 * @file v5_data.js
 * @description 
 * This file contains static configuration data for the Vampire: The Masquerade 5th Edition 
 * character creation tool. It holds constants defining clans, predator types, merits, 
 * flaws, disciplines, and glossaries. 
 * 
 * Because this data is static, it's stored here rather than in a database to allow for 
 * fast, synchronous reads on the client side. Other modules import or reference these 
 * constants to render the UI and validate user input.
 */

/**
 * Core dataset for Vampire: The Masquerade 5th Edition (V5) character generation.
 * 
 * This object acts as a localized database containing the foundational options
 * a player can select when creating or modifying a character. 
 * 
 * It is typically accessed by UI components to populate dropdowns or lists,
 * and by state management functions to validate character choices (e.g., 
 * ensuring a chosen discipline belongs to the selected clan).
 */
const V5_DATA = {
    clans: {
        "Brujah": {
            disciplines: ["Celerity", "Potence", "Presence"],
            desc: "Rebels, philosophers, and punks. The Brujah are passionate and prone to fury, fighting fiercely for the causes they believe in.",
            bane: "Violent Temper: Subtract dice equal to Bane Severity from any roll to resist fury frenzy (cannot take a result below 1 die).",
            compulsion: "Rebellion: Stand against the status quo or whoever holds authority in the scene; suffer a -2 penalty to all rolls until you change someone's mind or defy an order.",
            traits: ["rebel", "aggressive", "passionate", "street"]
        },
        "Gangrel": {
            disciplines: ["Animalism", "Fortitude", "Protean"],
            desc: "Fierce, animalistic survivors. The Gangrel shun high society, preferring the wilds and embracing their beastly nature.",
            bane: "Bestial Features: In frenzy, gain one animal trait per point of Bane Severity for the rest of the night and the next, reducing one Attribute by 1 per trait.",
            compulsion: "Feral Impulses: Regress to an animalistic state for one scene; -3 dice penalty to all Manipulation and Intelligence rolls, and can only speak in one-word sentences.",
            traits: ["loner", "nature", "survivor", "aggressive"]
        },
        "Malkavian": {
            disciplines: ["Auspex", "Dominate", "Obfuscate"],
            desc: "Oracles and visionaries. Every Malkavian is cursed with a fractured mind, yet gifted with terrifying insight into the unseen.",
            bane: "Fractured Perspective: When afflicted by a Bestial Failure or Compulsion, suffer a penalty equal to Bane Severity to one category of dice pools (Physical, Social, or Mental) for the scene.",
            compulsion: "Delusion: Experience phantom truths or overwhelming visions; suffer a -2 dice penalty to rolls involving Dexterity, Manipulation, Composure, and Wits for the scene.",
            traits: ["insightful", "unpredictable", "knowledge", "stealthy"]
        },
        "Nosferatu": {
            disciplines: ["Animalism", "Obfuscate", "Potence"],
            desc: "Hideously twisted by the Embrace. They rule the shadows and underbelly of the city, trading secrets and information.",
            bane: "Repulsiveness: Automatically have the Repulsive Flaw (-2 to relevant Social pools) and add Bane Severity as penalty dice to any attempt to disguise themselves as human.",
            compulsion: "Cryptophilia: Driven by a hunger for secrets; suffer a -2 penalty to all actions that do not work toward learning a significant secret.",
            traits: ["stealthy", "secrets", "street", "survivor"]
        },
        "Toreador": {
            disciplines: ["Auspex", "Celerity", "Presence"],
            desc: "Artists, divas, and Hedonists. The Toreador are obsessed with beauty, passion, and the thrill of mortal high society.",
            bane: "Aesthetic Fixation: When in less-than-beautiful surroundings, lose dice equal to Bane Severity from pools to use Disciplines.",
            compulsion: "Obsession: Become enthralled by a single gorgeous detail (a person, artwork, blood, or sensation); take a -2 penalty to any other actions until the scene ends or the object is gone.",
            traits: ["social", "artistic", "passionate", "elite"]
        },
        "Tremere": {
            disciplines: ["Auspex", "Blood Sorcery", "Dominate"],
            desc: "Warlocks and scholars of blood magic. Once a rigid pyramid, they remain secretive and obsessed with occult mastery.",
            bane: "Deficient Blood: Tremere vitae can no longer Blood Bond other Kindred, and creating a mortal Blood Bond requires extra drinks equal to Bane Severity.",
            compulsion: "Perfectionism: Nothing but the best satisfies; suffer a -2 penalty to all dice pools until you score a critical win on a Skill roll or the scene ends.",
            traits: ["knowledge", "secrets", "structured", "manipulative"]
        },
        "Ventrue": {
            disciplines: ["Dominate", "Fortitude", "Presence"],
            desc: "Kings, executives, and patricians. The Ventrue demand obedience and claim the right to rule over both Kindred and kine.",
            bane: "Rarefied Tastes: Can only feed from a specific subset of mortal vessels; feeding from anyone else costs Willpower equal to Bane Severity or the blood is vomited up.",
            compulsion: "Arrogance: Need to rule and be obeyed; take a -2 penalty to any action not directly associated with leadership until someone obeys an order not obtained via supernatural means.",
            traits: ["elite", "manipulative", "structured", "leader"]
        },
        "Banu Haqim": {
            disciplines: ["Blood Sorcery", "Celerity", "Obfuscate"],
            desc: "Judges, lawgivers, and assassins. The Banu Haqim follow a strict code of blood and justice, hunting the guilty.",
            bane: "Blood Addiction: Tasting another vampire's blood triggers a Frenzy test at Difficulty 2 + Bane Severity to resist gorging on Kindred vitae.",
            compulsion: "Judgment: Driven to punish anyone seen transgressing against personal convictions; must slake at least 1 Hunger from the offender or suffer -3 dice to all rolls.",
            traits: ["structured", "aggressive", "stealthy", "justice"]
        },
        "Hecata": {
            disciplines: ["Auspex", "Fortitude", "Oblivion"],
            desc: "Necromancers and crime families of the Clan of Death. Insular, ruthless, and intimately bound to ghosts and the Underworld.",
            bane: "Painful Kiss: Their bite brings excruciating agony instead of euphoria; mortal vessels must be restrained or take Stamina +2 Aggravated Health damage from shock.",
            compulsion: "Morbidity: Consumed by curiosity about illness, frailty, or impending death; suffer a -3 dice penalty to other rolls until they predict or solve a nearby death.",
            traits: ["secrets", "knowledge", "elite", "death"]
        },
        "Lasombra": {
            disciplines: ["Dominate", "Oblivion", "Potence"],
            desc: "Ruthless social Darwinists and masters of the Abyss. They pull strings from the shadows and wield living darkness.",
            bane: "Distorted Image: Reflections, recordings, and modern touchscreens/microphones warp, flicker, or fail; +Bane Severity difficulty to use modern communication tech.",
            compulsion: "Ruthlessness: Failure is unacceptable; on the next failed action, all subsequent rolls take a penalty until a roll succeeds at any cost.",
            traits: ["manipulative", "leader", "elite", "ruthless"]
        },
        "The Ministry": {
            disciplines: ["Obfuscate", "Presence", "Protean"],
            desc: "Tempters, liberators, and cult leaders. They break mortal and Kindred chains through transgression, desire, and faith.",
            bane: "Abhorrence of Light: Bright direct light imposes a dice penalty equal to Bane Severity, and increases sunlight damage by Bane Severity.",
            compulsion: "Transgression: Urged to shatter someone's moral guard or Chronicle Tenets; suffer -2 dice to all rolls not aimed at coaxing someone to break a Conviction or Tenet.",
            traits: ["manipulative", "social", "rebel", "passionate"]
        },
        "Ravnos": {
            disciplines: ["Animalism", "Obfuscate", "Presence"],
            desc: "Nomads, tricksters, and illusionists. Haunted by the sun's fire that destroyed their founder, they never stay still for long.",
            bane: "Doomed: Sleeping in the same place more than once within seven days inflicts Aggravated damage equal to Bane Severity rolled as dice.",
            compulsion: "Tempting Fate: Driven to take the most daring, high-risk approach to any problem; suffer -2 dice on safe or cautious approaches.",
            traits: ["stealthy", "street", "loner", "unpredictable"]
        },
        "Salubri": {
            disciplines: ["Auspex", "Dominate", "Fortitude"],
            desc: "Fugitive healers and cyclops mystics with a third eye. Hunted to the brink of extinction, they seek redemption and Golconda.",
            bane: "Hunted & Weeping Eye: Their vitae is dangerously addictive to other Kindred, and using any Discipline causes their third eye to weep vitae (triggering Hunger frenzy tests nearby).",
            compulsion: "Affective Empathy: Overwhelmed by another's suffering or problem; suffer -2 dice to rolls not aimed at easing that person's burden.",
            traits: ["human", "insightful", "justice"]
        },
        "Tzimisce": {
            disciplines: ["Animalism", "Dominate", "Protean"],
            desc: "Old-world dragons and flesh-shapers. Intensely territorial and possessive, they sculpt flesh, bone, and domain into their vision.",
            bane: "Grounded: Must sleep surrounded by their chosen charge (native soil, a hoarded possession, or loyal followers) or suffer Willpower damage equal to Bane Severity.",
            compulsion: "Covetousness: Obsessed with possessing something or someone in the scene; suffer -2 dice to any action that does not secure ownership of the prize.",
            traits: ["knowledge", "loner", "ruthless", "territorial"]
        },
        "Caitiff": {
            disciplines: ["Animalism", "Auspex", "Blood Sorcery", "Celerity", "Dominate", "Fortitude", "Obfuscate", "Oblivion", "Potence", "Presence", "Protean"],
            desc: "The Clanless. Bearing no clan's mark or lineage, they are distrusted by Kindred society but free to forge their own path.",
            bane: "Outcast: Begin with the Suspect (1) Flaw and cannot purchase Status at character creation; upgrading Disciplines costs 6x level XP (no In-Clan discount).",
            compulsion: "None: Caitiff do not suffer a Clan-specific Compulsion.",
            traits: ["survivor", "rebel", "loner"]
        },
        "Thin-Blood": {
            disciplines: ["Thin-Blood Alchemy"],
            desc: "Duskborn on the border of mortality and vampirism. Weak in the Blood, yet able to brew alchemical formulae and endure faint sunlight.",
            bane: "Thin Vitae: Blood Potency is 0. Cannot create Blood Bonds or embrace vampires easily, and take damage like mortals from most sources unless altered by Thin-Blood Merits/Flaws.",
            compulsion: "None: Thin-Bloods do not suffer a Clan Compulsion unless afflicted by the Clan Curse Flaw.",
            traits: ["survivor", "street", "human"]
        }
    },
    predator_types: {
        "Alleycat": {
            desc: "You feed by ambush, overpowering and drinking from whoever you can corner in dark streets.",
            specialties: { intimidation: "Stickups", brawl: "Grappling" },
            discipline_choices: ["Celerity", "Potence"],
            humanity_change: -1,
            advantages: [{ name: "Contacts", rating: 3, desc: "Criminal Underworld", type: "background" }],
            flaws: []
        },
        "Bagger": {
            desc: "You steal, buy, or scavenge cold fractionated blood bags rather than hunting living vessels.",
            specialties: { larceny: "Lockpicking", streetwise: "Black Market" },
            discipline_choices: ["Blood Sorcery", "Obfuscate", "Oblivion"],
            humanity_change: 0,
            advantages: [
                { name: "Iron Gullet", rating: 3, desc: "Can digest cold/bagged blood", type: "merit" }
            ],
            flaws: [
                { name: "Enemy", rating: 2, desc: "Someone who knows or is owed for your blood supply", type: "flaw" }
            ]
        },
        "Blood Leech": {
            desc: "You hunt and drink from other Kindred—the most dangerous and forbidden prey.",
            specialties: { brawl: "Kindred", stealth: "Against Kindred" },
            discipline_choices: ["Celerity", "Protean"],
            humanity_change: -1,
            advantages: [],
            flaws: [
                { name: "Prey Exclusion", rating: 2, desc: "Mortals (or Dark Secret: Diablerist)", type: "flaw" }
            ]
        },
        "Cleaver": {
            desc: "You covertly feed from your mortal family or close circle of friends while keeping up appearances.",
            specialties: { persuasion: "Gaslighting", subterfuge: "Coverups" },
            discipline_choices: ["Animalism", "Dominate"],
            humanity_change: 0,
            advantages: [
                { name: "Herd", rating: 2, desc: "Mortal family or close friends", type: "background" }
            ],
            flaws: [
                { name: "Dark Secret", rating: 1, desc: "Cleaver (violating Masquerade ties)", type: "flaw" }
            ]
        },
        "Consensualist": {
            desc: "You never feed against your victim's free will, taking blood only from informed or willing donors.",
            specialties: { medicine: "Phlebotomy", persuasion: "Vessels" },
            discipline_choices: ["Auspex", "Fortitude"],
            humanity_change: 1,
            advantages: [
                { name: "Mask", rating: 1, desc: "Cover identity for blood draws", type: "background" }
            ],
            flaws: [
                { name: "Dark Secret", rating: 1, desc: "Masquerade Breacher", type: "flaw" },
                { name: "Prey Exclusion", rating: 1, desc: "Non-consenting prey", type: "flaw" }
            ]
        },
        "Extortionist": {
            desc: "You force victims to give up their blood in exchange for protection, silence, or security.",
            specialties: { intimidation: "Coercion", larceny: "Security" },
            discipline_choices: ["Dominate", "Potence"],
            humanity_change: 0,
            advantages: [
                { name: "Resources", rating: 2, desc: "Protection racket or shakedowns", type: "background" },
                { name: "Contacts", rating: 1, desc: "Law enforcement or local muscle", type: "background" }
            ],
            flaws: [
                { name: "Enemy", rating: 2, desc: "Police or a victim who escaped your extortion", type: "flaw" }
            ]
        },
        "Farmer": {
            desc: "You feed exclusively on animals, striving to spare human lives despite the weaker nourishment.",
            specialties: { animal_ken: "Specific Animal", survival: "Hunting" },
            discipline_choices: ["Animalism", "Protean"],
            humanity_change: 1,
            advantages: [],
            flaws: [
                { name: "Farmer", rating: 2, desc: "Feeding on human blood costs 2 Willpower", type: "flaw" }
            ]
        },
        "Graverobber": {
            desc: "You feed on fresh corpses in morgues, hospitals, and funeral homes, or mourners at gravesides.",
            specialties: { occult: "Grave Rituals", medicine: "Cadavers" },
            discipline_choices: ["Fortitude", "Oblivion"],
            humanity_change: 0,
            advantages: [
                { name: "Iron Gullet", rating: 3, desc: "Can feed on cold corpse blood", type: "merit" },
                { name: "Haven", rating: 1, desc: "Near a cemetery, church, or morgue", type: "background" }
            ],
            flaws: [
                { name: "Obvious Predator", rating: 2, desc: "Unsettling, cadaverous aura disturbs mortals", type: "flaw" }
            ]
        },
        "Osiris": {
            desc: "You are a celebrity, cult leader, or streamer who feeds from devoted fans and followers.",
            specialties: { occult: "Specific Tradition", performance: "Specific Entertainment" },
            discipline_choices: ["Blood Sorcery", "Presence"],
            humanity_change: 0,
            advantages: [
                { name: "Fame", rating: 2, desc: "Subculture or cult following", type: "background" },
                { name: "Herd", rating: 1, desc: "Devoted inner circle of fans/worshippers", type: "background" }
            ],
            flaws: [
                { name: "Enemies", rating: 2, desc: "Rival cult, outraged authorities, or obsessive ex-followers", type: "flaw" }
            ]
        },
        "Sandman": {
            desc: "You use stealth or Disciplines to slip into homes at night and feed on sleeping victims.",
            specialties: { medicine: "Anesthetics", stealth: "Break-ins" },
            discipline_choices: ["Auspex", "Obfuscate"],
            humanity_change: 0,
            advantages: [
                { name: "Resources", rating: 1, desc: "Purloined valuables from sleeping victims", type: "background" }
            ],
            flaws: []
        },
        "Scene Queen": {
            desc: "You belong to a specific mortal subculture—club kids, punks, high fashion, or street racers—and feed on insiders.",
            specialties: { etiquette: "Specific Scene", leadership: "Specific Scene", streetwise: "Specific Scene" },
            discipline_choices: ["Dominate", "Potence"],
            humanity_change: 0,
            advantages: [
                { name: "Fame", rating: 1, desc: "Well-known within your subculture", type: "background" },
                { name: "Contacts", rating: 1, desc: "Scene insiders & promoters", type: "background" }
            ],
            flaws: [
                { name: "Prey Exclusion", rating: 1, desc: "Anyone from a rival or uncool subculture", type: "flaw" }
            ]
        },
        "Siren": {
            desc: "You feed almost exclusively during or feigning sex, relying on seduction and the ecstasy of the Kiss.",
            specialties: { persuasion: "Seduction", subterfuge: "Seduction" },
            discipline_choices: ["Fortitude", "Presence"],
            humanity_change: 0,
            advantages: [
                { name: "Beautiful", rating: 2, desc: "+1 die to Social pools", type: "merit" }
            ],
            flaws: [
                { name: "Enemy", rating: 1, desc: "A spurned lover or jealous partner", type: "flaw" }
            ]
        }
    },
    merits_backgrounds: {
        "Backgrounds": [
            "Allies (1-4)", "Contacts (1-3)", "Fame (1-5)", "Haven (1-3)", "Herd (1-5)", "Influence (1-5)", "Mask (1-2)", "Mawla (1-5)", "Resources (1-5)", "Retainers (1-3)", "Status (1-5)"
        ],
        "Physical / Feeding / Mythic Merits": [
            "Beautiful (2)", "Stunning (4)", "Bloodhound (1)", "Iron Gullet (3)", "Eat Food (2)"
        ],
        "Mental / Social / Background Merits": [
            "Linguistics (1-5)", "High-Functioning Addict (1)", "Check the Trunk (1)", "Zeroed (1)", "Cobbler (1)"
        ],
        "Thin-Blood Merits": [
            "Anarch Comrades (1)", "Camarilla Contact (1)", "Catenating Blood (1)", "Day Drinker (1)", "Discipline Affinity (1)", "Lifelike (1)", "Thin-Blood Alchemist (1)", "Vampiric Resilience (1)"
        ],
        "Loresheets": [
            "Descendant of Hardestadt (1-5)", "Descendant of Helena (1-5)", "Trinity (1-5)", "The Week of Nightmares (1-5)", "Golconda (1-5)"
        ]
    },
    flaws: {
        "Physical / Feeding Flaws": [
            "Ugly (1)", "Repulsive (2)", "Prey Exclusion (1)", "Farmer (2)", "Organovore (2)", "Methuselah's Thirst (1)", "Obvious Predator (2)"
        ],
        "Mental / Social / Background Flaws": [
            "Illiterate (2)", "Dark Secret (1-2)", "Infamy (1-2)", "Shunned (2)", "Suspect (1)", "Adversary (1-3)", "Enemy (1-2)", "Destitute (1)", "No Haven (1)", "Stalkers (1)", "Known Blankbody (2)", "Known Corpse (1)"
        ],
        "Mythic & Thin-Blood Flaws": [
            "Folkloric Bane (1)", "Folkloric Block (1)", "Stigmata (1)", "Stake Bait (2)", "Baby Teeth (1)", "Bestial Temper (1)", "Branded by the Camarilla (1)", "Clan Curse (1)", "Dead Flesh (1)", "Mortal Frailty (1)", "Shunned by the Anarchs (1)", "Vitae Dependency (1)"
        ]
    }
};


/**
 * Glossary of Advantages, Merits, Backgrounds, and Flaws.
 * 
 * This object maps the names of various character traits to their descriptive text.
 * It is used primarily for displaying tooltips, helper text, or detailed views 
 * in the user interface to help players understand what each trait means
 * without having to reference the core rulebook.
 */
const V5_ADVANTAGES_GLOSSARY = {
    "Allies": "Mortal associates, usually family, friends, or organizations who assist you. 1 dot: weak mortal. 3 dots: capable group. 4 dots: deadly or influential group.",
    "Allies (1-4)": "Mortal associates, usually family, friends, or organizations who assist you. 1 dot: weak mortal. 3 dots: capable group. 4 dots: deadly or influential group.",
    "Contacts": "Information sources you can pump for info or gear. 1 dot: common knowledge/gear. 2 dots: specialized insider. 3 dots: high-level or dangerous access.",
    "Contacts (1-3)": "Information sources you can pump for info or gear. 1 dot: common knowledge/gear. 2 dots: specialized insider. 3 dots: high-level or dangerous access.",
    "Fame": "How widely known you are among mortals. 1 dot: local subculture. 3 dots: city-wide celebrity. 5 dots: global superstar.",
    "Fame (1-5)": "How widely known you are among mortals. 1 dot: local subculture. 3 dots: city-wide celebrity. 5 dots: global superstar.",
    "Haven": "A secure place to sleep during the day. 1 dot: small secure apartment. 2 dots: large house or compound. 3 dots: sprawling fortified stronghold.",
    "Haven (1-3)": "A secure place to sleep during the day. 1 dot: small secure apartment. 2 dots: large house or compound. 3 dots: sprawling fortified stronghold.",
    "Herd": "Mortal vessels to whom you have free and safe access each week. 1 dot: 1-3 vessels. 3 dots: 7-15 vessels. 5 dots: 30-60 vessels.",
    "Herd (1-5)": "Mortal vessels to whom you have free and safe access each week. 1 dot: 1-3 vessels. 3 dots: 7-15 vessels. 5 dots: 30-60 vessels.",
    "Influence": "Political or institutional sway in mortal society. 1 dot: well-connected locally. 3 dots: city-wide pull. 5 dots: national power broker.",
    "Influence (1-5)": "Political or institutional sway in mortal society. 1 dot: well-connected locally. 3 dots: city-wide pull. 5 dots: national power broker.",
    "Mask": "A fake mortal identity. 1 dot: good fake ID that passes traffic stops. 2 dots: withstands federal/background checks.",
    "Mask (1-2)": "A fake mortal identity. 1 dot: good fake ID that passes traffic stops. 2 dots: withstands federal/background checks.",
    "Mawla": "A Kindred mentor or group of Kindred who advises and protects you. 1 dot: neonate. 3 dots: ancilla. 5 dots: Primogen, Baron, or Prince.",
    "Mawla (1-5)": "A Kindred mentor or group of Kindred who advises and protects you. 1 dot: neonate. 3 dots: ancilla. 5 dots: Primogen, Baron, or Prince.",
    "Resources": "Wealth, liquid assets, and disposable income. 1 dot: paycheck to paycheck. 3 dots: upper-middle class/wealthy. 5 dots: ultra-rich.",
    "Resources (1-5)": "Wealth, liquid assets, and disposable income. 1 dot: paycheck to paycheck. 3 dots: upper-middle class/wealthy. 5 dots: ultra-rich.",
    "Retainers": "Loyal mortal servants or Ghouls who serve you. 1 dot: weak servant. 2 dots: capable bodyguard/assistant. 3 dots: highly skilled professional ghoul.",
    "Retainers (1-3)": "Loyal mortal servants or Ghouls who serve you. 1 dot: weak servant. 2 dots: capable bodyguard/assistant. 3 dots: highly skilled professional ghoul.",
    "Status": "Your standing in your Sect (Camarilla, Anarch, etc.). 1 dot: known member. 3 dots: respected officeholder. 5 dots: inner circle.",
    "Status (1-5)": "Your standing in your Sect (Camarilla, Anarch, etc.). 1 dot: known member. 3 dots: respected officeholder. 5 dots: inner circle.",
    "Beautiful (2)": "You are remarkably attractive. Add +1 die to appropriate Social dice pools.",
    "Stunning (4)": "Breathtakingly magnetic. Add +2 dice to appropriate Social dice pools.",
    "Bloodhound (1)": "You can smell the resonance and potency of a mortal's blood without tasting it.",
    "Iron Gullet (3)": "You can feed from cold blood, rancid blood, and fractionated plasma.",
    "Eat Food (2)": "You can consume mortal food and drink without effort, though it provides no nourishment.",
    "Linguistics (1-5)": "Each dot allows you to speak, write, and read an additional language fluently.",
    "High-Functioning Addict (1)": "Add +1 die to one category of pool (Physical, Social, or Mental) when the last person you fed from had your preferred drug in their system.",
    "Check the Trunk (1)": "Haven or Resources Merit: You maintain an easily accessible cache of weapons or specialized tools.",
    "Zeroed (1)": "Requires Mask 2: All past government and digital records of your true mortal identity have been purged.",
    "Cobbler (1)": "Requires Mask 2: You can make or procure fake IDs and Masks for others.",
    "Anarch Comrades (1)": "Thin-Blood Merit: A coterie of Anarchs treats you as an adopted pet or mascot (acts as 1-dot Mawla).",
    "Camarilla Contact (1)": "Thin-Blood Merit: A Camarilla handler uses you as a deniable informant (acts as 1-dot Mawla).",
    "Catenating Blood (1)": "Thin-Blood Merit: Your blood can create Blood Bonds and Embrace new Thin-Bloods.",
    "Day Drinker (1)": "Thin-Blood Merit: Sunlight does not damage you, though it halves your Health and removes vampiric powers while in the sun.",
    "Discipline Affinity (1)": "Thin-Blood Merit: Gain 1 dot in one standard Discipline and can advance it with XP as an Out-of-Clan Discipline.",
    "Lifelike (1)": "Thin-Blood Merit: You have a heartbeat, can eat food, and pass medical inspection as a human.",
    "Thin-Blood Alchemist (1)": "Thin-Blood Merit: Gain 1 dot and one formula in Thin-Blood Alchemy, and can purchase more with XP.",
    "Vampiric Resilience (1)": "Thin-Blood Merit: You take Superficial damage from punctures, blades, and bullets like a full Kindred.",
    "Descendant of Hardestadt (1-5)": "Loresheet: Tied to the lineage of the legendary Ventrue founder of the Camarilla.",
    "Descendant of Helena (1-5)": "Loresheet: Tied to the lineage of the mythical Toreador Methuselah.",
    "Trinity (1-5)": "Loresheet: Tied to the legacy of Constantinople's Triumvirate.",
    "The Week of Nightmares (1-5)": "Loresheet: Tied to the cataclysmic awakening of the Ravnos Antediluvian.",
    "Golconda (1-5)": "Loresheet: Seeker of the fabled state of vampiric enlightenment and peace with the Beast.",
    "Ugly (1)": "Unpleasant features. Lose 1 die from appropriate Social dice pools.",
    "Repulsive (2)": "Horrifying appearance. Lose 2 dice from appropriate Social dice pools.",
    "Illiterate (2)": "You cannot read or write. Your Academics and Science skills may not exceed 1.",
    "Dark Secret (1-2)": "You hide a damning secret that could get you ostracized (1 dot) or destroyed (2 dots).",
    "Infamy (1-2)": "You are widely despised or notorious for a past crime or scandal.",
    "Shunned (2)": "Status Flaw: You are despised by a Sect or faction, losing 2 dice on Social tests with its members.",
    "Suspect (1)": "Status Flaw: You are on a Sect's watchlist after breaking rules or dodging a boon; -1 die to Social tests with them.",
    "Adversary (1-3)": "Mawla Flaw: A rival Kindred of higher standing actively works against you or your coterie.",
    "Enemy (1-2)": "A mortal or Kindred antagonist actively seeks to harm or thwart you.",
    "Destitute (1)": "Resources Flaw: You have no money, no bank account, and no regular income.",
    "No Haven (1)": "Haven Flaw: You have no fixed haven and must roll each night to find a safe resting place.",
    "Stalkers (1)": "Fame Flaw: Unwanted obsessive admirers or investigators shadow your movements.",
    "Known Blankbody (2)": "Mask Flaw: Biometrics and databases have flagged you as a suspected vampire (Second Inquisition awareness).",
    "Known Corpse (1)": "Mask Flaw: Local records list you as recently deceased, complicating mortal interactions.",
    "Prey Exclusion (1)": "You refuse to feed on a specific class of prey; doing so inflicts Stains.",
    "Farmer (2)": "Feeding Flaw: You only feed on animal blood; spending 2 Willpower is required to feed on human blood.",
    "Organovore (2)": "Feeding Flaw: You can only slake Hunger by eating human flesh and blood-rich organs.",
    "Methuselah's Thirst (1)": "Feeding Flaw: Your Hunger can only be fully slaked below 2 by supernatural blood.",
    "Obvious Predator (2)": "You radiate an unsettling predatory aura; lose 2 dice on non-Intimidation Social pools with mortals, and cannot maintain a Herd.",
    "Folkloric Bane (1)": "Mythic Flaw: You take Aggravated damage from a traditional vampire bane (ultraviolet light, silver, holy water, etc.).",
    "Folkloric Block (1)": "Mythic Flaw: You must spend Willpower or recoil from a traditional ward (garlic, holy symbols, running water, uninvited thresholds).",
    "Stigmata (1)": "Mythic Flaw: You bleed from open wounds on your hands, feet, and forehead when you reach Hunger 4.",
    "Stake Bait (2)": "Mythic Flaw: If your heart is pierced by a wooden stake, you meet Final Death instead of torpor.",
    "Baby Teeth (1)": "Thin-Blood Flaw: You never grew functional fangs and must cut prey or use a syringe to feed.",
    "Bestial Temper (1)": "Thin-Blood Flaw: You suffer Frenzy checks just like a full vampire.",
    "Branded by the Camarilla (1)": "Thin-Blood Flaw: Marked and monitored by the Camarilla Scourge or Sheriff.",
    "Clan Curse (1)": "Thin-Blood Flaw: You suffer the Clan Bane of your sire's Clan at Bane Severity 1.",
    "Dead Flesh (1)": "Thin-Blood Flaw: Your flesh slowly decays, giving -1 die to face-to-face Social rolls with mortals.",
    "Mortal Frailty (1)": "Thin-Blood Flaw: You cannot Rouse the Blood to mend damage; you heal at mortal rates.",
    "Shunned by the Anarchs (1)": "Thin-Blood Flaw: Local Anarchs refuse to shelter or deal with you.",
    "Vitae Dependency (1)": "Thin-Blood Flaw: You must drink at least 1 Hunger worth of Kindred vitae each week or lose access to all Discipline powers."
};

/**
 * Detailed definitions of Vampiric Disciplines (supernatural powers) for Levels 1, 2, and 3.
 * 
 * Each key is the name of a Discipline, containing a general description (`desc`)
 * and the specific powers available at Level 1 (`l1`), Level 2 (`l2`), and Level 3 (`l3`).
 */
const V5_DISCIPLINES = {
    "Animalism": {
        desc: "Supernatural affinity with, command over, and communion with animals and the inner Beast.",
        l1: {
            "Bond Famulus": "Bind a chosen animal with your vitae so it serves as a loyal companion and mental link.",
            "Sense the Beast": "Sense the presence, hostility, and supernatural nature of nearby mortals, animals, and Kindred."
        },
        l2: {
            "Feral Whispers": "Converse wordlessly with animals and summon local beasts to gather information or assist you.",
            "Atavism": "Drive an animal into a primal frenzy or terror."
        },
        l3: {
            "Animal Succulence": "Slake an additional point of Hunger when feeding on animals, and consume your Famulus for massive sustenance.",
            "Quell the Beast": "Project calm or dread into a mortal or vampire, subduing their Beast or ending their Frenzy.",
            "Unliving Hive (Amalgam: Obfuscate 2)": "Extend your animal affinity to swarms of insects that nest within your body."
        }
    },
    "Auspex": {
        desc: "Extrasensory perception, premonitions, aura reading, and piercing illusions.",
        l1: {
            "Heightened Senses": "Sharpen your five senses to superhuman levels, adding your Auspex rating to perception pools.",
            "Sense the Unseen": "Perceive supernatural presences, ghosts, blood magic, and vampires concealed by Obfuscate."
        },
        l2: {
            "Premonition": "Receive sudden visions of danger, hidden truths, or echoes of the future and past.",
            "Obeah (Amalgam: Fortitude 1)": "Soothe a target's agitated mind, relieving Aggravated or Superficial Willpower damage."
        },
        l3: {
            "Scry the Soul": "Read a target's emotional aura, true nature, Resonance, and supernatural condition.",
            "Share the Senses": "Project your consciousness to see and hear through the eyes and ears of another mortal or Kindred."
        }
    },
    "Blood Sorcery": {
        desc: "Thaumaturgical mastery over vitae, corrosive blood, and occult Blood Sorcery Rituals.",
        l1: {
            "Corrosive Vitae": "Turn your spilled blood into a virulent acid capable of melting locks, chains, and dead matter.",
            "A Taste for Blood": "Discern a subject's Resonance, Generation, Blood Potency, and recent diablerie from a single drop of blood.",
            "Shape the Sanguine Sacrament": "Sculpt your spilled blood into symbols, images, or simple shapes."
        },
        l2: {
            "Extinguish Vitae": "Intentionally curdle and burn away a rival vampire's vitae from a distance, increasing their Hunger."
        },
        l3: {
            "Blood of Potency": "Concentrate your vitae to temporarily increase your Blood Potency for the scene.",
            "Scorpion's Touch": "Transmute your vitae into a paralyzing poison that cripples mortals and Kindred alike."
        }
    },
    "Celerity": {
        desc: "Blinding supernatural speed, reflexes, and preternatural grace.",
        l1: {
            "Cat's Grace": "Maintain flawless balance on narrow ledges, wires, or slick surfaces and land safely from falls.",
            "Rapid Reflexes": "React faster than human thought, ignoring penalties for lack of cover against ranged attacks and taking minor actions instantly."
        },
        l2: {
            "Fleetness": "Add your Celerity rating to non-combat Dexterity rolls and once per turn to physical defense."
        },
        l3: {
            "Blink": "Close a distance of up to 50 meters in a heartbeat, engaging an enemy or escaping before anyone can react.",
            "Traversal": "Sprint up vertical walls and across liquid surfaces with sheer momentum."
        }
    },
    "Dominate": {
        desc: "Hypnotic mind control, erasing or altering memories, and enforcing absolute obedience.",
        l1: {
            "Cloud Memory": "Make a victim forget the last few minutes—ideal for covering up a feeding.",
            "Compel": "Issue a single-sentence command that the victim must obey immediately."
        },
        l2: {
            "Mesmerize": "Implant complex, multi-step hypnotic commands that the subject carries out immediately.",
            "Dementation (Amalgam: Obfuscate 2)": "Drive a target's mind into paranoia or breakdown during conversation, inflicting Willpower damage."
        },
        l3: {
            "The Forgetful Mind": "Rewrite extended stretches of a subject's memories to match your narrative.",
            "Submerged Directive": "Implant a dormant post-hypnotic trigger alongside Mesmerize that activates when a condition is met."
        }
    },
    "Fortitude": {
        desc: "Preternatural resilience against physical violence, fire, and mental coercion.",
        l1: {
            "Resilience": "Add your Fortitude rating directly to your maximum Health tracker.",
            "Unswayable Mind": "Add your Fortitude rating as bonus dice to resist coercion, intimidation, and supernatural mind control."
        },
        l2: {
            "Toughness": "Subtract your Fortitude rating from all incoming Superficial physical damage before halving.",
            "Enduring Beasts (Amalgam: Animalism 1)": "Share your supernatural toughness with your bonded Famulus or nearby animals.",
            "Valeren (Amalgam: Auspex 1)": "Use your own vitae to mend the injured flesh of another vampire."
        },
        l3: {
            "Defy Bane": "Convert Aggravated damage (even from fire or sunlight) equal to your Fortitude rating into Superficial damage.",
            "Fortify the Inner Facade": "Shield your aura and thoughts from Auspex, Telepathy, and supernatural scrutiny."
        }
    },
    "Obfuscate": {
        desc: "Clouding minds to remain unseen, move in total silence, and wear false faces.",
        l1: {
            "Cloak of Shadows": "Blend into nearby shadows and remain completely unseen as long as you stay still and silent.",
            "Silence of Death": "Nullify all sounds you make—footsteps, breathing, clothing rustling, and melee strikes."
        },
        l2: {
            "Unseen Passage": "Move around freely while remaining completely invisible to onlookers.",
            "Chimerstry (Amalgam: Presence 1)": "Weave brief, disorienting sensory hallucinations in a target's mind."
        },
        l3: {
            "Ghost in the Machine": "Extend your Obfuscate invisibility to live video feeds, cameras, and photographs.",
            "Mask of a Thousand Faces": "Appear as an unremarkable stranger—a maintenance worker, courier, or expected guest—so witnesses overlook your true identity.",
            "Fata Morgana (Amalgam: Presence 2)": "Create elaborate multi-sensory illusions seen and heard by everyone in the area."
        }
    },
    "Oblivion": {
        desc: "Channeling the Abyss to command living shadows, decay, and restless wraiths.",
        l1: {
            "Shadow Cloak": "Wrap ambient shadows around yourself, gaining +2 dice to Stealth and Intimidation.",
            "Oblivion's Sight": "See clearly in pitch darkness and perceive ghosts and thin spots in the Shroud.",
            "Ashes to Ashes": "Use your vitae to rapidly dissolve a non-vampiric corpse into dust.",
            "The Binding Fetter": "Identify and attune to the earthly objects or places that anchor a wraith."
        },
        l2: {
            "Shadow Cast": "Summon and animate a patch of supernatural shadow that deepens darkness or hinders foes.",
            "Arms of Ahriman (Amalgam: Potence 2)": "Conjure abyssal shadow tentacles from dark corners to grapple and crush enemies.",
            "Fatal Precognition": "Glimpse how a mortal or vampire is destined to die or suffer injury.",
            "Where the Shroud Thins": "Sense the thickness of the barrier between the living world and the Shadowlands."
        },
        l3: {
            "Shadow Perspective": "Project your senses through any shadow within line of sight to spy from across a room or street.",
            "Touch of Oblivion": "Wither and atrophy a victim's limb or flesh with a necrotic touch.",
            "Aura of Decay": "Exude a miasma that wilts plants, spoils food, and sickens nearby mortals."
        }
    },
    "Potence": {
        desc: "Devastating vampiric physical might and earth-shattering leaps.",
        l1: {
            "Lethal Body": "Your unarmed strikes tear through mortal flesh and ignore points of armor equal to your Potence.",
            "Soaring Leap": "Leap vertically up to 3 meters per Potence dot and horizontally up to 5 meters per dot."
        },
        l2: {
            "Prowess": "Add your Potence rating to unarmed damage, feats of raw strength, and half your Potence to melee weapon damage."
        },
        l3: {
            "Brutal Feed": "Drain a mortal vessel in seconds through sheer violent force, even mid-combat.",
            "Spark of Rage (Amalgam: Presence 3)": "Incite nearby mortals or Kindred to anger, violence, or Frenzy.",
            "Uncanny Grip": "Crush stone, metal, and wood with your bare fingers to climb any surface or immobilize foes."
        }
    },
    "Presence": {
        desc: "Supernatural magnetism, emotional manipulation, and terrifying majesty.",
        l1: {
            "Awe": "Draw all eyes and hearts in the room, adding your Presence rating to Persuasion, Performance, and Charisma rolls.",
            "Daunt": "Project an aura of dread, adding your Presence rating to Intimidation rolls and driving mortals back."
        },
        l2: {
            "Lingering Kiss": "Make your bite so intensely pleasurable that vessels become addicted and crave your return."
        },
        l3: {
            "Dread Gaze": "Bare your fangs and Beast to paralyze a single target with primal terror.",
            "Entrancement": "Cause a single admirer to fall under your sway for hours, eager to please and protect you."
        }
    },
    "Protean": {
        desc: "Shapeshifting, growing lethal claws, melding with the earth, and sculpting flesh.",
        l1: {
            "Eyes of the Beast": "Your eyes glow crimson, granting perfect vision in total darkness and +1 die to Intimidation against mortals.",
            "Weight of the Feather": "Become nearly weightless to negate falling damage, avoid pressure plates, and land silently."
        },
        l2: {
            "Feral Weapons": "Extend vicious supernatural claws or fangs that deal unhalved Superficial damage (+2 damage modifier).",
            "Vicissitude (Amalgam: Dominate 2)": "Sculpt your own flesh, bone, and physical Attributes like living clay."
        },
        l3: {
            "Earth Meld": "Sink into natural soil or stone to sleep safely beneath the ground during the day.",
            "Shapechange": "Transform completely into a wolf, large dog, or swarm of bats matching your mass.",
            "Fleshcrafting (Amalgam: Dominate 2, Requires Vicissitude)": "Extend your mastery of Vicissitude to sculpt the flesh and bone of others."
        }
    },
    "Thin-Blood Alchemy": {
        desc: "Distilling human Resonance, chemicals, and thin vitae into strange counterfeit powers.",
        l1: {
            "Far Reach": "Brew a telekinetic formula that lets you pull, push, or manipulate objects from a distance.",
            "Haze": "Exhale a dense, eerie mist that follows you and conceals your movements.",
            "Counterfeit Discipline (Level 1)": "Distill a formula that mimics any Level 1 standard Discipline power."
        },
        l2: {
            "Envelop": "Conjure a clinging cloud of mist that blinds and suffocates a chosen victim.",
            "Friends List": "Sense the network of emotional and social connections surrounding a target.",
            "Counterfeit Discipline (Level 2)": "Distill a formula that mimics any Level 2 standard Discipline power."
        },
        l3: {
            "Defractionate": "Restore old, cold blood bags into fresh, nourishing blood anyone can drink.",
            "Profane Hieros Gamos": "Brew a transformative elixir that permanently alters a subject's physical body.",
            "Counterfeit Discipline (Level 3)": "Distill a formula that mimics any Level 3 standard Discipline power."
        }
    }
};
