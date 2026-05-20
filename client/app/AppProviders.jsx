"use client";

import { useEffect } from "react";
import { Toaster } from "react-hot-toast";
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
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#111418',
            color: '#E8E4DC',
            border: '1px solid rgba(232,228,220,0.08)',
            borderRadius: '8px',
            fontSize: '0.875rem',
          },
          success: { iconTheme: { primary: '#C8872A', secondary: '#0A0C0F' } },
          error:   { iconTheme: { primary: '#D42B2B', secondary: '#0A0C0F' } },
        }}
      />
    </AuthProvider>
  );
}