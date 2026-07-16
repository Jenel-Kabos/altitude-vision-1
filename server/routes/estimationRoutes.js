// server/routes/estimationRoutes.js
const express = require("express");
const router = express.Router();
const sendEmail = require("../utils/email");
const Estimation = require("../models/Estimation");
const auth = require("../controllers/authController");
const { notifyStaff } = require("../services/notificationService");
const { ROLES_ESTIMATION } = require("../utils/roles");
const estimationController = require("../controllers/estimationController");
const { estimationSubmissionLimiter } = require("../middleware/rateLimiters");
const {
  estimationUpload,
  upload,
  uploadToCloudinary,
} = require("../config/cloudinary");
const {
  normalizeEstimationRequest,
  calculateCompleteness,
} = require("../services/estimationRequestNormalizationService");

const staffOnly = [auth.protect, auth.restrictTo(...ROLES_ESTIMATION)];
const valuationManagers = [
  auth.protect,
  auth.restrictTo("Admin", "Collaborateur"),
];
const publicEstimationUpload = estimationUpload || upload;
const publicEstimationFiles = publicEstimationUpload.fields
  ? publicEstimationUpload.fields([
      { name: "photos", maxCount: 5 },
      { name: "documents", maxCount: 3 },
    ])
  : publicEstimationUpload.array("files", 8);

// ── Template email interne (reçu par l'agence) ───────────────
const getEstimationEmailTemplate = (data) => `
<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #1A5A8A, #2E7BB5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">🏠 Nouvelle demande d'estimation</h1>
    <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 13px;">Altimmo — Reçue le ${new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
  </div>

  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">

    <h2 style="color: #1f2937; font-size: 16px; margin-top: 0;">📋 Informations du bien</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; width: 40%; border-bottom: 1px solid #e5e7eb;">Type de bien</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.typeBien}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Transaction</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.transaction === "vente" ? "Vente" : "Location"}</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Adresse / Quartier</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.adresse}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Surface approximative</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.surface} m²</td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Nombre de chambres</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.chambres}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">État du bien</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.etat}</td>
      </tr>
      ${
        data.description
          ? `
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb; vertical-align: top;">Description</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.description}</td>
      </tr>`
          : ""
      }
    </table>

    <h2 style="color: #1f2937; font-size: 16px;">👤 Coordonnées du demandeur</h2>
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; width: 40%; border-bottom: 1px solid #e5e7eb;">Nom complet</td>
        <td style="padding: 10px 14px; color: #6b7280; border-bottom: 1px solid #e5e7eb;">${data.nom}</td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Email</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb;">
          <a href="mailto:${data.email}" style="color: #2563eb;">${data.email}</a>
        </td>
      </tr>
      <tr style="background: #f8fafc;">
        <td style="padding: 10px 14px; font-weight: 600; color: #374151; border-bottom: 1px solid #e5e7eb;">Téléphone</td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb;">
          <a href="tel:${data.telephone}" style="color: #2563eb;">${data.telephone || "Non renseigné"}</a>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #374151;">Disponibilité</td>
        <td style="padding: 10px 14px; color: #6b7280;">${data.disponibilite || "Non précisée"}</td>
      </tr>
    </table>

    <div style="background: #eff6ff; border-left: 4px solid #2E7BB5; padding: 16px; border-radius: 0 8px 8px 0; margin-top: 8px;">
      <p style="margin: 0; color: #1e40af; font-size: 13px; font-weight: 600;">⚡ Action requise</p>
      <p style="margin: 6px 0 0; color: #3b82f6; font-size: 13px;">
        Contacter le client après analyse à : <a href="mailto:${data.email}" style="color: #1d4ed8; font-weight: bold;">${data.email}</a>
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
      Altitude Vision Altimmo — <a href="https://altitudevision.agency/altimmo" style="color: #2563eb;">altitudevision.agency/altimmo</a>
    </p>
  </div>
</div>
`;

// ── Template email de confirmation (envoyé au client) ─────────
const getConfirmationTemplate = (nom) => `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #1A5A8A, #2E7BB5); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 22px;">Altitude Vision</h1>
    <p style="color: #bfdbfe; margin: 8px 0 0; font-size: 13px;">Altimmo — Immobilier de prestige</p>
  </div>
  <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
    <h2 style="color: #1f2937;">Bonjour ${nom} 👋</h2>
    <p style="color: #6b7280; line-height: 1.7;">
      Nous avons bien reçu votre <strong>demande d'estimation gratuite</strong>. 
      Notre équipe Altimmo va analyser votre dossier et vous contactera si des informations ou une visite sont nécessaires.
      avec une estimation personnalisée de votre bien.
    </p>
    <div style="background: #f0f9ff; border-radius: 12px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0; color: #0369a1; font-size: 14px; font-weight: 600;">📞 Besoin d'un retour rapide ?</p>
      <p style="margin: 8px 0 0; color: #0284c7; font-size: 13px;">
        Appelez-nous directement au <strong>+242 06 800 21 51</strong><br/>
        ou via WhatsApp à ce même numéro.
      </p>
    </div>
    <p style="color: #6b7280; font-size: 13px;">L'équipe Altimmo</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 0;">
      Altitude Vision — <a href="https://altitudevision.agency" style="color: #2563eb;">altitudevision.agency</a>
    </p>
  </div>
</div>
`;

// ── POST /api/estimation ──────────────────────────────────────
router.post(
  "/",
  estimationSubmissionLimiter,
  auth.optionalAuth,
  publicEstimationFiles,
  async (req, res) => {
    const agenceEmail =
      process.env.ZOHO_FROM_EMAIL || "support@altitudevision.agency";

    try {
      const raw = req.body.payload ? JSON.parse(req.body.payload) : req.body;
      if (raw.website)
        return res
          .status(200)
          .json({ status: "success", message: "Demande reçue." });
      const normalized = normalizeEstimationRequest(raw, {
        userId: req.user?.id || null,
      });
      const uploadPrivate = async (file, kind) => {
        const result = await uploadToCloudinary(file.buffer, {
          folder: `altitude-vision/estimations/${kind}`,
          resource_type: "auto",
          type: "authenticated",
          access_mode: "authenticated",
        });
        return kind === "photos"
          ? {
              url: result.secure_url,
              publicId: result.public_id,
              label: file.originalname,
              private: true,
            }
          : {
              type: "autre",
              name: file.originalname,
              url: result.secure_url,
              publicId: result.public_id,
              provided: true,
              verified: false,
              private: true,
            };
      };
      const [photos, documents] = await Promise.all([
        Promise.all(
          (req.files?.photos || []).map((file) =>
            uploadPrivate(file, "photos"),
          ),
        ),
        Promise.all(
          (req.files?.documents || []).map((file) =>
            uploadPrivate(file, "documents"),
          ),
        ),
      ]);
      normalized.photos = photos;
      normalized.documents = documents;
      const completeness = calculateCompleteness(normalized);
      normalized.completenessScore = completeness.score;
      normalized.missingInformation = completeness.missingInformation;
      normalized.weakSections = completeness.weakSections;
      const estimation = await Estimation.create(normalized);
      const {
        nom,
        email,
        telephone,
        typeBien,
        transaction,
        adresse,
        surface,
        chambres,
        etat,
        description,
        disponibilite,
      } = normalized;

      // 0️⃣bis Notifier le staff (cloche/liste + push) — best-effort
      notifyStaff({
        type: "estimation_received",
        title: `Nouvelle demande d'estimation de ${nom}`,
        body: `${typeBien} à ${adresse}`,
        data: {
          screen: "Estimations",
          estimationId: estimation._id.toString(),
        },
      }).catch(() => {});

      // Emails best-effort : une panne du fournisseur ne doit pas provoquer une seconde création au retry.
      await Promise.allSettled([sendEmail({
        to: agenceEmail,
        email: agenceEmail,
        subject: `🏠 Nouvelle estimation — ${typeBien} à ${adresse}`,
        html: getEstimationEmailTemplate({
          nom,
          email,
          telephone,
          typeBien,
          transaction,
          adresse,
          surface,
          chambres,
          etat,
          description,
          disponibilite,
        }),
      }),

      // 2️⃣ Email de confirmation → client
      sendEmail({
        to: email,
        email: email,
        subject: "Altimmo — Votre demande d'estimation a bien été reçue",
        html: getConfirmationTemplate(nom),
      })]);

      res.status(200).json({
        status: "success",
        message: "Demande d'estimation envoyée avec succès.",
        data: {
          reference:
            estimation.referenceBien ||
            String(estimation._id).slice(-8).toUpperCase(),
          estimationId: estimation._id,
          statut: estimation.statut,
          completenessScore: estimation.completenessScore,
        },
      });
    } catch (err) {
      console.error("❌ [Estimation] Erreur soumission:", err.message);
      res
        .status(
          err instanceof SyntaxError ||
            /obligatoires|invalide/i.test(err.message)
            ? 400
            : 500,
        )
        .json({
          status: "error",
          message:
            "Erreur lors de l'envoi de votre demande. Veuillez réessayer.",
        });
    }
  },
);

// ── GET /api/estimation — liste toutes les demandes (Admin/Collaborateur) ────
router.get("/", staffOnly, async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 50),
    );
    const estimations = await Estimation.find()
      .populate("traitePar", "name")
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(limit);
    await Estimation.updateMany(
      {
        _id: { $in: estimations.map((item) => item._id) },
        staffViewedAt: null,
      },
      { $set: { staffViewedAt: new Date() } },
    );
    const total = await Estimation.countDocuments();

    res.status(200).json({
      status: "success",
      results: estimations.length,
      data: {
        estimations,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      },
    });
  } catch (err) {
    console.error("❌ [Estimation] Erreur récupération liste:", err.message);
    res
      .status(500)
      .json({
        status: "error",
        message: "Erreur lors de la récupération des demandes.",
      });
  }
});

router.get(
  "/unread-count",
  staffOnly,
  estimationController.getUnreadEstimationCount,
);

// Le laboratoire conserve les anciennes routes et isole ses règles métier dans le contrôleur/service.
router.get("/reports/verify/:code", estimationController.verifyReport);
router.get(
  "/analytics/market-history",
  staffOnly,
  estimationController.getMarketHistory,
);
router.get(
  "/analytics/statistics",
  staffOnly,
  estimationController.getLaboratoryStatistics,
);
router.post("/compare", staffOnly, estimationController.compareEstimations);
router.get("/references", staffOnly, estimationController.listMarketReferences);
router.post(
  "/references",
  valuationManagers,
  estimationController.createMarketReference,
);
router.patch(
  "/references/:id",
  valuationManagers,
  estimationController.updateMarketReference,
);
router.post(
  "/references/:id/deactivate",
  valuationManagers,
  estimationController.deactivateMarketReference,
);
router.get(
  "/construction-costs",
  staffOnly,
  estimationController.listConstructionCosts,
);
router.post(
  "/construction-costs",
  valuationManagers,
  estimationController.createConstructionCost,
);
router.patch(
  "/construction-costs/:id",
  valuationManagers,
  estimationController.updateConstructionCost,
);
router.get("/coefficients", staffOnly, estimationController.listCoefficients);
router.post(
  "/coefficients",
  valuationManagers,
  estimationController.createCoefficient,
);
router.patch(
  "/coefficients/:id",
  valuationManagers,
  estimationController.updateCoefficient,
);
router.get(
  "/:id/calculations",
  staffOnly,
  estimationController.getCalculations,
);
router.get(
  "/:id/expert-analysis",
  staffOnly,
  estimationController.getExpertAnalysis,
);
router.get(
  "/:id/internal-comparables",
  staffOnly,
  estimationController.searchInternalComparables,
);
router.post(
  "/:id/internal-comparables",
  staffOnly,
  estimationController.addInternalComparable,
);
router.patch(
  "/:id/comparables/:comparableId",
  staffOnly,
  estimationController.updateComparable,
);
router.delete(
  "/:id/comparables/:comparableId",
  staffOnly,
  estimationController.deleteComparable,
);
router.post(
  "/:id/comparables/score",
  staffOnly,
  estimationController.scoreComparable,
);
router.post(
  "/:id/calculate",
  staffOnly,
  estimationController.calculateEstimation,
);
router.post(
  "/:id/adjust-value",
  valuationManagers,
  estimationController.adjustExpertValue,
);
router.post(
  "/:id/validate",
  valuationManagers,
  estimationController.validateEstimation,
);
router.post(
  "/:id/publish",
  valuationManagers,
  estimationController.publishEstimation,
);
router.get(
  "/:id/report/html",
  staffOnly,
  estimationController.renderReportHtml,
);
router.get(
  "/:id/report/pdf",
  staffOnly,
  estimationController.downloadReportPdf,
);
router.get("/:id", staffOnly, estimationController.getEstimation);

// ── PATCH /api/estimation/:id — met à jour statut + noteInterne (Admin/Collaborateur) ──
router.patch("/:id", staffOnly, estimationController.updateEstimation);

module.exports = router;
