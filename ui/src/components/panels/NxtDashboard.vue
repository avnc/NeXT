<template>
  <HubTiles v-if="showHub" />
  <FFFDashboardPanel v-else-if="isFFForUnset" />
  <NxtCncDashboardPanel v-else />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MachineMode } from '@duet3d/objectmodel'
import { useRoute } from 'vue-router'
import { FFFDashboardPanel, HubTiles } from 'DuetWebControl/components'
import { DashboardMode, useSettingsStore } from '@/stores/settings'
import { useMenuStore } from '@/stores/menu'
import { useMachineStore } from '@/stores/machine'
import NxtCncDashboardPanel from './NxtCncDashboardPanel.vue'
import { useNxtDisplayBreakpoints } from '../../utils/useNxtDisplayBreakpoints'

const { mdAndUp } = useNxtDisplayBreakpoints()
const route = useRoute()
const menuStore = useMenuStore()
const machineStore = useMachineStore()
const settingsStore = useSettingsStore()

const showHub = computed(() => route.path === '/' && !mdAndUp.value && menuStore.allItems.length > 0)
const isFFForUnset = computed(() => {
  if (settingsStore.dashboardMode === DashboardMode.default) {
    return !machineStore.model.state.machineMode || machineStore.model.state.machineMode === MachineMode.fff
  }
  return settingsStore.dashboardMode === DashboardMode.fff
})
</script>