"use client";

import OwnerDashboard from "@/lib/pages/dashboard/OwnerDashboard";

export default function MyHotelsLayout({ children }) {
  return (
      <OwnerDashboard>{children}</OwnerDashboard>
  );
}
