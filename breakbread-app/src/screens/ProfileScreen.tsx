import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Switch } from 'react-native';
import BackArrow from '../components/BackArrow';
import AppHeader from '../components/AppHeader';

const AVATARS = ['🍔', '🍕', '🌮', '🍣', '🍜', '🥗', '🍗', '🥐'];
const PAYMENT_OPTIONS = ['Cash', 'Cash App', 'Zelle'];

export default function ProfileScreen({ navigation }: any) {
  const [avatar, setAvatar] = useState('🍔');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showLocationsModal, setShowLocationsModal] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<string[]>(['Cash App']);

  const friends = useMemo(() => ['Jordan', 'Mia', 'Chris'], []);
  const savedLocations = useMemo(() => ['Detroit, MI', 'Southfield, MI'], []);

  const togglePayment = (method: string) => {
    setPaymentMethods((prev) =>
      prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <AppHeader />
      <BackArrow navigation={navigation} />
      <View style={styles.content}>
        <Text style={styles.title}>Profile</Text>

        <TouchableOpacity style={styles.avatarSection} onPress={() => setShowAvatarPicker(true)}>
          <Text style={styles.avatar}>{avatar}</Text>
          <Text style={styles.username}>Demo User</Text>
          <Text style={styles.changeAvatar}>Tap to change avatar</Text>
        </TouchableOpacity>

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
            <Switch value={notificationsEnabled} onValueChange={setNotificationsEnabled} />
          </View>
        </View>
      </View>

      <Modal visible={showAvatarPicker} transparent animationType="slide" onRequestClose={() => setShowAvatarPicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATARS.map((a) => (
                <TouchableOpacity key={a} style={styles.avatarChoice} onPress={() => { setAvatar(a); setShowAvatarPicker(false); }}>
                  <Text style={styles.avatarChoiceText}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
          </View>
        </View>
      </Modal>

      <Modal visible={showLocationsModal} transparent animationType="slide" onRequestClose={() => setShowLocationsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Saved Locations</Text>
            {savedLocations.map((loc) => (
              <Text key={loc} style={styles.locationItem}>📍 {loc}</Text>
            ))}
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
  username: { fontSize: 22, fontWeight: '700' },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarChoice: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' },
  avatarChoiceText: { fontSize: 30 },
  optionRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  optionText: { fontWeight: '600', color: '#111827' },
  optionCheck: { fontSize: 18 },
  locationItem: { paddingVertical: 8, color: '#111827', fontWeight: '600' },
});
