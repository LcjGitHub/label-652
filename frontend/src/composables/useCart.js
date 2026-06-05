import { ref, watch } from 'vue';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  mergeCart
} from '../api/cart.js';
import { useAuth } from './useAuth.js';

const LOCAL_CART_KEY = 'local_cart';
const MERGE_FLAG_KEY = 'cart_merge_done';

const cartItems = ref([]);
const cartCount = ref(0);
const cartTotal = ref(0);
const isLoading = ref(false);
const isUpdating = ref(false);
const isCartDrawerOpen = ref(false);
const isInitialized = ref(false);
const mergeInProgress = ref(false);
const updatingItemId = ref(null);

const getLocalCart = () => {
  try {
    const data = localStorage.getItem(LOCAL_CART_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveLocalCart = (items) => {
  localStorage.setItem(LOCAL_CART_KEY, JSON.stringify(items));
};

const clearLocalCart = () => {
  localStorage.removeItem(LOCAL_CART_KEY);
};

const getMergeFlag = () => {
  return localStorage.getItem(MERGE_FLAG_KEY) === 'true';
};

const setMergeFlag = (value) => {
  if (value) {
    localStorage.setItem(MERGE_FLAG_KEY, 'true');
  } else {
    localStorage.removeItem(MERGE_FLAG_KEY);
  }
};

const calculateCartStats = (items) => {
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return { count, total };
};

const updateCartState = (data) => {
  if (data.items) cartItems.value = data.items;
  if (data.totalCount !== undefined) cartCount.value = data.totalCount;
  if (data.totalPrice !== undefined) cartTotal.value = data.totalPrice;
};

const enrichLocalCartItems = async (items) => {
  const { getProduct } = await import('../api/products.js');
  const enriched = [];

  for (const item of items) {
    try {
      const res = await getProduct(item.product_id);
      if (res.data.success) {
        const product = res.data.data;
        const quantity = Math.min(item.quantity, product.stock);
        if (quantity > 0) {
          enriched.push({
            ...item,
            id: `local_${item.product_id}`,
            name: product.name,
            description: product.description,
            price: product.price,
            category: product.category,
            stock: product.stock,
            image: product.image
          });
        }
      }
    } catch (err) {
      console.error('获取商品信息失败:', err);
    }
  }

  return enriched;
};

let authWatcher = null;

const setupAuthWatcher = () => {
  if (authWatcher) return;

  const { user, isAuthenticated } = useAuth();

  authWatcher = watch(user, async (newUser, oldUser) => {
    if (newUser && !oldUser) {
      if (!mergeInProgress.value && !getMergeFlag()) {
        mergeInProgress.value = true;
        try {
          await handleMergeLocalCart();
          setMergeFlag(true);
        } finally {
          mergeInProgress.value = false;
        }
      } else if (getMergeFlag()) {
        await loadCartFromServer();
      }
    } else if (!newUser && oldUser) {
      setMergeFlag(false);
      await loadCart();
    }
  }, { immediate: false });
};

const loadCartFromServer = async () => {
  isLoading.value = true;
  try {
    const res = await getCart();
    if (res.data.success) {
      updateCartState(res.data.data);
    }
  } catch (err) {
    console.error('加载购物车失败:', err);
  } finally {
    isLoading.value = false;
  }
};

export function useCart() {
  const { isAuthenticated, user } = useAuth();

  if (!isInitialized.value) {
    isInitialized.value = true;
    setupAuthWatcher();
  }

  const loadCart = async () => {
    if (isAuthenticated.value) {
      await loadCartFromServer();
    } else {
      isLoading.value = true;
      try {
        const localItems = getLocalCart();
        const enrichedItems = await enrichLocalCartItems(localItems);
        cartItems.value = enrichedItems;
        const { count, total } = calculateCartStats(enrichedItems);
        cartCount.value = count;
        cartTotal.value = total;
        saveLocalCart(enrichedItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity
        })));
      } catch (err) {
        console.error('加载购物车失败:', err);
        cartItems.value = [];
        cartCount.value = 0;
        cartTotal.value = 0;
      } finally {
        isLoading.value = false;
      }
    }
  };

  const ensureCartLoaded = async () => {
    if (isAuthenticated.value && cartItems.value.length === 0 && !isLoading.value) {
      await loadCartFromServer();
    }
  };

  const handleAddToCart = async (productId, quantity = 1) => {
    try {
      if (isAuthenticated.value) {
        const res = await addToCart(productId, quantity);
        if (res.data.success) {
          updateCartState(res.data.data);
          return { success: true, message: res.data.message };
        }
        return { success: false, message: res.data.message };
      } else {
        const localItems = getLocalCart();
        const existingIndex = localItems.findIndex(item => item.product_id === productId);

        const { getProduct } = await import('../api/products.js');
        const productRes = await getProduct(productId);
        if (!productRes.data.success) {
          return { success: false, message: '商品不存在' };
        }
        const product = productRes.data.data;

        if (existingIndex >= 0) {
          const newQuantity = localItems[existingIndex].quantity + quantity;
          if (newQuantity > product.stock) {
            return { success: false, message: `库存不足，最多可添加 ${product.stock} 件` };
          }
          localItems[existingIndex].quantity = newQuantity;
        } else {
          if (quantity > product.stock) {
            return { success: false, message: `库存不足，最多可添加 ${product.stock} 件` };
          }
          localItems.push({ product_id: productId, quantity });
        }

        saveLocalCart(localItems);
        await loadCart();
        return { success: true, message: '已添加到购物车' };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '添加失败'
      };
    }
  };

  const handleUpdateQuantity = async (productId, quantity) => {
    if (quantity < 1) return { success: false, message: '数量不能小于1' };

    updatingItemId.value = productId;
    try {
      if (isAuthenticated.value) {
        const res = await updateCartItem(productId, quantity);
        if (res.data.success) {
          updateCartState(res.data.data);
          return { success: true };
        }
        return { success: false, message: res.data.message };
      } else {
        const localItems = getLocalCart();
        const existingIndex = localItems.findIndex(item => item.product_id === productId);

        if (existingIndex < 0) {
          return { success: false, message: '购物车中不存在该商品' };
        }

        const { getProduct } = await import('../api/products.js');
        const productRes = await getProduct(productId);
        if (productRes.data.success) {
          const product = productRes.data.data;
          if (quantity > product.stock) {
            return { success: false, message: `库存不足，最多可添加 ${product.stock} 件` };
          }
        }

        localItems[existingIndex].quantity = quantity;
        saveLocalCart(localItems);
        await loadCart();
        return { success: true };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '更新失败'
      };
    } finally {
      updatingItemId.value = null;
    }
  };

  const handleRemoveFromCart = async (productId) => {
    updatingItemId.value = productId;
    try {
      if (isAuthenticated.value) {
        const res = await removeFromCart(productId);
        if (res.data.success) {
          updateCartState(res.data.data);
          return { success: true, message: res.data.message };
        }
        return { success: false, message: res.data.message };
      } else {
        const localItems = getLocalCart();
        const filtered = localItems.filter(item => item.product_id !== productId);
        saveLocalCart(filtered);
        await loadCart();
        return { success: true, message: '已从购物车移除' };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '删除失败'
      };
    } finally {
      updatingItemId.value = null;
    }
  };

  const handleClearCart = async () => {
    isUpdating.value = true;
    try {
      if (isAuthenticated.value) {
        const res = await clearCart();
        if (res.data.success) {
          cartItems.value = [];
          cartCount.value = 0;
          cartTotal.value = 0;
          return { success: true, message: res.data.message };
        }
        return { success: false, message: res.data.message };
      } else {
        clearLocalCart();
        cartItems.value = [];
        cartCount.value = 0;
        cartTotal.value = 0;
        return { success: true, message: '购物车已清空' };
      }
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '清空失败'
      };
    } finally {
      isUpdating.value = false;
    }
  };

  const handleMergeLocalCart = async () => {
    const localItems = getLocalCart();
    if (localItems.length === 0 || !isAuthenticated.value) return;

    isLoading.value = true;
    try {
      const res = await mergeCart(localItems);
      if (res.data.success) {
        clearLocalCart();
        updateCartState(res.data.data);
        return { success: true, message: res.data.message };
      }
    } catch (err) {
      console.error('合并购物车失败:', err);
    } finally {
      isLoading.value = false;
    }
  };

  const openCartDrawer = async () => {
    await ensureCartLoaded();
    isCartDrawerOpen.value = true;
  };

  const closeCartDrawer = () => {
    isCartDrawerOpen.value = false;
  };

  const toggleCartDrawer = async () => {
    if (!isCartDrawerOpen.value) {
      await ensureCartLoaded();
    }
    isCartDrawerOpen.value = !isCartDrawerOpen.value;
  };

  return {
    cartItems,
    cartCount,
    cartTotal,
    isLoading,
    isUpdating,
    isCartDrawerOpen,
    updatingItemId,
    loadCart,
    loadCartFromServer,
    handleAddToCart,
    handleUpdateQuantity,
    handleRemoveFromCart,
    handleClearCart,
    handleMergeLocalCart,
    openCartDrawer,
    closeCartDrawer,
    toggleCartDrawer,
    ensureCartLoaded
  };
}
