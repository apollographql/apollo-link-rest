#!/usr/bin/env bash
###############################################################################
## File: ./scripts/docs_pull.sh
## Purpose: Synchronizes docs by pulling them from apollo-link into this repo
## Dependencies:
##  - Expects `yarn docs:check` to have been called right before this!
###############################################################################

cp node_modules/apollo-link/repo/docs/source/links/rest.md docs/rest.md || echo "Error: did you fail to call yarn docs:check first?"

git status
