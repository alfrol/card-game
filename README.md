# Card Game

Author: Alexander Frolov

## Details

This game was created during the course of "Web Applications" at the university.

The game was uploaded to the university server and can be found [here](http://dijkstra.cs.ttu.ee/~alfrol/prax3/).

## Game Information

The game is called *Memory Game*. The main point is to find all mathcing card pairs in the smallest amount of time.

During the game it is possible to get points for each mathcing pair as well as loose points for finding wrong pairs. The more points, the better. Score is uploaded to the *Scores History* table.

The scores are saved to the file using Python CGI module. When the game is over or the page is opened, a request is sent to the Python file.

You can choose with what amount of cards you want to play (*6*, *16*, *26*) as well as how to count the pairs (*only by suit* or *by both suit and value*).
