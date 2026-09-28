import { StyleSheet } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { TamaguiProvider } from 'tamagui'
import Home from './app/index'
import config from './tamagui.config'

// SheetImplementationCustom's offscreen start position, before the sheet has measured itself
const hiddenSize = 10000.1
const screenSize = 844
const frameSize = 300

const mockHops: (() => void)[] = []
const mockValues: { initial: unknown; value: unknown }[] = []

jest.mock('react-native-worklets', () => jest.requireActual('react-native-worklets/src/mock'))
jest.mock('react-native-reanimated', () => {
  const { useRef } = jest.requireActual('react')
  const mock = jest.requireActual('react-native-reanimated/mock')
  return {
    ...mock,
    // runOnJS is a hop from the ui thread back to the js thread. the official mock runs it inline; here it waits until the test delivers it
    runOnJS:
      (fn: (...args: unknown[]) => void) =>
      (...args: unknown[]) =>
        mockHops.push(() => fn(...args)),
    // the official mock returns a new shared value on every render
    useSharedValue: (initial: unknown) => {
      const ref = useRef(null)
      if (!ref.current) {
        ref.current = { initial, value: initial }
        mockValues.push(ref.current)
      }
      return ref.current
    },
  }
})

jest.useFakeTimers()

beforeEach(() => {
  mockHops.length = 0
  mockValues.length = 0
})

test('the sheet slides in once the ui thread answers', async () => {
  await open()
  await act(async () => {
    while (mockHops.length > 0) mockHops.shift()?.()
    jest.advanceTimersByTime(100)
  })
  expect(position()).toBe(screenSize - frameSize)
})

test('the first open does not wait on a callback from the ui thread', async () => {
  const app = await open()
  await act(async () => jest.advanceTimersByTime(10_000))
  expect(app.root.findAllByProps({ testID: 'overlay' }).length).toBeGreaterThan(0)
  // stock 2.7.7: the frame is still parked at screenSize (just below the screen), waiting for runOnJS(onFinish)
  expect(position()).toBe(screenSize - frameSize)
})

async function open() {
  let app: ReactTestRenderer | undefined
  await act(async () => {
    app = create(
      <TamaguiProvider config={config} defaultTheme="light">
        <Home />
      </TamaguiProvider>,
    )
  })
  if (!app) throw new Error('app did not render')
  const rendered = app
  await act(async () => rendered.root.findByProps({ testID: 'open' }).props.onPress())
  await act(async () => {
    // jest has no layout: the invisible full-screen view measures the screen, the frame measures its content
    for (const node of rendered.root.findAll((node) => typeof node.props.onLayout === 'function')) {
      const height = StyleSheet.flatten(node.props.style)?.opacity === 0 ? screenSize : frameSize
      node.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } })
    }
  })
  return rendered
}

// where the sheet's animated number, and so the frame's translateY, currently is
function position() {
  const values = mockValues.filter(({ initial }) => initial === hiddenSize)
  if (values.length !== 1) throw new Error(`expected one sheet position, found ${values.length}`)
  return values[0]?.value
}
