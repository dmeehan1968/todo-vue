<template>
  <Authenticator>
    <template v-slot="{ user, signOut }">
      <div class="welcome">
        <h1>Hey {{ user.username }}</h1>
        <button @click="signOut">Sign Out</button>
      </div>
      <h1>Todos</h1>
      <div>
        <button @click="getTodos">Get Todos</button>
      </div>
      <ul>
        <li v-for="todo in todos">
          {{ todo.name }}
        </li>
      </ul>
    </template>
  </Authenticator>
<!--  <div v-if="pending">Loading...</div>-->
<!--  <ul v-else>-->
<!--    <li v-for="todo in todos">-->
<!--      <input type="checkbox" :checked="todo.completed" @change="todo.toggleCompleted()" /> {{ todo.name }}-->
<!--    </li>-->
<!--  </ul>-->
</template>

<script setup lang="ts">
import { Authenticator } from '@aws-amplify/ui-vue'
import { ref } from "vue"
import { API } from "aws-amplify"

function useTodos() {
  const todos = ref([])
  function getTodos() {
    console.log('Get Todos')
    API.get('todosApi', '/todos/x', {})
        .then(res => console.log(res))
        .catch(e => console.log(e))
  }

  return { todos, getTodos }
}

const { todos, getTodos } = useTodos()



// import { useTodos } from "@/composables/useTodos"
//
// const { todos, pending } = useTodos()

</script>


