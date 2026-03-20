import React from 'react';
import { TouchableOpacity, Image, StyleSheet, Linking } from 'react-native';

const AD_IMAGE = require('../../assets/tomorrows-yesterday-ad.jpg');

export default function AdBanner() {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.wrap}
      onPress={() => Linking.openURL('https://historystartstoday.com')}
    >
      <Image source={AD_IMAGE} style={styles.image} resizeMode="cover" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 16,
    height: 92,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
