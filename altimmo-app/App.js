import React from 'react';
import { View, Text } from 'react-native';

export default function App() {
  return (
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
        Altimmo ✓
      </Text>
    </View>
  );
}
