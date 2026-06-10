const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

// ── Constantes ────────────────────────────────────────────────
const MARGIN       = 50;
const PAGE_W       = 595.28;
const CONTENT_W    = PAGE_W - 2 * MARGIN;
const BLUE         = '#2E7BB5';
const DARK         = '#1a1a1a';
const GRAY         = '#6b7280';
const LIGHT_GRAY   = '#f3f4f6';
const LOGO_PATH    = path.join(__dirname, '../assets/logo.png');

const MOIS_FR = [
  'janvier','février','mars','avril','mai','juin',
  'juillet','août','septembre','octobre','novembre','décembre',
];

const fmt = (n) =>
  n != null ? Number(n).toLocaleString('fr-FR') + ' FCFA' : '—';

const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, '0')} ${MOIS_FR[date.getMonth()]} ${date.getFullYear()}`;
};

const fmtMois = (mois, annee) =>
  mois ? `${MOIS_FR[mois - 1]} ${annee}` : '—';

// ── Helper : convertit un PDFDocument en Buffer ───────────────
const pdfToBuffer = (doc) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });

// ── Helper : crée un nouveau document A4 ─────────────────────
const newDoc = () =>
  new PDFDocument({ size: 'A4', margin: MARGIN, bufferPages: true });

// ── En-tête commun ────────────────────────────────────────────
const addHeader = (doc, title, subtitle = '') => {
  const hasLogo = fs.existsSync(LOGO_PATH);
  if (hasLogo) {
    doc.image(LOGO_PATH, MARGIN, MARGIN, { width: 80 });
    doc.moveDown(0.5);
  } else {
    doc.font('Helvetica-Bold').fontSize(14).fillColor(BLUE)
      .text('ALTITUDE VISION', MARGIN, MARGIN);
    doc.font('Helvetica').fontSize(9).fillColor(GRAY)
      .text('altitudevision.agency');
    doc.moveDown(0.5);
  }

  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y)
    .strokeColor(BLUE).lineWidth(1.5).stroke();
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(16).fillColor(DARK)
    .text(title, { align: 'center' });

  if (subtitle) {
    doc.font('Helvetica').fontSize(10).fillColor(GRAY)
      .text(subtitle, { align: 'center' });
  }
  doc.moveDown(1);
};

// ── Pied de page commun ───────────────────────────────────────
const addFooter = (doc) => {
  const y = doc.page.height - MARGIN - 30;
  doc.moveTo(MARGIN, y).lineTo(PAGE_W - MARGIN, y)
    .strokeColor(GRAY).lineWidth(0.5).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(GRAY)
    .text(
      'Altitude Vision — Altimmo | altitudevision.agency | contact@altitudevision.agency',
      MARGIN, y + 6, { align: 'center', width: CONTENT_W },
    );
};

// ── Ligne d'info (label: valeur) ──────────────────────────────
const infoLine = (doc, label, value) => {
  doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
    .text(`${label} :`, { continued: true });
  doc.font('Helvetica').fillColor(DARK)
    .text(`  ${value || '—'}`);
};

// ── Titre de section ──────────────────────────────────────────
const sectionTitle = (doc, text) => {
  doc.moveDown(0.5);
  doc.rect(MARGIN, doc.y, CONTENT_W, 18).fill(BLUE);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff')
    .text(text, MARGIN + 6, doc.y - 14, { width: CONTENT_W - 12 });
  doc.moveDown(0.8);
};

// ── Article de contrat ────────────────────────────────────────
const articleTitle = (doc, text) => {
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(BLUE).text(text);
  doc.moveDown(0.2);
};

const articleBody = (doc, text) => {
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(text, { lineGap: 3 });
};

// ── Bloc de signature ─────────────────────────────────────────
const addSignatureBlock = (doc, signataires) => {
  doc.moveDown(2);
  const colW = CONTENT_W / signataires.length;
  signataires.forEach((s, i) => {
    const x = MARGIN + i * colW;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
      .text(s.label, x, doc.y, { width: colW - 10 });
    doc.font('Helvetica').fontSize(10).fillColor(DARK)
      .text(s.nom, x, doc.y + 2, { width: colW - 10 });
    doc.moveDown(2);
    doc.moveTo(x, doc.y).lineTo(x + colW - 20, doc.y)
      .strokeColor(DARK).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(9).fillColor(GRAY)
      .text('Signature', x, doc.y + 4, { width: colW - 10 });
  });
};

// ═════════════════════════════════════════════════════════════
// 1. CONTRAT DE BAIL
// ═════════════════════════════════════════════════════════════
const generateContratBail = async ({ contrat, proprietaire, locataire }) => {
  const doc = newDoc();

  addHeader(
    doc,
    'CONTRAT DE BAIL D\'HABITATION',
    `Numéro de contrat : #${String(contrat._id).slice(-8).toUpperCase()} | Généré le ${fmtDate(new Date())}`,
  );

  // ── PARTIES ───────────────────────────────────────────────
  sectionTitle(doc, 'ENTRE LES SOUSSIGNÉS');

  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
    .text('LE BAILLEUR :');
  doc.moveDown(0.2);
  infoLine(doc, 'Nom complet', `${proprietaire?.prenom || ''} ${proprietaire?.nom || ''}`.trim());
  infoLine(doc, 'Adresse',     proprietaire?.adresse || '—');
  infoLine(doc, 'Téléphone',   proprietaire?.telephone || '—');
  infoLine(doc, 'Email',       proprietaire?.email || '—');
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
    .text('LE LOCATAIRE :');
  doc.moveDown(0.2);
  infoLine(doc, 'Nom complet', `${locataire?.prenom || ''} ${locataire?.nom || ''}`.trim());
  infoLine(doc, 'Adresse',     locataire?.adresse || '—');
  infoLine(doc, 'Téléphone',   locataire?.telephone || '—');
  infoLine(doc, 'Email',       locataire?.email || '—');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
    .text('IL A ÉTÉ CONVENU CE QUI SUIT :');
  doc.moveDown(0.6);

  // ── ARTICLES ──────────────────────────────────────────────
  articleTitle(doc, 'Article 1 — OBJET DU BAIL');
  articleBody(
    doc,
    `Le bailleur loue au locataire le bien immobilier situé au ${contrat.adresseBien || '—'}, ` +
    `${contrat.villeBien || ''}`.trim() + '.',
  );

  articleTitle(doc, 'Article 2 — DURÉE');
  articleBody(
    doc,
    `Le présent bail est consenti pour une durée déterminée, prenant effet le ` +
    `${fmtDate(contrat.dateEntree)} et se terminant le ${fmtDate(contrat.dateFinBail)}.`,
  );

  articleTitle(doc, 'Article 3 — LOYER');
  const charges = contrat.chargesIncluses && contrat.montantCharges
    ? `Charges : ${fmt(contrat.montantCharges)}/mois (incluses dans le loyer).`
    : 'Charges non incluses dans le loyer.';
  articleBody(
    doc,
    `Le loyer mensuel est fixé à ${fmt(contrat.montantLoyer)}, payable le 1er de chaque mois.\n${charges}`,
  );

  articleTitle(doc, 'Article 4 — DÉPÔT DE GARANTIE');
  articleBody(
    doc,
    contrat.montantCaution
      ? `Un dépôt de garantie de ${fmt(contrat.montantCaution)} a été versé à la signature du présent bail.`
      : 'Aucun dépôt de garantie n\'est exigé pour ce bail.',
  );

  articleTitle(doc, 'Article 5 — PÉNALITÉS DE RETARD');
  articleBody(
    doc,
    'Tout loyer non réglé avant le 6 du mois courant fera l\'objet d\'une pénalité de 3 % du ' +
    'montant du loyer, conformément aux conditions du présent bail.',
  );

  articleTitle(doc, 'Article 6 — RÉSILIATION');
  articleBody(
    doc,
    `Le locataire devra respecter un préavis de ${contrat.dureePreavis || 1} mois avant tout départ. ` +
    'Le bailleur devra respecter les délais légaux en vigueur.',
  );

  if (contrat.notes) {
    articleTitle(doc, 'Article 7 — DISPOSITIONS PARTICULIÈRES');
    articleBody(doc, contrat.notes);
  }

  addSignatureBlock(doc, [
    { label: 'Le Bailleur',   nom: `${proprietaire?.prenom || ''} ${proprietaire?.nom || ''}`.trim() },
    { label: 'Le Locataire',  nom: `${locataire?.prenom || ''} ${locataire?.nom || ''}`.trim() },
  ]);

  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(`Date : ${fmtDate(new Date())}`, { align: 'center' });

  addFooter(doc);
  return pdfToBuffer(doc);
};

// ═════════════════════════════════════════════════════════════
// 2. QUITTANCE DE LOYER
// ═════════════════════════════════════════════════════════════
const generateQuittanceLoyer = async ({ paiement, contrat, proprietaire, locataire }) => {
  const doc = newDoc();

  addHeader(
    doc,
    'QUITTANCE DE LOYER',
    fmtMois(paiement.mois, paiement.annee),
  );

  doc.font('Helvetica').fontSize(11).fillColor(DARK).moveDown(0.5)
    .text(
      `Je soussigné(e) ${proprietaire?.prenom || ''} ${proprietaire?.nom || ''}, ` +
      `propriétaire du bien situé au ${contrat.adresseBien || '—'},`,
    );
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(12).fillColor(DARK)
    .text('donne quittance à');
  doc.font('Helvetica').fontSize(11).fillColor(DARK)
    .text(
      `${locataire?.prenom || ''} ${locataire?.nom || ''} ` +
      `du paiement du loyer du mois de ${fmtMois(paiement.mois, paiement.annee)}.`,
    );

  doc.moveDown(1.2);
  sectionTitle(doc, 'DÉTAIL DU PAIEMENT');

  const rows = [
    ['Montant du loyer',     fmt(paiement.montant)],
    ...(contrat.montantCharges ? [['Charges', fmt(contrat.montantCharges)]] : []),
    ...(paiement.penaliteAppliquee ? [['Pénalité de retard (3%)', fmt(paiement.penaliteMontant)]] : []),
    ['TOTAL REÇU',           fmt(paiement.montantRecu || paiement.montantTotal || paiement.montant)],
  ];

  const col1W = 220;
  const col2W = CONTENT_W - col1W;
  let y = doc.y;

  rows.forEach((row, i) => {
    const isLast = i === rows.length - 1;
    doc.rect(MARGIN, y, col1W, 22).strokeColor(GRAY).lineWidth(0.5).stroke();
    doc.rect(MARGIN + col1W, y, col2W, 22).stroke();
    if (isLast) {
      doc.rect(MARGIN, y, col1W + col2W, 22).fill(BLUE);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#fff')
        .text(row[0], MARGIN + 6, y + 6, { width: col1W - 10 });
      doc.text(row[1], MARGIN + col1W + 6, y + 6, { width: col2W - 10 });
    } else {
      doc.font(isLast ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(DARK)
        .text(row[0], MARGIN + 6, y + 6, { width: col1W - 10 });
      doc.text(row[1], MARGIN + col1W + 6, y + 6, { width: col2W - 10 });
    }
    y += 22;
  });

  doc.y = y;
  doc.moveDown(1);

  infoLine(doc, 'Mode de paiement', paiement.modePaiement || '—');
  infoLine(doc, 'Date de paiement', fmtDate(paiement.datePaiement));
  if (paiement.reference) infoLine(doc, 'Référence', paiement.reference);

  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(`Fait à Brazzaville, le ${fmtDate(new Date())}`);

  addSignatureBlock(doc, [
    { label: 'Signature du bailleur', nom: `${proprietaire?.prenom || ''} ${proprietaire?.nom || ''}`.trim() },
  ]);

  addFooter(doc);
  return pdfToBuffer(doc);
};

// ═════════════════════════════════════════════════════════════
// 3. MISE EN DEMEURE
// ═════════════════════════════════════════════════════════════
const generateMiseEnDemeure = async ({ paiement, contrat, locataire }) => {
  const doc = newDoc();

  addHeader(doc, 'MISE EN DEMEURE');

  doc.font('Helvetica').fontSize(11).fillColor(DARK)
    .text(`À ${locataire?.prenom || ''} ${locataire?.nom || ''}`)
    .text(`Adresse : ${locataire?.adresse || '—'}`)
    .text(`Email : ${locataire?.email || '—'}`);
  doc.moveDown(1);

  doc.font('Helvetica').fontSize(11).fillColor(DARK)
    .text(
      `Par la présente, nous vous mettons en demeure de régler dans un délai de 8 jours la somme de ` +
      `${fmt(paiement.montantTotal || paiement.montant)} correspondant au loyer du mois de ` +
      `${fmtMois(paiement.mois, paiement.annee)}, concernant le bien situé au ${contrat.adresseBien || '—'}.`,
      { lineGap: 4 },
    );

  doc.moveDown(1);
  sectionTitle(doc, 'DÉTAIL DE LA SOMME DUE');

  const rows = [
    ['Loyer mensuel',          fmt(paiement.montant)],
    ...(paiement.penaliteAppliquee ? [['Pénalité de retard (3%)', fmt(paiement.penaliteMontant)]] : []),
    ['TOTAL DÛ',               fmt(paiement.montantTotal || paiement.montant)],
    ['Retard',                 `${paiement.retardJours || 0} jour(s)`],
  ];

  let y = doc.y;
  const col1W = 240;
  const col2W = CONTENT_W - col1W;

  rows.forEach((row, i) => {
    const isTotal = row[0].startsWith('TOTAL');
    doc.rect(MARGIN, y, col1W, 22).strokeColor(GRAY).lineWidth(0.5).stroke();
    doc.rect(MARGIN + col1W, y, col2W, 22).stroke();
    if (isTotal) {
      doc.rect(MARGIN, y, col1W + col2W, 22).fill('#FEF3C7');
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#92400E')
        .text(row[0], MARGIN + 6, y + 6, { width: col1W - 10 });
      doc.text(row[1], MARGIN + col1W + 6, y + 6, { width: col2W - 10 });
    } else {
      doc.font('Helvetica').fontSize(10).fillColor(DARK)
        .text(row[0], MARGIN + 6, y + 6, { width: col1W - 10 });
      doc.text(row[1], MARGIN + col1W + 6, y + 6, { width: col2W - 10 });
    }
    y += 22;
  });

  doc.y = y;
  doc.moveDown(1.2);

  doc.font('Helvetica').fontSize(11).fillColor(DARK)
    .text(
      'À défaut de règlement dans ce délai de 8 jours à compter de la réception de la présente, ' +
      'nous nous verrons contraints d\'engager toute procédure légale nécessaire au recouvrement ' +
      'de cette somme.',
      { lineGap: 4 },
    );

  doc.moveDown(1.5);
  doc.text(`Fait à Brazzaville, le ${fmtDate(new Date())}`);
  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').text('Pour Altitude Vision — Altimmo');

  addSignatureBlock(doc, [{ label: 'Le Représentant légal', nom: 'Altitude Vision' }]);
  addFooter(doc);
  return pdfToBuffer(doc);
};

// ═════════════════════════════════════════════════════════════
// 4. LETTRE DE PRÉAVIS
// ═════════════════════════════════════════════════════════════
const generatePreavis = async ({ contrat, proprietaire, locataire }, typeInitiateur) => {
  const doc = newDoc();

  addHeader(doc, 'LETTRE DE PRÉAVIS');

  const duree = contrat.dureePreavis || 1;
  const dateRef = new Date();
  const dateSortie = new Date(dateRef);
  dateSortie.setMonth(dateSortie.getMonth() + duree);

  if (typeInitiateur === 'locataire') {
    doc.font('Helvetica').fontSize(11).fillColor(DARK)
      .text(
        `Je soussigné(e) ${locataire?.prenom || ''} ${locataire?.nom || ''}, locataire du bien situé ` +
        `au ${contrat.adresseBien || '—'}, vous informe de ma décision de quitter ce logement ` +
        `à l'expiration d'un délai de ${duree} mois, soit le ${fmtDate(dateSortie)}.`,
        { lineGap: 5 },
      );
    doc.moveDown(1);
    doc.text(
      'Je m\'engage à libérer les lieux dans l\'état dans lequel je les ai reçus, sous réserve de ' +
      'l\'usure normale.',
    );
    addSignatureBlock(doc, [
      { label: 'Le Locataire', nom: `${locataire?.prenom || ''} ${locataire?.nom || ''}`.trim() },
    ]);
  } else {
    doc.font('Helvetica').fontSize(11).fillColor(DARK)
      .text(`À ${locataire?.prenom || ''} ${locataire?.nom || ''}`);
    doc.moveDown(0.5);
    doc.text(
      `Nous vous informons que le bail concernant le logement situé au ${contrat.adresseBien || '—'} ` +
      `prendra fin le ${fmtDate(contrat.dateFinBail)}. ` +
      `Vous devrez libérer les lieux au plus tard le ${fmtDate(contrat.dateFinBail)}, ` +
      `dans l'état dans lequel vous les avez reçus.`,
      { lineGap: 5 },
    );
    addSignatureBlock(doc, [
      { label: 'Le Bailleur', nom: `${proprietaire?.prenom || ''} ${proprietaire?.nom || ''}`.trim() },
    ]);
  }

  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(`Fait à Brazzaville, le ${fmtDate(new Date())}`, { align: 'right' });

  addFooter(doc);
  return pdfToBuffer(doc);
};

// ═════════════════════════════════════════════════════════════
// 5. ÉTAT DES LIEUX
// ═════════════════════════════════════════════════════════════
const generateEtatDesLieux = async ({ contrat, proprietaire, locataire }, etatDesLieux) => {
  const doc = newDoc();
  const typeLabel = etatDesLieux.type === 'entree' ? 'ENTRÉE' : 'SORTIE';

  addHeader(doc, `ÉTAT DES LIEUX D'${typeLabel}`, fmtDate(etatDesLieux.date || new Date()));

  sectionTitle(doc, 'INFORMATIONS GÉNÉRALES');
  infoLine(doc, 'Bien',          contrat.adresseBien || '—');
  infoLine(doc, 'Propriétaire',  `${proprietaire?.prenom || ''} ${proprietaire?.nom || ''}`.trim());
  infoLine(doc, 'Locataire',     `${locataire?.prenom || ''} ${locataire?.nom || ''}`.trim());
  infoLine(doc, 'Date',          fmtDate(etatDesLieux.date || new Date()));
  doc.moveDown(0.8);

  // Chercher l'état d'entrée si on génère l'état de sortie (pour comparaison)
  const etats = contrat.etatsDesLieux || [];
  const entree = etatDesLieux.type === 'sortie' ? etats.find(e => e.type === 'entree') : null;
  const compareMode = !!entree;

  sectionTitle(doc, 'ÉTAT DES PIÈCES');

  const pieces = etatDesLieux.pieces || [];
  if (pieces.length === 0) {
    doc.font('Helvetica').fontSize(10).fillColor(GRAY).text('Aucune pièce enregistrée.');
  } else {
    const colW = compareMode
      ? [CONTENT_W * 0.25, CONTENT_W * 0.2, CONTENT_W * 0.2, CONTENT_W * 0.2, CONTENT_W * 0.15]
      : [CONTENT_W * 0.3, CONTENT_W * 0.25, CONTENT_W * 0.45];

    const headers = compareMode
      ? ['Pièce', 'État Entrée', 'État Sortie', 'Observations', 'Écart']
      : ['Pièce', 'État', 'Observations'];

    let y = doc.y;
    const ROW_H = 22;

    // En-tête du tableau
    let x = MARGIN;
    doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(LIGHT_GRAY);
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK)
        .text(h, x + 4, y + 6, { width: colW[i] - 8 });
      x += colW[i];
    });
    y += ROW_H;

    // Lignes
    pieces.forEach((piece) => {
      const entreePiece = entree?.pieces?.find((p) => p.nom === piece.nom);
      const ecart = entree && entreePiece
        ? entreePiece.etat !== piece.etat ? '⚠ Diff.' : 'OK'
        : '';

      const rowData = compareMode
        ? [piece.nom, entreePiece?.etat || '—', piece.etat || '—', piece.observations || '', ecart]
        : [piece.nom, piece.etat || '—', piece.observations || ''];

      x = MARGIN;
      const rowColor = ecart === '⚠ Diff.' ? '#FEF3C7' : '#ffffff';
      doc.rect(MARGIN, y, CONTENT_W, ROW_H).fill(rowColor).stroke();
      rowData.forEach((cell, i) => {
        doc.font('Helvetica').fontSize(9).fillColor(DARK)
          .text(cell, x + 4, y + 6, { width: colW[i] - 8, ellipsis: true });
        x += colW[i];
      });
      y += ROW_H;
    });

    doc.y = y;
  }

  doc.moveDown(1.5);
  addSignatureBlock(doc, [
    { label: 'Le Propriétaire', nom: `${proprietaire?.prenom || ''} ${proprietaire?.nom || ''}`.trim() },
    { label: 'Le Locataire',    nom: `${locataire?.prenom || ''} ${locataire?.nom || ''}`.trim() },
  ]);

  addFooter(doc);
  return pdfToBuffer(doc);
};

// ═════════════════════════════════════════════════════════════
// 6. CONTRAT D'HÉBERGEMENT PROPRIÉTAIRE
// ═════════════════════════════════════════════════════════════
const generateContratHebergement = async (user) => {
  const doc = newDoc();
  const now = user.contratAccepteLe ? new Date(user.contratAccepteLe) : new Date();
  const ref = `CONTRAT-${String(user._id).slice(-8).toUpperCase()}-v1.0`;

  addHeader(
    doc,
    "CONTRAT D'HÉBERGEMENT DE BIEN IMMOBILIER",
    `Référence : ${ref} | Signé le ${fmtDate(now)}`,
  );

  sectionTitle(doc, 'ENTRE LES SOUSSIGNÉS');

  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text("ALTITUDE VISION (L'AGENCE) :");
  doc.moveDown(0.2);
  infoLine(doc, 'Dénomination', 'Altitude Vision — Altimmo');
  infoLine(doc, 'Siège social',  'Rue Mfoa n°24, Poto-Poto, Brazzaville, Congo');
  infoLine(doc, 'Contact',       'contact@altitudevision.agency | +242 06 800 21 51');
  doc.moveDown(0.8);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK).text('LE PROPRIÉTAIRE (LE MANDANT) :');
  doc.moveDown(0.2);
  infoLine(doc, 'Nom complet', user.name  || '—');
  infoLine(doc, 'Email',       user.email || '—');
  infoLine(doc, 'Téléphone',   user.phone || '—');
  infoLine(doc, 'ID de compte', String(user._id));
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(DARK)
    .text('IL A ÉTÉ CONVENU CE QUI SUIT :');
  doc.moveDown(0.6);

  articleTitle(doc, 'Article 1 — OBJET DU CONTRAT');
  articleBody(doc,
    "Le présent contrat a pour objet de définir les conditions dans lesquelles le Mandant confie à " +
    "Altitude Vision le mandat de gérer la mise en location de son (ses) bien(s) immobilier(s) via la " +
    "plateforme altitudevision.agency/altimmo.",
  );

  articleTitle(doc, 'Article 2 — DURÉE DU CONTRAT');
  articleBody(doc,
    "Le présent contrat prend effet à la date d'acceptation en ligne par le Mandant et est conclu pour " +
    "une durée indéterminée. Il peut être résilié par chacune des parties avec un préavis de 30 jours " +
    "adressé par email.",
  );

  articleTitle(doc, "Article 3 — OBLIGATIONS DE L'AGENCE");
  articleBody(doc,
    "Altitude Vision s'engage à :\n" +
    "• Publier les annonces du Mandant sur la plateforme Altimmo\n" +
    "• Assurer la mise en relation avec les locataires potentiels\n" +
    "• Percevoir la commission locataire et reverser la part du Mandant\n" +
    "• Assurer le suivi des dossiers de location",
  );

  articleTitle(doc, 'Article 4 — OBLIGATIONS DU MANDANT');
  articleBody(doc,
    "Le Mandant s'engage à :\n" +
    "• Fournir des informations exactes et conformes à la réalité concernant son(ses) bien(s)\n" +
    "• Être le propriétaire légal ou avoir mandat du propriétaire légal\n" +
    "• Informer l'Agence de tout changement affectant la disponibilité du bien\n" +
    "• Ne pas contourner l'Agence en concluant directement avec un locataire présenté",
  );

  articleTitle(doc, 'Article 5 — CONDITIONS DE RÉMUNÉRATION');
  articleBody(doc,
    "Pour chaque location conclue via la plateforme :\n" +
    "• L'Agence perçoit une commission équivalente à 80 % du premier loyer mensuel\n" +
    "• Le Mandant reçoit 30 % de cette commission, soit 24 % du premier loyer\n" +
    "• Exemple : pour un loyer de 150 000 FCFA → part Mandant = 36 000 FCFA",
  );

  articleTitle(doc, 'Article 6 — CONFIDENTIALITÉ');
  articleBody(doc,
    "Les parties s'engagent à préserver la confidentialité des informations échangées dans le cadre du " +
    "présent contrat. Les données personnelles sont traitées conformément à la réglementation en vigueur.",
  );

  articleTitle(doc, 'Article 7 — RÉSOLUTION DES LITIGES');
  articleBody(doc,
    "En cas de litige, les parties s'engagent à rechercher une solution amiable. À défaut d'accord " +
    "dans un délai de 30 jours, le différend sera soumis au tribunal compétent de Brazzaville, " +
    "République du Congo.",
  );

  articleTitle(doc, 'Article 8 — DISPOSITIONS GÉNÉRALES');
  articleBody(doc,
    "Le présent contrat est régi par le droit congolais. Toute modification doit faire l'objet d'un " +
    "avenant écrit signé par les deux parties. La nullité d'une clause n'entraîne pas la nullité " +
    "du contrat dans son ensemble.",
  );

  sectionTitle(doc, 'ACCEPTATION NUMÉRIQUE');

  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(
      `Le Mandant a accepté les termes du présent contrat le ${fmtDate(now)} ` +
      `à ${now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (heure locale).`,
      { lineGap: 3 },
    );
  doc.moveDown(0.5);

  if (user.ipInscription) infoLine(doc, 'Adresse IP de signature', user.ipInscription);
  infoLine(doc, 'Référence contrat', ref);
  infoLine(doc, 'Version', user.contratVersion || 'v1.0');

  const certifLabels = [
    'Les informations fournies sont exactes et conformes',
    'Je suis le propriétaire légal ou mandaté pour agir',
    "Je m'engage à agir avec honnêteté",
    'Les conditions de rémunération sont acceptées',
    "Le contrat d'hébergement est accepté dans son intégralité",
  ];
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK).text('Certifications acceptées :');
  doc.moveDown(0.3);
  certifLabels.forEach(line => {
    doc.font('Helvetica').fontSize(10).fillColor('#16A34A').text(`  ✓ ${line}`);
  });

  addSignatureBlock(doc, [
    { label: 'Le Mandant (signature numérique)', nom: user.name || '—' },
    { label: "L'Agence",                         nom: 'Altitude Vision — Altimmo' },
  ]);

  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
    .text(`Fait à Brazzaville, le ${fmtDate(new Date())}`, { align: 'center' });

  addFooter(doc);
  return pdfToBuffer(doc);
};

module.exports = {
  generateContratBail,
  generateQuittanceLoyer,
  generateMiseEnDemeure,
  generatePreavis,
  generateEtatDesLieux,
  generateContratHebergement,
};
