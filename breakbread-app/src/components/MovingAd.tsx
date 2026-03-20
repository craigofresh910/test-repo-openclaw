import React, { useEffect, useRef, useState } from 'react';
import { View, Image, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Linking } from 'react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 16;

const ADS = [
  require('../../assets/ads/ad1.jpg'),
  require('../../assets/ads/ad2.jpg'),
  require('../../assets/ads/ad3.jpg'),
  require('../../assets/ads/ad4.png'),
];

export default function MovingAd() {
  const scrollRef = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % ADS.length;
        scrollRef.current?.scrollTo({ x: next * CARD_WIDTH, animated: true });
        return next;
      });
    }, 3000);

    return () => clearInterval(id);
  }, []);

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => Linking.openURL('https://historystartstoday.com')}>
      <View style={styles.wrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const newIdx = Math.round(e.nativeEvent.contentOffset.x / CARD_WIDTH);
            setIdx(newIdx);
          }}
        >
          {ADS.map((img, i) => (
            <Image key={i} source={img} style={styles.img} resizeMode="cover" />
          ))}
        </ScrollView>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 92,
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 2,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  img: {
    width: CARD_WIDTH,
    height: 92,
  },
});
