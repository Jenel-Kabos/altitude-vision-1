"use client";

import { useEffect } from "react";
import { AuthProvider } from "@/lib/context/AuthContext";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://altitude-vision.onrender.com/api";

function ServerWakeup() {
  useEffect(() => {
    fetch(`${API_URL}/health`, { method: "GET", cache: "no-store" }).catch(() => {});
  }, []);
  return null;
}

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ServerWakeup />
      {children}
    </AuthProvider>
  );
}