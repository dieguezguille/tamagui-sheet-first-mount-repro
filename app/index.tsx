import { useState } from 'react'
import { Button, Paragraph, Sheet, YStack } from 'tamagui'

export default function Home() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <YStack flex={1} alignItems="center" justifyContent="center" backgroundColor="$background">
        <Button testID="open" onPress={() => setOpen(true)}>
          Open sheet
        </Button>
      </YStack>
      <Sheet modal open={open} onOpenChange={setOpen} snapPointsMode="fit" dismissOnSnapToBottom unmountChildrenWhenHidden>
        <Sheet.Overlay testID="overlay" />
        <Sheet.Frame testID="frame" padding="$4" gap="$4" paddingBottom="$8">
          <Paragraph>Sheet content</Paragraph>
          <Button testID="close" onPress={() => setOpen(false)}>
            Close sheet
          </Button>
        </Sheet.Frame>
      </Sheet>
    </>
  )
}
