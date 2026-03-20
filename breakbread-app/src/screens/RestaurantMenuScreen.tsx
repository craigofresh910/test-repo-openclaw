import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Linking } from 'react-native';
import BackArrow from '../components/BackArrow';
import AppHeader from '../components/AppHeader';
import { getRestaurantWebsite, getRestaurantDetails } from '../services/api';
import { WebView } from 'react-native-webview';

const getRestaurantCategory = (restaurant: any, details: any) => {
  const name = String(restaurant?.name || '').toLowerCase();
  const types = [
    ...(restaurant?.types || []),
    ...(details?.types || []),
  ].map((t: string) => String(t).toLowerCase());

  // Known sit-down/casual chains that often get mislabeled.
  const casualChains = [
    "logan's", 'logans', 'roadhouse', 'texas roadhouse', 'applebee', 'chili', 'outback',
    'olive garden', 'red lobster', 'longhorn', 'tgi fridays', 'buffalo wild wings',
  ];
  if (casualChains.some((k) => name.includes(k))) return 'Casual Dining';

  if (name.includes('pizza') || name.includes('pizzeria')) return 'Pizza';
  if (name.includes('sushi') || name.includes('ramen') || name.includes('japanese')) return 'Japanese';
  if (name.includes('mex') || name.includes('taco') || name.includes('burrito')) return 'Mexican';
  if (name.includes('burger') || name.includes('bbq') || name.includes('barbecue')) return 'Burgers & BBQ';
  if (name.includes('thai')) return 'Thai';
  if (name.includes('chinese') || name.includes('wok')) return 'Chinese';
  if (name.includes('ital')) return 'Italian';
  if (name.includes('seafood')) return 'Seafood';
  if (name.includes('steak')) return 'Steakhouse';
  if (name.includes('coffee') || name.includes('cafe')) return 'Cafe';
  if (name.includes('bakery') || name.includes('donut')) return 'Bakery';

  if (types.includes('fast_food_restaurant')) return 'Fast Food';
  if (types.includes('meal_takeaway')) return 'Takeout';
  if (types.includes('meal_delivery')) return 'Delivery';
  if (types.includes('cafe')) return 'Cafe';
  if (types.includes('bakery')) return 'Bakery';
  if (types.includes('bar')) return 'Bar & Grill';
  if (types.includes('restaurant')) return 'Restaurant';

  return 'Restaurant';
};

export default function RestaurantMenuScreen({ route, navigation }: any) {
  const { restaurant } = route.params;
  const [website, setWebsite] = useState<string | undefined>(restaurant?.website);
  const [showWebsitePanel, setShowWebsitePanel] = useState(false);
  const [details, setDetails] = useState<any>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (restaurant?.place_id) {
        const d = await getRestaurantDetails(restaurant.place_id);
        if (active && d) {
          setDetails(d);
          if (!website && d.website) setWebsite(d.website);
        }
      }

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
      <BackArrow navigation={navigation} />
      <ScrollView stickyHeaderIndices={[0]}>
        <AppHeader />
        <Image source={{ uri: restaurant.photo || 'https://via.placeholder.com/400' }} style={styles.hero} />
        <View style={styles.content}>
          <Text style={styles.title}>{restaurant.name}</Text>
          <Text style={styles.categoryLine}>Category: {getRestaurantCategory(restaurant, details)}</Text>
          <View style={styles.row}>
            {(details?.rating || restaurant.rating) && <Text style={styles.rating}>⭐ {details?.rating || restaurant.rating}</Text>}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Restaurant Info</Text>
            <Text style={styles.infoLine}>📍 {restaurant.address}</Text>
            {details?.phone ? <Text style={styles.infoLine}>📞 {details.phone}</Text> : null}
            {typeof details?.openNow === 'boolean' ? (
              <Text style={[styles.infoLine, { color: details.openNow ? '#16a34a' : '#dc2626' }]}>
                {details.openNow ? '🟢 Open now' : '🔴 Closed now'}
              </Text>
            ) : null}
            {typeof details?.priceLevel === 'number' ? (
              <Text style={styles.infoLine}>💸 {'$'.repeat(Math.max(1, details.priceLevel))}</Text>
            ) : null}
            {typeof details?.reviews === 'number' ? <Text style={styles.infoLine}>📝 {details.reviews} reviews</Text> : null}

            <View style={styles.infoActions}>
              <TouchableOpacity
                style={styles.infoActionBtn}
                onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(`${restaurant.name} ${restaurant.address}`)}`)}
              >
                <Text style={styles.infoActionText}>Open in Maps</Text>
              </TouchableOpacity>
              {details?.phone ? (
                <TouchableOpacity
                  style={styles.infoActionBtn}
                  onPress={() => Linking.openURL(`tel:${details.phone}`)}
                >
                  <Text style={styles.infoActionText}>Call</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.badgesRow}>
              {details?.delivery ? <Text style={styles.badge}>Delivery</Text> : null}
              {details?.takeout ? <Text style={styles.badge}>Takeout</Text> : null}
              {details?.dineIn ? <Text style={styles.badge}>Dine-in</Text> : null}
            </View>

            <View style={styles.tableCtaRow}>
              <TouchableOpacity style={styles.tableCtaBtn} onPress={() => navigation.navigate('TableOrder')}>
                <Text style={styles.tableCtaText}>Start Table</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tableCtaBtnSecondary}
                onPress={() => {
                  const parent = navigation.getParent?.();
                  if (parent) parent.navigate('Table');
                  else navigation.navigate('TableMain');
                }}
              >
                <Text style={styles.tableCtaTextSecondary}>Join Table</Text>
              </TouchableOpacity>
            </View>
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
                <View style={{ width: 44 }} />
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
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  categoryLine: { fontSize: 14, color: '#4b5563', fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  rating: { backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 10, color: '#fff', fontWeight: '700' },
  websiteBtn: { backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  websiteBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  infoCard: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    padding: 12,
    marginBottom: 14,
  },
  infoTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 8 },
  infoLine: { fontSize: 14, color: '#374151', marginBottom: 5 },
  infoActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  infoActionBtn: {
    backgroundColor: '#111827',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  infoActionText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  badge: {
    backgroundColor: '#e5e7eb',
    color: '#111827',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tableCtaRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  tableCtaBtn: {
    flex: 1,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tableCtaBtnSecondary: {
    flex: 1,
    backgroundColor: '#fff',
    borderColor: '#f59e0b',
    borderWidth: 1,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tableCtaText: { color: '#fff', fontWeight: '800' },
  tableCtaTextSecondary: { color: '#f59e0b', fontWeight: '800' },

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

});

