#!/usr/bin/env bash

FILE="${1}"
MD5="$((0x$(md5sum ${FILE} | cut -b 1-7)))"
touch "${FILE}" -c -d @${MD5}
