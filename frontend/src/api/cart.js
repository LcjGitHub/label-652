import api from './products.js';

export const getCart = () => {
  return api.get('/cart');
};

export const addToCart = (productId, quantity = 1, skuId = null) => {
  const data = { product_id: productId, quantity };
  if (skuId) data.sku_id = skuId;
  return api.post('/cart/add', data);
};

export const updateCartItem = (cartItemId, quantity) => {
  return api.put(`/cart/update/${cartItemId}`, { quantity });
};

export const updateCartItemByProduct = (productId, quantity, skuId = null) => {
  const data = { quantity };
  if (skuId) data.sku_id = skuId;
  return api.put(`/cart/update-product/${productId}`, data);
};

export const removeFromCart = (cartItemId) => {
  return api.delete(`/cart/remove/${cartItemId}`);
};

export const removeFromCartByProduct = (productId, skuId = null) => {
  const data = {};
  if (skuId) data.sku_id = skuId;
  return api.delete(`/cart/remove-product/${productId}`, { data });
};

export const clearCart = () => {
  return api.delete('/cart/clear');
};

export const mergeCart = (items) => {
  return api.post('/cart/merge', { items });
};
