import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert, TextInput, Image, Vibration, Switch } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import BackArrow from '../components/BackArrow';
import AppHeader from '../components/AppHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { addTableItem, createLiveTable, deleteTableChat, editTableChat, getLiveTable, getTableChat, getUserLiveTables, joinLiveTable, leaveLiveTable, removeTableItem, searchNearbyRestaurants, sendTableChat } from '../services/api';

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

export default function TableOrderScreen({ navigation }: any) {
  const [tableCode, setTableCode] = useState<string>('');
  const [tableMode, setTableMode] = useState<'create' | 'join' | 'none'>('none');
  const [joinCodeInput, setJoinCodeInput] = useState('');

  const [suggestionInput, setSuggestionInput] = useState('');
  const [restaurantCards, setRestaurantCards] = useState<Place[]>([]);
  const [wheelPickId, setWheelPickId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Array<{ userId: string; name: string; avatar?: string }>>([]);
  const [activeTables, setActiveTables] = useState<Array<{ code: string; createdAt: string; participants: Array<{ userId: string; name: string; avatar?: string }> }>>([]);
  const [me, setMe] = useState<{ userId: string; name: string; avatar?: string }>({ userId: 'guest', name: 'You', avatar: '👤' });
  const [mePhotoUri, setMePhotoUri] = useState<string>('');
  const [votes, setVotes] = useState<Record<string, number>>({});
  const [myVotePlaceId, setMyVotePlaceId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; userId: string; name: string; avatar?: string; text: string; sentAt: string; replyToId?: string; replyToName?: string; replyToText?: string; editedAt?: string }>>([]);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string; text: string } | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [tableItems, setTableItems] = useState<Array<{ id: string; userId: string; userName: string; name: string; qty: number; price?: number; notes?: string }>>([]);
  const [itemName, setItemName] = useState('');
  const [itemQty, setItemQty] = useState('1');
  const [itemPrice, setItemPrice] = useState('');
  const [itemNotes, setItemNotes] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [billSubtotal, setBillSubtotal] = useState('');
  const [checkoutLocked, setCheckoutLocked] = useState(false);
  const [paidMap, setPaidMap] = useState<Record<string, boolean>>({});
  const [paidRequests, setPaidRequests] = useState<Record<string, boolean>>({});
  const [cashTag, setCashTag] = useState('');
  const lastSeenMessageIdRef = useRef<string | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;
    let timer: any;

    const init = async () => {
      let userId = await AsyncStorage.getItem('bb.userId');
      let name = (await AsyncStorage.getItem('profile.username')) || 'You';
      const photoUri = await AsyncStorage.getItem('profile.photoUri');
      const photoData = await AsyncStorage.getItem('profile.photoData');
      const avatarEmoji = (await AsyncStorage.getItem('profile.avatar')) || '👤';
      const profileCashApp = (await AsyncStorage.getItem('profile.cashapp')) || '';
      const profileZelle = (await AsyncStorage.getItem('profile.zelle')) || '';
      let avatar = avatarEmoji;

      if (photoData) {
        avatar = photoData;
      } else if (photoUri) {
        try {
          const b64 = await FileSystem.readAsStringAsync(photoUri, { encoding: FileSystem.EncodingType.Base64 });
          const lower = String(photoUri).toLowerCase();
          const mime = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
          avatar = `data:${mime};base64,${b64}`;
        } catch {
          avatar = avatarEmoji;
        }
      }

      if (!userId) {
        userId = `u_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await AsyncStorage.setItem('bb.userId', userId);
      }
      if (mounted) {
        setMe({ userId, name, avatar });
        setMePhotoUri(photoUri || '');
        if (!cashTag) setCashTag(profileCashApp || profileZelle || 'Not set in profile');
      }

      if (tableCode && tableMode !== 'none') {
        try {
          if (tableMode === 'join') {
            await joinLiveTable({ code: tableCode, userId, name, avatar });
          } else {
            await createLiveTable({ code: tableCode, userId, name, avatar });
          }
        } catch {
          Alert.alert('Table error', tableMode === 'join' ? 'Could not join table. Check code.' : 'Could not create table.');
          setTableCode('');
          setTableMode('none');
        }
      }

      const refresh = async () => {
        try {
          const userTablesData = await getUserLiveTables(userId);
          const tables = userTablesData?.tables || [];
          if (mounted) setActiveTables(tables);

          if (!tableCode) return;

          const [tableData, chatData] = await Promise.all([
            getLiveTable(tableCode),
            getTableChat(tableCode),
          ]);

          const list = tableData?.table?.participants || [];
          const messages = chatData?.messages || [];
          const items = tableData?.table?.items || [];

          if (mounted) {
            setParticipants(list);
            setChatMessages(messages);
            setTableItems(items);

            const latest = messages[messages.length - 1];
            if (latest) {
              if (!lastSeenMessageIdRef.current) {
                lastSeenMessageIdRef.current = latest.id;
                messages.forEach((m: any) => seenMessageIdsRef.current.add(m.id));
              } else {
                const newMessages = messages.filter((m: any) => !seenMessageIdsRef.current.has(m.id));
                newMessages.forEach((m: any) => seenMessageIdsRef.current.add(m.id));
                const newFromOthers = newMessages.filter((m: any) => m.userId !== userId);

                if (newFromOthers.length > 0) {
                  const lastIncoming = newFromOthers[newFromOthers.length - 1];
                  setUnreadCount((c) => c + newFromOthers.length);
                  lastSeenMessageIdRef.current = lastIncoming.id;
                  Vibration.vibrate(200);
                  Notifications.scheduleNotificationAsync({
                    content: {
                      title: `${lastIncoming.name} in table ${tableCode}`,
                      body: newFromOthers.length > 1 ? `${newFromOthers.length} new messages` : lastIncoming.text,
                      sound: true,
                    },
                    trigger: null,
                  }).catch(() => {});
                }
              }
            }
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
  }, [tableCode, tableMode]);

  useEffect(() => {
    loadRestaurantSuggestions();
  }, []);

  useEffect(() => {
    if (!restaurantCards.length) {
      setWheelPickId(null);
      return;
    }
    if (!wheelPickId || !restaurantCards.some((r) => r.place_id === wheelPickId)) {
      setWheelPickId(restaurantCards[0].place_id);
    }
  }, [restaurantCards]);

  useEffect(() => {
    (async () => {
      try {
        const settings = await Notifications.getPermissionsAsync();
        if (settings.status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch {}
    })();
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
      setTableCode('');
      setTableMode('none');
      setParticipants([]);
      setChatMessages([]);
      setReplyTo(null);
      setEditingMessageId(null);
      setUnreadCount(0);
    } catch {
      Alert.alert('Leave failed', 'Could not leave table right now.');
    }
  };

  const voteFor = (placeId: string) => {
    setVotes((prev) => {
      const next = { ...prev };

      if (myVotePlaceId && myVotePlaceId !== placeId) {
        next[myVotePlaceId] = Math.max(0, (next[myVotePlaceId] || 0) - 1);
      }

      if (myVotePlaceId !== placeId) {
        next[placeId] = (next[placeId] || 0) + 1;
      }

      return next;
    });

    setMyVotePlaceId(placeId);
  };

  const swipeLeavePrompt = () => {
    Alert.alert('Leave table?', 'Are you sure you want to leave this table?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: leaveTable },
    ]);
  };

  const createTableNow = () => {
    const code = generateTableCode();
    setTableMode('create');
    setTableCode(code);
  };

  const joinTableNow = () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (!code) {
      Alert.alert('Missing code', 'Enter a table code to join.');
      return;
    }
    setTableMode('join');
    setTableCode(code);
  };

  const spinRestaurantWheel = () => {
    if (!restaurantCards.length) return;
    const idx = Math.floor(Math.random() * restaurantCards.length);
    setWheelPickId(restaurantCards[idx].place_id);
  };

  const refreshChat = async () => {
    const latest = await getTableChat(tableCode);
    setChatMessages(latest?.messages || []);
  };

  const sendOrEditMessage = async () => {
    const text = chatInput.trim();
    if (!text) return;

    if (editingMessageId) {
      await editTableChat({ code: tableCode, messageId: editingMessageId, userId: me.userId, text });
      setEditingMessageId(null);
      setChatInput('');
      await refreshChat();
      return;
    }

    let finalReply = replyTo;
    if (!finalReply && text.startsWith('@')) {
      const mention = text.split(' ')[0].replace('@', '').trim().toLowerCase();
      const target = [...chatMessages].reverse().find((m) => (m.name || '').toLowerCase() === mention);
      if (target) finalReply = { id: target.id, name: target.name, text: target.text };
    }

    await sendTableChat({
      code: tableCode,
      userId: me.userId,
      name: me.name,
      avatar: me.avatar,
      text,
      replyToId: finalReply?.id,
      replyToName: finalReply?.name,
      replyToText: finalReply?.text,
    });

    setChatInput('');
    setUnreadCount(0);
    setReplyTo(null);
    await refreshChat();
  };

  const removeMessage = async (messageId: string) => {
    await deleteTableChat({ code: tableCode, messageId, userId: me.userId });
    await refreshChat();
  };

  const pricedItemsSubtotal = tableItems.reduce((sum, it) => sum + (Number(it.price || 0) * Number(it.qty || 1)), 0);
  const subtotalNum = pricedItemsSubtotal > 0 ? pricedItemsSubtotal : Number(billSubtotal || 0);
  const memberCount = Math.max(1, participants.length || 1);

  const userItemTotals: Record<string, number> = {};
  tableItems.forEach((it) => {
    userItemTotals[it.userId] = (userItemTotals[it.userId] || 0) + (Number(it.price || 0) * Number(it.qty || 1));
  });

  const TAX_RATE = 0.06;
  const taxNum = subtotalNum * TAX_RATE;
  const usersWithItems = participants.filter((p) => (userItemTotals[p.userId] || 0) > 0).length;
  const tipNum = usersWithItems * 1; // $1 tip only for people who added items
  const totalBill = Math.max(0, subtotalNum + taxNum + tipNum);

  const personOwes = (userId: string) => {
    const base = userItemTotals[userId] || 0;
    if (base <= 0) return 0;
    if (subtotalNum <= 0) return 0;
    const taxShare = taxNum * (base / subtotalNum);
    const tipShare = 1;
    return base + taxShare + tipShare;
  };

  const captainId = participants[0]?.userId || me.userId;
  const isCaptain = me.userId === captainId;
  const paidCount = participants.filter((p) => paidMap[p.userId]).length;
  const orderedPicks = restaurantCards
    .filter((r) => (votes[r.place_id] || 0) > 0)
    .sort((a, b) => (votes[b.place_id] || 0) - (votes[a.place_id] || 0));

  const togglePaid = (userId: string, next: boolean) => {
    setPaidMap((prev) => ({ ...prev, [userId]: next }));
    if (next) {
      setPaidRequests((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const requestMarkPaid = () => {
    setPaidRequests((prev) => ({ ...prev, [me.userId]: true }));
    Alert.alert('Sent', 'Payment request sent to captain.');
  };

  const addItemToOrder = async () => {
    const name = itemName.trim();
    if (!name) return Alert.alert('Missing item', 'Enter item name.');

    await addTableItem({
      code: tableCode,
      userId: me.userId,
      userName: me.name,
      name,
      qty: Math.max(1, Number(itemQty || 1)),
      price: itemPrice ? Number(itemPrice) : undefined,
      notes: itemNotes.trim() || undefined,
    });

    setItemName('');
    setItemQty('1');
    setItemPrice('');
    setItemNotes('');
    const latest = await getLiveTable(tableCode);
    setTableItems(latest?.table?.items || []);
  };

  const removeItemFromOrder = async (itemId: string) => {
    await removeTableItem({ code: tableCode, itemId, userId: me.userId });
    const latest = await getLiveTable(tableCode);
    setTableItems(latest?.table?.items || []);
  };

  const openMessageActions = (m: any) => {
    const mine = m.userId === me.userId;
    const buttons: any[] = [
      {
        text: 'Reply',
        onPress: () => {
          setReplyTo({ id: m.id, name: m.name, text: m.text });
          setChatInput(`@${m.name} `);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ].filter(Boolean);

    Alert.alert('Message actions', `@${m.name}${mine ? ' • swipe → edit, swipe ← delete' : ''}`, buttons);
  };

  const onOpenLeftAction = (m: any) => {
    if (m.userId === me.userId) {
      setEditingMessageId(m.id);
      setChatInput(m.text);
      setReplyTo(null);
      return;
    }
    setReplyTo({ id: m.id, name: m.name, text: m.text });
    setChatInput(`@${m.name} `);
  };

  const onOpenRightAction = (m: any) => {
    if (m.userId !== me.userId) return;
    Alert.alert('Delete message?', 'This will remove your message for everyone at table.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeMessage(m.id) },
    ]);
  };

  return (
    <ScrollView style={styles.container} stickyHeaderIndices={[0]}>
      <AppHeader />
      <BackArrow navigation={navigation} />
      <View style={styles.content}>
        <Text style={styles.title}>Table</Text>

        {!tableCode ? (
          <View style={styles.lobbyBox}>
            <Text style={styles.lobbyTitle}>Start or Join a Table</Text>
            <TouchableOpacity style={styles.createTableBtn} onPress={createTableNow}>
              <Text style={styles.createTableBtnText}>+ Create New Table</Text>
            </TouchableOpacity>

            <Text style={styles.joinLabel}>Have a code?</Text>
            <View style={styles.joinRow}>
              <TextInput
                style={styles.joinInput}
                value={joinCodeInput}
                onChangeText={setJoinCodeInput}
                autoCapitalize="characters"
                placeholder="Enter table code"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity style={styles.joinBtn} onPress={joinTableNow}>
                <Text style={styles.joinBtnText}>Join</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.activeTablesBox, { marginTop: 14, marginBottom: 0 }]}> 
              <Text style={styles.activeTablesTitle}>Your Active Tables</Text>
              {activeTables.length === 0 ? (
                <Text style={styles.activeTablesEmpty}>No active tables yet.</Text>
              ) : (
                activeTables.map((t) => (
                  <TouchableOpacity
                    key={`lobby-${t.code}`}
                    style={styles.activeTableItem}
                    onPress={() => {
                      setTableMode('join');
                      setTableCode(t.code);
                    }}
                  >
                    <Text style={styles.activeTableCode}>{t.code}</Text>
                    <Text style={styles.activeTableMeta}>{t.participants?.length || 0} people</Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        ) : (
          <View style={styles.codeShareRow}>
            <View style={[styles.codeBox, styles.codeBoxCompact, { marginBottom: 0 }]}> 
              <Text style={styles.code} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{tableCode}</Text>
            </View>
            <TouchableOpacity style={styles.shareBtnInline} onPress={shareInvite}>
              <Text style={styles.shareBtnInlineText}>📤 Share</Text>
            </TouchableOpacity>
            {(() => {
              const current = activeTables.find((t) => t.code === tableCode);
              if (!current) return null;
              return (
                <Swipeable
                  overshootLeft={false}
                  overshootRight={false}
                  friction={2}
                  rightThreshold={30}
                  onSwipeableOpen={() => swipeLeavePrompt()}
                  renderRightActions={() => (
                    <View style={[styles.swipeAction, styles.leaveSwipeActionInlineSmall]}>
                      <Text style={styles.swipeActionText}>Leave</Text>
                    </View>
                  )}
                >
                  <View style={styles.activeInlinePill}>
                    <Text style={styles.activeInlinePillLabel}>Active Tables</Text>
                    <Text style={styles.activeInlinePillText}>{current.code} • {current.participants?.length || 0} people</Text>
                  </View>
                </Swipeable>
              );
            })()}
          </View>
        )}

        {!tableCode ? null : <>


        <View style={styles.participants}>
          <View style={styles.participantsHead}>
            <Text style={styles.participantsTitle}>At the Table</Text>
            <View style={styles.tableCountPill}>
              <Text style={styles.tableCountText}>{participants.length || 1} seated</Text>
            </View>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.participantsListRow}
          >
            {(participants.length ? participants : [{ userId: me.userId, name: me.name }]).map((p) => (
              <View key={`list-${p.userId}`} style={[styles.participantCard, p.userId === me.userId && styles.participantCardMe]}>
                <View style={[styles.personDot, p.userId === me.userId && styles.personDotMe]}>
                  {(() => {
                    const raw = String(p.avatar || '');
                    const hasRemoteOrData = /^https?:/i.test(raw) || /^file:/i.test(raw) || /^data:/i.test(raw);
                    const fallbackLocal = p.userId === me.userId ? mePhotoUri : '';
                    const uri = hasRemoteOrData ? raw : fallbackLocal;
                    return uri ? (
                      <Image source={{ uri }} style={styles.personPhoto} />
                    ) : (
                      <Text style={styles.personInitial}>{p.avatar || '👤'}</Text>
                    );
                  })()}
                </View>
                <Text style={styles.participantCardName} numberOfLines={1}>{p.name}</Text>
                {p.userId === captainId ? (
                  <View style={styles.captainBadge}>
                    <Text style={styles.captainBadgeText}>Captain</Text>
                  </View>
                ) : (
                  <Text style={styles.participantCardMeta}>{p.userId === me.userId ? 'You' : 'Member'}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={styles.chatBox}>
          <View style={styles.chatHeaderRow}>
            <Text style={styles.chatTitle}>Table Chat</Text>
            {unreadCount > 0 && (
              <TouchableOpacity style={styles.unreadBadge} onPress={() => setUnreadCount(0)}>
                <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
              </TouchableOpacity>
            )}
          </View>
          {replyTo && (
            <View style={styles.replyPreviewBox}>
              <Text style={styles.replyPreviewText}>Replying to @{replyTo.name}: {replyTo.text}</Text>
              <TouchableOpacity onPress={() => setReplyTo(null)}><Text style={styles.replyPreviewCancel}>✕</Text></TouchableOpacity>
            </View>
          )}
          {editingMessageId && (
            <View style={styles.replyPreviewBox}>
              <Text style={styles.replyPreviewText}>Editing your message</Text>
              <TouchableOpacity onPress={() => { setEditingMessageId(null); setChatInput(''); }}><Text style={styles.replyPreviewCancel}>✕</Text></TouchableOpacity>
            </View>
          )}
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Say something..."
              placeholderTextColor="#9ca3af"
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={sendOrEditMessage}
            />
            <TouchableOpacity
              style={styles.chatSendBtn}
              onPress={sendOrEditMessage}
            >
              <Text style={styles.chatSendText}>Send</Text>
            </TouchableOpacity>
          </View>

          {chatMessages.slice(-20).map((m) => {
            const mine = m.userId === me.userId;
            const time = new Date(m.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            return (
              <Swipeable
                key={m.id}
                overshootLeft={false}
                overshootRight={false}
                friction={2}
                leftThreshold={40}
                rightThreshold={40}
                onSwipeableOpen={(direction) => {
                  if (direction === 'left') onOpenRightAction(m);
                  if (direction === 'right') onOpenLeftAction(m);
                }}
                renderLeftActions={() => (
                  <View style={[styles.swipeAction, styles.swipeEditAction]}>
                    <Text style={styles.swipeActionText}>{mine ? 'Edit' : 'Reply'}</Text>
                  </View>
                )}
                renderRightActions={() => (
                  <View style={[styles.swipeAction, styles.swipeDeleteAction]}>
                    <Text style={styles.swipeActionText}>{mine ? 'Delete' : 'Reply'}</Text>
                  </View>
                )}
              >
              <TouchableOpacity
                style={[styles.chatMsgRow, mine && styles.chatMsgRowMine]}
                onLongPress={() => openMessageActions(m)}
                activeOpacity={0.9}
              >
                {!mine && (
                  String(m.avatar || '').startsWith('file:') || String(m.avatar || '').startsWith('http') || String(m.avatar || '').startsWith('data:') ? (
                    <Image source={{ uri: String(m.avatar) }} style={styles.chatAvatarPhoto} />
                  ) : (
                    <Text style={styles.chatAvatar}>{m.avatar || '👤'}</Text>
                  )
                )}
                <View style={[styles.chatBubble, mine && styles.chatBubbleMine]}>
                  <View style={styles.chatMsgTopRow}>
                    <Text style={[styles.chatName, mine && styles.chatNameMine]}>{mine ? 'You' : m.name}</Text>
                    <TouchableOpacity onPress={() => { setReplyTo({ id: m.id, name: m.name, text: m.text }); setChatInput(`@${m.name} `); }}>
                      <Text style={[styles.chatAction, mine && styles.chatActionMine]}>Reply</Text>
                    </TouchableOpacity>
                  </View>
                  {!!m.replyToName && !!m.replyToText && (
                    <View style={[styles.replyRefBox, mine && styles.replyRefBoxMine]}>
                      <Text style={[styles.replyRefText, mine && styles.replyRefTextMine]}>↪ @{m.replyToName}: {m.replyToText}</Text>
                    </View>
                  )}
                  <Text style={[styles.chatText, mine && styles.chatTextMine]}>{m.text}{m.editedAt ? ' (edited)' : ''}</Text>
                  <View style={styles.chatMetaRow}>
                    <Text style={[styles.chatTime, mine && styles.chatTimeMine]}>{time}</Text>
                    {mine && (
                      <Text style={styles.gestureHint}>Swipe → edit • Swipe ← delete</Text>
                    )}
                  </View>
                </View>
                {mine && (
                  String(m.avatar || '').startsWith('file:') || String(m.avatar || '').startsWith('http') || String(m.avatar || '').startsWith('data:') ? (
                    <Image source={{ uri: String(m.avatar) }} style={styles.chatAvatarPhoto} />
                  ) : (
                    <Text style={styles.chatAvatar}>{m.avatar || '👤'}</Text>
                  )
                )}
              </TouchableOpacity>
              </Swipeable>
            );
          })}
        </View>

        <View style={styles.myVotesBox}>
          <Text style={styles.myVotesTitle}>Your Vote</Text>
          {!myVotePlaceId ? (
            <Text style={styles.myVotesEmpty}>No vote selected yet. Pick one below — you can change it anytime.</Text>
          ) : (
            (() => {
              const r = restaurantCards.find((x) => x.place_id === myVotePlaceId);
              if (!r) return <Text style={styles.myVotesEmpty}>Your selected vote is not in the current list.</Text>;
              return (
                <View key={`my-${r.place_id}`} style={styles.myVoteRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.myVoteName} numberOfLines={1}>{r.name}</Text>
                    <Text style={styles.myVoteMeta}>Current votes: {votes[r.place_id] || 0}</Text>
                  </View>
                  <TouchableOpacity style={styles.myVoteOpenBtn} onPress={() => navigation.navigate('RestaurantMenu', { restaurant: r })}>
                    <Text style={styles.myVoteOpenText}>Open</Text>
                  </TouchableOpacity>
                </View>
              );
            })()
          )}
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

          {restaurantCards.length > 0 ? (
            (() => {
              const selected = restaurantCards.find((r) => r.place_id === wheelPickId) || restaurantCards[0];
              return (
                <>
                  <View style={styles.wheelCard}>
                    <Text style={styles.wheelTitle}>🎡 Restaurant Wheel</Text>
                    <Text style={styles.wheelPickName} numberOfLines={1}>{selected.name}</Text>
                    <Text style={styles.wheelPickMeta}>👍 {votes[selected.place_id] || 0} votes</Text>
                    <View style={styles.wheelActionsRow}>
                      <TouchableOpacity style={styles.compactViewBtn} onPress={() => navigation.navigate('RestaurantMenu', { restaurant: selected, autoOpenWebsite: true })}>
                        <Text style={styles.compactViewText}>View Menu</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.compactVoteBtn, myVotePlaceId === selected.place_id && styles.compactVoteBtnActive]} onPress={() => voteFor(selected.place_id)}>
                        <Text style={styles.compactVoteText}>{myVotePlaceId === selected.place_id ? 'Voted' : 'Vote'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.spinBtn} onPress={spinRestaurantWheel}>
                        <Text style={styles.spinBtnText}>Spin</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.wheelStrip}>
                    {restaurantCards.map((item) => (
                      <TouchableOpacity key={item.place_id} style={[styles.wheelChip, item.place_id === selected.place_id && styles.wheelChipActive]} onPress={() => setWheelPickId(item.place_id)}>
                        <Text style={styles.wheelChipText} numberOfLines={1}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              );
            })()
          ) : (
            <Text style={styles.myVotesEmpty}>No restaurant suggestions yet.</Text>
          )}
        </View>

        {orderedPicks.length > 0 ? (
        <View style={styles.orderListBox}>
          <View style={styles.orderListHead}>
            <Text style={styles.orderListTitle}>Restaurant Decision List</Text>
          </View>

          {orderedPicks.map((r, idx) => (
            <View key={`order-${r.place_id}`} style={styles.orderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderName}>{idx + 1}. {r.name}</Text>
                <Text style={styles.orderMeta}>Votes: {votes[r.place_id] || 0}</Text>
              </View>
            </View>
          ))}
        </View>
        ) : null}

        <View style={styles.itemsBox}>
          <Text style={styles.itemsTitle}>Order Items</Text>
          <View style={styles.itemsInputRow}>
            <TextInput style={[styles.billInput, { flex: 2 }]} value={itemName} onChangeText={setItemName} placeholder="Item name" placeholderTextColor="#9ca3af" />
            <TextInput style={[styles.billInput, { flex: 0.7 }]} value={itemQty} onChangeText={setItemQty} keyboardType="number-pad" placeholder="Qty" placeholderTextColor="#9ca3af" />
            <TextInput style={[styles.billInput, { flex: 1 }]} value={itemPrice} onChangeText={setItemPrice} keyboardType="decimal-pad" placeholder="$" placeholderTextColor="#9ca3af" />
          </View>
          <View style={styles.itemsInputRow}>
            <TextInput style={styles.cashInput} value={itemNotes} onChangeText={setItemNotes} placeholder="Notes (optional)" placeholderTextColor="#9ca3af" />
            <TouchableOpacity style={styles.lockBtn} onPress={addItemToOrder}>
              <Text style={styles.lockBtnText}>Add</Text>
            </TouchableOpacity>
          </View>

          {tableItems.length === 0 ? (
            <Text style={styles.myVotesEmpty}>No items yet. Add your actual order items here.</Text>
          ) : (
            tableItems.map((it) => (
              <View key={it.id} style={styles.orderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.orderName}>{it.qty}x {it.name}</Text>
                  <Text style={styles.orderMeta}>By {it.userName}{it.price ? ` • $${Number(it.price).toFixed(2)}` : ''}{it.notes ? ` • ${it.notes}` : ''}</Text>
                </View>
                {(isCaptain || it.userId === me.userId) ? (
                  <TouchableOpacity style={styles.compactVoteBtn} onPress={() => removeItemFromOrder(it.id)}>
                    <Text style={styles.compactVoteText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </View>

        <View style={styles.settlementBox}>
          <Text style={styles.settlementTitle}>Captain Checkout + Settlement</Text>
          <Text style={styles.settlementMeta}>Captain: {participants.find((p) => p.userId === captainId)?.name || me.name}</Text>

          {isCaptain ? (
            <>
              {pricedItemsSubtotal <= 0 ? (
                <View style={styles.billRow}>
                  <TextInput style={styles.billInput} value={billSubtotal} onChangeText={setBillSubtotal} keyboardType="decimal-pad" placeholder="Subtotal" placeholderTextColor="#9ca3af" />
                </View>
              ) : (
                <Text style={styles.settlementMeta}>Subtotal auto-calculated from itemized order.</Text>
              )}
              <TextInput style={styles.cashInput} value={cashTag} onChangeText={setCashTag} placeholder="Captain payment handle (CashApp/Zelle/Venmo)" placeholderTextColor="#9ca3af" />
              <TouchableOpacity style={styles.lockBtn} onPress={() => setCheckoutLocked(true)}>
                <Text style={styles.lockBtnText}>Lock Final Bill</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.settlementMeta}>Waiting for captain to lock final bill.</Text>
          )}

          <View style={styles.billSummary}>
            <Text style={styles.billLine}>Subtotal: ${subtotalNum.toFixed(2)}</Text>
            <Text style={styles.billLine}>Tax (auto 6%): ${taxNum.toFixed(2)}</Text>
            <Text style={styles.billLine}>Tip (auto $1 x {usersWithItems}): ${tipNum.toFixed(2)}</Text>
            <Text style={styles.billLine}>Total bill: ${totalBill.toFixed(2)}</Text>
            <Text style={styles.billLine}>Each person pays what they added (+tax share + $1 tip)</Text>
            <Text style={styles.billLine}>Paid: {paidCount}/{memberCount}</Text>
            <Text style={styles.billLine}>Pay captain at: {cashTag}</Text>
          </View>

          {participants.map((p) => {
            const isMeRow = p.userId === me.userId;
            const hasRequest = !!paidRequests[p.userId];

            return (
              <View key={`pay-${p.userId}`} style={styles.payRow}>
                <View>
                  <Text style={styles.payName}>{p.name}</Text>
                  <Text style={styles.payAmount}>Owes ${personOwes(p.userId).toFixed(2)}{hasRequest ? ' • Requested paid' : ''}</Text>
                </View>

                {isCaptain ? (
                  <View style={styles.payCaptainActions}>
                    {hasRequest && !paidMap[p.userId] ? (
                      <TouchableOpacity style={styles.approveBtn} onPress={() => togglePaid(p.userId, true)}>
                        <Text style={styles.approveBtnText}>Approve</Text>
                      </TouchableOpacity>
                    ) : null}
                    <Switch
                      value={!!paidMap[p.userId]}
                      onValueChange={(v) => togglePaid(p.userId, v)}
                    />
                  </View>
                ) : isMeRow ? (
                  <TouchableOpacity style={[styles.requestPaidBtn, paidMap[p.userId] && styles.requestPaidBtnDisabled]} onPress={requestMarkPaid} disabled={!!paidMap[p.userId]}>
                    <Text style={styles.requestPaidBtnText}>{paidMap[p.userId] ? 'Paid ✅' : hasRequest ? 'Request Sent' : 'I Paid'}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.pendingTag}>{paidMap[p.userId] ? 'Paid ✅' : hasRequest ? 'Pending captain' : 'Pending'}</Text>
                )}
              </View>
            );
          })}
        </View>
        </>}

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 20 },
  lobbyBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 14, padding: 14, backgroundColor: '#fafafa', marginBottom: 20 },
  lobbyTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 },
  createTableBtn: { backgroundColor: '#111827', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  createTableBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  joinLabel: { fontSize: 12, fontWeight: '700', color: '#6b7280', marginBottom: 8 },
  joinRow: { flexDirection: 'row', gap: 8 },
  joinInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 10, color: '#111827', backgroundColor: '#fff' },
  joinBtn: { backgroundColor: '#f59e0b', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  joinBtnText: { color: '#111827', fontWeight: '800' },
  codeShareRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8, marginBottom: 12 },
  codeBox: { backgroundColor: '#f5f5f5', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', marginBottom: 20 },
  codeBoxCompact: { minWidth: 112 },
  code: { fontSize: 20, fontWeight: '800', color: '#f59e0b', letterSpacing: 2, includeFontPadding: false },
  shareBtnInline: { backgroundColor: '#22c55e', borderRadius: 10, paddingVertical: 11, paddingHorizontal: 12 },
  shareBtnInlineText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  activeInlinePill: { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10, minWidth: 112 },
  activeInlinePillLabel: { color: '#9a3412', fontWeight: '800', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 1 },
  activeInlinePillText: { color: '#9a3412', fontWeight: '800', fontSize: 11 },
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
  participantsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  participantsTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  tableCountPill: { backgroundColor: '#111827', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  tableCountText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  participantsListRow: { gap: 6, paddingVertical: 2, paddingHorizontal: 2 },
  participantCard: { width: 66, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, backgroundColor: '#fff', padding: 6, alignItems: 'center' },
  participantCardMe: { backgroundColor: '#fff7ed' },

  personDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  personDotMe: { borderColor: '#f59e0b', borderWidth: 2 },
  personInitial: { fontWeight: '800', color: '#374151' },
  personPhoto: { width: 28, height: 28, borderRadius: 14 },
  participantCardName: { fontSize: 10, fontWeight: '800', color: '#111827', marginTop: 4 },
  participantCardMeta: { fontSize: 9, color: '#6b7280', marginTop: 1 },
  captainBadge: { marginTop: 2, backgroundColor: '#f59e0b', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, minWidth: 50, alignItems: 'center' },
  captainBadgeText: { fontSize: 8, color: '#111827', fontWeight: '900', includeFontPadding: false, lineHeight: 10 },

  suggestBox: {
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  suggestTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#111827' },

  myVotesBox: { marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, backgroundColor: '#f9fafb', padding: 10 },
  myVotesTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 8 },
  myVotesEmpty: { fontSize: 12, color: '#6b7280' },
  myVoteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#eceff1' },
  myVoteName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  myVoteMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  myVoteOpenBtn: { backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  myVoteOpenText: { color: '#fff', fontWeight: '800', fontSize: 11 },
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

  wheelCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 12, marginBottom: 10 },
  wheelTitle: { fontSize: 12, fontWeight: '800', color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  wheelPickName: { fontSize: 18, fontWeight: '800', color: '#111827' },
  wheelPickMeta: { marginTop: 4, fontSize: 12, color: '#374151', fontWeight: '700' },
  wheelActionsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  spinBtn: { backgroundColor: '#2563eb', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  spinBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  wheelStrip: { gap: 8, paddingBottom: 2 },
  wheelChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 160 },
  wheelChipActive: { backgroundColor: '#ffedd5', borderColor: '#f59e0b' },
  wheelChipText: { fontSize: 11, color: '#111827', fontWeight: '700' },
  compactViewBtn: { backgroundColor: '#111827', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  compactViewText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  compactVoteBtn: { backgroundColor: '#f59e0b', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  compactVoteBtnActive: { backgroundColor: '#fbbf24' },
  compactVoteText: { color: '#111827', fontWeight: '900', fontSize: 12 },

  orderListBox: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 10,
  },
  orderListHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  orderListTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  orderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  orderName: { fontSize: 13, fontWeight: '700', color: '#111827' },
  orderMeta: { fontSize: 11, color: '#6b7280', marginTop: 2 },

  itemsBox: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    backgroundColor: '#fff',
    padding: 10,
  },
  itemsTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 8 },
  itemsInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'center' },

  settlementBox: {
    marginBottom: 20,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  settlementTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 4 },
  settlementMeta: { fontSize: 12, color: '#6b7280', marginBottom: 8 },
  billRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  billInput: { flex: 1, borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#fff', color: '#111827' },
  cashInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, backgroundColor: '#fff', color: '#111827', marginBottom: 8 },
  lockBtn: { backgroundColor: '#111827', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginBottom: 10 },
  lockBtnText: { color: '#fff', fontWeight: '800' },
  billSummary: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', padding: 10, marginBottom: 10 },
  billLine: { fontSize: 13, color: '#111827', fontWeight: '700', marginBottom: 4 },
  payRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  payCaptainActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  approveBtn: { backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  approveBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  requestPaidBtn: { backgroundColor: '#111827', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  requestPaidBtnDisabled: { backgroundColor: '#9ca3af' },
  requestPaidBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pendingTag: { color: '#6b7280', fontSize: 12, fontWeight: '700' },
  payName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  payAmount: { fontSize: 12, color: '#6b7280' },

  chatBox: {
    marginBottom: 20,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
  },
  chatHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  chatTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  unreadBadge: { backgroundColor: '#ef4444', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  unreadBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  chatInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  replyPreviewBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#eef2ff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  replyPreviewText: { flex: 1, fontSize: 12, color: '#1f2937', marginRight: 8 },
  replyPreviewCancel: { fontSize: 13, fontWeight: '800', color: '#6b7280' },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#111827',
    backgroundColor: '#fff',
  },
  chatSendBtn: { backgroundColor: '#111827', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  chatSendText: { color: '#fff', fontWeight: '800' },
  swipeAction: { justifyContent: 'center', borderRadius: 14, marginBottom: 10, paddingHorizontal: 14 },
  swipeEditAction: { backgroundColor: '#2563eb' },
  swipeDeleteAction: { backgroundColor: '#dc2626' },
  leaveSwipeActionInline: { backgroundColor: '#dc2626', alignItems: 'center' },
  leaveSwipeActionInlineSmall: { backgroundColor: '#dc2626', alignItems: 'center', borderRadius: 10 },
  swipeActionText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  chatMsgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 10 },
  chatMsgRowMine: { justifyContent: 'flex-end' },
  chatAvatar: { fontSize: 19, marginHorizontal: 8, marginBottom: 2 },
  chatAvatarPhoto: { width: 24, height: 24, borderRadius: 12, marginHorizontal: 8, marginBottom: 2 },
  chatBubble: {
    maxWidth: '78%',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  chatBubbleMine: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  chatName: { fontSize: 11, fontWeight: '800', color: '#4b5563', marginBottom: 2 },
  chatNameMine: { color: '#d1d5db' },
  chatMsgTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  chatAction: { fontSize: 11, fontWeight: '700', color: '#2563eb' },
  chatActionMine: { color: '#93c5fd' },
  chatOwnActions: { flexDirection: 'row', gap: 10, marginLeft: 10 },
  gestureHint: { fontSize: 10, color: '#9ca3af', marginLeft: 10, fontWeight: '600' },
  replyRefBox: { backgroundColor: '#f3f4f6', borderLeftWidth: 3, borderLeftColor: '#9ca3af', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6, marginBottom: 6 },
  replyRefBoxMine: { backgroundColor: '#1f2937', borderLeftColor: '#9ca3af' },
  replyRefText: { fontSize: 11, color: '#4b5563' },
  replyRefTextMine: { color: '#d1d5db' },
  chatText: { fontSize: 14, color: '#111827', lineHeight: 19 },
  chatTextMine: { color: '#f9fafb' },
  chatMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  chatTime: { fontSize: 10, color: '#9ca3af', fontWeight: '600' },
  chatTimeMine: { color: '#9ca3af' },

});
