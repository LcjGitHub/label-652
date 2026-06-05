<template>
  <div class="app">
    <header class="header">
      <div class="container header-content">
        <router-link to="/" class="logo-link">
          <h1 class="title">商品管理系统</h1>
        </router-link>
        <div class="header-actions">
          <router-link to="/" v-if="isAuthenticated" class="btn btn-primary" @click="openAddModal">
            + 添加商品
          </router-link>
          <div v-if="isAuthenticated" class="user-menu">
            <div class="user-info">
              <img :src="user?.avatar" :alt="user?.username" class="user-avatar" />
              <span class="user-name">{{ user?.username }}</span>
            </div>
            <button class="btn btn-outline btn-sm" @click="handleLogout">
              退出
            </button>
          </div>
          <div v-else class="auth-buttons">
            <router-link to="/login" class="btn btn-outline btn-sm">登录</router-link>
            <router-link to="/register" class="btn btn-primary btn-sm">注册</router-link>
          </div>
        </div>
      </div>
    </header>

    <main class="main container">
      <router-view @open-modal="openAddModal" />
    </main>

    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h2>添加商品</h2>
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
              添加商品
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
import { useRoute, useRouter } from 'vue-router';
import { createProduct, getCategories } from './api/products.js';
import { useAuth } from './composables/useAuth.js';

const route = useRoute();
const router = useRouter();
const { user, isAuthenticated, handleLogout, loadUser } = useAuth();

const categories = ref([]);
const showModal = ref(false);

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
  getCategories().then(res => {
    if (res.data.success) {
      categories.value = res.data.data;
    }
  }).catch(err => console.error('获取分类失败:', err));
};

const openAddModal = () => {
  resetForm();
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
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
    await createProduct({ ...formData });
    showToast('商品添加成功');
    closeModal();
    router.push('/');
    if (route.path === '/') {
      window.location.reload();
    }
  } catch (err) {
    console.error('添加失败:', err);
    showToast(err.response?.data?.message || '添加失败', 'error');
  }
};

onMounted(() => {
  fetchCategories();
  if (localStorage.getItem('token') && !isAuthenticated.value) {
    loadUser();
  }
});
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
  color: #333;
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}
</style>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 0;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-link {
  color: white;
  text-decoration: none;
}

.title {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.3);
}

.user-name {
  font-weight: 500;
  font-size: 14px;
}

.auth-buttons {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
  text-decoration: none;
  display: inline-block;
}

.btn-sm {
  padding: 6px 16px;
  font-size: 13px;
}

.btn-primary {
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.btn-primary:hover {
  background: rgba(255, 255, 255, 0.3);
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.5);
  color: white;
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.1);
}

.main {
  flex: 1;
  padding-top: 0;
  padding-bottom: 30px;
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

.modal-footer .btn {
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
}

.modal-footer .btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
}

.modal-footer .btn-primary:hover {
  opacity: 0.9;
}

.modal-footer .btn-outline {
  background: white;
  border: 2px solid #667eea;
  color: #667eea;
}

.modal-footer .btn-outline:hover {
  background: #667eea;
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
  .header-content {
    flex-wrap: wrap;
    gap: 12px;
  }

  .title {
    font-size: 20px;
  }

  .user-name {
    display: none;
  }
}
</style>
