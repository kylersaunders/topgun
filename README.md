# Top Gun

[![Deployment](https://img.shields.io/website?url=https%3A%2F%2Ftopgun.vercel.app%2F&up_message=live&down_message=down&label=deployment)](https://topgun.vercel.app/)
[![Vercel](https://img.shields.io/badge/platform-Vercel-black?logo=vercel)](https://topgun.vercel.app/)
[![Last Commit](https://img.shields.io/github/last-commit/kylersaunders/topgun)](https://github.com/kylersaunders/topgun/commits/main)

A Pieter-inspired browser flight sim from the early vibe-coding era.

## Live Deployment

Production: https://topgun.vercel.app/

## What It Is

- A lightweight 3D arcade dogfighter that runs in the browser
- Built around Three.js scene rendering and a quaternion-based flight model
- Wing-mounted lasers, enemy jets with hit points, and a world populated with
  bird flocks and traffic on the ground
- Supports keyboard controls on desktop and touch/joystick controls on mobile
- Live flight readouts: altitude, heading, speed, thrust, pitch, roll, kills and
  bogey count

## Controls

Desktop:

- `W` / `S` — throttle
- `←` / `→` — roll (hold to hold a banked turn)
- `↑` / `↓` — pitch; pull back (`↓`) to climb
- `A` / `D` — rudder
- `Space` — fire lasers
- `H` — show controls

Mobile:

- Touch joystick for pitch and roll
- On-screen thrust slider
- `FIRE` button for the lasers

## Combat

- Enemy jets spawn automatically around you, up to five at a time, and are
  recycled once they stray too far.
- Each takes five laser hits; on the fifth it explodes and disappears.
- Red boxes track bogeys on screen; bogeys behind or off to the side get a
  dashed marker pinned to the screen edge, with the range in metres.
- Birds and ground traffic are soft targets — one hit and they scatter.

## Flight Model

Attitude is driven entirely through the quaternion. The three body rates (pitch,
roll, yaw) are combined into a single angular-velocity vector and applied as one
axis-angle rotation per step, so the axes stay independent at any attitude and
the flight path is frame-rate independent.

Roll commands a *bank angle* rather than an endless roll rate — authority eases
out at 75 degrees — so holding the key gives a sustained turn instead of a barrel
roll. Bank turns the heading via the horizontal component of the lift vector, and
pulling back adds angle of attack so a hard bank can hold its altitude. Release
the stick and the plane rolls wings-level and eases the nose back to the horizon.

## Tests

The flight and combat models run headlessly under Node — no WebGL involved:

```bash
npm test
```

This covers the control-axis invariants, turn direction, auto-level (including
recovery from inverted), frame-rate independence, stall and ground handling, and
the laser/hit-point/kill path including swept-segment collision that stops fast
bolts tunnelling through targets.

## Stack

- JavaScript
- Three.js
- Vite
- nipplejs
- Vercel

## Local Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Stack Notes

- `js/airplane.js` — flight model (quaternion attitude, lift/gravity, ground)
- `js/camera.js` — chase camera that rolls with the aircraft
- `js/weapons.js` — pooled laser bolts with swept-segment collision
- `js/enemies.js` — enemy jets, AI waypoints, hit points, explosions
- `js/wildlife.js` — bird flocks and ground traffic
- `js/jetMesh.js` — shared jet model used by the player and the enemies

## Deploy

Current production deployment:

https://topgun.vercel.app/
