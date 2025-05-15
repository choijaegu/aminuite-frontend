import { createApp } from 'vue'
import App from './App.vue'
import router from './router' // 방금 만든 router/index.js 파일을 임포트합니다.

createApp(App)
  .use(router)  // Vue 앱에 router를 사용하도록 설정합니다.
  .mount('#app')