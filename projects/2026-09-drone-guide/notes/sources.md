# Sources for claims on the page

| Claim on page | Source |
| --- | --- |
| TRUST test, no minimum age | https://www.faa.gov/faq/what-minimum-age-individuals-required-take-trust |
| Recreational flyers: TRUST, visual line of sight, at or below 400 ft, register at 250 g or more | https://www.faa.gov/uas/recreational_flyers |
| Must be 13 to register; an older person registers for a younger owner | https://www.faa.gov/uas/getting_started/register_drone |
| B4UFLY app for where drones can fly | https://www.faa.gov/uas/getting_started/b4ufly |
| "Many drone brains run this loop 4,000 times every second" (8 kHz gyro / 4 kHz PID loop is the common Betaflight setting) | https://oscarliang.com/best-looptime-flight-controller/ |
| Builders aim for at least 2:1 thrust to weight; hover near 50% throttle | https://www.x-teamrc.com/thrust-to-weight-ratio-explained-2-1-vs-4-1-rule/ · https://www.unmannedtechshop.co.uk/blogs/knowledge-base/fpv-drone-thrust-to-weight-ratio-how-to-calculate-twr |
| Swap any two of three motor wires, or reverse in Betaflight (4.3+), to reverse a brushless motor; a backwards motor flips the drone at takeoff | https://oscarliang.com/change-motor-spin-direction-quadcopter/ |
| Diagonal pairs spin the same way to cancel torque | https://dronebotworkshop.com/how-does-a-quadcopter-work/ |
| Prop size "5×4" = 5 in diameter, 4 in pitch (distance per turn) | Standard hobby naming; see Oscar Liang prop guides |

## Model numbers

The 3D model's physics (`web/src/sim.ts`) sets full power to 2× the drone's weight, so a level hover sits at exactly 50% power: 4 motors × 0.5 power × (weight ÷ 2 per motor at full power) = 1 × weight. This matches the 2:1 rule the page cites.

In the propeller chapter, power is fixed at 75%, so thrust = 0.75 × 2 × (tilt ÷ 25°) weights. Lift-off needs thrust ≥ 1 weight → tilt ≥ 16.7°. The slider's default is 18°.
