#!/bin/bash

if [ $# -ne 2 ]
then
    echo "Arguments list does not match : usage $0 <project_name> <path>"
    exit 2
fi

if [ ! -d "$2" ]
then
    echo "Destination path does not exists, please provide an existing path"
    exit 2
fi

DEST_PATH=$2
PROJECT_NAME=$1

cp -vr template/ $DEST_PATH/$PROJECT_NAME

cd $DEST_PATH/$PROJECT_NAME

openssl ecparam -out server.key -name prime256v1 -genkey
openssl req -new -days 9999 -nodes -x509 -subj "/C=US/ST=\"\"/L=\"\"/O=\"\"/CN=\"\"" -keyout server.key -out server.cert

npm i express
npm i cors
npm i https

git init
git add -A
git commit -m "Initial commit"
