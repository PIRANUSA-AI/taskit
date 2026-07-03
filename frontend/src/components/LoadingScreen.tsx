export function LoadingScreen() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-paper">
      <div className="flex items-end gap-1 h-12" aria-label="Memuat">
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className="w-1.5 bg-navy rounded-full animate-pulse-ring"
            style={{
              animationDelay: `${i * 120}ms`,
              height: `${20 + (i % 3) * 12}px`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
