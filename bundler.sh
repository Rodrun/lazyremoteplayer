#!/bin/sh

INPUT_FILES="$(ls public/javascripts | grep 'js$')"
# Iterate through filtered file list from GREP
while read -r line; do
    NEW_NAME="${line%%.*}"
    browserify "public/javascripts/$line" -o "public/javascripts/bundles/${NEW_NAME}App.js" -t [ babelify --presets [ @babel/preset-env @babel/preset-react ] --plugins [ @babel/plugin-proposal-class-properties ] ]
done <<< "$INPUT_FILES"
