module.exports = {
  name: "Dr. Cristabel Hernandez",
  email: "cristabelhdez@gmail.com",
  phoneForTel: "829-316-3313",
  phoneFormatted: "(829) 316-3313",
  address: {
    lineOne: "Calle Beller No. 129",
    lineTwo: "Plaza Metropolis 2ndo Nivel",
    city: "Puerto Plata",
    state: "Puerto Plata",
    zip: "57000",
    country: "DO",
    mapLink: "https://maps.app.goo.gl/6Uwe9BHyzRARJeNF8",
  },
  socials: {
    instagram:
      "https://www.instagram.com/dra.cristabelhdez?igsh=MTJhNmZkMXZvM3M2dw==",
  },
  //! Make sure you include the file protocol (e.g. https://) and that NO TRAILING SLASH is included
  domain: "https://www.cristabelhernandez.com",
  // Passing the isProduction variable for use in HTML templates
  isProduction: process.env.ELEVENTY_ENV === "PROD",
};
