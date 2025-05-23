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
import apiClient from '@/services/api';

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
        const response = await apiClient.get(`/api/chatrooms/${this.roomId}`);
        if (response.data) {
          this.roomDisplayName = response.data.name || this.roomId;
          this.roomOwner = response.data.ownerUsername || null;
          console.log('ChatRoomView: Room details fetched. Name:', this.roomDisplayName, 'Owner:', this.roomOwner);
        } else {
          this.roomDisplayName = this.roomId;
          this.roomOwner = null;
          this.roomDetailsError = `${this.roomId} 방 정보를 가져올 수 없습니다. (응답 데이터 없음)`;
        }
      } catch (err) {
        console.error("ChatRoomView: 방 정보 로드 오류:", err);
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
      const usernameForSubscription = this.currentUsername;
      if (!usernameForSubscription) {
        console.error("ChatRoomView: Cannot connect to WebSocket. Username for subscription is missing.");
        alert("사용자 정보가 없어 채팅 서버에 연결할 수 없습니다. 다시 로그인 해주세요.");
        this.$router.push('/login');
        return;
      }

      console.log(`ChatRoomView: Attempting to connect to room: ${this.roomId} as ${usernameForSubscription} via ${this.webSocketUrl}`);
      if (!this.roomId) { this.connectionStatus = "오류: 방 ID가 없습니다."; console.error("ChatRoomView: Room ID is not available."); return; }
      if (this.connecting || (this.stompClient && this.stompClient.active)) { console.log("ChatRoomView:", this.connecting ? "이미 연결 시도 중입니다." : "이미 연결되어 있습니다."); return; }

      this.connecting = true; this.connectionStatus = "서버에 연결 중...";
      if (this.stompClient && typeof this.stompClient.deactivate === 'function') { this.stompClient.deactivate(); }

      const connectHeaders = {};
      const token = localStorage.getItem('userToken');
      if (token) {
        connectHeaders['Authorization'] = `Bearer ${token}`;
      } else {
        console.warn("ChatRoomView: No userToken found. Attempting unauthenticated WebSocket connection.");
      }

      this.stompClient = new StompClient({
        webSocketFactory: () => new SockJS(this.webSocketUrl),
        connectHeaders: connectHeaders,
        debug: (str) => { console.log('STOMP DEBUG (ChatRoomView): ' + str); },
        reconnectDelay: 5000,
        heartbeatIncoming: 4000,
        heartbeatOutgoing: 4000,
      });

      this.stompClient.onConnect = (frame) => {
        this.connecting = false;
        this.connectionStatus = `서버 연결 성공! (${usernameForSubscription} / ${this.roomDisplayName})`;
        console.log('ChatRoomView: Connected to WebSocket. Frame headers:', frame ? JSON.stringify(frame.headers) : 'No frame');

        // 공용 메시지 채널 구독
        this.stompClient.subscribe(`/topic/room/${this.roomId}`, (messageOutput) => {
          const message = JSON.parse(messageOutput.body);
          console.log(`ChatRoomView: Received public message on /topic/room/${this.roomId}`, message);
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

        // 사용자 개인 큐 구독 (STOMP 표준 사용자 목적지 구독 방식 시도)
        // 서버에서 setUserDestinationPrefix("/user")가 설정되어 있다면,
        // 클라이언트는 /user/queue/private 와 같이 구독하면 서버가 현재 사용자의 세션에 맞게 라우팅해줍니다.
        const privateQueuePathForSubscribe = "/user/queue/private";
        console.log(`ChatRoomView: Attempting to subscribe to user's private queue: ${privateQueuePathForSubscribe} (for user: ${usernameForSubscription})`);
        this.stompClient.subscribe(privateQueuePathForSubscribe, (messageOutput) => {
            const message = JSON.parse(messageOutput.body);
            // 이 로그가 찍히는지 확인하는 것이 매우 중요합니다!
            console.log("ChatRoomView: Received message on user's private queue", message); // 로그 메시지 명확화
            if (message.type === 'KICK') {
                alert(message.content || `[${this.roomDisplayName || this.roomId}] 방에서 강퇴당하셨습니다.`);
                this.disconnect();
                this.$router.push('/');
            }
            // 다른 타입의 개인 메시지 처리 ...
        },
        // 구독에 고유 ID 부여 (선택 사항, 디버깅에 도움될 수 있음)
        { id: `private-sub-for-${usernameForSubscription}-room-${this.roomId}` }
        );

        const joinMessage = { sender: usernameForSubscription, type: 'JOIN', roomId: this.roomId, content: `${usernameForSubscription} 님이 입장했습니다.` };
        this.stompClient.publish({ destination: `/app/chat.addUser/${this.roomId}`, body: JSON.stringify(joinMessage) });
      };

      this.stompClient.onStompError = (frame) => {
        this.connecting = false;
        let errorMessageText = "STOMP 프로토콜 오류가 발생했습니다. 서버와의 연결을 확인해주세요.";
        if (frame && frame.headers && frame.headers.message) {
            errorMessageText += `\n서버 메시지: ${frame.headers.message}`;
        }
        console.error('ChatRoomView: STOMP Error:', frame);
        this.connectionStatus = errorMessageText;
        alert(errorMessageText);
      };

      this.stompClient.onWebSocketError = (event) => {
        this.connecting = false;
        console.error('ChatRoomView: WebSocket Error:', event);
        this.connectionStatus = "WebSocket 연결 오류가 발생했습니다. 네트워크 또는 서버 상태를 확인해주세요.";
        alert(this.connectionStatus);
      };
      this.stompClient.activate();
    },
    disconnect() {
      if (this.stompClient && (this.stompClient.active || this.stompClient.connected)) {
        const leaveMessage = {
          sender: this.currentUsername,
          type: 'LEAVE',
          roomId: this.roomId,
          content: `${this.currentUsername} 님이 퇴장했습니다.`
        };
        try {
          if (this.stompClient.connected) {
             this.stompClient.publish({ destination: `/app/chat.sendMessage/${this.roomId}`, body: JSON.stringify(leaveMessage) });
          }
        } catch (e) {
          console.warn("ChatRoomView: Failed to publish LEAVE message during disconnect, connection might be already closing.", e);
        }
        this.stompClient.deactivate();
        console.log("ChatRoomView: STOMP client deactivated.");
      }

      this.connectionStatus = "연결 끊김.";
      this.connecting = false;
      this.currentRoomUsers = [];
      this.currentRoomUserCount = 0;
      this.clearCooldown();
    },
    sendMessage() {
      console.log('--- sendMessage called --- Current User:', this.currentUsername, 'Room Owner:', this.roomOwner, 'Is Owner?:', this.currentUsername === this.roomOwner, 'Cooldown Active?:', this.isCooldownActive);
      if (this.isCooldownActive && this.currentUsername !== this.roomOwner) {
        alert(`${this.cooldownRemainingSeconds}초 후에 메시지를 보낼 수 있습니다.`);
        return;
      }
      if (this.newMessage.trim() && this.stompClient && this.stompClient.active) {
        const chatMessage = {
          sender: this.currentUsername,
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
      const token = localStorage.getItem('userToken');
      if (!token) {
        alert("인증 토큰이 없습니다. 다시 로그인 해주세요.");
        this.$router.push('/login');
        return;
      }
      try {
        const response = await apiClient.post(
          `/api/chatrooms/${this.roomId}/admin/kick`,
          { usernameToKick: usernameToKick }
        );
        alert(response.data);
      } catch (error) {
        console.error("강퇴 API 호출 오류:", error.response || error.message || error);
        if (error.response && error.response.data) {
          let errorMessageText = error.response.data;
          if (typeof errorMessageText === 'object' && errorMessageText.message) {
            errorMessageText = errorMessageText.message;
          }
          alert(`강퇴 실패: ${errorMessageText}`);
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
    console.log('ChatRoomView Mounted - CID:', this.categoryId, '| RID:', this.roomId, '| User:', localStorage.getItem('chatUsername'));
    await this.fetchRoomDetails();
    if (this.roomId && this.currentUsername) {
        this.connect();
    } else {
        if(!this.roomId) this.connectionStatus = "오류: 방 ID가 유효하지 않습니다.";
        if(!this.currentUsername) this.connectionStatus = "오류: 사용자 정보를 찾을 수 없습니다. 로그인 해주세요.";
        console.error("ChatRoomView: Cannot connect, Room ID or currentUsername is not valid on mount.");
        if(!this.currentUsername && this.$router) this.$router.push('/login');
    }
  },
  beforeUnmount() {
    this.disconnect();
  }
}
</script>

<style scoped>
.chat-room-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  max-width: 900px;
  min-width: 320px;
  margin: 20px auto;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  background-color: #fff;
  overflow: hidden;
}
.room-header {
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
  flex-shrink: 0;
}
.room-header h1 { font-size: 1.3em; margin-top: 0; margin-bottom: 3px; }
.room-header p { font-size: 0.8em; color: #666; margin: 2px 0; }
.room-header p.room-meta { font-size: 0.8em; color: #888; margin-bottom: 8px; }
#status { font-weight: bold; margin-top: 5px; font-size: 0.85em; }
.status-connected { color: green; }
.status-disconnected { color: red; }
.status-connecting { color: orange; }
.current-username { font-weight: normal; color: #555; font-size: 0.9em; }
.user-count { font-size: 0.85em; color: #777; margin-left: 5px; }
.connect-button-container { margin-top: 10px; }
.main-content-area {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
  margin-top: 10px;
}
.chat-main-panel {
  flex-grow: 3; /* 데스크탑에서는 사용자 목록보다 채팅 패널이 넓게 */
  display: flex;
  flex-direction: column;
  margin-right: 15px; /* 데스크탑에서 사용자 목록과의 간격 */
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
  min-height: 200px;
}
.message {
  margin-bottom: 8px; padding: 6px 10px; border-radius: 15px;
  max-width: 85%; word-wrap: break-word; line-height: 1.4;
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
.message-input-controls { padding-top: 10px; border-top: 1px solid #eee; flex-shrink: 0; }
.message-input-area { display: flex; align-items: center; }
.message-input-area input[type="text"] { flex-grow: 1; padding: 10px 15px; border: 1px solid #ccc; border-radius: 20px; margin-right: 10px; font-size: 0.95em; }
.message-input-area input[type="text"]:disabled { background-color: #f0f0f0; cursor: not-allowed; }
.message-input-area button { padding: 10px 18px; background-color: #007bff; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 0.95em; white-space: nowrap; }
.message-input-area button:hover:not(:disabled) { background-color: #0056b3; }
.message-input-area button:disabled { background-color: #ccc; cursor: not-allowed; }
.cooldown-message { font-size: 0.8em; color: #dc3545; margin-top: 8px; text-align: right; padding-right: 10px; height: 1.2em; }
.user-list-sidebar { flex-basis: 200px; flex-shrink: 0; border-left: 1px solid #e0e0e0; padding-left: 15px; overflow-y: auto; background-color: #fdfdfd; height: 100%; }
.user-list-sidebar h4 { margin-top: 0; margin-bottom: 10px; font-size: 1em; color: #333; border-bottom: 1px solid #eee; padding-bottom: 10px; }
.user-list { list-style-type: none; padding: 0; }
.user-list li { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 0.9em; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-bottom: 1px dotted #f0f0f0; }
.user-list li:last-child { border-bottom: none; }
.kick-button { margin-left: 10px; padding: 2px 6px; font-size: 0.75em; color: white; background-color: #e74c3c; border: none; border-radius: 4px; cursor: pointer; white-space: nowrap;}
.kick-button:hover { background-color: #c0392b; }
.navigation-links { margin-top: 15px; text-align: center; padding-top: 10px; border-top: 1px solid #eee; flex-shrink: 0; }
.navigation-links a { font-size: 0.9em; margin: 0 10px; color: #007bff; text-decoration: none; }
.navigation-links a:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .chat-room-view { padding: 10px; margin: 10px 5px; height: calc(100vh - 70px); }
  .room-header h1 { font-size: 1.2em; } .room-header p { font-size: 0.75em; } #status { font-size: 0.8em; }
  .main-content-area { flex-direction: column; }
  .chat-main-panel { margin-right: 0; margin-bottom: 10px; min-height: 0; flex-grow: 1; }
  .messages-area { min-height: 150px; }
  .user-list-sidebar { border-left: none; border-top: 1px solid #e0e0e0; padding-left: 0; padding-top: 10px; max-height: 200px; min-width: unset; width: 100%; flex-basis: auto; flex-grow: 0; flex-shrink: 0; }
  .message-input-area input[type="text"], .message-input-area button { font-size: 1em; }
}
</style>