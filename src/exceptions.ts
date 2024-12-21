export class GameError extends Error {
    readonly code: number

    constructor(message: string, code: number) {
        super(message);
        this.name = 'GameError'
        this.code = code
    }
}

export class NoGameError extends GameError {
    constructor() {
        super('The requested game does not exist', 404);
        this.name = 'NoGameError'
    }
}

export class UserAlreadyExists extends GameError {
    constructor() {
        super('This username already exists!', 409);
        this.name = 'UserAlreadyExists'
    }
}

export class UnableToCompleteError extends GameError {
    constructor() {
        super('Couldn\'t generate a crossword under the attempt limit', 500);
        this.name = 'UnableToCompleteError'
    }
}

export class NoGamesLeftError extends GameError {
    constructor() {
        super('No games left!', 402);
        this.name = 'NoGamesLeftError'
    }
}

export class InvalidTokenError extends GameError {
    constructor() {
        super('Invalid token, Not Authenticated', 401);
        this.name = 'InvalidTokenError'
    }
}

export class InvalidUserError extends GameError {
    constructor() {
        super('Invalid token!', 401);
        this.name = 'InvalidUserError'
    }
}


export class LimitReachedError extends GameError {
    constructor() {
        super(
            'You cannot play this game as this game already reached the limit!',
            403);
        this.name = 'LimitReachedError'
    }
}

export class FixedGridMissingData extends GameError {
    constructor() {
        super(
            'The grid was defined as fixed, but lacks data.',
            401);
        this.name = 'FixedGridMissingData'
    }
}

export class CreateGameError extends GameError {
    constructor() {
        super(
            'Failed to create a game!',
            401);
        this.name = 'CreateGameError'
    }
}