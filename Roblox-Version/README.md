# Street Racer - Roblox Version

This package creates a playable 3D racing game in Roblox Studio and leaves the original browser game untouched. The source files here must be pasted into the matching Roblox Studio scripts; this folder is not an `.rbxl` place file.

## Studio setup

Start from a new Baseplate experience. Create this hierarchy and paste the contents of each matching source file into the indicated script:

```text
ServerScriptService
	StreetRacerServer        Script, keep the existing high-score code
	StreetRacerGame          Script, from ServerScriptService/StreetRacerGame.server.lua
StarterPlayer
	StarterPlayerScripts
		StreetRacerControls    LocalScript, from StarterPlayer/StarterPlayerScripts/StreetRacerControls.client.lua
StarterGui
	StreetRacerScreenGui     ScreenGui, ResetOnSpawn = false
		StreetRacerUI          LocalScript, from StarterGui/StreetRacerScreenGui/StreetRacerUI.client.lua
ReplicatedStorage          created automatically at runtime
Workspace                  track and cars created automatically at runtime
```

1. Keep the existing `StreetRacerServer` Script in `ServerScriptService`. It owns the existing `GetHighScore` and `SubmitScore` DataStore behavior; its code does not need to change.
2. Add a second **Script** named `StreetRacerGame` in `ServerScriptService` and paste [`ServerScriptService/StreetRacerGame.server.lua`](ServerScriptService/StreetRacerGame.server.lua).
3. Add a **LocalScript** named `StreetRacerControls` in `StarterPlayer > StarterPlayerScripts` and paste [`StarterPlayer/StarterPlayerScripts/StreetRacerControls.client.lua`](StarterPlayer/StarterPlayerScripts/StreetRacerControls.client.lua).
4. Add a **ScreenGui** named `StreetRacerScreenGui` to `StarterGui` and set `ResetOnSpawn` to false. Add a **LocalScript** named `StreetRacerUI` inside it and paste [`StarterGui/StreetRacerScreenGui/StreetRacerUI.client.lua`](StarterGui/StreetRacerScreenGui/StreetRacerUI.client.lua).
5. Do not install the older [`StarterPlayer/StarterPlayerScripts/StreetRacer.client.lua`](StarterPlayer/StarterPlayerScripts/StreetRacer.client.lua) arcade preview. It is intentionally disabled; use `StreetRacerControls` and `StreetRacerUI` instead.
6. Press **Play**. The character is seated in the generated car, with the race menu and map visible. Click **Start Race** to drive.

No manually built models or Workspace parts are required. `StreetRacerGame` creates `ReplicatedStorage/StreetRacerRemotes`, per-player track folders in `Workspace/StreetRacerWorld`, road segments, barriers, a drivable `VehicleSeat` car, traffic, and checkpoint progress. The generated road is raised above the default Baseplate so that template geometry cannot cover it. Each player receives an offset track to avoid overlapping multiplayer cars.

## Driving

- **W / Up Arrow**: accelerate.
- **S / Down Arrow**: reverse; the car slows before changing direction.
- **Space**: brake.
- **A / Left Arrow** and **D / Right Arrow**: steer.
- **P / Escape**: pause or resume.
- **Android/iPhone**: hold the on-screen left/right steering, gas, brake, and reverse buttons.

Distance adds to score; passing traffic adds a bonus. A checkpoint notification appears every 500 studs. Traffic collisions end the run, barriers stop the car, and the existing score remotes submit the final score for best-score persistence.

## DataStore and assets

For persistent high scores, publish the experience and enable **Game Settings > Security > Enable Studio Access to API Services** for Studio testing. If DataStore access is unavailable, the game still runs, but persistent best scores will not load or save.

The map and vehicle use simple generated Parts as placeholders. No external models or sounds are assumed. The current driving game is silent; add audio only if you have Roblox audio assets you are permitted to use.