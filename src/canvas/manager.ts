import {Letter, Word, Promise} from "./words";
import {StraightCanvas, TransposedCanvas, DownwardsDiagonalCanvas, UpwardsDiagonalCanvas} from "./canvas";
import {range, shuffle} from "../helper/utils";
import {shuffleArray} from "../helper/helper";

export class CanvasManager {
    readonly sc: StraightCanvas
    readonly tc: TransposedCanvas
    readonly uc: UpwardsDiagonalCanvas
    readonly dc: DownwardsDiagonalCanvas

    readonly debug: boolean
    private readonly _input: Word[]
    private readonly _inserted: Word[]
    private _sample: Word[]
    private readonly _promises: Promise[]

    constructor(
        words: string[],
        wordLimit: number = 6,
        height: number = null,
        width: number = null,
        minWord: number = 3,
        maxWord: number = 12,
        debug: boolean = false
    ) {
        this._inserted = []
        this._input = []
        this._sample = []
        this._promises = []

        this.debug = debug
        this.sc = new StraightCanvas(minWord, maxWord, wordLimit, {"height": height, "width": width})
        this.tc = new TransposedCanvas(this.sc)
        this.uc = new UpwardsDiagonalCanvas(this.sc)
        this.dc = new DownwardsDiagonalCanvas(this.sc)

        this.initWords(words.map(word => new Word(word)))
    }

    private get characters() {
        return Array.from(
            new Set(
                this._sample.map(word => word.cleaned).join("")
            )).map(char => new Letter(char, this._sample))
    }

    private initWords(words: Word[]) {
        for (let word of words) {
            if (word.cleaned.length >= this.sc.minWord && word.cleaned.length <= this.sc.maxWord)
                this._input.push(word)
        }
    }

    private setupCanvasWords() {
        this._sample = shuffle(this._input).slice(0, this.sc.wordLimit)
        for (let d of [this.sc, this.tc, this.uc, this.dc]) {
            d.setupWords(this._sample)
        }
        this.startupWords()
    }

    private resetWords() {
        this._sample.forEach(word => word.reset())
        this._inserted.length = 0
    }

    addWordsStrategic(): boolean {
        let result = false

        for (let attempt of range(1, 6)) {
            this.sc.reset()
            this.resetWords()

            console.log(`Attempt # ${attempt}`)
            this.setupCanvasWords()

            result = this.strategicChainedLeastPromises()
            if (result == true) return true
        }
        return false
    }

    startupWords(): void {
        this._sample.forEach(word => word.promises.forEach(promise => this._promises.push(promise)))
        this._promises.forEach(promise => promise.setCrosses())
    }

    private findLeastPromises(words: Word[]) {
        let max: number = null
        let hold: Word = null
        words = shuffleArray(words)

        words.forEach(word => {
            let count = word.getPromiseCount(false)
            if (count > 0 && (max == null || count <= max)) {
                hold = word
                max = count
            }
        })

        return hold
    }

    strategicChainedLeastPromises(): boolean {
        while (true) {
            let word = this.findLeastPromises(this._sample.filter(
                word => word.failed == false))
            if (word == null) break

            let promises = word.getPromises(false)

            let result = false
            for (let direction of this.insertedDirections) {
                for (let promise of shuffleArray(promises.filter(p => p.direction == direction))) {
                    result = promise.write()
                    if (result == true) {
                        this._inserted.push(word)
                        if (word.length > this.sc.maxWord / 2 - 1) this.strategicChainLeastPromisesStep(promise)
                        break
                    }
                }
                if (result == true) break
            }
        }
        return this._inserted.length == this.sc.wordLimit
    }

    strategicChainLeastPromisesStep(promise: Promise): void {
        let crossedPromises = promise.crossPromises
        for (let crossed of crossedPromises) {
            let result = false
            let word = this.findLeastPromises(crossed.promises.map(promise => promise.word))
            let promises = crossed.promises.filter(cross => cross.word == word)
            for (let direction of this.insertedDirections) {
                for (let cross of promises.filter(p => p.direction == direction)) {
                    result = cross.write()
                    if (result == true) {
                        this._inserted.push(word)
                        break
                    }
                }
                if (result == true) break
            }
            if (result == true) break
        }
    }


    private get insertedDirections(): string[] {
        return ["h", "v", "u", "d"].map(direction =>
            [direction, this._sample.filter(word => word.direction == direction).length]
        ).sort((a: [string, number], b: [string, number]) => a[1] - b[1])
            .map((d: [string, number]) => d[0])
    }

    get string(): string {
        return this.sc.string
    }

    get debugString(): string[] {
        return [
            this.sc.string,
            this.tc.string,
            this.dc.string,
            this.uc.string
        ]
    }

    get complete():string[][] {
        if (this.characters.length>0)
            return this.sc.complete(this.characters)
        return []
    }

    get inserted() {
        return this._inserted
    }
}