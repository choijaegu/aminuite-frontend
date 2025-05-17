<template>
  <div id="app">
    <nav class="app-nav">
      <div class="nav-links">
        <router-link to="/">홈 (카테고리 목록)</router-link>
        </div>
      <div class="user-nickname-section">
        <span v-if="currentUsername" class="current-app-username">
          현재 닉네임: <strong>{{ currentUsername }}</strong>
        </span>
        <span v-else class="current-app-username">
          닉네임 미설정 (채팅방 첫 입장 시 설정)
        </span>
        <button @click="promptAndChangeUsername" class="action-button-small utility">닉네임 변경</button>
        </div>
    </nav>
    <router-view @username-updated="updateGlobalUsername"/>
    </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      currentUsername: localStorage.getItem('chatUsername') || ''
    };
  },
  methods: {
    // ChatRoomView에서 가져온 닉네임 초기화/설정 로직
    initializeOrUpdateUsername() {
      let storedUsername = localStorage.getItem('chatUsername');
      if (!this.currentUsername && !storedUsername) { // App 로드 시 currentUsername과 localStorage 모두 없을 때만 prompt
        storedUsername = prompt("환영합니다! 사용하실 닉네임을 입력해주세요 (15자 이내, 취소 시 '익명'으로 자동 생성):", "익명" + Math.floor(Math.random() * 10000));
        if (!storedUsername || storedUsername.trim() === "") {
          storedUsername = "익명" + Math.floor(Math.random() * 10000);
        } else if (storedUsername.trim().length > 15) {
            alert("닉네임은 15자 이내로 입력해주세요. '익명'으로 자동 생성됩니다.");
            storedUsername = "익명" + Math.floor(Math.random() * 10000);
        }
        localStorage.setItem('chatUsername', storedUsername.trim());
      }
      this.currentUsername = localStorage.getItem('chatUsername') || ("익명" + Math.floor(Math.random() * 10000)); // 항상 최신값 반영
      console.log('App.vue - Username set to/updated to:', this.currentUsername);
    },
    // 닉네임 변경 로직
    promptAndChangeUsername() {
      const oldUsername = this.currentUsername || "익명";
      let newUsernamePrompt = prompt("새로운 닉네임을 입력해주세요 (15자 이내):", oldUsername);

      if (newUsernamePrompt) {
        let newUsername = newUsernamePrompt.trim();
        if (newUsername === "") {
            alert("닉네임은 비워둘 수 없습니다. 변경이 취소되었습니다.");
            return;
        }
        if (newUsername.length > 15) {
          alert("닉네임은 15자 이내로 입력해주세요.");
          return;
        }
        // 현재 닉네임과 같더라도, localStorage에 없던 상태에서 입력한 경우를 위해 저장
        // if (newUsername === oldUsername && this.currentUsername !== '') {
        //   alert("현재 닉네임과 동일합니다.");
        //   return;
        // }

        this.currentUsername = newUsername;
        localStorage.setItem('chatUsername', this.currentUsername);
        alert(`닉네임이 '${this.currentUsername}'(으)로 설정/변경되었습니다.`);
        // ChatRoomView가 열려있을 경우, 해당 컴포넌트가 localStorage를 다시 읽도록 하거나
        // Event Bus 등으로 변경 사실을 알려야 실시간으로 반영됩니다.
        // 지금은 페이지 이동/새로고침 시 반영됩니다.
      } else {
        alert("닉네임 변경/설정이 취소되었습니다.");
      }
    },
    updateGlobalUsername(newUsername) { // (선택적 고급 기능) 자식 컴포넌트에서 닉네임 변경 시 호출용
        this.currentUsername = newUsername;
    }
  },
  mounted() {
    this.initializeOrUpdateUsername();
    // 주기적으로 localStorage를 체크하거나, window.addEventListener('storage', ...)를 사용하여
    // 다른 탭에서 localStorage 변경 시 currentUsername을 업데이트할 수 있습니다. (고급)
  },
  watch: {
    // Vue Router를 통해 URL이 변경될 때마다 localStorage의 닉네임을 다시 읽어 currentUsername을 업데이트 (선택적)
    // '$route'() {
    //   this.currentUsername = localStorage.getItem('chatUsername') || '';
    //   if (!this.currentUsername) {
    //      this.initializeOrUpdateUsername(); // URL 변경 시에도 닉네임 없으면 설정 유도
    //   }
    // }
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}

.app-nav {
  padding: 15px 30px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #e7e7e7;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.app-nav .nav-links a {
  font-weight: bold;
  color: #2c3e50;
  margin-right: 15px;
  text-decoration: none;
}

.app-nav .nav-links a.router-link-exact-active {
  color: #42b983;
}

.user-nickname-section {
  display: flex;
  align-items: center;
}

.current-app-username {
  font-size: 0.9em;
  color: #333;
  margin-right: 10px;
}
.current-app-username strong {
    color: #007bff; /* 닉네임 강조 색상 */
}

.user-nickname-section .action-button-small {
  padding: 6px 10px;
  font-size: 0.85em;
  cursor: pointer;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: #fff;
  color: #333;
}
.user-nickname-section .action-button-small:hover {
  background-color: #f0f0f0;
}
</style>