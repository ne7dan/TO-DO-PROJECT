import { useEffect, useId, useRef, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { useLocale } from '../i18n/LocaleContext'
import { ACCENTS, BG_THEMES } from '../utils/appearance'

/**
 * Панель выбора фона темы и акцентного цвета.
 * Вешает выбор через колбэки родителя (useTheme → localStorage + data-*).
 */
export function ThemeCustomizer({
  bgTheme,
  accent,
  isDark = true,
  onBgThemeChange,
  onAccentChange,
}) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative z-[60]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('appearance.open')}
        title={t('appearance.open')}
        aria-expanded={open}
        aria-controls={panelId}
        className={[
          'ui-chip touch-target relative z-[61] flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-[var(--bg-warm)] active:bg-[var(--bg-warm)]',
          open ? 'ring-2 ring-[var(--accent-color)] ring-offset-2 ring-offset-[var(--bg-main)]' : '',
        ].join(' ')}
      >
        <Palette size={18} strokeWidth={1.75} />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t('appearance.title')}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-[70] w-max max-w-[min(100vw-1.5rem,14rem)] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.22)] animate-fade-in"
        >
          <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {t('appearance.theme')}
          </p>
          <div className="mb-4 flex items-center gap-2.5">
            {BG_THEMES.map((theme) => {
              const active = bgTheme === theme.id
              const swatch = isDark ? theme.swatchDark : theme.swatchLight
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onBgThemeChange(theme.id)}
                  aria-label={t(`appearance.theme.${theme.id}`)}
                  title={t(`appearance.theme.${theme.id}`)}
                  aria-pressed={active}
                  className={[
                    'theme-swatch touch-target relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-2 transition-transform duration-150',
                    active
                      ? 'border-[var(--accent-color)] scale-105 shadow-[0_0_0_3px_var(--accent-glow)]'
                      : isDark
                        ? 'border-white/20 hover:-translate-y-0.5 active:scale-95'
                        : 'border-black/10 hover:-translate-y-0.5 active:scale-95',
                  ].join(' ')}
                  style={{ backgroundColor: swatch }}
                >
                  {active && (
                    <Check
                      size={14}
                      strokeWidth={2.5}
                      className={
                        isDark
                          ? 'text-white drop-shadow'
                          : 'text-zinc-800 drop-shadow-sm'
                      }
                      aria-hidden
                    />
                  )}
                </button>
              )
            })}
          </div>

          <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            {t('appearance.accent')}
          </p>
          <div className="grid w-full grid-cols-4 place-items-center gap-y-2.5">
            {ACCENTS.map((item) => {
              const active = accent === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onAccentChange(item.id)}
                  aria-label={t(`appearance.accent.${item.id}`)}
                  title={t(`appearance.accent.${item.id}`)}
                  aria-pressed={active}
                  className={[
                    'accent-swatch touch-target h-11 w-11 cursor-pointer rounded-full border-2 transition-[transform,box-shadow] duration-150',
                    active
                      ? 'scale-110 border-white/80'
                      : 'border-transparent opacity-90 hover:opacity-100 active:opacity-100',
                  ].join(' ')}
                  style={{
                    backgroundColor: item.swatch,
                    boxShadow: active
                      ? `0 0 0 3px color-mix(in srgb, ${item.swatch} 50%, transparent)`
                      : undefined,
                  }}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
