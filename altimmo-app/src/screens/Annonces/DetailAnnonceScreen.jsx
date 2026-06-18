import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Image,
  TouchableOpacity, StyleSheet,
  FlatList, Dimensions, Alert,
  TextInput, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Screen, Card, Button, PrixFCFA } from '../../components';
import { colors, fonts, fontSize, spacing, radius } from '../../theme';

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
  const addressText = [district, city].filter(Boolean).join(' · ');

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
      'Prendre rendez-vous',
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
      <Screen scroll style={styles.scrollContent}>
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

        {/* ─── Corps ─────────────────────────────────────────── */}
        <View style={styles.body}>
          {/* Prix + statut transaction */}
          <View style={styles.priceRow}>
            <View style={styles.priceWrap}>
              <PrixFCFA montant={prix} style={styles.priceFlex} />
              {isLocation ? (
                <Text style={styles.priceMois}> /mois</Text>
              ) : null}
            </View>
            <Text style={styles.statusLabel}>
              {isLocation ? 'LOCATION' : 'VENTE'}
            </Text>
          </View>

          {/* Titre + adresse */}
          <View style={styles.section}>
            <Text style={styles.titleText}>{title}</Text>
            {addressText ? (
              <Text style={styles.addressText}>{addressText}</Text>
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
            <Card>
              <View style={styles.ownerInner}>
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
                    { borderColor: ownerIsProprietaire ? colors.gold : colors.border },
                  ]}>
                    <Text style={[
                      styles.roleBadgeText,
                      { color: ownerIsProprietaire ? colors.gold : colors.textSub },
                    ]}>
                      {ownerRoleLabel.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Button
                  label="Échanger"
                  variant="outline"
                  onPress={ouvrirChat}
                />
              </View>
            </Card>
          </View>

          {/* Commentaires */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Commentaires ({reviews.length})
            </Text>

            {reviews.length === 0 ? (
              <Text style={styles.emptyComments}>
                Aucun commentaire pour ce bien.
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
                      : colors.gold
                  }
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Screen>

      {/* ─── Header flottant ──────────────────────────────── */}
      <SafeAreaView style={styles.headerSafe} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setFavori(!favori)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={favori ? 'heart' : 'heart-outline'}
              size={22}
              color={colors.gold}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ─── CTA fixe en bas ──────────────────────────────── */}
      <SafeAreaView style={styles.ctaSafe}>
        <View style={styles.ctaWrap}>
          <Button
            label="Prendre rendez-vous"
            variant="primary"
            onPress={demanderVisite}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function FeatureCell({ icon, value, label }) {
  return (
    <View style={styles.featureCell}>
      <Ionicons name={icon} size={20} color={colors.gold} />
      <Text style={styles.featureValue}>{value}</Text>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    // TODO: ajuster si tab bar overlap
    padding: 0,
    paddingBottom: spacing.xxxl,
  },

  // ─── Galerie ───
  galleryWrap: {
    width,
    height: 320,
  },
  galleryImage: {
    width,
    height: 320,
    borderRadius: radius.none,
  },
  placeholderImg: {
    width,
    height: 320,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsWrap: {
    position: 'absolute',
    bottom: spacing.md,
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
    backgroundColor: colors.gold,
  },
  dotInactive: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Corps (sans overlap, sans radius) ───
  body: {
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
  },

  // ─── Prix + statut ───
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  priceWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
  },
  priceFlex: {
    flexShrink: 1,
  },
  priceMois: {
    fontFamily: fonts.bodyItalic,
    fontSize: fontSize.xs,
    color: colors.textSub,
  },
  statusLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
    letterSpacing: 1,
  },

  // ─── Sections ───
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  titleText: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  addressText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textMuted,
  },

  // ─── Features grid ───
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  featureCell: {
    flexBasis: '30%',
    flexGrow: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.none,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
  },
  featureValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
    marginTop: spacing.xs,
  },
  featureLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },

  // ─── Description ───
  descText: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.textSub,
    lineHeight: 22,
  },
  lireSuite: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
    marginTop: spacing.sm,
  },

  // ─── Commodités ───
  commoditesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  commoditeChip: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  commoditeText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: colors.textSub,
  },

  // ─── Propriétaire ───
  ownerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  ownerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  ownerAvatarFallback: {
    backgroundColor: colors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownerInitial: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: colors.gold,
  },
  ownerInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  ownerName: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.xs,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
  },

  // ─── Commentaires ───
  emptyComments: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  commentsList: {
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitial: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.gold,
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
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: colors.text,
  },
  commentDate: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  commentText: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.textSub,
    lineHeight: 20,
  },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: colors.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  commentInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.text,
    maxHeight: 100,
    paddingVertical: spacing.xs,
  },
  sendBtn: {
    padding: spacing.xs,
  },

  // ─── CTA fixe ───
  ctaSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
