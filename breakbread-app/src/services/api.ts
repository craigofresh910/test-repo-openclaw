import axios from 'axios';

const API_BASE = 'https://lunchbreakapp.com/api';

export const searchNearbyRestaurants = async (lat: number, lng: number, radius: number = 16093, query?: string) => {
  try {
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?location=${lat},${lng}&radius=${radius}&key=AIzaSyBXL7xl4adq0YzUzjWHrlgrLZ4BJq-jidk`;
    if (query) url += `&query=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.results) {
      return {
        places: data.results.map((p: any) => ({
          place_id: p.place_id,
          name: p.name,
          address: p.formatted_address || p.vicinity || '',
          rating: p.rating,
          photo: p.photos?.[0]?.photo_reference 
            ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photos[0].photo_reference}&key=AIzaSyBXL7xl4adq0YzUzjWHrlgrLZ4BJq-jidk`
            : undefined,
          website: p.website,
        })),
        nextPageToken: data.next_page_token
      };
    }
    return { places: [] };
  } catch (error) {
    console.error('Error searching:', error);
    return { places: [] };
  }
};

export const getOrders = async () => [];
export const createOrder = async () => ({});
