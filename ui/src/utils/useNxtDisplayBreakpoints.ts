import { onMounted, onUnmounted, ref } from 'vue'

export function useNxtDisplayBreakpoints() {
  const mdAndUp = ref(false)

  function sync() {
    mdAndUp.value = window.innerWidth >= 960
  }

  onMounted(() => window.addEventListener('resize', sync))
  onUnmounted(() => window.removeEventListener('resize', sync))
  sync()

  return { mdAndUp }
}