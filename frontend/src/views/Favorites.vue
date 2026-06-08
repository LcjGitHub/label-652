<template>
  <div class="favorites-page">
    <div class="page-header">
      <h2 class="page-title">我的收藏</h2>
      <div class="page-actions">
        <template v-if="favorites.length > 0">
          <button
            class="btn btn-outline btn-sm"
            @click="toggleSelectAll"
          >
            {{ isAllSelected ? '取消全选' : '全选' }}
          </button>
          <button
            v-if="selectedIds.size > 0"
            class="btn btn-danger btn-sm"
            :disabled="isLoading"
            @click="handleBatchRemove"
          >
            {{ isLoading ? '处理中...' : `取消收藏 (${selectedIds.size})` }}
          </button>
        </template>
      </div>
    </div>

    <div v-if="isLoading && favorites.length === 0" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="favorites.length === 0" class="empty">
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
      <p>您还没有收藏任何商品</p>
      <router-link to="/" class="btn btn-primary">去逛逛</router-link>
    </div>

    <div v-else class="favorites-grid">
      <div
        v-for="item in favorites"
        :key="item.id"
        class="favorite-card"
        :class="{ selected: selectedIds.has(item.id) }"
      >
        <div class="select-checkbox" @click.stop="toggleSelect(item.id)">
          <input type="checkbox" :checked="selectedIds.has(item.id)" @change="toggleSelect(item.id)" />
        </div>
        <div class="favorite-image" @click="goToDetail(item.id)">
          <img
            :src="item.image || defaultPlaceholder"
            :alt="item.name"
            @error="handleImageError($event)"
          />
          <span class="category-tag">{{ item.category }}</span>
        </div>
        <div class="favorite-info">
          <h3 class="favorite-name" @click="goToDetail(item.id)">{{ item.name }}</h3>
          <p class="favorite-desc">{{ item.description }}</p>
          <div class="favorite-price-row">
            <template v-if="item.has_multi_spec && getCurrentCardSku(item)">
              <span class="favorite-price">¥{{ getCurrentCardSku(item).price.toFixed(2) }}</span>
            </template>
            <template v-else-if="item.has_multi_spec && item.min_price !== undefined && item.max_price !== undefined && item.min_price !== item.max_price">
              <span class="favorite-price">¥{{ item.min_price.toFixed(2) }} - ¥{{ item.max_price.toFixed(2) }}</span>
            </template>
            <template v-else>
              <span class="favorite-price">¥{{ item.price.toFixed(2) }}</span>
            </template>
            <span class="favorite-date" v-if="item.favorited_at">
              收藏于 {{ formatDate(item.favorited_at) }}
            </span>
          </div>

          <div v-if="item.has_multi_spec && item.specs && item.specs.length > 0" class="card-spec-selector" @click.stop>
            <div v-for="spec in item.specs" :key="spec.id" class="card-spec-group">
              <span class="card-spec-label">{{ spec.name }}:</span>
              <div class="card-spec-value-options">
                <button
                  v-for="val in spec.values"
                  :key="val.id"
                  type="button"
                  class="card-spec-value-btn"
                  :class="{ active: getCardSelectedSpecs(item.id)[spec.name] === val.value }"
                  @click="selectCardSpecValue(item.id, spec.name, val.value)"
                >
                  {{ val.value }}
                </button>
              </div>
            </div>
            <div v-if="getCurrentCardSku(item)" class="card-selected-sku-info">
              <span class="card-sku-text">已选: {{ getCurrentCardSku(item).spec_text }}</span>
            </div>
            <div v-else class="card-selected-sku-info card-select-prompt">
              <span class="card-sku-text">请选择规格</span>
            </div>
          </div>

          <div class="favorite-actions">
            <button
              class="btn btn-sm btn-danger favorite-remove-btn"
              :disabled="isLoading"
              @click.stop="handleRemove(item.id)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
              取消收藏
            </button>
            <button
              class="btn btn-sm btn-primary"
              :disabled="getCardDisplayStock(item) === 0 || addingCartId === item.id"
              @click.stop="quickAddToCart(item)"
            >
              <span v-if="addingCartId === item.id">添加中...</span>
              <span v-else-if="item.has_multi_spec && !getCurrentCardSku(item)">选规格</span>
              <span v-else>加入购物车</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="favoritesPagination.pages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="favoritesPagination.page <= 1"
        @click="changeFavoritesPage(favoritesPagination.page - 1)"
      >
        上一页
      </button>
      <span class="page-info">
        第 {{ favoritesPagination.page }} 页 / 共 {{ favoritesPagination.pages }} 页
      </span>
      <button
        class="page-btn"
        :disabled="favoritesPagination.page >= favoritesPagination.pages"
        @click="changeFavoritesPage(favoritesPagination.page + 1)"
      >
        下一页
      </button>
    </div>

    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>

    <div v-if="confirmDialog.show" class="modal-overlay" @click.self="handleConfirm(false)">
      <div class="modal confirm-modal">
        <div class="modal-header">
          <h3>{{ confirmDialog.title }}</h3>
        </div>
        <div class="modal-body confirm-body">
          <p>{{ confirmDialog.message }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-outline" @click="handleConfirm(false)">
            {{ confirmDialog.cancelText || '取消' }}
          </button>
          <button class="btn btn-primary" @click="handleConfirm(true)">
            {{ confirmDialog.confirmText || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useFavorites } from '../composables/useFavorites.js';
import { useCart } from '../composables/useCart.js';

const router = useRouter();
const {
  favorites,
  favoritesPagination,
  isLoading,
  doRemoveFavorite,
  doBatchRemoveFavorites,
  fetchFavorites,
  changeFavoritesPage
} = useFavorites();
const { handleAddToCart: cartAddToCart } = useCart();

const selectedIds = ref(new Set());
const addingCartId = ref(null);
const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

const cardSelectedSpecs = reactive({});

const getCardSelectedSpecs = (productId) => {
  if (!cardSelectedSpecs[productId]) {
    cardSelectedSpecs[productId] = {};
  }
  return cardSelectedSpecs[productId];
};

const selectCardSpecValue = (productId, specName, value) => {
  const specs = getCardSelectedSpecs(productId);
  specs[specName] = value;
};

const getCurrentCardSku = (product) => {
  if (!product || !product.has_multi_spec || !product.skus) return null;
  const selected = getCardSelectedSpecs(product.id);
  const selectedKeys = Object.keys(selected);
  if (selectedKeys.length === 0) return null;

  const specNames = product.specs ? product.specs.map(s => s.name) : [];
  const allSelected = specNames.every(name => selected[name]);
  if (!allSelected) return null;

  return product.skus.find(sku => {
    if (!sku.specs) {
      if (!sku.spec_text) return false;
      const parsed = {};
      for (const part of sku.spec_text.split(/[;\/]/)) {
        const [k, v] = part.split(':');
        if (k && v) parsed[k.trim()] = v.trim();
      }
      sku.specs = parsed;
    }
    for (const specName of specNames) {
      if (sku.specs[specName] !== selected[specName]) return false;
    }
    return true;
  }) || null;
};

const getCardDisplayStock = (product) => {
  if (!product) return 0;
  if (product.has_multi_spec) {
    const sku = getCurrentCardSku(product);
    if (sku) return sku.stock;
    return product.total_stock != null ? product.total_stock : product.stock;
  }
  return product.stock;
};

const toast = reactive({
  show: false,
  message: '',
  type: 'success'
});

const confirmDialog = reactive({
  show: false,
  title: '',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  onConfirm: null
});

const isAllSelected = computed(() => {
  return favorites.value.length > 0 && selectedIds.value.size === favorites.value.length;
});

const showToast = (message, type = 'success') => {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
};

const showConfirm = (title, message, options = {}) => {
  return new Promise((resolve) => {
    confirmDialog.title = title;
    confirmDialog.message = message;
    confirmDialog.confirmText = options.confirmText || '确定';
    confirmDialog.cancelText = options.cancelText || '取消';
    confirmDialog.onConfirm = resolve;
    confirmDialog.show = true;
  });
};

const handleConfirm = (result) => {
  confirmDialog.show = false;
  if (confirmDialog.onConfirm) {
    confirmDialog.onConfirm(result);
    confirmDialog.onConfirm = null;
  }
};

const toggleSelect = (id) => {
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  selectedIds.value = new Set(selectedIds.value);
};

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = new Set();
  } else {
    selectedIds.value = new Set(favorites.value.map(f => f.id));
  }
};

const handleRemove = async (productId) => {
  const confirmed = await showConfirm(
    '取消收藏',
    '确定要取消收藏这个商品吗？',
    { confirmText: '取消收藏', cancelText: '继续收藏' }
  );
  if (!confirmed) return;

  const result = await doRemoveFavorite(productId);
  showToast(result.message, result.success ? 'success' : 'error');
  if (result.success) {
    selectedIds.value.delete(productId);
    selectedIds.value = new Set(selectedIds.value);
    if (favorites.value.length === 0 && favoritesPagination.value.page > 1) {
      favoritesPagination.value.page = Math.max(1, favoritesPagination.value.page - 1);
      fetchFavorites();
    }
  }
};

const handleBatchRemove = async () => {
  const count = selectedIds.value.size;
  if (count === 0) return;

  const confirmed = await showConfirm(
    '批量取消收藏',
    `确定要取消收藏选中的 ${count} 个商品吗？`,
    { confirmText: '全部取消', cancelText: '再想想' }
  );
  if (!confirmed) return;

  const ids = Array.from(selectedIds.value);
  const result = await doBatchRemoveFavorites(ids);
  showToast(result.message, result.success ? 'success' : 'error');
  if (result.success) {
    selectedIds.value = new Set();
    if (favorites.value.length === 0 && favoritesPagination.value.page > 1) {
      favoritesPagination.value.page = Math.max(1, favoritesPagination.value.page - 1);
      fetchFavorites();
    }
  }
};

const quickAddToCart = async (product) => {
  if (product.has_multi_spec) {
    const sku = getCurrentCardSku(product);
    if (!sku) {
      showToast('请先选择商品规格，或前往详情页选择', 'error');
      setTimeout(() => {
        router.push(`/product/${product.id}`);
      }, 1000);
      return;
    }
    addingCartId.value = product.id;
    try {
      const result = await cartAddToCart(product.id, 1, sku.id);
      showToast(result.message, result.success ? 'success' : 'error');
    } finally {
      addingCartId.value = null;
    }
  } else {
    addingCartId.value = product.id;
    try {
      const result = await cartAddToCart(product.id, 1);
      showToast(result.message, result.success ? 'success' : 'error');
    } finally {
      addingCartId.value = null;
    }
  }
};

const goToDetail = (id) => {
  router.push(`/product/${id}`);
};

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

onMounted(() => {
  fetchFavorites();
});
</script>

<style scoped>
.favorites-page {
  padding-top: 30px;
  padding-bottom: 30px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  background: white;
  padding: 20px 24px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.page-title {
  margin: 0;
  font-size: 22px;
  color: #333;
  font-weight: 600;
}

.page-actions {
  display: flex;
  gap: 12px;
}

.loading,
.empty {
  text-align: center;
  padding: 80px 20px;
  color: #999;
  background: white;
  border-radius: 12px;
}

.empty p {
  margin: 20px 0;
  font-size: 16px;
}

.empty .btn {
  margin-top: 10px;
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

.favorites-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.favorite-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: all 0.2s;
  border: 2px solid transparent;
  position: relative;
}

.favorite-card.selected {
  border-color: #667eea;
}

.favorite-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.select-checkbox {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  background: rgba(255, 255, 255, 0.95);
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.select-checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: #667eea;
}

.favorite-image {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: #f5f5f5;
  cursor: pointer;
}

.favorite-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.category-tag {
  position: absolute;
  top: 12px;
  left: 12px;
  background: rgba(102, 126, 234, 0.95);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.favorite-info {
  padding: 16px;
}

.favorite-name {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.favorite-name:hover {
  color: #667eea;
}

.favorite-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #888;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 38px;
}

.favorite-price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 8px;
}

.favorite-price {
  font-size: 20px;
  font-weight: 700;
  color: #e74c3c;
}

.favorite-date {
  font-size: 12px;
  color: #999;
}

.favorite-actions {
  display: flex;
  gap: 10px;
}

.favorite-remove-btn {
  flex: 1;
}

.card-spec-selector {
  background: #f9fafb;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  border: 1px solid #eee;
}

.card-spec-group {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.card-spec-group:last-of-type {
  margin-bottom: 8px;
}

.card-spec-label {
  font-size: 12px;
  font-weight: 600;
  color: #555;
  min-width: 40px;
}

.card-spec-value-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex: 1;
}

.card-spec-value-btn {
  padding: 4px 10px;
  border: 1.5px solid #ddd;
  background: white;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  color: #555;
}

.card-spec-value-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.card-spec-value-btn.active {
  border-color: #667eea;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.card-selected-sku-info {
  padding-top: 8px;
  margin-top: 4px;
  border-top: 1px dashed #e5e7eb;
}

.card-selected-sku-info .card-sku-text {
  font-size: 12px;
  color: #27ae60;
  font-weight: 500;
}

.card-selected-sku-info.card-select-prompt .card-sku-text {
  color: #f39c12;
}

.btn {
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.btn-sm {
  padding: 6px 14px;
  font-size: 13px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-outline {
  background: white;
  border: 2px solid #667eea;
  color: #667eea;
}

.btn-outline:hover {
  background: #667eea;
  color: white;
}

.btn-danger {
  background: #e74c3c;
  color: white;
}

.btn-danger:hover {
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
  margin-top: 32px;
}

.page-btn {
  padding: 8px 20px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
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
  color: #666;
  font-size: 14px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  padding: 20px;
}

.modal {
  background: white;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  padding: 20px 24px;
  padding-bottom: 10px;
}

.modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #2c3e50;
}

.modal-body {
  padding: 24px;
  padding-top: 0;
  padding-bottom: 10px;
}

.modal-body p {
  margin: 0;
  font-size: 15px;
  color: #555;
  line-height: 1.6;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px 24px;
}

.confirm-modal {
  animation: modalFadeIn 0.25s ease;
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

.toast {
  position: fixed;
  top: 24px;
  right: 24px;
  padding: 14px 24px;
  border-radius: 8px;
  color: white;
  font-weight: 500;
  z-index: 2000;
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

@media (max-width: 600px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .favorites-grid {
    grid-template-columns: 1fr;
  }
}
</style>
