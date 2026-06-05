import api from './products.js';

export const getProductReviews = (productId, params = {}) => {
  return api.get(`/reviews/product/${productId}`, { params });
};

export const getProductReviewStats = (productId) => {
  return api.get(`/reviews/product/${productId}/stats`);
};

export const getReview = (id) => {
  return api.get(`/reviews/${id}`);
};

export const createReview = (data) => {
  return api.post('/reviews', data);
};

export const updateReview = (id, data) => {
  return api.put(`/reviews/${id}`, data);
};

export const deleteReview = (id) => {
  return api.delete(`/reviews/${id}`);
};

export const getMyReviews = (params = {}) => {
  return api.get('/reviews/user/my', { params });
};

export const getMyReviewForProduct = (productId) => {
  return api.get(`/reviews/product/${productId}/my`);
};
