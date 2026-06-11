import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Image, ScrollView, Alert, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const ROLE_COLOR = {
  admin:         colors.admin,
  collaborateur: colors.collaborateur,
  proprietaire:  colors.proprietaire,
  client:        colors.client,
  user:          colors.client,
};

function MenuItem({ icon, label, value, onPress, danger, toggle, toggleVal, onToggle }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} disabled={!!toggle} activeOpacity={0.7}>
      <View style={[styles.menuIcon, danger && { backgroundColor: `${colors.error}15` }]}>
        <Ionicons name={icon} size={18} color={danger ? colors.error : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, danger && { color: colors.error }]}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      {toggle
        ? <Switch value={toggleVal} onValueChange={onToggle} trackColor={{ true: colors.primary }} />
        : <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      }
    </TouchableOpacity>
  );
}

export default function ProfilScreen({ navigation }) {
  const { user, logout, updateUser } = useAuth();
  const [notifs, setNotifs] = useState(true);

  const roleColor = ROLE_COLOR[user?.role?.toLowerCase()] || colors.client;
  const roleLabel = user?.role || 'Utilisateur';

  const pickAndUploadAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') return Alert.alert('Permission requise');
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (result.canceled) return;

    const formData = new FormData();
    formData.append('photo', {
      uri:  result.assets[0].uri,
      name: 'avatar.jpg',
      type: 'image/jpeg',
    });
    try {
      const res = await api.patch('/users/updateMe', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser(res.data?.data?.user || {});
    } catch {
      Alert.alert('Erreur', 'Impossible de mettre à jour la photo.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* En-tête profil */}
        <LinearGradient colors={[colors.backgroundLight, colors.background]} style={styles.profileHeader}>
          <TouchableOpacity onPress={pickAndUploadAvatar} style={styles.avatarWrap}>
            {user?.photo
              ? <Image source={{ uri: user.photo }} style={styles.avatar} />
              : <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{user?.name?.[0]?.toUpperCase() || '?'}</Text>
                </View>
            }
            <View style={styles.editAvatarBtn}>
              <Ionicons name="camera" size={14} color="#000" />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{user?.name || 'Utilisateur'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={[styles.roleBadge, { backgroundColor: `${roleColor}20`, borderColor: roleColor }]}>
            <Text style={[styles.roleLabel, { color: roleColor }]}>{roleLabel}</Text>
          </View>
        </LinearGradient>

        {/* Menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mon compte</Text>
          <View style={styles.menuCard}>
            <MenuItem icon="person-outline"   label="Mes informations" onPress={() => {}} />
            <MenuItem icon="heart-outline"    label="Mes favoris"      onPress={() => {}} />
            <MenuItem icon="home-outline"     label="Mes annonces"     onPress={() => {}} />
            <MenuItem icon="calendar-outline" label="Mes visites"      onPress={() => navigation.navigate('Visites')} />
            {user?.role?.toLowerCase() === 'proprietaire' && (
              <MenuItem icon="document-text-outline" label="Mon contrat PDF" onPress={() => {}} />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Paramètres</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              toggle toggleVal={notifs} onToggle={setNotifs}
            />
            <MenuItem icon="shield-outline" label="Confidentialité" onPress={() => {}} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="log-out-outline"
              label="Se déconnecter"
              danger
              onPress={handleLogout}
            />
          </View>
        </View>

        <Text style={styles.version}>Altimmo v1.0.0 — Altitude Vision</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.background },
  scroll:       { paddingBottom: 40 },
  profileHeader:{ alignItems: 'center', paddingTop: 30, paddingBottom: 24, gap: 8 },
  avatarWrap:   { position: 'relative', marginBottom: 4 },
  avatar:       { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: colors.primary },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { fontSize: 36, fontWeight: '900', color: '#000' },
  editAvatarBtn:{ position: 'absolute', bottom: 2, right: 2, backgroundColor: colors.primary, borderRadius: 14, width: 26, height: 26, justifyContent: 'center', alignItems: 'center' },
  name:         { fontSize: 22, fontWeight: '800', color: colors.text },
  email:        { fontSize: 14, color: colors.textMuted },
  roleBadge:    { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  roleLabel:    { fontSize: 12, fontWeight: '700' },
  section:      { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  menuCard:     { backgroundColor: colors.backgroundCard, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  menuItem:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  menuIcon:     { width: 34, height: 34, borderRadius: 10, backgroundColor: `${colors.primary}15`, justifyContent: 'center', alignItems: 'center' },
  menuLabel:    { flex: 1, fontSize: 15, color: colors.text, fontWeight: '500' },
  menuValue:    { fontSize: 13, color: colors.textMuted, marginRight: 6 },
  version:      { textAlign: 'center', color: colors.textMuted, fontSize: 12, marginTop: 32 },
});
