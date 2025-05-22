<template>
  <div class="login-view">
    <h2>로그인</h2>
    <form @submit.prevent="handleLogin" class="login-form">
      <div class="form-group">
        <label for="username">사용자 아이디:</label>
        <input type="text" id="username" v-model="username" required />
      </div>
      <div class="form-group">
        <label for="password">비밀번호:</label>
        <input type="password" id="password" v-model="password" required />
      </div>
      <div class="form-group">
        <button type="submit" :disabled="isLoading">
          {{ isLoading ? '로그인 중...' : '로그인' }}
        </button>
      </div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
    </form>
    <p class="signup-link">
      계정이 없으신가요? <router-link to="/signup">회원가입</router-link>
    </p>
  </div>
</template>

<script>
import apiClient from '@/services/api';

export default {
  name: 'LoginView',
  data() {
    return {
      username: '',
      password: '',
      isLoading: false,
      errorMessage: '',
    };
  },
  methods: {
    async handleLogin() {
      this.isLoading = true;
      this.errorMessage = ''; // 이전 에러 메시지 초기화

      try {
        const response = await apiClient.post('/api/auth/signin', {
          username: this.username,
          password: this.password,
        });

        console.log('Login successful:', response.data);

        // JWT 토큰과 사용자 정보 저장
        localStorage.setItem('userToken', response.data.token);
        localStorage.setItem('chatUsername', response.data.username);
        if (response.data.roles) {
          localStorage.setItem('userRoles', JSON.stringify(response.data.roles));
        }
        if (response.data.id) {
            localStorage.setItem('userId', response.data.id);
        }

        this.isLoading = false;

        // App.vue로 이벤트 발생시켜 UI 즉시 업데이트 유도
        this.$emit('login-success'); // << 로그인 성공 이벤트 발생!
        console.log('LoginView.vue: Emitted login-success event');


        // 로그인 성공 후 홈 페이지 또는 대시보드로 리다이렉트
        this.$router.push('/'); // 홈으로 이동

      } catch (error) {
        this.isLoading = false;
        console.error('Login failed:', error.response || error.message);
        if (error.response && error.response.data) {
          let messageFromServer = error.response.data;
          if (typeof messageFromServer === 'object' && messageFromServer.message) {
            this.errorMessage = messageFromServer.message;
          } else if (typeof messageFromServer === 'string') {
            this.errorMessage = messageFromServer;
          } else {
            this.errorMessage = '로그인에 실패했습니다. 아이디 또는 비밀번호를 확인해주세요.';
          }
          if (error.response.status === 401) {
             this.errorMessage = '아이디 또는 비밀번호가 올바르지 않습니다.';
          }
        } else {
          this.errorMessage = '로그인 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.';
        }
      }
    },
  },
};
</script>

<style scoped>
.login-view {
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.login-form .form-group {
  margin-bottom: 20px;
  text-align: left;
}

.login-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.login-form input[type="text"],
.login-form input[type="password"] {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.login-form button {
  width: 100%;
  padding: 12px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.login-form button:hover {
  background-color: #0056b3;
}

.login-form button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.error-message {
  color: red;
  margin-top: 15px;
}

.signup-link {
  margin-top: 25px;
  font-size: 0.9em;
}
.signup-link a {
  color: #007bff;
  text-decoration: none;
}
.signup-link a:hover {
  text-decoration: underline;
}
</style>