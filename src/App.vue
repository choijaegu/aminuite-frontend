<template>
  <div id="app">
    <nav class="app-nav">
      <div class="nav-left-section">
        <router-link to="/" class="logo-link" title="Aminute 홈으로">
          <svg class="logo-svg" width="130" height="30" viewBox="0 0 130 30" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="23" class="logo-char-a-styled">A</text>
            <line x1="5" y1="14.5" x2="18" y2="13" class="logo-clock-hand"/>
            <text x="26" y="22" class="logo-text-minute">minute</text>
          </svg>
        </router-link>
        <div class="nav-main-links">
          <router-link to="/">홈</router-link>
          <router-link to="/announcements">공지사항</router-link>
          <router-link v-if="!isUserLoggedIn" to="/login">로그인</router-link>
          <router-link v-if="!isUserLoggedIn" to="/signup">회원가입</router-link>
        </div>
      </div>

      <div class="user-actions-section">
        <span v-if="isUserLoggedIn && currentUsername" class="current-app-username">
          <strong>{{ currentUsername }}</strong> 님
        </span>
        <span v-else-if="!isUserLoggedIn" class="current-app-username">
          로그인이 필요합니다.
        </span>
        <button v-if="isUserLoggedIn" @click="promptAndChangeDisplayName" class="action-button-small utility app-nav-item">닉네임 변경</button>
        <a href="#" v-if="isUserLoggedIn" @click.prevent="handleLogout" class="logout-link app-nav-item">로그아웃</a>
      </div>
    </nav>

    <div class="contact-info-bar">
      잠깐! Aminute을 시작하기 전, 공지사항을 읽어주세요!
      문의사항은 <a href="mailto:magic753@naver.com">magic753@naver.com</a>으로 보내주세요.
    </div>

    <router-view @login-success="updateLoginStatusAndUsername" @username-updated="updateGlobalUsername"/>
  </div>
</template>

<script>
// 스크립트 부분은 이전과 동일하게 유지합니다.
export default {
  name: 'App',
  data() {
    return {
      currentUsername: '',
      isUserLoggedIn: false,
    };
  },
  methods: {
    updateLoginStatusAndUsername() {
      console.log('App.vue: updateLoginStatusAndUsername called');
      const token = localStorage.getItem('userToken');
      this.isUserLoggedIn = !!token;
      if (this.isUserLoggedIn) {
        this.currentUsername = localStorage.getItem('chatUsername') || '사용자';
      } else {
        this.currentUsername = '';
      }
      console.log('App.vue - Login Status Updated. Logged In:', this.isUserLoggedIn, 'Username:', this.currentUsername);
    },
    promptAndChangeDisplayName() {
      if (!this.isUserLoggedIn) {
        alert("닉네임을 변경하려면 먼저 로그인해주세요.");
        this.$router.push('/login');
        return;
      }
      const oldDisplayName = localStorage.getItem('chatUsername') || this.currentUsername;
      let newDisplayNamePrompt = prompt("새로운 표시용 닉네임을 입력해주세요 (15자 이내):", oldDisplayName);
      if (newDisplayNamePrompt !== null) {
        let newDisplayName = newDisplayNamePrompt.trim();
        if (newDisplayName === "") {
            alert("닉네임은 비워둘 수 없습니다. 변경이 취소되었습니다.");
            return;
        }
        if (newDisplayName.length > 15) {
          alert("닉네임은 15자 이내로 입력해주세요.");
          return;
        }
        this.currentUsername = newDisplayName;
        localStorage.setItem('chatUsername', this.currentUsername);
        alert(`표시용 닉네임이 '${this.currentUsername}'(으)로 변경되었습니다.`);
      } else {
        alert("닉네임 변경이 취소되었습니다.");
      }
    },
    handleLogout() {
      console.log('App.vue: handleLogout called');
      localStorage.removeItem('userToken');
      localStorage.removeItem('chatUsername');
      localStorage.removeItem('userRoles');
      localStorage.removeItem('userId');
      this.updateLoginStatusAndUsername();
      if (this.$route.meta && this.$route.meta.requiresAuth && this.$route.path !== '/') {
        this.$router.push('/');
      }
      alert('로그아웃 되었습니다.');
    },
    updateGlobalUsername(newUsername) {
      if (this.isUserLoggedIn) {
        this.currentUsername = newUsername;
        localStorage.setItem('chatUsername', newUsername);
      }
    }
  },
  created() {
    this.updateLoginStatusAndUsername();
    window.addEventListener('storage', this.updateLoginStatusAndUsername);
  },
  beforeUnmount() {
    window.removeEventListener('storage', this.updateLoginStatusAndUsername);
  },
};
</script>

<style>
/* #app 스타일은 이전과 동일 */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

/* 네비게이션 바 전체 레이아웃 */
.app-nav {
  padding: 10px 30px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e7e7e7;
  display: flex;
  justify-content: space-between; /* 왼쪽과 오른쪽 섹션을 양 끝으로 분산 */
  align-items: center;
}

/* 왼쪽 섹션 (로고 + 주요 링크) */
.nav-left-section {
  display: flex;
  align-items: center;
}

.logo-link {
  text-decoration: none;
  display: inline-flex; /* SVG 정렬을 위해 inline-flex 사용 */
  align-items: center;
  margin-right: 25px; /* 로고와 다음 링크 그룹 사이 간격 */
}

.logo-svg {
  vertical-align: middle; /* 다른 텍스트와 수직 정렬 */
}

/* SVG 내부 요소 스타일 */
.logo-svg .logo-char-a-styled {
  font-family: 'Arial Black', Gadget, sans-serif; /* 좀 더 두껍고 개성있는 폰트 */
  font-size: 25px; /* 크기 조절 */
  font-weight: bold;
  fill: #007BFF; /* 메인 색상 */
}
.logo-svg .logo-clock-hand {
  stroke: #0056b3; /* A 내부 선 색상 */
  stroke-width: 2.5;
  stroke-linecap: round;
}
.logo-svg .logo-text-minute {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 21px;
  fill: #2c3e50; /* 나머지 텍스트 색상 */
  dominant-baseline: central; /* 수직 정렬 */
  letter-spacing: -0.5px; /* 자간 약간 조절 */
}


/* 주요 네비게이션 링크 그룹 */
.nav-main-links a {
  font-weight: bold;
  color: #2c3e50;
  margin-right: 15px;
  text-decoration: none;
  cursor: pointer;
}
.nav-main-links a.router-link-exact-active {
  color: #42b983; /* 활성 링크 색상 */
}

/* 오른쪽 사용자 정보 및 액션 섹션 */
.user-actions-section {
  display: flex;
  align-items: center;
}

.current-app-username {
  font-size: 0.9em;
  color: #333;
  margin-right: 10px;
}
.current-app-username strong {
    color: #007bff;
}

.app-nav-item { /* 닉네임 변경 버튼, 로그아웃 링크 등 오른쪽 아이템 간 간격 */
  margin-left: 10px;
}

.user-actions-section .action-button-small.utility {
  padding: 6px 10px;
  font-size: 0.85em;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: #fff;
  color: #333;
}
.user-actions-section .action-button-small.utility:hover {
  background-color: #f0f0f0;
}

.logout-link.app-nav-item {
  font-weight: bold;
  color: #007bff;
  text-decoration: none;
  padding: 6px 0; /* 버튼과 높이감을 유사하게 */
}
.logout-link.app-nav-item:hover {
  text-decoration: underline;
  color: #dc3545;
}

/* 문의 안내 바 스타일은 이전과 동일 */
.contact-info-bar {
  background-color: #e9ecef;
  color: #495057;
  padding: 8px 30px;
  text-align: center;
  font-size: 0.9em;
  border-bottom: 1px solid #dee2e6;
}
.contact-info-bar a {
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}
.contact-info-bar a:hover {
  text-decoration: underline;
}
</style>