import removeAccents from 'remove-accents'
import {CanvasManager} from "../canvas/manager";
import {Word} from "../canvas/words";

export function cleanUp(word: string) {
    let _ = ""
    for (let char of word) {
        if (char != " ")
            if (char == "ñ" || char == "Ñ")
                _ += char.toUpperCase()
            else _ += removeAccents(char).toUpperCase()
    }

    return _.replaceAll(/([^a-zA-ZñÑ0-9]+)/gi, "")
}

export function shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

export function range(start: number, end: number) {
    return Array.from({length: (end - start)}, (_v, k) => k + start);
}

function wordData(word: Word, correct: string[]) {
    return {
        original: word.original,
        "cleaned": word.cleaned,
        "startsAt": word.startsAt,
        "endsAt": word.endsAt,
        "isCorrect": correct.includes(word.original)
    }
}

export function generateCrossword(
    wordLimit: number = null,
    searchType: string,
    fixed: {} = null,
    game: {} = null,
    height: number = null,
    width: number = null,
) {
    let response: {} = {}

    console.log(`generateCrossword::game => ${JSON.stringify(game)}`)
    console.log (`generateCrossword::game["words"] =>  ${JSON.stringify(game["words"])}`)

    let correct: string[] = [... new Set<string>(game["words"]["correct"])]
    let incorrect: string[] = [... new Set<string>(game["words"]["incorrect"])].filter(
        word => !correct.includes(word)
    )
    let all: string[] = correct.concat(incorrect)
    console.log (`generateCrossword::correct =>  ${JSON.stringify(correct)}`)
    console.log (`generateCrossword::incorrect =>  ${JSON.stringify(incorrect)}`)

    if (game["gridtype"] === "fixed" && fixed !== null) {
        response["words"] = fixed["words"]
        response["grid"] = fixed["grid"]
    } else {
        let cm = new CanvasManager(all,
            game["userid"] != null ? game["ug_limit"] : (wordLimit ?? all.length),
            height, width)
        cm.addWordsStrategic()
        response ['words'] = cm.inserted.map(word => wordData(word, correct))
        response['grid'] = cm.complete
    }

    console.log(`generateCrossword::response =>  ${JSON.stringify(response)}`)

    if (game !== null) response['gameDetails'] = JSON.parse(JSON.stringify(game))
    delete response['gameDetails']['words']

    if (searchType ?? game["type"] === 'challenge') response['isChallenge'] = true

    return response
}
