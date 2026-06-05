<template>
  <div class="auth-page">
    <div class="auth-container">
      <div class="auth-header">
        <h1>创建账号</h1>
        <p>加入我们，开始购物之旅</p>
      </div>
      <form class="auth-form" @submit.prevent="handleSubmit">
        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
        <div class="form-group">
          <label>用户名</label>
          <input
            type="text"
            v-model="formData.username"
            required
            placeholder="请输入用户名"
          />
        </div>
        <div class="form-group">
          <label>邮箱</label>
          <input
            type="email"
            v-model="formData.email"
            required
            placeholder="请输入邮箱"
          />
        </div>
        <div class="form-group">
          <label>密码</label>
          <input
            type="password"
            v-model="formData.password"
            required
            minlength="6"
            placeholder="请输入密码（至少6位）"
          />
        </div>
        <div class="form-group">
          <label>确认密码</label>
          <input
            type="password"
            v-model="formData.confirmPassword"
            required
            minlength="6"
            placeholder="请再次输入密码"
          />
        </div>
        <div class="form-group">
          <label>头像链接（可选）</label>
          <input
            type="url"
            v-model="formData.avatar"
            placeholder="https://example.com/avatar.jpg"
          />
          <p v-if="formData.avatar" class="avatar-preview-hint">
            <img :src="formData.avatar" alt="头像预览" class="avatar-preview" @error="handleAvatarError" />
          </p>
        </div>
        <button type="submit" class="btn btn-primary btn-block" :disabled="isLoading">
          <span v-if="isLoading">注册中...</span>
          <span v-else>注册</span>
        </button>
      </form>
      <div class="auth-footer">
        已有账号？
        <router-link to="/login">立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue';
import { useAuth } from '../composables/useAuth.js';

const { handleRegister, isLoading } = useAuth();

const formData = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  avatar: ''
});

const errorMessage = ref('');

const handleAvatarError = (event) => {
  event.target.style.display = 'none';
};

const handleSubmit = async () => {
  errorMessage.value = '';
  
  if (formData.password !== formData.confirmPassword) {
    errorMessage.value = '两次输入的密码不一致';
    return;
  }

  const { confirmPassword, ...registerData } = formData;
  
  if (!registerData.avatar) {
    delete registerData.avatar;
  }
  
  const result = await handleRegister(registerData);
  if (!result.success) {
    errorMessage.value = result.message;
  }
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.auth-container {
  background: white;
  border-radius: 20px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.auth-header {
  text-align: center;
  margin-bottom: 32px;
}

.auth-header h1 {
  font-size: 28px;
  color: #333;
  margin: 0 0 8px;
}

.auth-header p {
  color: #888;
  margin: 0;
  font-size: 14px;
}

.auth-form {
  margin-bottom: 24px;
}

.error-message {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #dc2626;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
  font-size: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: all 0.2s;
  box-sizing: border-box;
}

.form-group input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.avatar-preview-hint {
  margin-top: 8px;
  margin-bottom: 0;
}

.avatar-preview {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e0e0e0;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-block {
  width: 100%;
}

.auth-footer {
  text-align: center;
  color: #888;
  font-size: 14px;
}

.auth-footer a {
  color: #667eea;
  text-decoration: none;
  font-weight: 500;
}

.auth-footer a:hover {
  text-decoration: underline;
}
</style>
