import api from './products.js';

export const getPromotions = (params = {}) => {
  return api.get('/promotions', { params });
};

export const getPromotion = (id) => {
  return api.get(`/promotions/${id}`);
};

export const getProductPromotion = (productId) => {
  return api.get(`/promotions/product/${productId}`);
};

export const createPromotion = (data) => {
  return api.post('/promotions', data);
};

export const updatePromotion = (id, data) => {
  return api.put(`/promotions/${id}`, data);
};

export const deletePromotion = (id) => {
  return api.delete(`/promotions/${id}`);
};
