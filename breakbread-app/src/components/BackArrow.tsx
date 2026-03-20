import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export default function BackArrow({ navigation }: { navigation: any }) {
  return (
    <TouchableOpacity
      style={styles.backBtn}
      onPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }}
      activeOpacity={0.8}
    >
      <Text style={styles.backIcon}>←</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    position: 'absolute',
    top: 50,
    left: 14,
    zIndex: 100,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 24,
  },
});
