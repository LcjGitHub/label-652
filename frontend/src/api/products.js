import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const getProducts = (params = {}) => {
  return api.get('/products', { params });
};

export const getCategories = () => {
  return api.get('/products/categories');
};

export const getProduct = (id) => {
  return api.get(`/products/${id}`);
};

export const createProduct = (data) => {
  return api.post('/products', data);
};

export const updateProduct = (id, data) => {
  return api.put(`/products/${id}`, data);
};

export const deleteProduct = (id) => {
  return api.delete(`/products/${id}`);
};

export default api;
