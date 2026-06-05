<template>
  <div class="checkout-page container">
    <div class="page-header">
      <h1 class="page-title">确认订单</h1>
      <router-link to="/" class="back-link">
        ← 继续购物
      </router-link>
    </div>

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
      <router-link to="/" class="btn btn-primary">
        去逛逛
      </router-link>
    </div>

    <div v-else class="checkout-content">
      <div class="checkout-main">
        <div class="checkout-section">
          <h2 class="section-title">配送信息</h2>
          <div class="form-group">
            <label class="form-label">收货地址</label>
            <textarea
              v-model="formData.shipping_address"
              class="form-textarea"
              placeholder="请输入详细的收货地址，包括省、市、区、街道、门牌号等"
              rows="3"
            ></textarea>
          </div>
        </div>

        <div class="checkout-section">
          <h2 class="section-title">支付方式</h2>
          <div class="payment-options">
            <label
              v-for="method in paymentMethods"
              :key="method.value"
              class="payment-option"
              :class="{ active: formData.payment_method === method.value }"
            >
              <input
                type="radio"
                :value="method.value"
                v-model="formData.payment_method"
                class="payment-radio"
              />
              <div class="payment-icon">{{ method.icon }}</div>
              <div class="payment-info">
                <div class="payment-name">{{ method.name }}</div>
                <div class="payment-desc">{{ method.desc }}</div>
              </div>
            </label>
          </div>
        </div>

        <div class="checkout-section">
          <h2 class="section-title">订单备注</h2>
          <div class="form-group">
            <textarea
              v-model="formData.remark"
              class="form-textarea"
              placeholder="选填，可填写您的特殊需求"
              rows="2"
            ></textarea>
          </div>
        </div>

        <div class="checkout-section">
          <h2 class="section-title">商品清单</h2>
          <div class="cart-items">
            <div
              v-for="item in cartItems"
              :key="item.id"
              class="cart-item"
            >
              <img
                :src="item.image || defaultPlaceholder"
                :alt="item.name"
                class="item-image"
                @error="handleImageError($event)"
              />
              <div class="item-info">
                <h3 class="item-name">{{ item.name }}</h3>
                <p class="item-price">¥{{ item.price.toFixed(2) }}</p>
                <p class="item-quantity">x {{ item.quantity }}</p>
              </div>
              <div class="item-subtotal">
                ¥{{ (item.price * item.quantity).toFixed(2) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="checkout-sidebar">
        <div class="order-summary">
          <h3 class="summary-title">订单汇总</h3>
          <div class="summary-row">
            <span>商品件数</span>
            <span>{{ cartCount }} 件</span>
          </div>
          <div class="summary-row">
            <span>商品总价</span>
            <span>¥{{ cartTotal.toFixed(2) }}</span>
          </div>
          <div class="summary-row">
            <span>运费</span>
            <span class="free">免运费</span>
          </div>
          <div class="summary-row total">
            <span>应付金额</span>
            <span class="total-price">¥{{ cartTotal.toFixed(2) }}</span>
          </div>
          <button
            class="btn btn-primary btn-block btn-submit"
            :disabled="isSubmitting || !formData.shipping_address.trim()"
            @click="handleSubmitOrder"
          >
            <span v-if="isSubmitting">提交中...</span>
            <span v-else>提交订单</span>
          </button>
          <p v-if="!formData.shipping_address.trim()" class="hint">
            请填写收货地址
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useCart } from '../composables/useCart.js';
import { createOrder } from '../api/orders.js';

const router = useRouter();
const {
  cartItems,
  cartCount,
  cartTotal,
  isLoading,
  loadCart
} = useCart();

const isSubmitting = ref(false);
const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

const paymentMethods = [
  { value: 'cod', name: '货到付款', desc: '送货上门时支付现金或刷卡', icon: '💵' },
  { value: 'wechat', name: '微信支付', desc: '使用微信扫码支付', icon: '💚' },
  { value: 'alipay', name: '支付宝', desc: '使用支付宝扫码支付', icon: '📱' }
];

const formData = reactive({
  shipping_address: '',
  payment_method: 'cod',
  remark: ''
});

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

const handleSubmitOrder = async () => {
  if (!formData.shipping_address.trim()) {
    alert('请填写收货地址');
    return;
  }

  isSubmitting.value = true;
  try {
    const res = await createOrder({
      shipping_address: formData.shipping_address.trim(),
      payment_method: formData.payment_method,
      remark: formData.remark.trim()
    });

    if (res.data.success) {
      await loadCart();
      alert('订单提交成功！\n\n订单号：' + res.data.data.order_no);
      router.push(`/orders/${res.data.data.id}`);
    } else {
      alert(res.data.message || '订单提交失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '订单提交失败，请稍后重试');
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  loadCart();
});
</script>

<style scoped>
.checkout-page {
  max-width: 1200px;
  padding: 30px 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.page-title {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: #333;
}

.back-link {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.back-link:hover {
  text-decoration: underline;
}

.loading,
.empty-cart {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
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

.checkout-content {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 30px;
  align-items: start;
}

.checkout-section {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.section-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.form-group {
  margin-bottom: 0;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #555;
}

.form-textarea {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-textarea:focus {
  outline: none;
  border-color: #667eea;
}

.payment-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.payment-option {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.payment-option:hover {
  border-color: #667eea;
}

.payment-option.active {
  border-color: #667eea;
  background: #f8f9ff;
}

.payment-radio {
  width: 18px;
  height: 18px;
  accent-color: #667eea;
}

.payment-icon {
  font-size: 28px;
}

.payment-name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.payment-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cart-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  align-items: center;
}

.item-image {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 6px;
  background: #f0f0f0;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-price {
  margin: 0 0 2px;
  font-size: 14px;
  color: #e74c3c;
  font-weight: 500;
}

.item-quantity {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.item-subtotal {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.checkout-sidebar {
  position: sticky;
  top: 20px;
}

.order-summary {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.summary-title {
  margin: 0 0 20px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-size: 14px;
  color: #666;
}

.summary-row.total {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #eee;
  font-size: 16px;
  color: #333;
}

.summary-row .free {
  color: #27ae60;
}

.summary-row .total-price {
  font-size: 24px;
  font-weight: 700;
  color: #e74c3c;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
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

.btn-block {
  width: 100%;
}

.btn-submit {
  margin-top: 16px;
  padding: 14px 24px;
  font-size: 16px;
}

.hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #e74c3c;
  text-align: center;
}

@media (max-width: 900px) {
  .checkout-content {
    grid-template-columns: 1fr;
  }

  .checkout-sidebar {
    position: static;
  }
}

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .page-title {
    font-size: 22px;
  }
}
</style>
