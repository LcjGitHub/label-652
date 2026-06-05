<template>
  <div class="search-wrapper" @click.stop>
    <div class="search-box" :class="{ focused: isFocused }">
      <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input
        ref="searchInput"
        v-model="searchQuery"
        type="text"
        class="search-input"
        :placeholder="placeholder"
        @focus="handleFocus"
        @blur="handleBlur"
        @input="handleInput"
        @keyup.enter="handleSearch"
        @keyup.esc="clearSearch"
      />
      <button v-if="searchQuery" class="clear-btn" @click="clearSearch" title="清除">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <button class="search-btn" @click="handleSearch" title="搜索">
        搜索
      </button>
    </div>

    <div v-if="showDropdown" class="search-dropdown">
      <div v-if="suggestions.length > 0" class="dropdown-section">
        <div class="dropdown-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          搜索建议
        </div>
        <div
          v-for="(item, index) in suggestions"
          :key="index"
          class="dropdown-item"
          @mousedown.prevent="selectSuggestion(item.suggestion)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span v-html="highlightKeyword(item.suggestion)"></span>
        </div>
      </div>

      <div v-if="hotKeywords.length > 0" class="dropdown-section">
        <div class="dropdown-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          热门搜索
        </div>
        <div class="hot-keywords">
          <span
            v-for="(item, index) in hotKeywords"
            :key="index"
            class="hot-keyword-tag"
            :class="{ 'top-3': index < 3 }"
            @mousedown.prevent="selectSuggestion(item.keyword)"
          >
            <span class="rank">{{ index + 1 }}</span>
            {{ item.keyword }}
          </span>
        </div>
      </div>

      <div v-if="searchHistory.length > 0" class="dropdown-section">
        <div class="dropdown-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12,6 12,12 16,14"></polyline>
          </svg>
          搜索历史
          <button class="clear-history-btn" @mousedown.prevent="handleClearHistory" title="清空历史">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            清空
          </button>
        </div>
        <div
          v-for="(item, index) in searchHistory"
          :key="index"
          class="dropdown-item"
          @mousedown.prevent="selectSuggestion(item.keyword)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12,6 12,12 16,14"></polyline>
          </svg>
          <span>{{ item.keyword }}</span>
        </div>
      </div>

      <div v-if="suggestions.length === 0 && hotKeywords.length === 0 && searchHistory.length === 0" class="dropdown-empty">
        暂无搜索内容
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { getSearchSuggestions, getHotKeywords, getSearchHistory, clearSearchHistory } from '../api/search.js';
import { useAuth } from '../composables/useAuth.js';

const props = defineProps({
  placeholder: {
    type: String,
    default: '搜索商品名称、描述、分类...'
  },
  modelValue: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['update:modelValue', 'search']);

const router = useRouter();
const { isAuthenticated } = useAuth();

const searchInput = ref(null);
const searchQuery = ref(props.modelValue);
const isFocused = ref(false);
const suggestions = ref([]);
const hotKeywords = ref([]);
const searchHistory = ref([]);
const showDropdown = ref(false);

let debounceTimer = null;
const DEBOUNCE_DELAY = 300;

const handleFocus = () => {
  isFocused.value = true;
  showDropdown.value = true;
  if (!searchQuery.value.trim()) {
    loadHotKeywords();
    loadSearchHistory();
  }
};

const handleBlur = () => {
  setTimeout(() => {
    isFocused.value = false;
    showDropdown.value = false;
  }, 150);
};

const handleInput = () => {
  emit('update:modelValue', searchQuery.value);
  
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  if (searchQuery.value.trim()) {
    debounceTimer = setTimeout(() => {
      fetchSuggestions();
    }, DEBOUNCE_DELAY);
  } else {
    suggestions.value = [];
    loadHotKeywords();
    loadSearchHistory();
    showDropdown.value = true;
  }
};

const fetchSuggestions = async () => {
  if (!searchQuery.value.trim()) {
    suggestions.value = [];
    return;
  }
  
  try {
    const res = await getSearchSuggestions(searchQuery.value.trim(), 8);
    if (res.data.success) {
      suggestions.value = res.data.data;
      showDropdown.value = true;
    }
  } catch (err) {
    console.error('获取搜索建议失败:', err);
    suggestions.value = [];
  }
};

const loadHotKeywords = async () => {
  try {
    const res = await getHotKeywords(10);
    if (res.data.success) {
      hotKeywords.value = res.data.data;
    }
  } catch (err) {
    console.error('获取热门搜索词失败:', err);
    hotKeywords.value = [];
  }
};

const loadSearchHistory = async () => {
  if (!isAuthenticated.value) {
    const localHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    searchHistory.value = localHistory.slice(0, 10);
    return;
  }
  
  try {
    const res = await getSearchHistory(10);
    if (res.data.success) {
      searchHistory.value = res.data.data;
    }
  } catch (err) {
    console.error('获取搜索历史失败:', err);
    searchHistory.value = [];
  }
};

const handleClearHistory = async () => {
  if (!isAuthenticated.value) {
    localStorage.removeItem('searchHistory');
    searchHistory.value = [];
    return;
  }
  
  try {
    await clearSearchHistory();
    searchHistory.value = [];
  } catch (err) {
    console.error('清空搜索历史失败:', err);
  }
};

const handleSearch = () => {
  const query = searchQuery.value.trim();
  if (query) {
    saveToLocalHistory(query);
    emit('search', query);
    router.push({
      path: '/search',
      query: { q: query }
    });
    showDropdown.value = false;
  }
};

const selectSuggestion = (suggestion) => {
  searchQuery.value = suggestion;
  emit('update:modelValue', suggestion);
  saveToLocalHistory(suggestion);
  emit('search', suggestion);
  router.push({
    path: '/search',
    query: { q: suggestion }
  });
  showDropdown.value = false;
};

const saveToLocalHistory = (keyword) => {
  const localHistory = JSON.parse(localStorage.getItem('searchHistory') || '[]');
  const filtered = localHistory.filter(item => item.keyword.toLowerCase() !== keyword.toLowerCase());
  filtered.unshift({ keyword, last_searched: new Date().toISOString() });
  localStorage.setItem('searchHistory', JSON.stringify(filtered.slice(0, 20)));
};

const clearSearch = () => {
  searchQuery.value = '';
  emit('update:modelValue', '');
  suggestions.value = [];
  nextTick(() => {
    searchInput.value?.focus();
  });
};

const highlightKeyword = (text) => {
  if (!text || !searchQuery.value.trim()) return text;
  const keyword = searchQuery.value.trim();
  const regex = new RegExp(`(${keyword})`, 'gi');
  return text.replace(regex, '<em class="highlight">$1</em>');
};

const handleClickOutside = (event) => {
  const searchWrapper = document.querySelector('.search-wrapper');
  if (searchWrapper && !searchWrapper.contains(event.target)) {
    showDropdown.value = false;
  }
};

watch(() => props.modelValue, (newVal) => {
  if (newVal !== searchQuery.value) {
    searchQuery.value = newVal;
  }
});

onMounted(() => {
  loadHotKeywords();
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.search-wrapper {
  position: relative;
  flex: 1;
  max-width: 500px;
  min-width: 280px;
}

.search-box {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 24px;
  padding: 4px 4px 4px 14px;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.search-box.focused {
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.search-icon {
  color: #999;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  outline: none;
  padding: 8px 10px;
  font-size: 14px;
  background: transparent;
  color: #333;
  min-width: 0;
}

.search-input::placeholder {
  color: #aaa;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  cursor: pointer;
  color: #999;
  transition: all 0.2s;
  margin-right: 4px;
  padding: 0;
}

.clear-btn:hover {
  background: #e0e0e0;
  color: #666;
}

.search-btn {
  padding: 8px 20px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.search-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  max-height: 480px;
  overflow-y: auto;
  z-index: 1000;
  animation: dropdownFadeIn 0.2s ease;
}

@keyframes dropdownFadeIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dropdown-section {
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}

.dropdown-section:last-child {
  border-bottom: none;
}

.dropdown-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 16px 8px;
  font-size: 13px;
  font-weight: 600;
  color: #666;
}

.clear-history-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  color: #999;
  font-size: 12px;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
}

.clear-history-btn:hover {
  background: #f5f5f5;
  color: #e74c3c;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.2s;
  color: #333;
  font-size: 14px;
}

.dropdown-item:hover {
  background: #f5f7fa;
}

.dropdown-item svg {
  color: #ccc;
  flex-shrink: 0;
}

.dropdown-item .highlight {
  color: #667eea;
  font-style: normal;
  font-weight: 600;
}

.hot-keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px;
}

.hot-keyword-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #f5f7fa;
  border-radius: 16px;
  font-size: 13px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.hot-keyword-tag:hover {
  background: #e8ebf5;
  color: #667eea;
}

.hot-keyword-tag .rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #ddd;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

.hot-keyword-tag.top-3 .rank {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.hot-keyword-tag.top-3:nth-child(2) .rank {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
}

.hot-keyword-tag.top-3:nth-child(3) .rank {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.dropdown-empty {
  padding: 40px 20px;
  text-align: center;
  color: #999;
  font-size: 14px;
}

@media (max-width: 768px) {
  .search-wrapper {
    max-width: none;
    width: 100%;
    order: 3;
  }
  
  .search-btn {
    padding: 6px 14px;
    font-size: 13px;
  }
}
</style>
