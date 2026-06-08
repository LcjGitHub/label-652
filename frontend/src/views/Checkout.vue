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
          <div class="address-list">
            <label
              v-for="address in addressList"
              :key="address.id"
              class="address-item"
              :class="{ active: formData.address_id === address.id }"
            >
              <input
                type="radio"
                :value="address.id"
                v-model="formData.address_id"
                class="address-radio"
                @change="selectAddress(address)"
              />
              <div class="address-info">
                <div class="address-header">
                  <span class="address-name">{{ address.name }}</span>
                  <span class="address-phone">{{ address.phone }}</span>
                  <span v-if="address.isDefault" class="address-tag">默认</span>
                </div>
                <div class="address-detail">{{ address.detail }}</div>
              </div>
              <div class="address-check">
                <svg v-if="formData.address_id === address.id" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </label>
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
                <h3 class="item-name">
                  {{ item.name }}
                  <span v-if="item.promotion" class="item-promotion-tag">{{ item.promotion.display_text }}</span>
                </h3>
                <p v-if="item.sku_name" class="item-sku">{{ item.sku_name }}</p>
                <div class="item-price-line">
                  <span class="item-price">¥{{ item.price.toFixed(2) }}</span>
                  <span v-if="item.promotion && item.promotion.price && item.promotion.price < item.price" class="item-promotion-price">
                    促销价 ¥{{ item.promotion.price.toFixed(2) }}
                  </span>
                </div>
                <p class="item-quantity">x {{ item.quantity }}</p>
              </div>
              <div class="item-subtotal">
                <div v-if="item.promotion && item.promotion.price && item.promotion.price < item.price" class="item-subtotal-promotion">
                  <span class="subtotal-original">¥{{ (item.price * item.quantity).toFixed(2) }}</span>
                  <span class="subtotal-final">¥{{ (item.promotion.price * item.quantity).toFixed(2) }}</span>
                </div>
                <div v-else>
                  ¥{{ (item.price * item.quantity).toFixed(2) }}
                </div>
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
            <span>¥{{ (discountCalculation.original_total || cartTotal).toFixed(2) }}</span>
          </div>
          <div v-if="discountCalculation.promotion_discount > 0" class="summary-row discount">
            <span>
              促销优惠
            </span>
            <span class="discount-value">-¥{{ discountCalculation.promotion_discount.toFixed(2) }}</span>
          </div>
          <div v-if="discountCalculation.coupon_discount > 0" class="summary-row discount">
            <span class="coupon-label">
              优惠券
              <span v-if="selectedCoupon" class="coupon-name-tag">{{ selectedCoupon.name }}</span>
            </span>
            <span class="discount-value">-¥{{ discountCalculation.coupon_discount.toFixed(2) }}</span>
          </div>
          <div class="summary-row coupon-select-row" @click="showCouponModal = true">
            <span>选择优惠券</span>
            <span class="coupon-select-value">
              <span v-if="selectedCoupon">已选 -¥{{ discountCalculation.coupon_discount.toFixed(2) }}</span>
              <span v-else-if="availableCoupons.length > 0">
                {{ availableCoupons.filter(c => c.can_use).length }} 张可用
              </span>
              <span v-else>暂无可选</span>
              <span class="arrow">›</span>
            </span>
          </div>
          <div class="summary-row">
            <span>运费</span>
            <span class="free">免运费</span>
          </div>
          <div v-if="discountCalculation.discount_amount > 0" class="summary-row total-discount">
            <span>共优惠</span>
            <span class="discount-value">-¥{{ discountCalculation.discount_amount.toFixed(2) }}</span>
          </div>
          <div class="summary-row total">
            <span>应付金额</span>
            <span class="total-price">¥{{ (discountCalculation.final_total || cartTotal).toFixed(2) }}</span>
          </div>
          <button
            class="btn btn-primary btn-block btn-submit"
            :disabled="isSubmitting || !formData.address_id"
            @click="handleSubmitOrder"
          >
            <span v-if="isSubmitting">提交中...</span>
            <span v-else>提交订单</span>
          </button>
          <p v-if="!formData.address_id" class="hint">
            请选择收货地址
          </p>
        </div>
      </div>

      <div v-if="showCouponModal" class="coupon-modal-overlay" @click.self="showCouponModal = false">
        <div class="coupon-modal">
          <div class="coupon-modal-header">
            <h3>选择优惠券</h3>
            <button class="coupon-modal-close" @click="showCouponModal = false">&times;</button>
          </div>
          <div class="coupon-modal-body">
            <div v-if="couponsLoading" class="loading small">
              <div class="spinner small"></div>
              <p>加载中...</p>
            </div>
            <div v-else-if="availableCoupons.length === 0" class="empty small">
              <p>暂无可用优惠券</p>
            </div>
            <div v-else class="modal-coupons-list">
              <div
                v-for="coupon in availableCoupons"
                :key="coupon.user_coupon_id"
                class="modal-coupon-item"
                :class="{ 'coupon-selected': selectedUserCouponId === coupon.user_coupon_id, 'coupon-disabled': !coupon.can_use }"
                @click="selectCoupon(coupon)"
              >
                <div class="modal-coupon-left" :class="{ 'coupon-cant-use': !coupon.can_use }">
                  <div class="modal-coupon-value">
                    <template v-if="coupon.type === 'fixed'">
                      <span class="modal-coupon-symbol">¥</span>
                      <span class="modal-coupon-amount">{{ coupon.value }}</span>
                    </template>
                    <template v-else>
                      <span class="modal-coupon-amount">{{ coupon.value * 10 }}</span>
                      <span class="modal-coupon-symbol">折</span>
                    </template>
                  </div>
                  <div class="modal-coupon-condition">
                    <template v-if="coupon.min_order_amount > 0">
                      满 ¥{{ coupon.min_order_amount }} 可用
                    </template>
                    <template v-else>
                      无门槛
                    </template>
                  </div>
                </div>
                <div class="modal-coupon-right">
                  <div class="modal-coupon-name">{{ coupon.name }}</div>
                  <div class="modal-coupon-expire">{{ coupon.displayText }}</div>
                  <div v-if="!coupon.can_use" class="coupon-cant-use-reason">{{ coupon.reason }}</div>
                </div>
                <div v-if="selectedUserCouponId === coupon.user_coupon_id" class="coupon-checkmark">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
            </div>
          </div>
          <div class="coupon-modal-footer">
            <button class="btn btn-outline" @click="selectedUserCouponId = null; showCouponModal = false;">
              不使用优惠券
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSuccessToast" class="success-toast">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="16 12 10 18 6 14"></polyline>
      </svg>
      <span>{{ successMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useCart } from '../composables/useCart.js';
import { createOrder, calculateOrder, getMyAvailableCoupons } from '../api/orders.js';
import { useAuth } from '../composables/useAuth.js';

const router = useRouter();
const { isAuthenticated } = useAuth();
const {
  cartItems,
  cartCount,
  cartTotal,
  isLoading,
  loadCart
} = useCart();

const isSubmitting = ref(false);
const showSuccessToast = ref(false);
const successMessage = ref('');
const availableCoupons = ref([]);
const couponsLoading = ref(false);
const selectedUserCouponId = ref(null);
const showCouponModal = ref(false);
const discountCalculation = ref({
  original_total: 0,
  promotion_discount: 0,
  coupon_discount: 0,
  discount_amount: 0,
  final_total: 0
});
const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

const selectedCoupon = computed(() => {
  if (!selectedUserCouponId.value) return null;
  return availableCoupons.value.find(c => c.user_coupon_id === selectedUserCouponId.value) || null;
});

const addressList = ref([
  { id: 1, name: '张三', phone: '138****8888', detail: '北京市朝阳区建国路88号SOHO现代城A座1201室', isDefault: true },
  { id: 2, name: '张三', phone: '138****8888', detail: '上海市浦东新区陆家嘴环路1000号恒生银行大厦20楼', isDefault: false },
  { id: 3, name: '李四', phone: '139****9999', detail: '广州市天河区珠江新城华夏路10号富力中心2505室', isDefault: false }
]);

const paymentMethods = [
  { value: 'cod', name: '货到付款', desc: '送货上门时支付现金或刷卡', icon: '💵' },
  { value: 'wechat', name: '微信支付', desc: '使用微信扫码支付', icon: '💚' },
  { value: 'alipay', name: '支付宝', desc: '使用支付宝扫码支付', icon: '📱' }
];

const formData = reactive({
  address_id: 1,
  shipping_address: addressList.value[0].detail,
  payment_method: 'cod',
  remark: ''
});

const selectAddress = (address) => {
  formData.shipping_address = address.detail;
};

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

const fetchDiscountCalc = async () => {
  if (cartItems.value.length === 0) return;
  try {
    const res = await calculateOrder({
      user_coupon_id: selectedUserCouponId.value
    });
    if (res.data.success) {
      discountCalculation.value = res.data.data;
    }
  } catch (err) {
    console.error('计算优惠失败:', err);
  }
};

const fetchAvailableCoupons = async () => {
  if (!isAuthenticated.value) return;
  couponsLoading.value = true;
  try {
    const res = await getMyAvailableCoupons({ total_amount: discountCalculation.value.original_total || cartTotal.value });
    if (res.data.success) {
      availableCoupons.value = res.data.data.available || [];
      const validCoupons = availableCoupons.value.filter(c => c.can_use);
      if (validCoupons.length > 0 && !selectedUserCouponId.value) {
        validCoupons.sort((a, b) => b.discount_amount - a.discount_amount);
        selectedUserCouponId.value = validCoupons[0].user_coupon_id;
      }
    }
  } catch (err) {
    console.error('获取可用优惠券失败:', err);
  } finally {
    couponsLoading.value = false;
  }
};

const selectCoupon = (coupon) => {
  if (!coupon.can_use) return;
  if (selectedUserCouponId.value === coupon.user_coupon_id) {
    selectedUserCouponId.value = null;
  } else {
    selectedUserCouponId.value = coupon.user_coupon_id;
  }
  showCouponModal.value = false;
};

const handleSubmitOrder = async () => {
  if (!formData.address_id || !formData.shipping_address.trim()) {
    alert('请选择收货地址');
    return;
  }

  isSubmitting.value = true;
  try {
    const res = await createOrder({
      shipping_address: formData.shipping_address.trim(),
      payment_method: formData.payment_method,
      remark: formData.remark.trim(),
      user_coupon_id: selectedUserCouponId.value
    });

    if (res.data.success) {
      await loadCart();
      successMessage.value = '订单提交成功！正在跳转至订单详情...';
      showSuccessToast.value = true;
      setTimeout(() => {
        router.push(`/orders/${res.data.data.id}`);
      }, 1500);
    } else {
      alert(res.data.message || '订单提交失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '订单提交失败，请稍后重试');
  } finally {
    isSubmitting.value = false;
  }
};

watch([cartItems, selectedUserCouponId], () => {
  fetchDiscountCalc();
}, { deep: true, immediate: false });

watch(() => discountCalculation.value.original_total, () => {
  fetchAvailableCoupons();
});

onMounted(async () => {
  await loadCart();
  await fetchDiscountCalc();
  fetchAvailableCoupons();
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

.item-sku {
  margin: 0 0 4px;
  font-size: 12px;
  color: #888;
  background: #f0f0f0;
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
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

.address-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.address-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.address-item:hover {
  border-color: #667eea;
  background: #f8f9ff;
}

.address-item.active {
  border-color: #667eea;
  background: #f0f4ff;
}

.address-radio {
  width: 20px;
  height: 20px;
  accent-color: #667eea;
  flex-shrink: 0;
}

.address-info {
  flex: 1;
  min-width: 0;
}

.address-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.address-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.address-phone {
  font-size: 14px;
  color: #666;
}

.address-tag {
  padding: 2px 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 12px;
  border-radius: 12px;
}

.address-detail {
  font-size: 14px;
  color: #555;
  line-height: 1.5;
  word-break: break-all;
}

.address-check {
  flex-shrink: 0;
  color: #667eea;
}

.success-toast {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 30px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  color: #27ae60;
  font-size: 16px;
  font-weight: 500;
  z-index: 9999;
  animation: toastIn 0.3s ease-out;
}

@keyframes toastIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

.loading.small,
.empty.small {
  padding: 30px 20px;
}

.spinner.small {
  width: 28px;
  height: 28px;
}

.item-name {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.item-promotion-tag {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5253 100%);
  color: white;
  padding: 2px 8px;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 600;
}

.item-price-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.item-price {
  margin: 0;
  font-size: 14px;
  color: #e74c3c;
  font-weight: 500;
}

.item-promotion-price {
  font-size: 12px;
  color: #27ae60;
  font-weight: 600;
}

.item-subtotal-promotion {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.subtotal-original {
  font-size: 12px;
  color: #aaa;
  text-decoration: line-through;
}

.subtotal-final {
  font-size: 15px;
  font-weight: 600;
  color: #e74c3c;
}

.summary-row.discount {
  color: #e74c3c;
}

.summary-row .discount-value {
  color: #e74c3c;
  font-weight: 600;
}

.summary-row.total-discount {
  padding-top: 8px;
  border-top: 1px dashed #eee;
  color: #e74c3c;
  font-weight: 600;
}

.coupon-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.coupon-name-tag {
  font-size: 11px;
  background: linear-gradient(135deg, #ff9f43 0%, #ee8839 100%);
  color: white;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 500;
}

.coupon-select-row {
  cursor: pointer;
  padding: 8px 0;
  border-top: 1px solid #f5f5f5;
  border-bottom: 1px solid #f5f5f5;
  margin: 8px 0;
}

.coupon-select-row:hover {
  color: #667eea;
}

.coupon-select-value {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #667eea;
  font-weight: 500;
}

.coupon-select-value .arrow {
  font-size: 18px;
  font-weight: bold;
}

.coupon-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.coupon-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 500px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: modalFadeIn 0.2s ease-out;
}

@keyframes modalFadeIn {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.coupon-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.coupon-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.coupon-modal-close {
  background: none;
  border: none;
  font-size: 28px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.coupon-modal-close:hover {
  color: #333;
}

.coupon-modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
}

.coupon-modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
}

.modal-coupons-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-coupon-item {
  display: flex;
  align-items: stretch;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid #e0e0e0;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.modal-coupon-item:hover:not(.coupon-disabled) {
  border-color: #667eea;
}

.modal-coupon-item.coupon-selected {
  border-color: #667eea;
  background: #f8f9ff;
}

.modal-coupon-item.coupon-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.modal-coupon-left {
  background: linear-gradient(135deg, #ff9f43 0%, #ee8839 100%);
  color: white;
  padding: 16px 20px;
  min-width: 110px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.modal-coupon-left.coupon-cant-use {
  background: #bbb;
}

.modal-coupon-value {
  display: flex;
  align-items: baseline;
  margin-bottom: 4px;
}

.modal-coupon-symbol {
  font-size: 14px;
  font-weight: 600;
}

.modal-coupon-amount {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
}

.modal-coupon-condition {
  font-size: 11px;
  opacity: 0.9;
}

.modal-coupon-right {
  flex: 1;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding-right: 40px;
}

.modal-coupon-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.modal-coupon-expire {
  font-size: 12px;
  color: #888;
}

.coupon-cant-use-reason {
  font-size: 12px;
  color: #e74c3c;
}

.coupon-checkmark {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #667eea;
}
</style>
