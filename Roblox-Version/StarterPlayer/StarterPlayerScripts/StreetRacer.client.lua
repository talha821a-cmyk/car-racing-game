do
	return
end

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local SoundService = game:GetService("SoundService")

local player = Players.LocalPlayer
local camera = workspace.CurrentCamera
local remotes = ReplicatedStorage:WaitForChild("StreetRacerRemotes")
local getHighScore = remotes:WaitForChild("GetHighScore")
local submitScore = remotes:WaitForChild("SubmitScore")

local function hideAvatar(character)
	for _, descendant in ipairs(character:GetDescendants()) do
		if descendant:IsA("BasePart") then
			descendant.LocalTransparencyModifier = 1
			descendant.CastShadow = false
			descendant.CanCollide = false
		elseif descendant:IsA("Humanoid") then
			descendant.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
		end
	end
end

if player.Character then
	hideAvatar(player.Character)
end
player.CharacterAdded:Connect(hideAvatar)

local COLORS = {
	ink = Color3.fromRGB(16, 23, 19),
	panel = Color3.fromRGB(23, 33, 27),
	paper = Color3.fromRGB(244, 243, 233),
	muted = Color3.fromRGB(168, 179, 169),
	acid = Color3.fromRGB(215, 244, 87),
	orange = Color3.fromRGB(242, 118, 67),
	road = Color3.fromRGB(57, 64, 64),
	grass = Color3.fromRGB(48, 82, 51),
}

local LANES = { -10, 0, 10 }
local ROAD_WIDTH = 34
local SEGMENT_LENGTH = 150
local PLAYER_Z = 18
local TRAFFIC_COLORS = {
	Color3.fromRGB(239, 85, 74), Color3.fromRGB(66, 166, 205),
	Color3.fromRGB(233, 188, 67), Color3.fromRGB(181, 214, 213),
	Color3.fromRGB(174, 114, 208), Color3.fromRGB(79, 189, 132),
}

local state = {
	mode = "menu",
	score = 0,
	highScore = 0,
	elapsed = 0,
	difficulty = 0,
	lane = 2,
	playerX = LANES[2],
	targetX = LANES[2],
	spawnTimer = 0.6,
	lastSpawnLane = nil,
	roadOffset = 0,
	objects = {},
	soundEnabled = true,
}

local oldWorld = workspace:FindFirstChild("StreetRacerLocal")
if oldWorld then
	oldWorld:Destroy()
end
local world = Instance.new("Folder")
world.Name = "StreetRacerLocal"
world.Parent = workspace

local function makePart(parent, name, size, color, material, transparency)
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.Color = color
	part.Material = material or Enum.Material.SmoothPlastic
	part.Anchored = true
	part.CanCollide = false
	part.CastShadow = false
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Transparency = transparency or 0
	part.Parent = parent
	return part
end

local roadSegments = {}
local function makeRoadSegment(z)
	local model = Instance.new("Model")
	model.Name = "RoadSegment"
	model.Parent = world
	local ground = makePart(model, "Grass", Vector3.new(180, 1, SEGMENT_LENGTH), COLORS.grass, Enum.Material.Grass)
	ground.Position = Vector3.new(0, -0.7, z)
	local road = makePart(model, "Road", Vector3.new(ROAD_WIDTH, 1, SEGMENT_LENGTH), COLORS.road, Enum.Material.Asphalt)
	road.Position = Vector3.new(0, 0, z)
	for _, edgeX in ipairs({ -ROAD_WIDTH / 2 + 0.55, ROAD_WIDTH / 2 - 0.55 }) do
		local edge = makePart(model, "RoadEdge", Vector3.new(0.3, 0.08, SEGMENT_LENGTH), Color3.fromRGB(220, 217, 195))
		edge.Position = Vector3.new(edgeX, 0.56, z)
	end
	for _, curbX in ipairs({ -ROAD_WIDTH / 2 + 1.15, ROAD_WIDTH / 2 - 1.15 }) do
		local curb = makePart(model, "Curb", Vector3.new(0.35, 0.09, SEGMENT_LENGTH), COLORS.orange)
		curb.Position = Vector3.new(curbX, 0.57, z)
	end
	for _, laneX in ipairs({ -ROAD_WIDTH / 6, ROAD_WIDTH / 6 }) do
		for dashZ = z - SEGMENT_LENGTH / 2 + 9, z + SEGMENT_LENGTH / 2 - 9, 17 do
			local dash = makePart(model, "LaneMarking", Vector3.new(0.18, 0.08, 8), Color3.fromRGB(231, 233, 218))
			dash.Position = Vector3.new(laneX, 0.57, dashZ)
		end
	end
	for markerZ = z - SEGMENT_LENGTH / 2 + 14, z + SEGMENT_LENGTH / 2 - 14, 24 do
		for _, side in ipairs({ -1, 1 }) do
			local marker = makePart(model, "RoadsideMarker", Vector3.new(0.55, 2, 0.7), COLORS.paper)
			marker.Position = Vector3.new(side * (ROAD_WIDTH / 2 + 2), 0.5, markerZ)
			local cap = makePart(model, "MarkerCap", Vector3.new(0.58, 0.75, 0.72), COLORS.orange)
			cap.Position = marker.Position + Vector3.new(0, 0.58, 0)
		end
	end
	return { model = model, z = z }
end

roadSegments[1] = makeRoadSegment(0)
roadSegments[2] = makeRoadSegment(-SEGMENT_LENGTH)

local function makeCar(name, color, isTruck)
	local model = Instance.new("Model")
	model.Name = name
	model.Parent = world
	local bodySize = isTruck and Vector3.new(7.2, 2.4, 14) or Vector3.new(5.8, 1.8, 9.5)
	local body = makePart(model, "Body", bodySize, color, Enum.Material.SmoothPlastic)
	body.Position = Vector3.new(0, 1.6, 0)
	model.PrimaryPart = body
	local cabinSize = isTruck and Vector3.new(5.1, 1.3, 4.8) or Vector3.new(4.1, 1.05, 3.5)
	local cabin = makePart(model, "Windshield", cabinSize, Color3.fromRGB(36, 57, 60), Enum.Material.Glass)
	cabin.Position = Vector3.new(0, 3.05, -1.0)
	for _, side in ipairs({ -1, 1 }) do
		for _, frontBack in ipairs({ -1, 1 }) do
			local wheel = makePart(model, "Wheel", Vector3.new(1.1, 1.1, 2), Color3.fromRGB(25, 29, 29), Enum.Material.Rubber)
			wheel.Shape = Enum.PartType.Cylinder
			wheel.CFrame = CFrame.new(side * (bodySize.X / 2 - 0.1), 1.15, frontBack * (bodySize.Z * 0.31)) * CFrame.Angles(0, 0, math.rad(90))
		end
	end
	local front = makePart(model, "Headlights", Vector3.new(bodySize.X * 0.62, 0.2, 0.3), isTruck and Color3.fromRGB(248, 224, 160) or COLORS.acid, Enum.Material.Neon)
	front.Position = Vector3.new(0, 2.1, -bodySize.Z / 2 + 0.3)
	local rear = makePart(model, "Taillights", Vector3.new(bodySize.X * 0.62, 0.2, 0.3), Color3.fromRGB(244, 83, 68), Enum.Material.Neon)
	rear.Position = Vector3.new(0, 2.1, bodySize.Z / 2 - 0.3)
	return model, bodySize
end

local playerCar = makeCar("PlayerCar", Color3.fromRGB(228, 234, 198), false)
playerCar:PivotTo(CFrame.new(state.playerX, 1.6, PLAYER_Z))

local gui = Instance.new("ScreenGui")
gui.Name = "StreetRacerGui"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 20
gui.Parent = player:WaitForChild("PlayerGui")

local function addCorner(instance, radius)
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0, radius or 3)
	corner.Parent = instance
end

local function makeLabel(parent, name, text, size, position, textSize, color, font)
	local label = Instance.new("TextLabel")
	label.Name = name
	label.Size = size
	label.Position = position
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextColor3 = color or COLORS.paper
	label.TextSize = textSize or 18
	label.Font = font or Enum.Font.GothamBold
	label.TextWrapped = true
	label.Parent = parent
	return label
end

local function makeButton(parent, name, text, size, position, primary)
	local button = Instance.new("TextButton")
	button.Name = name
	button.Size = size
	button.Position = position
	button.BackgroundColor3 = primary and COLORS.acid or Color3.fromRGB(31, 43, 35)
	button.BorderColor3 = primary and COLORS.acid or Color3.fromRGB(116, 132, 118)
	button.BorderSizePixel = 1
	button.Text = text
	button.TextColor3 = primary and COLORS.ink or COLORS.paper
	button.TextSize = 16
	button.Font = Enum.Font.GothamBold
	button.AutoButtonColor = true
	button.Parent = parent
	addCorner(button, 3)
	return button
end

local hud = Instance.new("Frame")
hud.Name = "HUD"
hud.Size = UDim2.new(1, 0, 0, 72)
hud.BackgroundColor3 = COLORS.ink
hud.BackgroundTransparency = 0.2
hud.BorderSizePixel = 0
hud.Visible = false
hud.Parent = gui
local scoreLabel = makeLabel(hud, "Score", "SCORE  0000", UDim2.new(0, 180, 0, 30), UDim2.new(0, 16, 0, 8), 20, COLORS.paper)
scoreLabel.TextXAlignment = Enum.TextXAlignment.Left
local bestLabel = makeLabel(hud, "HighScore", "BEST  0000", UDim2.new(0, 180, 0, 22), UDim2.new(0, 16, 0, 39), 13, COLORS.muted)
bestLabel.TextXAlignment = Enum.TextXAlignment.Left
local speedLabel = makeLabel(hud, "Speed", "084 KM/H", UDim2.new(0, 150, 0, 28), UDim2.new(0.5, -75, 0, 21), 16, COLORS.acid)
local soundButton = makeButton(hud, "Sound", "SOUND ON", UDim2.new(0, 90, 0, 38), UDim2.new(1, -194, 0, 16), false)
local pauseButton = makeButton(hud, "Pause", "PAUSE", UDim2.new(0, 82, 0, 38), UDim2.new(1, -94, 0, 16), false)

local overlay = Instance.new("Frame")
overlay.Name = "ScreenOverlay"
overlay.Size = UDim2.fromScale(1, 1)
overlay.BackgroundColor3 = COLORS.ink
overlay.BackgroundTransparency = 0.17
overlay.BorderSizePixel = 0
overlay.Visible = true
overlay.Parent = gui
local panel = Instance.new("Frame")
panel.Name = "Panel"
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.fromScale(0.5, 0.5)
panel.Size = UDim2.new(0.84, 0, 0, 450)
panel.BackgroundColor3 = COLORS.panel
panel.BackgroundTransparency = 0.05
panel.BorderColor3 = Color3.fromRGB(103, 122, 102)
panel.Parent = overlay
addCorner(panel, 5)
local panelConstraint = Instance.new("UISizeConstraint")
panelConstraint.MaxSize = Vector2.new(440, 500)
panelConstraint.MinSize = Vector2.new(280, 320)
panelConstraint.Parent = panel
local titleLabel = makeLabel(panel, "Title", "STREET RACER", UDim2.new(1, -32, 0, 58), UDim2.new(0, 16, 0, 24), 34, COLORS.acid)
local subtitleLabel = makeLabel(panel, "Subtitle", "THE CITY IS YOURS", UDim2.new(1, -34, 0, 42), UDim2.new(0, 17, 0, 85), 16, COLORS.muted)
local messageLabel = makeLabel(panel, "Message", "Own the road. Outlast the rush.", UDim2.new(1, -38, 0, 80), UDim2.new(0, 19, 0, 135), 18, COLORS.paper, Enum.Font.Gotham)
local primaryButton = makeButton(panel, "Primary", "PLAY", UDim2.new(1, -56, 0, 50), UDim2.new(0, 28, 1, -168), true)
local secondaryButton = makeButton(panel, "Secondary", "HOW TO PLAY", UDim2.new(1, -56, 0, 46), UDim2.new(0, 28, 1, -108), false)
local thirdButton = makeButton(panel, "Third", "SOUND: ON", UDim2.new(1, -56, 0, 42), UDim2.new(0, 28, 1, -54), false)

local leftButton = makeButton(gui, "Left", "<\nLEFT", UDim2.new(0, 76, 0, 68), UDim2.new(0, 18, 1, -95), false)
local rightButton = makeButton(gui, "Right", "RIGHT\n>", UDim2.new(0, 76, 0, 68), UDim2.new(1, -94, 1, -95), false)
leftButton.Visible = false
rightButton.Visible = false

local function createSound(name, soundId, looped, volume)
	local sound = Instance.new("Sound")
	sound.Name = name
	sound.SoundId = soundId
	sound.Looped = looped
	sound.Volume = volume
	sound.Parent = SoundService
	return sound
end

local engineSound = createSound("StreetRacerEngine", "", true, 0.18)
local musicSound = createSound("StreetRacerMusic", "", true, 0.2)
local crashSound = createSound("StreetRacerCrash", "", false, 0.65)
local clickSound = createSound("StreetRacerClick", "", false, 0.25)

local function playSound(sound)
	if state.soundEnabled and sound.SoundId ~= "" then
		sound:Play()
	end
end

local function stopGameplaySounds()
	engineSound:Stop()
	musicSound:Stop()
end

local function fmt(value)
	return string.format("%04d", math.max(0, math.floor(value)))
end

local function updateHud()
	scoreLabel.Text = "SCORE  " .. fmt(state.score)
	bestLabel.Text = "BEST  " .. fmt(state.highScore)
	speedLabel.Text = string.format("%03d KM/H", math.floor(84 + state.difficulty * 116 + 0.5))
end

local function setScreen(mode)
	state.mode = mode
	overlay.Visible = mode ~= "playing"
	hud.Visible = mode == "playing"
	leftButton.Visible = mode == "playing" and UserInputService.TouchEnabled
	rightButton.Visible = mode == "playing" and UserInputService.TouchEnabled
	if mode == "menu" then
		titleLabel.Text = "STREET RACER"
		subtitleLabel.Text = "THE CITY IS YOURS"
		messageLabel.Text = "Own the road. Outlast the rush.\n\nHIGH SCORE   " .. fmt(state.highScore)
		primaryButton.Text = "PLAY"
		secondaryButton.Visible = true
		thirdButton.Visible = true
	elseif mode == "how" then
		titleLabel.Text = "DRIVER BRIEFING"
		subtitleLabel.Text = "KNOW THE LINES"
		messageLabel.Text = "A / Left Arrow: move left\nD / Right Arrow: move right\nP / Escape: pause\n\nMobile: tap LEFT or RIGHT. Dodge traffic and pass cars to score."
		primaryButton.Text = "GOT IT"
		secondaryButton.Visible = false
		thirdButton.Visible = false
	elseif mode == "paused" then
		titleLabel.Text = "RACE PAUSED"
		subtitleLabel.Text = "TAKE A BREATHER"
		messageLabel.Text = "Run score   " .. fmt(state.score) .. "\nBest score   " .. fmt(state.highScore)
		primaryButton.Text = "RESUME RACE"
		secondaryButton.Text = "RESTART"
		secondaryButton.Visible = true
		thirdButton.Text = "MAIN MENU"
		thirdButton.Visible = true
	elseif mode == "gameover" then
		titleLabel.Text = "GAME OVER"
		subtitleLabel.Text = "ONE LIFE. ONE RUN."
		messageLabel.Text = "SCORE   " .. fmt(state.score) .. "\nHIGHEST SCORE   " .. fmt(state.highScore)
		primaryButton.Text = "RESTART"
		secondaryButton.Text = "MAIN MENU"
		secondaryButton.Visible = true
		thirdButton.Visible = false
	end
end

local function setLane(direction)
	if state.mode ~= "playing" then
		return
	end
	state.lane = math.clamp(state.lane + direction, 1, 3)
	state.targetX = LANES[state.lane]
	playSound(clickSound)
end

local function chooseLane(available)
	local choices = {}
	for _, lane in ipairs(available) do
		if lane ~= state.lastSpawnLane then
			table.insert(choices, lane)
		end
	end
	if #choices == 0 then
		choices = available
	end
	local lane = choices[math.random(1, #choices)]
	state.lastSpawnLane = lane
	return lane
end

local function laneIsClear(lane, maxZ)
	for _, item in ipairs(state.objects) do
		if item.lane == lane and item.z < maxZ then
			return false
		end
	end
	return true
end

local function spawnTraffic()
	local lanes = {}
	for lane = 1, 3 do
		if laneIsClear(lane, -48) then
			table.insert(lanes, lane)
		end
	end
	if #lanes == 0 then
		return
	end
	local lane = chooseLane(lanes)
	local roll = math.random()
	local kind = roll > 0.9 - state.difficulty * 0.16 and "cone" or (roll > 0.76 and "truck" or "car")
	local model, size
	if kind == "cone" then
		model = Instance.new("Model")
		model.Name = "TrafficCone"
		model.Parent = world
		local base = makePart(model, "Base", Vector3.new(3.2, 0.45, 3.2), Color3.fromRGB(43, 48, 46))
		base.Position = Vector3.new(0, 0.4, 0)
		local cone = makePart(model, "Cone", Vector3.new(1.5, 2.5, 1.5), COLORS.orange, Enum.Material.Neon)
		cone.Shape = Enum.PartType.Ball
		cone.Position = Vector3.new(0, 1.7, 0)
		model.PrimaryPart = base
		size = Vector3.new(3.5, 2.8, 3.5)
	else
		model, size = makeCar(kind == "truck" and "TrafficTruck" or "TrafficCar", TRAFFIC_COLORS[math.random(1, #TRAFFIC_COLORS)], kind == "truck")
	end
	local speed = (18 + state.difficulty * 28) * (kind == "truck" and 0.9 or 1)
	local item = { model = model, lane = lane, kind = kind, z = -115, speed = speed, size = size, passed = false }
	model:PivotTo(CFrame.new(LANES[lane], kind == "cone" and 0.4 or 1.6, item.z))
	table.insert(state.objects, item)

	if math.random() < state.difficulty * 0.32 then
		local otherLanes = {}
		for candidate = 1, 3 do
			if candidate ~= lane and laneIsClear(candidate, -45) then
				table.insert(otherLanes, candidate)
			end
		end
		if #otherLanes > 0 then
			local pairLane = chooseLane(otherLanes)
			local pairKind = math.random() > 0.25 and "car" or "truck"
			local pairModel, pairSize = makeCar("Traffic" .. pairKind, TRAFFIC_COLORS[math.random(1, #TRAFFIC_COLORS)], pairKind == "truck")
			local pair = { model = pairModel, lane = pairLane, kind = pairKind, z = -128, speed = speed * 0.96, size = pairSize, passed = false }
			pairModel:PivotTo(CFrame.new(LANES[pairLane], 1.6, pair.z))
			table.insert(state.objects, pair)
		end
	end
end

local function loadHighScore()
	local ok, value = pcall(function()
		return getHighScore:InvokeServer()
	end)
	if ok and type(value) == "number" then
		state.highScore = math.max(0, math.floor(value))
	end
	updateHud()
end

local function startGame()
	stopGameplaySounds()
	for _, item in ipairs(state.objects) do
		item.model:Destroy()
	end
	state.objects = {}
	state.score = 0
	state.elapsed = 0
	state.difficulty = 0
	state.lane = 2
	state.playerX = LANES[2]
	state.targetX = LANES[2]
	state.spawnTimer = 0.6
	state.lastSpawnLane = nil
	playerCar:PivotTo(CFrame.new(state.playerX, 1.6, PLAYER_Z))
	setScreen("playing")
	updateHud()
	playSound(engineSound)
	playSound(musicSound)
end

local function pauseGame()
	if state.mode ~= "playing" then
		return
	end
	stopGameplaySounds()
	setScreen("paused")
end

local function endGame()
	if state.mode ~= "playing" then
		return
	end
	stopGameplaySounds()
	playSound(crashSound)
	state.highScore = math.max(state.highScore, math.floor(state.score))
	pcall(function()
		submitScore:FireServer(math.floor(state.score))
	end)
	setScreen("gameover")
	updateHud()
end

local function showMenu()
	stopGameplaySounds()
	setScreen("menu")
	playerCar:PivotTo(CFrame.new(0, 1.6, PLAYER_Z))
	for _, item in ipairs(state.objects) do
		item.model:Destroy()
	end
	state.objects = {}
	updateHud()
end

primaryButton.Activated:Connect(function()
	playSound(clickSound)
	if state.mode == "menu" then
		startGame()
	elseif state.mode == "how" then
		setScreen("menu")
	elseif state.mode == "paused" then
		setScreen("playing")
		playSound(engineSound)
		playSound(musicSound)
	elseif state.mode == "gameover" then
		startGame()
	end
end)

secondaryButton.Activated:Connect(function()
	playSound(clickSound)
	if state.mode == "menu" then
		setScreen("how")
	elseif state.mode == "paused" then
		startGame()
	elseif state.mode == "gameover" then
		showMenu()
	end
end)

thirdButton.Activated:Connect(function()
	playSound(clickSound)
	if state.mode == "menu" then
		state.soundEnabled = not state.soundEnabled
		thirdButton.Text = "SOUND: " .. (state.soundEnabled and "ON" or "OFF")
		if not state.soundEnabled then
			stopGameplaySounds()
		end
	elseif state.mode == "paused" then
		showMenu()
	end
end)

soundButton.Activated:Connect(function()
	state.soundEnabled = not state.soundEnabled
	soundButton.Text = state.soundEnabled and "SOUND ON" or "SOUND OFF"
	thirdButton.Text = "SOUND: " .. (state.soundEnabled and "ON" or "OFF")
	if not state.soundEnabled then
		stopGameplaySounds()
	elseif state.mode == "playing" then
		playSound(engineSound)
		playSound(musicSound)
	end
end)

pauseButton.Activated:Connect(pauseGame)
leftButton.Activated:Connect(function() setLane(-1) end)
rightButton.Activated:Connect(function() setLane(1) end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.Left or input.KeyCode == Enum.KeyCode.A then
		setLane(-1)
	elseif input.KeyCode == Enum.KeyCode.Right or input.KeyCode == Enum.KeyCode.D then
		setLane(1)
	elseif input.KeyCode == Enum.KeyCode.P or input.KeyCode == Enum.KeyCode.Escape then
		if state.mode == "playing" then
			pauseGame()
		elseif state.mode == "paused" then
			setScreen("playing")
			playSound(engineSound)
			playSound(musicSound)
		end
	end
end)

local function update(deltaTime)
	if state.mode ~= "playing" then
		return
	end
	deltaTime = math.min(deltaTime, 0.05)
	state.elapsed += deltaTime
	local timeProgress = math.min(1, state.elapsed / 240)
	local scoreProgress = math.min(1, state.score / 6000)
	state.difficulty = math.min(1, timeProgress * 0.82 + scoreProgress * 0.18)
	local roadSpeed = 32 + state.difficulty * 22
	state.roadOffset += roadSpeed * deltaTime
	state.playerX += (state.targetX - state.playerX) * math.min(1, deltaTime * 11)
	playerCar:PivotTo(CFrame.new(state.playerX, 0, PLAYER_Z))

	for _, segment in ipairs(roadSegments) do
		segment.z += roadSpeed * deltaTime
		local segmentShift = roadSpeed * deltaTime
		if segment.z > SEGMENT_LENGTH / 2 then
			segment.z -= SEGMENT_LENGTH * 2
			segmentShift -= SEGMENT_LENGTH * 2
		end
		for _, part in ipairs(segment.model:GetChildren()) do
			part.Position = Vector3.new(part.Position.X, part.Position.Y, part.Position.Z + segmentShift)
		end
	end

	state.spawnTimer -= deltaTime
	local spawnInterval = 1.45 - state.difficulty * 0.72
	if state.spawnTimer <= 0 then
		spawnTraffic()
		state.spawnTimer = spawnInterval * (0.82 + math.random() * 0.36)
	end

	local playerHalfWidth = 2.55
	local playerHalfLength = 4.1
	for _, item in ipairs(state.objects) do
		item.z += (roadSpeed + item.speed) * deltaTime
		item.model:PivotTo(CFrame.new(LANES[item.lane], 0, item.z))
		local trafficHalfWidth = item.size.X / 2
		local trafficHalfLength = item.size.Z / 2
		local overlapsX = math.abs(state.playerX - LANES[item.lane]) < playerHalfWidth + trafficHalfWidth - 0.55
		local overlapsZ = math.abs(PLAYER_Z - item.z) < playerHalfLength + trafficHalfLength - 1
		if overlapsX and overlapsZ then
			endGame()
			return
		end
		if not item.passed and item.z > PLAYER_Z + playerHalfLength + trafficHalfLength then
			item.passed = true
			if item.kind ~= "cone" then
				state.score += 100
			end
		end
	end

	for index = #state.objects, 1, -1 do
		local item = state.objects[index]
		if item.z > 130 then
			item.model:Destroy()
			table.remove(state.objects, index)
		end
	end
	state.score += deltaTime * (10 + state.difficulty * 10)
	updateHud()
end

camera.CameraType = Enum.CameraType.Scriptable
camera.FieldOfView = 46
RunService:BindToRenderStep("StreetRacerCamera", Enum.RenderPriority.Camera.Value, function()
	local focus = Vector3.new(state.playerX * 0.18, 0, -17)
	camera.CFrame = CFrame.lookAt(focus + Vector3.new(0, 48, 31), focus)
end)
RunService:BindToRenderStep("StreetRacerUpdate", Enum.RenderPriority.Character.Value + 1, update)

loadHighScore()
setScreen("menu")
updateHud()