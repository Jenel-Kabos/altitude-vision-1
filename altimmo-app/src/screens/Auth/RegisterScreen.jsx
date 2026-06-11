import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const ROLES = [
  { value: 'Client',       label: '👤 Client',       desc: 'Recherche de bien' },
  { value: 'Proprietaire', label: '🏠 Propriétaire', desc: 'Publiez vos biens' },
];

const CERTIFICATIONS = [
  { key: 'contratAccepte',       label: "J'accepte le contrat d'hébergement" },
  { key: 'informationsVraies',   label: 'Informations vraies et exactes' },
  { key: 'estProprietaireLegal', label: 'Je suis propriétaire légal ou apporteur' },
  { key: 'engagementHonnetete',  label: "Je m'engage à l'honnêteté" },
  { key: 'commissionAcceptee',   label: "J'accepte les conditions de rémunération" },
];

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [role,     setRole]     = useState('Client');
  const [form,     setForm]     = useState({ prenom:'', nom:'', email:'', telephone:'', password:'' });
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [certs,    setCerts]    = useState({
    contratAccepte: false, informationsVraies: false,
    estProprietaireLegal: false, engagementHonnetete: false, commissionAcceptee: false,
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleCert = (k) => setCerts(c => ({ ...c, [k]: !c[k] }));

  const isProprietaire = role === 'Proprietaire';
  const toutAccepte    = isProprietaire ? Object.values(certs).every(Boolean) : true;

  const handleRegister = async () => {
    const { prenom, nom, email, telephone, password } = form;
    if (!prenom || !nom || !email || !password) return Alert.alert('Erreur', 'Tous les champs sont requis.');
    if (password.length < 8) return Alert.alert('Erreur', 'Mot de passe trop court (min 8 caractères).');
    if (isProprietaire && !toutAccepte) return Alert.alert('Erreur', 'Cochez toutes les certifications.');

    setLoading(true);
    try {
      await register({
        name:            `${prenom.trim()} ${nom.trim()}`,
        email:           email.trim().toLowerCase(),
        password,
        passwordConfirm: password,
        phone:           telephone.trim(),
        role,
        ...(isProprietaire && { contratAccepte: true, certifications: certs }),
      });
      Alert.alert('Inscription réussie', 'Vérifiez votre email pour activer votre compte.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      Alert.alert('Erreur', err.response?.data?.message || "Erreur lors de l'inscription.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Créer un compte</Text>
        </View>

        {/* Sélection rôle */}
        <View style={styles.rolesRow}>
          {ROLES.map(r => (
            <TouchableOpacity
              key={r.value}
              style={[styles.roleCard, role === r.value && styles.roleCardActive]}
              onPress={() => setRole(r.value)}
            >
              <Text style={styles.roleEmoji}>{r.label.split(' ')[0]}</Text>
              <Text style={[styles.roleLabel, role === r.value && { color: colors.primary }]}>
                {r.label.split(' ').slice(1).join(' ')}
              </Text>
              <Text style={styles.roleDesc}>{r.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.form}>
          {[
            { key:'prenom',    placeholder:'Prénom', icon:'person-outline' },
            { key:'nom',       placeholder:'Nom',    icon:'person-outline' },
            { key:'email',     placeholder:'Email',  icon:'mail-outline',    keyboard:'email-address' },
            { key:'telephone', placeholder:'Téléphone (+242...)', icon:'call-outline', keyboard:'phone-pad' },
          ].map(field => (
            <View key={field.key} style={styles.inputWrap}>
              <Ionicons name={field.icon} size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={field.placeholder}
                placeholderTextColor={colors.textMuted}
                value={form[field.key]}
                onChangeText={v => set(field.key, v)}
                autoCapitalize={field.key === 'email' ? 'none' : 'words'}
                keyboardType={field.keyboard || 'default'}
              />
            </View>
          ))}

          {/* Mot de passe */}
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Mot de passe (min 8 caractères)"
              placeholderTextColor={colors.textMuted}
              value={form.password}
              onChangeText={v => set('password', v)}
              secureTextEntry={!showPass}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={{ padding: 6 }}>
              <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Certifications propriétaire */}
          {isProprietaire && (
            <View style={styles.certsBox}>
              <Text style={styles.certsTitle}>Certifications requises</Text>
              {CERTIFICATIONS.map(c => (
                <TouchableOpacity key={c.key} style={styles.certRow} onPress={() => toggleCert(c.key)}>
                  <View style={[styles.checkbox, certs[c.key] && styles.checkboxActive]}>
                    {certs[c.key] && <Ionicons name="checkmark" size={12} color="#000" />}
                  </View>
                  <Text style={styles.certLabel}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <TouchableOpacity
            onPress={handleRegister}
            disabled={loading || !toutAccepte}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={(!toutAccepte || loading) ? ['#555', '#555'] : [colors.primaryDark, colors.primary]}
              style={styles.btnPrimary}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.btnPrimaryText}>S'inscrire</Text>
              }
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
              Déjà un compte ? <Text style={{ color: colors.primary, fontWeight: '700' }}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.background },
  scroll:      { flexGrow: 1, padding: 20 },
  header:      { flexDirection: 'row', alignItems: 'center', marginTop: 50, marginBottom: 24, gap: 14 },
  backBtn:     { padding: 4 },
  title:       { fontSize: 22, fontWeight: '800', color: colors.text },
  rolesRow:    { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleCard:    { flex: 1, backgroundColor: colors.backgroundCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  roleCardActive: { borderColor: colors.primary },
  roleEmoji:   { fontSize: 22, marginBottom: 4 },
  roleLabel:   { fontSize: 14, fontWeight: '700', color: colors.text },
  roleDesc:    { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  form:        { backgroundColor: colors.backgroundCard, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: colors.border },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundLight, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14 },
  inputIcon:   { marginRight: 10 },
  input:       { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 13 },
  certsBox:    { backgroundColor: colors.backgroundLight, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  certsTitle:  { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 12 },
  certRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  checkbox:    { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  certLabel:   { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  btnPrimary:  { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 4 },
  btnPrimaryText: { fontSize: 16, fontWeight: '700', color: '#000' },
});
