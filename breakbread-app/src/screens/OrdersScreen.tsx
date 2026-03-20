import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { searchNearbyRestaurants } from '../services/api';

interface Place {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
}

export default function OrdersScreen({ navigation }: any) {
  const [suggestedRestaurants, setSuggestedRestaurants] = useState<Place[]>([]);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      let lat = 42.3314;
      let lng = -83.0458;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }

      const res = await searchNearbyRestaurants(lat, lng, 12000);
      setSuggestedRestaurants((res.places || []).slice(0, 8));
    } catch (e) {
      setSuggestedRestaurants([]);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Your Orders</Text>

        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyText}>No orders yet</Text>
          <Text style={styles.emptySub}>Start a table with friends to order together</Text>
        </View>

        <View style={styles.suggestionsBox}>
          <Text style={styles.suggestionsTitle}>Suggested Restaurants Near You</Text>
          {suggestedRestaurants.length === 0 ? (
            <Text style={styles.emptySuggestion}>No suggestions found yet.</Text>
          ) : (
            suggestedRestaurants.map((item) => (
              <TouchableOpacity
                key={item.place_id}
                style={styles.suggestionItem}
                onPress={() => navigation.navigate('RestaurantMenu', { restaurant: item })}
              >
                <Text style={styles.suggestionText}>{item.name}</Text>
                <Text style={styles.suggestionSub} numberOfLines={1}>{item.address}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20 },
  empty: { alignItems: 'center', paddingTop: 40, marginBottom: 24 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyText: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySub: { color: '#888', fontSize: 15, textAlign: 'center' },

  suggestionsBox: {
    marginTop: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  suggestionsTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10 },
  suggestionItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
  },
  suggestionText: { fontSize: 15, color: '#111827', fontWeight: '700' },
  suggestionSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  emptySuggestion: { fontSize: 14, color: '#6b7280' },
});
