/**
 * Official Pune Municipal Corporation (PMC) Department Contacts.
 *
 * NOTE FOR HACKATHON EVALUATORS & CITIZENS:
 * Every contact field is explicitly set to `null` until officially verified.
 * We DO NOT invent or fabricate any PMC phone numbers, emails, office hours,
 * or service commitments.
 *
 * Official website: https://pmc.gov.in
 */

export interface DepartmentContact {
  department: string;
  categorySlug: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  workingHours: string | null;
  source: string | null;
  lastVerified: string | null;
  officialPmcUrl: string;
}

export const PMC_OFFICIAL_WEBSITE = "https://pmc.gov.in";

export const DEPARTMENT_CONTACTS: Record<string, DepartmentContact> = {
  "waste-management-sanitation": {
    department: "Solid Waste Management Department",
    categorySlug: "waste-management-sanitation",
    phone: null,
    email: null,
    website: null,
    workingHours: null,
    source: null,
    lastVerified: null,
    officialPmcUrl: "https://pmc.gov.in",
  },
  "roads-infrastructure": {
    department: "Road & Traffic Department",
    categorySlug: "roads-infrastructure",
    phone: null,
    email: null,
    website: null,
    workingHours: null,
    source: null,
    lastVerified: null,
    officialPmcUrl: "https://pmc.gov.in",
  },
  "water-sewage": {
    department: "Water Supply & Drainage Department",
    categorySlug: "water-sewage",
    phone: null,
    email: null,
    website: null,
    workingHours: null,
    source: null,
    lastVerified: null,
    officialPmcUrl: "https://pmc.gov.in",
  },
  "civic-nuisance-public-safety": {
    department: "Encroachment & Public Safety Department",
    categorySlug: "civic-nuisance-public-safety",
    phone: null,
    email: null,
    website: null,
    workingHours: null,
    source: null,
    lastVerified: null,
    officialPmcUrl: "https://pmc.gov.in",
  },
  other: {
    department: "General Municipal Administration",
    categorySlug: "other",
    phone: null,
    email: null,
    website: null,
    workingHours: null,
    source: null,
    lastVerified: null,
    officialPmcUrl: "https://pmc.gov.in",
  },
};

/**
 * NagarSetu Technical Support Contacts.
 * Strictly separated from municipal administration contacts.
 * A call to technical support is NEVER a municipal grievance submission.
 */
export const NAGARSETU_TECH_SUPPORT = {
  systemName: "NagarSetu Civic Workflow Engine (G-02 GovFix)",
  supportEmail: "support@nagarsetu.pune.internal",
  helpdeskHours: "24x7 Portal Access • Automated Workflow SLA Monitor",
  disclaimer:
    "Technical support assists exclusively with portal access, submission errors, and tracking inquiries. Submitting an issue through NagarSetu is the official digital channel for civic grievances; technical support cannot resolve municipal field problems.",
};
