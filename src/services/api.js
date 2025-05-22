import axios from 'axios';

// API 클라이언트 생성
const apiClient = axios.create({
  baseURL: process.env.VUE_APP_API_BASE_URL || 'http://localhost:8080', // 환경 변수 또는 기본값
  // 여기에 다른 기본 axios 설정을 추가할 수 있습니다 (예: timeout)
  // timeout: 10000, // 요청 타임아웃 (10초)
});

// 요청 인터셉터: 모든 요청에 JWT 토큰을 자동으로 추가
apiClient.interceptors.request.use(
  config => {
    const token = localStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// (선택 사항) 응답 인터셉터: 401 오류 발생 시 로그인 페이지로 리다이렉트 등 공통 처리
apiClient.interceptors.response.use(
  response => {
    return response; // 정상 응답은 그대로 반환
  },
  error => {
    if (error.response && error.response.status === 401) {
      // 401 오류 발생 시 (예: 토큰 만료 또는 유효하지 않은 토큰)
      console.error("Authentication Error (401):", error.response.data);
      localStorage.removeItem('userToken'); // 기존 토큰 삭제
      localStorage.removeItem('chatUsername');
      localStorage.removeItem('userRoles');
      localStorage.removeItem('userId');
      // 로그인 페이지로 리다이렉트 (Vue Router 인스턴스 직접 접근은 여기서 어려우므로,
      // 각 컴포넌트나 App.vue에서 이 오류를 잡아서 처리하거나,
      // window.location을 사용할 수 있지만 SPA에서는 권장되지 않음)
      // 지금은 콘솔 에러와 토큰 삭제만 처리
      // alert("인증이 만료되었거나 유효하지 않습니다. 다시 로그인해주세요.");
      // window.location.href = '/login'; // 강제 페이지 이동 (SPA에서는 비추천)
      // Vuex/Pinia를 사용한다면 여기서 로그아웃 액션을 디스패치할 수 있습니다.
    }
    return Promise.reject(error);
  }
);

export default apiClient;