import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { HouseIcon } from '../components';
import { fonts } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Icône par route ─────────────────────────────────────────────────────────

function RouteIcon({ routeName, focused, color, size }) {
  if (routeName === 'Annonces') {
    return <HouseIcon size={size} color={color} windowColor="transparent" />;
  }
  const icons = {
    Publier:  ['add-circle',    'add-circle-outline'],
    Carte:    ['map',           'map-outline'],
    Messages: ['chatbubbles',   'chatbubbles-outline'],
    Visites:  ['calendar',      'calendar-outline'],
    Profil:   ['person',        'person-outline'],
  };
  const [active, inactive] = icons[routeName] ?? ['ellipse', 'ellipse-outline'];
  return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
}

// ─── Item individuel (hooks propres, pas dans un .map) ───────────────────────

function TabItem({ route, isFocused, tabWidth, onPress, onLongPress, options, c }) {
  const scale        = useSharedValue(isFocused ? 1.15 : 1);
  const labelOpacity = useSharedValue(isFocused ? 1 : 0);
  const labelY       = useSharedValue(isFocused ? 0 : 4);

  useEffect(() => {
    scale.value        = withSpring(isFocused ? 1.15 : 1,  { damping: 10, stiffness: 320 });
    labelOpacity.value = withTiming(isFocused ? 1 : 0,     { duration: 160 });
    labelY.value       = withSpring(isFocused ? 0 : 4,     { damping: 14, stiffness: 280 });
  }, [isFocused]);

  const iconStyle  = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity:   labelOpacity.value,
    transform: [{ translateY: labelY.value }],
  }));

  const label = options.tabBarLabel ?? route.name;
  const color = isFocused ? c.gold : c.textMuted;

  return (
    <TouchableOpacity
      style={[styles.tab, { width: tabWidth }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={iconStyle}>
        <RouteIcon routeName={route.name} focused={isFocused} color={color} size={22} />
      </Animated.View>
      <Animated.Text style={[styles.label, { color }, labelStyle]} numberOfLines={1}>
        {label}
      </Animated.Text>
    </TouchableOpacity>
  );
}

// ─── Tab bar principale ───────────────────────────────────────────────────────

export default function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const { themeColors: c } = useTheme();

  const tabCount = state.routes.length;
  const tabWidth = SCREEN_WIDTH / tabCount;

  // Pill qui glisse horizontalement
  const pillX = useSharedValue(state.index * tabWidth);

  useEffect(() => {
    pillX.value = withSpring(state.index * tabWidth, { damping: 18, stiffness: 220 });
  }, [state.index, tabWidth]);

  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pillX.value }],
  }));

  const bottomPad = Platform.OS === 'ios' ? insets.bottom : 8;

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad, backgroundColor: c.bgCard, borderTopColor: c.border }]}>
      {/* Pill glissant derrière les icônes */}
      <Animated.View
        pointerEvents="none"
        style={[styles.pill, { width: tabWidth }, pillStyle]}
      />

      {/* Items */}
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        const isFocused  = state.index === index;

        const onPress = () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        return (
          <TabItem
            key={route.key}
            route={route}
            isFocused={isFocused}
            tabWidth={tabWidth}
            onPress={onPress}
            onLongPress={onLongPress}
            options={descriptor.options}
            c={c}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
    position: 'relative',
    // Ombre portée subtile (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 12,
  },
  pill: {
    position: 'absolute',
    top: 6,
    height: 36,
    borderRadius: 12,
    // Teinte dorée très subtile — visible en dark, quasi invisible en light
    backgroundColor: 'rgba(200, 150, 12, 0.10)',
    marginHorizontal: 6,
    width: undefined, // surchargé inline
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 2,
    gap: 3,
    minHeight: 52,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.2,
  },
});
