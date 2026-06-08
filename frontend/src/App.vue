<template>
  <div class="app">
    <header class="header">
      <div class="header-content">
        <router-link to="/" class="logo-link">
          <h1 class="title">商品管理系统</h1>
        </router-link>
        <SearchBar v-model="searchQuery" @search="handleSearch" />
        <div class="header-actions">
          <template v-if="showAddButton">
            <button class="btn btn-outline" @click="handleExport">
              导出
            </button>
            <button class="btn btn-outline" @click="handleOpenImportModal">
              导入
            </button>
            <button class="btn btn-primary" @click="handleAddProduct">
              + 添加商品
            </button>
          </template>
          <button class="cart-icon-btn" @click="toggleCartDrawer" :title="'购物车 (' + cartCount + ')'">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <span v-if="cartCount > 0" class="cart-badge">{{ cartCount > 99 ? '99+' : cartCount }}</span>
          </button>
          <div v-if="isAuthenticated" class="user-menu">
            <router-link to="/orders" class="btn btn-outline btn-sm">
              我的订单
            </router-link>
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
      <router-view @add-product="handleAddProduct" />
    </main>

    <CartDrawer :show="isCartDrawerOpen" @close="closeCartDrawer" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuth } from './composables/useAuth.js';
import { useCart } from './composables/useCart.js';
import CartDrawer from './components/CartDrawer.vue';
import SearchBar from './components/SearchBar.vue';

const route = useRoute();
const router = useRouter();
const { user, isAuthenticated, isLoading: authLoading, handleLogout, loadUser } = useAuth();
const { cartCount, isCartDrawerOpen, loadCart, loadCartFromServer, toggleCartDrawer, closeCartDrawer } = useCart();

const searchQuery = ref('');

const showAddButton = computed(() => route.path === '/');

const handleSearch = (query) => {
  router.push({
    path: '/search',
    query: { q: query }
  });
};

const handleAddProduct = () => {
  if (route.path === '/') {
    const event = new CustomEvent('open-add-modal');
    window.dispatchEvent(event);
  }
};

const handleExport = () => {
  if (route.path === '/') {
    const event = new CustomEvent('export-products');
    window.dispatchEvent(event);
  }
};

const handleOpenImportModal = () => {
  if (route.path === '/') {
    const event = new CustomEvent('open-import-modal');
    window.dispatchEvent(event);
  }
};

onMounted(async () => {
  if (localStorage.getItem('token') && !isAuthenticated.value) {
    await loadUser();
    await nextTick();
    if (isAuthenticated.value) {
      await loadCartFromServer();
    } else {
      await loadCart();
    }
  } else {
    await loadCart();
  }
});

watch(isAuthenticated, async (newVal, oldVal) => {
  if (newVal && !oldVal) {
    await nextTick();
  }
});

watch(() => route.path, () => {
  if (localStorage.getItem('token') && !isAuthenticated.value) {
    loadUser();
  }
});

watch(() => [route.path, route.query.q], ([path, q]) => {
  if (path === '/search' && typeof q === 'string') {
    searchQuery.value = q;
  }
}, { immediate: true });
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
  gap: 20px;
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

.cart-icon-btn {
  position: relative;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: white;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  padding: 0;
}

.cart-icon-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.cart-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #e74c3c;
  color: white;
  font-size: 11px;
  font-weight: 600;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
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
