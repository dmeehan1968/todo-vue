<template>
  <Authenticator>
    <template v-slot="{ user, signOut }">
      <div class="welcome">
        <h3>Hey {{ user.username }}</h3>
        <button @click="signOut">Sign Out</button>
      </div>
      <h1>Todos</h1>
      <p v-if="pending">Loading...</p>
      <ul v-else-if="todos.length ?? false">
        <li v-for="todo in todos">
          <label>
            <input type="checkbox" :checked="todo.completed" @click="toggleCompleted(todo)" />
            {{ todo.name }}
            (<a href="" @click.prevent="deleteTodo(todo)">X</a>)
          </label>
        </li>
      </ul>
      <p v-else>None found</p>
      <div>
        <input type="text" placeholder="title" v-model="title" />
        <button @click="createTodo" :disabled="title.length === 0">Submit</button>
      </div>
      <button @click="refresh">Refresh</button>
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

interface Todo {
  id: string
  name: string
  completed: boolean
}

function useTodos() {
  const data = ref([] as Todo[])
  const errors = ref([] as string[])
  const pending = ref(false)
  const apiName = 'todosApi'
  const path = '/todos'

  async function execute() {
    try {
      pending.value = true
      data.value = (await API.get(apiName, path, {})).data
    } catch(e) {
      errors.value.push(String(e))
    } finally {
      pending.value = false
    }
  }

  async function createTodo() {
    const body = { name: title.value, completed: false }
    try {
      const res = await API.post(apiName, path, { body })
      if (res.data) {
        data.value.push(res.data)
        title.value = ''
      }
    } catch (e) {
      console.log('error', e)
    }
  }

  async function deleteTodo(todo: Todo) {
    try {
      await API.del(apiName, `${path}/${todo.id}`, {})
      data.value = data.value.filter(item => item.id !== todo.id)
    } catch (e) {
      console.log('error', e)
    }
  }

  async function toggleCompleted(todo: Todo) {
    try {
      const res = await API.put(apiName, `${path}/${todo.id}`, {})
      const index = data.value.findIndex(item => item.id === todo.id)
      if (index >= 0) {
        data.value[index] = res.data
      }
    } catch (e) {
      console.log('error', e)
    }
  }

  setTimeout(execute, 0)

  return { data, errors, pending, execute, createTodo, deleteTodo, toggleCompleted }
}

const title = ref('')

const { pending, data: todos, errors, execute: refresh, createTodo, deleteTodo, toggleCompleted } = useTodos()

// import { useTodos } from "@/composables/useTodos"
//
// const { todos, pending } = useTodos()

</script>


