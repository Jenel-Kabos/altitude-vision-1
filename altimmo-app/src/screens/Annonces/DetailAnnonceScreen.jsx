import React, { useState } from 'react';
import {
  View, Text, ScrollView, Image,
  TouchableOpacity, StyleSheet,
  FlatList, Dimensions, Linking,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function DetailAnnonceScreen({ route, navigation }) {
  const { annonce } = route.params;
  const [photoIndex, setPhotoIndex] = useState(0);

  const photos = annonce.images || annonce.photos || [];

  const prix = annonce.price || annonce.loyer || 0;

  const isLocation =
    annonce.transactionType === 'location' ||
    annonce.type === 'Location';

  const appelerProprietaire = () => {
    const tel = annonce.owner?.phone ||
      annonce.proprietaire?.telephone ||
      '+242068002151';
    Linking.openURL(`tel:${tel}`);
  };

  const whatsappProprietaire = () => {
    const tel = (annonce.owner?.phone || '+242068002151')
      .replace(/\s/g, '')
      .replace('+', '');
    const msg = encodeURIComponent(
      `Bonjour, je suis intéressé par votre bien : ${annonce.title}`
    );
    Linking.openURL(`https://wa.me/${tel}?text=${msg}`);
  };

  const demanderVisite = () => {
    Alert.alert(
      'Demander une visite',
      `Voulez-vous demander une visite pour "${annonce.title}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: () => Alert.alert(
            '✅ Demande envoyée',
            'Un agent vous contactera sous 24h'
          )
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header flottant */}
      <View style={styles.headerFlottant}>
        <TouchableOpacity
          style={styles.boutonRetour}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.boutonRetour}>
          <Ionicons name="heart-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Galerie photos */}
        {photos.length > 0 ? (
          <View>
            <FlatList
              data={photos}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / width
                );
                setPhotoIndex(index);
              }}
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item }}
                  style={styles.photo}
                  resizeMode="cover"
                />
              )}
              keyExtractor={(_, i) => i.toString()}
            />
            {/* Indicateur photos */}
            <View style={styles.indicateur}>
              <Text style={styles.indicateurTxt}>
                {photoIndex + 1}/{photos.length}
              </Text>
            </View>
          </View>
        ) : (
          <Image
            source={{
              uri: 'https://via.placeholder.com/400x250/1A1A1A/C8960C?text=Altimmo'
            }}
            style={styles.photo}
          />
        )}

        <View style={styles.content}>
          {/* Badge type */}
          <View style={styles.badgeRow}>
            <View style={[
              styles.badge,
              { backgroundColor: isLocation ? '#3B82F6' : '#22C55E' }
            ]}>
              <Text style={styles.badgeTxt}>
                {isLocation ? 'LOCATION' : 'VENTE'}
              </Text>
            </View>
            {annonce.propertyType && (
              <View style={styles.badgeType}>
                <Text style={styles.badgeTypeTxt}>
                  {annonce.propertyType}
                </Text>
              </View>
            )}
          </View>

          {/* Titre et prix */}
          <Text style={styles.titre}>{annonce.title}</Text>
          <Text style={styles.prix}>
            {prix.toLocaleString('fr-FR')} FCFA
            {isLocation ? '/mois' : ''}
          </Text>

          {/* Localisation */}
          <View style={styles.row}>
            <Ionicons name="location" size={18} color="#C8960C" />
            <Text style={styles.localisation}>
              {annonce.location?.neighborhood
                && `${annonce.location.neighborhood}, `}
              {annonce.location?.city || 'Brazzaville'}
            </Text>
          </View>

          {/* Caractéristiques */}
          <View style={styles.caract}>
            {annonce.bedrooms > 0 && (
              <View style={styles.caractItem}>
                <Ionicons name="bed" size={20} color="#C8960C" />
                <Text style={styles.caractTxt}>
                  {annonce.bedrooms} Ch.
                </Text>
              </View>
            )}
            {annonce.bathrooms > 0 && (
              <View style={styles.caractItem}>
                <Ionicons name="water" size={20} color="#C8960C" />
                <Text style={styles.caractTxt}>
                  {annonce.bathrooms} SDB
                </Text>
              </View>
            )}
            {annonce.area > 0 && (
              <View style={styles.caractItem}>
                <Ionicons name="expand" size={20} color="#C8960C" />
                <Text style={styles.caractTxt}>
                  {annonce.area} m²
                </Text>
              </View>
            )}
          </View>

          <View style={styles.sep} />

          {/* Description */}
          {annonce.description && (
            <>
              <Text style={styles.sectionTitre}>Description</Text>
              <Text style={styles.description}>
                {annonce.description}
              </Text>
              <View style={styles.sep} />
            </>
          )}

          {/* Commodités */}
          {annonce.amenities?.length > 0 && (
            <>
              <Text style={styles.sectionTitre}>Commodités</Text>
              <View style={styles.commodites}>
                {annonce.amenities.map((c, i) => (
                  <View key={i} style={styles.commodite}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#22C55E"
                    />
                    <Text style={styles.commoditeTxt}>{c}</Text>
                  </View>
                ))}
              </View>
              <View style={styles.sep} />
            </>
          )}

          {/* Espace pour les boutons */}
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      {/* Boutons d'action fixes en bas */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.btnVisiter}
          onPress={demanderVisite}
        >
          <Ionicons name="calendar" size={20} color="#000" />
          <Text style={styles.btnVisiterTxt}>Visiter</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnWhatsapp}
          onPress={whatsappProprietaire}
        >
          <Ionicons name="logo-whatsapp" size={20} color="#FFF" />
          <Text style={styles.btnWhatsappTxt}>WhatsApp</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnAppel}
          onPress={appelerProprietaire}
        >
          <Ionicons name="call" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A'
  },
  headerFlottant: {
    position: 'absolute',
    top: 45,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    zIndex: 10
  },
  boutonRetour: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8
  },
  photo: {
    width: width,
    height: 300
  },
  indicateur: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  indicateurTxt: {
    color: '#FFF',
    fontSize: 12
  },
  content: {
    padding: 16
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6
  },
  badgeTxt: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold'
  },
  badgeType: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#2A2A2A'
  },
  badgeTypeTxt: {
    color: '#999',
    fontSize: 11
  },
  titre: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
    lineHeight: 28
  },
  prix: {
    color: '#C8960C',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16
  },
  localisation: {
    color: '#999',
    fontSize: 15
  },
  caract: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16
  },
  caractItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  caractTxt: {
    color: '#FFF',
    fontSize: 14
  },
  sep: {
    height: 1,
    backgroundColor: '#2A2A2A',
    marginVertical: 16
  },
  sectionTitre: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10
  },
  description: {
    color: '#999',
    fontSize: 15,
    lineHeight: 24
  },
  commodites: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10
  },
  commodite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20
  },
  commoditeTxt: {
    color: '#CCC',
    fontSize: 13
  },
  actionsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 30,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
    gap: 12
  },
  btnVisiter: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#C8960C',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  btnVisiterTxt: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16
  },
  btnWhatsapp: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#25D366',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  btnWhatsappTxt: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16
  },
  btnAppel: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: 52
  }
});
