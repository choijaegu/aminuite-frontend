import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
// AboutView는 예시로 넣었던 것이니, 만약 AboutView.vue를 안 만드셨다면 아래 import는 빼셔도 됩니다.
// import AboutView from '../views/AboutView.vue'

const routes = [
  {
    path: '/',
    name: 'home',
    component: HomeView
  },
  // { // AboutView를 사용하지 않는다면 이 부분을 주석 처리하거나 삭제합니다.
  //   path: '/about',
  //   name: 'about',
  //   component: AboutView
  //   // 또는 지연 로딩: component: () => import('../views/AboutView.vue')
  // },
  {
    path: '/category/:categoryId',
    name: 'categoryChatRooms',
    component: () => import('../views/CategoryChatRoomsView.vue'),
    props: true
  },
  {
    path: '/category/:categoryId/room/:roomId',
    name: 'chatRoom',
    component: () => import('../views/ChatRoomView.vue'),
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL), // History 모드 사용 여쭤봤을 때 Y 하셨다면 이대로
  routes
})

export default router