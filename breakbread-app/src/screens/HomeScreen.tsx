import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, FlatList, RefreshControl, ActivityIndicator, Modal, Alert, Linking } from 'react-native';
import { searchNearbyRestaurants } from '../services/api';
import * as Location from 'expo-location';
import BackArrow from '../components/BackArrow';

const HOME_LOGO = require('../../assets/breakbread-logo.png');

const CATEGORIES = [
  { id: '1', name: 'Burgers', icon: '🍔' },
  { id: '2', name: 'Pizza', icon: '🍕' },
  { id: '3', name: 'Chinese', icon: '🥡' },
  { id: '4', name: 'Mexican', icon: '🌮' },
  { id: '5', name: 'Sushi', icon: '🍣' },
  { id: '6', name: 'Italian', icon: '🍝' },
  { id: '7', name: 'BBQ', icon: '🍖' },
  { id: '8', name: 'Thai', icon: '🍜' },
  { id: '9', name: 'Indian', icon: '🍛' },
  { id: '10', name: 'Seafood', icon: '🦞' },
  { id: '11', name: 'Breakfast', icon: '🍳' },
  { id: '12', name: 'Chicken', icon: '🍗' },
  { id: '13', name: 'Steak', icon: '🥩' },
  { id: '14', name: 'Sandwiches', icon: '🥪' },
  { id: '15', name: 'Cafe', icon: '☕' },
  { id: '16', name: 'Dessert', icon: '🍨' },
];

interface Place { place_id: string; name: string; address: string; rating?: number; price_level?: number; photo?: string; website?: string; lat?: number; lng?: number; types?: string[]; }

export default function HomeScreen({ navigation }: any) {
  const [location, setLocation] = useState('Detecting...');
  const [locationInput, setLocationInput] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [tableCode, setTableCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinMode, setJoinMode] = useState(false);
  const [userLat, setUserLat] = useState(42.3314);
  const [userLng, setUserLng] = useState(-83.0458);
  const [nearbyRestaurants, setNearbyRestaurants] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState(5);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (categoryId?: string, forceCoords?: { lat: number; lng: number; label?: string }) => {
    setLoading(true);
    try {
      let lat = forceCoords?.lat ?? userLat;
      let lng = forceCoords?.lng ?? userLng;

      if (forceCoords) {
        setUserLat(forceCoords.lat);
        setUserLng(forceCoords.lng);
        if (forceCoords.label) setLocation(forceCoords.label);
      } else {
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({});
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            setUserLat(lat);
            setUserLng(lng);
            const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (results[0]) setLocation(results[0].city || 'Current Location');
          }
        } catch (e) { console.log('Using default location'); }
      }

      let allPlaces: Place[] = [];
      let pageToken: string | undefined;

      for (let i = 0; i < 3; i++) {
        const res = await searchNearbyRestaurants(lat, lng, 16093, categoryId || undefined, pageToken);
        allPlaces = [...allPlaces, ...res.places];
        pageToken = res.nextPageToken;
        if (!pageToken || allPlaces.length >= 50) break;
        await new Promise(r => setTimeout(r, 1500));
      }

      setNearbyRestaurants(allPlaces.slice(0, 50));
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const createTable = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    setTableCode(code);
  };

  useEffect(() => { createTable(); }, []);

  useEffect(() => {
    setDisplayCount(5);
  }, [priceFilter]);

  const getFoodMeta = (item: Place) => {
    const n = item.name.toLowerCase();
    const t = (item.types || []).map(x => x.toLowerCase());

    const keywordMap = [
      { keys: ['pizza', 'pizzeria'], icon: '🍕', label: 'Pizza' },
      { keys: ['sushi', 'ramen', 'japanese'], icon: '🍣', label: 'Japanese' },
      { keys: ['taco', 'mex', 'burrito', 'taqueria'], icon: '🌮', label: 'Mexican' },
      { keys: ['burger', 'grill', 'bbq'], icon: '🍔', label: 'Burgers' },
      { keys: ['pasta', 'ital'], icon: '🍝', label: 'Italian' },
      { keys: ['chinese', 'wok'], icon: '🥡', label: 'Chinese' },
      { keys: ['thai'], icon: '🍜', label: 'Thai' },
      { keys: ['salad', 'vegan', 'vegetarian'], icon: '🥗', label: 'Healthy' },
      { keys: ['steak'], icon: '🥩', label: 'Steakhouse' },
      { keys: ['seafood', 'fish'], icon: '🐟', label: 'Seafood' },
      { keys: ['chicken', 'wings'], icon: '🍗', label: 'Chicken' },
      { keys: ['sandwich', 'deli'], icon: '🥪', label: 'Sandwiches' },
      { keys: ['coffee', 'cafe'], icon: '☕', label: 'Cafe' },
      { keys: ['bakery', 'donut'], icon: '🥐', label: 'Bakery' },
      { keys: ['ice cream', 'gelato', 'dessert'], icon: '🍨', label: 'Dessert' },
    ];

    for (const m of keywordMap) {
      if (m.keys.some(k => n.includes(k))) return m;
    }

    if (t.includes('bakery')) return { icon: '🥐', label: 'Bakery' };
    if (t.includes('cafe')) return { icon: '☕', label: 'Cafe' };
    if (t.includes('meal_takeaway') || t.includes('fast_food_restaurant')) return { icon: '🍟', label: 'Fast Food' };
    if (t.includes('restaurant')) return { icon: '🍽️', label: 'Restaurant' };

    return { icon: '🍴', label: 'Food' };
  };

  const renderItem = ({ item }: { item: Place }) => {
    const foodMeta = getFoodMeta(item);
    return (
      <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('RestaurantMenu', { restaurant: item })}>
        <Image source={{ uri: item.photo || 'https://via.placeholder.com/400' }} style={styles.cardImage} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{foodMeta.icon} {item.name}</Text>
          <Text style={styles.foodTypeChip}>{foodMeta.label}</Text>
          <View style={styles.cardRow}>
            {item.rating && <Text style={styles.rating}>⭐ {item.rating}</Text>}
            <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCategory = ({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity
      style={[styles.catItem, selectedCategory === item.id && styles.catActive]}
      onPress={() => {
        const turningOff = selectedCategory === item.id;
        setSelectedCategory(turningOff ? null : item.id);
        fetchData(turningOff ? undefined : item.name);
      }}
    >
      <Text style={styles.catIcon}>{item.icon}</Text>
      <Text style={styles.catName}>{item.name}</Text>
    </TouchableOpacity>
  );

  const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filteredRestaurants = nearbyRestaurants
    .filter(r => !priceFilter || (r.price_level && r.price_level === priceFilter))
    .sort((a, b) => {
      const aHasCoords = typeof a.lat === 'number' && typeof a.lng === 'number';
      const bHasCoords = typeof b.lat === 'number' && typeof b.lng === 'number';
      if (!aHasCoords && !bHasCoords) return 0;
      if (!aHasCoords) return 1;
      if (!bHasCoords) return -1;
      const da = getDistanceKm(userLat, userLng, a.lat as number, a.lng as number);
      const db = getDistanceKm(userLat, userLng, b.lat as number, b.lng as number);
      return da - db;
    });

  return (
    <View style={{ flex: 1 }}>
      <BackArrow navigation={navigation} />
      <ScrollView
        style={styles.container}
        stickyHeaderIndices={[0]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); setRefreshing(false); }} />}
      >
        <View style={styles.stickyHeaderWrap}>
          <View style={styles.header}>
            <Image source={HOME_LOGO} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.searchBox}>
            <TextInput style={styles.searchInput} placeholder="🔍 Search restaurants..." placeholderTextColor="#888" value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={async () => {
              if (searchQuery.trim()) {
                setLoading(true);
                let allPlaces: Place[] = [];
                let pageToken: string | undefined;
                for (let i = 0; i < 3; i++) {
                  const r = await searchNearbyRestaurants(userLat, userLng, 16093, searchQuery, pageToken);
                  allPlaces = [...allPlaces, ...r.places];
                  pageToken = r.nextPageToken;
                  if (!pageToken || allPlaces.length >= 50) break;
                  await new Promise(res => setTimeout(res, 1500));
                }
                setNearbyRestaurants(allPlaces.slice(0, 50));
                setDisplayCount(5);
                setLoading(false);
              }
            }} />
          </View>
        </View>

        <View style={styles.locationRow}>
          <TouchableOpacity onPress={() => setShowLocationModal(true)}>
            <Text style={styles.locationText}>📍 {location}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tableRow}>
          <TouchableOpacity style={styles.tableBtn} onPress={() => { setJoinMode(true); setShowTableModal(true); }}>
            <Text style={styles.tableBtnText}>🔗 Join Table</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tableBtn, { backgroundColor: '#22c55e' }]} onPress={() => { setJoinMode(false); createTable(); setShowTableModal(true); }}>
            <Text style={styles.tableBtnText}>👥 New Table</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((item) => (
              <View key={item.id}>{renderCategory({ item })}</View>
            ))}
          </View>
        </View>

        <View style={styles.priceRow}>
          {['$', '$$', '$$$', '$$$$'].map((p, i) => (
            <TouchableOpacity key={i} style={[styles.priceBtn, priceFilter === i+1 && styles.priceActive]} onPress={() => setPriceFilter(priceFilter === i+1 ? null : i+1)}>
              <Text style={[styles.priceText, priceFilter === i+1 && styles.priceTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nearby</Text>
          {loading ? <ActivityIndicator size="large" color="#f59e0b" style={{ margin: 20 }} /> : (
            <>
              <FlatList data={filteredRestaurants.slice(0, displayCount)} renderItem={renderItem} keyExtractor={item => item.place_id} scrollEnabled={false} />
              {displayCount < filteredRestaurants.length && (
                <TouchableOpacity style={styles.viewMoreBtn} onPress={() => setDisplayCount(displayCount + 5)}>
                  <Text style={styles.viewMoreText}>View More ({filteredRestaurants.length - displayCount} more)</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showLocationModal}
        transparent
        animationType="slide"
        allowSwipeDismissal
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Location</Text>
            <TextInput style={styles.modalInput} placeholder="Enter zip or city" value={locationInput} onChangeText={setLocationInput} />
            <TouchableOpacity style={styles.modalBtn} onPress={async () => {
              const input = locationInput.trim();
              if (!input) {
                setShowLocationModal(false);
                return;
              }

              try {
                const geocoded = await Location.geocodeAsync(input);
                if (geocoded?.[0]) {
                  await fetchData(undefined, { lat: geocoded[0].latitude, lng: geocoded[0].longitude, label: input });
                } else {
                  setLocation(input);
                }
              } catch (e) {
                setLocation(input);
              }

              setShowLocationModal(false);
            }}>
              <Text style={styles.modalBtnText}>Update</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}><Text style={styles.modalClose}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTableModal}
        transparent
        animationType="slide"
        allowSwipeDismissal
        onRequestClose={() => {
          setShowTableModal(false);
          setJoinMode(false);
          setJoinCode('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{joinMode ? 'Join Table' : 'New Table'}</Text>
            {joinMode ? (
              <>
                <TextInput style={styles.modalInput} placeholder="Enter code" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" />
                <TouchableOpacity style={styles.modalBtn} onPress={() => {
                  if (joinCode.trim()) {
                    setShowTableModal(false);
                    navigation.navigate('TableOrder', { tableCode: joinCode.trim().toUpperCase() });
                  }
                }}>
                  <Text style={styles.modalBtnText}>Join</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setJoinMode(false)}><Text style={styles.modalClose}>Create new instead</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.codeBox}><Text style={styles.codeText}>{tableCode}</Text></View>
                <TouchableOpacity style={styles.modalBtn} onPress={() => {}}><Text style={styles.modalBtnText}>Share</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setJoinMode(true)}><Text style={styles.modalClose}>Join existing instead</Text></TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => {
              setShowTableModal(false);
              setJoinMode(false);
              setJoinCode('');
            }}>
              <Text style={[styles.modalClose, { marginTop: 12 }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  stickyHeaderWrap: { backgroundColor: '#fff', zIndex: 10 },
  header: { backgroundColor: '#f59e0b', paddingTop: 50, paddingBottom: 16, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  logo: { width: 180, height: 44, borderRadius: 12, marginTop: 8 },
  searchBox: { padding: 16 },
  searchInput: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 16 },
  locationRow: { paddingHorizontal: 16, paddingBottom: 8 },
  locationText: { fontSize: 16, fontWeight: '600', color: '#333' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  tableBtn: { flex: 1, backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center' },
  tableBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  catItem: { alignItems: 'center', justifyContent: 'center', width: 78, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 12, backgroundColor: '#fafafa' },
  catActive: { backgroundColor: '#fff3e0', borderRadius: 12 },
  catIcon: { fontSize: 28, marginBottom: 4 },
  catName: { fontSize: 12, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 16 },
  priceBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#f5f5f5', borderRadius: 20 },
  priceActive: { backgroundColor: '#22c55e' },
  priceText: { fontWeight: '600', color: '#333' },
  priceTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 12, marginBottom: 12, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  cardImage: { width: '100%', height: 140 },
  cardContent: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  foodTypeChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginBottom: 6,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  rating: { backgroundColor: '#22c55e', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8, color: '#fff', fontSize: 12 },
  address: { color: '#888', fontSize: 12, flex: 1 },
  viewMoreBtn: { padding: 16, alignItems: 'center' },
  viewMoreText: { color: '#f59e0b', fontWeight: '600', fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 24, padding: 24 },
  modalTitle: { fontSize: 24, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, fontSize: 18, marginBottom: 16, textAlign: 'center' },
  modalBtn: { backgroundColor: '#f59e0b', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 12 },
  modalBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  modalClose: { textAlign: 'center', color: '#666', fontSize: 15 },
  codeBox: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  codeText: { fontSize: 36, fontWeight: '800', color: '#f59e0b', letterSpacing: 4 },
});
