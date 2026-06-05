import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const recordBrowse = (productId) => {
  return api.get(`/recommendations/browse/${productId}`);
};

export const getSimilarProducts = (productId, limit = 8) => {
  return api.get(`/recommendations/similar/${productId}`, { params: { limit } });
};

export const getRecommendationsForUser = (limit = 12) => {
  return api.get('/recommendations/for-user', { params: { limit } });
};

export const getHotProducts = (limit = 10) => {
  return api.get('/recommendations/hot', { params: { limit } });
};

export const getNewProducts = (limit = 10) => {
  return api.get('/recommendations/new', { params: { limit } });
};

export default api;
