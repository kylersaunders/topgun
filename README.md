# Top Gun

[![Deployment](https://img.shields.io/website?url=https%3A%2F%2Ftopgun.vercel.app%2F&up_message=live&down_message=down&label=deployment)](https://topgun.vercel.app/)
[![Vercel](https://img.shields.io/badge/platform-Vercel-black?logo=vercel)](https://topgun.vercel.app/)
[![Last Commit](https://img.shields.io/github/last-commit/kylersaunders/topgun)](https://github.com/kylersaunders/topgun/commits/main)

A Pieter-inspired browser flight sim from the early vibe-coding era.

## Live Deployment

Production: https://topgun.vercel.app/

## What It Is

- A lightweight 3D flight simulator that runs in the browser
- Built around Three.js scene rendering and a simple aircraft/control model
- Supports keyboard controls on desktop and touch/joystick controls on mobile
- Includes live flight readouts like altitude, heading, speed, thrust, pitch, and roll

## Controls

Desktop:

- `W` / `S` for thrust
- `A` / `D` for rudder
- Arrow keys for pitch and roll
- `H` to show controls

Mobile:

- Touch joystick for directional control
- On-screen thrust slider

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

## Deploy

Current production deployment:

https://topgun.vercel.app/
