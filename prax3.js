"use strict";

// This object holds all possible playing card suits and values.
const CARDS = {
    "values": [
        "ace", "2", "3", "4", "5", "6", "7", "8", "9", "10", "jack", "queen", "king"
    ],
    "suits": [
        "clubs", "diamonds", "spades", "hearts"
    ]
};

// This prefix is used to locate the card image.
// Card image name is following the format:
// {card value}_of_{suit}.
const PATH_PREFIX = 'Playing Cards\\';
const REVERSE_SIDE_PATH = `${PATH_PREFIX}reverse_side.png`;

// States of timer. Indicate whether the timer has to be stopped or started.
const START_TIMER = 'start';
const STOP_TIMER = 'stop';

// Server settings.
const SERVER_LOCAL = 'http://localhost:8000/cgi-bin/prax3.py';
const SERVER_LIVE = 'http://dijkstra.cs.ttu.ee/~alfrol/cgi-bin/prax3.py';
let server = SERVER_LOCAL;

let playerName;
let mode;
let cardsAmount;
let timer;
let score = 0;
let scoreText;
let order = 'asc';

// Indicates how many correct guesses the player has.
let streak = 0;
let timePassed = 1;

/**
 * Validate player name.
 * The name is needed in order to start a new game.
 */
function validatePlayerName() {
    const name = getGameForm()['player-name'].value;
    if (!name.trim()) {
        getById('play-button').style.visibility = 'hidden';
    } else {
        playerName = name;
        getById('play-button').style.visibility = 'visible';
    }
}

/**
 * Change field size options according to selected game mode.
 * 
 * Mode defines which cards are treated as pairs and can be:
 * 1. Only value
 * 2. Both value and suit
 */
function changeBoardSize() {
    const boardSizeSelector = getById('board-size');
    if (mode === 'same-value') {
        boardSizeSelector.removeChild(boardSizeSelector.options[3]);
    } else {
        const option = createElement('option');
        option.value = '52';
        option.innerText = '52';
        boardSizeSelector.appendChild(option);
    }
}

/**
 * Start the game by generating the table.
 * 
 * Before starting the game the user must specify
 * the preferences (how to count pairs and number
 * of cards they want to play with).
 */
function startGame() {
    generateGameField();
    setTimer(START_TIMER);
    document.getElementsByClassName('details')[0].style.display = 'block';
    getById('board').style.display = 'block';
    getById('player-name').style.pointerEvents = 'none';
    score = 0;
    streak = 0;
}

/**
 * Generate the gamefield where the game will be played on.
 */
function generateGameField() {
    mode = getGameForm()["game-mode"].value;
    cardsAmount = Number.parseInt(getGameForm()["board-size"].value);
    scoreText = getById('score');
    scoreText.innerText = '0';
    document.getElementsByClassName('details')[0].style.display = 'none';
    getById('game-stats-popup').style.display = 'none';
    setTimer(STOP_TIMER);
    clearBoard();

    // Calculate the amount of rows in the board table.
    const rowsCount = cardsAmount % 4 === 0 ? 4 : cardsAmount / 13;
    for (let i = 0; i < rowsCount; i++) {
        const tr = createElement('tr');
        getCardBoard().appendChild(tr);
    }
    const cards = mode === 'same-value' ? cardsForRegularBoard(cardsAmount) : cardsForHarderBoard(cardsAmount);
    addCardsToBoard(cards);
}

/**
 * Finish current game.
 * Add current score to table.
 */
function finishGame() {
    clearBoard();
    score += timePassed > score ? timePassed % score : score % timePassed;
    scoreText.innerText = `${score}`;
    showStats();
    updateScoreTable();
    saveGameData();
    setTimer(STOP_TIMER);
    document.getElementsByClassName('details')[0].style.display = 'none';
    getById('player-name').style.pointerEvents = 'all';
}

/**
 * Update the scores, put new score into the table.
 */
function updateScoreTable() {
    const rows = getById('stats').rows;
    const timeTaken = getById('timer').innerText;
    let tr, newTdIndex, tdPlayerName, tdMode, tdScore, tdTime;
    let isFreeSpace = false;

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row.className.includes('logged')) {
            tr = row;
            [tdPlayerName, tdMode, tdScore, tdTime] = [...row.children].slice(1);
            isFreeSpace = true;
            break;
        }
    }

    if (isFreeSpace) {
        addStatsToTable(tr, tdPlayerName, tdMode, tdScore, tdTime, timeTaken);
    } else {
        [tr, newTdIndex, tdPlayerName, tdMode, tdScore, tdTime] = [...createTableCells()];
        newTdIndex.innerText = Number.parseInt(rows[rows.length - 1].children[0].innerText) + 1;
        addStatsToTable(tr, tdPlayerName, tdMode, tdScore, tdTime, timeTaken);
        getById('stats').tBodies[0].appendChild(tr);
    }
}

/**
 * Create new table cells in order to insert new scores into table.
 *
 * @returns {HTMLElement[]} Return created table cells.
 */
function createTableCells() {
    const tr = createElement('tr');
    const newTdIndex = createElement('td');
    const newTdPlayerName = createElement('td');
    const newTdMode = createElement('td');
    const newTdScore = createElement('td');
    const newTdTime = createElement('td');
    tr.appendChild(newTdIndex);
    tr.appendChild(newTdPlayerName);
    tr.appendChild(newTdMode);
    tr.appendChild(newTdScore);
    tr.appendChild(newTdTime);
    return [tr, newTdIndex, newTdPlayerName, newTdMode, newTdScore, newTdTime];
}

/**
 * Add the data to the table row.
 *
 * @param {HTMLElement} row Is the row where the data should be put.
 * @param {HTMLElement} tdPlayerName Is the name of the player.
 * @param {HTMLElement} tdMode Is the table data cell to put game mode into.
 * @param {HTMLElement} tdScore Is the table data cel to put player score into.
 * @param {HTMLElement} tdTime Is the table data cell to put time into.
 * @param {string} timeTaken Is actual time taken to finish the game.
 */
function addStatsToTable(row, tdPlayerName, tdMode, tdScore, tdTime, timeTaken) {
    const gameMode = `${mode[0].toUpperCase()}${mode.replace(/-/g, ' ').substr(1)}`;
    tdPlayerName.innerText = playerName;
    tdMode.innerText = `${gameMode} | ${cardsAmount}`;
    tdScore.innerText = score;
    tdTime.innerText = timeTaken;
    row.className = 'logged';
}

/**
 * Sort the table by some criteria.
 *
 * Make GET request to the server with the specified criteria.
 * The sorting will take place on the server and sorted data will be returned
 * back.
 *
 * @param criteria Is the criteria by which sorting should be done.
 */
function sortTable(criteria) {
    const nameFilterValue = getById('filter-bar').value;
    let url;
    if (order === 'asc') {
        order = 'desc';
    } else {
        order = 'asc'
    }
    if (nameFilterValue) {
        url = `${server}?action=sort&criteria=${criteria}&order=${order}&name=${nameFilterValue}`;
    } else {
        url = `${server}?action=sort&criteria=${criteria}&order=${order}`
    }
    fetch(url, {
        headers: {
        'Accept': 'application/json'
        },
        mode: "no-cors"
    })
        .then(r => r.json())
        .then(data => insertNewDataIntoTable(data));
}

/**
 * Filter scores by player name.
 * Player name is typed into the <input> field and
 * the scores are filtered by this input.
 */
function filterByPlayer() {
    const nameFilterValue = getById('filter-bar').value;
    if (nameFilterValue) {
        fetch(`${server}?action=filter&name=${nameFilterValue}`, {
            headers: {
                'Accept': 'application/json'
            },
            mode: "no-cors"
        })
            .then(response => response.json())
            .then(data => insertNewDataIntoTable(data));
    } else {
        loadGameData();
    }
}

/**
 * Fetch the scores saved to the server and update the table.
 *
 * @returns {Promise<void>}
 */
function loadGameData() {
    fetch(server, {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        mode: 'no-cors'
    })
        .then(response => response.json())
        .then(data => insertNewDataIntoTable(data));
}

/**
 * Insert new data obtained from the server into the table.
 *
 * @param data New data with scores etc.
 */
function insertNewDataIntoTable(data) {
    const rows = getById('stats').rows;
    for (let i = 1; i < rows.length; i++) {
        for (let j = 1; j < rows[i].children.length; j++) {
            rows[i].children[j].innerText = '-';
        }
        rows[i].className = '';
    }
    for (const d of data.scores) {
        playerName = d.name;
        mode = d.mode;
        cardsAmount = d.cards;
        score = d.score;
        getById('timer').innerText = d.time;
        updateScoreTable();
    }
}

/**
 * Send data over to the server in order to save it.
 */
function saveGameData() {
    const Data = {
        name: playerName,
        mode: mode,
        cards: cardsAmount,
        time: getById('timer').innerText,
        score: score
    };
    fetch(server, {
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(Data),
        method: 'POST',
        mode: 'no-cors'
    });
}

/**
 * Clear the field if the player doesn't want to play anymore.
 */
function clearGameField() {
    getCardBoard().style.display = 'none';
    clearBoard();
    setTimer(STOP_TIMER);
    scoreText.innerText = '0';
    document.getElementsByClassName('details')[0].style.display = 'none';
    getById('game-stats-popup').style.display = 'none';
    getById('player-name').style.pointerEvents = 'all';
}

/**
 * Show statistics about current game.
 */
function showStats() {
    const statsPopup = getById('game-stats-popup');
    const scoreCurrent = getById('game-stats-score');
    const timeCurrent = getById('game-stats-time');
    getById('game-stats-popup').style.display = 'none';
    scoreCurrent.innerText = score;
    timeCurrent.innerText = getById('timer').innerText;
    statsPopup.style.display = 'block'
}

/**
 * Start or stop a timer.
 * 
 * Timer is used to count the duration of current game.
 * 
 * @param {string} action Defines whether to start or stop the timer.
 */
function setTimer(action) {
    const timerText = getById('timer');
    if (action === 'stop') {
        clearInterval(timer);
        timerText.innerText = '00:00:00';
        timePassed = 1;
    } else if (action === 'start') {
        timePassed = 1;
        timer = setInterval(() => {
            const seconds = timePassed % 60;
            const minutes = Math.floor(timePassed / 60);
            const hours = Math.floor(timePassed / 3600);
            const formatTime = (time) => time < 10 ? `0${time}` : `${time}`;
            timerText.innerText = `${formatTime(hours)}:${formatTime(minutes)}:${formatTime(seconds)}`;
            timePassed++;
        }, 1000);
    }
}


/**
 * Generate cards for regular board.
 * 
 * Regular board means a pair of cards has only the same value.
 * 
 * @param {number} numOfCards Number of cards to generate.
 */
function cardsForRegularBoard(numOfCards) {
    const cards = [];
    const values = shuffle(CARDS['values'], numOfCards / 2);
    for (const value of values) {
        const suits = shuffle(CARDS['suits'], 2);
        for (const suit of suits) {
            const card = getCard(value.toString(), suit.toString());
            cards.push(card);
        }
    }
    return cards;
}

/**
 * Generate cards for harder board.
 * 
 * Harder board means a pair of cards has both same suit and value.
 * 
 * @param {number} numOfCards Number of cards to generate.
 */
function cardsForHarderBoard(numOfCards) {
    const cards = [];
    if (numOfCards === 52) {
        for (const value of CARDS['values']) {
            for (const suit of CARDS['suits']) {
                const card = getCard(value, suit);
                cards.push(card);
            }
        }
    } else {
        // Add some noise to getting random cards.
        const randomNum = getRandomInt(0, numOfCards === 6 ? 0 : 7);

        // Number of values needed with the noise.
        const numOfValues = (numOfCards - (randomNum % 2 === 0 ? randomNum : randomNum + 1)) / 2;
        const values = shuffle(CARDS['values'], numOfValues);

        // Difference between full stack cards (13 max) and cards with noise.
        const diff = (numOfCards / 2) - numOfValues;

        // Number of cards which will occur twice with both black and red suits.
        const repeatingCards = shuffle(values, diff);
        for (const value of values) {
            let suits;
            if (repeatingCards.includes(value)) {
                suits = CARDS['suits'];
            } else {
                suits = getRandomInt(1, 4) % 2 === 0 ? ['clubs', 'spades'] : ['hearts', 'diamonds'];
            }
            suits = shuffle(suits);
            for (const suit of suits) {
                const card = getCard(value.toString(), suit);
                cards.push(card);
            }
        }
    }
    return cards;
}

/**
 * Add cards to the board.
 * 
 * @param {HTMLElement} board Game board where to add cards.
 * @param {string[]} cards Cards to add.
 */
function addCardsToBoard(cards) {
    cards = shuffle(cards);
    const cardsPerRow = cards.length / getCardBoard().rows.length;
    for (const row of getCardBoard().rows) {
        for (let i = 0; i < cardsPerRow; i++) {
            row.appendChild(cards.pop());
        }
    }
}

/**
 * Create a new card with specified suit and value.
 * 
 * Card must be a HTML <td></td> element with another
 * HTML <img> element.
 * Ny default the card itself is not shown to the player,
 * so the image should be neutral.
 * 
 * @param {string} value Card value.
 * @param {string} suit Card suit.
 * @returns {HTMLElement}
 */
function getCard(value, suit) {
    const td = createElement('td');
    const div1 = createElement('div');
    const div2 = createElement('div');
    const cardBack = createElement('img');
    const cardFront = createElement('img');
    td.id = `${value}-${suit}`;
    td.className = 'card';
    div1.className = 'card-face card-back';
    div2.className = 'card-face card-front';
    div1.onclick = handleCardSelection;
    div2.onclick = handleCardSelection;
    cardBack.src = REVERSE_SIDE_PATH;
    cardBack.alt = `Playing card: ${value} of ${suit}`
    cardFront.src = `${PATH_PREFIX}${value}_of_${suit}.png`;
    cardFront.alt = `Playing card: ${value} of ${suit}`;
    div1.appendChild(cardFront);
    div2.appendChild(cardBack);
    td.appendChild(div1);
    td.appendChild(div2);
    return td;
}

/**
 * Handle the event when the player clicks some card.
 * 
 * If there are less than 2 cards with face turned to the player, show the clicked card.
 * Otherwise decide, whether the two showing cards make up a pair.
 * If so, remove the cards from the board.
 * If not, hide the cards (turn the reverse sides to the player).
 * 
 * @param {HTMLImageElement} element Caller element that has been clicked by the player.
 */
function handleCardSelection(element) {
    const showingCards = document.getElementsByClassName('showing');
    if (showingCards.length < 2) {
        let card = element.target || element.srcElement;
        if (card.nodeType === 3) card = card.parentNode;
        showCard(card);
        if (showingCards.length === 2) {
            const card1 = showingCards[0], card2 = showingCards[1];
            const match = isMatch(card1, card2);
            if (match) {
                streak++;
                setTimeout(() => {
                    removeCards([...showingCards]);
                }, 1000);
            } else {
                streak = 0;
                setTimeout(() => {
                    hideCards([...showingCards]);
                }, 1000);
            }
        }
    }
}

/**
 * Show the card to the player when clicked.
 * 
 * @param {HTMLImageElement} card Card to be shown.
 */
function showCard(card) {
    card.parentElement.parentElement.className = 'card showing';
}

/**
 * Remove cards that made up a pair (there was a match).
 * 
 * @param {HTMLImageElement[]} cards Cards to remove.
 */
function removeCards(cards) {
    for (const card of cards) {
        card.style.visibility = 'hidden';
        card.className = 'card';
    }
    score += streak + getRandomInt(cardsAmount / 2, cardsAmount);
    scoreText.innerText = `${score}`;
    let boardEmpty = true;
    for (const card of document.getElementsByClassName('card')) {
        if (card.style.visibility !== 'hidden') {
            boardEmpty = false;
            break;
        }
    }
    if (boardEmpty) finishGame();
}

/**
 * Hide the cards if there was no match.
 * By hiding it is meant to show the reverse side of the card to the player.
 * 
 * @param {HTMLImageElement[]} cards Cards to hide.
 */
function hideCards(cards) {
    for (const card of cards) {
        card.className = 'card';
        card.src = REVERSE_SIDE_PATH;
    }
    score = score - 5 <= 0 ? 0 : score - 5;
    scoreText.innerText = score;
}

/**
 * Check whether two cards make up a pair.
 * 
 * @param {HTMLElement} card1 First card.
 * @param {HTMLElement} card2 Second card.
 * @returns {boolean} true if cards make up a pair, false otherwise.
 */
function isMatch(card1, card2) {
    const value1 = card1.id.split('-')[0], suit1 = card1.id.split('-')[1];
    const value2 = card2.id.split('-')[0], suit2 = card2.id.split('-')[1];
    if (mode === 'same-value') {
        return value1 === value2;
    } else if (mode === 'same-suit-and-value') {
        const black = ['clubs', 'spades'], white = ['hearts', 'diamonds'];
        return value1 === value2 &&
            (black.includes(suit1) && black.includes(suit2) || white.includes(suit1) && white.includes(suit2));
    }
    return false;
}

/**
 * Clear the board after the game.
 */
function clearBoard() {
    getById('board').innerHTML = '';
}

/**
 * Get an element by ID.
 * 
 * @param {string} id Id of the desired element.
 * @returns {HTMLElement} Element.
 */
function getById(id) {
    return document.getElementById(id);
}

/**
 * Create a new HTML element.
 * 
 * @param {string} element Name of the element.
 * @returns {HTMLElement} Created element.
 */
function createElement(element) {
    return document.createElement(element);
}

/**
 * Shuffle the collection.
 * 
 * Shuffling means switching places of some elements in the collection.
 * 
 * @param {string[]} collection Collection with values to shuffle.
 * @param {number} maxItems Maximum number of items in shuffled array.
 * @returns {string[]} A shuffled array.
 */
function shuffle(collection, maxItems = collection.length) {
    const shuffled = [];
    const copy = [...collection];
    let i = getRandomInt(0, copy.length - 1);
    while (shuffled.length < maxItems && copy.length > 0) {
        shuffled.push(copy[i]);
        copy.splice(i, 1);
        i = getRandomInt(0, copy.length - 1);
    }
    return shuffled;
}

/**
 * Return random integer between min and max.
 * 
 * @param {number} min Minimum value (included).
 * @param {number} max Maximum value (included).
 * @returns {number}
 */
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get game form where the player can choose game presets.
 */
function getGameForm() {
    return document.forms['presets'];
}

/**
 * Get the board where cards are shown.
 * @returns {HTMLElement}
 */
function getCardBoard() {
    return getById('board');
}