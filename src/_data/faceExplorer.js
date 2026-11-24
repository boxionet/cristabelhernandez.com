// Face explorer: zones, treatments and dot coordinates (percent of the photo).
// The home section renders its hotspots from this file, so the dots stay
// correct at any screen size.
//
// Zone coordinates and the zone-to-treatment mapping stay here; the
// treatment name and description resolve from the booking catalog
// (src/_data/services.js) at build time, so a Panel edit flows through.
// A zone whose treatment is inactive or absent is dropped, so it renders
// no hotspot. The returned shape ({ zones: [{ id, zoneLabel, name, desc,
// mujer: [x, y], hombre: [x, y] }] }) is the contract the home template
// and assets/js/face-explorer.js already consume — unchanged.
const getServices = require("./services");

const ZONES = [
  {
    id: "frente",
    zoneLabel: "Frente",
    slug: "toxina-frontal",
    mujer: [50.3, 24.9],
    hombre: [49.6, 28.0],
  },
  {
    id: "ojos",
    zoneLabel: "Contorno de ojos",
    slug: "toxina-full-face",
    mujer: [37.4, 35.2],
    hombre: [31.2, 42.6],
  },
  {
    id: "mejilla-microneedling",
    zoneLabel: "Rostro",
    slug: "microneedling",
    mujer: [37.8, 42.1],
    hombre: [33.0, 51.6],
  },
  {
    id: "mejilla-prp",
    zoneLabel: "Rostro",
    slug: "prp-facial",
    mujer: [62.6, 42.1],
    hombre: [67.5, 50.4],
  },
  {
    id: "menton",
    zoneLabel: "Mentón",
    slug: "lipolisis-menton",
    mujer: [50.2, 57.9],
    hombre: [49.9, 72.6],
  },
];

module.exports = async function () {
  const services = await getServices();
  const bySlug = new Map(services.map((s) => [s.slug, s]));
  const zones = [];
  for (const zone of ZONES) {
    const service = bySlug.get(zone.slug);
    if (!service) continue; // inactive or removed: no hotspot for this zone
    zones.push({
      id: zone.id,
      zoneLabel: zone.zoneLabel,
      name: service.name,
      desc: service.description,
      mujer: zone.mujer,
      hombre: zone.hombre,
    });
  }
  return { zones };
};
