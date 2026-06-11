import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Image, ActivityIndicator, RefreshControl,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import api from '../../services/api';

const FILTRES = ['Tous','Location','Vente','Appartement','Maison','Terrain','Bureau','Villa'];

const fmt = (n) => n ? `${Number(n).toLocaleString('fr-FR')} FCFA` : '—';

function CarteAnnonce({ item, onPress, onFavori }) {
  const [favori, setFavori] = useState(false);
  const isLocation = item.transactionType === 'location' || item.type === 'location';
  const photo = item.images?.[0] || item.photos?.[0] || null;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.photoBox}>
        {photo
          ? <Image source={{ uri: photo }} style={styles.photo} />
          : <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="home-outline" size={40} color={colors.textMuted} />
            </View>
        }
        <View style={[styles.badge, { backgroundColor: isLocation ? colors.location : colors.vente }]}>
          <Text style={styles.badgeText}>{isLocation ? 'LOCATION' : 'VENTE'}</Text>
        </View>
        <TouchableOpacity
          style={styles.favBtn}
          onPress={() => { setFavori(!favori); onFavori?.(!favori); }}
        >
          <Ionicons name={favori ? 'heart' : 'heart-outline'} size={22} color={favori ? colors.error : '#fff'} />
        </TouchableOpacity>
      </View>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.title || item.titre || 'Bien immobilier'}
        </Text>
        <View style={styles.cardRow}>
          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
          <Text style={styles.cardLoc} numberOfLines={1}>
            {item.quartier || item.location || item.ville || '—'}
          </Text>
        </View>

        <View style={styles.cardFeatures}>
          {item.bedrooms != null && (
            <View style={styles.feat}>
              <Ionicons name="bed-outline" size={14} color={colors.textMuted} />
              <Text style={styles.featTxt}>{item.bedrooms}</Text>
            </View>
          )}
          {item.bathrooms != null && (
            <View style={styles.feat}>
              <Ionicons name="water-outline" size={14} color={colors.textMuted} />
              <Text style={styles.featTxt}>{item.bathrooms}</Text>
            </View>
          )}
          {item.surface != null && (
            <View style={styles.feat}>
              <Ionicons name="expand-outline" size={14} color={colors.textMuted} />
              <Text style={styles.featTxt}>{item.surface}m²</Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.price}>
            {fmt(item.price || item.loyer || item.prix)}
            {isLocation ? <Text style={styles.priceSuffix}>/mois</Text> : ''}
          </Text>
          <TouchableOpacity style={styles.voirBtn} onPress={onPress}>
            <Text style={styles.voirTxt}>Voir</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ListeAnnoncesScreen({ navigation }) {
  const [properties, setProperties] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search,     setSearch]     = useState('');
  const [filtre,     setFiltre]     = useState('Tous');
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);

  const fetchProperties = useCallback(async (p = 1, reset = false) => {
    try {
      const params = { page: p, limit: 10 };
      if (search)                    params.search = search;
      if (filtre === 'Location')     params.transactionType = 'location';
      else if (filtre === 'Vente')   params.transactionType = 'vente';
      else if (filtre !== 'Tous')    params.propertyType = filtre.toLowerCase();

      const res = await api.get('/properties', { params });
      const data = res.data?.data?.properties || res.data?.properties || res.data?.data || [];
      const arr  = Array.isArray(data) ? data : [];

      setProperties(reset ? arr : prev => [...prev, ...arr]);
      setHasMore(arr.length === 10);
      setPage(p);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, filtre]);

  useEffect(() => { setLoading(true); fetchProperties(1, true); }, [filtre]);

  const onRefresh = () => { setRefreshing(true); fetchProperties(1, true); };
  const loadMore  = () => { if (hasMore && !loading) fetchProperties(page + 1); };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoMini}>
          <Text style={styles.logoText}>AV</Text>
        </View>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => { setLoading(true); fetchProperties(1, true); }}
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Filtres */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtresRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {FILTRES.map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filtrePill, filtre === f && styles.filtrePillActive]}
            onPress={() => setFiltre(f)}
          >
            <Text style={[styles.filtreTxt, filtre === f && { color: '#000' }]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste */}
      {loading && !refreshing
        ? <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: 60 }} />
        : (
          <FlatList
            data={properties}
            keyExtractor={(item, i) => item._id || String(i)}
            renderItem={({ item }) => (
              <CarteAnnonce
                item={item}
                onPress={() => navigation.navigate('DetailAnnonce', { property: item })}
              />
            )}
            contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 24 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.3}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="home-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyTxt}>Aucun bien trouvé</Text>
              </View>
            }
            ListFooterComponent={hasMore ? <ActivityIndicator color={colors.primary} style={{ padding: 16 }} /> : null}
          />
        )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  logoMini:    { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  logoText:    { fontSize: 14, fontWeight: '900', color: '#000' },
  searchWrap:  { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundLight, borderRadius: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, paddingVertical: 10 },
  filtresRow:  { maxHeight: 48, marginBottom: 4 },
  filtrePill:  { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.backgroundCard, borderWidth: 1, borderColor: colors.border },
  filtrePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filtreTxt:   { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  card:        { backgroundColor: colors.backgroundCard, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  photoBox:    { height: 200, position: 'relative' },
  photo:       { width: '100%', height: '100%' },
  photoPlaceholder: { backgroundColor: colors.backgroundLight, justifyContent: 'center', alignItems: 'center' },
  badge:       { position: 'absolute', top: 12, left: 12, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText:   { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  favBtn:      { position: 'absolute', top: 10, right: 12, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 20, padding: 6 },
  cardBody:    { padding: 14 },
  cardTitle:   { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 5 },
  cardRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  cardLoc:     { fontSize: 13, color: colors.textMuted, flex: 1 },
  cardFeatures:{ flexDirection: 'row', gap: 14, marginBottom: 10 },
  feat:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  featTxt:     { fontSize: 13, color: colors.textSecondary },
  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  price:       { fontSize: 16, fontWeight: '800', color: colors.primary },
  priceSuffix: { fontSize: 12, fontWeight: '400', color: colors.textMuted },
  voirBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  voirTxt:     { fontSize: 14, fontWeight: '700', color: colors.primary },
  empty:       { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt:    { color: colors.textMuted, fontSize: 16 },
});
