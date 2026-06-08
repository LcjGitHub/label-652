import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  addFavorite,
  removeFavorite,
  batchRemoveFavorites,
  getFavorites,
  checkFavorite,
  getFavoriteIds
} from '../api/favorites.js';

const favoriteIds = ref(new Set());
const isLoading = ref(false);
const favorites = ref([]);
const favoritesPagination = ref({
  page: 1,
  limit: 20,
  total: 0,
  pages: 0
});

export function useFavorites() {
  const router = useRouter();

  const isFavorited = (productId) => {
    return favoriteIds.value.has(Number(productId));
  };

  const favoriteCount = computed(() => favoriteIds.value.size);

  const requireAuth = () => {
    return !!localStorage.getItem('token');
  };

  const toggleFavorite = async (productId) => {
    if (!requireAuth()) return { success: false, message: '请先登录' };

    const id = Number(productId);
    if (favoriteIds.value.has(id)) {
      return await doRemoveFavorite(id);
    } else {
      return await doAddFavorite(id);
    }
  };

  const doAddFavorite = async (productId) => {
    isLoading.value = true;
    try {
      const res = await addFavorite(productId);
      if (res.data.success) {
        favoriteIds.value.add(Number(productId));
        return { success: true, message: '收藏成功' };
      }
      return { success: false, message: res.data.message || '收藏失败' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '收藏失败'
      };
    } finally {
      isLoading.value = false;
    }
  };

  const doRemoveFavorite = async (productId) => {
    isLoading.value = true;
    try {
      const res = await removeFavorite(productId);
      if (res.data.success) {
        favoriteIds.value.delete(Number(productId));
        favorites.value = favorites.value.filter(f => Number(f.id) !== Number(productId));
        return { success: true, message: '已取消收藏' };
      }
      return { success: false, message: res.data.message || '取消收藏失败' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '取消收藏失败'
      };
    } finally {
      isLoading.value = false;
    }
  };

  const doBatchRemoveFavorites = async (productIds) => {
    if (!requireAuth()) return { success: false, message: '请先登录' };
    if (!productIds || productIds.length === 0) {
      return { success: false, message: '请选择要取消收藏的商品' };
    }

    isLoading.value = true;
    try {
      const res = await batchRemoveFavorites(productIds);
      if (res.data.success) {
        const ids = productIds.map(id => Number(id));
        ids.forEach(id => favoriteIds.value.delete(id));
        favorites.value = favorites.value.filter(f => !ids.includes(Number(f.id)));
        return { success: true, message: res.data.message, data: res.data.data };
      }
      return { success: false, message: res.data.message || '批量取消收藏失败' };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || '批量取消收藏失败'
      };
    } finally {
      isLoading.value = false;
    }
  };

  const fetchFavoriteIds = async () => {
    if (!localStorage.getItem('token')) {
      favoriteIds.value = new Set();
      return;
    }
    try {
      const res = await getFavoriteIds();
      if (res.data.success) {
        favoriteIds.value = new Set(res.data.data.map(id => Number(id)));
      }
    } catch (err) {
      console.error('获取收藏ID列表失败:', err);
    }
  };

  const fetchFavorites = async (params = {}) => {
    if (!requireAuth()) return;
    isLoading.value = true;
    try {
      const queryParams = {
        page: favoritesPagination.value.page,
        limit: favoritesPagination.value.limit,
        ...params
      };
      const res = await getFavorites(queryParams);
      if (res.data.success) {
        favorites.value = res.data.data.favorites;
        favoritesPagination.value = res.data.data.pagination;
      }
    } catch (err) {
      console.error('获取收藏列表失败:', err);
      favorites.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const checkFavoriteStatus = async (productId) => {
    try {
      const res = await checkFavorite(productId);
      if (res.data.success) {
        const isFav = res.data.data.isFavorited;
        if (isFav) {
          favoriteIds.value.add(Number(productId));
        } else {
          favoriteIds.value.delete(Number(productId));
        }
        return isFav;
      }
    } catch (err) {
      console.error('检查收藏状态失败:', err);
    }
    return false;
  };

  const clearFavorites = () => {
    favoriteIds.value = new Set();
    favorites.value = [];
    favoritesPagination.value = { page: 1, limit: 20, total: 0, pages: 0 };
  };

  const changeFavoritesPage = (page) => {
    favoritesPagination.value.page = page;
    fetchFavorites();
  };

  return {
    favoriteIds,
    favorites,
    favoritesPagination,
    isLoading,
    favoriteCount,
    isFavorited,
    toggleFavorite,
    doAddFavorite,
    doRemoveFavorite,
    doBatchRemoveFavorites,
    fetchFavoriteIds,
    fetchFavorites,
    checkFavoriteStatus,
    clearFavorites,
    changeFavoritesPage,
    requireAuth
  };
}
