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
        <h3>{{ category.name }} (ID: {{ category.categoryId }})</h3>
        <p class="category-description">{{ category.description }}</p>

        <button @click="fetchChatRooms(category)" class="action-button">
          {{ category.showingChatRooms ? '채팅방 숨기기' : '채팅방 보기' }}
          <span v-if="category.loadingChatRooms"> (불러오는 중...)</span>
        </button>

        <ul v-if="category.showingChatRooms && category.chatRooms && category.chatRooms.length > 0" class="chatroom-list">
          <li v-for="room in category.chatRooms" :key="room.roomId" class="chatroom-item">
            <a :href="`/category/${category.categoryId}/room/${room.roomId}`" @click.prevent="goToChatRoom(category.categoryId, room.roomId)">
              {{ room.name }} (ID: {{ room.roomId }})
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
import axios from 'axios'; // axios를 import 합니다.

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
          chatRooms: category.chatRooms || [], // 백엔드에서 chatRooms를 바로 주면 그것을 사용
          showingChatRooms: false,
          loadingChatRooms: false
        }));
        console.log('Fetched categories:', this.categories);
      } catch (err) {
        console.error("카테고리 목록을 불러오는 중 오류 발생:", err);
        this.error = "카테고리 목록을 불러올 수 없습니다.";
        if (err.response) {
          this.error += ` (서버 응답: ${err.response.status} ${err.response.statusText})`;
        } else if (err.request) {
          this.error += " (서버에서 응답이 없습니다. 백엔드 서버 실행 및 CORS 설정을 확인해주세요.)";
        } else {
          this.error += ` (요청 설정 오류: ${err.message})`;
        }
        this.categories = [];
      } finally {
        this.loadingCategories = false;
      }
    },
    async fetchChatRooms(category) {
      // 이미 로딩 중이거나, 이미 보여주고 있는데 다시 누른 경우 (숨기기 동작)
      if (category.loadingChatRooms) return;
      if (category.showingChatRooms) {
        category.showingChatRooms = false;
        return;
      }

      category.loadingChatRooms = true;
      this.error = null;
      try {
        const response = await axios.get(`http://localhost:8080/api/categories/${category.categoryId}/chatrooms`);
        // Vue는 객체/배열의 변경을 감지하기 위해 참조가 바뀌거나 특정 메소드가 호출되어야 합니다.
        // category.chatRooms = response.data; // 이 방식도 가능
        // 또는 Vue.set(category, 'chatRooms', response.data); // Vue 2 방식
        // Vue 3에서는 프록시 객체이므로 직접 할당해도 반응성을 가집니다.
        const categoryInOurList = this.categories.find(c => c.categoryId === category.categoryId);
        if (categoryInOurList) {
            categoryInOurList.chatRooms = response.data;
            categoryInOurList.showingChatRooms = true;
        }

        console.log(`Workspaceed chat rooms for ${category.categoryId}:`, response.data);
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
    // eslint-disable-next-line no-unused-vars
    goToChatRoom(categoryId, roomId) {
      this.$router.push(`/category/${categoryId}/room/${roomId}`); // <--- 이렇게 수정되어야 합니다!
    }
  },
  mounted() {
    this.fetchCategories();
  }
}
</script>

<style scoped> /* scoped를 추가하여 이 컴포넌트에만 스타일 적용 */
.home {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  text-align: left; /* 내용을 왼쪽 정렬 */
}
h1 {
  text-align: center; /* 제목만 중앙 정렬 */
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
  list-style-type: disc; /* 기본 리스트 스타일 사용 */
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
}
.chatroom-item a:hover {
  text-decoration: underline;
}
</style>