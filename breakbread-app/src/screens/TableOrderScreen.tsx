import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert, TextInput } from 'react-native';
import BackArrow from '../components/BackArrow';
import AppHeader from '../components/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLiveTable, getLiveTable, joinLiveTable } from '../services/api';

function generateTableCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export default function TableOrderScreen({ route, navigation }: any) {
  const incoming = route?.params?.tableCode;
  const tableCode = useMemo(() => (incoming || generateTableCode()).toUpperCase(), [incoming]);

  const [suggestionInput, setSuggestionInput] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; by: string }>>([]);
  const [participants, setParticipants] = useState<Array<{ userId: string; name: string }>>([]);
  const [me, setMe] = useState<{ userId: string; name: string }>({ userId: 'guest', name: 'You' });

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
          const data = await getLiveTable(tableCode);
          const list = data?.table?.participants || [];
          if (mounted) setParticipants(list);
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

  const shareInvite = async () => {
    try {
      await Share.share({
        message: `Join my BreakBread table with code: ${tableCode}`,
      });
    } catch {
      Alert.alert('Share failed', 'Could not share invite right now.');
    }
  };

  const addSuggestion = () => {
    const value = suggestionInput.trim();
    if (!value) return;
    setSuggestions((prev) => [{ id: String(Date.now()), name: value, by: me.name || 'You' }, ...prev]);
    setSuggestionInput('');
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

        <TouchableOpacity style={styles.shareBtn} onPress={shareInvite}>
          <Text style={styles.shareBtnText}>📤 Share Invite</Text>
        </TouchableOpacity>

        <View style={styles.participants}>
          <Text style={styles.participantsTitle}>At the Table ({participants.length || 1})</Text>
          {(participants.length ? participants : [{ userId: me.userId, name: me.name }]).map((p) => (
            <View key={p.userId} style={styles.participant}>
              <Text style={styles.participantAvatar}>👤</Text>
              <Text style={styles.participantName}>{p.name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.suggestBox}>
          <Text style={styles.suggestTitle}>Restaurant Suggestions</Text>

          <View style={styles.suggestInputRow}>
            <TextInput
              style={styles.suggestInput}
              placeholder="Suggest a restaurant"
              placeholderTextColor="#9ca3af"
              value={suggestionInput}
              onChangeText={setSuggestionInput}
              onSubmitEditing={addSuggestion}
            />
            <TouchableOpacity style={styles.addBtn} onPress={addSuggestion}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {suggestions.map((s) => (
            <View key={s.id} style={styles.suggestItem}>
              <Text style={styles.suggestName}>🍽️ {s.name}</Text>
              <Text style={styles.suggestBy}>by {s.by}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.waiting}>Live sync active — participants update automatically.</Text>
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
  shareBtn: { backgroundColor: '#22c55e', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 30 },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  participants: { marginBottom: 20 },
  participantsTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  participant: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#f9f9f9', borderRadius: 12, marginBottom: 8 },
  participantAvatar: { fontSize: 32, marginRight: 12 },
  participantName: { fontSize: 16, fontWeight: '600' },

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
  suggestItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eceff1',
  },
  suggestName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  suggestBy: { marginTop: 2, fontSize: 12, color: '#6b7280' },

  waiting: { textAlign: 'center', color: '#888', fontSize: 13 },
});
