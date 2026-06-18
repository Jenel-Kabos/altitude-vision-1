import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, Image,
  TouchableOpacity, StyleSheet,
  FlatList, Dimensions, Alert,
  TextInput, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { colors, typography, spacing } from '../../theme';
import Button from '../../components/ui/Button';

const { width } = Dimensions.get('window');
const DESC_LIMIT = 150;

export default function DetailAnnonceScreen({ route, navigation }) {
  const [annonce, setAnnonce] = useState(route.params.annonce);
  const { user } = useAuth();

  const [photoIndex, setPhotoIndex] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [favori, setFavori] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const galleryRef = useRef(null);

  useEffect(() => {
    const recharger = async () => {
      try {
        const res = await api.get(`/properties/${annonce._id}`);
        const full = res.data?.data?.property || res.data?.property;
        if (full) setAnnonce(full);
      } catch {
        // silencieux — garde l'objet reçu en params si ça échoue
      }
    };
    recharger();
  }, [annonce._id]);

  // ─── Données dérivées (avec fallbacks legacy) ──────────────────
  const photos = annonce.images || annonce.photos || [];
  const prix = annonce.price || annonce.prix || 0;
  const title = annonce.title || annonce.titre || 'Bien immobilier';
  const description = annonce.description || '';

  const transactionRaw =
    annonce.transactionType || annonce.typeTransaction || annonce.type || '';
  const isLocation =
    typeof transactionRaw === 'string' &&
    transactionRaw.toLowerCase() === 'location';

  const district =
    annonce.address?.district ||
    annonce.location?.neighborhood ||
    '';
  const city =
    annonce.address?.city ||
    annonce.location?.city ||
    annonce.city ||
    '';
  const addressText = [district, city].filter(Boolean).join(', ');

  const surface = annonce.surface || annonce.area || 0;
  const bedrooms = annonce.bedrooms || annonce.chambres || 0;
  const livingRooms = annonce.livingRooms || 0;
  const pieces = bedrooms + livingRooms;
  const floor = annonce.floor || annonce.etage || 0;

  const commodites = annonce.amenities || annonce.commodites || [];

  const owner = annonce.owner || annonce.proprietaire || {};
  const ownerName = owner.name || 'Propriétaire';
  const ownerInitial = (ownerName[0] || '?').toUpperCase();
  const ownerIsProprietaire = owner.role === 'Proprietaire';
  const ownerRoleLabel = ownerIsProprietaire ? 'Propriétaire' : (owner.role || 'Agent');

  const reviews = annonce.reviews || annonce.comments || [];

  const needsTruncate = description.length > DESC_LIMIT;
  const descShown = !descExpanded && needsTruncate
    ? description.slice(0, DESC_LIMIT).trim() + '…'
    : description;

  // ─── Handlers (logique existante préservée) ────────────────────
  const envoyerCommentaire = async () => {
    if (!commentaire.trim()) return;
    setEnvoi(true);
    try {
      await api.post(`/properties/${annonce._id}/reviews`, {
        comment: commentaire,
        rating: 5,
      });
      setCommentaire('');
      const res = await api.get(`/properties/${annonce._id}`);
      const full = res.data?.data?.property || res.data?.property;
      if (full) setAnnonce(full);
    } catch (error) {
      Alert.alert('Erreur', "Impossible d'envoyer le commentaire");
    } finally {
      setEnvoi(false);
    }
  };

  const ouvrirChat = async () => {
    try {
      const res = await api.post('/conversations', {
        participantId: annonce.proprietaire?._id || annonce.owner?._id,
        relatedProperty: annonce._id,
      });
      const conversation = res.data?.data?.conversation || res.data?.conversation;
      const contact = {
        _id: annonce.proprietaire?._id || annonce.owner?._id,
        name: annonce.proprietaire?.name || annonce.owner?.name || 'Propriétaire',
      };
      navigation.navigate('Messages', {
        screen: 'Chat',
        params: { conversation, contact },
      });
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Impossible d'ouvrir le chat");
    }
  };

  const demanderVisite = () => {
    Alert.alert(
      'Demander une visite',
      `Voulez-vous visiter :\n"${title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => Alert.alert(
            '✅ Demande envoyée',
            'Un agent vous contactera sous 24h'
          ),
        },
      ],
    );
  };

  const onGalleryScroll = (e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setPhotoIndex(idx);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ─── Galerie ──────────────────────────────────────── */}
        <View style={styles.galleryWrap}>
          {photos.length > 0 ? (
            <>
              <FlatList
                ref={galleryRef}
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={onGalleryScroll}
                renderItem={({ item }) => (
                  <Image
                    source={{ uri: item }}
                    style={styles.galleryImage}
                    resizeMode="cover"
                  />
                )}
                keyExtractor={(_, i) => i.toString()}
              />
              <View style={styles.dotsWrap}>
                {photos.map((_, i) => (
                  <View
                    key={i}
                    style={i === photoIndex ? styles.dotActive : styles.dotInactive}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={styles.placeholderImg}>
              <Ionicons name="home-outline" size={64} color={colors.textMuted} />
            </View>
          )}
        </View>

        {/* ─── Corps avec overlap ──────────────────────────── */}
        <View style={styles.body}>
          {/* Prix + badge type */}
          <View style={styles.priceRow}>
            <Text style={styles.priceText} numberOfLines={1} adjustsFontSizeToFit>
              {prix.toLocaleString('fr-FR')} FCFA{isLocation ? '/mois' : ''}
            </Text>
            <View style={[
              styles.badgeType,
              { backgroundColor: isLocation ? colors.info : colors.success },
            ]}>
              <Text style={styles.badgeTypeText}>
                {isLocation ? 'LOCATION' : 'VENTE'}
              </Text>
            </View>
          </View>

          {/* Titre + adresse */}
          <View style={styles.section}>
            <Text style={styles.titleText}>{title}</Text>
            {addressText ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.addressText}>{addressText}</Text>
              </View>
            ) : null}
          </View>

          {/* Features grid */}
          {(surface > 0 || bedrooms > 0 || pieces > 0 || floor > 0) ? (
            <View style={styles.featuresGrid}>
              {surface > 0 && <FeatureCell icon="resize-outline" value={surface} label="m²" />}
              {bedrooms > 0 && <FeatureCell icon="bed-outline" value={bedrooms} label="Chambres" />}
              {pieces > 0 && <FeatureCell icon="grid-outline" value={pieces} label="Pièces" />}
              {floor > 0 && <FeatureCell icon="layers-outline" value={floor} label="Étage" />}
            </View>
          ) : null}

          {/* Description */}
          {description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descText}>{descShown}</Text>
              {needsTruncate && (
                <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
                  <Text style={styles.lireSuite}>
                    {descExpanded ? 'Réduire' : 'Lire la suite'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Commodités */}
          {commodites.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Commodités</Text>
              <View style={styles.commoditesWrap}>
                {commodites.map((c, i) => (
                  <View key={i} style={styles.commoditeChip}>
                    <Text style={styles.commoditeText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Propriétaire */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Propriétaire</Text>
            <View style={styles.ownerCard}>
              {owner.photo ? (
                <Image source={{ uri: owner.photo }} style={styles.ownerAvatar} />
              ) : (
                <View style={[styles.ownerAvatar, styles.ownerAvatarFallback]}>
                  <Text style={styles.ownerInitial}>{ownerInitial}</Text>
                </View>
              )}
              <View style={styles.ownerInfo}>
                <Text style={styles.ownerName} numberOfLines={1}>{ownerName}</Text>
                <View style={[
                  styles.roleBadge,
                  { backgroundColor: (ownerIsProprietaire ? colors.success : colors.info) + '22' },
                ]}>
                  <Text style={[
                    styles.roleBadgeText,
                    { color: ownerIsProprietaire ? colors.success : colors.info },
                  ]}>
                    {ownerRoleLabel}
                  </Text>
                </View>
              </View>
              <Button
                label="Contacter"
                variant="outline"
                size="sm"
                onPress={ouvrirChat}
              />
            </View>
          </View>

          {/* Commentaires */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Commentaires ({reviews.length})
            </Text>

            {reviews.length === 0 ? (
              <Text style={styles.emptyComments}>
                Soyez le premier à commenter
              </Text>
            ) : (
              <View style={styles.commentsList}>
                {reviews.map((r, i) => {
                  const author = r.user?.name || r.author || 'Anonyme';
                  const text = r.comment || r.text || '';
                  const date = formatDate(r.createdAt);
                  const initial = (author[0] || '?').toUpperCase();
                  return (
                    <View key={r._id || i} style={styles.commentRow}>
                      <View style={styles.commentAvatar}>
                        <Text style={styles.commentInitial}>{initial}</Text>
                      </View>
                      <View style={styles.commentBody}>
                        <View style={styles.commentHeader}>
                          <Text style={styles.commentAuthor}>{author}</Text>
                          {date ? <Text style={styles.commentDate}>{date}</Text> : null}
                        </View>
                        <Text style={styles.commentText}>{text}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.commentInputWrap}>
              <TextInput
                style={styles.commentInput}
                placeholder="Laisser un commentaire…"
                placeholderTextColor={colors.textMuted}
                value={commentaire}
                onChangeText={setCommentaire}
                multiline
              />
              <TouchableOpacity
                onPress={envoyerCommentaire}
                disabled={envoi || !commentaire.trim()}
                style={styles.sendBtn}
                hitSlop={8}
              >
                <Ionicons
                  name="send"
                  size={20}
                  color={
                    envoi || !commentaire.trim()
                      ? colors.textMuted
                      : colors.primary
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* ─── Header flottant ──────────────────────────────── */}
      <SafeAreaView style={styles.headerSafe} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setFavori(!favori)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={favori ? 'heart' : 'heart-outline'}
              size={22}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ─── CTA fixe en bas ──────────────────────────────── */}
      <SafeAreaView style={styles.ctaSafe}>
        <View style={styles.ctaWrap}>
          <TouchableOpacity
            onPress={demanderVisite}
            activeOpacity={0.85}
            style={styles.ctaBtn}
          >
            <Text style={styles.ctaText}>Demander une visite</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

function FeatureCell({ icon, value, label }) {
  return (
    <View style={styles.featureCell}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.featureValue}>{value}</Text>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // ─── Galerie ───
  galleryWrap: {
    width,
    height: 300,
  },
  galleryImage: {
    width,
    height: 300,
  },
  placeholderImg: {
    width,
    height: 300,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsWrap: {
    position: 'absolute',
    bottom: spacing.lg,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF60',
  },

  // ─── Header flottant ───
  headerSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0A0A0A80',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Corps ───
  body: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
    paddingTop: spacing.xl,
  },

  // Prix
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  priceText: {
    ...typography.display,
    color: colors.primary,
    fontWeight: '800',
    flex: 1,
  },
  badgeType: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 8,
  },
  badgeTypeText: {
    ...typography.tiny,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // Sections
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  titleText: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addressText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
  },

  // Features grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  featureCell: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.sm,
    alignItems: 'center',
  },
  featureValue: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  featureLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Description
  descText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  lireSuite: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    marginTop: spacing.sm,
  },

  // Commodités
  commoditesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  commoditeChip: {
    backgroundColor: colors.card,
    borderRadius: 100,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  commoditeText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Propriétaire
  ownerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.md,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  ownerAvatarFallback: {
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInitial: {
    ...typography.h3,
    color: colors.primary,
    fontWeight: '700',
  },
  ownerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  ownerName: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 100,
  },
  roleBadgeText: {
    ...typography.tiny,
    fontWeight: '600',
  },

  // Commentaires
  emptyComments: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.lg,
  },
  commentsList: {
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.cardElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitial: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '700',
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  commentAuthor: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  commentDate: {
    ...typography.tiny,
    color: colors.textMuted,
  },
  commentText: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
  commentInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    maxHeight: 100,
    paddingVertical: spacing.sm,
  },
  sendBtn: {
    padding: spacing.sm,
  },

  // CTA fixe
  ctaSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaWrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  ctaBtn: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 16,
  },
});
