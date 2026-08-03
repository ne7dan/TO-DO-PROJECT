import { isIosNative } from '../../utils/platform'
import { SignUpForm as SignUpFormIos } from './SignUpForm.ios'
import { SignUpForm as SignUpFormWeb } from './SignUpForm.web'

export function SignUpForm(props) {
  const Comp = isIosNative() ? SignUpFormIos : SignUpFormWeb
  return <Comp {...props} />
}
