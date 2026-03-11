import test from "node:test";
import assert from "node:assert/strict";
import {createGetUserInfoHandler} from "../src/routes/getUserInfoHandler";

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

test("getUserInfo links device for existing user", async () => {
    let upsertCalls: Array<{ userId: string, deviceId: string, platform: string }> = []
    let createUserCalled = false
    let userDataCalls = 0

    const db = {
        createUser: async () => {
            createUserCalled = true
            return {}
        },
        findUserIdByDeviceId: async () => null,
        getSubscriptions: async () => ({subscriptiontype: "none", startdate: null, enddate: null}),
        getUserData: async () => {
            userDataCalls += 1
            return {
                id: "101",
                username: "user101",
                accesstoken: "token",
                gamesleft: 2,
                subscriptionstatus: "none"
            }
        },
        updateSubscription: async () => undefined,
        upsertUserDevice: async (userId: string, deviceId: string, platform: string) => {
            upsertCalls.push({userId, deviceId, platform})
            return true
        },
        limitUserGames: async () => undefined
    }

    const handler = createGetUserInfoHandler(db as any)
    const req: any = {
        body: {
            userId: "101",
            accessToken: "token",
            deviceId: "BE2A.250530.026.F3",
            platform: "android"
        }
    }
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.payload.message, "profile information")
    assert.equal(res.payload.subscriptionstatus, "none")
    assert.equal(createUserCalled, false)
    assert.equal(userDataCalls, 2)
    assert.deepEqual(upsertCalls, [{
        userId: "101",
        deviceId: "BE2A.250530.026.F3",
        platform: "android"
    }])
})

test("getUserInfo creates new user and stores device", async () => {
    let createArgs: any[] = []
    const createdUser = {
        message: "user created successfully!",
        id: 202,
        username: "guest-202",
        accesstoken: "new-token",
        gamesleft: null,
        subscriptionstatus: "none"
    }

    const db = {
        createUser: async (...args: any[]) => {
            createArgs = args
            return createdUser
        },
        findUserIdByDeviceId: async () => null,
        getSubscriptions: async () => ({subscriptiontype: "none", startdate: null, enddate: null}),
        getUserData: async () => {
            throw new Error("Invalid token")
        },
        updateSubscription: async () => undefined,
        upsertUserDevice: async () => true,
        limitUserGames: async () => undefined
    }

    const handler = createGetUserInfoHandler(db as any)
    const req: any = {
        body: {
            userId: "",
            accessToken: "",
            deviceId: "BE2A.250530.026.F3",
            platform: "android"
        }
    }
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.payload, createdUser)
    assert.deepEqual(createArgs, [null, null, null, "BE2A.250530.026.F3", "android"])
})

test("getUserInfo keeps old behavior when deviceId is missing", async () => {
    let upsertCallCount = 0

    const db = {
        createUser: async () => ({message: "user created successfully!"}),
        findUserIdByDeviceId: async () => null,
        getSubscriptions: async () => ({subscriptiontype: "none", startdate: null, enddate: null}),
        getUserData: async () => ({
            id: "301",
            username: "user301",
            accesstoken: "token",
            gamesleft: 2,
            subscriptionstatus: "none"
        }),
        updateSubscription: async () => undefined,
        upsertUserDevice: async () => {
            upsertCallCount += 1
            return true
        },
        limitUserGames: async () => undefined
    }

    const handler = createGetUserInfoHandler(db as any)
    const req: any = {
        body: {
            userId: "301",
            accessToken: "token"
        }
    }
    const res: any = mockRes()

    await handler(req, res)

    assert.equal(res.statusCode, 200)
    assert.equal(res.payload.message, "profile information")
    assert.equal(upsertCallCount, 0)
})

test("getUserInfo repeated same user-device pair remains idempotent", async () => {
    const linkedPairs = new Set<string>()

    const db = {
        createUser: async () => ({message: "user created successfully!"}),
        findUserIdByDeviceId: async () => "401",
        getSubscriptions: async () => ({subscriptiontype: "none", startdate: null, enddate: null}),
        getUserData: async () => ({
            id: "401",
            username: "user401",
            accesstoken: "token",
            gamesleft: 2,
            subscriptionstatus: "none"
        }),
        updateSubscription: async () => undefined,
        upsertUserDevice: async (userId: string, deviceId: string) => {
            linkedPairs.add(`${userId}:${deviceId}`)
            return true
        },
        limitUserGames: async () => undefined
    }

    const handler = createGetUserInfoHandler(db as any)
    const req: any = {
        body: {
            userId: "401",
            accessToken: "token",
            deviceId: "BE2A.250530.026.F3"
        }
    }

    const firstRes: any = mockRes()
    await handler(req, firstRes)

    const secondRes: any = mockRes()
    await handler(req, secondRes)

    assert.equal(firstRes.statusCode, 200)
    assert.equal(secondRes.statusCode, 200)
    assert.equal(linkedPairs.size, 1)
    assert.equal([...linkedPairs][0], "401:BE2A.250530.026.F3")
})
