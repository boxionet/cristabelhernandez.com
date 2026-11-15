// Face explorer: zones, treatments and dot coordinates (percent of the photo).
// The home section renders its hotspots from this file, so the dots stay
// correct at any screen size. Descriptions match the booking catalog.
module.exports = {
  zones: [
    {
      id: "frente",
      zoneLabel: "Frente",
      name: "Toxina Botulínica Frontal",
      desc: "Suaviza líneas de expresión y arrugas dinámicas.",
      mujer: [50.3, 24.9],
      hombre: [49.6, 28.0],
    },
    {
      id: "ojos",
      zoneLabel: "Contorno de ojos",
      name: "Toxina Botulínica Full Face",
      desc: "Suaviza líneas de expresión y arrugas dinámicas.",
      mujer: [37.4, 35.2],
      hombre: [31.2, 42.6],
    },
    {
      id: "mejilla-microneedling",
      zoneLabel: "Rostro",
      name: "Microneedling",
      desc: "Estimula colágeno para mejorar textura y luminosidad.",
      mujer: [37.8, 42.1],
      hombre: [33.0, 51.6],
    },
    {
      id: "mejilla-prp",
      zoneLabel: "Rostro",
      name: "Plasma Rico en Plaquetas Facial",
      desc: "Plasma rico en plaquetas para rejuvenecimiento.",
      mujer: [62.6, 42.1],
      hombre: [67.5, 50.4],
    },
    {
      id: "menton",
      zoneLabel: "Mentón",
      name: "Lipólisis de Mentón",
      desc: "Reduce pequeños depósitos de grasa localizada en el mentón.",
      mujer: [50.2, 57.9],
      hombre: [49.9, 72.6],
    },
  ],
};
