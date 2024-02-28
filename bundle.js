(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
const generateWords = require('random-words');

const container = document.querySelector('.container');
const overlay = document.querySelector('.overlay');
const puzzle = document.getElementById('puzzle');
const generateBtn = document.getElementById('generate');
const checkBtn = document.getElementById('check');
const solutionBtn = document.getElementById('solution');
const resetBtn = document.getElementById('reset');
const across = document.getElementById('across');
const down = document.getElementById('down');

let positions = [];
let labelCoords = {};
let groups = [];
let gridSpaces = [];
let puzzleLabels = [];
let words = [];
let labelWords = {};
let wordAtCoords = {};
let letters = {};
let userSolution = {};
let solutionMode = false;

const min = {
  x: 0,
  y: 0
};

const getDefinitions = async function(word) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
    .then(response => response.json())
    .then(data => {
      const meanings = data?.[0]?.meanings;
      if (meanings === undefined) return -1;
      return data[0].meanings;
  });
  return res;
}

const findIntersections = function(words) {
  const intersections = {};
  const sets = words.map(elm => new Set(elm));
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      for (const c in words[i]) {
        if (sets[j].has(words[i][c])) {
          if (!(words[i] in intersections)) intersections[words[i]] = {};
          if (words[j] in intersections[words[i]]) intersections[words[i]][words[j]].push(`${c}-${words[j].indexOf(words[i][c])}`);
          else intersections[words[i]][words[j]] = [`${c}-${words[j].indexOf(words[i][c])}`];
        }
      }
    }
  }
  return intersections;
}

async function getPuzzleHints(words) {
  const definitions = {};
  const final = [];
  for await (const word of words) {
    let i = 0;
    const data = await getDefinitions(word);
    const defs = [];
    if (data === -1) continue;
    for (const obj of data) {
      for (const def of obj.definitions) {
        defs.push({
          speech: data[0].partOfSpeech,
          definition: def.definition
        });
        i++;
      }
    }
    const n = Math.floor(Math.random() * defs.length);
    final.push({
      word: word,
      speech: defs[n].speech,
      definition: defs[n].definition
    });
    definitions[word] = {
      speech: defs[n].speech,
      definition: defs[n].definition
    };
  }
  return [definitions, findIntersections(words)];
}

const connectIntersections = function(joints) {
  const links = {};
  const junctions = [[], []];
  joints = Object.entries(joints);
  for (const joint of joints) {
    const base = joint[0];
    const adj = joint[1][0];
    const [i,j] = joint[1][1].split('-').map(Number);
    links[base] = [i, `${adj.slice(0, j)}_${adj.slice(j + 1)}`, adj];
    const a1 = base.split('');
    const a2 = adj.split('');
    a1[i] = a1[i].toUpperCase();
    a2[j] = a2[j].toUpperCase();
    junctions[0].push(adj.slice(0, j).split('').concat([a1], adj.slice(j + 1).split('')));
    junctions[1].push(base.slice(0, i).split('').concat([a2], base.slice(i + 1).split('')));
  }
  return links;
}

const generatePuzzle = function(pairs, definitions) {
  const junctions = Object.entries(pairs);
  const n = junctions.length;
  const coords = {};
  const startingCoords = {};
  const used = [];
  const letters = {};
  const characters = {};
  const nums = {
    across: 1,
    down: 2
  };
  const puzzleNumbers = {};

  let minX = Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let maxX = -Infinity;

  const size = 40;
  const spacing = 3;
  const canvas = {
    width: 750,
    height: 1000,
  }
  const spaces = Math.ceil((canvas.width) / (size + spacing));
  let [x,y] = [100 + (size + spacing) * Math.floor(spaces / 2),100 + (size + spacing) * Math.floor(spaces / 2)];

  const list = [];
  let index = 0;
  while (list.length <= n) {
    if (!(index in junctions)) {
      break;
    }
    let word = junctions[index][0];
    while (!list.includes(word)) {
      list.push(word);
      if (word in pairs) word = pairs[word][2];
      else break;
    }
    index++;
}

  for (const item of list) {
    coords[item] = item.split('').map(() => [null, null]);
  }

  const validSurroundings = function(word, pos, direction, passIndex) {
    let failed = false;
    if (direction === 'h') {
      const adj = `${pos.x + word.length * (size + spacing)},${pos.y}`;
      if (used.includes(adj)) {
        if (!(adj in startingCoords) || startingCoords[adj][1] !== direction) {
          failed = true;
        }
      }
      for (let i = 0; i < word.length; i++) {
        if (i === passIndex) continue;
        if (failed) break;
        let j = 1;
        while (true) {
          const position = `${pos.x + i * (size + spacing)},${pos.y - j * (size + spacing)}`;
          if (!used.includes(position)) break;
          if (position in startingCoords && startingCoords[position][1] === 'v') {
            failed = true;
            break;
          }
          if (failed) break;
          j++;
        }
      }
    } else {
      const adj = `${pos.x},${pos.y + word.length * (size + spacing)}`;
      if (used.includes(adj)) {
        if (!(adj in startingCoords) || startingCoords[adj][1] !== direction) {
          failed = true;
        }
      }
      for (let i = 0; i < word.length; i++) {
        if (i === passIndex) continue;
        if (failed) break;
        let j = 1;
        while (true) {
          const position = `${pos.x - j * (size + spacing)},${pos.y + i * (size + spacing)}`;
          if (!used.includes(position)) break;
          if (position in startingCoords && startingCoords[position][1] === 'h') {
            failed = true;
            break;
          }
          if (failed) break;
          j++;
        }
      }
    }
    return !failed;
  }

  const intersectionCoordinates = function(word) {
    for (let i = 0; i < word.length; i++) {
      if (!(word[i] in characters)) continue;
      const coords = characters[word[i]];
      for (const coord of coords) {
        let [xPos, yPos] = coord.split(',').map(Number);
        if (!used.includes(`${xPos},${yPos + size + spacing}`) && !used.includes(`${xPos},${yPos - size - spacing}`)) {
          if (used.includes(`${xPos},${yPos - size - spacing}`) || used.includes(`${xPos},${yPos + size + spacing}`)) continue;
          yPos -= i * (size + spacing);
          if (yPos <= -2 || yPos + word.length * (size + spacing) >= canvas.width) continue;
          let valid = true;
          for (let j = 0; j < word.length; j++) {
            const pos = `${xPos},${yPos + j * (size + spacing)}`;
            if (used.includes(pos) && letters[pos] !== word[j]) {
              valid = false;
              break;
            }
          }
          if (!valid) continue;
          if (!validSurroundings(word, { x: xPos, y: yPos }, 'v', i)) continue;
          if (xPos + size > canvas.width || xPos < 0 || yPos + size > canvas.width || yPos < 0) continue;
          orientation = 'v';
          return [xPos, yPos];
        } else if (!used.includes(`${xPos + size + spacing},${yPos}`) && !used.includes(`${xPos - size - spacing},${yPos}`)) {
          if (used.includes(`${xPos - size - spacing},${yPos}`) || used.includes(`${xPos + size + spacing},${yPos}`)) continue;
          xPos -= i * (size + spacing);
          if (xPos <= -2 || xPos + word.length * (size + spacing) >= canvas.width) continue;
          let valid = true;
          for (let j = 0; j < word.length; j++) {
            const pos = `${xPos + j * (size + spacing)},${yPos}`;
            if (used.includes(pos) && letters[pos] !== word[j]) {
              valid = false;
              break;
            }
          }
          if (!valid) continue;
          if (!validSurroundings(word, { x: xPos, y: yPos }, 'h', i)) continue;
          if (xPos + size > canvas.width || xPos < 0 || yPos + size > canvas.width || yPos < 0) continue;
          orientation = 'h';
          return [xPos, yPos];
        }
      }
    }
    return false;
  }

  const randomCoordinates = function(word) {
    let count = 0;
    while (count < 100) {
      valid = true;
      [x,y] = [
        100 + (size + spacing) * Math.floor(Math.random() * spaces),
        100 + (size + spacing) * Math.floor(Math.random() * spaces)
      ];
      for (let j = 0; j < word.length; j++) {
        if (j === 0 && !validSurroundings(word, { x: x, y: y }, 'h', -1)) {
          valid = false;
          break;
        }
        const pos = `${x + j * (size + spacing)},${y}`;
        if ((used.includes(pos) && letters[pos] !== word[j]) || (x + (j + 1) * (size + spacing) >= canvas.width) || x <= -2) {
          valid = false;
          break;
        } 
      }
      if (valid) orientation = 'h';
      if (!valid) {
        valid = true;
        for (let j = 0; j < word.length; j++) {
          if (j === 0 && !validSurroundings(word, { x: x, y: y }, 'v', -1)) {
            valid = false;
            break;
          }
          const pos = `${x},${y + j * (size + spacing)}`;
          if ((used.includes(pos) && letters[pos] !== word[j]) || (y + (j + 1) * (size + spacing) >= canvas.width) || y <= -2) {
            valid = false;
            break;
          }
        }
        if (valid) orientation = 'v';
      }
      count++;
      if (valid) break;
    }
  }

  let orientation = Math.random() < 0.5 ? 'h' : 'v';
  for (let i = 0; i <= n; i++) {
    const word = list[i];
    if (!(word in definitions)) continue;
    if (i !== 0) [x,y] = list[i-1] in pairs ? coords[list[i-1]][pairs[list[i-1]][0]] : [-1,-1];

    if (list[i-1] in pairs && word === pairs[list[i-1]][2]) {
      if (orientation === 'h') x -= (size + spacing) * pairs[list[i-1]][1].indexOf('_');
      else if (orientation === 'v') y -= (size + spacing) * pairs[list[i-1]][1].indexOf('_');
    } 

    let failed = false;
    for (let j = 0; j < word.length; j++) {
      const pos = orientation === 'h' ? `${x + j * (size + spacing)},${y}` : `${x},${y + j * (size + spacing)}`;
      const [xPos, yPos] = pos.split(',').map(Number);      
      if (letters[pos] !== word[j] || (xPos + size > canvas.width) || xPos < 0 || (yPos + size > canvas.width) || yPos < 0) {
        failed = true;
        break;
      }
    }

    const result = validSurroundings(word, { x: x, y: y }, orientation, list[i-1] in pairs ? pairs[list[i-1]][1].indexOf('_') : -1);
    if (list[i-1] in pairs && word === pairs[list[i-1]][2] && !failed && result) {
        // pass
    } else if (failed || !result) {
      const result = intersectionCoordinates(word);
      if (!result) randomCoordinates(word);
      else [x,y] = result;
    } else if (i !== 0) {
      let valid = false;
      let escaped = false;
      orientation = 'h';
      [x,y] = coords[pairs[word][2]][pairs[word][1].indexOf('_')];
      x -= (size + spacing) * pairs[word][0];
      for (let j = 0; j < word.length; j++) {
        const pos = `${x + j * (size + spacing)},${y}`;
        if ((used.includes(pos) && letters[pos] !== word[j]) || (x + (j + 1) * (size + spacing) >= canvas.width) || x <= -(size + spacing) || !validSurroundings(word, { x: x, y: y }, orientation, -1)) {
          escaped = true;
          break;
        }
      }
      if (!escaped) valid = 'h';
      if (!valid) {
        escaped = false;
        orientation = 'v';
        [x,y] = coords[pairs[word][2]][pairs[word][1].indexOf('_')];
        y -= (size + spacing) * pairs[word][0];
        for (let j = 0; j < word.length; j++) {
          const pos = `${x},${y + j * (size + spacing)}`;
          if ((used.includes(pos) && letters[pos] !== word[j]) || (y + (j + 1) * (size + spacing) >= canvas.width) || y <= -(size + spacing) || !validSurroundings(word, {x: x, y: y }, orientation, -1)) {
            escaped = true;
            break;
          }
        }
        if (!escaped) valid = 'v';
      }
      if (!valid) {
        const result = intersectionCoordinates(word);
        if (!result) randomCoordinates(word);
        else [x,y] = result;
      }
    }

    const addNumber = function() {
      if (orientation === 'h') {
        puzzleNumbers[nums.across] = word;
        nums.across += 2;
      } else {
        puzzleNumbers[nums.down] = word;
        nums.down += 2;
      }
    }

    for (let j = 0; j < word.length; j++) {
      const xPos = orientation === 'h' ? x + j * (size + spacing) : x;
      const yPos = orientation === 'h' ? y : y + j * (size + spacing);
      if (used.includes(`${xPos},${yPos}`)) {
        if (j === 0) {
          addNumber({ x: xPos, y: yPos }, `${xPos},${yPos}` in startingCoords);
          startingCoords[`${xPos},${yPos}`] = [word, orientation];
        }
        coords[word][j] = [xPos, yPos];
        continue;
      }
      minX = Math.min(minX, xPos);
      minY = Math.min(minY, yPos);
      maxY = Math.max(maxY, yPos + size);
      maxX = Math.max(maxX, xPos + size);
      if (j === 0) {
        addNumber({ x: xPos, y: yPos }, false);
        startingCoords[`${xPos},${yPos}`] = [word, orientation];
      }
      coords[word][j] = [xPos, yPos];
      used.push(`${xPos},${yPos}`);
      letters[`${xPos},${yPos}`] = word[j];
      if (word[j] in characters) characters[word[j]].push(`${xPos},${yPos}`)
      else characters[word[j]] = [`${xPos},${yPos}`];
    }
    orientation = orientation === 'h' ? 'v' : 'h';
  }
  
  let vertical = "";
  let horizontal = "";

  for (const [n,word] of Object.entries(puzzleNumbers)) {
    if (n % 2 === 0) vertical += `<span id="${n}" class="words"><b>${n}.</b> [<i>${definitions[word].speech}</i>] ${definitions[word].definition}</span><br>`;
    else horizontal += `<span id="${n}" class="words"><b>${n}.</b> [<i>${definitions[word].speech}</i>] ${definitions[word].definition}</span><br>`;
  }

  across.innerHTML = `<span class="fw-bolder fs-2">Across:</span><p class="fs-6">${horizontal}</p>`;
  down.innerHTML = `<span class="fw-bolder fs-2">Down:</span><p class="fs-6">${vertical}</p>`;

  return parseCoordinates(letters, puzzleNumbers, coords, size, spacing, { minX: minX, maxY: maxY, minY: minY });
}

const parseCoordinates = function(coords, labelCoords, wordCoords, size, spacing, bounds) {
  labelCoords = Object.entries(labelCoords);
  const positions = Object.entries(coords).map(elm => [elm[0].split(',').map(Number), elm[1]]).map(elm => {
    return [
      [
        Math.floor((elm[0][0]) / (size + spacing)),
        Math.floor((elm[0][1]) / (size + spacing))
      ],
      elm[1]
    ]
  });

  const tmp = {};
  const labelWords = {};
  for (const [n,word] of labelCoords) {
    labelWords[word] = n;
    const pos = wordCoords[word][0].map(n => Math.floor(n / (size + spacing))).join(',');
    if (!(pos in tmp)) tmp[pos] = [+n];
    else if (tmp[pos][0] % 2 === 0) tmp[pos].push(+n);
    else tmp[pos].unshift(+n);
  }

  wordCoords = Object.entries(wordCoords);
  const wordAtCoords = {};
  for (const [word,coords] of wordCoords) {
    for (const coord of coords) {
      const pos = coord.map(elm => Math.floor(elm / (size + spacing))).join(',');
      if (pos in wordAtCoords) wordAtCoords[pos].push(word);
      else wordAtCoords[pos] = [word];
    }
  }

  wordCoords = wordCoords.map(elm => elm[1]).map(elm => {
    return elm.map(n => {
      return n.map(m => Math.floor(m / (size + spacing))).toString();
    });
  });

  min.x = Math.floor(bounds.minX / (size + spacing));
  min.y = Math.floor(bounds.minY / (size + spacing));
  return [positions, tmp, wordCoords, labelWords, wordAtCoords];
}

generateBtn.addEventListener('click', () => {
  if (puzzle.classList.contains('puzzle-border')) puzzle.classList.remove('puzzle-border');
  checkBtn.style.display = 'none';
  solutionBtn.style.display = 'none';
  resetBtn.style.display = 'none';
  puzzle.style.display = 'none';
  generateBtn.parentElement.style.width = 'auto';
  puzzle.innerHTML = '';
  across.innerHTML = '';
  down.innerHTML = '';
  userSolution = {};
  if (solutionMode) revealSolution();
  getPuzzleHints(generateWords(15)).then(res => {
    const definitions = res[0];
    const junctions = Object.entries(res[1]);
    const used = [];
    const pairs = {};
    const joints = {};
    for (const arr of junctions) {
      const res = Object.entries(arr[1]).sort((a,b) => {
        if (used.includes(a[0])) return 1;
        if (used.includes(b[0])) return -1;
        if (b[1].length === a[1].length) return b[0].length - a[0].length;
        return b[1].length - a[1].length;
      });
      used.push(arr[0], res[0][0]);
      pairs[arr[0]] = res[0];
      joints[arr[0]] = [res[0][0], res[0][1][Math.floor(Math.random() * res[0][1].length)]];
    }
    [positions, labelCoords, groups, labelWords, wordAtCoords] = generatePuzzle(connectIntersections(joints), definitions);
  }).catch(error => {
      throw error;
  }).finally(() => {
    let xMax = -1;
    let yMax = -1;

    letters = {};
  
    for (const [[x,y],letter] of positions) {
      letters[`${x},${y}`] = letter;
      xMax = Math.max(xMax, x);
      yMax = Math.max(yMax, y);
    }

    // TODO CHANGE CELL SIZE HERE
    puzzle.style.gridTemplateColumns = `repeat(${xMax-min.x+1}, 1.75em)`;
    puzzle.style.gridTemplateRows = `repeat(${yMax-min.y+1}, 1.75em)`;

    const cells = (xMax - min.x + 1) * (yMax - min.y + 1);

    for (let i = 0, x = min.x, y = min.y; i < cells; i++) {
      if (x > xMax) {
        x = min.x;
        y++;
      }
      const pos = `${x},${y}`;
      x++;
  
      puzzle.innerHTML += 
      `<div style="position:relative;">
        ${pos in labelCoords ? `<span id="l-${pos}" class="puzzle-label" style="position:absolute; top:.000001%; left:9.2%; z-index:10">${labelCoords[pos][0]}</span>` : ''}
        ${pos in labelCoords && labelCoords[pos].length === 2 ? `<span id="l2-${pos}" class="puzzle-label" style="position:absolute; top:.000001%; left:65%; z-index:10">${labelCoords[pos][1]}</span>` : ''}
        <input type="text" class="cell" style="${!(pos in letters) ? "background-color:black" : ""}" pattern="[A-Za-z]{1}" minlength="1" maxlength="1" id="${pos}" ${pos in letters ? "" : "disabled"} autocorrect="off" spellcheck="false">
      </div>`;
      puzzle.style.display = 'grid';
    }
    
    if (!puzzle.classList.contains('puzzle-border')) puzzle.classList.add('puzzle-border');

    gridSpaces = Array.from(document.getElementsByClassName('cell'));
    puzzleLabels = Array.from(document.getElementsByClassName('puzzle-label'));
    words = Array.from(document.getElementsByClassName('words'));
    gridSpaces.forEach(elm => {
      elm.addEventListener('focusin', () => highlightWord(elm.id));
      elm.addEventListener('focusin', () => highlightHint(elm.id));
      elm.addEventListener('focusout', () => resetStyling());
      elm.addEventListener('change', () => elm.value = elm.value.toLowerCase());
    });
    checkBtn.parentElement.style.width = `${(xMax-min.x+2.75) * 1.75}em`;
    checkBtn.style.display = 'inline';
    solutionBtn.style.display = 'inline';
    resetBtn.style.display = 'inline';
  });
});

const resetStyling = function() {
  if (solutionMode) return;
  gridSpaces.forEach(elm => { 
    if (elm.id in letters) {
      elm.style.backgroundColor = 'white';
      elm.style.color = 'black';
    }
  });
  words.forEach(elm => {
    elm.classList.remove('highlight');
  });
  puzzleLabels.forEach(elm => {
    elm.style.color = 'black';
  });
}

const highlightHint = function(pos) {
  for (const group of groups) {
    if (group.includes(pos)) {
      const words = wordAtCoords[pos];
      for (const word of words) {
        document.getElementById(labelWords[word]).classList.add('highlight');
      }
    }
  }
}

const highlightWord = function(pos) {
  if (solutionMode) return;
  resetStyling();
  const curr = document.getElementById(pos);
  for (const group of groups) {
    if (group.includes(pos)) {
      for (const id of group) {
        const elm = document.getElementById(id);
        elm.style.backgroundColor = '#dee8f2';
      }
    }
  }
  curr.style.backgroundColor = 'rgba(25,85,165,.9)';
  curr.style.color = 'white';
  if (curr.id in labelCoords) {
    document.getElementById(`l-${curr.id}`).style.color = 'white';
    if (labelCoords[curr.id].length === 2) document.getElementById(`l2-${curr.id}`).style.color = 'white';
  }
}

const checkAnswers = function() {
  if (solutionMode) return;
  let isWinner = true;
  for (const space of gridSpaces) {
    if (space.disabled) continue;
    space.style.backgroundColor = 'white';
    space.style.color = letters[space.id] === space.value ? 'green' : 'red';
    if (letters[space.id] !== space.value) isWinner = false;
  }
  for (const space of puzzleLabels) {
    space.style.color = 'black';
  }
  if (isWinner) {
    overlay.innerHTML = '<div class="firework"></div>'.repeat(10);
    container.style.display = 'none';
    overlay.style.display = 'block';
    overlay.classList.add('fade-in');
    setTimeout(() => {
      overlay.classList.remove('fade-in');
      overlay.classList.add('fade-out');
      container.style.display = 'block';
      overlay.innerHTML = '';
      setTimeout(() =>{
        overlay.classList.remove('fade-out');
        overlay.style.display = 'none';
      }, 650);
    }, 5000);
  }
}

// const playAnimation = 

const resetPuzzle = function() {
  for (const space of gridSpaces) {
    if (space.disabled) continue;
    space.style.backgroundColor = 'white';
    space.style.color = 'black';
    space.value = '';
  }
  for (const space of puzzleLabels) {
    space.style.color = 'black';
  }
}

const revealSolution = function() {
  solutionMode = !solutionMode;
  solutionBtn.innerHTML = solutionMode ? 'Hide Solution!' : 'Reveal Solution!'
  if  (!solutionMode) {
    for (const space of gridSpaces) {
      if (space.value === "") continue;
      space.style.color = 'black';
      space.disabled = false;
      space.value = space.id in userSolution ? userSolution[space.id] : '';
    }
    return;
  }
  for (const space of gridSpaces) {
    if (space.disabled) continue;
    if (space.value !== "") userSolution[space.id] = space.value;
    space.style.backgroundColor = 'white';
    space.style.color = 'blue';
    space.disabled = true;
    space.value = letters[space.id];
  }
  for (const space of puzzleLabels) {
    space.style.color = 'black';
  }
}

document.addEventListener('keydown', (event) => {
  navigatePuzzle(event.key);
  clearCell(event.key);
});

const navigatePuzzle = function(key) {
  const direction = key === 'ArrowUp' ? 'up' : key === 'ArrowDown' ? 'down' : key === 'ArrowLeft' ? 'left' : key === 'ArrowRight' ? 'right' : null;
  if (direction === null) return;
  const cell = document.activeElement;
  if (cell.tagName !== 'INPUT' || !cell.classList.contains('cell')) return;
  let [x,y] = cell.id.split(',').map(Number);
  
  switch (direction) {
    case 'up':
      y--;
      break;
    case 'down':
      y++;
      break;
    case 'left':
      x--;
      break;
    case 'right':
      x++;
      break;
  }

  const elm = document.getElementById(`${x},${y}`);
  if (elm === null || elm.disabled) return;
  elm.focus();
}

const clearCell = function(key) {
  if (key !== 'Delete' && key !== 'Backspace') return;
  const cell = document.activeElement;
  if (cell.tagName !== 'INPUT' || !cell.classList.contains('cell')) return;
  cell.value = '';
}

checkBtn.addEventListener('click', () => checkAnswers());
resetBtn.addEventListener('click', () => resetPuzzle());
solutionBtn.addEventListener('click', () => revealSolution());

document.addEventListener('DOMContentLoaded', () => {
  overlay.style.display = 'none';
});
},{"random-words":3}],3:[function(require,module,exports){
var seedrandom = require('seedrandom');

var wordList = [
  // Borrowed from xkcd password generator which borrowed it from wherever
  "ability","able","aboard","about","above","accept","accident","according",
  "account","accurate","acres","across","act","action","active","activity",
  "actual","actually","add","addition","additional","adjective","adult","adventure",
  "advice","affect","afraid","after","afternoon","again","against","age",
  "ago","agree","ahead","aid","air","airplane","alike","alive",
  "all","allow","almost","alone","along","aloud","alphabet","already",
  "also","although","am","among","amount","ancient","angle","angry",
  "animal","announced","another","answer","ants","any","anybody","anyone",
  "anything","anyway","anywhere","apart","apartment","appearance","apple","applied",
  "appropriate","are","area","arm","army","around","arrange","arrangement",
  "arrive","arrow","art","article","as","aside","ask","asleep",
  "at","ate","atmosphere","atom","atomic","attached","attack","attempt",
  "attention","audience","author","automobile","available","average","avoid","aware",
  "away","baby","back","bad","badly","bag","balance","ball",
  "balloon","band","bank","bar","bare","bark","barn","base",
  "baseball","basic","basis","basket","bat","battle","be","bean",
  "bear","beat","beautiful","beauty","became","because","become","becoming",
  "bee","been","before","began","beginning","begun","behavior","behind",
  "being","believed","bell","belong","below","belt","bend","beneath",
  "bent","beside","best","bet","better","between","beyond","bicycle",
  "bigger","biggest","bill","birds","birth","birthday","bit","bite",
  "black","blank","blanket","blew","blind","block","blood","blow",
  "blue","board","boat","body","bone","book","border","born",
  "both","bottle","bottom","bound","bow","bowl","box","boy",
  "brain","branch","brass","brave","bread","break","breakfast","breath",
  "breathe","breathing","breeze","brick","bridge","brief","bright","bring",
  "broad","broke","broken","brother","brought","brown","brush","buffalo",
  "build","building","built","buried","burn","burst","bus","bush",
  "business","busy","but","butter","buy","by","cabin","cage",
  "cake","call","calm","came","camera","camp","can","canal",
  "cannot","cap","capital","captain","captured","car","carbon","card",
  "care","careful","carefully","carried","carry","case","cast","castle",
  "cat","catch","cattle","caught","cause","cave","cell","cent",
  "center","central","century","certain","certainly","chain","chair","chamber",
  "chance","change","changing","chapter","character","characteristic","charge","chart",
  "check","cheese","chemical","chest","chicken","chief","child","children",
  "choice","choose","chose","chosen","church","circle","circus","citizen",
  "city","class","classroom","claws","clay","clean","clear","clearly",
  "climate","climb","clock","close","closely","closer","cloth","clothes",
  "clothing","cloud","club","coach","coal","coast","coat","coffee",
  "cold","collect","college","colony","color","column","combination","combine",
  "come","comfortable","coming","command","common","community","company","compare",
  "compass","complete","completely","complex","composed","composition","compound","concerned",
  "condition","congress","connected","consider","consist","consonant","constantly","construction",
  "contain","continent","continued","contrast","control","conversation","cook","cookies",
  "cool","copper","copy","corn","corner","correct","correctly","cost",
  "cotton","could","count","country","couple","courage","course","court",
  "cover","cow","cowboy","crack","cream","create","creature","crew",
  "crop","cross","crowd","cry","cup","curious","current","curve",
  "customs","cut","cutting","daily","damage","dance","danger","dangerous",
  "dark","darkness","date","daughter","dawn","day","dead","deal",
  "dear","death","decide","declared","deep","deeply","deer","definition",
  "degree","depend","depth","describe","desert","design","desk","detail",
  "determine","develop","development","diagram","diameter","did","die","differ",
  "difference","different","difficult","difficulty","dig","dinner","direct","direction",
  "directly","dirt","dirty","disappear","discover","discovery","discuss","discussion",
  "disease","dish","distance","distant","divide","division","do","doctor",
  "does","dog","doing","doll","dollar","done","donkey","door",
  "dot","double","doubt","down","dozen","draw","drawn","dream",
  "dress","drew","dried","drink","drive","driven","driver","driving",
  "drop","dropped","drove","dry","duck","due","dug","dull",
  "during","dust","duty","each","eager","ear","earlier","early",
  "earn","earth","easier","easily","east","easy","eat","eaten",
  "edge","education","effect","effort","egg","eight","either","electric",
  "electricity","element","elephant","eleven","else","empty","end","enemy",
  "energy","engine","engineer","enjoy","enough","enter","entire","entirely",
  "environment","equal","equally","equator","equipment","escape","especially","essential",
  "establish","even","evening","event","eventually","ever","every","everybody",
  "everyone","everything","everywhere","evidence","exact","exactly","examine","example",
  "excellent","except","exchange","excited","excitement","exciting","exclaimed","exercise",
  "exist","expect","experience","experiment","explain","explanation","explore","express",
  "expression","extra","eye","face","facing","fact","factor","factory",
  "failed","fair","fairly","fall","fallen","familiar","family","famous",
  "far","farm","farmer","farther","fast","fastened","faster","fat",
  "father","favorite","fear","feathers","feature","fed","feed","feel",
  "feet","fell","fellow","felt","fence","few","fewer","field",
  "fierce","fifteen","fifth","fifty","fight","fighting","figure","fill",
  "film","final","finally","find","fine","finest","finger","finish",
  "fire","fireplace","firm","first","fish","five","fix","flag",
  "flame","flat","flew","flies","flight","floating","floor","flow",
  "flower","fly","fog","folks","follow","food","foot","football",
  "for","force","foreign","forest","forget","forgot","forgotten","form",
  "former","fort","forth","forty","forward","fought","found","four",
  "fourth","fox","frame","free","freedom","frequently","fresh","friend",
  "friendly","frighten","frog","from","front","frozen","fruit","fuel",
  "full","fully","fun","function","funny","fur","furniture","further",
  "future","gain","game","garage","garden","gas","gasoline","gate",
  "gather","gave","general","generally","gentle","gently","get","getting",
  "giant","gift","girl","give","given","giving","glad","glass",
  "globe","go","goes","gold","golden","gone","good","goose",
  "got","government","grabbed","grade","gradually","grain","grandfather","grandmother",
  "graph","grass","gravity","gray","great","greater","greatest","greatly",
  "green","grew","ground","group","grow","grown","growth","guard",
  "guess","guide","gulf","gun","habit","had","hair","half",
  "halfway","hall","hand","handle","handsome","hang","happen","happened",
  "happily","happy","harbor","hard","harder","hardly","has","hat",
  "have","having","hay","he","headed","heading","health","heard",
  "hearing","heart","heat","heavy","height","held","hello","help",
  "helpful","her","herd","here","herself","hidden","hide","high",
  "higher","highest","highway","hill","him","himself","his","history",
  "hit","hold","hole","hollow","home","honor","hope","horn",
  "horse","hospital","hot","hour","house","how","however","huge",
  "human","hundred","hung","hungry","hunt","hunter","hurried","hurry",
  "hurt","husband","ice","idea","identity","if","ill","image",
  "imagine","immediately","importance","important","impossible","improve","in","inch",
  "include","including","income","increase","indeed","independent","indicate","individual",
  "industrial","industry","influence","information","inside","instance","instant","instead",
  "instrument","interest","interior","into","introduced","invented","involved","iron",
  "is","island","it","its","itself","jack","jar","jet",
  "job","join","joined","journey","joy","judge","jump","jungle",
  "just","keep","kept","key","kids","kill","kind","kitchen",
  "knew","knife","know","knowledge","known","label","labor","lack",
  "lady","laid","lake","lamp","land","language","large","larger",
  "largest","last","late","later","laugh","law","lay","layers",
  "lead","leader","leaf","learn","least","leather","leave","leaving",
  "led","left","leg","length","lesson","let","letter","level",
  "library","lie","life","lift","light","like","likely","limited",
  "line","lion","lips","liquid","list","listen","little","live",
  "living","load","local","locate","location","log","lonely","long",
  "longer","look","loose","lose","loss","lost","lot","loud",
  "love","lovely","low","lower","luck","lucky","lunch","lungs",
  "lying","machine","machinery","mad","made","magic","magnet","mail",
  "main","mainly","major","make","making","man","managed","manner",
  "manufacturing","many","map","mark","market","married","mass","massage",
  "master","material","mathematics","matter","may","maybe","me","meal",
  "mean","means","meant","measure","meat","medicine","meet","melted",
  "member","memory","men","mental","merely","met","metal","method",
  "mice","middle","might","mighty","mile","military","milk","mill",
  "mind","mine","minerals","minute","mirror","missing","mission","mistake",
  "mix","mixture","model","modern","molecular","moment","money","monkey",
  "month","mood","moon","more","morning","most","mostly","mother",
  "motion","motor","mountain","mouse","mouth","move","movement","movie",
  "moving","mud","muscle","music","musical","must","my","myself",
  "mysterious","nails","name","nation","national","native","natural","naturally",
  "nature","near","nearby","nearer","nearest","nearly","necessary","neck",
  "needed","needle","needs","negative","neighbor","neighborhood","nervous","nest",
  "never","new","news","newspaper","next","nice","night","nine",
  "no","nobody","nodded","noise","none","noon","nor","north",
  "nose","not","note","noted","nothing","notice","noun","now",
  "number","numeral","nuts","object","observe","obtain","occasionally","occur",
  "ocean","of","off","offer","office","officer","official","oil",
  "old","older","oldest","on","once","one","only","onto",
  "open","operation","opinion","opportunity","opposite","or","orange","orbit",
  "order","ordinary","organization","organized","origin","original","other","ought",
  "our","ourselves","out","outer","outline","outside","over","own",
  "owner","oxygen","pack","package","page","paid","pain","paint",
  "pair","palace","pale","pan","paper","paragraph","parallel","parent",
  "park","part","particles","particular","particularly","partly","parts","party",
  "pass","passage","past","path","pattern","pay","peace","pen",
  "pencil","people","per","percent","perfect","perfectly","perhaps","period",
  "person","personal","pet","phrase","physical","piano","pick","picture",
  "pictured","pie","piece","pig","pile","pilot","pine","pink",
  "pipe","pitch","place","plain","plan","plane","planet","planned",
  "planning","plant","plastic","plate","plates","play","pleasant","please",
  "pleasure","plenty","plural","plus","pocket","poem","poet","poetry",
  "point","pole","police","policeman","political","pond","pony","pool",
  "poor","popular","population","porch","port","position","positive","possible",
  "possibly","post","pot","potatoes","pound","pour","powder","power",
  "powerful","practical","practice","prepare","present","president","press","pressure",
  "pretty","prevent","previous","price","pride","primitive","principal","principle",
  "printed","private","prize","probably","problem","process","produce","product",
  "production","program","progress","promised","proper","properly","property","protection",
  "proud","prove","provide","public","pull","pupil","pure","purple",
  "purpose","push","put","putting","quarter","queen","question","quick",
  "quickly","quiet","quietly","quite","rabbit","race","radio","railroad",
  "rain","raise","ran","ranch","range","rapidly","rate","rather",
  "raw","rays","reach","read","reader","ready","real","realize",
  "rear","reason","recall","receive","recent","recently","recognize","record",
  "red","refer","refused","region","regular","related","relationship","religious",
  "remain","remarkable","remember","remove","repeat","replace","replied","report",
  "represent","require","research","respect","rest","result","return","review",
  "rhyme","rhythm","rice","rich","ride","riding","right","ring",
  "rise","rising","river","road","roar","rock","rocket","rocky",
  "rod","roll","roof","room","root","rope","rose","rough",
  "round","route","row","rubbed","rubber","rule","ruler","run",
  "running","rush","sad","saddle","safe","safety","said","sail",
  "sale","salmon","salt","same","sand","sang","sat","satellites",
  "satisfied","save","saved","saw","say","scale","scared","scene",
  "school","science","scientific","scientist","score","screen","sea","search",
  "season","seat","second","secret","section","see","seed","seeing",
  "seems","seen","seldom","select","selection","sell","send","sense",
  "sent","sentence","separate","series","serious","serve","service","sets",
  "setting","settle","settlers","seven","several","shade","shadow","shake",
  "shaking","shall","shallow","shape","share","sharp","she","sheep",
  "sheet","shelf","shells","shelter","shine","shinning","ship","shirt",
  "shoe","shoot","shop","shore","short","shorter","shot","should",
  "shoulder","shout","show","shown","shut","sick","sides","sight",
  "sign","signal","silence","silent","silk","silly","silver","similar",
  "simple","simplest","simply","since","sing","single","sink","sister",
  "sit","sitting","situation","six","size","skill","skin","sky",
  "slabs","slave","sleep","slept","slide","slight","slightly","slip",
  "slipped","slope","slow","slowly","small","smaller","smallest","smell",
  "smile","smoke","smooth","snake","snow","so","soap","social",
  "society","soft","softly","soil","solar","sold","soldier","solid",
  "solution","solve","some","somebody","somehow","someone","something","sometime",
  "somewhere","son","song","soon","sort","sound","source","south",
  "southern","space","speak","special","species","specific","speech","speed",
  "spell","spend","spent","spider","spin","spirit","spite","split",
  "spoken","sport","spread","spring","square","stage","stairs","stand",
  "standard","star","stared","start","state","statement","station","stay",
  "steady","steam","steel","steep","stems","step","stepped","stick",
  "stiff","still","stock","stomach","stone","stood","stop","stopped",
  "store","storm","story","stove","straight","strange","stranger","straw",
  "stream","street","strength","stretch","strike","string","strip","strong",
  "stronger","struck","structure","struggle","stuck","student","studied","studying",
  "subject","substance","success","successful","such","sudden","suddenly","sugar",
  "suggest","suit","sum","summer","sun","sunlight","supper","supply",
  "support","suppose","sure","surface","surprise","surrounded","swam","sweet",
  "swept","swim","swimming","swing","swung","syllable","symbol","system",
  "table","tail","take","taken","tales","talk","tall","tank",
  "tape","task","taste","taught","tax","tea","teach","teacher",
  "team","tears","teeth","telephone","television","tell","temperature","ten",
  "tent","term","terrible","test","than","thank","that","thee",
  "them","themselves","then","theory","there","therefore","these","they",
  "thick","thin","thing","think","third","thirty","this","those",
  "thou","though","thought","thousand","thread","three","threw","throat",
  "through","throughout","throw","thrown","thumb","thus","thy","tide",
  "tie","tight","tightly","till","time","tin","tiny","tip",
  "tired","title","to","tobacco","today","together","told","tomorrow",
  "tone","tongue","tonight","too","took","tool","top","topic",
  "torn","total","touch","toward","tower","town","toy","trace",
  "track","trade","traffic","trail","train","transportation","trap","travel",
  "treated","tree","triangle","tribe","trick","tried","trip","troops",
  "tropical","trouble","truck","trunk","truth","try","tube","tune",
  "turn","twelve","twenty","twice","two","type","typical","uncle",
  "under","underline","understanding","unhappy","union","unit","universe","unknown",
  "unless","until","unusual","up","upon","upper","upward","us",
  "use","useful","using","usual","usually","valley","valuable","value",
  "vapor","variety","various","vast","vegetable","verb","vertical","very",
  "vessels","victory","view","village","visit","visitor","voice","volume",
  "vote","vowel","voyage","wagon","wait","walk","wall","want",
  "war","warm","warn","was","wash","waste","watch","water",
  "wave","way","we","weak","wealth","wear","weather","week",
  "weigh","weight","welcome","well","went","were","west","western",
  "wet","whale","what","whatever","wheat","wheel","when","whenever",
  "where","wherever","whether","which","while","whispered","whistle","white",
  "who","whole","whom","whose","why","wide","widely","wife",
  "wild","will","willing","win","wind","window","wing","winter",
  "wire","wise","wish","with","within","without","wolf","women",
  "won","wonder","wonderful","wood","wooden","wool","word","wore",
  "work","worker","world","worried","worry","worse","worth","would",
  "wrapped","write","writer","writing","written","wrong","wrote","yard",
  "year","yellow","yes","yesterday","yet","you","young","younger",
  "your","yourself","youth","zero","zebra","zipper","zoo","zulu"
];

function words(options) {
  // initalize random number generator for words if options.seed is provided
  const random = options?.seed ? new seedrandom(options.seed) : null;

  function word() {
    if (options && options.maxLength > 1) {
      return generateWordWithMaxLength();
    } else {
      return generateRandomWord();
    }
  }

  function generateWordWithMaxLength() {
    var rightSize = false;
    var wordUsed;
    while (!rightSize) {  
      wordUsed = generateRandomWord();
      if(wordUsed.length <= options.maxLength) {
        rightSize = true;
      }

    }
    return wordUsed;
  }

  function generateRandomWord() {
    return wordList[randInt(wordList.length)];
  }

  // random int as seeded by options.seed if applicable, or Math.random() otherwise
  function randInt(lessThan) {
    const r = random ? random() : Math.random();
    return Math.floor(r * lessThan);
  }

  // No arguments = generate one word
  if (typeof(options) === 'undefined') {
    return word();
  }

  // Just a number = return that many words
  if (typeof(options) === 'number') {
    options = { exactly: options };
  }

  // options supported: exactly, min, max, join
  if (options.exactly) {
    options.min = options.exactly;
    options.max = options.exactly;
  }
  
  // not a number = one word par string
  if (typeof(options.wordsPerString) !== 'number') {
    options.wordsPerString = 1;
  }

  //not a function = returns the raw word
  if (typeof(options.formatter) !== 'function') {
    options.formatter = (word) => word;
  }

  //not a string = separator is a space
  if (typeof(options.separator) !== 'string') {
    options.separator = ' ';
  }

  var total = options.min + randInt(options.max + 1 - options.min);
  var results = [];
  var token = '';
  var relativeIndex = 0;

  for (var i = 0; (i < total * options.wordsPerString); i++) {
    if (relativeIndex === options.wordsPerString - 1) {
      token += options.formatter(word(), relativeIndex);
    }
    else {
      token += options.formatter(word(), relativeIndex) + options.separator;
    }
    relativeIndex++;
    if ((i + 1) % options.wordsPerString === 0) {
      results.push(token);
      token = ''; 
      relativeIndex = 0;
    }
   
  }
  if (typeof options.join === 'string') {
    results = results.join(options.join);
  }

  return results;
}

module.exports = words;
// Export the word list as it is often useful
words.wordList = wordList;

},{"seedrandom":4}],4:[function(require,module,exports){
// A library of seedable RNGs implemented in Javascript.
//
// Usage:
//
// var seedrandom = require('seedrandom');
// var random = seedrandom(1); // or any seed.
// var x = random();       // 0 <= x < 1.  Every bit is random.
// var x = random.quick(); // 0 <= x < 1.  32 bits of randomness.

// alea, a 53-bit multiply-with-carry generator by Johannes Baagøe.
// Period: ~2^116
// Reported to pass all BigCrush tests.
var alea = require('./lib/alea');

// xor128, a pure xor-shift generator by George Marsaglia.
// Period: 2^128-1.
// Reported to fail: MatrixRank and LinearComp.
var xor128 = require('./lib/xor128');

// xorwow, George Marsaglia's 160-bit xor-shift combined plus weyl.
// Period: 2^192-2^32
// Reported to fail: CollisionOver, SimpPoker, and LinearComp.
var xorwow = require('./lib/xorwow');

// xorshift7, by François Panneton and Pierre L'ecuyer, takes
// a different approach: it adds robustness by allowing more shifts
// than Marsaglia's original three.  It is a 7-shift generator
// with 256 bits, that passes BigCrush with no systmatic failures.
// Period 2^256-1.
// No systematic BigCrush failures reported.
var xorshift7 = require('./lib/xorshift7');

// xor4096, by Richard Brent, is a 4096-bit xor-shift with a
// very long period that also adds a Weyl generator. It also passes
// BigCrush with no systematic failures.  Its long period may
// be useful if you have many generators and need to avoid
// collisions.
// Period: 2^4128-2^32.
// No systematic BigCrush failures reported.
var xor4096 = require('./lib/xor4096');

// Tyche-i, by Samuel Neves and Filipe Araujo, is a bit-shifting random
// number generator derived from ChaCha, a modern stream cipher.
// https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf
// Period: ~2^127
// No systematic BigCrush failures reported.
var tychei = require('./lib/tychei');

// The original ARC4-based prng included in this library.
// Period: ~2^1600
var sr = require('./seedrandom');

sr.alea = alea;
sr.xor128 = xor128;
sr.xorwow = xorwow;
sr.xorshift7 = xorshift7;
sr.xor4096 = xor4096;
sr.tychei = tychei;

module.exports = sr;

},{"./lib/alea":5,"./lib/tychei":6,"./lib/xor128":7,"./lib/xor4096":8,"./lib/xorshift7":9,"./lib/xorwow":10,"./seedrandom":11}],5:[function(require,module,exports){
// A port of an algorithm by Johannes Baagøe <baagoe@baagoe.com>, 2010
// http://baagoe.com/en/RandomMusings/javascript/
// https://github.com/nquinlan/better-random-numbers-for-javascript-mirror
// Original work is under MIT license -

// Copyright (C) 2010 by Johannes Baagøe <baagoe@baagoe.org>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.



(function(global, module, define) {

function Alea(seed) {
  var me = this, mash = Mash();

  me.next = function() {
    var t = 2091639 * me.s0 + me.c * 2.3283064365386963e-10; // 2^-32
    me.s0 = me.s1;
    me.s1 = me.s2;
    return me.s2 = t - (me.c = t | 0);
  };

  // Apply the seeding algorithm from Baagoe.
  me.c = 1;
  me.s0 = mash(' ');
  me.s1 = mash(' ');
  me.s2 = mash(' ');
  me.s0 -= mash(seed);
  if (me.s0 < 0) { me.s0 += 1; }
  me.s1 -= mash(seed);
  if (me.s1 < 0) { me.s1 += 1; }
  me.s2 -= mash(seed);
  if (me.s2 < 0) { me.s2 += 1; }
  mash = null;
}

function copy(f, t) {
  t.c = f.c;
  t.s0 = f.s0;
  t.s1 = f.s1;
  t.s2 = f.s2;
  return t;
}

function impl(seed, opts) {
  var xg = new Alea(seed),
      state = opts && opts.state,
      prng = xg.next;
  prng.int32 = function() { return (xg.next() * 0x100000000) | 0; }
  prng.double = function() {
    return prng() + (prng() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
  };
  prng.quick = prng;
  if (state) {
    if (typeof(state) == 'object') copy(state, xg);
    prng.state = function() { return copy(xg, {}); }
  }
  return prng;
}

function Mash() {
  var n = 0xefc8249d;

  var mash = function(data) {
    data = String(data);
    for (var i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      var h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 0x100000000; // 2^32
    }
    return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
  };

  return mash;
}


if (module && module.exports) {
  module.exports = impl;
} else if (define && define.amd) {
  define(function() { return impl; });
} else {
  this.alea = impl;
}

})(
  this,
  (typeof module) == 'object' && module,    // present in node.js
  (typeof define) == 'function' && define   // present with an AMD loader
);



},{}],6:[function(require,module,exports){
// A Javascript implementaion of the "Tyche-i" prng algorithm by
// Samuel Neves and Filipe Araujo.
// See https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf

(function(global, module, define) {

function XorGen(seed) {
  var me = this, strseed = '';

  // Set up generator function.
  me.next = function() {
    var b = me.b, c = me.c, d = me.d, a = me.a;
    b = (b << 25) ^ (b >>> 7) ^ c;
    c = (c - d) | 0;
    d = (d << 24) ^ (d >>> 8) ^ a;
    a = (a - b) | 0;
    me.b = b = (b << 20) ^ (b >>> 12) ^ c;
    me.c = c = (c - d) | 0;
    me.d = (d << 16) ^ (c >>> 16) ^ a;
    return me.a = (a - b) | 0;
  };

  /* The following is non-inverted tyche, which has better internal
   * bit diffusion, but which is about 25% slower than tyche-i in JS.
  me.next = function() {
    var a = me.a, b = me.b, c = me.c, d = me.d;
    a = (me.a + me.b | 0) >>> 0;
    d = me.d ^ a; d = d << 16 ^ d >>> 16;
    c = me.c + d | 0;
    b = me.b ^ c; b = b << 12 ^ d >>> 20;
    me.a = a = a + b | 0;
    d = d ^ a; me.d = d = d << 8 ^ d >>> 24;
    me.c = c = c + d | 0;
    b = b ^ c;
    return me.b = (b << 7 ^ b >>> 25);
  }
  */

  me.a = 0;
  me.b = 0;
  me.c = 2654435769 | 0;
  me.d = 1367130551;

  if (seed === Math.floor(seed)) {
    // Integer seed.
    me.a = (seed / 0x100000000) | 0;
    me.b = seed | 0;
  } else {
    // String seed.
    strseed += seed;
  }

  // Mix in string seed, then discard an initial batch of 64 values.
  for (var k = 0; k < strseed.length + 20; k++) {
    me.b ^= strseed.charCodeAt(k) | 0;
    me.next();
  }
}

function copy(f, t) {
  t.a = f.a;
  t.b = f.b;
  t.c = f.c;
  t.d = f.d;
  return t;
};

function impl(seed, opts) {
  var xg = new XorGen(seed),
      state = opts && opts.state,
      prng = function() { return (xg.next() >>> 0) / 0x100000000; };
  prng.double = function() {
    do {
      var top = xg.next() >>> 11,
          bot = (xg.next() >>> 0) / 0x100000000,
          result = (top + bot) / (1 << 21);
    } while (result === 0);
    return result;
  };
  prng.int32 = xg.next;
  prng.quick = prng;
  if (state) {
    if (typeof(state) == 'object') copy(state, xg);
    prng.state = function() { return copy(xg, {}); }
  }
  return prng;
}

if (module && module.exports) {
  module.exports = impl;
} else if (define && define.amd) {
  define(function() { return impl; });
} else {
  this.tychei = impl;
}

})(
  this,
  (typeof module) == 'object' && module,    // present in node.js
  (typeof define) == 'function' && define   // present with an AMD loader
);



},{}],7:[function(require,module,exports){
// A Javascript implementaion of the "xor128" prng algorithm by
// George Marsaglia.  See http://www.jstatsoft.org/v08/i14/paper

(function(global, module, define) {

function XorGen(seed) {
  var me = this, strseed = '';

  me.x = 0;
  me.y = 0;
  me.z = 0;
  me.w = 0;

  // Set up generator function.
  me.next = function() {
    var t = me.x ^ (me.x << 11);
    me.x = me.y;
    me.y = me.z;
    me.z = me.w;
    return me.w ^= (me.w >>> 19) ^ t ^ (t >>> 8);
  };

  if (seed === (seed | 0)) {
    // Integer seed.
    me.x = seed;
  } else {
    // String seed.
    strseed += seed;
  }

  // Mix in string seed, then discard an initial batch of 64 values.
  for (var k = 0; k < strseed.length + 64; k++) {
    me.x ^= strseed.charCodeAt(k) | 0;
    me.next();
  }
}

function copy(f, t) {
  t.x = f.x;
  t.y = f.y;
  t.z = f.z;
  t.w = f.w;
  return t;
}

function impl(seed, opts) {
  var xg = new XorGen(seed),
      state = opts && opts.state,
      prng = function() { return (xg.next() >>> 0) / 0x100000000; };
  prng.double = function() {
    do {
      var top = xg.next() >>> 11,
          bot = (xg.next() >>> 0) / 0x100000000,
          result = (top + bot) / (1 << 21);
    } while (result === 0);
    return result;
  };
  prng.int32 = xg.next;
  prng.quick = prng;
  if (state) {
    if (typeof(state) == 'object') copy(state, xg);
    prng.state = function() { return copy(xg, {}); }
  }
  return prng;
}

if (module && module.exports) {
  module.exports = impl;
} else if (define && define.amd) {
  define(function() { return impl; });
} else {
  this.xor128 = impl;
}

})(
  this,
  (typeof module) == 'object' && module,    // present in node.js
  (typeof define) == 'function' && define   // present with an AMD loader
);



},{}],8:[function(require,module,exports){
// A Javascript implementaion of Richard Brent's Xorgens xor4096 algorithm.
//
// This fast non-cryptographic random number generator is designed for
// use in Monte-Carlo algorithms. It combines a long-period xorshift
// generator with a Weyl generator, and it passes all common batteries
// of stasticial tests for randomness while consuming only a few nanoseconds
// for each prng generated.  For background on the generator, see Brent's
// paper: "Some long-period random number generators using shifts and xors."
// http://arxiv.org/pdf/1004.3115v1.pdf
//
// Usage:
//
// var xor4096 = require('xor4096');
// random = xor4096(1);                        // Seed with int32 or string.
// assert.equal(random(), 0.1520436450538547); // (0, 1) range, 53 bits.
// assert.equal(random.int32(), 1806534897);   // signed int32, 32 bits.
//
// For nonzero numeric keys, this impelementation provides a sequence
// identical to that by Brent's xorgens 3 implementaion in C.  This
// implementation also provides for initalizing the generator with
// string seeds, or for saving and restoring the state of the generator.
//
// On Chrome, this prng benchmarks about 2.1 times slower than
// Javascript's built-in Math.random().

(function(global, module, define) {

function XorGen(seed) {
  var me = this;

  // Set up generator function.
  me.next = function() {
    var w = me.w,
        X = me.X, i = me.i, t, v;
    // Update Weyl generator.
    me.w = w = (w + 0x61c88647) | 0;
    // Update xor generator.
    v = X[(i + 34) & 127];
    t = X[i = ((i + 1) & 127)];
    v ^= v << 13;
    t ^= t << 17;
    v ^= v >>> 15;
    t ^= t >>> 12;
    // Update Xor generator array state.
    v = X[i] = v ^ t;
    me.i = i;
    // Result is the combination.
    return (v + (w ^ (w >>> 16))) | 0;
  };

  function init(me, seed) {
    var t, v, i, j, w, X = [], limit = 128;
    if (seed === (seed | 0)) {
      // Numeric seeds initialize v, which is used to generates X.
      v = seed;
      seed = null;
    } else {
      // String seeds are mixed into v and X one character at a time.
      seed = seed + '\0';
      v = 0;
      limit = Math.max(limit, seed.length);
    }
    // Initialize circular array and weyl value.
    for (i = 0, j = -32; j < limit; ++j) {
      // Put the unicode characters into the array, and shuffle them.
      if (seed) v ^= seed.charCodeAt((j + 32) % seed.length);
      // After 32 shuffles, take v as the starting w value.
      if (j === 0) w = v;
      v ^= v << 10;
      v ^= v >>> 15;
      v ^= v << 4;
      v ^= v >>> 13;
      if (j >= 0) {
        w = (w + 0x61c88647) | 0;     // Weyl.
        t = (X[j & 127] ^= (v + w));  // Combine xor and weyl to init array.
        i = (0 == t) ? i + 1 : 0;     // Count zeroes.
      }
    }
    // We have detected all zeroes; make the key nonzero.
    if (i >= 128) {
      X[(seed && seed.length || 0) & 127] = -1;
    }
    // Run the generator 512 times to further mix the state before using it.
    // Factoring this as a function slows the main generator, so it is just
    // unrolled here.  The weyl generator is not advanced while warming up.
    i = 127;
    for (j = 4 * 128; j > 0; --j) {
      v = X[(i + 34) & 127];
      t = X[i = ((i + 1) & 127)];
      v ^= v << 13;
      t ^= t << 17;
      v ^= v >>> 15;
      t ^= t >>> 12;
      X[i] = v ^ t;
    }
    // Storing state as object members is faster than using closure variables.
    me.w = w;
    me.X = X;
    me.i = i;
  }

  init(me, seed);
}

function copy(f, t) {
  t.i = f.i;
  t.w = f.w;
  t.X = f.X.slice();
  return t;
};

function impl(seed, opts) {
  if (seed == null) seed = +(new Date);
  var xg = new XorGen(seed),
      state = opts && opts.state,
      prng = function() { return (xg.next() >>> 0) / 0x100000000; };
  prng.double = function() {
    do {
      var top = xg.next() >>> 11,
          bot = (xg.next() >>> 0) / 0x100000000,
          result = (top + bot) / (1 << 21);
    } while (result === 0);
    return result;
  };
  prng.int32 = xg.next;
  prng.quick = prng;
  if (state) {
    if (state.X) copy(state, xg);
    prng.state = function() { return copy(xg, {}); }
  }
  return prng;
}

if (module && module.exports) {
  module.exports = impl;
} else if (define && define.amd) {
  define(function() { return impl; });
} else {
  this.xor4096 = impl;
}

})(
  this,                                     // window object or global
  (typeof module) == 'object' && module,    // present in node.js
  (typeof define) == 'function' && define   // present with an AMD loader
);

},{}],9:[function(require,module,exports){
// A Javascript implementaion of the "xorshift7" algorithm by
// François Panneton and Pierre L'ecuyer:
// "On the Xorgshift Random Number Generators"
// http://saluc.engr.uconn.edu/refs/crypto/rng/panneton05onthexorshift.pdf

(function(global, module, define) {

function XorGen(seed) {
  var me = this;

  // Set up generator function.
  me.next = function() {
    // Update xor generator.
    var X = me.x, i = me.i, t, v, w;
    t = X[i]; t ^= (t >>> 7); v = t ^ (t << 24);
    t = X[(i + 1) & 7]; v ^= t ^ (t >>> 10);
    t = X[(i + 3) & 7]; v ^= t ^ (t >>> 3);
    t = X[(i + 4) & 7]; v ^= t ^ (t << 7);
    t = X[(i + 7) & 7]; t = t ^ (t << 13); v ^= t ^ (t << 9);
    X[i] = v;
    me.i = (i + 1) & 7;
    return v;
  };

  function init(me, seed) {
    var j, w, X = [];

    if (seed === (seed | 0)) {
      // Seed state array using a 32-bit integer.
      w = X[0] = seed;
    } else {
      // Seed state using a string.
      seed = '' + seed;
      for (j = 0; j < seed.length; ++j) {
        X[j & 7] = (X[j & 7] << 15) ^
            (seed.charCodeAt(j) + X[(j + 1) & 7] << 13);
      }
    }
    // Enforce an array length of 8, not all zeroes.
    while (X.length < 8) X.push(0);
    for (j = 0; j < 8 && X[j] === 0; ++j);
    if (j == 8) w = X[7] = -1; else w = X[j];

    me.x = X;
    me.i = 0;

    // Discard an initial 256 values.
    for (j = 256; j > 0; --j) {
      me.next();
    }
  }

  init(me, seed);
}

function copy(f, t) {
  t.x = f.x.slice();
  t.i = f.i;
  return t;
}

function impl(seed, opts) {
  if (seed == null) seed = +(new Date);
  var xg = new XorGen(seed),
      state = opts && opts.state,
      prng = function() { return (xg.next() >>> 0) / 0x100000000; };
  prng.double = function() {
    do {
      var top = xg.next() >>> 11,
          bot = (xg.next() >>> 0) / 0x100000000,
          result = (top + bot) / (1 << 21);
    } while (result === 0);
    return result;
  };
  prng.int32 = xg.next;
  prng.quick = prng;
  if (state) {
    if (state.x) copy(state, xg);
    prng.state = function() { return copy(xg, {}); }
  }
  return prng;
}

if (module && module.exports) {
  module.exports = impl;
} else if (define && define.amd) {
  define(function() { return impl; });
} else {
  this.xorshift7 = impl;
}

})(
  this,
  (typeof module) == 'object' && module,    // present in node.js
  (typeof define) == 'function' && define   // present with an AMD loader
);


},{}],10:[function(require,module,exports){
// A Javascript implementaion of the "xorwow" prng algorithm by
// George Marsaglia.  See http://www.jstatsoft.org/v08/i14/paper

(function(global, module, define) {

function XorGen(seed) {
  var me = this, strseed = '';

  // Set up generator function.
  me.next = function() {
    var t = (me.x ^ (me.x >>> 2));
    me.x = me.y; me.y = me.z; me.z = me.w; me.w = me.v;
    return (me.d = (me.d + 362437 | 0)) +
       (me.v = (me.v ^ (me.v << 4)) ^ (t ^ (t << 1))) | 0;
  };

  me.x = 0;
  me.y = 0;
  me.z = 0;
  me.w = 0;
  me.v = 0;

  if (seed === (seed | 0)) {
    // Integer seed.
    me.x = seed;
  } else {
    // String seed.
    strseed += seed;
  }

  // Mix in string seed, then discard an initial batch of 64 values.
  for (var k = 0; k < strseed.length + 64; k++) {
    me.x ^= strseed.charCodeAt(k) | 0;
    if (k == strseed.length) {
      me.d = me.x << 10 ^ me.x >>> 4;
    }
    me.next();
  }
}

function copy(f, t) {
  t.x = f.x;
  t.y = f.y;
  t.z = f.z;
  t.w = f.w;
  t.v = f.v;
  t.d = f.d;
  return t;
}

function impl(seed, opts) {
  var xg = new XorGen(seed),
      state = opts && opts.state,
      prng = function() { return (xg.next() >>> 0) / 0x100000000; };
  prng.double = function() {
    do {
      var top = xg.next() >>> 11,
          bot = (xg.next() >>> 0) / 0x100000000,
          result = (top + bot) / (1 << 21);
    } while (result === 0);
    return result;
  };
  prng.int32 = xg.next;
  prng.quick = prng;
  if (state) {
    if (typeof(state) == 'object') copy(state, xg);
    prng.state = function() { return copy(xg, {}); }
  }
  return prng;
}

if (module && module.exports) {
  module.exports = impl;
} else if (define && define.amd) {
  define(function() { return impl; });
} else {
  this.xorwow = impl;
}

})(
  this,
  (typeof module) == 'object' && module,    // present in node.js
  (typeof define) == 'function' && define   // present with an AMD loader
);



},{}],11:[function(require,module,exports){
/*
Copyright 2019 David Bau.

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

(function (global, pool, math) {
//
// The following constants are related to IEEE 754 limits.
//

var width = 256,        // each RC4 output is 0 <= x < 256
    chunks = 6,         // at least six RC4 outputs for each double
    digits = 52,        // there are 52 significant digits in a double
    rngname = 'random', // rngname: name for Math.random and Math.seedrandom
    startdenom = math.pow(width, chunks),
    significance = math.pow(2, digits),
    overflow = significance * 2,
    mask = width - 1,
    nodecrypto;         // node.js crypto module, initialized at the bottom.

//
// seedrandom()
// This is the seedrandom function described above.
//
function seedrandom(seed, options, callback) {
  var key = [];
  options = (options == true) ? { entropy: true } : (options || {});

  // Flatten the seed string or build one from local entropy if needed.
  var shortseed = mixkey(flatten(
    options.entropy ? [seed, tostring(pool)] :
    (seed == null) ? autoseed() : seed, 3), key);

  // Use the seed to initialize an ARC4 generator.
  var arc4 = new ARC4(key);

  // This function returns a random double in [0, 1) that contains
  // randomness in every bit of the mantissa of the IEEE 754 value.
  var prng = function() {
    var n = arc4.g(chunks),             // Start with a numerator n < 2 ^ 48
        d = startdenom,                 //   and denominator d = 2 ^ 48.
        x = 0;                          //   and no 'extra last byte'.
    while (n < significance) {          // Fill up all significant digits by
      n = (n + x) * width;              //   shifting numerator and
      d *= width;                       //   denominator and generating a
      x = arc4.g(1);                    //   new least-significant-byte.
    }
    while (n >= overflow) {             // To avoid rounding up, before adding
      n /= 2;                           //   last byte, shift everything
      d /= 2;                           //   right using integer math until
      x >>>= 1;                         //   we have exactly the desired bits.
    }
    return (n + x) / d;                 // Form the number within [0, 1).
  };

  prng.int32 = function() { return arc4.g(4) | 0; }
  prng.quick = function() { return arc4.g(4) / 0x100000000; }
  prng.double = prng;

  // Mix the randomness into accumulated entropy.
  mixkey(tostring(arc4.S), pool);

  // Calling convention: what to return as a function of prng, seed, is_math.
  return (options.pass || callback ||
      function(prng, seed, is_math_call, state) {
        if (state) {
          // Load the arc4 state from the given state if it has an S array.
          if (state.S) { copy(state, arc4); }
          // Only provide the .state method if requested via options.state.
          prng.state = function() { return copy(arc4, {}); }
        }

        // If called as a method of Math (Math.seedrandom()), mutate
        // Math.random because that is how seedrandom.js has worked since v1.0.
        if (is_math_call) { math[rngname] = prng; return seed; }

        // Otherwise, it is a newer calling convention, so return the
        // prng directly.
        else return prng;
      })(
  prng,
  shortseed,
  'global' in options ? options.global : (this == math),
  options.state);
}

//
// ARC4
//
// An ARC4 implementation.  The constructor takes a key in the form of
// an array of at most (width) integers that should be 0 <= x < (width).
//
// The g(count) method returns a pseudorandom integer that concatenates
// the next (count) outputs from ARC4.  Its return value is a number x
// that is in the range 0 <= x < (width ^ count).
//
function ARC4(key) {
  var t, keylen = key.length,
      me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];

  // The empty key [] is treated as [0].
  if (!keylen) { key = [keylen++]; }

  // Set up S using the standard key scheduling algorithm.
  while (i < width) {
    s[i] = i++;
  }
  for (i = 0; i < width; i++) {
    s[i] = s[j = mask & (j + key[i % keylen] + (t = s[i]))];
    s[j] = t;
  }

  // The "g" method returns the next (count) outputs as one number.
  (me.g = function(count) {
    // Using instance members instead of closure state nearly doubles speed.
    var t, r = 0,
        i = me.i, j = me.j, s = me.S;
    while (count--) {
      t = s[i = mask & (i + 1)];
      r = r * width + s[mask & ((s[i] = s[j = mask & (j + t)]) + (s[j] = t))];
    }
    me.i = i; me.j = j;
    return r;
    // For robust unpredictability, the function call below automatically
    // discards an initial batch of values.  This is called RC4-drop[256].
    // See http://google.com/search?q=rsa+fluhrer+response&btnI
  })(width);
}

//
// copy()
// Copies internal state of ARC4 to or from a plain object.
//
function copy(f, t) {
  t.i = f.i;
  t.j = f.j;
  t.S = f.S.slice();
  return t;
};

//
// flatten()
// Converts an object tree to nested arrays of strings.
//
function flatten(obj, depth) {
  var result = [], typ = (typeof obj), prop;
  if (depth && typ == 'object') {
    for (prop in obj) {
      try { result.push(flatten(obj[prop], depth - 1)); } catch (e) {}
    }
  }
  return (result.length ? result : typ == 'string' ? obj : obj + '\0');
}

//
// mixkey()
// Mixes a string seed into a key that is an array of integers, and
// returns a shortened string seed that is equivalent to the result key.
//
function mixkey(seed, key) {
  var stringseed = seed + '', smear, j = 0;
  while (j < stringseed.length) {
    key[mask & j] =
      mask & ((smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++));
  }
  return tostring(key);
}

//
// autoseed()
// Returns an object for autoseeding, using window.crypto and Node crypto
// module if available.
//
function autoseed() {
  try {
    var out;
    if (nodecrypto && (out = nodecrypto.randomBytes)) {
      // The use of 'out' to remember randomBytes makes tight minified code.
      out = out(width);
    } else {
      out = new Uint8Array(width);
      (global.crypto || global.msCrypto).getRandomValues(out);
    }
    return tostring(out);
  } catch (e) {
    var browser = global.navigator,
        plugins = browser && browser.plugins;
    return [+new Date, global, plugins, global.screen, tostring(pool)];
  }
}

//
// tostring()
// Converts an array of charcodes to a string
//
function tostring(a) {
  return String.fromCharCode.apply(0, a);
}

//
// When seedrandom.js is loaded, we immediately mix a few bits
// from the built-in RNG into the entropy pool.  Because we do
// not want to interfere with deterministic PRNG state later,
// seedrandom will not call math.random on its own again after
// initialization.
//
mixkey(math.random(), pool);

//
// Nodejs and AMD support: export the implementation as a module using
// either convention.
//
if ((typeof module) == 'object' && module.exports) {
  module.exports = seedrandom;
  // When in node.js, try using crypto package for autoseeding.
  try {
    nodecrypto = require('crypto');
  } catch (ex) {}
} else if ((typeof define) == 'function' && define.amd) {
  define(function() { return seedrandom; });
} else {
  // When included as a plain script, set up Math.seedrandom global.
  math['seed' + rngname] = seedrandom;
}


// End anonymous scope, and pass initial values.
})(
  // global: `self` in browsers (including strict mode and web workers),
  // otherwise `this` in Node and other environments
  (typeof self !== 'undefined') ? self : this,
  [],     // pool: entropy pool starts empty
  Math    // math: package containing random, pow, and seedrandom
);

},{"crypto":1}]},{},[2]);
