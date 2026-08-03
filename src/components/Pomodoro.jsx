import { isIosNative } from '../utils/platform'
import { Pomodoro as PomodoroIos } from './Pomodoro.ios'
import { Pomodoro as PomodoroWeb } from './Pomodoro.web'

export function Pomodoro(props) {
  const Comp = isIosNative() ? PomodoroIos : PomodoroWeb
  return <Comp {...props} />
}
