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
      console.warn('Places API warning:', data.status, data.error_message || '');
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
    console.error('Error searching:', error);
    return { places: [] };
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

export const getOrders = async () => [];
export const createOrder = async () => ({});
