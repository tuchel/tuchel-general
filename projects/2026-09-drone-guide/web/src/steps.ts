export interface BuildStep {
  title: string
  body: string
  check: string
  grownup?: boolean
}

export const BUILD_STEPS: BuildStep[] = [
  {
    title: 'The frame',
    body: 'Start with the skeleton. Screw the arms to the center plates. Racing frames are carbon fiber; tiny indoor drones use a one-piece plastic frame.',
    check: 'Wiggle each arm. Nothing should move, and there should be no cracks.',
  },
  {
    title: 'The motors',
    body: 'Screw one motor to the end of each arm. Two spin clockwise and two counter-clockwise, on opposite corners, just like in Part 1.',
    check: 'Use the short screws that came with the motors. A screw that is too long pokes into the wire coils inside and ruins the motor.',
  },
  {
    title: 'The speed controllers',
    body: 'The speed controller board sits in the middle on four metal posts called standoffs. Little rubber rings on the posts soak up shaking.',
    check: 'The board should sit flat and not touch the frame anywhere except the posts.',
  },
  {
    title: 'The brain and the motor wires',
    body: 'The flight controller stacks on top of the speed controllers. Each motor has three wires that connect to the speed controller board. Many small kits use plugs; bigger builds need soldering.',
    check: "The flight controller's arrow must point to the front. If it points the wrong way, the brain thinks forward is sideways, and the drone flips as it takes off.",
    grownup: true,
  },
  {
    title: 'The receiver',
    body: 'Mount the receiver at the back and connect it to the flight controller. Zip-tie the antenna tips so they point up and back.',
    check: 'Spin the drone around by hand. No antenna should reach into a propeller\'s circle, or it gets chopped.',
  },
  {
    title: 'The camera (optional)',
    body: 'An FPV camera goes at the front. Tilt it up a little. When the drone leans forward to fly, the camera then looks straight ahead.',
    check: 'The camera should be held tight so it can\'t shake loose in a crash.',
  },
  {
    title: 'The battery strap',
    body: 'The battery rides on top, held by a strap. The battery only goes on to fly or test, and comes off when you are done.',
    check: 'Pull on the battery. It should not slide. Keep the power wire away from the propellers.',
  },
  {
    title: 'Propellers: always last',
    body: 'Props go on only after the setup test in the next chapter. Each prop is shaped for one spin direction, and the package shows which is which. On this model, orange props go on clockwise motors and blue props on counter-clockwise motors.',
    check: 'Turn each prop gently with a finger in its spin direction. The front edge of each blade should be the higher edge.',
  },
]
