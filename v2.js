(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
class TrieNode {
    constructor() {
        this.children = {}; // dictionary of TrieNode objects
        this.endOfWord = false; // boolean for representing whether or not the current node represents the end of a word
        this.clues = null; // an array of clues (only applicable if the current node represents the end of a word)
        this.wordLengths = new Set(); // set of the word lengths that can be obtained by going down the current path
    }
    toString() {
        return JSON.stringify(this.children);
    }
}

class Trie {
    constructor() {
        this.root = new TrieNode();
        this.size = 0;
    }
    insert(word, clues) {
        let node = this.root;
        for (let i = 0; i < word.length; i++) {
            const curr = word[i];
            if (node.children[curr] === undefined) {
                node.children[curr] = new TrieNode();
            }
            node.wordLengths.add(word.length);
            node = node.children[curr];
        }
        if (!node.endOfWord) {
            this.size++;
            node.clues = clues;
            node.endOfWord = true;
            return node.clues.length === 1 ? 1 : 0;
        }
        return 0;
    }
    search(word, prefixMode = false) {
        let node = this.root;
        for (let i = 0; i < word.length; i++) {
            const curr = word[i];
            if (node.children[curr] === undefined) {
                return false;
            }
            node = node.children[curr];
        }
        // If we are using prefix mode, then this will be true since the function did not exit in the loop
        // Or else, we need to check to make sure that the current string of letters is not 
        return prefixMode || node.endOfWord;
    }
    async load(source) {
        this.root = new TrieNode();
        this.map = {};
        const dict = await (await fetch(source)).json();
        let singleClues = 0;
        let totalWords = 0;
        for (const word of Object.keys(dict)) {
            // Skip words that are too large for our puzzle size
            if (word.length > 15) {
                continue;
            }
            singleClues += this.insert(word, dict[word]);
            this.map[word.length] = (this.map[word.length] || 0) + 1;
            totalWords++;
        }
        this.words = totalWords;
    }
    getRandom(length, rules, used = new Set()) {
        if (length < 3) {
            throw new Error('The length must be greater than or equal to 3');
        }
        // Try to generate a word that it not a duplicate
        for (let i = 0; i < 10; i++) {
            const res = this.#helper(length, rules, 0);
            if (res[0] !== null && !used.has(res[0])) {
                return res;
            }
        }
        return [null, null];
    }
    #helper(length, rules, iterations) {
        if (iterations >= 1000) {
            return [null,null];
        }
        const res = new Array(length);
        let node = this.root;
        let marker = 0;
        while (marker < length - 1) {
            const keys = Object.keys(node.children).filter(key => node.children[key].wordLengths.has(length));
            // Try again if there are no letters to choose from OR if the letter defined by the rules in not a child for the current trie node
            if (keys.length === 0 || (rules[marker] !== null && node.children[rules[marker]] === undefined)) {
                return this.#helper(length, rules, iterations + 1);
            }
            res[marker] = rules[marker] ?? keys[Math.floor(Math.random() * keys.length)];
            node = node.children[res[marker]];
            marker++;
        }
        // If the last character is preset, try again if the letter is not a child for the current node OR if the letter is a child and if it is not the end of a word
        if (rules[marker] !== null && !node.children[rules[marker]]?.endOfWord) {
            return this.#helper(length, rules, iterations + 1);
        }
        if (rules[marker] !== null && node.children[rules[marker]]?.endOfWord) {
            res[marker] = rules[marker];
            return [
                res.join(''), // word
                node.children[res[marker]].clues // clues
            ];
        }
        // For the last character, you need to find a letter that is the ending of a word
        const finalLetter = [];
        for (const key of Object.keys(node.children)) {
            const curr = node.children[key];
            if (curr.endOfWord) {
                finalLetter.push(key);
            }
        }
        if (finalLetter.length === 0) {
            return this.#helper(length, rules, iterations + 1);
        }
        res[marker] = finalLetter[Math.floor(Math.random() * finalLetter.length)];
        return [
            res.join(''), // word
            node.children[res[marker]].clues // clues
        ];
    }
}

module.exports = Trie;
},{}],2:[function(require,module,exports){
const Trie = require('./Trie');
const dictTrie = new Trie();
const puzzleSize = 5;
const gridSpaces = [];
const darks = new Set();
const usedWords = new Set(); // words that have been used already (to prevent duplicates)
const words = {}; // map puzzle number to word config (length, id, work after it is randomly selected)
const letters = {}; // map id to expected letterg
const puzzleNums = {}; // map id to puzzle numbers
const completedWords = new Set(); // numbers (labels for the starter word cells)
const rowDarks = Array.from({ length: puzzleSize }, () => new Array());
const colDarks = Array.from({ length: puzzleSize }, () => new Array());
let solutionMode = false;
let userSolution = {};

const container = document.querySelector('.container');
const overlay = document.querySelector('.overlay');
const puzzle = document.getElementById('puzzle');
const generateBtn = document.getElementById('generate-v2');
const checkBtn = document.getElementById('check');
const solutionBtn = document.getElementById('solution');
const resetBtn = document.getElementById('reset');
const across = document.getElementById('across');
const down = document.getElementById('down');

// Function for creating a new cell
const createCell = function(x, y, isActive) {
    const container = document.createElement('div');
    const input = document.createElement('input');
    container.classList.add('cell-container');
    input.classList.add('cell');
    input.id = `${x},${y}`;
    if (isActive) {
        input.classList.add('active');
        input.type = 'text';
        input.pattern = '[A-Za-z]{1}';
        input.minLength = 1;
        input.maxLength = 1;
        input.autocomplete = false;
        input.autocapitalize = false;
        input.spellcheck = false;
    }
    input.disabled = !isActive;
    container.appendChild(input);
    puzzle.appendChild(container);
}

const isSpaceOpen = function(x,y) {
    if (x < 0 || y < 0 || x >= puzzleSize || y >= puzzleSize) {
        return false;
    }
    return !darks.has(`${x},${y}`);
}

// Check if a cell is valid dark cell (the cell's neighbors can contribute to a horizontal and vertical word)
const validDarkCell = function(x_in,y_in) {
    const moves = [[-1,0],[1,0],[0,-1],[0,1]];
    for (const move of moves) {
        // Use flag to check if an open space has been seen
        let flag = false;
        // Check left and right
        for (let i = 1; i <= 3; i++) {
            const x = x_in + i * move[0];
            const y = y_in + i * move[1];
            if (flag && !isSpaceOpen(x,y)) {
                return false;
            }
            if (!flag && x >= 0 && y >= 0 && x < puzzleSize && y < puzzleSize) {
                // Check if an open space was found
                if (!darks.has(`${x},${y}`)) {
                    flag = true;
                } else {
                    // Space is dark (since the flag is down, we can skip this move)
                    continue;
                }
            }
        }
    }
    return true;
}

// Generate "puzzleSize" darks for the top half (will be reflected in the bottom half)
const generateDarks = function() {
    darks.clear();
    let count = 0;
    while (count < puzzleSize) {
        const x_rand = Math.floor(Math.random() * puzzleSize);
        // TODO Change this back to (puzzleSize - 3) / 2) and consider making a special case for the middle row and its two neighbor rows (3 middle rows)
        const y_rand = Math.floor(Math.random() * ((puzzleSize - 3) / 2));
        // before adding, check to see if a word of at least length 3 can be placed there vertically and horizontally for all 4 adjacent cells (up,down,left,right)
        if (validDarkCell(x_rand, y_rand)) {
            darks.add(`${x_rand},${y_rand}`);
            darks.add(`${puzzleSize-1-x_rand},${puzzleSize-1-y_rand}`);
            count++;
        }
    }   
}

// If the cell is active, then it has a input; if the cell is inactive, then it is a dark
const isActive = function(x,y) {
    return !darks.has(`${x},${y}`);
}

// Function for checking if the function
const isPuzzleOpen = function() {
    const visited = new Set(); // x,y
    const darkCells = puzzle.querySelectorAll('div input:not(.active)');
    for (const cell of darkCells) {
        visited.add(cell.id);
    }
    const startingCell = puzzle.querySelector('div input.active');
    const queue = [startingCell.id.split(',').map(Number)]; // consists of size-2 arrays: [x,y]
    const moves = [[-1,0],[1,0],[0,-1],[0,1]];
    let cells = puzzle.childElementCount - darkCells.length;
    while (queue.length > 0) {
        const len = queue.length;
        for (let i = 0; i < len; i++) {
            const curr = queue[i].map(Number);
            for (const move of moves) {
                const x = curr[0] + move[0];
                const y = curr[1] + move[1];
                const s = `${x},${y}`;
                // Skip this cell if it has been visited already
                if (x < 0 || y < 0 || x >= puzzleSize || y >= puzzleSize || visited.has(s)) {
                    continue;
                }
                queue.push([x,y]);
                visited.add(s);
                cells--;
            }
        }
        for (let i = 0; i < len; i++) {
            queue.shift();
        }
    }
    return cells === 0;
}

// Finds the next dark starting from the left/top and moving towards to the right/bottom
// If there isn't a "next dark", then null is returned
const findNextDark = function(x, y, horizontalMode) {
    // Binary search on arr
    const arr = horizontalMode ? rowDarks[y] : colDarks[x];
    if (arr.length === 0) {
        return null;
    }
    const curr = horizontalMode ? x : y;
    let left = 0, right = arr.length;
    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        if (arr[mid] > curr && (mid === 0 || arr[mid-1] < curr)) {
            return arr[mid];
        }
        if (arr[mid] < curr) {
            left = mid + 1;
        } else {
            right = mid - 1;
        }
    }
    return null;
}

const getPresetLetters = function(x, y, length, horizontalMode) {
    const res = new Array(length);
    for (let i = 0; i < length; i++) {
        const currX = x + (horizontalMode ? i : 0);
        const currY = y + (horizontalMode ? 0 : i);
        // Save the current letter slot if it has already been set, or else save as null 
        res[i] = document.getElementById(`${currX},${currY}`).value.trim() || null;
    }
    return res;
}

// Sets letters while also checking for all word starting positions in the current word's path
const setLetters = function(x, y, word, horizontalMode) {
    const arr = [];
    const number = puzzleNums[`${x},${y}`];
    for (let i = 0; i < word.length; i++) {
        const currX = x + (horizontalMode ? i : 0);
        const currY = y + (horizontalMode ? 0 : i);
        const s = `${currX},${currY}`;
        // Update the current cell in the puzzle grid
        const elm = document.getElementById(s)
        elm.value = word[i];
        elm.dataset[horizontalMode ? 'horizontal' : 'vertical'] = number;
        if (puzzleNums[s]) {
            arr.push(s);
        }
    }
    return arr;
}

// Function for removing the word that is intersecting with the current word that is being placed (this process is used for backtracking)
// TODO for all calls to this function, make sure that you add the removed word back to the queue (so that it can be reproduced)
const backtrackRemoval = function(x, y, horizontalMode, queue) {
    const elm = document.getElementById(`${x},${y}`);
    // Get the inverted orientation state as the intersecting word
    const state = horizontalMode ? 'vertical' : 'horizontal';
    const reverseState = horizontalMode ? 'horizontal' : 'vertical';
    const number = elm.dataset[state];
    const word = words[number][state];
    // Remove word from the set of words that are currently in the puzzle (duplicate preventation)
    usedWords.delete(word);
    // Remove word from the completed words set and add back to the queue so that it can re-processed
    word.word = null;
    word.clues = null;
    const coords = word.id.split(',').map(Number);
    for (let i = 0; i < word.length; i++) {
        const currX = coords[0] + (horizontalMode ? 0 : i);
        const currY = coords[1] + (horizontalMode ? i : 0);
        const curr = document.getElementById(`${currX},${currY}`);
        const tmp = `${curr.dataset[reverseState]}-${reverseState[0]}`;
        if (completedWords.has(tmp)) {
            completedWords.delete(tmp);
            queue.push([words[curr.dataset[reverseState]].id, reverseState[0]]); 
        }
        curr.value = '';
    }
    completedWords.delete(`${number}-${state[0]}`);
    queue.push([word.id, state[0]]);
}

// Loop through all of the puzzle numbers, and favor the shorter words over the longer words (if the length is the same, then favor horizontal over vertical)
// Might also have to try longer words first (favor horizontal over vertical) because although there are more long words, there are also more total combinations that may be invalid
const constructQueue = function() {
    const queue = []; // format: [id, length, 'v'/'h'] {will be mapped to the id and orientation}
    const values = Object.values(words);
    for (const data of values) {
        if (data.vertical) {
            queue.push([data.id, data.vertical.length, 'v']);
        }
        if (data.horizontal) {
            queue.push([data.id, data.horizontal.length, 'h']);
        }
    }
    return queue.sort((a,b) => {
        // If the lengths are equal, then favor horizontal (if the orientations are the same, then it doesn't matter)
        if (a[1] === b[1]) {
            return a[2].charCodeAt(0) - b[2].charCodeAt(0);
        }
        // Or else favor the longer word
        return b[1] - a[1];
    }).map(elm => [elm[0],elm[2]]);
}

const getNonEmptySubsets = function(arr) {
    // Size of the array will always be 2^n - 1, where n is the size of array
    const res = new Array(Math.pow(2, arr.length) - 1);
    res[0] = [arr[0]];
    let marker = 0;
    for (let i = 0; i < arr.length; i++) {
        for (let j = 0; j < i; j++) {
            res[marker+j] = res[j].concat([arr[i]]);
        }
        marker += i;
    }
    res[marker] = arr;
    // Sort array in ascending order of nested array length
    res.sort((a,b) => a.length - b.length);
    return res;
}

const setStyling = function(elm) {
    resetStyling();
    // Set highlighting on the crossword puzzle grid 
    // Update background for the cells that contribute to the current vertical and horizontal words
    const vertical = words[elm.dataset.vertical].vertical;
    const verticalCoords = vertical.id.split(',').map(Number);
    const horizontal = words[elm.dataset.horizontal].horizontal;
    const horizontalCoords = horizontal.id.split(',').map(Number);
    // Set styling for vertically oriented word
    for (let i = 0; i < vertical.length; i++) {
        const x = verticalCoords[0];
        const y = verticalCoords[1] + i;
        const curr = document.getElementById(`${x},${y}`);
        curr.style.backgroundColor = '#dee8f2';
    }
    // Set styling for horizontally oriented word
    for (let i = 0; i < horizontal.length; i++) {
        const x = horizontalCoords[0] + i;
        const y = horizontalCoords[1];
        const curr = document.getElementById(`${x},${y}`);
        curr.style.backgroundColor = '#dee8f2';
    }
    // Reset the background of the current element (it uses special styling)
    elm.style.backgroundColor = '';
    // Set the highlighting for the active vertical and horizontal word
    const verticalClue = document.getElementById(elm.dataset.vertical+'-v');
    const horizontalClue = document.getElementById(elm.dataset.horizontal+'-h');
    console.log()
    if (verticalClue !== undefined) {
        verticalClue.classList.add('highlight');
    }
    if (horizontalClue !== undefined) {
        horizontalClue.classList.add('highlight');
    }
}

const resetStyling = function() {
    // Reset the highlighting on the grid spaces
    for (const space of gridSpaces) {
        space.style.backgroundColor = '';
        space.style.color = '';
    }
    for (const clue of document.querySelectorAll('.words.highlight')) {
        clue.classList.remove('highlight');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await dictTrie.load('https://crossword-words.s3.us-east-2.amazonaws.com/words.json');
});

checkBtn.addEventListener('click', () => {
    if (!puzzle.classList.contains('special')) {
        return;
    }
    if (solutionMode) {
        return;
    }
    resetStyling();
    let isWinner = true;
    for (const space of gridSpaces) {
        space.style.color = letters[space.id].toLowerCase() === space.value.toLowerCase() ? 'green' : 'red';
        if (letters[space.id].toLowerCase() !== space.value.toLowerCase()) {
            isWinner = false;
        }
    }
    console.log('v2 isWinner', isWinner);
    if (isWinner) {
        const firework = document.createElement('div');
        firework.classList.add('firework');
        for (let i = 0; i < 10; i++) {
            overlay.appendChild(firework); 
        }
        container.style.display = 'none';
        overlay.style.display = 'block';
        overlay.classList.add('fade-in');
        setTimeout(() => {
            overlay.classList.remove('fade-in');
            overlay.classList.add('fade-out');
            container.style.display = 'block';
            overlay.replaceChildren();
            setTimeout(() => {
                overlay.classList.remove('fade-out');
                overlay.style.display = 'none';
            }, 650);
        }, 5000);
    }
});

resetBtn.addEventListener('click', () => {
    if (!puzzle.classList.contains('special')) {
        return;
    }
    resetStyling();
    for (const space of gridSpaces) {
        space.value = '';
    }
});

solutionBtn.addEventListener('click', () => {
    if (!puzzle.classList.contains('special')) {
        return;
    }
    solutionMode = !solutionMode;
    solutionBtn.textContent = solutionMode ? 'Hide Solution!' : 'Reveal Solution!';
    if (!solutionMode) {
        for (const space of gridSpaces) {
            space.style.color = 'black';
            space.disabled = false;
            space.value = userSolution[space.id] ?? '';
        }
        return;
    } 
    resetStyling();
    for (const space of gridSpaces) {
        if (space.value !== '') {
            userSolution[space.id] = space.value;
        }
        space.style.color = 'blue';
        space.disabled = true;
        space.value = letters[space.id];
    }
});

generateBtn.addEventListener('click', async () => {
    console.log('generating v2 puzzle');
    console.time('full-load-time');
    document.getElementById('generate').disabled = true;
    if (puzzle.classList.contains('puzzle-border')) puzzle.classList.remove('puzzle-border');
    puzzle.style.gridTemplateRows = `repeat(${puzzleSize}, 1.75em)`;
    puzzle.style.gridTemplateColumns = `repeat(${puzzleSize}, 1.75em)`;
    if (puzzle.classList.contains('puzzle-border')) puzzle.classList.remove('puzzle-border');
    checkBtn.style.display = 'none';
    solutionBtn.style.display = 'none';
    resetBtn.style.display = 'none';
    puzzle.style.display = 'none';
    generateBtn.parentElement.parentElement.style.width = 'auto';
    puzzle.classList.add('special');
    puzzle.replaceChildren();
    across.replaceChildren();
    down.replaceChildren();
    // Sleep for 2 seconds
    await new Promise(r => setTimeout(r, 2000));
    do {
        generateDarks();
        // x changes moving left/right (columns)
        // y changes moving up/down (rows)
        for (let y = 0; y < puzzleSize; y++) {
            for (let x = 0; x < puzzleSize; x++) {
                const activeFlag = isActive(x,y);
                if (!activeFlag) {
                    rowDarks[y].push(x);
                    colDarks[x].push(y);
                }
                createCell(x, y, activeFlag);
            }
        }
    } while (!isPuzzleOpen());
    // Manage the special case for when a word is being split (array format: [x, y, length] )
    let rowFlag = null;
    // colFlag should be an array to arrays since another flag may go up due to the row-major iteration before the initial flag goes down
    let colFlag = null;
    let number = 1;
    let totalWords = 0;
    for (let y = 0; y < puzzleSize; y++) {
        for (let x = 0; x < puzzleSize; x++) {
            const s = `${x},${y}`;
            if (darks.has(s)) {
                continue;
            }
            const horizontalFlag = !isSpaceOpen(x-1,y);
            const verticalFlag = !isSpaceOpen(x,y-1);
            const specialRowFlag = rowFlag !== null && rowFlag[0] === x && rowFlag[1] === y;
            // specialColFlag will return an index for the colFlag array or -1
            const specialColFlag = colFlag === null ? -1 : colFlag.findIndex(elm => elm !== null && elm[0] === x && elm[1] === y);
            if (horizontalFlag || verticalFlag || specialRowFlag || specialColFlag !== -1) {
                const cellLabel = document.createElement('span');
                cellLabel.classList.add('puzzle-label');
                cellLabel.textContent = number;
                document.getElementById(s).parentElement.appendChild(cellLabel);
                words[number] = {};
                // Check for split word cases
                if (specialRowFlag) {
                    words[number].id = s;
                    words[number].horizontal = {
                        length: rowFlag[2],
                        id: s
                    };
                    rowFlag = null;
                    totalWords++;
                }
                if (specialColFlag !== -1) {
                    words[number].id = s;
                    words[number].vertical = {
                        length: colFlag[specialColFlag][2],
                        id: s
                    }
                    // Instead of removing the current flag, just set it to null (implement removal later if this is too slow)
                    colFlag[specialColFlag] = null;
                    totalWords++;
                }
                // Check for the standard starting word placement
                if (horizontalFlag) {
                    const nextDark = findNextDark(x,y,true) ?? puzzleSize;
                    const splitFlag = nextDark - x >= 8 && Math.random() < 0.7; // 70% chance to split the current word (if the word length is at least 8)
                    const wordLength = !splitFlag ? nextDark - x : (3 + Math.floor(Math.random() * (nextDark - x - 5)));
                    words[number].id = s;
                    words[number].horizontal = {
                        length: wordLength,
                        id: s
                    };
                    if (splitFlag) {
                        rowFlag = [x + wordLength, y, nextDark - x - wordLength];
                    }
                    totalWords++;
                }
                if (verticalFlag) {
                    const nextDark = findNextDark(x,y,false) ?? puzzleSize;
                    const splitFlag = nextDark - y >= 8 && Math.random() < 0.7; // 70% chance to split the current word (if the word length is at least 8)
                    const wordLength = !splitFlag ? nextDark - y : (3 + Math.floor(Math.random() * (nextDark - y - 5)));
                    words[number].id = s;
                    words[number].vertical = {
                        length: wordLength,
                        id: s
                    };
                    if (splitFlag) {
                        if (colFlag === null) {
                            colFlag = [];
                        }
                        colFlag.push([x, y + wordLength, nextDark - y - wordLength]);
                    }
                    totalWords++;
                }
                puzzleNums[s] = number;
                number++;
            }
        }
    }
    window.words = words;
    window.puzzleNums = puzzleNums;
    window.usedWords = usedWords;
    const queue = constructQueue(); // element format: ["x,y", 'v'/'h']
    completedWords.clear()
    while (completedWords.size < totalWords) {
        // this is an id in the following format: x,y
        const [top, orientation] = queue.shift();
        const s = `${puzzleNums[top]}-${orientation}`;
        if (completedWords.has(s)) {
            continue;
        }
        completedWords.add(s);
        const curr = words[puzzleNums[top]];
        if (orientation === 'v') {
            const coords = curr.id.split(',').map(Number);
            const letters = getPresetLetters(...coords, curr.vertical.length, false); // array of already placed / intersecting letters in the current word
            const [word, clues] = dictTrie.getRandom(curr.vertical.length, letters);
            // Backtracking is necessary
            if (word === null) {
                const indices = [];
                const map = {}; // index to letter
                for (let i = 0; i < letters.length; i++) {
                    if (letters[i] === null) {
                        continue;
                    }
                    indices.push(i);
                    map[i] = letters[i];
                }
                const subsets = getNonEmptySubsets(indices);
                // If the word generation fails with the set rules, then loop through all subsets of intersecting words and try removing all of the letters in each subarray until one subarray removal produces a valid random word placement
                for (const subset of subsets) {
                    // [1,2,3] => [[1],[2],[3],[1,2],[1,3],[2,3],[1,2,3]]
                    // Remove all of the letters in the current subarray
                    for (const index of subset) {
                        letters[index] = null;
                    }
                    // Attempt to generate a random word after applying the changes from the current subarray
                    const [newWord, newClues] = dictTrie.getRandom(curr.vertical.length, letters);
                    // If a word was generated successfully, then break out of the loop (and perform the backtrack removal)
                    if (newWord !== null) {
                        for (const index of subset) {
                            backtrackRemoval(coords[0], coords[1] + index, false, queue);
                        }
                        curr.vertical.word = newWord;
                        curr.vertical.clues = newClues;
                        break;
                    }
                    // The word was not generated successfully, so revert the changes made to the intersecting letters array
                    for (const index of subset) {
                        letters[index] = map[index];
                    }
                }
            } else {
                curr.vertical.word = word;
                curr.vertical.clues = clues;
            }
            if (curr.vertical.word === null || curr.vertical.word === undefined) {
                throw new Error('Backtracking failed [vertical] ' + s);
            }
            usedWords.add(curr.vertical.word);
            setLetters(...coords, curr.vertical.word, false);
        } else if (orientation === 'h') {
            const coords = curr.id.split(',').map(Number);
            const letters = getPresetLetters(...coords, curr.horizontal.length, true);
            const [word, clues] = dictTrie.getRandom(curr.horizontal.length, letters);
            // Backtracking is necessary
            if (word === null) {
                const indices = [];
                const map = {}; // index to letter
                for (let i = 0; i < letters.length; i++) {
                    if (letters[i] === null) {
                        continue;
                    }
                    indices.push(i);
                    map[i] = letters[i];
                }
                const subsets = getNonEmptySubsets(indices);
                // If the word generation fails with the set rules, then loop through all subsets of intersecting words and try removing all of the letters in each subarray until one subarray removal produces a valid random word placement
                for (const subset of subsets) {
                    // Remove all of the letters in the current subarray
                    for (const index of subset) {
                        letters[index] = null;
                    }
                    // Attempt to generate a random word after applying the changes from the current subarray
                    const [newWord, newClues] = dictTrie.getRandom(curr.horizontal.length, letters, usedWords);
                    // If a word is generated successfully, then break out of the loop (and perform the backtrack removal)
                    if (newWord !== null) {
                        for (const index of subset) {
                            backtrackRemoval(coords[0] + index, coords[1], true, queue);
                        }
                        curr.horizontal.word = newWord;
                        curr.horizontal.clues = newClues;
                        break;
                    }
                    // The word was not generated successfully, so revert the changes made to the intersecting letters array
                    for (const index of subset) {
                        letters[index] = map[index];
                    }
                }

            } else {
                curr.horizontal.word = word;
                curr.horizontal.clues = clues;
            }
            if (curr.horizontal.word === null || curr.horizontal.word === undefined) {
                throw new Error('Backtracking failed [horizontal] ' + curr.id);
            }
            usedWords.add(curr.horizontal.word);
            setLetters(...coords, curr.horizontal.word, true);
        } else {
            throw new Error('something went terribly wrong lol');
        }
    }
    for (const space of document.querySelectorAll('input.cell.active')) {
        gridSpaces.push(space);
        space.addEventListener('focusin', () => setStyling(space));
        space.addEventListener('focusout', resetStyling);
        letters[space.id] = space.value;
        space.value = '';
    }
    const acrossTitle = document.createElement('span');
    const acrossBody = document.createElement('p');
    const downTitle = document.createElement('span');
    const downBody = document.createElement('p');
    acrossTitle.classList.add('fw-bolder', 'fs-2');
    acrossTitle.textContent = 'Across:';
    acrossBody.classList.add('fs-6');
    downTitle.classList.add('fw-bolder', 'fs-2');
    downTitle.textContent = 'Down:';
    downBody.classList.add('fs-6');
    across.appendChild(acrossTitle);
    across.appendChild(acrossBody);
    down.appendChild(downTitle);
    down.appendChild(downBody);
    console.log('totalWords', totalWords, 'number', number);
    for (let i = 1; i <= number-1; i++) {
        const curr = words[i];
        if (curr.vertical !== undefined) {
            const elm = document.createElement('span');
            const clues = curr.vertical.clues;  
            const selectedClue = clues[Math.floor(Math.random() * clues.length)];
            elm.id = i+'-v' // e.g. "5-v"
            elm.classList.add('words');
            elm.innerHTML = `<b>${i}.</b>&nbsp;${selectedClue}`;
            elm.appendChild(document.createElement('br'));
            down.appendChild(elm);
        }
        if (curr.horizontal !== undefined) {
            const elm = document.createElement('span');
            const clues = curr.horizontal.clues;
            const selectedClue = clues[Math.floor(Math.random() * clues.length)];
            elm.id = i+'-h'; // e.g. "3-h"
            elm.classList.add('words');
            elm.innerHTML = `<b>${i}.</b>&nbsp;${selectedClue}`;
            elm.appendChild(document.createElement('br'));
            across.appendChild(elm);
        }
    }
    checkBtn.parentElement.style.width = `${(puzzleSize+2.75) * 1.75}em`;
    checkBtn.style.display = 'inline';
    solutionBtn.style.display = 'inline';
    resetBtn.style.display = 'inline';
    puzzle.style.display = 'grid';
    document.getElementById('generate').disabled = false;
    if (!puzzle.classList.contains('puzzle-border')) puzzle.classList.add('puzzle-border');
    console.timeEnd('full-load-time');
});
},{"./Trie":1}]},{},[2]);
