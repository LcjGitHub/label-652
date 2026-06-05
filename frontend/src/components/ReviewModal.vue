<template>
  <div v-if="show" class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ editingReview ? '编辑评价' : '发表评价' }}</h2>
        <button class="close-btn" @click="handleClose">&times;</button>
      </div>
      <form class="modal-body" @submit.prevent="handleSubmit">
        <div class="form-group">
          <label>评分</label>
          <div class="rating-stars">
            <span
              v-for="star in 5" :key="star"
              class="star"
              :class="{ active: star <= formData.rating }"
              @click="formData.rating = star"
            >
              ★
            </span>
          </div>
        </div>
        <div class="form-group">
          <label>评价内容</label>
          <textarea
            v-model="formData.content"
            rows="4"
            placeholder="分享您的使用体验..."
          ></textarea>
        </div>
        <div class="form-group">
          <label>评价图片（可选）</label>
          <div class="image-inputs">
            <div v-for="(img, index) in formData.images" :key="index" class="image-item">
              <input
                type="url"
                v-model="formData.images[index]"
                placeholder="图片链接"
              />
              <button type="button" class="remove-btn" @click="removeImage(index)">×</button>
            </div>
            <button
              v-if="formData.images.length < 5"
              type="button"
              class="add-image-btn"
              @click="addImage"
            >
              + 添加图片
            </button>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline" @click="handleClose">
            取消
          </button>
          <button type="submit" class="btn btn-primary" :disabled="submitting">
            <span v-if="submitting">提交中...</span>
            <span v-else>{{ editingReview ? '保存修改' : '提交评价' }}</span>
          </button>
        </div>
      </form>
    </div>
    <div v-if="errorMessage" class="error-toast">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { createReview, updateReview } from '../api/reviews.js';

const props = defineProps({
  show: Boolean,
  productId: [Number, String],
  editingReview: Object
});

const emit = defineEmits(['close', 'success']);

const formData = reactive({
  rating: 5,
  content: '',
  images: ['']
});

const submitting = ref(false);
const errorMessage = ref('');

watch(() => props.show, (newVal) => {
  if (newVal) {
    if (props.editingReview) {
      formData.rating = props.editingReview.rating;
      formData.content = props.editingReview.content || '';
      formData.images = props.editingReview.images?.length ? [...props.editingReview.images] : [''];
    } else {
      formData.rating = 5;
      formData.content = '';
      formData.images = [''];
    }
    errorMessage.value = '';
  }
});

const addImage = () => {
  formData.images.push('');
};

const removeImage = (index) => {
  formData.images.splice(index, 1);
};

const handleClose = () => {
  if (!submitting.value) {
    emit('close');
  }
};

const handleSubmit = async () => {
  if (formData.rating < 1 || formData.rating > 5) {
    errorMessage.value = '请选择评分';
    return;
  }

  submitting.value = true;
  errorMessage.value = '';

  try {
    const images = formData.images.filter(img => img.trim() !== '');
    const data = {
      product_id: props.productId,
      rating: formData.rating,
      content: formData.content,
      images
    };

    if (props.editingReview) {
      await updateReview(props.editingReview.id, data);
    } else {
      await createReview(data);
    }

    emit('success');
    emit('close');
  } catch (err) {
    errorMessage.value = err.response?.data?.message || '提交失败';
  } finally {
    submitting.value = false;
  }
};
</script>

<style scoped>
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
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 24px;
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

.form-group textarea,
.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  font-family: inherit;
}

.rating-stars {
  display: flex;
  gap: 4px;
}

.star {
  font-size: 32px;
  cursor: pointer;
  color: #ddd;
  transition: all 0.2s;
}

.star:hover,
.star.active {
  color: #f1c40f;
  transform: scale(1.1);
}

.image-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.image-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.image-item input {
  flex: 1;
}

.remove-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #e74c3c;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remove-btn:hover {
  background: #c0392b;
}

.add-image-btn {
  padding: 10px;
  border: 2px dashed #ddd;
  background: none;
  color: #888;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.add-image-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #eee;
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

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.error-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: #e74c3c;
  color: white;
  border-radius: 8px;
  z-index: 1001;
}
</style>
