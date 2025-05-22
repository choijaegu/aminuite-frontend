<template>
  <div class="announcement-detail-view">
    <div v-if="isLoading" class="loading-message">
      <p>공지사항을 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <router-link to="/announcements" class="action-button-small secondary">목록으로 돌아가기</router-link>
    </div>
    <div v-else-if="announcement" class="announcement-content-wrapper">
      <div class="header-actions">
        <router-link to="/announcements" class="action-button-small secondary">목록으로</router-link>
        </div>
      <h1 class="title">{{ announcement.title }}</h1>
      <div class="meta-info">
        <span class="author">작성자: {{ announcement.author }}</span>
        <span class="date">작성일: {{ formatDateTime(announcement.createdAt) }}</span>
        <span v-if="announcement.createdAt !== announcement.updatedAt" class="date">
          (수정일: {{ formatDateTime(announcement.updatedAt) }})
        </span>
      </div>
      <hr class="divider" />
      <div class="content-body" v-html="formattedContent"></div>
    </div>
    <div v-else class="no-data-message"> {/* 클래스명 추가 및 메시지 명확화 */}
      <p>해당 ID의 공지사항을 찾을 수 없습니다.</p>
      <router-link to="/announcements" class="action-button-small secondary">목록으로 돌아가기</router-link>
    </div>
  </div>
</template>

<script>
import apiClient from '@/services/api'; // axios 대신 apiClient 사용

export default {
  name: 'AnnouncementDetailView',
  props: ['id'], // URL 파라미터로 전달된 공지사항 ID
  data() {
    return {
      announcement: null, // 초기값을 null로 명확히
      isLoading: true,
      error: null,
    };
  },
  computed: {
    // isUserAdmin() { // 관리자 여부 (나중에 수정/삭제 버튼 표시에 사용)
    //   const rolesString = localStorage.getItem('userRoles');
    //   if (rolesString) {
    //     try {
    //       const roles = JSON.parse(rolesString);
    //       return roles.includes('ROLE_ADMIN');
    //     } catch (e) {
    //       console.error("Error parsing userRoles from localStorage in AnnouncementDetailView", e);
    //       return false;
    //     }
    //   }
    //   return false;
    // },
    formattedContent() {
      // this.announcement가 null이거나, this.announcement.content가 없을 경우 빈 문자열 반환
      if (this.announcement && typeof this.announcement.content === 'string') {
        return this.announcement.content.replace(/\n/g, '<br />');
      }
      return ''; // announcement가 null이거나 content가 없을 때 빈 문자열 반환
    }
  },
  methods: {
    async fetchAnnouncementDetail() {
      this.isLoading = true;
      this.error = null;
      this.announcement = null; // 데이터를 새로 가져오기 전에 이전 데이터 초기화

      try {
        // 공지사항 상세 API는 SecurityConfig에서 GET /api/announcements/* 에 대해 permitAll()로 설정했으므로,
        // apiClient의 요청 인터셉터가 토큰을 보내더라도 서버에서 인증을 요구하지 않습니다.
        // 만약 이 경로가 인증을 요구한다면, apiClient 인터셉터가 자동으로 토큰을 추가해줍니다.
        const response = await apiClient.get(`/api/announcements/${this.id}`);
        this.announcement = response.data;
        console.log('Fetched announcement detail:', this.announcement);
      } catch (err) {
        console.error("공지사항 상세 정보를 불러오는 중 오류 발생:", err.response || err.message || err);
        this.error = "공지사항 정보를 불러올 수 없습니다.";
        if (err.response) {
          this.error += ` (오류: ${err.response.status} - ${err.response.data ? (err.response.data.message || JSON.stringify(err.response.data)) : err.response.statusText})`;
        }
        // this.announcement는 이미 null로 초기화됨
      } finally {
        this.isLoading = false;
      }
    },
    formatDateTime(dateTimeString) {
      if (!dateTimeString) return '';
      const date = new Date(dateTimeString);
      // 간단한 날짜 포맷팅, 필요시 toLocaleString 등 사용 가능
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },
    // confirmDelete() { ... } // 삭제 기능은 현재 주석 처리
    // async deleteAnnouncement() { ... } // 삭제 기능은 현재 주석 처리
  },
  created() {
    if (this.id) { // id prop이 있을 때만 데이터 가져오기
        this.fetchAnnouncementDetail();
    } else {
        this.error = "공지사항 ID가 제공되지 않았습니다.";
        this.isLoading = false;
    }
  },
  watch: {
    // 라우트 파라미터 'id'가 변경될 때 (예: 브라우저 뒤로가기/앞으로가기로 다른 공지사항 상세로 이동 시) 데이터를 다시 로드
    id(newId, oldId) {
      if (newId && newId !== oldId) { // newId가 유효하고 이전 id와 다를 때만
        this.fetchAnnouncementDetail();
      }
    }
  }
};
</script>

<style scoped>
/* 스타일 부분은 이전 답변과 거의 동일합니다. */
.announcement-detail-view {
  max-width: 800px;
  margin: 30px auto;
  padding: 30px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.announcement-content-wrapper { /* v-else-if="announcement" 블록에 적용할 클래스 */
  /* 필요한 경우 여기에 스타일 추가 */
}
.no-data-message { /* 공지사항 없을 때 메시지 스타일 */
  text-align: center;
  padding: 20px;
  font-style: italic;
  color: #777;
}
.header-actions {
  display: flex;
  justify-content: space-between; /* 목록으로 버튼과 관리자 버튼 영역 분리 */
  align-items: center;
  margin-bottom: 20px;
}
.admin-buttons button,
.admin-buttons .action-button-small {
  margin-left: 10px;
}
.title {
  font-size: 2em;
  margin-bottom: 15px;
  color: #333;
  line-height: 1.3;
}
.meta-info {
  font-size: 0.9em;
  color: #777;
  margin-bottom: 20px;
}
.meta-info .author {
  margin-right: 15px;
}
.meta-info .date {
  margin-right: 15px;
}
.divider {
  border: 0;
  border-top: 1px solid #eee;
  margin: 25px 0;
}
.content-body {
  font-size: 1.1em;
  line-height: 1.8;
  color: #444;
  white-space: pre-wrap; /* \n을 통한 줄바꿈 및 공백 유지, 자동 줄바꿈도 적용 */
}
.loading-message,
.error-message {
  text-align: center;
  padding: 20px;
  font-style: italic;
}
.error-message { /* 오류 메시지 스타일 */
  color: red;
  /* display: flex; */ /* 필요시 버튼과 함께 정렬 */
  /* flex-direction: column; */
  /* align-items: center; */
}
.error-message p {
    margin-bottom: 10px;
}

.action-button-small {
  padding: 8px 15px;
  font-size: 0.9em;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  text-decoration: none;
  display: inline-block;
  color: white;
  transition: background-color 0.2s;
}
.action-button-small.secondary {
  background-color: #6c757d;
}
.action-button-small.secondary:hover {
  background-color: #5a6268;
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