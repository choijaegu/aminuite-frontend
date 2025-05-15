<template>
  <div id="app">
    <nav>
      <router-link to="/">홈</router-link> |
      </nav>
    <router-view/>
  </div>
</template>

<script>
export default {
  name: 'App'
  // 이전에 App.vue에 있던 카테고리 목록 불러오는 로직 등은
  // 이제 HomeView.vue로 옮겨갈 것이므로 여기서는 지웁니다.
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

nav {
  padding: 30px;
}

nav a {
  font-weight: bold;
  color: #2c3e50;
}

nav a.router-link-exact-active {
  color: #42b983;
}
</style>