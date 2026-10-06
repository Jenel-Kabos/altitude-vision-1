"use client";
// GOOGLE-PLAY-P0-1 — Page publique décrivant la procédure de suppression
// de compte. Requise par la politique Google Play "Data deletion" pour
// les applications qui permettent la création d'un compte.
//
// Cette page N'EFFECTUE JAMAIS de suppression via un formulaire non
// authentifié. La suppression réelle passe par :
//   1. la fonction "Supprimer mon compte" dans l'application mobile,
//   2. l'onglet équivalent du dashboard web, une fois connecté,
//   3. à défaut, une demande écrite à support@altitudevision.agency
//      (traitement humain avec vérification d'identité).

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Smartphone,
  Mail,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
} from 'lucide-react';

const SupprimerMonCompte = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href="/politique-confidentialite"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 transition mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la politique de confidentialité</span>
        </Link>

        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-sm uppercase tracking-wider text-red-700 font-semibold">
              Suppression de compte
            </p>
          </div>
          <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900">
            Supprimer mon compte Altimmo
          </h1>
          <p className="text-gray-600 mt-3 max-w-2xl">
            Cette page décrit comment demander la suppression de votre compte
            Altimmo et les données concernées. Aucune suppression n'est
            déclenchée depuis cette page publique&nbsp;: chaque demande est
            traitée après vérification d'identité, pour éviter qu'un tiers
            puisse fermer votre compte à votre place.
          </p>
        </motion.header>

        <section className="grid gap-6 sm:grid-cols-2 mb-10">
          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Depuis l'application mobile Altimmo
              </h2>
            </div>
            <ol className="list-decimal ml-5 text-gray-600 space-y-2 text-sm">
              <li>Ouvrez l'application Altimmo et connectez-vous.</li>
              <li>Rendez-vous dans l'onglet <strong>Profil</strong>.</li>
              <li>
                En bas de l'écran, section <em>Zone sensible</em>, appuyez sur{' '}
                <strong>&laquo;&nbsp;Supprimer mon compte&nbsp;&raquo;</strong>.
              </li>
              <li>Confirmez la demande (double confirmation).</li>
              <li>
                Votre session est automatiquement déconnectée dès que la
                suppression est traitée.
              </li>
            </ol>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Par email (support)
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Si vous n'avez plus accès à votre application ou à votre
              compte, adressez une demande à&nbsp;:
            </p>
            <a
              href="mailto:support@altitudevision.agency?subject=Demande%20de%20suppression%20de%20compte%20Altimmo"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-medium hover:bg-blue-700 transition"
            >
              support@altitudevision.agency
            </a>
            <p className="text-xs text-gray-500 mt-3">
              Précisez l'adresse email associée à votre compte. Une
              vérification d'identité peut vous être demandée avant
              traitement.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Ce qui est supprimé ou anonymisé
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 text-sm">
            <div>
              <p className="font-semibold text-gray-900 mb-2">
                Effacé de nos systèmes
              </p>
              <ul className="list-disc ml-5 text-gray-600 space-y-1">
                <li>Nom et prénom associés à votre profil</li>
                <li>Adresse email personnelle</li>
                <li>Numéro de téléphone</li>
                <li>Photo de profil (Cloudinary)</li>
                <li>Biographie personnelle</li>
                <li>Jeton Expo Push (fin des notifications)</li>
                <li>Identifiant Google (si connexion Google)</li>
                <li>Toutes vos sessions actives (déconnexion globale)</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-gray-900 mb-2">
                Anonymisé ou conservé
              </p>
              <ul className="list-disc ml-5 text-gray-600 space-y-1">
                <li>
                  Messages échangés dans la messagerie interne&nbsp;:
                  l'auteur est anonymisé, le contenu reste visible aux
                  autres participants
                </li>
                <li>
                  Transactions, contrats, factures, paiements&nbsp;: les
                  documents métier sont conservés pour préserver
                  l'intégrité comptable et contractuelle
                </li>
                <li>
                  Annonces immobilières, réservations et visites publiées&nbsp;:
                  leur historique est préservé s'il est nécessaire à un
                  tiers (locataire, acheteur, propriétaire)
                </li>
                <li>
                  Journaux d'activité et logs techniques&nbsp;: conservés
                  pour la sécurité et la lutte contre la fraude
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-amber-700" />
            <h2 className="text-lg font-semibold text-amber-900">
              Cas particulier&nbsp;: dernier administrateur d'une
              organisation
            </h2>
          </div>
          <p className="text-sm text-amber-900">
            Si vous êtes le seul administrateur actif d'une organisation
            (agence, société), la suppression est refusée pour éviter de
            laisser l'organisation sans responsable. Transférez d'abord
            l'administration à un autre membre, puis renouvelez votre
            demande.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 mb-10">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Délais</h2>
          </div>
          <ul className="list-disc ml-5 text-gray-600 space-y-1 text-sm">
            <li>
              Suppression déclenchée depuis l'application&nbsp;: effet
              immédiat sur votre profil et vos sessions.
            </li>
            <li>
              Suppression demandée par email&nbsp;: prise en charge sous
              réserve d'une vérification d'identité.
            </li>
            <li>
              Les données conservées pour raisons légales, comptables ou
              contractuelles restent stockées pendant la durée requise
              par les obligations applicables.
            </li>
          </ul>
          <p className="mt-3 text-sm font-medium text-gray-700">
            Revue juridique humaine requise avant de publier une durée chiffrée
            de traitement ou de conservation.
          </p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-slate-50 p-6">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Une question&nbsp;?
            </h2>
          </div>
          <p className="text-sm text-gray-600">
            Écrivez à{' '}
            <a
              href="mailto:support@altitudevision.agency"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              support@altitudevision.agency
            </a>
            . Vous pouvez aussi consulter notre{' '}
            <Link
              href="/politique-confidentialite"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              politique de confidentialité
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
};

export default SupprimerMonCompte;
