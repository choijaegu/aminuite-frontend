// src/router/index.js

import { createRouter, createWebHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import LoginView from '../views/LoginView.vue';
import SignupView from '../views/SignupView.vue';
import AnnouncementListView from '../views/AnnouncementListView.vue';
import AnnouncementDetailView from '../views/AnnouncementDetailView.vue'; // << AnnouncementDetailView 임포트!
// import AnnouncementFormView from '../views/AnnouncementFormView.vue'; // Form 뷰도 필요시 임포트

const routes = [
  { path: '/', name: 'home', component: HomeView },
  { path: '/login', name: 'login', component: LoginView },
  { path: '/signup', name: 'signup', component: SignupView },
  {
    path: '/announcements',
    name: 'announcementList',
    component: AnnouncementListView,
  },
  { // << 공지사항 상세 페이지 라우트 추가!
    path: '/announcements/:id', // :id는 동적 파라미터
    name: 'announcementDetail',
    component: AnnouncementDetailView,
    props: true // route.params.id를 컴포넌트의 props.id로 전달
  },
  // { // 이전 답변에서 추가했던 공지사항 작성/수정 폼 라우트
  //   path: '/announcements/create',
  //   name: 'announcementCreate',
  //   component: () => import('../views/AnnouncementFormView.vue'), // 지연 로딩 예시
  // },
  // {
  //   path: '/announcements/:id/edit',
  //   name: 'announcementEdit',
  //   component: () => import('../views/AnnouncementFormView.vue'),
  //   props: true,
  // },
  // ... (기존 CategoryChatRoomsView, ChatRoomView 라우트) ...
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
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;