import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, TextInput, FlatList, Alert } from 'react-native';

const MENU_ITEMS = [
  { id: '1', name: 'Classic Burger', price: 12.99, description: 'Beef patty, lettuce, tomato, onion' },
  { id: '2', name: 'Cheeseburger', price: 13.99, description: 'Classic with cheddar' },
  { id: '3', name: 'French Fries', price: 4.99, description: 'Crispy golden fries' },
  { id: '4', name: 'Onion Rings', price: 5.99, description: 'Crispy battered rings' },
  { id: '5', name: 'Milkshake', price: 6.99, description: 'Vanilla, chocolate, strawberry' },
  { id: '6', name: 'Caesar Salad', price: 9.99, description: 'Romaine, parmesan, croutons' },
  { id: '7', name: 'Grilled Chicken', price: 14.99, description: 'Herb grilled chicken breast' },
  { id: '8', name: 'Fish & Chips', price: 15.99, description: 'Beer battered cod, fries' },
];

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
      <ScrollView>
        <Image source={{ uri: restaurant.photo || 'https://via.placeholder.com/400' }} style={styles.hero} />
        <View style={styles.content}>
          <Text style={styles.title}>{restaurant.name}</Text>
          <View style={styles.row}>
            {restaurant.rating && <Text style={styles.rating}>⭐ {restaurant.rating}</Text>}
            <Text style={styles.address}>{restaurant.address}</Text>
          </View>
          
          {restaurant.website && (
            <TouchableOpacity style={styles.websiteBtn} onPress={() => Linking.openURL(restaurant.website)}>
              <Text style={styles.websiteBtnText}>🌐 View Menu Website</Text>
            </TouchableOpacity>
          )}

          <Text style={styles.sectionTitle}>Menu</Text>
          <FlatList data={MENU_ITEMS} renderItem={renderItem} keyExtractor={item => item.id} scrollEnabled={false} />
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
});

