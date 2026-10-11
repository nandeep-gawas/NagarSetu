"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  suggestedCategory?: string;
  suggestedSubcategory?: string;
  nextStep?: string;
  trackingRef?: string;
  reviewCard?: boolean;
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

const PUNE_PRESET_LOCATIONS = [
  { name: "Shivajinagar, Pune", lat: 18.5308, lng: 73.8475 },
  { name: "Kothrud, Pune", lat: 18.5074, lng: 73.8077 },
  { name: "Hadapsar, Pune", lat: 18.5089, lng: 73.926 },
  { name: "Viman Nagar, Pune", lat: 18.5679, lng: 73.9143 },
  { name: "Hinjawadi, Pune", lat: 18.5913, lng: 73.7389 },
  { name: "Swargate / Parvati, Pune", lat: 18.5018, lng: 73.8587 },
];

export function FloatingHelpAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial",
      role: "assistant",
      content:
        "Namaskar! I am your NagarSetu Civic Assistant for Pune Municipal Corporation grievances. You can describe your issue in English, Hindi, or Marathi, or use voice input to speak directly. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [language, setLanguage] = useState<"en-IN" | "hi-IN" | "mr-IN">("en-IN");
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Collected complaint data state
  const [collected, setCollected] = useState<CollectedFields>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [uploadedEvidence, setUploadedEvidence] = useState<{
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    caption?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<{
    success: boolean;
    referenceId?: string;
    isDuplicate?: boolean;
    error?: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Fetch real categories from database
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          if (data.categories) {
            setCategories(data.categories);
          }
        }
      } catch (err) {
        console.warn("Could not load categories in assistant:", err);
      }
    }
    fetchCategories();
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, isLoading]);

  // Speech Recognition Setup (Web Speech API)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = language;

        recognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
          setIsListening(false);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
          setIsListening(false);
          if (event.error === "not-allowed") {
            setSpeechError("Microphone permission denied. Please allow microphone access or type your text.");
          } else {
            setSpeechError(`Voice input error (${event.error}). Please type.`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, [language]);

  const toggleListening = () => {
    setSpeechError(null);
    if (!recognitionRef.current) {
      setSpeechError("Speech recognition is not supported in this browser. Please type your message.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = language;
        recognitionRef.current.start();
      } catch (err) {
        console.warn("Failed to start speech recognition:", err);
        setIsListening(false);
      }
    }
  };

  const sendMessage = async (textToSend?: string) => {
    const userText = (textToSend || input).trim();
    if (!userText || isLoading) return;

    setInput("");
    const newMsg: Message = {
      id: Math.random().toString(),
      role: "user",
      content: userText,
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          history,
          collectedFields: collected,
          language: language.slice(0, 2),
        }),
      });

      if (!res.ok) {
        throw new Error("Assistant service returned an error.");
      }

      const data = await res.json();
      setIsDemoMode(Boolean(data.isDemoMode));

      if (data.collectedFields) {
        setCollected((prev) => ({
          ...prev,
          ...data.collectedFields,
        }));
      }

      const assistantMsg: Message = {
        id: Math.random().toString(),
        role: "assistant",
        content: data.reply,
        suggestedCategory: data.suggestedCategory,
        suggestedSubcategory: data.suggestedSubcategory,
        nextStep: data.nextStep,
        trackingRef: data.trackingRef,
        reviewCard: data.nextStep === "REVIEW",
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: Math.random().toString(),
          role: "assistant",
          content:
            "I encountered a temporary connection issue. You can still file your grievance directly via the 'Register a Complaint' menu, or try asking again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick suggestion chips handler
  const handleChipClick = (chipText: string) => {
    sendMessage(chipText);
  };

  // Resolve category selection
  const handleSelectCategory = (catName: string) => {
    const matched = categories.find(
      (c) => c.name.toLowerCase() === catName.toLowerCase()
    );
    setCollected((prev) => ({
      ...prev,
      categoryName: catName,
      categoryId: matched ? matched.id : prev.categoryId,
    }));
    sendMessage(`I confirm category: ${catName}`);
  };

  // Resolve subcategory selection
  const handleSelectSubcategory = (subName: string) => {
    let subId = "";
    categories.forEach((c) => {
      const s = c.subcategories?.find(
        (sub: any) => sub.name.toLowerCase() === subName.toLowerCase()
      );
      if (s) subId = s.id;
    });

    setCollected((prev) => ({
      ...prev,
      subcategoryName: subName,
      subcategoryId: subId || prev.subcategoryId,
    }));
    sendMessage(`I confirm subcategory: ${subName}`);
  };

  // Location Preset Handler
  const handleSelectLocation = (loc: { name: string; lat: number; lng: number }) => {
    setCollected((prev) => ({
      ...prev,
      locationLabel: loc.name,
      latitude: loc.lat,
      longitude: loc.lng,
    }));
    sendMessage(`My location is ${loc.name}`);
  };

  // Browser Geolocation
  const handleGetBrowserLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setCollected((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          locationLabel: `GPS (${lat}, ${lng})`,
        }));
        sendMessage(`My current GPS coordinates are ${lat}, ${lng}`);
      },
      (err) => {
        alert(`Location access denied or unavailable: ${err.message}`);
      }
    );
  };

  // Photo / Evidence Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setUploadedEvidence({
          filePath: data.filePath,
          mimeType: data.mimeType,
          sizeBytes: data.sizeBytes,
          caption: "Uploaded via AI Help Assistant",
        });
        if (data.exif?.latitude && data.exif?.longitude) {
          setCollected((prev) => ({
            ...prev,
            latitude: data.exif.latitude,
            longitude: data.exif.longitude,
            locationLabel: `Photo EXIF GPS (${data.exif.latitude.toFixed(4)}, ${data.exif.longitude.toFixed(4)})`,
          }));
        }
        sendMessage("I have uploaded a photo as evidence.");
      } else {
        alert(data.error || "Upload failed. Please choose JPG/PNG under 10 MB.");
      }
    } catch (err) {
      alert("Evidence upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Final Submission via standard POST /api/reports route
  const handleConfirmSubmit = async () => {
    setIsSubmitting(true);
    setSubmissionResult(null);

    try {
      // Find database category ID
      let finalCatId = collected.categoryId;
      if (!finalCatId && collected.categoryName) {
        const cat = categories.find(
          (c) =>
            c.name.toLowerCase() === collected.categoryName?.toLowerCase()
        );
        if (cat) finalCatId = cat.id;
      }
      if (!finalCatId && categories.length > 0) {
        finalCatId = categories[0].id;
      }

      // Default Pune coordinates if not chosen
      const finalLat = collected.latitude || 18.5204;
      const finalLng = collected.longitude || 73.8567;
      const finalDesc = collected.description || "Civic grievance reported via NagarSetu Assistant";

      const payload = {
        categoryId: finalCatId,
        subcategoryId: collected.subcategoryId || undefined,
        description: finalDesc,
        latitude: finalLat,
        longitude: finalLng,
        locationLabel: collected.locationLabel || "Pune City Area",
        idempotencyKey: `asst-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        evidences: uploadedEvidence ? [uploadedEvidence] : [],
      };

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.status === 401) {
        setSubmissionResult({
          success: false,
          error:
            "Please log in or register an account to submit your complaint. Duplicate detection and municipal tracking require an authenticated citizen account.",
        });
        return;
      }

      if (res.ok && data.ok) {
        const refId = data.issue?.publicRef || data.report?.id || "PUN-REGISTERED";
        setSubmissionResult({
          success: true,
          referenceId: refId,
          isDuplicate: data.status === "LINKED_AS_DUPLICATE",
        });

        const confirmMsg: Message = {
          id: Math.random().toString(),
          role: "assistant",
          content: data.status === "LINKED_AS_DUPLICATE"
            ? `Your complaint has been successfully registered and linked as a duplicate to existing Issue ${refId}. Because multiple citizens reported this location, priority was automatically raised!`
            : `Success! Your municipal complaint has been registered with reference ID ${refId}. You can track its live status anytime on the Track page or right here in chat.`,
        };
        setMessages((prev) => [...prev, confirmMsg]);
      } else {
        setSubmissionResult({
          success: false,
          error: data.error || "Unable to submit grievance. Please verify all fields.",
        });
      }
    } catch (err: any) {
      setSubmissionResult({
        success: false,
        error: "Network error submitting complaint. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 font-sans">
      {/* Expanded Chat Drawer */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="NagarSetu Civic Assistant"
          className="mb-3 w-80 sm:w-[420px] h-[580px] bg-white border-2 border-[#0f2942] rounded-2xl shadow-2xl flex flex-col text-xs animate-in fade-in slide-in-from-bottom-3 overflow-hidden"
        >
          {/* Header */}
          <div className="p-3 bg-[#0f2942] text-white flex items-center justify-between border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="h-7 w-7 rounded-full bg-amber-500 text-slate-950 font-black flex items-center justify-center text-xs shadow">
                NS
              </span>
              <div>
                <strong className="text-white block text-xs leading-none">
                  NagarSetu Civic Assistant
                </strong>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      isDemoMode ? "bg-amber-400" : "bg-emerald-400"
                    }`}
                  />
                  <span className="text-[10px] text-slate-300">
                    {isDemoMode ? "Demo Mode (Offline Mock)" : "Gemini AI Active"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Language selection */}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                aria-label="Select speech language"
                className="bg-slate-800 text-slate-200 text-[10px] rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none"
              >
                <option value="en-IN">EN (English)</option>
                <option value="hi-IN">HI (हिंदी)</option>
                <option value="mr-IN">MR (मराठी)</option>
              </select>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Assistant"
                className="h-6 w-6 rounded-full hover:bg-slate-700 text-slate-300 flex items-center justify-center text-sm font-bold"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Governance Notice Banner */}
          <div className="bg-amber-50 border-b border-amber-200 px-3 py-1.5 text-[10px] text-amber-900 flex items-start gap-1.5 leading-tight">
            <span>🛡️</span>
            <div>
              <strong>Governance Guardrail:</strong> AI Assistant cannot alter complaint status, assign officers, or change SLA deadlines. Complaints are officially verified by Pune Municipal authorities.
            </div>
          </div>

          {/* Conversation Messages */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50 text-slate-800">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-2.5 text-xs leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-[#0f2942] text-white rounded-br-none"
                      : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {/* Category confirmation buttons */}
                  {msg.suggestedCategory && !collected.categoryId && (
                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-600">
                        Suggested Category:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectCategory(msg.suggestedCategory!)}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[11px]"
                        >
                          ✓ Confirm {msg.suggestedCategory}
                        </button>
                        <button
                          type="button"
                          onClick={() => sendMessage("Let me choose a different category")}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px]"
                        >
                          Change Category
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Subcategory selection buttons */}
                  {msg.suggestedSubcategory && !collected.subcategoryId && (
                    <div className="mt-2 pt-2 border-t border-slate-200 space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-600">
                        Suggested Subcategory:
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSelectSubcategory(msg.suggestedSubcategory!)}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded text-[11px]"
                      >
                        ✓ Confirm: {msg.suggestedSubcategory}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* In-chat Location Selection Step */}
            {collected.categoryName && !collected.latitude && (
              <div className="bg-white border border-blue-200 rounded-xl p-3 shadow-sm space-y-2">
                <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Select Pune Location:</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PUNE_PRESET_LOCATIONS.map((loc) => (
                    <button
                      key={loc.name}
                      type="button"
                      onClick={() => handleSelectLocation(loc)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-medium border border-slate-300"
                    >
                      {loc.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleGetBrowserLocation}
                    className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-300"
                  >
                    📡 Use Device GPS
                  </button>
                </div>
              </div>
            )}

            {/* In-chat Evidence Upload Step */}
            {collected.categoryName && !uploadedEvidence && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm space-y-2">
                <div className="font-semibold text-slate-900 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>📷</span>
                    <span>Attach Photo/Video Evidence (Optional):</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => sendMessage("I will skip uploading a photo for now.")}
                    className="text-[10px] text-slate-500 hover:underline"
                  >
                    Skip
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 rounded font-semibold text-[11px] flex items-center gap-1">
                    <span>{isUploading ? "Uploading..." : "Upload / Camera"}</span>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                      disabled={isUploading}
                    />
                  </label>
                  <span className="text-[10px] text-slate-500">
                    JPG/PNG &lt; 10 MB or MP4 &lt; 30 MB
                  </span>
                </div>
              </div>
            )}

            {/* Uploaded Evidence Thumbnail */}
            {uploadedEvidence && (
              <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-2 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <span>📸</span>
                  <span className="font-semibold">Evidence attached</span>
                  <span className="text-[10px] text-emerald-700">
                    ({Math.round(uploadedEvidence.sizeBytes / 1024)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedEvidence(null)}
                  className="text-rose-600 hover:underline text-[10px] font-bold"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Review & Confirmation Card */}
            {collected.categoryName && collected.latitude && (
              <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 shadow space-y-2">
                <div className="flex items-center justify-between border-b border-amber-200 pb-1">
                  <strong className="text-amber-950 text-xs flex items-center gap-1">
                    <span>📋</span>
                    <span>Review Grievance Summary</span>
                  </strong>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
                    Ready to File
                  </span>
                </div>

                <div className="space-y-1 text-[11px] text-slate-800">
                  <div>
                    <span className="font-semibold text-slate-600">Category: </span>
                    <span>{collected.categoryName}</span>
                  </div>
                  {collected.subcategoryName && (
                    <div>
                      <span className="font-semibold text-slate-600">Subcategory: </span>
                      <span>{collected.subcategoryName}</span>
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-slate-600">Location: </span>
                    <span>{collected.locationLabel || "Pune Area"}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-600">Description: </span>
                    <span className="italic">
                      "{collected.description || "Civic issue reported"}"
                    </span>
                  </div>
                </div>

                {submissionResult && !submissionResult.success && (
                  <div className="p-2 bg-rose-100 border border-rose-300 rounded text-rose-800 text-[11px] space-y-1">
                    <div>{submissionResult.error}</div>
                    {submissionResult.error?.includes("log in") && (
                      <Link
                        href="/login?redirect=/report"
                        className="inline-block px-2 py-0.5 bg-rose-700 text-white rounded font-bold hover:bg-rose-800 text-[10px]"
                      >
                        Log In to Account →
                      </Link>
                    )}
                  </div>
                )}

                {submissionResult && submissionResult.success && (
                  <div className="p-2 bg-emerald-100 border border-emerald-300 rounded text-emerald-900 text-[11px] space-y-1">
                    <div className="font-bold">
                      Complaint Registered: {submissionResult.referenceId}
                    </div>
                    {submissionResult.isDuplicate && (
                      <div className="text-[10px] text-emerald-800">
                        Consolidated with existing report. Municipal SLA priority elevated.
                      </div>
                    )}
                    <Link
                      href={`/track?ref=${submissionResult.referenceId}`}
                      className="inline-block px-2 py-0.5 bg-emerald-700 text-white rounded font-bold hover:bg-emerald-800 text-[10px]"
                    >
                      View Live Tracking →
                    </Link>
                  </div>
                )}

                {!submissionResult?.success && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmSubmit}
                      disabled={isSubmitting}
                      className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs shadow flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? (
                        <span>Submitting to Municipal Engine...</span>
                      ) : (
                        <>
                          <span>✓ Confirm & Submit Complaint</span>
                        </>
                      )}
                    </button>
                    <span className="block text-[9px] text-slate-500 text-center mt-1">
                      AI cannot submit without citizen confirmation. Submitting registers directly via Pune Municipal Grievance API.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Suggestion Chips (when starting or idle) */}
            {messages.length <= 2 && (
              <div className="pt-2">
                <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Common Pune Grievances & Queries:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleChipClick("There is a large pothole damaging vehicles on the main road in Kothrud")}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-200 rounded-full text-[11px] text-slate-800 shadow-sm transition"
                  >
                    🕳️ Pothole on road
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChipClick("Major water pipe burst and dirty water is overflowing near Shivajinagar")}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-200 rounded-full text-[11px] text-slate-800 shadow-sm transition"
                  >
                    💧 Water pipeline leak
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChipClick("Garbage collection vehicle has not come for three days, bins are overflowing")}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-200 rounded-full text-[11px] text-slate-800 shadow-sm transition"
                  >
                    🗑️ Garbage not collected
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChipClick("How do I track my complaint and what are the Pune municipal deadlines?")}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-200 rounded-full text-[11px] text-slate-800 shadow-sm transition"
                  >
                    ⏱️ Pune SLA Deadlines
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChipClick("What is the status of PUN-2026-0001?")}
                    className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-slate-200 rounded-full text-[11px] text-slate-800 shadow-sm transition"
                  >
                    🔍 Track PUN-2026-0001
                  </button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex items-center gap-1.5 text-slate-500 text-xs italic">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                <span>NagarSetu Assistant is thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Speech Error Banner */}
          {speechError && (
            <div className="px-3 py-1 bg-rose-50 text-rose-700 border-t border-rose-200 text-[10px] flex items-center justify-between">
              <span>{speechError}</span>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="font-bold hover:underline"
              >
                ✕
              </button>
            </div>
          )}

          {/* Active Listening Indicator */}
          {isListening && (
            <div className="px-3 py-1.5 bg-rose-600 text-white text-[10px] flex items-center justify-between animate-pulse">
              <span className="flex items-center gap-1.5 font-bold">
                <span className="h-2 w-2 rounded-full bg-white animate-ping"></span>
                Listening in {language}... Speak clearly now
              </span>
              <button
                type="button"
                onClick={toggleListening}
                className="bg-white text-rose-800 px-2 py-0.5 rounded font-bold"
              >
                Stop
              </button>
            </div>
          )}

          {/* Speech Privacy Note */}
          <div className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] border-t border-slate-200 flex items-center justify-between">
            <span>🎤 Audio processed in-browser via Web Speech API; voice is not stored.</span>
            <Link href="/help" className="text-blue-600 hover:underline">
              Help
            </Link>
          </div>

          {/* Input & Action Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            {/* Mic Button for Speech-to-Text */}
            <button
              type="button"
              onClick={toggleListening}
              aria-label={isListening ? "Stop voice listening" : "Start voice listening"}
              title="Speak complaint in English, Hindi, or Marathi"
              className={`h-9 w-9 rounded-full flex items-center justify-center text-base transition shrink-0 ${
                isListening
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300"
              }`}
            >
              🎤
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? "Listening to speech..."
                  : "Describe issue, track ref, or ask SLA rules..."
              }
              aria-label="Civic Assistant input"
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Send message"
              className="h-9 px-3.5 bg-[#0f2942] hover:bg-slate-800 disabled:opacity-40 text-white font-bold rounded-lg text-xs transition flex items-center justify-center shrink-0"
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle NagarSetu Help Assistant"
        className="min-h-[48px] px-4 py-2.5 rounded-full bg-[#0f2942] hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-xl border-2 border-amber-500 transition hover:scale-105 active:scale-95"
      >
        <span className="text-base">💬</span>
        <span>Help Assistant</span>
        {!isOpen && (
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
        )}
      </button>
    </div>
  );
}
