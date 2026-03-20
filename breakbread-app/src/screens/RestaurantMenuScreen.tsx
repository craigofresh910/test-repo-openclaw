import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from 'react-native';
import BackArrow from '../components/BackArrow';
import AppHeader from '../components/AppHeader';
import { getRestaurantWebsite } from '../services/api';
import { WebView } from 'react-native-webview';

const getPopularItems = (restaurantName: string) => {
  const n = restaurantName.toLowerCase();

  if (n.includes('pizza')) {
    return ['🍕 Pepperoni Pizza', '🧄 Garlic Bread', '🥗 Caesar Salad', '🥤 Fountain Drink'];
  }
  if (n.includes('sushi') || n.includes('japanese') || n.includes('ramen')) {
    return ['🍣 California Roll', '🍣 Spicy Tuna Roll', '🍜 Tonkotsu Ramen', '🍤 Shrimp Tempura'];
  }
  if (n.includes('taco') || n.includes('mex')) {
    return ['🌮 Street Tacos', '🌯 Chicken Burrito', '🧀 Quesadilla', '🥑 Chips & Guac'];
  }
  if (n.includes('burger') || n.includes('grill') || n.includes('bbq')) {
    return ['🍔 Classic Burger', '🍟 Loaded Fries', '🍗 Crispy Wings', '🥤 House Soda'];
  }
  if (n.includes('ital')) {
    return ['🍝 Spaghetti Bolognese', '🧀 Fettuccine Alfredo', '🍗 Chicken Parmesan', '🥖 Garlic Knots'];
  }
  if (n.includes('thai')) {
    return ['🍜 Pad Thai', '🍛 Green Curry', '🥟 Spring Rolls', '🍚 Fried Rice'];
  }

  return ['🔥 House Special', '⭐ Top Seller', '🍽️ Chef Favorite', '🥤 Popular Combo'];
};

export default function RestaurantMenuScreen({ route, navigation }: any) {
  const { restaurant } = route.params;
  const [website, setWebsite] = useState<string | undefined>(restaurant?.website);
  const [showWebsitePanel, setShowWebsitePanel] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!website && restaurant?.place_id) {
        const w = await getRestaurantWebsite(restaurant.place_id);
        if (active && w) setWebsite(w);
      }
    })();
    return () => {
      active = false;
    };
  }, [restaurant?.place_id]);


  return (
    <View style={{ flex: 1 }}>
      <AppHeader />
      <BackArrow navigation={navigation} />
      <ScrollView>
        <Image source={{ uri: restaurant.photo || 'https://via.placeholder.com/400' }} style={styles.hero} />
        <View style={styles.content}>
          <Text style={styles.title}>{restaurant.name}</Text>
          <View style={styles.row}>
            {restaurant.rating && <Text style={styles.rating}>⭐ {restaurant.rating}</Text>}
            <Text style={styles.address}>{restaurant.address}</Text>
          </View>

          <View style={styles.popularWrap}>
            <Text style={styles.popularTitle}>Most Popular</Text>
            {getPopularItems(restaurant.name).slice(0, 4).map((item, idx) => (
              <View key={idx} style={styles.popularItem}>
                <Text style={styles.popularItemText}>{item}</Text>
              </View>
            ))}
          </View>
          
          {website ? (
            <TouchableOpacity
              style={styles.websiteBtn}
              onPress={() => setShowWebsitePanel(true)}
            >
              <Text style={styles.websiteBtnText}>🌐 Visit Website</Text>
            </TouchableOpacity>
          ) : null}

          {showWebsitePanel && website ? (
            <View style={styles.webPanelWrap}>
              <View style={styles.webPanelHeader}>
                <TouchableOpacity onPress={() => setShowWebsitePanel(false)}>
                  <Text style={styles.webCloseText}>Close</Text>
                </TouchableOpacity>
                <Text style={styles.webTitle} numberOfLines={1}>{restaurant.name}</Text>
                <TouchableOpacity onPress={() => Linking.openURL(website)}>
                  <Text style={styles.webExternalText}>Open</Text>
                </TouchableOpacity>
              </View>
              <WebView source={{ uri: website }} style={styles.webPanel} startInLoadingState />
            </View>
          ) : null}


        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 120 },
  content: { padding: 16 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  rating: { backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 10, color: '#fff', fontWeight: '700' },
  address: { color: '#666', flex: 1 },
  websiteBtn: { backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  websiteBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  popularWrap: {
    marginBottom: 16,
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
  },
  popularTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 8 },
  popularItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
  },
  popularItemText: { fontSize: 14, color: '#111827', fontWeight: '600' },


  webPanelWrap: {
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  webPanelHeader: {
    height: 48,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  webPanel: { height: 640, backgroundColor: '#fff' },
  webCloseText: { color: '#ef4444', fontWeight: '700' },
  webTitle: { flex: 1, textAlign: 'center', fontWeight: '700', color: '#111827', marginHorizontal: 10 },
  webExternalBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  webExternalText: { color: '#2563eb', fontWeight: '700' },
});

