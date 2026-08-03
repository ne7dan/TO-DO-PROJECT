import { isIosNative } from '../../utils/platform'
import { AuthScreen as AuthScreenIos } from './AuthScreen.ios'
import { AuthScreen as AuthScreenWeb } from './AuthScreen.web'

/**
 * Auth: iOS-вёрстка из этого чата, web — исходная.
 */
export function AuthScreen(props) {
  const Comp = isIosNative() ? AuthScreenIos : AuthScreenWeb
  return <Comp {...props} />
}
