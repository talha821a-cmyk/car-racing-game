local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local gui = script.Parent
gui.Name = "StreetRacerScreenGui"
gui.ResetOnSpawn = false
gui.IgnoreGuiInset = true
gui.DisplayOrder = 30

local remotes = ReplicatedStorage:WaitForChild("StreetRacerRemotes")
local getHighScore = remotes:WaitForChild("GetHighScore")
local submitScore = remotes:WaitForChild("SubmitScore")
local raceCommand = remotes:WaitForChild("RaceCommand")
local raceUpdate = remotes:WaitForChild("RaceUpdate")
local playerGui = player:WaitForChild("PlayerGui")
local intentEvent = playerGui:WaitForChild("StreetRacerIntent")

local ink = Color3.fromRGB(16, 23, 19)
local panelColor = Color3.fromRGB(23, 33, 27)
local paper = Color3.fromRGB(244, 243, 233)
local muted = Color3.fromRGB(168, 179, 169)
local acid = Color3.fromRGB(215, 244, 87)
local orange = Color3.fromRGB(242, 118, 67)

local function corner(instance, radius)
	local item = Instance.new("UICorner")
	item.CornerRadius = UDim.new(0, radius or 4)
	item.Parent = instance
end

local function label(parent, name, text, size, position, textSize, color, font)
	local item = Instance.new("TextLabel")
	item.Name = name
	item.Size = size
	item.Position = position
	item.BackgroundTransparency = 1
	item.Text = text
	item.TextColor3 = color or paper
	item.TextSize = textSize or 18
	item.Font = font or Enum.Font.GothamBold
	item.TextWrapped = true
	item.Parent = parent
	return item
end

local function button(parent, name, text, size, position, primary)
	local item = Instance.new("TextButton")
	item.Name = name
	item.Size = size
	item.Position = position
	item.BackgroundColor3 = primary and acid or Color3.fromRGB(35, 47, 38)
	item.BorderColor3 = primary and acid or Color3.fromRGB(116, 132, 118)
	item.BorderSizePixel = 1
	item.Text = text
	item.TextColor3 = primary and ink or paper
	item.TextSize = 16
	item.Font = Enum.Font.GothamBold
	item.AutoButtonColor = true
	item.Parent = parent
	corner(item)
	return item
end

local hud = Instance.new("Frame")
hud.Name = "RaceHUD"
hud.Size = UDim2.new(1, 0, 0, 76)
hud.BackgroundColor3 = ink
hud.BackgroundTransparency = 0.16
hud.BorderSizePixel = 0
hud.Visible = false
hud.Parent = gui

local scoreLabel = label(hud, "Score", "SCORE  0000", UDim2.new(0, 190, 0, 28), UDim2.new(0, 16, 0, 8), 20)
scoreLabel.TextXAlignment = Enum.TextXAlignment.Left
local distanceLabel = label(hud, "Distance", "DISTANCE  0 m", UDim2.new(0, 190, 0, 24), UDim2.new(0, 16, 0, 40), 13, muted)
distanceLabel.TextXAlignment = Enum.TextXAlignment.Left
local highScoreLabel = label(hud, "HighScore", "BEST  0000", UDim2.new(0, 170, 0, 24), UDim2.new(0.5, -85, 0, 8), 14, acid)
local speedLabel = label(hud, "Speed", "0 km/h", UDim2.new(0, 125, 0, 25), UDim2.new(0.5, -62, 0, 38), 14, paper)
local pauseButton = button(hud, "Pause", "PAUSE", UDim2.new(0, 86, 0, 38), UDim2.new(1, -100, 0, 18), false)

local checkpointLabel = label(gui, "Checkpoint", "CHECKPOINT", UDim2.new(0, 280, 0, 44), UDim2.new(0.5, -140, 0, 94), 20, acid)
checkpointLabel.Visible = false

local overlay = Instance.new("Frame")
overlay.Name = "MenuOverlay"
overlay.Size = UDim2.fromScale(1, 1)
overlay.BackgroundColor3 = ink
overlay.BackgroundTransparency = 0.23
overlay.BorderSizePixel = 0
overlay.Parent = gui

local panel = Instance.new("Frame")
panel.Name = "MenuPanel"
panel.AnchorPoint = Vector2.new(0.5, 0.5)
panel.Position = UDim2.fromScale(0.5, 0.5)
panel.Size = UDim2.new(0.86, 0, 0, 430)
panel.BackgroundColor3 = panelColor
panel.BackgroundTransparency = 0.03
panel.BorderColor3 = Color3.fromRGB(110, 130, 106)
panel.Parent = overlay
corner(panel, 5)
local constraint = Instance.new("UISizeConstraint")
constraint.MinSize = Vector2.new(280, 330)
constraint.MaxSize = Vector2.new(450, 460)
constraint.Parent = panel

local title = label(panel, "Title", "STREET RACER", UDim2.new(1, -32, 0, 60), UDim2.new(0, 16, 0, 28), 34, acid)
local eyebrow = label(panel, "Eyebrow", "THE CITY IS YOURS", UDim2.new(1, -32, 0, 28), UDim2.new(0, 16, 0, 92), 14, muted)
local detail = label(panel, "Detail", "Own the road. Outlast the rush.\n\nHigh score  0000", UDim2.new(1, -44, 0, 116), UDim2.new(0, 22, 0, 135), 17, paper, Enum.Font.Gotham)
local primary = button(panel, "Primary", "START RACE", UDim2.new(1, -48, 0, 50), UDim2.new(0, 24, 1, -166), true)
local secondary = button(panel, "Secondary", "HOW TO DRIVE", UDim2.new(1, -48, 0, 46), UDim2.new(0, 24, 1, -108), false)
local tertiary = button(panel, "Tertiary", "SOUND: ON", UDim2.new(1, -48, 0, 42), UDim2.new(0, 24, 1, -54), false)

local mobile = Instance.new("Frame")
mobile.Name = "MobileControls"
mobile.Size = UDim2.new(1, 0, 0, 122)
mobile.Position = UDim2.new(0, 0, 1, -132)
mobile.BackgroundTransparency = 1
mobile.Visible = false
mobile.Parent = gui

local mobileButtons = {}
local function makeTouchButton(name, text, width, xScale, xOffset, yOffset)
	local item = button(mobile, name, text, UDim2.new(0, width, 0, 52), UDim2.new(xScale, xOffset, 0, yOffset), false)
	item.TextSize = 14
	item.BackgroundTransparency = 0.12
	mobileButtons[name] = item
	return item
end

makeTouchButton("Left", "LEFT", 68, 0, 14, 60)
makeTouchButton("Right", "RIGHT", 68, 0, 88, 60)
makeTouchButton("Gas", "GAS", 68, 1, -82, 60)
makeTouchButton("Brake", "BRAKE", 68, 1, -156, 60)
makeTouchButton("Reverse", "REVERSE", 68, 1, -82, 4)

local touchMapping = { Left = "Left", Right = "Right", Gas = "Gas", Brake = "Brake", Reverse = "Reverse" }
for buttonName, controlName in pairs(touchMapping) do
	local touchButton = mobileButtons[buttonName]
	touchButton.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			intentEvent:Fire("Touch", { Name = controlName, Down = true })
		end
	end)
	touchButton.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.Touch or input.UserInputType == Enum.UserInputType.MouseButton1 then
			intentEvent:Fire("Touch", { Name = controlName, Down = false })
		end
	end)
end

local mode = "Menu"
local highScore = 0
local currentScore = 0
local soundEnabled = true

local function formatScore(value)
	return string.format("%04d", math.max(0, math.floor(value or 0)))
end

local function setMode(nextMode)
	mode = nextMode
	overlay.Visible = mode ~= "Playing"
	hud.Visible = mode == "Playing"
	mobile.Visible = mode == "Playing" and UserInputService.TouchEnabled
	if mode == "Menu" then
		title.Text = "STREET RACER"
		eyebrow.Text = "THE CITY IS YOURS"
		detail.Text = "Own the road. Outlast the rush.\n\nHigh score  " .. formatScore(highScore)
		primary.Text = "START RACE"
		secondary.Text = "HOW TO DRIVE"
		secondary.Visible = true
		tertiary.Text = "SOUND: " .. (soundEnabled and "ON" or "OFF")
		tertiary.Visible = true
	elseif mode == "HowTo" then
		title.Text = "DRIVER BRIEFING"
		eyebrow.Text = "CONTROLS"
		detail.Text = "W / Up: accelerate\nS / Down: reverse\nSpace: brake\nA / D or arrows: steer\n\nMobile: use the on-screen pedals and steering buttons. Pass traffic and reach checkpoints for points."
		primary.Text = "GOT IT"
		secondary.Visible = false
		tertiary.Visible = false
	elseif mode == "Paused" then
		title.Text = "RACE PAUSED"
		eyebrow.Text = "TAKE A BREATHER"
		detail.Text = "Score  " .. formatScore(currentScore) .. "\nBest  " .. formatScore(highScore)
		primary.Text = "RESUME"
		secondary.Text = "RESTART"
		secondary.Visible = true
		tertiary.Text = "MAIN MENU"
		tertiary.Visible = true
	elseif mode == "GameOver" then
		title.Text = "RUN OVER"
		eyebrow.Text = "TRAFFIC COLLISION"
		detail.Text = "Score  " .. formatScore(currentScore) .. "\nBest  " .. formatScore(highScore)
		primary.Text = "RACE AGAIN"
		secondary.Text = "MAIN MENU"
		secondary.Visible = true
		tertiary.Visible = false
	end
end

primary.Activated:Connect(function()
	if mode == "Menu" or mode == "GameOver" then
		intentEvent:Fire("Clear")
		raceCommand:FireServer(mode == "GameOver" and "Restart" or "Start")
		setMode("Playing")
	elseif mode == "Paused" then
		raceCommand:FireServer("Resume")
		setMode("Playing")
	elseif mode == "HowTo" then
		setMode("Menu")
	end
end)

secondary.Activated:Connect(function()
	if mode == "Menu" then
		setMode("HowTo")
	elseif mode == "Paused" then
		raceCommand:FireServer("Restart")
		setMode("Playing")
	elseif mode == "GameOver" then
		raceCommand:FireServer("Menu")
		setMode("Menu")
	end
end)

tertiary.Activated:Connect(function()
	if mode == "Menu" then
		soundEnabled = not soundEnabled
		tertiary.Text = "SOUND: " .. (soundEnabled and "ON" or "OFF")
	elseif mode == "Paused" then
		raceCommand:FireServer("Menu")
		setMode("Menu")
	end
end)

pauseButton.Activated:Connect(function()
	if mode == "Playing" then
		intentEvent:Fire("Clear")
		raceCommand:FireServer("Pause")
		setMode("Paused")
	end
end)

UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.P or input.KeyCode == Enum.KeyCode.Escape then
		if mode == "Playing" then
			intentEvent:Fire("Clear")
			raceCommand:FireServer("Pause")
			setMode("Paused")
		elseif mode == "Paused" then
			raceCommand:FireServer("Resume")
			setMode("Playing")
		end
	end
end)

raceUpdate.OnClientEvent:Connect(function(payload)
	if type(payload) ~= "table" then
		return
	end
	currentScore = payload.Score or currentScore
	scoreLabel.Text = "SCORE  " .. formatScore(payload.Score)
	distanceLabel.Text = "DISTANCE  " .. tostring(payload.Distance or 0) .. " m"
	speedLabel.Text = tostring(payload.Speed or 0) .. " km/h"
	if payload.Checkpoints then
		checkpointLabel.Text = "CHECKPOINT " .. tostring(payload.Checkpoints)
		checkpointLabel.Visible = true
		task.delay(1.5, function()
			checkpointLabel.Visible = false
		end)
	end
	if payload.Mode == "GameOver" then
		highScore = math.max(highScore, currentScore)
		pcall(function()
			submitScore:FireServer(math.floor(currentScore))
		end)
	end
	if payload.Mode == "Playing" or payload.Mode == "Paused" or payload.Mode == "GameOver" or payload.Mode == "Menu" then
		setMode(payload.Mode)
	end
end)

pauseButton.Visible = true
if not UserInputService.TouchEnabled then
	mobile.Visible = false
end

task.spawn(function()
	for _ = 1, 5 do
		local ok, value = pcall(function()
			return getHighScore:InvokeServer()
		end)
		if ok and type(value) == "number" then
			highScore = math.max(0, math.floor(value))
			highScoreLabel.Text = "BEST  " .. formatScore(highScore)
			setMode(mode)
			return
		end
		task.wait(1)
	end
end)

setMode("Menu")