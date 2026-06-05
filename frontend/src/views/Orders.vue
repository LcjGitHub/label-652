<template>
  <div class="orders-page container">
    <div class="page-header">
      <h1 class="page-title">我的订单</h1>
      <router-link to="/" class="back-link">
        ← 返回首页
      </router-link>
    </div>

    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-btn"
        :class="{ active: activeTab === tab.value }"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <div v-if="isLoading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="orders.length === 0" class="empty">
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <path d="M16 10a4 4 0 0 1-8 0"></path>
      </svg>
      <p>暂无订单</p>
      <router-link to="/" class="btn btn-primary">
        去购物
      </router-link>
    </div>

    <div v-else class="orders-list">
      <div
        v-for="order in orders"
        :key="order.id"
        class="order-card"
      >
        <div class="order-header">
          <div class="order-info">
          <span class="order-no">订单号：{{ order.order_no }}</span>
          <span class="order-date">{{ formatDate(order.created_at) }}</span>
        </div>
        <div class="order-status" :class="order.status">
          {{ getStatusText(order.status) }}
        </div>
        </div>

        <div class="order-items">
          <div
            v-for="item in order.items.slice(0, 2)"
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
              <p class="item-price">¥{{ item.product_price.toFixed(2) }} x {{ item.quantity }}</p>
            </div>
            <div class="item-subtotal">¥{{ item.subtotal.toFixed(2) }}</div>
          </div>
          <div v-if="order.items.length > 2" class="more-items">
            等 {{ order.items.length }} 件商品
          </div>
        </div>

        <div class="order-footer">
          <div class="order-total">
            <span class="label">共 {{ order.items.reduce((sum, item) => sum + item.quantity, 0) }} 件商品，合计：</span>
            <span class="price">¥{{ order.total_amount.toFixed(2) }}</span>
          </div>
          <div class="order-actions">
            <router-link
              :to="`/orders/${order.id}`"
              class="btn btn-outline btn-sm"
            >
              查看详情
            </router-link>
            <button
              v-if="order.status === 'pending'"
              class="btn btn-danger btn-sm"
              :disabled="cancellingId === order.id"
              @click="handleCancelOrder(order.id)"
            >
              {{ cancellingId === order.id ? '取消中...' : '取消订单' }}
            </button>
            <button
              v-if="order.status === 'pending'"
              class="btn btn-primary btn-sm"
              :disabled="payingId === order.id"
              @click="handlePay(order)"
            >
              {{ payingId === order.id ? '支付中...' : '立即支付' }}
            </button>
            <button
              v-if="order.status === 'paid'"
              class="btn btn-danger btn-sm"
              :disabled="cancellingId === order.id"
              @click="handleCancelOrder(order.id)"
            >
              {{ cancellingId === order.id ? '取消中...' : '取消订单' }}
            </button>
            <button
              v-if="order.status === 'paid'"
              class="btn btn-primary btn-sm"
              :disabled="shippingId === order.id"
              @click="handleShip(order)"
            >
              {{ shippingId === order.id ? '发货中...' : '发货' }}
            </button>
            <button
              v-if="order.status === 'shipped'"
              class="btn btn-primary btn-sm"
              :disabled="completingId === order.id"
              @click="handleConfirmReceive(order)"
            >
              {{ completingId === order.id ? '确认中...' : '确认收货' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="total > pageSize" class="pagination">
      <button
        class="page-btn"
        :disabled="page === 1"
        @click="changePage(page - 1)"
      >
        上一页
      </button>
      <span class="page-info">第 {{ page }} / {{ totalPages }} 页</span>
      <button
        class="page-btn"
        :disabled="page >= totalPages"
        @click="changePage(page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getOrders, cancelOrder, updateOrderStatus } from '../api/orders.js';

const route = useRoute();

const orders = ref([]);
const isLoading = ref(false);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);
const cancellingId = ref(null);
const payingId = ref(null);
const shippingId = ref(null);
const completingId = ref(null);
const activeTab = ref('all');

const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

const tabs = [
  { value: 'all', label: '全部订单' },
  { value: 'pending', label: '待付款' },
  { value: 'paid', label: '待发货' },
  { value: 'shipped', label: '待收货' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
];

const totalPages = computed(() => Math.ceil(total.value / pageSize.value));

const getStatusText = (status) => {
  const statusMap = {
    pending: '待付款',
    paid: '已付款',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消'
  };
  return statusMap[status] || status;
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

const loadOrders = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value
    };
    if (activeTab.value !== 'all') {
      params.status = activeTab.value;
    }

    const res = await getOrders(params);
    if (res.data.success) {
      orders.value = res.data.data.orders;
      total.value = res.data.data.total;
    }
  } catch (err) {
    console.error('加载订单失败:', err);
  } finally {
    isLoading.value = false;
  }
};

const changePage = (newPage) => {
  page.value = newPage;
  loadOrders();
};

const handleCancelOrder = async (orderId) => {
  if (!confirm('确定要取消这个订单吗？')) return;

  cancellingId.value = orderId;
  try {
    const res = await cancelOrder(orderId);
    if (res.data.success) {
      alert('订单已取消');
      loadOrders();
    } else {
      alert(res.data.message || '取消失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '取消失败');
  } finally {
    cancellingId.value = null;
  }
};

const handlePay = async (order) => {
  if (!confirm(`确定要支付订单 ¥${order.total_amount.toFixed(2)} 吗？`)) return;

  payingId.value = order.id;
  try {
    const res = await updateOrderStatus(order.id, 'paid');
    if (res.data.success) {
      alert('支付成功！');
      loadOrders();
    } else {
      alert(res.data.message || '支付失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '支付失败');
  } finally {
    payingId.value = null;
  }
};

const handleShip = async (order) => {
  if (!confirm('确定要发货吗？')) return;

  shippingId.value = order.id;
  try {
    const res = await updateOrderStatus(order.id, 'shipped');
    if (res.data.success) {
      alert('发货成功！');
      loadOrders();
    } else {
      alert(res.data.message || '发货失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '发货失败');
  } finally {
    shippingId.value = null;
  }
};

const handleConfirmReceive = async (order) => {
  if (!confirm('确定要确认收货吗？')) return;

  completingId.value = order.id;
  try {
    const res = await updateOrderStatus(order.id, 'completed');
    if (res.data.success) {
      alert('确认收货成功！');
      loadOrders();
    } else {
      alert(res.data.message || '确认收货失败');
    }
  } catch (err) {
    alert(err.response?.data?.message || '确认收货失败');
  } finally {
    completingId.value = null;
  }
};

watch(activeTab, () => {
  page.value = 1;
  loadOrders();
});

onMounted(() => {
  const status = route.query.status;
  if (status && tabs.some(t => t.value === status)) {
    activeTab.value = status;
  }
  loadOrders();
});
</script>

<style scoped>
.orders-page {
  max-width: 1000px;
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

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.tab-btn {
  padding: 10px 20px;
  border: 1px solid #e0e0e0;
  background: white;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  white-space: nowrap;
  transition: all 0.2s;
}

.tab-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.tab-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
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

.empty svg {
  color: #ddd;
  margin-bottom: 16px;
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
  to { transform: rotate(360deg);
}

.orders-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.order-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f9fafb;
  border-bottom: 1px solid #f0f0f0;
}

.order-info {
  display: flex;
  gap: 16px;
  align-items: center;
}

.order-no {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.order-date {
  font-size: 13px;
  color: #999;
}

.order-status {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.order-status.pending {
  background: #fff3cd;
  color: #f39c12;
}

.order-status.paid {
  background: #d4edda;
  color: #27ae60;
}

.order-status.shipped {
  background: #d1ecf1;
  color: #3498db;
}

.order-status.completed {
  background: #e8f5e9;
  color: #27ae60;
}

.order-status.cancelled {
  background: #f8d7da;
  color: #e74c3c;
}

.order-items {
  padding: 16px 20px;
}

.order-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  align-items: center;
  border-bottom: 1px solid #f5f5f5;
}

.order-item:last-child {
  border-bottom: none;
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
  margin: 0;
  font-size: 13px;
  color: #999;
}

.item-subtotal {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.more-items {
  padding: 8px 0 0;
  font-size: 13px;
  color: #999;
  text-align: center;
}

.order-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #fafafa;
  border-top: 1px solid #f0f0f0;
}

.order-total {
  font-size: 14px;
  color: #666;
}

.order-total .price {
  font-size: 20px;
  font-weight: 700;
  color: #e74c3c;
}

.order-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-sm {
  padding: 6px 16px;
  font-size: 13px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
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

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: #c0392b;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 30px;
}

.page-btn {
  padding: 8px 20px;
  border: 1px solid #e0e0e0;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: #999;
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

  .order-header,
  .order-footer {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .order-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
