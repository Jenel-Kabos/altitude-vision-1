import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, Dimensions, Alert, Share,
  TextInput, Modal, ScrollView, Pressable,
  ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import VideoPlayer from '../../components/VideoPlayer';
import DateTimePicker from '@react-native-community/datetimepicker';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Screen, PrixFCFA, FormSwitch } from '../../components';
import HeartFavoriteButton from '../../components/HeartFavoriteButton';
import { fonts, fontSize, spacing, radius } from '../../theme';
import {
  getPropertyPermissions, extractConversation, resolveContactErrorMessage,
  resolveDetailParams, fetchAnnonceDetail, getDisplayPrice,
} from '../../services/propertyMapper';
import { formatDateFR, formatTimeHHmm, isFutureDateTime, buildVisitPayload, fetchAvailability } from '../../services/visiteService';
import { resolveMobileDestination } from '../../navigation/navigationSdk';

const { width } = Dimensions.get('window');
// Galerie : ratio 4:3 portrait, plafonné à 310px — compact et élégant
const GALLERY_H = Math.min(Math.round(width * 0.72), 310);
const DESC_LIMIT  = 160;
const COMMENTS_MAX = 3;
const RAISONS_SIGNALEMENT = [
  { value: 'prix_incorrect',      label: 'Prix incorrect ou trompeur' },
  { value: 'annonce_expiree',     label: 'Annonce déjà vendue / louée' },
  { value: 'photos_trompeuses',   label: 'Photos trompeuses' },
  { value: 'fraude',              label: 'Fraude suspectée' },
  { value: 'contenu_inapproprie', label: 'Contenu inapproprié' },
  { value: 'autre',               label: 'Autre raison' },
];
const isVideoUrl  = (url) => /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(url);

const galleryGetItemLayout = (_, i) => ({ length: width, offset: width * i, index: i });

const fmt = (n) => Number(n || 0).toLocaleString('fr-FR');

// ─── Constantes features ────────────────────────────────────────────────────

const FEATURE_DEFS = [
  { key: 'surface',     icon: 'resize-outline',    suffix: 'm²',  label: 'Surface'  },
  { key: 'bedrooms',    icon: 'bed-outline',        suffix: '',    label: 'Chambres' },
  { key: 'bathrooms',   icon: 'water-outline',      suffix: '',    label: 'SDB'      },
  { key: 'livingRooms', icon: 'tv-outline',         suffix: '',    label: 'Salon'    },
  { key: 'kitchens',    icon: 'restaurant-outline', suffix: '',    label: 'Cuisine'  },
  { key: 'floor',       icon: 'layers-outline',     suffix: '',    label: 'Étage'    },
];

// ─── FeatureChip — compact horizontal scroll ─────────────────────────────────

const FeatureChip = React.memo(function FeatureChip({ icon, value, label, suffix, styles, c }) {
  return (
    <View style={styles.featureChip}>
      <View style={styles.featureChipIcon}>
        <Ionicons name={icon} size={16} color={c.gold} />
      </View>
      <View style={styles.featureChipText}>
        <Text style={styles.featureChipValue}>{value}{suffix}</Text>
        <Text style={styles.featureChipLabel}>{label}</Text>
      </View>
    </View>
  );
});

// ─── VideoGalleryItem ─────────────────────────────────────────────────────────

const VideoGalleryItem = React.memo(function VideoGalleryItem({ uri, isPlaying, onPlay, styles }) {
  return (
    <View style={styles.galleryItem}>
      <VideoPlayer
        source={uri}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        shouldPlay={isPlaying}
        isLooping={false}
        nativeControls={isPlaying}
      />
      {!isPlaying && (
        <TouchableOpacity
          onPress={onPlay}
          activeOpacity={0.8}
          style={{ ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' }}
        >
          <View style={styles.videoPlayCircle}>
            <Ionicons name="play" size={26} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}, (prev, next) => prev.isPlaying === next.isPlaying && prev.styles === next.styles);

// ─── CommentItem ──────────────────────────────────────────────────────────────

const CommentItem = React.memo(function CommentItem({ review, formatDate, styles, c, isLast }) {
  const author  = review.user?.name || review.author || 'Anonyme';
  const text    = review.comment   || review.text    || '';
  const date    = formatDate(review.createdAt);
  const initial = (author[0] || '?').toUpperCase();
  return (
    <View style={[styles.commentItem, !isLast && styles.commentItemBorder]}>
      <View style={styles.commentAvatar}>
        <Text style={styles.commentInitial}>{initial}</Text>
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentMeta}>
          <Text style={styles.commentAuthor}>{author}</Text>
          {date ? <Text style={styles.commentDate}>{date}</Text> : null}
        </View>
        <Text style={styles.commentText}>{text}</Text>
      </View>
    </View>
  );
}, (prev, next) =>
  (prev.review._id || prev.review) === (next.review._id || next.review) &&
  prev.styles === next.styles && prev.isLast === next.isLast
);

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function DetailAnnonceScreen({ route, navigation }) {
  // Correctif crash mobile (2026-07) — convention canonique de navigation
  // { resourceType, resourceId, item } compatible avec les anciens formats
  // ({ annonce }, { propertyId }, { id } deep-link/notification, { accommodationId }
  // anticipé). Voir propertyMapper.resolveDetailParams.
  const { resourceType, resourceId, item: initialItem } = useMemo(
    () => resolveDetailParams(route.params), [route.params],
  );
  const [annonce, setAnnonce]           = useState(initialItem);
  const [loading, setLoading]           = useState(!initialItem);
  const [loadError, setLoadError]       = useState(null);
  const { user }                        = useAuth();
  const { themeColors: c }              = useTheme();
  const styles                          = useMemo(() => makeStyles(c), [c]);
  const isLoggedIn                      = !!user;

  const [photoIndex, setPhotoIndex]         = useState(0);
  const [playingIndex, setPlayingIndex]     = useState(null);
  const [commentaire, setCommentaire]       = useState('');
  const [envoi, setEnvoi]                   = useState(false);
  const [favori, setFavori]                 = useState(false);
  const [likesCount, setLikesCount]         = useState(0);
  const [descExpanded, setDescExpanded]     = useState(false);
  const [bailModalVisible, setBailModalVisible] = useState(false);
  const [showAllComments, setShowAllComments]   = useState(false);
  const [signalModalVisible, setSignalModalVisible] = useState(false);
  const [signalRaison, setSignalRaison]             = useState('');
  const [signalDetails, setSignalDetails]           = useState('');
  const [signalEnvoi, setSignalEnvoi]               = useState(false);
  const [rdvModalVisible, setRdvModalVisible]       = useState(false);
  const [rdvDate, setRdvDate]                       = useState(null);
  const [rdvHeure, setRdvHeure]                     = useState(null);
  const [rdvTelephone, setRdvTelephone]             = useState(user?.phone || '');
  const [rdvMessage, setRdvMessage]                 = useState('');
  const [rdvConsent, setRdvConsent]                 = useState(false);
  const [rdvLoading, setRdvLoading]                 = useState(false);
  const [rdvSuccess, setRdvSuccess]                 = useState(false);
  const [rdvDatePickerVisible, setRdvDatePickerVisible] = useState(false);
  const [rdvSlots, setRdvSlots]                     = useState(null);
  const [rdvSlotsLoading, setRdvSlotsLoading]       = useState(false);
  const [rdvSlotsError, setRdvSlotsError]           = useState(null);
  const [contactLoading, setContactLoading]         = useState(false);

  const galleryRef = useRef(null);
  const rdvSubmittingRef = useRef(false);

  // ─── Données dérivées ───
  const photos      = useMemo(() => annonce?.images || annonce?.photos || [], [annonce]);

  // Auto-slide toutes les 4 secondes (pause si vidéo en lecture)
  useEffect(() => {
    if (!photos.length || photos.length <= 1 || playingIndex !== null) return;
    const timer = setInterval(() => {
      setPhotoIndex(prev => {
        const next = (prev + 1) % (photos?.length || 1);
        try {
          galleryRef.current?.scrollToIndex({ index: next, animated: true });
        } catch (_) {}
        return next;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, [photos?.length, playingIndex]);
  // Correctif crash (2026-07) — `annonce` peut être `undefined` pendant le chargement
  // (navigation par identifiant seul, sans objet transmis) : chaque lecture est
  // volontairement défensive (`annonce?.x`) ICI, mais l'écran ne rend son contenu qu'après
  // le gate loading/error ci-dessous — le `?.` seul ne "résout" rien, il évite juste le crash
  // pendant les rendus (inévitables, règles des hooks) qui précèdent ce gate.
  const displayPrice = useMemo(() => getDisplayPrice(annonce), [annonce]);
  const prix         = displayPrice.amount;
  const hasPrice      = displayPrice.hasPrice;
  const priceSuffix   = displayPrice.suffix;
  const title       = useMemo(() => annonce?.title  || annonce?.titre  || 'Bien immobilier', [annonce]);
  const description = useMemo(() => annonce?.description || '', [annonce]);
  const typeLabel   = useMemo(() => annonce?.type || '', [annonce]);
  const isLocation  = useMemo(() => {
    const loc = 'location';
    return [annonce?.transactionType, annonce?.status, annonce?.category, annonce?.type, annonce?.listingType]
      .some(v => v?.toLowerCase() === loc);
  }, [annonce]);
  const isHebergement = useMemo(
    () => [annonce?.status, annonce?.category].some(v => v?.toLowerCase() === 'hebergement'),
    [annonce],
  );

  // Honoraires saisis manuellement en base (Property.honoraires) si disponibles,
  // sinon formule par défaut (cohérente avec le web — PropertyDetailPage.jsx).
  // Hébergement n'a pas de règle d'honoraires liée à un mandat — pas de formule.
  const honoraires  = useMemo(() => {
    if (annonce?.honoraires != null) return annonce.honoraires;
    if (isHebergement) return 0;
    return isLocation ? Math.round(prix * 0.8) : Math.round(prix * 0.1);
  }, [annonce, isLocation, isHebergement, prix]);
  const fraisVisite = useMemo(() => annonce?.fraisVisite ?? 0, [annonce]);

  const addressText = useMemo(() => {
    const arr  = annonce?.address?.arrondissement || annonce?.location?.neighborhood || '';
    const city = annonce?.address?.city           || annonce?.location?.city          || annonce?.city || '';
    return [arr, city].filter(Boolean).join(' · ');
  }, [annonce]);

  const surface     = useMemo(() => annonce?.surface   || annonce?.area     || 0, [annonce]);
  const bedrooms    = useMemo(() => annonce?.bedrooms  || annonce?.chambres || 0, [annonce]);
  const bathrooms   = useMemo(() => annonce?.bathrooms || 0, [annonce]);
  const livingRooms = useMemo(() => annonce?.livingRooms || 0, [annonce]);
  const kitchens    = useMemo(() => annonce?.kitchens    || 0, [annonce]);
  const floor       = useMemo(() =>
    annonce?.floor != null ? annonce.floor : (annonce?.etage ?? null), [annonce]);
  const commodites  = useMemo(() => annonce?.amenities || annonce?.commodites || [], [annonce]);
  const reviews     = useMemo(() => annonce?.reviews  || annonce?.comments   || [], [annonce]);

  // Permissions d'action (contact / visite) — calculées côté client à partir
  // des champs backend (owner, availability, statusAdmin, isPublished).
  // Le backend reste la source de vérité et revalide ces règles à l'écriture.
  const permissions = useMemo(() => getPropertyPermissions(annonce, user), [annonce, user]);

  // Agent / propriétaire
  const agentName   = useMemo(() => annonce?.owner?.name || annonce?.agent?.name || null, [annonce]);
  const agentPhoto  = useMemo(() => annonce?.owner?.photo || annonce?.agent?.photo || null, [annonce]);

  // Engagement
  const viewsCount  = useMemo(() => annonce?.views  || 0, [annonce]);
  const sharesCount = useMemo(() => annonce?.shares || 0, [annonce]);

  // Features visibles
  const featureItems = useMemo(() => {
    const items = [];
    if (surface > 0)     items.push({ key:'surface',     value:`${surface}`, suffix:' m²', label:'Surface',  icon:'resize-outline'    });
    if (bedrooms > 0)    items.push({ key:'bedrooms',    value:String(bedrooms),  suffix:'', label:'Chambres', icon:'bed-outline'       });
    if (bathrooms > 0)   items.push({ key:'bathrooms',   value:String(bathrooms), suffix:'', label:'SDB',      icon:'water-outline'     });
    if (livingRooms > 0) items.push({ key:'livingRooms', value:String(livingRooms),suffix:'',label:'Salon',    icon:'tv-outline'        });
    if (kitchens > 0)    items.push({ key:'kitchens',    value:String(kitchens),  suffix:'', label:'Cuisine',  icon:'restaurant-outline'});
    if (floor !== null)  items.push({ key:'floor',       value: floor === 0 ? 'RdC' : String(floor), suffix:'', label:'Étage', icon:'layers-outline'});
    return items;
  }, [surface, bedrooms, bathrooms, livingRooms, kitchens, floor]);

  const needsTruncate  = useMemo(() => description.length > DESC_LIMIT, [description]);
  const descShown      = useMemo(() =>
    !descExpanded && needsTruncate
      ? description.slice(0, DESC_LIMIT).trim() + '…'
      : description,
  [descExpanded, needsTruncate, description]);

  const visibleReviews  = useMemo(() =>
    showAllComments ? reviews : reviews.slice(0, COMMENTS_MAX),
  [showAllComments, reviews]);
  const hasMoreComments = reviews.length > COMMENTS_MAX;

  // ─── Chargement du détail ───
  // Couvre les 4 chemins de navigation (mission) : objet `annonce` historique déjà présent
  // (affiché immédiatement, rafraîchi en tâche de fond), `propertyId`/`id` (deep-link,
  // notification push), `accommodationId` (anticipé). `resourceType='property'` couvre aussi
  // bien Vente/Location que Hébergement (un item hébergement de /altimmo/search est toujours
  // un Property avec `accommodationType` attaché — voir accommodationSearchService.js côté
  // serveur), donc `GET /properties/:id` suffit dans l'immense majorité des cas ;
  // `resourceType='accommodation'` cible `GET /accommodations/public/:id` (nouvelle route
  // publique, correctif backend justifié : aucune n'existait avant).
  useEffect(() => {
    let cancelled = false;
    if (!resourceType || !resourceId) {
      if (!initialItem) { setLoadError('missing-identifier'); setLoading(false); }
      return undefined;
    }
    if (!initialItem) setLoading(true);
    fetchAnnonceDetail({ resourceType, resourceId })
      .then((full) => {
        if (cancelled) return;
        setAnnonce(full);
        setLoadError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        // Un objet déjà affiché (navigation historique) reste visible même si le
        // rafraîchissement en tâche de fond échoue — comportement historique préservé.
        if (!initialItem) {
          setLoadError(err.response?.status === 404 ? 'not-found' : 'fetch-error');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resourceType, resourceId]);

  // Même source que le web (PropertyDetailPage.jsx) : le compteur et l'état
  // "aimé" viennent de Property.likes[], jamais de la collection Like générique
  // (POST /likes) — ces deux systèmes ne sont pas synchronisés entre eux.
  useEffect(() => {
    const likes = Array.isArray(annonce?.likes) ? annonce.likes : [];
    setLikesCount(likes.length);
    setFavori(!!user?._id && likes.some(id => (id?._id || id)?.toString() === user._id.toString()));
  }, [annonce?.likes, user?._id]);

  // ─── Actions ───
  const toggleFavori = useCallback(async () => {
    if (!isLoggedIn) { navigation.navigate('Login'); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !favori;
    setFavori(next);
    setLikesCount(n => next ? n + 1 : Math.max(0, n - 1));
    try {
      await api.post(`/properties/${annonce?._id}/like`);
    } catch {
      setFavori(!next);
      setLikesCount(n => next ? Math.max(0, n - 1) : n + 1);
      Alert.alert('Erreur', 'Impossible de mettre à jour vos favoris.');
    }
  }, [annonce?._id, favori, isLoggedIn, navigation]);

  const partagerBien = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const webLink = `https://altitudevision.agency/annonces/${annonce?._id}`;
    try {
      await Share.share({
        title:   title,
        message: `${title}${addressText ? '\n' + addressText : ''}\n${fmt(prix)} FCFA\n\n${webLink}`,
        url:     webLink,
      });
      // Incrémente le compteur de partages. Sur Android, Share.share() se
      // résout dès que la feuille de partage est lancée (choix d'une app ou
      // fermeture) — impossible de savoir si l'utilisateur a réellement
      // envoyé le contenu au destinataire. Ce compteur mesure donc les
      // "ouvertures/lancements de partage", pas les envois confirmés — même
      // convention que le web (PropertyDetailPage.jsx).
      api.post(`/properties/${annonce?._id}/share`).catch(() => {});
    } catch { /* annulé */ }
  }, [annonce?._id, title, addressText, prix]);

  const envoyerCommentaire = useCallback(async () => {
    if (!commentaire.trim()) return;
    if (!isLoggedIn) { navigation.navigate('Login'); return; }
    setEnvoi(true);
    try {
      await api.post(`/properties/${annonce?._id}/reviews`, { comment: commentaire, rating: 5 });
      setCommentaire('');
      const res = await api.get(`/properties/${annonce?._id}`);
      const full = res.data?.data?.property || res.data?.property;
      if (full) setAnnonce(full);
    } catch {
      Alert.alert('Erreur', "Impossible d'envoyer le commentaire");
    } finally {
      setEnvoi(false);
    }
  }, [annonce?._id, commentaire, isLoggedIn, navigation]);

  const demanderVisite = useCallback(() => {
    if (!isLoggedIn) { navigation.navigate('Login'); return; }
    if (!permissions.canRequestVisit) {
      Alert.alert('Action indisponible', permissions.reason || "La visite n'est pas disponible pour ce bien.");
      return;
    }
    setRdvSuccess(false);
    setRdvDate(null);
    setRdvHeure(null);
    setRdvTelephone(user?.phone || '');
    setRdvMessage('');
    setRdvConsent(false);
    setRdvDatePickerVisible(false);
    setRdvSlots(null);
    setRdvSlotsError(null);
    setRdvModalVisible(true);
  }, [isLoggedIn, navigation, user, permissions]);

  // Charge les créneaux disponibles dès qu'une date est choisie. Le backend
  // revalide toujours le conflit à la soumission (POST /visites) — cet appel
  // n'est qu'une aide d'affichage, jamais une garantie de réservation.
  const chargerCreneaux = useCallback(async (date) => {
    if (!date) return;
    setRdvSlotsLoading(true);
    setRdvSlotsError(null);
    try {
      const data = await fetchAvailability(annonce?._id, date);
      setRdvSlots(data);
    } catch {
      setRdvSlots(null);
      setRdvSlotsError('Impossible de charger les créneaux disponibles.');
    } finally {
      setRdvSlotsLoading(false);
    }
  }, [annonce?._id]);

  const onChangeRdvDate = useCallback((event, selected) => {
    setRdvDatePickerVisible(Platform.OS === 'ios');
    if (event.type === 'dismissed' || !selected) return;
    setRdvDate(selected);
    setRdvHeure(null); // un créneau choisi pour l'ancienne date n'est plus valide
    chargerCreneaux(selected);
  }, [chargerCreneaux]);

  const selectionnerCreneau = useCallback((hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    const heure = new Date();
    heure.setHours(h, m, 0, 0);
    setRdvHeure(heure);
  }, []);

  const soumettreRdv = useCallback(async () => {
    if (rdvSubmittingRef.current) return;
    if (!annonce?._id) {
      Alert.alert('Erreur', 'Bien invalide.');
      return;
    }
    if (!rdvDate || !rdvHeure) {
      Alert.alert('Champs requis', 'Sélectionnez une date et une heure de visite.');
      return;
    }
    if (!isFutureDateTime(rdvDate, rdvHeure)) {
      Alert.alert('Créneau invalide', 'Choisissez une date et une heure dans le futur.');
      return;
    }
    if (!rdvTelephone.trim() || !rdvConsent) {
      Alert.alert('Champs requis', "Renseignez le téléphone et confirmez votre accord de contact.");
      return;
    }
    try {
      rdvSubmittingRef.current = true;
      setRdvLoading(true);
      const dateLabel  = formatDateFR(rdvDate);
      const heureLabel = formatTimeHHmm(rdvHeure);
      const convRes = await api.post('/conversations/start', {
        propertyId: annonce?._id,
        message: `Demande de visite le ${dateLabel} à ${heureLabel}. Tél: ${rdvTelephone}${rdvMessage ? '. ' + rdvMessage : ''}`,
      });
      const conversation = extractConversation(convRes);
      await api.post('/visites', buildVisitPayload({
        propertyId: annonce?._id,
        conversationId: conversation?._id,
        selectedDate: rdvDate,
        selectedTime: rdvHeure,
        telephone: rdvTelephone,
        message: rdvMessage,
        clientContactConsent: rdvConsent,
      }));
      setRdvSuccess(true);
    } catch (err) {
      if (err.response?.data?.data?.action === 'reschedule') {
        Alert.alert(
          'Visite déjà active',
          err.response.data.message,
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Voir mes visites',
              onPress: () => {
                setRdvModalVisible(false);
                navigation.navigate('Visites');
              },
            },
          ],
        );
      } else {
        Alert.alert('Erreur', err.response?.data?.message || "Impossible d'envoyer la demande.");
      }
    } finally {
      rdvSubmittingRef.current = false;
      setRdvLoading(false);
    }
  }, [annonce?._id, rdvDate, rdvHeure, rdvTelephone, rdvMessage, rdvConsent, navigation]);

  const closeRdvModal = useCallback(() => {
    setRdvModalVisible(false);
    setRdvSuccess(false);
  }, []);

  const contacterAgent = useCallback(async () => {
    if (!isLoggedIn) { navigation.navigate('Login'); return; }
    if (!permissions.canContact) {
      Alert.alert('Action indisponible', permissions.reason || 'Vous ne pouvez pas contacter pour ce bien.');
      return;
    }
    if (contactLoading) return; // évite les créations multiples en cas de double clic
    setContactLoading(true);
    try {
      const convRes = await api.post('/conversations/start', {
        propertyId: annonce?._id,
        message: `Bonjour, je suis intéressé(e) par : ${title}`,
      });
      const conversation = extractConversation(convRes);
      if (!conversation) throw { isInvalidResponse: true };
      navigation.navigate('Messages', {
        screen: 'Chat',
        params: { conversation, contact: { _id: null, name: 'Équipe Altitude Vision' } },
      });
    } catch (err) {
      Alert.alert('Erreur', err.isInvalidResponse ? "Impossible d'ouvrir la messagerie." : resolveContactErrorMessage(err));
    } finally {
      setContactLoading(false);
    }
  }, [annonce?._id, title, isLoggedIn, navigation, permissions, contactLoading]);

  const onGalleryScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setPhotoIndex(idx);

    // Autoplay si le slide actuel est une vidéo, sinon stoppe toute lecture
    const currentMedia = photos[idx];
    if (currentMedia && isVideoUrl(currentMedia)) {
      setPlayingIndex(idx);
    } else {
      setPlayingIndex(null);
    }
  }, [photos]);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }, []);

  const toggleDesc     = useCallback(() => setDescExpanded(v => !v), []);
  const toggleComments = useCallback(() => setShowAllComments(v => !v), []);
  const openBailModal  = useCallback(() => setBailModalVisible(true),  []);
  const closeBailModal = useCallback(() => setBailModalVisible(false), []);

  const openSignalModal  = useCallback(() => {
    if (!isLoggedIn) { navigation.navigate('Login'); return; }
    setSignalRaison('');
    setSignalDetails('');
    setSignalModalVisible(true);
  }, [isLoggedIn, navigation]);
  const closeSignalModal = useCallback(() => setSignalModalVisible(false), []);

  const soumettreSignalement = useCallback(async () => {
    if (!signalRaison) {
      Alert.alert('Motif requis', 'Veuillez sélectionner un motif de signalement.');
      return;
    }
    setSignalEnvoi(true);
    try {
      await api.post('/signalements', {
        propertyId: annonce?._id,
        raison:     signalRaison,
        details:    signalDetails.trim(),
      });
      setSignalModalVisible(false);
      Alert.alert('Signalement envoyé', 'Merci. Notre équipe va examiner cette annonce sous 24h.');
    } catch (err) {
      if (err.response?.status === 409) {
        setSignalModalVisible(false);
        Alert.alert('Déjà signalé', 'Vous avez déjà signalé cette annonce. Notre équipe est déjà informée.');
      } else {
        const msg = err.response?.data?.message || "Impossible d'envoyer le signalement.";
        Alert.alert('Erreur', msg);
      }
    } finally {
      setSignalEnvoi(false);
    }
  }, [signalRaison, signalDetails, annonce?._id, isLoggedIn, navigation]);

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
        style={styles.galleryItem}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={index === 0 ? 0 : 180}
      />
    );
  }, [playingIndex, styles]);

  // ─── Garde de rendu (correctif crash 2026-07) ───
  // Toujours placé APRÈS tous les hooks (règles des hooks respectées — aucun hook n'est
  // appelé conditionnellement) : tant que `annonce` n'est pas chargée, on n'affiche jamais le
  // contenu détaillé (qui lit `annonce.price`, `.title`, `.images`, etc.), seulement un état
  // de chargement ou d'erreur explicite avec retour arrière.
  if (loading) {
    return (
      <SafeAreaView style={[styles.root, styles.centerState]}>
        <ActivityIndicator size="large" color={c.gold} />
        <Text style={styles.centerStateText}>Chargement de l'annonce…</Text>
      </SafeAreaView>
    );
  }
  if (loadError || !annonce) {
    const message = loadError === 'not-found'
      ? "Cette annonce est introuvable ou n'est plus disponible."
      : loadError === 'missing-identifier'
        ? 'Impossible d’ouvrir cette annonce : identifiant manquant.'
        : "Impossible de charger cette annonce. Vérifiez votre connexion puis réessayez.";
    return (
      <SafeAreaView style={[styles.root, styles.centerState]}>
        <Ionicons name="alert-circle-outline" size={40} color={c.textMuted} />
        <Text style={styles.centerStateText}>{message}</Text>
        <TouchableOpacity
          style={styles.centerStateBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="arrow-back" size={16} color={c.gold} />
          <Text style={styles.centerStateBtnText}>Retour</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.root}>

      {/* ══════════════════════ GALERIE — hors ScrollView ══════════════════════ */}
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
            {/* Gradient bas */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={styles.galleryGradient}
              pointerEvents="none"
            />
            {/* Compteur élégant */}
            <View style={styles.photoCounter} pointerEvents="none">
              <Ionicons name="images-outline" size={11} color="rgba(255,255,255,0.7)" />
              <Text style={styles.photoCounterText}>{photoIndex + 1} / {photos.length}</Text>
            </View>
            {/* Barre de progression */}
            {photos.length > 1 && (
              <View style={styles.progressBar} pointerEvents="none">
                {photos.map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.progressSegment,
                      { opacity: i === photoIndex ? 1 : 0.3, flex: 1 },
                    ]}
                  />
                ))}
              </View>
            )}
          </>
        ) : (
          <View style={styles.galleryPlaceholder}>
            <Ionicons name="home-outline" size={48} color={c.border} />
            <Text style={styles.galleryPlaceholderText}>Aucune photo disponible</Text>
          </View>
        )}
      </View>

      {/* ══════════════════════ CORPS scrollable ══════════════════════ */}
      <Screen scroll style={styles.scrollContent}>
        <View style={styles.body}>

          {/* ── Hero ── */}
          <Animated.View entering={FadeInDown.duration(300).springify()} style={styles.heroCard}>

            {/* Ligne : badge type + badge transaction */}
            <View style={styles.heroBadgeRow}>
              {typeLabel ? (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{typeLabel}</Text>
                </View>
              ) : null}
              <View style={[styles.txBadge, isHebergement ? styles.txBadgeHeb : isLocation ? styles.txBadgeLoc : styles.txBadgeVente]}>
                <View style={[styles.txBadgeDot, isHebergement ? { backgroundColor: '#16A34A' } : isLocation ? { backgroundColor: '#185FA5' } : { backgroundColor: c.gold }]} />
                <Text style={[styles.txBadgeText, isHebergement ? { color: '#16A34A' } : isLocation ? { color: '#185FA5' } : { color: c.gold }]}>
                  {isHebergement ? 'Hébergement' : isLocation ? 'Location' : 'Vente'}
                </Text>
              </View>
            </View>

            {/* Titre */}
            <Text style={styles.titleText} numberOfLines={3}>{title}</Text>

            {/* Adresse */}
            {addressText ? (
              <View style={styles.addressRow}>
                <Ionicons name="location-outline" size={13} color={c.textMuted} />
                <Text style={styles.addressText}>{addressText}</Text>
              </View>
            ) : null}

            {/* Divider */}
            <View style={styles.heroDivider} />

            {/* Prix — jamais inventé : "Prix sur demande" si aucune valeur positive
                n'est disponible (vente/location/hébergement), voir getDisplayPrice. */}
            <View style={styles.priceRow}>
              {hasPrice ? (
                <>
                  <PrixFCFA montant={prix} style={styles.priceFlex} />
                  {priceSuffix ? <Text style={styles.priceSuffix}> {priceSuffix}</Text> : null}
                </>
              ) : (
                <Text style={styles.priceOnRequest}>Prix sur demande</Text>
              )}
            </View>
          </Animated.View>

          {/* ── Engagement bar — toujours affichée ── */}
          <View style={styles.engageBar}>
            <View style={styles.engageItem}>
              <Ionicons name="eye-outline" size={14} color={c.textMuted} />
              <Text style={styles.engageText}>
                {viewsCount > 0 ? fmt(viewsCount) : '0'} vue{viewsCount !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={styles.engageSep} />
            <View style={styles.engageItem}>
              <Ionicons name="heart-outline" size={14} color="#E11D48" />
              <Text style={styles.engageText}>
                {likesCount > 0 ? fmt(likesCount) : '0'} j'aime
              </Text>
            </View>
            <View style={styles.engageSep} />
            <View style={styles.engageItem}>
              <Ionicons name="share-social-outline" size={14} color={c.textMuted} />
              <Text style={styles.engageText}>
                {sharesCount > 0 ? fmt(sharesCount) : '0'} partage{sharesCount !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* ── Caractéristiques — scroll horizontal compact ── */}
          {featureItems.length > 0 && (
            <View style={styles.featuresSection}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuresScroll}
              >
                {featureItems.map(({ key, ...rest }) => (
                  <FeatureChip key={key} {...rest} styles={styles} c={c} />
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Description ── */}
          {description ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.descText}>{descShown}</Text>
              {needsTruncate && (
                <TouchableOpacity onPress={toggleDesc} hitSlop={8} style={styles.expandBtn}>
                  <Text style={styles.expandBtnText}>
                    {descExpanded ? 'Réduire' : 'Lire la suite'}
                  </Text>
                  <Ionicons
                    name={descExpanded ? 'chevron-up' : 'chevron-down'}
                    size={13}
                    color={c.gold}
                  />
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* ── Frais & Conditions (Vente/Location uniquement — jamais de vocabulaire de bail pour Hébergement) ── */}
          {!isHebergement && (
            <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.feesSection}>
              <Text style={styles.sectionLabel}>Frais & conditions</Text>
              <View style={styles.feesCard}>
                <View style={styles.feesRow}>
                  <View style={styles.feesRowLeft}>
                    <View style={styles.feesIcon}>
                      <Ionicons name="business-outline" size={15} color={c.gold} />
                    </View>
                    <View style={styles.feesRowText}>
                      <Text style={styles.feesRowLabel}>Honoraires d'agence</Text>
                      <Text style={styles.feesRowNote}>
                        {isLocation ? '80% du loyer mensuel' : '10% du prix de vente'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.feesRowValue}>{fmt(honoraires)} FCFA</Text>
                </View>
                <View style={styles.feesSep} />
                <View style={styles.feesRow}>
                  <View style={styles.feesRowLeft}>
                    <View style={[styles.feesIcon, { backgroundColor: 'rgba(46,123,181,0.12)' }]}>
                      <Ionicons name="eye-outline" size={15} color="#2E7BB5" />
                    </View>
                    <View style={styles.feesRowText}>
                      <Text style={styles.feesRowLabel}>Frais de visite</Text>
                      <Text style={styles.feesRowNote}>
                        {fraisVisite > 0 ? 'Réglés le jour de la visite' : 'Offerts par l\'agence'}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.feesRowValue, { color: '#2E7BB5' }]}>
                    {fraisVisite > 0 ? `${fmt(fraisVisite)} FCFA` : 'Gratuite'}
                  </Text>
                </View>
              </View>
            </Animated.View>
          )}

          {/* ── Tarifs du séjour (Hébergement uniquement) ── */}
          {isHebergement && annonce.accommodation && (
            <Animated.View entering={FadeInDown.delay(80).duration(280)} style={styles.feesSection}>
              <Text style={styles.sectionLabel}>Tarifs du séjour</Text>
              <View style={styles.feesCard}>
                {(annonce.accommodation.rates || []).map((r, i, arr) => (
                  <React.Fragment key={r.mode}>
                    <View style={styles.feesRow}>
                      <View style={styles.feesRowLeft}>
                        <View style={styles.feesIcon}>
                          <Ionicons name="bed-outline" size={15} color={c.gold} />
                        </View>
                        <Text style={styles.feesRowLabel}>
                          {{ nightly: 'Par nuit', weekly: 'Par semaine', monthly: 'Par mois', yearly: 'Par an' }[r.mode] || r.mode}
                        </Text>
                      </View>
                      <Text style={styles.feesRowValue}>{fmt(r.amount)} FCFA</Text>
                    </View>
                    {i < arr.length - 1 && <View style={styles.feesSep} />}
                  </React.Fragment>
                ))}
                {annonce.accommodation.securityDeposit > 0 && (
                  <>
                    <View style={styles.feesSep} />
                    <View style={styles.feesRow}>
                      <Text style={styles.feesRowLabel}>Caution de séjour</Text>
                      <Text style={styles.feesRowValue}>{fmt(annonce.accommodation.securityDeposit)} FCFA</Text>
                    </View>
                  </>
                )}
              </View>
            </Animated.View>
          )}

          {/* ── Commodités ── */}
          {commodites.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Équipements</Text>
              <View style={styles.commoditesGrid}>
                {commodites.map((item, i) => (
                  <View key={i} style={styles.commoditeItem}>
                    <View style={styles.commoditeIconWrap}>
                      <Ionicons name="checkmark" size={12} color={c.gold} />
                    </View>
                    <Text style={styles.commoditeText} numberOfLines={1}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* ── Agent ── */}
          {agentName && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Votre interlocuteur</Text>
              <View style={styles.agentCard}>
                <View style={styles.agentAvatar}>
                  {agentPhoto ? (
                    <Image source={{ uri: agentPhoto }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Text style={styles.agentInitial}>{(agentName[0] || 'A').toUpperCase()}</Text>
                  )}
                </View>
                <View style={styles.agentInfo}>
                  <Text style={styles.agentName}>{agentName}</Text>
                  <Text style={styles.agentRole}>Agent Altitude Vision</Text>
                </View>
                <TouchableOpacity
                  style={styles.agentMsgBtn}
                  onPress={contacterAgent}
                  activeOpacity={0.8}
                >
                  <Ionicons name="chatbubble-outline" size={16} color={c.gold} />
                  <Text style={styles.agentMsgText}>Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Conditions de bail ── */}
          {isLocation && (
            <View style={styles.section}>
              <TouchableOpacity style={styles.bailRow} onPress={openBailModal} activeOpacity={0.8}>
                <View style={styles.bailIconWrap}>
                  <Ionicons name="document-text-outline" size={18} color={c.gold} />
                </View>
                <Text style={styles.bailText}>Conditions de bail</Text>
                <Ionicons name="chevron-forward" size={16} color={c.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Commentaires ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Avis</Text>
              {reviews.length > 0 && (
                <View style={styles.reviewCountBadge}>
                  <Text style={styles.reviewCountText}>{reviews.length}</Text>
                </View>
              )}
            </View>

            {reviews.length === 0 ? (
              <View style={styles.emptyReviews}>
                <Ionicons name="chatbubbles-outline" size={28} color={c.border} />
                <Text style={styles.emptyReviewsText}>Soyez le premier à commenter</Text>
              </View>
            ) : (
              <>
                <View style={styles.commentsList}>
                  {visibleReviews.map((r, i) => (
                    <CommentItem
                      key={r._id || i}
                      review={r}
                      formatDate={formatDate}
                      styles={styles}
                      c={c}
                      isLast={i === visibleReviews.length - 1}
                    />
                  ))}
                </View>
                {hasMoreComments && (
                  <TouchableOpacity onPress={toggleComments} style={styles.showMoreBtn} hitSlop={8}>
                    <Text style={styles.showMoreText}>
                      {showAllComments ? 'Réduire' : `Voir ${reviews.length - COMMENTS_MAX} avis de plus`}
                    </Text>
                    <Ionicons
                      name={showAllComments ? 'chevron-up' : 'chevron-down'}
                      size={13}
                      color={c.gold}
                    />
                  </TouchableOpacity>
                )}
              </>
            )}

            {/* Zone de saisie */}
            {isLoggedIn ? (
              <View style={styles.commentInputWrap}>
                <View style={styles.commentInputAvatar}>
                  <Text style={styles.commentInputInitial}>
                    {(user?.name?.[0] || 'M').toUpperCase()}
                  </Text>
                </View>
                <TextInput
                  style={styles.commentInput}
                  placeholder="Votre avis…"
                  placeholderTextColor={c.placeholder}
                  cursorColor={c.gold}
                  selectionColor={c.borderGold}
                  value={commentaire}
                  onChangeText={setCommentaire}
                  multiline
                />
                <TouchableOpacity
                  onPress={envoyerCommentaire}
                  disabled={envoi || !commentaire.trim()}
                  style={[styles.sendBtn, (!commentaire.trim() || envoi) && styles.sendBtnDisabled]}
                  hitSlop={8}
                >
                  <Ionicons
                    name="send"
                    size={18}
                    color={envoi || !commentaire.trim() ? c.textMuted : '#FFFFFF'}
                  />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.loginPrompt}
                onPress={() => navigation.navigate('Login')}
                activeOpacity={0.8}
              >
                <Ionicons name="log-in-outline" size={16} color={c.gold} />
                <Text style={styles.loginPromptText}>Connectez-vous pour laisser un avis</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Signaler l'annonce ── */}
          <View style={styles.signalRow}>
            <TouchableOpacity
              style={styles.signalBtn}
              onPress={openSignalModal}
              activeOpacity={0.7}
              hitSlop={10}
            >
              <Ionicons name="flag-outline" size={14} color={c.textMuted} />
              <Text style={styles.signalBtnText}>Signaler cette annonce</Text>
            </TouchableOpacity>
          </View>

        </View>
      </Screen>

      {/* ══════════════════════ HEADER FLOTTANT ══════════════════════ */}
      <SafeAreaView style={styles.headerSafe} edges={['top']} pointerEvents="box-none">
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
            accessibilityLabel="Retour"
          >
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={partagerBien}
              activeOpacity={0.8}
              accessibilityLabel="Partager"
            >
              <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <HeartFavoriteButton liked={favori} onPress={toggleFavori} size={20} />
          </View>
        </View>
      </SafeAreaView>

      {/* ══════════════════════ CTA FIXE ══════════════════════ */}
      <SafeAreaView style={styles.ctaSafe} edges={['bottom']}>
        {!permissions.canContact && !permissions.canRequestVisit && !(isHebergement && annonce.accommodationId) ? (
          <View style={styles.ctaReasonWrap}>
            <Ionicons name="information-circle-outline" size={16} color={c.textMuted} />
            <Text style={styles.ctaReasonText}>{permissions.reason}</Text>
          </View>
        ) : (
          <View style={styles.ctaRow}>
            {isHebergement && annonce.accommodationId && (
              <TouchableOpacity
                style={styles.ctaBtnPrimary}
                onPress={() => {
                  const target = resolveMobileDestination('ACCOMMODATION_BOOKING', { id: annonce.accommodationId, propertyId: annonce._id || annonce.id });
                  if (target) navigation.navigate(target.screen, { ...target.params, params: { ...target.params?.params, title } });
                }}
                accessibilityRole="button"
                accessibilityLabel="Réserver cet hébergement"
              >
                <Ionicons name="bed-outline" size={18} color="#FFFFFF" />
                <Text style={styles.ctaBtnPrimaryText}>Réserver</Text>
              </TouchableOpacity>
            )}
            {!isHebergement && permissions.canContact && (
              <TouchableOpacity
                style={styles.ctaBtnPrimary}
                onPress={() => navigation.navigate('Profil', { screen: 'SubmitRealEstateApplication', params: { propertyId: annonce._id || annonce.id, propertyTitle: title, kind: isLocation ? 'rental_application' : 'purchase_offer' } })}
                accessibilityLabel={isLocation ? 'Déposer une candidature locative' : 'Faire une offre d’achat'}
              >
                <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                <Text style={styles.ctaBtnPrimaryText}>{isLocation ? 'Candidater' : 'Faire une offre'}</Text>
              </TouchableOpacity>
            )}
            {permissions.canContact && (
              <TouchableOpacity
                style={[styles.ctaBtnSecondary, !permissions.canRequestVisit && styles.ctaBtnFull]}
                onPress={contacterAgent}
                activeOpacity={0.85}
                disabled={contactLoading}
                accessibilityState={{ disabled: contactLoading, busy: contactLoading }}
              >
                {contactLoading ? (
                  <ActivityIndicator color={c.gold} size="small" />
                ) : (
                  <>
                    <Ionicons name="chatbubble-outline" size={18} color={c.gold} />
                    <Text style={styles.ctaBtnSecondaryText}>Contacter</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
            {permissions.canRequestVisit ? (
              <TouchableOpacity
                style={styles.ctaBtnPrimary}
                onPress={demanderVisite}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={18} color="#FFFFFF" />
                <Text style={styles.ctaBtnPrimaryText}>Planifier une visite</Text>
              </TouchableOpacity>
            ) : permissions.canContact && permissions.reason ? (
              <View style={styles.ctaReasonInline}>
                <Text style={styles.ctaReasonInlineText} numberOfLines={2}>{permissions.reason}</Text>
              </View>
            ) : null}
          </View>
        )}
      </SafeAreaView>

      {/* ══════════════════════ MODAL BAIL ══════════════════════ */}
      <Modal
        visible={bailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeBailModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeBailModal}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Conditions de bail</Text>
              <TouchableOpacity onPress={closeBailModal} hitSlop={12}>
                <Ionicons name="close" size={22} color={c.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>Caution demandée</Text>
              <Text style={styles.modalValue}>
                {fmt(prix * (annonce.cautionMultiplicateur || 2))} FCFA
                {' '}— {annonce.cautionMultiplicateur || 2} mois de loyer
              </Text>
              {annonce.profilsLocataireRecherches?.length > 0 && (
                <>
                  <Text style={styles.modalSectionTitle}>Profil recherché</Text>
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
                      <Ionicons name="checkmark-circle" size={16} color={c.gold} />
                      <Text style={styles.modalDocText}>{d}</Text>
                    </View>
                  ))}
                </>
              )}
              {/* Frais d'agence — valeur réelle (honoraires manuels si saisis, sinon formule par défaut) */}
              <Text style={styles.modalSectionTitle}>Frais d'agence</Text>
              <Text style={styles.modalValue}>{fmt(honoraires)} FCFA</Text>
              <Text style={[styles.modalDocText, { marginTop: 4 }]}>
                Réglés à la signature du bail.
              </Text>

              {/* Frais de visite — valeur réelle du bien, jamais inventée */}
              <Text style={styles.modalSectionTitle}>Frais de visite</Text>
              <Text style={styles.modalValue}>{fraisVisite > 0 ? `${fmt(fraisVisite)} FCFA` : 'Gratuite'}</Text>
              <Text style={[styles.modalDocText, { marginTop: 4 }]}>
                {fraisVisite > 0 ? "À régler le jour de la visite, avant l'entrée dans le bien." : "Offerts par l'agence."}
              </Text>

              <View style={{ height: 24 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════════════════ MODAL SIGNALEMENT ══════════════════════ */}
      <Modal
        visible={signalModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeSignalModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closeSignalModal}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />

            <View style={styles.modalTitleRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="flag-outline" size={18} color="#DC2626" />
                <Text style={styles.modalTitle}>Signaler cette annonce</Text>
              </View>
              <TouchableOpacity onPress={closeSignalModal} hitSlop={12}>
                <Ionicons name="close" size={22} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalSectionTitle}>Motif du signalement</Text>

              {RAISONS_SIGNALEMENT.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.signalOption, signalRaison === r.value && styles.signalOptionSelected]}
                  onPress={() => setSignalRaison(r.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.signalRadio, signalRaison === r.value && styles.signalRadioSelected]}>
                    {signalRaison === r.value && <View style={styles.signalRadioDot} />}
                  </View>
                  <Text style={[
                    styles.signalOptionText,
                    signalRaison === r.value && { color: c.text, fontFamily: fonts.bodyBold },
                  ]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}

              <Text style={[styles.modalSectionTitle, { marginTop: 16 }]}>
                Détails supplémentaires (optionnel)
              </Text>
              <TextInput
                style={styles.signalInput}
                placeholder="Décrivez le problème…"
                placeholderTextColor={c.placeholder}
                cursorColor={c.gold}
                selectionColor={c.borderGold}
                value={signalDetails}
                onChangeText={setSignalDetails}
                multiline
                maxLength={500}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.signalSubmitBtn, (!signalRaison || signalEnvoi) && { opacity: 0.5 }]}
                onPress={soumettreSignalement}
                disabled={!signalRaison || signalEnvoi}
                activeOpacity={0.8}
              >
                <Ionicons name="send-outline" size={16} color="#FFFFFF" />
                <Text style={styles.signalSubmitText}>
                  {signalEnvoi ? 'Envoi…' : 'Envoyer le signalement'}
                </Text>
              </TouchableOpacity>

              <Text style={styles.signalDisclaimer}>
                Les signalements abusifs peuvent entraîner la suspension de votre compte.
              </Text>

              <View style={{ height: 24 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ══════════════════════ MODAL RENDEZ-VOUS ══════════════════════ */}
      <Modal
        visible={rdvModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeRdvModal}
      >
        <View style={styles.rdvOverlay}>
          <View style={styles.rdvSheet}>
            {rdvSuccess ? (
              <View style={styles.rdvSuccessView}>
                <View style={styles.rdvSuccessIcon}>
                  <Ionicons name="checkmark-circle" size={56} color={c.success} />
                </View>
                <Text style={styles.rdvSuccessTitle}>Demande envoyée !</Text>
                <Text style={styles.rdvSuccessDesc}>
                  Notre équipe vous contactera au {rdvTelephone} pour confirmer votre rendez-vous.
                </Text>

                <View style={styles.rdvRecap}>
                  <View style={styles.rdvRecapRow}>
                    <Ionicons name="calendar-outline" size={16} color={c.gold} />
                    <Text style={styles.rdvRecapText}>Date souhaitée : {formatDateFR(rdvDate)}</Text>
                  </View>
                  <View style={styles.rdvRecapRow}>
                    <Ionicons name="time-outline" size={16} color={c.gold} />
                    <Text style={styles.rdvRecapText}>Heure : {formatTimeHHmm(rdvHeure)}</Text>
                  </View>
                  <View style={styles.rdvRecapRow}>
                    <Ionicons name="home-outline" size={16} color={c.gold} />
                    <Text style={styles.rdvRecapText} numberOfLines={1}>{title}</Text>
                  </View>
                </View>

                <Text style={styles.rdvSuccessNote}>
                  Vous recevrez une notification dès confirmation par notre équipe.
                </Text>

                <TouchableOpacity style={styles.rdvCloseSuccessBtn} onPress={closeRdvModal}>
                  <Text style={styles.rdvCloseSuccessText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.rdvHeader}>
                  <Text style={styles.rdvTitle}>Planifier une visite</Text>
                  <TouchableOpacity onPress={closeRdvModal} hitSlop={12}>
                    <Ionicons name="close" size={24} color={c.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.rdvBienInfo}>
                  <Text style={styles.rdvBienNom} numberOfLines={1}>{title}</Text>
                  <Text style={styles.rdvBienLoc}>{addressText}</Text>
                </View>

                <View style={styles.rdvFinances}>
                  <View style={styles.rdvFinanceRow}>
                    <Text style={styles.rdvFinanceLabel}>Honoraires d'agence</Text>
                    <Text style={styles.rdvFinanceValue}>{fmt(honoraires)} FCFA</Text>
                  </View>
                  <View style={styles.rdvFinanceRow}>
                    <Text style={styles.rdvFinanceLabel}>Frais de visite</Text>
                    <Text style={[styles.rdvFinanceValue, fraisVisite <= 0 && { color: c.success }]}>
                      {fraisVisite > 0 ? `${fmt(fraisVisite)} FCFA` : 'Gratuite'}
                    </Text>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  <Text style={styles.rdvFieldLabel}>
                    Date souhaitée <Text style={{ color: c.gold }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.rdvInput}
                    onPress={() => setRdvDatePickerVisible(true)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Choisir la date de la visite"
                  >
                    <Text style={{
                      fontFamily: fonts.body, fontSize: fontSize.sm,
                      color: rdvDate ? c.text : c.textMuted,
                    }}>
                      {rdvDate ? formatDateFR(rdvDate) : 'Sélectionner une date'}
                    </Text>
                  </TouchableOpacity>
                  {rdvDatePickerVisible && (
                    <DateTimePicker
                      value={rdvDate || new Date()}
                      mode="date"
                      minimumDate={new Date()}
                      display={Platform.OS === 'ios' ? 'inline' : 'default'}
                      onChange={onChangeRdvDate}
                    />
                  )}

                  <Text style={styles.rdvFieldLabel}>
                    Créneau disponible <Text style={{ color: c.gold }}>*</Text>
                  </Text>
                  {!rdvDate ? (
                    <Text style={styles.rdvSlotsHint}>Choisissez d'abord une date.</Text>
                  ) : rdvSlotsLoading ? (
                    <View style={styles.rdvSlotsLoading}>
                      <ActivityIndicator color={c.gold} size="small" />
                      <Text style={styles.rdvSlotsHint}>Chargement des créneaux…</Text>
                    </View>
                  ) : rdvSlotsError ? (
                    <View style={styles.rdvSlotsLoading}>
                      <Text style={styles.rdvSlotsHint}>{rdvSlotsError}</Text>
                      <TouchableOpacity onPress={() => chargerCreneaux(rdvDate)} hitSlop={8}>
                        <Text style={styles.rdvSlotsRetry}>Réessayer</Text>
                      </TouchableOpacity>
                    </View>
                  ) : !rdvSlots?.availableSlots?.length ? (
                    <Text style={styles.rdvSlotsHint}>
                      Aucun créneau disponible pour cette date. Choisissez une autre date.
                    </Text>
                  ) : (
                    <View style={styles.rdvSlotsGrid}>
                      {[...rdvSlots.availableSlots.map(h => ({ h, disabled: false })),
                        ...rdvSlots.unavailableSlots.map(h => ({ h, disabled: true }))]
                        .sort((a, b) => a.h.localeCompare(b.h))
                        .map(({ h, disabled }) => {
                          const selected = rdvHeure && formatTimeHHmm(rdvHeure) === h;
                          return (
                            <TouchableOpacity
                              key={h}
                              disabled={disabled}
                              onPress={() => selectionnerCreneau(h)}
                              style={[
                                styles.rdvSlotChip,
                                selected && styles.rdvSlotChipSelected,
                                disabled && styles.rdvSlotChipDisabled,
                              ]}
                              accessibilityRole="button"
                              accessibilityState={{ disabled, selected: !!selected }}
                              accessibilityLabel={disabled ? `Créneau ${h} indisponible` : `Créneau ${h} disponible`}
                            >
                              <Text style={[
                                styles.rdvSlotChipText,
                                selected && styles.rdvSlotChipTextSelected,
                                disabled && styles.rdvSlotChipTextDisabled,
                              ]}>
                                {h}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                    </View>
                  )}

                  <Text style={styles.rdvFieldLabel}>
                    Téléphone <Text style={{ color: c.gold }}>*</Text>
                  </Text>
                  <TextInput
                    style={styles.rdvInput}
                    placeholder="+242 06 XXX XX XX"
                    placeholderTextColor={c.placeholder}
                    cursorColor={c.gold}
                    selectionColor={c.borderGold}
                    value={rdvTelephone}
                    onChangeText={setRdvTelephone}
                    keyboardType="phone-pad"
                  />

                  <Text style={styles.rdvFieldLabel}>Message (optionnel)</Text>
                  <TextInput
                    style={[styles.rdvInput, styles.rdvTextarea]}
                    placeholder="Précisions sur la visite..."
                    placeholderTextColor={c.placeholder}
                    cursorColor={c.gold}
                    selectionColor={c.borderGold}
                    value={rdvMessage}
                    onChangeText={setRdvMessage}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 }}>
                    <FormSwitch
                      value={rdvConsent}
                      onValueChange={setRdvConsent}
                      accessibilityLabel="Consentement pour être contacté"
                    />
                    <Text style={{ flex: 1, color: c.textSub, fontFamily: fonts.body, fontSize: fontSize.sm }}>
                      J’accepte d’être contacté par Altimmo pour organiser ce rendez-vous de visite.
                    </Text>
                  </View>
                </ScrollView>

                <TouchableOpacity
                  style={[styles.rdvSubmitBtn, rdvLoading && { opacity: 0.6 }]}
                  onPress={soumettreRdv}
                  disabled={rdvLoading}
                  activeOpacity={0.85}
                >
                  {rdvLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="calendar-outline" size={18} color="#fff" />
                      <Text style={styles.rdvSubmitText}>Confirmer la demande</Text>
                    </>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => {
  const CARD_RADIUS = 16;
  const PX = spacing.md;

  return StyleSheet.create({
    root:          { flex: 1, backgroundColor: c.bg },
    scrollContent: { padding: 0, paddingBottom: 120 },

    // ── États chargement / erreur (correctif crash 2026-07) ──
    centerState: {
      flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingHorizontal: 32,
    },
    centerStateText: {
      fontFamily: fonts.body, fontSize: fontSize.sm, color: c.textMuted, textAlign: 'center',
    },
    centerStateBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8,
      paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.sm,
      borderWidth: 1, borderColor: c.border,
    },
    centerStateBtnText: { fontFamily: fonts.bodyMedium, fontSize: fontSize.sm, color: c.gold },

    // ── Galerie ──
    galleryWrap: {
      width,
      height: GALLERY_H,
      backgroundColor: c.bgCard,
    },
    galleryItem: { width, height: GALLERY_H },
    galleryGradient: {
      position: 'absolute',
      left: 0, right: 0, bottom: 0,
      height: GALLERY_H * 0.5,
      pointerEvents: 'none',
    },
    galleryPlaceholder: {
      flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    },
    galleryPlaceholderText: {
      fontFamily: fonts.body,
      fontSize: fontSize.sm,
      color: c.textMuted,
    },
    videoPlayCircle: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center', justifyContent: 'center',
      paddingLeft: 3,
    },
    // Compteur photo
    photoCounter: {
      position: 'absolute',
      bottom: 42, right: PX,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    photoCounterText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    // Barre de progression
    progressBar: {
      position: 'absolute',
      bottom: 20,
      left: PX, right: PX,
      flexDirection: 'row',
      gap: 4,
      height: 2,
    },
    progressSegment: {
      height: 2,
      borderRadius: 1,
      backgroundColor: '#FFFFFF',
    },

    // ── Header flottant ──
    headerSafe: { position: 'absolute', top: 0, left: 0, right: 0 },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: PX,
      paddingTop: spacing.sm,
    },
    headerRight: { flexDirection: 'row', gap: spacing.sm },
    headerBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.4)',
      alignItems: 'center', justifyContent: 'center',
    },

    // ── Corps ──
    body: { backgroundColor: c.bg },

    // ── Hero card ──
    heroCard: {
      marginHorizontal: PX,
      marginTop: -CARD_RADIUS,
      backgroundColor: c.bgCard,
      borderRadius: CARD_RADIUS,
      padding: PX,
      // Ombre légère
      shadowColor: '#000',
      shadowOpacity: 0.06,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
      marginBottom: spacing.sm,
    },
    heroBadgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    typeBadge: {
      backgroundColor: c.bgCardAlt,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    typeBadgeText: {
      fontFamily: fonts.bodyBold,
      fontSize: 10,
      color: c.textMuted,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    txBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    txBadgeVente: { backgroundColor: 'rgba(200,150,12,0.10)' },
    txBadgeLoc:   { backgroundColor: 'rgba(24,95,165,0.10)' },
    txBadgeHeb:   { backgroundColor: 'rgba(22,163,74,0.10)' },
    txBadgeDot:   { width: 6, height: 6, borderRadius: 3 },
    txBadgeText:  { fontFamily: fonts.bodyBold, fontSize: 11, letterSpacing: 0.5 },

    titleText: {
      fontFamily: fonts.display,
      fontSize: 22,
      color: c.text,
      lineHeight: 30,
      marginBottom: 6,
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    addressText: {
      fontFamily: fonts.body,
      fontSize: fontSize.sm,
      color: c.textMuted,
    },
    heroDivider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: 14,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    priceFlex: { flexShrink: 1 },
    priceSuffix: {
      fontFamily: fonts.body,
      fontSize: fontSize.sm,
      color: c.textMuted,
      marginLeft: 2,
    },
    priceOnRequest: {
      fontFamily: fonts.display,
      fontSize: fontSize.display,
      color: c.textMuted,
    },

    // ── Engagement bar ──
    engageBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: PX,
      marginBottom: spacing.md,
      backgroundColor: c.bgCard,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 10,
    },
    engageItem: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
    },
    engageSep: {
      width: 1,
      height: 16,
      backgroundColor: c.border,
    },
    engageText: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
    },

    // ── Caractéristiques — scroll horizontal ──
    featuresSection: {
      marginBottom: spacing.md,
    },
    featuresScroll: {
      paddingHorizontal: PX,
      gap: 8,
      paddingVertical: 2,
    },
    featureChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.bgCard,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderGold,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    featureChipIcon: {
      width: 30, height: 30, borderRadius: 8,
      backgroundColor: c.goldMuted,
      alignItems: 'center', justifyContent: 'center',
    },
    featureChipText: { gap: 1 },
    featureChipValue: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: c.text,
    },
    featureChipLabel: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: c.textMuted,
    },

    // ── Sections génériques ──
    section: {
      paddingHorizontal: PX,
      marginBottom: spacing.lg,
    },
    sectionLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: c.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 10,
    },
    reviewCountBadge: {
      backgroundColor: c.goldMuted,
      borderRadius: 10,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    reviewCountText: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: c.gold,
    },

    // ── Description ──
    descText: {
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.textSub,
      lineHeight: 22,
    },
    expandBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 8,
    },
    expandBtnText: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.sm,
      color: c.gold,
    },

    // ── Commodités ──
    commoditesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    commoditeItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      width: '47%',
    },
    commoditeIconWrap: {
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: c.goldMuted,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    commoditeText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.textSub,
      flex: 1,
    },

    // ── Agent ──
    agentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
    },
    agentAvatar: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: c.bgCardAlt,
      alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    agentInitial: {
      fontFamily: fonts.bodyBold,
      fontSize: 18,
      color: c.gold,
    },
    agentInfo: { flex: 1, gap: 2 },
    agentName: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: c.text,
    },
    agentRole: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
    },
    agentMsgBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: c.goldMuted,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderGold,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    agentMsgText: {
      fontFamily: fonts.bodyBold,
      fontSize: 12,
      color: c.gold,
    },

    // ── Bail ──
    bailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.bgCard,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderGold,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    bailIconWrap: {
      width: 32, height: 32, borderRadius: 8,
      backgroundColor: c.goldMuted,
      alignItems: 'center', justifyContent: 'center',
    },
    bailText: {
      flex: 1,
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: c.text,
    },

    // ── Commentaires ──
    commentsList: { gap: 0, marginBottom: spacing.sm },
    commentItem: {
      flexDirection: 'row',
      gap: 10,
      paddingVertical: 12,
    },
    commentItemBorder: {
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    commentAvatar: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: c.bgCardAlt,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    commentInitial: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: c.gold,
    },
    commentBody: { flex: 1 },
    commentMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 3,
    },
    commentAuthor: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: c.text,
    },
    commentDate: {
      fontFamily: fonts.body,
      fontSize: 10,
      color: c.textMuted,
    },
    commentText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textSub,
      lineHeight: 19,
    },
    emptyReviews: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      gap: 6,
    },
    emptyReviewsText: {
      fontFamily: fonts.body,
      fontSize: fontSize.sm,
      color: c.textMuted,
    },
    showMoreBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingVertical: spacing.xs,
      marginBottom: spacing.sm,
    },
    showMoreText: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.sm,
      color: c.gold,
    },

    // ── Zone de saisie commentaire ──
    commentInputWrap: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      backgroundColor: c.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginTop: spacing.sm,
    },
    commentInputAvatar: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.goldMuted,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    commentInputInitial: {
      fontFamily: fonts.bodyBold,
      fontSize: 11,
      color: c.gold,
    },
    commentInput: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.text,
      maxHeight: 80,
      paddingVertical: 2,
    },
    sendBtn: {
      width: 34, height: 34, borderRadius: 17,
      backgroundColor: c.gold,
      alignItems: 'center', justifyContent: 'center',
    },
    sendBtnDisabled: {
      backgroundColor: c.bgCardAlt,
    },

    // ── Login prompt ──
    loginPrompt: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: spacing.sm,
      padding: 12,
      backgroundColor: c.bgCardAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.borderGold,
    },
    loginPromptText: {
      fontFamily: fonts.bodyBold,
      fontSize: fontSize.sm,
      color: c.gold,
    },

    // ── CTA double ──
    ctaSafe: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      backgroundColor: c.bgCard,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    ctaRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: PX,
      paddingVertical: spacing.sm,
    },
    ctaBtnSecondary: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: c.borderGold,
      backgroundColor: c.bgCard,
      paddingVertical: 13,
    },
    ctaBtnSecondaryText: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: c.gold,
    },
    ctaBtnPrimary: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: 12,
      backgroundColor: c.gold,
      paddingVertical: 13,
    },
    ctaBtnPrimaryText: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: '#FFFFFF',
    },
    ctaBtnFull: { flex: 1 },
    ctaReasonWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: PX,
      paddingVertical: spacing.sm,
    },
    ctaReasonText: {
      flex: 1,
      fontFamily: fonts.body,
      fontSize: fontSize.sm,
      color: c.textMuted,
    },
    ctaReasonInline: {
      flex: 2,
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
    ctaReasonInlineText: {
      fontFamily: fonts.body,
      fontSize: fontSize.xs,
      color: c.textMuted,
    },

    // ── Modal bail ──
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: c.bgCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: PX,
      maxHeight: '78%',
    },
    modalHandle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: c.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    modalTitleRow: {
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
      fontSize: 10,
      color: c.textMuted,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginTop: spacing.md,
      marginBottom: 6,
    },
    modalValue: {
      fontFamily: fonts.bodyBold,
      fontSize: 15,
      color: c.text,
    },
    modalChipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 6,
    },
    modalChip: {
      backgroundColor: c.goldMuted,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: c.borderGold,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    modalChipText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.goldDark,
    },
    modalDocRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
    },
    modalDocText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textSub,
      flex: 1,
    },

    // ── Frais & Conditions ──
    feesSection: {
      paddingHorizontal: PX,
      marginBottom: spacing.lg,
    },
    feesCard: {
      backgroundColor: c.bgCard,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
    },
    feesRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 8,
    },
    feesRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    feesIcon: {
      width: 34, height: 34, borderRadius: 9,
      backgroundColor: c.goldMuted,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    feesRowText: { flex: 1 },
    feesRowLabel: {
      fontFamily: fonts.bodyBold,
      fontSize: 13,
      color: c.text,
    },
    feesRowNote: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
      marginTop: 2,
    },
    feesRowValue: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: c.gold,
      flexShrink: 0,
    },
    feesSep: {
      height: 1,
      backgroundColor: c.border,
      marginHorizontal: 14,
    },

    // ── Signaler ──
    signalRow: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginBottom: 8,
    },
    signalBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    signalBtnText: {
      fontFamily: fonts.body,
      fontSize: 12,
      color: c.textMuted,
      textDecorationLine: 'underline',
      textDecorationColor: c.textMuted,
    },
    signalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 11,
      paddingHorizontal: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCardAlt,
      marginBottom: 8,
    },
    signalOptionSelected: {
      borderColor: '#DC2626',
      backgroundColor: 'rgba(220,38,38,0.05)',
    },
    signalOptionText: {
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.textSub,
      flex: 1,
    },
    signalRadio: {
      width: 18, height: 18, borderRadius: 9,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    },
    signalRadioSelected: { borderColor: '#DC2626' },
    signalRadioDot: {
      width: 8, height: 8, borderRadius: 4,
      backgroundColor: '#DC2626',
    },
    signalInput: {
      backgroundColor: c.bgCardAlt,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: fonts.body,
      fontSize: 13,
      color: c.text,
      height: 90,
      marginBottom: 16,
    },
    signalSubmitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#DC2626',
      borderRadius: 12,
      paddingVertical: 14,
      marginBottom: 10,
    },
    signalSubmitText: {
      fontFamily: fonts.bodyBold,
      fontSize: 14,
      color: '#FFFFFF',
    },
    signalDisclaimer: {
      fontFamily: fonts.body,
      fontSize: 11,
      color: c.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },

    // ── Modal rendez-vous ──
    rdvOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    rdvSheet: {
      backgroundColor: c.bgCard,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: PX,
      maxHeight: '90%',
    },
    rdvHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    rdvTitle: { fontFamily: fonts.display, fontSize: 20, color: c.text },
    rdvBienInfo: {
      marginBottom: 14,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    rdvBienNom: { fontFamily: fonts.bodyBold, fontSize: 15, color: c.text },
    rdvBienLoc: { fontFamily: fonts.body, fontSize: 12, color: c.textMuted, marginTop: 2 },
    rdvFinances: {
      backgroundColor: c.goldLight,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: c.borderGold,
    },
    rdvFinanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    rdvFinanceLabel: { fontFamily: fonts.body, fontSize: 12, color: c.textSub },
    rdvFinanceValue: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.gold },
    rdvFieldLabel: { fontFamily: fonts.bodyBold, fontSize: 12, color: c.textSub, marginBottom: 6, marginTop: 12 },
    rdvInput: {
      backgroundColor: c.bgCardAlt,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 12,
      padding: 13,
      fontFamily: fonts.body,
      fontSize: 14,
      color: c.text,
    },
    rdvTextarea: { height: 80, textAlignVertical: 'top' },
    rdvSlotsHint: { fontFamily: fonts.body, fontSize: 13, color: c.textMuted, paddingVertical: 4 },
    rdvSlotsLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    rdvSlotsRetry: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.gold },
    rdvSlotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    rdvSlotChip: {
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.bgCardAlt,
    },
    rdvSlotChipSelected: { backgroundColor: c.gold, borderColor: c.gold },
    rdvSlotChipDisabled: { opacity: 0.4 },
    rdvSlotChipText: { fontFamily: fonts.bodyBold, fontSize: 13, color: c.text },
    rdvSlotChipTextSelected: { color: '#FFFFFF' },
    rdvSlotChipTextDisabled: { color: c.textMuted, textDecorationLine: 'line-through' },
    rdvSubmitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.gold,
      borderRadius: 14,
      padding: 16,
      marginTop: 16,
    },
    rdvSubmitText: { fontFamily: fonts.bodyBold, fontSize: 15, color: '#fff' },
    rdvSuccessView: { alignItems: 'center', padding: 20 },
    rdvSuccessIcon: { marginBottom: 16 },
    rdvSuccessTitle: { fontFamily: fonts.display, fontSize: 24, color: c.text, marginBottom: 8 },
    rdvSuccessDesc: { fontFamily: fonts.body, fontSize: 14, color: c.textSub, textAlign: 'center', marginBottom: 20 },
    rdvRecap: { width: '100%', backgroundColor: c.bgCardAlt, borderRadius: 12, padding: 14, marginBottom: 16, gap: 10 },
    rdvRecapRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rdvRecapText: { fontFamily: fonts.body, fontSize: 13, color: c.text, flex: 1 },
    rdvSuccessNote: { fontFamily: fonts.body, fontSize: 12, color: c.textMuted, textAlign: 'center', marginBottom: 20 },
    rdvCloseSuccessBtn: {
      backgroundColor: c.bgCardAlt,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 32,
      borderWidth: 1,
      borderColor: c.border,
    },
    rdvCloseSuccessText: { fontFamily: fonts.bodyBold, fontSize: 14, color: c.textSub },
  });
};
