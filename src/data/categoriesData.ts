export interface CategoryMeta {
  slug: string;
  name: string;
  emoji: string;
  department: string;
  description: string;
  subcategories: string[];
  safetyGuidance: string;
}

export const CATEGORIES_DATA: CategoryMeta[] = [
  {
    slug: "waste-management-sanitation",
    name: "Waste Management & Sanitation",
    emoji: "🗑️",
    department: "Solid Waste Management Department",
    description:
      "Municipal services overseeing daily household garbage collection, public community bins, dead animal disposal, and public toilet cleanliness throughout Pune.",
    subcategories: [
      "Missed garbage collection",
      "Overflowing public dustbins",
      "Dead animal removal",
      "Public toilet maintenance",
    ],
    safetyGuidance:
      "Avoid handling decomposing waste or dead animals directly. Keep pets and children away from overflowing garbage bins to prevent bacterial exposure.",
  },
  {
    slug: "roads-infrastructure",
    name: "Roads & Infrastructure",
    emoji: "🕳️",
    department: "Road & Traffic Department",
    description:
      "Management of city streets, potholes, traffic safety lights, damaged pavements, and pedestrian footpaths across all 15 Pune ward offices.",
    subcategories: [
      "Potholes or damaged roads",
      "Broken or flickering streetlights",
      "Open or damaged manhole covers",
      "Damaged footpaths or sidewalks",
    ],
    safetyGuidance:
      "Stay clear of open or broken manholes and alert other pedestrians or two-wheelers. Never touch hanging or broken streetlight cables.",
  },
  {
    slug: "water-sewage",
    name: "Water & Sewage",
    emoji: "💧",
    department: "Water Supply & Drainage Department",
    description:
      "Municipal water distribution pipelines, drainage networks, sewage line blockages, contamination monitoring, and emergency water tanker coordination.",
    subcategories: [
      "Contaminated or muddy water supply",
      "Major pipe leaks or bursts",
      "Overflowing sewage or blocked sewage lines",
      "Unscheduled water supply cuts",
    ],
    safetyGuidance:
      "Do not consume discoloured or foul-smelling tap water without boiling. Stay away from overflowing drain water to prevent waterborne contamination.",
  },
  {
    slug: "civic-nuisance-public-safety",
    name: "Civic Nuisance & Public Safety",
    emoji: "⚠️",
    department: "Encroachment & Public Safety Department",
    description:
      "Urban public safety, unauthorized street encroachments, stray animal management, illegal tree cutting, and abandoned vehicle clearance.",
    subcategories: [
      "Stray animal menace",
      "Illegal tree cutting",
      "Unauthorized construction",
      "Illegal parking or abandoned vehicles",
    ],
    safetyGuidance:
      "Do not provoke aggressive stray animals. Do not enter unauthorized or structurally unstable construction zones.",
  },
  {
    slug: "other",
    name: "Other Municipal Issues",
    emoji: "📍",
    department: "General Municipal Administration",
    description:
      "General civic grievances that do not directly fall within the four main operational branches of the Pune Municipal Corporation.",
    subcategories: ["Free-text municipal issue"],
    safetyGuidance:
      "If a situation presents an immediate threat to life, contact standard emergency services. For general civic defects, report here with photos.",
  },
];
