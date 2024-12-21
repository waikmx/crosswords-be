import {CrossWordsDB} from "../helper/dbConnection";

require('dotenv').config()
import express from 'express';
import {GameError} from "../exceptions";

const app = express();

export function getRouter() {
    return app;
}

const conn = new CrossWordsDB();

app.post('/getLeaderboards', async (req, res) => {

    let response = {'message': 'leaderboards fetched successfully\''}
    let code: number = 200
    try {
        response['gameData'] = (await conn.getWithGameID(
            req.body.gameId,
            ["id", "userid", "gamename", "category", "gridtype"])
        )[0]
        response['leaderboards'] = await conn.getLeaderboards(req.body.gameId);
    } catch (err) {
        console.log(err.stack)
        code = (err instanceof GameError) ? err.code : 400
        response.message = err.message
    }
    res.status(code).send(response);
});

app.post('/get_blacklist_words', async (req, res) => {
    try {
        // Assuming `conn` is already defined and connected
        const query = await conn.legacy(
            'SELECT * FROM blacklist_words'
        );

        // Filter and structure the response to only include the rows
        const response = {
            message: 'Blacklist words fetched successfully',
            data: query.rows, // Only include the rows in the response
        };

        res.status(200).send(response);
    } catch (error) {
        console.error('Error fetching blacklist words:', error);
        res.status(500).send({ message: 'Error fetching blacklist words', error: error.message });
    }
});

async function getCategories(searchType: string = null, language: string = null): Promise<{ [key: string]: {} }> {
    let categories: { [key: string]: {} } = {};
    let data = await conn.getTopics(searchType, language);
    for (let row of data) {
        if (!(row.category in categories)) categories[row.category] = {}
        categories[row.category][row.topic] = row.status == "locked"
    }

    return categories
}

app.post('/getcatstopics', async function (req, res) {
    let code = 200
    let payload = {'message': 'All categories & topics!'}
    try {
        payload['categories'] = await getCategories(req.body.searchtype, req.body.language)
    } catch (err) {
        code = 400
        payload['categories'] = err.message
    }
    console.log(payload)
    res.status(code).send(payload)
});

app.post('/getallcatstopics', async function (req, res) {
    let code = 200
    let payload = {'message': 'All categories & topics!'}
    try {
        payload['categories'] = await getCategories()
    } catch (err) {
        code = 400
        payload['categories'] = err.message
    }
    res.status(code).send(payload)
});

app.post('/createCategoryTopic', async function (req, res) {
    try {
        const categoryName = req.body.categoryName;
        const language = req.body.language;
        const searchType = req.body.searchType;
        const status = req.body.status;
        const topicName = req.body.topicName;

        const categorycheck =
            await conn.legacy('SELECT * from categories where categoryname=$1 AND gamelanguage=$2 AND searchtype=$3;',
                [categoryName, language, searchType]);

        if (categorycheck.rows.length > 0) {
            await conn.legacy(
                'INSERT INTO topics(id,categoryname,topicsname,status,searchtype) ' +
                'VALUES(default,$1, $2, $3, $4);',
                [categoryName, topicName, status, searchType]
            );

            res.status(200).send({'message': 'Category & Topic created successfully!'});
        } else {
            const category = await conn.legacy(
                'INSERT INTO categories(id,categoryname,gamelanguage,searchtype)' +
                ' VALUES(default,$1, $2, $3);',
                [categoryName, language, searchType]);

            await conn.legacy(
                'INSERT INTO topics(id,categoryname,topicsname,status,searchtype) ' +
                'VALUES(default,$1, $2, $3, $4);',
                [categoryName, topicName, status, searchType]
            );

            res.status(200).send({'message': 'Category & Topic created successfully!'});
        }
    } catch (err) {
        res.status(400).send({'message': err.message});
    }
});
app.post('/editCategoryTopic', async function (req, res) {
    try {
        const categoryid = req.body.categoryId;
        const topicid = req.body.topicId;
        const categoryName = req.body.categoryName;
        const language = req.body.language;
        const searchType = req.body.searchType;
        const status = req.body.status;
        const topicName = req.body.topicName;

        const categorycheck =
            await conn.legacy('SELECT * from categories where id=$1;',
                [categoryid]);

        console.log(req.body.categoryId);
        console.log(req.body.topicId);
        console.log(status);
        console.log(language);
        if (categorycheck.rows.length > 0) {
            const topicData = await conn.legacy('SELECT * from topics where id=$1', [topicid]);
            const category = await conn.legacy(
                'UPDATE categories set categoryname=$1 , gamelanguage=$2 , searchtype=$3 where id=$4;',
                [categoryName, language, searchType, categoryid]);

            await conn.legacy(
                'UPDATE topics set categoryname=$1, topicsname=$2 , searchtype=$3, status=$4 where id=$5;',
                [categoryName, topicName, searchType, status, topicid]);


            await conn.legacy(
                'UPDATE systemgames set topic=$1 ,category=$2 where topic=$3 AND category=$4;',
                [topicName, categoryName, topicData.rows[0].topicsname, topicData.rows[0].categoryname]
            )
            res.status(200).send({'message': 'Category & Topic Updated successfully!'});
        } else {
            res.status(200).send({'message': 'Category & Topic doesnt exist!'});
        }
    } catch (err) {
        res.status(400).send({'message': err.message});
    }
});

app.post('/deleteCategoryTopic', async function (req, res) {
    try {
        const categoryid = req.body.categoryId;
        const topicid = req.body.topicId;
        const categoryName = req.body.categoryName;
        const language = req.body.language;
        const searchType = req.body.searchType;
        const status = req.body.status;
        console.log(req.body.topicId);

        const topicData = await conn.legacy('SELECT * from topics where id=$1', [topicid]);
        const topicName = topicData.rows[0].topicsname;
        await conn.legacy('DELETE from topics where id=$1', [topicid]);

        await conn.legacy(
            'UPDATE systemgames set category = null , topic=null where topic=$1',
            [topicName]);

        res.status(200).send({'message': 'Topic deleted successfully!'});
    } catch (err) {
        res.status(400).send({'message': err.message});
    }
});

app.post('/systemupdateGameLimit', async function (req, res) {

    try {
        console.log('input: ' + req.body.gamesLimit)
        const query = await conn.legacy('SELECT * from systemsettings;');
        const oldlimit = query.rows[0].gameslimit;
        await conn.legacy(
            'UPDATE systemsettings set gameslimit=$1 where id=1;',
            [parseInt(req.body.gamesLimit)]
        );

        // console.log(oldlimit);
        // console.log(req.body.gamesLimit);
        await conn.legacy(
            'UPDATE usertable set gamesleft=$1 where gamesleft=$2;',
            [parseInt(req.body.gamesLimit), oldlimit]);

        const queryUser = await conn.legacy('SELECT * from usertable;');

        for (var i = 0; i < queryUser.rows.length; i++) {
            if (parseInt(queryUser.rows[i].gamesleft) > parseInt(req.body.gamesLimit)) {
                await conn.legacy(
                    'UPDATE usertable set gamesleft=$1 where gamesleft > $1;',
                    [parseInt(req.body.gamesLimit)]
                );
            }
        }
        res.status(200).send({'message': 'Games limit updated'});
    } catch (err) {

        res.status(400).send({'message': err.message});
    }
});