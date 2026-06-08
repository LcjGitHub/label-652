import api from './products.js';

export const getOrders = (params = {}) => {
  return api.get('/orders', { params });
};

export const getOrder = (id) => {
  return api.get(`/orders/${id}`);
};

export const createOrder = (data) => {
  return api.post('/orders/create', data);
};

export const cancelOrder = (id) => {
  return api.put(`/orders/${id}/cancel`);
};

export const updateOrderStatus = (id, status) => {
  return api.put(`/orders/${id}/status`, { status });
};

export const calculateOrder = (data = {}) => {
  return api.post('/orders/calculate', data);
};

export const getMyAvailableCoupons = (params = {}) => {
  return api.get('/orders/my/available-coupons', { params });
};
