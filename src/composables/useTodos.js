import { API, graphqlOperation } from 'aws-amplify';
import { listTodos } from '@/graphql/queries';
import { ref } from "vue";
import { updateTodo } from "@/graphql/mutations";
class Todo {
    __typename = "Todo";
    id = '';
    name = '';
    description;
    completed = false;
    createdAt = '';
    updatedAt = '';
    _version = 0;
    _deleted;
    _lastChangedAt = 0;
    constructor(todo) {
        this.copyFrom(todo);
    }
    copyFrom(todo) {
        Object.keys(todo).forEach(key => {
            this[key] = todo[key];
        });
    }
    async toggleCompleted() {
        const update = await API.graphql(graphqlOperation(updateTodo, {
            input: {
                id: this.id,
                completed: !this.completed,
                _version: this._version,
            },
            condition: {
                completed: { eq: this.completed }
            }
        }));
        if (update.data?.updateTodo) {
            this.copyFrom(update.data.updateTodo);
        }
    }
}
export function useTodos() {
    const todos = ref([]);
    const pending = ref(false);
    const notNull = (v) => v !== null && v !== undefined;
    const refresh = async () => {
        try {
            pending.value = true;
            const response = await API.graphql(graphqlOperation(listTodos));
            let items = response.data?.listTodos?.items ?? [];
            todos.value = items.filter(notNull).map(todo => new Todo(todo));
        }
        catch (e) {
            console.log(e);
            // TODO: error handling
        }
        finally {
            pending.value = false;
        }
    };
    refresh();
    return {
        todos,
        pending,
        refresh,
    };
}
