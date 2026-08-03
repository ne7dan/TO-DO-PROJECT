import { isIosNative } from '../../utils/platform'
import { LoginForm as LoginFormIos } from './LoginForm.ios'
import { LoginForm as LoginFormWeb } from './LoginForm.web'

export function LoginForm(props) {
  const Comp = isIosNative() ? LoginFormIos : LoginFormWeb
  return <Comp {...props} />
}
