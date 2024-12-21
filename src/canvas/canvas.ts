import {Cell, Word, Promise, Letter} from "./words";
import {range} from "../helper/utils";

export abstract class BaseCanvas {
    readonly minWord: number
    readonly maxWord: number
    readonly wordLimit: number
    protected maxCanvas: number

    protected _canvas: Cell[][]
    protected _positions: {}

    protected constructor(
        minWord: number = 3,
        maxWord: number = 14,
        wordLimit: number = 18,
        parameters: { [key: string]: any } = {}
    ) {
        console.log(`BaseCanvas >> minWord: ${minWord}, maxWord:${maxWord}`)
        if (minWord > maxWord) throw new Error("Inconsistent min and max")
        this.minWord = minWord
        this.maxWord = maxWord
        this.wordLimit = wordLimit

        this._canvas = []
        this._positions = {}

        this.initCanvas(parameters)
        this.calculatePositions()
        this.setMaxCanvas(minWord, maxWord)
    }

    abstract initCanvas({}: { [key: string]: any }): void

    abstract get direction(): "h" | "v" | "u" | "d"

    private calculatePositions(): void {
        for (let row of range(0, this._canvas.length)) {
            for (let col of range(0, this._canvas[row].length)) {
                let _ = this._canvas[row][col]
                if (this._positions[_.y] === undefined) this._positions[_.y] = {}
                this._positions[_.y][_.x] = [row, col]
            }
        }
    }

    public setupWords(words: Word[]): void {
        this.addPromises(words)
    }

    private addPromises(words: Word[]): void {
        for (let word of words) {
            for (let y of range(0, this._canvas.length)) {
                for (let x of range(0, this._canvas[y].length - word.length + 1)) {
                    let target = this.getTarget(word, x, y)
                    if (target.length > 0) {
                        let promise = new Promise(word, target, this.direction)
                        for (let index of range(0, word.length))

                            target[index].addPromise(promise, index)
                    }
                }
            }
        }
    }

    private setMaxCanvas(minWord: number, maxWord: number): void {
        let maxCanvas = Math.max(...this._canvas.map((x) => x.length))
        maxCanvas = Math.min(maxCanvas, maxWord)
        if (minWord > maxCanvas) throw new Error("Inconsistent min and max after canvas max calc")
        this.maxCanvas = maxCanvas
    }

    private getObjectRow(row: number): Cell[] {
        return this._canvas[row]
    }

    private getTarget(word: Word, x: number, y: number): Cell[] {
        const length: number = word.length
        const target: Cell[] = this.getObjectRow(y).slice(x, x + length)
        if (typeof target === "string") return []

        return this.validateTarget(word, target)
    }

    private validateTarget(word: Word, target: Cell[]): Cell[] {
        for (let i of range(0, target.length))
            if (
                typeof target[i] == "undefined" || (
                    target[i].val !== "." && target[i].val != word.cleaned[i]
                )
            ) return []

        return target
    }

    get canvas(): Cell[][] {
        return this._canvas
    }

    get string(): string {
        let outer: string[] = []
        for (let row of this._canvas) {
            let inner: string[] = []
            for (let char of row) inner.push(char.val)
            outer.push(inner.join(" "))
        }
        return outer.join("\n")
    }

    complete(letters: Letter[]): string[][] {
        let result: string[][] = []
        for (let row of this._canvas) {
            result.push([])
            for (let char of row) result.at(-1).push(char.complete(letters))
        }
        return result
    }

    public reset() {
        for (let row of this._canvas) {
            for (let cell of row) cell.reset()
        }
    }
}

export class StraightCanvas extends BaseCanvas {
    constructor(
        minWord: number = 3,
        maxWord: number = 14,
        wordLimit: number = 18,
        parameters: {
            height: number,
            width: number
        } = {
            height: null,
            width: null
        }
    ) {
        parameters.height = parameters.height ?? 14
        parameters.width = parameters.width ?? 11

        maxWord = Math.min(Math.max(parameters.width, parameters.height), maxWord)
        super(minWord, maxWord, wordLimit, parameters);
    }

    initCanvas({height = 10, width = 14}): void {
        for (let h of range(0, height)) {
            this._canvas.push([])
            for (let w of range(0, width))
                this._canvas[h].push(new Cell(w, h))
        }
    }

    get direction(): "h" {
        return "h";
    }
}

export class TransposedCanvas extends BaseCanvas {
    constructor(canvas: BaseCanvas) {
        super(
            canvas.minWord,
            canvas.maxWord,
            canvas.wordLimit,
            {canvas}
        );
    }

    initCanvas({canvas}: { canvas: BaseCanvas }): void {
        this._canvas = canvas.canvas[0].map(
            (_, colIndex) =>
                canvas.canvas.map(
                    row => row[colIndex]
                )
        );
    }

    get direction(): "v" {
        return "v";
    }
}

abstract class DiagonalCanvas extends BaseCanvas {
    constructor(canvas: BaseCanvas) {
        super(canvas.minWord, canvas.maxWord, canvas.wordLimit, {canvas})
    }
}

export class DownwardsDiagonalCanvas extends DiagonalCanvas {
    initCanvas({canvas}: { canvas: BaseCanvas }): void {
        let sourceCanvas: Cell[][] = canvas.canvas
        let rowCount: number = sourceCanvas.length
        let colCount: number = sourceCanvas[0].length

        let rowCap: number = rowCount - this.minWord + 1
        let colCap: number = colCount - this.minWord + 1

        for (let row of range(1, colCap).reverse()) {
            this._canvas.push([])
            for (let col of range(0, Math.min(colCount - row, rowCount)))
                this._canvas.at(-1).push(sourceCanvas[col][row + col])
        }

        for (let row of range(0, rowCap)) {
            this._canvas.push([])
            for (let col of range(0, Math.min(rowCount - row, colCount))) {
                let _ = sourceCanvas[row + col][col]
                this._canvas.at(-1).push(_)
            }
        }
    }

    get direction(): "d" {
        return "d";
    }
}


export class UpwardsDiagonalCanvas extends DiagonalCanvas {
    initCanvas({canvas}: { canvas: BaseCanvas }) {
        let sourceCanvas: Cell[][] = canvas.canvas
        let rowCount: number = sourceCanvas.length
        let colCount: number = sourceCanvas[0].length

        let colCap: number = colCount - this.minWord + 1

        for (let row of range(this.minWord - 1, rowCount - 1)) {
            this._canvas.push([])
            for (let col of range(0, Math.min(row + 1, colCount)))
                this._canvas.at(-1).push(sourceCanvas[row - col][col])
        }

        for (let col of range(0, colCap)) {
            this._canvas.push([])
            for (let row of range(0, Math.min(rowCount, colCount - col)))
                this._canvas.at(-1).push(sourceCanvas[rowCount - row - 1][col + row])
        }
    }

    get direction(): "u" {
        return "u";
    }
}