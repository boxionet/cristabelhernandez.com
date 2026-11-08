const { DateTime } = require("luxon");

module.exports = function (dateObj) {
    // Blog dates are displayed in the clinic's timezone and in Dominican
    // Spanish long form ("7 de noviembre de 2026"), regardless of the
    // timezone or locale of the machine that builds the site.
    return DateTime.fromJSDate(dateObj, { zone: "America/Santo_Domingo" })
        .setLocale("es")
        .toFormat("d 'de' MMMM 'de' yyyy");
};
