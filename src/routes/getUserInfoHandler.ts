import {Request, Response} from "express";
import {addMonths, addYears, format} from "date-fns";
import {NoGamesLeftError} from "../exceptions";

interface GetUserInfoDB {
    createUser: (
        userName?: string,
        token?: string,
        limit?: string,
        deviceId?: string,
        platform?: string
    ) => Promise<any>;
    findUserIdByDeviceId: (deviceId: string) => Promise<string | null>;
    getSubscriptions: (userID: string) => Promise<any>;
    getUserData: (userId: string, userToken: string, testNoGamesLeft?: boolean) => Promise<any>;
    updateSubscription: (userID: string, status?: string, start?: string, end?: string) => Promise<void>;
    upsertUserDevice: (userId: string, deviceId: string, platform?: string) => Promise<boolean>;
    limitUserGames: (userID: string) => Promise<void>;
}

function normalizeDeviceId(deviceId: string = null) {
    if (typeof deviceId !== "string") return null
    const trimmed = deviceId.trim()
    return trimmed.length > 0 ? trimmed : null
}

function maskDeviceId(deviceId: string = null) {
    if (typeof deviceId !== "string" || deviceId.length === 0) return "[empty]"
    if (deviceId.length <= 6) return "***"
    return `${deviceId.slice(0, 3)}***${deviceId.slice(-3)}`
}

async function safeLinkDevice(
    conn: GetUserInfoDB,
    userId: string,
    deviceId: string,
    platform: string = null
) {
    const normalizedDeviceId = normalizeDeviceId(deviceId)
    if (normalizedDeviceId == null) return

    try {
        const linkedUserId = await conn.findUserIdByDeviceId(normalizedDeviceId)
        if (linkedUserId != null && String(linkedUserId) !== String(userId)) {
            console.warn(
                `[user_devices] device ${maskDeviceId(normalizedDeviceId)} is linked to another user; skipping reassignment`
            )
            return
        }

        await conn.upsertUserDevice(String(userId), normalizedDeviceId, platform)
    } catch (error) {
        console.warn("[user_devices] failed to persist user-device link for getUserInfo")
        console.warn(error?.message ?? error)
    }
}

export function createGetUserInfoHandler(conn: GetUserInfoDB) {
    return async (req: Request, res: Response) => {
        let response: any
        let code: number = 200
        const deviceId = normalizeDeviceId(req.body?.deviceId)
        const platform = req.body?.platform ?? null

        try {
            let userData = await conn.getUserData(req.body.userId, req.body.accessToken)

            if (deviceId != null) {
                await safeLinkDevice(conn, String(userData.id), deviceId, platform)
            }

            if (["1month", "1year"].includes(req.body.subStatus)) {
                let f = "yyyy/MM/dd"
                let today = new Date()
                let end = (req.body.subStatus == "1month" ? addMonths : addYears)(today, 1)
                await conn.updateSubscription(
                    userData.id, req.body.subStatus, format(today, f), format(end, f)
                )
            }

            let subStatus = await conn.getSubscriptions(userData.id)
            if (subStatus["startdate"] != null) {
                const startDate = subStatus["startdate"];
                const endDate = subStatus["enddate"];

                if (startDate > endDate) {
                    await conn.updateSubscription(userData.id)
                    await conn.limitUserGames(userData.id);
                }
            }

            response = await conn.getUserData(req.body.userId, req.body.accessToken)
            response["subscriptionstatus"] = subStatus["subscriptiontype"]
            response["message"] = "profile information"
        } catch (err) {
            if (!(err instanceof NoGamesLeftError)) {
                response = await conn.createUser(null, null, null, deviceId, platform)
            }
        }
        res.status(code).send(response)
    }
}
