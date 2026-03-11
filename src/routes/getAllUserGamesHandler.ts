import {Request, Response} from "express";
import {GameError} from "../exceptions";

interface GetAllUserGamesDB {
    findUserIdByDeviceId: (deviceId: string) => Promise<string | null>;
    getUserData: (userId: string, userToken: string, testNoGamesLeft?: boolean) => Promise<any>;
    listUserGames: (user: string, searchType?: string, limit?: number) => Promise<any[]>;
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

export function createGetAllUserGamesHandler(conn: GetAllUserGamesDB) {
    return async (req: Request, res: Response) => {
        let response = {}
        let code: number = 200
        const deviceId = normalizeDeviceId(req.body?.deviceId)

        let authError: Error = null
        let authUser: any = null
        let resolvedUserId: string = null

        try {
            authUser = await conn.getUserData(req.body.userId, req.body.accessToken)
            resolvedUserId = String(authUser.id)
        } catch (error) {
            authError = error
        }

        try {
            if (resolvedUserId != null) {
                if (deviceId != null) {
                    try {
                        const deviceUserId = await conn.findUserIdByDeviceId(deviceId)
                        if (
                            deviceUserId != null &&
                            String(deviceUserId) !== String(resolvedUserId)
                        ) {
                            console.warn(
                                `[user_devices] auth and device users differ for device ${maskDeviceId(deviceId)}; using auth user`
                            )
                        }
                    } catch (error) {
                        console.warn("[user_devices] failed device lookup during auth comparison")
                        console.warn(error?.message ?? error)
                    }
                }
            } else if (deviceId != null) {
                resolvedUserId = await conn.findUserIdByDeviceId(deviceId)
            }

            if (resolvedUserId == null) {
                throw authError ?? new Error("Unable to resolve user")
            }

            response["message"] = "All user game returned successfully"
            response["allGames"] = await conn.listUserGames(resolvedUserId, req.body.type)
        } catch (err) {
            console.log(err?.stack ?? err)
            code = (err instanceof GameError) ? err.code : 400
            response = {message: err?.message ?? "Unable to resolve user"}
        }

        res.status(code).send(response)
    }
}
