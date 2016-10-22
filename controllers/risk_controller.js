const models = require('../models');
const express = require('express');
const Q = require('q');
const isos = require('countries-iso')
const router = express.Router();

// Returns a random integer between min (included) and max (included)
// Using Math.round() will give you a non-uniform distribution!
function getRandomIntInclusive(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

router.get('/risk', function(req, res) {
    var overview = false;
    if ('overview' in req.query) {
        var overview = true;
    }
    var locationArray = JSON.parse(req.query.locs);
    console.log(locationArray);
    var locationCounter = 0;

    locationArray.forEach(function(location) {
        var locationAddress = location.address;
        var splitAddress = locationAddress.split(', ');
        var countryName = splitAddress[splitAddress.length - 1].trim();
        var countryISO = isos[countryName]; // 'ECU'

        Q.allSettled([
            models.Biological.findAll({where: {ISO: countryISO}}),
            models.Climatological.findAll({where: {ISO: countryISO}}),
            models.Geophysical.findAll({where: {ISO: countryISO}}),
            models.Hydrological.findAll({where: {ISO: countryISO}}),
            models.Metrological.findAll({where: {ISO: countryISO}})
        ]).then(function (searchResults) {
            var randomNumber = getRandomIntInclusive(0,100);
            var riskCalc = 0;
            for (var tableNum = 0; tableNum < searchResults.length; tableNum++) {
                var tableArray = [];
                var rows = searchResults[tableNum].value.length;
                var curRows = searchResults[tableNum].value;
                for (var rowNum = 0; rowNum < rows; rowNum++){
                    var rowObj = {
                        totalDeaths: curRows[rowNum].totalDeaths,
                        totalAffected: curRows[rowNum].totalAffected
                     }
                     tableArray.push(rowObj);
                }
                riskCalc += tableArray.length;
            }
            location.risk = riskCalc;
            locationCounter++;
            if (locationCounter === locationArray.length) {
                res.send(locationArray);
            }
        });
    });
});

module.exports = router;
