import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Switch, TextInput, Image } from 'react-native';
import BackArrow from '../components/BackArrow';
import AppHeader from '../components/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const AVATARS = ['🍔', '🍕', '🌮', '🍣', '🍜', '🥗', '🍗', '🥐'];
const PAYMENT_OPTIONS = ['Cash', 'Cash App', 'Zelle'];

export default function ProfileScreen({ navigation }: any) {
  const [avatar, setAvatar] = useState('🍔');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [username, setUsername] = useState('Demo User');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash App']);

  const friends = useMemo(() => ['Jordan', 'Mia', 'Chris'], []);
  const [favoriteLocation, setFavoriteLocation] = useState('Detroit, MI');

  useEffect(() => {
    (async () => {
      try {
        const [u, a, n, p, photo, favLoc] = await Promise.all([
          AsyncStorage.getItem('profile.username'),
          AsyncStorage.getItem('profile.avatar'),
          AsyncStorage.getItem('profile.notifications'),
          AsyncStorage.getItem('profile.payments'),
          AsyncStorage.getItem('profile.photoUri'),
          AsyncStorage.getItem('profile.favoriteLocation'),
        ]);
        if (u) setUsername(u);
        if (a) setAvatar(a);
        if (n) setNotificationsEnabled(n === 'true');
        if (p) setPaymentMethods(JSON.parse(p));
        if (photo) setPhotoUri(photo);
        if (favLoc) setFavoriteLocation(favLoc);
      } catch {}
    })();
  }, []);

  const persistProfile = async (next?: Partial<{ username: string; avatar: string; notifications: boolean; payments: string[]; photoUri: string | null; favoriteLocation: string }>) => {
    try {
      if (next?.username !== undefined) await AsyncStorage.setItem('profile.username', next.username);
      if (next?.avatar !== undefined) await AsyncStorage.setItem('profile.avatar', next.avatar);
      if (next?.notifications !== undefined) await AsyncStorage.setItem('profile.notifications', String(next.notifications));
      if (next?.payments !== undefined) await AsyncStorage.setItem('profile.payments', JSON.stringify(next.payments));
      if (next?.favoriteLocation !== undefined) await AsyncStorage.setItem('profile.favoriteLocation', next.favoriteLocation);
      if (next?.photoUri !== undefined) {
        if (next.photoUri) await AsyncStorage.setItem('profile.photoUri', next.photoUri);
        else await AsyncStorage.removeItem('profile.photoUri');
      }
    } catch {}
  };

  const togglePayment = (method: string) => {
    setPaymentMethods((prev) => {
      const next = prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method];
      persistProfile({ payments: next });
      return next;
    });
  };

  const pickProfilePhoto = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.85,
        aspect: [1, 1],
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        const uri = result.assets[0].uri;
        setPhotoUri(uri);
        persistProfile({ photoUri: uri });
      }
    } catch {}
  };

  return (
    <ScrollView style={styles.container} stickyHeaderIndices={[0]}>
      <AppHeader />
      <BackArrow navigation={navigation} />
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickProfilePhoto}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.photoAvatar} />
            ) : (
              <Text style={styles.avatar}>{avatar}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.avatarActionsRow}>
            <TouchableOpacity onPress={pickProfilePhoto}><Text style={styles.inlineAction}>Upload Photo</Text></TouchableOpacity>
            <Text style={styles.inlineDot}>•</Text>
            <TouchableOpacity onPress={() => setShowAvatarPicker(true)}><Text style={styles.inlineAction}>Use Emoji</Text></TouchableOpacity>
          </View>
          <TextInput
            style={styles.usernameInput}
            value={username}
            onChangeText={(t) => {
              setUsername(t);
              persistProfile({ username: t });
            }}
            placeholder="Your name"
            placeholderTextColor="#9ca3af"
          />
          <Text style={styles.changeAvatar}>Name is editable</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>0</Text>
            <Text style={styles.statLabel}>Orders</Text>
          </View>
          <TouchableOpacity style={styles.stat} onPress={() => setShowFriends((v) => !v)}>
            <Text style={styles.statNum}>{friends.length}</Text>
            <Text style={styles.statLabel}>Friends</Text>
          </TouchableOpacity>
        </View>

        {showFriends && (
          <View style={styles.friendsBox}>
            <Text style={styles.friendsTitle}>Friends</Text>
            {friends.map((f) => (
              <Text key={f} style={styles.friendItem}>• {f}</Text>
            ))}
          </View>
        )}

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setShowPaymentModal(true)}>
            <Text style={styles.menuIcon}>🍽️</Text>
            <Text style={styles.menuText}>Payment Methods</Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={() => setShowLocationsModal(true)}>
            <Text style={styles.menuIcon}>📍</Text>
            <Text style={styles.menuText}>Locations</Text>
            <Text style={styles.menuArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <Text style={styles.menuIcon}>🔔</Text>
            <Text style={styles.menuText}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={(v) => {
                setNotificationsEnabled(v);
                persistProfile({ notifications: v });
              }}
            />
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Current Settings</Text>
            <Text style={styles.summaryLine}>Payments: {paymentMethods.length ? paymentMethods.join(', ') : 'None selected'}</Text>
            <Text style={styles.summaryLine}>Notifications: {notificationsEnabled ? 'On' : 'Off'}</Text>
            <Text style={styles.summaryLine}>Favorite Location: {favoriteLocation}</Text>
          </View>
        </View>
      </View>

      <Modal visible={showAvatarPicker} transparent animationType="slide" onRequestClose={() => setShowAvatarPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((a) => (
                <TouchableOpacity key={a} style={styles.avatarChoice} onPress={() => { setAvatar(a); setPhotoUri(null); persistProfile({ avatar: a, photoUri: null }); setShowAvatarPicker(false); }}>
                  <Text style={styles.avatarChoiceText}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowAvatarPicker(false)}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showPaymentModal} transparent animationType="slide" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Payment Methods</Text>
            {PAYMENT_OPTIONS.map((m) => (
              <TouchableOpacity key={m} style={styles.optionRow} onPress={() => togglePayment(m)}>
                <Text style={styles.optionText}>{m}</Text>
                <Text style={styles.optionCheck}>{paymentMethods.includes(m) ? '✅' : '⬜'}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.closeBtn} onPress={() => setShowPaymentModal(false)}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showLocationsModal} transparent animationType="slide" onRequestClose={() => setShowLocationsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Favorite Location</Text>
            <TextInput
              style={styles.locationInput}
              value={favoriteLocation}
              onChangeText={setFavoriteLocation}
              placeholder="City, ZIP, or address"
              placeholderTextColor="#9ca3af"
            />
            <Text style={styles.locationHint}>This location is used as your default nearby area.</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                persistProfile({ favoriteLocation });
                setShowLocationsModal(false);
              }}
            >
              <Text style={styles.closeBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 20 },
  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: { fontSize: 80, marginBottom: 8 },
  photoAvatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  avatarActionsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  inlineAction: { fontSize: 12, color: '#2563eb', fontWeight: '700' },
  inlineDot: { marginHorizontal: 8, color: '#9ca3af' },
  usernameInput: {
    minWidth: 160,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingVertical: 2,
  },
  changeAvatar: { marginTop: 4, color: '#6b7280', fontSize: 12 },
  stats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20, backgroundColor: '#f9f9f9', borderRadius: 16, padding: 20 },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '800', color: '#f59e0b' },
  statLabel: { color: '#666', fontSize: 14 },
  friendsBox: { marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, backgroundColor: '#fafafa' },
  friendsTitle: { fontWeight: '800', marginBottom: 6 },
  friendItem: { color: '#374151', marginBottom: 3 },
  menu: { gap: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#f9f9f9', borderRadius: 12 },
  menuIcon: { fontSize: 24, marginRight: 14 },
  menuText: { flex: 1, fontSize: 16, fontWeight: '600' },
  menuArrow: { color: '#999', fontSize: 18 },
  summaryBox: { marginTop: 2, backgroundColor: '#f9fafb', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 12 },
  summaryTitle: { fontWeight: '800', marginBottom: 6, color: '#111827' },
  summaryLine: { fontSize: 13, color: '#374151', marginBottom: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarChoice: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  avatarChoiceText: { fontSize: 30 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  optionText: { fontWeight: '600', color: '#111827' },
  optionCheck: { fontSize: 18 },
  locationInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#111827',
    fontWeight: '600',
  },
  locationHint: { marginTop: 8, color: '#6b7280', fontSize: 12 },
  closeBtn: { marginTop: 12, backgroundColor: '#111827', borderRadius: 10, alignItems: 'center', paddingVertical: 10 },
  closeBtnText: { color: '#fff', fontWeight: '800' },
});
