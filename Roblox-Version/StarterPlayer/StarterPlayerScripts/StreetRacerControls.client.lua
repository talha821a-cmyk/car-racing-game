local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local remotes = ReplicatedStorage:WaitForChild("StreetRacerRemotes")
local driveInput = remotes:WaitForChild("DriveInput")
local raceUpdate = remotes:WaitForChild("RaceUpdate")

local intentEvent = playerGui:FindFirstChild("StreetRacerIntent")
if not intentEvent then
	intentEvent = Instance.new("BindableEvent")
	intentEvent.Name = "StreetRacerIntent"
	intentEvent.Parent = playerGui
end

local keyState = { Gas = false, Reverse = false, Brake = false, Left = false, Right = false }
local touchState = { Gas = false, Reverse = false, Brake = false, Left = false, Right = false }
local mode = "Menu"
local lastSend = 0
local camera = workspace.CurrentCamera

local function clearControls()
	for key in pairs(keyState) do
		keyState[key] = false
		touchState[key] = false
	end
	if mode == "Playing" then
		driveInput:FireServer({ Throttle = 0, Steer = 0, Brake = false })
	end
end

local function readControls()
	local gas = keyState.Gas or touchState.Gas
	local reverse = keyState.Reverse or touchState.Reverse
	local brake = keyState.Brake or touchState.Brake
	local left = keyState.Left or touchState.Left
	local right = keyState.Right or touchState.Right
	local throttle = (gas and 1 or 0) - (reverse and 1 or 0)
	local steer = (right and 1 or 0) - (left and 1 or 0)
	return { Throttle = throttle, Steer = steer, Brake = brake }
end

intentEvent.Event:Connect(function(action, value)
	if action == "Touch" and touchState[value.Name] ~= nil then
		touchState[value.Name] = value.Down
	elseif action == "Clear" then
		clearControls()
	end
end)

local function updateKey(keyCode, isDown)
	if keyCode == Enum.KeyCode.W or keyCode == Enum.KeyCode.Up then
		keyState.Gas = isDown
	elseif keyCode == Enum.KeyCode.S or keyCode == Enum.KeyCode.Down then
		keyState.Reverse = isDown
	elseif keyCode == Enum.KeyCode.Space then
		keyState.Brake = isDown
	elseif keyCode == Enum.KeyCode.A or keyCode == Enum.KeyCode.Left then
		keyState.Left = isDown
	elseif keyCode == Enum.KeyCode.D or keyCode == Enum.KeyCode.Right then
		keyState.Right = isDown
	end
end

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	updateKey(input.KeyCode, true)
end)

UserInputService.InputEnded:Connect(function(input)
	updateKey(input.KeyCode, false)
end)

UserInputService.WindowFocusReleased:Connect(clearControls)

raceUpdate.OnClientEvent:Connect(function(payload)
	if type(payload) == "table" then
		mode = payload.Mode or mode
		if mode ~= "Playing" then
			clearControls()
		end
	end
end)

local function hideCharacter(character)
	local function hide(instance)
		if instance:IsA("BasePart") then
			instance.LocalTransparencyModifier = 1
			instance.CastShadow = false
			instance.CanCollide = false
		elseif instance:IsA("Humanoid") then
			instance.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
		end
	end
	for _, descendant in ipairs(character:GetDescendants()) do
		hide(descendant)
	end
	character.DescendantAdded:Connect(hide)
end

if player.Character then
	hideCharacter(player.Character)
end
player.CharacterAdded:Connect(hideCharacter)

RunService.Heartbeat:Connect(function()
	if mode ~= "Playing" or os.clock() - lastSend < 0.1 then
		return
	end
	lastSend = os.clock()
	driveInput:FireServer(readControls())
end)

RunService:BindToRenderStep("StreetRacerFollowCamera", Enum.RenderPriority.Camera.Value + 1, function(deltaTime)
	local world = workspace:FindFirstChild("StreetRacerWorld")
	local track = world and world:FindFirstChild("Track_" .. player.UserId)
	local car = track and track:FindFirstChild("PlayerCar")
	local chassis = car and car.PrimaryPart
	if not chassis then
		return
	end
	if not camera then
		camera = workspace.CurrentCamera
	end
	camera.CameraType = Enum.CameraType.Scriptable
	camera.FieldOfView = 62
	local focus = chassis.Position + chassis.CFrame.LookVector * 10 + Vector3.new(0, 2, 0)
	local desiredPosition = chassis.Position - chassis.CFrame.LookVector * 34 + Vector3.new(0, 22, 0)
	local desired = CFrame.lookAt(desiredPosition, focus)
	camera.CFrame = camera.CFrame:Lerp(desired, math.clamp(deltaTime * 7, 0, 1))
end)