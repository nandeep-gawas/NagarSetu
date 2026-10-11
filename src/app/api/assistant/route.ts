import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit, rateLimitResponse } from "@/lib/rateLimit";

interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

interface CollectedFields {
  categoryName?: string;
  categoryId?: string;
  subcategoryName?: string;
  subcategoryId?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
  evidenceUrl?: string;
}

const CATEGORY_MAP: Record<
  string,
  { name: string; emoji: string; keywords: string[]; subcategories: string[] }
> = {
  roads: {
    name: "Roads & Infrastructure",
    emoji: "🕳️",
    keywords: [
      "road",
      "pothole",
      "potholes",
      "rasta",
      "khadda",
      "sadak",
      "tar",
      "asphalt",
      "street",
      "streetlight",
      "light",
      "manhole",
      "gutter cover",
      "footpath",
      "sidewalk",
      "divider",
      "speed breaker",
      "signal",
      "traffic light",
    ],
    subcategories: [
      "Potholes or damaged roads",
      "Broken or flickering streetlights",
      "Open or damaged manhole covers",
      "Damaged footpaths or sidewalks",
    ],
  },
  water: {
    name: "Water & Sewage",
    emoji: "💧",
    keywords: [
      "water",
      "pani",
      "paani",
      "leak",
      "leakage",
      "pipe",
      "burst",
      "pipeline",
      "dirty water",
      "muddy water",
      "contaminated",
      "sewage",
      "gutter",
      "drain",
      "drainage",
      "overflow",
      "tanker",
      "low pressure",
      "supply cut",
    ],
    subcategories: [
      "Contaminated or muddy water supply",
      "Major pipe leaks or bursts",
      "Overflowing sewage or blocked sewage lines",
      "Unscheduled water supply cuts",
    ],
  },
  waste: {
    name: "Waste Management & Sanitation",
    emoji: "🗑️",
    keywords: [
      "waste",
      "kachra",
      "garbage",
      "trash",
      "dustbin",
      "bin",
      "ghantagadi",
      "sweeper",
      "toilet",
      "public toilet",
      "dead animal",
      "carcass",
      "sanitation",
      "smell",
      "dump",
      "litter",
    ],
    subcategories: [
      "Missed garbage collection",
      "Overflowing public dustbins",
      "Dead animal removal",
      "Public toilet maintenance",
    ],
  },
  nuisance: {
    name: "Civic Nuisance & Public Safety",
    emoji: "⚠️",
    keywords: [
      "dog",
      "stray",
      "animal",
      "bark",
      "bite",
      "kutta",
      "tree",
      "branch",
      "fall",
      "cut",
      "illegal tree",
      "encroachment",
      "hawker",
      "unauthorized",
      "construction",
      "building",
      "parking",
      "abandoned vehicle",
      "scrap vehicle",
      "nuisance",
    ],
    subcategories: [
      "Stray animal menace",
      "Illegal tree cutting",
      "Unauthorized construction",
      "Illegal parking or abandoned vehicles",
    ],
  },
  other: {
    name: "Other Municipal Issues",
    emoji: "📍",
    keywords: ["other", "general", "administrative", "miscellaneous", "garden", "tax", "pmc"],
    subcategories: ["Free-text municipal issue"],
  },
};

/**
 * Rule-based fallback assistant engine for demo resilience
 */
function ruleBasedAssistant(
  message: string,
  history: AssistantMessage[],
  collected: CollectedFields,
  language: string
) {
  const text = message.toLowerCase().trim();

  // Check if user is asking to track an issue
  const refMatch = message.match(/PUN-[A-Z0-9-]+/i);
  if (refMatch) {
    const ref = refMatch[0].toUpperCase();
    return {
      reply:
        language === "mr"
          ? `मी तक्रार क्रमांक ${ref} बद्दल माहिती मिळवत आहे. कृपया अधिक तपशिलांसाठी थेट तक्रार ट्रॅकिंग टूल पहा.`
          : language === "hi"
          ? `मैं शिकायत संदर्भ ${ref} की जांच कर रहा हूँ। कृपया विस्तृत स्थिति के लिए ट्रैकिंग टूल का उपयोग करें।`
          : `Looking up municipal complaint ${ref}. You can track the live SLA countdown and timeline on the Track Complaint page.`,
      collectedFields: { ...collected },
      nextStep: "TRACK_QUERY",
      trackRef: ref,
    };
  }

  // Detect matching category from keywords
  let matchedKey: string | null = null;
  for (const [key, cat] of Object.entries(CATEGORY_MAP)) {
    if (cat.keywords.some((kw) => text.includes(kw))) {
      matchedKey = key;
      break;
    }
  }

  // If in review/confirmation phase
  if (text.includes("yes") || text.includes("confirm") || text.includes("submit") || text.includes("ho") || text.includes("haan")) {
    if (collected.categoryName && collected.description) {
      return {
        reply:
          language === "mr"
            ? "उत्कृष्ट! खालील तक्रार पुनरावलोकन कार्ड तपासा आणि तक्रार दाखल करण्यासाठी 'तक्रार दाखल करा' बटणावर क्लिक करा."
            : language === "hi"
            ? "उत्कृष्ट! कृपया नीचे दिए गए शिकायत समीक्षा कार्ड की जांच करें और दर्ज करने के लिए 'शिकायत दर्ज करें' पर क्लिक करें।"
            : "Great! Please review the complaint card below and click 'Confirm & Submit Complaint' to register it directly in the Pune municipal workflow engine.",
        collectedFields: { ...collected },
        nextStep: "REVIEW",
      };
    }
  }

  if (matchedKey) {
    const cat = CATEGORY_MAP[matchedKey];
    // Pick subcategory based on keywords or default to first
    let matchedSub = cat.subcategories[0];
    for (const sub of cat.subcategories) {
      const subWords = sub.toLowerCase().split(" ");
      if (subWords.some((w) => w.length > 3 && text.includes(w))) {
        matchedSub = sub;
        break;
      }
    }

    const replyEn = `I understand your issue. This falls under ${cat.emoji} **${cat.name}** (suggested subcategory: *${matchedSub}*).\n\nCould you please provide the specific street/area in Pune (e.g. FC Road, Kothrud, Baner) and attach a photo if available?`;
    const replyHi = `मैं आपकी समस्या समझ गया हूँ। यह ${cat.emoji} **${cat.name}** (*${matchedSub}*) के अंतर्गत आती है।\n\nकृपया पुणे में सटीक स्थान (जैसे एफसी रोड, कोथरुड, बाणेर) बताएं और यदि संभव हो तो फोटो संलग्न करें।`;
    const replyMr = `मला आपली समस्या समजली आहे. ही तक्रार ${cat.emoji} **${cat.name}** (*${matchedSub}*) अंतर्गत येते.\n\nकृपया पुण्यात अचूक ठिकाण (उदा. एफसी रोड, कोथरूड, बाणेर) सांगा आणि शक्य असल्यास फोटो जोडा.`;

    return {
      reply: language === "mr" ? replyMr : language === "hi" ? replyHi : replyEn,
      suggestedCategory: cat.name,
      suggestedSubcategory: matchedSub,
      collectedFields: {
        ...collected,
        categoryName: cat.name,
        subcategoryName: matchedSub,
        description: collected.description ? `${collected.description} — ${message}` : message,
      },
      nextStep: "FOLLOW_UP",
    };
  }

  // Generic guidance
  const defaultEn = `Hello! I am your NagarSetu Civic Assistant. I can help you report civic grievances to Pune Municipal Corporation across 5 categories:\n• 🗑️ Waste Management & Sanitation\n• 🕳️ Roads & Infrastructure\n• 💧 Water & Sewage\n• ⚠️ Civic Nuisance & Public Safety\n• 📍 Other Municipal Issues\n\nPlease describe what problem you are facing in Pune!`;
  const defaultHi = `नमस्ते! मैं आपका नगरसेतु नागरिक सहायक हूँ। मैं पुणे महानगरपालिका में इन श्रेणियों में शिकायत दर्ज करने में आपकी सहायता कर सकता हूँ:\n• 🗑️ कचरा व स्वच्छता\n• 🕳️ रस्ते व पायाभूत सुविधा\n• 💧 पाणी व सांडपाणी\n• ⚠️ सार्वजनिक सुरक्षितता\n• 📍 इतर महानगरपालिका समस्या\n\nकृपया बताएं कि आप पुणे में किस समस्या का सामना कर रहे हैं।`;
  const defaultMr = `नमस्कार! मी आपला नगरसेतू नागरिक सहाय्यक आहे. मी पुणे महानगरपालिकेत नागरी तक्रार नोंदवण्यासाठी मदत करू शकतो:\n• 🗑️ घनकचरा व्यवस्थापन\n• 🕳️ रस्ते व पायाभूत सुविधा\n• 💧 पाणीपुरवठा व मलनिस्सारण\n• ⚠️ सार्वजनिक सुरक्षितता\n• 📍 इतर नागरी समस्या\n\nकृपया पुण्यात आपल्याला कोणत्या समस्येचा सामना करावा लागत आहे ते सांगा!`;

  return {
    reply: language === "mr" ? defaultMr : language === "hi" ? defaultHi : defaultEn,
    collectedFields: { ...collected },
    nextStep: "GREETING",
  };
}

export async function POST(req: NextRequest) {
  // Rate limit: 40 requests per minute per IP
  const rl = checkRateLimit(req, "assistant", 40, 60 * 1000);
  if (!rl.allowed) {
    return rateLimitResponse(rl.resetMs);
  }

  try {
    const body = await req.json();
    const {
      message = "",
      history = [],
      collectedFields = {},
      currentStep = "GREETING",
      language = "en",
    } = body;

    const apiKey = process.env.GEMINI_API_KEY;

    // Check if user is asking to track an issue
    const refMatch = String(message).match(/PUN-[A-Z0-9-]+/i);
    if (refMatch) {
      const ref = refMatch[0].toUpperCase();
      const issue = await prisma.issue.findFirst({
        where: {
          OR: [{ publicRef: ref }, { reports: { some: { referenceId: ref } } }],
        },
        include: {
          category: true,
          subcategory: true,
          reports: true,
        },
      });

      if (issue) {
        const isResolved =
          issue.status === "RESOLVED_AWAITING_VERIFICATION" || issue.status === "CLOSED";
        const reply =
          language === "mr"
            ? `तक्रार सापडली: **${issue.publicRef}**\n• स्थिती: **${issue.status.replace(/_/g, " ")}**\n• विभाग: ${issue.category.name}\n• स्थान: ${issue.publicLocationLabel}\n${
                isResolved
                  ? "ही तक्रार सोडवण्यात आली आहे. आपण समाधानी नसल्यास ७ दिवसांत पुन्हा उघडू शकता."
                  : `मुदत: ${issue.resolutionDeadline ? new Date(issue.resolutionDeadline).toLocaleString("en-IN") : "SLA लागू"}`
              }`
            : language === "hi"
            ? `शिकायत प्राप्त: **${issue.publicRef}**\n• स्थिति: **${issue.status.replace(/_/g, " ")}**\n• विभाग: ${issue.category.name}\n• स्थान: ${issue.publicLocationLabel}\n${
                isResolved
                  ? "यह शिकायत हल हो चुकी है। यदि आप असंतुष्ट हैं, तो 7 दिनों के भीतर इसे पुनः खोल सकते हैं।"
                  : `समय सीमा: ${issue.resolutionDeadline ? new Date(issue.resolutionDeadline).toLocaleString("en-IN") : "SLA लागू"}`
              }`
            : `Found Complaint **${issue.publicRef}**:\n• Status: **${issue.status.replace(/_/g, " ")}**\n• Department: ${issue.category.name}\n• Location: ${issue.publicLocationLabel}\n${
                isResolved
                  ? "This complaint is resolved. Citizens may reopen within 7 days if unsatisfied."
                  : `Deadline: ${issue.resolutionDeadline ? new Date(issue.resolutionDeadline).toLocaleString("en-IN") : "Active SLA"}`
              }`;

        return NextResponse.json({
          ok: true,
          reply,
          suggestedCategory: issue.category.name,
          suggestedSubcategory: issue.subcategory?.name,
          collectedFields: { ...collectedFields },
          nextStep: "TRACK_QUERY",
          trackIssue: {
            id: issue.id,
            publicRef: issue.publicRef,
            status: issue.status,
            priority: issue.priority,
            location: issue.publicLocationLabel,
          },
          isDemoMode: !apiKey,
        });
      }
    }

    // If Gemini API Key is available, attempt call to Google Gemini API
    if (apiKey && apiKey.trim().length > 5) {
      try {
        const prompt = `You are NagarSetu AI Civic Assistant for Pune Municipal Corporation (PMC), Pune, Maharashtra, India.
Your task is to guide the citizen through reporting a civic complaint.
Municipal categories:
1. "Waste Management & Sanitation" (Missed garbage collection, Overflowing public dustbins, Dead animal removal, Public toilet maintenance)
2. "Roads & Infrastructure" (Potholes or damaged roads, Broken or flickering streetlights, Open or damaged manhole covers, Damaged footpaths or sidewalks)
3. "Water & Sewage" (Contaminated or muddy water supply, Major pipe leaks or bursts, Overflowing sewage or blocked sewage lines, Unscheduled water supply cuts)
4. "Civic Nuisance & Public Safety" (Stray animal menace, Illegal tree cutting, Unauthorized construction, Illegal parking or abandoned vehicles)
5. "Other Municipal Issues" (Free-text municipal issue)

Current collected fields: ${JSON.stringify(collectedFields)}
Citizen's message: "${message}"
Citizen's language: ${language} (Respond in ${language === "mr" ? "Marathi" : language === "hi" ? "Hindi" : "English"})

Instructions:
1. NEVER invent facts, official phone numbers, or pretend you resolved the issue.
2. Recommend the best category and subcategory from the 5 official categories above.
3. Keep response concise (under 3 sentences), polite, and civic-focused.
4. Output valid JSON in the exact format:
{
  "reply": "your response to the citizen",
  "suggestedCategory": "category name or null",
  "suggestedSubcategory": "subcategory name or null",
  "extractedLocation": "location mentioned or null",
  "nextStep": "FOLLOW_UP or REVIEW or GREETING"
}`;

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2,
              },
            }),
            signal: AbortSignal.timeout(5000), // 5s timeout
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsed = JSON.parse(rawText);
            const updatedCollected: CollectedFields = {
              ...collectedFields,
              categoryName: parsed.suggestedCategory || collectedFields.categoryName,
              subcategoryName: parsed.suggestedSubcategory || collectedFields.subcategoryName,
              description: collectedFields.description
                ? `${collectedFields.description} — ${message}`
                : message,
              locationLabel: parsed.extractedLocation || collectedFields.locationLabel,
            };

            return NextResponse.json({
              ok: true,
              reply: parsed.reply,
              suggestedCategory: parsed.suggestedCategory,
              suggestedSubcategory: parsed.suggestedSubcategory,
              collectedFields: updatedCollected,
              nextStep: parsed.nextStep || "FOLLOW_UP",
              isDemoMode: false,
            });
          }
        }
      } catch (geminiErr) {
        console.warn("Gemini API call failed, falling back to rule-based engine:", geminiErr);
      }
    }

    // Rule-based fallback engine (Guaranteed 100% demo resilience)
    const fallback = ruleBasedAssistant(message, history, collectedFields, language);
    return NextResponse.json({
      ok: true,
      ...fallback,
      isDemoMode: true,
    });
  } catch (err: any) {
    console.error("Assistant API error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Unable to process assistant request. Please try typing your complaint.",
      },
      { status: 500 }
    );
  }
}
