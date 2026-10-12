import { isIosNative } from '../utils/platform'
import { HabitTracker as HabitTrackerIos } from './HabitTracker.ios'
import { HabitTracker as HabitTrackerWeb } from './HabitTracker.web'

export function HabitTracker(props) {
  const Comp = isIosNative() ? HabitTrackerIos : HabitTrackerWeb
  return <Comp {...props} />
}
