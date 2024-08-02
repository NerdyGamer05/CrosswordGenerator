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