import {GameError, NoGamesLeftError, UserAlreadyExists} from "../exceptions";
import express from 'express';
import {generateAccessToken, generateUserName} from '../helper/helper';
import {CrossWordsDB} from "../helper/dbConnection";
import {addMonths, addYears, format} from 'date-fns'

require('dotenv').config()

const conn = new CrossWordsDB();
const app = express();

export function getRouter() {
    return app;
}

const Pool = require('pg').Pool
const pool = new Pool({
    user: process.env.WERKOS_USER,
    host: process.env.WERKOS_HOST,
    database: process.env.WERKOS_DATABASE,
    password: process.env.WERKOS_PASSWORD,
    port: process.env.WERKOS_PORT,
});

//TODO: Remove getUserName and integrate into getUserInfo
app.get('/getUserName', async (req, res) => {

    try {
        let userName = generateUserName("user", 6);
        let token = generateAccessToken(userName);
        const data = await conn.legacy(`SELECT * FROM usertable WHERE username= $1;`, [userName]); //Checking if user already exists
        const arr = data.rows;
        if (arr.length != 0) {
            res.send({'message': 'User already exists, try to call this API again'});
        } else {
            console.log("User created");
            const gamesLimit = await conn.legacy('SELECT * from systemsettings;', []);
            const limit = gamesLimit.rows[0].gameslimit;
            await pool.query(
                `Insert into usertable values (default,$1, $2, $3, 'none')`,
                [userName, token, limit], async (err) => {
                    if (err) {
                        res.send({"message": err.message});
                    } else {
                        const id = await conn.legacy(`SELECT * FROM usertable WHERE username= $1;`, [userName]);

                        if (id.rows.length < 1) {
                            res.send({"message": "There was an error"});
                        } else {
                            res.send({
                                'message': 'user created successfully!',
                                "id": id.rows[0].id,
                                "username": userName,
                                "accesstoken": token,
                                "gamesleft": limit,
                                'subscriptionstatus': "none"
                            });
                        }
                    }
                });
        }
    } catch (err) {
        res.status(400).send({'message': err.message});
    }

});

app.post('/changeUserName', async (req, res) => {

    let response = {'message': 'userName updated successfully!'}
    let code: number = 200
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken)

        const nameCheck = await conn.legacy('SELECT * FROM usertable WHERE username =  $1', [req.body.newName]);
        if (nameCheck.rows.length > 0) throw new UserAlreadyExists();

        await conn.legacy(
            'UPDATE usertable set username=$1 where id=$2 RETURNING username, id',
            [req.body.newName, req.body.userId]
        );

        await conn.legacy(
            'UPDATE gameleaderboards set playername=$1 where userid=$2;',
            [req.body.newName, req.body.userId]);

        response["username"] = req.body.newName


    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response.message = err.message
    }
    res.status(code).send(response);
});


app.post('/getUserInfo', async (req, res) => {
    let response: {}
    let code: number = 200

    try {
        let userData = await conn.getUserData(req.body.userId, req.body.accessToken)

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
        response['subscriptionstatus'] = subStatus["subscriptiontype"];
        response['message'] = 'profile information';

    } catch (err) {
         if(!(err instanceof NoGamesLeftError))
            response = await conn.createUser()
    }
    res.status(code).send(response);
});


app.post('/addUserGameRecord', async function (req, res) {
    let response = {'message': 'Results words position!'}
    let code: number = 200

    try {
        const userid = req.body.userId;
        const gameId = req.body.gameId;
        const timeScore = req.body.timeScore;
        const crosswordScore = req.body.crosswordScore;
        const timeScoreText = req.body.timeScoreText;
        const playerName = req.body.playerName;

        let data = await conn.getUserData(req.body.userId, req.body.accessToken)

        const data_ = data.gamesleft - 1;
        console.log(data.subscriptionstatus);
        if (!['1year', '1month'].includes(data.subscriptionstatus)) {
            if (data_ < 1) {
                const datenow_ = new Date();
                datenow_.setDate(datenow_.getDate() + 1)
                const yyyy_ = datenow_.getFullYear();
                let mm_: any = datenow_.getMonth() + 1; // Months start at 0!
                let dd_: any = datenow_.getDate();
                await conn.legacy('UPDATE userTable SET gamesendedatetime = $1 where id=$2;', [datenow_, userid])
            }
            await conn.legacy('UPDATE userTable SET gamesleft=$1 where id=$2;', [data_, userid]);
        }
        const game_ = await conn.legacy('SELECT * from games where id=$1;', [gameId]);
        var totalPlayed = game_.rows[0].totalplayed;

        await conn.legacy('UPDATE games set totalplayed=$1 where id=$2;', [parseInt(totalPlayed) + 1, gameId])
        const saveRecord = await conn.legacy("INSERT INTO gameleaderboards VALUES(default,$1, $2, $3,$4, $5, $6 )", [gameId,
            userid, timeScore, crosswordScore, timeScoreText, playerName])
    } catch (err) {
        code = (err instanceof GameError) ? err.code : 400
        response.message = err.message
    }
    res.status(code).send(response);
})


app.post('/getAllUserGames', async (req, res) => {
    let response = {}
    let code: number = 200
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken)
        response['message'] = 'All user game returned successfully'
        response['allGames'] = await conn.listUserGames(req.body.userId, req.body.type)
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});


app.post('/getSingleUserGames', async (req, res) => {
    let response: {}
    let code: number = 200
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken)

        const game = await conn.legacy('SELECT * FROM games WHERE gameId =$1', [req.body.gameid]);

        if (game.rows.length < 1) {
            code = 404
            response = {'message': 'No game found'}
        } else {
            const rating_total = await conn.legacy(
                'SELECT * FROM gameRatings WHERE gameid=$1 and rating > 0;', [req.body.gameid]);
            const ratingcount = rating_total.rows.length;
            const avg_rating = await conn.legacy(
                'SELECT AVG(rating) FROM gameRatings WHERE gameid=$1 and rating > 0;', [req.body.gameid]);
            const number_avg = avg_rating.rows[0].avg;

            const ratingData = {'totalRating': ratingcount, 'avgRating': number_avg};

            const allwords = await conn.legacy('SELECT * FROM systemgameallwords WHERE gameid=$1', [req.body.gameid]);
            const corrwords = await conn.legacy('SELECT * FROM systemgamecorrectwords WHERE gameid=$1', [req.body.gameid]);
            const incorrwords = await conn.legacy('SELECT * FROM systemgameincorrectwords WHERE gameid=$1', [req.body.gameid]);

            response = {
                'gameDetails': game.rows[0],
                'gameRatings': ratingData,
                "allWords": allwords.rows,
                "correctWords": corrwords.rows,
                "incorrectWords": incorrwords.rows
            }
        }
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    console.log(response)
    res.status(code).send(response)
})


app.post('/updateUserSubscriptionStatus', async (req, res) => {
    let response: {}
    let code: number

    try {
        let status = req.body.subStatus;
        const changeStatus = await conn.legacy('UPDATE usertable SET subscriptionStatus = $1 WHERE id = $2',
            [status, req.body.userId]);

        if (changeStatus.rowCount != 1) {
            code = 400
            response = {'message': 'There was an error!'}
        } else {
            let today = new Date();
            let futureDate = new Date();
            const yyyy = today.getFullYear();
            let mm: any = today.getMonth() + 1; // Months start at 0!
            let dd: any = today.getDate();
            let formattedFuture = null;
            let formattedToday = null;
            if (dd < 10) dd = '0' + dd;
            if (mm < 10) mm = '0' + mm;


            let offset = status === '1month' ? 30 : (status === '1year' ? 356 : null)
            futureDate.setDate(futureDate.getDate() + offset);
            const yyyy_ = futureDate.getFullYear();
            let mm_: any = futureDate.getMonth() + 1;
            let dd_: any = futureDate.getDate();

            if (["1month", "1year"].includes(status)) {
                formattedFuture = yyyy_ + '/' + mm_ + '/' + dd_;
                formattedToday = yyyy + '/' + mm + '/' + dd;
            }

            const limit = await conn.legacy('SELECT * from systemsettings;', []);
            await conn.legacy('UPDATE usertable set gamesleft=$1 where id=$2', [limit.rows[0].gameslimit, req.body.userId])
            await conn.legacy('UPDATE games set playstatus=$1 where userid=$2', ['unlimited', req.body.userId]);

            await conn.legacy('UPDATE subcriptionstatus SET  subscriptiontype=$4 , startdate=$1 , enddate=$2 WHERE userid=$3;',
                [formattedToday, formattedFuture, req.body.userId, status]);

            response = {
                'message': String('Updated subscription Status to ')
                    .toString().concat(status), 'subcriptionStatus': status
            };
            code = 200
        }

    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
});

app.post('/getSubscriptionStatus', async (req, res) => {
    let response = {'message': 'Subcription returned successfully'}
    let code: number = 200
    try {
        await conn.getUserData(req.body.userId, req.body.accessToken)
        let data = await conn.legacy('SELECT * FROM subcriptionstatus WHERE userid=$1', [req.body.userId]);
        response['subscriptionDetails'] = data.rows[0]

    } catch (err) {
        console.log(err.stack)
        code = err.code ?? 400
        code = (err instanceof GameError) ? err.code : 400
        response = {'message': err.message}
    }
    res.status(code).send(response)
})
