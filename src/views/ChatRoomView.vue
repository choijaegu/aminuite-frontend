<template>
  <div class="chat-room-view">
    <div class="room-header">
      <h1>{{ roomDisplayName }}</h1>
      <p class="room-meta">카테고리: {{ categoryId }}</p>
      <p id="status" :class="connectionStatusClass">
        {{ connectionStatus }}
        <span v-if="currentUsername" class="current-username"> ({{ currentUsername }})</span>
        <span v-if="stompClient && stompClient.active" class="user-count"> (현재 인원: {{ currentRoomUserCount }}명)</span>
      </p>
      <div v-if="!stompClient || !stompClient.active" class="connect-button-container">
        <button @click="connect" :disabled="connecting || (stompClient && stompClient.active)">
          {{ connecting ? '연결 중...' : (stompClient && stompClient.active ? '연결됨' : '채팅 서버에 연결하기') }}
        </button>
      </div>
    </div>

    <div class="main-content-area">
      <div class="chat-main-panel"> <div class="chat-container"> <div id="messages" class="messages-area" ref="messagesArea">
            <div v-for="(msg, index) in receivedMessages" :key="index" class="message" :class="{'my-message': msg.sender === currentUsername, 'system-message': msg.type === 'JOIN' || msg.type === 'LEAVE'}">
              <template v-if="msg.type !== 'USER_LIST_UPDATE'">
                <span class="sender" v-if="msg.type === 'CHAT'">{{ msg.sender }}: </span>
                <span class="content">{{ msg.content }}</span>
              </template>
            </div>
          </div>
        </div>

        <div class="message-input-controls"> <div class="message-input-area">
              <input
                type="text"
                id="messageInput"
                v-model="newMessage"
                @keydown.enter="sendMessage"
                placeholder="메시지를 입력하세요..."
                :disabled="!stompClient || !stompClient.active || isCooldownActive"
              />
              <button @click="sendMessage" :disabled="!stompClient || !stompClient.active || !newMessage.trim() || isCooldownActive">
                전송
              </button>
          </div>
          <p v-if="isCooldownActive" class="cooldown-message">
            {{ cooldownRemainingSeconds }}초 후에 다시 메시지를 보낼 수 있습니다.
          </p>
        </div>
      </div>

      <div class="user-list-sidebar" v-if="stompClient && stompClient.active"> <h4>참여자 목록 ({{ currentRoomUserCount }}명)</h4>
        <ul class="user-list">
          <li v-for="userInList in currentRoomUsers" :key="userInList">{{ userInList }}</li>
        </ul>
      </div>
    </div>
    <div class="navigation-links">
      <router-link :to="`/category/${categoryId}`">채팅방 목록으로 돌아가기</router-link> |
      <router-link to="/">홈으로 돌아가기</router-link>
    </div>
  </div>
</template>

<script>
// <script> 부분은 이전에 드렸던 "채팅방 인원 수 및 참여자 목록 표시" 기능과
// "쿨다운 시간 표시" 기능이 모두 포함된 최종본입니다.
import SockJS from 'sockjs-client/dist/sockjs.min.js';
import { Client as StompClient } from '@stomp/stompjs';
import axios from 'axios';

const CHAT_COOLDOWN_DURATION_SECONDS = 5; // 백엔드 ChatController와 동일하게 설정

export default {
  name: 'ChatRoomView',
  props: ['categoryId', 'roomId'],
  data() {
    return {
      stompClient: null,
      receivedMessages: [],
      newMessage: '',
      connectionStatus: '연결 안됨.',
      connecting: false,
      roomDisplayName: this.roomId,
      roomDetailsError: null,
      currentRoomUsers: [],
      currentRoomUserCount: 0,
      isCooldownActive: false,
      cooldownRemainingSeconds: 0,
      cooldownTimer: null
    };
  },
  computed: {
    currentUsername() {
      return localStorage.getItem('chatUsername') || '익명사용자';
    },
    connectionStatusClass() {
      if (this.stompClient && this.stompClient.active) {
        return 'status-connected';
      } else if (this.connecting) {
        return 'status-connecting';
      }
      return 'status-disconnected';
    }
  },
  methods: {
    async fetchRoomDetails() {
      if (!this.roomId) { this.roomDisplayName = '알 수 없는 방'; return; }
      this.roomDetailsError = null;
      try {
        const response = await axios.get(`http://localhost:8080/api/chatrooms/${this.roomId}`);
        if (response.data && response.data.name) { this.roomDisplayName = response.data.name; }
        else { this.roomDisplayName = this.roomId; }
      } catch (err) {
        this.roomDetailsError = `${this.roomId} 방 정보 로드 오류`; this.roomDisplayName = this.roomId;
      }
    },
    connect() {
      const usernameToUse = this.currentUsername;
      console.log(`Attempting to connect to room: ${this.roomId} as ${usernameToUse}`);
      if (!this.roomId) { this.connectionStatus = "오류: 방 ID가 없습니다."; console.error("Room ID is not available."); return; }
      if (this.connecting || (this.stompClient && this.stompClient.active)) { console.log(this.connecting ? "이미 연결 시도 중입니다." : "이미 연결되어 있습니다."); return; }
      this.connecting = true; this.connectionStatus = "서버에 연결 중...";
      if (this.stompClient && typeof this.stompClient.deactivate === 'function') { this.stompClient.deactivate(); }

      this.stompClient = new StompClient({
        webSocketFactory: () => new SockJS('http://localhost:8080/ws'),
        debug: (str) => { console.log('STOMP DEBUG: ' + str); },
        reconnectDelay: 5000, heartbeatIncoming: 4000, heartbeatOutgoing: 4000,
      });

      this.stompClient.onConnect = (frame) => {
        this.connecting = false;
        this.connectionStatus = `서버 연결 성공! (${usernameToUse} / ${this.roomDisplayName})`;
        console.log('Connected to WebSocket: ' + frame);
        this.stompClient.subscribe(`/topic/room/${this.roomId}`, (messageOutput) => {
          const message = JSON.parse(messageOutput.body);
          if (message.type === 'USER_LIST_UPDATE') {
            this.currentRoomUsers = message.users ? [...message.users].sort() : [];
            this.currentRoomUserCount = message.userCount || 0;
          } else if (message.type === 'JOIN' || message.type === 'LEAVE' || message.type === 'CHAT') {
            this.receivedMessages.push(message);
          }
          this.$nextTick(() => {
            const messagesArea = this.$refs.messagesArea;
            if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
          });
        });
        const joinMessage = { sender: usernameToUse, type: 'JOIN', roomId: this.roomId, content: `${usernameToUse} 님이 입장했습니다.` };
        this.stompClient.publish({ destination: `/app/chat.addUser/${this.roomId}`, body: JSON.stringify(joinMessage) });
      };
      this.stompClient.onStompError = (frame) => { this.connecting = false; this.connectionStatus = "STOMP 오류"; console.error('STOMP Error:', frame);};
      this.stompClient.onWebSocketError = (event) => { this.connecting = false; this.connectionStatus = "WebSocket 오류"; console.error('WebSocket Error:', event);};
      this.stompClient.activate();
    },
    disconnect() {
      const usernameToUse = this.currentUsername;
      if (this.stompClient && this.stompClient.active) {
        const leaveMessage = { sender: usernameToUse, type: 'LEAVE', roomId: this.roomId, content: `${usernameToUse} 님이 퇴장했습니다.` };
        try { this.stompClient.publish({ destination: `/app/chat.sendMessage/${this.roomId}`, body: JSON.stringify(leaveMessage) });
        } catch (e) { console.warn("Failed to publish LEAVE message", e); }
        this.stompClient.deactivate();
      } else if (this.stompClient) {
         try { this.stompClient.deactivate(); } catch(e) { /* Do nothing */ }
      }
      this.connectionStatus = "연결 끊김."; console.log("STOMP client disconnected."); this.connecting = false;
      this.currentRoomUsers = []; this.currentRoomUserCount = 0;
      this.clearCooldown();
    },
    sendMessage() {
      const usernameToUse = this.currentUsername;
      if (this.isCooldownActive) { return; } // 쿨다운 중이면 UI에서 버튼이 비활성화되지만, 만약을 위해 추가
      if (this.newMessage.trim() && this.stompClient && this.stompClient.active) {
        const chatMessage = { sender: usernameToUse, content: this.newMessage, type: 'CHAT', roomId: this.roomId };
        this.stompClient.publish({
          destination: `/app/chat.sendMessage/${this.roomId}`,
          body: JSON.stringify(chatMessage)
        });
        this.newMessage = '';
        this.startCooldown();
      } else if (!this.stompClient || !this.stompClient.active) {
        alert("먼저 채팅 서버에 연결해주세요.");
      }
    },
    startCooldown() {
      if (this.isCooldownActive) return;
      this.isCooldownActive = true;
      this.cooldownRemainingSeconds = CHAT_COOLDOWN_DURATION_SECONDS;
      if (this.cooldownTimer) { clearInterval(this.cooldownTimer); }
      this.cooldownTimer = setInterval(() => {
        this.cooldownRemainingSeconds--;
        if (this.cooldownRemainingSeconds <= 0) {
          this.clearCooldown();
        }
      }, 1000);
    },
    clearCooldown() {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
      this.isCooldownActive = false;
      this.cooldownRemainingSeconds = 0;
    }
  },
  async mounted() {
    console.log('ChatRoomView Mounted - Category ID:', this.categoryId, '| Room ID:', this.roomId, '| Username from localStorage:', localStorage.getItem('chatUsername'));
    await this.fetchRoomDetails();
    if (this.roomId) {
        this.connect();
    } else {
        this.connectionStatus = "오류: 방 ID가 유효하지 않습니다.";
        console.error("Cannot connect: Room ID is not valid on mount.");
    }
  },
  beforeUnmount() {
    if (this.stompClient) {
        this.disconnect(); // disconnect에서 clearCooldown 호출
    }
    // this.clearCooldown(); // disconnect에서 이미 호출하므로 중복 불필요
  }
}
</script>

<style scoped>
/* 이전 답변에서 드렸던 ChatRoomView.vue의 <style scoped> 전체 내용을 여기에 붙여넣으시면 됩니다.
   (채팅창과 사용자 목록을 옆으로 배치하고, 쿨다운 메시지 스타일 등을 포함한 최종 버전)
*/
.chat-room-view {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 40px);
  max-width: 900px;
  min-width: 600px;
  margin: 20px auto;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  background-color: #fff;
}
.room-header {
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
}
.room-header h1 { margin-top: 0; font-size: 1.5em; margin-bottom: 5px;}
.room-header p { font-size: 0.85em; color: #666; margin: 2px 0; }
.room-header p.room-meta {
  font-size: 0.8em;
  color: #888;
  margin-bottom: 8px;
}
#status { font-weight: bold; margin-top: 5px; font-size: 0.9em; }
.status-connected { color: green; }
.status-disconnected { color: red; }
.status-connecting { color: orange; }
.current-username {
  font-weight: normal;
  color: #555;
  font-size: 0.9em;
}
.user-count {
  font-size: 0.85em;
  color: #777;
  margin-left: 5px;
}
.connect-button-container {
  margin-top: 10px;
}

.main-content-area {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  margin-top: 10px;
}

.chat-main-panel {
  flex-grow: 3;
  display: flex;
  flex-direction: column;
  margin-right: 20px;
  overflow: hidden;
}
.chat-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.messages-area {
  flex-grow: 1;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  padding: 10px;
  margin-bottom: 10px;
  background-color: #f9f9f9;
  min-height: 300px;
}
.message {
  margin-bottom: 8px; padding: 8px 12px; border-radius: 18px;
  max-width: 90%; word-wrap: break-word; line-height: 1.4;
}
.message.my-message {
  background-color: #DCF8C6; margin-left: auto; border-bottom-right-radius: 5px;
}
.message:not(.my-message) {
  background-color: #E9E9EB; margin-right: auto; border-bottom-left-radius: 5px;
}
.message .sender {
  font-weight: bold; display: block; font-size: 0.8em; color: #333; margin-bottom: 4px;
}
.message.system-message {
  text-align: center; font-style: italic; color: #888; background-color: transparent;
  font-size: 0.85em; width: 100%; max-width: 100%; padding: 5px 0;
}
.message.system-message .content { display: inline-block; }

.message-input-controls {
  padding-top: 10px;
  border-top: 1px solid #eee;
}
.message-input-area {
  display: flex;
  align-items: center;
}
.message-input-area input[type="text"] {
  flex-grow: 1; padding: 10px 15px; border: 1px solid #ccc;
  border-radius: 20px; margin-right: 10px; font-size: 1em;
}
.message-input-area button {
  padding: 10px 20px; background-color: #007bff; color: white;
  border: none; border-radius: 20px; cursor: pointer; font-size: 1em;
  white-space: nowrap;
}
.message-input-area button:hover { background-color: #0056b3; }
.message-input-area button:disabled { background-color: #ccc; cursor: not-allowed; }

.cooldown-message {
  font-size: 0.85em;
  color: #dc3545; /* 부드러운 빨간색 */
  margin-top: 8px;
  text-align: right;
  padding-right: 10px; /* 버튼과 정렬을 위해 약간의 여백 */
  height: 1.2em;
}

.user-list-sidebar {
  flex-grow: 1;
  min-width: 180px;
  max-width: 250px;
  border-left: 1px solid #e0e0e0;
  padding-left: 15px;
  overflow-y: auto;
  background-color: #fdfdfd;
  height: 100%;
}
.user-list-sidebar h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1.1em;
  color: #333;
  border-bottom: 1px solid #eee;
  padding-bottom: 10px;
}
.user-list {
  list-style-type: none;
  padding: 0;
}
.user-list li {
  padding: 6px 0;
  font-size: 0.95em;
  color: #555;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-bottom: 1px dotted #f0f0f0;
}
.user-list li:last-child {
    border-bottom: none;
}

.navigation-links {
  margin-top: 20px;
  text-align: center;
  padding-top: 15px;
  border-top: 1px solid #eee;
}
.navigation-links a {
  margin: 0 10px;
  color: #007bff;
  text-decoration: none;
}
.navigation-links a:hover {
  text-decoration: underline;
}
</style>