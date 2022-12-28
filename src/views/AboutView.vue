<template>
  <div class="about">
    <h1>This is an about page</h1>
    <ul>
      <li v-for="todo in data?.listTodos?.items ?? []" :key="todo.id">{{ todo.name }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
  import { listTodos } from '@/graphql/queries'
  import { API, graphqlOperation } from 'aws-amplify'
  import type { ListTodosQuery } from "@/API"
  import type { GraphQLQuery } from "@aws-amplify/api"
  import { ref } from "vue"

  function useGraphQL<T>(query: any) {
    const data = ref({} as GraphQLQuery<T>)
    const loading = ref(true)

    API.graphql<GraphQLQuery<T>>(graphqlOperation(query))
        .then(res => {
          loading.value = false
          data.value = res.data
        })
    return { data, loading }
  }

  const { data } = useGraphQL<ListTodosQuery>(listTodos)
</script>
<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
</style>
