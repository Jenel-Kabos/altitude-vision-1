import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import RecommendedCarousel from '../RecommendedCarousel';

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ themeColors: require('../../theme/colors').colors }),
}));

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockExpoImage = React.forwardRef((props, ref) => (
    <View ref={ref} testID="recommended-image" {...props} />
  ));
  MockExpoImage.displayName = 'MockExpoImage';
  return {
    Image: MockExpoImage,
  };
});

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { Ionicons: (props) => <View {...props} /> };
});

const BASE_PROPERTY = {
  _id: 'recommended-layout-1',
  title: 'Bien recommandé',
  type: 'Villa',
  status: 'vente',
  price: 150000000,
  address: { city: 'Brazzaville' },
};

describe('RecommendedCarousel — contrat de surface image', () => {
  test('l’image distante remplit explicitement son wrapper', () => {
    render(
      <RecommendedCarousel
        properties={[{ ...BASE_PROPERTY, images: ['https://example.test/property.jpg'] }]}
      />,
    );

    const image = screen.getByTestId('recommended-image');
    const style = StyleSheet.flatten(image.props.style);

    expect(style).toEqual(expect.objectContaining({ width: '100%', height: '100%' }));
  });

  test('la source distante reste transmise sous la forme { uri }', () => {
    const uri = 'https://example.test/property.jpg';
    render(<RecommendedCarousel properties={[{ ...BASE_PROPERTY, images: [uri] }]} />);

    expect(screen.getByTestId('recommended-image').props.source).toEqual({ uri });
  });

  test('le placeholder local reste utilisé quand aucune image n’est disponible', () => {
    render(<RecommendedCarousel properties={[BASE_PROPERTY]} />);

    const source = screen.getByTestId('recommended-image').props.source;
    expect(source).toBeTruthy();
    expect(source).not.toEqual(expect.objectContaining({ uri: expect.anything() }));
  });
});
