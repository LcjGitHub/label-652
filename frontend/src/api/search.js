import api from './products.js';

export const searchProducts = (params = {}) => {
  return api.get('/search', { params });
};

export const getSearchSuggestions = (q, limit = 8) => {
  return api.get('/search/suggestions', { params: { q, limit } });
};

export const getHotKeywords = (limit = 10) => {
  return api.get('/search/hot', { params: { limit } });
};

export const getSearchHistory = (limit = 10) => {
  return api.get('/search/history', { params: { limit } });
};

export const clearSearchHistory = () => {
  return api.delete('/search/history');
};

export default api;
