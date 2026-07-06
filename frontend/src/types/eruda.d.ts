declare module 'eruda' {
  interface Eruda {
    init(): void
    destroy(): void
    clear(): void
  }
  const eruda: Eruda
  export default eruda
}
