#!/bin/zsh
ffmpeg -i ../input/bottom.png -i ../input/top.png -filter_complex "[0:v][1:v]blend=all_mode=multiply" -c:v png multiply.png
