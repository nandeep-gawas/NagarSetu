import React from "react";

/**
 * State Emblem of India (Lion Capital of Ashoka) Silhouette SVG
 */
export function EmblemOfIndia({ className = "h-14 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 130"
      className={className}
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="State Emblem of India"
      role="img"
    >
      {/* Three Lions Representation */}
      <path
        d="M50 15 C45 15 40 18 38 23 C36 19 32 17 28 17 C22 17 18 22 18 28 C18 36 24 42 30 45 C28 48 26 53 26 58 C26 65 31 71 38 73 L38 80 L30 80 L30 84 L40 84 L40 92 L34 92 C30 92 28 94 28 98 L72 98 C72 94 70 92 66 92 L60 92 L60 84 L70 84 L70 80 L62 80 L62 73 C69 71 74 65 74 58 C74 53 72 48 70 45 C76 42 82 36 82 28 C82 22 78 17 72 17 C68 17 64 19 62 23 C60 18 55 15 50 15 Z"
        fill="#1e293b"
      />
      {/* Central Lion Head Details */}
      <circle cx="50" cy="27" r="5" fill="#f8fafc" />
      <path d="M46 35 Q50 38 54 35" stroke="#f8fafc" strokeWidth="2" fill="none" />
      {/* Left Lion Detail */}
      <circle cx="28" cy="28" r="3.5" fill="#f8fafc" />
      {/* Right Lion Detail */}
      <circle cx="72" cy="28" r="3.5" fill="#f8fafc" />
      {/* Ashoka Chakra Base */}
      <circle cx="50" cy="88" r="5" fill="none" stroke="#1e293b" strokeWidth="1.5" />
      <circle cx="50" cy="88" r="1.5" fill="#1e293b" />
      {/* Base Pedestal with Satyameva Jayate Banner */}
      <rect x="20" y="102" width="60" height="4" fill="#1e293b" />
      <text
        x="50"
        y="118"
        fontSize="9"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily="serif"
        fill="#1e293b"
        letterSpacing="0.5"
      >
        सत्यमेव जयते
      </text>
    </svg>
  );
}

/**
 * Government of Maharashtra State Crest / Seal SVG
 */
export function MaharashtraSeal({ className = "h-14 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Government of Maharashtra Seal"
      role="img"
    >
      <circle cx="50" cy="50" r="46" fill="#fef3c7" stroke="#b45309" strokeWidth="3" />
      <circle cx="50" cy="50" r="41" fill="none" stroke="#b45309" strokeWidth="1" strokeDasharray="3 2" />
      {/* Rajmudra Inspired Diya / Crescent Emblem */}
      <path
        d="M32 45 Q50 35 68 45 Q50 72 32 45 Z"
        fill="#b45309"
      />
      <circle cx="50" cy="42" r="4" fill="#fef3c7" />
      <text
        x="50"
        y="26"
        fontSize="7.5"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily="sans-serif"
        fill="#78350f"
      >
        महाराष्ट्र शासन
      </text>
      <text
        x="50"
        y="82"
        fontSize="6"
        fontWeight="bold"
        textAnchor="middle"
        fontFamily="serif"
        fill="#78350f"
        letterSpacing="0.5"
      >
        GOVT. OF MAHARASHTRA
      </text>
    </svg>
  );
}

/**
 * Pune Municipal Corporation (PMC) Crest Emblem SVG
 */
export function PmcLogo({ className = "h-12 w-auto" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Pune Municipal Corporation Emblem"
      role="img"
    >
      <circle cx="50" cy="50" r="45" fill="#0f3b60" stroke="#c31a26" strokeWidth="3" />
      <circle cx="50" cy="50" r="39" fill="#ffffff" />
      {/* Shaniwar Wada Gate Profile */}
      <path
        d="M30 65 L30 46 L38 38 L62 38 L70 46 L70 65 Z"
        fill="#0f3b60"
      />
      <path
        d="M44 65 L44 52 Q50 48 56 52 L56 65 Z"
        fill="#ffffff"
      />
      {/* PMC Text */}
      <text
        x="50"
        y="32"
        fontSize="7.5"
        fontWeight="bold"
        textAnchor="middle"
        fill="#0f3b60"
        fontFamily="sans-serif"
      >
        पुणे मनपा
      </text>
      <text
        x="50"
        y="78"
        fontSize="6.5"
        fontWeight="bold"
        textAnchor="middle"
        fill="#c31a26"
        fontFamily="sans-serif"
        letterSpacing="0.8"
      >
        PMC • PUNE
      </text>
    </svg>
  );
}

/**
 * National Tricolor Flag of India SVG
 */
export function IndianFlag({ className = "h-4 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 30 20"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Flag of India"
    >
      <rect width="30" height="6.67" fill="#FF9933" />
      <rect y="6.67" width="30" height="6.67" fill="#FFFFFF" />
      <rect y="13.34" width="30" height="6.67" fill="#138808" />
      <circle cx="15" cy="10" r="2.2" fill="none" stroke="#000080" strokeWidth="0.5" />
      <circle cx="15" cy="10" r="0.6" fill="#000080" />
    </svg>
  );
}

/**
 * Government Category Icons (Clean line SVGs, strictly NO emojis)
 */
export function CategoryIcon({
  categoryName,
  className = "h-6 w-6 text-white",
}: {
  categoryName: string;
  className?: string;
}) {
  const norm = categoryName.toLowerCase();

  // Roads & Infrastructure
  if (norm.includes("road") || norm.includes("pothole") || norm.includes("infrastructure")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19L9 5M20 19L15 5M12 7V9M12 13V15M12 19V21" />
      </svg>
    );
  }

  // Water & Sewage
  if (norm.includes("water") || norm.includes("sewage") || norm.includes("drain")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
      </svg>
    );
  }

  // Waste Management & Sanitation
  if (norm.includes("waste") || norm.includes("sanitation") || norm.includes("garbage")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    );
  }

  // Civic Nuisance & Public Safety
  if (norm.includes("nuisance") || norm.includes("safety") || norm.includes("encroachment")) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    );
  }

  // General Municipal / Other
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

/**
 * Standard Government Utility Icons
 */
export function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}

export function CalendarIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

export function AccessibilityIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="4" r="2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M12 8v8m-4 5l4-5 4 5" />
    </svg>
  );
}

export function FileTextIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

export function CheckCircleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function ClockIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

export function AlertTriangleIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

export function MapPinIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function BuildingIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
