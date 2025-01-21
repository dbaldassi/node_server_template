#!/bin/bash

help() {
    echo "Usage : $0 [--medooze |-h | --help] <project_name> <path>"
}

MEDOOZE=0

while true ; do
    case "$1" in
	--medooze )
	    MEDOOZE=1
	    shift
	    break
	    ;;
	-h | --help )
	    help
	    exit 0
	    ;;
	*)
	    break
	    ;;
    esac
done

if [ $# -ne 2 ]
then
    echo "Arguments list does not match : usage $0 [--medooze] <project_name> <path>"
    exit 2
fi

if [ ! -d "$2" ]
then
    echo "Destination path does not exists, please provide an existing path"
    exit 2
fi

DEST_PATH=$2
PROJECT_NAME=$1

if [ $MEDOOZE -eq 1 ]
then
    cp -vr template_medooze/ $DEST_PATH/$PROJECT_NAME
else
    cp -vr template/ $DEST_PATH/$PROJECT_NAME
fi

cd $DEST_PATH/$PROJECT_NAME

openssl ecparam -out server.key -name prime256v1 -genkey
openssl req -new -days 9999 -nodes -x509 -subj "/C=US/ST=\"\"/L=\"\"/O=\"\"/CN=\"\"" -keyout server.key -out server.cert

npm i express
npm i cors
npm i https

if [ $MEDOOZE -eq 1 ]
then
    npm i websocket
    npm i medooze-media-server
    npm i h264-encoder-mockup
    npm i semantic-sdp
    npm i transaction-manager

    mv binding.gyp node_modules/h264-encoder-mockup
    cd node_modules/h264-encoder-mockup
    
    node-gyp rebuild

    if [ $? -ne 0 ]
    then
	echo "Error rebuilding node modules, try installing node-gyp first : npm i -g node-gyp"
    fi
    
    cd -
fi

git init
git add -A
git commit -m "Initial commit"
