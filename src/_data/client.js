module.exports = {
  name: "Dra. Cristabel Hernandez",
  email: "hola@cristabelhernandez.com",
  phoneForTel: "829-316-3313",
  phoneFormatted: "(829) 316-3313",
  address: {
    lineOne: "Calle Beller No. 129",
    lineTwo: "Plaza Metropolis 2ndo Nivel",
    city: "Puerto Plata",
    state: "Puerto Plata",
    zip: "57000",
    country: "DO",
    mapLink: "https://www.google.com/maps/place/Dra.+Cristabel+Hern%C3%A1ndez+-+Medicina+Est%C3%A9tica,+regenerativa+y+antienvejecimiento/@19.7948341,-70.6881958,678m/data=!3m1!1e3!4m6!3m5!1s0x8eb1ef32ad8b0575:0x38e44379a6429fa7!8m2!3d19.7946178!4d-70.6871262!16s%2Fg%2F11zgy_vn4p?entry=ttu&g_ep=EgoyMDI2MTEwMy4wIKXMDSoASAFQAw%3D%3D",
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
