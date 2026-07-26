import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import Screen from '../../components/Screen';
import { SelectableCard } from '../../components/publication';
import { fonts, fontSize, spacing } from '../../theme';

const CHOICES = [
  {
    key: 'vente',
    icon: 'cash-outline',
    title: 'Vendre un bien',
    description: 'Maisons, appartements, terrains, bureaux…',
    screen: 'AddSaleProperty',
  },
  {
    key: 'location',
    icon: 'calendar-outline',
    title: 'Mettre un bien en location',
    description: 'Location longue durée ou meublée',
    screen: 'AddRentalProperty',
  },
  {
    key: 'hebergement',
    icon: 'bed-outline',
    title: 'Proposer un hébergement',
    description: 'Hôtel, résidence meublée, appartement meublé…',
    children: [
      {
        key: 'furnished_accommodation', icon: 'home-outline', title: 'Logement meublé',
        description: 'Appartement, maison, villa, studio ou bungalow meublé',
      },
      {
        key: 'hotel_establishment', icon: 'business-outline', title: 'Établissement hôtelier',
        description: "Hôtel, résidence hôtelière ou chambre d'hôtes",
      },
    ],
  },
];

export default function ChoixTypeAnnonceScreen({ navigation }) {
  const { themeColors: c } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [expanded, setExpanded] = React.useState(null);

  return (
    <Screen scroll>
      <Text style={styles.title}>Que souhaitez-vous publier ?</Text>
      <Text style={styles.subtitle}>Choisissez le type d'annonce à créer</Text>
      <View style={styles.list}>
        {CHOICES.map((choice) => (
          <React.Fragment key={choice.key}>
            <SelectableCard
              icon={choice.icon}
              title={choice.title}
              description={choice.description}
              onPress={() => choice.children ? setExpanded(expanded === choice.key ? null : choice.key) : navigation.navigate(choice.screen)}
            />
            {expanded === choice.key && choice.children?.map((child) => (
              <View key={child.key} style={styles.childCard}>
                <SelectableCard
                  icon={child.icon}
                  title={child.title}
                  description={child.description}
                  onPress={() => navigation.navigate('AddAccommodation', { publicationKind: child.key })}
                />
              </View>
            ))}
          </React.Fragment>
        ))}
      </View>
    </Screen>
  );
}

const makeStyles = (c) => StyleSheet.create({
  title: {
    fontFamily: fonts.displaySemi,
    fontSize: fontSize.display,
    color: c.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontFamily: fonts.body,
    fontSize: fontSize.md,
    color: c.textMuted,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.sm },
  childCard: { marginLeft: spacing.md },
});
