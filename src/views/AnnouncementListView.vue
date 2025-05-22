<template>
  <div class="announcement-list-view">
    <h2>공지사항</h2>

    <div v-if="isLoading" class="loading-message">
      <p>공지사항 목록을 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
    </div>

    <div v-else>
      <div v-if="isUserAdmin" class="admin-actions">
        <router-link to="/announcements/create" class="action-button-small primary">새 공지사항 작성</router-link>
      </div>

      <ul v-if="announcements.length > 0" class="announcement-list">
        <li v-for="announcement in announcements" :key="announcement.id" class="announcement-item">
          <router-link :to="`/announcements/${announcement.id}`" class="announcement-link">
            <h3 class="announcement-title">{{ announcement.title }}</h3>
            <div class="announcement-meta">
              <span class="author">작성자: {{ announcement.author }}</span>
              <span class="date">작성일: {{ formatDateTime(announcement.createdAt) }}</span>
            </div>
          </router-link>
        </li>
      </ul>
      <p v-else class="no-announcements-message">
        등록된 공지사항이 없습니다.
      </p>

      <div v-if="totalPages > 1" class="pagination-controls">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage === 0 || isLoading" class="action-button-small primary">
          이전
        </button>
        <span>
          페이지 {{ currentPage + 1 }} / {{ totalPages }}
        </span>
        <button @click="changePage(currentPage + 1)" :disabled="currentPage >= totalPages - 1 || isLoading" class="action-button-small primary">
          다음
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import apiClient from '@/services/api';

export default {
  name: 'AnnouncementListView',
  data() {
    return {
      announcements: [],
      isLoading: true,
      error: null,
      currentPage: 0,
      totalPages: 0,
      pageSize: 10, // 한 페이지에 보여줄 공지사항 수
    };
  },
  computed: {
    isUserAdmin() {
      // localStorage에 저장된 역할 정보로 관리자 여부 판단 (간단한 방식)
      const rolesString = localStorage.getItem('userRoles');
      if (rolesString) {
        try {
          const roles = JSON.parse(rolesString);
          return roles.includes('ROLE_ADMIN');
        } catch (e) {
          console.error("Error parsing userRoles from localStorage", e);
          return false;
        }
      }
      return false;
    }
  },
  methods: {
    async fetchAnnouncements(page = 0) {
      this.isLoading = true;
      this.error = null;
      try {
        // 공지사항 목록 API는 permitAll 이므로 토큰은 필수는 아니지만,
        // 만약 다른 GET 요청들도 일관되게 토큰을 보내는 정책이라면 추가할 수 있습니다.
        // const token = localStorage.getItem('userToken');
        // const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

        const response = await apiClient.get('/api/announcements', {
          // headers: headers, // 필요시 주석 해제
          params: {
            page: page,
            size: this.pageSize,
            sort: 'createdAt,desc' // 최신 공지가 위로 오도록 정렬
          }
        });
        this.announcements = response.data.content;
        this.currentPage = response.data.number;
        this.totalPages = response.data.totalPages;
        console.log('Fetched announcements (page ' + page + '):', response.data);
      } catch (err) {
        console.error("공지사항 목록을 불러오는 중 오류 발생:", err.response || err.message || err);
        this.error = "공지사항 목록을 불러올 수 없습니다.";
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          this.error += " 접근 권한이 없습니다.";
        }
        this.announcements = []; // 오류 발생 시 목록 비움
      } finally {
        this.isLoading = false;
      }
    },
    formatDateTime(dateTimeString) {
      if (!dateTimeString) return '';
      const date = new Date(dateTimeString);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },
    changePage(newPage) {
      if (newPage >= 0 && newPage < this.totalPages && !this.isLoading) {
        this.fetchAnnouncements(newPage);
      }
    },
    // goToDetail(announcementId) { // <router-link>를 사용하므로 이 메소드는 현재 불필요
    //   this.$router.push(`/announcements/${announcementId}`);
    // },
    // goToCreate() { // <router-link>를 사용하므로 이 메소드는 현재 불필요
    //   this.$router.push('/announcements/create');
    // }
  },
  created() { // 컴포넌트 생성 시 첫 페이지 데이터 로드
    this.fetchAnnouncements(0);
  }
};
</script>

<style scoped>
.announcement-list-view {
  max-width: 800px;
  margin: 20px auto;
  padding: 20px;
}
.announcement-list-view h2 {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
}
.admin-actions {
  text-align: right;
  margin-bottom: 20px;
}
.announcement-list {
  list-style-type: none;
  padding: 0;
}
.announcement-item {
  border: 1px solid #eee;
  border-radius: 5px;
  margin-bottom: 15px;
  transition: box-shadow 0.2s ease-in-out;
}
.announcement-item:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}
.announcement-link {
  display: block;
  padding: 15px 20px;
  text-decoration: none;
  color: inherit;
}
.announcement-title {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 1.2em;
  color: #007bff;
}
.announcement-meta {
  font-size: 0.85em;
  color: #777;
}
.announcement-meta .author {
  margin-right: 15px;
}
.loading-message,
.no-announcements-message,
.error-message {
  text-align: center;
  color: #777;
  padding: 20px;
  font-style: italic;
}
.error-message {
  color: red;
}

.pagination-controls {
  margin-top: 20px;
  text-align: center;
}
.pagination-controls button {
  margin: 0 5px;
}
.pagination-controls span {
  margin: 0 10px;
  vertical-align: middle;
}

/* HomeView에서 가져온 버튼 스타일 (필요시 공통 CSS로 분리) */
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
</style>