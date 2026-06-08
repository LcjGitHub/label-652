import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { register, login, getProfile, setAuthToken, initAuth } from '../api/auth.js';

const user = ref(null);
const isAuthenticated = computed(() => !!user.value);
const isLoading = ref(false);

export { user, isAuthenticated };

export function useAuth() {
  const router = useRouter();

  const loadUser = async () => {
    try {
      initAuth();
      const res = await getProfile();
      if (res.data.success) {
        user.value = res.data.data;
      }
    } catch (err) {
      console.error('加载用户信息失败:', err);
      setAuthToken(null);
      user.value = null;
    }
  };

  const handleRegister = async (data) => {
    isLoading.value = true;
    try {
      const res = await register(data);
      if (res.data.success) {
        setAuthToken(res.data.data.token);
        user.value = res.data.data.user;
        router.push('/');
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '注册失败'
      };
    } finally {
      isLoading.value = false;
    }
  };

  const handleLogin = async (data) => {
    isLoading.value = true;
    try {
      const res = await login(data);
      if (res.data.success) {
        setAuthToken(res.data.data.token);
        user.value = res.data.data.user;
        router.push('/');
        return { success: true };
      }
      return { success: false, message: res.data.message };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '登录失败'
      };
    } finally {
      isLoading.value = false;
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    user.value = null;
    router.push('/login');
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    loadUser,
    handleRegister,
    handleLogin,
    handleLogout
  };
}
