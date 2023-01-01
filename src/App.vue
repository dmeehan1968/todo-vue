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
import { ref, watch } from "vue"
import { API } from "aws-amplify"

interface ApiOptions<T> {
  default?(): T
}
function useApi<T = any>(api: string, path: string, init: Record<string, any>, opts: ApiOptions<T> = {}) {
  const data = ref(opts?.default?.())
  const errors = ref([] as string[])
  const pending = ref(false)

  async function execute() {
    try {
      pending.value = true
      data.value = await API.get(api, path, init)
    } catch(e) {
      errors.value.push(String(e))
    } finally {
      pending.value = false
    }
  }

  return { data, errors, pending, execute }
}

const { data: todos, execute: getTodos, errors } = useApi('todosApi', '/todos', {}, {
  default: () => ([])
})

watch([todos, errors], ([todos, errors]) => {
  console.log({ todos, errors })
})

// import { useTodos } from "@/composables/useTodos"
//
// const { todos, pending } = useTodos()

</script>


