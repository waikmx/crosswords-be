import {Pool} from 'pg'
import {generateCrossword, range} from "./utils";
import {FixedGridMissingData, InvalidTokenError, InvalidUserError, NoGameError, NoGamesLeftError} from "../exceptions";
import {generateAccessToken, generateUserName} from "./helper";


abstract class DBConnection {
    private readonly pool: Pool

    constructor(
        user: string = null,
        host: string = null,
        database: string = null,
        password: string = null,
        port: string = null,
    ) {
        this.pool = new Pool({
            user: user ?? process.env["WERKOS_USER"],
            host: host ?? process.env["WERKOS_HOST"],
            database: database ?? process.env["WERKOS_DATABASE"],
            password: password ?? process.env["WERKOS_PASSWORD"],
            port: port ?? process.env["WERKOS_PORT"],
        });
    }

    protected async RAW_QUERY(pSQL: string, parameters: string[] = []) {
        console.log(`RAW_SQL::sql -> ${pSQL}`)
        console.log(`RAW_SQL::params  -> ${parameters}`)
        return await this.pool.query(pSQL, parameters)
    }

    protected async SELECT_WHERE(
        table: string,
        whereFields: string[] = [],
        whereValues: string[] = [],
        randomOrder: boolean = false,
        limit: number = null,
        displayFields: string[] = []
    ) {
        let sql = `SELECT ${displayFields.length>0?displayFields.join(','):'*'} FROM ${table}`
        if (whereFields.length > 0 || randomOrder == true) sql += " WHERE "
        if (whereFields.length > 0) sql += this.whereExp(whereFields)

        if (randomOrder == true) {
            if (whereFields.length > 0) sql += " AND "
            sql += " random() < 0.3 "
        }

        if (limit !== null) {
            sql += ` LIMIT $${whereFields.length + 1}`
            whereValues.push(String(limit))
        }

        console.log(`RAW_SQL::sql -> ${sql}`)
        console.log(`RAW_SQL::whereFields -> ${whereFields}`)
        console.log(`RAW_SQL::whereValues -> ${whereValues}`)

        return await this.pool.query(sql, whereValues)
    }

    private whereBit(field: string, value: number) {
        return `${field}=$${value + 1}`
    }

    private whereExp(fields: string[] = []) {
        let bits: string[] = []
        for (let index of range(0, fields.length)) bits.push(this.whereBit(fields[index], index))
        return bits.join(" AND ")
    }
}

export class CrossWordsDB extends DBConnection {
    public async getRandomGame(searchType: string, language: string, wordsLimit: string) {
        let game = await this.RAW_QUERY(
            "SELECT * " +
            "FROM games " +
            "WHERE searchtype = $1 " +
            "AND gametype = $2 " +
            "AND language = $3 " +
            "AND (JSON_ARRAY_LENGTH(words -> 'correct') + JSON_ARRAY_LENGTH(words -> 'incorrect')) >= $4 " +
            "ORDER BY RANDOM()" +
            "LIMIT 1;",
            [searchType, 'system', language, wordsLimit]
        )

        if (game.rows.length === 0) throw new NoGameError()
        return [game.rows[0], await this.getFixedGrid(game.rows[0].id, game.rows[0].gridtype)]
    }

    public async getRandomTopicWiseGame(
        searchType: string,
        language: string,
        topic: string,
        category: string,
        wordsLimit: string
    ) {
        let game = await this.RAW_QUERY(
            "SELECT * " +
            "FROM games " +
            "WHERE searchtype = $1 " +
            "AND gametype = $2 " +
            "AND language = $3 " +
            "AND topic = $4 " +
            "AND category = $5 " +
            "AND (JSON_ARRAY_LENGTH(words -> 'correct') + JSON_ARRAY_LENGTH(words -> 'incorrect')) > $6 " +
            "ORDER BY RANDOM() " +
            "LIMIT 1;",
            [searchType, 'system', language, topic, category, wordsLimit]
        )

        if (game.rows.length === 0) throw new NoGameError()
        return [game.rows[0], await this.getFixedGrid(game.rows[0].id, game.rows[0].gridtype)]
    }

    public async getRandomChallenge(language: string, wordsLimit: string) {
        let game = await this.RAW_QUERY(
            "SELECT * " +
            "FROM games " +
            "WHERE searchtype = $1 " +
            "AND gametype = $2 " +
            "AND language = $3 " +
            "AND (JSON_ARRAY_LENGTH(words -> 'correct') + JSON_ARRAY_LENGTH(words -> 'incorrect')) > $4 " +
            "ORDER BY RANDOM()" +
            "LIMIT 1;",
            ["challenge", 'system', language, wordsLimit]
        )

        if (game.rows.length === 0) throw new NoGameError()
        return [game.rows[0], await this.getFixedGrid(game.rows[0].id, game.rows[0].gridtype)]
    }

    public async searchKeywordGames(
        keyword: string,
        language: string,
        wordsLimit: string = '6',
        searchLimit: string = null
    ) {
        let sql = "SELECT  * " +
            "FROM games WHERE " +
            "UPPER(gamename) LIKE UPPER($1) AND " +
            "gametype = 'system' AND " +
            "language = $2 AND " +
            "(JSON_ARRAY_LENGTH(words -> 'correct') + JSON_ARRAY_LENGTH(words -> 'incorrect')) >= $3 " +
            "AND (" +
            "(playstatus = 'unlimited') OR " +
            "(playstatus = 'limited' AND totalplayed <= 6) " +
            ") "
        let params: string[] = ["%" + keyword + "%", language, wordsLimit]
        if (searchLimit != undefined) {
            sql += " LIMIT $4"
            params.push(searchLimit)
        }
        let game = await this.RAW_QUERY(sql, params)

        if (game.rows.length === 0) throw new NoGameError()
        return game.rows
    }

    public async createGame(
        userID: string,
        gameName: string,
        shareCode: string,
        language: string,
        subscriptionStatus: string,
        correct: string[],
        incorrect: string[] = [],
        gameType: string,
        searchType: string,
        gridType: string,
        ug_limit: string,
        topic: string = null,
        category: string = null,
        fixed: string[][] = null
    ): Promise<number> {
        let playStatus = ["1year", "1month"].includes(subscriptionStatus) ? "unlimited" : "limited"
        if (typeof correct == "string") correct = JSON.parse(correct)
        if (typeof incorrect == "string") incorrect = JSON.parse(incorrect)

        let words = {
            "correct": correct.map(word => word.toUpperCase()),
            "incorrect": incorrect.map(word => word.toUpperCase()),
        }

        let game = await this.RAW_QUERY(
            "INSERT INTO games (" +
            "userid, gamename, gametype, topic, category, searchtype, sharecode, language, " +
            "playstatus, gridtype, words, ug_limit) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) " +
            "RETURNING id, words",
            [
                userID, await this.duplicateGameCounter(gameName),
                gameType, topic == '' ? null : topic, category == '' ? null : category,
                searchType, shareCode, language, playStatus, gridType, JSON.stringify(words),
                ug_limit
            ]
        )

        if (gridType === "fixed") {
            let fixedData = generateCrossword(
                correct.length + incorrect.length,
                searchType, fixed, game.rows[0]
            )
            await this.saveFixedGrid(game.rows[0]["id"], fixedData["grid"], fixedData["words"])
        }
        return game.rows[0]["id"]
    }

    public async updateGame(
        id: string,
        gameName: string = null,
        language: string = null,
        correct: string[] = null,
        incorrect: string[] = null,
        gameType: string = null,
        searchType: string = null,
        gridType: string = null,
        topic: string = null,
        category: string = null,
        fixed: string[][] = null,
        subscriptionStatus: string = null,
        ug_limit: string = null
    ) {

        if (gridType === "fixed") {
            let game = await this.SELECT_WHERE(
                'games', // table name
                ['id'], // field to match in WHERE clause
                [id], // value for the id field
                false, // no random order
                1 // limit
            ); 
        
            let fixedGridExists = await this.SELECT_WHERE(
                'fixed_grids', // table to search
                ['game'], // search by game field
                [id], // match gameID
                false, // no random order
                1 // limit to one result
            );
        
            let fixedData = generateCrossword(
                correct.length + incorrect.length,
                searchType, fixed, game.rows[0]
            )
        
            if (fixedGridExists && fixedGridExists.rows.length > 0) {
                await this.updateFixedGrid(id.toString(), fixedData["grid"], fixedData["words"]);
            }else {
                await this.saveFixedGrid(Number(id), fixedData["grid"], fixedData["words"]);
            }
        }

        let [baseGame, _] = await this.getWithGameID(id.toString())
        let playStatus = subscriptionStatus != null ? (
            ["1year", "1month"].includes(subscriptionStatus) ? "unlimited" : "limited"
        ) : null

        let words = {
            "correct": correct.map(word => word.toUpperCase()),
            "incorrect": incorrect.map(word => word.toUpperCase()),
        }

        let members: string[] = []
        let params: string[] = []
        let currentParam = 1

        for (let [name, member] of Object.entries({
            "gamename": gameName,
            "gametype": gameType,
            "topic": topic,
            "category": category,
            "searchtype": searchType,
            "language": language,
            "playstatus": playStatus,
            "gridtype": gridType,
            "words": JSON.stringify(words),
            "ug_limit": ug_limit
        }))
            if (member != null) {
                members.push(`${name} = $${currentParam++}`)
                params.push(member)
            }

        params.push(id.toString())
        let rows = await this.RAW_QUERY(
            "UPDATE games SET " + members.join(", ") +
            ` WHERE id = $${currentParam} ` +
            "RETURNING id, words", params
        )

        if (rows.rowCount> 0 && gridType === "fixed" && ((words.correct.length + words.incorrect.length) > 3 || true)) {
            let fixedData = generateCrossword(null, searchType, null, rows.rows[0])
            await this.updateFixedGrid(id, fixedData["grid"], fixedData["words"])
        }
        return this.getWithGameID(id.toString())
    }

    public async saveFixedGrid(gameID: number, gridData: string[][], words: {}) {
        return await this.RAW_QUERY(
            "INSERT INTO fixed_grids (game, grid, words) VALUES ($1, $2, $3) RETURNING game, grid, words",
            [gameID.toString(), JSON.stringify(gridData), JSON.stringify(words)]
        )
    }

    public async updateFixedGrid(gameID: string, grid: string[][], words:{}) {
        return await this.RAW_QUERY(
            "UPDATE fixed_grids SET grid = $1, words=$2 WHERE game = $3",
            [JSON.stringify(grid), JSON.stringify(words), gameID.toString() ]
        )
    }

    public async searchRandomUserGenerated(searchType: string, language: string) {
        let game = await this.SELECT_WHERE(
            'games',
            ['gametype', 'searchtype', 'language'],
            ['public', language, searchType === 'challenge' ? 'challenge' : 'search'],
            true, 1)
        return [game.rows[0], await this.getFixedGrid(game.rows[0].id, game.rows[0].gridtype)]
    }

    public async listGames(limit: number = 30) {
        let games = await this.SELECT_WHERE('games', [], [], false, limit)
        return games.rows
    }

    public async listUserGames(user: string, searchType = null, limit: number = 30) {
        let whereFields = ["userid"]
        let values = [user]

        if (searchType !== null) {
            whereFields.push("searchtype")
            values.push(searchType)
        }
        let games = await this.SELECT_WHERE('games', whereFields, values, false, limit)
        return games.rows
    }

    public async getWithGameID(gameID: string, displayFields: string[]=[]) {
        let game = await this.SELECT_WHERE(
            'games',
            ['id'],
            [gameID],
            null,
            null,
            displayFields
        )
        if (game.rows.length === 0) throw new NoGameError()
        return [game.rows[0], await this.getFixedGrid(game.rows[0].id, game.rows[0].gridtype)]
    }

    public async getWithShareCode(code: string) {
        let game = await this.SELECT_WHERE('games', ['sharecode'], [code])
        if (game.rows.length === 0) throw new NoGameError()

        return [game.rows[0], await this.getFixedGrid(game.rows[0].id, game.rows[0].gridtype)]
    }

    public async getUserData(userId: string, userToken: string, testNoGamesLeft = false) {
        const result = await this.RAW_QUERY(
            'SELECT t.id, ' +
            'username, ' +
            'accesstoken, ' +
            'LEAST(systemGameLimit, gamesleft)     AS gamesleft, ' +
            "COALESCE(ss.subscriptiontype, 'none') AS subscriptionstatus, " +
            'systemGameLimit ' +
            'FROM (SELECT u.*, ' +
            '(SELECT ss.gameslimit ' +
            'FROM systemsettings ss ' +
            'LIMIT 1) systemGameLimit ' +
            'FROM usertable u WHERE u.id = $1) t ' +
            'LEFT JOIN subcriptionstatus ss ON t.id = ss.userid ', [userId]);
        console.log(JSON.stringify(result))
        if (result.rows.length < 1) throw new InvalidUserError()
        if (result.rows[0].accesstoken != userToken) throw new InvalidTokenError()
        if (testNoGamesLeft && result.rows[0].gamesleft <= 0 && result.rows[0].subscriptionstatus === 'none')
            throw new NoGamesLeftError()

        result.rows[0].gamesleft = 2;
        return result.rows[0]
    }

    public async getFixedGrid(gameId: string, isFixed: string) {
        let result = await this.SELECT_WHERE(`fixed_grids`, ['game'], [gameId])
        if (result.rows.length == 0) {
            if(isFixed==="fixed") throw new FixedGridMissingData()
            return []
        }
        return result.rows[0]
    }

    public async legacy(sql: string, params: any[] = []) {
        return await this.RAW_QUERY(sql, params)
    }

    private async duplicateGameCounter(originalTitle: string) {
        const name = originalTitle.replace(
            ' -', '').replace(
            '-', '').replace(
            /[0-9]/g, '').replace(
            'undefined', ''
        );

        // Step 2: Check for existing titles
        const existingTitles = await this.RAW_QUERY(
            "SELECT gamename FROM games WHERE gamename LIKE $1",
            ["%" + name + "%"]
        );
        // Step 3: Increment the title number
        let maxNumber = 1;
        existingTitles.rows.forEach((row: { [x: string]: string; }) => {
            const match = row["gamename"].match(/\d+/);
            if (match) {
                const number = parseInt(match[0]);
                if (number >= maxNumber) maxNumber = number + 1;
            }
        });

        // Step 4: Generate the new title
        return name + ' - ' + maxNumber;
    }

    public async getTopics(searchType: string = null, language: string = null) {
        let sql = 'select ' +
            't.id as id, c.categoryname as category, topicsname as topic, status ' +
            'from categories c join ' +
            'topics t on c.categoryname = t.categoryname and ' +
            'c.searchtype = t.searchtype '

        let i: number = 1
        let params = []

        if (searchType != null || language != null) sql += 'where '
        if (searchType != null) {
            sql += `c.searchtype = $${i++} `
            params.push(searchType)
        }
        if (searchType != null && language != null) sql += 'and '
        if (language != null) {
            sql += `c.gamelanguage = $${i} `
            params.push(language)
        }

        let topics = await this.RAW_QUERY(sql, params)

        return topics.rows
    }

    public async createUser(
        userName: string = null,
        token: string = null,
        limit: string = null
    ) {
        userName = userName ?? generateUserName("user", 6)
        token = token ?? generateAccessToken(userName)

        let result = await this.RAW_QUERY(
            "INSERT INTO usertable (id, username, accesstoken, gamesleft) " +
            "VALUES (default,$1, $2, (SELECT ss.gameslimit FROM systemsettings ss LIMIT 1)) " +
            "RETURNING id; ",
            [userName, token])

        await this.updateSubscription(result.rows[0].id)

        return {
            'message': 'user created successfully!',
            "id": result.rows[0].id,
            "username": userName,
            "accesstoken": token,
            "gamesleft": limit,
            'subscriptionstatus': "none"
        }
    }

    public async getSubscriptions(userID: string) {
        return (await this.SELECT_WHERE(
            "subcriptionstatus", ["userid"], [userID]
        )).rows[0]
    }

    public async updateSubscription(userID: string, status: string = "none", start: string = null, end = null) {
        await this.RAW_QUERY(
            "INSERT INTO subcriptionstatus " +
            "(userid, subscriptiontype, startdate, enddate) " +
            "VALUES ($1, $2, $3, $4) " +
            "ON CONFLICT(userid) DO UPDATE SET " +
            "subscriptiontype=$2, startdate=$3, enddate=$4",
            [userID, status, start, end]
        );
    }

    public async limitUserGames(userID: string) {
        await this.RAW_QUERY(
            'UPDATE games set playstatus=$1 where userid=$2',
            ['limited', userID]
        )
    }

    public async getLeaderboards(gameID: string) {
        return (await this.RAW_QUERY(
            "SELECT playername AS player, timescoretext AS time, crosswordscore AS score " +
            "FROM gameleaderboards " +
            "WHERE gameid = $1 " +
            "ORDER BY crosswordscore DESC, timescore ASC", [gameID])).rows;
    }
}