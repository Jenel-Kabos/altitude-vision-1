import React from 'react';
import { View, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={{
        flex: 1,
        backgroundColor: '#0A0A0A',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Text style={{
          color: '#C8960C',
          fontSize: 24,
          fontWeight: 'bold',
        }}>
          Altimmo — App en cours...
        </Text>
      </View>
    </GestureHandlerRootView>
  );
}
