<template>
  <div class="chat-room-view">
    <div class="room-header">
      <h1>{{ roomDisplayName }}</h1>
      <p class="room-meta">카테고리: {{ categoryId }}</p>
      <p v-if="roomOwner" class="room-meta">방장: {{ roomOwner }}</p>
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
      <div class="chat-main-panel">
        <div class="chat-container">
          <div id="messages" class="messages-area" ref="messagesArea">
            <div v-for="(msg, index) in receivedMessages" :key="index" class="message" :class="{'my-message': msg.sender === currentUsername, 'system-message': msg.type === 'JOIN' || msg.type === 'LEAVE' || msg.type === 'KICK' || msg.type === 'SYSTEM'}">
              <template v-if="msg.type !== 'USER_LIST_UPDATE'">
                <span class="sender" v-if="msg.type === 'CHAT'">{{ msg.sender }}: </span>
                <span class="content">{{ msg.content }}</span>
              </template>
            </div>
          </div>
        </div>

        <div class="message-input-controls">
          <div class="message-input-area">
            <input
              type="text"
              id="messageInput"
              v-model="newMessage"
              @keydown.enter="sendMessage"
              placeholder="메시지를 입력하세요..."
              :disabled="!stompClient || !stompClient.active || (isCooldownActive && currentUsername !== roomOwner)"
            />
            <button @click="sendMessage" :disabled="!stompClient || !stompClient.active || !newMessage.trim() || (isCooldownActive && currentUsername !== roomOwner)">
              전송
            </button>
          </div>
          <p v-if="isCooldownActive && currentUsername !== roomOwner" class="cooldown-message">
            {{ cooldownRemainingSeconds }}초 후에 다시 메시지를 보낼 수 있습니다.
          </p>
        </div>
      </div>

      <div class="user-list-sidebar" v-if="stompClient && stompClient.active">
        <h4>참여자 목록 ({{ currentRoomUserCount }}명)</h4>
        <ul class="user-list">
          <li v-for="userInList in currentRoomUsers" :key="userInList">
            <span>{{ userInList }}</span>
            <button
              v-if="currentUsername && roomOwner && currentUsername === roomOwner && userInList !== currentUsername"
              @click="confirmKickUser(userInList)"
              class="kick-button"
              title="이 사용자 강퇴하기">
              강퇴
            </button>
          </li>
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
import SockJS from 'sockjs-client/dist/sockjs.min.js';
import { Client as StompClient } from '@stomp/stompjs';
import apiClient from '@/services/api'; // apiClient 임포트

const CHAT_COOLDOWN_DURATION_SECONDS = 5;

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
      cooldownTimer: null,
      roomOwner: null,
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
    },
    webSocketUrl() {
      const backendBaseUrl = process.env.VUE_APP_API_BASE_URL || 'http://localhost:8080';
      return `${backendBaseUrl}/ws`;
    }
  },
  methods: {
    async fetchRoomDetails() {
      if (!this.roomId) {
        this.roomDisplayName = '알 수 없는 방';
        this.roomDetailsError = "방 ID가 없습니다.";
        this.roomOwner = null;
        return;
      }
      this.roomDetailsError = null;
      try {
        // apiClient는 인터셉터에서 자동으로 헤더에 토큰을 추가합니다.
        const response = await apiClient.get(`/api/chatrooms/${this.roomId}`);
        if (response.data) {
          this.roomDisplayName = response.data.name || this.roomId;
          this.roomOwner = response.data.ownerUsername || null;
          console.log('Room details fetched. Name:', this.roomDisplayName, 'Owner:', this.roomOwner);
        } else {
          this.roomDisplayName = this.roomId;
          this.roomOwner = null;
          this.roomDetailsError = `${this.roomId} 방 정보를 가져올 수 없습니다. (응답 데이터 없음)`;
        }
      } catch (err) {
        console.error("방 정보 로드 오류:", err);
        this.roomDetailsError = `${this.roomId} 방 정보를 가져오는 중 오류 발생`;
        if (err.response) {
          this.roomDetailsError += ` (서버 응답: ${err.response.status})`;
          if (err.response.status === 401) {
             this.roomDetailsError += " - 인증이 필요하거나 세션이 만료되었을 수 있습니다.";
          }
        }
        this.roomDisplayName = this.roomId;
        this.roomOwner = null;
      }
    },
    connect() {
      const usernameToConnect = this.currentUsername; // 변수명 명확화
      console.log(`Attempting to connect to room: ${this.roomId} as ${usernameToConnect} via ${this.webSocketUrl}`);
      if (!this.roomId) { this.connectionStatus = "오류: 방 ID가 없습니다."; console.error("Room ID is not available."); return; }
      if (this.connecting || (this.stompClient && this.stompClient.active)) { console.log(this.connecting ? "이미 연결 시도 중입니다." : "이미 연결되어 있습니다."); return; }

      this.connecting = true; this.connectionStatus = "서버에 연결 중...";
      if (this.stompClient && typeof this.stompClient.deactivate === 'function') { this.stompClient.deactivate(); }

      const connectHeaders = {};
      const token = localStorage.getItem('userToken'); // STOMP 연결 헤더에는 토큰 직접 추가
      if (token) {
        connectHeaders['Authorization'] = `Bearer ${token}`;
      }

      this.stompClient = new StompClient({
        webSocketFactory: () => new SockJS(this.webSocketUrl),
        connectHeaders: connectHeaders,
        debug: (str) => { console.log('STOMP DEBUG: ' + str); },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      this.stompClient.onConnect = (frame) => {
        this.connecting = false;
        this.connectionStatus = `서버 연결 성공! (${usernameToConnect} / ${this.roomDisplayName})`;
        console.log('Connected to WebSocket: ' + frame);

        this.stompClient.subscribe(`/topic/room/${this.roomId}`, (messageOutput) => {
          const message = JSON.parse(messageOutput.body);
          if (message.type === 'USER_LIST_UPDATE') {
            this.currentRoomUsers = message.users ? [...message.users].sort() : [];
            this.currentRoomUserCount = message.userCount || 0;
          } else if (['JOIN', 'LEAVE', 'CHAT', 'SYSTEM', 'KICK'].includes(message.type)) {
            this.receivedMessages.push(message);
          }
          this.$nextTick(() => {
            const messagesArea = this.$refs.messagesArea;
            if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
           });
        });

        this.stompClient.subscribe(`/user/${usernameToConnect}/queue/private`, (messageOutput) => {
            const message = JSON.parse(messageOutput.body);
            console.log("Received private message:", message);
            if (message.type === 'KICK') {
                alert(message.content || "채팅방에서 강퇴되었습니다.");
                this.disconnect();
                this.$router.push('/');
            }
        });

        const joinMessage = { sender: usernameToConnect, type: 'JOIN', roomId: this.roomId, content: `${usernameToConnect} 님이 입장했습니다.` };
        this.stompClient.publish({ destination: `/app/chat.addUser/${this.roomId}`, body: JSON.stringify(joinMessage) });
      };
      this.stompClient.onStompError = (frame) => { this.connecting = false; this.connectionStatus = "STOMP 오류"; console.error('STOMP Error:', frame);};
      this.stompClient.onWebSocketError = (event) => { this.connecting = false; this.connectionStatus = "WebSocket 오류"; console.error('WebSocket Error:', event);};
      this.stompClient.activate();
    },
    disconnect() {
      // const usernameToUse = this.currentUsername; // 이 변수는 LEAVE 메시지 생성 시 this.currentUsername을 직접 사용하므로 불필요
      if (this.stompClient && this.stompClient.active) {
        const leaveMessage = {
          sender: this.currentUsername, // this.currentUsername 직접 사용
          type: 'LEAVE',
          roomId: this.roomId,
          content: `${this.currentUsername} 님이 퇴장했습니다.`
        };
        try {
          this.stompClient.publish({ destination: `/app/chat.sendMessage/${this.roomId}`, body: JSON.stringify(leaveMessage) });
        } catch (e) {
          console.warn("Failed to publish LEAVE message during disconnect", e);
        }
        this.stompClient.deactivate();
      } else if (this.stompClient) {
         try { this.stompClient.deactivate(); } catch(e) { /* Do nothing */ }
      }
      this.connectionStatus = "연결 끊김.";
      console.log("STOMP client disconnected.");
      this.connecting = false;
      this.currentRoomUsers = [];
      this.currentRoomUserCount = 0;
      this.clearCooldown();
    },
    sendMessage() {
      console.log('--- sendMessage called --- Current User:', this.currentUsername, 'Room Owner:', this.roomOwner, 'Is Owner?:', this.currentUsername === this.roomOwner, 'Cooldown Active?:', this.isCooldownActive);
      // const usernameToUse = this.currentUsername; // 이 변수는 chatMessage.sender에 this.currentUsername을 직접 사용하므로 불필요
      if (this.isCooldownActive && this.currentUsername !== this.roomOwner) {
        alert(`${this.cooldownRemainingSeconds}초 후에 메시지를 보낼 수 있습니다.`);
        return;
      }

      if (this.newMessage.trim() && this.stompClient && this.stompClient.active) {
        const chatMessage = {
          sender: this.currentUsername, // this.currentUsername 직접 사용
          content: this.newMessage,
          type: 'CHAT',
          roomId: this.roomId
        };
        this.stompClient.publish({
          destination: `/app/chat.sendMessage/${this.roomId}`,
          body: JSON.stringify(chatMessage)
        });
        this.newMessage = '';
        if (this.currentUsername !== this.roomOwner) {
          this.startCooldown();
        }
      } else if (!this.stompClient || !this.stompClient.active) {
        alert("먼저 채팅 서버에 연결해주세요.");
      }
    },
    confirmKickUser(usernameToKick) {
      if (confirm(`정말로 '${usernameToKick}' 사용자를 이 방에서 강퇴하시겠습니까?`)) {
        this.kickUser(usernameToKick);
      }
    },
    async kickUser(usernameToKick) {
      if (!this.currentUsername || this.currentUsername !== this.roomOwner) {
        alert("강퇴 권한이 없습니다.");
        return;
      }
      const token = localStorage.getItem('userToken'); // 로그인(인증) 여부 확인용
      if (!token) {
        alert("인증 토큰이 없습니다. 다시 로그인 해주세요.");
        this.$router.push('/login');
        return;
      }
      // apiClient는 인터셉터에서 자동으로 헤더에 토큰을 추가합니다.
      try {
        const response = await apiClient.post(
          `/api/chatrooms/${this.roomId}/admin/kick`,
          { usernameToKick: usernameToKick }
        );
        alert(response.data);
      } catch (error) {
        console.error("강퇴 API 호출 오류:", error.response || error.message || error);
        if (error.response && error.response.data) {
          let errorMessage = error.response.data;
          if (typeof errorMessage === 'object' && errorMessage.message) {
            errorMessage = errorMessage.message;
          }
          alert(`강퇴 실패: ${errorMessage}`);
        } else if (error.request) {
          alert("강퇴 요청 중 서버로부터 응답을 받지 못했습니다.");
        } else {
          alert("강퇴 요청 설정 중 오류가 발생했습니다.");
        }
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
    this.disconnect();
  }
}
</script>

<style scoped>
/* 스타일 부분은 이전 답변과 동일하게 유지합니다. */
/* ... (이전 전체 <style> 내용) ... */
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
.message-input-area input[type="text"]:disabled {
  background-color: #f0f0f0;
  cursor: not-allowed;
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
  color: #dc3545;
  margin-top: 8px;
  text-align: right;
  padding-right: 10px;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
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
.kick-button {
  margin-left: 10px;
  padding: 3px 8px;
  font-size: 0.8em;
  color: white;
  background-color: #e74c3c;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.kick-button:hover {
  background-color: #c0392b;
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