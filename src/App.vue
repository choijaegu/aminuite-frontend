<template>
  <div id="app">
    <h1>정치 토론 게시판에 오신 것을 환영합니다!</h1>
    <p>프론트엔드 개발을 시작합니다.</p>

    <h2>커뮤니티 카테고리 목록</h2>
    <div v-if="loadingCategories">
      <p>카테고리 목록을 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error">
      <p style="color: red;">오류 발생: {{ error }}</p>
    </div>
    <ul v-else-if="categories.length > 0">
      <li v-for="category in categories" :key="category.categoryId">
        <h3>{{ category.name }} (ID: {{ category.categoryId }})</h3>
        <p>{{ category.description }}</p>

        <button @click="fetchChatRooms(category)">
          {{ category.showingChatRooms ? '채팅방 숨기기' : '채팅방 보기' }}
        </button>

        <div v-if="category.loadingChatRooms" style="margin-left: 20px; font-style: italic;">
          {{ category.name }} 카테고리의 채팅방을 불러오는 중...
        </div>
        <ul v-if="category.showingChatRooms && category.chatRooms && category.chatRooms.length > 0" style="margin-top: 10px;">
          <li v-for="room in category.chatRooms" :key="room.roomId" style="margin-left: 20px; background-color: #e9e9e9;">
            방: {{ room.name }} (ID: {{ room.roomId }})
            </li>
        </ul>
        <p v-if="category.showingChatRooms && (!category.chatRooms || category.chatRooms.length === 0) && !category.loadingChatRooms" style="margin-left: 20px; font-style: italic;">
          이 카테고리에는 아직 채팅방이 없습니다. (Postman으로 추가해보세요!)
        </p>
      </li>
    </ul>
    <p v-else>
      생성된 카테고리가 없습니다. (Postman으로 카테고리를 먼저 생성해주세요!)
    </p>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'App',
  data() {
    return {
      categories: [],
      loadingCategories: true,
      error: null
    };
  },
  methods: {
    async fetchCategories() {
      this.loadingCategories = true;
      this.error = null;
      try {
        const response = await axios.get('http://localhost:8080/api/categories');
        // 각 카테고리 객체에 chatRooms, showingChatRooms, loadingChatRooms 상태를 추가합니다.
        this.categories = response.data.map(category => ({
          ...category,
          chatRooms: category.chatRooms || [], // 백엔드에서 chatRooms를 바로 주면 그것을 사용, 아니면 빈 배열
          showingChatRooms: false, // 채팅방 목록을 보여줄지 여부
          loadingChatRooms: false  // 채팅방 목록 로딩 중인지 여부
        }));
        console.log('Fetched categories:', this.categories);
      } catch (err) {
        // ... (기존 오류 처리 로직은 동일) ...
        console.error("카테고리 목록을 불러오는 중 오류 발생:", err);
        this.error = "카테고리 목록을 불러올 수 없습니다.";
        if (err.response) {
          this.error += ` (서버 응답: ${err.response.status} ${err.response.statusText})`;
          console.error('Server response error data:', err.response.data);
        } else if (err.request) {
          this.error += " (서버에서 응답이 없습니다. 백엔드 서버가 실행 중인지, CORS 설정이 되어있는지 확인해주세요.)";
          console.error('No response from server:', err.request);
        } else {
          this.error += ` (요청 설정 오류: ${err.message})`;
          console.error('Request setup error:', err.message);
        }
        this.categories = [];
      } finally {
        this.loadingCategories = false;
      }
    },
    // 특정 카테고리의 채팅방 목록을 불러오는 메소드
    async fetchChatRooms(category) {
      if (category.showingChatRooms) { // 이미 목록이 열려있으면 닫기만 함
        category.showingChatRooms = false;
        return;
      }

      category.loadingChatRooms = true;
      this.error = null; // 이전 오류 메시지 초기화
      try {
        const response = await axios.get(`http://localhost:8080/api/categories/${category.categoryId}/chatrooms`);
        category.chatRooms = response.data;
        category.showingChatRooms = true; // 목록 보여주기
        console.log(`Workspaceed chat rooms for ${category.categoryId}:`, category.chatRooms);
      } catch (err) {
        console.error(`채팅방 목록(${category.categoryId})을 불러오는 중 오류 발생:`, err);
        this.error = `${category.name} 카테고리의 채팅방 목록을 불러올 수 없습니다.`;
         if (err.response) {
          this.error += ` (서버 응답: ${err.response.status} ${err.response.statusText})`;
        } else if (err.request) {
          this.error += " (서버 응답 없음)";
        } else {
          this.error += ` (요청 설정 오류)`;
        }
        category.chatRooms = [];
        category.showingChatRooms = false; // 오류 시 목록 안 보여줌
      } finally {
        category.loadingChatRooms = false;
      }
    }
  },
  mounted() {
    this.fetchCategories();
  }
}
</script>

<style>
/* ... (기존 스타일은 그대로) ... */
button {
  padding: 5px 10px;
  cursor: pointer;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 3px;
  margin-top: 5px;
}
button:hover {
  background-color: #45a049;
}
</style>