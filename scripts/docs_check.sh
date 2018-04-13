#!/usr/bin/env bash
###############################################################################
## File: ./scripts/docs_check.sh
## Purpose: Alerts you if the docs are different from apollo-link!
###############################################################################

# Create dir if needed
mkdir -p node_modules/apollo-link

cd node_modules/apollo-link
git clone git@github.com:apollographql/apollo-link.git repo || true # Don't fail if repo already exists
cd repo

git reset --hard
git checkout master
git pull

diff ../../../docs/rest.md ./docs/source/links/rest.md
error=$?
if [ $error -eq 0 ]
then
    echo "Docs are in sync!"
    exit 0
else
    echo ""
    echo "Docs have differences. You should yarn docs:push or yarn docs:pull them!"
    exit 1
fi