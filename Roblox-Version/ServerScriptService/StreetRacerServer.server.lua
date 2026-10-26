local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local DataStoreService = game:GetService("DataStoreService")

local store = DataStoreService:GetDataStore("StreetRacerHighScore_v1")
local remotes = ReplicatedStorage:FindFirstChild("StreetRacerRemotes")
if not remotes then
	remotes = Instance.new("Folder")
	remotes.Name = "StreetRacerRemotes"
	remotes.Parent = ReplicatedStorage
end

local getHighScore = remotes:FindFirstChild("GetHighScore")
if not getHighScore then
	getHighScore = Instance.new("RemoteFunction")
	getHighScore.Name = "GetHighScore"
	getHighScore.Parent = remotes
end

local submitScore = remotes:FindFirstChild("SubmitScore")
if not submitScore then
	submitScore = Instance.new("RemoteEvent")
	submitScore.Name = "SubmitScore"
	submitScore.Parent = remotes
end

local lastSubmission = {}
local MAX_SCORE = 10000000

local function keyFor(player)
	return "player_" .. player.UserId
end

getHighScore.OnServerInvoke = function(player)
	local ok, value = pcall(function()
		return store:GetAsync(keyFor(player))
	end)
	if ok and type(value) == "number" then
		return math.max(0, math.floor(value))
	end
	return 0
end

submitScore.OnServerEvent:Connect(function(player, score)
	if type(score) ~= "number" or score ~= score then
		return
	end
	score = math.floor(score)
	if score < 0 or score > MAX_SCORE then
		return
	end

	local now = os.clock()
	if now - (lastSubmission[player] or 0) < 3 then
		return
	end
	lastSubmission[player] = now

	local ok, err = pcall(function()
		store:UpdateAsync(keyFor(player), function(previous)
			local best = type(previous) == "number" and math.floor(previous) or 0
			return math.max(best, score)
		end)
	end)
	if not ok then
		warn("Street Racer could not save a high score: " .. tostring(err))
	end
end)

Players.PlayerRemoving:Connect(function(player)
	lastSubmission[player] = nil
end)