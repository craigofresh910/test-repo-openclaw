import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert, TextInput, Image } from 'react-native';
import BackArrow from '../components/BackArrow';
import AppHeader from '../components/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createLiveTable, getLiveTable, getUserLiveTables, joinLiveTable, leaveLiveTable, searchNearbyRestaurants } from '../services/api';

function generateTableCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

interface Place {
  place_id: string;
  name: string;
  address: string;
  rating?: number;
  photo?: string;
}

export default function TableOrderScreen({ route, navigation }: any) {
  const incoming = route?.params?.tableCode;
  const tableCode = useMemo(() => (incoming || generateTableCode()).toUpperCase(), [incoming]);

  const [suggestionInput, setSuggestionInput] = useState('');
  const [restaurantCards, setRestaurantCards] = useState<Place[]>([]);
  const [participants, setParticipants] = useState<Array<{ userId: string; name: string }>>([]);
  const [activeTables, setActiveTables] = useState<Array<{ code: string; createdAt: string; participants: Array<{ userId: string; name: string }> }>>([]);
  const [me, setMe] = useState<{ userId: string; name: string }>({ userId: 'guest', name: 'You' });
  const [votes, setVotes] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    let timer: any;

    const init = async () => {
      let userId = await AsyncStorage.getItem('bb.userId');
      let name = (await AsyncStorage.getItem('profile.username')) || 'You';

      if (!userId) {
        userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await AsyncStorage.setItem('bb.userId', userId);
      }
      if (mounted) setMe({ userId, name });

      try {
        if (incoming) {
          await joinLiveTable({ code: tableCode, userId, name });
        } else {
          await createLiveTable({ code: tableCode, userId, name });
        }
      } catch {}

      const refresh = async () => {
        try {
          const [tableData, userTablesData] = await Promise.all([
            getLiveTable(tableCode),
            getUserLiveTables(userId),
          ]);

          const list = tableData?.table?.participants || [];
          const tables = userTablesData?.tables || [];

          if (mounted) {
            setParticipants(list);
            setActiveTables(tables);
          }
        } catch {}
      };

      await refresh();
      timer = setInterval(refresh, 3000);
    };

    init();
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, [incoming, tableCode]);

  useEffect(() => {
    loadRestaurantSuggestions();
  }, []);

  const loadRestaurantSuggestions = async (query?: string) => {
    try {
      let lat = 42.3314;
      let lng = -83.0458;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      }
      const res = await searchNearbyRestaurants(lat, lng, 12000, query);
      setRestaurantCards((res.places || []).slice(0, 8));
    } catch {
      setRestaurantCards([]);
    }
  };

  const shareInvite = async () => {
    try {
      await Share.share({
        message: `Join my BreakBread table with code: ${tableCode}`,
      });
    } catch {
      Alert.alert('Share failed', 'Could not share invite right now.');
    }
  };

  const leaveTable = async () => {
    try {
      await leaveLiveTable({ code: tableCode, userId: me.userId });
      navigation.navigate('HomeMain');
    } catch {
      Alert.alert('Leave failed', 'Could not leave table right now.');
    }
  };

  const voteFor = (placeId: string) => {
    setVotes((prev) => ({ ...prev, [placeId]: (prev[placeId] || 0) + 1 }));
  };

  return (
    <ScrollView style={styles.container} stickyHeaderIndices={[0]}>
      <AppHeader />
      <BackArrow navigation={navigation} />
      <View style={styles.content}>
        <Text style={styles.title}>Table</Text>

        <View style={styles.codeBox}>
          <Text style={styles.code}>{tableCode}</Text>
        </View>

        <View style={styles.activeTablesBox}>
          <Text style={styles.activeTablesTitle}>Your Active Tables</Text>
          {activeTables.length === 0 ? (
            <Text style={styles.activeTablesEmpty}>No active tables yet.</Text>
          ) : (
            activeTables.map((t) => (
              <TouchableOpacity
                key={t.code}
                style={[styles.activeTableItem, t.code === tableCode && styles.activeTableItemCurrent]}
                onPress={() => navigation.navigate('TableMain', { tableCode: t.code })}
              >
                <Text style={styles.activeTableCode}>{t.code}</Text>
                <Text style={styles.activeTableMeta}>{t.participants?.length || 0} people</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.shareBtn} onPress={shareInvite}>
          <Text style={styles.shareBtnText}>📤 Share Invite</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.leaveBtn} onPress={leaveTable}>
          <Text style={styles.leaveBtnText}>Leave Table</Text>
        </TouchableOpacity>

        <View style={styles.participants}>
          <Text style={styles.participantsTitle}>At the Table ({participants.length || 1})</Text>

          <View style={styles.tableScene}>
            <View style={styles.roundTable}>
              <Image source={require('../../assets/breakbread-logo.png')} style={styles.tableLogo} resizeMode="contain" />
            </View>

            {(participants.length ? participants : [{ userId: me.userId, name: me.name }]).slice(0, 6).map((p, idx, arr) => {
              const total = Math.max(arr.length, 1);
              const angle = (-Math.PI / 2) + (idx * (2 * Math.PI / total));
              const centerX = 150;
              const centerY = 165;
              const radius = 132;
              const seatSize = 86;
              const left = centerX + Math.cos(angle) * radius - seatSize / 2;
              const top = centerY + Math.sin(angle) * radius - seatSize / 2;

              return (
                <View key={p.userId} style={[styles.seat, { left, top, width: seatSize }]}>
                  <View style={styles.chairBack} />
                  <View style={styles.personDot}>
                    <Text style={styles.personInitial}>{(p.name || 'U').charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.seatName} numberOfLines={1}>{p.name}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.suggestBox}>
          <Text style={styles.suggestTitle}>Restaurant Suggestions + Voting</Text>

          <View style={styles.suggestInputRow}>
            <TextInput
              style={styles.suggestInput}
              placeholder="Search suggestions"
              placeholderTextColor="#9ca3af"
              value={suggestionInput}
              onChangeText={setSuggestionInput}
              onSubmitEditing={() => loadRestaurantSuggestions(suggestionInput.trim() || undefined)}
            />
            <TouchableOpacity style={styles.addBtn} onPress={() => loadRestaurantSuggestions(suggestionInput.trim() || undefined)}>
              <Text style={styles.addBtnText}>Go</Text>
            </TouchableOpacity>
          </View>

          {restaurantCards.map((item) => (
            <View key={item.place_id} style={styles.card}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => navigation.navigate('RestaurantMenu', { restaurant: item })}>
                <Image source={{ uri: item.photo || 'https://via.placeholder.com/400' }} style={styles.cardImage} />
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.voteRow}>
                <TouchableOpacity style={styles.voteBtn} onPress={() => voteFor(item.place_id)}>
                  <Text style={styles.voteBtnText}>Vote 👍</Text>
                </TouchableOpacity>
                <Text style={styles.voteCount}>Votes: {votes[item.place_id] || 0}</Text>
              </View>
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
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  codeBox: { backgroundColor: '#f5f5f5', borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 20 },
  code: { fontSize: 40, fontWeight: '800', color: '#f59e0b', letterSpacing: 4 },
  activeTablesBox: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  activeTablesTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 8 },
  activeTablesEmpty: { fontSize: 13, color: '#6b7280' },
  activeTableItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
  },
  activeTableItemCurrent: { backgroundColor: '#fff7ed' },
  activeTableCode: { fontSize: 14, fontWeight: '800', color: '#111827' },
  activeTableMeta: { fontSize: 12, color: '#6b7280', fontWeight: '600' },
  shareBtn: { backgroundColor: '#22c55e', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 10 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  leaveBtn: { backgroundColor: '#ef4444', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 20 },
  leaveBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  participants: { marginBottom: 20 },
  participantsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  tableScene: {
    height: 340,
    borderRadius: 18,
    backgroundColor: '#eef2f7',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundTable: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#FFFEF2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 6,
    borderColor: '#f59e0b',
  },
  tableLogo: { width: 130, height: 60, borderRadius: 8 },
  seat: {
    position: 'absolute',
    alignItems: 'center',
  },
  chairBack: {
    width: 44,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#2f3b4a',
    marginBottom: 4,
  },
  personDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personInitial: { fontWeight: '800', color: '#374151' },
  seatName: { marginTop: 4, fontSize: 12, fontWeight: '700', color: '#111827', maxWidth: 86, textAlign: 'center' },

  suggestBox: {
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  suggestTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#111827' },
  suggestInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  suggestInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#fff',
  },
  addBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontWeight: '800' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
    overflow: 'hidden',
  },
  cardImage: { width: '100%', height: 120 },
  cardContent: { padding: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  cardAddress: { marginTop: 3, fontSize: 12, color: '#6b7280' },
  voteRow: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voteBtn: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  voteBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  voteCount: { color: '#374151', fontWeight: '700', fontSize: 12 },

});
