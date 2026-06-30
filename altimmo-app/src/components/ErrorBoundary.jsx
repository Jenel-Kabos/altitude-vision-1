import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, fontSize, spacing } from '../theme';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // En production, Sentry capturera l'erreur ici via son intégration globale.
    // On loggue en dev uniquement.
    if (__DEV__) console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Ionicons name="warning-outline" size={56} color={colors.error} />
        <Text style={styles.title}>Quelque chose s'est mal passé</Text>
        <Text style={styles.subtitle}>
          Une erreur inattendue est survenue. Notre équipe en a été informée.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => this.setState({ hasError: false, error: null })}
          activeOpacity={0.8}
        >
          <Text style={styles.btnText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.lg,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: colors.textSub,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    marginTop: spacing.sm,
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
  },
  btnText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: '#000',
  },
});
