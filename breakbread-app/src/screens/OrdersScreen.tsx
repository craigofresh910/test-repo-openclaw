import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

const SUGGESTIONS = [
  '🍕 Pizza night with friends',
  '🍣 Sushi table split',
  '🍔 Burger combo table',
  '🌮 Taco Tuesday group order',
  '☕ Coffee + breakfast run',
];

export default function OrdersScreen() {
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
          <Text style={styles.suggestionsTitle}>Suggestions</Text>
          {SUGGESTIONS.map((item, idx) => (
            <View key={idx} style={styles.suggestionItem}>
              <Text style={styles.suggestionText}>{item}</Text>
            </View>
          ))}
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
  suggestionText: { fontSize: 15, color: '#111827', fontWeight: '600' },
});
