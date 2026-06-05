import api from './products.js';

export const getCart = () => {
  return api.get('/cart');
};

export const addToCart = (productId, quantity = 1) => {
  return api.post('/cart/add', { product_id: productId, quantity });
};

export const updateCartItem = (productId, quantity) => {
  return api.put(`/cart/update/${productId}`, { quantity });
};

export const removeFromCart = (productId) => {
  return api.delete(`/cart/remove/${productId}`);
};

export const clearCart = () => {
  return api.delete('/cart/clear');
};

export const mergeCart = (items) => {
  return api.post('/cart/merge', { items });
};
