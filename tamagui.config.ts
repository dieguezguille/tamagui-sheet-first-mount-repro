import { defaultConfig } from '@tamagui/config/v5'
import { animations } from '@tamagui/config/v5-reanimated'
import { createTamagui } from 'tamagui'

export default createTamagui({ ...defaultConfig, animations })
