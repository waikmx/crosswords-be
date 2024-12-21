import {cleanUp, range, shuffle} from "../helper/utils";
import {shuffleArray} from "../helper/helper";


export class Letter {
    char: string
    readonly usedBy: Word[]
    readonly startsWith: Word[]
    readonly endsWith: Word[]

    constructor(char: string, words: Word[]) {
        this.char = cleanUp(char)
        this.usedBy = words.filter(word => word.cleaned.includes(this.char))
        this.startsWith = this.wordsWithCharAtPos(words, 0)
        this.endsWith = this.wordsWithCharAtPos(words, -1)
    }

    private wordsWithCharAtPos(words: Word[], pos: 0 | -1) {
        return words.filter(word => word.cleaned.at(pos) == this.char)
    }
}

class CrossPromise {
    readonly count: number
    private readonly _promises: Promise[]

    constructor(count: number) {
        this.count = count
        this._promises = []
    }

    get promises(): Promise[] {
        return shuffle(this._promises)
    }
}

export class Word {
    readonly cleaned: string
    readonly _original: string
    readonly promises: Promise[]
    activePromise: Promise

    constructor(word: string) {
        this.cleaned = cleanUp(word)
        this._original = word
        this.promises = []
        this.activePromise = null
    }

    addPromise(promise: Promise) {
        this.promises.push(promise)
        this.promises.push(promise)
    }

    get inserted(): boolean {
        return this.activePromise != null
    }

    reset() {
        this.promises.length = 0
        this.activePromise = null
    }

    get length() {
        return this.cleaned.length
    }

    get original() {
        return this._original.toUpperCase()
    }

    getPromiseCount(broken: boolean | null): number {
        return this.promises.filter(promise => promise.isBroken == broken).length
    }

    getPromises(broken: boolean | null): Promise[] {
        return this.promises.filter(promise => promise.isBroken == broken)
    }

    get failed() {
        return this.inserted == false && this.getPromises(false).length == 0
    }

    get crossWords(): CrossPromise[] {
        let result: CrossPromise[] = []
        this.getPromises(false).forEach(promise => {
            let crossChars = promise.crossChars
            let current = result.filter(r => r.count == crossChars)[0]
            if (current == undefined) {
                current = new CrossPromise(crossChars)
                result.push(current)
            }
            current.promises.push(promise)
        })
        return result.sort((a, b) => b.count - a.count)
    }

    get direction() {
        if (this.activePromise == null) return null
        return this.activePromise.direction
    }

    get startsAt(): [number, number] {
        if (this.activePromise == null) return null
        return this.activePromise.startsAt
    }

    get endsAt(): [number, number] {
        if (this.activePromise == null) return null
        return this.activePromise.endsAt
    }
}

export class Promise {
    readonly word: Word
    readonly cells: Cell[]
    crosses: Promise[][]

    readonly direction: "h" | "v" | "u" | "d"

    constructor(word: Word, cells: Cell[], direction: "h" | "v" | "u" | "d") {
        this.word = word
        this.cells = cells
        this.direction = direction

        word.addPromise(this)
    }

    get isBroken() {
        if (this.isFulfilled || this.word.inserted) return null
        else return !this.testCells
    }

    private get testCells(): boolean {
        for (let index of range(0, this.cells.length)) {
            let val = this.cells[index].val
            if (val != "." && val != this.word.cleaned[index]) return false
        }

        return this.cells.filter(
            cell => cell.words.filter(
                word => word.direction == this.direction)
                .length > 0
        ).length <= (this.word.cleaned.length / 2) - 1;
    }

    get isFulfilled() {
        return this.cells.filter(cell => cell.words.includes(this.word)).length > 0
    }

    write() {
        for (let index of range(0, this.cells.length)) {

            let result = this.cells[index].setVal(this.word, index)
            if (result == false) return false
        }
        this.word.activePromise = this
        return true
    }

    setCrosses() {
        let result: Promise[][] = []
        for (let index of range(0, this.cells.length)) {
            let promises = this.cells[index].charPromises[this.word.cleaned[index]]
            if (typeof promises != "undefined")
                result.push(promises.filter(promise => this.word != promise.word))
        }
        this.crosses = result
    }

    get crossChars(): number {
        return this.cells.filter(cell => cell.val != ".").length
    }

    get crossPromises(): CrossPromise[] {
        let result: CrossPromise[] = []
        for (let promise of this.crosses) {
            promise.filter(promise => promise.isBroken == false).forEach(promise => {
                let crossChars = promise.crossChars
                let current = result.filter(r => r.count == crossChars)[0]
                if (current == undefined) {
                    current = new CrossPromise(crossChars)
                    result.push(current)
                }
                current.promises.push(promise)
            })
        }
        return result.sort((a, b) => b.count - a.count)
    }

    get startsAt(): [number, number] {
        return [
            this.cells.at(0).x, this.cells.at(0).y
        ]
    }

    get endsAt(): [number, number] {
        return [
            this.cells.at(-1).x, this.cells.at(-1).y
        ]
    }
}

export class Cell {
    private _val: string
    private _words: Word[]

    private readonly _x: number
    private readonly _y: number
    private _charPromises: { [k: string]: Promise[] }
    private _directedPromises: { [k: string]: Promise[] }

    constructor(x: number, y: number, val: string = ".") {
        this._val = val
        this._x = x
        this._y = y
        this._charPromises = {}
        this._words = []
        this._directedPromises = {"h": [], "v": [], "u": [], "d": []}
    }

    reset() {
        this._words.forEach(word => word.reset())
        this._words = []
        this._charPromises = {}
        this._directedPromises = {"h": [], "v": [], "u": [], "d": []}

        this._val = "."
    }

    get charPromises() {
        return this._charPromises
    }

    public setVal(word: Word, index: number): boolean {
        if (word.inserted) return false
        if (this._val != "." && this._val != word.cleaned[index]) return false

        this._val = word.cleaned[index]
        this._words.push(word)
        return true

    }

    get val(): string {
        return this._val
    }

    complete(letters: Letter[]): string {
        if (this._val != ".") return this.val
        else {
            let _: Letter = shuffleArray(letters)[0]
            return _.char
        }
    }

    get words(): Word[] {
        return this._words
    }

    get position(): [number, number] {
        return [this._x, this._y]
    }

    get x(): number {
        return this._x
    }

    get y(): number {
        return this._y
    }

    addPromise(promise: Promise, index: number) {
        let char = promise.word.cleaned[index]
        if (!(char in this._charPromises)) this._charPromises[char] = []
        this._charPromises[char].push(promise)
        this._directedPromises[promise.direction].push(promise)
    }
}