<template>
  <div class="app">
    <header class="header">
      <div class="container">
        <h1 class="title">商品管理系统</h1>
        <button class="btn btn-primary" @click="openModal()">
          + 添加商品
        </button>
      </div>
    </header>

    <main class="main container">
      <div class="filter-section">
        <div class="filter-label">分类筛选：</div>
        <div class="category-tabs">
          <button
            class="tab-btn"
            :class="{ active: selectedCategory === 'all' }"
            @click="selectCategory('all')"
          >
            全部
          </button>
          <button
            v-for="category in categories"
            :key="category"
            class="tab-btn"
            :class="{ active: selectedCategory === category }"
            @click="selectCategory(category)"
          >
            {{ category }}
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>

      <div v-else-if="products.length === 0" class="empty">
        <p>暂无商品数据</p>
      </div>

      <div v-else class="product-grid">
        <div
          v-for="product in products"
          :key="product.id"
          class="product-card"
        >
          <div class="product-image">
            <img :src="product.image" :alt="product.name" />
            <span class="category-tag">{{ product.category }}</span>
          </div>
          <div class="product-info">
            <h3 class="product-name">{{ product.name }}</h3>
            <p class="product-desc">{{ product.description }}</p>
            <div class="product-footer">
              <span class="price">¥{{ product.price.toFixed(2) }}</span>
              <span class="stock">库存: {{ product.stock }}</span>
            </div>
            <div class="product-actions">
              <button class="btn btn-sm btn-outline" @click="openModal(product)">
                编辑
              </button>
              <button class="btn btn-sm btn-danger" @click="handleDelete(product.id)">
                删除
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
        <span class="page-info">
          第 {{ pagination.page }} 页 / 共 {{ pagination.pages }} 页
        </span>
        <button
          class="page-btn"
          :disabled="pagination.page >= pagination.pages"
          @click="changePage(pagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </main>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>{{ editingProduct ? '编辑商品' : '添加商品' }}</h2>
          <button class="close-btn" @click="closeModal">&times;</button>
        </div>
        <form class="modal-body" @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>商品名称 *</label>
            <input
              type="text"
              v-model="formData.name"
              required
              placeholder="请输入商品名称"
            />
          </div>
          <div class="form-group">
            <label>商品描述</label>
            <textarea
              v-model="formData.description"
              rows="3"
              placeholder="请输入商品描述"
            ></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>价格 *</label>
              <input
                type="number"
                v-model.number="formData.price"
                required
                min="0"
                step="0.01"
                placeholder="0.00"
              />
            </div>
            <div class="form-group">
              <label>库存</label>
              <input
                type="number"
                v-model.number="formData.stock"
                min="0"
                placeholder="0"
              />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>分类 *</label>
              <select v-model="formData.category" required>
                <option value="">请选择分类</option>
                <option v-for="cat in categories" :key="cat" :value="cat">
                  {{ cat }}
                </option>
              </select>
            </div>
            <div class="form-group">
              <label>图片链接</label>
              <input
                type="url"
                v-model="formData.image"
                placeholder="https://..."
              />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="closeModal">
              取消
            </button>
            <button type="submit" class="btn btn-primary">
              {{ editingProduct ? '保存修改' : '添加商品' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct
} from './api/products.js';

const categories = ref([]);
const products = ref([]);
const loading = ref(false);
const selectedCategory = ref('all');
const showModal = ref(false);
const editingProduct = ref(null);

const pagination = reactive({
  page: 1,
  limit: 12,
  total: 0,
  pages: 0
});

const formData = reactive({
  name: '',
  description: '',
  price: '',
  category: '',
  stock: 0,
  image: ''
});

const toast = reactive({
  show: false,
  message: '',
  type: 'success'
});

const showToast = (message, type = 'success') => {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => {
    toast.show = false;
  }, 3000);
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

const fetchProducts = async () => {
  loading.value = true;
  try {
    const params = {
      page: pagination.page,
      limit: pagination.limit
    };
    if (selectedCategory.value !== 'all') {
      params.category = selectedCategory.value;
    }
    const res = await getProducts(params);
    if (res.data.success) {
      products.value = res.data.data.products;
      pagination.total = res.data.data.pagination.total;
      pagination.pages = res.data.data.pagination.pages;
    }
  } catch (err) {
    console.error('获取商品失败:', err);
    showToast('获取商品失败', 'error');
  } finally {
    loading.value = false;
  }
};

const selectCategory = (category) => {
  selectedCategory.value = category;
  pagination.page = 1;
  fetchProducts();
};

const changePage = (page) => {
  pagination.page = page;
  fetchProducts();
};

const openModal = (product = null) => {
  editingProduct.value = product;
  if (product) {
    formData.name = product.name;
    formData.description = product.description;
    formData.price = product.price;
    formData.category = product.category;
    formData.stock = product.stock;
    formData.image = product.image;
  } else {
    resetForm();
  }
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingProduct.value = null;
  resetForm();
};

const resetForm = () => {
  formData.name = '';
  formData.description = '';
  formData.price = '';
  formData.category = '';
  formData.stock = 0;
  formData.image = '';
};

const handleSubmit = async () => {
  try {
    if (editingProduct.value) {
      await updateProduct(editingProduct.value.id, { ...formData });
      showToast('商品更新成功');
    } else {
      await createProduct({ ...formData });
      showToast('商品添加成功');
    }
    closeModal();
    fetchProducts();
  } catch (err) {
    console.error('操作失败:', err);
    showToast(err.response?.data?.message || '操作失败', 'error');
  }
};

const handleDelete = async (id) => {
  if (!confirm('确定要删除这个商品吗？')) return;
  try {
    await deleteProduct(id);
    showToast('商品删除成功');
    fetchProducts();
  } catch (err) {
    console.error('删除失败:', err);
    showToast('删除失败', 'error');
  }
};

onMounted(() => {
  fetchCategories();
  fetchProducts();
});
</script>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header .container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  font-size: 28px;
  font-weight: 600;
  margin: 0;
}

.main {
  flex: 1;
  padding-top: 30px;
  padding-bottom: 30px;
}

.filter-section {
  background: white;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.filter-label {
  font-weight: 600;
  color: #555;
}

.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: 1;
}

.tab-btn {
  padding: 8px 20px;
  border: 2px solid #e0e0e0;
  background: white;
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  color: #666;
}

.tab-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.tab-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
  color: white;
}

.loading,
.empty {
  text-align: center;
  padding: 60px 20px;
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

.product-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.product-card {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  transition: transform 0.2s, box-shadow 0.2s;
}

.product-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.12);
}

.product-image {
  position: relative;
  width: 100%;
  height: 200px;
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
  top: 12px;
  left: 12px;
  background: rgba(102, 126, 234, 0.95);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.product-info {
  padding: 16px;
}

.product-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-desc {
  font-size: 13px;
  color: #888;
  margin-bottom: 12px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
  font-size: 13px;
  color: #999;
}

.product-actions {
  display: flex;
  gap: 8px;
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
  padding: 6px 16px;
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
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #eee;
}

.modal-header h2 {
  font-size: 20px;
  margin: 0;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  cursor: pointer;
  color: #999;
  line-height: 1;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.modal-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-weight: 500;
  color: #555;
  font-size: 14px;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color 0.2s;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: #667eea;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
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
</style>
