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
// 스크립트 부분은 이전 답변과 동일하게 유지합니다.
// (name, props, data, computed: currentUsername, connectionStatusClass, webSocketUrl,
//  methods: fetchRoomDetails, connect, disconnect, sendMessage, confirmKickUser, kickUser, startCooldown, clearCooldown,
//  mounted, beforeUnmount)
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
      const usernameToConnect = this.currentUsername;
      console.log(`Attempting to connect to room: ${this.roomId} as ${usernameToConnect} via ${this.webSocketUrl}`);
      if (!this.roomId) { this.connectionStatus = "오류: 방 ID가 없습니다."; console.error("Room ID is not available."); return; }
      if (this.connecting || (this.stompClient && this.stompClient.active)) { console.log(this.connecting ? "이미 연결 시도 중입니다." : "이미 연결되어 있습니다."); return; }

      this.connecting = true; this.connectionStatus = "서버에 연결 중...";
      if (this.stompClient && typeof this.stompClient.deactivate === 'function') { this.stompClient.deactivate(); }

      const connectHeaders = {};
      const token = localStorage.getItem('userToken');
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
      if (this.stompClient && this.stompClient.active) {
        const leaveMessage = {
          sender: this.currentUsername,
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
/* 기존 스타일들 */
.chat-room-view {
  display: flex;
  flex-direction: column;
  /* max-height를 100vh 또는 다른 값으로 변경하거나, 내부 요소들이 화면을 넘치지 않도록 조정 */
  height: calc(100vh - 120px); /* 예시: 헤더, 네비게이션 등을 제외한 높이, 필요시 조정 */
  max-width: 900px;
  min-width: 320px; /* 모바일 최소 너비 고려 */
  margin: 20px auto;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 15px; /* 모바일에서는 패딩 약간 줄임 */
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  background-color: #fff;
  overflow: hidden; /* 내부 스크롤은 각 영역에서 담당 */
}
.room-header {
  text-align: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
  flex-shrink: 0; /* 헤더는 줄어들지 않도록 */
}
.room-header h1 { font-size: 1.3em; margin-bottom: 3px; } /* 모바일 폰트 크기 조정 */
.room-header p { font-size: 0.8em; color: #666; margin: 2px 0; }
#status { font-size: 0.85em; }

.main-content-area {
  display: flex;
  flex-grow: 1;
  overflow: hidden; /* 중요: 이 영역이 넘치면 스크롤되도록 */
  /* 모바일에서는 세로로 쌓이도록 아래 미디어 쿼리에서 flex-direction 변경 */
}

.chat-main-panel {
  flex-grow: 1; /* 모바일에서는 채팅 패널이 주 공간 차지 */
  display: flex;
  flex-direction: column;
  /* margin-right는 모바일에서 제거 (아래 미디어 쿼리) */
  overflow: hidden;
}
.chat-container {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden; /* messages-area가 스크롤되도록 */
}
.messages-area {
  flex-grow: 1;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  padding: 10px;
  margin-bottom: 10px;
  background-color: #f9f9f9;
  min-height: 200px; /* 최소 높이 조정 */
}
.message { /* 메시지 스타일 약간 조정 */
  margin-bottom: 6px; padding: 6px 10px;
  max-width: 95%; /* 모바일에서 메시지 너비 조정 */
}
.message .sender { font-size: 0.75em; }


.message-input-controls {
  padding-top: 10px;
  border-top: 1px solid #eee;
  flex-shrink: 0; /* 입력창은 줄어들지 않도록 */
}
.message-input-area input[type="text"] {
  padding: 8px 12px; font-size: 0.9em; /* 입력창 크기 조정 */
}
.message-input-area button {
  padding: 8px 15px; font-size: 0.9em; /* 버튼 크기 조정 */
}
.cooldown-message { font-size: 0.8em; }


.user-list-sidebar {
  flex-grow: 1; /* 데스크탑에서 차지하는 비율 */
  min-width: 180px; /* 데스크탑 최소 너비 */
  max-width: 250px; /* 데스크탑 최대 너비 */
  border-left: 1px solid #e0e0e0;
  padding-left: 15px;
  overflow-y: auto;
  background-color: #fdfdfd;
  /* 모바일에서는 아래 미디어 쿼리에서 다르게 처리 */
}
.user-list-sidebar h4 { font-size: 1em; }
.user-list li { font-size: 0.9em; padding: 5px 0; }
.kick-button { font-size: 0.75em; padding: 2px 6px; }

.navigation-links {
  margin-top: 15px; /* 간격 조정 */
  text-align: center;
  padding-top: 10px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}
.navigation-links a { font-size: 0.9em; }


/* --- 모바일 화면을 위한 미디어 쿼리 (예: 768px 이하) --- */
@media (max-width: 768px) {
  .chat-room-view {
    padding: 10px;
    margin: 10px;
    height: calc(100vh - 80px); /* 헤더, 네비게이션 등을 고려한 높이 */
  }
  .room-header h1 { font-size: 1.2em; }
  .room-header p { font-size: 0.75em; }
  #status { font-size: 0.8em; }

  .main-content-area {
    flex-direction: column; /* 주 내용 영역을 세로로 쌓음 */
  }

  .chat-main-panel {
    margin-right: 0; /* 오른쪽 마진 제거 */
    margin-bottom: 15px; /* 사용자 목록과의 간격 */
    /* flex-grow: 1; 이미 설정됨 */
    min-height: 60vh; /* 최소 높이 확보 */
  }

  .user-list-sidebar {
    border-left: none; /* 왼쪽 테두리 제거 */
    border-top: 1px solid #e0e0e0; /* 위쪽 테두리 추가 */
    padding-left: 0; /* 왼쪽 패딩 제거 */
    padding-top: 10px; /* 위쪽 패딩 추가 */
    max-height: 30vh; /* 모바일에서 사용자 목록 높이 제한 (스크롤) */
    min-width: unset; /* 최소 너비 제한 해제 */
    width: 100%; /* 너비 100% */
    flex-grow: 0; /* 남은 공간을 채우지 않도록 */
    flex-shrink: 1; /* 공간 부족 시 줄어들 수 있도록 */
  }
  .message-input-area input[type="text"] {
    font-size: 1em; /* 모바일에서 입력 필드 폰트 크기 유지 또는 약간 키움 */
  }
  .message-input-area button {
    font-size: 1em;
  }
}
</style>