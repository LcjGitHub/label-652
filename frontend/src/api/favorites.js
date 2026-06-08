import api from './products.js';

export const addFavorite = (productId) => {
  return api.post(`/favorites/${productId}`);
};

export const removeFavorite = (productId) => {
  return api.delete(`/favorites/${productId}`);
};

export const batchRemoveFavorites = (productIds) => {
  return api.delete('/favorites/batch', { data: { productIds } });
};

export const getFavorites = (params = {}) => {
  return api.get('/favorites', { params });
};

export const checkFavorite = (productId) => {
  return api.get(`/favorites/check/${productId}`);
};

export const getFavoriteIds = () => {
  return api.get('/favorites/list/ids');
};

export default api;
