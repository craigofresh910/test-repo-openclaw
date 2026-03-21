import axios from 'axios';

const API_BASE = 'https://lunchbreakapp.com/api';

export const searchNearbyRestaurants = async (
  lat: number,
  lng: number,
  radius: number = 16093,
  query?: string,
  pageToken?: string
) => {
  try {
    const key = 'AIzaSyBXL7xl4adq0YzUzjWHrlgrLZ4BJq-jidk';
    const hasQuery = !!query?.trim();

    const baseUrl = hasQuery
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(`${query} restaurants`)}&location=${lat},${lng}&radius=${radius}&key=${key}`
      : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=restaurant&key=${key}`;

    // For Google Places pagination requests, use ONLY pagetoken + key.
    const tokenUrl = hasQuery
      ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(pageToken || '')}&key=${key}`
      : `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${encodeURIComponent(pageToken || '')}&key=${key}`;

    const url = pageToken ? tokenUrl : baseUrl;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status && data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      // next_page_token can briefly return INVALID_REQUEST until token is ready.
      // Don't crash UI for this; just return empty page and let caller continue.
      if (data.status === 'INVALID_REQUEST' && pageToken) {
        return { places: [], nextPageToken: undefined };
      }
      // Non-fatal API status; return empty list without crashing UI.
      return { places: [], nextPageToken: undefined };
    }

    if (data.results) {
      return {
        places: data.results.map((p: any) => ({
          place_id: p.place_id,
          name: p.name,
          address: p.formatted_address || p.vicinity || '',
          rating: p.rating,
          price_level: p.price_level,
          photo: p.photos?.[0]?.photo_reference
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=${key}`
            : undefined,
          website: p.website,
          lat: p.geometry?.location?.lat,
          lng: p.geometry?.location?.lng,
          types: p.types || [],
        })),
        nextPageToken: data.next_page_token,
      };
    }
    return { places: [] };
  } catch (error) {
    // Network failures should not red-screen the app in production flow.
    return { places: [], nextPageToken: undefined };
  }
};

export const getRestaurantWebsite = async (placeId?: string) => {
  if (!placeId) return undefined;
  try {
    const key = 'AIzaSyBXL7xl4adq0YzUzjWHrlgrLZ4BJq-jidk';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=website,url,name&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK') {
      return data.result?.website || data.result?.url;
    }
    return undefined;
  } catch (e) {
    return undefined;
  }
};

export const getRestaurantDetails = async (placeId?: string) => {
  if (!placeId) return undefined;
  try {
    const key = 'AIzaSyBXL7xl4adq0YzUzjWHrlgrLZ4BJq-jidk';
    const fields = [
      'formatted_phone_number',
      'opening_hours',
      'current_opening_hours',
      'rating',
      'user_ratings_total',
      'price_level',
      'website',
      'url',
      'delivery',
      'takeout',
      'dine_in',
      'name',
      'types',
    ].join(',');

    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== 'OK') return undefined;

    const r = data.result || {};
    return {
      phone: r.formatted_phone_number,
      openNow: r.current_opening_hours?.open_now ?? r.opening_hours?.open_now,
      hoursText: r.current_opening_hours?.weekday_text || r.opening_hours?.weekday_text || [],
      rating: r.rating,
      reviews: r.user_ratings_total,
      priceLevel: r.price_level,
      website: r.website || r.url,
      delivery: !!r.delivery,
      takeout: !!r.takeout,
      dineIn: !!r.dine_in,
      types: r.types || [],
    };
  } catch {
    return undefined;
  }
};

export const createLiveTable = async (payload: { userId: string; name: string; code?: string; avatar?: string; pushToken?: string }) => {
  const res = await fetch(`${API_BASE}/tables/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const joinLiveTable = async (payload: { code: string; userId: string; name: string; avatar?: string; pushToken?: string }) => {
  const res = await fetch(`${API_BASE}/tables/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const leaveLiveTable = async (payload: { code: string; userId: string }) => {
  const res = await fetch(`${API_BASE}/tables/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const getLiveTable = async (code: string) => {
  const res = await fetch(`${API_BASE}/tables/${encodeURIComponent(code)}`);
  return res.json();
};

export const getUserLiveTables = async (userId: string) => {
  const res = await fetch(`${API_BASE}/tables/user/${encodeURIComponent(userId)}`);
  return res.json();
};

export const getTableChat = async (code: string) => {
  const res = await fetch(`${API_BASE}/tables/chat/${encodeURIComponent(code)}`);
  return res.json();
};

export const sendTableChat = async (payload: { code: string; userId: string; name: string; avatar?: string; text: string; replyToId?: string; replyToName?: string; replyToText?: string }) => {
  const res = await fetch(`${API_BASE}/tables/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const editTableChat = async (payload: { code: string; messageId: string; userId: string; text: string }) => {
  const res = await fetch(`${API_BASE}/tables/chat`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const deleteTableChat = async (payload: { code: string; messageId: string; userId: string }) => {
  const res = await fetch(`${API_BASE}/tables/chat`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const addTableItem = async (payload: { code: string; userId: string; userName: string; name: string; qty?: number; price?: number; notes?: string }) => {
  const res = await fetch(`${API_BASE}/tables/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const removeTableItem = async (payload: { code: string; itemId: string; userId: string }) => {
  const res = await fetch(`${API_BASE}/tables/items`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const broadcastTablePayment = async (payload: { code: string; actorUserId: string; message: string }) => {
  const res = await fetch(`${API_BASE}/tables/payment-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const getOrders = async () => [];
export const createOrder = async () => ({});
