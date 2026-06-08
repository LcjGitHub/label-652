import { ref } from 'vue';
import {
  getAlertCount,
  getAlertProducts,
  createRestockOrder,
  exportRestockOrder,
  sendRestockOrderEmail
} from '../api/stockAlerts.js';

const alertCount = ref(0);
const alertProducts = ref([]);
const isAlertDrawerOpen = ref(false);
const isLoading = ref(false);
const currentRestockOrder = ref(null);

export function useStockAlert() {
  const fetchAlertCount = async () => {
    try {
      const res = await getAlertCount();
      if (res.data.success) {
        alertCount.value = res.data.data.count;
      }
    } catch (err) {
        console.error('获取预警数量失败:', err);
      }
  };

  const fetchAlertProducts = async () => {
    isLoading.value = true;
    try {
      const res = await getAlertProducts();
      if (res.data.success) {
        alertProducts.value = res.data.data.products || [];
      }
    } catch (err) {
      console.error('获取预警商品失败:', err);
      alertProducts.value = [];
    } finally {
      isLoading.value = false;
    }
  };

  const openAlertDrawer = async () => {
    isAlertDrawerOpen.value = true;
    await fetchAlertProducts();
  };

  const closeAlertDrawer = () => {
    isAlertDrawerOpen.value = false;
  };

  const toggleAlertDrawer = async () => {
    if (isAlertDrawerOpen.value) {
      closeAlertDrawer();
    } else {
      await openAlertDrawer();
    }
  };

  const generateRestockOrder = async (productIds = null, remark = '', multiplier = 2) => {
    try {
      const data = {};
      if (productIds && productIds.length > 0) {
        data.product_ids = productIds;
      }
      if (remark) {
        data.remark = remark;
      }
      if (multiplier !== 2) {
        data.multiplier = multiplier;
      }
      const res = await createRestockOrder(data);
      if (res.data.success) {
        currentRestockOrder.value = res.data.data;
        return { success: true, data: res.data.data, message: res.data.message };
      }
      return { success: false, message: res.data.message || '生成失败' };
    } catch (err) {
      console.error('生成补货建议单失败:', err);
      return { success: false, message: err.response?.data?.message || '生成补货建议单失败' };
    }
  };

  const exportOrder = async (orderId) => {
    try {
      const res = await exportRestockOrder(orderId);
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = res.headers['content-disposition'];
      let fileName = '补货建议单.xlsx';
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
      return { success: true };
    } catch (err) {
      console.error('导出失败:', err);
      return { success: false, message: err.response?.data?.message || '导出失败' };
    }
  };

  const sendOrderEmail = async (orderId, email = '') => {
    try {
      const data = email ? { email } : {};
      const res = await sendRestockOrderEmail(orderId, data);
      if (res.data.success) {
        return { success: true, message: res.data.message, data: res.data.data };
      }
      return { success: false, message: res.data.message || '发送失败' };
    } catch (err) {
      console.error('发送邮件失败:', err);
      return { success: false, message: err.response?.data?.message || '发送邮件失败' };
    }
  };

  return {
    alertCount,
    alertProducts,
    isAlertDrawerOpen,
    isLoading,
    currentRestockOrder,
    fetchAlertCount,
    fetchAlertProducts,
    openAlertDrawer,
    closeAlertDrawer,
    toggleAlertDrawer,
    generateRestockOrder,
    exportOrder,
    sendOrderEmail
  };
}
