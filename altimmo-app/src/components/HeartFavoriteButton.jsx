import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

// 6 particules réparties à 60° d'intervalle
const ANGLES = [0, 60, 120, 180, 240, 300].map(d => (d * Math.PI) / 180);
const DIST   = 26; // distance en pixels à l'explosion
const HEART_COLOR   = '#C8960C'; // gold
const PARTICLE_COLOR = '#FFD66B'; // gold clair

export default function HeartFavoriteButton({
  liked,
  onPress,
  size = 22,
  style,
  accessibilityLabel,
}) {
  // ─── Valeurs partagées ──────────────────────────────────────────
  const heartScale   = useSharedValue(1);
  const burstP       = useSharedValue(0); // 0→1 pilote toutes les particules
  const ringScale    = useSharedValue(0);
  const ringOpacity  = useSharedValue(0);

  // ─── Styles animés ─────────────────────────────────────────────
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));

  // Fabrique le style d'une particule à l'angle donné
  const makeParticleStyle = (angle) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useAnimatedStyle(() => ({
      opacity: interpolate(burstP.value, [0, 0.25, 0.8, 1], [0, 1, 0.6, 0], Extrapolation.CLAMP),
      transform: [
        { translateX: interpolate(burstP.value, [0, 1], [0, Math.cos(angle) * DIST], Extrapolation.CLAMP) },
        { translateY: interpolate(burstP.value, [0, 1], [0, Math.sin(angle) * DIST], Extrapolation.CLAMP) },
        { scale:      interpolate(burstP.value, [0, 0.3, 1], [0, 1.2, 0.4], Extrapolation.CLAMP) },
      ],
    }));

  // 6 styles de particules (nb fixe → règles des hooks respectées)
  const p0 = makeParticleStyle(ANGLES[0]);
  const p1 = makeParticleStyle(ANGLES[1]);
  const p2 = makeParticleStyle(ANGLES[2]);
  const p3 = makeParticleStyle(ANGLES[3]);
  const p4 = makeParticleStyle(ANGLES[4]);
  const p5 = makeParticleStyle(ANGLES[5]);
  const particleStyles = [p0, p1, p2, p3, p4, p5];

  // ─── Déclencheur ────────────────────────────────────────────────
  const triggerAnimation = (nowLiked) => {
    if (nowLiked) {
      // ── LIKE : explosion complète ──
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Cœur : compression → explosion → retombée
      heartScale.value = withSequence(
        withSpring(0.5, { damping: 20, stiffness: 600 }),
        withSpring(1.5, { damping: 3,  stiffness: 500 }),
        withSpring(1.0, { damping: 12, stiffness: 300 }),
      );

      // Anneau qui s'étend
      ringScale.value   = 0;
      ringOpacity.value = 0;
      ringScale.value   = withTiming(2.2, { duration: 450 });
      ringOpacity.value = withSequence(
        withTiming(0.9, { duration: 80 }),
        withTiming(0,   { duration: 370 }),
      );

      // Particules
      burstP.value = 0;
      burstP.value = withTiming(1, { duration: 550 });

    } else {
      // ── UNLIKE : petit rebound discret ──
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      heartScale.value = withSequence(
        withSpring(0.75, { damping: 10, stiffness: 400 }),
        withSpring(1.0,  { damping: 10, stiffness: 300 }),
      );
    }
  };

  const handlePress = () => {
    const nextLiked = !liked;
    triggerAnimation(nextLiked);
    onPress?.(nextLiked);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (liked ? 'Retirer des favoris' : 'Ajouter aux favoris')}
      accessibilityState={{ selected: liked }}
      style={[styles.container, style]}
    >
      {/* Anneau d'expansion */}
      <Animated.View
        pointerEvents="none"
        style={[styles.ring, { width: size * 1.6, height: size * 1.6, borderRadius: size * 0.8 }, ringStyle]}
      />

      {/* Particules */}
      {ANGLES.map((_, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[styles.particle, particleStyles[i]]}
        >
          <View style={styles.dot} />
        </Animated.View>
      ))}

      {/* Cœur principal */}
      <Animated.View style={heartStyle}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? HEART_COLOR : '#ffffff'}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: HEART_COLOR,
  },
  particle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: PARTICLE_COLOR,
  },
});
