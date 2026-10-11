export type SupportedLanguage = "en" | "mr" | "hi";

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  mr: "मराठी (Marathi)",
  hi: "हिन्दी (Hindi)",
};

export const STATUS_TRANSLATIONS: Record<
  string,
  Record<SupportedLanguage, { label: string; explanation: string }>
> = {
  SUBMITTED: {
    en: {
      label: "Submitted",
      explanation:
        "Your complaint has been officially registered with Pune Municipal Corporation and is awaiting initial verification by the department.",
    },
    mr: {
      label: "दाखल (Submitted)",
      explanation:
        "तुमची तक्रार पुणे महानगरपालिकेकडे अधिकृतपणे नोंदवली गेली आहे आणि संबंधित विभागाकडून प्राथमिक पडताळणीची प्रतीक्षा करत आहे.",
    },
    hi: {
      label: "दर्ज (Submitted)",
      explanation:
        "आपकी शिकायत पुणे महानगरपालिका में आधिकारिक रूप से दर्ज हो गई है और विभाग द्वारा प्रारंभिक सत्यापन की प्रतीक्षा में है।",
    },
  },
  VERIFIED: {
    en: {
      label: "Verified",
      explanation:
        "A municipal official has verified your complaint details and location. A supervisor will now assign a field officer.",
    },
    mr: {
      label: "पडताळणी पूर्ण (Verified)",
      explanation:
        "महानगरपालिका अधिकाऱ्यांनी तुमच्या तक्रारीची व जागेची पडताळणी केली आहे. आता पर्यवेक्षक क्षेत्रीय अधिकाऱ्याची नियुक्ती करतील.",
    },
    hi: {
      label: "सत्यापित (Verified)",
      explanation:
        "नगर निगम अधिकारी ने आपकी शिकायत और स्थान का सत्यापन कर लिया है। अब पर्यवेक्षक एक क्षेत्रीय अधिकारी नियुक्त करेंगे।",
    },
  },
  ASSIGNED: {
    en: {
      label: "Assigned to Officer",
      explanation:
        "A dedicated department field officer has been assigned to resolve this complaint within the target resolution time.",
    },
    mr: {
      label: "अधिकारी नियुक्त (Assigned)",
      explanation:
        "निश्चित केलेल्या वेळेत या तक्रारीचे निराकरण करण्यासाठी संबंधित विभागाच्या क्षेत्रीय अधिकाऱ्याची नियुक्ती करण्यात आली आहे.",
    },
    hi: {
      label: "अधिकारी नियुक्त (Assigned)",
      explanation:
        "निर्धारित समय-सीमा के भीतर इस शिकायत का समाधान करने के लिए संबंधित विभाग के क्षेत्रीय अधिकारी को नियुक्त किया गया है।",
    },
  },
  IN_PROGRESS: {
    en: {
      label: "Work in Progress",
      explanation:
        "The assigned municipal field team has begun on-site repair or resolution work at the reported location.",
    },
    mr: {
      label: "काम प्रगतीपथावर (In Progress)",
      explanation:
        "नियुक्त केलेल्या महानगरपालिका पथकाने तक्रार केलेल्या ठिकाणी प्रत्यक्ष दुरुस्ती किंवा कार्यवाही सुरू केली आहे.",
    },
    hi: {
      label: "कार्य प्रगति पर (In Progress)",
      explanation:
        "नियुक्त नगर निगम दल ने शिकायत वाले स्थान पर मरम्मत या समाधान का कार्य शुरू कर दिया है।",
    },
  },
  RESOLVED_AWAITING_VERIFICATION: {
    en: {
      label: "Resolved — Awaiting Verification",
      explanation:
        "The field officer has marked the issue as resolved. You can confirm closure if satisfied, or request reopening within 7 days if the problem persists.",
    },
    mr: {
      label: "निराकरण पूर्ण — पडताळणी प्रलंबित",
      explanation:
        "क्षेत्रीय अधिकाऱ्यांनी काम पूर्ण झाल्याचे नोंदवले आहे. तुम्ही समाधानी असल्यास तक्रार बंद करण्याची पुष्टी करू शकता किंवा समस्या कायम असल्यास ७ दिवसांच्या आत पुन्हा उघडण्याची विनंती करू शकता.",
    },
    hi: {
      label: "समाधान पूर्ण — सत्यापन प्रतीक्षित",
      explanation:
        "क्षेत्रीय अधिकारी ने समस्या के समाधान की सूचना दी है। यदि आप संतुष्ट हैं तो समापन की पुष्टि करें, या समस्या बनी रहने पर 7 दिनों के भीतर पुनः खोलने का अनुरोध करें।",
    },
  },
  CLOSED: {
    en: {
      label: "Closed",
      explanation:
        "This complaint has been verified as resolved and is officially closed.",
    },
    mr: {
      label: "बंद (Closed)",
      explanation:
        "या तक्रारीचे यशस्वी निराकरण झाल्याची खात्री झाली असून ती अधिकृतपणे बंद करण्यात आली आहे.",
    },
    hi: {
      label: "बंद (Closed)",
      explanation:
        "इस शिकायत के समाधान की पुष्टि हो चुकी है और इसे आधिकारिक रूप से बंद कर दिया गया है।",
    },
  },
  REJECTED: {
    en: {
      label: "Rejected",
      explanation:
        "This complaint could not be actioned by PMC (for example, outside municipal jurisdiction or duplicate record). Check the timeline for the recorded reason.",
    },
    mr: {
      label: "नाकारली (Rejected)",
      explanation:
        "ही तक्रार महानगरपालिकेच्या कार्यकक्षेत नसल्यामुळे किंवा दुबार नोंदीमुळे नाकारण्यात आली आहे. कारणासाठी खालील टाइमलाइन पहा.",
    },
    hi: {
      label: "अस्वीकृत (Rejected)",
      explanation:
        "यह शिकायत नगर निगम द्वारा अस्वीकार कर दी गई है (उदा. अधिकार क्षेत्र से बाहर या डुप्लीकेट)। दर्ज कारण के लिए समयरेखा देखें।",
    },
  },
  REOPENED: {
    en: {
      label: "Reopened",
      explanation:
        "This complaint was reopened after post-resolution feedback and is queued for supervisor reassignment.",
    },
    mr: {
      label: "पुन्हा उघडली (Reopened)",
      explanation:
        "नागरिकांच्या प्रतिसादानंतर ही तक्रार पुन्हा उघडण्यात आली असून पर्यवेक्षकांकडून फेरनियुक्तीसाठी प्रलंबित आहे.",
    },
    hi: {
      label: "पुनः खोली गई (Reopened)",
      explanation:
        "नागरिक की प्रतिक्रिया के बाद यह शिकायत फिर से खोली गई है और पर्यवेक्षक द्वारा पुनः सौंपे जाने के लिए कतार में है।",
    },
  },
};

export const CATEGORY_TRANSLATIONS: Record<
  string,
  Record<SupportedLanguage, string>
> = {
  "Waste Management & Sanitation": {
    en: "Waste Management & Sanitation",
    mr: "घनकचरा व्यवस्थापन आणि स्वच्छता",
    hi: "कचरा प्रबंधन और स्वच्छता",
  },
  "Roads & Infrastructure": {
    en: "Roads & Infrastructure",
    mr: "रस्ते आणि पायाभूत सुविधा",
    hi: "सड़कें और बुनियादी ढांचा",
  },
  "Water & Sewage": {
    en: "Water & Sewage",
    mr: "पाणीपुरवठा आणि सांडपाणी",
    hi: "जल आपूर्ति और सीवेज",
  },
  "Civic Nuisance & Public Safety": {
    en: "Civic Nuisance & Public Safety",
    mr: "नागरी उपद्रव आणि सार्वजनिक सुरक्षा",
    hi: "नागरिक असुविधा और जन सुरक्षा",
  },
  Other: {
    en: "Other Municipal Issue",
    mr: "इतर महापालिका समस्या",
    hi: "अन्य नगर निगम समस्या",
  },
};

export const SUBCATEGORY_TRANSLATIONS: Record<
  string,
  Record<SupportedLanguage, string>
> = {
  "Missed garbage collection": {
    en: "Missed garbage collection",
    mr: "घंटागाडी / कचरा संकलन न होणे",
    hi: "कचरा गाड़ी द्वारा कचरा न उठाना",
  },
  "Overflowing public dustbins": {
    en: "Overflowing public dustbins",
    mr: "भरून वाहणाऱ्या सार्वजनिक कचराकुंड्या",
    hi: "उफनते सार्वजनिक कूड़ेदान",
  },
  "Dead animal removal": {
    en: "Dead animal removal",
    mr: "मृत जनावरांची विल्हेवाट",
    hi: "मृत पशु को हटाना",
  },
  "Public toilet maintenance": {
    en: "Public toilet maintenance",
    mr: "सार्वजनिक स्वच्छतागृहांची देखभाल",
    hi: "सार्वजनिक शौचालय का रखरखाव",
  },
  "Potholes or damaged roads": {
    en: "Potholes or damaged roads",
    mr: "रस्त्यावरील खड्डे किंवा खराब रस्ते",
    hi: "सड़क के गड्ढे या क्षतिग्रस्त सड़कें",
  },
  "Broken or flickering streetlights": {
    en: "Broken or flickering streetlights",
    mr: "बंद किंवा लुकलुकणारे पथदिवे (स्ट्रीटलाईट)",
    hi: "टूटी या टिमटिमाती स्ट्रीट लाइटें",
  },
  "Open or damaged manhole covers": {
    en: "Open or damaged manhole covers",
    mr: "उघडी किंवा तुटलेली चेंबर झाकणे (मॅनहोल)",
    hi: "खुले या टूटे हुए मैनहोल ढक्कन",
  },
  "Damaged footpaths or sidewalks": {
    en: "Damaged footpaths or sidewalks",
    mr: "तुटलेले पदपथ (फुटपाथ)",
    hi: "क्षतिग्रस्त फुटपाथ या पैदल पथ",
  },
  "Contaminated or muddy water supply": {
    en: "Contaminated or muddy water supply",
    mr: "दूषित किंवा गढूळ पाणीपुरवठा",
    hi: "दूषित या मटमैला जल आपूर्ति",
  },
  "Major pipe leaks or bursts": {
    en: "Major pipe leaks or bursts",
    mr: "मुख्य जलवाहिनी गळती किंवा फुटणे",
    hi: "मुख्य पाइपलाइन में रिसाव या फटना",
  },
  "Overflowing sewage or blocked sewage lines": {
    en: "Overflowing sewage or blocked sewage lines",
    mr: "तुंबलेली किंवा वाहणारी सांडपाणी वाहिनी (ड्रेनेज)",
    hi: "उफनता सीवेज या जाम सीवर लाइन",
  },
  "Unscheduled water supply cuts": {
    en: "Unscheduled water supply cuts",
    mr: "पूर्वसूचनेशिवाय पाणीपुरवठा खंडित होणे",
    hi: "बिना सूचना जल आपूर्ति में कटौती",
  },
  "Stray animal menace": {
    en: "Stray animal menace",
    mr: "भटक्या जनावरांचा उपद्रव",
    hi: "आवारा पशुओं का आतंक",
  },
  "Illegal tree cutting": {
    en: "Illegal tree cutting",
    mr: "विनापरवाना वृक्षतोड",
    hi: "अवैध रूप से पेड़ काटना",
  },
  "Unauthorized construction": {
    en: "Unauthorized construction",
    mr: "अनधिकृत बांधकाम किंवा अतिक्रमण",
    hi: "अनाधिकृत निर्माण या अतिक्रमण",
  },
  "Illegal parking or abandoned vehicles": {
    en: "Illegal parking or abandoned vehicles",
    mr: "बेकायदेशीर पार्किंग किंवा बेवारस वाहने",
    hi: "अवैध पार्किंग या लावारिस वाहन",
  },
  "Free-text municipal issue": {
    en: "Free-text municipal issue",
    mr: "इतर नागरी समस्या (सविस्तर लिहा)",
    hi: "अन्य नागरिक समस्या (विवरण लिखें)",
  },
};

export const UI_DICTIONARY: Record<
  SupportedLanguage,
  Record<string, string>
> = {
  en: {
    portalTitle: "NagarSetu • Pune Municipal Corporation",
    tagline: "Your Complaint. Our Accountability. Pune's Progress.",
    navHome: "Staff & Map Console",
    navReport: "Register a Complaint",
    navTrack: "Track Complaint",
    navMyComplaints: "My Complaints",
    navLogin: "Citizen / Staff Login",
    navLogout: "Logout",
    langLabel: "Language",

    // Stepper
    reportPageTitle: "Register a Municipal Grievance (Pune)",
    reportPageSubtitle:
      "Complete the 7 steps below. Your complaint text is saved exactly as you write it.",
    step1Title: "1. Category",
    step2Title: "2. Description",
    step3Title: "3. Photo / Evidence",
    step4Title: "4. Photo GPS & Time",
    step5Title: "5. Pune Map Pin",
    step6Title: "6. Review & SLA",
    step7Title: "7. Confirm & Submit",

    btnBack: "← Back",
    btnNext: "Next Step →",
    btnEdit: "Edit",
    btnConfirmSubmit: "Confirm and Submit Complaint",
    btnSubmitting: "Submitting Complaint...",

    // Step 1
    selectCategoryPrompt: "Select the main municipal category:",
    selectSubcategoryPrompt: "Select the specific issue type:",

    // Step 2
    descLabel: "Describe the problem in your own words",
    descHelp:
      "Tell us what happened, nearby landmarks, and how it affects residents. No formal language needed — write in English, Marathi, or Hindi (5 to 2000 characters). Your words are stored verbatim and never rewritten.",
    descPlaceholder:
      "Example: Deep pothole opposite Kothrud Bus Stand near main signal causing waterlogging and two-wheeler skids...",
    descValidationError:
      "Please enter a description between 5 and 2,000 characters.",

    // Step 3
    evidenceTitle: "Upload Photo or Video Evidence (Optional but Recommended)",
    evidenceHelp:
      "Supported formats: JPG, PNG, WEBP up to 10 MB; MP4, WEBM video up to 30 MB.",
    btnTakePhoto: "📷 Take Photo with Camera",
    btnUploadFile: "📁 Choose Existing Photo / Video",
    btnReplaceFile: "Replace File",
    btnRemoveFile: "Remove Evidence",
    captionLabel: "Short Photo / Video Caption (Optional)",
    captionPlaceholder: "e.g., View facing Paud Road signal",

    // Step 4
    step4Header: "Automatic Location & Photo Metadata Check",
    exifDisclaimer:
      "Note: Photo EXIF metadata can be missing, stripped by phone galleries/messaging apps, or edited. It is treated strictly as an unverified helper and never as legal proof.",
    photoTimeLabel: "Photo recorded time (from photo metadata, not verified):",
    photoTimeMissing:
      "No timestamp found in photo metadata (common when uploaded from gallery).",
    gpsFoundMsg:
      "GPS coordinates were found in your photo and pinned on the Pune map. Please confirm below.",
    gpsMissingMsg:
      "Your photo did not contain GPS metadata (or no photo was attached). Many phone galleries strip location data for privacy. You can use your device location or pick the spot on the map in the next step.",
    btnUseDeviceLocation: "📍 Use My Current Device Location",
    distanceWarningTitle:
      "Photo GPS and Device Location Differ by More Than 100m",
    btnChoosePhotoGps: "Use Photo Location",
    btnChooseDeviceGps: "Use Device Location",

    // Step 5
    step5Header: "Confirm Complaint Location on Pune Map",
    step5Help:
      "Search a Pune landmark or street, click on the map, or drag the red marker pin to the exact spot.",
    searchPlaceholder: "Search Pune area or landmark (e.g., Kothrud, Baner, Hadapsar)...",
    btnSearchMap: "Search",
    selectedLocationLabel: "Selected Pune Location / Landmark Label:",

    // Step 6
    step6Header: "Review Your Complaint Before Submitting",
    slaTargetTitle:
      "Expected Municipal SLA Targets (Demonstration rules, not official PMC commitments)",
    expectedResponseLabel: "Target Initial Response:",
    expectedResolutionLabel: "Target Resolution Deadline:",

    // Step 7 & Duplicate Warning
    step7Prompt:
      "Please review the summary and click 'Confirm and Submit Complaint' below to officially register your grievance.",
    duplicateWarningTitle:
      "You may already have an active complaint about this issue.",
    duplicateWarningBody:
      "We found an active complaint from your account in the same subcategory within 50 metres with a similar description.",
    optTrackExisting: "Track existing complaint",
    optAddEvidence: "Add new evidence / update to existing complaint",
    optGoBack: "Go back and correct",
    optSubmitDifferent: "Submit as a different issue",

    // Tracking
    trackPageTitle: "Track Municipal Grievance Status",
    trackSearchPlaceholder: "Enter Reference ID (e.g., NS-2026-001001 or RPT-2026-1001)",
    btnSearchRef: "Track Status",
    myComplaintsTitle: "My Registered Complaints",
    publicViewNotice:
      "Showing public summary. Log in as the reporting citizen to view full description, photos, and citizen actions.",
    ownerViewNotice:
      "You are logged in as the reporting citizen for this grievance.",
    btnConfirmClosure: "✓ Confirm Issue is Resolved & Close",
    btnRequestReopen: "↺ Request Reopening",
    btnAddEvidenceUpdate: "+ Add Evidence / Progress Note",
    reopenRuleInfo:
      "Official Reopening Rule: Citizens who own a linked report may request reopening within 7 days of resolution if the problem persists on site.",
  },
  mr: {
    portalTitle: "नगरसेतू • पुणे महानगरपालिका",
    tagline: "तुमची तक्रार. आमची जबाबदारी. पुण्याची प्रगती.",
    navHome: "मुख्य कक्ष व नकाशा",
    navReport: "तक्रार नोंदवा",
    navTrack: "तक्रार स्थिती पहा",
    navMyComplaints: "माझ्या तक्रारी",
    navLogin: "नागरिक / अधिकारी लॉगिन",
    navLogout: "बाहेर पडा",
    langLabel: "भाषा",

    reportPageTitle: "पुणे महानगरपालिका नागरी तक्रार नोंदणी",
    reportPageSubtitle:
      "खालील ७ पायऱ्या पूर्ण करा. तुम्ही लिहिलेला तक्रारीचा मजकूर जसाच्या तसा जतन केला जातो.",
    step1Title: "१. श्रेणी निवडा",
    step2Title: "२. तक्रार वर्णन",
    step3Title: "३. फोटो / पुरावा",
    step4Title: "४. फोटो स्थान व वेळ",
    step5Title: "५. पुणे नकाशा पिन",
    step6Title: "६. पडताळणी व वेळमर्यादा",
    step7Title: "७. खात्री करा व पाठवा",

    btnBack: "← मागे",
    btnNext: "पुढील पायरी →",
    btnEdit: "बदल करा",
    btnConfirmSubmit: "खात्री करा आणि तक्रार दाखल करा",
    btnSubmitting: "तक्रार दाखल होत आहे...",

    selectCategoryPrompt: "मुख्य महापालिका तक्रार श्रेणी निवडा:",
    selectSubcategoryPrompt: "तक्रारीचा नेमका प्रकार निवडा:",

    descLabel: "तुमच्या शब्दांत समस्येचे वर्णन करा",
    descHelp:
      "नेमकी काय समस्या आहे व जवळची खूण लिहा. औपचारिक भाषेची गरज नाही — मराठी, हिंदी किंवा इंग्रजीत लिहा (५ ते २००० अक्षरे). तुमचा मजकूर बदलला जात नाही.",
    descPlaceholder:
      "उदा. कोथरूड बस स्टँडसमोर मुख्य सिग्नलजवळ रस्त्यावर मोठा खड्डा पडला असून पाणी साचले आहे...",
    descValidationError: "कृपया ५ ते २,००० अक्षरांदरम्यान वर्णन लिहा.",

    evidenceTitle: "फोटो किंवा व्हिडिओ पुरावा जोडा (ऐच्छिक पण शिफारस केलेले)",
    evidenceHelp:
      "मान्य स्वरूप: JPG, PNG, WEBP (१० MB पर्यंत); MP4, WEBM व्हिडिओ (३० MB पर्यंत).",
    btnTakePhoto: "📷 कॅमेऱ्याने फोटो काढा",
    btnUploadFile: "📁 गॅलरीतून फोटो / व्हिडिओ निवडा",
    btnReplaceFile: "फाइल बदला",
    btnRemoveFile: "काढून टाका",
    captionLabel: "फोटो / व्हिडिओसाठी लहान टीप (ऐच्छिक)",
    captionPlaceholder: "उदा. पौड रोड सिग्नलकडील दृश्य",

    step4Header: "स्वयंचलित फोटो स्थान आणि वेळ तपासणी",
    exifDisclaimer:
      "टीप: फोटोमधील EXIF माहिती गॅलरीतून अपलोड करताना काढली जाऊ शकते किंवा बदलता येते. ही माहिती केवळ मदतीसाठी असून पुरावा मानली जात नाही.",
    photoTimeLabel: "फोटोमध्ये नोंदवलेली वेळ (फोटो मेटाडेटा, अप्रमाणित):",
    photoTimeMissing:
      "फोटो मेटाडेटामध्ये वेळ आढळली नाही (गॅलरी फोटोंमध्ये हे सामान्य आहे).",
    gpsFoundMsg:
      "तुमच्या फोटोमध्ये GPS स्थान आढळले असून नकाशावर पिन केले आहे. कृपया खाली खात्री करा.",
    gpsMissingMsg:
      "फोटोमध्ये GPS स्थान आढळले नाही. तुम्ही तुमच्या मोबाईलचे चालू स्थान वापरू शकता किंवा पुढील पायरीत नकाशावर पिन ठेवू शकता.",
    btnUseDeviceLocation: "📍 माझे सध्याचे डिव्हाइस लोकेशन वापरा",
    distanceWarningTitle:
      "फोटोमधील GPS आणि तुमचे सध्याचे स्थान यामध्ये १०० मीटरपेक्षा जास्त अंतर आहे",
    btnChoosePhotoGps: "फोटोमधील स्थान वापरा",
    btnChooseDeviceGps: "सध्याचे डिव्हाइस स्थान वापरा",

    step5Header: "पुणे नकाशावर तक्रारीचे अचूक ठिकाण निश्चित करा",
    step5Help:
      "पुण्यातील परिसर शोधा, नकाशावर क्लिक करा किंवा लाल पिन ओढून नेमक्या जागेवर ठेवा.",
    searchPlaceholder: "पुण्यातील भाग किंवा खूण शोधा (उदा. कोथरूड, बाणेर, हडपसर)...",
    btnSearchMap: "शोधा",
    selectedLocationLabel: "निवडलेले पुणे ठिकाण / परिसर नाव:",

    step6Header: "तक्रार दाखल करण्यापूर्वी सर्व माहिती तपासा",
    slaTargetTitle:
      "अपेक्षित कार्यवाही वेळमर्यादा (प्रात्यक्षिक नियम, अधिकृत महापालिका हमी नाही)",
    expectedResponseLabel: "अपेक्षित प्राथमिक प्रतिसाद:",
    expectedResolutionLabel: "अपेक्षित निराकरण मुदत:",

    step7Prompt:
      "कृपया माहितीची खात्री करा आणि तक्रार अधिकृतपणे नोंदवण्यासाठी खालील बटण दाबा.",
    duplicateWarningTitle:
      "या समस्येबाबत तुमची आधीच एक सक्रिय तक्रार असू शकते.",
    duplicateWarningBody:
      "तुमच्या खात्यावरून ५० मीटरच्या आत याच प्रकारची सक्रिय तक्रार आढळली आहे.",
    optTrackExisting: "आधीची तक्रार ट्रॅक करा",
    optAddEvidence: "आधीच्या तक्रारीत नवीन फोटो/माहिती जोडा",
    optGoBack: "मागे जा आणि दुरुस्त करा",
    optSubmitDifferent: "वेगळी तक्रार म्हणून दाखल करा",

    trackPageTitle: "तक्रार स्थिती तपासा (Track Status)",
    trackSearchPlaceholder: "संदर्भ क्रमांक टाका (उदा. NS-2026-001001 किंवा RPT-2026-1001)",
    btnSearchRef: "स्थिती पहा",
    myComplaintsTitle: "माझ्या नोंदवलेल्या तक्रारी",
    publicViewNotice:
      "ही सार्वजनिक माहिती आहे. संपूर्ण वर्णन, फोटो आणि कार्यवाही पर्यायांसाठी तक्रारदार नागरिक म्हणून लॉगिन करा.",
    ownerViewNotice: "तुम्ही या तक्रारीचे नोंदणीकृत तक्रारदार आहात.",
    btnConfirmClosure: "✓ समस्या सुटल्याची पुष्टी करा व तक्रार बंद करा",
    btnRequestReopen: "↺ तक्रार पुन्हा उघडण्याची विनंती करा",
    btnAddEvidenceUpdate: "+ अतिरिक्त पुरावा / माहिती जोडा",
    reopenRuleInfo:
      "अधिकृत नियम: निराकरण झाल्यापासून ७ दिवसांच्या आत समस्या कायम असल्यास तक्रारदार नागरिक तक्रार पुन्हा उघडण्याची विनंती करू शकतात.",
  },
  hi: {
    portalTitle: "नगरसेतु • पुणे महानगरपालिका",
    tagline: "आपकी शिकायत। हमारी जवाबदेही। पुणे की प्रगति।",
    navHome: "स्टाफ व मानचित्र कक्ष",
    navReport: "शिकायत दर्ज करें",
    navTrack: "शिकायत ट्रैक करें",
    navMyComplaints: "मेरी शिकायतें",
    navLogin: "नागरिक / स्टाफ लॉगिन",
    navLogout: "लॉगआउट",
    langLabel: "भाषा",

    reportPageTitle: "पुणे महानगरपालिका नागरिक शिकायत पंजीकरण",
    reportPageSubtitle:
      "नीचे दिए गए 7 चरण पूरे करें। आपकी शिकायत का विवरण बिल्कुल वैसा ही सहेजा जाता है जैसा आप लिखते हैं।",
    step1Title: "1. श्रेणी चुनें",
    step2Title: "2. विवरण लिखें",
    step3Title: "3. फोटो / प्रमाण",
    step4Title: "4. फोटो स्थान व समय",
    step5Title: "5. पुणे मानचित्र पिन",
    step6Title: "6. समीक्षा व समय-सीमा",
    step7Title: "7. पुष्टि करें व भेजें",

    btnBack: "← पीछे",
    btnNext: "अगला चरण →",
    btnEdit: "बदलें",
    btnConfirmSubmit: "पुष्टि करें और शिकायत दर्ज करें",
    btnSubmitting: "शिकायत दर्ज हो रही है...",

    selectCategoryPrompt: "मुख्य नगर निगम श्रेणी चुनें:",
    selectSubcategoryPrompt: "समस्या का विशिष्ट प्रकार चुनें:",

    descLabel: "अपने शब्दों में समस्या का वर्णन करें",
    descHelp:
      "बताएं कि क्या हुआ और पास का लैंडमार्क क्या है। औपचारिक भाषा की आवश्यकता नहीं है — हिंदी, मराठी या अंग्रेजी में लिखें (5 से 2000 अक्षर)। आपके शब्द कभी बदले नहीं जाते।",
    descPlaceholder:
      "उदाहरण: कोथरूड बस स्टैंड के सामने मुख्य सिग्नल के पास सड़क पर गहरा गड्ढा है जिससे पानी भर रहा है...",
    descValidationError: "कृपया 5 से 2,000 अक्षरों के बीच विवरण दर्ज करें।",

    evidenceTitle: "फोटो या वीडियो प्रमाण अपलोड करें (वैकल्पिक पर अनुशंसित)",
    evidenceHelp:
      "समर्थित प्रारूप: JPG, PNG, WEBP (10 MB तक); MP4, WEBM वीडियो (30 MB तक)।",
    btnTakePhoto: "📷 कैमरे से फोटो लें",
    btnUploadFile: "📁 गैलरी से फोटो / वीडियो चुनें",
    btnReplaceFile: "फाइल बदलें",
    btnRemoveFile: "प्रमाण हटाएं",
    captionLabel: "फोटो / वीडियो के लिए संक्षिप्त कैप्शन (वैकल्पिक)",
    captionPlaceholder: "उदा. पौड रोड सिग्नल की ओर का दृश्य",

    step4Header: "स्वचालित फोटो स्थान और समय की जांच",
    exifDisclaimer:
      "नोट: फोन गैलरी या मैसेजिंग ऐप से अपलोड करने पर EXIF डेटा हट सकता है या बदला जा सकता है। इसे केवल सहायता के लिए माना जाता है, कानूनी प्रमाण नहीं।",
    photoTimeLabel: "फोटो में दर्ज समय (फोटो मेटाडेटा से, असत्यापित):",
    photoTimeMissing:
      "फोटो मेटाडेटा में समय नहीं मिला (गैलरी अपलोड में यह सामान्य है)।",
    gpsFoundMsg:
      "आपकी फोटो में GPS स्थान मिला है और पुणे मानचित्र पर पिन कर दिया गया है। कृपया नीचे पुष्टि करें।",
    gpsMissingMsg:
      "फोटो में GPS डेटा नहीं मिला। आप अपने डिवाइस के वर्तमान स्थान का उपयोग कर सकते हैं या अगले चरण में मानचित्र पर पिन लगा सकते हैं।",
    btnUseDeviceLocation: "📍 मेरे वर्तमान डिवाइस स्थान का उपयोग करें",
    distanceWarningTitle:
      "फोटो GPS और डिवाइस स्थान में 100 मीटर से अधिक का अंतर है",
    btnChoosePhotoGps: "फोटो स्थान चुनें",
    btnChooseDeviceGps: "डिवाइस स्थान चुनें",

    step5Header: "पुणे मानचित्र पर शिकायत के स्थान की पुष्टि करें",
    step5Help:
      "पुणे का कोई क्षेत्र खोजें, मानचित्र पर क्लिक करें या लाल पिन को खींचकर सटीक स्थान पर रखें।",
    searchPlaceholder: "पुणे का क्षेत्र या लैंडमार्क खोजें (उदा. कोथरूड, बाणेर, हडपसर)...",
    btnSearchMap: "खोजें",
    selectedLocationLabel: "चयनित पुणे स्थान / लैंडमार्क नाम:",

    step6Header: "जमा करने से पहले अपनी शिकायत की समीक्षा करें",
    slaTargetTitle:
      "अपेक्षित समय-सीमा (प्रदर्शन नियम, आधिकारिक PMC प्रतिबद्धता नहीं)",
    expectedResponseLabel: "लक्षित प्रारंभिक प्रतिक्रिया:",
    expectedResolutionLabel: "लक्षित समाधान समय-सीमा:",

    step7Prompt:
      "कृपया विवरण की समीक्षा करें और अपनी शिकायत आधिकारिक रूप से दर्ज करने के लिए नीचे दिए गए बटन पर क्लिक करें।",
    duplicateWarningTitle:
      "इस समस्या के बारे में आपकी पहले से एक सक्रिय शिकायत हो सकती है।",
    duplicateWarningBody:
      "हमें आपके खाते से 50 मीटर के भीतर इसी उप-श्रेणी में समान विवरण वाली एक सक्रिय शिकायत मिली है।",
    optTrackExisting: "मौजूदा शिकायत ट्रैक करें",
    optAddEvidence: "मौजूदा शिकायत में नया प्रमाण/अपडेट जोड़ें",
    optGoBack: "वापस जाएं और सुधारें",
    optSubmitDifferent: "अलग शिकायत के रूप में दर्ज करें",

    trackPageTitle: "शिकायत की स्थिति ट्रैक करें",
    trackSearchPlaceholder: "संदर्भ संख्या दर्ज करें (उदा. NS-2026-001001 या RPT-2026-1001)",
    btnSearchRef: "स्थिति देखें",
    myComplaintsTitle: "मेरी दर्ज शिकायतें",
    publicViewNotice:
      "सार्वजनिक सारांश दिखाया जा रहा है। पूर्ण विवरण, फोटो और नागरिक विकल्पों के लिए शिकायतकर्ता नागरिक के रूप में लॉगिन करें।",
    ownerViewNotice: "आप इस शिकायत के पंजीकृत शिकायतकर्ता के रूप में लॉगिन हैं।",
    btnConfirmClosure: "✓ समाधान की पुष्टि करें और बंद करें",
    btnRequestReopen: "↺ पुनः खोलने का अनुरोध करें",
    btnAddEvidenceUpdate: "+ नया प्रमाण / अपडेट जोड़ें",
    reopenRuleInfo:
      "आधिकारिक नियम: समाधान के 7 दिनों के भीतर यदि समस्या बनी रहती है, तो शिकायतकर्ता नागरिक शिकायत को पुनः खोलने का अनुरोध कर सकते हैं।",
  },
};

export function translateKey(
  lang: SupportedLanguage,
  key: string
): string {
  return UI_DICTIONARY[lang]?.[key] ?? UI_DICTIONARY.en[key] ?? key;
}

export function translateCategory(
  lang: SupportedLanguage,
  categoryName: string
): string {
  return (
    CATEGORY_TRANSLATIONS[categoryName]?.[lang] ??
    CATEGORY_TRANSLATIONS[categoryName]?.en ??
    categoryName
  );
}

export function translateSubcategory(
  lang: SupportedLanguage,
  subcategoryName: string
): string {
  return (
    SUBCATEGORY_TRANSLATIONS[subcategoryName]?.[lang] ??
    SUBCATEGORY_TRANSLATIONS[subcategoryName]?.en ??
    subcategoryName
  );
}

export function translateStatus(
  lang: SupportedLanguage,
  status: string
): { label: string; explanation: string } {
  return (
    STATUS_TRANSLATIONS[status]?.[lang] ??
    STATUS_TRANSLATIONS[status]?.en ?? {
      label: status,
      explanation: "",
    }
  );
}
