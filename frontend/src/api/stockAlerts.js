import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getAlertCount = () => {
  return api.get('/stock-alerts/alert-count');
};

export const getAlertProducts = () => {
  return api.get('/stock-alerts/alert-products', {
    headers: getAuthHeader()
  });
};

export const getGlobalConfig = () => {
  return api.get('/stock-alerts/global-config', {
    headers: getAuthHeader()
  });
};

export const updateGlobalConfig = (data) => {
  return api.put('/stock-alerts/global-config', data, {
    headers: getAuthHeader()
  });
};

export const getProductConfig = (productId) => {
  return api.get('/stock-alerts/product-config', {
    params: productId ? { product_id: productId } : {},
    headers: getAuthHeader()
  });
};

export const updateProductConfig = (productId, data) => {
  return api.put(`/stock-alerts/product-config/${productId}`, data, {
    headers: getAuthHeader()
  });
};

export const deleteProductConfig = (productId) => {
  return api.delete(`/stock-alerts/product-config/${productId}`, {
    headers: getAuthHeader()
  });
};

export const createRestockOrder = (data) => {
  return api.post('/stock-alerts/restock-order', data, {
    headers: getAuthHeader()
  });
};

export const getRestockOrder = (id) => {
  return api.get(`/stock-alerts/restock-order/${id}`, {
    headers: getAuthHeader()
  });
};

export const exportRestockOrder = (id) => {
  return api.get(`/stock-alerts/restock-order/${id}/export`, {
    headers: getAuthHeader(),
    responseType: 'blob'
  });
};

export const sendRestockOrderEmail = (id, data = {}) => {
  return api.post(`/stock-alerts/restock-order/${id}/send-email`, data, {
    headers: getAuthHeader()
  });
};

export const getRestockOrders = (params = {}) => {
  return api.get('/stock-alerts/restock-orders', {
    params,
    headers: getAuthHeader()
  });
};

export default api;
