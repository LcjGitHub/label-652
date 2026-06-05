<template>
  <div class="product-detail-page">
    <router-link to="/" class="back-link">
      ← 返回商品列表
    </router-link>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载中...</p>
    </div>

    <div v-else-if="!product" class="empty">
      <p>商品不存在</p>
    </div>

    <div v-else>
      <div class="product-main">
        <div class="product-image-large">
          <img
            :src="product.image || defaultPlaceholder"
            :alt="product.name"
            @error="handleImageError($event)"
          />
        </div>
        <div class="product-info-large">
          <span class="category-tag">{{ product.category }}</span>
          <h1 class="product-title">{{ product.name }}</h1>
          <p class="product-description">{{ product.description }}</p>
          
          <div class="rating-section" v-if="reviewStats">
            <div class="average-rating">
              <span class="rating-score">{{ reviewStats.averageRating }}</span>
              <div class="stars-display">
                <span
                  v-for="star in 5" :key="star"
                  class="star"
                  :class="{ filled: star <= Math.round(reviewStats.averageRating) }"
                >
                  ★
                </span>
              </div>
              <span class="review-count">{{ reviewStats.totalReviews }} 条评价</span>
            </div>
            <div class="rating-distribution">
              <div
                v-for="rating in [5, 4, 3, 2, 1]" :key="rating"
                class="rating-bar-row"
              >
                <span class="rating-label">{{ rating }}星</span>
                <div class="rating-bar">
                  <div
                    class="rating-bar-fill"
                    :style="{ width: getRatingPercent(rating) + '%' }"
                  ></div>
                </div>
                <span class="rating-count">{{ reviewStats.ratingDistribution[rating] }}</span>
              </div>
            </div>
          </div>

          <div class="product-price-large">
            <span class="price-label">价格</span>
            <span class="price-value">¥{{ product.price.toFixed(2) }}</span>
          </div>
          <div class="product-stock-large">
            库存: {{ product.stock }} 件
          </div>
          <button
            class="btn btn-primary btn-large"
            @click="openReviewModal"
          >
            {{ userReview ? '编辑我的评价' : '发表评价' }}
          </button>
        </div>
      </div>

      <div class="reviews-section">
        <div class="reviews-header">
          <h2>用户评价</h2>
          <div class="reviews-filters">
            <div class="filter-group">
              <label>按评分筛选：</label>
              <select v-model="filterRating" @change="fetchReviews">
                <option value="all">全部</option>
                <option v-for="r in 5" :key="r" :value="r">{{ r }}星</option>
              </select>
            </div>
            <div class="filter-group">
              <label>排序方式：</label>
              <select v-model="sortBy" @change="fetchReviews">
                <option value="created_at">最新发布</option>
                <option value="rating">评分最高</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="reviewsLoading" class="loading small">
          <div class="spinner small"></div>
          <p>加载评价中...</p>
        </div>

        <div v-else-if="reviews.length === 0" class="empty small">
          <p>暂无评价，快来发表第一条评价吧！</p>
        </div>

        <div v-else class="reviews-list">
          <div
            v-for="review in reviews" :key="review.id"
            class="review-item"
          >
            <div class="review-header">
              <div class="reviewer-info">
                <img :src="review.avatar" :alt="review.username" class="avatar" />
                <div>
                  <div class="reviewer-name">{{ review.username }}</div>
                  <div class="review-date">{{ formatDate(review.created_at) }}</div>
                </div>
              </div>
              <div class="review-rating">
                <span
                  v-for="star in 5" :key="star"
                  class="star small"
                  :class="{ filled: star <= review.rating }"
                >
                  ★
                </span>
              </div>
            </div>
            <div v-if="review.content" class="review-content">
              {{ review.content }}
            </div>
            <div v-if="review.images && review.images.length > 0" class="review-images">
              <img
                v-for="(img, idx) in review.images" :key="idx"
                :src="img"
                alt="评价图片"
                class="review-image"
              />
            </div>
            <div v-if="user && user.id === review.user_id" class="review-actions">
              <button class="btn btn-sm btn-outline" @click="editReview(review)">
                编辑
              </button>
              <button class="btn btn-sm btn-danger" @click="handleDeleteReview(review.id)">
                删除
              </button>
            </div>
          </div>
        </div>

        <div v-if="reviewPagination.pages > 1" class="pagination">
          <button
            class="page-btn"
            :disabled="reviewPagination.page <= 1"
            @click="changePage(reviewPagination.page - 1)"
          >
            上一页
          </button>
          <span class="page-info">
            第 {{ reviewPagination.page }} 页 / 共 {{ reviewPagination.pages }} 页
          </span>
          <button
            class="page-btn"
            :disabled="reviewPagination.page >= reviewPagination.pages"
            @click="changePage(reviewPagination.page + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>

    <ReviewModal
      :show="showReviewModal"
      :product-id="productId"
      :editing-review="editingReview"
      @close="closeReviewModal"
      @success="onReviewSuccess"
    />

    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>

    <div v-if="confirmDialog.show" class="modal-overlay">
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
import { ref, reactive, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getProduct } from '../api/products.js';
import {
  getProductReviews,
  getProductReviewStats,
  deleteReview
} from '../api/reviews.js';
import { useAuth } from '../composables/useAuth.js';
import ReviewModal from '../components/ReviewModal.vue';

const route = useRoute();
const router = useRouter();
const { user, isAuthenticated } = useAuth();

const productId = computed(() => route.params.id);

const product = ref(null);
const loading = ref(true);
const reviews = ref([]);
const reviewStats = ref(null);
const reviewsLoading = ref(false);

const showReviewModal = ref(false);
const editingReview = ref(null);

const filterRating = ref('all');
const sortBy = ref('created_at');

const reviewPagination = reactive({
  page: 1,
  limit: 5,
  total: 0,
  pages: 0
});

const defaultPlaceholder = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1NSUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOWvhueggTwvdGV4dD48L3N2Zz4=';

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

const userReview = computed(() => {
  if (!user.value) return null;
  return reviews.value.find(r => r.user_id === user.value.id);
});

const handleImageError = (event) => {
  event.target.src = defaultPlaceholder;
};

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

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getRatingPercent = (rating) => {
  if (!reviewStats.value || reviewStats.value.totalReviews === 0) return 0;
  return (reviewStats.value.ratingDistribution[rating] / reviewStats.value.totalReviews) * 100;
};

const fetchProduct = async () => {
  loading.value = true;
  try {
    const res = await getProduct(productId.value);
    if (res.data.success) {
      product.value = res.data.data;
    } else {
      product.value = null;
    }
  } catch (err) {
    console.error('获取商品详情失败:', err);
    product.value = null;
  } finally {
    loading.value = false;
  }
};

const fetchReviewStats = async () => {
  try {
    const res = await getProductReviewStats(productId.value);
    if (res.data.success) {
      reviewStats.value = res.data.data;
    }
  } catch (err) {
    console.error('获取评价统计失败:', err);
  }
};

const fetchReviews = async () => {
  reviewsLoading.value = true;
  try {
    const params = {
      page: reviewPagination.page,
      limit: reviewPagination.limit,
      sortBy: sortBy.value,
      sortOrder: sortBy.value === 'rating' ? 'desc' : 'desc'
    };
    if (filterRating.value !== 'all') {
      params.rating = filterRating.value;
    }
    const res = await getProductReviews(productId.value, params);
    if (res.data.success) {
      reviews.value = res.data.data.reviews;
      reviewPagination.total = res.data.data.pagination.total;
      reviewPagination.pages = res.data.data.pagination.pages;
    }
  } catch (err) {
    console.error('获取评价列表失败:', err);
    reviews.value = [];
  } finally {
    reviewsLoading.value = false;
  }
};

const changePage = (page) => {
  reviewPagination.page = page;
  fetchReviews();
};

const openReviewModal = () => {
  if (!isAuthenticated.value) {
    router.push('/login');
    return;
  }
  if (userReview.value) {
    editingReview.value = userReview.value;
  } else {
    editingReview.value = null;
  }
  showReviewModal.value = true;
};

const closeReviewModal = () => {
  showReviewModal.value = false;
  editingReview.value = null;
};

const editReview = (review) => {
  editingReview.value = review;
  showReviewModal.value = true;
};

const onReviewSuccess = () => {
  showToast(editingReview.value ? '评价更新成功' : '评价发表成功');
  fetchReviews();
  fetchReviewStats();
};

const handleDeleteReview = async (reviewId) => {
  const confirmed = await showConfirm(
    '确认删除',
    '确定要删除这条评价吗？此操作无法撤销。',
    { confirmText: '删除', cancelText: '取消' }
  );
  if (!confirmed) return;
  try {
    await deleteReview(reviewId);
    showToast('评价删除成功');
    fetchReviews();
    fetchReviewStats();
  } catch (err) {
    console.error('删除失败:', err);
    showToast(err.response?.data?.message || '删除失败', 'error');
  }
};

onMounted(() => {
  fetchProduct();
  fetchReviewStats();
  fetchReviews();
});
</script>

<style scoped>
.product-detail-page {
  padding-top: 24px;
  padding-bottom: 40px;
}

.back-link {
  display: inline-block;
  color: #667eea;
  text-decoration: none;
  margin-bottom: 20px;
  font-size: 14px;
  font-weight: 500;
}

.back-link:hover {
  text-decoration: underline;
}

.loading,
.empty {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.loading.small,
.empty.small {
  padding: 40px 20px;
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

.spinner.small {
  width: 30px;
  height: 30px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.product-main {
  background: white;
  border-radius: 16px;
  padding: 32px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  margin-bottom: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.product-image-large {
  width: 100%;
  aspect-ratio: 1;
  background: #f5f5f5;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-image-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.category-tag {
  display: inline-block;
  background: rgba(102, 126, 234, 0.1);
  color: #667eea;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 12px;
}

.product-title {
  font-size: 28px;
  color: #333;
  margin: 0 0 12px;
  font-weight: 600;
}

.product-description {
  font-size: 15px;
  color: #666;
  line-height: 1.8;
  margin-bottom: 24px;
}

.rating-section {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.average-rating {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.rating-score {
  font-size: 36px;
  font-weight: 700;
  color: #f1c40f;
}

.stars-display {
  display: flex;
  gap: 2px;
}

.star {
  font-size: 24px;
  color: #ddd;
}

.star.filled {
  color: #f1c40f;
}

.star.small {
  font-size: 16px;
}

.review-count {
  color: #888;
  font-size: 14px;
}

.rating-distribution {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rating-bar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rating-label {
  width: 40px;
  font-size: 13px;
  color: #666;
}

.rating-bar {
  flex: 1;
  height: 8px;
  background: #eee;
  border-radius: 4px;
  overflow: hidden;
}

.rating-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #f1c40f, #f39c12);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.rating-count {
  width: 40px;
  text-align: right;
  font-size: 13px;
  color: #888;
}

.product-price-large {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.price-label {
  font-size: 14px;
  color: #888;
}

.price-value {
  font-size: 36px;
  font-weight: 700;
  color: #e74c3c;
}

.product-stock-large {
  font-size: 14px;
  color: #888;
  margin-bottom: 24px;
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

.btn-large {
  padding: 14px 32px;
  font-size: 16px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.btn-sm {
  padding: 6px 16px;
  font-size: 13px;
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

.reviews-section {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.reviews-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.reviews-header h2 {
  font-size: 20px;
  color: #333;
  margin: 0;
}

.reviews-filters {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-group label {
  font-size: 14px;
  color: #666;
}

.filter-group select {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.filter-group select:focus {
  outline: none;
  border-color: #667eea;
}

.reviews-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.review-item {
  padding-bottom: 24px;
  border-bottom: 1px solid #f0f0f0;
}

.review-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.review-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.reviewer-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #f0f0f0;
}

.reviewer-name {
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.review-date {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.review-rating {
  display: flex;
  gap: 1px;
}

.review-content {
  font-size: 14px;
  color: #555;
  line-height: 1.7;
  margin-bottom: 12px;
}

.review-images {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.review-image {
  width: 100px;
  height: 100px;
  object-fit: cover;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s;
}

.review-image:hover {
  transform: scale(1.05);
}

.review-actions {
  display: flex;
  gap: 8px;
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
  border-bottom: none;
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

@media (max-width: 768px) {
  .product-main {
    grid-template-columns: 1fr;
    padding: 20px;
    gap: 24px;
  }

  .product-title {
    font-size: 22px;
  }

  .price-value {
    font-size: 28px;
  }

  .reviews-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .reviews-section {
    padding: 20px;
  }
}
</style>
