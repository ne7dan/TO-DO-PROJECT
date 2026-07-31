import { lazy, Suspense } from 'react'
import { AuthScreen } from './components/auth/AuthScreen'
import { useAuth } from './hooks/useAuth'
import { useLocale } from './i18n/LocaleContext'
import { isSupabaseConfigured } from './supabaseClient'

/** Тяжёлый экран Todo + Pomodoro + Stats — только после логина */
const TodoApp = lazy(() => import('./TodoApp'))

/**
 * Корень: пока нет session — форма логина/регистрации,
 * после входа — список Todo из Supabase.
 */
export default function App() {
  const { t } = useLocale()
  const {
    session,
    user,
    loading,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    recoveryMode,
    clearRecoveryMode,
  } = useAuth()

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="font-display text-xl font-semibold text-ink dark:text-zinc-50">
            Нет настроек Supabase
          </h1>
          <p className="text-sm text-muted dark:text-zinc-400">
            На Vercel добавьте переменные{' '}
            <code className="text-ink dark:text-zinc-200">VITE_SUPABASE_URL</code> и{' '}
            <code className="text-ink dark:text-zinc-200">
              VITE_SUPABASE_PUBLISHABLE_KEY
            </code>
            , затем сделайте Redeploy.
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-muted dark:text-zinc-400">
        {t('auth.loading')}
      </div>
    )
  }

  // Ссылка из письма сброса пароля — форма нового пароля
  if (recoveryMode) {
    return (
      <AuthScreen
        signIn={signIn}
        signUp={signUp}
        requestPasswordReset={requestPasswordReset}
        updatePassword={updatePassword}
        recoveryMode
        clearRecoveryMode={clearRecoveryMode}
      />
    )
  }

  if (!session) {
    return (
      <AuthScreen
        signIn={signIn}
        signUp={signUp}
        requestPasswordReset={requestPasswordReset}
        updatePassword={updatePassword}
        recoveryMode={false}
        clearRecoveryMode={clearRecoveryMode}
      />
    )
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm text-muted dark:text-zinc-400">
          {t('auth.loading')}
        </div>
      }
    >
      <TodoApp
        user={user}
        onSignOut={signOut}
        onRequestPasswordReset={requestPasswordReset}
      />
    </Suspense>
  )
}
