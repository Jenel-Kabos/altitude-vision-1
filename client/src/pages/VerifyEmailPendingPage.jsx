import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../services/api";

const VerifyEmailPendingPage = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resendStatus, setResendStatus] = useState(null); // null | 'loading' | 'success' | 'error'

  const handleResend = async () => {
    setResendStatus("loading");
    try {
      await api.post("/users/resend-verification", { email });
      setResendStatus("success");
    } catch {
      setResendStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg">

        {/* Card principale */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">

          {/* Header bleu */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-10 text-center relative overflow-hidden">
            {/* Cercles décoratifs */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

            {/* Icône email animée */}
            <div className="relative inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-4 backdrop-blur-sm">
              <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {/* Point de notification */}
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-400 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white mb-2">
              Vérifiez votre email
            </h1>
            <p className="text-blue-100 text-sm">
              Votre compte a été créé avec succès
            </p>
          </div>

          {/* Corps */}
          <div className="px-8 py-8 space-y-6">

            {/* Message principal */}
            <div className="text-center space-y-3">
              <p className="text-gray-700 text-base leading-relaxed">
                Nous avons envoyé un lien d'activation à
              </p>
              <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2">
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
                <span className="text-blue-700 font-semibold text-sm">{email || "votre adresse email"}</span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                Cliquez sur le bouton <strong>"Activer mon compte"</strong> dans l'email 
                pour finaliser votre inscription.
              </p>
            </div>

            {/* Étapes */}
            <div className="bg-gray-50 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Que faire maintenant ?</p>
              {[
                { icon: "📬", text: "Ouvrez votre boîte mail" },
                { icon: "🔍", text: 'Cherchez un email d\'Altitude Vision' },
                { icon: "✅", text: 'Cliquez sur "Activer mon compte"' },
                { icon: "🎉", text: "Accédez à la plateforme !" },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-lg">{step.icon}</span>
                  <span className="text-sm text-gray-600">{step.text}</span>
                </div>
              ))}
            </div>

            {/* Vérifier les spams */}
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-amber-700">
                <strong>Email non reçu ?</strong> Pensez à vérifier votre dossier <strong>Spam</strong> ou <strong>Courrier indésirable</strong>.
              </p>
            </div>

            {/* Bouton renvoyer */}
            <div className="text-center space-y-2">
              <p className="text-sm text-gray-500">Toujours rien après quelques minutes ?</p>

              {resendStatus === "success" ? (
                <div className="flex items-center justify-center gap-2 text-green-600 font-semibold text-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Email renvoyé avec succès !
                </div>
              ) : resendStatus === "error" ? (
                <p className="text-red-500 text-sm">Erreur lors de l'envoi. Réessayez plus tard.</p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendStatus === "loading"}
                  className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold text-sm border border-blue-200 hover:border-blue-300 rounded-xl px-5 py-2.5 hover:bg-blue-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resendStatus === "loading" ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Envoi en cours...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Renvoyer l'email de vérification
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <Link to="/login" className="text-sm text-gray-500 hover:text-blue-600 transition font-medium">
              ← Retour à la connexion
            </Link>
            <Link to="/" className="text-sm text-gray-500 hover:text-blue-600 transition font-medium">
              Retour à l'accueil
            </Link>
          </div>
        </div>

        {/* Sous-texte */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Des difficultés ? Contactez-nous à{" "}
          <a href="mailto:support@altitudevision.agency" className="text-blue-500 hover:underline">
            support@altitudevision.agency
          </a>
        </p>
      </div>
    </div>
  );
};

export default VerifyEmailPendingPage;