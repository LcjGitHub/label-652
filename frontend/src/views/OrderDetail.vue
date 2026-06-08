<template>
  <div class="order-detail-page container">
    <div class="page-header">
      <h1 class="page-title">订单详情</h1>
      <router-link to="/orders" class="back-link">
        ← 返回订单列表
      </router-link>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="!order" class="empty">
      <p>订单不存在</p>
      <router-link to="/orders" class="btn btn-primary">
        返回订单列表
      </router-link>
    </div>

    <div v-else class="order-detail">
      <div class="order-status-card" :class="order.status">
        <div class="status-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path v-if="order.status === 'pending'" d="M12 6v6l4 2"></path>
            <circle v-if="order.status === 'pending'" cx="12" cy="12" r="10"></circle>
            <circle v-if="order.status === 'paid'" cx="12" cy="12" r="10"></circle>
            <polyline v-if="order.status === 'paid'" points="9 12 11 14 15 10"></polyline>
            <path v-if="order.status === 'shipped'" d="M1 3h15v13H1z"></path>
            <path v-if="order.status === 'shipped'" d="M16 8h4l3 3v5h-7V8z"></path>
            <circle v-if="order.status === 'shipped'" cx="5.5" cy="18.5" r="2.5"></circle>
            <circle v-if="order.status === 'shipped'" cx="18.5" cy="18.5" r="2.5"></circle>
            <circle v-if="order.status === 'completed'" cx="12" cy="12" r="10"></circle>
            <polyline v-if="order.status === 'completed'" points="9 12 11 14 15 10"></polyline>
            <circle v-if="order.status === 'cancelled'" cx="12" cy="12" r="10"></circle>
            <line v-if="order.status === 'cancelled'" x1="15" y1="9" x2="9" y2="15"></line>
            <line v-if="order.status === 'cancelled'" x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div class="status-info">
          <h2 class="status-text">{{ getStatusText(order.status) }}</h2>
          <p class="status-desc">{{ getStatusDesc(order.status) }}</p>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">订单信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">订单编号</span>
            <span class="info-value">{{ order.order_no }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">下单时间</span>
            <span class="info-value">{{ formatDate(order.created_at) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">支付方式</span>
            <span class="info-value">{{ getPaymentMethodText(order.payment_method) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">订单状态</span>
            <span class="info-value">{{ getStatusText(order.status) }}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">收货信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">收货地址</span>
            <span class="info-value">{{ order.shipping_address }}</span>
          </div>
          <div v-if="order.remark" class="info-item">
            <span class="info-label">订单备注</span>
            <span class="info-value">{{ order.remark }}</span>
          </div>
        </div>
      </div>

      <div class="detail-section">
        <h3 class="section-title">商品清单</h3>
        <div class="order-items">
          <div
            v-for="item in order.items"
            :key="item.id"
            class="order-item"
          >
            <img
              :src="item.product_image || defaultPlaceholder"
              :alt="item.product_name"
              class="item-image"
              @error="handleImageError($event)"
            />
            <div class="item-info">
              <h3 class="item-name">{{ item.product_name }}</h3>
              <p v-if="item.sku_name" class="item-sku">{{ item.sku_name }}</p>
              <p class="item-price">¥{{ item.product_price.toFixed(2) }}</p>
            </div>
            <div class="item-quantity">x {{ item.quantity }}</div>
            <div class="item-subtotal">¥{{ item.subtotal.toFixed(2) }}</div>
          </div>
        </div>
      </div>

      <div class="detail-section price-summary">
        <div class="summary-row">
          <span>商品总价</span>
          <span>¥{{ order.total_amount.toFixed(2) }}</span>
        </div>
        <div class="summary-row">
          <span>运费</span>
          <span class="free">免运费</span>
        </div>
        <div class="summary-row total">
          <span>应付金额</span>
          <span class="total-price">¥{{ order.total_amount.toFixed(2) }}</span>
        </div>
      </div>

      <div class="order-actions">
        <button
          v-if="order.status === 'pending'"
          class="btn btn-primary"
          @click="handlePay"
        >
          立即支付 ¥{{ order.total_amount.toFixed(2) }}
        </button>
        <button
          v-if="order.status === 'pending' || order.status === 'paid'"
          class="btn btn-outline"
          :disabled="isCancelling"
          @click="handleCancel"
        >
          {{ isCancelling ? '取消中...' : '取消订单' }}
        </button>
        <button
          v-if="order.status === 'shipped'"
          class="btn btn-primary"
          :disabled="isUpdatingStatus === 'complete'"
          @click="handleConfirmReceive"
        >
          {{ isUpdatingStatus === 'complete' ? '确认中...' : '确认收货' }}
        </button>
        <router-link
          v-if="order.status === 'completed'"
          to="/"
          class="btn btn-primary"
        >
          再次购买
        </router-link>
        <router-link
          to="/"
          class="btn btn-outline"
        >
          继续购物
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { getOrder, cancelOrder, updateOrderStatus } from '../api/orders.js';

const route = useRoute();

const order = ref(null);
const isLoading = ref(true);
const isCancelling = ref(false);
const isUpdatingStatus = ref(null);

const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

const getStatusText = (status) => {
  const statusMap = {
    pending: '待支付',
    paid: '待发货',
    shipped: '待收货',
    completed: '已完成',
    cancelled: '已取消'
  };
  return statusMap[status] || status;
};

const getStatusDesc = (status) => {
  const descMap = {
    pending: '请尽快完成支付，支付成功后系统将自动发货',
    paid: '支付成功！系统正在自动为您处理发货，请稍候...',
    shipped: '商品已发出，请注意查收，确认收货后完成交易',
    completed: '感谢您的购买，欢迎再次光临',
    cancelled: '订单已取消，库存已退回，如有疑问请联系客服'
  };
  return descMap[status] || '';
};

const getPaymentMethodText = (method) => {
  const methodMap = {
    cod: '货到付款',
    wechat: '微信支付',
    alipay: '支付宝'
  };
  return methodMap[method] || method;
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

const loadOrder = async () => {
  isLoading.value = true;
  try {
    const res = await getOrder(route.params.id);
    if (res.data.success) {
      order.value = res.data.data;
    } else {
      order.value = null;
    }
  } catch (err) {
    console.error('加载订单失败:', err);
    order.value = null;
  } finally {
    isLoading.value = false;
  }
};

const handlePay = async () => {
  if (!confirm(`确定要支付订单 ¥${order.value.total_amount.toFixed(2)} 吗？`)) return;

  try {
    const res = await updateOrderStatus(order.value.id, 'paid');
    if (res.data.success) {
      alert('支付成功！系统将自动为您发货，请耐心等待。');
      loadOrder();
    } else {
      alert(res.data.message || '支付失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '支付失败');
  }
};

const handleConfirmReceive = async () => {
  if (!confirm('确定要确认收货吗？')) return;

  isUpdatingStatus.value = 'complete';
  try {
    const res = await updateOrderStatus(order.value.id, 'completed');
    if (res.data.success) {
      alert('确认收货成功！');
      loadOrder();
    } else {
      alert(res.data.message || '确认收货失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '确认收货失败');
  } finally {
    isUpdatingStatus.value = null;
  }
};

const handleCancel = async () => {
  if (!confirm('确定要取消这个订单吗？')) return;

  isCancelling.value = true;
  try {
    const res = await cancelOrder(order.value.id);
    if (res.data.success) {
      alert('订单已取消');
      loadOrder();
    } else {
      alert(res.data.message || '取消失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '取消失败');
  } finally {
    isCancelling.value = false;
  }
};

onMounted(() => {
  loadOrder();
});
</script>

<style scoped>
.order-detail-page {
  max-width: 900px;
  padding: 30px 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.page-title {
  margin: 0;
  font-size: 26px;
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
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #999;
}

.empty p {
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

.order-status-card {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 30px;
  border-radius: 12px;
  margin-bottom: 24px;
  color: white;
}

.order-status-card.pending {
  background: linear-gradient(135deg, #f6d365 0%, #fda085 100%);
}

.order-status-card.paid {
  background: linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%);
}

.order-status-card.shipped {
  background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%);
}

.order-status-card.completed {
  background: linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%);
}

.order-status-card.cancelled {
  background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
  color: #666;
}

.status-icon {
  flex-shrink: 0;
}

.status-text {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
}

.status-desc {
  margin: 8px 0 0;
  font-size: 14px;
  opacity: 0.9;
}

.detail-section {
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

.info-grid {
  display: grid;
  gap: 16px;
}

.info-item {
  display: flex;
  gap: 16px;
}

.info-label {
  flex-shrink: 0;
  width: 100px;
  font-size: 14px;
  color: #999;
}

.info-value {
  flex: 1;
  font-size: 14px;
  color: #333;
  word-break: break-all;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  align-items: center;
}

.item-image {
  width: 80px;
  height: 80px;
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
  margin: 0 0 8px;
  font-size: 15px;
  font-weight: 500;
  color: #333;
}

.item-sku {
  margin: 0 0 8px;
  font-size: 12px;
  color: #888;
  background: #e8e8e8;
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
}

.item-price {
  margin: 0;
  font-size: 14px;
  color: #e74c3c;
  font-weight: 500;
}

.item-quantity {
  font-size: 14px;
  color: #999;
  padding: 0 16px;
}

.item-subtotal {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.price-summary {
  background: #f9fafb;
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
  border-top: 1px dashed #ddd;
  font-size: 16px;
  color: #333;
}

.summary-row .free {
  color: #27ae60;
}

.summary-row .total-price {
  font-size: 28px;
  font-weight: 700;
  color: #e74c3c;
}

.order-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 30px;
  flex-wrap: wrap;
}

.btn {
  padding: 12px 28px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
  border-color: #667eea;
  color: #667eea;
}

.btn-outline:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

  .order-status-card {
    flex-direction: column;
    text-align: center;
    gap: 16px;
  }

  .info-item {
    flex-direction: column;
    gap: 4px;
  }

  .info-label {
    width: auto;
  }

  .order-item {
    flex-wrap: wrap;
  }

  .item-quantity {
    padding: 0;
    margin-left: auto;
  }

  .order-actions {
    flex-direction: column;
  }

  .btn {
    width: 100%;
  }
}
</style>
