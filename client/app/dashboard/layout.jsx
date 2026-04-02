"use client";

import AdminDashboard from "@/lib/pages/dashboard/AdminDashboard";

export default function DashboardLayout({ children }) {
  return (
      <AdminDashboard>{children}</AdminDashboard>
  );
}

