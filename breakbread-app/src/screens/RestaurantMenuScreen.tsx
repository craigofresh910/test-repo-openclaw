import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, FlatList, Alert, Linking } from 'react-native';
import BackArrow from '../components/BackArrow';
import AppHeader from '../components/AppHeader';

const MENU_ITEMS: any[] = [];

export default function RestaurantMenuScreen({ route, navigation }: any) {
  const { restaurant } = route.params;
  const [orderItems, setOrderItems] = useState<any[]>([]);

  const addItem = (item: any) => {
    setOrderItems([...orderItems, item]);
    Alert.alert('Added', `${item.name} added to order`);
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.menuItem}>
      <View style={styles.menuInfo}>
        <Text style={styles.menuName}>{item.name}</Text>
        <Text style={styles.menuDesc}>{item.description}</Text>
        <Text style={styles.menuPrice}>${item.price.toFixed(2)}</Text>
      </View>
      <TouchableOpacity style={styles.addBtn} onPress={() => addItem(item)}>
        <Text style={styles.addBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );

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
          
          <TouchableOpacity
            style={styles.websiteBtn}
            onPress={() => {
              const directWebsite = restaurant.website;
              const fallbackSearch = `https://www.google.com/search?q=${encodeURIComponent(`${restaurant.name} ${restaurant.address} official website`)}`;
              Linking.openURL(directWebsite || fallbackSearch);
            }}
          >
            <Text style={styles.websiteBtnText}>🌐 Visit Website</Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Menu</Text>
          {MENU_ITEMS.length === 0 ? (
            <View style={styles.emptyMenuBox}>
              <Text style={styles.emptyMenuText}>No menu loaded yet for this restaurant.</Text>
              <Text style={styles.emptyMenuSub}>Use custom item entry while we fetch live menu data.</Text>
            </View>
          ) : (
            <FlatList data={MENU_ITEMS} renderItem={renderItem} keyExtractor={item => item.id} scrollEnabled={false} />
          )}
        </View>
      </ScrollView>
      
      {orderItems.length > 0 && (
        <TouchableOpacity style={styles.cartBtn} onPress={() => navigation.navigate('TableOrder', { orderItems })}>
          <Text style={styles.cartBtnText}>View Order ({orderItems.length})</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 200 },
  content: { padding: 16 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  rating: { backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginRight: 10, color: '#fff', fontWeight: '700' },
  address: { color: '#666', flex: 1 },
  websiteBtn: { backgroundColor: '#f59e0b', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  websiteBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  menuItem: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  menuInfo: { flex: 1 },
  menuName: { fontSize: 16, fontWeight: '700' },
  menuDesc: { color: '#888', fontSize: 13, marginTop: 2 },
  menuPrice: { fontSize: 15, fontWeight: '600', color: '#22c55e', marginTop: 4 },
  addBtn: { backgroundColor: '#f59e0b', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', alignSelf: 'center' },
  addBtnText: { color: '#fff', fontSize: 24, fontWeight: '700' },
  cartBtn: { backgroundColor: '#22c55e', padding: 16, alignItems: 'center' },
  cartBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  emptyMenuBox: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  emptyMenuText: { fontSize: 15, fontWeight: '600', color: '#111827' },
  emptyMenuSub: { marginTop: 6, fontSize: 13, color: '#6b7280' },
});

