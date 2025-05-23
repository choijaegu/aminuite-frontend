const { defineConfig } = require('@vue/cli-service'); // 세미콜론 추가 (선택 사항이지만 권장)

module.exports = defineConfig({
  transpileDependencies: true,
  pluginOptions: {
    sitemap: {
      baseURL: 'https://aminute.onrender.com', // <<--- 사용자님의 실제 프론트엔드 서비스 URL로 정확히!
      routes: [
        { path: '/', changefreq: 'daily', priority: 1.0 },
        { path: '/login', changefreq: 'monthly', priority: 0.8, meta: { sitemap: { ignoreRoute: true } } }, // 로그인 페이지는 SEO에서 제외 고려
        { path: '/signup', changefreq: 'monthly', priority: 0.8, meta: { sitemap: { ignoreRoute: true } } }, // 회원가입 페이지도 SEO에서 제외 고려
        { path: '/announcements', changefreq: 'weekly', priority: 0.9 },
        // 여기에 CategoryChatRoomsView.vue 에 대한 정적 경로들도 추가할 수 있습니다.
        // 예: DataInitializer로 생성한 categoryId들을 기반으로
        { path: '/category/politics', changefreq: 'weekly', priority: 0.7 },
        { path: '/category/game', changefreq: 'weekly', priority: 0.7 },
        { path: '/category/sports', changefreq: 'weekly', priority: 0.7 },
        // 동적 경로(예: /announcements/:id, /category/:categoryId/room/:roomId)를 위한 추가 설정은
        // vue-cli-plugin-sitemap 문서나 고급 옵션을 참고해야 합니다.
        // API를 호출하여 동적 URL 목록을 가져와 routes 배열에 추가하는 스크립트를 작성할 수도 있습니다.
        // 지금은 우선 주요 정적 경로들만 포함합니다.
      ],
      // (선택 사항) 동적 라우트나 특정 라우트를 제외하고 싶을 때
      // filter Podczas: (route) => {
      //   // 예: '/admin'으로 시작하는 경로는 사이트맵에서 제외
      //   if (route.path.startsWith('/admin')) {
      //     return false;
      //   }
      //   return true;
      // },
      // (선택 사항) API를 호출하여 동적 URL 목록을 가져오는 함수 (고급)
      // urls: async () => {
      //   try {
      //     // 예시: 백엔드에서 모든 공지사항 ID 목록을 가져오는 API가 있다고 가정
      //     const response = await fetch('https://aminute.onrender.com/api/announcements/ids'); // 가상의 API
      //     const announcementIds = await response.json();
      //     return announcementIds.map(id => ({
      //       loc: `/announcements/${id}`,
      //       lastmod: new Date().toISOString().split('T')[0], // 예시로 오늘 날짜
      //       changefreq: 'weekly',
      //       priority: 0.7
      //     }));
      //   } catch (e) {
      //     console.error('Failed to fetch dynamic routes for sitemap', e);
      //     return [];
      //   }
      // }
    }
  } // <<--- 이 중괄호가 이전에 빠져있었습니다.
});