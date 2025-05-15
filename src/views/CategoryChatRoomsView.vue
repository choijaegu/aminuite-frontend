<template>
  <div class="category-chat-rooms">
    <h1>{{ categoryId }} 카테고리의 채팅방 목록</h1>
    <p>선택된 카테고리의 채팅방 목록이 여기에 나타납니다.</p>
    <router-link to="/">홈으로 돌아가기</router-link>
  </div>
</template>
<script>
export default {
  name: 'CategoryChatRoomsView',
  props: ['categoryId'],
  mounted() {
    console.log('선택된 카테고리 ID:', this.categoryId);
  }
}
</script>