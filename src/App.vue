<template>
  <div v-if="pending">Loading...</div>
  <ul v-else>
    <li v-for="todo in todos">
      <input type="checkbox" :checked="todo.completed" @change="toggleCompleted(todo.id)" /> {{ todo.name }}
    </li>
  </ul>
</template>

<script setup lang="ts">

import { useTodos } from "@/composables/useTodos"

const { todos, pending, toggleCompleted } = useTodos()

</script>


