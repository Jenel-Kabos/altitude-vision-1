import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text,
  TouchableOpacity, StyleSheet,
  FlatList, Dimensions, Alert, Share,
  TextInput, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Screen, Button, PrixFCFA } from '../../components';
import HeartFavoriteButton from '../../components/HeartFavoriteButton';
import { fonts, fontSize, spacing, radius } from '../../theme';

const { width } = Dimensions.get('window');
const GALLERY_H  = Math.min(Math.round(width * 0.65), 380);
const DESC_LIMIT  = 280;
const COMMENTS_MAX = 3;
const isVideoUrl  = (url) => /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(url);

// Stable — défini au niveau module pour ne pas être recréé à chaque render
const galleryGetItemLayout = (_, i) => ({ length: width, offset: width * i, index: i });

// ─── FeatureCell ──────────────────────────────────────────────────────────────

const FeatureCell = React.memo(function FeatureCell({ icon, value, label, styles, c }) {
  return (
    <View style={styles.featureCell}>
      <Ionicons name={icon} size={20} color={c.gold} />
      <Text style={styles.featureValue}>{value}</Text>
      <Text style={styles.featureLabel}>{label}</Text>
    </View>
  );
});

// ─── VideoGalleryItem ─────────────────────────────────────────────────────────

const VideoGalleryItem = React.memo(function VideoGalleryItem({ uri, isPlaying, onPlay, styles }) {
  return (
    <View style={styles.galleryImage}>
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay={isPlaying}
        isLooping={false}
        useNativeControls={isPlaying}
      />
      {!isPlaying && (
        <TouchableOpacity style={styles.videoPlayBtn} onPress={onPlay} activeOpacity={0.8}>
          <View style={styles.videoPlayCircle}>
            <Ionicons name="play" size={28} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}, (prev, next) => prev.isPlaying === next.isPlaying && prev.styles === next.styles);

// ─── ReviewItem ───────────────────────────────────────────────────────────────

const ReviewItem = React.memo(function ReviewItem({ review, formatDate, styles, c }) {
  const author  = review.user?.name || review.author || 'Anonyme';
  const text    = review.comment   || review.text    || '';
  const date    = formatDate(review.createdAt);
  const initial = (author[0] || '?').toUpperCase();
  return (
    <View style={styles.commentRow}>
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
}, (prev, next) => (prev.review._id || prev.review) === (next.review._id || next.review) && prev.styles === next.styles);

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function DetailAnnonceScreen({ route, navigation }) {
  const [annonce, setAnnonce]           = useState(route.params.annonce);
  const { user }                        = useAuth();
  const { themeColors: c }              = useTheme();
  const styles                          = useMemo(() => makeStyles(c), [c]);
  const isLoggedIn                      = !!user;

  const [photoIndex, setPhotoIndex]         = useState(0);
  const [playingIndex, setPlayingIndex]     = useState(null);
  const [commentaire, setCommentaire]       = useState('');
  const [envoi, setEnvoi]                   = useState(false);
  const [favori, setFavori]                 = useState(false);
  const [descExpanded, setDescExpanded]     = useState(false);
  const [bailModalVisible, setBailModalVisible] = useState(false);
  const [showAllComments, setShowAllComments]   = useState(false);

  const galleryRef = useRef(null);

  // ─── Données dérivées ───
  const photos       = useMemo(() => annonce.images || annonce.photos || [], [annonce]);
  const prix         = useMemo(() => annonce.price  || annonce.prix   || 0,  [annonce]);
  const title        = useMemo(() => annonce.title  || annonce.titre  || 'Bien immobilier', [annonce]);
  const description  = useMemo(() => annonce.description || '', [annonce]);
  const typeLabel    = useMemo(() => annonce.type || '', [annonce]);
  const isLocation   = useMemo(() => annonce.status?.toLowerCase() === 'location', [annonce]);
  const addressText  = useMemo(() => {
    const arr  = annonce.address?.arrondissement || annonce.location?.neighborhood || '';
    const city = annonce.address?.city           || annonce.location?.city          || annonce.city || '';
    return [arr, city].filter(Boolean).join(' · ');
  }, [annonce]);
  const surface      = useMemo(() => annonce.surface   || annonce.area     || 0, [annonce]);
  const bedrooms     = useMemo(() => annonce.bedrooms  || annonce.chambres || 0, [annonce]);
  const bathrooms    = useMemo(() => annonce.bathrooms || 0, [annonce]);
  const livingRooms  = useMemo(() => annonce.livingRooms || 0, [annonce]);
  const kitchens     = useMemo(() => annonce.kitchens    || 0, [annonce]);
  const floor        = useMemo(() =>
    annonce.floor != null ? annonce.floor : (annonce.etage ?? null), [annonce]);
  const commodites   = useMemo(() => annonce.amenities || annonce.commodites || [], [annonce]);
  const reviews      = useMemo(() => annonce.reviews  || annonce.comments   || [], [annonce]);

  const needsTruncate  = useMemo(() => description.length > DESC_LIMIT, [description]);
  const descShown      = useMemo(() =>
    !descExpanded && needsTruncate
      ? description.slice(0, DESC_LIMIT).trim() + '…'
      : description,
  [descExpanded, needsTruncate, description]);
  const visibleReviews  = useMemo(() =>
    showAllComments ? reviews : reviews.slice(0, COMMENTS_MAX),
  [showAllComments, reviews]);
  const hasMoreComments = useMemo(() => reviews.length > COMMENTS_MAX, [reviews]);

  // ─── Rechargement depuis l'API ───
  useEffect(() => {
    api.get(`/properties/${annonce._id}`)
      .then(res => {
        const full = res.data?.data?.property || res.data?.property;
        if (full) setAnnonce(full);
      })
      .catch(() => {});
  }, [annonce._id]);

  // ─── Statut favori ───
  useEffect(() => {
    api.get(`/likes/status/Property/${annonce._id}`)
      .then(res => setFavori(res.data?.data?.liked || false))
      .catch(() => {});
  }, [annonce._id]);

  // ─── Actions ─── (déclarées APRÈS les données dérivées pour éviter le TDZ)
  const toggleFavori = useCallback(async () => {
    try {
      const res = await api.post('/likes', { targetType: 'Property', targetId: annonce._id });
      setFavori(res.data?.data?.liked ?? !favori);
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour vos favoris.');
    }
  }, [annonce._id, favori]);

  const partagerBien = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const t      = annonce.title || annonce.titre || 'Bien immobilier';
    const p      = annonce.price || annonce.prix  || 0;
    const addr   = [
      annonce.address?.arrondissement || '',
      annonce.address?.city           || '',
    ].filter(Boolean).join(' · ');
    const webLink = `https://altitudevision.agency/annonces/${annonce._id}`;
    try {
      await Share.share({
        title:   t,
        message: `${t}${addr ? '\n' + addr : ''}\n${p.toLocaleString('fr-FR')} FCFA\n\n${webLink}`,
        url:     webLink,
      });
    } catch { /* annulé par l'utilisateur */ }
  }, [annonce._id, annonce.title, annonce.titre, annonce.price, annonce.prix, annonce.address]);

  const envoyerCommentaire = useCallback(async () => {
    if (!commentaire.trim()) return;
    if (!isLoggedIn) { navigation.navigate('Login'); return; }
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
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer le commentaire");
    } finally {
      setEnvoi(false);
    }
  }, [annonce._id, commentaire, isLoggedIn, navigation]);

  const demanderVisite = useCallback(() => {
    if (!isLoggedIn) {
      navigation.navigate('Login');
      return;
    }
    Alert.alert(
      'Prendre rendez-vous',
      'Souhaitez-vous demander une visite pour ce bien ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            try {
              const convRes = await api.post('/conversations/start', {
                propertyId: annonce._id,
                message: `Je souhaite prendre rendez-vous pour visiter : ${title}`,
              });
              const conversation = convRes.data?.data?.conversation;
              await api.post('/visites', {
                propertyId: annonce._id,
                conversationId: conversation?._id,
              });
              navigation.navigate('Messages', {
                screen: 'Chat',
                params: {
                  conversation,
                  contact: { _id: null, name: 'Équipe Altitude Vision' },
                },
              });
            } catch (err) {
              Alert.alert(
                'Erreur',
                err.response?.data?.message || "Impossible d'envoyer la demande de visite."
              );
            }
          },
        },
      ],
    );
  }, [annonce._id, title, isLoggedIn, navigation]);

  const onGalleryScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setPhotoIndex(idx);
    if (idx !== playingIndex) setPlayingIndex(null);
  }, [playingIndex]);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }, []);

  // ─── Handlers UI stables ───
  const toggleDesc      = useCallback(() => setDescExpanded(v => !v), []);
  const toggleComments  = useCallback(() => setShowAllComments(v => !v), []);
  const openBailModal   = useCallback(() => setBailModalVisible(true),  []);
  const closeBailModal  = useCallback(() => setBailModalVisible(false), []);
  const navigateToLogin = useCallback(() => navigation.navigate('Login'), [navigation]);

  const galleryKeyExtractor = useCallback((_, i) => String(i), []);

  const renderGalleryItem = useCallback(({ item, index }) => {
    if (isVideoUrl(item)) {
      return (
        <VideoGalleryItem
          uri={item}
          isPlaying={playingIndex === index}
          onPlay={() => setPlayingIndex(index)}
          styles={styles}
        />
      );
    }
    return (
      <Image
        source={{ uri: item }}
        style={styles.galleryImage}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={index === 0 ? 0 : 200}
      />
    );
  }, [playingIndex, styles]);

  return (
    <View style={styles.container}>
      <Screen scroll style={styles.scrollContent}>

        {/* ─── Galerie ─────────────────────────────────────────────── */}
        <View style={styles.galleryWrap}>
          {photos.length > 0 ? (
            <>
              <FlatList
                ref={galleryRef}
                data={photos}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                removeClippedSubviews={false}
                getItemLayout={galleryGetItemLayout}
                onMomentumScrollEnd={onGalleryScroll}
                renderItem={renderGalleryItem}
                keyExtractor={galleryKeyExtractor}
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                windowSize={3}
              />

              {/* Gradient bas de galerie */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.55)']}
                style={styles.galleryGradient}
                pointerEvents="none"
              />

              {/* Compteur ou dots selon le nombre de photos */}
              {photos.length > 5 ? (
                <View style={styles.photoCounter} pointerEvents="none">
                  <Text style={styles.photoCounterText}>
                    {photoIndex + 1} / {photos.length}
                  </Text>
                </View>
              ) : (
                <View style={styles.dotsWrap} pointerEvents="none">
                  {photos.map((_, i) => (
                    <View key={i} style={i === photoIndex ? styles.dotActive : styles.dotInactive} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <View style={styles.placeholderImg}>
              <Ionicons name="home-outline" size={64} color={c.textMuted} />
            </View>
          )}
        </View>

        {/* ─── Corps ───────────────────────────────────────────────── */}
        <View style={styles.body}>

          {/* ─── Hero : titre + adresse + prix ─── */}
          <View style={styles.heroSection}>
            {/* Badge type */}
            {typeLabel ? (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{typeLabel.toUpperCase()}</Text>
              </View>
            ) : null}

            {/* Titre en grand en haut */}
            <Text style={styles.titleText}>{title}</Text>
            {addressText ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={13} color={c.textMuted} />
                <Text style={styles.addressText}>{addressText}</Text>
              </View>
            ) : null}

            {/* Prix + badge statut en dessous */}
            <View style={styles.heroBottom}>
              <View style={styles.priceRow}>
                <PrixFCFA montant={prix} style={styles.priceFlex} />
                {isLocation && <Text style={styles.priceMois}> /mois</Text>}
              </View>
              <View style={[styles.statusBadge, isLocation ? styles.statusBadgeLoc : styles.statusBadgeVente]}>
                <Text style={[styles.statusBadgeText, isLocation ? styles.statusBadgeTextLoc : styles.statusBadgeTextVente]}>
                  {isLocation ? 'Location' : 'Vente'}
                </Text>
              </View>
            </View>
          </View>

          {/* ─── Caractéristiques ─── */}
          {(surface > 0 || bedrooms > 0 || bathrooms > 0 || livingRooms > 0 || kitchens > 0 || floor !== null) && (
            <View style={styles.featuresGrid}>
              {surface > 0     && <FeatureCell icon="resize-outline"     value={surface}     label="m²"      styles={styles} c={c} />}
              {bedrooms > 0    && <FeatureCell icon="bed-outline"         value={bedrooms}    label="Chambres" styles={styles} c={c} />}
              {bathrooms > 0   && <FeatureCell icon="water-outline"       value={bathrooms}   label="SDB"      styles={styles} c={c} />}
              {livingRooms > 0 && <FeatureCell icon="tv-outline"          value={livingRooms} label="Salon"    styles={styles} c={c} />}
              {kitchens > 0    && <FeatureCell icon="restaurant-outline"  value={kitchens}    label="Cuisine"  styles={styles} c={c} />}
              {floor !== null  && <FeatureCell icon="layers-outline"      value={floor === 0 ? 'RdC' : floor} label="Étage" styles={styles} c={c} />}
            </View>
          )}

          {/* ─── Description ─── */}
          {description ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.descText}>{descShown}</Text>
              {needsTruncate && (
                <TouchableOpacity
                  onPress={toggleDesc}
                  hitSlop={8}
                >
                  <Text style={styles.lireSuite}>
                    {descExpanded ? 'Réduire ↑' : 'Lire la suite ↓'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* ─── Commodités ─── */}
          {commodites.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Commodités</Text>
              <View style={styles.commoditesWrap}>
                {commodites.map((item, i) => (
                  <View key={i} style={styles.commoditeChip}>
                    <Ionicons name="checkmark-circle" size={10} color={c.gold} />
                    <Text style={styles.commoditeText}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ─── Conditions de bail ─── */}
          {isLocation && (
            <TouchableOpacity
              style={styles.bailButton}
              onPress={openBailModal}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text-outline" size={20} color={c.gold} />
              <Text style={styles.bailButtonText}>Voir les conditions de bail</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
            </TouchableOpacity>
          )}

          {/* ─── Commentaires ─── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Commentaires ({reviews.length})
            </Text>
            {reviews.length === 0 ? (
              <Text style={styles.emptyComments}>Aucun commentaire pour ce bien.</Text>
            ) : (
              <>
                <View style={styles.commentsList}>
                  {visibleReviews.map((r, i) => (
                    <ReviewItem
                      key={r._id || i}
                      review={r}
                      formatDate={formatDate}
                      styles={styles}
                      c={c}
                    />
                  ))}
                </View>
                {hasMoreComments && (
                  <TouchableOpacity
                    onPress={toggleComments}
                    style={styles.showMoreBtn}
                    hitSlop={8}
                  >
                    <Text style={styles.showMoreText}>
                      {showAllComments
                        ? 'Réduire'
                        : `Voir les ${reviews.length - COMMENTS_MAX} autres commentaires`}
                    </Text>
                    <Ionicons
                      name={showAllComments ? 'chevron-up' : 'chevron-down'}
                      size={14}
                      color={c.gold}
                    />
                  </TouchableOpacity>
                )}
              </>
            )}
            {isLoggedIn ? (
              <View style={styles.commentInputWrap}>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Laisser un commentaire…"
                  placeholderTextColor={c.textMuted}
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
                    color={envoi || !commentaire.trim() ? c.textMuted : c.gold}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.loginPrompt}
                onPress={navigateToLogin}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Se connecter pour commenter"
              >
                <Ionicons name="log-in-outline" size={16} color={c.gold} />
                <Text style={styles.loginPromptText}>
                  Connectez-vous pour laisser un commentaire
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Screen>

      {/* ─── Header flottant ────────────────────────────────────── */}
      <SafeAreaView style={styles.headerSafe} edges={['top']} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Retour"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={partagerBien}
              activeOpacity={0.8}
              accessibilityLabel="Partager ce bien"
              accessibilityRole="button"
            >
              <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
            </TouchableOpacity>

            <HeartFavoriteButton liked={favori} onPress={toggleFavori} size={22} />
          </View>
        </View>
      </SafeAreaView>

      {/* ─── CTA fixe en bas ────────────────────────────────────── */}
      <SafeAreaView style={styles.ctaSafe} edges={['bottom']}>
        <View style={styles.ctaWrap}>
          <Button
            label="Prendre rendez-vous"
            variant="primary"
            onPress={demanderVisite}
          />
        </View>
      </SafeAreaView>

      {/* ─── Modal conditions de bail ────────────────────────────── */}
      <Modal
        visible={bailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeBailModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Conditions de bail</Text>
              <TouchableOpacity
                onPress={closeBailModal}
                hitSlop={12}
              >
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>Caution demandée</Text>
              <Text style={styles.modalValue}>
                {(prix * (annonce.cautionMultiplicateur || 2)).toLocaleString('fr-FR')} FCFA
                {' '}({annonce.cautionMultiplicateur || 2} mois de loyer)
              </Text>
              {annonce.profilsLocataireRecherches?.length > 0 && (
                <>
                  <Text style={styles.modalSectionTitle}>Profil locataire recherché</Text>
                  <View style={styles.modalChipsRow}>
                    {annonce.profilsLocataireRecherches.map((p, i) => (
                      <View key={i} style={styles.modalChip}>
                        <Text style={styles.modalChipText}>{p}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
              {annonce.documentsRequis?.length > 0 && (
                <>
                  <Text style={styles.modalSectionTitle}>Documents à fournir</Text>
                  {annonce.documentsRequis.map((d, i) => (
                    <View key={i} style={styles.modalDocRow}>
                      <Ionicons name="checkmark-circle-outline" size={16} color={c.gold} />
                      <Text style={styles.modalDocText}>{d}</Text>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.bg,
  },
  scrollContent: {
    padding: 0,
    paddingBottom: 110,
  },

  // ─── Galerie ───
  galleryWrap: {
    width,
    height: GALLERY_H,
    backgroundColor: c.bgCard,
  },
  galleryImage: {
    width,
    height: GALLERY_H,
  },
  galleryGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: GALLERY_H * 0.45,
    pointerEvents: 'none',
  },
  placeholderImg: {
    width,
    height: GALLERY_H,
    backgroundColor: c.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayBtn: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlayCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },

  // ─── Compteur photo ───
  photoCounter: {
    position: 'absolute',
    bottom: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  photoCounterText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  // ─── Dots galerie (≤5 photos) ───
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
    width: 20, height: 4, borderRadius: 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  dotInactive: {
    width: 5, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  // ─── Header flottant ───
  headerSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  headerRight: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Corps ───
  body: {
    backgroundColor: c.bg,
  },

  // ─── Badge type ───
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: c.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  typeBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    color: c.textMuted,
    letterSpacing: 1,
  },

  // ─── Hero : titre + adresse + prix ───
  heroSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    marginBottom: spacing.md,
  },
  titleText: {
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    color: c.text,
    lineHeight: 38,
    marginBottom: spacing.xs,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
  },
  addressText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.textMuted,
  },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 1,
    marginRight: spacing.sm,
  },
  priceFlex: { flexShrink: 1 },
  priceMois: {
    fontFamily: fonts.bodyItalic,
    fontSize: fontSize.xs,
    color: c.textSub,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusBadgeVente: {
    backgroundColor: 'rgba(200,150,12,0.12)',
    borderColor: 'rgba(200,150,12,0.35)',
  },
  statusBadgeLoc: {
    backgroundColor: 'rgba(74,144,217,0.12)',
    borderColor: 'rgba(74,144,217,0.35)',
  },
  statusBadgeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusBadgeTextVente: { color: c.gold },
  statusBadgeTextLoc:   { color: c.blue },

  // ─── Caractéristiques ───
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
    backgroundColor: c.goldMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.borderGold,
  },
  featureValue: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
    marginTop: spacing.xs,
  },
  featureLabel: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
    marginTop: 2,
  },

  // ─── Sections génériques ───
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
    marginBottom: spacing.sm,
  },
  descText: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textSub,
    lineHeight: 24,
  },
  lireSuite: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.gold,
    marginTop: spacing.sm,
  },

  // ─── Commodités ───
  commoditesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  commoditeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: c.goldMuted,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: c.borderGold,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  commoditeText: {
    fontFamily: fonts.body,
    fontSize: 10,
    color: c.goldDark,
  },

  // ─── Bail ───
  bailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    backgroundColor: c.goldMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: c.borderGold,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bailButtonText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.md,
    color: c.goldDark,
  },

  // ─── Commentaires ───
  emptyComments: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textMuted,
    textAlign: 'center',
    marginVertical: spacing.md,
  },
  commentsList: { gap: spacing.md, marginBottom: spacing.sm },
  commentRow: { flexDirection: 'row', gap: spacing.sm },
  commentAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: c.bgCardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitial: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.gold,
  },
  commentBody: { flex: 1 },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  commentAuthor: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: c.text,
  },
  commentDate: {
    fontFamily: fonts.body,
    fontSize: fontSize.xs,
    color: c.textMuted,
  },
  commentText: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textSub,
    lineHeight: 20,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  showMoreText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.gold,
  },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    backgroundColor: c.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: c.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  commentInput: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.text,
    maxHeight: 100,
    paddingVertical: spacing.xs,
  },
  sendBtn: { padding: spacing.xs },

  // ─── Invite connexion commentaires ───
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: c.bgCardAlt,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: c.borderGold,
  },
  loginPromptText: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.sm,
    color: c.gold,
    flex: 1,
  },

  // ─── CTA ───
  ctaSafe: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  ctaWrap: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },

  // ─── Modal bail ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: c.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '75%',
  },
  modalHandle: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    fontFamily: fonts.display,
    fontSize: fontSize.lg,
    color: c.text,
  },
  modalSectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.sm,
    color: c.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  modalValue: {
    fontFamily: fonts.bodyMedium,
    fontSize: fontSize.md,
    color: c.text,
  },
  modalChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  modalChip: {
    backgroundColor: c.goldMuted,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: c.borderGold,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  modalChipText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: c.goldDark,
  },
  modalDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  modalDocText: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textSub,
    flex: 1,
  },
});
