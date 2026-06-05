<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="show" class="drawer-overlay" @click.self="handleClose">
        <Transition name="drawer-slide">
          <div v-if="show" class="drawer">
            <div class="drawer-header">
              <h2 class="drawer-title">购物车</h2>
              <button class="drawer-close" @click="handleClose">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="drawer-body">
              <div v-if="isLoading" class="loading">
                <div class="spinner"></div>
                <p>加载中...</p>
              </div>

              <div v-else-if="cartItems.length === 0" class="empty-cart">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
                <p>购物车是空的</p>
                <button class="btn btn-primary btn-sm" @click="handleClose">
                  去逛逛
                </button>
              </div>

              <div v-else class="cart-items">
                <div
                  v-for="item in cartItems"
                  :key="item.id"
                  class="cart-item"
                >
                  <img
                    :src="item.image || defaultPlaceholder"
                    :alt="item.name"
                    class="cart-item-image"
                    @error="handleImageError($event)"
                  />
                  <div class="cart-item-info">
                    <h3 class="cart-item-name">{{ item.name }}</h3>
                    <p class="cart-item-price">¥{{ item.price.toFixed(2) }}</p>
                    <div class="cart-item-actions">
                      <div class="quantity-controls">
                        <button
                          class="qty-btn"
                          :disabled="isLoading"
                          @click="decreaseQuantity(item)"
                        >
                          −
                        </button>
                        <span class="qty-value">{{ item.quantity }}</span>
                        <button
                          class="qty-btn"
                          :disabled="isLoading || item.quantity >= item.stock"
                          @click="increaseQuantity(item)"
                        >
                          +
                        </button>
                      </div>
                      <button
                        class="btn btn-outline btn-xs"
                        :disabled="isLoading"
                        @click="removeItem(item)"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="cartItems.length > 0" class="drawer-footer">
              <div class="cart-summary">
                <div class="summary-row">
                  <span>共 {{ cartCount }} 件商品</span>
                </div>
                <div class="summary-row total">
                  <span class="label">合计：</span>
                  <span class="price">¥{{ cartTotal.toFixed(2) }}</span>
                </div>
              </div>
              <div class="footer-actions">
                <button
                  class="btn btn-outline"
                  :disabled="isLoading"
                  @click="handleClearCart"
                >
                  清空购物车
                </button>
                <button
                  class="btn btn-primary"
                  :disabled="isLoading"
                  @click="handleCheckout"
                >
                  去结算
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useCart } from '../composables/useCart.js';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

const {
  cartItems,
  cartCount,
  cartTotal,
  isLoading,
  handleUpdateQuantity,
  handleRemoveFromCart,
  handleClearCart: clearCartApi,
  closeCartDrawer
} = useCart();

const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

const handleClose = () => {
  closeCartDrawer();
  emit('close');
};

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

const decreaseQuantity = async (item) => {
  if (item.quantity <= 1) {
    removeItem(item);
    return;
  }
  const result = await handleUpdateQuantity(item.product_id, item.quantity - 1);
  if (!result.success) {
    alert(result.message);
  }
};

const increaseQuantity = async (item) => {
  const result = await handleUpdateQuantity(item.product_id, item.quantity + 1);
  if (!result.success) {
    alert(result.message);
  }
};

const removeItem = async (item) => {
  if (!confirm(`确定要删除 "${item.name}" 吗？`)) return;
  const result = await handleRemoveFromCart(item.product_id);
  if (!result.success) {
    alert(result.message);
  }
};

const handleClearCart = async () => {
  if (!confirm('确定要清空购物车吗？')) return;
  const result = await clearCartApi();
  if (!result.success) {
    alert(result.message);
  }
};

const handleCheckout = () => {
  alert('结算功能开发中...\n\n当前购物车合计：¥' + cartTotal.value.toFixed(2));
};
</script>

<style scoped>
.drawer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  justify-content: flex-end;
}

.drawer {
  width: 100%;
  max-width: 420px;
  height: 100%;
  background: white;
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.15);
}

.drawer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.drawer-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.drawer-close {
  background: none;
  border: none;
  color: white;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.drawer-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}

.loading,
.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  color: #999;
}

.empty-cart svg {
  color: #ddd;
  margin-bottom: 16px;
}

.empty-cart p {
  margin-bottom: 20px;
  font-size: 15px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.cart-items {
  padding: 16px;
}

.cart-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  margin-bottom: 12px;
}

.cart-item-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 8px;
  background: #f0f0f0;
  flex-shrink: 0;
}

.cart-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.cart-item-name {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cart-item-price {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #e74c3c;
}

.cart-item-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  background: white;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.qty-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  color: #667eea;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.qty-btn:hover:not(:disabled) {
  background: #f0f0f0;
}

.qty-btn:disabled {
  color: #ccc;
  cursor: not-allowed;
}

.qty-value {
  min-width: 30px;
  text-align: center;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.drawer-footer {
  border-top: 1px solid #eee;
  padding: 20px 24px;
  background: white;
}

.cart-summary {
  margin-bottom: 16px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.summary-row.total {
  font-size: 18px;
  color: #333;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed #eee;
}

.summary-row.total .label {
  font-weight: 500;
}

.summary-row.total .price {
  font-weight: 700;
  color: #e74c3c;
  font-size: 24px;
}

.footer-actions {
  display: flex;
  gap: 12px;
}

.footer-actions .btn {
  flex: 1;
  padding: 12px 20px;
  font-size: 15px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 16px;
  font-size: 13px;
}

.btn-xs {
  padding: 4px 12px;
  font-size: 12px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-outline {
  background: white;
  border: 1px solid #ddd;
  color: #666;
}

.btn-outline:hover:not(:disabled) {
  border-color: #e74c3c;
  color: #e74c3c;
}

.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: background 0.3s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  background: rgba(0, 0, 0, 0);
}

.drawer-slide-enter-active,
.drawer-slide-leave-active {
  transition: transform 0.3s ease;
}

.drawer-slide-enter-from,
.drawer-slide-leave-to {
  transform: translateX(100%);
}

@media (max-width: 480px) {
  .drawer {
    max-width: 100%;
  }
}
</style>
