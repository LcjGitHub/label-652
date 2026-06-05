<template>
  <div class="search-results-page">
    <div class="search-header">
      <div class="search-result-info">
        <h1 class="search-title">
          <span v-if="searchQuery">"{{ searchQuery }}"</span>
          <span v-else>全部商品</span>
          的搜索结果
        </h1>
        <p class="result-count" v-if="!loading">
          找到 <strong>{{ pagination.total }}</strong> 件相关商品
        </p>
      </div>
    </div>

    <div class="filter-bar">
      <div class="filter-section">
        <label class="filter-label">分类：</label>
        <select v-model="selectedCategory" @change="handleCategoryChange" class="filter-select">
          <option value="all">全部分类</option>
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
        </select>
      </div>

      <div class="filter-section">
        <label class="filter-label">价格：</label>
        <input
          v-model.number="minPrice"
          type="number"
          class="price-input"
          placeholder="最低价"
          min="0"
          step="0.01"
          @change="handlePriceChange"
        />
        <span class="price-separator">-</span>
        <input
          v-model.number="maxPrice"
          type="number"
          class="price-input"
          placeholder="最高价"
          min="0"
          step="0.01"
          @change="handlePriceChange"
        />
      </div>

      <div class="filter-section">
        <label class="filter-label">排序：</label>
        <div class="sort-buttons">
          <button
            v-for="option in sortOptions"
            :key="option.value"
            class="sort-btn"
            :class="{ active: sortBy === option.value }"
            @click="handleSortChange(option.value)"
          >
            {{ option.label }}
            <span v-if="sortBy === option.value && option.value !== 'relevance' && option.value !== 'newest'" class="sort-arrow">
              {{ sortOrder === 'desc' ? '↓' : '↑' }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>搜索中...</p>
    </div>

    <div v-else-if="products.length === 0" class="empty">
      <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        <line x1="8" y1="11" x2="14" y2="11"></line>
      </svg>
      <p class="empty-title">暂无相关商品</p>
      <p class="empty-desc">试试其他关键词或调整筛选条件</p>
      <button class="btn btn-primary" @click="resetFilters">重置筛选条件</button>
    </div>

    <div v-else class="product-grid">
      <div
        v-for="product in products"
        :key="product.id"
        class="product-card"
        @click="goToDetail(product.id)"
      >
        <div class="product-image">
          <img
            :src="product.image || defaultPlaceholder"
            :alt="product.name"
            @error="handleImageError($event)"
          />
          <span class="category-tag">{{ product.category }}</span>
          <div v-if="product.sales_count > 0" class="sales-tag">
            已售 {{ product.sales_count }}
          </div>
        </div>
        <div class="product-info">
          <h3 class="product-name" v-html="highlightKeyword(product.name)"></h3>
          <p class="product-desc" v-html="highlightKeyword(product.description)"></p>
          
          <div class="product-rating" v-if="product.avg_rating > 0">
            <div class="stars">
              <span
                v-for="star in 5"
                :key="star"
                class="star"
                :class="{ filled: star <= Math.round(product.avg_rating) }"
              >
                ★
              </span>
            </div>
            <span class="rating-score">{{ product.avg_rating.toFixed(1) }}</span>
            <span class="review-count">({{ product.review_count }})</span>
          </div>

          <div class="product-footer">
            <span class="price">¥{{ product.price.toFixed(2) }}</span>
            <span class="stock">库存: {{ product.stock }}</span>
          </div>
          <div class="product-card-actions" @click.stop>
            <button
              class="btn btn-sm btn-primary"
              :disabled="product.stock === 0 || addingCartId === product.id"
              @click="quickAddToCart(product)"
            >
              <span v-if="addingCartId === product.id">添加中...</span>
              <span v-else>加入购物车</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pagination.pages > 1" class="pagination">
      <button
        class="page-btn"
        :disabled="pagination.page <= 1"
        @click="changePage(pagination.page - 1)"
      >
        上一页
      </button>
      <div class="page-numbers">
        <button
          v-for="page in visiblePages"
          :key="page"
          class="page-number"
          :class="{ active: page === pagination.page }"
          @click="changePage(page)"
        >
          {{ page }}
        </button>
      </div>
      <button
        class="page-btn"
        :disabled="pagination.page >= pagination.pages"
        @click="changePage(pagination.page + 1)"
      >
        下一页
      </button>
    </div>

    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { searchProducts } from '../api/search.js';
import { getCategories } from '../api/products.js';
import { useCart } from '../composables/useCart.js';

const route = useRoute();
const router = useRouter();
const { handleAddToCart } = useCart();

const searchQuery = ref('');
const categories = ref([]);
const products = ref([]);
const loading = ref(false);
const addingCartId = ref(null);

const selectedCategory = ref('all');
const minPrice = ref(null);
const maxPrice = ref(null);
const sortBy = ref('relevance');
const sortOrder = ref('desc');

const sortOptions = [
  { label: '综合', value: 'relevance' },
  { label: '销量', value: 'sales' },
  { label: '价格', value: 'price' },
  { label: '评分', value: 'rating' },
  { label: '最新', value: 'newest' }
];

const pagination = reactive({
  page: 1,
  limit: 12,
  total: 0,
  pages: 0
});

const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

const toast = reactive({
  show: false,
  message: '',
  type: 'success'
});

const visiblePages = computed(() => {
  const pages = [];
  const current = pagination.page;
  const total = pagination.pages;
  const delta = 2;

  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    pages.push(i);
  }

  return pages;
});

const showToast = (message, type = 'success') => {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
};

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

const highlightKeyword = (text) => {
  if (!text || !searchQuery.value) return text;
  const keyword = searchQuery.value.trim();
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<em class="highlight">$1</em>');
};

const fetchCategories = async () => {
  try {
    const res = await getCategories();
    if (res.data.success) {
      categories.value = res.data.data;
    }
  } catch (err) {
    console.error('获取分类失败:', err);
  }
};

const fetchSearchResults = async () => {
  loading.value = true;
  try {
    const params = {
      q: searchQuery.value || undefined,
      category: selectedCategory.value !== 'all' ? selectedCategory.value : undefined,
      minPrice: minPrice.value !== null && minPrice.value !== '' ? minPrice.value : undefined,
      maxPrice: maxPrice.value !== null && maxPrice.value !== '' ? maxPrice.value : undefined,
      sortBy: sortBy.value,
      sortOrder: sortOrder.value,
      page: pagination.page,
      limit: pagination.limit
    };

    const res = await searchProducts(params);
    if (res.data.success) {
      products.value = res.data.data.products;
      pagination.total = res.data.data.pagination.total;
      pagination.pages = res.data.data.pagination.pages;
    }
  } catch (err) {
    console.error('搜索失败:', err);
    products.value = [];
    pagination.total = 0;
    pagination.pages = 0;
  } finally {
    loading.value = false;
  }
};

const handleCategoryChange = () => {
  pagination.page = 1;
  fetchSearchResults();
};

const handlePriceChange = () => {
  pagination.page = 1;
  fetchSearchResults();
};

const handleSortChange = (value) => {
  if (sortBy.value === value && value !== 'relevance' && value !== 'newest') {
    sortOrder.value = sortOrder.value === 'desc' ? 'asc' : 'desc';
  } else {
    sortBy.value = value;
    sortOrder.value = 'desc';
  }
  pagination.page = 1;
  fetchSearchResults();
};

const changePage = (page) => {
  pagination.page = page;
  fetchSearchResults();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

const resetFilters = () => {
  selectedCategory.value = 'all';
  minPrice.value = null;
  maxPrice.value = null;
  sortBy.value = 'relevance';
  sortOrder.value = 'desc';
  pagination.page = 1;
  fetchSearchResults();
};

const goToDetail = (id) => {
  router.push(`/product/${id}`);
};

const quickAddToCart = async (product) => {
  addingCartId.value = product.id;
  try {
    const result = await handleAddToCart(product.id, 1);
    if (result.success) {
      showToast(result.message, 'success');
    } else {
      showToast(result.message, 'error');
    }
  } catch (err) {
    showToast('添加失败', 'error');
  } finally {
    addingCartId.value = null;
  }
};

const initFromQuery = () => {
  searchQuery.value = route.query.q || '';
  if (route.query.category) {
    selectedCategory.value = route.query.category;
  }
  if (route.query.sortBy) {
    sortBy.value = route.query.sortBy;
  }
  if (route.query.sortOrder) {
    sortOrder.value = route.query.sortOrder;
  }
  if (route.query.page) {
    pagination.page = parseInt(route.query.page) || 1;
  }
  if (route.query.minPrice) {
    minPrice.value = parseFloat(route.query.minPrice);
  }
  if (route.query.maxPrice) {
    maxPrice.value = parseFloat(route.query.maxPrice);
  }
};

watch(() => route.query, () => {
  initFromQuery();
  fetchSearchResults();
}, { deep: true });

onMounted(() => {
  initFromQuery();
  fetchCategories();
  fetchSearchResults();
});
</script>

<style scoped>
.search-results-page {
  padding-top: 24px;
  padding-bottom: 40px;
}

.search-header {
  background: white;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.search-title {
  font-size: 22px;
  color: #333;
  margin: 0 0 8px;
  font-weight: 600;
}

.search-title span:first-child {
  color: #667eea;
}

.result-count {
  color: #888;
  font-size: 14px;
  margin: 0;
}

.result-count strong {
  color: #e74c3c;
  font-weight: 600;
}

.filter-bar {
  background: white;
  border-radius: 12px;
  padding: 16px 20px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
}

.filter-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-label {
  font-size: 14px;
  font-weight: 500;
  color: #555;
  white-space: nowrap;
}

.filter-select {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  min-width: 120px;
}

.filter-select:focus {
  outline: none;
  border-color: #667eea;
}

.price-input {
  width: 100px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
}

.price-input:focus {
  outline: none;
  border-color: #667eea;
}

.price-separator {
  color: #999;
}

.sort-buttons {
  display: flex;
  gap: 4px;
}

.sort-btn {
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.sort-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
}

.sort-arrow {
  font-weight: 600;
}

.loading,
.empty {
  text-align: center;
  padding: 80px 20px;
  color: #999;
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

.empty svg {
  margin-bottom: 16px;
  color: #ddd;
}

.empty-title {
  font-size: 18px;
  color: #666;
  margin: 0 0 8px;
  font-weight: 500;
}

.empty-desc {
  font-size: 14px;
  color: #999;
  margin: 0 0 20px;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}

.product-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.product-image {
  position: relative;
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: #f5f5f5;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.category-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(102, 126, 234, 0.95);
  color: white;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.sales-tag {
  position: absolute;
  bottom: 10px;
  right: 10px;
  background: rgba(231, 76, 60, 0.95);
  color: white;
  padding: 3px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.product-info {
  padding: 14px;
}

.product-name {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 6px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-name :deep(.highlight) {
  color: #e74c3c;
  font-style: normal;
  background: #fff3cd;
  padding: 0 2px;
  border-radius: 2px;
}

.product-desc {
  font-size: 12px;
  color: #888;
  margin-bottom: 10px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 36px;
}

.product-desc :deep(.highlight) {
  color: #e74c3c;
  font-style: normal;
  background: #fff3cd;
  padding: 0 2px;
  border-radius: 2px;
}

.product-rating {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.stars {
  display: flex;
  gap: 1px;
}

.star {
  font-size: 14px;
  color: #ddd;
}

.star.filled {
  color: #f1c40f;
}

.rating-score {
  font-size: 13px;
  font-weight: 600;
  color: #f1c40f;
}

.review-count {
  font-size: 12px;
  color: #999;
}

.product-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.price {
  font-size: 20px;
  font-weight: 700;
  color: #e74c3c;
}

.stock {
  font-size: 12px;
  color: #999;
}

.product-card-actions {
  display: flex;
  gap: 6px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
  flex: 1;
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

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 32px;
}

.page-btn {
  padding: 8px 20px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.page-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-numbers {
  display: flex;
  gap: 4px;
}

.page-number {
  width: 36px;
  height: 36px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
}

.page-number:hover {
  border-color: #667eea;
  color: #667eea;
}

.page-number.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
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

@media (max-width: 768px) {
  .filter-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 16px;
  }

  .filter-section {
    flex-wrap: wrap;
  }

  .sort-buttons {
    flex-wrap: wrap;
  }

  .product-grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
  }

  .product-image {
    height: 140px;
  }

  .product-name {
    font-size: 14px;
  }

  .price {
    font-size: 18px;
  }
}
</style>
