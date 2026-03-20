import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

const HOME_LOGO = require('../../assets/breakbread-logo.png');

export default function AppHeader() {
  return (
    <View style={styles.header}>
      <Image source={HOME_LOGO} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    backgroundColor: '#f59e0b',
    paddingTop: 50,
    paddingBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { width: 180, height: 44, borderRadius: 12, marginTop: 8 },
});
