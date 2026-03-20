import React from 'react';
import { TouchableOpacity, ImageBackground, StyleSheet, Linking, View, Text, Image } from 'react-native';

const AD_IMAGE = require('../../assets/tomorrows-yesterday-ad2.jpg');
const AD_LOGO = require('../../assets/tomorrows-yesterday-ad.jpg');

export default function AdBanner() {
  return (
    <TouchableOpacity
      activeOpacity={0.92}
      style={styles.wrap}
      onPress={() => Linking.openURL('https://historystartstoday.com')}
    >
      <ImageBackground source={AD_IMAGE} style={styles.image} imageStyle={styles.imageInner} resizeMode="cover">
        <View style={styles.overlay}>
          <View style={styles.topRow}>
            <View style={styles.copyCol}>
              <Text style={styles.kicker}>SPONSORED</Text>
              <Text style={styles.title}>Tomorrow’s Yesterday</Text>
              <Text style={styles.subtitle}>Streetwear drop live now</Text>
            </View>
            <Image source={AD_LOGO} style={styles.logoRight} resizeMode="cover" />
          </View>
          <View style={styles.ctaPill}>
            <Text style={styles.ctaText}>Shop historystartstoday.com</Text>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 8,
    marginTop: 10,
    marginBottom: 16,
    height: 132,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#111827',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageInner: {
    opacity: 0.95,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  copyCol: {
    flex: 1,
    paddingRight: 10,
  },
  logoRight: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  kicker: {
    alignSelf: 'flex-start',
    color: '#f3f4f6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 20,
  },
  subtitle: {
    color: '#e5e7eb',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  ctaPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: '#f59e0b',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ctaText: {
    color: '#111827',
    fontSize: 11,
    fontWeight: '800',
  },
});
