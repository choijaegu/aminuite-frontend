<template>
  <div class="category-chat-rooms-view">
    <h1>{{ categoryId }} 카테고리의 채팅방 목록</h1>

    <div v-if="loadingChatRooms">
      <p>채팅방 목록을 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-message">
      <p>오류 발생: {{ error }}</p>
    </div>
    <ul v-else-if="chatRooms.length > 0" class="chatroom-list-page">
      <li v-for="room in chatRooms" :key="room.roomId" class="chatroom-item-page">
        <router-link :to="`/category/${categoryId}/room/${room.roomId}`">
          {{ room.name }} (ID: {{ room.roomId }})
        </router-link>
        <p class="room-created-at">생성일: {{ formatSimpleDateTime(room.createdAt) }}</p>
      </li>
    </ul>
    <p v-else class="no-rooms-message-page">
      이 카테고리에는 아직 채팅방이 없습니다.
    </p>

    <div class="navigation-links-page">
      <router-link to="/">홈 (모든 카테고리 보기)</router-link>
    </div>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'CategoryChatRoomsView',
  props: ['categoryId'], // URL 파라미터로 categoryId를 받음
  data() {
    return {
      chatRooms: [],
      loadingChatRooms: true,
      error: null,
    };
  },
  methods: {
    async fetchChatRoomsForCategory() {
      if (!this.categoryId) {
        this.error = "카테고리 ID가 없습니다.";
        this.loadingChatRooms = false;
        return;
      }
      this.loadingChatRooms = true;
      this.error = null;
      try {
        const response = await axios.get(`http://localhost:8080/api/categories/${this.categoryId}/chatrooms`);
        this.chatRooms = response.data;
        console.log(`Workspaceed chat rooms for category ${this.categoryId}:`, this.chatRooms);
      } catch (err) {
        console.error(`'${this.categoryId}' 카테고리의 채팅방 목록을 불러오는 중 오류 발생:`, err);
        this.error = `'${this.categoryId}' 카테고리의 채팅방 목록을 불러올 수 없습니다.`;
        if (err.response) {
          this.error += ` (서버 응답: ${err.response.status} ${err.response.statusText})`;
        } else if (err.request) {
          this.error += " (서버 응답 없음)";
        } else {
          this.error += ` (요청 설정 오류)`;
        }
        this.chatRooms = [];
      } finally {
        this.loadingChatRooms = false;
      }
    },
    formatSimpleDateTime(dateTimeString) { // 간단한 날짜/시간 포맷팅 함수
      if (!dateTimeString) return '';
      const date = new Date(dateTimeString);
      // 예: YYYY. MM. DD. HH:mm
      return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')}. ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }
  },
  mounted() {
    console.log('CategoryChatRoomsView Mounted - Category ID:', this.categoryId);
    this.fetchChatRoomsForCategory(); // 컴포넌트가 마운트되면 해당 카테고리의 채팅방 목록을 불러옴
  }
}
</script>

<style scoped>
.category-chat-rooms-view {
  padding: 20px;
  max-width: 700px;
  margin: 20px auto;
  text-align: left;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
.category-chat-rooms-view h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
  border-bottom: 1px solid #eee;
  padding-bottom: 15px;
}
.chatroom-list-page {
  list-style-type: none;
  padding: 0;
}
.chatroom-item-page {
  background-color: #f9f9f9;
  border: 1px solid #e0e0e0;
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 5px;
}
.chatroom-item-page a {
  text-decoration: none;
  color: #007bff;
  font-weight: bold;
  font-size: 1.1em;
}
.chatroom-item-page a:hover {
  text-decoration: underline;
}
.room-created-at {
  font-size: 0.8em;
  color: #777;
  margin-top: 5px;
}
.no-rooms-message-page, .error-message { /* HomeView와 클래스명 겹치지 않도록 -page 접미사 추가 */
  font-style: italic;
  color: #777;
  margin-top: 10px;
  text-align: center;
}
.error-message p {
  color: red;
  font-weight: bold;
}
.navigation-links-page {
  margin-top: 30px;
  text-align: center;
}
.navigation-links-page a {
  margin: 0 10px;
  color: #007bff;
  text-decoration: none;
}
.navigation-links-page a:hover {
  text-decoration: underline;
}
</style>