import type { Metadata } from "next";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/context";

export const metadata: Metadata = {
  title: "NagarSetu | Pune Municipal Grievance Resolution Portal (PMC)",
  description:
    "Your Complaint. Our Accountability. Pune's Progress. Configurable Public-Institution Workflow Engine for Pune Municipal Grievance Resolution.",
};

import { FloatingHelpAssistant } from "@/components/FloatingHelpAssistant";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <I18nProvider>
          {children}
          <FloatingHelpAssistant />
        </I18nProvider>
      </body>
    </html>
  );
}
