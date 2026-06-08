import api from './products.js';

export const getAvailableCoupons = () => {
  return api.get('/coupons/available');
};

export const getMyCoupons = (params = {}) => {
  return api.get('/coupons/my', { params });
};

export const getProductCoupons = (productId) => {
  return api.get(`/coupons/product/${productId}`);
};

export const getCoupon = (id) => {
  return api.get(`/coupons/${id}`);
};

export const createCoupon = (data) => {
  return api.post('/coupons', data);
};

export const receiveCoupon = (id) => {
  return api.post(`/coupons/${id}/receive`);
};

export const validateCoupon = (data) => {
  return api.post('/coupons/validate', data);
};

export const updateCoupon = (id, data) => {
  return api.put(`/coupons/${id}`, data);
};

export const deleteCoupon = (id) => {
  return api.delete(`/coupons/${id}`);
};
