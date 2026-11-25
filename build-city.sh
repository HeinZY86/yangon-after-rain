#!/bin/sh
set -eu
if [ -s city/meta.json ]; then exit 0; fi
cache="${XDG_CACHE_HOME:-/tmp}/yangon-osm-build"
mkdir -p "$cache"
python3 -m venv "$cache/venv"
"$cache/venv/bin/pip" -q install 'osmium>=4.0,<5' 'shapely>=2.1,<3'
src="$cache/myanmar.osm.pbf"
if [ ! -s "$src" ]; then
  curl -fLsS --retry 3 'https://download.geofabrik.de/asia/myanmar/myanmar-latest.osm.pbf' -o "$src.part"
  mv "$src.part" "$src"
fi
"$cache/venv/bin/python" -u build_city.py "$src"
