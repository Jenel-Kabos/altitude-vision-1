import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import Svg, {
  Rect, Circle, Path, Polygon, Defs,
  LinearGradient as SvgLinearGradient, Stop, G,
} from 'react-native-svg';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { fonts, fontSize, spacing } from '../../theme';

const { width: W } = Dimensions.get('window');
const H            = 270;
const LOGO         = require('../../../assets/Logo_Altitude_transparent.png');

function Scene() {
  return (
    <Svg width={W} height={H} viewBox="0 0 390 270" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <SvgLinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor="#060404" />
          <Stop offset="0.6" stopColor="#1C1008" />
          <Stop offset="1"   stopColor="#2D1A04" />
        </SvgLinearGradient>
        <SvgLinearGradient id="bldA" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#1E150A" />
          <Stop offset="1" stopColor="#0D0905" />
        </SvgLinearGradient>
        <SvgLinearGradient id="bldB" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#150F07" />
          <Stop offset="1" stopColor="#090604" />
        </SvgLinearGradient>
        <SvgLinearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#C8960C" stopOpacity="0.12" />
          <Stop offset="1" stopColor="#C8960C" stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>

      {/* Ciel */}
      <Rect x="0" y="0" width="390" height="270" fill="url(#sky)" />

      {/* Lune croissant doré */}
      <Circle cx="330" cy="52" r="30" fill="#C8960C" opacity="0.85" />
      <Circle cx="344" cy="43" r="23" fill="#1A0F05" />
      <Circle cx="330" cy="52" r="38" fill="none" stroke="#C8960C" strokeWidth="1" opacity="0.15" />

      {/* Étoiles */}
      {[
        [22,18],[48,10],[85,28],[125,14],[158,22],[200,8],[235,28],
        [265,16],[295,30],[358,22],[375,12],[15,45],[55,38],[105,42],
      ].map(([cx, cy], i) => (
        <Circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.8 : 1.1}
          fill="#F0EDE8" opacity={0.4 + 0.4 * (i % 3) / 2} />
      ))}

      {/* Tour gauche */}
      <Rect x="0" y="55" width="58" height="215" fill="url(#bldA)" />
      <Rect x="27" y="42" width="4" height="15" fill="#2A1B08" />
      <Circle cx="29" cy="41" r="3" fill="#C8960C" opacity="0.9" />
      {[[7,65],[22,65],[37,65],[7,82],[22,82],[37,82],[7,99],[22,99],
        [37,99],[7,116],[37,116],[7,133],[22,133]].map(([x,y],i) => (
        <Rect key={i} x={x} y={y} width="11" height="8" rx="1"
          fill="#C8960C" opacity={[.7,.5,.6,.4,.7,.3,.6,.5,.4,.7,.5,.6,.3][i]} />
      ))}

      {/* Immeuble moyen gauche */}
      <Rect x="62" y="95" width="48" height="175" fill="url(#bldB)" />
      {[[68,105],[83,105],[68,121],[83,121],[68,137],[83,137],[68,153],[83,153]].map(([x,y],i) => (
        <Rect key={i} x={x} y={y} width="12" height="9" rx="1"
          fill="#C8960C" opacity={[.6,.8,.4,.6,.7,.3,.5,.6][i]} />
      ))}

      {/* Grande tour droite */}
      <Rect x="292" y="38" width="68" height="232" fill="url(#bldA)" />
      <Rect x="324" y="24" width="4" height="16" fill="#2A1B08" />
      <Circle cx="326" cy="23" r="3.5" fill="#C8960C" opacity="0.95" />
      {[[300,50],[316,50],[333,50],[348,50],[300,67],[316,67],[333,67],[348,67],
        [300,84],[333,84],[348,84],[300,101],[316,101],[348,101],
        [300,118],[316,118],[333,118],[300,135],[348,135]].map(([x,y],i) => (
        <Rect key={i} x={x} y={y} width="12" height="9" rx="1"
          fill="#C8960C" opacity={[.8,.5,.7,.6,.6,.8,.4,.7,.5,.6,.8,.7,.5,.6,.8,.4,.6,.5,.7][i]} />
      ))}

      {/* Immeuble petit droit */}
      <Rect x="362" y="110" width="28" height="160" fill="url(#bldB)" />
      {[[366,118],[378,118],[366,132],[378,132]].map(([x,y],i) => (
        <Rect key={i} x={x} y={y} width="10" height="8" rx="1"
          fill="#C8960C" opacity={[.6,.7,.4,.5][i]} />
      ))}

      {/* Villa principale */}
      <Rect x="118" y="175" width="154" height="95" fill="#1E1309" />
      <Polygon points="108,175 195,118 282,175" fill="#2A1904" />
      <Rect x="188" y="113" width="14" height="7" fill="#C8960C" opacity="0.8" rx="1" />
      <Path d="M108,175 L195,118 L282,175" fill="none" stroke="#C8960C" strokeWidth="1.5" opacity="0.3" />
      <Rect x="130" y="188" width="34" height="28" rx="3" fill="#C8960C" opacity="0.45" />
      <Rect x="146" y="188" width="2"  height="28" fill="#110C05" opacity="0.5" />
      <Rect x="130" y="202" width="34" height="2"  fill="#110C05" opacity="0.5" />
      <Rect x="226" y="188" width="34" height="28" rx="3" fill="#C8960C" opacity="0.6" />
      <Rect x="242" y="188" width="2"  height="28" fill="#110C05" opacity="0.5" />
      <Rect x="226" y="202" width="34" height="2"  fill="#110C05" opacity="0.5" />
      <Rect x="174" y="218" width="42" height="52" rx="3" fill="#160E06" />
      <Path d="M174,232 Q195,214 216,232" fill="#C8960C" opacity="0.25" />
      <Circle cx="211" cy="245" r="3" fill="#C8960C" opacity="0.85" />
      <Rect x="209.5" y="245" width="5" height="8" rx="2" fill="#C8960C" opacity="0.6" />

      {/* Petite maison gauche */}
      <Rect x="78" y="200" width="52" height="70" fill="#160F07" />
      <Polygon points="70,200 104,170 134,200" fill="#251705" />
      <Rect x="88"  y="213" width="15" height="13" rx="1" fill="#C8960C" opacity="0.5" />
      <Rect x="109" y="213" width="15" height="13" rx="1" fill="#C8960C" opacity="0.7" />
      <Rect x="94"  y="235" width="23" height="35" rx="2" fill="#100A04" />

      {/* Petite maison droite */}
      <Rect x="260" y="205" width="46" height="65" fill="#160F07" />
      <Polygon points="252,205 283,177 316,205" fill="#251705" />
      <Rect x="268" y="218" width="13" height="12" rx="1" fill="#C8960C" opacity="0.6" />
      <Rect x="287" y="218" width="13" height="12" rx="1" fill="#C8960C" opacity="0.4" />
      <Rect x="272" y="238" width="20" height="32" rx="2" fill="#100A04" />

      {/* Palmier gauche */}
      <Path d="M60,270 Q62,235 66,205" stroke="#3A2810" strokeWidth="5" fill="none" strokeLinecap="round" />
      <Path d="M66,205 C48,188 35,195 28,183" stroke="#4A3518" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d="M66,205 C56,192 48,200 42,192" stroke="#4A3518" strokeWidth="3"   fill="none" strokeLinecap="round" />
      <Path d="M66,205 C76,188 90,192 95,182" stroke="#4A3518" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d="M66,205 C80,197 88,205 94,197" stroke="#4A3518" strokeWidth="3"   fill="none" strokeLinecap="round" />

      {/* Palmier droit */}
      <Path d="M325,270 Q323,235 318,200" stroke="#3A2810" strokeWidth="5" fill="none" strokeLinecap="round" />
      <Path d="M318,200 C300,183 287,188 280,177" stroke="#4A3518" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d="M318,200 C305,187 296,196 290,187" stroke="#4A3518" strokeWidth="3"   fill="none" strokeLinecap="round" />
      <Path d="M318,200 C330,183 344,188 350,177" stroke="#4A3518" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <Path d="M318,200 C334,191 340,200 347,191" stroke="#4A3518" strokeWidth="3"   fill="none" strokeLinecap="round" />

      {/* Sol */}
      <Rect x="0" y="258" width="390" height="12" fill="#0A0704" />
      <Rect x="0" y="250" width="390" height="20" fill="url(#glow)" />

      {/* Icône clé */}
      <G transform="translate(175, 82)">
        <Circle cx="0" cy="0" r="9"   fill="none" stroke="#C8960C" strokeWidth="2.5" opacity="0.8" />
        <Circle cx="0" cy="0" r="4.5" fill="none" stroke="#C8960C" strokeWidth="2"   opacity="0.8" />
        <Rect x="7"  y="-1.5" width="15" height="3" rx="1.5" fill="#C8960C" opacity="0.8" />
        <Rect x="18" y="1.5"  width="3"  height="5" rx="1.5" fill="#C8960C" opacity="0.8" />
        <Rect x="13" y="1.5"  width="3"  height="3" rx="1.5" fill="#C8960C" opacity="0.8" />
      </G>
    </Svg>
  );
}

export default function ImmobilierHero({ title, subtitle }) {
  return (
    <View style={s.container}>
      <Scene />
      <View style={s.overlay} pointerEvents="none">
        <Animated.View entering={FadeIn.delay(80).duration(700)} style={s.logoWrap}>
          <Image
            source={LOGO}
            style={s.logo}
            contentFit="contain"
            cachePolicy="memory"
            accessible={false}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(220).springify().damping(18)}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    width:    '100%',
    height:   H,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingBottom:  spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  logoWrap: {
    position: 'absolute',
    top:   spacing.xl,
    left:  0,
    right: 0,
    alignItems: 'center',
  },
  logo: {
    width:   80,
    height:  80,
    opacity: 0.92,
  },
  title: {
    fontFamily: fonts.displayItalic || fonts.display,
    fontSize:   38,
    color:      '#F0EDE8',
    lineHeight: 44,
    marginBottom: spacing.xs,
    textShadowColor:  'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize:   fontSize.sm,
    color:      'rgba(240,237,232,0.6)',
    letterSpacing: 0.4,
  },
});
