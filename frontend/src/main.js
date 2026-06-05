import { createApp } from 'vue';
import App from './App.vue';
import router from './router/index.js';
import './style.css';
import { initAuth } from './api/auth.js';

initAuth();

const app = createApp(App);
app.use(router);
app.mount('#app');
