#!/usr/bin/env bash
###############################################################################
## File: ./scripts/docs_push.sh
## Purpose: Synchronizes docs by pushing them to apollo-link
## Dependencies:
##  - Expects `yarn docs:check` to have been called right before this!
###############################################################################

cp docs/rest.md node_modules/apollo-link/repo/docs/source/links/rest.md
error=$?

if [[ $error -eq 0 ]]
then
    echo "Docs successfully pushed! The repo can be located at:"
    echo "cd node_modules/apollo-link/repo"
    echo -n "cd node_modules/apollo-link/repo; git checkout -b " | pbcopy
else
    echo "Error: did you fail to call yarn docs:check first?"
    exit 1 
fi
