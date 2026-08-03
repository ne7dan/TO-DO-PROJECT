import { isIosNative } from '../utils/platform'
import { ProfileModal as ProfileModalIos } from './ProfileModal.ios'
import { ProfileModal as ProfileModalWeb } from './ProfileModal.web'

export function ProfileModal(props) {
  const Comp = isIosNative() ? ProfileModalIos : ProfileModalWeb
  return <Comp {...props} />
}
