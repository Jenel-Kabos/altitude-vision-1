// STORAGE-LEGACY-1 — taxonomie A–F pure, aucune DB.
const {
  classifyLegacyAsset, isMigratable, publicIdFromUrl, cloudinaryUrl, resourceTypeFromUrl, migrationDecisionFor,
} = require('../services/storage/legacyAssetClassification');

describe('legacyAssetClassification', () => {
  test('E — média public légitime, jamais migré', () => {
    const result = classifyLegacyAsset({ isPublicMedia: true, url: 'https://res.cloudinary.com/x/image/upload/v1/a.jpg' });
    expect(result.classification).toBe('E');
    expect(isMigratable(result.classification)).toBe(false);
  });

  test('A — déjà authenticated', () => {
    const result = classifyLegacyAsset({ alreadyAuthenticated: true, publicId: 'private/x' });
    expect(result.classification).toBe('A');
  });

  test('B — legacy public, publicId fiable, tenant resolved → migratable', () => {
    const result = classifyLegacyAsset({ url: 'https://res.cloudinary.com/x/raw/upload/v1/doc.pdf', tenantResolution: 'resolved' });
    expect(result.classification).toBe('B');
    expect(isMigratable(result.classification)).toBe(true);
  });

  test('C — publicId fiable mais tenant ambiguous → jamais migrable', () => {
    const result = classifyLegacyAsset({ url: 'https://res.cloudinary.com/x/raw/upload/v1/doc.pdf', tenantResolution: 'ambiguous' });
    expect(result.classification).toBe('C');
    expect(isMigratable(result.classification)).toBe(false);
  });

  test('C — publicId fiable mais tenant unresolved → jamais migrable', () => {
    const result = classifyLegacyAsset({ url: 'https://res.cloudinary.com/x/raw/upload/v1/doc.pdf', tenantResolution: 'unresolved' });
    expect(result.classification).toBe('C');
    expect(isMigratable(result.classification)).toBe(false);
  });

  test('D — cloudinary sans publicId exploitable', () => {
    const result = classifyLegacyAsset({ publicId: null, url: null, tenantResolution: 'resolved' });
    expect(['D', 'F']).toContain(result.classification);
  });

  test('F — ressource globale sans attribution possible', () => {
    const result = classifyLegacyAsset({ url: 'https://res.cloudinary.com/x/raw/upload/v1/doc.pdf', tenantResolution: 'global' });
    expect(result.classification).toBe('F');
    expect(isMigratable(result.classification)).toBe(false);
  });

  test('publicIdFromUrl extrait le public_id versionné', () => {
    expect(publicIdFromUrl('https://res.cloudinary.com/x/raw/upload/v123/folder/doc.pdf')).toBe('folder/doc');
  });

  test('cloudinaryUrl rejette une URL non-Cloudinary', () => {
    expect(cloudinaryUrl('https://example.com/a.pdf')).toBe(false);
  });

  // STORAGE-LEGACY-CERT-1 (Phase 4) — les uploads legacy utilisent
  // `resource_type: 'auto'`, jamais un type fixe : la seule source fiable
  // du type réel est l'URL elle-même.
  describe('resourceTypeFromUrl — dérivation depuis l\'URL réellement observée (jamais un défaut supposé)', () => {
    test.each([
      ['https://res.cloudinary.com/demo/image/upload/v1/altitude-vision/photo.jpg', 'image'],
      ['https://res.cloudinary.com/demo/raw/upload/v1/altitude-vision/legacy/quittance.pdf', 'raw'],
      ['https://res.cloudinary.com/demo/video/upload/v1/altitude-vision/legacy/voice-note.mp3', 'video'],
    ])('%s → %s', (url, expected) => {
      expect(resourceTypeFromUrl(url)).toBe(expected);
    });

    test('URL non-Cloudinary → null, jamais une supposition', () => {
      expect(resourceTypeFromUrl('https://example.com/a.pdf')).toBeNull();
      expect(resourceTypeFromUrl(null)).toBeNull();
    });
  });

  describe('migrationDecisionFor — traduction opérationnelle de la taxonomie (Phase 2)', () => {
    test.each([
      ['A', 'PUBLIC-NO-ACTION'],
      ['B', 'AUTO-MIGRABLE'],
      ['C', 'MANUAL-REVIEW'],
      ['D', 'MANUAL-REVIEW'],
      ['E', 'PUBLIC-NO-ACTION'],
      ['F', 'BLOCKED'],
    ])('classification %s → %s', (classification, expected) => {
      expect(migrationDecisionFor(classification)).toBe(expected);
    });

    test('classification inconnue → BLOCKED par défaut, jamais AUTO-MIGRABLE', () => {
      expect(migrationDecisionFor('Z')).toBe('BLOCKED');
      expect(migrationDecisionFor(undefined)).toBe('BLOCKED');
    });
  });
});
