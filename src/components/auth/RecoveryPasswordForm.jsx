import { isIosNative } from '../../utils/platform'
import { RecoveryPasswordForm as RecoveryPasswordFormIos } from './RecoveryPasswordForm.ios'
import { RecoveryPasswordForm as RecoveryPasswordFormWeb } from './RecoveryPasswordForm.web'

export function RecoveryPasswordForm(props) {
  const Comp = isIosNative()
    ? RecoveryPasswordFormIos
    : RecoveryPasswordFormWeb
  return <Comp {...props} />
}
