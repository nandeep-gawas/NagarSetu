import {
  PrismaClient,
  IssueStatus,
  IssuePriority,
  Role,
} from "@prisma/client";
import bcrypt from "bcryptjs";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./dev.db";
}

const prisma = new PrismaClient();

export const DEMO_PASSWORD = "PuneDemo@2026";
export const DEMO_RULE_LABEL =
  "Demonstration rules, not official PMC standards";

async function main() {
  if (process.argv.includes("--if-empty")) {
    const existingCount = await prisma.category.count();
    if (existingCount > 0) {
      console.log("✅ Database already seeded, skipping (--if-empty).");
      return;
    }
  }

  console.log("🌱 Seeding NagarSetu (Pune Municipal Grievance Engine)...");


  // Clean existing records in dependency order
  await prisma.deadlineChange.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.escalationEvent.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.evidence.deleteMany();
  await prisma.report.deleteMany();
  await prisma.issue.deleteMany();
  await prisma.deadlineRule.deleteMany();
  await prisma.priorityRule.deleteMany();
  await prisma.workflowTransition.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();
  await prisma.subcategory.deleteMany();
  await prisma.category.deleteMany();

  // 1. Create EXACTLY the 5 Categories and Subcategories
  const categorySpecs = [
    {
      key: "waste",
      name: "Waste Management & Sanitation",
      emoji: "🗑️",
      departmentName: "Solid Waste Management Department (PMC)",
      description:
        "Garbage collection, public dustbins, sanitation, and public toilets across Pune wards.",
      subcategories: [
        { name: "Missed garbage collection", respHours: 6, resHours: 24 },
        { name: "Overflowing public dustbins", respHours: 6, resHours: 24 },
        { name: "Dead animal removal", respHours: 4, resHours: 12 },
        { name: "Public toilet maintenance", respHours: 8, resHours: 36 },
      ],
    },
    {
      key: "roads",
      name: "Roads & Infrastructure",
      emoji: "🕳️",
      departmentName: "Road & Street Infrastructure Department (PMC)",
      description:
        "Potholes, road surfacing, streetlights, manhole covers, and pedestrian footpaths.",
      subcategories: [
        { name: "Potholes or damaged roads", respHours: 12, resHours: 72 },
        {
          name: "Broken or flickering streetlights",
          respHours: 12,
          resHours: 48,
        },
        { name: "Open or damaged manhole covers", respHours: 4, resHours: 24 },
        { name: "Damaged footpaths or sidewalks", respHours: 24, resHours: 96 },
      ],
    },
    {
      key: "water",
      name: "Water & Sewage",
      emoji: "💧",
      departmentName: "Water Supply & Sewerage Department (PMC)",
      description:
        "Water quality, major pipeline bursts, sewage overflows, and unscheduled supply cuts.",
      subcategories: [
        {
          name: "Contaminated or muddy water supply",
          respHours: 6,
          resHours: 24,
        },
        { name: "Major pipe leaks or bursts", respHours: 4, resHours: 24 },
        {
          name: "Overflowing sewage or blocked sewage lines",
          respHours: 6,
          resHours: 36,
        },
        { name: "Unscheduled water supply cuts", respHours: 6, resHours: 24 },
      ],
    },
    {
      key: "safety",
      name: "Civic Nuisance & Public Safety",
      emoji: "⚠️",
      departmentName: "Encroachment & Civic Safety Department (PMC)",
      description:
        "Stray animal hazards, illegal tree felling, unauthorized construction, and abandoned vehicles.",
      subcategories: [
        { name: "Stray animal menace", respHours: 8, resHours: 48 },
        { name: "Illegal tree cutting", respHours: 6, resHours: 24 },
        { name: "Unauthorized construction", respHours: 24, resHours: 120 },
        {
          name: "Illegal parking or abandoned vehicles",
          respHours: 12,
          resHours: 72,
        },
      ],
    },
    {
      key: "other",
      name: "Other",
      emoji: "📍",
      departmentName: "General Municipal Grievance Cell (PMC)",
      description: "A free-text municipal issue that fits nowhere else.",
      subcategories: [
        {
          name: "Free-text municipal issue",
          respHours: 12,
          resHours: 72,
        },
      ],
    },
  ];

  const categoriesByKey: Record<
    string,
    {
      id: string;
      name: string;
      departmentId: string;
      subcategories: { id: string; name: string }[];
    }
  > = {};

  for (const spec of categorySpecs) {
    const cat = await prisma.category.create({
      data: {
        name: spec.name,
        emoji: spec.emoji,
        description: spec.description,
      },
    });

    const dept = await prisma.department.create({
      data: {
        name: spec.departmentName,
        categoryId: cat.id,
      },
    });

    const createdSubs: { id: string; name: string }[] = [];
    for (const subSpec of spec.subcategories) {
      const sub = await prisma.subcategory.create({
        data: {
          name: subSpec.name,
          categoryId: cat.id,
        },
      });
      createdSubs.push({ id: sub.id, name: sub.name });

      // Subcategory-specific DeadlineRule
      await prisma.deadlineRule.create({
        data: {
          categoryId: cat.id,
          subcategoryId: sub.id,
          severity: subSpec.resHours <= 24 ? "HIGH" : "STANDARD",
          responseHours: subSpec.respHours,
          resolutionHours: subSpec.resHours,
          label: DEMO_RULE_LABEL,
        },
      });
    }

    // Category fallback DeadlineRule (subcategoryId = null)
    await prisma.deadlineRule.create({
      data: {
        categoryId: cat.id,
        subcategoryId: null,
        severity: "STANDARD",
        responseHours: 12,
        resolutionHours: 48,
        label: DEMO_RULE_LABEL,
      },
    });

    categoriesByKey[spec.key] = {
      id: cat.id,
      name: cat.name,
      departmentId: dept.id,
      subcategories: createdSubs,
    };
  }

  // 2. Create PriorityRules (editable in DB)
  await prisma.priorityRule.createMany({
    data: [
      {
        ruleType: "OVERDUE_HIGH",
        threshold: 0,
        resultingPriority: "HIGH",
        label: DEMO_RULE_LABEL,
      },
      {
        ruleType: "OVERDUE_CRITICAL",
        threshold: 24,
        resultingPriority: "CRITICAL",
        label: DEMO_RULE_LABEL,
      },
      {
        ruleType: "REPORT_COUNT",
        threshold: 3,
        resultingPriority: "HIGH",
        label: DEMO_RULE_LABEL,
      },
      {
        ruleType: "REPORT_COUNT",
        threshold: 5,
        resultingPriority: "CRITICAL",
        label: DEMO_RULE_LABEL,
      },
    ],
  });

  // 3. Create Default WorkflowTransition rows
  const transitions: {
    fromState: IssueStatus;
    toState: IssueStatus;
    allowedRoles: Role[];
    requiresReason: boolean;
    sameDepartmentOnly: boolean;
  }[] = [
    {
      fromState: "SUBMITTED",
      toState: "VERIFIED",
      allowedRoles: ["OFFICER", "SUPERVISOR", "ADMIN"],
      requiresReason: false,
      sameDepartmentOnly: true,
    },
    {
      fromState: "VERIFIED",
      toState: "ASSIGNED",
      allowedRoles: ["OFFICER", "SUPERVISOR", "ADMIN"],
      requiresReason: false,
      sameDepartmentOnly: true,
    },
    {
      fromState: "ASSIGNED",
      toState: "IN_PROGRESS",
      allowedRoles: ["OFFICER", "SUPERVISOR", "ADMIN"],
      requiresReason: false,
      sameDepartmentOnly: true,
    },
    {
      fromState: "IN_PROGRESS",
      toState: "RESOLVED_AWAITING_VERIFICATION",
      allowedRoles: ["OFFICER", "SUPERVISOR", "ADMIN"],
      requiresReason: false,
      sameDepartmentOnly: true,
    },
    {
      fromState: "RESOLVED_AWAITING_VERIFICATION",
      toState: "CLOSED",
      allowedRoles: ["SUPERVISOR"],
      requiresReason: false,
      sameDepartmentOnly: false,
    },
    {
      fromState: "RESOLVED_AWAITING_VERIFICATION",
      toState: "REOPENED",
      allowedRoles: ["CITIZEN", "SUPERVISOR", "ADMIN"],
      requiresReason: true,
      sameDepartmentOnly: false,
    },
    {
      fromState: "REOPENED",
      toState: "ASSIGNED",
      allowedRoles: ["OFFICER", "SUPERVISOR", "ADMIN"],
      requiresReason: false,
      sameDepartmentOnly: true,
    },
    {
      fromState: "SUBMITTED",
      toState: "REJECTED",
      allowedRoles: ["SUPERVISOR", "ADMIN"],
      requiresReason: true,
      sameDepartmentOnly: false,
    },
    {
      fromState: "VERIFIED",
      toState: "REJECTED",
      allowedRoles: ["SUPERVISOR", "ADMIN"],
      requiresReason: true,
      sameDepartmentOnly: false,
    },
  ];

  for (const t of transitions) {
    await prisma.workflowTransition.create({
      data: {
        fromState: t.fromState,
        toState: t.toState,
        allowedRoles: t.allowedRoles,
        requiresReason: t.requiresReason,
        sameDepartmentOnly: t.sameDepartmentOnly,
      },
    });
  }

  // 4. Create Demo Users (1 Admin, 2 Supervisors, 5 Officers across 5 departments, 5 Citizens)
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const adminUser = await prisma.user.create({
    data: {
      name: "Rajesh Deshmukh (PMC Admin)",
      email: "admin@pune.gov.in",
      passwordHash,
      phone: "+91-9822010001",
      role: "ADMIN",
      isDemo: true,
    },
  });

  const supervisorWest = await prisma.user.create({
    data: {
      name: "Vandana Kulkarni (Supervisor West)",
      email: "supervisor.west@pune.gov.in",
      passwordHash,
      phone: "+91-9822010002",
      role: "SUPERVISOR",
      isDemo: true,
    },
  });

  const supervisorEast = await prisma.user.create({
    data: {
      name: "Suresh Patil (Supervisor East)",
      email: "supervisor.east@pune.gov.in",
      passwordHash,
      phone: "+91-9822010003",
      role: "SUPERVISOR",
      isDemo: true,
    },
  });

  const officerWaste = await prisma.user.create({
    data: {
      name: "Amol Jadhav (Waste Officer)",
      email: "officer.waste@pune.gov.in",
      passwordHash,
      phone: "+91-9822020001",
      role: "OFFICER",
      departmentId: categoriesByKey.waste.departmentId,
      isDemo: true,
    },
  });

  const officerRoads = await prisma.user.create({
    data: {
      name: "Priya Joshi (Roads Officer)",
      email: "officer.roads@pune.gov.in",
      passwordHash,
      phone: "+91-9822020002",
      role: "OFFICER",
      departmentId: categoriesByKey.roads.departmentId,
      isDemo: true,
    },
  });

  const officerWater = await prisma.user.create({
    data: {
      name: "Vikram Pawar (Water Officer)",
      email: "officer.water@pune.gov.in",
      passwordHash,
      phone: "+91-9822020003",
      role: "OFFICER",
      departmentId: categoriesByKey.water.departmentId,
      isDemo: true,
    },
  });

  const officerSafety = await prisma.user.create({
    data: {
      name: "Neha Bhosale (Safety Officer)",
      email: "officer.safety@pune.gov.in",
      passwordHash,
      phone: "+91-9822020004",
      role: "OFFICER",
      departmentId: categoriesByKey.safety.departmentId,
      isDemo: true,
    },
  });

  const officerOther = await prisma.user.create({
    data: {
      name: "Kiran Gaikwad (General Grievance Officer)",
      email: "officer.other@pune.gov.in",
      passwordHash,
      phone: "+91-9822020005",
      role: "OFFICER",
      departmentId: categoriesByKey.other.departmentId,
      isDemo: true,
    },
  });

  const officersByKey: Record<string, { id: string; name: string }> = {
    waste: officerWaste,
    roads: officerRoads,
    water: officerWater,
    safety: officerSafety,
    other: officerOther,
  };

  const citizens = await Promise.all([
    prisma.user.create({
      data: {
        name: "Aarav Sharma",
        email: "aarav.sharma@citizen.in",
        passwordHash,
        phone: "+91-9850030001",
        role: "CITIZEN",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Sneha Apte",
        email: "sneha.apte@citizen.in",
        passwordHash,
        phone: "+91-9850030002",
        role: "CITIZEN",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Rohan Gokhale",
        email: "rohan.gokhale@citizen.in",
        passwordHash,
        phone: "+91-9850030003",
        role: "CITIZEN",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Pooja Chitale",
        email: "pooja.chitale@citizen.in",
        passwordHash,
        phone: "+91-9850030004",
        role: "CITIZEN",
        isDemo: true,
      },
    }),
    prisma.user.create({
      data: {
        name: "Nikhil Kale",
        email: "nikhil.kale@citizen.in",
        passwordHash,
        phone: "+91-9850030005",
        role: "CITIZEN",
        isDemo: true,
      },
    }),
  ]);

  // 5. Create 30 realistic Demo Issues + Reports across real Pune neighborhoods
  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000);
  const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600 * 1000);

  const demoIssuesData: {
    catKey: "waste" | "roads" | "water" | "safety" | "other";
    subIdx: number;
    status: IssueStatus;
    priority: IssuePriority;
    isOverdue: boolean;
    lat: number;
    lng: number;
    area: string;
    description: string;
    reportCount: number;
    createdHoursAgo: number;
    respDeadlineHoursOffset: number;
    resDeadlineHoursOffset: number;
    language?: string;
  }[] = [
    {
      catKey: "roads",
      subIdx: 0,
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      isOverdue: true,
      lat: 18.5074,
      lng: 73.8077,
      area: "Paud Road, Kothrud Depot, Kothrud",
      description:
        "Deep waterlogged crater pothole near Kothrud Bus Stand causing two-wheeler skids during peak commute.",
      reportCount: 5,
      createdHoursAgo: 110,
      respDeadlineHoursOffset: -98,
      resDeadlineHoursOffset: -38,
      language: "en",
    },
    {
      catKey: "water",
      subIdx: 1,
      status: "ASSIGNED",
      priority: "CRITICAL",
      isOverdue: true,
      lat: 18.5089,
      lng: 73.9259,
      area: "Magarpatta South Gate, Hadapsar",
      description:
        "Major PMC main distribution pipeline burst flooding the service road and wasting thousands of litres of potable water.",
      reportCount: 6,
      createdHoursAgo: 56,
      respDeadlineHoursOffset: -52,
      resDeadlineHoursOffset: -32,
      language: "en",
    },
    {
      catKey: "waste",
      subIdx: 0,
      status: "VERIFIED",
      priority: "HIGH",
      isOverdue: true,
      lat: 18.5314,
      lng: 73.8446,
      area: "JM Road Corner, Shivajinagar",
      description:
        "Door-to-door ghantagadi garbage collection vehicle has skipped our lane for 3 consecutive mornings.",
      reportCount: 3,
      createdHoursAgo: 32,
      respDeadlineHoursOffset: -26,
      resDeadlineHoursOffset: -8,
      language: "mr",
    },
    {
      catKey: "roads",
      subIdx: 2,
      status: "ASSIGNED",
      priority: "HIGH",
      isOverdue: true,
      lat: 18.559,
      lng: 73.7868,
      area: "Balewadi High Street Link Road, Baner",
      description:
        "Uncovered storm drainage manhole right in the middle of the left turning lane near Baner-Balewadi junction.",
      reportCount: 4,
      createdHoursAgo: 30,
      respDeadlineHoursOffset: -26,
      resDeadlineHoursOffset: -6,
      language: "en",
    },
    {
      catKey: "water",
      subIdx: 2,
      status: "IN_PROGRESS",
      priority: "HIGH",
      isOverdue: false,
      lat: 18.5679,
      lng: 73.9143,
      area: "Datta Mandir Chowk, Viman Nagar",
      description:
        "Blocked underground sewage line overflowing onto pedestrian walkway outside residential societies.",
      reportCount: 3,
      createdHoursAgo: 18,
      respDeadlineHoursOffset: -12,
      resDeadlineHoursOffset: 18,
      language: "en",
    },
    {
      catKey: "waste",
      subIdx: 1,
      status: "SUBMITTED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5515,
      lng: 73.9348,
      area: "EON IT Park Phase 1 Road, Kharadi",
      description:
        "Community waste bins overflowing onto road median near food stalls; stray dogs scattering plastic bags.",
      reportCount: 2,
      createdHoursAgo: 5,
      respDeadlineHoursOffset: 1,
      resDeadlineHoursOffset: 19,
      language: "en",
    },
    {
      catKey: "safety",
      subIdx: 3,
      status: "VERIFIED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5018,
      lng: 73.8636,
      area: "Jedhe Chowk Flyover Ramp, Swargate",
      description:
        "Two rusted abandoned commercial tempos parked permanently beneath the flyover blocking bus bay visibility.",
      reportCount: 1,
      createdHoursAgo: 14,
      respDeadlineHoursOffset: -2,
      resDeadlineHoursOffset: 58,
      language: "en",
    },
    {
      catKey: "roads",
      subIdx: 1,
      status: "RESOLVED_AWAITING_VERIFICATION",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.558,
      lng: 73.8075,
      area: "ITI Road, Aundh",
      description:
        "Entire stretch of 8 LED streetlights flickering and shutting off after 8 PM between Parihar Chowk and ब्रेमेन Chowk.",
      reportCount: 2,
      createdHoursAgo: 40,
      respDeadlineHoursOffset: -28,
      resDeadlineHoursOffset: 8,
      language: "en",
    },
    {
      catKey: "water",
      subIdx: 0,
      status: "IN_PROGRESS",
      priority: "HIGH",
      isOverdue: false,
      lat: 18.5167,
      lng: 73.8415,
      area: "Goodluck Chowk, Deccan Gymkhana",
      description:
        "Brownish muddy tap water with foul odour supplied during morning hours in Prabhat Road lanes.",
      reportCount: 4,
      createdHoursAgo: 10,
      respDeadlineHoursOffset: -4,
      resDeadlineHoursOffset: 14,
      language: "en",
    },
    {
      catKey: "safety",
      subIdx: 1,
      status: "ASSIGNED",
      priority: "HIGH",
      isOverdue: false,
      lat: 18.5362,
      lng: 73.894,
      area: "Lane 6, Koregaon Park",
      description:
        "Unauthorized felling of heritage rain tree branches at night without PMC Tree Authority permit.",
      reportCount: 3,
      createdHoursAgo: 9,
      respDeadlineHoursOffset: -3,
      resDeadlineHoursOffset: 15,
      language: "en",
    },
    {
      catKey: "roads",
      subIdx: 0,
      status: "REOPENED",
      priority: "HIGH",
      isOverdue: true,
      lat: 18.477,
      lng: 73.8168,
      area: "Rajaram Bridge Junction, Sinhagad Road",
      description:
        "Loose gravel patchwork washed away within 48 hours of temporary repair; road surface uneven again.",
      reportCount: 3,
      createdHoursAgo: 85,
      respDeadlineHoursOffset: -73,
      resDeadlineHoursOffset: -13,
      language: "mr",
    },
    {
      catKey: "waste",
      subIdx: 2,
      status: "CLOSED",
      priority: "HIGH",
      isOverdue: false,
      lat: 18.4529,
      lng: 73.8652,
      area: "Katraj Dairy Chowk, Katraj",
      description:
        "Carcass of dead stray animal on service lane requiring immediate sanitary disposal and bleaching.",
      reportCount: 2,
      createdHoursAgo: 28,
      respDeadlineHoursOffset: -24,
      resDeadlineHoursOffset: -16,
      language: "en",
    },
    {
      catKey: "water",
      subIdx: 3,
      status: "SUBMITTED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5529,
      lng: 73.8797,
      area: "Shastri Nagar Chowk, Yerwada",
      description:
        "Complete unscheduled water supply cut since yesterday morning without prior PMC tank maintenance alert.",
      reportCount: 2,
      createdHoursAgo: 4,
      respDeadlineHoursOffset: 2,
      resDeadlineHoursOffset: 20,
      language: "hi",
    },
    {
      catKey: "safety",
      subIdx: 0,
      status: "VERIFIED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5158,
      lng: 73.7689,
      area: "Chandni Chowk Underpass, Bavdhan",
      description:
        "Pack of aggressive stray dogs chasing two-wheelers late at night near Bavdhan NDA ramp.",
      reportCount: 1,
      createdHoursAgo: 12,
      respDeadlineHoursOffset: -4,
      resDeadlineHoursOffset: 36,
      language: "en",
    },
    {
      catKey: "roads",
      subIdx: 3,
      status: "IN_PROGRESS",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5413,
      lng: 73.7925,
      area: "Pashan-Sus Road, Pashan",
      description:
        "Concrete footpath tiles caved in above utility duct forcing senior citizens to walk on main carriageway.",
      reportCount: 1,
      createdHoursAgo: 20,
      respDeadlineHoursOffset: 4,
      resDeadlineHoursOffset: 76,
      language: "en",
    },
    {
      catKey: "safety",
      subIdx: 2,
      status: "REJECTED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.4695,
      lng: 73.889,
      area: "NIBM Road Junction, Kondhwa",
      description:
        "Complaint regarding commercial shed extension — verified against approved building layout plan.",
      reportCount: 1,
      createdHoursAgo: 60,
      respDeadlineHoursOffset: -36,
      resDeadlineHoursOffset: 60,
      language: "en",
    },
    {
      catKey: "waste",
      subIdx: 3,
      status: "RESOLVED_AWAITING_VERIFICATION",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5136,
      lng: 73.8781,
      area: "MG Road Public Convenience, Camp",
      description:
        "Broken water tap and non-functional exhaust fan inside municipal pay-and-use toilet block.",
      reportCount: 1,
      createdHoursAgo: 30,
      respDeadlineHoursOffset: -22,
      resDeadlineHoursOffset: 6,
      language: "en",
    },
    {
      catKey: "other",
      subIdx: 0,
      status: "SUBMITTED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.4721,
      lng: 73.864,
      area: "Bibwewadi Ward Office Road, Bibwewadi",
      description:
        "Faded bilingual street nameplates and ward directional signage covered by overgrown creepers.",
      reportCount: 1,
      createdHoursAgo: 3,
      respDeadlineHoursOffset: 9,
      resDeadlineHoursOffset: 69,
      language: "en",
    },
    {
      catKey: "water",
      subIdx: 1,
      status: "CLOSED",
      priority: "HIGH",
      isOverdue: false,
      lat: 18.5482,
      lng: 73.9033,
      area: "Central Avenue, Kalyani Nagar",
      description:
        "Feeder water valve chamber leaking continuously near Kalyani Nagar Jogger's Park entrance.",
      reportCount: 3,
      createdHoursAgo: 48,
      respDeadlineHoursOffset: -44,
      resDeadlineHoursOffset: -24,
      language: "en",
    },
    {
      catKey: "roads",
      subIdx: 0,
      status: "ASSIGNED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.4865,
      lng: 73.7968,
      area: "Warje Malwadi Flyover Service Road, Warje",
      description:
        "Multiple trenches left unpaved after optical fibre cable laying near Warje water tank.",
      reportCount: 2,
      createdHoursAgo: 16,
      respDeadlineHoursOffset: -4,
      resDeadlineHoursOffset: 56,
      language: "en",
    },
    {
      catKey: "waste",
      subIdx: 1,
      status: "IN_PROGRESS",
      priority: "HIGH",
      isOverdue: true,
      lat: 18.4946,
      lng: 73.9012,
      area: "Fatima Nagar Junction, Wanowrie",
      description:
        "Secondary garbage transfer point not cleared for 30 hours causing severe stench near school zone.",
      reportCount: 3,
      createdHoursAgo: 34,
      respDeadlineHoursOffset: -28,
      resDeadlineHoursOffset: -10,
      language: "en",
    },
    {
      catKey: "roads",
      subIdx: 1,
      status: "SUBMITTED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.491,
      lng: 73.8215,
      area: "Cummins College Road, Karve Nagar",
      description:
        "Three high-mast floodlights at Karve Nagar chowk not turning on automatically at dusk.",
      reportCount: 1,
      createdHoursAgo: 6,
      respDeadlineHoursOffset: 6,
      resDeadlineHoursOffset: 42,
      language: "mr",
    },
    {
      catKey: "water",
      subIdx: 2,
      status: "VERIFIED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5082,
      lng: 73.8314,
      area: "Nal Stop Chowk, Erandwane",
      description:
        "Silted stormwater and sewage inspection chamber overflowing near Nal Stop metro station.",
      reportCount: 2,
      createdHoursAgo: 11,
      respDeadlineHoursOffset: -5,
      resDeadlineHoursOffset: 25,
      language: "en",
    },
    {
      catKey: "safety",
      subIdx: 3,
      status: "ASSIGNED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.534,
      lng: 73.8352,
      area: "Fergusson College Back Gate, Model Colony",
      description:
        "Unauthorized double-row commercial parking blocking fire tender access into Model Colony Lane 2.",
      reportCount: 2,
      createdHoursAgo: 15,
      respDeadlineHoursOffset: -3,
      resDeadlineHoursOffset: 57,
      language: "en",
    },
    {
      catKey: "other",
      subIdx: 0,
      status: "RESOLVED_AWAITING_VERIFICATION",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.4967,
      lng: 73.8511,
      area: "Parvati Paytha Staircase Entrance, Parvati",
      description:
        "Damaged public drinking water kiosk and broken resting bench near Parvati heritage steps.",
      reportCount: 1,
      createdHoursAgo: 44,
      respDeadlineHoursOffset: -32,
      resDeadlineHoursOffset: 28,
      language: "mr",
    },
    {
      catKey: "waste",
      subIdx: 0,
      status: "CLOSED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.4663,
      lng: 73.8538,
      area: "Mohan Nagar, Dhankawadi",
      description:
        "Wet and dry waste segregation vehicle timing irregular in Mohan Nagar Society lane.",
      reportCount: 1,
      createdHoursAgo: 52,
      respDeadlineHoursOffset: -46,
      resDeadlineHoursOffset: -28,
      language: "en",
    },
    {
      catKey: "roads",
      subIdx: 2,
      status: "IN_PROGRESS",
      priority: "CRITICAL",
      isOverdue: true,
      lat: 18.5987,
      lng: 73.7621,
      area: "Bhumkar Chowk Service Road, Wakad",
      description:
        "Broken heavy-duty cast iron drainage grating leaving a 3-foot gap on busy IT commuter corridor.",
      reportCount: 5,
      createdHoursAgo: 62,
      respDeadlineHoursOffset: -58,
      resDeadlineHoursOffset: -38,
      language: "en",
    },
    {
      catKey: "water",
      subIdx: 0,
      status: "ASSIGNED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5924,
      lng: 73.7945,
      area: "Kokane Chowk, Pimple Saudagar",
      description:
        "Low pressure and turbid water reported during morning supply slot in Rahatani-Pimple Saudagar.",
      reportCount: 1,
      createdHoursAgo: 8,
      respDeadlineHoursOffset: -2,
      resDeadlineHoursOffset: 16,
      language: "en",
    },
    {
      catKey: "safety",
      subIdx: 2,
      status: "SUBMITTED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5236,
      lng: 73.8789,
      area: "Tadiwala Road Junction, Sangamvadi",
      description:
        "Temporary tin sheet encroachment obstructing pedestrian ramp outside railway parcel office.",
      reportCount: 1,
      createdHoursAgo: 7,
      respDeadlineHoursOffset: 17,
      resDeadlineHoursOffset: 113,
      language: "hi",
    },
    {
      catKey: "other",
      subIdx: 0,
      status: "VERIFIED",
      priority: "NORMAL",
      isOverdue: false,
      lat: 18.5196,
      lng: 73.8553,
      area: "Shaniwar Wada North Gate Plaza, Kasba Peth",
      description:
        "Non-working heritage information kiosk display and damaged bollard chain near pedestrian plaza.",
      reportCount: 2,
      createdHoursAgo: 19,
      respDeadlineHoursOffset: -7,
      resDeadlineHoursOffset: 53,
      language: "mr",
    },
  ];

  let reportCounter = 1001;

  for (let i = 0; i < demoIssuesData.length; i++) {
    const item = demoIssuesData[i];
    const catInfo = categoriesByKey[item.catKey];
    const subInfo = catInfo.subcategories[item.subIdx] ?? catInfo.subcategories[0];
    const officer = officersByKey[item.catKey];

    const createdAt = hoursAgo(item.createdHoursAgo);
    const responseDeadline = hoursFromNow(item.respDeadlineHoursOffset);
    const resolutionDeadline = hoursFromNow(item.resDeadlineHoursOffset);

    const needsOfficer = [
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED_AWAITING_VERIFICATION",
      "CLOSED",
      "REOPENED",
    ].includes(item.status);

    const publicRef = `PMC-2026-${String(i + 1001).padStart(4, "0")}`;

    const createdIssue = await prisma.issue.create({
      data: {
        publicRef,
        categoryId: catInfo.id,
        subcategoryId: subInfo.id,
        status: item.status,
        priority: item.priority,
        isOverdue: item.isOverdue,
        latitude: item.lat,
        longitude: item.lng,
        publicLocationLabel: item.area,
        responseDeadline,
        resolutionDeadline,
        originalResolutionDeadline: resolutionDeadline,
        reportCount: item.reportCount,
        assignedOfficerId: needsOfficer ? officer.id : null,
        createdAt,
        resolvedAt:
          item.status === "RESOLVED_AWAITING_VERIFICATION" ||
          item.status === "CLOSED"
            ? hoursAgo(4)
            : null,
        closedAt:
          item.status === "CLOSED" || item.status === "REJECTED"
            ? hoursAgo(2)
            : null,
        isDemo: true,
      },
    });

    // Create linked Citizen Reports (1 to reportCount)
    for (let r = 0; r < item.reportCount; r++) {
      const citizen = citizens[(i + r) % citizens.length];
      const refId = `RPT-2026-${reportCounter++}`;
      const rSubmittedAt = new Date(createdAt.getTime() + r * 1800 * 1000);

      const report = await prisma.report.create({
        data: {
          referenceId: refId,
          issueId: createdIssue.id,
          citizenId: citizen.id,
          description:
            r === 0
              ? item.description
              : `Follow-up citizen report (#${r + 1}) confirming same issue at ${item.area}. Needs urgent PMC attention.`,
          language: item.language ?? "en",
          latitude: item.lat + r * 0.00015,
          longitude: item.lng + r * 0.00015,
          submittedAt: rSubmittedAt,
          idempotencyKey: `demo-idem-${publicRef}-${r + 1}`,
        },
      });

      // Attach Evidence photo metadata on primary report
      if (r === 0) {
        await prisma.evidence.create({
          data: {
            reportId: report.id,
            filePath: `/demo-evidence/${publicRef.toLowerCase()}.jpg`,
            mimeType: "image/jpeg",
            sizeBytes: 348160 + i * 1024,
            caption: `Field photo captured at ${item.area} (EXIF unverified)`,
            exifLatitude: item.lat + 0.00005,
            exifLongitude: item.lng - 0.00004,
            exifCapturedAt: new Date(rSubmittedAt.getTime() - 600 * 1000),
            uploadedAt: rSubmittedAt,
          },
        });
      }
    }

    // Create AuditEvent for issue creation
    await prisma.auditEvent.create({
      data: {
        timestamp: createdAt,
        actorType: "USER",
        actorId: citizens[i % citizens.length].id,
        actorLabel: `citizen:${citizens[i % citizens.length].email}`,
        action: "ISSUE_CREATED_FROM_REPORT",
        entityType: "Issue",
        entityId: createdIssue.id,
        oldValue: undefined,
        newValue: {
          publicRef,
          status: "SUBMITTED",
          priority: item.priority,
          area: item.area,
        },
        reason: `Initial grievance report submitted for ${item.area}`,
        ruleApplied: DEMO_RULE_LABEL,
        outcome: "ACCEPTED",
      },
    });

    // If overdue, create EscalationEvent + system:deadline-monitor AuditEvent
    if (item.isOverdue) {
      const targetSupervisor = i % 2 === 0 ? supervisorWest : supervisorEast;
      const level = item.priority === "CRITICAL" ? 2 : 1;

      await prisma.escalationEvent.create({
        data: {
          issueId: createdIssue.id,
          level,
          reason: `SLA resolution deadline breached at ${item.area}. Auto-escalated to ${item.priority} (Level ${level}).`,
          notifiedUserId: targetSupervisor.id,
          createdAt: hoursAgo(2),
        },
      });

      await prisma.auditEvent.create({
        data: {
          timestamp: hoursAgo(2),
          actorType: "SYSTEM",
          actorId: null,
          actorLabel: "system:deadline-monitor",
          action: "AUTO_OVERDUE_PRIORITY_ESCALATION",
          entityType: "Issue",
          entityId: createdIssue.id,
          oldValue: { isOverdue: false, priority: "NORMAL" },
          newValue: { isOverdue: true, priority: item.priority, level },
          reason: `Automated deadline monitor escalated overdue issue ${publicRef}`,
          ruleApplied: `PriorityRule(OVERDUE_${item.priority}) [${DEMO_RULE_LABEL}]`,
          outcome: "ACCEPTED",
        },
      });

      await prisma.notification.create({
        data: {
          userId: targetSupervisor.id,
          issueId: createdIssue.id,
          message: `[OVERDUE L${level}] ${publicRef} (${item.area}) breached SLA deadline and was escalated to ${item.priority}.`,
        },
      });
    }
  }

  // Create sample DeadlineChange record on first issue
  const firstIssue = await prisma.issue.findFirst({
    where: { publicRef: "PMC-2026-1001" },
  });
  if (firstIssue) {
    await prisma.deadlineChange.create({
      data: {
        issueId: firstIssue.id,
        oldDeadline: hoursAgo(48),
        newDeadline: firstIssue.resolutionDeadline,
        actorId: supervisorWest.id,
        reason:
          "Heavy monsoon waterlogging required hot-mix plant mobilization from Mundhwa depot.",
        createdAt: hoursAgo(36),
      },
    });
  }

  // Create sample REFUSED AuditEvent entries demonstrating security & workflow enforcement
  await prisma.auditEvent.createMany({
    data: [
      {
        timestamp: hoursAgo(5),
        actorType: "USER",
        actorId: citizens[0].id,
        actorLabel: `citizen:${citizens[0].email}`,
        action: "WORKFLOW_TRANSITION_SUBMITTED_TO_VERIFIED",
        entityType: "Issue",
        entityId: firstIssue?.id ?? "demo",
        oldValue: { status: "SUBMITTED", actorRole: "CITIZEN" },
        newValue: { status: "VERIFIED" },
        reason:
          "Citizens may NOT perform any transition other than confirming closure or requesting reopening from RESOLVED_AWAITING_VERIFICATION.",
        ruleApplied: "WorkflowEngine:CitizenTransitionRestriction",
        outcome: "REFUSED",
      },
      {
        timestamp: hoursAgo(3),
        actorType: "USER",
        actorId: officerWaste.id,
        actorLabel: `officer:${officerWaste.email}`,
        action: "WORKFLOW_TRANSITION_ASSIGNED_TO_IN_PROGRESS",
        entityType: "Issue",
        entityId: firstIssue?.id ?? "demo",
        oldValue: {
          status: "ASSIGNED",
          officerDepartment: "Solid Waste Management Department (PMC)",
        },
        newValue: {
          status: "IN_PROGRESS",
          issueCategory: "Roads & Infrastructure",
        },
        reason:
          "Cross-department transition refused: Waste Officer cannot transition a Roads & Infrastructure issue.",
        ruleApplied: "WorkflowTransition(ASSIGNED->IN_PROGRESS:sameDepartmentOnly)",
        outcome: "REFUSED",
      },
      {
        timestamp: hoursAgo(1),
        actorType: "USER",
        actorId: supervisorWest.id,
        actorLabel: `supervisor:${supervisorWest.email}`,
        action: "WORKFLOW_TRANSITION_SUBMITTED_TO_REJECTED",
        entityType: "Issue",
        entityId: firstIssue?.id ?? "demo",
        oldValue: { status: "SUBMITTED" },
        newValue: { status: "REJECTED", reason: "" },
        reason:
          "Transition SUBMITTED -> REJECTED requires a descriptive reason (min 5 characters).",
        ruleApplied: "WorkflowTransition(SUBMITTED->REJECTED:requiresReason)",
        outcome: "REFUSED",
      },
    ],
  });

  console.log("✅ Seed complete!");
  console.log(`   - Admin: ${adminUser.email}`);
  console.log(
    `   - Supervisors: ${supervisorWest.email}, ${supervisorEast.email}`
  );
  console.log(
    `   - Officers: ${officerWaste.email}, ${officerRoads.email}, ${officerWater.email}, ${officerSafety.email}, ${officerOther.email}`
  );
  console.log(`   - Citizens: ${citizens.map((c) => c.email).join(", ")}`);
  console.log(`   - Demo Password (all accounts): ${DEMO_PASSWORD}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
