local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local Workspace = game:GetService("Workspace")

local ROAD_WIDTH = 42
local SEGMENT_LENGTH = 180
local SEGMENT_COUNT = 10
local CHECKPOINT_DISTANCE = 500
local MAX_FORWARD_SPEED = 96
local MAX_REVERSE_SPEED = 28

local COLORS = {
	Road = Color3.fromRGB(55, 62, 62),
	Grass = Color3.fromRGB(48, 82, 51),
	Paper = Color3.fromRGB(239, 239, 220),
	Acid = Color3.fromRGB(215, 244, 87),
	Orange = Color3.fromRGB(242, 118, 67),
}

local random = Random.new()
local remoteFolder = ReplicatedStorage:FindFirstChild("StreetRacerRemotes")
if not remoteFolder then
	remoteFolder = Instance.new("Folder")
	remoteFolder.Name = "StreetRacerRemotes"
	remoteFolder.Parent = ReplicatedStorage
end

local function getOrCreateRemote(name, className)
	local remote = remoteFolder:FindFirstChild(name)
	if not remote then
		remote = Instance.new(className)
		remote.Name = name
		remote.Parent = remoteFolder
	end
	return remote
end

local getHighScore = getOrCreateRemote("GetHighScore", "RemoteFunction")
local submitScore = getOrCreateRemote("SubmitScore", "RemoteEvent")
local driveInput = getOrCreateRemote("DriveInput", "RemoteEvent")
local raceCommand = getOrCreateRemote("RaceCommand", "RemoteEvent")
local raceUpdate = getOrCreateRemote("RaceUpdate", "RemoteEvent")

local world = Workspace:FindFirstChild("StreetRacerWorld")
if world then
	world:Destroy()
end
world = Instance.new("Folder")
world.Name = "StreetRacerWorld"
world.Parent = Workspace

local tracks = {}
local nextSlot = 0

local function makePart(parent, name, size, color, material, anchored, canCollide)
	local part = Instance.new("Part")
	part.Name = name
	part.Size = size
	part.Color = color
	part.Material = material or Enum.Material.SmoothPlastic
	part.Anchored = anchored
	part.CanCollide = canCollide
	part.CastShadow = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Parent = parent
	return part
end

local function makeTrackSegment(track, centerZ)
	local model = Instance.new("Model")
	model.Name = "RoadSegment"
	model.Parent = track.folder
	local ground = makePart(model, "Ground", Vector3.new(150, 1, SEGMENT_LENGTH), COLORS.Grass, Enum.Material.Grass, true, true)
	ground.Position = Vector3.new(track.originX, 9.3, centerZ)
	local road = makePart(model, "Road", Vector3.new(ROAD_WIDTH, 1, SEGMENT_LENGTH), COLORS.Road, Enum.Material.Asphalt, true, true)
	road.Position = Vector3.new(track.originX, 10, centerZ)
	for _, side in ipairs({ -1, 1 }) do
		local edge = makePart(model, "RoadEdge", Vector3.new(0.35, 0.08, SEGMENT_LENGTH), COLORS.Paper, Enum.Material.SmoothPlastic, true, false)
		edge.Position = Vector3.new(track.originX + side * (ROAD_WIDTH / 2 - 0.8), 10.54, centerZ)
		local barrier = makePart(model, "Barrier", Vector3.new(1.2, 3.5, SEGMENT_LENGTH), Color3.fromRGB(104, 111, 104), Enum.Material.Concrete, true, true)
		barrier.Position = Vector3.new(track.originX + side * (ROAD_WIDTH / 2 + 1.2), 11.75, centerZ)
	end
	for _, laneX in ipairs({ -ROAD_WIDTH / 6, ROAD_WIDTH / 6 }) do
		for dashZ = centerZ - SEGMENT_LENGTH / 2 + 12, centerZ + SEGMENT_LENGTH / 2 - 12, 24 do
			local dash = makePart(model, "LaneMarking", Vector3.new(0.22, 0.08, 10), COLORS.Paper, Enum.Material.SmoothPlastic, true, false)
			dash.Position = Vector3.new(track.originX + laneX, 10.55, dashZ)
		end
	end
	for markerZ = centerZ - SEGMENT_LENGTH / 2 + 18, centerZ + SEGMENT_LENGTH / 2 - 18, 36 do
		for _, side in ipairs({ -1, 1 }) do
			local marker = makePart(model, "RoadsideMarker", Vector3.new(0.8, 3, 0.8), COLORS.Paper, Enum.Material.SmoothPlastic, true, false)
			marker.Position = Vector3.new(track.originX + side * (ROAD_WIDTH / 2 + 3), 11, markerZ)
			local cap = makePart(model, "MarkerCap", Vector3.new(0.84, 0.8, 0.84), COLORS.Orange, Enum.Material.SmoothPlastic, true, false)
			cap.Position = marker.Position + Vector3.new(0, 0.7, 0)
		end
	end
	return { model = model, z = centerZ }
end

local function weldToChassis(chassis, part, offset)
	part.CFrame = chassis.CFrame * offset
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = chassis
	weld.Part1 = part
	weld.Parent = chassis
	return part
end

local function createCar(track)
	local model = Instance.new("Model")
	model.Name = "PlayerCar"
	model.Parent = track.folder
	local initialCFrame = CFrame.new(track.originX, 12, 12)
	local chassis = makePart(model, "Chassis", Vector3.new(7, 1.4, 12), Color3.fromRGB(228, 234, 198), Enum.Material.Metal, false, true)
	chassis.CFrame = initialCFrame
	chassis.CustomPhysicalProperties = PhysicalProperties.new(1.4, 0.65, 0.05, 1, 1)
	chassis:SetNetworkOwner(nil)
	model.PrimaryPart = chassis

	local cabin = makePart(model, "Cabin", Vector3.new(4.8, 1.4, 5), Color3.fromRGB(36, 57, 60), Enum.Material.Glass, false, false)
	weldToChassis(chassis, cabin, CFrame.new(0, 1.35, -0.5))
	local hood = makePart(model, "Hood", Vector3.new(5.7, 0.55, 3.5), Color3.fromRGB(228, 234, 198), Enum.Material.Metal, false, false)
	weldToChassis(chassis, hood, CFrame.new(0, 0.75, -3.9))
	local trunk = makePart(model, "Trunk", Vector3.new(5.5, 0.5, 2.4), Color3.fromRGB(228, 234, 198), Enum.Material.Metal, false, false)
	weldToChassis(chassis, trunk, CFrame.new(0, 0.72, 4.4))
	local frontLights = makePart(model, "Headlights", Vector3.new(4.8, 0.25, 0.25), COLORS.Acid, Enum.Material.Neon, false, false)
	weldToChassis(chassis, frontLights, CFrame.new(0, 0.48, -5.95))
	local rearLights = makePart(model, "TailLights", Vector3.new(4.8, 0.25, 0.25), Color3.fromRGB(238, 74, 58), Enum.Material.Neon, false, false)
	weldToChassis(chassis, rearLights, CFrame.new(0, 0.48, 5.95))
	for _, side in ipairs({ -1, 1 }) do
		for _, frontBack in ipairs({ -1, 1 }) do
			local wheel = makePart(model, "Wheel", Vector3.new(1.3, 1.3, 2), Color3.fromRGB(25, 29, 29), Enum.Material.Rubber, false, false)
			wheel.Shape = Enum.PartType.Cylinder
			weldToChassis(chassis, wheel, CFrame.new(side * 3.25, -0.2, frontBack * 3.8) * CFrame.Angles(0, 0, math.rad(90)))
		end
	end
	local seat = Instance.new("VehicleSeat")
	seat.Name = "DriverSeat"
	seat.Size = Vector3.new(2.2, 0.8, 2.2)
	seat.CFrame = chassis.CFrame * CFrame.new(0, 1.2, 0.4)
	seat.Color = Color3.fromRGB(34, 39, 36)
	seat.Material = Enum.Material.SmoothPlastic
	seat.Anchored = false
	seat.CanCollide = false
	seat.Parent = model
	local seatWeld = Instance.new("WeldConstraint")
	seatWeld.Part0 = chassis
	seatWeld.Part1 = seat
	seatWeld.Parent = chassis
	model.PrimaryPart = chassis
	return model, chassis, seat
end

local function makeObstacle(track, z, lane, kind)
	local model = Instance.new("Model")
	model.Name = kind == "Truck" and "TrafficTruck" or "TrafficCar"
	model.Parent = track.folder
	local width = kind == "Truck" and 8 or 6.2
	local length = kind == "Truck" and 15 or 10
	local color = kind == "Truck" and Color3.fromRGB(56, 134, 153) or Color3.fromRGB(215, 82, 70)
	local body = makePart(model, "Body", Vector3.new(width, 2.7, length), color, Enum.Material.Metal, true, true)
	body.Position = Vector3.new(track.originX + lane, 11.55, z)
	local window = makePart(model, "Window", Vector3.new(width * 0.68, 1.1, length * 0.23), Color3.fromRGB(32, 50, 52), Enum.Material.Glass, true, false)
	window.Position = body.Position + Vector3.new(0, 1.65, -length * 0.18)
	model.PrimaryPart = body
	return { model = model, z = z, lane = lane, kind = kind }
end

local function sendUpdate(track, mode, extra)
	local payload = {
		Mode = mode or track.mode,
		Score = track.score,
		Distance = math.floor(track.distance),
		Speed = math.floor(math.abs(track.speed) * 2.5 + 0.5),
		Checkpoints = track.checkpoints,
	}
	if extra then
		for key, value in pairs(extra) do
			payload[key] = value
		end
	end
	raceUpdate:FireClient(track.player, payload)
end

local function clearObstacles(track)
	for _, obstacle in ipairs(track.obstacles) do
		obstacle.model:Destroy()
	end
	table.clear(track.obstacles)
end

local function resetRace(track)
	track.mode = "Playing"
	track.score = 0
	track.distance = 0
	track.passedCount = 0
	track.checkpoints = 0
	track.nextCheckpoint = CHECKPOINT_DISTANCE
	track.nextObstacleZ = -125
	track.lastObstacleLane = nil
	track.speed = 0
	track.throttle = 0
	track.steer = 0
	track.brake = false
	track.car:PivotTo(CFrame.new(track.originX, 12, 12))
	track.chassis.AssemblyLinearVelocity = Vector3.zero
	track.chassis.AssemblyAngularVelocity = Vector3.zero
	clearObstacles(track)
	sendUpdate(track, "Playing")
end

local function seatPlayer(track, character)
	local humanoid = character:WaitForChild("Humanoid", 10)
	local root = character:WaitForChild("HumanoidRootPart", 10)
	if not humanoid or not root or not track.seat.Parent then
		return
	end
	root.CFrame = track.seat.CFrame * CFrame.new(0, 2.5, 0)
	task.wait(0.15)
	if humanoid.Parent and track.seat.Parent then
		track.seat:Sit(humanoid)
	end
	track.chassis:SetNetworkOwner(track.player)
	humanoid.Seated:Connect(function(isSeated, activeSeat)
		if not isSeated and track.mode ~= "GameOver" and character.Parent then
			task.delay(0.5, function()
				if track.mode ~= "GameOver" and humanoid.Parent and track.seat.Parent then
					root.CFrame = track.seat.CFrame * CFrame.new(0, 2.5, 0)
					track.seat:Sit(humanoid)
				end
			end)
		end
	end)
end

local function createTrack(player)
	nextSlot += 1
	local originX = (nextSlot - 1) * 100
	local folder = Instance.new("Folder")
	folder.Name = "Track_" .. player.UserId
	folder.Parent = world
	local track = {
		player = player,
		folder = folder,
		originX = originX,
		mode = "Menu",
		speed = 0,
		throttle = 0,
		steer = 0,
		brake = false,
		distance = 0,
		score = 0,
		passedCount = 0,
		checkpoints = 0,
		obstacles = {},
		segments = {},
		lastUpdate = 0,
		lastObstacleLane = nil,
	}
	for index = 0, SEGMENT_COUNT - 1 do
		table.insert(track.segments, makeTrackSegment(track, -index * SEGMENT_LENGTH))
	end
	track.car, track.chassis, track.seat = createCar(track)
	tracks[player] = track
	return track
end

local function onCharacterAdded(track, character)
	task.spawn(seatPlayer, track, character)
end

local function setupPlayer(player)
	if tracks[player] then
		return
	end
	local track = createTrack(player)
	player.CharacterAdded:Connect(function(character)
		onCharacterAdded(track, character)
	end)
	if player.Character then
		onCharacterAdded(track, player.Character)
	end
end

local function removePlayer(player)
	local track = tracks[player]
	if track then
		track.folder:Destroy()
		tracks[player] = nil
	end
end

driveInput.OnServerEvent:Connect(function(player, controls)
	local track = tracks[player]
	if not track or track.mode ~= "Playing" or type(controls) ~= "table" then
		return
	end
	local character = player.Character
	local humanoid = character and character:FindFirstChildOfClass("Humanoid")
	if not humanoid or track.seat.Occupant ~= humanoid then
		return
	end
	local throttle = tonumber(controls.Throttle)
	local steer = tonumber(controls.Steer)
	if not throttle or not steer then
		return
	end
	track.throttle = math.clamp(throttle, -1, 1)
	track.steer = math.clamp(steer, -1, 1)
	track.brake = controls.Brake == true
	track.lastInput = os.clock()
end)

raceCommand.OnServerEvent:Connect(function(player, command)
	local track = tracks[player]
	if not track or type(command) ~= "string" then
		return
	end
	if command == "Start" or command == "Restart" then
		resetRace(track)
	elseif command == "Pause" and track.mode == "Playing" then
		track.mode = "Paused"
		track.speed = 0
		track.throttle = 0
		track.steer = 0
		track.brake = true
		track.chassis.AssemblyLinearVelocity = Vector3.zero
		track.chassis.AssemblyAngularVelocity = Vector3.zero
		sendUpdate(track, "Paused")
	elseif command == "Resume" and track.mode == "Paused" then
		track.mode = "Playing"
		track.brake = false
		sendUpdate(track, "Playing")
	elseif command == "Menu" then
		track.mode = "Menu"
		track.speed = 0
		track.throttle = 0
		track.steer = 0
		track.brake = true
		track.chassis.AssemblyLinearVelocity = Vector3.zero
		sendUpdate(track, "Menu")
	end
end)

local function updateSegments(track, playerZ)
	local farthestZ = math.huge
	for _, segment in ipairs(track.segments) do
		farthestZ = math.min(farthestZ, segment.z)
	end
	for _, segment in ipairs(track.segments) do
		if segment.z > playerZ + SEGMENT_LENGTH then
			local newZ = farthestZ - SEGMENT_LENGTH
			local shift = newZ - segment.z
			segment.z = newZ
			for _, part in ipairs(segment.model:GetChildren()) do
				if part:IsA("BasePart") then
					part.Position += Vector3.new(0, 0, shift)
				end
			end
			farthestZ = newZ
		end
	end
end

local function spawnObstacles(track, playerZ)
	while track.nextObstacleZ > playerZ - SEGMENT_LENGTH * 3 do
		local lanes = { -12, 0, 12 }
		local lane = lanes[random:NextInteger(1, #lanes)]
		if lane == track.lastObstacleLane then
			lane = lanes[(table.find(lanes, lane) % #lanes) + 1]
		end
		track.lastObstacleLane = lane
		local kind = random:NextNumber() < 0.2 and "Truck" or "Car"
		table.insert(track.obstacles, makeObstacle(track, track.nextObstacleZ, lane, kind))
		track.nextObstacleZ -= random:NextInteger(75, 115)
	end
end

local function crash(track)
	track.mode = "GameOver"
	track.speed = 0
	track.throttle = 0
	track.steer = 0
	track.brake = true
	track.chassis.AssemblyLinearVelocity = Vector3.zero
	track.chassis.AssemblyAngularVelocity = Vector3.zero
	sendUpdate(track, "GameOver", { FinalScore = track.score })
end

RunService.Heartbeat:Connect(function(deltaTime)
	deltaTime = math.min(deltaTime, 0.1)
	for _, track in pairs(tracks) do
		if track.mode ~= "Playing" then
			continue
		end
		if not track.chassis.Parent then
			continue
		end
		if os.clock() - (track.lastInput or 0) > 0.6 then
			track.throttle = 0
			track.steer = 0
			track.brake = false
		end

		local speed = track.speed
		if track.brake then
			if speed > 0 then
				speed = math.max(0, speed - 100 * deltaTime)
			else
				speed = math.min(0, speed + 100 * deltaTime)
			end
		elseif track.throttle ~= 0 then
			if speed ~= 0 and math.sign(speed) ~= math.sign(track.throttle) then
				local amount = 76 * deltaTime
				speed = speed > 0 and math.max(0, speed - amount) or math.min(0, speed + amount)
			else
				local limit = track.throttle > 0 and MAX_FORWARD_SPEED or MAX_REVERSE_SPEED
				speed = math.clamp(speed + track.throttle * 44 * deltaTime, -limit, limit)
			end
		else
			local drag = 12 * deltaTime
			speed = speed > 0 and math.max(0, speed - drag) or math.min(0, speed + drag)
		end
		track.speed = speed

		local chassis = track.chassis
		local turnScale = math.clamp(math.abs(speed) / 22, 0.2, 1)
		local reverseSteer = speed < -1 and -1 or 1
		chassis.AssemblyAngularVelocity = Vector3.new(0, -track.steer * 1.65 * turnScale * reverseSteer, 0)
		local horizontal = chassis.CFrame.LookVector * speed
		chassis.AssemblyLinearVelocity = Vector3.new(horizontal.X, chassis.AssemblyLinearVelocity.Y, horizontal.Z)

		local position = chassis.Position
		local distance = math.max(0, 12 - position.Z)
		track.distance = distance
		track.score = math.floor(distance) + track.passedCount * 100
		updateSegments(track, position.Z)
		spawnObstacles(track, position.Z)

		for index = #track.obstacles, 1, -1 do
			local obstacle = track.obstacles[index]
			local relativeZ = math.abs(position.Z - obstacle.z)
			local relativeX = math.abs(position.X - (track.originX + obstacle.lane))
			if relativeZ < 10 and relativeX < 6.2 then
				crash(track)
				break
			elseif obstacle.z > position.Z + 16 then
				track.passedCount += 1
				track.score += 100
				obstacle.model:Destroy()
				table.remove(track.obstacles, index)
			end
		end
		if track.mode ~= "Playing" then
			continue
		end

		local passedCheckpoint = math.floor(distance / CHECKPOINT_DISTANCE)
		if passedCheckpoint > track.checkpoints then
			track.checkpoints = passedCheckpoint
			sendUpdate(track, "Playing", { Checkpoint = track.checkpoints })
		end
		if os.clock() - track.lastUpdate > 0.2 then
			track.lastUpdate = os.clock()
			sendUpdate(track)
		end
	end
end)

Players.PlayerAdded:Connect(setupPlayer)

Players.PlayerRemoving:Connect(removePlayer)

for _, player in ipairs(Players:GetPlayers()) do
	task.spawn(setupPlayer, player)
end