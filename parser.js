/* eslint-disable no-param-reassign */
const parser = require('fast-xml-parser');

const fs = require('fs');

const deg2rad = deg => (deg * Math.PI / 180);
const rad2deg = rad => (rad / (Math.PI / 180));

const distance = (a, b) => rad2deg(Math.acos(Math.sin(deg2rad(a.lat))
             * Math.sin(deg2rad(b.lat))
             + Math.cos(deg2rad(a.lat))
             * Math.cos(deg2rad(b.lat))
             * Math.cos(deg2rad(a.lon - b.lon))))
             * 60 * 1.1515 * 1.609344;

exports.parse = (xml) => {
  const options = {
    attributeNamePrefix: '',
    attrNodeName: false,
    textNodeName: '#text',
    ignoreAttributes: false,
    ignoreNameSpace: false,
    allowBooleanAttributes: false,
    parseNodeValue: true,
    parseAttributeValue: true,
    trimValues: true,
    parseTrueNumberOnly: false,
  };
  const validCheck = parser.validate(xml);
  if (validCheck !== true) {
    return new Error(validCheck.err);
  }

  const JSONObj = parser.parse(xml, options);
  // node detection from the xml file
  let nodes = JSONObj.osm.node;
  if (nodes === undefined) {
    nodes = [];
  } else if (!Array.isArray(nodes)) {
    nodes = [nodes];
  }
  // way detection from the xml file
  let ways = JSONObj.osm.way;
  if (ways === undefined) {
    ways = [];
  } else if (!Array.isArray(ways)) {
    ways = [ways];
  }
  ways.forEach((way) => {
    // way.nodes = way.nd.map(nd => nodes.find(node => node.id === nd.ref));
    // way.nodes = way.nodes.filter(node => node !== undefined);
    if (!Array.isArray(way.nd)) {
      way.nd = [way.nd];
    }
    const node = nodes.find(n => way.nd.find(nd => n.id === nd.ref));
    if (node !== undefined) {
      way.lat = node.lat;
      way.lon = node.lon;
    }
  });
  // relation detection from xml file
  let relations = JSONObj.osm.relation;
  if (relations === undefined) {
    relations = [];
  } else if (!Array.isArray(relations)) {
    relations = [relations];
  }
  relations.forEach((relation) => {
    if (!Array.isArray(relation.member)) {
      relation.member = [relation.member];
    }
    if (relation.tag === undefined) {
      relation.tag = [];
    } else if (!Array.isArray(relation.tag)) {
      relation.tag = [relation.tag];
    }
    relation.member.filter(member => member.type === 'relation').forEach((subRelation) => {
      const r = relations.find(r2 => r2 === subRelation);
      if (r !== undefined) {
        if (r.tag === undefined) {
          r.tag = [];
        } else if (!Array.isArray(r.tag)) {
          r.tag = [r.tag];
        }
        r.tag = r.tag.concat(relation.tag);
      }
    });
  });

  relations.forEach((relation) => {
    relation.member.filter(member => member.type === 'node').forEach((node) => {
      const n = nodes.find(n2 => n2 === node);
      if (n !== undefined) {
        if (n.tag === undefined) {
          n.tag = [];
        } else if (!Array.isArray(n.tag)) {
          n.tag = [n.tag];
        }
        n.tag = n.tag.concat(relation.tag);
      }
    });
    relation.member.filter(member => member.type === 'way').forEach((way) => {
      const w = ways.find(w2 => w2 === way);
      if (w !== undefined) {
        if (w.tag === undefined) {
          w.tag = [];
        } else if (!Array.isArray(w.tag)) {
          w.tag = [w.tag];
        }
        w.tag = w.tag.concat(relation.tag);
      }
    });
  });

  const places = JSON.parse(fs.readFileSync('places.json', 'utf8'));
  const classes = JSON.parse(fs.readFileSync('classes.json', 'utf8'));
  places.forEach((place) => {
    place.classes = place.classes.map(c => classes.find(c2 => c2.name === c));
  });

  const taggedNodes = nodes.filter(node => 'tag' in node);
  taggedNodes.forEach((node) => {
    node.type = 'node';
  });
  const taggedWays = ways.filter(way => 'tag' in way);
  taggedWays.forEach((way) => {
    way.type = 'way';
  });
  const possibleDestinations = taggedNodes.concat(taggedWays);

  //  classification of destinations
  const destinations = [];
  const parkings = [];
  for (let r = 0; r < possibleDestinations.length; r += 1) {
    const token = {};
    places.forEach((place) => { token[place.name] = 0; });
    const vdest = {};
    vdest.id = possibleDestinations[r].id;
    vdest.type = possibleDestinations[r].type;
    vdest.lon = possibleDestinations[r].lon;
    vdest.lat = possibleDestinations[r].lat;
    vdest.names = [];
    for (let s = 0; s < possibleDestinations[r].tag.length; s += 1) {
      if (possibleDestinations[r].tag[s].k === 'name') {
        vdest.names.push(possibleDestinations[r].tag[s].v);
      }
      for (let t = 0; t < places.length; t += 1) {
        for (let tt = 0; tt < places[t].tags.length; tt += 1) {
          if ((possibleDestinations[r].tag[s].k === places[t].tags[tt].key)
          && (possibleDestinations[r].tag[s].v === places[t].tags[tt].value)) {
            token[places[t].name] += 1;
          }
        }
      }
    }
    const max = Object.keys(token).reduce((a, b) => (token[a] > token[b] ? a : b));
    if (token[max] !== 0) {
      if (max === 'parking') {
        vdest.access = 'public';
        for (let tt = 0; tt < possibleDestinations[r].tag.length; tt += 1) {
          if ((possibleDestinations[r].tag[tt].k === 'access') && (possibleDestinations[r].tag[tt].v === 'private')) {
            vdest.access = 'private';
            break;
          }
        }
        parkings.push(vdest);
      } else {
        const p = places.find(place => place.name === max);
        vdest.place = {
          name: p.name,
          classes: p.classes,
        };
        destinations.push(vdest);
      }
    }
  }

  // detection of parking areas for the destinations
  for (let i = 0; i < destinations.length; i += 1) {
    destinations[i].parkings = parkings.map(parking => ({
      id: parking.id,
      dist: distance(destinations[i], parking),
    })).sort((a, b) => b.dist - a.dist).map(parking => parking.id).slice(0, 20);
  }

  return {
    parkings,
    destinations,
  };
};
