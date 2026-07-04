import { BrandMark } from './Brand'

export function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-paper gap-6">
      <BrandMark size={36} />
      <div className="flex items-end gap-1 h-8" aria-label="Memuat">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1 bg-brand rounded-full animate-pulse-ring"
            style={{
              animationDelay: `${i * 120}ms`,
              height: `${14 + (i % 3) * 8}px`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
