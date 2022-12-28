import { API, graphqlOperation } from 'aws-amplify'
import { listTodos } from '@/graphql/queries'
import type { ListTodosQuery, Todo, UpdateTodoMutation } from "@/API"
import type { GraphQLQuery } from "@aws-amplify/api"
import { ref } from "vue"
import type { Ref } from "vue"
import { updateTodo } from "@/graphql/mutations"

export function useTodos() {

    const todos: Ref<Todo[]> = ref([])
    const pending: Ref<boolean> = ref(false)

    const notNull = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined

    const refresh = async (): Promise<void> => {
        try {
            pending.value = true
            const response = await API.graphql<GraphQLQuery<ListTodosQuery>>(graphqlOperation(listTodos))
            let items = response.data?.listTodos?.items ?? []
            todos.value = items.filter(notNull)
        } catch (e) {
            // TODO: error handling
        } finally {
            pending.value = false
        }
    }

    const toggleCompleted = async (id: string): Promise<void> => {
        try {
            const index = todos.value.findIndex(todo => todo.id === id)
            if (index >= 0) {
                const input = {
                    id,
                    completed: !todos.value[index].completed,
                    _version: todos.value[index]._version,
                }
                const response = await API.graphql<GraphQLQuery<UpdateTodoMutation>>(graphqlOperation(updateTodo, { input }))
                if (response?.data?.updateTodo) {
                    todos.value[index] = response.data.updateTodo
                }
            }
        } catch (e) {
            // TODO: error handling
        }
    }

    refresh()

    return {
        todos,
        pending,
        refresh,
        toggleCompleted,
    }
}
