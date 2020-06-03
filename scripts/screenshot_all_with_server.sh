#!/bin/bash

function Main() {
  echo "::"
  echo ":: Start server"
  echo "::"
  npm run start > /dev/null 2>&1 &
  local SERVER_PID="${!}"
  trap "kill ${SERVER_PID}" RETURN
  sleep 1

  echo "::"
  echo ":: Start screenshot"
  echo "::"
  npm run screenshot_all

  echo "::"
  echo ":: Finished"
  echo "::"
}

Main "${@}"
