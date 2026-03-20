import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, FlatList, RefreshControl, ActivityIndicator, Modal, Alert, Linking } from 'react-native';
import { searchNearbyRestaurants } from '../services/api';
import * as Location from 'expo-location';

const HOME_LOGO = require('../../assets/icon.png');

const CATEGORIES = [
  { id: '1', name: 'Burgers', icon: '🍔' },
  { id: '2', name: 'Pizza', icon: '🍕' },
  { id: '3', name: 'Chinese', icon: '🥡' },
  { id: '4', name: 'Mexican', icon: '🌮' },
  { id: '5', name: 'Sushi', icon: '🍣' },
  { id: '6', name: 'Italian', icon: '🍝' },
];

interface Place { place_id: string; name: string; address: string; rating?: number; photo?: string; website?: string; }

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

  const fetchData = async (categoryId?: string) => {
    setLoading(true);
    try {
      let lat = userLat, lng = userLng;
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

      const { places } = await searchNearbyRestaurants(lat, lng, 16093, categoryId || undefined);
      setNearbyRestaurants(places);
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

  const renderItem = ({ item }: { item: Place }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('RestaurantMenu', { restaurant: item })}>
      <Image source={{ uri: item.photo || 'https://via.placeholder.com/400' }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>{item.name}</Text>
        <View style={styles.cardRow}>
          {item.rating && <Text style={styles.rating}>⭐ {item.rating}</Text>}
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderCategory = ({ item }: { item: typeof CATEGORIES[0] }) => (
    <TouchableOpacity style={[styles.catItem, selectedCategory === item.id && styles.catActive]} onPress={() => { setSelectedCategory(selectedCategory === item.id ? null : item.id); fetchData(selectedCategory === item.id ? undefined : item.id); }}>
      <Text style={styles.catIcon}>{item.icon}</Text>
      <Text style={styles.catName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); setRefreshing(false); }} />}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>BreakBread</Text>
        </View>

        <View style={styles.searchBox}>
          <TextInput style={styles.searchInput} placeholder="🔍 Search restaurants..." placeholderTextColor="#888" value={searchQuery} onChangeText={setSearchQuery} onSubmitEditing={() => { if (searchQuery.trim()) { setLoading(true); searchNearbyRestaurants(userLat, userLng, 16093, searchQuery).then(r => { setNearbyRestaurants(r.places); setDisplayCount(5); setLoading(false); }); }}} />
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
          <FlatList data={CATEGORIES} renderItem={renderCategory} keyExtractor={item => item.id} horizontal showsHorizontalScrollIndicator={false} />
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
              <FlatList data={nearbyRestaurants.slice(0, displayCount)} renderItem={renderItem} keyExtractor={item => item.place_id} scrollEnabled={false} />
              {displayCount < nearbyRestaurants.length && (
                <TouchableOpacity style={styles.viewMoreBtn} onPress={() => setDisplayCount(displayCount + 5)}>
                  <Text style={styles.viewMoreText}>View More ({nearbyRestaurants.length - displayCount} more)</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal visible={showLocationModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Location</Text>
            <TextInput style={styles.modalInput} placeholder="Enter zip or city" value={locationInput} onChangeText={setLocationInput} />
            <TouchableOpacity style={styles.modalBtn} onPress={() => { setLocation(locationInput || 'Custom'); setShowLocationModal(false); setLoading(true); searchNearbyRestaurants(userLat, userLng, 16093, undefined, locationInput).then(r => { setNearbyRestaurants(r.places); setLoading(false); }); }}>
              <Text style={styles.modalBtnText}>Update</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowLocationModal(false)}><Text style={styles.modalClose}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showTableModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{joinMode ? 'Join Table' : 'New Table'}</Text>
            {joinMode ? (
              <>
                <TextInput style={styles.modalInput} placeholder="Enter code" value={joinCode} onChangeText={setJoinCode} autoCapitalize="characters" />
                <TouchableOpacity style={styles.modalBtn} onPress={() => { if (joinCode.trim()) navigation.navigate('TableOrder', { tableCode: joinCode.trim().toUpperCase() }); }}>
                  <Text style={styles.modalBtnText}>Join</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setJoinMode(false)}><Text style={styles.modalClose}>Create new</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.codeBox}><Text style={styles.codeText}>{tableCode}</Text></View>
                <TouchableOpacity style={styles.modalBtn} onPress={() => {}}><Text style={styles.modalBtnText}>Share</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setJoinMode(true)}><Text style={styles.modalClose}>Join existing</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { backgroundColor: '#f59e0b', paddingTop: 50, paddingBottom: 16, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  searchBox: { padding: 16 },
  searchInput: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 14, fontSize: 16 },
  locationRow: { paddingHorizontal: 16, paddingBottom: 8 },
  locationText: { fontSize: 16, fontWeight: '600', color: '#333' },
  tableRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  tableBtn: { flex: 1, backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center' },
  tableBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  catItem: { alignItems: 'center', marginRight: 16, padding: 8 },
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
