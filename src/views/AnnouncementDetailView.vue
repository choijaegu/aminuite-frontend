<template>
  <div class="announcement-detail-view">
    <div v-if="isLoading" class="loading-message">
      <p>공지사항을 불러오는 중입니다...</p>
    </div>
    <div v-else-if="error" class="error-message">
      <p>{{ error }}</p>
      <router-link to="/announcements" class="action-button-small">목록으로 돌아가기</router-link>
    </div>
    <div v-else-if="announcement" class="announcement-content">
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
    <div v-else>
      <p>공지사항을 찾을 수 없습니다.</p>
      <router-link to="/announcements" class="action-button-small">목록으로 돌아가기</router-link>
    </div>
  </div>
</template>

<script>
import apiClient from '@/services/api';

export default {
  name: 'AnnouncementDetailView',
  props: ['id'], // URL 파라미터로 전달된 공지사항 ID
  data() {
    return {
      announcement: null,
      isLoading: true,
      error: null,
    };
  },
  computed: {
    // 관리자 여부 (나중에 수정/삭제 버튼 표시에 사용)
    // isUserAdmin() {
    //   const rolesString = localStorage.getItem('userRoles');
    //   if (rolesString) {
    //     try {
    //       const roles = JSON.parse(rolesString);
    //       return roles.includes('ROLE_ADMIN');
    //     } catch (e) { return false; }
    //   }
    //   return false;
    // },
    formattedContent() {
      // DB에 저장된 내용 중 \n (줄바꿈)을 <br> 태그로 변환하여 HTML에 표시
      if (this.announcement && this.announcement.content) {
        return this.announcement.content.replace(/\n/g, '<br />');
      }
      return '';
    }
  },
  methods: {
    async fetchAnnouncementDetail() {
      this.isLoading = true;
      this.error = null;
      try {
        // 공지사항 상세 API는 permitAll이므로 토큰은 필수는 아님
        // const token = localStorage.getItem('userToken');
        // const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await apiClient.get(`/api/announcements/${this.id}` /*);
        this.announcement = response.data;
        console.log('Fetched announcement detail:', this.announcement);
      } catch (err) {
        console.error("공지사항 상세 정보를 불러오는 중 오류 발생:", err.response || err.message || err);
        this.error = "공지사항 정보를 불러올 수 없습니다.";
        if (err.response) {
          this.error += ` (오류: ${err.response.status} - ${err.response.data.message || err.response.statusText})`;
        }
        this.announcement = null;
      } finally {
        this.isLoading = false;
      }
    },
    formatDateTime(dateTimeString) {
      if (!dateTimeString) return '';
      const date = new Date(dateTimeString);
      return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    },
    // confirmDelete() { // 나중에 삭제 기능 추가 시
    //   if (window.confirm("정말로 이 공지사항을 삭제하시겠습니까?")) {
    //     this.deleteAnnouncement();
    //   }
    // },
    // async deleteAnnouncement() { // 나중에 삭제 기능 추가 시
    //   this.isLoading = true;
    //   const token = localStorage.getItem('userToken');
    //   if (!token) {
    //     alert("삭제 권한이 없습니다. 다시 로그인 해주세요.");
    //     this.$router.push('/login');
    //     return;
    //   }
    //   const headers = { 'Authorization': `Bearer ${token}` };
    //   try {
    //     await apiClient.delete(`http://localhost:8080/api/announcements/${this.id}`, { headers });
    //     alert("공지사항이 삭제되었습니다.");
    //     this.$router.push('/announcements');
    //   } catch (error) {
    //     console.error("공지사항 삭제 실패:", error.response || error.message);
    //     this.error = "공지사항 삭제에 실패했습니다: " + (error.response?.data?.message || error.message);
    //     this.isLoading = false;
    //   }
    // }
  },
  created() {
    this.fetchAnnouncementDetail();
  },
  watch: {
    // 라우트 파라미터 'id'가 변경될 때 (예: 다른 공지사항으로 이동 시) 데이터를 다시 로드
    id(newId) {
      if (newId) {
        this.fetchAnnouncementDetail();
      }
    }
  }
};
</script>

<style scoped>
.announcement-detail-view {
  max-width: 800px;
  margin: 30px auto;
  padding: 30px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}
.header-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.admin-buttons button,
.admin-buttons .action-button-small { /* router-link도 버튼처럼 보이게 */
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
.error-message {
  color: red;
}
.action-button-small { /* 버튼 스타일 재사용 또는 공통화 */
  padding: 8px 15px;
  font-size: 0.9em;
  cursor: pointer;
  border: none;
  border-radius: 4px;
  text-decoration: none;
  display: inline-block;
  color: white;
}
.action-button-small.secondary {
  background-color: #6c757d; /* 회색 계열 */
}
.action-button-small.secondary:hover {
  background-color: #5a6268;
}
.action-button-small.primary { /* 수정 버튼용 */
  background-color: #007bff;
}
.action-button-small.primary:hover {
  background-color: #0056b3;
}
.action-button-small.danger { /* 삭제 버튼용 */
  background-color: #dc3545;
}
.action-button-small.danger:hover {
  background-color: #c82333;
}
</style>