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

        <button @click="handleFetchChatRooms(category)" class="action-button">
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

        <div v-if="category.showingChatRooms">
          <ul v-if="category.chatRooms && category.chatRooms.length > 0" class="chatroom-list">
            <li v-for="room in category.chatRooms" :key="room.roomId" class="chatroom-item">
              <a :href="`/category/${category.categoryId}/room/${room.roomId}`" @click.prevent="goToChatRoom(category.categoryId, room.roomId)">
                {{ room.name }}
                <span v-if="room.currentUserCount !== undefined" class="room-user-count"> ({{ room.currentUserCount }}명)</span>
              </a>
            </li>
          </ul>
          <p v-if="category.chatRooms && category.chatRooms.length === 0 && !category.loadingChatRooms" class="no-rooms-message">
            이 카테고리에는 아직 채팅방이 없습니다.
          </p>

          <div v-if="category.chatRoomsTotalPages > 1" class="pagination-controls">
            <button
              @click="changeChatRoomPage(category, category.chatRoomsCurrentPage - 1)"
              :disabled="category.chatRoomsCurrentPage === 0 || category.loadingChatRooms"
              class="action-button-small primary">
              이전
            </button>
            <span>
              페이지 {{ category.chatRoomsCurrentPage + 1 }} / {{ category.chatRoomsTotalPages }}
            </span>
            <button
              @click="changeChatRoomPage(category, category.chatRoomsCurrentPage + 1)"
              :disabled="category.chatRoomsCurrentPage >= category.chatRoomsTotalPages - 1 || category.loadingChatRooms"
              class="action-button-small primary">
              다음
            </button>
          </div>
        </div>
      </li>
    </ul>
    <p v-else class="no-categories-message">
      생성된 카테고리가 없습니다. (백엔드에서 카테고리를 먼저 생성해주세요!)
    </p>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'HomeView',
  data() {
    return {
      categories: [],
      loadingCategories: true,
      error: null,
    };
  },
  methods: {
    async fetchCategories() {
      this.loadingCategories = true;
      this.error = null;
      try {
        const token = localStorage.getItem('userToken');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await axios.get('http://localhost:8080/api/categories', { headers });

        this.categories = response.data.map(category => ({
          ...category,
          chatRooms: [],
          showingChatRooms: false,
          loadingChatRooms: false,
          showingCreateForm: false,
          newRoomName: '',
          chatRoomsCurrentPage: 0,
          chatRoomsTotalPages: 0,
          chatRoomsPageSize: 5,
          chatRoomsTotalElements: 0,
        }));
        console.log('Fetched categories:', this.categories);
      } catch (err) {
        console.error("카테고리 목록을 불러오는 중 오류 발생:", err.response || err.message || err);
        this.error = "카테고리 목록을 불러올 수 없습니다.";
        if (err.response) {
          this.error += ` (서버 응답: ${err.response.status} ${err.response.statusText})`;
          if (err.response.status === 401) {
            this.error += " - 로그인이 필요합니다.";
          }
        } else if (err.request) {
          this.error += " (서버 응답 없음)";
        } else {
          this.error += ` (요청 설정 오류)`;
        }
        this.categories = [];
      } finally {
        this.loadingCategories = false;
      }
    },
    handleFetchChatRooms(category) {
      if (category.showingChatRooms && !category.loadingChatRooms) {
        category.showingChatRooms = false;
      } else if (!category.showingChatRooms && !category.loadingChatRooms) {
        this.fetchChatRooms(category, 0);
      }
    },
    async fetchChatRooms(category, page = 0) {
      category.loadingChatRooms = true;
      try {
        const token = localStorage.getItem('userToken');
        const headers = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        const response = await axios.get(
          `http://localhost:8080/api/categories/${category.categoryId}/chatrooms`,
          {
            headers: headers,
            params: {
              page: page,
              size: category.chatRoomsPageSize,
              sort: 'createdAt,desc'
            }
          }
        );
        category.chatRooms = response.data.content;
        category.chatRoomsCurrentPage = response.data.number;
        category.chatRoomsTotalPages = response.data.totalPages;
        category.chatRoomsTotalElements = response.data.totalElements;
        category.showingChatRooms = true;
        console.log(`Workspaceed page ${page} for category ${category.name}:`, response.data);
      } catch (err) {
        console.error(`채팅방 목록(page: ${page}, category: ${category.name})을 불러오는 중 오류 발생:`, err.response || err.message || err);
        alert(`${category.name} 카테고리의 채팅방 목록(페이지 ${page + 1})을 불러올 수 없습니다. (오류: ${err.response ? err.response.status : err.message})`);
        if (err.response && err.response.status === 401) {
           // this.$router.push('/login');
        }
        category.showingChatRooms = false;
      } finally {
        category.loadingChatRooms = false;
      }
    },
    changeChatRoomPage(category, newPage) {
      if (newPage >= 0 && newPage < category.chatRoomsTotalPages && !category.loadingChatRooms) {
        this.fetchChatRooms(category, newPage);
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
      const token = localStorage.getItem('userToken');
      if (!token) {
        alert("채팅방을 생성하려면 로그인이 필요합니다.");
        if (this.$router) this.$router.push('/login');
        return;
      }

      // localStorage에서 로그인 시 저장된 사용자 이름(방장 정보)을 가져옵니다.
      let ownerUsername = localStorage.getItem('chatUsername');

      // ownerUsername이 실제로 존재하는지, 비어있지 않은지 확인합니다.
      if (!ownerUsername) {
          alert("오류: 방 생성자 닉네임 정보를 찾을 수 없습니다. 다시 로그인 해주세요.");
          // 이 문제가 발생한다면, LoginView.vue에서 로그인 성공 시
          // localStorage.setItem('chatUsername', response.data.username); 코드가
          // 정상적으로 실행되었는지 확인해야 합니다.
          if (this.$router) this.$router.push('/login');
          return;
      }

      // payload 객체에 name과 ownerUsername을 모두 포함시킵니다.
      const payload = {
        name: category.newRoomName.trim(),
        ownerUsername: ownerUsername // <<--- 이 부분이 백엔드 요구사항에 맞게 포함되도록 수정!
      };

      const headers = {
        'Authorization': `Bearer ${token}`
      };

      console.log("채팅방 생성 요청 페이로드:", payload); // 실제로 보내는 payload 확인용 로그

      try {
        const response = await axios.post(
          `http://localhost:8080/api/categories/${category.categoryId}/chatrooms`,
          payload, // 수정된 payload 전달
          { headers: headers }
        );

        if (response.status === 201) {
          alert(`'${payload.name}' 채팅방이 성공적으로 생성되었습니다! (ID: ${response.data.roomId})`);
          this.fetchChatRooms(category, 0); // 목록 새로고침
          category.showingCreateForm = false;
          category.newRoomName = '';
        }
      } catch (err) {
        console.error("채팅방 생성 중 오류 발생 (프론트엔드):", err.response || err.message || err);
        if (err.response) {
          if (err.response.status === 401) {
            alert("채팅방 생성 권한이 없습니다. 로그인 상태를 확인해주세요.");
            if (this.$router) this.$router.push('/login');
          } else if (err.response.data) {
            // 서버에서 오는 구체적인 400 오류 메시지 등을 여기서 확인할 수 있습니다.
            const serverErrorMessage = (typeof err.response.data === 'string') ? err.response.data : (err.response.data.message || JSON.stringify(err.response.data));
            alert(`채팅방 생성 실패: ${serverErrorMessage}`);
          } else {
            alert("채팅방 생성에 실패했습니다. 서버 오류를 확인하세요.");
          }
        } else if (err.request) {
          alert("채팅방 생성 요청 중 서버로부터 응답을 받지 못했습니다.");
        } else {
          alert("채팅방 생성 요청 설정 중 오류가 발생했습니다.");
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
/* 기존 스타일과 동일하게 유지합니다. */
/* ... (이전 답변에서 제공된 전체 <style> 내용을 여기에 붙여넣으시면 됩니다.) ... */
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
  margin-bottom: 10px;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chatroom-item a:hover {
  text-decoration: underline;
}
.room-user-count {
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
  color: white;
}
.action-button-small.primary:hover:not(:disabled) {
  background-color: #0056b3;
}
.action-button-small.primary:disabled {
  background-color: #b0c4de;
  color: #777777;
  cursor: not-allowed;
}
.action-button-small.danger {
  background-color: #dc3545;
}
.action-button-small.danger:hover:not(:disabled) {
  background-color: #c82333;
}
.action-button-small:disabled {
  background-color: #cccccc;
  color: #666666;
  cursor: not-allowed;
}
.pagination-controls {
  margin-top: 15px;
  text-align: center;
}
.pagination-controls button {
  margin: 0 5px;
}
.pagination-controls span {
  margin: 0 10px;
  vertical-align: middle;
}
</style>