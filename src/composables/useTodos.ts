import { API, graphqlOperation } from 'aws-amplify'
import { listTodos } from '@/graphql/queries'
import type { ListTodosQuery, Todo as TodoType, UpdateTodoMutation } from "@/API"
import type { GraphQLQuery } from "@aws-amplify/api"
import { ref } from "vue"
import type { Ref } from "vue"
import { updateTodo } from "@/graphql/mutations"

class Todo implements TodoType {
    __typename: "Todo" = "Todo"
    id: string = ''
    name: string = ''
    description?: string | null
    completed?: boolean | null = false
    createdAt: string = ''
    updatedAt: string = ''
    _version: number = 0
    _deleted?: boolean | null
    _lastChangedAt: number = 0

    constructor(todo: Record<string, any>) {
        this.copyFrom(todo)
    }

    private copyFrom(todo: Record<string, any>) {
        Object.keys(todo).forEach(key => {
            (this as Record<string, any>)[key] = todo[key]
        })
    }

    async toggleCompleted() {
        const update = await API.graphql<GraphQLQuery<UpdateTodoMutation>>(graphqlOperation(updateTodo, {
            input: {
                id: this.id,
                completed: !this.completed,
                _version: this._version,
            },
            condition: {
                completed: { eq: this.completed }
            }
        }))
        if (update.data?.updateTodo) {
            this.copyFrom(update.data.updateTodo)
        }
    }
}

export function useTodos() {

    const todos: Ref<Todo[]> = ref([])
    const pending: Ref<boolean> = ref(false)

    const notNull = <T>(v: T | null | undefined): v is T => v !== null && v !== undefined

    const refresh = async (): Promise<void> => {
        try {
            pending.value = true
            const response = await API.graphql<GraphQLQuery<ListTodosQuery>>(graphqlOperation(listTodos))
            let items = response.data?.listTodos?.items ?? []
            todos.value = items.filter(notNull).map(todo => new Todo(todo))
        } catch (e) {
            console.log(e)
            // TODO: error handling
        } finally {
            pending.value = false
        }
    }

    refresh()

    return {
        todos,
        pending,
        refresh,
    }
}
