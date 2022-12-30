<template>
  <div v-if="pending">Loading...</div>
  <ul v-else>
    <li v-for="todo in todos">
      <input type="checkbox" :checked="todo.completed" @change="todo.toggleCompleted()" /> {{ todo.name }}
    </li>
  </ul>
</template>

<script setup lang="ts">

import { useTodos } from "@/composables/useTodos"

const { todos, pending } = useTodos()

</script>


