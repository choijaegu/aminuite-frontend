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
      <p>잠깐! Aminute을 시작하기 전, 공지사항을 읽어주세요!</p>
      <p>문의사항은 <a href="mailto:magic753@naver.com">magic753@naver.com</a>으로 보내주세요.</p>
    </div>

    <router-view @login-success="updateLoginStatusAndUsername" @username-updated="updateGlobalUsername"/>
  </div>
</template>

<script>
// 스크립트 부분은 이전 답변과 동일하게 유지합니다.
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
/* 기존 #app, .contact-info-bar 등 전역 스타일 유지 */
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

.app-nav {
  padding: 10px 20px; /* 모바일을 위해 패딩 약간 조정 */
  background-color: #f8f9fa;
  border-bottom: 1px solid #e7e7e7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap; /* 모바일에서 공간 부족 시 줄바꿈 허용 */
}

.nav-left-section {
  display: flex;
  align-items: center;
  flex-wrap: nowrap; /* 로고와 링크는 한 줄에 유지 시도 */
}

.logo-link {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  margin-right: 15px; /* 로고와 다음 링크 그룹 사이 간격 */
}

.logo-svg {
  vertical-align: middle;
  height: 24px; /* SVG 높이 고정 (너비는 비율에 맞게) */
  width: auto;
}
.logo-svg .logo-char-a-styled {
  font-family: 'Arial Black', Gadget, sans-serif;
  font-size: 23px; /* 약간 줄임 */
  font-weight: bold;
  fill: #007BFF;
}
.logo-svg .logo-clock-hand {
  stroke: #0056b3;
  stroke-width: 2.2px; /* 약간 줄임 */
  stroke-linecap: round;
}
.logo-svg .logo-text-minute {
  font-family: Arial, Helvetica, sans-serif;
  font-size: 19px; /* 약간 줄임 */
  fill: #2c3e50;
  dominant-baseline: central;
  letter-spacing: -0.5px;
}

.nav-main-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap; /* 모바일에서 링크들이 많으면 줄바꿈 허용 */
}
.nav-main-links a {
  font-weight: bold;
  color: #2c3e50;
  margin-right: 10px; /* 링크 간 간격 조정 */
  text-decoration: none;
  cursor: pointer;
  padding: 5px 0; /* 상하 패딩으로 클릭 영역 확보 */
}
.nav-main-links a:last-child {
  margin-right: 0;
}
.nav-main-links a.router-link-exact-active {
  color: #42b983;
}

.user-actions-section {
  display: flex;
  align-items: center;
  margin-left: auto; /* 왼쪽 요소들 외에 오른쪽 끝으로 밀기 (flex-wrap 시 필요) */
  flex-shrink: 0; /* 줄어들지 않도록 */
}

.current-app-username {
  font-size: 0.85em; /* 약간 줄임 */
  color: #333;
  margin-right: 8px;
  white-space: nowrap; /* 줄바꿈 방지 */
}
.current-app-username strong {
  color: #007bff;
}

.app-nav-item {
  margin-left: 8px; /* 아이템 간 간격 */
}
.user-actions-section .action-button-small.utility,
.logout-link.app-nav-item {
  padding: 5px 8px; /* 버튼/링크 패딩 조정 */
  font-size: 0.8em; /* 버튼/링크 폰트 크기 조정 */
  white-space: nowrap;
}
.logout-link.app-nav-item {
  color: #007bff;
  border: 1px solid transparent; /* 다른 버튼과 유사하게 보이도록 */
  background-color: transparent;
  border-radius: 4px;
}
.logout-link.app-nav-item:hover {
  text-decoration: none;
  background-color: #f0f0f0;
  color: #dc3545;
}

.contact-info-bar {
  background-color: #e9ecef;
  color: #495057;
  padding: 8px 20px; /* 패딩 조정 */
  text-align: center;
  font-size: 0.85em; /* 약간 줄임 */
  border-bottom: 1px solid #dee2e6;
}
.contact-info-bar p {
  margin: 3px 0; /* 문단 간격 조절 */
}
.contact-info-bar a {
  color: #007bff;
  text-decoration: none;
  font-weight: bold;
}
.contact-info-bar a:hover {
  text-decoration: underline;
}


/* --- 모바일 화면을 위한 미디어 쿼리 --- */
@media (max-width: 768px) { /* 일반적인 태블릿 화면 너비 기준 */
  .app-nav {
    flex-direction: column; /* 네비게이션 바 요소들을 세로로 쌓음 */
    padding: 10px 15px; /* 모바일 패딩 조정 */
  }

  .nav-left-section {
    width: 100%;
    justify-content: space-between; /* 로고와 주 링크들을 양쪽으로 분산 */
    margin-bottom: 10px; /* 아래 사용자 섹션과의 간격 */
  }

  .logo-link {
    margin-right: 10px; /* 오른쪽 링크와의 간격 */
  }
  .logo-svg {
    height: 22px; /* 모바일에서 로고 살짝 더 작게 */
  }
  .logo-svg .logo-char-a-styled { font-size: 21px; }
  .logo-svg .logo-text-minute { font-size: 17px; }
  .logo-svg .logo-clock-hand { stroke-width: 2; }


  .nav-main-links {
    justify-content: flex-start; /* 링크들을 왼쪽부터 나열 */
    /* 만약 링크가 너무 많아 한 줄에 다 안들어가면, 여기서 추가적인 스타일링 필요 */
    /* 예: 숨기거나, 햄버거 메뉴로 대체 */
  }
  .nav-main-links a {
    margin-right: 8px; /* 모바일에서 링크 간격 */
    font-size: 0.9em; /* 링크 글자 크기 */
  }

  .user-actions-section {
    width: 100%;
    justify-content: center; /* 사용자 정보/액션 중앙 정렬 */
    margin-left: 0; /* 왼쪽 자동 마진 제거 */
    margin-top: 5px; /* 위쪽 요소와의 간격 */
  }
  .current-app-username {
    margin-right: 5px;
  }
  .app-nav-item {
    margin-left: 5px;
  }
}

@media (max-width: 480px) { /* 더 작은 모바일 화면 */
  .nav-main-links {
    /* 링크가 많을 경우, 이 너비에서는 일부만 보이게 하거나 스크롤, 또는 햄버거 메뉴 고려 */
    /* 우선은 글자 크기만 더 줄여봄 */
    font-size: 0.9em;
  }
  .nav-main-links a {
    padding: 5px;
    margin-right: 5px;
  }
  .logo-svg {
    height: 20px; /* 더 작은 화면에서 로고 더 작게 */
  }
  .logo-svg .logo-char-a-styled { font-size: 19px; }
  .logo-svg .logo-text-minute { font-size: 15px; }

  .user-actions-section .action-button-small.utility,
  .logout-link.app-nav-item {
    padding: 4px 6px;
    font-size: 0.75em;
  }
  .contact-info-bar {
    font-size: 0.8em;
    padding: 6px 15px;
  }
  .contact-info-bar p {
    margin: 2px 0;
  }
}
</style>