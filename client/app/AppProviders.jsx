"use client";

import { AuthProvider } from "@/lib/context/AuthContext";

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      {children}
    </AuthProvider>
  );
}