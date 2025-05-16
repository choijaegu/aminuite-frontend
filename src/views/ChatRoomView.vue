<template>
  <div class="chat-room-view">
    <div class="room-header">
      <h1>채팅방: {{ roomDisplayName }}</h1>
      <p>카테고리: {{ categoryId }} | 방 ID: {{ roomId }}</p>
      <p id="status" :class="connectionStatusClass">{{ connectionStatus }}</p>
      <div v-if="!stompClient || !stompClient.connected">
        <button @click="connect" :disabled="connecting">
          {{ connecting ? '연결 중...' : '채팅 서버에 연결하기' }}
        </button>
      </div>
    </div>

    <div class="chat-container">
      <div id="messages" class="messages-area">
        <div v-for="(msg, index) in receivedMessages" :key="index" class="message" :class="{'my-message': msg.sender === username, 'system-message': msg.type === 'JOIN' || msg.type === 'LEAVE'}">
          <span class="sender" v-if="msg.type === 'CHAT'">{{ msg.sender }}: </span>
          <span class="content">{{ msg.content }}</span>
          </div>
      </div>

      <div class="message-input-area">
        <input
          type="text"
          id="messageInput"
          v-model="newMessage"
          @keydown.enter="sendMessage"
          placeholder="메시지를 입력하세요..."
          :disabled="!stompClient || !stompClient.connected"
        />
        <button @click="sendMessage" :disabled="!stompClient || !stompClient.connected || !newMessage.trim()">
          전송
        </button>
      </div>
    </div>

    <div class="navigation-links">
      <router-link :to="`/category/${categoryId}`">채팅방 목록으로 돌아가기</router-link> |
      <router-link to="/">홈으로 돌아가기</router-link>
    </div>
  </div>
</template>

// ChatRoomView.vue의 <script>
import SockJS from 'sockjs-client/dist/sockjs.min.js';
import { Client as StompClient } from '@stomp/stompjs'; // @stomp/stompjs에서 Client를 StompClient라는 이름으로 가져옴

export default {
  name: 'ChatRoomView',
  props: ['categoryId', 'roomId'],
  data() {
    return {
      stompClient: null, // 이제 Stomp.Client 객체가 될 것입니다.
      // ... (나머지 data 속성들은 거의 동일) ...
      username: "User" + Math.floor(Math.random() * 1000),
      receivedMessages: [],
      newMessage: '',
      connectionStatus: '연결 안됨.',
      connecting: false,
      roomDisplayName: ''
    };
  },
  computed: {
    connectionStatusClass() {
      if (this.stompClient && this.stompClient.connected) {
        return 'status-connected';
      } else if (this.connecting) {
        return 'status-connecting';
      }
      return 'status-disconnected';
    }
  },
  methods: {
    connect() {
      if (!this.roomId) {
        this.connectionStatus = "오류: 방 ID가 없습니다.";
        console.error("Room ID is not available.");
        return;
      }
      if (this.stompClient && this.stompClient.connected) {
        console.log("이미 연결되어 있습니다.");
        return;
      }

      this.connecting = true;
            this.connectionStatus = "서버에 연결 중...";

            if (this.stompClient) { // 이미 클라이언트 객체가 있다면 비활성화 후 새로 만들기
              this.stompClient.deactivate();
            }

            this.stompClient = new StompClient({
              // brokerURL: 'ws://localhost:8080/ws', // SockJS를 안 쓰면 이렇게 직접 WebSocket URL을 줍니다.
              webSocketFactory: function () { // SockJS를 사용하려면 webSocketFactory를 제공합니다.
                return new SockJS('http://localhost:8080/ws'); // 백엔드 WebSocket 엔드포인트
              },
              connectHeaders: {
                // login: 'user', // 필요시 인증 헤더
                // passcode: 'password'
              },
              debug: function (str) { // 디버그 로그를 보고 싶다면 추가
                console.log('STOMP DEBUG: ' + str);
              },
              reconnectDelay: 5000, // 자동 재연결 딜레이 (ms)
              heartbeatIncoming: 4000,
              heartbeatOutgoing: 4000,
            });

            this.stompClient.onConnect = (frame) => { // 연결 성공 시 콜백
              this.connecting = false;
              this.connectionStatus = `서버 연결 성공! 사용자명: ${this.username} (방: ${this.roomId})`;
              console.log('Connected to WebSocket: ' + frame);

              // 해당 방의 토픽 구독
              this.stompClient.subscribe(`/topic/room/${this.roomId}`, (messageOutput) => {
                const message = JSON.parse(messageOutput.body);
                this.receivedMessages.push(message);
                this.$nextTick(() => {
                  const messagesDiv = this.$el.querySelector('#messages');
                  if (messagesDiv) messagesDiv.scrollTop = messagesDiv.scrollHeight;
                });
              });

              // 서버에 JOIN 메시지 전송
              const joinMessage = {
                sender: this.username,
                type: 'JOIN',
                roomId: this.roomId,
                content: `${this.username} 님이 입장했습니다.`
              };
              // @stomp/stompjs 에서는 publish 메소드를 사용합니다.
              this.stompClient.publish({
                destination: `/app/chat.addUser/${this.roomId}`,
                body: JSON.stringify(joinMessage)
              });
            };

            this.stompClient.onStompError = (frame) => { // STOMP 프로토콜 오류 시 콜백
              this.connecting = false;
              this.connectionStatus = "STOMP 프로토콜 오류. 콘솔을 확인하세요.";
              console.error('STOMP Protocol Error:', frame);
              // 상세 오류 내용: frame.headers['message'] 와 frame.body
            };

            this.stompClient.onWebSocketError = (event) => { // WebSocket 자체 오류 시 콜백
               this.connecting = false;
               this.connectionStatus = "WebSocket 연결 오류. 콘솔을 확인하세요.";
               console.error('WebSocket Connection Error:', event);
            };

            this.stompClient.activate(); // 클라이언트 활성화 (연결 시작)
          },

          disconnect() {
            if (this.stompClient && this.stompClient.active) { // .active로 연결(활성화) 상태 확인
              const leaveMessage = {
                sender: this.username,
                type: 'LEAVE',
                roomId: this.roomId,
                content: `${this.username} 님이 퇴장했습니다.`
              };
              try {
                // publish는 연결된 상태에서만 시도
                this.stompClient.publish({
                  destination: `/app/chat.sendMessage/${this.roomId}`,
                  body: JSON.stringify(leaveMessage)
                });
              } catch (e) {
                console.warn("Failed to publish LEAVE message, connection might be lost already:", e);
              }

              // deactivate는 연결 시도 중이었거나 연결된 상태 모두에서 호출 가능
              this.stompClient.deactivate();
              this.connectionStatus = "연결 끊김 (deactivated)."; // 상태 업데이트
              console.log("STOMP client deactivated.");
            } else if (this.stompClient) { // 객체는 있지만 active가 아닌 경우 (예: 아직 연결 전, 또는 이미 deactivate 된 후)
               console.log("STOMP client exists but is not active. No action taken for disconnect message.");
               // 필요하다면 여기서 stompClient.deactivate()를 한번 더 호출해볼 수도 있지만, 보통은 필요 없음.
               this.stompClient.deactivate(); // 혹시 모르니 호출
               this.connectionStatus = "연결 시도 중이었거나 이미 끊김.";
            } else {
               this.connectionStatus = "연결 없음.";
               console.log("No STOMP client to disconnect.");
            }
            // this.stompClient = null; // 여기서 null로 만들면 재연결 로직에 문제 생길 수 있음. connect에서 처리.
            // 연결 관련 UI 상태 초기화
            document.getElementById('roomId').disabled = false; // (ChatRoomView에는 roomId input이 없으므로 이 줄은 영향 없음)
            document.getElementById('connectButton').disabled = false; // (ChatRoomView에는 connectButton이 없으므로 이 줄은 영향 없음)
            document.getElementById('disconnectButton').disabled = true; // (ChatRoomView에는 disconnectButton이 없으므로 이 줄은 영향 없음)
            document.getElementById('sendButton').disabled = true;
            document.getElementById('messageInput').disabled = true; // 메시지 입력창 비활성화
          },

          sendMessage() {
            if (this.newMessage.trim() && this.stompClient && this.stompClient.active) {
              const chatMessage = {
                sender: this.username,
                content: this.newMessage,
                type: 'CHAT',
                roomId: this.roomId
              };
              this.stompClient.publish({ // publish 사용
                destination: `/app/chat.sendMessage/${this.roomId}`,
                body: JSON.stringify(chatMessage)
              });
              this.newMessage = '';
            } else if (!this.stompClient || !this.stompClient.active) {
              alert("먼저 채팅 서버에 연결해주세요.");
            }
          },
    // formatTimestamp(timestamp) { // 필요하다면 타임스탬프 포맷팅 함수
    //   if (!timestamp) return '';
    //   return new Date(timestamp).toLocaleTimeString();
    // }
  },
  mounted() {
    console.log('ChatRoomView Mounted - Category ID:', this.categoryId, '| Room ID:', this.roomId);
    // (선택) 방 이름을 API로 가져와서 roomDisplayName에 설정하는 로직 추가 가능
    // 예: axios.get(`http://localhost:8080/api/chatrooms/${this.roomId}`).then(response => this.roomDisplayName = response.data.name);
    this.roomDisplayName = this.roomId; // 일단 roomId로 표시

    // 컴포넌트가 마운트되면 자동으로 연결 시도
    this.connect();
  },
  beforeUnmount() { // Vue 3에서는 beforeUnmount (Vue 2는 beforeDestroy)
    // 컴포넌트가 파괴되기 전에 WebSocket 연결 해제
    this.disconnect();
  }
}
</script>

<style scoped>
.chat-room-view {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px); /* 헤더/네비게이션 높이 제외한 전체 높이, 조절 필요 */
  max-width: 800px;
  margin: 20px auto;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
}
.room-header {
  text-align: center;
  padding-bottom: 15px;
  border-bottom: 1px solid #eee;
}
.room-header h1 { margin-top: 0; }
#status { font-weight: bold; margin-top: 5px; }
.status-connected { color: green; }
.status-disconnected { color: red; }
.status-connecting { color: orange; }

.chat-container {
  flex-grow: 1; /* 남은 공간을 모두 차지하도록 */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* 내부 스크롤은 messages-area에서 */
  margin-top: 15px;
}
.messages-area {
  flex-grow: 1;
  overflow-y: auto;
  border: 1px solid #e0e0e0;
  padding: 10px;
  margin-bottom: 10px;
  background-color: #f9f9f9;
}
.message {
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 15px;
  max-width: 70%;
  word-wrap: break-word;
}
.message.my-message {
  background-color: #DCF8C6; /* 내 메시지 배경색 */
  margin-left: auto; /* 오른쪽 정렬 */
  border-bottom-right-radius: 5px;
}
.message:not(.my-message) {
  background-color: #E5E5EA; /* 다른 사람 메시지 배경색 */
  margin-right: auto; /* 왼쪽 정렬 */
  border-bottom-left-radius: 5px;
}
.message .sender {
  font-weight: bold;
  display: block;
  font-size: 0.85em;
  color: #555;
  margin-bottom: 3px;
}
.message.system-message { /* JOIN, LEAVE 메시지 스타일 */
  text-align: center;
  font-style: italic;
  color: #777;
  background-color: transparent;
  font-size: 0.9em;
  width: 100%;
  max-width: 100%;
}
.message.system-message .content {
   display: inline-block; /* 가운데 정렬된 텍스트가 너무 길어지지 않도록 */
}


.message-input-area {
  display: flex;
  margin-top: 10px;
  border-top: 1px solid #eee;
  padding-top: 15px;
}
.message-input-area input[type="text"] {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #ccc;
  border-radius: 20px;
  margin-right: 10px;
}
.message-input-area button {
  padding: 10px 20px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 20px;
  cursor: pointer;
}
.message-input-area button:hover {
  background-color: #0056b3;
}
.message-input-area button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.navigation-links {
  margin-top: 20px;
  text-align: center;
  padding-top: 15px;
  border-top: 1px solid #eee;
}
.navigation-links a {
  margin: 0 10px;
}
</style>