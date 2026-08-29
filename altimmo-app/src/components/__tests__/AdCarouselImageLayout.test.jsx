import React from 'react';
import { StyleSheet } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import AdCarousel from '../AdCarousel';

jest.mock('expo-image', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockExpoImage = React.forwardRef((props, ref) => (
    <View ref={ref} testID="ad-carousel-image" {...props} />
  ));
  MockExpoImage.displayName = 'MockExpoImage';
  return { Image: MockExpoImage };
});

const AD = {
  _id: 'ad-layout-1',
  titre: 'Altimmo',
  media: 'https://example.test/altimmo-ad.jpg',
};

describe('AdCarousel — contrat de surface image', () => {
  test('l’image publicitaire remplit explicitement son slide', () => {
    render(<AdCarousel items={[AD]} />);

    const style = StyleSheet.flatten(screen.getByTestId('ad-carousel-image').props.style);
    expect(style).toEqual(expect.objectContaining({ width: '100%', height: '100%' }));
  });

  test('la source publicitaire reste transmise sous la forme { uri }', () => {
    render(<AdCarousel items={[AD]} />);

    expect(screen.getByTestId('ad-carousel-image').props.source).toEqual({ uri: AD.media });
  });

  test('une liste vide conserve le fallback existant sans image rendue', () => {
    render(<AdCarousel items={[]} />);

    expect(screen.queryByTestId('ad-carousel-image')).toBeNull();
  });
});
