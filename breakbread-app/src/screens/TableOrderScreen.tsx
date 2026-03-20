import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import BackArrow from '../components/BackArrow';

export default function TableOrderScreen({ route, navigation }: any) {
  const { tableCode } = route.params || {};
  const [stage, setStage] = useState('invite');

  return (
    <ScrollView style={styles.container}>
      <BackArrow navigation={navigation} />
      <View style={styles.content}>
        <Text style={styles.title}>Table</Text>
        
        <View style={styles.codeBox}>
          <Text style={styles.code}>{tableCode || '------'}</Text>
        </View>

        <TouchableOpacity style={styles.shareBtn}>
          <Text style={styles.shareBtnText}>📤 Share Invite</Text>
        </TouchableOpacity>

        <View style={styles.participants}>
          <Text style={styles.participantsTitle}>At the Table (1)</Text>
          <View style={styles.participant}>
            <Text style={styles.participantAvatar}>👤</Text>
            <Text style={styles.participantName}>You</Text>
          </View>
        </View>

        <Text style={styles.waiting}>Waiting for others to join...</Text>
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
  waiting: { textAlign: 'center', color: '#888', fontSize: 15 },
});
