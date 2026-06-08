<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="show" class="drawer-overlay" @click.self="handleClose">
        <Transition name="drawer-slide">
          <div v-if="show" class="drawer">
            <div class="drawer-header">
              <div class="header-left">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <h2 class="drawer-title">库存预警</h2>
                <span class="alert-badge">{{ alertProducts.length }}</span>
              </div>
              <button class="drawer-close" @click="handleClose">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div class="drawer-body">
              <div v-if="isLoading && alertProducts.length === 0" class="loading">
                <div class="spinner"></div>
                <p>加载中...</p>
              </div>

              <div v-else-if="alertProducts.length === 0" class="empty-alert">
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <p>暂无库存预警商品</p>
                <button class="btn btn-primary btn-sm" @click="handleClose">
                  继续浏览
                </button>
              </div>

              <div v-else class="alert-content">
                <div class="alert-actions-bar">
                  <div class="selected-info">
                    已选 <span class="selected-count">{{ selectedIds.length }}</span> / {{ alertProducts.length }}
                  </div>
                  <div class="action-buttons">
                    <button 
                      class="btn btn-outline btn-xs" 
                      @click="toggleSelectAll"
                    >
                      {{ isAllSelected ? '取消全选' : '全选' }}
                    </button>
                    <button 
                      class="btn btn-primary btn-xs" 
                      :disabled="selectedIds.length === 0 || generatingOrder"
                      @click="handleGenerateRestock"
                    >
                      <span v-if="generatingOrder">生成中...</span>
                      <span v-else>一键生成补货单</span>
                    </button>
                  </div>
                </div>

                <div class="alert-products-list">
                  <div
                    v-for="product in alertProducts"
                    :key="product.id"
                    class="alert-product-item"
                    :class="{ 'severity-high': product.stock < product.alert_threshold * 0.5 }"
                  >
                    <label class="checkbox-wrapper">
                      <input 
                        type="checkbox" 
                        :value="product.id" 
                        v-model="selectedIds"
                      />
                      <span class="checkmark"></span>
                    </label>
                    <img
                      :src="product.image || defaultPlaceholder"
                      :alt="product.name"
                      class="product-image"
                      @error="handleImageError($event)"
                    />
                    <div class="product-info">
                      <div class="product-name-row">
                        <h3 class="product-name">{{ product.name }}</h3>
                        <span class="category-tag">{{ product.category }}</span>
                      </div>
                      <div class="stock-info">
                        <span class="stock-label">当前库存:</span>
                        <span class="stock-value danger">{{ product.stock }}</span>
                        <span class="stock-separator">/</span>
                        <span class="stock-label">阈值:</span>
                        <span class="threshold-value">{{ product.alert_threshold }}</span>
                        <span class="shortage-tag">
                          缺 {{ product.shortage }} 件
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="alertProducts.length > 0" class="drawer-footer">
              <div class="footer-summary">
                <div class="summary-row">
                  <span>共 {{ alertProducts.length }} 种预警商品</span>
                </div>
              </div>
            </div>

            <Transition name="modal-fade">
              <div v-if="showRestockModal" class="restock-modal-overlay" @click.self="showRestockModal = false">
                <div class="restock-modal">
                  <div class="modal-header">
                    <h3>补货建议单</h3>
                    <button class="close-btn" @click="showRestockModal = false">&times;</button>
                  </div>
                  <div v-if="restockOrder" class="modal-body">
                    <div class="order-info">
                      <div class="info-row">
                        <span class="info-label">补货单号:</span>
                        <span class="info-value">{{ restockOrder.order_no }}</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">商品数量:</span>
                        <span class="info-value">{{ restockOrder.total_items }} 种</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">预计总金额:</span>
                        <span class="info-value price-highlight">¥{{ restockOrder.total_amount?.toFixed(2) }}</span>
                      </div>
                    </div>

                    <div class="order-items-title">商品明细</div>
                    <div class="order-items-list">
                      <div v-for="(item, index) in restockOrder.items" :key="item.product_id" class="order-item">
                        <span class="item-index">{{ index + 1 }}</span>
                        <div class="item-info">
                          <span class="item-name">{{ item.product_name }}</span>
                          <span class="item-detail">
                            当前{{ item.current_stock }} / 建议补{{ item.suggested_quantity }}件
                          </span>
                        </div>
                        <span class="item-subtotal">¥{{ item.subtotal.toFixed(2) }}</span>
                      </div>
                    </div>

                    <div class="modal-footer">
                      <button class="btn btn-outline" @click="showRestockModal = false">
                        关闭
                      </button>
                      <button 
                        class="btn btn-outline" 
                        :disabled="emailSending"
                        @click="handleSendEmail"
                      >
                        <span v-if="emailSending">发送中...</span>
                        <span v-else>📧 发送邮件</span>
                      </button>
                      <button 
                        class="btn btn-primary" 
                        :disabled="exporting"
                        @click="handleExport"
                      >
                        <span v-if="exporting">导出中...</span>
                        <span v-else>📥 导出Excel</span>
                      </button>
                    </div>
                  </div>

                  <div v-else class="modal-body loading-body">
                    <div class="spinner"></div>
                    <p>正在生成补货建议单...</p>
                  </div>
                </div>
              </div>
            </Transition>

            <div v-if="toast.show" class="toast" :class="toast.type">
              {{ toast.message }}
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useStockAlert } from '../composables/useStockAlert.js';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close']);

const {
  alertProducts,
  isLoading,
  closeAlertDrawer,
  generateRestockOrder,
  exportOrder,
  sendOrderEmail,
  fetchAlertProducts
} = useStockAlert();

const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

const selectedIds = ref([]);
const showRestockModal = ref(false);
const restockOrder = ref(null);
const generatingOrder = ref(false);
const exporting = ref(false);
const emailSending = ref(false);

const toast = ref({
  show: false,
  message: '',
  type: 'success'
});

const isAllSelected = computed(() => {
  return alertProducts.value.length > 0 && 
         selectedIds.value.length === alertProducts.value.length;
});

watch(() => props.show, (newVal) => {
  if (newVal) {
    selectedIds.value = alertProducts.value.map(p => p.id);
  }
});

watch(alertProducts, (newVal) => {
  if (props.show && selectedIds.value.length === 0) {
    selectedIds.value = newVal.map(p => p.id);
  }
});

const handleClose = () => {
  closeAlertDrawer();
  emit('close');
};

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = alertProducts.value.map(p => p.id);
  }
};

const showToast = (message, type = 'success') => {
  toast.value.message = message;
  toast.value.type = type;
  toast.value.show = true;
  setTimeout(() => {
    toast.value.show = false;
  }, 3000);
};

const handleGenerateRestock = async () => {
  if (selectedIds.value.length === 0) {
    showToast('请至少选择一个商品', 'error');
    return;
  }

  generatingOrder.value = true;
  showRestockModal.value = true;
  restockOrder.value = null;

  try {
    const result = await generateRestockOrder(selectedIds.value);
    if (result.success) {
      restockOrder.value = result.data;
      showToast(result.message || '补货建议单生成成功', 'success');
    } else {
      showToast(result.message || '生成失败', 'error');
      showRestockModal.value = false;
    }
  } catch (err) {
    console.error(err);
    showToast('生成补货建议单失败', 'error');
    showRestockModal.value = false;
  } finally {
    generatingOrder.value = false;
  }
};

const handleExport = async () => {
  if (!restockOrder.value) return;
  exporting.value = true;
  try {
    const result = await exportOrder(restockOrder.value.id);
    if (result.success) {
      showToast('导出成功', 'success');
    } else {
      showToast(result.message || '导出失败', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('导出失败', 'error');
  } finally {
    exporting.value = false;
  }
};

const handleSendEmail = async () => {
  if (!restockOrder.value) return;
  emailSending.value = true;
  try {
    const result = await sendOrderEmail(restockOrder.value.id);
    showToast(result.message || (result.success ? '发送成功' : '发送失败'), 
              result.success ? 'success' : 'error');
  } catch (err) {
    console.error(err);
    showToast('发送邮件失败', 'error');
  } finally {
    emailSending.value = false;
  }
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
  max-width: 480px;
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
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
  color: white;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.alert-badge {
  background: rgba(255, 255, 255, 0.25);
  color: white;
  font-size: 13px;
  font-weight: 600;
  min-width: 28px;
  height: 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
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
}

.loading,
.empty-alert {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 24px;
  color: #999;
}

.empty-alert svg {
  color: #27ae60;
  margin-bottom: 16px;
}

.empty-alert p {
  margin-bottom: 20px;
  font-size: 15px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #f0f0f0;
  border-top-color: #e74c3c;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.alert-content {
  padding: 0;
}

.alert-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #fff8f8;
  border-bottom: 1px solid #ffe0e0;
  position: sticky;
  top: 0;
  z-index: 10;
}

.selected-info {
  font-size: 13px;
  color: #666;
}

.selected-count {
  color: #e74c3c;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.alert-products-list {
  padding: 12px 16px;
}

.alert-product-item {
  display: flex;
  gap: 12px;
  padding: 14px;
  background: #fafafa;
  border-radius: 12px;
  margin-bottom: 10px;
  transition: all 0.2s;
  border: 1px solid transparent;
  align-items: center;
}

.alert-product-item:hover {
  background: #fff5f5;
  border-color: #ffd0d0;
}

.alert-product-item.severity-high {
  background: #fff0f0;
  border: 1px solid #ffbbbb;
}

.checkbox-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
  flex-shrink: 0;
}

.checkbox-wrapper input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  height: 20px;
  width: 20px;
  background-color: white;
  border: 2px solid #ccc;
  border-radius: 4px;
  transition: all 0.2s;
}

.checkbox-wrapper:hover input ~ .checkmark {
  border-color: #e74c3c;
}

.checkbox-wrapper input:checked ~ .checkmark {
  background-color: #e74c3c;
  border-color: #e74c3c;
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-wrapper input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-wrapper .checkmark:after {
  left: 7px;
  top: 3px;
  width: 5px;
  height: 10px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.product-image {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 8px;
  background: #f0f0f0;
  flex-shrink: 0;
}

.product-info {
  flex: 1;
  min-width: 0;
}

.product-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.product-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.category-tag {
  background: #f0f0f0;
  color: #666;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  flex-shrink: 0;
}

.stock-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  font-size: 12px;
}

.stock-label {
  color: #888;
}

.stock-value {
  font-weight: 600;
}

.stock-value.danger {
  color: #e74c3c;
  font-size: 14px;
}

.threshold-value {
  color: #666;
  font-weight: 500;
}

.stock-separator {
  color: #ccc;
  margin: 0 2px;
}

.shortage-tag {
  background: #e74c3c;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  margin-left: 4px;
}

.drawer-footer {
  border-top: 1px solid #eee;
  padding: 16px 24px;
  background: white;
}

.footer-summary {
  margin-bottom: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  font-size: 13px;
  color: #666;
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
  padding: 6px 12px;
  font-size: 12px;
}

.btn-primary {
  background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
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

.restock-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 3000;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.restock-modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  color: white;
  font-size: 28px;
  cursor: pointer;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}

.loading-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #999;
}

.order-info {
  background: #f8f9ff;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 20px;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
}

.info-label {
  color: #666;
  font-size: 14px;
}

.info-value {
  color: #333;
  font-weight: 500;
  font-size: 14px;
}

.info-value.price-highlight {
  color: #e74c3c;
  font-size: 20px;
  font-weight: 700;
}

.order-items-title {
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
  font-size: 15px;
}

.order-items-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 10px;
}

.order-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid #f0f0f0;
}

.order-item:last-child {
  border-bottom: none;
}

.item-index {
  width: 24px;
  height: 24px;
  background: #667eea;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.item-detail {
  display: block;
  font-size: 12px;
  color: #888;
}

.item-subtotal {
  font-weight: 600;
  color: #e74c3c;
  font-size: 14px;
  flex-shrink: 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #eee;
}

.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  padding: 14px 24px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  z-index: 4000;
  animation: slideIn 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.toast.success {
  background: #27ae60;
}

.toast.error {
  background: #e74c3c;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
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

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

@media (max-width: 480px) {
  .drawer {
    max-width: 100%;
  }
}
</style>
