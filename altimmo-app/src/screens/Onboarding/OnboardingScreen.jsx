import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Dimensions,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn,
  useSharedValue, useAnimatedStyle,
  withSpring, withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import Svg, {
  Path, Circle, Rect, Line, G,
  Defs, LinearGradient as SvgGradient, Stop,
} from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fonts, fontSize, spacing, radius } from '../../theme';

const { width, height } = Dimensions.get('window');

const LOGO = require('../../../assets/Logo_Altitude_transparent.png');

// ─── Données slides ───────────────────────────────────────────────────────────

const SLIDES = [
  {
    key: 'discover',
    eyebrow: 'DÉCOUVRIR',
    title: 'Les meilleurs biens\nimmobiliers du Congo',
    subtitle: 'Appartements, villas, terrains — toutes les offres du Congo Brazzaville réunies en un seul endroit.',
    bg: ['#0A0A0A', '#1C1408', '#2D1E04'],
    accent: '#C8960C',
    illustration: 'discover',
  },
  {
    key: 'connect',
    eyebrow: 'SE CONNECTER',
    title: 'Propriétaires\net acheteurs réunis',
    subtitle: 'Échangez directement, planifiez des visites et suivez vos biens favoris en temps réel.',
    bg: ['#050D1A', '#0D1E36', '#091520'],
    accent: '#4A90D9',
    illustration: 'connect',
  },
  {
    key: 'invest',
    eyebrow: 'INVESTIR EN CONFIANCE',
    title: 'Des biens vérifiés\npar nos experts',
    subtitle: "Chaque annonce est validée par l'équipe Altitude Vision pour sécuriser votre projet.",
    bg: ['#0A0A0A', '#1A0D05', '#100800'],
    accent: '#C8960C',
    illustration: 'invest',
  },
];

const ITEM_LAYOUT = { length: width, offset: 0 };

// ─── Illustrations SVG ────────────────────────────────────────────────────────

function IllustrationDiscover({ accent }) {
  return (
    <Svg width={220} height={220} viewBox="0 0 220 220">
      <Defs>
        <SvgGradient id="glow1" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity="0.3" />
          <Stop offset="1" stopColor={accent} stopOpacity="0" />
        </SvgGradient>
        <SvgGradient id="roof1" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity="1" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.6" />
        </SvgGradient>
      </Defs>
      <Circle cx="110" cy="115" r="78" fill="url(#glow1)" />
      <Rect x="20" y="90" width="38" height="90" rx="2" fill="none" stroke="rgba(200,150,12,0.25)" strokeWidth="1.5" />
      <Rect x="26" y="98" width="10" height="10" rx="1" fill="rgba(200,150,12,0.3)" />
      <Rect x="42" y="98" width="10" height="10" rx="1" fill="rgba(200,150,12,0.2)" />
      <Rect x="26" y="116" width="10" height="10" rx="1" fill="rgba(200,150,12,0.15)" />
      <Rect x="42" y="116" width="10" height="10" rx="1" fill="rgba(200,150,12,0.3)" />
      <Rect x="162" y="78" width="34" height="102" rx="2" fill="none" stroke="rgba(200,150,12,0.25)" strokeWidth="1.5" />
      <Rect x="168" y="86" width="9" height="9" rx="1" fill="rgba(200,150,12,0.25)" />
      <Rect x="182" y="86" width="9" height="9" rx="1" fill="rgba(200,150,12,0.15)" />
      <Rect x="168" y="102" width="9" height="9" rx="1" fill="rgba(200,150,12,0.3)" />
      <Line x1="14" y1="180" x2="206" y2="180" stroke="rgba(200,150,12,0.2)" strokeWidth="1.5" />
      <Path d="M62 180 L62 108 L110 72 L158 108 L158 180 Z" fill="#1A1208" stroke={accent} strokeWidth="2.5" strokeLinejoin="round" />
      <Path d="M52 112 L110 68 L168 112" fill="url(#roof1)" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="94" y="144" width="32" height="36" rx="16" fill="none" stroke={accent} strokeWidth="2" />
      <Rect x="68" y="120" width="26" height="22" rx="3" fill={`${accent}40`} stroke={accent} strokeWidth="1.8" />
      <Line x1="81" y1="120" x2="81" y2="142" stroke={accent} strokeWidth="1" opacity="0.6" />
      <Line x1="68" y1="131" x2="94" y2="131" stroke={accent} strokeWidth="1" opacity="0.6" />
      <Rect x="126" y="120" width="26" height="22" rx="3" fill={`${accent}40`} stroke={accent} strokeWidth="1.8" />
      <Line x1="139" y1="120" x2="139" y2="142" stroke={accent} strokeWidth="1" opacity="0.6" />
      <Line x1="126" y1="131" x2="152" y2="131" stroke={accent} strokeWidth="1" opacity="0.6" />
      <Rect x="136" y="52" width="72" height="28" rx="14" fill="#1A1208" stroke={accent} strokeWidth="2" />
      <Path d="M158 80 L162 90 L166 80" fill="#1A1208" stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      <Line x1="162" y1="80" x2="162" y2="89" stroke="#1A1208" strokeWidth="3" />
      <Circle cx="48" cy="56" r="3" fill={accent} opacity="0.7" />
      <Circle cx="178" cy="48" r="2.5" fill={accent} opacity="0.5" />
      <Circle cx="30" cy="148" r="2" fill={accent} opacity="0.4" />
    </Svg>
  );
}

function IllustrationConnect({ accent }) {
  return (
    <Svg width={220} height={220} viewBox="0 0 220 220">
      <Defs>
        <SvgGradient id="glow2" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity="0.2" />
          <Stop offset="1" stopColor={accent} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Circle cx="110" cy="110" r="80" fill="url(#glow2)" />
      <Circle cx="62" cy="82" r="28" fill="#0D1E36" stroke={accent} strokeWidth="2.5" />
      <Circle cx="62" cy="76" r="10" fill="none" stroke={accent} strokeWidth="2" />
      <Path d="M40 98 Q42 88 62 88 Q82 88 84 98" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="158" cy="82" r="28" fill="#0D1E36" stroke={accent} strokeWidth="2.5" />
      <Circle cx="158" cy="76" r="10" fill="none" stroke={accent} strokeWidth="2" />
      <Path d="M136 98 Q138 88 158 88 Q178 88 180 98" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" />
      <Line x1="92" y1="82" x2="128" y2="82" stroke={accent} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />
      <Path d="M122 76 L130 82 L122 88" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M22 120 Q22 110 32 110 L96 110 Q106 110 106 120 L106 148 Q106 158 96 158 L56 158 L46 168 L46 158 L32 158 Q22 158 22 148 Z" fill="#0D1E36" stroke={accent} strokeWidth="2" />
      <Path d="M54 144 L54 132 L64 124 L74 132 L74 144 Z" fill="none" stroke={accent} strokeWidth="1.8" strokeLinejoin="round" />
      <Path d="M50 134 L64 122 L78 134" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="59" y="136" width="10" height="8" rx="5" fill="none" stroke={accent} strokeWidth="1.5" />
      <Path d="M114 128 Q114 118 124 118 L190 118 Q200 118 200 128 L200 150 Q200 160 190 160 L174 160 L174 170 L164 160 L124 160 Q114 160 114 150 Z" fill="#0D1E36" stroke={accent} strokeWidth="2" />
      <Circle cx="143" cy="139" r="4" fill={accent} opacity="0.9" />
      <Circle cx="157" cy="139" r="4" fill={accent} opacity="0.65" />
      <Circle cx="171" cy="139" r="4" fill={accent} opacity="0.4" />
      <Circle cx="110" cy="50" r="3.5" fill={accent} opacity="0.6" />
      <Circle cx="30" cy="90" r="2" fill={accent} opacity="0.4" />
      <Circle cx="196" cy="92" r="2.5" fill={accent} opacity="0.5" />
    </Svg>
  );
}

function IllustrationInvest({ accent }) {
  return (
    <Svg width={220} height={220} viewBox="0 0 220 220">
      <Defs>
        <SvgGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity="0.25" />
          <Stop offset="1" stopColor={accent} stopOpacity="0.05" />
        </SvgGradient>
        <SvgGradient id="glow3" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={accent} stopOpacity="0.2" />
          <Stop offset="1" stopColor={accent} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Circle cx="110" cy="105" r="82" fill="url(#glow3)" />
      <Path d="M110 38 L168 62 L168 112 Q168 152 110 178 Q52 152 52 112 L52 62 Z" fill="url(#shieldGrad)" stroke={accent} strokeWidth="3" strokeLinejoin="round" />
      <Path d="M80 108 L100 128 L142 88" fill="none" stroke={accent} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <G transform="translate(148, 148) rotate(-35)">
        <Circle cx="0" cy="0" r="14" fill="none" stroke={accent} strokeWidth="2.5" />
        <Line x1="14" y1="0" x2="36" y2="0" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="30" y1="0" x2="30" y2="7" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
        <Line x1="23" y1="0" x2="23" y2="5" stroke={accent} strokeWidth="2.5" strokeLinecap="round" />
      </G>
      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <Line
            key={i}
            x1={110 + Math.cos(rad) * 88}
            y1={105 + Math.sin(rad) * 88}
            x2={110 + Math.cos(rad) * 98}
            y2={105 + Math.sin(rad) * 98}
            stroke={accent}
            strokeWidth="1.5"
            strokeLinecap="round"
            opacity="0.4"
          />
        );
      })}
      <Circle cx="158" cy="52" r="18" fill="#1A0D05" stroke={accent} strokeWidth="2" />
      <Path d="M149 52 L155 58 L167 46" fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx="42" cy="68" r="3" fill={accent} opacity="0.5" />
      <Circle cx="180" cy="170" r="2.5" fill={accent} opacity="0.4" />
      <Circle cx="52" cy="170" r="2" fill={accent} opacity="0.3" />
    </Svg>
  );
}

const ILLUSTRATIONS = {
  discover: IllustrationDiscover,
  connect:  IllustrationConnect,
  invest:   IllustrationInvest,
};

// ─── Dot animé ────────────────────────────────────────────────────────────────

const DotItem = React.memo(function DotItem({ active, accent }) {
  const w  = useSharedValue(active ? 22 : 6);
  const op = useSharedValue(active ? 1 : 0.3);

  useEffect(() => {
    w.value  = withSpring(active ? 22 : 6,  { damping: 14, stiffness: 300 });
    op.value = withTiming(active ? 1 : 0.3, { duration: 200 });
  }, [active]);

  const style = useAnimatedStyle(() => ({ width: w.value, opacity: op.value }));
  return <Animated.View style={[dotStyles.dot, { backgroundColor: accent }, style]} />;
});

const dotStyles = StyleSheet.create({
  dot: { height: 6, borderRadius: 3 },
});

// ─── Slide item ───────────────────────────────────────────────────────────────

const SlideItem = React.memo(function SlideItem({ item }) {
  const Illus = ILLUSTRATIONS[item.illustration];
  return (
    <LinearGradient colors={item.bg} style={styles.slide}>
      <SafeAreaView style={styles.slideInner} edges={['top']}>
        {/* Logo */}
        <Animated.View entering={FadeIn.duration(700)} style={styles.logoWrap}>
          <Image
            source={LOGO}
            style={styles.logo}
            contentFit="contain"
            cachePolicy="memory"
            accessible={false}
          />
        </Animated.View>

        {/* Illustration */}
        <Animated.View
          key={`illus-${item.key}`}
          entering={FadeInDown.delay(80).springify().damping(18)}
          style={styles.illustrationWrap}
        >
          <Illus accent={item.accent} />
        </Animated.View>

        {/* Texte */}
        <Animated.View
          key={`text-${item.key}`}
          entering={FadeInDown.delay(200).springify().damping(18)}
          style={styles.textWrap}
        >
          <Text style={[styles.eyebrow, { color: item.accent }]}>{item.eyebrow}</Text>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
});

// ─── Écran principal ──────────────────────────────────────────────────────────

export default function OnboardingScreen({ onDone, onLogin }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatRef = useRef(null);

  const current = useMemo(() => SLIDES[currentIndex], [currentIndex]);
  const isLast  = currentIndex === SLIDES.length - 1;

  const goToSlide = useCallback((index) => {
    flatRef.current?.scrollToIndex({ index, animated: true });
    setCurrentIndex(index);
  }, []);

  const goNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) goToSlide(currentIndex + 1);
    else handleDone();
  }, [currentIndex, goToSlide]);

  const handleDone = useCallback(async () => {
    await AsyncStorage.setItem('onboarding_complete', '1');
    onDone?.();
  }, [onDone]);

  const handleLogin = useCallback(async () => {
    await AsyncStorage.setItem('onboarding_complete', '1');
    onLogin?.();
  }, [onLogin]);

  const onMomentumScrollEnd = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentIndex(idx);
  }, []);

  const getItemLayout = useCallback((_, index) => ({
    length: width,
    offset: width * index,
    index,
  }), []);

  const keyExtractor = useCallback((item) => item.key, []);

  const renderItem = useCallback(({ item }) => <SlideItem item={item} />, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0A" />

      {/* Slides horizontales */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onMomentumScrollEnd}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={2}
      />

      {/* Contrôles superposés */}
      <SafeAreaView style={styles.controls} edges={['bottom']} pointerEvents="box-none">

        {/* Dots */}
        <View style={styles.dotsRow}>
          {SLIDES.map((s, i) => (
            <TouchableOpacity
              key={s.key}
              onPress={() => goToSlide(i)}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={`Aller à la slide ${i + 1}`}
              accessibilityState={{ selected: i === currentIndex }}
            >
              <DotItem active={i === currentIndex} accent={current.accent} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Boutons principaux */}
        {!isLast ? (
          <View style={styles.btnRow}>
            <TouchableOpacity
              onPress={handleDone}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Passer l'introduction"
            >
              <Text style={styles.skip}>Passer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: current.accent }]}
              onPress={goNext}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Diapositive suivante"
            >
              <Text style={styles.nextText}>Suivant →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.startBtn, { backgroundColor: current.accent }]}
            onPress={handleDone}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Commencer"
          >
            <Text style={styles.startText}>Découvrir Altimmo</Text>
          </TouchableOpacity>
        )}

        {/* Lien "Déjà un compte" */}
        {onLogin && (
          <TouchableOpacity
            onPress={handleLogin}
            hitSlop={8}
            style={styles.loginLink}
            accessibilityRole="button"
            accessibilityLabel="Se connecter avec un compte existant"
          >
            <Text style={styles.loginLinkText}>
              Déjà un compte ?{'  '}
              <Text style={[styles.loginLinkBold, { color: current.accent }]}>
                Se connecter
              </Text>
            </Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0A' },

  slide:      { width, height },
  slideInner: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: 180,
  },

  logoWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  logo: {
    width: 72,
    height: 72,
    opacity: 0.88,
  },

  illustrationWrap: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },

  textWrap: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  eyebrow: {
    fontFamily: fonts.body,
    fontSize: 10,
    letterSpacing: 3.5,
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: fonts.displayItalic,
    fontSize: 34,
    color: '#F0EDE8',
    lineHeight: 42,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: 'rgba(240,237,232,0.55)',
    lineHeight: 24,
  },

  // ─── Contrôles ───
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  skip: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: 'rgba(240,237,232,0.4)',
  },
  nextBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  nextText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: '#0A0A0A',
  },
  startBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
  },
  startText: {
    fontFamily: fonts.bodyBold,
    fontSize: fontSize.md,
    color: '#0A0A0A',
    letterSpacing: 0.5,
  },

  // ─── Lien connexion ───
  loginLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  loginLinkText: {
    fontFamily: fonts.body,
    fontSize: fontSize.sm,
    color: 'rgba(240,237,232,0.45)',
  },
  loginLinkBold: {
    fontFamily: fonts.bodyBold,
  },
});
