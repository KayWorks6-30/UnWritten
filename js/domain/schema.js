export const APP_VERSION = '3.5.1';
export const SCHEMA_VERSION = 8;

export const DATE_UNCERTAINTY = ['Exact','Approximate','Range','Traditional','Disputed','Unknown'];
export const KNOWLEDGE_STATES = ['Knows truth','Partial truth','Incorrect belief','Unaware','Forgotten','Rejected truth','Unknown'];
export const MAP_VARIANTS = ['World','Continent','Country','City','Political','Physical','Historical','Exploration','Ancient','Current','Other'];
export const WORKSPACE_KINDS = ['plotThread','plotBeat','contextNote','task','savedView','calendar','calendarDate','mapLayer','mapRoute','whiteboardNode','whiteboardEdge','manuscriptDocument','revision','readerProfile'];

export const CANON_STATUSES = ['Canon', 'Provisional', 'Concept', 'Contradicted', 'Shelved', 'Unknown'];
export const RELATION_STATUSES = CANON_STATUSES;
export const STORY_POINT_TYPES = ['book','part','chapter','scene'];
export const QUESTION_STATUSES = ['Open', 'Exploring', 'Answered', 'Shelved'];
export const IDEA_STATUSES = ['Inbox', 'Exploring', 'Converted', 'Shelved'];
export const FORESHADOW_VISIBILITY = ['Invisible', 'Extremely subtle', 'Subtle', 'Noticeable', 'Obvious'];

const baseKnowledge = [
  { key: 'authorTruth', label: 'Author Truth', type: 'textarea', knowledge: true },
  { key: 'modernScholarship', label: 'Modern Scholarship', type: 'textarea', knowledge: true },
  { key: 'commonBelief', label: 'Common Belief', type: 'textarea', knowledge: true },
  { key: 'culturalInterpretations', label: 'Cultural Interpretations', type: 'textarea', knowledge: true },
  { key: 'readerKnowledge', label: 'Reader Knowledge / Reveal Notes', type: 'textarea', knowledge: true }
];

export const ENTRY_TYPES = {
  lore: {
    label: 'Lore', group: 'World', icon: '◇',
    fields: [
      { key: 'alternateNames', label: 'Alternate Names', type: 'text' },
      { key: 'era', label: 'Era / Age', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      ...baseKnowledge
    ]
  },
  deity: {
    label: 'Ancient Being / God', group: 'World', icon: '✦',
    fields: [
      { key: 'alternateNames', label: 'Alternate Names', type: 'text' },
      { key: 'titles', label: 'Titles', type: 'text' },
      { key: 'era', label: 'Era', type: 'text' },
      { key: 'appearance', label: 'Appearance', type: 'textarea' },
      { key: 'personality', label: 'Personality', type: 'textarea' },
      { key: 'origin', label: 'Origin', type: 'textarea' },
      { key: 'philosophy', label: 'Philosophy', type: 'textarea' },
      { key: 'abilities', label: 'Abilities', type: 'textarea' },
      { key: 'associatedConcepts', label: 'Associated Concepts', type: 'text' },
      { key: 'fate', label: 'Fate', type: 'textarea' },
      ...baseKnowledge
    ]
  },
  location: {
    label: 'Location', group: 'Geography', icon: '⌖',
    fields: [
      { key: 'locationKind', label: 'Location Type', type: 'select', options: ['World','Continent','Ocean','Sea','Region','Country','Province','City','Settlement','District','Building','Landmark','Mountain','Forest','River','Island','Ruin','Ancient Site','Dangerous Region','Unexplored Region','Other'] },
      { key: 'parentLocationId', label: 'Parent Location', type: 'entity', entityTypes: ['location'] },
      { key: 'parentLocation', label: 'Legacy Parent Location Note', type: 'text' },
      { key: 'coordinates', label: 'Coordinates / Map Position', type: 'text' },
      { key: 'climate', label: 'Climate', type: 'text' },
      { key: 'geography', label: 'Geography', type: 'textarea' },
      { key: 'population', label: 'Population', type: 'text' },
      { key: 'government', label: 'Government', type: 'text' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'existsFrom', label: 'Exists From (sortable year, optional)', type: 'number' },
      { key: 'existsTo', label: 'Exists To (sortable year, optional)', type: 'number' },
      ...baseKnowledge
    ]
  },
  event: {
    label: 'Historical Event', group: 'History', icon: '⌛',
    fields: [
      { key: 'dateText', label: 'Display Date', type: 'text' },
      { key: 'dateStart', label: 'Sortable Start', type: 'number' },
      { key: 'dateEnd', label: 'Sortable End', type: 'number' },
      { key: 'dateUncertainty', label: 'Date Certainty', type: 'select', options: DATE_UNCERTAINTY },
      { key: 'eraId', label: 'Era / Age', type: 'entity', entityTypes: ['era'] },
      { key: 'era', label: 'Legacy Era Note', type: 'text' },
      { key: 'duration', label: 'Duration', type: 'text' },
      { key: 'timelineOrder', label: 'Manual Timeline Sort Override', type: 'number' },
      { key: 'locationId', label: 'Structured Location', type: 'entity', entityTypes: ['location'] },
      { key: 'locationText', label: 'Location', type: 'text' },
      { key: 'cause', label: 'Cause', type: 'textarea' },
      { key: 'event', label: 'What Happened', type: 'textarea' },
      { key: 'consequences', label: 'Consequences', type: 'textarea' },
      { key: 'importance', label: 'Historical Importance', type: 'textarea' },
      { key: 'sources', label: 'Sources / Evidence', type: 'textarea' },
      ...baseKnowledge
    ]
  },
  era: {
    label: 'Era / Age', group: 'History', icon: '◷',
    fields: [
      { key: 'dateRange', label: 'Date Range', type: 'text' },
      { key: 'summaryLong', label: 'Summary', type: 'textarea' },
      { key: 'technology', label: 'Technology', type: 'textarea' },
      { key: 'culturalDevelopments', label: 'Cultural Developments', type: 'textarea' },
      { key: 'mysteries', label: 'Mysteries', type: 'textarea' }
    ]
  },
  civilization: {
    label: 'Civilization / Culture', group: 'Society', icon: '▦',
    fields: [
      { key: 'societyKind', label: 'Kind', type: 'select', options: ['Civilization','Culture','People','Nation','Kingdom','Empire','Tribe','Historical Society','Other'] },
      { key: 'origin', label: 'Origin', type: 'textarea' },
      { key: 'homelandLocationId', label: 'Homeland', type: 'entity', entityTypes: ['location'] },
      { key: 'homeland', label: 'Legacy Homeland Note', type: 'text' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'government', label: 'Government', type: 'textarea' },
      { key: 'socialStructure', label: 'Social Structure', type: 'textarea' },
      { key: 'values', label: 'Values', type: 'textarea' },
      { key: 'customs', label: 'Customs', type: 'textarea' },
      { key: 'language', label: 'Language(s)', type: 'text' },
      { key: 'currentStatus', label: 'Current Status', type: 'text' },
      ...baseKnowledge
    ]
  },
  religion: {
    label: 'Religion / Mythology', group: 'Society', icon: '☼',
    fields: [
      { key: 'religionKind', label: 'Kind', type: 'select', options: ['Religion','Myth','Creation Myth','Religious Figure','Schism','Ritual','Holiday','Other'] },
      { key: 'beliefs', label: 'Beliefs / Mythology', type: 'textarea' },
      { key: 'afterlife', label: 'Afterlife Beliefs', type: 'textarea' },
      { key: 'rituals', label: 'Rituals', type: 'textarea' },
      { key: 'history', label: 'Historical Development', type: 'textarea' },
      { key: 'interpretations', label: 'Different Interpretations', type: 'textarea' },
      ...baseKnowledge
    ]
  },
  character: {
    label: 'Character', group: 'People', icon: '●',
    fields: [
      { key: 'nicknames', label: 'Nicknames', type: 'text' },
      { key: 'titles', label: 'Titles', type: 'text' },
      { key: 'age', label: 'Age', type: 'text' },
      { key: 'birth', label: 'Birth', type: 'text' },
      { key: 'death', label: 'Death', type: 'text' },
      { key: 'birthSort', label: 'Birth (sortable year, optional)', type: 'number' },
      { key: 'deathSort', label: 'Death (sortable year, optional)', type: 'number' },
      { key: 'revivalSort', label: 'Revival / Return (sortable year, optional)', type: 'number' },
      { key: 'lifeStatus', label: 'Status', type: 'text' },
      { key: 'speciesPeople', label: 'Species / People', type: 'text' },
      { key: 'homelandLocationId', label: 'Homeland', type: 'entity', entityTypes: ['location'] },
      { key: 'homeland', label: 'Legacy Homeland Note', type: 'text' },
      { key: 'currentLocationId', label: 'Current Location', type: 'entity', entityTypes: ['location'] },
      { key: 'currentLocation', label: 'Legacy Current Location Note', type: 'text' },
      { key: 'appearance', label: 'Appearance', type: 'textarea' },
      { key: 'personality', label: 'Personality', type: 'textarea' },
      { key: 'philosophy', label: 'Philosophy', type: 'textarea' },
      { key: 'motivations', label: 'Motivations', type: 'textarea' },
      { key: 'fears', label: 'Fears', type: 'textarea' },
      { key: 'strengths', label: 'Strengths', type: 'textarea' },
      { key: 'weaknesses', label: 'Weaknesses', type: 'textarea' },
      { key: 'skills', label: 'Skills', type: 'textarea' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'characterArc', label: 'Character Arc', type: 'textarea' },
      { key: 'secrets', label: 'Secrets', type: 'textarea' },
      { key: 'knowledge', label: 'What They Know', type: 'textarea' },
      { key: 'falseBeliefs', label: 'What They Incorrectly Believe', type: 'textarea' },
      { key: 'quotes', label: 'Quotes', type: 'textarea' }
    ]
  },
  creature: {
    label: 'Creature', group: 'World', icon: '◆',
    fields: [
      { key: 'classification', label: 'Classification', type: 'text' },
      { key: 'habitat', label: 'Habitat', type: 'text' },
      { key: 'appearance', label: 'Appearance', type: 'textarea' },
      { key: 'behavior', label: 'Behavior', type: 'textarea' },
      { key: 'diet', label: 'Diet', type: 'text' },
      { key: 'intelligence', label: 'Intelligence', type: 'text' },
      { key: 'lifespan', label: 'Lifespan', type: 'text' },
      { key: 'reproduction', label: 'Reproduction', type: 'textarea' },
      { key: 'abilities', label: 'Abilities', type: 'textarea' },
      { key: 'legends', label: 'Legends', type: 'textarea' }
    ]
  },
  organization: {
    label: 'Organization / Faction', group: 'Society', icon: '◎',
    fields: [
      { key: 'organizationKind', label: 'Kind', type: 'select', options: ['Government','Military','Guild','Religious Organization','School','Research Organization','Criminal Group','Secret Society','Exploration Group','Political Movement','Other'] },
      { key: 'leadership', label: 'Leadership', type: 'text' },
      { key: 'membership', label: 'Membership', type: 'textarea' },
      { key: 'headquartersLocationId', label: 'Headquarters', type: 'entity', entityTypes: ['location'] },
      { key: 'headquarters', label: 'Legacy Headquarters Note', type: 'text' },
      { key: 'territory', label: 'Territory', type: 'text' },
      { key: 'goals', label: 'Goals', type: 'textarea' },
      { key: 'ideology', label: 'Ideology', type: 'textarea' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'resources', label: 'Resources', type: 'textarea' },
      { key: 'currentStatus', label: 'Current Status', type: 'text' }
    ]
  },
  artifact: {
    label: 'Artifact / Object', group: 'World', icon: '⬡',
    fields: [
      { key: 'objectKind', label: 'Object Type', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'creatorId', label: 'Creator', type: 'entity' },
      { key: 'creator', label: 'Legacy Creator Note', type: 'text' },
      { key: 'originalOwnerId', label: 'Original Owner', type: 'entity' },
      { key: 'originalOwner', label: 'Legacy Original Owner Note', type: 'text' },
      { key: 'currentOwnerId', label: 'Current Owner', type: 'entity' },
      { key: 'currentOwner', label: 'Legacy Current Owner Note', type: 'text' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'knownPurpose', label: 'Known Purpose', type: 'textarea' },
      { key: 'truePurpose', label: 'True Purpose', type: 'textarea' },
      { key: 'abilities', label: 'Abilities', type: 'textarea' },
      { key: 'culturalSignificance', label: 'Cultural Significance', type: 'textarea' }
    ]
  },
  language: {
    label: 'Language', group: 'Society', icon: 'Aa',
    fields: [
      { key: 'family', label: 'Language Family', type: 'text' },
      { key: 'regions', label: 'Regions', type: 'text' },
      { key: 'cultures', label: 'Cultures', type: 'text' },
      { key: 'writingSystem', label: 'Writing System', type: 'textarea' },
      { key: 'history', label: 'History', type: 'textarea' },
      { key: 'relatedLanguages', label: 'Related Languages', type: 'text' },
      { key: 'importantWords', label: 'Important Words', type: 'textarea' },
      { key: 'namingConventions', label: 'Naming Conventions', type: 'textarea' },
      { key: 'examplePhrases', label: 'Example Phrases', type: 'textarea' },
      { key: 'etymologies', label: 'Etymologies', type: 'textarea' },
      { key: 'ancientForms', label: 'Ancient Forms', type: 'textarea' }
    ]
  },
  map: {
    label: 'Map', group: 'Geography', icon: '▧',
    fields: [
      { key: 'mapKind', label: 'Map Variant', type: 'select', options: MAP_VARIANTS },
      { key: 'scopeLocationId', label: 'Geographic Scope', type: 'entity', entityTypes: ['location'] },
      { key: 'parentMapId', label: 'Parent / Overview Map', type: 'entity', entityTypes: ['map'] },
      { key: 'eraId', label: 'Era / Age', type: 'entity', entityTypes: ['era'] },
      { key: 'description', label: 'Map Description', type: 'textarea' },
      { key: 'coverage', label: 'Coverage / Region Note', type: 'text' }
    ]
  },
  trilogy: {
    label: 'Series Overview', group: 'Story', icon: 'III',
    fields: [
      { key: 'centralPremise', label: 'Central Premise', type: 'textarea' },
      { key: 'startingState', label: 'Starting State / Opening Promise', type: 'textarea' },
      { key: 'protagonists', label: 'Primary Protagonists', type: 'text' },
      { key: 'endGoal', label: 'End Goal / Destination', type: 'textarea' },
      { key: 'centralPrizeTruth', label: 'Central Prize / Truth / Answer', type: 'textarea' },
      { key: 'nonNegotiableTruths', label: 'Non-negotiable Story Truths', type: 'textarea' },
      { key: 'intendedEnding', label: 'Intended Ending / Final State', type: 'textarea' },
      { key: 'themes', label: 'Themes', type: 'textarea' },
      { key: 'majorCharacterArcs', label: 'Major Character Arcs', type: 'textarea' },
      { key: 'majorMysteries', label: 'Major Mysteries', type: 'textarea' },
      { key: 'majorReveals', label: 'Major Reveals', type: 'textarea' },
      { key: 'beginning', label: 'Trilogy Beginning', type: 'textarea' },
      { key: 'midpoint', label: 'Trilogy Midpoint', type: 'textarea' },
      { key: 'climax', label: 'Trilogy Climax', type: 'textarea' },
      { key: 'ending', label: 'Ending', type: 'textarea' }
    ]
  },
  book: {
    label: 'Book', group: 'Story', icon: '▤',
    fields: [
      { key: 'order', label: 'Book Number', type: 'number' },
      { key: 'premise', label: 'Central Premise', type: 'textarea' },
      { key: 'themes', label: 'Themes', type: 'textarea' },
      { key: 'mainConflict', label: 'Main Conflict', type: 'textarea' },
      { key: 'characterArcs', label: 'Major Character Arcs', type: 'textarea' },
      { key: 'mysteriesIntroduced', label: 'Mysteries Introduced', type: 'textarea' },
      { key: 'mysteriesAnswered', label: 'Mysteries Answered', type: 'textarea' },
      { key: 'majorReveals', label: 'Major Reveals', type: 'textarea' }
    ]
  },
  part: {
    label: 'Part', group: 'Story', icon: '§',
    fields: [
      { key: 'parentBookId', label: 'Book', type: 'entity', entityTypes: ['book'] },
      { key: 'order', label: 'Part Number / Order', type: 'number' },
      { key: 'purpose', label: 'Purpose / Arc', type: 'textarea' },
      { key: 'themes', label: 'Themes', type: 'textarea' }
    ]
  },
  chapter: {
    label: 'Chapter', group: 'Story', icon: '¶',
    fields: [
      { key: 'parentBookId', label: 'Book', type: 'entity', entityTypes: ['book'] },
      { key: 'parentPartId', label: 'Part (optional)', type: 'entity', entityTypes: ['part'] },
      { key: 'number', label: 'Chapter Number', type: 'number' },
      { key: 'pov', label: 'POV', type: 'text' },
      { key: 'locationText', label: 'Location', type: 'text' },
      { key: 'dateText', label: 'Date', type: 'text' },
      { key: 'purpose', label: 'Purpose', type: 'textarea' },
      { key: 'majorEvents', label: 'Major Events', type: 'textarea' },
      { key: 'characterDevelopment', label: 'Character Development', type: 'textarea' },
      { key: 'worldbuildingIntroduced', label: 'Worldbuilding Introduced', type: 'textarea' },
      { key: 'foreshadowing', label: 'Foreshadowing', type: 'textarea' },
      { key: 'readerKnowledgeGained', label: 'Reader Knowledge Gained', type: 'textarea' },
      { key: 'draftStatus', label: 'Draft Status', type: 'select', options: ['Idea','Outlined','Drafting','Drafted','Revising','Locked'] }
    ]
  },
  scene: {
    label: 'Scene', group: 'Story', icon: '▱',
    fields: [
      { key: 'parentChapterId', label: 'Chapter', type: 'entity', entityTypes: ['chapter'] },
      { key: 'order', label: 'Scene Order', type: 'number' },
      { key: 'pov', label: 'POV', type: 'text' },
      { key: 'locationId', label: 'Structured Location', type: 'entity', entityTypes: ['location'] },
      { key: 'locationText', label: 'Location', type: 'text' },
      { key: 'timeText', label: 'Time', type: 'text' },
      { key: 'storyDate', label: 'Story / World Date', type: 'text' },
      { key: 'storyDateSort', label: 'Sortable Story Date (optional)', type: 'number' },
      { key: 'purpose', label: 'Purpose', type: 'textarea' },
      { key: 'conflict', label: 'Conflict', type: 'textarea' },
      { key: 'outcome', label: 'Outcome', type: 'textarea' },
      { key: 'worldbuilding', label: 'Worldbuilding', type: 'textarea' },
      { key: 'characterDevelopment', label: 'Character Development', type: 'textarea' },
      { key: 'foreshadowing', label: 'Foreshadowing', type: 'textarea' },
      { key: 'reveal', label: 'Reveal', type: 'textarea' },
      { key: 'manuscriptText', label: 'Manuscript Draft', type: 'textarea' }
    ]
  },
  mystery: {
    label: 'Mystery / Reveal', group: 'Story', icon: '?',
    fields: [
      { key: 'actualAnswer', label: 'Actual Answer', type: 'textarea' },
      { key: 'whenIntroduced', label: 'Legacy Introduction Note', type: 'text' },
      { key: 'initialClue', label: 'Legacy Initial Clue', type: 'textarea' },
      { key: 'additionalClues', label: 'Legacy Additional Clues', type: 'textarea' },
      { key: 'redHerrings', label: 'Red Herrings', type: 'textarea' },
      { key: 'whoKnows', label: 'Who Knows / Partially Knows', type: 'textarea' },
      { key: 'commonExplanation', label: 'Common In-world Explanation', type: 'textarea' },
      { key: 'readerTheory', label: 'Expected Reader Interpretation', type: 'textarea' },
      { key: 'actualReveal', label: 'Actual Reveal', type: 'textarea' },
      { key: 'revealPoint', label: 'Legacy Reveal Point', type: 'text' },
      { key: 'consequences', label: 'Consequences', type: 'textarea' }
    ]
  },
  foreshadowing: {
    label: 'Foreshadowing', group: 'Story', icon: '→',
    fields: [
      { key: 'payoff', label: 'Payoff', type: 'textarea' },
      { key: 'event', label: 'Foreshadowing Event', type: 'textarea' },
      { key: 'storyEntityId', label: 'Part / Chapter / Scene', type: 'entity', entityTypes: ['part','chapter','scene'] },
      { key: 'chapter', label: 'Legacy Chapter / Scene Note', type: 'text' },
      { key: 'visibility', label: 'Visibility', type: 'select', options: FORESHADOW_VISIBILITY },
      { key: 'firstRead', label: 'Intended First-read Interpretation', type: 'textarea' },
      { key: 'trueInterpretation', label: 'True Interpretation', type: 'textarea' },
      { key: 'payoffOccurred', label: 'Has Payoff Occurred?', type: 'select', options: ['No','Yes'] }
    ]
  },
  question: {
    label: 'Unresolved Question', group: 'Planning', icon: '¿',
    statusMode: 'question',
    fields: [
      { key: 'question', label: 'Question', type: 'textarea' },
      { key: 'exploration', label: 'Exploration / Possible Answers', type: 'textarea' },
      { key: 'answer', label: 'Answer', type: 'textarea' }
    ]
  },
  idea: {
    label: 'Idea Inbox', group: 'Planning', icon: '+',
    statusMode: 'idea',
    fields: [
      { key: 'idea', label: 'Idea', type: 'textarea' },
      { key: 'possibleCategory', label: 'Possible Category', type: 'text' }
    ]
  }
};


// Fields in this registry are canonical structured references. Free-text compatibility
// fields may describe the same subject, but they are not authoritative references.
export const ENTITY_REFERENCE_FIELDS = Object.freeze({
  location:[{key:'parentLocationId',types:['location'],role:'Parent location'}],
  event:[{key:'eraId',types:['era'],role:'Era'},{key:'locationId',types:['location'],role:'Location'}],
  civilization:[{key:'homelandLocationId',types:['location'],role:'Homeland'}],
  character:[{key:'homelandLocationId',types:['location'],role:'Homeland'},{key:'currentLocationId',types:['location'],role:'Current location'}],
  organization:[{key:'headquartersLocationId',types:['location'],role:'Headquarters'}],
  artifact:[{key:'creatorId',types:null,role:'Creator'},{key:'originalOwnerId',types:null,role:'Original owner'},{key:'currentOwnerId',types:null,role:'Current owner'}],
  map:[{key:'scopeLocationId',types:['location'],role:'Map scope'},{key:'parentMapId',types:['map'],role:'Parent map'},{key:'eraId',types:['era'],role:'Era'}],
  trilogy:[{key:'protagonistIds',types:['character'],role:'Series protagonist',many:true}],
  part:[{key:'parentBookId',types:['book'],role:'Parent book'}],
  chapter:[{key:'parentBookId',types:['book'],role:'Parent book'},{key:'parentPartId',types:['part'],role:'Parent part'}],
  scene:[{key:'parentChapterId',types:['chapter'],role:'Parent chapter'},{key:'locationId',types:['location'],role:'Location'}],
  foreshadowing:[{key:'storyEntityId',types:['part','chapter','scene'],role:'Story point'}]
});

export const SEMANTIC_TEXT_REFERENCE_PAIRS = Object.freeze({
  character:[['homeland','homelandLocationId','Homeland'],['currentLocation','currentLocationId','Current location']],
  civilization:[['homeland','homelandLocationId','Homeland']],
  organization:[['headquarters','headquartersLocationId','Headquarters']],
  artifact:[['creator','creatorId','Creator'],['originalOwner','originalOwnerId','Original owner'],['currentOwner','currentOwnerId','Current owner']]
});

export function referenceFieldsForType(type){ return ENTITY_REFERENCE_FIELDS[type] || []; }

export const TYPE_GROUPS = Object.entries(ENTRY_TYPES).reduce((acc, [key, value]) => {
  (acc[value.group] ||= []).push({ key, ...value });
  return acc;
}, {});

export const RELATION_TYPES = [
  'related_to', 'parent_of', 'child_of', 'sibling_of', 'friend_of', 'rival_of', 'enemy_of',
  'romantic_with', 'mentor_of', 'student_of', 'ally_of', 'political_enemy_of', 'member_of',
  'located_in', 'belongs_to', 'created_by', 'owned_by', 'participated_in', 'influenced',
  'appears_in', 'introduced_in', 'clue_in', 'revealed_in', 'foreshadows', 'contradicts', 'supports', 'converted_to',
  'spouse_of', 'former_spouse_of', 'guardian_of', 'adoptive_parent_of', 'allied_with', 'hostile_to', 'neutral_with',
  'vassal_of', 'trade_partner_with', 'occupied_by', 'at_war_with', 'contains', 'part_of', 'precedes', 'requires'
];

export function defaultStatusFor(type) {
  if (ENTRY_TYPES[type]?.statusMode === 'question') return 'Open';
  if (ENTRY_TYPES[type]?.statusMode === 'idea') return 'Inbox';
  return 'Concept';
}

export function validStatusesFor(type) {
  if (ENTRY_TYPES[type]?.statusMode === 'question') return QUESTION_STATUSES;
  if (ENTRY_TYPES[type]?.statusMode === 'idea') return IDEA_STATUSES;
  return CANON_STATUSES;
}

export function createEmptyEntity(type = 'lore') {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID?.() || `e_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type,
    name: '',
    summary: '',
    status: defaultStatusFor(type),
    tags: [],
    favorite: false,
    archivedAt: null,
    fields: {},
    notes: '',
    createdAt: now,
    updatedAt: now
  };
}

export function validateEntity(entity) {
  if (!entity || typeof entity !== 'object') return ['Entity must be an object.'];
  const errors = [];
  if (!entity.id) errors.push('Entity requires an id.');
  if (!ENTRY_TYPES[entity.type]) errors.push(`Unknown entity type: ${entity.type || '(missing)'}.`);
  if (!String(entity.name || '').trim()) errors.push('Name is required.');
  if (!validStatusesFor(entity.type).includes(entity.status)) errors.push('Invalid status for this entity type.');
  if (!Array.isArray(entity.tags)) errors.push('Tags must be an array.');
  return errors;
}
