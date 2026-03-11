import test from "node:test";
import assert from "node:assert/strict";
import {createGetAllUserGamesHandler} from "../src/routes/getAllUserGamesHandler";
import {InvalidTokenError, InvalidUserError} from "../src/exceptions";

function mockRes() {
    return {
        statusCode: 200,
        payload: null,
        status(code: number) {
            this.statusCode = code
            return this
        },
        send(body: any) {
            this.payload = body
            return this
        }
    }
}

test("getAllUserGames keeps existing auth flow", async () => {
    let listedForUser: string = null

    const db = {
        findUserIdByDeviceId: async () => null,
        getUserData: async () => ({id: "500"}),
        listUserGames: async (user: string) => {
            listedForUser = user
            return [{id: 1, gamename: "A"}]
        }
    }

    const handler = createGetAllUserGamesHandler(db as any)
    const req: any = {body: {userId: "500", accessToken: "token", type: "search"}}
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.payload.message, "All user game returned successfully")
    assert.deepEqual(res.payload.allGames, [{id: 1, gamename: "A"}])
    assert.equal(listedForUser, "500")
})

test("getAllUserGames deviceId-only request returns linked user games", async () => {
    const db = {
        findUserIdByDeviceId: async () => "600",
        getUserData: async () => {
            throw new InvalidTokenError()
        },
        listUserGames: async () => [{id: 11, gamename: "DeviceGame"}]
    }

    const handler = createGetAllUserGamesHandler(db as any)
    const req: any = {body: {deviceId: "BE2A.250530.026.F3", type: "search"}}
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.payload.allGames, [{id: 11, gamename: "DeviceGame"}])
})

test("getAllUserGames missing deviceId keeps old auth error behavior", async () => {
    const db = {
        findUserIdByDeviceId: async () => null,
        getUserData: async () => {
            throw new InvalidTokenError()
        },
        listUserGames: async () => []
    }

    const handler = createGetAllUserGamesHandler(db as any)
    const req: any = {body: {userId: "500", accessToken: "bad"}}
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 401)
    assert.equal(res.payload.message, "Invalid token, Not Authenticated")
})

test("getAllUserGames device-linked user with no games returns empty result", async () => {
    const db = {
        findUserIdByDeviceId: async () => "700",
        getUserData: async () => {
            throw new InvalidTokenError()
        },
        listUserGames: async () => []
    }

    const handler = createGetAllUserGamesHandler(db as any)
    const req: any = {body: {deviceId: "BE2A.250530.026.F3"}}
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.payload.message, "All user game returned successfully")
    assert.deepEqual(res.payload.allGames, [])
})

test("getAllUserGames prefers auth user when auth and device-linked users conflict", async () => {
    let listedForUser: string = null

    const db = {
        findUserIdByDeviceId: async () => "901",
        getUserData: async () => ({id: "900"}),
        listUserGames: async (user: string) => {
            listedForUser = user
            return [{id: 90, gamename: "AuthGame"}]
        }
    }

    const handler = createGetAllUserGamesHandler(db as any)
    const req: any = {
        body: {
            userId: "900",
            accessToken: "token",
            deviceId: "BE2A.250530.026.F3"
        }
    }
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(listedForUser, "900")
    assert.deepEqual(res.payload.allGames, [{id: 90, gamename: "AuthGame"}])
})

test("getAllUserGames falls back to device user when auth is invalid", async () => {
    let listedForUser: string = null

    const db = {
        findUserIdByDeviceId: async () => "1000",
        getUserData: async () => {
            throw new InvalidUserError()
        },
        listUserGames: async (user: string) => {
            listedForUser = user
            return [{id: 100, gamename: "Recovered"}]
        }
    }

    const handler = createGetAllUserGamesHandler(db as any)
    const req: any = {
        body: {
            userId: "bad-id",
            accessToken: "bad-token",
            deviceId: "BE2A.250530.026.F3"
        }
    }
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(listedForUser, "1000")
    assert.deepEqual(res.payload.allGames, [{id: 100, gamename: "Recovered"}])
})
