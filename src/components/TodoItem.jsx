import { isIosNative } from '../utils/platform'
import { TodoItem as TodoItemIos } from './TodoItem.ios'
import { TodoItem as TodoItemWeb } from './TodoItem.web'

export function TodoItem(props) {
  const Comp = isIosNative() ? TodoItemIos : TodoItemWeb
  return <Comp {...props} />
}
