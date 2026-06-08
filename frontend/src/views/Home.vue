<template>
  <div class="home-page">
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
        @click="goToDetail(product.id)"
      >
        <div class="product-image">
          <img
            :src="product.image || defaultPlaceholder"
            :alt="product.name"
            @error="handleImageError($event)"
          />
          <span class="category-tag">{{ product.category }}</span>
        </div>
        <div class="product-info">
          <h3 class="product-name">{{ product.name }}</h3>
          <p class="product-desc">{{ product.description }}</p>
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
            <template v-if="isAuthenticated">
              <button class="btn btn-sm btn-outline" @click="openModal(product)">
                编辑
              </button>
              <button class="btn btn-sm btn-danger" @click="handleDelete(product.id)">
                删除
              </button>
            </template>
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

    <div v-if="showImportModal" class="modal-overlay" @click.self="closeImportModal">
      <div class="modal import-modal">
        <div class="modal-header">
          <h2>批量导入商品</h2>
          <button class="close-btn" @click="closeImportModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="import-tip">
            <div class="tip-icon">💡</div>
            <div class="tip-content">
              <p>请先下载导入模板，按照模板格式填写商品数据后上传。</p>
              <button class="btn btn-outline btn-sm template-btn" @click="handleDownloadTemplate">
                下载导入模板
              </button>
            </div>
          </div>

          <div
            v-if="!importResult && !importing"
            class="upload-area"
            :class="{ 'drag-over': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop.prevent="handleDrop"
          >
            <input
              type="file"
              ref="fileInput"
              accept=".xlsx,.xls"
              style="display: none"
              @change="handleFileChange"
            />
            <div class="upload-icon">📁</div>
            <p class="upload-text">点击或拖拽 Excel 文件到此处</p>
            <p class="upload-hint">支持 .xlsx, .xls 格式</p>
            <button class="btn btn-primary" @click="$refs.fileInput.click()">
              选择文件
            </button>
          </div>

          <div v-if="selectedFile && !importing && !importResult" class="selected-file">
            <div class="file-info">
              <span class="file-icon">📄</span>
              <span class="file-name">{{ selectedFile.name }}</span>
              <span class="file-size">({{ formatFileSize(selectedFile.size) }})</span>
            </div>
            <button class="btn btn-danger btn-sm" @click="clearFile">移除</button>
          </div>

          <div v-if="importing" class="import-progress">
            <div class="progress-header">
              <span>正在导入...</span>
              <span>{{ importProgress }}%</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" :style="{ width: importProgress + '%' }"></div>
            </div>
          </div>

          <div v-if="importResult" class="import-result">
            <div class="result-stats">
              <div class="stat-item total">
                <span class="stat-value">{{ importResult.total }}</span>
                <span class="stat-label">总计</span>
              </div>
              <div class="stat-item success">
                <span class="stat-value">{{ importResult.successCount }}</span>
                <span class="stat-label">成功</span>
              </div>
              <div class="stat-item fail">
                <span class="stat-value">{{ importResult.failCount }}</span>
                <span class="stat-label">失败</span>
              </div>
            </div>

            <div v-if="importResult.errors && importResult.errors.length > 0" class="errors-section">
              <h4 class="errors-title">错误详情 ({{ importResult.errors.length }} 条)</h4>
              <div class="errors-list">
                <div
                  v-for="(error, index) in importResult.errors"
                  :key="index"
                  class="error-item"
                >
                  <div class="error-header">
                    <span v-if="error.row">第 {{ error.row }} 行</span>
                    <span v-else>系统错误</span>
                    <span v-if="error.data.name" class="error-name"> - {{ error.data.name }}</span>
                  </div>
                  <ul class="error-list">
                    <li v-for="(msg, i) in error.errors" :key="i">{{ msg }}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-outline" @click="closeImportModal">
              {{ importResult ? '关闭' : '取消' }}
            </button>
            <button
              v-if="selectedFile && !importing && !importResult"
              type="button"
              class="btn btn-primary"
              :disabled="importing"
              @click="handleImport"
            >
              开始导入
            </button>
            <button
              v-if="importResult"
              type="button"
              class="btn btn-primary"
              @click="resetImportAndContinue"
            >
              继续导入
            </button>
          </div>
        </div>
      </div>
    </div>

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
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  getProducts,
  getCategories,
  createProduct,
  updateProduct,
  deleteProduct,
  exportProducts,
  downloadTemplate,
  importProducts
} from '../api/products.js';
import { useAuth } from '../composables/useAuth.js';
import { useCart } from '../composables/useCart.js';

const router = useRouter();
const { isAuthenticated } = useAuth();
const { handleAddToCart, openCartDrawer } = useCart();

const categories = ref([]);
const products = ref([]);
const loading = ref(false);
const selectedCategory = ref('all');
const showModal = ref(false);
const editingProduct = ref(null);
const addingCartId = ref(null);

const showImportModal = ref(false);
const selectedFile = ref(null);
const isDragOver = ref(false);
const importing = ref(false);
const importProgress = ref(0);
const importResult = ref(null);
const fileInput = ref(null);

const handleOpenAddModal = () => {
  openModal();
};

const handleOpenImportModal = () => {
  showImportModal.value = true;
};

const handleExportProducts = async () => {
  try {
    const params = {};
    if (selectedCategory.value !== 'all') {
      params.category = selectedCategory.value;
    }
    const res = await exportProducts(params);
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const contentDisposition = res.headers['content-disposition'];
    let fileName = '商品列表.xlsx';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/);
      if (match) {
        fileName = decodeURIComponent(match[1]);
      }
    }
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    showToast('导出成功', 'success');
  } catch (err) {
    console.error('导出失败:', err);
    showToast('导出失败', 'error');
  }
};

const handleDownloadTemplate = async () => {
  try {
    const res = await downloadTemplate();
    const blob = new Blob([res.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '商品导入模板.xlsx';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    console.error('下载模板失败:', err);
    showToast('下载模板失败', 'error');
  }
};

const handleFileChange = (event) => {
  const file = event.target.files[0];
  if (file) {
    validateAndSetFile(file);
  }
};

const handleDrop = (event) => {
  isDragOver.value = false;
  const file = event.dataTransfer.files[0];
  if (file) {
    validateAndSetFile(file);
  }
};

const validateAndSetFile = (file) => {
  const validTypes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ];
  const validExtensions = ['.xlsx', '.xls'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();

  if (!validTypes.includes(file.type) && !validExtensions.includes(ext)) {
    showToast('请上传 Excel 文件（.xlsx 或 .xls 格式）', 'error');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('文件大小不能超过 10MB', 'error');
    return;
  }
  selectedFile.value = file;
};

const clearFile = () => {
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const closeImportModal = () => {
  if (importing.value) return;
  showImportModal.value = false;
  selectedFile.value = null;
  importResult.value = null;
  importProgress.value = 0;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const resetImportAndContinue = () => {
  selectedFile.value = null;
  importResult.value = null;
  importProgress.value = 0;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const handleImport = async () => {
  if (!selectedFile.value) return;

  importing.value = true;
  importProgress.value = 0;
  importResult.value = null;

  try {
    const res = await importProducts(selectedFile.value, (progressEvent) => {
      if (progressEvent.total) {
        importProgress.value = Math.round((progressEvent.loaded / progressEvent.total) * 100);
      }
    });

    importProgress.value = 100;
    importResult.value = res.data.data;

    if (res.data.data.successCount > 0) {
      showToast(res.data.message, 'success');
      fetchProducts();
    } else {
      showToast(res.data.message, 'error');
    }
  } catch (err) {
    console.error('导入失败:', err);
    const errorMessage = err.response?.data?.message || '导入失败，请稍后重试';
    showToast(errorMessage, 'error');
    importResult.value = {
      total: 0,
      successCount: 0,
      failCount: 0,
      errors: [{ row: null, errors: [errorMessage], data: {} }]
    };
  } finally {
    importing.value = false;
  }
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

onMounted(() => {
  fetchCategories();
  fetchProducts();
  window.addEventListener('open-add-modal', handleOpenAddModal);
  window.addEventListener('open-import-modal', handleOpenImportModal);
  window.addEventListener('export-products', handleExportProducts);
});

onUnmounted(() => {
  window.removeEventListener('open-add-modal', handleOpenAddModal);
  window.removeEventListener('open-import-modal', handleOpenImportModal);
  window.removeEventListener('export-products', handleExportProducts);
});

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

let pendingDeleteId = null;

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
    products.value = [];
    pagination.total = 0;
    pagination.pages = 0;
    showToast('获取商品失败，请检查后端服务是否正常', 'error');
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

const goToDetail = (id) => {
  router.push(`/product/${id}`);
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
      closeModal();
      fetchProducts();
    } else {
      const newProductCategory = formData.category;
      await createProduct({ ...formData });
      showToast('商品添加成功');
      closeModal();
      fetchProducts();
      
      if (selectedCategory.value !== 'all' && selectedCategory.value !== newProductCategory) {
        const confirmed = await showConfirm(
          '切换分类',
          `新商品属于「${newProductCategory}」分类，当前筛选下可能无法看到，是否切换到该分类查看？`,
          { confirmText: '切换分类', cancelText: '留在当前' }
        );
        if (confirmed) {
          selectCategory(newProductCategory);
        }
      }
    }
  } catch (err) {
    console.error('操作失败:', err);
    showToast(err.response?.data?.message || '操作失败', 'error');
  }
};

const handleDelete = async (id) => {
  const confirmed = await showConfirm(
    '确认删除',
    '确定要删除这个商品吗？此操作无法撤销。',
    { confirmText: '删除', cancelText: '取消' }
  );
  if (!confirmed) return;
  try {
    await deleteProduct(id);
    showToast('商品删除成功');
    fetchProducts();
  } catch (err) {
    console.error('删除失败:', err);
    showToast('删除失败', 'error');
  }
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

</script>

<style scoped>
.home-page {
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
  cursor: pointer;
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

.product-card-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
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
  padding: 6px 12px;
  font-size: 12px;
  flex: 1;
  min-width: 60px;
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
  box-sizing: border-box;
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

.confirm-modal {
  max-width: 420px;
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

.confirm-modal .modal-header {
  border-bottom: none;
  padding-bottom: 10px;
}

.confirm-modal .modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #2c3e50;
}

.confirm-body {
  padding-top: 0;
  padding-bottom: 10px;
}

.confirm-body p {
  margin: 0;
  font-size: 15px;
  color: #555;
  line-height: 1.6;
}

.import-modal {
  max-width: 640px;
}

.import-tip {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f0f7ff;
  border: 1px solid #b8daff;
  border-radius: 8px;
  margin-bottom: 20px;
}

.tip-icon {
  font-size: 24px;
  line-height: 1;
}

.tip-content {
  flex: 1;
}

.tip-content p {
  margin: 0 0 10px 0;
  font-size: 14px;
  color: #004085;
  line-height: 1.5;
}

.template-btn {
  flex: none;
}

.upload-area {
  border: 2px dashed #d0d0d0;
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  transition: all 0.2s;
  cursor: pointer;
  background: #fafafa;
}

.upload-area:hover,
.upload-area.drag-over {
  border-color: #667eea;
  background: #f5f7ff;
}

.upload-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.upload-text {
  font-size: 16px;
  font-weight: 500;
  color: #333;
  margin: 0 0 6px 0;
}

.upload-hint {
  font-size: 13px;
  color: #999;
  margin: 0 0 20px 0;
}

.selected-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 8px;
  margin-top: 16px;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #333;
}

.file-icon {
  font-size: 20px;
}

.file-name {
  font-weight: 500;
}

.file-size {
  color: #888;
  font-size: 13px;
}

.import-progress {
  padding: 20px 0;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.progress-bar {
  width: 100%;
  height: 10px;
  background: #f0f0f0;
  border-radius: 5px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 5px;
  transition: width 0.3s ease;
}

.import-result {
  margin-top: 16px;
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  border-radius: 10px;
}

.stat-item.total {
  background: #e6f7ff;
  border: 1px solid #91d5ff;
}

.stat-item.success {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
}

.stat-item.fail {
  background: #fff2f0;
  border: 1px solid #ffccc7;
}

.stat-value {
  display: block;
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-item.total .stat-value {
  color: #1890ff;
}

.stat-item.success .stat-value {
  color: #52c41a;
}

.stat-item.fail .stat-value {
  color: #ff4d4f;
}

.stat-label {
  font-size: 13px;
  color: #666;
}

.errors-section {
  margin-top: 16px;
}

.errors-title {
  font-size: 15px;
  font-weight: 600;
  color: #e74c3c;
  margin: 0 0 12px 0;
}

.errors-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid #eee;
  border-radius: 8px;
}

.error-item {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  background: #fffbfb;
}

.error-item:last-child {
  border-bottom: none;
}

.error-header {
  font-size: 13px;
  font-weight: 600;
  color: #e74c3c;
  margin-bottom: 6px;
}

.error-name {
  color: #666;
  font-weight: normal;
}

.error-list {
  margin: 0;
  padding-left: 20px;
}

.error-list li {
  font-size: 13px;
  color: #555;
  line-height: 1.6;
  margin-bottom: 2px;
}
</style>
