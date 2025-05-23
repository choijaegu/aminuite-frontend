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

        // 공용 메시지 채널 구독
        this.stompClient.subscribe(`/topic/room/${this.roomId}`, (messageOutput) => {
          const message = JSON.parse(messageOutput.body);
          if (message.type === 'USER_LIST_UPDATE') {
            this.currentRoomUsers = message.users ? [...message.users].sort() : [];
            this.currentRoomUserCount = message.userCount || 0;
          } else if (['JOIN', 'LEAVE', 'CHAT', 'SYSTEM'].includes(message.type)) { // KICK은 개인 메시지로 처리
            this.receivedMessages.push(message);
          } else if (message.type === 'KICK' && message.kickedUser === this.currentUsername) {
            // 만약 KICK 메시지가 /topic/room 으로도 온다면 (그리고 kickedUser 필드가 있다면) 여기서도 처리 가능
            // 하지만 보통 KICK은 개인 메시지로 보내는 것이 더 명확합니다.
            // 이 부분은 서버 구현에 따라 달라질 수 있습니다. 아래 개인 큐 처리를 우선합니다.
          }
          this.$nextTick(() => {
            const messagesArea = this.$refs.messagesArea;
            if (messagesArea) messagesArea.scrollTop = messagesArea.scrollHeight;
           });
        });

        // 사용자 개인 큐 구독 (강퇴 알림 등 개인 메시지 수신용)
        this.stompClient.subscribe(`/user/${usernameToConnect}/queue/private`, (messageOutput) => {
            const message = JSON.parse(messageOutput.body);
            console.log("Received private message:", message);
            if (message.type === 'KICK') { // 서버에서 보낸 KICK 메시지 타입 확인
                alert(message.content || `[${this.roomDisplayName}] 방에서 강퇴되었습니다.`);
                this.disconnect(); // 스스로 WebSocket 연결 종료
                this.$router.push('/'); // 홈 또는 다른 적절한 페이지로 강제 이동
            }
        });

        const joinMessage = { sender: usernameToConnect, type: 'JOIN', roomId: this.roomId, content: `${usernameToConnect} 님이 입장했습니다.` };
        this.stompClient.publish({ destination: `/app/chat.addUser/${this.roomId}`, body: JSON.stringify(joinMessage) });
      };

      this.stompClient.onStompError = (frame) => {
        this.connecting = false;
        // STOMP 프로토콜 레벨 오류 (예: 인증 실패 시 서버가 ERROR 프레임 전송)
        let errorMessage = "STOMP 프로토콜 오류가 발생했습니다.";
        if (frame.headers && frame.headers.message) {
            errorMessage += `\n서버 메시지: ${frame.headers.message}`;
        }
        console.error('STOMP Error:', frame);
        this.connectionStatus = errorMessage; // UI에 오류 메시지 표시
        alert(errorMessage); // 사용자에게 알림
        // 필요시 this.disconnect() 호출하여 정리
      };

      this.stompClient.onWebSocketError = (event) => {
        this.connecting = false;
        // 하위 레벨 WebSocket 연결 오류
        console.error('WebSocket Error:', event);
        this.connectionStatus = "WebSocket 연결 오류가 발생했습니다. 서버 상태를 확인해주세요.";
        alert(this.connectionStatus);
        // 필요시 this.disconnect() 호출하여 정리
      };
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
          // 연결이 활성 상태일 때만 LEAVE 메시지 전송 시도
          if (this.stompClient.connected) { // StompClient v5 에는 connected 속성 있음
             this.stompClient.publish({ destination: `/app/chat.sendMessage/${this.roomId}`, body: JSON.stringify(leaveMessage) });
          }
        } catch (e) {
          console.warn("Failed to publish LEAVE message during disconnect, connection might be already closed.", e);
        }
        this.stompClient.deactivate(); // STOMP 클라이언트 비활성화 (연결 종료)
        console.log("STOMP client deactivated.");
      } else if (this.stompClient && !this.stompClient.active && this.stompClient.connected) {
        // 활성은 아니지만 연결은 되어있는 드문 경우 (이미 비활성화 중일 수 있음)
        try { this.stompClient.deactivate(); } catch(e) { /* Do nothing */ }
        console.log("STOMP client (already inactive but connected) deactivated.");
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
        alert(response.data); // "OOO 사용자를 성공적으로 강퇴했습니다."
        // 강퇴 성공 시, 서버는 USER_LIST_UPDATE와 SYSTEM(KICK) 메시지를 /topic/room/{roomId}로 보낼 것이고,
        // 강퇴된 사용자에게는 개인 큐로 KICK 메시지를 보낼 것입니다.
        // 따라서 프론트엔드에서 목록을 직접 조작할 필요는 없습니다.
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
        // 방 정보(특히 roomOwner)를 가져온 후에 connect 호출
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
/* 스타일 부분은 이전 답변과 동일하게 유지합니다. (반응형 스타일 포함) */
/* ... (이전 전체 <style> 내용) ... */
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
.room-header h1 { font-size: 1.3em; margin-bottom: 3px; }
.room-header p { font-size: 0.8em; color: #666; margin: 2px 0; }
#status { font-size: 0.85em; }

.main-content-area {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
}

.chat-main-panel {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
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
  margin-bottom: 6px; padding: 6px 10px;
  max-width: 95%;
}
.message .sender { font-size: 0.75em; }


.message-input-controls {
  padding-top: 10px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}
.message-input-area input[type="text"] {
  padding: 8px 12px; font-size: 0.9em;
}
.message-input-area button {
  padding: 8px 15px; font-size: 0.9em;
}
.cooldown-message { font-size: 0.8em; }


.user-list-sidebar {
  min-width: 180px;
  max-width: 250px;
  border-left: 1px solid #e0e0e0;
  padding-left: 15px;
  overflow-y: auto;
  background-color: #fdfdfd;
  /* 모바일에서는 이 스타일이 미디어쿼리로 덮어쓰여짐 */
}
.user-list-sidebar h4 { font-size: 1em; }
.user-list li { font-size: 0.