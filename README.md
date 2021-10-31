# OSM-Parser-JS
A javascript implementation of a OpenStreetMaps parser for viable destinations within a bounding box

## Usage

When the server is running, run a query using `{BASEURL}?left={LEFT_LATLON}&right={RIGHT_LATLON}&top={TOP_LATLON}&bottom={BOTTOM_LATLON}`, where:
 - `{BASEURL}` is the url of the server being deployed
 - `{LEFT_LATLON}`, `{RIGHT_LATLON}`, `{TOP_LATLON}` and `{BOTTOM_LATLON}` are the left, right, top and bottom lattitude-longitude pairs representing the corners of the bounding box surrounding the area the request is being performed on.

 The response consists of all viable destinitations within the area defined by the qurey parameters, and the parking garages nearby to each destination.

