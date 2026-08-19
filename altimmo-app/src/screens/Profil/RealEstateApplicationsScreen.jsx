import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import PageHeader from '../../components/PageHeader';
import { useTheme } from '../../context/ThemeContext';
import { getMyApplications, withdrawApplication } from '../../services/realEstateApplicationService';
import { fonts, fontSize, spacing } from '../../theme';

const labels = { submitted: 'Soumis', under_review: 'En étude', accepted: 'Accepté', rejected: 'Rejeté', withdrawn: 'Retiré', expired: 'Expiré', not_selected: 'Non retenu' };
export default function RealEstateApplicationsScreen({ navigation }) {
  const { themeColors: c } = useTheme(); const styles = useMemo(() => makeStyles(c), [c]);
  const [rows, setRows] = useState([]); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async () => { setError(''); try { setRows(await getMyApplications()); } catch (e) { setError(e.normalized?.message || 'Chargement impossible.'); } finally { setLoading(false); setRefreshing(false); } }, []);
  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  const withdraw = (row) => Alert.alert('Retirer le dossier', 'Cette action est définitive.', [{ text: 'Annuler', style: 'cancel' }, { text: 'Retirer', style: 'destructive', onPress: async () => { try { await withdrawApplication(row._id); await load(); } catch (e) { Alert.alert('Erreur', e.response?.data?.message || 'Retrait impossible.'); } } }]);
  if (loading) return <View style={styles.center}><ActivityIndicator color={c.gold}/></View>;
  return <SafeAreaView style={styles.safe} edges={['top']}><PageHeader title="Mes dossiers" onBack={() => navigation.goBack()} />{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<FlatList data={rows} keyExtractor={(item) => item._id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }}/>} ListEmptyComponent={<Text style={styles.empty}>Aucun dossier immobilier.</Text>} renderItem={({ item }) => <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('RealEstateApplicationDetail', { applicationId: item._id })}><Text style={styles.cardTitle}>{item.property?.title || 'Bien immobilier'}</Text><Text style={styles.status}>{labels[item.status] || item.status}</Text><Text style={styles.meta}>{item.kind === 'purchase_offer' ? 'Offre d’achat' : 'Candidature locative'}</Text>{['submitted', 'under_review'].includes(item.status) && <TouchableOpacity onPress={() => withdraw(item)}><Text style={styles.withdraw}>Retirer</Text></TouchableOpacity>}</TouchableOpacity>}/></SafeAreaView>;
}
const makeStyles = (c) => StyleSheet.create({ safe:{flex:1,backgroundColor:c.bg},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:c.bg},list:{padding:spacing.lg,gap:spacing.md},card:{padding:spacing.lg,borderWidth:1,borderColor:c.borderGold,backgroundColor:c.bgCard,borderRadius:12},cardTitle:{fontFamily:fonts.bodyBold,fontSize:fontSize.lg,color:c.text},status:{color:c.gold,marginTop:6},meta:{color:c.textMuted,marginTop:4},withdraw:{color:c.error,marginTop:spacing.md,fontFamily:fonts.bodyMedium},empty:{textAlign:'center',color:c.textMuted,marginTop:60},error:{color:c.error,paddingHorizontal:spacing.lg}});
