#!/usr/bin/env node
/** Uncongested OSRM driving minutes from 427 Ridgewood Rd. Not typical 8am. */
const HOME = { lon: -97.7902325, lat: 30.277964 }

const DEST = {
  sunset: { lon: -97.8054605, lat: 30.2274157 },
  mariposa: { lon: -97.8288142, lat: 30.2089666 },
  primrose: { lon: -97.8007337, lat: 30.274595 },
  guidepost: { lon: -97.8153115, lat: 30.2869494 },
}

for (const [name, p] of Object.entries(DEST)) {
  const url = `https://router.project-osrm.org/route/v1/driving/${HOME.lon},${HOME.lat};${p.lon},${p.lat}?overview=false`
  const res = await fetch(url, { headers: { 'User-Agent': 'tuchel-daycare-focus/1.0' } })
  const data = await res.json()
  const min = data.routes[0].duration / 60
  const mi = data.routes[0].distance / 1609.34
  console.log(`${name}\t${min.toFixed(1)} min\t${mi.toFixed(2)} mi`)
}
