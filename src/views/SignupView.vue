<template>
  <div class="signup-view">
    <h2>회원가입</h2>
    <form @submit.prevent="handleSignup" class="signup-form">
      <div class="form-group">
        <label for="username">사용자 아이디:</label>
        <input type="text" id="username" v-model="username" required placeholder="3~20자" />
      </div>
      <div class="form-group">
        <label for="password">비밀번호:</label>
        <input type="password" id="password" v-model="password" required placeholder="6자 이상" />
      </div>
      <div class="form-group">
        <label for="confirmPassword">비밀번호 확인:</label>
        <input type="password" id="confirmPassword" v-model="confirmPassword" required placeholder="비밀번호 다시 입력" />
      </div>
      <div class="form-group">
        <button type="submit" :disabled="isLoading">
          {{ isLoading ? '가입 처리 중...' : '회원가입' }}
        </button>
      </div>
      <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      <p v-if="successMessage" class="success-message">{{ successMessage }}</p>
    </form>
    <p class="login-link">
      이미 계정이 있으신가요? <router-link to="/login">로그인</router-link>
    </p>
  </div>
</template>

<script>
import apiClient from '@/services/api';

export default {
  name: 'SignupView',
  data() {
    return {
      username: '',
      password: '',
      confirmPassword: '',
      isLoading: false,
      errorMessage: '',
      successMessage: '',
    };
  },
  methods: {
    async handleSignup() {
      this.isLoading = true;
      this.errorMessage = '';
      this.successMessage = '';

      if (this.password !== this.confirmPassword) {
        this.errorMessage = '비밀번호가 일치하지 않습니다.';
        this.isLoading = false;
        return;
      }

      // 클라이언트 측 기본 유효성 검사 (백엔드 DTO의 @Size 참고)
      if (this.username.length < 3 || this.username.length > 20) {
        this.errorMessage = '사용자 아이디는 3자 이상 20자 이하로 입력해주세요.';
        this.isLoading = false;
        return;
      }
      if (this.password.length < 6 || this.password.length > 40) {
        this.errorMessage = '비밀번호는 6자 이상 40자 이하로 입력해주세요.';
        this.isLoading = false;
        return;
      }

      try {
        const response = await apiClient.post('api/auth/signup', {
          username: this.username,
          password: this.password,
        });

        console.log('Signup successful:', response.data);
        this.successMessage = (typeof response.data === 'string' && response.data.includes("성공"))
                              ? response.data
                              : '회원가입에 성공했습니다! 로그인 페이지로 이동합니다.';
        this.isLoading = false;

        // 성공 후 입력 필드 초기화
        this.username = '';
        this.password = '';
        this.confirmPassword = '';

        // 몇 초 후 로그인 페이지로 자동 이동
        setTimeout(() => {
          this.$router.push('/login');
        }, 2500); // 2.5초 후 이동

      } catch (error) {
        this.isLoading = false;
        console.error('Signup failed:', error.response || error.message);
        if (error.response && error.response.data) {
          let messageFromServer = error.response.data;
          if (typeof messageFromServer === 'object' && messageFromServer.message) {
            this.errorMessage = messageFromServer.message;
          } else if (typeof messageFromServer === 'string') {
            this.errorMessage = messageFromServer;
          } else {
            this.errorMessage = '회원가입에 실패했습니다. 입력 정보를 확인해주세요.';
          }
        } else {
          this.errorMessage = '회원가입 중 오류가 발생했습니다. 네트워크 연결을 확인해주세요.';
        }
      }
    },
  },
};
</script>

<style scoped>
.signup-view {
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.signup-form .form-group {
  margin-bottom: 20px;
  text-align: left;
}

.signup-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: bold;
  color: #333;
}

.signup-form input[type="text"],
.signup-form input[type="password"] {
  width: 100%;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-sizing: border-box;
}

.signup-form button {
  width: 100%;
  padding: 12px;
  background-color: #28a745; /* Bootstrap success color */
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
  transition: background-color 0.2s;
}

.signup-form button:hover:not(:disabled) {
  background-color: #218838;
}

.signup-form button:disabled {
  background-color: #aaa;
  cursor: not-allowed;
}

.error-message {
  color: red;
  margin-top: 15px;
}
.success-message {
  color: green;
  margin-top: 15px;
}

.login-link {
  margin-top: 25px;
  font-size: 0.9em;
}
.login-link a {
  color: #007bff;
  text-decoration: none;
}
.login-link a:hover {
  text-decoration: underline;
}
</style>