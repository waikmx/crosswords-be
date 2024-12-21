// noinspection ExceptionCaughtLocallyJS

import {generateCrossword} from "../helper/utils";
import {CrossWordsDB} from "../helper/dbConnection";
import {GameError, LimitReachedError, UnableToCompleteError} from "../exceptions";
import express from 'express';
import {findWordPositions} from '../gameLogic/findWordAlgo';
import {generateShareCode} from '../helper/helper';

require('dotenv').config()

const app = express();


export function getRouter() {
    return app;
}

const conn = new CrossWordsDB();

app.post('/allgames_list', async (req, res) => {
    let response = {'message': 'All games!'}
    let code: number = 200
    try {
        response['gameList'] = await conn.listGames(parseInt(req.body.searchLimit))
    } catch (err) {
        code = (err instanceof GameError) ? err.code : 400
        response.message = err.message
    }
    res.status(code).send(response);
});

//In Use
app.post('/search_crossword', async (req, res) => {

    let response = {'message': 'Search results!'}
    let code: number = 200
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken)
        response['gamesFound'] = await conn.searchKeywordGames(
            req.body.keyword, req.body.language, req.body.wordLimit, req.body.searchLimit
        )
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response.message = err.message
    }
    res.status(code).send(response);
})

//In Use
app.post('/topicwise_crossword', async (req, res) => {
    let response = {}
    let code: number = 400
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken, true)
        let attempts = 0;

        while (attempts < 5 && code !== 200) {
            let [game, fixed] = await conn.getRandomTopicWiseGame(
                req.body.searchtype, req.body.language, req.body.topic, req.body.category, req.body.wordLimit
            )
            if (game["totalplayed"] >= 6 && game["playstatus"] === "limited") {
                throw new LimitReachedError()
            }
            response = generateCrossword(req.body.wordLimit, req?.body?.type, fixed, game)
            if (response['words'].length == req.body.wordLimit) code = 200
            attempts++
        }
        if (code === 400) throw new UnableToCompleteError()
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});

app.post('/random_challenge', async (req, res) => {
    let response = {}
    let code: number = 400
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken, true)
        let attempts = 0;

        while (attempts < 5 && code !== 200) {
            let [game, fixed] = await conn.getRandomChallenge(req.body.language, req.body.wordLimit)
            if (game["totalplayed"] >= 6 && game["playstatus"] === "limited") {
                throw new LimitReachedError()
            }
            response = generateCrossword(req.body.wordLimit, req?.body?.type, fixed, game)
            if (response['words'].length == req.body.wordLimit) code = 200
            attempts++
        }
        if (code === 400) throw new UnableToCompleteError()
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});

// In use
app.post('/randomsearch_crossword', async (req, res) => {
    let response = {}
    let code: number = 400
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken, true)
        let attempts = 0;

        while (attempts < 5 && code !== 200) {
            let [game, fixed] = await conn.getRandomGame(
                req.body.searchtype, req.body.language, req.body.wordLimit
            )
            if (game["totalplayed"] >= 6 && game["playstatus"] === "limited") {
                throw new LimitReachedError()
            }
            response = generateCrossword(req.body.wordLimit, req?.body?.type, fixed, game)
            if (response['words'].length == req.body.wordLimit) code = 200
        }
        if (code === 400) throw new UnableToCompleteError()
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});

// In use
app.post('/gamewords_resultposition', async (req, res) => {
    // TODO: This function needs cleanup, but It's going to be done later.
    let response = {'message': 'Results words position!'}
    let code: number = 200

    try {
        await conn.getUserData(req.body.userId, req.body.accessToken)

        const words: [] = JSON.parse(req.body.words);
        const grid: [] = JSON.parse(req.body.grid);
        const correctwords = JSON.parse(req.body.correctWords);
        let wordsFound = [];
        let correctWordsFound = [];
        let wordsNotFound = []
        words.forEach(word => {
            if (findWordPositions(grid, word) === "Cannot find the word") {
                wordsNotFound.push(word)
            } else wordsFound.push(findWordPositions(grid, word));
        });

        correctwords.forEach(word => {
            if (findWordPositions(grid, word) === "Cannot find the word") {
                wordsNotFound.push(word)
            } else correctWordsFound.push(findWordPositions(grid, word));
        })
        response ["wordsFound"] = wordsFound
        response ["correctWordsFound"] = correctWordsFound
        response ["wordsNotFound"] = wordsNotFound

    } catch (err) {
        code = (err instanceof GameError) ? err.code : 400
        response.message = err.message
    }
    res.status(code).send(response);
});

function createFixed(
    req: {
        userId?: string;
        gameId?: string;
        gameName?: string;
        gameLanguage?: string;
        correct?: string[];
        incorrect?: string[];
        gameType?: string;
        searchType: any;
        gridType?: string;
        topic?: string;
        category?: string;
        words?: string;
        ug_limit?: string;
    }, game: {},
    fixed: string[][]
): [number, {}] {
    let code: number = 200
    let wordLimit = req.correct.length + req.incorrect.length

    let response = generateCrossword(wordLimit, req.searchType, fixed, game)
    console.log(JSON.stringify(response))
    return [code, response]
}

// noinspection JSUnusedAssignment
async function createGame(
    req: {
        userId: string,
        gameName: string,
        gameLanguage: string,
        correct: string[],
        incorrect: string[],
        gameType: string,
        searchType: string;
        gridType: string,
        topic: string,
        category: string,
        ug_limit: string
    },
    fixed: string[][] = null,
    subscriptionStatus: string = null
): Promise<[number, {}]> {
    let game: {}
    let gameID = await conn.createGame(
        req?.userId,
        req?.gameName.toUpperCase(),
        generateShareCode(7),
        req?.gameLanguage,
        subscriptionStatus,
        req?.correct,
        req?.incorrect,
        req?.gameType,
        req?.searchType,
        req?.gridType,
        req?.ug_limit,
        req?.topic,
        req?.category
    );
    [game, fixed] = await conn.getWithGameID(gameID.toString())

    return createFixed(req, game, fixed)
}

async function updateGame(
    req: {
        userId: string,
        gameId: string
        gameName: string,
        gameLanguage: string,
        correct: string[],
        incorrect: string[],
        gameType: string,
        searchType: string;
        gridType: string,
        topic: string,
        category: string,
        ug_limit: string
    }, subscriptionStatus: string,
): Promise<[number, {}]> {
    let [game, fixed] = await conn.updateGame(
        req.gameId,
        req.gameName.toUpperCase(),
        req.gameLanguage,
        req.correct,
        req.incorrect,
        req.gameType,
        req.searchType,
        req.gridType,
        req.topic,
        req.category,
        null,
        subscriptionStatus,
        req.ug_limit
    )
    return createFixed(req, game, fixed)
}


async function deleteGame(id: string) {
    await conn.legacy('DELETE from gameleaderboards where gameid=$1', [id])
    await conn.legacy('DELETE from fixed_grids where game=$1', [id])
    await conn.legacy('DELETE from games where id=$1;', [id])
}


// In use
app.post('/deleteGame', async function (req, res) {
    let response = {'message': 'Game deleted successfully!'}
    let code: number = 200
    try {
        await deleteGame(req.body.gameId)
    } catch (err) {
        code = (err instanceof GameError) ? err.code : 400
        response.message = err.message
    }
    res.status(code).send(response);
});

// In use
app.post('/deleteUserGame', async function (req, res) {
    let response = {'message': 'Game deleted successfully!'}
    let code: number = 200
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken)
        await deleteGame(req.body.gameId)
    } catch (err) {
        code = (err instanceof GameError) ? err.code : 400
        response.message = err.message
    }
    res.status(code).send(response);
});
// In use
app.post('/createGame', async function (
    req,
    res
) {
    let response: {}
    let code: number
    try {
        let data = await conn.getUserData(req.body.userId, req.body.accessToken);
        let body = req["body"]

        if ("correct" in body && typeof body["correct"] === "string") {
            body["correct"] = JSON.parse(body["correct"]);
        }

        if ("incorrect" in body && typeof body["incorrect"] === "string") {
            body["incorrect"] = JSON.parse(body["incorrect"]);
        }

        [code, response] = await createGame(body, null, data.subscriptionstatus)
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});

// Not used
app.post('/systemCreateGame', async function (req, res) {
    let response: {}
    let code: number
    try {
        [code, response] = await createGame(req["body"])
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});

// Not used
app.post('/systemEditGame', async function (req, res) {
    let response: {} = {'message': 'Game updated successfully!'}
    let code: number
    try {
        let data = await conn.getUserData(req.body.userId, req.body.accessToken);
        [code, response] = await updateGame(req["body"], data.subscriptionstatus)

    } catch (err) {
        code = (err instanceof GameError) ? err.code : 400
        response["message"] = err.message
    }
    res.status(code).send(response);
});

// In use
app.post('/editGame', async function (req, res) {
    let response: {} = {'message': 'Game updated successfully!'}
    let code: number
    try {
        let data = await conn.getUserData(req.body.userId, req.body.accessToken);
        let body = req["body"]
        body["correct"] = JSON.parse(body["correct"]);
        body["incorrect"] = JSON.parse(body["incorrect"]);

        [code, response] = await updateGame(body, data.subscriptionstatus)

    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response["message"] = err.message
    }
    res.status(code).send(response);
});

// In use
app.post('/addGameRating', async (req, res) => {

    let response = {}
    let code: number
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken)

        await conn.legacy(
            'INSERT INTO gameratings(gameid, userid, rating) ' +
            'VALUES ($1, $2, $3) ' +
            'ON CONFLICT(gameid, userid) DO UPDATE SET rating=$3;',
            [req.body.gameId, req.body.userId, req.body.rating]);

        const avg_rating = await conn.legacy('SELECT AVG(rating) FROM gameRatings WHERE gameid=$1;', [req.body.gameId]);
        const number_avg = parseFloat(String(avg_rating.rows[0].avg).toString().substring(0, 3));
        await conn.legacy('UPDATE games set avgratings=$1 where id=$2;', [number_avg, req.body.gameId]);
        code = 200
        response["message"] = 'Added rating to game successfully!';
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});

// Not used
app.post('/getGameRating', async (req, res) => {
    try {
        const data = await conn.legacy('SELECT * FROM userTable WHERE Id= $1;', [req.body.userId]);

        if (data.rows.length < 1) {
            res.status(401).send({'message': 'Invalid userId'})
        } else {

            if (data.rows[0].accesstoken === req.body.accessToken) {
                const rating_total = await conn.legacy('SELECT * FROM gameRatings WHERE gameid=$1 and rating>0;', [req.body.gameId]);
                const number_total = rating_total.rows.length;
                const avg_rating = await conn.legacy('SELECT AVG(rating) FROM WHERE gameid=$1 and rating>0;', [req.body.gameId]);
                const number_avg = avg_rating.rows[0].avg;
                res.send({
                    'message': 'Ratings got successfully!',
                    'averageRating': number_avg ?? 0,
                    'totalRating': number_total ?? 0
                });
            }
        }
    } catch (err) {
        res.status(400).send({'message': err.message});
    }
});

// In use
app.post('/duplicateGame', async (req, res) => {
    let response = {'message': 'Game duplicated!'}
    let code: number = 200

    try {
        let data = await conn.getUserData(req.body.userId, req.body.accessToken);
        let [game, fixed] = await conn.getWithGameID(req.body.gameId);

        await createGame(
            {
                userId: data.id,
                gameName: game.gamename,
                gameLanguage: game.language,
                correct: game.words["correct"],
                incorrect: game.words["incorrect"],
                gameType: game.gametype,
                searchType: game.searchtype,
                gridType: game.gridtype,
                ug_limit: game.ug_limit,
                topic: game.topic,
                category: game.category
            }, fixed, data.subscriptionstatus
        )

        response["allGames"] = (await conn.listUserGames(data.id)).rows
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
})
// In use
app.post('/getGameByCode', async (req, res) => {
    let response = {}
    let code: number
    let level = req.body.wordLimit ?? 6;
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken, true)
        let [game, fixed] = await conn.getWithShareCode(req.body.sharecode)
        if (game["totalplayed"] >= 6 && game["playstatus"] === "limited") {
            throw new LimitReachedError()
        }
        response = generateCrossword(level, req?.body?.type, fixed, game)
        console.log(`rotuer::getGameByCode:response -> ${JSON.stringify(response)}`)
        code = 200
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});