# CrosswordGenerator
A website for generating crossword puzzles completely from scratch. 

## Get Started
All you have to do to get started it press the "Generate!" button, then seelct the generation type that you want to use (see below for more information). After doing so, you can solve the puzzle in your browser, as well as check your answers and view the solution.
Arrow keys can be used to navigate between the different tiles of the puzzle.

## Generation Types

There are two types of crossword puzzle generation that are currently supported. The first and more simple puzzle is the fill-in puzzle and the second and more complicated (but smaller) puzzle is a standard American crossword puzzle (but only a 5x5 so similar to the NYTimes Mini Crossword Puzzle).

### Fill-in Puzzle
Works pretty well and speed it not an issue, but if the generate button is constantly being pressed, then the puzzle will fail to generate, due to the word definitions API being rate limited. The puzzle may not also be fully connected; the puzzle may break into multiple pieces, however, most of the words will belong to one "main" connection.

**Example**:

![](https://crossword-words.s3.us-east-2.amazonaws.com/002.png)

### NYTimes Mini Puzzle
The performance is not consist, as the generation times may range from a few seconds to almost 1.5 minutes. I may consider making optimizations to this algorithm in the future, which may include things like adding heuristics for backtracking and word construction/placement (or my entire approach may be scrapped). 
The words/clues that are provided are also not very helpful or inaccurate at times, since the wordlist that I am using is just about the only one that I could find that provides words and clues together. The wordlist was taken from [here](https://github.com/Eko35/EinsteinPuzzleSolver).

**Example**:

![](https://crossword-words.s3.us-east-2.amazonaws.com/001.png)

**If you're seeing this**, please [try it out](https://crosswordpuzzles.netlify.app/) for yourself!