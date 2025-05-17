<template>
  <div class="home">
    <h1>커뮤니티 카테고리</h1>

    <div v-if="loadingCategories">
      <p>카테고리 목록을 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-message">
      <p>오류 발생: {{ error }}</p>
    </div>

    <ul v-else-if="categories.length > 0" class="category-list">
      <li v-for="category in categories" :key="category.categoryId" class="category-item">
        <h3>{{ category.name }}</h3>
        <p class="category-description">{{ category.description }}</p>

        <button @click="fetchChatRooms(category)" class="action-button">
          {{ category.showingChatRooms ? '채팅방 숨기기' : '채팅방 보기' }}
          <span v-if="category.loadingChatRooms"> (불러오는 중...)</span>
        </button>

        <div class="create-room-section" v-if="category.showingCreateForm">
          <input type="text" v-model="category.newRoomName" placeholder="새 채팅방 이름 (표시용)">
          <button @click="createChatRoom(category)" :disabled="!category.newRoomName" class="action-button-small primary">만들기</button>
          <button @click="toggleCreateRoomForm(category)" class="action-button-small danger">취소</button>
        </div>
        <button v-else @click="toggleCreateRoomForm(category)" class="action-button-small primary" style="margin-left: 10px;">
          이 카테고리에 새 채팅방 만들기
        </button>

        <ul v-if="category.showingChatRooms && category.chatRooms && category.chatRooms.length > 0" class="chatroom-list">
          <li v-for="room in category.chatRooms" :key="room.roomId" class="chatroom-item">
            <a :href="`/category/${category.categoryId}/room/${room.roomId}`" @click.prevent="goToChatRoom(category.categoryId, room.roomId)">
              {{ room.name }}
              <span v-if="room.currentUserCount !== undefined" class="room-user-count"> ({{ room.currentUserCount }}명)</span>
            </a>
          </li>
        </ul>
        <p v-if="category.showingChatRooms && (!category.chatRooms || category.chatRooms.length === 0) && !category.loadingChatRooms" class="no-rooms-message">
          이 카테고리에는 아직 채팅방이 없습니다.
        </p>
      </li>
    </ul>
    <p v-else class="no-categories-message">
      생성된 카테고리가 없습니다. (백엔드에서 카테고리를 먼저 생성해주세요!)
    </p>
  </div>
</template>

<script>
// <script> 부분은 이전 최종본과 동일하게 유지합니다. (fetchCategories, fetchChatRooms 등)
// 단, fetchChatRooms 응답으로 오는 각 room 객체에 currentUserCount가 포함되어 있다고 가정합니다.
// 만약 백엔드가 아직 이 정보를 주지 않는다면, currentUserCount는 undefined가 되어 화면에 표시되지 않을 것입니다.
import axios from 'axios';

export default {
  name: 'HomeView',
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
        this.categories = response.data.map(category => ({
          ...category,
          // chatRooms: category.chatRooms || [], // category.chatRooms는 이제 fetchChatRooms에서 가져옴
          chatRooms: [], // 초기에는 빈 배열, fetchChatRooms 호출 시 채워짐
          showingChatRooms: false,
          loadingChatRooms: false,
          showingCreateForm: false,
          newRoomName: ''
        }));
        console.log('Fetched categories:', this.categories);
      } catch (err) {
        console.error("카테고리 목록을 불러오는 중 오류 발생:", err);
        this.error = "카테고리 목록을 불러올 수 없습니다.";
        if (err.response) { this.error += ` (서버 응답: ${err.response.status} ${err.response.statusText})`; }
        else if (err.request) { this.error += " (서버 응답 없음)"; }
        else { this.error += ` (요청 설정 오류)`; }
        this.categories = [];
      } finally {
        this.loadingCategories = false;
      }
    },
    async fetchChatRooms(category) {
      if (category.loadingChatRooms) return;
      if (category.showingChatRooms && !category.showingCreateForm) {
        category.showingChatRooms = false;
        return;
      }
      if (category.showingCreateForm) {
        category.showingCreateForm = false;
      }
      category.loadingChatRooms = true;
      this.error = null;
      try {
        // 이 API 응답의 각 room 객체에 currentUserCount가 포함되어야 합니다.
        const response = await axios.get(`http://localhost:8080/api/categories/${category.categoryId}/chatrooms`);
        const categoryInOurList = this.categories.find(c => c.categoryId === category.categoryId);
        if (categoryInOurList) {
            categoryInOurList.chatRooms = response.data; // response.data가 ChatRoom[] 형태여야 함
            categoryInOurList.showingChatRooms = true;
        }
        console.log(`Workspaceed chat rooms for ${category.categoryId}:`, response.data);
      } catch (err) {
        console.error(`채팅방 목록(${category.categoryId})을 불러오는 중 오류 발생:`, err);
        this.error = `${category.name} 카테고리의 채팅방 목록을 불러올 수 없습니다.`;
        const categoryInOurList = this.categories.find(c => c.categoryId === category.categoryId);
        if (categoryInOurList) {
            categoryInOurList.chatRooms = [];
            categoryInOurList.showingChatRooms = false;
        }
      } finally {
        const categoryInOurList = this.categories.find(c => c.categoryId === category.categoryId);
        if (categoryInOurList) {
            categoryInOurList.loadingChatRooms = false;
        }
      }
    },
    goToChatRoom(categoryId, roomId) {
      this.$router.push(`/category/${categoryId}/room/${roomId}`);
    },
    toggleCreateRoomForm(category) {
      this.categories.forEach(c => {
        if (c.categoryId !== category.categoryId) {
          c.showingCreateForm = false;
        }
      });
      category.showingCreateForm = !category.showingCreateForm;
      if (category.showingCreateForm) {
        category.newRoomName = '';
      }
    },
    async createChatRoom(category) {
      if (!category.newRoomName || category.newRoomName.trim() === '') {
        alert("채팅방 이름을 입력해주세요.");
        return;
      }
      const ownerUsername = localStorage.getItem('chatUsername') || "익명사용자";
      const payload = {
        name: category.newRoomName.trim(),
        ownerUsername: ownerUsername
      };

      try {
        const response = await axios.post(`http://localhost:8080/api/categories/${category.categoryId}/chatrooms`, payload);

        if (response.status === 201) {
          alert(`'${payload.name}' 채팅방이 성공적으로 생성되었습니다! (ID: ${response.data.roomId})`);

          const categoryInOurList = this.categories.find(c => c.categoryId === category.categoryId);
          if (categoryInOurList) {
            if (!categoryInOurList.chatRooms) {
              categoryInOurList.chatRooms = [];
            }
            categoryInOurList.chatRooms.push(response.data);
            categoryInOurList.showingChatRooms = true;
          }

          category.showingCreateForm = false;
          category.newRoomName = '';
        }
      } catch (err) {
        console.error("채팅방 생성 중 오류 발생:", err);
        if (err.response && err.response.data) {
          alert(`채팅방 생성 실패: ${err.response.data}`);
        } else {
          alert("채팅방 생성에 실패했습니다. 서버 오류를 확인하세요.");
        }
      }
    }
  },
  mounted() {
    this.fetchCategories();
  }
}
</script>

<style scoped>
/* HomeView.vue의 <style scoped> 부분은 이전 최종본과 동일하게 유지합니다.
   채팅방 인원 수 표시에 대한 스타일만 추가합니다.
*/
/* ... (기존 스타일) ... */
.home {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  text-align: left;
}
h1 {
  text-align: center;
  color: #2c3e50;
  margin-bottom: 30px;
}
h2 {
  border-bottom: 2px solid #42b983;
  padding-bottom: 10px;
  margin-top: 40px;
  margin-bottom: 20px;
  color: #34495e;
}
.category-list {
  list-style-type: none;
  padding: 0;
}
.category-item {
  background-color: #f9f9f9;
  border: 1px solid #eee;
  padding: 20px;
  margin-bottom: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.category-item h3 {
  margin-top: 0;
  color: #42b983;
}
.category-description {
  font-size: 0.9em;
  color: #555;
  margin-bottom: 10px;
}
.action-button {
  padding: 8px 15px;
  cursor: pointer;
  background-color: #5cb85c;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.9em;
}
.action-button:hover {
  background-color: #4cae4c;
}
.loading-message, .no-rooms-message, .no-categories-message, .error-message {
  font-style: italic;
  color: #777;
  margin-top: 10px;
}
.error-message p {
  color: red;
  font-weight: bold;
}
.chatroom-list {
  margin-top: 15px;
  padding-left: 20px;
  list-style-type: disc;
}
.chatroom-item {
  background-color: #f0f0f0;
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
}
.chatroom-item a {
  text-decoration: none;
  color: #337ab7;
  display: flex; /* 인원 수와 이름 정렬을 위해 */
  justify-content: space-between; /* 이름은 왼쪽, 인원수는 오른쪽 */
  align-items: center;
}
.chatroom-item a:hover {
  text-decoration: underline;
}
.room-user-count { /* 채팅방 인원 수 스타일 */
  font-size: 0.85em;
  color: #888;
  margin-left: 10px;
}

.create-room-section {
  margin-top: 15px;
  padding: 15px;
  border: 1px dashed #b4b4b4;
  border-radius: 4px;
  background-color: #fdfdfd;
  margin-bottom: 10px;
}
.create-room-section input[type="text"] {
  margin-right: 10px;
  margin-bottom: 10px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-sizing: border-box;
}
.action-button-small {
  padding: 6px 12px;
  font-size: 0.85em;
  margin-right: 5px;
  margin-top: 5px;
  cursor: pointer;
  color: white;
  border: none;
  border-radius: 4px;
}
.action-button-small.primary {
  background-color: #007bff;
}
.action-button-small.primary:hover {
  background-color: #0056b3;
}
.action-button-small.danger {
  background-color: #dc3545;
}
.action-button-small.danger:hover {
  background-color: #c82333;
}
</style>