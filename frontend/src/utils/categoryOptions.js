/**
 * Category and form options for the predictor form dropdowns.
 */

export const CATEGORY_OPTIONS = [
  { value: 'OPEN', label: 'OPEN — Open / General' },
  { value: 'SC', label: 'SC — Scheduled Caste' },
  { value: 'ST', label: 'ST — Scheduled Tribe' },
  { value: 'VJ', label: 'VJ — Vimukta Jati / Denotified Tribes' },
  { value: 'NT1', label: 'NT1 — Nomadic Tribes (NT-B)' },
  { value: 'NT2', label: 'NT2 — Nomadic Tribes (NT-C)' },
  { value: 'NT3', label: 'NT3 — Nomadic Tribes (NT-D)' },
  { value: 'OBC', label: 'OBC — Other Backward Class' },
  { value: 'SEBC', label: 'SEBC — Socially & Educationally Backward Class' },
  { value: 'EWS', label: 'EWS — Economically Weaker Section' },
  { value: 'PWD', label: 'PWD — Person With Disability' },
  { value: 'DEF', label: 'DEF — Defence' },
  { value: 'TFW', label: 'TFW — Tuition Fee Waiver' },
  { value: 'ORPHAN', label: 'ORPHAN — Orphan Quota' },
  { value: 'MI', label: 'MI — Minority Quota' }
];

export const GENDER_OPTIONS = [
  { value: 'G', label: 'Male / General', icon: '👨' },
  { value: 'L', label: 'Female', icon: '👩' }
];

export const SEAT_TYPE_OPTIONS = [
  { value: 'S', label: 'State Level', description: 'Open to all Maharashtra students' },
  { value: 'H', label: 'Home University', description: 'Seats reserved for home university students' },
  { value: 'O', label: 'Other than Home University', description: 'Seats for students from other universities' }
];

export const MAHARASHTRA_UNIVERSITIES = [
  { value: 'Mumbai University', label: 'Mumbai University (MU)' },
  { value: 'Savitribai Phule Pune University', label: 'Savitribai Phule Pune University (SPPU)' },
  { value: 'Shivaji University', label: 'Shivaji University (SU)' },
  { value: 'Rashtrasant Tukadoji Maharaj Nagpur University', label: 'Rashtrasant Tukadoji Maharaj Nagpur University (RTMNU)' },
  { value: 'Sant Gadge Baba Amravati University', label: 'Sant Gadge Baba Amravati University (SGBAU)' },
  { value: 'Dr. Babasaheb Ambedkar Marathwada University', label: 'Dr. Babasaheb Ambedkar Marathwada University (BAMU)' },
  { value: 'Swami Ramanand Teerth Marathwada University, Nanded', label: 'Swami Ramanand Teerth Marathwada University, Nanded (SRTMUN)' },
  { value: 'Kavayitri Bahinabai Chaudhari North Maharashtra University, Jalgaon', label: 'Kavayitri Bahinabai Chaudhari North Maharashtra University, Jalgaon (KBCNMU)' },
  { value: 'Punyashlok Ahilyadevi Holkar Solapur University', label: 'Punyashlok Ahilyadevi Holkar Solapur University (PAHSU)' },
  { value: 'Gondwana University', label: 'Gondwana University (GU)' },
  { value: 'Outside Maharashtra State (OMS)', label: 'Outside Maharashtra State (OMS) / Other' }
];

export const COLLEGE_TYPE_OPTIONS = [
  { value: 'all', label: 'All College Types' },
  { value: 'Government', label: 'Government' },
  { value: 'Government Autonomous', label: 'Government Autonomous' },
  { value: 'Government Aided', label: 'Government Aided' },
  { value: 'Un-Aided', label: 'Un-Aided (Private)' },
  { value: 'Autonomous', label: 'Autonomous' }
];

export const JOSAA_COLLEGE_TYPE_OPTIONS = [
  { value: 'all', label: 'All College Types' },
  { value: 'IIT/NIT', label: 'IIT / NIT' },
  { value: 'Central Govt', label: 'Central Govt' }
];

export const SORT_OPTIONS = [
  { value: 'chance-desc', label: 'Low to High Chance' },
  { value: 'cutoff-asc', label: 'Cutoff: Low → High' },
  { value: 'cutoff-desc', label: 'Cutoff: High → Low' },
  { value: 'name-asc', label: 'College Name: A → Z' },
  { value: 'diff-desc', label: 'Margin: High → Low' }
];

export const CHANCE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Chances' },
  { value: 'High', label: '🟢 High Chance' },
  { value: 'Medium', label: '🟡 Medium Chance' },
  { value: 'Low', label: '🔴 Low Chance' }
];

export const JOSAA_CATEGORY_OPTIONS = [
  { value: 'OPEN', label: 'OPEN — Open / General' },
  { value: 'OBC-NCL', label: 'OBC-NCL — Other Backward Classes (Non-Creamy Layer)' },
  { value: 'SC', label: 'SC — Scheduled Caste' },
  { value: 'ST', label: 'ST — Scheduled Tribe' },
  { value: 'EWS', label: 'EWS — Economically Weaker Section' },
  { value: 'OPEN (PwD)', label: 'OPEN (PwD) — Open with Disability' },
  { value: 'OBC-NCL (PwD)', label: 'OBC-NCL (PwD) — OBC Non-Creamy Layer with Disability' },
  { value: 'SC (PwD)', label: 'SC (PwD) — Scheduled Caste with Disability' },
  { value: 'ST (PwD)', label: 'ST (PwD) — Scheduled Tribe with Disability' },
  { value: 'EWS (PwD)', label: 'EWS (PwD) — Economically Weaker Section with Disability' }
];

export const JOSAA_SEAT_TYPE_OPTIONS = [
  { value: 'AI', label: 'AI — All India' },
  { value: 'HS', label: 'HS — Home State' },
  { value: 'OS', label: 'OS — Other State' }
];

/**
 * Get the emoji and color for a chance label
 */
export function getChanceDisplay(chanceLabel) {
  switch (chanceLabel) {
    case 'High':
      return { emoji: '🟢', className: 'badge-high', text: 'High Chance' };
    case 'Medium':
      return { emoji: '🟡', className: 'badge-medium', text: 'Medium Chance' };
    case 'Low':
      return { emoji: '🔴', className: 'badge-low', text: 'Low Chance' };
    default:
      return { emoji: '⚪', className: 'badge-info', text: chanceLabel };
  }
}
