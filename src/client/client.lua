local ColyseusSDK = require "colyseus.sdk"
local sdk = ColyseusSDK.Client("http://localhost:2567")

sdk:join_or_create("Solo", {}, function(err, room)
    -- skip if failed to join
    if err then return print("Couldn't join the room.") end

    -- join success!
    print("client joined!")

    room:on_message("p", function(data)
        print("player update:", data.id, data.x, data.y)
    end)

    room:on_message("e", function(data)
        print("game event:", data)
    end)

    room:on_message("m", function(data)
        print("mob update:", data)
    end)

    room:on_message("pong", function(data)
        print("server time:", data.s)
    end)

    room:on_message("leave", function(session_id)
        print("player left:", session_id)
    end)

    room:send("ready")
    room:send("ping", os.time())
    room:send("p", { x = 400, y = 300, vx = 0, vy = 0 })

    room:on("leave", function()
        print("client left!")
    end)
end)
