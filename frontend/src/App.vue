<template>
  <div class="app">
    <header class="header">
      <div class="container header-content">
        <router-link to="/" class="logo-link">
          <h1 class="title">商品管理系统</h1>
        </router-link>
        <div class="header-actions">
          <button v-if="showAddButton" class="btn btn-primary" @click="handleAddProduct">
            + 添加商品
          </button>
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
      <router-view @add-product="handleAddProduct" />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuth } from './composables/useAuth.js';

const route = useRoute();
const { user, isAuthenticated, handleLogout, loadUser } = useAuth();

const showAddButton = computed(() => route.path === '/');

const handleAddProduct = () => {
  if (route.path === '/') {
    const event = new CustomEvent('open-add-modal');
    window.dispatchEvent(event);
  }
};

onMounted(() => {
  if (localStorage.getItem('token') && !isAuthenticated.value) {
    loadUser();
  }
});

watch(() => route.path, () => {
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
