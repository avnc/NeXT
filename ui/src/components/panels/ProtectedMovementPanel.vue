<template>
  <v-card class="mb-2">
    <v-card-title class="d-flex align-center">
      <v-icon class="me-2">mdi-shield-move</v-icon>
      {{ $t('plugins.nxt.panels.protectedMovement.caption') }}
      <v-spacer />
      <v-chip v-if="activeProbeId >= 0" color="primary" variant="tonal">
        {{ $t('plugins.nxt.panels.protectedMovement.protected', [activeProbeId]) }}
      </v-chip>
    </v-card-title>

    <v-card-text>
      <v-alert v-if="availableProbes.length === 0" type="warning" class="mb-3">
        {{ $t('plugins.nxt.panels.protectedMovement.noProbes') }}
      </v-alert>
      <v-alert v-else-if="activeProbeId < 0" type="warning" class="mb-3">
        {{ $t('plugins.nxt.panels.protectedMovement.configureProbe') }}
      </v-alert>
      <v-alert v-else-if="!allAxesHomed" type="warning" class="mb-3">
        {{ $t('plugins.nxt.panels.protectedMovement.homeAll') }}
      </v-alert>
      <v-alert v-if="moveError" type="error" closable class="mb-3" @click:close="moveError = ''">
        {{ moveError }}
      </v-alert>

      <v-row dense class="mb-2">
        <v-col cols="12" sm="6" md="3">
          <v-select
            v-model="currentWorkplace"
            :items="workCoordinates"
            :label="$t('plugins.nxt.panels.protectedMovement.wcs')"
            :disabled="!canHome"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="selectWorkplace"
          />
        </v-col>
        <v-col cols="6" sm="3" md="3">
          <v-btn block color="primary" :disabled="!canHome" @click="sendCode('G28')">
            {{ $t('plugins.nxt.panels.protectedMovement.homeAllButton') }}
          </v-btn>
        </v-col>
        <v-col cols="6" sm="3" md="3">
          <v-btn block :disabled="!canHome" @click="setWorkplaceZero">
            {{ $t('plugins.nxt.panels.protectedMovement.setZero') }}
          </v-btn>
        </v-col>
        <v-col cols="12" sm="6" md="3">
          <v-btn block :disabled="!canHome" @click="goToWorkplaceZero">
            {{ $t('plugins.nxt.panels.protectedMovement.goZero') }}
          </v-btn>
        </v-col>
      </v-row>

      <v-row v-for="axis in visibleAxes" :key="axis.letter" dense align="center">
        <v-col cols="4" sm="4" md="1" order="1">
          <v-btn
            block
            color="warning"
            :disabled="!canHome"
            :title="$t('plugins.nxt.panels.protectedMovement.setAxisZero', [axis.letter])"
            @click="sendCode(`G10 L20 P${currentWorkplace} ${axisCode(axis.letter)}0`)"
          >
            {{ $t('plugins.nxt.panels.protectedMovement.set', [axis.letter]) }}
          </v-btn>
        </v-col>
        <v-col cols="6" md="5" order="3" order-md="2">
          <v-row dense>
            <v-col v-for="(step, index) in moveSteps(axis.letter)" :key="`neg-${index}`" :class="moveCellClass(index)">
              <v-btn
                block
                :disabled="!canMove(axis)"
                :title="$t('plugins.nxt.panels.protectedMovement.moveBy', [-step, axis.letter])"
                @click="sendJog(axis, step, -1)"
              >
                <v-icon>mdi-chevron-left</v-icon>
                {{ axis.letter }}{{ showSign(-step) }}
              </v-btn>
            </v-col>
          </v-row>
        </v-col>
        <v-col cols="6" md="5" order="4" order-md="3">
          <v-row dense>
            <v-col v-for="(step, index) in moveSteps(axis.letter).slice().reverse()" :key="`pos-${index}`" :class="moveCellClass(moveSteps(axis.letter).length - 1 - index)">
              <v-btn
                block
                :disabled="!canMove(axis)"
                :title="$t('plugins.nxt.panels.protectedMovement.moveBy', [step, axis.letter])"
                @click="sendJog(axis, step, 1)"
              >
                {{ axis.letter }}{{ showSign(step) }}
                <v-icon>mdi-chevron-right</v-icon>
              </v-btn>
            </v-col>
          </v-row>
        </v-col>
        <v-col cols="4" offset="8" sm="4" offset-sm="4" md="1" offset-md="0" order="2" order-md="4">
          <v-btn
            block
            :disabled="!canHome"
            :color="axis.homed ? 'primary' : 'warning'"
            :title="$t('plugins.nxt.panels.protectedMovement.homeAxis', [axis.letter])"
            @click="sendCode(`G28 ${axisCode(axis.letter)}`)"
          >
            {{ $t('plugins.nxt.panels.protectedMovement.homeAxisShort', [axis.letter]) }}
          </v-btn>
        </v-col>
      </v-row>

      <v-menu location="bottom end">
        <template #activator="{ props }">
          <v-btn v-bind="props" block class="mt-2" :disabled="!canHome">
            {{ $t('plugins.nxt.panels.protectedMovement.compensation') }}
            <v-icon end>mdi-menu-down</v-icon>
          </v-btn>
        </template>
        <v-list>
          <v-list-item :title="$t('plugins.nxt.panels.protectedMovement.runBed')" @click="sendCode('G32')" />
          <v-list-item :title="$t('plugins.nxt.panels.protectedMovement.runMesh')" @click="sendCode('G29')" />
          <v-list-item :title="$t('plugins.nxt.panels.protectedMovement.loadMesh')" @click="sendCode('G29 S1')" />
          <v-list-item :title="$t('plugins.nxt.panels.protectedMovement.disableMesh')" @click="sendCode('G29 S2')" />
        </v-list>
      </v-menu>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import type { Axis } from '@duet3d/objectmodel'
import { MachineStatus } from '@duet3d/objectmodel'
import { useMachineStore } from '@/stores/machine'
import { useSettingsStore } from '@/stores/settings'
import { useUiStore } from '@/stores/ui'
import { readFirmwareGlobal } from '../../utils/nxtToolChangerOm'
import i18n from '@/i18n'

const machineStore = useMachineStore()
const settingsStore = useSettingsStore()
const uiStore = useUiStore()
const moveError = ref('')
const currentWorkplace = ref(1)
const workCoordinates = [...Array(9).keys()].map((index) => index + 1)
const supportedProtectedAxes = new Set(['X', 'Y', 'Z', 'A'])

const visibleAxes = computed(() => machineStore.model.move.axes.filter((axis) => axis.visible))
const allAxesHomed = computed(() => visibleAxes.value.length > 0 && visibleAxes.value.every((axis) => axis.homed))
const canHome = computed(() => {
  const status = machineStore.model.state.status
  return machineStore.isConnected && !uiStore.uiFrozen &&
    status !== MachineStatus.processing && status !== MachineStatus.pausing && status !== MachineStatus.resuming
})
const workplaceNumber = computed(() => {
  const motionSystem = machineStore.model.move.motionSystems[machineStore.selectedMotionSystem]
  return motionSystem?.workplaceNumber ?? machineStore.model.move.workplaceNumber ?? 0
})
const availableProbes = computed(() => machineStore.model.sensors.probes.flatMap((probe, id) => {
  if (probe === null || probe.type < 5 || probe.type > 8) return []
  return [{ id, label: `Probe ${id} (type ${probe.type})` }]
}))
const activeProbeId = computed(() => {
  const configured = readFirmwareGlobal(machineStore.model.global, 'nxtTouchProbeID')
  const configuredProbe = availableProbes.value.find((probe) => probe.id === configured)
  if (configuredProbe) return configuredProbe.id
  return availableProbes.value.length === 1 ? availableProbes.value[0].id : -1
})
const protectedProbeAvailable = computed(() => activeProbeId.value >= 0)

watch(workplaceNumber, (value) => { currentWorkplace.value = value + 1 }, { immediate: true })

function moveSteps(letter: string): number[] {
  return settingsStore.moveSteps[letter] ?? settingsStore.moveSteps.default
}

function moveCellClass(index: number): string {
  if (index === 0 || index === 5) return 'd-none d-xxl-block'
  if (index > 1 && index < 4 && index % 2 === 1) return 'd-none d-xl-block'
  return ''
}

function axisCode(letter: string): string {
  return /^[a-z]$/.test(letter) ? `'${letter}` : letter
}

function canMove(axis: Axis): boolean {
  return canHome.value && allAxesHomed.value && protectedProbeAvailable.value &&
    supportedProtectedAxes.has(axis.letter.toUpperCase())
}

function showSign(value: number): string {
  return value > 0 ? `+${value}` : String(value)
}

async function sendCode(code: string) {
  moveError.value = ''
  try {
    await machineStore.sendCode(code)
  } catch (error) {
    moveError.value = error instanceof Error ? error.message : String(error)
  }
}

async function sendJog(axis: Axis, step: number, direction: -1 | 1) {
  moveError.value = ''
  const distance = step * direction
  if (!allAxesHomed.value || !protectedProbeAvailable.value) {
    moveError.value = i18n.global.t('plugins.nxt.panels.protectedMovement.moveNeedsHomeProbe')
    return
  }
  const currentPosition = axis.machinePosition
  if (typeof currentPosition !== 'number' || !Number.isFinite(currentPosition)) {
    moveError.value = `Machine position for ${axis.letter} is unavailable.`
    return
  }
  const target = currentPosition + distance
  if (target < axis.min || target > axis.max) {
    moveError.value = i18n.global.t('plugins.nxt.panels.protectedMovement.targetOutOfBounds', [axis.letter, target.toFixed(3)])
    return
  }

  const letter = axisCode(axis.letter)
  const code = `M120\nG21\nG90\nG6550 I${activeProbeId.value} ${letter}${target}\nM121`
  await sendCode(code)
}

async function selectWorkplace(value: number) {
  currentWorkplace.value = value
  const code = value < 7 ? `G${53 + value}` : `G59.${value - 6}`
  await sendCode(`${code}\nG10 L20 P${value}`)
}

async function setWorkplaceZero() {
  let code = `G10 L20 P${currentWorkplace.value}`
  for (const axis of visibleAxes.value) code += ` ${axisCode(axis.letter)}0`
  await sendCode(`${code}\nG10 L20 P${currentWorkplace.value}`)
}

async function goToWorkplaceZero() {
  await sendCode('M98 P"nxt-workzero.g"')
}
</script>