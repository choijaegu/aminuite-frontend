<template>
  <div class="chat-room">
    <h1>채팅방: {{ roomId }} (카테고리: {{ categoryId }})</h1>
    <p>채팅 메시지들이 여기에 나타납니다.</p>
    <router-link :to="'/category/' + categoryId">채팅방 목록으로 돌아가기</router-link> <br>
    <router-link to="/">홈으로 돌아가기</router-link>
  </div>
</template>
<script>
export default {
  name: 'ChatRoomView',
  props: ['categoryId', 'roomId'],
  mounted() {
    console.log('입장한 방 ID:', this.roomId, '카테고리 ID:', this.categoryId);
  }
}
</script>